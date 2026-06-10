import { expect, test } from '@playwright/test';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const defaultMessagesStorageState = path.resolve(
  process.cwd(),
  'e2e/.auth/messages-storage-state.json',
);
const hasAuthenticatedStorageState = Boolean(
  process.env.MESSAGES_STORAGE_STATE || fs.existsSync(defaultMessagesStorageState),
);
const localApiBase = process.env.STREETBOT_LOCAL_API_URL || 'http://localhost:18790';

type LocalJob = {
  id: string;
  title: string;
};

type LocalArtwork = {
  id: string;
  title: string;
};

type LocalCourse = {
  id: string;
  title: string;
};

type LocalComment = {
  user_id?: string;
  body?: string;
  created_at?: string;
};

type LocalEnrollment = {
  course_id?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type LocalGroupMessage = {
  id?: string;
  content?: string;
  createdAt?: string;
};

type LocalArticle = {
  id?: string;
  title?: string;
  content?: string;
  status?: string;
};

type LocalGrant = {
  id?: string;
  name?: string;
  stage?: string;
  archived_at?: string;
};

type LocalGrantWorkspace = {
  grants?: LocalGrant[];
  archived?: LocalGrant[];
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function waitForJson<T>(
  url: string,
  predicate: (value: T) => boolean,
  label: string,
  timeoutMs = 15000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let latest: T | undefined;

  while (Date.now() < deadline) {
    latest = await fetchJson<T>(url);
    if (predicate(latest)) {
      return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`${label} did not reach expected backend state: ${JSON.stringify(latest)}`);
}

async function readGrantWorkspace() {
  const workspacePath = process.env.STREETBOT_GRANT_WORKSPACE || path.resolve(
    process.cwd(),
    'uploads/streetbot-actions/grant-workspace.json',
  );

  if (!fs.existsSync(workspacePath)) {
    return { grants: [], archived: [] } satisfies LocalGrantWorkspace;
  }

  return JSON.parse(fs.readFileSync(workspacePath, 'utf8')) as LocalGrantWorkspace;
}

async function waitForGrantWorkspace(
  predicate: (workspace: LocalGrantWorkspace) => boolean,
  label: string,
  timeoutMs = 15000,
) {
  const deadline = Date.now() + timeoutMs;
  let latest: LocalGrantWorkspace | undefined;

  while (Date.now() < deadline) {
    latest = await readGrantWorkspace();
    if (predicate(latest)) {
      return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`${label} did not reach expected grant workspace state: ${JSON.stringify(latest)}`);
}

function socialMessageCount(content: string) {
  const escapedContent = content.replace(/'/g, "''");
  const output = execFileSync(
    'docker',
    [
      'exec',
      'nanobot-social-postgres',
      'psql',
      '-U',
      'social',
      '-d',
      'social',
      '-t',
      '-A',
      '-c',
      `SELECT count(*)::int FROM messages WHERE content = '${escapedContent}';`,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  ).trim();

  return Number(output || 0);
}

async function waitForSocialMessage(content: string, label: string, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let latest = 0;

  while (Date.now() < deadline) {
    latest = socialMessageCount(content);
    if (latest > 0) {
      return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`${label} did not create a social message row for "${content}". Latest count: ${latest}`);
}

async function healthyLocalActionApi() {
  try {
    const jobs = await fetchJson<LocalJob[]>(`${localApiBase}/jobs`);
    return Array.isArray(jobs) && jobs.length > 0;
  } catch {
    return false;
  }
}

function agentUrl(spec: string, verify: string) {
  const encodedSpec = encodeURIComponent(spec);
  return `/c/new?spec=${encodedSpec}&agentModel=${encodedSpec}&verify=${verify}-${Date.now()}`;
}

function composer(page: import('@playwright/test').Page, agentLabel: string) {
  return page.locator(`textarea[placeholder="Message ${agentLabel}"]`);
}

async function openAgent(page: import('@playwright/test').Page, spec: string, agentLabel: string) {
  await page.goto(agentUrl(spec, 'streetbot-agent-action-smoke'), {
    waitUntil: 'domcontentloaded',
  });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(composer(page, agentLabel)).toBeVisible({ timeout: 30000 });
}

async function submitPrompt(
  page: import('@playwright/test').Page,
  agentLabel: string,
  prompt: string,
) {
  const input = composer(page, agentLabel);
  await expect(input).toBeVisible({ timeout: 30000 });
  await input.fill(prompt);
  await input.press('Enter');
}

async function waitForBody(page: import('@playwright/test').Page, pattern: RegExp, label: string) {
  await expect
    .poll(async () => page.locator('body').innerText(), {
      message: label,
      timeout: 70000,
    })
    .toMatch(pattern);
}

async function expectCleanAgentUi(page: import('@playwright/test').Page, label: string) {
  const state = await page.evaluate(() => {
    const body = document.body?.innerText || '';
    return {
      body,
      rawFence: /local-action-request|streetbot-action-request|streetbot-agent-results|streetbot-service-results/i.test(
        body,
      ),
      jsonKeys: /"(action|parameters|title|content|items|result)"\s*:/i.test(body),
      streetBotLeak: /Street\s*Bot\s*here/i.test(body),
      startedPlaceholder: /The AI has started their reply/i.test(body),
    };
  });

  expect(state.rawFence, `${label}: raw action/result fence leaked`).toBe(false);
  expect(state.jsonKeys, `${label}: JSON-looking action payload leaked`).toBe(false);
  expect(state.streetBotLeak, `${label}: StreetBot identity leaked`).toBe(false);
  expect(state.startedPlaceholder, `${label}: reply placeholder remained visible`).toBe(false);
}

async function expectActionCardVisible(page: import('@playwright/test').Page, label: string) {
  await expect
    .poll(async () => page.getByTestId('streetbot-action-request-card').count(), {
      message: `${label}: action card should render as UI`,
      timeout: 10000,
    })
    .toBeGreaterThan(0);
}

async function expectResultCardVisible(
  page: import('@playwright/test').Page,
  resultTestId: string,
  cardTestId: string,
  label: string,
) {
  await expect
    .poll(async () => page.getByTestId(resultTestId).count(), {
      message: `${label}: result wrapper should render`,
      timeout: 70000,
    })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => page.getByTestId(cardTestId).count(), {
      message: `${label}: result cards should render`,
      timeout: 10000,
    })
    .toBeGreaterThan(0);
  await expectCleanAgentUi(page, label);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function expectAgentConversation(
  page: import('@playwright/test').Page,
  spec: string,
  agentLabel: string,
) {
  await openAgent(page, spec, agentLabel);
  await submitPrompt(page, agentLabel, 'Who are you, and can you chat normally?');
  await waitForBody(page, new RegExp(`I'm ${escapeRegExp(agentLabel)}`, 'i'), `${agentLabel} identity response`);
  await waitForBody(page, /talk to me normally|chat|plain language/i, `${agentLabel} conversation response`);
  await expectCleanAgentUi(page, `${agentLabel} general conversation`);
}

async function expectAgentHelpConversation(
  page: import('@playwright/test').Page,
  spec: string,
  agentLabel: string,
) {
  await openAgent(page, spec, agentLabel);
  await submitPrompt(page, agentLabel, `Hey ${agentLabel}, what can you help me with?`);
  await waitForBody(page, new RegExp(`I'm ${escapeRegExp(agentLabel)}`, 'i'), `${agentLabel} help identity response`);
  await waitForBody(page, /talk to me normally|ask strategy questions|live results|actual .* UI/i, `${agentLabel} help capability response`);
  await expectCleanAgentUi(page, `${agentLabel} help conversation`);
}

test.describe('StreetBot specialist agent actions', () => {
  test.skip(!hasAuthenticatedStorageState, 'requires an authenticated local storage state');

  test.beforeAll(async () => {
    test.skip(!(await healthyLocalActionApi()), 'requires the local StreetBot action API');
  });

  test('runs selected specialist agent actions with UI-safe output', async ({
    page,
  }) => {
    test.setTimeout(390000);

    const stamp = Date.now();
    const jobs = await fetchJson<LocalJob[]>(`${localApiBase}/jobs`);
    const job = jobs.find((item) => item.id === 'toronto-bus-operator-trainee') || jobs[0];
    const artworks = await fetchJson<LocalArtwork[]>(`${localApiBase}/gallery/artworks`);
    const artwork = artworks.find((item) => item.title === 'Invisible City') || artworks[0];
    const courses = await fetchJson<LocalCourse[]>(`${localApiBase}/api/academy/courses`);
    const course = courses.find((item) => /academy|journalism|digital/i.test(item.title)) || courses[0];

    expect(job?.title).toBeTruthy();
    expect(artwork?.id).toBeTruthy();
    expect(course?.id).toBeTruthy();

    await expectAgentConversation(page, 'agent/street_profile_agent', 'Street Profile Agent');
    await expectAgentConversation(page, 'agent/profiles_agent', 'Profiles Agent');
    await expectAgentConversation(page, 'agent/messaging_agent', 'Messaging Agent');
    await expectAgentConversation(page, 'agent/groups_agent', 'Groups Agent');
    await expectAgentConversation(page, 'agent/word_on_the_street_agent', 'Word on the Street Agent');
    await expectAgentConversation(page, 'agent/job_search_agent', 'Job Search Agent');
    await expectAgentConversation(page, 'agent/gallery_agent', 'Art Curator Agent');
    await expectAgentConversation(page, 'agent/academy_agent', 'Academy Agent');
    await expectAgentConversation(page, 'agent/grant_manager', 'Grant Manager Agent');

    await expectAgentHelpConversation(page, 'agent/street_profile_agent', 'Street Profile Agent');
    await expectAgentHelpConversation(page, 'agent/profiles_agent', 'Profiles Agent');
    await expectAgentHelpConversation(page, 'agent/messaging_agent', 'Messaging Agent');
    await expectAgentHelpConversation(page, 'agent/groups_agent', 'Groups Agent');
    await expectAgentHelpConversation(page, 'agent/word_on_the_street_agent', 'Word on the Street Agent');
    await expectAgentHelpConversation(page, 'agent/job_search_agent', 'Job Search Agent');
    await expectAgentHelpConversation(page, 'agent/gallery_agent', 'Art Curator Agent');
    await expectAgentHelpConversation(page, 'agent/academy_agent', 'Academy Agent');
    await expectAgentHelpConversation(page, 'agent/grant_manager', 'Grant Manager Agent');

    await openAgent(page, 'agent/profiles_agent', 'Profiles Agent');
    await submitPrompt(page, 'Profiles Agent', 'Show actual profile cards');
    await expectResultCardVisible(
      page,
      'street-profile-results',
      'street-profile-card',
      'profiles result cards',
    );

    await openAgent(page, 'agent/groups_agent', 'Groups Agent');
    await submitPrompt(page, 'Groups Agent', 'Show actual group cards');
    await expectResultCardVisible(
      page,
      'street-profile-results',
      'street-profile-group-card',
      'groups result cards',
    );

    await openAgent(page, 'agent/messaging_agent', 'Messaging Agent');
    await submitPrompt(page, 'Messaging Agent', 'Show actual message cards');
    await expectResultCardVisible(
      page,
      'street-profile-results',
      'street-profile-message-card',
      'messaging result cards',
    );

    await openAgent(page, 'agent/word_on_the_street_agent', 'Word on the Street Agent');
    await submitPrompt(page, 'Word on the Street Agent', 'Show actual Word on the Street post cards');
    await expectResultCardVisible(
      page,
      'street-profile-results',
      'street-profile-post-card',
      'word result cards',
    );

    await openAgent(page, 'agent/street_profile_agent', 'Street Profile Agent');
    await submitPrompt(page, 'Street Profile Agent', 'Show an overview of all connected Street Profile areas');
    await expectResultCardVisible(
      page,
      'street-profile-results',
      'street-profile-card',
      'street profile overview cards',
    );

    await openAgent(page, 'agent/job_search_agent', 'Job Search Agent');
    await submitPrompt(page, 'Job Search Agent', 'Show actual job cards');
    await expectResultCardVisible(
      page,
      'streetbot-agent-results',
      'streetbot-job-card',
      'job result cards',
    );

    await openAgent(page, 'agent/gallery_agent', 'Art Curator Agent');
    await submitPrompt(page, 'Art Curator Agent', 'Show actual art cards');
    await expectResultCardVisible(
      page,
      'streetbot-agent-results',
      'streetbot-art-card',
      'gallery result cards',
    );

    await openAgent(page, 'agent/academy_agent', 'Academy Agent');
    await submitPrompt(page, 'Academy Agent', 'Show actual academy course cards');
    await expectResultCardVisible(
      page,
      'streetbot-agent-results',
      'streetbot-academy-card',
      'academy result cards',
    );

    await openAgent(page, 'agent/grant_manager', 'Grant Manager Agent');
    await submitPrompt(page, 'Grant Manager Agent', 'Show actual grant cards');
    await expectResultCardVisible(
      page,
      'streetbot-agent-results',
      'streetbot-grant-card',
      'grant result cards',
    );

    // Keep the local-only regression under LibreChat's 40-message/minute limiter
    // before switching from read-only card checks to mutating action checks.
    await page.waitForTimeout(65000);

    await openAgent(page, 'agent/job_search_agent', 'Job Search Agent');
    await submitPrompt(page, 'Job Search Agent', `Save the ${job.title} job`);
    await waitForBody(page, /Save job completed locally/i, 'job save completed');
    await expectCleanAgentUi(page, 'job save');

    await submitPrompt(page, 'Job Search Agent', `Unsave the ${job.title} job`);
    await waitForBody(page, /Unsave job completed locally/i, 'job unsave completed');
    await expectCleanAgentUi(page, 'job unsave');

    await openAgent(page, 'agent/messaging_agent', 'Messaging Agent');
    const dmContent = `Codex DM regression ${stamp}`;
    await submitPrompt(page, 'Messaging Agent', `Send a message to Joel saying "${dmContent}"`);
    await waitForBody(
      page,
      /Send profile direct message is ready/i,
      'profile DM card rendered',
    );
    await expectActionCardVisible(page, 'profile DM');
    await expectCleanAgentUi(page, 'profile DM confirmation');

    await submitPrompt(page, 'Messaging Agent', 'confirm');
    await waitForBody(
      page,
      /Send profile direct message completed locally/i,
      'profile DM completed',
    );
    await expectCleanAgentUi(page, 'profile DM completed');
    await expect(await waitForSocialMessage(dmContent, 'profile DM')).toBeGreaterThan(0);

    await openAgent(page, 'agent/groups_agent', 'Groups Agent');
    const groupMessage = `Codex group regression ${stamp}`;
    await submitPrompt(page, 'Groups Agent', `Post to group 4 with message "${groupMessage}"`);
    await waitForBody(page, /Post group message is ready/i, 'group post card rendered');
    await expectActionCardVisible(page, 'group post');
    await expectCleanAgentUi(page, 'group post confirmation');

    await submitPrompt(page, 'Groups Agent', 'confirm');
    await waitForBody(page, /Post group message completed locally/i, 'group post completed');
    await expectCleanAgentUi(page, 'group post completed');

    await waitForJson<{ messages: LocalGroupMessage[] }>(
      `${localApiBase}/groups/4/messages`,
      (payload) => (payload.messages || []).some((message) => message.content === groupMessage),
      'group message post',
    );

    await openAgent(page, 'agent/gallery_agent', 'Art Curator Agent');
    const commentBody = `Codex gallery regression ${stamp}`;
    await submitPrompt(
      page,
      'Art Curator Agent',
      `Comment on ${artwork.title} with message "${commentBody}"`,
    );
    await waitForBody(page, /Comment on artwork is ready/i, 'gallery confirmation card rendered');
    await expectActionCardVisible(page, 'gallery confirmation');
    await expectCleanAgentUi(page, 'gallery confirmation');

    await submitPrompt(page, 'Art Curator Agent', 'confirm');
    await waitForBody(page, /Comment on artwork completed locally/i, 'gallery comment completed');
    await expectCleanAgentUi(page, 'gallery completed');

    const comments = await waitForJson<LocalComment[]>(
      `${localApiBase}/gallery/comments?artwork_id=${encodeURIComponent(artwork.id)}`,
      (items) => items.some((item) => item.body === commentBody),
      'gallery comment',
    );
    const smokeUserId = comments.find((item) => item.body === commentBody)?.user_id;
    expect(smokeUserId).toBeTruthy();

    const favorites = await fetchJson<unknown[]>(
      `${localApiBase}/jobs/favorites?user_id=${encodeURIComponent(smokeUserId || '')}`,
    );
    expect(favorites).toEqual([]);

    await openAgent(page, 'agent/word_on_the_street_agent', 'Word on the Street Agent');
    const articleTitle = `Codex Word Regression ${stamp}`;
    const articleContent = `Local Word regression content ${stamp}`;
    await submitPrompt(
      page,
      'Word on the Street Agent',
      `Create article "${articleTitle}" with content "${articleContent}"`,
    );
    await waitForBody(
      page,
      /Create Word on the Street article is ready/i,
      'word create card rendered',
    );
    await expectActionCardVisible(page, 'word create');
    await expectCleanAgentUi(page, 'word create confirmation');

    await submitPrompt(page, 'Word on the Street Agent', 'confirm');
    await waitForBody(
      page,
      /Create Word on the Street article completed locally/i,
      'word create completed',
    );
    await expectCleanAgentUi(page, 'word create completed');

    const createdArticles = await waitForJson<{ articles: LocalArticle[] }>(
      `${localApiBase}/news/articles`,
      (payload) => (payload.articles || []).some((article) => article.title === articleTitle),
      'word article create',
    );
    const articleId = (createdArticles.articles || []).find(
      (article) => article.title === articleTitle,
    )?.id;
    expect(articleId).toBeTruthy();

    await submitPrompt(page, 'Word on the Street Agent', `Delete article ${articleId}`);
    await waitForBody(
      page,
      /Delete Word on the Street article is ready/i,
      'word delete card rendered',
    );
    await expectActionCardVisible(page, 'word delete');
    await expectCleanAgentUi(page, 'word delete confirmation');

    await submitPrompt(page, 'Word on the Street Agent', 'confirm');
    await waitForBody(
      page,
      /Delete Word on the Street article completed locally/i,
      'word delete completed',
    );
    await expectCleanAgentUi(page, 'word delete completed');

    await waitForJson<{ articles: LocalArticle[] }>(
      `${localApiBase}/news/articles`,
      (payload) => !(payload.articles || []).some((article) => article.id === articleId),
      'word article delete',
    );

    await openAgent(page, 'agent/academy_agent', 'Academy Agent');
    await submitPrompt(page, 'Academy Agent', `Enroll in course "${course.title}"`);
    await waitForBody(page, /Enroll in Academy course is ready/i, 'academy enroll card rendered');
    await expectActionCardVisible(page, 'academy enroll');
    await expectCleanAgentUi(page, 'academy enroll confirmation');

    await submitPrompt(page, 'Academy Agent', 'confirm');
    await waitForBody(page, /Enroll in Academy course completed locally/i, 'academy enroll completed');
    await expectCleanAgentUi(page, 'academy enroll completed');

    await submitPrompt(page, 'Academy Agent', `Drop course "${course.title}"`);
    await waitForBody(page, /Drop Academy course is ready/i, 'academy drop card rendered');
    await expectActionCardVisible(page, 'academy drop');
    await expectCleanAgentUi(page, 'academy drop confirmation');

    await submitPrompt(page, 'Academy Agent', 'confirm');
    await waitForBody(page, /Drop Academy course completed locally/i, 'academy drop completed');
    await expectCleanAgentUi(page, 'academy drop completed');

    const enrollments = await waitForJson<LocalEnrollment[]>(
      `${localApiBase}/api/academy/enrollments?course_id=${encodeURIComponent(course.id)}`,
      (items) => items.some((item) => item.course_id === course.id && item.status === 'dropped'),
      'academy enrollment drop',
    );
    const latestEnrollment = enrollments
      .filter((item) => item.course_id === course.id)
      .sort((a, b) => {
        const left = new Date(a.updated_at || a.created_at || 0).getTime();
        const right = new Date(b.updated_at || b.created_at || 0).getTime();
        return right - left;
      })[0];
    expect(latestEnrollment?.status).toBe('dropped');

    const grantName = `Codex Grant Regression ${stamp}`;

    await openAgent(page, 'agent/grant_manager', 'Grant Manager Agent');
    await submitPrompt(
      page,
      'Grant Manager Agent',
      `Create a new grant opportunity "${grantName}" from Codex Foundation in drafting stage`,
    );
    await waitForBody(page, /Create grant opportunity is ready/i, 'grant create card rendered');
    await expectActionCardVisible(page, 'grant create');
    await expectCleanAgentUi(page, 'grant create confirmation');

    await submitPrompt(page, 'Grant Manager Agent', 'confirm');
    await waitForBody(page, /Create grant opportunity completed locally/i, 'grant create completed');
    await expectCleanAgentUi(page, 'grant create completed');

    const createdWorkspace = await waitForGrantWorkspace(
      (workspace) => (workspace.grants || []).some((grant) => grant.name === grantName),
      'grant create',
    );
    const createdGrant = (createdWorkspace.grants || []).find((grant) => grant.name === grantName);
    expect(createdGrant?.id).toBeTruthy();

    await submitPrompt(
      page,
      'Grant Manager Agent',
      `Update grant "${grantName}" to submitted stage`,
    );
    await waitForBody(page, /Update grant stage is ready/i, 'grant stage card rendered');
    await expectActionCardVisible(page, 'grant stage');
    await expectCleanAgentUi(page, 'grant stage confirmation');

    await submitPrompt(page, 'Grant Manager Agent', 'confirm');
    await waitForBody(page, /Update grant stage completed locally/i, 'grant stage completed');
    await expectCleanAgentUi(page, 'grant stage completed');

    await waitForGrantWorkspace(
      (workspace) =>
        (workspace.grants || []).some(
          (grant) => grant.name === grantName && grant.stage === 'submitted',
        ),
      'grant stage update',
    );

    await submitPrompt(page, 'Grant Manager Agent', `Archive grant "${grantName}"`);
    await waitForBody(page, /Archive grant opportunity is ready/i, 'grant archive card rendered');
    await expectActionCardVisible(page, 'grant archive');
    await expectCleanAgentUi(page, 'grant archive confirmation');

    await submitPrompt(page, 'Grant Manager Agent', 'confirm');
    await waitForBody(page, /Archive grant opportunity completed locally/i, 'grant archive completed');
    await expectCleanAgentUi(page, 'grant archive completed');

    const archivedWorkspace = await waitForGrantWorkspace(
      (workspace) =>
        !(workspace.grants || []).some((grant) => grant.name === grantName) &&
        (workspace.archived || []).some(
          (grant) =>
            grant.name === grantName &&
            grant.stage === 'submitted' &&
            typeof grant.archived_at === 'string',
        ),
      'grant archive',
    );

    expect((archivedWorkspace.archived || []).find((grant) => grant.name === grantName)?.stage).toBe(
      'submitted',
    );
  });
});

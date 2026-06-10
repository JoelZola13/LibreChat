const crypto = require('crypto');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { logger } = require('@librechat/data-schemas');
const { Constants } = require('librechat-data-provider');
const {
  GenerationJobManager,
  decrementPendingRequest,
  sanitizeMessageForTransmit,
  checkAndIncrementPendingRequest,
  getViolationInfo,
} = require('@librechat/api');
const { saveMessage, saveConvo, getMessages } = require('~/models');
let PgPool;
try {
  ({ Pool: PgPool } = require('pg'));
} catch (_) {
  PgPool = null;
}
let streetBotTelemetry;
try {
  streetBotTelemetry = require('/app/tools/streetbot-telemetry.cjs');
} catch (_) {
  streetBotTelemetry = require('./streetbot-telemetry.cjs');
}
let streetBotActionBridge;
try {
  streetBotActionBridge = require('/app/tools/streetbot-action-bridge.cjs');
} catch (_) {
  try {
    streetBotActionBridge = require('./streetbot-action-bridge.cjs');
  } catch (error) {
    streetBotActionBridge = null;
  }
}
const {
  annotateStreetBotRequestTrace,
  applyStreetBotSpanAttributes,
  buildPostHogTextMessage,
  captureStreetBotPostHogGeneration,
  captureStreetBotPostHogSpan,
  getStreetBotTraceIdentifiers,
  summarizeStreetBotText,
  withStreetBotSpan,
} = streetBotTelemetry;

const SERVICE_KEYWORDS = [
  'service',
  'services',
  'resource',
  'resources',
  'referral',
  'referrals',
  'housing',
  'shelter',
  'eviction',
  'rent',
  'food',
  'meal',
  'meals',
  'hungry',
  'hunger',
  'grocery',
  'groceries',
  'food bank',
  'legal',
  'clinic',
  'doctor',
  'doctors',
  'medical',
  'healthcare',
  'dentist',
  'dental',
  'pharmacy',
  'medication',
  'benefit',
  'benefits',
  'support',
  'supports',
  'mental health',
  'health',
  'newcomer',
  'youth',
  'senior',
  'seniors',
  'employment',
  'drop-in',
  'drop in',
  'help',
  'program',
  'programs',
];
const CONVERSATIONAL_SERVICE_KEYWORDS = new Set(['help', 'support', 'supports']);
const FINDER_ONLY_SERVICE_KEYWORDS = new Set(['program', 'programs', 'health']);
const DIRECT_BROWSE_CATEGORY_HINTS = [
  ['program', 'Programs'],
  ['programs', 'Programs'],
];
const BROWSE_LOCATION_LABELS = [
  ['toronto', 'Toronto'],
  ['scarborough', 'Scarborough'],
  ['etobicoke', 'Etobicoke'],
  ['north york', 'North York'],
  ['mississauga', 'Mississauga'],
  ['brampton', 'Brampton'],
  ['hamilton', 'Hamilton'],
  ['ottawa', 'Ottawa'],
  ['london', 'London'],
  ['windsor', 'Windsor'],
  ['barrie', 'Barrie'],
  ['guelph', 'Guelph'],
  ['oshawa', 'Oshawa'],
  ['kingston', 'Kingston'],
  ['sudbury', 'Sudbury'],
  ['thunder bay', 'Thunder Bay'],
  ['markham', 'Markham'],
  ['vaughan', 'Vaughan'],
  ['richmond hill', 'Richmond Hill'],
  ['oakville', 'Oakville'],
  ['burlington', 'Burlington'],
  ['ajax', 'Ajax'],
  ['pickering', 'Pickering'],
  ['newmarket', 'Newmarket'],
  ['waterloo', 'Waterloo'],
  ['kitchener', 'Kitchener'],
  ['cambridge', 'Cambridge'],
  ['ontario', 'Ontario'],
  ['quebec', 'Quebec'],
  ['british columbia', 'British Columbia'],
  ['alberta', 'Alberta'],
  ['manitoba', 'Manitoba'],
  ['saskatchewan', 'Saskatchewan'],
  ['nova scotia', 'Nova Scotia'],
  ['new brunswick', 'New Brunswick'],
  ['newfoundland', 'Newfoundland'],
  ['pei', 'PEI'],
  ['prince edward island', 'Prince Edward Island'],
];

const FINDER_PATTERNS = [
  /\b(find|search|look for|looking for|where|need|want|get|show|list|return|recommend)\b/i,
  /\bnear me\b/i,
  /\bin\b.+\b(toronto|ontario|hamilton|ottawa|mississauga|brampton|scarborough|etobicoke|north york)\b/i,
];
const NAMED_SERVICE_DETAIL_PATTERNS = [
  /\b(tell me more about|more about)\b/i,
  /\b(hours|eligibility|contact|phone|email|website|program details?|application details?)\b/i,
  /\b(open|visit|show|preview|navigate to|pull up|bring up)\b.*\b(application|form|website|site|page)\b/i,
];
const GENERIC_PROVIDER_PLACE_PATTERN =
  /\b(?:cent(?:re|er)s?|offices?|hubs?|drop[\s-]?ins?|banks?)\b/i;
const NUMBER_WORDS = new Map([
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
  ['eleven', 11],
  ['twelve', 12],
]);

const MORE_PATTERNS = [
  /^\s*(more|more please|show more|keep going|continue|next|next page|another page)\s*$/i,
  /\b(show|give|list)\b.*\bmore\b/i,
];

const CATEGORY_PATTERNS = [
  /\b(categories|category|types|service types|browse)\b/i,
  /\bwhat kinds of services\b/i,
];
const SERVICE_META_CONVERSATION_PATTERNS = [
  /^(do you (know|remember|recall))\b.*\b(services?|resources?|supports?|programs?|referrals?)\b/i,
  /^(what do you know about)\b.*\b(services?|resources?|supports?|programs?|referrals?)\b/i,
  /^(what (have|did) i)\b.*\b(search(?:ed|ing)?|look(?:ed|ing)? for|ask(?:ed|ing)? about|need(?:ed)?|want(?:ed)?)\b/i,
  /^(do i (usually|normally|tend to))\b.*\b(search|look for|ask for|need|want)\b/i,
  /^(what kind(?:s)? of)\b.*\b(services?|resources?|supports?|programs?|referrals?)\b.*\b(do i|have i|did i|i)\b/i,
  /^(what (services?|resources?|supports?|programs?|referrals?))\b.*\b(have i|did i|do i)\b/i,
  /^(can you tell me)\b.*\b(what|which)\b.*\b(services?|resources?|supports?|programs?|referrals?)\b.*\b(i|me|my)\b/i,
];
const EVALUATION_CONVERSATION_PATTERNS = [
  /\bstreet bot\b.*\b(stack|system|retrieval|transition|eval|evaluation|diagnostic|diagnostics|health|status|probe|corpus|weaviate|redis|postgres|latency)\b/i,
  /\b(stack health|system health|retrieval benchmark|transition guardrails|service corpus|corpus sync|stack doctor|admin check|probe run|weaviate status|redis status|postgres status|backup ops)\b/i,
];
const STACK_STATUS_FASTPATH_PATTERNS = [
  /\b(current|latest)\b.*\b(stack health|system health|stack doctor)\b/i,
  /\bgive me\b.*\b(stack health|system health)\b/i,
  /\b(weaviate status|redis status|postgres status|service corpus)\b/i,
];
const IMPROVEMENT_REVIEW_PATTERNS = [
  /\b(review|summari[sz]e|assess|inspect)\b.*\b(latest|current)\b.*\b(reports?|scorecards?|checks?)\b/i,
  /\b(top|latest|current)\s+(improvement|priorities|issues|regressions)\b/i,
  /\bwhat should street bot improve\b/i,
  /\bself[- ]improvement\b/i,
];
const STREETBOT_LOG_ROOT_CANDIDATES = [
  process.env.STREETBOT_WORKSPACE_ROOT,
  '/workspace',
  process.cwd(),
].filter(Boolean);
const LIMIT_WORD_PATTERN = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve';
const REFINEMENT_PATTERNS = [
  /\b(what about|how about|instead|make it|change it|switch it|same search|same area|only)\b/i,
  /^\s*(in|around)\s+[a-z]/i,
  /^\s*\d{1,2}\s*(?:results?|services?|options?|matches?|cards?)?\s*(?:in\s+[a-z].*)?$/i,
  new RegExp(
    `^\\s*(?:${LIMIT_WORD_PATTERN})\\s*(?:results?|services?|options?|matches?|cards?)?\\s*(?:in\\s+[a-z].*)?$`,
    'i',
  ),
];
const REFINEMENT_CONTEXT_ONLY_PATTERNS = [/\bsame search\b/i, /\bsame area\b/i];
const SERVICE_REFINEMENT_GEO_PATTERNS = [
  /\bnear me\b/i,
  /\bnearby\b/i,
  /\bclose(?:r)? to me\b/i,
  /\baround me\b/i,
];
const SERVICE_REFINEMENT_FILTER_PATTERNS = [
  /\b(women|woman|female|men|male|youth|teen|teens|senior|seniors|children|kids|families|family)\b/i,
  /\b(newcomer|immigrant|refugee|indigenous|lgbtq|disabled|disability|accessible)\b/i,
  /\b(open now|24\/7|walk[-\s]?in|drop[-\s]?in|appointment|free|low[-\s]?cost)\b/i,
];

const EMOTIONAL_PATTERNS = [
  /\bsuicid/i,
  /\bkill myself\b/i,
  /\bhurt myself\b/i,
  /\bself.?harm\b/i,
  /\bwant to die\b/i,
  /\bend (it|my life)\b/i,
  /\bcrisis\b/i,
  /\bemergency\b/i,
  /\babuse[d]?\b/i,
  /\bdomestic violence\b/i,
  /\boverdos/i,
  /\bfeel\b.*\b(suicidal|hopeless)\b/i,
];

const GREETING_PATTERNS = [
  /^(hi|hello|hey|hey there|hello there|yo|hiya|good morning|good afternoon|good evening)[!.?]*$/i,
  /^(hi|hello|hey)\s+(street bot|streetbot)(?:\s+0\.1)?[!.?]*$/i,
];

const CHECKIN_PATTERNS = [
  /^(how are you|how are you doing|how you doin'?|how you doing|how's it going|hows it going|what's up|whats up)[?.!]*$/i,
  /^(how(?:'s| is| was) your day|hows your day|how has your day been|how are things|you good|are you good)[?.!]*$/i,
];

const IDENTITY_PATTERNS = [
  /^(who are you|what are you|what do you do|tell me about yourself|what(?:'s| is) your name|whats your name|your name)[?.!]*$/i,
  /^(who am i talking to|who's this|whos this)[?.!]*$/i,
  /^(are you (street bot|streetbot))(?:\s+0\.1)?[?.!]*$/i,
];

const THANKS_PATTERNS = [/^(thanks|thank you|thx|appreciate it|thanks street bot)[!.?]*$/i];

const FAREWELL_PATTERNS = [/^(bye|goodbye|see ya|see you|talk soon|later)[!.?]*$/i];
const SERVICE_FEEDBACK_PATTERNS = [
  /\b(you only gave me|you just gave me|you only showed me|you just showed me|why only|only gave me|only showed me)\b/i,
  /\b(not enough|too few|thats all|that's all|just one|only one)\b.*\b(result|results|service|services|option|options|match|matches|card|cards)\b/i,
  /\b(i asked for more|i wanted more|need more than that)\b/i,
];
const ACKNOWLEDGMENT_PATTERNS = [
  /^(ok|okay|kk|k|cool|nice|awesome|perfect|great|sweet|solid|fair enough|understood|got it|makes sense|sounds good|all good|alright|all right|sure)[!.?]*$/i,
  /^(that helps|this helps|helpful|good to know|good point|good call|works for me|im with you|i'm with you)[!.?]*$/i,
  /^(wow|oh wow|damn|thats cool|that's cool|thats helpful|that's helpful|thats good|that's good)[!.?]*$/i,
];
const ACKNOWLEDGMENT_FILLER_WORDS = new Set([
  'aight',
  'alright',
  'all',
  'awesome',
  'cool',
  'dope',
  'fair',
  'fine',
  'good',
  'got',
  'great',
  'helpful',
  'it',
  'k',
  'kk',
  'makes',
  'nice',
  'okay',
  'ok',
  'perfect',
  'sense',
  'solid',
  'sounds',
  'sure',
  'sweet',
  'that',
  'thanks',
  'this',
  'understood',
  'well',
  'works',
  'wow',
  'ya',
  'yep',
  'yes',
]);
const PREFERENCE_PATTERNS = [
  /^(what(?:'s| is)?|whats)\s+your\s+(favorite|favourite)\s+(.+?)[?.!]*$/i,
  /^(do you have\s+(?:a|an)\s+(favorite|favourite)\s+(.+?))[?.!]*$/i,
];
const BOT_DIRECTED_TOPIC_CHAT_PATTERNS = [
  /^(what do you think about|how do you feel about)\s+(.+?)[?.!]*$/i,
  /^(do you (like|prefer|hate|love|enjoy))\s+(.+?)[?.!]*$/i,
  /^(are you (into|a fan of))\s+(.+?)[?.!]*$/i,
  /^(can you tell me about)\s+(.+?)[?.!]*$/i,
];
const RELATIONAL_PATTERNS = [
  /^(you(?:'re| are|re|r| seem| sound)\s+(?:really\s+|so\s+|very\s+)?(?:smart|helpful|kind|nice|good|great|awesome|cool|amazing|sweet|thoughtful|funny|the best|wonderful))[!.?]*$/i,
  /^(good job|nice job|great job|well done|you did good|you did well)[!.?]*$/i,
  /^(i\s+(?:like|appreciate|trust|love)\s+you)[!.?]*$/i,
  /^(i\s+(?:like|love|enjoy)\s+talking\s+to\s+you)[!.?]*$/i,
  /^(that(?:'s| is|s)\s+(?:kind|sweet|nice|helpful|smart|thoughtful))[!.?]*$/i,
  /^(you\s+helped\s+(?:a lot|me a lot)|you(?:'re| are)\s+(?:helpful|smart|kind))[!.?]*$/i,
];
const PLAYFUL_PATTERNS = [
  /^(?:ha)+[!.?]*$/i,
  /^(?:ha(?:ha)+|he(?:he)+|lol|lmao|lmfao|rofl|bahaha|bwahaha)[!.?]*$/i,
  /^(thats funny|that's funny|youre funny|you're funny|thats cute|that's cute|youre sweet|you're sweet)[!.?]*$/i,
];
const INFORMATIONAL_SERVICE_PATTERNS = [
  /^(what(?:'s| is)|whats)\s+(?:a|an|the)?\s*(.+?)[?.!]*$/i,
  /^(what are)\s+(.+?)[?.!]*$/i,
  /^(what do|what does)\s+(.+?)\s+do[?.!]*$/i,
  /^(how do|how does)\s+(.+?)\s+work[?.!]*$/i,
  /^(explain|define)\s+(.+?)[?.!]*$/i,
  /^(tell me about)\s+(.+?)[?.!]*$/i,
];
const SUPPORT_PATTERNS = [
  /\b(?:i\s+)?need\s+help\b/i,
  /\bhelp\s+me\b/i,
  /\b(overwhelmed|stressed|stress out|burnt out|burned out)\b/i,
  /\b(anxious|anxiety|panicking|panic)\b/i,
  /\b(sad|down|lonely)\b/i,
  /\b(replaying|ruminating|overthinking)\b/i,
  /\b(thoughts?|mind)\b.*\b(won't|wont|can't|cant|don't|dont)\s+(slow down|quiet down|settle)\b/i,
  /\b(can't|cant|won't|wont)\b.*\b(slow down|calm down|settle)\b/i,
  /\b(restless|spiraling|spiralling|racing thoughts)\b/i,
];
const WELLNESS_TIP_PATTERNS = [
  /\b(simple|quick|gentle|easy)\s+(way|step|thing)\b.*\b(reset|ground|calm|unwind|slow down)\b/i,
  /\b(reset|ground myself|calm down|slow down|unwind)\b.*\b(long day|hard day|stress|overwhelm|overwhelmed)\b/i,
  /^(what|what's|whats|how)\b.*\b(reset|ground myself|calm down|slow down|unwind)\b/i,
];
const JOKE_PATTERNS = [
  /^(tell me )?(a )?(quick )?joke(?: about .+)?[!.?]*$/i,
  /^(can you )?(tell me )?(something )?funny(?: about .+)?[!.?]*$/i,
  /^(make me laugh)(?: about .+)?[!.?]*$/i,
];
const GENERIC_SERVICE_BROWSE_WORDS = new Set([
  'i',
  'im',
  "i'm",
  'me',
  'my',
  'need',
  'needs',
  'want',
  'wants',
  'looking',
  'look',
  'for',
  'find',
  'show',
  'give',
  'list',
  'return',
  'recommend',
  'please',
  'some',
  'a',
  'an',
  'the',
  'service',
  'services',
  'resource',
  'resources',
  'support',
  'supports',
  'help',
  'program',
  'programs',
  'option',
  'options',
  'match',
  'matches',
  'card',
  'cards',
  'in',
  'near',
  'around',
]);
const NAMED_SERVICE_DETAIL_STOPWORDS = new Set([
  'a',
  'about',
  'an',
  'application',
  'apply',
  'details',
  'email',
  'for',
  'form',
  'hours',
  'me',
  'more',
  'open',
  'page',
  'phone',
  'program',
  'programs',
  'site',
  'tell',
  'the',
  'visit',
  'website',
]);
function truthyEnv(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

const STREETBOT_FASTPATH_STREAMING_ENABLED = truthyEnv(
  process.env.STREETBOT_FASTPATH_STREAMING_ENABLED || process.env.STREETBOT_STREAMING_ENABLED,
);
const STREETBOT_BACKEND_STREAMING_ENABLED = !truthyEnv(
  process.env.STREETBOT_BACKEND_STREAMING_DISABLED,
);
const STREETBOT_FASTPATH_KEEPALIVE_ENABLED = !truthyEnv(
  process.env.STREETBOT_FASTPATH_KEEPALIVE_DISABLED,
);
const STREETBOT_CONVERSATION_TIMEOUT_MS = Math.max(
  5000,
  Number(process.env.STREETBOT_CONVERSATION_TIMEOUT_MS || 15000) || 15000,
);
const STREETBOT_TEXT_STREAM_CHUNK_SIZE = 96;
const STREETBOT_TEXT_STREAM_DELAY_MS = 38;
const TITLECASE_SERVICE_NAME_PATTERN =
  /\b(?:[A-Z][A-Za-z'’&.-]*)(?:\s+(?:[A-Z][A-Za-z'’&.-]*|of|the|and|for|to|at|on)){1,5}\b/;

const STREET_PROFILE_AGENT_IDS = new Set([
  'agent/street_profile_agent',
  'agent/profiles_agent',
  'agent/messaging_agent',
  'agent/groups_agent',
  'agent/word_on_the_street_agent',
]);
const STREET_PROFILE_AGENT_LABEL_TO_ID = new Map([
  ['street profile agent', 'agent/street_profile_agent'],
  ['profiles agent', 'agent/profiles_agent'],
  ['messaging agent', 'agent/messaging_agent'],
  ['messages agent', 'agent/messaging_agent'],
  ['groups agent', 'agent/groups_agent'],
  ['word on the street agent', 'agent/word_on_the_street_agent'],
]);
const STREET_PROFILE_AGENT_ICON_URLS = new Map([
  ['agent/street_profile_agent', '/images/agent-marketplace-icons/street-profile.svg?v=20260606a'],
  ['agent/profiles_agent', '/images/agent-marketplace-icons/profiles.svg?v=20260605b'],
  ['agent/messaging_agent', '/images/agent-marketplace-icons/messaging.svg?v=20260605b'],
  ['agent/groups_agent', '/images/agent-marketplace-icons/groups.svg?v=20260605b'],
  ['agent/word_on_the_street_agent', '/images/agent-marketplace-icons/word-on-the-street.svg?v=20260605b'],
]);
const MARKETPLACE_AGENT_MODEL_TO_ICON_ID = new Map([
  ['agent/street_profile_agent', 'street-profile'],
  ['agent/profiles_agent', 'profiles'],
  ['agent/messaging_agent', 'messaging'],
  ['agent/groups_agent', 'groups'],
  ['agent/word_on_the_street_agent', 'word-on-the-street'],
  ['agent/project_manager_agent', 'project-manager'],
  ['agent/employment_counsellor', 'employment-counsellor'],
  ['agent/grant_manager', 'grant-manager'],
  ['agent/marketing_manager', 'marketing-manager'],
  ['agent/personal_assistant', 'personal-assistant'],
  ['agent/brain_agent', 'brain'],
  ['agent/evaluation_agent', 'evaluation'],
  ['agent/directory_agent', 'directory'],
  ['agent/accounting_agent', 'accounting'],
  ['agent/cyber_security_agent', 'cyber-security'],
  ['agent/services_rag_agent', 'services-rag'],
  ['agent/dev_ops_agent', 'dev-ops'],
  ['agent/analytics_agent', 'analytics'],
  ['agent/academy_agent', 'academy'],
  ['agent/health_agent', 'health'],
  ['agent/legal_agent', 'legal'],
  ['agent/gallery_agent', 'art-curator'],
  ['agent/art_curator_agent', 'art-curator'],
  ['agent/storage_agent', 'storage'],
  ['agent/documents_agent', 'documents'],
  ['agent/calendar_agent', 'calendar'],
  ['agent/task_agent', 'task'],
  ['agent/resume_cover_letter_agent', 'resume-cover-letter'],
  ['agent/employment_client_agent', 'employment-client'],
  ['agent/job_search_agent', 'job-search'],
  ['agent/grant_writer', 'grant-writer'],
  ['agent/project_plan_agent', 'project-plan'],
  ['agent/budget_agent', 'budget'],
  ['agent/grant_researcher_agent', 'grant-researcher'],
  ['agent/designer_agent', 'designer'],
  ['agent/market_research_agent', 'market-research'],
  ['agent/videography_agent', 'videography'],
  ['agent/local_news_agent', 'local-news'],
  ['agent/national_news_agent', 'national-news'],
  ['agent/international_news_agent', 'international-news'],
  ['agent/contract_agent', 'contract'],
  ['agent/market_analysis_agent', 'market-analysis'],
  ['agent/copy_writer_agent', 'copy-writer'],
  ['agent/city_of_toronto_agent', 'city-of-toronto'],
  ['agent/homeless_hub_agent', 'homeless-hub'],
  ['agent/counseling_agent', 'counseling'],
  ['agent/open_data_agent', 'open-data'],
  ['agent/conversational_agent', 'conversational'],
]);
const MARKETPLACE_AGENT_LABEL_TO_MODEL = new Map([
  ['job search agent', 'agent/job_search_agent'],
  ['art curator agent', 'agent/gallery_agent'],
  ['gallery agent', 'agent/gallery_agent'],
  ['academy agent', 'agent/academy_agent'],
  ['grant manager agent', 'agent/grant_manager'],
  ['street profile agent', 'agent/street_profile_agent'],
  ['profiles agent', 'agent/profiles_agent'],
  ['messaging agent', 'agent/messaging_agent'],
  ['messages agent', 'agent/messaging_agent'],
  ['groups agent', 'agent/groups_agent'],
  ['word on the street agent', 'agent/word_on_the_street_agent'],
]);
const STREETBOT_RENDERED_AGENT_IDS = new Set([
  'agent/job_search_agent',
  'agent/gallery_agent',
  'agent/academy_agent',
  'agent/grant_manager',
]);
const MARKETPLACE_AGENT_CONVERSATION_PROFILES = new Map([
  [
    'agent/job_search_agent',
    {
      label: 'Job Search Agent',
      source: 'Job Board',
      cardLabel: 'job cards',
      purpose: 'help with job search questions, applications, roles, openings, and Job Board results',
    },
  ],
  [
    'agent/gallery_agent',
    {
      label: 'Art Curator Agent',
      source: 'Street Gallery',
      cardLabel: 'artwork cards',
      purpose: 'talk through art, artists, collections, creative direction, and Street Gallery results',
    },
  ],
  [
    'agent/academy_agent',
    {
      label: 'Academy Agent',
      source: 'Academy',
      cardLabel: 'course cards',
      purpose: 'help with learning questions, courses, workshops, and Academy catalog results',
    },
  ],
  [
    'agent/grant_manager',
    {
      label: 'Grant Manager Agent',
      source: 'Grant Writer',
      cardLabel: 'grant opportunity cards',
      purpose: 'help with grant strategy, deadlines, funders, proposals, and grant pipeline results',
    },
  ],
]);
const STREET_PROFILE_AGENT_CONVERSATION_PROFILES = new Map([
  [
    'agent/street_profile_agent',
    {
      label: 'Street Profile Agent',
      source: 'Street Profile',
      cardLabel: 'Street Profile cards',
      purpose: 'coordinate profiles, messages, groups, and Word on the Street actions',
    },
  ],
  [
    'agent/profiles_agent',
    {
      label: 'Profiles Agent',
      source: 'Street Profile',
      cardLabel: 'profile cards',
      purpose: 'help with profile questions, bios, links, posts, and public presence',
    },
  ],
  [
    'agent/messaging_agent',
    {
      label: 'Messaging Agent',
      source: 'Messages',
      cardLabel: 'message views',
      purpose: 'help with message questions, drafting, sorting, and direct-message workflows',
    },
  ],
  [
    'agent/groups_agent',
    {
      label: 'Groups Agent',
      source: 'Groups',
      cardLabel: 'group cards',
      purpose: 'help with group questions, memberships, and collaborative spaces',
    },
  ],
  [
    'agent/word_on_the_street_agent',
    {
      label: 'Word on the Street Agent',
      source: 'Word on the Street',
      cardLabel: 'post cards',
      purpose: 'help with community posts, news, updates, and what is happening on the street',
    },
  ],
]);
const STREETBOT_AGENT_RESULTS_FENCE = 'streetbot-agent-results';
const STREETBOT_AGENT_ICON_VERSION = '20260607a';
const STREETBOT_AGENT_READ_API_BASES = [
  process.env.STREETBOT_AGENT_READ_API_BASE,
  process.env.STREETBOT_READ_API_BASE,
  'https://streetbot-directory.pages.dev/sbapi',
].filter(Boolean);
const STREETBOT_AGENT_LOCAL_API_BASES = [
  process.env.STREETBOT_ACTIONS_NANOBOT_URL,
  process.env.NANOBOT_LOCAL_API_BASE,
  'http://host.docker.internal:18790',
  'http://localhost:18790',
].filter(Boolean);
const STREET_PROFILE_API_BASES = [
  process.env.STREET_PROFILE_AGENT_API_BASE,
  process.env.NANOBOT_STREET_PROFILE_API_BASE,
  'http://localhost:8003',
  'http://host.docker.internal:3180/sbapi',
  'http://localhost:3180/sbapi',
].filter(Boolean);
const STREET_PROFILE_SOCIAL_DB_URLS = [
  process.env.STREET_PROFILE_SOCIAL_DATABASE_URL,
  process.env.SV_SOCIAL_DATABASE_URL,
  process.env.SOCIAL_DATABASE_URL,
  process.env.DATABASE_URL,
].filter(Boolean);
let streetProfilePgPool;
let streetProfilePgPoolKey = '';

const LOCAL_STREET_PROFILE_GROUPS = [
  {
    name: 'Street Voices Creators Circle',
    member_count: 42,
    message_count: 18,
    tags: ['collaboration', 'portfolio', 'community'],
    last_message: 'Fatima is looking for one more photographer for the weekend shoot.',
  },
  {
    name: 'Media Training Cohort',
    member_count: 31,
    message_count: 24,
    tags: ['academy', 'media-training', 'assignments'],
    last_message: 'The interview checklist is pinned in Messages before Thursday lab.',
  },
  {
    name: 'Toronto Photographers',
    member_count: 128,
    message_count: 73,
    tags: ['photography', 'toronto', 'photo-walks'],
    last_message:
      'Saturday golden-hour walk is starting near Kensington Market. Bring a 35mm if you have one.',
  },
  {
    name: 'Black Videographers Network',
    member_count: 96,
    message_count: 61,
    tags: ['videography', 'black-creatives', 'crew-calls'],
    last_message: 'Looking for a second shooter for a community safety reel this weekend.',
  },
  {
    name: 'Grant & Funding Leads',
    member_count: 143,
    message_count: 88,
    tags: ['grants', 'funding', 'deadlines'],
    last_message: 'New arts council deadline added. The budget template is pinned.',
  },
];

const LOCAL_WORD_ON_THE_STREET_POSTS = [
  {
    title: 'REEL: the crowd finishing the hook at last night\'s open mic',
    author_name: 'DJ Solaris',
    category_name: 'Success Stories',
    reply_count: 42,
    like_count: 156,
  },
  {
    title: 'Looking for collaborators for a Street Voices mini-doc',
    author_name: 'Fatima Hassan',
    category_name: 'Creative Collaborations',
    reply_count: 14,
    like_count: 39,
  },
  {
    title: 'First media-training cohort is ready for interview week',
    author_name: 'Suki Park',
    category_name: 'Success Stories',
    reply_count: 9,
    like_count: 28,
  },
  {
    title: 'Mural progress check: youth wall needs two more painters',
    author_name: 'Ghost',
    category_name: 'Creative Collaborations',
    reply_count: 17,
    like_count: 51,
  },
];

const LOCAL_JOB_BOARD_JOBS = [
  {
    id: 'sample-30',
    title: 'Volunteer Personality',
    organization: 'Street Voices',
    category: 'Media & Communications',
    opportunity_type: 'Volunteer',
    work_mode: 'Hybrid',
    location: 'Toronto / Hybrid / Event-based',
    compensation: 'Volunteer (unpaid)',
    description:
      'Represent Street Voices on camera, on mic, at events, and across media projects through interviews, hosting, and community conversations.',
    tags: 'hosting,podcasting,on-camera,public speaking,media,volunteer',
    is_media_gig: true,
    is_creative_opportunity: true,
    posting_date: '2026-05-04',
    employer_verified: true,
  },
  {
    id: 'sample-29',
    title: 'Volunteer Writer',
    organization: 'Street Voices',
    category: 'Media',
    opportunity_type: 'Volunteer',
    work_mode: 'Hybrid',
    location: 'Remote / Hybrid',
    compensation: 'Volunteer (unpaid)',
    description:
      'Write articles, interviews, profiles, blog posts, event recaps, and community stories that amplify Street Voices contributors.',
    tags: 'writing,journalism,storytelling,content,volunteer,media',
    is_creative_opportunity: true,
    is_media_gig: true,
    posting_date: '2026-04-30',
    employer_verified: true,
  },
  {
    id: 'sample-28',
    title: 'Volunteer Videographer',
    organization: 'Street Voices',
    category: 'Media',
    opportunity_type: 'Volunteer',
    work_mode: 'Hybrid',
    location: 'Toronto, ON',
    compensation: 'Volunteer (unpaid)',
    description:
      'Capture events, creator interviews, workshops, documentaries, and short-form video for Street Voices media projects.',
    tags: 'videography,video editing,filmmaking,media,volunteer,event coverage',
    is_creative_opportunity: true,
    is_media_gig: true,
    posting_date: '2026-04-30',
    employer_verified: true,
  },
  {
    id: 'sample-27',
    title: 'Podcast Producer - The Echo',
    organization: 'Street Voices',
    category: 'Media',
    opportunity_type: 'Part-time',
    work_mode: 'Remote',
    location: 'Remote (in-person optional)',
    compensation: '$150 per episode',
    description:
      'Shape topics, episode structure, research, guest notes, and social clip strategy for The Echo podcast.',
    tags: 'podcast,producer,culture,pop culture,urban culture,media,editorial',
    is_media_gig: true,
    is_creative_opportunity: true,
    posting_date: '2026-04-30',
    employer_verified: true,
  },
];

const LOCAL_GALLERY_ARTWORKS = [
  {
    id: '0da05510-75aa-4418-90e1-018b8eb47008',
    artist_name: 'Jamie Rivera',
    title: 'Invisible City',
    description:
      'A series of drawings mapping the hidden spaces and secret paths known only to those who live on the margins.',
    medium: 'drawing',
    style: 'Cartographic',
    year_created: 2023,
    image_url: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800',
    thumbnail_url: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=400',
    is_for_sale: true,
    price: 120,
    currency: 'CAD',
    tags: ['drawing', 'maps', 'hidden', 'urban', 'pen and ink'],
    view_count: 294,
    favorite_count: 13,
  },
  {
    id: 'e2b45249-6317-44fc-a79c-12c825d8329b',
    artist_name: 'The Found Art Collective',
    title: 'Dawn Breaks',
    description: 'A visual poem about hope returning after a long winter.',
    medium: 'poetry',
    style: 'Visual Poetry',
    year_created: 2024,
    image_url: 'https://images.unsplash.com/photo-1482160549825-59d1b23cb208?w=800',
    thumbnail_url: 'https://images.unsplash.com/photo-1482160549825-59d1b23cb208?w=400',
    is_for_sale: true,
    price: 85,
    currency: 'CAD',
    tags: ['poetry', 'watercolor', 'hope', 'new beginnings', 'visual'],
    view_count: 36,
    favorite_count: 4,
  },
  {
    id: 'fa6fbd19-3224-48f1-ac37-a17f12876f5f',
    artist_name: 'Sarah Nightingale',
    title: 'Woven Stories',
    description: 'A textile work built from donated fabric and recorded memories.',
    medium: 'textile',
    style: 'Fiber Art',
    year_created: 2023,
    image_url: 'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=800',
    thumbnail_url: 'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=400',
    is_for_sale: true,
    price: 500,
    currency: 'CAD',
    tags: ['textile', 'fiber', 'donated', 'stories', 'community'],
    view_count: 323,
    favorite_count: 29,
  },
  {
    id: 'bd2e3912-2869-4a21-9583-5cd7a71baaf9',
    artist_name: 'Jamie Rivera',
    title: 'Voices Unheard',
    description: 'Bold acrylic layers capturing stories rarely given public space.',
    medium: 'painting',
    style: 'Abstract Expressionist',
    year_created: 2023,
    image_url: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=800',
    thumbnail_url: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=400',
    is_for_sale: true,
    price: 325,
    currency: 'CAD',
    tags: ['abstract', 'expression', 'bold', 'emotional', 'acrylic'],
    view_count: 245,
    favorite_count: 17,
  },
];

const LOCAL_ACADEMY_COURSES = [
  {
    id: 'journalism',
    title: 'Journalism',
    program: 'Street Voices Media Training',
    level: 'Beginner to Intermediate',
    delivery_mode: 'In person and live stream',
    duration: 'August 2026',
    schedule: 'Aug 5, Aug 12, Aug 19, Aug 26',
    description:
      'Practice reporting, interviewing, and shaping community stories through a focused Street Voices media training block.',
    tags: ['media', 'journalism', 'storytelling', 'interviews'],
  },
  {
    id: 'videography',
    title: 'Videography',
    program: 'Street Voices Media Training',
    level: 'Beginner to Intermediate',
    delivery_mode: 'In person and live stream',
    duration: 'September 2026',
    schedule: 'Sep 2, Sep 9, Sep 16, Sep 23, Sep 30',
    description:
      'Build hands-on camera, framing, lighting, and visual storytelling skills for community media projects.',
    tags: ['media', 'video', 'videography', 'storytelling'],
  },
  {
    id: 'broadcasting',
    title: 'Broadcasting',
    program: 'Street Voices Media Training',
    level: 'Beginner to Intermediate',
    delivery_mode: 'In person and live stream',
    duration: 'October 2026',
    schedule: 'Oct 7, Oct 14, Oct 21, Oct 28',
    description:
      'Learn broadcasting fundamentals, show structure, voice, production rhythm, and audience connection.',
    tags: ['media', 'broadcasting', 'podcasting', 'production'],
  },
  {
    id: 'networking-with-kadiatu',
    title: 'Networking with Kadiatu',
    program: 'Street Voices Media Training',
    level: 'Beginner to Intermediate',
    delivery_mode: 'In person and live stream',
    duration: 'November 2026',
    schedule: 'Nov 4, Nov 11, Nov 18, Nov 25',
    description:
      'Strengthen presentation, relationship-building, and creative industry networking through guided practice.',
    tags: ['media', 'networking', 'presentation', 'career'],
  },
];

const LOCAL_GRANT_OPPORTUNITIES = [
  {
    id: 'yof-scale-2026',
    name: 'Youth Innovations Scale Grant',
    funder: 'Ontario Trillium Foundation',
    funderAbbrev: 'OTF',
    amount: 'Up to $150K/yr x 2-3 years',
    deadline: 'April 15, 2026 (EOI)',
    stage: 'identified',
    url: 'https://otf.ca/our-grants/youth-opportunities-fund/youth-innovations-scale-grant',
    recommendation: 'pursue',
    documents: {
      opportunity: true,
      narrative: false,
      budget: false,
      projectPlan: false,
    },
  },
  {
    id: 'nba-foundation-2026',
    name: 'NBA Foundation Grant',
    funder: 'NBA Foundation',
    funderAbbrev: 'NBA',
    amount: 'Avg $250K (range $25K-$500K)',
    deadline: 'Rolling',
    stage: 'identified',
    url: 'https://nbafoundation.fluxx.io',
    recommendation: 'pursue',
    documents: {
      opportunity: true,
      narrative: false,
      budget: false,
      projectPlan: false,
    },
  },
  {
    id: 'tgrip-extension',
    name: 'TGRIP - Organizational Capacity Development',
    funder: 'Toronto Grants',
    funderAbbrev: 'TGRIP',
    amount: 'Capacity-building stream',
    deadline: 'Pipeline active',
    stage: 'active',
    recommendation: 'pursue',
    documents: {
      opportunity: true,
      narrative: true,
      budget: true,
      projectPlan: true,
    },
  },
];

const GRANT_WORKSPACE_FILES = [
  process.env.STREETBOT_GRANT_WORKSPACE_FILE,
  '/app/uploads/streetbot-actions/grant-workspace.json',
  path.resolve(__dirname, '../uploads/streetbot-actions/grant-workspace.json'),
].filter(Boolean);

const MESSAGE_DRAFT_FENCE = /```street-profile-message-draft\s*([\s\S]*?)```/gi;
const STREETBOT_ACTION_FENCE = /```(?:streetbot-action-request|local-action-request)\s*([\s\S]*?)```/gi;

let ragModulePromise;

function isStreetBotEndpoint(endpoint) {
  return /^Street Bot(?: 0\.1(?: Pro)?| Pro)?$/i.test(String(endpoint || '').trim());
}

function cloneContentPart(part) {
  if (!part || typeof part !== 'object') {
    return part;
  }
  return Array.isArray(part) ? part.slice() : { ...part };
}

function normalizeStreetBotResponseText(value) {
  const text = String(value || '');
  if (!text || text.includes('```streetbot-service-results')) {
    return text;
  }

  const introPattern = /Street Bot(?: 0\.1(?: Pro)?| Pro)?(?: here)?\s*:\s*/gi;
  const matches = [...text.matchAll(introPattern)];
  if (matches.length < 2) {
    return text;
  }

  const lastMatch = matches[matches.length - 1];
  if (!lastMatch || lastMatch.index == null) {
    return text;
  }

  return text.slice(lastMatch.index).trim();
}

function normalizeStreetProfileAgentId(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  const normalized = text
    .replace(/^spec-agent\//, 'agent/')
    .replace(/^spec-/, '')
    .replace(/^agent%2F/i, 'agent/')
    .toLowerCase();
  if (STREET_PROFILE_AGENT_IDS.has(normalized)) {
    return normalized;
  }
  return STREET_PROFILE_AGENT_LABEL_TO_ID.get(normalized) || '';
}

function normalizeMarketplaceAgentModelId(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  let decoded = text.split('?')[0].trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch (_) {
    decoded = text.split('?')[0].trim();
  }
  const normalized = decoded
    .replace(/^spec-agent\//i, 'agent/')
    .replace(/^spec-/i, '')
    .replace(/^agent%2f/i, 'agent/')
    .toLowerCase();
  if (MARKETPLACE_AGENT_MODEL_TO_ICON_ID.has(normalized)) {
    return normalized;
  }
  return MARKETPLACE_AGENT_LABEL_TO_MODEL.get(normalized) || '';
}

function getSelectedStreetProfileAgent(req) {
  const fastPath = req?._streetbotFastPath || {};
  const values = [
    fastPath.selectedSpec,
    fastPath.selectedModel,
    fastPath.selectedLabel,
    req?.body?.spec,
    req?.body?.model,
    req?.body?.modelLabel,
    req?.body?.modelDisplayLabel,
    req?.body?.endpointOption?.spec,
    req?.body?.endpointOption?.modelOptions?.model,
    req?.body?.endpointOption?.model_parameters?.model,
    req?.body?.endpointOption?.model_parameters?.modelLabel,
  ];
  for (const value of values) {
    const agentId = normalizeStreetProfileAgentId(value);
    if (agentId) {
      return agentId;
    }
  }
  return '';
}

function getSelectedStreetProfileAgentIconURL(req) {
  const selectedAgent = getSelectedStreetProfileAgent(req);
  return STREET_PROFILE_AGENT_ICON_URLS.get(selectedAgent) || '';
}

function getSelectedMarketplaceAgent(req) {
  const fastPath = req?._streetbotFastPath || {};
  const values = [
    fastPath.selectedSpec,
    fastPath.selectedModel,
    fastPath.selectedLabel,
    req?.query?.spec,
    req?.query?.agentModel,
    req?.body?.spec,
    req?.body?.model,
    req?.body?.modelLabel,
    req?.body?.modelDisplayLabel,
    req?.body?.endpointOption?.spec,
    req?.body?.endpointOption?.modelOptions?.model,
    req?.body?.endpointOption?.model_parameters?.model,
    req?.body?.endpointOption?.model_parameters?.modelLabel,
  ];
  for (const value of values) {
    const agentId = normalizeMarketplaceAgentModelId(value);
    if (agentId) {
      return agentId;
    }
  }
  return '';
}

function getSelectedMarketplaceAgentIconURL(req) {
  const selectedAgent = getSelectedMarketplaceAgent(req);
  const iconId = MARKETPLACE_AGENT_MODEL_TO_ICON_ID.get(selectedAgent);
  return iconId ? `/images/agent-marketplace-icons/${iconId}.svg?v=${STREETBOT_AGENT_ICON_VERSION}` : '';
}

function getSelectedConversationAgentProfile(req) {
  const selectedMarketplaceAgent = getSelectedMarketplaceAgent(req);
  if (selectedMarketplaceAgent) {
    const marketplaceProfile =
      MARKETPLACE_AGENT_CONVERSATION_PROFILES.get(selectedMarketplaceAgent) ||
      STREET_PROFILE_AGENT_CONVERSATION_PROFILES.get(selectedMarketplaceAgent);
    if (marketplaceProfile) {
      return {
        id: selectedMarketplaceAgent,
        ...marketplaceProfile,
      };
    }
  }

  const selectedStreetProfileAgent = getSelectedStreetProfileAgent(req);
  const streetProfile = STREET_PROFILE_AGENT_CONVERSATION_PROFILES.get(selectedStreetProfileAgent);
  return streetProfile
    ? {
        id: selectedStreetProfileAgent,
        ...streetProfile,
      }
    : null;
}

async function fetchStreetProfileJson(pathname) {
  for (const base of STREET_PROFILE_API_BASES) {
    const url = `${String(base).replace(/\/$/, '')}${pathname}`;
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
      });
      const contentType = String(response.headers.get('content-type') || '');
      if (!response.ok || !contentType.includes('application/json')) {
        continue;
      }
      return await response.json();
    } catch (error) {
      logger.debug('[street-profile-agent] local API fetch failed', {
        url,
        error: error?.message || String(error || ''),
      });
    }
  }
  return null;
}

function getStreetProfileDockerPgUrls() {
  if (!PgPool) {
    return [];
  }
  try {
    const output = childProcess.execFileSync(
      'docker',
      ['inspect', 'nanobot-social-postgres', '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1200 },
    );
    return output
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((host) => `postgresql://social:social_password@${host}:5432/social`);
  } catch (error) {
    logger.debug('[street-profile-agent] local social postgres inspect failed', {
      error: error?.message || String(error || ''),
    });
    return [];
  }
}

function getStreetProfilePgCandidates() {
  const urls = [
    ...STREET_PROFILE_SOCIAL_DB_URLS,
    'postgresql://social:social_password@localhost:5432/social',
    'postgresql://social:social_password@nanobot-social-postgres:5432/social',
    ...getStreetProfileDockerPgUrls(),
  ];
  return [...new Set(urls.filter(Boolean))];
}

async function withStreetProfilePgClient(work) {
  if (!PgPool) {
    return null;
  }

  const candidates = getStreetProfilePgCandidates();
  if (streetProfilePgPool && streetProfilePgPoolKey) {
    candidates.unshift(streetProfilePgPoolKey);
  }

  for (const connectionString of [...new Set(candidates)]) {
    let pool = streetProfilePgPoolKey === connectionString ? streetProfilePgPool : null;
    try {
      if (!pool) {
        pool = new PgPool({
          connectionString,
          max: 1,
          connectionTimeoutMillis: 1500,
          idleTimeoutMillis: 10_000,
          query_timeout: 5000,
        });
      }
      const client = await pool.connect();
      try {
        const result = await work(client);
        streetProfilePgPool = pool;
        streetProfilePgPoolKey = connectionString;
        return result;
      } finally {
        client.release();
      }
    } catch (error) {
      if (pool && pool !== streetProfilePgPool) {
        await pool.end().catch(() => {});
      }
      logger.debug('[street-profile-agent] local social postgres query failed', {
        host: connectionString.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@'),
        error: error?.message || String(error || ''),
      });
    }
  }

  return null;
}

function formatSocialProfileList(rows) {
  return rows
    .slice(0, 5)
    .map((profile) => {
      const username = profile.username ? `@${profile.username}` : '';
      return `- ${[profile.display_name, username, profile.location].filter(Boolean).join(' | ')}`;
    })
    .join('\n');
}

function formatDbGroupList(rows) {
  return rows
    .slice(0, 8)
    .map(
      (group) =>
        `- ${group.name || group.slug || group.id}: ${Number(group.member_count || 0).toLocaleString()} members, ${Number(group.message_count || 0).toLocaleString()} messages, ${group.type || 'channel'}`,
    )
    .join('\n');
}

function formatDbMessageList(rows) {
  return rows
    .slice(0, 8)
    .map((message) => {
      const channel = message.channel_name || message.channel_slug || 'channel';
      const author = message.display_name || message.username || 'Unknown';
      const content = String(message.content || '').replace(/\s+/g, ' ').trim();
      return `- ${channel}: ${author} - ${content.slice(0, 180)}`;
    })
    .join('\n');
}

function formatDbPostList(rows) {
  return rows
    .slice(0, 8)
    .map((post) => {
      const author = post.display_name || post.username || 'Unknown';
      const content = String(post.content || '').replace(/\s+/g, ' ').trim();
      return `- ${author}: ${content.slice(0, 180)} (${Number(post.like_count || 0).toLocaleString()} likes, ${Number(post.comment_count || 0).toLocaleString()} comments)`;
    })
    .join('\n');
}

function cleanStreetProfileItem(item) {
  if (!item || typeof item !== 'object') {
    return {};
  }
  const next = {};
  for (const [key, value] of Object.entries(item)) {
    if (value == null) {
      continue;
    }
    if (value instanceof Date) {
      next[key] = value.toISOString();
      continue;
    }
    if (typeof value === 'bigint') {
      next[key] = Number(value);
      continue;
    }
    next[key] = value;
  }
  return next;
}

function buildStreetProfileCardsPayload(kind, title, total, items, extra = {}) {
  return {
    kind,
    title,
    total: Number(total || 0),
    items: Array.isArray(items) ? items.map(cleanStreetProfileItem).slice(0, 8) : [],
    ...extra,
  };
}

function withStreetProfileCards(intro, payload) {
  return `${String(intro || '').trim()}\n\n\`\`\`street-profile-results\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
}

function withStreetBotAgentCards(intro, payload) {
  return `${String(intro || '').trim()}\n\n\`\`\`${STREETBOT_AGENT_RESULTS_FENCE}\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
}

async function fetchStreetBotReadJson(pathname) {
  const pathSuffix = pathname.startsWith('/') ? pathname : `/${pathname}`;
  for (const base of STREETBOT_AGENT_READ_API_BASES) {
    const url = `${String(base).replace(/\/$/, '')}${pathSuffix}`;
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4500),
      });
      const contentType = String(response.headers.get('content-type') || '');
      if (!response.ok || !contentType.includes('application/json')) {
        continue;
      }
      return await response.json();
    } catch (error) {
      logger.debug('[streetbot-agent-results] read API fetch failed', {
        url,
        error: error?.message || String(error || ''),
      });
    }
  }
  return null;
}

async function fetchStreetBotLocalJson(pathname) {
  const pathSuffix = pathname.startsWith('/') ? pathname : `/${pathname}`;
  for (const base of STREETBOT_AGENT_LOCAL_API_BASES) {
    const url = `${String(base).replace(/\/$/, '')}${pathSuffix}`;
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4500),
      });
      const contentType = String(response.headers.get('content-type') || '');
      if (!response.ok || !contentType.includes('application/json')) {
        continue;
      }
      return await response.json();
    } catch (error) {
      logger.debug('[streetbot-agent-actions] local API fetch failed', {
        url,
        error: error?.message || String(error || ''),
      });
    }
  }
  return null;
}

const AGENT_SEARCH_STOPWORDS = new Set([
  'a',
  'about',
  'actual',
  'agent',
  'agents',
  'all',
  'and',
  'any',
  'available',
  'board',
  'cards',
  'course',
  'courses',
  'do',
  'find',
  'for',
  'from',
  'gallery',
  'get',
  'give',
  'grant',
  'grants',
  'i',
  'in',
  'job',
  'jobs',
  'list',
  'me',
  'my',
  'need',
  'of',
  'on',
  'opportunities',
  'opportunity',
  'please',
  'return',
  'search',
  'show',
  'street',
  'tell',
  'the',
  'to',
  'ui',
  'what',
  'with',
  'work',
  'your',
]);

function extractAgentSearchTerms(userText) {
  return String(userText || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !AGENT_SEARCH_STOPWORDS.has(term));
}

function stringifyForAgentSearch(item, fields) {
  return fields
    .map((field) => {
      const value = item?.[field];
      if (Array.isArray(value)) {
        return value.join(' ');
      }
      if (value && typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value || '');
    })
    .join(' ')
    .toLowerCase();
}

function pickAgentItemsForQuery(items, userText, fields) {
  const list = Array.isArray(items) ? items : [];
  const terms = extractAgentSearchTerms(userText);
  if (!terms.length) {
    return list;
  }
  const phrase = String(userText || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !AGENT_SEARCH_STOPWORDS.has(term))
    .join(' ');
  const scored = list.map((item, index) => {
    const haystack = stringifyForAgentSearch(item, fields);
    const titleHaystack = stringifyForAgentSearch(item, [
      'title',
      'name',
      'organization',
      'funder',
      'artist_name',
      'category',
    ]);
    const score = terms.reduce((sum, term) => {
      if (!haystack.includes(term)) {
        return sum;
      }
      const titleWeight = titleHaystack.includes(term) ? 8 : 0;
      return sum + 1 + titleWeight;
    }, 0) + (phrase && titleHaystack.includes(phrase) ? 32 : 0);
    return { item, index, score };
  });
  const matches = scored
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.item);
  return matches.length ? matches : list;
}

function splitAgentTags(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeJobForAgent(item) {
  const job = cleanStreetProfileItem(item);
  const id = String(job.id || '').trim();
  return {
    id,
    title: job.title || 'Job opportunity',
    organization: job.organization || job.company || 'Street Voices',
    category: job.category || 'Job Board',
    opportunity_type: job.opportunity_type || job.type || '',
    work_mode: job.work_mode || '',
    location: job.location || '',
    compensation: job.compensation || job.salary_range || '',
    description: job.description || job.summary || '',
    tags: splitAgentTags(job.tags).slice(0, 5),
    posting_date: job.posting_date || job.created_at || '',
    deadline: job.deadline || '',
    logo_url: job.logo_url || '',
    is_featured: Boolean(job.is_featured),
    employer_verified: Boolean(job.employer_verified),
    view_count: Number(job.view_count || 0),
    application_count: Number(job.application_count || 0),
    href: id ? `/jobs/${encodeURIComponent(id)}` : '/jobs',
  };
}

function normalizeArtworkForAgent(item) {
  const art = cleanStreetProfileItem(item);
  const id = String(art.id || '').trim();
  return {
    id,
    title: art.title || 'Street Gallery artwork',
    artist_name: art.artist_name || art.artist || 'Street Voices artist',
    description: art.description || '',
    medium: art.medium || '',
    style: art.style || '',
    year_created: art.year_created || '',
    image_url: art.image_url || art.thumbnail_url || '',
    thumbnail_url: art.thumbnail_url || art.image_url || '',
    is_for_sale: Boolean(art.is_for_sale),
    price: art.price ?? '',
    currency: art.currency || 'CAD',
    tags: splitAgentTags(art.tags).slice(0, 5),
    view_count: Number(art.view_count || 0),
    favorite_count: Number(art.favorite_count || 0),
    href: id ? `/gallery/artwork/${encodeURIComponent(id)}` : '/gallery',
  };
}

function normalizeAcademyCourseForAgent(item) {
  const course = cleanStreetProfileItem(item);
  const id = String(course.id || course.slug || '').trim();
  return {
    id,
    title: course.title || 'Academy course',
    program: course.program || course.learning_path || 'Street Voices Academy',
    level: course.level || course.difficulty || '',
    delivery_mode: course.delivery_mode || course.deliveryMode || '',
    duration: course.duration || course.durationLabel || course.hours || '',
    schedule: course.schedule || '',
    description: course.description || course.summary || '',
    tags: splitAgentTags(course.tags || course.preferredCategories).slice(0, 5),
    image_url: course.image_url || course.cover_image || '',
    href: id ? `/academy/courses/${encodeURIComponent(id)}` : '/academy/courses',
  };
}

function normalizeGrantForAgent(item) {
  const grant = cleanStreetProfileItem(item);
  const id = String(grant.id || '').trim();
  return {
    id,
    title: grant.name || grant.title || 'Grant opportunity',
    funder: grant.funder || 'Grant funder',
    funderAbbrev: grant.funderAbbrev || grant.funder_abbrev || '',
    amount: grant.amount || '',
    deadline: grant.deadline || '',
    stage: grant.stage || '',
    recommendation: grant.recommendation || grant.assessment?.recommendation || '',
    documents: grant.documents || {},
    description: grant.description || grant.summary || '',
    url: grant.url || '',
    href: '/grantwriter',
  };
}

function buildStreetBotAgentPayload(kind, title, source, total, items) {
  return {
    kind,
    title,
    source,
    total: Number(total || 0),
    items: Array.isArray(items) ? items.slice(0, 8) : [],
  };
}

async function loadJobAgentItems(userText) {
  const remote = await fetchStreetBotReadJson('/jobs');
  const allJobs = Array.isArray(remote) && remote.length ? remote : LOCAL_JOB_BOARD_JOBS;
  return pickAgentItemsForQuery(allJobs, userText, [
    'title',
    'organization',
    'category',
    'opportunity_type',
    'work_mode',
    'location',
    'compensation',
    'description',
    'tags',
  ]).map(normalizeJobForAgent);
}

async function loadLocalJobActionItems(userText) {
  const local = await fetchStreetBotLocalJson('/jobs');
  const localJobs = Array.isArray(local)
    ? local
    : Array.isArray(local?.jobs)
      ? local.jobs
      : Array.isArray(local?.items)
        ? local.items
        : [];
  const allJobs = localJobs.length ? localJobs : LOCAL_JOB_BOARD_JOBS;
  return pickAgentItemsForQuery(allJobs, userText, [
    'id',
    'title',
    'organization',
    'category',
    'opportunity_type',
    'work_mode',
    'location',
    'compensation',
    'description',
    'tags',
  ]).map(normalizeJobForAgent);
}

async function loadGalleryAgentItems(userText) {
  const remote = await fetchStreetBotReadJson('/gallery/artworks');
  const allArtworks = Array.isArray(remote) && remote.length ? remote : LOCAL_GALLERY_ARTWORKS;
  return pickAgentItemsForQuery(allArtworks, userText, [
    'title',
    'artist_name',
    'description',
    'medium',
    'style',
    'tags',
  ]).map(normalizeArtworkForAgent);
}

async function loadLocalGalleryActionItems(userText) {
  const local = await fetchStreetBotLocalJson('/gallery/artworks');
  const localArtworks = Array.isArray(local)
    ? local
    : Array.isArray(local?.artworks)
      ? local.artworks
      : Array.isArray(local?.items)
        ? local.items
        : [];
  const allArtworks = localArtworks.length ? localArtworks : LOCAL_GALLERY_ARTWORKS;
  return pickAgentItemsForQuery(allArtworks, userText, [
    'id',
    'title',
    'artist_name',
    'description',
    'medium',
    'style',
    'tags',
  ]).map(normalizeArtworkForAgent);
}

async function loadAcademyAgentItems(userText) {
  const local = await fetchStreetBotLocalJson('/api/academy/courses?limit=100');
  const localCourses = Array.isArray(local)
    ? local
    : Array.isArray(local?.courses)
      ? local.courses
      : Array.isArray(local?.items)
        ? local.items
        : [];
  const allCourses = localCourses.length ? localCourses : LOCAL_ACADEMY_COURSES;
  return pickAgentItemsForQuery(allCourses, userText, [
    'id',
    'title',
    'category',
    'program',
    'level',
    'delivery_mode',
    'duration',
    'schedule',
    'description',
    'tags',
  ]).map(normalizeAcademyCourseForAgent);
}

async function loadLocalAcademyActionItems(userText) {
  return loadAcademyAgentItems(userText);
}

async function loadGrantAgentItems(userText) {
  const workspaceGrants = loadGrantWorkspaceItems();
  const seen = new Set(workspaceGrants.map((item) => String(item.id || '')));
  const allGrants = [
    ...workspaceGrants,
    ...LOCAL_GRANT_OPPORTUNITIES.filter((item) => !seen.has(String(item.id || ''))),
  ];
  return pickAgentItemsForQuery(allGrants, userText, [
    'name',
    'title',
    'funder',
    'funderAbbrev',
    'amount',
    'deadline',
    'stage',
    'recommendation',
  ]).map(normalizeGrantForAgent);
}

function loadGrantWorkspaceItems() {
  for (const filePath of GRANT_WORKSPACE_FILES) {
    try {
      if (!fs.existsSync(filePath)) {
        continue;
      }
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return Array.isArray(parsed?.grants) ? parsed.grants : [];
    } catch (error) {
      logger.debug('[streetbot-agent-results] grant workspace read failed', {
        filePath,
        error: error?.message || String(error || ''),
      });
    }
  }
  return [];
}

const MARKETPLACE_AGENT_RESULT_KEYWORDS = new Map([
  [
    'agent/job_search_agent',
    [
      'job',
      'jobs',
      'role',
      'roles',
      'position',
      'positions',
      'opening',
      'openings',
      'career',
      'careers',
      'hiring',
      'work',
      'employment',
      'job board',
    ],
  ],
  [
    'agent/gallery_agent',
    [
      'art',
      'arts',
      'artwork',
      'artworks',
      'artist',
      'artists',
      'gallery',
      'piece',
      'pieces',
      'collection',
      'collections',
      'exhibit',
      'exhibition',
      'creative work',
    ],
  ],
  [
    'agent/academy_agent',
    [
      'course',
      'courses',
      'class',
      'classes',
      'academy',
      'training',
      'workshop',
      'workshops',
      'lesson',
      'lessons',
      'learn',
      'learning',
      'program',
      'programs',
    ],
  ],
  [
    'agent/grant_manager',
    [
      'grant',
      'grants',
      'funding',
      'funder',
      'funders',
      'opportunity',
      'opportunities',
      'deadline',
      'deadlines',
      'proposal',
      'proposals',
      'pipeline',
    ],
  ],
]);
const MARKETPLACE_AGENT_RESULT_ACTION_PATTERN =
  /\b(show|return|list|find|search|look\s+up|pull|fetch|surface|display|render|browse|recommend|match|matches|open|get|give\s+me|bring\s+up|need|want|looking\s+for|seeking|available|apply|application)\b/i;
const MARKETPLACE_AGENT_GENERAL_CHAT_PATTERN =
  /\b(hello|hi|hey|how\s+are\s+you|what\s+are\s+you\s+good\s+for|what\s+can\s+you\s+do|what\s+can\s+you\s+help\s+(?:me\s+)?with|how\s+can\s+you\s+help|who\s+are\s+you|introduce\s+yourself|tell\s+me\s+about\s+yourself|what\s+do\s+you\s+do)\b/i;
const AGENT_RESULT_COUNT_PATTERN =
  /\b(how\s+many|count|counts?|total|number\s+of|do\s+we\s+have|available|active)\b/i;
const STREET_PROFILE_AGENT_RESULT_KEYWORDS = new Map([
  [
    'agent/street_profile_agent',
    [
      'street profile',
      'profile',
      'profiles',
      'people',
      'directory',
      'creator',
      'creators',
      'group',
      'groups',
      'member',
      'members',
      'message',
      'messages',
      'dm',
      'dms',
      'inbox',
      'word on the street',
      'post',
      'posts',
      'feed',
      'news',
      'announcement',
      'announcements',
    ],
  ],
  [
    'agent/profiles_agent',
    ['profile', 'profiles', 'people', 'directory', 'creator', 'creators', 'bio', 'bios', 'links'],
  ],
  [
    'agent/messaging_agent',
    ['message', 'messages', 'dm', 'dms', 'inbox', 'direct message', 'direct messages', 'chat', 'chats'],
  ],
  [
    'agent/groups_agent',
    ['group', 'groups', 'member', 'members', 'membership', 'channel', 'channels', 'community'],
  ],
  [
    'agent/word_on_the_street_agent',
    ['word on the street', 'post', 'posts', 'feed', 'news', 'announcement', 'announcements', 'update', 'updates'],
  ],
]);

function includesMarketplaceAgentDomainKeyword(selectedAgent, userText) {
  const keywords = MARKETPLACE_AGENT_RESULT_KEYWORDS.get(selectedAgent) || [];
  const text = normalizeText(userText);
  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeText(keyword);
    return new RegExp(`\\b${escapeRegExp(normalizedKeyword)}\\b`, 'i').test(text);
  });
}

function looksLikeMarketplaceAgentResultsRequest(selectedAgent, userText) {
  if (!STREETBOT_RENDERED_AGENT_IDS.has(selectedAgent)) {
    return false;
  }
  const text = String(userText || '').trim();
  const normalized = normalizeText(text);
  if (!normalized || MARKETPLACE_AGENT_GENERAL_CHAT_PATTERN.test(normalized)) {
    return false;
  }

  const hasDomainKeyword = includesMarketplaceAgentDomainKeyword(selectedAgent, normalized);
  if (!hasDomainKeyword) {
    return false;
  }

  if (MARKETPLACE_AGENT_RESULT_ACTION_PATTERN.test(normalized)) {
    return true;
  }
  if (AGENT_RESULT_COUNT_PATTERN.test(normalized)) {
    return true;
  }
  if (/\b(cards?|results?|ui|actual|real)\b/i.test(normalized)) {
    return true;
  }
  if (countTokens(normalized) <= 5 && !MARKETPLACE_AGENT_GENERAL_CHAT_PATTERN.test(normalized)) {
    return true;
  }
  return false;
}

function includesStreetProfileAgentDomainKeyword(selectedAgent, userText) {
  const keywords = STREET_PROFILE_AGENT_RESULT_KEYWORDS.get(selectedAgent) || [];
  const text = normalizeText(userText);
  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeText(keyword);
    return new RegExp(`\\b${escapeRegExp(normalizedKeyword)}\\b`, 'i').test(text);
  });
}

function looksLikeStreetProfileAgentResultsRequest(selectedAgent, userText) {
  if (!STREET_PROFILE_AGENT_IDS.has(selectedAgent)) {
    return false;
  }
  const text = String(userText || '').trim();
  const normalized = normalizeText(text);
  if (!normalized || MARKETPLACE_AGENT_GENERAL_CHAT_PATTERN.test(normalized)) {
    return false;
  }

  if (
    selectedAgent === 'agent/street_profile_agent' &&
    /\b(overview|all|everything|overall|areas?|connected|summary|summari[sz]e)\b/i.test(normalized)
  ) {
    return true;
  }

  const hasDomainKeyword = includesStreetProfileAgentDomainKeyword(selectedAgent, normalized);
  if (!hasDomainKeyword) {
    return false;
  }

  if (MARKETPLACE_AGENT_RESULT_ACTION_PATTERN.test(normalized)) {
    return true;
  }
  if (AGENT_RESULT_COUNT_PATTERN.test(normalized)) {
    return true;
  }
  if (/\b(cards?|results?|ui|actual|real|data|records?)\b/i.test(normalized)) {
    return true;
  }
  if (countTokens(normalized) <= 5) {
    return true;
  }
  return false;
}

async function buildStreetBotAgentResultsResponse(req, userText, runProgressPhase) {
  const selectedAgent = getSelectedMarketplaceAgent(req);
  if (!looksLikeMarketplaceAgentResultsRequest(selectedAgent, userText)) {
    return null;
  }

  const run = (phase, work) =>
    typeof runProgressPhase === 'function' ? runProgressPhase(phase, work, { selectedAgent }) : work();

  let kind = '';
  let title = '';
  let source = {};
  let items = [];
  let intro = '';

  if (selectedAgent === 'agent/job_search_agent') {
    items = await run('checking_job_board', () => loadJobAgentItems(userText));
    kind = 'jobs';
    title = 'Job Board matches';
    source = { app: 'Job Board', href: '/jobs' };
    intro = `Job Search Agent checked the local Job Board data and found ${items.length} matching job cards.`;
  } else if (selectedAgent === 'agent/gallery_agent') {
    items = await run('checking_street_gallery', () => loadGalleryAgentItems(userText));
    kind = 'artworks';
    title = 'Street Gallery artwork';
    source = { app: 'Street Gallery', href: '/gallery' };
    intro = `Art Curator Agent checked Street Gallery and found ${items.length} artwork cards.`;
  } else if (selectedAgent === 'agent/academy_agent') {
    items = await run('checking_academy', () => loadAcademyAgentItems(userText));
    kind = 'academy_courses';
    title = 'Academy courses';
    source = { app: 'Academy', href: '/academy/courses' };
    intro = `Academy Agent checked the Academy catalog and found ${items.length} course cards.`;
  } else if (selectedAgent === 'agent/grant_manager') {
    items = await run('checking_grant_pipeline', () => loadGrantAgentItems(userText));
    kind = 'grants';
    title = 'Grant pipeline opportunities';
    source = { app: 'Grant Writer', href: '/grantwriter' };
    intro = `Grant Manager Agent checked the Grant Writer pipeline and found ${items.length} grant cards.`;
  }

  const payload = buildStreetBotAgentPayload(kind, title, source, items.length, items);
  return {
    responseText: withStreetBotAgentCards(intro, payload),
    searchResult: {
      ok: true,
      browse: true,
      selectedAgent,
      returned_count: items.length,
      items,
      has_more: false,
      kind,
    },
  };
}

function normalizeStreetProfileUsername(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
}

async function uniqueStreetProfileUsername(client, baseUsername) {
  const base = normalizeStreetProfileUsername(baseUsername) || 'street-profile-user';
  let candidate = base;
  for (let index = 0; index < 50; index += 1) {
    const { rows } = await client.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [
      candidate,
    ]);
    if (!rows.length) {
      return candidate;
    }
    candidate = `${base}-${index + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function getLibreChatIdentityForStreetProfile(req) {
  const user = req?.user || {};
  const id = String(user.id || user._id || '').trim();
  const email = String(user.email || '').trim();
  const name = String(user.name || user.username || email || 'Street Profile User').trim();
  return {
    casdoorId: String(user.openidId || user.idOnTheSource || id || email).trim(),
    username: String(user.username || email || name).trim(),
    displayName: name,
    email: email || `${(id || name).replace(/[^a-zA-Z0-9._-]/g, '_')}@streetvoices.local`,
    avatarUrl: String(user.avatar || user.image || '').trim() || null,
  };
}

async function ensureLocalSocialUserForLibreChat(req) {
  const identity = getLibreChatIdentityForStreetProfile(req);
  if (!identity.casdoorId) {
    return null;
  }

  return withStreetProfilePgClient(async (client) => {
    const existing = await client.query(
      `SELECT id, username, display_name, email, avatar_url
       FROM users
       WHERE casdoor_id = $1 OR email = $2
       LIMIT 1`,
      [identity.casdoorId, identity.email],
    );
    if (existing.rows[0]) {
      const updated = await client.query(
        `UPDATE users
         SET casdoor_id = $2,
             display_name = $3,
             email = $4,
             avatar_url = $5,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, username, display_name, email, avatar_url`,
        [
          existing.rows[0].id,
          identity.casdoorId,
          identity.displayName,
          identity.email,
          identity.avatarUrl,
        ],
      );
      return updated.rows[0] || existing.rows[0];
    }

    const username = await uniqueStreetProfileUsername(
      client,
      identity.username || identity.email || identity.displayName,
    );
    const inserted = await client.query(
      `INSERT INTO users (id, casdoor_id, username, display_name, email, avatar_url, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, username, display_name, email, avatar_url`,
      [identity.casdoorId, username, identity.displayName, identity.email, identity.avatarUrl],
    );
    return inserted.rows[0] || null;
  });
}

function stripRecipientNoise(value = '') {
  return String(value || '')
    .trim()
    .replace(/^@/, '')
    .replace(/^to\s+/i, '')
    .replace(/\s+(?:a message|message|dm)$/i, '')
    .trim();
}

function extractStreetProfileMessageRequest(value = '') {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  const patterns = [
    /\b(?:message|dm)\s+(.+?)\s+(?:saying|that says|and say|to say|with)\s+["“]?([\s\S]+?)["”]?\s*$/i,
    /\b(?:send|write)\s+(?:a\s+)?(?:message|dm)\s+to\s+(.+?)\s+(?:saying|that says|and say|to say|with|:)\s+["“]?([\s\S]+?)["”]?\s*$/i,
    /\b(?:send|write)\s+(.+?)\s+(?:a\s+)?(?:message|dm)\s+(?:saying|that says|and say|to say|with|:)\s+["“]?([\s\S]+?)["”]?\s*$/i,
    /\b(?:tell)\s+(.+?)\s+["“]([\s\S]+?)["”]\s*$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }
    const recipientQuery = stripRecipientNoise(match[1]);
    const content = String(match[2] || '')
      .trim()
      .replace(/^["“]+|["”]+$/g, '')
      .trim();
    if (recipientQuery && content) {
      return { recipientQuery, content };
    }
  }

  return null;
}

function isStreetProfileMessageConfirmation(value = '') {
  const text = String(value || '')
    .trim()
    .replace(/[.!]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  if (!text || text.length > 40) {
    return false;
  }
  return /^(yes|yep|yeah|ok|okay|send it|send that|confirm|confirmed|go ahead|do it|please send it)$/.test(
    text,
  );
}

async function findLocalSocialRecipient(query, senderId = '') {
  const normalized = String(query || '').trim();
  if (!normalized) {
    return null;
  }
  const handle = normalized.replace(/^@/, '').toLowerCase();
  return withStreetProfilePgClient(async (client) => {
    const { rows } = await client.query(
      `SELECT id, username, display_name, email, avatar_url, is_agent
       FROM users
       WHERE id <> COALESCE($2, '')
         AND (
           lower(username) = lower($1)
           OR lower(display_name) = lower($1)
           OR lower(email) = lower($1)
           OR username ILIKE $3
           OR display_name ILIKE $3
           OR email ILIKE $3
         )
       ORDER BY
         CASE
           WHEN lower(username) = lower($1) THEN 0
           WHEN lower(display_name) = lower($1) THEN 1
           WHEN lower(email) = lower($1) THEN 2
           ELSE 3
         END,
         is_agent ASC,
         display_name ASC
       LIMIT 5`,
      [handle || normalized, senderId, `%${normalized}%`],
    );
    return rows[0] || null;
  });
}

async function findDirectoryProfileForMessage(query) {
  const params = new URLSearchParams({ limit: '3', page: '1', view: 'directory', search: query });
  const data = await fetchStreetProfileJson(`/street-profiles/directory?${params.toString()}`);
  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data?.profiles) ? data.profiles : [];
  return items[0] || null;
}

function buildStreetProfileMessageDraftText(draft) {
  const recipientName = draft.recipient?.display_name || draft.recipient?.username || draft.recipientQuery;
  return [
    `I found ${recipientName} in local Messages. Here is the draft I can send:`,
    '',
    `> ${draft.content}`,
    '',
    'Reply “send it” to send this DM.',
    '',
    '```street-profile-message-draft',
    JSON.stringify(draft, null, 2),
    '```',
  ].join('\n');
}

function extractLatestStreetProfileMessageDraft(messages = []) {
  for (const message of [...messages].reverse()) {
    const text = String(message?.text || '').trim();
    if (!text || !text.includes('```street-profile-message-draft')) {
      continue;
    }
    MESSAGE_DRAFT_FENCE.lastIndex = 0;
    let match;
    let latest = null;
    while ((match = MESSAGE_DRAFT_FENCE.exec(text)) !== null) {
      try {
        latest = JSON.parse(match[1]);
      } catch (_) {
        latest = null;
      }
    }
    if (latest?.recipient?.id && latest?.content && !latest.sent) {
      return latest;
    }
  }
  return null;
}

async function ensureDmChannelAndSendMessage(senderId, recipientId, content, metadata = {}) {
  return withStreetProfilePgClient(async (client) => {
    await client.query('BEGIN');
    try {
      const existing = await client.query(
        `SELECT c.id
         FROM channels c
         WHERE c.type = 'DM'
           AND c.is_archived = false
           AND EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = $1)
           AND EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = $2)
         LIMIT 1`,
        [senderId, recipientId],
      );

      let channelId = existing.rows[0]?.id;
      if (!channelId) {
        const created = await client.query(
          `INSERT INTO channels (id, name, slug, type, created_at, updated_at)
           VALUES (gen_random_uuid()::text, NULL, $1, 'DM', NOW(), NOW())
           RETURNING id`,
          [`dm-${senderId}-${recipientId}`],
        );
        channelId = created.rows[0].id;
        await client.query(
          `INSERT INTO channel_members (id, channel_id, user_id, role, joined_at)
           VALUES
             (gen_random_uuid()::text, $1, $2, 'member', NOW()),
             (gen_random_uuid()::text, $1, $3, 'member', NOW())
           ON CONFLICT (channel_id, user_id) DO NOTHING`,
          [channelId, senderId, recipientId],
        );
      }

      const message = await client.query(
        `INSERT INTO messages (id, channel_id, author_id, content, metadata, created_at, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4::jsonb, NOW(), NOW())
         RETURNING id, channel_id, author_id, content, created_at`,
        [channelId, senderId, content, JSON.stringify(metadata || {})],
      );
      await client.query('UPDATE channels SET updated_at = NOW() WHERE id = $1', [channelId]);
      await client.query('COMMIT');
      return { channelId, message: message.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    }
  });
}

async function buildStreetProfileMessageSendResponse(req, userText) {
  const request = extractStreetProfileMessageRequest(userText);
  if (!request) {
    return null;
  }

  const sender = await ensureLocalSocialUserForLibreChat(req);
  if (!sender?.id) {
    return {
      responseText:
        'I can draft the message, but I could not find or create your local Messages identity yet.',
      searchResult: { ok: false, returned_count: 0, items: [], has_more: false },
    };
  }

  const recipient = await findLocalSocialRecipient(request.recipientQuery, sender.id);
  if (!recipient?.id) {
    const directoryProfile = await findDirectoryProfileForMessage(request.recipientQuery);
    const directoryName = directoryProfile?.display_name || directoryProfile?.username;
    return {
      responseText: directoryName
        ? `${directoryName} exists in the Street Profile directory, but I do not see a local Messages account for them yet, so I cannot deliver a DM to that profile from chat.`
        : `I could not find a local Messages profile matching “${request.recipientQuery}”.`,
      searchResult: { ok: false, returned_count: 0, items: [], has_more: false },
    };
  }

  const draft = {
    kind: 'dm',
    recipientQuery: request.recipientQuery,
    recipient: cleanStreetProfileItem(recipient),
    content: request.content,
    createdAt: new Date().toISOString(),
    sent: false,
  };
  return {
    responseText: buildStreetProfileMessageDraftText(draft),
    searchResult: { ok: true, returned_count: 1, items: [recipient], has_more: false },
  };
}

async function buildStreetProfileMessageConfirmationResponse(req, userText, conversationId) {
  if (!isStreetProfileMessageConfirmation(userText) || !conversationId || conversationId === 'new') {
    return null;
  }

  const history = await getMessages({ conversationId, user: req.user.id }).catch(() => []);
  const draft = extractLatestStreetProfileMessageDraft(history);
  if (!draft) {
    return null;
  }

  const sender = await ensureLocalSocialUserForLibreChat(req);
  if (!sender?.id) {
    return {
      responseText: 'I found the draft, but I could not find your local Messages identity to send it.',
      searchResult: { ok: false, returned_count: 0, items: [], has_more: false },
    };
  }

  const recipientId = String(draft.recipient?.id || '').trim();
  if (!recipientId || recipientId === sender.id) {
    return {
      responseText: 'I found the draft, but the recipient is not valid anymore.',
      searchResult: { ok: false, returned_count: 0, items: [], has_more: false },
    };
  }

  const sent = await ensureDmChannelAndSendMessage(sender.id, recipientId, draft.content, {
    source: 'street_profile_agent',
    draftCreatedAt: draft.createdAt || null,
  });
  const recipientName =
    draft.recipient?.display_name || draft.recipient?.username || draft.recipientQuery || 'that profile';
  return {
    responseText: `Sent to ${recipientName}. You can open it in Messages: /messages?channel=dm-${encodeURIComponent(sent.channelId)}`,
    searchResult: {
      ok: true,
      returned_count: 1,
      items: [{ channel_id: sent.channelId, message_id: sent.message?.id, recipient: draft.recipient }],
      has_more: false,
    },
  };
}

function isStreetBotActionConfirmation(value = '') {
  const text = String(value || '')
    .trim()
    .replace(/[.!]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  if (!text || text.length > 40) {
    return false;
  }
  return /^(yes|yep|yeah|ok|okay|confirm|confirmed|go ahead|do it|run it|execute|send it|post it|save it|please do|please run it)$/.test(
    text,
  );
}

function buildStreetBotActionDraftText(actionResult) {
  const action = actionResult?.action || {};
  return [
    actionResult?.message || `${action.label || 'Action'} is ready for confirmation.`,
    '',
    '```local-action-request',
    JSON.stringify(
      {
        actionId: action.id,
        params: action.params || {},
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    '```',
  ].join('\n');
}

function extractLatestStreetBotActionDraft(messages = []) {
  for (const message of [...messages].reverse()) {
    const text = String(message?.text || '').trim();
    if (!text || !/```(?:streetbot-action-request|local-action-request)/i.test(text)) {
      continue;
    }
    STREETBOT_ACTION_FENCE.lastIndex = 0;
    let match;
    let latest = null;
    while ((match = STREETBOT_ACTION_FENCE.exec(text)) !== null) {
      try {
        latest = JSON.parse(match[1]);
      } catch (_) {
        latest = null;
      }
    }
    if (latest?.actionId && latest?.params) {
      return latest;
    }
  }
  return null;
}

function selectedStreetBotActionAgent(req) {
  return getSelectedMarketplaceAgent(req) || getSelectedStreetProfileAgent(req);
}

function extractActionContent(value = '') {
  const text = String(value || '').trim();
  const match = text.match(
    /\b(?:saying|say|with\s+(?:message|content|body)|with|content|body|message|:)\s+["“]?([\s\S]+?)["”]?\s*$/i,
  );
  return match ? String(match[1] || '').trim().replace(/^["“]+|["”]+$/g, '') : '';
}

function extractQuotedTitle(value = '') {
  const text = String(value || '').trim();
  const quoted = text.match(/["“]([^"”]{2,160})["”]/);
  if (quoted) {
    return quoted[1].trim();
  }
  const titled = text.match(/\b(?:title|titled|called)\s+["“]?([^"”:.]{2,160})/i);
  return titled ? titled[1].trim() : '';
}

function extractMoneyAmount(value = '') {
  const text = String(value || '');
  const match = text.match(/(?:\$|price\s*(?:to|at|as)?\s*)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (!match) {
    return undefined;
  }
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? amount : undefined;
}

function findNumericId(value = '', labels = []) {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pattern = escaped
    ? new RegExp(`\\b(?:${escaped})\\s*#?([a-z0-9._-]+)\\b`, 'gi')
    : /\b#?([a-z0-9._-]+)\b/i;
  const matches = [...String(value || '').matchAll(pattern)]
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean);
  return matches.find((match) => /\d/.test(match)) || matches[0] || '';
}

async function inferJobAction(userText) {
  const normalized = String(userText || '').toLowerCase();
  const shouldUnsave = /\b(unsave|unfavorite|remove\s+favorite|remove\s+saved|unbookmark)\b/.test(
    normalized,
  );
  const shouldSave =
    shouldUnsave || /\b(save|favorite|favourite|bookmark)\b/.test(normalized);
  if (!shouldSave || !/\b(job|role|opportunity|listing)\b/.test(normalized)) {
    return null;
  }
  const items = await loadLocalJobActionItems(userText);
  const job = items[0];
  if (!job?.id) {
    return {
      responseText:
        'Job Search Agent can save jobs, but I need a matching job title or job id first.',
      searchResult: { ok: false, returned_count: 0, items: [], has_more: false },
    };
  }
  return {
    actionId: shouldUnsave ? 'jobs.unfavorite' : 'jobs.favorite',
    params: { job_id: job.id, job: job.title, organization: job.organization },
    label: shouldUnsave ? `Unsave ${job.title}` : `Save ${job.title}`,
  };
}

async function inferGalleryAction(userText) {
  const normalized = String(userText || '').toLowerCase();
  const wantsComment = /\b(comment|reply)\b/.test(normalized);
  const wantsDelete = /\b(delete|remove)\b/.test(normalized) && /\b(art|artwork|piece)\b/.test(normalized);
  const wantsUnfavorite = /\b(unfavorite|unfavourite|unsave|remove\s+favorite)\b/.test(normalized);
  const wantsFavorite = wantsUnfavorite || /\b(favorite|favourite|save|bookmark)\b/.test(normalized);
  const wantsCreate = /\b(create|post|add|upload)\b/.test(normalized) && /\b(art|artwork|piece)\b/.test(normalized);
  const wantsUpdate =
    /\b(set|update|change|mark|list|unlist)\b/.test(normalized) &&
    /\b(price|sale|sold|available)\b/.test(normalized);

  if (wantsCreate) {
    const title = extractQuotedTitle(userText);
    if (!title) {
      return {
        responseText:
          'Art Curator Agent can create an artwork draft, but I need a title first.',
        searchResult: { ok: false, returned_count: 0, items: [], has_more: false },
      };
    }
    return {
      actionId: 'gallery.create_artwork',
      params: {
        title,
        description: extractActionContent(userText),
      },
      label: `Create artwork ${title}`,
    };
  }

  if (!wantsFavorite && !wantsComment && !wantsDelete && !wantsUpdate) {
    return null;
  }

  const items = await loadLocalGalleryActionItems(userText);
  const artwork = items[0];
  if (!artwork?.id) {
    return {
      responseText:
        'Art Curator Agent can act on artwork, but I need a matching artwork title or id first.',
      searchResult: { ok: false, returned_count: 0, items: [], has_more: false },
    };
  }

  if (wantsUpdate) {
    const params = {
      artwork_id: artwork.id,
      artwork: artwork.title,
      artist: artwork.artist_name,
    };
    const price = extractMoneyAmount(userText);
    if (price !== undefined) {
      params.price = price;
      params.currency = 'CAD';
    }
    if (/\b(not for sale|no longer for sale|remove from sale|off sale|unlist)\b/.test(normalized)) {
      params.is_for_sale = false;
    } else if (/\b(for sale|on sale|sell|selling|available|list)\b/.test(normalized)) {
      params.is_for_sale = true;
    }
    if (/\b(unsold|not sold)\b/.test(normalized)) {
      params.is_sold = false;
    } else if (/\bsold\b/.test(normalized)) {
      params.is_sold = true;
    }
    const hasUpdateField = ['price', 'currency', 'is_for_sale', 'is_sold'].some((key) =>
      Object.prototype.hasOwnProperty.call(params, key),
    );
    if (!hasUpdateField) {
      return {
        responseText: `I found ${artwork.title}, but I need a price, sale status, or sold status before I can update it.`,
        searchResult: { ok: false, returned_count: 0, items: [artwork], has_more: false },
      };
    }
    return {
      actionId: 'gallery.update_artwork',
      params,
      label: `Update ${artwork.title}`,
    };
  }

  if (wantsComment) {
    const body = extractActionContent(userText);
    if (!body) {
      return {
        responseText: `I found ${artwork.title}, but I need the comment text before I can draft that action.`,
        searchResult: { ok: false, returned_count: 0, items: [artwork], has_more: false },
      };
    }
    return {
      actionId: 'gallery.comment',
      params: { artwork_id: artwork.id, artwork: artwork.title, artist: artwork.artist_name, body },
      label: `Comment on ${artwork.title}`,
    };
  }

  if (wantsDelete) {
    return {
      actionId: 'gallery.delete_artwork',
      params: { artwork_id: artwork.id, artwork: artwork.title, artist: artwork.artist_name },
      label: `Delete ${artwork.title}`,
    };
  }

  return {
    actionId: wantsUnfavorite ? 'gallery.unfavorite' : 'gallery.favorite',
    params: { artwork_id: artwork.id, artwork: artwork.title, artist: artwork.artist_name },
    label: wantsUnfavorite ? `Unfavorite ${artwork.title}` : `Favorite ${artwork.title}`,
  };
}

function inferGroupAction(userText) {
  const normalized = String(userText || '').toLowerCase();
  if (!/\b(send|post|write)\b/.test(normalized) || !/\b(group|groups)\b/.test(normalized)) {
    return null;
  }
  const groupId = findNumericId(userText, ['group', 'groups']);
  const content = extractActionContent(userText);
  if (!groupId || !content) {
    return {
      responseText:
        'Groups Agent can post to a group, but I need a group id and the message text.',
      searchResult: { ok: false, returned_count: 0, items: [], has_more: false },
    };
  }
  return {
    actionId: 'groups.send_message',
    params: { group_id: groupId, content },
    label: `Post to group ${groupId}`,
  };
}

function inferWordAction(userText) {
  const normalized = String(userText || '').toLowerCase();
  const wantsDelete = /\b(delete|remove)\b/.test(normalized) && /\b(article|post|news)\b/.test(normalized);
  const looksLikeResultsRequest =
    /\b(show|return|list|find|display|cards?|results?|actual|real|data|records?)\b/.test(
      normalized,
    ) && /\b(word on the street|posts?|feed|news|announcements?)\b/.test(normalized);
  const wantsCreate =
    !looksLikeResultsRequest &&
    (/\b(create|draft|publish|write)\b/.test(normalized) ||
      (/\bpost\b/.test(normalized) && Boolean(extractQuotedTitle(userText)))) &&
    /\b(article|post|news)\b/.test(normalized);
  if (wantsDelete) {
    const articleId = findNumericId(userText, ['article', 'post', 'news']);
    if (!articleId) {
      return {
        responseText:
          'Word on the Street Agent can delete articles, but I need the article id first.',
        searchResult: { ok: false, returned_count: 0, items: [], has_more: false },
      };
    }
    return {
      actionId: 'word.delete_article',
      params: { article_id: articleId },
      label: `Delete article ${articleId}`,
    };
  }
  if (!wantsCreate) {
    return null;
  }
  const title = extractQuotedTitle(userText);
  if (!title) {
    return {
      responseText:
        'Word on the Street Agent can create a draft article, but I need a title first.',
      searchResult: { ok: false, returned_count: 0, items: [], has_more: false },
    };
  }
  return {
    actionId: 'word.create_article',
    params: {
      title,
      content: extractActionContent(userText),
      status: /\bpublish|published\b/.test(normalized) ? 'published' : 'draft',
    },
    label: `Create article ${title}`,
  };
}

function inferProfileDmAction(userText, selectedAgent) {
  const normalized = String(userText || '').toLowerCase();
  if (
    !/\b(send|message|dm|direct message|write|tell)\b/.test(normalized) ||
    !/\b(saying|that says|and say|to say|with|:)\b/.test(normalized)
  ) {
    return null;
  }

  const request = extractStreetProfileMessageRequest(userText);
  if (!request?.recipientQuery || !request?.content) {
    return {
      responseText:
        'Messaging Agent can send a profile DM, but I need both the recipient and the exact message text.',
      searchResult: { ok: false, returned_count: 0, items: [], has_more: false },
    };
  }

  const agentName =
    selectedAgent === 'agent/profiles_agent'
      ? 'Profiles Agent'
      : selectedAgent === 'agent/street_profile_agent'
        ? 'Street Profile Agent'
        : 'Messaging Agent';
  return {
    actionId: 'profile.send_dm',
    params: {
      recipient: request.recipientQuery,
      content: request.content,
      agent: selectedAgent || 'agent/messaging_agent',
    },
    label: `${agentName} send DM to ${request.recipientQuery}`,
  };
}

function extractAcademyCourseQuery(value = '') {
  const text = String(value || '').trim();
  const match = text.match(
    /\b(?:for|in|to)\s+(?:the\s+)?(?:(?:course|class|workshop)\s+)?["“]?([^"”.,;]+?)["”]?(?:\s+(?:with|and|called|titled|title|description|assignment|homework|task)\b|$)/i,
  );
  return match ? match[1].trim() : '';
}

async function inferAcademyAction(userText) {
  const normalized = String(userText || '').toLowerCase();
  const wantsAssignment =
    /\b(create|add|post|draft)\b/.test(normalized) && /\b(assignment|homework|task)\b/.test(normalized);
  const wantsCreateCourse =
    !wantsAssignment && /\b(create|add|generate|draft)\b/.test(normalized) && /\b(course|class|workshop)\b/.test(normalized);
  const wantsUnenroll =
    /\b(unenroll|drop|leave|remove)\b/.test(normalized) && /\b(course|class|workshop)\b/.test(normalized);
  const wantsEnroll =
    wantsUnenroll || /\b(enroll|join|sign\s*up|register)\b/.test(normalized);

  if (wantsCreateCourse) {
    const title = extractQuotedTitle(userText);
    if (!title) {
      return {
        responseText:
          'Academy Agent can create a course, but I need the course title first.',
        searchResult: { ok: false, returned_count: 0, items: [], has_more: false },
      };
    }
    return {
      actionId: 'academy.create_course',
      params: {
        title,
        description: extractActionContent(userText),
      },
      label: `Create Academy course ${title}`,
    };
  }

  if (wantsAssignment) {
    const title = extractQuotedTitle(userText);
    if (!title) {
      return {
        responseText:
          'Academy Agent can create an assignment, but I need an assignment title first.',
        searchResult: { ok: false, returned_count: 0, items: [], has_more: false },
      };
    }
    const courseQuery = extractAcademyCourseQuery(userText) || userText;
    const courses = await loadLocalAcademyActionItems(courseQuery);
    const course = courses[0];
    if (!course?.id) {
      return {
        responseText:
          'Academy Agent can create an assignment, but I need a matching Academy course title or id first.',
        searchResult: { ok: false, returned_count: 0, items: [], has_more: false },
      };
    }
    return {
      actionId: 'academy.create_assignment',
      params: {
        course_id: course.id,
        course: course.title,
        title,
        description: extractActionContent(userText),
      },
      label: `Create ${title} for ${course.title}`,
    };
  }

  if (!wantsEnroll) {
    return null;
  }

  const courseQuery = extractAcademyCourseQuery(userText) || userText;
  const courses = await loadLocalAcademyActionItems(courseQuery);
  const course = courses[0];
  if (!course?.id) {
    return {
      responseText:
        'Academy Agent can enroll or drop courses, but I need a matching Academy course title or id first.',
      searchResult: { ok: false, returned_count: 0, items: [], has_more: false },
    };
  }
  return {
    actionId: wantsUnenroll ? 'academy.unenroll_course' : 'academy.enroll_course',
    params: { course_id: course.id, course: course.title },
    label: wantsUnenroll ? `Drop ${course.title}` : `Enroll in ${course.title}`,
  };
}

const GRANT_ACTION_STAGES = [
  'identified',
  'evaluating',
  'pursuing',
  'drafting',
  'review',
  'submitted',
  'awarded',
  'declined',
  'active',
  'closed',
];

function extractGrantStage(value = '') {
  const normalized = String(value || '').toLowerCase();
  return GRANT_ACTION_STAGES.find((stage) =>
    new RegExp(`\\b${stage.replace('-', '\\s*-?\\s*')}\\b`, 'i').test(normalized),
  );
}

function extractGrantFunder(value = '') {
  const match = String(value || '').match(/\b(?:funder|from|by)\s+["“]?([^"”.,;]{2,80})/i);
  if (!match) {
    return '';
  }
  const stageAlternatives = GRANT_ACTION_STAGES.map((stage) => stage.replace('-', '\\s*-?\\s*')).join('|');
  return match[1]
    .replace(new RegExp(`\\s+(?:in|at|to)\\s+(?:${stageAlternatives})\\s+stage\\b.*$`, 'i'), '')
    .replace(/\s+(?:stage|status)\b.*$/i, '')
    .trim();
}

async function inferGrantAction(userText) {
  const normalized = String(userText || '').toLowerCase();
  const wantsArchive = /\b(archive|close|remove)\b/.test(normalized) && /\b(grant|opportunity)\b/.test(normalized);
  const wantsStage =
    /\b(move|set|update|mark|change)\b/.test(normalized) &&
    /\b(stage|status|pipeline|to)\b/.test(normalized) &&
    /\b(grant|opportunity)\b/.test(normalized);
  const wantsCreate =
    /\b(create|add|track|new)\b/.test(normalized) && /\b(grant|opportunity)\b/.test(normalized);

  if (wantsCreate) {
    const name = extractQuotedTitle(userText);
    if (!name) {
      return {
        responseText:
          'Grant Manager Agent can create a grant opportunity, but I need the grant name first.',
        searchResult: { ok: false, returned_count: 0, items: [], has_more: false },
      };
    }
    return {
      actionId: 'grant.create_opportunity',
      params: {
        name,
        funder: extractGrantFunder(userText) || 'Unknown Funder',
        stage: extractGrantStage(userText) || 'identified',
      },
      label: `Create grant ${name}`,
    };
  }

  if (!wantsArchive && !wantsStage) {
    return null;
  }

  const grants = await loadGrantAgentItems(userText);
  const grant = grants[0];
  if (!grant?.id) {
    return {
      responseText:
        'Grant Manager Agent can update the pipeline, but I need a matching grant name or id first.',
      searchResult: { ok: false, returned_count: 0, items: [], has_more: false },
    };
  }

  if (wantsArchive) {
    return {
      actionId: 'grant.archive',
      params: { grant_id: grant.id, grant: grant.title, funder: grant.funder },
      label: `Archive ${grant.title}`,
    };
  }

  const stage = extractGrantStage(userText);
  if (!stage) {
    return {
      responseText:
        'Grant Manager Agent can update a grant stage, but I need a valid stage like drafting, review, submitted, awarded, or declined.',
      searchResult: { ok: false, returned_count: 0, items: [grant], has_more: false },
    };
  }

  return {
    actionId: 'grant.update_stage',
    params: { grant_id: grant.id, grant: grant.title, funder: grant.funder, stage },
    label: `Move ${grant.title} to ${stage}`,
  };
}

async function inferStreetBotAgentAction(req, userText) {
  const selectedAgent = selectedStreetBotActionAgent(req);
  if (!selectedAgent || !streetBotActionBridge?.executeStreetBotAction) {
    return null;
  }

  if (selectedAgent === 'agent/job_search_agent') {
    return inferJobAction(userText);
  }
  if (selectedAgent === 'agent/gallery_agent') {
    return inferGalleryAction(userText);
  }
  if (selectedAgent === 'agent/academy_agent') {
    return inferAcademyAction(userText);
  }
  if (selectedAgent === 'agent/grant_manager') {
    return inferGrantAction(userText);
  }
  if (selectedAgent === 'agent/groups_agent') {
    return inferGroupAction(userText);
  }
  if (selectedAgent === 'agent/messaging_agent' || selectedAgent === 'agent/profiles_agent') {
    return inferProfileDmAction(userText, selectedAgent);
  }
  if (selectedAgent === 'agent/word_on_the_street_agent') {
    return inferWordAction(userText);
  }
  if (selectedAgent === 'agent/street_profile_agent') {
    return inferProfileDmAction(userText, selectedAgent) || inferGroupAction(userText) || inferWordAction(userText);
  }
  return null;
}

function formatExecutedActionText(result) {
  const label = result?.action?.label || result?.action?.id || 'Local action';
  return `${label} completed locally.`;
}

async function buildStreetBotAgentActionResponse(req, userText) {
  const inferred = await inferStreetBotAgentAction(req, userText);
  if (!inferred) {
    return null;
  }
  if (inferred.responseText) {
    return inferred;
  }

  const result = await streetBotActionBridge.executeStreetBotAction(req, {
    actionId: inferred.actionId,
    params: inferred.params,
  });

  if (result?.status === 'needs_confirmation') {
    return {
      responseText: buildStreetBotActionDraftText(result),
      searchResult: {
        ok: true,
        returned_count: 1,
        items: [result.action],
        has_more: false,
        action: result.action,
      },
    };
  }

  return {
    responseText: formatExecutedActionText(result),
    searchResult: {
      ok: true,
      returned_count: 1,
      items: [result?.result || result?.action].filter(Boolean),
      has_more: false,
      action: result?.action,
    },
  };
}

async function buildStreetBotAgentActionConfirmationResponse(req, userText, conversationId) {
  if (
    !streetBotActionBridge?.executeStreetBotAction ||
    !isStreetBotActionConfirmation(userText) ||
    !conversationId ||
    conversationId === 'new'
  ) {
    return null;
  }

  const history = await getMessages({ conversationId, user: req.user.id }).catch(() => []);
  const draft = extractLatestStreetBotActionDraft(history);
  if (!draft) {
    return null;
  }

  const result = await streetBotActionBridge.executeStreetBotAction(req, {
    actionId: draft.actionId,
    params: draft.params,
    confirm: true,
  });
  return {
    responseText: formatExecutedActionText(result),
    searchResult: {
      ok: true,
      returned_count: 1,
      items: [result?.result || result?.action].filter(Boolean),
      has_more: false,
      action: result?.action,
    },
  };
}

async function fetchLocalSocialOverview() {
  return withStreetProfilePgClient(async (client) => {
    const users = await client.query('SELECT count(*)::int AS count FROM users');
    const channels = await client.query("SELECT count(*)::int AS count FROM channels WHERE is_archived = false");
    const messages = await client.query('SELECT count(*)::int AS count FROM messages WHERE deleted_at IS NULL');
    const posts = await client.query('SELECT count(*)::int AS count FROM feed_posts WHERE deleted_at IS NULL');
    return {
      userCount: Number(users.rows[0]?.count || 0),
      channelCount: Number(channels.rows[0]?.count || 0),
      messageCount: Number(messages.rows[0]?.count || 0),
      postCount: Number(posts.rows[0]?.count || 0),
    };
  });
}

async function fetchLocalSocialProfiles(limit = 5) {
  return withStreetProfilePgClient(async (client) => {
    const { rows } = await client.query(
      `
      SELECT id, username, display_name, location, bio, website, status, updated_at
      FROM users
      ORDER BY updated_at DESC NULLS LAST, display_name ASC
      LIMIT $1
      `,
      [Math.min(Math.max(Number(limit) || 5, 1), 20)],
    );
    return rows;
  });
}

async function fetchLocalSocialGroups(limit = 8) {
  return withStreetProfilePgClient(async (client) => {
    const { rows } = await client.query(
      `
      SELECT c.id, c.name, c.slug, c.description, c.type,
             count(DISTINCT cm.user_id)::int AS member_count,
             count(DISTINCT m.id)::int AS message_count,
             max(m.created_at) AS last_message_at
      FROM channels c
      LEFT JOIN channel_members cm ON cm.channel_id = c.id
      LEFT JOIN messages m ON m.channel_id = c.id AND m.deleted_at IS NULL
      WHERE c.is_archived = false
      GROUP BY c.id
      ORDER BY last_message_at DESC NULLS LAST, c.updated_at DESC NULLS LAST, c.name ASC
      LIMIT $1
      `,
      [Math.min(Math.max(Number(limit) || 8, 1), 50)],
    );
    return rows;
  });
}

async function fetchLocalSocialMessages(limit = 8) {
  return withStreetProfilePgClient(async (client) => {
    const { rows } = await client.query(
      `
      SELECT m.id, m.content, m.created_at,
             c.name AS channel_name, c.slug AS channel_slug,
             u.username, u.display_name
      FROM messages m
      JOIN channels c ON c.id = m.channel_id
      JOIN users u ON u.id = m.author_id
      WHERE m.deleted_at IS NULL AND COALESCE(NULLIF(trim(m.content), ''), '') <> ''
      ORDER BY m.created_at DESC
      LIMIT $1
      `,
      [Math.min(Math.max(Number(limit) || 8, 1), 50)],
    );
    return rows;
  });
}

async function fetchLocalSocialPosts(limit = 8) {
  return withStreetProfilePgClient(async (client) => {
    const { rows } = await client.query(
      `
      SELECT p.id, p.content, p.visibility, p.created_at,
             u.username, u.display_name,
             (SELECT count(*)::int FROM feed_likes fl WHERE fl.post_id = p.id) AS like_count,
             (SELECT count(*)::int FROM feed_comments fc WHERE fc.post_id = p.id) AS comment_count
      FROM feed_posts p
      JOIN users u ON u.id = p.author_id
      WHERE p.deleted_at IS NULL
      ORDER BY p.created_at DESC
      LIMIT $1
      `,
      [Math.min(Math.max(Number(limit) || 8, 1), 50)],
    );
    return rows;
  });
}

function formatProfileList(items) {
  return items
    .slice(0, 5)
    .map((profile) => {
      const name = profile.display_name || profile.username || 'Unnamed profile';
      const username = profile.username ? `@${profile.username}` : '';
      const role = Array.isArray(profile.primary_roles) ? profile.primary_roles[0] : '';
      const location = profile.location_display || profile.city || '';
      return `- ${[name, username, role, location].filter(Boolean).join(' | ')}`;
    })
    .join('\n');
}

async function buildProfilesAgentResponse(userText) {
  const query = new URLSearchParams({ limit: '5', page: '1', view: 'directory' });
  const searchMatch = userText.match(/\b(?:search|find|look for|show)\s+(.{2,80})/i);
  if (searchMatch?.[1]) {
    query.set('search', searchMatch[1].trim());
  }
  const data = await fetchStreetProfileJson(`/street-profiles/directory?${query.toString()}`);
  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data?.profiles) ? data.profiles : [];
  const total = Number(data?.total ?? items.length) || 0;
  if (!data) {
    return {
      text:
        'Profiles Agent is selected, but I could not reach the local Street Profile directory API from this chat worker right now.',
      count: 0,
      payload: buildStreetProfileCardsPayload('profiles', 'Street Profiles', 0, []),
    };
  }
  const localProfiles = await fetchLocalSocialProfiles(5);
  const payload = buildStreetProfileCardsPayload('profiles', 'Street Profiles', total, items, {
    summary: {
      local_site_users: Array.isArray(localProfiles) ? localProfiles.length : 0,
    },
    related: {
      local_profiles: Array.isArray(localProfiles)
        ? localProfiles.map(cleanStreetProfileItem).slice(0, 5)
        : [],
    },
  });
  return {
    text: withStreetProfileCards(
      `Profiles Agent pulled the live local Street Profile directory. I found ${total.toLocaleString()} profiles.`,
      payload,
    ),
    count: total,
    payload,
  };
}

async function buildGroupsAgentResponse() {
  const dbGroups = await fetchLocalSocialGroups(8);
  const overview = await fetchLocalSocialOverview();
  if (Array.isArray(dbGroups) && dbGroups.length && overview) {
    const payload = buildStreetProfileCardsPayload(
      'groups',
      'Street Profile Groups',
      overview.channelCount,
      dbGroups,
      {
        summary: {
          local_site_users: overview.userCount,
          local_messages: overview.messageCount,
        },
      },
    );
    return {
      text: withStreetProfileCards(
        `Groups Agent pulled the live local Groups data. I found ${overview.channelCount.toLocaleString()} active groups/channels.`,
        payload,
      ),
      count: overview.channelCount,
      payload,
    };
  }

  const totalMembers = LOCAL_STREET_PROFILE_GROUPS.reduce(
    (sum, group) => sum + Number(group.member_count || 0),
    0,
  );
  const totalMessages = LOCAL_STREET_PROFILE_GROUPS.reduce(
    (sum, group) => sum + Number(group.message_count || 0),
    0,
  );
  const groups = LOCAL_STREET_PROFILE_GROUPS.map(
    (group) =>
      `- ${group.name}: ${group.member_count} members, ${group.message_count} messages, ${group.tags.join(', ')}`,
  ).join('\n');
  return {
    text: withStreetProfileCards(
      `Groups Agent pulled the local Groups fallback data. I found ${LOCAL_STREET_PROFILE_GROUPS.length} Street Profile groups.`,
      buildStreetProfileCardsPayload(
        'groups',
        'Street Profile Groups',
        LOCAL_STREET_PROFILE_GROUPS.length,
        LOCAL_STREET_PROFILE_GROUPS,
        { summary: { total_members: totalMembers, total_messages: totalMessages } },
      ),
    ),
    count: LOCAL_STREET_PROFILE_GROUPS.length,
    payload: buildStreetProfileCardsPayload(
      'groups',
      'Street Profile Groups',
      LOCAL_STREET_PROFILE_GROUPS.length,
      LOCAL_STREET_PROFILE_GROUPS,
    ),
  };
}

async function buildMessagingAgentResponse() {
  const dbMessages = await fetchLocalSocialMessages(8);
  const overview = await fetchLocalSocialOverview();
  if (Array.isArray(dbMessages) && dbMessages.length && overview) {
    const payload = buildStreetProfileCardsPayload(
      'messages',
      'Street Profile Messages',
      overview.messageCount,
      dbMessages,
      {
        summary: {
          active_groups: overview.channelCount,
        },
      },
    );
    return {
      text: withStreetProfileCards(
        `Messaging Agent pulled the live local Messages data. I found ${overview.messageCount.toLocaleString()} messages across ${overview.channelCount.toLocaleString()} active groups/channels.`,
        payload,
      ),
      count: overview.messageCount,
      payload,
    };
  }

  const totalMessages = LOCAL_STREET_PROFILE_GROUPS.reduce(
    (sum, group) => sum + Number(group.message_count || 0),
    0,
  );
  const messages = LOCAL_STREET_PROFILE_GROUPS.slice(0, 5)
    .map((group) => `- ${group.name}: ${group.last_message}`)
    .join('\n');
  return {
    text: withStreetProfileCards(
      `Messaging Agent pulled the local message fallback context. I found ${totalMessages.toLocaleString()} page-backed messages across ${LOCAL_STREET_PROFILE_GROUPS.length} groups.`,
      buildStreetProfileCardsPayload(
        'messages',
        'Street Profile Messages',
        totalMessages,
        LOCAL_STREET_PROFILE_GROUPS.map((group) => ({
          id: group.id || group.name,
          channel_name: group.name,
          content: group.last_message,
          message_count: group.message_count,
        })),
      ),
    ),
    count: totalMessages,
    payload: buildStreetProfileCardsPayload('messages', 'Street Profile Messages', totalMessages, []),
  };
}

async function buildWordOnTheStreetAgentResponse() {
  const dbPosts = await fetchLocalSocialPosts(8);
  const overview = await fetchLocalSocialOverview();
  if (Array.isArray(dbPosts) && dbPosts.length && overview) {
    const payload = buildStreetProfileCardsPayload(
      'posts',
      'Word on the Street',
      overview.postCount,
      dbPosts,
    );
    return {
      text: withStreetProfileCards(
        `Word on the Street Agent pulled the live local feed. I found ${overview.postCount.toLocaleString()} local feed posts.`,
        payload,
      ),
      count: overview.postCount,
      payload,
    };
  }
  if (overview) {
    const payload = buildStreetProfileCardsPayload(
      'posts',
      'Word on the Street',
      overview.postCount,
      [],
    );
    return {
      text: withStreetProfileCards(
        `Word on the Street Agent checked the live local feed. I found ${overview.postCount.toLocaleString()} local feed posts right now.`,
        payload,
      ),
      count: overview.postCount,
      payload,
    };
  }

  const posts = LOCAL_WORD_ON_THE_STREET_POSTS.map(
    (post) =>
      `- ${post.title} by ${post.author_name} (${post.category_name}, ${post.reply_count} replies, ${post.like_count} likes)`,
  ).join('\n');
  return {
    text: withStreetProfileCards(
      `Word on the Street Agent pulled the local fallback feed. I found ${LOCAL_WORD_ON_THE_STREET_POSTS.length} highlighted posts.`,
      buildStreetProfileCardsPayload(
        'posts',
        'Word on the Street',
        LOCAL_WORD_ON_THE_STREET_POSTS.length,
        LOCAL_WORD_ON_THE_STREET_POSTS,
      ),
    ),
    count: LOCAL_WORD_ON_THE_STREET_POSTS.length,
    payload: buildStreetProfileCardsPayload(
      'posts',
      'Word on the Street',
      LOCAL_WORD_ON_THE_STREET_POSTS.length,
      LOCAL_WORD_ON_THE_STREET_POSTS,
    ),
  };
}

async function buildStreetProfileFamilyResponse(req, userText, runProgressPhase) {
  const selectedAgent = getSelectedStreetProfileAgent(req);
  if (!selectedAgent) {
    return null;
  }

  const conversationId = String(req?.body?.conversationId || '').trim();
  const confirmationResponse = await buildStreetProfileMessageConfirmationResponse(
    req,
    userText,
    conversationId,
  );
  if (confirmationResponse) {
    return confirmationResponse;
  }

  const messageSendResponse = await buildStreetProfileMessageSendResponse(req, userText);
  if (messageSendResponse) {
    return messageSendResponse;
  }

  if (!looksLikeStreetProfileAgentResultsRequest(selectedAgent, userText)) {
    return null;
  }

  const normalized = String(userText || '').toLowerCase();
  const wantsOverview = /\b(across|overview|all|everything|overall|areas?|connected|summary|summarize)\b/.test(normalized);
  const wantsProfiles =
    selectedAgent === 'agent/profiles_agent' ||
    /\b(profile|profiles|people|directory|creator|creators)\b/.test(normalized);
  const wantsGroups = selectedAgent === 'agent/groups_agent' || /\b(groups?|members?)\b/.test(normalized);
  const wantsMessages =
    selectedAgent === 'agent/messaging_agent' || /\b(messages?|dms?|inbox|chat)\b/.test(normalized);
  const wantsWord =
    selectedAgent === 'agent/word_on_the_street_agent' ||
    /\b(word on the street|posts?|feed|news|announcements?)\b/.test(normalized);

  const run = (phase, work) =>
    typeof runProgressPhase === 'function' ? runProgressPhase(phase, work, { selectedAgent }) : work();

  if (selectedAgent === 'agent/street_profile_agent') {
    if (!wantsOverview && wantsGroups && !wantsMessages && !wantsWord) {
      const groupsOnlyResponse = await buildGroupsAgentResponse();
      return {
        responseText: `Street Profile Agent routed this to Groups. ${groupsOnlyResponse.text}`,
        searchResult: {
          ok: true,
          returned_count: groupsOnlyResponse.count,
          items: [],
          has_more: false,
          selectedAgent,
        },
      };
    }
    if (!wantsOverview && wantsMessages && !wantsGroups && !wantsWord) {
      const messagesOnlyResponse = await buildMessagingAgentResponse();
      return {
        responseText: `Street Profile Agent routed this to Messaging. ${messagesOnlyResponse.text}`,
        searchResult: {
          ok: true,
          returned_count: messagesOnlyResponse.count,
          items: [],
          has_more: false,
          selectedAgent,
        },
      };
    }
    if (!wantsOverview && wantsWord && !wantsGroups && !wantsMessages) {
      const wordOnlyResponse = await buildWordOnTheStreetAgentResponse();
      return {
        responseText: `Street Profile Agent routed this to Word on the Street. ${wordOnlyResponse.text}`,
        searchResult: {
          ok: true,
          returned_count: wordOnlyResponse.count,
          items: [],
          has_more: false,
          selectedAgent,
        },
      };
    }
    if (!wantsOverview && wantsProfiles && !wantsGroups && !wantsMessages && !wantsWord) {
      const profileOnlyResponse = await run('checking_street_profiles', () =>
        buildProfilesAgentResponse(userText),
      );
      return {
        responseText: `Street Profile Agent routed this to Profiles. ${profileOnlyResponse.text}`,
        searchResult: {
          ok: true,
          returned_count: profileOnlyResponse.count,
          items: [],
          has_more: false,
          selectedAgent,
        },
      };
    }
    const profileResponse = await run('checking_street_profiles', () => buildProfilesAgentResponse(userText));
    const groupsResponse = await buildGroupsAgentResponse();
    const messagingResponse = await buildMessagingAgentResponse();
    const wordResponse = await buildWordOnTheStreetAgentResponse();
    const overviewPayload = {
      kind: 'overview',
      title: 'Street Profile',
      sections: [profileResponse, groupsResponse, messagingResponse, wordResponse]
        .map((response) => response?.payload)
        .filter(Boolean),
      summary: {
        profiles: profileResponse.count,
        groups: groupsResponse.count,
        messages: messagingResponse.count,
        posts: wordResponse.count,
      },
    };
    return {
      responseText: withStreetProfileCards(
        'Street Profile Agent pulled the connected local Street Profile areas.',
        overviewPayload,
      ),
      searchResult: {
        ok: true,
        returned_count: profileResponse.count,
        items: [],
        has_more: false,
        selectedAgent,
      },
    };
  }

  let result;
  if (selectedAgent === 'agent/profiles_agent') {
    result = await run('checking_street_profiles', () => buildProfilesAgentResponse(userText));
  } else if (selectedAgent === 'agent/groups_agent') {
    result = await buildGroupsAgentResponse();
  } else if (selectedAgent === 'agent/messaging_agent') {
    result = await buildMessagingAgentResponse();
  } else if (selectedAgent === 'agent/word_on_the_street_agent') {
    result = await buildWordOnTheStreetAgentResponse();
  } else if (wantsGroups) {
    result = await buildGroupsAgentResponse();
  } else if (wantsMessages) {
    result = await buildMessagingAgentResponse();
  } else if (wantsWord) {
    result = await buildWordOnTheStreetAgentResponse();
  } else if (wantsProfiles) {
    result = await run('checking_street_profiles', () => buildProfilesAgentResponse(userText));
  } else {
    result = {
      text:
        'I am connected to the Street Profile local data areas. Ask me for profiles, messages, groups, or Word on the Street posts and I will pull from that local context.',
      count: 0,
    };
  }

  return {
    responseText: result.text,
    searchResult: {
      ok: true,
      returned_count: result.count,
      items: [],
      has_more: false,
      selectedAgent,
    },
  };
}

function looksLikeStreetBotModelFailureText(value) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }
  const normalized = text.toLowerCase();
  return (
    normalized.includes('having trouble reaching my model') ||
    normalized.includes('api call failed') ||
    normalized.includes('request requires more credits') ||
    normalized.includes('exceeded your current quota') ||
    normalized.includes('model_rate_limit') ||
    normalized.includes('openrouter.ai/settings/credits')
  );
}

function normalizeStreetBotResponse(req, endpointOption, response) {
  const endpoint =
    endpointOption?.endpoint ??
    req?.params?.endpoint ??
    req?.body?.endpoint ??
    req?.body?.endpointOption?.endpoint ??
    '';

  if (!isStreetBotEndpoint(endpoint) || !response || typeof response !== 'object') {
    return response;
  }

  let changed = false;
  const nextResponse = { ...response };

  if (typeof response.text === 'string' && response.text.trim()) {
    const normalizedText = normalizeStreetBotResponseText(response.text);
    if (normalizedText !== response.text) {
      nextResponse.text = normalizedText;
      changed = true;
    }
  }

  if (Array.isArray(response.content) && response.content.length > 0) {
    const nextContent = response.content.map((part) => cloneContentPart(part));
    for (let i = 0; i < nextContent.length; i += 1) {
      const part = nextContent[i];
      if (
        !part ||
        typeof part !== 'object' ||
        part.type !== 'text' ||
        typeof part.text !== 'string'
      ) {
        continue;
      }
      const normalizedText = normalizeStreetBotResponseText(part.text);
      if (normalizedText !== part.text) {
        nextContent[i] = { ...part, text: normalizedText };
        changed = true;
      }
    }
    if (changed) {
      nextResponse.content = nextContent;
    }
  }

  return nextResponse;
}

function normalizeStreetBotMessagePayload(endpoint, message) {
  if (!isStreetBotEndpoint(endpoint) || !message || typeof message !== 'object') {
    return message;
  }

  let changed = false;
  const nextMessage = { ...message };

  if (typeof message.text === 'string' && message.text.trim()) {
    const normalizedText = normalizeStreetBotResponseText(message.text);
    if (normalizedText !== message.text) {
      nextMessage.text = normalizedText;
      changed = true;
    }
  }

  if (Array.isArray(message.content) && message.content.length > 0) {
    const nextContent = message.content.map((part) => cloneContentPart(part));
    for (let i = 0; i < nextContent.length; i += 1) {
      const part = nextContent[i];
      if (
        !part ||
        typeof part !== 'object' ||
        part.type !== 'text' ||
        typeof part.text !== 'string'
      ) {
        continue;
      }
      const normalizedText = normalizeStreetBotResponseText(part.text);
      if (normalizedText !== part.text) {
        nextContent[i] = { ...part, text: normalizedText };
        changed = true;
      }
    }
    if (changed) {
      nextMessage.content = nextContent;
    }
  }

  return changed ? nextMessage : message;
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emitStreetBotMessageDelta(streamId, responseMessageId, value, { force = false } = {}) {
  const text = String(value || '');
  if ((!STREETBOT_FASTPATH_STREAMING_ENABLED && !force) || !streamId || !responseMessageId || !text) {
    return;
  }
  GenerationJobManager.emitChunk(streamId, {
    event: 'on_message_delta',
    data: {
      id: responseMessageId,
      delta: {
        content: [{ type: 'text', text }],
      },
    },
  });
}

function emitStreetBotResponseStepStart(streamId, runId, index = 1, { force = false } = {}) {
  if ((!STREETBOT_FASTPATH_STREAMING_ENABLED && !force) || !streamId || !runId) {
    return null;
  }

  const stepId = `step_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  GenerationJobManager.emitChunk(streamId, {
    event: 'on_run_step',
    data: {
      id: stepId,
      runId,
      index,
      stepDetails: {
        type: 'message_creation',
        message_creation: {
          message_id: runId,
        },
      },
    },
  });

  return {
    stepId,
    runId,
    index,
  };
}

function splitStreetBotTextChunks(value, preferredSize = STREETBOT_TEXT_STREAM_CHUNK_SIZE) {
  const source = String(value || '');
  if (!source) {
    return [];
  }

  const chunks = [];
  let remaining = source;
  while (remaining.length > preferredSize) {
    const newlineBoundary = remaining.lastIndexOf('\n', preferredSize);
    const spaceBoundary = remaining.lastIndexOf(' ', preferredSize);
    let boundary = Math.max(newlineBoundary, spaceBoundary);
    if (boundary < Math.floor(preferredSize * 0.5)) {
      boundary = preferredSize;
    } else {
      boundary += 1;
    }

    chunks.push(remaining.slice(0, boundary));
    remaining = remaining.slice(boundary);
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks.filter(Boolean);
}

async function emitStreetBotMessageText(
  streamId,
  responseTargetId,
  value,
  {
    preferredSize = STREETBOT_TEXT_STREAM_CHUNK_SIZE,
    delayMs = STREETBOT_TEXT_STREAM_DELAY_MS,
    force = false,
  } = {},
) {
  if (!STREETBOT_FASTPATH_STREAMING_ENABLED && !force) {
    return;
  }

  const chunks = splitStreetBotTextChunks(value, preferredSize);
  for (let index = 0; index < chunks.length; index += 1) {
    emitStreetBotMessageDelta(streamId, responseTargetId, chunks[index], { force });
    if (delayMs > 0 && index < chunks.length - 1) {
      await sleep(delayMs);
    }
  }
}

function toStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function hasExplicitResultLimit(value) {
  return extractRequestedLimit(value, true) != null;
}

function extractRequestedLimit(value, allowLoose = false) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const exactMoreMatch = normalized.match(
    new RegExp(`\\b(\\d{1,2}|${LIMIT_WORD_PATTERN})\\s+more\\b`, 'i'),
  );
  if (exactMoreMatch) {
    const raw = exactMoreMatch[1].toLowerCase();
    return /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS.get(raw) || null;
  }

  const exactMatch = normalized.match(
    new RegExp(
      `\\b(\\d{1,2}|${LIMIT_WORD_PATTERN})\\s+(?:results?|services?|options?|matches?|cards?)\\b`,
      'i',
    ),
  );
  if (exactMatch) {
    const raw = exactMatch[1].toLowerCase();
    return /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS.get(raw) || null;
  }

  if (!allowLoose) {
    return null;
  }

  const looseMatch = normalized.match(
    new RegExp(
      `^(?:show|give|list|return|make it|make them|make those|make this)?\\s*(\\d{1,2}|${LIMIT_WORD_PATTERN})\\s*(?:in\\b|around\\b|for\\b|$)`,
      'i',
    ),
  );
  if (!looseMatch) {
    return null;
  }

  const raw = looseMatch[1].toLowerCase();
  return /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS.get(raw) || null;
}

function textContainsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function getMatchedKeywords(text, keywords) {
  return keywords.filter((keyword) => text.includes(keyword));
}

function dedupeStrings(values = []) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function inferDirectBrowseCategories(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }

  return dedupeStrings(
    DIRECT_BROWSE_CATEGORY_HINTS.filter(([keyword]) => normalized.includes(keyword)).map(
      ([, category]) => category,
    ),
  );
}

function hasExplicitServiceLocation(candidateArgs = null) {
  return Boolean(candidateArgs?.city || candidateArgs?.province);
}

function looksLikeNearbyBrowseWithoutLocation(value, candidateArgs = null) {
  const normalized = normalizeText(value);
  if (!normalized || hasExplicitServiceLocation(candidateArgs)) {
    return false;
  }

  return /\bnear me\b/i.test(normalized);
}

function stripBrowseSearchScaffolding(value) {
  return String(value || '')
    .trim()
    .replace(/^\s*(i am|i'm|im)\s+/i, '')
    .replace(
      /^\s*(i need|i'm looking for|im looking for|looking for|can you find|could you find|find me|show me|give me|list|show|give|return|recommend)\s+/i,
      '',
    )
    .replace(/^\s*(need|want)\s+/i, '')
    .replace(/^\s*(what about|how about)\s+/i, '')
    .replace(/^\s*(a|an|the|some)\s+/i, '')
    .replace(/\bplease\b/gi, ' ')
    .replace(
      /\b(show|give|list|return)\s+\d{1,2}\s+(?:results?|services?|options?|matches?|cards?)\b/gi,
      ' ',
    )
    .replace(
      /\b(show|give|list|return)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:results?|services?|options?|matches?|cards?)\b/gi,
      ' ',
    )
    .replace(/\b\d{1,2}\s+more\b/gi, ' ')
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+more\b/gi, ' ')
    .replace(/[!?.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildDirectBrowseSearchArgs(userText, candidateArgs = null) {
  const baseArgs = candidateArgs && typeof candidateArgs === 'object' ? candidateArgs : {};
  return {
    ...baseArgs,
    query:
      stripBrowseSearchScaffolding(userText) || String(baseArgs.query || userText || '').trim(),
    categories: dedupeStrings([
      ...(Array.isArray(baseArgs.categories) ? baseArgs.categories : []),
      ...inferDirectBrowseCategories(userText),
    ]),
  };
}

function canDirectSearchBroadBrowse(value, candidateArgs = null) {
  return hasExplicitServiceLocation(candidateArgs) && inferDirectBrowseCategories(value).length > 0;
}

function inferBrowseTopicLabel(userText = '', payload = null) {
  const normalized = normalizeText(userText);
  if (normalized.includes('program')) {
    return 'programs';
  }
  if (normalized.includes('service')) {
    return 'services';
  }

  const categories = Array.isArray(payload?.category_facets)
    ? payload.category_facets.map((entry) => String(entry?.value || '').trim()).filter(Boolean)
    : [];
  if (categories.length > 0) {
    return categories[0].toLowerCase();
  }

  return 'services';
}

function normalizeBrowseCategoryHint(value = '') {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }
  if (/\bhous|shelter|rent|evict|warming/.test(normalized)) {
    return 'Housing';
  }
  if (/\bfood|meal|grocery|hungr|food bank|breakfast|lunch|dinner/.test(normalized)) {
    return 'Food';
  }
  if (
    /\bhealth|doctor|clinic|medical|mental health|health centre|health center|counsell|therapy/.test(
      normalized,
    )
  ) {
    return 'Health';
  }
  if (/\blegal|law|advocacy|rights|tenant|immigration/.test(normalized)) {
    return 'Legal';
  }
  if (/\bemploy|job|career|resume|work/.test(normalized)) {
    return 'Employment';
  }
  if (/\bbenefit|income|odsp|ontario works|disability/.test(normalized)) {
    return 'Benefits';
  }
  if (/\bnewcomer|settlement|immigrant|refugee/.test(normalized)) {
    return 'Newcomer';
  }
  if (/\bprogram/.test(normalized)) {
    return 'Programs';
  }
  return String(value || '').trim();
}

function buildBrowseCategoryHints(payload = null) {
  const rawCategories = Array.isArray(payload?.category_facets)
    ? payload.category_facets
        .slice(0, 8)
        .map((entry) => entry?.value)
        .filter(Boolean)
    : [];
  const normalizedCategories = dedupeStrings(
    rawCategories.map((value) => normalizeBrowseCategoryHint(value)).filter(Boolean),
  );
  return normalizedCategories.slice(0, 5);
}

function inferExplicitBrowseLocationLabel(value = '') {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  const match = BROWSE_LOCATION_LABELS.find(([keyword]) =>
    new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i').test(normalized),
  );
  return match ? match[1] : '';
}

function getStreetBotUserContext(rawContext) {
  if (!rawContext || typeof rawContext !== 'object') {
    return {};
  }
  const latitude = Number(rawContext.latitude ?? rawContext.lat);
  const longitude = Number(rawContext.longitude ?? rawContext.lon);
  return {
    preferred_city: String(rawContext.preferred_city || rawContext.city || '').trim(),
    preferred_province: String(rawContext.preferred_province || rawContext.province || '').trim(),
    location_label: String(rawContext.location_label || '').trim(),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    updated_at: String(rawContext.updated_at || '').trim(),
    source: String(rawContext.source || '').trim(),
  };
}

function hasStreetBotPreferredLocation(userContext = {}) {
  return Boolean(
    userContext.preferred_city ||
      userContext.preferred_province ||
      (Number.isFinite(userContext.latitude) && Number.isFinite(userContext.longitude)),
  );
}

function getStreetBotPreferredLocationLabel(userContext = {}) {
  if (userContext.location_label) {
    return userContext.location_label;
  }
  return [userContext.preferred_city, userContext.preferred_province].filter(Boolean).join(', ');
}

function applyStreetBotUserContextToSearchArgs(args, userContext = {}) {
  if (!args || typeof args !== 'object') {
    return args;
  }

  const nextArgs = { ...args };
  if (!nextArgs.city && userContext.preferred_city) {
    nextArgs.city = userContext.preferred_city;
  }
  if (!nextArgs.province && userContext.preferred_province) {
    nextArgs.province = userContext.preferred_province;
  }
  if (nextArgs.latitude == null && Number.isFinite(userContext.latitude)) {
    nextArgs.latitude = userContext.latitude;
  }
  if (nextArgs.longitude == null && Number.isFinite(userContext.longitude)) {
    nextArgs.longitude = userContext.longitude;
  }

  const currentUserContext =
    nextArgs.user_context && typeof nextArgs.user_context === 'object' ? nextArgs.user_context : {};
  nextArgs.user_context = {
    ...currentUserContext,
    ...(userContext.preferred_city ? { preferred_city: userContext.preferred_city } : {}),
    ...(userContext.preferred_province
      ? { preferred_province: userContext.preferred_province }
      : {}),
    ...(Number.isFinite(userContext.latitude) ? { latitude: userContext.latitude } : {}),
    ...(Number.isFinite(userContext.longitude) ? { longitude: userContext.longitude } : {}),
  };

  return nextArgs;
}

function finiteDistanceKm(...values) {
  for (const value of values) {
    if (value == null || value === '') {
      continue;
    }
    const numberValue = Number(value);
    if (Number.isFinite(numberValue) && numberValue >= 0) {
      return numberValue;
    }
  }
  return null;
}

function normalizeStreetBotDistanceFields(searchResult) {
  if (!searchResult || typeof searchResult !== 'object' || !Array.isArray(searchResult.items)) {
    return searchResult;
  }

  let changed = false;
  const items = searchResult.items.map((item) => {
    if (!item || typeof item !== 'object') {
      return item;
    }

    const vectorDistance = finiteDistanceKm(item.vector_distance, item.vectorDistance);
    const geoDistanceKm = finiteDistanceKm(
      item.geo_distance_km,
      item.geoDistanceKm,
      item._geo_distance_km,
      item.geodistancekm,
    );
    const rawDistanceKm = finiteDistanceKm(
      item.distance_km,
      item.distanceKm,
      item.distancekm,
      item.distance,
    );
    const nonVectorDistanceKm =
      rawDistanceKm != null &&
      (vectorDistance == null || Math.abs(rawDistanceKm - vectorDistance) > 0.000001)
        ? rawDistanceKm
        : null;
    const distanceKm = geoDistanceKm ?? nonVectorDistanceKm;

    if (
      distanceKm == null &&
      item.distance_km == null &&
      (vectorDistance == null || item.distance !== vectorDistance)
    ) {
      return item;
    }

    changed = true;
    const nextItem = {
      ...item,
      geo_distance_km: distanceKm,
      distance_km: distanceKm,
    };

    if (distanceKm != null) {
      nextItem.distance = distanceKm;
    } else if (vectorDistance != null && item.distance === vectorDistance) {
      nextItem.distance = null;
    }

    return nextItem;
  });

  return changed ? { ...searchResult, items } : searchResult;
}

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function extractPreferenceSubject(value) {
  const text = String(value || '').trim();
  for (const pattern of PREFERENCE_PATTERNS) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }
    const subject = String(match[match.length - 1] || '')
      .trim()
      .toLowerCase();
    if (subject) {
      return subject.replace(/[?.!]+$/g, '').trim();
    }
  }
  return '';
}

function looksLikePersonalPreferenceQuestion(value) {
  return Boolean(extractPreferenceSubject(value));
}

function looksLikeRelationalTurn(value) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }
  return matchesAny(text, RELATIONAL_PATTERNS);
}

function looksLikePlayfulSocialTurn(value) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }
  if (countTokens(text) > 8) {
    return false;
  }
  return matchesAny(text, PLAYFUL_PATTERNS);
}

function looksLikeBotDirectedTopicChat(value) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }
  if (looksLikePersonalPreferenceQuestion(text)) {
    return true;
  }
  return matchesAny(text, BOT_DIRECTED_TOPIC_CHAT_PATTERNS);
}

function extractBotDirectedTopicSubject(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  for (const pattern of BOT_DIRECTED_TOPIC_CHAT_PATTERNS) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }
    const subject = String(match[match.length - 1] || '')
      .trim()
      .replace(/[?.!]+$/g, '')
      .trim();
    if (subject) {
      return subject;
    }
  }
  return '';
}

function buildBotDirectedTopicChatResponse(value) {
  if (!looksLikeBotDirectedTopicChat(value)) {
    return null;
  }

  const normalized = normalizeText(value);
  const subject = extractBotDirectedTopicSubject(value);
  if (!subject) {
    return null;
  }

  if (/^do you\b/i.test(normalized) || /^are you\b/i.test(normalized)) {
    return `I don't like things the way a person does, but ${subject} is definitely something I can talk about. Tell me if you want the basics, my quick take, or the social side of it.`;
  }

  if (/^can you tell me about\b/i.test(normalized)) {
    return `Sure. ${subject} can mean very different things depending on the context, so it helps to narrow the angle. Tell me if you want the basics, why people care about it, or a more personal take.`;
  }

  return `I can talk about ${subject}. My quick take is that it can be meaningful, fun, stressful, or deeply personal depending on the context. Tell me whether you want a quick opinion, the basics, or a deeper conversation about it.`;
}

function extractInformationalServiceSubject(value) {
  const text = String(value || '').trim();
  for (const pattern of INFORMATIONAL_SERVICE_PATTERNS) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }
    const subject = String(match[match.length - 1] || '')
      .trim()
      .toLowerCase()
      .replace(/[?.!]+$/g, '')
      .trim();
    if (subject) {
      return subject;
    }
  }
  return '';
}

function looksLikeInformationalServiceQuestion(value) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }
  if (looksLikeServiceMetaConversation(text)) {
    return false;
  }

  const normalized = normalizeText(text);
  if (matchesAny(text, FINDER_PATTERNS)) {
    return false;
  }

  const subject = extractInformationalServiceSubject(text);
  if (!subject || !textContainsAny(subject, SERVICE_KEYWORDS)) {
    return false;
  }

  if (
    /\b(near me|open now|available|closest|tonight|today)\b/i.test(normalized) ||
    /\bin\s+(toronto|ontario|hamilton|ottawa|mississauga|brampton|scarborough|etobicoke|north york)\b/i.test(
      normalized,
    )
  ) {
    return false;
  }

  return true;
}

function looksLikeStreetBotEvaluationConversation(value) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }
  return matchesAny(text, EVALUATION_CONVERSATION_PATTERNS);
}

function looksLikeStreetBotStackStatusPrompt(value) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }
  return matchesAny(text, STACK_STATUS_FASTPATH_PATTERNS);
}

function looksLikeStreetBotImprovementReviewPrompt(value) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }
  return matchesAny(text, IMPROVEMENT_REVIEW_PATTERNS);
}

function getStreetBotLogRoot() {
  for (const candidate of STREETBOT_LOG_ROOT_CANDIDATES) {
    const normalized = String(candidate || '').trim();
    if (!normalized) {
      continue;
    }
    const logRoot = path.join(normalized, '.streetbot-host', 'logs');
    if (fs.existsSync(logRoot)) {
      return logRoot;
    }
  }
  return '';
}

function readLatestStreetBotJsonReport(reportDirectory) {
  const logRoot = getStreetBotLogRoot();
  if (!logRoot) {
    return { payload: null, reportPath: '' };
  }

  const targetDir = path.join(logRoot, reportDirectory);
  if (!fs.existsSync(targetDir)) {
    return { payload: null, reportPath: '' };
  }

  try {
    const entries = fs
      .readdirSync(targetDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => {
        const reportPath = path.join(targetDir, name);
        const stats = fs.statSync(reportPath);
        return { name, reportPath, mtimeMs: Number(stats.mtimeMs || 0) };
      })
      .sort((left, right) => right.mtimeMs - left.mtimeMs);

    if (!entries.length) {
      return { payload: null, reportPath: '' };
    }

    const latest = entries[0];
    const payload = JSON.parse(fs.readFileSync(latest.reportPath, 'utf8'));
    return {
      payload: payload && typeof payload === 'object' ? payload : null,
      reportPath: latest.reportPath,
    };
  } catch (error) {
    logger.warn(`[streetbot-fastpath] failed to read ${reportDirectory}: ${error.message}`);
    return { payload: null, reportPath: '' };
  }
}

function getStreetBotStatusRank(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized || normalized === 'excellent' || normalized === 'ok') {
    return 0;
  }
  if (normalized === 'good' || normalized === 'warning') {
    return 1;
  }
  if (normalized === 'mixed' || normalized === 'degraded') {
    return 2;
  }
  return 3;
}

function inferPriorityLabel(status, score) {
  const rank = getStreetBotStatusRank(status);
  if (rank >= 2 || Number(score || 0) <= 75) {
    return 'High';
  }
  if (rank === 1 || Number(score || 0) <= 90) {
    return 'Medium';
  }
  return 'Low';
}

function buildStreetBotStackStatusFastPathResponse() {
  const stackReport = readLatestStreetBotJsonReport('stack-checks');
  const payload = stackReport.payload;
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const retrieval =
    payload.retrieval && typeof payload.retrieval === 'object' ? payload.retrieval : {};
  const transition =
    payload.transition && typeof payload.transition === 'object' ? payload.transition : {};
  const serviceCorpus =
    payload.service_corpus && typeof payload.service_corpus === 'object'
      ? payload.service_corpus
      : {};
  const summary =
    transition.summary && typeof transition.summary === 'object' ? transition.summary : {};

  const lines = [
    'Current Street Bot stack health:',
    '',
    `- Overall: ${String(payload.overall || 'unknown')}`,
    `- Weaviate: ${String(payload.weaviate?.status || 'unknown')}`,
    `- Service corpus: ${String(serviceCorpus.sync || 'unknown')} (${Number(serviceCorpus.count || 0)} records)`,
    `- Retrieval: ${String(retrieval.overall || 'unknown')}`,
    `- Transition guardrails: ${String(transition.overall || 'unknown')} (${Number(summary.passed || 0)}/${Number(summary.total || 0)})`,
    `- Public probe: ${String(payload.probe?.status || 'unknown')}`,
  ];

  if (payload.recommended_area && payload.recommended_area !== 'none') {
    lines.push('', `Recommended area: ${String(payload.recommended_area)}`);
  } else {
    lines.push('', 'No active stack-level failures are showing in the latest saved check.');
  }

  return lines.join('\n').trim();
}

function buildStreetBotImprovementFastPathResponse() {
  const adminReport = readLatestStreetBotJsonReport('admin-checks');
  const retrievalReport = readLatestStreetBotJsonReport('retrieval-checks');
  const stackReport = readLatestStreetBotJsonReport('stack-checks');

  const admin =
    adminReport.payload && typeof adminReport.payload === 'object' ? adminReport.payload : {};
  const retrieval =
    retrievalReport.payload && typeof retrievalReport.payload === 'object'
      ? retrievalReport.payload
      : {};
  const stack =
    stackReport.payload && typeof stackReport.payload === 'object' ? stackReport.payload : {};

  const scorecards =
    admin.scorecards && typeof admin.scorecards === 'object' ? admin.scorecards : {};
  const attentionCards = Object.entries(scorecards)
    .map(([key, value]) => ({ key, ...(value && typeof value === 'object' ? value : {}) }))
    .filter((card) => getStreetBotStatusRank(card.status) > 0)
    .sort((left, right) => {
      const rankDiff = getStreetBotStatusRank(right.status) - getStreetBotStatusRank(left.status);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return Number(left.score || 100) - Number(right.score || 100);
    });

  const priorityLines = [];

  for (const card of attentionCards.slice(0, 2)) {
    const label =
      card.key === 'hybrid_search'
        ? 'Tighten search routing quality'
        : card.key === 'routing_balance'
          ? 'Re-check routing balance after recent changes'
          : `Improve ${String(card.key || 'system quality').replace(/_/g, ' ')}`;
    priorityLines.push(
      `${priorityLines.length + 1}. ${label} - ${inferPriorityLabel(card.status, card.score)} impact.\n- ${String(card.focus || card.summary || '').trim()}`,
    );
  }

  const retrievalEngines =
    retrieval.engines && typeof retrieval.engines === 'object' ? retrieval.engines : {};
  const pythonMetrics =
    retrievalEngines.python && typeof retrievalEngines.python === 'object'
      ? retrievalEngines.python
      : {};
  const jsMetrics =
    retrievalEngines.js && typeof retrievalEngines.js === 'object' ? retrievalEngines.js : {};
  const pythonAvg = Number(pythonMetrics.average_duration_ms || 0);
  const jsAvg = Number(jsMetrics.average_duration_ms || 0);
  if (pythonAvg > 0 && jsAvg > 0 && pythonAvg > jsAvg * 1.5) {
    priorityLines.push(
      `${priorityLines.length + 1}. Reduce Python retrieval latency - Medium impact.\n- Retrieval quality is green, but Python is still slower than JS (${pythonAvg.toFixed(1)} ms vs ${jsAvg.toFixed(1)} ms).`,
    );
  }

  const serviceCorpus =
    stack.service_corpus && typeof stack.service_corpus === 'object' ? stack.service_corpus : {};
  const weaviate = stack.weaviate && typeof stack.weaviate === 'object' ? stack.weaviate : {};
  const transition =
    stack.transition && typeof stack.transition === 'object' ? stack.transition : {};
  const transitionSummary =
    transition.summary && typeof transition.summary === 'object' ? transition.summary : {};

  if (!priorityLines.length) {
    priorityLines.push('1. No major improvement blockers are active in the latest saved reports.');
  }

  return [
    'Top improvement priorities right now:',
    '',
    ...priorityLines,
    '',
    'Current health context:',
    `- Stack: ${String(stack.overall || 'unknown')}`,
    `- Weaviate: ${String(weaviate.status || 'unknown')}`,
    `- Service corpus: ${String(serviceCorpus.sync || 'unknown')} (${Number(serviceCorpus.count || 0)} records)`,
    `- Transition guardrails: ${String(transition.overall || 'unknown')} (${Number(transitionSummary.passed || 0)}/${Number(transitionSummary.total || 0)})`,
    '',
    'Bottom line:',
    'The biggest practical priority is still routing quality. Performance and operator visibility are secondary unless one of the saved checks turns red.',
  ]
    .join('\n')
    .trim();
}

async function buildStreetBotEvaluationFastPathResponse(detectedIntent) {
  const kind = String(detectedIntent?.evaluationArgs?.kind || '').trim();
  if (kind === 'improvement_snapshot') {
    return buildStreetBotImprovementFastPathResponse();
  }
  if (kind === 'stack_status') {
    return buildStreetBotStackStatusFastPathResponse();
  }
  return '';
}

function buildInformationalServiceResponse(value) {
  if (!looksLikeInformationalServiceQuestion(value)) {
    return null;
  }

  const subject = extractInformationalServiceSubject(value);
  const normalizedSubject = normalizeText(subject);

  if (
    normalizedSubject.includes('food bank') ||
    normalizedSubject.includes('food') ||
    normalizedSubject.includes('grocery') ||
    normalizedSubject.includes('meal')
  ) {
    return 'A food bank is a community service that provides free food, groceries, or meal support to people who need help with food access. If you want, I can also look up food banks near you.';
  }

  if (normalizedSubject.includes('shelter') || normalizedSubject.includes('housing')) {
    return 'A shelter or housing support service helps people find safer short-term or longer-term places to stay, plus related supports like referrals, meals, or case help. If you want, I can look up options near you.';
  }

  if (
    normalizedSubject.includes('legal') ||
    normalizedSubject.includes('clinic') ||
    normalizedSubject.includes('doctor') ||
    normalizedSubject.includes('medical') ||
    normalizedSubject.includes('health')
  ) {
    return `A ${subject} is a support service people use when they need practical help, advice, or care from a community or professional provider. If you want, I can look up matching services near you.`;
  }

  return `A ${subject} is a community support service or resource people can use when they need help. If you want, I can also look up matching services near you.`;
}

function countTokens(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function looksLikeServiceMetaConversation(value) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }

  if (matchesAny(text, SERVICE_META_CONVERSATION_PATTERNS)) {
    return true;
  }

  const normalized = normalizeText(text);
  if (!/\b(i|me|my)\b/i.test(normalized)) {
    return false;
  }

  const mentionsServiceSpace =
    /\b(service|services|resource|resources|support|supports|program|programs|referral|referrals)\b/i.test(
      normalized,
    );
  const mentionsSearchHistory =
    /\b(search(?:ed|ing)?|look(?:ed|ing)?\s+for|ask(?:ed|ing)?\s+about|need(?:ed)?|want(?:ed)?)\b/i.test(
      normalized,
    );
  const hasReflectiveFrame =
    /\b(know|remember|recall|history|usually|normally|tend)\b/i.test(normalized) ||
    /\bwhat (?:have|did) i\b/i.test(normalized) ||
    /\bwhat do you know about\b/i.test(normalized);

  return hasReflectiveFrame && (mentionsServiceSpace || mentionsSearchHistory);
}

function hasActiveServiceContext(serviceContext = {}) {
  return Boolean(serviceContext?.session_id || serviceContext?.query);
}

function looksLikeConversationalAcknowledgment(value, serviceContext = {}) {
  const text = String(value || '').trim();
  const normalized = normalizeText(text);
  if (!normalized) {
    return false;
  }
  if (
    matchesAny(text, MORE_PATTERNS) ||
    matchesAny(text, CATEGORY_PATTERNS) ||
    matchesAny(text, FINDER_PATTERNS) ||
    matchesAny(text, EMOTIONAL_PATTERNS)
  ) {
    return false;
  }
  if (looksLikeBotDirectedTopicChat(text) || looksLikeInformationalServiceQuestion(text)) {
    return false;
  }
  if (hasActiveServiceContext(serviceContext) && looksLikeServiceRefinement(text, serviceContext)) {
    return false;
  }
  if (looksLikeStreetBotServiceRequest(text)) {
    return false;
  }
  if (matchesAny(text, ACKNOWLEDGMENT_PATTERNS)) {
    return true;
  }

  const words = normalized
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length || words.length > 5) {
    return false;
  }

  return words.every((word) => ACKNOWLEDGMENT_FILLER_WORDS.has(word));
}

function buildAcknowledgmentResponse(serviceContext = {}) {
  if (hasActiveServiceContext(serviceContext)) {
    return 'Got it. What do you want to do next?';
  }
  return "Got it. I'm here if you want to keep talking.";
}

function buildRelationalResponse() {
  return "Thank you. I'm glad that helped. What do you want to do next?";
}

function buildPlayfulResponse() {
  return "I'm glad that landed. What do you want to do next?";
}

function buildServiceMetaConversationResponse(serviceContext = {}) {
  const scope = inferServiceContextScopeLabel(serviceContext);
  if (hasActiveServiceContext(serviceContext) && scope && scope !== 'that search') {
    return `From this chat so far, you've asked me about ${scope}. If you want, I can keep talking about that or help with something different.`;
  }
  return "Not really yet. In this chat, I only know the service topics you've asked me about directly. If you want, I can tell you what I remember or help with something new.";
}

function inferServiceContextTopicLabel(serviceContext = {}) {
  const query = String(serviceContext.query || '').trim();
  if (query) {
    return query;
  }
  if (Array.isArray(serviceContext.categories) && serviceContext.categories.length > 0) {
    return String(serviceContext.categories[0] || '')
      .trim()
      .toLowerCase();
  }
  if (serviceContext.service_type) {
    return String(serviceContext.service_type).trim().toLowerCase();
  }
  return 'services';
}

function inferServiceContextScopeLabel(serviceContext = {}) {
  const topic = inferServiceContextTopicLabel(serviceContext);
  const location = [serviceContext.city, serviceContext.province].filter(Boolean).join(', ');
  if (topic && location) {
    return `${topic} in ${location}`;
  }
  return topic || location || 'that search';
}

function looksLikeServiceFeedback(value, rawContext = null) {
  const text = String(value || '').trim();
  const serviceContext = getServiceContext(rawContext);
  if (!text || !hasActiveServiceContext(serviceContext)) {
    return false;
  }
  if (matchesAny(text, MORE_PATTERNS) || matchesAny(text, CATEGORY_PATTERNS)) {
    return false;
  }
  if (matchesAny(text, SERVICE_FEEDBACK_PATTERNS)) {
    return true;
  }

  const normalized = normalizeText(text);
  if (
    /\b(only|just)\s+(one|1|two|2|three|3)\b/i.test(normalized) &&
    /\b(result|results|service|services|option|options|match|matches|card|cards)\b/i.test(
      normalized,
    )
  ) {
    return true;
  }

  return false;
}

function buildServiceFeedbackResponse(serviceContext = {}) {
  const returnedCount = Number(serviceContext.returned_count || 0) || 0;
  const totalCount = Number(serviceContext.count || 0) || 0;
  const scope = inferServiceContextScopeLabel(serviceContext);

  if (
    serviceContext.has_more ||
    (totalCount > 0 && returnedCount > 0 && totalCount > returnedCount)
  ) {
    return `You're right. I only showed ${returnedCount} so far for ${scope}. I can show more now, narrow it differently, or switch cities if you want.`;
  }

  if (returnedCount <= 1) {
    return `You're right. That search only surfaced ${returnedCount || 1} strong match${returnedCount === 1 || returnedCount === 0 ? '' : 'es'} for ${scope}. I can widen the area, broaden the search, or look in a different city if you want.`;
  }

  return `You're right. That search only surfaced ${returnedCount} matches for ${scope}. I can widen the area, broaden the category, or try a different city if you want.`;
}

function stripRefinementPhrases(value) {
  let text = String(value || '').trim();
  if (!text) {
    return '';
  }

  text = text
    .replace(/^\s*(what about|how about)\s+/i, '')
    .replace(/^\s*(show|give|list|find)\s+me\s+/i, '')
    .replace(/^\s*(show|give|list|find)\s+/i, '')
    .replace(/^\s*make it\s+/i, '')
    .replace(/\s+\bplease\b/gi, '')
    .replace(/\s+\binstead\b/gi, '')
    .replace(/\s+\bonly\b/gi, '')
    .trim();

  return text;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripLocationFromQuery(value, serviceContext) {
  let text = String(value || '').trim();
  const locations = [serviceContext?.city, serviceContext?.province].filter(Boolean);
  if (!text || !locations.length) {
    return text;
  }

  for (const location of locations) {
    const escaped = escapeRegExp(location);
    text = text.replace(new RegExp(`\\bin\\s+${escaped}\\b`, 'ig'), ' ');
    text = text.replace(new RegExp(`\\b${escaped}\\b`, 'ig'), ' ');
  }

  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();
}

function refinementMentionsLocation(value, serviceContext) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }

  return [serviceContext?.city, serviceContext?.province]
    .filter(Boolean)
    .some((location) => normalized.includes(normalizeText(location)));
}

function buildRefinementQuery(cleanedText, serviceContext, candidateArgs, filterOnly) {
  const previousQuery = String(serviceContext?.query || '').trim();
  const refinedText = String(cleanedText || '').trim();
  const locationChanged = Boolean(
    (candidateArgs.city &&
      normalizeText(candidateArgs.city) !== normalizeText(serviceContext?.city)) ||
      (candidateArgs.province &&
        normalizeText(candidateArgs.province) !== normalizeText(serviceContext?.province)),
  );

  if (filterOnly) {
    const base = locationChanged
      ? stripLocationFromQuery(previousQuery, serviceContext)
      : previousQuery;
    return base || previousQuery || refinedText;
  }

  if (!refinedText) {
    return previousQuery;
  }

  const needsLocationHint =
    !candidateArgs.city &&
    !candidateArgs.province &&
    !refinementMentionsLocation(refinedText, serviceContext) &&
    (serviceContext?.city || serviceContext?.province);

  if (!needsLocationHint) {
    return refinedText;
  }

  return [refinedText, serviceContext.city, serviceContext.province]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function extractNamedServiceDetailSubject(value) {
  return String(value || '')
    .trim()
    .replace(/^\s*(tell me more about|more about)\s+/i, '')
    .replace(
      /^\s*(open|visit|show|preview|navigate to|pull up|bring up)\s+(?:the\s+)?(?:application\s+)?(?:form|website|site|page)\s+(?:for\s+)?/i,
      '',
    )
    .replace(
      /\b(hours|eligibility|contact|phone|email|website|program details?|application details?|application|form|page|site)\b/gi,
      ' ',
    )
    .replace(/[!?.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeNamedServiceDetailRequest(value) {
  const text = String(value || '').trim();
  if (!text || !matchesAny(text, NAMED_SERVICE_DETAIL_PATTERNS)) {
    return false;
  }
  if (
    looksLikeStreetBotEvaluationConversation(text) ||
    looksLikeInformationalServiceQuestion(text)
  ) {
    return false;
  }

  const subject = extractNamedServiceDetailSubject(text);
  const normalizedSubject = normalizeText(subject);
  if (!normalizedSubject) {
    return false;
  }

  const meaningfulTokens = normalizedSubject
    .split(/[^a-z0-9'’&.-]+/i)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !NAMED_SERVICE_DETAIL_STOPWORDS.has(token))
    .filter((token) => !GENERIC_SERVICE_BROWSE_WORDS.has(token))
    .filter((token) => !SERVICE_KEYWORDS.includes(token));

  return TITLECASE_SERVICE_NAME_PATTERN.test(text) || meaningfulTokens.length >= 2;
}

function looksLikeStreetBotServiceRequest(value) {
  const text = normalizeText(value);
  if (!text || text.startsWith('/')) {
    return false;
  }
  if (text.includes('streetbot-service-results')) {
    return false;
  }
  if (looksLikeNamedServiceDetailRequest(value)) {
    return false;
  }
  if (looksLikeBotDirectedTopicChat(text) && !matchesAny(text, FINDER_PATTERNS)) {
    return false;
  }
  if (looksLikeServiceMetaConversation(text)) {
    return false;
  }
  if (looksLikeStreetBotEvaluationConversation(text)) {
    return false;
  }
  if (looksLikeInformationalServiceQuestion(text)) {
    return false;
  }

  const hasFinderLanguage = matchesAny(text, FINDER_PATTERNS);
  if (hasFinderLanguage && GENERIC_PROVIDER_PLACE_PATTERN.test(text)) {
    return true;
  }

  const matchedKeywords = getMatchedKeywords(text, SERVICE_KEYWORDS);
  if (!matchedKeywords.length) {
    return false;
  }

  const tokenCount = text.split(/\s+/).filter(Boolean).length;
  const looksCompact = tokenCount <= 10;
  const hasConversationalOnlyKeywords = matchedKeywords.every((keyword) =>
    CONVERSATIONAL_SERVICE_KEYWORDS.has(keyword),
  );
  if (hasConversationalOnlyKeywords) {
    return false;
  }

  const hasConcreteKeyword = matchedKeywords.some(
    (keyword) =>
      !CONVERSATIONAL_SERVICE_KEYWORDS.has(keyword) && !FINDER_ONLY_SERVICE_KEYWORDS.has(keyword),
  );
  if (hasConcreteKeyword) {
    return hasFinderLanguage || looksCompact;
  }

  return hasFinderLanguage;
}

function hasServiceRefinementSignal(value) {
  const text = normalizeText(value);
  const cleaned = normalizeText(stripRefinementPhrases(value))
    .replace(/[!?.,;:]+/g, ' ')
    .trim();
  const candidate = cleaned || text;
  if (!text) {
    return false;
  }

  if (matchesAny(text, REFINEMENT_CONTEXT_ONLY_PATTERNS)) {
    return true;
  }
  if (hasExplicitResultLimit(text) || hasExplicitResultLimit(candidate)) {
    return true;
  }
  if (textContainsAny(candidate, SERVICE_KEYWORDS)) {
    return true;
  }
  if (inferExplicitBrowseLocationLabel(text) || inferExplicitBrowseLocationLabel(candidate)) {
    return true;
  }
  if (matchesAny(text, SERVICE_REFINEMENT_GEO_PATTERNS)) {
    return true;
  }
  if (matchesAny(candidate, SERVICE_REFINEMENT_FILTER_PATTERNS)) {
    return true;
  }

  return false;
}

function looksLikeServiceRefinement(value, rawContext = null) {
  const text = normalizeText(value);
  const serviceContext = getServiceContext(rawContext);
  if (!text || text.startsWith('/')) {
    return false;
  }
  if (!serviceContext.session_id && !serviceContext.query) {
    return false;
  }
  if (
    matchesAny(text, MORE_PATTERNS) ||
    matchesAny(text, CATEGORY_PATTERNS) ||
    matchesAny(text, EMOTIONAL_PATTERNS)
  ) {
    return false;
  }
  if (matchesAny(text, REFINEMENT_PATTERNS)) {
    return hasServiceRefinementSignal(text);
  }
  if (
    countTokens(text) <= 6 &&
    (hasExplicitResultLimit(text) || textContainsAny(text, SERVICE_KEYWORDS))
  ) {
    return true;
  }
  return false;
}

function stripBroadServiceBrowseQuery(value) {
  let text = normalizeText(value)
    .replace(/[!?.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return '';
  }

  for (const word of GENERIC_SERVICE_BROWSE_WORDS) {
    text = text.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, 'ig'), ' ');
  }

  for (const [word] of BROWSE_LOCATION_LABELS) {
    text = text.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, 'ig'), ' ');
  }

  return text.replace(/\s+/g, ' ').trim();
}

function looksLikeBroadServiceBrowseRequest(value, candidateArgs = null) {
  const normalized = normalizeText(value);
  if (!normalized || !looksLikeStreetBotServiceRequest(normalized)) {
    return false;
  }
  if (matchesAny(normalized, MORE_PATTERNS) || matchesAny(normalized, EMOTIONAL_PATTERNS)) {
    return false;
  }

  const hasSpecificFilters = Boolean(
    candidateArgs &&
      (candidateArgs.service_type ||
        candidateArgs.ages_served ||
        candidateArgs.gender_served ||
        (Array.isArray(candidateArgs.categories) && candidateArgs.categories.length > 0) ||
        (Array.isArray(candidateArgs.tags) && candidateArgs.tags.length > 0)),
  );
  if (hasSpecificFilters) {
    return false;
  }

  return stripBroadServiceBrowseQuery(value).length === 0;
}

async function getRagModule() {
  if (!ragModulePromise) {
    const moduleCandidates = [
      process.env.STREETBOT_RAG_MCP_MODULE_PATH,
      process.env.STREETBOT_RAG_MCP_MODULE,
      '/app/tools/streetbot-rag-mcp.mjs',
      path.join(__dirname, 'streetbot-rag-mcp.mjs'),
    ].filter(Boolean);
    const modulePath =
      moduleCandidates.find((candidate) => {
        try {
          return fs.existsSync(candidate);
        } catch (_) {
          return false;
        }
      }) || path.join(__dirname, 'streetbot-rag-mcp.mjs');
    ragModulePromise = import(pathToFileURL(modulePath).href);
  }
  return ragModulePromise;
}

function getServiceContext(rawContext) {
  if (!rawContext || typeof rawContext !== 'object') {
    return {};
  }
  return {
    session_id: String(rawContext.session_id || '').trim(),
    has_more: Boolean(rawContext.has_more),
    query: String(rawContext.query || '').trim(),
    count: Number.isFinite(Number(rawContext.count)) ? Number(rawContext.count) : null,
    returned_count: Number.isFinite(Number(rawContext.returned_count))
      ? Number(rawContext.returned_count)
      : null,
    offset: Number.isFinite(Number(rawContext.offset)) ? Number(rawContext.offset) : 0,
    city: String(rawContext.city || '').trim(),
    province: String(rawContext.province || '').trim(),
    service_type: String(rawContext.service_type || '').trim(),
    categories: toStringList(rawContext.categories),
    tags: toStringList(rawContext.tags),
    ages_served: String(rawContext.ages_served || '').trim(),
    gender_served: String(rawContext.gender_served || '').trim(),
    active_only: typeof rawContext.active_only === 'boolean' ? rawContext.active_only : true,
  };
}

function detectSmalltalkResponse(value, options = {}) {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }
  const normalized = normalizeText(text);
  const serviceContext = getServiceContext(options.serviceContext);
  const preferenceSubject = extractPreferenceSubject(text);

  if (matchesAny(text, GREETING_PATTERNS)) {
    return {
      text: 'Street Bot here. How can I help?',
      kind: 'greeting',
    };
  }
  if (matchesAny(text, IDENTITY_PATTERNS)) {
    return {
      text: "I'm Street Bot. I'm here to listen, support, and help connect you to services when you need them. What's on your mind?",
      kind: 'identity',
    };
  }
  if (matchesAny(text, CHECKIN_PATTERNS)) {
    return {
      text: "Pretty steady. I've been helping people find support, answer questions, and keep things moving. How's your day going?",
      kind: 'checkin',
    };
  }
  if (preferenceSubject) {
    if (
      preferenceSubject.includes('food') ||
      preferenceSubject.includes('meal') ||
      preferenceSubject.includes('snack') ||
      preferenceSubject.includes('dish')
    ) {
      return {
        text: "I don't eat, but warm comfort food feels like the right answer. What about you?",
        kind: 'preference',
      };
    }
    return {
      text: "I don't really have personal favorites the way people do, but I can still chat with you about it. What's yours?",
      kind: 'preference',
    };
  }
  const informationalServiceResponse = buildInformationalServiceResponse(text);
  if (informationalServiceResponse) {
    return {
      text: informationalServiceResponse,
      kind: 'informational_service',
    };
  }
  const topicChatResponse = buildBotDirectedTopicChatResponse(text);
  if (topicChatResponse) {
    return {
      text: topicChatResponse,
      kind: 'topic_chat',
    };
  }
  if (matchesAny(text, THANKS_PATTERNS)) {
    return {
      text: hasActiveServiceContext(serviceContext)
        ? 'Glad that helped. What do you want to do next?'
        : 'Anytime. What do you want to do next?',
      kind: 'thanks',
    };
  }
  if (looksLikeRelationalTurn(text)) {
    return {
      text: buildRelationalResponse(),
      kind: 'relational',
    };
  }
  if (looksLikePlayfulSocialTurn(text)) {
    return {
      text: buildPlayfulResponse(),
      kind: 'playful',
    };
  }
  if (matchesAny(text, FAREWELL_PATTERNS)) {
    return {
      text: 'Talk soon.',
      kind: 'farewell',
    };
  }
  if (looksLikeConversationalAcknowledgment(text, serviceContext)) {
    return {
      text: buildAcknowledgmentResponse(serviceContext),
      kind: hasActiveServiceContext(serviceContext) ? 'service_acknowledgment' : 'acknowledgment',
    };
  }
  if (
    countTokens(text) <= 30 &&
    matchesAny(text, SUPPORT_PATTERNS) &&
    !looksLikeStreetBotServiceRequest(text)
  ) {
    if (normalized.includes('anx')) {
      return {
        text: 'I hear you. Try one slow reset with me: unclench your jaw, drop your shoulders, and take one long breath out. If you want, we can slow this down together.',
        kind: 'support',
      };
    }
    if (
      normalized.includes("thoughts won't slow down") ||
      normalized.includes('thoughts wont slow down') ||
      normalized.includes("mind won't slow down") ||
      normalized.includes('mind wont slow down') ||
      normalized.includes('quiet down') ||
      normalized.includes('restless') ||
      normalized.includes('racing thoughts') ||
      normalized.includes('spiral')
    ) {
      return {
        text: 'I hear you. Try this now: plant both feet on the floor, do one long exhale, and name 3 things you can see. If you want, I can stay with you and help slow it down one step at a time.',
        kind: 'support',
      };
    }
    if (
      normalized.includes('sad') ||
      normalized.includes('down') ||
      normalized.includes('lonely')
    ) {
      return {
        text: "I'm here with you. One gentle step right now is to do one grounding thing in the room around you, then tell me what feels heaviest if you want to keep talking.",
        kind: 'support',
      };
    }
    return {
      text: 'I hear you. Pick one tiny next step: drink some water, sit down, and take one slow breath. If you want, we can break things down together.',
      kind: 'support',
    };
  }
  if (countTokens(text) <= 18 && matchesAny(text, WELLNESS_TIP_PATTERNS)) {
    return {
      text: 'Try one 60-second reset: put both feet on the floor, take one long slow exhale, and name 3 things you can see. If you want, I can give you a version for anxiety, exhaustion, or sleep.',
      kind: 'wellness_tip',
    };
  }
  if (matchesAny(text, JOKE_PATTERNS)) {
    if (
      normalized.includes('toronto transit') ||
      normalized.includes('ttc') ||
      normalized.includes('streetcar') ||
      normalized.includes('subway')
    ) {
      return {
        text: 'Sure. Why did the Toronto streetcar get a promotion? Because it really knew how to stay on track.',
        kind: 'joke',
      };
    }
    return {
      text: 'Sure. Why did the community centre start telling jokes? Because everyone needed a little support group.',
      kind: 'joke',
    };
  }

  return null;
}

function buildStreetBotGeneralFallback(userText = '', error = null) {
  const text = String(userText || '').trim();
  if (!text) {
    return "I'm Street Bot. I'm here to listen, support, and help connect you to services when you need them.";
  }

  const smalltalkResponse = detectSmalltalkResponse(text);
  if (smalltalkResponse?.text) {
    return smalltalkResponse.text;
  }

  if (
    /\bcapital\b/i.test(text) &&
    /\b(congo|drc|democratic republic of congo|republic of the congo)\b/i.test(text)
  ) {
    return 'If you mean the Republic of the Congo, the capital is Brazzaville. If you mean the Democratic Republic of the Congo, the capital is Kinshasa.';
  }

  if (/\b(how are you|how are you doing|how(?:'s| is| was) your day|hows your day)\b/i.test(text)) {
    return "Pretty steady. I've been helping people find support, answer questions, and keep things moving. How's your day going?";
  }

  if (/^\s*(what|who|where|when|why|how)\b/i.test(text)) {
    return "I can help think that through. Tell me the angle you care about, and I'll keep it clear and practical.";
  }

  logger.warn('[streetbot-fastpath] using general fallback after model failure', {
    error: error?.message || String(error || ''),
  });
  return "I'm here with you. We can talk it through, or I can help you look for shelter, food, legal, health, or other support services.";
}

function buildSelectedAgentCapabilitySentence(agentProfile) {
  return `I can have normal conversation, and when you ask me to find, show, list, count, or return results, I can pull ${agentProfile.cardLabel} from ${agentProfile.source}.`;
}

function normalizeSelectedAgentTextSegment(agentProfile, value) {
  const text = String(value || '');
  return text
    .replace(/\bStreet\s*Bot\s*0\.1(?:\s*Pro)?\b/gi, agentProfile.label)
    .replace(/\bStreet\s*Bot(?:\s*Pro)?\b/gi, agentProfile.label)
    .replace(/\bStreetBot\b/g, agentProfile.label)
    .replace(/\bStreetbot\b/g, agentProfile.label)
    .replace(/\bgrant[_\s-]*researcher[_\s-]*agent\b/gi, 'Grant Researcher Agent')
    .replace(/\bgrant[_\s-]*writer\b/gi, 'Grant Writer Agent')
    .replace(/\bbudget[_\s-]*agent\b/gi, 'Budget Agent')
    .replace(/\bproject[_\s-]*plan[_\s-]*agent\b/gi, 'Project Plan Agent')
    .replace(new RegExp(`${escapeRegExp(agentProfile.label)}\\s+here\\s+here`, 'gi'), `${agentProfile.label} here`);
}

function normalizeSelectedAgentResponseText(req, value) {
  const agentProfile = getSelectedConversationAgentProfile(req);
  const text = String(value || '').trim();
  if (!agentProfile || !text) {
    return text;
  }
  return text
    .split(/(```[\s\S]*?```)/g)
    .map((segment) =>
      segment.startsWith('```') ? segment : normalizeSelectedAgentTextSegment(agentProfile, segment),
    )
    .join('')
    .trim();
}

function sanitizeSelectedAgentAssistantHistoryText(value, agentProfile = null) {
  const text = sanitizeStreetBotConversationHistoryText(value);
  if (!agentProfile) {
    return text;
  }
  return normalizeSelectedAgentTextSegment(agentProfile, text);
}

function buildSelectedAgentGeneralFallback(req, userText = '', error = null) {
  const agentProfile = getSelectedConversationAgentProfile(req);
  if (!agentProfile) {
    return buildStreetBotGeneralFallback(userText, error);
  }

  const text = String(userText || '').trim();
  const normalized = normalizeText(text);
  const capability = buildSelectedAgentCapabilitySentence(agentProfile);
  if (!normalized) {
    return `I'm ${agentProfile.label}. ${capability}`;
  }

  if (matchesAny(text, GREETING_PATTERNS)) {
    return `${agentProfile.label} here. What do you want to work through? ${capability}`;
  }
  if (
    matchesAny(text, IDENTITY_PATTERNS) ||
    /\b(what\s+are\s+you\s+good\s+for|what\s+can\s+you\s+do|what\s+do\s+you\s+do|help\s+me\s+with)\b/i.test(
      normalized,
    )
  ) {
    return `I'm ${agentProfile.label}. I ${agentProfile.purpose}. You can talk to me normally, ask strategy questions, or ask me to return the actual ${agentProfile.source} UI when you want live results.`;
  }
  if (matchesAny(text, CHECKIN_PATTERNS)) {
    return `I'm steady and ready. We can chat, plan, or pull the relevant ${agentProfile.source} results when you need them.`;
  }
  if (matchesAny(text, THANKS_PATTERNS)) {
    return `Anytime. I'm still here as ${agentProfile.label} when you want to keep going.`;
  }
  if (
    /\bcapital\b/i.test(text) &&
    /\b(congo|drc|democratic republic of congo|republic of the congo)\b/i.test(text)
  ) {
    return 'If you mean the Republic of the Congo, the capital is Brazzaville. If you mean the Democratic Republic of the Congo, the capital is Kinshasa.';
  }
  if (looksLikeRelationalTurn(text)) {
    return `I hear you. ${agentProfile.label} can stay with the conversation, not just pull data. Tell me what part matters most and we’ll work through it.`;
  }
  if (matchesAny(text, SUPPORT_PATTERNS) && !looksLikeStreetProfileAgentResultsRequest(agentProfile.id, text)) {
    return 'I hear you. Let’s slow it down to one next step: say what feels most urgent, and I’ll help you sort it without rushing.';
  }
  if (/^\s*(what|who|where|when|why|how)\b/i.test(text)) {
    return `I'm ${agentProfile.label}. I can chat normally and help think that through in plain language. Give me the context you care about, and I’ll answer directly; when you want live results, ask me to show ${agentProfile.cardLabel}.`;
  }

  logger.warn('[streetbot-fastpath] using selected-agent fallback after model failure', {
    selectedAgent: agentProfile.id,
    error: error?.message || String(error || ''),
  });
  return `${agentProfile.label} here. I can talk this through with you in plain language, and I can return actual ${agentProfile.cardLabel} from ${agentProfile.source} when you ask for results.`;
}

function buildStreetBotConversationIntentResult(normalized, options = {}) {
  return {
    normalized,
    fastPath: false,
    toolBase: 'conversation',
    isEmotional: Boolean(options.isEmotional),
    ...(options.smalltalkKind ? { smalltalkKind: options.smalltalkKind } : {}),
  };
}

function buildStreetBotSmalltalkIntentResult(normalized, smalltalkResponse) {
  return {
    normalized,
    fastPath: true,
    toolBase: 'smalltalk',
    isEmotional: false,
    responseText: smalltalkResponse.text,
    smalltalkKind: smalltalkResponse.kind || 'conversation',
  };
}

async function buildStreetBotServiceIntentResult(
  userText,
  normalized,
  userContext,
  isEmotional = false,
) {
  const { buildSearchArgsFromUserText } = await getRagModule();
  const searchArgs = applyStreetBotUserContextToSearchArgs(
    buildSearchArgsFromUserText(userText),
    userContext,
  );

  if (looksLikeBroadServiceBrowseRequest(userText, searchArgs)) {
    if (canDirectSearchBroadBrowse(userText, searchArgs)) {
      return {
        normalized,
        fastPath: true,
        toolBase: 'services_search',
        isEmotional,
        searchArgs: applyStreetBotUserContextToSearchArgs(
          buildDirectBrowseSearchArgs(userText, searchArgs),
          userContext,
        ),
      };
    }

    return {
      normalized,
      fastPath: true,
      toolBase: 'services_categories',
      isEmotional,
      categoryArgs: applyStreetBotUserContextToSearchArgs(
        {
          limit: 8,
          active_only: true,
        },
        userContext,
      ),
    };
  }

  return {
    normalized,
    fastPath: true,
    toolBase: 'services_search',
    isEmotional,
    searchArgs,
  };
}

async function detectStreetBotIntent(userText, rawContext = null, rawUserContext = null) {
  const normalized = normalizeText(userText);
  const serviceContext = getServiceContext(rawContext);
  const userContext = getStreetBotUserContext(rawUserContext);
  if (!normalized) {
    return { normalized, fastPath: false, toolBase: null, isEmotional: false };
  }

  return withStreetBotSpan(
    'streetbot.intent.detect',
    {
      observation: {
        input: summarizeStreetBotText(userText),
        metadata: {
          hasServiceContext: Boolean(serviceContext.session_id),
          hasContextQuery: Boolean(serviceContext.query),
          hasMoreContext: Boolean(serviceContext.has_more),
          hasUserLocation: hasStreetBotPreferredLocation(userContext),
        },
      },
      attributes: {
        'streetbot.intent.service_context': Boolean(serviceContext.session_id),
        'streetbot.intent.context_has_more': Boolean(serviceContext.has_more),
        'streetbot.intent.user_location': hasStreetBotPreferredLocation(userContext),
      },
    },
    async (span) => {
      let result;

      if (matchesAny(normalized, EMOTIONAL_PATTERNS)) {
        if (looksLikeStreetBotServiceRequest(userText)) {
          result = await buildStreetBotServiceIntentResult(userText, normalized, userContext, true);
        } else {
          result = buildStreetBotConversationIntentResult(normalized, { isEmotional: true });
        }
      } else if (looksLikeStreetBotEvaluationConversation(userText)) {
        result = buildStreetBotConversationIntentResult(normalized);
      } else if (looksLikeServiceMetaConversation(userText)) {
        result = buildStreetBotConversationIntentResult(normalized, {
          smalltalkKind: 'service_meta',
        });
      } else if (looksLikeNamedServiceDetailRequest(userText)) {
        result = {
          normalized,
          fastPath: true,
          toolBase: 'conversation',
          isEmotional: false,
        };
      } else if (matchesAny(normalized, MORE_PATTERNS)) {
        if (!serviceContext.session_id && !serviceContext.query) {
          result = buildStreetBotConversationIntentResult(normalized);
        } else {
          const { buildSearchArgsFromUserText } = await getRagModule();
          const explicitLimit = hasExplicitResultLimit(userText)
            ? buildSearchArgsFromUserText(userText).limit
            : null;
          const nextOffset = Math.max(
            0,
            Number(serviceContext.offset || 0) + Number(serviceContext.returned_count || 0),
          );
          const baseQuery = serviceContext.query || userText;
          const fallbackSearchArgs = buildSearchArgsFromUserText(baseQuery, {
            query: baseQuery,
            offset: nextOffset,
            city: serviceContext.city,
            province: serviceContext.province,
            service_type: serviceContext.service_type,
            categories: serviceContext.categories,
            tags: serviceContext.tags,
            ages_served: serviceContext.ages_served,
            gender_served: serviceContext.gender_served,
            active_only: serviceContext.active_only,
            ...(explicitLimit ? { limit: explicitLimit } : {}),
          });
          const hydratedFallbackSearchArgs = applyStreetBotUserContextToSearchArgs(
            fallbackSearchArgs,
            userContext,
          );
          result = {
            normalized,
            fastPath: true,
            toolBase: 'services_more',
            isEmotional: false,
            moreArgs: {
              session_id: serviceContext.session_id,
              limit: explicitLimit,
              fallback_search_args: hydratedFallbackSearchArgs,
            },
          };
        }
      } else if (matchesAny(normalized, CATEGORY_PATTERNS)) {
        result = {
          normalized,
          fastPath: true,
          toolBase: 'services_categories',
          isEmotional: false,
          categoryArgs: applyStreetBotUserContextToSearchArgs(
            {
              limit: 8,
              active_only: true,
            },
            userContext,
          ),
        };
      } else if (looksLikeServiceFeedback(userText, serviceContext)) {
        result = buildStreetBotConversationIntentResult(normalized, {
          smalltalkKind: 'service_feedback',
        });
      } else if (looksLikeServiceRefinement(userText, serviceContext)) {
        const { buildSearchArgsFromUserText } = await getRagModule();
        const cleanedText = stripRefinementPhrases(userText);
        const candidateArgs = buildSearchArgsFromUserText(cleanedText || userText);
        const requestedLimit = extractRequestedLimit(userText, true);
        const querySignal =
          candidateArgs.categories.length > 0 ||
          candidateArgs.tags.length > 0 ||
          textContainsAny(normalized, SERVICE_KEYWORDS);
        const filterOnly =
          !querySignal &&
          Boolean(
            candidateArgs.city ||
              candidateArgs.province ||
              candidateArgs.service_type ||
              candidateArgs.ages_served ||
              candidateArgs.gender_served ||
              requestedLimit != null,
          );

        const baseQuery = buildRefinementQuery(
          cleanedText || userText,
          serviceContext,
          candidateArgs,
          filterOnly,
        );

        const refinedArgs = buildSearchArgsFromUserText(baseQuery, {
          query: baseQuery,
          limit: requestedLimit != null ? requestedLimit : undefined,
          offset: 0,
          city: candidateArgs.city || serviceContext.city,
          province: candidateArgs.province || serviceContext.province,
          service_type: filterOnly
            ? candidateArgs.service_type || serviceContext.service_type
            : candidateArgs.service_type,
          categories: filterOnly
            ? candidateArgs.categories.length
              ? candidateArgs.categories
              : serviceContext.categories
            : candidateArgs.categories,
          tags: filterOnly
            ? candidateArgs.tags.length
              ? candidateArgs.tags
              : serviceContext.tags
            : candidateArgs.tags,
          ages_served: candidateArgs.ages_served || serviceContext.ages_served,
          gender_served: candidateArgs.gender_served || serviceContext.gender_served,
          active_only: serviceContext.active_only,
        });
        const hydratedRefinedArgs = applyStreetBotUserContextToSearchArgs(refinedArgs, userContext);

        result = {
          normalized,
          fastPath: true,
          toolBase: 'services_search',
          isEmotional: false,
          searchArgs: hydratedRefinedArgs,
        };
      } else {
        const smalltalkResponse = detectSmalltalkResponse(userText, { serviceContext });
        if (smalltalkResponse) {
          result = buildStreetBotSmalltalkIntentResult(normalized, smalltalkResponse);
        } else if (!looksLikeStreetBotServiceRequest(normalized)) {
          result = buildStreetBotConversationIntentResult(normalized);
        } else {
          result = await buildStreetBotServiceIntentResult(
            userText,
            normalized,
            userContext,
            false,
          );
        }
      }

      applyStreetBotSpanAttributes(span, {
        observation: {
          output: {
            fastPath: Boolean(result.fastPath),
            toolBase: result.toolBase || null,
            isEmotional: Boolean(result.isEmotional),
            hasSearchArgs: Boolean(result.searchArgs),
            hasMoreArgs: Boolean(result.moreArgs),
            hasCategoryArgs: Boolean(result.categoryArgs),
            smalltalkKind: result.smalltalkKind || null,
          },
        },
        attributes: {
          'streetbot.intent.fast_path': Boolean(result.fastPath),
          'streetbot.intent.is_emotional': Boolean(result.isEmotional),
          'streetbot.intent.has_search_args': Boolean(result.searchArgs),
          'streetbot.intent.has_more_args': Boolean(result.moreArgs),
          'streetbot.intent.has_category_args': Boolean(result.categoryArgs),
          ...(result.smalltalkKind
            ? { 'streetbot.intent.smalltalk_kind': result.smalltalkKind }
            : {}),
          ...(result.toolBase ? { 'streetbot.intent.tool_base': result.toolBase } : {}),
        },
      });

      return result;
    },
  );
}

function generateTitle(query) {
  if (!query || typeof query !== 'string') {
    return 'New Chat';
  }
  const trimmed = query.trim();
  if (trimmed.length <= 80) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  return `${trimmed.slice(0, 77)}...`;
}

const SERVICE_RESULT_OPTION_HINTS = [
  [
    /\b(housing|shelter|evict(?:ion)?|rent|homeless|rooming|warming (?:centre|center))\b/i,
    'housing support options',
  ],
  [
    /\b(food|hungry|meal|meals|grocery|grocer|food bank|breakfast|lunch|dinner)\b/i,
    'food support options',
  ],
  [
    /\b(doctor|medical|health|clinic|hospital|nurse|mental health|counselling|counseling|therapy)\b/i,
    'health support options',
  ],
  [/\b(legal|lawyer|law|tenant|immigration|rights)\b/i, 'legal support options'],
  [
    /\b(benefit|benefits|odsp|ontario works|income support|income help|income assistance|disability)\b/i,
    'benefits support options',
  ],
  [/\b(job|jobs|work|employment|resume|career)\b/i, 'employment support options'],
  [/\b(newcomer|settlement|refugee|immigrant)\b/i, 'newcomer support options'],
  [/\b(community cent(?:er|re)|drop-?in|program|programs)\b/i, 'community support options'],
];

const SERVICE_RESULT_SUMMARY_LABELS = new Map([
  ['housing', 'housing'],
  ['shelter', 'housing'],
  ['food', 'food'],
  ['health', 'health'],
  ['mental health', 'health'],
  ['legal', 'legal'],
  ['benefits', 'benefits'],
  ['disability', 'benefits'],
  ['employment', 'employment'],
  ['newcomer', 'newcomer'],
  ['community', 'community'],
]);

function inferServiceResultLocationLabel(searchResult = {}) {
  const directLabel = String(
    searchResult?.location_label || searchResult?.locationLabel || '',
  ).trim();
  if (directLabel) {
    return directLabel;
  }

  const directScope = [searchResult?.city, searchResult?.province]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
  if (directScope) {
    return directScope;
  }

  const firstItem = Array.isArray(searchResult?.items) ? searchResult.items.find(Boolean) : null;
  if (!firstItem || typeof firstItem !== 'object') {
    return '';
  }

  const itemLabel = String(firstItem.location_label || firstItem.locationLabel || '').trim();
  if (itemLabel) {
    return itemLabel;
  }

  return [firstItem.city, firstItem.province]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
}

function inferServiceResultOptionLabel(searchResult = {}, userText = '') {
  const multiLabel = inferMultiNeedOptionLabel(searchResult, userText);
  if (multiLabel) {
    return multiLabel;
  }

  const categories = dedupeStrings([
    ...(Array.isArray(searchResult?.categories) ? searchResult.categories : []),
    ...(Array.isArray(searchResult?.categoryNames) ? searchResult.categoryNames : []),
    ...(Array.isArray(searchResult?.items)
      ? searchResult.items.flatMap((item) =>
          Array.isArray(item?.categoryNames) ? item.categoryNames : [],
        )
      : []),
  ]);

  const haystack = normalizeText(
    [
      userText,
      searchResult?.query,
      searchResult?.service_type,
      searchResult?.serviceType,
      categories.join(' '),
    ]
      .filter(Boolean)
      .join(' '),
  );

  const hint = SERVICE_RESULT_OPTION_HINTS.find(([pattern]) => pattern.test(haystack));
  if (hint) {
    return hint[1];
  }

  const fallbackLabel = String(
    searchResult?.service_type || searchResult?.serviceType || categories[0] || '',
  )
    .trim()
    .toLowerCase();

  if (fallbackLabel) {
    return `${fallbackLabel} options`;
  }

  return 'support options';
}

function humanJoin(values = []) {
  const items = values.filter(Boolean);
  if (!items.length) {
    return '';
  }
  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function normalizeServiceNeedFamilyLabel(value = '') {
  const normalized = SERVICE_RESULT_SUMMARY_LABELS.get(normalizeText(value));
  return normalized || normalizeText(value) || '';
}

function extractRenderedNeedGroups(searchResult = {}) {
  const groups = Array.isArray(searchResult?.need_groups)
    ? searchResult.need_groups
    : Array.isArray(searchResult?.needGroups)
      ? searchResult.needGroups
      : [];

  return dedupeStrings(
    groups
      .map((group) => {
        const label = normalizeServiceNeedFamilyLabel(group?.label || group?.id);
        const count = Math.max(
          0,
          Number(
            group?.requested_count ??
              group?.requestedCount ??
              group?.count ??
              (Array.isArray(group?.items) ? group.items.length : 0),
          ) || 0,
        );
        if (!label || count < 1) {
          return '';
        }
        return `${count} ${label} support option${count === 1 ? '' : 's'}`;
      })
      .filter(Boolean),
  ).slice(0, 3);
}

function inferMultiNeedOptionLabel(searchResult = {}, userText = '') {
  const explicitLabels = extractMultiNeedLabelsFromHints(searchResult, userText);
  const summaryLabels = new Set(extractMultiNeedLabelsFromSummary(searchResult));
  const labels = (
    summaryLabels.size ? explicitLabels.filter((label) => summaryLabels.has(label)) : explicitLabels
  ).slice(0, 3);

  if (labels.length < 2) {
    return '';
  }
  return `options across ${humanJoin(labels)} support`;
}

function extractMultiNeedLabelsFromSummary(searchResult = {}) {
  const summary = Array.isArray(searchResult?.need_family_summary)
    ? searchResult.need_family_summary
    : Array.isArray(searchResult?.needFamilySummary)
      ? searchResult.needFamilySummary
      : [];
  return dedupeStrings(
    summary
      .map((entry) => SERVICE_RESULT_SUMMARY_LABELS.get(normalizeText(entry?.label || entry?.id)))
      .filter(Boolean),
  );
}

function extractMultiNeedLabelsFromHints(searchResult = {}, userText = '') {
  const haystack = normalizeText(
    [userText, searchResult?.query, searchResult?.service_type, searchResult?.serviceType]
      .filter(Boolean)
      .join(' '),
  );

  return dedupeStrings(
    SERVICE_RESULT_OPTION_HINTS.filter(([pattern]) => pattern.test(haystack)).map(([, label]) =>
      normalizeText(label).replace(/\s+support options$/, ''),
    ),
  );
}

function formatServiceOptionScope(optionLabel, locationLabel = '') {
  const base = String(optionLabel || 'support options').trim();
  const location = String(locationLabel || '').trim();
  return location ? `${base} in ${location}` : base;
}

function buildRenderedServiceResponse(searchResult, userText = '') {
  if (searchResult?.browse) {
    return String(searchResult.message || 'Tell me what kind of service you want.');
  }
  const returnedCount = Number(
    searchResult?.returned_count ?? searchResult?.items?.length ?? searchResult?.count ?? 0,
  );

  const normalizedUserText = normalizeText(userText);
  const supportivePrefix =
    matchesAny(normalizedUserText, EMOTIONAL_PATTERNS) ||
    matchesAny(normalizedUserText, SUPPORT_PATTERNS)
      ? 'That sounds like a lot to carry. '
      : '';
  const broadenedCount = Number(searchResult?.relaxed?.broader_count ?? 0) || 0;
  const locationLabel = inferServiceResultLocationLabel(searchResult);
  const optionLabel = inferServiceResultOptionLabel(searchResult, userText);
  const groupedOptionPhrases = extractRenderedNeedGroups(searchResult);
  const scopedPluralLabel = formatServiceOptionScope(optionLabel, locationLabel);
  const scopedSingularLabel = formatServiceOptionScope(
    optionLabel.replace(/\boptions\b/i, 'option'),
    locationLabel,
  );
  let intro = `${supportivePrefix}Here are ${returnedCount || 'a few'} ${scopedPluralLabel} to start with.`;
  if (returnedCount === 0) {
    intro = `${supportivePrefix}I couldn't find a strong match yet, but we can tighten the search together.`;
  } else if (groupedOptionPhrases.length >= 2) {
    const groupedScope = locationLabel
      ? `${humanJoin(groupedOptionPhrases)} in ${locationLabel}`
      : humanJoin(groupedOptionPhrases);
    intro = `${supportivePrefix}I pulled together ${groupedScope} to start with.`;
  } else if (broadenedCount > 0 && returnedCount > 1) {
    intro = `${supportivePrefix}I kept the closest ${scopedPluralLabel} first and widened the search so you still have ${returnedCount} to choose from.`;
  } else if (returnedCount === 1) {
    intro = `${supportivePrefix}Here's the strongest ${scopedSingularLabel} I found to start with.`;
  }

  return `${intro}\n\n\`\`\`streetbot-service-results\n${JSON.stringify(searchResult, null, 2)}\n\`\`\``;
}

function buildRenderedCategoryResponse(payload, userText = '', rawUserContext = null) {
  const userContext = getStreetBotUserContext(rawUserContext);
  const topicLabel = inferBrowseTopicLabel(userText, payload);
  if (looksLikeNearbyBrowseWithoutLocation(userText)) {
    return `I can help with that. What city or neighborhood should I look in for ${topicLabel}?`;
  }

  const categories = buildBrowseCategoryHints(payload);
  const explicitLocationLabel = inferExplicitBrowseLocationLabel(userText);
  const preferredLocationLabel =
    !explicitLocationLabel && hasStreetBotPreferredLocation(userContext)
      ? getStreetBotPreferredLocationLabel(userContext)
      : '';
  const locationHint = explicitLocationLabel
    ? ` in ${explicitLocationLabel}`
    : preferredLocationLabel
      ? ` in ${preferredLocationLabel}`
      : '';
  const categoryHint = categories.length
    ? categories.join(', ')
    : 'housing, food, legal, health, or benefits';

  return `I can help with that. Tell me what kind of service you want${locationHint}, like ${categoryHint}.`;
}

function getStreetBotDisplayLabel(endpoint = '', fallback = '') {
  const normalized = String(endpoint || '').trim();
  const fallbackLabel = String(fallback || '').trim();
  if (/^Street Bot(?: 0\.1(?: Pro)?| Pro)?$/i.test(normalized)) {
    if (fallbackLabel && !/^Street Bot(?: 0\.1(?: Pro)?| Pro)?$/i.test(fallbackLabel)) {
      return fallbackLabel;
    }
    return 'Street Bot';
  }
  return fallbackLabel || 'Street Bot';
}

function getStreetBotEnvEndpointConfig(endpoint = '') {
  const envBaseURL = String(
    process.env.STREETBOT_DEEPAGENTS_API_BASE_URL ||
      process.env.STREETBOT_DEEPAGENTS_BASE_URL ||
      process.env.HERMES_CONVERSATION_API_BASE_URL ||
      process.env.RAILWAY_SERVICE_STREETBOT_DEEPAGENTS_URL ||
      '',
  ).trim();
  if (!envBaseURL) {
    return null;
  }

  const baseURL = /^https?:\/\//i.test(envBaseURL) ? envBaseURL : `https://${envBaseURL}`;
  return {
    name: endpoint || 'Street Bot',
    apiKey: String(
      process.env.STREETBOT_DEEPAGENTS_API_KEY ||
        process.env.STREETBOT_DEEPAGENTS_PRO_API_KEY ||
        process.env.HERMES_CONVERSATION_API_SERVER_KEY ||
        process.env.HERMES_ADMIN_API_SERVER_KEY ||
        '',
    ).trim(),
    baseURL,
    models: {
      fetch: false,
      default: ['streetbot-0.1'],
    },
    titleConvo: true,
    titleModel: 'streetbot-0.1',
    summarize: false,
    modelDisplayLabel: 'Street Bot 0.1',
  };
}

function getStreetBotEndpointConfig(req, endpoint = '') {
  const customEndpoints = Array.isArray(req?.config?.endpoints?.custom)
    ? req.config.endpoints.custom
    : [];
  const matchedEndpoint = customEndpoints.find(
    (config) =>
      String(config?.name || '')
        .trim()
        .toLowerCase() ===
      String(endpoint || '')
        .trim()
        .toLowerCase(),
  );
  const envEndpoint = getStreetBotEnvEndpointConfig(endpoint);
  if (matchedEndpoint) {
    if (envEndpoint?.baseURL) {
      return {
        ...matchedEndpoint,
        baseURL: envEndpoint.baseURL,
        apiKey: envEndpoint.apiKey || matchedEndpoint.apiKey,
      };
    }
    return matchedEndpoint;
  }

  return envEndpoint;
}

function summarizeStreetBotServicePayload(payloadText) {
  let payload = null;
  try {
    payload = JSON.parse(String(payloadText || '').trim());
  } catch (_) {
    payload = null;
  }

  if (!payload || typeof payload !== 'object') {
    return 'Street Bot previously shared grounded service search results.';
  }

  const returnedCount =
    Number(payload.returned_count ?? payload.items?.length ?? payload.count ?? 0) || 0;
  const query = String(payload.query || '').trim();
  const location = [payload.city, payload.province]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
  const topNames = Array.isArray(payload.items)
    ? payload.items
        .map((item) => String(item?.name || item?.title || item?.organization || '').trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  if (payload.browse) {
    const browseTopic = query || 'services';
    return `Street Bot asked the user to narrow a service search for ${browseTopic}.`;
  }

  const scope = [query, location].filter(Boolean).join(' in ');
  if (returnedCount > 0) {
    const suffix = topNames.length
      ? ` Top matches: ${topNames.join(', ')}${returnedCount > topNames.length ? ', and more.' : '.'}`
      : '';
    return `Street Bot shared ${returnedCount} grounded service result${returnedCount === 1 ? '' : 's'}${scope ? ` for ${scope}` : ''}.${suffix}`.trim();
  }

  if (payload.ok === false) {
    return `Street Bot's service search did not return a usable result yet${scope ? ` for ${scope}` : ''}.`;
  }

  return `Street Bot ran a grounded service search${scope ? ` for ${scope}` : ''}.`;
}

const STREETBOT_RICH_RESULT_FENCE_PATTERN =
  /```(?:streetbot-agent-results|street-profile-results|street-profile-message-draft)\s*[\s\S]*?```/gi;
const STREETBOT_ACTION_REQUEST_FENCE_PATTERN =
  /```(?:streetbot-action-request|local-action-request)\s*[\s\S]*?```/gi;

function sanitizeStreetBotConversationHistoryText(value) {
  const text = String(value || '').trim();
  if (!text || !text.includes('```street')) {
    return text;
  }

  const summaries = [];
  const stripped = text
    .replace(/```streetbot-service-results\s*([\s\S]*?)```/gi, (_match, payloadText) => {
      const summary = summarizeStreetBotServicePayload(payloadText);
      if (summary) {
        summaries.push(summary);
      }
      return '';
    })
    .replace(STREETBOT_RICH_RESULT_FENCE_PATTERN, '')
    .replace(STREETBOT_ACTION_REQUEST_FENCE_PATTERN, 'Action ready for confirmation.');

  return [stripped.trim(), ...summaries]
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripStreetBotServicePayloadForDisplay(value) {
  const text = String(value || '').trim();
  if (!text || !text.includes('```street')) {
    return text;
  }

  return text
    .replace(/```streetbot-service-results\s*[\s\S]*?```/gi, '')
    .replace(STREETBOT_RICH_RESULT_FENCE_PATTERN, '')
    .replace(STREETBOT_ACTION_REQUEST_FENCE_PATTERN, 'Action ready for confirmation.')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractMessageTextForModel(message) {
  if (!message) {
    return '';
  }
  if (typeof message.text === 'string' && message.text.trim()) {
    return sanitizeStreetBotConversationHistoryText(message.text);
  }
  if (typeof message.content === 'string') {
    return sanitizeStreetBotConversationHistoryText(message.content);
  }
  if (Array.isArray(message.content)) {
    const content = message.content
      .map((part) => {
        if (!part) {
          return '';
        }
        if (typeof part === 'string') {
          return part;
        }
        if (typeof part.text === 'string') {
          return part.text;
        }
        if (part.text && typeof part.text.value === 'string') {
          return part.text.value;
        }
        return '';
      })
      .join('\n')
      .trim();
    return sanitizeStreetBotConversationHistoryText(content);
  }
  return '';
}

function buildStreetBotConversationGuardrail(serviceContext = {}) {
  if (!hasActiveServiceContext(serviceContext)) {
    return '';
  }
  return [
    'A prior service search exists in this chat.',
    'Stay in the conversation lane unless the newest user message clearly asks to search, refine, or continue service results.',
    'For thanks, acknowledgments, casual check-ins, identity questions, topic changes, or social replies, answer normally.',
    'Do not call service-search/RAG tools or emit streetbot-service-results for those conversation turns.',
    'If the user asks what they searched for before, what kinds of services they usually ask about, or what you know about their service needs, answer from chat history instead of starting a new directory search.',
  ].join(' ');
}

function buildStreetBotConversationSystemPrompt(userContext = {}) {
  const locationLabel = getStreetBotPreferredLocationLabel(userContext);
  return [
    'Operating mode: I am Street Bot, the main Street Voices conversation agent.',
    'I am the only user-facing production agent.',
    'I default to warm, capable general conversation and answer ordinary questions, identity questions, casual check-ins, factual questions, and topic changes directly.',
    'I stay conversational by default and do not use RAG just because it exists.',
    'Directory/resource lookup is handled by a separate Street Bot route when the latest user message clearly asks for local resources.',
    'If a prior service result is followed by thanks, acknowledgments, praise, a check-in, or a new non-service topic, I keep that turn in normal conversation.',
    'If the user clearly needs resource lookup but this message reached me, I ask one concise clarifying question instead of pretending to have searched.',
    'Keep answers natural and useful. Do not collapse general conversation into canned service-navigation prompts.',
    locationLabel
      ? `The user's saved service-search location is ${locationLabel}; only use it if location matters.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildSelectedAgentConversationSystemPrompt(agentProfile = null, userContext = {}) {
  if (!agentProfile?.label) {
    return '';
  }
  const locationLabel = getStreetBotPreferredLocationLabel(userContext);
  return [
    `Operating mode: I am ${agentProfile.label}, a Street Voices specialist agent.`,
    `My domain is ${agentProfile.purpose}.`,
    'I can have ordinary general conversation. I should answer greetings, identity questions, casual check-ins, and open-ended questions naturally as myself.',
    `When the user clearly asks me to find, show, list, return, or search ${agentProfile.cardLabel}, the backend may render actual UI cards from ${agentProfile.source}.`,
    'Do not claim to be Street Bot unless the selected agent is Street Bot. Do not mention backend routing.',
    'Use user-facing names for other agents and tools; never write internal identifiers with underscores.',
    'If older conversation history contains a response that says Street Bot, treat it as a stale local bug and continue under my selected agent name.',
    locationLabel
      ? `The user's saved service-search location is ${locationLabel}; only use it if location matters.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildStreetBotConversationStyleNote(userText = '', agentProfile = null) {
  const normalized = normalizeText(userText);
  const label = agentProfile?.label || 'Street Bot';
  if (!normalized) {
    return '';
  }

  if (/\b(your name|who are you|what are you|introduce yourself)\b/i.test(normalized)) {
    return `Conversation style note: answer as ${label} in a friendly sentence or two, not as a one-word label.`;
  }

  return `Conversation style note: answer naturally and directly in one to three useful sentences, with the same warm ${label} voice.`;
}

const STREAM_PROGRESS_PHASES = {
  thinking_through_request: 'Thinking through your request',
  reviewing_recent_context: 'Reviewing recent context',
  checking_directory: 'Looking for services',
  browsing_service_categories: 'Looking for services',
  loading_more_results: 'Looking for more services',
  checking_official_site: 'Checking the official site',
  opening_official_page: 'Opening the official page',
  reviewing_system_state: 'Reviewing the current system state',
};

function buildStreetBotProgressToolName(phaseKey) {
  const safeKey =
    String(phaseKey || 'working')
      .trim()
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || 'working';
  return `${safeKey}${Constants.mcp_delimiter}streetbot-status`;
}

function emitStreetBotProgressStart(streamId, runId, phaseKey, index = 0, metadata = {}) {
  if (!STREETBOT_FASTPATH_STREAMING_ENABLED || !streamId || !runId) {
    return null;
  }

  const label = STREAM_PROGRESS_PHASES[phaseKey] || STREAM_PROGRESS_PHASES.thinking_through_request;
  const toolCallId = `call_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const stepId = `step_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const args = JSON.stringify({
    label,
    phase: phaseKey,
    ...metadata,
  });

  GenerationJobManager.emitChunk(streamId, {
    event: 'on_run_step',
    data: {
      id: stepId,
      runId,
      index,
      stepDetails: {
        type: 'tool_calls',
        tool_calls: [
          {
            id: toolCallId,
            name: buildStreetBotProgressToolName(phaseKey),
            args,
          },
        ],
      },
    },
  });

  return {
    stepId,
    toolCallId,
    phaseKey,
    label,
    args,
  };
}

function emitStreetBotProgressComplete(streamId, progress, status = 'ok') {
  if (!STREETBOT_FASTPATH_STREAMING_ENABLED || !progress?.stepId || !progress?.toolCallId) {
    return;
  }
  const output = JSON.stringify({
    status,
    label: progress.label,
    phase: progress.phaseKey,
  });
  GenerationJobManager.emitChunk(streamId, {
    event: 'on_run_step_completed',
    data: {
      result: {
        id: progress.stepId,
        tool_call: {
          name: buildStreetBotProgressToolName(progress.phaseKey),
          args: progress.args,
          output,
          id: progress.toolCallId,
        },
      },
    },
  });
}

function emitStreetBotKeepalive(streamId, phaseKey, metadata = {}) {
  if (!STREETBOT_FASTPATH_KEEPALIVE_ENABLED || !streamId) {
    return;
  }

  GenerationJobManager.emitChunk(streamId, {
    event: 'streetbot_keepalive',
    data: {
      phase: phaseKey,
      label: STREAM_PROGRESS_PHASES[phaseKey] || STREAM_PROGRESS_PHASES.thinking_through_request,
      at: Date.now(),
      ...metadata,
    },
  });
}

async function withStreetBotStreamKeepalive(streamId, phaseKey, work, options = {}) {
  if (!STREETBOT_FASTPATH_KEEPALIVE_ENABLED || !streamId) {
    return work();
  }

  const intervalMs = Number(options?.intervalMs) > 0 ? Number(options.intervalMs) : 2500;
  const metadata = options?.metadata || {};
  const timer = setInterval(() => {
    emitStreetBotKeepalive(streamId, phaseKey, metadata);
  }, intervalMs);
  if (typeof timer?.unref === 'function') {
    timer.unref();
  }
  try {
    return await work();
  } finally {
    clearInterval(timer);
  }
}

async function withStreetBotProgressStep(streamId, runId, phaseKey, index, work, metadata = {}) {
  if (!STREETBOT_FASTPATH_STREAMING_ENABLED || !streamId || !runId) {
    return withStreetBotStreamKeepalive(streamId, phaseKey, work, {
      metadata,
    });
  }

  const progress = emitStreetBotProgressStart(streamId, runId, phaseKey, index, metadata);
  try {
    const value = await work();
    emitStreetBotProgressComplete(streamId, progress, 'ok');
    return value;
  } catch (error) {
    emitStreetBotProgressComplete(streamId, progress, 'error');
    throw error;
  }
}

function inferStreetBotConversationPhase(userText = '') {
  const normalized = String(userText || '').trim();
  if (!normalized) {
    return 'thinking_through_request';
  }
  if (
    /\b(open|visit|show|preview|navigate to|pull up|bring up)\b.*\b(application|form|website|site|page)\b/i.test(
      normalized,
    )
  ) {
    return 'opening_official_page';
  }
  if (
    /\b(tell me more about|hours|eligibility|contact|phone|email|website|program details?|application details?)\b/i.test(
      normalized,
    )
  ) {
    return 'checking_official_site';
  }
  if (
    /\b(stack|system|retrieval|transition|eval|evaluation|diagnostic|diagnostics|health|status|probe|corpus|weaviate|redis|postgres|latency)\b/i.test(
      normalized,
    )
  ) {
    return 'reviewing_system_state';
  }
  return 'thinking_through_request';
}

async function buildStreetBotConversationMessages(req, conversationId, userText) {
  const messages = [];
  const userId = req?.user?.id;
  const userContext = getStreetBotUserContext(req?.body?._streetbotUserContext);
  const serviceContext = getServiceContext(req?._streetbotServiceContext);
  const selectedAgentProfile = getSelectedConversationAgentProfile(req);
  const selectedAgentPrompt = buildSelectedAgentConversationSystemPrompt(
    selectedAgentProfile,
    userContext,
  );
  const systemSegments = [
    selectedAgentPrompt || buildStreetBotConversationSystemPrompt(userContext),
    buildStreetBotConversationGuardrail(serviceContext),
    buildStreetBotConversationStyleNote(userText, selectedAgentProfile),
  ];
  if (hasStreetBotPreferredLocation(userContext) && looksLikeStreetBotServiceRequest(userText)) {
    const locationLabel = getStreetBotPreferredLocationLabel(userContext);
    const locationContext = locationLabel
      ? `Saved Street Bot location for nearby services: ${locationLabel}.`
      : 'A saved Street Bot city and province are available for nearby services.';
    systemSegments.push(
      `${locationContext} Use that saved location by default unless the user gives a different location.`,
    );
  }
  const systemPrompt = systemSegments.filter(Boolean).join('\n\n');
  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt,
    });
  }
  if (conversationId && conversationId !== 'new' && userId) {
    try {
      const history = await getMessages({ conversationId, user: userId });
      for (const message of history || []) {
        const role =
          message.isCreatedByUser || /^User$/i.test(String(message.sender || ''))
            ? 'user'
            : 'assistant';
        const rawContent = extractMessageTextForModel(message);
        const content =
          role === 'assistant'
            ? sanitizeSelectedAgentAssistantHistoryText(rawContent, selectedAgentProfile)
            : rawContent;
        if (!content) {
          continue;
        }
        messages.push({ role, content });
      }
    } catch (error) {
      logger.warn(
        `[streetbot-fastpath] failed to load conversation history for ${conversationId}: ${error.message}`,
      );
    }
  }

  messages.push({ role: 'user', content: String(userText || '').trim() });
  if (messages.length <= 16) {
    return messages;
  }
  return [messages[0], ...messages.slice(-15)];
}

async function runStreetBotConversationModel(
  req,
  endpointOption,
  conversationId,
  userText,
  phaseRunner = async (_phaseKey, work) => work(),
  streamId = '',
  responseMessageId = '',
  allocateResponseStepIndex = () => 1,
) {
  const endpoint =
    endpointOption?.endpoint || req?.body?.endpoint || req?.params?.endpoint || 'Street Bot';
  const endpointConfig = getStreetBotEndpointConfig(req, endpoint);
  const baseURL = String(endpointConfig?.baseURL || '').replace(/\/+$/, '');
  const apiKey = String(endpointConfig?.apiKey || '').trim();
  const model =
    String(
      endpointOption?.modelOptions?.model ||
        endpointOption?.model_parameters?.model ||
        req?.body?.model ||
        'streetbot-0.1',
    ).trim() || 'streetbot-0.1';

  if (!baseURL) {
    throw new Error(`Street Bot endpoint ${endpoint} is missing a baseURL`);
  }

  const apiBaseURL = /\/v1$/i.test(baseURL) ? baseURL : `${baseURL}/v1`;
  const hasPriorConversationContext = Boolean(conversationId && conversationId !== 'new');
  const messages = hasPriorConversationContext
    ? await phaseRunner('reviewing_recent_context', () =>
        buildStreetBotConversationMessages(req, conversationId, userText),
      )
    : await buildStreetBotConversationMessages(req, conversationId, userText);
  const primaryPhase = inferStreetBotConversationPhase(userText);
  const selectedAgentProfile = getSelectedConversationAgentProfile(req);
  const useBackendStreaming = STREETBOT_BACKEND_STREAMING_ENABLED && !selectedAgentProfile;
  return phaseRunner(primaryPhase, async () => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), STREETBOT_CONVERSATION_TIMEOUT_MS);

    try {
      const response = await fetch(`${apiBaseURL}/chat/completions`, {
        method: 'POST',
        signal: abortController.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          stream: useBackendStreaming,
          messages,
          temperature: Number.isFinite(Number(req?.body?.temperature))
            ? Number(req.body.temperature)
            : 0.7,
          max_tokens: Number.isFinite(Number(req?.body?.max_tokens))
            ? Number(req.body.max_tokens)
            : 600,
        }),
      });

      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(
          `Street Bot API request failed with ${response.status}: ${bodyText.slice(0, 240)}`,
        );
      }

      if (!useBackendStreaming) {
        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content ?? payload?.output_text ?? '';
        const responseText = (
          Array.isArray(content)
            ? content
                .map((entry) =>
                  typeof entry === 'string'
                    ? entry
                    : String(entry?.text?.value || entry?.text || entry?.value || ''),
                )
                .join('')
            : String(content || '')
        ).trim();
        if (!responseText) {
          throw new Error('Street Bot API response was empty');
        }
        if (looksLikeStreetBotModelFailureText(responseText)) {
          throw new Error(`Street Bot provider returned a model failure response: ${responseText.slice(0, 180)}`);
        }
        return normalizeSelectedAgentResponseText(req, responseText);
      }

      const processStreamPayload = (dataStr, state) => {
        if (!dataStr) {
          return false;
        }
        if (dataStr === '[DONE]') {
          return true;
        }
        try {
          const parsed = JSON.parse(dataStr);
          const deltaContent = parsed?.choices?.[0]?.delta?.content;
          const nextText =
            typeof deltaContent === 'string'
              ? deltaContent
              : Array.isArray(deltaContent)
                ? deltaContent
                    .map((entry) =>
                      typeof entry === 'string'
                        ? entry
                        : String(entry?.text?.value || entry?.text || entry?.value || ''),
                    )
                    .join('')
                : '';
          if (!nextText) {
            return;
          }
          if (looksLikeStreetBotModelFailureText(nextText)) {
            state.modelFailureText = `${state.modelFailureText || ''}${nextText}`;
            return;
          }
          if (STREETBOT_FASTPATH_STREAMING_ENABLED && !state.responseStep) {
            state.responseStep = emitStreetBotResponseStepStart(
              streamId,
              responseMessageId,
              allocateResponseStepIndex(),
            );
          }
          state.fullText += nextText;
          emitStreetBotMessageDelta(
            streamId,
            state.responseStep?.stepId || responseMessageId,
            nextText,
          );
        } catch (error) {
          /* ignore malformed or partial SSE frames */
        }
        return false;
      };

      const streamState = { fullText: '', responseStep: null, modelFailureText: '' };
      const body = response.body;

      if (body && typeof body.getReader === 'function') {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let sawDone = false;

        while (!sawDone) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            if (!rawLine.startsWith('data:')) {
              continue;
            }
            sawDone = processStreamPayload(rawLine.slice(5).trimStart(), streamState);
            if (sawDone) {
              break;
            }
          }
        }

        if (!sawDone) {
          buffer += decoder.decode();
          for (const rawLine of buffer.split(/\r?\n/)) {
            if (!rawLine.startsWith('data:')) {
              continue;
            }
            sawDone = processStreamPayload(rawLine.slice(5).trimStart(), streamState);
            if (sawDone) {
              break;
            }
          }
        }
      }

      const responseText = String(streamState.fullText || '').trim();
      if (!responseText) {
        if (streamState.modelFailureText) {
          throw new Error(
            `Street Bot provider returned a model failure response: ${streamState.modelFailureText.slice(0, 180)}`,
          );
        }
        throw new Error('Street Bot API response was empty');
      }
      if (looksLikeStreetBotModelFailureText(responseText)) {
        throw new Error(`Street Bot provider returned a model failure response: ${responseText.slice(0, 180)}`);
      }
      return normalizeSelectedAgentResponseText(req, responseText);
    } catch (error) {
      if (abortController.signal.aborted || error?.name === 'AbortError') {
        throw new Error(
          `Street Bot conversation request timed out after ${STREETBOT_CONVERSATION_TIMEOUT_MS}ms`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  });
}

function clampReward(value) {
  if (!Number.isFinite(Number(value))) {
    return 0;
  }
  return Math.max(0, Math.min(1, Number(value)));
}

function buildPromptFingerprint(value) {
  const normalized = normalizeText(value).replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

function buildStreetBotOutcome(toolBase, detectedIntent, searchResult, durationMs) {
  const returnedCount =
    Number(searchResult?.returned_count ?? searchResult?.items?.length ?? 0) || 0;
  const browse = Boolean(searchResult?.browse);
  const hasMore = Boolean(searchResult?.has_more);
  const ok = searchResult == null ? true : searchResult?.ok !== false;
  let kind = 'conversation';
  let success = true;
  let rewardProxy = 0.82;

  if (toolBase === 'smalltalk') {
    kind = detectedIntent?.smalltalkKind || 'conversation';
    if (kind === 'support') {
      rewardProxy = 0.96;
    } else if (kind === 'wellness_tip') {
      rewardProxy = 0.93;
    } else if (kind === 'service_feedback') {
      rewardProxy = 0.92;
    } else if (kind === 'service_acknowledgment') {
      rewardProxy = 0.91;
    } else if (kind === 'identity' || kind === 'greeting' || kind === 'checkin') {
      rewardProxy = 0.9;
    } else if (kind === 'topic_chat') {
      rewardProxy = 0.89;
    } else if (kind === 'joke' || kind === 'preference') {
      rewardProxy = 0.87;
    }
  } else if (toolBase === 'conversation') {
    kind = 'conversation';
    success = ok;
    rewardProxy = 0.9;
  } else if (toolBase === 'services_categories' || browse) {
    kind = 'service_clarify';
    rewardProxy = 0.88;
  } else if (toolBase === 'services_more') {
    kind = 'service_followup';
    success = ok && returnedCount > 0;
    rewardProxy = success ? 0.92 : 0.28;
  } else {
    kind = 'service_search';
    success = ok && returnedCount > 0;
    rewardProxy = success ? 1 : browse ? 0.88 : 0.22;
  }

  if (!ok) {
    success = false;
    rewardProxy = Math.min(rewardProxy, 0.08);
  }

  if (durationMs > 5000) {
    rewardProxy -= 0.25;
  } else if (durationMs > 2500) {
    rewardProxy -= 0.1;
  }

  return {
    kind,
    success,
    rewardProxy: clampReward(rewardProxy),
    returnedCount,
    browse,
    hasMore,
  };
}

function normalizeLocationTelemetryAction(rawAction) {
  if (!rawAction || typeof rawAction !== 'object') {
    return null;
  }

  const kind = String(rawAction.kind || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!kind) {
    return null;
  }

  const emittedAt = String(rawAction.emitted_at || rawAction.emittedAt || '').trim();
  return {
    kind,
    emittedAt,
    locationLabel: String(rawAction.location_label || rawAction.locationLabel || '').trim(),
    source: String(rawAction.source || '').trim(),
    bridgeKind: String(rawAction.bridge_kind || rawAction.bridgeKind || '').trim(),
    endpoint: String(rawAction.endpoint || '').trim(),
    status: String(rawAction.status || '').trim(),
    preserveExisting: Boolean(rawAction.preserve_existing),
    hadExistingLocation: Boolean(rawAction.had_existing_location),
    autoReused: Boolean(rawAction.auto_reused),
    hadExplicitLocation: Boolean(rawAction.had_explicit_location),
  };
}

function extractLocationTelemetry(req) {
  const rawTelemetry = req?.body?._streetbotLocationTelemetry;
  if (!rawTelemetry || typeof rawTelemetry !== 'object') {
    return null;
  }

  const actions = Array.isArray(rawTelemetry.actions)
    ? rawTelemetry.actions.map((action) => normalizeLocationTelemetryAction(action)).filter(Boolean)
    : [];
  const savedLocationUsed = Boolean(rawTelemetry.saved_location_used);
  const savedLocationLabel = String(rawTelemetry.saved_location_label || '').trim();

  if (actions.length === 0 && !savedLocationUsed && !savedLocationLabel) {
    return null;
  }

  return {
    actionKinds: actions.map((action) => action.kind).filter(Boolean),
    actions,
    savedLocationUsed,
    savedLocationLabel,
  };
}

function buildRewardLogEvent(
  req,
  resolvedConversationId,
  toolBase,
  detectedIntent,
  searchResult,
  durationMs,
  outcome,
) {
  const endpoint =
    req?.body?.endpointOption?.endpoint ||
    req?.body?.endpoint ||
    req?.params?.endpoint ||
    'unknown';
  const promptText = req?._streetbotFastPath?.userText || req?.body?.text || '';
  const promptSummary = summarizeStreetBotText(promptText);
  const conversationId = String(resolvedConversationId || req?.body?.conversationId || '').trim();
  const traceIdentifiers = getStreetBotTraceIdentifiers(req);
  const locationTelemetry = extractLocationTelemetry(req);

  return {
    version: 'v1',
    emittedAt: new Date().toISOString(),
    endpoint,
    mode: /^Street Bot(?: 0\.1 Pro| Pro)$/i.test(endpoint) ? 'pro' : 'public',
    conversationId: conversationId && conversationId !== 'new' ? conversationId : '',
    conversationUrl:
      conversationId && conversationId !== 'new' ? `/c/${encodeURIComponent(conversationId)}` : '',
    traceId: traceIdentifiers.traceId,
    spanId: traceIdentifiers.spanId,
    traceFlags: traceIdentifiers.traceFlags,
    traceSynthetic: Boolean(traceIdentifiers.synthetic),
    toolBase,
    outcomeKind: outcome.kind,
    success: outcome.success,
    rewardProxy: outcome.rewardProxy,
    returnedCount: outcome.returnedCount,
    browse: outcome.browse,
    hasMore: outcome.hasMore,
    durationMs,
    smalltalkKind: detectedIntent?.smalltalkKind || '',
    promptFingerprint: buildPromptFingerprint(promptText),
    prompt: {
      length: promptSummary.length,
      wordCount: promptSummary.wordCount,
      hasQuestion: promptSummary.hasQuestion,
      startsWithSlash: promptSummary.startsWithSlash,
    },
    ...(locationTelemetry ? { locationTelemetry } : {}),
  };
}

function capturePostHogRagSpan(
  req,
  userId,
  conversationId,
  toolBase,
  toolPayload,
  searchResult,
  durationMs,
) {
  const traceIdentifiers = getStreetBotTraceIdentifiers(req);
  return captureStreetBotPostHogSpan({
    distinctId: userId,
    traceId: traceIdentifiers.traceId,
    sessionId: conversationId,
    spanId: crypto.randomUUID(),
    parentId: traceIdentifiers.spanId,
    spanName: `streetbot_${toolBase}`,
    inputState: {
      toolBase,
      query: toolPayload?.query || '',
      city: toolPayload?.city || '',
      province: toolPayload?.province || '',
      limit: toolPayload?.limit ?? null,
      categories: toolPayload?.categories || [],
      tags: toolPayload?.tags || [],
    },
    outputState: {
      ok: searchResult?.ok !== false,
      browse: Boolean(searchResult?.browse),
      returnedCount:
        Number(
          searchResult?.returned_count ?? searchResult?.items?.length ?? searchResult?.count ?? 0,
        ) || 0,
      hasMore: Boolean(searchResult?.has_more),
    },
    latencySeconds: Number(durationMs || 0) / 1000,
    properties: {
      streetbot_tool_base: toolBase,
      streetbot_route_kind: 'fastpath',
    },
  });
}

function capturePostHogGeneration(
  req,
  userId,
  conversationId,
  toolBase,
  userText,
  responseText,
  durationMs,
  outcome,
  searchResult,
) {
  const traceIdentifiers = getStreetBotTraceIdentifiers(req);
  return captureStreetBotPostHogGeneration({
    distinctId: userId,
    traceId: traceIdentifiers.traceId,
    sessionId: conversationId,
    spanId: crypto.randomUUID(),
    parentId: traceIdentifiers.spanId,
    spanName: 'streetbot_fastpath_response',
    model:
      toolBase === 'conversation'
        ? 'streetbot-deepagents'
        : toolBase === 'smalltalk'
          ? 'streetbot-fastpath'
          : 'streetbot-rag',
    provider: toolBase === 'conversation' ? 'deepagents' : 'streetbot',
    input: [buildPostHogTextMessage('user', userText)],
    outputChoices: [buildPostHogTextMessage('assistant', responseText)],
    latencySeconds: Number(durationMs || 0) / 1000,
    httpStatus: 200,
    properties: {
      streetbot_tool_base: toolBase,
      streetbot_route_kind: 'fastpath',
      streetbot_outcome_kind: outcome?.kind || '',
      streetbot_reward_proxy: outcome?.rewardProxy ?? null,
      streetbot_browse: Boolean(searchResult?.browse),
      streetbot_returned_count: Number(searchResult?.returned_count ?? 0) || 0,
      streetbot_has_more: Boolean(searchResult?.has_more),
    },
  });
}

function capturePostHogGenerationError(
  req,
  userId,
  conversationId,
  toolBase,
  userText,
  error,
  durationMs,
) {
  const traceIdentifiers = getStreetBotTraceIdentifiers(req);
  return captureStreetBotPostHogGeneration({
    distinctId: userId,
    traceId: traceIdentifiers.traceId,
    sessionId: conversationId,
    spanId: crypto.randomUUID(),
    parentId: traceIdentifiers.spanId,
    spanName: 'streetbot_fastpath_error',
    model:
      toolBase === 'conversation'
        ? 'streetbot-deepagents'
        : toolBase === 'smalltalk'
          ? 'streetbot-fastpath'
          : 'streetbot-rag',
    provider: toolBase === 'conversation' ? 'deepagents' : 'streetbot',
    input: [buildPostHogTextMessage('user', userText)],
    outputChoices: [],
    latencySeconds: Number(durationMs || 0) / 1000,
    httpStatus: 500,
    isError: true,
    error: error?.message || String(error || 'streetbot-fastpath unexpected error'),
    properties: {
      streetbot_tool_base: toolBase,
      streetbot_route_kind: 'fastpath',
    },
  });
}

async function streetbotFastPath(req, res, _next) {
  const startedAt = Date.now();
  const { endpointOption, conversationId: reqConversationId, parentMessageId } = req.body;
  const userText = req._streetbotFastPath?.userText || String(req.body?.text || '').trim();
  const userId = req.user.id;

  const { allowed, pendingRequests, limit } = await checkAndIncrementPendingRequest(userId);
  if (!allowed) {
    const violationInfo = getViolationInfo(pendingRequests, limit);
    return res.status(429).json(violationInfo);
  }

  const conversationId =
    !reqConversationId || reqConversationId === 'new' ? crypto.randomUUID() : reqConversationId;
  const streamId = conversationId;

  try {
    const job = await GenerationJobManager.createJob(streamId, userId, conversationId);
    res.json({ streamId, conversationId, status: 'started' });

    const userMessageId = crypto.randomUUID();
    const responseMessageId = crypto.randomUUID();
    const isNewConvo = !reqConversationId || reqConversationId === 'new';
    const selectedStreetProfileAgent = getSelectedStreetProfileAgent(req);
    const selectedMarketplaceAgent = getSelectedMarketplaceAgent(req);
    const selectedAgentProfile = getSelectedConversationAgentProfile(req);
    const selectedMarketplaceAgentIconURL = getSelectedMarketplaceAgentIconURL(req);
    const selectedAgentSender = selectedAgentProfile?.label || getStreetBotDisplayLabel(
      endpointOption.endpoint,
      endpointOption.model_parameters?.modelLabel || req.body?.modelDisplayLabel,
    );
    const forceStreetAgentTextStream = Boolean(
      selectedStreetProfileAgent || STREETBOT_RENDERED_AGENT_IDS.has(selectedMarketplaceAgent),
    );
    let progressStepIndex = 0;
    const nextProgressStepIndex = () => progressStepIndex++;
    const runProgressPhase = (phaseKey, work, metadata = {}) =>
      withStreetBotProgressStep(
        streamId,
        responseMessageId,
        phaseKey,
        nextProgressStepIndex(),
        work,
        metadata,
      );

    const userMessage = {
      messageId: userMessageId,
      conversationId,
      parentMessageId: parentMessageId || Constants.NO_PARENT,
      sender: 'User',
      text: userText,
      isCreatedByUser: true,
      user: userId,
      endpoint: endpointOption.endpoint,
    };

    await GenerationJobManager.updateMetadata(streamId, {
      conversationId,
      responseMessageId,
      sender: selectedAgentSender,
      model: endpointOption.modelOptions?.model || endpointOption.model_parameters?.model,
      iconURL:
        selectedMarketplaceAgentIconURL ||
        getSelectedStreetProfileAgentIconURL(req) ||
        endpointOption.iconURL,
      userMessage: {
        messageId: userMessageId,
        parentMessageId: userMessage.parentMessageId,
        conversationId,
        text: userText,
      },
    });

    GenerationJobManager.emitChunk(streamId, {
      created: true,
      message: userMessage,
      streamId,
    });

    const detectedIntent =
      req._streetbotFastPath ||
      (await detectStreetBotIntent(
        userText,
        req._streetbotServiceContext,
        req.body?._streetbotUserContext,
      ));
    const forceMarketplaceAgentConversation = STREETBOT_RENDERED_AGENT_IDS.has(
      selectedMarketplaceAgent,
    );
    const forceSelectedAgentConversation = Boolean(
      selectedStreetProfileAgent || forceMarketplaceAgentConversation,
    );
    const toolBase = forceSelectedAgentConversation
      ? 'conversation'
      : detectedIntent?.toolBase || 'services_search';
    let responseText = forceSelectedAgentConversation
      ? ''
      : String(detectedIntent?.responseText || '').trim();
    let searchResult = null;
    let toolCallContent = null;
    let responseAlreadyStreamed = false;

    annotateStreetBotRequestTrace(req, {
      observation: {
        metadata: {
          routeKind: 'fastpath',
          toolBase,
          hasServiceContext: Boolean(req._streetbotServiceContext?.session_id),
        },
      },
      attributes: {
        'streetbot.route.fast_path': true,
        'streetbot.fastpath.tool_base': toolBase,
        'streetbot.fastpath.smalltalk': toolBase === 'smalltalk',
      },
    });

    if (toolBase === 'conversation') {
      const streetBotAgentActionConfirmationResponse = await buildStreetBotAgentActionConfirmationResponse(
        req,
        userText,
        conversationId,
      );
      const streetBotAgentActionResponse = streetBotAgentActionConfirmationResponse
        ? null
        : await buildStreetBotAgentActionResponse(req, userText);
      const streetBotAgentResultsResponse = streetBotAgentActionConfirmationResponse || streetBotAgentActionResponse
        ? null
        : await buildStreetBotAgentResultsResponse(
        req,
        userText,
        runProgressPhase,
      );
      const streetProfileFamilyResponse = streetBotAgentResultsResponse
        || streetBotAgentActionConfirmationResponse
        || streetBotAgentActionResponse
        ? null
        : await buildStreetProfileFamilyResponse(
            req,
            userText,
            runProgressPhase,
          );
      if (streetBotAgentActionConfirmationResponse) {
        responseText = streetBotAgentActionConfirmationResponse.responseText;
        searchResult = streetBotAgentActionConfirmationResponse.searchResult;
      } else if (streetBotAgentActionResponse) {
        responseText = streetBotAgentActionResponse.responseText;
        searchResult = streetBotAgentActionResponse.searchResult;
      } else if (streetBotAgentResultsResponse) {
        responseText = streetBotAgentResultsResponse.responseText;
        searchResult = streetBotAgentResultsResponse.searchResult;
      } else if (streetProfileFamilyResponse) {
        responseText = streetProfileFamilyResponse.responseText;
        searchResult = streetProfileFamilyResponse.searchResult;
      } else if (selectedAgentProfile) {
        responseText = buildSelectedAgentGeneralFallback(req, userText);
        responseAlreadyStreamed = false;
        searchResult = { ok: true, returned_count: 0, items: [], has_more: false };
      } else {
        try {
          responseText = await runStreetBotConversationModel(
            req,
            endpointOption,
            conversationId,
            userText,
            runProgressPhase,
            streamId,
            responseMessageId,
            nextProgressStepIndex,
          );
          responseAlreadyStreamed = STREETBOT_FASTPATH_STREAMING_ENABLED && !selectedAgentProfile;
        } catch (error) {
          logger.warn('[streetbot-fastpath] conversation model unavailable, using fallback', {
            error: error?.message || String(error || ''),
          });
          responseText = buildSelectedAgentGeneralFallback(req, userText, error);
          responseAlreadyStreamed = false;
        }
        searchResult = { ok: true, returned_count: 0, items: [], has_more: false };
      }
    } else if (toolBase !== 'smalltalk') {
      const { searchServicesInternal, buildMoreResults, categoriesInternal } = await getRagModule();
      const requestUserContext = getStreetBotUserContext(req.body?._streetbotUserContext);
      let searchArgs = req._streetbotSearchArgs ||
        detectedIntent?.searchArgs || {
          query: userText,
          limit: 5,
        };
      let moreArgs = req._streetbotMoreArgs || detectedIntent?.moreArgs || null;
      let categoryArgs = req._streetbotCategoryArgs || detectedIntent?.categoryArgs || { limit: 8 };

      searchArgs = applyStreetBotUserContextToSearchArgs(searchArgs, requestUserContext);
      if (moreArgs?.fallback_search_args) {
        moreArgs = {
          ...moreArgs,
          fallback_search_args: applyStreetBotUserContextToSearchArgs(
            moreArgs.fallback_search_args,
            requestUserContext,
          ),
        };
      }
      categoryArgs = applyStreetBotUserContextToSearchArgs(categoryArgs, requestUserContext);

      const toolCallId = `call_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
      const stepId = `step_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
      const toolName = `${toolBase}${Constants.mcp_delimiter}streetbot-rag`;
      const toolPayload = toolBase === 'services_more' && moreArgs ? moreArgs : searchArgs;
      const toolArgs = JSON.stringify(toolPayload);

      if (STREETBOT_FASTPATH_STREAMING_ENABLED) {
        GenerationJobManager.emitChunk(streamId, {
          event: 'on_run_step',
          data: {
            id: stepId,
            runId: responseMessageId,
            index: 0,
            stepDetails: {
              type: 'tool_calls',
              tool_calls: [
                {
                  id: toolCallId,
                  name: toolName,
                  args: toolArgs,
                },
              ],
            },
          },
        });
      }

      const ragStartedAt = Date.now();
      try {
        const searchPhase =
          toolBase === 'services_more'
            ? 'loading_more_results'
            : toolBase === 'services_categories'
              ? 'browsing_service_categories'
              : 'checking_directory';
        searchResult = await runProgressPhase(
          searchPhase,
          () =>
            withStreetBotSpan(
              toolBase === 'services_more'
                ? 'streetbot.rag.more'
                : toolBase === 'services_categories'
                  ? 'streetbot.rag.categories'
                  : 'streetbot.rag.search',
              {
                observationType: 'retriever',
                observation: {
                  input: summarizeStreetBotText(
                    searchArgs?.query || moreArgs?.fallback_search_args?.query || userText,
                  ),
                  metadata: {
                    toolBase,
                    requestedLimit:
                      searchArgs?.limit ??
                      moreArgs?.limit ??
                      moreArgs?.fallback_search_args?.limit ??
                      categoryArgs?.limit ??
                      null,
                    hasSessionId: Boolean(
                      moreArgs?.session_id || req._streetbotServiceContext?.session_id,
                    ),
                    city:
                      searchArgs?.city ||
                      moreArgs?.fallback_search_args?.city ||
                      req._streetbotServiceContext?.city ||
                      null,
                    province:
                      searchArgs?.province ||
                      moreArgs?.fallback_search_args?.province ||
                      req._streetbotServiceContext?.province ||
                      null,
                  },
                },
                attributes: {
                  'streetbot.rag.tool_base': toolBase,
                  'streetbot.rag.requested_limit':
                    searchArgs?.limit ??
                    moreArgs?.limit ??
                    moreArgs?.fallback_search_args?.limit ??
                    categoryArgs?.limit ??
                    0,
                },
              },
              async (span) => {
                let result;
                if (toolBase === 'services_more') {
                  let pagedResult = null;
                  if (moreArgs?.session_id) {
                    pagedResult = await buildMoreResults(
                      moreArgs.session_id,
                      moreArgs.limit,
                      moreArgs.fallback_search_args,
                    );
                  }
                  if (pagedResult?.ok) {
                    result = pagedResult;
                  } else if (moreArgs?.fallback_search_args?.query) {
                    result = await searchServicesInternal(moreArgs.fallback_search_args);
                  } else {
                    result = pagedResult || {
                      ok: false,
                      message:
                        'No previous Street Bot service search is available for more results yet.',
                      items: [],
                      count: 0,
                      returned_count: 0,
                      has_more: false,
                    };
                  }
                } else if (toolBase === 'services_categories') {
                  result = await categoriesInternal(categoryArgs);
                } else {
                  result = await searchServicesInternal(searchArgs);
                }

                applyStreetBotSpanAttributes(span, {
                  observationType: 'retriever',
                  observation: {
                    output: {
                      ok: result?.ok !== false,
                      browse: Boolean(result?.browse),
                      returnedCount:
                        Number(
                          result?.returned_count ?? result?.items?.length ?? result?.count ?? 0,
                        ) || 0,
                      hasMore: Boolean(result?.has_more),
                    },
                  },
                  attributes: {
                    'streetbot.rag.ok': result?.ok !== false,
                    'streetbot.rag.browse': Boolean(result?.browse),
                    'streetbot.rag.returned_count':
                      Number(
                        result?.returned_count ?? result?.items?.length ?? result?.count ?? 0,
                      ) || 0,
                    'streetbot.rag.has_more': Boolean(result?.has_more),
                  },
                });

                void capturePostHogRagSpan(
                  req,
                  userId,
                  conversationId,
                  toolBase,
                  toolPayload,
                  result,
                  Date.now() - ragStartedAt,
                );

                return result;
              },
            ),
          { toolBase },
        );
        searchResult = normalizeStreetBotDistanceFields(searchResult);
      } catch (error) {
        logger.error('[streetbot-fastpath] Weaviate search failed', error);
        searchResult = {
          ok: false,
          query: searchArgs.query || req._streetbotServiceContext?.query || userText,
          count: 0,
          returned_count: 0,
          has_more: false,
          items: [],
          error: error.message,
        };
      }

      const toolOutput = JSON.stringify(searchResult);
      if (STREETBOT_FASTPATH_STREAMING_ENABLED) {
        GenerationJobManager.emitChunk(streamId, {
          event: 'on_run_step_completed',
          data: {
            result: {
              id: stepId,
              tool_call: {
                name: toolName,
                args: toolArgs,
                output: toolOutput,
                id: toolCallId,
              },
            },
          },
        });
      }

      responseText =
        toolBase === 'services_categories'
          ? buildRenderedCategoryResponse(searchResult, userText, req.body?._streetbotUserContext)
          : buildRenderedServiceResponse(searchResult, userText);
      toolCallContent = {
        type: 'tool_call',
        tool_call: {
          name: toolName,
          args: toolArgs,
          output: toolOutput,
          id: toolCallId,
          progress: 1,
        },
      };
    }

    responseText = normalizeSelectedAgentResponseText(req, responseText);

    if (
      (STREETBOT_FASTPATH_STREAMING_ENABLED || forceStreetAgentTextStream) &&
      !responseAlreadyStreamed &&
      responseText
    ) {
      const responseStep = emitStreetBotResponseStepStart(
        streamId,
        responseMessageId,
        nextProgressStepIndex(),
        { force: forceStreetAgentTextStream },
      );
      const visibleResponseText =
        stripStreetBotServicePayloadForDisplay(responseText) || responseText;
      await emitStreetBotMessageText(
        streamId,
        responseStep?.stepId || responseMessageId,
        visibleResponseText,
        {
          delayMs: toolBase === 'smalltalk' ? STREETBOT_TEXT_STREAM_DELAY_MS : 0,
          force: forceStreetAgentTextStream,
        },
      );
      responseAlreadyStreamed = true;
    }

    const selectedStreetProfileIconURL = getSelectedStreetProfileAgentIconURL(req);
    const responseIconURL =
      selectedMarketplaceAgentIconURL || selectedStreetProfileIconURL || endpointOption.iconURL;

    const responseMessage = {
      messageId: responseMessageId,
      conversationId,
      parentMessageId: userMessageId,
      sender: selectedAgentSender,
      text: responseText,
      content: [{ type: 'text', text: responseText }],
      isCreatedByUser: false,
      user: userId,
      endpoint: endpointOption.endpoint,
      model: endpointOption.modelOptions?.model || endpointOption.model_parameters?.model,
      unfinished: false,
      error: false,
    };

    if (responseIconURL) {
      responseMessage.iconURL = responseIconURL;
    }

    if (req.body?.agent_id) {
      responseMessage.agent_id = req.body.agent_id;
    }

    const title = isNewConvo ? generateTitle(userText) : undefined;
    const convoData = {
      conversationId,
      endpoint: endpointOption.endpoint,
      model: endpointOption.modelOptions?.model || endpointOption.model_parameters?.model,
      modelLabel: selectedAgentSender,
      ...(title ? { title } : {}),
    };

    if (req.body?.agent_id) {
      convoData.agent_id = req.body.agent_id;
    }
    if (endpointOption.spec) {
      convoData.spec = endpointOption.spec;
    }
    if (responseIconURL) {
      convoData.iconURL = responseIconURL;
    }

    const finalEvent = {
      final: true,
      conversation: convoData,
      title: title || 'New Chat',
      requestMessage: sanitizeMessageForTransmit(userMessage),
      responseMessage: { ...responseMessage },
    };

    await saveMessage(req, userMessage, {
      context: 'streetbot-fastpath user message',
    });
    await saveMessage(req, responseMessage, {
      context: 'streetbot-fastpath response',
    });
    await saveConvo(req, convoData, {
      context: 'streetbot-fastpath conversation',
    });

    const pollStart = Date.now();
    const pollIntervalMs = 25;
    const subscriberTimeoutMs = 5000;
    const emitFinalAndComplete = async () => {
      await GenerationJobManager.emitDone(streamId, finalEvent);
      setTimeout(() => {
        GenerationJobManager.completeJob(streamId);
      }, 100);
    };
    const waitForSubscriber = () => {
      if (job.emitter.listenerCount() > 0) {
        void emitFinalAndComplete();
        return;
      }
      if (Date.now() - pollStart > subscriberTimeoutMs) {
        logger.warn('[streetbot-fastpath] subscriber timeout', { streamId });
        void emitFinalAndComplete();
        return;
      }
      setTimeout(waitForSubscriber, pollIntervalMs);
    };
    waitForSubscriber();

    const outcome = buildStreetBotOutcome(
      toolBase,
      detectedIntent,
      searchResult,
      Date.now() - startedAt,
    );
    const rewardLogEvent = buildRewardLogEvent(
      req,
      conversationId,
      toolBase,
      detectedIntent,
      searchResult,
      Date.now() - startedAt,
      outcome,
    );

    annotateStreetBotRequestTrace(req, {
      observation: {
        output: {
          routeKind: 'fastpath',
          toolBase,
          outcomeKind: outcome.kind,
          rewardProxyV1: outcome.rewardProxy,
          success: outcome.success,
          returnedCount: Number(searchResult?.returned_count ?? 0) || 0,
          hasMore: Boolean(searchResult?.has_more),
          browse: Boolean(searchResult?.browse),
          durationMs: Date.now() - startedAt,
        },
      },
      attributes: {
        'streetbot.fastpath.duration_ms': Date.now() - startedAt,
        'streetbot.outcome.kind': outcome.kind,
        'streetbot.outcome.success': outcome.success,
        'streetbot.reward.proxy_v1': outcome.rewardProxy,
        'streetbot.fastpath.returned_count': Number(searchResult?.returned_count ?? 0) || 0,
        'streetbot.fastpath.has_more': Boolean(searchResult?.has_more),
        'streetbot.fastpath.browse': Boolean(searchResult?.browse),
      },
    });

    void capturePostHogGeneration(
      req,
      userId,
      conversationId,
      toolBase,
      userText,
      responseText,
      Date.now() - startedAt,
      outcome,
      searchResult,
    );

    await decrementPendingRequest(userId);

    logger.info('[streetbot-fastpath] completed', {
      conversationId,
      toolBase,
      returnedCount: searchResult?.returned_count ?? 0,
      durationMs: Date.now() - startedAt,
    });
    logger.info(`[streetbot-reward] ${JSON.stringify(rewardLogEvent)}`);
  } catch (error) {
    annotateStreetBotRequestTrace(req, {
      observation: {
        level: 'ERROR',
        statusMessage: error?.message || 'streetbot-fastpath unexpected error',
      },
      attributes: {
        'streetbot.fastpath.error': true,
      },
    });
    logger.error('[streetbot-fastpath] unexpected error', error);
    void capturePostHogGenerationError(
      req,
      userId,
      String(req?.body?.conversationId || '').trim(),
      req?._streetbotFastPath?.toolBase || 'smalltalk',
      userText,
      error,
      Date.now() - startedAt,
    );
    try {
      GenerationJobManager.completeJob(streamId, error.message);
    } catch (_) {
      // ignore cleanup errors
    }
    await decrementPendingRequest(userId);
  }
}

module.exports = {
  buildRenderedServiceResponse,
  detectStreetBotIntent,
  isStreetBotEndpoint,
  looksLikeStreetBotServiceRequest,
  normalizeStreetBotMessagePayload,
  normalizeStreetBotResponse,
  streetbotFastPath,
};

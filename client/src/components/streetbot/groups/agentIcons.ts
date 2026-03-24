/**
 * Shared agent icon map — same MDI icons used in the model selector (librechat.yaml).
 * Keys are agent slugs (as used in the groups API), values are CDN icon URLs.
 */

const CDN = "https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/svg";

export const AGENT_ICONS: Record<string, string> = {
  // Executive
  "ceo": `${CDN}/account-tie.svg`,
  "auto-router": `${CDN}/auto-fix.svg`,
  "executive-memory": `${CDN}/brain.svg`,
  "executive_memory": `${CDN}/brain.svg`,
  "security-compliance": `${CDN}/shield-check.svg`,
  "security_compliance": `${CDN}/shield-check.svg`,

  // Communication
  "communication-manager": `${CDN}/message-text.svg`,
  "communication_manager": `${CDN}/message-text.svg`,
  "email-agent": `${CDN}/email.svg`,
  "email_agent": `${CDN}/email.svg`,
  "slack-agent": `${CDN}/slack.svg`,
  "slack_agent": `${CDN}/slack.svg`,
  "whatsapp-agent": `${CDN}/whatsapp.svg`,
  "whatsapp_agent": `${CDN}/whatsapp.svg`,
  "calendar-agent": `${CDN}/calendar-clock.svg`,
  "calendar_agent": `${CDN}/calendar-clock.svg`,
  "social-agent": `${CDN}/share-variant.svg`,
  "social_agent": `${CDN}/share-variant.svg`,
  "communication-memory": `${CDN}/database-sync.svg`,
  "communication_memory": `${CDN}/database-sync.svg`,

  // Content
  "content-manager": `${CDN}/newspaper-variant-multiple.svg`,
  "content_manager": `${CDN}/newspaper-variant-multiple.svg`,
  "article-researcher": `${CDN}/book-search.svg`,
  "article_researcher": `${CDN}/book-search.svg`,
  "article-writer": `${CDN}/typewriter.svg`,
  "article_writer": `${CDN}/typewriter.svg`,
  "social-media": `${CDN}/share-variant.svg`,
  "social_media_manager": `${CDN}/share-variant.svg`,
  "content-memory": `${CDN}/database-sync.svg`,
  "content_memory": `${CDN}/database-sync.svg`,

  // Development
  "dev-manager": `${CDN}/code-braces-box.svg`,
  "development_manager": `${CDN}/code-braces-box.svg`,
  "backend-dev": `${CDN}/server.svg`,
  "backend_developer": `${CDN}/server.svg`,
  "frontend-dev": `${CDN}/monitor-dashboard.svg`,
  "frontend_developer": `${CDN}/monitor-dashboard.svg`,
  "database-admin": `${CDN}/database.svg`,
  "database_manager": `${CDN}/database.svg`,
  "devops": `${CDN}/cloud-cog.svg`,
  "development-memory": `${CDN}/database-sync.svg`,
  "development_memory": `${CDN}/database-sync.svg`,

  // Finance
  "finance-manager": `${CDN}/finance.svg`,
  "finance_manager": `${CDN}/finance.svg`,
  "accounting-agent": `${CDN}/calculator-variant.svg`,
  "accounting_agent": `${CDN}/calculator-variant.svg`,
  "crypto-agent": `${CDN}/bitcoin.svg`,
  "crypto_agent": `${CDN}/bitcoin.svg`,
  "finance-memory": `${CDN}/database-sync.svg`,
  "finance_memory": `${CDN}/database-sync.svg`,

  // Grant Writing
  "grant-manager": `${CDN}/file-document-edit.svg`,
  "grant_manager": `${CDN}/file-document-edit.svg`,
  "grant-writer": `${CDN}/text-box-edit.svg`,
  "grant_writer": `${CDN}/text-box-edit.svg`,
  "budget-manager": `${CDN}/cash-multiple.svg`,
  "budget_manager": `${CDN}/cash-multiple.svg`,
  "project-manager": `${CDN}/clipboard-check.svg`,
  "project_manager": `${CDN}/clipboard-check.svg`,
  "grant-memory": `${CDN}/database-sync.svg`,
  "grant_memory": `${CDN}/database-sync.svg`,

  // Research
  "research-manager": `${CDN}/magnify-scan.svg`,
  "research_manager": `${CDN}/magnify-scan.svg`,
  "media-platform-researcher": `${CDN}/cellphone-link.svg`,
  "media_platform_researcher": `${CDN}/cellphone-link.svg`,
  "media-program-researcher": `${CDN}/television-classic.svg`,
  "media_program_researcher": `${CDN}/television-classic.svg`,
  "street-bot-researcher": `${CDN}/map-marker-radius.svg`,
  "street_bot_researcher": `${CDN}/map-marker-radius.svg`,
  "research-memory": `${CDN}/database-sync.svg`,
  "research_memory": `${CDN}/database-sync.svg`,

  // Scraping
  "scraping-manager": `${CDN}/spider-web.svg`,
  "scraping_manager": `${CDN}/spider-web.svg`,
  "scraping-agent": `${CDN}/web.svg`,
  "scraping_agent": `${CDN}/web.svg`,
  "scraper-memory": `${CDN}/database-sync.svg`,
  "scraper_memory": `${CDN}/database-sync.svg`,
};

/** Icon for the group itself — uses the lead agent's icon. */
export const GROUP_ICONS: Record<number, string> = {
  1: AGENT_ICONS["ceo"],
  2: AGENT_ICONS["communication-manager"],
  3: AGENT_ICONS["content-manager"],
  4: AGENT_ICONS["dev-manager"],
  5: AGENT_ICONS["finance-manager"],
  6: AGENT_ICONS["grant-manager"],
  7: AGENT_ICONS["research-manager"],
  8: AGENT_ICONS["scraping-manager"],
};

/** Accent colors for groups — used for icon backgrounds. */
export const GROUP_COLORS: Record<number, string> = {
  1: "#7C3AED",  // purple — Executive
  2: "#0EA5E9",  // blue — Communication
  3: "#F59E0B",  // amber — Content
  4: "#10B981",  // green — Development
  5: "#EF4444",  // red — Finance
  6: "#8B5CF6",  // violet — Grant Writing
  7: "#06B6D4",  // cyan — Research
  8: "#F97316",  // orange — Scraping
};

/** Team colors keyed by team slug (for agent marketplace). */
export const TEAM_COLORS: Record<string, string> = {
  executive: "#7C3AED",
  communication: "#0EA5E9",
  content: "#F59E0B",
  development: "#10B981",
  finance: "#EF4444",
  grant_writing: "#8B5CF6",
  research: "#06B6D4",
  scraping: "#F97316",
};

/** Team display names keyed by slug. */
export const TEAM_DISPLAY_NAMES: Record<string, string> = {
  executive: "Executive",
  communication: "Communication",
  content: "Content",
  development: "Development",
  finance: "Finance",
  grant_writing: "Grant Writing",
  research: "Research",
  scraping: "Scraping",
};

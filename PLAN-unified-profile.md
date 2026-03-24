# Plan: Unified Street Profile Page

## Goal
Make the Street Profile page (`/settings`) a unified hub where Joel can see everything about a user in one place — full features embedded, not just summaries. All data scoped to the individual user.

## Current State
- **SettingsPage.tsx** has tabs: News, Services, Messages, Tasks, Calendar, Documents, About (+ admin-only: Timeline, Jobs, Gallery, Communities, Portfolio)
- Messages, Tasks, Calendar, Documents tabs are lightweight summaries fetching from `/sbapi`
- Full features live in separate apps: Social DM (`localhost:3182/dm`), Mission Control (`/STR/dashboard`), Calendar, etc.

## Plan

### Phase 1: Upgrade Existing Tabs to Full Features

**1. Messages Tab → Full DM Interface**
- Replace `MessagesSummary.tsx` with an embedded iframe of `/social/dm`
- Iframe styled to fill the tab area seamlessly, matching theme (dark/light)
- Pass theme via URL param or postMessage so Social app matches
- Scoped: shows only conversations for the current user

**2. Tasks Tab → Full Task Board**
- Replace `TasksSummary.tsx` with an embedded iframe of `/STR/dashboard`
- Or build a native TaskBoard component using the existing `TasksPage.tsx` + API (`/sbapi/tasks`)
- Scoped: filtered to tasks assigned to / created by the current user

**3. Calendar Tab → Full Calendar**
- Replace `CalendarSummary.tsx` with embedded iframe of the calendar page
- Or build native calendar component using Google Calendar MCP data
- Scoped: shows only the user's events

**4. Documents Tab → Full File Manager**
- Replace `DocumentsSummary.tsx` with embedded iframe or native component
- Connect to Google Drive MCP for real file listing
- Scoped: user's files only

### Phase 2: Add New Tabs

**5. Storage/Files Tab**
- Google Drive integration showing user's files, folders, recent uploads
- Quick actions: open, share link, download
- Uses existing Google Drive MCP tools

**6. Social Media Tab**
- Connected social accounts overview
- Scheduled posts (from IG Automations / Social Media features)
- Basic analytics per account
- Scoped to user's connected accounts

**7. Contacts/Directory Tab**
- User's connections, followers, following
- Quick DM button, view profile
- Uses existing `/sbapi/profiles` endpoints
- Scoped: the user's network only

**8. Activity Feed Tab**
- Chronological feed of user's actions across all features
- Sent messages, completed tasks, posted news, calendar events attended
- Aggregates from multiple API endpoints
- Scoped: only this user's activity

### Implementation Approach: Iframe First

For speed and reliability, we'll use **iframes** for Messages, Tasks, and Calendar since those features already exist as full pages in separate apps. Each iframe:
- Matches the current theme (dark/light) via URL param `?theme=dark`
- Has seamless borders (no iframe chrome visible)
- Fills the full tab content area
- Social app theme sync: add a `useEffect` in the Social app that reads `?theme=` param and applies it

For **Storage, Social Media, Contacts, Activity Feed** — these will be native React components built directly in SettingsPage since they don't have existing full-page equivalents.

### Files to Modify

1. **`client/src/components/streetbot/settings/SettingsPage.tsx`**
   - Add new tab IDs: `storage`, `social-media`, `contacts`, `activity`
   - Update `mainTabs` array and `USER_MAIN_TABS` set
   - Render iframes for Messages/Tasks/Calendar/Documents tabs
   - Render new native components for Storage/Social Media/Contacts/Activity

2. **`client/src/components/streetbot/settings/tabs/MessagesSummary.tsx`** → rename to `MessagesEmbed.tsx`
   - Replace summary with iframe pointing to `/social/dm?theme={theme}&embed=true`

3. **`client/src/components/streetbot/settings/tabs/TasksSummary.tsx`** → rename to `TasksEmbed.tsx`
   - Replace summary with iframe pointing to `/STR/dashboard?theme={theme}&embed=true`

4. **`client/src/components/streetbot/settings/tabs/CalendarSummary.tsx`** → rename to `CalendarEmbed.tsx`
   - Replace with iframe or enhanced calendar component

5. **`client/src/components/streetbot/settings/tabs/DocumentsSummary.tsx`** → rename to `DocumentsEmbed.tsx`
   - Replace with file manager component

6. **NEW: `client/src/components/streetbot/settings/tabs/StorageTab.tsx`**
7. **NEW: `client/src/components/streetbot/settings/tabs/SocialMediaTab.tsx`**
8. **NEW: `client/src/components/streetbot/settings/tabs/ContactsTab.tsx`**
9. **NEW: `client/src/components/streetbot/settings/tabs/ActivityFeedTab.tsx`**

10. **Social app theme sync** — `/social/src/app/layout.tsx` or a new `useThemeSync` hook that reads URL params

### Build & Deploy
- Edit source files in `client/src/`
- Build frontend on host: `npm run frontend` (since container lacks dev deps)
- Copy built `client/dist/` into Docker container
- Restart container

### Phase 0: Universal Sidebar (DO FIRST)

Make the unified sidebar appear on ALL pages and make all content respond to its collapse/expand.

**Current state:**
- ✅ LibreChat pages (`/`, `/c/new`, `/c/:id`, `/home`) — sidebar present + responsive
- ✅ Paperclip/STR pages (`/STR/*`) — sidebar present + responsive
- ❌ Social pages (`/social/*`) — has its OWN internal sidebar, no unified sidebar
- ❌ LobeHub/Marketplace (`/discover/*`) — no sidebar at all

**What to do:**

**A. Social App (`/social/*`)**
- `unified-nav.js` IS already injected via nginx but not functional
- Problem: Social has its own full-screen layout (`flex h-screen`) with its own Sidebar component
- Fix: When unified sidebar is detected, hide the Social app's internal sidebar and shift content
- Add CSS in unified-nav.js that targets Social pages: hide Social's own `<Sidebar>`, add left margin matching unified sidebar width
- When sidebar collapses to 56px, Social content gets `margin-left: 56px`
- When sidebar expands, Social content gets `margin-left: 260px` (or whatever the sidebar width is)
- Social's own sidebar navigation items should be merged into unified sidebar (Messages, Channels already there)

**B. LobeHub/Marketplace (`/discover/*`)**
- Currently proxied at `/discover/*` through nginx on port 3180
- unified-nav.js needs to detect these routes and inject the sidebar
- LobeHub's own left sidebar is already hidden via CSS
- Add `margin-left` to LobeHub's main content area to respect unified sidebar
- When collapsed: `margin-left: 56px`, when expanded: full sidebar width

**C. Responsive behavior for ALL pages**
- unified-nav.js already handles collapse/expand via `.sv-collapsed` class
- Currently shifts `#root > div.flex` via `marginLeft`
- Need to make this work for Social's root div and LobeHub's root div too
- Use a generic CSS rule: when sidebar is present, ALL main content areas get the margin
- CSS approach: `body > * { transition: margin-left 0.2s; }` scoped to sidebar state

**Files to modify:**
- `client/public/unified-nav.js` — add Social + LobeHub page detection, inject sidebar margin CSS for those pages
- `nginx-unified.conf` — ensure unified-nav.js is injected on all routes (already is for Social, verify LobeHub)
- `social/src/components/layout/Sidebar.tsx` — add `display:none` when `?embed=true` or when unified sidebar is detected

### Order of Execution
0. **Universal sidebar** — make sidebar work on Social + LobeHub pages
1. Messages tab (iframe → Social DM) — quickest win
2. Tasks tab (iframe → Mission Control)
3. Calendar tab (iframe or native)
4. Documents tab (native component)
5. Contacts tab (native)
6. Activity Feed tab (native)
7. Storage tab (native)
8. Social Media tab (native)

// AnalyticsPage — the /analytics dashboard.
//
// Mounted from LibreChat's routes/index.tsx. Wrapped in <AnalyticsGuard> so
// only admins reach it. Hidden URL — not registered in any nav.
//
// Two-level tab nav:
//   Top: Overview · Live · Sections ▾ · Replay · Data Quality · Platform
//   Sub (when "Sections" active): Home · New Chat · Notifications · Search ·
//        Email · Street Profile · Street Gallery · News · Directory ·
//        Job Board · Academy · Calendar · Case Management
//
// Branch: local/analytics-platform.

import * as React from 'react';
import './brand.css';

import { OverviewTab }       from './tabs/OverviewTab';
import { LiveTab }           from './tabs/LiveTab';
import { ReplayTab }         from './tabs/ReplayTab';
import { DataQualityTab }    from './tabs/DataQualityTab';
import { PlatformHealthTab } from './tabs/PlatformHealthTab';
import { HomeSection }          from './tabs/sections/HomeSection';
import { NewChatSection }       from './tabs/sections/NewChatSection';
import { NotificationsSection } from './tabs/sections/NotificationsSection';
import { SearchSection }        from './tabs/sections/SearchSection';
import { EmailSection }         from './tabs/sections/EmailSection';
import { StreetProfileSection } from './tabs/sections/StreetProfileSection';
import { StreetGallerySection } from './tabs/sections/StreetGallerySection';
import { NewsSection }          from './tabs/sections/NewsSection';
import { DirectorySection }     from './tabs/sections/DirectorySection';
import { JobBoardSection }      from './tabs/sections/JobBoardSection';
import { AcademySection }       from './tabs/sections/AcademySection';
import { CalendarSection }      from './tabs/sections/CalendarSection';
import { CaseManagementSection } from './tabs/sections/CaseManagementSection';
import { SectionPlaceholder }   from './tabs/sections/SectionPlaceholder';

const TOP_TABS = [
  { key: 'overview',   label: 'Overview' },
  { key: 'live',       label: 'Live' },
  { key: 'sections',   label: 'Sections' },
  { key: 'replay',     label: 'Replay' },
  { key: 'quality',    label: 'Data Quality' },
  { key: 'platform',   label: 'Platform' },
];

const SECTION_TABS = [
  { key: 'home',            label: 'Home' },
  { key: 'new-chat',        label: 'New Chat' },
  { key: 'notifications',   label: 'Notifications' },
  { key: 'search',          label: 'Search' },
  { key: 'email',           label: 'Email' },
  { key: 'street-profile',  label: 'Street Profile' },
  { key: 'street-gallery',  label: 'Street Gallery' },
  { key: 'news',            label: 'News' },
  { key: 'directory',       label: 'Directory' },
  { key: 'jobs',            label: 'Job Board' },
  { key: 'academy',         label: 'Academy' },
  { key: 'calendar',        label: 'Calendar' },
  { key: 'case-management', label: 'Case Management' },
];

export default function AnalyticsPage() {
  // Hash format: "#top" or "#top:section" — both encoded so URL survives refresh.
  const [active,    setActive]    = React.useState<string>(() => initialTopFromHash());
  const [activeSec, setActiveSec] = React.useState<string>(() => initialSectionFromHash());

  React.useEffect(() => {
    const handler = () => {
      setActive(initialTopFromHash());
      setActiveSec(initialSectionFromHash());
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  React.useEffect(() => {
    const want = active === 'sections' ? `${active}:${activeSec}` : active;
    if (location.hash !== `#${want}`) {
      history.replaceState(null, '', `${location.pathname}${location.search}#${want}`);
    }
  }, [active, activeSec]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase();

  return (
    <div className="sv-analytics" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="sv-page-header">
        <div className="sv-page-header__inner">
          <div className="sv-page-header__brand">
            <img src="/assets/streetbot-icon.svg" alt="Street Voices" />
            <div className="sv-page-header__brand-text">
              <span className="sv-page-header__brand-name">Street Voices</span>
              <span className="sv-page-header__brand-sub">Analytics</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="sv-datecap" style={{ marginBottom: 0 }}>{today}</span>
            <button
              className="sv-btn sv-btn--ghost"
              style={{ width: 'auto', padding: '8px 16px', fontSize: 12 }}
              onClick={() => location.reload()}
              data-track="analytics.refresh">
              ↻ Refresh
            </button>
          </div>
        </div>

        <nav className="sv-tabnav" role="tablist">
          {TOP_TABS.map(t => (
            <button
              key={t.key}
              role="tab"
              aria-selected={t.key === active}
              onClick={() => setActive(t.key)}
              data-track={`analytics.tab.${t.key}`}>
              {t.label}{t.key === 'sections' ? ' ▾' : ''}
            </button>
          ))}
        </nav>
      </header>

      {active === 'sections' ? (
        <div className="sv-subtabs" role="tablist">
          {SECTION_TABS.map(t => (
            <button
              key={t.key}
              role="tab"
              aria-selected={t.key === activeSec}
              onClick={() => setActiveSec(t.key)}
              data-track={`analytics.section.${t.key}`}>
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      <main className="sv-page-body" style={{ flex: 1, overflowY: 'auto' }}>
        {active === 'overview'  ? <OverviewTab /> : null}
        {active === 'live'      ? <LiveTab /> : null}
        {active === 'replay'    ? <ReplayTab /> : null}
        {active === 'quality'   ? <DataQualityTab /> : null}
        {active === 'platform'  ? <PlatformHealthTab /> : null}

        {active === 'sections' && activeSec === 'home'           ? <HomeSection /> : null}
        {active === 'sections' && activeSec === 'new-chat'       ? <NewChatSection /> : null}
        {active === 'sections' && activeSec === 'notifications'  ? <NotificationsSection /> : null}
        {active === 'sections' && activeSec === 'search'         ? <SearchSection /> : null}
        {active === 'sections' && activeSec === 'email'          ? <EmailSection /> : null}
        {active === 'sections' && activeSec === 'street-profile' ? <StreetProfileSection /> : null}
        {active === 'sections' && activeSec === 'street-gallery' ? <StreetGallerySection /> : null}
        {active === 'sections' && activeSec === 'news'           ? <NewsSection /> : null}
        {active === 'sections' && activeSec === 'directory'      ? <DirectorySection /> : null}
        {active === 'sections' && activeSec === 'jobs'           ? <JobBoardSection /> : null}
        {active === 'sections' && activeSec === 'academy'        ? <AcademySection /> : null}
        {active === 'sections' && activeSec === 'calendar'       ? <CalendarSection /> : null}
        {active === 'sections' && activeSec === 'case-management'? <CaseManagementSection /> : null}
        {active === 'sections' && !['home','new-chat','notifications','search','email','street-profile','street-gallery','news','directory','jobs','academy','calendar','case-management'].includes(activeSec) ? (
          <SectionPlaceholder
            sectionKey={activeSec}
            sectionLabel={SECTION_TABS.find(s => s.key === activeSec)?.label ?? activeSec}
          />
        ) : null}
      </main>
    </div>
  );
}

function initialTopFromHash(): string {
  const want = (location.hash || '').replace(/^#/, '').split(':')[0];
  return TOP_TABS.some(t => t.key === want) ? want : 'overview';
}
function initialSectionFromHash(): string {
  const parts = (location.hash || '').replace(/^#/, '').split(':');
  const want  = parts[1];
  return SECTION_TABS.some(s => s.key === want) ? want : 'home';
}

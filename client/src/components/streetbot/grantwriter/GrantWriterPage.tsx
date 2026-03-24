import React, { useState, useCallback, useEffect } from 'react';
import { DEFAULT_COLORS } from '../tasks/constants';
import GrantPipelineSidebar from './GrantPipelineSidebar';
import GrantFormView from './GrantFormView';
import OrgProfileView from './OrgProfileView';
import GrantDetailPanel from './GrantDetailPanel';
import NewGrantModal from './NewGrantModal';
import { YOF_GRANT_SECTIONS, NBA_GRANT_SECTIONS, loadOrgProfile, saveOrgProfile } from './grantSections';
import type { GrantSection } from './grantSections';
import type { GrantOpportunity } from './grantTypes';
import { DEFAULT_ROWS as DEFAULT_BUDGET_ROWS } from './BudgetBuilder';
import type { BudgetRow } from './BudgetBuilder';
import { DEFAULT_PLAN_ROWS } from './ProjectPlanBuilder';
import type { ProjectPlanRow } from './ProjectPlanBuilder';

const C = DEFAULT_COLORS;

// ── Persistence helpers ──
const GRANTS_KEY = 'sv-grants-pipeline';
const GRANT_SECTIONS_KEY = 'sv-grant-sections'; // keyed by grant id

// Default intelligence data keyed by grant ID
const DEFAULT_INTELLIGENCE: Record<string, GrantOpportunity['intelligence']> = {
  'yof-scale-2026': {
    funderMission: 'OTF invests in community-based initiatives that build healthy, vibrant communities across Ontario. The Youth Opportunities Fund specifically targets systemic barriers facing equity-deserving youth.',
    funderPriorities: [
      'Projects led by and for Indigenous (First Nation, Métis, Inuit) and Black youth',
      'Grassroots organizations with lived experience connection to beneficiaries',
      'Evidence of 2+ years proven delivery with measurable impact',
      'Youth-led governance (>50% youth in core group)',
      'Scalability — deepening impact or expanding reach',
    ],
    scoringCriteria: [
      { criterion: 'Alignment with Priority Outcome', weight: 'High', description: 'Project directly addresses one of the 5 priority outcomes' },
      { criterion: 'Youth Leadership', weight: 'High', description: 'Youth make decisions, not just participate' },
      { criterion: 'Lived Experience', weight: 'High', description: 'Core members share identities/experiences of beneficiaries' },
      { criterion: 'Track Record', weight: 'Medium', description: '2+ years consistent delivery with demonstrated results' },
      { criterion: 'Scaling Readiness', weight: 'Medium', description: 'Clear evidence project is ready to grow' },
      { criterion: 'Budget Alignment', weight: 'Medium', description: 'Costs clearly tied to activities; includes 15% admin + capacity building' },
    ],
    evaluationProcess: 'Two-stage: Expression of Interest reviewed first, then shortlisted orgs invited to full application. Community reviewers with lived experience are part of the panel.',
    eligibilityRequirements: [
      'Unregistered grassroots group OR non-profit with ≤$50K annual revenue',
      'Based in Ontario, serving Ontario youth',
      '>50% of core group are youth (ages 12-29)',
      'Minimum 3 core members with arm\'s-length relationships',
      'Delivered core activities for 2+ years',
      'Not a registered charity',
    ],
    ineligible: [
      'Registered charities',
      'Religious organizations',
      'Municipalities, schools, universities, hospitals',
      'For-profit organizations',
      'Groups with mostly 30+ members',
    ],
    geoRestrictions: 'Ontario only',
    averageGrantSize: '$100K-$150K/yr',
    keyDates: [
      { date: 'Feb 4 - Apr 15, 2026', label: 'EOI Window' },
      { date: 'Jan 7 - Jun 17, 2026', label: 'Org Mentor Application' },
      { date: 'Jul 8, 2026', label: 'Full Application Due' },
    ],
    reportingRequirements: 'Annual progress reports + final report. Potential compliance audits.',
    tips: [
      'Use data and testimonials to show impact — not just activities',
      'Be specific about HOW youth lead, not just that they participate',
      'Budget must include 15% admin support AND $2K-$4K/yr capacity building',
      'Organizational Mentor must be confirmed before full application',
      'Address systemic barriers, not just symptoms',
    ],
    commonMistakes: [
      'Vague project descriptions without measurable outcomes',
      'Claiming youth-led without showing governance structure',
      'Budget that doesn\'t match the narrative activities',
      'Missing the Organizational Mentor requirement',
    ],
    whatMakesStrong: 'Applications that demonstrate authentic youth leadership, show a clear theory of change with measurable outcomes, and articulate how the project addresses root causes of systemic inequity — not just surface-level programming.',
    lastUpdated: '2026-03-23',
    guidelinesPdfUrl: 'https://otf.ca/our-grants/youth-opportunities-fund/youth-innovations-scale-grant',
    faqUrl: 'https://otf.ca/our-grants/youth-opportunities-fund',
  },
  'nba-foundation-2026': {
    funderMission: 'The NBA Foundation was created to drive economic empowerment for Black communities through employment and career advancement, with a focus on Black youth ages 14-24 in NBA markets across the U.S. and Canada.',
    funderPriorities: [
      'Economic empowerment and career advancement for Black youth ages 14-24',
      'Programs operating in NBA markets (teams\' geographic areas)',
      'Workforce readiness — job training, credential programs, internships, apprenticeships',
      'Education pathways — high school graduation, college access, college persistence/completion',
      'Direct employment outcomes — job placement (FT/PT), post-college career entry',
    ],
    scoringCriteria: [
      { criterion: 'Program Impact & Outcomes', weight: 'High', description: 'Clear, measurable outcomes tied to economic empowerment. Specific projected numbers for youth served and outcomes achieved. Source: FLUXX application "Projected Outcomes" section' },
      { criterion: 'Program Model & Design', weight: 'High', description: 'Well-structured program with clear recruitment, service delivery, and support infrastructure. Must articulate how model leads to economic outcomes. Source: FLUXX "Program Model" field (1875 char limit)' },
      { criterion: 'Statement of Need', weight: 'High', description: 'Evidence-based articulation of the issue being addressed. Must connect to systemic barriers facing Black youth in your NBA market. Source: FLUXX "Current Issue / Statement of Need" (1875 chars)' },
      { criterion: 'Track Record', weight: 'High', description: 'Demonstrated history of delivering programming with measurable results. Not just years of operation, but actual outcomes achieved. Source: FLUXX "Track Record" field (1875 chars)' },
      { criterion: 'Evaluation Methods', weight: 'Medium', description: 'Both quantitative and qualitative indicators. Shows org has systems to measure impact, not just anecdotal evidence. Source: FLUXX "Evaluation" field (1000 chars)' },
      { criterion: 'Financial Health', weight: 'Medium', description: 'Reviewed via Financial Health Worksheet — revenue, expenses, cash on hand, current ratio. Demonstrates fiscal responsibility and sustainability. Source: FLUXX Financial Information section' },
      { criterion: 'NBA Market Alignment', weight: 'Medium', description: 'Program serves youth in a specific NBA team\'s market area. Relationship with local NBA team is a plus but not required. Source: FLUXX "Target NBA Market(s)" + partnership questions' },
      { criterion: 'Budget Alignment', weight: 'Medium', description: 'Budget template must be downloaded, completed, and uploaded. Costs should clearly tie to program activities described in the application. Source: FLUXX Documents section' },
    ],
    evaluationProcess: 'Applications are reviewed by NBA Foundation staff and external reviewers. The portal validates required fields (mission, social media, financial worksheet, target market, documents) before allowing submission. Strong alignment with economic empowerment for Black youth is the primary lens.',
    eligibilityRequirements: [
      'Domiciled in the US or Canada',
      'Filed Form 990/990-EZ (US) or T3010 (Canada)',
      'Serves youth ages 14-24 in an NBA market',
      'Provides programming within workforce/education scope',
      'Not a hospital, child day care, or K-12 school',
      'Must have organizational mission, year founded, and social media completed in profile',
    ],
    ineligible: [
      'Hospitals and child day care facilities',
      'K-12 schools',
      'Organizations not serving youth 14-24',
      'Organizations outside NBA market areas',
      'Organizations that haven\'t filed 990/T3010',
    ],
    geoRestrictions: 'Must serve youth in an NBA team market area. Toronto Raptors market for Canadian orgs.',
    averageGrantSize: '$250,000',
    totalFunding: 'Range: $25K - $500K per grant',
    keyDates: [
      { date: 'Rolling', label: 'Application Intake' },
      { date: 'Within 24hrs', label: 'Email Verification (after account creation)' },
    ],
    reportingRequirements: 'Portal provides reporting templates if funded. Annual reporting on projected outcomes vs. actuals expected.',
    tips: [
      'Fill out the org profile completely BEFORE starting the application — mission, year founded, and all social media are required to submit',
      'Complete the Financial Health Worksheet with your most recent T3010 data — the portal auto-calculates ratios',
      'Download and complete the budget template (Excel) — don\'t create your own format',
      'Be specific with projected outcome numbers — enter 0 for categories that don\'t apply rather than leaving blank',
      'Program description must be 2 sentences or less (500 chars) — be concise and impactful',
      'If you have any NBA team connection or referral, highlight it — partnerships are valued',
    ],
    commonMistakes: [
      'Not completing the org profile (mission, social media) before trying to submit',
      'Leaving the Financial Health Worksheet incomplete',
      'Not downloading and using the official budget template',
      'Vague projected outcomes without specific numbers',
      'Program description exceeding 2 sentences / 500 chars',
      'Not uploading required documents (T3010, board list, org budget, logo)',
    ],
    whatMakesStrong: 'Applications that demonstrate a proven track record of economic empowerment for Black youth, with specific measurable outcomes (jobs secured, credentials earned, college enrollment), a clear and replicable program model, and strong financial health. Organizations with NBA team partnerships score higher.',
    lastUpdated: '2026-03-23',
    guidelinesPdfUrl: 'https://nbafoundation.fluxx.io',
    faqUrl: 'https://www.nbafoundation.nba.com/faq',
    additionalResources: [
      { label: 'NBA Foundation Website', url: 'https://www.nbafoundation.nba.com' },
      { label: 'FLUXX Grant Portal', url: 'https://nbafoundation.fluxx.io' },
      { label: 'NBA Markets Zip Codes', url: 'https://nbafoundation.fluxx.io' },
    ],
  },
};

// The canonical list of built-in grant IDs — if any are missing from localStorage, re-add them
const BUILT_IN_GRANT_IDS = ['yof-scale-2026', 'nba-foundation-2026', 'tgrip-extension'];

function loadGrants(): GrantOpportunity[] {
  try {
    const saved = localStorage.getItem(GRANTS_KEY);
    if (saved) {
      const grants: GrantOpportunity[] = JSON.parse(saved);
      // Merge default intelligence into loaded grants if missing
      for (const g of grants) {
        if (!g.intelligence && DEFAULT_INTELLIGENCE[g.id]) {
          g.intelligence = DEFAULT_INTELLIGENCE[g.id];
        }
      }
      // Ensure all built-in grants are present (may have been archived or lost)
      const defaults = getDefaultGrants();
      for (const d of defaults) {
        if (!grants.find(g => g.id === d.id)) {
          grants.push(d);
        }
      }
      return grants;
    }
  } catch { /* ignore */ }
  return getDefaultGrants();
}

function getDefaultGrants(): GrantOpportunity[] {
  return [
    {
      id: 'yof-scale-2026',
      name: 'Youth Innovations Scale Grant',
      funder: 'Ontario Trillium Foundation',
      funderAbbrev: 'OTF',
      amount: 'Up to $150K/yr × 2-3 years',
      deadline: 'April 15, 2026 (EOI)',
      stage: 'identified',
      url: 'https://otf.ca/our-grants/youth-opportunities-fund/youth-innovations-scale-grant',
      assessment: {
        missionAlignment: 4, competitiveness: 3, effortToReward: 4,
        strategicValue: 5, capacity: 3, recommendation: 'pursue',
      },
      documents: { opportunity: true, narrative: false, budget: false, projectPlan: false },
      intelligence: DEFAULT_INTELLIGENCE['yof-scale-2026'],
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
      assessment: {
        missionAlignment: 4, competitiveness: 3, effortToReward: 4,
        strategicValue: 5, capacity: 3, recommendation: 'pursue',
      },
      documents: { opportunity: true, narrative: false, budget: false, projectPlan: false },
      intelligence: DEFAULT_INTELLIGENCE['nba-foundation-2026'],
    },
    {
      id: 'tgrip-extension',
      name: 'TGRIP — Organizational Capacity Development',
      funder: 'Toronto Grants',
      funderAbbrev: 'TGRIP',
      stage: 'active',
      documents: { opportunity: true, narrative: true, budget: true, projectPlan: true },
    },
  ];
}

function saveGrants(grants: GrantOpportunity[]) {
  localStorage.setItem(GRANTS_KEY, JSON.stringify(grants));
}

function loadGrantSections(grantId: string): GrantSection[] | null {
  try {
    const saved = localStorage.getItem(`${GRANT_SECTIONS_KEY}-${grantId}`);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return null;
}

function saveGrantSections(grantId: string, sections: GrantSection[]) {
  localStorage.setItem(`${GRANT_SECTIONS_KEY}-${grantId}`, JSON.stringify(sections));
}

const ARCHIVED_KEY = 'sv-grants-archived';

function loadArchivedGrants(): GrantOpportunity[] {
  try {
    const saved = localStorage.getItem(ARCHIVED_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [];
}

function saveArchivedGrants(grants: GrantOpportunity[]) {
  localStorage.setItem(ARCHIVED_KEY, JSON.stringify(grants));
}

export default function GrantWriterPage() {
  const [grants, setGrants] = useState<GrantOpportunity[]>(loadGrants);
  const [archivedGrants, setArchivedGrants] = useState<GrantOpportunity[]>(loadArchivedGrants);
  const [activeGrantId, setActiveGrantId] = useState(grants[0]?.id || '');
  const [showOrgProfile, setShowOrgProfile] = useState(false);
  const [showNewGrantModal, setShowNewGrantModal] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Per-grant sections — loaded from localStorage or defaults
  // If a known grant template has more sections than what's saved, refresh from template
  const [sectionsByGrant, setSectionsByGrant] = useState<Record<string, GrantSection[]>>(() => {
    const initial: Record<string, GrantSection[]> = {};
    for (const g of loadGrants()) {
      const saved = loadGrantSections(g.id);
      const isNba = g.id === 'nba-foundation-2026' || g.name?.toLowerCase().includes('nba');
      const isYof = g.id === 'yof-scale-2026';

      // Use template if no saved data, or if template has more sections (updated)
      if (isNba) {
        if (saved && saved.length >= NBA_GRANT_SECTIONS.length) {
          initial[g.id] = saved;
        } else {
          initial[g.id] = JSON.parse(JSON.stringify(NBA_GRANT_SECTIONS));
        }
      } else if (isYof) {
        if (saved && saved.length >= YOF_GRANT_SECTIONS.length) {
          initial[g.id] = saved;
        } else {
          initial[g.id] = JSON.parse(JSON.stringify(YOF_GRANT_SECTIONS));
        }
      } else if (saved) {
        initial[g.id] = saved;
      }
    }
    return initial;
  });

  // Per-grant budget and project plan
  const [budgetByGrant, setBudgetByGrant] = useState<Record<string, BudgetRow[]>>(() => {
    const initial: Record<string, BudgetRow[]> = {};
    // Only YOF gets default budget data
    initial['yof-scale-2026'] = JSON.parse(JSON.stringify(DEFAULT_BUDGET_ROWS));
    return initial;
  });
  const [planByGrant, setPlanByGrant] = useState<Record<string, ProjectPlanRow[]>>(() => {
    const initial: Record<string, ProjectPlanRow[]> = {};
    initial['yof-scale-2026'] = JSON.parse(JSON.stringify(DEFAULT_PLAN_ROWS));
    return initial;
  });

  // Org profile
  const [orgSections, setOrgSections] = useState<GrantSection[]>(loadOrgProfile);

  // Persist grants
  useEffect(() => { saveGrants(grants); }, [grants]);
  useEffect(() => { saveArchivedGrants(archivedGrants); }, [archivedGrants]);

  // Persist org profile
  useEffect(() => { saveOrgProfile(orgSections); }, [orgSections]);

  // Persist grant sections when they change
  useEffect(() => {
    for (const [grantId, sections] of Object.entries(sectionsByGrant)) {
      saveGrantSections(grantId, sections);
    }
  }, [sectionsByGrant]);

  const activeGrant = grants.find(g => g.id === activeGrantId) || grants[0];
  const activeSections = sectionsByGrant[activeGrantId] || [];

  const handleGrantUpdateAnswer = useCallback((sectionId: string, questionId: string, value: string) => {
    setSectionsByGrant(prev => {
      const sections = prev[activeGrantId] || [];
      return {
        ...prev,
        [activeGrantId]: sections.map(s => {
          if (s.id !== sectionId) return s;
          return { ...s, questions: s.questions.map(q => q.id === questionId ? { ...q, answer: value } : q) };
        }),
      };
    });
  }, [activeGrantId]);

  const handleGrantUpdateSections = useCallback((sections: GrantSection[]) => {
    setSectionsByGrant(prev => ({ ...prev, [activeGrantId]: sections }));
  }, [activeGrantId]);

  const handleOrgUpdateAnswer = useCallback((sectionId: string, questionId: string, value: string) => {
    setOrgSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return { ...s, questions: s.questions.map(q => q.id === questionId ? { ...q, answer: value } : q) };
    }));
  }, []);

  const handleSelectGrant = useCallback((id: string) => {
    setActiveGrantId(id);
    setShowOrgProfile(false);
  }, []);

  const handleNewGrantCreated = useCallback((grant: GrantOpportunity, sections: GrantSection[]) => {
    setGrants(prev => [...prev, grant]);
    setSectionsByGrant(prev => ({ ...prev, [grant.id]: sections }));
    setActiveGrantId(grant.id);
    setShowOrgProfile(false);
    setShowNewGrantModal(false);
  }, []);

  const handleArchiveGrant = useCallback((id: string) => {
    const grant = grants.find(g => g.id === id);
    if (!grant) return;
    // Move to archived
    setArchivedGrants(prev => [...prev, grant]);
    setGrants(prev => prev.filter(g => g.id !== id));
    // If we archived the active grant, switch to the first remaining
    if (activeGrantId === id) {
      const remaining = grants.filter(g => g.id !== id);
      setActiveGrantId(remaining[0]?.id || '');
    }
  }, [grants, activeGrantId]);

  const handleRestoreGrant = useCallback((id: string) => {
    const grant = archivedGrants.find(g => g.id === id);
    if (!grant) return;
    // Move back to pipeline
    setGrants(prev => [...prev, grant]);
    setArchivedGrants(prev => prev.filter(g => g.id !== id));
    setActiveGrantId(id);
    setShowOrgProfile(false);
  }, [archivedGrants]);

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#14141c', color: '#E6E7F2',
    }}>
      {/* Collapsible left sidebar */}
      {!leftCollapsed && (
        <GrantPipelineSidebar
          grants={grants}
          archivedGrants={archivedGrants}
          activeGrantId={activeGrantId}
          showOrgProfile={showOrgProfile}
          onSelectGrant={handleSelectGrant}
          onToggleOrgProfile={() => setShowOrgProfile(p => !p)}
          onNewGrant={() => setShowNewGrantModal(true)}
          onArchiveGrant={handleArchiveGrant}
          onRestoreGrant={handleRestoreGrant}
        />
      )}

      <button
        onClick={() => setLeftCollapsed(p => !p)}
        title={leftCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        style={{
          width: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.02)', border: 'none', cursor: 'pointer',
          borderRight: `1px solid ${C.border}`, color: C.textMuted, fontSize: '0.7rem',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
      >
        {leftCollapsed ? '▸' : '◂'}
      </button>

      {/* Center content */}
      {showOrgProfile ? (
        <OrgProfileView
          sections={orgSections}
          onUpdateAnswer={handleOrgUpdateAnswer}
          onUpdateSections={setOrgSections}
        />
      ) : activeSections.length > 0 ? (
        <GrantFormView
          sections={activeSections}
          onUpdateAnswer={handleGrantUpdateAnswer}
          onUpdateSections={handleGrantUpdateSections}
          grantName={activeGrant?.name || 'Grant'}
          budgetRows={budgetByGrant[activeGrantId] || []}
          onBudgetChange={rows => setBudgetByGrant(prev => ({ ...prev, [activeGrantId]: rows }))}
          projectPlanRows={planByGrant[activeGrantId] || []}
          onProjectPlanChange={rows => setPlanByGrant(prev => ({ ...prev, [activeGrantId]: rows }))}
          intelligence={activeGrant?.intelligence}
        />
      ) : (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 12, color: C.textMuted, minWidth: 300,
        }}>
          <div style={{ fontSize: '2rem' }}>📋</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>No questions loaded for this grant</div>
          <div style={{ fontSize: '0.78rem', maxWidth: 400, textAlign: 'center', lineHeight: 1.5 }}>
            This grant doesn't have extracted questions yet. Click "+ New Grant" to add a grant with auto-extracted questions.
          </div>
        </div>
      )}

      {/* Right collapse toggle */}
      {!showOrgProfile && (
        <button
          onClick={() => setRightCollapsed(p => !p)}
          title={rightCollapsed ? 'Show details' : 'Hide details'}
          style={{
            width: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.02)', border: 'none', cursor: 'pointer',
            borderLeft: `1px solid ${C.border}`, color: C.textMuted, fontSize: '0.7rem',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
        >
          {rightCollapsed ? '◂' : '▸'}
        </button>
      )}

      {/* Collapsible right detail panel */}
      {!showOrgProfile && !rightCollapsed && activeGrant && (
        <GrantDetailPanel grant={activeGrant} onQuickAction={() => {}} />
      )}

      {/* New Grant Modal */}
      {showNewGrantModal && (
        <NewGrantModal
          onCreated={handleNewGrantCreated}
          onClose={() => setShowNewGrantModal(false)}
        />
      )}
    </div>
  );
}

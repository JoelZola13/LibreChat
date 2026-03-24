// Grant proposal sections — each grant gets its own set of pages/questions
// The Grant Manager agent fills in the answers
//
// Organization profile is stored separately (localStorage) and injected
// as context when the AI generates grant-specific answers.

export interface GrantQuestion {
  id: string;
  label: string;
  hint?: string;
  type: 'short' | 'long' | 'select';
  options?: string[]; // for select type
  answer: string;
  required?: boolean;
  wordLimit?: number; // max word count for this field
}

export interface GrantSection {
  id: string;
  title: string;
  description?: string;
  icon: string;
  part: 'org' | 'grant'; // which part this section belongs to
  questions: GrantQuestion[];
}

// ═══════════════════════════════════════════════════════════════
// PART 1: ORGANIZATION PROFILE — stays the same across all grants
// ═══════════════════════════════════════════════════════════════

export const ORG_SECTIONS: GrantSection[] = [
  {
    id: 'org-basics',
    title: 'Organization Basics',
    description: 'Legal identity, location, and structure.',
    icon: '🏢',
    part: 'org',
    questions: [
      { id: 'org_name', label: 'Organization / Group Name', type: 'short', answer: 'Street Voices', required: true },
      { id: 'legal_name', label: 'Legal Name (if different)', type: 'short', answer: '' },
      { id: 'org_type', label: 'Organization Type', type: 'select', options: ['Registered charity', 'Incorporated not-for-profit', 'Unregistered grassroots group', 'Social enterprise', 'Cooperative', 'Other'], answer: 'Incorporated not-for-profit', required: true },
      { id: 'incorporation_number', label: 'Incorporation / CRA Number', type: 'short', answer: '766900609', hint: 'Business or charity registration number' },
      { id: 'registry_id', label: 'Registry ID', type: 'short', answer: '13489647', hint: 'Federal corporation registry ID' },
      { id: 'year_established', label: 'Year Established', type: 'short', answer: '2021', required: true },
      { id: 'address', label: 'Mailing Address', type: 'short', answer: '192 Spadina Ave., Toronto, ON M5T 2C2', required: true },
      { id: 'website', label: 'Website', type: 'short', answer: 'https://www.streetvoices.ca' },
      { id: 'social_media', label: 'Social Media (Instagram, Twitter, LinkedIn, etc.)', type: 'short', answer: '' },
      { id: 'contact_name', label: 'Primary Contact Name & Title', type: 'short', answer: 'Joel Zola, Executive Director', required: true },
      { id: 'contact_email', label: 'Primary Contact Email', type: 'short', answer: 'joel@streetvoices.ca', required: true },
      { id: 'contact_phone', label: 'Primary Contact Phone', type: 'short', answer: '416-697-6626' },
    ],
  },
  {
    id: 'org-mission',
    title: 'Mission, Vision & Values',
    description: 'What your organization stands for and why it exists.',
    icon: '💡',
    part: 'org',
    questions: [
      { id: 'mission_statement', label: 'Mission Statement', type: 'long', answer: '', required: true, hint: 'What you do, for whom, and why — in 1-3 sentences' },
      { id: 'vision_statement', label: 'Vision Statement', type: 'long', answer: '', hint: 'The future you\'re working toward' },
      { id: 'core_values', label: 'Core Values', type: 'long', answer: '', hint: 'List 3-5 values that guide your work' },
      { id: 'org_description_short', label: 'Organization Description (2-3 sentences)', type: 'long', answer: '', required: true, hint: 'The "elevator pitch" version — used in most grant apps' },
      { id: 'org_description_long', label: 'Organization Description (1 page)', type: 'long', answer: '', hint: 'Detailed version for grants that ask for it' },
      { id: 'theory_of_change', label: 'Theory of Change', type: 'long', answer: '', hint: 'If X problem exists → we do Y activities → which produces Z outcomes → leading to W impact' },
    ],
  },
  {
    id: 'org-programs',
    title: 'Programs & Services',
    description: 'What you actually do — the work that makes your org fundable.',
    icon: '🎯',
    part: 'org',
    questions: [
      { id: 'core_programs', label: 'List all current programs/services', type: 'long', answer: '', required: true, hint: 'Name, brief description, who it serves, how often' },
      { id: 'flagship_program', label: 'Describe your flagship / most impactful program in detail', type: 'long', answer: '', required: true, hint: 'How it works, what makes it unique, outcomes achieved' },
      { id: 'service_areas', label: 'Service Areas / Communities Served', type: 'long', answer: '', required: true, hint: 'Geographic areas, neighbourhoods, communities' },
      { id: 'target_population', label: 'Target Population', type: 'long', answer: '', required: true, hint: 'Demographics — age, identity, background, needs' },
      { id: 'people_served_annually', label: 'How many people do you serve annually?', type: 'short', answer: '', required: true },
      { id: 'service_delivery_method', label: 'How do you deliver services?', type: 'long', answer: '', hint: 'In-person, virtual, hybrid, mobile, etc.' },
      { id: 'unique_approach', label: 'What makes your approach unique or innovative?', type: 'long', answer: '', required: true },
    ],
  },
  {
    id: 'org-impact',
    title: 'Track Record & Impact',
    description: 'Evidence that your work makes a difference.',
    icon: '📊',
    part: 'org',
    questions: [
      { id: 'years_operating', label: 'Years in Operation', type: 'short', answer: '', required: true },
      { id: 'total_people_served', label: 'Total People Served (lifetime)', type: 'short', answer: '' },
      { id: 'key_outcomes', label: 'Key Outcomes & Impact Data', type: 'long', answer: '', required: true, hint: 'Measurable results — completion rates, employment outcomes, behaviour change, etc.' },
      { id: 'testimonials', label: 'Participant Testimonials or Stories', type: 'long', answer: '', hint: '2-3 anonymized quotes or success stories' },
      { id: 'evaluation_methods', label: 'How do you measure and evaluate your work?', type: 'long', answer: '', hint: 'Surveys, pre/post assessments, interviews, data tracking systems' },
      { id: 'awards_recognition', label: 'Awards, Media Coverage, or Recognition', type: 'long', answer: '' },
      { id: 'dei_commitment', label: 'Equity, Diversity & Inclusion Practices', type: 'long', answer: '', hint: 'How EDI is embedded in your work, hiring, governance' },
    ],
  },
  {
    id: 'org-team',
    title: 'Team & Leadership',
    description: 'The people who make it happen.',
    icon: '👥',
    part: 'org',
    questions: [
      { id: 'executive_director', label: 'Executive Director / Lead (name, background, years in role)', type: 'long', answer: '', required: true },
      { id: 'staff_list', label: 'Key Staff (name, title, FTE, brief bio)', type: 'long', answer: '', required: true, hint: 'List all paid staff' },
      { id: 'board_members', label: 'Board of Directors (name, title/affiliation, role on board)', type: 'long', answer: '', hint: 'If applicable' },
      { id: 'volunteers', label: 'Volunteer Capacity', type: 'long', answer: '', hint: 'Number of volunteers, roles they fill, hours contributed' },
      { id: 'youth_leadership', label: 'Youth Involvement in Leadership & Decision-Making', type: 'long', answer: '', hint: 'How youth participate in governance, program design, hiring' },
      { id: 'lived_experience', label: 'Lived Experience Representation', type: 'long', answer: '', hint: 'How team members reflect the communities you serve' },
      { id: 'professional_development', label: 'Staff Training & Professional Development', type: 'long', answer: '' },
    ],
  },
  {
    id: 'org-financials',
    title: 'Financial Profile',
    description: 'Budget, revenue, and financial health.',
    icon: '💰',
    part: 'org',
    questions: [
      { id: 'annual_budget', label: 'Current Annual Operating Budget', type: 'short', answer: '', required: true },
      { id: 'revenue_last_year', label: 'Total Revenue (last fiscal year)', type: 'short', answer: '', required: true },
      { id: 'revenue_sources', label: 'Revenue Sources Breakdown', type: 'long', answer: '', required: true, hint: 'Government grants %, foundation grants %, earned revenue %, donations %, etc.' },
      { id: 'past_grants', label: 'Grants Received (last 3 years)', type: 'long', answer: '', required: true, hint: 'Funder name, program, amount, year, status' },
      { id: 'financial_statements', label: 'Do you have audited or reviewed financial statements?', type: 'select', options: ['Audited', 'Reviewed', 'Compiled', 'Internal only', 'None'], answer: '' },
      { id: 'fiscal_sponsor', label: 'Fiscal Sponsor (if applicable)', type: 'short', answer: '', hint: 'If you don\'t have charitable status, who holds funds for you?' },
      { id: 'sustainability_plan', label: 'Financial Sustainability Plan', type: 'long', answer: '', hint: 'How will you sustain your work beyond grant funding?' },
    ],
  },
  {
    id: 'org-partnerships',
    title: 'Partnerships & Community',
    description: 'Who you collaborate with.',
    icon: '🤝',
    part: 'org',
    questions: [
      { id: 'key_partners', label: 'Key Partners & Collaborators', type: 'long', answer: '', required: true, hint: 'Organization name, nature of partnership, how long' },
      { id: 'community_connections', label: 'Community Connections & Roots', type: 'long', answer: '', hint: 'How you\'re embedded in the communities you serve' },
      { id: 'referral_network', label: 'Referral Networks', type: 'long', answer: '', hint: 'Who refers participants to you? Who do you refer to?' },
      { id: 'coalition_memberships', label: 'Coalition / Network Memberships', type: 'long', answer: '', hint: 'Industry groups, coalitions, alliances you belong to' },
      { id: 'letters_of_support', label: 'Available Letters of Support', type: 'long', answer: '', hint: 'Who could write letters of support for your grant applications?' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// PART 2: GRANT APPLICATION — specific to YOF Scale
// ═══════════════════════════════════════════════════════════════

export const YOF_GRANT_SECTIONS: GrantSection[] = [
  {
    id: 'yof-project',
    title: 'Project Overview',
    description: 'The project you want to scale with YOF funding.',
    icon: '🎯',
    part: 'grant',
    questions: [
      { id: 'project_name', label: 'Project Name', type: 'short', answer: '', required: true },
      { id: 'project_description', label: 'Describe your project and its core activities', type: 'long', answer: '', required: true, hint: 'What do you do? How does it work? Who participates?', wordLimit: 300 },
      { id: 'years_delivered', label: 'How many years have you been delivering this project?', type: 'short', answer: '', required: true, hint: 'Must be at least 2 years' },
      { id: 'youth_served', label: 'How many youth have you served through this project?', type: 'short', answer: '', required: true },
      { id: 'age_range', label: 'Age range of youth served', type: 'short', answer: '', hint: '12-25, or 12-29 for youth with disabilities/mental health needs' },
      { id: 'systemic_barriers', label: 'What systemic barriers does your project address?', type: 'long', answer: '', required: true, wordLimit: 250 },
      { id: 'past_results', label: 'What results and impact have you achieved so far?', type: 'long', answer: '', required: true, hint: 'Include data, testimonials, or specific outcomes', wordLimit: 300 },
    ],
  },
  {
    id: 'yof-priority',
    title: 'Priority Outcome & Beneficiaries',
    description: 'Which YOF priority outcome your project aligns with.',
    icon: '⭐',
    part: 'grant',
    questions: [
      { id: 'priority_outcome', label: 'Select your Priority Outcome', type: 'select', options: [
        'Empowering girls and young women to lead',
        'Supporting Indigenous, Black, and newcomer youth in labour market transitions',
        'Supporting youth in/leaving care or involved in justice system',
        'Addressing impacts of racism on youth',
        'Creating safe spaces for Indigenous/Black youth cultural connections',
      ], answer: '', required: true },
      { id: 'why_priority', label: 'Why did you choose this Priority Outcome?', type: 'long', answer: '', required: true, hint: 'How does your project directly contribute to this outcome?', wordLimit: 200 },
      { id: 'primary_beneficiaries', label: 'Who are your primary beneficiaries?', type: 'long', answer: '', required: true, hint: 'Specific youth population — demographics, identities, communities', wordLimit: 200 },
      { id: 'geographic_reach', label: 'Geographic reach (communities/neighbourhoods)', type: 'long', answer: '', wordLimit: 150 },
    ],
  },
  {
    id: 'yof-scaling',
    title: 'Scaling Strategy',
    description: 'How you plan to scale with this funding.',
    icon: '📈',
    part: 'grant',
    questions: [
      { id: 'scale_type', label: 'Scaling Approach', type: 'select', options: [
        'Enhance Quality — deepen impact by improving existing project',
        'Expand Reach — extend program to serve additional youth',
      ], answer: '', required: true },
      { id: 'what_will_scale', label: 'What specifically will you scale?', type: 'long', answer: '', required: true, hint: 'Be specific about changes, additions, or improvements', wordLimit: 250 },
      { id: 'why_now', label: 'Why is now the right time to scale?', type: 'long', answer: '', required: true, wordLimit: 200 },
      { id: 'evidence_ready', label: 'What evidence shows your project is ready to scale?', type: 'long', answer: '', required: true, wordLimit: 250 },
      { id: 'expected_outcomes', label: 'What outcomes do you expect from scaling?', type: 'long', answer: '', required: true, hint: 'Quantify — how many more youth, what improved results', wordLimit: 250 },
    ],
  },
  {
    id: 'yof-budget',
    title: 'Budget & Timeline',
    description: 'Funding request, costs, and milestones.',
    icon: '💰',
    part: 'grant',
    questions: [
      { id: 'amount_requested', label: 'Total amount requested per year (max $150,000)', type: 'short', answer: '', required: true },
      { id: 'grant_duration', label: 'Grant duration', type: 'select', options: ['2 years', '3 years'], answer: '', required: true },
      { id: 'budget_breakdown', label: 'Budget breakdown by category', type: 'long', answer: '', required: true, hint: 'Staffing, transportation, supplies, professional fees, admin support (15%), capacity building ($2K-$4K/yr)', wordLimit: 400 },
      { id: 'staffing_plan', label: 'Staffing plan (roles, FTE, compensation)', type: 'long', answer: '', hint: 'OTF requires livable wages', wordLimit: 300 },
      { id: 'capacity_building', label: 'Capacity building plan ($2,000-$4,000/year required)', type: 'long', answer: '', required: true, wordLimit: 200 },
      { id: 'timeline_milestones', label: 'Key milestones and timeline', type: 'long', answer: '', required: true, hint: 'Year 1 and Year 2 milestones', wordLimit: 300 },
    ],
  },
  {
    id: 'yof-mentor',
    title: 'Organizational Mentor',
    description: 'Required partnership with an established organization.',
    icon: '🤝',
    part: 'grant',
    questions: [
      { id: 'mentor_name', label: 'Organizational Mentor name', type: 'short', answer: '', required: true },
      { id: 'mentor_description', label: 'Describe the Mentor organization', type: 'long', answer: '', hint: 'What do they do? Why are they a good fit?', wordLimit: 200 },
      { id: 'mentor_relationship', label: 'Describe your relationship with the Mentor', type: 'long', answer: '', required: true, hint: 'How long have you worked together?', wordLimit: 200 },
      { id: 'mentor_role', label: 'What role will the Mentor play?', type: 'long', answer: '', required: true, hint: 'Financial administration, mentorship, capacity building', wordLimit: 250 },
      { id: 'mentor_agreement', label: 'Signed collaborative agreement?', type: 'select', options: ['Yes', 'In progress', 'Not yet'], answer: '' },
    ],
  },
  {
    id: 'yof-leadership',
    title: 'Youth Leadership (YOF-Specific)',
    description: 'OTF requires proof of youth-led governance.',
    icon: '✊',
    part: 'grant',
    questions: [
      { id: 'youth_percentage', label: 'What percentage of your core group is youth (ages 12-29)?', type: 'short', answer: '', required: true, hint: 'Must be >50%' },
      { id: 'leadership_model', label: 'Leadership Model', type: 'select', options: ['Youth-led (youth make all key decisions)', 'Youth-adult partnership (shared decision-making)'], answer: '', required: true },
      { id: 'arms_length', label: 'More than 50% of core members in arm\'s-length relationships?', type: 'select', options: ['Yes', 'No'], answer: '', required: true },
      { id: 'governance_description', label: 'Describe how youth lead decision-making in your organization', type: 'long', answer: '', required: true, wordLimit: 250 },
      { id: 'youth_in_proposal', label: 'How were youth involved in developing this proposal?', type: 'long', answer: '', wordLimit: 200 },
    ],
  },
];

// Combined sections (used if you ever want the full view)
export const YOF_SCALE_SECTIONS: GrantSection[] = [...ORG_SECTIONS, ...YOF_GRANT_SECTIONS];

// ═══════════════════════════════════════════════════════════════
// NBA FOUNDATION — extracted from FLUXX portal
// ═══════════════════════════════════════════════════════════════

export const NBA_GRANT_SECTIONS: GrantSection[] = [
  {
    id: 'nba-org-info',
    title: 'Organization Information',
    description: 'Contact roles and organizational structure.',
    icon: '🏢',
    part: 'grant',
    questions: [
      { id: 'nba_location', label: 'Location', type: 'select', options: ['Street Voices – headquarters'], answer: 'Street Voices – headquarters' },
      { id: 'nba_primary_contact', label: 'Primary Contact', type: 'short', answer: 'Joel Zola' },
      { id: 'nba_authorized_signer', label: 'Authorized Signer', type: 'short', answer: 'Joel Zola' },
      { id: 'nba_finance_contact', label: 'Finance Contact', type: 'short', answer: 'Joel Zola' },
      { id: 'nba_notifications_contact', label: 'Additional Contact for System Notifications', type: 'short', answer: 'Joel Zola' },
      { id: 'nba_comms_contact', label: 'Communications/Media Contact', type: 'short', answer: 'Joel Zola' },
      { id: 'nba_comms_contact_2_name', label: 'Communications/Media Contact #2 Name', type: 'short', answer: '' },
      { id: 'nba_comms_contact_2_email', label: 'Communications/Media Contact #2 Email', type: 'short', answer: '' },
      { id: 'nba_comms_contact_2_phone', label: 'Communications/Media Contact #2 Phone', type: 'short', answer: '' },
      { id: 'nba_fiscally_sponsored', label: 'Is your organization fiscally sponsored?', type: 'select', options: ['Yes', 'No'], answer: '', required: true },
      { id: 'nba_staff_fulltime', label: 'Staff Size — Full-Time (paid staff only)', type: 'short', answer: '', required: true },
      { id: 'nba_staff_parttime', label: 'Staff Size — Part-Time (paid staff only)', type: 'short', answer: '', required: true },
      { id: 'nba_org_budget', label: 'Organization Budget (Current Year)', type: 'short', answer: '', required: true, hint: 'Dollar amount' },
      { id: 'nba_recent_funders', label: 'Current/Recent Funders', type: 'long', answer: '', required: true, hint: 'List your five most recent funders for the past year', wordLimit: 750 },
    ],
  },
  {
    id: 'nba-org-profile',
    title: 'Organization Profile',
    description: 'Mission, founding, and social media.',
    icon: '📋',
    part: 'grant',
    questions: [
      { id: 'nba_org_mission', label: 'Organization Mission', type: 'long', answer: '', required: true, hint: 'Must be completed in org profile' },
      { id: 'nba_year_founded', label: 'Year Founded', type: 'short', answer: '2021', required: true },
      { id: 'nba_website', label: 'Website', type: 'short', answer: 'https://www.streetvoices.ca' },
      { id: 'nba_facebook', label: 'Facebook URL', type: 'short', answer: '' },
      { id: 'nba_instagram', label: 'Instagram URL', type: 'short', answer: '' },
      { id: 'nba_x', label: 'X (Twitter) URL', type: 'short', answer: '' },
    ],
  },
  {
    id: 'nba-team-partnership',
    title: 'NBA Team Partnership',
    description: 'Your relationship with local NBA team(s).',
    icon: '🏀',
    part: 'grant',
    questions: [
      { id: 'nba_partnership_strength', label: 'How strong is your nonprofit\'s relationship with your local NBA Team(s)? (1-5)', type: 'select', options: ['1 — No partnership', '2 — Minimal contact', '3 — Some engagement', '4 — Active partnership', '5 — Strong partnership'], answer: '', required: true },
      { id: 'nba_referred_by_team', label: 'Were you referred to the NBA Foundation by an NBA team or any of its affiliates?', type: 'select', options: ['Yes', 'No'], answer: '', required: true },
      { id: 'nba_connection', label: 'Does your organization have an NBA connection?', type: 'select', options: ['Yes', 'No'], answer: '', required: true },
    ],
  },
  {
    id: 'nba-grant-app',
    title: 'Grant Application',
    description: 'Program details and funding request.',
    icon: '📝',
    part: 'grant',
    questions: [
      { id: 'nba_program_title', label: 'Program Title', type: 'short', answer: '', required: true },
      { id: 'nba_statement_of_need', label: 'Current Issue / Statement of Need', type: 'long', answer: '', required: true, hint: 'Explain the issue that your program is seeking to address', wordLimit: 1875 },
      { id: 'nba_program_description', label: 'Program Description', type: 'long', answer: '', required: true, hint: 'Brief description in 2 sentences or less', wordLimit: 500 },
      { id: 'nba_program_model', label: 'Program Model', type: 'long', answer: '', required: true, hint: 'Recruitment, strategies, key elements, services, infrastructure', wordLimit: 1875 },
      { id: 'nba_amount_requested', label: 'Amount Requested', type: 'short', answer: '', required: true, hint: 'Average grant $250K, range $25K-$500K' },
    ],
  },
  {
    id: 'nba-target-population',
    title: 'Target Population & Markets',
    description: 'Who you serve and where.',
    icon: '🎯',
    part: 'grant',
    questions: [
      { id: 'nba_target_market', label: 'Target NBA Market(s)', type: 'select', options: [
        'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets', 'Chicago Bulls',
        'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets', 'Detroit Pistons', 'Golden State Warriors',
        'Houston Rockets', 'Indiana Pacers', 'LA Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies',
        'Miami Heat', 'Milwaukee Bucks', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks',
        'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', 'Phoenix Suns', 'Portland Trail Blazers',
        'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz', 'Washington Wizards',
      ], answer: 'Toronto Raptors', required: true },
      { id: 'nba_target_population', label: 'Target Population', type: 'long', answer: '', required: true, hint: 'Describe the population served', wordLimit: 500 },
      { id: 'nba_target_breakdown', label: 'Target Age Breakdown', type: 'long', answer: '', required: true, hint: 'Percentage per age group: Ages <13, Ages 14-24, Ages 25-55, Ages 55+' },
    ],
  },
  {
    id: 'nba-outcomes',
    title: 'Projected Outcomes',
    description: 'Expected results and evaluation methods.',
    icon: '📊',
    part: 'grant',
    questions: [
      { id: 'nba_projected_outcomes', label: 'Projected Outcomes', type: 'long', answer: '', required: true, hint: 'Provide 4-5 outcomes with counts', wordLimit: 1000 },
      { id: 'nba_total_youth', label: 'Total number of youth projected to serve', type: 'short', answer: '', required: true },
      { id: 'nba_youth_job_readiness', label: 'Youth completing job-readiness trainings', type: 'short', answer: '', hint: 'Enter 0 if not applicable' },
      { id: 'nba_youth_credentials', label: 'Youth completing certificate or credential programs', type: 'short', answer: '', hint: 'Enter 0 if not applicable' },
      { id: 'nba_youth_hs_grad', label: 'Youth graduating high school', type: 'short', answer: '', hint: 'Enter 0 if not applicable' },
      { id: 'nba_youth_college_accepted', label: 'Youth accepted to college or university', type: 'short', answer: '', hint: 'Enter 0 if not applicable' },
      { id: 'nba_youth_college_persist', label: 'Youth persisting through college', type: 'short', answer: '', hint: 'Enter 0 if not applicable' },
      { id: 'nba_youth_college_grad', label: 'Youth graduating college', type: 'short', answer: '', hint: 'Enter 0 if not applicable' },
      { id: 'nba_youth_job_after_college', label: 'Youth securing a job after college', type: 'short', answer: '', hint: 'Enter 0 if not applicable' },
      { id: 'nba_youth_internship', label: 'Youth securing an internship/apprenticeship/experience', type: 'short', answer: '', hint: 'Enter 0 if not applicable' },
      { id: 'nba_youth_job', label: 'Youth securing a job (FT or PT)', type: 'short', answer: '', hint: 'Enter 0 if not applicable' },
      { id: 'nba_other_outcomes', label: 'Other Projected Outcomes for Youth', type: 'long', answer: '' },
      { id: 'nba_track_record', label: 'Track Record of Delivering Programming', type: 'long', answer: '', required: true, hint: 'Describe history and results', wordLimit: 1875 },
      { id: 'nba_evaluation', label: 'Evaluation', type: 'long', answer: '', required: true, hint: 'What indicators — both quantitative and qualitative — will you use?', wordLimit: 1000 },
    ],
  },
  {
    id: 'nba-financials',
    title: 'Financial Information',
    description: 'Financial health worksheet and budget.',
    icon: '💰',
    part: 'grant',
    questions: [
      { id: 'nba_fin_source', label: 'Financial Data Source', type: 'select', options: ['990', '990-EZ', 'T3010', '990N'], answer: 'T3010', required: true },
      { id: 'nba_fin_year', label: 'Fiscal Year of Filing', type: 'short', answer: '', required: true },
      { id: 'nba_fin_total_revenue', label: 'Total Revenue', type: 'short', answer: '', required: true, hint: 'Dollar amount' },
      { id: 'nba_fin_total_expenses', label: 'Total Expenses', type: 'short', answer: '', required: true, hint: 'Dollar amount' },
      { id: 'nba_fin_cash', label: 'Cash and Cash Equivalents', type: 'short', answer: '', required: true },
      { id: 'nba_fin_current_assets', label: 'Current Assets', type: 'short', answer: '', required: true },
      { id: 'nba_fin_current_liabilities', label: 'Current Liabilities (Total Liabilities)', type: 'short', answer: '', required: true },
      { id: 'nba_fin_comments', label: 'Financial Comments', type: 'long', answer: '', hint: 'Narrative notes or explanations' },
      { id: 'nba_gen_operating_support', label: 'General Operating Support Explanation', type: 'long', answer: '', hint: 'If requesting general operating funds, explain' },
    ],
  },
  {
    id: 'nba-documents',
    title: 'Documents & Uploads',
    description: 'Required and optional file uploads.',
    icon: '📎',
    part: 'grant',
    questions: [
      { id: 'nba_budget_template', label: 'Program Budget (downloaded template, upload completed)', type: 'short', answer: '', required: true, hint: 'Download budget template from portal, complete, and upload' },
      { id: 'nba_990_form', label: '990 Form / T3010 (most recent filing)', type: 'short', answer: '', required: true, hint: 'Canadian orgs: upload latest T3010' },
      { id: 'nba_board_list', label: 'Board List', type: 'short', answer: '', required: true, hint: 'Current board roster' },
      { id: 'nba_org_budget_doc', label: 'Organizational Budget (current fiscal year)', type: 'short', answer: '', required: true },
      { id: 'nba_org_logo', label: 'Organization Logo (high-resolution)', type: 'short', answer: '', required: true },
      { id: 'nba_annual_report', label: 'Annual Report (optional)', type: 'short', answer: '', hint: 'Optional upload' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// ORG PROFILE — stored in localStorage, used as AI context
// ═══════════════════════════════════════════════════════════════

const ORG_PROFILE_KEY = 'sv-org-profile';

export function loadOrgProfile(): GrantSection[] {
  try {
    const saved = localStorage.getItem(ORG_PROFILE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return JSON.parse(JSON.stringify(ORG_SECTIONS)); // deep clone defaults
}

export function saveOrgProfile(sections: GrantSection[]): void {
  localStorage.setItem(ORG_PROFILE_KEY, JSON.stringify(sections));
}

export function orgProfileToContext(): string {
  const sections = loadOrgProfile();
  const lines: string[] = ['## Organization Profile (Street Voices)'];
  for (const s of sections) {
    for (const q of s.questions) {
      if (q.answer.trim()) {
        lines.push(`- **${q.label}:** ${q.answer}`);
      }
    }
  }
  if (lines.length <= 1) {
    return '## Organization Profile\nOrganization: Street Voices (Toronto, Ontario). A community-focused creative/media organization serving youth.';
  }
  return lines.join('\n');
}

// Helper to count filled answers
export function countFilled(sections: GrantSection[]): { filled: number; total: number } {
  let filled = 0, total = 0;
  for (const s of sections) {
    for (const q of s.questions) {
      total++;
      if (q.answer.trim()) filled++;
    }
  }
  return { filled, total };
}

// Helper to get all questions as a flat prompt for the AI
export function sectionsToPrompt(sections: GrantSection[]): string {
  const lines: string[] = [];
  for (const s of sections) {
    lines.push(`\n## ${s.title}`);
    for (const q of s.questions) {
      const marker = q.required ? ' *' : '';
      if (q.answer.trim()) {
        lines.push(`**${q.label}${marker}:** ${q.answer}`);
      } else {
        lines.push(`**${q.label}${marker}:** [NEEDS ANSWER]`);
      }
    }
  }
  return lines.join('\n');
}

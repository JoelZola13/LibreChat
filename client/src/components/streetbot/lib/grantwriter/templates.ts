import type { GrantTemplate, GrantFormState } from './types'

export const GRANT_TEMPLATES: GrantTemplate[] = [
  {
    id: 'blank',
    name: 'Start from Scratch',
    description: 'Begin with a blank form and customize everything',
    category: 'general',
    icon: 'FileText',
    defaults: {}
  },
  {
    id: 'social-services',
    name: 'Social Services Grant',
    description: 'For community outreach, housing, food security, and social support programs',
    category: 'social-services',
    icon: 'Heart',
    defaults: {
      formData: {
        grantName: '',
        grantGuidelines: '',
        grantDurationYears: '2',
        scoringRubric: `Community Impact (30 points): Demonstrates meaningful benefit to underserved populations.
Organizational Capacity (25 points): Shows qualified staff, partnerships, and track record.
Program Design (20 points): Presents evidence-based approach with clear outcomes.
Sustainability (15 points): Plans for continued funding and community ownership.
Budget Alignment (10 points): Costs are reasonable and directly support program goals.`,
        narrativeAngle: '',
        budgetEligible: 'Personnel salaries and benefits\nProgram supplies and materials\nClient services and support\nOutreach and community engagement\nTraining and professional development',
        budgetIneligible: 'Lobbying activities\nCapital construction\nEndowment contributions\nDebt reduction',
        applicantsEligible: '501(c)(3) nonprofits\nGovernment agencies\nTribal organizations\nFiscally sponsored projects',
        applicantsIneligible: 'For-profit entities\nIndividuals\nPolitical organizations',
        activitiesEligible: 'Direct client services\nCase management\nCommunity outreach\nCapacity building\nPartnership development',
        activitiesIneligible: 'Political advocacy\nReligious proselytizing\nResearch without direct service component',
        orgName: '',
        orgMission: '',
        orgFounded: '',
        orgBudget: '',
        orgPrograms: '',
        orgImpact: ''
      },
      grantQuestions: [
        {
          id: 'q-1',
          text: 'Describe the community need your project addresses and how you identified this need.',
          wordLimit: '500',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        },
        {
          id: 'q-2',
          text: 'Explain your proposed program design, including key activities and timeline.',
          wordLimit: '750',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        },
        {
          id: 'q-3',
          text: 'How will you measure success? What outcomes do you expect to achieve?',
          wordLimit: '400',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        },
        {
          id: 'q-4',
          text: 'Describe your organization\'s capacity to implement this project.',
          wordLimit: '400',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        }
      ],
      includeBudget: true,
      includeProjectPlan: true,
      includePersonnel: true
    }
  },
  {
    id: 'arts-culture',
    name: 'Arts & Culture Grant',
    description: 'For creative projects, exhibitions, performances, and cultural programs',
    category: 'arts',
    icon: 'Palette',
    defaults: {
      formData: {
        grantName: '',
        grantGuidelines: '',
        grantDurationYears: '1',
        scoringRubric: `Artistic Merit (35 points): Quality, originality, and creative vision of the project.
Community Engagement (25 points): Accessibility and outreach to diverse audiences.
Feasibility (20 points): Realistic timeline, budget, and implementation plan.
Organizational Track Record (10 points): Past success delivering similar projects.
Cultural Impact (10 points): Contribution to local arts ecosystem and cultural dialogue.`,
        narrativeAngle: '',
        budgetEligible: 'Artist fees and honoraria\nProduction costs\nMarketing and promotion\nEquipment rental\nVenue costs\nDocumentation',
        budgetIneligible: 'Permanent equipment purchases over $5,000\nBuilding renovations\nGeneral operating costs unrelated to project',
        applicantsEligible: 'Arts nonprofits\nIndividual artists (where allowed)\nCollectives and cooperatives\nFiscally sponsored projects',
        applicantsIneligible: 'For-profit galleries\nEducational institutions (primary focus)',
        activitiesEligible: 'Public exhibitions\nPerformances\nWorkshops and classes\nCommunity art projects\nArtist residencies',
        activitiesIneligible: 'Private events\nCommercial productions\nProjects without public component',
        orgName: '',
        orgMission: '',
        orgFounded: '',
        orgBudget: '',
        orgPrograms: '',
        orgImpact: ''
      },
      grantQuestions: [
        {
          id: 'q-1',
          text: 'Describe your artistic vision and the creative work you plan to produce.',
          wordLimit: '600',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        },
        {
          id: 'q-2',
          text: 'How will you engage the community and ensure accessibility to diverse audiences?',
          wordLimit: '400',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        },
        {
          id: 'q-3',
          text: 'Describe your project timeline and key milestones.',
          wordLimit: '300',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        }
      ],
      includeBudget: true,
      includeProjectPlan: true,
      includePersonnel: false
    }
  },
  {
    id: 'research',
    name: 'Research Grant',
    description: 'For academic research, studies, and knowledge generation projects',
    category: 'research',
    icon: 'FlaskConical',
    defaults: {
      formData: {
        grantName: '',
        grantGuidelines: '',
        grantDurationYears: '3',
        scoringRubric: `Scientific Merit (30 points): Innovation, rigor, and contribution to field.
Methodology (25 points): Appropriate design, methods, and analytical approach.
Feasibility (20 points): Realistic scope, timeline, and resource allocation.
Investigator Qualifications (15 points): Track record and expertise of research team.
Broader Impacts (10 points): Potential for knowledge translation and societal benefit.`,
        narrativeAngle: '',
        budgetEligible: 'Personnel (PI, co-investigators, research staff)\nEquipment and supplies\nParticipant compensation\nTravel for research purposes\nPublication costs\nData management',
        budgetIneligible: 'Indirect costs above allowed rate\nGeneral institutional expenses\nEntertainment\nLobby activities',
        applicantsEligible: 'Universities and colleges\nResearch institutions\nIndependent research organizations',
        applicantsIneligible: 'For-profit companies\nIndividuals without institutional affiliation',
        activitiesEligible: 'Primary data collection\nSecondary data analysis\nLiterature reviews\nIntervention development\nCommunity-based participatory research',
        activitiesIneligible: 'Curriculum development\nService delivery without research component',
        orgName: '',
        orgMission: '',
        orgFounded: '',
        orgBudget: '',
        orgPrograms: '',
        orgImpact: ''
      },
      grantQuestions: [
        {
          id: 'q-1',
          text: 'State the research problem and its significance to the field.',
          wordLimit: '500',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        },
        {
          id: 'q-2',
          text: 'Describe your research design and methodology in detail.',
          wordLimit: '1000',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        },
        {
          id: 'q-3',
          text: 'What are your expected outcomes and how will findings be disseminated?',
          wordLimit: '400',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        }
      ],
      includeBudget: true,
      includeProjectPlan: true,
      includePersonnel: true
    }
  },
  {
    id: 'education',
    name: 'Education Grant',
    description: 'For educational programs, training initiatives, and learning resources',
    category: 'education',
    icon: 'GraduationCap',
    defaults: {
      formData: {
        grantName: '',
        grantGuidelines: '',
        grantDurationYears: '2',
        scoringRubric: `Educational Impact (30 points): Clear learning outcomes and measurable improvement.
Program Design (25 points): Evidence-based curriculum and effective pedagogy.
Target Population (20 points): Serves underrepresented or high-need learners.
Sustainability (15 points): Plan for continuing beyond grant period.
Evaluation Plan (10 points): Robust assessment of participant progress.`,
        narrativeAngle: '',
        budgetEligible: 'Instructor salaries\nCurriculum development\nLearning materials and supplies\nTechnology and equipment\nStudent support services\nProfessional development',
        budgetIneligible: 'Scholarships or tuition assistance\nCapital improvements\nEndowment',
        applicantsEligible: 'K-12 schools\nHigher education institutions\nEducation nonprofits\nCommunity organizations',
        applicantsIneligible: 'For-profit training companies\nIndividuals',
        activitiesEligible: 'Direct instruction\nTutoring and mentoring\nWorkshops and training\nCurriculum development\nTeacher training',
        activitiesIneligible: 'Regular school operations\nConstruction projects',
        orgName: '',
        orgMission: '',
        orgFounded: '',
        orgBudget: '',
        orgPrograms: '',
        orgImpact: ''
      },
      grantQuestions: [
        {
          id: 'q-1',
          text: 'What educational need does your program address and who will it serve?',
          wordLimit: '500',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        },
        {
          id: 'q-2',
          text: 'Describe your instructional approach and curriculum design.',
          wordLimit: '600',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        },
        {
          id: 'q-3',
          text: 'How will you assess participant learning and program effectiveness?',
          wordLimit: '400',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        }
      ],
      includeBudget: true,
      includeProjectPlan: true,
      includePersonnel: true
    }
  },
  {
    id: 'environment',
    name: 'Environmental Grant',
    description: 'For conservation, sustainability, and environmental justice projects',
    category: 'environment',
    icon: 'Leaf',
    defaults: {
      formData: {
        grantName: '',
        grantGuidelines: '',
        grantDurationYears: '2',
        scoringRubric: `Environmental Impact (30 points): Measurable ecological benefit and conservation outcomes.
Community Engagement (20 points): Local involvement and environmental justice focus.
Scientific Basis (20 points): Grounded in best available science and data.
Sustainability (15 points): Long-term viability beyond grant period.
Scalability (15 points): Potential for replication and broader adoption.`,
        narrativeAngle: '',
        budgetEligible: 'Staff time\nField equipment\nMonitoring and assessment\nCommunity education\nRestoration materials\nData collection and analysis',
        budgetIneligible: 'Land acquisition\nLegal fees\nLobbing activities\nEndowment',
        applicantsEligible: 'Environmental nonprofits\nLand trusts\nNative nations and tribes\nCommunity organizations',
        applicantsIneligible: 'For-profit companies\nGovernment agencies (unless partnering)',
        activitiesEligible: 'Habitat restoration\nConservation planning\nEnvironmental education\nCommunity science\nPolicy advocacy (non-lobbying)',
        activitiesIneligible: 'Litigation\nDirect lobbying\nLand purchase',
        orgName: '',
        orgMission: '',
        orgFounded: '',
        orgBudget: '',
        orgPrograms: '',
        orgImpact: ''
      },
      grantQuestions: [
        {
          id: 'q-1',
          text: 'Describe the environmental challenge your project addresses.',
          wordLimit: '500',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        },
        {
          id: 'q-2',
          text: 'What conservation or restoration activities will you undertake?',
          wordLimit: '600',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        },
        {
          id: 'q-3',
          text: 'How will you measure environmental outcomes and impact?',
          wordLimit: '400',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        }
      ],
      includeBudget: true,
      includeProjectPlan: true,
      includePersonnel: false
    }
  },
  {
    id: 'health',
    name: 'Health & Wellness Grant',
    description: 'For public health, healthcare access, and wellness programs',
    category: 'health',
    icon: 'Stethoscope',
    defaults: {
      formData: {
        grantName: '',
        grantGuidelines: '',
        grantDurationYears: '2',
        scoringRubric: `Health Impact (30 points): Clear health outcomes and evidence-based approach.
Target Population (25 points): Serves high-need or underserved communities.
Program Design (20 points): Culturally appropriate and accessible intervention.
Sustainability (15 points): Plan for continued services beyond grant.
Evaluation (10 points): Rigorous outcome measurement and data collection.`,
        narrativeAngle: '',
        budgetEligible: 'Clinical staff\nHealth educators\nMedical supplies\nOutreach workers\nTransportation assistance\nHealth screenings',
        budgetIneligible: 'Construction\nMedical equipment over $10,000\nResearch without service component',
        applicantsEligible: 'Healthcare nonprofits\nCommunity health centers\nPublic health departments\nHospital systems (nonprofit)',
        applicantsIneligible: 'For-profit healthcare companies\nIndividuals\nPharmaceutical companies',
        activitiesEligible: 'Health education\nScreenings and prevention\nCare coordination\nCommunity health workers\nMental health services',
        activitiesIneligible: 'Clinical trials\nDrug development\nMedical device testing',
        orgName: '',
        orgMission: '',
        orgFounded: '',
        orgBudget: '',
        orgPrograms: '',
        orgImpact: ''
      },
      grantQuestions: [
        {
          id: 'q-1',
          text: 'What health disparity or need does your program address?',
          wordLimit: '500',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        },
        {
          id: 'q-2',
          text: 'Describe your intervention and how it will improve health outcomes.',
          wordLimit: '600',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        },
        {
          id: 'q-3',
          text: 'How will you reach and engage your target population?',
          wordLimit: '400',
          answerType: 'long_form',
          answerOptions: [],
          answerValue: ''
        }
      ],
      includeBudget: true,
      includeProjectPlan: true,
      includePersonnel: true
    }
  }
]

export const getTemplateById = (id: string): GrantTemplate | undefined => {
  return GRANT_TEMPLATES.find(template => template.id === id)
}

export const getTemplatesByCategory = (category: GrantTemplate['category']): GrantTemplate[] => {
  return GRANT_TEMPLATES.filter(template => template.category === category)
}

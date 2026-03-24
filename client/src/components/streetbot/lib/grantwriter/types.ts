// Shared types for Grant Writer components

export type AnswerType = 'long_form' | 'short_text'
export type GenerationMode = 'full_application' | 'single_question' | 'project_plan_only' | 'budget_only'

export interface GrantQuestionField {
  id: string
  text: string
  wordLimit: string
  answerType: AnswerType
  answerOptions: string[]
  answerValue: string
}

export interface BudgetEntry {
  id: string
  category: string
  item: string
  yearlyAmounts: string[]
  overallAmount: string
  costBreakdown: string
}

export interface ProjectPlanEntry {
  id: string
  year: string
  deliverable: string
  keyTasks: string
  timing: string
  resources: string
}

export interface KeyPersonnelEntry {
  id: string
  name: string
  title: string
  role: string
  experience: string
  commitment: string
}

export interface GrantContextEntry {
  id: string
  title: string
  detail: string
}

export interface AttachmentPayload {
  filename: string
  content_type?: string
  size: number
  data_base64: string
}

export interface OrgFormData {
  grantName: string
  grantGuidelines: string
  grantDurationYears: string
  scoringRubric: string
  narrativeAngle: string
  budgetEligible: string
  budgetIneligible: string
  applicantsEligible: string
  applicantsIneligible: string
  activitiesEligible: string
  activitiesIneligible: string
  orgName: string
  orgMission: string
  orgFounded: string
  orgBudget: string
  orgPrograms: string
  orgImpact: string
}

export interface GrantFormState {
  formData: OrgFormData
  grantQuestions: GrantQuestionField[]
  requestedAmounts: string[]
  budgetEntries: BudgetEntry[]
  projectPlanEntries: ProjectPlanEntry[]
  keyPersonnelEntries: KeyPersonnelEntry[]
  grantContextEntries: GrantContextEntry[]
  includeBudget: boolean
  includeProjectPlan: boolean
  includePersonnel: boolean
  generationMode: GenerationMode
  selectedQuestionId: string | null
  attachments: AttachmentPayload[]
  memorySummary: string
  memoryEntries: string[]
  generalFeedback: string
  sectionFeedback: Record<string, string>
}

export interface GrantTemplate {
  id: string
  name: string
  description: string
  category: 'arts' | 'social-services' | 'research' | 'education' | 'environment' | 'health' | 'general'
  icon: string
  defaults: Partial<GrantFormState>
}

export interface WizardStep {
  id: string
  title: string
  description: string
  icon: string
  isOptional?: boolean
  isComplete?: (state: GrantFormState) => boolean
}

// Utility functions
export const generateId = (): string =>
  crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)

export const parseCurrencyToNumber = (raw: string): number | undefined => {
  const cleaned = raw.replace(/[$,]/g, '').trim()
  if (!cleaned) return undefined
  const parsed = Number.parseFloat(cleaned)
  if (Number.isNaN(parsed)) return undefined
  return parsed
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

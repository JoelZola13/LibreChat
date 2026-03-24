import type { GrantFormState } from './types'
import { formatCurrency } from './types'

// PDF Export using browser print
export async function exportToPDF(formState: GrantFormState, proposalContent?: Record<string, string>): Promise<void> {
  const htmlContent = generateProposalHTML(formState, proposalContent)

  // Create a new window for printing
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Unable to open print window. Please check your popup blocker.')
  }

  printWindow.document.write(htmlContent)
  printWindow.document.close()

  // Wait for content to load, then print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }
}

// Word/DOCX Export
export async function exportToWord(formState: GrantFormState, proposalContent?: Record<string, string>): Promise<void> {
  const htmlContent = generateProposalHTML(formState, proposalContent, true)

  // Create a blob with Word-compatible HTML
  const blob = new Blob([`
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>Grant Proposal - ${formState.formData.grantName || 'Untitled'}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page { size: letter; margin: 1in; }
        body { font-family: 'Calibri', sans-serif; font-size: 11pt; line-height: 1.5; }
        h1 { font-size: 18pt; color: #1a1c24; margin-bottom: 12pt; }
        h2 { font-size: 14pt; color: #4f46e5; margin-top: 18pt; margin-bottom: 8pt; border-bottom: 1px solid #e5e7eb; padding-bottom: 4pt; }
        h3 { font-size: 12pt; color: #374151; margin-top: 12pt; margin-bottom: 6pt; }
        p { margin: 0 0 8pt 0; }
        table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
        th, td { border: 1px solid #d1d5db; padding: 6pt 8pt; text-align: left; }
        th { background-color: #f3f4f6; font-weight: bold; }
        .section { margin-bottom: 18pt; }
        .label { color: #6b7280; font-size: 10pt; }
        .highlight { background-color: #fef3c7; padding: 2pt 4pt; }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `], { type: 'application/msword' })

  // Download the file
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `grant-proposal-${formState.formData.grantName?.replace(/\s+/g, '-').toLowerCase() || 'untitled'}-${new Date().toISOString().split('T')[0]}.doc`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// JSON Export
export function exportToJSON(formState: GrantFormState, proposalContent?: Record<string, string>): void {
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    formState,
    proposalContent: proposalContent || null
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `grant-proposal-${formState.formData.grantName?.replace(/\s+/g, '-').toLowerCase() || 'untitled'}-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Generate HTML content for export
function generateProposalHTML(formState: GrantFormState, proposalContent?: Record<string, string>, forWord = false): string {
  const { formData, grantQuestions, budgetEntries, projectPlanEntries, keyPersonnelEntries, includeBudget, includeProjectPlan, includePersonnel, requestedAmounts } = formState

  // Calculate totals
  const grantDuration = Math.max(1, parseInt(formData.grantDurationYears, 10) || 1)
  const totalBudget = budgetEntries.reduce((sum, entry) => {
    const overall = parseFloat(entry.overallAmount.replace(/[$,]/g, '') || '0')
    if (!isNaN(overall)) return sum + overall
    const yearlySum = entry.yearlyAmounts.reduce((ys, amount) => {
      const val = parseFloat(amount.replace(/[$,]/g, '') || '0')
      return ys + (isNaN(val) ? 0 : val)
    }, 0)
    return sum + yearlySum
  }, 0)

  let html = ''

  // Header
  html += `
    <div class="section" style="text-align: center; margin-bottom: 24pt;">
      <h1>${formData.grantName || 'Grant Proposal'}</h1>
      <p style="color: #6b7280; font-size: 12pt;">
        Submitted by: <strong>${formData.orgName}</strong>
      </p>
      <p style="color: #6b7280; font-size: 10pt;">
        Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </div>
  `

  // Executive Summary (if proposal content available)
  if (proposalContent?.executive_summary) {
    html += `
      <div class="section">
        <h2>Executive Summary</h2>
        <p>${proposalContent.executive_summary}</p>
      </div>
    `
  }

  // Organization Information
  html += `
    <div class="section">
      <h2>Organization Information</h2>
      <table>
        <tr><th style="width: 30%;">Organization Name</th><td>${formData.orgName}</td></tr>
        <tr><th>Year Founded</th><td>${formData.orgFounded || 'Not specified'}</td></tr>
        <tr><th>Annual Budget</th><td>${formData.orgBudget ? formatCurrency(parseFloat(formData.orgBudget)) : 'Not specified'}</td></tr>
      </table>
      <h3>Mission Statement</h3>
      <p>${formData.orgMission}</p>
      ${formData.orgPrograms ? `
        <h3>Programs</h3>
        <ul>
          ${formData.orgPrograms.split('\n').filter(p => p.trim()).map(p => `<li>${p.trim()}</li>`).join('')}
        </ul>
      ` : ''}
      ${formData.orgImpact ? `
        <h3>Impact Metrics</h3>
        <ul>
          ${formData.orgImpact.split('\n').filter(i => i.trim()).map(i => `<li>${i.trim()}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `

  // Funding Request
  html += `
    <div class="section">
      <h2>Funding Request</h2>
      <table>
        <tr><th>Grant Duration</th><td>${grantDuration} year${grantDuration > 1 ? 's' : ''}</td></tr>
        ${requestedAmounts.filter(a => a.trim()).length > 0 ? `
          ${requestedAmounts.map((amount, i) => amount.trim() ? `
            <tr><th>Year ${i + 1} Request</th><td>${formatCurrency(parseFloat(amount.replace(/[$,]/g, '') || '0'))}</td></tr>
          ` : '').join('')}
          <tr><th>Total Request</th><td><strong>${formatCurrency(requestedAmounts.reduce((sum, a) => {
            const val = parseFloat(a.replace(/[$,]/g, '') || '0')
            return sum + (isNaN(val) ? 0 : val)
          }, 0))}</strong></td></tr>
        ` : ''}
      </table>
    </div>
  `

  // Grant Questions & Responses
  if (grantQuestions.some(q => q.text.trim())) {
    html += `
      <div class="section">
        <h2>Proposal Narrative</h2>
        ${grantQuestions.filter(q => q.text.trim()).map((question, index) => {
          const response = proposalContent?.[`question_${question.id}`] || proposalContent?.[question.id] || question.answerValue
          return `
            <div style="margin-bottom: 16pt;">
              <h3>Question ${index + 1}${question.wordLimit ? ` (${question.wordLimit} word limit)` : ''}</h3>
              <p style="font-style: italic; color: #4b5563;">${question.text}</p>
              ${response ? `
                <div style="margin-top: 8pt; padding: 12pt; background-color: #f9fafb; border-radius: 4pt;">
                  <p>${response}</p>
                </div>
              ` : '<p style="color: #9ca3af;">[Response pending]</p>'}
            </div>
          `
        }).join('')}
      </div>
    `
  }

  // Budget
  if (includeBudget && budgetEntries.some(e => e.category.trim() || e.item.trim())) {
    html += `
      <div class="section">
        <h2>Budget</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Item</th>
              ${Array.from({ length: grantDuration }, (_, i) => `<th>Year ${i + 1}</th>`).join('')}
              <th>Total</th>
              <th>Cost Breakdown</th>
            </tr>
          </thead>
          <tbody>
            ${budgetEntries.filter(e => e.category.trim() || e.item.trim()).map(entry => `
              <tr>
                <td>${entry.category}</td>
                <td>${entry.item}</td>
                ${entry.yearlyAmounts.slice(0, grantDuration).map(amount => `
                  <td>${amount ? formatCurrency(parseFloat(amount.replace(/[$,]/g, '') || '0')) : '-'}</td>
                `).join('')}
                <td><strong>${entry.overallAmount ? formatCurrency(parseFloat(entry.overallAmount.replace(/[$,]/g, '') || '0')) : '-'}</strong></td>
                <td>${entry.costBreakdown}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="${2 + grantDuration}">Total Budget</th>
              <th colspan="2">${formatCurrency(totalBudget)}</th>
            </tr>
          </tfoot>
        </table>
        ${proposalContent?.budget_narrative ? `
          <h3>Budget Narrative</h3>
          <p>${proposalContent.budget_narrative}</p>
        ` : ''}
      </div>
    `
  }

  // Project Plan
  if (includeProjectPlan && projectPlanEntries.some(e => e.deliverable.trim())) {
    html += `
      <div class="section">
        <h2>Project Plan & Timeline</h2>
        <table>
          <thead>
            <tr>
              <th>Year</th>
              <th>Deliverable</th>
              <th>Key Tasks</th>
              <th>Timing</th>
              <th>Resources</th>
            </tr>
          </thead>
          <tbody>
            ${projectPlanEntries.filter(e => e.deliverable.trim()).map(entry => `
              <tr>
                <td>${entry.year}</td>
                <td>${entry.deliverable}</td>
                <td>${entry.keyTasks}</td>
                <td>${entry.timing}</td>
                <td>${entry.resources}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${proposalContent?.project_plan_narrative ? `
          <h3>Project Plan Narrative</h3>
          <p>${proposalContent.project_plan_narrative}</p>
        ` : ''}
      </div>
    `
  }

  // Key Personnel
  if (includePersonnel && keyPersonnelEntries.some(e => e.name.trim())) {
    html += `
      <div class="section">
        <h2>Key Personnel</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Title</th>
              <th>Project Role</th>
              <th>Experience</th>
              <th>Time Commitment</th>
            </tr>
          </thead>
          <tbody>
            ${keyPersonnelEntries.filter(e => e.name.trim()).map(entry => `
              <tr>
                <td>${entry.name}</td>
                <td>${entry.title}</td>
                <td>${entry.role}</td>
                <td>${entry.experience}</td>
                <td>${entry.commitment}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  // Footer
  html += `
    <div style="margin-top: 36pt; padding-top: 12pt; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="color: #9ca3af; font-size: 9pt;">
        Generated by Street Voices Grant Writer
      </p>
    </div>
  `

  // Wrap in print styles if for PDF
  if (!forWord) {
    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Grant Proposal - ${formData.grantName || 'Untitled'}</title>
        <style>
          @page { size: letter; margin: 0.75in; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body {
            font-family: 'Georgia', 'Times New Roman', serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #1a1c24;
            max-width: 8.5in;
            margin: 0 auto;
            padding: 0.5in;
          }
          h1 { font-size: 20pt; color: #1a1c24; margin-bottom: 8pt; }
          h2 { font-size: 14pt; color: #4f46e5; margin-top: 24pt; margin-bottom: 8pt; border-bottom: 2px solid #4f46e5; padding-bottom: 4pt; }
          h3 { font-size: 12pt; color: #374151; margin-top: 16pt; margin-bottom: 6pt; }
          p { margin: 0 0 10pt 0; }
          table { border-collapse: collapse; width: 100%; margin: 12pt 0; font-size: 10pt; }
          th, td { border: 1px solid #d1d5db; padding: 8pt; text-align: left; vertical-align: top; }
          th { background-color: #f3f4f6; font-weight: 600; }
          ul { margin: 8pt 0; padding-left: 20pt; }
          li { margin-bottom: 4pt; }
          .section { page-break-inside: avoid; margin-bottom: 20pt; }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `
  }

  return html
}

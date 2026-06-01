# Task Page ClickUp Build Scope

Last reviewed: 2026-05-04

## Scope Lock

Build only inside the task application page at:

```text
http://localhost:3180/tasks
```

Do not modify other product pages, global navigation, dashboard pages, calendar pages, grantwriter pages, profile pages, messages pages, or unrelated shared app surfaces.

Allowed task-app scope:

- `LibreChat/client/src/components/streetbot/tasks/**`
- Task-page-specific hooks only when they are already used by `/tasks`
- Task-page-specific API calls only when needed to support `/tasks`
- Task-page-specific tests for `TasksPage`

Avoid touching:

- `LibreChat/client/src/components/streetbot/dashboard/**`
- `LibreChat/client/src/components/streetbot/calendar/**`
- `LibreChat/client/src/components/streetbot/grantwriter/**`
- `LibreChat/client/src/components/streetbot/messages/**`
- `LibreChat/client/src/components/streetbot/profile/**`
- Global layout, navigation, theme, auth, and unrelated shared components

## Product Goal

The `/tasks` page should become our in-house ClickUp-style work management app. It needs to support the full hierarchy and core task-management experience directly on this page:

```text
Workspace / Project: Street Voices
  Folder: Grant
    List: To do grants
      Task: Toronto Arts Council
        Subtask: Fill out the budget
```

The task page should be useful as a real grant operations workspace, not a generic to-do list.

## Current Page Observations

The live page at `/tasks` already has a strong base:

- Left sidebar with workspace/project, folders, lists, filters, automations, reports, trash, analytics, pages, and saved views.
- Main task table with status groups.
- View tabs for List, Board, Calendar, Workload, and Gantt.
- Task rows with assignee, due date, priority, custom fields, subtasks, comments, tags, dependencies, templates, import, export, and keyboard shortcuts.
- Current data shown in the browser includes an unassigned list with existing tasks.

The next work should tighten the page around the hierarchy and grant workflow instead of expanding other app areas.

## Required Hierarchy Behavior

### Folder

Folders group lists. They should not directly contain tasks.

Required behavior:

- A folder can be created, renamed, deleted, collapsed, and expanded from the task sidebar.
- Folder rows show list count and task count.
- Folder-level actions include Add List and folder settings.
- Selecting a folder should show an aggregate view of all lists inside that folder.
- Folder breadcrumbs should appear in the main header when viewing a list or task inside the folder.

Initial target folder:

```text
Grant
```

### List

Lists contain tasks.

Required behavior:

- A list can exist inside a folder or at the root of the task project.
- Selecting a list should filter the main task area to tasks in that list.
- List rows show task count and completed count.
- List actions include Add Task, Rename, Delete, Move, and List Settings.
- Lists support saved views and custom fields.

Initial target list:

```text
Grant / To do grants
```

### Task

Tasks are primary work items.

Required behavior:

- Tasks live in a home list.
- Tasks show breadcrumbs back to list and folder.
- Tasks support status, assignees, due date, priority, tags, comments, attachments, dependencies, custom fields, checklist items, time estimates, time tracking, and subtasks.
- Tasks can be dragged between status groups.
- Tasks can be opened into a detail panel without leaving `/tasks`.

Initial target task:

```text
Toronto Arts Council
```

### Subtask

Subtasks are task children and must preserve parent context.

Required behavior:

- Subtasks display beneath their parent task when expanded.
- Subtasks support their own status, assignee, due date, priority, comments, checklist, and custom fields.
- Parent task progress rolls up from subtasks.
- Subtasks should never be rendered as unrelated root tasks unless a view explicitly asks for all subtasks.

Initial target subtask:

```text
Fill out the budget
```

## First Vertical Slice

Create and validate this exact hierarchy inside `/tasks`:

```text
Street Voices
  Grant
    To do grants
      Toronto Arts Council
        Fill out the budget
```

Acceptance checks:

- The left sidebar shows `Grant` as a folder.
- Expanding `Grant` shows `To do grants` as a list.
- Selecting `To do grants` shows `Toronto Arts Council` in the main task table.
- Expanding `Toronto Arts Council` shows `Fill out the budget` as a subtask.
- The main header breadcrumb makes the location obvious: `Street Voices / Grant / To do grants`.
- No other app page is required to complete this workflow.

## Grant Task Template

The `Toronto Arts Council` task should support these fields:

| Field | Type | Default |
| --- | --- | --- |
| Funder | Text | Toronto Arts Council |
| Program | Text | TBD |
| Grant stage | Status | Drafting |
| Deadline | Date | TBD |
| Requested amount | Currency | CAD TBD |
| Grant period | Date range | TBD |
| Fit score | Number | TBD |
| Strategic value | Dropdown | High |
| Portal URL | URL | TBD |
| Lead agent | Person / agent | Grant Manager |
| Budget owner | Person / agent | Budget Manager |
| Narrative owner | Person / agent | Grant Writer |
| Compliance risk | Dropdown | Medium |

Default subtasks:

- Research eligibility
- Extract application questions
- Draft project description
- Fill out the budget
- Draft budget justification
- Gather attachments
- Internal review
- Final compliance check
- Submit application
- Record submission notes

## Budget Subtask Template

The `Fill out the budget` subtask should support:

| Field | Type | Default |
| --- | --- | --- |
| Budget status | Status | Not started |
| Budget total | Currency | CAD TBD |
| Personnel total | Currency | CAD TBD |
| Artist fees total | Currency | CAD TBD |
| Production total | Currency | CAD TBD |
| Marketing total | Currency | CAD TBD |
| Admin total | Currency | CAD TBD |
| Match required | Checkbox | false |
| Funder template received | Checkbox | false |
| Needs narrative cross-check | Checkbox | true |

Checklist:

- Confirm funder maximum and minimum request.
- Confirm eligible and ineligible costs.
- Confirm project dates.
- Build line-item budget.
- Add calculation notes for every line item.
- Confirm every budgeted activity appears in the narrative.
- Confirm every narrative activity has budget coverage.
- Check totals against requested amount.
- Send to Grant Manager for review.

## Required Task Page Views

Implement these views only inside `/tasks`:

- `List`: default dense table grouped by status.
- `Board`: kanban grouped by status.
- `Calendar`: tasks by due date.
- `Workload`: tasks grouped by assignee or agent.
- `Gantt`: timeline with dependencies.
- `Budget Table`: task-table saved view with budget-related custom fields.
- `Review Queue`: saved view for grant tasks ready for review.

Do not create a separate grant page or dashboard page for this work. If a grant dashboard is needed, it should be a view or panel inside `/tasks`.

## Required Controls

The task page should expose familiar task-management controls:

- Sidebar hierarchy controls for folders and lists.
- Header breadcrumbs.
- View tabs.
- Search.
- Filters.
- Sort.
- Saved views.
- Add task.
- Add subtask.
- Add field.
- Templates.
- Import.
- Export.
- Automations.
- Trash.
- Task detail panel.
- Task row quick actions.

Use icons for compact controls and text labels only where command meaning needs clarity.

## Automation Ideas

Initial automations should stay visible and auditable inside `/tasks`:

- When a grant task moves to `DRAFTING`, create standard grant subtasks.
- When `Fill out the budget` is created, assign Budget Manager.
- When budget status changes to `Ready for review`, notify Grant Manager and Grant Writer inside task activity.
- When all grant subtasks are complete, move parent task to `REVIEW`.
- Seven days before deadline, flag grant tasks with incomplete budget fields.

Do not submit forms, send external emails, change external permissions, or perform portal actions from these automations without explicit human approval.

## Data Requirements

Minimum task-page data model expectations:

- Folder has many lists.
- List has many tasks.
- Task has one home list.
- Task can have many subtasks.
- Subtask has a parent task.
- Task and subtask share the same core field model.
- Custom fields can be visible by list, folder, or task type.
- Views save filters, grouping, sorting, column choices, and visible custom fields.

Important implementation note:

If the backend does not yet persist task-to-list membership, do not fake it across unrelated pages. Keep the UI change inside `/tasks`, document the API gap, and make the task page handle the missing state gracefully.

## UI Quality Bar

The task page should feel like a serious daily work surface:

- Dense enough for repeated use.
- Clear hierarchy in the sidebar.
- No oversized marketing sections.
- No unrelated explanatory text blocks in the app UI.
- No decorative cards nested inside cards.
- Task rows should not resize unpredictably when labels, assignees, or due dates change.
- Long task names and custom field values must truncate cleanly.
- Mobile should preserve task readability and core actions.

## Work Plan For Teammates

1. Start with the hierarchy slice: `Grant / To do grants / Toronto Arts Council / Fill out the budget`.
2. Make selected list filtering real in the main task table.
3. Add task breadcrumbs that include folder and list.
4. Improve subtask rendering so the parent-child relationship is unmistakable.
5. Add the Grant Application and Budget Subtask templates.
6. Add budget custom fields and a saved `Budget Table` view.
7. Add the first grant automations.
8. Verify List, Board, Calendar, Workload, and Gantt still work after every change.

## Definition Of Done

- The work is visible and usable at `http://localhost:3180/tasks`.
- The exact grant hierarchy can be created and viewed.
- `To do grants` filters the visible task table.
- `Toronto Arts Council` expands to show `Fill out the budget`.
- Budget fields can be shown in a saved task view.
- No unrelated page files were modified.
- Existing task page tests still pass, or new task-page-specific tests explain the intended behavior.

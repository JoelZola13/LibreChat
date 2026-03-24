'use client';

/**
 * Plane Features Integration Example
 *
 * This file demonstrates how to integrate the Plane features into the tasks/page.tsx.
 * It provides a reference implementation showing how to:
 *
 * 1. Use the usePlaneFeatures hook for state management
 * 2. Render TaskPlaneBadges in TaskRow via renderCustomFields
 * 3. Add PlaneFeaturesSidebar to the sidebar
 * 4. Filter tasks by cycle/module/epic
 * 5. Handle Plane feature popovers for task editing
 */

import { useMemo, useCallback } from 'react';
import type { Task } from '@/lib/api/tasks';
import type { Cycle } from '@/lib/api/cycles';
import type { Module, Epic, WorkItemType, StateGroup } from '@/lib/api/modules';
import { usePlaneFeatures } from './usePlaneFeatures';
import TaskPlaneBadges from './TaskPlaneBadges';
import PlaneFeaturesSidebar from './PlaneFeaturesSidebar';

// ============================================================
// INTEGRATION GUIDE
// ============================================================

/**
 * STEP 1: Import the Plane components at the top of tasks/page.tsx
 *
 * ```typescript
 * import {
 *   PlaneFeaturesSidebar,
 *   TaskPlaneBadges,
 *   usePlaneFeatures,
 *   CyclePlanningModal,
 *   ModulesTab,
 *   EpicCard,
 * } from '@/components/tasks';
 * ```
 */

/**
 * STEP 2: Initialize the usePlaneFeatures hook in your component
 *
 * ```typescript
 * const plane = usePlaneFeatures(selectedProject?.id || '', userId);
 *
 * // This gives you access to:
 * // - plane.cycles, plane.modules, plane.epics, plane.workItemTypes, plane.stateGroups, plane.pages
 * // - plane.selectedCycle, plane.selectCycle()
 * // - plane.selectedModule, plane.selectModule()
 * // - plane.selectedEpic, plane.selectEpic()
 * // - plane.loading.cycles, plane.loading.modules, etc.
 * // - plane.refreshCycles(), plane.refreshModules(), etc.
 * ```
 */

/**
 * STEP 3: Create lookup maps for efficient rendering
 */
interface PlaneLookups {
  cyclesById: Record<string, Cycle>;
  modulesById: Record<string, Module>;
  epicsById: Record<string, Epic>;
  typesById: Record<string, WorkItemType>;
}

export function usePlaneLookups(
  cycles: Cycle[],
  modules: Module[],
  epics: Epic[],
  workItemTypes: WorkItemType[]
): PlaneLookups {
  return useMemo(() => ({
    cyclesById: Object.fromEntries(cycles.map(c => [c.id, c])),
    modulesById: Object.fromEntries(modules.map(m => [m.id, m])),
    epicsById: Object.fromEntries(epics.map(e => [e.id, e])),
    typesById: Object.fromEntries(workItemTypes.map(t => [t.id, t])),
  }), [cycles, modules, epics, workItemTypes]);
}

/**
 * STEP 4: Create a renderCustomFields function for TaskRow
 *
 * ```typescript
 * const renderPlaneFields = useCallback((task: Task) => (
 *   <TaskPlaneBadges
 *     cycle={task.cycleId ? lookups.cyclesById[task.cycleId] : null}
 *     module={task.moduleId ? lookups.modulesById[task.moduleId] : null}
 *     epic={task.epicId ? lookups.epicsById[task.epicId] : null}
 *     workItemType={task.workItemTypeId ? lookups.typesById[task.workItemTypeId] : null}
 *     onCycleClick={() => handleOpenCyclePopover(task.id)}
 *     onModuleClick={() => handleOpenModulePopover(task.id)}
 *     onEpicClick={() => handleOpenEpicPopover(task.id)}
 *     onTypeClick={() => handleOpenTypePopover(task.id)}
 *     compact={true}
 *   />
 * ), [lookups, handleOpenCyclePopover, handleOpenModulePopover, handleOpenEpicPopover, handleOpenTypePopover]);
 * ```
 */

/**
 * STEP 5: Pass renderCustomFields to TaskRow
 *
 * In the part of page.tsx where you render TaskRow, add:
 * ```typescript
 * <TaskRow
 *   {...otherProps}
 *   renderCustomFields={renderPlaneFields}
 * />
 * ```
 */

/**
 * STEP 6: Add PlaneFeaturesSidebar to the sidebar
 *
 * In your sidebar section, add:
 * ```typescript
 * <PlaneFeaturesSidebar
 *   projectId={selectedProject?.id || ''}
 *   userId={userId}
 *   onCycleSelect={(cycle) => {
 *     plane.selectCycle(cycle);
 *     // Optionally filter tasks by this cycle
 *   }}
 *   onPageSelect={(page) => {
 *     plane.selectPage(page ? { id: page.id, name: page.name } : null);
 *     // Navigate to page editor
 *   }}
 * />
 * ```
 */

/**
 * STEP 7: Filter tasks by selected Plane features
 *
 * ```typescript
 * const filteredTasks = useMemo(() => {
 *   return tasks.filter(task => {
 *     // Filter by selected cycle
 *     if (plane.selectedCycle && task.cycleId !== plane.selectedCycle.id) {
 *       return false;
 *     }
 *     // Filter by selected module
 *     if (plane.selectedModule && task.moduleId !== plane.selectedModule.id) {
 *       return false;
 *     }
 *     // Filter by selected epic
 *     if (plane.selectedEpic && task.epicId !== plane.selectedEpic.id) {
 *       return false;
 *     }
 *     return true;
 *   });
 * }, [tasks, plane.selectedCycle, plane.selectedModule, plane.selectedEpic]);
 * ```
 */

/**
 * STEP 8: Update grid template to include Plane columns (optional)
 *
 * If you want dedicated columns instead of inline badges:
 * ```typescript
 * const gridTemplate = showPlaneColumns
 *   ? 'minmax(36px, 36px) minmax(200px, 1fr) 90px 100px 60px 60px 60px 80px 36px'
 *   : 'minmax(36px, 36px) minmax(200px, 1fr) 90px 100px 60px 36px';
 *   // Added columns: Type (60px), Cycle (60px), Module (80px)
 * ```
 */

// ============================================================
// EXAMPLE INTEGRATION COMPONENT
// ============================================================

interface PlaneIntegrationExampleProps {
  projectId: string;
  userId: string;
  tasks: Task[];
  onUpdateTask: (taskId: string, updates: Record<string, unknown>) => Promise<void>;
}

/**
 * Example component showing full integration
 * Copy the patterns from this into your tasks/page.tsx
 */
export function PlaneIntegrationExample({
  projectId,
  userId,
  tasks,
  onUpdateTask,
}: PlaneIntegrationExampleProps) {
  // Initialize Plane features hook
  const plane = usePlaneFeatures(projectId, userId);

  // Create lookup maps for efficient rendering
  const lookups = usePlaneLookups(
    plane.cycles,
    plane.modules,
    plane.epics,
    plane.workItemTypes
  );

  // Filter tasks based on selected Plane features
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (plane.selectedCycle && task.cycleId !== plane.selectedCycle.id) {
        return false;
      }
      if (plane.selectedModule && task.moduleId !== plane.selectedModule.id) {
        return false;
      }
      if (plane.selectedEpic && task.epicId !== plane.selectedEpic.id) {
        return false;
      }
      return true;
    });
  }, [tasks, plane.selectedCycle, plane.selectedModule, plane.selectedEpic]);

  // Handlers for updating task Plane assignments
  const handleAssignCycle = useCallback(async (taskId: string, cycleId: string | null) => {
    await onUpdateTask(taskId, { cycle_id: cycleId });
    plane.refreshCycles(); // Refresh to update task counts
  }, [onUpdateTask, plane]);

  const handleAssignModule = useCallback(async (taskId: string, moduleId: string | null) => {
    await onUpdateTask(taskId, { module_id: moduleId });
    plane.refreshModules();
  }, [onUpdateTask, plane]);

  const handleAssignEpic = useCallback(async (taskId: string, epicId: string | null) => {
    await onUpdateTask(taskId, { epic_id: epicId });
    plane.refreshEpics();
  }, [onUpdateTask, plane]);

  const handleAssignType = useCallback(async (taskId: string, typeId: string | null) => {
    await onUpdateTask(taskId, { work_item_type_id: typeId });
  }, [onUpdateTask]);

  // Render function for Plane badges in TaskRow
  const renderPlaneFields = useCallback((task: Task) => (
    <TaskPlaneBadges
      cycle={task.cycleId ? lookups.cyclesById[task.cycleId] : null}
      module={task.moduleId ? lookups.modulesById[task.moduleId] : null}
      epic={task.epicId ? lookups.epicsById[task.epicId] : null}
      workItemType={task.workItemTypeId ? lookups.typesById[task.workItemTypeId] : null}
      onCycleClick={() => {
        // Open cycle selector popover
        console.log('Open cycle popover for task', task.id);
      }}
      onModuleClick={() => {
        // Open module selector popover
        console.log('Open module popover for task', task.id);
      }}
      onEpicClick={() => {
        // Open epic selector popover
        console.log('Open epic popover for task', task.id);
      }}
      onTypeClick={() => {
        // Open type selector popover
        console.log('Open type popover for task', task.id);
      }}
      compact={true}
    />
  ), [lookups]);

  // Handle sidebar selections
  const handleCycleSelect = useCallback((cycle: Cycle | null) => {
    plane.selectCycle(cycle);
  }, [plane]);

  const handlePageSelect = useCallback((page: { id: string; name: string } | null) => {
    // Find the full page object from the pages array
    const fullPage = page ? plane.pages.find(p => p.id === page.id) || null : null;
    plane.selectPage(fullPage);
    // Navigate to page editor if page selected
    if (page) {
      // router.push(`/tasks/pages/${page.id}`);
    }
  }, [plane]);

  return (
    <div className="flex h-full">
      {/* Sidebar with Plane features */}
      <aside className="w-64 border-r">
        <PlaneFeaturesSidebar
          projectId={projectId}
          userId={userId}
          onCycleSelect={handleCycleSelect}
          onPageSelect={handlePageSelect}
        />
      </aside>

      {/* Main content area */}
      <main className="flex-1">
        {/* Active filters display */}
        {(plane.selectedCycle || plane.selectedModule || plane.selectedEpic) && (
          <div className="flex items-center gap-2 p-2 bg-white/5">
            {plane.selectedCycle && (
              <span className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 text-sm">
                Cycle: {plane.selectedCycle.name}
                <button onClick={() => plane.selectCycle(null)} className="ml-2">&times;</button>
              </span>
            )}
            {plane.selectedModule && (
              <span className="px-2 py-1 rounded text-sm" style={{ background: `${plane.selectedModule.color}20`, color: plane.selectedModule.color }}>
                Module: {plane.selectedModule.name}
                <button onClick={() => plane.selectModule(null)} className="ml-2">&times;</button>
              </span>
            )}
            {plane.selectedEpic && (
              <span className="px-2 py-1 rounded text-sm" style={{ background: `${plane.selectedEpic.color}20`, color: plane.selectedEpic.color }}>
                Epic: {plane.selectedEpic.name}
                <button onClick={() => plane.selectEpic(null)} className="ml-2">&times;</button>
              </span>
            )}
          </div>
        )}

        {/* Task list - pass renderPlaneFields to TaskRow */}
        <div>
          <p className="p-4 text-sm text-gray-400">
            Filtered tasks: {filteredTasks.length}
          </p>
          {/* Your existing task list rendering here */}
          {/* Pass renderCustomFields={renderPlaneFields} to each TaskRow */}
        </div>
      </main>
    </div>
  );
}

// ============================================================
// POPOVER COMPONENTS FOR PLANE ASSIGNMENTS
// ============================================================

/**
 * Example: CycleAssignPopover
 * Create similar popovers for Module, Epic, and Type
 */
interface CycleAssignPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  cycles: Cycle[];
  currentCycleId: string | null;
  onSelect: (cycleId: string | null) => void;
}

export function CycleAssignPopover({
  isOpen,
  onClose,
  cycles,
  currentCycleId,
  onSelect,
}: CycleAssignPopoverProps) {
  if (!isOpen) return null;

  const activeCycles = cycles.filter(c => c.status === 'active' || c.status === 'planned');

  return (
    <div className="absolute z-50 mt-1 p-2 rounded-lg bg-gray-900 border border-white/10 shadow-xl min-w-[200px]">
      <div className="text-xs text-gray-400 px-2 py-1">Assign to Cycle</div>

      {/* No cycle option */}
      <button
        onClick={() => {
          onSelect(null);
          onClose();
        }}
        className={`w-full text-left px-3 py-2 rounded hover:bg-white/5 ${
          !currentCycleId ? 'bg-white/10' : ''
        }`}
      >
        <span className="text-gray-400">No cycle</span>
      </button>

      {/* Cycle options */}
      {activeCycles.map(cycle => (
        <button
          key={cycle.id}
          onClick={() => {
            onSelect(cycle.id);
            onClose();
          }}
          className={`w-full text-left px-3 py-2 rounded hover:bg-white/5 ${
            currentCycleId === cycle.id ? 'bg-indigo-500/20' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-white">{cycle.name}</span>
            {cycle.status === 'active' && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                Active
              </span>
            )}
          </div>
          {cycle.start_date && cycle.end_date && (
            <div className="text-xs text-gray-500 mt-0.5">
              {new Date(cycle.start_date).toLocaleDateString()} - {new Date(cycle.end_date).toLocaleDateString()}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

export default PlaneIntegrationExample;

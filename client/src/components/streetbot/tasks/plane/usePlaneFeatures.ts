'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Cycle } from '@/lib/api/cycles';
import type { Module, Epic, WorkItemType, StateGroup } from '@/lib/api/modules';
import type { Page } from '@/lib/api/pages';
import { getCycles, getActiveCycle, type CycleCreate, createCycle } from '@/lib/api/cycles';
import { getModules, getEpics, getWorkItemTypes, getStateGroups } from '@/lib/api/modules';
import { getPages, getPageTree, type PageTreeNode } from '@/lib/api/pages';

interface PlaneFeatures {
  // Cycles
  cycles: Cycle[];
  activeCycle: Cycle | null;
  selectedCycle: Cycle | null;
  selectCycle: (cycle: Cycle | null) => void;
  refreshCycles: () => Promise<void>;

  // Modules
  modules: Module[];
  selectedModule: Module | null;
  selectModule: (module: Module | null) => void;
  refreshModules: () => Promise<void>;

  // Epics
  epics: Epic[];
  selectedEpic: Epic | null;
  selectEpic: (epic: Epic | null) => void;
  refreshEpics: () => Promise<void>;

  // Work Item Types
  workItemTypes: WorkItemType[];
  refreshWorkItemTypes: () => Promise<void>;

  // State Groups
  stateGroups: StateGroup[];
  refreshStateGroups: () => Promise<void>;

  // Pages
  pages: Page[];
  pageTree: PageTreeNode[];
  selectedPage: Page | null;
  selectPage: (page: Page | null) => void;
  refreshPages: () => Promise<void>;

  // Loading states
  loading: {
    cycles: boolean;
    modules: boolean;
    epics: boolean;
    workItemTypes: boolean;
    stateGroups: boolean;
    pages: boolean;
  };
}

export function usePlaneFeatures(projectId: string, userId: string): PlaneFeatures {
  // Cycles state
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [loadingCycles, setLoadingCycles] = useState(false);

  // Modules state
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [loadingModules, setLoadingModules] = useState(false);

  // Epics state
  const [epics, setEpics] = useState<Epic[]>([]);
  const [selectedEpic, setSelectedEpic] = useState<Epic | null>(null);
  const [loadingEpics, setLoadingEpics] = useState(false);

  // Work Item Types state
  const [workItemTypes, setWorkItemTypes] = useState<WorkItemType[]>([]);
  const [loadingWorkItemTypes, setLoadingWorkItemTypes] = useState(false);

  // State Groups state
  const [stateGroups, setStateGroups] = useState<StateGroup[]>([]);
  const [loadingStateGroups, setLoadingStateGroups] = useState(false);

  // Pages state
  const [pages, setPages] = useState<Page[]>([]);
  const [pageTree, setPageTree] = useState<PageTreeNode[]>([]);
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [loadingPages, setLoadingPages] = useState(false);

  // Refresh functions
  const refreshCycles = useCallback(async () => {
    if (!projectId) return;
    setLoadingCycles(true);
    try {
      const [allCycles, active] = await Promise.all([
        getCycles(projectId),
        getActiveCycle(projectId),
      ]);
      setCycles(allCycles);
      setActiveCycle(active);
    } catch (error) {
      console.error('Failed to load cycles:', error);
    } finally {
      setLoadingCycles(false);
    }
  }, [projectId]);

  const refreshModules = useCallback(async () => {
    if (!projectId) return;
    setLoadingModules(true);
    try {
      const data = await getModules(projectId);
      setModules(data);
    } catch (error) {
      console.error('Failed to load modules:', error);
    } finally {
      setLoadingModules(false);
    }
  }, [projectId]);

  const refreshEpics = useCallback(async () => {
    if (!projectId) return;
    setLoadingEpics(true);
    try {
      const data = await getEpics(projectId);
      setEpics(data);
    } catch (error) {
      console.error('Failed to load epics:', error);
    } finally {
      setLoadingEpics(false);
    }
  }, [projectId]);

  const refreshWorkItemTypes = useCallback(async () => {
    if (!projectId) return;
    setLoadingWorkItemTypes(true);
    try {
      const data = await getWorkItemTypes(projectId);
      setWorkItemTypes(data);
    } catch (error) {
      console.error('Failed to load work item types:', error);
    } finally {
      setLoadingWorkItemTypes(false);
    }
  }, [projectId]);

  const refreshStateGroups = useCallback(async () => {
    if (!projectId) return;
    setLoadingStateGroups(true);
    try {
      const data = await getStateGroups(projectId);
      setStateGroups(data);
    } catch (error) {
      console.error('Failed to load state groups:', error);
    } finally {
      setLoadingStateGroups(false);
    }
  }, [projectId]);

  const refreshPages = useCallback(async () => {
    if (!projectId || !userId) return;
    setLoadingPages(true);
    try {
      const [pagesList, tree] = await Promise.all([
        getPages(projectId, userId),
        getPageTree(projectId),
      ]);
      setPages(pagesList);
      setPageTree(tree);
    } catch (error) {
      console.error('Failed to load pages:', error);
    } finally {
      setLoadingPages(false);
    }
  }, [projectId, userId]);

  // Initial load
  useEffect(() => {
    if (projectId) {
      refreshCycles();
      refreshModules();
      refreshEpics();
      refreshWorkItemTypes();
      refreshStateGroups();
      refreshPages();
    }
  }, [projectId, refreshCycles, refreshModules, refreshEpics, refreshWorkItemTypes, refreshStateGroups, refreshPages]);

  return {
    // Cycles
    cycles,
    activeCycle,
    selectedCycle,
    selectCycle: setSelectedCycle,
    refreshCycles,

    // Modules
    modules,
    selectedModule,
    selectModule: setSelectedModule,
    refreshModules,

    // Epics
    epics,
    selectedEpic,
    selectEpic: setSelectedEpic,
    refreshEpics,

    // Work Item Types
    workItemTypes,
    refreshWorkItemTypes,

    // State Groups
    stateGroups,
    refreshStateGroups,

    // Pages
    pages,
    pageTree,
    selectedPage,
    selectPage: setSelectedPage,
    refreshPages,

    // Loading states
    loading: {
      cycles: loadingCycles,
      modules: loadingModules,
      epics: loadingEpics,
      workItemTypes: loadingWorkItemTypes,
      stateGroups: loadingStateGroups,
      pages: loadingPages,
    },
  };
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Cycle } from '@/lib/api/cycles';
import type { Page } from '@/lib/api/pages';
import { getCycles, createCycle, getActiveCycle, type CycleCreate } from '@/lib/api/cycles';
import { getPageTree, createPage, type PageCreate, type PageTreeNode } from '@/lib/api/pages';
import { CycleSidebar, CyclePlanningModal } from '../cycles';
import { PagesSidebar } from '../pages';

interface PlaneFeaturesSidebarProps {
  projectId: string;
  userId: string;
  onCycleSelect?: (cycle: Cycle | null) => void;
  onPageSelect?: (page: { id: string; name: string } | null) => void;
}

export default function PlaneFeaturesSidebar({
  projectId,
  userId,
  onCycleSelect,
  onPageSelect,
}: PlaneFeaturesSidebarProps) {
  const [selectedCycleId, setSelectedCycleId] = useState<string | undefined>();
  const [selectedPageId, setSelectedPageId] = useState<string | undefined>();
  const [showCyclePlanningModal, setShowCyclePlanningModal] = useState(false);
  const [showCreatePage, setShowCreatePage] = useState(false);

  const handleSelectCycle = useCallback((cycle: Cycle | null) => {
    setSelectedCycleId(cycle?.id);
    onCycleSelect?.(cycle);
  }, [onCycleSelect]);

  const handleSelectPage = useCallback((page: { id: string; name: string } | null) => {
    setSelectedPageId(page?.id);
    onPageSelect?.(page);
  }, [onPageSelect]);

  const handleCreateCycle = useCallback(async (data: CycleCreate) => {
    await createCycle(projectId, data, userId);
    // The CycleSidebar will reload automatically
  }, [projectId, userId]);

  const handleCreatePage = useCallback(async () => {
    const page = await createPage(projectId, { name: 'Untitled Page' }, userId);
    if (page) {
      handleSelectPage({ id: page.id, name: page.name });
    }
    setShowCreatePage(false);
  }, [projectId, userId, handleSelectPage]);

  return (
    <div className="space-y-4">
      {/* Cycles Section */}
      <CycleSidebar
        projectId={projectId}
        userId={userId}
        selectedCycleId={selectedCycleId}
        onSelectCycle={handleSelectCycle}
        onCreateCycle={() => setShowCyclePlanningModal(true)}
      />

      {/* Pages Section */}
      <PagesSidebar
        projectId={projectId}
        userId={userId}
        selectedPageId={selectedPageId}
        onSelectPage={handleSelectPage}
        onCreatePage={handleCreatePage}
      />

      {/* Cycle Planning Modal */}
      <CyclePlanningModal
        isOpen={showCyclePlanningModal}
        onClose={() => setShowCyclePlanningModal(false)}
        onSubmit={handleCreateCycle}
      />
    </div>
  );
}

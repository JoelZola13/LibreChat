import { useState, useEffect, useCallback, useRef } from 'react';
import { paperclipFetch } from './config';
import type { DashboardStats, PaperclipAgent, PaperclipIssue, ActivityItem, LiveRun } from './types';

interface WidgetData<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface MissionControlData {
  stats: WidgetData<DashboardStats>;
  agents: WidgetData<PaperclipAgent[]>;
  issues: WidgetData<PaperclipIssue[]>;
  activity: WidgetData<ActivityItem[]>;
  liveRuns: WidgetData<LiveRun[]>;
  refresh: () => void;
}

async function fetchSafe<T>(fn: () => Promise<T>): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (e: unknown) {
    return { data: null, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

function resolve<T>(result: PromiseSettledResult<{ data: T | null; error: string | null }>): WidgetData<T> {
  if (result.status === 'rejected') return { data: null, loading: false, error: 'Request failed' };
  return { data: result.value.data, loading: false, error: result.value.error };
}

const LOADING: WidgetData<any> = { data: null, loading: true, error: null };

export function useMissionControlData(): MissionControlData {
  const [stats, setStats] = useState<WidgetData<DashboardStats>>(LOADING);
  const [agents, setAgents] = useState<WidgetData<PaperclipAgent[]>>(LOADING);
  const [issues, setIssues] = useState<WidgetData<PaperclipIssue[]>>(LOADING);
  const [activity, setActivity] = useState<WidgetData<ActivityItem[]>>(LOADING);
  const [liveRuns, setLiveRuns] = useState<WidgetData<LiveRun[]>>(LOADING);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    setStats(LOADING);
    setAgents(LOADING);
    setIssues(LOADING);
    setActivity(LOADING);
    setLiveRuns(LOADING);

    const [statsRes, agentsRes, issuesRes, activityRes, liveRes] = await Promise.allSettled([
      fetchSafe(() => paperclipFetch<DashboardStats>('/dashboard')),
      fetchSafe(() => paperclipFetch<PaperclipAgent[]>('/agents')),
      fetchSafe(() => paperclipFetch<PaperclipIssue[]>('/issues')),
      fetchSafe(() => paperclipFetch<ActivityItem[]>('/activity?limit=20')),
      fetchSafe(() => paperclipFetch<LiveRun[]>('/live-runs')),
    ]);

    setStats(resolve(statsRes));
    setAgents(resolve(agentsRes));
    setIssues(resolve(issuesRes));
    setActivity(resolve(activityRes));
    setLiveRuns(resolve(liveRes));
  }, []);

  // Poll live-runs every 30s for real-time agent status
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      const res = await fetchSafe(() => paperclipFetch<LiveRun[]>('/live-runs'));
      setLiveRuns({ data: res.data, loading: false, error: res.error });
    }, 30000);
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { stats, agents, issues, activity, liveRuns, refresh: load };
}

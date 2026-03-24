import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassBackground } from '../shared/GlassBackground';
import { useGlassStyles } from '../shared/useGlassStyles';
import { useResponsive } from '../hooks/useResponsive';
import { useUserRole } from '~/components/streetbot/lib/auth/useUserRole';
import { useAuthContext } from '~/hooks';

type ClaimStatus = 'pending' | 'approved' | 'rejected';
type AutomationJob = 'digest' | 'reengagement' | 'approvals';

interface ModerationClaim {
  id: string | number;
  mongo_id?: string;
  service_id: number;
  user_id: string;
  status: ClaimStatus;
  organization?: string;
  notes?: string;
  service_name?: string;
  service_city?: string;
  claimant_name?: string;
  claimant_email?: string;
  claimant_role?: string;
  moderated_at?: string;
  rejection_reason?: string;
  created_at?: string;
  updated_at?: string;
}

interface ClaimsResponse {
  claims: ModerationClaim[];
  total: number;
  page: number;
  perPage: number;
  serverPaginated: boolean;
}

interface AutomationRun {
  id: string;
  jobName: AutomationJob;
  trigger: string;
  force: boolean;
  initiatedBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  success: boolean;
  result: Record<string, unknown>;
  error: string | null;
}

interface AutomationSnapshot {
  scheduler: {
    enabled: boolean;
    running: boolean;
    intervalMs: number;
    timeZone: string;
    digestDay: string;
    digestHour: number;
    startedAt: string | null;
    sbApiBaseUrl: string | null;
    appBaseUrl: string | null;
  };
  jobs: Record<AutomationJob, AutomationRun | null>;
  recentRuns: AutomationRun[];
}

const JOB_LABELS: Record<AutomationJob, string> = {
  digest: 'Weekly Digest',
  reengagement: 'Re-engagement',
  approvals: 'Listing Approvals',
};

async function apiFetch<T>(path: string, token?: string | null, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

const formatTimestamp = (value?: string | null) => {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
};

const renderRunSummary = (run: AutomationRun | null) => {
  if (!run) {
    return 'No runs yet';
  }

  const sent = typeof run.result?.sent === 'number' ? run.result.sent : null;
  const skipped = run.result?.skipped === true;
  const suffix = sent !== null ? `${sent} sent` : skipped ? 'skipped' : run.success ? 'completed' : 'failed';
  return `${formatTimestamp(run.completedAt)} · ${suffix}`;
};

export default function AdminClaimsPage() {
  const navigate = useNavigate();
  const { colors, glassCard } = useGlassStyles();
  const { isMobile } = useResponsive();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { token } = useAuthContext();

  const [claims, setClaims] = useState<ModerationClaim[]>([]);
  const [totalClaims, setTotalClaims] = useState(0);
  const [claimStatus, setClaimStatus] = useState<'all' | ClaimStatus>('pending');
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [claimsError, setClaimsError] = useState<string | null>(null);

  const [automation, setAutomation] = useState<AutomationSnapshot | null>(null);
  const [automationLoading, setAutomationLoading] = useState(true);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [forceRun, setForceRun] = useState(true);
  const [busyJob, setBusyJob] = useState<string | null>(null);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate('/home', { replace: true });
    }
  }, [roleLoading, isAdmin, navigate]);

  const loadAutomation = useCallback(async () => {
    setAutomationLoading(true);
    setAutomationError(null);
    try {
      const snapshot = await apiFetch<AutomationSnapshot>('/api/listmonk/automations/status', token);
      setAutomation(snapshot);
    } catch (error) {
      setAutomationError((error as Error).message);
    } finally {
      setAutomationLoading(false);
    }
  }, [token]);

  const loadClaims = useCallback(async () => {
    setClaimsLoading(true);
    setClaimsError(null);
    try {
      const params = new URLSearchParams();
      if (claimStatus !== 'all') {
        params.set('status', claimStatus);
      }
      params.set('per_page', '100');
      const response = await apiFetch<ClaimsResponse>(`/api/claims?${params.toString()}`, token);
      setClaims(response.claims || []);
      setTotalClaims(response.total || 0);
    } catch (error) {
      setClaimsError((error as Error).message);
    } finally {
      setClaimsLoading(false);
    }
  }, [claimStatus, token]);

  useEffect(() => {
    if (isAdmin) {
      void loadAutomation();
      void loadClaims();
    }
  }, [isAdmin, loadAutomation, loadClaims]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadAutomation(), loadClaims()]);
  }, [loadAutomation, loadClaims]);

  const handleRunJobs = useCallback(
    async (jobs: AutomationJob[]) => {
      setBusyJob(jobs.join(','));
      setAutomationError(null);
      try {
        await apiFetch('/api/listmonk/automations/run', token, {
          method: 'POST',
          body: JSON.stringify({ jobs, force: forceRun }),
        });
        await loadAutomation();
      } catch (error) {
        setAutomationError((error as Error).message);
      } finally {
        setBusyJob(null);
      }
    },
    [forceRun, loadAutomation, token],
  );

  const handleClaimUpdate = useCallback(
    async (claim: ModerationClaim, status: ClaimStatus) => {
      setBusyJob(`claim-${claim.id}-${status}`);
      setClaimsError(null);
      try {
        await apiFetch(`/api/claims/${claim.mongo_id || claim.id}`, token, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        await Promise.all([loadClaims(), loadAutomation()]);
      } catch (error) {
        setClaimsError((error as Error).message);
      } finally {
        setBusyJob(null);
      }
    },
    [loadAutomation, loadClaims, token],
  );

  const pendingCount = useMemo(
    () => claims.filter((claim) => claim.status === 'pending').length,
    [claims],
  );

  if (roleLoading) {
    return <div style={{ padding: 120, color: colors.text }}>Loading...</div>;
  }

  if (!isAdmin) {
    return null;
  }

  const toolbarButtonStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    background: 'rgba(255,255,255,0.06)',
    color: colors.text,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Rubik, sans-serif',
  };

  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ fontFamily: 'Rubik, sans-serif' }}>
      <GlassBackground />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1180,
          margin: '0 auto',
          padding: isMobile ? '24px 14px 40px' : '40px 28px 60px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ color: colors.text, fontSize: isMobile ? 28 : 36, margin: 0 }}>Claims & Email Automation</h1>
            <p style={{ color: colors.textSecondary, fontSize: 15, margin: '10px 0 0' }}>
              Moderate provider claims, trigger listmonk jobs, and inspect the last run results.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button style={toolbarButtonStyle} onClick={() => navigate('/manage/roles')}>
              Roles
            </button>
            <label style={{ color: colors.textSecondary, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={forceRun} onChange={(e) => setForceRun(e.target.checked)} />
              Force run
            </label>
            <button style={toolbarButtonStyle} onClick={() => void refreshAll()}>
              Refresh
            </button>
          </div>
        </div>

        <section style={{ ...glassCard, marginTop: 22, padding: isMobile ? 16 : 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <h2 style={{ color: colors.text, fontSize: 20, margin: 0 }}>Automation Console</h2>
              <p style={{ color: colors.textMuted, fontSize: 13, margin: '6px 0 0' }}>
                Scheduler {automation?.scheduler.enabled ? 'enabled' : 'disabled'} · interval {automation?.scheduler.intervalMs ? `${Math.round(automation.scheduler.intervalMs / 60000)} min` : '--'} · timezone {automation?.scheduler.timeZone || '—'}
              </p>
            </div>
            <button
              style={{ ...toolbarButtonStyle, background: colors.accent, color: '#000', border: 'none' }}
              onClick={() => void handleRunJobs(['digest', 'reengagement', 'approvals'])}
              disabled={busyJob !== null}
            >
              {busyJob === 'digest,reengagement,approvals' ? 'Running…' : 'Run All Now'}
            </button>
          </div>

          {automationError && (
            <p style={{ color: '#fca5a5', fontSize: 13, marginTop: 12 }}>{automationError}</p>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
              gap: 12,
              marginTop: 18,
            }}
          >
            {(['digest', 'reengagement', 'approvals'] as AutomationJob[]).map((job) => {
              const run = automation?.jobs?.[job] || null;
              const isBusy = busyJob === job;
              return (
                <div
                  key={job}
                  style={{
                    borderRadius: 16,
                    border: `1px solid ${colors.border}`,
                    background: 'rgba(255,255,255,0.04)',
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ color: colors.text, fontSize: 16, fontWeight: 700 }}>{JOB_LABELS[job]}</div>
                      <div style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>{renderRunSummary(run)}</div>
                    </div>
                    <button
                      style={{ ...toolbarButtonStyle, minWidth: 92 }}
                      onClick={() => void handleRunJobs([job])}
                      disabled={busyJob !== null || automationLoading}
                    >
                      {isBusy ? 'Running…' : 'Run Now'}
                    </button>
                  </div>
                  <div style={{ color: run?.success === false ? '#fca5a5' : colors.textSecondary, fontSize: 12, marginTop: 12 }}>
                    {run?.error || (run?.result?.skipped === true ? 'Last run skipped' : 'Ready')}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ color: colors.text, fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Recent Runs</div>
            {automationLoading ? (
              <div style={{ color: colors.textMuted, fontSize: 13 }}>Loading automation history…</div>
            ) : automation?.recentRuns?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {automation.recentRuns.slice(0, 8).map((run) => (
                  <div
                    key={run.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '160px 120px 160px 1fr',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${colors.border}`,
                      color: colors.textSecondary,
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: colors.text, fontWeight: 600 }}>{JOB_LABELS[run.jobName]}</span>
                    <span>{run.trigger}{run.force ? ' · force' : ''}</span>
                    <span>{formatTimestamp(run.completedAt)}</span>
                    <span style={{ color: run.success ? colors.textSecondary : '#fca5a5' }}>
                      {run.error || JSON.stringify(run.result || {})}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: colors.textMuted, fontSize: 13 }}>No automation runs recorded yet.</div>
            )}
          </div>
        </section>

        <section style={{ ...glassCard, marginTop: 22, padding: isMobile ? 16 : 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <h2 style={{ color: colors.text, fontSize: 20, margin: 0 }}>Claims Moderation</h2>
              <p style={{ color: colors.textMuted, fontSize: 13, margin: '6px 0 0' }}>
                {totalClaims} total claim{totalClaims === 1 ? '' : 's'} · {pendingCount} pending in this view
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select
                value={claimStatus}
                onChange={(e) => setClaimStatus(e.target.value as 'all' | ClaimStatus)}
                style={{ ...toolbarButtonStyle, minWidth: 140 }}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>

          {claimsError && <p style={{ color: '#fca5a5', fontSize: 13, marginTop: 12 }}>{claimsError}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
            {claimsLoading ? (
              <div style={{ color: colors.textMuted, fontSize: 13 }}>Loading claims…</div>
            ) : claims.length === 0 ? (
              <div style={{ color: colors.textMuted, fontSize: 13 }}>No claims found for this filter.</div>
            ) : (
              claims.map((claim) => (
                <div
                  key={claim.mongo_id || claim.id}
                  style={{
                    borderRadius: 16,
                    border: `1px solid ${colors.border}`,
                    background: 'rgba(255,255,255,0.03)',
                    padding: isMobile ? 14 : 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: colors.text, fontSize: 16, fontWeight: 700 }}>
                        {claim.service_name || `Service #${claim.service_id}`}
                      </div>
                      <div style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6 }}>
                        {claim.claimant_name || claim.claimant_email || claim.user_id}
                        {claim.claimant_email ? ` · ${claim.claimant_email}` : ''}
                        {claim.claimant_role ? ` · ${claim.claimant_role}` : ''}
                        {claim.service_city ? ` · ${claim.service_city}` : ''}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        background:
                          claim.status === 'approved'
                            ? 'rgba(34,197,94,0.16)'
                            : claim.status === 'rejected'
                              ? 'rgba(248,113,113,0.16)'
                              : 'rgba(250,204,21,0.16)',
                        color:
                          claim.status === 'approved'
                            ? '#4ade80'
                            : claim.status === 'rejected'
                              ? '#fca5a5'
                              : '#fde047',
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        alignSelf: 'flex-start',
                      }}
                    >
                      {claim.status}
                    </div>
                  </div>

                  <div style={{ color: colors.textMuted, fontSize: 13, marginTop: 10, lineHeight: 1.6 }}>
                    <div>Organization: {claim.organization || '—'}</div>
                    <div>Role: {claim.claimant_role || '—'}</div>
                    <div>Created: {formatTimestamp(claim.created_at)}</div>
                    <div>Updated: {formatTimestamp(claim.updated_at)}</div>
                    {claim.notes ? <div style={{ marginTop: 8 }}>Notes: {claim.notes}</div> : null}
                    {claim.rejection_reason ? <div style={{ marginTop: 8 }}>Reason: {claim.rejection_reason}</div> : null}
                  </div>

                  {claim.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                      <button
                        style={{ ...toolbarButtonStyle, background: '#f9d900', color: '#000', border: 'none' }}
                        onClick={() => void handleClaimUpdate(claim, 'approved')}
                        disabled={busyJob !== null}
                      >
                        {busyJob === `claim-${claim.id}-approved` ? 'Approving…' : 'Approve'}
                      </button>
                      <button
                        style={toolbarButtonStyle}
                        onClick={() => void handleClaimUpdate(claim, 'rejected')}
                        disabled={busyJob !== null}
                      >
                        {busyJob === `claim-${claim.id}-rejected` ? 'Rejecting…' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

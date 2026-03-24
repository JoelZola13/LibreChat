import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useGlassStyles } from '../shared/useGlassStyles';
import { sbFetch } from '../shared/sbFetch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StorageOverview = {
  total_buckets: number;
  total_size_bytes: number;
  total_size_formatted: string;
  total_objects: number;
  trash_size_bytes: number;
  trash_count: number;
  orphan_count: number;
  pending_jobs: number;
  growth_30d_bytes: number;
  growth_30d_percent: number;
  estimated_monthly_cost?: number;
  supabase_usage?: {
    plan_name: string;
    storage_used_bytes: number;
    storage_used_formatted: string;
    storage_limit_bytes: number;
    storage_limit_formatted: string;
    storage_percent: number;
    storage_exceeded: boolean;
    database_limit_bytes: number;
    database_limit_formatted: string;
    bandwidth_limit_bytes: number;
    bandwidth_limit_formatted: string;
    is_over_quota: boolean;
    grace_period_end?: string;
    warning_message?: string;
  };
};

type StorageBucket = {
  id: string;
  name: string;
  provider: string;
  is_public: boolean;
  total_size_bytes: number;
  object_count: number;
  last_synced_at?: string;
  created_at: string;
};

type StorageAlert = {
  id: string;
  type: string;
  severity: string;
  bucket?: string;
  message: string;
  acknowledged: boolean;
  created_at: string;
};

type TabType = 'overview' | 'buckets' | 'alerts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let size = bytes;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx++;
  }
  return `${size.toFixed(2)} ${units[idx]}`;
}

// ---------------------------------------------------------------------------
// Inline SVG Icons
// ---------------------------------------------------------------------------

type IconProps = { size?: number; color?: string; style?: React.CSSProperties };

const DatabaseIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const HardDriveIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="22" y1="12" x2="2" y2="12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /><line x1="6" y1="16" x2="6.01" y2="16" /><line x1="10" y1="16" x2="10.01" y2="16" />
  </svg>
);

const TrashIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const AlertTriangleIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const RefreshIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const CheckCircleIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StoragePage() {
  const { isDark, colors, glassCard, glassSurface, glassButton, accentButton } = useGlassStyles();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [overview, setOverview] = useState<StorageOverview | null>(null);
  const [buckets, setBuckets] = useState<StorageBucket[]>([]);
  const [alerts, setAlerts] = useState<StorageAlert[]>([]);
  const [unackCount, setUnackCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const resp = await sbFetch('/api/storage/overview');
      if (resp.ok) setOverview(await resp.json());
    } catch (err) {
      console.error('Failed to load storage overview:', err);
    }
  }, []);

  const loadBuckets = useCallback(async () => {
    try {
      const resp = await sbFetch('/api/storage/buckets');
      if (resp.ok) {
        const data = await resp.json();
        setBuckets(data.buckets || []);
      }
    } catch (err) {
      console.error('Failed to load buckets:', err);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const resp = await sbFetch('/api/storage/alerts?unacknowledged_only=true');
      if (resp.ok) {
        const data = await resp.json();
        setAlerts(data.alerts || []);
        setUnackCount(data.unacknowledged_count || 0);
      }
    } catch (err) {
      console.error('Failed to load alerts:', err);
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([loadOverview(), loadBuckets(), loadAlerts()]);
      setLoading(false);
    }
    init();
  }, [loadOverview, loadBuckets, loadAlerts]);

  useEffect(() => {
    if (activeTab === 'overview') loadOverview();
    if (activeTab === 'buckets') loadBuckets();
    if (activeTab === 'alerts') loadAlerts();
  }, [activeTab, loadOverview, loadBuckets, loadAlerts]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await sbFetch('/api/storage/buckets/sync', { method: 'POST' });
      await loadBuckets();
      await loadOverview();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await sbFetch(`/api/storage/alerts/${alertId}/acknowledge`, { method: 'POST' });
      await loadAlerts();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'buckets', label: 'Buckets' },
    { id: 'alerts', label: `Alerts${unackCount > 0 ? ` (${unackCount})` : ''}` },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: colors.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
        Loading storage data...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px', minHeight: '70vh', position: 'relative', zIndex: 1, fontFamily: 'Rubik, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: colors.text }}>
            Storage Management
          </h1>
          <p style={{ marginTop: 6, color: colors.textSecondary, fontSize: '0.95rem' }}>
            Track and manage platform storage including Supabase
          </p>
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          style={{
            ...glassButton,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'Rubik, sans-serif',
            opacity: syncing ? 0.6 : 1,
          }}
        >
          <RefreshIcon size={16} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          {syncing ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 14, background: colors.surface, marginBottom: 20, backdropFilter: 'blur(16px)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Rubik, sans-serif',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: activeTab === tab.id ? colors.accent : 'transparent',
              color: activeTab === tab.id ? '#000' : colors.text,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Supabase Usage Banner */}
      {activeTab === 'overview' && overview?.supabase_usage && (
        <div
          style={{
            ...glassCard,
            padding: 20,
            marginBottom: 20,
            borderLeft: `4px solid ${overview.supabase_usage.is_over_quota ? colors.error : overview.supabase_usage.storage_percent >= 80 ? colors.warning : colors.success}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, color: colors.text }}>
              Supabase {overview.supabase_usage.plan_name} Plan
              {overview.supabase_usage.is_over_quota && (
                <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 4, fontSize: 11, background: colors.error, color: '#fff' }}>
                  QUOTA EXCEEDED
                </span>
              )}
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: overview.supabase_usage.is_over_quota ? colors.error : overview.supabase_usage.storage_percent >= 80 ? colors.warning : colors.success }}>
              {overview.supabase_usage.storage_percent.toFixed(1)}% used
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ height: 10, borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', marginBottom: 10 }}>
            <div
              style={{
                height: '100%',
                borderRadius: 999,
                width: `${Math.min(overview.supabase_usage.storage_percent, 100)}%`,
                background: overview.supabase_usage.is_over_quota ? colors.error : overview.supabase_usage.storage_percent >= 80 ? colors.warning : colors.success,
                transition: 'width 0.5s ease',
              }}
            />
          </div>
          <div style={{ fontSize: 13, color: colors.textSecondary }}>
            {overview.supabase_usage.storage_used_formatted} / {overview.supabase_usage.storage_limit_formatted}
          </div>
          {overview.supabase_usage.warning_message && (
            <div style={{ marginTop: 8, fontSize: 13, color: overview.supabase_usage.is_over_quota ? colors.error : colors.warning }}>
              {overview.supabase_usage.warning_message}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${colors.border}` }}>
            {[
              { label: 'Storage', value: overview.supabase_usage.storage_limit_formatted },
              { label: 'Database', value: overview.supabase_usage.database_limit_formatted },
              { label: 'Bandwidth', value: `${overview.supabase_usage.bandwidth_limit_formatted}/mo` },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.textMuted }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overview Stats */}
      {activeTab === 'overview' && overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
          {[
            { label: 'Total Storage', value: overview.total_size_formatted, sub: `${overview.total_objects} objects`, icon: HardDriveIcon },
            { label: 'Buckets', value: String(overview.total_buckets), icon: DatabaseIcon },
            { label: 'Trash', value: formatBytes(overview.trash_size_bytes), sub: `${overview.trash_count} items`, icon: TrashIcon },
            { label: 'Pending Issues', value: String(overview.orphan_count + overview.pending_jobs), sub: `${overview.orphan_count} orphans, ${overview.pending_jobs} jobs`, icon: AlertTriangleIcon },
          ].map((stat) => (
            <div key={stat.label} style={{ ...glassCard, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, color: colors.textSecondary }}>{stat.label}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: colors.text, marginTop: 4 }}>{stat.value}</div>
                  {stat.sub && <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>{stat.sub}</div>}
                </div>
                <div style={{ padding: 10, borderRadius: 10, background: `${colors.accent}20` }}>
                  <stat.icon size={22} color={colors.accent} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Buckets Tab */}
      {activeTab === 'buckets' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {buckets.map((bucket) => (
            <div key={bucket.id} style={{ ...glassCard, padding: 20, cursor: 'pointer', transition: 'all 0.2s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ padding: 8, borderRadius: 10, background: `${colors.accent}20` }}>
                  <DatabaseIcon size={20} color={colors.accent} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: colors.text }}>{bucket.name}</div>
                  <div style={{ fontSize: 12, color: colors.textMuted }}>{bucket.is_public ? 'Public' : 'Private'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: colors.textSecondary }}>Size</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{formatBytes(bucket.total_size_bytes)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: colors.textSecondary }}>Objects</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{bucket.object_count.toLocaleString()}</span>
                </div>
                {bucket.last_synced_at && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: colors.textSecondary }}>Last Sync</span>
                    <span style={{ fontSize: 12, color: colors.textMuted }}>{new Date(bucket.last_synced_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {buckets.length === 0 && (
            <div style={{ ...glassCard, padding: 40, textAlign: 'center', gridColumn: '1 / -1' }}>
              <DatabaseIcon size={40} color={colors.textMuted} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: colors.text, marginBottom: 6 }}>No buckets found</div>
              <div style={{ fontSize: 13, color: colors.textMuted }}>Click Sync to discover storage buckets.</div>
            </div>
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {alerts.length > 0 ? (
            alerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  ...glassCard,
                  padding: 16,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  opacity: alert.acknowledged ? 0.6 : 1,
                }}
              >
                <div style={{ padding: 8, borderRadius: 10, background: alert.severity === 'critical' ? 'rgba(239,68,68,0.2)' : alert.severity === 'warning' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)' }}>
                  <AlertTriangleIcon
                    size={20}
                    color={alert.severity === 'critical' ? colors.error : alert.severity === 'warning' ? colors.warning : colors.info}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: colors.text, textTransform: 'capitalize' }}>
                        {alert.type.replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>{alert.message}</div>
                    </div>
                    {!alert.acknowledged && (
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(alert.id)}
                        style={{ ...glassButton, padding: '6px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'Rubik, sans-serif' }}
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 6 }}>
                    {new Date(alert.created_at).toLocaleString()}
                    {alert.bucket && ` \u2022 ${alert.bucket}`}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ ...glassCard, padding: 40, textAlign: 'center' }}>
              <CheckCircleIcon size={40} color={colors.success} style={{ margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: colors.text, marginBottom: 6 }}>All Clear</div>
              <div style={{ fontSize: 13, color: colors.textMuted }}>No active alerts</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

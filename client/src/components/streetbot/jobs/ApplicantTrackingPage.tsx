/* eslint-disable i18next/no-literal-string */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  User,
  Mail,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { useGlassStyles } from '../shared/useGlassStyles';
import { GlassBackground } from '../shared/GlassBackground';
import { useResponsive } from '../hooks/useResponsive';
import { profilePhotoAlt, sampleProfilePhotoForName } from '../shared/sampleProfilePhotos';
import { getApplicationsForJob, updateApplicationStatus, getEmployerListing } from './jobsStorage';
import JobBoardTopNav from './JobBoardTopNav';
import type { JobApplication, ApplicationStatus } from './types';

function getUserId(): string {
  let id = localStorage.getItem('sb_user_id');
  if (!id) {
    id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('sb_user_id', id);
  }
  return id;
}

type PipelineStage = {
  key: ApplicationStatus;
  label: string;
  color: string;
  icon: typeof CheckCircle;
};

const PIPELINE_STAGES: PipelineStage[] = [
  { key: 'applied', label: 'Applied', color: '#3B82F6', icon: FileText },
  { key: 'screening', label: 'Screening', color: '#8B5CF6', icon: Search },
  { key: 'under_review', label: 'Under Review', color: '#F59E0B', icon: Eye },
  { key: 'interview', label: 'Interview', color: '#06B6D4', icon: User },
  { key: 'offered', label: 'Offer', color: '#10B981', icon: CheckCircle },
  { key: 'hired', label: 'Hired', color: '#22C55E', icon: CheckCircle },
  { key: 'rejected', label: 'Rejected', color: '#EF4444', icon: XCircle },
];

const SAMPLE_APPLICANTS_BY_JOB: Record<string, JobApplication[]> = {
  emp_seed_1: [
    {
      id: 'fallback-aaliyah-emp-seed-1',
      jobId: 'emp_seed_1',
      userId: 'candidate-aaliyah-morgan',
      status: 'applied',
      appliedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      withdrawn: false,
      applicantName: 'Aaliyah Morgan',
      applicantEmail: 'aaliyah@streetvoices.ca',
      coverNote:
        'I can support outreach, partner lists, volunteer onboarding, and neighborhood event coordination.',
      jobSnapshot: {
        title: 'Community Outreach Coordinator',
        organization: 'Street Voices Community Services',
        opportunity_type: 'Full-time',
        location: 'Toronto, ON',
      },
    },
    {
      id: 'fallback-sofia-emp-seed-1',
      jobId: 'emp_seed_1',
      userId: 'candidate-sofia-alvarez',
      status: 'under_review',
      appliedAt: new Date(Date.now() - 27 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 21 * 60 * 60 * 1000).toISOString(),
      withdrawn: false,
      applicantName: 'Sofia Alvarez',
      applicantEmail: 'sofia@streetvoices.ca',
      coverNote:
        'My documentary and field coordination background fits the community storytelling side of this role.',
      jobSnapshot: {
        title: 'Community Outreach Coordinator',
        organization: 'Street Voices Community Services',
        opportunity_type: 'Full-time',
        location: 'Toronto, ON',
      },
    },
  ],
  emp_seed_2: [
    {
      id: 'fallback-marcus-emp-seed-2',
      jobId: 'emp_seed_2',
      userId: 'candidate-marcus-lee',
      status: 'interview',
      appliedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      withdrawn: false,
      applicantName: 'Marcus Lee',
      applicantEmail: 'marcus@streetvoices.ca',
      coverNote:
        'I have hands-on youth facilitation experience and can help with after-school program delivery.',
      jobSnapshot: {
        title: 'Youth Program Assistant',
        organization: 'Street Voices Community Services',
        opportunity_type: 'Part-time',
        location: 'Toronto, ON',
      },
    },
    {
      id: 'fallback-jasmine-emp-seed-2',
      jobId: 'emp_seed_2',
      userId: 'candidate-jasmine-patel',
      status: 'screening',
      appliedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
      withdrawn: false,
      applicantName: 'Jasmine Patel',
      applicantEmail: 'jasmine@streetvoices.ca',
      coverNote:
        'I can support scheduling, attendance, workshop logistics, and participant communication.',
      jobSnapshot: {
        title: 'Youth Program Assistant',
        organization: 'Street Voices Community Services',
        opportunity_type: 'Part-time',
        location: 'Toronto, ON',
      },
    },
  ],
  emp_seed_3: [
    {
      id: 'fallback-daniel-emp-seed-3',
      jobId: 'emp_seed_3',
      userId: 'candidate-daniel-kim',
      status: 'under_review',
      appliedAt: new Date(Date.now() - 34 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
      withdrawn: false,
      applicantName: 'Daniel Kim',
      applicantEmail: 'daniel@streetvoices.ca',
      coverNote:
        'I have grant writing, budget, and reporting experience for arts and community programs.',
      jobSnapshot: {
        title: 'Grant Writer',
        organization: 'Street Voices Community Services',
        opportunity_type: 'Contract',
        location: 'Remote',
      },
    },
  ],
};

function getNextStages(current: ApplicationStatus): ApplicationStatus[] {
  const order: ApplicationStatus[] = [
    'applied',
    'screening',
    'under_review',
    'interview',
    'offered',
    'hired',
  ];
  const idx = order.indexOf(current);
  if (idx === -1 || idx >= order.length - 1) return [];
  return [order[idx + 1]];
}

export default function ApplicantTrackingPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { colors, glassCard, glassSurface } = useGlassStyles();
  const { width } = useResponsive();
  const userId = useMemo(() => getUserId(), []);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const isCompactPipeline = width < 1080;
  let pipelineColumns = `repeat(${PIPELINE_STAGES.length}, minmax(180px, 1fr))`;
  if (width < 700) {
    pipelineColumns = '1fr';
  } else if (isCompactPipeline) {
    pipelineColumns = 'repeat(2, minmax(0, 1fr))';
  }

  const reload = useCallback(() => {
    if (jobId) {
      const storedApplications = getApplicationsForJob(jobId);
      setApplications(
        storedApplications.length ? storedApplications : SAMPLE_APPLICANTS_BY_JOB[jobId] || [],
      );
      const listing = getEmployerListing(userId, jobId);
      if (listing) {
        setJobTitle(listing.jobSnapshot.title);
      } else if (SAMPLE_APPLICANTS_BY_JOB[jobId]?.[0]) {
        setJobTitle(SAMPLE_APPLICANTS_BY_JOB[jobId][0].jobSnapshot.title);
      }
    }
  }, [jobId, userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const handleMoveStage = (appId: string, newStatus: ApplicationStatus) => {
    if (appId.startsWith('fallback-')) {
      setApplications((current) =>
        current.map((application) =>
          application.id === appId
            ? { ...application, status: newStatus, updatedAt: new Date().toISOString() }
            : application,
        ),
      );
    } else {
      updateApplicationStatus(appId, newStatus);
      reload();
    }
    const label = PIPELINE_STAGES.find((s) => s.key === newStatus)?.label || newStatus;
    showToast(`Moved to ${label}`);
  };

  const filteredApps = useMemo(() => {
    if (!search) return applications;
    const q = search.toLowerCase();
    return applications.filter(
      (a) =>
        (a.applicantName || '').toLowerCase().includes(q) ||
        (a.applicantEmail || '').toLowerCase().includes(q),
    );
  }, [applications, search]);

  const groupedByStage = useMemo(() => {
    const groups: Record<string, JobApplication[]> = {};
    for (const stage of PIPELINE_STAGES) {
      groups[stage.key] = filteredApps.filter((a) => a.status === stage.key);
    }
    return groups;
  }, [filteredApps]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100%' }}>
      <GlassBackground />
      <JobBoardTopNav
        searchValue={search}
        onSearchChange={setSearch}
        placeholder="Search applicants, candidates, or skills..."
      />

      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 1000,
            padding: '14px 24px',
            borderRadius: '14px',
            background: '#10B981',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.9rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          }}
        >
          {toast}
        </div>
      )}

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '24px 24px 60px',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <Link
          to="/jobs/employer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 500,
            color: colors.textMuted,
            textDecoration: 'none',
            marginBottom: '20px',
          }}
        >
          <ArrowLeft size={14} /> Employer Dashboard
        </Link>

        <div style={{ marginBottom: '32px' }}>
          <h1
            style={{
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              fontWeight: 700,
              color: colors.text,
              margin: '0 0 8px',
            }}
          >
            Applicant Tracking
          </h1>
          {jobTitle && (
            <p style={{ color: colors.textSecondary, margin: 0, fontSize: '1rem' }}>{jobTitle}</p>
          )}
          <p style={{ color: colors.textMuted, margin: '4px 0 0', fontSize: '0.85rem' }}>
            {applications.length} applicant{applications.length !== 1 ? 's' : ''} total
          </p>
        </div>

        {/* Search */}
        <div
          style={{
            ...glassSurface,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 20px',
            borderRadius: '14px',
            marginBottom: '24px',
            maxWidth: '400px',
          }}
        >
          <Search size={18} color={colors.textMuted} />
          <input
            type="text"
            placeholder="Search applicants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              fontSize: '0.9rem',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: colors.text,
            }}
          />
        </div>

        {applications.length === 0 ? (
          <div
            style={{
              ...glassSurface,
              borderRadius: '20px',
              padding: '60px 24px',
              textAlign: 'center',
            }}
          >
            <User size={48} color={colors.textMuted} style={{ marginBottom: '16px' }} />
            <h3
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: colors.text,
                margin: '0 0 8px',
              }}
            >
              No Applicants Yet
            </h3>
            <p style={{ color: colors.textSecondary, margin: 0 }}>
              Applicants will appear here once someone applies to this listing.
            </p>
          </div>
        ) : (
          /* Pipeline View */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: pipelineColumns,
              gap: '12px',
              overflowX: isCompactPipeline ? 'visible' : 'auto',
              paddingBottom: '12px',
            }}
          >
            {PIPELINE_STAGES.map((stage) => {
              const stageApps = groupedByStage[stage.key] || [];
              const StageIcon = stage.icon;
              return (
                <div key={stage.key} style={{ minWidth: 0 }}>
                  {/* Column header */}
                  <div
                    style={{
                      ...glassSurface,
                      padding: '12px 16px',
                      borderRadius: '14px 14px 0 0',
                      borderBottom: `2px solid ${stage.color}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <StageIcon size={16} color={stage.color} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: colors.text }}>
                      {stage.label}
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: stage.color,
                        background: `${stage.color}18`,
                        padding: '2px 8px',
                        borderRadius: '8px',
                      }}
                    >
                      {stageApps.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div
                    style={{
                      ...glassSurface,
                      borderRadius: '0 0 14px 14px',
                      padding: '8px',
                      minHeight: '120px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {stageApps.map((app) => {
                      const isExpanded = expandedId === app.id;
                      const nextStages = getNextStages(app.status);
                      return (
                        <div
                          key={app.id}
                          style={{
                            ...glassCard,
                            padding: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            borderLeft: `3px solid ${stage.color}`,
                            minWidth: 0,
                          }}
                          onClick={() => setExpandedId(isExpanded ? null : app.id)}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '4px',
                              minWidth: 0,
                            }}
                          >
                            <img
                              src={sampleProfilePhotoForName(
                                app.applicantName || app.applicantEmail,
                              )}
                              alt={profilePhotoAlt(app.applicantName || app.applicantEmail)}
                              loading="lazy"
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: `1px solid ${stage.color}`,
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: colors.text,
                                minWidth: 0,
                                overflow: isCompactPipeline ? 'hidden' : undefined,
                                textOverflow: isCompactPipeline ? 'ellipsis' : undefined,
                                whiteSpace: isCompactPipeline ? 'nowrap' : undefined,
                              }}
                            >
                              {app.applicantName || 'Anonymous'}
                            </span>
                          </div>
                          {app.applicantEmail && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.7rem',
                                color: colors.textMuted,
                                minWidth: 0,
                              }}
                            >
                              <Mail size={10} style={{ flexShrink: 0 }} />
                              <span
                                style={{
                                  minWidth: 0,
                                  overflow: isCompactPipeline ? 'hidden' : undefined,
                                  textOverflow: isCompactPipeline ? 'ellipsis' : undefined,
                                  whiteSpace: isCompactPipeline ? 'nowrap' : undefined,
                                }}
                              >
                                {app.applicantEmail}
                              </span>
                            </div>
                          )}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.65rem',
                              color: colors.textMuted,
                              marginTop: '4px',
                            }}
                          >
                            <Clock size={10} /> Applied {formatDate(app.appliedAt)}
                          </div>

                          {/* Cover note preview */}
                          {app.coverNote && !isExpanded && (
                            <div
                              style={{
                                fontSize: '0.7rem',
                                color: colors.textMuted,
                                marginTop: '6px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {app.coverNote.slice(0, 80)}
                              {app.coverNote.length > 80 ? '...' : ''}
                            </div>
                          )}

                          {/* Expanded details */}
                          {isExpanded && (
                            <div
                              style={{
                                marginTop: '10px',
                                borderTop: `1px solid ${colors.border}`,
                                paddingTop: '10px',
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {app.coverNote && (
                                <div style={{ marginBottom: '10px' }}>
                                  <div
                                    style={{
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      color: colors.textSecondary,
                                      marginBottom: '4px',
                                    }}
                                  >
                                    Cover Note
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '0.75rem',
                                      color: colors.text,
                                      lineHeight: 1.5,
                                      whiteSpace: 'pre-wrap',
                                    }}
                                  >
                                    {app.coverNote}
                                  </div>
                                </div>
                              )}

                              {app.documents && app.documents.length > 0 && (
                                <div style={{ marginBottom: '10px' }}>
                                  <div
                                    style={{
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      color: colors.textSecondary,
                                      marginBottom: '4px',
                                    }}
                                  >
                                    Documents
                                  </div>
                                  {app.documents.map((doc) => (
                                    <div
                                      key={doc.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '0.7rem',
                                        color: colors.textMuted,
                                        marginBottom: '2px',
                                      }}
                                    >
                                      <FileText size={10} /> {doc.name} ({doc.kind})
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Action buttons */}
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '6px',
                                  flexWrap: 'wrap',
                                  marginTop: '8px',
                                }}
                              >
                                {nextStages.map((next) => {
                                  const nextLabel =
                                    PIPELINE_STAGES.find((s) => s.key === next)?.label || next;
                                  const nextColor =
                                    PIPELINE_STAGES.find((s) => s.key === next)?.color || '#666';
                                  return (
                                    <button
                                      key={next}
                                      onClick={() => handleMoveStage(app.id, next)}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: `${nextColor}18`,
                                        color: nextColor,
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                      }}
                                    >
                                      <ArrowRight size={12} /> {nextLabel}
                                    </button>
                                  );
                                })}
                                {app.status !== 'rejected' && app.status !== 'hired' && (
                                  <button
                                    onClick={() => handleMoveStage(app.id, 'rejected')}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '6px 12px',
                                      borderRadius: '8px',
                                      border: 'none',
                                      background: 'rgba(239,68,68,0.1)',
                                      color: '#EF4444',
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <XCircle size={12} /> Reject
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {stageApps.length === 0 && (
                      <div
                        style={{
                          padding: '20px 8px',
                          textAlign: 'center',
                          fontSize: '0.7rem',
                          color: colors.textMuted,
                        }}
                      >
                        No applicants
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

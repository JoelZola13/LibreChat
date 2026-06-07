/* eslint-disable i18next/no-literal-string */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, User, MapPin, Briefcase, Award } from 'lucide-react';
import { useGlassStyles } from '../shared/useGlassStyles';
import { GlassBackground } from '../shared/GlassBackground';
import { profilePhotoAlt, sampleProfilePhotoForName } from '../shared/sampleProfilePhotos';
import JobBoardTopNav from './JobBoardTopNav';
import type { ResumeVersion, Resume } from './types';

const SAMPLE_CANDIDATES: Resume[] = [
  {
    userId: 'candidate-aaliyah-morgan',
    fullName: 'Aaliyah Morgan',
    email: 'aaliyah@streetvoices.ca',
    location: 'Toronto, ON',
    summary:
      'Community organizer and producer with experience running outreach campaigns, volunteer onboarding, and neighborhood events.',
    experience: [
      {
        id: 'exp-aaliyah-1',
        title: 'Community Outreach Lead',
        company: 'Eastside Arts Collective',
        location: 'Toronto, ON',
        startDate: '2024-02',
        current: true,
        description:
          'Built partner lists, hosted creator meetups, and coordinated weekly community programming.',
      },
    ],
    education: [],
    skills: ['Community Outreach', 'Event Planning', 'Partnerships', 'Volunteer Coordination'],
    interests: ['Public programs', 'Storytelling'],
    certifications: [],
    updatedAt: new Date().toISOString(),
  },
  {
    userId: 'candidate-marcus-lee',
    fullName: 'Marcus Lee',
    email: 'marcus@streetvoices.ca',
    location: 'Toronto, ON',
    summary:
      'Youth worker and workshop facilitator focused on mentorship, media literacy, and safe creative spaces.',
    experience: [
      {
        id: 'exp-marcus-1',
        title: 'Youth Program Facilitator',
        company: 'Parkdale Youth Hub',
        location: 'Toronto, ON',
        startDate: '2023-06',
        current: true,
        description:
          'Facilitated after-school sessions and supported participant intake and progress tracking.',
      },
    ],
    education: [],
    skills: ['Youth Work', 'Facilitation', 'Conflict Resolution', 'Program Support'],
    interests: ['Mentorship', 'Education'],
    certifications: [{ id: 'cert-marcus-1', name: 'Standard First Aid', issuer: 'Red Cross' }],
    updatedAt: new Date().toISOString(),
  },
  {
    userId: 'candidate-sofia-alvarez',
    fullName: 'Sofia Alvarez',
    email: 'sofia@streetvoices.ca',
    location: 'Toronto, ON',
    summary:
      'Documentary producer and field coordinator with strong interview, research, and community storytelling skills.',
    experience: [
      {
        id: 'exp-sofia-1',
        title: 'Field Producer',
        company: 'Neighbourhood Lens',
        location: 'Toronto, ON',
        startDate: '2022-09',
        current: true,
        description:
          'Managed interview schedules, release forms, and field notes for short-form documentaries.',
      },
    ],
    education: [],
    skills: ['Documentary', 'Research', 'Interviewing', 'Production Coordination'],
    interests: ['Community media', 'Archival stories'],
    certifications: [],
    updatedAt: new Date().toISOString(),
  },
  {
    userId: 'candidate-daniel-kim',
    fullName: 'Daniel Kim',
    email: 'daniel@streetvoices.ca',
    location: 'Remote',
    summary:
      'Grant writer and nonprofit strategist who turns program outcomes into funder-ready narratives.',
    experience: [
      {
        id: 'exp-daniel-1',
        title: 'Grant Writer',
        company: 'Civic Futures Lab',
        location: 'Remote',
        startDate: '2021-04',
        current: true,
        description:
          'Prepared proposals, budgets, and reporting packages for arts and community initiatives.',
      },
    ],
    education: [],
    skills: ['Grant Writing', 'Budgets', 'Research', 'Nonprofit Strategy'],
    interests: ['Capacity building'],
    certifications: [],
    updatedAt: new Date().toISOString(),
  },
  {
    userId: 'candidate-jasmine-patel',
    fullName: 'Jasmine Patel',
    email: 'jasmine@streetvoices.ca',
    location: 'Toronto, ON',
    summary:
      'Program assistant with experience supporting workshops, registration, participant follow-up, and creator services.',
    experience: [
      {
        id: 'exp-jasmine-1',
        title: 'Program Assistant',
        company: 'Street Voices',
        location: 'Toronto, ON',
        startDate: '2025-01',
        current: true,
        description:
          'Supported workshop logistics, attendance tracking, and participant communications.',
      },
    ],
    education: [],
    skills: ['Administration', 'Workshop Support', 'Scheduling', 'Participant Care'],
    interests: ['Creator support'],
    certifications: [],
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Search candidates from available resume data plus demo Street Voices applicants.
 * Designed with an abstracted interface for future API migration.
 */
function searchCandidates(query: string, skillFilter: string, locationFilter: string): Resume[] {
  // Gather all resumes from localStorage (resume versions)
  const allResumes: Resume[] = [];
  try {
    const raw = localStorage.getItem('sb_resume_versions');
    if (raw) {
      const versions: ResumeVersion[] = JSON.parse(raw);
      const seen = new Set<string>();
      for (const v of versions) {
        if (!seen.has(v.userId) && v.resume.fullName) {
          seen.add(v.userId);
          allResumes.push(v.resume);
        }
      }
    }
    // Also check legacy single resume
    const legacyRaw = localStorage.getItem('sb_user_resume');
    if (legacyRaw) {
      const legacy: Resume = JSON.parse(legacyRaw);
      if (legacy.fullName && !allResumes.some((r) => r.userId === legacy.userId)) {
        allResumes.push(legacy);
      }
    }
  } catch {
    /* ignore */
  }

  const candidates = [...allResumes];
  for (const candidate of SAMPLE_CANDIDATES) {
    if (!candidates.some((resume) => resume.userId === candidate.userId)) {
      candidates.push(candidate);
    }
  }

  return candidates.filter((r) => {
    const q = query.toLowerCase();
    const matchesQuery =
      !q ||
      [
        r.fullName,
        r.summary,
        r.location,
        ...(r.skills || []),
        ...(r.experience || []).map((e) => `${e.title} ${e.company} ${e.description}`),
      ].some((field) => (field || '').toLowerCase().includes(q));

    const matchesSkill =
      !skillFilter ||
      (r.skills || []).some((s) => s.toLowerCase().includes(skillFilter.toLowerCase()));
    const matchesLocation =
      !locationFilter || (r.location || '').toLowerCase().includes(locationFilter.toLowerCase());

    return matchesQuery && matchesSkill && matchesLocation;
  });
}

export default function CandidateSearchPage() {
  const { isDark, colors, glassCard, glassSurface } = useGlassStyles();
  const [query, setQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [results, setResults] = useState<Resume[]>(() => searchCandidates('', '', ''));
  const [hasSearched, setHasSearched] = useState(true);

  const handleSearch = () => {
    setResults(searchCandidates(query, skillFilter, locationFilter));
    setHasSearched(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '12px',
    border: `1px solid ${colors.border}`,
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    color: colors.text,
    fontSize: '0.9rem',
    outline: 'none',
    minWidth: '120px',
  };

  return (
    <div style={{ position: 'relative', minHeight: '100%' }}>
      <GlassBackground />
      <JobBoardTopNav
        searchValue={query}
        onSearchChange={setQuery}
        onSearchSubmit={handleSearch}
        placeholder="Search candidates, resumes, or skills..."
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '24px 24px 60px',
          maxWidth: '900px',
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
            Candidate Search
          </h1>
          <p style={{ color: colors.textSecondary, margin: 0, fontSize: '0.9rem' }}>
            Search candidates by skills, experience, and keywords
          </p>
        </div>

        {/* Search Panel */}
        <div style={{ ...glassCard, padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <div style={{ flex: 2, minWidth: '200px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: colors.textMuted,
                  marginBottom: '6px',
                }}
              >
                Keywords
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search by name, skills, experience..."
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: colors.textMuted,
                  marginBottom: '6px',
                }}
              >
                Skill
              </label>
              <input
                type="text"
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. React"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: colors.textMuted,
                  marginBottom: '6px',
                }}
              >
                Location
              </label>
              <input
                type="text"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Toronto"
                style={inputStyle}
              />
            </div>
          </div>
          <button
            onClick={handleSearch}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 28px',
              borderRadius: '12px',
              border: 'none',
              background: colors.accent,
              color: '#000',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <Search size={16} /> Search Candidates
          </button>
        </div>

        {/* Results */}
        {hasSearched && results.length === 0 && (
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
              No Candidates Found
            </h3>
            <p style={{ color: colors.textSecondary, margin: 0, fontSize: '0.9rem' }}>
              Try adjusting your search terms. Currently searching local resume data only.
            </p>
          </div>
        )}

        {results.length > 0 && (
          <>
            <div style={{ fontSize: '0.85rem', color: colors.textMuted, marginBottom: '16px' }}>
              {results.length} candidate{results.length !== 1 ? 's' : ''} found
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {results.map((resume, idx) => {
                const profileName = resume.fullName || resume.email || 'Candidate';
                return (
                  <div
                    key={`${resume.userId}-${idx}`}
                    style={{
                      ...glassCard,
                      padding: '20px 24px',
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Avatar */}
                    <img
                      src={sampleProfilePhotoForName(profileName)}
                      alt={profilePhotoAlt(profileName, 'Candidate')}
                      loading="lazy"
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                        background: isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0',
                      }}
                    />

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <h3
                        style={{
                          fontSize: '1rem',
                          fontWeight: 600,
                          color: colors.text,
                          margin: '0 0 4px',
                        }}
                      >
                        {resume.fullName || 'Anonymous Candidate'}
                      </h3>

                      <div
                        style={{
                          display: 'flex',
                          gap: '12px',
                          fontSize: '0.75rem',
                          color: colors.textMuted,
                          flexWrap: 'wrap',
                          marginBottom: '8px',
                        }}
                      >
                        {resume.location && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={12} /> {resume.location}
                          </span>
                        )}
                        {resume.experience && resume.experience.length > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Briefcase size={12} /> {resume.experience.length} role
                            {resume.experience.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {resume.certifications && resume.certifications.length > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Award size={12} /> {resume.certifications.length} cert
                            {resume.certifications.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Summary */}
                      {resume.summary && (
                        <p
                          style={{
                            fontSize: '0.8rem',
                            color: colors.textSecondary,
                            margin: '0 0 10px',
                            lineHeight: 1.5,
                          }}
                        >
                          {resume.summary.length > 200
                            ? `${resume.summary.slice(0, 200)}...`
                            : resume.summary}
                        </p>
                      )}

                      {/* Experience highlights */}
                      {resume.experience && resume.experience.length > 0 && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: colors.textMuted,
                            marginBottom: '8px',
                          }}
                        >
                          <strong>Latest:</strong> {resume.experience[0].title} at{' '}
                          {resume.experience[0].company}
                        </div>
                      )}

                      {/* Skills */}
                      {resume.skills && resume.skills.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {resume.skills.slice(0, 8).map((skill) => (
                            <span
                              key={skill}
                              style={{
                                padding: '3px 10px',
                                borderRadius: '8px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                background: isDark ? 'rgba(255,214,0,0.1)' : 'rgba(255,214,0,0.15)',
                                color: isDark ? '#FFD600' : '#111827',
                                border: '1px solid rgba(255,214,0,0.2)',
                              }}
                            >
                              {skill}
                            </span>
                          ))}
                          {resume.skills.length > 8 && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                color: colors.textMuted,
                                alignSelf: 'center',
                              }}
                            >
                              +{resume.skills.length - 8} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

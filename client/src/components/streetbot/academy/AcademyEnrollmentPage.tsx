import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Upload, Video } from 'lucide-react';
import { useLocation, useParams } from 'react-router-dom';
import { useAuthContext } from '~/hooks/AuthContext';
import { sbFetch } from '../shared/sbFetch';
import { ensureStreetProfileForAcademyUser } from '../profile/academyProfileSync';
import {
  filterVisibleAcademyCourses,
  filterVisibleAcademyPrograms,
  getAcademyLearningPathFromCollection,
  getLearningPathDurationLabel,
  resolveLearningPathCourses,
} from './academyLearningPaths';
import { useAcademyLearningPaths } from './useAcademyLearningPaths';
import { useAcademyUserId } from './useAcademyUserId';
import {
  formatCourseLevel,
  getCourseCohortMeta,
  getCourseDeliveryMode,
  getCourseLearningPoints,
  getCourseRequirements,
} from './academyCourseMeta';
import { createEnrollmentApplication } from './api/enrollment-applications';
import { fileToAcademyAsset } from './academyFileAssets';

type Course = {
  id: string;
  title: string;
  description?: string | null;
  level?: string | null;
  duration?: string | null;
  category?: string | null;
  state?: 'draft' | 'published' | 'archived';
};

type Enrollment = {
  course_id: string;
  status?: string;
};

type EnrollmentFormState = {
  firstName: string;
  lastName: string;
  preferredName: string;
  email: string;
  heardAbout: string;
  priorExperience: string;
  interestAreas: string[];
  pastProject: string;
  futureProject: string;
  programGoals: string;
  challenges: string;
  generalComments: string;
};

const INTEREST_OPTIONS = [
  'Entrepreneurship',
  'Freelancing',
  'Podcasting',
  'Networking',
  'Photography',
  'Videography',
  'None of the above',
];

const MEDIA_TRAINING_DETAILS = {
  heading: 'Media Training Workshops',
  description:
    'To further bridge the gap between marginalized communities and mainstream media, Street Voices has partnered with the Toronto Public Library to offer a free 8-week workshop series. Our facilitators, experts in their fields, will provide unique insights into podcasting, social media management, videography, and networking.',
  location:
    'Workshops will be held in person at the Lillian H. Smith Branch of the Toronto Public Library, 239 College St, Toronto, ON M5T 1R5, in partnership with the library.',
  schedule: 'Sessions will be held on Wednesdays from 6 - 8 pm.',
  cta: 'Sound interesting? Sign up below.',
};

function buildInitialForm(user: unknown): EnrollmentFormState {
  const userRecord = (user ?? {}) as { name?: string | null; email?: string | null };
  const nameParts = String(userRecord.name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' '),
    preferredName: '',
    email: String(userRecord.email || '').trim(),
    heardAbout: '',
    priorExperience: '',
    interestAreas: [],
    pastProject: '',
    futureProject: '',
    programGoals: '',
    challenges: '',
    generalComments: '',
  };
}

export default function AcademyEnrollmentPage() {
  const { slug, courseId } = useParams();
  const location = useLocation();
  const { user } = useAuthContext();
  const basePath = location.pathname.startsWith('/learning') ? '/learning' : '/academy';
  const userId = useAcademyUserId();
  const { paths: learningPaths, loading: learningPathsLoading } = useAcademyLearningPaths();
  const visibleLearningPaths = useMemo(
    () => filterVisibleAcademyPrograms(learningPaths),
    [learningPaths],
  );
  const path = getAcademyLearningPathFromCollection(slug, visibleLearningPaths);
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

  const [course, setCourse] = useState<Course | null>(null);
  const [catalogCourses, setCatalogCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [form, setForm] = useState<EnrollmentFormState>(() => buildInitialForm(user));

  useEffect(() => {
    setForm((current) => {
      if (current.firstName || current.lastName || current.email) {
        return current;
      }
      return buildInitialForm(user);
    });
  }, [user]);

  const colors = useMemo(
    () => ({
      bg: 'var(--sb-color-background)',
      cardBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.42)',
      cardBgStrong: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.58)',
      border: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)',
      text: isDark ? '#fff' : '#111',
      textSecondary: isDark ? 'rgba(255,255,255,0.72)' : '#4b5563',
      textMuted: isDark ? 'rgba(255,255,255,0.5)' : '#6b7280',
      accent: path?.color ?? '#FFD600',
      danger: '#ef4444',
    }),
    [isDark, path],
  );

  const inputStyle: CSSProperties = useMemo(
    () => ({
      width: '100%',
      borderRadius: 16,
      border: `1px solid ${colors.border}`,
      background: colors.cardBgStrong,
      color: colors.text,
      padding: '12px 14px',
      outline: 'none',
    }),
    [colors.border, colors.cardBgStrong, colors.text],
  );

  useEffect(() => {
    async function load() {
      try {
        const requests: Promise<Response>[] = [
          sbFetch('/api/academy/courses?limit=100'),
          sbFetch(`/api/academy/enrollments?user_id=${encodeURIComponent(userId)}`),
        ];

        if (courseId) {
          requests.push(sbFetch(`/api/academy/courses/${courseId}`));
        }

        const responses = await Promise.all(requests);
        const [catalogResp, enrollmentsResp, courseResp] = responses;

        if (catalogResp.ok) {
          const catalogData = await catalogResp.json();
          const courseData = Array.isArray(catalogData) ? catalogData : [];
          setCatalogCourses(
            courseData.filter((item: Course) => !item.state || item.state === 'published'),
          );
        }

        if (enrollmentsResp.ok) {
          const enrollmentData = await enrollmentsResp.json();
          setEnrollments(Array.isArray(enrollmentData) ? enrollmentData : []);
        }

        if (courseResp?.ok) {
          const courseData = await courseResp.json();
          setCourse(courseData);
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [courseId, userId]);

  const visibleCatalogCourses = useMemo(
    () => filterVisibleAcademyCourses(catalogCourses, visibleLearningPaths),
    [catalogCourses, visibleLearningPaths],
  );

  const resolvedCourse = useMemo(() => {
    if (!course) {
      return null;
    }
    return visibleCatalogCourses.find((item) => item.id === course.id) ?? null;
  }, [course, visibleCatalogCourses]);

  const activeEnrollments = useMemo(
    () => enrollments.filter((enrollment) => enrollment.status !== 'dropped'),
    [enrollments],
  );

  const targetCourses = useMemo(() => {
    if (path) {
      return resolveLearningPathCourses(path, visibleCatalogCourses);
    }
    return resolvedCourse ? [resolvedCourse] : [];
  }, [path, resolvedCourse, visibleCatalogCourses]);

  const enrolledCourseIds = useMemo(
    () => new Set(activeEnrollments.map((enrollment) => enrollment.course_id)),
    [activeEnrollments],
  );

  const pendingCourses = useMemo(
    () => targetCourses.filter((item) => !enrolledCourseIds.has(item.id)),
    [enrolledCourseIds, targetCourses],
  );

  const detailTitle = path?.title ?? resolvedCourse?.title ?? 'Academy enrollment';
  const detailDescription =
    path?.description ??
    resolvedCourse?.description ??
    'Complete this form to confirm your enrollment and unlock your next Academy steps.';
  const detailRequirements =
    path?.requirements ?? (resolvedCourse ? getCourseRequirements(resolvedCourse) : []);
  const detailLearningPoints =
    path?.whatYoullLearn ?? (resolvedCourse ? getCourseLearningPoints(resolvedCourse) : []);
  const detailLevel = path?.level ?? formatCourseLevel(resolvedCourse?.level);
  const cohortMeta = getCourseCohortMeta(resolvedCourse?.id);
  const detailDuration = path
    ? getLearningPathDurationLabel(path, visibleCatalogCourses)
    : cohortMeta.durationLabel;
  const detailDelivery =
    path?.deliveryMode ?? getCourseDeliveryMode({ sessionCount: 1, cohortCount: 1 });
  const backHref = path
    ? `${basePath}/paths/${path.slug}`
    : resolvedCourse
      ? `${basePath}/courses/${resolvedCourse.id}`
      : `${basePath}/paths`;
  const detailsCopy =
    path?.slug === 'street-voices-media-training' ||
    detailTitle.toLowerCase().includes('media training')
      ? MEDIA_TRAINING_DETAILS
      : {
          heading: detailTitle,
          description: detailDescription,
          location:
            'Complete the enrollment form below to confirm your place in this Street Voices Academy experience.',
          schedule: 'Your dashboard will unlock as soon as your enrollment is confirmed.',
          cta: 'Share a little about yourself before you start.',
        };

  function updateForm<Key extends keyof EnrollmentFormState>(
    key: Key,
    value: EnrollmentFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleInterestArea(value: string) {
    setForm((current) => {
      const exists = current.interestAreas.includes(value);
      return {
        ...current,
        interestAreas: exists
          ? current.interestAreas.filter((item) => item !== value)
          : [...current.interestAreas, value],
      };
    });
  }

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    setAttachments(Array.from(event.target.files || []));
  }

  const validationError = useMemo(() => {
    if (!form.firstName.trim()) return 'First name is required.';
    if (!form.lastName.trim()) return 'Last name is required.';
    if (!form.email.trim()) return 'Email is required.';
    if (!form.heardAbout.trim()) return 'Please tell us how you heard about this workshop.';
    if (!form.priorExperience.trim()) return 'Please share your prior experience or interest.';
    if (form.interestAreas.length === 0) return 'Please choose at least one interest area.';
    if (!form.futureProject.trim()) return 'Please tell us what project you would start.';
    if (!form.programGoals.trim()) return 'Please tell us what you hope to gain.';
    if (!form.challenges.trim()) return "Please tell us about the challenges you've faced.";
    return null;
  }, [form]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (targetCourses.length === 0) {
      setMessage('This selection is not ready for enrollment yet.');
      return;
    }
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const attachmentAssets = await Promise.all(
        attachments.map((file) => fileToAcademyAsset(file)),
      );

      await createEnrollmentApplication({
        user_id: userId,
        target_type: path ? 'learning_path' : 'course',
        target_id: path?.slug || resolvedCourse?.id || '',
        target_title: detailTitle,
        course_ids: targetCourses.map((item) => item.id),
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        preferred_name: form.preferredName.trim(),
        full_name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        email: form.email.trim(),
        heard_about: form.heardAbout.trim(),
        prior_experience: form.priorExperience.trim(),
        interest_areas: form.interestAreas,
        past_project: form.pastProject.trim(),
        future_project: form.futureProject.trim(),
        program_goals: form.programGoals.trim(),
        challenges: form.challenges.trim(),
        general_comments: form.generalComments.trim(),
        sample_work_attachments: attachmentAssets,
      });

      for (const item of pendingCourses) {
        const enrollmentResponse = await sbFetch('/api/academy/enrollments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            course_id: item.id,
            user_id: userId,
            status: 'active',
            progress_percent: 0,
          }),
        });

        if (!enrollmentResponse.ok) {
          throw new Error(`We couldn't enroll you in ${item.title}. Please try again.`);
        }
      }

      await ensureStreetProfileForAcademyUser({
        userId,
        user,
        roleHint: 'student',
        force: true,
      });

      setMessage('Enrollment confirmed. Opening My Courses...');
      window.setTimeout(() => {
        window.location.href = `${basePath}/my-courses`;
      }, 700);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'We couldn’t complete enrollment just yet. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!loading && !learningPathsLoading && !path && !resolvedCourse) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, padding: '88px 24px 40px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div
            className="rounded-[28px] border p-10 text-center"
            style={{ borderColor: colors.border, background: colors.cardBg }}
          >
            <h1 className="text-3xl font-bold" style={{ color: colors.text }}>
              Enrollment page not found
            </h1>
            <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
              The program or course you selected is not available right now.
            </p>
            <a
              href={`${basePath}/paths`}
              className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
              style={{ background: colors.accent, color: '#000' }}
            >
              Back to Academy
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (learningPathsLoading && slug && !path) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, padding: '88px 24px 40px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div
            className="h-64 rounded-[28px]"
            style={{ background: colors.cardBg, border: `1px solid ${colors.border}` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, padding: '88px 24px 40px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={backHref}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
              style={{
                background: colors.cardBgStrong,
                color: colors.text,
                border: `1px solid ${colors.border}`,
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </a>
            <span className="text-sm font-medium" style={{ color: colors.textMuted }}>
              Enrollment Form
            </span>
          </div>
        </div>

        <section
          className="rounded-[28px] border p-8"
          style={{ borderColor: colors.border, background: colors.cardBg }}
        >
          <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
            <div>
              <div
                className="mb-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: `${colors.accent}20`, color: colors.accent }}
              >
                Confirm enrollment
              </div>
              <h1 className="text-4xl font-bold" style={{ color: colors.text }}>
                {detailsCopy.heading}
              </h1>
              <p className="mt-4 text-base leading-7" style={{ color: colors.textSecondary }}>
                {detailsCopy.description}
              </p>
              <p className="mt-4 text-base leading-7" style={{ color: colors.textSecondary }}>
                {detailsCopy.location}
              </p>
              <p className="mt-4 text-base leading-7" style={{ color: colors.textSecondary }}>
                {detailsCopy.schedule}
              </p>
              <p className="mt-4 text-sm font-semibold" style={{ color: colors.text }}>
                {detailsCopy.cta}
              </p>
              <div
                className="mt-6 flex flex-wrap gap-3 text-sm"
                style={{ color: colors.textSecondary }}
              >
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {detailLevel}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {detailDuration}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  {detailDelivery}
                </span>
              </div>
            </div>

            <div
              className="rounded-[24px] border p-5"
              style={{ borderColor: colors.border, background: colors.cardBgStrong }}
            >
              <p
                className="text-xs uppercase tracking-[0.22em]"
                style={{ color: colors.textMuted }}
              >
                Included after approval
              </p>
              <div className="mt-4 space-y-3 text-sm" style={{ color: colors.textSecondary }}>
                {targetCourses.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border px-4 py-3"
                    style={{ borderColor: colors.border, background: colors.cardBg }}
                  >
                    <p className="font-semibold" style={{ color: colors.text }}>
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                      {item.description ||
                        'This course will appear in your student dashboard after you submit the form.'}
                    </p>
                  </div>
                ))}
              </div>
              {pendingCourses.length === 0 && (
                <a
                  href={`${basePath}/my-courses`}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
                  style={{ background: colors.accent, color: '#000' }}
                >
                  Open My Courses
                  <ArrowRight className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </section>

        {pendingCourses.length > 0 ? (
          <form onSubmit={handleSubmit} className="mt-8 grid gap-6">
            <section
              className="rounded-[28px] border p-6"
              style={{ borderColor: colors.border, background: colors.cardBg }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    className="mb-2 block text-sm font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    First Name *
                  </label>
                  <input
                    value={form.firstName}
                    onChange={(event) => updateForm('firstName', event.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    Last Name *
                  </label>
                  <input
                    value={form.lastName}
                    onChange={(event) => updateForm('lastName', event.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    Preferred Name
                  </label>
                  <input
                    value={form.preferredName}
                    onChange={(event) => updateForm('preferredName', event.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    Email *
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm('email', event.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </section>

            <section
              className="rounded-[28px] border p-6"
              style={{ borderColor: colors.border, background: colors.cardBg }}
            >
              <div className="grid gap-5">
                <div>
                  <label
                    className="mb-2 block text-sm font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    How did you hear about this workshop? *
                  </label>
                  <textarea
                    value={form.heardAbout}
                    onChange={(event) => updateForm('heardAbout', event.target.value)}
                    rows={3}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    What prior experience and or interest do you have towards the fields of
                    media/journalism? *
                  </label>
                  <textarea
                    value={form.priorExperience}
                    onChange={(event) => updateForm('priorExperience', event.target.value)}
                    rows={4}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    className="mb-3 block text-sm font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    Which of the following selection would you be interested in learning more about?
                    * You may choose more than one.
                  </label>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {INTEREST_OPTIONS.map((option) => {
                      const selected = form.interestAreas.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleInterestArea(option)}
                          className="rounded-[18px] border px-4 py-3 text-left text-sm font-medium transition-colors"
                          style={{
                            borderColor: selected ? colors.accent : colors.border,
                            background: selected ? `${colors.accent}18` : colors.cardBgStrong,
                            color: selected ? colors.text : colors.textSecondary,
                          }}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    Have you worked on a creative project in the past? If yes, please tell us about
                    it.
                  </label>
                  <textarea
                    value={form.pastProject}
                    onChange={(event) => updateForm('pastProject', event.target.value)}
                    rows={4}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    If you could start a new project, what would it be? *
                  </label>
                  <textarea
                    value={form.futureProject}
                    onChange={(event) => updateForm('futureProject', event.target.value)}
                    rows={4}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    What do you hope to gain from this program? *
                  </label>
                  <textarea
                    value={form.programGoals}
                    onChange={(event) => updateForm('programGoals', event.target.value)}
                    rows={4}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    What are some challenges you've faced in pursuing a career in media/journalism?
                    *
                  </label>
                  <textarea
                    value={form.challenges}
                    onChange={(event) => updateForm('challenges', event.target.value)}
                    rows={4}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    Sample Work
                  </label>
                  <label
                    className="flex cursor-pointer flex-col gap-2 rounded-[18px] border border-dashed px-4 py-5 text-sm"
                    style={{ borderColor: colors.border, color: colors.textSecondary }}
                  >
                    <span
                      className="inline-flex items-center gap-2 font-medium"
                      style={{ color: colors.text }}
                    >
                      <Upload className="h-4 w-4" />
                      Share any sample work or relevant attachments
                    </span>
                    <span>
                      Portfolio, resume, articles, or other work that helps us assess your
                      application.
                    </span>
                    <input
                      type="file"
                      multiple
                      onChange={handleAttachmentChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {attachments.map((file) => (
                        <span
                          key={`${file.name}-${file.size}`}
                          className="rounded-full px-3 py-1 text-xs font-medium"
                          style={{
                            background: colors.cardBgStrong,
                            color: colors.textSecondary,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          {file.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    Please share your general comments, questions, or concerns if you have any.
                  </label>
                  <textarea
                    value={form.generalComments}
                    onChange={(event) => updateForm('generalComments', event.target.value)}
                    rows={4}
                    style={inputStyle}
                  />
                </div>
              </div>
            </section>

            <section
              className="rounded-[28px] border p-6"
              style={{ borderColor: colors.border, background: colors.cardBg }}
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                    Requirements
                  </h2>
                  <ul className="mt-5 space-y-3">
                    {detailRequirements.map((requirement) => (
                      <li
                        key={requirement}
                        className="flex items-start gap-3 rounded-2xl border p-4"
                        style={{ borderColor: colors.border }}
                      >
                        <CheckCircle2 className="mt-0.5 h-5 w-5" style={{ color: colors.accent }} />
                        <span className="text-sm" style={{ color: colors.textSecondary }}>
                          {requirement}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                    What you&apos;ll learn
                  </h2>
                  <ul className="mt-5 space-y-3">
                    {detailLearningPoints.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 rounded-2xl border p-4"
                        style={{ borderColor: colors.border }}
                      >
                        <CheckCircle2 className="mt-0.5 h-5 w-5" style={{ color: colors.accent }} />
                        <span className="text-sm" style={{ color: colors.textSecondary }}>
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {message && (
                <div
                  className="mt-6 rounded-[18px] border px-4 py-3 text-sm"
                  style={{
                    borderColor:
                      message.toLowerCase().includes('required') ||
                      message.toLowerCase().includes('couldn’t') ||
                      message.toLowerCase().includes('failed')
                        ? 'rgba(239,68,68,0.35)'
                        : colors.border,
                    background:
                      message.toLowerCase().includes('required') ||
                      message.toLowerCase().includes('couldn’t') ||
                      message.toLowerCase().includes('failed')
                        ? 'rgba(239,68,68,0.08)'
                        : colors.cardBgStrong,
                    color:
                      message.toLowerCase().includes('required') ||
                      message.toLowerCase().includes('couldn’t') ||
                      message.toLowerCase().includes('failed')
                        ? colors.danger
                        : colors.textSecondary,
                  }}
                >
                  {message}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60"
                  style={{ background: colors.accent, color: '#000', border: 'none' }}
                >
                  {submitting ? 'Submitting...' : 'Submit and Confirm Enrollment'}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a
                  href={backHref}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
                  style={{
                    background: colors.cardBgStrong,
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Go Back
                </a>
              </div>
            </section>
          </form>
        ) : (
          <section
            className="mt-8 rounded-[28px] border p-6"
            style={{ borderColor: colors.border, background: colors.cardBg }}
          >
            <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
              You&apos;re already enrolled
            </h2>
            <p className="mt-3 text-sm leading-7" style={{ color: colors.textSecondary }}>
              Your dashboard access is already active for this selection.
            </p>
            {message && (
              <div
                className="mt-4 rounded-[18px] border px-4 py-3 text-sm"
                style={{
                  borderColor: colors.border,
                  background: colors.cardBgStrong,
                  color: colors.textSecondary,
                }}
              >
                {message}
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={`${basePath}/dashboard`}
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
                style={{ background: colors.accent, color: '#000' }}
              >
                Open Dashboard
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href={backHref}
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
                style={{
                  background: colors.cardBgStrong,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </a>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

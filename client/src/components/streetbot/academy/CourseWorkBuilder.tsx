import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { HelpCircle, Loader2, Plus, Trash2, Upload } from "lucide-react";
import {
  createCourseAssignment,
  deleteCourseAssignment,
  getCourseAssignments,
  type Assignment,
  type CreateCourseAssignmentInput,
  type FileAttachment,
} from "./api/assignments";
import { fileToAcademyAsset } from "./academyFileAssets";

type CourseWorkBuilderProps = {
  courseId: string;
  instructorId: string;
  colors: Record<string, string>;
  onChanged?: () => void | Promise<void>;
};

type QuizFormState = {
  title: string;
  date: string;
  time: string;
  overview: string;
  questions: string;
  resourceFileName: string;
  resourceAttachment: FileAttachment | null;
};

type AssignmentFormState = {
  title: string;
  date: string;
  time: string;
  overview: string;
  assignmentType: "text" | "file_upload" | "mixed";
  resourceFileName: string;
  resourceAttachment: FileAttachment | null;
};

function combineDateTime(date: string, time: string): string {
  const safeDate = date || new Date().toISOString().slice(0, 10);
  const safeTime = time || "18:00";
  return new Date(`${safeDate}T${safeTime}:00`).toISOString();
}

function buildQuestions(rawQuestions: string): string[] {
  return rawQuestions
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDueLabel(assignment: Assignment) {
  if (!assignment.dueDate) {
    return "No due date";
  }
  return new Date(assignment.dueDate).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildInstructionsCopy(overview: string, resourceFileName: string, fallback: string) {
  const segments = [overview.trim() || fallback];
  if (resourceFileName.trim()) {
    segments.push(`Attached file: ${resourceFileName.trim()}`);
  }
  return `<p>${segments.join("</p><p>")}</p>`;
}

export function CourseWorkBuilder({
  courseId,
  instructorId,
  colors,
  onChanged,
}: CourseWorkBuilderProps) {
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [quizSaving, setQuizSaving] = useState(false);
  const [assignmentSaving, setAssignmentSaving] = useState(false);

  const [quizForm, setQuizForm] = useState<QuizFormState>({
    title: "",
    date: new Date().toISOString().slice(0, 10),
    time: "18:00",
    overview: "",
    questions: "",
    resourceFileName: "",
    resourceAttachment: null,
  });

  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>({
    title: "",
    date: new Date().toISOString().slice(0, 10),
    time: "18:00",
    overview: "",
    assignmentType: "mixed",
    resourceFileName: "",
    resourceAttachment: null,
  });

  const loadItems = useCallback(async function () {
    setLoading(true);
    try {
      const rows = await getCourseAssignments(courseId, true);
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const quizAssignments = useMemo(
    () => items.filter((item) => item.assignmentType === "quiz"),
    [items],
  );

  const courseAssignments = useMemo(
    () => items.filter((item) => item.assignmentType !== "quiz"),
    [items],
  );

  async function refreshAfterChange(message: string) {
    await loadItems();
    if (onChanged) {
      await onChanged();
    }
    setStatusMessage(message);
  }

  async function handleCreate(kind: "quiz" | "assignment") {
    if (kind === "quiz") {
      const questions = buildQuestions(quizForm.questions);
      if (quizForm.title.trim() === "" || questions.length === 0) {
        setStatusMessage("Add a title and at least one quiz question before posting.");
        return;
      }

      setQuizSaving(true);
      try {
        const payload: CreateCourseAssignmentInput = {
          title: quizForm.title.trim(),
          description: quizForm.overview.trim() || "Course quiz",
          instructions: buildInstructionsCopy(
            quizForm.overview,
            quizForm.resourceFileName,
            "Complete each quiz prompt and submit your responses in the student dashboard.",
          ),
          assignmentType: "quiz",
          dueDate: combineDateTime(quizForm.date, quizForm.time),
          availableFrom: new Date().toISOString(),
          maxPoints: Math.max(questions.length * 20, 100),
          passingScore: 70,
          maxAttempts: 1,
          allowLateSubmissions: true,
          latePenaltyPercent: 0,
          maxLateDays: 7,
          isPublished: true,
          quizQuestions: questions,
          resourceFileName: quizForm.resourceFileName.trim() || undefined,
          resourceAttachment: quizForm.resourceAttachment || undefined,
        };
        const created = await createCourseAssignment(courseId, instructorId, payload);
        if (!created) {
          throw new Error("Unable to create this quiz right now.");
        }
        setQuizForm({
          title: "",
          date: new Date().toISOString().slice(0, 10),
          time: "18:00",
          overview: "",
          questions: "",
          resourceFileName: "",
          resourceAttachment: null,
        });
        await refreshAfterChange("Quiz posted to the student dashboard for this course.");
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Unable to create this quiz right now.");
      } finally {
        setQuizSaving(false);
      }
      return;
    }

    if (assignmentForm.title.trim() === "") {
      setStatusMessage("Add a title before posting this assignment.");
      return;
    }

    setAssignmentSaving(true);
    try {
      const payload: CreateCourseAssignmentInput = {
        title: assignmentForm.title.trim(),
        description: assignmentForm.overview.trim() || "Course assignment",
        instructions: buildInstructionsCopy(
          assignmentForm.overview,
          assignmentForm.resourceFileName,
          "Complete this homework in the student dashboard and submit your work before the due date.",
        ),
        assignmentType: assignmentForm.assignmentType,
        dueDate: combineDateTime(assignmentForm.date, assignmentForm.time),
        availableFrom: new Date().toISOString(),
        maxPoints: 100,
        passingScore: 70,
        maxAttempts: 1,
        allowLateSubmissions: true,
        latePenaltyPercent: 5,
        maxLateDays: 7,
        allowedFileTypes:
          assignmentForm.assignmentType === "text"
            ? []
            : ["pdf", "docx", "jpg", "jpeg", "png"],
        maxFileSizeMb: assignmentForm.assignmentType === "text" ? 0 : 15,
        maxFiles: assignmentForm.assignmentType === "mixed" ? 3 : 1,
        isPublished: true,
        resourceFileName: assignmentForm.resourceFileName.trim() || undefined,
        resourceAttachment: assignmentForm.resourceAttachment || undefined,
      };
      const created = await createCourseAssignment(courseId, instructorId, payload);
      if (!created) {
        throw new Error("Unable to create this assignment right now.");
      }
      setAssignmentForm({
        title: "",
        date: new Date().toISOString().slice(0, 10),
        time: "18:00",
        overview: "",
        assignmentType: "mixed",
        resourceFileName: "",
        resourceAttachment: null,
      });
      await refreshAfterChange("Assignment posted to the student dashboard for this course.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to create this assignment right now.");
    } finally {
      setAssignmentSaving(false);
    }
  }

  async function handleDelete(item: Assignment) {
    if (!window.confirm(`Delete "${item.title}" from this course?`)) {
      return;
    }
    try {
      const ok = await deleteCourseAssignment(item.id);
      if (!ok) {
        throw new Error("Unable to delete this item right now.");
      }
      await refreshAfterChange(`${item.assignmentType === "quiz" ? "Quiz" : "Assignment"} removed from this course.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to delete this item right now.");
    }
  }

  async function handleQuizFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setQuizForm((prev) => ({ ...prev, resourceFileName: "", resourceAttachment: null }));
      return;
    }
    try {
      const attachment = await fileToAcademyAsset(file);
      setQuizForm((prev) => ({
        ...prev,
        resourceFileName: file.name,
        resourceAttachment: attachment,
      }));
    } catch {
      setStatusMessage("We couldn’t prepare that quiz file. Please try a different upload.");
    }
  }

  async function handleAssignmentFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setAssignmentForm((prev) => ({ ...prev, resourceFileName: "", resourceAttachment: null }));
      return;
    }
    try {
      const attachment = await fileToAcademyAsset(file);
      setAssignmentForm((prev) => ({
        ...prev,
        resourceFileName: file.name,
        resourceAttachment: attachment,
      }));
    } catch {
      setStatusMessage("We couldn’t prepare that assignment file. Please try a different upload.");
    }
  }

  return (
    <div className="space-y-6">
      {statusMessage && (
        <div
          className="rounded-[18px] border px-4 py-3 text-sm"
          style={{ borderColor: colors.border, background: colors.cardBgStrong || colors.cardBg, color: colors.textSecondary }}
        >
          {statusMessage}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[24px] border p-5" style={{ borderColor: colors.border, background: colors.cardBgStrong || colors.cardBg }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold" style={{ color: colors.text }}>
                Quizzes
              </h3>
              <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                Create short quizzes for enrolled students in this course only.
              </p>
            </div>
            <HelpCircle className="h-5 w-5" style={{ color: colors.accent }} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Title
              </label>
              <input
                value={quizForm.title}
                onChange={(event) => setQuizForm((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-xl border px-3 py-2"
                style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Upload quiz file
              </label>
              <label
                className="flex w-full cursor-pointer items-center gap-2 rounded-xl border px-3 py-2"
                style={{ borderColor: colors.border, background: colors.cardBg, color: colors.textSecondary }}
              >
                <Upload className="h-4 w-4" />
                <span className="truncate">{quizForm.resourceFileName || "Choose a file"}</span>
                <input type="file" className="hidden" onChange={handleQuizFileChange} />
              </label>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Date
              </label>
              <input
                type="date"
                value={quizForm.date}
                onChange={(event) => setQuizForm((prev) => ({ ...prev, date: event.target.value }))}
                className="w-full rounded-xl border px-3 py-2"
                style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Time
              </label>
              <input
                type="time"
                value={quizForm.time}
                onChange={(event) => setQuizForm((prev) => ({ ...prev, time: event.target.value }))}
                className="w-full rounded-xl border px-3 py-2"
                style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
              Overview
            </label>
            <textarea
              value={quizForm.overview}
              onChange={(event) => setQuizForm((prev) => ({ ...prev, overview: event.target.value }))}
              rows={3}
              className="w-full rounded-xl border px-3 py-2"
              style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
              placeholder="Share what this quiz is checking and what students should know before they begin."
            />
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
              Quiz questions
            </label>
            <textarea
              value={quizForm.questions}
              onChange={(event) => setQuizForm((prev) => ({ ...prev, questions: event.target.value }))}
              rows={6}
              className="w-full rounded-xl border px-3 py-2"
              style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
              placeholder={"Add one question per line.\nWhat is one key right you learned today?\nHow would you use this idea in real life?"}
            />
          </div>

          <button
            type="button"
            onClick={() => void handleCreate("quiz")}
            disabled={quizSaving}
            className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ background: colors.accent, color: "#000" }}
          >
            {quizSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Post Quiz
          </button>
        </div>

        <div className="rounded-[24px] border p-5" style={{ borderColor: colors.border, background: colors.cardBgStrong || colors.cardBg }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold" style={{ color: colors.text }}>
                Assignments
              </h3>
              <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                Create homework and upload brief assignment files for this course.
              </p>
            </div>
            <Upload className="h-5 w-5" style={{ color: colors.accent }} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Title
              </label>
              <input
                value={assignmentForm.title}
                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-xl border px-3 py-2"
                style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Response type
              </label>
              <select
                value={assignmentForm.assignmentType}
                onChange={(event) =>
                  setAssignmentForm((prev) => ({
                    ...prev,
                    assignmentType: event.target.value as AssignmentFormState["assignmentType"],
                  }))
                }
                className="w-full rounded-xl border px-3 py-2"
                style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
              >
                <option value="mixed">File + written response</option>
                <option value="file_upload">File upload</option>
                <option value="text">Written response</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Date
              </label>
              <input
                type="date"
                value={assignmentForm.date}
                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, date: event.target.value }))}
                className="w-full rounded-xl border px-3 py-2"
                style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Time
              </label>
              <input
                type="time"
                value={assignmentForm.time}
                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, time: event.target.value }))}
                className="w-full rounded-xl border px-3 py-2"
                style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
              Overview
            </label>
            <textarea
              value={assignmentForm.overview}
              onChange={(event) => setAssignmentForm((prev) => ({ ...prev, overview: event.target.value }))}
              rows={4}
              className="w-full rounded-xl border px-3 py-2"
              style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
              placeholder="Explain what students need to complete and how they should approach it."
            />
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
              Upload assignment file
            </label>
            <label
              className="flex w-full cursor-pointer items-center gap-2 rounded-xl border px-3 py-2"
              style={{ borderColor: colors.border, background: colors.cardBg, color: colors.textSecondary }}
            >
              <Upload className="h-4 w-4" />
              <span className="truncate">{assignmentForm.resourceFileName || "Choose a file"}</span>
              <input type="file" className="hidden" onChange={handleAssignmentFileChange} />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void handleCreate("assignment")}
            disabled={assignmentSaving}
            className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ background: colors.accent, color: "#000" }}
          >
            {assignmentSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Post Assignment
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[24px] border p-5" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold" style={{ color: colors.text }}>
              Published Quizzes
            </h3>
            <span className="text-sm" style={{ color: colors.textMuted }}>
              {quizAssignments.length}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-[18px] border px-4 py-3 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                Loading quizzes...
              </div>
            ) : quizAssignments.length === 0 ? (
              <div className="rounded-[18px] border px-4 py-3 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                No quizzes have been posted for this course yet.
              </div>
            ) : (
              quizAssignments.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[18px] border p-4"
                  style={{ borderColor: colors.border, background: colors.cardBgStrong || colors.cardBg }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: colors.text }}>
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                        {item.quizQuestions?.length || 0} questions · Due {formatDueLabel(item)}
                      </p>
                      {item.resourceFileName && (
                        <p className="mt-2 text-xs" style={{ color: colors.textSecondary }}>
                          File: {item.resourceFileName}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item)}
                      className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold"
                      style={{ background: colors.cardBg, color: colors.text, border: `1px solid ${colors.border}` }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[24px] border p-5" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold" style={{ color: colors.text }}>
              Published Assignments
            </h3>
            <span className="text-sm" style={{ color: colors.textMuted }}>
              {courseAssignments.length}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-[18px] border px-4 py-3 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                Loading assignments...
              </div>
            ) : courseAssignments.length === 0 ? (
              <div className="rounded-[18px] border px-4 py-3 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                No assignments have been posted for this course yet.
              </div>
            ) : (
              courseAssignments.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[18px] border p-4"
                  style={{ borderColor: colors.border, background: colors.cardBgStrong || colors.cardBg }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: colors.text }}>
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                        {item.assignmentType.replace("_", " ")} · Due {formatDueLabel(item)}
                      </p>
                      {item.resourceFileName && (
                        <p className="mt-2 text-xs" style={{ color: colors.textSecondary }}>
                          File: {item.resourceFileName}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item)}
                      className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold"
                      style={{ background: colors.cardBg, color: colors.text, border: `1px solid ${colors.border}` }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

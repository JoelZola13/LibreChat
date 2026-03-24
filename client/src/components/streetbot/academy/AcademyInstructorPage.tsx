import { useCallback, useMemo, useState } from "react";
import { ClipboardCheck, Loader2, Sparkles, BookOpen } from "lucide-react";
import { GradingDashboard } from "./GradingDashboard";
import { SubmissionGradingInterface } from "./SubmissionGradingInterface";
import {
  getSubmissionForGrading,
  type GradingQueueItem,
  type Submission,
} from "./api/assignments";
import { getOrCreateUserId } from "../shared/userId";
import { sbFetch } from "../shared/sbFetch";

export default function AcademyInstructorPage() {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const instructorId = useMemo(() => getOrCreateUserId(), []);

  const [activeTab, setActiveTab] = useState<"grading" | "generate">("grading");
  const [selectedQueueItem, setSelectedQueueItem] = useState<GradingQueueItem | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [loadingSubmission, setLoadingSubmission] = useState(false);

  // AI Generation state
  const [genTopic, setGenTopic] = useState("");
  const [genLevel, setGenLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [genCategory, setGenCategory] = useState("");
  const [genDuration, setGenDuration] = useState("");
  const [genInstructor, setGenInstructor] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);

  const handleSelectSubmission = useCallback(async (item: GradingQueueItem) => {
    setLoadingSubmission(true);
    try {
      const submission = await getSubmissionForGrading(item.submissionId);
      if (submission) {
        setSelectedQueueItem(item);
        setSelectedSubmission(submission);
      }
    } catch (error) {
      console.error("Failed to load submission for grading:", error);
    } finally {
      setLoadingSubmission(false);
    }
  }, []);

  const handleBackToQueue = useCallback(() => {
    setSelectedQueueItem(null);
    setSelectedSubmission(null);
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genTopic.trim()) return;
    setGenerating(true);
    setGenResult(null);
    try {
      const resp = await sbFetch("/api/academy/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: genTopic,
          description: `AI-generated course: ${genTopic}`,
          level: genLevel,
          category: genCategory || undefined,
          duration: genDuration || undefined,
          instructor_name: genInstructor || "AI Instructor",
          tags: ["ai-generated"],
        }),
      });
      if (!resp.ok) throw new Error(`Failed to create course: ${resp.status}`);
      const course = await resp.json();
      setGenResult(`Course created successfully! ID: ${course.id}. Visit /academy/courses to view it.`);
      setGenTopic("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setGenResult(`Error: ${msg}`);
    } finally {
      setGenerating(false);
    }
  };

  const baseText = isDark ? "#fff" : "#111";
  const secondaryText = isDark ? "rgba(255,255,255,0.72)" : "#4b5563";
  const mutedText = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const accent = "#F97316";
  const border = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)";
  const cardBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.5)";
  const inputStyle: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
    border: `1px solid ${border}`,
    borderRadius: 10,
    padding: "10px 14px",
    color: baseText,
    fontSize: 14,
    width: "100%",
    outline: "none",
  };

  const tabStyle = (active: boolean) => ({
    padding: "8px 20px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600 as const,
    cursor: "pointer" as const,
    border: "none",
    background: active ? accent : "transparent",
    color: active ? "#fff" : secondaryText,
    transition: "all 0.2s",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--sb-color-background)",
        padding: "88px 24px 40px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <a href="/academy" className="text-sm font-medium hover:opacity-80" style={{ color: secondaryText }}>
            Academy
          </a>
          <span style={{ color: mutedText }}>/</span>
          <span className="text-sm font-medium" style={{ color: accent }}>Instructor</span>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <ClipboardCheck className="h-7 w-7" style={{ color: accent }} />
          <div>
            <h1 className="text-3xl font-bold" style={{ color: baseText }}>Instructor Workspace</h1>
            <p className="mt-2" style={{ color: secondaryText }}>
              Review submissions, grade work, and generate AI-powered courses.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex items-center gap-2" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", borderRadius: 14, padding: 4, display: "inline-flex" }}>
          <button style={tabStyle(activeTab === "grading")} onClick={() => setActiveTab("grading")}>
            <ClipboardCheck className="mr-2 inline h-4 w-4" />Grading
          </button>
          <button style={tabStyle(activeTab === "generate")} onClick={() => setActiveTab("generate")}>
            <Sparkles className="mr-2 inline h-4 w-4" />AI Course Generator
          </button>
        </div>

        {/* Grading tab */}
        {activeTab === "grading" && (
          <>
            {loadingSubmission && (
              <div className="mb-6 inline-flex items-center gap-2 rounded-lg px-3 py-2" style={{ color: secondaryText }}>
                <Loader2 className="h-4 w-4 animate-spin" />Loading submission...
              </div>
            )}
            {selectedQueueItem && selectedSubmission ? (
              <SubmissionGradingInterface
                queueItem={selectedQueueItem}
                submission={selectedSubmission}
                graderId={instructorId}
                onBack={handleBackToQueue}
                onGradeSubmitted={handleBackToQueue}
              />
            ) : (
              <GradingDashboard instructorId={instructorId} onSelectSubmission={handleSelectSubmission} />
            )}
          </>
        )}

        {/* AI Generation tab */}
        {activeTab === "generate" && (
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <div style={{ borderRadius: 20, border: `1px solid ${border}`, background: cardBg, backdropFilter: "blur(20px)", padding: 28 }}>
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl p-2.5" style={{ background: "rgba(249,115,22,0.15)" }}>
                  <Sparkles className="h-6 w-6" style={{ color: accent }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: baseText }}>AI Course Generator</h2>
                  <p className="text-sm" style={{ color: secondaryText }}>
                    Describe a topic and AI will generate a complete course with modules, lessons, and quizzes.
                  </p>
                </div>
              </div>

              {genResult && (
                <div className="mb-4 rounded-lg p-3 text-sm" style={{
                  background: genResult.startsWith("Error") ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
                  color: genResult.startsWith("Error") ? "#ef4444" : "#22c55e",
                  border: `1px solid ${genResult.startsWith("Error") ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
                }}>
                  {genResult}
                </div>
              )}

              <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: secondaryText }}>Topic / Title *</label>
                  <input
                    required
                    value={genTopic}
                    onChange={(e) => setGenTopic(e.target.value)}
                    style={inputStyle}
                    placeholder="e.g. Introduction to Machine Learning"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium" style={{ color: secondaryText }}>Level</label>
                    <select value={genLevel} onChange={(e) => setGenLevel(e.target.value as typeof genLevel)} style={inputStyle}>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium" style={{ color: secondaryText }}>Category</label>
                    <input value={genCategory} onChange={(e) => setGenCategory(e.target.value)} style={inputStyle} placeholder="e.g. Technology" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium" style={{ color: secondaryText }}>Duration</label>
                    <input value={genDuration} onChange={(e) => setGenDuration(e.target.value)} style={inputStyle} placeholder="e.g. 6 weeks" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium" style={{ color: secondaryText }}>Instructor Name</label>
                    <input value={genInstructor} onChange={(e) => setGenInstructor(e.target.value)} style={inputStyle} placeholder="AI Instructor" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={generating || !genTopic.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold transition-opacity disabled:opacity-50"
                  style={{ background: accent, color: "#fff", border: "none", cursor: generating ? "wait" : "pointer" }}
                >
                  {generating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating Course...</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Generate Course</>
                  )}
                </button>
              </form>

              <div className="mt-6 rounded-lg p-3" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${border}` }}>
                <p className="text-xs" style={{ color: mutedText }}>
                  <strong>Tip:</strong> For richer content with interactive simulations and AI-generated quizzes,
                  ask the assistant in chat: <em>"Create a course about [topic]"</em> — it will use the
                  OpenMAIC AI classroom engine to generate slides, quizzes, and interactive content.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ClassroomViewer — renders OpenMAIC scene types within academy lessons.
 *
 * Scene types: slide, quiz, interactive, pbl
 * Scenes are stored as JSON in lesson content_text.
 */
import { useState, useMemo } from "react";
import {
  Play,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Beaker,
  HelpCircle,
  Lightbulb,
} from "lucide-react";

type SceneElement = {
  type: string;
  content?: string;
  text?: string;
  src?: string;
  options?: string[];
  answer?: string;
  correctAnswer?: string;
  points?: number;
  html?: string;
  url?: string;
};

type Scene = {
  type: "slide" | "quiz" | "interactive" | "pbl";
  title?: string;
  narration?: string;
  elements?: SceneElement[];
  questions?: QuizQuestion[];
  html?: string;
  content?: string;
};

type QuizQuestion = {
  id?: string;
  question?: string;
  text?: string;
  type?: "multiple_choice" | "true_false" | "short_answer";
  options?: string[];
  answer?: string;
  correctAnswer?: string;
  points?: number;
};

interface ClassroomViewerProps {
  scenes: Scene[];
  onQuizSubmit?: (answers: Record<string, string>) => void;
}

export function ClassroomViewer({ scenes, onQuizSubmit }: ClassroomViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  const colors = useMemo(
    () => ({
      bg: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
      cardBg: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.5)",
      border: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
      text: isDark ? "#fff" : "#111",
      textSecondary: isDark ? "rgba(255,255,255,0.7)" : "#4b5563",
      textMuted: isDark ? "rgba(255,255,255,0.5)" : "#6b7280",
      accent: "#FFD600",
    }),
    [isDark],
  );

  if (!scenes || scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16" style={{ color: colors.textMuted }}>
        <BookOpen className="mb-4 h-12 w-12 opacity-40" />
        <p>No lesson content available yet.</p>
      </div>
    );
  }

  const scene = scenes[currentIndex];
  const total = scenes.length;

  return (
    <div style={{ background: colors.bg, borderRadius: 16, border: `1px solid ${colors.border}`, overflow: "hidden" }}>
      {/* Navigation bar */}
      {total > 1 && (
        <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="rounded-lg p-2 transition-opacity hover:opacity-80 disabled:opacity-30"
            style={{ color: colors.text }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium" style={{ color: colors.textSecondary }}>
            {currentIndex + 1} / {total}
            {scene.title && ` — ${scene.title}`}
          </span>
          <button
            onClick={() => setCurrentIndex(Math.min(total - 1, currentIndex + 1))}
            disabled={currentIndex === total - 1}
            className="rounded-lg p-2 transition-opacity hover:opacity-80 disabled:opacity-30"
            style={{ color: colors.text }}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Scene content */}
      <div className="p-6">
        {scene.type === "slide" && <SlideScene scene={scene} colors={colors} />}
        {scene.type === "quiz" && <QuizScene scene={scene} colors={colors} onSubmit={onQuizSubmit} />}
        {scene.type === "interactive" && <InteractiveScene scene={scene} colors={colors} />}
        {scene.type === "pbl" && <PBLScene scene={scene} colors={colors} />}
        {!["slide", "quiz", "interactive", "pbl"].includes(scene.type) && (
          <SlideScene scene={scene} colors={colors} />
        )}
      </div>
    </div>
  );
}

// ---- Slide Scene ----

function SlideScene({ scene, colors }: { scene: Scene; colors: Record<string, string> }) {
  return (
    <div>
      {scene.title && (
        <h2 className="mb-4 text-2xl font-bold" style={{ color: colors.text }}>{scene.title}</h2>
      )}
      {scene.narration && (
        <p className="mb-4 text-sm italic" style={{ color: colors.textSecondary }}>{scene.narration}</p>
      )}
      {scene.content && (
        <div
          className="prose max-w-none"
          style={{ color: colors.text }}
          dangerouslySetInnerHTML={{ __html: scene.content }}
        />
      )}
      {scene.elements?.map((el, i) => (
        <div key={i} className="mb-4">
          {el.type === "text" && <p style={{ color: colors.text }}>{el.content || el.text}</p>}
          {el.type === "image" && el.src && (
            <img src={el.src} alt="" className="max-w-full rounded-lg" style={{ maxHeight: 400 }} />
          )}
          {el.type === "code" && (
            <pre className="overflow-x-auto rounded-lg p-4" style={{ background: "rgba(0,0,0,0.3)", color: "#e2e8f0", fontSize: 13 }}>
              <code>{el.content || el.text}</code>
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- Quiz Scene ----

function QuizScene({
  scene,
  colors,
  onSubmit,
}: {
  scene: Scene;
  colors: Record<string, string>;
  onSubmit?: (answers: Record<string, string>) => void;
}) {
  const questions = scene.questions || [];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleAnswer = (qIndex: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [String(qIndex)]: value }));
  };

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit?.(answers);
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <HelpCircle className="h-5 w-5" style={{ color: colors.accent }} />
        <h2 className="text-xl font-bold" style={{ color: colors.text }}>{scene.title || "Quiz"}</h2>
      </div>

      {questions.map((q, i) => {
        const qText = q.question || q.text || `Question ${i + 1}`;
        const correct = q.answer || q.correctAnswer || "";
        const userAnswer = answers[String(i)] || "";
        const isCorrect = submitted && userAnswer.toLowerCase() === correct.toLowerCase();
        const isWrong = submitted && userAnswer && !isCorrect;

        return (
          <div
            key={i}
            className="mb-4 rounded-xl p-4"
            style={{
              background: submitted
                ? isCorrect
                  ? "rgba(34,197,94,0.1)"
                  : isWrong
                    ? "rgba(239,68,68,0.1)"
                    : colors.cardBg
                : colors.cardBg,
              border: `1px solid ${colors.border}`,
            }}
          >
            <p className="mb-3 font-medium" style={{ color: colors.text }}>
              {i + 1}. {qText}
              {q.points && <span className="ml-2 text-xs" style={{ color: colors.textMuted }}>({q.points} pts)</span>}
            </p>

            {q.options ? (
              <div className="space-y-2">
                {q.options.map((opt, j) => (
                  <label
                    key={j}
                    className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors"
                    style={{
                      background: answers[String(i)] === opt ? "rgba(255,214,0,0.15)" : "transparent",
                      color: colors.text,
                    }}
                  >
                    <input
                      type="radio"
                      name={`q-${i}`}
                      value={opt}
                      checked={answers[String(i)] === opt}
                      onChange={() => handleAnswer(i, opt)}
                      disabled={submitted}
                      className="accent-yellow-400"
                    />
                    <span className="text-sm">{opt}</span>
                    {submitted && opt.toLowerCase() === correct.toLowerCase() && (
                      <CheckCircle className="ml-auto h-4 w-4 text-green-400" />
                    )}
                    {submitted && answers[String(i)] === opt && opt.toLowerCase() !== correct.toLowerCase() && (
                      <XCircle className="ml-auto h-4 w-4 text-red-400" />
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={answers[String(i)] || ""}
                onChange={(e) => handleAnswer(i, e.target.value)}
                disabled={submitted}
                placeholder="Type your answer..."
                className="w-full rounded-lg p-2 text-sm"
                style={{
                  background: isDark() ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
              />
            )}

            {submitted && isWrong && (
              <p className="mt-2 text-xs text-red-400">Correct answer: {correct}</p>
            )}
          </div>
        );
      })}

      {!submitted && questions.length > 0 && (
        <button
          onClick={handleSubmit}
          className="mt-4 rounded-lg px-6 py-3 text-sm font-bold"
          style={{ background: colors.accent, color: "#000", border: "none", cursor: "pointer" }}
        >
          Submit Answers
        </button>
      )}

      {submitted && (
        <div className="mt-4 rounded-lg p-3" style={{ background: "rgba(255,214,0,0.1)", border: `1px solid rgba(255,214,0,0.3)` }}>
          <p className="text-sm font-medium" style={{ color: colors.accent }}>
            Quiz submitted! {Object.keys(answers).length}/{questions.length} answered.
          </p>
        </div>
      )}
    </div>
  );
}

function isDark(): boolean {
  return document.documentElement.getAttribute("data-theme") !== "light";
}

// ---- Interactive Scene (iframe) ----

function InteractiveScene({ scene, colors }: { scene: Scene; colors: Record<string, string> }) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Beaker className="h-5 w-5" style={{ color: colors.accent }} />
        <h2 className="text-xl font-bold" style={{ color: colors.text }}>{scene.title || "Interactive Simulation"}</h2>
      </div>
      {scene.html ? (
        <div
          className="overflow-hidden rounded-xl"
          style={{ border: `1px solid ${colors.border}`, minHeight: 400 }}
        >
          <iframe
            srcDoc={scene.html}
            className="h-full w-full"
            style={{ minHeight: 400, border: "none" }}
            sandbox="allow-scripts allow-same-origin"
            title={scene.title || "Interactive simulation"}
          />
        </div>
      ) : (
        <p style={{ color: colors.textMuted }}>Interactive content not available.</p>
      )}
    </div>
  );
}

// ---- PBL Scene (Project-Based Learning) ----

function PBLScene({ scene, colors }: { scene: Scene; colors: Record<string, string> }) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Lightbulb className="h-5 w-5" style={{ color: colors.accent }} />
        <h2 className="text-xl font-bold" style={{ color: colors.text }}>{scene.title || "Project Activity"}</h2>
      </div>
      {scene.content && (
        <div
          className="prose max-w-none"
          style={{ color: colors.text }}
          dangerouslySetInnerHTML={{ __html: scene.content }}
        />
      )}
      {scene.narration && (
        <div className="mt-4 rounded-xl p-4" style={{ background: colors.cardBg, border: `1px solid ${colors.border}` }}>
          <p className="text-sm" style={{ color: colors.textSecondary }}>{scene.narration}</p>
        </div>
      )}
    </div>
  );
}

export default ClassroomViewer;

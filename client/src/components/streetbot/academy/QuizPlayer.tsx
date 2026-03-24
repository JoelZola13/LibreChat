import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  CheckCircle,
  XCircle,
  ArrowRight,
  RefreshCw,
  Trophy,
  Clock,
  AlertCircle,
} from "lucide-react";
import { sbFetch } from "../shared/sbFetch";

type QuizQuestion = {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: "multiple_choice" | "true_false" | "short_answer";
  options: string[];
  correct_answer: string;
  points: number;
  order_index: number;
};

type Quiz = {
  id: string;
  lesson_id: string;
  title: string;
  description?: string | null;
  passing_score: number;
  max_attempts?: number | null;
  questions: QuizQuestion[];
};

type QuizResult = {
  quiz_id: string;
  score: number;
  passed: boolean;
  total_questions: number;
  correct_answers: number;
  feedback: {
    question_id: string;
    question_text: string;
    user_answer: string;
    correct_answer: string;
    is_correct: boolean;
    points_earned: number;
    points_possible: number;
  }[];
};

type QuizPlayerProps = {
  lessonId: string;
  userId: string;
  onComplete?: (passed: boolean) => void;
};

export function QuizPlayer({ lessonId, userId, onComplete }: QuizPlayerProps) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load quiz data — try SBP internal quiz endpoint first, then Moodle quiz by lesson
  useEffect(() => {
    async function loadQuiz() {
      try {
        const resp = await sbFetch(`/api/academy/quizzes/lesson/${lessonId}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data) {
            setQuiz(data);

            // If the quiz loaded and has a Moodle ID, start a quiz attempt
            const quizId = data.id || data.quiz_id;
            if (quizId) {
              try {
                const startResp = await sbFetch(
                  `/api/academy/moodle/quizzes/${quizId}/start`,
                  { method: "POST" }
                );
                if (startResp.ok) {
                  const startData = await startResp.json();
                  // Moodle returns attempt data with an attempt id
                  const aId = startData?.attempt?.id || startData?.attemptid || startData?.id;
                  if (aId) {
                    setAttemptId(String(aId));

                    // Get the quiz attempt data (questions) from Moodle
                    const dataResp = await sbFetch(
                      `/api/academy/moodle/quizzes/attempts/${aId}/data`
                    );
                    if (dataResp.ok) {
                      const attemptData = await dataResp.json();
                      // If Moodle returns questions, merge them into the quiz
                      const moodleQuestions = attemptData?.questions;
                      if (Array.isArray(moodleQuestions) && moodleQuestions.length > 0) {
                        const mappedQuestions: QuizQuestion[] = moodleQuestions.map(
                          (q: Record<string, unknown>, idx: number) => ({
                            id: String(q.slot || q.number || idx),
                            quiz_id: quizId,
                            question_text:
                              (q.html as string) ||
                              (q.questiontext as string) ||
                              (q.text as string) ||
                              `Question ${idx + 1}`,
                            question_type: "multiple_choice" as const,
                            options: extractOptions(q),
                            correct_answer: "",
                            points: (q.maxmark as number) || 1,
                            order_index: idx,
                          })
                        );
                        setQuiz((prev) =>
                          prev
                            ? { ...prev, questions: mappedQuestions }
                            : prev
                        );
                      }
                    }
                  }
                }
              } catch (startErr) {
                // Non-critical — quiz might not need Moodle attempt (SBP-only quiz)
                console.warn("Could not start Moodle quiz attempt:", startErr);
              }
            }
          }
        }
      } catch (e) {
        console.error("Failed to load quiz:", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadQuiz();
  }, [lessonId]);

  // Extract answer options from Moodle question HTML or structured data
  function extractOptions(q: Record<string, unknown>): string[] {
    // Moodle may return options in various formats
    if (Array.isArray(q.options)) return q.options as string[];
    if (Array.isArray(q.answers)) {
      return (q.answers as Record<string, unknown>[]).map(
        (a) => (a.text as string) || (a.answer as string) || String(a)
      );
    }
    // Try to extract from HTML
    const html = (q.html as string) || "";
    const optionMatches = html.match(/<label[^>]*>([^<]+)<\/label>/gi);
    if (optionMatches) {
      return optionMatches.map((m) => m.replace(/<[^>]+>/g, "").trim()).filter(Boolean);
    }
    return [];
  }

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));

    // Save individual answer to Moodle if we have an active attempt
    if (attemptId) {
      sbFetch(`/api/academy/moodle/quizzes/attempts/${attemptId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [{ name: `q${questionId}:1_answer`, value: answer }],
        }),
      }).catch((err) => console.warn("Failed to save answer to Moodle:", err));
    }
  };

  const handleSubmit = async () => {
    if (!quiz) return;

    setIsSubmitting(true);
    setError(null);
    try {
      // If we have a Moodle attempt, finish it via Moodle endpoint
      if (attemptId) {
        const finishResp = await sbFetch(
          `/api/academy/moodle/quizzes/attempts/${attemptId}/finish`,
          { method: "POST" }
        );

        if (finishResp.ok) {
          const finishData = await finishResp.json();
          // Build result from Moodle response
          const moodleResult = finishData?.result || finishData;
          const score = moodleResult?.sumgrades != null
            ? (moodleResult.sumgrades / (moodleResult.maxgrade || 1)) * 100
            : 0;
          const passed = score >= (quiz.passing_score || 50);

          const quizResult: QuizResult = {
            quiz_id: quiz.id,
            score,
            passed,
            total_questions: quiz.questions.length,
            correct_answers: Math.round(
              (score / 100) * quiz.questions.length
            ),
            feedback: quiz.questions.map((q) => ({
              question_id: q.id,
              question_text: q.question_text,
              user_answer: answers[q.id] || "(No answer)",
              correct_answer: q.correct_answer || "",
              is_correct: false, // Moodle doesn't expose per-question correctness in finish
              points_earned: 0,
              points_possible: q.points,
            })),
          };

          setResult(quizResult);
          setShowFeedback(true);
          onComplete?.(passed);
          return;
        }
      }

      // Fallback: submit via SBP internal quiz endpoint
      const resp = await sbFetch(`/api/academy/quizzes/${quiz.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          answers,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setResult(data);
        setShowFeedback(true);
        onComplete?.(data.passed);
      } else {
        const errData = await resp.json().catch(() => ({}));
        setError(errData.detail || "Failed to submit quiz");
      }
    } catch (e) {
      console.error("Failed to submit quiz:", e);
      setError("Failed to submit quiz. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setResult(null);
    setShowFeedback(false);
    setCurrentQuestionIndex(0);
    setAttemptId(null);
    setError(null);

    // Start a new Moodle attempt if we have a quiz
    if (quiz) {
      sbFetch(`/api/academy/moodle/quizzes/${quiz.id}/start`, {
        method: "POST",
      })
        .then(async (resp) => {
          if (resp.ok) {
            const data = await resp.json();
            const aId = data?.attempt?.id || data?.attemptid || data?.id;
            if (aId) setAttemptId(String(aId));
          }
        })
        .catch((err) => console.warn("Failed to start new quiz attempt:", err));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-3 border-yellow-400 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="text-center py-12 bg-gray-900/30 rounded-xl">
        <Target className="w-12 h-12 text-gray-700 mx-auto mb-3" />
        <p className="text-gray-500">No quiz available for this lesson</p>
      </div>
    );
  }

  // Show results
  if (showFeedback && result) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6"
      >
        {/* Result Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
              result.passed
                ? "bg-green-500/20 text-green-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {result.passed ? (
              <Trophy className="w-10 h-10" />
            ) : (
              <AlertCircle className="w-10 h-10" />
            )}
          </motion.div>

          <h2 className="text-2xl font-bold mb-2">
            {result.passed ? "Congratulations!" : "Keep Learning"}
          </h2>
          <p className="text-gray-400">
            {result.passed
              ? "You passed the quiz!"
              : `You need ${quiz.passing_score}% to pass. Try again!`}
          </p>
        </div>

        {/* Score */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-black/30 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-yellow-400">
              {Math.round(result.score)}%
            </div>
            <div className="text-xs text-gray-500">Your Score</div>
          </div>
          <div className="bg-black/30 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-white">
              {result.correct_answers}/{result.total_questions}
            </div>
            <div className="text-xs text-gray-500">Correct Answers</div>
          </div>
          <div className="bg-black/30 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-cyan-400">{quiz.passing_score}%</div>
            <div className="text-xs text-gray-500">Passing Score</div>
          </div>
        </div>

        {/* Question Feedback */}
        <div className="space-y-4 mb-8">
          <h3 className="font-bold text-lg">Question Review</h3>
          {result.feedback.map((fb, index) => (
            <div
              key={fb.question_id}
              className={`p-4 rounded-xl border ${
                fb.is_correct
                  ? "bg-green-500/5 border-green-500/20"
                  : "bg-red-500/5 border-red-500/20"
              }`}
            >
              <div className="flex items-start gap-3">
                {fb.is_correct ? (
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium mb-2">
                    {index + 1}. {fb.question_text}
                  </p>
                  <div className="text-sm space-y-1">
                    <p className="text-gray-400">
                      Your answer:{" "}
                      <span
                        className={fb.is_correct ? "text-green-400" : "text-red-400"}
                      >
                        {fb.user_answer || "(No answer)"}
                      </span>
                    </p>
                    {!fb.is_correct && (
                      <p className="text-gray-400">
                        Correct answer:{" "}
                        <span className="text-green-400">{fb.correct_answer}</span>
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-500">
                  {fb.points_earned}/{fb.points_possible} pts
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          {!result.passed && (
            <button
              onClick={handleRetry}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-yellow-400 text-black rounded-xl font-bold hover:bg-yellow-300 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </button>
          )}
          <button
            onClick={() => setShowFeedback(false)}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
              result.passed
                ? "flex-1 bg-green-500 text-white hover:bg-green-400"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {result.passed ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Continue
              </>
            ) : (
              "View Quiz"
            )}
          </button>
        </div>
      </motion.div>
    );
  }

  // Quiz questions
  const currentQuestion = quiz.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;
  const allAnswered = quiz.questions.every((q) => answers[q.id]);

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Quiz Header */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-400/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="font-bold text-lg">{quiz.title}</h2>
              {quiz.description && (
                <p className="text-sm text-gray-500">{quiz.description}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Passing Score</div>
            <div className="font-bold text-yellow-400">{quiz.passing_score}%</div>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-gray-800 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%`,
              }}
              className="bg-yellow-400 h-2 rounded-full"
            />
          </div>
          <span className="text-sm text-gray-500">
            {currentQuestionIndex + 1} of {quiz.questions.length}
          </span>
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="p-6"
        >
          <h3 className="text-xl font-bold mb-6">
            {currentQuestionIndex + 1}. {currentQuestion.question_text}
          </h3>

          {/* Answer Options */}
          <div className="space-y-3">
            {currentQuestion.question_type === "multiple_choice" &&
              currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswer(currentQuestion.id, option)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    answers[currentQuestion.id] === option
                      ? "bg-yellow-400/10 border-yellow-400/50 text-yellow-400"
                      : "bg-gray-800/30 border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      answers[currentQuestion.id] === option
                        ? "bg-yellow-400 text-black"
                        : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    {String.fromCharCode(65 + index)}
                  </div>
                  <span className="flex-1 text-left">{option}</span>
                  {answers[currentQuestion.id] === option && (
                    <CheckCircle className="w-5 h-5" />
                  )}
                </button>
              ))}

            {currentQuestion.question_type === "true_false" && (
              <div className="grid grid-cols-2 gap-4">
                {["True", "False"].map((option) => (
                  <button
                    key={option}
                    onClick={() => handleAnswer(currentQuestion.id, option)}
                    className={`flex items-center justify-center gap-3 p-6 rounded-xl border transition-all ${
                      answers[currentQuestion.id] === option
                        ? "bg-yellow-400/10 border-yellow-400/50 text-yellow-400"
                        : "bg-gray-800/30 border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    {option === "True" ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <XCircle className="w-6 h-6" />
                    )}
                    <span className="font-bold text-lg">{option}</span>
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.question_type === "short_answer" && (
              <input
                type="text"
                value={answers[currentQuestion.id] || ""}
                onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                placeholder="Type your answer..."
                className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400/50"
              />
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mb-2 p-3 rounded-lg flex items-center gap-2 bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Navigation */}
      <div className="p-6 border-t border-gray-800 flex items-center justify-between">
        <button
          onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
          disabled={currentQuestionIndex === 0}
          className="px-4 py-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>

        {/* Question dots */}
        <div className="flex items-center gap-2">
          {quiz.questions.map((q, index) => (
            <button
              key={q.id}
              onClick={() => setCurrentQuestionIndex(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentQuestionIndex
                  ? "bg-yellow-400 scale-125"
                  : answers[q.id]
                  ? "bg-green-500"
                  : "bg-gray-700"
              }`}
            />
          ))}
        </div>

        {isLastQuestion ? (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || isSubmitting}
            className="flex items-center gap-2 px-6 py-2 bg-yellow-400 text-black rounded-xl font-bold hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-black border-t-transparent rounded-full"
              />
            ) : (
              <>
                Submit Quiz
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() =>
              setCurrentQuestionIndex((prev) =>
                Math.min(quiz.questions.length - 1, prev + 1)
              )
            }
            className="flex items-center gap-2 px-4 py-2 text-yellow-400 hover:text-yellow-300 transition-colors"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

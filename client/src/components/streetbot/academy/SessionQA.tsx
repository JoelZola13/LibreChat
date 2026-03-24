import { useState, useEffect } from "react";
import {
  SessionQuestion,
  askQuestion,
  getSessionQuestions,
  upvoteQuestion,
  answerQuestion,
} from "./api/live-sessions";

interface SessionQAProps {
  sessionId: string;
  userId: string;
  isInstructor?: boolean;
  isLive?: boolean;
}

export function SessionQA({
  sessionId,
  userId,
  isInstructor = false,
  isLive = false,
}: SessionQAProps) {
  const [questions, setQuestions] = useState<SessionQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "answered">("all");
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");

  useEffect(() => {
    loadQuestions();
    // Poll for new questions if session is live
    if (isLive) {
      const interval = setInterval(loadQuestions, 5000);
      return () => clearInterval(interval);
    }
  }, [sessionId, isLive]);

  const loadQuestions = async () => {
    try {
      const status = filter === "all" ? undefined : filter;
      const data = await getSessionQuestions(sessionId, status);
      setQuestions(data);
    } catch (error) {
      console.error("Failed to load questions:", error);
    }
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;

    setIsSubmitting(true);
    try {
      const question = await askQuestion(sessionId, userId, newQuestion, isAnonymous);
      setQuestions((prev) => [question, ...prev]);
      setNewQuestion("");
      setIsAnonymous(false);
    } catch (error) {
      console.error("Failed to submit question:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpvote = async (questionId: string) => {
    try {
      await upvoteQuestion(questionId, userId);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, upvotes: q.upvotes + 1 } : q
        )
      );
    } catch (error) {
      console.error("Failed to upvote:", error);
    }
  };

  const handleSubmitAnswer = async (questionId: string) => {
    if (!answerText.trim()) return;

    try {
      const updated = await answerQuestion(questionId, answerText, userId);
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? updated : q))
      );
      setAnsweringId(null);
      setAnswerText("");
    } catch (error) {
      console.error("Failed to submit answer:", error);
    }
  };

  const filteredQuestions = questions.filter((q) => {
    if (filter === "pending") return q.status === "pending";
    if (filter === "answered") return q.status === "answered";
    return true;
  });

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Q&A
            {isLive && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Live</span>}
          </h3>
          <span className="text-sm text-gray-400">{questions.length} questions</span>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(["all", "pending", "answered"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filter === f
                  ? "bg-purple-500/20 text-purple-400"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Ask Question Form */}
      {isLive && (
        <form onSubmit={handleSubmitQuestion} className="p-4 border-b border-white/10">
          <div className="flex gap-2">
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Type your question..."
              className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newQuestion.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {isSubmitting ? "..." : "Ask"}
            </button>
          </div>
          <label className="flex items-center gap-2 mt-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="rounded border-gray-600 bg-white/5 text-purple-500 focus:ring-purple-500"
            />
            Ask anonymously
          </label>
        </form>
      )}

      {/* Questions List */}
      <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
        {filteredQuestions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>No questions yet</p>
            {isLive && <p className="text-sm mt-1">Be the first to ask!</p>}
          </div>
        ) : (
          filteredQuestions.map((question) => (
            <div key={question.id} className="p-4">
              <div className="flex gap-3">
                {/* Upvote Button */}
                <button
                  onClick={() => handleUpvote(question.id)}
                  className="flex flex-col items-center gap-1 text-gray-400 hover:text-purple-400 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  <span className="text-xs font-medium">{question.upvotes}</span>
                </button>

                <div className="flex-1">
                  {/* Question */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-white">{question.question}</p>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        question.status === "answered"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                      {question.status}
                    </span>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{question.is_anonymous ? "Anonymous" : `User ${question.user_id.slice(0, 8)}...`}</span>
                    <span>{new Date(question.created_at).toLocaleTimeString()}</span>
                  </div>

                  {/* Answer */}
                  {question.answer && (
                    <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-green-400 mb-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Answered by instructor</span>
                      </div>
                      <p className="text-gray-300 text-sm">{question.answer}</p>
                    </div>
                  )}

                  {/* Answer Form (Instructor Only) */}
                  {isInstructor && question.status === "pending" && (
                    <>
                      {answeringId === question.id ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            placeholder="Type your answer..."
                            rows={3}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSubmitAnswer(question.id)}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                            >
                              Submit Answer
                            </button>
                            <button
                              onClick={() => {
                                setAnsweringId(null);
                                setAnswerText("");
                              }}
                              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAnsweringId(question.id)}
                          className="mt-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          Answer this question
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default SessionQA;

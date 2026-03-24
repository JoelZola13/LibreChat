/**
 * Quiz Analytics Dashboard Component.
 * Displays quiz performance metrics and question-level analytics.
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Target,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { sbFetch } from '../shared/sbFetch';

interface QuizAnalytics {
  quiz_id: string;
  quiz_title: string;
  total_attempts: number;
  unique_takers: number;
  pass_rate: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  average_time_minutes: number;
  question_difficulty: QuestionStats[];
}

interface QuestionStats {
  question_id: string;
  question_text: string;
  correct_rate: number;
  avg_time_seconds: number;
  skip_rate: number;
}

interface QuizAnalyticsDashboardProps {
  courseId: string;
  quizId?: string;
  className?: string;
}

export function QuizAnalyticsDashboard({
  courseId,
  quizId,
  className = '',
}: QuizAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<QuizAnalytics | null>(null);
  const [quizList, setQuizList] = useState<{ id: string; title: string }[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState(quizId || '');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  // Load quiz list for course
  useEffect(() => {
    const loadQuizzes = async () => {
      try {
        const res = await sbFetch(`/api/academy/moodle/quizzes/course/${courseId}`);
        if (res.ok) {
          const data = await res.json();
          setQuizList(data);
          if (data.length > 0 && !selectedQuizId) {
            setSelectedQuizId(data[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load quizzes:', error);
      }
    };
    loadQuizzes();
  }, [courseId, selectedQuizId]);

  // Load analytics for selected quiz
  useEffect(() => {
    const loadAnalytics = async () => {
      if (!selectedQuizId) return;
      setIsLoading(true);
      try {
        const res = await sbFetch(`/api/academy/moodle/analytics/quiz/${selectedQuizId}`);
        if (res.ok) {
          setAnalytics(await res.json());
        }
      } catch (error) {
        console.error('Failed to load quiz analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadAnalytics();
  }, [selectedQuizId]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getDifficultyLabel = (correctRate: number) => {
    if (correctRate >= 80) return { label: 'Easy', color: 'bg-green-500/20 text-green-400' };
    if (correctRate >= 50) return { label: 'Medium', color: 'bg-yellow-500/20 text-yellow-400' };
    return { label: 'Hard', color: 'bg-red-500/20 text-red-400' };
  };

  if (isLoading && !analytics) {
    return (
      <div className={`p-8 text-center ${className}`}>
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-gray-400">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Quiz Selector */}
      {quizList.length > 1 && (
        <div className="flex items-center gap-4">
          <label className="text-gray-400 text-sm">Select Quiz:</label>
          <select
            value={selectedQuizId}
            onChange={(e) => setSelectedQuizId(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
          >
            {quizList.map((quiz) => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {analytics && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Users className="w-4 h-4" />
                Total Attempts
              </div>
              <div className="text-2xl font-bold text-white">{analytics.total_attempts}</div>
              <div className="text-xs text-gray-500">{analytics.unique_takers} unique students</div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Target className="w-4 h-4" />
                Pass Rate
              </div>
              <div className={`text-2xl font-bold ${getScoreColor(analytics.pass_rate)}`}>
                {analytics.pass_rate.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">
                {analytics.pass_rate >= 70 ? (
                  <span className="flex items-center gap-1 text-green-400">
                    <TrendingUp className="w-3 h-3" /> Good
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-400">
                    <AlertTriangle className="w-3 h-3" /> Needs attention
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <BarChart3 className="w-4 h-4" />
                Average Score
              </div>
              <div className={`text-2xl font-bold ${getScoreColor(analytics.average_score)}`}>
                {analytics.average_score.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">
                Range: {analytics.lowest_score}% - {analytics.highest_score}%
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Clock className="w-4 h-4" />
                Avg Time
              </div>
              <div className="text-2xl font-bold text-white">
                {analytics.average_time_minutes.toFixed(1)}m
              </div>
              <div className="text-xs text-gray-500">per attempt</div>
            </div>
          </div>

          {/* Score Distribution */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Score Distribution</h3>
            <div className="flex items-end gap-2 h-32">
              {[
                { range: '0-20%', color: 'bg-red-500' },
                { range: '21-40%', color: 'bg-orange-500' },
                { range: '41-60%', color: 'bg-yellow-500' },
                { range: '61-80%', color: 'bg-lime-500' },
                { range: '81-100%', color: 'bg-green-500' },
              ].map((bucket, i) => {
                // Mock distribution - in real impl, this would come from analytics
                const height = [15, 20, 25, 30, 35][i];
                return (
                  <div key={bucket.range} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full ${bucket.color} rounded-t`}
                      style={{ height: `${height * 3}px` }}
                    />
                    <span className="text-xs text-gray-500">{bucket.range}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Question Analysis */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Question Analysis</h3>
            <div className="space-y-3">
              {analytics.question_difficulty.length > 0 ? (
                analytics.question_difficulty.map((q, index) => {
                  const difficulty = getDifficultyLabel(q.correct_rate);
                  const isExpanded = expandedQuestion === q.question_id;
                  return (
                    <div
                      key={q.question_id}
                      className="bg-white/5 rounded-lg border border-white/10 overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedQuestion(isExpanded ? null : q.question_id)}
                        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 text-sm">Q{index + 1}</span>
                          <span className="text-white truncate max-w-md">
                            {q.question_text}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded text-xs ${difficulty.color}`}>
                            {difficulty.label}
                          </span>
                          <span className={`font-medium ${getScoreColor(q.correct_rate)}`}>
                            {q.correct_rate.toFixed(0)}%
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-white/10">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-400">Correct Rate</span>
                              <div className="flex items-center gap-2 mt-1">
                                <CheckCircle className="w-4 h-4 text-green-400" />
                                <span className="text-white">{q.correct_rate.toFixed(1)}%</span>
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-400">Avg Time</span>
                              <div className="flex items-center gap-2 mt-1">
                                <Clock className="w-4 h-4 text-blue-400" />
                                <span className="text-white">{q.avg_time_seconds}s</span>
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-400">Skip Rate</span>
                              <div className="flex items-center gap-2 mt-1">
                                <XCircle className="w-4 h-4 text-red-400" />
                                <span className="text-white">{q.skip_rate.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-400 text-center py-4">
                  No question-level data available yet
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default QuizAnalyticsDashboard;

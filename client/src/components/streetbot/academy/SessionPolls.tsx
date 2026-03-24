import { useState, useEffect } from "react";
import {
  SessionPoll,
  PollResults,
  createPoll,
  startPoll,
  endPoll,
  submitPollResponse,
  getPollResults,
  CreatePollData,
} from "./api/live-sessions";

interface SessionPollsProps {
  sessionId: string;
  userId: string;
  isInstructor?: boolean;
  isLive?: boolean;
}

interface ActivePollProps {
  poll: SessionPoll;
  userId: string;
  onSubmit: (pollId: string, response: unknown) => Promise<void>;
  results?: PollResults | null;
  hasVoted: boolean;
}

function ActivePoll({ poll, userId, onSubmit, results, hasVoted }: ActivePollProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [textResponse, setTextResponse] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let response: unknown;
      if (poll.poll_type === "single" || poll.poll_type === "rating") {
        response = selectedOption;
      } else if (poll.poll_type === "multiple") {
        response = selectedOptions;
      } else {
        response = textResponse;
      }
      await onSubmit(poll.id, response);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMultipleOption = (optionText: string) => {
    setSelectedOptions((prev) =>
      prev.includes(optionText)
        ? prev.filter((o) => o !== optionText)
        : [...prev, optionText]
    );
  };

  // Show results if voted or poll is closed
  if (hasVoted || poll.status === "closed") {
    const totalResponses = results?.total_responses || 0;

    return (
      <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
        <h4 className="font-medium text-white mb-1">{poll.question}</h4>
        <p className="text-xs text-gray-400 mb-4">{totalResponses} responses</p>

        {poll.options.map((option, index) => {
          const count = results?.results[option.text] || 0;
          const percentage = totalResponses > 0 ? (count / totalResponses) * 100 : 0;

          return (
            <div key={index} className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">{option.text}</span>
                <span className="text-gray-400">{Math.round(percentage)}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}

        {hasVoted && (
          <p className="text-xs text-green-400 mt-3 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            You voted
          </p>
        )}
      </div>
    );
  }

  // Show voting UI
  return (
    <div className="p-4 bg-white/5 border border-purple-500/30 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full animate-pulse">
          Live Poll
        </span>
      </div>
      <h4 className="font-medium text-white mb-4">{poll.question}</h4>

      {/* Single Choice */}
      {poll.poll_type === "single" && (
        <div className="space-y-2 mb-4">
          {poll.options.map((option, index) => (
            <button
              key={index}
              onClick={() => setSelectedOption(option.text)}
              className={`w-full p-3 text-left rounded-lg border transition-colors ${
                selectedOption === option.text
                  ? "border-purple-500 bg-purple-500/20 text-white"
                  : "border-white/10 bg-white/5 text-gray-300 hover:border-white/20"
              }`}
            >
              {option.text}
            </button>
          ))}
        </div>
      )}

      {/* Multiple Choice */}
      {poll.poll_type === "multiple" && (
        <div className="space-y-2 mb-4">
          {poll.options.map((option, index) => (
            <button
              key={index}
              onClick={() => toggleMultipleOption(option.text)}
              className={`w-full p-3 text-left rounded-lg border transition-colors flex items-center gap-3 ${
                selectedOptions.includes(option.text)
                  ? "border-purple-500 bg-purple-500/20 text-white"
                  : "border-white/10 bg-white/5 text-gray-300 hover:border-white/20"
              }`}
            >
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  selectedOptions.includes(option.text)
                    ? "border-purple-500 bg-purple-500"
                    : "border-gray-500"
                }`}
              >
                {selectedOptions.includes(option.text) && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              {option.text}
            </button>
          ))}
        </div>
      )}

      {/* Rating */}
      {poll.poll_type === "rating" && (
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              onClick={() => setSelectedOption(String(rating))}
              className={`w-12 h-12 rounded-lg border transition-colors ${
                selectedOption === String(rating)
                  ? "border-purple-500 bg-purple-500/20"
                  : "border-white/10 bg-white/5 hover:border-white/20"
              }`}
            >
              <span className="text-2xl">{rating}</span>
            </button>
          ))}
        </div>
      )}

      {/* Open Text */}
      {poll.poll_type === "open" && (
        <textarea
          value={textResponse}
          onChange={(e) => setTextResponse(e.target.value)}
          placeholder="Type your response..."
          rows={3}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 mb-4"
        />
      )}

      <button
        onClick={handleSubmit}
        disabled={
          isSubmitting ||
          (poll.poll_type === "single" && !selectedOption) ||
          (poll.poll_type === "multiple" && selectedOptions.length === 0) ||
          (poll.poll_type === "open" && !textResponse.trim())
        }
        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
      >
        {isSubmitting ? "Submitting..." : "Submit Vote"}
      </button>
    </div>
  );
}

export function SessionPolls({
  sessionId,
  userId,
  isInstructor = false,
  isLive = false,
}: SessionPollsProps) {
  const [polls, setPolls] = useState<SessionPoll[]>([]);
  const [pollResults, setPollResults] = useState<Record<string, PollResults>>({});
  const [votedPolls, setVotedPolls] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPoll, setNewPoll] = useState<CreatePollData>({
    question: "",
    poll_type: "single",
    options: [{ text: "" }, { text: "" }],
    is_anonymous: true,
    show_results_live: true,
  });

  // In a real app, you'd fetch polls from the API
  // For now, we'll manage them locally

  const handleCreatePoll = async () => {
    try {
      const poll = await createPoll(sessionId, {
        ...newPoll,
        options: newPoll.options?.filter((o) => o.text.trim()) || [],
      });
      setPolls((prev) => [poll, ...prev]);
      setShowCreateForm(false);
      setNewPoll({
        question: "",
        poll_type: "single",
        options: [{ text: "" }, { text: "" }],
        is_anonymous: true,
        show_results_live: true,
      });
    } catch (error) {
      console.error("Failed to create poll:", error);
    }
  };

  const handleStartPoll = async (pollId: string) => {
    try {
      const updated = await startPoll(pollId);
      setPolls((prev) => prev.map((p) => (p.id === pollId ? updated : p)));
    } catch (error) {
      console.error("Failed to start poll:", error);
    }
  };

  const handleEndPoll = async (pollId: string) => {
    try {
      const updated = await endPoll(pollId);
      setPolls((prev) => prev.map((p) => (p.id === pollId ? updated : p)));
      // Fetch final results
      const results = await getPollResults(pollId);
      setPollResults((prev) => ({ ...prev, [pollId]: results }));
    } catch (error) {
      console.error("Failed to end poll:", error);
    }
  };

  const handleVote = async (pollId: string, response: unknown) => {
    try {
      await submitPollResponse(pollId, userId, response);
      setVotedPolls((prev) => new Set(prev).add(pollId));
      // Fetch results if show_results_live
      const poll = polls.find((p) => p.id === pollId);
      if (poll?.show_results_live) {
        const results = await getPollResults(pollId);
        setPollResults((prev) => ({ ...prev, [pollId]: results }));
      }
    } catch (error) {
      console.error("Failed to submit vote:", error);
    }
  };

  const addOption = () => {
    setNewPoll((prev) => ({
      ...prev,
      options: [...(prev.options || []), { text: "" }],
    }));
  };

  const removeOption = (index: number) => {
    setNewPoll((prev) => ({
      ...prev,
      options: prev.options?.filter((_, i) => i !== index),
    }));
  };

  const updateOption = (index: number, text: string) => {
    setNewPoll((prev) => ({
      ...prev,
      options: prev.options?.map((o, i) => (i === index ? { ...o, text } : o)),
    }));
  };

  const activePoll = polls.find((p) => p.status === "active");

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Polls
          </h3>
          {isInstructor && isLive && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              {showCreateForm ? "Cancel" : "Create Poll"}
            </button>
          )}
        </div>
      </div>

      {/* Create Poll Form */}
      {showCreateForm && isInstructor && (
        <div className="p-4 border-b border-white/10 bg-white/5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Question</label>
              <input
                type="text"
                value={newPoll.question}
                onChange={(e) => setNewPoll((prev) => ({ ...prev, question: e.target.value }))}
                placeholder="Enter your poll question..."
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Poll Type</label>
              <select
                value={newPoll.poll_type}
                onChange={(e) => setNewPoll((prev) => ({ ...prev, poll_type: e.target.value as CreatePollData["poll_type"] }))}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="single">Single Choice</option>
                <option value="multiple">Multiple Choice</option>
                <option value="rating">Rating (1-5)</option>
                <option value="open">Open Text</option>
              </select>
            </div>

            {(newPoll.poll_type === "single" || newPoll.poll_type === "multiple") && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Options</label>
                <div className="space-y-2">
                  {newPoll.options?.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={option.text}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                      />
                      {(newPoll.options?.length || 0) > 2 && (
                        <button
                          onClick={() => removeOption(index)}
                          className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addOption}
                    className="w-full px-4 py-2 border border-dashed border-white/20 text-gray-400 rounded-lg hover:border-white/40 hover:text-white transition-colors"
                  >
                    + Add Option
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newPoll.is_anonymous}
                  onChange={(e) => setNewPoll((prev) => ({ ...prev, is_anonymous: e.target.checked }))}
                  className="rounded border-gray-600 bg-white/5 text-purple-500 focus:ring-purple-500"
                />
                Anonymous voting
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newPoll.show_results_live}
                  onChange={(e) => setNewPoll((prev) => ({ ...prev, show_results_live: e.target.checked }))}
                  className="rounded border-gray-600 bg-white/5 text-purple-500 focus:ring-purple-500"
                />
                Show results live
              </label>
            </div>

            <button
              onClick={handleCreatePoll}
              disabled={!newPoll.question.trim()}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              Create Poll
            </button>
          </div>
        </div>
      )}

      {/* Active Poll */}
      {activePoll && (
        <div className="p-4">
          <ActivePoll
            poll={activePoll}
            userId={userId}
            onSubmit={handleVote}
            results={pollResults[activePoll.id]}
            hasVoted={votedPolls.has(activePoll.id)}
          />
          {isInstructor && (
            <button
              onClick={() => handleEndPoll(activePoll.id)}
              className="w-full mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              End Poll
            </button>
          )}
        </div>
      )}

      {/* Draft Polls (Instructor Only) */}
      {isInstructor && polls.filter((p) => p.status === "draft").length > 0 && (
        <div className="p-4 border-t border-white/10">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Draft Polls</h4>
          <div className="space-y-2">
            {polls
              .filter((p) => p.status === "draft")
              .map((poll) => (
                <div
                  key={poll.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                >
                  <span className="text-white text-sm">{poll.question}</span>
                  <button
                    onClick={() => handleStartPoll(poll.id)}
                    className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    Start
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Closed Polls */}
      {polls.filter((p) => p.status === "closed").length > 0 && (
        <div className="p-4 border-t border-white/10">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Previous Polls</h4>
          <div className="space-y-3">
            {polls
              .filter((p) => p.status === "closed")
              .map((poll) => (
                <div key={poll.id} className="p-3 bg-white/5 rounded-lg">
                  <p className="text-white text-sm mb-2">{poll.question}</p>
                  {pollResults[poll.id] && (
                    <p className="text-xs text-gray-400">
                      {pollResults[poll.id].total_responses} responses
                    </p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {polls.length === 0 && !showCreateForm && (
        <div className="p-8 text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>No polls yet</p>
          {isInstructor && isLive && (
            <p className="text-sm mt-1">Create a poll to engage your audience!</p>
          )}
        </div>
      )}
    </div>
  );
}

export default SessionPolls;

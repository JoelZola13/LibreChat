import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare, Send, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import {
  createForumDiscussion,
  deleteForumDiscussion,
  getCourseForums,
  getForumDiscussions,
  reactToForumDiscussion,
  replyToForumDiscussion,
  type MoodleDiscussion,
  type MoodleDiscussionReactionType,
  type MoodleDiscussionReply,
  type MoodleForum,
} from "./api/moodle";

type CourseDiscussionsPanelProps = {
  courseId: string;
  colors: Record<string, string>;
  mode?: "student" | "instructor";
  authorName?: string;
  authorId?: string;
};

function formatTimestamp(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeReplies(discussion: MoodleDiscussion): MoodleDiscussionReply[] {
  return [...(discussion.replies || [])].sort((left, right) => left.created - right.created);
}

export function CourseDiscussionsPanel({
  courseId,
  colors,
  mode = "student",
  authorName,
  authorId,
}: CourseDiscussionsPanelProps) {
  const isInstructor = mode === "instructor";
  const actorName = authorName || (isInstructor ? "Course Instructor" : "Academy learner");
  const actorId = authorId || (isInstructor ? "course-instructor" : "academy-learner");

  const [forum, setForum] = useState<MoodleForum | null>(null);
  const [discussions, setDiscussions] = useState<MoodleDiscussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [messageTitle, setMessageTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});

  const cardSurface = colors.cardBgStrong || colors.cardBg;

  const loadDiscussions = useCallback(async function () {
    setLoading(true);
    setStatusMessage(null);
    try {
      const forums = await getCourseForums(courseId);
      const primaryForum = forums[0] ?? null;
      setForum(primaryForum);

      if (primaryForum == null) {
        setDiscussions([]);
        return;
      }

      const rows = await getForumDiscussions(primaryForum.id);
      setDiscussions(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error("Failed to load course discussions:", error);
      setDiscussions([]);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadDiscussions();
  }, [loadDiscussions]);

  const sortedDiscussions = useMemo(
    () => [...discussions].sort((left, right) => right.created - left.created),
    [discussions],
  );

  const handlePost = useCallback(async function () {
    if (!forum || messageTitle.trim() === "" || messageBody.trim() === "") {
      return;
    }

    setPosting(true);
    setStatusMessage(null);
    try {
      await createForumDiscussion(forum.id, messageTitle.trim(), messageBody.trim(), {
        authorName: actorName,
        authorId: actorId,
        authorRole: "instructor",
      });
      setMessageTitle("");
      setMessageBody("");
      await loadDiscussions();
      setStatusMessage("Your update has been posted for students in this course.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to post this update right now.";
      setStatusMessage(`Error: ${message}`);
    } finally {
      setPosting(false);
    }
  }, [actorId, actorName, forum, loadDiscussions, messageBody, messageTitle]);

  const handleDelete = useCallback(async function (discussionId: number) {
    if (!forum) {
      return;
    }

    setActioningId(discussionId);
    setStatusMessage(null);
    try {
      await deleteForumDiscussion(forum.id, discussionId);
      setReplyingId(function (current) {
        return current === discussionId ? null : current;
      });
      setReplyDrafts(function (current) {
        const next = { ...current };
        delete next[discussionId];
        return next;
      });
      await loadDiscussions();
      setStatusMessage("The discussion has been removed from this course.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to remove this discussion right now.";
      setStatusMessage(`Error: ${message}`);
    } finally {
      setActioningId(null);
    }
  }, [forum, loadDiscussions]);

  const handleReplySubmit = useCallback(async function (discussionId: number) {
    if (!forum) {
      return;
    }

    const draft = replyDrafts[discussionId]?.trim() || "";
    if (draft === "") {
      return;
    }

    setActioningId(discussionId);
    setStatusMessage(null);
    try {
      await replyToForumDiscussion(forum.id, discussionId, draft, {
        authorName: actorName,
        authorId: actorId,
        authorRole: "student",
      });
      setReplyDrafts(function (current) {
        return { ...current, [discussionId]: "" };
      });
      setReplyingId(null);
      await loadDiscussions();
      setStatusMessage("Your reply has been shared with this course.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to post your reply right now.";
      setStatusMessage(`Error: ${message}`);
    } finally {
      setActioningId(null);
    }
  }, [actorId, actorName, forum, loadDiscussions, replyDrafts]);

  const handleReaction = useCallback(async function (
    discussionId: number,
    reaction: MoodleDiscussionReactionType,
  ) {
    if (!forum) {
      return;
    }

    setActioningId(discussionId);
    setStatusMessage(null);
    try {
      await reactToForumDiscussion(forum.id, discussionId, reaction, {
        authorName: actorName,
        authorId: actorId,
        authorRole: "student",
      });
      await loadDiscussions();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update your response right now.";
      setStatusMessage(`Error: ${message}`);
    } finally {
      setActioningId(null);
    }
  }, [actorId, actorName, forum, loadDiscussions]);

  function isReactionActive(discussion: MoodleDiscussion, reaction: MoodleDiscussionReactionType) {
    return (discussion.reactions?.[reaction] || []).some(function (entry) {
      return String(entry) === String(actorId);
    });
  }

  function reactionCount(discussion: MoodleDiscussion, reaction: MoodleDiscussionReactionType) {
    return discussion.reactions?.[reaction]?.length || 0;
  }

  return (
    <div className="space-y-4">
      {isInstructor && (
        <div className="rounded-[22px] border p-5" style={{ borderColor: colors.border, background: cardSurface }}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Title
              </label>
              <input
                value={messageTitle}
                onChange={(event) => setMessageTitle(event.target.value)}
                className="w-full rounded-xl border px-3 py-2"
                style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
                placeholder="Share an update with your students"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Message
              </label>
              <textarea
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                rows={5}
                className="w-full rounded-xl border px-3 py-2"
                style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
                placeholder="Add any course update, reminder, or guidance for students in this class."
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Students in this course will see these posts in their dashboard discussion section.
            </p>
            <button
              type="button"
              onClick={() => void handlePost()}
              disabled={posting || messageTitle.trim() === "" || messageBody.trim() === ""}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{ background: colors.accent, color: "#000" }}
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Post
            </button>
          </div>
        </div>
      )}

      {statusMessage && (
        <div
          className="rounded-[18px] border px-4 py-3 text-sm"
          style={{
            borderColor: statusMessage.startsWith("Error") ? "rgba(239,68,68,0.3)" : colors.border,
            background: statusMessage.startsWith("Error") ? "rgba(239,68,68,0.08)" : cardSurface,
            color: statusMessage.startsWith("Error") ? "#ef4444" : colors.textSecondary,
          }}
        >
          {statusMessage}
        </div>
      )}

      {loading ? (
        <div className="rounded-[22px] border p-5 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading course discussions...
          </span>
        </div>
      ) : sortedDiscussions.length > 0 ? (
        <div className="space-y-3">
          {sortedDiscussions.map((discussion) => {
            const replies = normalizeReplies(discussion);
            const replyDraft = replyDrafts[discussion.id] || "";
            const replyBoxOpen = replyingId === discussion.id;
            const busy = actioningId === discussion.id;

            return (
              <div
                key={discussion.id}
                className="rounded-[22px] border p-4"
                style={{ borderColor: colors.border, background: cardSurface }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold" style={{ color: colors.text }}>
                        {discussion.subject || discussion.name}
                      </h3>
                      {discussion.author_role === "instructor" && (
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
                          style={{ background: "rgba(249,115,22,0.14)", color: colors.accent }}
                        >
                          Instructor
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                      {discussion.message}
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="text-right text-xs" style={{ color: colors.textMuted }}>
                      <div>{discussion.userfullname || "Course Instructor"}</div>
                      <div className="mt-1">{formatTimestamp(discussion.created)}</div>
                    </div>

                    {isInstructor && discussion.author_role === "instructor" && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(discussion.id)}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold disabled:opacity-60"
                        style={{ borderColor: colors.border, color: colors.textSecondary }}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {!isInstructor && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4" style={{ borderColor: colors.border }}>
                    <button
                      type="button"
                      onClick={() => setReplyingId((current) => (current === discussion.id ? null : discussion.id))}
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold"
                      style={{ borderColor: colors.border, color: colors.textSecondary }}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReaction(discussion.id, "up")}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold disabled:opacity-60"
                      style={{
                        borderColor: isReactionActive(discussion, "up") ? colors.accent : colors.border,
                        background: isReactionActive(discussion, "up") ? "rgba(249,115,22,0.12)" : "transparent",
                        color: isReactionActive(discussion, "up") ? colors.accent : colors.textSecondary,
                      }}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                      {reactionCount(discussion, "up")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReaction(discussion.id, "down")}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold disabled:opacity-60"
                      style={{
                        borderColor: isReactionActive(discussion, "down") ? colors.accent : colors.border,
                        background: isReactionActive(discussion, "down") ? "rgba(249,115,22,0.12)" : "transparent",
                        color: isReactionActive(discussion, "down") ? colors.accent : colors.textSecondary,
                      }}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5" />}
                      {reactionCount(discussion, "down")}
                    </button>
                  </div>
                )}

                {(replies.length > 0 || replyBoxOpen) && (
                  <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: colors.border }}>
                    {replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="rounded-[18px] border px-4 py-3"
                        style={{ borderColor: colors.border, background: colors.cardBg }}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold" style={{ color: colors.text }}>
                                {reply.userfullname || "Academy learner"}
                              </span>
                              {reply.author_role === "instructor" && (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
                                  style={{ background: "rgba(249,115,22,0.14)", color: colors.accent }}
                                >
                                  Instructor
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                              {reply.message}
                            </p>
                          </div>
                          <div className="text-right text-xs" style={{ color: colors.textMuted }}>
                            {formatTimestamp(reply.created)}
                          </div>
                        </div>
                      </div>
                    ))}

                    {!isInstructor && replyBoxOpen && (
                      <div className="rounded-[18px] border p-4" style={{ borderColor: colors.border, background: colors.cardBg }}>
                        <label className="mb-2 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                          Reply
                        </label>
                        <textarea
                          value={replyDraft}
                          onChange={(event) => {
                            const value = event.target.value;
                            setReplyDrafts((current) => ({ ...current, [discussion.id]: value }));
                          }}
                          rows={3}
                          className="w-full rounded-xl border px-3 py-2"
                          style={{ borderColor: colors.border, background: colors.cardBgStrong || colors.cardBg, color: colors.text }}
                          placeholder="Share a question, reflection, or quick response with your instructor."
                        />
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs" style={{ color: colors.textMuted }}>
                            Replying as {actorName}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setReplyingId(null)}
                              className="rounded-full border px-3 py-2 text-xs font-semibold"
                              style={{ borderColor: colors.border, color: colors.textSecondary }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleReplySubmit(discussion.id)}
                              disabled={busy || replyDraft.trim() === ""}
                              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-60"
                              style={{ background: colors.accent, color: "#000" }}
                            >
                              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                              Post Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[22px] border p-5 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
          <div className="inline-flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {isInstructor
              ? "No discussion posts have been shared with this class yet."
              : "Your instructors have not posted any course updates here yet."}
          </div>
        </div>
      )}
    </div>
  );
}

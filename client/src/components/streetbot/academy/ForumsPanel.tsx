import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Plus,
  Send,
  Clock,
  User,
  MessageCircle,
  Loader2,
  Pin,
  X,
} from "lucide-react";
import {
  getCourseForums,
  getForumDiscussions,
  createForumDiscussion,
  type MoodleForum,
  type MoodleDiscussion,
} from "./api/moodle";

interface ForumsPanelProps {
  courseId: string;
  colors: Record<string, string>;
}

type View = "forums" | "discussions" | "compose";

export function ForumsPanel({ courseId, colors }: ForumsPanelProps) {
  const [forums, setForums] = useState<MoodleForum[]>([]);
  const [discussions, setDiscussions] = useState<MoodleDiscussion[]>([]);
  const [selectedForum, setSelectedForum] = useState<MoodleForum | null>(null);
  const [view, setView] = useState<View>("forums");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Compose form state
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Load forums for the course
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getCourseForums(courseId);
        setForums(data);
      } catch (err) {
        console.error("Failed to load forums:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId]);

  // Load discussions when forum selected
  const openForum = useCallback(async (forum: MoodleForum) => {
    setSelectedForum(forum);
    setView("discussions");
    setLoading(true);
    try {
      const data = await getForumDiscussions(forum.id);
      setDiscussions(data);
    } catch (err) {
      console.error("Failed to load discussions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCompose = useCallback(async () => {
    if (!selectedForum || !subject.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      await createForumDiscussion(selectedForum.id, subject, message);
      setSubject("");
      setMessage("");
      setView("discussions");
      // Refresh discussions
      const data = await getForumDiscussions(selectedForum.id);
      setDiscussions(data);
    } catch (err) {
      console.error("Failed to create discussion:", err);
    } finally {
      setSubmitting(false);
    }
  }, [selectedForum, subject, message]);

  const goBack = useCallback(() => {
    if (view === "compose") {
      setView("discussions");
    } else {
      setView("forums");
      setSelectedForum(null);
      setDiscussions([]);
    }
  }, [view]);

  function formatTimestamp(ts: number): string {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading && view === "forums") {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2
          className="w-8 h-8 animate-spin"
          style={{ color: colors.accent }}
        />
      </div>
    );
  }

  // ==== Compose View ====
  if (view === "compose" && selectedForum) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-2 rounded-xl transition-colors"
            style={{
              background: colors.cardBg,
              border: `1px solid ${colors.border}`,
            }}
          >
            <ChevronLeft className="w-5 h-5" style={{ color: colors.text }} />
          </button>
          <div>
            <h3
              className="text-lg font-semibold"
              style={{ color: colors.text }}
            >
              New Discussion
            </h3>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              in {selectedForum.name}
            </p>
          </div>
        </div>

        {/* Compose Form */}
        <div
          className="rounded-2xl p-6 space-y-4"
          style={{
            background: colors.cardBg,
            backdropFilter: "blur(24px)",
            border: `1px solid ${colors.border}`,
          }}
        >
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: colors.textSecondary }}
            >
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Discussion topic..."
              className="w-full px-4 py-3 rounded-xl outline-none"
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: colors.textSecondary }}
            >
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message..."
              rows={6}
              className="w-full px-4 py-3 rounded-xl outline-none resize-none"
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={goBack}
              className="px-5 py-2.5 rounded-xl font-medium transition-colors"
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                color: colors.textSecondary,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCompose}
              disabled={submitting || !subject.trim() || !message.trim()}
              className="px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all"
              style={{
                background: colors.accent,
                color: "#000",
                opacity:
                  submitting || !subject.trim() || !message.trim() ? 0.5 : 1,
              }}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Post Discussion
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==== Discussions View ====
  if (view === "discussions" && selectedForum) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="p-2 rounded-xl transition-colors"
              style={{
                background: colors.cardBg,
                border: `1px solid ${colors.border}`,
              }}
            >
              <ChevronLeft
                className="w-5 h-5"
                style={{ color: colors.text }}
              />
            </button>
            <div>
              <h3
                className="text-lg font-semibold"
                style={{ color: colors.text }}
              >
                {selectedForum.name}
              </h3>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                {discussions.length} discussion
                {discussions.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => setView("compose")}
            className="px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all"
            style={{ background: colors.accent, color: "#000" }}
          >
            <Plus className="w-4 h-4" />
            New Discussion
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2
              className="w-8 h-8 animate-spin"
              style={{ color: colors.accent }}
            />
          </div>
        ) : discussions.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare
              className="w-16 h-16 mx-auto mb-4 opacity-30"
              style={{ color: colors.textMuted }}
            />
            <p className="text-lg font-medium" style={{ color: colors.text }}>
              No discussions yet
            </p>
            <p
              className="text-sm mt-1"
              style={{ color: colors.textSecondary }}
            >
              Start the conversation by posting a new discussion.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {discussions.map((d, index) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="p-4 rounded-xl cursor-pointer transition-all"
                style={{
                  background: colors.cardBg,
                  backdropFilter: "blur(20px)",
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div className="flex items-start gap-3">
                  {/* User avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(139, 92, 246, 0.2)" }}
                  >
                    <User className="w-5 h-5" style={{ color: "#8B5CF6" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {d.pinned && (
                        <Pin className="w-3.5 h-3.5" style={{ color: colors.accent }} />
                      )}
                      <h4
                        className="font-semibold truncate"
                        style={{ color: colors.text }}
                      >
                        {d.subject || d.name}
                      </h4>
                    </div>
                    <p
                      className="text-sm mb-2 line-clamp-2"
                      style={{ color: colors.textSecondary }}
                      dangerouslySetInnerHTML={{
                        __html: d.message?.replace(/<[^>]+>/g, "").slice(0, 150) || "",
                      }}
                    />
                    <div
                      className="flex items-center gap-4 text-xs"
                      style={{ color: colors.textMuted }}
                    >
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {d.userfullname || "Anonymous"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(d.timemodified || d.created)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        {d.numreplies || 0} replies
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==== Forum List View ====
  return (
    <div className="space-y-4">
      <h3
        className="text-xl font-semibold flex items-center gap-2"
        style={{ color: colors.text }}
      >
        <MessageSquare className="w-5 h-5" style={{ color: "#8B5CF6" }} />
        Course Forums
      </h3>

      {forums.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare
            className="w-16 h-16 mx-auto mb-4 opacity-30"
            style={{ color: colors.textMuted }}
          />
          <p className="text-lg font-medium" style={{ color: colors.text }}>
            No forums available
          </p>
          <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
            This course doesn't have any forums set up.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {forums.map((forum, index) => (
            <motion.div
              key={forum.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => openForum(forum)}
              className="p-5 rounded-2xl cursor-pointer group transition-all"
              style={{
                background: colors.cardBg,
                backdropFilter: "blur(24px)",
                border: `1px solid ${colors.border}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor =
                  "rgba(139, 92, 246, 0.5)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(139, 92, 246, 0.15)" }}
                  >
                    <MessageSquare
                      className="w-6 h-6"
                      style={{ color: "#8B5CF6" }}
                    />
                  </div>
                  <div className="min-w-0">
                    <h4
                      className="font-semibold group-hover:text-purple-400 transition-colors truncate"
                      style={{ color: colors.text }}
                    >
                      {forum.name}
                    </h4>
                    {forum.intro && (
                      <p
                        className="text-sm mt-0.5 line-clamp-1"
                        style={{ color: colors.textSecondary }}
                        dangerouslySetInnerHTML={{
                          __html: forum.intro.replace(/<[^>]+>/g, ""),
                        }}
                      />
                    )}
                    {forum.numdiscussions !== undefined && (
                      <p
                        className="text-xs mt-1"
                        style={{ color: colors.textMuted }}
                      >
                        {forum.numdiscussions} discussion
                        {forum.numdiscussions !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronRight
                  className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  style={{ color: colors.textMuted }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ForumsPanel;

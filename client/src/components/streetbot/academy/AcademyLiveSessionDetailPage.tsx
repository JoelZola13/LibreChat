import { Video } from "lucide-react";
import { useLocation, useParams } from "react-router-dom";
import { LiveSessionViewer } from "./LiveSessionViewer";
import { useAcademyUserId } from "./useAcademyUserId";

export default function AcademyLiveSessionDetailPage() {
  const { sessionId } = useParams();
  const location = useLocation();
  const userId = useAcademyUserId();
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const academyBasePath = location.pathname.startsWith("/learning") ? "/learning" : "/academy";

  return (
    <div style={{ minHeight: "100vh", background: "var(--sb-color-background)", padding: "88px 24px 40px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <a href={academyBasePath} className="text-sm font-medium hover:opacity-80" style={{ color: isDark ? "rgba(255,255,255,0.72)" : "#4b5563" }}>
            Academy
          </a>
          <span style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#6b7280" }}>/</span>
          <a href={`${academyBasePath}/live-sessions`} className="text-sm font-medium hover:opacity-80" style={{ color: isDark ? "rgba(255,255,255,0.72)" : "#4b5563" }}>
            Live Sessions
          </a>
          <span style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#6b7280" }}>/</span>
          <span className="text-sm font-medium" style={{ color: "#10B981" }}>Session Detail</span>
        </div>

        <div className="mb-8 flex items-center gap-3">
          <Video className="h-7 w-7" style={{ color: "#10B981" }} />
          <div>
            <h1 className="text-3xl font-bold" style={{ color: isDark ? "#fff" : "#111" }}>Live Session</h1>
            <p className="mt-2" style={{ color: isDark ? "rgba(255,255,255,0.72)" : "#4b5563" }}>
              Join the session, review meeting details, and stay aligned with your course instructor.
            </p>
          </div>
        </div>

        {sessionId ? <LiveSessionViewer sessionId={sessionId} userId={userId} /> : null}
      </div>
    </div>
  );
}

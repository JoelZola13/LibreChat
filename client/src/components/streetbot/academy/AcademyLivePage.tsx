import { useMemo } from "react";
import { AttendanceDashboard } from "./AttendanceDashboard";
import { getOrCreateUserId } from "../shared/userId";

export default function AcademyLivePage() {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const userId = useMemo(() => getOrCreateUserId(), []);

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
          <a
            href="/academy"
            className="text-sm font-medium hover:opacity-80"
            style={{ color: isDark ? "rgba(255,255,255,0.72)" : "#4b5563" }}
          >
            Academy
          </a>
          <span style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#6b7280" }}>/</span>
          <span className="text-sm font-medium" style={{ color: "#10B981" }}>
            Live Sessions
          </span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: isDark ? "#fff" : "#111" }}>
            Live Sessions
          </h1>
          <p className="mt-2" style={{ color: isDark ? "rgba(255,255,255,0.72)" : "#4b5563" }}>
            Attendance, engagement, and upcoming live academy sessions.
          </p>
        </div>

        <AttendanceDashboard userId={userId} />
      </div>
    </div>
  );
}

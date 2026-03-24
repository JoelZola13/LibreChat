"use client";

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  BookOpen,
  FileText,
  CheckSquare,
  Users,
  Newspaper,
  Briefcase,
  Image,
  Calendar,
  Search,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Clock,
  Star,
} from "lucide-react";

// Import glassmorphism styles
import "@/styles/glassmorphism.css";

const API_BASE = "/sbapi";

// Quick stats interface
interface Stats {
  tasks: { total: number; completed: number; pending: number };
  messages: { unread: number };
  courses: { enrolled: number; inProgress: number };
  news: { recent: number };
}

// Feature cards for the homepage
const features = [
  {
    icon: MessageSquare,
    title: "Messages",
    description: "Connect with your community",
    path: "/messages",
    color: "#FFD600",
  },
  {
    icon: CheckSquare,
    title: "Tasks",
    description: "Manage your projects and to-dos",
    path: "/tasks",
    color: "#22c55e",
  },
  {
    icon: BookOpen,
    title: "Academy",
    description: "Learn new skills and earn certificates",
    path: "/academy",
    color: "#8b5cf6",
  },
  {
    icon: FileText,
    title: "Documents",
    description: "Create and collaborate on documents",
    path: "/documents",
    color: "#3b82f6",
  },
  {
    icon: Users,
    title: "Directory",
    description: "Find services and resources",
    path: "/directory",
    color: "#ec4899",
  },
  {
    icon: Briefcase,
    title: "Job Board",
    description: "Discover employment opportunities",
    path: "/jobs",
    color: "#f59e0b",
  },
  {
    icon: Newspaper,
    title: "News",
    description: "Stay informed with community updates",
    path: "/news",
    color: "#06b6d4",
  },
  {
    icon: Image,
    title: "Gallery",
    description: "Share and view community artwork",
    path: "/gallery",
    color: "#ef4444",
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState("Welcome back");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set greeting based on time of day
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    // Fetch stats
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      // Try to fetch some real stats - gracefully handle errors
      const [tasksRes] = await Promise.allSettled([
        fetch(`${API_BASE}/projects?user_id=demo-user`),
      ]);

      const newStats: Stats = {
        tasks: { total: 0, completed: 0, pending: 0 },
        messages: { unread: 3 },
        courses: { enrolled: 2, inProgress: 1 },
        news: { recent: 5 },
      };

      if (tasksRes.status === "fulfilled" && tasksRes.value.ok) {
        const projects = await tasksRes.value.json();
        if (Array.isArray(projects)) {
          newStats.tasks.total = projects.reduce(
            (sum: number, p: { task_count?: number }) => sum + (p.task_count || 0),
            0
          );
          newStats.tasks.completed = projects.reduce(
            (sum: number, p: { completed_count?: number }) => sum + (p.completed_count || 0),
            0
          );
          newStats.tasks.pending = newStats.tasks.total - newStats.tasks.completed;
        }
      }

      setStats(newStats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      // Set default stats on error
      setStats({
        tasks: { total: 12, completed: 5, pending: 7 },
        messages: { unread: 3 },
        courses: { enrolled: 2, inProgress: 1 },
        news: { recent: 5 },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="homepage-container"
      style={{
        minHeight: "100vh",
        background: "var(--sb-color-background, #0a0a0e)",
        color: "#fff",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background gradient orbs */}
      <div
        style={{
          position: "fixed",
          top: "-20%",
          left: "20%",
          width: "600px",
          height: "600px",
          background:
            "radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 60%)",
          filter: "blur(60px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: "-10%",
          right: "10%",
          width: "500px",
          height: "500px",
          background:
            "radial-gradient(circle, rgba(255, 214, 0, 0.3) 0%, transparent 60%)",
          filter: "blur(60px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <header style={{ marginBottom: "48px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <Sparkles size={24} color="#FFD600" />
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>
              Street Voices Platform
            </span>
          </div>
          <h1
            style={{
              fontSize: "48px",
              fontWeight: 700,
              background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: "8px",
            }}
          >
            {greeting}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "18px" }}>
            Your community platform for resources, support, and connection
          </p>
        </header>

        {/* Quick Stats */}
        {stats && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginBottom: "48px",
            }}
          >
            <StatCard
              icon={<CheckSquare size={20} />}
              label="Tasks"
              value={`${stats.tasks.pending} pending`}
              subtext={`${stats.tasks.completed} completed`}
              color="#22c55e"
              onClick={() => navigate("/tasks")}
            />
            <StatCard
              icon={<MessageSquare size={20} />}
              label="Messages"
              value={`${stats.messages.unread} unread`}
              subtext="Stay connected"
              color="#FFD600"
              onClick={() => navigate("/messages")}
            />
            <StatCard
              icon={<BookOpen size={20} />}
              label="Academy"
              value={`${stats.courses.inProgress} in progress`}
              subtext={`${stats.courses.enrolled} enrolled`}
              color="#8b5cf6"
              onClick={() => navigate("/academy")}
            />
            <StatCard
              icon={<Newspaper size={20} />}
              label="News"
              value={`${stats.news.recent} articles`}
              subtext="Recent updates"
              color="#06b6d4"
              onClick={() => navigate("/news")}
            />
          </div>
        )}

        {/* AI Chat CTA */}
        <div
          onClick={() => navigate("/c/new")}
          style={{
            background: "linear-gradient(135deg, rgba(255, 214, 0, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)",
            border: "1px solid rgba(255, 214, 0, 0.3)",
            borderRadius: "24px",
            padding: "32px",
            marginBottom: "48px",
            cursor: "pointer",
            transition: "all 0.3s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "24px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.borderColor = "rgba(255, 214, 0, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.borderColor = "rgba(255, 214, 0, 0.3)";
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <Sparkles size={24} color="#FFD600" />
              <span style={{ color: "#FFD600", fontWeight: 600 }}>Street Voices AI</span>
            </div>
            <h2 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "8px" }}>
              How can I help you today?
            </h2>
            <p style={{ color: "rgba(255,255,255,0.6)" }}>
              Ask me anything - find resources, get support, or learn something new
            </p>
          </div>
          <div
            style={{
              background: "#FFD600",
              borderRadius: "50%",
              padding: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowRight size={24} color="#000" />
          </div>
        </div>

        {/* Feature Grid */}
        <h2 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "24px" }}>
          Explore Platform
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {features.map((feature) => (
            <FeatureCard
              key={feature.path}
              icon={<feature.icon size={24} />}
              title={feature.title}
              description={feature.description}
              color={feature.color}
              onClick={() => navigate(feature.path)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon,
  label,
  value,
  subtext,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "16px",
        padding: "20px",
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
        e.currentTarget.style.borderColor = color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <div style={{ color }}>{icon}</div>
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>{label}</span>
      </div>
      <div style={{ fontSize: "20px", fontWeight: 600, marginBottom: "4px" }}>{value}</div>
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>{subtext}</div>
    </div>
  );
}

// Feature Card Component
function FeatureCard({
  icon,
  title,
  description,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "20px",
        padding: "24px",
        cursor: "pointer",
        transition: "all 0.3s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 8px 32px ${color}20`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "12px",
          background: `${color}20`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "16px",
          color,
        }}
      >
        {icon}
      </div>
      <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>{title}</h3>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  );
}

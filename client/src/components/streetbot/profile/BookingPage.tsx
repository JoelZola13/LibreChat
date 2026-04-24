import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useGlassStyles } from "../shared/useGlassStyles";
import { GlassBackground } from "../shared/GlassBackground";
import { SB_API_BASE } from "~/components/streetbot/shared/apiConfig";
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Video,
  Phone,
  MapPin,
  MessageSquare,
  Star,
  Shield,
  CreditCard,
  User,
  Mail,
  FileText,
} from "lucide-react";
import { getStreetProfileAvatarUrl } from "./profileAvatarResolver";

// =============================================================================
// Services catalog (mirrors CreativeProfilePage)
// =============================================================================
const SERVICES_CATALOG = [
  {
    id: "mural-commission",
    name: "Mural Commission",
    desc: "Custom large-scale wall murals for businesses & homes",
    price: "Starting at $2,500",
    priceValue: 2500,
    duration: "60 min",
    available: true,
  },
  {
    id: "live-painting",
    name: "Live Painting",
    desc: "Live art performance for events, festivals & parties",
    price: "Starting at $1,000",
    priceValue: 1000,
    duration: "45 min",
    available: true,
  },
  {
    id: "art-direction",
    name: "Art Direction",
    desc: "Creative direction for brands, campaigns & productions",
    price: "Custom quote",
    priceValue: 0,
    duration: "30 min",
    available: true,
  },
  {
    id: "workshop-teaching",
    name: "Workshop / Teaching",
    desc: "Group or 1-on-1 street art workshops",
    price: "Starting at $500",
    priceValue: 500,
    duration: "30 min",
    available: false,
  },
];

// =============================================================================
// Types
// =============================================================================
type ConsultationType = "video" | "phone" | "in-person" | "chat";
type BookingStep = "service" | "datetime" | "details" | "confirm";

// =============================================================================
// Helpers
// =============================================================================
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIME_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM",
];

// Simulated busy slots (for realism)
const BUSY_SLOTS = new Set(["10:00 AM", "11:30 AM", "2:00 PM"]);

// =============================================================================
// Sub-components
// =============================================================================

function GlassCard({
  children,
  colors,
  isDark,
  style,
  onClick,
  selected,
}: {
  children: React.ReactNode;
  colors: any;
  isDark: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
  selected?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
        backdropFilter: "blur(20px)",
        border: selected
          ? `2px solid ${colors.accent}`
          : `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
        borderRadius: "16px",
        padding: "20px",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease",
        ...(onClick
          ? {
              ":hover": { transform: "translateY(-1px)" },
            }
          : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function StepIndicator({
  steps,
  currentStep,
  colors,
}: {
  steps: { id: BookingStep; label: string }[];
  currentStep: BookingStep;
  colors: any;
}) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "32px" }}>
      {steps.map((step, i) => {
        const isActive = i === currentIndex;
        const isCompleted = i < currentIndex;
        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: 700,
                  background: isCompleted
                    ? colors.accent
                    : isActive
                    ? "rgba(255,214,0,0.2)"
                    : "rgba(255,255,255,0.06)",
                  color: isCompleted ? "#000" : isActive ? colors.accent : colors.textSecondary,
                  border: isActive ? `2px solid ${colors.accent}` : "2px solid transparent",
                  transition: "all 0.3s ease",
                }}
              >
                {isCompleted ? <CheckCircle2 size={18} /> : i + 1}
              </div>
              <span
                style={{
                  fontSize: "11px",
                  marginTop: "6px",
                  color: isActive ? colors.accent : colors.textSecondary,
                  fontWeight: isActive ? 600 : 400,
                  whiteSpace: "nowrap",
                }}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: "2px",
                  background: isCompleted
                    ? colors.accent
                    : "rgba(255,255,255,0.1)",
                  marginBottom: "20px",
                  minWidth: "20px",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function BookingPage() {
  const { username } = useParams<{ username: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isDark, colors: sharedColors } = useGlassStyles();

  const colors = useMemo(
    () => ({
      ...sharedColors,
      accentText: isDark ? "#FFD600" : "#000",
    }),
    [sharedColors, isDark]
  );

  // Profile data
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const resolvedAvatarUrl = getStreetProfileAvatarUrl(profile);

  // Booking state
  const initialServiceId = searchParams.get("service") || "";
  const [step, setStep] = useState<BookingStep>(initialServiceId ? "datetime" : "service");
  const [selectedService, setSelectedService] = useState(
    SERVICES_CATALOG.find((s) => s.id === initialServiceId) || null
  );
  const [consultationType, setConsultationType] = useState<ConsultationType>("video");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  // Form fields
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  useEffect(() => {
    if (!username) return;
    fetch(`${SB_API_BASE}/street-profiles/${encodeURIComponent(username)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        // Use fallback profile based on username
        setProfile({
          display_name: username.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
          username,
          avatar_url: null,
          primary_roles: ["Creative"],
          location_display: "",
          is_verified: false,
        });
        setLoading(false);
      });
  }, [username]);

  const goBackToProfile = () => {
    // Use browser back if we came from the profile, otherwise go to settings
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(`/settings`);
    }
  };

  const goBack = () => {
    if (bookingConfirmed) {
      goBackToProfile();
      return;
    }
    switch (step) {
      case "service":
        goBackToProfile();
        break;
      case "datetime":
        if (initialServiceId) {
          goBackToProfile();
        } else {
          setStep("service");
        }
        break;
      case "details":
        setStep("datetime");
        break;
      case "confirm":
        setStep("details");
        break;
    }
  };

  const canProceed = () => {
    switch (step) {
      case "service":
        return !!selectedService;
      case "datetime":
        return !!selectedDate && !!selectedTime;
      case "details":
        return clientName.trim().length > 0 && clientEmail.trim().length > 0;
      case "confirm":
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    switch (step) {
      case "service":
        setStep("datetime");
        break;
      case "datetime":
        setStep("details");
        break;
      case "details":
        setStep("confirm");
        break;
      case "confirm":
        void submitBooking();
        break;
    }
  };

  const submitBooking = async () => {
    // Optimistically show the confirmation UI immediately; the email POST
    // runs in the background and logs any failure silently.
    setBookingConfirmed(true);
    try {
      const artistUsername = username || profile?.username;
      if (!artistUsername) return;
      const dateLabel = selectedDate
        ? selectedDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : "";
      const serviceTypeLabel =
        consultationTypes.find((c) => c.id === consultationType)?.label || "Consultation";
      await fetch(`${SB_API_BASE}/bookings/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist_username: artistUsername,
          client_name: clientName,
          client_email: clientEmail,
          service_name: selectedService?.name || "Consultation",
          service_type: serviceTypeLabel,
          booking_date: dateLabel,
          booking_time: selectedTime || "",
        }),
      });
    } catch (err) {
      // Non-fatal — the UI already shows confirmation; artist will follow up.
      console.warn("booking email failed", err);
    }
  };

  const STEPS: { id: BookingStep; label: string }[] = [
    { id: "service", label: "Service" },
    { id: "datetime", label: "Date & Time" },
    { id: "details", label: "Details" },
    { id: "confirm", label: "Confirm" },
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
  const firstDay = getFirstDayOfMonth(calendarYear, calendarMonth);

  const consultationTypes: { id: ConsultationType; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: "video", label: "Video Call", icon: <Video size={20} />, desc: "Meet face-to-face online" },
    { id: "phone", label: "Phone Call", icon: <Phone size={20} />, desc: "Quick audio consultation" },
    { id: "in-person", label: "In Person", icon: <MapPin size={20} />, desc: "Meet at a local venue" },
    { id: "chat", label: "Chat", icon: <MessageSquare size={20} />, desc: "Text-based discussion" },
  ];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", position: "relative" }}>
        <GlassBackground />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <p style={{ color: colors.textSecondary }}>Loading...</p>
        </div>
      </div>
    );
  }

  // ===== Confirmation Success Screen =====
  if (bookingConfirmed) {
    return (
      <div style={{ minHeight: "100vh", position: "relative" }}>
        <GlassBackground />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "700px", margin: "0 auto", padding: "40px 20px" }}>
          <GlassCard colors={colors} isDark={isDark} style={{ textAlign: "center", padding: "48px 32px" }}>
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: "rgba(34,197,94,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
              }}
            >
              <CheckCircle2 size={40} color="#22c55e" />
            </div>
            <h2 style={{ color: colors.text, fontSize: "28px", fontWeight: 700, margin: "0 0 12px" }}>
              Booking Confirmed!
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: "16px", lineHeight: 1.6, margin: "0 0 32px" }}>
              Your consultation with <strong style={{ color: colors.accent }}>{profile?.display_name}</strong> has been
              scheduled. A confirmation email will be sent to <strong>{clientEmail}</strong>.
            </p>
            <div
              style={{
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                borderRadius: "12px",
                padding: "20px",
                marginBottom: "32px",
                textAlign: "left",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <span style={{ fontSize: "12px", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Service</span>
                  <p style={{ margin: "4px 0 0", color: colors.text, fontWeight: 600 }}>{selectedService?.name}</p>
                </div>
                <div>
                  <span style={{ fontSize: "12px", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Type</span>
                  <p style={{ margin: "4px 0 0", color: colors.text, fontWeight: 600 }}>
                    {consultationTypes.find((c) => c.id === consultationType)?.label}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: "12px", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Date</span>
                  <p style={{ margin: "4px 0 0", color: colors.text, fontWeight: 600 }}>
                    {selectedDate?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: "12px", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Time</span>
                  <p style={{ margin: "4px 0 0", color: colors.text, fontWeight: 600 }}>{selectedTime}</p>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => goBackToProfile()}
                style={{
                  padding: "12px 28px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.08)",
                  color: colors.text,
                  fontWeight: 600,
                  fontSize: "14px",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                  cursor: "pointer",
                }}
              >
                Back to Profile
              </button>
              <button
                onClick={() => navigate("/profile")}
                style={{
                  padding: "12px 28px",
                  borderRadius: "12px",
                  background: colors.accent,
                  color: "#000",
                  fontWeight: 700,
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Browse More Creatives
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  // ===== Main Booking Flow =====
  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <GlassBackground />
      <div style={{ position: "relative", zIndex: 1, maxWidth: "900px", margin: "0 auto", padding: "24px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
          <button
            onClick={goBack}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 18px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
              color: colors.text,
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: colors.text }}>
              Book a Consultation
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: "14px", color: colors.textSecondary }}>
              with <span style={{ color: colors.accent, fontWeight: 600 }}>{profile?.display_name}</span>
              {profile?.primary_roles?.length > 0 && (
                <span> &mdash; {profile.primary_roles.join(", ")}</span>
              )}
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <StepIndicator steps={STEPS} currentStep={step} colors={colors} />

        {/* ===== Step 1: Select Service ===== */}
        {step === "service" && (
          <div>
            <h3 style={{ color: colors.text, fontSize: "18px", fontWeight: 600, margin: "0 0 16px" }}>
              Select a Service
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {SERVICES_CATALOG.filter((s) => s.available).map((svc) => (
                <GlassCard
                  key={svc.id}
                  colors={colors}
                  isDark={isDark}
                  onClick={() => setSelectedService(svc)}
                  selected={selectedService?.id === svc.id}
                  style={{ cursor: "pointer" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ flex: 1, minWidth: "200px" }}>
                      <h4 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: colors.text }}>
                        {svc.name}
                      </h4>
                      <p style={{ margin: 0, fontSize: "14px", color: colors.textSecondary }}>{svc.desc}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px" }}>
                        <span style={{ fontSize: "12px", color: colors.textSecondary, display: "flex", alignItems: "center", gap: "4px" }}>
                          <Clock size={12} /> {svc.duration} consultation
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: colors.accent }}>{svc.price}</div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>

            {/* Consultation Type */}
            <h3 style={{ color: colors.text, fontSize: "18px", fontWeight: 600, margin: "32px 0 16px" }}>
              Consultation Type
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
              {consultationTypes.map((ct) => (
                <GlassCard
                  key={ct.id}
                  colors={colors}
                  isDark={isDark}
                  onClick={() => setConsultationType(ct.id)}
                  selected={consultationType === ct.id}
                  style={{ cursor: "pointer", textAlign: "center", padding: "16px" }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: consultationType === ct.id ? "rgba(255,214,0,0.15)" : "rgba(255,255,255,0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 10px",
                      color: consultationType === ct.id ? colors.accent : colors.textSecondary,
                    }}
                  >
                    {ct.icon}
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>
                    {ct.label}
                  </div>
                  <div style={{ fontSize: "12px", color: colors.textSecondary }}>{ct.desc}</div>
                </GlassCard>
              ))}
            </div>
          </div>
        )}

        {/* ===== Step 2: Date & Time ===== */}
        {step === "datetime" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            {/* Calendar */}
            <GlassCard colors={colors} isDark={isDark}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <button
                  onClick={() => {
                    if (calendarMonth === 0) {
                      setCalendarMonth(11);
                      setCalendarYear(calendarYear - 1);
                    } else {
                      setCalendarMonth(calendarMonth - 1);
                    }
                  }}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.06)",
                    border: "none",
                    color: colors.text,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: colors.text }}>
                  {MONTH_NAMES[calendarMonth]} {calendarYear}
                </h4>
                <button
                  onClick={() => {
                    if (calendarMonth === 11) {
                      setCalendarMonth(0);
                      setCalendarYear(calendarYear + 1);
                    } else {
                      setCalendarMonth(calendarMonth + 1);
                    }
                  }}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.06)",
                    border: "none",
                    color: colors.text,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Day headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "4px" }}>
                {DAY_NAMES.map((day) => (
                  <div
                    key={day}
                    style={{
                      textAlign: "center",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: colors.textSecondary,
                      padding: "6px 0",
                      textTransform: "uppercase",
                    }}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const date = new Date(calendarYear, calendarMonth, day);
                  const isPast = date < today;
                  const isSunday = date.getDay() === 0;
                  const isDisabled = isPast || isSunday;
                  const isSelected =
                    selectedDate &&
                    selectedDate.getFullYear() === calendarYear &&
                    selectedDate.getMonth() === calendarMonth &&
                    selectedDate.getDate() === day;
                  const isToday =
                    today.getFullYear() === calendarYear &&
                    today.getMonth() === calendarMonth &&
                    today.getDate() === day;

                  return (
                    <button
                      key={day}
                      disabled={isDisabled}
                      onClick={() => {
                        setSelectedDate(new Date(calendarYear, calendarMonth, day));
                        setSelectedTime(null);
                      }}
                      style={{
                        width: "100%",
                        aspectRatio: "1",
                        borderRadius: "10px",
                        border: isToday ? `1px solid ${colors.accent}` : "1px solid transparent",
                        background: isSelected
                          ? colors.accent
                          : isDisabled
                          ? "transparent"
                          : "rgba(255,255,255,0.04)",
                        color: isSelected
                          ? "#000"
                          : isDisabled
                          ? "rgba(255,255,255,0.2)"
                          : colors.text,
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: "14px",
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </GlassCard>

            {/* Time Slots */}
            <GlassCard colors={colors} isDark={isDark}>
              <h4 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 600, color: colors.text }}>
                {selectedDate
                  ? selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
                  : "Select a date first"}
              </h4>
              {selectedService && (
                <p style={{ margin: "0 0 16px", fontSize: "13px", color: colors.textSecondary }}>
                  {selectedService.duration} &middot; {consultationTypes.find((c) => c.id === consultationType)?.label}
                </p>
              )}

              {selectedDate ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", maxHeight: "400px", overflowY: "auto" }}>
                  {TIME_SLOTS.map((time) => {
                    const isBusy = BUSY_SLOTS.has(time);
                    const isSelected = selectedTime === time;
                    return (
                      <button
                        key={time}
                        disabled={isBusy}
                        onClick={() => setSelectedTime(time)}
                        style={{
                          padding: "12px 16px",
                          borderRadius: "10px",
                          border: isSelected ? `2px solid ${colors.accent}` : `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                          background: isSelected
                            ? "rgba(255,214,0,0.12)"
                            : isBusy
                            ? "rgba(255,255,255,0.02)"
                            : "rgba(255,255,255,0.04)",
                          color: isSelected
                            ? colors.accent
                            : isBusy
                            ? "rgba(255,255,255,0.25)"
                            : colors.text,
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: "14px",
                          cursor: isBusy ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          textDecoration: isBusy ? "line-through" : "none",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <Clock size={14} /> {time}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  <Calendar size={40} color={colors.textSecondary} style={{ marginBottom: "12px", opacity: 0.5 }} />
                  <p style={{ color: colors.textSecondary, fontSize: "14px" }}>
                    Choose a date on the calendar to see available times
                  </p>
                </div>
              )}
            </GlassCard>
          </div>
        )}

        {/* ===== Step 3: Your Details ===== */}
        {step === "details" && (
          <div style={{ maxWidth: "600px", margin: "0 auto" }}>
            <GlassCard colors={colors} isDark={isDark}>
              <h3 style={{ color: colors.text, fontSize: "18px", fontWeight: 600, margin: "0 0 24px" }}>
                Your Details
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Name */}
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: colors.text, marginBottom: "8px" }}>
                    <User size={14} /> Full Name <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Enter your full name"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                      color: colors.text,
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: colors.text, marginBottom: "8px" }}>
                    <Mail size={14} /> Email Address <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="your@email.com"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                      color: colors.text,
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Project Description */}
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: colors.text, marginBottom: "8px" }}>
                    <FileText size={14} /> Project Description
                  </label>
                  <textarea
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    placeholder="Tell the artist about your project, vision, timeline, and any specific requirements..."
                    rows={5}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                      color: colors.text,
                      fontSize: "14px",
                      outline: "none",
                      resize: "vertical",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            </GlassCard>

            {/* Info card */}
            <GlassCard colors={colors} isDark={isDark} style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <Shield size={20} color={colors.accent} style={{ flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <h4 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 600, color: colors.text }}>
                    Secure & Protected
                  </h4>
                  <p style={{ margin: 0, fontSize: "13px", color: colors.textSecondary, lineHeight: 1.5 }}>
                    Your information is kept confidential and only shared with the artist for this booking.
                    No payment is required until the artist confirms the consultation.
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* ===== Step 4: Review & Confirm ===== */}
        {step === "confirm" && (
          <div style={{ maxWidth: "600px", margin: "0 auto" }}>
            <GlassCard colors={colors} isDark={isDark}>
              <h3 style={{ color: colors.text, fontSize: "18px", fontWeight: 600, margin: "0 0 24px" }}>
                Review Booking
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Artist */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "16px",
                    borderRadius: "12px",
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: "rgba(255,214,0,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {resolvedAvatarUrl ? (
                      <img src={resolvedAvatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <Star size={24} color={colors.accent} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: colors.text }}>
                      {profile?.display_name}
                    </div>
                    <div style={{ fontSize: "13px", color: colors.textSecondary }}>
                      {profile?.primary_roles?.join(", ")}
                    </div>
                  </div>
                </div>

                {/* Booking details grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <DetailItem label="Service" value={selectedService?.name || ""} icon={<Briefcase size={14} />} colors={colors} isDark={isDark} />
                  <DetailItem label="Consultation" value={consultationTypes.find((c) => c.id === consultationType)?.label || ""} icon={<Video size={14} />} colors={colors} isDark={isDark} />
                  <DetailItem label="Date" value={selectedDate?.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) || ""} icon={<Calendar size={14} />} colors={colors} isDark={isDark} />
                  <DetailItem label="Time" value={selectedTime || ""} icon={<Clock size={14} />} colors={colors} isDark={isDark} />
                  <DetailItem label="Duration" value={selectedService?.duration || ""} icon={<Clock size={14} />} colors={colors} isDark={isDark} />
                  <DetailItem label="Price" value={selectedService?.price || ""} icon={<CreditCard size={14} />} colors={colors} isDark={isDark} />
                </div>

                {/* Client info */}
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", color: colors.textSecondary, marginBottom: "8px" }}>
                    Your Information
                  </div>
                  <div style={{ fontSize: "14px", color: colors.text, fontWeight: 600 }}>{clientName}</div>
                  <div style={{ fontSize: "13px", color: colors.textSecondary, marginTop: "2px" }}>{clientEmail}</div>
                  {projectDesc && (
                    <p style={{ fontSize: "13px", color: colors.textSecondary, marginTop: "8px", lineHeight: 1.5, borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, paddingTop: "8px" }}>
                      {projectDesc}
                    </p>
                  )}
                </div>
              </div>
            </GlassCard>

            {/* Cancellation Policy */}
            <GlassCard colors={colors} isDark={isDark} style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <Shield size={18} color={colors.accent} style={{ flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <h4 style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 600, color: colors.text }}>
                    Free Cancellation
                  </h4>
                  <p style={{ margin: 0, fontSize: "12px", color: colors.textSecondary, lineHeight: 1.5 }}>
                    Cancel up to 24 hours before your appointment for a full refund. The artist will confirm your booking within 48 hours.
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* ===== Navigation Buttons ===== */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "32px",
            padding: "20px 0",
            borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
          }}
        >
          <button
            onClick={goBack}
            style={{
              padding: "12px 24px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
              color: colors.text,
              fontWeight: 600,
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <ChevronLeft size={16} />
            {step === "service" || (step === "datetime" && initialServiceId) ? "Cancel" : "Back"}
          </button>
          <button
            onClick={nextStep}
            disabled={!canProceed()}
            style={{
              padding: "12px 32px",
              borderRadius: "12px",
              background: canProceed() ? colors.accent : "rgba(255,255,255,0.08)",
              color: canProceed() ? "#000" : colors.textSecondary,
              fontWeight: 700,
              fontSize: "14px",
              border: "none",
              cursor: canProceed() ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              opacity: canProceed() ? 1 : 0.5,
              transition: "all 0.2s ease",
            }}
          >
            {step === "confirm" ? (
              <>
                <CheckCircle2 size={16} /> Confirm Booking
              </>
            ) : (
              <>
                Continue <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Detail Item
// =============================================================================
function DetailItem({
  label,
  value,
  icon,
  colors,
  isDark,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  colors: any;
  isDark: boolean;
}) {
  return (
    <div
      style={{
        padding: "12px",
        borderRadius: "10px",
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
        <span style={{ color: colors.textSecondary }}>{icon}</span>
        <span style={{ fontSize: "11px", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>{value}</div>
    </div>
  );
}

// Re-export for use in routes
function Briefcase(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

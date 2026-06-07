import { memo } from "react";
import { useLocation } from "react-router-dom";
import { useGlassStyles } from "./useGlassStyles";
import { Aurora, backgroundKeyframes } from "./SbpBackgroundOrbs";

/**
 * GlassBackground Component - Renders the gradient orbs
 */
export const GlassBackground = memo(function GlassBackground() {
  const { pathname } = useLocation();
  const { gradientOrbs, isDark } = useGlassStyles();
  const isHomeStyledRoute =
    pathname === "/home" ||
    pathname === "/c/new" ||
    (typeof window !== "undefined" &&
      (window.location.pathname === "/home" || window.location.pathname === "/c/new"));
  const isHomeDarkRoute =
    isHomeStyledRoute &&
    (isDark ||
      (typeof document !== "undefined" && document.documentElement.classList.contains("dark")));

  if (isHomeDarkRoute) {
    return (
      <>
        <style>{backgroundKeyframes}</style>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ zIndex: 0 }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(3, 4, 6, 1) 0%, rgba(4, 5, 8, 0.996) 24%, rgba(5, 7, 10, 0.986) 48%, rgba(7, 9, 13, 0.968) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(3, 4, 6, 0.98) 0%, rgba(3, 4, 6, 0.94) 14%, rgba(3, 4, 6, 0.8) 28%, rgba(3, 4, 6, 0.54) 42%, rgba(3, 4, 6, 0.22) 58%, rgba(3, 4, 6, 0.04) 72%, transparent 82%)",
            }}
          />
          <div
            className="sv-home-aurora-field absolute inset-0"
            style={{
              inset: "calc(30% - 50px) -12% calc(-24% + 50px) -12%",
              opacity: 0.7,
              filter: "saturate(132%) brightness(0.88) contrast(1.03)",
              animation: "sv-home-aurora-field-drift 24s ease-in-out infinite alternate",
              transformOrigin: "50% 84%",
              WebkitMaskImage:
                "linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.04) 22%, rgba(0, 0, 0, 0.22) 34%, rgba(0, 0, 0, 0.72) 58%, rgba(0, 0, 0, 0.96) 78%, rgba(0, 0, 0, 1) 100%)",
              maskImage:
                "linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.04) 22%, rgba(0, 0, 0, 0.22) 34%, rgba(0, 0, 0, 0.72) 58%, rgba(0, 0, 0, 0.96) 78%, rgba(0, 0, 0, 1) 100%)",
            }}
          >
            <Aurora
              colorStops={["#ffd400", "#00b4d0", "#fe8a8d", "#7c86c6"]}
              amplitude={1}
              blend={0.9}
            />
          </div>
          <div
            className="absolute"
            style={{
              left: "-10%",
              bottom: "calc(-18% + 50px)",
              width: "46%",
              height: "52%",
              borderRadius: "999px",
              background:
                "radial-gradient(circle at 50% 54%, rgba(255, 212, 0, 0.32) 0%, rgba(255, 212, 0, 0.18) 24%, rgba(255, 212, 0, 0.065) 52%, transparent 74%)",
              filter: "blur(96px)",
              opacity: 0.58,
              animation: "sv-home-aurora-field-drift 24s ease-in-out infinite alternate-reverse",
              transformOrigin: "24% 86%",
            }}
          />
          <div
            className="absolute"
            style={{
              right: "-8%",
              bottom: "calc(-20% + 50px)",
              width: "38%",
              height: "46%",
              borderRadius: "999px",
              background:
                "radial-gradient(circle at 48% 52%, rgba(124, 134, 198, 0.18) 0%, rgba(124, 134, 198, 0.085) 26%, rgba(124, 134, 198, 0.03) 54%, transparent 74%)",
              filter: "blur(104px)",
              opacity: 0.44,
              animation: "sv-home-aurora-field-drift 24s ease-in-out infinite alternate",
              transformOrigin: "74% 84%",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 108%, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0.014) 24%, transparent 58%), linear-gradient(180deg, rgba(0, 0, 0, 0) 54%, rgba(0, 0, 0, 0.08) 100%)",
              opacity: 0.9,
            }}
          />
        </div>
      </>
    );
  }

  if (isHomeStyledRoute) {
    return (
      <>
        <style>{backgroundKeyframes}</style>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ zIndex: 0 }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(254, 254, 255, 0.998) 28%, rgba(251, 252, 253, 0.989) 56%, rgba(246, 248, 250, 0.978) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(255, 255, 255, 0.992) 0%, rgba(255, 255, 255, 0.965) 14%, rgba(255, 255, 255, 0.82) 28%, rgba(255, 255, 255, 0.54) 42%, rgba(255, 255, 255, 0.22) 58%, rgba(255, 255, 255, 0.04) 72%, transparent 82%)",
            }}
          />
          <div
            className="sv-home-aurora-field absolute inset-0"
            style={{
              inset: "calc(30% - 50px) -12% calc(-24% + 50px) -12%",
              opacity: 0.59,
              filter: "saturate(136%) brightness(1.16) contrast(1.03)",
              animation: "sv-home-aurora-field-drift 24s ease-in-out infinite alternate",
              transformOrigin: "50% 84%",
              WebkitMaskImage:
                "linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.04) 22%, rgba(0, 0, 0, 0.22) 34%, rgba(0, 0, 0, 0.72) 58%, rgba(0, 0, 0, 0.96) 78%, rgba(0, 0, 0, 1) 100%)",
              maskImage:
                "linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.04) 22%, rgba(0, 0, 0, 0.22) 34%, rgba(0, 0, 0, 0.72) 58%, rgba(0, 0, 0, 0.96) 78%, rgba(0, 0, 0, 1) 100%)",
            }}
          >
            <Aurora
              colorStops={["#ffd400", "#00b4d0", "#fe8a8d", "#7c86c6"]}
              amplitude={1}
              blend={0.9}
            />
          </div>
          <div
            className="absolute"
            style={{
              left: "-10%",
              bottom: "calc(-18% + 50px)",
              width: "46%",
              height: "52%",
              borderRadius: "999px",
              background:
                "radial-gradient(circle at 50% 54%, rgba(255, 212, 0, 0.26) 0%, rgba(255, 212, 0, 0.14) 24%, rgba(255, 212, 0, 0.05) 52%, transparent 74%)",
              filter: "blur(96px)",
              opacity: 0.48,
              animation: "sv-home-aurora-field-drift 24s ease-in-out infinite alternate-reverse",
              transformOrigin: "24% 86%",
            }}
          />
          <div
            className="absolute"
            style={{
              right: "-8%",
              bottom: "calc(-20% + 50px)",
              width: "38%",
              height: "46%",
              borderRadius: "999px",
              background:
                "radial-gradient(circle at 48% 52%, rgba(124, 134, 198, 0.17) 0%, rgba(124, 134, 198, 0.08) 26%, rgba(124, 134, 198, 0.03) 54%, transparent 74%)",
              filter: "blur(104px)",
              opacity: 0.34,
              animation: "sv-home-aurora-field-drift 24s ease-in-out infinite alternate",
              transformOrigin: "74% 84%",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 108%, rgba(255, 255, 255, 0.74) 0%, rgba(255, 255, 255, 0.42) 24%, rgba(255, 255, 255, 0.12) 58%, transparent 76%), linear-gradient(180deg, rgba(255, 255, 255, 0.84) 0%, rgba(255, 255, 255, 0.58) 34%, rgba(255, 255, 255, 0.24) 66%, rgba(255, 255, 255, 0.1) 100%), radial-gradient(circle at 50% 10%, rgba(255, 255, 255, 0.78) 0%, rgba(255, 255, 255, 0.5) 34%, rgba(255, 255, 255, 0.12) 68%, transparent 86%)",
            }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div style={gradientOrbs.purple} aria-hidden="true" />
      <div style={gradientOrbs.pink} aria-hidden="true" />
      <div style={gradientOrbs.cyan} aria-hidden="true" />
      <div style={gradientOrbs.gold} aria-hidden="true" />
    </>
  );
});

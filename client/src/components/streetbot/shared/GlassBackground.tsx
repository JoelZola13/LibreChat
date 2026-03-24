import { memo } from "react";
import { useGlassStyles } from "./useGlassStyles";

/**
 * GlassBackground Component - Renders the gradient orbs
 */
export const GlassBackground = memo(function GlassBackground() {
  const { gradientOrbs } = useGlassStyles();

  return (
    <>
      <div style={gradientOrbs.purple} aria-hidden="true" />
      <div style={gradientOrbs.pink} aria-hidden="true" />
      <div style={gradientOrbs.cyan} aria-hidden="true" />
      <div style={gradientOrbs.gold} aria-hidden="true" />
    </>
  );
});

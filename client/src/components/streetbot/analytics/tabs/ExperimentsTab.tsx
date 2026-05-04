// Experiments tab — proxies PostHog. We do not duplicate PostHog's UI; we
// link out to it (audit-logged) and surface key conversion deltas inline.

import * as React from 'react';

export function ExperimentsTab() {
  return (
    <div className="rounded-lg border border-border-light bg-surface-primary p-6 space-y-3 text-sm">
      <h3 className="font-medium text-text-primary">Experiments</h3>
      <p className="text-text-secondary">
        Experiments are owned by PostHog. The dashboard shows exposure totals and conversion deltas
        for active flag-driven experiments here, with a deeplink out to PostHog for the full report.
      </p>
      <p className="text-text-secondary">
        Suggested experiments per the plan: onboarding flow order, profile creation prompts, directory map
        vs list default, gallery upload CTA placement, job card layout, resume completion nudges, Academy
        course recommendations, AI assistant prompts, notification copy and timing.
      </p>
      <p className="text-text-secondary">
        This tab is wired up but expects a populated <code>analytics_experiment_exposures</code> table —
        once PostHog is live and capturing exposures, this view fills in automatically.
      </p>
    </div>
  );
}

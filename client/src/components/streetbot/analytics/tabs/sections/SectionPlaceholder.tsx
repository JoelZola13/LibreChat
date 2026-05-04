// Placeholder shown for not-yet-built section dashboards.
// Each section ships in its own task — this is what users see in between.

import * as React from 'react';
import { SectionTitle } from '../../components/SectionTitle';

export function SectionPlaceholder({ sectionKey, sectionLabel }: {
  sectionKey: string;
  sectionLabel: string;
}) {
  return (
    <div style={{ maxWidth: 700 }}>
      <span className="sv-datecap">SECTION ANALYTICS</span>
      <h1 className="sv-h1" style={{ marginTop: 6, marginBottom: 24 }}>{sectionLabel}</h1>

      <div className="sv-card sv-card--padded">
        <SectionTitle>Coming Soon</SectionTitle>
        <p style={{ color: 'var(--sv-grey-1)', lineHeight: 1.55, fontSize: 19 }}>
          This section's dashboard is being built. Each section gets its own
          tailored metrics — see the proposal we agreed on for what's planned
          for <strong style={{ color: 'var(--sv-black)' }}>{sectionLabel}</strong>.
        </p>
        <p style={{ color: 'var(--sv-grey-1)', lineHeight: 1.55, fontSize: 19, marginTop: 16 }}>
          Section key: <code style={{
            background: 'var(--sv-yellow-pale)',
            padding: '2px 8px',
            borderRadius: 6,
            fontWeight: 700,
            color: 'var(--sv-black)'
          }}>{sectionKey}</code>
        </p>
      </div>
    </div>
  );
}

import * as React from 'react';

interface Props {
  children: React.ReactNode;
  right?: React.ReactNode;
}

export function SectionTitle({ children, right }: Props) {
  return (
    <div className="sv-section-title" style={{ justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          display: 'block', width: 4, height: 14,
          background: 'var(--sv-yellow)', borderRadius: 2,
        }} />
        <span>{children}</span>
      </div>
      {right ? <div style={{ marginLeft: 'auto' }}>{right}</div> : null}
    </div>
  );
}

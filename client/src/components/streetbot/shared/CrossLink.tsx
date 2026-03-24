import { useNavigate } from 'react-router-dom';
import { useGlassStyles } from '../hooks/useGlassStyles';
import type { LucideIcon } from 'lucide-react';

interface CrossLinkProps {
  icon: LucideIcon;
  label: string;
  to: string;
  variant?: 'chip' | 'icon-only';
  color?: string;
  title?: string;
}

/**
 * Reusable cross-page navigation link rendered as a glass chip or icon button.
 * Use this to connect related pages contextually (e.g. "Add to Calendar" on a task).
 */
export function CrossLink({
  icon: Icon,
  label,
  to,
  variant = 'chip',
  color,
  title,
}: CrossLinkProps) {
  const navigate = useNavigate();
  const { colors, glassButton, buttonHoverHandlers } = useGlassStyles();

  const iconColor = color || colors.textSecondary;

  if (variant === 'icon-only') {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); navigate(to); }}
        title={title || label}
        style={{
          ...glassButton,
          padding: '6px',
          borderRadius: '10px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        {...buttonHoverHandlers}
      >
        <Icon size={16} style={{ color: iconColor }} />
      </button>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigate(to); }}
      title={title || label}
      style={{
        ...glassButton,
        padding: '4px 10px',
        borderRadius: '10px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        fontSize: '12px',
        whiteSpace: 'nowrap' as const,
      }}
      {...buttonHoverHandlers}
    >
      <Icon size={14} style={{ color: iconColor }} />
      <span style={{ color: colors.textSecondary }}>{label}</span>
    </button>
  );
}

export default CrossLink;

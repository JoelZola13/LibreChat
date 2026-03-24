import React from 'react';
import { useResponsive } from '../hooks/useResponsive';

interface UnifiedLayoutProps {
    children: React.ReactNode;
    variant?: 'standard' | 'dashboard' | 'full';
    className?: string;
    header?: React.ReactNode;
    bgToUse?: string; // Optional override
}

export const UnifiedLayout = ({
    children,
    variant = 'standard',
    className = '',
    header,
    bgToUse
}: UnifiedLayoutProps) => {
    const { isMobile } = useResponsive();

    const widthMap = {
        standard: '1200px',
        dashboard: '1600px', // Wider for grids/tables
        full: '100%'
    };

    const maxWidth = widthMap[variant];
    const isFull = variant === 'full';

    return (
        <div
            className={`unified-layout-container ${className}`}
            style={{
                minHeight: '100vh',
                background: bgToUse || 'var(--sb-color-background)',
                color: 'var(--sb-color-text-primary)',
                width: '100%',
                position: 'relative',
                overflowX: 'hidden',
            }}
        >
            {/* Optional Sticky Header Wrapper */}
            {header && (
                <div
                    style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 40,
                        background: 'var(--sb-color-overlay-surface)', // Glassmorphism background
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        borderBottom: '1px solid var(--sb-color-border)',
                        transition: 'all 0.3s ease'
                    }}
                >
                    <div style={{
                        maxWidth,
                        margin: '0 auto',
                        padding: isFull ? '0' : isMobile ? '0 16px' : '0 24px',
                        height: 'auto'
                    }}>
                        {header}
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <main
                style={{
                    maxWidth,
                    margin: '0 auto',
                    padding: isFull ? '0' : isMobile ? '16px' : '24px',
                    width: '100%',
                }}
            >
                {children}
            </main>
        </div>
    );
};

interface UnifiedHeaderProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    actions?: React.ReactNode;
    onBack?: () => void;
}

export const UnifiedHeader = ({ title, subtitle, actions, onBack }: UnifiedHeaderProps) => {
    return (
        <div style={{
            padding: '20px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '20px',
            flexWrap: 'wrap'
        }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="text-sm text-gray-500 hover:text-white mb-2 flex items-center gap-1 transition-colors"
                    >
                        ← Back
                    </button>
                )}
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
                    {title}
                </h1>
                {subtitle && (
                    <div className="text-gray-400 text-sm md:text-base max-w-2xl leading-relaxed">
                        {subtitle}
                    </div>
                )}
            </div>

            {actions && (
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    flexWrap: 'wrap'
                }}>
                    {actions}
                </div>
            )}
        </div>
    );
};

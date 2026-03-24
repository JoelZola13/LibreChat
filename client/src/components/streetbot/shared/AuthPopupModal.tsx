import { useMemo, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLoginUserMutation } from '~/data-provider';
import { useGlassStyles } from './useGlassStyles';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'register';
};

type UserType = 'user' | 'provider';

export default function AuthPopupModal({ isOpen, onClose, initialTab = 'login' }: Props) {
  const navigate = useNavigate();
  const { error: authError, setError: setAuthError, isAuthenticated } = useAuthContext();
  const { isDark, colors } = useGlassStyles();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(
    initialTab === 'register' ? 'register' : 'login',
  );
  const [userType, setUserType] = useState<UserType>('user');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginAttempted, setLoginAttempted] = useState(false);

  // Direct login mutation — works even when AuthContext provides a noop login
  // (e.g. on public pages that use publicAuthValue).
  const directLogin = useLoginUserMutation({
    onSuccess: (data) => {
      const { twoFAPending, tempToken } = data;
      if (twoFAPending) {
        navigate(`/login/2fa?tempToken=${tempToken}`, { replace: true });
        return;
      }
      // Dispatch token event so AuthContextProvider picks up the new session
      window.dispatchEvent(new CustomEvent('tokenUpdated', { detail: data.token }));
      setIsSubmitting(false);
      setLoginAttempted(false);
      onClose();
      navigate('/home', { replace: true });
    },
    onError: (error: unknown) => {
      setIsSubmitting(false);
      const msg = (error as { message?: string })?.message || 'Login failed';
      setFormError(msg);
    },
  });

  const login = useCallback(
    (creds: { email: string; password: string }) => {
      directLogin.mutate(creds);
    },
    [directLogin],
  );

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    orgName: '',
    roleTitle: '',
  });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Clear errors when switching tabs or closing
  useEffect(() => {
    setFormError(null);
    setIsSubmitting(false);
    setLoginAttempted(false);
  }, [activeTab, isOpen]);

  // Close modal on successful authentication after a login attempt
  useEffect(() => {
    if (loginAttempted && isAuthenticated) {
      setIsSubmitting(false);
      setLoginAttempted(false);
      onClose();
    }
  }, [loginAttempted, isAuthenticated, onClose]);

  // Stop submitting spinner on auth error
  useEffect(() => {
    if (loginAttempted && authError) {
      setIsSubmitting(false);
    }
  }, [loginAttempted, authError]);

  // ── Theme tokens ──
  const t = useMemo(() => {
    const accent = '#FFD600';
    const accentDark = '#b8960a';
    return {
      // Modal chrome
      overlayBg: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.35)',
      modalBg: isDark
        ? 'linear-gradient(180deg, rgba(24, 26, 35, 0.97), rgba(16, 18, 25, 0.99))'
        : 'linear-gradient(180deg, #ffffff, #f8f9fc)',
      modalBorder: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
      modalShadow: isDark
        ? '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06) inset'
        : '0 32px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.8) inset',

      // Tab area
      tabBarBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      tabActiveBg: isDark ? 'rgba(255,214,0,0.12)' : 'rgba(255,214,0,0.1)',
      tabActiveText: isDark ? accent : '#8a7100',
      tabInactiveText: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)',
      tabIndicator: isDark ? accent : accentDark,

      // Text
      text: isDark ? '#fff' : '#111827',
      textSecondary: isDark ? 'rgba(255,255,255,0.55)' : '#6b7280',
      textMuted: isDark ? 'rgba(255,255,255,0.35)' : '#9ca3af',

      // Input
      inputBg: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb',
      inputBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
      inputBorderFocus: isDark ? 'rgba(255,214,0,0.5)' : 'rgba(183,150,10,0.5)',
      inputText: isDark ? '#fff' : '#111827',
      inputPlaceholder: isDark ? 'rgba(255,255,255,0.3)' : '#9ca3af',

      // Social buttons
      socialBg: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
      socialBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      socialBorderHover: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)',
      socialText: isDark ? 'rgba(255,255,255,0.85)' : '#374151',

      // Divider
      dividerLine: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      dividerText: isDark ? 'rgba(255,255,255,0.3)' : '#9ca3af',

      // Submit
      submitBg: accent,
      submitText: '#000',
      submitShadow: isDark
        ? '0 4px 20px rgba(255,214,0,0.25)'
        : '0 4px 16px rgba(255,214,0,0.3)',

      // User/Provider toggle
      toggleBg: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6',
      toggleActiveBg: isDark ? 'rgba(255,214,0,0.1)' : 'rgba(255,214,0,0.08)',
      toggleActiveBorder: isDark ? accent : accentDark,
      toggleActiveText: isDark ? accent : '#7a6400',
      toggleInactiveText: isDark ? 'rgba(255,255,255,0.4)' : '#9ca3af',
      toggleDot: isDark ? accent : '#3b82f6',

      // Link
      link: isDark ? '#5ce0d8' : '#0d9488',

      // Close
      closeBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      closeBgHover: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
      closeIcon: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
    };
  }, [isDark]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    setFormError(null);
    if (setAuthError) setAuthError(undefined);

    if (activeTab === 'login') {
      if (!formData.email.trim() || !formData.password) {
        setFormError('Please enter your email and password.');
        return;
      }
      setIsSubmitting(true);
      setLoginAttempted(true);
      login({ email: formData.email.trim(), password: formData.password });
    } else {
      onClose();
      navigate('/register');
    }
  };

  const handleSocialLogin = (provider: string) => {
    onClose();
    window.location.href = `/oauth/${provider}`;
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const renderInput = (
    field: string,
    placeholder: string,
    type = 'text',
  ) => {
    const isFocused = focusedField === field;
    return (
      <input
        type={type}
        placeholder={placeholder}
        value={formData[field as keyof typeof formData] || ''}
        onChange={(e) => updateField(field, e.target.value)}
        onFocus={() => setFocusedField(field)}
        onBlur={() => setFocusedField(null)}
        style={{
          width: '100%',
          height: 46,
          padding: '0 18px',
          borderRadius: 12,
          border: `1.5px solid ${isFocused ? t.inputBorderFocus : t.inputBorder}`,
          background: t.inputBg,
          color: t.inputText,
          // Keep >=16px to prevent iOS Safari focus zoom on auth fields.
          fontSize: 16,
          fontWeight: 400,
          letterSpacing: '0.01em',
          outline: 'none',
          fontFamily: 'inherit',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          boxShadow: isFocused
            ? (isDark ? '0 0 0 3px rgba(255,214,0,0.1)' : '0 0 0 3px rgba(183,150,10,0.08)')
            : 'none',
        }}
      />
    );
  };

  const socialButton = (
    provider: 'google' | 'facebook',
    icon: React.ReactNode,
    label: string,
  ) => (
    <button
      onClick={() => handleSocialLogin(provider)}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        height: 46,
        borderRadius: 12,
        border: `1.5px solid ${t.socialBorder}`,
        background: t.socialBg,
        color: t.socialText,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        letterSpacing: '0.01em',
        transition: 'border-color 0.2s, background 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = t.socialBorderHover;
        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#eef0f3';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = t.socialBorder;
        e.currentTarget.style.background = t.socialBg;
      }}
    >
      {icon}
      {label}
    </button>
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: t.overlayBg,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(420px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: 20,
          border: t.modalBorder,
          background: t.modalBg,
          color: t.text,
          boxShadow: t.modalShadow,
        }}
      >
        {/* ── Header: Tabs + Close ── */}
        <div
          style={{
            position: 'relative',
            padding: '6px 6px 0',
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 32,
              height: 32,
              borderRadius: 10,
              border: 'none',
              background: t.closeBg,
              color: t.closeIcon,
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
              zIndex: 2,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = t.closeBgHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = t.closeBg; }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>

          {/* Tab bar */}
          <div
            style={{
              display: 'flex',
              background: t.tabBarBg,
              borderRadius: 14,
              padding: 4,
              margin: '4px 40px 0 4px',
            }}
          >
            {(['login', 'register'] as const).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    border: 'none',
                    borderRadius: 10,
                    background: isActive ? t.tabActiveBg : 'transparent',
                    color: isActive ? t.tabActiveText : t.tabInactiveText,
                    fontSize: 14,
                    fontWeight: isActive ? 700 : 500,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    letterSpacing: '0.02em',
                    transition: 'all 0.2s',
                    position: 'relative',
                  }}
                >
                  {tab === 'login' ? 'Log In' : 'Sign Up'}
                  {isActive && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: -4,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 24,
                        height: 3,
                        borderRadius: 2,
                        background: t.tabIndicator,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '24px 28px 28px' }}>
          {/* Social Login */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {socialButton(
              'google',
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>,
              'Google',
            )}
            {socialButton(
              'facebook',
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>,
              'Facebook',
            )}
          </div>

          {/* Or divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              margin: '20px 0',
            }}
          >
            <span style={{ flex: 1, height: 1, background: t.dividerLine }} />
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: t.dividerText,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              or
            </span>
            <span style={{ flex: 1, height: 1, background: t.dividerLine }} />
          </div>

          {/* User / Provider toggle (Sign Up only) */}
          {activeTab === 'register' && (
            <div
              style={{
                display: 'flex',
                gap: 10,
                marginBottom: 20,
              }}
            >
              {(['user', 'provider'] as const).map((type) => {
                const isActive = userType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setUserType(type)}
                    style={{
                      flex: 1,
                      padding: '11px 0',
                      borderRadius: 12,
                      border: `1.5px solid ${isActive ? t.toggleActiveBorder : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                      background: isActive ? t.toggleActiveBg : t.toggleBg,
                      color: isActive ? t.toggleActiveText : t.toggleInactiveText,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      transition: 'all 0.2s',
                      letterSpacing: '0.02em',
                    }}
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: `2px solid ${isActive ? t.toggleActiveBorder : (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)')}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      {isActive && (
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: t.toggleDot,
                          }}
                        />
                      )}
                    </span>
                    {type === 'user' ? 'User' : 'Provider'}
                  </button>
                );
              })}
            </div>
          )}

          {/* Form Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeTab === 'login' ? (
              <>
                {renderInput('email', 'Email address', 'email')}
                {renderInput('password', 'Password', 'password')}
              </>
            ) : (
              <>
                {renderInput('name', 'Full name')}
                {renderInput('email', 'Email address', 'email')}
                {userType === 'provider' && (
                  <>
                    {renderInput('orgName', 'Organization name')}
                    {renderInput('roleTitle', 'Your role / title')}
                  </>
                )}
                {renderInput('password', 'Password', 'password')}
                {renderInput('confirmPassword', 'Confirm password', 'password')}

                {/* Accept terms */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    cursor: 'pointer',
                    fontSize: 13,
                    color: t.textSecondary,
                    marginTop: 4,
                    lineHeight: 1.5,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    style={{
                      width: 17,
                      height: 17,
                      borderRadius: 5,
                      accentColor: '#FFD600',
                      cursor: 'pointer',
                      marginTop: 2,
                      flexShrink: 0,
                    }}
                  />
                  <span>
                    I agree to the{' '}
                    <a href="/terms" style={{ color: t.link, textDecoration: 'none', fontWeight: 500 }}>
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="/privacy" style={{ color: t.link, textDecoration: 'none', fontWeight: 500 }}>
                      Privacy Policy
                    </a>
                  </span>
                </label>
              </>
            )}
          </div>

          {/* Error message */}
          {(formError || (activeTab === 'login' && authError)) && (
            <div style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 10,
              background: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.2)'}`,
              color: isDark ? '#fca5a5' : '#dc2626',
              fontSize: 13,
              fontWeight: 500,
            }}>
              {formError || authError}
            </div>
          )}

          {/* Forgot password (login only) */}
          {activeTab === 'login' && (
            <div style={{ textAlign: 'right', marginTop: 10 }}>
              <a
                href="/forgot-password"
                style={{
                  fontSize: 13,
                  color: t.link,
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                Forgot password?
              </a>
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 12,
              border: 'none',
              background: t.submitBg,
              color: t.submitText,
              fontSize: 15,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              marginTop: 22,
              letterSpacing: '0.02em',
              boxShadow: t.submitShadow,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = isDark
                ? '0 6px 24px rgba(255,214,0,0.35)'
                : '0 6px 20px rgba(255,214,0,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = t.submitShadow;
            }}
          >
            {isSubmitting ? 'Logging in…' : activeTab === 'login' ? 'Log In' : 'Create Account'}
          </button>

          {/* Toggle between login/register */}
          <p
            style={{
              textAlign: 'center',
              marginTop: 18,
              marginBottom: 0,
              fontSize: 13,
              color: t.textMuted,
            }}
          >
            {activeTab === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => setActiveTab('register')}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: t.link,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    padding: 0,
                  }}
                >
                  Sign Up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => setActiveTab('login')}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: t.link,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    padding: 0,
                  }}
                >
                  Log In
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

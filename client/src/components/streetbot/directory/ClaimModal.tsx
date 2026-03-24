import { useEffect, useState } from 'react';

type ListingClaim = {
  id: string | number;
  mongo_id?: string;
  service_id: number;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  claimant_name?: string;
  claimant_email?: string;
  claimant_role?: string;
  organization?: string;
  notes?: string;
  service_name?: string;
  service_city?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  serviceId: number | string;
  serviceName: string;
  serviceCity?: string;
  token?: string | null;
  defaultName?: string;
  defaultEmail?: string;
  defaultRole?: string;
  defaultOrgName?: string;
  onSuccess?: (claim: ListingClaim) => void;
};

export default function ClaimModal({
  isOpen,
  onClose,
  serviceId,
  serviceName,
  serviceCity,
  token = null,
  defaultName = '',
  defaultEmail = '',
  defaultRole = '',
  defaultOrgName = '',
  onSuccess,
}: Props) {
  const [claimantName, setClaimantName] = useState(defaultName);
  const [claimantEmail, setClaimantEmail] = useState(defaultEmail);
  const [claimantRole, setClaimantRole] = useState(defaultRole);
  const [organization, setOrganization] = useState(defaultOrgName);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setClaimantName(defaultName);
    setClaimantEmail(defaultEmail);
    setClaimantRole(defaultRole);
    setOrganization(defaultOrgName);
    setNotes('');
    setError(null);
    setSubmitting(false);
  }, [defaultEmail, defaultName, defaultOrgName, defaultRole, isOpen]);

  const buildHeaders = (authToken?: string | null) => ({
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  });

  const requestFreshToken = async () => {
    const response = await fetch('/api/auth/refresh?retry=1', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    return typeof payload?.token === 'string' && payload.token ? payload.token : null;
  };

  const submitClaimRequest = async (authToken?: string | null) => {
    const response = await fetch('/api/claims', {
      method: 'POST',
      credentials: 'include',
      headers: buildHeaders(authToken),
      body: JSON.stringify({
        service_id: Number(serviceId),
        claimant_name: claimantName.trim(),
        claimant_email: claimantEmail.trim(),
        claimant_role: claimantRole.trim(),
        organization: organization.trim(),
        notes: notes.trim(),
        service_name: serviceName,
        service_city: serviceCity,
      }),
    });

    const payload = await response.json().catch(() => null);
    return { response, payload };
  };

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }

    if (!claimantName.trim()) {
      setError('Enter your name.');
      return;
    }

    if (!claimantEmail.trim()) {
      setError('Enter your email.');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(claimantEmail.trim())) {
      setError('Enter a valid email address.');
      return;
    }

    if (!claimantRole.trim()) {
      setError('Enter your role.');
      return;
    }

    if (!organization.trim()) {
      setError('Enter your organization.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let authToken = token;
      let { response, payload } = await submitClaimRequest(authToken);

      if ((response.status === 401 || response.status === 403) && !response.ok) {
        authToken = await requestFreshToken();

        if (!authToken) {
          throw new Error('Your session expired. Sign in again and retry.');
        }

        ({ response, payload } = await submitClaimRequest(authToken));
      }

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
      }

      onSuccess?.(payload as ListingClaim);
      onClose();
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(520px, 100%)',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.16)',
          background: 'rgba(20,24,37,0.98)',
          color: '#fff',
          padding: 20,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 20 }}>Claim listing</h3>
        <p style={{ margin: '8px 0 14px', color: 'rgba(255,255,255,0.72)' }}>
          Request ownership access for <strong>{serviceName}</strong>.
        </p>
        {error ? (
          <div
            style={{
              marginBottom: 12,
              borderRadius: 10,
              border: '1px solid rgba(248,113,113,0.45)',
              background: 'rgba(127,29,29,0.35)',
              color: '#fecaca',
              padding: '10px 12px',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}
        <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Name</label>
        <input
          value={claimantName}
          onChange={(event) => setClaimantName(event.target.value)}
          autoComplete="name"
          style={{
            width: '100%',
            marginBottom: 12,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.06)',
            color: '#fff',
            padding: '10px 12px',
          }}
        />
        <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Email</label>
        <input
          type="email"
          value={claimantEmail}
          onChange={(event) => setClaimantEmail(event.target.value)}
          autoComplete="email"
          style={{
            width: '100%',
            marginBottom: 12,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.06)',
            color: '#fff',
            padding: '10px 12px',
          }}
        />
        <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Role</label>
        <input
          value={claimantRole}
          onChange={(event) => setClaimantRole(event.target.value)}
          autoComplete="organization-title"
          style={{
            width: '100%',
            marginBottom: 12,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.06)',
            color: '#fff',
            padding: '10px 12px',
          }}
        />
        <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Organization</label>
        <input
          value={organization}
          onChange={(event) => setOrganization(event.target.value)}
          style={{
            width: '100%',
            marginBottom: 12,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.06)',
            color: '#fff',
            padding: '10px 12px',
          }}
        />
        <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Notes</label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          style={{
            width: '100%',
            marginBottom: 14,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.06)',
            color: '#fff',
            padding: '10px 12px',
            resize: 'vertical',
          }}
        />
        <p style={{ margin: '0 0 14px', color: 'rgba(255,255,255,0.62)', fontSize: 12 }}>
          Street Voices will review your request and email you if the claim is approved.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.24)',
              background: 'transparent',
              color: '#fff',
              padding: '10px 14px',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting}
            style={{
              borderRadius: 10,
              border: 'none',
              background: '#f9d900',
              color: '#121212',
              padding: '10px 14px',
              fontWeight: 700,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Submitting…' : 'Submit claim'}
          </button>
        </div>
      </div>
    </div>
  );
}

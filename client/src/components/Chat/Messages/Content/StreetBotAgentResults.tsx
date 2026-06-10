import React, { memo, useMemo, useState } from 'react';
import Building2 from 'lucide-react/dist/esm/icons/building-2';
import Briefcase from 'lucide-react/dist/esm/icons/briefcase';
import Camera from 'lucide-react/dist/esm/icons/camera';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import Clock from 'lucide-react/dist/esm/icons/clock';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import Eye from 'lucide-react/dist/esm/icons/eye';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import GraduationCap from 'lucide-react/dist/esm/icons/graduation-cap';
import Heart from 'lucide-react/dist/esm/icons/heart';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Share2 from 'lucide-react/dist/esm/icons/share-2';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import { getCourseCardArt } from '~/components/streetbot/academy/academyCardArt';
import { PIPELINE_STAGES } from '~/components/streetbot/grantwriter/grantTypes';

type StreetBotAgentPayload = {
  kind?: string;
  title?: string;
  total?: number;
  source?: {
    app?: string;
    href?: string;
  };
  items?: Record<string, unknown>[];
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const normalizedKey = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, '');

const valueFor = (item: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(item, key) && item[key] != null) {
      return item[key];
    }
  }

  const normalized = new Map<string, unknown>();
  for (const [key, value] of Object.entries(item)) {
    if (value != null) {
      normalized.set(normalizedKey(key), value);
    }
  }

  for (const key of keys) {
    const value = normalized.get(normalizedKey(key));
    if (value != null) {
      return value;
    }
  }

  return undefined;
};

const firstString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return '';
};

const firstNumber = (...values: unknown[]): number => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return 0;
};

const firstBoolean = (...values: unknown[]): boolean => {
  for (const value of values) {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string' && value.trim()) {
      return /^(1|true|yes|y|on)$/i.test(value.trim());
    }
  }
  return false;
};

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => firstString(item)).filter(Boolean)
    : typeof value === 'string'
      ? value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

const normalizeImageUrl = (value: unknown): string => {
  const url = firstString(value);
  if (!url) {
    return '';
  }
  if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('/')) {
    return url;
  }
  return `/${url}`;
};

const formatCount = (value: unknown): string => firstNumber(value).toLocaleString();

const compactDate = (value: unknown): string => {
  const text = firstString(value);
  if (!text) {
    return '';
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatPrice = (price: unknown, currency: unknown): string => {
  const text = firstString(price);
  if (!text) {
    return '';
  }
  const code = firstString(currency, 'CAD');
  const numeric = Number(text);
  if (Number.isFinite(numeric)) {
    try {
      return new Intl.NumberFormat([], { style: 'currency', currency: code }).format(numeric);
    } catch {
      return `${numeric.toLocaleString()} ${code}`;
    }
  }
  return text;
};

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="text-white/72 rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-semibold">
    {children}
  </span>
);

const JobCard = ({ item }: { item: Record<string, unknown> }) => {
  const title = firstString(valueFor(item, 'title'), 'Job opportunity');
  const organization = firstString(valueFor(item, 'organization', 'company'), 'Street Voices');
  const href = firstString(valueFor(item, 'href'), firstString(valueFor(item, 'id')) ? `/jobs/${encodeURIComponent(firstString(valueFor(item, 'id')))}` : '/jobs');
  const tags = stringList(valueFor(item, 'tags')).slice(0, 5);
  const location = firstString(valueFor(item, 'location'));
  const compensation = firstString(valueFor(item, 'compensation', 'salary_range', 'salaryRange'));
  const type = firstString(valueFor(item, 'opportunity_type', 'opportunityType', 'type'), 'Opportunity');
  const workMode = firstString(valueFor(item, 'work_mode', 'workMode'));
  const hours = firstString(valueFor(item, 'hours_per_week', 'hoursPerWeek'));
  const description = firstString(valueFor(item, 'description', 'summary'));
  const logo = normalizeImageUrl(valueFor(item, 'logo_url', 'logoUrl')) || '/job-logos/default-job.svg';
  const verified = firstBoolean(valueFor(item, 'employer_verified', 'employerVerified'));
  const featured = firstBoolean(valueFor(item, 'is_featured', 'isFeatured'));
  const creative = firstBoolean(valueFor(item, 'is_creative_opportunity', 'isCreativeOpportunity'));
  const training = firstBoolean(valueFor(item, 'training_provided', 'trainingProvided'));
  const noExperience = firstBoolean(valueFor(item, 'no_experience_required', 'noExperienceRequired'));
  const mediaGig = firstBoolean(valueFor(item, 'is_media_gig', 'isMediaGig'));
  const blackLed = firstBoolean(valueFor(item, 'black_led_organization', 'blackLedOrganization'));
  const [logoSrc, setLogoSrc] = useState(logo);

  return (
    <a
      href={href}
      data-testid="streetbot-job-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 24,
        border: featured ? '2px solid rgba(255,214,0,0.4)' : '1px solid rgba(255,255,255,0.15)',
        background: featured
          ? 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(255,214,0,0.08) 100%)'
          : 'rgba(255,255,255,0.06)',
        boxShadow: featured
          ? '0 8px 32px rgba(0,0,0,0.3), 0 0 20px rgba(255,214,0,0.15)'
          : '0 8px 32px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        color: '#fff',
        textDecoration: 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        whiteSpace: 'normal',
      }}
    >
      <div
        style={{
          position: 'relative',
          height: 160,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        <img
          src={logoSrc}
          alt={`${organization} logo`}
          loading="lazy"
          decoding="async"
          onError={() => setLogoSrc('/job-logos/default-job.svg')}
          style={{
            maxWidth: '85%',
            maxHeight: 120,
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            borderRadius: 9999,
            background: '#FFD600',
            padding: '6px 12px',
            color: '#000',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {featured ? <Sparkles size={12} /> : null}
          {featured ? 'Featured' : type}
        </span>
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6 }}>
          <span
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Heart size={18} />
          </span>
          <span
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Share2 size={18} />
          </span>
        </div>
        {verified ? (
          <span
            style={{
              position: 'absolute',
              bottom: -14,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 9999,
              background: '#3b82f6',
              color: '#fff',
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(0,0,0,0.24)',
            }}
          >
            <CheckCircle2 size={14} />
            Verified
          </span>
        ) : null}
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        <div style={{ textAlign: 'center', paddingTop: verified ? 8 : 0 }}>
          <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: 18, fontWeight: 700, lineHeight: 1.25 }}>
            {title}
          </h3>
          {organization ? (
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{organization}</p>
          ) : null}
        </div>
      {description ? (
          <p
            style={{
              margin: 0,
              color: 'rgba(255,255,255,0.7)',
              fontSize: 14,
              lineHeight: 1.6,
              textAlign: 'center',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {description}
          </p>
      ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
          {blackLed ? <JobBadge icon={<Building2 size={12} />} label="Black-Led" bg="linear-gradient(to right, #ec4899, #f43f5e)" /> : null}
          {noExperience ? <JobBadge icon={<Sparkles size={12} />} label="No Experience" bg="linear-gradient(to right, #60a5fa, #22d3ee)" /> : null}
          {training ? <JobBadge icon={<GraduationCap size={12} />} label="Training" bg="linear-gradient(to right, #4ade80, #34d399)" /> : null}
          {creative ? <JobBadge icon={<Palette size={12} />} label="Creative" bg="linear-gradient(to right, #f472b6, #facc15)" /> : null}
          {mediaGig ? <JobBadge icon={<Camera size={12} />} label="Media" bg="linear-gradient(to right, #22d3ee, #6366f1)" /> : null}
          {tags.slice(0, 2).map((tag) => (
            <Chip key={tag}>{tag}</Chip>
          ))}
        </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 12,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.03)',
          color: '#fff',
          fontSize: 13,
        }}
      >
        {location ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} color="#FFD600" style={{ flexShrink: 0 }} />
            <span>{location}</span>
          </div>
        ) : null}
        {compensation ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={16} color="#FFD600" style={{ flexShrink: 0 }} />
            <span>{compensation}</span>
          </div>
        ) : null}
        {workMode ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Briefcase size={16} color="#FFD600" style={{ flexShrink: 0 }} />
            <span>{workMode}</span>
          </div>
        ) : null}
        {hours ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color="#FFD600" style={{ flexShrink: 0 }} />
            <span>{hours}</span>
          </div>
        ) : null}
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', gap: 10, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 14 }}>
        <span
          style={{
            flex: 1,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            padding: '10px 12px',
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          View Details
        </span>
        <span
          style={{
            flex: 1,
            borderRadius: 12,
            border: '1px solid #FFD600',
            background: 'transparent',
            color: '#FFD600',
            padding: '10px 12px',
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Apply Now
        </span>
      </div>
      {compactDate(valueFor(item, 'posting_date', 'postingDate', 'created_at', 'createdAt')) ? (
        <p style={{ margin: '0', color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center' }}>
          Posted: {compactDate(valueFor(item, 'posting_date', 'postingDate', 'created_at', 'createdAt'))}
        </p>
      ) : null}
      </div>
    </a>
  );
};

const JobBadge = ({ icon, label, bg }: { icon: React.ReactNode; label: string; bg: string }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      borderRadius: 9999,
      background: bg,
      padding: '4px 10px',
      color: '#fff',
      fontSize: 11,
      fontWeight: 600,
    }}
  >
    {icon}
    {label}
  </span>
);

const stageColor = (stage: string): string =>
  PIPELINE_STAGES.find((item) => item.id === stage)?.color || '#6b7280';

const stageLabel = (stage: string): string =>
  PIPELINE_STAGES.find((item) => item.id === stage)?.label || stage;

const ArtworkCard = ({ item }: { item: Record<string, unknown> }) => {
  const title = firstString(valueFor(item, 'title'), 'Street Gallery artwork');
  const artist = firstString(valueFor(item, 'artist_name', 'artistName', 'artist'), 'Street Voices artist');
  const image = normalizeImageUrl(valueFor(item, 'thumbnail_url', 'thumbnailUrl', 'image_url', 'imageUrl'));
  const href = firstString(valueFor(item, 'href'), firstString(valueFor(item, 'id')) ? `/gallery/artwork/${encodeURIComponent(firstString(valueFor(item, 'id')))}` : '/gallery');
  const tags = stringList(valueFor(item, 'tags')).slice(0, 4);
  const medium = firstString(valueFor(item, 'medium'));
  const style = firstString(valueFor(item, 'style'));
  const price = formatPrice(valueFor(item, 'price'), valueFor(item, 'currency'));
  const forSale = firstBoolean(valueFor(item, 'is_for_sale', 'isForSale'));
  const sold = firstBoolean(valueFor(item, 'is_sold', 'isSold'));
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <a
      href={href}
      data-testid="streetbot-art-card"
      style={{
        display: 'block',
        overflow: 'hidden',
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(255,255,255,0.06)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        color: '#fff',
        textDecoration: 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        whiteSpace: 'normal',
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#222' }}>
        {image && !imageFailed ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background:
                'linear-gradient(135deg, rgba(255,214,0,0.20), rgba(119,0,255,0.28), rgba(0,221,255,0.18))',
              color: '#fff',
            }}
          >
            <Palette size={42} />
          </div>
        )}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 36,
            height: 36,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(0,0,0,0.45)',
            color: '#fff',
          }}
        >
          <Heart size={18} />
        </span>
        {forSale && !sold ? (
          <span
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              background: '#FFD700',
              color: '#000',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            FOR SALE
          </span>
        ) : null}
        {sold ? (
          <span
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              background: '#ef4444',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            SOLD
          </span>
        ) : null}
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem', fontWeight: 700, lineHeight: 1.25 }}>
            {title}
          </h3>
          {price ? (
            <span style={{ flexShrink: 0, color: '#FFD700', fontSize: '0.9rem', fontWeight: 700 }}>
              {price}
            </span>
          ) : null}
        </div>
        <p style={{ margin: '0 0 10px 0', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
          by <span style={{ color: '#fff', fontWeight: 600 }}>{artist}</span>
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {medium ? <Chip>{medium.replace('_', ' ')}</Chip> : null}
          {style ? <Chip>{style}</Chip> : null}
          {tags.slice(0, Math.max(0, 4 - Number(Boolean(medium)) - Number(Boolean(style)))).map((tag) => (
            <Chip key={tag}>{tag}</Chip>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Eye size={14} />
            {formatCount(valueFor(item, 'view_count', 'viewCount'))}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Heart size={14} />
            {formatCount(valueFor(item, 'favorite_count', 'favoriteCount'))}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <MessageCircle size={14} />
            {formatCount(valueFor(item, 'comment_count', 'commentCount', 'comments'))}
          </span>
        </div>
      </div>
    </a>
  );
};

const AcademyCard = ({ item }: { item: Record<string, unknown> }) => {
  const title = firstString(valueFor(item, 'title'), 'Academy course');
  const category = firstString(valueFor(item, 'category', 'program'), 'Academy');
  const href = firstString(
    valueFor(item, 'href'),
    firstString(valueFor(item, 'id')) ? `/academy/courses/${encodeURIComponent(firstString(valueFor(item, 'id')))}` : '/academy#courses',
  );
  const tags = stringList(valueFor(item, 'tags', 'paths')).slice(0, 2);
  const description = firstString(valueFor(item, 'description', 'summary'));
  const level = firstString(valueFor(item, 'level'), 'Beginner');
  const duration = firstString(valueFor(item, 'duration'), 'Self-paced');
  const modules = firstString(valueFor(item, 'module_count', 'moduleCount', 'modules'));
  const visual = getCourseCardArt({
    title,
    category,
    description,
    level,
    image_url: firstString(valueFor(item, 'image_url', 'imageUrl', 'cover_url', 'coverUrl')) || null,
    thumbnail_url: firstString(valueFor(item, 'thumbnail_url', 'thumbnailUrl')) || null,
  });
  const [imageSrc, setImageSrc] = useState(normalizeImageUrl(valueFor(item, 'image_url', 'imageUrl', 'cover_url', 'coverUrl', 'thumbnail_url', 'thumbnailUrl')) || visual.src);

  return (
    <a
      href={href}
      data-testid="streetbot-academy-card"
      style={{
        display: 'block',
        borderRadius: 26,
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(255,255,255,0.06)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        padding: 24,
        color: '#fff',
        textDecoration: 'none',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        whiteSpace: 'normal',
      }}
    >
      <div
        style={{
          position: 'relative',
          marginBottom: 20,
          overflow: 'hidden',
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(0,0,0,0.24)',
        }}
      >
        <img
          src={imageSrc}
          alt={title}
          loading="lazy"
          decoding="async"
          onError={() => setImageSrc(visual.fallbackSrc)}
          style={{
            display: 'block',
            width: '100%',
            height: 220,
            objectFit: 'cover',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.45), transparent 62%, transparent)',
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            borderRadius: 9999,
            background: 'rgba(15,23,42,0.65)',
            color: visual.accent,
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          {visual.eyebrow}
        </span>
      </div>
      {tags.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                borderRadius: 9999,
                background: `${visual.accent}22`,
                color: visual.accent,
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Part of {tag}
            </span>
          ))}
        </div>
      ) : null}
      <h3 style={{ margin: 0, color: '#fff', fontSize: 24, fontWeight: 700, lineHeight: 1.18 }}>{title}</h3>
      {description ? (
        <p
          style={{
            margin: '12px 0 0 0',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 14,
            lineHeight: 1.6,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {description}
        </p>
      ) : null}
      <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 12, color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600 }}>
        <span>{level.charAt(0).toUpperCase() + level.slice(1)}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Clock size={14} />
          {duration}
        </span>
        {modules ? <span>{modules} modules</span> : null}
      </div>
      <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 9999,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            padding: '10px 16px',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Learn More
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 9999,
            background: '#FFD600',
            color: '#000',
            padding: '10px 16px',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Sign up Now
          <ExternalLink size={14} style={{ marginLeft: 6 }} />
        </span>
      </div>
    </a>
  );
};

const GrantDocRow = ({ label, exists }: { label: string; exists: boolean }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '5px 0',
      color: exists ? '#f8fafc' : 'rgba(255,255,255,0.45)',
      fontSize: 12,
      fontWeight: exists ? 600 : 500,
    }}
  >
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        border: `1px solid ${exists ? '#22c55e' : 'rgba(255,255,255,0.2)'}`,
        background: exists ? '#22c55e' : 'transparent',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#07120b',
        fontSize: 10,
      }}
    >
      {exists ? '✓' : ''}
    </span>
    {label}
  </div>
);

const GrantMetric = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div style={{ marginBottom: 10 }}>
    <div
      style={{
        marginBottom: 3,
        color: 'rgba(255,255,255,0.48)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
    <div style={{ color, fontSize: 13, fontWeight: 700 }}>{value}</div>
  </div>
);

const GrantCard = ({ item }: { item: Record<string, unknown> }) => {
  const title = firstString(valueFor(item, 'title', 'name'), 'Grant opportunity');
  const funder = firstString(valueFor(item, 'funder'), 'Grant funder');
  const href = firstString(valueFor(item, 'href'), '/grantwriter');
  const sourceUrl = firstString(valueFor(item, 'url', 'source_url', 'sourceUrl'));
  const docs = asRecord(valueFor(item, 'documents'));
  const stage = firstString(valueFor(item, 'stage'), 'identified');
  const color = stageColor(stage);
  const assessment = asRecord(valueFor(item, 'assessment'));
  const recommendation = firstString(valueFor(assessment, 'recommendation'), valueFor(item, 'recommendation'));
  const docsReady = Object.values(docs).filter(Boolean).length;

  return (
    <a
      href={href}
      data-testid="streetbot-grant-card"
      style={{
        display: 'block',
        overflow: 'hidden',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(17,20,27,0.92)',
        color: '#fff',
        textDecoration: 'none',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        whiteSpace: 'normal',
      }}
    >
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
            borderRadius: 12,
            background: `${color}22`,
            color,
            padding: '4px 10px',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
          {stageLabel(stage)}
        </span>
        <h3 style={{ margin: '0 0 4px', color: '#fff', fontSize: 16, fontWeight: 800, lineHeight: 1.3 }}>
          {title}
        </h3>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.48)', fontSize: 13, fontWeight: 600 }}>{funder}</p>
      </div>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {firstString(valueFor(item, 'amount')) ? (
          <GrantMetric label="Amount" value={firstString(valueFor(item, 'amount'))} color="#22c55e" />
        ) : null}
        {firstString(valueFor(item, 'deadline')) ? (
          <GrantMetric label="Deadline" value={firstString(valueFor(item, 'deadline'))} color="#f97316" />
        ) : null}
        {sourceUrl ? (
          <span style={{ color: '#a78bfa', fontSize: 12, fontWeight: 700, textDecoration: 'underline' }}>
            View grant page
          </span>
        ) : null}
      </div>
      {recommendation ? (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ marginBottom: 10, color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Assessment
          </div>
          <div
            style={{
              borderRadius: 8,
              background:
                recommendation === 'pursue'
                  ? 'rgba(34,197,94,0.12)'
                  : recommendation === 'maybe'
                    ? 'rgba(234,179,8,0.12)'
                    : 'rgba(239,68,68,0.12)',
              color:
                recommendation === 'pursue'
                  ? '#22c55e'
                  : recommendation === 'maybe'
                    ? '#eab308'
                    : '#ef4444',
              padding: '7px 10px',
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {recommendation}
          </div>
        </div>
      ) : null}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ marginBottom: 10, color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Documents
        </div>
        <GrantDocRow label="Opportunity Brief" exists={Boolean(docs.opportunity)} />
        <GrantDocRow label="Narrative Draft" exists={Boolean(docs.narrative)} />
        <GrantDocRow label="Budget" exists={Boolean(docs.budget)} />
        <GrantDocRow label="Project Plan" exists={Boolean(docs.projectPlan)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FileText size={14} />
          {docsReady} docs ready
        </span>
        {sourceUrl ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#fde68a' }}>
            <ExternalLink size={14} />
            Source
          </span>
        ) : null}
      </div>
    </a>
  );
};

const renderCard = (kind: string, item: Record<string, unknown>, index: number) => {
  const key = firstString(item.id, item.title, `${kind}-${index}`);
  if (kind === 'jobs') {
    return <JobCard key={key} item={item} />;
  }
  if (kind === 'artworks') {
    return <ArtworkCard key={key} item={item} />;
  }
  if (kind === 'academy_courses') {
    return <AcademyCard key={key} item={item} />;
  }
  if (kind === 'grants') {
    return <GrantCard key={key} item={item} />;
  }
  return <JobCard key={key} item={item} />;
};

const StreetBotAgentResults = memo(({ raw }: { raw: string }) => {
  const payload = useMemo<StreetBotAgentPayload | null>(() => {
    try {
      const parsed = JSON.parse(raw);
      return asRecord(parsed) as StreetBotAgentPayload;
    } catch {
      return null;
    }
  }, [raw]);

  if (!payload) {
    return null;
  }

  const kind = firstString(payload.kind, 'jobs');
  const items = Array.isArray(payload.items) ? payload.items.map(asRecord) : [];
  const source = asRecord(payload.source);
  const sourceHref = firstString(source.href);

  return (
    <section className="not-prose my-4 space-y-3 font-sans" data-testid="streetbot-agent-results">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-bold text-white">
            {firstString(payload.title, kind.replace(/_/g, ' '))}
          </h2>
          {payload.total != null ? (
            <p className="m-0 mt-1 text-xs font-semibold text-white/45">
              {formatCount(payload.total)} total
            </p>
          ) : null}
        </div>
        {sourceHref ? (
          <a
            href={sourceHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-300/25 bg-yellow-300/10 px-3 py-2 text-xs font-bold text-yellow-200 no-underline hover:bg-yellow-300/15"
          >
            Open {firstString(source.app, 'app')}
            <ExternalLink size={13} />
          </a>
        ) : null}
      </div>
      {items.length ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 24,
            whiteSpace: 'normal',
          }}
        >
          {items.slice(0, 6).map((item, index) => renderCard(kind, item, index))}
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-[#11141b]/90 p-4 text-sm font-semibold text-white/60">
          Nothing to show here yet.
        </div>
      )}
    </section>
  );
});

StreetBotAgentResults.displayName = 'StreetBotAgentResults';

export default StreetBotAgentResults;

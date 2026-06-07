import React, { memo, useMemo } from 'react';
import Briefcase from 'lucide-react/dist/esm/icons/briefcase';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import Clock from 'lucide-react/dist/esm/icons/clock';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import Eye from 'lucide-react/dist/esm/icons/eye';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import GraduationCap from 'lucide-react/dist/esm/icons/graduation-cap';
import Heart from 'lucide-react/dist/esm/icons/heart';
import Landmark from 'lucide-react/dist/esm/icons/landmark';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Tag from 'lucide-react/dist/esm/icons/tag';

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

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="text-white/72 rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-semibold">
    {children}
  </span>
);

const IconBadge = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-white">
    {children}
  </div>
);

const JobCard = ({ item }: { item: Record<string, unknown> }) => {
  const title = firstString(item.title, 'Job opportunity');
  const organization = firstString(item.organization, 'Street Voices');
  const href = firstString(item.href, '/jobs');
  const tags = stringList(item.tags).slice(0, 4);
  const location = firstString(item.location);
  const compensation = firstString(item.compensation);
  const type = firstString(item.opportunity_type, item.work_mode);
  const description = firstString(item.description);

  return (
    <a
      href={href}
      className="group block rounded-lg border border-white/10 bg-[#11141b]/90 p-4 text-white no-underline shadow-xl shadow-black/25 backdrop-blur-xl transition hover:border-yellow-300/45 hover:bg-[#171b24]"
      data-testid="streetbot-job-card"
    >
      <div className="mb-3 flex items-start gap-3">
        <IconBadge>
          <Briefcase size={22} />
        </IconBadge>
        <div className="min-w-0">
          <h3 className="m-0 text-base font-bold leading-tight text-white">{title}</h3>
          <p className="text-white/52 m-0 mt-1 text-sm font-semibold">{organization}</p>
        </div>
      </div>
      {description ? (
        <p className="m-0 mb-4 line-clamp-3 text-sm leading-6 text-white/70">{description}</p>
      ) : null}
      {tags.length ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Chip key={tag}>{tag}</Chip>
          ))}
        </div>
      ) : null}
      <div className="text-white/72 space-y-2 rounded-lg bg-white/[0.04] p-3 text-sm font-semibold">
        {location ? (
          <div className="flex items-center gap-2">
            <MapPin size={15} className="text-yellow-300" />
            <span>{location}</span>
          </div>
        ) : null}
        {compensation ? (
          <div className="flex items-center gap-2">
            <Tag size={15} className="text-emerald-300" />
            <span>{compensation}</span>
          </div>
        ) : null}
        {type ? (
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-blue-300" />
            <span>{type}</span>
          </div>
        ) : null}
      </div>
      <div className="text-white/48 mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs font-semibold">
        <span>{compactDate(item.posting_date || item.created_at)}</span>
        {item.employer_verified ? (
          <span className="inline-flex items-center gap-1 text-yellow-200">
            <CheckCircle2 size={14} />
            Verified
          </span>
        ) : null}
      </div>
    </a>
  );
};

const ArtworkCard = ({ item }: { item: Record<string, unknown> }) => {
  const title = firstString(item.title, 'Street Gallery artwork');
  const artist = firstString(item.artist_name, item.artist, 'Street Voices artist');
  const image = normalizeImageUrl(item.thumbnail_url || item.image_url);
  const href = firstString(item.href, '/gallery');
  const tags = stringList(item.tags).slice(0, 4);
  const price = firstString(item.price);
  const currency = firstString(item.currency, 'CAD');
  const description = firstString(item.description);

  return (
    <a
      href={href}
      className="group block overflow-hidden rounded-lg border border-white/10 bg-[#11141b]/90 text-white no-underline shadow-xl shadow-black/25 backdrop-blur-xl transition hover:border-yellow-300/45 hover:bg-[#171b24]"
      data-testid="streetbot-art-card"
    >
      <div className="relative aspect-[16/10] bg-white/[0.04]">
        {image ? (
          <img src={image} alt={title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/55">
            <Palette size={42} />
          </div>
        )}
        {item.is_for_sale ? (
          <span className="absolute left-3 top-3 rounded-md bg-yellow-300 px-2 py-1 text-xs font-black text-black">
            For sale
          </span>
        ) : null}
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="m-0 text-base font-bold leading-tight text-white">{title}</h3>
          <p className="text-white/52 m-0 mt-1 text-sm font-semibold">by {artist}</p>
        </div>
        {description ? (
          <p className="text-white/68 m-0 line-clamp-2 text-sm leading-5">{description}</p>
        ) : null}
        {tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Chip key={tag}>{tag}</Chip>
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs font-semibold text-white/50">
          <span className="inline-flex items-center gap-1.5">
            <Eye size={14} />
            {formatCount(item.view_count)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Heart size={14} />
            {formatCount(item.favorite_count)}
          </span>
          {price ? (
            <span className="text-yellow-200">
              {price} {currency}
            </span>
          ) : null}
        </div>
      </div>
    </a>
  );
};

const AcademyCard = ({ item }: { item: Record<string, unknown> }) => {
  const title = firstString(item.title, 'Academy course');
  const program = firstString(item.program, 'Street Voices Academy');
  const href = firstString(item.href, '/academy/courses');
  const tags = stringList(item.tags).slice(0, 4);
  const description = firstString(item.description);

  return (
    <a
      href={href}
      className="group block rounded-lg border border-white/10 bg-[#11141b]/90 p-4 text-white no-underline shadow-xl shadow-black/25 backdrop-blur-xl transition hover:border-yellow-300/45 hover:bg-[#171b24]"
      data-testid="streetbot-academy-card"
    >
      <div className="mb-3 flex items-start gap-3">
        <IconBadge>
          <GraduationCap size={24} />
        </IconBadge>
        <div className="min-w-0">
          <h3 className="m-0 text-base font-bold leading-tight text-white">{title}</h3>
          <p className="text-white/52 m-0 mt-1 text-sm font-semibold">{program}</p>
        </div>
      </div>
      {description ? (
        <p className="m-0 mb-4 line-clamp-3 text-sm leading-6 text-white/70">{description}</p>
      ) : null}
      <div className="mb-4 grid gap-2 text-sm font-semibold text-white/70">
        {firstString(item.level) ? (
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={15} className="text-yellow-300" />
            {firstString(item.level)}
          </span>
        ) : null}
        {firstString(item.duration) ? (
          <span className="inline-flex items-center gap-2">
            <CalendarDays size={15} className="text-blue-300" />
            {firstString(item.duration)}
          </span>
        ) : null}
        {firstString(item.schedule) ? (
          <span className="inline-flex items-center gap-2">
            <Clock size={15} className="text-emerald-300" />
            {firstString(item.schedule)}
          </span>
        ) : null}
      </div>
      {tags.length ? (
        <div className="flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
          {tags.map((tag) => (
            <Chip key={tag}>{tag}</Chip>
          ))}
        </div>
      ) : null}
    </a>
  );
};

const GrantCard = ({ item }: { item: Record<string, unknown> }) => {
  const title = firstString(item.title, item.name, 'Grant opportunity');
  const funder = firstString(item.funder, 'Grant funder');
  const href = firstString(item.href, '/grantwriter');
  const docs = asRecord(item.documents);
  const docsReady = Object.values(docs).filter(Boolean).length;

  return (
    <a
      href={href}
      className="group block rounded-lg border border-white/10 bg-[#11141b]/90 p-4 text-white no-underline shadow-xl shadow-black/25 backdrop-blur-xl transition hover:border-yellow-300/45 hover:bg-[#171b24]"
      data-testid="streetbot-grant-card"
    >
      <div className="mb-3 flex items-start gap-3">
        <IconBadge>
          <Landmark size={23} />
        </IconBadge>
        <div className="min-w-0">
          <h3 className="m-0 text-base font-bold leading-tight text-white">{title}</h3>
          <p className="text-white/52 m-0 mt-1 text-sm font-semibold">{funder}</p>
        </div>
      </div>
      <div className="text-white/72 grid gap-2 rounded-lg bg-white/[0.04] p-3 text-sm font-semibold">
        {firstString(item.amount) ? (
          <span className="inline-flex items-center gap-2">
            <Tag size={15} className="text-yellow-300" />
            {firstString(item.amount)}
          </span>
        ) : null}
        {firstString(item.deadline) ? (
          <span className="inline-flex items-center gap-2">
            <CalendarDays size={15} className="text-blue-300" />
            {firstString(item.deadline)}
          </span>
        ) : null}
        {firstString(item.stage) ? (
          <span className="inline-flex items-center gap-2">
            <Clock size={15} className="text-emerald-300" />
            {firstString(item.stage)}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs font-semibold text-white/50">
        <span className="inline-flex items-center gap-1.5">
          <FileText size={14} />
          {docsReady} docs ready
        </span>
        {firstString(item.url) ? (
          <span className="inline-flex items-center gap-1.5 text-yellow-200">
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" style={{ whiteSpace: 'normal' }}>
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

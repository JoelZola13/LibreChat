import React, { memo, useMemo } from 'react';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import Clock from 'lucide-react/dist/esm/icons/clock';
import Heart from 'lucide-react/dist/esm/icons/heart';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle';
import Users from 'lucide-react/dist/esm/icons/users';
import UserRound from 'lucide-react/dist/esm/icons/user-round';

type StreetProfilePayload = {
  kind?: string;
  title?: string;
  total?: number;
  summary?: Record<string, unknown>;
  items?: Record<string, unknown>[];
  sections?: {
    kind?: string;
    title?: string;
    total?: number;
    items?: Record<string, unknown>[];
  }[];
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

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

const formatCount = (value: unknown): string => firstNumber(value).toLocaleString();

const formatDate = (value: unknown): string => {
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

const normalizeImageUrl = (value: unknown): string => {
  const url = firstString(value);
  if (!url) {
    return '';
  }
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) {
    return url;
  }
  if (url.startsWith('/')) {
    return url;
  }
  return `/${url}`;
};

const initialsFor = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SV';

const ProfileCard = ({ item }: { item: Record<string, unknown> }) => {
  const name = firstString(item.display_name, item.name, item.username, 'Street Profile');
  const username = firstString(item.username);
  const avatar = normalizeImageUrl(item.avatar_url || item.avatarUrl || item.image_url);
  const roles = stringList(item.primary_roles || item.roles || item.tags).slice(0, 3);
  const location = firstString(item.location_display, item.location, item.city);
  const tagline = firstString(item.tagline, item.bio, item.description);
  const href = username ? `/creatives/${encodeURIComponent(username)}` : '/profile';
  const followers = firstNumber(item.followers_count, item.followers);

  return (
    <a
      href={href}
      className="group block overflow-hidden rounded-lg border border-white/10 bg-[#11141b]/90 text-white no-underline shadow-xl shadow-black/25 backdrop-blur-xl transition hover:border-yellow-300/45 hover:bg-[#171b24]"
      data-testid="street-profile-card"
    >
      <div className="relative aspect-[16/10] bg-white/[0.04]">
        {avatar ? (
          <img src={avatar} alt={name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500 to-pink-500 text-5xl font-black text-black/25">
            {initialsFor(name)}
          </div>
        )}
        {item.is_verified ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-xs font-bold text-yellow-200 backdrop-blur">
            <CheckCircle2 size={13} />
            Verified
          </span>
        ) : null}
      </div>
      <div className="space-y-3 p-4">
        <div className="min-w-0">
          <h3 className="m-0 truncate text-base font-bold leading-tight text-white">{name}</h3>
          {username ? <p className="m-0 mt-1 text-sm font-medium text-white/55">@{username}</p> : null}
        </div>
        {roles.length ? (
          <div className="flex flex-wrap gap-1.5">
            {roles.map((role) => (
              <span
                key={role}
                className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-semibold text-white/75"
              >
                {role}
              </span>
            ))}
          </div>
        ) : null}
        {tagline ? <p className="m-0 line-clamp-2 text-sm leading-5 text-white/68">{tagline}</p> : null}
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs font-semibold text-white/55">
          {location ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin size={14} className="shrink-0" />
              <span className="truncate">{location}</span>
            </span>
          ) : (
            <span />
          )}
          {followers > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} />
              {formatCount(followers)}
            </span>
          ) : null}
        </div>
      </div>
    </a>
  );
};

const GroupCard = ({ item }: { item: Record<string, unknown> }) => {
  const name = firstString(item.name, item.slug, 'Street Profile Group');
  const description = firstString(item.description, item.last_message, item.summary);
  const id = firstString(item.id, item.slug);
  const href = id ? `/groups/${encodeURIComponent(id)}` : '/groups';

  return (
    <a
      href={href}
      className="block rounded-lg border border-white/10 bg-[#11141b]/90 p-4 text-white no-underline shadow-xl shadow-black/25 backdrop-blur-xl transition hover:border-yellow-300/45 hover:bg-[#171b24]"
      data-testid="street-profile-group-card"
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-white">
          <Users size={22} />
        </div>
        <div className="min-w-0">
          <h3 className="m-0 text-base font-bold leading-tight text-white">{name}</h3>
          <p className="m-0 mt-1 text-xs font-semibold uppercase text-white/45">
            {firstString(item.type, 'channel')}
          </p>
        </div>
      </div>
      {description ? <p className="m-0 mb-4 line-clamp-3 text-sm leading-6 text-white/68">{description}</p> : null}
      <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3 text-xs font-semibold text-white/60">
        <span className="inline-flex items-center gap-1.5">
          <Users size={14} />
          {formatCount(item.member_count)} members
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MessageCircle size={14} />
          {formatCount(item.message_count)} messages
        </span>
      </div>
    </a>
  );
};

const MessageCard = ({ item }: { item: Record<string, unknown> }) => {
  const author = firstString(item.display_name, item.author, item.username, 'Street Profile user');
  const channel = firstString(item.channel_name, item.channel_slug, 'Messages');
  const content = firstString(item.content, item.text, item.summary);

  return (
    <article
      className="rounded-lg border border-white/10 bg-[#11141b]/90 p-4 text-white shadow-xl shadow-black/25 backdrop-blur-xl"
      data-testid="street-profile-message-card"
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/25 text-blue-100">
          <UserRound size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="m-0 truncate text-sm font-bold text-white">{author}</h3>
          <p className="m-0 mt-0.5 truncate text-xs font-semibold text-white/48">{channel}</p>
        </div>
      </div>
      {content ? <p className="m-0 line-clamp-4 text-sm leading-6 text-white/72">{content}</p> : null}
      {firstString(item.created_at, item.updated_at) ? (
        <div className="mt-3 flex items-center gap-1.5 border-t border-white/10 pt-3 text-xs font-semibold text-white/45">
          <Clock size={14} />
          {formatDate(item.created_at || item.updated_at)}
        </div>
      ) : null}
    </article>
  );
};

const PostCard = ({ item }: { item: Record<string, unknown> }) => {
  const title = firstString(item.title, item.category_name, 'Word on the Street');
  const author = firstString(item.author_name, item.display_name, item.username, 'Street Voices');
  const content = firstString(item.content_preview, item.content, item.summary);

  return (
    <article
      className="rounded-lg border border-white/10 bg-[#11141b]/90 p-4 text-white shadow-xl shadow-black/25 backdrop-blur-xl"
      data-testid="street-profile-post-card"
    >
      <div className="mb-3">
        <h3 className="m-0 text-base font-bold leading-tight text-white">{title}</h3>
        <p className="m-0 mt-1 text-sm font-semibold text-white/50">by {author}</p>
      </div>
      {content ? <p className="m-0 line-clamp-4 text-sm leading-6 text-white/72">{content}</p> : null}
      <div className="mt-3 flex flex-wrap gap-3 border-t border-white/10 pt-3 text-xs font-semibold text-white/50">
        <span className="inline-flex items-center gap-1.5">
          <Heart size={14} />
          {formatCount(item.like_count)} likes
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MessageCircle size={14} />
          {formatCount(item.comment_count || item.reply_count)} replies
        </span>
      </div>
    </article>
  );
};

const renderCard = (kind: string, item: Record<string, unknown>, index: number) => {
  const key = firstString(item.id, item.username, item.slug, `${kind}-${index}`);
  if (kind === 'profiles') {
    return <ProfileCard key={key} item={item} />;
  }
  if (kind === 'groups') {
    return <GroupCard key={key} item={item} />;
  }
  if (kind === 'messages') {
    return <MessageCard key={key} item={item} />;
  }
  return <PostCard key={key} item={item} />;
};

const StreetProfileResults = memo(({ raw }: { raw: string }) => {
  const payload = useMemo<StreetProfilePayload | null>(() => {
    try {
      const parsed = JSON.parse(raw);
      return asRecord(parsed) as StreetProfilePayload;
    } catch {
      return null;
    }
  }, [raw]);

  if (!payload) {
    return null;
  }

  const sections =
    Array.isArray(payload.sections) && payload.sections.length
      ? payload.sections
      : [
          {
            kind: payload.kind || 'profiles',
            title: payload.title,
            total: payload.total,
            items: payload.items || [],
          },
        ];

  return (
    <div className="not-prose my-4 space-y-5 font-sans" data-testid="street-profile-results">
      {sections.map((section, sectionIndex) => {
        const kind = firstString(section.kind, 'profiles');
        const items = Array.isArray(section.items) ? section.items.map(asRecord) : [];
        const title = firstString(section.title, kind.replace(/_/g, ' '));
        return (
          <section key={`${kind}-${sectionIndex}`} className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="m-0 text-base font-bold capitalize text-white">{title}</h2>
                {section.total != null ? (
                  <p className="m-0 mt-1 text-xs font-semibold text-white/45">
                    {formatCount(section.total)} total
                  </p>
                ) : null}
              </div>
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
      })}
    </div>
  );
});

StreetProfileResults.displayName = 'StreetProfileResults';

export default StreetProfileResults;

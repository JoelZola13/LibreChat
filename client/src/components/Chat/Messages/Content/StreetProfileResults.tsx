import React, { memo, useMemo, useState } from 'react';
import Bookmark from 'lucide-react/dist/esm/icons/bookmark';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import Eye from 'lucide-react/dist/esm/icons/eye';
import Heart from 'lucide-react/dist/esm/icons/heart';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal';
import Repeat2 from 'lucide-react/dist/esm/icons/repeat-2';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Users from 'lucide-react/dist/esm/icons/users';

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

const normalizedKey = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, '');

const normalizeResultKind = (kind: string): string => {
  const normalized = normalizedKey(kind);
  if (normalized.includes('profile')) {
    return 'profiles';
  }
  if (normalized.includes('group')) {
    return 'groups';
  }
  if (normalized.includes('message') || normalized.includes('direct') || normalized.includes('dm')) {
    return 'messages';
  }
  if (normalized.includes('post') || normalized.includes('wordonthestreet') || normalized.includes('forum')) {
    return 'posts';
  }
  return normalized || 'profiles';
};

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

const colorFromString = (value: string): string => {
  const palette = ['#7C3AED', '#2563EB', '#0891B2', '#059669', '#D97706', '#BE185D', '#4F46E5'];
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
};

const AvatarBubble = ({
  name,
  src,
  size = 42,
}: {
  name: string;
  src?: string;
  size?: number;
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const color = colorFromString(name || 'Street Voices');

  if (src && !imageFailed) {
    return (
      <span
        style={{
          display: 'inline-flex',
          width: size,
          height: size,
          flexShrink: 0,
          overflow: 'hidden',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.16)',
          background: 'rgba(255,255,255,0.08)',
        }}
      >
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        width: size,
        height: size,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${color}, rgba(255,214,0,0.24))`,
        color: '#F6F7FB',
        fontSize: Math.max(12, Math.floor(size * 0.28)),
        fontWeight: 900,
        border: '1px solid rgba(255,255,255,0.14)',
      }}
    >
      {initialsFor(name)}
    </span>
  );
};

const ProfileCard = ({ item }: { item: Record<string, unknown> }) => {
  const name = firstString(valueFor(item, 'display_name', 'displayName', 'name'), valueFor(item, 'username'), 'Street Profile');
  const username = firstString(valueFor(item, 'username', 'handle'));
  const avatar = normalizeImageUrl(valueFor(item, 'avatar_url', 'avatarUrl', 'image_url', 'imageUrl', 'profile_image_url'));
  const roles = stringList(valueFor(item, 'primary_roles', 'primaryRoles', 'roles', 'tags')).slice(0, 3);
  const location = firstString(valueFor(item, 'location_display', 'locationDisplay', 'location', 'city'));
  const href = username ? `/profiles/${encodeURIComponent(username)}` : '/profiles';
  const followers = firstNumber(valueFor(item, 'followers_count', 'followersCount', 'followers'));
  const verified = firstBoolean(valueFor(item, 'is_verified', 'isVerified', 'verified'));
  const featured = firstBoolean(valueFor(item, 'is_featured', 'isFeatured', 'featured'));
  const avatarQuality = firstString(valueFor(item, 'avatar_quality', 'avatarQuality'));
  const avatarFrameSize = avatarQuality.startsWith('instagram') ? 138 : 168;
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <a
      href={href}
      data-testid="street-profile-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 450,
        minHeight: 450,
        overflow: 'hidden',
        position: 'relative',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(255,255,255,0.06)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        color: '#fff',
        textDecoration: 'none',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        whiteSpace: 'normal',
      }}
    >
      <div
        style={{
          height: '50%',
          position: 'relative',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at center, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 58%, rgba(255,255,255,0.015) 100%)',
        }}
      >
        {avatar && !avatarFailed ? (
          <div
            style={{
              width: avatarFrameSize,
              height: avatarFrameSize,
              maxWidth: '58%',
              maxHeight: '78%',
              borderRadius: '50%',
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.18)',
              boxShadow: '0 18px 42px rgba(0,0,0,0.35)',
            }}
          >
            <img
              src={avatar}
              alt={name}
              loading="lazy"
              decoding="async"
              onError={() => setAvatarFailed(true)}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                objectFit: 'cover',
              }}
            />
          </div>
        ) : (
          <div
            style={{
              width: avatarFrameSize,
              height: avatarFrameSize,
              maxWidth: '58%',
              maxHeight: '78%',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FFD600 0%, #ff8800 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 56,
              fontWeight: 800,
              color: 'rgba(0,0,0,0.18)',
              boxShadow: '0 18px 42px rgba(0,0,0,0.35)',
            }}
          >
            {initialsFor(name)}
          </div>
        )}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 10,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Bookmark size={18} />
        </span>
        {featured ? (
          <span
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              zIndex: 10,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              background: '#FFD600',
              color: '#000',
              fontSize: 12,
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <Sparkles size={14} />
            Featured
          </span>
        ) : null}
      </div>
      <div
        style={{
          height: '50%',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, minWidth: 0 }}>
            <h3
              style={{
                margin: 0,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '1.25rem',
                fontWeight: 700,
                lineHeight: 1.2,
                color: '#fff',
                textDecoration: 'none',
              }}
            >
              {name}
            </h3>
            {verified ? <CheckCircle2 size={18} color="#FFD600" fill="#FFD600" style={{ flexShrink: 0 }} /> : null}
          </div>
          {username ? (
            <p
              style={{
                margin: '0 0 12px 0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              @{username}
            </p>
          ) : null}
          {roles.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {roles.map((role) => (
                <span
                  key={role}
                  style={{
                    borderRadius: 100,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.08)',
                    padding: '4px 10px',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 12,
                    fontWeight: 500,
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  {role}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            borderTop: '1px solid rgba(255,255,255,0.15)',
            paddingTop: 16,
            color: 'rgba(255,255,255,0.7)',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {location ? (
            <span style={{ display: 'inline-flex', minWidth: 0, alignItems: 'center', gap: 6 }}>
              <MapPin size={14} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{location}</span>
            </span>
          ) : (
            <span />
          )}
          {followers > 0 ? (
            <span style={{ display: 'inline-flex', flexShrink: 0, alignItems: 'center', gap: 6 }}>
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
  const name = firstString(valueFor(item, 'name', 'title'), valueFor(item, 'slug'), 'Street Profile Group');
  const description = firstString(valueFor(item, 'description', 'last_message', 'lastMessage', 'summary'), 'No description');
  const id = firstString(valueFor(item, 'id', 'slug'));
  const href = id ? `/groups/${encodeURIComponent(id)}` : '/groups';
  const avatar = normalizeImageUrl(valueFor(item, 'avatar_url', 'avatarUrl', 'image_url', 'imageUrl', 'cover_url', 'coverUrl'));
  const tags = stringList(valueFor(item, 'tags')).slice(0, 4);
  const isMember = firstBoolean(valueFor(item, 'is_member', 'isMember', 'joined'));
  const memberCount = firstNumber(valueFor(item, 'member_count', 'memberCount', 'members'));
  const messageCount = firstNumber(valueFor(item, 'message_count', 'messageCount', 'messages'));
  const theme = colorFromString(name);
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <a
      href={href}
      data-testid="street-profile-group-card"
      style={{
        display: 'flex',
        minHeight: 326,
        overflow: 'hidden',
        flexDirection: 'column',
        position: 'relative',
        borderRadius: 13,
        border: '1px solid rgba(255,255,255,0.14)',
        background: 'rgba(255,255,255,0.06)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        color: '#F6F7FB',
        textDecoration: 'none',
        whiteSpace: 'normal',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      }}
    >
      <div
        style={{
          position: 'relative',
          height: 138,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          background: avatar && !avatarFailed ? 'rgba(255,255,255,0.08)' : theme,
        }}
      >
        {avatar && !avatarFailed ? (
          <>
            <img
              src={avatar}
              alt={name}
              loading="lazy"
              decoding="async"
              onError={() => setAvatarFailed(true)}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(4,8,18,0.05), rgba(9,12,28,0.46))',
              }}
            />
          </>
        ) : (
          <Users size={38} color="#fff" />
        )}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 16,
            bottom: -2,
            width: 42,
            height: 42,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            background: 'rgba(8,10,18,0.72)',
            border: '1px solid rgba(255,255,255,0.72)',
            fontSize: 12,
            fontWeight: 900,
            backdropFilter: 'blur(10px)',
          }}
        >
          {initialsFor(name)}
        </span>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 31,
            height: 28,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.16)',
            background: 'rgba(17,19,30,0.45)',
            color: 'rgba(255,255,255,0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}
        >
          <MoreHorizontal size={18} />
        </span>
      </div>
      <div style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column', padding: '18px 20px 0' }}>
        <h3 style={{ margin: '0 0 8px', color: '#F6F7FB', fontSize: '1.18rem', lineHeight: 1.18, fontWeight: 900 }}>
          {name}
        </h3>
        <p
          style={{
            margin: '0 0 12px',
            color: 'rgba(238,240,250,0.74)',
            fontSize: 14,
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {description}
        </p>
        {tags.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginBottom: 14 }}>
            {tags.map((tag) => (
              <span
                key={tag}
                style={{
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '5px 13px',
                  color: 'rgba(238,240,250,0.68)',
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderTop: '1px solid rgba(255,255,255,0.12)',
          padding: isMember ? '12px 20px 13px' : '0 20px 14px',
          marginTop: 'auto',
          color: 'rgba(238,240,250,0.72)',
          fontSize: 13,
        }}
      >
        {isMember ? (
          <>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#F6F7FB', fontWeight: 900 }}>
              <MessageCircle size={18} />
              Messages
            </span>
            <span aria-hidden="true" style={{ height: 26, width: 1, background: 'rgba(255,255,255,0.12)' }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Users size={15} />
              {formatCount(memberCount)} members
            </span>
          </>
        ) : memberCount > 0 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Users size={15} />
            {formatCount(memberCount)} members
          </span>
        ) : null}
        <span
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minWidth: isMember ? 80 : 0,
            height: isMember ? 33 : 40,
            flex: isMember ? 'none' : 1,
            borderRadius: isMember ? 13 : 9,
            border: isMember ? '1px solid rgba(255,255,255,0.14)' : 'none',
            background: isMember ? 'rgba(255,255,255,0.05)' : '#FFD600',
            color: isMember ? 'rgba(238,240,250,0.72)' : '#000',
            padding: isMember ? '0 18px' : '0 24px',
            fontSize: 14,
            fontWeight: 900,
            boxShadow: isMember ? 'none' : '0 4px 14px rgba(255,214,0,0.3)',
          }}
        >
          {!isMember && <Users size={16} />}
          {isMember ? 'Joined' : 'Join Group'}
        </span>
        {!isMember && messageCount > 0 ? (
          <span className="sr-only">{formatCount(messageCount)} messages</span>
        ) : null}
      </div>
    </a>
  );
};

const MessageCard = ({ item }: { item: Record<string, unknown> }) => {
  const author = firstString(valueFor(item, 'display_name', 'displayName', 'author', 'name', 'username'), 'Street Profile user');
  const handle = firstString(valueFor(item, 'handle', 'username'));
  const channel = firstString(valueFor(item, 'channel_name', 'channelName', 'channel_slug', 'channelSlug'), 'Direct messages');
  const content = firstString(valueFor(item, 'content', 'text', 'summary', 'last_message', 'lastMessage'), 'Needs first sign-in');
  const avatar = normalizeImageUrl(valueFor(item, 'avatar_url', 'avatarUrl', 'image_url', 'imageUrl'));
  const isNew = firstBoolean(valueFor(item, 'is_new', 'isNew', 'unread')) || firstString(valueFor(item, 'status')) === 'new';
  const time = firstString(valueFor(item, 'created_at', 'createdAt', 'updated_at', 'updatedAt'));

  return (
    <a
      href="/messages"
      data-testid="street-profile-message-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        minHeight: 78,
        border: '1px solid rgba(255,255,255,0.10)',
        borderTopWidth: 1,
        background: 'rgba(23,24,38,0.72)',
        color: '#F6F7FB',
        padding: '12px 18px',
        textDecoration: 'none',
        whiteSpace: 'normal',
      }}
    >
      <AvatarBubble name={author} src={avatar} size={42} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <strong
            style={{
              display: 'inline-block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 14,
            }}
          >
            {author}
          </strong>
          {isNew ? (
            <span
              style={{
                borderRadius: 999,
                background: 'rgba(255,214,0,0.16)',
                color: '#FFD600',
                padding: '2px 6px',
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              NEW
            </span>
          ) : null}
          {handle ? <span style={{ color: 'rgba(246,247,251,0.50)', fontSize: 11 }}>{handle}</span> : null}
          {time ? <span style={{ marginLeft: 'auto', color: 'rgba(246,247,251,0.42)', fontSize: 11 }}>{formatDate(time)}</span> : null}
        </div>
        <div style={{ marginTop: 4, color: 'rgba(246,247,251,0.74)', fontSize: 12 }}>{channel}</div>
        <div
          style={{
            marginTop: 4,
            color: 'rgba(246,247,251,0.46)',
            fontSize: 11,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {content}
        </div>
      </div>
    </a>
  );
};

const PostCard = ({ item }: { item: Record<string, unknown> }) => {
  const title = firstString(valueFor(item, 'title', 'category_name', 'categoryName'), 'Word on the Street');
  const author = firstString(valueFor(item, 'author_name', 'authorName', 'display_name', 'displayName', 'username'), 'Street Voices');
  const authorAvatar = normalizeImageUrl(valueFor(item, 'author_avatar_url', 'authorAvatarUrl', 'avatar_url', 'avatarUrl'));
  const content = firstString(valueFor(item, 'content_preview', 'contentPreview', 'content', 'summary'));
  const category = firstString(valueFor(item, 'category_name', 'categoryName'));
  const tags = stringList(valueFor(item, 'tags')).slice(0, 3);
  const image = normalizeImageUrl(valueFor(item, 'image_url', 'imageUrl', 'media_url', 'mediaUrl', 'thumbnail_url', 'thumbnailUrl'));
  const href = firstString(valueFor(item, 'href'), firstString(valueFor(item, 'id')) ? `/word-on-the-street/post/${encodeURIComponent(firstString(valueFor(item, 'id')))}` : '/word-on-the-street');
  const featured = firstBoolean(valueFor(item, 'is_featured', 'isFeatured', 'featured'));
  const verified = firstBoolean(valueFor(item, 'is_verified', 'isVerified', 'verified'));
  const createdAt = firstString(valueFor(item, 'last_activity_at', 'lastActivityAt', 'created_at', 'createdAt', 'updated_at', 'updatedAt'));
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <a
      href={href}
      data-testid="street-profile-post-card"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: featured ? 14 : 12,
        overflow: 'hidden',
        borderRadius: 16,
        border: featured ? '1px solid rgba(255,214,0,0.56)' : '1px solid rgba(255,255,255,0.14)',
        background: featured
          ? 'linear-gradient(135deg, rgba(39,38,52,0.88), rgba(58,50,62,0.72), rgba(17,20,31,0.88))'
          : 'linear-gradient(135deg, rgba(34,35,49,0.76), rgba(45,39,52,0.66))',
        boxShadow: featured
          ? '0 0 0 1px rgba(255,214,0,0.14), 0 20px 46px rgba(0,0,0,0.28)'
          : '0 8px 32px rgba(0,0,0,0.3)',
        color: '#F6F7FB',
        padding: featured ? 14 : 12,
        textDecoration: 'none',
        whiteSpace: 'normal',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <AvatarBubble name={author} src={authorAvatar} size={featured ? 44 : 42} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  color: 'rgba(246,247,251,0.70)',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                <span style={{ color: '#F6F7FB', fontWeight: 900 }}>{author}</span>
                {verified ? <span style={{ color: '#FFD600', fontSize: 13 }}>●</span> : null}
                {createdAt ? (
                  <>
                    <span>·</span>
                    <span>{formatDate(createdAt)}</span>
                  </>
                ) : null}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {featured ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      borderRadius: 999,
                      border: '1px solid rgba(16,185,129,0.2)',
                      background: 'rgba(16,185,129,0.16)',
                      color: '#10B981',
                      padding: '5px 10px',
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    <Sparkles size={12} /> Featured
                  </span>
                ) : null}
                {category ? (
                  <span
                    style={{
                      borderRadius: 999,
                      border: '1px solid rgba(255,214,0,0.24)',
                      background: 'rgba(255,214,0,0.14)',
                      color: '#FFD600',
                      padding: '5px 10px',
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {category}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(246,247,251,0.70)' }}>
            <Bookmark size={18} />
            <MoreHorizontal size={20} />
          </div>
        </div>
        <h3 style={{ margin: '0 0 7px', color: '#F6F7FB', fontSize: featured ? '1.12rem' : '1.05rem', lineHeight: 1.25, fontWeight: 900 }}>
          {title}
        </h3>
        {content ? (
          <p
            style={{
              margin: '0 0 10px',
              color: 'rgba(246,247,251,0.70)',
              fontSize: 14,
              lineHeight: 1.48,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {content}
          </p>
        ) : null}
        {tags.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            {tags.map((tag) => (
              <span key={tag} style={{ color: '#A855F7', fontSize: 13, fontWeight: 900 }}>
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
        {image && !imageFailed ? (
          <div style={{ margin: tags.length ? '0 0 12px' : '10px 0 12px', overflow: 'hidden', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)' }}>
            <img
              src={image}
              alt={title}
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
              style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover' }}
            />
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: 'rgba(246,247,251,0.70)', fontSize: 13, fontWeight: 700, marginTop: featured ? 4 : 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#ff4d7f', fontWeight: 800 }}>
          <Heart size={17} />
          {formatCount(valueFor(item, 'like_count', 'likeCount', 'likes'))}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <MessageCircle size={17} />
          {formatCount(valueFor(item, 'reply_count', 'replyCount', 'comment_count', 'commentCount', 'replies'))}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <Eye size={17} />
          {formatCount(valueFor(item, 'view_count', 'viewCount', 'views'))}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <Repeat2 size={17} />
          {Math.max(0, Math.round(firstNumber(valueFor(item, 'reply_count', 'replyCount', 'comment_count', 'commentCount')) * 0.66))}
        </span>
      </div>
    </a>
  );
};

const renderCard = (kind: string, item: Record<string, unknown>, index: number) => {
  const resultKind = normalizeResultKind(kind);
  const key = firstString(item.id, item.username, item.slug, `${kind}-${index}`);
  if (resultKind === 'profiles') {
    return <ProfileCard key={key} item={item} />;
  }
  if (resultKind === 'groups') {
    return <GroupCard key={key} item={item} />;
  }
  if (resultKind === 'messages') {
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
        const resultKind = normalizeResultKind(kind);
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
              <div
                style={{
                  display: resultKind === 'messages' ? 'flex' : 'grid',
                  flexDirection: resultKind === 'messages' ? 'column' : undefined,
                  gridTemplateColumns:
                    resultKind === 'profiles' || resultKind === 'groups'
                      ? 'repeat(auto-fit, minmax(300px, 1fr))'
                      : resultKind === 'posts'
                        ? 'repeat(auto-fit, minmax(320px, 1fr))'
                        : undefined,
                  gap: resultKind === 'messages' ? 0 : 24,
                  overflow: 'hidden',
                  border:
                    resultKind === 'messages'
                      ? '1px solid rgba(255,255,255,0.10)'
                      : undefined,
                  background: resultKind === 'messages' ? 'rgba(23,24,38,0.72)' : undefined,
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
      })}
    </div>
  );
});

StreetProfileResults.displayName = 'StreetProfileResults';

export default StreetProfileResults;

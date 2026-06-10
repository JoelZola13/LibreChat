import React, { memo, useMemo } from 'react';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import Briefcase from 'lucide-react/dist/esm/icons/briefcase';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import GraduationCap from 'lucide-react/dist/esm/icons/graduation-cap';
import Heart from 'lucide-react/dist/esm/icons/heart';
import Mail from 'lucide-react/dist/esm/icons/mail';
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Send from 'lucide-react/dist/esm/icons/send';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Users from 'lucide-react/dist/esm/icons/users';

type ActionRequestPayload = {
  actionId?: string;
  params?: Record<string, unknown>;
  createdAt?: string;
};

type ActionView = {
  title: string;
  subtitle: string;
  accent: string;
  icon: React.ReactNode;
  fields: Array<{ label: string; value: string }>;
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
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
  }
  return '';
};

const compactDate = (value: unknown): string => {
  const text = firstString(value);
  if (!text) {
    return '';
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime())
    ? text
    : date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
};

const sentenceCase = (value: string): string =>
  value
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());

const compactValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value
      .map((item) => firstString(item))
      .filter(Boolean)
      .join(', ');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => `${sentenceCase(key)}: ${firstString(nested)}`)
      .filter((item) => !item.endsWith(': '))
      .join(', ');
  }
  return firstString(value);
};

const pickFields = (
  params: Record<string, unknown>,
  entries: Array<[string, ...string[]]>,
): Array<{ label: string; value: string }> =>
  entries
    .map(([label, ...keys]) => ({
      label,
      value: keys.map((key) => compactValue(params[key])).find(Boolean) ?? '',
    }))
    .filter((field) => field.value);

const genericFields = (params: Record<string, unknown>): Array<{ label: string; value: string }> =>
  Object.entries(params)
    .filter(([key]) => !/^user_|artist_|agent$/i.test(key))
    .map(([key, value]) => ({ label: sentenceCase(key), value: compactValue(value) }))
    .filter((field) => field.value)
    .slice(0, 5);

const actionViewFor = (payload: ActionRequestPayload): ActionView => {
  const actionId = firstString(payload.actionId);
  const params = asRecord(payload.params);

  if (actionId === 'profile.send_dm') {
    return {
      title: 'Send direct message',
      subtitle: 'Ready to message a Street Profile.',
      accent: '#60a5fa',
      icon: <Mail size={19} />,
      fields: pickFields(params, [
        ['Recipient', 'recipient', 'recipientQuery', 'profile', 'profile_id', 'profileId'],
        ['Message', 'content', 'message', 'body', 'text'],
      ]),
    };
  }

  if (actionId === 'groups.send_message') {
    return {
      title: 'Post to group',
      subtitle: 'Ready to publish this group message.',
      accent: '#38bdf8',
      icon: <Users size={19} />,
      fields: pickFields(params, [
        ['Group', 'groupName', 'group', 'group_id', 'groupId'],
        ['Message', 'content', 'message', 'body', 'text'],
      ]),
    };
  }

  if (actionId === 'word.create_article') {
    return {
      title: 'Create Word on the Street article',
      subtitle: 'Ready to save this community news draft.',
      accent: '#fb923c',
      icon: <FileText size={19} />,
      fields: pickFields(params, [
        ['Title', 'title'],
        ['Status', 'status'],
        ['Content', 'content', 'message', 'body', 'text'],
      ]),
    };
  }

  if (actionId === 'word.delete_article') {
    return {
      title: 'Delete Word on the Street article',
      subtitle: 'Ready to remove this article.',
      accent: '#f87171',
      icon: <Trash2 size={19} />,
      fields: pickFields(params, [['Article', 'article_id', 'articleId', 'post_id', 'postId']]),
    };
  }

  if (actionId.startsWith('jobs.')) {
    const isRemove = actionId.includes('unfavorite');
    return {
      title: isRemove ? 'Remove saved job' : 'Save job',
      subtitle: isRemove ? 'Ready to remove this job from saved items.' : 'Ready to save this job.',
      accent: '#facc15',
      icon: <Briefcase size={19} />,
      fields: pickFields(params, [
        [
          'Job',
          'job',
          'jobTitle',
          'title',
          'listing',
          'listingTitle',
          'job_id',
          'jobId',
          'listing_id',
          'listingId',
        ],
      ]),
    };
  }

  if (actionId.startsWith('gallery.')) {
    const isDelete = actionId === 'gallery.delete_artwork';
    const title =
      actionId === 'gallery.create_artwork'
        ? 'Create gallery artwork'
        : actionId === 'gallery.update_artwork'
          ? 'Update gallery artwork'
          : actionId === 'gallery.comment'
            ? 'Comment on artwork'
            : actionId === 'gallery.unfavorite'
              ? 'Remove saved artwork'
              : isDelete
                ? 'Delete artwork'
                : 'Save artwork';
    return {
      title,
      subtitle: 'Ready to update Street Gallery.',
      accent: isDelete ? '#f87171' : '#a78bfa',
      icon: isDelete ? <Trash2 size={19} /> : <Palette size={19} />,
      fields: pickFields(params, [
        [
          'Artwork',
          'artwork',
          'artworkTitle',
          'artTitle',
          'artwork_id',
          'artworkId',
          'art_id',
          'artId',
        ],
        ['Title', 'title'],
        ['Description', 'description'],
        ['Price', 'price'],
        ['Currency', 'currency'],
        ['For sale', 'is_for_sale', 'isForSale', 'for_sale', 'forSale'],
        ['Sold', 'is_sold', 'isSold', 'sold'],
        ['Comment', 'body', 'comment', 'content', 'message', 'text'],
      ]),
    };
  }

  if (actionId.startsWith('academy.')) {
    return {
      title:
        actionId === 'academy.create_course'
          ? 'Create Academy course'
          : actionId === 'academy.create_assignment'
            ? 'Create Academy assignment'
            : actionId === 'academy.unenroll_course'
              ? 'Leave Academy course'
              : 'Join Academy course',
      subtitle: 'Ready to update Academy.',
      accent: '#34d399',
      icon: <GraduationCap size={19} />,
      fields: pickFields(params, [
        ['Course', 'course', 'courseTitle', 'courseName', 'course_id', 'courseId'],
        ['Title', 'title'],
        ['Description', 'description'],
      ]),
    };
  }

  if (actionId.startsWith('grant.')) {
    return {
      title:
        actionId === 'grant.create_opportunity'
          ? 'Create grant opportunity'
          : actionId === 'grant.archive'
            ? 'Archive grant opportunity'
            : 'Update grant stage',
      subtitle: 'Ready to update the grant workspace.',
      accent: '#facc15',
      icon: <BookOpen size={19} />,
      fields: pickFields(params, [
        [
          'Grant',
          'grant',
          'grantTitle',
          'grantName',
          'opportunity',
          'opportunityTitle',
          'grant_id',
          'grantId',
          'opportunity_id',
          'opportunityId',
        ],
        ['Name', 'name'],
        ['Funder', 'funder'],
        ['Stage', 'stage'],
      ]),
    };
  }

  return {
    title: sentenceCase(actionId || 'Local action'),
    subtitle: 'Ready to run this local action.',
    accent: '#facc15',
    icon: <CheckCircle2 size={19} />,
    fields: genericFields(params),
  };
};

const StreetBotActionRequest = memo(({ raw }: { raw: string }) => {
  const payload = useMemo<ActionRequestPayload | null>(() => {
    try {
      return JSON.parse(raw) as ActionRequestPayload;
    } catch {
      return null;
    }
  }, [raw]);

  if (!payload?.actionId) {
    return null;
  }

  const view = actionViewFor(payload);
  const created = compactDate(payload.createdAt);

  return (
    <section
      className="not-prose my-4 max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#11141b]/90 font-sans text-white shadow-xl shadow-black/25 backdrop-blur-xl"
      data-testid="streetbot-action-request-card"
    >
      <div
        className="flex items-start gap-3 border-b border-white/10 p-4"
        style={{
          background: `linear-gradient(135deg, ${view.accent}22, rgba(255,255,255,0.04))`,
        }}
      >
        <div
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-black"
          style={{ background: view.accent }}
          aria-hidden="true"
        >
          {view.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-base font-bold leading-tight text-white">{view.title}</h3>
            <span className="rounded-full border border-yellow-300/25 bg-yellow-300/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-yellow-200">
              Confirm
            </span>
          </div>
          <p className="text-white/58 m-0 mt-1 text-sm font-semibold leading-5">{view.subtitle}</p>
        </div>
      </div>

      {view.fields.length ? (
        <div className="space-y-3 p-4">
          {view.fields.map((field) => (
            <div
              key={`${field.label}-${field.value}`}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
            >
              <div className="text-white/42 mb-1 text-[11px] font-bold uppercase tracking-wide">
                {field.label}
              </div>
              <div className="text-white/82 whitespace-pre-wrap break-words text-sm font-semibold leading-6">
                {field.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-xs font-bold text-yellow-200">
          <Send size={14} />
          Reply "confirm" to run this.
        </span>
        {created ? (
          <span className="text-white/36 text-xs font-semibold">Prepared {created}</span>
        ) : null}
      </div>
    </section>
  );
});

StreetBotActionRequest.displayName = 'StreetBotActionRequest';

export default StreetBotActionRequest;

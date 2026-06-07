import React, { memo, useMemo } from 'react';
import Send from 'lucide-react/dist/esm/icons/send';
import UserRound from 'lucide-react/dist/esm/icons/user-round';

type DraftPayload = {
  recipient?: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  };
  recipientQuery?: string;
  content?: string;
};

const StreetProfileMessageDraft = memo(({ raw }: { raw: string }) => {
  const draft = useMemo<DraftPayload | null>(() => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [raw]);

  if (!draft) {
    return null;
  }

  const recipientName =
    draft.recipient?.display_name || draft.recipient?.username || draft.recipientQuery || 'Profile';
  const username = draft.recipient?.username;
  const avatar = draft.recipient?.avatar_url;

  return (
    <section
      className="not-prose my-4 max-w-2xl rounded-lg border border-white/10 bg-[#11141b]/90 p-4 font-sans text-white shadow-xl shadow-black/25 backdrop-blur-xl"
      data-testid="street-profile-message-draft"
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-500/25 text-blue-100">
          {avatar ? <img src={avatar} alt={recipientName} className="h-full w-full object-cover" /> : <UserRound size={18} />}
        </div>
        <div className="min-w-0">
          <h3 className="m-0 truncate text-sm font-bold text-white">Message to {recipientName}</h3>
          {username ? <p className="m-0 mt-0.5 text-xs font-semibold text-white/48">@{username}</p> : null}
        </div>
      </div>
      <p className="m-0 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-white/75">
        {draft.content}
      </p>
      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-yellow-200">
        <Send size={14} />
        Reply “send it” to send this DM.
      </div>
    </section>
  );
});

StreetProfileMessageDraft.displayName = 'StreetProfileMessageDraft';

export default StreetProfileMessageDraft;

import { UserRound } from 'lucide-react';
import { useAuthContext } from '~/hooks/AuthContext';

type AcademyProfileLinkProps = {
  compact?: boolean;
};

type AcademyUser = {
  name?: string | null;
  username?: string | null;
  email?: string | null;
  avatar?: string | null;
  image?: string | null;
  picture?: string | null;
};

function getProfileName(user: AcademyUser | null | undefined) {
  return user?.name || user?.username || user?.email || 'Profile';
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || 'P';
}

export function AcademyProfileLink({ compact = false }: AcademyProfileLinkProps) {
  const { user } = useAuthContext();
  const profileUser = (user ?? null) as AcademyUser | null;
  const profileName = getProfileName(profileUser);
  const profileImage = profileUser?.avatar || profileUser?.image || profileUser?.picture || null;

  return (
    <a
      href="/profile"
      aria-label="Profile"
      title={profileName}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/80 p-1.5 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-white"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-slate-800">
        {profileImage ? (
          <img src={profileImage} alt="" className="h-full w-full object-cover" />
        ) : profileName !== 'Profile' ? (
          getInitials(profileName)
        ) : (
          <UserRound className="h-4 w-4" aria-hidden="true" />
        )}
      </span>
      {!compact && <span className="hidden max-w-[140px] truncate pr-2 lg:block">{profileName}</span>}
    </a>
  );
}

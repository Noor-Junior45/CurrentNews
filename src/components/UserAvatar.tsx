import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';

export interface UserAvatarProps {
  user?: {
    photoURL?: string | null;
    displayName?: string | null;
    email?: string | null;
  } | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  ringColor?: string;
  showBorder?: boolean;
}

const SIZE_MAP = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 sm:h-11 sm:w-11 text-sm',
  lg: 'h-20 w-20 text-2xl',
  xl: 'h-22 w-22 sm:h-24 sm:w-24 text-2xl sm:text-3xl',
};

const ICON_SIZE_MAP = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
  xl: 'h-10 w-10',
};

// Deterministic monogram background color based on name/email hash
function getMonogramBg(name: string): string {
  const colors = [
    'bg-indigo-600',
    'bg-blue-600',
    'bg-amber-600',
    'bg-emerald-600',
    'bg-rose-600',
    'bg-purple-600',
    'bg-teal-600',
    'bg-sky-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function UserAvatar({
  user,
  size = 'md',
  className = '',
  ringColor = 'border-amber-400',
  showBorder = false,
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  // Reset error state if photoURL changes
  useEffect(() => {
    setImgError(false);
  }, [user?.photoURL]);

  const rawPhoto = user?.photoURL?.trim() || '';
  const sanitizedPhoto = rawPhoto
    ? (rawPhoto.startsWith('http:') ? rawPhoto.replace(/^http:/, 'https:') : rawPhoto)
    : '';

  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;
  const iconClass = ICON_SIZE_MAP[size] || ICON_SIZE_MAP.md;
  const initial = (user?.displayName?.trim()?.charAt(0) || user?.email?.trim()?.charAt(0) || 'U').toUpperCase();
  const monogramBg = getMonogramBg(user?.displayName || user?.email || 'U');

  const borderClass = showBorder ? `border-2 ${ringColor}` : '';

  if (!user) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0 ${borderClass} ${className}`}
        aria-hidden="true"
      >
        <User className={iconClass} />
      </div>
    );
  }

  if (sanitizedPhoto && !imgError) {
    return (
      <div
        className={`${sizeClass} rounded-full overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 shadow-xs ${borderClass} ${className}`}
      >
        <img
          src={sanitizedPhoto}
          alt={user.displayName ? `${user.displayName}'s avatar` : 'Profile avatar'}
          className="h-full w-full object-cover select-none"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback monogram initial
  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden shrink-0 ${monogramBg} text-white flex items-center justify-center font-bold tracking-wide shadow-xs select-none ${borderClass} ${className}`}
      aria-label={user.displayName || user.email || 'User'}
    >
      <span>{initial}</span>
    </div>
  );
}

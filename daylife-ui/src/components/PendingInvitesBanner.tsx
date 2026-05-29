import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Connection } from '../lib/api';
import { SHARE_FEATURE_LABELS, ALL_SHARE_FEATURES, type ShareFeature } from '../lib/sharing';
import { UserPlus, Check, X, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';

function shareScopeLabel(features: ShareFeature[]): string {
  if (features.length === 1) {
    return `${SHARE_FEATURE_LABELS[features[0]]?.title || features[0]} only`;
  }
  if (features.length >= ALL_SHARE_FEATURES.length) return 'Everything';
  return features.map((f) => SHARE_FEATURE_LABELS[f]?.title || f).join(', ');
}

interface PendingInvitesBannerProps {
  invites: Connection[];
  onAccept?: (inviteId: string) => void;
  onDecline?: (inviteId: string) => void;
  acceptingId?: string | null;
  className?: string;
  compact?: boolean;
}

function InviteCard({
  invite,
  onAccept,
  onDecline,
  acceptingId,
}: {
  invite: Connection;
  onAccept?: (inviteId: string) => void;
  onDecline?: (inviteId: string) => void;
  acceptingId?: string | null;
}) {
  return (
    <div className="bg-white rounded-xl border border-amber-200 p-3 space-y-2 shadow-sm">
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 text-sm break-words">
          @{invite.partnerUsername}
          {invite.partnerName ? ` (${invite.partnerName})` : ''}
        </p>
        <p className="text-xs text-amber-900 mt-0.5">
          Wants to share: <strong>{shareScopeLabel(invite.features)}</strong>
        </p>
        {invite.groupLabel && (
          <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
            {invite.groupLabel}
          </span>
        )}
      </div>
      {onAccept && onDecline && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onAccept(invite.inviteId)}
            disabled={acceptingId === invite.inviteId}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60 touch-manipulation"
          >
            <Check size={15} /> Accept
          </button>
          <button
            type="button"
            onClick={() => onDecline(invite.inviteId)}
            disabled={acceptingId === invite.inviteId}
            className="flex items-center justify-center gap-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm touch-manipulation min-w-[5rem]"
          >
            <X size={15} /> No
          </button>
        </div>
      )}
    </div>
  );
}

export function PendingInvitesBanner({
  invites,
  onAccept,
  onDecline,
  acceptingId,
  className,
  compact = false,
}: PendingInvitesBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (invites.length === 0) return null;

  const visibleLimit = compact ? 1 : 3;
  const showExpand = invites.length > visibleLimit;
  const visible = expanded ? invites : invites.slice(0, visibleLimit);

  return (
    <div
      className={cn(
        'bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4 space-y-3 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 text-amber-900 shrink-0">
            <UserPlus size={18} />
          </span>
          <div className="min-w-0">
            <p className="font-bold text-amber-950 text-sm sm:text-base">
              {invites.length === 1 ? 'Someone wants to connect' : `${invites.length} people want to connect`}
            </p>
            <p className="text-xs text-amber-800">Accept to start sharing tasks, lists, and more.</p>
          </div>
        </div>
        {!compact && (
          <Link
            to="/share"
            className="text-xs font-medium text-amber-900 hover:underline shrink-0 flex items-center gap-0.5"
          >
            Share <ChevronRight size={14} />
          </Link>
        )}
      </div>

      <div className="space-y-2">
        {visible.map((c) => (
          <InviteCard
            key={c.id}
            invite={c}
            onAccept={onAccept}
            onDecline={onDecline}
            acceptingId={acceptingId}
          />
        ))}
      </div>

      {showExpand && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-center gap-1 text-xs font-semibold text-amber-900 py-1 touch-manipulation"
        >
          {expanded ? (
            <>
              Show less <ChevronUp size={14} />
            </>
          ) : (
            <>
              +{invites.length - visibleLimit} more invite{invites.length - visibleLimit === 1 ? '' : 's'}{' '}
              <ChevronDown size={14} />
            </>
          )}
        </button>
      )}
    </div>
  );
}

export { shareScopeLabel };

import { Link } from 'react-router-dom';
import type { Connection } from '../lib/api';
import { SHARE_FEATURE_LABELS, ALL_SHARE_FEATURES, type ShareFeature } from '../lib/sharing';
import { UserPlus, Check, X, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

function shareScopeLabel(features: ShareFeature[]): string {
  if (features.length === 1) {
    return `${SHARE_FEATURE_LABELS[features[0]]?.title || features[0]} only`;
  }
  if (features.length >= 8) return 'Everything';
  return features.map((f) => SHARE_FEATURE_LABELS[f]?.title || f).join(', ');
}

interface PendingInvitesBannerProps {
  invites: Connection[];
  onAccept?: (inviteId: string) => void;
  onDecline?: (inviteId: string) => void;
  acceptingId?: string | null;
  className?: string;
}

export function PendingInvitesBanner({
  invites,
  onAccept,
  onDecline,
  acceptingId,
  className,
}: PendingInvitesBannerProps) {
  if (invites.length === 0) return null;

  return (
    <div className={cn('bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <UserPlus size={18} className="text-amber-700 shrink-0" />
          <p className="font-semibold text-amber-950 text-sm sm:text-base truncate">
            {invites.length === 1 ? '1 invite waiting for you' : `${invites.length} invites waiting for you`}
          </p>
        </div>
        <Link
          to="/share"
          className="text-xs font-medium text-amber-800 hover:underline shrink-0 flex items-center gap-0.5"
        >
          Share page <ChevronRight size={14} />
        </Link>
      </div>

      <div className="space-y-2">
        {invites.slice(0, 2).map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-amber-200 p-3 space-y-2">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 text-sm break-words">
                @{c.partnerUsername}
                {c.partnerName ? ` (${c.partnerName})` : ''} wants to share
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                They picked: <strong>{shareScopeLabel(c.features)}</strong>
              </p>
            </div>
            {onAccept && onDecline && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onAccept(c.inviteId)}
                  disabled={acceptingId === c.inviteId}
                  className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-60 touch-manipulation"
                >
                  <Check size={14} /> Accept
                </button>
                <button
                  type="button"
                  onClick={() => onDecline(c.inviteId)}
                  disabled={acceptingId === c.inviteId}
                  className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm touch-manipulation"
                >
                  <X size={14} /> Decline
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {invites.length > 2 && (
        <Link to="/share" className="block text-center text-xs font-medium text-amber-800 hover:underline">
          +{invites.length - 2} more on Share page
        </Link>
      )}
    </div>
  );
}

export { shareScopeLabel };

import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, Connection, ShareFeature } from '../lib/api';
import { useGitHubSync } from '../features/sync/GitHubSyncContext';
import { VisibilityToggle } from './VisibilityToggle';
import { defaultVisibility } from '../lib/privacy';
import type { ItemVisibility } from '../lib/privacy';
import { activeShareConnections, connectionLabel, type ShareScope } from '../lib/shareScope';
import { cn } from '../lib/utils';
import { UserRound, Users } from 'lucide-react';

interface Props {
  feature: ShareFeature;
  value: ShareScope;
  onChange: (value: ShareScope) => void;
  membersCount: number;
  disabled?: boolean;
}

export function ShareScopePicker({ feature, value, onChange, membersCount, disabled }: Props) {
  const { cloudReady } = useGitHubSync();
  const { data: connections = [] } = useQuery<Connection[]>({
    queryKey: ['connections'],
    queryFn: () => api.get('/connections'),
    enabled: cloudReady,
  });

  const shareConnections = activeShareConnections(connections, feature);
  const canShare = shareConnections.length > 0;
  const showHousehold = membersCount > 1;
  const selectedConnection =
    value.kind === 'connection'
      ? shareConnections.find((c) => c.sharedSpaceId === value.spaceId)
      : undefined;

  useEffect(() => {
    if (value.kind !== 'connection' || shareConnections.length === 0) return;
    if (!shareConnections.some((c) => c.sharedSpaceId === value.spaceId)) {
      onChange({ kind: 'connection', spaceId: shareConnections[0].sharedSpaceId! });
    }
  }, [value, shareConnections, onChange]);

  const setPersonal = (visibility: ItemVisibility) => {
    onChange({ kind: 'personal', visibility });
  };

  const setConnection = (spaceId: string) => {
    onChange({ kind: 'connection', spaceId });
  };

  if (!canShare && !showHousehold) return null;

  return (
    <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
      <div>
        <label className="block text-sm font-medium mb-1.5">Save as</label>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setPersonal(value.kind === 'personal' ? value.visibility : defaultVisibility(membersCount))}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm border',
              value.kind === 'personal'
                ? 'bg-white border-brand-300 text-brand-800 font-medium shadow-sm'
                : 'border-gray-200 text-gray-500',
            )}
          >
            <UserRound size={15} />
            Personal
          </button>
          {canShare && (
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                setConnection(
                  value.kind === 'connection'
                    ? value.spaceId
                    : shareConnections[0].sharedSpaceId!,
                )
              }
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm border',
                value.kind === 'connection'
                  ? 'bg-violet-50 border-violet-300 text-violet-900 font-medium shadow-sm'
                  : 'border-gray-200 text-gray-500',
              )}
            >
              <Users size={15} />
              Share
            </button>
          )}
        </div>
      </div>

      {value.kind === 'personal' && showHousehold && (
        <VisibilityToggle
          value={value.visibility}
          onChange={(visibility) => setPersonal(visibility)}
        />
      )}

      {value.kind === 'connection' && canShare && (
        <div>
          <label className="block text-sm font-medium mb-1.5">Share with</label>
          {shareConnections.length === 1 ? (
            <p className="text-sm text-violet-800 px-3 py-2 rounded-lg bg-violet-50 border border-violet-100">
              {connectionLabel(shareConnections[0])}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {shareConnections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setConnection(c.sharedSpaceId!)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm border transition-colors',
                    value.spaceId === c.sharedSpaceId
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-violet-800 border-violet-200 hover:border-violet-300',
                  )}
                >
                  {connectionLabel(c)}
                </button>
              ))}
            </div>
          )}
          {selectedConnection && (
            <p className="text-xs text-violet-700 mt-2">
              Both of you will see this in your shared lists.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

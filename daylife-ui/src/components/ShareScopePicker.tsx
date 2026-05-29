import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, Connection, ShareFeature } from '../lib/api';
import { useGitHubSync } from '../features/sync/GitHubSyncContext';
import { VisibilityToggle } from './VisibilityToggle';
import { defaultVisibility } from '../lib/privacy';
import type { ItemVisibility } from '../lib/privacy';
import { activeShareConnections, connectionLabel, saveShareScope, type ShareScope } from '../lib/shareScope';
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

  const pickScope = (scope: ShareScope) => {
    saveShareScope(feature, scope);
    onChange(scope);
  };

  const setPersonal = (visibility: ItemVisibility) => {
    pickScope({ kind: 'personal', visibility });
  };

  const setConnection = (spaceId: string) => {
    pickScope({ kind: 'connection', spaceId });
  };

  if (!canShare && !showHousehold) return null;

  return (
    <div className="space-y-3 rounded-xl border border-violet-100 bg-gradient-to-br from-gray-50 to-violet-50/40 p-3">
      <div>
        <label className="block text-sm font-medium mb-1">Where should this go?</label>
        <p className="text-xs text-gray-500 mb-2">Just yours, or shared with someone you connected with.</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setPersonal(value.kind === 'personal' ? value.visibility : defaultVisibility(membersCount))}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm border touch-manipulation',
              value.kind === 'personal'
                ? 'bg-white border-brand-300 text-brand-800 font-semibold shadow-sm ring-1 ring-brand-100'
                : 'border-gray-200 text-gray-500 bg-white/70',
            )}
          >
            <UserRound size={15} />
            Just mine
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
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm border touch-manipulation',
                value.kind === 'connection'
                  ? 'bg-violet-600 border-violet-600 text-white font-semibold shadow-sm'
                  : 'border-violet-200 text-violet-700 bg-violet-50/80',
              )}
            >
              <Users size={15} />
              Shared
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

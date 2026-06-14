import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChatPage } from '../chat/ChatPage';
import { GmailMailPage } from '../mail/GmailMailPage';
import { cn } from '../../lib/utils';
import { MessageCircle, Mail } from 'lucide-react';

export function CommsPage() {
  const [tab, setTab] = useState<'chat' | 'mail'>('chat');
  const { spaceId } = useParams<{ spaceId?: string }>();

  if (spaceId) {
    return <ChatPage embedded />;
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="sticky top-0 z-10 bg-white border-b px-4 pt-3 pb-0">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-3">
          <button
            type="button"
            onClick={() => setTab('chat')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === 'chat' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
            )}
          >
            <MessageCircle size={16} /> Messages
          </button>
          <button
            type="button"
            onClick={() => setTab('mail')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === 'mail' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
            )}
          >
            <Mail size={16} /> Mail
          </button>
        </div>
      </div>

      <div className="px-4 pt-2 pb-4">
        {tab === 'chat' ? <ChatPage embedded /> : <GmailMailPage embedded />}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Moon, Sparkles, Check } from 'lucide-react';
import { api, type DailyNote } from '../lib/api';
import { toast } from './Toaster';
import { cn } from '../lib/utils';

const GRATITUDE_PROMPTS = [
  'Something that made me smile',
  'Someone I appreciate',
  'A small win today',
];

interface EveningReflectionSectionProps {
  selectedDate: string;
  visible: boolean;
}

export function EveningReflectionSection({ selectedDate, visible }: EveningReflectionSectionProps) {
  const queryClient = useQueryClient();
  const [gratitude, setGratitude] = useState(['', '', '']);
  const [reflection, setReflection] = useState('');

  const { data: savedNotes } = useQuery<{ data: DailyNote[] }>({
    queryKey: ['evening-notes', selectedDate],
    queryFn: () => api.get(`/notes?noteDate=${selectedDate}&limit=10`),
    enabled: visible,
  });

  const existingGratitude = savedNotes?.data.find((n) => n.noteKind === 'GRATITUDE');
  const existingReflection = savedNotes?.data.find((n) => n.noteKind === 'REFLECTION');

  const save = useMutation({
    mutationFn: async () => {
      const lines = gratitude.map((g) => g.trim()).filter(Boolean);
      if (lines.length > 0) {
        await api.post('/notes', {
          content: lines.map((l, i) => `${i + 1}. ${l}`).join('\n'),
          area: 'PERSONAL',
          noteDate: selectedDate,
          noteKind: 'GRATITUDE',
          visibility: 'PRIVATE',
        });
      }
      if (reflection.trim()) {
        await api.post('/notes', {
          content: reflection.trim(),
          area: 'PERSONAL',
          noteDate: selectedDate,
          noteKind: 'REFLECTION',
          visibility: 'PRIVATE',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evening-notes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setGratitude(['', '', '']);
      setReflection('');
      toast.success('Evening reflection saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!visible) return null;

  const alreadyDone = existingGratitude || existingReflection;

  return (
    <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-950 via-violet-900 to-purple-900 text-white p-4 sm:p-5 shadow-md">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <Moon size={20} />
        </div>
        <div>
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-indigo-200">
            Wind down · evening reflection
          </p>
          <h2 className="text-lg font-bold mt-0.5">Gratitude & reflection</h2>
          <p className="text-sm text-indigo-100/90 mt-0.5">Close your day with calm, positive thoughts.</p>
        </div>
      </div>

      {alreadyDone ? (
        <div className="space-y-3 rounded-xl bg-white/10 p-4">
          {existingGratitude && (
            <div>
              <p className="text-xs font-semibold text-indigo-200 mb-1 flex items-center gap-1">
                <Sparkles size={12} /> Grateful for
              </p>
              <p className="text-sm whitespace-pre-line text-white/95">{existingGratitude.content}</p>
            </div>
          )}
          {existingReflection && (
            <div>
              <p className="text-xs font-semibold text-indigo-200 mb-1">Reflection</p>
              <p className="text-sm text-white/95">{existingReflection.content}</p>
            </div>
          )}
          <p className="text-xs text-indigo-200/80">Saved for tonight ✓</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-4">
            <p className="text-xs font-medium text-indigo-200">3 things I&apos;m grateful for</p>
            {gratitude.map((value, index) => (
              <input
                key={index}
                value={value}
                onChange={(e) => {
                  const next = [...gratitude];
                  next[index] = e.target.value;
                  setGratitude(next);
                }}
                placeholder={GRATITUDE_PROMPTS[index]}
                className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-indigo-200/60 outline-none focus:ring-2 focus:ring-white/30"
              />
            ))}
          </div>
          <div className="mb-4">
            <p className="text-xs font-medium text-indigo-200 mb-2">How do I feel right now?</p>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="A few words about your day, your mood, or tomorrow..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-indigo-200/60 outline-none focus:ring-2 focus:ring-white/30 resize-none"
            />
          </div>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending || (!gratitude.some((g) => g.trim()) && !reflection.trim())}
            className={cn(
              'w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2',
              'bg-white text-indigo-900 hover:bg-indigo-50 disabled:opacity-50',
            )}
          >
            <Check size={16} />
            {save.isPending ? 'Saving…' : 'Save evening reflection'}
          </button>
        </>
      )}
    </section>
  );
}

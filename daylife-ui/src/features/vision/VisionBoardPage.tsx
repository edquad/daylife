import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { api, VisionBoardItemEnriched, VisionCategory, User } from '../../lib/api';
import { categoryMeta, VISION_CATEGORIES, VISION_INSPIRATIONS, VISION_BOARD_PRESETS, VISION_AFFIRMATIONS, VISION_CATEGORY_GROUPS } from '../../lib/visionBoard';
import { cn } from '../../lib/utils';
import { toast } from '../../components/Toaster';
import { Plus, Sparkles, Trash2, Check, X, ImageIcon, Star } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';

type Filter = 'all' | 'active' | 'achieved' | 'mine' | 'shared';

interface FormState {
  title: string;
  caption: string;
  imageUrl: string;
  emoji: string;
  category: VisionCategory;
  color: string;
  ownerId: string;
}

const emptyForm = (userId?: string): FormState => ({
  title: '',
  caption: '',
  imageUrl: '',
  emoji: '✨',
  category: 'OTHER',
  color: '#6366F1',
  ownerId: userId || '',
});

export function VisionBoardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: members = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });
  const [filter, setFilter] = useState<Filter>('all');
  const [presetFilter, setPresetFilter] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<VisionBoardItemEnriched | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(user?.id));

  const queryKey = ['vision-board', filter, user?.id];

  const { data: items = [], isLoading } = useQuery<VisionBoardItemEnriched[]>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter === 'achieved') params.set('achieved', 'true');
      if (filter === 'active') params.set('achieved', 'false');
      if (filter === 'mine' && user) params.set('ownerId', user.id);
      if (filter === 'shared') params.set('ownerId', 'shared');
      const q = params.toString();
      return api.get(`/vision-board${q ? `?${q}` : ''}`);
    },
  });

  const { data: allItems = [] } = useQuery<VisionBoardItemEnriched[]>({
    queryKey: ['vision-board', 'stats'],
    queryFn: () => api.get('/vision-board'),
  });

  const { data: sharedVision } = useQuery<{
    groups: Array<{ spaceId: string; partnerName: string; items: VisionBoardItemEnriched[] }>;
  }>({
    queryKey: ['shared-vision'],
    queryFn: () => api.get('/shared/vision'),
  });

  const sharedGroups = sharedVision?.groups ?? [];
  const [sharedTitle, setSharedTitle] = useState<Record<string, string>>({});

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['vision-board'] });
    queryClient.invalidateQueries({ queryKey: ['shared-vision'] });
  };

  const saveItem = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title,
        caption: form.caption || undefined,
        imageUrl: form.imageUrl || undefined,
        emoji: form.emoji || undefined,
        category: form.category,
        color: form.color,
        ownerId: form.ownerId || null,
      };
      if (editItem) return api.put(`/vision-board/${editItem.id}`, body);
      return api.post('/vision-board', body);
    },
    onSuccess: () => {
      invalidate();
      setModalOpen(false);
      setEditItem(null);
      toast.success(editItem ? 'Vision updated' : 'Added to vision board');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleAchieved = useMutation({
    mutationFn: (id: string) => api.patch(`/vision-board/${id}/achieve`),
    onSuccess: () => invalidate(),
  });

  const deleteItem = useMutation({
    mutationFn: (id: string) => api.delete(`/vision-board/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success('Removed from board');
    },
  });

  const addSharedVision = useMutation({
    mutationFn: ({ spaceId, title }: { spaceId: string; title: string }) =>
      api.post(`/shared/${spaceId}/vision`, { title, emoji: '✨', category: 'OTHER', color: '#6366F1' }),
    onSuccess: () => { invalidate(); toast.success('Added to shared vision board'); },
  });

  const toggleSharedAchieved = useMutation({
    mutationFn: ({ spaceId, id }: { spaceId: string; id: string }) =>
      api.patch(`/shared/${spaceId}/vision/${id}/achieve`),
    onSuccess: invalidate,
  });

  const deleteSharedVision = useMutation({
    mutationFn: ({ spaceId, id }: { spaceId: string; id: string }) =>
      api.delete(`/shared/${spaceId}/vision/${id}`),
    onSuccess: () => { invalidate(); toast.success('Removed from shared board'); },
  });

  const openAdd = (preset?: Partial<FormState>) => {
    setEditItem(null);
    setForm({ ...emptyForm(user?.id), ...preset });
    setModalOpen(true);
  };

  const openEdit = (item: VisionBoardItemEnriched) => {
    setEditItem(item);
    setForm({
      title: item.title,
      caption: item.caption || '',
      imageUrl: item.imageUrl || '',
      emoji: item.emoji || '✨',
      category: item.category,
      color: item.color,
      ownerId: item.ownerId || '',
    });
    setModalOpen(true);
  };

  const activeCount = allItems.filter((i) => !i.achieved).length;
  const achievedCount = allItems.filter((i) => i.achieved).length;

  const presetCategories = presetFilter
    ? VISION_BOARD_PRESETS.find((p) => p.id === presetFilter)?.filter
    : null;
  const displayedItems = presetCategories
    ? items.filter((i) => presetCategories.includes(i.category))
    : items;

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-4xl mx-auto">
      <PageHeader
        theme="vision"
        icon={Star}
        title="Dreams & goals"
        subtitle={`${activeCount} you're working toward · ${achievedCount} achieved`}
        hint="Big life goals & vision — not daily to-dos. Use Today for everyday tasks."
        action={
          <button
            type="button"
            onClick={() => openAdd()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium shrink-0"
          >
            <Plus size={16} /> Add dream
          </button>
        }
      />

      <section className="bg-gradient-to-r from-violet-50 via-fuchsia-50 to-amber-50 rounded-2xl border border-violet-100 p-4 space-y-3">
        <p className="text-sm font-medium text-violet-900">Board themes</p>
        <div className="flex flex-wrap gap-2">
          {VISION_BOARD_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setPresetFilter(presetFilter === preset.id ? null : preset.id)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-full border transition-colors',
                presetFilter === preset.id
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white/80 border-violet-100 hover:border-violet-200',
              )}
            >
              {preset.emoji} {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-violet-100 p-4">
        <p className="text-sm font-medium text-violet-900 mb-2">Affirmations — tap to add</p>
        <div className="flex flex-wrap gap-2">
          {VISION_AFFIRMATIONS.map((aff) => {
            const meta = categoryMeta(aff.category);
            return (
              <button
                key={aff.text}
                type="button"
                onClick={() => openAdd({ title: aff.text, emoji: aff.emoji, category: aff.category, color: meta.color })}
                className="px-3 py-1.5 text-xs sm:text-sm bg-violet-50 border border-violet-100 rounded-full hover:bg-violet-100 text-violet-900 text-left"
              >
                {aff.emoji} {aff.text}
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-gradient-to-r from-violet-50 via-fuchsia-50 to-amber-50 rounded-2xl border border-violet-100 p-4">
        <p className="text-sm font-medium text-violet-900 mb-2">Quick add dreams</p>
        <div className="flex flex-wrap gap-2">
          {VISION_INSPIRATIONS.map((idea) => {
            const meta = categoryMeta(idea.category);
            return (
              <button
                key={idea.title}
                type="button"
                onClick={() => openAdd({
                  title: idea.title,
                  emoji: idea.emoji,
                  category: idea.category,
                  color: meta.color,
                })}
                className="px-3 py-1.5 text-sm bg-white/80 border border-violet-100 rounded-full hover:bg-white hover:border-violet-200 transition-colors"
              >
                {idea.emoji} {idea.title}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {([
          ['all', 'All'],
          ['active', 'Active'],
          ['achieved', 'Achieved'],
          ['mine', 'Mine'],
          ['shared', 'Ours'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              filter === id ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {sharedGroups.length > 0 && (
        <div className="space-y-4">
          {sharedGroups.map((group) => (
            <section key={group.spaceId} className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
              <h2 className="font-semibold text-violet-900">Shared vision with {group.partnerName}</h2>
              <div className="flex gap-2">
                <input
                  value={sharedTitle[group.spaceId] || ''}
                  onChange={(e) => setSharedTitle((prev) => ({ ...prev, [group.spaceId]: e.target.value }))}
                  placeholder="Add a shared dream or goal..."
                  className="flex-1 px-3 py-2 border rounded-xl text-sm bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    const title = (sharedTitle[group.spaceId] || '').trim();
                    if (!title) return;
                    addSharedVision.mutate({ spaceId: group.spaceId, title });
                    setSharedTitle((prev) => ({ ...prev, [group.spaceId]: '' }));
                  }}
                  disabled={!(sharedTitle[group.spaceId] || '').trim()}
                  className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              {group.items.length === 0 ? (
                <p className="text-sm text-violet-600/70">No shared visions yet.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.items.map((item) => (
                    <VisionCard
                      key={item.id}
                      item={item}
                      members={members}
                      onEdit={() => undefined}
                      onToggle={() => toggleSharedAchieved.mutate({ spaceId: group.spaceId, id: item.id })}
                      onDelete={() => deleteSharedVision.mutate({ spaceId: group.spaceId, id: item.id })}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="h-48 bg-gray-200 rounded-2xl" />)}
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Sparkles size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">{presetFilter ? 'Nothing in this theme yet' : 'Your vision board is empty'}</p>
          <p className="text-sm mt-1">Add dreams, goals, or tap an affirmation above</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayedItems.map((item) => (
            <VisionCard
              key={item.id}
              item={item}
              members={members}
              onEdit={() => openEdit(item)}
              onToggle={() => toggleAchieved.mutate(item.id)}
              onDelete={() => deleteItem.mutate(item.id)}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{editItem ? 'Edit vision' : 'New vision'}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form
              className="p-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (form.title.trim()) saveItem.mutate();
              }}
            >
              <div>
                <label className="block text-sm font-medium mb-1">Dream / goal *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Trip to Japan, new apartment…"
                  className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Why it matters</label>
                <textarea
                  value={form.caption}
                  onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
                  placeholder="A few words to stay motivated…"
                  rows={2}
                  className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <ImageIcon size={14} /> Image link (optional)
                </label>
                <input
                  value={form.imageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="https://…"
                  className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Emoji</label>
                  <input
                    value={form.emoji}
                    onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm text-center text-xl outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">For</label>
                  <select
                    value={form.ownerId}
                    onChange={(e) => setForm((f) => ({ ...f, ownerId: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="">Our household</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Life area</label>
                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  {VISION_CATEGORY_GROUPS.map((group) => (
                    <div key={group.title}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{group.title}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.categories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, category: cat.id, color: cat.color, emoji: f.emoji || cat.emoji }))}
                            className={cn(
                              'px-2 py-1 rounded-full text-[11px] font-medium border transition-colors',
                              form.category === cat.id ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200',
                            )}
                            style={form.category === cat.id ? { backgroundColor: cat.color } : undefined}
                          >
                            {cat.emoji} {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={!form.title.trim() || saveItem.isPending}
                className="w-full py-2.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50"
              >
                {saveItem.isPending ? 'Saving…' : editItem ? 'Save changes' : 'Add to board'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function VisionCard({
  item,
  members,
  onEdit,
  onToggle,
  onDelete,
}: {
  item: VisionBoardItemEnriched;
  members: User[];
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const meta = categoryMeta(item.category);
  const owner = item.ownerId ? members.find((m) => m.id === item.ownerId) : null;

  return (
    <article
      className={cn(
        'group relative rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer',
        item.achieved && 'opacity-75',
      )}
      onClick={onEdit}
    >
      <div
        className="h-32 flex items-center justify-center relative overflow-hidden"
        style={{
          background: item.imageUrl
            ? undefined
            : `linear-gradient(135deg, ${item.color}22, ${item.color}44)`,
        }}
      >
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <span className="text-5xl">{item.emoji || meta.emoji}</span>
        )}
        {item.achieved && (
          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
            <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <Check size={14} /> Achieved
            </span>
          </div>
        )}
      </div>
      <div className="p-4 bg-white">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className={cn('font-semibold text-sm leading-snug', item.achieved && 'line-through text-gray-400')}>
              {item.title}
            </h3>
            {item.caption && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.caption}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-[10px] px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: meta.color }}>
            {meta.label}
          </span>
          {owner ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: owner.color }}>
              {owner.name}
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Ours</span>
          )}
        </div>
      </div>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onToggle}
          className="p-1.5 bg-white/90 rounded-lg shadow text-green-600 hover:bg-white"
          title={item.achieved ? 'Mark active' : 'Mark achieved'}
        >
          <Check size={16} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 bg-white/90 rounded-lg shadow text-red-500 hover:bg-white"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

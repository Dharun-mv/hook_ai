'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star, ArrowLeft, Copy, Check, Trash2, Globe, GlobeOff, TrendingUp } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';

interface SavedHook {
  id: string;
  original_text: string;
  type: string;
  hook_content: string;
  hook_title?: string;
  virality_score?: number;
  psychological_trigger?: string;
  improvement_tip?: string;
  is_published?: boolean;
  actual_views?: number;
  created_at: string;
}

function getViralityBadgeColor(score: number | undefined) {
  if (!score) return { bg: 'bg-neutral-700', text: 'text-neutral-300', border: 'border-neutral-600' };
  if (score >= 80) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/50' };
  if (score >= 50) return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' };
  return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' };
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [savedHooks, setSavedHooks] = useState<SavedHook[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewInputs, setViewInputs] = useState<Record<string, string>>({});
  const [updatingViews, setUpdatingViews] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/');
        return;
      }
      setUser(user);
    });
  }, [router]);

  useEffect(() => {
    if (!user) return;

    supabase
      .from('saved_hooks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setSavedHooks(data);
        }
        setLoading(false);
      });
  }, [user]);

  const handleCopy = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await supabase.from('saved_hooks').delete().eq('id', id);
    setSavedHooks(prev => prev.filter(h => h.id !== id));
  };

  const handlePublishToggle = async (id: string, currentStatus: boolean) => {
    if (!user) return;
    const { error } = await supabase
      .from('saved_hooks')
      .update({ is_published: !currentStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setSavedHooks(prev => prev.map(h => h.id === id ? { ...h, is_published: !currentStatus } : h));
    }
  };

  const handleSaveViews = async (id: string) => {
    const views = viewInputs[id];
    if (!user || !views) return;

    setUpdatingViews(id);
    const { error } = await supabase
      .from('saved_hooks')
      .update({ actual_views: parseInt(views, 10), updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setSavedHooks(prev => prev.map(h => h.id === id ? { ...h, actual_views: parseInt(views, 10) } : h));
      setViewInputs(prev => ({ ...prev, [id]: '' }));
    }
    setUpdatingViews(null);
  };

  if (!user) return null;

  const colors: Record<string, { border: string; bg: string; icon: string }> = {
    'anti-trend': {
      border: 'border-orange-500/50',
      bg: 'bg-orange-500/5',
      icon: 'text-orange-400',
    },
    specificity: {
      border: 'border-purple-500/50',
      bg: 'bg-purple-500/5',
      icon: 'text-purple-400',
    },
    'if-then': {
      border: 'border-blue-500/50',
      bg: 'bg-blue-500/5',
      icon: 'text-blue-400',
    },
  };

  return (
    <div className="min-h-screen bg-black text-neutral-100">
      <Navbar user={user} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/')}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Saved Hooks</h1>
            <p className="text-neutral-400 text-sm">
              Your collection of {savedHooks.length} saved hooks
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-neutral-400">Loading...</div>
        ) : savedHooks.length === 0 ? (
          <div className="text-center py-12">
            <Star className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-neutral-300 mb-2">
              No saved hooks yet
            </h2>
            <p className="text-neutral-500 mb-4">
              Start generating hooks and save your favorites here
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-lg transition-colors"
            >
              Generate Hooks
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {savedHooks.map((savedHook) => {
              const color = colors[savedHook.type] || colors['anti-trend'];
              const viralityColors = getViralityBadgeColor(savedHook.virality_score);
              const isPublished = savedHook.is_published ?? false;

              return (
                <div
                  key={savedHook.id}
                  className={cn(
                    'group p-5 rounded-xl border bg-neutral-900/50 transition-all duration-300 hover:scale-[1.02]',
                    color.border,
                    color.bg
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-neutral-100 max-h-12 overflow-hidden text-ellipsis line-clamp-2" title={savedHook.original_text}>
                      {savedHook.original_text}
                    </h3>
                    <div className="flex items-center gap-1">
                      {/* Virality Score Badge */}
                      <div className={cn(
                        'px-2 py-1 rounded-md border text-xs font-bold mr-1',
                        viralityColors.bg,
                        viralityColors.text,
                        viralityColors.border
                      )}>
                        {savedHook.virality_score ?? 'N/A'}
                      </div>
                      {/* Publish Toggle */}
                      <button
                        onClick={() => handlePublishToggle(savedHook.id, isPublished)}
                        className={cn(
                          'p-1.5 rounded-md transition-colors',
                          isPublished
                            ? 'text-emerald-400 bg-emerald-400/10'
                            : 'text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800'
                        )}
                        title={isPublished ? 'Published' : 'Draft'}
                      >
                        {isPublished ? (
                          <Globe className="w-4 h-4" />
                        ) : (
                          <GlobeOff className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleCopy(savedHook.id, savedHook.hook_content)}
                        className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                        title="Copy hook"
                      >
                        {copiedId === savedHook.id ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(savedHook.id)}
                        className="p-1.5 rounded-md text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                        title="Delete hook"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-400 mb-3">
                    {savedHook.hook_title || savedHook.type.replace('-', ' ')}
                  </p>
                  <p className="text-neutral-200 leading-relaxed text-sm mb-3">
                    {savedHook.hook_content}
                  </p>

                  {/* AI Insights */}
                  {(savedHook.psychological_trigger || savedHook.improvement_tip) && (
                    <div className="mt-3 pt-3 border-t border-neutral-800 space-y-2">
                      {savedHook.psychological_trigger && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Trigger:</span>
                          <span className="text-xs text-neutral-300">{savedHook.psychological_trigger}</span>
                        </div>
                      )}
                      {savedHook.improvement_tip && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Tip:</span>
                          <span className="text-xs text-neutral-300">{savedHook.improvement_tip}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Published Status & Views */}
                  {isPublished && (
                    <div className="mt-3 pt-3 border-t border-neutral-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe className="w-3 h-3 text-emerald-400" />
                        <span className="text-xs font-medium text-emerald-400">Published</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-neutral-400">Views:</span>
                        {savedHook.actual_views ? (
                          <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {savedHook.actual_views.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-500 italic">Not set</span>
                        )}
                        <input
                          type="number"
                          value={viewInputs[savedHook.id] || ''}
                          onChange={(e) => setViewInputs(prev => ({ ...prev, [savedHook.id]: e.target.value }))}
                          placeholder="Enter views"
                          className="w-20 px-2 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                        <button
                          onClick={() => handleSaveViews(savedHook.id)}
                          disabled={updatingViews === savedHook.id || !viewInputs[savedHook.id]}
                          className="px-2 py-1 text-xs bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-700 text-black font-medium rounded transition-colors"
                        >
                          {updatingViews === savedHook.id ? '...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

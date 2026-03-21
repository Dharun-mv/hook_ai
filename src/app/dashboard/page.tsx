'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star, ArrowLeft, Copy, Check, Trash2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';

interface SavedHook {
  id: string;
  original_text: string;
  type: string;
  hook_content: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [savedHooks, setSavedHooks] = useState<SavedHook[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

      <main className="max-w-5xl mx-auto px-4 py-8">
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
                      <button
                        onClick={() =>
                          handleCopy(savedHook.id, savedHook.hook_content)
                        }
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
                    {savedHook.type.replace('-', ' ')}
                  </p>
                  <p className="text-neutral-200 leading-relaxed text-sm">
                    {savedHook.hook_content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

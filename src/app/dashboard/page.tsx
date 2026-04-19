'use client';

import { useState, useEffect } from 'react';
import { Loader2, Trash2, Copy, Check, Zap, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { Navbar } from '@/components/Navbar';
import { deleteHookAction } from '@/app/actions/delete-hook';
import { cn } from '@/lib/utils';
import { Toast } from '@/components/Toast';

interface SavedHook {
  id: string;
  user_id: string;
  hook_content: string;
  hook_text: string;
  hook_type: string;
  virality_score: number;
  platform_fit: string;
  reasoning: string;
  created_at: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [hooks, setHooks] = useState<SavedHook[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchHooks = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Fetch hooks directly
        const { data, error } = await supabase
          .from('saved_hooks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (data && !error) {
          setHooks(data as SavedHook[]);
        } else {
          console.error("Error fetching hooks:", error);
        }
      }
      setLoading(false);
    };

    fetchHooks();
  }, []);

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setToastMessage('Hook copied to clipboard!');
    setTimeout(() => {
      setCopiedId(null);
      setToastMessage(null);
    }, 2000);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    setDeletingId(id);
    
    const result = await deleteHookAction(user.id, id);
    if (result.success) {
      setHooks(prev => prev.filter(h => h.id !== id));
      setToastMessage('Hook deleted successfully');
      setTimeout(() => setToastMessage(null), 2000);
    } else {
      setToastMessage('Error deleting hook');
      setTimeout(() => setToastMessage(null), 2000);
    }
    setDeletingId(null);
  };

  const filteredHooks = hooks.filter(hook => 
    filterPlatform === 'all' ? true : hook.platform_fit === filterPlatform
  );

  const getViralityColor = (score: number) => {
    if (score >= 80) return 'text-green-400 bg-green-400/10 border-green-500/20';
    if (score >= 50) return 'text-yellow-400 bg-yellow-400/10 border-yellow-500/20';
    return 'text-red-400 bg-red-400/10 border-red-500/20';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-neutral-100 flex flex-col">
        <Navbar user={user} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-neutral-100 flex flex-col">
        <Navbar user={null} />
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <AlertCircle className="w-12 h-12 text-neutral-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-neutral-400 mb-6 text-center max-w-sm">
            You must be signed in to view your Pro Dashboard and access your connected UI metrics.
          </p>
          <a
            href="/login"
            className="px-6 py-2 bg-emerald-500 text-black font-medium rounded-lg hover:bg-emerald-400 transition-colors"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-neutral-100">
      <Navbar user={user} />

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Pro Library</h1>
            <p className="text-neutral-400">Manage and analyze your high-converting hooks.</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-400">Filter by Platform:</span>
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer"
            >
              <option value="all">All Platforms</option>
              <option value="tiktok">🎵 TikTok</option>
              <option value="x">✕ X (Twitter)</option>
              <option value="linkedin">💼 LinkedIn</option>
              <option value="instagram">📸 Instagram</option>
            </select>
          </div>
        </div>

        {filteredHooks.length === 0 ? (
          <div className="text-center py-20 bg-neutral-900/30 border border-neutral-800 rounded-2xl">
            <h3 className="text-xl font-medium mb-2">No hooks found</h3>
            <p className="text-neutral-500">
              {hooks.length === 0 
                ? "You haven't saved any hooks yet."
                : "No hooks match the selected platform filter."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredHooks.map((hook) => {
              // The database has hook_text but some legacy might have hook_content
              const contentValue = hook.hook_text || hook.hook_content;
              const isDeleting = deletingId === hook.id;

              return (
                <div 
                  key={hook.id} 
                  className={cn(
                    "flex flex-col p-5 rounded-xl border border-neutral-800 bg-neutral-900/50 transition-all",
                    isDeleting && "opacity-50 pointer-events-none"
                  )}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 bg-neutral-800 border border-neutral-700 rounded-md uppercase font-medium">
                        {hook.platform_fit || 'general'}
                      </span>
                      {hook.virality_score && (
                        <div className={cn(
                          "flex items-center gap-1 text-xs px-2 py-1 rounded-md border font-bold",
                          getViralityColor(hook.virality_score)
                        )}>
                          <Zap className="w-3 h-3" />
                          {hook.virality_score}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(hook.id, contentValue)}
                        className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors"
                        title="Copy text"
                      >
                        {copiedId === hook.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(hook.id)}
                        disabled={isDeleting}
                        className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-md transition-colors"
                        title="Delete hook"
                      >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Card Body */}
                  <p className="text-sm text-neutral-200 mb-4 whitespace-pre-wrap flex-1">
                    {contentValue}
                  </p>

                  {/* Pro Reasoning */}
                  {hook.reasoning && (
                    <div className="mt-4 pt-4 border-t border-neutral-800">
                      <p className="text-xs text-neutral-500 font-medium mb-1 uppercase tracking-wide">AI Reasoning</p>
                      <p className="text-xs text-neutral-400">
                        {hook.reasoning}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastMessage.includes("Error") ? "error" : "success"}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}

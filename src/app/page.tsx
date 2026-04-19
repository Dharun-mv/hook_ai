'use client';

import { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Loader2, AlertCircle, LogIn } from 'lucide-react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { HookCard } from '@/components/HookCard';
import { Toast } from '@/components/Toast';
import { Hook } from '@/lib/hooks-generator';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { saveHookAction } from '@/app/actions/save-hook';
import { cn } from '@/lib/utils';

const GUEST_LIMIT = 5;

interface EnrichedHook extends Hook {
  virality_score: number;
  psychological_trigger: string;
  improvement_tip: string;
  reasoning?: string;
  platform_fit?: 'tiktok' | 'x' | 'linkedin' | 'instagram';
  score?: number;
}

interface HookWithSavedState extends EnrichedHook {
  savedHookId?: string;
  isSaved?: boolean;
}

export default function Home() {
  const [input, setInput] = useState('');
  const [hooks, setHooks] = useState<HookWithSavedState[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [guestCount, setGuestCount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [generatedInput, setGeneratedInput] = useState('');
  const [mounted, setMounted] = useState(false);
  const [platform, setPlatform] = useState<'tiktok' | 'x' | 'linkedin' | 'instagram'>('tiktok');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (supabase) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        setUser(user);
      });
    }
  }, []);

  useEffect(() => {
    if (!user && mounted) {
      const count = localStorage.getItem('guest_usage_count') || '0';
      setGuestCount(parseInt(count, 10));
    }

    // Load saved platform preference
    const savedPlatform = localStorage.getItem('platform_preference') as 'tiktok' | 'x' | 'linkedin' | 'instagram';
    if (savedPlatform && ['tiktok', 'x', 'linkedin', 'instagram'].includes(savedPlatform)) {
      setPlatform(savedPlatform);
    }
  }, [user, mounted]);

  useEffect(() => {
    if (!user || !hooks || hooks.length === 0) return;

    const checkSavedStatus = async () => {
      const hookContents = hooks.map(h => h.content);
      const { data } = await supabase
        .from('saved_hooks')
        .select('id, hook_content')
        .eq('user_id', user.id)
        .in('hook_content', hookContents);

      if (data) {
        setHooks(prev => {
          if (!prev) return prev;
          return prev.map(h => ({
            ...h,
            isSaved: !!data.find(d => d.hook_content === h.content),
            savedHookId: data.find(d => d.hook_content === h.content)?.id,
          }));
        });
      }
    };

    checkSavedStatus();
  }, [user, hooks?.length]);

  const showCopyToast = () => {
    setToastMessage('Copied to clipboard!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const showSaveToast = () => {
    setToastMessage('Hook saved successfully!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const showAuthRequiredToast = () => {
    setToastMessage('Sign in to save your favorite hooks!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleGenerate = async () => {
    if (!input.trim()) return;

    if (!user && guestCount >= GUEST_LIMIT) {
      setError('You have reached the free limit. Sign in for unlimited hooks!');
      return;
    }

    setLoading(true);
    setError(null);
    setHooks(null);
    setStreaming(true);
    setGeneratedInput(input.trim());

    try {
      let token = null;
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token;
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ input: input.trim(), platform }),
      });

      if (response.status === 403) {
        const data = await response.json();
        setError(data.error || 'Sign in to continue');
        setLoading(false);
        setStreaming(false);
        return;
      }

      if (response.status >= 500) {
        setToastMessage('Server Maintenance');
        setLoading(false);
        setStreaming(false);
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate hooks');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      let done = false;
      let accumulatedText = '';

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;

          let fixStr = accumulatedText.replace(/^```json\s*/, '').replace(/```\s*$/, '');
          let parsed = null;

          try { parsed = JSON.parse(fixStr); } catch (e) {
            try { parsed = JSON.parse(fixStr + '"}'); } catch (e) {
              try { parsed = JSON.parse(fixStr + '"]}'); } catch (e) {
                try { parsed = JSON.parse(fixStr + '}]}'); } catch (e) {
                  try { parsed = JSON.parse(fixStr + '"}]}'); } catch (e) {}
                }
              }
            }
          }

          if (parsed?.hooks && Array.isArray(parsed.hooks)) {
            setHooks(parsed.hooks);
          }
        }
      }

      if (!user) {
        const newCount = guestCount + 1;
        localStorage.setItem('guest_usage_count', newCount.toString());
        setGuestCount(newCount);
      }

      // Save platform preference
      localStorage.setItem('platform_preference', platform);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate hooks');
      setLoading(false);
      setStreaming(false);
      return;
    }

    setLoading(false);
    setStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const isGuestAtLimit = !user && guestCount >= GUEST_LIMIT;

  return (
    <div className="min-h-screen bg-black text-neutral-100">
      <Navbar user={user} />

      <main className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-sm text-neutral-400 mb-6">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            AI-Powered Hook Generator
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-neutral-100 via-white to-neutral-400 bg-clip-text text-transparent">
            Transform Your Text Into<br />Viral Social Media Hooks
          </h1>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto">
            Leverage psychological triggers to craft scroll-stopping hooks that drive engagement.
          </p>
        </div>

        {!user && (
          <div className="max-w-2xl mx-auto mb-8 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-neutral-300">
                <span className="font-semibold text-emerald-400">Enjoying the tool?</span> Sign in for unlimited hooks!
              </p>
            </div>
            <Link
              href="/login"
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              Sign In
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {mounted && (
          <div className="max-w-md mx-auto mb-8">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-neutral-400">
                {user ? 'Unlimited Member' : 'Guest Usage'}
              </span>
              <span className={user ? 'text-emerald-400' : (guestCount >= GUEST_LIMIT - 1 ? 'text-orange-400' : 'text-emerald-400')}>
                {user ? 'Unlimited daily hooks' : `${GUEST_LIMIT - guestCount} remaining`}
              </span>
            </div>
            {!user && (
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    guestCount >= GUEST_LIMIT - 1 ? 'bg-orange-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${(guestCount / GUEST_LIMIT) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        <div className="max-w-2xl mx-auto mb-12">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste your boring text here..."
              className="w-full h-32 px-4 py-3 pb-14 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 resize-none transition-all"
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-3">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all cursor-pointer"
              >
                <option value="tiktok">🎵 TikTok</option>
                <option value="x">✕ X (Twitter)</option>
                <option value="linkedin">💼 LinkedIn</option>
                <option value="instagram">📸 Instagram</option>
              </select>

              {isGuestAtLimit ? (
                <a
                  href="/auth"
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg font-medium transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In to Continue
                </a>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={(loading || streaming) || !input.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-black rounded-lg font-medium transition-all"
                >
                  {loading || streaming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {streaming ? 'Streaming...' : 'Generating...'}
                    </>
                  ) : (
                    <>
                      Deconstruct
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="max-w-md mx-auto p-4 rounded-xl border border-red-500/50 bg-red-500/5 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-400 mb-1">Generation Failed</h3>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        )}

        {hooks && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-center text-neutral-300">
              Your Viral Hooks
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {hooks.map((hook, index) => (
                <HookCard
                  key={hook.id || index}
                  hook={hook}
                  user={user}
                  originalText={generatedInput}
                  isSaved={hook.isSaved}
                  savedHookId={hook.savedHookId}
                  onCopy={showCopyToast}
                  onSave={showSaveToast}
                  onRequireAuth={showAuthRequiredToast}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {toastMessage && (
        <Toast
          message={toastMessage}
          type="success"
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}

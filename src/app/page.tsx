'use client';

import { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { HookCard } from '@/components/HookCard';
import { UpgradeModal } from '@/components/UpgradeModal';
import { Toast } from '@/components/Toast';
import { Hook } from '@/lib/hooks-generator';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

const ANON_LIMIT = 2;
const FREE_TIER_LIMIT = 5;

export default function Home() {
  const [input, setInput] = useState('');
  const [hooks, setHooks] = useState<Hook[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [usageCount, setUsageCount] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [anonId, setAnonId] = useState<string>('');

  // Get or create anonymous ID
  useEffect(() => {
    let id = localStorage.getItem('anon_id');
    if (!id) {
      id = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('anon_id', id);
    }
    setAnonId(id);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  // Track usage - runs whenever user or anonId changes
  useEffect(() => {
    if (user) {
      // Logged in user - check user_usage table for persistent count
      supabase
        .from('user_usage')
        .select('count')
        .eq('user_id', user.id)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            // No record yet - check usage_logs for today's count
            supabase
              .from('usage_logs')
              .select('created_at', { count: 'exact' })
              .eq('user_id', user.id)
              .gte('created_at', new Date().toISOString().split('T')[0])
              .then(({ count }) => {
                setUsageCount(count || 0);
              });
          } else {
            setUsageCount(data.count || 0);
          }
        });
    } else if (anonId) {
      // Anonymous user - count from localStorage (only after anonId is set)
      const count = localStorage.getItem('anon_usage_count') || '0';
      setUsageCount(parseInt(count, 10));
    }
  }, [user, anonId]);

  const showCopyToast = () => {
    setToastMessage('Copied to clipboard!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const showSaveToast = () => {
    setToastMessage('Hook saved successfully!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleGenerate = async () => {
    if (!input.trim()) return;

    const limit = user ? FREE_TIER_LIMIT : ANON_LIMIT;

    if (usageCount >= limit) {
      setShowUpgradeModal(true);
      return;
    }

    setLoading(true);
    setError(null);
    setHooks(null);
    setStreaming(true);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ input: input.trim() }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      let done = false;
      let accumulatedText = '';
      const partialHooks: Hook[] = [];

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          const chunk = decoder.decode(value);
          for (const line of chunk.split('\n')) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                if (data.error) {
                  setError(data.error);
                  setLoading(false);
                  setStreaming(false);
                  return;
                }
                if (data.chunk) {
                  accumulatedText += data.chunk;
                  
                  // Strip markdown codeblocks
                  let fixStr = accumulatedText.replace(/^```json\s*/, '').replace(/```\s*$/, '');
                  let parsed = null;
                  
                  // Progressive strict JSON auto-completion to parse chunks mid-stream
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
                    setHooks([...parsed.hooks]);
                  }
                }
                if (data.done && data.hooks) {
                  setHooks(data.hooks);
                  setUsageCount(data.usageCount || 0);
                }
              } catch {
                // Skip invalid JSON lines
              }
            }
          }
        }
      }

      // For anonymous users, increment local count
      if (!token) {
        const newCount = usageCount + 1;
        localStorage.setItem('anon_usage_count', newCount.toString());
        setUsageCount(newCount);
      }
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

  const limit = user ? FREE_TIER_LIMIT : ANON_LIMIT;
  const remaining = Math.max(0, limit - usageCount);

  return (
    <div className="min-h-screen bg-black text-neutral-100">
      <Navbar user={user} />

      <main className="max-w-5xl mx-auto px-4 py-16">
        {/* Hero Section */}
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

        {/* Credits Display */}
        <div className="max-w-md mx-auto mb-8">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-neutral-400">
              {user ? 'Free Tier' : 'Anonymous'} Usage
            </span>
            <span className={remaining <= 1 ? 'text-orange-400' : 'text-emerald-400'}>
              {remaining} remaining today
            </span>
          </div>
          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                remaining <= 1 ? 'bg-orange-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${(usageCount / limit) * 100}%` }}
            />
          </div>
        </div>

        {/* Input Section */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste your boring text here..."
              className="w-full h-32 px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 resize-none transition-all"
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-3">
              {!user && (
                <span className="text-xs text-neutral-500 mr-2">
                  Sign in to save your hooks
                </span>
              )}
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
            </div>
          </div>
        </div>

        {/* Output Section */}
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
              {hooks.map((hook) => (
                <HookCard
                  key={hook.id}
                  hook={hook}
                  user={user}
                  onCopy={showCopyToast}
                  onSave={showSaveToast}
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

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentLimit={limit}
      />
    </div>
  );
}

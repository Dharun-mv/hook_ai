'use client';

import { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { HookCard } from '@/components/HookCard';
import { Toast } from '@/components/Toast';
import { Hook } from '@/lib/hooks-generator';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export default function Home() {
  const [input, setInput] = useState('');
  const [hooks, setHooks] = useState<Hook[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [generatedInput, setGeneratedInput] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get user if logged in
  useEffect(() => {
    if (supabase) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        setUser(user);
      });
    }
  }, []);

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

    setLoading(true);
    setError(null);
    setHooks(null);
    setStreaming(true);
    setGeneratedInput(input.trim());

    try {
      // Get auth token if user is logged in
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
        body: JSON.stringify({ input: input.trim() }),
      });

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
                  originalText={generatedInput}
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
    </div>
  );
}

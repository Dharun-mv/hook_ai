'use client';

import { useState } from 'react';
import { Star, Copy, Check, Zap, Brain, TrendingUp } from 'lucide-react';
import { Hook } from '@/lib/hooks-generator';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { saveHookAction } from '@/app/actions/save-hook';

interface HookCardProps {
  hook: Hook;
  user: User | null;
  originalText?: string;
  isSaved?: boolean;
  onCopy?: () => void;
  onSave?: () => void;
}

const icons = {
  'anti-trend': Zap,
  specificity: Brain,
  'if-then': TrendingUp,
};

const colors = {
  'anti-trend': {
    border: 'border-orange-500/50',
    bg: 'bg-orange-500/5',
    icon: 'text-orange-400',
    glow: 'shadow-orange-500/20',
  },
  specificity: {
    border: 'border-purple-500/50',
    bg: 'bg-purple-500/5',
    icon: 'text-purple-400',
    glow: 'shadow-purple-500/20',
  },
  'if-then': {
    border: 'border-blue-500/50',
    bg: 'bg-blue-500/5',
    icon: 'text-blue-400',
    glow: 'shadow-blue-500/20',
  },
};

export function HookCard({ hook, user, originalText, isSaved, onCopy, onSave }: HookCardProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(isSaved);
  const [loading, setLoading] = useState(false);

  const Icon = icons[hook.type];
  const color = colors[hook.type];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(hook.content);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!user || !originalText) return;
    setLoading(true);

    if (saved) {
      await supabase.from('saved_hooks').delete().eq('hook_content', hook.content);
      setSaved(false);
    } else {
      const result = await saveHookAction(originalText, hook.content, hook.type);
      if (result.success) {
        setSaved(true);
        onSave?.();
      } else {
        console.error('Failed to save hook', result.error);
      }
    }

    setLoading(false);
  };

  return (
    <div
      className={cn(
        'group relative p-5 rounded-xl border bg-neutral-900/50 transition-all duration-300 hover:scale-[1.02]',
        color.border,
        color.bg,
        'hover:shadow-lg',
        color.glow
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('w-5 h-5', color.icon)} />
          <h3 className="font-semibold text-neutral-100">{hook.title}</h3>
        </div>
        <div className="flex items-center gap-1">
          {user && (
            <button
              onClick={handleSave}
              disabled={loading || saved}
              className={cn(
                'p-1.5 flex items-center gap-1 rounded-md transition-colors',
                saved
                  ? 'text-emerald-400 bg-emerald-400/10'
                  : 'text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800'
              )}
              title="Save hook"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span className="text-xs font-medium">Saved!</span>
                </>
              ) : (
                <Star className="w-4 h-4" />
              )}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Copy hook"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <p className="text-sm text-neutral-400 mb-3">{hook.description}</p>
      <p className="text-neutral-200 leading-relaxed">{hook.content}</p>
    </div>
  );
}

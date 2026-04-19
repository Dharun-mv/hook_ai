'use client';

import { useState, useEffect } from 'react';
import { Star, Copy, Check, Zap, Brain, TrendingUp, Globe, GlobeOff } from 'lucide-react';
import { Hook } from '@/lib/hooks-generator';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { saveHookAction } from '@/app/actions/save-hook';

function getPlatformIcon(platform: string) {
  switch (platform) {
    case 'tiktok': return '🎵';
    case 'x': return '✕';
    case 'linkedin': return '💼';
    case 'instagram': return '📸';
    case 'youtube': return '▶️';
    default: return '📱';
  }
}

interface HookCardProps {
  hook: Hook;
  user: User | null;
  originalText?: string;
  isSaved?: boolean;
  savedHookId?: string;
  onCopy?: () => void;
  onSave?: () => void;
  onRequireAuth?: () => void;
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

function getViralityBadgeColor(score: number | undefined) {
  if (!score) return { bg: 'bg-neutral-700', text: 'text-white', border: 'border-neutral-600' };
  if (score >= 80) return { bg: 'bg-green-500', text: 'text-white', border: 'border-green-500' };
  if (score >= 50) return { bg: 'bg-yellow-500', text: 'text-black', border: 'border-yellow-500' };
  return { bg: 'bg-red-500', text: 'text-white', border: 'border-red-500' };
}

export function HookCard({ hook, user, originalText, isSaved, savedHookId, onCopy, onSave, onRequireAuth }: HookCardProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(isSaved);
  const [loading, setLoading] = useState(false);
  const [isPublished, setIsPublished] = useState(hook.is_published ?? false);
  const [actualViews, setActualViews] = useState(hook.actual_views?.toString() ?? '');
  const [viewsInput, setViewsInput] = useState('');
  const [updatingViews, setUpdatingViews] = useState(false);

  const hookType = hook.hook_type || 'anti-trend';
  const viralityScore = hook.score || hook.virality_score || 0;
  const Icon = icons[hookType];
  const color = colors[hookType];
  const badgeStyles = getViralityBadgeColor(viralityScore);
  const psychologicalTrigger = hook.psychological_trigger || 'Curiosity Gap';
  const improvementTip = hook.improvement_tip || 'Focus on clear delivery';
  const platformFit = hook.platform_fit || 'tiktok';
  const reasoning = hook.reasoning || 'Creates curiosity through unexpected framing';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(hook.content);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!user) {
      onRequireAuth?.();
      return;
    }
    if (!originalText) return;

    setLoading(true);

    if (saved) {
      await supabase.from('saved_hooks').delete().eq('hook_content', hook.content);
      setSaved(false);
    } else {
      const result = await saveHookAction(
        user.id,
        originalText,
        hook.content,
        hookType,
        hook.title,
        undefined,
        viralityScore,
        psychologicalTrigger,
        improvementTip,
        platformFit,
        reasoning
      );
      if (result.success) {
        setSaved(true);
        onSave?.();
      } else {
        console.error('Failed to save hook', result.error);
      }
    }

    setLoading(false);
  };

  const handlePublishToggle = async () => {
    if (!user || !savedHookId) return;

    setLoading(true);
    const { error } = await supabase
      .from('saved_hooks')
      .update({ is_published: !isPublished, updated_at: new Date().toISOString() })
      .eq('id', savedHookId);

    if (error) {
      console.error('Failed to toggle publish status', error);
    } else {
      setIsPublished(!isPublished);
    }
    setLoading(false);
  };

  const handleSaveViews = async () => {
    if (!user || !savedHookId || !viewsInput) return;

    setLoading(true);
    setUpdatingViews(true);
    const views = parseInt(viewsInput, 10);

    const { error } = await supabase
      .from('saved_hooks')
      .update({
        actual_views: views,
        updated_at: new Date().toISOString()
      })
      .eq('id', savedHookId);

    if (error) {
      console.error('Failed to save views', error);
    } else {
      setActualViews(viewsInput);
      setViewsInput('');
    }
    setUpdatingViews(false);
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
          <h3 className="font-semibold text-neutral-100">{hook.title || hookType}</h3>
        </div>
        <div className="flex items-center gap-1">
          {/* Platform Fit Badge */}
          <div className="px-2 py-1 rounded-md border border-neutral-600 bg-neutral-800 text-xs mr-1" title={`Best for ${platformFit}`}>
            {getPlatformIcon(platformFit)}
          </div>
          {/* Virality Score Badge */}
          <div className={cn(
            'px-2 py-1 rounded-md border text-xs font-bold mr-1',
            badgeStyles.bg,
            badgeStyles.text,
            badgeStyles.border
          )}>
            {viralityScore !== undefined ? `${viralityScore}` : 'N/A'}
          </div>
          {user && savedHookId && (
            <button
              onClick={handlePublishToggle}
              disabled={loading}
              className={cn(
                'p-1.5 flex items-center gap-1 rounded-md transition-colors',
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
          )}
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
      <p className="text-neutral-100 leading-relaxed mb-3 whitespace-pre-wrap break-words overflow-visible">{hook.content}</p>

      {/* AI Insights Section */}
      {(reasoning || psychologicalTrigger || improvementTip) && (
        <div className="mt-4 pt-3 border-t border-neutral-800 space-y-2">
          {reasoning && (
            <div className="flex items-start gap-2">
              <span className="text-xs font-medium text-emerald-500 uppercase tracking-wide">Why it works:</span>
              <span className="text-xs text-neutral-300">{reasoning}</span>
            </div>
          )}
          {psychologicalTrigger && (
            <div className="flex items-start gap-2">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Trigger:</span>
              <span className="text-xs text-neutral-300">{psychologicalTrigger}</span>
            </div>
          )}
          {improvementTip && (
            <div className="flex items-start gap-2">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Tip:</span>
              <span className="text-xs text-neutral-300">{improvementTip}</span>
            </div>
          )}
        </div>
      )}

      {/* Publish Status & Actual Views */}
      {user && savedHookId && isPublished && (
        <div className="mt-3 pt-3 border-t border-neutral-800">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-3 h-3 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">Published</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">Actual Views:</span>
            {actualViews ? (
              <span className="text-xs text-neutral-300 font-mono">{actualViews}</span>
            ) : (
              <span className="text-xs text-neutral-500 italic">Not set</span>
            )}
            <input
              type="number"
              value={viewsInput}
              onChange={(e) => setViewsInput(e.target.value)}
              placeholder="Enter views"
              className="w-24 px-2 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
            <button
              onClick={handleSaveViews}
              disabled={updatingViews || !viewsInput}
              className="px-2 py-1 text-xs bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-700 text-black font-medium rounded transition-colors"
            >
              {updatingViews ? '...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

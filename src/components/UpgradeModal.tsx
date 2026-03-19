'use client';

import { Sparkles, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLimit: number;
}

export function UpgradeModal({ isOpen, onClose, currentLimit }: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mb-4">
            <Sparkles className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Upgrade to Pro</h2>
          <p className="text-neutral-400">
            You&apos;ve reached your daily limit of {currentLimit} generations.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-neutral-300">
            <Check className="w-5 h-5 text-emerald-400" />
            <span>Unlimited daily generations</span>
          </div>
          <div className="flex items-center gap-3 text-neutral-300">
            <Check className="w-5 h-5 text-emerald-400" />
            <span>Save unlimited hooks</span>
          </div>
          <div className="flex items-center gap-3 text-neutral-300">
            <Check className="w-5 h-5 text-emerald-400" />
            <span>Priority AI processing</span>
          </div>
          <div className="flex items-center gap-3 text-neutral-300">
            <Check className="w-5 h-5 text-emerald-400" />
            <span>Advanced hook templates</span>
          </div>
        </div>

        <button className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg transition-colors">
          Upgrade Now
        </button>

        <p className="text-center text-sm text-neutral-500 mt-4">
          Starting at $9/month
        </p>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Sparkles, LogIn, LogOut, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface NavbarProps {
  user: User | null;
}

export function Navbar({ user }: NavbarProps) {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    await supabase.auth.signInWithOtp({
      email: 'placeholder',
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    // Redirect to login page for actual email input
    window.location.href = '/login';
  };

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-neutral-800 bg-black/80 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <span className="font-semibold text-neutral-100">Hook-Architect AI</span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-300 hover:text-white transition-colors"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <span className="text-sm text-neutral-400 hidden sm:inline">
                {user.email}
              </span>
              <button
                onClick={handleSignOut}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-300 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

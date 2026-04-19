-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_usage table for persistent limit tracking
CREATE TABLE IF NOT EXISTS user_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,
  count INTEGER DEFAULT 0,
  last_reset TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE 'utc' NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE 'utc' NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE 'utc' NOW(),
  plan TEXT DEFAULT 'free'
);

-- Create trending_benchmarks table for few-shot learning
CREATE TABLE IF NOT EXISTS trending_benchmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hook_text TEXT NOT NULL,
  hook_type TEXT NOT NULL,
  psychological_trigger TEXT,
  view_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2),
  platform TEXT DEFAULT 'tiktok',
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE 'utc' NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE 'utc' NOW()
);

-- Create saved_hooks table with exact column names for Hook-Architect AI
CREATE TABLE IF NOT EXISTS saved_hooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  hook_text TEXT NOT NULL,
  hook_type TEXT NOT NULL,
  virality_score INTEGER NOT NULL DEFAULT 50,
  psychological_trigger TEXT,
  improvement_tip TEXT,
  status TEXT DEFAULT 'draft',
  actual_views BIGINT DEFAULT 0,
  original_text TEXT,
  platform_fit TEXT DEFAULT 'tiktok',
  reasoning TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE 'utc' NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE 'utc' NOW()
);

-- Create usage_logs table for tracking credits
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  input_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE 'utc' NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_hooks_user_id ON saved_hooks(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_hooks_hook_id ON saved_hooks(hook_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_trending_benchmarks_views ON trending_benchmarks(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_saved_hooks_published ON saved_hooks(is_published);

-- Enable Row Level Security (RLS)
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_hooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trending_benchmarks ENABLE ROW LEVEL SECURITY;

-- Policies for user_usage
CREATE POLICY "Users can view their own usage"
  ON user_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage"
  ON user_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage"
  ON user_usage FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies for saved_hooks
CREATE POLICY "Users can view their own saved hooks"
  ON saved_hooks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved hooks"
  ON saved_hooks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved hooks"
  ON saved_hooks FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved hooks"
  ON saved_hooks FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies for usage_logs
CREATE POLICY "Users can view their own usage logs"
  ON usage_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage logs"
  ON usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policies for trending_benchmarks (public read, admin write)
CREATE POLICY "Anyone can view trending benchmarks"
  ON trending_benchmarks FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert benchmarks"
  ON trending_benchmarks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update benchmarks"
  ON trending_benchmarks FOR UPDATE
  USING (true);

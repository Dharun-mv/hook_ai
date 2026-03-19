-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create saved_hooks table
CREATE TABLE IF NOT EXISTS saved_hooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  hook_id TEXT NOT NULL,
  hook_type TEXT NOT NULL,
  hook_content TEXT NOT NULL,
  hook_title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE 'utc' NOW()
);

-- Create usage_logs table for tracking credits
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  input_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE 'utc' NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_saved_hooks_user_id ON saved_hooks(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_hooks_hook_id ON saved_hooks(hook_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE saved_hooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

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

-- Policies for usage_logs
CREATE POLICY "Users can view their own usage logs"
  ON usage_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage logs"
  ON usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

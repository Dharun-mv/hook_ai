export interface Hook {
  id?: string | null;
  content: string;
  hook_text?: string;
  hook_type: 'anti-trend' | 'specificity' | 'if-then';
  virality_score: number;
  score?: number;
  psychological_trigger: string;
  improvement_tip: string;
  reasoning?: string;
  platform_fit?: 'tiktok' | 'x' | 'linkedin' | 'instagram';
  status?: string;
  actual_views?: number;
  original_text?: string;
  title?: string;
  description?: string;
  is_published?: boolean;
}

export function generateHooks(input: string): Hook[] {
  // Mock fallback - returns empty array when API is unavailable
  return [];
}

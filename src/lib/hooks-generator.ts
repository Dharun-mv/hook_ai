export interface Hook {
  id?: string | null;
  hook_text: string;
  hook_type: 'anti-trend' | 'specificity' | 'if-then';
  virality_score: number;
  psychological_trigger: string;
  improvement_tip: string;
  status?: string;
  actual_views?: number;
  original_text?: string;
}

export function generateHooks(input: string): Hook[] {
  // Mock fallback - returns empty array when API is unavailable
  return [];
}

export interface Hook {
  id: string;
  type: 'anti-trend' | 'specificity' | 'if-then';
  title: string;
  content: string;
  description: string;
  virality_score?: number;
  psychological_trigger?: string;
  improvement_tip?: string;
  is_published?: boolean;
  actual_views?: number;
}

export interface EnrichedHook extends Hook {
  virality_score: number;
  psychological_trigger: string;
  improvement_tip: string;
}

export function generateHooks(input: string): Hook[] {
  // Mock fallback - returns empty array when API is unavailable
  return [];
}

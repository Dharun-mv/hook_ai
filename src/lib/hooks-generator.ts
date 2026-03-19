export interface Hook {
  id: string;
  type: 'anti-trend' | 'specificity' | 'if-then';
  title: string;
  content: string;
  description: string;
}

export function generateHooks(input: string): Hook[] {
  // Mock fallback - returns empty array when API is unavailable
  return [];
}

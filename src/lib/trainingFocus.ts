import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TrainingFocus {
  athleteId: string;
  // Sliders: 0-4 (0=Weak, 1=Below, 2=Average, 3=Above, 4=Elite)
  contactLevel: number;
  powerLevel: number;
  // Struggles
  struggles: string[];
  // Plate coverage: 0=Weak, 1=Average, 2=Strong
  plateCoverageInside: number;
  plateCoverageMiddle: number;
  plateCoverageOutside: number;
  // Handedness for display
  handedness: 'R' | 'L' | 'S'; // Right, Left, Switch
  // Free text
  notes: string;
  // Metadata
  updatedAt: string; // ISO date
}

export type StruggleKey =
  | 'grounders'
  | 'popups'
  | 'swingmiss'
  | 'weakcontact'
  | 'outsidepitch'
  | 'cantpull';

export const STRUGGLE_LABELS: Record<StruggleKey, string> = {
  grounders: 'Hits too many grounders',
  popups: 'Pops the ball up',
  swingmiss: 'Swings and misses',
  weakcontact: 'Weak contact (off end/handle)',
  outsidepitch: 'Struggles with outside pitches',
  cantpull: "Can't pull / too much oppo",
};

export const LEVEL_LABELS = ['Weak', 'Below Avg', 'Average', 'Above Avg', 'Elite'];
export const COVERAGE_LABELS = ['Weak', 'Average', 'Strong'];

const KEY_PREFIX = 'nextsport_training_focus_';

export async function getTrainingFocus(athleteId: string): Promise<TrainingFocus | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + athleteId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveTrainingFocus(focus: TrainingFocus): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_PREFIX + focus.athleteId, JSON.stringify(focus));
  } catch {}
}

export function needsWeeklyCheckin(focus: TrainingFocus | null): boolean {
  if (!focus) return true; // Never filled out
  const updated = new Date(focus.updatedAt);
  const daysSince = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince >= 7;
}

export function defaultFocus(athleteId: string): TrainingFocus {
  return {
    athleteId,
    contactLevel: 2,
    powerLevel: 2,
    struggles: [],
    plateCoverageInside: 1,
    plateCoverageMiddle: 1,
    plateCoverageOutside: 1,
    handedness: 'R',
    notes: '',
    updatedAt: new Date(0).toISOString(), // epoch = needs checkin
  };
}

/**
 * LLM-free drill picker: maps training focus inputs to drill IDs from drills.ts
 * Uses rule-based scoring to pick top 3 most relevant drills
 */
export function pickTopDrills(focus: TrainingFocus): { id: string; reason: string }[] {
  const scores: Record<string, { score: number; reason: string }> = {};

  function add(id: string, score: number, reason: string) {
    if (!scores[id]) scores[id] = { score: 0, reason };
    scores[id].score += score;
    if (score > (scores[id]?.score || 0) * 0.5) scores[id].reason = reason;
  }

  // Struggles → drills
  if (focus.struggles.includes('grounders')) {
    add('hip-02', 3, 'Fix chopping swing → hip drive creates launch angle');
    add('batpath-01', 3, 'Fix bat path causing ground balls');
    add('batpower-01', 2, 'Build rotational power to elevate contact');
  }
  if (focus.struggles.includes('swingmiss')) {
    add('contact-01', 3, 'Map contact zones to reduce misses');
    add('batpath-01', 2, 'PVC path drill improves barrel accuracy');
  }
  if (focus.struggles.includes('popups')) {
    add('hip-01', 3, 'Hip rotation prevents uppercutting');
    add('batpath-02', 3, 'Connection drill fixes casting that causes pop-ups');
  }
  if (focus.struggles.includes('weakcontact')) {
    add('batpath-01', 3, 'PVC drill improves bat path efficiency');
    add('batpath-03', 3, 'One-hand drill isolates weak hand contribution');
    add('hip-02', 2, 'Hip drive adds power to contact');
  }
  if (focus.struggles.includes('outsidepitch')) {
    add('contact-01', 3, 'Tee zone mapping for outside coverage');
    add('batpath-03', 2, 'Bottom-hand control for outside path');
  }
  if (focus.struggles.includes('cantpull')) {
    add('hip-01', 2, 'Hip rotation enables pull-side power');
    add('batpath-02', 2, 'Connection keeps hands inside for pull');
  }

  // Low power → add rotational/power drills
  if (focus.powerLevel <= 1) {
    add('batpower-01', 3, 'Build rotational power — below average vs peers');
    add('hip-03', 2, 'Resistance band hip load for power');
    add('pitch-03', 1, 'Med ball power work transfers to swing');
  }

  // Low contact → fundamentals
  if (focus.contactLevel <= 1) {
    add('batpath-01', 2, 'Contact fundamentals with PVC');
    add('contact-01', 2, 'Tee zone mapping for all pitch locations');
  }

  // Weak outside plate coverage
  if (focus.plateCoverageOutside === 0) {
    add('contact-01', 2, 'Tee drill for outside zone coverage');
    add('batpath-03', 2, 'Bottom-hand control for outside pitch');
  }

  // Weak inside
  if (focus.plateCoverageInside === 0) {
    add('hip-02', 2, 'Hip drive needed for inside pitch power');
    add('follow-01', 2, 'Extension through inside pitch');
  }

  // Sort by score, take top 3
  const sorted = Object.entries(scores)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 3);

  // Fallback if no inputs given
  if (sorted.length === 0) {
    return [
      { id: 'hip-02', reason: 'Foundation: hip-driven swing' },
      { id: 'batpath-01', reason: 'Foundation: clean bat path mechanics' },
      { id: 'contact-01', reason: 'Foundation: know your contact zones' },
    ];
  }

  // Pad to 3 if fewer
  const fallbacks = ['hip-02', 'batpath-01', 'contact-01'];
  const result = sorted.map(([id, { reason }]) => ({ id, reason }));
  for (const fb of fallbacks) {
    if (result.length >= 3) break;
    if (!result.find(r => r.id === fb)) result.push({ id: fb, reason: 'Core fundamental drill' });
  }

  return result.slice(0, 3);
}

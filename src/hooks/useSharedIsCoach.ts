import { useState, useEffect } from 'react';
import { getSharedIsCoach, onSharedIsCoachChange } from '../lib/coachState';

/**
 * Shared hook — always returns the same isCoach value across all components.
 * Use this instead of useAuth().isCoach for anything that must stay in sync.
 */
export function useSharedIsCoach(): boolean {
  const [v, setV] = useState(() => getSharedIsCoach());
  useEffect(() => onSharedIsCoachChange(() => setV(getSharedIsCoach())), []);
  return v;
}
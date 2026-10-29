/**
 * Shared isCoach state — bridges the per-component useAuth() gap.
 * Each call to useAuth() creates its own useState, so components that
 * independently call useAuth() don't see each other's profile updates.
 * This module-level state ensures all consumers agree on isCoach.
 */
type Listener = () => void;
const _listeners = new Set<Listener>();
let _isCoach = false;

export function getSharedIsCoach(): boolean {
  return _isCoach;
}

export function setSharedIsCoach(v: boolean): void {
  if (_isCoach === v) return;
  _isCoach = v;
  _listeners.forEach((fn) => fn());
}

export function onSharedIsCoachChange(fn: Listener): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}
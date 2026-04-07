/**
 * logger.ts — Persistent in-app logger for NextSport
 *
 * Designed as a singleton so it can be imported from anywhere
 * (including non-React modules like api.ts).
 *
 * Logs are stored in AsyncStorage under the key 'nextsport_logs'.
 * Maximum 500 entries retained (oldest pruned first).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  id: string;
  timestamp: string; // ISO 8601
  level: LogLevel;
  tag: string;
  message: string;
  extra?: string; // serialised additional context (e.g. error stack, JSON)
}

const STORAGE_KEY = 'nextsport_logs';
const MAX_ENTRIES = 500;
const MAX_EXTRA_CHARS = 4000;

// In-memory cache so reads are fast during a session
let _cache: LogEntry[] | null = null;
// Listeners that are notified whenever logs change (used by LogContext)
const _listeners: Set<() => void> = new Set();

function notify() {
  _listeners.forEach((fn) => fn());
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function persist(entries: LogEntry[]) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage failures are non-fatal — logs still exist in memory
  }
}

async function loadCache(): Promise<LogEntry[]> {
  if (_cache !== null) return _cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    _cache = raw ? (JSON.parse(raw) as LogEntry[]) : [];
  } catch {
    _cache = [];
  }
  return _cache;
}

async function append(level: LogLevel, tag: string, message: string, extra?: string) {
  const entries = await loadCache();
  const boundedExtra = extra && extra.length > MAX_EXTRA_CHARS
    ? `${extra.slice(0, MAX_EXTRA_CHARS)}\n...(truncated ${extra.length - MAX_EXTRA_CHARS} chars)`
    : extra;
  const entry: LogEntry = {
    id: uid(),
    timestamp: new Date().toISOString(),
    level,
    tag,
    message,
    extra: boundedExtra,
  };
  entries.push(entry);
  // Prune oldest if over limit
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  _cache = entries;
  await persist(entries);
  notify();
  // Mirror to console for Metro / Logcat
  const consoleFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
  consoleFn(`[${level}][${tag}] ${message}${boundedExtra ? '\n' + boundedExtra : ''}`);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '[unserializable]';
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const logger = {
  /** Log an informational message. */
  info(tag: string, message: string, extra?: unknown) {
    const extraStr = extra !== undefined ? safeStringify(extra) : undefined;
    return append('INFO', tag, message, extraStr);
  },

  /** Log a warning. */
  warn(tag: string, message: string, extra?: unknown) {
    const extraStr = extra !== undefined ? safeStringify(extra) : undefined;
    return append('WARN', tag, message, extraStr);
  },

  /** Log an error. Accepts Error objects or arbitrary values. */
  error(tag: string, message: string, error?: unknown) {
    let extraStr: string | undefined;
    if (error instanceof Error) {
      extraStr = `${error.name}: ${error.message}\n${error.stack ?? ''}`;
    } else if (error !== undefined) {
      extraStr = safeStringify(error);
    }
    return append('ERROR', tag, message, extraStr);
  },

  /** Return all stored log entries (newest-last). */
  async getLogs(): Promise<LogEntry[]> {
    return loadCache();
  },

  /** Delete all stored logs. */
  async clearLogs() {
    _cache = [];
    await AsyncStorage.removeItem(STORAGE_KEY);
    notify();
  },

  /**
   * Format logs as a plain-text string suitable for sharing/exporting.
   */
  async exportAsText(): Promise<string> {
    const entries = await loadCache();
    if (entries.length === 0) return '(no logs recorded)';
    const lines = entries.map((e) => {
      const base = `[${e.timestamp}] [${e.level}] [${e.tag}] ${e.message}`;
      return e.extra ? `${base}\n  >> ${e.extra.replace(/\n/g, '\n  >> ')}` : base;
    });
    const header = [
      '=== NextSport Debug Log ===',
      `Exported: ${new Date().toISOString()}`,
      `Entries:  ${entries.length}`,
      '===========================',
      '',
    ].join('\n');
    return header + lines.join('\n');
  },

  /** Subscribe to log changes (returns an unsubscribe function). */
  subscribe(fn: () => void): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};

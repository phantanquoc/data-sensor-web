/**
 * Shared Socket Manager — singleton module that opens exactly 8 Socket.IO
 * connections (one per fryer) and allows multiple hook subscribers per connection.
 *
 * Connections are created lazily on first subscribe for a fryer and torn down
 * with a 2s debounce after the last subscriber unsubscribes.
 */
import { io, Socket } from 'socket.io-client';

type Handler = (...args: unknown[]) => void;

interface Subscription {
  event: string;
  handler: Handler;
}

interface FryerEntry {
  socket: Socket | null;
  subscribers: Map<symbol, Subscription[]>;
  teardownTimer: ReturnType<typeof setTimeout> | null;
}

const TEARDOWN_DELAY_MS = 2000;

const fryers: Record<number, FryerEntry> = {};

function getEntry(n: number): FryerEntry {
  if (!fryers[n]) {
    fryers[n] = { socket: null, subscribers: new Map(), teardownTimer: null };
  }
  return fryers[n];
}

function ensureConnection(n: number): Socket {
  const entry = getEntry(n);

  // Cancel pending teardown if re-subscribing
  if (entry.teardownTimer) {
    clearTimeout(entry.teardownTimer);
    entry.teardownTimer = null;
  }

  if (!entry.socket) {
    const socket = io({ forceNew: true });
    entry.socket = socket;
    socket.on('connect', () => {
      socket.emit('join_noi', String(n));
    });
  }

  return entry.socket;
}

function scheduleTeardown(n: number): void {
  const entry = getEntry(n);
  if (entry.subscribers.size > 0) return;
  if (entry.teardownTimer) return;

  entry.teardownTimer = setTimeout(() => {
    entry.teardownTimer = null;
    // Double-check nobody subscribed during the delay
    if (entry.subscribers.size === 0 && entry.socket) {
      entry.socket.disconnect();
      entry.socket = null;
    }
  }, TEARDOWN_DELAY_MS);
}

/**
 * Subscribe to events on fryer N's shared socket.
 * Returns a unique key used to unsubscribe later.
 *
 * @param n - Fryer number (1-8)
 * @param events - Array of [eventName, handler] tuples to listen on
 * @returns symbol key for unsubscribe
 */
export function subscribe(
  n: number,
  events: Array<[string, Handler]>,
): symbol {
  const socket = ensureConnection(n);
  const key = Symbol();
  const subs: Subscription[] = [];

  for (const [event, handler] of events) {
    socket.on(event, handler);
    subs.push({ event, handler });
  }

  const entry = getEntry(n);
  entry.subscribers.set(key, subs);
  return key;
}

/**
 * Unsubscribe a previous subscription by key.
 * After the last subscriber for a fryer leaves, the socket disconnects (2s delay).
 */
export function unsubscribe(n: number, key: symbol): void {
  const entry = getEntry(n);
  const subs = entry.subscribers.get(key);
  if (!subs) return;

  if (entry.socket) {
    for (const { event, handler } of subs) {
      entry.socket.off(event, handler);
    }
  }

  entry.subscribers.delete(key);

  if (entry.subscribers.size === 0) {
    scheduleTeardown(n);
  }
}

/**
 * Get the raw socket for a fryer (null if not connected).
 * Useful for emitting events like join_noi on reconnect.
 */
export function getSocket(n: number): Socket | null {
  return getEntry(n).socket;
}

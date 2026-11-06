import { errorHandler, AngelAppError } from './ErrorHandlerService';

export type AngelEventType =
  | 'conversation:created'
  | 'conversation:updated'
  | 'conversation:archived'
  | 'conversation:deleted'
  | 'message:received'
  | 'message:updated'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'
  | 'approval:requested'
  | 'approval:granted'
  | 'approval:rejected'
  | 'project:created'
  | 'project:updated'
  | 'file:created'
  | 'file:updated'
  | 'file:deleted'
  | 'agent:execution_started'
  | 'agent:execution_paused'
  | 'agent:execution_stopped'
  | 'notification:generated'
  | 'memory:updated'
  | 'permission:changed'
  | 'settings:updated';

export interface AngelEvent<T = any> {
  id: string;
  type: AngelEventType;
  timestamp: string;
  payload: T;
  nonce?: string;
}

export type AngelEventListener<T = any> = (event: AngelEvent<T>) => void;

export class AngelEventBus {
  private static instance: AngelEventBus;
  private listeners: Map<AngelEventType, Set<AngelEventListener>> = new Map();
  private history: AngelEvent[] = [];
  private processedNonces: Set<string> = new Set();
  private maxHistorySize = 100;

  private constructor() {}

  static getInstance(): AngelEventBus {
    if (!AngelEventBus.instance) {
      AngelEventBus.instance = new AngelEventBus();
    }
    return AngelEventBus.instance;
  }

  subscribe<T = any>(type: AngelEventType, listener: AngelEventListener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    // Unsubscribe function
    return () => {
      const set = this.listeners.get(type);
      if (set) {
        set.delete(listener);
      }
    };
  }

  publish<T = any>(type: AngelEventType, payload: T, nonce?: string): AngelEvent<T> | null {
    // 1. Deduplication check
    const eventNonce = nonce || `${type}_${JSON.stringify(payload)}_${Math.floor(Date.now() / 200)}`;
    if (this.processedNonces.has(eventNonce)) {
      console.warn(`[AngelEventBus] Duplicate event suppressed (nonce: ${eventNonce})`);
      return null;
    }

    this.processedNonces.add(eventNonce);
    // Keep nonces set clean
    if (this.processedNonces.size > 200) {
      const first = this.processedNonces.values().next().value;
      if (first) this.processedNonces.delete(first);
    }

    // 2. Validate event payload
    if (payload === undefined || payload === null) {
      errorHandler.handleError(new AngelAppError('ERR_EVENT', `Invalid null/undefined payload for event ${type}`));
      return null;
    }

    const event: AngelEvent<T> = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type,
      timestamp: new Date().toISOString(),
      payload,
      nonce: eventNonce,
    };

    // 3. Record in event history
    this.history.unshift(event);
    if (this.history.length > this.maxHistorySize) {
      this.history.pop();
    }

    // 4. Dispatch to subscribers with isolated error handling
    const eventSubscribers = this.listeners.get(type);
    if (eventSubscribers && eventSubscribers.size > 0) {
      eventSubscribers.forEach((listener) => {
        try {
          listener(event);
        } catch (subErr) {
          errorHandler.handleError(subErr, `EventBus listener for [${type}]`);
        }
      });
    }

    return event;
  }

  getHistory(typeFilter?: AngelEventType): AngelEvent[] {
    if (!typeFilter) return [...this.history];
    return this.history.filter((e) => e.type === typeFilter);
  }

  clearHistory(): void {
    this.history = [];
    this.processedNonces.clear();
  }

  clearAllListeners(): void {
    this.listeners.clear();
  }
}

export const eventBus = AngelEventBus.getInstance();

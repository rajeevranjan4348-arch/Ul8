// Instant Sync Engine for OmniChat
// Broadcasts and syncs state changes instantly across components, tabs, and Cloud storage

export interface SyncPayload {
  channel: string;
  action: string;
  data: any;
  timestamp: number;
  sourceTabId: string;
}

const TAB_ID = 'tab_' + Math.random().toString(36).substring(2, 9);
const broadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('omnichat_instant_sync') : null;

type SyncListener = (payload: SyncPayload) => void;
const listeners = new Set<SyncListener>();

if (broadcastChannel) {
  broadcastChannel.onmessage = (event) => {
    if (event.data && event.data.sourceTabId !== TAB_ID) {
      listeners.forEach(fn => fn(event.data));
    }
  };
}

// Also listen to window storage events for fallback cross-tab sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('omnichat_sync_')) {
      try {
        const payload: SyncPayload = JSON.parse(e.newValue || '{}');
        if (payload.sourceTabId !== TAB_ID) {
          listeners.forEach(fn => fn(payload));
        }
      } catch (err) {
        // Ignore parse errors
      }
    }
  });
}

export const instantSyncEngine = {
  getTabId: () => TAB_ID,

  publish: (channel: string, action: string, data: any) => {
    const payload: SyncPayload = {
      channel,
      action,
      data,
      timestamp: Date.now(),
      sourceTabId: TAB_ID,
    };

    // 1. Notify local in-memory listeners immediately (0ms delay)
    listeners.forEach(fn => fn(payload));

    // 2. Broadcast across browser tabs
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage(payload);
      } catch (e) {
        // Safe catch
      }
    }

    // 3. Fallback localStorage event trigger
    try {
      localStorage.setItem(`omnichat_sync_${channel}`, JSON.stringify(payload));
    } catch (e) {
      // Safe catch
    }
  },

  subscribe: (listener: SyncListener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

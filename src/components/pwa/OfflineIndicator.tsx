import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { conversationEngine } from '../../services/conversationEngine';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [cachedCount, setCachedCount] = useState<number>(() => conversationEngine.getOfflineCacheStatus().threadCount);

  useEffect(() => {
    const syncCount = () => {
      setCachedCount(conversationEngine.getOfflineCacheStatus().threadCount);
    };
    syncCount();
    return conversationEngine.subscribe(syncCount);
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-offline-banner="true"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl bg-amber-500/95 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-xl"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>
        Offline Mode — {cachedCount > 0 ? `${cachedCount} cached thread${cachedCount === 1 ? '' : 's'} available` : 'Viewing cached history'}
      </span>
    </div>
  );
};

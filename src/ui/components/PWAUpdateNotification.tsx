import React, { useEffect, useState } from 'react';
import { RefreshCw, X, Sparkles } from 'lucide-react';
import { pwaService } from '../../pwa/pwaService';
import { Button } from './Button';

export const PWAUpdateNotification: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    return pwaService.subscribeUpdate((updateAvailable) => {
      setHasUpdate(updateAvailable);
    });
  }, []);

  if (!hasUpdate || isDismissed) return null;

  const handleUpdate = async () => {
    setIsUpdating(true);
    await pwaService.applyUpdate();
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-16 md:bottom-6 right-4 left-4 sm:left-auto sm:max-w-md z-50 p-4 rounded-[var(--radius-lg)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl animate-in slide-in-from-bottom-4 duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-[var(--radius-md)] bg-[var(--accent-subtle)] text-[var(--accent)] shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold text-[var(--text-primary)]">
            Recall Update Available
          </h4>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
            A new version is ready. Your local flashcards and review data are fully preserved.
          </p>

          <div className="flex items-center gap-2 mt-3">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<RefreshCw className={`w-3 h-3 ${isUpdating ? 'animate-spin' : ''}`} />}
              onClick={handleUpdate}
              disabled={isUpdating}
            >
              {isUpdating ? 'Updating...' : 'Update Now'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDismissed(true)}
            >
              Later
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1 rounded transition-colors cursor-pointer"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

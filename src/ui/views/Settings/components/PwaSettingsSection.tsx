import React, { useEffect, useState } from 'react';
import { Download, Smartphone, Wifi, CheckCircle2, Info } from 'lucide-react';
import { SectionContainer } from '../../../components/SectionContainer';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { Badge } from '../../../components/Badge';
import { pwaService } from '../../../../pwa/pwaService';

export const PwaSettingsSection: React.FC = () => {
  const [canInstall, setCanInstall] = useState(pwaService.isInstallable);
  const [isOnline, setIsOnline] = useState(pwaService.isOnline);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (installed PWA)
    if (typeof window !== 'undefined') {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone);
    }

    const unsubInstall = pwaService.subscribeInstallable(setCanInstall);
    const unsubNetwork = pwaService.subscribeNetwork(setIsOnline);

    return () => {
      unsubInstall();
      unsubNetwork();
    };
  }, []);

  const handleInstallClick = async () => {
    const outcome = await pwaService.promptInstall();
    if (outcome) {
      setIsInstalled(true);
    }
  };

  return (
    <SectionContainer
      title="PWA &amp; Offline-Installation"
      description="Recall als eigenständige Progressive Web App auf Desktop &amp; Smartphone nutzen"
    >
      <Card variant="standard" padding="md" className="space-y-4">
        {/* Status header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--divider)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[var(--radius-md)] bg-[var(--accent-subtle)] text-[var(--accent)]">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {isInstalled ? 'Als App installiert' : 'Progressive Web App (PWA)'}
              </span>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                Voller Offline-Zugriff ohne App-Store-Abhängigkeit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={isOnline ? 'success' : 'neutral'}>
              {isOnline ? 'Online' : 'Offline-Modus'}
            </Badge>
            <Badge variant="accent">Service Worker aktiv</Badge>
          </div>
        </div>

        {/* Install Action Card */}
        {isInstalled ? (
          <div className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--success-subtle)] text-[var(--success)] text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              Recall ist als eigenständige Desktop- oder Mobile-App auf diesem System installiert.
            </span>
          </div>
        ) : canInstall ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)]">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Recall jetzt installieren
              </span>
              <p className="text-xs text-[var(--text-secondary)]">
                Installiere Recall für ein schnelles, ablenkungsfreies Vollbild-Erlebnis und direkten App-Launcher-Zugriff.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Download className="w-3.5 h-3.5" />}
              onClick={handleInstallClick}
              className="shrink-0"
            >
              App installieren
            </Button>
          </div>
        ) : (
          <div className="space-y-2 p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
              <Info className="w-4 h-4 text-[var(--accent)]" />
              <span>Manuelle Installation auf Mobilgeräten &amp; Browsern:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-[var(--text-tertiary)]">
              <li>
                <strong className="text-[var(--text-secondary)]">iOS Safari:</strong> Tippe unten auf das Teilen-Symbol <span className="font-mono bg-[var(--bg-muted)] px-1 rounded">⎋</span> und wähle <em>&bdquo;Zum Home-Bildschirm&ldquo;</em>.
              </li>
              <li>
                <strong className="text-[var(--text-secondary)]">Chrome / Edge (Desktop/Android):</strong> Klicke in der Adressleiste auf das Installations-Symbol oder wähle im Browsermenü <em>&bdquo;App installieren&ldquo;</em>.
              </li>
            </ul>
          </div>
        )}

        {/* Offline capabilities guarantee */}
        <div className="flex items-start gap-2.5 pt-2 text-[11px] text-[var(--text-tertiary)]">
          <Wifi className="w-3.5 h-3.5 text-[var(--accent)] mt-0.5 shrink-0" />
          <span>
            <strong>Local-First Garantie:</strong> Alle Flashcards, Medien, FSRS-Fortschritte und Kalendertermine verbleiben lokal in deiner Browser-IndexedDB. Es wird niemals eine Internetverbindung benötigt, um deine Decks zu wiederholen.
          </span>
        </div>
      </Card>
    </SectionContainer>
  );
};

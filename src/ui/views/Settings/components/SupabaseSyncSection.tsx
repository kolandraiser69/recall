import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, LogIn, UserPlus, LogOut, Key, Check, AlertCircle } from 'lucide-react';
import { SectionContainer } from '../../../components/SectionContainer';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { Badge } from '../../../components/Badge';
import { useToast } from '../../../components/Toast';
import { supabaseSyncService, type SyncStatus } from '../../../../services/supabaseSync';

export const SupabaseSyncSection: React.FC = () => {
  const toast = useToast();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => supabaseSyncService.getStatus());

  // Config inputs
  const [showConfig, setShowConfig] = useState(false);
  const [urlInput, setUrlInput] = useState(() => {
    try {
      const stored = localStorage.getItem('recall_supabase_config');
      return stored ? JSON.parse(stored).url || '' : '';
    } catch {
      return '';
    }
  });
  const [anonKeyInput, setAnonKeyInput] = useState(() => {
    try {
      const stored = localStorage.getItem('recall_supabase_config');
      return stored ? JSON.parse(stored).anonKey || '' : '';
    } catch {
      return '';
    }
  });

  // Auth inputs
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  useEffect(() => {
    return supabaseSyncService.subscribe(setSyncStatus);
  }, []);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || !anonKeyInput.trim()) {
      toast.error('Bitte gib eine gültige Supabase-URL und einen Anon-Key an.');
      return;
    }
    supabaseSyncService.configure({
      url: urlInput.trim(),
      anonKey: anonKeyInput.trim(),
    });
    toast.success('Supabase-Konfiguration erfolgreich gespeichert.');
    setShowConfig(false);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput.trim()) {
      toast.error('Bitte E-Mail und Passwort angeben.');
      return;
    }

    setIsAuthLoading(true);
    try {
      if (authMode === 'signin') {
        await supabaseSyncService.signIn(emailInput.trim(), passwordInput.trim());
        toast.success('Erfolgreich angemeldet.');
      } else {
        await supabaseSyncService.signUp(emailInput.trim(), passwordInput.trim());
        toast.success('Registrierung erfolgreich! Falls Bestätigung nötig, prüfe deine E-Mails.');
      }
      setPasswordInput('');
    } catch (err: any) {
      console.error('Supabase auth failed:', err);
      toast.error(err?.message || 'Authentifizierungsfehler bei Supabase.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      const result = await supabaseSyncService.syncNow();
      if (result.success) {
        toast.success(`Synchronisation erfolgreich abgeschlossen (${result.syncedItems} Datensätze aktualisiert).`);
      }
    } catch (err: any) {
      console.error('Supabase sync failed:', err);
      toast.error(err?.message || 'Synchronisationsfehler.');
    }
  };

  const handleSignOut = async () => {
    await supabaseSyncService.signOut();
    toast.info('Erfolgreich von Supabase abgemeldet.');
  };

  const handleDisconnect = () => {
    supabaseSyncService.disconnect();
    setUrlInput('');
    setAnonKeyInput('');
    toast.info('Supabase-Verbindung getrennt und Anmeldedaten gelöscht.');
  };

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Noch nie';
    return new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  };

  return (
    <SectionContainer
      title="Optionaler Cloud-Sync (Supabase)"
      description="Geräteübergreifender Abgleich mit deiner eigenen Supabase-Instanz"
    >
      <Card variant="standard" padding="md" className="space-y-4">
        {/* Header / Connection Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--divider)]">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-[var(--radius-md)] ${
                syncStatus.isConnected
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-tertiary)]'
              }`}
            >
              {syncStatus.isConnected ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
            </div>
            <div>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {syncStatus.isConnected
                  ? 'Supabase Cloud-Sync Aktiv'
                  : syncStatus.isConfigured
                  ? 'Supabase konfiguriert (Nicht angemeldet)'
                  : 'Cloud-Sync nicht eingerichtet'}
              </span>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                {syncStatus.isConnected
                  ? `Angemeldet als ${syncStatus.user?.email}`
                  : '100% lokaler Modus ohne Cloud-Bindung'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={syncStatus.isConnected ? 'success' : 'neutral'}>
              {syncStatus.isConnected ? 'Verbunden' : 'Offline-Only'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Key className="w-3.5 h-3.5" />}
              onClick={() => setShowConfig((prev) => !prev)}
            >
              {showConfig ? 'Schließen' : 'Credentials'}
            </Button>
          </div>
        </div>

        {/* Credentials Form (Collapsible) */}
        {showConfig && (
          <form onSubmit={handleSaveConfig} className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] space-y-3">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Supabase Projekt-Credentials
              </span>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                Trage deine Supabase-URL und deinen public Anon-Key ein. Die Daten werden ausschließlich lokal in deinem Browser gespeichert.
              </p>
            </div>

            <div className="space-y-2">
              <Input
                label="Supabase URL"
                placeholder="https://xyzcompany.supabase.co"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              <Input
                label="Anon Public Key"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                value={anonKeyInput}
                onChange={(e) => setAnonKeyInput(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                disabled={!syncStatus.isConfigured}
              >
                Konfiguration zurücksetzen
              </Button>
              <Button type="submit" variant="primary" size="sm" leftIcon={<Check className="w-3.5 h-3.5" />}>
                Speichern &amp; Verbinden
              </Button>
            </div>
          </form>
        )}

        {/* Sync Controls or Auth Box */}
        {syncStatus.isConnected ? (
          <div className="space-y-3 p-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="text-[var(--text-secondary)]">
                Letzter Synchronisationszeitpunkt:
              </span>
              <span className="font-mono text-[var(--text-primary)] font-medium">
                {formatLastSync(syncStatus.lastSyncedAt)}
              </span>
            </div>

            {syncStatus.lastError && (
              <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 text-red-500 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{syncStatus.lastError}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--divider)]">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />}
                onClick={handleSyncNow}
                disabled={syncStatus.isSyncing}
              >
                {syncStatus.isSyncing ? 'Synchronisiere...' : 'Jetzt synchronisieren'}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                leftIcon={<LogOut className="w-3.5 h-3.5" />}
                onClick={handleSignOut}
              >
                Abmelden
              </Button>
            </div>
          </div>
        ) : syncStatus.isConfigured ? (
          <form onSubmit={handleAuthSubmit} className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                {authMode === 'signin' ? 'Bei Supabase anmelden' : 'Neuen Account registrieren'}
              </span>
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className={`px-2 py-0.5 rounded ${
                    authMode === 'signin'
                      ? 'bg-[var(--accent)] text-white font-medium'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Anmelden
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`px-2 py-0.5 rounded ${
                    authMode === 'signup'
                      ? 'bg-[var(--accent)] text-white font-medium'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Registrieren
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                label="E-Mail"
                type="email"
                placeholder="deine.mail@domain.de"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
              />
              <Input
                label="Passwort"
                type="password"
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isAuthLoading}
                leftIcon={authMode === 'signin' ? <LogIn className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
              >
                {isAuthLoading ? 'Bitte warten...' : authMode === 'signin' ? 'Anmelden' : 'Registrieren'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] text-xs text-[var(--text-tertiary)] space-y-1">
            <p>
              Recall speichert alle Lerninhalte lokal auf diesem Gerät. Um Daten verschlüsselt mit anderen Geräten zu synchronisieren, hinterlege deine Supabase-Projekt-Credentials oben über den Button &bdquo;Credentials&ldquo;.
            </p>
          </div>
        )}
      </Card>
    </SectionContainer>
  );
};

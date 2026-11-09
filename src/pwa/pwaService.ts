type NetworkStatusListener = (isOnline: boolean) => void;
type UpdateAvailableListener = (hasUpdate: boolean) => void;
type InstallableListener = (canInstall: boolean) => void;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export class PWAService {
  private _isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private _hasUpdate = false;
  private _deferredPrompt: BeforeInstallPromptEvent | null = null;
  private _canInstall = false;
  private _updateRegistration: ServiceWorkerRegistration | null = null;

  private networkListeners = new Set<NetworkStatusListener>();
  private updateListeners = new Set<UpdateAvailableListener>();
  private installListeners = new Set<InstallableListener>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this._deferredPrompt = e as BeforeInstallPromptEvent;
        this._canInstall = true;
        this.notifyInstallListeners();
      });

      window.addEventListener('appinstalled', () => {
        this._deferredPrompt = null;
        this._canInstall = false;
        this.notifyInstallListeners();
      });

      this.initServiceWorker();
    }
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  get hasUpdate(): boolean {
    return this._hasUpdate;
  }

  get canInstall(): boolean {
    return this._canInstall;
  }

  get isInstallable(): boolean {
    return this._canInstall;
  }

  get isIOS(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /iPhone|iPad|iPod/i.test(ua);
  }

  get isStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    );
  }

  private handleNetworkChange(online: boolean) {
    this._isOnline = online;
    for (const listener of this.networkListeners) {
      listener(online);
    }
  }

  private notifyUpdateListeners() {
    for (const listener of this.updateListeners) {
      listener(this._hasUpdate);
    }
  }

  private notifyInstallListeners() {
    for (const listener of this.installListeners) {
      listener(this._canInstall);
    }
  }

  subscribeNetwork(listener: NetworkStatusListener): () => void {
    this.networkListeners.add(listener);
    listener(this._isOnline);
    return () => this.networkListeners.delete(listener);
  }

  subscribeUpdate(listener: UpdateAvailableListener): () => void {
    this.updateListeners.add(listener);
    listener(this._hasUpdate);
    return () => this.updateListeners.delete(listener);
  }

  subscribeInstall(listener: InstallableListener): () => void {
    this.installListeners.add(listener);
    listener(this._canInstall);
    return () => this.installListeners.delete(listener);
  }

  subscribeInstallable(listener: InstallableListener): () => void {
    return this.subscribeInstall(listener);
  }

  async promptInstall(): Promise<boolean> {
    if (!this._deferredPrompt) return false;
    try {
      await this._deferredPrompt.prompt();
      const choice = await this._deferredPrompt.userChoice;
      this._deferredPrompt = null;
      this._canInstall = false;
      this.notifyInstallListeners();
      return choice.outcome === 'accepted';
    } catch (err) {
      console.warn('Install prompt failed:', err);
      return false;
    }
  }

  private initServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        this._updateRegistration = reg;

        reg.addEventListener('updatefound', () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this._hasUpdate = true;
                this.notifyUpdateListeners();
              }
            });
          }
        });
      });
    }
  }

  /**
   * Triggers the waiting service worker to skipWaiting and reloads the page smoothly.
   */
  async applyUpdate(): Promise<void> {
    if (this._updateRegistration && this._updateRegistration.waiting) {
      this._updateRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}

export const pwaService = new PWAService();

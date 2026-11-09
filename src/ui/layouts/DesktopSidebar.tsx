import React, { useEffect, useState } from 'react';
import { Home, BookOpen, Layers, Library, BarChart3, Settings, Sun, Moon, Laptop, Calendar, ExternalLink, WifiOff } from 'lucide-react';
import { useNavigation, type NavRoute } from '../navigation/NavigationContext';
import { useTheme } from '../theme/ThemeProvider';
import { pwaService } from '../../pwa/pwaService';

export const DesktopSidebar: React.FC = () => {
  const { currentRoute, navigateTo } = useNavigation();
  const { theme, setTheme } = useTheme();
  const [isOnline, setIsOnline] = useState<boolean>(pwaService.isOnline);

  useEffect(() => {
    return pwaService.subscribeNetwork(setIsOnline);
  }, []);

  const primaryNavItems: { route: NavRoute; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { route: 'home', label: 'Home', icon: <Home className="w-4 h-4" />, shortcut: 'G H' },
    { route: 'study', label: 'Study', icon: <BookOpen className="w-4 h-4" />, shortcut: 'G S' },
    { route: 'decks', label: 'Decks', icon: <Layers className="w-4 h-4" />, shortcut: 'G D' },
    { route: 'collection', label: 'Collection', icon: <Library className="w-4 h-4" />, shortcut: 'G C' },
    { route: 'statistics', label: 'Statistics', icon: <BarChart3 className="w-4 h-4" />, shortcut: 'G T' },
  ];

  const productivityNavItems: { route: NavRoute; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { route: 'calendar', label: 'Kalender', icon: <Calendar className="w-4 h-4" />, shortcut: 'G L' },
    { route: 'quicklinks', label: 'Uni-Quicklinks', icon: <ExternalLink className="w-4 h-4" />, shortcut: 'G Q' },
  ];

  const cycleTheme = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  const themeIcon = {
    light: <Sun className="w-3.5 h-3.5" />,
    dark: <Moon className="w-3.5 h-3.5" />,
    system: <Laptop className="w-3.5 h-3.5" />,
  }[theme];

  return (
    <aside className="hidden md:flex flex-col w-60 h-screen sticky top-0 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] select-none shrink-0 z-30">
      {/* App Header / Brand */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-[var(--divider)]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[7px] bg-[var(--accent)] flex items-center justify-center text-white shadow-xs">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">Recall</span>
            <span className="ml-1.5 text-[10px] text-[var(--text-tertiary)] font-mono">v0.1</span>
          </div>
        </div>

        {/* Network & Local-First Status Pill */}
        <div
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
            isOnline
              ? 'bg-[var(--success-subtle)] text-[var(--success)]'
              : 'bg-[var(--warning-subtle)] text-[var(--warning)]'
          }`}
          title={isOnline ? 'Online • Local-First DB' : 'Offline • Local Data Active'}
        >
          {isOnline ? (
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
          ) : (
            <WifiOff className="w-3 h-3 text-current" />
          )}
          <span>{isOnline ? 'Local' : 'Offline'}</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        <div>
          <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Lernbereich
          </div>
          <div className="space-y-1">
            {primaryNavItems.map((item) => {
              const isActive = currentRoute === item.route;
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => navigateTo(item.route)}
                  className={`
                    w-full flex items-center justify-between px-2.5 py-2 rounded-[var(--radius-md)] text-xs font-medium
                    transition-all duration-150 outline-none cursor-pointer group
                    focus-visible:ring-2 focus-visible:ring-[var(--accent)]
                    ${
                      isActive
                        ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                    }
                  `}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.shortcut}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Produktivität
          </div>
          <div className="space-y-1">
            {productivityNavItems.map((item) => {
              const isActive = currentRoute === item.route;
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => navigateTo(item.route)}
                  className={`
                    w-full flex items-center justify-between px-2.5 py-2 rounded-[var(--radius-md)] text-xs font-medium
                    transition-all duration-150 outline-none cursor-pointer group
                    focus-visible:ring-2 focus-visible:ring-[var(--accent)]
                    ${
                      isActive
                        ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                    }
                  `}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.shortcut}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Bottom Section: Settings & Theme */}
      <div className="p-3 border-t border-[var(--divider)] space-y-1">
        <button
          type="button"
          onClick={() => navigateTo('settings')}
          className={`
            w-full flex items-center justify-between px-2.5 py-2 rounded-[var(--radius-md)] text-xs font-medium
            transition-all duration-150 outline-none cursor-pointer group
            focus-visible:ring-2 focus-visible:ring-[var(--accent)]
            ${
              currentRoute === 'settings'
                ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
            }
          `}
        >
          <div className="flex items-center gap-2.5">
            <Settings className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
            <span>Settings</span>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity">
            ,
          </span>
        </button>

        <button
          type="button"
          onClick={cycleTheme}
          className="
            w-full flex items-center justify-between px-2.5 py-2 rounded-[var(--radius-md)] text-xs font-medium
            text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]
            transition-colors duration-150 outline-none cursor-pointer
          "
        >
          <div className="flex items-center gap-2.5">
            {themeIcon}
            <span className="capitalize">{theme} Theme</span>
          </div>
          <span className="text-[10px] text-[var(--text-tertiary)] font-mono">Toggle</span>
        </button>
      </div>
    </aside>
  );
};

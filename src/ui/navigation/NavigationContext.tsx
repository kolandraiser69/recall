import React, { createContext, useContext, useEffect, useState } from 'react';

export type NavRoute = 'home' | 'study' | 'decks' | 'statistics' | 'settings';

interface NavigationContextValue {
  currentRoute: NavRoute;
  navigateTo: (route: NavRoute) => void;
  basePath: string;
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

// Normalizes base path to ensure leading and trailing slashes, e.g. "/recall/"
function getNormalizedBasePath(): string {
  const envBase = (import.meta as any).env?.VITE_BASE_PATH || '/recall/';
  let base = envBase.startsWith('/') ? envBase : `/${envBase}`;
  if (!base.endsWith('/')) base = `${base}/`;
  return base;
}

function parseRouteFromLocation(basePath: string): NavRoute {
  if (typeof window === 'undefined') return 'home';
  const pathname = window.location.pathname;

  let pathWithoutBase = pathname;
  if (pathname.startsWith(basePath)) {
    pathWithoutBase = pathname.slice(basePath.length);
  } else if (pathname.startsWith('/recall/')) {
    pathWithoutBase = pathname.slice('/recall/'.length);
  } else if (pathname.startsWith('/')) {
    pathWithoutBase = pathname.slice(1);
  }

  // Strip trailing slash
  pathWithoutBase = pathWithoutBase.replace(/\/$/, '').toLowerCase();

  switch (pathWithoutBase) {
    case 'study':
      return 'study';
    case 'decks':
      return 'decks';
    case 'statistics':
    case 'stats':
      return 'statistics';
    case 'settings':
      return 'settings';
    case '':
    case 'home':
    default:
      return 'home';
  }
}

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const basePath = getNormalizedBasePath();
  const [currentRoute, setCurrentRoute] = useState<NavRoute>(() => parseRouteFromLocation(basePath));

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(parseRouteFromLocation(basePath));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [basePath]);

  const navigateTo = (route: NavRoute) => {
    if (route === currentRoute) return;

    setCurrentRoute(route);

    if (typeof window !== 'undefined') {
      const targetPath = route === 'home' ? basePath : `${basePath}${route}`;
      window.history.pushState({ route }, '', targetPath);
    }
  };

  return (
    <NavigationContext.Provider value={{ currentRoute, navigateTo, basePath }}>
      {children}
    </NavigationContext.Provider>
  );
};

export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

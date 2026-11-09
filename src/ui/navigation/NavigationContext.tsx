import React, { createContext, useContext, useEffect, useState } from 'react';

export type NavRoute =
  | 'home'
  | 'study'
  | 'decks'
  | 'collection'
  | 'statistics'
  | 'settings'
  | 'calendar'
  | 'quicklinks';

export interface NavigationParams {
  deckId?: string;
  [key: string]: string | undefined;
}

interface NavigationContextValue {
  currentRoute: NavRoute;
  routeParams: NavigationParams;
  navigateTo: (route: NavRoute, params?: NavigationParams) => void;
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
    case 'collection':
    case 'cards':
    case 'browser':
      return 'collection';
    case 'statistics':
    case 'stats':
      return 'statistics';
    case 'calendar':
    case 'kalender':
      return 'calendar';
    case 'quicklinks':
    case 'links':
      return 'quicklinks';
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
  const [routeParams, setRouteParams] = useState<NavigationParams>({});

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(parseRouteFromLocation(basePath));
      setRouteParams({});
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [basePath]);

  const navigateTo = (route: NavRoute, params: NavigationParams = {}) => {
    setCurrentRoute(route);
    setRouteParams(params);

    if (typeof window !== 'undefined') {
      const targetPath = route === 'home' ? basePath : `${basePath}${route}`;
      window.history.pushState({ route, params }, '', targetPath);
    }
  };

  return (
    <NavigationContext.Provider value={{ currentRoute, routeParams, navigateTo, basePath }}>
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

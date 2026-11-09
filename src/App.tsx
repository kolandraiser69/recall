import React, { useEffect, useState } from 'react';
import { db } from './db/database';
import { ThemeProvider } from './ui/theme/ThemeProvider';
import { NavigationProvider, useNavigation } from './ui/navigation/NavigationContext';
import { KeyboardShortcutsProvider } from './ui/keyboard/KeyboardShortcutsProvider';
import { ToastProvider } from './ui/components/Toast';
import { AppLayout } from './ui/layouts/AppLayout';

import { HomeView } from './ui/views/Home/HomeView';
import { StudyView } from './ui/views/Study/StudyView';
import { DecksView } from './ui/views/Decks/DecksView';
import { CollectionView } from './ui/views/Collection/CollectionView';
import { StatisticsView } from './ui/views/Statistics/StatisticsView';
import { SettingsView } from './ui/views/Settings/SettingsView';
import { CalendarView } from './ui/views/Calendar/CalendarView';
import { QuicklinksView } from './ui/views/Quicklinks/QuicklinksView';
import { PWAUpdateNotification } from './ui/components/PWAUpdateNotification';

const RouteRenderer: React.FC = () => {
  const { currentRoute } = useNavigation();

  switch (currentRoute) {
    case 'study':
      return <StudyView />;
    case 'decks':
      return <DecksView />;
    case 'collection':
      return <CollectionView />;
    case 'statistics':
      return <StatisticsView />;
    case 'calendar':
      return <CalendarView />;
    case 'quicklinks':
      return <QuicklinksView />;
    case 'settings':
      return <SettingsView />;
    case 'home':
    default:
      return <HomeView />;
  }
};

export const App: React.FC = () => {
  const [isDbInitialized, setIsDbInitialized] = useState(false);

  useEffect(() => {
    db.initialize()
      .then(() => setIsDbInitialized(true))
      .catch((err) => {
        console.error('Failed to initialize RecallDatabase:', err);
        setIsDbInitialized(true); // Proceed even if persistence is refused
      });
  }, []);

  if (!isDbInitialized) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--bg-app)] text-[var(--text-secondary)]">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-ping" />
          <span>Starting Recall...</span>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <NavigationProvider>
        <KeyboardShortcutsProvider>
          <ToastProvider>
            <AppLayout>
              <RouteRenderer />
            </AppLayout>
            <PWAUpdateNotification />
          </ToastProvider>
        </KeyboardShortcutsProvider>
      </NavigationProvider>
    </ThemeProvider>
  );
};

export default App;

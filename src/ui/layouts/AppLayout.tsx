import React from 'react';
import { DesktopSidebar } from './DesktopSidebar';
import { TopNav } from './TopNav';
import { BottomTabBar } from './BottomTabBar';
import { ShortcutsModal } from '../components/ShortcutsModal';

export interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-dvh flex bg-[var(--bg-app)] text-[var(--text-primary)]">
      {/* Persistent Left Desktop Sidebar */}
      <DesktopSidebar />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />

        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-6 pb-24 md:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Tab Bar */}
        <BottomTabBar />
      </div>

      {/* Global Modals */}
      <ShortcutsModal />
    </div>
  );
};

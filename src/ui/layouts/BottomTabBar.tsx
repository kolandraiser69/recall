import React from 'react';
import { Home, BookOpen, Layers, BarChart3 } from 'lucide-react';
import { useNavigation, type NavRoute } from '../navigation/NavigationContext';

export const BottomTabBar: React.FC = () => {
  const { currentRoute, navigateTo } = useNavigation();

  const tabs: { route: NavRoute; label: string; icon: React.ReactNode }[] = [
    { route: 'home', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { route: 'study', label: 'Study', icon: <BookOpen className="w-5 h-5" /> },
    { route: 'decks', label: 'Decks', icon: <Layers className="w-5 h-5" /> },
    { route: 'statistics', label: 'Stats', icon: <BarChart3 className="w-5 h-5" /> },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Mobile Navigation"
      className="
        md:hidden fixed bottom-0 left-0 right-0 z-40
        bg-[var(--bg-surface)]/90 backdrop-blur-md border-t border-[var(--border-subtle)]
        safe-bottom select-none
      "
    >
      <div className="flex items-center justify-around h-13 px-2">
        {tabs.map((tab) => {
          const isActive = currentRoute === tab.route;
          return (
            <button
              key={tab.route}
              type="button"
              onClick={() => navigateTo(tab.route)}
              className={`
                flex flex-col items-center justify-center flex-1 h-full py-1 gap-1
                transition-all duration-150 outline-none cursor-pointer active:scale-95
                ${
                  isActive
                    ? 'text-[var(--accent)] font-semibold'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }
              `}
            >
              <span className="shrink-0">{tab.icon}</span>
              <span className="text-[10px] tracking-tight leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

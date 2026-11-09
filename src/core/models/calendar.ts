export interface CalendarCategory {
  id: string;
  name: string;
  color: string; // Hex color code or CSS token
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start: number; // Unix timestamp in ms
  end: number;   // Unix timestamp in ms
  isAllDay: boolean;
  categoryId: string;
  recurringRuleId?: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface CalendarRecurringRule {
  id: string;
  title: string;
  description?: string;
  location?: string;
  categoryId: string;
  frequency: 'weekly';
  interval: number; // 1 = every week, 2 = every 2 weeks
  daysOfWeek: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // "HH:mm" (e.g. "10:00")
  endTime: string;   // "HH:mm" (e.g. "11:30")
  startDate: string; // "YYYY-MM-DD"
  endDate?: string | null; // "YYYY-MM-DD" or null if indefinite
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface CalendarException {
  id: string;
  recurringRuleId: string;
  originalDate: string; // "YYYY-MM-DD"
  isCancelled: boolean;
  overriddenEvent?: {
    title?: string;
    description?: string;
    location?: string;
    start?: number;
    end?: number;
    isAllDay?: boolean;
    categoryId?: string;
  };
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface CalendarInstance {
  id: string; // Event ID or virtual ID `${ruleId}_${dateStr}`
  title: string;
  description?: string;
  location?: string;
  start: number;
  end: number;
  isAllDay: boolean;
  categoryId: string;
  recurringRuleId?: string | null;
  isRecurringInstance: boolean;
  isOverridden?: boolean;
  originalDate?: string;
}

export const DEFAULT_CALENDAR_CATEGORIES: CalendarCategory[] = [
  {
    id: 'cat-uni',
    name: 'Universität',
    color: '#3b82f6', // Modern blue
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
  },
  {
    id: 'cat-private',
    name: 'Privat',
    color: '#10b981', // Emerald green
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
  },
  {
    id: 'cat-work',
    name: 'Arbeit',
    color: '#f59e0b', // Amber orange
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
  },
  {
    id: 'cat-other',
    name: 'Sonstiges',
    color: '#8b5cf6', // Violet
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
  },
];

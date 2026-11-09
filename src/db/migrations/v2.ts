import { SCHEMA_V1 } from './v1';
import { DEFAULT_CALENDAR_CATEGORIES } from '../../core/models/calendar';
import { DEFAULT_QUICKLINKS, type Quicklink } from '../../core/models/quicklink';

export const SCHEMA_V2 = {
  ...SCHEMA_V1,
  calendarEvents: 'id, categoryId, start, end, isAllDay, recurringRuleId, updatedAt, deletedAt',
  calendarRecurringRules: 'id, categoryId, frequency, startDate, endDate, updatedAt, deletedAt',
  calendarExceptions: 'id, recurringRuleId, originalDate, isCancelled, updatedAt, deletedAt',
  calendarCategories: 'id, name, updatedAt, deletedAt',
  quicklinks: 'id, order, isFavorite, updatedAt, deletedAt',
};

export const INITIAL_QUICKLINKS: Quicklink[] = DEFAULT_QUICKLINKS.map((q) => ({
  ...q,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  deletedAt: null,
}));

export const INITIAL_CALENDAR_CATEGORIES = DEFAULT_CALENDAR_CATEGORIES;

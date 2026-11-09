import { db, type RecallDatabase } from '../db/database';
import type {
  CalendarCategory,
  CalendarEvent,
  CalendarRecurringRule,
  CalendarException,
  CalendarInstance,
} from '../core/models/calendar';
import { DEFAULT_CALENDAR_CATEGORIES } from '../core/models/calendar';
import { generateId } from '../utils/id';

export interface CalendarWeekWindow {
  startDate: Date; // Monday 00:00:00
  endDate: Date;   // Sunday 23:59:59.999
  days: Date[];    // 7 Date objects for Mon..Sun
}

export interface PositionedCalendarInstance extends CalendarInstance {
  column: number;
  totalColumns: number;
  dayIndex: number; // 0..6 (Mon..Sun)
  topPercentage: number;
  heightPercentage: number;
}

export class CalendarService {
  constructor(private database: RecallDatabase = db) {}

  /**
   * Helper to format a Date into YYYY-MM-DD in local time.
   */
  formatDateKey(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Returns Monday 00:00:00 to Sunday 23:59:59 for a given reference date.
   */
  getWeekWindow(refDate: Date): CalendarWeekWindow {
    const d = new Date(refDate);
    const day = d.getDay();
    // Monday as day 1 in ISO (0 is Sunday, so diff = (day === 0 ? -6 : 1 - day))
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(monday);
      cur.setDate(monday.getDate() + i);
      days.push(cur);
    }

    const sunday = new Date(days[6]!);
    sunday.setHours(23, 59, 59, 999);

    return {
      startDate: monday,
      endDate: sunday,
      days,
    };
  }

  /**
   * Computes all calendar instances (standalone + expanded recurring rules - exceptions) for a week.
   */
  async getWeekEvents(refDate: Date): Promise<CalendarInstance[]> {
    const { startDate, endDate, days } = this.getWeekWindow(refDate);
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    // 1. Fetch standalone events falling within this week
    const standaloneEvents = await this.database.calendarEvents
      .filter((ev) => ev.deletedAt === null && ev.start <= endMs && ev.end >= startMs)
      .toArray();

    const instances: CalendarInstance[] = standaloneEvents.map((ev) => ({
      id: ev.id,
      title: ev.title,
      description: ev.description,
      location: ev.location,
      start: ev.start,
      end: ev.end,
      isAllDay: ev.isAllDay,
      categoryId: ev.categoryId,
      recurringRuleId: ev.recurringRuleId,
      isRecurringInstance: Boolean(ev.recurringRuleId),
    }));

    // 2. Fetch active recurring rules
    const rules = await this.database.calendarRecurringRules
      .filter((r) => r.deletedAt === null)
      .toArray();

    if (rules.length === 0) {
      return instances;
    }

    // 3. Fetch exceptions for these rules
    const ruleIds = new Set(rules.map((r) => r.id));
    const exceptions = await this.database.calendarExceptions
      .filter((ex) => ex.deletedAt === null && ruleIds.has(ex.recurringRuleId))
      .toArray();

    // Map exceptions by `${ruleId}_${dateKey}`
    const exceptionMap = new Map<string, CalendarException>();
    for (const ex of exceptions) {
      exceptionMap.set(`${ex.recurringRuleId}_${ex.originalDate}`, ex);
    }

    // 4. Expand rules across the 7 days of the week
    for (const rule of rules) {
      for (const curDate of days) {
        const dateKey = this.formatDateKey(curDate);

        // Check date range boundary
        if (dateKey < rule.startDate) continue;
        if (rule.endDate && dateKey > rule.endDate) continue;

        // Check day of week
        const curDayOfWeek = curDate.getDay(); // 0 = Sun, 1 = Mon ...
        if (!rule.daysOfWeek.includes(curDayOfWeek)) continue;

        // Check interval (if interval > 1)
        if (rule.interval > 1) {
          const ruleStart = new Date(rule.startDate);
          const diffWeeks = Math.floor((curDate.getTime() - ruleStart.getTime()) / (7 * 24 * 3600 * 1000));
          if (diffWeeks % rule.interval !== 0) continue;
        }

        // Check for exception on this date
        const ex = exceptionMap.get(`${rule.id}_${dateKey}`);
        if (ex) {
          if (ex.isCancelled) {
            // Occurrence was cancelled/skipped
            continue;
          }
          if (ex.overriddenEvent) {
            // Overridden occurrence
            const [sh, sm] = (rule.startTime || '09:00').split(':').map(Number);
            const [eh, em] = (rule.endTime || '10:00').split(':').map(Number);

            const startObj = new Date(curDate);
            startObj.setHours(sh ?? 9, sm ?? 0, 0, 0);

            const endObj = new Date(curDate);
            endObj.setHours(eh ?? 10, em ?? 0, 0, 0);

            instances.push({
              id: `instance_${rule.id}_${dateKey}`,
              title: ex.overriddenEvent.title ?? rule.title,
              description: ex.overriddenEvent.description ?? rule.description,
              location: ex.overriddenEvent.location ?? rule.location,
              start: ex.overriddenEvent.start ?? startObj.getTime(),
              end: ex.overriddenEvent.end ?? endObj.getTime(),
              isAllDay: ex.overriddenEvent.isAllDay ?? false,
              categoryId: ex.overriddenEvent.categoryId ?? rule.categoryId,
              recurringRuleId: rule.id,
              isRecurringInstance: true,
              isOverridden: true,
              originalDate: dateKey,
            });
            continue;
          }
        }

        // Standard instance from rule
        const [sh, sm] = (rule.startTime || '09:00').split(':').map(Number);
        const [eh, em] = (rule.endTime || '10:00').split(':').map(Number);

        const startObj = new Date(curDate);
        startObj.setHours(sh ?? 9, sm ?? 0, 0, 0);

        const endObj = new Date(curDate);
        endObj.setHours(eh ?? 10, em ?? 0, 0, 0);

        instances.push({
          id: `instance_${rule.id}_${dateKey}`,
          title: rule.title,
          description: rule.description,
          location: rule.location,
          start: startObj.getTime(),
          end: endObj.getTime(),
          isAllDay: false,
          categoryId: rule.categoryId,
          recurringRuleId: rule.id,
          isRecurringInstance: true,
          originalDate: dateKey,
        });
      }
    }

    return instances;
  }

  /**
   * Layout algorithm that calculates overlapping columns for 7 days (00:00 to 24:00).
   */
  calculateWeekLayout(instances: CalendarInstance[], weekWindow: CalendarWeekWindow): PositionedCalendarInstance[] {
    const positioned: PositionedCalendarInstance[] = [];

    // Group instances into day buckets (0 = Monday, ..., 6 = Sunday)
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const dayDate = weekWindow.days[dayIdx]!;
      const dayStart = new Date(dayDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayStartMs = dayStart.getTime();

      const dayEnd = new Date(dayDate);
      dayEnd.setHours(23, 59, 59, 999);
      const dayEndMs = dayEnd.getTime();

      // Filter events occurring on this day (exclude all-day events from hourly positioning)
      const dayEvents = instances.filter((ev) => !ev.isAllDay && ev.start < dayEndMs && ev.end > dayStartMs);

      // Sort by start time, then duration
      dayEvents.sort((a, b) => {
        if (a.start !== b.start) return a.start - b.start;
        return (b.end - b.start) - (a.end - a.start);
      });

      // Cluster overlapping events into groups
      const clusters: CalendarInstance[][] = [];
      let currentCluster: CalendarInstance[] = [];
      let clusterEnd = 0;

      for (const ev of dayEvents) {
        if (currentCluster.length === 0) {
          currentCluster.push(ev);
          clusterEnd = ev.end;
        } else if (ev.start < clusterEnd) {
          currentCluster.push(ev);
          clusterEnd = Math.max(clusterEnd, ev.end);
        } else {
          clusters.push(currentCluster);
          currentCluster = [ev];
          clusterEnd = ev.end;
        }
      }
      if (currentCluster.length > 0) {
        clusters.push(currentCluster);
      }

      // Assign columns within each cluster
      const totalDayMs = 24 * 60 * 60 * 1000;

      for (const cluster of clusters) {
        const columns: CalendarInstance[][] = [];

        for (const ev of cluster) {
          let placed = false;
          for (let colIdx = 0; colIdx < columns.length; colIdx++) {
            const lastInCol = columns[colIdx]![columns[colIdx]!.length - 1];
            if (!lastInCol || lastInCol.end <= ev.start) {
              columns[colIdx]!.push(ev);
              placed = true;
              break;
            }
          }
          if (!placed) {
            columns.push([ev]);
          }
        }

        const totalCols = columns.length;

        for (let colIdx = 0; colIdx < columns.length; colIdx++) {
          for (const ev of columns[colIdx]!) {
            const clampedStart = Math.max(dayStartMs, ev.start);
            const clampedEnd = Math.min(dayEndMs, ev.end);

            const topMs = clampedStart - dayStartMs;
            const heightMs = Math.max(15 * 60 * 1000, clampedEnd - clampedStart); // minimum 15 min height

            positioned.push({
              ...ev,
              dayIndex: dayIdx,
              column: colIdx,
              totalColumns: totalCols,
              topPercentage: (topMs / totalDayMs) * 100,
              heightPercentage: (heightMs / totalDayMs) * 100,
            });
          }
        }
      }
    }

    return positioned;
  }

  computePositionedInstances(instances: CalendarInstance[], weekWindow: CalendarWeekWindow): PositionedCalendarInstance[] {
    return this.calculateWeekLayout(instances, weekWindow);
  }

  // --- CRUD for Events ---

  async createEvent(data: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<CalendarEvent> {
    const now = Date.now();
    const event: CalendarEvent = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await this.database.calendarEvents.add(event);
    return event;
  }

  async updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const existing = await this.database.calendarEvents.get(id);
    if (!existing) throw new Error(`Calendar event not found: ${id}`);

    const updated: CalendarEvent = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };
    await this.database.calendarEvents.put(updated);
    return updated;
  }

  async deleteEvent(id: string): Promise<void> {
    await this.database.calendarEvents.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  // --- CRUD for Recurring Rules ---

  async createRecurringRule(
    data: Omit<CalendarRecurringRule, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  ): Promise<CalendarRecurringRule> {
    const now = Date.now();
    const rule: CalendarRecurringRule = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await this.database.calendarRecurringRules.add(rule);
    return rule;
  }

  async updateRecurringRule(id: string, updates: Partial<CalendarRecurringRule>): Promise<CalendarRecurringRule> {
    const existing = await this.database.calendarRecurringRules.get(id);
    if (!existing) throw new Error(`Recurring rule not found: ${id}`);

    const updated: CalendarRecurringRule = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };
    await this.database.calendarRecurringRules.put(updated);
    return updated;
  }

  async deleteRecurringRule(id: string): Promise<void> {
    const now = Date.now();
    await this.database.transaction('rw', [this.database.calendarRecurringRules, this.database.calendarExceptions], async () => {
      await this.database.calendarRecurringRules.update(id, {
        deletedAt: now,
        updatedAt: now,
      });
      // Soft-delete associated exceptions
      await this.database.calendarExceptions
        .where('recurringRuleId')
        .equals(id)
        .modify({ deletedAt: now, updatedAt: now });
    });
  }

  // --- Recurrence Exceptions (Single Occurrence Handling) ---

  async cancelOccurrence(recurringRuleId: string, originalDate: string): Promise<void> {
    const now = Date.now();
    const existing = await this.database.calendarExceptions
      .filter((ex) => ex.recurringRuleId === recurringRuleId && ex.originalDate === originalDate && ex.deletedAt === null)
      .first();

    if (existing) {
      await this.database.calendarExceptions.update(existing.id, {
        isCancelled: true,
        updatedAt: now,
      });
    } else {
      await this.database.calendarExceptions.add({
        id: generateId(),
        recurringRuleId,
        originalDate,
        isCancelled: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    }
  }

  async rescheduleOccurrence(
    recurringRuleId: string,
    originalDate: string,
    overrides: CalendarException['overriddenEvent']
  ): Promise<void> {
    const now = Date.now();
    const existing = await this.database.calendarExceptions
      .filter((ex) => ex.recurringRuleId === recurringRuleId && ex.originalDate === originalDate && ex.deletedAt === null)
      .first();

    if (existing) {
      await this.database.calendarExceptions.update(existing.id, {
        overriddenEvent: overrides,
        isCancelled: false,
        updatedAt: now,
      });
    } else {
      await this.database.calendarExceptions.add({
        id: generateId(),
        recurringRuleId,
        originalDate,
        isCancelled: false,
        overriddenEvent: overrides,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    }
  }

  // --- Categories ---

  async getCategories(): Promise<CalendarCategory[]> {
    const cats = await this.database.calendarCategories
      .filter((c) => c.deletedAt === null)
      .toArray();

    if (cats.length === 0) {
      await this.database.calendarCategories.bulkAdd(DEFAULT_CALENDAR_CATEGORIES);
      return DEFAULT_CALENDAR_CATEGORIES;
    }
    return cats;
  }

  async saveCategory(category: Omit<CalendarCategory, 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<CalendarCategory> {
    const now = Date.now();
    const fullCat: CalendarCategory = {
      ...category,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await this.database.calendarCategories.put(fullCat);
    return fullCat;
  }

  async deleteCategory(id: string): Promise<void> {
    await this.database.calendarCategories.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
}

export const calendarService = new CalendarService();

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { RecallDatabase } from '../../src/db/database';
import { CalendarService } from '../../src/services/calendarService';

describe('CalendarService Tests', () => {
  const dbName = `TestCalendarDB_${Date.now()}_${Math.random()}`;
  let testDb: RecallDatabase;
  let calendarService: CalendarService;

  beforeEach(async () => {
    testDb = new RecallDatabase(dbName);
    await testDb.initialize();
    calendarService = new CalendarService(testDb);
  });

  afterEach(async () => {
    await testDb.close();
    await Dexie.delete(dbName);
  });

  it('should initialize with default calendar categories', async () => {
    const categories = await calendarService.getCategories();
    expect(categories.length).toBeGreaterThanOrEqual(4);
    const names = categories.map((c) => c.name);
    expect(names).toContain('Universität');
    expect(names).toContain('Privat');
    expect(names).toContain('Arbeit');
  });

  it('should create and retrieve a single calendar event in week window', async () => {
    const refDate = new Date(2026, 10, 9); // Monday, Nov 9, 2026
    const start = new Date(2026, 10, 9, 10, 0).getTime();
    const end = new Date(2026, 10, 9, 11, 30).getTime();

    const event = await calendarService.createEvent({
      title: 'Algorithmen Vorlesung',
      start,
      end,
      isAllDay: false,
      categoryId: 'cat-uni',
      location: 'Hörsaal A',
      description: 'Kapitel 3: Sortierverfahren',
    });

    expect(event.id).toBeDefined();
    expect(event.title).toBe('Algorithmen Vorlesung');

    // Query for that week
    const weekEvents = await calendarService.getWeekEvents(refDate);
    expect(weekEvents.length).toBe(1);
    expect(weekEvents[0]!.title).toBe('Algorithmen Vorlesung');
    expect(weekEvents[0]!.location).toBe('Hörsaal A');
    expect(weekEvents[0]!.isRecurringInstance).toBe(false);
  });

  it('should expand recurring lecture series across weeks', async () => {
    const rule = await calendarService.createRecurringRule({
      title: 'Mathematik I',
      categoryId: 'cat-uni',
      location: 'Audimax',
      frequency: 'weekly',
      daysOfWeek: [1], // Monday
      startTime: '08:15',
      endTime: '09:45',
      startDate: '2026-11-09',
      endDate: '2026-12-31',
      interval: 1,
    });

    expect(rule.id).toBeDefined();

    // Week 1: Nov 9, 2026
    const week1Date = new Date(2026, 10, 9);
    const week1Events = await calendarService.getWeekEvents(week1Date);
    expect(week1Events.length).toBe(1);
    expect(week1Events[0]!.title).toBe('Mathematik I');
    expect(week1Events[0]!.isRecurringInstance).toBe(true);

    // Week 2: Nov 16, 2026
    const week2Date = new Date(2026, 10, 16);
    const week2Events = await calendarService.getWeekEvents(week2Date);
    expect(week2Events.length).toBe(1);
    expect(week2Events[0]!.title).toBe('Mathematik I');

    const expectedWeek2Start = new Date(2026, 10, 16, 8, 15).getTime();
    expect(week2Events[0]!.start).toBe(expectedWeek2Start);
  });

  it('should handle single-occurrence exception (cancelling a specific lecture date)', async () => {
    const rule = await calendarService.createRecurringRule({
      title: 'Software Engineering Seminar',
      categoryId: 'cat-uni',
      frequency: 'weekly',
      daysOfWeek: [1], // Monday
      startTime: '14:00',
      endTime: '15:30',
      startDate: '2026-11-09',
      endDate: '2026-12-31',
      interval: 1,
    });

    // Cancel occurrence on Nov 16 (Monday week 2)
    await calendarService.cancelOccurrence(rule.id, '2026-11-16');

    // Week 2 should now have 0 instances
    const week2Date = new Date(2026, 10, 16);
    const week2Events = await calendarService.getWeekEvents(week2Date);
    expect(week2Events.length).toBe(0);

    // Week 1 should still have the original instance
    const week1Date = new Date(2026, 10, 9);
    const week1Events = await calendarService.getWeekEvents(week1Date);
    expect(week1Events.length).toBe(1);
    expect(week1Events[0]!.title).toBe('Software Engineering Seminar');
  });

  it('should compute positioned overlapping instances correctly', () => {
    const refDate = new Date(2026, 10, 9); // Monday
    const window = calendarService.getWeekWindow(refDate);

    const base = new Date(2026, 10, 9, 10, 0).getTime();
    const hour = 3600 * 1000;

    const mockInstances = [
      {
        id: '1',
        title: 'Event A',
        start: base,
        end: base + 2 * hour,
        isAllDay: false,
        categoryId: 'cat-uni',
        isRecurringInstance: false,
      },
      {
        id: '2',
        title: 'Event B (Overlaps A)',
        start: base + hour,
        end: base + 3 * hour,
        isAllDay: false,
        categoryId: 'cat-uni',
        isRecurringInstance: false,
      },
      {
        id: '3',
        title: 'Event C (Non-overlapping)',
        start: base + 4 * hour,
        end: base + 5 * hour,
        isAllDay: false,
        categoryId: 'cat-uni',
        isRecurringInstance: false,
      },
    ];

    const positioned = calendarService.computePositionedInstances(mockInstances, window);
    expect(positioned.length).toBe(3);

    const a = positioned.find((p) => p.id === '1')!;
    const b = positioned.find((p) => p.id === '2')!;
    const c = positioned.find((p) => p.id === '3')!;

    // A and B overlap on Monday (dayIndex 0) and share 2 columns
    expect(a.totalColumns).toBe(2);
    expect(b.totalColumns).toBe(2);
    expect(a.column).not.toBe(b.column);
    expect(a.dayIndex).toBe(0);

    // C does not overlap and has 1 column
    expect(c.totalColumns).toBe(1);
    expect(c.column).toBe(0);
    expect(c.dayIndex).toBe(0);
  });
});

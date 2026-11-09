import { z } from 'zod';

export const calendarCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  color: z.string().min(1),
  isDefault: z.boolean().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
});

export const calendarEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  location: z.string().optional(),
  start: z.number(),
  end: z.number(),
  isAllDay: z.boolean(),
  categoryId: z.string().min(1),
  recurringRuleId: z.string().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
});

export const calendarRecurringRuleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  location: z.string().optional(),
  categoryId: z.string().min(1),
  frequency: z.literal('weekly'),
  interval: z.number().int().min(1).default(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
});

export const calendarExceptionSchema = z.object({
  id: z.string().min(1),
  recurringRuleId: z.string().min(1),
  originalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isCancelled: z.boolean(),
  overriddenEvent: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    start: z.number().optional(),
    end: z.number().optional(),
    isAllDay: z.boolean().optional(),
    categoryId: z.string().optional(),
  }).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
});

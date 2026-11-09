import React, { useState, useEffect } from 'react';
import { Trash2, Clock, MapPin, AlignLeft, Repeat } from 'lucide-react';
import { Modal } from '../../../components/Modal';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { useToast } from '../../../components/Toast';
import { calendarService } from '../../../../services/calendarService';
import type { CalendarCategory, CalendarInstance } from '../../../../core/models/calendar';

export interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: Date;
  initialHour?: number;
  selectedEvent?: CalendarInstance | null;
  categories: CalendarCategory[];
  onSaved: () => void;
}

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  initialHour = 10,
  selectedEvent,
  categories,
  onSaved,
}) => {
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);

  // Times & Dates
  const [dateStr, setDateStr] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:30');

  // Recurrence
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([1]); // Monday default
  const [interval, setInterval] = useState(1);
  const [semesterEndDate, setSemesterEndDate] = useState('');

  // Delete mode confirmation
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    if (!isOpen) {
      setIsDeleteConfirmOpen(false);
      return;
    }

    if (selectedEvent) {
      setTitle(selectedEvent.title);
      setDescription(selectedEvent.description || '');
      setLocation(selectedEvent.location || '');
      setCategoryId(selectedEvent.categoryId);
      setIsAllDay(selectedEvent.isAllDay);

      const startD = new Date(selectedEvent.start);
      const endD = new Date(selectedEvent.end);

      setDateStr(selectedEvent.originalDate || formatLocalDate(startD));
      setStartTime(
        `${String(startD.getHours()).padStart(2, '0')}:${String(startD.getMinutes()).padStart(2, '0')}`
      );
      setEndTime(
        `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`
      );

      setIsRecurring(Boolean(selectedEvent.recurringRuleId));
    } else {
      const baseDate = initialDate || new Date();
      setDateStr(formatLocalDate(baseDate));
      const sh = String(initialHour).padStart(2, '0');
      const eh = String(Math.min(23, initialHour + 1)).padStart(2, '0');
      setStartTime(`${sh}:00`);
      setEndTime(`${eh}:30`);
      setTitle('');
      setDescription('');
      setLocation('');
      setCategoryId(categories[0]?.id || 'cat-uni');
      setIsAllDay(false);
      setIsRecurring(false);
      setSelectedDays([baseDate.getDay() === 0 ? 0 : baseDate.getDay()]);
      setInterval(1);
      setSemesterEndDate('');
    }
  }, [isOpen, selectedEvent, initialDate, initialHour, categories]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter an event title.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedEvent) {
        if (selectedEvent.isRecurringInstance && selectedEvent.recurringRuleId && selectedEvent.originalDate) {
          // Update single occurrence exception
          const [sh, sm] = startTime.split(':').map(Number);
          const [eh, em] = endTime.split(':').map(Number);
          const startObj = new Date(`${dateStr}T00:00:00`);
          startObj.setHours(sh ?? 9, sm ?? 0, 0, 0);
          const endObj = new Date(`${dateStr}T00:00:00`);
          endObj.setHours(eh ?? 10, em ?? 0, 0, 0);

          await calendarService.rescheduleOccurrence(
            selectedEvent.recurringRuleId,
            selectedEvent.originalDate,
            {
              title: title.trim(),
              description: description.trim() || undefined,
              location: location.trim() || undefined,
              start: startObj.getTime(),
              end: endObj.getTime(),
              isAllDay,
              categoryId,
            }
          );
          toast.success('Updated occurrence for this date.');
        } else {
          // Update standalone event
          const [sh, sm] = startTime.split(':').map(Number);
          const [eh, em] = endTime.split(':').map(Number);
          const startObj = new Date(`${dateStr}T00:00:00`);
          startObj.setHours(sh ?? 9, sm ?? 0, 0, 0);
          const endObj = new Date(`${dateStr}T00:00:00`);
          endObj.setHours(eh ?? 10, em ?? 0, 0, 0);

          await calendarService.updateEvent(selectedEvent.id, {
            title: title.trim(),
            description: description.trim() || undefined,
            location: location.trim() || undefined,
            start: startObj.getTime(),
            end: endObj.getTime(),
            isAllDay,
            categoryId,
          });
          toast.success('Event updated.');
        }
      } else {
        // Create new
        if (isRecurring) {
          await calendarService.createRecurringRule({
            title: title.trim(),
            description: description.trim() || undefined,
            location: location.trim() || undefined,
            categoryId,
            frequency: 'weekly',
            interval,
            daysOfWeek: selectedDays,
            startTime,
            endTime,
            startDate: dateStr,
            endDate: semesterEndDate || null,
          });
          toast.success('Recurring university lecture/event created.');
        } else {
          const [sh, sm] = startTime.split(':').map(Number);
          const [eh, em] = endTime.split(':').map(Number);
          const startObj = new Date(`${dateStr}T00:00:00`);
          startObj.setHours(sh ?? 9, sm ?? 0, 0, 0);
          const endObj = new Date(`${dateStr}T00:00:00`);
          endObj.setHours(eh ?? 10, em ?? 0, 0, 0);

          await calendarService.createEvent({
            title: title.trim(),
            description: description.trim() || undefined,
            location: location.trim() || undefined,
            start: startObj.getTime(),
            end: endObj.getTime(),
            isAllDay,
            categoryId,
          });
          toast.success('Event scheduled.');
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save calendar event:', err);
      toast.error('Failed to save event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOccurrenceOnly = async () => {
    if (!selectedEvent?.recurringRuleId || !selectedEvent.originalDate) return;
    setIsSubmitting(true);
    try {
      await calendarService.cancelOccurrence(selectedEvent.recurringRuleId, selectedEvent.originalDate);
      toast.success('Occurrence skipped for this date.');
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove occurrence.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntireSeries = async () => {
    if (!selectedEvent?.recurringRuleId) return;
    setIsSubmitting(true);
    try {
      await calendarService.deleteRecurringRule(selectedEvent.recurringRuleId);
      toast.success('Entire recurring series deleted.');
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete series.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStandalone = async () => {
    if (!selectedEvent) return;
    setIsSubmitting(true);
    try {
      await calendarService.deleteEvent(selectedEvent.id);
      toast.success('Event deleted.');
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dayLabels = [
    { day: 1, label: 'Mon' },
    { day: 2, label: 'Tue' },
    { day: 3, label: 'Wed' },
    { day: 4, label: 'Thu' },
    { day: 5, label: 'Fri' },
    { day: 6, label: 'Sat' },
    { day: 0, label: 'Sun' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={selectedEvent ? 'Edit Event' : 'Schedule Event'}
      description="Plan university lectures, study blocks, and private appointments"
      maxWidth="md"
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Title */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--text-primary)]">Title *</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Einführung in die Wirtschaftsinformatik"
            autoFocus
            required
          />
        </div>

        {/* Category selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-primary)]">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const isSelected = categoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-md)] text-xs font-medium border transition-colors ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date & All Day */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-primary)]">Date</label>
            <Input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAllDay}
                onChange={(e) => setIsAllDay(e.target.checked)}
                className="rounded border-[var(--border-subtle)] text-[var(--accent)]"
              />
              <span className="text-xs font-medium text-[var(--text-primary)]">All-Day Event</span>
            </label>
          </div>
        </div>

        {/* Start and End Times */}
        {!isAllDay && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                <span>Start Time</span>
              </label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                <span>End Time</span>
              </label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {/* Location & Room */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            <span>Room / Location</span>
          </label>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Hörsaal G209 / Zoom"
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1">
            <AlignLeft className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            <span>Notes / Description</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add relevant course notes or links..."
            rows={2}
            className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>

        {/* Recurrence Block (Only when creating new) */}
        {!selectedEvent && (
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded border-[var(--border-subtle)] text-[var(--accent)]"
              />
              <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-[var(--accent)]" />
                Repeat Weekly (Semester Schedule)
              </span>
            </label>

            {isRecurring && (
              <div className="space-y-3 pt-2 border-t border-[var(--divider)]">
                {/* Days of week */}
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)] block">
                    Repeat on days:
                  </span>
                  <div className="flex gap-1.5">
                    {dayLabels.map(({ day, label }) => {
                      const isSel = selectedDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (isSel) {
                              if (selectedDays.length > 1) {
                                setSelectedDays(selectedDays.filter((d) => d !== day));
                              }
                            } else {
                              setSelectedDays([...selectedDays, day]);
                            }
                          }}
                          className={`flex-1 py-1 rounded text-[11px] font-mono font-medium border transition-colors ${
                            isSel
                              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-muted)]'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Semester End Date */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                    Semester End Date (optional):
                  </label>
                  <Input
                    type="date"
                    value={semesterEndDate}
                    onChange={(e) => setSemesterEndDate(e.target.value)}
                    placeholder="Leave blank for ongoing"
                  />
                  <span className="text-[10px] text-[var(--text-tertiary)] block">
                    The lecture series stops recurring after this date.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--divider)]">
          {selectedEvent ? (
            <Button
              variant="destructive"
              size="sm"
              type="button"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => {
                if (selectedEvent.isRecurringInstance) {
                  setIsDeleteConfirmOpen(true);
                } else {
                  handleDeleteStandalone();
                }
              }}
              disabled={isSubmitting}
            >
              Delete
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
              {selectedEvent ? 'Save Changes' : 'Create Event'}
            </Button>
          </div>
        </div>
      </form>

      {/* Recurrence Delete Mode Modal */}
      {isDeleteConfirmOpen && selectedEvent && (
        <Modal
          isOpen={true}
          onClose={() => setIsDeleteConfirmOpen(false)}
          title="Delete Recurring Event"
          description="Choose whether to remove only this occurrence or the whole series"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-[var(--text-secondary)]">
              This event is part of a recurring schedule. What would you like to delete?
            </p>

            <div className="space-y-2">
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-start"
                onClick={handleDeleteOccurrenceOnly}
                disabled={isSubmitting}
              >
                Delete only this occurrence ({selectedEvent.originalDate})
              </Button>

              <Button
                variant="destructive"
                size="sm"
                className="w-full justify-start"
                onClick={handleDeleteEntireSeries}
                disabled={isSubmitting}
              >
                Delete entire recurring series
              </Button>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--divider)]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
};

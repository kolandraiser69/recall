import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Filter,
} from 'lucide-react';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import {
  calendarService,
  type CalendarWeekWindow,
  type PositionedCalendarInstance,
} from '../../../services/calendarService';
import type { CalendarCategory, CalendarInstance } from '../../../core/models/calendar';
import { CalendarEventModal } from './components/CalendarEventModal';

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 to 22:00

export const CalendarView: React.FC = () => {
  const [currentRefDate, setCurrentRefDate] = useState(() => new Date());
  const [weekWindow, setWeekWindow] = useState<CalendarWeekWindow>(() =>
    calendarService.getWeekWindow(new Date())
  );
  const [categories, setCategories] = useState<CalendarCategory[]>([]);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);

  const [events, setEvents] = useState<CalendarInstance[]>([]);
  const [positionedEvents, setPositionedEvents] = useState<PositionedCalendarInstance[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialDate, setModalInitialDate] = useState<Date>(new Date());
  const [modalInitialHour, setModalInitialHour] = useState<number>(10);
  const [selectedEvent, setSelectedEvent] = useState<CalendarInstance | null>(null);

  // Current time marker
  const [now, setNow] = useState(() => new Date());
  const gridContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    calendarService.getCategories().then(setCategories);
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const loadEvents = async () => {
    const win = calendarService.getWeekWindow(currentRefDate);
    setWeekWindow(win);
    const evs = await calendarService.getWeekEvents(currentRefDate);
    setEvents(evs);
  };

  useEffect(() => {
    loadEvents();
  }, [currentRefDate]);

  useEffect(() => {
    const filtered = activeCategoryFilter
      ? events.filter((e) => e.categoryId === activeCategoryFilter)
      : events;
    const layout = calendarService.calculateWeekLayout(filtered, weekWindow);
    setPositionedEvents(layout);
  }, [events, weekWindow, activeCategoryFilter]);

  const handlePrevWeek = () => {
    const prev = new Date(currentRefDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentRefDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentRefDate);
    next.setDate(next.getDate() + 7);
    setCurrentRefDate(next);
  };

  const handleToday = () => {
    setCurrentRefDate(new Date());
  };

  const formatWeekRange = () => {
    const start = weekWindow.startDate;
    const end = weekWindow.endDate;
    const startStr = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' }).format(start);
    const endStr = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }).format(end);
    return `${startStr} – ${endStr}`;
  };

  const isCurrentWeek = () => {
    const today = new Date();
    return today >= weekWindow.startDate && today <= weekWindow.endDate;
  };

  const isToday = (date: Date) => {
    const t = new Date();
    return (
      date.getDate() === t.getDate() &&
      date.getMonth() === t.getMonth() &&
      date.getFullYear() === t.getFullYear()
    );
  };

  const getCategoryColor = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    return cat?.color || '#3b82f6';
  };

  const handleCellClick = (dayDate: Date, hour: number) => {
    setSelectedEvent(null);
    setModalInitialDate(dayDate);
    setModalInitialHour(hour);
    setIsModalOpen(true);
  };

  const handleEventClick = (e: React.MouseEvent, ev: CalendarInstance) => {
    e.stopPropagation();
    setSelectedEvent(ev);
    setIsModalOpen(true);
  };

  const todayIndex = isCurrentWeek() ? (now.getDay() === 0 ? 6 : now.getDay() - 1) : -1;

  const dayHeaderNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--divider)]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Wochenkalender
            </h1>
            <Badge variant="accent">Uni &amp; Privat</Badge>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Stundenplan, Vorlesungen, Lerngruppen und private Termine
          </p>
        </div>

        {/* Navigation Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevWeek}
              className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Vorherige Woche"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Heute
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Nächste Woche"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-xs font-semibold font-mono text-[var(--text-primary)] px-2 py-1 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
            {formatWeekRange()}
          </span>

          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              setSelectedEvent(null);
              setModalInitialDate(new Date());
              setModalInitialHour(10);
              setIsModalOpen(true);
            }}
          >
            Neuer Termin
          </Button>
        </div>
      </div>

      {/* Category Filter Legend */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] font-medium text-[var(--text-tertiary)] flex items-center gap-1">
          <Filter className="w-3 h-3" />
          Kategorien:
        </span>
        <button
          type="button"
          onClick={() => setActiveCategoryFilter(null)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
            activeCategoryFilter === null
              ? 'bg-[var(--text-primary)] text-[var(--bg-surface)] border-transparent'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]'
          }`}
        >
          Alle
        </button>
        {categories.map((cat) => {
          const isSelected = activeCategoryFilter === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategoryFilter(isSelected ? null : cat.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                isSelected
                  ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Calendar Grid Card */}
      <Card variant="standard" padding="none" className="overflow-hidden border border-[var(--border-subtle)]">
        <div ref={gridContainerRef} className="overflow-x-auto select-none min-w-[700px]">
          {/* Header row: 7 Days */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[var(--divider)] bg-[var(--bg-subtle)] sticky top-0 z-20">
            <div className="p-3 text-center text-[10px] font-mono text-[var(--text-tertiary)] uppercase border-r border-[var(--border-subtle)]">
              Zeit
            </div>
            {weekWindow.days.map((dayDate, idx) => {
              const currentDay = isToday(dayDate);
              return (
                <div
                  key={idx}
                  className={`py-2 px-1 text-center border-r border-[var(--border-subtle)] last:border-r-0 transition-colors ${
                    currentDay ? 'bg-[var(--accent-subtle)]/40' : ''
                  }`}
                >
                  <span className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                    {dayHeaderNames[idx]}
                  </span>
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold font-mono mt-0.5 ${
                      currentDay
                        ? 'bg-[var(--accent)] text-white shadow-xs'
                        : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {dayDate.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* All-Day Events row if any */}
          {events.some((e) => e.isAllDay) && (
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[var(--divider)] bg-[var(--bg-surface)] text-xs">
              <div className="p-2 text-[10px] text-[var(--text-tertiary)] font-mono text-center border-r border-[var(--border-subtle)]">
                Ganztägig
              </div>
              {weekWindow.days.map((dayDate, dayIdx) => {
                const dayDateKey = calendarService.formatDateKey(dayDate);
                const dayAllDayEvents = events.filter((e) => {
                  if (!e.isAllDay) return false;
                  const eDateKey = calendarService.formatDateKey(new Date(e.start));
                  return eDateKey === dayDateKey;
                });

                return (
                  <div
                    key={dayIdx}
                    className="p-1 min-h-[32px] border-r border-[var(--border-subtle)] last:border-r-0 space-y-1"
                  >
                    {dayAllDayEvents.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={(e) => handleEventClick(e, ev)}
                        className="w-full text-left px-2 py-0.5 rounded text-[10px] font-medium truncate text-white shadow-2xs cursor-pointer"
                        style={{ backgroundColor: getCategoryColor(ev.categoryId) }}
                      >
                        {ev.title}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Hourly Time Grid (Relative Container) */}
          <div className="relative grid grid-cols-[60px_repeat(7,1fr)] bg-[var(--bg-surface)]">
            {/* Time labels column */}
            <div className="border-r border-[var(--border-subtle)]">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="h-14 border-b border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-tertiary)] pr-2 text-right pt-1"
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* 7 Day columns with hour slots */}
            {weekWindow.days.map((dayDate, dayIdx) => {
              const currentDay = isToday(dayDate);
              return (
                <div
                  key={dayIdx}
                  className={`relative border-r border-[var(--border-subtle)] last:border-r-0 ${
                    currentDay ? 'bg-[var(--accent-subtle)]/10' : ''
                  }`}
                >
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      onClick={() => handleCellClick(dayDate, hour)}
                      className="h-14 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]/50 transition-colors cursor-pointer"
                    />
                  ))}
                </div>
              );
            })}

            {/* Positioned Events Layer */}
            <div className="absolute inset-0 left-[60px] pointer-events-none">
              <div className="relative w-full h-full">
                {positionedEvents.map((ev) => {
                  const dayWidthPct = 100 / 7;
                  const dayLeftPct = ev.dayIndex * dayWidthPct;
                  const colWidthPct = dayWidthPct / ev.totalColumns;
                  const eventLeftPct = dayLeftPct + ev.column * colWidthPct;

                  const color = getCategoryColor(ev.categoryId);

                  // Calculate top and height relative to the 06:00 - 23:00 visible window (17 hours = 1020 mins)
                  const startD = new Date(ev.start);
                  const endD = new Date(ev.end);
                  const startMins = startD.getHours() * 60 + startD.getMinutes();
                  const endMins = endD.getHours() * 60 + endD.getMinutes();

                  const gridStartMins = 6 * 60; // 06:00
                  const totalGridMins = 17 * 60; // 17 hours displayed

                  const topPct = Math.max(0, ((startMins - gridStartMins) / totalGridMins) * 100);
                  const heightPct = Math.max(2.5, ((endMins - startMins) / totalGridMins) * 100);

                  const startTimeStr = `${String(startD.getHours()).padStart(2, '0')}:${String(startD.getMinutes()).padStart(2, '0')}`;
                  const endTimeStr = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;

                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => handleEventClick(e, ev)}
                      style={{
                        left: `${eventLeftPct}%`,
                        width: `${colWidthPct * 0.96}%`,
                        top: `${topPct}%`,
                        height: `${heightPct}%`,
                        borderColor: color,
                        backgroundColor: `${color}18`, // 10% opacity tint
                      }}
                      className="absolute p-1.5 rounded-[var(--radius-sm)] border-l-3 border border-t-0 border-r-0 border-b-0 text-left cursor-pointer pointer-events-auto shadow-2xs hover:shadow-xs transition-shadow overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className="text-[11px] font-bold truncate leading-tight"
                            style={{ color }}
                          >
                            {ev.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] font-mono mt-0.5">
                          <Clock className="w-2.5 h-2.5 shrink-0 opacity-70" />
                          <span>
                            {startTimeStr} – {endTimeStr}
                          </span>
                        </div>
                      </div>

                      {ev.location && (
                        <div className="flex items-center gap-1 text-[9px] text-[var(--text-tertiary)] truncate mt-1">
                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{ev.location}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Live Current Time Horizontal Bar */}
                {isCurrentWeek() && todayIndex >= 0 && (
                  (() => {
                    const nowMins = now.getHours() * 60 + now.getMinutes();
                    const gridStartMins = 6 * 60;
                    const totalGridMins = 17 * 60;
                    if (nowMins >= gridStartMins && nowMins <= gridStartMins + totalGridMins) {
                      const topPct = ((nowMins - gridStartMins) / totalGridMins) * 100;
                      const dayWidthPct = 100 / 7;
                      const leftPct = todayIndex * dayWidthPct;

                      return (
                        <div
                          style={{
                            top: `${topPct}%`,
                            left: `${leftPct}%`,
                            width: `${dayWidthPct}%`,
                          }}
                          className="absolute pointer-events-none z-30 flex items-center"
                        >
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1" />
                          <div className="w-full h-0.5 bg-red-500 shadow-xs" />
                        </div>
                      );
                    }
                    return null;
                  })()
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Modal */}
      <CalendarEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialDate={modalInitialDate}
        initialHour={modalInitialHour}
        selectedEvent={selectedEvent}
        categories={categories}
        onSaved={loadEvents}
      />
    </div>
  );
};

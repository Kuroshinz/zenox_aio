import React, { useState } from 'react';
import { CalendarEvent } from '../types/calendar';
import { formatDateString, doesEventOccurOnDate, findConflictingEvents } from '../utils/calendarUtils';
import { getLunarDate } from '../utils/lunarUtils';
import { Video, MapPin, CheckCircle, Clock, Calendar as CalIcon, AlertTriangle } from 'lucide-react';

interface ScheduleViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  visibleCategoryIds: Set<string>;
  searchQuery: string;
  onSelectEvent: (event: CalendarEvent, targetElement: HTMLElement) => void;
  onToggleCompleteTask?: (eventId: string) => void;
  onJoinMeet?: (event: CalendarEvent) => void;
  lang: 'vi' | 'en';
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  currentDate,
  events,
  visibleCategoryIds,
  searchQuery,
  onSelectEvent,
  onToggleCompleteTask,
  onJoinMeet,
  lang,
}) => {
  const [horizonDays, setHorizonDays] = useState<7 | 14 | 45>(45);
  const [quickFilter, setQuickFilter] = useState<'all' | 'conflict' | 'meet' | 'task'>('all');

  const activeEvents = events.filter((e) => visibleCategoryIds.has(e.calendarId));

  // If search query or quick filter is present, filter accordingly
  const filteredEvents = activeEvents.filter((e) => {
    if (quickFilter === 'meet' && !e.meetUrl) return false;
    if (quickFilter === 'task' && e.type !== 'task') return false;
    if (quickFilter === 'conflict' && (e.allDay || findConflictingEvents(e, activeEvents).length === 0)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      (e.location && e.location.toLowerCase().includes(q)) ||
      (e.description && e.description.toLowerCase().includes(q))
    );
  });

  // Generate date entries starting from currentDate for selected horizon
  const dateGroups: { dateStr: string; date: Date; events: CalendarEvent[] }[] = [];
  const start = new Date(currentDate);

  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = formatDateString(d);

    const matches = filteredEvents.filter((e) => doesEventOccurOnDate(e, dateStr));
    if (matches.length > 0) {
      // Sort: all day first, then by startTime
      matches.sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });

      dateGroups.push({
        dateStr,
        date: d,
        events: matches,
      });
    }
  }

  const todayStr = formatDateString(new Date());

  const getDayLabel = (d: Date, dateStr: string) => {
    if (dateStr === todayStr) {
      return lang === 'vi' ? 'Hôm nay' : 'Today';
    }
    const daysVi = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return lang === 'vi' ? daysVi[d.getDay()] : daysEn[d.getDay()];
  };

  const totalUpcoming = dateGroups.reduce((sum, g) => sum + g.events.length, 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50/50 dark:bg-gray-900 select-none">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Range & Quick Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            {([7, 14, 45] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setHorizonDays(days)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  horizonDays === days
                    ? 'bg-rose-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {lang === 'vi' ? `${days} ngày tới` : `Next ${days}d`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'all', vi: 'Tất cả', en: 'All' },
                { id: 'conflict', vi: 'Trùng lịch', en: 'Conflicts' },
                { id: 'meet', vi: 'Có Meet', en: 'With Meet' },
                { id: 'task', vi: 'Công việc', en: 'Tasks' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setQuickFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  quickFilter === f.id
                    ? f.id === 'conflict'
                      ? 'bg-amber-600 text-white'
                      : 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {lang === 'vi' ? f.vi : f.en}
              </button>
            ))}
            <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              {totalUpcoming}
            </span>
          </div>
        </div>

        {dateGroups.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <CalIcon className="w-12 h-12 mx-auto mb-3 opacity-40 text-gray-400" />
            <p className="text-base font-medium">
              {lang === 'vi'
                ? 'Không tìm thấy sự kiện nào trong khoảng thời gian này.'
                : 'No events found for this timeframe.'}
            </p>
          </div>
        ) : (
          dateGroups.map((group) => {
            const isToday = group.dateStr === todayStr;
            const lunar = getLunarDate(group.dateStr);

            return (
              <div key={group.dateStr} className="flex flex-col sm:flex-row gap-2 sm:gap-6 items-start">
                {/* Date column */}
                <div className="w-36 shrink-0 pt-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-2xl font-bold w-10 h-10 rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-800 dark:text-gray-100'
                      }`}
                    >
                      {group.date.getDate()}
                    </span>
                    <div>
                      <span className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                        {getDayLabel(group.date, group.dateStr)}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {group.date.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', {
                          month: 'short',
                        })}
                        {lang === 'vi' && ` · ÂL ${lunar.day}/${lunar.month}`}
                      </span>
                      {lang === 'vi' && lunar.festivalName && (
                        <span className="block text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          {lunar.festivalName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Events list cards */}
                <div className="flex-1 space-y-2.5 w-full">
                  {group.events.map((ev) => {
                    const dayConflicts = !ev.allDay
                      ? findConflictingEvents({ ...ev, startDate: group.dateStr }, group.events)
                      : [];
                    return (
                    <div
                      key={ev.id}
                      onClick={(e) => onSelectEvent(ev, e.currentTarget)}
                      className={`bg-white dark:bg-gray-800 p-3.5 rounded-xl border hover:shadow-md transition-all cursor-pointer relative overflow-hidden group ${
                        dayConflicts.length > 0
                          ? 'border-amber-400/80 dark:border-amber-500/70'
                          : 'border-gray-200 dark:border-white/[0.1]'
                      }`}
                    >
                      {/* Left accent color strip */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1.5"
                        style={{ backgroundColor: ev.color }}
                      />

                      <div className="flex items-start justify-between gap-3 pl-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {ev.type === 'task' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleCompleteTask?.(ev.id);
                                }}
                                className="text-gray-400 hover:text-emerald-500 cursor-pointer"
                              >
                                <CheckCircle
                                  className={`w-4 h-4 ${
                                    ev.isCompleted ? 'text-emerald-500 fill-emerald-100' : ''
                                  }`}
                                />
                              </button>
                            )}

                            <h3
                              className={`text-sm font-semibold text-gray-800 dark:text-gray-100 truncate ${
                                ev.isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : ''
                              }`}
                            >
                              {ev.title}
                            </h3>

                            <span
                              style={{ color: ev.color, borderColor: ev.color }}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-opacity-10 shrink-0"
                            >
                              {ev.type === 'event'
                                ? lang === 'vi' ? 'Sự kiện' : 'Event'
                                : ev.type === 'task'
                                ? lang === 'vi' ? 'Tác vụ' : 'Task'
                                : lang === 'vi' ? 'Nhắc nhở' : 'Reminder'}
                            </span>

                            {dayConflicts.length > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 shrink-0">
                                <AlertTriangle className="w-3 h-3" />
                                {lang === 'vi'
                                  ? `Trùng ${dayConflicts.map((c) => c.title).join(', ')}`
                                  : `Overlaps ${dayConflicts.map((c) => c.title).join(', ')}`}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {ev.allDay
                                ? lang === 'vi' ? 'Cả ngày' : 'All day'
                                : `${ev.startTime} – ${ev.endTime}`}
                            </span>

                            {ev.location && (
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                <span className="truncate">{ev.location}</span>
                              </span>
                            )}
                          </div>

                          {ev.description && (
                            <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                              {ev.description}
                            </p>
                          )}
                        </div>

                        {/* Google Meet Direct Join Button */}
                        {ev.meetUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onJoinMeet) onJoinMeet(ev);
                              else window.open(ev.meetUrl, '_blank');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors shrink-0 cursor-pointer"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>{lang === 'vi' ? 'Tham gia' : 'Join'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

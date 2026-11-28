import React, { useState } from 'react';
import {
  X,
  Edit2,
  Trash2,
  Clock,
  MapPin,
  Users,
  Video,
  AlignLeft,
  Copy,
  Check,
  CheckCircle2,
  Download,
  CalendarPlus,
  AlertTriangle,
} from 'lucide-react';
import { CalendarEvent, CalendarCategory } from '../types/calendar';
import {
  exportToIcs,
  formatDateString,
  parseDateString,
  timeToMinutes,
  findConflictingEvents,
  resolveNonConflictingSlot,
} from '../utils/calendarUtils';

interface EventDetailCardProps {
  event: CalendarEvent;
  events?: CalendarEvent[];
  categories: CalendarCategory[];
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
  onDuplicate?: (event: CalendarEvent) => void;
  onQuickReschedule?: (event: CalendarEvent) => void;
  onToggleComplete?: (eventId: string) => void;
  onJoinMeet?: (event: CalendarEvent) => void;
  lang: 'vi' | 'en';
}

export const EventDetailCard: React.FC<EventDetailCardProps> = ({
  event,
  events = [],
  categories,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
  onQuickReschedule,
  onToggleComplete,
  onJoinMeet,
  lang,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const category = categories.find((c) => c.id === event.calendarId);

  const liveStatus = (() => {
    const now = new Date();
    const todayStr = formatDateString(now);
    if (event.startDate !== todayStr || event.allDay || !event.startTime || !event.endTime) return null;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const startMins = timeToMinutes(event.startTime);
    const endMins = timeToMinutes(event.endTime);
    if (nowMins >= startMins && nowMins < endMins) {
      const left = endMins - nowMins;
      return {
        tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        text: lang === 'vi' ? `Đang diễn ra · còn ${left} phút` : `Live now · ${left}m left`,
      };
    }
    if (nowMins < startMins) {
      const diff = startMins - nowMins;
      const label =
        diff >= 60
          ? `${Math.floor(diff / 60)}h ${diff % 60}m`
          : `${diff} ${lang === 'vi' ? 'phút' : 'min'}`;
      return {
        tone: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
        text: lang === 'vi' ? `Bắt đầu sau ${label}` : `Starts in ${label}`,
      };
    }
    return {
      tone: 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/20',
      text: lang === 'vi' ? 'Đã kết thúc' : 'Ended',
    };
  })();

  const handleDownloadSingleIcs = () => {
    const ics = exportToIcs([event]);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(event.title || 'event').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40)}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const conflicts = !event.allDay ? findConflictingEvents(event, events) : [];
  const durationMins =
    !event.allDay && event.startTime && event.endTime
      ? Math.max(15, timeToMinutes(event.endTime) - timeToMinutes(event.startTime))
      : 60;
  const openAlternative =
    conflicts.length > 0
      ? resolveNonConflictingSlot(event.startDate, event.startTime, durationMins, events, {
          ignoreEventIds: [event.id],
          minHour: 6,
          maxHour: 23,
          bufferMinutes: 15,
        })
      : null;

  const handleDuplicateTomorrow = () => {
    if (!onDuplicate) return;
    const nextDay = parseDateString(event.startDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextStr = formatDateString(nextDay);
    let targetStart = event.startTime;
    let targetEnd = event.endTime;

    if (!event.allDay && events.length > 0) {
      const tomorrowConflicts = findConflictingEvents(
        {
          startDate: nextStr,
          startTime: event.startTime,
          endTime: event.endTime,
          allDay: event.allDay,
        },
        events
      );
      if (tomorrowConflicts.length > 0) {
        const res = resolveNonConflictingSlot(nextStr, event.startTime, durationMins, events, {
          minHour: 6,
          maxHour: 23,
          bufferMinutes: 15,
        });
        const conflictNames = tomorrowConflicts.map((c) => `"${c.title}" (${c.startTime}–${c.endTime})`).join(', ');
        if (res.status === 'shifted') {
          const shiftToFree = window.confirm(
            lang === 'vi'
              ? `Ngày mai (${nextStr}) lúc ${event.startTime}–${event.endTime} bị trùng với ${conflictNames}.\n\nBấm OK để tự động đặt vào giờ trống gần nhất (${res.startTime}–${res.endTime}), hoặc Cancel để hủy.`
              : `Tomorrow (${nextStr}) ${event.startTime}–${event.endTime} overlaps with ${conflictNames}.\n\nClick OK to schedule in the nearest open slot (${res.startTime}–${res.endTime}), or Cancel to abort.`
          );
          if (!shiftToFree) return;
          targetStart = res.startTime;
          targetEnd = res.endTime;
        } else {
          const force = window.confirm(
            lang === 'vi'
              ? `Ngày mai (${nextStr}) lúc ${event.startTime}–${event.endTime} bị trùng với ${conflictNames}. Vẫn nhân bản?`
              : `Tomorrow (${nextStr}) ${event.startTime}–${event.endTime} overlaps with ${conflictNames}. Duplicate anyway?`
          );
          if (!force) return;
        }
      }
    }

    onDuplicate({
      ...event,
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      startDate: nextStr,
      endDate: nextStr,
      startTime: targetStart,
      endTime: targetEnd,
      isCompleted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    onClose();
  };

  const handleCopyMeet = () => {
    if (event.meetUrl) {
      navigator.clipboard.writeText(event.meetUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const getRecurrenceLabel = () => {
    if (!event.recurrence || event.recurrence === 'none') return null;
    const mapVi: Record<string, string> = {
      daily: 'Hàng ngày',
      weekly: 'Hàng tuần',
      monthly: 'Hàng tháng',
      yearly: 'Hàng năm',
    };
    const mapEn: Record<string, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      yearly: 'Yearly',
    };
    return lang === 'vi' ? mapVi[event.recurrence] : mapEn[event.recurrence];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/40 backdrop-blur-2xs">
      <div className="bg-white dark:bg-[#1a1e24] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top colored accent line */}
        <div className="h-2" style={{ backgroundColor: event.color }} />

        {/* Top Action bar */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span
              style={{ backgroundColor: `${event.color}20`, color: event.color }}
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
            >
              {category ? (lang === 'vi' ? category.nameVi : category.name) : 'Lịch'}
            </span>
            {event.type === 'task' && (
              <button
                onClick={() => onToggleComplete?.(event.id)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600 cursor-pointer"
              >
                <CheckCircle2
                  className={`w-4 h-4 ${
                    event.isCompleted ? 'text-emerald-600 fill-emerald-100' : ''
                  }`}
                />
                <span>{event.isCompleted ? (lang === 'vi' ? 'Đã xong' : 'Completed') : (lang === 'vi' ? 'Đánh dấu hoàn thành' : 'Mark complete')}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {onDuplicate && !event.id.startsWith('task-') && (
              <button
                onClick={handleDuplicateTomorrow}
                title={lang === 'vi' ? 'Nhân bản sang ngày mai' : 'Duplicate to tomorrow'}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#242931] text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
              >
                <CalendarPlus className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleDownloadSingleIcs}
              title={lang === 'vi' ? 'Tải tệp .ics sự kiện này' : 'Download .ics'}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#242931] text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEdit(event)}
              title={lang === 'vi' ? 'Chỉnh sửa sự kiện' : 'Edit event'}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#242931] text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                onDelete(event.id);
                onClose();
              }}
              title={lang === 'vi' ? 'Xóa sự kiện' : 'Delete event'}
              className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-600 hover:text-red-600 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title={lang === 'vi' ? 'Đóng' : 'Close'}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#242931] text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Title & color icon */}
          <div className="flex items-start gap-3">
            <div
              className="w-4 h-4 rounded-sm mt-1 shrink-0 shadow-xs"
              style={{ backgroundColor: event.color }}
            />
            <div>
              <h2
                className={`text-lg font-bold text-gray-900 dark:text-gray-100 leading-snug ${
                  event.isCompleted ? 'line-through text-gray-400' : ''
                }`}
              >
                {event.title}
              </h2>
            </div>
          </div>

          {/* Time & Recurrence */}
          <div className="flex items-start gap-3 text-xs text-gray-600 dark:text-gray-300">
            <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-200">
                {event.startDate}
                {event.endDate && event.endDate !== event.startDate ? ` – ${event.endDate}` : ''}
              </p>
              <p className="text-gray-500 dark:text-gray-400">
                {event.allDay
                  ? lang === 'vi' ? 'Cả ngày' : 'All day'
                  : `${event.startTime} – ${event.endTime}`}
                {getRecurrenceLabel() && ` • ${getRecurrenceLabel()}`}
              </p>
              {liveStatus && (
                <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${liveStatus.tone}`}>
                  {liveStatus.text}
                </span>
              )}
            </div>
          </div>

          {/* Conflict Warning & 1-Click Resolution */}
          {conflicts.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/70 text-xs text-amber-800 dark:text-amber-200 space-y-2">
              <div className="flex items-start gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>
                  {lang === 'vi'
                    ? `Đang trùng lịch với ${conflicts.map((c) => `"${c.title}" (${c.startTime}–${c.endTime})`).join(', ')}`
                    : `Overlaps with ${conflicts.map((c) => `"${c.title}" (${c.startTime}–${c.endTime})`).join(', ')}`}
                </span>
              </div>
              {openAlternative?.status === 'shifted' && onQuickReschedule && !event.id.startsWith('gcal-') && (
                <button
                  type="button"
                  onClick={() => {
                    onQuickReschedule({
                      ...event,
                      startTime: openAlternative.startTime,
                      endTime: openAlternative.endTime,
                      updatedAt: Date.now(),
                    });
                    onClose();
                  }}
                  className="w-full px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                >
                  {lang === 'vi'
                    ? `Tự dời sang giờ trống gần nhất: ${openAlternative.startTime} – ${openAlternative.endTime}`
                    : `Move to nearest open slot: ${openAlternative.startTime} – ${openAlternative.endTime}`}
                </button>
              )}
            </div>
          )}

          {/* Google Meet Video Action */}
          {event.meetUrl && (
            <div className="flex items-center gap-3">
              <Video className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="flex-1 flex items-center justify-between gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800">
                <button
                  type="button"
                  onClick={() => onJoinMeet ? onJoinMeet(event) : window.open(event.meetUrl, '_blank')}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Tham gia bằng Google Meet' : 'Join with Google Meet'}</span>
                </button>
                <button
                  onClick={handleCopyMeet}
                  title={lang === 'vi' ? 'Sao chép đường liên kết' : 'Copy link'}
                  className="p-1.5 hover:bg-blue-200/50 dark:hover:bg-blue-900 text-blue-600 rounded-md transition-colors cursor-pointer"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3 text-xs text-gray-600 dark:text-gray-300">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <span>{event.location}</span>
            </div>
          )}

          {/* Guests List */}
          {event.guests && event.guests.length > 0 && (
            <div className="flex items-start gap-3 text-xs text-gray-600 dark:text-gray-300">
              <Users className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-gray-700 dark:text-gray-200">
                  {event.guests.length} {lang === 'vi' ? 'người tham gia' : 'guests'}
                </p>
                <div className="space-y-1 pt-1">
                  {event.guests.map((g, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px]">
                      <span className="truncate">{g.name ? `${g.name} (${g.email})` : g.email}</span>
                      <span className="text-[10px] text-gray-400 capitalize">{g.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex items-start gap-3 text-xs text-gray-600 dark:text-gray-300 pt-1 border-t border-gray-100 dark:border-gray-800">
              <AlignLeft className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div className="flex-1 whitespace-pre-wrap leading-relaxed">
                {event.description}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


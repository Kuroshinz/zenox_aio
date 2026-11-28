import React, { useState, useMemo, useEffect } from 'react';
import { X, Sparkles, Clock, Calendar as CalIcon, ArrowRight, AlertTriangle } from 'lucide-react';
import {
  parseNaturalLanguageInput,
  findConflictingEvents,
  resolveNonConflictingSlot,
  timeToMinutes,
} from '../utils/calendarUtils';
import { CalendarEvent } from '../types/calendar';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEvent: (event: CalendarEvent) => void;
  currentDate: Date;
  events?: CalendarEvent[];
  lang: 'vi' | 'en';
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  onAddEvent,
  currentDate,
  events = [],
  lang,
}) => {
  const [inputText, setInputText] = useState('');
  const [overrideSlot, setOverrideSlot] = useState<{ startTime: string; endTime: string } | null>(null);

  const parsed = useMemo(() => {
    if (!inputText.trim()) return null;
    return parseNaturalLanguageInput(inputText, currentDate);
  }, [inputText, currentDate]);

  useEffect(() => {
    setOverrideSlot(null);
  }, [inputText, isOpen]);

  const effectiveStart = overrideSlot?.startTime ?? parsed?.startTime ?? '';
  const effectiveEnd = overrideSlot?.endTime ?? parsed?.endTime ?? '';

  const conflictInfo = useMemo(() => {
    if (!parsed) return { conflicts: [] as CalendarEvent[], suggestion: null as { startTime: string; endTime: string } | null };
    const conflicts = findConflictingEvents(
      {
        startDate: parsed.date,
        startTime: effectiveStart,
        endTime: effectiveEnd,
        allDay: false,
      },
      events
    );
    if (conflicts.length === 0) {
      return { conflicts: [], suggestion: null };
    }
    const dur = Math.max(15, timeToMinutes(effectiveEnd) - timeToMinutes(effectiveStart));
    const resolution = resolveNonConflictingSlot(parsed.date, parsed.startTime, dur, events, {
      minHour: 6,
      maxHour: 22,
      bufferMinutes: 0,
    });
    const suggestion =
      resolution.status === 'shifted'
        ? { startTime: resolution.startTime, endTime: resolution.endTime }
        : null;
    return { conflicts, suggestion };
  }, [parsed, effectiveStart, effectiveEnd, events]);

  if (!isOpen) return null;

  const suggestions = lang === 'vi'
    ? [
        'Họp chiến lược lúc 10h sáng mai',
        'Ăn trưa cùng nhóm thiết kế lúc 12h thứ 6',
        'Gặp khách hàng lúc 15h30 chiều mai',
        'Tập gym lúc 18h hàng ngày',
      ]
    : [
        'Team retrospective at 10am tomorrow',
        'Lunch with design leads on Friday at 12:30pm',
        'Client demo tomorrow at 3pm',
        'Daily standup at 9am',
      ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed || !parsed.title.trim()) return;

    const newEvent: CalendarEvent = {
      id: `usr-qa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: parsed.title,
      startDate: parsed.date,
      startTime: effectiveStart,
      endDate: parsed.date,
      endTime: effectiveEnd,
      allDay: false,
      calendarId: 'personal',
      color: '#039BE5',
      type: 'event',
      createdAt: Date.now(),
    };

    onAddEvent(newEvent);
    setInputText('');
    setOverrideSlot(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/45 backdrop-blur-2xs">
      <div className="bg-white dark:bg-[#1a1e24] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-blue-50/50 dark:bg-blue-950/20">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Sparkles className="w-5 h-5 text-blue-500" />
            <h3 className="text-sm font-bold">
              {lang === 'vi' ? 'Tạo nhanh sự kiện thông minh' : 'Quick Create with Natural Language'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-[#242931] text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                lang === 'vi'
                  ? 'Ví dụ: Họp báo cáo tiến độ 14h ngày mai'
                  : 'E.g.: Product review tomorrow at 2pm'
              }
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-blue-300 dark:border-blue-700 focus:border-blue-500 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none bg-blue-50/20 dark:bg-gray-800 shadow-xs"
            />
          </div>

          {/* Parsed Live Preview */}
          {parsed && (
            <div className="space-y-2">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 text-xs space-y-1.5">
                <span className="font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[10px]">
                  {lang === 'vi' ? 'Kết quả phân tích:' : 'Parsed Result:'}
                </span>
                <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                  {parsed.title}
                </div>
                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300 font-mono">
                  <span className="flex items-center gap-1">
                    <CalIcon className="w-3.5 h-3.5 text-blue-500" />
                    {parsed.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    {effectiveStart} – {effectiveEnd}
                  </span>
                  {overrideSlot && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-sans font-semibold">
                      {lang === 'vi' ? 'Đã dời né trùng' : 'Shifted'}
                    </span>
                  )}
                </div>
              </div>

              {conflictInfo.conflicts.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-200 space-y-2">
                  <div className="flex items-start gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      {lang === 'vi'
                        ? `Cảnh báo: Khung giờ này trùng với ${conflictInfo.conflicts.map((c) => `"${c.title}" (${c.startTime}–${c.endTime})`).join(', ')}`
                        : `Warning: Overlaps with ${conflictInfo.conflicts.map((c) => `"${c.title}" (${c.startTime}–${c.endTime})`).join(', ')}`}
                    </span>
                  </div>
                  {conflictInfo.suggestion && (
                    <button
                      type="button"
                      onClick={() => setOverrideSlot(conflictInfo.suggestion)}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      {lang === 'vi'
                        ? `Chuyển sang giờ trống gần nhất: ${conflictInfo.suggestion.startTime} – ${conflictInfo.suggestion.endTime}`
                        : `Use nearest open slot: ${conflictInfo.suggestion.startTime} – ${conflictInfo.suggestion.endTime}`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sample Prompts */}
          <div>
            <span className="text-[11px] font-medium text-gray-400 block mb-1.5">
              {lang === 'vi' ? 'Gợi ý câu lệnh mẫu:' : 'Suggestions:'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInputText(s)}
                  className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer"
            >
              {lang === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={!parsed || !parsed.title.trim()}
              className={`flex items-center gap-1.5 px-5 py-2 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer ${
                conflictInfo.conflicts.length > 0
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <span>
                {conflictInfo.conflicts.length > 0
                  ? lang === 'vi'
                    ? 'Vẫn tạo (trùng lịch)'
                    : 'Add anyway (overlap)'
                  : lang === 'vi'
                  ? 'Tạo sự kiện'
                  : 'Add event'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


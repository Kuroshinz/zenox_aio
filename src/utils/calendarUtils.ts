import { CalendarEvent, RecurrenceType } from '../types/calendar';

/**
 * Format Date to YYYY-MM-DD
 */
export function formatDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse YYYY-MM-DD safely in local time
 */
export function parseDateString(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Format time to HH:mm
 */
export function formatTimeString(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Generate 35 or 42 grid cells for Month View
 */
export interface MonthGridDay {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayNumber: number;
}

export function getMonthDays(year: number, month: number, weekStartsOnMonday = false): MonthGridDay[] {
  const todayStr = formatDateString(new Date());
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Day of week for 1st of month: 0 (Sun) to 6 (Sat)
  let firstDayIndex = firstDayOfMonth.getDay();
  if (weekStartsOnMonday) {
    firstDayIndex = (firstDayIndex + 6) % 7;
  }

  const days: MonthGridDay[] = [];

  // Previous month trailing days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const d = new Date(year, month - 1, dayNum);
    const dateStr = formatDateString(d);
    days.push({
      date: d,
      dateString: dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      dayNumber: dayNum,
    });
  }

  // Current month days
  const totalDaysCurrentMonth = lastDayOfMonth.getDate();
  for (let i = 1; i <= totalDaysCurrentMonth; i++) {
    const d = new Date(year, month, i);
    const dateStr = formatDateString(d);
    days.push({
      date: d,
      dateString: dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      dayNumber: i,
    });
  }

  // Next month leading days (fill up to multiple of 7, 35 or 42)
  const remainingCells = (7 - (days.length % 7)) % 7;
  const targetTotal = days.length + remainingCells < 35 ? 35 : days.length + remainingCells;
  let nextMonthDay = 1;
  while (days.length < targetTotal) {
    const d = new Date(year, month + 1, nextMonthDay);
    const dateStr = formatDateString(d);
    days.push({
      date: d,
      dateString: dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      dayNumber: nextMonthDay,
    });
    nextMonthDay++;
  }

  return days;
}

/**
 * Returns 7 days for the week containing `targetDate`
 */
export function getWeekDates(targetDate: Date, weekStartsOnMonday = false): Date[] {
  const date = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  let day = date.getDay(); // 0 is Sunday
  if (weekStartsOnMonday) {
    day = (day + 6) % 7;
  }

  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - day);

  const week: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    week.push(d);
  }
  return week;
}

/**
 * Returns 4 consecutive days starting from targetDate
 */
export function getFourDayDates(targetDate: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(targetDate);
    d.setDate(targetDate.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/**
 * Checks if an event occurs on a specific target date string (handles recurring)
 */
export function doesEventOccurOnDate(event: CalendarEvent, targetDateStr: string): boolean {
  if (event.startDate === targetDateStr) return true;
  if (!event.recurrence || event.recurrence === 'none') {
    // Multi-day non-recurring event check
    if (event.endDate && event.startDate <= targetDateStr && targetDateStr <= event.endDate) {
      return true;
    }
    return false;
  }

  // If target date is before event start, it cannot occur
  if (targetDateStr < event.startDate) return false;

  const targetDate = parseDateString(targetDateStr);
  const startDate = parseDateString(event.startDate);

  switch (event.recurrence) {
    case 'daily':
      return true;
    case 'weekly':
      return targetDate.getDay() === startDate.getDay();
    case 'monthly':
      return targetDate.getDate() === startDate.getDate();
    case 'yearly':
      return targetDate.getMonth() === startDate.getMonth() && targetDate.getDate() === startDate.getDate();
    default:
      return false;
  }
}

/**
 * Calculate overlapping layout for Week/Day view columns
 */
export interface LayoutPosition {
  topPercent: number;
  heightPercent: number;
  leftPercent: number;
  widthPercent: number;
  zIndex?: number;
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}


/**
 * Normalizes event title for comparisons
 */
export function normalizeEventTitle(title: string): string {
  let norm = (title || '').trim().toLowerCase().replace(/\s+/g, ' ');
  // Typo normalization for fitness/gym entries
  if (norm === 'gyn' || norm.startsWith('gyn ')) {
    norm = norm.replace(/^gyn/, 'gym');
  }
  return norm;
}

/**
 * Deduplicates events:
 * 1. Merges exact duplicates (same date, startTime, endTime, and title).
 * 2. If a timed event exists for a title on a date (e.g. "Học chính khóa 06:55 - 11:15"),
 *    removes the duplicate all-day placeholder with the same title on that date.
 */
function normalizeTimeStr(t?: string): string {
  if (!t) return '00:00';
  const parts = t.trim().split(':');
  if (parts.length < 2) return '00:00';
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}

/**
 * Identifies built-in demo/welcome events (`ev-1`..`ev-999`, `ev-welcome-*`)
 * so real user events (`usr-*`, `ev-<timestamp>`, `ev-qa-*`, `ev-copilot-*`)
 * are never mistakenly purged when Google Calendar events exist.
 */
export function isDemoEventId(id: string): boolean {
  return /^ev-\d{1,3}$/.test(id) || id.startsWith('ev-welcome-');
}

export function deduplicateEvents(events: CalendarEvent[]): CalendarEvent[] {
  if (!events || events.length === 0) return [];

  // If real Google or user events exist, discard fake mock demo events only
  const hasRealEvents = events.some(
    (e) =>
      e.id.startsWith('gcal-') ||
      e.id.startsWith('usr-') ||
      e.id.startsWith('evt-') ||
      e.id.startsWith('task-') ||
      e.id.startsWith('scheduled-wo-') ||
      e.id.startsWith('ctg-workout-')
  );
  const candidates = hasRealEvents ? events.filter((e) => !isDemoEventId(e.id)) : events;

  const timedByDateAndTitle = new Set<string>();

  // Pass 1: detect timed events to eliminate duplicate all-day course placeholders
  for (const ev of candidates) {
    if (!ev.allDay && ev.startTime && ev.endTime) {
      const normTitle = normalizeEventTitle(ev.title);
      timedByDateAndTitle.add(`${ev.startDate}_${normTitle}`);
    }
  }

  const exactDeduped: CalendarEvent[] = [];
  const seenExact = new Set<string>();

  for (const ev of candidates) {
    const normTitle = normalizeEventTitle(ev.title);

    // If an all-day event duplicates a timed event on the same day, drop the all-day placeholder
    if (ev.allDay && timedByDateAndTitle.has(`${ev.startDate}_${normTitle}`)) {
      continue;
    }

    const startT = normalizeTimeStr(ev.startTime);
    const endT = normalizeTimeStr(ev.endTime);
    const key = `${ev.startDate}_${startT}_${endT}_${normTitle}_${Boolean(ev.allDay)}`;

    if (seenExact.has(key)) {
      continue;
    }
    seenExact.add(key);
    exactDeduped.push(ev);
  }

  // Pass 3: Overlapping same-title deduplication on the same date
  // e.g. "Gym 16:00 - 18:00" and "Gym 16:00 - 17:00" on the same day -> keep the Google Calendar or longer one
  const byDateAndTitle = new Map<string, CalendarEvent[]>();
  for (const ev of exactDeduped) {
    if (ev.allDay) continue;
    const normTitle = normalizeEventTitle(ev.title);
    const groupKey = `${ev.startDate}_${normTitle}`;
    const list = byDateAndTitle.get(groupKey) || [];
    list.push(ev);
    byDateAndTitle.set(groupKey, list);
  }

  const toDropIds = new Set<string>();
  for (const [_, group] of byDateAndTitle.entries()) {
    if (group.length <= 1) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (toDropIds.has(a.id) || toDropIds.has(b.id)) continue;

        const aStart = timeToMinutes(a.startTime);
        const aEnd = timeToMinutes(a.endTime);
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);

        const isOverlapping = Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
        const isNearStart = Math.abs(aStart - bStart) <= 35;

        if (isOverlapping || isNearStart) {
          const aIsGcal = a.id.startsWith('gcal-');
          const bIsGcal = b.id.startsWith('gcal-');
          if (aIsGcal && !bIsGcal) {
            toDropIds.add(b.id);
          } else if (!aIsGcal && bIsGcal) {
            toDropIds.add(a.id);
          } else {
            const aDur = aEnd - aStart;
            const bDur = bEnd - bStart;
            if (aDur >= bDur) {
              toDropIds.add(b.id);
            } else {
              toDropIds.add(a.id);
            }
          }
        }
      }
    }
  }

  return exactDeduped.filter((e) => !toDropIds.has(e.id));
}

/**
 * Merges freshly fetched Google Calendar events authoritatively:
 * 1. Replaces all previous gcal-* events with current Google Calendar state.
 * 2. Purges stale mock/demo events.
 * 3. Removes local copies that duplicate incoming Google events.
 * 4. Deduplicates overlapping same-title events.
 */
export function mergeSyncedGoogleEvents(
  googleEvents: CalendarEvent[],
  existingEvents: CalendarEvent[]
): CalendarEvent[] {
  const nonMock = (existingEvents || []).filter(
    (e) => !e.id.startsWith('ev-') && !e.id.startsWith('demo-')
  );

  // Authoritative Google Calendar sync: all events previously originating from Google Calendar
  // are replaced by the freshly fetched Google Calendar events.
  const localNonGoogle = nonMock.filter((e) => !e.id.startsWith('gcal-'));

  const gcalKeys = new Set(
    (googleEvents || []).map((g) => `${g.startDate}_${normalizeEventTitle(g.title)}`)
  );

  const filteredLocal = localNonGoogle.filter((loc) => {
    const key = `${loc.startDate}_${normalizeEventTitle(loc.title)}`;
    return !gcalKeys.has(key);
  });

  const combined = [...(googleEvents || []), ...filteredLocal];
  return deduplicateEvents(combined);
}

export function computeEventLayout(
  events: CalendarEvent[],
  targetDateStr: string
): Map<string, LayoutPosition> {
  const layoutMap = new Map<string, LayoutPosition>();
  const deduped = deduplicateEvents(events);
  const dayEvents = deduped.filter((e) => !e.allDay && doesEventOccurOnDate(e, targetDateStr));

  // Sort by start time then by duration
  const sorted = [...dayEvents].sort((a, b) => {
    const aStart = timeToMinutes(a.startTime);
    const bStart = timeToMinutes(b.startTime);
    if (aStart !== bStart) return aStart - bStart;
    const aDur = timeToMinutes(a.endTime) - aStart;
    const bDur = timeToMinutes(b.endTime) - bStart;
    return bDur - aDur;
  });

  // Cluster overlapping events
  const clusters: CalendarEvent[][] = [];
  let currentCluster: CalendarEvent[] = [];
  let clusterEnd = -1;

  for (const ev of sorted) {
    const start = timeToMinutes(ev.startTime);
    const end = Math.max(timeToMinutes(ev.endTime), start + 30); // minimum 30 min duration for visibility

    if (currentCluster.length === 0) {
      currentCluster.push(ev);
      clusterEnd = end;
    } else if (start < clusterEnd) {
      currentCluster.push(ev);
      clusterEnd = Math.max(clusterEnd, end);
    } else {
      clusters.push(currentCluster);
      currentCluster = [ev];
      clusterEnd = end;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // Layout each cluster side-by-side so cards NEVER cover/obscure each other
  for (const cluster of clusters) {
    const columns: CalendarEvent[][] = [];
    for (const ev of cluster) {
      const start = timeToMinutes(ev.startTime);
      let placed = false;
      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        const lastInCol = columns[colIdx][columns[colIdx].length - 1];
        const lastEnd = Math.max(timeToMinutes(lastInCol.endTime), timeToMinutes(lastInCol.startTime) + 25);
        if (start >= lastEnd) {
          columns[colIdx].push(ev);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([ev]);
      }
    }

    const numCols = columns.length;
    const colWidth = 100 / numCols;

    columns.forEach((col, colIdx) => {
      col.forEach((ev) => {
        const start = timeToMinutes(ev.startTime);
        const end = Math.max(timeToMinutes(ev.endTime), start + 30);
        const topPercent = (start / (24 * 60)) * 100;
        const heightPercent = ((end - start) / (24 * 60)) * 100;

        // Side-by-side partitioned columns with 1% gap
        const leftPercent = Number((colIdx * colWidth).toFixed(2));
        const widthPercent = Number(Math.max(20, colWidth - 1).toFixed(2));
        const zIndex = 10 + colIdx;

        layoutMap.set(ev.id, {
          topPercent,
          heightPercent,
          leftPercent,
          widthPercent,
          zIndex,
        });
      });
    });
  }

  return layoutMap;
}

/**
 * Generate realistic Google Meet URL
 */
export function generateGoogleMeetUrl(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const rand = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `https://meet.google.com/${rand(3)}-${rand(4)}-${rand(3)}`;
}

/**
 * Natural language parser for Quick Add (supports both Tiếng Việt and English)
 * e.g. "Họp nhóm 10h sáng mai", "Meeting at 3pm tomorrow", "Lunch on Friday at 12:30"
 */
export function parseNaturalLanguageInput(
  text: string,
  referenceDate: Date = new Date()
): { title: string; date: string; startTime: string; endTime: string } {
  let cleanText = text.trim();
  const ref = new Date(referenceDate);

  let targetDate = new Date(ref);
  let startHour = 9;
  let startMinute = 0;
  let hasExplicitTime = false;

  // Check tomorrow / ngày mai
  if (/\b(ngày mai|mai|tomorrow)\b/i.test(cleanText)) {
    targetDate.setDate(targetDate.getDate() + 1);
    cleanText = cleanText.replace(/\b(ngày mai|mai|tomorrow)\b/i, '').trim();
  } else if (/\b(hôm nay|today)\b/i.test(cleanText)) {
    cleanText = cleanText.replace(/\b(hôm nay|today)\b/i, '').trim();
  }

  // Check day of week (thứ 2..thứ 7, chủ nhật / monday..sunday)
  const daysVi: { [key: string]: number } = {
    'chủ nhật': 0, 'cn': 0,
    'thứ hai': 1, 'thứ 2': 1, 't2': 1,
    'thứ ba': 2, 'thứ 3': 2, 't3': 2,
    'thứ tư': 3, 'thứ 4': 3, 't4': 3,
    'thứ năm': 4, 'thứ 5': 4, 't5': 4,
    'thứ sáu': 5, 'thứ 6': 5, 't6': 5,
    'thứ bảy': 6, 'thứ 7': 6, 't7': 6,
  };
  const daysEn: { [key: string]: number } = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  };

  for (const [name, targetDayOfWeek] of Object.entries({ ...daysVi, ...daysEn })) {
    const reg = new RegExp(`\\b${name}\\b`, 'i');
    if (reg.test(cleanText)) {
      const currentDay = ref.getDay();
      let diff = targetDayOfWeek - currentDay;
      if (diff <= 0) diff += 7;
      targetDate.setDate(ref.getDate() + diff);
      cleanText = cleanText.replace(reg, '').trim();
      break;
    }
  }

  // Check Vietnamese hour patterns: "10h", "10h30", "14:00", "8 giờ tối", "9h sáng"
  const viTimeMatch = cleanText.match(/(\d{1,2})(?:h|:)(\d{2})?\s*(sáng|trưa|chiều|tối)?/i);
  if (viTimeMatch) {
    let h = parseInt(viTimeMatch[1], 10);
    const m = viTimeMatch[2] ? parseInt(viTimeMatch[2], 10) : 0;
    const period = viTimeMatch[3]?.toLowerCase();

    if ((period === 'chiều' || period === 'tối') && h < 12) {
      h += 12;
    } else if (period === 'trưa' && h < 11) {
      h += 12;
    }
    startHour = h % 24;
    startMinute = m;
    hasExplicitTime = true;
    cleanText = cleanText.replace(viTimeMatch[0], '').trim();
  } else {
    // English hour patterns: "at 3pm", "10:30am", "5 pm"
    const enTimeMatch = cleanText.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (enTimeMatch) {
      let h = parseInt(enTimeMatch[1], 10);
      const m = enTimeMatch[2] ? parseInt(enTimeMatch[2], 10) : 0;
      const ampm = enTimeMatch[3]?.toLowerCase();
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      startHour = h % 24;
      startMinute = m;
      hasExplicitTime = true;
      cleanText = cleanText.replace(enTimeMatch[0], '').trim();
    }
  }

  // If no explicit time was entered, default to next nearest upcoming full hour
  if (!hasExplicitTime) {
    startHour = (ref.getHours() + 1) % 24;
    startMinute = 0;
  }

  const endHour = (startHour + 1) % 24;
  const startTime = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;
  const endTime = `${String(endHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;

  const title = cleanText.replace(/^(vào lúc|lúc|at|on)\s+/i, '').trim() || 'Sự kiện mới';

  return {
    title,
    date: formatDateString(targetDate),
    startTime,
    endTime,
  };
}

/**
 * Export events to RFC 5545 iCalendar (.ics) format
 */
export function exportToIcs(events: CalendarEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Google Calendar Clone//AI Studio//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}@calendar.google.local`);
    lines.push(`SUMMARY:${event.title.replace(/\n/g, ' ')}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${event.location}`);
    }

    // Format start/end date-times: YYYYMMDDTHHmm00
    const startStr = event.startDate.replace(/-/g, '');
    const endStr = event.endDate.replace(/-/g, '');

    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${startStr}`);
      // In iCalendar all-day ends next day
      const nextDay = parseDateString(event.endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      lines.push(`DTEND;VALUE=DATE:${formatDateString(nextDay).replace(/-/g, '')}`);
    } else {
      const sTime = (event.startTime || '09:00').replace(':', '') + '00';
      const eTime = (event.endTime || '10:00').replace(':', '') + '00';
      lines.push(`DTSTART:${startStr}T${sTime}`);
      lines.push(`DTEND:${endStr}T${eTime}`);
    }

    if (event.recurrence && event.recurrence !== 'none') {
      const rruleMap: Record<string, string> = {
        daily: 'FREQ=DAILY',
        weekly: 'FREQ=WEEKLY',
        monthly: 'FREQ=MONTHLY',
        yearly: 'FREQ=YEARLY',
      };
      if (rruleMap[event.recurrence]) {
        lines.push(`RRULE:${rruleMap[event.recurrence]}`);
      }
    }

    if (event.meetUrl) {
      lines.push(`URL:${event.meetUrl}`);
    }

    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Parse standard .ics text into CalendarEvent array
 */
export function parseIcsContent(icsContent: string): Partial<CalendarEvent>[] {
  const events: Partial<CalendarEvent>[] = [];
  const lines = icsContent.split(/\r?\n/);
  let currentEvent: Partial<CalendarEvent> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {
        id: 'imported-' + Math.random().toString(36).substring(2, 9),
        allDay: false,
        calendarId: 'personal',
        color: '#039BE5',
        type: 'event',
        createdAt: Date.now(),
      };
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.title && currentEvent.startDate) {
        if (!currentEvent.endDate) currentEvent.endDate = currentEvent.startDate;
        if (!currentEvent.startTime) currentEvent.startTime = '09:00';
        if (!currentEvent.endTime) currentEvent.endTime = '10:00';
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.title = line.substring(8);
      } else if (line.startsWith('DESCRIPTION:')) {
        currentEvent.description = line.substring(12).replace(/\\n/g, '\n');
      } else if (line.startsWith('LOCATION:')) {
        currentEvent.location = line.substring(9);
      } else if (line.startsWith('URL:')) {
        currentEvent.meetUrl = line.substring(4);
      } else if (line.startsWith('DTSTART')) {
        const value = line.split(':')[1];
        if (value && value.length >= 8) {
          const y = value.substring(0, 4);
          const m = value.substring(4, 6);
          const d = value.substring(6, 8);
          currentEvent.startDate = `${y}-${m}-${d}`;
          if (value.includes('T')) {
            const timePart = value.split('T')[1];
            currentEvent.startTime = `${timePart.substring(0, 2)}:${timePart.substring(2, 4)}`;
          } else {
            currentEvent.allDay = true;
          }
        }
      } else if (line.startsWith('DTEND')) {
        const value = line.split(':')[1];
        if (value && value.length >= 8) {
          const y = value.substring(0, 4);
          const m = value.substring(4, 6);
          const d = value.substring(6, 8);
          currentEvent.endDate = `${y}-${m}-${d}`;
          if (value.includes('T')) {
            const timePart = value.split('T')[1];
            currentEvent.endTime = `${timePart.substring(0, 2)}:${timePart.substring(2, 4)}`;
          }
        }
      }
    }
  }

  return events;
}

export interface AvailableTimeSlot {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  period: 'morning' | 'afternoon' | 'evening';
}

export function minutesToHHmm(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Finds timed events on `candidate.startDate` that overlap with `[startTime, endTime)`.
 */
export function findConflictingEvents(
  candidate: { id?: string; startDate: string; startTime: string; endTime: string; allDay?: boolean },
  events: CalendarEvent[]
): CalendarEvent[] {
  if (candidate.allDay || !candidate.startDate || !candidate.startTime || !candidate.endTime) {
    return [];
  }
  const candStart = timeToMinutes(candidate.startTime);
  const candEnd = timeToMinutes(candidate.endTime);
  if (candEnd <= candStart) return [];

  return events.filter((ev) => {
    if (candidate.id && ev.id === candidate.id) return false;
    if (ev.allDay || !ev.startTime || !ev.endTime) return false;
    if (!doesEventOccurOnDate(ev, candidate.startDate)) return false;
    const evStart = timeToMinutes(ev.startTime);
    const evEnd = timeToMinutes(ev.endTime);
    return evStart < candEnd && candStart < evEnd;
  });
}

/**
 * Suggests open time slots on `dateStr` of at least `durationMinutes` between `startHour` and `endHour`.
 */
export function suggestAvailableSlots(
  dateStr: string,
  durationMinutes: number,
  events: CalendarEvent[],
  ignoreEventId?: string,
  startHour: number = 6,
  endHour: number = 22
): AvailableTimeSlot[] {
  const safeDuration = Math.max(15, durationMinutes || 60);
  const dayStart = startHour * 60;
  const dayEnd = endHour * 60;

  const busy = events
    .filter((ev) => {
      if (ignoreEventId && ev.id === ignoreEventId) return false;
      if (ev.allDay || !ev.startTime || !ev.endTime) return false;
      return doesEventOccurOnDate(ev, dateStr);
    })
    .map((ev) => ({
      start: Math.max(dayStart, timeToMinutes(ev.startTime!)),
      end: Math.min(dayEnd, timeToMinutes(ev.endTime!)),
    }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const b of busy) {
    if (merged.length === 0 || b.start > merged[merged.length - 1].end) {
      merged.push({ ...b });
    } else {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, b.end);
    }
  }

  const slots: AvailableTimeSlot[] = [];
  let cursor = dayStart;

  const pushGap = (gapStart: number, gapEnd: number) => {
    if (gapEnd - gapStart < safeDuration) return;
    const roundedStart = Math.ceil(gapStart / 15) * 15;
    if (gapEnd - roundedStart >= safeDuration) {
      const slotEnd = roundedStart + safeDuration;
      const startHourVal = Math.floor(roundedStart / 60);
      const period: AvailableTimeSlot['period'] =
        startHourVal < 12 ? 'morning' : startHourVal < 18 ? 'afternoon' : 'evening';
      slots.push({
        startTime: minutesToHHmm(roundedStart),
        endTime: minutesToHHmm(slotEnd),
        durationMinutes: gapEnd - roundedStart,
        period,
      });
    }
  };

  for (const b of merged) {
    pushGap(cursor, b.start);
    cursor = Math.max(cursor, b.end);
  }
  pushGap(cursor, dayEnd);

  return slots;
}

export interface SlotResolution {
  startTime: string;
  endTime: string;
  status: 'preferred' | 'shifted' | 'conflict';
  preferredStartTime: string;
  preferredEndTime: string;
  /** Events on that day colliding with the preferred time window (or remaining conflicts when status === 'conflict') */
  conflictingEvents: CalendarEvent[];
  /** Events still colliding with the chosen startTime..endTime (non-empty only when status === 'conflict') */
  remainingConflicts: CalendarEvent[];
  /** Alternative open slots sorted by closeness to preferredStartTime */
  alternativeSlots: AvailableTimeSlot[];
}

export interface ResolveSlotOptions {
  ignoreEventIds?: string[];
  ignoreWorkoutEvents?: boolean;
  minHour?: number;
  maxHour?: number;
  bufferMinutes?: number;
}

export function isWorkoutCalendarEvent(ev: CalendarEvent): boolean {
  return (
    ev.id.startsWith('scheduled-wo-') ||
    ev.id.startsWith('ctg-workout-') ||
    (ev.calendarId === 'health' && (ev.title.includes('💪') || ev.title.includes('[ZENOX]')))
  );
}

/**
 * Resolves a preferred time slot on `dateStr` against existing events (including recurring events).
 * - If the preferred window is free, returns `status: 'preferred'`.
 * - If it collides, searches all open gaps between `minHour` and `maxHour` for the nearest
 *   non-conflicting slot (preferring `bufferMinutes` clearance around adjacent events) and verifies
 *   zero overlap via `findConflictingEvents`.
 * - If the whole day is booked with no gap large enough, returns `status: 'conflict'` with the
 *   colliding events preserved instead of silently claiming conflicts were avoided.
 */
export function resolveNonConflictingSlot(
  dateStr: string,
  preferredStartTime: string,
  durationMinutes: number,
  events: CalendarEvent[],
  options: ResolveSlotOptions = {}
): SlotResolution {
  const {
    ignoreEventIds = [],
    ignoreWorkoutEvents = false,
    minHour = 6,
    maxHour = 23,
    bufferMinutes = 15,
  } = options;

  const safeDuration = Math.max(15, Math.round(durationMinutes || 60));
  const preferredStartMins = timeToMinutes(preferredStartTime);
  const preferredEndMins = Math.min(24 * 60 - 1, preferredStartMins + safeDuration);
  const preferredEndTime = minutesToHHmm(preferredEndMins);

  const ignoreSet = new Set(ignoreEventIds);
  const relevantEvents = events.filter((ev) => {
    if (ignoreSet.has(ev.id)) return false;
    if (ignoreWorkoutEvents && isWorkoutCalendarEvent(ev)) return false;
    return true;
  });

  const dayStart = Math.max(0, Math.round(minHour * 60));
  const dayEnd = Math.min(24 * 60 - 1, Math.round(maxHour * 60));

  // Build free gaps on dateStr from merged busy intervals
  const busy = relevantEvents
    .filter((ev) => !ev.allDay && ev.startTime && ev.endTime && doesEventOccurOnDate(ev, dateStr))
    .map((ev) => ({
      start: Math.max(dayStart, timeToMinutes(ev.startTime!)),
      end: Math.min(dayEnd, timeToMinutes(ev.endTime!)),
    }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const b of busy) {
    if (merged.length === 0 || b.start > merged[merged.length - 1].end) {
      merged.push({ ...b });
    } else {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, b.end);
    }
  }

  const gaps: { start: number; end: number }[] = [];
  let cursor = dayStart;
  for (const b of merged) {
    if (b.start - cursor >= safeDuration) {
      gaps.push({ start: cursor, end: b.start });
    }
    cursor = Math.max(cursor, b.end);
  }
  if (dayEnd - cursor >= safeDuration) {
    gaps.push({ start: cursor, end: dayEnd });
  }

  interface ScoredCandidate {
    startMins: number;
    endMins: number;
    score: number;
    slot: AvailableTimeSlot;
  }

  const candidateMap = new Map<number, ScoredCandidate>();
  const addCandidate = (rawStart: number, gap: { start: number; end: number }) => {
    const startMins = Math.round(rawStart / 15) * 15;
    const endMins = startMins + safeDuration;
    if (startMins < gap.start || endMins > gap.end || startMins < dayStart || endMins > dayEnd) {
      return;
    }
    const startTime = minutesToHHmm(startMins);
    const endTime = minutesToHHmm(endMins);
    if (findConflictingEvents({ startDate: dateStr, startTime, endTime }, relevantEvents).length > 0) {
      return;
    }
    const touchesStart = bufferMinutes > 0 && gap.start > dayStart && startMins - gap.start < bufferMinutes;
    const touchesEnd = bufferMinutes > 0 && gap.end < dayEnd && gap.end - endMins < bufferMinutes;
    const bufferPenalty = (touchesStart ? bufferMinutes + 5 : 0) + (touchesEnd ? bufferMinutes + 5 : 0);
    const score = Math.abs(startMins - preferredStartMins) + bufferPenalty;
    const hourVal = Math.floor(startMins / 60);
    const period: AvailableTimeSlot['period'] =
      hourVal < 12 ? 'morning' : hourVal < 18 ? 'afternoon' : 'evening';

    const existing = candidateMap.get(startMins);
    if (!existing || score < existing.score) {
      candidateMap.set(startMins, {
        startMins,
        endMins,
        score,
        slot: {
          startTime,
          endTime,
          durationMinutes: safeDuration,
          period,
        },
      });
    }
  };

  for (const gap of gaps) {
    // 1. Clamped as close as possible to preferredStartMins inside this gap
    const clamped = Math.min(Math.max(preferredStartMins, gap.start), gap.end - safeDuration);
    addCandidate(clamped, gap);
    // 2. Buffered slots right after previous event & right before next event
    addCandidate(Math.ceil((gap.start + (gap.start > dayStart ? bufferMinutes : 0)) / 15) * 15, gap);
    addCandidate(Math.floor((gap.end - (gap.end < dayEnd ? bufferMinutes : 0) - safeDuration) / 15) * 15, gap);
    // 3. Exact edge slots (no buffer fallback)
    addCandidate(Math.ceil(gap.start / 15) * 15, gap);
    addCandidate(Math.floor((gap.end - safeDuration) / 15) * 15, gap);
  }

  const sortedCandidates = Array.from(candidateMap.values()).sort((a, b) => a.score - b.score);
  const alternativeSlots = sortedCandidates.slice(0, 8).map((c) => c.slot);

  const preferredConflicts = findConflictingEvents(
    { startDate: dateStr, startTime: preferredStartTime, endTime: preferredEndTime },
    relevantEvents
  );

  if (preferredConflicts.length === 0) {
    return {
      startTime: preferredStartTime,
      endTime: preferredEndTime,
      status: 'preferred',
      preferredStartTime,
      preferredEndTime,
      conflictingEvents: [],
      remainingConflicts: [],
      alternativeSlots,
    };
  }

  if (sortedCandidates.length > 0) {
    const best = sortedCandidates[0];
    return {
      startTime: best.slot.startTime,
      endTime: best.slot.endTime,
      status: 'shifted',
      preferredStartTime,
      preferredEndTime,
      conflictingEvents: preferredConflicts,
      remainingConflicts: [],
      alternativeSlots,
    };
  }

  return {
    startTime: preferredStartTime,
    endTime: preferredEndTime,
    status: 'conflict',
    preferredStartTime,
    preferredEndTime,
    conflictingEvents: preferredConflicts,
    remainingConflicts: preferredConflicts,
    alternativeSlots: [],
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateString,
  parseDateString,
  getMonthDays,
  getWeekDates,
  getFourDayDates,
  doesEventOccurOnDate,
  computeEventLayout,
  deduplicateEvents,
  isDemoEventId,
  findConflictingEvents,
  suggestAvailableSlots,
  resolveNonConflictingSlot,
  isWorkoutCalendarEvent,
  parseNaturalLanguageInput,
  exportToIcs,
  parseIcsContent,
} from './calendarUtils';
import { CalendarEvent } from '../types/calendar';

test('formatDateString and parseDateString work round-trip', () => {
  const d = new Date(2026, 9, 29); // October 29, 2026
  const str = formatDateString(d);
  assert.equal(str, '2026-10-29');

  const parsed = parseDateString('2026-10-29');
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 9);
  assert.equal(parsed.getDate(), 29);
});

test('getMonthDays returns 35 or 42 grid cells and flags today and month boundaries', () => {
  const days = getMonthDays(2026, 9, false); // October 2026
  assert.ok(days.length === 35 || days.length === 42);
  const currentMonthDays = days.filter((d) => d.isCurrentMonth);
  assert.equal(currentMonthDays.length, 31); // October has 31 days
});

test('getWeekDates returns 7 consecutive dates', () => {
  const ref = new Date(2026, 9, 29);
  const week = getWeekDates(ref, false);
  assert.equal(week.length, 7);
  // Sunday to Saturday consecutive
  for (let i = 0; i < 6; i++) {
    const diff = week[i + 1].getTime() - week[i].getTime();
    assert.equal(diff, 24 * 60 * 60 * 1000);
  }
});

test('getFourDayDates returns 4 dates starting from target', () => {
  const ref = new Date(2026, 9, 29);
  const fourDays = getFourDayDates(ref);
  assert.equal(fourDays.length, 4);
  assert.equal(formatDateString(fourDays[0]), '2026-10-29');
  assert.equal(formatDateString(fourDays[3]), '2026-11-01');
});

test('doesEventOccurOnDate correctly evaluates non-recurring and recurring events', () => {
  const singleEvent: CalendarEvent = {
    id: 'ev1',
    title: 'Review',
    startDate: '2026-10-29',
    startTime: '10:00',
    endDate: '2026-10-29',
    endTime: '11:00',
    allDay: false,
    calendarId: 'work',
    color: '#039BE5',
    type: 'event',
    createdAt: Date.now(),
  };

  assert.equal(doesEventOccurOnDate(singleEvent, '2026-10-29'), true);
  assert.equal(doesEventOccurOnDate(singleEvent, '2026-10-30'), false);

  const weeklyEvent: CalendarEvent = {
    ...singleEvent,
    id: 'ev2',
    recurrence: 'weekly',
  };

  // 2026-10-29 is Thursday. 2026-11-05 is also Thursday.
  assert.equal(doesEventOccurOnDate(weeklyEvent, '2026-11-05'), true);
  // 2026-11-06 is Friday -> false
  assert.equal(doesEventOccurOnDate(weeklyEvent, '2026-11-06'), false);
  // Date before recurrence started -> false
  assert.equal(doesEventOccurOnDate(weeklyEvent, '2026-10-22'), false);
});

test('computeEventLayout correctly splits overlapping simultaneous events into columns', () => {
  const ev1: CalendarEvent = {
    id: 'ev1',
    title: 'Meeting 1',
    startDate: '2026-10-29',
    startTime: '10:00',
    endDate: '2026-10-29',
    endTime: '11:00',
    allDay: false,
    calendarId: 'work',
    color: '#039BE5',
    type: 'event',
    createdAt: Date.now(),
  };

  const ev2: CalendarEvent = {
    id: 'ev2',
    title: 'Meeting 2',
    startDate: '2026-10-29',
    startTime: '10:30',
    endDate: '2026-10-29',
    endTime: '11:30',
    allDay: false,
    calendarId: 'work',
    color: '#E67C73',
    type: 'event',
    createdAt: Date.now(),
  };

  const layout = computeEventLayout([ev1, ev2], '2026-10-29');
  assert.equal(layout.size, 2);

  const pos1 = layout.get('ev1')!;
  const pos2 = layout.get('ev2')!;
  // Side-by-side partitioning guarantees cards never cover each other
  assert.equal(pos1.leftPercent, 0);
  assert.ok(pos2.leftPercent >= 45, 'Card 2 should be in second column');
  assert.ok(pos1.widthPercent <= 50, 'Card 1 should take its column width');
  assert.ok(pos2.widthPercent <= 50, 'Card 2 should take its column width');
});

test('parseNaturalLanguageInput parses Vietnamese and English quick add text', () => {
  const refDate = new Date(2026, 9, 29, 8, 0); // Oct 29, 2026 8:00 AM

  const resVi = parseNaturalLanguageInput('Họp báo cáo 14h ngày mai', refDate);
  assert.equal(resVi.title, 'Họp báo cáo');
  assert.equal(resVi.date, '2026-10-30');
  assert.equal(resVi.startTime, '14:00');

  const resEn = parseNaturalLanguageInput('Team lunch at 12pm tomorrow', refDate);
  assert.equal(resEn.title, 'Team lunch');
  assert.equal(resEn.date, '2026-10-30');
  assert.equal(resEn.startTime, '12:00');
});

test('exportToIcs and parseIcsContent roundtrip basic event data', () => {
  const ev: CalendarEvent = {
    id: 'test-event-1',
    title: 'Tech Conference 2026',
    description: 'Annual engineering sync',
    location: 'Hanoi Convention Center',
    startDate: '2026-11-10',
    startTime: '09:00',
    endDate: '2026-11-10',
    endTime: '17:00',
    allDay: false,
    calendarId: 'work',
    color: '#039BE5',
    type: 'event',
    createdAt: Date.now(),
  };

  const ics = exportToIcs([ev]);
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('SUMMARY:Tech Conference 2026'));
  assert.ok(ics.includes('LOCATION:Hanoi Convention Center'));

  const parsed = parseIcsContent(ics);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, 'Tech Conference 2026');
  assert.equal(parsed[0].startDate, '2026-11-10');
  assert.equal(parsed[0].startTime, '09:00');
});

test('deduplicateEvents correctly merges identical duplicates and duplicate all-day placeholders', () => {
  const events: CalendarEvent[] = [
    {
      id: 'd1',
      title: 'Học chính khóa',
      startDate: '2026-10-29',
      startTime: '00:00',
      endDate: '2026-10-29',
      endTime: '23:59',
      allDay: true,
      calendarId: 'study',
      color: '#039BE5',
      type: 'event',
      createdAt: 1,
    },
    {
      id: 'd2',
      title: 'Học chính khóa',
      startDate: '2026-10-29',
      startTime: '06:55',
      endDate: '2026-10-29',
      endTime: '11:15',
      allDay: false,
      calendarId: 'study',
      color: '#039BE5',
      type: 'event',
      createdAt: 2,
    },
    {
      id: 'd3',
      title: 'Học chính khóa',
      startDate: '2026-10-29',
      startTime: '06:55',
      endDate: '2026-10-29',
      endTime: '11:15',
      allDay: false,
      calendarId: 'study',
      color: '#039BE5',
      type: 'event',
      createdAt: 3,
    },
    {
      id: 'g1',
      title: 'Gym',
      startDate: '2026-10-29',
      startTime: '16:00',
      endDate: '2026-10-29',
      endTime: '17:45',
      allDay: false,
      calendarId: 'health',
      color: '#039BE5',
      type: 'event',
      createdAt: 4,
    },
    {
      id: 'g2',
      title: 'Gym',
      startDate: '2026-10-29',
      startTime: '16:00',
      endDate: '2026-10-29',
      endTime: '17:45',
      allDay: false,
      calendarId: 'health',
      color: '#E67C73',
      type: 'event',
      createdAt: 5,
    },
  ];

  const deduped = deduplicateEvents(events);
  // All-day "Học chính khóa" should be dropped because timed "Học chính khóa" exists on that day
  // Duplicate timed "Học chính khóa" should be merged into 1
  // Duplicate "Gym" at 16:00-17:45 should be merged into 1
  assert.equal(deduped.length, 2);
  const titles = deduped.map((e) => e.title);
  assert.ok(titles.includes('Học chính khóa'));
  assert.ok(titles.includes('Gym'));
});

test('isDemoEventId & deduplicateEvents preserve user-created events alongside Google Calendar events', () => {
  assert.equal(isDemoEventId('ev-1'), true);
  assert.equal(isDemoEventId('ev-welcome-usr1'), true);
  assert.equal(isDemoEventId('ev-1730000000000-abc'), false);
  assert.equal(isDemoEventId('usr-1730000000000-abc'), false);

  const mixed: CalendarEvent[] = [
    {
      id: 'ev-1',
      title: 'Demo event',
      startDate: '2026-10-29',
      startTime: '09:00',
      endDate: '2026-10-29',
      endTime: '10:00',
      allDay: false,
      calendarId: 'personal',
      color: '#039BE5',
      type: 'event',
      createdAt: 1,
    },
    {
      id: 'gcal-real-1',
      title: 'Synced Google Meeting',
      startDate: '2026-10-29',
      startTime: '10:00',
      endDate: '2026-10-29',
      endTime: '11:00',
      allDay: false,
      calendarId: 'work',
      color: '#039BE5',
      type: 'event',
      createdAt: 2,
    },
    {
      id: 'ev-1730000000000-abc',
      title: 'User Event Created Earlier',
      startDate: '2026-10-29',
      startTime: '14:00',
      endDate: '2026-10-29',
      endTime: '15:00',
      allDay: false,
      calendarId: 'personal',
      color: '#039BE5',
      type: 'event',
      createdAt: 3,
    },
  ];

  const deduped = deduplicateEvents(mixed);
  assert.equal(deduped.length, 2);
  assert.ok(deduped.some((e) => e.id === 'gcal-real-1'));
  assert.ok(deduped.some((e) => e.id === 'ev-1730000000000-abc'));
});

test('findConflictingEvents and suggestAvailableSlots detect overlaps and open gaps', () => {
  const events: CalendarEvent[] = [
    {
      id: 'usr-1',
      title: 'Morning Standup',
      startDate: '2026-11-27',
      startTime: '09:00',
      endDate: '2026-11-27',
      endTime: '10:30',
      allDay: false,
      calendarId: 'work',
      color: '#039BE5',
      type: 'event',
      createdAt: 1,
    },
    {
      id: 'usr-2',
      title: 'Lunch Sync',
      startDate: '2026-11-27',
      startTime: '12:00',
      endDate: '2026-11-27',
      endTime: '13:30',
      allDay: false,
      calendarId: 'work',
      color: '#039BE5',
      type: 'event',
      createdAt: 2,
    },
  ];

  const conflicts = findConflictingEvents(
    { startDate: '2026-11-27', startTime: '10:00', endTime: '11:00' },
    events
  );
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].id, 'usr-1');

  // Ignoring the same event ID produces zero conflicts
  const selfCheck = findConflictingEvents(
    { id: 'usr-1', startDate: '2026-11-27', startTime: '09:00', endTime: '10:30' },
    events
  );
  assert.equal(selfCheck.length, 0);

  const slots = suggestAvailableSlots('2026-11-27', 60, events, undefined, 8, 16);
  assert.equal(slots.length, 3);
  assert.equal(slots[0].startTime, '08:00');
  assert.equal(slots[1].startTime, '10:30');
  assert.equal(slots[2].startTime, '13:30');
});

test('weekStartsOnMonday shifts MonthView and WeekDates start to Monday', () => {
  const monWeek = getWeekDates(new Date(2026, 10, 27), true); // Fri Nov 27, 2026
  assert.equal(monWeek[0].getDay(), 1); // Monday
  assert.equal(monWeek[6].getDay(), 0); // Sunday

  const monthGrid = getMonthDays(2026, 10, true);
  assert.equal(monthGrid[0].date.getDay(), 1); // First column is Monday
});

test('resolveNonConflictingSlot handles packed evenings, recurring events, and unresolvable days accurately', () => {
  // Reproduces the exact stacked evening scenario: afternoon until 17:15, Văn 18:00-19:00, Anh 19:00-20:30
  const events: CalendarEvent[] = [
    {
      id: 'cls-pm',
      title: 'Chiều',
      startDate: '2026-11-26',
      startTime: '14:00',
      endDate: '2026-11-26',
      endTime: '17:15',
      allDay: false,
      calendarId: 'work',
      color: '#2563EB',
      type: 'event',
      createdAt: 1,
    },
    {
      id: 'cls-van',
      title: 'Văn',
      startDate: '2026-11-26',
      startTime: '18:00',
      endDate: '2026-11-26',
      endTime: '19:00',
      allDay: false,
      calendarId: 'work',
      color: '#2563EB',
      type: 'event',
      createdAt: 2,
    },
    {
      id: 'cls-anh',
      title: 'Anh',
      startDate: '2026-11-26',
      startTime: '19:00',
      endDate: '2026-11-26',
      endTime: '20:30',
      allDay: false,
      calendarId: 'work',
      color: '#2563EB',
      type: 'event',
      createdAt: 3,
    },
    {
      id: 'cls-rec',
      title: 'Hóa (hàng tuần)',
      startDate: '2026-11-23', // Monday
      startTime: '17:30',
      endDate: '2026-11-23',
      endTime: '19:00',
      allDay: false,
      recurrence: 'weekly',
      calendarId: 'work',
      color: '#2563EB',
      type: 'event',
      createdAt: 4,
    },
    {
      id: 'ctg-workout-old',
      title: '[ZENOX] Push Day',
      startDate: '2026-11-30',
      startTime: '17:30',
      endDate: '2026-11-30',
      endTime: '18:45',
      allDay: false,
      calendarId: 'health',
      color: '#E11D48',
      type: 'event',
      createdAt: 5,
    },
  ];

  // Must NOT silently keep 17:30 when +/-15m around Văn fails; finds 20:45-22:00 cleanly
  const packedRes = resolveNonConflictingSlot('2026-11-26', '17:30', 75, events, {
    minHour: 6,
    maxHour: 23,
    bufferMinutes: 15,
  });
  assert.equal(packedRes.status, 'shifted');
  assert.equal(packedRes.remainingConflicts.length, 0);
  assert.equal(packedRes.startTime, '20:45');
  assert.equal(packedRes.endTime, '22:00');
  assert.ok(packedRes.conflictingEvents.some((e) => e.id === 'cls-van'));

  // Next Monday (2026-11-30): recurring Hóa + old workout exist.
  // When ignoreWorkoutEvents=true (replacing old workouts), still avoids weekly Hóa!
  const recRes = resolveNonConflictingSlot('2026-11-30', '17:30', 75, events, {
    ignoreWorkoutEvents: true,
    minHour: 6,
    maxHour: 23,
    bufferMinutes: 15,
  });
  assert.equal(recRes.status, 'shifted');
  assert.equal(recRes.remainingConflicts.length, 0);
  assert.ok(recRes.conflictingEvents.some((e) => e.id === 'cls-rec'));
  assert.ok(isWorkoutCalendarEvent(events[4]));

  // When a day is completely booked 06:00-23:00, must report 'conflict' explicitly instead of faking avoidance
  const fullDay: CalendarEvent[] = [
    {
      id: 'full-1',
      title: 'Học cả ngày',
      startDate: '2026-12-01',
      startTime: '06:00',
      endDate: '2026-12-01',
      endTime: '22:30',
      allDay: false,
      calendarId: 'work',
      color: '#2563EB',
      type: 'event',
      createdAt: 6,
    },
  ];
  const failRes = resolveNonConflictingSlot('2026-12-01', '17:30', 75, fullDay, {
    minHour: 6,
    maxHour: 23,
    bufferMinutes: 15,
  });
  assert.equal(failRes.status, 'conflict');
  assert.equal(failRes.remainingConflicts.length, 1);
  assert.equal(failRes.remainingConflicts[0].id, 'full-1');
});

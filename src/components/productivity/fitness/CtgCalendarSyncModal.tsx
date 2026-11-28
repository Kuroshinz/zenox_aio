import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Dumbbell,
  RefreshCw,
  Check,
  Zap,
  Trash2,
  ExternalLink,
  ShieldCheck,
  LogIn,
} from 'lucide-react';
import { CalendarEvent } from '../../../types/calendar';
import { AwayBreakPeriod, CtgRoadmapPhase, PlannedSession, RoutineSplitTemplate } from '../../../types/productivity';
import { generateSplitSessions, isDateInAwayPeriod } from '../../../utils/fitnessMetrics';
import {
  formatDateString,
  timeToMinutes,
  minutesToHHmm,
  findConflictingEvents,
  resolveNonConflictingSlot,
  isWorkoutCalendarEvent,
  AvailableTimeSlot,
} from '../../../utils/calendarUtils';
import { getAccessToken, googleSignIn, AppUser } from '../../../services/auth';
import { createGoogleCalendarEvent } from '../../../services/googleCalendarSync';
import { notifySuccess, notifyWarning, notifyError } from '../../../utils/notify';

export interface CtgCalendarSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePhase?: CtgRoadmapPhase | null;
  existingEvents?: CalendarEvent[];
  plannedSessions?: PlannedSession[];
  onBatchSchedule?: (events: CalendarEvent[]) => Promise<void> | void;
  onClearWorkoutEvents?: () => Promise<number> | number | void;
  awayMode?: AwayBreakPeriod;
  lang?: 'vi' | 'en';
}

interface ProposedSlot {
  date: string; // YYYY-MM-DD
  dayLabel: string; // 'Thứ 2', 'Thứ 3'...
  sessionTitle: string;
  prescriptionsSummary: string;
  preferredStartTime: string;
  preferredEndTime: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: 'preferred' | 'shifted' | 'conflict';
  conflictingTitles: string[];
  alternativeSlots: AvailableTimeSlot[];
  selected: boolean;
}

const SPLIT_OPTIONS: { id: RoutineSplitTemplate; nameVi: string; descVi: string; daysPerWeek: number }[] = [
  {
    id: 'ppl',
    nameVi: 'Push / Pull / Legs (PPL)',
    descVi: 'Phổ biến nhất · 5 buổi/tuần · Tối ưu phì đại cơ bắp và phục hồi khớp',
    daysPerWeek: 5,
  },
  {
    id: 'upper_lower',
    nameVi: 'Upper / Lower (Thân Trên / Thân Dưới)',
    descVi: '4 buổi/tuần · Cân bằng hoàn hảo giữa sức mạnh và thời gian bận rộn',
    daysPerWeek: 4,
  },
  {
    id: 'bro_split',
    nameVi: 'Bro Split Kinh Điển (Từng Nhóm Cơ / Ngày)',
    descVi: '5 buổi/tuần · Ngực, Lưng, Vai, Chân, Tay & Bụng siêu pump',
    daysPerWeek: 5,
  },
  {
    id: 'ppl_arnold',
    nameVi: 'PPL x Arnold Hybrid',
    descVi: '6 buổi/tuần · Đỉnh cao thể hình Hypertrophy và tần suất kích thích cao',
    daysPerWeek: 6,
  },
  {
    id: 'arnold',
    nameVi: 'Arnold Split (Ngực-Lưng / Vai-Tay / Chân)',
    descVi: '6 buổi/tuần · Pump cơ cực đại, tập trung thân trên và cánh tay',
    daysPerWeek: 6,
  },
  {
    id: 'calisthenics',
    nameVi: 'Calisthenics & Street Workout',
    descVi: '4 buổi/tuần · Làm chủ trọng lượng cơ thể, sức mạnh xà đơn xà kép',
    daysPerWeek: 4,
  },
  {
    id: 'glute_lower',
    nameVi: 'Glute & Lower Focus',
    descVi: '4 buổi/tuần · Chuyên sâu săn chắc mông, đùi thon gọn và vòng eo',
    daysPerWeek: 4,
  },
  {
    id: 'fullbody',
    nameVi: 'Full Body 3x (Toàn Thân)',
    descVi: '3 buổi/tuần · Thích hợp người ít thời gian, kích thích tần suất cao',
    daysPerWeek: 3,
  },
];

const TIME_WINDOWS = [
  { id: 'evening', label: 'Chiều tối (17:30 - 18:45)', start: '17:30', end: '18:45' },
  { id: 'morning', label: 'Sáng sớm (06:00 - 07:15)', start: '06:00', end: '07:15' },
  { id: 'noon', label: 'Buổi trưa (11:45 - 13:00)', start: '11:45', end: '13:00' },
  { id: 'night', label: 'Tối muộn (19:45 - 21:00)', start: '19:45', end: '21:00' },
];

export const CtgCalendarSyncModal: React.FC<CtgCalendarSyncModalProps> = ({
  isOpen,
  onClose,
  activePhase,
  existingEvents = [],
  plannedSessions = [],
  onBatchSchedule,
  onClearWorkoutEvents,
  awayMode,
  lang = 'vi',
}) => {
  // Safe phase fallback
  const resolvedPhase = activePhase || {
    name: 'Giáo án thể hình ZENOX Pro',
    phaseType: 'maintain' as const,
  };

  const defaultSplit: RoutineSplitTemplate = useMemo(() => {
    const nameLower = (resolvedPhase.name || '').toLowerCase();
    if (nameLower.includes('upper') || nameLower.includes('lower')) return 'upper_lower';
    if (nameLower.includes('full')) return 'fullbody';
    if (nameLower.includes('arnold')) return 'arnold';
    return 'ppl';
  }, [resolvedPhase]);

  const [selectedSplit, setSelectedSplit] = useState<RoutineSplitTemplate>(defaultSplit);
  const [useCurrentPlanned, setUseCurrentPlanned] = useState<boolean>(plannedSessions.length > 0);
  const [weeksCount, setWeeksCount] = useState<number>(2); // 1, 2, 4 weeks
  const [selectedWindowId, setSelectedWindowId] = useState<string>('evening');
  const [customStart, setCustomStart] = useState<string>('17:30');
  const [customDurationMins, setCustomDurationMins] = useState<number>(75);
  const [replaceExistingWorkouts, setReplaceExistingWorkouts] = useState<boolean>(true);
  const [respectAwayMode, setRespectAwayMode] = useState<boolean>(true);
  const [includePreWorkoutReminder, setIncludePreWorkoutReminder] = useState<boolean>(false);
  const [includeSundayCheckin, setIncludeSundayCheckin] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);

  // Google Calendar Connection state
  const [googleUser, setGoogleUser] = useState<AppUser | null>(null);
  const [hasGoogleToken, setHasGoogleToken] = useState<boolean>(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      getAccessToken()
        .then((t) => setHasGoogleToken(Boolean(t)))
        .catch(() => setHasGoogleToken(false));

      try {
        const raw = localStorage.getItem('gcal_active_user');
        if (raw) setGoogleUser(JSON.parse(raw));
      } catch {}
    }
  }, [isOpen]);

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      const { user, accessToken } = await googleSignIn();
      setGoogleUser(user);
      setHasGoogleToken(Boolean(accessToken));
      notifySuccess('Đã kết nối Google Calendar!', `Đã liên kết với tài khoản ${user.email}`);
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      notifyError('Lỗi kết nối Google', err?.message || 'Không thể đăng nhập tài khoản Google.');
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  // Count existing workout events in user's calendar
  const currentWorkoutEvents = useMemo(() => {
    return existingEvents.filter(isWorkoutCalendarEvent);
  }, [existingEvents]);

  // Preferred window
  const activeWindow = useMemo(() => {
    const found = TIME_WINDOWS.find((w) => w.id === selectedWindowId);
    if (found) {
      return {
        start: found.start,
        end: found.end,
        duration: timeToMinutes(found.end) - timeToMinutes(found.start),
      };
    }
    return {
      start: customStart,
      end: minutesToHHmm(timeToMinutes(customStart) + customDurationMins),
      duration: customDurationMins,
    };
  }, [selectedWindowId, customStart, customDurationMins]);

  const effectiveExistingEvents = useMemo(() => {
    return replaceExistingWorkouts
      ? existingEvents.filter((ev) => !isWorkoutCalendarEvent(ev))
      : existingEvents;
  }, [existingEvents, replaceExistingWorkouts]);

  // Generate proposed schedule with smart collision avoidance
  const [proposedSlots, setProposedSlots] = useState<ProposedSlot[]>([]);

  // Suggest best uniform daily slot across all target workout dates (zero conflicts on every day)
  const uniformTimeSuggestion = useMemo(() => {
    if (!isOpen) return null;
    const sessionsToSchedule: PlannedSession[] =
      useCurrentPlanned && plannedSessions.length > 0
        ? plannedSessions
        : generateSplitSessions(selectedSplit);
    if (sessionsToSchedule.length === 0) return null;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const targetDates: string[] = [];
    for (let w = 0; w < weeksCount; w++) {
      sessionsToSchedule.forEach((session, idx) => {
        const dayIdx = session.dayIndex !== undefined ? session.dayIndex : idx % 7;
        const targetDate = new Date(monday);
        targetDate.setDate(monday.getDate() + w * 7 + dayIdx);
        targetDates.push(formatDateString(targetDate));
      });
    }

    const dur = activeWindow.duration;
    const preferredMins = timeToMinutes(activeWindow.start);
    let bestStart: string | null = null;
    let bestDiff = Infinity;

    for (let startM = 6 * 60; startM + dur <= 22 * 60 + 30; startM += 30) {
      const st = minutesToHHmm(startM);
      const et = minutesToHHmm(startM + dur);
      const hasAnyConflict = targetDates.some(
        (d) =>
          findConflictingEvents({ startDate: d, startTime: st, endTime: et }, effectiveExistingEvents)
            .length > 0
      );
      if (!hasAnyConflict) {
        const diff = Math.abs(startM - preferredMins);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestStart = st;
        }
      }
    }

    if (!bestStart || bestStart === activeWindow.start) return null;
    return {
      start: bestStart,
      end: minutesToHHmm(timeToMinutes(bestStart) + dur),
    };
  }, [
    isOpen,
    selectedSplit,
    useCurrentPlanned,
    plannedSessions,
    weeksCount,
    activeWindow,
    effectiveExistingEvents,
  ]);

  // Compute proposed slots whenever parameters change
  useEffect(() => {
    if (!isOpen) return;

    // 1. Get base template sessions
    const sessionsToSchedule: PlannedSession[] =
      useCurrentPlanned && plannedSessions.length > 0
        ? plannedSessions
        : generateSplitSessions(selectedSplit);

    if (sessionsToSchedule.length === 0) {
      setProposedSlots([]);
      return;
    }

    // 2. Identify start of current week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const duration = activeWindow.duration;
    const slots: ProposedSlot[] = [];
    const scheduledSoFar: CalendarEvent[] = [];

    const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

    for (let w = 0; w < weeksCount; w++) {
      sessionsToSchedule.forEach((session, idx) => {
        const dayIdx = session.dayIndex !== undefined ? session.dayIndex : idx % 7;
        const targetDate = new Date(monday);
        targetDate.setDate(monday.getDate() + w * 7 + dayIdx);
        const dateStr = formatDateString(targetDate);
        if (respectAwayMode && isDateInAwayPeriod(dateStr, awayMode)) {
          return;
        }

        const resolution = resolveNonConflictingSlot(
          dateStr,
          activeWindow.start,
          duration,
          [...effectiveExistingEvents, ...scheduledSoFar],
          { minHour: 6, maxHour: 23, bufferMinutes: 15 }
        );

        const prescripSummary = session.prescriptions?.length
          ? session.prescriptions
              .slice(0, 3)
              .map((p) => p.exerciseId.replace(/-/g, ' '))
              .join(' · ') + (session.prescriptions.length > 3 ? '...' : '')
          : 'Bài tập cơ bản';

        const conflictingTitles =
          resolution.status === 'conflict'
            ? resolution.remainingConflicts.map((c) => `${c.title} (${c.startTime}–${c.endTime})`)
            : resolution.conflictingEvents.map((c) => `${c.title} (${c.startTime}–${c.endTime})`);

        slots.push({
          date: dateStr,
          dayLabel: `${DAY_LABELS[dayIdx]} (Tuần ${w + 1})`,
          sessionTitle: session.title,
          prescriptionsSummary: prescripSummary,
          preferredStartTime: resolution.preferredStartTime,
          preferredEndTime: resolution.preferredEndTime,
          startTime: resolution.startTime,
          endTime: resolution.endTime,
          status: resolution.status,
          conflictingTitles,
          alternativeSlots: resolution.alternativeSlots,
          selected: true,
        });

        scheduledSoFar.push({
          id: `pending-wo-${w}-${idx}`,
          title: `[ZENOX] ${session.title}`,
          startDate: dateStr,
          startTime: resolution.startTime,
          endDate: dateStr,
          endTime: resolution.endTime,
          allDay: false,
          calendarId: 'health',
          color: '#E11D48',
          type: 'event',
          createdAt: Date.now(),
        });
      });
    }

    setProposedSlots(slots);
  }, [isOpen, selectedSplit, useCurrentPlanned, plannedSessions, weeksCount, activeWindow, effectiveExistingEvents, respectAwayMode, awayMode]);

  if (!isOpen) return null;

  const toggleSlot = (index: number) => {
    setProposedSlots((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, selected: !s.selected } : s))
    );
  };

  const updateSlotStartTime = (index: number, newStart: string) => {
    if (!newStart) return;
    setProposedSlots((prev) => {
      const target = prev[index];
      if (!target) return prev;
      const newEnd = minutesToHHmm(timeToMinutes(newStart) + activeWindow.duration);
      const siblingEvents: CalendarEvent[] = prev
        .filter((s, idx) => idx !== index && s.selected)
        .map((s, idx) => ({
          id: `pending-edit-${idx}`,
          title: `[ZENOX] ${s.sessionTitle}`,
          startDate: s.date,
          startTime: s.startTime,
          endDate: s.date,
          endTime: s.endTime,
          allDay: false,
          calendarId: 'health',
          color: '#E11D48',
          type: 'event',
          createdAt: Date.now(),
        }));

      const conflictsNow = findConflictingEvents(
        { startDate: target.date, startTime: newStart, endTime: newEnd },
        [...effectiveExistingEvents, ...siblingEvents]
      );
      const preferredConflicts = findConflictingEvents(
        { startDate: target.date, startTime: target.preferredStartTime, endTime: target.preferredEndTime },
        [...effectiveExistingEvents, ...siblingEvents]
      );

      let nextStatus: ProposedSlot['status'] = 'preferred';
      let titles: string[] = [];
      if (conflictsNow.length > 0) {
        nextStatus = 'conflict';
        titles = conflictsNow.map((c) => `${c.title} (${c.startTime}–${c.endTime})`);
      } else if (newStart !== target.preferredStartTime) {
        nextStatus = 'shifted';
        titles = preferredConflicts.map((c) => `${c.title} (${c.startTime}–${c.endTime})`);
      }

      return prev.map((s, idx) =>
        idx === index
          ? {
              ...s,
              startTime: newStart,
              endTime: newEnd,
              status: nextStatus,
              conflictingTitles: titles,
            }
          : s
      );
    });
  };

  const handleClearWorkouts = async () => {
    if (currentWorkoutEvents.length === 0) return;
    const confirmMsg = `Bạn có chắc chắn muốn gỡ bỏ toàn bộ ${currentWorkoutEvents.length} buổi tập đã lên lịch khỏi Lịch Zenox và Google Calendar không?`;
    if (!window.confirm(confirmMsg)) return;

    setIsClearing(true);
    try {
      if (onClearWorkoutEvents) {
        await onClearWorkoutEvents();
      }
      notifySuccess('Đã gỡ lịch tập!', `Đã xóa toàn bộ ${currentWorkoutEvents.length} buổi tập khỏi Lịch.`);
    } catch (err: any) {
      console.error('Lỗi khi xóa lịch tập:', err);
      notifyError('Lỗi', err?.message || 'Không thể xóa các buổi tập.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleExecuteSync = async () => {
    const activeSlots = proposedSlots.filter((s) => s.selected);
    if (activeSlots.length === 0) {
      notifyWarning('Chưa chọn buổi tập nào', 'Vui lòng tích chọn ít nhất 1 buổi để đồng bộ.');
      return;
    }

    const unresolvedConflicts = activeSlots.filter((s) => s.status === 'conflict');
    if (unresolvedConflicts.length > 0) {
      const summary = unresolvedConflicts
        .slice(0, 3)
        .map((s) => `${s.date} (${s.startTime}–${s.endTime}): ${s.conflictingTitles.join(', ')}`)
        .join('\n');
      const proceed = window.confirm(
        `Cảnh báo: Có ${unresolvedConflicts.length} buổi tập vẫn đang TRÙNG LỊCH với sự kiện khác:\n${summary}\n\nBạn nên đổi khung giờ cho các buổi bị trùng hoặc bỏ tích chọn trước khi đồng bộ. Vẫn tiếp tục đồng bộ?`
      );
      if (!proceed) return;
    }

    // Check token or prompt user
    let token = await getAccessToken().catch(() => null);
    if (!token) {
      const wantLogin = window.confirm(
        'Google Calendar chưa được kết nối! Bạn có muốn đăng nhập tài khoản Google ngay bây giờ để đồng bộ trực tiếp vào điện thoại không?'
      );
      if (wantLogin) {
        try {
          const res = await googleSignIn();
          token = res.accessToken;
          setGoogleUser(res.user);
          setHasGoogleToken(true);
        } catch {
          // If cancelled or failed, continue with local sync
        }
      }
    }

    setIsSyncing(true);
    setSyncProgress({ current: 0, total: activeSlots.length });

    try {
      // Optionally clear old ZENOX workout events so re-syncing stays clean and even
      if (replaceExistingWorkouts && currentWorkoutEvents.length > 0 && onClearWorkoutEvents) {
        await onClearWorkoutEvents();
      }

      // 1. Prepare CalendarEvent objects (+ optional Pre-workout & Sunday Weekly Check-in autopilot)
      const newEvents: CalendarEvent[] = activeSlots.map((slot, idx) => ({
        id: `ctg-workout-${Date.now()}-${idx}`,
        title: `[ZENOX] ${slot.sessionTitle}`,
        description: `Lộ trình ZENOX: ${resolvedPhase.name}\nBài tập: ${slot.prescriptionsSummary}\nĐược tối ưu giờ trống bởi ZENOX.`,
        startDate: slot.date,
        startTime: slot.startTime,
        endDate: slot.date,
        endTime: slot.endTime,
        allDay: false,
        calendarId: 'health',
        color: '#E11D48',
        type: 'event',
        isCompleted: false,
        createdAt: Date.now(),
      }));

      if (includePreWorkoutReminder) {
        activeSlots.forEach((slot, idx) => {
          const preMins = Math.max(6 * 60, timeToMinutes(slot.startTime) - 75);
          const prePreferred = minutesToHHmm(preMins);
          const preRes = resolveNonConflictingSlot(
            slot.date,
            prePreferred,
            15,
            [...effectiveExistingEvents, ...newEvents],
            { minHour: 6, maxHour: 23, bufferMinutes: 5 }
          );
          if (preRes.status !== 'conflict') {
            newEvents.push({
              id: `ctg-prewo-${Date.now()}-${idx}`,
              title: `⚡ [Pre-Workout] Chuẩn bị — ${slot.sessionTitle}`,
              description: `Nhắc chuẩn bị 75p trước buổi tập "${slot.sessionTitle}": nạp 30–40g carb nhanh, đủ nước & khởi động tinh thần.`,
              startDate: slot.date,
              startTime: preRes.startTime,
              endDate: slot.date,
              endTime: preRes.endTime,
              allDay: false,
              calendarId: 'health',
              color: '#F59E0B',
              type: 'event',
              isCompleted: false,
              createdAt: Date.now(),
            });
          }
        });
      }

      if (includeSundayCheckin) {
        const now = new Date();
        const dow = now.getDay();
        const diffToMonday = now.getDate() - dow + (dow === 0 ? -6 : 1);
        const monday = new Date(now);
        monday.setDate(diffToMonday);
        monday.setHours(0, 0, 0, 0);

        for (let w = 0; w < weeksCount; w++) {
          const sundayDate = new Date(monday);
          sundayDate.setDate(monday.getDate() + w * 7 + 6);
          const sundayStr = formatDateString(sundayDate);
          if (respectAwayMode && isDateInAwayPeriod(sundayStr, awayMode)) continue;
          const ciRes = resolveNonConflictingSlot(
            sundayStr,
            '08:00',
            20,
            [...effectiveExistingEvents, ...newEvents],
            { minHour: 6, maxHour: 23, bufferMinutes: 10 }
          );
          if (ciRes.status !== 'conflict') {
            newEvents.push({
              id: `ctg-checkin-${Date.now()}-${w}`,
              title: '📸 [ZENOX] Weekly Check-in (Cân & Ảnh)',
              description: 'Nhắc cân bụng rỗng sáng Chủ Nhật, chụp ảnh tiến độ và chốt Weekly Check-in Inbox trong ZENOX.',
              startDate: sundayStr,
              startTime: ciRes.startTime,
              endDate: sundayStr,
              endTime: ciRes.endTime,
              allDay: false,
              calendarId: 'health',
              color: '#6366F1',
              type: 'event',
              isCompleted: false,
              createdAt: Date.now(),
            });
          }
        }
      }

      // 2. Add to local store via onBatchSchedule
      if (onBatchSchedule) {
        await onBatchSchedule(newEvents);
      }

      // 3. Push to Google Calendar API if token available
      let gcalSyncedCount = 0;
      if (token) {
        for (let i = 0; i < newEvents.length; i++) {
          setSyncProgress({ current: i + 1, total: newEvents.length });
          const res = await createGoogleCalendarEvent(token, newEvents[i]);
          if (res) gcalSyncedCount++;
        }
      }

      notifySuccess(
        'Đã đồng bộ Lịch tập thành công!',
        `Đã tạo ${newEvents.length} buổi tập lên Lịch Zenox${
          token && gcalSyncedCount > 0
            ? ` và ${gcalSyncedCount} buổi trực tiếp trên Google Calendar của bạn!`
            : '!'
        }`
      );

      onClose();
    } catch (err: any) {
      console.error('Lỗi khi đồng bộ lịch tập:', err);
      notifyError('Lỗi đồng bộ', err?.message || 'Không thể tạo sự kiện lên Google Calendar.');
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  const selectedSlots = proposedSlots.filter((s) => s.selected);
  const selectedCount = selectedSlots.length;
  const shiftedCount = selectedSlots.filter((s) => s.status === 'shifted').length;
  const conflictCount = selectedSlots.filter((s) => s.status === 'conflict').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-[#0c050d] border border-zinc-800 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">

        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 text-zinc-100 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Google Calendar Studio
                </span>
                <span className="text-xs text-white/50 font-mono">{resolvedPhase.name}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                Lên Lịch Tập Tự Động Vào Google Calendar
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* A. Live Google Calendar Status Card */}
          {hasGoogleToken ? (
            <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>Google Calendar: Đã kết nối</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                  <div className="text-[11px] text-emerald-300/80 font-mono">
                    {googleUser?.email || 'Tài khoản Google đã xác thực OAuth'}
                  </div>
                </div>
              </div>
              <a
                href="https://calendar.google.com/calendar/u/0/r"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer transition-colors"
              >
                <span>Mở Google Calendar</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm">Chưa liên kết Google Calendar</div>
                  <div className="text-[11px] text-white/60 mt-0.5">
                    Đăng nhập tài khoản Google để tự động đồng bộ lịch tập sang ứng dụng Lịch trên điện thoại của bạn.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={isConnectingGoogle}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-white/10 text-xs font-semibold shrink-0 cursor-pointer flex items-center gap-2 transition-colors self-start sm:self-auto"
              >
                {isConnectingGoogle ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang kết nối...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Kết Nối Google Ngay</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* B. Clean Existing Scheduled Workouts (User requested control!) */}
          {currentWorkoutEvents.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/20 space-y-2.5 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-rose-400 shrink-0" />
                  <div>
                    <span className="text-white/80">
                      Hiện có <strong className="text-rose-300 font-mono font-bold">{currentWorkoutEvents.length}</strong> buổi tập thể hình đã được lên lịch.
                    </span>
                    <div className="text-[11px] text-white/40">
                      Bật thay thế để làm mới lịch đồng đều, không bị chồng chéo buổi cũ.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearWorkouts}
                  disabled={isClearing}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-200 border border-rose-500/40 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                >
                  {isClearing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Gỡ Bỏ {currentWorkoutEvents.length} Buổi Tập Này</span>
                </button>
              </div>

              <label className="flex items-center gap-2 pt-2 border-t border-white/10 text-[11px] text-white/80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={replaceExistingWorkouts}
                  onChange={(e) => setReplaceExistingWorkouts(e.target.checked)}
                  className="rounded accent-rose-500 cursor-pointer"
                />
                <span>Tự động thay thế {currentWorkoutEvents.length} buổi tập ZENOX cũ khi đồng bộ mới</span>
              </label>
            </div>
          )}

          {/* 1. Chọn Khung Lịch Tập (Split) */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Dumbbell className="w-3.5 h-3.5 text-rose-400" />
              1. Lựa chọn Phân Chia Lịch Tập (Split)
            </label>

            {plannedSessions.length > 0 && (
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Dùng giáo án đang tập hiện tại</div>
                  <div className="text-[11px] text-white/50">
                    Gồm {plannedSessions.length} buổi tập bạn đã tự tùy chỉnh trong tab Tập Luyện.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUseCurrentPlanned(!useCurrentPlanned)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    useCurrentPlanned ? 'bg-rose-600 text-white' : 'bg-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {useCurrentPlanned ? 'Đang dùng' : 'Chọn dùng'}
                </button>
              </div>
            )}

            {!useCurrentPlanned && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SPLIT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedSplit(opt.id)}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                      selectedSplit === opt.id
                        ? 'bg-rose-500/15 border-rose-500 text-white shadow-lg shadow-rose-950/40'
                        : 'bg-white/[0.03] border-white/5 text-white/60 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-white">{opt.nameVi}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/80">
                        {opt.daysPerWeek} ngày/tuần
                      </span>
                    </div>
                    <div className="text-[11px] text-white/40 leading-relaxed">{opt.descVi}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Khung Giờ & Số Tuần Đồng Bộ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Khung giờ ưu tiên */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                2. Khung Giờ Tập Ưa Thích
              </label>
              <div className="space-y-1.5">
                {TIME_WINDOWS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setSelectedWindowId(w.id)}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs font-mono cursor-pointer transition-colors flex items-center justify-between ${
                      selectedWindowId === w.id
                        ? 'bg-amber-500/15 border-amber-500 text-white'
                        : 'bg-white/[0.02] border-white/5 text-white/60 hover:border-white/15'
                    }`}
                  >
                    <span>{w.label}</span>
                    {selectedWindowId === w.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedWindowId('custom')}
                  className={`w-full p-2.5 rounded-xl border text-left text-xs font-mono cursor-pointer transition-colors flex items-center justify-between ${
                    selectedWindowId === 'custom'
                      ? 'bg-amber-500/15 border-amber-500 text-white'
                      : 'bg-white/[0.02] border-white/5 text-white/60 hover:border-white/15'
                  }`}
                >
                  <span>
                    Tùy chỉnh ({customStart} - {minutesToHHmm(timeToMinutes(customStart) + customDurationMins)})
                  </span>
                  {selectedWindowId === 'custom' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
                {selectedWindowId === 'custom' && (
                  <div className="p-2.5 rounded-xl bg-white/[0.04] border border-amber-500/30 flex items-center gap-2 text-xs">
                    <label className="text-white/60 shrink-0">Bắt đầu:</label>
                    <input
                      type="time"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value || '17:30')}
                      className="bg-black/40 border border-white/15 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                    <select
                      value={customDurationMins}
                      onChange={(e) => setCustomDurationMins(Number(e.target.value) || 75)}
                      className="bg-black/40 border border-white/15 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    >
                      <option value={45}>45 phút</option>
                      <option value={60}>60 phút</option>
                      <option value={75}>75 phút</option>
                      <option value={90}>90 phút</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Độ dài đồng bộ */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                3. Đồng Bộ Cho Bao Nhiêu Tuần?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 4].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWeeksCount(w)}
                    className={`p-3 rounded-2xl border text-center cursor-pointer transition-colors ${
                      weeksCount === w
                        ? 'bg-blue-500/20 border-blue-500 text-white'
                        : 'bg-white/[0.03] border-white/5 text-white/50 hover:text-white'
                    }`}
                  >
                    <div className="text-base font-black font-mono">{w}</div>
                    <div className="text-[10px] text-white/50">Tuần tới</div>
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-[11px] text-white/50 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  Chống Trùng & Cân Bằng Lịch Tập
                </div>
                <p>
                  Kiểm tra cả lịch lặp lại và lịch học/làm trong ngày. Nếu giờ ưu tiên bị trùng, buổi tập tự dời sang khoảng trống gần nhất hoặc cảnh báo để bạn tự chỉnh giờ.
                </p>
                {uniformTimeSuggestion && (shiftedCount > 0 || conflictCount > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomStart(uniformTimeSuggestion.start);
                      setSelectedWindowId('custom');
                    }}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold cursor-pointer transition-colors text-left flex items-center justify-between"
                  >
                    <span>
                      ✨ Giờ đồng đều cả {weeksCount} tuần: {uniformTimeSuggestion.start}–{uniformTimeSuggestion.end}
                    </span>
                    <span className="underline shrink-0 ml-2">Áp dụng</span>
                  </button>
                )}

                {/* Phase 4 Calendar Autopilot Options */}
                <div className="pt-2 border-t border-white/10 space-y-1.5 text-white/75">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includePreWorkoutReminder}
                      onChange={(e) => setIncludePreWorkoutReminder(e.target.checked)}
                      className="rounded accent-amber-500 cursor-pointer"
                    />
                    <span>Chèn nhắc Pre-workout &amp; Carb (trước buổi tập ~75p)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeSundayCheckin}
                      onChange={(e) => setIncludeSundayCheckin(e.target.checked)}
                      className="rounded accent-indigo-500 cursor-pointer"
                    />
                    <span>Chèn nhắc Weekly Check-in Chủ Nhật (08:00 · 20p)</span>
                  </label>
                  {awayMode?.enabled && (
                    <label className="flex items-center gap-2 cursor-pointer select-none text-purple-300">
                      <input
                        type="checkbox"
                        checked={respectAwayMode}
                        onChange={(e) => setRespectAwayMode(e.target.checked)}
                        className="rounded accent-purple-500 cursor-pointer"
                      />
                      <span>Né kỳ nghỉ Away Mode ({awayMode.startDate} → {awayMode.endDate})</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Danh Sách Các Buổi Sắp Được Lên Lịch (Live Preview) */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Danh Sách {proposedSlots.length} Buổi Tập Dự Kiến (Đã chọn {selectedCount})
              </label>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                {shiftedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {shiftedCount} buổi đã dời né trùng
                  </span>
                )}
                {conflictCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                    {conflictCount} buổi VẪN TRÙNG LỊCH
                  </span>
                )}
              </div>
            </div>

            {conflictCount > 0 && (
              <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Cảnh báo: Có {conflictCount} buổi chưa tìm được khung giờ trống hoàn toàn</div>
                  <div className="text-[11px] text-rose-200/80 mt-0.5">
                    Hãy đổi khung giờ ưa thích, bấm gợi ý giờ đồng đều, hoặc chỉnh tay giờ cho từng buổi màu đỏ bên dưới trước khi đồng bộ.
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {proposedSlots.map((slot, idx) => (
                <div
                  key={idx}
                  onClick={() => toggleSlot(idx)}
                  className={`p-2.5 sm:p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer transition-colors ${
                    !slot.selected
                      ? 'bg-black/20 border-white/5 opacity-40 hover:opacity-70'
                      : slot.status === 'conflict'
                      ? 'bg-rose-950/30 border-rose-500/50 hover:border-rose-400'
                      : slot.status === 'shifted'
                      ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-400/50'
                      : 'bg-white/[0.04] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={slot.selected}
                      onChange={() => {}}
                      className="rounded accent-rose-500 cursor-pointer mt-1 sm:mt-0"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-white">{slot.date}</span>
                        <span className="text-[10px] text-white/40">{slot.dayLabel}</span>
                        {slot.status === 'conflict' ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/25 text-rose-200 border border-rose-500/50 flex items-center gap-1 font-bold">
                            <AlertCircle className="w-2.5 h-2.5" />
                            Trùng: {slot.conflictingTitles.join(', ')}
                          </span>
                        ) : slot.status === 'shifted' ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" />
                            Đã dời né: {slot.conflictingTitles.join(', ')}
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Khớp giờ chuẩn
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-rose-300 truncate mt-0.5">
                        {slot.sessionTitle}
                      </div>
                      <div className="text-[10px] text-white/40 truncate">
                        {slot.prescriptionsSummary}
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-1.5 shrink-0 self-end sm:self-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {slot.alternativeSlots.length > 0 && (
                      <select
                        value={
                          slot.alternativeSlots.some((a) => a.startTime === slot.startTime)
                            ? slot.startTime
                            : ''
                        }
                        onChange={(e) => {
                          if (e.target.value) updateSlotStartTime(idx, e.target.value);
                        }}
                        title="Chọn khung giờ trống gợi ý"
                        className="bg-black/50 border border-white/15 rounded-lg px-1.5 py-1 text-[10px] font-mono text-white/80 cursor-pointer max-w-[110px]"
                      >
                        <option value="">Giờ trống...</option>
                        {slot.alternativeSlots.map((alt) => (
                          <option key={alt.startTime} value={alt.startTime}>
                            {alt.startTime}–{alt.endTime}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) => updateSlotStartTime(idx, e.target.value)}
                      aria-label={`Giờ bắt đầu ${slot.date}`}
                      className={`bg-black/50 border rounded-lg px-1.5 py-1 text-[11px] font-mono font-bold cursor-pointer ${
                        slot.status === 'conflict'
                          ? 'border-rose-500/60 text-rose-300'
                          : 'border-white/15 text-emerald-400'
                      }`}
                    />
                    <span className="font-mono text-[11px] text-white/50">– {slot.endTime}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-white/10 bg-black/40 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-xs text-white/50">
            Tổng cộng: <strong className="text-white font-mono">{selectedCount}</strong> buổi tập
            {conflictCount > 0 && (
              <span className="ml-2 text-rose-400 font-semibold">
                ({conflictCount} buổi đang trùng lịch)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSyncing}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-bold cursor-pointer transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleExecuteSync}
              disabled={isSyncing || selectedCount === 0}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    Đang đồng bộ... ({syncProgress?.current}/{syncProgress?.total})
                  </span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Đồng Bộ Ngay Vào Google Calendar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

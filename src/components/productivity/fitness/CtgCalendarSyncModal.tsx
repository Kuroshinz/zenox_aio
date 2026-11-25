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
import { CtgRoadmapPhase, PlannedSession, RoutineSplitTemplate } from '../../../types/productivity';
import { generateSplitSessions } from '../../../utils/fitnessMetrics';
import { getAccessToken, googleSignIn, AppUser } from '../../../services/auth';
import { createGoogleCalendarEvent, deleteGoogleCalendarEvent } from '../../../services/googleCalendarSync';
import { notifySuccess, notifyWarning, notifyError } from '../../../utils/notify';

export interface CtgCalendarSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePhase?: CtgRoadmapPhase;
  existingEvents?: CalendarEvent[];
  plannedSessions?: PlannedSession[];
  onBatchSchedule?: (events: CalendarEvent[]) => Promise<void> | void;
  onClearWorkoutEvents?: () => Promise<number> | number | void;
  lang?: 'vi' | 'en';
}

interface ProposedSlot {
  date: string; // YYYY-MM-DD
  dayLabel: string; // 'Thứ 2', 'Thứ 3'...
  sessionTitle: string;
  prescriptionsSummary: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isConflictAvoided: boolean;
  conflictReason?: string;
  selected: boolean;
}

const SPLIT_OPTIONS: { id: RoutineSplitTemplate; nameVi: string; descVi: string; daysPerWeek: number }[] = [
  {
    id: 'ppl',
    nameVi: 'Push / Pull / Legs (PPL)',
    descVi: 'Phổ biến nhất · 5-6 buổi/tuần · Tối ưu phì đại cơ bắp và phục hồi khớp',
    daysPerWeek: 5,
  },
  {
    id: 'upper_lower',
    nameVi: 'Upper / Lower (Thân Trên / Thân Dưới)',
    descVi: '4 buổi/tuần · Cân bằng hoàn hảo giữa sức mạnh và thời gian bận rộn',
    daysPerWeek: 4,
  },
  {
    id: 'fullbody',
    nameVi: 'Full Body 3x (Toàn Thân)',
    descVi: '3 buổi/tuần · Thích hợp người ít thời gian, kích thích tần suất cao',
    daysPerWeek: 3,
  },
  {
    id: 'arnold',
    nameVi: 'Arnold Split (Ngực-Lưng / Vai-Tay / Chân)',
    descVi: '6 buổi/tuần · Pump cơ cực đại, tập trung thân trên và cánh tay',
    daysPerWeek: 6,
  },
];

const TIME_WINDOWS = [
  { id: 'evening', label: 'Chiều tối (17:30 - 18:45)', start: '17:30', end: '18:45' },
  { id: 'morning', label: 'Sáng sớm (06:00 - 07:15)', start: '06:00', end: '07:15' },
  { id: 'noon', label: 'Buổi trưa (11:45 - 13:00)', start: '11:45', end: '13:00' },
  { id: 'night', label: 'Tối muộn (19:45 - 21:00)', start: '19:45', end: '21:00' },
];

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(mins: number): string {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, mins));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const CtgCalendarSyncModal: React.FC<CtgCalendarSyncModalProps> = ({
  isOpen,
  onClose,
  activePhase,
  existingEvents = [],
  plannedSessions = [],
  onBatchSchedule,
  onClearWorkoutEvents,
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
    return existingEvents.filter(
      (e) =>
        e.id.startsWith('scheduled-wo-') ||
        e.id.startsWith('ctg-workout-') ||
        (e.calendarId === 'health' && e.title.includes('💪'))
    );
  }, [existingEvents]);

  // Preferred window
  const activeWindow = useMemo(() => {
    const found = TIME_WINDOWS.find((w) => w.id === selectedWindowId);
    if (found) return { start: found.start, end: found.end };
    return {
      start: customStart,
      end: minutesToTime(timeToMinutes(customStart) + customDurationMins),
    };
  }, [selectedWindowId, customStart, customDurationMins]);

  // Generate proposed schedule with smart collision avoidance
  const [proposedSlots, setProposedSlots] = useState<ProposedSlot[]>([]);

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

    const duration = timeToMinutes(activeWindow.end) - timeToMinutes(activeWindow.start);
    const slots: ProposedSlot[] = [];

    const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

    for (let w = 0; w < weeksCount; w++) {
      sessionsToSchedule.forEach((session, idx) => {
        const dayIdx = session.dayIndex !== undefined ? session.dayIndex : idx % 7;
        const targetDate = new Date(monday);
        targetDate.setDate(monday.getDate() + w * 7 + dayIdx);

        // Format target date as YYYY-MM-DD
        const y = targetDate.getFullYear();
        const m = String(targetDate.getMonth() + 1).padStart(2, '0');
        const d = String(targetDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        // Check conflicts in existingEvents (ignore existing workout events when calculating conflicts)
        const eventsOnDay = existingEvents.filter(
          (ev) =>
            !ev.allDay &&
            !ev.id.startsWith('scheduled-wo-') &&
            !ev.id.startsWith('ctg-workout-') &&
            (ev.startDate === dateStr || (ev.startDate <= dateStr && ev.endDate >= dateStr)) &&
            ev.startTime &&
            ev.endTime
        );

        let chosenStartMins = timeToMinutes(activeWindow.start);
        let chosenEndMins = chosenStartMins + duration;
        let avoidedConflict = false;
        let conflictReason: string | undefined;

        // Check if preferred window overlaps with any event
        const hasOverlap = (startM: number, endM: number) => {
          return eventsOnDay.find((ev) => {
            const evStart = timeToMinutes(ev.startTime);
            const evEnd = timeToMinutes(ev.endTime);
            return Math.max(startM, evStart) < Math.min(endM, evEnd);
          });
        };

        const conflictEv = hasOverlap(chosenStartMins, chosenEndMins);
        if (conflictEv) {
          avoidedConflict = true;
          conflictReason = conflictEv.title;

          // Attempt shift +15 mins after conflict
          const afterMins = timeToMinutes(conflictEv.endTime) + 15;
          if (afterMins + duration <= 22 * 60 && !hasOverlap(afterMins, afterMins + duration)) {
            chosenStartMins = afterMins;
            chosenEndMins = afterMins + duration;
          } else {
            // Attempt shift -15 mins before conflict
            const beforeMins = timeToMinutes(conflictEv.startTime) - duration - 15;
            if (beforeMins >= 6 * 60 && !hasOverlap(beforeMins, beforeMins + duration)) {
              chosenStartMins = beforeMins;
              chosenEndMins = beforeMins + duration;
            }
          }
        }

        const prescripSummary = session.prescriptions?.length
          ? session.prescriptions
              .slice(0, 3)
              .map((p) => p.exerciseId.replace(/-/g, ' '))
              .join(' · ') + (session.prescriptions.length > 3 ? '...' : '')
          : 'Bài tập cơ bản';

        slots.push({
          date: dateStr,
          dayLabel: `${DAY_LABELS[dayIdx]} (Tuần ${w + 1})`,
          sessionTitle: session.title,
          prescriptionsSummary: prescripSummary,
          startTime: minutesToTime(chosenStartMins),
          endTime: minutesToTime(chosenEndMins),
          isConflictAvoided: avoidedConflict,
          conflictReason,
          selected: true,
        });
      });
    }

    setProposedSlots(slots);
  }, [isOpen, selectedSplit, useCurrentPlanned, plannedSessions, weeksCount, activeWindow, existingEvents]);

  if (!isOpen) return null;

  const toggleSlot = (index: number) => {
    setProposedSlots((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, selected: !s.selected } : s))
    );
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
      // 1. Prepare CalendarEvent objects
      const newEvents: CalendarEvent[] = activeSlots.map((slot, idx) => ({
        id: `ctg-workout-${Date.now()}-${idx}`,
        title: `💪 [ZENOX] ${slot.sessionTitle}`,
        description: `Lộ trình ZENOX: ${resolvedPhase.name}\nBài tập: ${slot.prescriptionsSummary}\nĐược tự động lên lịch tối ưu bởi ZENOX AI.`,
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

  const selectedCount = proposedSlots.filter((s) => s.selected).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-[#0c050d] border border-rose-500/30 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-500 border border-rose-500/30 text-white flex items-center justify-center shrink-0 shadow-md">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
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
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
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
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shrink-0 cursor-pointer shadow-md flex items-center gap-2 transition-all self-start sm:self-auto"
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
            <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-rose-400 shrink-0" />
                <div>
                  <span className="text-white/80">
                    Hiện có <strong className="text-rose-300 font-mono font-bold">{currentWorkoutEvents.length}</strong> buổi tập thể hình đã được lên lịch.
                  </span>
                  <div className="text-[11px] text-white/40">
                    Nếu bạn chưa từng yêu cầu hoặc muốn làm mới lại lịch, bạn có thể gỡ sạch với 1 click.
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

              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-[11px] text-white/50 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  Thuật toán Giờ Rảnh Thông Minh
                </div>
                <p>
                  Hệ thống tự động rà soát lịch của bạn. Nếu có sự kiện trùng, buổi tập sẽ tự động dời sang khoảng trống gần nhất.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Danh Sách Các Buổi Sắp Được Lên Lịch (Live Preview) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Danh Sách {proposedSlots.length} Buổi Tập Dự Kiến (Đã chọn {selectedCount})
              </label>
              <span className="text-[10px] text-white/40 font-mono">Bấm vào từng buổi để bật/tắt</span>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {proposedSlots.map((slot, idx) => (
                <div
                  key={idx}
                  onClick={() => toggleSlot(idx)}
                  className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    slot.selected
                      ? 'bg-white/[0.04] border-white/10 hover:border-white/20'
                      : 'bg-black/20 border-white/5 opacity-40 hover:opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={slot.selected}
                      onChange={() => {}}
                      className="rounded accent-rose-500 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">{slot.date}</span>
                        <span className="text-[10px] text-white/40">{slot.dayLabel}</span>
                        {slot.isConflictAvoided && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" />
                            Dời né trùng lịch
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

                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs font-bold text-emerald-400">
                      {slot.startTime} – {slot.endTime}
                    </div>
                    {slot.conflictReason && (
                      <div className="text-[9px] text-white/30 truncate max-w-[120px]">
                        tránh "{slot.conflictReason}"
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-white/10 bg-black/40 flex items-center justify-between shrink-0">
          <div className="text-xs text-white/50">
            Tổng cộng: <strong className="text-white font-mono">{selectedCount}</strong> buổi tập sẽ được tạo.
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
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold cursor-pointer shadow-lg shadow-rose-900/40 flex items-center gap-2 transition-all disabled:opacity-50"
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

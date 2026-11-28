import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dumbbell,
  Calendar,
  Flame,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Plus,
  Trash2,
  Sparkles,
  Award,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  X,
  Check,
  Zap,
  AlertCircle,
  ExternalLink,
  LogIn,
  History,
  Minus,
  Calculator,
  Compass,
  Target,
  Upload,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import {
  AwayBreakPeriod,
  CtgPeriodizedRoadmap,
  CtgRoadmapPhase,
  Exercise,
  HealthDayLog,
  MUSCLE_COLOR,
  MUSCLE_LABEL,
  MuscleGroup,
  PlannedSession,
  RoutineSplitTemplate,
  SPORT_LABEL,
  SportSession,
  SportType,
  WorkoutSession,
} from '../../../types/productivity';
import {
  EXERCISES,
  calculate1RM,
  calculateBarbellPlates,
  calculateProgressiveOverload,
  calculateMuscleVolumeLandmarks,
  calculateMesocycleWeekPlan,
  compareProgressiveOverload,
  exerciseById,
  gymCalories,
  personalRecords,
  setVolume,
  setsByMuscle,
  sportCalories,
  todayString,
  weeklyVolume,
  getExerciseHistoryDrilldown,
  findSessionDetailGaps,
} from '../../../utils/fitnessMetrics';
import { notifySuccess, notifyInfo } from '../../../utils/notify';
import { formatDateString, resolveNonConflictingSlot } from '../../../utils/calendarUtils';
import { BarChart, ProgressBar } from '../../charts/SimpleCharts';
import { TrackedScheduleMatrix } from './TrackedScheduleMatrix';
import { CtgDeloadAdvisor } from './CtgDeloadAdvisor';
import { LiveWorkoutSessionView } from './LiveWorkoutSessionView';
import { CtgCalendarSyncModal } from './CtgCalendarSyncModal';
import { SmartWorkoutImportModal } from './SmartWorkoutImportModal';
import { CalendarEvent } from '../../../types/calendar';
import { getAccessToken, googleSignIn } from '../../../services/auth';
import { accountStorage } from '../../../services/accountStorage';
import { notifyError, notifyWarning } from '../../../utils/notify';
import { TrainingReadinessAutoregulator } from './TrainingReadinessAutoregulator';
import {
  triggerHaptic,
  scheduleRestTimerNotification,
  cancelRestTimerNotification,
} from '../../../utils/nativeBridge';

interface TrainingTabProps {
  plannedSessions: PlannedSession[];
  workoutSessions: WorkoutSession[];
  sportSessions: SportSession[];
  userWeightKg: number;
  customExercises?: Exercise[];
  onAddCustomExercise?: (exercise: Omit<Exercise, 'id'>) => Exercise;
  onDeleteCustomExercise?: (id: string) => void;
  onApplySplitTemplate?: (template: RoutineSplitTemplate) => void;
  lang: 'vi' | 'en';
  onLogWorkoutSession: (w: Omit<WorkoutSession, 'id'>) => WorkoutSession;
  onUpdateWorkoutSession?: (session: WorkoutSession) => void;
  onDeleteWorkoutSession: (id: string) => void;
  onAddSportSession: (s: Omit<SportSession, 'id' | 'createdAt'>) => SportSession;
  onDeleteSportSession: (id: string) => void;
  onAddPlannedSession?: (session: PlannedSession) => void;
  onUpdatePlannedSession?: (session: PlannedSession) => void;
  onDeletePlannedSession?: (id: string) => void;
  onScheduleSessionToCalendar?: (title: string, date: string, color: string) => void;
  onUpsertHealthLog?: (log: HealthDayLog) => void;
  healthLogs?: HealthDayLog[];
  ctgPeriodizedRoadmap?: CtgPeriodizedRoadmap | null;
  events?: CalendarEvent[];
  onBatchScheduleToCalendar?: (newEvents: CalendarEvent[]) => Promise<void> | void;
  onClearWorkoutEventsFromCalendar?: () => Promise<number> | number | void;
  awayMode?: AwayBreakPeriod;
}

const SPORT_OPTIONS: SportType[] = [
  'running',
  'cycling',
  'swimming',
  'football',
  'badminton',
  'basketball',
  'tennis',
  'other',
];

export const TrainingTab: React.FC<TrainingTabProps> = ({
  plannedSessions,
  workoutSessions,
  sportSessions,
  userWeightKg,
  customExercises = [],
  onAddCustomExercise,
  onDeleteCustomExercise,
  onApplySplitTemplate,
  lang,
  onLogWorkoutSession,
  onUpdateWorkoutSession,
  onDeleteWorkoutSession,
  onAddSportSession,
  onDeleteSportSession,
  onAddPlannedSession,
  onUpdatePlannedSession,
  onDeletePlannedSession,
  onScheduleSessionToCalendar,
  onUpsertHealthLog,
  healthLogs,
  ctgPeriodizedRoadmap,
  events = [],
  onBatchScheduleToCalendar,
  onClearWorkoutEventsFromCalendar,
  awayMode,
}) => {
  const [scheduledBanner, setScheduledBanner] = useState<string | null>(null);
  const [showSportModal, setShowSportModal] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [activeSessionDirty, setActiveSessionDirty] = useState(false);
  const [pendingPlanSync, setPendingPlanSync] = useState<{
    planned: PlannedSession;
    updatedPrescriptions: PlannedSession['prescriptions'];
  } | null>(null);
  const [inspectingExerciseId, setInspectingExerciseId] = useState<string | null>(null);
  const [exerciseCues, setExerciseCues] = useState<Record<string, string>>(() => {
    try {
      const raw = accountStorage.getItem('gcal_prod_exercise_cues');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // 1RM & Barbell Plate Calculator states
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [calcTab, setCalcTab] = useState<'1rm' | 'plates'>('1rm');
  const [oneRmWeight, setOneRmWeight] = useState('80');
  const [oneRmReps, setOneRmReps] = useState('6');
  const [plateTargetTotal, setPlateTargetTotal] = useState('90');
  const [plateBarWeight, setPlateBarWeight] = useState('20');

  const oneRmResult = useMemo(() => {
    return calculate1RM(Number(oneRmWeight) || 0, Number(oneRmReps) || 0);
  }, [oneRmWeight, oneRmReps]);

  const plateResult = useMemo(() => {
    return calculateBarbellPlates(Number(plateTargetTotal) || 0, Number(plateBarWeight) || 20);
  }, [plateTargetTotal, plateBarWeight]);

  // Sport form state
  const [sportType, setSportType] = useState<SportType>('running');
  const [sportDuration, setSportDuration] = useState('30');
  const [sportDate, setSportDate] = useState(() => todayString());
  const [sportNote, setSportNote] = useState('');

  // Workout Days Calendar & Manual Logger State
  const [calendarMonth, setCalendarMonth] = useState(() => todayString().slice(0, 7)); // YYYY-MM
  const [selectedDayFilter, setSelectedDayFilter] = useState<string | null>(null);
  const [showLogPastWorkoutModal, setShowLogPastWorkoutModal] = useState(false);
  const [pastDate, setPastDate] = useState(() => todayString());
  const [pastTitle, setPastTitle] = useState('Buổi tập thể hình');
  const [pastDuration, setPastDuration] = useState('50');
  const [pastBurnedKcal, setPastBurnedKcal] = useState('260');
  const [pastNotes, setPastNotes] = useState('');

  // Active workout session tracker
  interface ActiveSessionState {
    planned: PlannedSession;
    startedAt: number;
    prescriptions: PlannedSession['prescriptions'];
    sets: Record<
      string,
      {
        weightKg: number;
        reps: number;
        completed: boolean;
        setType?: 'normal' | 'warmup' | 'dropset' | 'failure';
        rpe?: number;
        rir?: number;
        isPr?: boolean;
      }
    >;
  }
  const [activeSession, setActiveSession] = useState<ActiveSessionState | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(90);
  const [autoScheduleOnFinish, setAutoScheduleOnFinish] = useState(false); // DEFAULT FALSE to prevent unrequested calendar injection!
  const [showCalendarSyncModal, setShowCalendarSyncModal] = useState(false);
  const [showSmartImportModal, setShowSmartImportModal] = useState(false);
  const [hasGoogleToken, setHasGoogleToken] = useState(false);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isClearingWorkouts, setIsClearingWorkouts] = useState(false);

  useEffect(() => {
    getAccessToken()
      .then((t) => setHasGoogleToken(Boolean(t)))
      .catch(() => setHasGoogleToken(false));
    try {
      const raw = localStorage.getItem('gcal_active_user');
      if (raw) {
        const u = JSON.parse(raw);
        setGoogleUserEmail(u.email || null);
      }
    } catch {}
  }, []);

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      const { user, accessToken } = await googleSignIn();
      setGoogleUserEmail(user.email);
      setHasGoogleToken(Boolean(accessToken));
      notifySuccess('Đã kết nối Google Calendar!', `Đã liên kết với tài khoản ${user.email}`);
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      notifyError('Lỗi kết nối Google', err?.message || 'Không thể đăng nhập tài khoản Google.');
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const workoutEventsCount = useMemo(() => {
    return (events || []).filter(
      (e) =>
        e.id.startsWith('scheduled-wo-') ||
        e.id.startsWith('ctg-workout-') ||
        (e.calendarId === 'health' && (e.title.includes('💪') || e.title.includes('[ZENOX]')))
    ).length;
  }, [events]);

  const handleClearScheduledWorkouts = async () => {
    if (workoutEventsCount === 0) return;
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn gỡ bỏ toàn bộ ${workoutEventsCount} buổi tập đã lên lịch khỏi Lịch Zenox và Google Calendar không?`
      )
    ) {
      return;
    }
    setIsClearingWorkouts(true);
    try {
      if (onClearWorkoutEventsFromCalendar) {
        const removed = await onClearWorkoutEventsFromCalendar();
        notifySuccess('Đã gỡ lịch tập!', `Đã xóa toàn bộ ${removed || workoutEventsCount} buổi tập khỏi Lịch.`);
      }
    } catch (err: any) {
      notifyError('Lỗi xóa lịch tập', err?.message || 'Không thể xóa các buổi tập.');
    } finally {
      setIsClearingWorkouts(false);
    }
  };
  const [extraExerciseId, setExtraExerciseId] = useState('');
  const [isSessionMinimized, setIsSessionMinimized] = useState<boolean>(false);
  const [activeMesoWeek, setActiveMesoWeek] = useState<number>(() => {
    try {
      const saved = accountStorage.getItem('vortexcal_active_mesocycle_week');
      return saved ? parseInt(saved, 10) : 1;
    } catch {
      return 1;
    }
  });

  useEffect(() => {
    const handleMesoChange = () => {
      try {
        const saved = accountStorage.getItem('vortexcal_active_mesocycle_week');
        if (saved) setActiveMesoWeek(parseInt(saved, 10));
      } catch {
        // ignore
      }
    };
    window.addEventListener('vortexcal_meso_week_changed', handleMesoChange);
    return () => window.removeEventListener('vortexcal_meso_week_changed', handleMesoChange);
  }, []);

  // CTG Active Phase
  const ctgActivePhase = useMemo(() => {
    if (!ctgPeriodizedRoadmap || !ctgPeriodizedRoadmap.phases?.length) return null;
    if (ctgPeriodizedRoadmap.activePhaseId && ctgPeriodizedRoadmap.activePhaseId !== 'none') {
      const found = ctgPeriodizedRoadmap.phases.find((p) => p.id === ctgPeriodizedRoadmap.activePhaseId);
      if (found) return found;
    }
    const current = ctgPeriodizedRoadmap.phases.find((p) => p.isCurrent);
    return current || ctgPeriodizedRoadmap.phases[0] || null;
  }, [ctgPeriodizedRoadmap]);

  // User preference to show/hide CTG Phase Guidance Banner (respecting users with existing routines)
  const [showCtgGuidance, setShowCtgGuidance] = useState<boolean>(() => {
    try {
      const saved = accountStorage.getItem('vortexcal_show_ctg_training_guidance');
      if (saved !== null) {
        return saved === 'true';
      }
      return true;
    } catch {
      return true;
    }
  });

  const handleToggleCtgGuidance = (visible: boolean) => {
    setShowCtgGuidance(visible);
    try {
      accountStorage.setItem('vortexcal_show_ctg_training_guidance', String(visible));
    } catch {}
    if (!visible) {
      notifyInfo(
        lang === 'vi' ? 'Đã ẩn gợi ý giai đoạn' : 'ZENOX Guidance hidden',
        lang === 'vi'
          ? 'Gợi ý đã được thu gọn để không làm phiền lịch tập của bạn. Bấm "Gợi ý ZENOX" để mở lại.'
          : 'Guidance hidden to keep your routine clear. Click "ZENOX Guidance" to view anytime.'
      );
    }
  };

  // Combined Exercises & Lookup
  const allExercises = useMemo(() => [...EXERCISES, ...customExercises], [customExercises]);
  const getExercise = useCallback((id: string) => exerciseById(id, customExercises), [customExercises]);

  // Custom Exercise Modal state
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState<MuscleGroup>('chest');
  const [newExEquipment, setNewExEquipment] = useState('Dumbbell');
  const [newExCue, setNewExCue] = useState('');

  // Active Split Template
  const [currentSplit, setCurrentSplit] = useState<RoutineSplitTemplate>('upper_lower');

  // Workout History details state
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null);

  // Custom Plan Creation Modal state
  const [showAddPlanModal, setShowAddPlanModal] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [planDayOfWeek, setPlanDayOfWeek] = useState('Thứ 2');
  const [planPrescriptions, setPlanPrescriptions] = useState<
    Array<{ exerciseId: string; sets: number; reps: string; rpe: number; restSeconds: number }>
  >([
    { exerciseId: 'bench-press', sets: 4, reps: '8-10', rpe: 8, restSeconds: 90 },
    { exerciseId: 'incline-dumbbell-press', sets: 3, reps: '10-12', rpe: 8, restSeconds: 75 },
  ]);

  const prs = personalRecords(workoutSessions);

  // Web Audio chime for rest timer completion
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  };

  // Active session timers
  useEffect(() => {
    if (!activeSession) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  useEffect(() => {
    if (restSecondsLeft === null || restSecondsLeft <= 0) return;
    const interval = setInterval(() => {
      setRestSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          playBeep();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [restSecondsLeft]);

  const handleApplyReadinessAdjustment = (adjustmentPct: number) => {
    if (adjustmentPct === 0) {
      notifyInfo('Giữ nguyên giáo án', 'Khối lượng và cường độ được giữ nguyên theo đúng kê đơn cơ sở.');
      return;
    }

    if (adjustmentPct < 0) {
      const todayDow = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][new Date().getDay()];
      const todayDayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
      const targetSession =
        plannedSessions.find((p) => p.dayIndex === todayDayIdx || p.dayOfWeek === todayDow) ||
        plannedSessions[0];
      const scale = Math.max(0.5, 1 + adjustmentPct / 100);

      if (targetSession && onUpdatePlannedSession) {
        onUpdatePlannedSession({
          ...targetSession,
          prescriptions: targetSession.prescriptions.map((p) => ({
            ...p,
            sets: Math.max(1, Math.round(p.sets * scale)),
            rpe: Math.max(5, Math.round((p.rpe - 1) * 10) / 10),
          })),
        });
      }

      // Sync deload / recovery note onto today's Zenox Calendar when fatigue triggers volume cut
      const todayStr = todayString();
      if (adjustmentPct <= -20 && onBatchScheduleToCalendar) {
        const res = resolveNonConflictingSlot(todayStr, '17:30', 45, events, {
          minHour: 6,
          maxHour: 23,
          bufferMinutes: 10,
        });
        if (res.status !== 'conflict') {
          onBatchScheduleToCalendar([
            {
              id: `ctg-deload-${Date.now()}`,
              title: `🧘 [Deload ${adjustmentPct}%] ${targetSession ? targetSession.title : 'Giảm tải phục hồi'}`,
              description: `Autoregulation Red-Zone (${adjustmentPct}% volume, hạ 1 RPE) để bảo vệ hệ thần kinh trung ương (CNS).`,
              startDate: todayStr,
              startTime: res.startTime,
              endDate: todayStr,
              endTime: res.endTime,
              allDay: false,
              calendarId: 'health',
              color: '#F43F5E',
              type: 'event',
              isCompleted: false,
              createdAt: Date.now(),
            },
          ]);
        }
      }

      setScheduledBanner(
        `Đã kích hoạt Autoregulation: Giảm ${Math.abs(adjustmentPct)}% thể tích${targetSession ? ` cho buổi "${targetSession.title}"` : ''}${adjustmentPct <= -20 && onBatchScheduleToCalendar ? ' và đồng bộ ghi chú Deload sang Lịch Zenox' : ''}!`
      );
      setTimeout(() => setScheduledBanner(null), 5000);
      notifySuccess(
        'Đã kích hoạt Autoregulation!',
        `Đã tự động giảm ${Math.abs(adjustmentPct)}% số hiệp tập${targetSession ? ` của "${targetSession.title}"` : ''} để cơ thể phục hồi tối ưu.`
      );
    } else {
      setScheduledBanner(
        `Trạng thái đỉnh cao (+${adjustmentPct}%)! Bạn có thể tự tin thêm 1 hiệp làm việc hoặc tăng 1-2.5kg cho bài compound chính hôm nay!`
      );
      setTimeout(() => setScheduledBanner(null), 5000);
      notifySuccess(
        'Sẵn sàng bứt phá PR!',
        'Cơ thể và hệ thần kinh đang ở trạng thái tối ưu (Green Zone).'
      );
    }
  };

  const handleStartActiveSession = (session: PlannedSession) => {
    const weekPlan = calculateMesocycleWeekPlan(activeMesoWeek);
    const initialSets: ActiveSessionState['sets'] = {};
    const effectivePrescriptions = session.prescriptions.map((p) => {
      // If Deload week (Week 5), cut sets by ~45%
      const setsCount = activeMesoWeek === 5 ? Math.max(2, Math.round(p.sets * 0.55)) : p.sets;
      return { ...p, sets: setsCount };
    });

    effectivePrescriptions.forEach((p) => {
      const lastPr = prs[p.exerciseId]?.weightKg || 40;
      const defaultReps = parseInt(p.reps) || 10;
      for (let i = 0; i < p.sets; i++) {
        initialSets[`${p.exerciseId}-${i}`] = {
          weightKg: lastPr,
          reps: defaultReps,
          completed: false,
          setType: i === 0 && p.sets > 3 ? 'warmup' : 'normal',
          rpe: weekPlan.targetRpe,
          rir: weekPlan.targetRir,
        };
      }
    });
    setActiveSession({
      planned: session,
      prescriptions: effectivePrescriptions,
      startedAt: Date.now(),
      sets: initialSets,
    });
    setActiveSessionDirty(false);
    setElapsedSeconds(0);
    setRestSecondsLeft(null);
    setIsSessionMinimized(false);
  };

  const handleAddSetToExercise = (exerciseId: string) => {
    if (!activeSession) return;
    const existingKeys = Object.keys(activeSession.sets).filter((k) => k.startsWith(`${exerciseId}-`));
    const newIndex = existingKeys.length;
    const lastKey = `${exerciseId}-${newIndex - 1}`;
    const fallbackWeight = prs[exerciseId]?.weightKg || 40;
    const weightKg = activeSession.sets[lastKey]?.weightKg ?? fallbackWeight;
    const reps = activeSession.sets[lastKey]?.reps ?? 10;

    const nextPrescriptions = activeSession.prescriptions.map((p) =>
      p.exerciseId === exerciseId ? { ...p, sets: p.sets + 1 } : p
    );

    setActiveSession({
      ...activeSession,
      prescriptions: nextPrescriptions,
      sets: {
        ...activeSession.sets,
        [`${exerciseId}-${newIndex}`]: {
          weightKg,
          reps,
          completed: false,
        },
      },
    });
  };

  const handleRemoveSetFromExercise = (exerciseId: string, setIndex: number) => {
    if (!activeSession) return;
    const keyToRemove = `${exerciseId}-${setIndex}`;
    const nextSets = { ...activeSession.sets };
    delete nextSets[keyToRemove];

    const nextPrescriptions = activeSession.prescriptions.map((p) =>
      p.exerciseId === exerciseId ? { ...p, sets: Math.max(1, p.sets - 1) } : p
    );

    setActiveSession({
      ...activeSession,
      prescriptions: nextPrescriptions,
      sets: nextSets,
    });
  };

  const handleAddExerciseToActiveSession = (exerciseId: string) => {
    if (!activeSession || !exerciseId) return;
    if (activeSession.prescriptions.some((p) => p.exerciseId === exerciseId)) return;
    const defaultSets = 3;
    const defaultReps = 10;
    const lastPr = prs[exerciseId]?.weightKg || 40;
    const newSets: Record<string, { weightKg: number; reps: number; completed: boolean }> = { ...activeSession.sets };
    for (let i = 0; i < defaultSets; i++) {
      newSets[`${exerciseId}-${i}`] = {
        weightKg: lastPr,
        reps: defaultReps,
        completed: false,
      };
    }
    setActiveSession({
      ...activeSession,
      prescriptions: [
        ...activeSession.prescriptions,
        { exerciseId, sets: defaultSets, reps: '10', rpe: 8, restSeconds: 90 },
      ],
      sets: newSets,
    });
    setActiveSessionDirty(true);
    setExtraExerciseId('');
  };

  const handleSwapExerciseInActiveSession = (oldExerciseId: string, newExerciseId: string) => {
    if (!activeSession || !newExerciseId || oldExerciseId === newExerciseId) return;
    if (activeSession.prescriptions.some((p) => p.exerciseId === newExerciseId)) {
      notifyWarning('Bài tập đã tồn tại', 'Bài tập thay thế đã có sẵn trong buổi tập hiện tại.');
      return;
    }
    const lastPr = prs[newExerciseId]?.weightKg || 40;
    const newSets: typeof activeSession.sets = {};
    Object.entries(activeSession.sets).forEach(([key, val]) => {
      if (key.startsWith(`${oldExerciseId}-`)) {
        const suffix = key.slice(oldExerciseId.length + 1);
        newSets[`${newExerciseId}-${suffix}`] = {
          ...val,
          weightKg: lastPr,
          completed: false,
          isPr: false,
        };
      } else {
        newSets[key] = val;
      }
    });
    setActiveSession({
      ...activeSession,
      prescriptions: activeSession.prescriptions.map((p) =>
        p.exerciseId === oldExerciseId ? { ...p, exerciseId: newExerciseId } : p
      ),
      sets: newSets,
    });
    setActiveSessionDirty(true);
  };

  const handleMoveExerciseInActiveSession = (index: number, direction: 'up' | 'down') => {
    if (!activeSession) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (
      index < 0 ||
      index >= activeSession.prescriptions.length ||
      targetIdx < 0 ||
      targetIdx >= activeSession.prescriptions.length
    ) {
      return;
    }
    const nextPrescriptions = [...activeSession.prescriptions];
    const [moved] = nextPrescriptions.splice(index, 1);
    nextPrescriptions.splice(targetIdx, 0, moved);
    setActiveSession({
      ...activeSession,
      prescriptions: nextPrescriptions,
    });
    setActiveSessionDirty(true);
  };

  const handleUpdateSet = (exerciseId: string, setIndex: number, weightKg: number, reps: number) => {
    if (!activeSession) return;
    const key = `${exerciseId}-${setIndex}`;
    setActiveSession({
      ...activeSession,
      sets: {
        ...activeSession.sets,
        [key]: {
          ...(activeSession.sets[key] || { completed: false }),
          weightKg,
          reps,
        },
      },
    });
  };

  const handleToggleSet = (exerciseId: string, setIndex: number, restSeconds: number) => {
    if (!activeSession) return;
    const key = `${exerciseId}-${setIndex}`;
    const cur = activeSession.sets[key];
    const willBeCompleted = !cur?.completed;
    const curPr = prs[exerciseId]?.weightKg || 0;
    const isNewPr = willBeCompleted && cur && cur.weightKg > curPr && curPr > 0;

    setActiveSession({
      ...activeSession,
      sets: {
        ...activeSession.sets,
        [key]: {
          ...cur,
          completed: willBeCompleted,
          isPr: isNewPr,
        },
      },
    });

    if (willBeCompleted) {
      if (isNewPr) {
        triggerHaptic('success');
        notifySuccess('Kỷ Lục Mới (PR)! ⭐', `Chúc mừng! Bạn đã vượt kỷ lục bài này với mức tạ ${cur.weightKg}kg!`);
      } else {
        triggerHaptic('light');
      }
      const nextRest = restSeconds || 90;
      setRestTotal(nextRest);
      setRestSecondsLeft(nextRest);
      scheduleRestTimerNotification(nextRest);
    } else {
      cancelRestTimerNotification();
    }
  };

  const handleCycleSetType = (exerciseId: string, setIndex: number) => {
    if (!activeSession) return;
    const key = `${exerciseId}-${setIndex}`;
    const cur = activeSession.sets[key];
    const types: ('normal' | 'warmup' | 'dropset' | 'failure')[] = ['normal', 'warmup', 'dropset', 'failure'];
    const curIdx = types.indexOf(cur?.setType || 'normal');
    const nextType = types[(curIdx + 1) % types.length];
    setActiveSession({
      ...activeSession,
      sets: {
        ...activeSession.sets,
        [key]: {
          ...(cur || { weightKg: 40, reps: 10, completed: false }),
          setType: nextType,
        },
      },
    });
  };

  const handleUpdateRpe = (exerciseId: string, setIndex: number, rpe: number) => {
    if (!activeSession) return;
    const key = `${exerciseId}-${setIndex}`;
    const cur = activeSession.sets[key];
    setActiveSession({
      ...activeSession,
      sets: {
        ...activeSession.sets,
        [key]: {
          ...(cur || { weightKg: 40, reps: 10, completed: false }),
          rpe,
          rir: Math.max(0, 10 - rpe),
        },
      },
    });
  };

  const handleCopyPrevSet = (exerciseId: string, setIndex: number) => {
    if (!activeSession || setIndex <= 0) return;
    const prevKey = `${exerciseId}-${setIndex - 1}`;
    const prev = activeSession.sets[prevKey];
    if (prev) {
      handleUpdateSet(exerciseId, setIndex, prev.weightKg, prev.reps);
    }
  };

  const handleApplyQuickScale = (
    exerciseId: string,
    setIndex: number,
    factor: number,
    targetSetType?: 'normal' | 'warmup' | 'dropset' | 'failure'
  ) => {
    if (!activeSession) return;
    const pres = activeSession.prescriptions.find((p) => p.exerciseId === exerciseId);
    const setCount = pres?.sets || 1;
    const safeIdx = Math.max(0, Math.min(setIndex, setCount - 1));
    const key = `${exerciseId}-${safeIdx}`;
    const cur = activeSession.sets[key];

    let refWeight = cur?.weightKg || prs[exerciseId]?.weightKg || 40;
    if (targetSetType === 'dropset' && safeIdx > 0) {
      const prevSet = activeSession.sets[`${exerciseId}-${safeIdx - 1}`];
      if (prevSet && prevSet.weightKg > refWeight) {
        refWeight = prevSet.weightKg;
      }
    } else if (targetSetType === 'warmup') {
      let maxWorking = 0;
      for (let i = 0; i < setCount; i++) {
        const st = activeSession.sets[`${exerciseId}-${i}`];
        if (st && st.setType !== 'warmup' && st.weightKg > maxWorking) {
          maxWorking = st.weightKg;
        }
      }
      if (maxWorking > 0) {
        refWeight = maxWorking;
      } else if (prs[exerciseId]?.weightKg && cur?.setType === 'warmup') {
        refWeight = prs[exerciseId].weightKg;
      }
    }

    const newWeight = Math.max(2.5, Math.round(refWeight * factor * 2) / 2);
    setActiveSession({
      ...activeSession,
      sets: {
        ...activeSession.sets,
        [key]: {
          ...(cur || { weightKg: 40, reps: 10, completed: false }),
          weightKg: newWeight,
          reps: cur?.reps || 10,
          completed: false,
          ...(targetSetType ? { setType: targetSetType } : {}),
        },
      },
    });
  };

  const handleApplyDeloadWeek = () => {
    if (plannedSessions.length === 0) return;
    if (!confirm('Bạn có muốn kích hoạt Tuần Deload? Số sets của các bài tập sẽ được giảm 40% để khớp và hệ thần kinh hồi phục mà không làm mất cơ bắp.')) return;

    plannedSessions.forEach((session) => {
      const updatedPrescriptions = session.prescriptions.map((p) => ({
        ...p,
        sets: Math.max(2, Math.round(p.sets * 0.6)),
      }));
      onUpdatePlannedSession?.({
        ...session,
        prescriptions: updatedPrescriptions,
      });
    });

    notifySuccess('Đã kích hoạt Tuần Deload!', 'Các bài tập đã được giảm số hiệp (-40%). Hãy tập trung vào kỹ thuật, kiểm soát nhịp tạ và phục hồi!');
  };

  const handleFinishActiveSession = () => {
    if (!activeSession) return;
    const today = todayString();
    const sets = Object.entries(activeSession.sets)
      .filter(([_, s]) => s.completed)
      .map(([key, s], idx) => {
        const [exerciseId, setIdx] = key.split('-');
        return {
          id: `s-${Date.now()}-${idx}`,
          exerciseId,
          setIndex: parseInt(setIdx) || 0,
          weightKg: s.weightKg,
          reps: s.reps,
          rpe: s.rpe || 8,
          rir: s.rir ?? (s.rpe ? 10 - s.rpe : 2),
          setType: s.setType || 'normal',
          isPr: s.isPr,
        };
      });

    const burnedKcal = activeWorkoutStats.kcal || 250;

    onLogWorkoutSession({
      date: today,
      sessionId: activeSession.planned.id,
      title: activeSession.planned.title,
      startedAt: activeSession.startedAt,
      finishedAt: Date.now(),
      sets: sets.length > 0 ? sets : activeSession.prescriptions.flatMap((p, pIdx) =>
        Array.from({ length: p.sets }, (_, sIdx) => ({
          id: `s-${Date.now()}-${pIdx}-${sIdx}`,
          exerciseId: p.exerciseId,
          setIndex: sIdx,
          weightKg: 40,
          reps: 10,
          rpe: p.rpe,
        }))
      ),
      note: `Tập trực tiếp với đồng hồ nghỉ: ${Math.round(elapsedSeconds / 60)} phút, hoàn thành ${sets.length} hiệp, đốt ~${burnedKcal} kcal.`,
    });

    // Auto-sync burned calories to Health Day Log
    if (onUpsertHealthLog) {
      const existing = (healthLogs || []).find((l) => l.date === today);
      const prevBurn = existing?.caloriesBurned || 0;
      onUpsertHealthLog({
        ...(existing || { date: today, source: 'manual' }),
        caloriesBurned: prevBurn + burnedKcal,
        date: today,
        source: 'manual',
      });
    }

    if (autoScheduleOnFinish && onScheduleSessionToCalendar) {
      onScheduleSessionToCalendar(activeSession.planned.title, today, '#E11D48');
    }

    if (activeSessionDirty && onUpdatePlannedSession) {
      setPendingPlanSync({
        planned: activeSession.planned,
        updatedPrescriptions: activeSession.prescriptions,
      });
    }
    setActiveSessionDirty(false);
    setActiveSession(null);
    setRestSecondsLeft(null);
    setScheduledBanner(`Xuất sắc! Đã hoàn thành buổi tập "${activeSession.planned.title}" (+${burnedKcal} kcal tiêu hao)!`);
    setTimeout(() => setScheduledBanner(null), 4000);
    notifySuccess('Xuất sắc! Hoàn thành buổi tập!', `Đã hoàn thành "${activeSession.planned.title}" (+${burnedKcal} kcal tiêu hao)!`);
  };

  const activeWorkoutStats = useMemo(() => {
    if (!activeSession) return { volumeKg: 0, kcal: 0, completedCount: 0, totalCount: 0 };
    const completedSets = Object.values(activeSession.sets).filter((s) => s.completed);
    const volumeKg = completedSets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
    const setLogs = completedSets.map((s, idx) => ({
      id: `s-${idx}`,
      exerciseId: 'bench-press',
      setIndex: idx,
      weightKg: s.weightKg,
      reps: s.reps,
    }));
    const kcal = gymCalories(setLogs, userWeightKg);
    return {
      volumeKg,
      kcal,
      completedCount: completedSets.length,
      totalCount: Object.keys(activeSession.sets).length,
    };
  }, [activeSession, userWeightKg]);

  const sessionGapIds = useMemo(() => findSessionDetailGaps(workoutSessions), [workoutSessions]);

  const volumeData = useMemo(() => {
    const raw = weeklyVolume(workoutSessions, 4, todayString());
    return raw.map((r, i) => ({
      label: `T${i + 1} (${r.weekStart.slice(5)})`,
      value: r.volume,
      color: i === raw.length - 1 ? '#2563EB' : '#2f86e8',
    }));
  }, [workoutSessions]);

  const muscleSets = useMemo(() => {
    return setsByMuscle(workoutSessions, allExercises);
  }, [workoutSessions, allExercises]);

  // CTG & Renaissance Periodization Muscle Volume Landmarks
  const muscleVolumeLandmarks = useMemo(() => {
    return calculateMuscleVolumeLandmarks(workoutSessions, 7);
  }, [workoutSessions]);

  const monthCalendarData = useMemo(() => {
    const [yStr, mStr] = calendarMonth.split('-');
    const year = Number(yStr);
    const month = Number(mStr);
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month, 0).getDate();

    const workoutByDate = new Map<string, WorkoutSession[]>();
    workoutSessions.forEach((w) => {
      const arr = workoutByDate.get(w.date) || [];
      arr.push(w);
      workoutByDate.set(w.date, arr);
    });

    const sportByDate = new Map<string, SportSession[]>();
    sportSessions.forEach((s) => {
      const arr = sportByDate.get(s.date) || [];
      arr.push(s);
      sportByDate.set(s.date, arr);
    });

    const days = [];
    const startOffset = (firstDayOfWeek + 6) % 7; // Monday as 0
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${calendarMonth}-${String(d).padStart(2, '0')}`;
      const ws = workoutByDate.get(dStr) || [];
      const ss = sportByDate.get(dStr) || [];
      days.push({
        dayNumber: d,
        dateStr: dStr,
        hasWorkout: ws.length > 0,
        hasSport: ss.length > 0,
        workouts: ws,
        sports: ss,
        isToday: dStr === todayString(),
      });
    }

    const totalTrainedDaysInMonth = days.filter((d) => d && (d.hasWorkout || d.hasSport)).length;

    return {
      year,
      month,
      days,
      daysInMonth,
      totalTrainedDaysInMonth,
      monthLabel: `Tháng ${month}/${year}`,
    };
  }, [calendarMonth, workoutSessions, sportSessions]);

  const workoutStreak = useMemo(() => {
    const dateSet = new Set([
      ...workoutSessions.map((w) => w.date),
      ...sportSessions.map((s) => s.date),
    ]);
    let streak = 0;
    const d = new Date();
    const today = todayString();
    if (!dateSet.has(today)) {
      d.setDate(d.getDate() - 1);
    }
    while (dateSet.has(d.toISOString().slice(0, 10))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }, [workoutSessions, sportSessions]);

  const handleShiftCalendarMonth = (delta: number) => {
    const [yStr, mStr] = calendarMonth.split('-');
    const d = new Date(Number(yStr), Number(mStr) - 1 + delta, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setCalendarMonth(newMonth);
  };

  const handleSavePastWorkout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastTitle.trim() || !pastDate) return;

    const burnedKcal = Number(pastBurnedKcal) || 220;
    const sets = [
      {
        id: `s-${Date.now()}-1`,
        exerciseId: 'bench-press',
        setIndex: 0,
        weightKg: 50,
        reps: 10,
      },
    ];

    onLogWorkoutSession({
      date: pastDate,
      title: pastTitle.trim(),
      startedAt: Date.now() - (Number(pastDuration) || 50) * 60_000,
      finishedAt: Date.now(),
      sets,
      note: pastNotes.trim() || `Tập ${pastDuration} phút, đốt ~${burnedKcal} kcal.`,
    });

    if (onUpsertHealthLog) {
      const existing = (healthLogs || []).find((l) => l.date === pastDate);
      const prevBurn = existing?.caloriesBurned || 0;
      onUpsertHealthLog({
        ...(existing || { date: pastDate, source: 'manual' }),
        caloriesBurned: prevBurn + burnedKcal,
        date: pastDate,
        source: 'manual',
      });
    }

    setShowLogPastWorkoutModal(false);
    setScheduledBanner(`Đã ghi nhận buổi tập "${pastTitle.trim()}" cho ngày ${pastDate} (+${burnedKcal} kcal)!`);
    setTimeout(() => setScheduledBanner(null), 4000);
    notifySuccess('Đã lưu buổi tập!', `Đã ghi nhận "${pastTitle.trim()}" cho ngày ${pastDate} (+${burnedKcal} kcal)!`);
  };

  const handleSchedule = async (session: PlannedSession) => {
    const DAY_MAP: Record<string, number> = {
      'Thứ 2': 0, 'Thứ 3': 1, 'Thứ 4': 2, 'Thứ 5': 3, 'Thứ 6': 4, 'Thứ 7': 5, 'Chủ Nhật': 6,
    };
    const dayIdx = session.dayIndex !== undefined ? session.dayIndex : (session.dayOfWeek ? (DAY_MAP[session.dayOfWeek] ?? 0) : 0);

    const now = new Date();
    const currentDay = now.getDay();
    const diffToMonday = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diffToMonday);

    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + dayIdx);
    const targetDateStr = formatDateString(targetDate);

    const resolution = resolveNonConflictingSlot(targetDateStr, '17:30', 75, events, {
      maxHour: 23,
      bufferMinutes: 15,
    });

    if (resolution.status === 'conflict') {
      const names = resolution.remainingConflicts
        .map((c) => `"${c.title}" (${c.startTime}–${c.endTime})`)
        .join(', ');
      const ok = window.confirm(
        `Cảnh báo trùng lịch vào ngày ${targetDateStr} lúc 17:30–18:45 với ${names} và không còn khung trống 75 phút phù hợp trong ngày. Bạn vẫn muốn thêm buổi tập "${session.title}" chứ?`
      );
      if (!ok) return;
    }

    const newEvent: CalendarEvent = {
      id: `scheduled-wo-${Date.now()}`,
      title: `[ZENOX] ${session.title}`,
      description: `Giáo án ZENOX (${session.dayOfWeek || 'Buổi tập'}):\n${session.prescriptions.map((p) => `• ${p.exerciseId} (${p.sets}x${p.reps})`).join('\n')}\nĐã lên lịch tối ưu bởi ZENOX.`,
      startDate: targetDateStr,
      startTime: resolution.startTime,
      endDate: targetDateStr,
      endTime: resolution.endTime,
      allDay: false,
      calendarId: 'health',
      color: '#E11D48',
      type: 'event',
      isCompleted: false,
      createdAt: Date.now(),
    };

    if (onBatchScheduleToCalendar) {
      await onBatchScheduleToCalendar([newEvent]);
    } else if (onScheduleSessionToCalendar) {
      onScheduleSessionToCalendar(session.title, targetDateStr, '#E11D48');
    }

    if (resolution.status === 'shifted') {
      const avoided = resolution.conflictingEvents.map((e) => e.title).join(', ');
      setScheduledBanner(
        `Đã tự dời "${session.title}" sang ${resolution.startTime}–${resolution.endTime} ngày ${targetDateStr} để tránh trùng "${avoided}".`
      );
      notifyWarning(
        'Đã tự dời né trùng lịch',
        `Khung 17:30 trùng "${avoided}" nên "${session.title}" được xếp sang ${resolution.startTime}–${resolution.endTime}.`
      );
    } else {
      setScheduledBanner(
        `Đã lên lịch "${session.title}" vào ngày ${targetDateStr} (${resolution.startTime} - ${resolution.endTime})!`
      );
      notifySuccess(
        'Đã lên lịch thành công!',
        `"${session.title}" vào ${session.dayOfWeek || 'Lịch'} (${targetDateStr}) ${resolution.startTime} - ${resolution.endTime}.`
      );
    }
    setTimeout(() => setScheduledBanner(null), 5000);
  };

  const handleScheduleFullWeek = async () => {
    if (plannedSessions.length === 0) return;
    if (!onBatchScheduleToCalendar && !onScheduleSessionToCalendar) return;

    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.getFullYear(), now.getMonth(), diff);

    const newEvents: CalendarEvent[] = [];
    const scheduledSoFar: CalendarEvent[] = [];
    let shiftedCount = 0;
    const conflictSummary: string[] = [];

    plannedSessions.forEach((session, idx) => {
      const sessionDate = new Date(monday);
      const dayOffset = session.dayIndex !== undefined ? session.dayIndex : idx;
      sessionDate.setDate(monday.getDate() + dayOffset);
      const dateStr = formatDateString(sessionDate);

      const resolution = resolveNonConflictingSlot(
        dateStr,
        '17:30',
        75,
        [...events, ...scheduledSoFar],
        { maxHour: 23, bufferMinutes: 15 }
      );

      if (resolution.status === 'shifted') shiftedCount++;
      if (resolution.status === 'conflict') {
        const names = resolution.remainingConflicts.map((c) => c.title).join(', ');
        conflictSummary.push(`${dateStr} (${session.title} ↔ ${names})`);
      }

      const ev: CalendarEvent = {
        id: `scheduled-wo-${Date.now()}-${idx}`,
        title: `[ZENOX] ${session.title}`,
        description: `Giáo án ZENOX (${session.dayOfWeek || 'Buổi tập'}):\n${session.prescriptions.map((p) => `• ${p.exerciseId} (${p.sets}x${p.reps})`).join('\n')}`,
        startDate: dateStr,
        startTime: resolution.startTime,
        endDate: dateStr,
        endTime: resolution.endTime,
        allDay: false,
        calendarId: 'health',
        color: '#E11D48',
        type: 'event',
        isCompleted: false,
        createdAt: Date.now(),
      };
      newEvents.push(ev);
      scheduledSoFar.push(ev);
    });

    if (conflictSummary.length > 0) {
      const ok = window.confirm(
        `Cảnh báo: Có ${conflictSummary.length} buổi không còn khung trống trong ngày và vẫn trùng lịch (${conflictSummary.join('; ')}). Bạn có muốn tiếp tục đồng bộ không, hay mở "Lên Lịch Thông Minh" để chọn giờ riêng?`
      );
      if (!ok) return;
    }

    if (onBatchScheduleToCalendar) {
      await onBatchScheduleToCalendar(newEvents);
    } else if (onScheduleSessionToCalendar) {
      newEvents.forEach((ev) => onScheduleSessionToCalendar(ev.title.replace(/^\[ZENOX\]\s*/, ''), ev.startDate, '#E11D48'));
    }

    const extraNote = shiftedCount > 0 ? ` (${shiftedCount} buổi được tự động dời sang giờ trống để tránh trùng lịch)` : '';
    setScheduledBanner(`Đã đồng bộ ${newEvents.length} buổi tập tuần này lên Lịch${extraNote}!`);
    if (shiftedCount > 0) {
      notifyWarning('Đồng bộ hoàn tất (có dời lịch)', `${shiftedCount}/${newEvents.length} buổi đã tự động chọn giờ trống tránh trùng lịch học/làm.`);
    } else {
      notifySuccess('Đã đồng bộ lịch tập tuần!', `Đã xếp ${newEvents.length} buổi tập đều khung giờ.`);
    }
    setTimeout(() => setScheduledBanner(null), 5000);
  };

  const handleSaveCustomExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExName.trim()) return;
    onAddCustomExercise?.({
      name: newExName.trim(),
      muscle: newExMuscle,
      equipment: newExEquipment.trim() || 'Tự do',
      cue: newExCue.trim() || 'Tập trung cảm nhận cơ bắp',
      isCustom: true,
    });
    setScheduledBanner(`Đã thêm bài tập ngoài "${newExName.trim()}" vào thư viện!`);
    setTimeout(() => setScheduledBanner(null), 4000);
    setShowAddExerciseModal(false);
    setNewExName('');
    setNewExCue('');
  };

  const handleQuickLog = (session: PlannedSession) => {
    const today = todayString();
    const sets = session.prescriptions.flatMap((p, pIdx) =>
      Array.from({ length: p.sets }, (_, sIdx) => ({
        id: `s-${Date.now()}-${pIdx}-${sIdx}`,
        exerciseId: p.exerciseId,
        setIndex: sIdx,
        weightKg: 50,
        reps: 10,
        rpe: p.rpe,
      }))
    );

    const burnedKcal = gymCalories(sets, userWeightKg) || 220;

    onLogWorkoutSession({
      date: today,
      sessionId: session.id,
      title: session.title,
      startedAt: Date.now() - 60 * 60_000,
      finishedAt: Date.now(),
      sets,
      note: 'Hoàn thành theo giáo án thể hình cá nhân.',
    });

    if (onUpsertHealthLog) {
      const existing = (healthLogs || []).find((l) => l.date === today);
      const prevBurn = existing?.caloriesBurned || 0;
      onUpsertHealthLog({
        ...(existing || { date: today, source: 'manual' }),
        caloriesBurned: prevBurn + burnedKcal,
        date: today,
        source: 'manual',
      });
    }

    setScheduledBanner(`Đã ghi nhận hoàn thành buổi tập "${session.title}" (+${burnedKcal} kcal tiêu hao)!`);
    setTimeout(() => setScheduledBanner(null), 4000);
    notifySuccess('Hoàn thành buổi tập!', `Đã ghi nhận "${session.title}" (+${burnedKcal} kcal tiêu hao)!`);
  };

  const handleAddSport = (e: React.FormEvent) => {
    e.preventDefault();
    const dur = Number(sportDuration);
    if (!dur || dur <= 0) return;

    const burnedKcal = sportCalories({ type: sportType, durationMin: dur } as SportSession, userWeightKg) || 160;

    onAddSportSession({
      date: sportDate,
      type: sportType,
      durationMin: dur,
      note: sportNote.trim() || undefined,
    });

    if (onUpsertHealthLog) {
      const existing = (healthLogs || []).find((l) => l.date === sportDate);
      const prevBurn = existing?.caloriesBurned || 0;
      onUpsertHealthLog({
        ...(existing || { date: sportDate, source: 'manual' }),
        caloriesBurned: prevBurn + burnedKcal,
        date: sportDate,
        source: 'manual',
      });
    }

    setShowSportModal(false);
    setSportNote('');
    setScheduledBanner(`Đã thêm buổi "${SPORT_LABEL[sportType]}" (${dur} phút, +${burnedKcal} kcal)!`);
    setTimeout(() => setScheduledBanner(null), 4000);
    notifySuccess('Đã lưu tập luyện thể thao!', `Buổi tập "${SPORT_LABEL[sportType]}" (${dur} phút, +${burnedKcal} kcal) đã được lưu.`);
  };

  const filteredExercises = allExercises.filter(
    (e) =>
      e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
      MUSCLE_LABEL[e.muscle]?.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  // Live Workout Workstation Full View (ZENOX dedicated workstation view)
  if (activeSession && !isSessionMinimized) {
    return (
      <LiveWorkoutSessionView
        activeSession={activeSession}
        activeMesoWeek={activeMesoWeek}
        elapsedSeconds={elapsedSeconds}
        restSecondsLeft={restSecondsLeft}
        prs={prs}
        workoutSessions={workoutSessions}
        onUpdateSet={handleUpdateSet}
        onToggleSet={handleToggleSet}
        onCycleSetType={handleCycleSetType}
        onUpdateRpe={handleUpdateRpe}
        onCopyPrevSet={handleCopyPrevSet}
        onApplyQuickScale={handleApplyQuickScale}
        onAddSet={handleAddSetToExercise}
        onRemoveSet={handleRemoveSetFromExercise}
        onAddExercise={handleAddExerciseToActiveSession}
        onSwapExercise={handleSwapExerciseInActiveSession}
        onMoveExercise={handleMoveExerciseInActiveSession}
        onInspectExercise={(id) => setInspectingExerciseId(id)}
        onFinishSession={handleFinishActiveSession}
        onCancelSession={() => {
          setActiveSession(null);
          setActiveSessionDirty(false);
          setRestSecondsLeft(null);
          setIsSessionMinimized(false);
        }}
        onMinimize={() => setIsSessionMinimized(true)}
        onOpenPlateCalculator={(w) => {
          setPlateTargetTotal(String(w));
          setCalcTab('plates');
          setShowCalculatorModal(true);
        }}
        onAdjustRestTimer={(delta) =>
          setRestSecondsLeft((s) => {
            const next = s !== null ? Math.max(0, s + delta) : delta;
            if (next > 0) scheduleRestTimerNotification(next);
            else cancelRestTimerNotification();
            return next;
          })
        }
        onSkipRestTimer={() => {
          setRestSecondsLeft(null);
          cancelRestTimerNotification();
        }}
        onSetRestTimerTotal={setRestTotal}
        customExercises={customExercises}
        lang={lang}
      />
    );
  }

  return (
    <div className="space-y-6">
      {pendingPlanSync && (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/90 dark:bg-indigo-950/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 shrink-0">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-indigo-950 dark:text-indigo-100">
                Lịch tập "{pendingPlanSync.planned.title}" đã thay đổi trong lúc tập ({pendingPlanSync.planned.prescriptions.length} → {pendingPlanSync.updatedPrescriptions.length} bài)
              </div>
              <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 mt-0.5">
                Bạn có muốn cập nhật thứ tự hoặc bài tập thay thế này vào giáo án gốc cho các tuần sau không?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (onUpdatePlannedSession) {
                  onUpdatePlannedSession({
                    ...pendingPlanSync.planned,
                    prescriptions: pendingPlanSync.updatedPrescriptions,
                  });
                  notifySuccess('Đã đồng bộ giáo án!', `Cập nhật cấu trúc bài tập cho "${pendingPlanSync.planned.title}".`);
                }
                setPendingPlanSync(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              Áp dụng cho giáo án
            </button>
            <button
              type="button"
              onClick={() => setPendingPlanSync(null)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-white/[0.06] border border-indigo-200 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-200 text-xs font-medium hover:bg-indigo-100/60 dark:hover:bg-white/[0.1] cursor-pointer transition-colors"
            >
              Chỉ giữ buổi này
            </button>
          </div>
        </div>
      )}

      {/* CTG Active Phase Training Guidance Card (Có thể ẩn / hiện theo nhu cầu) */}
      {ctgActivePhase && showCtgGuidance && (
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-zinc-100 relative">
          <div className="flex items-start gap-3.5 pr-8 md:pr-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Giai Đoạn ZENOX Hiện Tại
                </span>
                <span className="text-xs text-white/50 font-mono">
                  {ctgActivePhase.startDate} – {ctgActivePhase.endDate}
                </span>
                <span className="text-xs font-bold text-white">
                  · {ctgActivePhase.name} ({ctgActivePhase.phaseType === 'bulk' ? 'Tăng cơ' : ctgActivePhase.phaseType === 'minicut' ? 'Mini-cut' : 'Giảm mỡ'})
                </span>
                {plannedSessions.length > 0 && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ✓ {lang === 'vi' ? `Bạn đang có lịch riêng (${plannedSessions.length} buổi)` : `Custom routine (${plannedSessions.length})`}
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-100/80 mt-1 leading-relaxed">
                {ctgActivePhase.phaseType === 'bulk' ? (
                  <span>
                    <strong>Chiến lược Tăng cơ (Hypertrophy Wave):</strong> Tận dụng thặng dư calo để tối ưu hóa phì đại cơ bắp. Ưu tiên Progressive Overload (tăng tạ/reps mỗi tuần), giữ RPE 7-9 (1-3 reps dự trữ), ngủ đủ 7-8h mỗi đêm.
                  </span>
                ) : (
                  <span>
                    <strong>Chiến lược Giữ cơ trong Thâm hụt (Preserve Lean Mass):</strong> Duy trì cường độ tạ nặng (Heavy Lifting) để gửi tín hiệu bảo toàn cơ nạc, kiểm soát volume hợp lý (8-14 sets/nhóm cơ/tuần), tránh tập đến kiệt quệ hoàn toàn (RPE 8-8.5).
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            {onApplySplitTemplate && (
              <button
                type="button"
                onClick={() => {
                  const suggested = ctgActivePhase.phaseType === 'bulk' ? 'ppl' : 'upper_lower';
                  if (plannedSessions.length > 0) {
                    const confirmMsg = lang === 'vi'
                      ? `Bạn hiện đã có ${plannedSessions.length} buổi tập trong lịch cá nhân. Nạp giáo án mẫu (${suggested.toUpperCase()}) sẽ thay thế lịch tập hiện tại. Bạn có chắc chắn muốn nạp lại không?`
                      : `You already have ${plannedSessions.length} planned sessions. Applying preset (${suggested.toUpperCase()}) will replace your schedule. Proceed?`;
                    if (!window.confirm(confirmMsg)) return;
                  }
                  onApplySplitTemplate(suggested);
                  notifySuccess(
                    lang === 'vi' ? 'Đã áp dụng giáo án tối ưu!' : 'Preset applied!',
                    lang === 'vi' ? `Đã nạp giáo án (${suggested.toUpperCase()}) cho giai đoạn ${ctgActivePhase.name}!` : `Applied ${suggested.toUpperCase()} template.`
                  );
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1.5"
                title={plannedSessions.length > 0 ? (lang === 'vi' ? 'Lưu ý: Sẽ hỏi xác nhận trước khi thay thế lịch tập hiện tại' : 'Will confirm before replacing schedule') : undefined}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Nạp Giáo Án Tối Ưu ({ctgActivePhase.phaseType === 'bulk' ? 'PPL' : 'Upper/Lower'})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleToggleCtgGuidance(false)}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title={lang === 'vi' ? 'Ẩn gợi ý này (không làm phiền lịch tập)' : 'Hide guidance'}
              aria-label={lang === 'vi' ? 'Ẩn gợi ý' : 'Hide'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-white/[0.08] p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white">
              Giáo Án Kháng Lực Cá Nhân
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Phân chia Upper / Lower · 4 buổi/tuần
            </span>
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            Lịch Tập &amp; Giáo Án Kháng Lực
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Tích hợp trực tiếp với Google Calendar: Lên lịch buổi tập chỉ với 1 click.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {ctgActivePhase && (
            <button
              type="button"
              onClick={() => handleToggleCtgGuidance(!showCtgGuidance)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors shadow-2xs ${
                showCtgGuidance
                  ? 'border-blue-400/40 bg-blue-50/70 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
              title={showCtgGuidance ? (lang === 'vi' ? 'Thu gọn / Ẩn gợi ý chiến lược ZENOX' : 'Hide ZENOX guidance') : (lang === 'vi' ? 'Mở lại gợi ý chiến lược tập luyện theo giai đoạn ZENOX' : 'Show ZENOX guidance')}
            >
              <Compass className="w-4 h-4 text-blue-500" />
              <span>{showCtgGuidance ? (lang === 'vi' ? 'Ẩn gợi ý ZENOX' : 'Hide ZENOX') : (lang === 'vi' ? `Gợi ý ZENOX (${ctgActivePhase.name})` : 'ZENOX Guidance')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCalculatorModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-orange-300 dark:border-orange-800/60 bg-orange-50/70 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 text-xs font-semibold hover:bg-orange-100 dark:hover:bg-orange-900/40 cursor-pointer transition-colors shadow-2xs"
            title="Tính 1RM tối đa & Máy tính xếp bánh tạ đòn Olympic"
          >
            <Calculator className="w-4 h-4 text-orange-500" />
            <span>1RM &amp; Đĩa Tạ</span>
          </button>
          <button
            onClick={() => setShowLibraryModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-blue-500" />
            <span>Thư viện bài tập</span>
          </button>
          <button
            onClick={() => setShowSportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm thể thao (MET)</span>
          </button>
        </div>
      </div>

      {/* Notification banner */}
      {scheduledBanner && (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{scheduledBanner}</span>
        </div>
      )}

      {/* Training Readiness & Autoregulation Check-in / Scientific Split Quality */}
      <TrainingReadinessAutoregulator
        plannedSessions={plannedSessions}
        customExercises={customExercises}
        onApplyReadinessAdjustment={handleApplyReadinessAdjustment}
      />

      {/* ZENOX 7-Day Split Matrix & Muscle Recovery Radar */}
      <TrackedScheduleMatrix
        plannedSessions={plannedSessions}
        workoutSessions={workoutSessions}
        activePhase={ctgActivePhase || undefined}
        onStartSession={handleStartActiveSession}
        onScheduleToCalendar={handleSchedule}
        onQuickLog={handleQuickLog}
        onOpenSyncStudio={() => setShowCalendarSyncModal(true)}
        onSelectSplit={(s) => {
          setCurrentSplit(s);
          onApplySplitTemplate?.(s);
          setScheduledBanner(`Đã chuyển lịch tập sang ${s.toUpperCase()}!`);
          setTimeout(() => setScheduledBanner(null), 4000);
        }}
        currentSplit={currentSplit}
        lang={lang}
      />

      {/* ZENOX Deload & Fatigue Management Advisor */}
      <CtgDeloadAdvisor
        workoutSessions={workoutSessions}
        activePhase={ctgActivePhase}
        onApplyDeloadWeek={handleApplyDeloadWeek}
        lang={lang}
      />

      {/* Routine Split Selector & Week Synchronizer */}
      <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-gray-100 dark:border-white/[0.08] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                Chọn Lịch Tập &amp; Phân Chia Nhóm Cơ (Splits)
              </h3>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Chuyển đổi tức thì giữa các phân chia giáo án thể hình kinh điển hoặc tự tạo buổi tập riêng
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setShowCalendarSyncModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-100 border border-zinc-700/60 dark:border-white/10 text-xs font-semibold cursor-pointer transition-colors"
              title="Đồng bộ lịch tập sang Google Calendar"
            >
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span>Đồng bộ Google Calendar</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSmartImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-100 border border-zinc-700/60 dark:border-white/10 text-xs font-semibold cursor-pointer transition-colors"
              title="Nhập buổi tập bằng cú pháp text hoặc file CSV"
            >
              <Upload className="w-3.5 h-3.5 text-zinc-400" />
              <span>Nhập text / file</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddExerciseModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-100 border border-zinc-700/60 dark:border-white/10 text-xs font-semibold cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-zinc-400" />
              <span>Thêm bài tập</span>
            </button>
          </div>
        </div>

        {/* Preset Split Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ppl' as const, label: 'PPL (Push - Pull - Legs)', desc: '5 buổi: Đẩy / Kéo / Chân' },
            { id: 'upper_lower' as const, label: 'Upper / Lower (UL)', desc: '4 buổi: Thân Trên / Thân Dưới' },
            { id: 'bro_split' as const, label: 'Bro Split (5 Ngày)', desc: '5 buổi: Ngực / Lưng / Vai / Chân / Tay' },
            { id: 'ppl_arnold' as const, label: 'PPL x Arnold (6 Ngày)', desc: '6 buổi: Hybrid Siêu Phì Đại' },
            { id: 'arnold' as const, label: 'Arnold Split', desc: '6 buổi: Ngực+Lưng / Vai+Tay / Chân' },
            { id: 'calisthenics' as const, label: 'Calisthenics (4 Ngày)', desc: '4 buổi: Bodyweight & Sức mạnh xà' },
            { id: 'glute_lower' as const, label: 'Glute & Lower Focus', desc: '4 buổi: Mông, Đùi Sau, Đùi Trước & Eo' },
            { id: 'fullbody' as const, label: 'Full Body 3x', desc: '3 buổi: Toàn Thân A / B / C' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setCurrentSplit(s.id);
                onApplySplitTemplate?.(s.id);
                setScheduledBanner(`Đã tạo và nạp thành công lịch tập ${s.label}!`);
                setTimeout(() => setScheduledBanner(null), 4000);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer shrink-0 text-left ${
                currentSplit === s.id
                  ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-slate-200 dark:border-white/[0.1] hover:bg-gray-100 dark:hover:bg-gray-700/60'
              }`}
            >
              <div className="font-bold">{s.label}</div>
              <div className="text-[10px] opacity-75">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Mesocycle Planned Sessions Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-orange-500" />
            Giáo Án Kháng Lực Đang Áp Dụng (Mesocycle)
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPlanTitle('');
                setPlanDayOfWeek('Thứ 2');
                setPlanPrescriptions([
                  { exerciseId: 'bench-press', sets: 4, reps: '8-10', rpe: 8, restSeconds: 90 },
                  { exerciseId: 'incline-dumbbell-press', sets: 3, reps: '10-12', rpe: 8, restSeconds: 75 },
                ]);
                setShowAddPlanModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo Giáo Án Mới</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plannedSessions.map((session) => (
            <div
              key={session.id}
              className="bg-white dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {session.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {session.dayOfWeek && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                        {session.dayOfWeek}
                      </span>
                    )}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      {session.prescriptions.length} bài tập
                    </span>
                    {onDeletePlannedSession && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Bạn có chắc muốn xóa giáo án "${session.title}"?`)) {
                            onDeletePlannedSession(session.id);
                          }
                        }}
                        className="p-1 rounded-lg text-gray-300 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer ml-0.5 transition-colors"
                        title="Xóa giáo án này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 my-3">
                  {session.prescriptions.map((pres, idx) => {
                    const ex = getExercise(pres.exerciseId);
                    const muscleLabel = ex ? MUSCLE_LABEL[ex.muscle as MuscleGroup] : 'Toàn thân';
                    const muscleColor = ex ? MUSCLE_COLOR[ex.muscle as MuscleGroup] : '#2563EB';

                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-white/[0.08]/80 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 font-semibold text-gray-800 dark:text-gray-200">
                            <span
                              className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase"
                              style={{ backgroundColor: `${muscleColor}22`, color: muscleColor }}
                            >
                              {muscleLabel}
                            </span>
                            <button
                              type="button"
                              onClick={() => setInspectingExerciseId(pres.exerciseId)}
                              className="truncate text-left hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer transition-colors flex items-center gap-1"
                              title="Xem lịch sử E1RM, kỷ lục và ghi chú kỹ thuật"
                            >
                              <span className="truncate">{ex ? ex.name : pres.exerciseId}</span>
                            </button>
                            {pres.supersetId && (
                              <span className="text-[9px] px-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                                Superset
                              </span>
                            )}
                          </div>
                          {ex && (
                            <div className="text-[10px] text-gray-400 italic truncate mt-0.5">
                              {ex.cue}
                            </div>
                          )}
                          {(() => {
                            const curPr = prs[pres.exerciseId];
                            const target = curPr ? calculateProgressiveOverload(curPr.weightKg, curPr.reps, pres.reps) : null;
                            if (!target) return null;
                            return (
                              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                                <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                                <span>Chỉ tiêu tới: <strong>{target.nextWeightKg}kg × {target.nextReps}r</strong> ({target.type === 'weight' ? '+tạ' : '+1 rep'})</span>
                              </div>
                            );
                          })()}
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-bold text-gray-900 dark:text-gray-100">
                            {pres.sets} × {pres.reps}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            RPE {pres.rpe} · Nghỉ {pres.restSeconds}s
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-white/[0.08] flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStartActiveSession(session)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Bắt Đầu Tập Ngay</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSchedule(session)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 cursor-pointer transition-colors"
                  title="Lên lịch vào Google Calendar"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Lên lịch</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLog(session)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold cursor-pointer transition-colors"
                  title="Ghi nhận hoàn thành buổi tập này cho ngày hôm nay"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Xong hôm nay</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Training Volume (Progressive Overload) & Muscle Sets Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly Volume Bar Chart */}
        <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                Khối Lượng Tập Luyện Tuần (Progressive Overload)
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Tổng tải trọng nâng (kg) qua 4 tuần gần nhất
              </p>
            </div>
          </div>

          <BarChart
            data={volumeData}
            height={150}
            color="#2563EB"
            emptyLabel="Chưa có dữ liệu buổi tập nào."
            formatValue={(v) => `${(v / 1000).toFixed(1)} tấn`}
            highlightLast={1}
          />
        </div>

        {/* CTG & Renaissance Periodization Volume Landmarks Card */}
        <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-white/[0.08] pb-2.5">
            <div>
              <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Target className="w-4 h-4 text-rose-500" />
                Thể Tích Tập Luyện Nhóm Cơ (MEV · MAV · MRV)
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Chuẩn khoa học ZENOX Sports Science: MEV (ngưỡng kích hoạt) · MAV (tối ưu tăng cơ) · MRV (ngưỡng quá tải)
              </p>
            </div>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
              7 Ngày Gần Nhất
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {muscleVolumeLandmarks.map((vm) => {
              const isBelowMev = vm.status === 'below_mev';
              const isOptimal = vm.status === 'optimal_mav';
              const isNearMrv = vm.status === 'near_mrv';
              const isExceeded = vm.status === 'exceeded_mrv';

              const barColor = isExceeded
                ? '#EF4444'
                : isNearMrv
                ? '#F59E0B'
                : isOptimal
                ? '#10B981'
                : '#94A3B8';

              return (
                <div
                  key={vm.muscle}
                  className="p-2.5 rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-gray-50/40 dark:bg-white/[0.01] flex flex-col justify-between gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      {vm.muscleLabel}
                    </span>
                    <span className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded ${
                      isOptimal
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : isExceeded
                        ? 'bg-rose-500/20 text-rose-400 font-extrabold'
                        : isNearMrv
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-400'
                    }`}>
                      {vm.currentSets} / {vm.mavSets} sets
                    </span>
                  </div>

                  <ProgressBar
                    percent={Math.min(100, Math.round((vm.currentSets / vm.mrvSets) * 100))}
                    color={barColor}
                    height={5}
                  />

                  <div className="flex items-center justify-between text-[9px] text-gray-400 font-mono">
                    <span>MEV: {vm.mevSets}</span>
                    <span className="font-semibold text-emerald-500">MAV: {vm.mavSets}</span>
                    <span className="text-rose-400">MRV: {vm.mrvSets}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-2 rounded-xl bg-rose-950/20 border border-rose-500/20 text-[10px] text-rose-300/80 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Nên duy trì hầu hết các nhóm cơ trong vùng MAV (12-18 sets/tuần) để tối đa hóa phì đại cơ bắp mà không gây kiệt sức.</span>
          </div>
        </div>
      </div>

      {/* Monthly Workout Calendar Tracker */}
      <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" />
            <div>
              <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-2">
                <span>Nhật Ký Ngày Tập &amp; Chuỗi Tập Luyện</span>
                {workoutStreak > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white shadow-2xs">
                    Streak {workoutStreak} ngày
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Đã tập <strong>{monthCalendarData.totalTrainedDaysInMonth} ngày</strong> trong {monthCalendarData.monthLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center border border-gray-200 dark:border-white/[0.1] rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => handleShiftCalendarMonth(-1)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-pointer"
                title="Tháng trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-bold text-gray-800 dark:text-gray-200 min-w-24 text-center">
                {monthCalendarData.monthLabel}
              </span>
              <button
                type="button"
                onClick={() => handleShiftCalendarMonth(1)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-pointer"
                title="Tháng sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setPastDate(todayString());
                setShowLogPastWorkoutModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ghi ngày tập</span>
            </button>
          </div>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          <span>T2</span>
          <span>T3</span>
          <span>T4</span>
          <span>T5</span>
          <span>T6</span>
          <span>T7</span>
          <span className="text-orange-500">CN</span>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {monthCalendarData.days.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="h-14 rounded-xl bg-slate-50/40 dark:bg-slate-900/30" />;
            }
            const isSelected = selectedDayFilter === day.dateStr;
            const hasActivity = day.hasWorkout || day.hasSport;
            return (
              <div
                key={day.dateStr}
                onClick={() => setSelectedDayFilter(isSelected ? null : day.dateStr)}
                className={`h-14 p-1 rounded-xl border flex flex-col justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/50 dark:bg-blue-950/40'
                    : day.isToday
                    ? 'border-orange-400 bg-orange-50/30 dark:bg-orange-950/20'
                    : hasActivity
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
                    : 'border-slate-200/70 dark:border-white/[0.08] bg-slate-50/30 dark:bg-slate-900/40 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold ${
                    day.isToday ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {day.dayNumber}
                  </span>
                  {day.isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {day.hasWorkout && (
                    <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-blue-600 text-white flex items-center gap-0.5 truncate" title={`Gym: ${day.workouts.map(w => w.title).join(', ')}`}>
                      <Dumbbell className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{day.workouts[0]?.title || 'Gym'}</span>
                    </span>
                  )}
                  {day.hasSport && (
                    <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-indigo-600 text-white flex items-center gap-0.5" title={`Thể thao: ${day.sports.map(s => SPORT_LABEL[s.type]).join(', ')}`}>
                      <Flame className="w-2.5 h-2.5 shrink-0" />
                      <span>{day.sports[0]?.durationMin}p</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selectedDayFilter && (
          <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs">
            <span className="font-semibold text-blue-800 dark:text-blue-200">
              Đang lọc theo ngày: <strong>{selectedDayFilter}</strong>
            </span>
            <button
              type="button"
              onClick={() => setSelectedDayFilter(null)}
              className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
            >
              Xem tất cả
            </button>
          </div>
        )}
      </div>

      {/* Workout Sessions History Card */}
      <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-orange-500" />
            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
              Lịch Sử Buổi Tập Kháng Lực ({selectedDayFilter ? workoutSessions.filter(s => s.date === selectedDayFilter).length : workoutSessions.length})
            </h3>
          </div>
          <span className="text-[10px] text-gray-400">
            Chi tiết tải trọng &amp; từng hiệp đã hoàn thành
          </span>
        </div>

        {(selectedDayFilter ? workoutSessions.filter(s => s.date === selectedDayFilter) : workoutSessions).length === 0 ? (
          <div className="text-center py-6 text-gray-400 border border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl">
            <Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-30 text-orange-500" />
            <p className="text-xs">Chưa có buổi tập kháng lực nào{selectedDayFilter ? ` vào ngày ${selectedDayFilter}` : ''}.</p>
            <p className="text-[11px] text-gray-400 mt-1">
              Hãy nhấn "Ghi ngày tập" hoặc "Bắt Đầu Tập Ngay" ở một giáo án bên trên để trải nghiệm tracking!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(selectedDayFilter ? workoutSessions.filter(s => s.date === selectedDayFilter) : workoutSessions).map((session) => {
              const isExpanded = expandedWorkoutId === session.id;
              const totalSetsCount = session.sets.length;
              const sessionVolume = session.sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
              const estKcal = gymCalories(session.sets, userWeightKg);
              const durationMin =
                session.finishedAt && session.startedAt
                  ? Math.round((session.finishedAt - session.startedAt) / 60000)
                  : 45;
              const hasDetailGap = sessionGapIds.has(session.id);

              // Group sets by exercise
              const setsByEx: Record<string, typeof session.sets> = {};
              session.sets.forEach((st) => {
                if (!setsByEx[st.exerciseId]) setsByEx[st.exerciseId] = [];
                setsByEx[st.exerciseId].push(st);
              });

              return (
                <div
                  key={session.id}
                  className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-gray-50/60 dark:bg-gray-850/60 transition-all overflow-hidden"
                >
                  <div className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                          {session.title}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          {session.date}
                        </span>
                        {durationMin > 0 && (
                          <span className="text-[10px] text-gray-400">
                            ⏱ {durationMin} phút
                          </span>
                        )}
                        {hasDetailGap && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60"
                            title="Buổi tập chưa có đủ chi tiết hiệp hoặc tải trọng (>0 kg)"
                          >
                            <AlertCircle className="w-3 h-3" /> Thiếu chi tiết hiệp
                          </span>
                        )}
                      </div>
                      {session.note && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 italic mt-1">
                          {session.note}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-right">
                        <div className="px-2 py-1 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/40">
                          <div className="text-[9px] uppercase font-bold text-orange-600 dark:text-orange-400">Tải trọng</div>
                          <div className="text-xs font-bold text-gray-800 dark:text-gray-100 font-mono">
                            {sessionVolume.toLocaleString()} kg
                          </div>
                        </div>
                        <div className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
                          <div className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Tổng hiệp</div>
                          <div className="text-xs font-bold text-gray-800 dark:text-gray-100 font-mono">
                            {totalSetsCount} hiệp
                          </div>
                        </div>
                        <div className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40">
                          <div className="text-[9px] uppercase font-bold text-rose-600 dark:text-rose-400">Tiêu thụ</div>
                          <div className="text-xs font-bold text-gray-800 dark:text-gray-100 font-mono">
                            {estKcal} kcal
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setExpandedWorkoutId(isExpanded ? null : session.id)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-1 text-xs"
                          title="Xem chi tiết các hiệp"
                        >
                          <span className="text-[11px] font-semibold hidden sm:inline">
                            {isExpanded ? 'Thu gọn' : 'Chi tiết'}
                          </span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Bạn có chắc muốn xóa buổi tập "${session.title}" ngày ${session.date}?`)) {
                              onDeleteWorkoutSession(session.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                          title="Xóa buổi tập này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Accordion: List of Sets by Exercise */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 dark:border-white/[0.08] p-3.5 bg-white dark:bg-gray-900/70 space-y-3 animate-fadeIn">
                      <div className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">
                        Danh sách bài tập và thông số các hiệp:
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(setsByEx).map(([exId, setList]) => {
                          const ex = getExercise(exId);
                          const color = ex ? MUSCLE_COLOR[ex.muscle as MuscleGroup] : '#2563EB';
                          return (
                            <div
                              key={exId}
                              className="p-2.5 rounded-xl border border-gray-100 dark:border-white/[0.08] bg-gray-50 dark:bg-gray-800/40"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5 font-bold text-xs text-gray-800 dark:text-gray-200">
                                  <span
                                    className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                                    style={{ backgroundColor: `${color}22`, color }}
                                  >
                                    {ex ? MUSCLE_LABEL[ex.muscle as MuscleGroup] : 'Cơ'}
                                  </span>
                                  <span>{ex ? ex.name : exId}</span>
                                </div>
                                <span className="text-[10px] text-gray-400">
                                  {setList.length} hiệp
                                </span>
                              </div>

                              <div className="space-y-1">
                                {setList.map((st, sIdx) => (
                                  <div
                                    key={st.id || sIdx}
                                    className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-white/[0.1]/60 font-mono"
                                  >
                                    <span className="text-gray-400">Hiệp {sIdx + 1}</span>
                                    <span className="font-bold text-gray-900 dark:text-gray-100">
                                      {st.weightKg} kg × {st.reps} reps
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                      Vol: {st.weightKg * st.reps} kg
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Grid: Personal Records + Sports Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Personal Records Table */}
        <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 shadow-xs">
          <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            Kỷ Lục Cá Nhân (PR - Personal Records)
          </h3>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {Object.keys(prs).length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">Chưa có kỷ lục nào.</p>
            ) : (
              Object.entries(prs).map(([exId, record]) => {
                const ex = exerciseById(exId);
                return (
                  <div key={exId} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-gray-200">
                        {ex ? ex.name : exId}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {ex ? ex.equipment : 'Free weight'}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                        {record.weightKg} kg
                      </span>
                      <span className="text-[10px] text-gray-400 ml-1">× {record.reps} reps</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sports Tracker Card */}
        <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-500" />
              Thể Thao Ngoài Gym (MET Tracker)
            </h3>
            <button
              onClick={() => setShowSportModal(true)}
              className="text-xs font-semibold text-rose-500 dark:text-rose-400 hover:underline cursor-pointer"
            >
              + Thêm buổi tập
            </button>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {sportSessions.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">Chưa có hoạt động thể thao nào.</p>
            ) : (
              sportSessions.slice(0, 5).map((s) => {
                const kcal = sportCalories(s, userWeightKg);
                return (
                  <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <span>{SPORT_LABEL[s.type]}</span>
                        <span className="text-[10px] text-gray-400 font-mono">({s.date})</span>
                      </div>
                      {s.note && <div className="text-[10px] text-gray-400 italic">{s.note}</div>}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold text-rose-600 dark:text-rose-400">{kcal} kcal</div>
                        <div className="text-[10px] text-gray-400">{s.durationMin} phút</div>
                      </div>
                      <button
                        onClick={() => onDeleteSportSession(s.id)}
                        className="p-1 text-gray-300 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Add Sport Modal */}
      {showSportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/[0.08] max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-500" />
              Thêm Buổi Tập Thể Thao (MET)
            </h3>

            <form onSubmit={handleAddSport} className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-gray-400">Bộ môn</label>
                <select
                  value={sportType}
                  onChange={(e) => setSportType(e.target.value as SportType)}
                  className="mt-1 w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                >
                  {SPORT_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {SPORT_LABEL[st]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-gray-400">Thời gian (phút)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={sportDuration}
                    onChange={(e) => setSportDuration(e.target.value)}
                    className="mt-1 w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-gray-400">Ngày</label>
                  <input
                    type="date"
                    required
                    value={sportDate}
                    onChange={(e) => setSportDate(e.target.value)}
                    className="mt-1 w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-gray-400">Ghi chú</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Chạy 5km công viên, đá bóng sân 7..."
                  value={sportNote}
                  onChange={(e) => setSportNote(e.target.value)}
                  className="mt-1 w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                />
              </div>

              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-[11px] text-rose-700 dark:text-rose-300">
                Ước tính tiêu thụ:{' '}
                <span className="font-bold">
                  {sportCalories({ id: '', date: '', type: sportType, durationMin: Number(sportDuration) || 0, createdAt: 0 }, userWeightKg)}{' '}
                  kcal
                </span>{' '}
                (theo cân nặng {userWeightKg} kg).
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSportModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] text-xs font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Lưu hoạt động
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exercise Library Modal */}
      {showLibraryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/[0.08] max-w-lg w-full p-5 space-y-4 shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Thư Viện Bài Tập ({allExercises.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddExerciseModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Bài ngoài</span>
                </button>
                <button
                  onClick={() => setShowLibraryModal(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>

            <input
              type="text"
              placeholder="Tìm kiếm bài tập hoặc nhóm cơ..."
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
            />

            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 pr-1">
              {filteredExercises.map((ex) => {
                const color = MUSCLE_COLOR[ex.muscle];
                return (
                  <div key={ex.id} className="py-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-gray-900 dark:text-gray-100">
                          {ex.name}
                        </span>
                        {ex.isCustom && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            Bài Ngoài
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                          style={{ backgroundColor: `${color}22`, color }}
                        >
                          {MUSCLE_LABEL[ex.muscle]} · {ex.equipment}
                        </span>
                        {ex.isCustom && onDeleteCustomExercise && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Xóa bài tập ngoài "${ex.name}" khỏi thư viện?`)) {
                                onDeleteCustomExercise(ex.id);
                              }
                            }}
                            className="p-1 rounded text-gray-400 hover:text-rose-500 cursor-pointer transition-colors"
                            title="Xóa bài tập ngoài"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 italic flex items-center gap-1">
                      <span className="text-orange-500 font-bold not-italic">Cue:</span> {ex.cue}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Floating Minimized Active Workout Pill */}
      {activeSession && isSessionMinimized && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-950/95 border border-zinc-800 rounded-xl p-3 shadow-xl flex items-center gap-3 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-zinc-100 block truncate max-w-[160px]">{activeSession.planned.title}</span>
            <span className="text-[10px] text-zinc-400 font-mono">
              {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')} · {activeWorkoutStats.completedCount}/{activeWorkoutStats.totalCount} sets
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsSessionMinimized(false)}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-white/10 text-xs font-semibold cursor-pointer transition-colors"
          >
            Mở lại
          </button>
        </div>
      )}

      {/* Create Custom Planned Session Modal */}
      {showAddPlanModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-white/[0.08] max-w-xl w-full p-5 space-y-4 shadow-2xl max-h-[90vh] flex flex-col animate-fadeIn">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/[0.08] pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-orange-500" />
                Tạo Giáo Án Kháng Lực Mới (Mesocycle Plan)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPlanModal(false)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!planTitle.trim()) return;
                const newPlan: PlannedSession = {
                  id: `plan-${Date.now()}`,
                  weekIndex: 0,
                  dayIndex: 0,
                  title: planTitle.trim(),
                  dayOfWeek: planDayOfWeek,
                  prescriptions: planPrescriptions,
                };
                onAddPlannedSession?.(newPlan);
                setShowAddPlanModal(false);
                setScheduledBanner(`Đã thêm giáo án mới "${newPlan.title}" vào mesocycle!`);
                setTimeout(() => setScheduledBanner(null), 4000);
              }}
              className="space-y-4 flex-1 overflow-y-auto pr-1"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-semibold uppercase text-gray-400">Tên Giáo Án / Buổi Tập</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Leg Day (Đùi Trước & Sau), Pull Day Focus..."
                    value={planTitle}
                    onChange={(e) => setPlanTitle(e.target.value)}
                    className="mt-1 w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-gray-400">Thứ Trong Tuần</label>
                  <select
                    value={planDayOfWeek}
                    onChange={(e) => setPlanDayOfWeek(e.target.value)}
                    className="mt-1 w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                  >
                    {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Prescriptions list */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold uppercase text-gray-400">
                    Danh Sách Bài Tập ({planPrescriptions.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPlanPrescriptions([
                        ...planPrescriptions,
                        { exerciseId: 'lat-pulldown', sets: 3, reps: '10-12', rpe: 8, restSeconds: 75 },
                      ]);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm bài tập</span>
                  </button>
                </div>

                {planPrescriptions.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl border border-slate-200 dark:border-white/[0.1] bg-gray-50/50 dark:bg-gray-800/40 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={p.exerciseId}
                        onChange={(e) => {
                          const next = [...planPrescriptions];
                          next[idx].exerciseId = e.target.value;
                          setPlanPrescriptions(next);
                        }}
                        className="flex-1 text-xs px-2.5 py-1.5 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                      >
                        {allExercises.map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.name} ({MUSCLE_LABEL[ex.muscle]}){ex.isCustom ? ' [Bài Ngoài]' : ''}
                          </option>
                        ))}
                      </select>

                      {planPrescriptions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPlanPrescriptions(planPrescriptions.filter((_, i) => i !== idx));
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="Xóa bài tập này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-[9px] text-gray-400 uppercase font-semibold">Số hiệp</span>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={p.sets}
                          onChange={(e) => {
                            const next = [...planPrescriptions];
                            next[idx].sets = Math.max(1, Number(e.target.value) || 1);
                            setPlanPrescriptions(next);
                          }}
                          className="mt-0.5 w-full text-center py-1 rounded-lg border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-900"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 uppercase font-semibold">Reps</span>
                        <input
                          type="text"
                          value={p.reps}
                          onChange={(e) => {
                            const next = [...planPrescriptions];
                            next[idx].reps = e.target.value;
                            setPlanPrescriptions(next);
                          }}
                          className="mt-0.5 w-full text-center py-1 rounded-lg border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-900"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 uppercase font-semibold">RPE</span>
                        <input
                          type="number"
                          min="6"
                          max="10"
                          value={p.rpe}
                          onChange={(e) => {
                            const next = [...planPrescriptions];
                            next[idx].rpe = Number(e.target.value) || 8;
                            setPlanPrescriptions(next);
                          }}
                          className="mt-0.5 w-full text-center py-1 rounded-lg border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-900"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 uppercase font-semibold">Nghỉ (s)</span>
                        <input
                          type="number"
                          min="30"
                          step="15"
                          value={p.restSeconds}
                          onChange={(e) => {
                            const next = [...planPrescriptions];
                            next[idx].restSeconds = Number(e.target.value) || 90;
                            setPlanPrescriptions(next);
                          }}
                          className="mt-0.5 w-full text-center py-1 rounded-lg border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAddPlanModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] text-xs font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-sm"
                >
                  Lưu Giáo Án
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Exercise Modal ("Thêm Bài Ngoài") */}
      {showAddExerciseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/[0.08] max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Thêm Bài Tập Ngoài / Tùy Chỉnh
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddExerciseModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomExercise} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-1">
                  Tên bài tập
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Dumbbell Bulgarian Split Squat, Cable Lateral Raise..."
                  value={newExName}
                  onChange={(e) => setNewExName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-1">
                    Nhóm cơ chính
                  </label>
                  <select
                    value={newExMuscle}
                    onChange={(e) => setNewExMuscle(e.target.value as MuscleGroup)}
                    className="w-full text-xs px-2.5 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-semibold"
                  >
                    <option value="chest">Ngực (Chest)</option>
                    <option value="back">Lưng (Back)</option>
                    <option value="legs">Chân &amp; Đùi (Legs)</option>
                    <option value="shoulders">Vai (Shoulders)</option>
                    <option value="arms">Tay (Arms)</option>
                    <option value="core">Bụng (Core)</option>
                    <option value="cardio">Cardio</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-1">
                    Thiết bị / Dụng cụ
                  </label>
                  <input
                    type="text"
                    placeholder="Barbell, Dumbbell, Cable..."
                    value={newExEquipment}
                    onChange={(e) => setNewExEquipment(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-1">
                  Hướng dẫn kỹ thuật (Cue / Lưu ý tư thế)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Giữ lưng thẳng, hạ chậm 2 giây, không khóa khớp gối..."
                  value={newExCue}
                  onChange={(e) => setNewExCue(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAddExerciseModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] text-xs font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-sm"
                >
                  Thêm Vào Thư Viện
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1RM & Barbell Plate Calculator Modal */}
      {showCalculatorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl w-full max-w-2xl max-h-[85vh] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/[0.08] bg-zinc-50 dark:bg-zinc-900/40">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    Máy Tính 1RM &amp; Xếp Bánh Tạ Đòn (Barbell)
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Công thức Epley / Brzycki &amp; quy chuẩn xếp đĩa tạ Olympic thi đấu
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCalculatorModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-tabs */}
            <div className="p-3 border-b border-gray-100 dark:border-white/[0.08] bg-gray-50/50 dark:bg-gray-900/30 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCalcTab('1rm')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  calcTab === '1rm'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 border border-slate-200 dark:border-white/[0.1]'
                }`}
              >
                Tính 1RM &amp; Tải Trọng Tập
              </button>
              <button
                type="button"
                onClick={() => setCalcTab('plates')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  calcTab === 'plates'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 border border-slate-200 dark:border-white/[0.1]'
                }`}
              >
                Xếp Bánh Tạ (Plate Math)
              </button>
            </div>

            {/* Tab 1: 1RM Content */}
            {calcTab === '1rm' && (
              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-gray-400">
                      Mức tạ đã đẩy (kg)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={1}
                      value={oneRmWeight}
                      onChange={(e) => setOneRmWeight(e.target.value)}
                      className="mt-1 w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-gray-400">
                      Số rep hoàn thành (Reps)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={oneRmReps}
                      onChange={(e) => setOneRmReps(e.target.value)}
                      className="mt-1 w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-bold"
                    />
                  </div>
                </div>

                {/* 1RM Highlight */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-zinc-100 text-center">
                  <span className="text-[11px] font-semibold uppercase tracking-wider opacity-90">
                    1RM Ước Tính (One Rep Max)
                  </span>
                  <div className="text-4xl font-extrabold font-mono mt-0.5 tracking-tight text-amber-500">
                    {oneRmResult.oneRepMax} <span className="text-xl text-zinc-400">kg</span>
                  </div>
                  <div className="text-[11px] opacity-90 mt-1 flex items-center justify-center gap-3">
                    <span>Epley: {oneRmResult.epley} kg</span>
                    <span>·</span>
                    <span>Brzycki: {oneRmResult.brzycki} kg</span>
                  </div>
                </div>

                {/* Percentages Table */}
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                    Bảng Tải Trọng Tập Luyện Theo Mục Tiêu:
                  </h4>
                  <div className="border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                    {oneRmResult.percentages.map((row) => (
                      <div
                        key={row.pct}
                        className="px-3.5 py-2 flex items-center justify-between text-xs bg-white dark:bg-gray-900/40 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-12 font-mono font-bold text-orange-600 dark:text-orange-400">
                            {row.pct}%
                          </span>
                          <span className="text-gray-700 dark:text-gray-300">{row.description}</span>
                        </div>
                        <div className="flex items-center gap-3 font-mono">
                          <span className="text-[11px] text-gray-400">{row.targetReps}</span>
                          <span className="font-extrabold text-gray-900 dark:text-gray-100 text-sm">
                            {row.weight} kg
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Plates Math Content */}
            {calcTab === 'plates' && (
              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-gray-400">
                      Tổng Cân Nặng Muốn Nâng (kg)
                    </label>
                    <input
                      type="number"
                      step="2.5"
                      min={plateResult.barWeightKg}
                      value={plateTargetTotal}
                      onChange={(e) => setPlateTargetTotal(e.target.value)}
                      className="mt-1 w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-gray-400">
                      Loại Thanh Đòn (Barbell)
                    </label>
                    <select
                      value={plateBarWeight}
                      onChange={(e) => setPlateBarWeight(e.target.value)}
                      className="mt-1 w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-bold"
                    >
                      <option value="20">Đòn Olympic Chuẩn Nam (20 kg)</option>
                      <option value="15">Đòn Olympic Chuẩn Nữ (15 kg)</option>
                      <option value="10">Đòn Ngắn / EZ Bar (10 kg)</option>
                      <option value="8">Đòn Thẳng Nhẹ (8 kg)</option>
                    </select>
                  </div>
                </div>

                {/* Visual Barbell Display */}
                <div className="bg-gray-900 text-white rounded-2xl p-5 shadow-inner space-y-4">
                  <div className="flex items-center justify-between text-xs text-gray-400 border-b border-slate-800 pb-2">
                    <span>
                      Đòn: <strong className="text-white">{plateResult.barWeightKg}kg</strong>
                    </span>
                    <span>
                      Mỗi bên cần lắp:{' '}
                      <strong className="text-orange-400 text-sm">{plateResult.loadedPerSideKg}kg</strong>
                    </span>
                  </div>

                  {/* Graphic Barbell */}
                  <div className="flex items-center justify-center py-4 overflow-x-auto">
                    <div className="flex items-center gap-1 bg-gray-800/80 p-3 rounded-2xl border border-gray-700">
                      {/* Left plates (mirrored) */}
                      <div className="flex items-center gap-1 flex-row-reverse">
                        {plateResult.platesPerSide.flatMap((p) =>
                          Array.from({ length: p.count }).map((_, idx) => (
                            <div
                              key={`left-${p.plateKg}-${idx}`}
                              style={{ backgroundColor: p.color }}
                              className="w-4 h-16 rounded-xs flex items-center justify-center text-[9px] font-black font-mono text-white shadow-xs"
                              title={`Bánh ${p.plateKg}kg`}
                            >
                              {p.plateKg}
                            </div>
                          ))
                        )}
                      </div>

                      {/* Bar center */}
                      <div className="w-16 h-3 bg-gray-400 rounded-sm relative flex items-center justify-center">
                        <span className="text-[8px] font-mono text-gray-900 font-bold">
                          {plateResult.barWeightKg}KG
                        </span>
                      </div>

                      {/* Right plates */}
                      <div className="flex items-center gap-1">
                        {plateResult.platesPerSide.flatMap((p) =>
                          Array.from({ length: p.count }).map((_, idx) => (
                            <div
                              key={`right-${p.plateKg}-${idx}`}
                              style={{ backgroundColor: p.color }}
                              className="w-4 h-16 rounded-xs flex items-center justify-center text-[9px] font-black font-mono text-white shadow-xs"
                              title={`Bánh ${p.plateKg}kg`}
                            >
                              {p.plateKg}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detailed list per side */}
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-gray-300">Danh sách bánh tạ cho MỖI BÊN:</div>
                    {plateResult.platesPerSide.length === 0 ? (
                      <p className="text-gray-500 text-[11px]">Chỉ dùng thanh đòn, chưa cần lắp thêm bánh tạ.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                        {plateResult.platesPerSide.map((p) => (
                          <div
                            key={p.plateKg}
                            className="p-2 rounded-xl bg-gray-800 border border-gray-700 flex items-center gap-2"
                          >
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: p.color }}
                            />
                            <span className="font-bold text-white">{p.count}x bánh {p.plateKg} kg</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {plateResult.remainderKg > 0 && (
                      <p className="text-amber-400 text-[11px] pt-1">
                        Lưu ý: Còn dư {plateResult.remainderKg}kg do không đủ phân số bánh tạ nhỏ hơn 1.25kg.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="p-3 border-t border-gray-100 dark:border-white/[0.08] bg-gray-50 dark:bg-gray-900/50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCalculatorModal(false)}
                className="px-4 py-1.5 rounded-xl border border-gray-300 dark:border-white/[0.1] font-semibold text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Past / Custom Workout Modal */}
      {showLogPastWorkoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.08] p-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-orange-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Ghi Nhận Buổi Tập Cho Ngày
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLogPastWorkoutModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePastWorkout} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Ngày tập
                </label>
                <input
                  type="date"
                  value={pastDate}
                  onChange={(e) => setPastDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Tên buổi tập / Giáo án
                </label>
                <input
                  type="text"
                  value={pastTitle}
                  onChange={(e) => setPastTitle(e.target.value)}
                  placeholder="VD: Đẩy Ngực &amp; Tay Sau, Chân Mông..."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                  required
                />
                {/* Quick suggestions from Planned Sessions or standard splits */}
                {plannedSessions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    <span className="text-[10px] text-gray-400 font-medium mr-1">Giáo án hiện tại:</span>
                    {plannedSessions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setPastTitle(s.title);
                          setPastDuration('60');
                          setPastBurnedKcal('280');
                        }}
                        className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-orange-500/15 border border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/25 cursor-pointer transition-colors"
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1 mt-1">
                  {['Đẩy Ngực & Tay Sau', 'Kéo Lưng & Tay Trước', 'Chân & Bụng', 'Vai & Bắp Tay', 'Full Body Toàn Thân'].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setPastTitle(sug)}
                      className="px-2 py-0.5 text-[10px] rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-orange-50 hover:text-orange-600 text-gray-600 dark:text-gray-300 cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Thời lượng (phút)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={240}
                    value={pastDuration}
                    onChange={(e) => setPastDuration(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Calo tiêu hao ước tính (kcal)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={pastBurnedKcal}
                    onChange={(e) => setPastBurnedKcal(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-mono font-bold text-orange-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Ghi chú buổi tập (RPE, cảm nhận, tạ chính)
                </label>
                <textarea
                  rows={2}
                  value={pastNotes}
                  onChange={(e) => setPastNotes(e.target.value)}
                  placeholder="VD: Bench Press 70kg x 8 reps, Squat 90kg, cơ bắp căng tốt..."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowLogPastWorkoutModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Lưu Buổi Tập</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ZENOX Workout Google Calendar Sync Studio Modal */}
      <CtgCalendarSyncModal
        isOpen={showCalendarSyncModal}
        onClose={() => setShowCalendarSyncModal(false)}
        activePhase={ctgActivePhase}
        existingEvents={events}
        plannedSessions={plannedSessions}
        onBatchSchedule={onBatchScheduleToCalendar}
        onClearWorkoutEvents={onClearWorkoutEventsFromCalendar}
        awayMode={awayMode}
        lang={lang}
      />

      {/* ZENOX Smart Workout Text & File Importer Studio Modal */}
      <SmartWorkoutImportModal
        isOpen={showSmartImportModal}
        onClose={() => setShowSmartImportModal(false)}
        userWeightKg={userWeightKg}
        customExercises={customExercises}
        prs={prs}
        onLogWorkoutSession={onLogWorkoutSession}
        onAddPlannedSession={onAddPlannedSession}
        onOpenSyncStudio={() => setShowCalendarSyncModal(true)}
        lang={lang}
      />

      {/* Exercise Drilldown & E1RM History Modal */}
      {inspectingExerciseId && (() => {
        const drilldown = getExerciseHistoryDrilldown(inspectingExerciseId, workoutSessions, customExercises);
        const exInfo = getExercise(inspectingExerciseId);
        const currentCue = exerciseCues[inspectingExerciseId] || '';
        const muscleLabel = exInfo ? MUSCLE_LABEL[exInfo.muscle as MuscleGroup] : 'Khác';
        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
            <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-500 shrink-0" />
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 truncate">
                      {drilldown.exerciseName}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300">
                      {muscleLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Phân tích tiến bộ Est. 1RM, kỷ lục cá nhân &amp; ghi chú kỹ thuật
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingExerciseId(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/35 border border-indigo-200/70 dark:border-indigo-800/50">
                    <div className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">Best Est. 1RM</div>
                    <div className="text-lg font-extrabold text-gray-900 dark:text-gray-100 font-mono mt-0.5">
                      {drilldown.bestOneRmKg > 0 ? `${drilldown.bestOneRmKg} kg` : '—'}
                    </div>
                    {drilldown.latestOneRmDeltaKg !== 0 && (
                      <div className={`text-[10px] font-semibold mt-0.5 ${drilldown.latestOneRmDeltaKg > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                        {drilldown.latestOneRmDeltaKg > 0 ? `+${drilldown.latestOneRmDeltaKg}` : drilldown.latestOneRmDeltaKg} kg gần nhất
                      </div>
                    )}
                  </div>
                  <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/35 border border-orange-200/70 dark:border-orange-800/50">
                    <div className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400">Tạ nặng nhất</div>
                    <div className="text-lg font-extrabold text-gray-900 dark:text-gray-100 font-mono mt-0.5">
                      {drilldown.maxWeightKg > 0 ? `${drilldown.maxWeightKg} kg` : '—'}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Mức tạ đơn cao nhất</div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200/70 dark:border-emerald-800/50">
                    <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Hiệp tốt nhất</div>
                    <div className="text-base font-extrabold text-gray-900 dark:text-gray-100 font-mono mt-0.5">
                      {drilldown.bestRepSet ? `${drilldown.bestRepSet.weightKg}kg × ${drilldown.bestRepSet.reps}` : '—'}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {drilldown.bestRepSet ? drilldown.bestRepSet.date : 'Chưa có dữ liệu'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08]">
                    <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Tần suất</div>
                    <div className="text-lg font-extrabold text-gray-900 dark:text-gray-100 font-mono mt-0.5">
                      {drilldown.totalSessionsCount} buổi
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {drilldown.totalWorkingSets} hiệp working
                    </div>
                  </div>
                </div>

                {/* Personal Form Cue */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02]">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                    Ghi chú kỹ thuật (Form Cue) — tự động lưu theo bài tập
                  </label>
                  <textarea
                    rows={2}
                    value={currentCue}
                    onChange={(e) => {
                      const val = e.target.value;
                      setExerciseCues((prev) => {
                        const next = { ...prev, [inspectingExerciseId]: val };
                        try {
                          accountStorage.setItem('gcal_prod_exercise_cues', JSON.stringify(next));
                        } catch {
                          // ignore quota errors
                        }
                        return next;
                      });
                    }}
                    placeholder="Ví dụ: Ép bả vai xuống ghế, hạ chậm 3 giây chạm nhẹ ngực giữa..."
                    className="w-full rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-gray-900 px-3 py-2 text-xs text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>

                {/* Session History Timeline */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    Lịch sử theo buổi ({drilldown.timeline.length} buổi gần đây)
                  </div>
                  {drilldown.timeline.length === 0 ? (
                    <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08] text-xs text-gray-400">
                      Chưa có hiệp tập nào được ghi nhận cho bài tập này.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {drilldown.timeline.slice(-10).reverse().map((item) => (
                        <div
                          key={`${item.sessionId}-${item.date}`}
                          className="p-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {item.sessionTitle}
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono">{item.date}</div>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-200">
                              Top: {item.topWeightKg}kg × {item.topReps}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {item.setsCount} hiệp · {item.totalTonnageKg.toLocaleString()} kg
                            </span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              E1RM {item.bestOneRmKg}kg
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};


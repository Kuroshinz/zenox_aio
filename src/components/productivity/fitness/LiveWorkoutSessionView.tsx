import React, { useState, useMemo } from 'react';
import {
  Dumbbell,
  Clock,
  Flame,
  CheckCircle2,
  Award,
  Zap,
  Plus,
  Minus,
  Trash2,
  X,
  Check,
  Calculator,
  Minimize2,
  Maximize2,
  Copy,
  Sparkles,
  Trophy,
  Scale,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  TrendingUp,
} from 'lucide-react';
import {
  PlannedSession,
  Exercise,
  MuscleGroup,
  WorkoutSession,
  MUSCLE_LABEL,
  MUSCLE_COLOR,
} from '../../../types/productivity';
import {
  exerciseById,
  EXERCISES,
  calculateBarbellPlates,
  calculateProgressiveOverload,
  compareProgressiveOverload,
  calculateMesocycleWeekPlan,
  getSwapCandidatesForExercise,
} from '../../../utils/fitnessMetrics';

export interface ActiveSessionState {
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
  notes?: string;
}

export interface LiveWorkoutSessionViewProps {
  activeSession: ActiveSessionState;
  elapsedSeconds: number;
  restSecondsLeft: number | null;
  prs: Record<string, { weightKg: number; reps: number }>;
  workoutSessions: WorkoutSession[];
  onUpdateSet: (exerciseId: string, setIndex: number, weightKg: number, reps: number) => void;
  onToggleSet: (exerciseId: string, setIndex: number, restSeconds: number) => void;
  onCycleSetType: (exerciseId: string, setIndex: number) => void;
  onUpdateRpe: (exerciseId: string, setIndex: number, rpe: number) => void;
  onCopyPrevSet: (exerciseId: string, setIndex: number) => void;
  onApplyQuickScale: (
    exerciseId: string,
    setIndex: number,
    factor: number,
    targetSetType?: 'normal' | 'warmup' | 'dropset' | 'failure'
  ) => void;
  onAddSet: (exerciseId: string) => void;
  onRemoveSet: (exerciseId: string, setIndex: number) => void;
  onAddExercise: (exerciseId: string) => void;
  onSwapExercise?: (oldExerciseId: string, newExerciseId: string) => void;
  onMoveExercise?: (index: number, direction: 'up' | 'down') => void;
  onInspectExercise?: (exerciseId: string) => void;
  onFinishSession: () => void;
  onCancelSession: () => void;
  onMinimize: () => void;
  onOpenPlateCalculator: (weightKg: number) => void;
  onAdjustRestTimer: (deltaSeconds: number) => void;
  onSkipRestTimer: () => void;
  onSetRestTimerTotal: (seconds: number) => void;
  activeMesoWeek?: number;
  customExercises?: Exercise[];
  lang?: 'vi' | 'en';
}

export const LiveWorkoutSessionView: React.FC<LiveWorkoutSessionViewProps> = ({
  activeSession,
  elapsedSeconds,
  restSecondsLeft,
  prs,
  workoutSessions,
  onUpdateSet,
  onToggleSet,
  onCycleSetType,
  onUpdateRpe,
  onCopyPrevSet,
  onApplyQuickScale,
  onAddSet,
  onRemoveSet,
  onAddExercise,
  onSwapExercise,
  onMoveExercise,
  onInspectExercise,
  onFinishSession,
  onCancelSession,
  onMinimize,
  onOpenPlateCalculator,
  onAdjustRestTimer,
  onSkipRestTimer,
  onSetRestTimerTotal,
  activeMesoWeek = 1,
  customExercises = [],
  lang = 'vi',
}) => {
  const [extraExId, setExtraExId] = useState('');
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [showAddExModal, setShowAddExModal] = useState(false);
  const [swappingExId, setSwappingExId] = useState<string | null>(null);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [selectedSetByEx, setSelectedSetByEx] = useState<Record<string, number>>({});

  const mesoPlan = useMemo(() => {
    return calculateMesocycleWeekPlan(activeMesoWeek);
  }, [activeMesoWeek]);

  const allAvailableExercises = useMemo(() => {
    return [...EXERCISES, ...customExercises];
  }, [customExercises]);

  const getExercise = (id: string): Exercise | undefined => {
    return exerciseById(id) || customExercises.find((e) => e.id === id);
  };

  // Workout Summary Stats
  const stats = useMemo(() => {
    const completedSets = Object.values(activeSession.sets).filter((s) => s.completed);
    const volumeKg = completedSets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
    const completedCount = completedSets.length;
    const totalCount = Object.keys(activeSession.sets).length;
    const prCount = completedSets.filter((s) => s.isPr).length;
    // Estimated kcal (approx 18 kcal per completed working set + 3 kcal/min)
    const kcal = Math.round(completedCount * 18 + (elapsedSeconds / 60) * 3);

    return { volumeKg, completedCount, totalCount, prCount, kcal };
  }, [activeSession, elapsedSeconds]);

  // Format Elapsed Time (HH:MM:SS or MM:SS)
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const scrollToExercise = (exerciseId: string) => {
    const el = document.getElementById(`exercise-${exerciseId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const wrapperClass = isFocusMode
    ? 'fixed inset-0 z-50 bg-[#070205] text-white flex flex-col overflow-y-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200'
    : 'space-y-4 animate-in fade-in duration-300 pb-24 relative';

  return (
    <div className={wrapperClass}>
      {/* 1. TOP SLEEK GYM COMMAND BAR (Compacted to ~54px so it never blocks content when scrolling!) */}
      <div className="sticky top-0 z-30 bg-[#0c050e]/95 backdrop-blur-xl border-b border-rose-500/25 shadow-xl -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2.5 transition-all">
        <div className="flex items-center justify-between gap-2.5">
          {/* Left: Live pulsing badge + Title & Timer */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-950/60">
              <Dumbbell className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                <h2 className="text-sm sm:text-base font-black text-white truncate tracking-tight">
                  {activeSession.planned.title}
                </h2>
                {stats.prCount > 0 && (
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1 shrink-0">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    {stats.prCount} PR
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-white/60">
                <span className="text-rose-400 font-bold">{formatTime(elapsedSeconds)}</span>
                <span>•</span>
                <span className="text-emerald-400 font-bold">
                  {stats.completedCount}/{stats.totalCount} hiệp
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline text-white/50">{stats.volumeKg.toLocaleString()} kg</span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Toggle Full Metrics Details */}
            <button
              type="button"
              onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${isHeaderExpanded
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
                }`}
              title={isHeaderExpanded ? 'Thu gọn bảng chỉ số' : 'Xem chi tiết chỉ số & RP Deload'}
            >
              <span className="hidden md:inline">{isHeaderExpanded ? 'Thu gọn' : 'Chỉ số'}</span>
              {isHeaderExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {/* Toggle Focus Fullscreen Mode */}
            <button
              type="button"
              onClick={() => setIsFocusMode(!isFocusMode)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-bold cursor-pointer transition-colors"
              title={isFocusMode ? 'Thoát chế độ toàn màn hình' : 'Chế độ tập trung toàn màn hình (Focus Mode)'}
            >
              {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Minimize */}
            <button
              type="button"
              onClick={onMinimize}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Thu nhỏ để xem các tab khác mà không gián đoạn buổi tập"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Thu nhỏ</span>
            </button>

            {/* Cancel */}
            <button
              type="button"
              onClick={() => setShowConfirmCancel(true)}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/60 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Hủy buổi tập"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Hủy</span>
            </button>

            {/* Finish Button */}
            <button
              type="button"
              onClick={onFinishSession}
              disabled={stats.completedCount === 0}
              className="px-3.5 sm:px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span className="hidden sm:inline">Hoàn Thành</span>
              <span className="font-mono">({stats.completedCount}/{stats.totalCount})</span>
            </button>
          </div>
        </div>

        {/* Quick Exercise Jump Chips (ZENOX Quick Nav: Tap to jump smoothly to any exercise) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-0.5 scrollbar-none text-xs">
          <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">
            Bài tập:
          </span>
          {activeSession.prescriptions.map((pres, idx) => {
            const ex = getExercise(pres.exerciseId);
            const completedSets = Array.from({ length: pres.sets }).filter(
              (_, sIdx) => activeSession.sets[`${pres.exerciseId}-${sIdx}`]?.completed
            ).length;
            const isAllDone = completedSets === pres.sets;

            return (
              <button
                key={pres.exerciseId}
                type="button"
                onClick={() => scrollToExercise(pres.exerciseId)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-1.5 border ${isAllDone
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : completedSets > 0
                    ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300'
                    : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20 hover:text-white'
                  }`}
              >
                {isAllDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <span className="font-mono text-white/40 text-[11px]">#{idx + 1}</span>
                )}
                <span className="truncate max-w-[120px]">{ex?.name || pres.exerciseId}</span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/40 text-white/60">
                  {completedSets}/{pres.sets}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setShowAddExModal(true)}
            className="px-2 py-1 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 cursor-pointer transition-colors flex items-center gap-1"
            title="Thêm bài tập vào buổi tập hôm nay"
          >
            <Plus className="w-3 h-3" />
            <span>Thêm bài</span>
          </button>
        </div>
      </div>

      {/* 2. COLLAPSIBLE METRICS & RP DELOAD PANEL (Scrolls away naturally, never blocks content!) */}
      {isHeaderExpanded && (
        <div className="p-4 sm:p-5 rounded-3xl bg-[#0c050e]/90 border border-rose-500/20 shadow-2xl space-y-4 animate-in slide-in-from-top-3 duration-200">
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-bold text-white">Chỉ Số Buổi Tập &amp; Khoa Học RP Periodization</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsHeaderExpanded(false)}
              className="text-white/40 hover:text-white text-xs cursor-pointer"
            >
              Thu gọn ✕
            </button>
          </div>

          {/* 4 Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <div className="text-[10px] text-white/40 uppercase font-bold font-mono">Thời Gian Tập</div>
              <div className="text-base sm:text-lg font-black text-white font-mono mt-0.5">
                {formatTime(elapsedSeconds)}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <div className="text-[10px] text-white/40 uppercase font-bold font-mono">Tổng Tải Lượng</div>
              <div className="text-base sm:text-lg font-black text-rose-400 font-mono mt-0.5">
                {stats.volumeKg.toLocaleString()} kg
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <div className="text-[10px] text-white/40 uppercase font-bold font-mono">Tiến Độ Hiệp</div>
              <div className="text-base sm:text-lg font-black text-emerald-400 font-mono mt-0.5">
                {stats.completedCount} / {stats.totalCount}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <div className="text-[10px] text-white/40 uppercase font-bold font-mono">Ước Tính Tiêu Hao</div>
              <div className="text-base sm:text-lg font-black text-amber-400 font-mono mt-0.5">
                ~{stats.kcal} kcal
              </div>
            </div>
          </div>

          {/* Scientific RP Hypertrophy Guidance Bar */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-cyan-950/20 to-transparent border border-cyan-500/20 text-xs space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-bold text-white">Tuần {mesoPlan.weekNumber}: {mesoPlan.title.split(': ')[1]} ({mesoPlan.stage.toUpperCase()})</span>
              <span className="text-cyan-300 font-mono font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                Mục Tiêu: RIR {mesoPlan.targetRir} • RPE {mesoPlan.targetRpe}
              </span>
            </div>
            <div className="text-white/70 text-[11px] leading-relaxed">
              {mesoPlan.summary}
            </div>
          </div>

          {/* Quick Rest Presets */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
            <span className="text-white/50">Cài đặt đồng hồ nghỉ chuẩn:</span>
            <div className="flex items-center gap-1 font-mono text-[11px]">
              {[60, 90, 120, 180].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onSetRestTimerTotal(s);
                    onAdjustRestTimer(s);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white cursor-pointer"
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. EXERCISE CARDS WORKSTATION (With scroll-mt-24 so titles are never cut off!) */}
      <div className="space-y-5">
        {activeSession.prescriptions.map((pres, pIdx) => {
          const ex = getExercise(pres.exerciseId);
          const color = ex ? MUSCLE_COLOR[ex.muscle as MuscleGroup] : '#2563EB';
          const curPr = prs[pres.exerciseId];
          const overloadRec = curPr ? calculateProgressiveOverload(curPr.weightKg, curPr.reps, pres.reps) : null;

          // Compare with last workout
          const curSetsForEx = Array.from({ length: pres.sets }).map((_, sIdx) => {
            const st = activeSession.sets[`${pres.exerciseId}-${sIdx}`];
            return st ? { weightKg: st.weightKg, reps: st.reps } : { weightKg: 0, reps: 0 };
          });
          const liveOverload = compareProgressiveOverload(
            pres.exerciseId,
            curSetsForEx,
            workoutSessions,
            ex?.name
          );

          return (
            <div
              key={pres.exerciseId}
              id={`exercise-${pres.exerciseId}`}
              className={`bg-[#0b040c] rounded-3xl border p-4 sm:p-5 shadow-xl space-y-4 relative overflow-hidden scroll-mt-24 ${pres.supersetId ? 'border-purple-500/40' : 'border-white/10'
                }`}
            >
              {/* Exercise Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-xl bg-white/5 border border-white/10 text-white/60 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    #{pIdx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[9px] px-2 py-0.2 rounded font-bold uppercase"
                        style={{ backgroundColor: `${color}25`, color }}
                      >
                        {ex ? MUSCLE_LABEL[ex.muscle as MuscleGroup] : 'Cơ'} • {ex?.equipment}
                      </span>
                      {pres.supersetId && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono font-bold uppercase">
                          Superset {pres.supersetId.toUpperCase()}
                        </span>
                      )}
                      <h3 className="font-black text-base sm:text-lg text-white">
                        {ex?.name || pres.exerciseId}
                      </h3>
                    </div>
                    {ex?.cue && (
                      <p className="text-xs text-white/40 italic mt-0.5">
                        💡 {ex.cue}
                      </p>
                    )}
                    {ex?.equipment === 'barbell' && (() => {
                      const refWeight = activeSession.sets[`${pres.exerciseId}-0`]?.weightKg || curPr?.weightKg || 40;
                      const plates = calculateBarbellPlates(refWeight);
                      if (plates.platesPerSide.length === 0) return null;
                      return (
                        <p className="text-[11px] font-mono text-amber-300/80 mt-0.5">
                          Bánh tạ ({refWeight}kg · đòn 20kg): Mỗi bên {plates.platesPerSide.map((pl) => `${pl.count}×${pl.plateKg}kg`).join(' + ')}
                        </p>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-center font-mono text-xs flex-wrap">
                  <span className="text-white/40">
                    Mục tiêu: <strong className="text-white">{pres.reps} reps • RPE {pres.rpe}</strong>
                  </span>
                  {curPr && (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[11px] flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-amber-400" />
                      PR: {curPr.weightKg}kg × {curPr.reps}
                    </span>
                  )}
                  {onInspectExercise && (
                    <button
                      type="button"
                      onClick={() => onInspectExercise(pres.exerciseId)}
                      className="px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 font-sans font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      title="Xem biểu đồ E1RM & lịch sử các buổi trước"
                    >
                      <TrendingUp className="w-3 h-3" />
                      <span>1RM &amp; Lịch sử</span>
                    </button>
                  )}
                  {onSwapExercise && (
                    <button
                      type="button"
                      onClick={() => setSwappingExId(swappingExId === pres.exerciseId ? null : pres.exerciseId)}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 font-sans font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      title="Đổi bài tập tương đương khi máy ở gym đang bận"
                    >
                      <RefreshCw className="w-3 h-3 text-rose-400" />
                      <span>Đổi bài</span>
                    </button>
                  )}
                  {onMoveExercise && (
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        disabled={pIdx === 0}
                        onClick={() => onMoveExercise(pIdx, 'up')}
                        className="p-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 disabled:opacity-30 cursor-pointer"
                        title="Đưa lên trước"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={pIdx === activeSession.prescriptions.length - 1}
                        onClick={() => onMoveExercise(pIdx, 'down')}
                        className="p-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 disabled:opacity-30 cursor-pointer"
                        title="Đưa xuống sau"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Inline In-Gym Swap Exercise Selector ("Thay thế bài này bằng") */}
              {swappingExId === pres.exerciseId && onSwapExercise && (
                <div className="p-3 rounded-2xl bg-rose-950/25 border border-rose-500/35 space-y-2 text-xs animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-300">
                      Thay thế bài này bằng (ưu tiên cùng nhóm cơ):
                    </span>
                    <button
                      type="button"
                      onClick={() => setSwappingExId(null)}
                      className="text-white/50 hover:text-white cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    {getSwapCandidatesForExercise(
                      pres.exerciseId,
                      customExercises,
                      activeSession.prescriptions.map((p) => p.exerciseId)
                    )
                      .slice(0, 10)
                      .map((cand) => (
                        <button
                          key={cand.id}
                          type="button"
                          onClick={() => {
                            onSwapExercise(pres.exerciseId, cand.id);
                            setSwappingExId(null);
                          }}
                          className={`px-2.5 py-1 rounded-xl border text-[11px] font-semibold cursor-pointer transition-colors ${cand.muscle === ex?.muscle
                            ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-200'
                            : 'bg-white/5 hover:bg-white/15 border-white/10 text-white/75'
                            }`}
                        >
                          {cand.name} ({MUSCLE_LABEL[cand.muscle]} · {cand.equipment})
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Progressive Overload Anchor from Last Workout */}
              {liveOverload.hasPreviousData && (
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Award className="w-4 h-4 text-rose-400 shrink-0" />
                    <div>
                      <span className="text-white/50 mr-2">
                        Buổi trước ({liveOverload.previousBest?.date}):
                      </span>
                      <span className="font-mono text-white font-bold">
                        {liveOverload.previousBest?.weightKg}kg × {liveOverload.previousBest?.reps} reps
                      </span>
                      <span className="text-white/40 text-[10px] ml-1.5">
                        (1RM ~{liveOverload.previousBest?.oneRmKg}kg)
                      </span>
                    </div>
                  </div>

                  {overloadRec && (
                    <div className="text-[11px] text-amber-400 font-mono flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" />
                      <span>{overloadRec.tipVi}</span>
                    </div>
                  )}
                </div>
              )}

              {/* SETS TABLE */}
              <div className="space-y-2 overflow-x-auto">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 text-[10px] font-mono font-bold text-white/40 uppercase tracking-wider px-3 pb-1">
                  <div className="col-span-2">Hiệp / Loại</div>
                  <div className="col-span-2 text-center">Lần Trước</div>
                  <div className="col-span-3 text-center">Mức Tạ (KG)</div>
                  <div className="col-span-2 text-center">Số Reps</div>
                  <div className="col-span-2 text-center hidden md:block">1RM Dự Kiến</div>
                  <div className="col-span-3 md:col-span-1 text-right">Xong</div>
                </div>

                {/* Table Rows */}
                {Array.from({ length: pres.sets }).map((_, sIdx) => {
                  const setKey = `${pres.exerciseId}-${sIdx}`;
                  const setItem = activeSession.sets[setKey] || {
                    weightKg: curPr?.weightKg || 40,
                    reps: parseInt(pres.reps) || 10,
                    completed: false,
                    setType: sIdx === 0 && pres.sets > 3 ? 'warmup' : 'normal',
                    rpe: pres.rpe || 8,
                    rir: pres.rpe ? 10 - pres.rpe : 2,
                  };

                  const isPr = curPr ? setItem.weightKg > curPr.weightKg : false;
                  const e1rm = Math.round(setItem.weightKg * (1 + setItem.reps / 30));
                  const isTargetRow = selectedSetByEx[pres.exerciseId] === sIdx && !setItem.completed;

                  return (
                    <div
                      key={sIdx}
                      onMouseDown={() =>
                        setSelectedSetByEx((prev) =>
                          prev[pres.exerciseId] === sIdx ? prev : { ...prev, [pres.exerciseId]: sIdx }
                        )
                      }
                      onFocus={() =>
                        setSelectedSetByEx((prev) =>
                          prev[pres.exerciseId] === sIdx ? prev : { ...prev, [pres.exerciseId]: sIdx }
                        )
                      }
                      className={`p-3 rounded-2xl border transition-all grid grid-cols-12 gap-2 items-center ${setItem.completed
                        ? 'bg-emerald-950/20 border-emerald-500/40 shadow-xs'
                        : isTargetRow
                          ? 'bg-rose-950/20 border-rose-500/40 shadow-xs'
                          : 'bg-white/[0.03] border-white/5 hover:border-white/15'
                        }`}
                    >
                      {/* 1. Hiệp & Loại Hiệp */}
                      <div className="col-span-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onCycleSetType(pres.exerciseId, sIdx)}
                          disabled={setItem.completed}
                          className={`px-2 py-1 rounded-xl text-xs font-mono font-black border transition-colors cursor-pointer ${setItem.setType === 'warmup'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : setItem.setType === 'dropset'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : setItem.setType === 'failure'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            }`}
                          title="Nhấp để đổi loại hiệp: [1] Chính • [W] Khởi động • [D] Drop set • [F] Thất bại"
                        >
                          {setItem.setType === 'warmup' ? 'W' : setItem.setType === 'dropset' ? 'D' : setItem.setType === 'failure' ? 'F' : `#${sIdx + 1}`}
                        </button>
                        <span className="text-[10px] text-white/50 font-mono hidden sm:inline">
                          {setItem.setType === 'warmup' ? 'Warmup' : setItem.setType === 'dropset' ? 'Dropset' : setItem.setType === 'failure' ? 'Fail' : 'Working'}
                        </span>
                      </div>

                      {/* 2. Lần Trước */}
                      <div className="col-span-2 text-center text-xs font-mono text-white/40">
                        {curPr ? `${curPr.weightKg}k × ${curPr.reps}` : '--'}
                      </div>

                      {/* 3. Mức Tạ (KG) */}
                      <div className="col-span-3 flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onUpdateSet(pres.exerciseId, sIdx, Math.max(0, setItem.weightKg - 2.5), setItem.reps)}
                          disabled={setItem.completed}
                          className="w-6 h-6 shrink-0 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          min="0"
                          value={setItem.weightKg}
                          onChange={(e) => onUpdateSet(pres.exerciseId, sIdx, Number(e.target.value) || 0, setItem.reps)}
                          disabled={setItem.completed}
                          className="w-14 sm:w-16 text-center py-1 px-1.5 rounded-xl bg-black/40 border border-white/10 text-white font-mono font-black text-sm tabular-nums disabled:opacity-70 focus:border-rose-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => onUpdateSet(pres.exerciseId, sIdx, setItem.weightKg + 2.5, setItem.reps)}
                          disabled={setItem.completed}
                          className="w-6 h-6 shrink-0 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30"
                        >
                          +
                        </button>

                        {/* Barbell Plate Calc */}
                        {setItem.weightKg >= 20 && (
                          <button
                            type="button"
                            onClick={() => onOpenPlateCalculator(setItem.weightKg)}
                            className="p-1 text-white/40 hover:text-rose-400 cursor-pointer text-xs ml-0.5 shrink-0"
                            title="Xếp bánh tạ đòn Olympic"
                          >
                            <Scale className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* 4. Số Reps */}
                      <div className="col-span-2 flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onUpdateSet(pres.exerciseId, sIdx, setItem.weightKg, Math.max(1, setItem.reps - 1))}
                          disabled={setItem.completed}
                          className="w-6 h-6 shrink-0 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          value={setItem.reps}
                          onChange={(e) => onUpdateSet(pres.exerciseId, sIdx, setItem.weightKg, Number(e.target.value) || 1)}
                          disabled={setItem.completed}
                          className="w-12 text-center py-1 px-1.5 rounded-xl bg-black/40 border border-white/10 text-white font-mono font-black text-sm tabular-nums disabled:opacity-70 focus:border-rose-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => onUpdateSet(pres.exerciseId, sIdx, setItem.weightKg, setItem.reps + 1)}
                          disabled={setItem.completed}
                          className="w-6 h-6 shrink-0 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>

                      {/* 5. 1RM Dự kiến */}
                      <div className="col-span-2 text-center font-mono text-xs hidden md:block">
                        <span className="text-white/60 font-bold">~{e1rm} kg</span>
                        {isPr && (
                          <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                            PR
                          </span>
                        )}
                      </div>

                      {/* 6. Nút Hoàn Thành */}
                      <div className="col-span-3 md:col-span-1 flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onToggleSet(pres.exerciseId, sIdx, pres.restSeconds)}
                          className={`p-2.5 rounded-xl font-bold cursor-pointer transition-all flex items-center justify-center ${setItem.completed
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-950/50'
                            : 'bg-white/10 hover:bg-emerald-600 hover:text-white text-white/60'
                            }`}
                          title={setItem.completed ? 'Bấm để hủy hoàn thành' : 'Ghi nhận hoàn thành hiệp'}
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Set Actions Bar */}
              <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onAddSet(pres.exerciseId)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm hiệp</span>
                  </button>

                  {pres.sets > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemoveSet(pres.exerciseId, pres.sets - 1)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/50 hover:text-rose-300 border border-white/10 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>Xóa hiệp cuối</span>
                    </button>
                  )}

                  {pres.sets > 1 && (
                    <button
                      type="button"
                      onClick={() => onCopyPrevSet(pres.exerciseId, pres.sets - 1)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                      title="Sao chép mức tạ và số reps từ hiệp trước sang hiệp cuối"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Chép hiệp trước</span>
                    </button>
                  )}
                </div>

                {(() => {
                  const explicitIdx = selectedSetByEx[pres.exerciseId];
                  const hasExplicit = explicitIdx !== undefined && explicitIdx >= 0 && explicitIdx < pres.sets;
                  const uncompletedIndices = Array.from({ length: pres.sets }, (_, i) => i).filter(
                    (i) => !activeSession.sets[`${pres.exerciseId}-${i}`]?.completed
                  );
                  const dropTargetIdx = hasExplicit
                    ? explicitIdx
                    : (uncompletedIndices[uncompletedIndices.length - 1] ?? Math.max(0, pres.sets - 1));
                  const warmupTargetIdx = hasExplicit
                    ? explicitIdx
                    : (uncompletedIndices[0] ?? 0);

                  return (
                    <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono">
                      <select
                        value={hasExplicit ? String(explicitIdx) : 'auto'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedSetByEx((prev) => {
                            const next = { ...prev };
                            if (val === 'auto') {
                              delete next[pres.exerciseId];
                            } else {
                              next[pres.exerciseId] = Number(val);
                            }
                            return next;
                          });
                        }}
                        className="px-2 py-1 rounded-xl bg-white/5 border border-white/15 text-white/80 text-[11px] font-mono focus:outline-none focus:border-rose-500 cursor-pointer"
                        title="Chọn hiệp mục tiêu để áp dụng Drop-set hoặc Khởi động (nhấp vào hàng bất kỳ để chọn nhanh)"
                      >
                        <option value="auto" className="bg-gray-900 text-white">
                          Hiệp tự động
                        </option>
                        {Array.from({ length: pres.sets }, (_, i) => (
                          <option key={`tgt-${pres.exerciseId}-${i}`} value={String(i)} className="bg-gray-900 text-white">
                            Hiệp #{i + 1}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          onApplyQuickScale(pres.exerciseId, dropTargetIdx, 0.8, 'dropset');
                          setSelectedSetByEx((prev) => ({ ...prev, [pres.exerciseId]: dropTargetIdx }));
                        }}
                        className="px-2.5 py-1 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold cursor-pointer transition-colors"
                        title={`Giảm 20% mức tạ & đánh dấu Dropset cho Hiệp #${dropTargetIdx + 1}`}
                      >
                        🔥 Drop-set #{dropTargetIdx + 1} (-20%)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onApplyQuickScale(pres.exerciseId, warmupTargetIdx, 0.6, 'warmup');
                          setSelectedSetByEx((prev) => ({ ...prev, [pres.exerciseId]: warmupTargetIdx }));
                        }}
                        className="px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold cursor-pointer transition-colors"
                        title={`Đặt mức tạ 60% & đánh dấu Khởi động (Warmup) cho Hiệp #${warmupTargetIdx + 1}`}
                      >
                        🏋️ Khởi động #{warmupTargetIdx + 1} (60%)
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. BOTTOM WORKOUT ACTIONS & CONFIRM CANCEL MODAL */}
      <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-white">Bạn Đã Hoàn Thành Xong?</h4>
          <p className="text-xs text-white/50 mt-0.5">
            Bấm hoàn thành để tự động ghi nhận vào lịch sử tập luyện, cập nhật kỷ lục PR và đồng bộ calo tiêu thụ.
          </p>
        </div>

        <button
          type="button"
          onClick={onFinishSession}
          disabled={stats.completedCount === 0}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-black uppercase tracking-wider flex items-center gap-2.5 cursor-pointer shadow-xl shadow-emerald-950/60 transition-all disabled:opacity-40 self-start sm:self-center shrink-0"
        >
          <Check className="w-5 h-5 stroke-[3]" />
          <span>Hoàn Thành &amp; Lưu Buổi Tập</span>
        </button>
      </div>

      {/* 5. FLOATING DYNAMIC REST TIMER ISLAND (ZENOX Dynamic Rest Timer Island) */}
      {restSecondsLeft !== null && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-300 max-w-[92vw]">
          <div className="flex items-center gap-3.5 px-5 py-3 rounded-2xl bg-[#0e0712]/95 border border-cyan-500/50 backdrop-blur-2xl shadow-2xl shadow-cyan-950/80 text-white">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 animate-pulse">
              <Clock className="w-5 h-5 text-cyan-400" />
            </div>

            <div className="min-w-0 pr-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-300 font-extrabold">
                Nghỉ giữa hiệp
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-white tracking-tight flex items-center gap-1.5">
                <span>{restSecondsLeft}s</span>
                <span className="text-xs font-medium text-white/50 hidden sm:inline">còn lại</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 border-l border-white/10 pl-2.5">
              <button
                type="button"
                onClick={() => onAdjustRestTimer(-15)}
                disabled={restSecondsLeft <= 15}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono font-bold cursor-pointer transition-colors disabled:opacity-30"
                title="Giảm 15 giây"
              >
                -15s
              </button>
              <button
                type="button"
                onClick={() => onAdjustRestTimer(30)}
                className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold cursor-pointer transition-colors shadow-sm"
                title="Tăng 30 giây"
              >
                +30s
              </button>
              <button
                type="button"
                onClick={onSkipRestTimer}
                className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold cursor-pointer transition-colors"
                title="Bỏ qua thời gian nghỉ"
              >
                Bỏ qua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Cancelling Workout */}
      {showConfirmCancel && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0b0307] border border-rose-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-white">Hủy Bỏ Phiên Tập?</h3>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              Bạn có chắc chắn muốn hủy phiên tập đang diễn ra? Toàn bộ các hiệp tạ vừa ghi nhận sẽ không được lưu vào lịch sử.
            </p>
            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowConfirmCancel(false)}
                className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold cursor-pointer hover:bg-white/15"
              >
                Tiếp tục tập
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmCancel(false);
                  onCancelSession();
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
              >
                Xác nhận hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Extra Exercise to Workout */}
      {showAddExModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0b0307] border border-white/20 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-black text-white">Thêm Bài Tập Vào Buổi Tập</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddExModal(false)}
                className="text-white/50 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-white/60">
              Chọn bài tập bổ sung cho buổi hôm nay (ZENOX Dynamic Exercise Swap):
            </p>

            <select
              value={extraExId}
              onChange={(e) => setExtraExId(e.target.value)}
              className="w-full py-2.5 px-3 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-semibold outline-none focus:border-rose-500"
            >
              <option value="" className="bg-[#0b0307] text-white">-- Chọn bài tập cần thêm --</option>
              {allAvailableExercises
                .filter((e) => !activeSession.prescriptions.some((p) => p.exerciseId === e.id))
                .map((e) => (
                  <option key={e.id} value={e.id} className="bg-[#0b0307] text-white">
                    {e.name} ({MUSCLE_LABEL[e.muscle as MuscleGroup]} • {e.equipment})
                  </option>
                ))}
            </select>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => setShowAddExModal(false)}
                className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold cursor-pointer hover:bg-white/15"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={!extraExId}
                onClick={() => {
                  if (extraExId) {
                    onAddExercise(extraExId);
                    setExtraExId('');
                    setShowAddExModal(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer disabled:opacity-40"
              >
                Thêm bài này
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

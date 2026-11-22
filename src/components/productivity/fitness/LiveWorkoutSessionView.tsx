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
  Copy,
  Sparkles,
  Trophy,
  Scale,
  Calendar,
  AlertTriangle,
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
  calculateBarbellPlates,
  calculateProgressiveOverload,
  compareProgressiveOverload,
  calculateMesocycleWeekPlan,
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
  onApplyQuickScale: (exerciseId: string, setIndex: number, factor: number) => void;
  onAddSet: (exerciseId: string) => void;
  onRemoveSet: (exerciseId: string, setIndex: number) => void;
  onAddExercise: (exerciseId: string) => void;
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

  const mesoPlan = useMemo(() => {
    return calculateMesocycleWeekPlan(activeMesoWeek);
  }, [activeMesoWeek]);

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
    // Estimated kcal (approx 5.5 kcal per completed working set)
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

  return (
    <div className="space-y-5 animate-in fade-in duration-300 pb-16">
      {/* 1. TOP STICKY GYM COMMAND BAR */}
      <div className="sticky top-2 z-40 bg-[#0c050e]/95 backdrop-blur-xl border border-rose-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Title & Live indicator */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-900/50 animate-pulse">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span className="text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Tracked.gg Live Workstation
                </span>
                <span className="text-xs text-white/50 font-mono">
                  Bắt đầu lúc {new Date(activeSession.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mt-0.5 tracking-tight flex items-center gap-2">
                <span>{activeSession.planned.title}</span>
                {stats.prCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    {stats.prCount} PR mới
                  </span>
                )}
              </h2>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <button
              type="button"
              onClick={onMinimize}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Thu nhỏ để xem các tab khác mà không mất buổi tập"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Thu nhỏ</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfirmCancel(true)}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/60 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Hủy buổi tập đang chạy"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hủy</span>
            </button>

            <button
              type="button"
              onClick={onFinishSession}
              disabled={stats.completedCount === 0}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Hoàn Thành Buổi Tập ({stats.completedCount}/{stats.totalCount})</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 border-t border-white/5 text-center">
          <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="text-[10px] text-white/40 uppercase font-bold font-mono">Thời Gian Tập</div>
            <div className="text-base sm:text-lg font-black text-white font-mono mt-0.5">
              {formatTime(elapsedSeconds)}
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="text-[10px] text-white/40 uppercase font-bold font-mono">Tổng Tải Lượng</div>
            <div className="text-base sm:text-lg font-black text-rose-400 font-mono mt-0.5">
              {stats.volumeKg.toLocaleString()} kg
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="text-[10px] text-white/40 uppercase font-bold font-mono">Tiến Độ Hiệp</div>
            <div className="text-base sm:text-lg font-black text-emerald-400 font-mono mt-0.5">
              {stats.completedCount} / {stats.totalCount}
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="text-[10px] text-white/40 uppercase font-bold font-mono">Ước Tính Tiêu Hao</div>
            <div className="text-base sm:text-lg font-black text-amber-400 font-mono mt-0.5">
              ~{stats.kcal} kcal
            </div>
          </div>
        </div>

        {/* Scientific RP Hypertrophy Guidance Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-cyan-950/20 to-transparent border border-cyan-500/20 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-bold text-white">Tuần {mesoPlan.weekNumber}: {mesoPlan.title.split(': ')[1]} ({mesoPlan.stage.toUpperCase()})</span>
            <span className="text-cyan-300 font-mono font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
              Mục Tiêu: RIR {mesoPlan.targetRir} · RPE {mesoPlan.targetRpe}
            </span>
          </div>
          <div className="text-[11px] text-white/60">
            {mesoPlan.summary}
          </div>
        </div>

        {/* Sticky Rest Timer Countdown */}
        <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
          restSecondsLeft !== null
            ? 'bg-blue-500/15 border-blue-500/40 shadow-lg shadow-blue-950/40'
            : 'bg-white/[0.02] border-white/5'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <Clock className={`w-4 h-4 text-blue-400 shrink-0 ${restSecondsLeft !== null ? 'animate-spin' : ''}`} />
            <div className="text-xs truncate">
              {restSecondsLeft !== null ? (
                <span className="font-bold text-blue-200 font-mono text-sm">
                  Đang nghỉ giữa hiệp: <strong className="text-white text-base">{restSecondsLeft}s</strong> còn lại
                </span>
              ) : (
                <span className="text-white/50 font-medium">
                  Đồng hồ nghỉ: Sẵn sàng hiệp tiếp theo
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {restSecondsLeft !== null ? (
              <>
                <button
                  type="button"
                  onClick={() => onAdjustRestTimer(30)}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer transition-colors"
                >
                  +30s
                </button>
                <button
                  type="button"
                  onClick={onSkipRestTimer}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-[11px] font-bold cursor-pointer transition-colors"
                >
                  Bỏ qua
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1 font-mono text-[10px]">
                <span className="text-white/40 mr-1 hidden sm:inline">Chuẩn:</span>
                {[60, 90, 120, 180].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      onSetRestTimerTotal(s);
                      onAdjustRestTimer(s);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white cursor-pointer"
                  >
                    {s}s
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. EXERCISE CARDS WORKSTATION */}
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
              className="bg-[#0b040c] rounded-3xl border border-white/10 p-5 shadow-xl space-y-4 relative overflow-hidden"
            >
              {/* Exercise Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-xl bg-white/5 border border-white/10 text-white/60 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    #{pIdx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[9px] px-2 py-0.2 rounded font-bold uppercase"
                        style={{ backgroundColor: `${color}25`, color }}
                      >
                        {ex ? MUSCLE_LABEL[ex.muscle as MuscleGroup] : 'Cơ'} · {ex?.equipment}
                      </span>
                      <h3 className="font-black text-base sm:text-lg text-white">
                        {ex?.name || pres.exerciseId}
                      </h3>
                    </div>
                    {ex?.cue && (
                      <p className="text-xs text-white/40 italic mt-0.5">
                        💡 {ex.cue}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center font-mono text-xs">
                  <span className="text-white/40">
                    Mục tiêu: <strong className="text-white">{pres.reps} reps · RPE {pres.rpe}</strong>
                  </span>
                  {curPr && (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[11px] flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-amber-400" />
                      PR: {curPr.weightKg}kg × {curPr.reps}
                    </span>
                  )}
                </div>
              </div>

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

                  return (
                    <div
                      key={sIdx}
                      className={`p-3 rounded-2xl border transition-all grid grid-cols-12 gap-2 items-center ${
                        setItem.completed
                          ? 'bg-emerald-950/20 border-emerald-500/40 shadow-xs'
                          : 'bg-white/[0.03] border-white/5 hover:border-white/15'
                      }`}
                    >
                      {/* 1. Hiệp & Loại Hiệp */}
                      <div className="col-span-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onCycleSetType(pres.exerciseId, sIdx)}
                          disabled={setItem.completed}
                          className={`px-2 py-1 rounded-xl text-xs font-mono font-black border transition-colors cursor-pointer ${
                            setItem.setType === 'warmup'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : setItem.setType === 'dropset'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : setItem.setType === 'failure'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                          }`}
                          title="Nhấp đổi loại hiệp: [1] Chính · [W] Khởi động · [D] Drop set · [F] Thất bại"
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
                          className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={setItem.weightKg}
                          onChange={(e) => onUpdateSet(pres.exerciseId, sIdx, Number(e.target.value) || 0, setItem.reps)}
                          disabled={setItem.completed}
                          className="w-14 text-center py-1 px-1 rounded-xl bg-black/40 border border-white/10 text-white font-mono font-black text-sm disabled:opacity-70"
                        />
                        <button
                          type="button"
                          onClick={() => onUpdateSet(pres.exerciseId, sIdx, setItem.weightKg + 2.5, setItem.reps)}
                          disabled={setItem.completed}
                          className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30"
                        >
                          +
                        </button>

                        {/* Barbell Plate Calc */}
                        {setItem.weightKg >= 20 && (
                          <button
                            type="button"
                            onClick={() => onOpenPlateCalculator(setItem.weightKg)}
                            className="p-1 text-white/40 hover:text-rose-400 cursor-pointer text-xs ml-0.5"
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
                          className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={setItem.reps}
                          onChange={(e) => onUpdateSet(pres.exerciseId, sIdx, setItem.weightKg, Number(e.target.value) || 1)}
                          disabled={setItem.completed}
                          className="w-11 text-center py-1 px-1 rounded-xl bg-black/40 border border-white/10 text-white font-mono font-black text-sm disabled:opacity-70"
                        />
                        <button
                          type="button"
                          onClick={() => onUpdateSet(pres.exerciseId, sIdx, setItem.weightKg, setItem.reps + 1)}
                          disabled={setItem.completed}
                          className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30"
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
                          className={`p-2.5 rounded-xl font-bold cursor-pointer transition-all flex items-center justify-center ${
                            setItem.completed
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
                <div className="flex items-center gap-1.5">
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
                </div>

                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => onApplyQuickScale(pres.exerciseId, pres.sets - 1, 0.8)}
                    className="px-2.5 py-1 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold cursor-pointer transition-colors"
                  >
                    🔥 Drop-set (-20%)
                  </button>
                  <button
                    type="button"
                    onClick={() => onApplyQuickScale(pres.exerciseId, pres.sets - 1, 0.6)}
                    className="px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold cursor-pointer transition-colors"
                  >
                    🏋️ Khởi động (60%)
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. BOTTOM WORKOUT ACTIONS & CONFIRM CANCEL MODAL */}
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
    </div>
  );
};

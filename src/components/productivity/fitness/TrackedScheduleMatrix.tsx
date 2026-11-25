import React, { useMemo } from 'react';
import {
  Calendar,
  Dumbbell,
  CheckCircle2,
  Clock,
  Flame,
  Zap,
  Play,
  Sparkles,
  ChevronRight,
  Trophy,
  Moon,
  Activity,
  Award,
} from 'lucide-react';
import {
  CtgRoadmapPhase,
  MuscleGroup,
  PlannedSession,
  RoutineSplitTemplate,
  WorkoutSession,
  MUSCLE_LABEL,
  MUSCLE_COLOR,
} from '../../../types/productivity';
import { exerciseById, todayString } from '../../../utils/fitnessMetrics';

export interface TrackedScheduleMatrixProps {
  plannedSessions: PlannedSession[];
  workoutSessions: WorkoutSession[];
  activePhase?: CtgRoadmapPhase | null;
  onStartSession: (session: PlannedSession) => void;
  onScheduleToCalendar?: (session: PlannedSession) => void;
  onQuickLog?: (session: PlannedSession) => void;
  onSelectSplit?: (split: RoutineSplitTemplate) => void;
  currentSplit?: RoutineSplitTemplate;
  lang?: 'vi' | 'en';
}

const DAYS_OF_WEEK = [
  { dayIndex: 0, label: 'Thứ 2', short: 'T2' },
  { dayIndex: 1, label: 'Thứ 3', short: 'T3' },
  { dayIndex: 2, label: 'Thứ 4', short: 'T4' },
  { dayIndex: 3, label: 'Thứ 5', short: 'T5' },
  { dayIndex: 4, label: 'Thứ 6', short: 'T6' },
  { dayIndex: 5, label: 'Thứ 7', short: 'T7' },
  { dayIndex: 6, label: 'Chủ Nhật', short: 'CN' },
];

export const TrackedScheduleMatrix: React.FC<TrackedScheduleMatrixProps> = ({
  plannedSessions,
  workoutSessions,
  activePhase,
  onStartSession,
  onScheduleToCalendar,
  onQuickLog,
  onSelectSplit,
  currentSplit,
  lang = 'vi',
}) => {
  const today = todayString();

  // 1. Current Week Dates (Monday -> Sunday)
  const weekDays = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diff);

    return DAYS_OF_WEEK.map((d, idx) => {
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + idx);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const dayNum = String(dt.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dayNum}`;

      // Find planned session for this day index
      const planned = plannedSessions.find((p) => {
        if (p.dayIndex !== undefined) return p.dayIndex === d.dayIndex;
        return p.dayOfWeek === d.label;
      });

      // Find actual completed workout on this date
      const completed = workoutSessions.filter((w) => w.date === dateStr);

      const isToday = dateStr === today;
      const isPast = dateStr < today;

      return {
        ...d,
        dateStr,
        dayNum: dt.getDate(),
        isToday,
        isPast,
        planned,
        completed,
        isCompleted: completed.length > 0,
      };
    });
  }, [plannedSessions, workoutSessions, today]);

  // 2. Today's Hero Workout
  const todaySchedule = useMemo(() => {
    return weekDays.find((d) => d.isToday);
  }, [weekDays]);

  // 3. Weekly Adherence Score
  const adherence = useMemo(() => {
    const totalPlannedInWeek = weekDays.filter((d) => Boolean(d.planned)).length;
    const completedPlannedCount = weekDays.filter((d) => Boolean(d.planned) && d.isCompleted).length;
    const pct = totalPlannedInWeek > 0 ? Math.round((completedPlannedCount / totalPlannedInWeek) * 100) : 100;
    return {
      total: totalPlannedInWeek,
      completed: completedPlannedCount,
      percentage: pct,
    };
  }, [weekDays]);

  // 4. Muscle Recovery & Readiness Index (ZENOX Signature)
  const muscleRecovery = useMemo(() => {
    const TRACKED_MUSCLES: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
    const nowMs = Date.now();

    return TRACKED_MUSCLES.map((muscle) => {
      // Find the latest workout session that had an exercise targeting this muscle
      let latestTime: number | null = null;
      let latestTitle = '';

      for (const sess of [...workoutSessions].sort((a, b) => b.startedAt - a.startedAt)) {
        const hasMuscle = sess.sets.some((s) => {
          const ex = exerciseById(s.exerciseId);
          return ex?.muscle === muscle;
        });

        if (hasMuscle) {
          latestTime = sess.startedAt;
          latestTitle = sess.title;
          break;
        }
      }

      if (!latestTime) {
        return {
          muscle,
          label: MUSCLE_LABEL[muscle] || muscle,
          color: MUSCLE_COLOR[muscle] || '#10B981',
          readinessPct: 100,
          statusText: '100% Sẵn sàng',
          timeText: 'Chưa tập tuần này',
          badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        };
      }

      const hoursElapsed = Math.max(0, Math.round((nowMs - latestTime) / (1000 * 60 * 60)));

      if (hoursElapsed >= 48) {
        return {
          muscle,
          label: MUSCLE_LABEL[muscle] || muscle,
          color: MUSCLE_COLOR[muscle] || '#10B981',
          readinessPct: 100,
          statusText: '100% Sẵn sàng',
          timeText: `Tập ${hoursElapsed}h trước`,
          badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        };
      } else if (hoursElapsed >= 24) {
        const pct = Math.round(50 + ((hoursElapsed - 24) / 24) * 45);
        return {
          muscle,
          label: MUSCLE_LABEL[muscle] || muscle,
          color: MUSCLE_COLOR[muscle] || '#F59E0B',
          readinessPct: pct,
          statusText: `${pct}% Đang phục hồi`,
          timeText: `Tập ${hoursElapsed}h trước`,
          badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        };
      } else {
        const pct = Math.round(20 + (hoursElapsed / 24) * 30);
        return {
          muscle,
          label: MUSCLE_LABEL[muscle] || muscle,
          color: MUSCLE_COLOR[muscle] || '#F43F5E',
          readinessPct: pct,
          statusText: 'Cơ đang mỏi (Mới tập)',
          timeText: `Tập ${hoursElapsed}h trước`,
          badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        };
      }
    });
  }, [workoutSessions]);

  return (
    <div className="space-y-4">
      {/* 1. Header with Adherence Badge */}
      <div className="bg-[#0b050d] rounded-3xl border border-white/10 p-5 shadow-xl relative overflow-hidden space-y-4">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  ZENOX Split Matrix
                </span>
                <span className="text-xs text-white/50 font-mono">
                  Lịch Tập Tuần Này
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
                Ma Trận Phân Bổ Giáo Án &amp; Phục Hồi Cơ Bắp
              </h3>
            </div>
          </div>

          {/* Adherence Badge */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <div className="px-3.5 py-1.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <div className="text-xs">
                <span className="text-white/50 text-[10px] block uppercase font-mono">Độ Bám Sát Tuần</span>
                <span className="font-mono font-black text-white">
                  {adherence.completed}/{adherence.total} Buổi ({adherence.percentage}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. 7-Day Visual Matrix Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {weekDays.map((d) => {
            const hasWorkout = Boolean(d.planned);
            const isDone = d.isCompleted;

            return (
              <div
                key={d.dayIndex}
                className={`p-3 rounded-2xl border flex flex-col justify-between transition-all relative overflow-hidden ${
                  d.isToday
                    ? 'bg-rose-500/10 border-rose-500/50 ring-2 ring-rose-500/30 shadow-lg shadow-rose-950/40'
                    : isDone
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : hasWorkout
                    ? 'bg-white/[0.02] border-white/10 hover:border-white/20'
                    : 'bg-black/20 border-white/5 opacity-60'
                }`}
              >
                {/* Day Header */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[11px] font-mono font-bold ${
                      d.isToday ? 'text-rose-400' : 'text-white/60'
                    }`}>
                      {d.label}
                    </span>
                    <span className={`text-xs font-mono font-black ${
                      d.isToday ? 'text-white px-1.5 py-0.2 rounded-md bg-rose-600' : 'text-white/40'
                    }`}>
                      {d.dayNum}
                    </span>
                  </div>

                  {/* Body Content */}
                  {hasWorkout ? (
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-white truncate">
                        {d.planned?.title.replace(/\(.*\)/, '').trim()}
                      </div>
                      <div className="text-[10px] text-white/50 font-mono">
                        {d.planned?.prescriptions.length} bài tập
                      </div>

                      {/* Status Tag */}
                      <div className="pt-1">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Đã tập ({d.completed[0]?.sets.length || 0}s)
                          </span>
                        ) : d.isToday ? (
                          <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-rose-500 text-white font-bold animate-pulse">
                            <Flame className="w-2.5 h-2.5" />
                            Hôm nay
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-medium">
                            Kế hoạch
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 py-1">
                      <div className="text-xs font-medium text-white/40 flex items-center gap-1">
                        <Moon className="w-3 h-3 text-white/30" />
                        <span>Nghỉ ngơi</span>
                      </div>
                      <div className="text-[9px] text-white/30 leading-tight">
                        Tái tạo cơ &amp; khớp
                      </div>
                    </div>
                  )}
                </div>

                {/* Day Action */}
                {hasWorkout && !isDone && (
                  <div className="pt-2 mt-2 border-t border-white/5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => d.planned && onStartSession(d.planned)}
                      className="text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Tập</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>

                    {onScheduleToCalendar && (
                      <button
                        type="button"
                        onClick={() => d.planned && onScheduleToCalendar(d.planned)}
                        className="text-[10px] text-white/40 hover:text-white cursor-pointer"
                        title="Lên lịch"
                      >
                        <Calendar className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 3. Today's Hero Workout Launchpad */}
        {todaySchedule?.planned && !todaySchedule.isCompleted && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 via-orange-950/20 to-black/40 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-900/40 animate-pulse">
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Buổi Tập Hôm Nay
                  </span>
                  <span className="text-xs text-white/50">
                    {todaySchedule.planned.prescriptions.length} bài tập · Ước tính 60-75 phút
                  </span>
                </div>
                <h4 className="text-base font-black text-white mt-0.5">
                  {todaySchedule.planned.title}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              {onQuickLog && (
                <button
                  type="button"
                  onClick={() => onQuickLog(todaySchedule.planned!)}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-bold cursor-pointer transition-colors"
                >
                  Ghi nhanh (Xong)
                </button>
              )}
              <button
                type="button"
                onClick={() => onStartSession(todaySchedule.planned!)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-900/40 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Bắt Đầu Phiên Tập Ngay</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. Muscle Recovery & Readiness Index (ZENOX Signature) */}
        <div className="pt-2 border-t border-white/5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Chỉ Số Hồi Phục Nhóm Cơ (Muscle Recovery &amp; Freshness Radar)
              </span>
            </div>
            <span className="text-[10px] text-white/40 font-mono">
              Dựa trên nhật ký tập luyện 7 ngày qua
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {muscleRecovery.map((m) => (
              <div
                key={m.muscle}
                className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{m.label}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-bold ${m.badgeColor}`}>
                    {m.readinessPct}%
                  </span>
                </div>

                {/* Battery / Progress Bar */}
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${m.readinessPct}%`,
                      backgroundColor: m.color,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-white/40 font-mono">
                  <span>{m.timeText}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

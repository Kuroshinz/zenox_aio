import React, { useMemo } from 'react';
import { ShieldCheck, BatteryCharging, Sparkles, Zap, ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react';
import { WorkoutSession, CtgRoadmapPhase } from '../../../types/productivity';
import { weeklyVolume, todayString } from '../../../utils/fitnessMetrics';

export interface CtgDeloadAdvisorProps {
  workoutSessions: WorkoutSession[];
  activePhase?: CtgRoadmapPhase | null;
  onApplyDeloadWeek?: () => void;
  lang?: 'vi' | 'en';
}

export const CtgDeloadAdvisor: React.FC<CtgDeloadAdvisorProps> = ({
  workoutSessions,
  activePhase,
  onApplyDeloadWeek,
  lang = 'vi',
}) => {
  const today = todayString();

  // Analyze consecutive training weeks and volume trend
  const { consecutiveWeeks, totalWorkoutsLast4Weeks, isDeloadRecommended, reason } = useMemo(() => {
    const rawVolume = weeklyVolume(workoutSessions, 6, today);
    const activeWeeks = rawVolume.filter((v) => v.volume > 1000);
    const cWeeks = activeWeeks.length;

    const fourWeeksWorkouts = workoutSessions.filter((w) => {
      const diffDays = Math.round((Date.now() - w.startedAt) / (1000 * 60 * 60 * 24));
      return diffDays <= 28;
    }).length;

    const shouldDeload = cWeeks >= 4 || fourWeeksWorkouts >= 18;

    let resReason = '';
    if (cWeeks >= 5) {
      resReason = `Bạn đã duy trì ${cWeeks} tuần tập kháng lực cường độ cao liên tục. Khớp và hệ thần kinh trung ương (CNS) cần 1 tuần Deload để siêu bù đắp (Supercompensation).`;
    } else if (fourWeeksWorkouts >= 18) {
      resReason = `Bạn đã hoàn thành ${fourWeeksWorkouts} buổi tập trong 4 tuần qua. Tần suất tập dày đặc đang tích lũy mệt mỏi hệ thống.`;
    } else {
      resReason = `Đang ở tuần thứ ${cWeeks || 1} của chu kỳ Mesocycle. Mức độ mệt mỏi vẫn trong ngưỡng kích thích cơ bắp tối ưu.`;
    }

    return {
      consecutiveWeeks: cWeeks,
      totalWorkoutsLast4Weeks: fourWeeksWorkouts,
      isDeloadRecommended: shouldDeload,
      reason: resReason,
    };
  }, [workoutSessions, today]);

  if (!isDeloadRecommended && consecutiveWeeks < 3) return null;

  return (
    <div className={`p-4 sm:p-5 rounded-3xl border transition-all relative overflow-hidden space-y-3.5 ${
      isDeloadRecommended
        ? 'bg-gradient-to-r from-amber-950/30 via-indigo-950/20 to-black/40 border-amber-500/40 shadow-xl'
        : 'bg-white/[0.02] border-white/10'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
            isDeloadRecommended
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
          }`}>
            {isDeloadRecommended ? <BatteryCharging className="w-5 h-5 animate-pulse" /> : <ShieldCheck className="w-5 h-5" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.2 rounded-full border ${
                isDeloadRecommended
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-white/10 text-white/60 border-white/10'
              }`}>
                {isDeloadRecommended ? 'ZENOX Fatigue Management · Khuyến Nghị Deload' : 'Mesocycle Fatigue Index'}
              </span>
              <span className="text-xs text-white/50 font-mono">
                Tuần {consecutiveWeeks || 1}/6 của chu kỳ
              </span>
            </div>
            <h4 className="text-base font-black text-white mt-0.5">
              {isDeloadRecommended
                ? 'Đã Đến Lúc Kích Hoạt Tuần Deload Phục Hồi Thần Kinh'
                : 'Mức Độ Mệt Mỏi Hệ Thống Đang Trong Ngưỡng Tốt'}
            </h4>
          </div>
        </div>

        {isDeloadRecommended && onApplyDeloadWeek && (
          <button
            type="button"
            onClick={onApplyDeloadWeek}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold cursor-pointer transition-all shadow-lg shadow-amber-950/40 flex items-center gap-2 self-start sm:self-center shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Kích Hoạt Tuần Deload (-40% Volume)</span>
          </button>
        )}
      </div>

      <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-xs text-white/70 leading-relaxed">
        <p>{reason}</p>
        {isDeloadRecommended && (
          <div className="mt-2 pt-2 border-t border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
            <div className="text-amber-300">
              ✓ <strong>Giảm 40-50% số sets:</strong> Mỗi bài tập 2 hiệp thay vì 4 hiệp.
            </div>
            <div className="text-emerald-300">
              ✓ <strong>Giữ nguyên mức tạ:</strong> Duy trì cường độ để bảo toàn sức mạnh thần kinh.
            </div>
            <div className="text-blue-300">
              ✓ <strong>Duy trì calo TDEE:</strong> Ăn đủ mức duy trì để tái tạo mô liên kết.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

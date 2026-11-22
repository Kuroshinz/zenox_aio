import React, { useState, useMemo } from 'react';
import {
  Compass,
  Calendar,
  TrendingUp,
  Target,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  Layers,
  Dumbbell,
  CheckCircle2,
  Award,
  Zap,
  ArrowRight,
} from 'lucide-react';
import {
  CtgPeriodizedRoadmap,
  CtgRoadmapPhase,
} from '../../../types/productivity';
import {
  calculateMesocycleWeekPlan,
  MesocycleWeekInfo,
} from '../../../utils/fitnessMetrics';

interface MesocycleProgressionStudioProps {
  currentWeekNumber?: number;
  onSelectWeek?: (weekNumber: number) => void;
  activePhase?: CtgRoadmapPhase | null;
}

export const MesocycleProgressionStudio: React.FC<MesocycleProgressionStudioProps> = ({
  currentWeekNumber = 1,
  onSelectWeek,
  activePhase,
}) => {
  const [selectedWeek, setSelectedWeek] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('vortexcal_active_mesocycle_week');
      return saved ? parseInt(saved, 10) : currentWeekNumber;
    } catch {
      return currentWeekNumber;
    }
  });
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Lấy thông tin tuần đang chọn theo RP Periodization
  const weekInfo: MesocycleWeekInfo = useMemo(() => {
    return calculateMesocycleWeekPlan(selectedWeek);
  }, [selectedWeek]);

  const allWeeks: MesocycleWeekInfo[] = useMemo(() => {
    return [1, 2, 3, 4, 5].map((w) => calculateMesocycleWeekPlan(w));
  }, []);

  const handleWeekChange = (w: number) => {
    setSelectedWeek(w);
    try {
      localStorage.setItem('vortexcal_active_mesocycle_week', String(w));
      window.dispatchEvent(new Event('vortexcal_meso_week_changed'));
    } catch {
      // ignore
    }
    if (onSelectWeek) {
      onSelectWeek(w);
    }
  };

  return (
    <div className="bg-gradient-to-br from-[#0b1320] via-[#0f172a] to-[#070b14] border border-indigo-500/30 rounded-3xl p-4 sm:p-6 shadow-xl text-white relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-300 bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                Mesocycle Periodization
              </span>
              <span className="text-[10px] text-white/50">Dr. Mike Israetel (RP) Model</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5 flex items-center gap-2">
              <span>Chu Kỳ Hóa Tải Trọng 5 Tuần (Volume & RIR Progression)</span>
              {activePhase && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                  {activePhase.name}
                </span>
              )}
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/70 hover:text-white transition-colors cursor-pointer self-end sm:self-auto"
          title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-5 space-y-6 relative z-10">
          {/* Week Selector Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {allWeeks.map((w) => {
              const isSelected = selectedWeek === w.weekNumber;
              return (
                <button
                  key={w.weekNumber}
                  type="button"
                  onClick={() => handleWeekChange(w.weekNumber)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? 'bg-gradient-to-br from-indigo-900/60 to-blue-900/40 border-indigo-400 text-white shadow-lg shadow-indigo-500/20 scale-[1.02]'
                      : 'bg-white/[0.03] border-white/[0.08] text-white/70 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-extrabold uppercase tracking-wider text-[11px]">Tuần {w.weekNumber}</span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        w.stage === 'deload'
                          ? 'bg-emerald-950 text-emerald-300'
                          : w.stage === 'overreach_mrv'
                          ? 'bg-rose-950 text-rose-300'
                          : 'bg-indigo-950 text-indigo-300'
                      }`}
                    >
                      {w.stage === 'deload'
                        ? 'DELOAD'
                        : w.stage === 'overreach_mrv'
                        ? 'PEAK'
                        : w.stage === 'entry_mev'
                        ? 'MEV'
                        : 'MAV'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white truncate">{w.title.split(': ')[1]}</div>
                  <div className="text-[10px] text-white/50 font-mono mt-1">
                    RIR {w.targetRir} · {Math.round(w.volumeMultiplier * 100)}% Vol
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Week Details Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 block">
                  Đặc tính tuần huấn luyện
                </span>
                <h4 className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
                  <Target className="w-4 h-4 text-indigo-400" />
                  <span>{weekInfo.title}</span>
                </h4>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-3 py-1 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 font-bold">
                  Mục Tiêu: RIR {weekInfo.targetRir} (RPE {weekInfo.targetRpe})
                </span>
                <span className="px-3 py-1 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-bold">
                  Tải trọng: {Math.round(weekInfo.volumeMultiplier * 100)}% Volume
                </span>
              </div>
            </div>

            {/* Summary & Scientific Rationale */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-xs font-bold text-white/60 uppercase tracking-wider block">
                  Mục tiêu tuần & Cảm giác tập:
                </span>
                <p className="text-xs text-white/90 leading-relaxed font-medium">
                  {weekInfo.summary}
                </p>
                <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-200">
                  <strong className="block mb-1 text-indigo-300">Cơ chế khoa học (Scientific Rationale):</strong>
                  <span>{weekInfo.scientificRationale}</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-white/60 uppercase tracking-wider block">
                  Chỉ dẫn hành động phòng gym:
                </span>
                <ul className="space-y-2 text-xs text-white/80">
                  {weekInfo.actionGuidance.map((act, aIdx) => (
                    <li key={aIdx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

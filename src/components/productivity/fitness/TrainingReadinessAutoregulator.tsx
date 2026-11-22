import React, { useState, useMemo } from 'react';
import {
  Activity,
  Heart,
  Moon,
  Zap,
  Flame,
  ShieldCheck,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BarChart3,
  Dumbbell,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import {
  PlannedSession,
  Exercise,
  MuscleGroup,
  MUSCLE_LABEL,
  MUSCLE_COLOR,
} from '../../../types/productivity';
import {
  TrainingReadinessInput,
  calculateTrainingReadiness,
  evaluateSplitScientificQuality,
} from '../../../utils/fitnessMetrics';

interface TrainingReadinessAutoregulatorProps {
  plannedSessions: PlannedSession[];
  customExercises?: Exercise[];
  onApplyReadinessAdjustment?: (factor: number) => void;
}

export const TrainingReadinessAutoregulator: React.FC<TrainingReadinessAutoregulatorProps> = ({
  plannedSessions,
  customExercises = [],
  onApplyReadinessAdjustment,
}) => {
  const [sleepHours, setSleepHours] = useState<number>(7.5);
  const [sleepQuality, setSleepQuality] = useState<number>(4); // 1-5
  const [sorenessLevel, setSorenessLevel] = useState<number>(4); // 1-5 (5=tươi mới)
  const [jointComfort, setJointComfort] = useState<number>(4); // 1-5 (5=không đau khớp)
  const [stressEnergy, setStressEnergy] = useState<number>(4); // 1-5 (5=tràn đầy năng lượng)
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'readiness' | 'splitAnalysis'>('readiness');
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Tính Readiness Score theo công thức khoa học
  const readiness = useMemo(() => {
    return calculateTrainingReadiness({
      sleepHours,
      sleepQuality,
      sorenessLevel,
      jointAche: jointComfort,
      stressEnergy,
    });
  }, [sleepHours, sleepQuality, sorenessLevel, jointComfort, stressEnergy]);

  // Phân tích chất lượng lịch tập theo khoa học (RP & Schoenfeld)
  const splitEval = useMemo(() => {
    return evaluateSplitScientificQuality(plannedSessions, customExercises);
  }, [plannedSessions, customExercises]);

  const handleCopyReport = () => {
    const text = [
      '📊 BÁO CÁO PHỤC HỒI & ĐỘ SẴN SÀNG (AUTOREGULATION CHECK-IN)',
      `• Điểm sẵn sàng: ${readiness.score}/100 (${readiness.level.toUpperCase()})`,
      `• Đánh giá: ${readiness.title}`,
      `• Chỉ dẫn: ${readiness.actionHeadline}`,
      `• Giấc ngủ: ${sleepHours}h (Chất lượng ${sleepQuality}/5)`,
      `• Mỏi cơ (DOMS): ${sorenessLevel}/5 | Khớp: ${jointComfort}/5 | Năng lượng: ${stressEnergy}/5`,
      `• Phân bổ lịch tập: Tần suất trung bình ${splitEval.averageFrequency}x / tuần (Điểm tối ưu: ${splitEval.scientificScore}/100)`,
      `• Khuyến nghị thể tích: ${readiness.volumeAdjustmentPct >= 0 ? '+' : ''}${readiness.volumeAdjustmentPct}% volume`,
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  return (
    <div className="bg-gradient-to-br from-[#0e131f] via-[#111827] to-[#0b0f19] border border-blue-500/30 rounded-3xl p-4 sm:p-6 shadow-xl text-white relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white shrink-0">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                Autoregulation & Exercise Science
              </span>
              <span className="text-[10px] text-white/50">RP & ISSN Standard</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5 flex items-center gap-2">
              <span>Độ Sẵn Sàng & Phân Bổ Lịch Tập Khoa Học</span>
            </h3>
          </div>
        </div>

        {/* Tab switchers & collapse */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-white/[0.05] border border-white/[0.08] rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('readiness')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'readiness'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Điểm Sẵn Sàng</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('splitAnalysis')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'splitAnalysis'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Phân Bổ Lịch Tập ({splitEval.scientificScore}đ)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/70 hover:text-white transition-colors cursor-pointer"
            title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-5 space-y-6 relative z-10">
          {/* TAB 1: READINESS AUTOREGULATION */}
          {activeTab === 'readiness' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Score Display Card */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 flex flex-col justify-between relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-extrabold tracking-wider text-white/60">
                      Readiness Score
                    </span>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${readiness.color}20`, color: readiness.color }}
                    >
                      {readiness.level.toUpperCase()}
                    </span>
                  </div>

                  <div className="my-3 flex items-baseline gap-2">
                    <span
                      className="text-4xl sm:text-5xl font-black font-mono tracking-tight"
                      style={{ color: readiness.color }}
                    >
                      {readiness.score}
                    </span>
                    <span className="text-sm text-white/40 font-mono font-bold">/ 100</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-white/[0.1] h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${readiness.score}%`,
                        backgroundColor: readiness.color,
                      }}
                    />
                  </div>

                  <p className="text-xs text-white/70 mt-3 font-medium">
                    {readiness.actionHeadline}
                  </p>
                </div>

                {/* Directive & Advice */}
                <div className="md:col-span-8 rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>{readiness.title}</span>
                      </h4>
                      <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-md">
                        {readiness.volumeAdjustmentPct >= 0 ? '+' : ''}
                        {readiness.volumeAdjustmentPct}% Khối lượng mục tiêu
                      </span>
                    </div>

                    <ul className="space-y-2 mt-3 text-xs text-white/80">
                      {readiness.detailedAdvice.map((adv, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                          <span>{adv}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {onApplyReadinessAdjustment && readiness.volumeAdjustmentPct !== 0 && (
                    <div className="pt-3 border-t border-white/[0.08] mt-3 flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleCopyReport}
                        className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/80 hover:text-white text-xs font-semibold border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Sao chép tóm tắt chẩn đoán phục hồi"
                      >
                        {copiedReport ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300">Đã sao chép!</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Sao Chép Chẩn Đoán</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onApplyReadinessAdjustment(readiness.volumeAdjustmentPct)}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Áp dụng gợi ý vào buổi tập hôm nay</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Assessment Sliders */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Đánh Giá Chỉ Số Phục Hồi Hàng Ngày (Autoregulation Check-in)</span>
                  </span>
                  <span className="text-[11px] text-white/40">Kéo thanh trượt để cập nhật</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* 1. Giấc ngủ */}
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/70 flex items-center gap-1">
                        <Moon className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Thời lượng ngủ</span>
                      </span>
                      <span className="font-mono font-bold text-indigo-300">{sleepHours}h</span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={10}
                      step={0.5}
                      value={sleepHours}
                      onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-white/40 font-mono">
                      <span>4h (Thiếu)</span>
                      <span>8h (Chuẩn)</span>
                      <span>10h</span>
                    </div>
                  </div>

                  {/* 2. Độ tươi mới cơ bắp */}
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/70 flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-rose-400" />
                        <span>Độ mỏi cơ (DOMS)</span>
                      </span>
                      <span className="font-mono font-bold text-rose-300">
                        {sorenessLevel === 5 ? 'Tươi mới' : sorenessLevel >= 3 ? 'Nhẹ' : 'Đau nhức'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={sorenessLevel}
                      onChange={(e) => setSorenessLevel(parseInt(e.target.value, 10))}
                      className="w-full accent-rose-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-white/40 font-mono">
                      <span>Rất đau (1)</span>
                      <span>Bình thường</span>
                      <span>Hết mỏi (5)</span>
                    </div>
                  </div>

                  {/* 3. Khớp & Dây chằng */}
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/70 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Sức khỏe khớp</span>
                      </span>
                      <span className="font-mono font-bold text-emerald-300">
                        {jointComfort >= 4 ? 'Khỏe khoắn' : jointComfort === 3 ? 'Hơi mỏi' : 'Đau nhức'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={jointComfort}
                      onChange={(e) => setJointComfort(parseInt(e.target.value, 10))}
                      className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-white/40 font-mono">
                      <span>Đau khớp (1)</span>
                      <span>Ổn định</span>
                      <span>Êm ái (5)</span>
                    </div>
                  </div>

                  {/* 4. Năng lượng & Tinh thần */}
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/70 flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Năng lượng/Stress</span>
                      </span>
                      <span className="font-mono font-bold text-amber-300">
                        {stressEnergy >= 4 ? 'Tràn trề' : stressEnergy === 3 ? 'Bình thường' : 'Mệt mỏi'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={stressEnergy}
                      onChange={(e) => setStressEnergy(parseInt(e.target.value, 10))}
                      className="w-full accent-amber-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-white/40 font-mono">
                      <span>Cạn kiệt (1)</span>
                      <span>Trung bình</span>
                      <span>Đỉnh cao (5)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SPLIT SCIENTIFIC ANALYSIS */}
          {activeTab === 'splitAnalysis' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Overview Bar */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center font-black font-mono text-cyan-300 text-lg">
                    {splitEval.scientificScore}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Điểm Tối Ưu Lịch Tập Khoa Học: {splitEval.scientificScore}/100
                    </h4>
                    <p className="text-xs text-white/60">
                      Tần suất trung bình: <strong className="text-cyan-400">{splitEval.averageFrequency}x / tuần</strong> (Khuyến nghị chuẩn nghiên cứu Brad Schoenfeld: 2x/tuần)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-3 py-1 rounded-xl bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 font-semibold">
                    ✓ MAV Sweet Spot
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-blue-950/60 text-blue-300 border border-blue-500/30 font-semibold">
                    ✓ 2x Tần suất tuần
                  </span>
                </div>
              </div>

              {/* Junk volume warnings if any */}
              {splitEval.junkVolumeWarnings.length > 0 && (
                <div className="space-y-2">
                  {splitEval.junkVolumeWarnings.map((warn, wIdx) => (
                    <div
                      key={wIdx}
                      className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Cảnh Báo Junk Volume (Thể tích rác):</strong>
                        <span>{warn}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Table of muscle groups */}
              <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-white/[0.02]">
                <div className="p-3 bg-white/[0.04] border-b border-white/[0.08] grid grid-cols-12 text-[11px] font-bold text-white/60 uppercase tracking-wider">
                  <span className="col-span-3 sm:col-span-2">Nhóm cơ</span>
                  <span className="col-span-3 sm:col-span-2 text-center">Tần suất / Tuần</span>
                  <span className="col-span-3 sm:col-span-2 text-center">Tổng Sets</span>
                  <span className="col-span-3 sm:col-span-3 text-center">Đánh giá RP</span>
                  <span className="hidden sm:block sm:col-span-3">Nhận xét khoa học</span>
                </div>

                <div className="divide-y divide-white/[0.05]">
                  {splitEval.items.map((item) => (
                    <div
                      key={item.muscle}
                      className="p-3 grid grid-cols-12 items-center text-xs hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="col-span-3 sm:col-span-2 flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: MUSCLE_COLOR[item.muscle] || '#3b82f6' }}
                        />
                        <span className="font-bold text-white">{item.muscleLabel}</span>
                      </div>

                      <div className="col-span-3 sm:col-span-2 text-center font-mono">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            item.frequencyDays >= 2
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {item.frequencyDays}x / tuần
                        </span>
                      </div>

                      <div className="col-span-3 sm:col-span-2 text-center font-mono font-bold text-white">
                        {item.weeklySets} sets
                      </div>

                      <div className="col-span-3 sm:col-span-3 text-center">
                        <span
                          className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${item.statusColor}20`,
                            color: item.statusColor,
                            border: `1px solid ${item.statusColor}40`,
                          }}
                        >
                          {item.statusLabel}
                        </span>
                      </div>

                      <div className="hidden sm:block sm:col-span-3 text-[11px] text-white/60 line-clamp-2">
                        {item.scientificFeedback}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

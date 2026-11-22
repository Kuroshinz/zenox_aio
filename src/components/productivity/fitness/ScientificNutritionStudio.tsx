import React, { useState, useMemo } from 'react';
import {
  Utensils,
  Clock,
  Flame,
  Zap,
  Droplets,
  Award,
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Apple,
  Dumbbell,
  ShieldCheck,
  RotateCcw,
  Plus,
  Check,
} from 'lucide-react';
import { Goal, MealLog, MealSlot } from '../../../types/productivity';
import {
  calculatePeriWorkoutNutrition,
  calculateRefeedTargets,
  PeriWorkoutNutritionPlan,
  RefeedPlanResult,
  todayString,
} from '../../../utils/fitnessMetrics';
import { notifySuccess } from '../../../utils/notify';
import { playSuccessSound } from '../../../utils/sound';

interface ScientificNutritionStudioProps {
  userWeightKg: number;
  tdeeValue: number;
  goal: Goal;
  bodyFatPct?: number;
  selectedDate?: string;
  onAddMealLog?: (meal: Omit<MealLog, 'id' | 'createdAt'>) => MealLog;
}

export const ScientificNutritionStudio: React.FC<ScientificNutritionStudioProps> = ({
  userWeightKg,
  tdeeValue,
  goal,
  bodyFatPct = 15,
  selectedDate = todayString(),
  onAddMealLog,
}) => {
  const [activeTab, setActiveTab] = useState<'periWorkout' | 'refeed' | 'supplements'>('periWorkout');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [selectedPreIndex, setSelectedPreIndex] = useState<number>(0);
  const [selectedPostIndex, setSelectedPostIndex] = useState<number>(0);
  const [justLoggedPre, setJustLoggedPre] = useState<boolean>(false);
  const [justLoggedPost, setJustLoggedPost] = useState<boolean>(false);

  // Tính toán dinh dưỡng quanh buổi tập theo thể trọng & mục tiêu
  const periPlan: PeriWorkoutNutritionPlan = useMemo(() => {
    return calculatePeriWorkoutNutrition(userWeightKg, goal);
  }, [userWeightKg, goal]);

  // Tính toán kế hoạch Refeed chống thích nghi chuyển hóa
  const refeedPlan: RefeedPlanResult = useMemo(() => {
    return calculateRefeedTargets(userWeightKg, tdeeValue, goal, bodyFatPct);
  }, [userWeightKg, tdeeValue, goal, bodyFatPct]);

  // 1-Click Log Pre-Workout Meal
  const handleLogPreWorkout = () => {
    if (!onAddMealLog) return;
    const foodDesc = periPlan.preWorkout.recommendedFoods[selectedPreIndex] || 'Bữa trước tập chuẩn ISSN';
    const cals = Math.round(
      periPlan.preWorkout.carbsGrams * 4 +
        periPlan.preWorkout.proteinGrams * 4 +
        periPlan.preWorkout.fatsGrams * 9
    );

    onAddMealLog({
      date: selectedDate,
      slot: 'snack',
      description: `Bữa Trước Tập (Pre-Workout ISSN): ${foodDesc}`,
      items: [
        {
          name: foodDesc,
          amount: 1,
          unit: 'g',
          kcal: cals,
          protein: periPlan.preWorkout.proteinGrams,
          carbs: periPlan.preWorkout.carbsGrams,
          fat: periPlan.preWorkout.fatsGrams,
        },
      ],
    });

    setJustLoggedPre(true);
    setTimeout(() => setJustLoggedPre(false), 2500);
    playSuccessSound();
    notifySuccess(
      'Đã ghi bữa Pre-Workout!',
      `+${periPlan.preWorkout.proteinGrams}g đạm, +${periPlan.preWorkout.carbsGrams}g carb nạp năng lượng chuẩn bị tập.`
    );
  };

  // 1-Click Log Post-Workout Recovery Meal
  const handleLogPostWorkout = () => {
    if (!onAddMealLog) return;
    const foodDesc = periPlan.postWorkout.recommendedFoods[selectedPostIndex] || 'Bữa phục hồi sau tập mTOR';
    const cals = Math.round(
      periPlan.postWorkout.carbsGrams * 4 +
        periPlan.postWorkout.proteinGrams * 4 +
        5 * 9
    );

    onAddMealLog({
      date: selectedDate,
      slot: 'dinner',
      description: `Bữa Sau Tập (Post-Workout Recovery mTOR): ${foodDesc}`,
      items: [
        {
          name: foodDesc,
          amount: 1,
          unit: 'g',
          kcal: cals,
          protein: periPlan.postWorkout.proteinGrams,
          carbs: periPlan.postWorkout.carbsGrams,
          fat: 5,
        },
      ],
    });

    setJustLoggedPost(true);
    setTimeout(() => setJustLoggedPost(false), 2500);
    playSuccessSound();
    notifySuccess(
      'Đã ghi bữa Post-Workout!',
      `+${periPlan.postWorkout.proteinGrams}g đạm (Leucine ≥ 3.2g) kích hoạt phục hồi mô cơ và tái tạo glycogen.`
    );
  };

  return (
    <div className="bg-gradient-to-br from-[#120d18] via-[#1a1222] to-[#0c0910] border border-fuchsia-500/30 rounded-3xl p-4 sm:p-6 shadow-xl text-white relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-fuchsia-600 to-pink-500 flex items-center justify-center shadow-lg shadow-fuchsia-500/20 text-white shrink-0">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-fuchsia-300 bg-fuchsia-950/60 border border-fuchsia-500/30 px-2 py-0.5 rounded-full">
                ISSN & Sports Nutrition Science
              </span>
              <span className="text-[10px] text-white/50">Evidence-Based</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5 flex items-center gap-2">
              <span>Studio Dinh Dưỡng Khoa Học (Peri-Workout & Refeed)</span>
            </h3>
          </div>
        </div>

        {/* Tab switchers & collapse button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-white/[0.05] border border-white/[0.08] rounded-xl text-xs overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('periWorkout')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'periWorkout'
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Dinh Dưỡng Quanh Tập</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('refeed')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'refeed'
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Refeed & Leptin</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('supplements')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'supplements'
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Bổ Sung Grade-A</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/70 hover:text-white transition-colors cursor-pointer shrink-0"
            title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-5 space-y-6 relative z-10">
          {/* TAB 1: PERI-WORKOUT NUTRITION */}
          {activeTab === 'periWorkout' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3.5 rounded-2xl bg-fuchsia-950/30 border border-fuchsia-500/20 text-xs text-fuchsia-200 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-fuchsia-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Nguyên tắc ISSN:</strong> Phân bổ Carbohydrate và Protein tập trung trong khung cửa sổ quanh buổi tập (Peri-workout window) tối ưu hóa nồng độ Glycogen, đẩy cao nồng độ amino acid tự do trong máu và kích hoạt tổng hợp protein cơ bắp (MPS).
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Pre-Workout */}
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5" />
                        <span>Trước Buổi Tập (Pre)</span>
                      </span>
                      <span className="text-[10px] text-white/50 font-mono">1-2h trước</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 my-3 text-center">
                      <div className="p-2 rounded-xl bg-amber-950/30 border border-amber-500/20">
                        <span className="text-[10px] text-amber-300 block">Carb</span>
                        <strong className="text-sm font-mono font-bold text-white">{periPlan.preWorkout.carbsGrams}g</strong>
                      </div>
                      <div className="p-2 rounded-xl bg-rose-950/30 border border-rose-500/20">
                        <span className="text-[10px] text-rose-300 block">Protein</span>
                        <strong className="text-sm font-mono font-bold text-white">{periPlan.preWorkout.proteinGrams}g</strong>
                      </div>
                      <div className="p-2 rounded-xl bg-cyan-950/30 border border-cyan-500/20">
                        <span className="text-[10px] text-cyan-300 block">Nước</span>
                        <strong className="text-sm font-mono font-bold text-white">{periPlan.preWorkout.hydrationMl}ml</strong>
                      </div>
                    </div>

                    <p className="text-[11px] text-white/70 italic leading-relaxed">
                      "{periPlan.preWorkout.scientificPurpose}"
                    </p>

                    {/* Interactive Combo Selector */}
                    <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                      <span className="text-[10px] uppercase font-bold text-white/50 block">Chọn thực đơn mẫu:</span>
                      {periPlan.preWorkout.recommendedFoods.map((f, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedPreIndex(idx)}
                          className={`w-full text-left p-2 rounded-xl border text-xs transition-all cursor-pointer flex items-start gap-2 ${
                            selectedPreIndex === idx
                              ? 'bg-amber-950/50 border-amber-500/50 text-white shadow-md'
                              : 'bg-white/[0.02] border-white/[0.05] text-white/70 hover:bg-white/[0.05]'
                          }`}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                              selectedPreIndex === idx
                                ? 'border-amber-400 bg-amber-500 text-black'
                                : 'border-white/30'
                            }`}
                          >
                            {selectedPreIndex === idx && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className="text-[11px] leading-snug">{f}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 1-Click Log Button */}
                  {onAddMealLog && (
                    <div className="pt-2 border-t border-white/[0.06]">
                      <button
                        type="button"
                        onClick={handleLogPreWorkout}
                        disabled={justLoggedPre}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {justLoggedPre ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                            <span>Đã ghi vào nhật ký!</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            <span>⚡ Ghi Bữa Pre-Workout Vào Hôm Nay</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Intra-Workout */}
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                        <Droplets className="w-3.5 h-3.5" />
                        <span>Trong Buổi Tập (Intra)</span>
                      </span>
                      <span className="text-[10px] text-white/50 font-mono">Từng ngụm nhỏ</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 my-3 text-center">
                      <div className="p-2 rounded-xl bg-cyan-950/30 border border-cyan-500/20">
                        <span className="text-[10px] text-cyan-300 block">Nước uống</span>
                        <strong className="text-sm font-mono font-bold text-white">{periPlan.intraWorkout.hydrationMl}ml</strong>
                      </div>
                      <div className="p-2 rounded-xl bg-blue-950/30 border border-blue-500/20">
                        <span className="text-[10px] text-blue-300 block">Điện giải Natri</span>
                        <strong className="text-sm font-mono font-bold text-white">~{periPlan.intraWorkout.sodiumMg}mg</strong>
                      </div>
                    </div>

                    <p className="text-[11px] text-white/70 leading-relaxed">
                      {periPlan.intraWorkout.notes}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[11px] text-cyan-200">
                    💡 Chỉ cần mất 2% trọng lượng nước cơ thể do mồ hôi, lực phát triển tối đa (Peak Force) đã có thể suy giảm tới 10-15%.
                  </div>
                </div>

                {/* Post-Workout */}
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Sau Buổi Tập (Post)</span>
                      </span>
                      <span className="text-[10px] text-white/50 font-mono">30 - 120 phút</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 my-3 text-center">
                      <div className="p-2 rounded-xl bg-rose-950/30 border border-rose-500/20">
                        <span className="text-[10px] text-rose-300 block">Protein</span>
                        <strong className="text-sm font-mono font-bold text-white">{periPlan.postWorkout.proteinGrams}g</strong>
                      </div>
                      <div className="p-2 rounded-xl bg-amber-950/30 border border-amber-500/20">
                        <span className="text-[10px] text-amber-300 block">Carb</span>
                        <strong className="text-sm font-mono font-bold text-white">{periPlan.postWorkout.carbsGrams}g</strong>
                      </div>
                      <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/20">
                        <span className="text-[10px] text-emerald-300 block">Leucine</span>
                        <strong className="text-sm font-mono font-bold text-white">≥{periPlan.postWorkout.leucineGrams}g</strong>
                      </div>
                    </div>

                    <p className="text-[11px] text-white/70 italic leading-relaxed">
                      "{periPlan.postWorkout.scientificPurpose}"
                    </p>

                    {/* Interactive Combo Selector */}
                    <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                      <span className="text-[10px] uppercase font-bold text-white/50 block">Chọn thực đơn mẫu:</span>
                      {periPlan.postWorkout.recommendedFoods.map((f, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedPostIndex(idx)}
                          className={`w-full text-left p-2 rounded-xl border text-xs transition-all cursor-pointer flex items-start gap-2 ${
                            selectedPostIndex === idx
                              ? 'bg-emerald-950/50 border-emerald-500/50 text-white shadow-md'
                              : 'bg-white/[0.02] border-white/[0.05] text-white/70 hover:bg-white/[0.05]'
                          }`}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                              selectedPostIndex === idx
                                ? 'border-emerald-400 bg-emerald-500 text-black'
                                : 'border-white/30'
                            }`}
                          >
                            {selectedPostIndex === idx && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className="text-[11px] leading-snug">{f}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 1-Click Log Button */}
                  {onAddMealLog && (
                    <div className="pt-2 border-t border-white/[0.06]">
                      <button
                        type="button"
                        onClick={handleLogPostWorkout}
                        disabled={justLoggedPost}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {justLoggedPost ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                            <span>Đã ghi vào nhật ký!</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>⚡ Ghi Bữa Post-Workout Vào Hôm Nay</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REFEED & DIET BREAK */}
          {activeTab === 'refeed' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-5 p-4 rounded-xl bg-gradient-to-br from-amber-950/40 to-orange-950/30 border border-amber-500/30 text-center">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-amber-400 block">
                    Mục Tiêu Ngày Refeed (Carb-Up)
                  </span>
                  <div className="my-2 flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-black font-mono text-amber-300">
                      {refeedPlan.refeedCalories}
                    </span>
                    <span className="text-sm text-white/60 font-mono">kcal</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div className="p-1.5 rounded-lg bg-black/40">
                      <span className="text-[10px] text-amber-300 block">Carb</span>
                      <strong className="font-mono text-white">{refeedPlan.refeedCarbsGrams}g</strong>
                    </div>
                    <div className="p-1.5 rounded-lg bg-black/40">
                      <span className="text-[10px] text-rose-300 block">Protein</span>
                      <strong className="font-mono text-white">{refeedPlan.refeedProteinGrams}g</strong>
                    </div>
                    <div className="p-1.5 rounded-lg bg-black/40">
                      <span className="text-[10px] text-cyan-300 block">Fat (Thấp)</span>
                      <strong className="font-mono text-white">{refeedPlan.refeedFatsGrams}g</strong>
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] text-amber-200/80 font-medium">
                    Tần suất: <strong>1 ngày mỗi {refeedPlan.frequencyDays} ngày</strong> (Dựa theo Body Fat ~{bodyFatPct}%)
                  </div>
                </div>

                <div className="md:col-span-7 space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-400" />
                    <span>Cơ Chế Phục Hồi Hormone Leptin & Chống Chững Cân</span>
                  </h4>
                  <p className="text-xs text-white/70 leading-relaxed">
                    {refeedPlan.scientificMechanism}
                  </p>
                  <ul className="space-y-1.5 text-xs text-white/80">
                    {refeedPlan.guidelines.map((g, gIdx) => (
                      <li key={gIdx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SUPPLEMENTS GUIDE */}
          {activeTab === 'supplements' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-xs text-emerald-200 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Chỉ gồm các hoạt chất được xếp hạng <strong>Tier A (Bằng chứng lâm sàng mạnh nhất)</strong> theo ISSN & Examine.com</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
                  Grade A Verified
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {periPlan.evidenceBasedSupplements.map((sup, sIdx) => (
                  <div
                    key={sIdx}
                    className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-fuchsia-500/30 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                      <h5 className="text-sm font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
                        <span>{sup.name}</span>
                      </h5>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/40 font-mono">
                        {sup.tier}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 text-white/80">
                      <div>
                        <strong className="text-white/50">Liều dùng:</strong> {sup.dosage}
                      </div>
                      <div>
                        <strong className="text-white/50">Thời điểm vàng:</strong> {sup.bestTiming}
                      </div>
                      <div>
                        <strong className="text-white/50">Hiệu quả chứng minh:</strong> {sup.provenBenefit}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/[0.05] text-[10px] text-fuchsia-300 font-mono truncate">
                      📚 {sup.citation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

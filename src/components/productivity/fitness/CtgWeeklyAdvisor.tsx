import React, { useMemo } from 'react';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Zap, ArrowRight } from 'lucide-react';
import { BodyPoint, CtgRoadmapPhase } from '../../../types/productivity';

interface CtgWeeklyAdvisorProps {
  activePhase: CtgRoadmapPhase;
  bodyPoints: BodyPoint[];
  currentWeight: number;
  currentBf: number;
  onApplyAdjustment?: (calorieDelta: number, reason: string) => void;
  onOpenCheckinExport?: () => void;
  lang?: 'vi' | 'en';
}

export const CtgWeeklyAdvisor: React.FC<CtgWeeklyAdvisorProps> = ({
  activePhase,
  bodyPoints = [],
  currentWeight,
  currentBf,
  onApplyAdjustment,
  onOpenCheckinExport,
  lang = 'vi',
}) => {
  // Sort body points newest to oldest
  const sortedPoints = useMemo(() => {
    return [...bodyPoints].sort((a, b) => b.createdAt - a.createdAt);
  }, [bodyPoints]);

  // Calculate actual weekly weight change rate
  const { weeklyRateKg, hasEnoughHistory, daysSpan } = useMemo(() => {
    if (sortedPoints.length < 2) {
      return { weeklyRateKg: 0, hasEnoughHistory: false, daysSpan: 0 };
    }
    const pLatest = sortedPoints[0];
    const pPrev = sortedPoints[1];
    const diffMs = Math.abs(pLatest.createdAt - pPrev.createdAt);
    const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    const delta = pLatest.weightKg - pPrev.weightKg;
    const rate = Math.round((delta / days) * 7 * 100) / 100;

    return {
      weeklyRateKg: rate,
      hasEnoughHistory: days >= 3,
      daysSpan: days,
    };
  }, [sortedPoints]);

  const isBulk = activePhase.phaseType === 'bulk';
  const isCut = activePhase.phaseType === 'cut' || activePhase.phaseType === 'minicut' || activePhase.phaseType === 'final_cut';

  // Analysis logic
  const advice = useMemo(() => {
    if (!hasEnoughHistory) {
      return {
        status: 'neutral' as const,
        badge: 'Cần Thêm Dữ Liệu Đo',
        badgeColor: 'bg-white/10 text-white/70 border-white/10',
        title: 'Mục Tiêu Chuẩn Giai Đoạn Này',
        desc: isBulk
          ? 'Nhịp tăng cơ chuẩn ZENOX là +0.20kg đến +0.35kg/tuần để tối ưu hóa xây nạc và hạn chế tích mỡ bụng. Hãy ghi nhận ít nhất 2 lần đo InBody cách nhau vài ngày để kích hoạt cố vấn tự động!'
          : 'Nhịp giảm mỡ chuẩn ZENOX là -0.40kg đến -0.80kg/tuần để đốt mỡ tối đa và bảo toàn khối cơ nạc LBM. Hãy đo InBody định kỳ để theo dõi!',
        suggestedCalDelta: 0,
        buttonText: null,
      };
    }

    if (isBulk) {
      if (weeklyRateKg > 0.45) {
        return {
          status: 'warning' as const,
          badge: 'Tăng Cân Quá Nhanh ⚠️',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          title: `Tốc độ tăng +${weeklyRateKg} kg/tuần (Vượt mức tối ưu)`,
          desc: 'Tốc độ tăng cân đang vượt ngưỡng đồng hóa nạc tự nhiên (> 0.45kg/tuần), nguy cơ tích mỡ thừa cao hơn tăng cơ. Khuyến nghị giảm nhẹ lượng tinh bột hoặc tăng vận động hàng ngày.',
          suggestedCalDelta: -120,
          buttonText: 'Áp dụng giảm -120 kcal vào giai đoạn này',
        };
      }
      if (weeklyRateKg >= 0.15 && weeklyRateKg <= 0.45) {
        return {
          status: 'optimal' as const,
          badge: 'Vùng Vàng Tăng Nạc Chuẩn ZENOX ⭐',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          title: `Tốc độ tăng +${weeklyRateKg} kg/tuần (Hoàn hảo)`,
          desc: 'Tốc độ tăng cân nằm chính xác trong Sweet Spot khoa học ZENOX! Tỷ lệ tổng hợp nạc/mỡ tối ưu nhất. Tiếp tục duy trì mức dinh dưỡng hiện tại và tập trung tăng tạ (Progressive Overload).',
          suggestedCalDelta: 0,
          buttonText: null,
        };
      }
      return {
        status: 'under' as const,
        badge: 'Tăng Cân Bị Chậm / Chững Cân 💡',
        badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        title: `Tốc độ tăng +${weeklyRateKg} kg/tuần (Dưới kỳ vọng)`,
        desc: 'Cơ thể đang đốt năng lượng nhiều hơn dự tính khiến cân nặng chững lại. Để đảm bảo môi trường đồng hóa liên tục, nên bổ sung thêm calo từ tinh bột sạch (cơm trắng, yến mạch, khoai lang).',
        suggestedCalDelta: 150,
        buttonText: 'Áp dụng tăng +150 kcal vào giai đoạn này',
      };
    }

    if (isCut) {
      if (weeklyRateKg < -0.9) {
        return {
          status: 'warning' as const,
          badge: 'Sụt Cân Quá Nhanh ⚠️',
          badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          title: `Tốc độ giảm ${weeklyRateKg} kg/tuần (Dốc nguy hiểm)`,
          desc: 'Tốc độ sụt cân quá nhanh (> 0.9kg/tuần) có nguy cơ gây dị hóa mô cơ nạc LBM và ức chế hormone trao đổi chất. Khuyến nghị bổ sung nhẹ calo hoặc lên lịch 1 ngày Refeed nạp tinh bột.',
          suggestedCalDelta: 150,
          buttonText: 'Áp dụng tăng +150 kcal để bảo toàn cơ nạc',
        };
      }
      if (weeklyRateKg >= -0.9 && weeklyRateKg <= -0.35) {
        return {
          status: 'optimal' as const,
          badge: 'Siết Mỡ Tối Ưu Bảo Toàn Cơ ⭐',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          title: `Tốc độ giảm ${weeklyRateKg} kg/tuần (Chuẩn xác)`,
          desc: 'Tốc độ siết mỡ hoàn hảo! Cơ thể đang lấy năng lượng từ mô mỡ dự trữ mà không làm tổn hại khối nạc LBM. Hãy giữ vững mức calo hiện tại và nạp đủ 2.2g Protein/kg.',
          suggestedCalDelta: 0,
          buttonText: null,
        };
      }
      return {
        status: 'under' as const,
        badge: 'Chững Cân / Giảm Chậm 💡',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        title: `Tốc độ giảm ${weeklyRateKg} kg/tuần (Chững mỡ)`,
        desc: 'Cơ thể đã thích nghi chuyển hóa với mức ăn hiện tại khiến tốc độ đốt mỡ chậm lại. Khuyến nghị giảm nhẹ 100 kcal hoặc tăng thêm 15-20 phút đi bộ dốc mỗi ngày.',
        suggestedCalDelta: -100,
        buttonText: 'Áp dụng giảm -100 kcal để tiếp tục siết mỡ',
      };
    }

    return {
      status: 'optimal' as const,
      badge: 'Duy Trì Ổn Định ⭐',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      title: 'Trọng Lượng Cơ Thể Ổn Định',
      desc: 'Cân nặng dao động cân bằng trong ngưỡng duy trì, hệ trao đổi chất được phục hồi hoàn hảo.',
      suggestedCalDelta: 0,
      buttonText: null,
    };
  }, [hasEnoughHistory, isBulk, isCut, weeklyRateKg]);

  return (
    <div className="bg-[#0b0307] rounded-3xl border border-white/10 p-5 sm:p-6 shadow-xl relative overflow-hidden space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${advice.badgeColor}`}>
                {advice.badge}
              </span>
              {hasEnoughHistory && (
                <span className="text-xs font-mono text-white/50">
                  (So sánh ${daysSpan} ngày gần nhất)
                </span>
              )}
            </div>
            <h4 className="text-base font-black text-white mt-0.5 tracking-tight">
              Cố Vấn Điều Chỉnh Tuần Tự Động (ZENOX Auto-Adjustment)
            </h4>
          </div>
        </div>

        {onOpenCheckinExport && (
          <button
            type="button"
            onClick={onOpenCheckinExport}
            className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-white border border-rose-500/20 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors self-start sm:self-center shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            <span>Xuất thẻ tuần này (3:4 HD)</span>
          </button>
        )}

        {hasEnoughHistory && (
          <div className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 font-mono text-xs flex items-center gap-1.5 self-end sm:self-center">
            <span className="text-white/40 text-[10px] uppercase font-sans font-semibold">Tốc độ tuần:</span>
            <span
              className={`font-black text-sm ${
                advice.status === 'optimal'
                  ? 'text-emerald-400'
                  : advice.status === 'warning'
                  ? 'text-rose-400'
                  : 'text-amber-400'
              }`}
            >
              {weeklyRateKg > 0 ? `+${weeklyRateKg}` : weeklyRateKg} kg/tuần
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="font-bold text-sm text-white flex items-center gap-2">
          {advice.status === 'optimal' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : advice.status === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>{advice.title}</span>
        </div>

        <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
          {advice.desc}
        </p>

        {advice.buttonText && onApplyAdjustment && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onApplyAdjustment(advice.suggestedCalDelta, advice.title)}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-md shadow-rose-600/30 transition-all inline-flex items-center gap-2"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{advice.buttonText}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

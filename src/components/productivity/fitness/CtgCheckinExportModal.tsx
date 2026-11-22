import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Download,
  Copy,
  Sparkles,
  Share2,
  Check,
  Scale,
  Activity,
  Layers,
  Flame,
  Dumbbell,
  ShieldCheck,
  RefreshCw,
  Palette,
} from 'lucide-react';
import { BodyPoint, CtgPeriodizedRoadmap, CtgProfile, CtgRoadmapPhase } from '../../../types/productivity';
import { ffmi, leanMassKg, fatMassKg, sortPoints } from '../../../utils/fitnessMetrics';
import { notifySuccess, notifyInfo, notifyError } from '../../../utils/notify';

export interface CtgCheckinExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePhase?: CtgRoadmapPhase | null;
  roadmap?: CtgPeriodizedRoadmap | null;
  bodyPoints: BodyPoint[];
  profile: CtgProfile;
  lang?: 'vi' | 'en';
}

type CardTheme = 'rose' | 'gold' | 'emerald' | 'cyan';

const THEMES: { id: CardTheme; nameVi: string; primary: string; secondary: string; bgGradient: [string, string] }[] = [
  {
    id: 'rose',
    nameVi: 'CTG Neon Rose (Mặc định)',
    primary: '#F43F5E',
    secondary: '#FB7185',
    bgGradient: ['#0d040a', '#180715'],
  },
  {
    id: 'gold',
    nameVi: 'Gold Titan (Kỷ Luật)',
    primary: '#F59E0B',
    secondary: '#FCD34D',
    bgGradient: ['#0f0b04', '#1c1407'],
  },
  {
    id: 'emerald',
    nameVi: 'Emerald Matrix (Tăng Cơ)',
    primary: '#10B981',
    secondary: '#34D399',
    bgGradient: ['#030d08', '#071b11'],
  },
  {
    id: 'cyan',
    nameVi: 'Cyber Blue (Thép Lạnh)',
    primary: '#06B6D4',
    secondary: '#38BDF8',
    bgGradient: ['#03090f', '#071520'],
  },
];

export const CtgCheckinExportModal: React.FC<CtgCheckinExportModalProps> = ({
  isOpen,
  onClose,
  activePhase,
  roadmap,
  bodyPoints,
  profile,
  lang = 'vi',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<CardTheme>('rose');
  const [showNutrition, setShowNutrition] = useState<boolean>(true);
  const [showSparkline, setShowSparkline] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Latest and Previous Check-in points
  const sorted = useMemo(() => sortPoints(bodyPoints), [bodyPoints]);
  const latestPoint = sorted[sorted.length - 1];
  const prevPoint = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  // Derived metrics
  const heightCm = profile.heightCm || 170;
  const weight = latestPoint?.weightKg ?? profile.targetWeightKg ?? 70;
  const prevWeight = prevPoint?.weightKg;
  const weightDelta = prevWeight !== undefined ? weight - prevWeight : 0;

  const bfPct = latestPoint?.bodyFatPct ?? 15;
  const prevBf = prevPoint?.bodyFatPct;
  const bfDelta = prevBf !== undefined ? bfPct - prevBf : 0;

  const lbm = leanMassKg(weight, bfPct);
  const prevLbm = prevPoint ? leanMassKg(prevPoint.weightKg, prevPoint.bodyFatPct ?? 15) : undefined;
  const lbmDelta = prevLbm !== undefined ? lbm - prevLbm : 0;

  const currentFfmi = ffmi(weight, heightCm, bfPct);

  // Draw the high-res 1080x1440 card on canvas
  const renderCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1080;
    const height = 1440;
    canvas.width = width;
    canvas.height = height;

    const theme = THEMES.find((t) => t.id === selectedTheme) || THEMES[0];

    // 1. Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, theme.bgGradient[0]);
    bgGrad.addColorStop(0.5, '#070208');
    bgGrad.addColorStop(1, theme.bgGradient[1]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle Grid Pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Glowing Radial Accents
    const radial = ctx.createRadialGradient(width * 0.8, 180, 20, width * 0.8, 180, 400);
    radial.addColorStop(0, `${theme.primary}22`);
    radial.addColorStop(1, 'transparent');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);

    const radialBottom = ctx.createRadialGradient(200, height - 200, 20, 200, height - 200, 450);
    radialBottom.addColorStop(0, `${theme.secondary}15`);
    radialBottom.addColorStop(1, 'transparent');
    ctx.fillStyle = radialBottom;
    ctx.fillRect(0, 0, width, height);

    // 2. Outer Framed Border
    const pad = 36;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);

    // Neon Corner Brackets
    const bracketSize = 28;
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 4;
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(pad - 2, pad + bracketSize);
    ctx.lineTo(pad - 2, pad - 2);
    ctx.lineTo(pad + bracketSize, pad - 2);
    ctx.stroke();
    // Top-Right
    ctx.beginPath();
    ctx.moveTo(width - pad + 2 - bracketSize, pad - 2);
    ctx.lineTo(width - pad + 2, pad - 2);
    ctx.lineTo(width - pad + 2, pad + bracketSize);
    ctx.stroke();
    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(pad - 2, height - pad - bracketSize);
    ctx.lineTo(pad - 2, height - pad + 2);
    ctx.lineTo(pad + bracketSize, height - pad + 2);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(width - pad + 2 - bracketSize, height - pad + 2);
    ctx.lineTo(width - pad + 2, height - pad + 2);
    ctx.lineTo(width - pad + 2, height - pad - bracketSize);
    ctx.stroke();

    // 3. Header
    // Badge
    ctx.fillStyle = `${theme.primary}25`;
    const badgeW = 340;
    const badgeH = 34;
    ctx.beginPath();
    ctx.roundRect(70, 70, badgeW, badgeH, 8);
    ctx.fill();
    ctx.strokeStyle = `${theme.primary}66`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.secondary;
    ctx.font = 'bold 13px monospace';
    ctx.fillText('⚡ CTG FITNESS · ATHLETE DOSSIER', 86, 92);

    // Date & Timestamp
    const todayStr = latestPoint?.date || new Date().toISOString().slice(0, 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '500 14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`BÁO CÁO TUẦN · ${todayStr}`, width - 70, 92);
    ctx.textAlign = 'left';

    // Main Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 42px sans-serif';
    ctx.fillText('BÁO CÁO TIẾN ĐỘ THỂ HÌNH', 70, 155);

    // Subtitle / Phase Tag
    const phaseName = activePhase?.name || 'Giai đoạn Thể Hình Chu Kỳ';
    const phaseTypeUpper = (activePhase?.phaseType || 'TRANSFORMATION').toUpperCase();
    ctx.fillStyle = theme.primary;
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`[ ${phaseTypeUpper} ] ${phaseName}`, 70, 190);

    // Profile pill
    const athleteSex = profile.sex === 'female' ? 'NỮ' : 'NAM';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '500 15px sans-serif';
    ctx.fillText(
      `Vận Động Viên: ${athleteSex} · Chiều cao: ${heightCm} cm · Mục tiêu: ${activePhase?.targetWeightKg || profile.targetWeightKg || '--'} kg`,
      70,
      220
    );

    // Divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(70, 245);
    ctx.lineTo(width - 70, 245);
    ctx.stroke();

    // 4. BIG 4 METRICS BENTO GRID (2x2)
    const cardStartX = 70;
    const cardStartY = 270;
    const cardW = 450;
    const cardH = 175;
    const gap = 40;

    const metrics = [
      {
        title: 'CÂN NẶNG HIỆN TẠI',
        value: `${weight.toFixed(1)}`,
        unit: 'kg',
        delta: weightDelta,
        deltaLabel: weightDelta >= 0 ? `+${weightDelta.toFixed(2)} kg` : `${weightDelta.toFixed(2)} kg`,
        subtext: activePhase ? `Mục tiêu phase: ${activePhase.targetWeightKg} kg` : 'Theo dõi cân đo',
        color: theme.primary,
      },
      {
        title: 'TỶ LỆ MỠ BODY FAT',
        value: `${bfPct.toFixed(1)}`,
        unit: '%',
        delta: bfDelta,
        deltaLabel: bfDelta >= 0 ? `+${bfDelta.toFixed(1)}%` : `${bfDelta.toFixed(1)}%`,
        subtext: `Khối mỡ BFM: ${fatMassKg(weight, bfPct).toFixed(1)} kg`,
        color: '#F59E0B',
      },
      {
        title: 'KHỐI LƯỢNG NẠC LBM',
        value: `${lbm.toFixed(1)}`,
        unit: 'kg',
        delta: lbmDelta,
        deltaLabel: lbmDelta >= 0 ? `+${lbmDelta.toFixed(2)} kg` : `${lbmDelta.toFixed(2)} kg`,
        subtext: activePhase ? `Mục tiêu nạc: ${activePhase.targetLbmKg || '--'} kg` : 'Mô cơ không mỡ',
        color: '#10B981',
      },
      {
        title: 'CHỈ SỐ FFMI (FAT-FREE)',
        value: `${currentFfmi.toFixed(1)}`,
        unit: 'pts',
        delta: 0,
        deltaLabel: currentFfmi >= 22 ? 'Xuất Sắc' : currentFfmi >= 20 ? 'Tự Nhiên Cao' : 'Bình Thường',
        subtext: 'Chỉ số nạc chuẩn hóa theo chiều cao',
        color: '#8B5CF6',
      },
    ];

    metrics.forEach((m, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = cardStartX + col * (cardW + gap);
      const y = cardStartY + row * (cardH + 20);

      // Card Box
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Title
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(m.title, x + 24, y + 36);

      // Value & Unit
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 48px monospace';
      ctx.fillText(m.value, x + 24, y + 96);
      const valW = ctx.measureText(m.value).width;
      ctx.fillStyle = m.color;
      ctx.font = 'bold 20px monospace';
      ctx.fillText(m.unit, x + 28 + valW, y + 80);

      // Delta Badge
      ctx.fillStyle = `${m.color}25`;
      const badgeText = m.deltaLabel;
      ctx.font = 'bold 13px monospace';
      const bTextW = ctx.measureText(badgeText).width;
      ctx.beginPath();
      ctx.roundRect(x + cardW - bTextW - 38, y + 22, bTextW + 18, 26, 6);
      ctx.fill();
      ctx.fillStyle = m.color;
      ctx.fillText(badgeText, x + cardW - bTextW - 29, y + 40);

      // Subtext
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '500 13px sans-serif';
      ctx.fillText(m.subtext, x + 24, y + 142);
    });

    // 5. MINI TRAJECTORY SPARKLINE (Lịch sử cân nặng)
    let curY = 670;
    if (showSparkline && sorted.length >= 2) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.beginPath();
      ctx.roundRect(70, curY, width - 140, 160, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.stroke();

      // Label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('📈 ĐƯỜNG CONG BIẾN THIÊN CÂN NẶNG QUA CÁC TUẦN (INBODY SPARKLINE)', 95, curY + 32);

      const recentPts = sorted.slice(-8);
      const weights = recentPts.map((p) => p.weightKg);
      const minW = Math.min(...weights) - 0.5;
      const maxW = Math.max(...weights) + 0.5;
      const chartX = 100;
      const chartY = curY + 50;
      const chartW = width - 200;
      const chartH = 80;

      // Draw Sparkline Path
      ctx.beginPath();
      recentPts.forEach((pt, idx) => {
        const px = chartX + (idx / (recentPts.length - 1)) * chartW;
        const norm = (pt.weightKg - minW) / (maxW - minW || 1);
        const py = chartY + chartH - norm * chartH;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Dots & Labels
      recentPts.forEach((pt, idx) => {
        const px = chartX + (idx / (recentPts.length - 1)) * chartW;
        const norm = (pt.weightKg - minW) / (maxW - minW || 1);
        const py = chartY + chartH - norm * chartH;

        ctx.fillStyle = theme.primary;
        ctx.beginPath();
        ctx.arc(px, py, idx === recentPts.length - 1 ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${pt.weightKg}`, px, py - 10);
      });
      ctx.textAlign = 'left';

      curY += 185;
    }

    // 6. NUTRITION & TRAINING PRESCRIPTION BLOCK
    if (showNutrition) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.beginPath();
      ctx.roundRect(70, curY, width - 140, 160, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.stroke();

      // Left: Calories
      const targetKcal = activePhase?.targetKcal || 2400;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('MỨC CALO GIAI ĐOẠN', 95, curY + 36);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 38px monospace';
      ctx.fillText(`${targetKcal.toLocaleString('vi-VN')}`, 95, curY + 84);
      ctx.fillStyle = theme.primary;
      ctx.font = 'bold 16px monospace';
      ctx.fillText('kcal/ngày', 95 + ctx.measureText(`${targetKcal.toLocaleString('vi-VN')}`).width + 10, curY + 70);

      // Macros
      const protein = activePhase?.macros.protein || Math.round(weight * 2.2);
      const carbs = activePhase?.macros.carbs || 300;
      const fat = activePhase?.macros.fat || 65;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(
        `ĐẠM (P): ${protein}g   ·   TINH BỘT (C): ${carbs}g   ·   CHẤT BÉO (F): ${fat}g`,
        95,
        curY + 124
      );

      // Right: Split & Discipline
      const splitName = activePhase ? (activePhase.name.includes('PPL') ? 'Push / Pull / Legs' : 'Upper / Lower') : 'Tập Theo Giáo Án';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('SPLIT HUẤN LUYỆN CHU KỲ', width - 95, curY + 36);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(splitName, width - 95, curY + 72);

      ctx.fillStyle = theme.secondary;
      ctx.font = '500 13px sans-serif';
      ctx.fillText('Tần suất: 4-5 buổi/tuần · Phục hồi tối ưu', width - 95, curY + 100);
      ctx.textAlign = 'left';

      curY += 185;
    }

    // 7. CTG COACH VERDICT BANNER
    const verdictH = 100;
    ctx.fillStyle = `${theme.primary}18`;
    ctx.beginPath();
    ctx.roundRect(70, curY, width - 140, verdictH, 20);
    ctx.fill();
    ctx.strokeStyle = `${theme.primary}55`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.primary;
    ctx.font = 'bold 12px monospace';
    ctx.fillText('✦ NHẬN ĐỊNH CỐ VẤN THỂ HÌNH CTG (ALGORITHM VERDICT):', 95, curY + 34);

    let verdictMsg = 'Tiến độ đang bám sát Vùng Vàng sinh học. Tiếp tục duy trì mức tạ và calo hiện tại.';
    if (activePhase?.phaseType === 'bulk' && weightDelta > 0.45) {
      verdictMsg = 'Tăng cân nhanh hơn khuyến nghị (+0.45kg/tuần). Chú ý kiểm soát carb lỏng để tránh mỡ thừa.';
    } else if (activePhase?.phaseType === 'cut' && weightDelta > 0) {
      verdictMsg = 'Cân nặng tuần này chững hoặc tăng nhẹ. Tiếp tục theo dõi thêm 3-4 ngày trước khi cắt giảm calo.';
    } else if (activePhase?.phaseType === 'bulk' && weightDelta >= 0.2 && weightDelta <= 0.4) {
      verdictMsg = 'TUYỆT VỜI: Tăng cân đúng Sweet Spot (+0.2 - 0.4kg/tuần). Mô nạc LBM phát triển cực đại!';
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 16px sans-serif';
    ctx.fillText(verdictMsg, 95, curY + 68);

    curY += verdictH + 30;

    // 8. FOOTER: VERIFICATION STAMP & BARCODE
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(70, height - 100);
    ctx.lineTo(width - 70, height - 100);
    ctx.stroke();

    // Simulated Barcode
    const barX = 70;
    const barY = height - 85;
    const barH = 32;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    const barPattern = [3, 2, 6, 2, 4, 3, 2, 7, 3, 2, 5, 2, 4, 2, 6, 3, 4, 2, 3, 6, 2, 5, 3];
    let curBarX = barX;
    barPattern.forEach((w) => {
      ctx.fillRect(curBarX, barY, w, barH);
      curBarX += w + 3;
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('ID: CTG-INB-' + Date.now().toString().slice(-6), 70, height - 38);

    // Right Footer Stamp
    ctx.textAlign = 'right';
    ctx.fillStyle = theme.secondary;
    ctx.font = 'bold 13px monospace';
    ctx.fillText('ZENOX × CTG PERIODIZATION SYSTEM', width - 70, height - 68);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '500 11px monospace';
    ctx.fillText('VERIFIED ATHLETE PERFORMANCE METRICS', width - 70, height - 48);
    ctx.textAlign = 'left';

    // Update preview URL
    try {
      setPreviewUrl(canvas.toDataURL('image/png'));
    } catch (e) {
      console.warn('Canvas toDataURL error', e);
    }
  }, [selectedTheme, showNutrition, showSparkline, weight, prevWeight, weightDelta, bfPct, bfDelta, lbm, lbmDelta, currentFfmi, heightCm, profile, activePhase, sorted, latestPoint]);

  useEffect(() => {
    if (isOpen) {
      renderCard();
    }
  }, [isOpen, renderCard]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const link = document.createElement('a');
      const filename = `CTG-Checkin-${latestPoint?.date || 'Week'}-${weight.toFixed(1)}kg.png`;
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();
      notifySuccess('Đã tải ảnh thành công!', `Ảnh đã lưu: ${filename}`);
    } catch (err) {
      console.error(err);
      notifyError('Lỗi xuất ảnh', 'Không thể tạo file ảnh tải về.');
    }
  };

  const handleCopyClipboard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setCopied(true);
          notifySuccess('Đã sao chép vào Clipboard!', 'Bạn có thể dán ảnh trực tiếp vào Zalo, Messenger hoặc Photoshop.');
          setTimeout(() => setCopied(false), 3000);
        } catch (clipErr) {
          // Fallback download if clipboard item not allowed
          handleDownload();
        }
      }, 'image/png');
    } catch (e) {
      handleDownload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-[#0b040c] border border-rose-500/30 rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  CTG InBody Export
                </span>
                <span className="text-xs text-white/50 font-mono">Độ phân giải: 1080 × 1440 HD</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                Xuất Thẻ Check-in Tuần Chuẩn CTG
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Left Controls, Right Preview */}
        <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto flex-1">
          {/* Controls Column (5 cols) */}
          <div className="md:col-span-5 space-y-5">
            {/* 1. Theme Palette */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-rose-400" />
                1. Chủ Đề Màu Thẻ (Theme)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTheme(t.id)}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex items-center gap-2.5 ${
                      selectedTheme === t.id
                        ? 'bg-white/10 border-white/40 shadow-lg text-white'
                        : 'bg-white/[0.02] border-white/5 text-white/50 hover:border-white/15'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: t.primary }}
                    />
                    <span className="text-xs font-bold truncate">{t.nameVi.split(' ')[0]} {t.nameVi.split(' ')[1]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Content Toggles */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                2. Nội Dung Hiển Thị
              </label>
              <div className="space-y-2">
                <label className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/[0.06] transition-colors">
                  <span className="text-xs text-white/80 font-medium">Khung Dinh Dưỡng & Split Tập</span>
                  <input
                    type="checkbox"
                    checked={showNutrition}
                    onChange={(e) => setShowNutrition(e.target.checked)}
                    className="rounded accent-rose-500 cursor-pointer"
                  />
                </label>

                <label className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/[0.06] transition-colors">
                  <span className="text-xs text-white/80 font-medium">Biểu đồ đường cong biến thiên (Sparkline)</span>
                  <input
                    type="checkbox"
                    checked={showSparkline}
                    onChange={(e) => setShowSparkline(e.target.checked)}
                    className="rounded accent-rose-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Summary Info */}
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1.5 text-white/70">
              <div className="font-bold text-rose-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Thẻ Card Chuẩn Thể Thao CTG
              </div>
              <p className="text-[11px] leading-relaxed">
                Thẻ ảnh tổng hợp toàn diện các chỉ số cân nặng, % mỡ, LBM và FFMI cùng phân tích của cố vấn thuật toán. Định dạng 3:4 tối ưu cho việc lưu giữ theo tuần hoặc đăng Story / khoe thành quả luyện tập.
              </p>
            </div>
          </div>

          {/* Preview Column (7 cols) */}
          <div className="md:col-span-7 flex flex-col items-center justify-center">
            {/* Hidden canvas for high-res render */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Scaled Preview Frame */}
            <div className="w-full max-w-[340px] sm:max-w-[380px] aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border border-white/20 relative group bg-black">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="CTG Checkin Card Preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/40 text-xs">
                  Đang khởi tạo thẻ ảnh...
                </div>
              )}
            </div>
            <div className="text-[10px] text-white/40 mt-2 font-mono">
              Nhấp xem trước (Tỉ lệ chuẩn 3:4 · 1080 x 1440 px)
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-white/10 bg-black/40 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={renderCard}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Làm mới thẻ
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopyClipboard}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Đã sao chép!' : 'Sao chép ảnh'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold cursor-pointer shadow-lg shadow-rose-900/40 flex items-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Tải Ảnh PNG Về Máy</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

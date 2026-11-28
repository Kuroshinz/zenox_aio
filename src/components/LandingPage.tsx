import React, { useEffect, useRef, useState } from 'react';
import {
  Sun,
  Moon,
  Calendar,
  Clock,
  ArrowRight,
  ArrowDown,
  Dumbbell,
  HeartPulse,
  Flame,
  Wallet,
  Check,
  X,
  TrendingUp,
} from 'lucide-react';

interface LandingPageProps {
  onEnterApp: () => void;
  onOpenLogin?: () => void;
  isLoggedIn?: boolean;
  userName?: string;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

type PreviewTab = 'ntn' | 'tdee' | 'schedule' | 'finance';
type SplitId = 'upper_lower' | 'ppl' | 'fullbody';
type MesoWeekId = 1 | 3 | 6 | 12;
type TdeeGoalId = 'cut' | 'maintain' | 'bulk';
type ScheduleDayMode = 'training' | 'recovery';

function formatVnNumber(value: number): string {
  return Math.round(value).toLocaleString('vi-VN');
}

function useCountUp(target: number, durationMs: number = 550): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(target);
      prevRef.current = target;
      return;
    }

    const start = prevRef.current;
    const diff = target - start;
    if (diff === 0) return;

    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + diff * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        prevRef.current = target;
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, durationMs]);

  return display;
}

const SPLIT_PROFILES: Record<
  SplitId,
  {
    label: string;
    baseTonnageKg: number;
    chestSets: number;
    backSets: number;
    quadsSets: number;
  }
> = {
  upper_lower: {
    label: 'Upper / Lower · 4 buổi',
    baseTonnageKg: 18400,
    chestSets: 14,
    backSets: 16,
    quadsSets: 12,
  },
  ppl: {
    label: 'Push / Pull / Legs · 5 buổi',
    baseTonnageKg: 22900,
    chestSets: 16,
    backSets: 18,
    quadsSets: 15,
  },
  fullbody: {
    label: 'Full Body · 3 buổi',
    baseTonnageKg: 14800,
    chestSets: 11,
    backSets: 13,
    quadsSets: 10,
  },
};

const MESO_WEEK_MODIFIERS: Record<
  MesoWeekId,
  {
    label: string;
    phaseNote: string;
    rpe: string;
    rir: number;
    volumeFactor: number;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  }
> = {
  1: {
    label: 'Tuần 1 · Khởi động',
    phaseNote: 'Làm quen ngưỡng kích hoạt (MEV)',
    rpe: '7.0',
    rir: 3,
    volumeFactor: 0.78,
    kcal: 2180,
    protein: 148,
    carbs: 265,
    fat: 58,
  },
  3: {
    label: 'Tuần 3 · Tích lũy',
    phaseNote: 'Giai đoạn Xây dựng Cơ nạc (Hypertrophy Meso 1)',
    rpe: '8.0',
    rir: 2,
    volumeFactor: 1.0,
    kcal: 2302,
    protein: 152,
    carbs: 310,
    fat: 69,
  },
  6: {
    label: 'Tuần 6 · Đỉnh tải',
    phaseNote: 'Tiệm cận ngưỡng hồi phục tối đa (MRV)',
    rpe: '9.0',
    rir: 1,
    volumeFactor: 1.12,
    kcal: 2420,
    protein: 156,
    carbs: 328,
    fat: 68,
  },
  12: {
    label: 'Tuần 12 · Deload',
    phaseNote: 'Giảm 40% thể tích để phục hồi hệ thần kinh',
    rpe: '6.5',
    rir: 4,
    volumeFactor: 0.6,
    kcal: 2050,
    protein: 148,
    carbs: 235,
    fat: 57,
  },
};

const TDEE_GOALS: Record<
  TdeeGoalId,
  {
    label: string;
    tdee: number;
    delta: number;
    intake: number;
    emaWeight: string;
    weeklyRate: string;
    protein: number;
    carbs: number;
    fat: number;
    curvePoints: string;
  }
> = {
  cut: {
    label: 'Giảm mỡ kiểm soát',
    tdee: 2390,
    delta: -380,
    intake: 2010,
    emaWeight: '67,85 kg',
    weeklyRate: '-0,35 kg/tuần',
    protein: 162,
    carbs: 215,
    fat: 56,
    curvePoints: '0,20 45,24 90,29 135,34 180,41 225,48 270,55',
  },
  maintain: {
    label: 'Duy trì & Tái cấu trúc',
    tdee: 2390,
    delta: 0,
    intake: 2390,
    emaWeight: '68,20 kg',
    weeklyRate: '0,00 kg/tuần',
    protein: 152,
    carbs: 298,
    fat: 66,
    curvePoints: '0,38 45,39 90,37 135,38 180,39 225,38 270,38',
  },
  bulk: {
    label: 'Tăng cơ nạc sạch',
    tdee: 2093,
    delta: 209,
    intake: 2302,
    emaWeight: '68,65 kg',
    weeklyRate: '+0,22 kg/tuần',
    protein: 155,
    carbs: 310,
    fat: 69,
    curvePoints: '0,54 45,49 90,45 135,40 180,34 225,29 270,22',
  },
};

const SCHEDULE_PROFILES: Record<
  ScheduleDayMode,
  {
    label: string;
    adherence: string;
    deepWorkHours: string;
    blocks: Array<{
      time: string;
      tag: string;
      title: string;
      detail: string;
      tone: 'rose' | 'blue' | 'amber' | 'purple';
    }>;
  }
> = {
  training: {
    label: 'Ngày tập nặng (NTN Push A)',
    adherence: '94% Tuân thủ',
    deepWorkHours: 'Deep Work 4,5h/ngày',
    blocks: [
      {
        time: '06:30 – 07:30',
        tag: 'THỂ HÌNH',
        title: 'Tập NTN Push A',
        detail: 'Ngực, vai, tay sau · RPE 8 (RIR 2)',
        tone: 'rose',
      },
      {
        time: '08:30 – 11:30',
        tag: 'DEEP WORK',
        title: 'Khối làm việc sâu 1',
        detail: 'Phát triển sản phẩm & Kiến trúc hệ thống',
        tone: 'blue',
      },
      {
        time: '12:00 – 12:45',
        tag: 'MACRO',
        title: 'Bữa trưa dinh dưỡng 1',
        detail: '850 kcal · 42g Đạm (MPS 3,5g Leucine)',
        tone: 'amber',
      },
      {
        time: '14:00 – 17:00',
        tag: 'DEEP WORK',
        title: 'Khối làm việc sâu 2',
        detail: 'Review chiến lược & Quản trị tài chính',
        tone: 'purple',
      },
    ],
  },
  recovery: {
    label: 'Ngày phục hồi chủ động',
    adherence: '97% Tuân thủ',
    deepWorkHours: 'Deep Work 6,0h/ngày',
    blocks: [
      {
        time: '06:45 – 07:30',
        tag: 'RECOVERY',
        title: 'Zone 2 & Mobility khớp',
        detail: '8.500 bước chân · Giãn cơ vai & khớp hông',
        tone: 'rose',
      },
      {
        time: '08:15 – 11:45',
        tag: 'DEEP WORK',
        title: 'Khối sáng mở rộng',
        detail: '2 chu kỳ tập trung sâu Pomodoro 90 phút',
        tone: 'blue',
      },
      {
        time: '12:15 – 13:00',
        tag: 'MACRO',
        title: 'Bữa trưa cân bằng vi chất',
        detail: '720 kcal · 40g Đạm · Đủ Kali & Magie',
        tone: 'amber',
      },
      {
        time: '14:00 – 17:00',
        tag: 'PLANNING',
        title: 'Hoạch định tuần & Ngân sách',
        detail: 'Rà soát mục tiêu Mesocycle & Dòng tiền',
        tone: 'purple',
      },
    ],
  },
};

const TONE_CLASS: Record<'rose' | 'blue' | 'amber' | 'purple', { card: string; time: string; badge: string }> = {
  rose: {
    card: 'bg-rose-500/10 border-rose-500/25',
    time: 'text-rose-400',
    badge: 'bg-rose-500/20 text-rose-300',
  },
  blue: {
    card: 'bg-blue-500/10 border-blue-500/25',
    time: 'text-blue-400',
    badge: 'bg-blue-500/20 text-blue-300',
  },
  amber: {
    card: 'bg-amber-500/10 border-amber-500/25',
    time: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300',
  },
  purple: {
    card: 'bg-purple-500/10 border-purple-500/25',
    time: 'text-purple-400',
    badge: 'bg-purple-500/20 text-purple-300',
  },
};

const INCOME_PRESETS = [25_000_000, 40_000_000, 60_000_000];

const SIX_JARS = [
  { id: 'nec', label: 'Nhu cầu thiết yếu', pct: 55, bar: 'from-blue-500 to-cyan-400' },
  { id: 'ffa', label: 'Đầu tư tự do tài chính', pct: 10, bar: 'from-emerald-500 to-emerald-400' },
  { id: 'ltss', label: 'Tiết kiệm dài hạn', pct: 10, bar: 'from-rose-500 to-rose-400' },
  { id: 'edu', label: 'Phát triển bản thân', pct: 10, bar: 'from-amber-500 to-amber-400' },
  { id: 'play', label: 'Hưởng thụ cân bằng', pct: 10, bar: 'from-purple-500 to-purple-400' },
  { id: 'give', label: 'Quỹ dự phòng & sẻ chia', pct: 5, bar: 'from-zinc-400 to-zinc-300' },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterApp,
  onOpenLogin,
  isLoggedIn = false,
  userName,
  darkMode = true,
  onToggleDarkMode,
}) => {
  const [activeTab, setActiveTab] = useState<PreviewTab>('ntn');
  const [activeNav, setActiveNav] = useState<string>('hero');
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);
  const [splitId, setSplitId] = useState<SplitId>('upper_lower');
  const [mesoWeek, setMesoWeek] = useState<MesoWeekId>(3);
  const [tdeeGoal, setTdeeGoal] = useState<TdeeGoalId>('bulk');
  const [scheduleMode, setScheduleMode] = useState<ScheduleDayMode>('training');
  const [monthlyIncome, setMonthlyIncome] = useState<number>(40_000_000);

  const rootRef = useRef<HTMLDivElement>(null);
  const highlightTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  const navigateToSection = (sectionId: string, previewTabId?: PreviewTab) => {
    setActiveNav(previewTabId || sectionId);
    if (previewTabId) {
      setActiveTab(previewTabId);
    }

    setHighlightedSection(previewTabId ? 'preview' : sectionId);
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedSection(null);
    }, 1800);

    const el = document.getElementById(sectionId);
    if (el) {
      const topOffset = sectionId === 'hero' ? 0 : el.getBoundingClientRect().top + window.pageYOffset - 35;
      window.scrollTo({ top: topOffset, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const previewEl = document.getElementById('preview');
      const scienceEl = document.getElementById('science');

      if (scienceEl && scrollY >= scienceEl.offsetTop - 300) {
        setActiveNav('science');
      } else if (previewEl && scrollY >= previewEl.offsetTop - 300) {
        setActiveNav(activeTab);
      } else {
        setActiveNav('hero');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeTab]);

  // Smooth scroll-reveal observer
  useEffect(() => {
    const container = rootRef.current;
    if (!container) return;

    const nodes = Array.from(container.querySelectorAll<HTMLElement>('.zenox-reveal'));
    if (typeof IntersectionObserver === 'undefined') {
      nodes.forEach((n) => n.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  const split = SPLIT_PROFILES[splitId];
  const weekSpec = MESO_WEEK_MODIFIERS[mesoWeek];
  const chestSets = Math.round(split.chestSets * weekSpec.volumeFactor);
  const backSets = Math.round(split.backSets * weekSpec.volumeFactor);
  const quadsSets = Math.round(split.quadsSets * weekSpec.volumeFactor);
  const weeklyTonnage = Math.round(split.baseTonnageKg * weekSpec.volumeFactor);

  const animatedKcal = useCountUp(weekSpec.kcal);
  const animatedTonnage = useCountUp(weeklyTonnage);
  const tdeeData = TDEE_GOALS[tdeeGoal];
  const animatedIntake = useCountUp(tdeeData.intake);
  const animatedSurplus = useCountUp(Math.round(monthlyIncome * 0.35));
  const scheduleData = SCHEDULE_PROFILES[scheduleMode];

  return (
    <div
      ref={rootRef}
      className="min-h-screen bg-[#030002] text-zinc-100 font-sans selection:bg-rose-900 selection:text-white relative overflow-x-hidden p-2 sm:p-4 lg:p-6"
    >
      {/* HERO FRAME CONTAINER */}
      <div className="relative rounded-[28px] sm:rounded-[36px] lg:rounded-[44px] bg-[#070205] border border-white/[0.08] overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.9),0_0_120px_rgba(225,29,72,0.12)] min-h-[92vh] flex flex-col justify-between">
        {/* Dynamic Living Ambient Background */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[-5%] left-[18%] w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,rgba(225,29,72,0.22)_0%,transparent_70%)] blur-3xl animate-ambient-1" />
          <div className="absolute top-[20%] right-[12%] w-[480px] h-[480px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.18)_0%,transparent_70%)] blur-3xl animate-ambient-2" />
          <div className="absolute bottom-[5%] left-[30%] w-[600px] h-[420px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.16)_0%,transparent_70%)] blur-3xl animate-ambient-3" />

          {/* Cyber Grid with Moving Laser Scanline */}
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:32px_32px] opacity-40" />
          <div className="absolute inset-x-0 h-28 bg-gradient-to-b from-transparent via-rose-500/10 to-transparent pointer-events-none animate-laser-scan" />
        </div>

        {/* TOP NAVIGATION BAR */}
        <header className="relative z-30 pt-5 px-4 sm:px-8 max-w-[1720px] mx-auto w-full grid grid-cols-[auto_1fr_auto] xl:grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          <div className="flex items-center justify-start shrink-0">
            <div
              onClick={() => navigateToSection('hero')}
              title="ZENOX - Hệ điều hành hiệu suất cá nhân"
              className="cursor-pointer select-none py-1 group transition-transform duration-200 hover:scale-[1.03] flex items-center"
            >
              <img
                src="/zenox-logo.png"
                alt="ZENOX"
                className="h-7 sm:h-8 w-auto object-contain filter drop-shadow-[0_0_16px_rgba(56,189,248,0.45)]"
              />
            </div>
          </div>

          <div className="hidden lg:flex items-center justify-center min-w-0">
            <nav className="flex items-center gap-0.5 sm:gap-1 px-2 py-1.5 rounded-full bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-xs select-none whitespace-nowrap">
              {[
                { id: 'hero', label: 'Trang chủ', target: 'hero' },
                { id: 'ntn', label: 'Lộ trình NTN', target: 'preview', previewTab: 'ntn' as PreviewTab },
                { id: 'tdee', label: 'TDEE Thích ứng', target: 'preview', previewTab: 'tdee' as PreviewTab },
                { id: 'schedule', label: 'Lịch trình', target: 'preview', previewTab: 'schedule' as PreviewTab },
                { id: 'finance', label: 'Tài chính', target: 'preview', previewTab: 'finance' as PreviewTab },
                { id: 'science', label: 'Nguyên lý', target: 'science' },
              ].map((tab) => {
                const isActive = activeNav === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => navigateToSection(tab.target, tab.previewTab)}
                    className={`relative px-3 py-1.5 rounded-full text-xs transition-all duration-300 cursor-pointer ${
                      isActive
                        ? 'text-white font-semibold bg-white/[0.12] border border-white/20 shadow-[0_0_16px_rgba(244,63,94,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] scale-[1.02]'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.9)] animate-pulse" />
                    )}
                  </button>
                );
              })}

              <div className="h-3.5 w-px bg-white/15 mx-1" />

              <button
                onClick={() => navigateToSection('preview', 'ntn')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                  activeNav === 'ntn'
                    ? 'bg-rose-500/25 border-rose-500/50 text-white shadow-[0_0_15px_rgba(225,29,72,0.35)]'
                    : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/25 text-rose-300 hover:text-white'
                }`}
              >
                <span>Mesocycle</span>
                <span className="text-[10px]">↗</span>
              </button>
            </nav>
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              onClick={onToggleDarkMode}
              className="p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center justify-center shadow-sm group shrink-0"
              title={darkMode ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-300 transition-transform group-hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-rose-300 transition-transform group-hover:-rotate-12" />
              )}
            </button>

            {isLoggedIn ? (
              <>
                <button
                  onClick={onEnterApp}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-300 hover:text-white transition-all cursor-pointer px-3.5 py-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 shadow-[0_0_15px_rgba(225,29,72,0.25)] hover:scale-[1.02] whitespace-nowrap"
                  title="Vào Workspace ZENOX"
                >
                  <span>Vào Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5 text-rose-300" />
                </button>

                <button
                  onClick={onEnterApp}
                  className="nav-glass-btn shrink-0"
                  title="Tài khoản ZENOX đã đăng nhập - Bấm để vào Workspace"
                >
                  <span className="nav-glass-btn__title">
                    {userName ? (userName.length > 12 ? userName.slice(0, 10) + '...' : userName) : 'Tài Khoản'}
                  </span>
                  <span className="nav-glass-btn__circle" aria-hidden="true" />
                </button>
              </>
            ) : (
              <button
                onClick={onOpenLogin}
                className="nav-glass-btn shrink-0"
                title="Đăng nhập tài khoản ZENOX bảo mật"
              >
                <span className="nav-glass-btn__title">Đăng Nhập</span>
                <span className="nav-glass-btn__circle" aria-hidden="true" />
              </button>
            )}
          </div>
        </header>

        {/* HERO SECTION */}
        <div
          id="hero"
          className="relative z-20 flex-1 flex flex-col justify-center items-center px-4 sm:px-8 py-12 sm:py-16 text-center max-w-5xl mx-auto w-full animate-calm-fade-rise select-none"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/15 text-xs text-zinc-300 mb-6 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]" />
            <span className="font-medium tracking-wide">Hệ điều hành hiệu suất cá nhân</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400 font-mono text-[11px]">ZENOX v2.4 Core</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-[1.12] [text-wrap:balance] max-w-4xl mx-auto mb-6 text-center">
            <span>Nền Tảng Điều Hành</span>{' '}
            <span className="text-rose-400 animate-text-shimmer">Thể Hình &amp; Hiệu Suất</span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-2xl mx-auto mb-8 font-normal [text-wrap:balance] text-center">
            Hợp nhất quản trị thời gian làm việc tập trung, dữ liệu tài chính và giao thức thể hình Mesocycle với thuật toán TDEE thích ứng theo dữ liệu chuyển hóa thực tế của ZENOX.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5">
            <button
              onClick={onEnterApp}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-white hover:bg-zinc-100 text-zinc-950 text-sm font-semibold transition-all duration-200 cursor-pointer shadow-[0_4px_25px_rgba(255,255,255,0.25)] hover:scale-[1.01] active:scale-[0.98]"
            >
              <span>{isLoggedIn ? 'Vào Workspace Ngay' : 'Vào Ứng Dụng Ngay'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => navigateToSection('preview', 'ntn')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-zinc-200 hover:text-white text-sm font-medium transition-all duration-200 cursor-pointer active:scale-[0.98]"
            >
              <span>Khám Phá Tính Năng</span>
              <span className="text-xs text-zinc-400">↓</span>
            </button>
          </div>

          {/* 4 INTERACTIVE TELEMETRY CARDS WITH LIVE COUNT-UP */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 max-w-4xl mx-auto w-full mt-12 text-left">
            <div
              onClick={() => navigateToSection('preview', 'ntn')}
              className="card-futuristic-interactive p-4 rounded-2xl bg-white/[0.03] border border-white/10 cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-zinc-400 group-hover:text-rose-300 transition-colors">
                  01 / Lộ trình NTN
                </span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                </span>
              </div>
              <div className="text-base font-bold text-white mt-1.5 font-mono tabular-nums group-hover:text-rose-200 transition-colors">
                {formatVnNumber(animatedKcal)} kcal
              </div>
              <div className="text-xs text-zinc-400 mt-0.5 truncate">
                {split.label} · RPE {weekSpec.rpe}
              </div>
            </div>

            <div
              onClick={() => navigateToSection('preview', 'tdee')}
              className="card-futuristic-interactive p-4 rounded-2xl bg-white/[0.03] border border-white/10 cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-zinc-400 group-hover:text-emerald-300 transition-colors">
                  02 / TDEE Thích ứng
                </span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              </div>
              <div className="text-base font-bold text-rose-300 mt-1.5 font-mono tabular-nums group-hover:text-emerald-300 transition-colors">
                {formatVnNumber(animatedIntake)} kcal/ngày
              </div>
              <div className="text-xs text-zinc-400 mt-0.5 truncate">
                EMA {tdeeData.emaWeight} · {tdeeData.weeklyRate}
              </div>
            </div>

            <div
              onClick={() => navigateToSection('preview', 'schedule')}
              className="card-futuristic-interactive p-4 rounded-2xl bg-white/[0.03] border border-white/10 cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-zinc-400 group-hover:text-blue-300 transition-colors">
                  03 / Lịch trình Khối
                </span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
              </div>
              <div className="text-base font-bold text-white mt-1.5 font-mono tabular-nums group-hover:text-blue-200 transition-colors">
                {scheduleData.adherence}
              </div>
              <div className="text-xs text-zinc-400 mt-0.5 truncate">{scheduleData.deepWorkHours}</div>
            </div>

            <div
              onClick={() => navigateToSection('preview', 'finance')}
              className="card-futuristic-interactive p-4 rounded-2xl bg-white/[0.03] border border-white/10 cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-zinc-400 group-hover:text-amber-300 transition-colors">
                  04 / Tài chính cá nhân
                </span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
              </div>
              <div className="text-base font-bold text-emerald-400 mt-1.5 font-mono tabular-nums group-hover:text-amber-200 transition-colors">
                +{formatVnNumber(animatedSurplus)} ₫
              </div>
              <div className="text-xs text-zinc-400 mt-0.5 truncate">Tích lũy &amp; đầu tư 35%</div>
            </div>
          </div>
        </div>

        {/* BOTTOM SCROLL HINT */}
        <div className="relative z-30 pb-6 px-6 sm:px-10 flex items-center justify-between text-xs text-zinc-400 font-mono select-none">
          <button
            onClick={() => navigateToSection('preview', 'ntn')}
            className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer group"
          >
            <div className="w-4 h-4 rounded-full bg-white/[0.08] flex items-center justify-center group-hover:translate-y-0.5 transition-transform">
              <ArrowDown className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-[11px]">Cuộn xuống xem bảng điều khiển</span>
          </button>

          <div className="text-[11px] text-zinc-400">ZENOX OS · Khoa Học Thể Hình &amp; Hiệu Suất</div>
        </div>
      </div>

      {/* SECTION 2: INTERACTIVE PERFORMANCE TERMINAL */}
      <section id="preview" className="pt-24 pb-16 px-4 sm:px-6 max-w-7xl mx-auto relative z-10">
        <div className="max-w-3xl mb-12 space-y-3 zenox-reveal">
          <div className="text-xs font-mono text-rose-400 tracking-wider">BẢNG ĐIỀU KHIỂN TƯƠNG TÁC THỰC TẾ</div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
            Trải nghiệm hệ điều hành ZENOX
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed [text-wrap:balance]">
            Tùy chỉnh trực tiếp lịch tập, tuần chu kỳ, mục tiêu năng lượng và thu nhập tháng bên dưới để quan sát mô hình tính toán phản hồi theo thời gian thực.
          </p>
        </div>

        <div
          className={`zenox-reveal relative rounded-[28px] p-[1.5px] bg-gradient-to-b from-white/30 via-white/10 to-transparent shadow-[0_25px_90px_-20px_rgba(225,29,72,0.35),0_0_60px_rgba(0,0,0,0.85)] transition-all duration-500 ${
            highlightedSection === 'preview' ? 'animate-target-pulse ring-2 ring-rose-500/60' : ''
          }`}
        >
          <div className="rounded-[26px] bg-[#0c050a]/95 backdrop-blur-3xl border border-white/[0.08] overflow-hidden shadow-2xl relative">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent z-20" />

            <div className="h-14 px-6 bg-white/[0.02] backdrop-blur-md border-b border-white/[0.08] flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-[0_0_8px_rgba(255,95,86,0.6)]" />
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-[0_0_8px_rgba(255,189,46,0.6)]" />
                  <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-[0_0_8px_rgba(39,201,63,0.6)]" />
                </div>
                <span className="font-mono text-[11px] text-zinc-400 pl-2 border-l border-white/10">
                  zenox.engine // adaptive_performance_core
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-3 font-mono text-[11px]">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  Đồng bộ hóa 0ms
                </span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-400">{weekSpec.label}</span>
              </div>
            </div>

            <div className="px-6 pt-5 pb-3 border-b border-white/[0.06] bg-black/20 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                {[
                  { id: 'ntn' as PreviewTab, label: 'Lộ trình NTN', icon: Dumbbell },
                  { id: 'tdee' as PreviewTab, label: 'TDEE Thích Ứng', icon: Flame },
                  { id: 'schedule' as PreviewTab, label: 'Lịch trình Time-Block', icon: Clock },
                  { id: 'finance' as PreviewTab, label: 'Quản Trị Tài Chính', icon: Wallet },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-rose-600/35 text-white border border-rose-500/50 shadow-[0_0_20px_rgba(225,29,72,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 text-rose-400" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-zinc-500">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span>Mô phỏng tương tác thực tế</span>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {activeTab === 'ntn' && (
                <div key="tab-ntn" className="space-y-6 zenox-tab-enter">
                  {/* Interactive Controls */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-mono text-zinc-400 block">CHỌN LỊCH PHÂN CHIA (SPLIT)</span>
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(SPLIT_PROFILES) as SplitId[]).map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setSplitId(id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                              splitId === id
                                ? 'bg-rose-500/20 border-rose-500/50 text-white shadow-[0_0_12px_rgba(225,29,72,0.25)]'
                                : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
                            }`}
                          >
                            {SPLIT_PROFILES[id].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-mono text-zinc-400 block">CHU KỲ MESOCYCLE (12 TUẦN)</span>
                      <div className="flex flex-wrap gap-2">
                        {([1, 3, 6, 12] as MesoWeekId[]).map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setMesoWeek(w)}
                            className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-all cursor-pointer ${
                              mesoWeek === w
                                ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                                : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
                            }`}
                          >
                            {w === 12 ? 'Tuần 12 Deload' : `Tuần ${w}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-950/30 via-white/[0.02] to-transparent border border-white/10 backdrop-blur-xl relative overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/30 to-rose-700/10 border border-rose-500/40 flex items-center justify-center text-rose-300 shadow-[0_0_20px_rgba(225,29,72,0.3)]">
                          <Dumbbell className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-xs font-mono text-rose-400 tracking-wider">
                            LỘ TRÌNH THỂ HÌNH CHU KỲ HÓA ZENOX (NTN)
                          </div>
                          <div className="text-lg font-bold text-white">{weekSpec.phaseNote}</div>
                          <div className="text-xs text-zinc-400 font-mono tabular-nums">
                            {weekSpec.label} · Target RPE: {weekSpec.rpe} (RIR {weekSpec.rir}) · Tổng tải:{' '}
                            <span className="text-zinc-200 font-semibold">{formatVnNumber(animatedTonnage)} kg</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                        <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                          <span className="text-zinc-500 block text-[10px]">MỤC TIÊU CALO</span>
                          <span className="text-white font-bold text-sm tabular-nums">
                            {formatVnNumber(animatedKcal)} kcal
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                          <span className="text-zinc-500 block text-[10px]">ĐẠM (MPS ≥ 3,0G)</span>
                          <span className="text-rose-300 font-bold text-sm tabular-nums">{weekSpec.protein}g</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                          <span className="text-zinc-500 block text-[10px]">TINH BỘT</span>
                          <span className="text-white font-bold text-sm tabular-nums">{weekSpec.carbs}g</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                          <span className="text-zinc-500 block text-[10px]">CHẤT BÉO</span>
                          <span className="text-white font-bold text-sm tabular-nums">{weekSpec.fat}g</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { name: 'Ngực (Chest Volume)', sets: chestSets, mev: 10, mav: 14, mrv: 18 },
                      { name: 'Lưng (Back Volume)', sets: backSets, mev: 12, mav: 16, mrv: 20 },
                      { name: 'Đùi trước (Quads Volume)', sets: quadsSets, mev: 8, mav: 12, mrv: 16 },
                    ].map((m) => {
                      const pct = Math.min(100, Math.round((m.sets / m.mrv) * 100));
                      return (
                        <div
                          key={m.name}
                          className="p-5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 space-y-3 shadow-lg"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-zinc-200">{m.name}</span>
                            <span className="font-mono text-rose-400 font-bold tabular-nums">
                              {m.sets} / {m.mrv} sets
                            </span>
                          </div>
                          <div className="h-2 w-full bg-white/[0.08] rounded-full overflow-hidden p-0.5">
                            <div
                              className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full shadow-[0_0_10px_rgba(225,29,72,0.5)] transition-[width] duration-500 ease-out"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] font-mono text-zinc-500 tabular-nums">
                            <span>MEV: {m.mev} sets</span>
                            <span className="text-rose-300">MAV: {m.mav} sets</span>
                            <span>MRV: {m.mrv} sets</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'tdee' && (
                <div key="tab-tdee" className="space-y-6 zenox-tab-enter">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
                    <div>
                      <span className="text-[11px] font-mono text-zinc-400 block">CHẾ ĐỘ MỤC TIÊU CHUYỂN HÓA</span>
                      <div className="text-sm font-semibold text-white mt-0.5">
                        Thuật toán cân bằng năng lượng thích ứng ZENOX
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(TDEE_GOALS) as TdeeGoalId[]).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setTdeeGoal(g)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                            tdeeGoal === g
                              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                              : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {TDEE_GOALS[g].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 rounded-2xl bg-gradient-to-b from-rose-950/20 to-white/[0.02] border border-white/10 backdrop-blur-xl space-y-4 shadow-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                          <Flame className="w-4 h-4 text-rose-500" />
                          <span>Tiêu hao chuyển hóa thực nghiệm</span>
                        </div>
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          100% tin cậy (14 ngày)
                        </span>
                      </div>

                      <div>
                        <div className="text-3xl font-bold text-white tracking-tight font-mono tabular-nums">
                          {formatVnNumber(animatedIntake)}{' '}
                          <span className="text-base font-normal text-zinc-400">kcal/ngày</span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">
                          Phương trình cân bằng năng lượng thích ứng ZENOX.
                        </p>
                      </div>

                      <div className="pt-3 border-t border-white/[0.08] space-y-2 text-xs font-mono text-zinc-400">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Cân nặng làm mịn (EMA)</span>
                          <span className="text-white font-bold tabular-nums">{tdeeData.emaWeight}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Tốc độ biến thiên cân</span>
                          <span className="text-emerald-400 font-bold tabular-nums">{tdeeData.weeklyRate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Biên độ thặng dư/thâm hụt</span>
                          <span className="text-rose-300 font-bold tabular-nums">
                            {tdeeData.delta > 0 ? `+${tdeeData.delta}` : tdeeData.delta} kcal
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-gradient-to-b from-rose-950/20 to-white/[0.02] border border-white/10 backdrop-blur-xl space-y-4 shadow-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                          <HeartPulse className="w-4 h-4 text-rose-500" />
                          <span>Vi chất &amp; Tổng hợp cơ</span>
                        </div>
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-white/[0.06] text-zinc-300 border border-white/15">
                          95+ chỉ số
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                        <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.08]">
                          <span className="text-[10px] text-zinc-500 block">ĐẠM</span>
                          <span className="text-sm font-bold text-rose-300 tabular-nums">{tdeeData.protein}g</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.08]">
                          <span className="text-[10px] text-zinc-500 block">CARBS</span>
                          <span className="text-sm font-bold text-white tabular-nums">{tdeeData.carbs}g</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.08]">
                          <span className="text-[10px] text-zinc-500 block">CHẤT BÉO</span>
                          <span className="text-sm font-bold text-white tabular-nums">{tdeeData.fat}g</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/[0.08] space-y-2.5 text-xs">
                        <div>
                          <div className="flex justify-between text-[11px] mb-1 font-mono">
                            <span className="text-zinc-400">Ngưỡng Leucine MPS</span>
                            <span className="text-rose-300 font-bold">3,2g / 3,0g chuẩn</span>
                          </div>
                          <div className="h-2 w-full bg-white/[0.08] rounded-full overflow-hidden p-0.5">
                            <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full w-full shadow-[0_0_8px_rgba(225,29,72,0.6)]" />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1 font-mono">
                            <span className="text-zinc-400">Tỷ lệ Omega 3:6</span>
                            <span className="text-emerald-400 font-bold">1:3,2 (Chống viêm)</span>
                          </div>
                          <div className="h-2 w-full bg-white/[0.08] rounded-full overflow-hidden p-0.5">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full w-[95%] shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-gradient-to-b from-rose-950/20 to-white/[0.02] border border-white/10 backdrop-blur-xl space-y-4 shadow-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                          <TrendingUp className="w-4 h-4 text-sky-400" />
                          <span>Đường xu hướng EMA</span>
                        </div>
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-white/[0.06] text-zinc-400 border border-white/10">
                          ZENOX Core
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-black/30 border border-white/[0.06]">
                        <svg viewBox="0 0 270 64" className="w-full h-16 overflow-visible">
                          <line x1="0" y1="38" x2="270" y2="38" stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
                          <polyline
                            fill="none"
                            stroke="#fb7185"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={tdeeData.curvePoints}
                            className="transition-all duration-500"
                          />
                        </svg>
                      </div>

                      <div className="font-mono text-xs text-zinc-300 space-y-1 p-3 rounded-xl bg-black/30 border border-white/[0.06]">
                        <div className="text-[11px] text-zinc-500 font-sans">Mô hình năng lượng ZENOX:</div>
                        <div className="text-rose-300">TDEE = Intake − (ΔWeight_EMA × 7.700)</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'schedule' && (
                <div key="tab-schedule" className="space-y-6 zenox-tab-enter">
                  <div className="p-6 rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/10 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-rose-500" />
                        <span className="font-bold text-white text-sm">Khối thời gian tập trung hôm nay</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {(Object.keys(SCHEDULE_PROFILES) as ScheduleDayMode[]).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setScheduleMode(m)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                              scheduleMode === m
                                ? 'bg-blue-500/20 border-blue-400/50 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.25)]'
                                : 'bg-white/[0.04] border-white/10 text-zinc-400 hover:text-white'
                            }`}
                          >
                            {SCHEDULE_PROFILES[m].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {scheduleData.blocks.map((block) => {
                        const tone = TONE_CLASS[block.tone];
                        return (
                          <div key={block.time} className={`p-4 rounded-xl border space-y-2 ${tone.card}`}>
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className={`font-bold ${tone.time}`}>{block.time}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] ${tone.badge}`}>{block.tag}</span>
                            </div>
                            <div className="font-semibold text-white text-sm">{block.title}</div>
                            <div className="text-xs text-zinc-400">{block.detail}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'finance' && (
                <div key="tab-finance" className="space-y-6 zenox-tab-enter">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
                    <div>
                      <span className="text-[11px] font-mono text-zinc-400 block">MỨC THU NHẬP THÁNG MÔ PHỎNG</span>
                      <div className="text-sm font-semibold text-white mt-0.5">
                        Phân bổ dòng tiền kỷ luật theo mô hình 6 quỹ ZENOX
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {INCOME_PRESETS.map((inc) => (
                        <button
                          key={inc}
                          type="button"
                          onClick={() => setMonthlyIncome(inc)}
                          className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-all cursor-pointer ${
                            monthlyIncome === inc
                              ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                              : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {formatVnNumber(inc)} ₫
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 space-y-3">
                      <div className="text-xs text-zinc-400 font-mono">TÍCH LŨY &amp; ĐẦU TƯ RÒNG (35%)</div>
                      <div className="text-3xl font-bold text-emerald-400 font-mono tabular-nums">
                        +{formatVnNumber(animatedSurplus)} <span className="text-sm font-normal text-zinc-400">₫</span>
                      </div>
                      <p className="text-xs text-zinc-400">Tự động trích lập kỷ luật trước khi chi tiêu sinh hoạt.</p>
                    </div>

                    <div className="p-6 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 space-y-3">
                      <div className="text-xs text-zinc-400 font-mono">HẠN MỨC SINH HOẠT (55%)</div>
                      <div className="text-3xl font-bold text-white font-mono tabular-nums">
                        {formatVnNumber(monthlyIncome * 0.55)}{' '}
                        <span className="text-sm font-normal text-zinc-400">₫</span>
                      </div>
                      <p className="text-xs text-zinc-400">Kiểm soát ăn uống, di chuyển và hóa đơn cố định.</p>
                    </div>

                    <div className="p-6 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 space-y-3">
                      <div className="text-xs text-zinc-400 font-mono">QUỸ DỰ PHÒNG KHẨN CẤP</div>
                      <div className="text-3xl font-bold text-rose-300 font-mono tabular-nums">
                        6 <span className="text-sm font-normal text-zinc-400">tháng sinh hoạt</span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Thanh khoản sẵn sàng: {formatVnNumber(monthlyIncome * 0.55 * 6)} ₫.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {SIX_JARS.map((jar) => (
                      <div
                        key={jar.id}
                        className="p-4 rounded-xl bg-white/[0.025] border border-white/[0.08] space-y-2.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-300 font-medium">{jar.label}</span>
                          <span className="font-mono font-bold text-white tabular-nums">
                            {formatVnNumber((monthlyIncome * jar.pct) / 100)} ₫
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-white/[0.08] rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${jar.bar} rounded-full transition-[width] duration-500`}
                            style={{ width: `${Math.min(100, jar.pct * 1.6)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: FOUR CORE PILLARS */}
      <section id="pillars" className="py-24 border-t border-white/[0.08] px-4 sm:px-6 max-w-7xl mx-auto relative z-10">
        <div className="max-w-2xl mb-16 space-y-3 zenox-reveal">
          <div className="text-xs font-mono text-rose-400 tracking-wider">HỆ THỐNG VẬN HÀNH TOÀN DIỆN</div>
          <h2 className="text-3xl font-bold tracking-tight text-white [text-wrap:balance]">
            Bốn trụ cột hiệu suất cao
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed [text-wrap:balance]">
            Mỗi module được thiết kế với độ chuẩn xác cao, dựa trên nguyên tắc khoa học thực nghiệm của ZENOX thay vì ước tính cảm tính.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {[
            {
              icon: Dumbbell,
              title: 'Lộ trình thể hình (NTN)',
              desc: 'Chu kỳ hóa Mesocycle 8-12 tuần theo chuẩn ZENOX Sports Science. Kiểm soát thể tích cơ bắp MEV, MAV và MRV để tối ưu hóa phì đại cơ nạc.',
              bullets: ['Quá tải lũy tiến theo RPE/RIR', 'Nhập giáo án thông minh từ Text/CSV'],
            },
            {
              icon: Flame,
              title: 'TDEE Thích Ứng',
              desc: 'Thuật toán cân bằng năng lượng thực nghiệm ZENOX. Tự động cập nhật mức calo mục tiêu mỗi ngày từ lượng nạp thực tế và xu hướng cân nặng làm mịn EMA.',
              bullets: ['Loại bỏ hoàn toàn nhiễu nước', 'Chuẩn xác theo chuyển hóa cá nhân'],
            },
            {
              icon: Calendar,
              title: 'Lịch trình đa nhiệm',
              desc: 'Time-blocking 5 góc nhìn với cơ chế kéo thả mượt mà. Tích hợp đồng hồ tập trung Pomodoro, né trùng giờ tập và đồng bộ hóa ngoại tuyến.',
              bullets: ['Kiến trúc Offline-First an toàn', 'Tích hợp Google Calendar OAuth'],
            },
            {
              icon: Wallet,
              title: 'Quản lý tài chính',
              desc: 'Quản trị dòng tiền kỷ luật với mô hình phân bổ quỹ 6 lọ. Báo cáo dòng tiền ròng, tỷ lệ tiết kiệm và giám sát chi tiêu theo từng hạn mức danh mục.',
              bullets: ['Theo dõi dòng tiền ròng thực tế', 'Bảo toàn vốn và mục tiêu dài hạn'],
            },
          ].map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                style={{ transitionDelay: `${idx * 70}ms` }}
                className="zenox-reveal relative group p-6 rounded-3xl bg-white/[0.025] hover:bg-white/[0.045] backdrop-blur-2xl border border-white/10 hover:border-white/20 transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between space-y-6 h-full"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/25 to-rose-700/10 border border-rose-500/35 flex items-center justify-center text-rose-300 shadow-[0_0_20px_rgba(225,29,72,0.25)]">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white [text-wrap:balance]">{pillar.title}</h3>
                  <p className="text-xs text-zinc-300 leading-relaxed [text-wrap:balance]">{pillar.desc}</p>
                </div>
                <ul className="text-xs font-mono text-zinc-400 space-y-2 pt-4 border-t border-white/[0.06]">
                  {pillar.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 4: COMPARISON MATRIX */}
      <section id="science" className="py-24 border-t border-white/[0.08] px-4 sm:px-6 max-w-7xl mx-auto relative z-10">
        <div className="max-w-2xl mb-16 space-y-3 zenox-reveal">
          <div className="text-xs font-mono text-rose-400 tracking-wider">SO SÁNH BẢN CHẤT</div>
          <h2 className="text-3xl font-bold tracking-tight text-white [text-wrap:balance]">
            Nguyên lý khoa học vs. Phương pháp truyền thống
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed [text-wrap:balance]">
            Sự khác biệt giữa các ứng dụng ước tính tĩnh thông thường và hệ thống thích ứng dữ liệu thực nghiệm của ZENOX.
          </p>
        </div>

        <div
          className={`zenox-reveal rounded-3xl border border-white/10 overflow-hidden bg-white/[0.02] backdrop-blur-2xl shadow-2xl transition-all duration-500 ${
            highlightedSection === 'science' ? 'animate-target-pulse ring-2 ring-rose-500/60' : ''
          }`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.08]">
            <div className="p-8 space-y-6 bg-black/40">
              <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider font-bold">
                ỨNG DỤNG TRUYỀN THỐNG
              </div>
              <ul className="space-y-4 text-xs text-zinc-400 leading-relaxed">
                <li className="flex items-start gap-3">
                  <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="[text-wrap:balance]">
                    <strong className="text-zinc-300">TDEE cố định bất biến:</strong> Sử dụng công thức tĩnh một lần và không tự điều chỉnh theo thích ứng chuyển hóa khi cơ thể thâm hụt hoặc thặng dư.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="[text-wrap:balance]">
                    <strong className="text-zinc-300">Nhiễu cân nặng tức thời:</strong> Người dùng dễ hoang mang trước biến động ngắn hạn do nước, natri và glycogen thay vì nhìn đường xu hướng làm mịn.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="[text-wrap:balance]">
                    <strong className="text-zinc-300">Dữ liệu phân mảnh:</strong> Lịch làm việc, nhật ký tạ, dinh dưỡng và chi tiêu tài chính nằm rời rạc ở nhiều ứng dụng khác nhau.
                  </span>
                </li>
              </ul>
            </div>

            <div className="p-8 space-y-6 bg-gradient-to-br from-rose-950/25 via-white/[0.02] to-transparent relative">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-500/40 to-transparent" />
              <div className="text-xs font-mono text-rose-300 uppercase tracking-wider font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.8)]" />
                HỆ THỐNG ZENOX ADAPTIVE CORE
              </div>
              <ul className="space-y-4 text-xs text-zinc-200 leading-relaxed">
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="[text-wrap:balance]">
                    <strong className="text-white">TDEE động thích ứng thực nghiệm:</strong> Hiệu chỉnh liên tục mỗi ngày dựa trên độ dốc cân nặng thực tế và nhật ký calo theo mô hình ZENOX.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="[text-wrap:balance]">
                    <strong className="text-white">Lọc làm mịn số liệu EMA:</strong> Thuật toán trung bình hàm mũ bóc tách mô mỡ thực tế khỏi biến động nước, giúp quyết định dinh dưỡng chuẩn xác.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="[text-wrap:balance]">
                    <strong className="text-white">Hợp nhất hiệu suất toàn diện:</strong> Lịch trình time-blocking bảo vệ giờ tập NTN, quản trị năng lượng và kiểm soát chi tiêu cùng một nơi.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.08] py-8 px-6 bg-[#040102]/90 backdrop-blur-xl relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
          <div className="flex flex-wrap items-center gap-3 select-none">
            <img
              src="/zenox-logo.png"
              alt="ZENOX"
              className="h-6 w-auto object-contain opacity-95 hover:opacity-100 transition-opacity"
            />
            <span className="text-zinc-400">· Hệ điều hành hiệu suất cá nhân © 2026</span>
            <span className="text-zinc-600 hidden sm:inline">|</span>
            <span className="text-rose-400 font-mono text-[11px] font-semibold tracking-wider">
              Dev By Zenox Development
            </span>
          </div>

          <div className="flex items-center gap-6 font-mono text-[11px]">
            <span className="text-zinc-500">ZENOX Adaptive Performance Architecture</span>
            <button
              onClick={onEnterApp}
              className="text-rose-400 hover:text-rose-300 transition-colors cursor-pointer font-semibold"
            >
              Khởi động ứng dụng →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

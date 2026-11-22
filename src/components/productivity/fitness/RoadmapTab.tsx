import React, { useState, useMemo, useEffect } from 'react';
import {
  Share2,
  User,
  Activity,
  Compass,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Flame,
  Dumbbell,
  Scale,
  Award,
  Zap,
  Info,
  Bookmark,
  BookmarkCheck,
  Save,
  Trash2,
  Sliders,
  Check,
  X,
  History,
  Layers,
  Utensils,
  Calendar,
  Clock,
  Target,
  PlayCircle,
  ChevronRight,
  Filter,
  Eye,
  Edit3,
  PlusCircle,
  RefreshCw,
  Wand2,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Copy,
} from 'lucide-react';
import {
  BodyPoint,
  CtgPeriodizedRoadmap,
  CtgProfile,
  CtgRoadmapPhase,
  CtgPhaseType,
  Goal,
  NutritionSettings,
  RoutineSplitTemplate,
  SavedRoadmap,
  Sex,
} from '../../../types/productivity';
import { SEED_CTG_PERIODIZED_ROADMAP } from '../../../data/productivitySeed';
import {
  ffmi,
  leanMassKg,
  fatMassKg,
  tdee,
  calorieTarget,
  macroTargets,
  MESOCYCLE_PHASES,
  generateCtgPeriodizedRoadmap,
  calculatePhaseNutrition,
} from '../../../utils/fitnessMetrics';
import { notifySuccess } from '../../../utils/notify';
import { CtgTrajectoryChart } from './CtgTrajectoryChart';
import { CtgWeeklyAdvisor } from './CtgWeeklyAdvisor';
import { MesocycleProgressionStudio } from './MesocycleProgressionStudio';
import { CtgCalendarSyncModal } from './CtgCalendarSyncModal';
import { CtgCheckinExportModal } from './CtgCheckinExportModal';
import { CalendarEvent } from '../../../types/calendar';
import { PlannedSession } from '../../../types/productivity';

interface RoadmapTabProps {
  profile: CtgProfile;
  lang: 'vi' | 'en';
  bodyPoints?: BodyPoint[];
  ctgPeriodizedRoadmap?: CtgPeriodizedRoadmap | null;
  onUpdateCtgPeriodizedRoadmap?: (roadmap: CtgPeriodizedRoadmap | null) => void;
  onSetActiveRoadmapPhase?: (phaseId: string) => void;
  savedRoadmaps?: SavedRoadmap[];
  onAddSavedRoadmap?: (roadmap: Omit<SavedRoadmap, 'id' | 'createdAt'>) => SavedRoadmap;
  onDeleteSavedRoadmap?: (id: string) => void;
  nutritionSettings?: NutritionSettings;
  onUpdateNutritionSettings?: (patch: Partial<NutritionSettings>) => void;
  onUpdateProfile: (patch: Partial<CtgProfile>) => void;
  onNavigateTab?: (tab: 'inbody' | 'training' | 'nutrition' | 'profile') => void;
  onApplySplitTemplate?: (template: RoutineSplitTemplate) => void;
  savedCtgRoadmaps?: CtgPeriodizedRoadmap[];
  onSaveCtgRoadmap?: (roadmap: CtgPeriodizedRoadmap) => void;
  onDeleteCtgRoadmap?: (roadmapId: string) => void;
  onSwitchCtgRoadmap?: (roadmapId: string) => void;
  onDeleteCurrentCtgRoadmap?: () => void;
  events?: CalendarEvent[];
  plannedSessions?: PlannedSession[];
  onBatchScheduleToCalendar?: (events: CalendarEvent[]) => Promise<void> | void;
  onScheduleSessionToCalendar?: (title: string, date: string, color: string) => void;
}

export function parseVnDate(str: string): Date {
  if (!str || typeof str !== 'string') return new Date(NaN);
  const trimmed = str.trim();
  const parts = trimmed.split(/[/.-]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);
    if (isNaN(p0) || isNaN(p1) || isNaN(p2)) return new Date(NaN);
    if (parts[0].length === 4) {
      return new Date(p0, p1 - 1, p2);
    }
    const year = p2 < 100 ? 2000 + p2 : p2;
    return new Date(year, p1 - 1, p0);
  }
  return new Date(trimmed);
}

export function getPhaseStatus(phase: CtgRoadmapPhase, activePhaseId?: string): 'completed' | 'current' | 'upcoming' {
  if (activePhaseId && phase.id === activePhaseId) return 'current';
  if (!activePhaseId && phase.isCurrent) return 'current';
  const now = new Date();
  const end = parseVnDate(phase.endDate);
  if (Number.isFinite(end.getTime())) {
    end.setHours(23, 59, 59, 999);
    if (now > end) return 'completed';
  }
  const start = parseVnDate(phase.startDate);
  if (Number.isFinite(start.getTime())) {
    start.setHours(0, 0, 0, 0);
    if (now < start) return 'upcoming';
  }
  return 'current';
}

export const RoadmapTab: React.FC<RoadmapTabProps> = ({
  profile,
  lang,
  bodyPoints = [],
  ctgPeriodizedRoadmap,
  onUpdateCtgPeriodizedRoadmap,
  onSetActiveRoadmapPhase,
  savedRoadmaps = [],
  onAddSavedRoadmap,
  onDeleteSavedRoadmap,
  nutritionSettings,
  onUpdateNutritionSettings,
  onUpdateProfile,
  onNavigateTab,
  onApplySplitTemplate,
  savedCtgRoadmaps = [],
  onSaveCtgRoadmap,
  onDeleteCtgRoadmap,
  onSwitchCtgRoadmap,
  onDeleteCurrentCtgRoadmap,
  events = [],
  plannedSessions = [],
  onBatchScheduleToCalendar,
  onScheduleSessionToCalendar,
}) => {
  // Modal states
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [showRoadmapManagerModal, setShowRoadmapManagerModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showAddPhaseModal, setShowAddPhaseModal] = useState(false);
  const [editingPhase, setEditingPhase] = useState<CtgRoadmapPhase | null>(null);
  const [appliedBanner, setAppliedBanner] = useState<string | null>(null);
  const [isLiveTrackingCollapsed, setIsLiveTrackingCollapsed] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'current' | 'completed' | 'upcoming' | 'bulk' | 'cut'>('all');
  const [carbCyclingMode, setCarbCyclingMode] = useState<'standard' | 'carb_cycling'>('standard');
  const [isCalendarSyncModalOpen, setIsCalendarSyncModalOpen] = useState<boolean>(false);
  const [isCheckinExportModalOpen, setIsCheckinExportModalOpen] = useState<boolean>(false);

  // Wizard state (4-Step CTG Generator)
  const [wizardStep, setWizardStep] = useState<number>(0);
  const [wizSex, setWizSex] = useState<Sex>(profile.sex || 'male');
  const [wizHeight, setWizHeight] = useState<string>(String(profile.heightCm || 172));
  const [wizWeight, setWizWeight] = useState<string>(String(profile.targetWeightKg || 68));
  const [wizBodyFat, setWizBodyFat] = useState<string>(String(profile.targetBodyFatPct || 18));
  const [wizTargetBfPct, setWizTargetBfPct] = useState<number>(profile.sex === 'female' ? 20.0 : 12.0);
  const [wizTargetFfmi, setWizTargetFfmi] = useState<number>(profile.sex === 'female' ? 19.5 : 22.0);
  const [wizSteps, setWizSteps] = useState<number>(profile.stepGoal || 8000);
  const [wizTrainDays, setWizTrainDays] = useState<number>(4);
  const [wizTrainDuration, setWizTrainDuration] = useState<number>(60);
  const [wizSelectedSport, setWizSelectedSport] = useState<string>('running');
  const [wizSports, setWizSports] = useState<{ id: string; name: string; met: number; minutes: number; sessionsPerWeek: number }[]>([]);

  // Manual Add Phase Form States
  const [newPhaseName, setNewPhaseName] = useState('Giai đoạn Tăng cơ');
  const [newPhaseType, setNewPhaseType] = useState<CtgPhaseType>('bulk');
  const [newStartWeight, setNewStartWeight] = useState('68');
  const [newTargetWeight, setNewTargetWeight] = useState('71');
  const [newStartBf, setNewStartBf] = useState('15');
  const [newTargetBf, setNewTargetBf] = useState('17');
  const [newDurationWeeks, setNewDurationWeeks] = useState(8);
  const [newCalories, setNewCalories] = useState(2500);
  const [newProtein, setNewProtein] = useState(160);
  const [newCarbs, setNewCarbs] = useState(300);
  const [newFat, setNewFat] = useState(65);
  const [newNote, setNewNote] = useState('');

  // Active Roadmap & Phases
  const activeRoadmap = ctgPeriodizedRoadmap ?? null;
  const phases = useMemo(() => activeRoadmap?.phases || [], [activeRoadmap]);
  const activePhaseId = activeRoadmap?.activePhaseId || phases[0]?.id;
  const activePhase = useMemo(
    () => phases.find((p) => p.id === activePhaseId) || phases[0] || null,
    [phases, activePhaseId]
  );

  const firstPhase = phases[0] || null;
  const lastPhase = phases[phases.length - 1] || null;

  // Sorting InBody readings to obtain latest measurements
  const sortedBodyPoints = useMemo(() => {
    return [...(bodyPoints || [])].sort((a, b) => b.createdAt - a.createdAt);
  }, [bodyPoints]);

  const latestPoint = sortedBodyPoints[0];
  const currentWeight = Number(latestPoint?.weightKg ?? profile.targetWeightKg ?? 68);
  const currentBf = Number(latestPoint?.bodyFatPct ?? profile.targetBodyFatPct ?? 18);
  const curHeight = Number(profile.heightCm || 172);
  const curHeightM = curHeight / 100;
  const currentLbm = Math.round(currentWeight * (1 - currentBf / 100) * 10) / 10;
  const currentFfmi = Math.round(((currentLbm / (curHeightM * curHeightM)) + 6.1 * (1.8 - curHeightM)) * 10) / 10;

  // Sync wizard default inputs when opened
  useEffect(() => {
    if (showWizardModal) {
      setWizSex(profile.sex || 'male');
      setWizHeight(String(profile.heightCm || 172));
      setWizWeight(String(currentWeight || 68));
      setWizBodyFat(String(currentBf || 18));
      setWizTargetBfPct(profile.sex === 'female' ? 20.0 : 12.0);
      setWizTargetFfmi(profile.sex === 'female' ? 19.5 : 22.0);
      setWizardStep(0);
    }
  }, [showWizardModal, profile, currentWeight, currentBf]);

  // Derived progress and countdown metrics for active phase
  const isBulkPhase = activePhase?.phaseType === 'bulk';
  const startW = activePhase?.startWeightKg || currentWeight;
  const targetW = activePhase?.targetWeightKg || currentWeight;
  const deltaTarget = Math.abs(targetW - startW);
  const deltaCurrent = Math.abs(currentWeight - startW);
  const weightProgress = deltaTarget > 0 ? Math.min(100, Math.max(0, Math.round((deltaCurrent / deltaTarget) * 100))) : 100;

  const daysRemaining = useMemo(() => {
    if (!activePhase?.endDate) return 0;
    const end = parseVnDate(activePhase.endDate);
    if (!Number.isFinite(end.getTime())) return 0;
    const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }, [activePhase?.endDate]);

  const totalLbmGain = useMemo(() => {
    if (!firstPhase || !lastPhase) return 0;
    return Math.round((lastPhase.targetLbmKg - firstPhase.startLbmKg) * 10) / 10;
  }, [firstPhase, lastPhase]);

  const macrocyclePercent = useMemo(() => {
    if (phases.length === 0) return 0;
    const doneCount = phases.filter((p) => getPhaseStatus(p, activeRoadmap?.activePhaseId) === 'completed').length;
    return Math.round((doneCount / phases.length) * 100);
  }, [phases, activeRoadmap?.activePhaseId]);

  const bulkPhasesCount = useMemo(() => phases.filter((p) => p.phaseType === 'bulk').length, [phases]);
  const cutPhasesCount = useMemo(() => phases.filter((p) => p.phaseType === 'cut' || p.phaseType === 'minicut' || p.phaseType === 'final_cut').length, [phases]);
  const completedPhasesCount = useMemo(() => phases.filter((p) => getPhaseStatus(p, activeRoadmap?.activePhaseId) === 'completed').length, [phases, activeRoadmap?.activePhaseId]);

  // Filtered phases list
  const filteredPhases = useMemo(() => {
    return phases.filter((phase) => {
      const status = getPhaseStatus(phase, activeRoadmap?.activePhaseId);
      if (phaseFilter === 'current') return status === 'current';
      if (phaseFilter === 'completed') return status === 'completed';
      if (phaseFilter === 'upcoming') return status === 'upcoming';
      if (phaseFilter === 'bulk') return phase.phaseType === 'bulk';
      if (phaseFilter === 'cut') return phase.phaseType === 'cut' || phase.phaseType === 'minicut' || phase.phaseType === 'final_cut';
      return true;
    });
  }, [phases, phaseFilter, activeRoadmap?.activePhaseId]);

  const allSavedCtgRoadmaps = useMemo(() => {
    const list = [...savedCtgRoadmaps];
    if (activeRoadmap && !list.some((r) => r.id === activeRoadmap.id)) {
      list.unshift(activeRoadmap);
    }
    return list;
  }, [savedCtgRoadmaps, activeRoadmap]);

  // Actions
  const handleApplyAdjustment = (calorieDelta: number, reason: string) => {
    if (!activePhase || !activeRoadmap) return;
    const newKcal = Math.max(1200, activePhase.targetKcal + calorieDelta);
    const carbDelta = Math.round(calorieDelta / 4);
    const newCarbs = Math.max(50, activePhase.macros.carbs + carbDelta);
    const updatedPhase: CtgRoadmapPhase = {
      ...activePhase,
      targetKcal: newKcal,
      macros: {
        ...activePhase.macros,
        carbs: newCarbs,
      },
      note: `Đã tự động điều chỉnh ${calorieDelta > 0 ? '+' : ''}${calorieDelta} kcal: ${reason}`,
    };
    const updatedPhases = phases.map((p) => (p.id === activePhase.id ? updatedPhase : p));
    const updatedRoadmap: CtgPeriodizedRoadmap = {
      ...activeRoadmap,
      phases: updatedPhases,
    };
    onUpdateCtgPeriodizedRoadmap?.(updatedRoadmap);
    handleApplySinglePhase(updatedPhase);
    notifySuccess(
      'Đã áp dụng điều chỉnh tuần!',
      `Khẩu phần giai đoạn "${activePhase.name}" đã cập nhật thành ${newKcal.toLocaleString('vi-VN')} kcal/ngày.`
    );
  };

  const handleApplyCarbCyclingDay = (type: 'training' | 'rest') => {
    if (!activePhase) return;
    const isTraining = type === 'training';
    const kcal = isTraining ? activePhase.targetKcal + 180 : Math.max(1200, activePhase.targetKcal - 180);
    const carbs = isTraining ? activePhase.macros.carbs + 45 : Math.max(40, activePhase.macros.carbs - 45);
    const fat = isTraining ? Math.max(25, activePhase.macros.fat - 8) : activePhase.macros.fat + 8;
    const protein = activePhase.macros.protein;

    if (onUpdateNutritionSettings) {
      const goalKey: Goal = activePhase.phaseType === 'bulk' ? 'bulk' : activePhase.phaseType === 'maintain' ? 'maintain' : 'cut';
      onUpdateNutritionSettings({
        overrides: {
          ...(nutritionSettings?.overrides || {}),
          [goalKey]: {
            kcal,
            protein,
            carbs,
            fat,
          },
        },
      });
    }

    notifySuccess(
      isTraining ? 'Đã kích hoạt chế độ Ngày Tập (Refeed)!' : 'Đã kích hoạt chế độ Ngày Nghỉ (Rest)!',
      `Hôm nay: ${kcal.toLocaleString('vi-VN')} kcal · ${protein}g P · ${carbs}g C · ${fat}g F đã được nạp vào mục tiêu Dinh Dưỡng.`
    );
  };

  const handleApplySinglePhase = (phase: CtgRoadmapPhase) => {
    if (onSetActiveRoadmapPhase) {
      onSetActiveRoadmapPhase(phase.id);
    }
    onUpdateProfile({
      goal: phase.phaseType === 'bulk' ? 'bulk' : phase.phaseType === 'maintain' ? 'maintain' : 'cut',
      targetWeightKg: phase.targetWeightKg,
      targetBodyFatPct: phase.targetBodyFatPct,
    });
    if (onUpdateNutritionSettings) {
      const goalKey: Goal = phase.phaseType === 'bulk' ? 'bulk' : phase.phaseType === 'maintain' ? 'maintain' : 'cut';
      onUpdateNutritionSettings({
        overrides: {
          ...(nutritionSettings?.overrides || {}),
          [goalKey]: {
            kcal: phase.targetKcal,
            protein: phase.macros.protein,
            carbs: phase.macros.carbs,
            fat: phase.macros.fat,
          },
        },
      });
    }
    setAppliedBanner(
      `Đã kích hoạt giai đoạn "${phase.name}"! Mục tiêu: ${phase.targetKcal.toLocaleString('vi-VN')} kcal (Đạm: ${phase.macros.protein}g · Carb: ${phase.macros.carbs}g · Fat: ${phase.macros.fat}g) đã được đồng bộ vào hệ thống.`
    );
    setTimeout(() => setAppliedBanner(null), 6000);
    notifySuccess(
      'Đã áp dụng dinh dưỡng giai đoạn!',
      `Giai đoạn "${phase.name}" (${phase.targetKcal.toLocaleString('vi-VN')} kcal) đã đồng bộ vào phân hệ Dinh Dưỡng.`
    );
  };

  const handleSetCurrentPhase = (phaseId: string) => {
    if (!activeRoadmap) return;
    const updatedPhases = phases.map((p) => ({
      ...p,
      isCurrent: p.id === phaseId,
    }));
    const updatedRoadmap: CtgPeriodizedRoadmap = {
      ...activeRoadmap,
      phases: updatedPhases,
      activePhaseId: phaseId,
    };
    onUpdateCtgPeriodizedRoadmap?.(updatedRoadmap);
    onSetActiveRoadmapPhase?.(phaseId);
    const selected = updatedPhases.find((p) => p.id === phaseId);
    if (selected) {
      handleApplySinglePhase(selected);
    }
  };

  const handleSyncPhaseWithCurrentWeight = (phase: CtgRoadmapPhase) => {
    if (!activeRoadmap) return;
    const updatedPhase: CtgRoadmapPhase = {
      ...phase,
      startWeightKg: currentWeight,
      startBodyFatPct: currentBf,
      startLbmKg: currentLbm,
      startFfmi: currentFfmi,
    };
    const updatedPhases = phases.map((p) => (p.id === phase.id ? updatedPhase : p));
    const updatedRoadmap: CtgPeriodizedRoadmap = {
      ...activeRoadmap,
      phases: updatedPhases,
    };
    onUpdateCtgPeriodizedRoadmap?.(updatedRoadmap);
    notifySuccess(
      'Đã đồng bộ cân nặng hiện tại!',
      `Cân nặng xuất phát của giai đoạn "${phase.name}" đã cập nhật thành ${currentWeight} kg.`
    );
  };

  const handleDeletePhase = (phaseId: string) => {
    if (!activeRoadmap || phases.length <= 1) return;
    const updatedPhases = phases.filter((p) => p.id !== phaseId);
    let nextActiveId = activeRoadmap.activePhaseId;
    if (nextActiveId === phaseId) {
      nextActiveId = updatedPhases[0]?.id || '';
    }
    const updatedRoadmap: CtgPeriodizedRoadmap = {
      ...activeRoadmap,
      phases: updatedPhases,
      activePhaseId: nextActiveId,
    };
    onUpdateCtgPeriodizedRoadmap?.(updatedRoadmap);
    notifySuccess('Đã xóa giai đoạn!', 'Lộ trình chu kỳ đã được sắp xếp lại.');
  };

  const handleSaveEditPhase = () => {
    if (!editingPhase || !activeRoadmap) return;
    const updatedPhases = phases.map((p) => (p.id === editingPhase.id ? editingPhase : p));
    const updatedRoadmap: CtgPeriodizedRoadmap = {
      ...activeRoadmap,
      phases: updatedPhases,
    };
    onUpdateCtgPeriodizedRoadmap?.(updatedRoadmap);
    if (activeRoadmap.activePhaseId === editingPhase.id) {
      handleApplySinglePhase(editingPhase);
    }
    setEditingPhase(null);
    notifySuccess('Đã lưu thay đổi!', `Thông số giai đoạn "${editingPhase.name}" đã được cập nhật.`);
  };

  const handleAddPhaseToEnd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeRoadmap) return;
    const sW = Number(newStartWeight) || currentWeight;
    const tW = Number(newTargetWeight) || currentWeight + 3;
    const sBf = Number(newStartBf) || currentBf;
    const tBf = Number(newTargetBf) || currentBf;
    const hM = (Number(profile.heightCm) || 172) / 100;
    const sLbm = Math.round(sW * (1 - sBf / 100) * 10) / 10;
    const tLbm = Math.round(tW * (1 - tBf / 100) * 10) / 10;
    const sFfmi = Math.round(((sLbm / (hM * hM)) + 6.1 * (1.8 - hM)) * 10) / 10;
    const tFfmi = Math.round(((tLbm / (hM * hM)) + 6.1 * (1.8 - hM)) * 10) / 10;

    let sDate = new Date();
    if (lastPhase) {
      const parsedLastEnd = parseVnDate(lastPhase.endDate);
      if (Number.isFinite(parsedLastEnd.getTime())) {
        sDate = new Date(parsedLastEnd.getTime() + 24 * 60 * 60 * 1000);
      }
    }
    const eDate = new Date(sDate.getTime() + newDurationWeeks * 7 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    const createdPhase: CtgRoadmapPhase = {
      id: `ctg-p-${Date.now()}`,
      name: newPhaseName.trim() || 'Giai đoạn bổ sung',
      phaseType: newPhaseType,
      startDate: fmt(sDate),
      endDate: fmt(eDate),
      weeks: newDurationWeeks,
      startWeightKg: sW,
      targetWeightKg: tW,
      startBodyFatPct: sBf,
      targetBodyFatPct: tBf,
      startLbmKg: sLbm,
      targetLbmKg: tLbm,
      startFfmi: sFfmi,
      targetFfmi: tFfmi,
      targetKcal: Number(newCalories) || 2400,
      macros: {
        protein: Number(newProtein) || 160,
        carbs: Number(newCarbs) || 280,
        fat: Number(newFat) || 60,
      },
      note: newNote.trim() || undefined,
    };

    const updatedPhases = [...phases, createdPhase];
    const updatedRoadmap: CtgPeriodizedRoadmap = {
      ...activeRoadmap,
      phases: updatedPhases,
    };
    onUpdateCtgPeriodizedRoadmap?.(updatedRoadmap);
    setShowAddPhaseModal(false);
    notifySuccess('Đã thêm giai đoạn mới!', `"${createdPhase.name}" đã được đưa vào cuối chu kỳ.`);
  };

  const handleCopyRoadmapSummary = async () => {
    if (!activeRoadmap) return;
    const lines = [
      `🏋️ LỘ TRÌNH THỂ HÌNH CHU KỲ CTG: ${activeRoadmap.title}`,
      `• Thể trạng xuất phát: Chiều cao ${profile.heightCm || 172}cm · Cân nặng ${firstPhase?.startWeightKg || currentWeight}kg · Mỡ ${firstPhase?.startBodyFatPct || currentBf}% (LBM: ${currentLbm}kg, FFMI: ${currentFfmi})`,
      `• Mục tiêu đích đến: ${lastPhase?.targetWeightKg}kg · ${lastPhase?.targetBodyFatPct}% Mỡ · FFMI ${lastPhase?.targetFfmi} (+${totalLbmGain}kg Cơ nạc)`,
      `• Tổng số giai đoạn: ${phases.length} giai đoạn chu kỳ sóng`,
      '',
      '📅 CHI TIẾT TỪNG GIAI ĐOẠN:',
      ...phases.map((p, idx) => {
        return `#${idx + 1}. ${p.name} (${p.startDate} – ${p.endDate}): ${p.startWeightKg}kg → ${p.targetWeightKg}kg (% mỡ: ${p.startBodyFatPct}% → ${p.targetBodyFatPct}%) | Calo: ${p.targetKcal.toLocaleString('vi-VN')} kcal (Đạm: ${p.macros.protein}g / Carb: ${p.macros.carbs}g / Fat: ${p.macros.fat}g)${p.note ? ` | Ghi chú: ${p.note}` : ''}`;
      }),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      notifySuccess('Đã sao chép lộ trình!', 'Toàn bộ nội dung chu kỳ đã được lưu vào Clipboard.');
    } catch {
      notifySuccess('Lộ trình chu kỳ CTG', 'Đã tóm tắt lộ trình thành công.');
    }
  };

  const handleDeleteActiveRoadmap = () => {
    if (onDeleteCurrentCtgRoadmap) {
      onDeleteCurrentCtgRoadmap();
    } else if (onUpdateCtgPeriodizedRoadmap) {
      onUpdateCtgPeriodizedRoadmap(null);
    }
    setShowDeleteConfirmModal(false);
    notifySuccess('Đã xóa lộ trình!', 'Bạn có thể tạo lộ trình chu kỳ mới bất kỳ lúc nào.');
  };

  const handleLoadSeedRoadmap = () => {
    onUpdateCtgPeriodizedRoadmap?.(SEED_CTG_PERIODIZED_ROADMAP);
    onSaveCtgRoadmap?.(SEED_CTG_PERIODIZED_ROADMAP);
    if (SEED_CTG_PERIODIZED_ROADMAP.phases[0]) {
      handleApplySinglePhase(SEED_CTG_PERIODIZED_ROADMAP.phases[0]);
    }
    notifySuccess('Đã tải lộ trình mẫu!', 'Lộ trình mẫu chuẩn CTG (68kg → 74kg) đã sẵn sàng.');
  };

  // COMMON SPORTS LIST FOR WIZARD
  const COMMON_SPORTS = [
    { id: 'running', name: 'Chạy bộ ngoài trời', met: 8.0 },
    { id: 'swimming', name: 'Bơi lội tự do', met: 6.0 },
    { id: 'football', name: 'Bóng đá sân cỏ', met: 7.0 },
    { id: 'badminton', name: 'Cầu lông đối kháng', met: 5.5 },
    { id: 'cycling', name: 'Đạp xe thể thao', met: 6.5 },
    { id: 'walking', name: 'Đi bộ nhanh dốc', met: 3.8 },
  ];

  // Wizard derived preview computations
  const wizComputed = useMemo(() => {
    const curW = Math.max(30, Math.min(250, Number(wizWeight) || currentWeight || 68));
    const curH = Math.max(120, Math.min(220, Number(wizHeight) || profile.heightCm || 172));
    const curBf = Math.max(4, Math.min(55, Number(wizBodyFat) || currentBf || 18));
    const hMeter = curH / 100;
    const hSq = hMeter * hMeter;
    const isFemale = wizSex === 'female';

    const curLbm = Math.max(15, Math.round(curW * (1 - curBf / 100) * 10) / 10);
    const curFfmi = Math.round(((curLbm / hSq) + 6.1 * (1.8 - hMeter)) * 10) / 10;

    const clampedTargetBf = Math.max(isFemale ? 12 : 6, Math.min(35, Number(wizTargetBfPct) || (isFemale ? 20.0 : 12.0)));
    const clampedTargetFfmi = Math.max(15, Math.min(isFemale ? 21.2 : 25.0, Number(wizTargetFfmi) || (isFemale ? 19.5 : 22.0)));
    const targetLbm = Math.round(Math.max(20, (clampedTargetFfmi - 6.1 * (1.8 - hMeter)) * hSq) * 10) / 10;
    const targetW = Math.round((targetLbm / (1 - clampedTargetBf / 100)) * 10) / 10;

    const bmrKatch = Math.round(370 + 21.6 * curLbm);
    const neatCal = Math.round(wizSteps * 0.04);
    const eatCal = Math.round((wizTrainDays / 7) * wizTrainDuration * (0.075 * curW));
    const sportsCal = Math.round(wizSports.reduce((acc, s) => acc + (s.sessionsPerWeek / 7) * s.minutes * (s.met * 3.5 * curW / 200), 0));
    const tefCal = Math.round((bmrKatch + neatCal + eatCal + sportsCal) * 0.1);
    const tdeeCal = bmrKatch + neatCal + eatCal + sportsCal + tefCal;

    const nowD = new Date();
    const todayStr = `${String(nowD.getDate()).padStart(2, '0')}/${String(nowD.getMonth() + 1).padStart(2, '0')}/${nowD.getFullYear()}`;

    const simulatedRoadmap = generateCtgPeriodizedRoadmap({
      sex: wizSex,
      heightCm: curH,
      currentWeightKg: curW,
      currentBodyFatPct: curBf,
      targetFfmi: clampedTargetFfmi,
      targetWeightKg: targetW,
      targetBodyFatPct: clampedTargetBf,
      steps: wizSteps,
      trainDays: wizTrainDays,
      trainDurationMin: wizTrainDuration,
      startDate: todayStr,
    });

    const totalWeeks = simulatedRoadmap.totalWeeks || simulatedRoadmap.phases.reduce((s, p) => s + (p.weeks || 4), 0);

    return {
      curW,
      curH,
      curBf,
      curLbm,
      curFfmi,
      clampedTargetBf,
      clampedTargetFfmi,
      targetLbm,
      targetW,
      tdeeCal,
      simulatedRoadmap,
      totalWeeks,
    };
  }, [wizSex, wizHeight, wizWeight, wizBodyFat, wizTargetBfPct, wizTargetFfmi, wizSteps, wizTrainDays, wizTrainDuration, wizSports, currentWeight, currentBf, profile.heightCm]);

  const handleCommitWizardRoadmap = () => {
    const { simulatedRoadmap, curW, targetW, clampedTargetFfmi } = wizComputed;
    const newRoadmap: CtgPeriodizedRoadmap = {
      ...simulatedRoadmap,
      id: `ctg-rm-${Date.now()}`,
      title: `Lộ Trình Chu Kỳ: ${curW}kg → ${targetW}kg (FFMI ${clampedTargetFfmi})`,
      createdAt: Date.now(),
      activePhaseId: simulatedRoadmap.phases[0]?.id || 'none',
    };

    onSaveCtgRoadmap?.(newRoadmap);
    onUpdateCtgPeriodizedRoadmap?.(newRoadmap);
    if (onSetActiveRoadmapPhase && newRoadmap.phases[0]) {
      onSetActiveRoadmapPhase(newRoadmap.phases[0].id);
    }

    if (newRoadmap.phases[0]) {
      handleApplySinglePhase(newRoadmap.phases[0]);
    }

    setShowWizardModal(false);
    notifySuccess(
      'Kích hoạt lộ trình chu kỳ thành công!',
      `Đã thiết lập ${newRoadmap.phases.length} giai đoạn chu kỳ sóng tối ưu theo khoa học CTG.`
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Applied Banner Toast Alert */}
      {appliedBanner && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-4 text-xs text-emerald-200 flex items-start gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold text-sm text-white">Đồng bộ thành công!</div>
            <div className="mt-0.5 text-emerald-200/90 leading-relaxed">{appliedBanner}</div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('nutrition')}
                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
              >
                <span>Xem mục tiêu Dinh Dưỡng ngay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* CASE 1: CHƯA CÓ LỘ TRÌNH (CLEAN ONBOARDING EMPTY STATE) */}
      {(!activeRoadmap || phases.length === 0) && (
        <div className="bg-[#070205] rounded-3xl border border-white/10 p-8 sm:p-12 text-center shadow-2xl space-y-6 animate-fadeIn">
          <div className="w-16 h-16 rounded-3xl bg-rose-600/15 border border-rose-500/30 text-rose-500 mx-auto flex items-center justify-center shadow-[0_0_25px_rgba(244,63,94,0.25)]">
            <Layers className="w-8 h-8" />
          </div>
          <div className="max-w-lg mx-auto space-y-2">
            <h3 className="text-2xl font-black text-white tracking-tight">
              Lộ Trình Thể Hình Chu Kỳ CTG
            </h3>
            <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
              Hệ thống chu kỳ sóng Hypertrophy Waves, Mini-cut và Diet break khoa học chuẩn CTG Fitness giúp tối ưu xây dựng cơ nạc, kiểm soát mỡ thừa và bảo vệ trao đổi chất.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowWizardModal(true)}
              className="px-6 py-3.5 rounded-2xl bg-linear-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-sm font-black transition-all cursor-pointer shadow-[0_4px_20px_rgba(244,63,94,0.4)] flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-white" />
              <span>⚡ Lập Lộ Trình Chu Kỳ CTG Ngay (4 Bước)</span>
            </button>

            <button
              type="button"
              onClick={handleLoadSeedRoadmap}
              className="px-5 py-3.5 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-2"
            >
              <History className="w-4 h-4 text-rose-400" />
              <span>Tải Lộ Trình Mẫu (Nam 68kg → 74kg)</span>
            </button>

            {allSavedCtgRoadmaps.length > 0 && (
              <button
                type="button"
                onClick={() => setShowRoadmapManagerModal(true)}
                className="px-5 py-3.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-2"
              >
                <FolderOpen className="w-4 h-4 text-rose-400" />
                <span>Thư Viện Bản Mẫu ({allSavedCtgRoadmaps.length})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* CASE 2: ĐÃ CÓ LỘ TRÌNH KÍCH HOẠT (UNIFIED CTG ROADMAP EXPERIENCE) */}
      {activeRoadmap && phases.length > 0 && (
        <div className="space-y-6 animate-fadeIn">
          {/* Mesocycle Periodization Studio (RP 5-Week Volume & RIR Progression) */}
          <MesocycleProgressionStudio activePhase={activePhase} />

          {/* 1. HERO & TỔNG QUAN HÀNH TRÌNH CHUYỂN HÓA (MACROCYCLE OVERVIEW) */}
          <div className="bg-[#070205] rounded-3xl border border-white/10 p-5 sm:p-6 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-display font-black text-xl sm:text-2xl tracking-tight text-white">
                    {activeRoadmap.title || 'Lộ Trình Chu Kỳ CTG'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.25)]">
                    {phases.length} Giai Đoạn · {firstPhase?.startDate} – {lastPhase?.endDate}
                  </span>
                  {activeRoadmap.heightCm && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-white/70">
                      {activeRoadmap.heightCm}cm · {firstPhase?.startWeightKg || activeRoadmap.initialWeightKg}kg xuất phát
                    </span>
                  )}
                </div>

                {/* Thanh hành trình chuyển hóa trực quan */}
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-white/70">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 font-mono">
                    <span className="text-white/40 text-[10px] uppercase font-sans">Xuất phát:</span>
                    <span className="text-white font-bold">{firstPhase?.startWeightKg}kg</span>
                    <span className="text-white/50">({firstPhase?.startBodyFatPct}%)</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 font-mono text-rose-200">
                    <span className="text-rose-400 text-[10px] uppercase font-sans font-bold">Đích đến:</span>
                    <span className="text-white font-bold">{lastPhase?.targetWeightKg}kg</span>
                    <span className="text-rose-300/80">({lastPhase?.targetBodyFatPct}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 font-mono text-emerald-300 font-bold">
                    <span>+{totalLbmGain >= 0 ? totalLbmGain : 0}kg Cơ nạc</span>
                    <span className="text-emerald-400/60 font-normal">· Đích FFMI {lastPhase?.targetFfmi}</span>
                  </div>
                </div>
              </div>

              {/* Thanh công cụ thao tác */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowWizardModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-linear-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                  title="Mở Wizard thiết lập lại lộ trình chu kỳ"
                >
                  <Wand2 className="w-3.5 h-3.5 text-white" />
                  <span>⚡ Lập Lộ Trình Mới</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowRoadmapManagerModal(true)}
                  className="px-3.5 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Xem danh sách tất cả các lộ trình đã tạo trong thư viện"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-rose-400" />
                  <span>Thư Viện ({allSavedCtgRoadmaps.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyRoadmapSummary}
                  className="p-2 rounded-xl border border-white/10 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                  title="Sao chép toàn bộ tóm tắt lộ trình vào Clipboard"
                >
                  <Copy className="w-4 h-4 text-white/70" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowDeleteConfirmModal(true)}
                  className="p-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                  title="Xóa lộ trình hiện tại"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 1.5. BIỂU ĐỒ ĐƯỜNG CONG CHU KỲ CHUYỂN HÓA CTG (TRAJECTORY CHART) */}
          <CtgTrajectoryChart
            phases={phases}
            currentWeight={currentWeight}
            currentBf={currentBf}
            currentLbm={currentLbm}
            activePhaseId={activePhase?.id}
            onSelectPhase={(phaseId) => {
              const el = document.getElementById(`phase-card-${phaseId}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
            lang={lang}
          />

          {/* 2. GIAI ĐOẠN ĐANG THEO DÕI TRỰC TIẾP (LIVE TRACKING CARD) */}
          {activePhase && (
            <div className="bg-[#0b0307] rounded-3xl border border-rose-500/30 p-5 sm:p-6 shadow-2xl relative overflow-hidden space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                    <PlayCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Giai Đoạn Đang Theo Dõi
                      </span>
                      <span className="text-xs text-white/50 font-mono">
                        {activePhase.startDate} – {activePhase.endDate}
                      </span>
                      <span className="text-[11px] text-amber-400 font-semibold font-mono">
                        (Còn ~{daysRemaining} ngày)
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-white mt-0.5 tracking-tight flex items-center gap-2">
                      <span>{activePhase.name}</span>
                      <span className="text-xs font-normal text-white/50">
                        ({activePhase.phaseType === 'bulk' ? 'Tăng cơ sóng' : activePhase.phaseType === 'minicut' ? 'Mini-cut' : activePhase.phaseType === 'cut' ? 'Giảm mỡ' : activePhase.phaseType === 'maintain' ? 'Diet break' : 'Hoàn thiện'})
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleSyncPhaseWithCurrentWeight(activePhase)}
                    className="px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Cập nhật mốc bắt đầu của giai đoạn này theo số cân InBody mới nhất"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
                    <span>Đồng bộ InBody ({currentWeight}kg)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsLiveTrackingCollapsed((v) => !v)}
                    className="p-1.5 rounded-xl border border-white/10 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                    title={isLiveTrackingCollapsed ? 'Mở rộng' : 'Thu gọn'}
                  >
                    {isLiveTrackingCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {!isLiveTrackingCollapsed && (
                <>
                  {/* 3 Cột chỉ số trực quan */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {/* Cột 1: Cân Nặng Thực Tế & Tiến Độ */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/40 uppercase font-bold text-[10px]">Cân Nặng Thực Tế</span>
                        <span className="font-bold font-mono text-rose-400">
                          {weightProgress}% mục tiêu
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black text-white font-mono">{currentWeight}</span>
                        <span className="text-xs text-white/40">/ {activePhase.targetWeightKg} kg</span>
                        <span
                          className={`text-xs font-bold font-mono ml-auto ${
                            isBulkPhase
                              ? currentWeight >= targetW
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                              : currentWeight <= targetW
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                          }`}
                        >
                          {isBulkPhase
                            ? currentWeight >= targetW
                              ? '✓ Đạt đích'
                              : `Cần +${Math.round((targetW - currentWeight) * 10) / 10} kg`
                            : currentWeight <= targetW
                              ? '✓ Đạt đích'
                              : `Cần -${Math.round((currentWeight - targetW) * 10) / 10} kg`}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-linear-to-r from-rose-500 to-red-500 rounded-full transition-all duration-500"
                          style={{ width: `${weightProgress}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-white/40 flex justify-between font-mono">
                        <span>Bắt đầu: {activePhase.startWeightKg}kg</span>
                        <span>Đích phase: {activePhase.targetWeightKg}kg</span>
                      </div>
                    </div>

                    {/* Cột 2: Mỡ & Khối Nạc */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/40 uppercase font-bold text-[10px]">Mỡ &amp; Khối Nạc (LBM)</span>
                        <span className="font-mono text-xs text-orange-400 font-bold">{currentBf}% mỡ</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-indigo-300 font-mono">{currentLbm}</span>
                        <span className="text-xs text-white/40">kg LBM</span>
                        <span className="text-xs font-mono font-bold text-emerald-400 ml-auto">FFMI {currentFfmi}</span>
                      </div>
                      <div className="text-[11px] text-white/60 pt-1.5 border-t border-white/5 flex justify-between font-mono">
                        <span>Đích mỡ: <strong className="text-orange-300">{activePhase.targetBodyFatPct}%</strong></span>
                        <span>Đích nạc: <strong className="text-indigo-300">{activePhase.targetLbmKg}kg</strong></span>
                        <span>FFMI: <strong className="text-emerald-300">{activePhase.targetFfmi}</strong></span>
                      </div>
                    </div>

                    {/* Cột 3: Dinh Dưỡng Giai Đoạn */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/40 uppercase font-bold text-[10px]">Dinh Dưỡng Chuẩn CTG</span>
                        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/10 text-[9px] font-mono">
                          <button
                            type="button"
                            onClick={() => setCarbCyclingMode('standard')}
                            className={`px-1.5 py-0.5 rounded cursor-pointer ${
                              carbCyclingMode === 'standard' ? 'bg-rose-600 text-white font-bold' : 'text-white/40 hover:text-white'
                            }`}
                          >
                            Cố định
                          </button>
                          <button
                            type="button"
                            onClick={() => setCarbCyclingMode('carb_cycling')}
                            className={`px-1.5 py-0.5 rounded cursor-pointer ${
                              carbCyclingMode === 'carb_cycling' ? 'bg-amber-600 text-white font-bold' : 'text-white/40 hover:text-white'
                            }`}
                          >
                            Carb Cycling
                          </button>
                        </div>
                      </div>

                      {carbCyclingMode === 'standard' ? (
                        <>
                          <div className="text-right font-mono text-base font-black text-white">
                            {activePhase.targetKcal.toLocaleString('vi-VN')} kcal/ngày
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 text-center text-xs pt-1">
                            <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/20 text-rose-300 font-mono font-bold">
                              <div className="text-[9px] uppercase font-sans text-rose-300/80 font-normal">Đạm</div>
                              {activePhase.macros.protein}g
                            </div>
                            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/20 text-amber-300 font-mono font-bold">
                              <div className="text-[9px] uppercase font-sans text-amber-300/80 font-normal">Carb</div>
                              {activePhase.macros.carbs}g
                            </div>
                            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 font-mono font-bold">
                              <div className="text-[9px] uppercase font-sans text-emerald-300/80 font-normal">Béo</div>
                              {activePhase.macros.fat}g
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2 pt-1 font-mono text-[11px]">
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                            <div>
                              <div className="text-[9px] font-sans font-bold text-amber-400 uppercase">Ngày Tập (Refeed)</div>
                              <span className="font-bold text-white">{(activePhase.targetKcal + 180).toLocaleString('vi-VN')} kcal</span>
                              <span className="text-[10px] text-white/50 ml-1.5">({activePhase.macros.protein}P · {activePhase.macros.carbs + 45}C · {Math.max(25, activePhase.macros.fat - 8)}F)</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleApplyCarbCyclingDay('training')}
                              className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Áp dụng
                            </button>
                          </div>

                          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                            <div>
                              <div className="text-[9px] font-sans font-bold text-blue-400 uppercase">Ngày Nghỉ (Rest)</div>
                              <span className="font-bold text-white">{Math.max(1200, activePhase.targetKcal - 180).toLocaleString('vi-VN')} kcal</span>
                              <span className="text-[10px] text-white/50 ml-1.5">({activePhase.macros.protein}P · {Math.max(40, activePhase.macros.carbs - 45)}C · {activePhase.macros.fat + 8}F)</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleApplyCarbCyclingDay('rest')}
                              className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Áp dụng
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Thanh 2 Nút Hành Động 1-Chạm Đồng Bộ */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleApplySinglePhase(activePhase)}
                        className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-md shadow-rose-600/30 transition-all flex items-center gap-2"
                      >
                        <Utensils className="w-3.5 h-3.5" />
                        <span>🍏 Áp Dụng Dinh Dưỡng Giai Đoạn Này Vào Mục Tiêu Ngày</span>
                      </button>

                      {onNavigateTab && (
                        <button
                          type="button"
                          onClick={() => onNavigateTab('training')}
                          className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs cursor-pointer transition-colors flex items-center gap-2"
                        >
                          <Dumbbell className="w-3.5 h-3.5 text-rose-400" />
                          <span>Chuyển Sang Giáo Án Tập Luyện</span>
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => setIsCalendarSyncModalOpen(true)}
                        className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600/30 via-indigo-600/20 to-blue-700/30 hover:from-blue-600/40 hover:to-indigo-600/40 border border-blue-500/40 text-blue-200 hover:text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-md group"
                      >
                        <Calendar className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
                        <span>⚡ Lên Lịch Tập Google Calendar (Giờ Rảnh)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsCheckinExportModalOpen(true)}
                        className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600/30 via-pink-600/20 to-rose-700/30 hover:from-rose-600/40 hover:to-pink-600/40 border border-rose-500/40 text-rose-200 hover:text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-md group"
                      >
                        <Share2 className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
                        <span>📷 Xuất Thẻ Check-in Tuần (3:4 HD)</span>
                      </button>
                    </div>

                    {activePhase.note && (
                      <div className="text-xs text-white/50 italic flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{activePhase.note}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 2.5. CỐ VẤN ĐIỀU CHỈNH TUẦN TỰ ĐỘNG (CTG AUTO-ADJUSTMENT) */}
          {activePhase && (
            <CtgWeeklyAdvisor
              activePhase={activePhase}
              bodyPoints={bodyPoints}
              currentWeight={currentWeight}
              currentBf={currentBf}
              onApplyAdjustment={handleApplyAdjustment}
              onOpenCheckinExport={() => setIsCheckinExportModalOpen(true)}
              lang={lang}
            />
          )}

          {/* 3. TIẾN ĐỘ TOÀN CHU KỲ & INTERACTIVE STEPPER */}
          <div className="bg-[#070205] rounded-3xl border border-white/10 p-5 space-y-3.5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 font-mono">
                  Tiến độ toàn chu kỳ:
                </span>
                <span className="font-bold text-white">
                  {completedPhasesCount} / {phases.length} giai đoạn hoàn thành ({macrocyclePercent}%)
                </span>
              </div>
              <div className="text-[11px] font-mono text-white/50 flex items-center gap-2">
                <span className="text-rose-300 font-bold">{bulkPhasesCount} đợt Tăng cơ sóng</span>
                <span>·</span>
                <span className="text-amber-300 font-bold">{cutPhasesCount} đợt Mini-cut / Giảm mỡ</span>
              </div>
            </div>

            {/* Progress Bar Line */}
            <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5 p-0.5">
              <div
                className="h-full bg-linear-to-r from-emerald-500 via-rose-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${macrocyclePercent}%` }}
              />
            </div>

            {/* Interactive Phase Stepper Pills (Scrollable) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none">
              {phases.map((p, idx) => {
                const status = getPhaseStatus(p, activeRoadmap?.activePhaseId);
                const isCur = status === 'current';
                const isDone = status === 'completed';
                const shortName = p.name.includes('Tăng cơ')
                  ? 'Tăng cơ'
                  : p.name.includes('Mini-cut')
                  ? 'Mini-cut'
                  : p.name.includes('Giảm mỡ')
                  ? 'Giảm mỡ'
                  : p.name;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`phase-card-${p.id}`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                    title={`#${idx + 1}: ${p.name} (${p.startDate} – ${p.endDate}) · ${p.startWeightKg}kg → ${p.targetWeightKg}kg · ${p.targetKcal} kcal`}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-semibold shrink-0 transition-all cursor-pointer border flex items-center gap-1.5 ${
                      isCur
                        ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-500/30 ring-2 ring-rose-400 font-bold scale-105'
                        : isDone
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                        : 'bg-black/30 text-white/50 border-white/5 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <span>#{idx + 1}</span>
                    <span className="hidden sm:inline font-sans text-[10px]">{shortName}</span>
                    {isDone && <span className="text-emerald-400">✓</span>}
                    {isCur && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. DANH SÁCH CHI TIẾT CÁC GIAI ĐOẠN (DETAILED PHASES LIST) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
              <div>
                <h4 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <span>Chi Tiết Chu Kỳ ({phases.length} Giai Đoạn)</span>
                </h4>
                <p className="text-xs text-white/50">
                  Phân chia dinh dưỡng, mục tiêu thể trạng và thời gian từng giai đoạn
                </p>
              </div>

              {/* Bộ lọc giai đoạn */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setPhaseFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    phaseFilter === 'all' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white'
                  }`}
                >
                  Tất cả ({phases.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPhaseFilter('current')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    phaseFilter === 'current' ? 'bg-rose-500/20 text-rose-300' : 'text-white/40 hover:text-white'
                  }`}
                >
                  Đang tập
                </button>
                <button
                  type="button"
                  onClick={() => setPhaseFilter('bulk')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    phaseFilter === 'bulk' ? 'bg-rose-500/20 text-rose-300' : 'text-white/40 hover:text-white'
                  }`}
                >
                  Tăng cơ ({bulkPhasesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPhaseFilter('cut')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    phaseFilter === 'cut' ? 'bg-amber-500/20 text-amber-300' : 'text-white/40 hover:text-white'
                  }`}
                >
                  Mini-cut / Siết ({cutPhasesCount})
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {filteredPhases.map((phase) => {
                const status = getPhaseStatus(phase, activeRoadmap?.activePhaseId);
                const isCurrent = status === 'current';
                const isCompleted = status === 'completed';
                const realIndex = phases.findIndex((p) => p.id === phase.id) + 1;
                const formattedIdx = String(realIndex).padStart(2, '0');

                return (
                  <div
                    key={phase.id}
                    id={`phase-card-${phase.id}`}
                    className={`rounded-3xl border transition-all p-5 sm:p-6 space-y-4 ${
                      isCurrent
                        ? 'bg-linear-to-b from-[#19060d] to-[#0c0306] border-rose-500/60 shadow-2xl shadow-rose-950/40 ring-1 ring-rose-500/40'
                        : isCompleted
                        ? 'bg-[#070205]/80 border-white/5 opacity-85 hover:opacity-100'
                        : 'bg-[#070205] border-white/10 hover:border-white/20'
                    }`}
                  >
                    {/* Header: Phase Name, Date, Current Phase Badge & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-xs font-mono font-bold text-white/40">
                            #{formattedIdx}
                          </span>
                          <h4 className="text-lg font-black text-white tracking-tight">
                            {phase.name}
                          </h4>
                          {isCurrent ? (
                            <span className="px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500 text-white shadow-xs">
                              Giai đoạn đang theo dõi
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetCurrentPhase(phase.id)}
                              className="px-3 py-0.5 rounded-full text-[11px] font-semibold text-white/60 hover:text-rose-300 bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 transition-all cursor-pointer"
                            >
                              Đặt làm giai đoạn hiện tại
                            </button>
                          )}
                          {isCompleted && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              ✓ Đã xong
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-white/50 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-white/40" />
                          <span>{phase.startDate} – {phase.endDate}</span>
                          {phase.weeks && <span>({phase.weeks} tuần)</span>}
                        </div>
                      </div>

                      {/* Right Actions */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleApplySinglePhase(phase)}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 text-xs font-bold text-rose-300 transition-colors cursor-pointer flex items-center gap-1.5"
                          title="Áp dụng dinh dưỡng giai đoạn này vào mục tiêu nạp ngày"
                        >
                          <Utensils className="w-3.5 h-3.5" />
                          <span>Áp Dụng Dinh Dưỡng</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingPhase({ ...phase })}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                          title="Sửa thông số giai đoạn này"
                        >
                          <Edit3 className="w-4 h-4 text-amber-400" />
                        </button>

                        {phases.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeletePhase(phase.id)}
                            className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Xóa giai đoạn này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 4 Chỉ số thể trạng: Cân nặng, Mỡ, Nạc, FFMI */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                        <div className="text-[11px] text-white/40 font-medium">Cân nặng</div>
                        <div className="text-base sm:text-lg font-bold font-mono text-white">
                          {phase.startWeightKg} → {phase.targetWeightKg} kg
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                        <div className="text-[11px] text-orange-400/80 font-medium">Mỡ cơ thể</div>
                        <div className="text-base sm:text-lg font-bold font-mono text-orange-300">
                          {phase.startBodyFatPct}% → {phase.targetBodyFatPct}%
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                        <div className="text-[11px] text-indigo-400/80 font-medium">Khối nạc LBM</div>
                        <div className="text-base sm:text-lg font-bold font-mono text-indigo-300">
                          {phase.startLbmKg} → {phase.targetLbmKg} kg
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                        <div className="text-[11px] text-emerald-400/80 font-medium">FFMI</div>
                        <div className="text-base sm:text-lg font-bold font-mono text-emerald-300">
                          {phase.startFfmi} → {phase.targetFfmi}
                        </div>
                      </div>
                    </div>

                    {/* Dinh dưỡng đã lưu cho giai đoạn */}
                    <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="text-[10px] uppercase font-bold text-white/40 tracking-wider">
                          Dinh dưỡng đã lưu cho giai đoạn
                        </div>
                        <div className="text-xl font-extrabold font-mono text-white">
                          {phase.targetKcal.toLocaleString('vi-VN')} kcal/ngày
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
                        <div className="px-3.5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-300 font-bold">
                          <span className="font-sans text-[10px] text-rose-300/70 mr-1.5 uppercase font-normal">Đạm</span>
                          <span className="text-sm">{phase.macros.protein} g</span>
                        </div>
                        <div className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-300 font-bold">
                          <span className="font-sans text-[10px] text-amber-300/70 mr-1.5 uppercase font-normal">Carb</span>
                          <span className="text-sm">{phase.macros.carbs} g</span>
                        </div>
                        <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 font-bold">
                          <span className="font-sans text-[10px] text-emerald-300/70 mr-1.5 uppercase font-normal">Chất béo</span>
                          <span className="text-sm">{phase.macros.fat} g</span>
                        </div>
                      </div>
                    </div>

                    {phase.note && (
                      <div className="text-[11px] text-white/50 italic flex items-center gap-1.5 pt-0.5">
                        <span>💡</span>
                        <span>{phase.note}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Nút thêm giai đoạn mới */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setNewStartWeight(String(lastPhase?.targetWeightKg || currentWeight));
                  setNewTargetWeight(String(Math.round(((lastPhase?.targetWeightKg || currentWeight) + (isBulkPhase ? 3 : -2)) * 10) / 10));
                  setNewStartBf(String(lastPhase?.targetBodyFatPct || currentBf));
                  setNewTargetBf(String(Math.round(((lastPhase?.targetBodyFatPct || currentBf) + (isBulkPhase ? 1.5 : -2)) * 10) / 10));
                  setShowAddPhaseModal(true);
                }}
                className="px-5 py-3 rounded-2xl border border-dashed border-white/20 hover:border-rose-500/50 bg-white/5 hover:bg-rose-500/10 text-white/80 hover:text-rose-300 text-xs sm:text-sm font-bold transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                <span>+ Thêm 1 Giai Đoạn Vào Cuối Chu Kỳ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: BỘ TẠO LỘ TRÌNH CHU KỲ CTG (WIZARD 4 BƯỚC) */}
      {showWizardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-[#0b0307] border border-rose-500/30 w-full max-w-2xl rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 animate-scaleUp max-h-[90vh] overflow-y-auto">
            {/* Header Wizard */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  CTG Periodization Engine
                </span>
                <h3 className="text-xl font-black text-white mt-1 tracking-tight">
                  Lập Lộ Trình Chu Kỳ Thể Hình CTG
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWizardModal(false)}
                className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Tabs */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
              {[
                { idx: 0, label: '1. Thể trạng' },
                { idx: 1, label: '2. Mục tiêu' },
                { idx: 2, label: '3. Vận động' },
                { idx: 3, label: '4. Mô phỏng' },
              ].map((s) => (
                <div
                  key={s.idx}
                  onClick={() => setWizardStep(s.idx)}
                  className={`py-2 rounded-xl border cursor-pointer transition-all ${
                    wizardStep === s.idx
                      ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/30'
                      : wizardStep > s.idx
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-white/5 text-white/40 border-white/5'
                  }`}
                >
                  {s.label}
                </div>
              ))}
            </div>

            {/* BƯỚC 0: THỂ TRẠNG XUẤT PHÁT */}
            {wizardStep === 0 && (
              <div className="space-y-4 animate-fadeIn text-xs">
                <div className="space-y-2">
                  <label className="text-white/60 font-semibold block">Giới tính sinh học</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setWizSex('male')}
                      className={`py-3 rounded-2xl border font-bold text-center cursor-pointer transition-all ${
                        wizSex === 'male'
                          ? 'bg-rose-600 text-white border-rose-400 shadow-md'
                          : 'bg-white/5 text-white/60 border-white/10 hover:border-white/20'
                      }`}
                    >
                      Nam (Male)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWizSex('female')}
                      className={`py-3 rounded-2xl border font-bold text-center cursor-pointer transition-all ${
                        wizSex === 'female'
                          ? 'bg-rose-600 text-white border-rose-400 shadow-md'
                          : 'bg-white/5 text-white/60 border-white/10 hover:border-white/20'
                      }`}
                    >
                      Nữ (Female)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-white/60 font-semibold">Chiều cao (cm)</label>
                    <input
                      type="number"
                      value={wizHeight}
                      onChange={(e) => setWizHeight(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono font-bold focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-white/60 font-semibold">Cân nặng hiện tại (kg)</label>
                    <input
                      type="number"
                      value={wizWeight}
                      onChange={(e) => setWizWeight(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono font-bold focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-white/60 font-semibold">% Mỡ cơ thể hiện tại</label>
                    <input
                      type="number"
                      value={wizBodyFat}
                      onChange={(e) => setWizBodyFat(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono font-bold focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* Instant Computation preview */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between font-mono">
                  <div>
                    <span className="text-[10px] uppercase text-white/40 block font-sans">Khối nạc LBM</span>
                    <span className="text-lg font-bold text-indigo-300">{wizComputed.curLbm} kg</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-white/40 block font-sans">Chỉ số FFMI</span>
                    <span className="text-lg font-bold text-emerald-400">{wizComputed.curFfmi}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-white/40 block font-sans">Đánh giá cơ nạc</span>
                    <span className="text-xs font-bold text-white font-sans">
                      {wizComputed.curFfmi < 19 ? 'Ít cơ' : wizComputed.curFfmi < 23 ? 'Lý tưởng' : 'Cận giới hạn'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer transition-colors flex items-center gap-2"
                  >
                    <span>Tiếp tục: Đặt mục tiêu</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* BƯỚC 1: MỤC TIÊU THỂ HÌNH */}
            {wizardStep === 1 && (
              <div className="space-y-4 animate-fadeIn text-xs">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-white/80 font-bold">% Mỡ Mục Tiêu (Target Body Fat)</label>
                    <span className="text-base font-extrabold font-mono text-orange-400">{wizTargetBfPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={wizSex === 'female' ? 14 : 8}
                    max={wizSex === 'female' ? 30 : 25}
                    step={0.5}
                    value={wizTargetBfPct}
                    onChange={(e) => setWizTargetBfPct(Number(e.target.value))}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-white/40 font-mono">
                    <span>{wizSex === 'female' ? '14% (Khô lean)' : '8% (Khô lean)'}</span>
                    <span>{wizSex === 'female' ? '20% (Lý tưởng nữ)' : '12% (Lý tưởng nam)'}</span>
                    <span>{wizSex === 'female' ? '30% (Đậm người)' : '25% (Đậm người)'}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-white/80 font-bold">Chỉ Số Cơ Nạc FFMI Mục Tiêu</label>
                    <span className="text-base font-extrabold font-mono text-emerald-400">FFMI {wizTargetFfmi}</span>
                  </div>
                  <input
                    type="range"
                    min={17}
                    max={wizSex === 'female' ? 21.2 : 24.5}
                    step={0.1}
                    value={wizTargetFfmi}
                    onChange={(e) => setWizTargetFfmi(Number(e.target.value))}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-white/40 font-mono">
                    <span>17.0 (Người mới)</span>
                    <span>20.0 (Tập lâu năm)</span>
                    <span>{wizSex === 'female' ? '21.2 (Đỉnh nữ)' : '24.5 (Đỉnh nam)'}</span>
                  </div>
                </div>

                {/* Target calculation results */}
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5">
                    <span className="text-[10px] uppercase text-white/40 block font-sans">Cân Nặng Đích Đến</span>
                    <span className="text-xl font-extrabold text-white">{wizComputed.targetW} kg</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/25">
                    <span className="text-[10px] uppercase text-emerald-400 block font-sans">Khối Nạc Đích Đến</span>
                    <span className="text-xl font-extrabold text-emerald-300">{wizComputed.targetLbm} kg LBM</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setWizardStep(0)}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white cursor-pointer"
                  >
                    Quay lại
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer transition-colors flex items-center gap-2"
                  >
                    <span>Tiếp tục: Mức vận động</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* BƯỚC 2: MỨC VẬN ĐỘNG & TDEE */}
            {wizardStep === 2 && (
              <div className="space-y-4 animate-fadeIn text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-white/60 font-semibold">Số bước chân/ngày (NEAT)</label>
                    <input
                      type="number"
                      step={500}
                      value={wizSteps}
                      onChange={(e) => setWizSteps(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono font-bold focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-white/60 font-semibold">Số buổi gym/tuần (EAT)</label>
                    <select
                      value={wizTrainDays}
                      onChange={(e) => setWizTrainDays(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#14060b] border border-white/10 text-white font-mono font-bold focus:outline-none focus:border-rose-500 cursor-pointer"
                    >
                      {[2, 3, 4, 5, 6].map((d) => (
                        <option key={d} value={d}>
                          {d} buổi/tuần
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-white/60 font-semibold">Thời lượng tập (phút)</label>
                    <input
                      type="number"
                      step={5}
                      value={wizTrainDuration}
                      onChange={(e) => setWizTrainDuration(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono font-bold focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* Thể thao phụ */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-white/80 font-bold">Môn thể thao phụ bổ trợ (Tùy chọn)</label>
                    <span className="text-[10px] text-white/40">Tự động cộng calo MET</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={wizSelectedSport}
                      onChange={(e) => setWizSelectedSport(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-[#14060b] border border-white/10 text-white text-xs cursor-pointer"
                    >
                      {COMMON_SPORTS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (MET {s.met})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const found = COMMON_SPORTS.find((s) => s.id === wizSelectedSport) || COMMON_SPORTS[0];
                        setWizSports((prev) => [
                          ...prev,
                          { id: String(Date.now()), name: found.name, met: found.met, minutes: 45, sessionsPerWeek: 2 },
                        ]);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      + Thêm môn
                    </button>
                  </div>

                  {wizSports.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {wizSports.map((s) => (
                        <div key={s.id} className="flex items-center justify-between p-2 rounded-xl bg-black/40 text-xs">
                          <span>{s.name} ({s.sessionsPerWeek} buổi x {s.minutes}p)</span>
                          <button
                            type="button"
                            onClick={() => setWizSports((prev) => prev.filter((x) => x.id !== s.id))}
                            className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* TDEE Summary */}
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between font-mono">
                  <span className="text-xs text-rose-300 font-sans font-semibold">TDEE Ước tính mô hình CTG:</span>
                  <span className="text-xl font-black text-white">{wizComputed.tdeeCal.toLocaleString('vi-VN')} kcal/ngày</span>
                </div>

                <div className="pt-2 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white cursor-pointer"
                  >
                    Quay lại
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer transition-colors flex items-center gap-2"
                  >
                    <span>Xem mô phỏng chu kỳ</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* BƯỚC 3: XEM TRƯỚC MÔ PHỎNG & KÍCH HOẠT */}
            {wizardStep === 3 && (
              <div className="space-y-4 animate-fadeIn text-xs">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white uppercase text-[10px] tracking-wider">
                      Kết Quả Mô Phỏng Chu Kỳ Sóng CTG
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                      {wizComputed.simulatedRoadmap.phases.length} Giai Đoạn · ~{wizComputed.totalWeeks} Tuần
                    </span>
                  </div>
                  <div className="text-xs text-white/60">
                    Lộ trình: <strong className="text-white">{wizComputed.curW}kg ({wizComputed.curBf}%)</strong> → <strong className="text-white">{wizComputed.targetW}kg ({wizComputed.clampedTargetBf}%)</strong> | Đích FFMI: <strong className="text-emerald-400">{wizComputed.clampedTargetFfmi}</strong>
                  </div>
                </div>

                {/* Danh sách các phase xem trước */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {wizComputed.simulatedRoadmap.phases.map((p, idx) => (
                    <div key={idx} className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>#{idx + 1}. {p.name}</span>
                          <span className="text-[10px] text-white/40 font-mono">({p.weeks} tuần)</span>
                        </div>
                        <div className="text-[11px] font-mono text-white/50">
                          {p.startWeightKg}kg → {p.targetWeightKg}kg · {p.startBodyFatPct}% → {p.targetBodyFatPct}% mỡ
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="font-bold text-white">{p.targetKcal} kcal</div>
                        <div className="text-[10px] text-rose-300/80">{p.macros.protein}P · {p.macros.carbs}C · {p.macros.fat}F</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white cursor-pointer"
                  >
                    Quay lại
                  </button>
                  <button
                    type="button"
                    onClick={handleCommitWizardRoadmap}
                    className="px-6 py-3 rounded-2xl bg-linear-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-sm cursor-pointer shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Kích Hoạt Lộ Trình Này Ngay</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: THƯ VIỆN & QUẢN LÝ LỘ TRÌNH (ROADMAP MANAGER MODAL) */}
      {showRoadmapManagerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-[#0b0307] border border-rose-500/30 w-full max-w-xl rounded-3xl shadow-2xl p-6 space-y-5 animate-scaleUp max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  Thư Viện Lộ Trình
                </span>
                <h3 className="text-lg font-black text-white mt-1">Các Lộ Trình Chu Kỳ Đã Tạo</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRoadmapManagerModal(false)}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {allSavedCtgRoadmaps.map((rm) => {
                const isActive = activeRoadmap?.id === rm.id;
                const phaseCount = rm.phases?.length || 0;
                const firstP = rm.phases?.[0];
                const lastP = rm.phases?.[phaseCount - 1];

                return (
                  <div
                    key={rm.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isActive
                        ? 'bg-rose-950/40 border-rose-500/50 shadow-md shadow-rose-950/50'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{rm.title || 'Lộ Trình Chu Kỳ'}</span>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Đang Kích Hoạt
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/60 flex flex-wrap items-center gap-2">
                          <span>{phaseCount} giai đoạn</span>
                          {firstP && lastP && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-white/70">
                                {firstP.startWeightKg}kg → {lastP.targetWeightKg}kg
                              </span>
                              <span>·</span>
                              <span className="text-emerald-400 font-mono font-bold">
                                FFMI {lastP.targetFfmi}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => {
                              onSwitchCtgRoadmap?.(rm.id);
                              onUpdateCtgPeriodizedRoadmap?.(rm);
                              if (rm.phases?.[0]) {
                                handleApplySinglePhase(rm.phases[0]);
                              }
                              setShowRoadmapManagerModal(false);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer transition-colors"
                          >
                            Kích hoạt
                          </button>
                        )}

                        {onDeleteCtgRoadmap && allSavedCtgRoadmaps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteCtgRoadmap(rm.id)}
                            className="p-1.5 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                            title="Xóa bản lưu này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SỬA GIAI ĐOẠN (EDIT PHASE MODAL) */}
      {editingPhase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-[#0b0307] border border-rose-500/30 w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-4 animate-scaleUp max-h-[85vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">Chỉnh Sửa Giai Đoạn</h3>
              <button
                type="button"
                onClick={() => setEditingPhase(null)}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-white/60 font-semibold">Tên giai đoạn</label>
                <input
                  type="text"
                  value={editingPhase.name}
                  onChange={(e) => setEditingPhase({ ...editingPhase, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-white/60 font-semibold">Cân nặng bắt đầu (kg)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={editingPhase.startWeightKg}
                    onChange={(e) => setEditingPhase({ ...editingPhase, startWeightKg: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-white/60 font-semibold">Cân nặng mục tiêu (kg)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={editingPhase.targetWeightKg}
                    onChange={(e) => setEditingPhase({ ...editingPhase, targetWeightKg: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-white/60 font-semibold">% Mỡ bắt đầu</label>
                  <input
                    type="number"
                    step={0.1}
                    value={editingPhase.startBodyFatPct}
                    onChange={(e) => setEditingPhase({ ...editingPhase, startBodyFatPct: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-white/60 font-semibold">% Mỡ mục tiêu</label>
                  <input
                    type="number"
                    step={0.1}
                    value={editingPhase.targetBodyFatPct}
                    onChange={(e) => setEditingPhase({ ...editingPhase, targetBodyFatPct: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-white/60 font-semibold">Tổng Kcal mỗi ngày</label>
                <input
                  type="number"
                  step={20}
                  value={editingPhase.targetKcal}
                  onChange={(e) => setEditingPhase({ ...editingPhase, targetKcal: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-white/60 font-semibold">Đạm (g)</label>
                  <input
                    type="number"
                    value={editingPhase.macros.protein}
                    onChange={(e) =>
                      setEditingPhase({
                        ...editingPhase,
                        macros: { ...editingPhase.macros, protein: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-white/60 font-semibold">Carb (g)</label>
                  <input
                    type="number"
                    value={editingPhase.macros.carbs}
                    onChange={(e) =>
                      setEditingPhase({
                        ...editingPhase,
                        macros: { ...editingPhase.macros, carbs: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-white/60 font-semibold">Fat (g)</label>
                  <input
                    type="number"
                    value={editingPhase.macros.fat}
                    onChange={(e) =>
                      setEditingPhase({
                        ...editingPhase,
                        macros: { ...editingPhase.macros, fat: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-white/60 font-semibold">Ghi chú / Lời khuyên giai đoạn</label>
                <input
                  type="text"
                  value={editingPhase.note || ''}
                  onChange={(e) => setEditingPhase({ ...editingPhase, note: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingPhase(null)}
                className="px-4 py-2 rounded-xl border border-white/10 text-white/60 hover:text-white cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEditPhase}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: THÊM GIAI ĐOẠN THỦ CÔNG (ADD MANUAL PHASE) */}
      {showAddPhaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-[#0b0307] border border-rose-500/30 w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-4 animate-scaleUp max-h-[85vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">Thêm 1 Giai Đoạn Vào Chu Kỳ</h3>
              <button
                type="button"
                onClick={() => setShowAddPhaseModal(false)}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPhaseToEnd} className="space-y-3">
              <div className="space-y-1">
                <label className="text-white/60 font-semibold">Tên giai đoạn</label>
                <input
                  type="text"
                  value={newPhaseName}
                  onChange={(e) => setNewPhaseName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-bold"
                  placeholder="VD: Tăng cơ đợt 3"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-white/60 font-semibold">Loại giai đoạn</label>
                  <select
                    value={newPhaseType}
                    onChange={(e) => setNewPhaseType(e.target.value as CtgPhaseType)}
                    className="w-full px-3 py-2 rounded-xl bg-[#14060b] border border-white/10 text-white cursor-pointer"
                  >
                    <option value="bulk">Tăng cơ (Bulk)</option>
                    <option value="minicut">Mini-cut (Siết ngắn)</option>
                    <option value="cut">Giảm mỡ (Cut)</option>
                    <option value="maintain">Diet break (Xả hơi)</option>
                    <option value="final_cut">Giảm mỡ hoàn thiện</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-white/60 font-semibold">Số tuần kéo dài</label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={newDurationWeeks}
                    onChange={(e) => setNewDurationWeeks(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-white/60 font-semibold">Cân nặng bắt đầu (kg)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={newStartWeight}
                    onChange={(e) => setNewStartWeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-white/60 font-semibold">Cân nặng mục tiêu (kg)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={newTargetWeight}
                    onChange={(e) => setNewTargetWeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-white/60 font-semibold">Tổng Kcal mỗi ngày</label>
                <input
                  type="number"
                  step={20}
                  value={newCalories}
                  onChange={(e) => setNewCalories(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-white/60 font-semibold">Đạm (g)</label>
                  <input
                    type="number"
                    value={newProtein}
                    onChange={(e) => setNewProtein(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-white/60 font-semibold">Carb (g)</label>
                  <input
                    type="number"
                    value={newCarbs}
                    onChange={(e) => setNewCarbs(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-white/60 font-semibold">Fat (g)</label>
                  <input
                    type="number"
                    value={newFat}
                    onChange={(e) => setNewFat(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPhaseModal(false)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-white/60 hover:text-white cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                >
                  Thêm Vào Chu Kỳ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: XÁC NHẬN XÓA LỘ TRÌNH (DELETE CONFIRM) */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-[#0b0307] border border-rose-500/40 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4 animate-scaleUp text-xs">
            <div className="flex items-center gap-3 text-rose-400">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-white">Xác Nhận Xóa Lộ Trình</h3>
            </div>
            <p className="text-white/70 leading-relaxed">
              Bạn có chắc chắn muốn xóa lộ trình chu kỳ hiện tại? Bạn có thể lập lại lộ trình mới hoặc chọn lộ trình khác từ thư viện bất kỳ lúc nào.
            </p>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-white/10 text-white/60 hover:text-white cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteActiveRoadmap}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer shadow-md"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: ĐỒNG BỘ LỊCH TẬP VÀO GOOGLE CALENDAR (SMART FREE SLOTS) */}
      {activePhase && (
        <CtgCalendarSyncModal
          isOpen={isCalendarSyncModalOpen}
          onClose={() => setIsCalendarSyncModalOpen(false)}
          activePhase={activePhase}
          existingEvents={events}
          plannedSessions={plannedSessions}
          onBatchSchedule={onBatchScheduleToCalendar}
          lang={lang}
        />
      )}

      {/* MODAL 7: XUẤT THẺ CHECK-IN TUẦN CHUẨN CTG (3:4 HD) */}
      <CtgCheckinExportModal
        isOpen={isCheckinExportModalOpen}
        onClose={() => setIsCheckinExportModalOpen(false)}
        activePhase={activePhase}
        roadmap={activeRoadmap}
        bodyPoints={bodyPoints || []}
        profile={profile}
        lang={lang}
      />
    </div>
  );
};

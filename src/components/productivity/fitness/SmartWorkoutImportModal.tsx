import React, { useState, useMemo } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  Dumbbell,
  CheckCircle2,
  AlertCircle,
  X,
  Play,
  Calendar,
  Flame,
  Zap,
  Download,
  Info,
  Check,
  Trophy,
  ArrowRight,
  RefreshCw,
  Clock,
  Layers,
} from 'lucide-react';
import {
  Exercise,
  MuscleGroup,
  PlannedSession,
  WorkoutSession,
  MUSCLE_LABEL,
  MUSCLE_COLOR,
} from '../../../types/productivity';
import {
  parseMultiRoutineSnippet,
  parseWorkoutCsv,
  workoutSnippetToWorkoutSession,
  workoutSnippetToPlannedSession,
  generateWorkoutCsvTemplate,
  ParsedWorkoutSnippet,
} from '../../../utils/workoutParser';
import { todayString } from '../../../utils/fitnessMetrics';
import { notifySuccess, notifyWarning } from '../../../utils/notify';

export interface SmartWorkoutImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userWeightKg: number;
  customExercises?: Exercise[];
  prs?: Record<string, { weightKg: number; reps: number }>;
  onLogWorkoutSession?: (session: Omit<WorkoutSession, 'id'>) => WorkoutSession;
  onAddPlannedSession?: (session: PlannedSession) => void;
  onOpenSyncStudio?: () => void;
  lang?: 'vi' | 'en';
}

const TEMPLATE_PRESETS = [
  {
    id: 'upper_ab',
    label: 'Upper A & Upper B (CSV Form)',
    text: `Upper A
Exercise,Sets,Reps,Rest,Video
Pec Deck,2,8-12,90,
Incline Press,2,6-10,150,
Gymleco Shoulder Press,2,6-10,150,
Top Half Pullovers,2,8-12,90,
Lat Pulldown,3,8-12,120,
Lat Row,1,8-12,120,
Chest Supported T-Bar Row,2,8-12,120,
Kelso Shrug,2,10-15,90,
Single Arm Machine Lateral Raise,3,10-15,90,
Tricep Pushdown,2,8-12,90,
Overhead Rope Triceps Extension,1,10-15,90,
Preacher Curl,2,8-12,90,
Recline Curl,1,8-12,90,
Hammer Curl,1,8-12,90,

Upper B
Exercise,Sets,Reps,Rest,Video
Pec Deck,2,8-12,90,
Incline Press,2,6-10,150,
Gymleco Shoulder Press,2,6-10,150,
Top Half Pullovers,2,8-12,90,
Lat Pulldown,3,8-12,120,
Lat Row,1,8-12,120,
Chest Supported T-Bar Row,2,8-12,120,
Kelso Shrug,2,10-15,90,
Single Arm Machine Lateral Raise,3,10-15,90,
Tricep Pushdown,2,8-12,90,
Overhead Rope Triceps Extension,1,10-15,90,
Preacher Curl,2,8-12,90,
Recline Curl,1,8-12,90,
Hammer Curl,1,8-12,90,`,
  },
  {
    id: 'push',
    label: 'Push Day Hypertrophy',
    text: `Title: Push Day Hypertrophy
Date: ${todayString()}

Bench Press 4x8 80kg RIR 2
Incline DB Press 3x10 28kg RPE 8.5
Lateral Raise 4x15 10kg failure
Triceps Pushdown 3x12 25kg dropset
Hít đất 3x20 bodyweight`,
  },
  {
    id: 'pull',
    label: 'Pull Day Sức Mạnh',
    text: `Title: Pull Day Sức Mạnh
Date: ${todayString()}

Deadlift 4x5 120kg RIR 2
Lat Pulldown 4x10 60kg RIR 1
Barbell Row 4x8 75kg RPE 8
Barbell Curl 3x10 30kg RIR 1
Face Pull 3x15 20kg`,
  },
  {
    id: 'legs',
    label: 'Leg Day Bùng Nổ',
    text: `Title: Leg Day Bùng Nổ
Date: ${todayString()}

Back Squat 4x8 100kg RIR 2
Leg Press 4x12 200kg RPE 8
Romanian Deadlift 3x8 90kg RIR 2
Leg Curl 3x12 45kg dropset
Calf Raise 4x15 60kg`,
  },
];

export const SmartWorkoutImportModal: React.FC<SmartWorkoutImportModalProps> = ({
  isOpen,
  onClose,
  userWeightKg,
  customExercises = [],
  prs = {},
  onLogWorkoutSession,
  onAddPlannedSession,
  onOpenSyncStudio,
  lang = 'vi',
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [rawText, setRawText] = useState(TEMPLATE_PRESETS[0].text);
  const [selectedRoutineIndex, setSelectedRoutineIndex] = useState<number>(0);
  const [targetDayOfWeek, setTargetDayOfWeek] = useState<string>('Thứ 2');
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // File import state
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Live parsed routines (can be multiple: Upper A, Upper B...)
  const parsedRoutines: ParsedWorkoutSnippet[] = useMemo(() => {
    if (!rawText.trim()) {
      return [
        {
          workoutTitle: 'Chưa có bài tập',
          targetDate: todayString(),
          exerciseGroups: [],
          allSets: [],
          totalSets: 0,
          totalReps: 0,
          totalVolumeKg: 0,
          estimatedBurnedKcal: 0,
          targetedMuscles: [],
          unrecognizedLines: [],
        },
      ];
    }
    return parseMultiRoutineSnippet(rawText, customExercises, userWeightKg);
  }, [rawText, customExercises, userWeightKg]);

  // Keep selectedRoutineIndex within bounds
  const safeRoutineIndex = Math.min(selectedRoutineIndex, Math.max(0, parsedRoutines.length - 1));
  const activeSnippet = parsedRoutines[safeRoutineIndex] || parsedRoutines[0];

  if (!isOpen) return null;

  const handleApplyPreset = (text: string) => {
    setRawText(text);
    setSelectedRoutineIndex(0);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      try {
        if (file.name.endsWith('.json')) {
          const parsedJson = JSON.parse(content);
          if (Array.isArray(parsedJson)) {
            const lines = parsedJson.map((item: any) => `${item.name || item.exercise} ${item.sets || 3}x${item.reps || 10} ${item.weight || 0}kg`).join('\n');
            setRawText(lines);
            setActiveTab('text');
          } else if (parsedJson.sets || parsedJson.exercises) {
            const list = parsedJson.sets || parsedJson.exercises;
            const lines = list.map((item: any) => `${item.name || item.exerciseId} ${item.sets || 3}x${item.reps || 10} ${item.weightKg || item.weight || 0}kg`).join('\n');
            setRawText(lines);
            setActiveTab('text');
          } else {
            setRawText(content);
            setActiveTab('text');
          }
        } else {
          // If CSV text, set directly to rawText and let multi-routine parser parse it!
          setRawText(content);
          setActiveTab('text');
          notifySuccess('Đã nạp file thành công!', `Đã nạp nội dung từ ${file.name}.`);
        }
      } catch (err: any) {
        setFileError(`Lỗi đọc file: ${err?.message || 'Định dạng không hợp lệ'}`);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const csvContent = generateWorkoutCsvTemplate();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'zenox_workout_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Save single active session as completed WorkoutSession
  const handleSaveActiveCompletedWorkout = () => {
    if (activeSnippet.allSets.length === 0) {
      notifyWarning('Chưa có bài tập nào', 'Vui lòng nhập ít nhất 1 bài tập hợp lệ.');
      return;
    }

    setIsProcessing(true);
    try {
      const workoutSession = workoutSnippetToWorkoutSession(activeSnippet, sessionNotes);
      if (onLogWorkoutSession) {
        onLogWorkoutSession(workoutSession);
      }

      notifySuccess(
        'Đã lưu buổi tập thành công!',
        `Ghi nhận "${activeSnippet.workoutTitle}" (${activeSnippet.totalSets} hiệp · ${activeSnippet.totalVolumeKg.toLocaleString()}kg volume · +${activeSnippet.estimatedBurnedKcal} kcal)!`
      );
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi lưu buổi tập:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Save active session as PlannedSession
  const handleSaveActivePlannedSession = () => {
    if (activeSnippet.exerciseGroups.length === 0) {
      notifyWarning('Chưa có bài tập nào', 'Vui lòng nhập ít nhất 1 bài tập hợp lệ.');
      return;
    }

    setIsProcessing(true);
    try {
      const planned = workoutSnippetToPlannedSession(activeSnippet, targetDayOfWeek);
      if (onAddPlannedSession) {
        onAddPlannedSession(planned);
      }

      notifySuccess(
        'Đã tạo giáo án mới!',
        `Đã thêm "${planned.title}" (${planned.prescriptions.length} bài) vào lịch ${targetDayOfWeek}! Bạn có thể đồng bộ ngay lên Google Calendar.`
      );
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi tạo giáo án:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Save ALL routines into PlannedSessions (e.g. Upper A into Thứ 2, Upper B into Thứ 5)
  const handleSaveAllRoutinesToPlan = () => {
    if (parsedRoutines.length === 0 || parsedRoutines.every((r) => r.exerciseGroups.length === 0)) {
      notifyWarning('Chưa có bài tập nào', 'Vui lòng kiểm tra lại dữ liệu bài tập.');
      return;
    }

    setIsProcessing(true);
    try {
      const DAYS_SEQUENCE = ['Thứ 2', 'Thứ 5', 'Thứ 3', 'Thứ 6', 'Thứ 4', 'Thứ 7', 'Chủ Nhật'];
      let addedCount = 0;

      parsedRoutines.forEach((routine, idx) => {
        if (routine.exerciseGroups.length > 0) {
          const day = DAYS_SEQUENCE[idx % DAYS_SEQUENCE.length];
          const planned = workoutSnippetToPlannedSession(routine, day);
          onAddPlannedSession?.(planned);
          addedCount++;
        }
      });

      notifySuccess(
        'Đã nạp toàn bộ giáo án tuần!',
        `Đã thêm thành công cả ${addedCount} buổi tập (${parsedRoutines.map((r) => r.workoutTitle).join(', ')}) vào lịch tuần! Sẵn sàng đồng bộ Google Calendar.`
      );
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi lưu các giáo án:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0f0b15] border border-white/10 rounded-3xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden relative">

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-100">
              <Sparkles className="w-5 h-5 text-zinc-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  ZENOX Smart Workout Studio
                </span>
                <span className="text-xs text-white/40 hidden sm:inline">Hỗ trợ định dạng CSV Upper A / B &amp; Smart Text</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                Nhập Giáo Án &amp; Buổi Tập (Text / CSV / File)
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-5 pt-3 border-b border-white/10 flex items-center justify-between gap-4 bg-white/[0.01] shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'text'
                  ? 'border-amber-500 text-zinc-100'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Nhập Text / Cú Pháp CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'file'
                  ? 'border-amber-500 text-zinc-100'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Tải File Lên (CSV / JSON)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-semibold cursor-pointer pb-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải file CSV mẫu (Upper A)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === 'text' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Text Input & Presets */}
              <div className="lg:col-span-5 space-y-3">
                {/* Syntax Presets */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5 flex items-center justify-between">
                    <span>Mẫu Cú Pháp Nhanh (Click để nạp)</span>
                    <span className="text-[10px] text-violet-400 font-mono">Tự động nhận diện Sets/Reps/Rest</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {TEMPLATE_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleApplyPreset(p.text)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] transition-all cursor-pointer ${
                          p.id === 'upper_ab'
                            ? 'bg-violet-600/30 border-violet-500 text-white font-bold'
                            : 'bg-white/5 hover:bg-violet-600/20 border-white/10 text-white/80'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea */}
                <div className="relative">
                  <textarea
                    rows={14}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={`Paste form bài tập dạng:\nUpper A\nExercise,Sets,Reps,Rest,Video\nPec Deck,2,8-12,90,\nIncline Press,2,6-10,150,\n...\n\nUpper B\nExercise,Sets,Reps,Rest,Video\n...`}
                    className="w-full text-xs font-mono p-3.5 rounded-2xl bg-black/40 border border-white/10 text-white placeholder-white/20 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-y leading-relaxed"
                  />
                  <div className="text-[10px] text-white/40 flex items-center justify-between px-1 mt-1">
                    <span>Hỗ trợ cả CSV dạng: Exercise,Sets,Reps,Rest,Video</span>
                    <span>{rawText.split('\n').filter(Boolean).length} dòng</span>
                  </div>
                </div>

                {/* Unrecognized Lines Warning */}
                {activeSnippet.unrecognizedLines.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <div className="font-bold">Dòng chưa nhận diện ({activeSnippet.unrecognizedLines.length}):</div>
                      <div className="text-[11px] opacity-80 mt-0.5 font-mono">
                        {activeSnippet.unrecognizedLines.slice(0, 3).join(' · ')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Multi-Routine Preview & Metrics */}
              <div className="lg:col-span-7 space-y-3">
                {/* Multi-Routine Switcher Bar (if more than 1 routine detected) */}
                {parsedRoutines.length > 1 && (
                  <div className="p-2.5 rounded-2xl bg-violet-950/30 border border-violet-500/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-violet-400 shrink-0" />
                      <span className="text-[11px] font-mono font-bold text-violet-300 uppercase">
                        {parsedRoutines.length} Buổi Tập Được Nhận Diện:
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      {parsedRoutines.map((r, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedRoutineIndex(idx)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                            safeRoutineIndex === idx
                              ? 'bg-zinc-800 text-zinc-100 border border-amber-500/50'
                              : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {r.workoutTitle} ({r.exerciseGroups.length} bài)
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metrics Banner for Active Routine */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="text-[10px] text-white/40 uppercase font-mono">
                      {activeSnippet.workoutTitle}
                    </div>
                    <div className="text-base font-black text-white mt-0.5 font-mono">
                      {activeSnippet.exerciseGroups.length} bài <span className="text-xs text-white/50 font-normal">({activeSnippet.totalSets}s)</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="text-[10px] text-white/40 uppercase font-mono">Volume / Reps</div>
                    <div className="text-base font-black text-amber-400 mt-0.5 font-mono flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5" />
                      <span>{activeSnippet.totalReps}</span>
                      <span className="text-[10px] text-white/50 font-normal">tổng reps</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="text-[10px] text-white/40 uppercase font-mono">Calo Tiêu Hao</div>
                    <div className="text-base font-black text-emerald-400 mt-0.5 font-mono">
                      +{activeSnippet.estimatedBurnedKcal} <span className="text-[10px] text-white/50 font-normal">kcal</span>
                    </div>
                  </div>
                </div>

                {/* Muscle Breakdown Pills */}
                {activeSnippet.targetedMuscles.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-white/40 font-mono uppercase">Nhóm cơ:</span>
                    {activeSnippet.targetedMuscles.map((m) => (
                      <span
                        key={m.muscle}
                        className="text-[10px] px-2 py-0.5 rounded-full font-bold border"
                        style={{
                          backgroundColor: `${MUSCLE_COLOR[m.muscle]}22`,
                          color: MUSCLE_COLOR[m.muscle],
                          borderColor: `${MUSCLE_COLOR[m.muscle]}44`,
                        }}
                      >
                        {m.label} ({m.percentage}%)
                      </span>
                    ))}
                  </div>
                )}

                {/* Parsed Exercise Cards List */}
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {activeSnippet.exerciseGroups.length === 0 ? (
                    <div className="p-8 text-center text-white/30 text-xs border border-dashed border-white/10 rounded-2xl">
                      Chưa có bài tập nào. Hãy nhập văn bản hoặc chọn mẫu bên trái.
                    </div>
                  ) : (
                    activeSnippet.exerciseGroups.map((group, gIdx) => {
                      return (
                        <div
                          key={gIdx}
                          className="p-3 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                                style={{
                                  backgroundColor: `${MUSCLE_COLOR[group.muscle]}22`,
                                  color: MUSCLE_COLOR[group.muscle],
                                }}
                              >
                                {MUSCLE_LABEL[group.muscle]}
                              </span>
                              <span className="font-bold text-xs text-white">
                                {group.exerciseName}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] font-mono text-white/60">
                              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white font-bold">
                                {group.sets.length} sets × {group.prescribedReps || '10'} reps
                              </span>
                              {group.restSeconds && (
                                <span className="flex items-center gap-0.5 text-amber-300">
                                  <Clock className="w-3 h-3" />
                                  <span>{group.restSeconds}s</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* File Upload Tab */
            <div className="space-y-4 py-4">
              <div className="p-8 border-2 border-dashed border-white/20 hover:border-violet-500/60 rounded-3xl bg-black/20 flex flex-col items-center justify-center text-center transition-all">
                <div className="w-16 h-16 rounded-2xl bg-violet-600/20 text-violet-400 flex items-center justify-center mb-3">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-white">Kéo thả hoặc tải lên file dữ liệu tập luyện</h3>
                <p className="text-xs text-white/50 mt-1 max-w-md">
                  Hỗ trợ định dạng CSV từ <strong>Strong app</strong>, <strong>Hevy app</strong>, hoặc bảng CSV Upper/Lower như mẫu bạn cung cấp.
                </p>

                <label className="mt-4 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-white/10 text-xs font-semibold cursor-pointer transition-colors">
                  <input
                    type="file"
                    accept=".csv,.json,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <span>Chọn File Từ Máy Tính</span>
                </label>

                {fileName && (
                  <div className="mt-3 text-xs text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đã nạp file: {fileName}</span>
                  </div>
                )}

                {fileError && (
                  <div className="mt-3 text-xs text-rose-400 font-mono flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>{fileError}</span>
                  </div>
                )}
              </div>

              {/* Sample Structure Guide */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-violet-400" />
                  <span>Cấu trúc bảng CSV được hỗ trợ tự động:</span>
                </div>
                <div className="text-[11px] font-mono text-white/60">
                  <code className="text-violet-300">Exercise,Sets,Reps,Rest,Video</code>
                </div>
              </div>
            </div>
          )}

          {/* Target Settings for Save Options */}
          <div className="pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 block mb-1">
                Ghi chú thêm cho buổi tập
              </label>
              <input
                type="text"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="VD: Cảm giác pump tốt, nghỉ chuẩn theo timer..."
                className="w-full text-xs px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 block mb-1">
                Lên lịch vào Thứ mấy (khi lưu buổi đang chọn)
              </label>
              <select
                value={targetDayOfWeek}
                onChange={(e) => setTargetDayOfWeek(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[#14101e] border border-white/10 text-white focus:outline-none focus:border-violet-500"
              >
                {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-white/40 hidden sm:block">
            {activeSnippet.totalSets > 0 ? (
              <span>
                Đang chọn: <strong className="text-white">{activeSnippet.workoutTitle}</strong> ({activeSnippet.exerciseGroups.length} bài · {activeSnippet.totalSets} hiệp)
              </span>
            ) : (
              <span>Chưa có dữ liệu bài tập</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 rounded-xl cursor-pointer"
            >
              Hủy
            </button>

            {/* Option A: Save single completed workout */}
            <button
              type="button"
              disabled={isProcessing || activeSnippet.allSets.length === 0}
              onClick={handleSaveActiveCompletedWorkout}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-white/10 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-40"
              title="Ghi nhận ngay buổi tập đang chọn vào Lịch sử tập luyện"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Lưu "{activeSnippet.workoutTitle}" Đã Hoàn Thành</span>
            </button>

            {/* Option B: If multiple routines, Save ALL routines to Mesocycle */}
            {parsedRoutines.length > 1 ? (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleSaveAllRoutinesToPlan}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer transition-colors disabled:opacity-40 shadow-sm"
                title="Lưu cả Upper A (Thứ 2) và Upper B (Thứ 5) vào giáo án tuần để đồng bộ Google Calendar"
              >
                <Calendar className="w-3.5 h-3.5 text-white/80" />
                <span>Lưu CẢ {parsedRoutines.length} Buổi Vào Giáo Án Tuần</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isProcessing || activeSnippet.exerciseGroups.length === 0}
                onClick={handleSaveActivePlannedSession}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer transition-colors disabled:opacity-40 shadow-sm"
                title="Lưu các bài tập này thành Giáo án mẫu để áp dụng hàng tuần và đồng bộ Google Calendar"
              >
                <Calendar className="w-3.5 h-3.5 text-white/80" />
                <span>Lưu Thành Giáo Án Mới</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

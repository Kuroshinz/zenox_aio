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
  parseWorkoutSnippet,
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
    id: 'push',
    label: 'Push Day (Ngực & Tay sau)',
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
    label: 'Pull Day (Lưng Xô & Tay trước)',
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
    label: 'Leg Day (Đùi & Bắp chân)',
    text: `Title: Leg Day Bùng Nổ
Date: ${todayString()}

Back Squat 4x8 100kg RIR 2
Leg Press 4x12 200kg RPE 8
Romanian Deadlift 3x8 90kg RIR 2
Leg Curl 3x12 45kg dropset
Calf Raise 4x15 60kg`,
  },
  {
    id: 'multiline',
    label: 'Cú pháp Chi tiết (Từng Set)',
    text: `Title: Bench & Squat Focus
Date: ${todayString()}

Bench Press:
Set 1: 70kg x 10 reps warmup
Set 2: 80kg x 8 reps rir 2
Set 3: 85kg x 8 reps rir 1
Set 4: 90kg x 6 reps failure

Back Squat:
100kg x 8 @8
105kg x 8 @8.5
110kg x 6 rir 1`,
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
  const [targetDayOfWeek, setTargetDayOfWeek] = useState<string>('Thứ 2');
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // File import state
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Live parsed result
  const parsedResult: ParsedWorkoutSnippet = useMemo(() => {
    if (!rawText.trim()) {
      return parseWorkoutSnippet('', customExercises, userWeightKg);
    }
    return parseWorkoutSnippet(rawText, customExercises, userWeightKg);
  }, [rawText, customExercises, userWeightKg]);

  if (!isOpen) return null;

  const handleApplyPreset = (text: string) => {
    setRawText(text);
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
          // If JSON contains sets or exercises
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
          // CSV Parsing
          const csvResult = parseWorkoutCsv(content, customExercises, userWeightKg);
          if (csvResult.allSets.length > 0) {
            // Convert to text view for instant editing
            const reconstructed = [
              `Title: ${csvResult.workoutTitle}`,
              `Date: ${csvResult.targetDate}`,
              '',
              ...csvResult.exerciseGroups.map((g) => {
                const avgReps = Math.round(g.sets.reduce((s, x) => s + x.reps, 0) / g.sets.length);
                const avgWeight = Math.round(g.sets.reduce((s, x) => s + x.weightKg, 0) / g.sets.length);
                return `${g.exerciseName} ${g.sets.length}x${avgReps} ${avgWeight}kg`;
              }),
            ].join('\n');
            setRawText(reconstructed);
            setActiveTab('text');
            notifySuccess('Đã import file thành công!', `Đã nhận diện ${csvResult.allSets.length} hiệp từ file ${file.name}.`);
          } else {
            setFileError('Không thể phân tích dữ liệu bài tập từ file này. Vui lòng kiểm tra định dạng.');
          }
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

  // 1. Save as completed WorkoutSession
  const handleSaveAsCompletedWorkout = () => {
    if (parsedResult.allSets.length === 0) {
      notifyWarning('Chưa có bài tập nào', 'Vui lòng nhập ít nhất 1 bài tập hợp lệ.');
      return;
    }

    setIsProcessing(true);
    try {
      const workoutSession = workoutSnippetToWorkoutSession(parsedResult, sessionNotes);
      if (onLogWorkoutSession) {
        onLogWorkoutSession(workoutSession);
      }

      notifySuccess(
        'Đã lưu buổi tập thành công!',
        `Ghi nhận "${parsedResult.workoutTitle}" (${parsedResult.totalSets} hiệp · ${parsedResult.totalVolumeKg.toLocaleString()}kg volume · +${parsedResult.estimatedBurnedKcal} kcal)!`
      );
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi lưu buổi tập:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Save as PlannedSession in Routine / Mesocycle
  const handleSaveAsPlannedSession = () => {
    if (parsedResult.exerciseGroups.length === 0) {
      notifyWarning('Chưa có bài tập nào', 'Vui lòng nhập ít nhất 1 bài tập hợp lệ.');
      return;
    }

    setIsProcessing(true);
    try {
      const planned = workoutSnippetToPlannedSession(parsedResult, targetDayOfWeek);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0f0b15] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Glow */}
        <div className="absolute top-0 right-1/4 w-80 h-40 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white shadow-lg shadow-violet-900/30">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  ZENOX Smart Workout Studio
                </span>
                <span className="text-xs text-white/40 hidden sm:inline">Tracked.gg Engine</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                Nhập Bài Tập Bằng Cú Pháp Text Thông Minh Hoặc File
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
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>✍️ Nhập Text Thông Minh (Smart Syntax / NLP)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'file'
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>📁 Import File (CSV / JSON / Strong / Hevy)</span>
            </button>
          </div>

          {activeTab === 'file' && (
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="hidden sm:flex items-center gap-1.5 text-xs text-violet-300 hover:text-white font-semibold cursor-pointer pb-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải file CSV mẫu</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === 'text' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Text Input & Presets */}
              <div className="lg:col-span-6 space-y-3">
                {/* Syntax Presets */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5 flex items-center justify-between">
                    <span>Mẫu Cú Pháp Nhanh (Click để nạp)</span>
                    <span className="text-[10px] text-violet-400 font-mono">Tự động nhận diện RIR / RPE</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {TEMPLATE_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleApplyPreset(p.text)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-violet-600/30 border border-white/10 hover:border-violet-500/50 text-[11px] text-white/80 hover:text-white transition-all cursor-pointer"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea */}
                <div className="relative">
                  <textarea
                    rows={12}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={`Nhập bài tập, ví dụ:\nBench Press 4x8 80kg RIR 2\nIncline DB Press 3x10 28kg RPE 8.5\nSquat 4x8 100kg\nLateral Raise 4x15 10kg failure\n...\n\nHoặc cú pháp dạng:\nBench Press:\nSet 1: 80kg x 8 reps rir 2\nSet 2: 85kg x 6 reps failure`}
                    className="w-full text-xs font-mono p-3.5 rounded-2xl bg-black/40 border border-white/10 text-white placeholder-white/20 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-y leading-relaxed"
                  />
                  <div className="text-[10px] text-white/30 flex items-center justify-between px-1 mt-1">
                    <span>Hỗ trợ cả tên Tiếng Việt (hít đất, gánh tạ, kéo xô...) và Tiếng Anh</span>
                    <span>{rawText.split('\n').filter(Boolean).length} dòng</span>
                  </div>
                </div>

                {/* Unrecognized Lines Warning */}
                {parsedResult.unrecognizedLines.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <div className="font-bold">Dòng chưa nhận diện ({parsedResult.unrecognizedLines.length}):</div>
                      <div className="text-[11px] opacity-80 mt-0.5 font-mono">
                        {parsedResult.unrecognizedLines.slice(0, 3).join(' · ')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Live Parsed Preview & Metrics */}
              <div className="lg:col-span-6 space-y-3">
                {/* Metrics Banner */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="text-[10px] text-white/40 uppercase font-mono">Tổng Hiệp / Reps</div>
                    <div className="text-base font-black text-white mt-0.5 font-mono">
                      {parsedResult.totalSets} <span className="text-xs text-white/50 font-normal">hiệp ({parsedResult.totalReps}r)</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="text-[10px] text-white/40 uppercase font-mono">Volume Tonnage</div>
                    <div className="text-base font-black text-amber-400 mt-0.5 font-mono flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5" />
                      <span>{parsedResult.totalVolumeKg.toLocaleString()}</span>
                      <span className="text-[10px] text-white/50 font-normal">kg</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="text-[10px] text-white/40 uppercase font-mono">Calo Tiêu Hao</div>
                    <div className="text-base font-black text-emerald-400 mt-0.5 font-mono">
                      +{parsedResult.estimatedBurnedKcal} <span className="text-[10px] text-white/50 font-normal">kcal</span>
                    </div>
                  </div>
                </div>

                {/* Muscle Breakdown Pills */}
                {parsedResult.targetedMuscles.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-white/40 font-mono uppercase">Nhóm cơ:</span>
                    {parsedResult.targetedMuscles.map((m) => (
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
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {parsedResult.exerciseGroups.length === 0 ? (
                    <div className="p-8 text-center text-white/30 text-xs border border-dashed border-white/10 rounded-2xl">
                      Chưa có bài tập nào. Hãy nhập văn bản hoặc chọn mẫu bên trái.
                    </div>
                  ) : (
                    parsedResult.exerciseGroups.map((group, gIdx) => {
                      const curPr = prs[group.exerciseId];
                      return (
                        <div
                          key={gIdx}
                          className="p-3 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2"
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
                            <span className="text-[10px] font-mono text-white/50">
                              {group.sets.length} hiệp · {group.totalTonnageKg.toLocaleString()}kg
                            </span>
                          </div>

                          {/* Sets Grid */}
                          <div className="space-y-1">
                            {group.sets.map((s, sIdx) => {
                              const isGreenPr = curPr && (s.weightKg > curPr.weightKg || (s.weightKg === curPr.weightKg && s.reps > curPr.reps));

                              return (
                                <div
                                  key={sIdx}
                                  className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between text-xs font-mono ${
                                    isGreenPr
                                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                                      : 'bg-black/30 border-white/5 text-white/80'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-white/40">#{sIdx + 1}</span>
                                    <span className="font-bold text-white">
                                      {s.weightKg > 0 ? `${s.weightKg}kg` : 'Bodyweight'} × {s.reps} reps
                                    </span>
                                    {isGreenPr && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500 text-black font-black uppercase tracking-wider flex items-center gap-0.5">
                                        <Trophy className="w-2.5 h-2.5" />
                                        <span>PR</span>
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 text-[10px]">
                                    {s.rir !== undefined && (
                                      <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">
                                        RIR {s.rir}
                                      </span>
                                    )}
                                    {s.rpe !== undefined && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                        RPE {s.rpe}
                                      </span>
                                    )}
                                    {s.setType !== 'normal' && (
                                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 uppercase font-bold text-[9px]">
                                        {s.setType}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
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
                  Hỗ trợ định dạng CSV từ <strong>Strong app</strong>, <strong>Hevy app</strong>, <strong>Liftoff</strong> hoặc file CSV/JSON chuẩn ZENOX.
                </p>

                <label className="mt-4 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-md shadow-violet-900/30 cursor-pointer transition-all hover:scale-105">
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
                  <span>Các cột được hỗ trợ tự động:</span>
                </div>
                <div className="text-[11px] font-mono text-white/60">
                  <code className="text-violet-300">Date, Workout Name, Exercise Name, Set Order, Weight, Reps, RPE, Notes</code>
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
                placeholder="VD: Cảm giác pump tốt, tăng tạ ở bài bench..."
                className="w-full text-xs px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 block mb-1">
                Lên lịch vào Thứ mấy (khi lưu thành Giáo án)
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
            {parsedResult.totalSets > 0 ? (
              <span>
                Sẵn sàng: <strong className="text-white">{parsedResult.totalSets} hiệp</strong> · {parsedResult.totalVolumeKg.toLocaleString()}kg
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

            {/* Option A: Save as completed WorkoutSession */}
            <button
              type="button"
              disabled={isProcessing || parsedResult.allSets.length === 0}
              onClick={handleSaveAsCompletedWorkout}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-emerald-950/40 cursor-pointer transition-all hover:scale-105 active:scale-95"
              title="Ghi nhận ngay buổi tập này vào Lịch sử tập luyện và tính Volume/Streak"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>💾 Lưu Buổi Tập Đã Hoàn Thành</span>
            </button>

            {/* Option B: Save as Routine PlannedSession */}
            <button
              type="button"
              disabled={isProcessing || parsedResult.exerciseGroups.length === 0}
              onClick={handleSaveAsPlannedSession}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-violet-950/40 cursor-pointer transition-all hover:scale-105 active:scale-95"
              title="Lưu các bài tập này thành Giáo án mẫu để áp dụng hàng tuần và đồng bộ Google Calendar"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-300" />
              <span>📋 Lưu Thành Giáo Án Mới</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

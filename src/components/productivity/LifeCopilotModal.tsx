import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  Calendar,
  DollarSign,
  Utensils,
  Droplets,
  CheckSquare,
  Timer,
  ArrowRight,
  CheckCircle2,
  Zap,
  Flame,
  HelpCircle,
  TrendingUp,
  Clock,
  Dumbbell,
  AlertTriangle,
  Mic,
} from 'lucide-react';
import { CalendarEvent, CalendarViewType } from '../../types/calendar';
import { MealSlot } from '../../types/productivity';
import {
  FinanceCategoryId,
  ProductivityStore,
  todayString,
} from '../../hooks/useProductivityStore';
import {
  parseNaturalLanguageInput,
  findConflictingEvents,
  resolveNonConflictingSlot,
  timeToMinutes,
} from '../../utils/calendarUtils';
import { formatMoney } from '../../utils/productivityUtils';
import { parseFoodText, parseMacroTextResponse } from '../../utils/fitnessMetrics';

interface LifeCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'vi' | 'en';
  store: ProductivityStore;
  events: CalendarEvent[];
  onAddEvent: (event: CalendarEvent) => void;
  onNavigate: (view: CalendarViewType) => void;
  currentDate?: Date;
}

export type ParsedIntentType =
  | 'finance'
  | 'calendar'
  | 'nutrition'
  | 'water'
  | 'task'
  | 'focus'
  | 'advice';

export interface ParsedIntentResult {
  type: ParsedIntentType;
  title: string;
  badgeLabel: string;
  badgeColor: string;
  icon: React.ElementType;
  data: any;
}

export const LifeCopilotModal: React.FC<LifeCopilotModalProps> = ({
  isOpen,
  onClose,
  lang,
  store,
  events,
  onAddEvent,
  onNavigate,
  currentDate = new Date(),
}) => {
  const [input, setInput] = useState('');
  const [calendarOverride, setCalendarOverride] = useState<{ startTime: string; endTime: string } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionHistory, setActionHistory] = useState<
    Array<{ text: string; time: string; type: ParsedIntentType }>
  >([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const today = todayString();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  // Handle global Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // -------------------------------------------------------------------------
  // Smart Multi-Domain Natural Language Intent Parser
  // -------------------------------------------------------------------------
  const parsedIntent = useMemo((): ParsedIntentResult | null => {
    const raw = input.trim();
    if (!raw) return null;
    const lower = raw.toLowerCase();

    // 1. Water Intake (e.g. "uống 300ml nước", "uống 1 lít nước", "thêm 500ml")
    const waterMatch =
      /(?:uống|thêm|nước)\s*(\d+(?:[.,]\d+)?)\s*(ml|lít|l)\b/i.exec(lower) ||
      /(\d+(?:[.,]\d+)?)\s*(ml|lít)\s*(?:nước)?/i.exec(lower);
    if (waterMatch && !/(?:k|nghìn|ngàn|tr|triệu|đ|vnd)\b/i.test(lower)) {
      const val = parseFloat(waterMatch[1].replace(',', '.'));
      const unit = (waterMatch[2] || '').toLowerCase();
      let ml = unit === 'lít' || unit === 'l' || val < 10 ? Math.round(val * 1000) : Math.round(val);
      if (ml > 0) {
        return {
          type: 'water',
          title: `Uống thêm ${ml} ml nước`,
          badgeLabel: 'Ghi Nhận Nước',
          badgeColor: '#0ea5e9',
          icon: Droplets,
          data: { ml },
        };
      }
    }

    // 2. Finance: Expense or Income
    // Matches: "tiêu 45k ăn trưa", "mua 2 hộp sữa 45k", "chi 120.000 đổ xăng", "thu 5 triệu"
    const hasMoneyClues =
      /(?:tiêu|chi|mua|trả|thu|lương|tiền|phí|hóa đơn)/i.test(lower) ||
      /(?:\d+k|\d+\s*nghìn|\d+\s*ngàn|\d+\s*triệu|\d+[.,]\d{3})/i.test(lower);

    if (hasMoneyClues) {
      const isIncome = /(?:thu|nhận|lương|thưởng|kiếm được)/i.test(lower);
      // Prefer amounts with an explicit currency/multiplier suffix before bare numbers
      let amount = 0;
      const unitNumMatch = /(\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn|tr|triệu|đ|vnd)\b/i.exec(lower);
      const bareNumMatch = /(\d+(?:[.,]\d+)?)/.exec(lower);
      const numMatch = unitNumMatch || bareNumMatch;
      if (numMatch) {
        const rawNum = numMatch[1];
        const isGroupedThousands = /^\d{1,3}(?:[.,]\d{3})+$/.test(rawNum);
        let val = isGroupedThousands
          ? parseFloat(rawNum.replace(/[.,]/g, ''))
          : parseFloat(rawNum.replace(',', '.'));
        const unit = (unitNumMatch?.[2] || '').toLowerCase();
        if (unit === 'k' || unit === 'nghìn' || unit === 'ngàn') val *= 1000;
        else if (unit === 'tr' || unit === 'triệu') val *= 1000000;
        else if (unit === 'đ' || unit === 'vnd') val *= 1;
        else if (!isGroupedThousands && val < 1000 && !unit) val *= 1000; // heuristic: 45 -> 45.000đ
        amount = Math.round(val);
      }

      if (amount > 0) {
        // Detect category
        let categoryId: FinanceCategoryId = 'other';
        if (isIncome) categoryId = 'salary';
        else if (/(?:ăn|uống|cơm|phở|bún|cafe|trà|bánh|thịt)/i.test(lower)) categoryId = 'food';
        else if (/(?:xăng|xe|grab|be|taxi|vé)/i.test(lower)) categoryId = 'transport';
        else if (/(?:mua|sách|áo|quần|đồ)/i.test(lower)) categoryId = 'shopping';
        else if (/(?:điện|nước|mạng|wifi|nhà)/i.test(lower)) categoryId = 'bills';
        else if (/(?:thuốc|khám|gym|whey)/i.test(lower)) categoryId = 'health';

        // Clean note
        const note = raw
          .replace(/(?:tiêu|chi|mua|trả|thu|nhận|lương|thưởng)\s*/i, '')
          .replace(/(\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn|tr|triệu|đ|vnd)?/i, '')
          .trim() || (isIncome ? 'Thu nhập' : 'Chi tiêu');

        return {
          type: 'finance',
          title: `${isIncome ? 'Thu nhập' : 'Chi tiêu'}: ${formatMoney(amount, 'VND')} · ${note}`,
          badgeLabel: isIncome ? 'Thu Nhập' : 'Chi Tiêu',
          badgeColor: isIncome ? '#10b981' : '#f59e0b',
          icon: DollarSign,
          data: { amount, type: isIncome ? 'income' : 'expense', categoryId, note },
        };
      }
    }

    // 3. Nutrition & Meal Macro (e.g. "ăn trưa: cơm tấm 650 kcal, 35P, 70C, 20F" or "ăn trưa 200g ức gà + 250g cơm trắng")
    if (/(?:ăn|bữa|calo|kcal|protein|\d+p|\d+c|\d+f)/i.test(lower)) {
      const slotHint: MealSlot = /(?:sáng|breakfast)/i.test(lower)
        ? 'breakfast'
        : /(?:tối|dinner)/i.test(lower)
          ? 'dinner'
          : /(?:phụ|snack)/i.test(lower)
            ? 'snack'
            : 'lunch';

      let macroItems = parseMacroTextResponse(raw, slotHint);
      if (macroItems.length === 0) {
        const cleanedFoodText = raw
          .replace(/^(?:ăn|bữa)\s*(?:sáng|trưa|tối|phụ)?\s*[:\-–]?\s*/i, '')
          .trim();
        const parsedFoods = cleanedFoodText ? parseFoodText(cleanedFoodText) : [];
        if (parsedFoods.some((f) => f.recognised)) {
          macroItems = parsedFoods.map((f) => ({
            slot: slotHint,
            name: f.item.name,
            amount: f.item.amount,
            unit: f.item.unit,
            kcal: f.item.kcal,
            protein: f.item.protein,
            carbs: f.item.carbs,
            fat: f.item.fat,
          }));
        }
      }

      if (macroItems.length > 0) {
        const totalKcal = macroItems.reduce((s, it) => s + it.kcal, 0);
        const totalP = Math.round(macroItems.reduce((s, it) => s + it.protein, 0) * 10) / 10;
        const totalC = Math.round(macroItems.reduce((s, it) => s + it.carbs, 0) * 10) / 10;
        const totalF = Math.round(macroItems.reduce((s, it) => s + it.fat, 0) * 10) / 10;
        const first = macroItems[0];
        const summaryName =
          macroItems.length > 1
            ? `${first.name} + ${macroItems.length - 1} món`
            : first.name;
        return {
          type: 'nutrition',
          title: `Bữa ${first.slot === 'breakfast' ? 'Sáng' : first.slot === 'lunch' ? 'Trưa' : first.slot === 'dinner' ? 'Tối' : 'Phụ'}: ${summaryName} (${totalKcal} kcal · ${totalP}P · ${totalC}C · ${totalF}F)`,
          badgeLabel: 'Dinh Dưỡng ZENOX',
          badgeColor: '#ff6025',
          icon: Utensils,
          data: { items: macroItems },
        };
      }
    }

    // 4. Tasks & To-dos (e.g. "việc: gửi báo cáo trước 17h", "task mua quà sinh nhật", "nhắc nộp bài")
    if (/(?:việc|task|nhắc|làm|cần làm|deadline)/i.test(lower)) {
      const taskTitle = raw.replace(/^(?:việc|task|nhắc|cần làm|todo)[:\s]*/i, '').trim();
      const isHigh = /(?:gấp|khẩn|quan trọng|ngay)/i.test(lower);
      return {
        type: 'task',
        title: `Nhiệm vụ: ${taskTitle || raw}`,
        badgeLabel: isHigh ? 'Việc Ưu Tiên Cao' : 'Việc Cần Làm',
        badgeColor: isHigh ? '#ef4444' : '#6366f1',
        icon: CheckSquare,
        data: { title: taskTitle || raw, priority: isHigh ? 'high' : 'medium' },
      };
    }

    // 5. Pomodoro / Focus Session (e.g. "tập trung 25 phút đọc sách", "pomodoro 50p")
    const focusMatch = /(?:tập trung|pomodoro|học|làm việc sâu|focus)\s*(\d{1,3})?\s*(?:phút|p)?/i.exec(lower);
    if (focusMatch) {
      const minutes = parseInt(focusMatch[1]) || 25;
      const label = raw.replace(/(?:tập trung|pomodoro|học|focus)\s*(\d{1,3})?\s*(?:phút|p)?/i, '').trim() || 'Phiên làm việc sâu';
      return {
        type: 'focus',
        title: `Phiên tập trung: ${minutes} phút · ${label}`,
        badgeLabel: 'Deep Work',
        badgeColor: '#8b5cf6',
        icon: Timer,
        data: { minutes, label },
      };
    }

    // 6. Calendar Event (e.g. "họp lúc 14h chiều mai", "đi nha khoa 9h sáng thứ 6")
    const calParsed = parseNaturalLanguageInput(raw, currentDate);
    if (calParsed && calParsed.title && calParsed.title.length > 2) {
      return {
        type: 'calendar',
        title: `Sự kiện: "${calParsed.title}" vào ${calParsed.date} lúc ${calParsed.startTime}`,
        badgeLabel: 'Lịch Biểu',
        badgeColor: '#2563EB',
        icon: Calendar,
        data: calParsed,
      };
    }

    // 7. Fallback: Advisory Question / General Assistant
    return {
      type: 'advice',
      title: `Hỏi trợ lý: "${raw}"`,
      badgeLabel: 'Tư Vấn Cuộc Sống',
      badgeColor: '#a855f7',
      icon: Sparkles,
      data: { query: raw },
    };
  }, [input, currentDate]);

  // -------------------------------------------------------------------------
  // Executive Summary Analyzer for "Advice" Mode
  // -------------------------------------------------------------------------
  const executiveBriefing = useMemo(() => {
    const todayTasks = store.tasks.filter((t) => t.dueDate === today || !t.dueDate);
    const doneTasks = todayTasks.filter((t) => t.status === 'completed');
    const todayHealth = store.healthLogs.find((l) => l.date === today);
    const water = todayHealth?.waterMl || 0;
    const caloriesBurned = todayHealth?.caloriesBurned || 0;

    let mealCalories = 0;
    (store.meals || []).forEach((m) => {
      if (m.date === today) {
        m.items.forEach((it) => (mealCalories += it.kcal || 0));
      }
    });

    const todaySpend = store.transactions
      .filter((tx) => tx.date === today && tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);

    return {
      tasksTotal: todayTasks.length,
      tasksDone: doneTasks.length,
      waterMl: water,
      mealCalories,
      caloriesBurned,
      todaySpend,
    };
  }, [store.tasks, store.healthLogs, store.meals, store.transactions, today]);

  const calendarConflictInfo = useMemo(() => {
    if (!parsedIntent || parsedIntent.type !== 'calendar') {
      return { conflicts: [] as CalendarEvent[], suggestion: null as { startTime: string; endTime: string } | null };
    }
    const startT = calendarOverride?.startTime ?? parsedIntent.data.startTime;
    const endT = calendarOverride?.endTime ?? parsedIntent.data.endTime;
    const conflicts = findConflictingEvents(
      {
        startDate: parsedIntent.data.date,
        startTime: startT,
        endTime: endT,
        allDay: false,
      },
      events
    );
    if (conflicts.length === 0) return { conflicts: [], suggestion: null };
    const dur = Math.max(15, timeToMinutes(endT) - timeToMinutes(startT));
    const resolution = resolveNonConflictingSlot(
      parsedIntent.data.date,
      parsedIntent.data.startTime,
      dur,
      events,
      { minHour: 6, maxHour: 22, bufferMinutes: 0 }
    );
    const suggestion =
      resolution.status === 'shifted'
        ? { startTime: resolution.startTime, endTime: resolution.endTime }
        : null;
    return { conflicts, suggestion };
  }, [parsedIntent, calendarOverride, events]);

  // -------------------------------------------------------------------------
  // Execute Intent Action
  // -------------------------------------------------------------------------
  const handleExecute = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!parsedIntent) return;

    const { type, data } = parsedIntent;

    if (type === 'water') {
      const existing = store.healthLogs.find((l) => l.date === today);
      const currentWater = existing?.waterMl || 0;
      store.upsertHealthLog({
        ...(existing || { date: today, source: 'manual' }),
        waterMl: currentWater + data.ml,
        date: today,
        source: 'manual',
      });
      setSuccessMsg(`Đã ghi nhận uống thêm +${data.ml} ml nước (Tổng: ${currentWater + data.ml} ml)!`);
    } else if (type === 'finance') {
      store.addTransaction({
        date: today,
        type: data.type,
        amount: data.amount,
        category: data.categoryId,
        title: data.note,
        note: data.note,
      });
      setSuccessMsg(`Đã ghi nhận ${data.type === 'income' ? 'thu nhập' : 'chi tiêu'} ${formatMoney(data.amount, 'VND')} (${data.note})!`);
    } else if (type === 'nutrition') {
      for (const item of data.items) {
        store.addMealLog({
          date: today,
          slot: item.slot,
          description: `${item.name} (${item.amount}${item.unit})`,
          items: [
            {
              name: item.name,
              amount: item.amount,
              unit: item.unit,
              kcal: item.kcal,
              protein: item.protein,
              carbs: item.carbs,
              fat: item.fat,
            },
          ],
        });
      }
      setSuccessMsg(`Đã lưu ${data.items.length} món ăn vào nhật ký dinh dưỡng và đồng bộ calo!`);
    } else if (type === 'task') {
      store.addTask({
        title: data.title,
        priority: data.priority,
        status: 'todo',
        categoryId: 'work',
        dueDate: today,
        subtasks: [],
      });
      setSuccessMsg(`Đã tạo nhiệm vụ "${data.title}" vào danh sách việc hôm nay!`);
    } else if (type === 'focus') {
      store.addSession({
        id: `focus-${Date.now()}`,
        mode: 'pomodoro',
        phase: 'focus',
        label: data.label,
        startedAt: Date.now(),
        endedAt: Date.now() + data.minutes * 60 * 1000,
        durationSeconds: data.minutes * 60,
        completed: true,
      });
      setSuccessMsg(`Đã ghi nhận phiên tập trung ${data.minutes} phút ("${data.label}")!`);
    } else if (type === 'calendar') {
      const startTime = calendarOverride?.startTime ?? data.startTime;
      const endTime = calendarOverride?.endTime ?? data.endTime;
      onAddEvent({
        id: `usr-copilot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: data.title,
        startDate: data.date,
        startTime,
        endDate: data.date,
        endTime,
        allDay: false,
        calendarId: 'personal',
        color: '#2563EB',
        type: 'event',
        createdAt: Date.now(),
      });
      setSuccessMsg(`Đã thêm sự kiện "${data.title}" vào ngày ${data.date} lúc ${startTime}–${endTime}!`);
    }

    setActionHistory((prev) => [
      { text: parsedIntent.title, time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), type },
      ...prev.slice(0, 5),
    ]);

    setInput('');
    setCalendarOverride(null);
    setTimeout(() => {
      setSuccessMsg(null);
    }, 4500);
  };

  if (!isOpen) return null;

  const quickPrompts = [
    { label: '💧 Uống 300ml nước', text: 'Uống 300ml nước' },
    { label: '💰 Tiêu 45k ăn trưa', text: 'Tiêu 45k ăn trưa bún bò' },
    { label: '📅 Họp chiều mai 14h', text: 'Họp với đối tác lúc 14h chiều mai' },
    { label: '🥗 Cơm tấm 650 kcal', text: 'Trưa: Cơm tấm sườn 650 kcal, 35P, 70C, 20F' },
    { label: '✅ Task nộp báo cáo', text: 'Việc: nộp báo cáo tài chính trước 17h, gấp' },
    { label: '⏱️ Pomodoro 25p', text: 'Tập trung 25 phút đọc tài liệu' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-violet-600/10 via-indigo-600/10 to-blue-600/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-violet-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Siêu Trợ Lý Cuộc Sống (Life Copilot)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-600 dark:text-violet-300 border border-violet-500/30">
                  AI v2.0
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Nhập bất cứ điều gì bằng ngôn ngữ tự nhiên: Chi tiêu, Sự kiện, Bữa ăn, Nước, Việc cần làm...
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Omnibox Area */}
        <div className="p-4 sm:p-5 space-y-3.5 border-b border-slate-100 dark:border-slate-800">
          <form onSubmit={handleExecute} className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setCalendarOverride(null);
                }}
                placeholder="Ghi nhanh (vd: Tiêu 50k ăn trưa, Họp 15h mai...)"
                className="w-full text-base sm:text-sm pl-4 pr-24 sm:pr-28 py-3 rounded-2xl border-2 border-indigo-500/30 focus:border-indigo-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden transition-all shadow-inner"
              />
              <button
                type="submit"
                disabled={!parsedIntent || parsedIntent.type === 'advice'}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-3 sm:px-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-xs"
              >
                <span>Thực Hiện</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {typeof window !== 'undefined' &&
              Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) && (
                <button
                  type="button"
                  onClick={() => {
                    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                    if (!SR) return;
                    try {
                      const rec = new SR();
                      rec.lang = lang === 'vi' ? 'vi-VN' : 'en-US';
                      rec.interimResults = false;
                      rec.maxAlternatives = 1;
                      rec.onresult = (ev: any) => {
                        const transcript = ev?.results?.[0]?.[0]?.transcript;
                        if (transcript) setInput(transcript);
                      };
                      rec.start();
                    } catch {
                      // Ignore speech init errors
                    }
                  }}
                  title={lang === 'vi' ? 'Nhập nhanh bằng giọng nói' : 'Voice dictation'}
                  className="p-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 dark:text-indigo-300 shrink-0 cursor-pointer transition-colors"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
          </form>

          {/* Quick Suggestion Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              Gợi ý:
            </span>
            {quickPrompts.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setInput(p.text)}
                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 text-[11px] font-semibold transition-colors cursor-pointer shrink-0 border border-slate-200 dark:border-slate-700"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Intent Preview or Executive Briefing */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <span className="font-bold flex-1">{successMsg}</span>
            </div>
          )}

          {parsedIntent && parsedIntent.type !== 'advice' ? (
            <div className="p-4 rounded-2xl border-2 border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full text-white shadow-xs"
                  style={{ backgroundColor: parsedIntent.badgeColor }}
                >
                  {parsedIntent.badgeLabel}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  Nhấn Enter hoặc nút Thực Hiện để lưu
                </span>
              </div>

              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-white shadow-xs"
                  style={{ backgroundColor: parsedIntent.badgeColor }}
                >
                  <parsedIntent.icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {parsedIntent.type === 'calendar' && calendarOverride
                      ? `Sự kiện: "${parsedIntent.data.title}" vào ${parsedIntent.data.date} lúc ${calendarOverride.startTime}–${calendarOverride.endTime}`
                      : parsedIntent.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Hệ thống sẽ tự động đồng bộ vào mô-đun tương ứng ngay lập tức.
                  </p>
                </div>
              </div>

              {parsedIntent.type === 'calendar' && calendarConflictInfo.conflicts.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-200 space-y-2">
                  <div className="flex items-start gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      Cảnh báo trùng lịch với{' '}
                      {calendarConflictInfo.conflicts
                        .map((c) => `"${c.title}" (${c.startTime}–${c.endTime})`)
                        .join(', ')}
                    </span>
                  </div>
                  {calendarConflictInfo.suggestion && (
                    <button
                      type="button"
                      onClick={() => setCalendarOverride(calendarConflictInfo.suggestion)}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      Dời sang giờ trống gần nhất: {calendarConflictInfo.suggestion.startTime} – {calendarConflictInfo.suggestion.endTime}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Daily Life Command Center Briefing when idle or asking */
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  Bản Tin Tình Trạng Cuộc Sống Hôm Nay ({today})
                </h4>
                <span className="text-[10px] text-slate-400">Tự động cập nhật thời gian thực</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60">
                  <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Công việc</div>
                  <div className="text-base font-black text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                    {executiveBriefing.tasksDone}/{executiveBriefing.tasksTotal}
                  </div>
                  <div className="text-[9px] text-slate-400">Nhiệm vụ hoàn thành</div>
                </div>

                <div className="p-3 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60">
                  <div className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase">Lượng nước</div>
                  <div className="text-base font-black text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                    {executiveBriefing.waterMl} <span className="text-[10px] font-normal text-slate-400">ml</span>
                  </div>
                  <div className="text-[9px] text-slate-400">/ 2500 ml mục tiêu</div>
                </div>

                <div className="p-3 rounded-2xl bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/60">
                  <div className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase">Dinh dưỡng</div>
                  <div className="text-base font-black text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                    {executiveBriefing.mealCalories} <span className="text-[10px] font-normal text-slate-400">kcal</span>
                  </div>
                  <div className="text-[9px] text-slate-400">Đốt: {executiveBriefing.caloriesBurned} kcal</div>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60">
                  <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Chi tiêu hôm nay</div>
                  <div className="text-base font-black text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                    {formatMoney(executiveBriefing.todaySpend, 'VND')}
                  </div>
                  <div className="text-[9px] text-slate-400">Đã kiểm soát tốt</div>
                </div>
              </div>

              {/* Action History */}
              {actionHistory.length > 0 && (
                <div className="pt-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Nhật ký lệnh vừa thực hiện:
                  </div>
                  <div className="space-y-1.5">
                    {actionHistory.map((act, idx) => (
                      <div
                        key={idx}
                        className="p-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {act.text}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">
                          {act.time}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation Shortcuts */}
        <div className="p-3.5 px-5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-500">Chuyển nhanh mô-đun:</span>
            <button
              onClick={() => {
                onNavigate('dashboard');
                onClose();
              }}
              className="hover:text-blue-600 font-bold cursor-pointer"
            >
              Dashboard
            </button>
            <button
              onClick={() => {
                onNavigate('health');
                onClose();
              }}
              className="hover:text-orange-600 font-bold cursor-pointer"
            >
              Sức khỏe & Macro
            </button>
            <button
              onClick={() => {
                onNavigate('finance');
                onClose();
              }}
              className="hover:text-emerald-600 font-bold cursor-pointer"
            >
              Tài chính
            </button>
          </div>

          <span className="font-mono text-[10px]">ESC để đóng</span>
        </div>
      </div>
    </div>
  );
};

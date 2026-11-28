/**
 * Pre-seeded Clone Test Account for ZENOX
 * Populates an isolated account namespace (`zenox-usr-clone-test`) with realistic data
 * across Calendar conflicts, Habits/Tasks, and Fitness Phase 1–4 features.
 */
import { accountStorage } from './accountStorage';
import {
  ensureSeededVaultAccount,
  establishZenoxSession,
  setAccountSyncConsent,
  ZenoxUser,
} from './zenoxAuth';
import { formatDateString } from '../utils/calendarUtils';
import {
  DEFAULT_NUTRITION_SETTINGS,
  SEED_BODY_POINTS,
  SEED_CTG_PERIODIZED_ROADMAP,
  SEED_CTG_PROFILE,
  SEED_FOCUS_SESSIONS,
  SEED_GOALS,
  SEED_HABITS,
  SEED_HEALTH_LOGS,
  SEED_MEALS,
  SEED_PLANNED_SESSIONS,
  SEED_SPORTS,
  SEED_TASKS,
  SEED_TRANSACTIONS,
  SEED_WELLNESS,
  SEED_WORKOUTS,
  SEED_WORKOUT_SESSIONS,
} from '../data/productivitySeed';
import {
  BodyCheckPhoto,
  DEFAULT_BUDGET,
  DEFAULT_HEALTH_PROFILE,
  DailyTargetSnapshot,
  MealLog,
  WeeklyCheckinRecord,
  WorkoutSession,
} from '../types/productivity';
import { CalendarEvent } from '../types/calendar';

export const CLONE_ACCOUNT_UID = 'zenox-usr-clone-test';
export const CLONE_ACCOUNT_EMAIL = 'clone@zenox.io';
export const CLONE_ACCOUNT_PASSWORD = 'ZenoxClone2026!';
export const CLONE_ACCOUNT_NAME = 'Alex Clone (Test Full)';

function dateOffsetYmd(daysAgo: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return formatDateString(d);
}

function buildSilhouettePhotoSvg(opts: {
  badge: string;
  dateLabel: string;
  weightLabel: string;
  bfLabel: string;
  accent: string;
  waistWidth: number;
  shoulderWidth: number;
}): string {
  const { badge, dateLabel, weightLabel, bfLabel, accent, waistWidth, shoulderWidth } = opts;
  const cx = 180;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0b101d"/>
        <stop offset="100%" stop-color="#171024"/>
      </linearGradient>
    </defs>
    <rect width="360" height="480" fill="url(#bg)"/>
    <g opacity="0.16" stroke="${accent}" stroke-width="1">
      <line x1="0" y1="120" x2="360" y2="120"/>
      <line x1="0" y1="240" x2="360" y2="240"/>
      <line x1="0" y1="360" x2="360" y2="360"/>
      <line x1="180" y1="0" x2="180" y2="480"/>
    </g>
    <circle cx="${cx}" cy="92" r="28" fill="#cbd5e1" opacity="0.88"/>
    <path d="M ${cx - shoulderWidth} 145
             Q ${cx} 126 ${cx + shoulderWidth} 145
             L ${cx + waistWidth} 258
             L ${cx + waistWidth + 8} 388
             L ${cx + 18} 388
             L ${cx + 12} 285
             L ${cx - 12} 285
             L ${cx - 18} 388
             L ${cx - waistWidth - 8} 388
             L ${cx - waistWidth} 258 Z"
          fill="#94a3b8" opacity="0.82" stroke="${accent}" stroke-width="2.5"/>
    <rect x="${cx - 26}" y="198" width="22" height="18" rx="4" fill="${accent}" opacity="0.35"/>
    <rect x="${cx + 4}" y="198" width="22" height="18" rx="4" fill="${accent}" opacity="0.35"/>
    <rect x="${cx - 24}" y="222" width="20" height="18" rx="4" fill="${accent}" opacity="0.35"/>
    <rect x="${cx + 4}" y="222" width="20" height="18" rx="4" fill="${accent}" opacity="0.35"/>
    <rect x="20" y="20" width="128" height="28" rx="14" fill="${accent}"/>
    <text x="84" y="39" font-family="monospace" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="middle">${badge}</text>
    <rect x="20" y="406" width="320" height="54" rx="12" fill="#020617" fill-opacity="0.85" stroke="${accent}" stroke-opacity="0.5"/>
    <text x="36" y="429" font-family="monospace" font-size="14" font-weight="bold" fill="#f8fafc">${dateLabel}</text>
    <text x="36" y="449" font-family="monospace" font-size="13" fill="${accent}">${weightLabel}  •  ${bfLabel}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildCloneEvents(): CalendarEvent[] {
  const today = dateOffsetYmd(0);
  const tomorrow = dateOffsetYmd(-1);
  const dayAfter = dateOffsetYmd(-2);
  const now = Date.now();
  return [
    {
      id: 'clone-ev-class-1',
      title: 'Hóa (Lịch học cố định)',
      description: 'Ca học buổi chiều — dùng để test cảnh báo & tự né giờ trùng khi đồng bộ lịch tập.',
      startDate: today,
      startTime: '17:30',
      endDate: today,
      endTime: '19:00',
      allDay: false,
      calendarId: 'work',
      color: '#039BE5',
      type: 'event',
      createdAt: now - 3600_000,
    },
    {
      id: 'clone-ev-conflict-wo',
      title: '[ZENOX] Upper A — Ngực & Lưng',
      description: 'Buổi tập demo trùng giờ với Hóa để test Fix Next Queue & Sync Studio.',
      startDate: today,
      startTime: '17:30',
      endDate: today,
      endTime: '18:45',
      allDay: false,
      calendarId: 'health',
      color: '#E11D48',
      type: 'event',
      createdAt: now - 3000_000,
    },
    {
      id: 'clone-ev-class-2',
      title: 'Tiếng Anh Giao Tiếp',
      startDate: tomorrow,
      startTime: '19:00',
      endDate: tomorrow,
      endTime: '20:30',
      allDay: false,
      calendarId: 'work',
      color: '#7986CB',
      type: 'event',
      createdAt: now - 2400_000,
    },
    {
      id: 'clone-ev-deepwork',
      title: 'Deep Work: Review Code & Weekly Plan',
      startDate: dayAfter,
      startTime: '09:00',
      endDate: dayAfter,
      endTime: '11:00',
      allDay: false,
      calendarId: 'work',
      color: '#33B679',
      type: 'event',
      createdAt: now - 1800_000,
    },
  ];
}

function buildCloneMealsAndSnapshots(): {
  meals: MealLog[];
  targetSnapshots: Record<string, DailyTargetSnapshot>;
} {
  const meals: MealLog[] = [...SEED_MEALS];
  const targetSnapshots: Record<string, DailyTargetSnapshot> = {};

  // Populate 14 consecutive days so 14D Adherence + 12W Heatmap look lively
  for (let dAgo = 0; dAgo <= 13; dAgo++) {
    const dStr = dateOffsetYmd(dAgo);
    targetSnapshots[dStr] = {
      date: dStr,
      kcal: 2050,
      protein: 150,
      carbs: 210,
      fat: 65,
      goal: 'cut',
    };

    if (dAgo === 0) continue; // D(0) already has SEED_MEALS; add an evening snack below
    if (dAgo === 3) {
      // Intentional cheat/high day (>110%) so heatmap shows Amber cell
      meals.push({
        id: `clone-m-high-${dAgo}`,
        date: dStr,
        slot: 'dinner',
        time: '19:30',
        hungerScore: 4,
        satietyScore: 5,
        description: 'Tiệc nướng + cơm tấm',
        items: [
          { name: 'cơm tấm sườn', amount: 550, unit: 'g', kcal: 1350, protein: 72, carbs: 145, fat: 52 },
          { name: 'bò xào', amount: 350, unit: 'g', kcal: 1080, protein: 82, carbs: 85, fat: 40 },
        ],
        createdAt: Date.now() - dAgo * 864e5,
      });
    } else if (dAgo === 6) {
      // Intentional low day (<90%) so heatmap shows Sky cell
      meals.push({
        id: `clone-m-low-${dAgo}`,
        date: dStr,
        slot: 'lunch',
        time: '12:45',
        hungerScore: 2,
        satietyScore: 3,
        description: 'Ăn nhẹ bận rộn',
        items: [
          { name: 'ức gà', amount: 220, unit: 'g', kcal: 720, protein: 95, carbs: 45, fat: 16 },
          { name: 'cơm trắng', amount: 300, unit: 'g', kcal: 680, protein: 35, carbs: 115, fat: 8 },
        ],
        createdAt: Date.now() - dAgo * 864e5,
      });
    } else {
      // On-target 90-110% adherent days (Green cells)
      meals.push({
        id: `clone-m-ok-a-${dAgo}`,
        date: dStr,
        slot: 'lunch',
        time: '12:15',
        hungerScore: 3,
        satietyScore: 4,
        description: '250g ức gà + 300g cơm + rau xanh + dầu olive',
        items: [
          { name: 'ức gà', amount: 250, unit: 'g', kcal: 412, protein: 76, carbs: 0, fat: 9 },
          { name: 'cơm trắng', amount: 300, unit: 'g', kcal: 390, protein: 8, carbs: 84, fat: 1 },
          { name: 'chuối', amount: 150, unit: 'g', kcal: 240, protein: 4, carbs: 50, fat: 2 },
        ],
        createdAt: Date.now() - dAgo * 864e5,
      });
      meals.push({
        id: `clone-m-ok-b-${dAgo}`,
        date: dStr,
        slot: 'dinner',
        time: '19:00',
        hungerScore: 3,
        satietyScore: 5,
        description: '200g cá hồi + khoai lang + trứng',
        items: [
          { name: 'cá hồi', amount: 200, unit: 'g', kcal: 416, protein: 42, carbs: 0, fat: 26 },
          { name: 'khoai lang', amount: 280, unit: 'g', kcal: 245, protein: 5, carbs: 56, fat: 0.4 },
          { name: 'trứng', amount: 180, unit: 'g', kcal: 295, protein: 23, carbs: 2, fat: 21 },
        ],
        createdAt: Date.now() - dAgo * 864e5 + 3600_000,
      });
    }
  }

  // Bring today D(0) close to target while leaving room for Nutrient Oracle demo
  meals.push({
    id: 'clone-m-today-snack',
    date: dateOffsetYmd(0),
    slot: 'snack',
    time: '15:30',
    hungerScore: 3,
    satietyScore: 4,
    description: '1 hộp sữa chua Hy Lạp + 25g hạt óc chó',
    items: [
      { name: 'sữa chua hy lạp', amount: 170, unit: 'g', kcal: 150, protein: 16, carbs: 8, fat: 5 },
      { name: 'hạt điều', amount: 25, unit: 'g', kcal: 145, protein: 4.5, carbs: 7.5, fat: 11.5 },
    ],
    createdAt: Date.now() - 1800_000,
  });

  return { meals, targetSnapshots };
}

/**
 * Seeds all localStorage keys for the Clone Test Account (`zenox-usr-clone-test`).
 * By default only populates missing keys unless `forceReset` is true.
 */
export function seedCloneAccountData(forceReset: boolean = false): void {
  const uid = CLONE_ACCOUNT_UID;
  const write = (key: string, val: unknown) => {
    if (!forceReset && accountStorage.getItem(key, uid) !== null) return;
    accountStorage.setItem(key, JSON.stringify(val), uid);
  };

  const { meals, targetSnapshots } = buildCloneMealsAndSnapshots();
  const photos: BodyCheckPhoto[] = [
    {
      id: 'clone-photo-before',
      date: dateOffsetYmd(42),
      pose: 'front',
      weightKg: 70.8,
      bodyFatPct: 20.9,
      note: 'Mốc tuần 1 — bắt đầu siết mỡ nghiêm túc',
      photoUrl: buildSilhouettePhotoSvg({
        badge: 'BEFORE · TUẦN 1',
        dateLabel: dateOffsetYmd(42),
        weightLabel: '70.8 kg',
        bfLabel: '20.9% mỡ',
        accent: '#38BDF8',
        shoulderWidth: 56,
        waistWidth: 44,
      }),
      createdAt: Date.now() - 42 * 864e5,
    },
    {
      id: 'clone-photo-after',
      date: dateOffsetYmd(0),
      pose: 'front',
      weightKg: 67.8,
      bodyFatPct: 17.1,
      note: 'Hiện tại — giữ cơ nạc & bụng nét rõ hơn',
      photoUrl: buildSilhouettePhotoSvg({
        badge: 'AFTER · HIỆN TẠI',
        dateLabel: dateOffsetYmd(0),
        weightLabel: '67.8 kg',
        bfLabel: '17.1% mỡ',
        accent: '#F43F5E',
        shoulderWidth: 62,
        waistWidth: 33,
      }),
      createdAt: Date.now(),
    },
  ];

  const weeklyCheckins: WeeklyCheckinRecord[] = [
    {
      id: 'clone-wci-1',
      weekStart: dateOffsetYmd(13),
      weekEnd: dateOffsetYmd(7),
      createdAt: Date.now() - 7 * 864e5,
      avgWeightKg: 68.4,
      avgBodyFatPct: 17.9,
      plannedWorkoutsCount: 4,
      completedWorkoutsCount: 4,
      trainingAdherencePct: 100,
      macroAdherencePct: 86,
      proteinAdherencePct: 100,
      energyScore: 4,
      adherenceNote: 'Đổi thứ tự Pull-up trước Row, hồi phục tốt.',
      coachFeedback: 'Tuần kỷ luật xuất sắc! Giữ nguyên mức calo & tiếp tục tăng tải lũy tiến 1–2.5kg ở buổi tới.',
      photoIds: [],
    },
    {
      id: 'clone-wci-2',
      weekStart: dateOffsetYmd(6),
      weekEnd: dateOffsetYmd(0),
      createdAt: Date.now(),
      avgWeightKg: 67.8,
      avgBodyFatPct: 17.1,
      plannedWorkoutsCount: 4,
      completedWorkoutsCount: 3,
      trainingAdherencePct: 75,
      macroAdherencePct: 71,
      proteinAdherencePct: 86,
      energyScore: 4,
      adherenceNote: 'Bench press lên 72.5kg × 8 rep!',
      coachFeedback: 'Tiến độ giảm mỡ đúng tốc độ ~0.4kg/tuần. Duy trì bước chân 8.500/ngày.',
      photoIds: ['clone-photo-after'],
    },
  ];

  const workoutSessions: WorkoutSession[] = [
    ...SEED_WORKOUT_SESSIONS,
    {
      id: 'clone-wo-gap',
      date: dateOffsetYmd(5),
      title: 'Buổi Cardio + Core nhanh (Chưa điền đủ set)',
      startedAt: Date.now() - 5 * 864e5,
      finishedAt: Date.now() - 5 * 864e5 + 30 * 60_000,
      sets: [], // Intentional empty sets to showcase Phase 3 "Thiếu chi tiết hiệp" badge
    },
  ];

  const enhancedHealthLogs = [
    ...SEED_HEALTH_LOGS,
    {
      date: dateOffsetYmd(0),
      weightKg: 67.8,
      bodyFatPct: 17.1,
      steps: 7850,
      waterMl: 2100,
      sleepHours: 7.5,
      restingHrBpm: 58,
      stressScore: 2,
      source: 'manual' as const,
    },
  ];

  write('gcal_events', buildCloneEvents());
  write('gcal_prod_tasks', SEED_TASKS);
  write('gcal_prod_goals', SEED_GOALS);
  write('gcal_prod_focus_sessions', SEED_FOCUS_SESSIONS);
  write('gcal_prod_transactions', SEED_TRANSACTIONS);
  write('gcal_prod_budget', DEFAULT_BUDGET);
  write('gcal_prod_health_logs', enhancedHealthLogs);
  write('gcal_prod_workouts', SEED_WORKOUTS);
  write('gcal_prod_wellness', SEED_WELLNESS);
  write('gcal_prod_health_profile', { ...DEFAULT_HEALTH_PROFILE, dailySteps: 8500 });
  write('gcal_prod_habits', SEED_HABITS);
  write('gcal_ctg_profile', {
    ...SEED_CTG_PROFILE,
    name: CLONE_ACCOUNT_NAME,
    email: CLONE_ACCOUNT_EMAIL,
    stepGoal: 8500,
  });
  write('gcal_ctg_body_points', SEED_BODY_POINTS);
  write('gcal_ctg_planned_sessions', SEED_PLANNED_SESSIONS);
  write('gcal_ctg_workout_sessions', workoutSessions);
  write('gcal_ctg_sports', SEED_SPORTS);
  write('gcal_ctg_meals', meals);
  write('gcal_ctg_nutrition_settings', {
    ...DEFAULT_NUTRITION_SETTINGS,
    appliedTdeeKcal: 2350,
    appliedTdeeAt: dateOffsetYmd(10),
    appliedTdeeStartWeightKg: 68.4,
    targetSnapshots,
    hideCaloriesMode: false,
    customRecipes: [
      {
        id: 'clone-recipe-1',
        name: 'Bữa sáng Overnight Oats Whey (3 phần)',
        servings: 3,
        createdAt: Date.now() - 864e5,
        ingredients: [
          { name: 'yến mạch', amount: 180, unit: 'g', kcal: 699, protein: 30, carbs: 118, fat: 12 },
          { name: 'whey protein', amount: 90, unit: 'g', kcal: 360, protein: 72, carbs: 6, fat: 3 },
          { name: 'chuối', amount: 300, unit: 'g', kcal: 267, protein: 3.3, carbs: 69, fat: 1 },
        ],
      },
    ],
  });
  write('gcal_prod_body_photos', photos);
  write('gcal_ctg_weekly_checkins', weeklyCheckins);
  write('gcal_prod_saved_roadmaps', []);
  write('gcal_ctg_periodized_roadmap', SEED_CTG_PERIODIZED_ROADMAP);
  write('gcal_ctg_saved_roadmaps', [SEED_CTG_PERIODIZED_ROADMAP]);
  write('gcal_prod_custom_exercises', []);
  write('gcal_prod_exercise_cues', {
    'bench-press': 'Ép bả vai xuống ghế, kiểm soát hạ tạ 3 giây chạm nhẹ ngực dưới.',
    'back-squat': 'Hít sâu nén hơi vào bụng (brace), giữ gót chân bám chắc sàn.',
  });
}

/**
 * Registers (if missing), seeds all workspace data, and establishes an authenticated session
 * for the Clone Test Account.
 */
export async function loginCloneDemoAccount(forceReset: boolean = false): Promise<ZenoxUser> {
  await ensureSeededVaultAccount({
    id: CLONE_ACCOUNT_UID,
    name: CLONE_ACCOUNT_NAME,
    email: CLONE_ACCOUNT_EMAIL,
    password: CLONE_ACCOUNT_PASSWORD,
  });
  seedCloneAccountData(forceReset);
  setAccountSyncConsent(CLONE_ACCOUNT_UID, CLONE_ACCOUNT_EMAIL, 'declined');
  return establishZenoxSession(
    {
      uid: CLONE_ACCOUNT_UID,
      displayName: CLONE_ACCOUNT_NAME,
      email: CLONE_ACCOUNT_EMAIL,
      photoURL: null,
    },
    'zenox_vault',
    true
  );
}

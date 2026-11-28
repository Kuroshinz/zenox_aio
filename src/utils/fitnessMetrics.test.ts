import {
  bmi,
  bmiLabel,
  bmr,
  calorieTarget,
  deltaSummary,
  etaWeeks,
  fatMassKg,
  ffmi,
  ffmiCategory,
  gymCalories,
  leanMassKg,
  macroTargets,
  parseFoodText,
  sportCalories,
  tdee,
  calculateNavyBodyFat,
  calculate1RM,
  calculateBarbellPlates,
  calculateDailyHealthScore,
  VIETNAMESE_FOOD_CATALOG,
  BALANCED_MEAL_COMBOS,
  generateCtgPeriodizedRoadmap,
  calculatePhaseNutrition,
  calculateCronometerNutrientScores,
  calculateMuscleVolumeLandmarks,
  compareProgressiveOverload,
  getExerciseHistoryDrilldown,
  getSwapCandidatesForExercise,
  findSessionDetailGaps,
  isDateInAwayPeriod,
  calculateMacroConsistencyHeatmap,
  buildWeeklyCheckinDraft,
  resolveAutoPhaseTransition,
  calculatePhaseJourneyHeatmap,
  buildJourneyCalendarPeriod,
} from './fitnessMetrics';
import { BodyPoint, CtgProfile, HealthDayLog, MealLog, NutritionSettings, SetLog, SportSession, WorkoutSession } from '../types/productivity';

const mockProfile: CtgProfile = {
  name: 'Test User',
  sex: 'male',
  age: 24,
  heightCm: 172,
  goal: 'cut',
  activity: 'moderate',
  targetWeightKg: 65,
  targetBodyFatPct: 12,
  stepGoal: 8000,
};

const mockSettings: NutritionSettings = {
  overrides: {},
  tdeeOffset: 0,
};

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Running fitness metrics tests...');

// 1. BMI & InBody formulas
const testBmi = bmi(68, 172);
assert(testBmi === 23, `Expected BMI 23, got ${testBmi}`);
assert(bmiLabel(testBmi) === 'Bình thường', 'BMI label should be Bình thường');

const fatKg = fatMassKg(70, 20);
assert(fatKg === 14, `Expected fat 14kg, got ${fatKg}`);
const leanKg = leanMassKg(70, 20);
assert(leanKg === 56, `Expected lean 56kg, got ${leanKg}`);

const testFfmi = ffmi(70, 20, 172);
assert(testFfmi > 18 && testFfmi < 20, `Expected realistic FFMI, got ${testFfmi}`);
const ffmiCat = ffmiCategory(testFfmi, 'male');
assert(ffmiCat.label.length > 0, 'FFMI category should have label');

// 2. BMR & TDEE (Mifflin–St Jeor)
// 10 * 68 + 6.25 * 172 - 5 * 24 + 5 = 680 + 1075 - 120 + 5 = 1640
const userBmr = bmr(mockProfile, 68);
assert(userBmr === 1640, `Expected BMR 1640, got ${userBmr}`);

const userTdee = tdee(mockProfile, 68);
assert(userTdee === Math.round(1640 * 1.55), `Expected TDEE around 2542, got ${userTdee}`);

const cutTarget = calorieTarget(userTdee, 'cut');
assert(cutTarget === Math.round(userTdee * 0.85), `Expected cut target 85%, got ${cutTarget}`);

// 3. Macro targets
const macros = macroTargets(2000, 70, 'cut', mockSettings);
assert(macros.protein === 140, `Cut protein should be 70*2 = 140g, got ${macros.protein}`);
assert(macros.fat > 0, 'Fat should be > 0');
assert(macros.carbs > 0, 'Carbs should be > 0');

// 4. Sport & Gym calories
const runSport: SportSession = {
  id: 's1',
  date: '2026-11-05',
  type: 'running',
  durationMin: 30,
  createdAt: Date.now(),
};
const runKcal = sportCalories(runSport, 70);
assert(runKcal > 200 && runKcal < 400, `Expected run kcal around 360, got ${runKcal}`);

const gymSets: SetLog[] = [
  { id: '1', exerciseId: 'bench-press', setIndex: 0, weightKg: 70, reps: 10 },
  { id: '2', exerciseId: 'bench-press', setIndex: 1, weightKg: 70, reps: 10 },
];
const gymKcal = gymCalories(gymSets, 70);
assert(gymKcal > 20, `Expected gym kcal > 20, got ${gymKcal}`);

// 5. Delta summary & ETA
const points: BodyPoint[] = [
  { id: '1', date: '2026-10-01', weightKg: 72, bodyFatPct: 22, createdAt: 1 },
  { id: '2', date: '2026-10-29', weightKg: 68, bodyFatPct: 18, createdAt: 2 },
];
const delta = deltaSummary(points, 172);
assert(delta !== null, 'Delta summary should not be null');
assert(delta!.weightKg === -4, `Expected -4kg, got ${delta!.weightKg}`);
assert(delta!.weightRate < 0, 'Weight rate should be negative');

const eta = etaWeeks(68, 65, delta!.weightRate);
assert(typeof eta === 'number' && eta > 0, `ETA should be a positive number of weeks, got ${eta}`);

// 6. Food text parser
const parsed = parseFoodText('200g ức gà + 250g cơm trắng + 1 chuối');
assert(parsed.length === 3, `Expected 3 parsed items, got ${parsed.length}`);
assert(parsed[0].item.name.includes('ức gà'), 'Item 0 should be ức gà');
assert(parsed[0].item.amount === 200, 'Item 0 amount should be 200');
assert(parsed[0].recognised === true, 'Item 0 should be recognised');
assert(parsed[0].item.protein > 50, '200g chicken breast should have > 50g protein');

// 7. US Navy Body Fat
const maleBf = calculateNavyBodyFat('male', 175, 82, 38);
assert(maleBf > 10 && maleBf < 20, `Expected realistic male Navy BF, got ${maleBf}`);
const femaleBf = calculateNavyBodyFat('female', 162, 70, 32, 95);
assert(femaleBf > 15 && femaleBf < 30, `Expected realistic female Navy BF, got ${femaleBf}`);

// 8. 1RM & Barbell Plates
const maxBench = calculate1RM(80, 6);
assert(maxBench.oneRepMax > 90 && maxBench.oneRepMax < 100, `Expected 1RM ~93-96kg, got ${maxBench.oneRepMax}`);
assert(maxBench.percentages.length === 9, 'Should have 9 percentage tiers');

const plateCalc = calculateBarbellPlates(90, 20); // 70kg / 2 = 35kg per side -> 20 + 15
assert(plateCalc.loadedPerSideKg === 35, `Expected 35kg per side, got ${plateCalc.loadedPerSideKg}`);
assert(plateCalc.platesPerSide.length === 2, `Expected 2 plates per side, got ${plateCalc.platesPerSide.length}`);
assert(plateCalc.platesPerSide[0].plateKg === 20, 'First plate should be 20kg');
assert(plateCalc.platesPerSide[1].plateKg === 15, 'Second plate should be 15kg');

// 9. Vietnamese Catalog & Combos
assert(VIETNAMESE_FOOD_CATALOG.length >= 20, 'Catalog should have at least 20 items');
assert(BALANCED_MEAL_COMBOS.length >= 3, 'Should have at least 3 balanced combos');

// 10. Daily Health Score
const testDayLog: HealthDayLog = {
  date: '2026-11-05',
  steps: 8500,
  waterMl: 2600,
  sleepHours: 7.5,
  protein: 150,
  caloriesBurned: 2200,
  source: 'manual',
};
const healthScore = calculateDailyHealthScore(testDayLog, 8000, 2500, 2000, 140);
assert(healthScore.score >= 90, `Expected score >= 90, got ${healthScore.score}`);
assert(healthScore.status === 'excellent', `Expected excellent status, got ${healthScore.status}`);

// 11. ZENOX 17-Phase Master Periodized Roadmap
import { SEED_CTG_PERIODIZED_ROADMAP } from '../data/productivitySeed';
import { parseVnDate, getPhaseStatus } from '../components/productivity/fitness/RoadmapTab';

assert(SEED_CTG_PERIODIZED_ROADMAP.phases.length === 17, 'Should have exactly 17 ZENOX phases');
const p1 = SEED_CTG_PERIODIZED_ROADMAP.phases[0];
assert(p1.name === 'Giảm mỡ' && p1.startWeightKg === 63.55 && p1.targetWeightKg === 61.35, 'Phase 1 checks');
assert(p1.macros.protein === 141 && p1.targetKcal === 1606, 'Phase 1 nutrition checks');

const p2 = SEED_CTG_PERIODIZED_ROADMAP.phases[1];
assert(p2.name === 'Tăng cơ' && p2.isCurrent === true, 'Phase 2 should be active/current');
assert(p2.startWeightKg === 61.35 && p2.targetWeightKg === 65.81, 'Phase 2 weight checks');
assert(p2.macros.protein === 110 && p2.macros.carbs === 310 && p2.macros.fat === 69 && p2.targetKcal === 2302, 'Phase 2 macro checks');

const pFinal = SEED_CTG_PERIODIZED_ROADMAP.phases[16];
assert(pFinal.name === 'Giảm mỡ hoàn thiện' && pFinal.targetWeightKg === 81.23 && pFinal.targetFfmi === 22.0, 'Final phase checks');

// Net LBM growth check: 68.2kg LBM - 52.4kg LBM = 15.8kg pure muscle gain!
const netLbmGrowth = Math.round((pFinal.targetLbmKg - p1.startLbmKg) * 10) / 10;
assert(netLbmGrowth === 15.8, `Expected +15.8kg LBM growth, got ${netLbmGrowth}`);

// Date parse helper check
const parsedD = parseVnDate('24/10/2026');
assert(parsedD.getDate() === 24 && parsedD.getMonth() === 9 && parsedD.getFullYear() === 2026, 'parseVnDate should parse DD/MM/YYYY');
const parsedD2 = parseVnDate('25/12/2026');
assert(parsedD2.getDate() === 25 && parsedD2.getMonth() === 11 && parsedD2.getFullYear() === 2026, 'parseVnDate should parse 25/12/2026');
assert(!isNaN(parsedD2.getTime()), 'parseVnDate timestamp must not be NaN');
const parsedEmpty = parseVnDate('');
assert(isNaN(parsedEmpty.getTime()), 'parseVnDate on empty should return invalid date');

const phaseStatus = getPhaseStatus(p2, 'ctg-p2');
assert(phaseStatus === 'current', 'Phase 2 should report current status');

// 12. Dynamic ZENOX Roadmap Generation for Any Height, Weight, Body Fat & Sex
const customRoadmapMale = generateCtgPeriodizedRoadmap({
  sex: 'male',
  heightCm: 180,
  currentWeightKg: 78,
  currentBodyFatPct: 20,
  targetFfmi: 22.0,
});
assert(customRoadmapMale.phases.length > 5, 'Should generate multiple waves for 180cm/78kg male');
assert(customRoadmapMale.heightCm === 180, 'Height should be stored');
assert(customRoadmapMale.phases[0].phaseType === 'cut', 'Initial phase should be cut since 20% > 16%');
assert(
  customRoadmapMale.phases[customRoadmapMale.phases.length - 1].phaseType === 'final_cut',
  'Last phase should be final_cut'
);
const lastPhaseMale = customRoadmapMale.phases[customRoadmapMale.phases.length - 1];
assert(lastPhaseMale.targetLbmKg > customRoadmapMale.phases[0].startLbmKg, 'Net LBM should increase significantly');

// Test female generation
const customRoadmapFemale = generateCtgPeriodizedRoadmap({
  sex: 'female',
  heightCm: 160,
  currentWeightKg: 54,
  currentBodyFatPct: 24,
  targetFfmi: 19.5,
});
assert(customRoadmapFemale.phases.length > 3, 'Should generate roadmap for female 160cm');
assert(customRoadmapFemale.phases[0].phaseType === 'cut', 'Initial cut for female at 24%');

// Test phase nutrition calculator
const bulkNut = calculatePhaseNutrition('male', 175, 70, 'bulk');
assert(bulkNut.targetKcal > 2000, 'Bulk kcal should be surplus');
assert(bulkNut.protein >= 120, 'Bulk protein should be high');
assert(bulkNut.fat > 50 && bulkNut.carbs > 150, 'Macros should be balanced');

const minicutNut = calculatePhaseNutrition('male', 175, 70, 'minicut');
assert(minicutNut.targetKcal < bulkNut.targetKcal, 'Minicut kcal should be significantly lower than bulk');
assert(minicutNut.protein > bulkNut.protein, 'Minicut protein should be higher to spare muscle');


// 13. ZENOX Adaptive Metabolism & Trend Weight Tests
import {
  calculateAdaptiveTDEE,
  calculateTrendWeights,
  calculateProteinDistribution,
  calculateMicronutrientSummary,
  calculateCarbCyclingTargets,
  calculateDailyEnergyBalance,
  calculateWeightWindowStats,
  calculateThreeTierTdee,
  generateHealthFixNextActions,
  recommendFoodsForNutrient,
  evaluateMicronutrientUpperLimits,
  calculateRecipePerServing,
  calculateMacroAdherenceReport,
} from './fitnessMetrics';

const mockPointsForTrend: BodyPoint[] = [
  { id: 'p1', date: '2026-11-01', weightKg: 68.5, bodyFatPct: 18.2, createdAt: 1 },
  { id: 'p2', date: '2026-11-04', weightKg: 68.2, bodyFatPct: 18.0, createdAt: 2 },
  { id: 'p3', date: '2026-11-08', weightKg: 67.9, bodyFatPct: 17.8, createdAt: 3 },
  { id: 'p4', date: '2026-11-12', weightKg: 67.7, bodyFatPct: 17.6, createdAt: 4 },
];

const trendResult = calculateTrendWeights(mockPointsForTrend);
assert(trendResult.currentRaw === 67.7, 'Current raw weight should match latest');
assert(trendResult.currentTrend > 67.0 && trendResult.currentTrend < 68.5, 'Trend weight should be smoothed');
assert(trendResult.weeklyRateKg < 0, 'Trend weekly rate should be negative indicating fat loss');

// Adaptive TDEE
const mockRecentMeals: MealLog[] = [
  {
    id: 'm1',
    date: '2026-11-10',
    slot: 'lunch',
    description: 'Ức gà và cơm',
    items: [{ name: 'Ức gà', amount: 200, unit: 'g', kcal: 650, protein: 48, carbs: 70, fat: 12 }],
    createdAt: 1,
  },
  {
    id: 'm2',
    date: '2026-11-11',
    slot: 'dinner',
    description: 'Thịt bò và khoai',
    items: [{ name: 'Bò bít tết', amount: 200, unit: 'g', kcal: 750, protein: 50, carbs: 65, fat: 22 }],
    createdAt: 2,
  },
];

const adaptiveTdee = calculateAdaptiveTDEE(mockRecentMeals, mockPointsForTrend, 2400, 'bulk');
assert(adaptiveTdee.adaptiveTdee > 1800 && adaptiveTdee.adaptiveTdee < 3500, 'Adaptive TDEE should be in healthy range');
assert(adaptiveTdee.recommendedCaloTarget > 0, 'Recommended target must be > 0');

// Protein distribution & Leucine trigger
const mpsResult = calculateProteinDistribution(mockRecentMeals, 140, 56);
assert(mpsResult.totalProteinGrams === 98, 'Total protein should match sum of meals');
assert(mpsResult.successfulMpsTriggers >= 2, 'Both 48g and 50g meals should hit the MPS threshold (>=25g)');

// Micronutrients
const microSummary = calculateMicronutrientSummary(mockRecentMeals, 2500);
assert(microSummary.waterMl === 2500, 'Water should be 2500ml');
assert(microSummary.fiberGrams > 0, 'Should estimate realistic fiber');

// Carb Cycling
const carbCycling = calculateCarbCyclingTargets(2200, 150, 250, 60);
assert(carbCycling.trainingDay.carbs > carbCycling.restDay.carbs, 'Training day must have more carbs than rest day');
assert(carbCycling.refeedDay.fat <= 30, 'Refeed day must have ultra-low fat');

// Cronometer Nutrient Scores Test
const cronoScores = calculateCronometerNutrientScores(mockRecentMeals, 2800, 150);
assert(cronoScores.potassiumMg > 500, 'Potassium should be estimated from foods');
assert(cronoScores.magnesiumMg > 50, 'Magnesium should be estimated from foods');
assert(cronoScores.electrolyteScorePct >= 0 && cronoScores.electrolyteScorePct <= 100, 'Electrolyte score between 0-100');
assert(cronoScores.recoveryScorePct >= 0 && cronoScores.recoveryScorePct <= 100, 'Recovery score between 0-100');
assert(cronoScores.vitalityScorePct >= 0 && cronoScores.vitalityScorePct <= 100, 'Vitality score between 0-100');

// Muscle Volume Landmarks Test
const mockWorkouts: WorkoutSession[] = [
  {
    id: 'w1',
    date: '2026-11-18',
    title: 'Chest & Back Hypertrophy',
    startedAt: Date.now() - 2 * 86400000,
    sets: [
      { id: 's1', exerciseId: 'bench-press', setIndex: 1, weightKg: 80, reps: 8 },
      { id: 's2', exerciseId: 'bench-press', setIndex: 2, weightKg: 80, reps: 8 },
      { id: 's3', exerciseId: 'bench-press', setIndex: 3, weightKg: 80, reps: 7 },
      { id: 's4', exerciseId: 'barbell-row', setIndex: 1, weightKg: 70, reps: 10 },
      { id: 's5', exerciseId: 'barbell-row', setIndex: 2, weightKg: 70, reps: 10 },
    ],
  },
];

const volumeLandmarks = calculateMuscleVolumeLandmarks(mockWorkouts, 7);
assert(volumeLandmarks.length >= 7, 'Should compute volume for all major muscle groups');
const chestVolume = volumeLandmarks.find((v) => v.muscle === 'chest');
assert(chestVolume !== undefined && chestVolume.currentSets === 3, 'Chest should have 3 recorded sets');
assert(chestVolume !== undefined && chestVolume.mavSets === 14, 'Chest MAV should be 14 sets');

// Progressive Overload Comparison Test
const overloadComp = compareProgressiveOverload(
  'bench-press',
  [{ weightKg: 82.5, reps: 8 }],
  mockWorkouts,
  'Barbell Bench Press'
);
assert(overloadComp.hasPreviousData === true, 'Should find previous bench press data');
assert(overloadComp.weightDeltaKg === 2.5, 'Weight delta should be +2.5kg');
assert(overloadComp.isNewPr === true, 'Increased weight with same reps should be a new PR');
assert(overloadComp.status === 'improved', 'Status should be improved');

// 14. Phase 1 Tests: Cronometer Energy Balance, Tracked 10D Weight Band, CTG 3-Tier TDEE & Fix Next
const phaseBalance = calculateDailyEnergyBalance({
  date: '2026-11-10',
  weightKg: 70,
  bodyFatPct: 15,
  meals: mockRecentMeals,
  workoutSessions: [
    {
      id: 'wo-day',
      date: '2026-11-10',
      title: 'Push',
      startedAt: Date.now() - 3600000,
      sets: [{ id: 's1', exerciseId: 'bench-press', setIndex: 1, weightKg: 80, reps: 8 }],
    },
  ],
  healthLogs: [{ date: '2026-11-10', steps: 10000, source: 'manual' }],
  targetKcal: 2100,
});
assert(phaseBalance.consumedKcal === 650, 'Energy balance consumed should match meals on 2026-11-10');
assert(phaseBalance.tefKcal === 65, 'TEF should be ~10% of consumed calories');
assert(phaseBalance.stepsBurnKcal === 400, '10,000 steps at 70kg should burn ~400 kcal');
assert(phaseBalance.exerciseBurnKcal > 0, 'Workout session should contribute exercise burn');
assert(phaseBalance.totalBurnedKcal > phaseBalance.bmrKcal + 465, 'Total burn includes BMR + NEAT + steps + workout + TEF');

const weightBand = calculateWeightWindowStats(mockPointsForTrend, [], 70, '2026-11-12');
assert(weightBand.tenDayHighKg === 68.2, '10-day high from Nov 3..Nov 12 should be 68.2kg');
assert(weightBand.tenDayLowKg === 67.7, '10-day low should be 67.7kg');
assert(weightBand.currentEmaKg > 67.7 && weightBand.currentEmaKg < 68.5, 'EMA should be smoothed');

const threeTier = calculateThreeTierTdee({
  profile: {
    name: 'Test',
    age: 26,
    sex: 'male',
    heightCm: 175,
    goal: 'cut',
    activity: 'moderate',
    targetWeightKg: 66,
    targetBodyFatPct: 12,
    stepGoal: 8000,
  },
  weightKg: 70,
  bodyFatPct: 15,
  goal: 'cut',
  meals: mockRecentMeals,
  bodyPoints: mockPointsForTrend,
  healthLogs: [{ date: '2026-11-10', steps: 10000, source: 'manual' }],
});
assert(threeTier.inferredTdee >= threeTier.lowerBoundKcal, 'Inferred TDEE must respect 0.5*BMR lower bound');
assert(threeTier.inferredTdee <= threeTier.upperBoundKcal, 'Inferred TDEE must respect 4.0*BMR upper bound');
assert(threeTier.recommendedTargetKcal >= threeTier.bmrKcal, 'Recommended cut target must protect BMR floor');

const fixActions = generateHealthFixNextActions({
  todayStr: '2026-11-28',
  dayMeals: mockRecentMeals.filter((m) => m.date === '2026-11-10'),
  targetProteinG: 160,
  targetKcal: 2100,
  plannedSessions: [
    { id: 'ps1', weekIndex: 1, dayIndex: 0, dayOfWeek: 'Thứ 2', title: 'Push', prescriptions: [{ exerciseId: 'bench-press', sets: 2, reps: '8', rpe: 8, restSeconds: 90 }] },
  ],
  bodyPoints: mockPointsForTrend,
  calendarEvents: [
    {
      id: 'ctg-workout-1',
      title: '[ZENOX] Push',
      startDate: '2026-11-29',
      endDate: '2026-11-29',
      startTime: '17:30',
      endTime: '18:45',
      allDay: false,
      calendarId: 'health',
      color: '#E11D48',
      type: 'event',
      createdAt: 1,
    },
    {
      id: 'cls-1',
      title: 'Lớp Hóa',
      startDate: '2026-11-29',
      endDate: '2026-11-29',
      startTime: '17:30',
      endTime: '19:00',
      allDay: false,
      calendarId: 'work',
      color: '#2563EB',
      type: 'event',
      createdAt: 2,
    },
  ],
});
assert(fixActions.some((a) => a.id === 'fix-workout-conflict'), 'Fix Next should surface upcoming workout-calendar collision');
assert(fixActions.some((a) => a.id === 'fix-below-mev'), 'Fix Next should surface under-MEV muscle warning');
assert(fixActions.some((a) => a.id === 'fix-stale-checkin'), 'Fix Next should surface stale body check-in (>7d)');

// 15. Phase 2 Tests: Cronometer Nutrient Oracle, UL Guard, Recipe Builder & CTG 90-110% Adherence
const oracleMg = recommendFoodsForNutrient('magnesium', 500, 5);
assert(oracleMg.length >= 1, 'Oracle must suggest magnesium-rich foods from Vietnamese catalog');
assert(oracleMg[0].estimatedAmount > 0 && oracleMg[0].densityPer100Kcal > 0, 'Oracle ranking scores must be positive');

const ulMeals: MealLog[] = [
  {
    id: 'ul-1',
    date: '2026-11-28',
    slot: 'lunch',
    description: 'Mặn & ngọt quá mức',
    items: [
      {
        name: 'Phở mặn + trà sữa',
        amount: 600,
        unit: 'g',
        kcal: 900,
        protein: 30,
        carbs: 110,
        fat: 25,
        sodium: 2900,
        sugar: 65,
      },
    ],
    createdAt: 1,
  },
];
const ulAlerts = evaluateMicronutrientUpperLimits(ulMeals);
assert(ulAlerts.some((a) => a.nutrient.includes('Natri')), 'Should warn when sodium exceeds 2300mg UL');
assert(ulAlerts.some((a) => a.nutrient.includes('Đường')), 'Should warn when sugar exceeds 50g');

const recipeCalc = calculateRecipePerServing({
  name: 'Cơm ức gà 4 phần',
  servings: 4,
  items: [
    { name: 'Ức gà áp chảo', amount: 800, unit: 'g', kcal: 1200, protein: 200, carbs: 0, fat: 28 },
    { name: 'Cơm gạo lứt', amount: 800, unit: 'g', kcal: 880, protein: 20, carbs: 180, fat: 8 },
  ],
});
assert(recipeCalc.totalKcal === 2080, 'Recipe total kcal should sum all ingredients');
assert(recipeCalc.perServingItem.kcal === 520, 'Per-serving kcal should divide evenly by servings');
assert(recipeCalc.perServingItem.protein === 55, 'Per-serving protein should divide evenly by servings');

const adherenceReport = calculateMacroAdherenceReport({
  meals: [
    {
      id: 'ad-1',
      date: '2026-11-26',
      slot: 'lunch',
      description: 'Đúng mục tiêu cũ 2000',
      items: [{ name: 'Bữa 1', amount: 500, unit: 'g', kcal: 1980, protein: 145, carbs: 200, fat: 60 }],
      createdAt: 1,
    },
    {
      id: 'ad-2',
      date: '2026-11-27',
      slot: 'lunch',
      description: 'Vượt mục tiêu',
      items: [{ name: 'Bữa 2', amount: 600, unit: 'g', kcal: 2600, protein: 150, carbs: 300, fat: 80 }],
      createdAt: 2,
    },
  ],
  currentTargets: { kcal: 2400, protein: 160 },
  targetSnapshots: {
    '2026-11-26': { date: '2026-11-26', kcal: 2000, protein: 150, carbs: 200, fat: 60, goal: 'cut' },
    '2026-11-27': { date: '2026-11-27', kcal: 2000, protein: 150, carbs: 200, fat: 60, goal: 'cut' },
  },
  referenceDateStr: '2026-11-28',
  windowDays: 14,
});
assert(adherenceReport.loggedDays === 2, 'Should evaluate both logged days');
assert(adherenceReport.inRangeDays === 1, 'Nov 26 (1980 vs locked 2000) must count as within 90-110% despite current target 2400');
assert(adherenceReport.aboveRangeDays === 1, 'Nov 27 (2600 vs locked 2000) must count as >110%');
assert(adherenceReport.proteinMetDays === 2, 'Both days meet >=90% of locked 150g protein target');

// ── Phase 3: Secondary Muscle Volume + E1RM Drilldown + Swap Candidates + Session Detail Gaps ──
const volumeSessions: WorkoutSession[] = [
  {
    id: 'vol-s1',
    date: new Date().toISOString().slice(0, 10),
    title: 'Push Day',
    startedAt: Date.now() - 3600_000,
    finishedAt: Date.now(),
    sets: [
      { id: 'v1', exerciseId: 'bench-press', setIndex: 0, weightKg: 80, reps: 8 },
      { id: 'v2', exerciseId: 'bench-press', setIndex: 1, weightKg: 80, reps: 8 },
      { id: 'v3', exerciseId: 'bench-press', setIndex: 2, weightKg: 80, reps: 6 },
    ],
  },
];
const phase3VolumeLandmarks = calculateMuscleVolumeLandmarks(volumeSessions, 7);
const chestVol = phase3VolumeLandmarks.find((v) => v.muscle === 'chest');
const shoulderVol = phase3VolumeLandmarks.find((v) => v.muscle === 'shoulders');
const armsVol = phase3VolumeLandmarks.find((v) => v.muscle === 'arms');
assert(chestVol?.currentSets === 3, `Expected 3 primary chest sets, got ${chestVol?.currentSets}`);
assert((shoulderVol?.currentSets ?? 0) === 1.5, `Expected 1.5 fractional shoulder sets from bench-press, got ${shoulderVol?.currentSets}`);
assert((armsVol?.currentSets ?? 0) === 1.5, `Expected 1.5 fractional arms sets from bench-press, got ${armsVol?.currentSets}`);

const drilldownSessions: WorkoutSession[] = [
  {
    id: 'd-1',
    date: '2026-11-20',
    title: 'Upper A',
    startedAt: 1000,
    finishedAt: 2000,
    sets: [
      { id: 'ds1', exerciseId: 'bench-press', setIndex: 0, weightKg: 60, reps: 10, setType: 'warmup' },
      { id: 'ds2', exerciseId: 'bench-press', setIndex: 1, weightKg: 80, reps: 6 },
    ],
  },
  {
    id: 'd-2',
    date: '2026-11-27',
    title: 'Upper B',
    startedAt: 3000,
    finishedAt: 4000,
    sets: [
      { id: 'ds3', exerciseId: 'bench-press', setIndex: 0, weightKg: 85, reps: 6 },
    ],
  },
];
const benchDrilldown = getExerciseHistoryDrilldown('bench-press', drilldownSessions);
assert(benchDrilldown.totalSessionsCount === 2, 'Drilldown should track 2 sessions');
assert(benchDrilldown.totalWorkingSets === 2, 'Drilldown should ignore warmup set when counting working sets');
assert(benchDrilldown.maxWeightKg === 85, 'Max weight should be 85 kg');
const expectedE1rm1 = Math.round(calculate1RM(80, 6).oneRepMax * 10) / 10;
const expectedE1rm2 = Math.round(calculate1RM(85, 6).oneRepMax * 10) / 10;
const expectedE1rmDelta = Math.round((expectedE1rm2 - expectedE1rm1) * 10) / 10;
assert(benchDrilldown.bestOneRmKg === expectedE1rm2, `Best E1RM (85 x 6) should be ${expectedE1rm2}, got ${benchDrilldown.bestOneRmKg}`);
assert(benchDrilldown.latestOneRmDeltaKg === expectedE1rmDelta, `Latest E1RM delta should be ${expectedE1rmDelta}, got ${benchDrilldown.latestOneRmDeltaKg}`);

const swapCandidates = getSwapCandidatesForExercise('bench-press', [], ['incline-db-press']);
assert(swapCandidates.length > 0, 'Should return swap candidates for bench-press');
assert(!swapCandidates.some((c) => c.id === 'bench-press' || c.id === 'incline-db-press'), 'Should exclude source and excluded exercises');
assert(swapCandidates[0].muscle === 'chest', 'First swap candidate should prioritize same primary muscle (chest)');

const gapIds = findSessionDetailGaps([
  { id: 'good-session', date: '2026-11-27', title: 'OK', startedAt: 1, sets: [{ id: 's1', exerciseId: 'bench-press', setIndex: 0, weightKg: 80, reps: 8 }] },
  { id: 'empty-session', date: '2026-11-26', title: 'Empty', startedAt: 1, sets: [] },
  { id: 'zero-session', date: '2026-11-25', title: 'Zero', startedAt: 1, sets: [{ id: 's2', exerciseId: 'bench-press', setIndex: 0, weightKg: 0, reps: 0 }] },
]);
assert(!gapIds.has('good-session'), 'Session with valid weighted sets should not be flagged');
assert(gapIds.has('empty-session') && gapIds.has('zero-session'), 'Empty or zeroed sessions must be flagged for detail gaps');

// ── Phase 4: Away Mode, 12-Week Macro Heatmap & Weekly Check-in Inbox ──
const sampleAwayMode = {
  enabled: true,
  startDate: '2026-11-26',
  endDate: '2026-11-28',
  reason: 'Du lịch Đà Nẵng',
  preserveStreaks: true,
};
assert(isDateInAwayPeriod('2026-11-27', sampleAwayMode) === true, 'Date inside Away window must return true');
assert(isDateInAwayPeriod('2026-11-24', sampleAwayMode) === false, 'Date outside Away window must return false');

const heatmapResult = calculateMacroConsistencyHeatmap({
  meals: [
    {
      id: 'hm-1',
      date: '2026-11-25',
      slot: 'dinner',
      description: 'On target before away',
      items: [{ name: 'Bữa chuẩn', amount: 400, unit: 'g', kcal: 2000, protein: 150, carbs: 200, fat: 65 }],
      createdAt: 1,
    },
    {
      id: 'hm-2',
      date: '2026-11-28',
      slot: 'lunch',
      description: 'On target after away',
      items: [{ name: 'Bữa chuẩn 2', amount: 400, unit: 'g', kcal: 1980, protein: 155, carbs: 195, fat: 64 }],
      createdAt: 2,
    },
  ],
  currentTargets: { kcal: 2000, protein: 150 },
  referenceDateStr: '2026-11-28',
  weeksCount: 12,
  awayMode: sampleAwayMode,
});
assert(heatmapResult.weeks.length === 12, '12-week heatmap must produce 12 weekly columns');
assert(heatmapResult.adherentDays === 2, 'Should count 2 adherent days');
assert(heatmapResult.awayDays === 2, 'Nov 26 & Nov 27 with no logs should be flagged as 2 away days');
assert(heatmapResult.currentStreak === 2, 'Streak across unlogged Away days must stay preserved at 2');

const checkinDraft = buildWeeklyCheckinDraft({
  weekEndDateStr: '2026-11-28',
  bodyPoints: [
    { id: 'bp-w1', date: '2026-11-23', weightKg: 70.4, bodyFatPct: 16.2, createdAt: 1 },
    { id: 'bp-w2', date: '2026-11-27', weightKg: 70.0, bodyFatPct: 16.0, createdAt: 2 },
  ],
  plannedSessions: [
    { id: 'ps1', title: 'Upper', dayOfWeek: 'Thứ 2', dayIndex: 0, weekIndex: 1, prescriptions: [] },
    { id: 'ps2', title: 'Lower', dayOfWeek: 'Thứ 4', dayIndex: 2, weekIndex: 1, prescriptions: [] },
  ],
  workoutSessions: [
    { id: 'ws1', date: '2026-11-24', title: 'Upper', startedAt: 1000, sets: [] },
  ],
  meals: [
    {
      id: 'wm1',
      date: '2026-11-25',
      slot: 'lunch',
      description: 'Meal',
      items: [{ name: 'Rice & chicken', amount: 400, unit: 'g', kcal: 2000, protein: 150, carbs: 200, fat: 65 }],
      createdAt: 1,
    },
  ],
  currentTargets: { kcal: 2000, protein: 150 },
  bodyPhotos: [
    { id: 'ph1', date: '2026-11-27', photoUrl: 'data:image/jpeg;base64,xxx', pose: 'front', createdAt: 1 },
  ],
});
assert(checkinDraft.avgWeightKg === 70.2, `Weekly avgWeightKg should be 70.2, got ${checkinDraft.avgWeightKg}`);
assert(checkinDraft.trainingAdherencePct === 50, `Expected 50% training adherence (1/2), got ${checkinDraft.trainingAdherencePct}`);
assert(checkinDraft.macroAdherencePct === 100, 'Logged day within 90-110% gives 100% macro adherence');
assert((checkinDraft.photoIds || []).includes('ph1'), 'Weekly check-in draft should link photos from that week');

const awayFixNext = generateHealthFixNextActions({
  todayStr: '2026-11-27',
  dayMeals: [],
  targetProteinG: 150,
  targetKcal: 2000,
  plannedSessions: [],
  bodyPoints: [],
  calendarEvents: [],
  awayMode: sampleAwayMode,
});
assert(
  awayFixNext.some((a) => a.id === 'fix-away-mode-active') && !awayFixNext.some((a) => a.id === 'fix-stale-checkin'),
  'Away Mode active date should suppress stale check-in nag and show Away Mode notice'
);

// ── Auto Phase Progression Tests ──
const sampleRoadmap = {
  id: 'rm-auto-1',
  title: 'Test Auto Phase Roadmap',
  createdAt: 1,
  activePhaseId: 'ph-1',
  autoAdvanceByDate: true,
  phases: [
    {
      id: 'ph-1',
      name: 'Giai đoạn 1',
      phaseType: 'cut' as const,
      startDate: '01/11/2026',
      endDate: '28/11/2026',
      startWeightKg: 70,
      targetWeightKg: 68,
      startBodyFatPct: 18,
      targetBodyFatPct: 16,
      startLbmKg: 57,
      targetLbmKg: 57,
      startFfmi: 20,
      targetFfmi: 20,
      targetKcal: 2000,
      macros: { protein: 150, carbs: 190, fat: 65 },
      isCurrent: true,
    },
    {
      id: 'ph-2',
      name: 'Giai đoạn 2',
      phaseType: 'bulk' as const,
      startDate: '29/11/2026',
      endDate: '27/12/2026',
      startWeightKg: 68,
      targetWeightKg: 70,
      startBodyFatPct: 16,
      targetBodyFatPct: 16.5,
      startLbmKg: 57,
      targetLbmKg: 58.5,
      startFfmi: 20,
      targetFfmi: 20.5,
      targetKcal: 2500,
      macros: { protein: 155, carbs: 300, fat: 70 },
    },
    {
      id: 'ph-3',
      name: 'Giai đoạn 3',
      phaseType: 'minicut' as const,
      startDate: '28/12/2026',
      endDate: '18/01/2027',
      startWeightKg: 70,
      targetWeightKg: 68.5,
      startBodyFatPct: 16.5,
      targetBodyFatPct: 15,
      startLbmKg: 58.5,
      targetLbmKg: 58.5,
      startFfmi: 20.5,
      targetFfmi: 20.5,
      targetKcal: 1950,
      macros: { protein: 160, carbs: 170, fat: 65 },
    },
  ],
};
assert(
  resolveAutoPhaseTransition(sampleRoadmap, '2026-11-28') === null,
  'Should stay on Phase 1 before Phase 2 start date'
);
const autoPh2 = resolveAutoPhaseTransition(sampleRoadmap, '2026-11-29');
assert(autoPh2?.id === 'ph-2', `Should auto-advance to Phase 2 on 2026-11-29, got ${autoPh2?.id}`);
assert(
  resolveAutoPhaseTransition({ ...sampleRoadmap, autoHandledPhaseIds: ['ph-2'] }, '2026-11-29') === null,
  'Should preserve manual revert when Phase 2 is already recorded in autoHandledPhaseIds'
);
const autoPh3 = resolveAutoPhaseTransition({ ...sampleRoadmap, autoHandledPhaseIds: ['ph-2'] }, '2026-12-28');
assert(autoPh3?.id === 'ph-3', 'Should still auto-advance when Phase 3 start date arrives');

// ── Overview Training Journey & Phase Day Counter Heatmap Tests ──
const journeyRes = calculatePhaseJourneyHeatmap({
  trainingStartDate: '2026-11-15',
  activePhase: sampleRoadmap.phases[0], // 01/11/2026 - 28/11/2026 (28 days)
  workoutSessions: [
    { id: 'jw-1', date: '2026-11-28', title: 'Upper', startedAt: 1, sets: [] },
  ],
  meals: [
    {
      id: 'jm-1',
      date: '2026-11-28',
      slot: 'lunch',
      description: 'Cơm ức gà',
      items: [{ name: 'ức gà', amount: 200, unit: 'g', kcal: 330, protein: 60, carbs: 0, fat: 7 }],
      createdAt: 1,
    },
    {
      id: 'jm-2',
      date: '2026-11-27',
      slot: 'lunch',
      description: 'Cơm cá',
      items: [{ name: 'cá', amount: 200, unit: 'g', kcal: 300, protein: 40, carbs: 0, fat: 10 }],
      createdAt: 2,
    },
  ],
  todayDateStr: '2026-11-28',
  weeksCount: 12,
});
assert(journeyRes.dayNumber === 14, `Expected Day 14 from 2026-11-15 to 2026-11-28, got ${journeyRes.dayNumber}`);
assert(journeyRes.phaseDayNumber === 28 && journeyRes.totalPhaseDays === 28, `Expected phase day 28/28, got ${journeyRes.phaseDayNumber}/${journeyRes.totalPhaseDays}`);
assert(journeyRes.weeks.length === 12, 'Should build 12 weeks for Overview heatmap');
const todayCell = journeyRes.weeks[11][6];
assert(todayCell.isToday && todayCell.dayNumber === 14 && todayCell.activityLevel === 3, 'Today cell must show day 14 and level 3 (workout + meal)');
const yesterdayCell = journeyRes.weeks[11][5];
assert(yesterdayCell.dayNumber === 13 && yesterdayCell.activityLevel === 1, 'Yesterday cell with meal only should show day 13 and level 1');

const weekPeriod = buildJourneyCalendarPeriod({
  mode: 'week',
  cursorDateStr: '2026-11-28',
  journeyStartDateStr: '2026-11-15',
  todayDateStr: '2026-11-28',
  workoutSessions: [{ id: 'jw-1', date: '2026-11-28', title: 'Upper', startedAt: 1, sets: [] }],
});
assert(weekPeriod.cells.length === 7, 'Week view should return exact 7 days Monday-Sunday');
assert(weekPeriod.cells[0].weekdayLabel === 'T2', 'Week view should start on Monday (T2)');

const monthPeriod = buildJourneyCalendarPeriod({
  mode: 'month',
  cursorDateStr: '2026-11-28',
  journeyStartDateStr: '2026-11-15',
  todayDateStr: '2026-11-28',
});
assert(monthPeriod.cells.length % 7 === 0 && monthPeriod.cells.length >= 35, 'Month grid should align cleanly to 7-day calendar rows');
assert(monthPeriod.cells.some((c) => c.date === '2026-11-28' && c.dayNumber === 14 && c.inCurrentPeriod), 'Month grid must tag Nov 28 as Day 14 in current month');

// 21-day cross-month journey continuity test (early days N1..N21 must all appear without clipping)
const twentyOneDayRes = calculatePhaseJourneyHeatmap({
  trainingStartDate: '2026-11-08',
  workoutSessions: [{ id: 'w-day1', date: '2026-11-08', title: 'Buổi mở màn', startedAt: 1, sets: [] }],
  todayDateStr: '2026-11-28',
  weeksCount: 12,
});
assert(twentyOneDayRes.dayNumber === 21, `Expected Day 21, got ${twentyOneDayRes.dayNumber}`);
assert(twentyOneDayRes.journeyWeeks.length === 3, `Expected 3 sequential weeks (21 days), got ${twentyOneDayRes.journeyWeeks.length}`);
assert(
  twentyOneDayRes.journeyWeeks[0][0].dayNumber === 1 && twentyOneDayRes.journeyWeeks[0][0].date === '2026-11-08',
  'Journey timeline must start strictly at Day 1 (2026-11-08)'
);
assert(
  twentyOneDayRes.journeyWeeks[2][6].dayNumber === 21 && twentyOneDayRes.journeyWeeks[2][6].isToday,
  'Journey timeline must end at Day 21 (Today)'
);

console.log('All fitness metrics & world-class nutrition tests passed successfully!');



import {
  Exercise,
  MuscleGroup,
  PlannedSession,
  Prescription,
  SetLog,
  WorkoutSession,
  MUSCLE_LABEL,
} from '../types/productivity';
import { EXERCISES, exerciseById, gymCalories, todayString } from './fitnessMetrics';

export interface ParsedSetItem {
  id: string;
  exerciseId: string;
  exerciseName: string;
  muscle: MuscleGroup;
  setIndex: number;
  weightKg: number;
  reps: number;
  repsRange?: string; // e.g. "8-12", "6-10"
  rpe?: number;
  rir?: number;
  setType: 'normal' | 'warmup' | 'dropset' | 'failure';
  restSeconds?: number;
  videoUrl?: string;
  rawLine: string;
}

export interface ParsedExerciseGroup {
  exerciseId: string;
  exerciseName: string;
  muscle: MuscleGroup;
  sets: ParsedSetItem[];
  totalTonnageKg: number;
  restSeconds?: number;
  prescribedReps?: string;
  videoUrl?: string;
}

export interface ParsedWorkoutSnippet {
  workoutTitle: string;
  targetDate: string; // YYYY-MM-DD
  exerciseGroups: ParsedExerciseGroup[];
  allSets: ParsedSetItem[];
  totalSets: number;
  totalReps: number;
  totalVolumeKg: number;
  estimatedBurnedKcal: number;
  targetedMuscles: { muscle: MuscleGroup; label: string; percentage: number; setCount: number }[];
  unrecognizedLines: string[];
}

// Helper to calculate average numeric reps from range like "8-12" or "6-10"
export function parseRangeToAvgReps(repsStr: string): number {
  if (!repsStr) return 10;
  if (repsStr.includes('-')) {
    const parts = repsStr.split('-').map((s) => parseFloat(s.trim()));
    if (!isNaN(parts[0]) && !isNaN(parts[1])) {
      return Math.round((parts[0] + parts[1]) / 2);
    }
  }
  const val = parseInt(repsStr, 10);
  return isNaN(val) ? 10 : val;
}

// Comprehensive English & Vietnamese exercise synonyms
const SYNONYM_MAP: Record<string, string> = {
  // Chest
  'pec deck': 'pec-deck',
  'pec deck fly': 'pec-deck',
  'pec deck machine fly': 'pec-deck',
  'bench press': 'bench-press',
  'bench': 'bench-press',
  'đẩy ngực ngang': 'bench-press',
  'ngực ngang': 'bench-press',
  'đẩy ngực': 'bench-press',
  'barbell bench press': 'bench-press',
  'flat bench press': 'bench-press',
  'incline press': 'incline-db-press',
  'incline barbell press': 'incline-barbell-press',
  'incline bench press': 'incline-barbell-press',
  'incline bench': 'incline-barbell-press',
  'incline db press': 'incline-db-press',
  'incline dumbbell press': 'incline-db-press',
  'ngực trên': 'incline-db-press',
  'đẩy ngực trên': 'incline-db-press',
  'cable fly': 'cable-fly',
  'ép ngực cáp': 'cable-fly',
  'ép ngực': 'cable-fly',
  'chest fly': 'cable-fly',
  'chest dips': 'chest-dips',
  'dips': 'chest-dips',
  'xà kép': 'chest-dips',
  'chống xà kép': 'chest-dips',
  'push up': 'push-up',
  'pushup': 'push-up',
  'push-up': 'push-up',
  'hít đất': 'push-up',
  'chống đẩy': 'push-up',
  'diamond pushup': 'diamond-push-up',
  'diamond push-up': 'diamond-push-up',

  // Back
  'top half pullovers': 'pullover',
  'top half pullover': 'pullover',
  'pullover': 'pullover',
  'pullovers': 'pullover',
  'lat pulldown': 'lat-pulldown',
  'pulldown': 'lat-pulldown',
  'kéo xô': 'lat-pulldown',
  'kéo lưng': 'lat-pulldown',
  'lat row': 'seated-cable-row',
  'chest supported t-bar row': 't-bar-row',
  't-bar row': 't-bar-row',
  't bar row': 't-bar-row',
  'pull up': 'pull-up',
  'pullup': 'pull-up',
  'pull-up': 'pull-up',
  'hít xà': 'pull-up',
  'kéo xà': 'pull-up',
  'chin up': 'chin-up',
  'chinup': 'chin-up',
  'chin-up': 'chin-up',
  'barbell row': 'barbell-row',
  'chèo tạ đòn': 'barbell-row',
  'chèo lưng': 'barbell-row',
  'kéo lưng xô': 'barbell-row',
  'bent over row': 'barbell-row',
  'seated cable row': 'seated-cable-row',
  'cable row': 'seated-cable-row',
  'chèo cáp': 'seated-cable-row',
  'straight arm pulldown': 'straight-arm-pulldown',
  'kéo xô tay thẳng': 'straight-arm-pulldown',
  'inverted row': 'inverted-row',
  'bodyweight row': 'inverted-row',
  'deadlift': 'deadlift',
  'kéo deadlift': 'deadlift',
  'conventional deadlift': 'deadlift',

  // Shoulders
  'gymleco shoulder press': 'machine-shoulder-press',
  'machine shoulder press': 'machine-shoulder-press',
  'ohp': 'ohp',
  'overhead press': 'ohp',
  'đẩy vai': 'ohp',
  'military press': 'ohp',
  'shoulder press': 'ohp',
  'single arm machine lateral raise': 'cable-lateral-raise',
  'machine lateral raise': 'cable-lateral-raise',
  'lateral raise': 'lateral-raise',
  'bay vai': 'lateral-raise',
  'dang tạ vai': 'lateral-raise',
  'vai ngang': 'lateral-raise',
  'side lateral raise': 'lateral-raise',
  'cable lateral raise': 'cable-lateral-raise',
  'bay vai cáp': 'cable-lateral-raise',
  'face pull': 'face-pull',
  'kéo mặt': 'face-pull',
  'rear delt fly': 'rear-delt-fly',
  'vai sau': 'rear-delt-fly',
  'pike pushup': 'pike-push-up',
  'pike push-up': 'pike-push-up',
  'kelso shrug': 'shrugs',
  'kelso shrugs': 'shrugs',
  'shrugs': 'shrugs',
  'cầu vai': 'shrugs',
  'dumbbell shrugs': 'shrugs',

  // Arms
  'tricep pushdown': 'triceps-pushdown',
  'triceps pushdown': 'triceps-pushdown',
  'pushdown': 'triceps-pushdown',
  'kéo tay sau': 'triceps-pushdown',
  'tay sau': 'triceps-pushdown',
  'overhead rope triceps extension': 'overhead-triceps-ext',
  'overhead triceps extension': 'overhead-triceps-ext',
  'rope triceps extension': 'overhead-triceps-ext',
  'skull crusher': 'skull-crusher',
  'triceps extension': 'skull-crusher',
  'preacher curl': 'preacher-curl',
  'recline curl': 'incline-db-curl',
  'reclined curl': 'incline-db-curl',
  'incline curl': 'incline-db-curl',
  'incline db curl': 'incline-db-curl',
  'barbell curl': 'barbell-curl',
  'bicep curl': 'barbell-curl',
  'cuốn tay trước': 'barbell-curl',
  'tay trước': 'barbell-curl',
  'hammer curl': 'hammer-curl',
  'cuốn búa': 'hammer-curl',

  // Legs
  'back squat': 'back-squat',
  'squat': 'back-squat',
  'gánh tạ': 'back-squat',
  'gánh đùi': 'back-squat',
  'barbell squat': 'back-squat',
  'romanian deadlift': 'romanian-deadlift',
  'rdl': 'romanian-deadlift',
  'đùi sau': 'romanian-deadlift',
  'leg press': 'leg-press',
  'đạp đùi': 'leg-press',
  'đạp chân': 'leg-press',
  'leg curl': 'leg-curl',
  'móc đùi sau': 'leg-curl',
  'cuộn đùi sau': 'leg-curl',
  'leg extension': 'leg-extension',
  'đá đùi': 'leg-extension',
  'đá đùi trước': 'leg-extension',
  'calf raise': 'calf-raise',
  'nhón bắp chân': 'calf-raise',
  'bắp chân': 'calf-raise',
  'hip thrust': 'hip-thrust',
  'barbell hip thrust': 'hip-thrust',
  'đẩy hông': 'hip-thrust',
  'nâng mông': 'hip-thrust',
  'bulgarian split squat': 'bulgarian-split-squat',
  'split squat': 'bulgarian-split-squat',
  'cable kickback': 'cable-kickback',
  'đá mông': 'cable-kickback',
  'abductor': 'abductor-machine',
  'hip abduction': 'abductor-machine',

  // Core & Cardio
  'cable crunch': 'cable-crunch',
  'gập bụng': 'cable-crunch',
  'hanging leg raise': 'hanging-leg-raise',
  'treo người nâng chân': 'hanging-leg-raise',
  'bụng dưới': 'hanging-leg-raise',
  'plank': 'plank',
  'treadmill': 'treadmill',
  'chạy bộ': 'treadmill',
};

/**
 * Normalizes any free-form exercise string into an exact known Exercise
 */
export function normalizeExerciseName(
  rawName: string,
  customList: Exercise[] = []
): { id: string; name: string; muscle: MuscleGroup; isCustom: boolean } {
  const clean = rawName.trim().toLowerCase().replace(/[:#\-_,.]/g, ' ').replace(/\s+/g, ' ');

  // 1. Check customList exact or partial
  for (const c of customList) {
    if (c.name.toLowerCase() === clean || clean.includes(c.name.toLowerCase())) {
      return { id: c.id, name: c.name, muscle: c.muscle, isCustom: true };
    }
  }

  // 2. Check synonym dictionary
  if (SYNONYM_MAP[clean]) {
    const ex = exerciseById(SYNONYM_MAP[clean], customList);
    if (ex) return { id: ex.id, name: ex.name, muscle: ex.muscle, isCustom: false };
  }

  for (const [key, targetId] of Object.entries(SYNONYM_MAP)) {
    if (clean.includes(key) || key.includes(clean)) {
      const ex = exerciseById(targetId, customList);
      if (ex) return { id: ex.id, name: ex.name, muscle: ex.muscle, isCustom: false };
    }
  }

  // 3. Check EXERCISES standard list
  for (const ex of EXERCISES) {
    if (ex.name.toLowerCase() === clean || clean.includes(ex.name.toLowerCase())) {
      return { id: ex.id, name: ex.name, muscle: ex.muscle, isCustom: false };
    }
  }

  // 4. Infer muscle group from text
  let inferredMuscle: MuscleGroup = 'core';
  if (/ngực|chest|pec|bench|press/i.test(clean)) inferredMuscle = 'chest';
  else if (/lưng|xô|back|lat|row|pullover/i.test(clean)) inferredMuscle = 'back';
  else if (/chân|đùi|mông|leg|squat|glute|calf|quad/i.test(clean)) inferredMuscle = 'legs';
  else if (/vai|shoulder|delt|shrug/i.test(clean)) inferredMuscle = 'shoulders';
  else if (/tay|bicep|tricep|arm|curl|pushdown/i.test(clean)) inferredMuscle = 'arms';
  else if (/bụng|core|abs|plank/i.test(clean)) inferredMuscle = 'core';
  else if (/chạy|cardio|run|treadmill|bơi/i.test(clean)) inferredMuscle = 'cardio';

  const generatedId = `custom-${clean.replace(/\s+/g, '-').slice(0, 30)}`;
  const formattedName = rawName.trim().charAt(0).toUpperCase() + rawName.trim().slice(1);
  return { id: generatedId, name: formattedName, muscle: inferredMuscle, isCustom: true };
}

/**
 * Extracts RIR or RPE and set type from a text string
 */
function extractIntensityAndSetType(text: string): {
  rpe?: number;
  rir?: number;
  setType: 'normal' | 'warmup' | 'dropset' | 'failure';
} {
  let rpe: number | undefined;
  let rir: number | undefined;
  let setType: 'normal' | 'warmup' | 'dropset' | 'failure' = 'normal';

  const lower = text.toLowerCase();

  if (lower.includes('warmup') || lower.includes('khởi động') || lower.includes('w/u')) {
    setType = 'warmup';
  } else if (lower.includes('drop') || lower.includes('dropset')) {
    setType = 'dropset';
  } else if (lower.includes('failure') || lower.includes('fail') || lower.includes('kiệt sức') || lower.includes('max')) {
    setType = 'failure';
  }

  const rirMatch = lower.match(/(?:rir\s*[:=]?\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*rir)/);
  if (rirMatch) {
    const val = parseFloat(rirMatch[1] || rirMatch[2]);
    if (!isNaN(val) && val >= 0 && val <= 10) {
      rir = val;
      rpe = Math.max(1, Math.min(10, 10 - rir));
    }
  }

  const rpeMatch = lower.match(/(?:rpe\s*[:=]?\s*(\d+(?:\.\d+)?)|@\s*(\d+(?:\.\d+)?))/);
  if (rpeMatch) {
    const val = parseFloat(rpeMatch[1] || rpeMatch[2]);
    if (!isNaN(val) && val >= 1 && val <= 10) {
      rpe = val;
      rir = Math.max(0, Math.min(10, 10 - rpe));
    }
  }

  if (rir === 0 && setType === 'normal') {
    setType = 'failure';
  }

  return { rpe, rir, setType };
}

/**
 * Parses a single section of text into a ParsedWorkoutSnippet
 */
export function parseWorkoutSnippet(
  text: string,
  customList: Exercise[] = [],
  userWeightKg: number = 70
): ParsedWorkoutSnippet {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  let workoutTitle = 'Buổi Tập Tùy Chỉnh (ZENOX)';
  let targetDate = todayString();

  const allSets: ParsedSetItem[] = [];
  const exerciseGroupsMap = new Map<string, ParsedExerciseGroup>();
  const unrecognizedLines: string[] = [];

  let currentExercise: { id: string; name: string; muscle: MuscleGroup } | null = null;
  let currentExerciseSetIndex = 0;

  for (const line of lines) {
    // Ignore CSV table headers
    if (/^exercise\s*,\s*sets?\s*,/i.test(line)) {
      continue;
    }

    // 1. Title/date directives
    const titleMatch = line.match(/^(?:title|tiêu đề|buổi tập|tên)[:=]?\s*(.+)$/i);
    if (titleMatch && !line.includes(',')) {
      workoutTitle = titleMatch[1].trim();
      continue;
    }
    // Or single header line without comma: "Upper A" or "Day 1 - Push"
    if (!line.includes(',') && !line.includes(':') && /^(upper|lower|push|pull|legs?|day|buổi|session)/i.test(line)) {
      workoutTitle = line.trim();
      continue;
    }

    const dateMatch = line.match(/^(?:date|ngày)[:=]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
    if (dateMatch) {
      targetDate = dateMatch[1].trim();
      continue;
    }

    // 2. Pattern: CSV Row with columns: Exercise,Sets,Reps,Rest,Video
    // e.g. "Pec Deck,2,8-12,90," or "Incline Press,2,6-10,150,https://..."
    if (line.includes(',')) {
      const parts = line.split(',').map((p) => p.replace(/^["']|["']$/g, '').trim());
      if (parts.length >= 3) {
        const rawName = parts[0];
        const numSets = parseInt(parts[1], 10);
        const repsRaw = parts[2];
        const restSec = parts[3] ? parseInt(parts[3], 10) : 90;
        const videoUrl = parts[4] || undefined;

        if (rawName && !isNaN(numSets) && numSets > 0) {
          const exInfo = normalizeExerciseName(rawName, customList);
          const avgReps = parseRangeToAvgReps(repsRaw);

          let group = exerciseGroupsMap.get(exInfo.id);
          if (!group) {
            group = {
              exerciseId: exInfo.id,
              exerciseName: exInfo.name,
              muscle: exInfo.muscle,
              sets: [],
              totalTonnageKg: 0,
              restSeconds: !isNaN(restSec) ? restSec : 90,
              prescribedReps: repsRaw || '10',
              videoUrl,
            };
            exerciseGroupsMap.set(exInfo.id, group);
          }

          for (let s = 0; s < numSets; s++) {
            const item: ParsedSetItem = {
              id: `set-${Date.now()}-${allSets.length}`,
              exerciseId: exInfo.id,
              exerciseName: exInfo.name,
              muscle: exInfo.muscle,
              setIndex: s,
              weightKg: 0, // Bodyweight or open weight
              reps: avgReps,
              repsRange: repsRaw,
              setType: 'normal',
              restSeconds: !isNaN(restSec) ? restSec : 90,
              videoUrl,
              rawLine: line,
            };
            allSets.push(item);
            group.sets.push(item);
          }
          currentExercise = exInfo;
          currentExerciseSetIndex = numSets;
          continue;
        }
      }
    }

    // 3. Pattern A: Compact single line per exercise:
    // e.g. "Bench Press 4x8 80kg RIR 2" or "Squat 3 x 10 100kg @8"
    const compactMatch = line.match(
      /^([A-Za-zÀ-ỹ0-9\s\(\)\-\+\/]+?)\s+(\d+)\s*(?:x|×)\s*(\d+)(?:\s*(?:reps?|r))?(?:\s+(\d+(?:\.\d+)?)\s*(?:kg|k|kgs|lbs?)?)?(.*)$/i
    );

    if (compactMatch && compactMatch[1].trim().length > 1) {
      const rawExName = compactMatch[1].trim();
      const numSets = parseInt(compactMatch[2], 10);
      const reps = parseInt(compactMatch[3], 10);
      const weightKg = compactMatch[4] ? parseFloat(compactMatch[4]) : 0;
      const tail = compactMatch[5] || '';

      const exInfo = normalizeExerciseName(rawExName, customList);
      const { rpe, rir, setType } = extractIntensityAndSetType(tail);

      let group = exerciseGroupsMap.get(exInfo.id);
      if (!group) {
        group = {
          exerciseId: exInfo.id,
          exerciseName: exInfo.name,
          muscle: exInfo.muscle,
          sets: [],
          totalTonnageKg: 0,
          prescribedReps: String(reps),
          restSeconds: 90,
        };
        exerciseGroupsMap.set(exInfo.id, group);
      }

      for (let s = 0; s < numSets; s++) {
        const item: ParsedSetItem = {
          id: `set-${Date.now()}-${allSets.length}`,
          exerciseId: exInfo.id,
          exerciseName: exInfo.name,
          muscle: exInfo.muscle,
          setIndex: s,
          weightKg,
          reps,
          rpe,
          rir,
          setType,
          rawLine: line,
        };
        allSets.push(item);
        group.sets.push(item);
        group.totalTonnageKg += weightKg * reps;
      }
      currentExercise = exInfo;
      currentExerciseSetIndex = numSets;
      continue;
    }

    // 4. Pattern B: Exercise Header line followed by sets:
    // e.g. "Bench Press:"
    const headerMatch = line.match(/^([A-Za-zÀ-ỹ0-9\s\(\)\-\+\/]+):$/i);
    if (headerMatch) {
      currentExercise = normalizeExerciseName(headerMatch[1].trim(), customList);
      currentExerciseSetIndex = 0;
      continue;
    }

    // 5. Pattern C: Sub-set line under current exercise:
    // e.g. "Set 1: 80kg x 8 reps rir 2" or "80kg x 8 @8"
    if (currentExercise) {
      const subSetMatch = line.match(
        /^(?:set\s*\d+\s*[:=]?\s*)?(\d+(?:\.\d+)?)\s*(?:kg|k|kgs|lbs?)?\s*(?:x|×)\s*(\d+)(?:\s*(?:reps?|r))?(.*)$/i
      );
      if (subSetMatch) {
        const weightKg = parseFloat(subSetMatch[1]);
        const reps = parseInt(subSetMatch[2], 10);
        const tail = subSetMatch[3] || '';
        const { rpe, rir, setType } = extractIntensityAndSetType(tail);

        let group = exerciseGroupsMap.get(currentExercise.id);
        if (!group) {
          group = {
            exerciseId: currentExercise.id,
            exerciseName: currentExercise.name,
            muscle: currentExercise.muscle,
            sets: [],
            totalTonnageKg: 0,
            prescribedReps: String(reps),
            restSeconds: 90,
          };
          exerciseGroupsMap.set(currentExercise.id, group);
        }

        const item: ParsedSetItem = {
          id: `set-${Date.now()}-${allSets.length}`,
          exerciseId: currentExercise.id,
          exerciseName: currentExercise.name,
          muscle: currentExercise.muscle,
          setIndex: currentExerciseSetIndex++,
          weightKg,
          reps,
          rpe,
          rir,
          setType,
          rawLine: line,
        };
        allSets.push(item);
        group.sets.push(item);
        group.totalTonnageKg += weightKg * reps;
        continue;
      }
    }

    // Unrecognized line
    unrecognizedLines.push(line);
  }

  const exerciseGroups = Array.from(exerciseGroupsMap.values());
  const totalSets = allSets.length;
  const totalReps = allSets.reduce((sum, s) => sum + s.reps, 0);
  const totalVolumeKg = allSets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);

  const setLogsForCal: SetLog[] = allSets.map((s, idx) => ({
    id: s.id,
    exerciseId: s.exerciseId,
    setIndex: idx,
    weightKg: s.weightKg,
    reps: s.reps,
    rpe: s.rpe,
    rir: s.rir,
    setType: s.setType,
  }));

  const estimatedBurnedKcal = gymCalories(setLogsForCal, userWeightKg) || Math.round(totalSets * 18);

  const muscleCount: Record<string, number> = {};
  for (const s of allSets) {
    muscleCount[s.muscle] = (muscleCount[s.muscle] || 0) + 1;
  }
  const targetedMuscles = Object.entries(muscleCount).map(([m, count]) => ({
    muscle: m as MuscleGroup,
    label: MUSCLE_LABEL[m as MuscleGroup] || m,
    setCount: count,
    percentage: totalSets > 0 ? Math.round((count / totalSets) * 100) : 0,
  }));

  return {
    workoutTitle,
    targetDate,
    exerciseGroups,
    allSets,
    totalSets,
    totalReps,
    totalVolumeKg,
    estimatedBurnedKcal,
    targetedMuscles,
    unrecognizedLines,
  };
}

/**
 * Splits multi-session routine text (e.g. Upper A and Upper B) into individual ParsedWorkoutSnippet
 */
export function parseMultiRoutineSnippet(
  text: string,
  customList: Exercise[] = [],
  userWeightKg: number = 70
): ParsedWorkoutSnippet[] {
  const lines = text.split('\n');
  const sections: { title: string; lines: string[] }[] = [];
  let currentTitle = 'Buổi Tập';
  let currentLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect routine section header: "Upper A", "Upper B", "Day 1 - Push", "Session 1"
    const isHeader =
      !line.includes(',') &&
      !line.includes(':') &&
      /^(upper|lower|push|pull|legs?|day|buổi|session)/i.test(line) &&
      !line.toLowerCase().includes('exercise');

    if (isHeader) {
      if (currentLines.length > 0) {
        sections.push({ title: currentTitle, lines: currentLines });
      }
      currentTitle = line;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({ title: currentTitle, lines: currentLines });
  }

  if (sections.length === 0) {
    return [parseWorkoutSnippet(text, customList, userWeightKg)];
  }

  return sections.map((sec) => {
    const joined = [`Title: ${sec.title}`, ...sec.lines].join('\n');
    const parsed = parseWorkoutSnippet(joined, customList, userWeightKg);
    parsed.workoutTitle = sec.title;
    return parsed;
  });
}

/**
 * Parses CSV export from Strong, Hevy, or generic ZENOX CSV template
 */
export function parseWorkoutCsv(
  csvText: string,
  customList: Exercise[] = [],
  userWeightKg: number = 70
): ParsedWorkoutSnippet {
  return parseWorkoutSnippet(csvText, customList, userWeightKg);
}

/**
 * Converts a parsed workout snippet into a completed WorkoutSession object
 */
export function workoutSnippetToWorkoutSession(
  parsed: ParsedWorkoutSnippet,
  note: string = ''
): Omit<WorkoutSession, 'id'> {
  const sets: SetLog[] = parsed.allSets.map((s, idx) => ({
    id: s.id || `set-${Date.now()}-${idx}`,
    exerciseId: s.exerciseId,
    setIndex: s.setIndex,
    weightKg: s.weightKg,
    reps: s.reps,
    rpe: s.rpe,
    rir: s.rir,
    setType: s.setType,
  }));

  const now = Date.now();
  return {
    date: parsed.targetDate || todayString(),
    title: parsed.workoutTitle || 'Buổi tập ghi nhanh',
    startedAt: now - (parsed.totalSets * 150 * 1000),
    finishedAt: now,
    sets,
    note: note.trim() || `Nhập nhanh qua ZENOX Smart Parser (${parsed.totalSets} hiệp · ${parsed.totalVolumeKg.toLocaleString()}kg volume)`,
  };
}

/**
 * Converts a parsed workout snippet into a PlannedSession routine template
 */
export function workoutSnippetToPlannedSession(
  parsed: ParsedWorkoutSnippet,
  dayOfWeek: string = 'Thứ 2'
): PlannedSession {
  const DAY_MAP: Record<string, number> = {
    'Thứ 2': 0, 'Thứ 3': 1, 'Thứ 4': 2, 'Thứ 5': 3, 'Thứ 6': 4, 'Thứ 7': 5, 'Chủ Nhật': 6,
  };

  const prescriptions: Prescription[] = parsed.exerciseGroups.map((g) => {
    const numSets = g.sets.length;
    const avgReps = Math.round(g.sets.reduce((sum, s) => sum + s.reps, 0) / (numSets || 1));
    const avgRpe = g.sets.find((s) => s.rpe !== undefined)?.rpe || 8;

    return {
      exerciseId: g.exerciseId,
      sets: numSets || 2,
      reps: g.prescribedReps || String(avgReps || 10),
      rpe: avgRpe,
      restSeconds: g.restSeconds || 90,
    };
  });

  return {
    id: `custom-plan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    weekIndex: 0,
    dayIndex: DAY_MAP[dayOfWeek] ?? 0,
    title: parsed.workoutTitle || 'Giáo án mới',
    dayOfWeek,
    prescriptions,
  };
}

/**
 * Generates sample CSV template string for export/download
 */
export function generateWorkoutCsvTemplate(): string {
  return [
    'Upper A',
    'Exercise,Sets,Reps,Rest,Video',
    'Pec Deck,2,8-12,90,',
    'Incline Press,2,6-10,150,',
    'Gymleco Shoulder Press,2,6-10,150,',
    'Top Half Pullovers,2,8-12,90,',
    'Lat Pulldown,3,8-12,120,',
    'Lat Row,1,8-12,120,',
    'Chest Supported T-Bar Row,2,8-12,120,',
    'Kelso Shrug,2,10-15,90,',
    'Single Arm Machine Lateral Raise,3,10-15,90,',
    'Tricep Pushdown,2,8-12,90,',
    'Overhead Rope Triceps Extension,1,10-15,90,',
    'Preacher Curl,2,8-12,90,',
    'Recline Curl,1,8-12,90,',
    'Hammer Curl,1,8-12,90,',
  ].join('\n');
}

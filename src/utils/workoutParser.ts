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
  rpe?: number;
  rir?: number;
  setType: 'normal' | 'warmup' | 'dropset' | 'failure';
  rawLine: string;
}

export interface ParsedExerciseGroup {
  exerciseId: string;
  exerciseName: string;
  muscle: MuscleGroup;
  sets: ParsedSetItem[];
  totalTonnageKg: number;
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

// Comprehensive English & Vietnamese exercise synonyms
const SYNONYM_MAP: Record<string, string> = {
  // Chest
  'bench press': 'bench-press',
  'bench': 'bench-press',
  'đẩy ngực ngang': 'bench-press',
  'ngực ngang': 'bench-press',
  'đẩy ngực': 'bench-press',
  'barbell bench press': 'bench-press',
  'flat bench press': 'bench-press',
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
  'lat pulldown': 'lat-pulldown',
  'pulldown': 'lat-pulldown',
  'kéo xô': 'lat-pulldown',
  'kéo lưng': 'lat-pulldown',
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

  // Shoulders
  'ohp': 'ohp',
  'overhead press': 'ohp',
  'đẩy vai': 'ohp',
  'military press': 'ohp',
  'shoulder press': 'ohp',
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
  'shrugs': 'shrugs',
  'cầu vai': 'shrugs',
  'dumbbell shrugs': 'shrugs',

  // Arms
  'barbell curl': 'barbell-curl',
  'bicep curl': 'barbell-curl',
  'cuốn tay trước': 'barbell-curl',
  'tay trước': 'barbell-curl',
  'hammer curl': 'hammer-curl',
  'cuốn búa': 'hammer-curl',
  'incline db curl': 'incline-db-curl',
  'incline curl': 'incline-db-curl',
  'triceps pushdown': 'triceps-pushdown',
  'pushdown': 'triceps-pushdown',
  'kéo tay sau': 'triceps-pushdown',
  'tay sau': 'triceps-pushdown',
  'skull crusher': 'skull-crusher',
  'triceps extension': 'skull-crusher',

  // Core & Cardio
  'cable crunch': 'cable-crunch',
  'gập bụng': 'cable-crunch',
  'hanging leg raise': 'hanging-leg-raise',
  'treo người nâng chân': 'hanging-leg-raise',
  'bụng dưới': 'hanging-leg-raise',
  'plank': 'plank',
  'hít thở plank': 'plank',
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

  // Partial matches in synonym dictionary
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
  if (/ngực|chest|pecs/i.test(clean)) inferredMuscle = 'chest';
  else if (/lưng|xô|back|lat|row/i.test(clean)) inferredMuscle = 'back';
  else if (/chân|đùi|mông|leg|squat|glute|calf|quad/i.test(clean)) inferredMuscle = 'legs';
  else if (/vai|shoulder|delt/i.test(clean)) inferredMuscle = 'shoulders';
  else if (/tay|bicep|tricep|arm|curl/i.test(clean)) inferredMuscle = 'arms';
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

  // Set type detection
  if (lower.includes('warmup') || lower.includes('khởi động') || lower.includes('w/u')) {
    setType = 'warmup';
  } else if (lower.includes('drop') || lower.includes('dropset')) {
    setType = 'dropset';
  } else if (lower.includes('failure') || lower.includes('fail') || lower.includes('kiệt sức') || lower.includes('max')) {
    setType = 'failure';
  }

  // RIR detection: "rir 2", "rir: 1", "2 rir", "rir2"
  const rirMatch = lower.match(/(?:rir\s*[:=]?\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*rir)/);
  if (rirMatch) {
    const val = parseFloat(rirMatch[1] || rirMatch[2]);
    if (!isNaN(val) && val >= 0 && val <= 10) {
      rir = val;
      rpe = Math.max(1, Math.min(10, 10 - rir));
    }
  }

  // RPE detection: "rpe 8", "rpe: 8.5", "@8", "@ 8.5"
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
 * Parses a single line representing sets or a full exercise line
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
  const unrecognizedLines: string[] = [];

  let currentExercise: { id: string; name: string; muscle: MuscleGroup } | null = null;
  let currentExerciseSetIndex = 0;

  for (const line of lines) {
    // 1. Check title/date directive: "Title: Push Day" or "Date: 2026-11-25"
    const titleMatch = line.match(/^(?:title|tiêu đề|buổi tập|tên)[:=]\s*(.+)$/i);
    if (titleMatch) {
      workoutTitle = titleMatch[1].trim();
      continue;
    }
    const dateMatch = line.match(/^(?:date|ngày)[:=]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
    if (dateMatch) {
      targetDate = dateMatch[1].trim();
      continue;
    }

    // 2. Pattern A: Compact single line per exercise:
    // e.g. "Bench Press 4x8 80kg RIR 2" or "Squat 3 x 10 100kg @8" or "Hít đất 4x15 bodyweight"
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

      for (let s = 0; s < numSets; s++) {
        allSets.push({
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
        });
      }
      currentExercise = exInfo;
      currentExerciseSetIndex = numSets;
      continue;
    }

    // 3. Pattern B: Exercise Header line followed by sets:
    // e.g. "Bench Press:" or "--- Barbell Squat ---"
    const headerMatch = line.match(/^([A-Za-zÀ-ỹ0-9\s\(\)\-\+\/]+):$/i);
    if (headerMatch) {
      currentExercise = normalizeExerciseName(headerMatch[1].trim(), customList);
      currentExerciseSetIndex = 0;
      continue;
    }

    // 4. Pattern C: Sub-set line under current exercise:
    // e.g. "Set 1: 80kg x 8 reps rir 2" or "80kg x 8 @8" or "100kg x 6"
    if (currentExercise) {
      const subSetMatch = line.match(
        /^(?:set\s*\d+\s*[:=]?\s*)?(\d+(?:\.\d+)?)\s*(?:kg|k|kgs|lbs?)?\s*(?:x|×)\s*(\d+)(?:\s*(?:reps?|r))?(.*)$/i
      );
      if (subSetMatch) {
        const weightKg = parseFloat(subSetMatch[1]);
        const reps = parseInt(subSetMatch[2], 10);
        const tail = subSetMatch[3] || '';
        const { rpe, rir, setType } = extractIntensityAndSetType(tail);

        allSets.push({
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
        });
        continue;
      }
    }

    // 5. Pattern D: Comma-separated weights line:
    // e.g. "Bench Press: 80kg x 8, 85kg x 8, 90kg x 6"
    if (line.includes(':') && line.includes(',')) {
      const [exPart, setsPart] = line.split(':');
      const exInfo = normalizeExerciseName(exPart.trim(), customList);
      const parts = setsPart.split(',');
      let sIdx = 0;

      for (const p of parts) {
        const itemMatch = p.trim().match(/(\d+(?:\.\d+)?)\s*(?:kg|k)?\s*(?:x|×)\s*(\d+)(?:\s*(?:reps?|r))?(.*)/i);
        if (itemMatch) {
          const weightKg = parseFloat(itemMatch[1]);
          const reps = parseInt(itemMatch[2], 10);
          const { rpe, rir, setType } = extractIntensityAndSetType(itemMatch[3] || '');
          allSets.push({
            id: `set-${Date.now()}-${allSets.length}`,
            exerciseId: exInfo.id,
            exerciseName: exInfo.name,
            muscle: exInfo.muscle,
            setIndex: sIdx++,
            weightKg,
            reps,
            rpe,
            rir,
            setType,
            rawLine: p.trim(),
          });
        }
      }
      if (sIdx > 0) continue;
    }

    // 6. Pattern E: Pipe delimited row:
    // e.g. "Bench Press | 80kg | 8 reps | RIR 2"
    if (line.includes('|')) {
      const cols = line.split('|').map((c) => c.trim());
      if (cols.length >= 2) {
        const exInfo = normalizeExerciseName(cols[0], customList);
        const weightMatch = cols.find((c) => /\d+\s*(?:kg|k)/i.test(c)) || '0';
        const repsMatch = cols.find((c) => /\d+\s*(?:reps?|r)/i.test(c)) || '10';
        const weightKg = parseFloat(weightMatch.replace(/[^0-9.]/g, '')) || 0;
        const reps = parseInt(repsMatch.replace(/[^0-9]/g, ''), 10) || 10;
        const { rpe, rir, setType } = extractIntensityAndSetType(line);

        allSets.push({
          id: `set-${Date.now()}-${allSets.length}`,
          exerciseId: exInfo.id,
          exerciseName: exInfo.name,
          muscle: exInfo.muscle,
          setIndex: 0,
          weightKg,
          reps,
          rpe,
          rir,
          setType,
          rawLine: line,
        });
        continue;
      }
    }

    // Unrecognized line
    unrecognizedLines.push(line);
  }

  // Group by exercise
  const groupMap = new Map<string, ParsedExerciseGroup>();
  for (const set of allSets) {
    let group = groupMap.get(set.exerciseId);
    if (!group) {
      group = {
        exerciseId: set.exerciseId,
        exerciseName: set.exerciseName,
        muscle: set.muscle,
        sets: [],
        totalTonnageKg: 0,
      };
      groupMap.set(set.exerciseId, group);
    }
    group.sets.push(set);
    group.totalTonnageKg += set.weightKg * set.reps;
  }
  const exerciseGroups = Array.from(groupMap.values());

  const totalSets = allSets.length;
  const totalReps = allSets.reduce((sum, s) => sum + s.reps, 0);
  const totalVolumeKg = allSets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);

  // Convert ParsedSetItem to SetLog format for calories
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

  const estimatedBurnedKcal = gymCalories(setLogsForCal, userWeightKg);

  // Targeted muscles breakdown
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
 * Parses CSV export from Strong, Hevy, or generic ZENOX CSV template
 */
export function parseWorkoutCsv(
  csvText: string,
  customList: Exercise[] = [],
  userWeightKg: number = 70
): ParsedWorkoutSnippet {
  const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return parseWorkoutSnippet('', customList, userWeightKg);
  }

  const header = lines[0].toLowerCase();
  const allSets: ParsedSetItem[] = [];
  let workoutTitle = 'CSV Workout Import';
  let targetDate = todayString();

  // Strong: Date, Workout Name, Exercise Name, Set Order, Weight, Reps, RPE, Notes
  // Hevy: Date, Workout Name, Exercise Name, Set Type, Weight (kg), Reps, RPE
  const isStrongOrHevy = header.includes('exercise') || header.includes('workout');

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    // CSV split handling simple commas or quotes
    const cols = row.split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
    if (cols.length < 3) continue;

    let exName = '';
    let weightKg = 0;
    let reps = 10;
    let rpe: number | undefined;
    let rir: number | undefined;
    let setType: 'normal' | 'warmup' | 'dropset' | 'failure' = 'normal';

    if (isStrongOrHevy && cols.length >= 6) {
      if (cols[0] && cols[0].length >= 10) targetDate = cols[0].slice(0, 10);
      if (cols[1]) workoutTitle = cols[1];
      exName = cols[2];
      weightKg = parseFloat(cols[4]) || 0;
      reps = parseInt(cols[5], 10) || 10;
      if (cols[6]) {
        const rpeVal = parseFloat(cols[6]);
        if (!isNaN(rpeVal)) {
          rpe = rpeVal;
          rir = Math.max(0, 10 - rpeVal);
        }
      }
    } else {
      // Generic CSV: Exercise, Sets/Weight, Reps...
      exName = cols[0];
      weightKg = parseFloat(cols[1]) || 0;
      reps = parseInt(cols[2], 10) || 10;
      if (cols[3]) {
        const val = parseFloat(cols[3]);
        if (!isNaN(val)) rir = val;
      }
    }

    const exInfo = normalizeExerciseName(exName, customList);
    allSets.push({
      id: `csv-set-${Date.now()}-${i}`,
      exerciseId: exInfo.id,
      exerciseName: exInfo.name,
      muscle: exInfo.muscle,
      setIndex: allSets.filter((s) => s.exerciseId === exInfo.id).length,
      weightKg,
      reps,
      rpe,
      rir,
      setType,
      rawLine: row,
    });
  }

  // Group by exercise
  const groupMap = new Map<string, ParsedExerciseGroup>();
  for (const set of allSets) {
    let group = groupMap.get(set.exerciseId);
    if (!group) {
      group = {
        exerciseId: set.exerciseId,
        exerciseName: set.exerciseName,
        muscle: set.muscle,
        sets: [],
        totalTonnageKg: 0,
      };
      groupMap.set(set.exerciseId, group);
    }
    group.sets.push(set);
    group.totalTonnageKg += set.weightKg * set.reps;
  }
  const exerciseGroups = Array.from(groupMap.values());

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

  const estimatedBurnedKcal = gymCalories(setLogsForCal, userWeightKg);

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
    unrecognizedLines: [],
  };
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
    startedAt: now - (parsed.totalSets * 150 * 1000), // ~2.5 mins per set
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
      sets: numSets || 3,
      reps: String(avgReps || 10),
      rpe: avgRpe,
      restSeconds: 90,
    };
  });

  return {
    id: `custom-plan-${Date.now()}`,
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
    'Date,Workout Name,Exercise Name,Set Order,Weight,Reps,RPE,Notes',
    '2026-11-25,Push Day,Bench Press,1,80,8,8,Warmup tốt',
    '2026-11-25,Push Day,Bench Press,2,85,8,8.5,Form chuẩn',
    '2026-11-25,Push Day,Bench Press,3,90,6,9,Failure rep cuối',
    '2026-11-25,Push Day,Incline Dumbbell Press,1,28,10,8,',
    '2026-11-25,Push Day,Incline Dumbbell Press,2,28,10,8.5,',
    '2026-11-25,Push Day,Lateral Raise,1,10,15,9,',
    '2026-11-25,Push Day,Triceps Pushdown,1,25,12,9,Dropset',
  ].join('\n');
}

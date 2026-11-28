import assert from 'node:assert';
import { buildProductivityBackup, parseProductivityBackup } from './productivityBackup';
import { DEFAULT_BUDGET, DEFAULT_HEALTH_PROFILE } from '../types/productivity';

console.log('Running productivityBackup tests...');

const data = {
  tasks: [],
  goals: [],
  sessions: [],
  transactions: [],
  budget: DEFAULT_BUDGET,
  healthLogs: [],
  workouts: [],
  wellness: [],
  healthProfile: DEFAULT_HEALTH_PROFILE,
};

// A freshly built backup round-trips through JSON without losing anything.
const built = buildProductivityBackup(data);
const roundTripped = parseProductivityBackup(JSON.parse(JSON.stringify(built)));
assert.ok(roundTripped, 'a built backup must parse back');
assert.strictEqual(roundTripped!.kind, 'productivity-backup');
assert.strictEqual(roundTripped!.tasks.length, 0);
assert.strictEqual(roundTripped!.budget.monthlyLimit, DEFAULT_BUDGET.monthlyLimit);

// Unrelated JSON must be rejected rather than wiping live data.
assert.strictEqual(parseProductivityBackup([]), null, 'an event array is not a backup');
assert.strictEqual(parseProductivityBackup(null), null);
assert.strictEqual(parseProductivityBackup('productivity-backup'), null);
assert.strictEqual(parseProductivityBackup({ kind: 'productivity-backup' }), null);

// A backup missing one collection is rejected.
const missing = { ...built } as Record<string, unknown>;
delete missing.workouts;
assert.strictEqual(parseProductivityBackup(missing), null);

// Missing budget / profile containers are rejected too.
const noBudget = { ...built } as Record<string, unknown>;
delete noBudget.budget;
assert.strictEqual(parseProductivityBackup(noBudget), null);

const noProfile = { ...built } as Record<string, unknown>;
noProfile.healthProfile = null;
assert.strictEqual(parseProductivityBackup(noProfile), null);

// An item loaded from a backup is preserved verbatim.
const withTask = buildProductivityBackup({
  ...data,
  tasks: [
    {
      id: 'task-1',
      title: 'Kiểm thử sao lưu',
      status: 'todo',
      priority: 'high',
      dueDate: '2026-11-01',
      categoryId: 'work',
      subtasks: [],
      createdAt: 1,
    },
  ],
});
const restored = parseProductivityBackup(withTask);
assert.strictEqual(restored!.tasks[0].title, 'Kiểm thử sao lưu');

// Active periodized roadmap & saved roadmaps round-trip cleanly across Web <-> iPhone snapshots.
const withRoadmap = buildProductivityBackup({
  ...data,
  ctgPeriodizedRoadmap: {
    id: 'rm-sync-1',
    title: 'Cut 2026',
    createdAt: 100,
    activePhaseId: 'p-1',
    phases: [
      {
        id: 'p-1',
        name: 'Giảm mỡ',
        phaseType: 'cut',
        startDate: '01/11/2026',
        endDate: '28/11/2026',
        startWeightKg: 70,
        targetWeightKg: 68,
        startBodyFatPct: 18,
        targetBodyFatPct: 16,
        startLbmKg: 57.4,
        targetLbmKg: 57.1,
        startFfmi: 19,
        targetFfmi: 19,
        targetKcal: 1850,
        macros: { protein: 150, carbs: 190, fat: 50 },
      },
    ],
  },
  savedCtgRoadmaps: [],
});
const restoredRoadmap = parseProductivityBackup(JSON.parse(JSON.stringify(withRoadmap)));
assert.strictEqual(restoredRoadmap!.ctgPeriodizedRoadmap?.id, 'rm-sync-1');
assert.strictEqual(restoredRoadmap!.ctgPeriodizedRoadmap?.phases[0].targetKcal, 1850);

console.log('All productivityBackup tests passed successfully!');

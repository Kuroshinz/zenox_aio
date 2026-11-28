import { parseAppleHealthShortcutJson, parseAppleHealthXml } from './appleHealthSync';
import { parseMacroTextResponse } from '../utils/fitnessMetrics';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

console.log('Running Apple Health and Macro Parser tests...');

// 1. Apple Health Shortcut JSON parsing
const mockShortcutJson = JSON.stringify({
  date: '2026-11-07',
  steps: 9250,
  activeEnergyKcal: 480,
  weightKg: 67.5,
  waterMl: 2200,
  sleepHours: 7.8,
  bodyFatPct: 15.2,
});

const parsedShortcut = parseAppleHealthShortcutJson(mockShortcutJson);
assert(parsedShortcut.length === 1, 'Shortcut should parse 1 day');
assert(parsedShortcut[0].steps === 9250, `Expected 9250 steps, got ${parsedShortcut[0].steps}`);
assert(parsedShortcut[0].weightKg === 67.5, `Expected 67.5kg, got ${parsedShortcut[0].weightKg}`);
assert(parsedShortcut[0].sleepHours === 7.8, `Expected 7.8h sleep, got ${parsedShortcut[0].sleepHours}`);

// 2. Apple Health XML parsing
const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData>
  <Record type="HKQuantityTypeIdentifierStepCount" startDate="2026-11-07 08:00:00" value="4500"/>
  <Record type="HKQuantityTypeIdentifierStepCount" startDate="2026-11-07 14:00:00" value="3500"/>
  <Record type="HKQuantityTypeIdentifierActiveEnergyBurned" startDate="2026-11-07 10:00:00" value="320"/>
  <Record type="HKQuantityTypeIdentifierBodyMass" startDate="2026-11-07 07:00:00" value="68.2"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2026-11-06 23:00:00" endDate="2026-11-07 07:00:00"/>
</HealthData>`;

const parsedXml = parseAppleHealthXml(mockXml, '2026-11-07');
assert(parsedXml.length === 1, 'XML should parse 1 day');
assert(parsedXml[0].steps === 8000, `Expected 8000 steps total, got ${parsedXml[0].steps}`);
assert(parsedXml[0].activeEnergyKcal === 320, `Expected 320 kcal, got ${parsedXml[0].activeEnergyKcal}`);
assert(parsedXml[0].weightKg === 68.2, `Expected 68.2kg, got ${parsedXml[0].weightKg}`);
assert(parsedXml[0].sleepHours === 8, `Expected 8h sleep, got ${parsedXml[0].sleepHours}`);

// 3. Structured Macro JSON parsing (Markdown block)
const mockMacroJsonBlock = `
Dưới đây là phân tích khẩu phần theo yêu cầu:

\`\`\`json
[
  {
    "slot": "breakfast",
    "name": "Phở Bò Tái Gầu",
    "amount": 550,
    "unit": "g",
    "kcal": 460,
    "protein": 35,
    "carbs": 58,
    "fat": 10
  },
  {
    "slot": "lunch",
    "name": "Cơm Tấm Sườn Bì",
    "amount": 380,
    "unit": "g",
    "kcal": 620,
    "protein": 38,
    "carbs": 75,
    "fat": 18
  }
]
\`\`\`

Chúc bạn tập luyện tốt!
`;

const parsedMacroJson = parseMacroTextResponse(mockMacroJsonBlock);
assert(parsedMacroJson.length === 2, `Expected 2 items, got ${parsedMacroJson.length}`);
assert(parsedMacroJson[0].name === 'Phở Bò Tái Gầu', `Expected Pho, got ${parsedMacroJson[0].name}`);
assert(parsedMacroJson[0].protein === 35, `Expected 35g protein, got ${parsedMacroJson[0].protein}`);
assert(parsedMacroJson[1].slot === 'lunch', `Expected lunch slot, got ${parsedMacroJson[1].slot}`);

// 4. Heuristic bullet list parsing
const mockMacroBullets = `
1. Ức gà áp chảo (200g): 330 kcal, 62g protein, 0g carb, 7g fat
2. Bát cơm trắng: 200 calo, 4g đạm, 44g carb, 0.5g béo
`;
const parsedBullets = parseMacroTextResponse(mockMacroBullets, 'dinner');
assert(parsedBullets.length === 2, `Expected 2 bullet items, got ${parsedBullets.length}`);
assert(parsedBullets[0].kcal === 330, `Expected 330 kcal, got ${parsedBullets[0].kcal}`);
assert(parsedBullets[0].protein === 62, `Expected 62g protein, got ${parsedBullets[0].protein}`);
assert(parsedBullets[0].slot === 'dinner', `Expected dinner slot, got ${parsedBullets[0].slot}`);

console.log('All Apple Health and Macro Parser tests passed successfully!');


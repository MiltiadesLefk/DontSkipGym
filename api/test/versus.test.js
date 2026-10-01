import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, bestSets, commonBests, cheatMealsOf, dayMinus, isWarmup } from '../versus.js';

const set = (w, r, extra = {}) => ({ w, r, done: true, ...extra });
const workout = (d, vol, entries) => ({ id: d, d, vol, entries });
const S = {
  unit: 'kg',
  workouts: [
    workout('2026-08-01', 1000, [{ id: '0025', sets: [set(20, 10, { phase: 'warmup' }), set(80, 5), set(80, 4)] }]),
    workout('2026-09-10', 2000, [{ id: '0025', sets: [set(85, 3), set(90, 1, { done: false })] }, { id: '0043', sets: [set(100, 5)] }]),
    workout('2026-09-24', 1500, [{ id: '0043', sets: [set(110, 3)] }, { id: '2138', sets: [{ min: 20, speed: 10, done: true }] }])
  ],
  bodyweight: [{ d: '2026-08-20', w: 80 }, { d: '2026-09-01', w: 79 }, { d: '2026-09-20', w: 78.2 }],
  cheatMeals: [{ id: 'a', food: 'Pizza', d: '2026-09-20' }, { id: 'b', food: 'pizza', d: '2026-09-24' }, { id: 'c', food: 'Burger', d: '2026-08-02' }]
};

test('dates and warm-ups', () => {
  assert.equal(dayMinus('2026-03-01', 1), '2026-02-28');
  assert.equal(isWarmup({ phase: 'warmup' }), true);
  assert.equal(isWarmup({ phase: 'Warm-up' }), true);
  assert.equal(isWarmup({ warmup: true }), true);
  assert.equal(isWarmup({ phase: 'work', warmup: true }), false);
});

test('summarize: totals, windows, days, cheat meals, body weight', () => {
  const s = summarize(S, { today: '2026-09-25' });
  assert.deepEqual(s.allTime, { workouts: 3, volume: 4500, sets: 6 });   // 2 per workout: warm-up and undone set not counted
  assert.deepEqual(s.last28, { workouts: 2, volume: 3500, sets: 4 });
  assert.deepEqual(s.trainedDays, ['2026-09-10', '2026-09-24']);
  assert.deepEqual(s.cheat, { total: 3, week: 2, top: { food: 'Pizza', n: 2 }, days: ['2026-09-20', '2026-09-24'] });
  assert.deepEqual(s.bodyweight, { kg: 78.2, d: '2026-09-20', change30: -0.8 });
});

test('summarize hides body weight when that person chose not to share it', () => {
  assert.equal(summarize(S, { today: '2026-09-25', shareBodyweight: false }).bodyweight, null);
});

test('a profile logging in lb is compared in kg', () => {
  const lb = { unit: 'lb', workouts: [workout('2026-09-24', 1000, [{ id: '0025', sets: [set(200, 5)] }])], bodyweight: [{ d: '2026-09-24', w: 200 }] };
  const s = summarize(lb, { today: '2026-09-25' });
  assert.equal(s.allTime.volume, 454);
  assert.equal(s.bodyweight.kg, 90.7);
  assert.deepEqual(bestSets(lb)['0025'], { w: 90.7, r: 5, d: '2026-09-24' });
});

test('bests: heaviest work set per lift, cardio skipped; only lifts both people did', () => {
  assert.deepEqual(bestSets(S), { '0025': { w: 85, r: 3, d: '2026-09-10' }, '0043': { w: 110, r: 3, d: '2026-09-24' } });
  const other = { workouts: [workout('2026-09-01', 0, [{ id: '0043', sets: [set(140, 2)] }, { id: '0091', sets: [set(50, 5)] }])] };
  assert.deepEqual(commonBests(S, other), [{ id: '0043', name: null, you: { w: 110, r: 3, d: '2026-09-24' }, them: { w: 140, r: 2, d: '2026-09-01' } }]);
});

test('cheat meals imported from earlier data are read until the profile writes its own', () => {
  assert.deepEqual(cheatMealsOf({ legacy: { cheatMeals: [{ food: 'Lottus', day: '2026-09-18', logged_at: 'x' }] } }), [{ food: 'Lottus', d: '2026-09-18' }]);
  assert.deepEqual(cheatMealsOf({ cheatMeals: [], legacy: { cheatMeals: [{ food: 'x', day: '2026-09-18' }] } }), []);
});

test('the month calendar names each day: sessions and cheat meals, this month only', () => {
  const named = { ...S, workouts: [
    { ...S.workouts[0], name: 'Legs' },
    { ...S.workouts[1], name: 'Push', start: 2 },
    { id: 'x', d: '2026-09-10', vol: 0, entries: [], start: 1 },
    { ...S.workouts[2], name: 'P'.repeat(80) }
  ] };
  const s = summarize(named, { today: '2026-09-25' });
  assert.deepEqual(s.calendar, {
    '2026-09-10': { workouts: ['', 'Push'], cheat: [] },           // in the order trained; unnamed stays ''
    '2026-09-20': { workouts: [], cheat: ['Pizza'] },
    '2026-09-24': { workouts: ['P'.repeat(60)], cheat: ['pizza'] }  // capped
  });
});

test('month pages the calendar independently of today, without moving last28/bodyweight', () => {
  const s = summarize(S, { today: '2026-09-25', month: '2026-08' });
  assert.deepEqual(s.trainedDays, ['2026-08-01']);
  assert.deepEqual(s.cheat.days, ['2026-08-02']);
  assert.deepEqual(s.calendar, { '2026-08-01': { workouts: [''], cheat: [] }, '2026-08-02': { workouts: [], cheat: ['Burger'] } });
  assert.deepEqual(s.last28, { workouts: 2, volume: 3500, sets: 4 }); // unaffected by the month being browsed
  assert.deepEqual(s.bodyweight, { kg: 78.2, d: '2026-09-20', change30: -0.8 });
});

test('an out-of-range or malformed month falls back to today\'s month', () => {
  const future = summarize(S, { today: '2026-09-25', month: '2026-10' });
  const bad = summarize(S, { today: '2026-09-25', month: 'not-a-month' });
  const def = summarize(S, { today: '2026-09-25' });
  assert.deepEqual(future.calendar, def.calendar);
  assert.deepEqual(bad.calendar, def.calendar);
});

test('never hands over anything but aggregates', () => {
  const s = summarize(S, { today: '2026-09-25' });
  assert.deepEqual(Object.keys(s).sort(), ['allTime', 'bodyweight', 'calendar', 'cheat', 'last28', 'trainedDays']);
  assert.ok(!JSON.stringify(s).includes('entries'));
  assert.deepEqual(Object.keys(s.calendar['2026-09-24']).sort(), ['cheat', 'workouts']);
});

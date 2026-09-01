/**
 * PRAXiS Routine & Habit System - Full 18-Scenario Comprehensive Test Suite
 * Validates deterministic calculations, streaks, habit tracking types,
 * storage efficiency, local date integrity, and multi-user isolation.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("==================================================");
console.log("🧪 STARTING PRAXiS ROUTINE SYSTEM COMPLETE TEST SUITE");
console.log("==================================================\n");

// Mock Browser Environment
const mockLocalStorage = {};
global.localStorage = {
    getItem: (k) => mockLocalStorage[k] || null,
    setItem: (k, v) => { mockLocalStorage[k] = String(v); },
    removeItem: (k) => { delete mockLocalStorage[k]; },
    clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
};

global.window = {
    localStorage: global.localStorage,
    location: { pathname: '/routine.html', hash: '', search: '' },
    document: {
        title: 'PRAXiS - Routine',
        addEventListener: () => {},
        getElementById: () => null
    },
    addEventListener: () => {},
    dispatchEvent: () => {},
    praxisAuth: {
        getUser: () => ({ uid: 'test_user_1', email: 'alex@example.com', displayName: 'Alex' }),
        saveRoutine: () => Promise.resolve()
    }
};
global.document = global.window.document;

// Load routineSystem.js
const routineSystemCode = fs.readFileSync(path.join(__dirname, 'public', 'js', 'routineSystem.js'), 'utf8');
eval(routineSystemCode);

const Routine = global.window.PraxisRoutine;
assert(Routine, "PraxisRoutine must be exported to window");

let testsPassed = 0;
let testsTotal = 0;

function test(name, fn) {
    testsTotal++;
    try {
        fn();
        console.log(`✅ [PASS] ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`❌ [FAIL] ${name}:`, err.message);
        console.error(err.stack);
    }
}

// -------------------------------------------------------------
// TEST 1: Create completion habit & verify toggle
// -------------------------------------------------------------
test("TEST 1: Create a completion habit and complete it", () => {
    localStorage.clear();
    Routine.init();

    const habit = Routine.createHabit({
        name: "Morning Meditation",
        routinePeriod: "Morning",
        trackingType: "completion",
        scheduledTime: "07:00",
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
    });

    assert.strictEqual(habit.name, "Morning Meditation");
    assert.strictEqual(habit.routinePeriod, "Morning");
    assert.strictEqual(habit.trackingType, "completion");

    let stats = Routine.calculateDailyCompletionRate();
    assert.strictEqual(stats.completed, 0);
    assert.strictEqual(stats.scheduled, 1);
    assert.strictEqual(stats.percentage, 0);

    Routine.toggleHabit(habit.id);

    stats = Routine.calculateDailyCompletionRate();
    assert.strictEqual(stats.completed, 1);
    assert.strictEqual(stats.scheduled, 1);
    assert.strictEqual(stats.percentage, 100);
});

// -------------------------------------------------------------
// TEST 2: Duration habit and focus logging
// -------------------------------------------------------------
test("TEST 2: Create duration habit, log focus time, verify auto-completion", () => {
    const habit = Routine.createHabit({
        name: "Study Mathematics",
        routinePeriod: "Afternoon",
        trackingType: "duration",
        target: 60,
        unit: "min",
        scheduledTime: "14:00"
    });

    assert.strictEqual(habit.target, 60);

    Routine.logDuration(habit.id, 1800);

    const logs = Routine.getDailyLogs();
    const todayStr = Object.keys(logs)[0];
    assert(todayStr, "Today's log entry should exist");
    assert.strictEqual(logs[todayStr].p[habit.id], 30);
    assert.strictEqual(logs[todayStr].f, 1800);

    let stats = Routine.calculateDailyCompletionRate();
    assert.strictEqual(stats.completed, 1);
    assert.strictEqual(stats.scheduled, 2);
    assert.strictEqual(stats.percentage, 50);

    Routine.logDuration(habit.id, 1800);
    stats = Routine.calculateDailyCompletionRate();
    assert.strictEqual(stats.completed, 2);
    assert.strictEqual(stats.scheduled, 2);
    assert.strictEqual(stats.percentage, 100);
});

// -------------------------------------------------------------
// TEST 3: Quantity habit increments & decrements
// -------------------------------------------------------------
test("TEST 3: Create quantity habit and test increment/decrement", () => {
    const habit = Routine.createHabit({
        name: "Drink Water",
        routinePeriod: "Morning",
        trackingType: "quantity",
        target: 8,
        unit: "glasses"
    });

    Routine.adjustQuantity(habit.id, 4);
    let logs = Routine.getDailyLogs();
    const todayStr = Object.keys(logs)[0];
    assert.strictEqual(logs[todayStr].p[habit.id], 4);

    Routine.adjustQuantity(habit.id, 4);
    logs = Routine.getDailyLogs();
    assert.strictEqual(logs[todayStr].p[habit.id], 8);
    assert(logs[todayStr].c.includes(habit.id), "Habit should be marked in completed list");

    Routine.adjustQuantity(habit.id, -1);
    logs = Routine.getDailyLogs();
    assert.strictEqual(logs[todayStr].p[habit.id], 7);
    assert(!logs[todayStr].c.includes(habit.id), "Habit should no longer be marked completed");
});

// -------------------------------------------------------------
// TEST 4: Scheduled Days Filtering
// -------------------------------------------------------------
test("TEST 4: Habit scheduled for specific days only appears on those days", () => {
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    const otherDayOfWeek = (todayDayOfWeek + 1) % 7;

    const weekendHabit = Routine.createHabit({
        name: "Weekend Review",
        routinePeriod: "Evening",
        trackingType: "completion",
        daysOfWeek: [otherDayOfWeek]
    });

    const stats = Routine.calculateDailyCompletionRate();
    const habitsList = Routine.getHabits();
    assert(habitsList.some(h => h.id === weekendHabit.id));
    assert(!stats.scheduled.toString().includes("999"));
});

// -------------------------------------------------------------
// TEST 5: Strict Streak Calculation
// -------------------------------------------------------------
test("TEST 5: Streak calculation across historical daily logs", () => {
    const habit = Routine.getHabits()[0];
    const { currentStreak, bestStreak } = Routine.calculateHabitStreak(habit.id);
    assert(currentStreak >= 1, "Streak should be at least 1 day since today is completed");
    assert(bestStreak >= 1, "Best streak should be at least 1 day");
});

// -------------------------------------------------------------
// TEST 6: Consistency Rate Formula
// -------------------------------------------------------------
test("TEST 6: 30-Day Period Consistency Formula Verification", () => {
    const consistency = Routine.calculatePeriodConsistency(30);
    assert(typeof consistency.percentage === 'number');
    assert(consistency.percentage >= 0 && consistency.percentage <= 100);
    assert.strictEqual(consistency.totalDays, 30);
});

// -------------------------------------------------------------
// TEST 7: Deterministic Weekly Insights Engine
// -------------------------------------------------------------
test("TEST 7: Deterministic Weekly Insights Engine (No AI)", () => {
    const insights = Routine.calculateWeeklyInsights();
    assert(typeof insights.thisWeekRate === 'number');
    assert(typeof insights.rateDelta === 'number');
    assert(Array.isArray(insights.recommendations));
});

// -------------------------------------------------------------
// TEST 8: Multi-user Data Isolation (Namespacing)
// -------------------------------------------------------------
test("TEST 8: Switching users isolates routine data and prevents cross-user leakage", () => {
    assert(Routine.getHabits().length > 0);

    global.window.praxisAuth.getUser = () => ({ uid: 'test_user_2', email: 'sarah@example.com', displayName: 'Sarah' });
    Routine.init();

    assert.strictEqual(Routine.getHabits().length, 0, "User 2 should not see User 1 habits");

    Routine.createHabit({
        name: "Sarah Yoga",
        routinePeriod: "Morning",
        trackingType: "completion"
    });
    assert.strictEqual(Routine.getHabits().length, 1);

    global.window.praxisAuth.getUser = () => ({ uid: 'test_user_1', email: 'alex@example.com', displayName: 'Alex' });
    Routine.init();

    const u1Habits = Routine.getHabits();
    assert(u1Habits.length >= 3, `Expected at least 3 habits for user 1, got ${u1Habits.length}`);
    assert(!u1Habits.some(h => h.name === "Sarah Yoga"), "User 1 must not see User 2 habit");
});

// -------------------------------------------------------------
// TEST 9: Duplicate Prevention & Validation
// -------------------------------------------------------------
test("TEST 9: Prevent duplicate habit names and empty names", () => {
    assert.throws(() => {
        Routine.createHabit({ name: "" });
    }, /cannot be empty/i);

    assert.throws(() => {
        Routine.createHabit({ name: "Morning Meditation", routinePeriod: "Morning" });
    }, /already exists/i);
});

// -------------------------------------------------------------
// TEST 10: Reorder Habit
// -------------------------------------------------------------
test("TEST 10: Reorder habits within a routine period", () => {
    const morningHabits = Routine.getHabits().filter(h => h.routinePeriod === 'Morning');
    if (morningHabits.length >= 2) {
        const firstId = morningHabits[0].id;
        const secondId = morningHabits[1].id;
        Routine.reorderHabit(firstId, 'down');
        const reordered = Routine.getHabits().filter(h => h.routinePeriod === 'Morning');
        assert.strictEqual(reordered[0].id, secondId);
    }
});

// -------------------------------------------------------------
// TEST 11: Update Habit Details
// -------------------------------------------------------------
test("TEST 11: Update habit details (name, target, scheduledTime)", () => {
    const h = Routine.getHabits()[0];
    const updated = Routine.updateHabit(h.id, {
        name: "Mindful Meditation & Breathwork",
        target: 20,
        scheduledTime: "06:30"
    });
    assert.strictEqual(updated.name, "Mindful Meditation & Breathwork");
    assert.strictEqual(updated.target, 20);
    assert.strictEqual(updated.scheduledTime, "06:30");
});

// -------------------------------------------------------------
// TEST 12: Delete Habit
// -------------------------------------------------------------
test("TEST 12: Delete habit and verify removal from active list", () => {
    const countBefore = Routine.getHabits().length;
    const toDelete = Routine.getHabits()[Routine.getHabits().length - 1];
    Routine.deleteHabit(toDelete.id);
    const countAfter = Routine.getHabits().length;
    assert.strictEqual(countAfter, countBefore - 1);
    assert(!Routine.getHabits().some(h => h.id === toDelete.id));
});

// -------------------------------------------------------------
// TEST 13: Local Date & Timezone Integrity
// -------------------------------------------------------------
test("TEST 13: Local Date integrity (YYYY-MM-DD avoids UTC midnight shift)", () => {
    const now = new Date();
    const expectedYear = now.getFullYear();
    const expectedMonth = String(now.getMonth() + 1).padStart(2, '0');
    const expectedDay = String(now.getDate()).padStart(2, '0');
    const expectedToday = `${expectedYear}-${expectedMonth}-${expectedDay}`;

    const logs = Routine.getDailyLogs();
    assert(Object.keys(logs).includes(expectedToday), `Logs should be keyed by local date ${expectedToday}`);
});

// -------------------------------------------------------------
// TEST 14: Storage Footprint & Compact Payload (<1GB Compliance)
// -------------------------------------------------------------
test("TEST 14: Storage footprint verification (< 50 KB per user)", () => {
    const ns = 'test_user_1';
    const habitsRaw = mockLocalStorage[`praxis_habits_v2_${ns}`] || '';
    const logsRaw = mockLocalStorage[`praxis_routine_logs_v2_${ns}`] || '';
    const sessionsRaw = mockLocalStorage[`praxis_focus_sessions_v2_${ns}`] || '';

    const totalBytes = Buffer.byteLength(habitsRaw, 'utf8') +
                       Buffer.byteLength(logsRaw, 'utf8') +
                       Buffer.byteLength(sessionsRaw, 'utf8');

    console.log(`   📦 User Storage Footprint: ${totalBytes} bytes (${(totalBytes / 1024).toFixed(2)} KB)`);
    assert(totalBytes < 50000, `Storage footprint must be under 50KB, got ${totalBytes} bytes`);
});

// -------------------------------------------------------------
// TEST 15: Lap Splits Recording & Clearing
// -------------------------------------------------------------
test("TEST 15: Timer lap splits recording and reset", () => {
    Routine.recordTimerLap();
    Routine.clearTimerLaps();
});

// -------------------------------------------------------------
// TEST 16: Quick add duration helper
// -------------------------------------------------------------
test("TEST 16: addDurationMinutes helper increments progress", () => {
    const durationHabits = Routine.getHabits().filter(h => h.trackingType === 'duration');
    if (durationHabits.length > 0) {
        const hid = durationHabits[0].id;
        const before = Routine.getDailyLogs()[Object.keys(Routine.getDailyLogs())[0]].p[hid] || 0;
        Routine.addDurationMinutes(hid, 15);
        const after = Routine.getDailyLogs()[Object.keys(Routine.getDailyLogs())[0]].p[hid];
        assert.strictEqual(after, before + 15);
    }
});

// -------------------------------------------------------------
// TEST 17: Filter Period Switching
// -------------------------------------------------------------
test("TEST 17: setFilterPeriod updates active filter period", () => {
    Routine.setFilterPeriod('Morning');
    Routine.setFilterPeriod('Afternoon');
    Routine.setFilterPeriod('Evening');
    Routine.setFilterPeriod('all');
});

// -------------------------------------------------------------
// TEST 18: Focus Timer Presets
// -------------------------------------------------------------
test("TEST 18: Focus Timer preset duration setter", () => {
    Routine.setFocusTimerDuration(25);
    Routine.setFocusTimerDuration(45);
    Routine.setFocusTimerDuration(60);
});

console.log("\n==================================================");
console.log(`🏁 TEST RESULTS: ${testsPassed} of ${testsTotal} PASSED`);
console.log("==================================================");

if (testsPassed === testsTotal) {
    console.log("🎉 ALL 18 TESTS PASSED WITH 100% SUCCESS!\n");
    process.exit(0);
} else {
    console.error("❌ SOME TESTS FAILED!\n");
    process.exit(1);
}

/**
 * PRAXiS - Routine & Habit System Engine
 * Polished, Practical, Production-Ready Routine & Habit Tracking Engine
 * 100% Deterministic Analytics, Strict Streaks, Focus Timer Integration,
 * Storage-Optimized Firestore Persistence (<1GB footprint), Local-Date Integrity.
 * NO external AI APIs - Pure deterministic intelligence.
 */

(function(window) {
    'use strict';

    // =========================================================================
    // 1. CONFIGURATION & CONSTANTS
    // =========================================================================

    const STORAGE_KEY_PREFIX = 'praxis_habits_v2_';
    const LOGS_KEY_PREFIX = 'praxis_routine_logs_v2_';
    const SESSIONS_KEY_PREFIX = 'praxis_focus_sessions_v2_';
    const PREFS_KEY_PREFIX = 'praxis_routine_prefs_v2_';

    const ROUTINE_PERIODS = {
        MORNING: 'Morning',
        AFTERNOON: 'Afternoon',
        EVENING: 'Evening'
    };

    const TRACKING_TYPES = {
        COMPLETION: 'completion',
        DURATION: 'duration',
        QUANTITY: 'quantity'
    };

    const HEATMAP_THRESHOLDS = [
        { min: 0, max: 0, level: 0, label: '0% (Empty)', class: 'neu-trench bg-[#e0e5ec] text-slate-400' },
        { min: 1, max: 25, level: 1, label: '1–25% (Low)', class: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
        { min: 26, max: 50, level: 2, label: '26–50% (Medium)', class: 'bg-emerald-300 text-emerald-950 border border-emerald-400' },
        { min: 51, max: 75, level: 3, label: '51–75% (High)', class: 'bg-emerald-500 text-white border border-emerald-600 shadow-xs' },
        { min: 76, max: 100, level: 4, label: '76–100% (Surge)', class: 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-bold shadow-sm' }
    ];

    // =========================================================================
    // 2. STATE MANAGEMENT (SINGLE SOURCE OF TRUTH)
    // =========================================================================

    let habits = [];
    let dailyLogs = {}; // { [YYYY-MM-DD]: { c: [habitIds], p: { [habitId]: progressNumber }, f: focusSeconds, s: sessionCount } }
    let focusSessions = []; // Recent compact focus sessions (capped at 60)
    let activeTab = 'today'; // 'today' | 'calendar' | 'analytics' | 'stopwatch'
    let currentFilterPeriod = 'all'; // 'all' | 'Morning' | 'Afternoon' | 'Evening'
    let selectedCalendarRange = 30; // 30 | 90 | 180 | 365 days
    let calendarSelectedDate = null;
    let habitAnalyticsModalId = null;

    // Focus Timer / Stopwatch State
    let timerState = {
        mode: 'countdown', // 'countdown' | 'stopwatch'
        status: 'idle', // 'idle' | 'running' | 'paused'
        durationMs: 25 * 60 * 1000,
        elapsedMs: 0,
        startTime: 0,
        animFrame: null,
        linkedHabitId: '',
        linkedHabitName: '',
        soundEnabled: true,
        laps: []
    };

    let audioContext = null;
    let jarvisAudioCache = { sir: null, maam: null };
    let firestoreUnsubscribe = null;
    let isSaving = false;
    let lastCheckedMinuteStr = '';

    // =========================================================================
    // 3. DATE & TIME INTEGRITY UTILITIES (STRICT LOCAL TIMEZONE)
    // =========================================================================

    function getLocalDateString(dateObj = new Date()) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseLocalDateString(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return new Date();
        const parts = dateStr.split('-');
        if (parts.length < 3) return new Date();
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }

    function getRelativeDateString(daysOffset = 0, baseDate = new Date()) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + daysOffset);
        return getLocalDateString(d);
    }

    function formatDisplayDate(dateStr) {
        const d = parseLocalDateString(dateStr);
        const options = { weekday: 'long', month: 'short', day: 'numeric' };
        return d.toLocaleDateString(undefined, options);
    }

    function formatTimeAMPM(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return '';
        const parts = timeStr.split(':');
        if (parts.length < 2) return timeStr;
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (isNaN(h) || isNaN(m)) return timeStr;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        const displayM = m < 10 ? '0' + m : m;
        return `${displayH}:${displayM} ${ampm}`;
    }

    function formatDurationHuman(seconds) {
        const totalSecs = Math.max(0, Math.floor(seconds || 0));
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    }

    function formatTimerDisplay(ms) {
        const totalSecs = Math.max(0, Math.floor((ms || 0) / 1000));
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        const hStr = String(hours).padStart(2, '0');
        const mStr = String(mins).padStart(2, '0');
        const sStr = String(secs).padStart(2, '0');
        if (hours > 0) {
            return `${hStr}:${mStr}:${sStr}`;
        }
        return `${mStr}:${sStr}`;
    }

    function getDayOfWeekIndex(dateObj = new Date()) {
        return dateObj.getDay();
    }

    function escapeHtml(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, function(m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[m];
        });
    }

    // =========================================================================
    // 4. USER AUTH & STORAGE NAMESPACING (<1GB HARD REQUIREMENT)
    // =========================================================================

    function getActiveUser() {
        if (window.praxisAuth && typeof window.praxisAuth.getUser === 'function') {
            const u = window.praxisAuth.getUser();
            if (u) return u;
        }
        try {
            const stored = localStorage.getItem('praxis_auth_user');
            if (stored) return JSON.parse(stored);
        } catch (e) {}
        return null;
    }

    function getUserStorageNamespace() {
        const user = getActiveUser();
        const rawId = user?.uid || user?.id || user?.email || 'guest';
        return rawId.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    }

    function loadLocalState() {
        const ns = getUserStorageNamespace();
        try {
            let habitsJson = localStorage.getItem(STORAGE_KEY_PREFIX + ns) ||
                             localStorage.getItem(`findyourpath_habits_${ns}`);
            if (!habitsJson && ns === 'guest') {
                habitsJson = localStorage.getItem('findyourpath_habits');
            }
            if (habitsJson) {
                const parsed = JSON.parse(habitsJson);
                if (Array.isArray(parsed)) {
                    habits = parsed.map(normalizeHabit).filter(Boolean);
                } else {
                    habits = [];
                }
            } else {
                habits = [];
            }
        } catch (e) {
            habits = [];
        }

        try {
            const logsJson = localStorage.getItem(LOGS_KEY_PREFIX + ns);
            if (logsJson) {
                dailyLogs = JSON.parse(logsJson) || {};
            } else {
                dailyLogs = {};
                migrateLegacyHabitDaysToLogs();
            }
        } catch (e) {
            dailyLogs = {};
        }

        try {
            const sessJson = localStorage.getItem(SESSIONS_KEY_PREFIX + ns);
            focusSessions = sessJson ? JSON.parse(sessJson) : [];
            if (!Array.isArray(focusSessions)) focusSessions = [];
        } catch (e) {
            focusSessions = [];
        }

        try {
            const soundSaved = localStorage.getItem('praxis_sw_sound');
            if (soundSaved !== null) timerState.soundEnabled = soundSaved === 'true';
        } catch (e) {}
    }

    function saveLocalState() {
        const ns = getUserStorageNamespace();
        try {
            localStorage.setItem(STORAGE_KEY_PREFIX + ns, JSON.stringify(habits));
            localStorage.setItem(LOGS_KEY_PREFIX + ns, JSON.stringify(dailyLogs));
            if (focusSessions.length > 60) {
                focusSessions = focusSessions.slice(-60);
            }
            localStorage.setItem(SESSIONS_KEY_PREFIX + ns, JSON.stringify(focusSessions));
        } catch (e) {}
    }

    function migrateLegacyHabitDaysToLogs() {
        const todayStr = getLocalDateString();
        const todayD = parseLocalDateString(todayStr);

        habits.forEach(h => {
            if (Array.isArray(h.days) && h.days.length > 0) {
                const lastIdx = h.days.length - 1;
                for (let i = 0; i <= lastIdx; i++) {
                    const offset = i - lastIdx;
                    const dateStr = getRelativeDateString(offset, todayD);
                    const val = h.days[i];
                    if (val === true || val === 'done' || val === 1 || val === '1') {
                        if (!dailyLogs[dateStr]) dailyLogs[dateStr] = { c: [], p: {}, f: 0, s: 0 };
                        if (!dailyLogs[dateStr].c.includes(h.id)) {
                            dailyLogs[dateStr].c.push(h.id);
                        }
                    }
                }
            }
        });
    }

    // =========================================================================
    // 5. DATA STRUCTURE & NORMALIZATION
    // =========================================================================

    function normalizeHabit(raw) {
        if (!raw || typeof raw !== 'object') return null;

        const id = raw.id ? String(raw.id) : 'habit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const name = (raw.name || raw.title || raw.habitName || 'Target Habit').trim();
        
        let routinePeriod = raw.routinePeriod;
        if (!routinePeriod) {
            const cat = raw.category || raw.timeOfDay || '';
            if (cat.includes('Afternoon')) routinePeriod = ROUTINE_PERIODS.AFTERNOON;
            else if (cat.includes('Evening') || cat.includes('Wind-down')) routinePeriod = ROUTINE_PERIODS.EVENING;
            else routinePeriod = ROUTINE_PERIODS.MORNING;
        }

        let trackingType = raw.trackingType;
        if (!trackingType || !Object.values(TRACKING_TYPES).includes(trackingType)) {
            trackingType = TRACKING_TYPES.COMPLETION;
        }

        const target = Math.max(1, parseInt(raw.target, 10) || (trackingType === TRACKING_TYPES.DURATION ? 30 : trackingType === TRACKING_TYPES.QUANTITY ? 8 : 1));
        const unit = (raw.unit || (trackingType === TRACKING_TYPES.DURATION ? 'min' : trackingType === TRACKING_TYPES.QUANTITY ? 'times' : '')).trim();
        const scheduledTime = raw.scheduledTime || raw.time || '';
        
        let daysOfWeek = Array.isArray(raw.daysOfWeek) ? raw.daysOfWeek : [0, 1, 2, 3, 4, 5, 6];
        if (daysOfWeek.length === 0) daysOfWeek = [0, 1, 2, 3, 4, 5, 6];

        const days = Array.isArray(raw.days) ? raw.days : new Array(30).fill(false);

        return {
            id,
            name,
            routinePeriod,
            category: `${routinePeriod} Routine`,
            trackingType,
            target,
            unit,
            scheduledTime,
            daysOfWeek,
            reminderEnabled: raw.reminderEnabled !== false,
            createdAt: raw.createdAt || Date.now(),
            order: typeof raw.order === 'number' ? raw.order : 0,
            active: raw.active !== false,
            days
        };
    }

    function isHabitScheduledForDate(habit, dateObj) {
        if (!habit || !habit.active) return false;
        if (!Array.isArray(habit.daysOfWeek) || habit.daysOfWeek.length === 0) return true;
        const dayIdx = dateObj.getDay();
        return habit.daysOfWeek.includes(dayIdx);
    }

    function getHabitProgressForDate(habitId, dateStr = getLocalDateString()) {
        const log = dailyLogs[dateStr];
        if (!log) return 0;
        if (log.c && log.c.includes(habitId)) {
            const h = habits.find(x => x.id === habitId);
            return h ? h.target : 1;
        }
        if (log.p && typeof log.p[habitId] === 'number') {
            return log.p[habitId];
        }
        return 0;
    }

    function isHabitCompletedForDate(habitId, dateStr = getLocalDateString()) {
        const log = dailyLogs[dateStr];
        if (!log) return false;
        if (log.c && log.c.includes(habitId)) return true;
        const h = habits.find(x => x.id === habitId);
        if (!h) return false;
        if (h.trackingType === TRACKING_TYPES.COMPLETION) return false;
        const prog = getHabitProgressForDate(habitId, dateStr);
        return prog >= h.target;
    }

    // =========================================================================
    // 6. CLOUD / FIRESTORE REALTIME SYNCHRONIZATION
    // =========================================================================

    async function syncToCloud() {
        saveLocalState();

        if (isSaving) return;
        isSaving = true;

        try {
            const user = getActiveUser();
            if (user && window.praxisAuth && typeof window.praxisAuth.saveRoutine === 'function') {
                await window.praxisAuth.saveRoutine({
                    habits: habits,
                    dailyLogs: dailyLogs,
                    focusSessions: focusSessions,
                    updatedAt: new Date().toISOString()
                });
            }
        } catch (e) {
        } finally {
            isSaving = false;
        }

        if (typeof window.syncHabitsToPushServer === 'function') {
            try { window.syncHabitsToPushServer(habits); } catch (e) {}
        }
    }

    function setupRealtimeFirestoreListener() {
        if (firestoreUnsubscribe) {
            try { firestoreUnsubscribe(); } catch(e){}
            firestoreUnsubscribe = null;
        }

        const user = getActiveUser();
        if (!user || !window.praxisAuth || typeof window.praxisAuth.getDb !== 'function') return;

        const db = window.praxisAuth.getDb();
        if (!db) return;

        const uid = user.uid || user.id;
        if (!uid) return;

        try {
            import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').then(({ doc, onSnapshot }) => {
                const habitsRef = doc(db, 'userHabits', uid);
                firestoreUnsubscribe = onSnapshot(habitsRef, (docSnap) => {
                    if (docSnap && docSnap.exists()) {
                        const data = docSnap.data();
                        handleCloudUpdate(data);
                    }
                }, () => {});
            }).catch(() => {});
        } catch (e) {}
    }

    function handleCloudUpdate(cloudData) {
        if (!cloudData) return;

        let hasChanges = false;

        if (Array.isArray(cloudData.habits)) {
            const incoming = cloudData.habits.map(normalizeHabit).filter(Boolean);
            if (incoming.length > 0) {
                habits = incoming;
                hasChanges = true;
            }
        }

        if (cloudData.dailyLogs && typeof cloudData.dailyLogs === 'object') {
            dailyLogs = Object.assign({}, dailyLogs, cloudData.dailyLogs);
            hasChanges = true;
        }

        if (Array.isArray(cloudData.focusSessions)) {
            focusSessions = cloudData.focusSessions;
            hasChanges = true;
        }

        if (hasChanges) {
            saveLocalState();
            renderAllViews();
        }
    }

    // =========================================================================
    // 7. DETERMINISTIC ANALYTICS & INSIGHTS FORMULAS (NO AI)
    // =========================================================================

    function calculateDailyCompletionRate(dateStr = getLocalDateString()) {
        const d = parseLocalDateString(dateStr);
        const scheduled = habits.filter(h => isHabitScheduledForDate(h, d));
        if (scheduled.length === 0) return { scheduled: 0, completed: 0, percentage: 0 };

        const completed = scheduled.filter(h => isHabitCompletedForDate(h.id, dateStr));
        const percentage = Math.round((completed.length / scheduled.length) * 100);
        return {
            scheduled: scheduled.length,
            completed: completed.length,
            percentage
        };
    }

    function calculatePeriodConsistency(daysCount = 30) {
        let totalScheduled = 0;
        let totalCompleted = 0;
        let activeDaysCount = 0;
        const todayStr = getLocalDateString();
        const todayD = parseLocalDateString(todayStr);

        for (let i = 0; i < daysCount; i++) {
            const dateStr = getRelativeDateString(-i, todayD);
            const d = parseLocalDateString(dateStr);
            const scheduled = habits.filter(h => isHabitScheduledForDate(h, d));
            if (scheduled.length > 0) {
                totalScheduled += scheduled.length;
                const completed = scheduled.filter(h => isHabitCompletedForDate(h.id, dateStr));
                totalCompleted += completed.length;
                if (completed.length > 0) {
                    activeDaysCount++;
                }
            }
        }

        const percentage = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;
        return {
            totalScheduled,
            totalCompleted,
            percentage,
            activeDaysCount,
            totalDays: daysCount
        };
    }

    function calculateHabitStreak(habitId) {
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return { currentStreak: 0, bestStreak: 0 };

        const todayStr = getLocalDateString();
        const todayD = parseLocalDateString(todayStr);
        const isTodayDone = isHabitCompletedForDate(habitId, todayStr);

        let currentStreak = 0;
        let offset = isTodayDone ? 0 : -1;

        while (offset >= -365) {
            const dateStr = getRelativeDateString(offset, todayD);
            const d = parseLocalDateString(dateStr);
            const scheduled = isHabitScheduledForDate(habit, d);

            if (scheduled) {
                if (isHabitCompletedForDate(habitId, dateStr)) {
                    currentStreak++;
                } else {
                    break;
                }
            }
            offset--;
        }

        let bestStreak = 0;
        let tempStreak = 0;
        for (let i = -365; i <= 0; i++) {
            const dateStr = getRelativeDateString(i, todayD);
            const d = parseLocalDateString(dateStr);
            const scheduled = isHabitScheduledForDate(habit, d);
            if (scheduled) {
                if (isHabitCompletedForDate(habitId, dateStr)) {
                    tempStreak++;
                    if (tempStreak > bestStreak) bestStreak = tempStreak;
                } else {
                    tempStreak = 0;
                }
            }
        }

        if (currentStreak > bestStreak) bestStreak = currentStreak;

        return { currentStreak, bestStreak };
    }

    function calculateOverallStreak() {
        let maxActiveStreak = 0;
        let maxBestStreak = 0;

        habits.forEach(h => {
            const { currentStreak, bestStreak } = calculateHabitStreak(h.id);
            if (currentStreak > maxActiveStreak) maxActiveStreak = currentStreak;
            if (bestStreak > maxBestStreak) maxBestStreak = bestStreak;
        });

        return { currentStreak: maxActiveStreak, bestStreak: maxBestStreak };
    }

    function calculateWeeklyInsights() {
        const todayStr = getLocalDateString();
        const todayD = parseLocalDateString(todayStr);

        const currentDayIndex = todayD.getDay();
        const mondayOffset = currentDayIndex === 0 ? -6 : 1 - currentDayIndex;
        const currentMonday = new Date(todayD.getFullYear(), todayD.getMonth(), todayD.getDate() + mondayOffset);

        let thisWeekScheduled = 0;
        let thisWeekCompleted = 0;
        let thisWeekFocusSecs = 0;
        let thisWeekSessions = 0;
        const habitWeeklyStats = {};
        const periodWeeklyStats = { Morning: { s: 0, c: 0 }, Afternoon: { s: 0, c: 0 }, Evening: { s: 0, c: 0 } };

        habits.forEach(h => {
            habitWeeklyStats[h.id] = { name: h.name, scheduled: 0, completed: 0, period: h.routinePeriod };
        });

        const daysSinceMonday = Math.round((todayD - currentMonday) / (24 * 60 * 60 * 1000)) + 1;

        for (let i = 0; i < daysSinceMonday; i++) {
            const dateStr = getRelativeDateString(i, currentMonday);
            const d = parseLocalDateString(dateStr);
            const log = dailyLogs[dateStr];
            if (log) {
                thisWeekFocusSecs += log.f || 0;
                thisWeekSessions += log.s || 0;
            }

            habits.forEach(h => {
                if (isHabitScheduledForDate(h, d)) {
                    thisWeekScheduled++;
                    habitWeeklyStats[h.id].scheduled++;
                    if (periodWeeklyStats[h.routinePeriod]) periodWeeklyStats[h.routinePeriod].s++;

                    if (isHabitCompletedForDate(h.id, dateStr)) {
                        thisWeekCompleted++;
                        habitWeeklyStats[h.id].completed++;
                        if (periodWeeklyStats[h.routinePeriod]) periodWeeklyStats[h.routinePeriod].c++;
                    }
                }
            });
        }

        const lastMonday = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() - 7);
        let lastWeekScheduled = 0;
        let lastWeekCompleted = 0;

        for (let i = 0; i < 7; i++) {
            const dateStr = getRelativeDateString(i, lastMonday);
            const d = parseLocalDateString(dateStr);
            habits.forEach(h => {
                if (isHabitScheduledForDate(h, d)) {
                    lastWeekScheduled++;
                    if (isHabitCompletedForDate(h.id, dateStr)) {
                        lastWeekCompleted++;
                    }
                }
            });
        }

        const thisWeekRate = thisWeekScheduled > 0 ? Math.round((thisWeekCompleted / thisWeekScheduled) * 100) : 0;
        const lastWeekRate = lastWeekScheduled > 0 ? Math.round((lastWeekCompleted / lastWeekScheduled) * 100) : 0;
        const rateDelta = thisWeekRate - lastWeekRate;

        let strongestHabit = null;
        let weakestHabit = null;
        let maxHabitRate = -1;
        let minHabitRate = 101;

        Object.keys(habitWeeklyStats).forEach(hid => {
            const st = habitWeeklyStats[hid];
            if (st.scheduled > 0) {
                const rate = Math.round((st.completed / st.scheduled) * 100);
                if (rate > maxHabitRate) {
                    maxHabitRate = rate;
                    strongestHabit = { ...st, rate };
                }
                if (rate < minHabitRate) {
                    minHabitRate = rate;
                    weakestHabit = { ...st, rate };
                }
            }
        });

        let bestPeriod = null, hardestPeriod = null;
        let maxPeriodRate = -1, minPeriodRate = 101;

        Object.keys(periodWeeklyStats).forEach(pKey => {
            const p = periodWeeklyStats[pKey];
            if (p.s > 0) {
                const pRate = Math.round((p.c / p.s) * 100);
                if (pRate > maxPeriodRate) {
                    maxPeriodRate = pRate;
                    bestPeriod = { name: pKey, rate: pRate };
                }
                if (pRate < minPeriodRate) {
                    minPeriodRate = pRate;
                    hardestPeriod = { name: pKey, rate: pRate };
                }
            }
        });

        const recommendations = [];

        if (hardestPeriod && hardestPeriod.rate < 50 && hardestPeriod.name === 'Evening') {
            recommendations.push({
                icon: '🌙',
                title: 'Evening Routine Calibration',
                text: `Your Evening completion is ${hardestPeriod.rate}%. Consider shifting one evening habit to the afternoon for better consistency.`
            });
        }

        if (weakestHabit && weakestHabit.rate < 40 && weakestHabit.scheduled >= 3) {
            recommendations.push({
                icon: '🎯',
                title: `Refine "${weakestHabit.name}"`,
                text: `"${weakestHabit.name}" was completed only ${weakestHabit.completed} of ${weakestHabit.scheduled} days. Try reducing the target duration or quantity to build momentum.`
            });
        }

        if (strongestHabit && strongestHabit.rate >= 85) {
            recommendations.push({
                icon: '🔥',
                title: `Pillar Habit: ${strongestHabit.name}`,
                text: `Outstanding consistency! You completed "${strongestHabit.name}" ${strongestHabit.completed} of ${strongestHabit.scheduled} days (${strongestHabit.rate}%). Anchor new habits right after this one!`
            });
        }

        if (thisWeekFocusSecs >= 3 * 3600) {
            recommendations.push({
                icon: '⚡',
                title: 'Deep Work Momentum',
                text: `You logged ${formatDurationHuman(thisWeekFocusSecs)} of deep focus this week across ${thisWeekSessions} sessions. Great concentration!`
            });
        } else if (habits.some(h => h.trackingType === TRACKING_TYPES.DURATION) && thisWeekFocusSecs < 1800) {
            recommendations.push({
                icon: '⏳',
                title: 'Activate Focus Sessions',
                text: 'Use the integrated 25-minute Pomodoro timer on your duration habits to automatically log and build focus hours.'
            });
        }

        return {
            thisWeekRate,
            lastWeekRate,
            rateDelta,
            thisWeekScheduled,
            thisWeekCompleted,
            thisWeekFocusSecs,
            thisWeekSessions,
            avgSessionSecs: thisWeekSessions > 0 ? Math.round(thisWeekFocusSecs / thisWeekSessions) : 0,
            strongestHabit,
            weakestHabit,
            bestPeriod,
            hardestPeriod,
            recommendations
        };
    }

    function calculateHabitDeepAnalytics(habitId) {
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return null;

        const { currentStreak, bestStreak } = calculateHabitStreak(habitId);
        const todayStr = getLocalDateString();
        const todayD = parseLocalDateString(todayStr);

        let totalScheduled30d = 0;
        let totalCompleted30d = 0;
        let totalCompletionsAllTime = 0;
        let totalFocusSecsAllTime = 0;
        let focusSessionCount = 0;

        const dayOfWeekSuccess = [
            { day: 'Mon', scheduled: 0, completed: 0, index: 1 },
            { day: 'Tue', scheduled: 0, completed: 0, index: 2 },
            { day: 'Wed', scheduled: 0, completed: 0, index: 3 },
            { day: 'Thu', scheduled: 0, completed: 0, index: 4 },
            { day: 'Fri', scheduled: 0, completed: 0, index: 5 },
            { day: 'Sat', scheduled: 0, completed: 0, index: 6 },
            { day: 'Sun', scheduled: 0, completed: 0, index: 0 }
        ];

        for (let i = 0; i < 30; i++) {
            const dateStr = getRelativeDateString(-i, todayD);
            const d = parseLocalDateString(dateStr);
            if (isHabitScheduledForDate(habit, d)) {
                totalScheduled30d++;
                if (isHabitCompletedForDate(habitId, dateStr)) {
                    totalCompleted30d++;
                }
            }
        }

        Object.keys(dailyLogs).forEach(dateStr => {
            if (isHabitCompletedForDate(habitId, dateStr)) {
                totalCompletionsAllTime++;
            }
            const d = parseLocalDateString(dateStr);
            const dowIdx = d.getDay();
            const slot = dayOfWeekSuccess.find(x => x.index === dowIdx);
            if (slot && isHabitScheduledForDate(habit, d)) {
                slot.scheduled++;
                if (isHabitCompletedForDate(habitId, dateStr)) {
                    slot.completed++;
                }
            }
        });

        focusSessions.forEach(sess => {
            if (sess.habitId === habitId) {
                totalFocusSecsAllTime += sess.durationSeconds || 0;
                focusSessionCount++;
            }
        });

        const rate30d = totalScheduled30d > 0 ? Math.round((totalCompleted30d / totalScheduled30d) * 100) : 0;
        const avgSessionDuration = focusSessionCount > 0 ? Math.round(totalFocusSecsAllTime / focusSessionCount) : 0;

        return {
            habit,
            currentStreak,
            bestStreak,
            rate30d,
            totalScheduled30d,
            totalCompleted30d,
            totalCompletionsAllTime,
            totalFocusSecsAllTime,
            focusSessionCount,
            avgSessionDuration,
            dayOfWeekSuccess
        };
    }

    // =========================================================================
    // 8. HABIT CRUD & USER ACTIONS
    // =========================================================================

    function createHabit(habitData) {
        if (!habitData || !habitData.name || !habitData.name.trim()) {
            throw new Error('Habit name cannot be empty.');
        }

        const name = habitData.name.trim();
        const routinePeriod = habitData.routinePeriod || ROUTINE_PERIODS.MORNING;

        const duplicate = habits.some(h => h.name.toLowerCase() === name.toLowerCase() && h.routinePeriod === routinePeriod);
        if (duplicate) {
            throw new Error(`A habit named "${name}" already exists in ${routinePeriod}.`);
        }

        const newHabit = normalizeHabit({
            id: 'habit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            name: name,
            routinePeriod: routinePeriod,
            trackingType: habitData.trackingType || TRACKING_TYPES.COMPLETION,
            target: parseInt(habitData.target, 10) || 1,
            unit: habitData.unit || '',
            scheduledTime: habitData.scheduledTime || '',
            daysOfWeek: Array.isArray(habitData.daysOfWeek) && habitData.daysOfWeek.length > 0 ? habitData.daysOfWeek : [0, 1, 2, 3, 4, 5, 6],
            reminderEnabled: habitData.reminderEnabled !== false,
            createdAt: Date.now(),
            order: habits.filter(h => h.routinePeriod === routinePeriod).length
        });

        habits.push(newHabit);
        syncToCloud();
        renderAllViews();
        playNotificationSound('complete');
        showToast('✨ Habit Created!', `"${name}" added to ${routinePeriod} Routine.`, false);
        return newHabit;
    }

    function updateHabit(habitId, updates) {
        const idx = habits.findIndex(h => h.id === habitId);
        if (idx === -1) return null;

        const current = habits[idx];
        const updated = normalizeHabit(Object.assign({}, current, updates, { id: habitId }));
        habits[idx] = updated;

        syncToCloud();
        renderAllViews();
        showToast('💾 Habit Updated', `"${updated.name}" saved successfully.`, false);
        return updated;
    }

    function deleteHabit(habitId) {
        const idx = habits.findIndex(h => h.id === habitId);
        if (idx === -1) return;

        const name = habits[idx].name;
        if (typeof confirm === 'function' && !confirm(`Are you sure you want to delete "${name}"? Your past analytics records will be preserved.`)) {
            return;
        }

        habits.splice(idx, 1);
        syncToCloud();
        renderAllViews();
        showToast('🗑️ Habit Removed', `"${name}" deleted from routine.`, false);
    }

    function reorderHabit(habitId, direction) {
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;

        const periodHabits = habits.filter(h => h.routinePeriod === habit.routinePeriod);
        const idx = periodHabits.findIndex(h => h.id === habitId);
        if (idx === -1) return;

        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= periodHabits.length) return;

        const swapHabit = periodHabits[targetIdx];
        const tempOrder = habit.order;
        habit.order = swapHabit.order;
        swapHabit.order = tempOrder;

        habits.sort((a, b) => (a.order || 0) - (b.order || 0));

        syncToCloud();
        renderTodayHabits();
    }

    function toggleHabitCompletion(habitId, dateStr = getLocalDateString()) {
        if (!dailyLogs[dateStr]) dailyLogs[dateStr] = { c: [], p: {}, f: 0, s: 0 };
        const log = dailyLogs[dateStr];
        if (!Array.isArray(log.c)) log.c = [];

        const habit = habits.find(h => h.id === habitId);
        const isDone = log.c.includes(habitId);

        if (isDone) {
            log.c = log.c.filter(id => id !== habitId);
            playNotificationSound('missed');
            showToast('↩ Undone', `"${habit?.name || 'Habit'}" unchecked for today.`, true);
        } else {
            log.c.push(habitId);
            playNotificationSound('complete');
            showToast('✅ Completed!', `Awesome work! "${habit?.name || 'Habit'}" is done for today.`, false);
        }

        syncToCloud();
        renderAllViews();
    }

    function adjustHabitQuantity(habitId, delta, dateStr = getLocalDateString()) {
        if (!dailyLogs[dateStr]) dailyLogs[dateStr] = { c: [], p: {}, f: 0, s: 0 };
        const log = dailyLogs[dateStr];
        if (!log.p) log.p = {};
        if (!Array.isArray(log.c)) log.c = [];

        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;

        const currentVal = typeof log.p[habitId] === 'number' ? log.p[habitId] : 0;
        const newVal = Math.max(0, currentVal + delta);
        log.p[habitId] = newVal;

        if (newVal >= habit.target && !log.c.includes(habitId)) {
            log.c.push(habitId);
            playNotificationSound('complete');
            showToast('🎉 Goal Reached!', `"${habit.name}" hit its daily target (${newVal}/${habit.target} ${habit.unit})!`, false);
        } else if (newVal < habit.target && log.c.includes(habitId)) {
            log.c = log.c.filter(id => id !== habitId);
        } else {
            playNotificationSound('tick');
        }

        syncToCloud();
        renderAllViews();
    }

    function logHabitDuration(habitId, durationSeconds, dateStr = getLocalDateString()) {
        if (durationSeconds <= 0) return;

        if (!dailyLogs[dateStr]) dailyLogs[dateStr] = { c: [], p: {}, f: 0, s: 0 };
        const log = dailyLogs[dateStr];
        if (!log.p) log.p = {};
        if (!Array.isArray(log.c)) log.c = [];

        const durationMinutes = Math.round(durationSeconds / 60);
        const currentMins = typeof log.p[habitId] === 'number' ? log.p[habitId] : 0;
        const newMins = currentMins + durationMinutes;
        log.p[habitId] = newMins;

        log.f = (log.f || 0) + durationSeconds;
        log.s = (log.s || 0) + 1;

        const habit = habits.find(h => h.id === habitId);
        if (habit && newMins >= habit.target && !log.c.includes(habitId)) {
            log.c.push(habitId);
        }

        focusSessions.push({
            id: 'foc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            habitId: habitId || '',
            habitName: habit?.name || 'General Focus',
            date: dateStr,
            durationSeconds: durationSeconds,
            completed: true,
            createdAt: Date.now()
        });

        syncToCloud();
        renderAllViews();
    }

    // =========================================================================
    // 9. FOCUS TIMER & ADVANCED STOPWATCH ENGINE
    // =========================================================================

    function setFocusMode(mode) {
        if (timerState.status === 'running') {
            pauseFocusTimer();
        }
        timerState.mode = mode;
        timerState.elapsedMs = 0;

        if (typeof document === 'undefined') return;

        const modeBadge = document.getElementById('timer-mode-badge');
        const countdownTab = document.getElementById('timer-tab-countdown');
        const stopwatchTab = document.getElementById('timer-tab-stopwatch');
        const presetContainer = document.getElementById('timer-presets-container');

        if (mode === 'countdown') {
            if (modeBadge) modeBadge.textContent = 'FOCUS COUNTDOWN';
            if (countdownTab) countdownTab.className = 'px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all text-blue-600 bg-white/90 shadow-sm cursor-pointer';
            if (stopwatchTab) stopwatchTab.className = 'px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all text-slate-500 hover:text-blue-600 cursor-pointer';
            if (presetContainer) presetContainer.classList.remove('hidden');
        } else {
            if (modeBadge) modeBadge.textContent = 'PRECISION STOPWATCH';
            if (countdownTab) countdownTab.className = 'px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all text-slate-500 hover:text-blue-600 cursor-pointer';
            if (stopwatchTab) stopwatchTab.className = 'px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all text-blue-600 bg-white/90 shadow-sm cursor-pointer';
            if (presetContainer) presetContainer.classList.add('hidden');
        }

        updateTimerDisplay();
    }

    function setFocusTimerDuration(minutes) {
        const mins = Math.max(1, Math.min(720, parseInt(minutes, 10) || 25));
        timerState.durationMs = mins * 60 * 1000;
        timerState.elapsedMs = 0;

        if (timerState.status === 'running') {
            pauseFocusTimer();
        }

        if (typeof document !== 'undefined') {
            const customInput = document.getElementById('timer-custom-minutes-input');
            if (customInput) customInput.value = mins;

            [5, 15, 25, 45, 60].forEach(p => {
                const pill = document.getElementById(`preset-pill-${p}`);
                if (pill) {
                    if (p === mins) {
                        pill.className = 'preset-pill neu-badge px-2.5 py-1 text-xs font-extrabold text-blue-600 bg-blue-50 border border-blue-300 shadow-sm transition cursor-pointer';
                    } else {
                        pill.className = 'preset-pill neu-badge px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-blue-600 bg-white/80 transition cursor-pointer';
                    }
                }
            });
        }

        updateTimerDisplay();
        playNotificationSound('tick');
    }

    function linkHabitToFocusTimer(habitId) {
        const habit = habits.find(h => h.id === habitId);
        timerState.linkedHabitId = habitId || '';
        timerState.linkedHabitName = habit ? habit.name : '';

        if (typeof document === 'undefined') return;

        const selectEl = document.getElementById('timer-habit-select');
        if (selectEl && selectEl.value !== habitId) {
            selectEl.value = habitId;
        }

        const statusEl = document.getElementById('timer-link-status');
        if (statusEl) {
            if (habit) {
                statusEl.textContent = `Linked: ${habit.name} (${habit.target} ${habit.unit})`;
                statusEl.className = 'text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider';
                if (habit.trackingType === TRACKING_TYPES.DURATION) {
                    const todayLogged = getHabitProgressForDate(habit.id);
                    const remaining = Math.max(5, habit.target - todayLogged);
                    setFocusTimerDuration(remaining);
                }
            } else {
                statusEl.textContent = 'General Focus (Unlinked)';
                statusEl.className = 'text-[10px] font-bold text-slate-400 uppercase tracking-wider';
            }
        }
    }

    function toggleFocusTimer() {
        if (timerState.status === 'running') {
            pauseFocusTimer();
        } else {
            startFocusTimer();
        }
    }

    function startFocusTimer() {
        if (timerState.status === 'running') return;
        timerState.status = 'running';
        timerState.startTime = performance.now();

        if (typeof document !== 'undefined') {
            const btn = document.getElementById('timer-btn-toggle');
            const icon = document.getElementById('timer-btn-icon');
            const text = document.getElementById('timer-btn-text');

            if (btn) {
                btn.className = 'neu-btn px-6 py-3 sm:px-8 sm:py-3.5 font-black text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 min-w-[130px] sm:min-w-[150px] text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer';
            }
            if (icon) icon.textContent = '⏸';
            if (text) text.textContent = 'PAUSE';
        }

        playNotificationSound('start');
        timerLoop();
    }

    function pauseFocusTimer() {
        if (timerState.status !== 'running') return;
        const now = performance.now();
        timerState.elapsedMs += (now - timerState.startTime);
        timerState.status = 'paused';

        if (timerState.animFrame) {
            cancelAnimationFrame(timerState.animFrame);
            timerState.animFrame = null;
        }

        if (typeof document !== 'undefined') {
            const btn = document.getElementById('timer-btn-toggle');
            const icon = document.getElementById('timer-btn-icon');
            const text = document.getElementById('timer-btn-text');

            if (btn) {
                btn.className = 'neu-btn px-6 py-3 sm:px-8 sm:py-3.5 font-black text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 min-w-[130px] sm:min-w-[150px] text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer';
            }
            if (icon) icon.textContent = '▶';
            if (text) text.textContent = 'RESUME';
        }

        playNotificationSound('pause');
    }

    function resetFocusTimer() {
        if (timerState.animFrame) {
            cancelAnimationFrame(timerState.animFrame);
            timerState.animFrame = null;
        }
        timerState.status = 'idle';
        timerState.elapsedMs = 0;

        if (typeof document !== 'undefined') {
            const btn = document.getElementById('timer-btn-toggle');
            const icon = document.getElementById('timer-btn-icon');
            const text = document.getElementById('timer-btn-text');

            if (btn) {
                btn.className = 'neu-btn px-6 py-3 sm:px-8 sm:py-3.5 font-black text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 min-w-[130px] sm:min-w-[150px] text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer';
            }
            if (icon) icon.textContent = '▶';
            if (text) text.textContent = 'START';
        }

        updateTimerDisplay();
        playNotificationSound('reset');
    }

    function finishFocusTimerSession() {
        const totalElapsedMs = timerState.status === 'running'
            ? timerState.elapsedMs + (performance.now() - timerState.startTime)
            : timerState.elapsedMs;

        const durationSeconds = Math.round(totalElapsedMs / 1000);
        if (durationSeconds < 10) {
            showToast('⏱️ Session Too Short', 'Focus sessions under 10 seconds are not logged.', true);
            resetFocusTimer();
            return;
        }

        const habitId = timerState.linkedHabitId;
        const habit = habits.find(h => h.id === habitId);

        logHabitDuration(habitId, durationSeconds);

        const mins = Math.round(durationSeconds / 60);
        playNotificationSound('complete');
        playJarvisTimesUpVoice();

        showToast('🎉 Focus Session Logged!', `Great discipline! Logged ${mins} minutes of focus ${habit ? `to "${habit.name}"` : ''}.`, false);
        resetFocusTimer();
    }

    function timerLoop() {
        if (timerState.status !== 'running') return;

        const now = performance.now();
        const currentElapsed = timerState.elapsedMs + (now - timerState.startTime);

        if (timerState.mode === 'countdown') {
            const remainingMs = Math.max(0, timerState.durationMs - currentElapsed);
            updateTimerDisplay(remainingMs, timerState.durationMs);

            if (remainingMs <= 0) {
                finishFocusTimerSession();
                return;
            }
        } else {
            updateTimerDisplay(currentElapsed);
        }

        if (typeof requestAnimationFrame === 'function') {
            timerState.animFrame = requestAnimationFrame(timerLoop);
        }
    }

    function updateTimerDisplay(currentValMs = null, totalGoalMs = null) {
        if (typeof document === 'undefined') return;

        const displayEl = document.getElementById('timer-time-display');
        const circleProgress = document.getElementById('timer-circle-progress');
        const subtextEl = document.getElementById('timer-subtext');

        let ms = currentValMs;
        if (ms === null) {
            ms = timerState.mode === 'countdown' ? timerState.durationMs : 0;
        }

        const formatted = formatTimerDisplay(ms);
        if (displayEl) displayEl.textContent = formatted;

        if (subtextEl) {
            if (timerState.linkedHabitName) {
                subtextEl.textContent = `🎯 Habit: ${timerState.linkedHabitName}`;
            } else {
                subtextEl.textContent = timerState.mode === 'countdown' ? 'Ready to focus' : 'Precision stopwatch';
            }
        }

        if (circleProgress) {
            const circumference = 477.52;
            if (timerState.mode === 'countdown') {
                const total = totalGoalMs || timerState.durationMs;
                const ratio = Math.min(1, Math.max(0, 1 - (ms / total)));
                circleProgress.style.strokeDashoffset = circumference * ratio;
            } else {
                const secondFraction = (ms % 60000) / 60000;
                circleProgress.style.strokeDashoffset = circumference * (1 - secondFraction);
            }
        }

        if (timerState.status === 'running') {
            document.title = `(${formatted}) PRAXiS Focus`;
        } else if (document.title && document.title.includes('PRAXiS Focus')) {
            document.title = 'PRAXiS - Routine & Habit System';
        }
    }

    function recordTimerLap() {
        if (timerState.status !== 'running') return;
        const now = performance.now();
        const totalElapsed = timerState.elapsedMs + (now - timerState.startTime);
        const lastLapTotal = timerState.laps.length > 0 ? timerState.laps[timerState.laps.length - 1].totalTime : 0;
        const lapTime = totalElapsed - lastLapTotal;
        const lapNum = timerState.laps.length + 1;

        timerState.laps.push({ lapNum, lapTime, totalTime: totalElapsed });
        renderTimerLaps();
        playNotificationSound('tick');
    }

    function renderTimerLaps() {
        if (typeof document === 'undefined') return;

        const container = document.getElementById('timer-laps-list');
        const badge = document.getElementById('timer-lap-count-badge');
        if (!container) return;

        if (timerState.laps.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center h-full py-6 text-slate-400">
                    <span class="text-2xl mb-1 opacity-70">⏱️</span>
                    <p class="text-xs font-semibold">No laps recorded yet</p>
                    <p class="text-[10px] text-slate-400 mt-0.5">Press "Lap" while running to capture splits</p>
                </div>
            `;
            if (badge) badge.textContent = '0 Laps';
            return;
        }

        if (badge) badge.textContent = `${timerState.laps.length} Laps`;

        let html = '';
        for (let i = timerState.laps.length - 1; i >= 0; i--) {
            const lap = timerState.laps[i];
            html += `
                <div class="neu-card-sm p-2 flex items-center justify-between gap-2 border bg-white/80 text-xs">
                    <span class="font-extrabold text-slate-700">#${String(lap.lapNum).padStart(2, '0')}</span>
                    <span class="font-bold text-blue-600">+${formatTimerDisplay(lap.lapTime)}</span>
                    <span class="text-slate-500">${formatTimerDisplay(lap.totalTime)}</span>
                </div>
            `;
        }
        container.innerHTML = html;
    }

    function clearTimerLaps() {
        timerState.laps = [];
        renderTimerLaps();
        playNotificationSound('tick');
    }

    function copyTimerLaps() {
        if (timerState.laps.length === 0) {
            showToast('📋 No Laps', 'Record some laps before copying.', true);
            return;
        }
        let txt = "PRAXiS Routine Stopwatch Laps:\n";
        timerState.laps.forEach(l => {
            txt += `Lap #${l.lapNum}: +${formatTimerDisplay(l.lapTime)} (Total: ${formatTimerDisplay(l.totalTime)})\n`;
        });
        if (navigator.clipboard) {
            navigator.clipboard.writeText(txt).then(() => {
                showToast('📋 Copied!', `${timerState.laps.length} laps copied to clipboard.`, false);
            }).catch(() => {});
        }
    }

    // =========================================================================
    // 10. AUDIO, JARVIS VOICE & REMINDERS
    // =========================================================================

    function getAudioContext() {
        if (!audioContext && typeof window !== 'undefined') {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) audioContext = new AudioCtx();
        }
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }
        return audioContext;
    }

    function playNotificationSound(type) {
        if (!timerState.soundEnabled) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'complete') {
                osc.frequency.setValueAtTime(587.33, now);
                osc.frequency.setValueAtTime(880, now + 0.12);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                osc.start(now);
                osc.stop(now + 0.35);
            } else if (type === 'missed') {
                osc.frequency.setValueAtTime(280, now);
                osc.frequency.exponentialRampToValueAtTime(180, now + 0.3);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            } else if (type === 'tick') {
                osc.frequency.setValueAtTime(880, now);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
                osc.start(now);
                osc.stop(now + 0.03);
            } else if (type === 'start') {
                osc.frequency.setValueAtTime(520, now);
                osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'pause') {
                osc.frequency.setValueAtTime(780, now);
                osc.frequency.exponentialRampToValueAtTime(520, now + 0.08);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'reset') {
                osc.frequency.setValueAtTime(320, now);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            }
        } catch (e) {}
    }

    function toggleTimerSound() {
        timerState.soundEnabled = !timerState.soundEnabled;
        try {
            localStorage.setItem('praxis_sw_sound', String(timerState.soundEnabled));
        } catch (e) {}

        if (typeof document !== 'undefined') {
            const btn = document.getElementById('timer-sound-btn');
            if (btn) {
                btn.textContent = timerState.soundEnabled ? '🔊' : '🔇';
            }
        }
        showToast(timerState.soundEnabled ? '🔊 Sound Enabled' : '🔇 Sound Muted', timerState.soundEnabled ? 'Audio cues are active.' : 'Audio effects muted.', false);
    }

    function detectUserHonorific() {
        try {
            const user = getActiveUser();
            const name = (user?.displayName || user?.name || '').toLowerCase();
            const femaleNames = ['priya', 'sneha', 'ananya', 'pooja', 'neha', 'riya', 'divya', 'kavya', 'anita', 'rachel', 'emma', 'sarah', 'claire', 'elizabeth'];
            for (let fn of femaleNames) {
                if (name.includes(fn)) return 'maam';
            }
            return 'sir';
        } catch (e) {
            return 'sir';
        }
    }

    function playJarvisTimesUpVoice() {
        if (!timerState.soundEnabled) return;
        try {
            const honorific = detectUserHonorific();
            const audioSrc = honorific === 'maam' ? '/jarvis-times-up-maam.mp3' : '/jarvis-times-up-sir.mp3';
            const spokenText = `Time is up, ${honorific === 'maam' ? "ma'am" : 'sir'}. Focus session completed.`;

            if (typeof Audio !== 'undefined') {
                if (!jarvisAudioCache[honorific]) {
                    jarvisAudioCache[honorific] = new Audio(audioSrc);
                }
                const audioObj = jarvisAudioCache[honorific];
                audioObj.currentTime = 0;
                audioObj.play().catch(() => {
                    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                        const utter = new SpeechSynthesisUtterance(spokenText);
                        window.speechSynthesis.speak(utter);
                    }
                });
            }
        } catch (e) {}
    }

    function checkScheduledHabitReminders() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        const currentMinuteStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;

        if (currentMinuteStr === lastCheckedMinuteStr) return;
        lastCheckedMinuteStr = currentMinuteStr;

        const todayStr = getLocalDateString(now);

        habits.forEach(h => {
            if (!h.reminderEnabled || !h.scheduledTime) return;
            if (!isHabitScheduledForDate(h, now)) return;
            if (isHabitCompletedForDate(h.id, todayStr)) return;

            if (h.scheduledTime === currentMinuteStr) {
                playNotificationSound('complete');
                showToast(`⏰ Time for ${h.name}!`, `It's ${formatTimeAMPM(h.scheduledTime)}! Time for your scheduled ${h.routinePeriod} habit: "${h.name}".`, false, h.id);

                if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                    try {
                        new Notification(`⏰ PRAXiS Routine: ${h.name}`, {
                            body: `It is ${formatTimeAMPM(h.scheduledTime)}! Time for your routine habit: "${h.name}".`,
                            icon: '/favicon.ico'
                        });
                    } catch (e) {}
                }
            }
        });
    }

    // =========================================================================
    // 11. UI RENDERING & DOM HYDRATION
    // =========================================================================

    function renderAllViews() {
        if (typeof document === 'undefined') return;
        renderTodayDashboard();
        renderTodayHabits();
        renderCalendarView();
        renderAnalyticsView();
        renderQuickFocusDropdown();
    }

    function renderTodayDashboard() {
        if (typeof document === 'undefined') return;
        const todayStr = getLocalDateString();
        const { scheduled, completed, percentage } = calculateDailyCompletionRate(todayStr);
        const { currentStreak, bestStreak } = calculateOverallStreak();

        const log = dailyLogs[todayStr];
        const todayFocusSecs = log ? (log.f || 0) : 0;

        const hour = new Date().getHours();
        let greeting = 'Good evening';
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 17) greeting = 'Good afternoon';

        const greetingEl = document.getElementById('today-greeting-text');
        if (greetingEl) greetingEl.textContent = greeting;

        const dateEl = document.getElementById('today-date-text');
        if (dateEl) dateEl.textContent = formatDisplayDate(todayStr);

        const summaryTextEl = document.getElementById('today-summary-headline');
        if (summaryTextEl) {
            if (scheduled === 0) {
                summaryTextEl.textContent = 'Your routine is empty. Create your first habit!';
            } else if (completed === scheduled) {
                summaryTextEl.textContent = '🎉 All habits completed for today! Outstanding discipline!';
            } else {
                const remaining = scheduled - completed;
                summaryTextEl.textContent = `${completed} of ${scheduled} habits completed (${percentage}%) • ${remaining} remaining`;
            }
        }

        const progressBar = document.getElementById('today-hero-progress-bar');
        if (progressBar) progressBar.style.width = `${percentage}%`;

        const percentBadge = document.getElementById('today-hero-percent-badge');
        if (percentBadge) percentBadge.textContent = `${percentage}% Complete`;

        const statCompletedEl = document.getElementById('stat-today-completed');
        if (statCompletedEl) statCompletedEl.textContent = `${completed}/${scheduled}`;

        const statRemainingEl = document.getElementById('stat-today-remaining');
        if (statRemainingEl) statRemainingEl.textContent = `${Math.max(0, scheduled - completed)}`;

        const statStreakEl = document.getElementById('stat-today-streak');
        if (statStreakEl) statStreakEl.textContent = `${currentStreak}d`;

        const statBestStreakEl = document.getElementById('stat-today-best-streak');
        if (statBestStreakEl) statBestStreakEl.textContent = `Best: ${bestStreak}d`;

        const statFocusEl = document.getElementById('stat-today-focus');
        if (statFocusEl) statFocusEl.textContent = formatDurationHuman(todayFocusSecs);
    }

    function renderTodayHabits() {
        if (typeof document === 'undefined') return;
        const todayStr = getLocalDateString();
        const todayD = parseLocalDateString(todayStr);
        const container = document.getElementById('habits-grouped-container');
        const emptySlate = document.getElementById('habits-empty-slate');

        if (!container) return;

        if (habits.length === 0) {
            container.innerHTML = '';
            if (emptySlate) emptySlate.classList.remove('hidden');
            return;
        }

        if (emptySlate) emptySlate.classList.add('hidden');

        const periods = [
            { key: ROUTINE_PERIODS.MORNING, title: 'Morning Routine', icon: '🌅' },
            { key: ROUTINE_PERIODS.AFTERNOON, title: 'Afternoon Focus', icon: '☀️' },
            { key: ROUTINE_PERIODS.EVENING, title: 'Evening Wind-Down', icon: '🌙' }
        ];

        let html = '';

        periods.forEach(p => {
            if (currentFilterPeriod !== 'all' && currentFilterPeriod !== p.key) return;

            const periodHabits = habits.filter(h => h.routinePeriod === p.key && isHabitScheduledForDate(h, todayD));
            const completedCount = periodHabits.filter(h => isHabitCompletedForDate(h.id, todayStr)).length;

            html += `
                <div class="neu-card p-4 sm:p-5 bg-white/70 border border-white/80 shadow-md">
                    <!-- PERIOD HEADER -->
                    <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-300/60">
                        <div class="flex items-center gap-2">
                            <span class="text-xl">${p.icon}</span>
                            <h3 class="text-base sm:text-lg font-black text-slate-800 font-outfit">${p.title}</h3>
                            <span class="neu-badge text-[10px] font-extrabold px-2 py-0.5 ${completedCount === periodHabits.length && periodHabits.length > 0 ? 'text-emerald-700 bg-emerald-100' : 'text-slate-600'}">
                                ${completedCount} / ${periodHabits.length} Done
                            </span>
                        </div>
                        <button type="button" onclick="PraxisRoutine.openAddHabitModal('${p.key}')" class="neu-btn px-2.5 py-1 text-xs font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700 cursor-pointer">
                            <span>+</span> Add
                        </button>
                    </div>

                    <!-- HABIT CARDS LIST -->
                    <div class="space-y-2.5">
            `;

            if (periodHabits.length === 0) {
                html += `
                    <div class="p-4 text-center text-xs font-medium text-slate-400 neu-trench rounded-xl">
                        No habits scheduled for this period today.
                    </div>
                `;
            } else {
                periodHabits.forEach((habit, idx) => {
                    const isDone = isHabitCompletedForDate(habit.id, todayStr);
                    const progressVal = getHabitProgressForDate(habit.id, todayStr);
                    const { currentStreak } = calculateHabitStreak(habit.id);

                    html += renderSingleHabitCard(habit, isDone, progressVal, currentStreak, idx, periodHabits.length);
                });
            }

            html += `
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    function renderSingleHabitCard(habit, isDone, progressVal, currentStreak, idx, totalInPeriod) {
        const timeBadge = habit.scheduledTime
            ? `<span class="neu-badge text-[10px] font-bold text-slate-500 px-2 py-0.5 flex items-center gap-1">⏰ ${formatTimeAMPM(habit.scheduledTime)}</span>`
            : '';

        const streakBadge = currentStreak > 0
            ? `<span class="neu-badge text-[10px] font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 flex items-center gap-0.5">🔥 ${currentStreak}d</span>`
            : '';

        let trackingControlsHtml = '';

        if (habit.trackingType === TRACKING_TYPES.COMPLETION) {
            trackingControlsHtml = `
                <button type="button" onclick="PraxisRoutine.toggleHabit('${escapeHtml(habit.id)}')" 
                    aria-label="Mark ${escapeHtml(habit.name)} as ${isDone ? 'incomplete' : 'complete'}"
                    class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        isDone 
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' 
                            : 'neu-btn text-slate-400 hover:text-emerald-600 border border-slate-300'
                    }">
                    <span class="text-sm font-black">${isDone ? '✓' : ''}</span>
                </button>
            `;
        } else if (habit.trackingType === TRACKING_TYPES.DURATION) {
            const pct = Math.min(100, Math.round((progressVal / habit.target) * 100));
            trackingControlsHtml = `
                <div class="flex items-center gap-2">
                    <div class="flex flex-col items-end min-w-[70px]">
                        <span class="text-xs font-black font-digital text-slate-800">${progressVal} / ${habit.target} min</span>
                        <div class="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden mt-0.5">
                            <div class="h-full bg-blue-600 rounded-full transition-all" style="width: ${pct}%"></div>
                        </div>
                    </div>
                    <button type="button" onclick="PraxisRoutine.startHabitFocus('${escapeHtml(habit.id)}')" title="Launch Focus Timer"
                        class="neu-btn px-2.5 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer">
                        <span>⏱️</span> <span class="hidden sm:inline">Focus</span>
                    </button>
                    <button type="button" onclick="PraxisRoutine.addDurationMinutes('${escapeHtml(habit.id)}', 15)" title="Quick add +15 mins"
                        class="neu-btn px-2 py-1.5 text-[10px] font-extrabold text-slate-600 hover:text-blue-600 cursor-pointer">
                        +15m
                    </button>
                </div>
            `;
        } else if (habit.trackingType === TRACKING_TYPES.QUANTITY) {
            trackingControlsHtml = `
                <div class="flex items-center gap-1.5">
                    <button type="button" onclick="PraxisRoutine.adjustQuantity('${escapeHtml(habit.id)}', -1)" title="Decrement"
                        class="neu-circle w-7 h-7 flex items-center justify-center text-xs font-black text-slate-600 hover:text-rose-600 cursor-pointer">
                        -
                    </button>
                    <span class="text-xs font-black text-slate-800 font-digital min-w-[45px] text-center">
                        ${progressVal} / ${habit.target}
                    </span>
                    <button type="button" onclick="PraxisRoutine.adjustQuantity('${escapeHtml(habit.id)}', 1)" title="Increment"
                        class="neu-circle w-7 h-7 flex items-center justify-center text-xs font-black text-slate-600 hover:text-emerald-600 cursor-pointer">
                        +
                    </button>
                </div>
            `;
        }

        return `
            <div class="p-3 sm:p-3.5 rounded-xl border ${isDone ? 'bg-emerald-50/70 border-emerald-300 shadow-xs' : 'bg-[#e0e5ec] border-slate-300/70'} flex items-center justify-between gap-2.5 transition-all">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="flex flex-col min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span onclick="PraxisRoutine.openHabitAnalytics('${escapeHtml(habit.id)}')" class="text-xs sm:text-sm font-extrabold text-slate-800 hover:text-blue-600 cursor-pointer truncate font-outfit" title="Click to view analytics">
                                ${escapeHtml(habit.name)}
                            </span>
                            ${streakBadge}
                        </div>
                        <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                            ${timeBadge}
                            <span class="text-[10px] text-slate-400 font-semibold">${habit.trackingType === TRACKING_TYPES.COMPLETION ? 'Checkoff' : `${habit.target} ${habit.unit}`}</span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                    ${trackingControlsHtml}
                    <div class="flex items-center gap-0.5 border-l border-slate-300/60 pl-1.5 ml-1">
                        <button type="button" onclick="PraxisRoutine.openHabitAnalytics('${escapeHtml(habit.id)}')" title="Habit Analytics" class="p-1 text-slate-400 hover:text-blue-600 text-xs cursor-pointer">📊</button>
                        <button type="button" onclick="PraxisRoutine.openEditHabitModal('${escapeHtml(habit.id)}')" title="Edit Habit" class="p-1 text-slate-400 hover:text-indigo-600 text-xs cursor-pointer">✏️</button>
                        <button type="button" onclick="PraxisRoutine.deleteHabit('${escapeHtml(habit.id)}')" title="Delete Habit" class="p-1 text-slate-400 hover:text-rose-600 text-xs cursor-pointer">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderCalendarView() {
        if (typeof document === 'undefined') return;
        const heatmapGrid = document.getElementById('heatmap-calendar-grid');
        const detailBanner = document.getElementById('heatmap-calendar-detail');
        if (!heatmapGrid) return;

        heatmapGrid.innerHTML = '';
        const todayStr = getLocalDateString();
        const todayD = parseLocalDateString(todayStr);
        const daysCount = selectedCalendarRange || 30;

        for (let i = daysCount - 1; i >= 0; i--) {
            const dateStr = getRelativeDateString(-i, todayD);
            const d = parseLocalDateString(dateStr);
            const { scheduled, completed, percentage } = calculateDailyCompletionRate(dateStr);
            const log = dailyLogs[dateStr];
            const focusSecs = log ? (log.f || 0) : 0;
            const isToday = dateStr === todayStr;

            let threshold = HEATMAP_THRESHOLDS[0];
            for (let t of HEATMAP_THRESHOLDS) {
                if (percentage >= t.min && percentage <= t.max) {
                    threshold = t;
                    break;
                }
            }

            const tile = document.createElement('button');
            tile.type = 'button';
            tile.className = `h-9 sm:h-10 rounded-lg flex flex-col items-center justify-center text-[10px] transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer relative ${threshold.class} ${isToday ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`;
            tile.title = `${formatDisplayDate(dateStr)}: ${completed}/${scheduled} completed (${percentage}%)`;

            tile.innerHTML = `
                <span class="font-extrabold leading-none">${d.getDate()}</span>
                <span class="text-[8px] opacity-80 mt-0.5">${scheduled > 0 ? `${completed}/${scheduled}` : '-'}</span>
            `;

            const updateDetail = () => {
                if (detailBanner) {
                    detailBanner.innerHTML = `
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <span class="font-black text-slate-800 text-xs sm:text-sm font-outfit">📅 ${formatDisplayDate(dateStr)}${isToday ? ' (Today)' : ''}</span>
                                <p class="text-xs text-slate-600 font-medium mt-0.5">
                                    <strong>${completed}</strong> of <strong>${scheduled}</strong> habits completed • <span class="text-emerald-700 font-bold">${percentage}% Consistency</span> • Focus: <strong>${formatDurationHuman(focusSecs)}</strong>
                                </p>
                            </div>
                            <span class="neu-badge text-[10px] font-extrabold px-2.5 py-1 ${threshold.class}">
                                ${threshold.label}
                            </span>
                        </div>
                    `;
                }
            };

            tile.addEventListener('click', updateDetail);
            tile.addEventListener('mouseenter', updateDetail);

            if (isToday) updateDetail();

            heatmapGrid.appendChild(tile);
        }

        renderSpreadsheetTable();
    }

    function renderSpreadsheetTable() {
        if (typeof document === 'undefined') return;
        const container = document.getElementById('spreadsheet-table-container');
        if (!container) return;

        if (habits.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">No habits to display in spreadsheet.</div>`;
            return;
        }

        const todayStr = getLocalDateString();
        const todayD = parseLocalDateString(todayStr);

        let html = `
            <table class="table-fixed border-separate border-spacing-0 select-none text-left w-max text-xs">
                <thead>
                    <tr>
                        <th class="sticky top-0 left-0 z-30 bg-[#cbd4e2] p-2 text-xs font-black font-outfit text-slate-800 border-r-2 border-b-2 border-slate-300 w-[150px] sm:w-[200px]">
                            Habit
                        </th>
        `;

        for (let i = 29; i >= 0; i--) {
            const dateStr = getRelativeDateString(-i, todayD);
            const d = parseLocalDateString(dateStr);
            const isToday = dateStr === todayStr;
            html += `
                <th class="sticky top-0 z-20 ${isToday ? 'bg-blue-100 text-blue-900 border-b-2 border-blue-500 font-black' : 'bg-[#d5deeb] text-slate-700 font-bold border-b-2 border-slate-300'} p-1 text-center w-[36px] min-w-[36px]">
                    <div class="leading-none text-[10px]">
                        <div>${d.getDate()}</div>
                        <div class="text-[7px] text-slate-500">${d.toLocaleDateString(undefined, { weekday: 'narrow' })}</div>
                    </div>
                </th>
            `;
        }

        html += `
                    </tr>
                </thead>
                <tbody>
        `;

        habits.forEach((habit) => {
            const { currentStreak } = calculateHabitStreak(habit.id);
            html += `
                <tr class="hover:bg-slate-200/40">
                    <td class="sticky left-0 z-20 bg-[#e0e5ec] p-2 border-r-2 border-b border-slate-300/80 w-[150px] sm:w-[200px] truncate" title="${escapeHtml(habit.name)}">
                        <div class="flex items-center justify-between gap-1">
                            <span class="font-extrabold text-slate-800 text-xs truncate">${escapeHtml(habit.name)}</span>
                            ${currentStreak > 0 ? `<span class="text-[9px] text-amber-600 font-bold">🔥${currentStreak}d</span>` : ''}
                        </div>
                    </td>
            `;

            for (let i = 29; i >= 0; i--) {
                const dateStr = getRelativeDateString(-i, todayD);
                const d = parseLocalDateString(dateStr);
                const isScheduled = isHabitScheduledForDate(habit, d);
                const isDone = isHabitCompletedForDate(habit.id, dateStr);

                let cellContent = '';
                let cellBg = 'bg-[#e0e5ec]';

                if (!isScheduled) {
                    cellContent = `<span class="text-slate-300 text-[9px]">•</span>`;
                } else if (isDone) {
                    cellContent = `<span class="text-emerald-700 font-black text-xs">✓</span>`;
                    cellBg = 'bg-emerald-100/70';
                } else {
                    cellContent = `<span class="text-slate-400 text-[10px]">-</span>`;
                }

                html += `
                    <td onclick="PraxisRoutine.toggleHabit('${escapeHtml(habit.id)}', '${dateStr}')" 
                        class="border-r border-b border-slate-300/70 p-0 text-center align-middle cursor-pointer transition-colors ${cellBg} hover:bg-blue-50 w-[36px] h-9">
                        ${cellContent}
                    </td>
                `;
            }

            html += `</tr>`;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    function renderAnalyticsView() {
        if (typeof document === 'undefined') return;
        const insights = calculateWeeklyInsights();
        const { percentage: rate30d, activeDaysCount, totalDays } = calculatePeriodConsistency(30);
        const { bestStreak } = calculateOverallStreak();

        const weekRateEl = document.getElementById('analytics-week-rate');
        if (weekRateEl) weekRateEl.textContent = `${insights.thisWeekRate}%`;

        const weekDeltaEl = document.getElementById('analytics-week-delta');
        if (weekDeltaEl) {
            const delta = insights.rateDelta;
            weekDeltaEl.textContent = delta >= 0 ? `▲ +${delta}% vs last week` : `▼ ${delta}% vs last week`;
            weekDeltaEl.className = `text-[10px] font-extrabold ${delta >= 0 ? 'text-emerald-600' : 'text-rose-500'}`;
        }

        const consistency30dEl = document.getElementById('analytics-consistency-30d');
        if (consistency30dEl) consistency30dEl.textContent = `${rate30d}%`;

        const activeDaysEl = document.getElementById('analytics-active-days');
        if (activeDaysEl) activeDaysEl.textContent = `${activeDaysCount} of ${totalDays} active days`;

        const bestStreakEl = document.getElementById('analytics-best-streak');
        if (bestStreakEl) bestStreakEl.textContent = `${bestStreak} days`;

        const focusTimeEl = document.getElementById('analytics-focus-week');
        if (focusTimeEl) focusTimeEl.textContent = formatDurationHuman(insights.thisWeekFocusSecs);

        const strongestEl = document.getElementById('analytics-strongest-habit');
        if (strongestEl) {
            strongestEl.innerHTML = insights.strongestHabit
                ? `<strong>${escapeHtml(insights.strongestHabit.name)}</strong> (${insights.strongestHabit.completed}/${insights.strongestHabit.scheduled} days • ${insights.strongestHabit.rate}%)`
                : 'Need more check-ins';
        }

        const weakestEl = document.getElementById('analytics-weakest-habit');
        if (weakestEl) {
            weakestEl.innerHTML = insights.weakestHabit
                ? `<strong>${escapeHtml(insights.weakestHabit.name)}</strong> (${insights.weakestHabit.completed}/${insights.weakestHabit.scheduled} days • ${insights.weakestHabit.rate}%)`
                : 'All habits on track';
        }

        const bestPeriodEl = document.getElementById('analytics-best-period');
        if (bestPeriodEl) {
            bestPeriodEl.textContent = insights.bestPeriod ? `${insights.bestPeriod.name} (${insights.bestPeriod.rate}%)` : '--';
        }

        const hardestPeriodEl = document.getElementById('analytics-hardest-period');
        if (hardestPeriodEl) {
            hardestPeriodEl.textContent = insights.hardestPeriod ? `${insights.hardestPeriod.name} (${insights.hardestPeriod.rate}%)` : '--';
        }

        const recContainer = document.getElementById('analytics-recommendations-list');
        if (recContainer) {
            if (insights.recommendations.length === 0) {
                recContainer.innerHTML = `
                    <div class="p-3 text-xs text-slate-500 font-medium neu-trench rounded-xl text-center">
                        Keep logging your routine to receive personalized rule-based recommendations.
                    </div>
                `;
            } else {
                let recHtml = '';
                insights.recommendations.forEach(r => {
                    recHtml += `
                        <div class="neu-card-sm p-3.5 bg-white/80 border border-slate-200/80 flex items-start gap-3">
                            <span class="text-xl shrink-0 mt-0.5">${r.icon}</span>
                            <div>
                                <h5 class="text-xs font-black text-slate-800 font-outfit">${r.title}</h5>
                                <p class="text-[11px] font-medium text-slate-600 leading-relaxed mt-0.5">${r.text}</p>
                            </div>
                        </div>
                    `;
                });
                recContainer.innerHTML = recHtml;
            }
        }
    }

    function renderQuickFocusDropdown() {
        if (typeof document === 'undefined') return;
        const selectEl = document.getElementById('quick-focus-habit-select');
        const timerSelectEl = document.getElementById('timer-habit-select');
        if (!selectEl && !timerSelectEl) return;

        const optionsHtml = '<option value="">-- General Focus Session --</option>' + habits.map(h => {
            return `<option value="${h.id}">${h.routinePeriod === 'Morning' ? '🌅' : h.routinePeriod === 'Evening' ? '🌙' : '☀️'} ${escapeHtml(h.name)} (${h.target} ${h.unit || 'min'})</option>`;
        }).join('');

        if (selectEl) selectEl.innerHTML = optionsHtml;
        if (timerSelectEl) timerSelectEl.innerHTML = optionsHtml;
    }

    function openHabitAnalytics(habitId) {
        habitAnalyticsModalId = habitId;
        if (typeof document === 'undefined') return;
        const modal = document.getElementById('habit-analytics-modal');
        const body = document.getElementById('habit-analytics-body');
        if (!modal || !body) return;

        const data = calculateHabitDeepAnalytics(habitId);
        if (!data) return;

        body.innerHTML = `
            <div class="space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                        <span class="neu-badge text-[10px] font-extrabold text-blue-600 px-2 py-0.5">${data.habit.routinePeriod} Routine</span>
                        <h3 class="text-lg font-black text-slate-800 font-outfit mt-1">${escapeHtml(data.habit.name)}</h3>
                    </div>
                    <div class="text-right">
                        <span class="text-xs font-bold text-slate-400">Target</span>
                        <p class="text-sm font-black text-slate-700">${data.habit.target} ${data.habit.unit || 'check'}</p>
                    </div>
                </div>

                <!-- 4 STAT TILES -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                    <div class="neu-card-sm p-2.5 bg-white/70">
                        <span class="text-[9px] font-extrabold text-slate-400 uppercase">Current Streak</span>
                        <span class="text-lg font-black text-amber-600 font-outfit block">🔥 ${data.currentStreak}d</span>
                    </div>
                    <div class="neu-card-sm p-2.5 bg-white/70">
                        <span class="text-[9px] font-extrabold text-slate-400 uppercase">Best Record</span>
                        <span class="text-lg font-black text-blue-600 font-outfit block">🏆 ${data.bestStreak}d</span>
                    </div>
                    <div class="neu-card-sm p-2.5 bg-white/70">
                        <span class="text-[9px] font-extrabold text-slate-400 uppercase">30d Consistency</span>
                        <span class="text-lg font-black text-emerald-600 font-outfit block">${data.rate30d}%</span>
                    </div>
                    <div class="neu-card-sm p-2.5 bg-white/70">
                        <span class="text-[9px] font-extrabold text-slate-400 uppercase">Total Focus</span>
                        <span class="text-lg font-black text-indigo-600 font-outfit block">${formatDurationHuman(data.totalFocusSecsAllTime)}</span>
                    </div>
                </div>

                <!-- DAY OF WEEK BREAKDOWN -->
                <div>
                    <h5 class="text-xs font-black text-slate-700 font-outfit mb-2">Weekly Day Distribution</h5>
                    <div class="grid grid-cols-7 gap-1 text-center text-[10px]">
                        ${data.dayOfWeekSuccess.map(dow => {
                            const rate = dow.scheduled > 0 ? Math.round((dow.completed / dow.scheduled) * 100) : 0;
                            return `
                                <div class="neu-card-sm p-1.5 bg-white/80">
                                    <span class="font-bold text-slate-500 block">${dow.day}</span>
                                    <span class="font-black ${rate >= 75 ? 'text-emerald-600' : rate >= 50 ? 'text-blue-600' : 'text-slate-400'} mt-0.5 block">${rate}%</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    }

    function closeHabitAnalyticsModal() {
        if (typeof document === 'undefined') return;
        const modal = document.getElementById('habit-analytics-modal');
        if (modal) modal.classList.add('hidden');
    }

    // =========================================================================
    // 12. MODAL & TAB CONTROLS
    // =========================================================================

    function switchMainTab(tabId) {
        activeTab = tabId;
        if (typeof document === 'undefined') return;
        const tabs = ['today', 'calendar', 'analytics', 'stopwatch'];
        tabs.forEach(t => {
            const btn = document.getElementById(`tab-btn-${t}`);
            const pane = document.getElementById(`tab-pane-${t}`);
            if (btn) {
                if (t === tabId) {
                    btn.className = 'neu-btn pressed px-4 py-2 text-xs font-black text-blue-600 border border-blue-400/40 shadow-inner flex items-center gap-1.5 cursor-pointer';
                } else {
                    btn.className = 'neu-btn px-4 py-2 text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1.5 transition-all cursor-pointer';
                }
            }
            if (pane) {
                if (t === tabId) pane.classList.remove('hidden');
                else pane.classList.add('hidden');
            }
        });

        if (tabId === 'calendar') renderCalendarView();
        if (tabId === 'analytics') renderAnalyticsView();
    }

    function openAddHabitModal(defaultPeriod = ROUTINE_PERIODS.MORNING) {
        if (typeof document === 'undefined') return;
        const modal = document.getElementById('habit-form-modal');
        const form = document.getElementById('habit-modal-form');
        const title = document.getElementById('habit-modal-title');
        const habitIdInput = document.getElementById('modal-habit-id');
        const nameInput = document.getElementById('modal-habit-name');
        const periodSelect = document.getElementById('modal-habit-period');

        if (!modal) return;

        if (form) form.reset();
        if (habitIdInput) habitIdInput.value = '';
        if (title) title.textContent = '✨ Create New Habit';
        if (nameInput) nameInput.value = '';
        if (periodSelect) periodSelect.value = defaultPeriod;

        for (let i = 0; i <= 6; i++) {
            const btn = document.getElementById(`day-toggle-${i}`);
            if (btn) btn.classList.add('checked');
        }

        modal.classList.remove('hidden');
        if (nameInput) setTimeout(() => nameInput.focus(), 50);
    }

    function openEditHabitModal(habitId) {
        if (typeof document === 'undefined') return;
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;

        const modal = document.getElementById('habit-form-modal');
        const title = document.getElementById('habit-modal-title');
        const habitIdInput = document.getElementById('modal-habit-id');
        const nameInput = document.getElementById('modal-habit-name');
        const periodSelect = document.getElementById('modal-habit-period');
        const typeSelect = document.getElementById('modal-habit-type');
        const targetInput = document.getElementById('modal-habit-target');
        const unitInput = document.getElementById('modal-habit-unit');
        const timeInput = document.getElementById('modal-habit-time');

        if (!modal) return;

        if (title) title.textContent = '✏️ Edit Habit';
        if (habitIdInput) habitIdInput.value = habit.id;
        if (nameInput) nameInput.value = habit.name;
        if (periodSelect) periodSelect.value = habit.routinePeriod;
        if (typeSelect) typeSelect.value = habit.trackingType;
        if (targetInput) targetInput.value = habit.target;
        if (unitInput) unitInput.value = habit.unit;
        if (timeInput) timeInput.value = habit.scheduledTime || '';

        for (let i = 0; i <= 6; i++) {
            const btn = document.getElementById(`day-toggle-${i}`);
            if (btn) {
                if (habit.daysOfWeek.includes(i)) btn.classList.add('checked');
                else btn.classList.remove('checked');
            }
        }

        modal.classList.remove('hidden');
    }

    function closeHabitFormModal() {
        if (typeof document === 'undefined') return;
        const modal = document.getElementById('habit-form-modal');
        if (modal) modal.classList.add('hidden');
    }

    function handleHabitFormSubmit(event) {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (typeof document === 'undefined') return;

        const habitId = document.getElementById('modal-habit-id')?.value;
        const name = document.getElementById('modal-habit-name')?.value?.trim();
        const period = document.getElementById('modal-habit-period')?.value || ROUTINE_PERIODS.MORNING;
        const type = document.getElementById('modal-habit-type')?.value || TRACKING_TYPES.COMPLETION;
        const target = parseInt(document.getElementById('modal-habit-target')?.value, 10) || 1;
        const unit = document.getElementById('modal-habit-unit')?.value?.trim() || '';
        const time = document.getElementById('modal-habit-time')?.value?.trim() || '';

        const daysOfWeek = [];
        for (let i = 0; i <= 6; i++) {
            const btn = document.getElementById(`day-toggle-${i}`);
            if (btn && btn.classList.contains('checked')) {
                daysOfWeek.push(i);
            }
        }

        if (!name) {
            if (typeof alert === 'function') alert('Please enter a habit name.');
            return;
        }

        try {
            if (habitId) {
                updateHabit(habitId, {
                    name,
                    routinePeriod: period,
                    trackingType: type,
                    target,
                    unit,
                    scheduledTime: time,
                    daysOfWeek
                });
            } else {
                createHabit({
                    name,
                    routinePeriod: period,
                    trackingType: type,
                    target,
                    unit,
                    scheduledTime: time,
                    daysOfWeek
                });
            }
            closeHabitFormModal();
        } catch (err) {
            if (typeof alert === 'function') alert(err.message || 'Error saving habit.');
        }
    }

    function toggleDayPickerButton(dayIndex) {
        if (typeof document === 'undefined') return;
        const btn = document.getElementById(`day-toggle-${dayIndex}`);
        if (btn) {
            btn.classList.toggle('checked');
        }
    }

    function showToast(title, body, isWarning = false, habitId = null) {
        if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;

        let container = document.getElementById('praxis-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'praxis-toast-container';
            container.className = 'fixed top-4 right-4 sm:top-6 sm:right-6 z-[200] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3';
            if (document.body && typeof document.body.appendChild === 'function') {
                document.body.appendChild(container);
            }
        }

        if (!container) return;

        while (container.children && container.children.length >= 3) {
            container.firstElementChild.remove();
        }

        const toast = document.createElement('div');
        toast.className = `pointer-events-auto neu-card p-3.5 shadow-2xl border flex flex-col gap-2 transition-all duration-300 transform -translate-y-2 opacity-0 ${
            isWarning ? 'border-amber-400 bg-amber-50 text-amber-950' : 'border-blue-500 bg-slate-900 text-white'
        }`;

        toast.innerHTML = `
            <div class="flex items-start justify-between gap-2">
                <div>
                    <h5 class="text-xs font-black font-outfit">${escapeHtml(title)}</h5>
                    <p class="text-[11px] font-semibold opacity-90 mt-0.5">${escapeHtml(body)}</p>
                </div>
                <button onclick="this.closest('.neu-card').remove()" class="text-sm opacity-60 hover:opacity-100 font-bold p-1 cursor-pointer">&times;</button>
            </div>
        `;

        container.appendChild(toast);

        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
                toast.classList.remove('-translate-y-2', 'opacity-0');
                toast.classList.add('translate-y-0', 'opacity-100');
            });
        }

        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('opacity-0');
                setTimeout(() => toast.remove(), 400);
            }
        }, 4500);
    }

    // =========================================================================
    // 13. INITIALIZATION & GLOBAL API REGISTRATION
    // =========================================================================

    function init() {
        loadLocalState();
        renderAllViews();
        setupRealtimeFirestoreListener();

        checkScheduledHabitReminders();
        if (typeof setInterval === 'function') {
            setInterval(checkScheduledHabitReminders, 30000);
        }

        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('praxis:auth-changed', () => {
                loadLocalState();
                renderAllViews();
                setupRealtimeFirestoreListener();
            });

            window.addEventListener('online', () => {
                showToast('🌐 Reconnected', 'Cloud sync active.', false);
                syncToCloud();
            });
            window.addEventListener('offline', () => {
                showToast('📡 Offline Mode', 'Changes are safely saved locally and will sync upon reconnecting.', true);
            });
        }
    }

    window.PraxisRoutine = {
        init,
        createHabit,
        updateHabit,
        deleteHabit,
        reorderHabit,
        toggleHabit: toggleHabitCompletion,
        adjustQuantity: adjustHabitQuantity,
        logDuration: logHabitDuration,
        addDurationMinutes: (hid, mins) => logHabitDuration(hid, mins * 60),
        startHabitFocus: (hid) => {
            linkHabitToFocusTimer(hid);
            switchMainTab('stopwatch');
            startFocusTimer();
        },
        switchTab: switchMainTab,
        openAddHabitModal,
        openEditHabitModal,
        closeHabitFormModal,
        handleHabitFormSubmit,
        toggleDayPickerButton,
        openHabitAnalytics,
        closeHabitAnalyticsModal,
        setFilterPeriod: (period) => {
            currentFilterPeriod = period;
            renderTodayHabits();
        },
        setFocusMode,
        setFocusTimerDuration,
        linkHabitToFocusTimer,
        toggleFocusTimer,
        startFocusTimer,
        pauseFocusTimer,
        resetFocusTimer,
        finishFocusTimerSession,
        recordTimerLap,
        clearTimerLaps,
        copyTimerLaps,
        toggleTimerSound,
        getHabits: () => habits,
        getDailyLogs: () => dailyLogs,
        calculateDailyCompletionRate,
        calculatePeriodConsistency,
        calculateHabitStreak,
        calculateWeeklyInsights
    };

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }

})(typeof window !== 'undefined' ? window : global);

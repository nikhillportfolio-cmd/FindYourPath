// 1. STATE MANAGEMENT
let questions = [];
let currentIndex = 0;
let userInterest = ""; 
let userTraits = {}; 
let globalMatches = []; 
let habits = [];
let currentCategoryFilter = "all"; 

// DOM ELEMENTS - MAIN VIEWS
const landingIntro = document.getElementById("landing-intro");
const appWrapper = document.getElementById("app-wrapper");
const interestSection = document.getElementById("interest-section");
const quizSection = document.getElementById("quiz-section");
const resultSection = document.getElementById("result-section");
const questionText = document.getElementById("question-text");
const optionsContainer = document.getElementById("options-container");
const progressBar = document.getElementById("progress-bar");
const questionCount = document.getElementById("question-count");
const progressPercent = document.getElementById("progress-percent");

// DOM ELEMENTS - RESULTS VIEWS
const matchesOverview = document.getElementById("matches-overview");
const careerDetails = document.getElementById("career-details");

// -------------------------------------------------------------
// 2. SCROLL REVEAL & 3D BOOK SCROLL ANIMATION
// -------------------------------------------------------------
function reveal() {
    const reveals = document.querySelectorAll(".reveal");
    for (let i = 0; i < reveals.length; i++) {
        const windowHeight = window.innerHeight;
        const elementTop = reveals[i].getBoundingClientRect().top;
        const elementVisible = 120; 
        if (elementTop < windowHeight - elementVisible) {
            reveals[i].classList.add("active");
        }
    }
}

function animateBookOnScroll() {
    const bookFrontCover = document.getElementById("book-front-cover");
    const bookPage1 = document.getElementById("book-page-1");
    const bookPage2 = document.getElementById("book-page-2");
    const bookContainer = document.getElementById("book-container");

    if (!bookFrontCover || !landingIntro || landingIntro.style.display === "none") return;

    const scrollY = window.scrollY;
    const heroHeight = landingIntro.offsetHeight || window.innerHeight;
    const progress = Math.min(1, Math.max(0, scrollY / (heroHeight * 0.6)));

    // Smooth page flip calculations
    const coverRot = progress * -160;
    const page1Progress = Math.min(1, Math.max(0, (progress - 0.15) / 0.7));
    const page1Rot = page1Progress * -145;
    const page2Progress = Math.min(1, Math.max(0, (progress - 0.35) / 0.65));
    const page2Rot = page2Progress * -130;

    bookFrontCover.style.transform = `translateZ(16px) rotateY(${coverRot}deg)`;
    bookPage1.style.transform = `translateZ(12px) rotateY(${page1Rot}deg)`;
    bookPage2.style.transform = `translateZ(8px) rotateY(${page2Rot}deg)`;

    // Slight container perspective tilt shift on scroll
    const tiltY = -20 + (progress * 10);
    const tiltX = 20 - (progress * 8);
    bookContainer.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
}

window.addEventListener("scroll", () => {
    reveal();
    requestAnimationFrame(animateBookOnScroll);
});
reveal();
animateBookOnScroll();

// -------------------------------------------------------------
// 3. TRANSITION LOGIC
// -------------------------------------------------------------
function startQuiz(interest) {
    if (window.praxisAuth && !window.praxisAuth.getUser()) {
        if (typeof window.openAuthModal === "function") {
            window.openAuthModal('login');
        }
        return;
    }
    userInterest = interest; 
    window.scrollTo({ top: 0, behavior: 'smooth' });
    landingIntro.classList.add("fade-out");
    interestSection.classList.add("fade-out");

    setTimeout(() => {
        landingIntro.style.display = "none";
        interestSection.classList.add("hidden");
        appWrapper.classList.remove("pb-20");
        appWrapper.classList.add("min-h-screen", "items-center", "py-10");
        quizSection.classList.remove("hidden");
        quizSection.classList.add("slide-up");
        loadQuestions(); 
    }, 400); 
}

// -------------------------------------------------------------
// 4. FETCH QUESTIONS
// -------------------------------------------------------------
async function loadQuestions() {
    try {
        const response = await fetch(`/api/questions?interest=${userInterest}`);
        questions = await response.json();
        renderQuestion();
    } catch (error) {
        questionText.innerText = "Error loading assessment questions. Please check if the server is running.";
    }
}

// -------------------------------------------------------------
// 5. RENDER DYNAMIC QUESTION & OPTIONS
// -------------------------------------------------------------
function renderQuestion() {
    const progress = (currentIndex / questions.length) * 100;
    progressBar.style.width = `${progress}%`;
    if (questionCount) questionCount.innerText = `Question ${currentIndex + 1} of ${questions.length}`;
    if (progressPercent) progressPercent.innerText = `${Math.round(progress)}% Complete`;

    optionsContainer.innerHTML = "";

    const q = questions[currentIndex];
    questionText.innerText = q.text;

    q.options.forEach((option, index) => {
        const btn = document.createElement("button");
        btn.className = `neu-btn w-full text-left p-3.5 sm:p-5 font-semibold text-slate-700 hover:text-blue-600 transition-all duration-300 fade-in flex items-center justify-between group`;
        btn.style.animationDelay = `${index * 80}ms`; 
        
        btn.innerHTML = `
            <span class="text-xs sm:text-sm md:text-base pr-2 sm:pr-4">${option.text}</span>
            <div class="w-7 h-7 sm:w-8 sm:h-8 neu-circle flex items-center justify-center text-slate-400 group-hover:text-blue-600 shrink-0 group-hover:translate-x-1 transition-all">
                <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path>
                </svg>
            </div>
        `;

        btn.onclick = () => {
            btn.classList.add("pressed");
            setTimeout(() => handleAnswer(option.tags), 150);
        };
        optionsContainer.appendChild(btn);
    });
}

// -------------------------------------------------------------
// 6. COMPILE TRAITS & FETCH RESULTS
// -------------------------------------------------------------
function handleAnswer(tags) {
    for (const [trait, points] of Object.entries(tags)) {
        userTraits[trait] = (userTraits[trait] || 0) + points;
    }
    currentIndex++;
    
    if (currentIndex < questions.length) {
        renderQuestion();
    } else {
        progressBar.style.width = "100%";
        if (progressPercent) progressPercent.innerText = "100% Complete";
        quizSection.classList.add("hidden");
        fetchResults(); 
    }
}

// -------------------------------------------------------------
// 7. FETCH RESULTS FROM API
// -------------------------------------------------------------
async function fetchResults() {
    try {
        const payload = { 
            userTraits: userTraits, 
            interest: userInterest
        };
        
        const response = await fetch('/api/calculate-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) 
        });
        
        const data = await response.json(); 
        
        if (!response.ok) {
            throw new Error(data.error || "The server encountered an issue.");
        }

        globalMatches = data; 
        showResultsOverview();

    } catch (error) {
        console.error("Matching failed:", error);
        alert(`Oops! ${error.message} Please refresh and try again.`);
    }
}

// -------------------------------------------------------------
// 8. RENDER OVERVIEW (GRID OF MATCHES)
// -------------------------------------------------------------
function showResultsOverview() {
    resultSection.classList.remove("hidden");
    resultSection.classList.add("slide-up");

    const grid = document.getElementById("matches-grid");
    grid.innerHTML = ""; 

    globalMatches.forEach((match, index) => {
        const card = document.createElement("button");
        
        const isTopMatch = index === 0;
        const cardClass = isTopMatch ? "neu-highlight p-4 sm:p-6 text-left relative overflow-hidden group" : "neu-btn p-4 sm:p-6 text-left relative overflow-hidden group";
        const badgeHTML = isTopMatch ? `<div class="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[9px] sm:text-[10px] font-black px-3 py-1 sm:px-4 sm:py-1.5 rounded-bl-xl sm:rounded-bl-2xl shadow-md tracking-widest font-outfit uppercase">TOP MATCH</div>` : "";

        card.className = `${cardClass} fade-in w-full transition-all duration-300`;
        card.style.animationDelay = `${index * 120}ms`;
        
        card.innerHTML = `
            ${badgeHTML}
            <div class="w-11 h-11 sm:w-14 sm:h-14 neu-circle flex items-center justify-center text-2xl sm:text-3xl mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                ${match.icon}
            </div>
            <h3 class="text-lg sm:text-xl font-black text-slate-800 mb-2 font-outfit group-hover:text-blue-600 transition-colors">${match.title}</h3>
            <p class="text-[11px] sm:text-xs font-bold text-blue-600 uppercase tracking-widest mt-3 sm:mt-4 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                View Roadmap &rarr;
            </p>
        `;
        
        card.onclick = () => {
            card.classList.add("pressed");
            setTimeout(() => showCareerDetails(index), 150);
        };
        grid.appendChild(card);
    });
}

// -------------------------------------------------------------
// 9. RENDER DETAILED VIEW WITH TIMELINE UI
// -------------------------------------------------------------
function showCareerDetails(index) {
    const match = globalMatches[index];
    window.currentCareerMatch = match;

    matchesOverview.classList.add("hidden");
    careerDetails.classList.remove("hidden");

    document.getElementById("detail-icon").innerText = match.icon;
    document.getElementById("detail-title").innerText = match.title;
    document.getElementById("detail-desc").innerText = match.desc;

    const roadmapContainer = document.getElementById("detail-roadmap");
    roadmapContainer.innerHTML = ""; 

    match.phases.forEach((phase, i) => {
        const phaseDiv = document.createElement("div");
        phaseDiv.className = "relative group fade-in";
        phaseDiv.style.animationDelay = `${i * 100}ms`;

        phaseDiv.innerHTML = `
            <div class="absolute -left-[25px] sm:-left-[33px] top-4 w-4 h-4 neu-circle-pressed flex items-center justify-center">
                <div class="w-2 h-2 rounded-full bg-blue-600"></div>
            </div>
            <div class="neu-card-sm p-4 sm:p-6">
                <h4 class="font-black text-blue-600 text-sm sm:text-base mb-1.5 sm:mb-2 font-outfit tracking-wide">${phase.title}</h4>
                <p class="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">${phase.steps}</p>
            </div>
        `;
        roadmapContainer.appendChild(phaseDiv);
    });

    // Auto-sync selected Roadmap to Cloud Firestore for cross-device sync
    if (window.praxisAuth && window.praxisAuth.getUser()) {
        window.praxisAuth.saveRoadmap({
            title: match.title,
            icon: match.icon,
            desc: match.desc,
            phases: match.phases,
            updatedAt: new Date().toISOString()
        });
    }

    const booksContainer = document.getElementById("detail-books");
    booksContainer.innerHTML = "";

    if (match.books && match.books.length > 0) {
        match.books.forEach((book, i) => {
            const li = document.createElement("li");
            li.className = "neu-card-sm p-4 flex items-center gap-3 fade-in";
            li.style.animationDelay = `${(match.phases.length * 100) + (i * 100)}ms`;
            li.innerHTML = `
                <div class="w-9 h-9 neu-circle flex items-center justify-center text-indigo-600 font-bold shrink-0 text-sm">
                    📖
                </div>
                <span class="font-bold text-xs text-slate-700 leading-tight">${book}</span>
            `;
            booksContainer.appendChild(li);
        });
    } else {
        booksContainer.innerHTML = "<p class='text-slate-500 text-xs col-span-2'>Explore foundational industry literature and project guides.</p>";
    }
}

// -------------------------------------------------------------
// 10. BACK BUTTON FUNCTION
// -------------------------------------------------------------
function backToMatches() {
    careerDetails.classList.add("hidden");
    matchesOverview.classList.remove("hidden");
}

// -------------------------------------------------------------
// 11. ROUTINE TRACKER & STREAK ENGINE (LOCAL STORAGE INTEGRATION)
// -------------------------------------------------------------
function getHabitsStorageKey() {
    let email = "";
    if (window.praxisAuth && typeof window.praxisAuth.getUser === "function") {
        const user = window.praxisAuth.getUser();
        if (user && user.email) email = user.email;
    }
    if (!email) {
        try {
            const stored = localStorage.getItem("praxis_auth_user");
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && parsed.email) email = parsed.email;
            }
        } catch (e) {}
    }
    if (!email) email = "guest";
    const cleanEmail = email.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");
    return `findyourpath_habits_${cleanEmail}`;
}

function normalizeHabit(h) {
    if (!h || typeof h !== "object") return null;

    const id = h.id ? String(h.id) : "habit_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
    const name = (h.name || h.title || h.habitName || "Target Habit").trim();
    const timeOfDay = h.timeOfDay || h.category || h.routine || "Morning Routine";
    const scheduledTime = h.scheduledTime || h.time || "";

    let daysArray = new Array(30).fill(false);
    if (Array.isArray(h.days)) {
        for (let i = 0; i < 30; i++) {
            if (i < h.days.length) {
                const val = h.days[i];
                if (val === true || val === "done" || val === 1 || val === "1" || val === "true") {
                    daysArray[i] = "done";
                } else if (val === "missed" || val === -1 || val === "-1") {
                    daysArray[i] = "missed";
                } else {
                    daysArray[i] = false;
                }
            }
        }
    }

    return {
        id: id,
        name: name,
        timeOfDay: timeOfDay,
        scheduledTime: scheduledTime,
        remindedDates: h.remindedDates && typeof h.remindedDates === "object" ? h.remindedDates : {},
        missedNotifiedDates: h.missedNotifiedDates && typeof h.missedNotifiedDates === "object" ? h.missedNotifiedDates : {},
        notifiedEvents: h.notifiedEvents && typeof h.notifiedEvents === "object" ? h.notifiedEvents : {},
        days: daysArray,
        createdAt: h.createdAt || Date.now()
    };
}

function loadHabitsFromStorage() {
    const key = getHabitsStorageKey();
    try {
        let saved = localStorage.getItem(key);
        // Fallback checks for legacy local storage keys
        if (!saved) {
            saved = localStorage.getItem("findyourpath_habits") || localStorage.getItem("praxis_habits") || localStorage.getItem("habits");
        }
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                habits = parsed.map(normalizeHabit).filter(Boolean);
            } else {
                habits = [];
            }
        } else {
            habits = [];
        }
    } catch (e) {
        console.error("Failed to parse habits from localStorage:", e);
        habits = [];
    }

    if (!Array.isArray(habits)) habits = [];

    if (typeof renderHabitsList === "function") renderHabitsList();
    if (typeof updateGrowthCharts === "function") updateGrowthCharts();
    updateFloatingBadge();

    // Fetch latest synced habits from Cloud / Server in background if authenticated
    const storedUser = localStorage.getItem("praxis_auth_user");
    if (storedUser || (window.praxisAuth && window.praxisAuth.getUser())) {
        if (window.praxisAuth && typeof window.praxisAuth.fetchData === "function") {
            window.praxisAuth.fetchData();
        }
    }
}

function saveHabitsToStorage() {
    if (!Array.isArray(habits)) habits = [];
    updateFloatingBadge();
    const key = getHabitsStorageKey();

    // 1. ALWAYS persist to email-namespaced local storage
    try {
        localStorage.setItem(key, JSON.stringify(habits));
    } catch (e) {
        console.error("Failed to save habits to localStorage:", e);
    }

    // 2. ALSO push to Google Cloud & Server Database if user is signed in
    if (window.praxisAuth && window.praxisAuth.getUser()) {
        window.praxisAuth.saveRoutine({
            habits: habits,
            updatedAt: new Date().toISOString()
        });
    }

    // 3. Sync latest habits to 24/7 background Push Notification server
    if (typeof syncHabitsToPushServer === "function") {
        syncHabitsToPushServer(habits);
    }
}

window.clearUserUIState = function() {
    habits = [];
    if (typeof renderHabitsList === "function") renderHabitsList();
    if (typeof updateGrowthCharts === "function") updateGrowthCharts();
    if (typeof updateFloatingBadge === "function") updateFloatingBadge();
    console.log("[PRAXiS UI] Active user memory and screen elements cleared on sign out.");
};

function updateFloatingBadge() {
    const badge = document.getElementById("tracker-badge-count");
    if (badge) {
        const count = Array.isArray(habits) ? habits.length : 0;
        if (count > 0) {
            badge.innerText = count;
            badge.classList.remove("hidden");
        } else {
            badge.classList.add("hidden");
        }
    }
}

// STREAK CALCULATION ENGINE
// Detects consecutive checked days across the 30-day grid
function isDayDone(val) {
    return val === true || val === "done" || val === 1 || val === "1" || val === "true";
}

function isDayMissed(val) {
    return val === "missed" || val === -1 || val === "-1";
}

function calculateHabitStreak(days) {
    if (!Array.isArray(days)) return 0;
    let maxStreak = 0;
    let currentStreak = 0;
    let temp = 0;

    for (let i = 0; i < days.length; i++) {
        if (isDayDone(days[i])) {
            temp++;
            if (temp > maxStreak) maxStreak = temp;
        } else {
            temp = 0;
        }
    }

    // Active streak up to last checked day
    let lastCheckedIndex = -1;
    for (let i = days.length - 1; i >= 0; i--) {
        if (isDayDone(days[i])) {
            lastCheckedIndex = i;
            break;
        }
    }
    if (lastCheckedIndex !== -1) {
        for (let i = lastCheckedIndex; i >= 0; i--) {
            if (isDayDone(days[i])) {
                currentStreak++;
            } else {
                break;
            }
        }
    }

    return Math.max(currentStreak, maxStreak);
}

// Calculates Day 1-30 tracker day index relative to habit journey start (Day 1 = index 0)
function getCurrentTrackerDayIndex() {
    if (!Array.isArray(habits) || habits.length === 0) return 0; // Default to Day 1 (index 0)
    let earliestTime = Infinity;
    habits.forEach(h => {
        if (h && typeof h.createdAt === "number" && !isNaN(h.createdAt) && h.createdAt > 0) {
            earliestTime = Math.min(earliestTime, h.createdAt);
        }
    });

    if (earliestTime === Infinity) return 0;

    const createdDate = new Date(earliestTime);
    const startOfCreatedDay = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate()).getTime();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffMs = startOfToday - startOfCreatedDay;
    const diffDays = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
    return Math.min(29, diffDays); // Day 1 = index 0, Day 2 = index 1, ..., up to Day 30 = index 29
}

function getHabitTodayIndex(habit) {
    if (!habit || typeof habit.createdAt !== "number" || isNaN(habit.createdAt) || habit.createdAt <= 0) {
        return getCurrentTrackerDayIndex();
    }
    const createdDate = new Date(habit.createdAt);
    const startOfCreatedDay = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate()).getTime();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffMs = startOfToday - startOfCreatedDay;
    const diffDays = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
    return Math.min(29, diffDays);
}

// GITHUB-STYLE 30-DAY CONTRIBUTION HEATMAP ENGINE
function renderHeatmap() {
    const grid = document.getElementById("heatmap-grid");
    if (!grid) return;

    grid.innerHTML = "";
    if (!Array.isArray(habits)) habits = [];
    const totalHabits = habits.length;
    const todayIndex = getCurrentTrackerDayIndex();

    for (let day = 0; day < 30; day++) {
        let completedCount = 0;
        let completedHabitNames = [];
        let missedHabitNames = [];

        habits.forEach(h => {
            if (h && Array.isArray(h.days)) {
                if (isDayDone(h.days[day])) {
                    completedCount++;
                    completedHabitNames.push(h.name);
                } else if (isDayMissed(h.days[day])) {
                    missedHabitNames.push(h.name);
                }
            }
        });

        const pct = totalHabits > 0 ? Math.round((completedCount / totalHabits) * 100) : 0;
        const isToday = (day === todayIndex);

        // Tile styling based on completion level
        let styleClass = "";
        let levelName = "";

        if (totalHabits === 0 || completedCount === 0) {
            styleClass = "bg-[#e0e5ec] text-slate-400 shadow-[inset_2px_2px_4px_#b8bec7,inset_-2px_-2px_4px_#ffffff]";
            levelName = totalHabits === 0 ? "No habits defined" : "No habits completed";
        } else if (pct <= 25) {
            styleClass = "bg-emerald-200 text-emerald-900 border border-emerald-300 font-bold shadow-xs";
            levelName = "Light activity";
        } else if (pct <= 50) {
            styleClass = "bg-emerald-400 text-emerald-950 font-bold border border-emerald-500 shadow-sm";
            levelName = "Moderate activity";
        } else if (pct <= 75) {
            styleClass = "bg-emerald-500 text-white font-black shadow-md shadow-emerald-500/30";
            levelName = "High activity";
        } else {
            styleClass = "bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black shadow-lg shadow-emerald-500/40 border border-emerald-300/30";
            levelName = "Peak discipline!";
        }

        const todayRingClass = isToday 
            ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-[#e0e5ec] relative z-10" 
            : "";

        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = `h-9 sm:h-10 rounded-lg flex flex-col items-center justify-center text-[10px] transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer relative group ${styleClass} ${todayRingClass}`;
        tile.title = `Day ${day + 1}${isToday ? ' (Today)' : ''}: ${completedCount}/${totalHabits} completed (${pct}%) - ${levelName}`;
        
        const countText = totalHabits > 0 ? `${completedCount}/${totalHabits}` : `-`;
        tile.innerHTML = `
            <span class="leading-none font-black flex items-center gap-0.5">
                ${day + 1}
                ${isToday ? '<span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>' : ''}
            </span>
            <span class="text-[8px] sm:text-[9px] opacity-80 mt-0.5 font-semibold">${countText}</span>
        `;

        const updateBanner = () => {
            const banner = document.getElementById("heatmap-detail-banner");
            if (banner) {
                if (totalHabits === 0) {
                    banner.innerHTML = `📅 <strong>Day ${day + 1}${isToday ? ' (Today)' : ''}</strong>: No habits created yet. Define habits below to light up your heatmap!`;
                } else {
                    let habitsDetailStr = "";
                    if (completedHabitNames.length > 0) {
                        habitsDetailStr = ` • <span class="text-emerald-700 font-bold">✓ ${completedHabitNames.slice(0, 3).map(escapeHtml).join(", ")}${completedHabitNames.length > 3 ? ` +${completedHabitNames.length - 3} more` : ''}</span>`;
                    }
                    if (missedHabitNames.length > 0) {
                        habitsDetailStr += ` • <span class="text-rose-600 font-bold">✕ ${missedHabitNames.slice(0, 2).map(escapeHtml).join(", ")}</span>`;
                    }

                    banner.innerHTML = `📅 <strong>Day ${day + 1}${isToday ? ' (Today)' : ''}</strong>: <span>${completedCount} of ${totalHabits} habits completed</span> (<strong class="text-emerald-700 font-black">${pct}%</strong>) • <em>${levelName}</em>${habitsDetailStr}`;
                }
            }
        };

        tile.addEventListener("mouseenter", updateBanner);
        tile.addEventListener("click", updateBanner);

        // Highlight and default banner to today
        if (isToday) {
            updateBanner();
        }

        grid.appendChild(tile);
    }
}

// OVERALL & DAILY GROWTH ANALYTICS
function updateGrowthCharts() {
    if (!Array.isArray(habits)) habits = [];
    const overallCircle = document.getElementById("overall-progress-circle");
    const overallPercentText = document.getElementById("overall-percent-text");
    const overallStatusText = document.getElementById("overall-status-text");
    const statHabits = document.getElementById("stat-total-habits");
    const statChecks = document.getElementById("stat-total-checks");
    const statStreakVal = document.getElementById("stat-streak-val");

    const totalHabitsCount = habits.length;
    let totalCheckedHabitCells = 0;
    let highestStreakAcrossAll = 0;

    habits.forEach(h => {
        if (!h) return;
        if (!Array.isArray(h.days)) h.days = new Array(30).fill(false);
        const checkedCount = h.days.filter(isDayDone).length;
        totalCheckedHabitCells += checkedCount;
        const streak = calculateHabitStreak(h.days);
        if (streak > highestStreakAcrossAll) highestStreakAcrossAll = streak;
    });

    // Calculate unique calendar days (out of 30) where at least one habit was completed
    let uniqueDaysDoneCount = 0;
    if (totalHabitsCount > 0) {
        for (let day = 0; day < 30; day++) {
            const isDayCompleted = habits.some(h => h && Array.isArray(h.days) && isDayDone(h.days[day]));
            if (isDayCompleted) uniqueDaysDoneCount++;
        }
    }

    const totalPossibleChecks = totalHabitsCount * 30;
    const overallPercentage = totalPossibleChecks > 0 
        ? Math.round((totalCheckedHabitCells / totalPossibleChecks) * 100) 
        : 0;

    // SVG Circle calculation (r = 40, circumference = ~251.327)
    if (overallCircle) {
        const circumference = 251.327;
        const offset = circumference - (overallPercentage / 100) * circumference;
        overallCircle.style.strokeDashoffset = offset;
    }

    if (overallPercentText) overallPercentText.innerText = `${overallPercentage}%`;
    if (statHabits) statHabits.innerText = totalHabitsCount;
    if (statChecks) statChecks.innerText = uniqueDaysDoneCount;
    if (statStreakVal) statStreakVal.innerText = highestStreakAcrossAll;

    if (overallStatusText) {
        if (totalHabitsCount === 0) {
            overallStatusText.innerText = "Add habits below to start measuring your 30-day discipline.";
        } else if (overallPercentage >= 80) {
            overallStatusText.innerText = "🔥 Unstoppable Momentum! You are crushing your routine targets!";
        } else if (overallPercentage >= 40) {
            overallStatusText.innerText = "⚡ Building Strong Habits! Stay consistent every single day.";
        } else {
            overallStatusText.innerText = "🌱 Starting Your Journey! Keep checking off days to build momentum.";
        }
    }

    renderHeatmap();
}

// CATEGORY FILTER SELECTION
function setCategoryFilter(category) {
    currentCategoryFilter = category;
    
    // Update tab button active states
    const tabs = {
        'all': 'cat-tab-all',
        'Morning Routine': 'cat-tab-morning',
        'Afternoon Focus': 'cat-tab-afternoon',
        'Evening Wind-down': 'cat-tab-evening'
    };

    Object.keys(tabs).forEach(catKey => {
        const btn = document.getElementById(tabs[catKey]);
        if (btn) {
            if (catKey === category) {
                btn.className = "cat-tab-btn neu-btn pressed px-4 py-2 text-xs font-bold text-blue-600 border border-blue-500/30";
            } else {
                btn.className = "cat-tab-btn neu-btn px-4 py-2 text-xs font-bold text-slate-600";
            }
        }
    });

    renderHabitsList();
}

// SPREADSHEET TICK BOX MARKS GENERATOR (MOBILE OPTIMIZED SQUARE PROPORTIONS)
function getHandwrittenMarkHTML(val, dayIndex) {
    if (isDayDone(val)) {
        const rot = ((dayIndex % 5) - 2) * 1.5;
        return `
            <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center pointer-events-none bg-emerald-500/15 border border-emerald-500/40 shadow-xs">
                <svg viewBox="0 0 20 20" class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700 drop-shadow-xs" style="transform: rotate(${rot}deg);" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3.5 10.5 L7.5 14.5 L16.5 5.5" 
                        stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </div>
        `;
    }
    if (isDayMissed(val)) {
        const rot = ((dayIndex % 3) - 1) * 2;
        return `
            <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center pointer-events-none bg-rose-500/15 border border-rose-500/40 shadow-xs">
                <svg viewBox="0 0 20 20" class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600 drop-shadow-xs" style="transform: rotate(${rot}deg);" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 5 L15 15 M15 5 L5 15" 
                        stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </div>
        `;
    }
    return `
        <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center pointer-events-none border border-slate-300/60 bg-white/20 group-hover:bg-white/40">
            <span class="w-1.5 h-1.5 rounded-full bg-slate-400/40 inline-block"></span>
        </div>
    `;
}

// SERVICE WORKER & 24/7 BACKGROUND WEB PUSH NOTIFICATION ENGINE
let sharedAudioCtx = null;

function getSharedAudioContext() {
    if (!sharedAudioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
            sharedAudioCtx = new AudioCtx();
        }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
}

// Global user gesture unlock listener for Web Audio Context
['click', 'keydown', 'touchstart'].forEach(eventType => {
    window.addEventListener(eventType, () => {
        getSharedAudioContext();
    }, { once: true, passive: true });
});

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function registerServiceWorkerAndSync() {
    if (!('serviceWorker' in navigator)) return null;
    try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        console.log('PRAXiS Service Worker registered:', reg.scope);

        // If notification permission is already granted, verify and sync push subscription in background
        if (window.Notification && Notification.permission === 'granted') {
            subscribeToPushNotifications(true).catch(e => {
                console.warn('Background push subscription sync warning:', e);
            });
        }
        return reg;
    } catch (err) {
        console.log('PRAXiS Service Worker registration failed:', err);
        return null;
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        registerServiceWorkerAndSync();
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, action, habitId } = event.data || {};
        if (type === 'NOTIFICATION_ACTION' && habitId) {
            if (action === 'complete') {
                markHabitCompletedDirectly(habitId);
            } else if (action === 'missed') {
                markHabitMissedDirectly(habitId);
            } else if (action === 'snooze') {
                snoozeHabitReminder(habitId, 10);
            }
        }
    });
}

// Subscribes browser to 24/7 background Web Push via PushManager & VAPID
async function subscribeToPushNotifications(silent = false) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!silent) {
            showInAppToast("🔕 Web Push Unavailable", "Your browser does not support background Web Push.", true);
        }
        return null;
    }

    try {
        const reg = await navigator.serviceWorker.ready;
        let subscription = await reg.pushManager.getSubscription();

        // 1. Fetch server's VAPID public key
        const keyRes = await fetch('/api/push/vapid-public-key');
        const keyData = await keyRes.json();

        if (!keyData || !keyData.publicKey) {
            throw new Error("Unable to retrieve VAPID public key from server");
        }

        const convertedVapidKey = urlBase64ToUint8Array(keyData.publicKey);

        // 2. If no existing push subscription, create one with the PushManager
        if (!subscription) {
            subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
        }

        // 3. Register or update subscription on backend server
        const user = (window.praxisAuth && window.praxisAuth.getUser()) || null;
        const email = user?.email || localStorage.getItem("praxis_auth_email") || "";
        const userId = user?.id || user?.uid || "";
        const clientId = typeof getOrCreateClientId === "function" ? getOrCreateClientId() : "cid_" + Date.now();

        await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscription: subscription.toJSON(),
                userId: userId,
                email: email,
                clientId: clientId,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                timezoneOffset: new Date().getTimezoneOffset(),
                habits: Array.isArray(habits) ? habits : []
            })
        });

        localStorage.setItem("praxis_push_registered", "true");
        updateNotificationBtnState();

        if (!silent) {
            showInAppToast("🔔 24/7 Reminders Active", "Background Push Reminders are activated! You will receive routine alerts even when your browser or website is completely closed. 🎉", false);
        }

        return subscription;
    } catch (error) {
        console.error("Push subscription setup error:", error);
        if (!silent) {
            showInAppToast("⚠️ Reminder Setup Error", error.message || "Failed to setup background push reminders.", true);
        }
        return null;
    }
}

// Sync latest habits to backend push engine whenever habits are added, edited, or checked off
async function syncHabitsToPushServer(habitsToSync) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
        const reg = await navigator.serviceWorker.ready;
        const subscription = await reg.pushManager.getSubscription();

        const user = (window.praxisAuth && window.praxisAuth.getUser()) || null;
        const email = user?.email || localStorage.getItem("praxis_auth_email") || "";
        const userId = user?.id || user?.uid || "";
        const clientId = typeof getOrCreateClientId === "function" ? getOrCreateClientId() : "";

        await fetch('/api/push/sync-habits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: subscription ? subscription.endpoint : null,
                userId: userId,
                email: email,
                clientId: clientId,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                timezoneOffset: new Date().getTimezoneOffset(),
                habits: habitsToSync || habits || []
            })
        });
    } catch (e) {
        // Non-critical background sync
    }
}

function formatAMPM(timeStr) {
    if (!timeStr) return "";
    const parts = timeStr.split(":");
    if (parts.length < 2) return timeStr;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const ampm = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 || 12;
    const displayM = m < 10 ? "0" + m : m;
    return `${displayH}:${displayM} ${ampm}`;
}

function playNotificationSound(soundType) {
    try {
        const ctx = getSharedAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (soundType === 'missed' || soundType === true) {
            osc.frequency.setValueAtTime(280, now);
            osc.frequency.exponentialRampToValueAtTime(170, now + 0.45);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
            osc.start(now);
            osc.stop(now + 0.45);
        } else if (soundType === 'complete') {
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.setValueAtTime(880, now + 0.15); // A5
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        } else {
            // Upbeat 3-note chime (C5 -> E5 -> G5)
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(659.25, now + 0.12);
            osc.frequency.setValueAtTime(783.99, now + 0.24);
            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        }

        setTimeout(() => {
            try {
                osc.disconnect();
                gain.disconnect();
            } catch (e) {}
        }, 600);
    } catch (e) {
        console.log("Audio play error:", e);
    }
}

// User-triggered manual Done mark (Tick ✓)
function markHabitCompletedDirectly(habitId) {
    if (!Array.isArray(habits)) return;
    const habitIndex = habits.findIndex(h => h && (h.id === habitId || String(h.id) === String(habitId)));
    if (habitIndex === -1) return;

    const habit = habits[habitIndex];
    const todayIndex = getHabitTodayIndex(habit);

    if (!Array.isArray(habit.days)) habit.days = Array(30).fill(false);
    habit.days[todayIndex] = "done";
    saveHabitsToStorage();
    renderHabitsList();
    updateGrowthCharts();

    playNotificationSound('complete');
    showInAppToast("✅ Habit Completed!", `Awesome work! "${habit.name}" has been marked as done (✓) for today (Day ${todayIndex + 1}).`, false);
    trackEvent({ type: 'routine_interaction', clientId: getOrCreateClientId(), isCheckoff: true });
}

// User-triggered manual Missed mark (Cross ✕)
function markHabitMissedDirectly(habitId) {
    if (!Array.isArray(habits)) return;
    const habitIndex = habits.findIndex(h => h && (h.id === habitId || String(h.id) === String(habitId)));
    if (habitIndex === -1) return;

    const habit = habits[habitIndex];
    const todayIndex = getHabitTodayIndex(habit);

    if (!Array.isArray(habit.days)) habit.days = Array(30).fill(false);
    habit.days[todayIndex] = "missed";
    saveHabitsToStorage();
    renderHabitsList();
    updateGrowthCharts();

    playNotificationSound('missed');
    showInAppToast("✕ Habit Missed", `"${habit.name}" marked as missed (✕) for today (Day ${todayIndex + 1}).`, true);
    trackEvent({ type: 'routine_interaction', clientId: getOrCreateClientId(), isCheckoff: false });
}

function snoozeHabitReminder(habitId, minutes = 10) {
    if (!Array.isArray(habits)) return;
    const habit = habits.find(h => h && (h.id === habitId || String(h.id) === String(habitId)));
    if (!habit) return;

    habit.snoozedUntil = Date.now() + minutes * 60 * 1000;
    saveHabitsToStorage();

    showInAppToast("⏰ Reminder Snoozed", `Reminder for "${habit.name}" snoozed for ${minutes} minutes.`, false);
}

function showInAppToast(title, body, isMissed, habitId = null) {
    let container = document.getElementById("praxis-toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "praxis-toast-container";
        container.className = "fixed top-4 right-4 sm:top-6 sm:right-6 z-[200] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3";
        document.body.appendChild(container);
    }

    // Limit visible toasts to 3 maximum
    while (container.children.length >= 3) {
        container.firstElementChild.remove();
    }

    const toast = document.createElement("div");
    toast.className = `pointer-events-auto neu-card p-3.5 sm:p-4 shadow-2xl border flex flex-col gap-2.5 transition-all duration-500 transform -translate-y-4 opacity-0 ${
        isMissed 
            ? 'border-rose-400/80 bg-rose-50/95 text-rose-950' 
            : 'border-blue-500/80 bg-slate-900/95 text-white'
    }`;

    let actionButtonsHTML = '';
    if (habitId) {
        actionButtonsHTML = `
            <div class="flex items-center gap-1.5 sm:gap-2 mt-1 pt-2 border-t border-current/15 flex-wrap">
                <button onclick="markHabitCompletedDirectly('${escapeHtml(habitId)}'); this.closest('.neu-card').remove();" 
                    class="px-2.5 py-1 text-[11px] font-black rounded-lg ${isMissed ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'} transition-all cursor-pointer shadow-sm">
                    ✅ Mark Done
                </button>
                <button onclick="markHabitMissedDirectly('${escapeHtml(habitId)}'); this.closest('.neu-card').remove();" 
                    class="px-2.5 py-1 text-[11px] font-bold rounded-lg ${isMissed ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 border border-rose-400/50'} transition-all cursor-pointer shadow-sm">
                    ✕ Mark Missed
                </button>
                <button onclick="snoozeHabitReminder('${escapeHtml(habitId)}', 10); this.closest('.neu-card').remove();" 
                    class="px-2 py-1 text-[10px] sm:text-[11px] font-bold rounded-lg ${isMissed ? 'bg-slate-200/80 text-slate-800 hover:bg-slate-300' : 'bg-slate-700/80 text-slate-200 hover:bg-slate-700'} transition-all cursor-pointer">
                    ⏰ Snooze 10m
                </button>
            </div>
        `;
    }

    toast.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="text-xl sm:text-2xl shrink-0 mt-0.5">${isMissed ? '😔' : '⏰'}</div>
            <div class="flex-1 min-w-0">
                <h5 class="font-black text-xs sm:text-sm font-outfit leading-snug">${escapeHtml(title)}</h5>
                <p class="text-[11px] font-semibold opacity-90 mt-0.5 leading-relaxed">${escapeHtml(body)}</p>
            </div>
            <button onclick="this.closest('.neu-card').remove()" class="text-sm opacity-60 hover:opacity-100 font-black p-1 shrink-0 cursor-pointer">&times;</button>
        </div>
        ${actionButtonsHTML}
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove("-translate-y-4", "opacity-0");
        toast.classList.add("translate-y-0", "opacity-100");
    });

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add("opacity-0", "-translate-y-2");
            setTimeout(() => toast.remove(), 500);
        }
    }, 8500);
}

function sendNotification(title, options) {
    const isMissed = options.isMissed || false;
    const soundType = isMissed ? 'missed' : 'reminder';

    // 1. Play Web Audio chime
    playNotificationSound(soundType);

    // 2. Display In-App Floating Toast with explicit quick action buttons
    showInAppToast(title, options.body, isMissed, options.habitId);

    // 3. Dispatch Native / Mobile Push Notification with explicit action buttons
    if ("Notification" in window && Notification.permission === "granted") {
        const notifPayload = {
            body: options.body,
            icon: options.icon || '/favicon.ico',
            badge: '/favicon.ico',
            tag: options.tag || 'praxis-notif',
            renotify: true,
            vibrate: [100, 50, 100],
            data: { habitId: options.habitId || '' }
        };

        if (options.habitId) {
            notifPayload.actions = [
                { action: 'complete', title: '✅ Mark Done' },
                { action: 'missed', title: '✕ Mark Missed' },
                { action: 'snooze', title: '⏰ Snooze 10m' }
            ];
        }

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(title, notifPayload);
            }).catch(() => {
                fallbackNativeNotification(title, notifPayload);
            });
        } else {
            fallbackNativeNotification(title, notifPayload);
        }
    }
}

function fallbackNativeNotification(title, options) {
    try {
        new Notification(title, {
            body: options.body,
            icon: options.icon || '/favicon.ico',
            tag: options.tag || 'praxis-notif',
            renotify: true
        });
    } catch (e) {
        console.log("Native Notification fallback error:", e);
    }
}

async function requestNotificationPermission() {
    if (!("Notification" in window)) {
        showInAppToast("🔕 Notifications Unsupported", "Web Notifications are not supported in this browser environment.", true);
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        updateNotificationBtnState();
        if (permission === "granted") {
            await subscribeToPushNotifications(false);
            sendNotification("🔔 PRAXiS Reminders Activated", {
                body: "24/7 background reminders are active! You'll receive 7-minute alerts before your scheduled habits even when the website or browser is closed! 💪",
                tag: 'praxis-welcome',
                isMissed: false
            });
        } else if (permission === "denied") {
            alert("Notification permission was denied. Please allow notifications in your browser/device settings so PRAXiS can alert you on schedule.");
        }
    } catch (err) {
        console.error("Permission request error:", err);
    }
}

function updateNotificationBtnState() {
    const btn = document.getElementById("notif-permission-btn");
    if (!btn) return;
    if (!("Notification" in window)) {
        btn.innerHTML = `<span class="text-slate-400">🔕 Notifications Unsupported</span>`;
        return;
    }
    if (Notification.permission === "granted") {
        btn.innerHTML = `<span class="text-emerald-700 font-bold">🔔 24/7 Reminders Active</span>`;
        btn.className = "neu-badge px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-500/15 flex items-center gap-1.5 shrink-0";
        btn.title = "24/7 Closed-Browser & Phone reminders are active (7 mins prior & on time)";
    } else if (Notification.permission === "denied") {
        btn.innerHTML = `<span class="text-rose-700 font-bold">🔕 Notifications Blocked</span>`;
        btn.className = "neu-badge px-2.5 py-1 text-[11px] font-extrabold text-rose-700 bg-rose-500/15 flex items-center gap-1.5 shrink-0";
        btn.title = "Notifications are blocked in your browser settings";
    } else {
        btn.innerHTML = `<span class="text-xs">🔔</span> Enable 24/7 Reminders`;
        btn.className = "neu-badge px-2.5 py-1 text-[11px] font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-all cursor-pointer";
        btn.title = "Enable 24/7 phone & closed-browser reminders for scheduled habits";
    }
}

async function testNotificationNow() {
    if (!("Notification" in window)) {
        showInAppToast("🧪 Test Notification Active", "In-app toast & audio chime work! Note: Your browser doesn't support system notifications.", false);
        playNotificationSound('reminder');
        return;
    }

    if (Notification.permission !== "granted") {
        try {
            const permission = await Notification.requestPermission();
            updateNotificationBtnState();
            if (permission === "granted") {
                await subscribeToPushNotifications(true);
                await triggerTestAlerts();
            } else {
                showInAppToast("⚠️ Notifications Blocked", "Please allow notification permissions in your browser to receive alerts.", true);
            }
        } catch (e) {
            console.error("Test notification permission error:", e);
        }
    } else {
        await triggerTestAlerts();
    }
}

async function triggerTestAlerts() {
    const sampleHabit = (Array.isArray(habits) && habits.length > 0) ? habits[0] : null;

    // 1. Play immediate local chime & in-app toast
    sendNotification("⏰ Test Habit Reminder (7 mins prior)", {
        body: "Success! Your habit notifications, phone alerts & audio chime are active! Testing server-to-device closed-browser push next... 🚀",
        tag: 'praxis-test-remind',
        habitId: sampleHabit ? sampleHabit.id : null,
        isMissed: false
    });

    // 2. Dispatch real Web Push from Server to prove closed-browser delivery
    try {
        let endpoint = null;
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) endpoint = sub.endpoint;
        }

        const res = await fetch('/api/push/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: endpoint,
                title: sampleHabit ? `⏰ Reminder: ${sampleHabit.name}` : "⏰ PRAXiS 24/7 Habit Reminder",
                body: sampleHabit 
                    ? `Time for "${sampleHabit.name}"! Background push arrives even when website & browser are closed. 🎉`
                    : "Web Push verification successful! Reminders will ring even when your website & browser are closed! 🎉",
                habitId: sampleHabit ? sampleHabit.id : null
            })
        });

        const data = await res.json();
        if (data.success) {
            console.log("Server test push dispatched successfully:", data);
        }
    } catch (e) {
        console.warn("Server test push dispatch warning:", e);
    }
}

let lastNotificationCheckTime = 0;

function checkHabitNotifications() {
    if (!Array.isArray(habits) || habits.length === 0) return;

    const now = new Date();
    const nowMs = now.getTime();
    
    // Throttle check execution to at most once per 10 seconds to prevent unnecessary processing
    if (nowMs - lastNotificationCheckTime < 9500) return;
    lastNotificationCheckTime = nowMs;

    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTotalMins = currentHour * 60 + currentMin;

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    habits.forEach(habit => {
        if (!habit || !habit.scheduledTime) return;

        const parts = habit.scheduledTime.split(":");
        if (parts.length < 2) return;
        const targetH = parseInt(parts[0], 10);
        const targetM = parseInt(parts[1], 10);
        if (isNaN(targetH) || isNaN(targetM)) return;

        const scheduledTotalMins = targetH * 60 + targetM;
        const diffMinutes = currentTotalMins - scheduledTotalMins;
        const todayIndex = getHabitTodayIndex(habit);
        const isTodayDone = habit.days && isDayDone(habit.days[todayIndex]);

        if (!habit.notifiedEvents) habit.notifiedEvents = {};
        if (!Array.isArray(habit.notifiedEvents[todayStr])) {
            habit.notifiedEvents[todayStr] = [];
        }
        const sentEvents = habit.notifiedEvents[todayStr];

        // 1. Snooze Alert Trigger
        if (habit.snoozedUntil && nowMs >= habit.snoozedUntil && nowMs <= habit.snoozedUntil + 15 * 60 * 1000) {
            const snoozeKey = 'snooze_' + habit.snoozedUntil;
            if (!sentEvents.includes(snoozeKey)) {
                sentEvents.push(snoozeKey);
                habit.snoozedUntil = 0;
                saveHabitsToStorage();

                sendNotification(`⏰ Snooze Over: ${habit.name}`, {
                    body: `Your 10-minute snooze for "${habit.name}" is up. Ready to crush this habit today? 💪`,
                    tag: `praxis-snooze-${habit.id}-${nowMs}`,
                    habitId: habit.id,
                    isMissed: false
                });
            }
        }

        // If habit is already marked done, skip remaining alerts
        if (isTodayDone) return;

        // 2. 7-Minute Prior Pre-Habit Reminder Notification
        if (diffMinutes >= -8 && diffMinutes <= -2) {
            if (!sentEvents.includes('prior_7m')) {
                sentEvents.push('prior_7m');
                saveHabitsToStorage();
                
                sendNotification(`⏰ In 7 Mins: ${habit.name}`, {
                    body: `Your habit "${habit.name}" is scheduled for ${formatAMPM(habit.scheduledTime)} (in 7 minutes). Get ready to build discipline! 💪`,
                    tag: `praxis-prior-${habit.id}-${todayStr}`,
                    habitId: habit.id,
                    isMissed: false
                });
            }
        }

        // 3. Exact Target Time Due Alert (Fired right as scheduled time arrives!)
        if (diffMinutes >= -1 && diffMinutes <= 15) {
            if (!sentEvents.includes('due_exact')) {
                sentEvents.push('due_exact');
                saveHabitsToStorage();

                sendNotification(`🔔 Target Time: ${habit.name}!`, {
                    body: `It's ${formatAMPM(habit.scheduledTime)}! Time for your scheduled routine: "${habit.name}". Build your streak right now! 🎯`,
                    tag: `praxis-due-${habit.id}-${todayStr}`,
                    habitId: habit.id,
                    isMissed: false
                });
            }
        }

        // 4. Prompt Reminder Notification when Target Time passes
        if (diffMinutes >= 25 && diffMinutes <= 180) {
            if (!sentEvents.includes('followup_prompt')) {
                sentEvents.push('followup_prompt');
                saveHabitsToStorage();

                const quotes = [
                    `⏰ Target time passed for "${habit.name}" (${formatAMPM(habit.scheduledTime)}). Have you finished it yet?`,
                    `💪 Don't forget your habit: "${habit.name}". Build your streak today!`,
                    `🎯 Scheduled target: "${habit.name}" at ${formatAMPM(habit.scheduledTime)}. Click to mark Done or Missed!`
                ];
                const msg = quotes[Math.floor(Math.random() * quotes.length)];

                sendNotification(`⏰ Habit Check-in: ${habit.name}`, {
                    body: msg,
                    tag: `praxis-followup-${habit.id}-${todayStr}`,
                    habitId: habit.id,
                    isMissed: false
                });
            }
        }
    });
}

// Optimized notification scheduler: Runs immediately, on visibility change, and on smart 15s interval
checkHabitNotifications();
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        lastNotificationCheckTime = 0; // Force immediate check when tab becomes active
        checkHabitNotifications();
    }
});
setInterval(checkHabitNotifications, 15000);

function editHabitTime(habitIndex) {
    const habit = habits[habitIndex];
    if (!habit) return;
    const currentTime = habit.scheduledTime || "";
    const newTime = prompt(`Set/Update target time for "${habit.name}"\n(Enter 24-hour time e.g. 07:30 or 18:45, or leave blank to clear):`, currentTime);
    if (newTime !== null) {
        habit.scheduledTime = newTime.trim();
        habit.remindedDates = {};
        habit.missedNotifiedDates = {};
        habit.snoozedUntil = 0;
        saveHabitsToStorage();
        renderHabitsList();
        lastNotificationCheckTime = 0;
        checkHabitNotifications();
        if (habit.scheduledTime && "Notification" in window && Notification.permission !== "granted") {
            requestNotificationPermission();
        }
    }
}

// BUILD REUSABLE SPREADSHEET 30-DAY HABITS TABLE HTML
function buildHabitsTableHTML(isExpanded = false) {
    const todayIndex = getCurrentTrackerDayIndex();
    const categories = [
        { key: "Morning Routine", title: "Morning Routine", icon: "🌅", badgeBg: "bg-amber-500/15 text-amber-700" },
        { key: "Afternoon Focus", title: "Afternoon Focus", icon: "☀️", badgeBg: "bg-blue-500/15 text-blue-700" },
        { key: "Evening Wind-down", title: "Evening Wind-down", icon: "🌙", badgeBg: "bg-indigo-500/15 text-indigo-700" }
    ];

    const activeFilter = currentCategoryFilter || "all";
    const activeCategories = activeFilter === "all" 
        ? categories 
        : categories.filter(c => c.key === activeFilter);

    let html = `
        <table class="table-fixed border-separate border-spacing-0 select-none text-left w-max">
            <colgroup>
                <col style="width: 140px;" class="w-[140px] sm:w-[220px]" />
    `;

    for (let day = 1; day <= 30; day++) {
        html += `<col style="width: 36px;" class="w-[36px] sm:w-[42px]" />`;
    }

    html += `
            </colgroup>
            <thead>
                <tr>
                    <!-- Top-Left Corner Header (Fixed on Top & Left) -->
                    <th class="sticky top-0 left-0 z-30 bg-[#cbd4e2] p-1.5 sm:p-2.5 text-[10px] sm:text-xs font-black font-outfit text-slate-800 border-r-2 border-b-2 border-slate-300 shadow-[3px_0_6px_-1px_rgba(0,0,0,0.12)] w-[140px] sm:w-[220px] h-10 select-none">
                        <div class="flex items-center justify-between">
                            <span>Habit</span>
                            <span class="text-[8px] sm:text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">30 Days</span>
                        </div>
                    </th>
    `;

    for (let day = 1; day <= 30; day++) {
        const isToday = ((day - 1) === todayIndex);
        const headerBg = isToday ? 'bg-blue-100 text-blue-900 border-b-2 border-blue-500 font-black shadow-xs ring-1 ring-inset ring-blue-400' : 'bg-[#d5deeb] text-slate-700 font-bold border-b-2 border-slate-300';
        html += `
            <th class="sticky top-0 z-20 ${headerBg} p-0 text-center text-[10px] sm:text-xs font-outfit border-r border-slate-300 w-[36px] min-w-[36px] max-w-[36px] sm:w-[42px] sm:min-w-[42px] sm:max-w-[42px] h-10 select-none" title="Day ${day}${isToday ? ' (Today)' : ''}">
                <div class="h-full flex flex-col items-center justify-center py-0.5 leading-none">
                    <span class="font-extrabold text-[10px] sm:text-xs leading-none">${day}</span>
                    ${isToday ? '<span class="text-[7px] sm:text-[8px] font-black uppercase text-blue-600 leading-none mt-0.5">Today</span>' : ''}
                </div>
            </th>
        `;
    }

    html += `
                </tr>
            </thead>
            <tbody>
    `;

    let totalHabitsRendered = 0;

    activeCategories.forEach(cat => {
        const catHabits = habits.filter(h => h && (h.timeOfDay || "Morning Routine") === cat.key);

        if (catHabits.length === 0 && activeFilter !== "all") {
            html += `
                <tr>
                    <td colspan="31" class="p-4 sm:p-6 text-center text-xs font-bold text-slate-500 bg-slate-100/50 border border-slate-300/60">
                        ${cat.icon} No habits defined under <strong>${cat.title}</strong> yet. Use "Define Your Target Habit" above to add one!
                    </td>
                </tr>
            `;
            return;
        }

        if (catHabits.length === 0) return; // Skip empty category in 'all' view

        // Bold Category Header Row (Sticky Left Title)
        html += `
            <tr class="bg-gradient-to-r from-slate-300/90 via-slate-200 to-slate-300/70 text-slate-800">
                <td colspan="31" class="sticky left-0 z-20 p-1.5 px-2.5 sm:p-2 sm:px-3.5 font-black font-outfit text-xs sm:text-sm tracking-wide border-t-2 border-b-2 border-r border-slate-300/90 bg-[#d1d9e6] shadow-xs">
                    <div class="flex items-center gap-2">
                        <span class="text-sm sm:text-base">${cat.icon}</span>
                        <span>${cat.title}</span>
                        <span class="neu-badge px-2 py-0.5 text-[9px] sm:text-[10px] font-black ${cat.badgeBg}">
                            ${catHabits.length} ${catHabits.length === 1 ? 'Habit' : 'Habits'}
                        </span>
                    </div>
                </td>
            </tr>
        `;

        catHabits.forEach(habit => {
            totalHabitsRendered++;
            if (!habit) return;
            if (!Array.isArray(habit.days)) habit.days = new Array(30).fill(false);

            const habitId = habit.id;
            const checkedCount = habit.days.filter(isDayDone).length;
            const streak = calculateHabitStreak(habit.days);

            html += `
                <tr class="hover:bg-slate-200/40 transition-colors h-11 sm:h-12">
                    <!-- Sticky Habit Cell (Fixed on Left) -->
                    <td class="sticky left-0 z-20 bg-[#e0e5ec] p-1.5 px-2 sm:p-2 sm:px-2.5 border-r-2 border-b border-slate-300/80 shadow-[3px_0_6px_-1px_rgba(0,0,0,0.08)] w-[140px] max-w-[140px] sm:w-[220px] sm:max-w-[220px] h-11 sm:h-12 align-middle">
                        <div class="flex items-center justify-between gap-1 w-full min-w-0">
                            <div class="flex flex-col min-w-0 pr-0.5 leading-none">
                                <div class="flex items-center gap-1 min-w-0">
                                    <span class="neu-badge px-1 py-0.2 text-[8px] sm:text-[9px] font-black text-indigo-700 bg-indigo-500/10 shrink-0 border border-indigo-300/70" title="Habit #${totalHabitsRendered}">#${totalHabitsRendered}</span>
                                    <span class="font-black text-[11px] sm:text-xs text-slate-800 font-outfit truncate max-w-[70px] sm:max-w-[135px]" title="${escapeHtml(habit.name)}">
                                        ${escapeHtml(habit.name)}
                                    </span>
                                </div>
                                <div class="flex items-center gap-1 mt-1 text-[8px] sm:text-[9px] text-slate-500 font-semibold flex-wrap">
                                    <span class="text-blue-600 font-bold">${checkedCount}/30</span>
                                    ${streak > 0 ? `<span class="text-amber-600 font-bold">🔥${streak}d</span>` : ''}
                                    ${habit.scheduledTime ? `<span class="text-indigo-600 font-medium">⏰${formatAMPM(habit.scheduledTime)}</span>` : ''}
                                </div>
                            </div>
                            <div class="flex items-center gap-0.5 shrink-0">
                                <button type="button" onclick="editHabitTime('${escapeHtml(habitId)}')" title="Set target time" class="p-1 text-slate-400 hover:text-indigo-600 text-[10px] sm:text-xs hover:scale-110 cursor-pointer">⏰</button>
                                <button type="button" onclick="deleteHabit('${escapeHtml(habitId)}')" title="Delete habit" class="p-1 text-slate-400 hover:text-red-600 text-[10px] sm:text-xs hover:scale-110 cursor-pointer">🗑️</button>
                            </div>
                        </div>
                    </td>
            `;

            // 30 Day Grid Cells (Square, Proportional, Centered)
            for (let day = 0; day < 30; day++) {
                const val = habit.days[day];
                const isToday = (day === todayIndex);
                let cellBgClass = isToday ? "bg-blue-50/50 hover:bg-blue-100/60" : "bg-[#e0e5ec] hover:bg-slate-200/90";
                if (isDayDone(val)) cellBgClass = isToday ? "bg-emerald-500/20 hover:bg-emerald-500/30" : "bg-emerald-500/10 hover:bg-emerald-500/20";
                if (isDayMissed(val)) cellBgClass = isToday ? "bg-rose-500/20 hover:bg-rose-500/30" : "bg-rose-500/10 hover:bg-rose-500/20";

                const markHTML = getHandwrittenMarkHTML(val, day);
                const titleText = `Day ${day + 1}${isToday ? ' (Today)' : ''}: ${isDayDone(val) ? 'Completed ✓' : isDayMissed(val) ? 'Missed ✕' : 'Blank (Tap to mark)'}`;

                html += `
                    <td onclick="toggleHabitDay('${escapeHtml(habitId)}', ${day})"
                        title="${titleText}"
                        class="border-r border-b border-slate-300/70 p-0 text-center align-middle cursor-pointer transition-colors duration-150 w-[36px] min-w-[36px] max-w-[36px] sm:w-[42px] sm:min-w-[42px] sm:max-w-[42px] h-11 sm:h-12 touch-manipulation active:scale-95 ${cellBgClass}">
                        <div class="w-full h-full flex items-center justify-center p-0.5">
                            ${markHTML}
                        </div>
                    </td>
                `;
            }

            html += `</tr>`;
        });
    });

    html += `
            </tbody>
        </table>
    `;

    return { html, totalHabitsRendered };
}

// RENDER TIME-OF-DAY CATEGORIZED SPREADSHEET TRACKER GRID (MOBILE COMPATIBLE)
function renderHabitsList() {
    const container = document.getElementById("habits-list-container");
    const blankSlate = document.getElementById("blank-slate");

    if (!container || !blankSlate) return;
    if (!Array.isArray(habits)) habits = [];

    if (habits.length === 0) {
        blankSlate.classList.remove("hidden");
        container.innerHTML = "";
        if (typeof updateStopwatchHabitDropdown === "function") updateStopwatchHabitDropdown();
        return;
    }

    blankSlate.classList.add("hidden");
    updateNotificationBtnState();
    if (typeof updateStopwatchHabitDropdown === "function") updateStopwatchHabitDropdown();

    const todayIndex = getCurrentTrackerDayIndex();
    const { html: tableBodyHTML, totalHabitsRendered } = buildHabitsTableHTML(false);

    let tableHTML = `
        <div class="neu-card p-2 sm:p-5 bg-[#e0e5ec] shadow-xl border border-white/70 overflow-hidden">
            <!-- Header Legend Bar with Mobile Scroll Hint, Jump to Today & Mobile Expand Symbol Button -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-300/70">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-base sm:text-lg">📊</span>
                    <div>
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <h4 class="text-xs sm:text-base font-black text-slate-800 font-outfit leading-tight">Spreadsheet Habit Tracker</h4>
                            <button type="button" onclick="scrollToTodayTracker()" class="neu-badge text-[9px] font-extrabold text-blue-600 px-2 py-0.5 leading-none hover:bg-blue-50 cursor-pointer flex items-center gap-0.5">
                                📍 You are on Day ${todayIndex + 1}
                            </button>
                            <!-- Expand symbol for mobile user only -->
                            <button type="button" onclick="openSpreadsheetExpandModal()" class="sm:hidden neu-badge text-[9px] font-extrabold text-indigo-600 px-2 py-0.5 leading-none hover:bg-indigo-50 active:scale-95 transition cursor-pointer flex items-center gap-1 border border-indigo-300/60" title="Expand to view all 30 days in one go without scrolling">
                                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                                </svg>
                                <span>Expand ⛶</span>
                            </button>
                        </div>
                        <p class="text-[10px] sm:text-[11px] text-slate-500 font-semibold leading-snug mt-0.5">Tap box to cycle: Blank &rarr; Done (✓) &rarr; Missed (✕)</p>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 sm:gap-2.5 text-[10px] sm:text-[11px] font-extrabold text-slate-600 bg-slate-200/60 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-slate-300/60 self-start sm:self-auto shrink-0 flex-wrap">
                    <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs border border-slate-400/50 bg-[#e0e5ec]"></span> Blank</span>
                    <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-emerald-500/20 border border-emerald-500/50 text-emerald-600 flex items-center justify-center text-[9px] font-black">✓</span> Done</span>
                    <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-rose-500/20 border border-rose-500/50 text-rose-500 flex items-center justify-center text-[9px] font-black">✕</span> Missed</span>
                </div>
            </div>

            <!-- Spreadsheet Grid Table Wrapper (Sticky Headers & Sticky Left Habit Column, Fixed Grid) -->
            <div id="habits-grid-scroll-wrapper" class="overflow-x-auto max-h-[60vh] sm:max-h-[580px] overflow-y-auto custom-scrollbar rounded-xl border-2 border-slate-300/80 bg-[#e0e5ec] shadow-inner relative touch-pan-x touch-pan-y overscroll-x-contain">
                ${tableBodyHTML}
            </div>
        </div>
    `;

    const activeFilter = currentCategoryFilter || "all";
    if (totalHabitsRendered === 0 && activeFilter === "all") {
        blankSlate.classList.remove("hidden");
        container.innerHTML = "";
    } else {
        container.innerHTML = tableHTML;
    }

    const expandModal = document.getElementById("spreadsheet-expand-modal");
    if (expandModal && !expandModal.classList.contains("hidden")) {
        updateExpandedSpreadsheetView();
    }
}

// EXPANDED SPREADSHEET HABIT TRACKER FULLSCREEN FIT LOGIC (MOBILE VIEW)
let isSpreadsheetFitMode = true;

function openSpreadsheetExpandModal() {
    const modal = document.getElementById("spreadsheet-expand-modal");
    if (!modal) return;

    pushModalState("spreadsheet-expand-modal", "#spreadsheet-expand");

    modal.classList.remove("hidden");
    requestAnimationFrame(() => {
        modal.classList.remove("opacity-0");
        modal.classList.add("opacity-100");
        updateExpandedSpreadsheetView();
    });
}

function closeSpreadsheetExpandModal(fromPopstate = false) {
    const modal = document.getElementById("spreadsheet-expand-modal");
    if (!modal) return;

    modal.classList.remove("opacity-100");
    modal.classList.add("opacity-0");
    setTimeout(() => {
        modal.classList.add("hidden");
    }, 300);

    if (!fromPopstate && window.location.hash === '#spreadsheet-expand') {
        window.history.replaceState({ praxisRoot: false, modalId: 'tracker-modal' }, '', '#tracker');
    }
}

function toggleSpreadsheetFitMode() {
    isSpreadsheetFitMode = !isSpreadsheetFitMode;
    updateExpandedSpreadsheetView();
}

function updateExpandedSpreadsheetView() {
    const modal = document.getElementById("spreadsheet-expand-modal");
    if (!modal || modal.classList.contains("hidden")) return;

    const scaler = document.getElementById("spreadsheet-expand-scaler");
    const container = document.getElementById("spreadsheet-expand-body");
    const todayBadge = document.getElementById("expand-modal-today-badge");
    const toggleIcon = document.getElementById("expand-fit-toggle-icon");
    const toggleText = document.getElementById("expand-fit-toggle-text");

    const todayIndex = getCurrentTrackerDayIndex();
    if (todayBadge) {
        todayBadge.textContent = `📍 Day ${todayIndex + 1}`;
    }

    if (!scaler || !container) return;

    const { html: tableBodyHTML } = buildHabitsTableHTML(true);
    scaler.innerHTML = tableBodyHTML;

    if (isSpreadsheetFitMode) {
        const availableWidth = Math.max(280, container.clientWidth - 8);
        const tableWidth = 1220;
        const scale = Math.min(1, availableWidth / tableWidth);

        scaler.style.transform = `scale(${scale})`;
        scaler.style.transformOrigin = "top left";
        scaler.style.width = `${tableWidth}px`;

        const tableHeight = scaler.scrollHeight || 250;
        scaler.style.marginBottom = `-${tableHeight * (1 - scale)}px`;
        scaler.style.marginRight = `-${tableWidth * (1 - scale)}px`;

        if (toggleIcon) toggleIcon.textContent = "🔍";
        if (toggleText) toggleText.textContent = "100% Zoom";
    } else {
        scaler.style.transform = "none";
        scaler.style.transformOrigin = "top left";
        scaler.style.width = "max-content";
        scaler.style.marginBottom = "0px";
        scaler.style.marginRight = "0px";

        if (toggleIcon) toggleIcon.textContent = "⛶";
        if (toggleText) toggleText.textContent = "Fit 30d";
    }
}

function scrollToTodayTracker() {
    const scrollContainer = document.getElementById("habits-grid-scroll-wrapper");
    if (!scrollContainer) return;
    const todayIndex = getCurrentTrackerDayIndex();
    const dayWidth = window.innerWidth < 640 ? 36 : 42;
    const leftOffset = window.innerWidth < 640 ? 140 : 220;
    const targetScroll = Math.max(0, (todayIndex * dayWidth) - (scrollContainer.clientWidth / 2) + leftOffset + (dayWidth / 2));
    scrollContainer.scrollTo({ left: targetScroll, behavior: 'smooth' });
}

function escapeHtml(str) {
    if (typeof str !== "string") return "";
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

function handleAddHabit(event) {
    if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
    }

    try {
        if (!Array.isArray(habits)) habits = [];
        const input = document.getElementById("habit-name-input");
        const timeSelect = document.getElementById("habit-time-select");
        const clockInput = document.getElementById("habit-clock-input");
        if (!input) return;

        const name = input.value.trim();
        if (!name) {
            input.focus();
            return;
        }

        const timeOfDay = timeSelect ? timeSelect.value : "Morning Routine";
        const scheduledTime = clockInput ? clockInput.value : "";

        if (scheduledTime && "Notification" in window && Notification.permission !== "granted") {
            try {
                requestNotificationPermission();
            } catch (e) {}
        }

        // Check if habit with same name already exists to prevent duplicate keying
        const existingIndex = habits.findIndex(h => h && h.name && h.name.toLowerCase() === name.toLowerCase() && (h.timeOfDay || "Morning Routine") === timeOfDay);
        if (existingIndex !== -1) {
            showInAppToast("⚠️ Habit Exists", `"${name}" is already in your ${timeOfDay} list.`, true);
            return;
        }

        const newHabit = {
            id: "habit_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
            name: name,
            timeOfDay: timeOfDay,
            scheduledTime: scheduledTime,
            remindedDates: {},
            missedNotifiedDates: {},
            days: new Array(30).fill(false),
            createdAt: Date.now()
        };

        habits.push(newHabit);
        saveHabitsToStorage();

        // Clear input values
        input.value = "";
        if (clockInput) clockInput.value = "";

        // If current filter excludes this category, auto-switch filter so user sees the new habit
        if (currentCategoryFilter !== "all" && currentCategoryFilter !== timeOfDay) {
            setCategoryFilter(timeOfDay);
        } else {
            renderHabitsList();
        }

        updateGrowthCharts();
        playNotificationSound('complete');
        showInAppToast("✨ Habit Added!", `"${name}" added to ${timeOfDay}. Complete days in your spreadsheet tracker below!`, false);

        try {
            trackEvent({ type: 'routine_interaction', clientId: getOrCreateClientId(), isCheckoff: false });
        } catch (e) {}

    } catch (err) {
        console.error("[PRAXiS UI] Error adding habit:", err);
        showInAppToast("❌ Error", "Could not add habit: " + (err.message || "Unknown error"), true);
    }
}

// 1-Click Quick Preset Habit Creator
function quickAddPresetHabit(name, timeOfDay = "Morning Routine", scheduledTime = "") {
    const input = document.getElementById("habit-name-input");
    const timeSelect = document.getElementById("habit-time-select");
    const clockInput = document.getElementById("habit-clock-input");
    if (input) input.value = name;
    if (timeSelect) timeSelect.value = timeOfDay;
    if (clockInput) clockInput.value = scheduledTime;
    handleAddHabit();
}

function toggleHabitDay(habitIndexOrId, dayIndex) {
    if (!Array.isArray(habits)) return;
    let habit = null;
    if (typeof habitIndexOrId === "number") {
        habit = habits[habitIndexOrId];
    } else {
        habit = habits.find(h => h && (h.id === habitIndexOrId || String(h.id) === String(habitIndexOrId)));
    }

    if (habit) {
        if (!Array.isArray(habit.days)) habit.days = new Array(30).fill(false);
        const currentVal = habit.days[dayIndex];
        let newVal;
        if (!currentVal || currentVal === false) {
            newVal = "done";
            playNotificationSound('complete');
        } else if (isDayDone(currentVal)) {
            newVal = "missed";
            playNotificationSound('missed');
        } else {
            newVal = false;
        }
        habit.days[dayIndex] = newVal;
        const isNowChecked = isDayDone(newVal);
        saveHabitsToStorage();
        renderHabitsList();
        updateGrowthCharts();
        trackEvent({ type: 'routine_interaction', clientId: getOrCreateClientId(), isCheckoff: isNowChecked });
    }
}

function deleteHabit(habitIndexOrId) {
    if (!Array.isArray(habits)) return;
    let index = -1;
    if (typeof habitIndexOrId === "number") {
        index = habitIndexOrId;
    } else {
        index = habits.findIndex(h => h && (h.id === habitIndexOrId || String(h.id) === String(habitIndexOrId)));
    }

    if (index !== -1 && habits[index]) {
        const habitName = habits[index].name;
        if (confirm(`Are you sure you want to delete "${habitName}"?`)) {
            habits.splice(index, 1);
            saveHabitsToStorage();
            renderHabitsList();
            updateGrowthCharts();
            showInAppToast("🗑️ Habit Removed", `"${habitName}" was deleted from your tracker.`, false);
        }
    }
}

function editHabitTime(habitIndexOrId) {
    if (!Array.isArray(habits)) return;
    let habit = null;
    if (typeof habitIndexOrId === "number") {
        habit = habits[habitIndexOrId];
    } else {
        habit = habits.find(h => h && (h.id === habitIndexOrId || String(h.id) === String(habitIndexOrId)));
    }
    if (!habit) return;

    const currentTime = habit.scheduledTime || "";
    const newTime = prompt(`Set/Update target time for "${habit.name}"\n(Enter 24-hour time e.g. 07:30 or 18:45, or leave blank to clear):`, currentTime);
    if (newTime !== null) {
        habit.scheduledTime = newTime.trim();
        habit.remindedDates = {};
        habit.missedNotifiedDates = {};
        habit.snoozedUntil = 0;
        saveHabitsToStorage();
        renderHabitsList();
        lastNotificationCheckTime = 0;
        checkHabitNotifications();
        if (habit.scheduledTime && "Notification" in window && Notification.permission !== "granted") {
            requestNotificationPermission();
        }
    }
}

// =====================================================================
// FANCY HIGH-PRECISION STOPWATCH & ROUTINE FOCUS TIMER MODULE
// =====================================================================

let swState = 'idle'; // 'idle' | 'running' | 'paused'
let swMode = 'stopwatch'; // 'stopwatch' | 'timer'
let swElapsedMs = 0;
let swStartTime = 0;
let swTimerDurationMs = 25 * 60 * 1000; // default 25 min pomodoro
let swLaps = [];
let swSoundEnabled = true;
let swIsExpanded = true;
let swLinkedHabitId = "";
let swAnimFrame = null;
let swLastTickIndex = -1;

try {
    const savedSound = localStorage.getItem("praxis_sw_sound");
    if (savedSound !== null) swSoundEnabled = savedSound === "true";
} catch (e) {}

function playStopwatchSound(type) {
    if (!swSoundEnabled) return;
    try {
        const ctx = getSharedAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'start') {
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(840, now + 0.09);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'pause') {
            osc.frequency.setValueAtTime(840, now);
            osc.frequency.exponentialRampToValueAtTime(520, now + 0.09);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'lap') {
            osc.frequency.setValueAtTime(1100, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'reset') {
            osc.frequency.setValueAtTime(360, now);
            osc.frequency.setValueAtTime(260, now + 0.05);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'tick') {
            osc.frequency.setValueAtTime(920, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
            osc.start(now);
            osc.stop(now + 0.02);
        } else if (type === 'timer_done') {
            const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
            notes.forEach((freq, idx) => {
                const noteOsc = ctx.createOscillator();
                const noteGain = ctx.createGain();
                noteOsc.connect(noteGain);
                noteGain.connect(ctx.destination);
                const noteTime = now + (idx * 0.11);
                noteOsc.frequency.setValueAtTime(freq, noteTime);
                noteGain.gain.setValueAtTime(0.22, noteTime);
                noteGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.38);
                noteOsc.start(noteTime);
                noteOsc.stop(noteTime + 0.4);
                setTimeout(() => {
                    try { noteOsc.disconnect(); noteGain.disconnect(); } catch (e) {}
                }, 600);
            });
            return;
        }

        setTimeout(() => {
            try { osc.disconnect(); gain.disconnect(); } catch (e) {}
        }, 300);
    } catch (e) {}
}

let jarvisAudioCache = {
    sir: null,
    maam: null
};

// -------------------------------------------------------------------
// DETECT USER GENDER / HONORIFIC (SIR / MA'AM) FROM GMAIL / LOGIN INFO
// -------------------------------------------------------------------
function detectUserHonorific() {
    try {
        let user = null;
        if (window.praxisAuth && typeof window.praxisAuth.getUser === "function") {
            user = window.praxisAuth.getUser();
        }
        if (!user) {
            const stored = localStorage.getItem("praxis_auth_user");
            if (stored) user = JSON.parse(stored);
        }
        
        let nameStr = "";
        let emailStr = "";

        if (user) {
            nameStr = (user.displayName || user.name || "").trim().toLowerCase();
            emailStr = (user.email || "").trim().toLowerCase();
        } else {
            nameStr = (localStorage.getItem("findyourpath_user_name") || "").trim().toLowerCase();
            emailStr = (localStorage.getItem("findyourpath_user_email") || "").trim().toLowerCase();
        }

        // If explicitly stored gender in profile
        if (user && user.gender) {
            const g = user.gender.toLowerCase();
            if (g === "female" || g === "f" || g === "woman") return "maam";
            if (g === "male" || g === "m" || g === "man") return "sir";
        }

        // Check titles in name
        if (nameStr) {
            if (nameStr.startsWith("mrs.") || nameStr.startsWith("mrs ") || nameStr.startsWith("ms.") || nameStr.startsWith("ms ") || nameStr.startsWith("miss ")) {
                return "maam";
            }
            if (nameStr.startsWith("mr.") || nameStr.startsWith("mr ")) {
                return "sir";
            }
        }

        // Extract first name token from display name or email
        let firstName = "";
        if (nameStr && nameStr !== "google user" && nameStr !== "user") {
            const parts = nameStr.split(/[\s._-]+/);
            firstName = parts[0] || "";
        }

        if (!firstName && emailStr) {
            const username = emailStr.split("@")[0] || "";
            const parts = username.split(/[0-9._-]+/).filter(Boolean);
            firstName = parts[0] || "";
        }

        if (!firstName) return "sir";

        firstName = firstName.toLowerCase().replace(/[^a-z]/g, "");

        // Comprehensive female names dictionary
        const femaleNames = new Set([
            "priya", "sneha", "ananya", "aarti", "arti", "pooja", "puja", "neha", "shreya", "tanvi",
            "riya", "divya", "kavya", "anita", "deepa", "sunita", "geeta", "gita", "radha", "meena",
            "leela", "isha", "sakshi", "simran", "sonam", "swati", "shruti", "komal", "rashi", "aditi",
            "kriti", "trisha", "mansi", "khushi", "muskan", "megha", "rashmi", "parul", "payal", "monika",
            "garima", "shikha", "jyoti", "sonia", "rekha", "seema", "jaya", "alka", "anjali", "bhavna",
            "chhavi", "damini", "ekta", "falguni", "gargi", "hema", "indira", "jayshree", "kiran", "latika",
            "madhuri", "nandini", "pallavi", "radhika", "sarita", "tanya", "urvashi", "vandana", "yashika",
            "zenab", "aisha", "fatima", "zoya", "sara", "zara", "mary", "emma", "olivia", "sophia",
            "emily", "jessica", "sarah", "rachel", "laura", "anna", "hannah", "chloe", "zoe", "claire",
            "elizabeth", "jennifer", "linda", "barbara", "susan", "karen", "nancy", "lisa", "betty",
            "margaret", "sandra", "ashley", "kimberly", "donna", "carol", "michelle", "amanda", "melissa",
            "deborah", "stephanie", "rebecca", "sharon", "cynthia", "kathleen", "amy", "shirley", "angela",
            "helen", "brenda", "pamela", "nicole", "samantha", "katherine", "christine", "debra", "carolyn",
            "janet", "catherine", "maria", "heather", "diane", "ruth", "julie", "joyce", "virginia",
            "victoria", "kelly", "lauren", "christina", "joan", "evelyn", "judith", "megan", "andrea",
            "cheryl", "jacqueline", "martha", "gloria", "teresa", "ann", "madison", "frances", "kathryn",
            "janice", "jean", "abigail", "alice", "julia", "judy", "grace", "denise", "amber", "doris",
            "marilyn", "danielle", "beverly", "isabella", "theresa", "diana", "natalie", "brittany",
            "charlotte", "marie", "kayla", "alexis", "lori", "anupama", "archana", "avantika", "bhumika",
            "chetna", "deepali", "diksha", "divyanshi", "gayatri", "harshita", "heena", "ishita", "kanchan",
            "karishma", "kashish", "krishnaa", "madhu", "mahima", "manisha", "namrata", "navya", "nidhi",
            "nikita", "nishita", "pragya", "prachi", "prerna", "punita", "rachna", "rani", "reet",
            "renuka", "richa", "rimjhim", "ritika", "roshni", "ruchika", "sadhna", "saloni", "samyukta",
            "sanika", "sanjana", "saumya", "shalini", "sheetal", "shivani", "shobha", "shubhi", "smriti",
            "snehal", "sonal", "soumya", "srishti", "srushti", "sudha", "surabhi", "surbhi", "swarna",
            "tejaswini", "tina", "tripti", "tulsi", "upasana", "vaishali", "vaishnavi", "vanshika",
            "vidhi", "vidya", "vini", "vrinda", "yasmin"
        ]);

        if (femaleNames.has(firstName)) return "maam";

        // Known male names ending with 'a' or 'i' to avoid false female phonetic match
        const maleExceptions = new Set([
            "shiva", "krishna", "aditya", "surya", "rishi", "rabi", "ravi", "baba", "rana",
            "mustafa", "murtaza", "hamza", "reza", "joshua", "luca", "noah", "ezra", "elija",
            "nikhil", "rahul", "amit", "rohit", "alex", "john", "david", "aryan", "rohan", "ali",
            "yash", "harsh", "raj", "vikram", "manish", "suresh", "ramesh", "ajay", "vijay", "sanjay",
            "anil", "sunil", "deepak", "rakesh", "mukesh", "dinesh", "mahesh", "naresh", "kamlesh",
            "abhishek", "gaurav", "saurabh", "varun", "tarun", "karan", "arjun", "kunal", "akash",
            "vikas", "vishal", "praveen", "naveen", "ashish", "anand", "alok", "vivek", "prashant"
        ]);

        if (maleExceptions.has(firstName)) return "sir";

        // Indian/international female name ending heuristic
        if (
            firstName.endsWith("a") || firstName.endsWith("i") || firstName.endsWith("ya") ||
            firstName.endsWith("ka") || firstName.endsWith("ti") || firstName.endsWith("ni") ||
            firstName.endsWith("na") || firstName.endsWith("ee") || firstName.endsWith("shree") ||
            firstName.endsWith("devi") || firstName.endsWith("kumari") || firstName.endsWith("kaur")
        ) {
            return "maam";
        }

        return "sir";
    } catch (e) {
        return "sir";
    }
}

function playJarvisTimesUpVoice() {
    if (!swSoundEnabled) return;
    try {
        const honorific = detectUserHonorific(); // "sir" or "maam"
        const audioSrc = honorific === "maam" ? "/jarvis-times-up-maam.mp3" : "/jarvis-times-up-sir.mp3";
        const spokenText = honorific === "maam" ? "Time is up, ma'am. Focus session completed." : "Time is up, sir. Focus session completed.";

        if (!jarvisAudioCache[honorific]) {
            jarvisAudioCache[honorific] = new Audio(audioSrc);
        }
        
        const audioObj = jarvisAudioCache[honorific];
        audioObj.currentTime = 0;
        audioObj.volume = 1.0;
        
        const playPromise = audioObj.play();
        if (playPromise !== undefined) {
            playPromise.catch((err) => {
                console.warn(`[Jarvis Voice] Audio playback blocked/failed for ${honorific}, falling back to SpeechSynthesis:`, err);
                speakJarvisFallback(spokenText);
            });
        }
    } catch (e) {
        const honorific = detectUserHonorific();
        const spokenText = honorific === "maam" ? "Time is up, ma'am. Focus session completed." : "Time is up, sir. Focus session completed.";
        speakJarvisFallback(spokenText);
    }
}

function speakJarvisFallback(text) {
    try {
        if (!("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        
        // Find best British English male voice to mimic Jarvis
        const jarvisVoice = voices.find(v => 
            (v.lang === "en-GB" || v.lang === "en_GB" || (v.lang && v.lang.startsWith("en-GB"))) &&
            (v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("george") || v.name.toLowerCase().includes("daniel") || v.name.toLowerCase().includes("oliver") || v.name.toLowerCase().includes("uk"))
        ) || voices.find(v => v.lang === "en-GB" || (v.lang && v.lang.startsWith("en-GB"))) || voices.find(v => v.lang && v.lang.startsWith("en"));

        if (jarvisVoice) utterance.voice = jarvisVoice;
        utterance.rate = 0.95;
        utterance.pitch = 0.88;
        utterance.volume = 1.0;

        window.speechSynthesis.speak(utterance);
    } catch (e) {}
}

function renderStopwatchTicks() {
    const tickContainer = document.getElementById("stopwatch-tick-marks");
    if (!tickContainer) return;
    tickContainer.innerHTML = "";

    const cx = 100, cy = 100;
    const rOuter = 88;
    for (let i = 0; i < 60; i++) {
        const isMajor = i % 5 === 0;
        const rInner = isMajor ? 80 : 83.5;
        const angleRad = (i * 6 - 90) * (Math.PI / 180);
        
        const x1 = (cx + rInner * Math.cos(angleRad)).toFixed(2);
        const y1 = (cy + rInner * Math.sin(angleRad)).toFixed(2);
        const x2 = (cx + rOuter * Math.cos(angleRad)).toFixed(2);
        const y2 = (cy + rOuter * Math.sin(angleRad)).toFixed(2);

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        line.setAttribute("id", `sw-tick-${i}`);
        line.setAttribute("class", `sw-tick ${isMajor ? 'sw-tick-major' : ''}`);
        line.setAttribute("stroke", isMajor ? "#64748b" : "#94a3b8");
        line.setAttribute("stroke-width", isMajor ? "2" : "1.2");
        line.setAttribute("stroke-linecap", "round");
        tickContainer.appendChild(line);
    }
}

function formatStopwatchTime(ms) {
    const safeMs = Math.max(0, Math.floor(ms));
    const hours = Math.floor(safeMs / 3600000);
    const mins = Math.floor((safeMs % 3600000) / 60000);
    const secs = Math.floor((safeMs % 60000) / 1000);
    const centi = Math.floor((safeMs % 1000) / 10);

    const hStr = hours.toString().padStart(2, "0");
    const mStr = mins.toString().padStart(2, "0");
    const sStr = secs.toString().padStart(2, "0");
    const cStr = centi.toString().padStart(2, "0");

    return {
        hours, mins, secs, centi,
        main: `${hStr}:${mStr}:${sStr}`,
        shortMain: `${mStr}:${sStr}`,
        ms: cStr,
        full: `${hStr}:${mStr}:${sStr}.${cStr}`
    };
}

function updateStopwatchDisplay(ms) {
    const displayMain = document.getElementById("sw-display-main");
    const displayMs = document.getElementById("sw-display-ms");
    if (!displayMain || !displayMs) return;

    const formatted = formatStopwatchTime(ms);
    displayMain.innerText = formatted.main;
    displayMs.innerText = formatted.ms;
}

function updateLiveFloatingBadge(ms) {
    const livePill = document.getElementById("tracker-stopwatch-live-pill");
    const liveText = document.getElementById("tracker-live-stopwatch-text");
    const headerPill = document.getElementById("stopwatch-btn-status-pill");
    const headerPillText = document.getElementById("stopwatch-btn-status-text");

    const formatted = formatStopwatchTime(ms);

    if (livePill && liveText) {
        if (swState === 'running') {
            liveText.innerText = formatted.shortMain;
            livePill.classList.remove("hidden");
        } else {
            livePill.classList.add("hidden");
        }
    }

    if (headerPill) {
        if (swState === 'running') {
            if (headerPillText) headerPillText.innerText = formatted.shortMain;
            headerPill.classList.remove("hidden");
        } else {
            headerPill.classList.add("hidden");
        }
    }
}

function setStopwatchMode(mode) {
    if (swState === 'running') {
        pauseStopwatch();
    }
    swMode = mode;
    swElapsedMs = 0;
    swLastTickIndex = -1;

    const btnStopwatch = document.getElementById("sw-mode-stopwatch");
    const btnTimer = document.getElementById("sw-mode-timer");
    const modeBadge = document.getElementById("stopwatch-mode-badge");
    const presetsRow = document.getElementById("sw-timer-presets-row");
    const progressCircle = document.getElementById("stopwatch-progress-circle");
    const subStatus = document.getElementById("stopwatch-sub-status");
    const lapBtn = document.getElementById("sw-btn-lap");
    const lapLabel = document.getElementById("sw-lap-label");

    if (mode === 'stopwatch') {
        btnStopwatch?.classList.add("bg-white/90", "text-blue-600", "shadow-sm");
        btnStopwatch?.classList.remove("text-slate-500");
        btnTimer?.classList.remove("bg-white/90", "text-blue-600", "shadow-sm");
        btnTimer?.classList.add("text-slate-500");

        if (modeBadge) {
            modeBadge.innerText = "STOPWATCH MODE";
            modeBadge.className = "neu-badge text-[9px] sm:text-[10px] font-extrabold text-blue-600 uppercase px-2 py-0.5";
        }
        if (presetsRow) presetsRow.classList.add("hidden");
        if (progressCircle) progressCircle.setAttribute("stroke", "url(#stopwatch-active-gradient)");
        if (subStatus) subStatus.innerHTML = "<span>Tap Start to begin precision stopwatch</span>";
        if (lapLabel) lapLabel.innerText = "Lap";
        if (lapBtn) lapBtn.title = "Record a lap split";

        updateStopwatchDisplay(0);
        updateProgressCircle(0, 0);
    } else {
        btnTimer?.classList.add("bg-white/90", "text-emerald-600", "shadow-sm");
        btnTimer?.classList.remove("text-slate-500");
        btnStopwatch?.classList.remove("bg-white/90", "text-blue-600", "shadow-sm");
        btnStopwatch?.classList.add("text-slate-500");

        if (modeBadge) {
            modeBadge.innerText = "FOCUS TIMER MODE";
            modeBadge.className = "neu-badge text-[9px] sm:text-[10px] font-extrabold text-emerald-600 uppercase px-2 py-0.5";
        }
        if (presetsRow) presetsRow.classList.remove("hidden");
        if (progressCircle) progressCircle.setAttribute("stroke", "url(#stopwatch-timer-gradient)");
        if (subStatus) subStatus.innerHTML = `<span>🎯 Target: ${Math.round(swTimerDurationMs / 60000)} mins focus session</span>`;
        if (lapLabel) lapLabel.innerText = "+5 Min";
        if (lapBtn) lapBtn.title = "Add 5 minutes to focus timer";

        updateStopwatchDisplay(swTimerDurationMs);
        updateProgressCircle(0, 1);
    }

    resetActiveTicks();
    updateStatusPill('READY');
}

function updateProgressCircle(progress, modeType = 0) {
    const circle = document.getElementById("stopwatch-progress-circle");
    const msCircle = document.getElementById("stopwatch-ms-circle");
    const dot = document.getElementById("stopwatch-orbit-dot");
    if (!circle || !dot) return;

    const circumference = 477.52;
    const offset = circumference * (1 - Math.max(0, Math.min(1, progress)));
    circle.style.strokeDashoffset = offset;

    const angle = (progress * 360 - 90) * (Math.PI / 180);
    const cx = (100 + 76 * Math.cos(angle)).toFixed(2);
    const cy = (100 + 76 * Math.sin(angle)).toFixed(2);
    dot.setAttribute("cx", cx);
    dot.setAttribute("cy", cy);

    if (msCircle) {
        const msCircumference = 427.25;
        const msOffset = msCircumference * (1 - ((Date.now() % 1000) / 1000));
        msCircle.style.strokeDashoffset = msOffset;
    }
}

function updateActiveTick(secondIndex, isTimer = false) {
    if (secondIndex === swLastTickIndex) return;
    if (swLastTickIndex >= 0) {
        const oldTick = document.getElementById(`sw-tick-${swLastTickIndex}`);
        if (oldTick) {
            oldTick.classList.remove("sw-tick-active", "sw-tick-active-timer");
        }
    }
    const newTick = document.getElementById(`sw-tick-${secondIndex}`);
    if (newTick) {
        newTick.classList.add(isTimer ? "sw-tick-active-timer" : "sw-tick-active");
    }
    swLastTickIndex = secondIndex;
}

function resetActiveTicks() {
    if (swLastTickIndex >= 0) {
        const oldTick = document.getElementById(`sw-tick-${swLastTickIndex}`);
        if (oldTick) oldTick.classList.remove("sw-tick-active", "sw-tick-active-timer");
        swLastTickIndex = -1;
    }
}

function updateStatusPill(statusText, variant = 'default') {
    const pill = document.getElementById("stopwatch-status-pill");
    if (!pill) return;
    pill.innerText = statusText;
    if (variant === 'running') {
        pill.className = "neu-badge text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 text-emerald-600 bg-emerald-50 mb-1 shadow-sm border border-emerald-200/50";
    } else if (variant === 'paused') {
        pill.className = "neu-badge text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 text-amber-600 bg-amber-50 mb-1 shadow-sm border border-amber-200/50";
    } else if (variant === 'complete') {
        pill.className = "neu-badge text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 text-indigo-600 bg-indigo-50 mb-1 shadow-sm border border-indigo-200/50 animate-bounce";
    } else {
        pill.className = "neu-badge text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 text-slate-500 mb-1 shadow-sm bg-white/70";
    }
}

function toggleStopwatch() {
    if (swState === 'running') {
        pauseStopwatch();
    } else {
        startStopwatch();
    }
}

function startStopwatch() {
    swStartTime = performance.now();
    swState = 'running';

    const toggleBtn = document.getElementById("sw-btn-toggle");
    const btnIcon = document.getElementById("sw-btn-icon");
    const btnLabel = document.getElementById("sw-btn-label");
    const lapBtn = document.getElementById("sw-btn-lap");
    const pulseDot = document.getElementById("stopwatch-pulse-dot");
    const progressCircle = document.getElementById("stopwatch-progress-circle");

    if (toggleBtn) {
        toggleBtn.className = "neu-btn px-6 py-3 sm:px-8 sm:py-3.5 font-black text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 min-w-[130px] sm:min-w-[150px] text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer";
    }
    if (btnIcon) btnIcon.innerText = "⏸";
    if (btnLabel) btnLabel.innerText = "PAUSE";

    if (lapBtn) {
        lapBtn.disabled = false;
        lapBtn.classList.remove("opacity-50", "cursor-not-allowed");
        lapBtn.classList.add("cursor-pointer");
    }

    if (pulseDot) pulseDot.classList.remove("hidden");
    if (progressCircle) {
        progressCircle.setAttribute("stroke", swMode === 'stopwatch' ? "url(#stopwatch-active-gradient)" : "url(#stopwatch-timer-gradient)");
    }

    updateStatusPill("RUNNING", "running");
    playStopwatchSound('start');

    if (swAnimFrame) cancelAnimationFrame(swAnimFrame);
    swAnimFrame = requestAnimationFrame(updateStopwatchLoop);
}

function pauseStopwatch() {
    if (swState !== 'running') return;
    const now = performance.now();
    swElapsedMs += (now - swStartTime);
    swState = 'paused';

    if (swAnimFrame) cancelAnimationFrame(swAnimFrame);
    swAnimFrame = null;

    const toggleBtn = document.getElementById("sw-btn-toggle");
    const btnIcon = document.getElementById("sw-btn-icon");
    const btnLabel = document.getElementById("sw-btn-label");
    const pulseDot = document.getElementById("stopwatch-pulse-dot");
    const progressCircle = document.getElementById("stopwatch-progress-circle");

    if (toggleBtn) {
        toggleBtn.className = "neu-btn px-6 py-3 sm:px-8 sm:py-3.5 font-black text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 min-w-[130px] sm:min-w-[150px] text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer";
    }
    if (btnIcon) btnIcon.innerText = "▶";
    if (btnLabel) btnLabel.innerText = "RESUME";

    if (pulseDot) pulseDot.classList.add("hidden");
    if (progressCircle) progressCircle.setAttribute("stroke", "url(#stopwatch-paused-gradient)");

    updateStatusPill("PAUSED", "paused");
    updateLiveFloatingBadge(swMode === 'stopwatch' ? swElapsedMs : Math.max(0, swTimerDurationMs - swElapsedMs));
    playStopwatchSound('pause');
}

function resetStopwatch() {
    if (swAnimFrame) cancelAnimationFrame(swAnimFrame);
    swAnimFrame = null;

    swState = 'idle';
    swElapsedMs = 0;
    resetActiveTicks();

    const toggleBtn = document.getElementById("sw-btn-toggle");
    const btnIcon = document.getElementById("sw-btn-icon");
    const btnLabel = document.getElementById("sw-btn-label");
    const lapBtn = document.getElementById("sw-btn-lap");
    const pulseDot = document.getElementById("stopwatch-pulse-dot");
    const progressCircle = document.getElementById("stopwatch-progress-circle");
    const subStatus = document.getElementById("stopwatch-sub-status");

    if (toggleBtn) {
        toggleBtn.className = "neu-btn px-6 py-3 sm:px-8 sm:py-3.5 font-black text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 min-w-[130px] sm:min-w-[150px] text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer";
    }
    if (btnIcon) btnIcon.innerText = "▶";
    if (btnLabel) btnLabel.innerText = "START";

    if (lapBtn && swMode === 'stopwatch') {
        lapBtn.disabled = true;
        lapBtn.classList.add("opacity-50", "cursor-not-allowed");
        lapBtn.classList.remove("cursor-pointer");
    }

    if (pulseDot) pulseDot.classList.add("hidden");
    if (progressCircle) {
        progressCircle.setAttribute("stroke", swMode === 'stopwatch' ? "url(#stopwatch-active-gradient)" : "url(#stopwatch-timer-gradient)");
    }

    if (swMode === 'stopwatch') {
        updateStopwatchDisplay(0);
        updateProgressCircle(0);
        if (subStatus) subStatus.innerHTML = "<span>Tap Start to begin precision stopwatch</span>";
    } else {
        updateStopwatchDisplay(swTimerDurationMs);
        updateProgressCircle(0, 1);
        if (subStatus) subStatus.innerHTML = `<span>🎯 Target: ${Math.round(swTimerDurationMs / 60000)} mins focus session</span>`;
    }

    updateStatusPill("READY");
    updateLiveFloatingBadge(0);
    playStopwatchSound('reset');
}

function updateStopwatchLoop() {
    if (swState !== 'running') return;

    const now = performance.now();
    const currentRun = now - swStartTime;
    const totalElapsed = swElapsedMs + currentRun;

    if (swMode === 'stopwatch') {
        updateStopwatchDisplay(totalElapsed);
        updateLiveFloatingBadge(totalElapsed);

        // Sweep 0 to 60s
        const secondInMinute = (totalElapsed % 60000) / 60000;
        updateProgressCircle(secondInMinute);

        const currentSec = Math.floor((totalElapsed % 60000) / 1000);
        updateActiveTick(currentSec, false);

        const subStatus = document.getElementById("stopwatch-sub-status");
        if (subStatus) {
            if (swLaps.length > 0) {
                const lastLapTotal = swLaps[swLaps.length - 1].totalTime;
                const curLapDuration = totalElapsed - lastLapTotal;
                subStatus.innerHTML = `<span>Lap ${swLaps.length + 1}: <strong class="text-blue-600 font-digital">+${formatStopwatchTime(curLapDuration).full}</strong></span>`;
            } else {
                subStatus.innerHTML = `<span>Elapsed: <strong class="text-slate-700 font-digital">${formatStopwatchTime(totalElapsed).full}</strong></span>`;
            }
        }
    } else {
        // Timer mode (countdown)
        const remainingMs = Math.max(0, swTimerDurationMs - totalElapsed);
        updateStopwatchDisplay(remainingMs);
        updateLiveFloatingBadge(remainingMs);

        const progress = Math.min(1, totalElapsed / swTimerDurationMs);
        updateProgressCircle(progress);

        const currentSec = Math.floor((remainingMs % 60000) / 1000);
        updateActiveTick(currentSec, true);

        const subStatus = document.getElementById("stopwatch-sub-status");
        if (subStatus) {
            subStatus.innerHTML = `<span>Focusing... <strong class="text-emerald-600 font-digital">${Math.ceil(remainingMs / 1000)}s left</strong></span>`;
        }

        if (remainingMs <= 0) {
            onFocusTimerCompleted();
            return;
        }
    }

    if (swState === 'running') {
        swAnimFrame = requestAnimationFrame(updateStopwatchLoop);
    }
}

function recordStopwatchLap() {
    if (swMode === 'timer') {
        // In timer mode, act as +5 min boost
        swTimerDurationMs += 5 * 60 * 1000;
        showInAppToast("⏳ Focus Extended", "+5 Minutes added to your focus timer goal!", false);
        playStopwatchSound('tick');
        const subStatus = document.getElementById("stopwatch-sub-status");
        if (subStatus) {
            subStatus.innerHTML = `<span>🎯 Target extended to ${Math.round(swTimerDurationMs / 60000)} mins</span>`;
        }
        return;
    }

    if (swState !== 'running') return;

    const now = performance.now();
    const totalElapsed = swElapsedMs + (now - swStartTime);
    const lastLapTotal = swLaps.length > 0 ? swLaps[swLaps.length - 1].totalTime : 0;
    const lapTime = totalElapsed - lastLapTotal;
    const lapNum = swLaps.length + 1;

    swLaps.push({ lapNum, lapTime, totalTime: totalElapsed });
    renderStopwatchLaps();
    playStopwatchSound('lap');
}

function renderStopwatchLaps() {
    const listContainer = document.getElementById("stopwatch-laps-list");
    const emptyState = document.getElementById("stopwatch-empty-laps");
    const countBadge = document.getElementById("stopwatch-lap-count-badge");
    const summaryFooter = document.getElementById("stopwatch-laps-summary");
    const fastLabel = document.getElementById("sw-fastest-lap-label");
    const slowLabel = document.getElementById("sw-slowest-lap-label");

    if (!listContainer) return;

    if (swLaps.length === 0) {
        listContainer.innerHTML = `
            <div id="stopwatch-empty-laps" class="flex flex-col items-center justify-center text-center h-full py-6 text-slate-400">
                <span class="text-2xl mb-1 opacity-70">⏱️</span>
                <p class="text-[11px] font-semibold">No laps recorded yet</p>
                <p class="text-[9px] text-slate-400 mt-0.5">Press "Lap" while running to capture splits</p>
            </div>
        `;
        if (countBadge) countBadge.innerText = "0 Laps";
        if (summaryFooter) summaryFooter.classList.add("hidden");
        return;
    }

    if (countBadge) countBadge.innerText = `${swLaps.length} Lap${swLaps.length > 1 ? 's' : ''}`;

    let minLap = Infinity, maxLap = -Infinity;
    if (swLaps.length > 1) {
        swLaps.forEach(l => {
            if (l.lapTime < minLap) minLap = l.lapTime;
            if (l.lapTime > maxLap) maxLap = l.lapTime;
        });
    }

    let rowsHTML = "";
    for (let i = swLaps.length - 1; i >= 0; i--) {
        const lap = swLaps[i];
        const isFastest = swLaps.length > 1 && lap.lapTime === minLap;
        const isSlowest = swLaps.length > 1 && lap.lapTime === maxLap;

        let badgeHTML = "";
        let rowBg = "bg-white/80 border-slate-200/80";

        if (isFastest) {
            badgeHTML = `<span class="neu-badge text-[8px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.2">⚡ FASTEST</span>`;
            rowBg = "bg-emerald-50/90 border-emerald-300";
        } else if (isSlowest) {
            badgeHTML = `<span class="neu-badge text-[8px] font-black text-rose-700 bg-rose-100 px-1.5 py-0.2">🐢 SLOWEST</span>`;
            rowBg = "bg-rose-50/90 border-rose-300";
        }

        const lapDurationFormatted = formatStopwatchTime(lap.lapTime).full;
        const totalFormatted = formatStopwatchTime(lap.totalTime).full;

        rowsHTML += `
            <div class="neu-card-sm p-2 sm:p-2.5 flex items-center justify-between gap-2 border ${rowBg} text-[11px] sm:text-xs">
                <div class="flex items-center gap-1.5">
                    <span class="font-black text-slate-700 font-digital text-[10px] sm:text-[11px] w-10 shrink-0">#${lap.lapNum.toString().padStart(2, '0')}</span>
                    ${badgeHTML}
                </div>
                <div class="flex items-center gap-3 sm:gap-4 font-digital">
                    <span class="font-bold text-slate-800 tracking-tight">+${lapDurationFormatted}</span>
                    <span class="text-[10px] text-slate-500 font-semibold">${totalFormatted}</span>
                </div>
            </div>
        `;
    }

    listContainer.innerHTML = rowsHTML;

    if (summaryFooter && swLaps.length > 1) {
        summaryFooter.classList.remove("hidden");
        if (fastLabel) fastLabel.innerHTML = `⚡ Fast: <strong>+${formatStopwatchTime(minLap).full}</strong>`;
        if (slowLabel) slowLabel.innerHTML = `🐢 Slow: <strong>+${formatStopwatchTime(maxLap).full}</strong>`;
    } else if (summaryFooter) {
        summaryFooter.classList.add("hidden");
    }
}

function clearStopwatchLaps() {
    swLaps = [];
    renderStopwatchLaps();
    playStopwatchSound('tick');
}

function copyStopwatchLaps() {
    if (swLaps.length === 0) {
        showInAppToast("📋 No Laps", "Record some laps before copying.", true);
        return;
    }

    let text = "PRAXiS Stopwatch Lap Records\n";
    text += "=============================\n";
    swLaps.forEach(l => {
        text += `Lap ${l.lapNum.toString().padStart(2, '0')}: +${formatStopwatchTime(l.lapTime).full} | Total: ${formatStopwatchTime(l.totalTime).full}\n`;
    });

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showInAppToast("📋 Laps Copied!", `${swLaps.length} lap split records copied to clipboard.`, false);
        }).catch(() => {
            fallbackCopyText(text);
        });
    } else {
        fallbackCopyText(text);
    }
}

function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showInAppToast("📋 Laps Copied!", `${swLaps.length} lap split records copied to clipboard.`, false);
    } catch (err) {}
    document.body.removeChild(textArea);
}

function setTimerDuration(minutes) {
    if (swState === 'running') {
        pauseStopwatch();
    }
    swTimerDurationMs = minutes * 60 * 1000;
    swElapsedMs = 0;

    if (swMode !== 'timer') {
        setStopwatchMode('timer');
    } else {
        updateStopwatchDisplay(swTimerDurationMs);
        updateProgressCircle(0, 1);
        const subStatus = document.getElementById("stopwatch-sub-status");
        if (subStatus) subStatus.innerHTML = `<span>🎯 Target: ${minutes} mins focus session</span>`;
        updateStatusPill("READY");
    }
    playStopwatchSound('tick');
}

function onFocusTimerCompleted() {
    swState = 'idle';
    swElapsedMs = swTimerDurationMs;
    if (swAnimFrame) cancelAnimationFrame(swAnimFrame);
    swAnimFrame = null;

    updateStopwatchDisplay(0);
    updateProgressCircle(1);
    updateActiveTick(0, true);
    updateStatusPill("🎉 COMPLETED!", "complete");

    const toggleBtn = document.getElementById("sw-btn-toggle");
    const btnIcon = document.getElementById("sw-btn-icon");
    const btnLabel = document.getElementById("sw-btn-label");
    const pulseDot = document.getElementById("stopwatch-pulse-dot");

    if (toggleBtn) {
        toggleBtn.className = "neu-btn px-6 py-3 sm:px-8 sm:py-3.5 font-black text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 min-w-[130px] sm:min-w-[150px] text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer";
    }
    if (btnIcon) btnIcon.innerText = "▶";
    if (btnLabel) btnLabel.innerText = "START";
    if (pulseDot) pulseDot.classList.add("hidden");

    updateLiveFloatingBadge(0);
    playStopwatchSound('timer_done');
    playJarvisTimesUpVoice();

    const focusMins = Math.round(swTimerDurationMs / 60000);
    showInAppToast("🎉 Focus Goal Completed!", `Outstanding discipline! You conquered your ${focusMins}-minute focus session!`, false);

    // Auto-prompt habit completion if linked
    if (swLinkedHabitId) {
        const habit = Array.isArray(habits) ? habits.find(h => h && (h.id === swLinkedHabitId || String(h.id) === String(swLinkedHabitId))) : null;
        if (habit) {
            setTimeout(() => {
                const confirmed = confirm(`🎉 You finished your ${focusMins}m focus sprint!\n\nWould you like to mark "${habit.name}" as COMPLETED for today?`);
                if (confirmed) {
                    markHabitCompletedDirectly(swLinkedHabitId);
                }
            }, 500);
        }
    }
}

function updateStopwatchHabitDropdown() {
    const select = document.getElementById("stopwatch-habit-select");
    const checkoffBtn = document.getElementById("sw-btn-checkoff-habit");
    const linkStatus = document.getElementById("sw-link-status");
    if (!select) return;

    const currentVal = select.value || swLinkedHabitId;
    select.innerHTML = `<option value="">-- Select Habit to Track --</option>`;

    if (!Array.isArray(habits) || habits.length === 0) {
        if (linkStatus) linkStatus.innerText = "No Habits Created";
        if (checkoffBtn) {
            checkoffBtn.disabled = true;
            checkoffBtn.classList.add("opacity-50", "cursor-not-allowed");
        }
        return;
    }

    habits.forEach(h => {
        if (!h || !h.name) return;
        const opt = document.createElement("option");
        opt.value = h.id;
        const catIcon = (h.timeOfDay || "").includes("Morning") ? "🌅" : (h.timeOfDay || "").includes("Evening") ? "🌙" : "☀️";
        opt.innerText = `${catIcon} ${h.name} (${h.timeOfDay || "Morning Routine"})`;
        if (String(h.id) === String(currentVal)) {
            opt.selected = true;
            swLinkedHabitId = h.id;
        }
        select.appendChild(opt);
    });

    handleStopwatchHabitLinkChange();
}

function handleStopwatchHabitLinkChange() {
    const select = document.getElementById("stopwatch-habit-select");
    const checkoffBtn = document.getElementById("sw-btn-checkoff-habit");
    const linkStatus = document.getElementById("sw-link-status");
    if (!select) return;

    swLinkedHabitId = select.value;
    if (swLinkedHabitId && Array.isArray(habits)) {
        const habit = habits.find(h => h && (h.id === swLinkedHabitId || String(h.id) === String(swLinkedHabitId)));
        if (habit) {
            if (linkStatus) {
                linkStatus.innerText = `Linked: ${habit.name.slice(0, 18)}`;
                linkStatus.className = "text-[9px] font-bold text-emerald-600 uppercase tracking-wider";
            }
            if (checkoffBtn) {
                checkoffBtn.disabled = false;
                checkoffBtn.classList.remove("opacity-50", "cursor-not-allowed");
                checkoffBtn.classList.add("cursor-pointer");
            }
            return;
        }
    }

    if (linkStatus) {
        linkStatus.innerText = "Not Linked";
        linkStatus.className = "text-[9px] font-bold text-slate-400 uppercase tracking-wider";
    }
    if (checkoffBtn) {
        checkoffBtn.disabled = true;
        checkoffBtn.classList.add("opacity-50", "cursor-not-allowed");
        checkoffBtn.classList.remove("cursor-pointer");
    }
}

function logStopwatchFocusToHabit() {
    if (!swLinkedHabitId) {
        showInAppToast("🔗 Link a Habit", "Select a habit from the dropdown to log your focus session.", true);
        return;
    }
    markHabitCompletedDirectly(swLinkedHabitId);
}

function toggleStopwatchSound() {
    swSoundEnabled = !swSoundEnabled;
    try {
        localStorage.setItem("praxis_sw_sound", String(swSoundEnabled));
    } catch (e) {}

    const icon = document.getElementById("stopwatch-sound-icon");
    if (icon) icon.innerText = swSoundEnabled ? "🔊" : "🔇";

    if (swSoundEnabled) {
        playStopwatchSound('start');
        showInAppToast("🔊 Sound Enabled", "Stopwatch & Timer audio feedback active.", false);
    } else {
        showInAppToast("🔇 Sound Muted", "Stopwatch sound effects muted.", false);
    }
}

function toggleStopwatchExpand() {
    swIsExpanded = !swIsExpanded;
    const drawer = document.getElementById("stopwatch-side-drawer");
    const mainGrid = document.getElementById("stopwatch-main-grid");
    const icon = document.getElementById("stopwatch-expand-icon");

    if (drawer && mainGrid) {
        if (swIsExpanded) {
            drawer.classList.remove("hidden");
            mainGrid.className = "grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 mt-4 sm:mt-5 items-center relative z-10";
            if (icon) icon.innerText = "⤢";
        } else {
            drawer.classList.add("hidden");
            mainGrid.className = "grid grid-cols-1 gap-5 sm:gap-6 mt-4 sm:mt-5 items-center justify-center relative z-10 max-w-xl mx-auto";
            if (icon) icon.innerText = "⤡";
        }
    }
}

function toggleStopwatchVisibility(forceState = null) {
    const container = document.getElementById("routine-stopwatch-container");
    const btn = document.getElementById("toggle-stopwatch-view-btn");
    const btnText = document.getElementById("stopwatch-btn-text");
    if (!container) return;

    const shouldShow = forceState !== null ? forceState : container.classList.contains("hidden");
    
    if (shouldShow) {
        container.classList.remove("hidden");
        if (btn) {
            btn.classList.add("bg-blue-600", "text-white", "shadow-md");
            btn.classList.remove("text-slate-700");
        }
        if (btnText) btnText.innerText = "Hide Stopwatch";
        // Smoothly scroll to the stopwatch at top of modal
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        container.classList.add("hidden");
        if (btn) {
            btn.classList.remove("bg-blue-600", "text-white", "shadow-md");
            btn.classList.add("text-slate-700");
        }
        if (btnText) btnText.innerText = "Focus Stopwatch";
    }
}

function initRoutineStopwatch() {
    renderStopwatchTicks();
    updateStopwatchHabitDropdown();

    const soundIcon = document.getElementById("stopwatch-sound-icon");
    if (soundIcon) soundIcon.innerText = swSoundEnabled ? "🔊" : "🔇";

    updateStopwatchDisplay(0);
    updateProgressCircle(0);
}

// Global window bindings for inline HTML access
window.handleAddHabit = handleAddHabit;
window.quickAddPresetHabit = quickAddPresetHabit;
window.toggleHabitDay = toggleHabitDay;
window.deleteHabit = deleteHabit;
window.editHabitTime = editHabitTime;
window.setCategoryFilter = setCategoryFilter;
window.renderHabitsList = renderHabitsList;
window.updateGrowthCharts = updateGrowthCharts;
window.renderHeatmap = renderHeatmap;
window.markHabitCompletedDirectly = markHabitCompletedDirectly;
window.markHabitMissedDirectly = markHabitMissedDirectly;
window.snoozeHabitReminder = snoozeHabitReminder;
window.scrollToTodayTracker = scrollToTodayTracker;
window.openSpreadsheetExpandModal = openSpreadsheetExpandModal;
window.closeSpreadsheetExpandModal = closeSpreadsheetExpandModal;
window.toggleSpreadsheetFitMode = toggleSpreadsheetFitMode;
window.updateExpandedSpreadsheetView = updateExpandedSpreadsheetView;

// Stopwatch & Timer bindings
window.toggleStopwatch = toggleStopwatch;
window.startStopwatch = startStopwatch;
window.pauseStopwatch = pauseStopwatch;
window.resetStopwatch = resetStopwatch;
window.recordStopwatchLap = recordStopwatchLap;
window.clearStopwatchLaps = clearStopwatchLaps;
window.copyStopwatchLaps = copyStopwatchLaps;
window.setStopwatchMode = setStopwatchMode;
window.setTimerDuration = setTimerDuration;
window.toggleStopwatchSound = toggleStopwatchSound;
window.toggleStopwatchExpand = toggleStopwatchExpand;
window.toggleStopwatchVisibility = toggleStopwatchVisibility;
window.handleStopwatchHabitLinkChange = handleStopwatchHabitLinkChange;
window.logStopwatchFocusToHabit = logStopwatchFocusToHabit;
window.playJarvisTimesUpVoice = playJarvisTimesUpVoice;
window.detectUserHonorific = detectUserHonorific;
window.initRoutineStopwatch = initRoutineStopwatch;
window.updateStopwatchHabitDropdown = updateStopwatchHabitDropdown;

// =====================================================================
// BROWSER HISTORY & BACK BUTTON NAVIGATION MANAGER
// Enables seamless browser back-arrow navigation without exiting the site
// =====================================================================

function pushModalState(modalId, hash) {
    if (window.location.hash !== hash) {
        window.history.pushState({ praxisRoot: false, modalId: modalId }, '', hash);
    }
}

function handlePopState(event) {
    const expandModal = document.getElementById("spreadsheet-expand-modal");
    const trackerModal = document.getElementById("tracker-modal");
    const libraryModal = document.getElementById("library-modal");
    const bookDetailModal = document.getElementById("book-detail-modal");
    const readerModal = document.getElementById("ebook-reader-modal");
    const authModal = document.getElementById("auth-modal");

    // 1. Close top-most active modal first when back arrow is pressed
    if (expandModal && !expandModal.classList.contains("hidden")) {
        closeSpreadsheetExpandModal(true);
        return;
    }
    if (readerModal && !readerModal.classList.contains("hidden")) {
        closeEBookReader(true);
        return;
    }
    if (bookDetailModal && !bookDetailModal.classList.contains("hidden")) {
        closeBookDetailModal(true);
        return;
    }
    if (libraryModal && !libraryModal.classList.contains("hidden")) {
        closeLibraryModal(true);
        return;
    }
    if (trackerModal && !trackerModal.classList.contains("hidden")) {
        closeTrackerModal(true);
        return;
    }
    if (authModal && !authModal.classList.contains("hidden")) {
        if (typeof window.closeAuthModal === "function") {
            window.closeAuthModal(true);
        } else {
            authModal.classList.add("hidden");
        }
        return;
    }

    // 2. Check if sub-views (like career details view) are active
    const matchesOverview = document.getElementById("matches-overview");
    const careerDetails = document.getElementById("career-details");
    if (careerDetails && !careerDetails.classList.contains("hidden") && matchesOverview) {
        careerDetails.classList.add("hidden");
        matchesOverview.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }
}

window.addEventListener("popstate", handlePopState);

function openTrackerModal() {
    const modal = document.getElementById("tracker-modal");
    if (!modal) return;

    pushModalState("tracker-modal", "#tracker");

    modal.classList.remove("hidden");
    requestAnimationFrame(() => {
        modal.classList.remove("opacity-0");
        modal.classList.add("opacity-100");
    });
    
    renderHabitsList();
    updateGrowthCharts();
    if (typeof updateStopwatchHabitDropdown === "function") updateStopwatchHabitDropdown();
    setTimeout(() => {
        if (typeof scrollToTodayTracker === "function") scrollToTodayTracker();
    }, 180);
}

function closeTrackerModal(fromPopstate = false) {
    const modal = document.getElementById("tracker-modal");
    if (!modal) return;

    modal.classList.remove("opacity-100");
    modal.classList.add("opacity-0");
    setTimeout(() => {
        modal.classList.add("hidden");
    }, 300);

    if (!fromPopstate && window.location.hash === '#tracker') {
        window.history.replaceState({ praxisRoot: true, view: 'home' }, '', '/praxis');
    }
}

// Close modal on Escape key press
window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeSpreadsheetExpandModal();
        closeTrackerModal();
        closeLibraryModal();
        closeBookDetailModal();
        closeEBookReader();
        if (typeof window.closeAuthModal === "function") window.closeAuthModal();
    }
});

// INITIALIZE TRACKER ON LOAD & ATTACH FORM LISTENERS
document.addEventListener("DOMContentLoaded", () => {
    loadHabitsFromStorage();
    if (typeof initRoutineStopwatch === "function") initRoutineStopwatch();

    // Attach Habit Form submission listener
    const addHabitForm = document.getElementById("add-habit-form");
    if (addHabitForm) {
        addHabitForm.addEventListener("submit", handleAddHabit);
    }

    // Modal backdrop click dismissers
    document.getElementById("spreadsheet-expand-modal")?.addEventListener("click", (e) => {
        if (e.target.id === "spreadsheet-expand-modal") closeSpreadsheetExpandModal();
    });
    document.getElementById("tracker-modal")?.addEventListener("click", (e) => {
        if (e.target.id === "tracker-modal") closeTrackerModal();
    });
    document.getElementById("library-modal")?.addEventListener("click", (e) => {
        if (e.target.id === "library-modal") closeLibraryModal();
    });

    // Window resize & orientation change listeners for smooth fit scaling
    window.addEventListener("resize", () => {
        const expandModal = document.getElementById("spreadsheet-expand-modal");
        if (expandModal && !expandModal.classList.contains("hidden")) {
            updateExpandedSpreadsheetView();
        }
    });
    window.addEventListener("orientationchange", () => {
        const expandModal = document.getElementById("spreadsheet-expand-modal");
        if (expandModal && !expandModal.classList.contains("hidden")) {
            setTimeout(updateExpandedSpreadsheetView, 100);
        }
    });

    // Check for notification action in URL parameters
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const habitId = urlParams.get('habitId');
        if (action && habitId) {
            if (action === 'complete') markHabitCompletedDirectly(habitId);
            else if (action === 'missed') markHabitMissedDirectly(habitId);
            else if (action === 'snooze') snoozeHabitReminder(habitId, 10);
        }
    } catch (e) {}

    if (!window.history.state || !window.history.state.praxisRoot) {
        const targetPath = (window.location.pathname === '/' || window.location.pathname.endsWith('/index.html')) ? '/praxis' : window.location.pathname;
        window.history.replaceState({ praxisRoot: true, view: 'home' }, '', targetPath + window.location.hash);
    }
});
loadHabitsFromStorage();

// =====================================================================
// 12. MODERN LIBRARY CATALOG (120 BOOKS DATASET & INTERACTIVITY)
// =====================================================================
let currentLibraryGenre = "all";
let librarySearchQuery = "";

const libraryBooks = [
    // --- FANTASY (20 BOOKS) ---
    // Game of Thrones Series (A Song of Ice and Fire)
    { id: "fy1", title: "A Game of Thrones", author: "George R.R. Martin", genre: "Fantasy", year: 1996, rating: 4.9, isbn: "9780553103540", desc: "Noble families wrestle for control of the Iron Throne of Westeros while an ancient evil awakens in the icy north." },
    { id: "fy2", title: "A Clash of Kings", author: "George R.R. Martin", genre: "Fantasy", year: 1998, rating: 4.8, isbn: "9780553108033", desc: "Five rival kings contend for power across a war-torn continent while Daenerys Targaryen nurtures her newborn dragons." },
    { id: "fy3", title: "A Storm of Swords", author: "George R.R. Martin", genre: "Fantasy", year: 2000, rating: 4.9, isbn: "9780553106633", desc: "The War of the Five Kings reaches its shocking climax of betrayal, tragic red weddings, and desperate defense at the Wall." },
    { id: "fy4", title: "A Feast for Crows", author: "George R.R. Martin", genre: "Fantasy", year: 2005, rating: 4.7, isbn: "9780553801507", desc: "In the aftermath of bloody war, survivors in King's Landing, Dorne, and the Iron Islands struggle to salvage power." },
    { id: "fy5", title: "A Dance with Dragons", author: "George R.R. Martin", genre: "Fantasy", year: 2011, rating: 4.8, isbn: "9780553801477", desc: "Jon Snow leads the Night's Watch as Lord Commander while Daenerys struggles to govern Meereen amidst rising insurrection." },

    // Harry Potter Series
    { id: "fy6", title: "Harry Potter and the Sorcerer's Stone", author: "J.K. Rowling", genre: "Fantasy", year: 1997, rating: 4.9, isbn: "9780590353427", desc: "An orphaned boy discovers on his eleventh birthday that he is a wizard and attends Hogwarts School of Witchcraft and Wizardry." },
    { id: "fy7", title: "Harry Potter and the Chamber of Secrets", author: "J.K. Rowling", genre: "Fantasy", year: 1998, rating: 4.8, isbn: "9780439064873", desc: "Harry returns to Hogwarts for his second year as a mysterious monster petrifies students and the Chamber of Secrets opens." },
    { id: "fy8", title: "Harry Potter and the Prisoner of Azkaban", author: "J.K. Rowling", genre: "Fantasy", year: 1999, rating: 4.9, isbn: "9780439136358", desc: "Escaped convict Sirius Black breaks out of Azkaban fortress, seemingly targeting Harry during his third year at Hogwarts." },
    { id: "fy9", title: "Harry Potter and the Goblet of Fire", author: "J.K. Rowling", genre: "Fantasy", year: 2000, rating: 4.9, isbn: "9780439139595", desc: "Harry is mysteriously chosen as a competitor in the perilous Triwizard Tournament amidst rising dark forces." },
    { id: "fy10", title: "Harry Potter and the Order of the Phoenix", author: "J.K. Rowling", genre: "Fantasy", year: 2003, rating: 4.8, isbn: "9780439358064", desc: "Harry forms Dumbledore's Army to train fellow students while battling Ministry denial of Voldemort's return." },
    { id: "fy11", title: "Harry Potter and the Half-Blood Prince", author: "J.K. Rowling", genre: "Fantasy", year: 2005, rating: 4.9, isbn: "9780439784542", desc: "Dumbledore explores Voldemort's dark past and Horcruxes to prepare Harry for the inevitable final confrontation." },
    { id: "fy12", title: "Harry Potter and the Deathly Hallows", author: "J.K. Rowling", genre: "Fantasy", year: 2007, rating: 4.9, isbn: "9780545010221", desc: "Harry, Ron, and Hermione embark on a dangerous quest to hunt and destroy Voldemort's remaining Horcruxes." },

    // Legendary Fantasy Classics
    { id: "fy13", title: "The Hobbit", author: "J.R.R. Tolkien", genre: "Fantasy", year: 1937, rating: 4.9, isbn: "9780547928227", desc: "Bilbo Baggins is swept into an epic quest with thirteen dwarves and Gandalf to reclaim Erebor from Smaug the dragon." },
    { id: "fy14", title: "The Fellowship of the Ring", author: "J.R.R. Tolkien", genre: "Fantasy", year: 1954, rating: 4.9, isbn: "9780547928210", desc: "Frodo Baggins inherits the One Ring and forms a diverse fellowship to journey toward Mount Doom and defeat Sauron." },
    { id: "fy15", title: "The Two Towers", author: "J.R.R. Tolkien", genre: "Fantasy", year: 1954, rating: 4.9, isbn: "9780547928203", desc: "The Fellowship is fractured as Aragorn fights for Rohan and Frodo and Sam travel toward Mordor guided by Gollum." },
    { id: "fy16", title: "The Return of the King", author: "J.R.R. Tolkien", genre: "Fantasy", year: 1955, rating: 4.9, isbn: "9780547928197", desc: "The final battle for Middle-earth rages at Minas Tirith while Frodo and Sam approach Mount Doom to destroy the Ring." },
    { id: "fy17", title: "The Name of the Wind", author: "Patrick Rothfuss", genre: "Fantasy", year: 2007, rating: 4.8, isbn: "9780756404741", desc: "Kvothe recounts his legendary life from a troupe performer to notorious arcanist, musician, and infamous kingkiller." },
    { id: "fy18", title: "The Way of Kings", author: "Brandon Sanderson", genre: "Fantasy", year: 2010, rating: 4.9, isbn: "9780765326355", desc: "On the storm-swept world of Roshar, a slave bridging death, a shattered prince, and a young scholar hold humanity's fate." },
    { id: "fy19", title: "Mistborn: The Final Empire", author: "Brandon Sanderson", genre: "Fantasy", year: 2006, rating: 4.8, isbn: "9780765311788", desc: "Street urchin Vin learns she is a powerful Mistborn and joins a crew attempting to overthrow the immortal Lord Ruler." },
    { id: "fy20", title: "The Eye of the World", author: "Robert Jordan", genre: "Fantasy", year: 1990, rating: 4.8, isbn: "9780812511810", desc: "Rand al'Thor and his friends flee their village with Aes Sedai Moiraine as the Dark One's shadow falls across the realm." },

    // --- SCI-FI (20 BOOKS) ---
    { id: "sf1", title: "Dune", author: "Frank Herbert", genre: "Sci-Fi", year: 1965, rating: 4.9, isbn: "9780441172719", desc: "Set on the desert planet Arrakis, Paul Atreides navigates political intrigue, galactic betrayal, and spice melange to fulfill a heroic destiny." },
    { id: "sf2", title: "Project Hail Mary", author: "Andy Weir", genre: "Sci-Fi", year: 2021, rating: 4.9, isbn: "9780593135204", desc: "A lone astronaut wakes up with amnesia on a desperate space mission to save Earth from an extinction-level solar energy crisis." },
    { id: "sf3", title: "Neuromancer", author: "William Gibson", genre: "Sci-Fi", year: 1984, rating: 4.7, isbn: "9780441569595", desc: "The foundational cyberpunk novel following Case, a washed-up hacker hired for a high-stakes heist inside cyberspace matrix." },
    { id: "sf4", title: "The Martian", author: "Andy Weir", genre: "Sci-Fi", year: 2011, rating: 4.8, isbn: "9780553418026", desc: "Astronaut Mark Watney must use botanical ingenuity and sharp wits to survive stranded alone on Mars after a dust storm." },
    { id: "sf5", title: "Ender's Game", author: "Orson Scott Card", genre: "Sci-Fi", year: 1985, rating: 4.8, isbn: "9780812550702", desc: "Young tactical genius Ender Wiggin is trained in zero-gravity battle school to command Earth's forces against alien invaders." },
    { id: "sf6", title: "Snow Crash", author: "Neal Stephenson", genre: "Sci-Fi", year: 1992, rating: 4.7, isbn: "9780553380958", desc: "Pizza delivery hacker Hiro Protagonist discovers a dangerous computer virus spreading through the virtual Metaverse and human minds." },
    { id: "sf7", title: "Foundation", author: "Isaac Asimov", genre: "Sci-Fi", year: 1951, rating: 4.8, isbn: "9780553293357", desc: "Psychohistorian Hari Seldon predicts the fall of the Galactic Empire and creates a sanctuary to preserve humanity's knowledge." },
    { id: "sf8", title: "Hyperion", author: "Dan Simmons", genre: "Sci-Fi", year: 1989, rating: 4.8, isbn: "9780553283686", desc: "Seven pilgrims journey to the mysterious Time Tombs on Hyperion to meet the terrifying Shrike and share their haunting tales." },
    { id: "sf9", title: "Leviathan Wakes", author: "James S.A. Corey", genre: "Sci-Fi", year: 2011, rating: 4.8, isbn: "9780316129084", desc: "An ice-miner officer and a detective uncover a system-wide conspiracy across Mars, Earth, and the Asteroid Belt." },
    { id: "sf10", title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", genre: "Sci-Fi", year: 1969, rating: 4.7, isbn: "9780441478125", desc: "Human envoy Genly Ai attempts to bring the ambisexual alien world of Gethen into an interstellar galactic alliance." },
    { id: "sf11", title: "Altered Carbon", author: "Richard K. Morgan", genre: "Sci-Fi", year: 2002, rating: 4.7, isbn: "9780345457684", desc: "Takeshi Kovacs is resleeved in a new body to investigate the murder of a wealthy mogul in a gritty transhuman future." },
    { id: "sf12", title: "Dark Matter", author: "Blake Crouch", genre: "Sci-Fi", year: 2016, rating: 4.8, isbn: "9781101904220", desc: "Jason Dessen is kidnapped into an alternate reality where his life took a drastically different path across the multiverse." },
    { id: "sf13", title: "The Three-Body Problem", author: "Cixin Liu", genre: "Sci-Fi", year: 2008, rating: 4.8, isbn: "9780765377067", desc: "Secret military projects make first contact with an alien civilization on the brink of destruction seeking a new home." },
    { id: "sf14", title: "Children of Time", author: "Adrian Tchaikovsky", genre: "Sci-Fi", year: 2015, rating: 4.8, isbn: "9780316452502", desc: "The last survivors of Earth collide with a terraformed world dominated by an evolved species of spider architecture." },
    { id: "sf15", title: "Do Androids Dream of Electric Sheep?", author: "Philip K. Dick", genre: "Sci-Fi", year: 1968, rating: 4.7, isbn: "9780345404474", desc: "Bounty hunter Rick Deckard tracks rogue synthetic replicants across a radioactive, desolate future San Francisco." },
    { id: "sf16", title: "The Moon is a Harsh Mistress", author: "Robert A. Heinlein", genre: "Sci-Fi", year: 1966, rating: 4.7, isbn: "9780312863555", desc: "Lunar penal colony inhabitants ally with a self-aware supercomputer to launch a revolution for independence from Earth." },
    { id: "sf17", title: "I, Robot", author: "Isaac Asimov", genre: "Sci-Fi", year: 1950, rating: 4.7, isbn: "9780553382563", desc: "Dr. Susan Calvin investigates robot behavior governed by the Three Laws of Robotics across landmark sci-fi cases." },
    { id: "sf18", title: "Old Man's War", author: "John Scalzi", genre: "Sci-Fi", year: 2005, rating: 4.7, isbn: "9780765348272", desc: "75-year-old John Perry joins the Colonial Defense Force in exchange for a bio-engineered young body and interstellar combat duty." },
    { id: "sf19", title: "Red Rising", author: "Pierce Brown", genre: "Sci-Fi", year: 2014, rating: 4.8, isbn: "9780345539786", desc: "Darrow, a lowborn Red miner on Mars, infiltrates the ruling Gold caste to tear down a tyrannical color-coded society." },
    { id: "sf20", title: "The Time Machine", author: "H.G. Wells", genre: "Sci-Fi", year: 1895, rating: 4.6, isbn: "9780451528551", desc: "A Victorian scientist invents a time-travel machine and journeys into the far future to meet the gentle Eloi and underground Morlocks." },

    // --- COMEDY (20 BOOKS) ---
    { id: "cm1", title: "The Hitchhiker's Guide to the Galaxy", author: "Douglas Adams", genre: "Comedy", year: 1979, rating: 4.9, isbn: "9780345391803", desc: "Arthur Dent is whisked off Earth seconds before its destruction for a galactic highway project with Ford Prefect and a towel." },
    { id: "cm2", title: "Good Omens", author: "Terry Pratchett & Neil Gaiman", genre: "Comedy", year: 1990, rating: 4.8, isbn: "9780060853983", desc: "A fussy angel and a fast-living demon join forces to stop the impending Apocalypse because they like living on Earth." },
    { id: "cm3", title: "Bossypants", author: "Tina Fey", genre: "Comedy", year: 2011, rating: 4.7, isbn: "9780316056861", desc: "Tina Fey shares hilarious autobiographical essays on SNL, 30 Rock, motherhood, and surviving in comedy leadership." },
    { id: "cm4", title: "Catch-22", author: "Joseph Heller", genre: "Comedy", year: 1961, rating: 4.7, isbn: "9781451673319", desc: "Captain John Yossarian tries desperately to survive WWII air combat while trapped in absurd bureaucratic military paradoxes." },
    { id: "cm5", title: "A Confederacy of Dunces", author: "John Kennedy Toole", genre: "Comedy", year: 1980, rating: 4.7, isbn: "9780802130204", desc: "Eccentric, misanthropic scholar Ignatius J. Reilly wreaks chaotic comedic havoc across 1960s New Orleans." },
    { id: "cm6", title: "Me Talk Pretty One Day", author: "David Sedaris", genre: "Comedy", year: 2000, rating: 4.7, isbn: "9780316776967", desc: "David Sedaris presents sharp, witty autobiographical essays on moving to Paris, learning French, and family oddities." },
    { id: "cm7", title: "Three Men in a Boat", author: "Jerome K. Jerome", genre: "Comedy", year: 1889, rating: 4.6, isbn: "9780140437508", desc: "Three hypochondriac Victorian friends and Montmorency the dog take a hilarious boating holiday along the Thames." },
    { id: "cm8", title: "The Color of Magic", author: "Terry Pratchett", genre: "Comedy", year: 1983, rating: 4.7, isbn: "9780062225672", desc: "The very first Discworld novel featuring incompetent wizard Rincewind and naive tourist Twoflower traveling a flat world." },
    { id: "cm9", title: "Lamb", author: "Christopher Moore", genre: "Comedy", year: 2002, rating: 4.8, isbn: "9780380813810", desc: "Biff, the childhood best friend of Jesus Christ, recounts the lost humor-filled early years of miraculous adventures." },
    { id: "cm10", title: "Bridget Jones's Diary", author: "Helen Fielding", genre: "Comedy", year: 1996, rating: 4.6, isbn: "9780140280098", desc: "Bridget Jones documents her single life, career struggles, calorie counting, and romantic dilemmas in 1990s London." },
    { id: "cm11", title: "Born a Crime", author: "Trevor Noah", genre: "Comedy", year: 2016, rating: 4.9, isbn: "9780399588174", desc: "Daily Show host Trevor Noah recounts his funny, poignant upbringing in South Africa under and after Apartheid." },
    { id: "cm12", title: "Let's Pretend This Never Happened", author: "Jenny Lawson", genre: "Comedy", year: 2012, rating: 4.7, isbn: "9780425261019", desc: "The Bloggess shares hysterical, bizarre memoirs of growing up with a taxidermist father and living with anxiety." },
    { id: "cm13", title: "Where'd You Go, Bernadette", author: "Maria Semple", genre: "Comedy", year: 2012, rating: 4.7, isbn: "9780316204262", desc: "An eccentric architect disappears before a family trip to Antarctica, leaving her daughter to solve the mystery via emails." },
    { id: "cm14", title: "The Princess Bride", author: "William Goldman", genre: "Comedy", year: 1973, rating: 4.8, isbn: "9780156028356", desc: "True love, fencing, fighting, revenge, giants, monsters, chases, escapes, and miracles in a satirical fantasy masterpiece." },
    { id: "cm15", title: "Cold Comfort Farm", author: "Stella Gibbons", genre: "Comedy", year: 1932, rating: 4.6, isbn: "9780141441597", desc: "Sophisticated Flora Poste moves into a gloomy rural farm and systematically reorganizes her eccentric relatives' lives." },
    { id: "cm16", title: "The Importance of Being Earnest", author: "Oscar Wilde", genre: "Comedy", year: 1895, rating: 4.8, isbn: "9780486264783", desc: "Oscar Wilde's legendary comedy of manners involving fictional alter-egos, secret identities, and cucumber sandwiches." },
    { id: "cm17", title: "Sick in the Head", author: "Judd Apatow", genre: "Comedy", year: 2015, rating: 4.6, isbn: "9780812997927", desc: "Director Judd Apatow compiles thirty years of intimate conversations with comedy legends from Jerry Seinfeld to Amy Schumer." },
    { id: "cm18", title: "Right Ho, Jeeves", author: "P.G. Wodehouse", genre: "Comedy", year: 1934, rating: 4.8, isbn: "9780140008609", desc: "Valet Jeeves steps in to untangle Bertie Wooster's well-meaning but disastrous attempts at matchmaking at Brinkley Court." },
    { id: "cm19", title: "Hyperbole and a Half", author: "Allie Brosh", genre: "Comedy", year: 2013, rating: 4.8, isbn: "9781451666175", desc: "Allie Brosh presents brilliantly funny illustrated essays about depression, childhood dog antics, and adult life." },
    { id: "cm20", title: "The Sellout", author: "Paul Beatty", genre: "Comedy", year: 2015, rating: 4.6, isbn: "9780374261139", desc: "A biting, Man Booker Prize-winning satire about race, identity, and an agrarian trial brought to the Supreme Court." },

    // --- LITERATURE (20 BOOKS) ---
    { id: "lt1", title: "1984", author: "George Orwell", genre: "Literature", year: 1949, rating: 4.9, isbn: "9780451524935", desc: "Winston Smith rebels against totalitarian surveillance, Big Brother, and Thoughtpolice in Oceania." },
    { id: "lt2", title: "The Great Gatsby", author: "F. Scott Fitzgerald", genre: "Literature", year: 1925, rating: 4.8, isbn: "9780743273565", desc: "Mysterious millionaire Jay Gatsby obsessively pursues former love Daisy Buchanan during the Roaring Twenties on Long Island." },
    { id: "lt3", title: "To Kill a Mockingbird", author: "Harper Lee", genre: "Literature", year: 1960, rating: 4.9, isbn: "9780060935467", desc: "Scout Finch observes her father Atticus defend Tom Robinson in Alabama, confronting racism, empathy, and justice." },
    { id: "lt4", title: "Pride and Prejudice", author: "Jane Austen", genre: "Literature", year: 1813, rating: 4.9, isbn: "9780141439518", desc: "Elizabeth Bennet and Fitzwilliam Darcy overcome first impressions, social class, and pride in Regency England." },
    { id: "lt5", title: "One Hundred Years of Solitude", author: "Gabriel García Márquez", genre: "Literature", year: 1967, rating: 4.8, isbn: "9780060883287", desc: "The multi-generational magical realist epic of the Buendía family in the mythical Colombian town of Macondo." },
    { id: "lt6", title: "Moby-Dick", author: "Herman Melville", genre: "Literature", year: 1851, rating: 4.7, isbn: "9780142437247", desc: "Captain Ahab leads the Pequod crew on an obsessive nautical quest for revenge against the legendary white whale." },
    { id: "lt7", title: "Crime and Punishment", author: "Fyodor Dostoevsky", genre: "Literature", year: 1866, rating: 4.8, isbn: "9780143058144", desc: "Former student Rodion Raskolnikov commits murder in Saint Petersburg and faces psychological guilt and redemption." },
    { id: "lt8", title: "The Catcher in the Rye", author: "J.D. Salinger", genre: "Literature", year: 1951, rating: 4.6, isbn: "9780316769488", desc: "Disillusioned teenager Holden Caulfield wanders New York City grappling with identity, alienation, and loss of innocence." },
    { id: "lt9", title: "Jane Eyre", author: "Charlotte Brontë", genre: "Literature", year: 1847, rating: 4.8, isbn: "9780141441146", desc: "Independent orphan Jane Eyre becomes governess at Thornfield Hall and discovers dark secrets surrounding Edward Rochester." },
    { id: "lt10", title: "Beloved", author: "Toni Morrison", genre: "Literature", year: 1987, rating: 4.8, isbn: "9781400033416", desc: "Sethe, a former enslaved woman in post-Civil War Ohio, is haunted physically and spiritually by the memory of her daughter." },
    { id: "lt11", title: "The Brothers Karamazov", author: "Fyodor Dostoevsky", genre: "Literature", year: 1880, rating: 4.9, isbn: "9780374528379", desc: "A profound philosophical inquiry into faith, free will, and morality centered on the murder of Fyodor Karamazov." },
    { id: "lt12", title: "Anna Karenina", author: "Leo Tolstoy", genre: "Literature", year: 1877, rating: 4.8, isbn: "9780143035008", desc: "Aristocrat Anna Karenina's tragic affair with Count Vronsky contrasts with Levin's search for rural purpose." },
    { id: "lt13", title: "The Picture of Dorian Gray", author: "Oscar Wilde", genre: "Literature", year: 1890, rating: 4.7, isbn: "9780141439570", desc: "Dorian Gray remains youthful while a painted portrait ages and absorbs the moral decay of his hedonistic choices." },
    { id: "lt14", title: "Brave New World", author: "Aldous Huxley", genre: "Literature", year: 1932, rating: 4.7, isbn: "9780060850524", desc: "A futuristic World State conditions citizens through soma and genetics, challenged by outsider John the Savage." },
    { id: "lt15", title: "Wuthering Heights", author: "Emily Brontë", genre: "Literature", year: 1847, rating: 4.7, isbn: "9780141439556", desc: "The intense, destructive passion between Heathcliff and Catherine Earnshaw across the windswept Yorkshire moors." },
    { id: "lt16", title: "Fahrenheit 451", author: "Ray Bradbury", genre: "Literature", year: 1953, rating: 4.8, isbn: "9781451673319", desc: "Fireman Guy Montag, tasked with burning outlawed books, experiences an intellectual awakening and revolts against censorship." },
    { id: "lt17", title: "The Grapes of Wrath", author: "John Steinbeck", genre: "Literature", year: 1939, rating: 4.8, isbn: "9780143039433", desc: "The Joad family migrates from Dust Bowl Oklahoma to California during the Great Depression in search of work." },
    { id: "lt18", title: "Don Quixote", author: "Miguel de Cervantes", genre: "Literature", year: 1605, rating: 4.7, isbn: "9780060934347", desc: "Spanish noble Don Quixote and squire Sancho Panza ride across Spain fighting windmills and upholding chivalry." },
    { id: "lt19", title: "Lolita", author: "Vladimir Nabokov", genre: "Literature", year: 1955, rating: 4.6, isbn: "9780679723400", desc: "Humbert Humbert's confessedly unreliable memoir detailing obsession, prose mastery, and moral tragedy across 1950s America." },
    { id: "lt20", title: "Frankenstein", author: "Mary Shelley", genre: "Literature", year: 1818, rating: 4.7, isbn: "9780141439471", desc: "Victor Frankenstein creates sentient life in a scientific experiment, only to abandon his creature to tragedy and vengeance." },

    // --- BUSINESS & STARTUPS (20 BOOKS) ---
    { id: "bs1", title: "Zero to One", author: "Peter Thiel", genre: "Business & Startups", year: 2014, rating: 4.8, isbn: "9780804139298", desc: "PayPal co-founder Peter Thiel shares notes on how to build monopoly startups that create breakthrough new value." },
    { id: "bs2", title: "The Lean Startup", author: "Eric Ries", genre: "Business & Startups", year: 2011, rating: 4.8, isbn: "9780307887894", desc: "Introduces build-measure-learn feedback loops, minimum viable products (MVPs), and validated learning for founders." },
    { id: "bs3", title: "Atomic Habits", author: "James Clear", genre: "Business & Startups", year: 2018, rating: 4.9, isbn: "9780735211292", desc: "An actionable 4-step framework for building tiny daily habits for massive long-term compound growth." },
    { id: "bs4", title: "Shoe Dog", author: "Phil Knight", genre: "Business & Startups", year: 2016, rating: 4.9, isbn: "9781501135910", desc: "Nike founder Phil Knight candidly chronicles the gritty early days, near bankruptcies, and rise of an iconic global brand." },
    { id: "bs5", title: "Good to Great", author: "Jim Collins", genre: "Business & Startups", year: 2001, rating: 4.8, isbn: "9780066620992", desc: "Identifies Level 5 Leadership, Hedgehog Concepts, and Stockdale Paradoxes that elevate average companies to enduring excellence." },
    { id: "bs6", title: "The Hard Thing About Hard Things", author: "Ben Horowitz", genre: "Business & Startups", year: 2014, rating: 4.8, isbn: "9780062273208", desc: "Andreessen Horowitz founder Ben Horowitz delivers honest advice on navigating crisis management and running tech startups." },
    { id: "bs7", title: "Thinking, Fast and Slow", author: "Daniel Kahneman", genre: "Business & Startups", year: 2011, rating: 4.8, isbn: "9780374533557", desc: "Nobel laureate Daniel Kahneman explores System 1 fast intuition vs System 2 slow deliberation in human decision-making." },
    { id: "bs8", title: "Start with Why", author: "Simon Sinek", genre: "Business & Startups", year: 2009, rating: 4.7, isbn: "9781591846444", desc: "Shows how inspiring leaders like Steve Jobs and the Wright Brothers build movements by starting with core purpose." },
    { id: "bs9", title: "Hooked", author: "Nir Eyal", genre: "Business & Startups", year: 2014, rating: 4.7, isbn: "9781591847786", desc: "Explains the 4-step Hook Model (Trigger, Action, Variable Reward, Investment) behind engaging product design." },
    { id: "bs10", title: "Outliers", author: "Malcolm Gladwell", genre: "Business & Startups", year: 2008, rating: 4.8, isbn: "9780316017930", desc: "Examines how culture, timing, 10,000 hours of deliberate practice, and opportunity create extreme high achievers." },
    { id: "bs11", title: "Rework", author: "Jason Fried", genre: "Business & Startups", year: 2010, rating: 4.7, isbn: "9780307463746", desc: "Basecamp founders challenge traditional business dogma, advocating lean execution, remote work, and simplicity." },
    { id: "bs12", title: "The Innovator's Dilemma", author: "Clayton M. Christensen", genre: "Business & Startups", year: 1997, rating: 4.8, isbn: "9781422196022", desc: "Demonstrates how market leaders fail when disrupted by cheaper, simpler technological innovations." },
    { id: "bs13", title: "Built to Last", author: "Jim Collins", genre: "Business & Startups", year: 1994, rating: 4.8, isbn: "9780060516406", desc: "Research into 18 visionary companies showing how core ideologies and audacious BHAG goals drive centuries of success." },
    { id: "bs14", title: "Dare to Lead", author: "Brené Brown", genre: "Business & Startups", year: 2018, rating: 4.8, isbn: "9780399592522", desc: "Brené Brown outlines how vulnerability, courage, empathy, and clear values define transformational leadership." },
    { id: "bs15", title: "Deep Work", author: "Cal Newport", genre: "Business & Startups", year: 2016, rating: 4.8, isbn: "9781455586691", desc: "Rules for focused, distraction-free cognitive effort to master hard information and produce elite results." },
    { id: "bs16", title: "Influence", author: "Robert B. Cialdini", genre: "Business & Startups", year: 1984, rating: 4.8, isbn: "9780061241895", desc: "The 6 universal principles of persuasion: Reciprocity, Commitment, Social Proof, Authority, Liking, and Scarcity." },
    { id: "bs17", title: "Measure What Matters", author: "John Doerr", genre: "Business & Startups", year: 2018, rating: 4.7, isbn: "9780525536222", desc: "Legendary investor John Doerr explains how Objectives and Key Results (OKRs) backed growth at Google and Intel." },
    { id: "bs18", title: "Crossing the Chasm", author: "Geoffrey A. Moore", genre: "Business & Startups", year: 1991, rating: 4.7, isbn: "9780060517120", desc: "The definitive guide to marketing high-tech products from early adopters to mainstream pragmatic buyers." },
    { id: "bs19", title: "Never Split the Difference", author: "Chris Voss", genre: "Business & Startups", year: 2016, rating: 4.9, isbn: "9780062407801", desc: "Former FBI hostage negotiator Chris Voss reveals tactical empathy and high-stakes negotiation techniques for business." },
    { id: "bs20", title: "The E-Myth Revisited", author: "Michael E. Gerber", genre: "Business & Startups", year: 1995, rating: 4.7, isbn: "9780887307287", desc: "Dispels small business myths and explains how to build scalable systems so your business runs without your constant presence." },

    // --- PHILOSOPHY & MINDSET (20 BOOKS) ---
    { id: "ph1", title: "Meditations", author: "Marcus Aurelius", genre: "Philosophy & Mindset", year: 180, rating: 4.9, isbn: "9780812968255", desc: "Private personal journals of the Roman Emperor practicing Stoic resilience, duty, self-discipline, and inner clarity." },
    { id: "ph2", title: "Man's Search for Meaning", author: "Viktor E. Frankl", genre: "Philosophy & Mindset", year: 1946, rating: 4.9, isbn: "9780807014295", desc: "Psychiatrist Viktor Frankl chronicles surviving Nazi concentration camps and introduces logotherapy: finding meaning in adversity." },
    { id: "ph3", title: "The Daily Stoic", author: "Ryan Holiday", genre: "Philosophy & Mindset", year: 2016, rating: 4.8, isbn: "9780735211735", desc: "366 daily meditations on wisdom, perseverance, and the art of living from Seneca, Epictetus, and Marcus Aurelius." },
    { id: "ph4", title: "The Alchemist", author: "Paulo Coelho", genre: "Philosophy & Mindset", year: 1988, rating: 4.8, isbn: "9780062315007", desc: "Andalusian shepherd boy Santiago journeys across Egypt pursuing his Personal Legend and discovering life's omens." },
    { id: "ph5", title: "Tao Te Ching", author: "Lao Tzu", genre: "Philosophy & Mindset", year: -400, rating: 4.9, isbn: "9780061142697", desc: "81 poetic chapters presenting Eastern philosophy on living in harmony with the natural flow (the Tao) and Wu Wei (effortless action)." },
    { id: "ph6", title: "Letters from a Stoic", author: "Seneca", genre: "Philosophy & Mindset", year: 65, rating: 4.8, isbn: "9780140442106", desc: "Epistolary guidance from Roman philosopher Seneca to Lucilius on time management, friendship, and emotional peace." },
    { id: "ph7", title: "Beyond Good and Evil", author: "Friedrich Nietzsche", genre: "Philosophy & Mindset", year: 1886, rating: 4.7, isbn: "9780679724650", desc: "Nietzsche critiques traditional morality, dogmatic philosophy, and introduces will to power and master-slave moralities." },
    { id: "ph8", title: "The Myth of Sisyphus", author: "Albert Camus", genre: "Philosophy & Mindset", year: 1942, rating: 4.7, isbn: "9780679733737", desc: "Camus addresses the Absurd and argues we must imagine Sisyphus happy as he embraces his endless rock-rolling task." },
    { id: "ph9", title: "Zen and the Art of Motorcycle Maintenance", author: "Robert M. Pirsig", genre: "Philosophy & Mindset", year: 1974, rating: 4.6, isbn: "9780060589462", desc: "A motorcycle journey across America weaves together metaphysics, the concept of Quality, and personal healing." },
    { id: "ph10", title: "Sophie's World", author: "Jostein Gaarder", genre: "Philosophy & Mindset", year: 1991, rating: 4.7, isbn: "9780374530716", desc: "14-year-old Sophie Amundsen receives mysterious letters introducing her to western philosophy from Socrates to Sartre." },
    { id: "ph11", title: "The Republic", author: "Plato", genre: "Philosophy & Mindset", year: -375, rating: 4.8, isbn: "9780140455113", desc: "Socrates dialogues on justice, the ideal city-state, philosopher kings, and the famous Allegory of the Cave." },
    { id: "ph12", title: "Thus Spoke Zarathustra", author: "Friedrich Nietzsche", genre: "Philosophy & Mindset", year: 1883, rating: 4.7, isbn: "9780140441185", desc: "Philosophical novel detailing Zarathustra's teachings on the Übermensch, eternal recurrence, and self-overcoming." },
    { id: "ph13", title: "The Art of War", author: "Sun Tzu", genre: "Philosophy & Mindset", year: -500, rating: 4.8, isbn: "9781590302255", desc: "Ancient military treatise offering timeless strategy on conflict resolution, deception, adaptability, and leadership without fight." },
    { id: "ph14", title: "Enchiridion", author: "Epictetus", genre: "Philosophy & Mindset", year: 135, rating: 4.8, isbn: "9780486433592", desc: "A practical Stoic manual on controlling what is in your power, accepting externals, and maintaining tranquility." },
    { id: "ph15", title: "Critique of Pure Reason", author: "Immanuel Kant", genre: "Philosophy & Mindset", year: 1781, rating: 4.7, isbn: "9780140447477", desc: "Kant reconciles rationalism and empiricism through transcendental idealism, examining the limits of human cognition." },
    { id: "ph16", title: "Fear and Trembling", author: "Søren Kierkegaard", genre: "Philosophy & Mindset", year: 1843, rating: 4.7, isbn: "9780140444490", desc: "Kierkegaard analyzes Abraham's trial of faith, exploring the teleological suspension of the ethical and leaps of faith." },
    { id: "ph17", title: "Being and Time", author: "Martin Heidegger", genre: "Philosophy & Mindset", year: 1927, rating: 4.6, isbn: "9780061575594", desc: "Foundational existential phenomenology examining Dasein (human being-in-the-world), mortality, and authenticity." },
    { id: "ph18", title: "The Power of Now", author: "Eckhart Tolle", genre: "Philosophy & Mindset", year: 1997, rating: 4.8, isbn: "9781577314806", desc: "A guide to spiritual enlightenment that emphasizes transcending egoic thoughts and dwelling fully in present moment awareness." },
    { id: "ph19", title: "Meditations on First Philosophy", author: "René Descartes", genre: "Philosophy & Mindset", year: 1641, rating: 4.7, isbn: "9780872201927", desc: "Descartes applies methodical doubt to find foundational truth, arriving at Cogito, Ergo Sum ('I think, therefore I am')." },
    { id: "ph20", title: "The Prince", author: "Niccolò Machiavelli", genre: "Philosophy & Mindset", year: 1532, rating: 4.7, isbn: "9780140449150", desc: "Political treatise advising rulers on statecraft, pragmatism, power retention, and whether it is better to be loved or feared." }
];

const KNOWN_CAREER_BOOK_ISBNS = {
    // Tech & Engineering
    "Data Structures and Algorithms Made Easy": "9788192107554",
    "Cracking the Coding Interview": "9780984782857",
    "Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow": "9781492032649",
    "Deep Learning": "9780262035613",
    "The Web Application Hacker's Handbook": "9781118026472",
    "CompTIA Security+ Study Guide": "9781119736257",
    "Storytelling with Data": "9781119002253",
    "Python for Data Analysis": "9781491957660",
    "The Design of Everyday Things": "9780465050659",
    "Don't Make Me Think": "9780321965516",
    "The Phoenix Project": "9780988262591",
    "AWS Certified Solutions Architect Official Study Guide": "9781119138556",
    // Arts & Creative
    "Musicophilia": "9781400033539",
    "The Music Producer's Handbook": "9781423492818",
    "Designing Brand Identity": "9781118980842",
    "Grid Systems in Graphic Design": "9783721201451",
    "Making Movies": "9780679756606",
    "In the Blink of an Eye": "9781879505629",
    "The Animator's Survival Kit": "9780952907404",
    "Creating 3D Game Art for the Real-Time Engine": "9780240818290",
    "Interior Design Illustrated": "9781118024010",
    "The Interior Design Handbook": "9780593139318",
    "Ragas and Beyond": "9788124602690",
    "The Voice Book": "9780571195619",
    // Medical & Healthcare
    "Bailey & Love's Short Practice of Surgery": "9781498796507",
    "BD Chaurasia's Human Anatomy": "9789388902731",
    "Thinking, Fast and Slow": "9780374533557",
    "Man's Search for Meaning": "9780807014295",
    "Molecular Biology of the Cell": "9780815344322",
    "Biotechnology": "9788186809211",
    "Physical Rehabilitation": "9780803661622",
    "Joint Structure and Function": "9780803620629",
    "Hospital Administration and Management": "9788123904948",
    "High Output Management": "9780679762881",
    "Remington: The Science and Practice of Pharmacy": "9780857110626",
    "Pharmacological Basis of Therapeutics": "9781259584732",
    // Govt & Civil Services
    "Indian Polity": "9789352604883",
    "India's Struggle for Independence": "9780140107814",
    "SSB Interview: The Complete Guide": "9788183553988",
    "The Brave: Param Vir Chakra Stories": "9780143422358",
    "GATE Engineering Mathematics": "9789388137355",
    "Objective Type Questions in Engineering": "9788174090539",
    "Urbanization in India": "9780143033509",
    "Public Policy in India": "9780199466542",
    "The India Way: Strategies for an Uncertain World": "9789353579791",
    "Pax Indica": "9780670085743",
    "State Specific General Knowledge Manuals": "9789324198273",
    "Indian Economy": "9789353162818",
    // Business & Entrepreneurship
    "The High-Performance Entrepreneur": "9780143062226",
    "Doglapan": "9789356295629",
    "Building a StoryBrand": "9780718033323",
    "Shoe Dog": "9781501135910",
    "The Lean Startup": "9780307887894",
    "Banker to the Poor": "9780140280081",
    "Venture Deals": "9781119594079",
    "Zero to One": "9780804139298",
    "Half the Sky": "9780307387097",
    "To Change the World": "9780199730803",
    "The E-Myth Revisited": "9780887307287",
    "Retail Management": "9780070144903",
    // Law & Legal
    "Introduction to the Constitution of India": "9789351435266",
    "Working a Democratic Constitution": "9780195656107",
    "Before Memory Fades": "9789380658681",
    "Legal Eagles": "9780143425946",
    "Landmark Judgments That Changed India": "9788129135087",
    "Courts and Their Judgments": "9788129104082",
    "Law Relating to Intellectual Property": "9788175349506",
    "Cyber Law in India": "9788190367301",
    "Criminal Procedure Code": "9789388548236",
    "Law of Evidence": "9788188219503",
    "Law of Arbitration and Conciliation": "9788131238902",
    "International Commercial Arbitration": "9789041152183"
};

let recommendationBooks = [];
const openLibraryCoverCache = {};

function findIsbnForBookTitle(title) {
    if (!title) return null;
    const cleanTitle = title.trim();
    if (KNOWN_CAREER_BOOK_ISBNS[cleanTitle]) return KNOWN_CAREER_BOOK_ISBNS[cleanTitle];

    for (const [key, isbn] of Object.entries(KNOWN_CAREER_BOOK_ISBNS)) {
        if (cleanTitle.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(cleanTitle.toLowerCase())) {
            return isbn;
        }
    }

    const libMatch = libraryBooks.find(b => 
        b.title.toLowerCase().includes(cleanTitle.toLowerCase()) || 
        cleanTitle.toLowerCase().includes(b.title.toLowerCase())
    );
    if (libMatch && libMatch.isbn) return libMatch.isbn;

    return null;
}

async function fetchOpenLibraryCoverDynamic(bookId, title, author) {
    const key = `${title}_${author}`;
    if (openLibraryCoverCache[key]) {
        return openLibraryCoverCache[key];
    }
    try {
        const query = encodeURIComponent(`${title} ${author}`);
        const res = await fetch(`https://openlibrary.org/search.json?q=${query}&limit=1`);
        if (!res.ok) return null;
        const data = await res.json();
        if (data.docs && data.docs.length > 0) {
            const doc = data.docs[0];
            let coverUrl = null;
            if (doc.cover_i) {
                coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
            } else if (doc.isbn && doc.isbn.length > 0) {
                coverUrl = `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-M.jpg`;
            }
            if (coverUrl) {
                openLibraryCoverCache[key] = coverUrl;
                const imgEl = document.querySelector(`img[data-book-id="${bookId}"]`);
                if (imgEl) {
                    imgEl.src = coverUrl;
                }
                return coverUrl;
            }
        }
    } catch (e) {
        console.warn("Open Library dynamic cover fetch failed for:", title, e);
    }
    return null;
}

function getOpenLibraryCoverUrl(isbn) {
    return `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
}

function openLibraryWithRecommendations(careerBooks) {
    if (!careerBooks || !Array.isArray(careerBooks) || careerBooks.length === 0) {
        if (window.currentCareerMatch && window.currentCareerMatch.books && window.currentCareerMatch.books.length > 0) {
            careerBooks = window.currentCareerMatch.books;
        } else if (typeof globalMatches !== 'undefined' && globalMatches && globalMatches.length > 0 && globalMatches[0].books) {
            careerBooks = globalMatches[0].books;
        } else {
            careerBooks = [
                "Atomic Habits by James Clear",
                "Zero to One by Peter Thiel",
                "Thinking, Fast and Slow by Daniel Kahneman",
                "Deep Work by Cal Newport"
            ];
        }
    }

    const careerTitle = window.currentCareerMatch ? window.currentCareerMatch.title : "Your Career Path";

    recommendationBooks = careerBooks.map((bookItem, idx) => {
        let title = typeof bookItem === 'string' ? bookItem : (bookItem.title || 'Recommended Book');
        let author = typeof bookItem === 'string' ? 'Recommended Author' : (bookItem.author || 'Recommended Author');
        
        if (typeof bookItem === 'string' && bookItem.includes(" by ")) {
            const parts = bookItem.split(" by ");
            title = parts[0].trim();
            author = parts[1].trim();
        }

        const matchedLib = libraryBooks.find(b => 
            b.title.toLowerCase().includes(title.toLowerCase()) || 
            title.toLowerCase().includes(b.title.toLowerCase())
        );

        const isbn = matchedLib ? matchedLib.isbn : findIsbnForBookTitle(title);
        const year = matchedLib ? matchedLib.year : 2023;
        const rating = matchedLib ? matchedLib.rating : 4.9;
        const desc = matchedLib ? matchedLib.desc : `Essential foundational reading handpicked for your ${careerTitle} roadmap.`;

        const bId = `rec_${idx}_${Date.now()}`;

        if (!isbn) {
            fetchOpenLibraryCoverDynamic(bId, title, author);
        }

        return {
            id: bId,
            title: title,
            author: author,
            genre: "Your Recommendations",
            year: year,
            rating: rating,
            isbn: isbn,
            desc: desc,
            isRecommendation: true
        };
    });

    const tabCountEl = document.getElementById("recommendations-tab-count");
    if (tabCountEl) {
        tabCountEl.innerText = recommendationBooks.length;
    }

    openLibraryModal();
    setLibraryGenre('recommendations');
}

function populateDefaultRecommendations() {
    const defaultBooks = [
        "Atomic Habits by James Clear",
        "Zero to One by Peter Thiel",
        "Thinking, Fast and Slow by Daniel Kahneman",
        "Deep Work by Cal Newport",
        "Shoe Dog by Phil Knight",
        "The Lean Startup by Eric Ries"
    ];

    recommendationBooks = defaultBooks.map((bookItem, idx) => {
        const parts = bookItem.split(" by ");
        const title = parts[0].trim();
        const author = parts[1].trim();
        const matchedLib = libraryBooks.find(b => b.title.toLowerCase() === title.toLowerCase());
        return {
            id: `rec_def_${idx}`,
            title: title,
            author: author,
            genre: "Your Recommendations",
            year: matchedLib ? matchedLib.year : 2020,
            rating: matchedLib ? matchedLib.rating : 4.9,
            isbn: matchedLib ? matchedLib.isbn : findIsbnForBookTitle(title),
            desc: matchedLib ? matchedLib.desc : `Top rated career and mindset book recommendation.`,
            isRecommendation: true
        };
    });

    const tabCountEl = document.getElementById("recommendations-tab-count");
    if (tabCountEl) {
        tabCountEl.innerText = recommendationBooks.length;
    }
}

function handleImageError(img, title, author, genre) {
    img.onerror = null; // Prevent infinite loop
    const colorMap = {
        'Your Recommendations': ['#1e1b4b', '#3730a3', '#4f46e5'],
        'Fantasy': ['#3b0764', '#581c87', '#7e22ce'],
        'Sci-Fi': ['#0f172a', '#1e1b4b', '#312e81'],
        'Comedy': ['#78350f', '#92400e', '#b45309'],
        'Literature': ['#0f172a', '#334155', '#475569'],
        'Business & Startups': ['#1e1b4b', '#1e40af', '#2563eb'],
        'Philosophy & Mindset': ['#312e81', '#3730a3', '#4f46e5']
    };
    const colors = colorMap[genre] || ['#1e293b', '#334155', '#475569'];

    const safeTitle = (title || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeAuthor = (author || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeGenre = (genre || "").toUpperCase();

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
        <defs>
            <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${colors[0]}" />
                <stop offset="50%" stop-color="${colors[1]}" />
                <stop offset="100%" stop-color="${colors[2]}" />
            </linearGradient>
        </defs>
        <rect width="300" height="450" fill="url(#g)" rx="12" />
        <rect x="14" y="14" width="272" height="422" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2" rx="8" />
        <text x="150" y="70" fill="rgba(255,255,255,0.7)" font-size="11" font-weight="bold" font-family="sans-serif" text-anchor="middle" letter-spacing="2">${safeGenre}</text>
        <text x="150" y="210" fill="#ffffff" font-size="19" font-weight="900" font-family="sans-serif" text-anchor="middle">
            ${safeTitle.length > 25 ? safeTitle.substring(0, 24) + '...' : safeTitle}
        </text>
        <text x="150" y="360" fill="rgba(255,255,255,0.85)" font-size="13" font-weight="bold" font-family="sans-serif" text-anchor="middle">
            ${safeAuthor}
        </text>
    </svg>`;

    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function openLibraryModal() {
    const modal = document.getElementById("library-modal");
    if (!modal) return;

    pushModalState("library-modal", "#library");

    modal.classList.remove("hidden");
    requestAnimationFrame(() => {
        modal.classList.remove("opacity-0");
        modal.classList.add("opacity-100");
    });

    renderLibraryGrid();
    trackEvent({ type: 'library_open' });
}

function closeLibraryModal(fromPopstate = false) {
    const modal = document.getElementById("library-modal");
    if (!modal) return;

    modal.classList.remove("opacity-100");
    modal.classList.add("opacity-0");
    setTimeout(() => {
        modal.classList.add("hidden");
    }, 300);

    if (!fromPopstate && window.location.hash === '#library') {
        window.history.replaceState({ praxisRoot: true, view: 'home' }, '', '/praxis');
    }
}

function setLibraryGenre(genre) {
    currentLibraryGenre = genre;
    
    const tabs = {
        'recommendations': 'genre-tab-recommendations',
        'all': 'genre-tab-all',
        'Fantasy': 'genre-tab-fantasy',
        'Sci-Fi': 'genre-tab-scifi',
        'Comedy': 'genre-tab-comedy',
        'Literature': 'genre-tab-literature',
        'Business & Startups': 'genre-tab-business',
        'Philosophy & Mindset': 'genre-tab-philosophy'
    };

    Object.keys(tabs).forEach(gKey => {
        const btn = document.getElementById(tabs[gKey]);
        if (btn) {
            if (gKey === genre) {
                btn.className = "genre-tab-btn neu-btn pressed px-4 py-2 text-xs font-bold text-indigo-600 border-b-2 border-indigo-600 shrink-0";
            } else {
                btn.className = "genre-tab-btn neu-btn px-4 py-2 text-xs font-bold text-slate-600 shrink-0";
            }
        }
    });

    renderLibraryGrid();
}

function handleLibrarySearch() {
    const input = document.getElementById("library-search-input");
    librarySearchQuery = input ? input.value.trim().toLowerCase() : "";
    renderLibraryGrid();
}

function renderLibraryGrid() {
    const grid = document.getElementById("library-grid");
    const emptyState = document.getElementById("library-empty-state");
    if (!grid) return;

    grid.innerHTML = "";

    let booksToFilter = [];
    if (currentLibraryGenre === "recommendations") {
        if (!recommendationBooks || recommendationBooks.length === 0) {
            populateDefaultRecommendations();
        }
        booksToFilter = recommendationBooks;
    } else {
        booksToFilter = libraryBooks;
    }

    const filtered = booksToFilter.filter(book => {
        const matchesGenre = currentLibraryGenre === "recommendations" || currentLibraryGenre === "all" || book.genre === currentLibraryGenre;
        const matchesQuery = !librarySearchQuery || 
            book.title.toLowerCase().includes(librarySearchQuery) || 
            book.author.toLowerCase().includes(librarySearchQuery);
        return matchesGenre && matchesQuery;
    });

    if (filtered.length === 0) {
        if (emptyState) emptyState.classList.remove("hidden");
        return;
    }

    if (emptyState) emptyState.classList.add("hidden");

    filtered.forEach((book, index) => {
        const card = document.createElement("div");
        card.className = "neu-card-sm p-4 flex flex-col justify-between group cursor-pointer hover:shadow-xl transition-all duration-300 relative overflow-hidden fade-in";
        card.style.animationDelay = `${(index % 12) * 40}ms`;

        const coverUrl = book.isbn ? getOpenLibraryCoverUrl(book.isbn) : (openLibraryCoverCache[`${book.title}_${book.author}`] || `https://covers.openlibrary.org/b/isbn/9780000000000-M.jpg`);

        card.innerHTML = `
            <!-- 3D BOOK COVER DISPLAY CASE -->
            <div class="book-3d-wrapper mb-4">
                <div class="book-3d-card">
                    <div class="book-3d-spine"></div>
                    <div class="book-3d-shine"></div>
                    <img src="${coverUrl}" 
                         data-book-id="${book.id}"
                         alt="${escapeHtml(book.title)}" 
                         class="book-cover-img"
                         loading="lazy"
                         onerror="handleImageError(this, '${escapeHtml(book.title)}', '${escapeHtml(book.author)}', '${book.genre}')" />
                </div>
            </div>

            <!-- BOOK METADATA -->
            <div class="flex-1 flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="neu-badge text-[9px] font-extrabold text-indigo-600 uppercase px-2 py-0.5">${escapeHtml(book.genre)}</span>
                        <span class="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">★ ${book.rating}</span>
                    </div>
                    <h4 class="text-sm font-black text-slate-800 font-outfit line-clamp-1 group-hover:text-indigo-600 transition-colors">${escapeHtml(book.title)}</h4>
                    <p class="text-xs font-semibold text-slate-500 line-clamp-1 mt-0.5">${escapeHtml(book.author)}</p>
                    <p class="text-[11px] text-slate-600 line-clamp-2 mt-2 leading-relaxed font-medium">${escapeHtml(book.desc)}</p>
                </div>

                <div class="mt-4 pt-3 border-t border-slate-300/50 flex items-center justify-between gap-2">
                    <span class="text-[10px] font-bold text-slate-400">${book.year}</span>
                    <div class="flex items-center gap-1.5">
                        <button onclick="event.stopPropagation(); openEBookReader('${escapeHtml(book.title)}', '${escapeHtml(book.author)}')" class="px-2.5 py-1 text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors flex items-center gap-1">
                            📖 MORE
                        </button>
                        <span class="text-xs font-black text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                            Inspect &rarr;
                        </span>
                    </div>
                </div>
            </div>
        `;

        card.onclick = () => openBookDetailModal(book.id);
        grid.appendChild(card);
    });
}

function openBookDetailModal(bookId) {
    currentBookDetailId = bookId;
    let book = recommendationBooks.find(b => b.id === bookId);
    if (!book) {
        book = libraryBooks.find(b => b.id === bookId);
    }
    if (!book) return;

    trackEvent({ type: 'book_view', bookTitle: book.title });

    const modal = document.getElementById("book-detail-modal");
    const coverContainer = document.getElementById("detail-book-cover-container");
    const genreEl = document.getElementById("detail-book-genre");
    const yearEl = document.getElementById("detail-book-year");
    const titleEl = document.getElementById("detail-book-title");
    const authorEl = document.getElementById("detail-book-author");
    const descEl = document.getElementById("detail-book-description");
    const ratingEl = document.getElementById("detail-book-rating");
    const linkEl = document.getElementById("detail-book-link");

    if (!modal) return;

    const coverUrl = book.isbn ? getOpenLibraryCoverUrl(book.isbn) : (openLibraryCoverCache[`${book.title}_${book.author}`] || `https://covers.openlibrary.org/b/isbn/9780000000000-M.jpg`);

    if (coverContainer) {
        coverContainer.innerHTML = `
            <div class="book-3d-card shadow-2xl">
                <div class="book-3d-spine"></div>
                <div class="book-3d-shine"></div>
                <img src="${coverUrl}" 
                     alt="${escapeHtml(book.title)}" 
                     class="book-cover-img"
                     onerror="handleImageError(this, '${escapeHtml(book.title)}', '${escapeHtml(book.author)}', '${book.genre}')" />
            </div>
        `;
    }

    if (genreEl) genreEl.innerText = book.genre;
    if (yearEl) yearEl.innerText = `Published ${book.year}`;
    if (titleEl) titleEl.innerText = book.title;
    if (authorEl) authorEl.innerText = `by ${book.author}`;
    if (descEl) descEl.innerText = book.desc;
    if (ratingEl) ratingEl.innerText = `★ ${book.rating} / 5.0 Rating`;
    if (linkEl) linkEl.href = `https://openlibrary.org/search?q=${encodeURIComponent(book.title + ' ' + book.author)}`;

    pushModalState("book-detail-modal", "#book-" + bookId);

    modal.classList.remove("hidden");
    requestAnimationFrame(() => {
        modal.classList.remove("opacity-0");
        modal.classList.add("opacity-100");
    });
}

function closeBookDetailModal(fromPopstate = false) {
    const modal = document.getElementById("book-detail-modal");
    if (!modal) return;

    modal.classList.remove("opacity-100");
    modal.classList.add("opacity-0");
    setTimeout(() => {
        modal.classList.add("hidden");
    }, 300);

    if (!fromPopstate && window.location.hash.startsWith('#book-')) {
        window.history.replaceState({ praxisRoot: true, view: 'home' }, '', '/praxis');
    }
}

// -------------------------------------------------------------
// REAL-TIME ANALYTICS PING ENGINE
// -------------------------------------------------------------
function getOrCreateClientId() {
    let clientId = localStorage.getItem("praxis_client_id");
    if (!clientId) {
        clientId = "client_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
        localStorage.setItem("praxis_client_id", clientId);
    }
    return clientId;
}

async function trackEvent(payload) {
    try {
        await fetch('/api/track-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        // silent catch
    }
}

function initPingEngine() {
    const clientId = getOrCreateClientId();
    const hasVisited = sessionStorage.getItem("praxis_session_active");
    const isNewVisit = !hasVisited;

    if (isNewVisit) {
        sessionStorage.setItem("praxis_session_active", "true");
    }

    const sendPing = async (isNew = false) => {
        try {
            const routineSection = document.getElementById("routine-tracker-section");
            const isRoutineActive = routineSection && !routineSection.classList.contains("hidden");
            await fetch("/api/ping", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId, isNewVisit: isNew, isRoutineActive: !!isRoutineActive })
            });
        } catch (err) {
            // silent catch for background ping
        }
    };

    // Immediate initial ping
    sendPing(isNewVisit);

    // Heartbeat every 30 seconds
    setInterval(() => sendPing(false), 30000);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPingEngine);
} else {
    initPingEngine();
}

// =====================================================================
// MODERN E-BOOK READER SYSTEM & GUTENBERG INTEGRATION
// =====================================================================
let currentEBook = null;
let currentChapterIndex = 0;
let currentEBookFontSize = 16;
let currentEBookThemeIndex = 0; // 0: Dark, 1: Sepia, 2: Deep Night
let isEBookTTSPlaying = false;
let currentBookDetailId = null;

const EBOOK_THEMES = [
    { name: "Dark", bgClass: "bg-slate-900", textClass: "text-slate-300", headingClass: "text-indigo-400", borderClass: "border-slate-800", icon: "🌙" },
    { name: "Sepia", bgClass: "bg-[#1f1a14]", textClass: "text-[#d6c4b0]", headingClass: "text-amber-400", borderClass: "border-amber-900/40", icon: "📜" },
    { name: "Midnight", bgClass: "bg-black", textClass: "text-slate-200", headingClass: "text-cyan-400", borderClass: "border-slate-900", icon: "🌌" }
];

async function openEBookReader(title, author) {
    const modal = document.getElementById("ebook-reader-modal");
    const titleEl = document.getElementById("ebook-modal-title");
    const authorEl = document.getElementById("ebook-modal-author");
    const sourceBadge = document.getElementById("ebook-source-badge");
    const loadingEl = document.getElementById("ebook-loading");
    const textViewport = document.getElementById("ebook-text-viewport");
    const archiveViewport = document.getElementById("ebook-archive-viewport");

    if (!modal) return;

    // Reset TTS if speaking
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    isEBookTTSPlaying = false;
    updateTTSButtonState();

    // Reset viewport visibility
    if (textViewport) textViewport.classList.remove("hidden");
    if (archiveViewport) archiveViewport.classList.add("hidden");

    if (titleEl) titleEl.innerText = title;
    if (authorEl) authorEl.innerText = author ? `by ${author}` : "Classic Literature";
    pushModalState("ebook-reader-modal", "#reader");
    modal.classList.remove("hidden");

    // Track Reading View
    trackEvent({ type: 'book_view', bookTitle: title });

    try {
        const res = await fetch(`/api/book-fulltext?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author || '')}`);
        const data = await res.json();
        
        currentEBook = data;
        currentChapterIndex = 0;

        if (sourceBadge) {
            sourceBadge.innerText = data.isPublicDomain ? "Project Gutenberg (Full)" : "Digital Preview";
            sourceBadge.className = data.isPublicDomain 
                ? "px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0"
                : "px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0";
        }

        // Setup Chapter Select Dropdown
        const chapterSelect = document.getElementById("ebook-chapter-select");
        if (chapterSelect) {
            chapterSelect.innerHTML = "";
            (data.chapters || []).forEach((ch, idx) => {
                const opt = document.createElement("option");
                opt.value = idx;
                opt.innerText = ch.title || `Chapter ${idx + 1}`;
                chapterSelect.appendChild(opt);
            });
        }

        // Prepare Internet Archive Embed URL
        const archiveIframe = document.getElementById("ebook-archive-iframe");
        if (archiveIframe && data.archiveEmbedUrl) {
            archiveIframe.src = data.archiveEmbedUrl;
        }

        renderEBookChapter(0);

    } catch (err) {
        console.error("Error opening E-Book Reader:", err);
        const headingEl = document.getElementById("ebook-chapter-heading");
        const bodyEl = document.getElementById("ebook-text-body");
        if (headingEl) headingEl.innerText = "Error Loading Book";
        if (bodyEl) bodyEl.innerText = "Unable to fetch book content at this moment. Please check server connection.";
    } finally {
        if (loadingEl) loadingEl.classList.add("hidden");
    }
}

function openEBookReaderFromDetail() {
    if (!currentBookDetailId) return;
    let book = recommendationBooks.find(b => b.id === currentBookDetailId) || libraryBooks.find(b => b.id === currentBookDetailId);
    if (book) {
        closeBookDetailModal();
        setTimeout(() => {
            openEBookReader(book.title, book.author);
        }, 200);
    }
}

function renderEBookChapter(index) {
    if (!currentEBook || !currentEBook.chapters || currentEBook.chapters.length === 0) return;
    
    if (index < 0) index = 0;
    if (index >= currentEBook.chapters.length) index = currentEBook.chapters.length - 1;

    currentChapterIndex = index;
    const chapter = currentEBook.chapters[index];

    const headingEl = document.getElementById("ebook-chapter-heading");
    const bodyEl = document.getElementById("ebook-text-body");
    const progressEl = document.getElementById("ebook-reading-progress");
    const statsEl = document.getElementById("ebook-reading-stats");
    const chapterSelect = document.getElementById("ebook-chapter-select");
    const prevBtn = document.getElementById("ebook-prev-btn");
    const nextBtn = document.getElementById("ebook-next-btn");
    const viewport = document.getElementById("ebook-text-viewport");

    if (headingEl) headingEl.innerText = chapter.title || `Chapter ${index + 1}`;
    if (bodyEl) bodyEl.innerText = chapter.content || "";
    if (progressEl) progressEl.innerText = `${index + 1} of ${currentEBook.chapters.length}`;
    if (statsEl) statsEl.innerText = currentEBook.totalWords ? `Total ~${currentEBook.totalWords.toLocaleString()} words` : `Chapter ${index + 1}`;
    if (chapterSelect) chapterSelect.value = index;

    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === currentEBook.chapters.length - 1;

    if (viewport) viewport.scrollTop = 0;

    // Reset speech audio on chapter turn
    if (window.speechSynthesis && isEBookTTSPlaying) {
        window.speechSynthesis.cancel();
        isEBookTTSPlaying = false;
        updateTTSButtonState();
    }

    checkBookmarkStatus();
}

function switchEBookChapter(val) {
    renderEBookChapter(parseInt(val, 10));
}

function navigateEBookChapter(delta) {
    renderEBookChapter(currentChapterIndex + delta);
}

function toggleEBookAudio() {
    if (!('speechSynthesis' in window)) {
        alert("Text-to-speech is not supported in this browser.");
        return;
    }

    if (isEBookTTSPlaying) {
        window.speechSynthesis.cancel();
        isEBookTTSPlaying = false;
        updateTTSButtonState();
    } else {
        if (!currentEBook || !currentEBook.chapters) return;
        const currentText = currentEBook.chapters[currentChapterIndex]?.content;
        if (!currentText) return;

        const utterance = new SpeechSynthesisUtterance(currentText.substring(0, 3000));
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onend = () => {
            isEBookTTSPlaying = false;
            updateTTSButtonState();
        };

        utterance.onerror = () => {
            isEBookTTSPlaying = false;
            updateTTSButtonState();
        };

        window.speechSynthesis.speak(utterance);
        isEBookTTSPlaying = true;
        updateTTSButtonState();
    }
}

function updateTTSButtonState() {
    const btn = document.getElementById("ebook-tts-btn");
    const txt = document.getElementById("ebook-tts-text");
    if (!btn || !txt) return;

    if (isEBookTTSPlaying) {
        btn.className = "px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-rose-600/40 text-rose-200 border border-rose-500/50 font-bold transition flex items-center gap-1 text-[11px] animate-pulse";
        txt.innerText = "Pause Audio";
    } else {
        btn.className = "px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 font-bold transition flex items-center gap-1 text-[11px]";
        txt.innerText = "Listen";
    }
}

function cycleEBookTheme() {
    currentEBookThemeIndex = (currentEBookThemeIndex + 1) % EBOOK_THEMES.length;
    const theme = EBOOK_THEMES[currentEBookThemeIndex];

    const viewport = document.getElementById("ebook-viewport");
    const bodyEl = document.getElementById("ebook-text-body");
    const headingEl = document.getElementById("ebook-chapter-heading");
    const themeText = document.getElementById("ebook-theme-text");
    const themeToggleBtn = document.getElementById("ebook-theme-toggle");

    if (viewport) {
        viewport.className = `flex-1 relative overflow-hidden transition-colors duration-300 ${theme.bgClass}`;
    }
    if (bodyEl) {
        bodyEl.className = `space-y-4 whitespace-pre-wrap ${theme.textClass}`;
    }
    if (headingEl) {
        headingEl.className = `text-xl sm:text-2xl font-sans font-black mb-6 pb-3 border-b ${theme.headingClass} ${theme.borderClass}`;
    }
    if (themeText) {
        themeText.innerText = theme.name;
    }
    if (themeToggleBtn) {
        themeToggleBtn.querySelector('span').previousSibling.textContent = theme.icon + " ";
    }
}

function changeEBookFontSize(delta) {
    currentEBookFontSize = Math.min(28, Math.max(12, currentEBookFontSize + delta));
    const bodyEl = document.getElementById("ebook-text-body");
    const labelEl = document.getElementById("ebook-font-size-label");

    if (bodyEl) {
        bodyEl.style.fontSize = `${currentEBookFontSize}px`;
        bodyEl.style.lineHeight = `${currentEBookFontSize * 1.65}px`;
    }
    if (labelEl) {
        labelEl.innerText = `${currentEBookFontSize}px`;
    }
}

function toggleEBookViewMode() {
    const textViewport = document.getElementById("ebook-text-viewport");
    const archiveViewport = document.getElementById("ebook-archive-viewport");
    const embedText = document.getElementById("ebook-embed-text");

    if (!textViewport || !archiveViewport) return;

    if (archiveViewport.classList.contains("hidden")) {
        archiveViewport.classList.remove("hidden");
        textViewport.classList.add("hidden");
        if (embedText) embedText.innerText = "Text Reader";
    } else {
        archiveViewport.classList.add("hidden");
        textViewport.classList.remove("hidden");
        if (embedText) embedText.innerText = "Archive Viewer";
    }
}

function closeEBookReader(fromPopstate = false) {
    const modal = document.getElementById("ebook-reader-modal");
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    isEBookTTSPlaying = false;
    updateTTSButtonState();

    if (modal) {
        modal.classList.add("hidden");
    }

    if (!fromPopstate && window.location.hash === '#reader') {
        window.history.replaceState({ praxisRoot: true, view: 'home' }, '', '/praxis');
    }
}

function toggleBookBookmark() {
    if (!currentEBook) return;
    const key = `bookmark_${currentEBook.title}`.replace(/\s+/g, '_');
    const isBookmarked = localStorage.getItem(key);

    if (isBookmarked) {
        localStorage.removeItem(key);
        alert(`Removed bookmark for "${currentEBook.title}"`);
    } else {
        localStorage.setItem(key, JSON.stringify({
            title: currentEBook.title,
            chapterIndex: currentChapterIndex,
            timestamp: new Date().toISOString()
        }));
        alert(`Saved bookmark at Chapter ${currentChapterIndex + 1} for "${currentEBook.title}"!`);
    }
    checkBookmarkStatus();
}

function checkBookmarkStatus() {
    if (!currentEBook) return;
    const key = `bookmark_${currentEBook.title}`.replace(/\s+/g, '_');
    const bookmarkBtn = document.getElementById("ebook-bookmark-btn");
    const bookmarkText = document.getElementById("ebook-bookmark-text");

    if (!bookmarkBtn) return;
    const saved = localStorage.getItem(key);

    if (saved) {
        bookmarkBtn.className = "p-2 sm:px-3 sm:py-1.5 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-bold transition flex items-center gap-1.5 border border-amber-500/40";
        if (bookmarkText) bookmarkText.innerText = "Bookmarked";
    } else {
        bookmarkBtn.className = "p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center gap-1.5 border border-slate-700";
        if (bookmarkText) bookmarkText.innerText = "Bookmark";
    }
}

// =====================================================================
// REAL-TIME CROSS-DEVICE SYNCHRONIZATION HANDLERS
// =====================================================================

/**
 * Render saved routine tracker from Cloud Firestore across all user devices
 */
window.renderSavedRoutineTracker = function(routineData) {
    if (!routineData) return;

    let rawCloudHabits = [];
    if (Array.isArray(routineData.habits)) {
        rawCloudHabits = routineData.habits;
    } else if (Array.isArray(routineData)) {
        rawCloudHabits = routineData;
    } else return;

    const cloudHabits = rawCloudHabits.map(normalizeHabit).filter(Boolean);

    // If Cloud returns habits for this user account, replace habits array with cloudHabits
    if (cloudHabits.length > 0) {
        habits = cloudHabits;
    } else if (habits.length > 0) {
        // If Cloud is empty for this specific user account, upload local habits to Cloud for this account
        if (window.praxisAuth && window.praxisAuth.getUser()) {
            window.praxisAuth.saveRoutine({
                habits: habits,
                updatedAt: new Date().toISOString()
            });
        }
    }

    // Save result back to email-namespaced localStorage
    const key = getHabitsStorageKey();
    try {
        localStorage.setItem(key, JSON.stringify(habits));
    } catch (e) {}

    if (typeof renderHabitsList === "function") renderHabitsList();
    if (typeof updateGrowthCharts === "function") updateGrowthCharts();
    if (typeof updateStats === "function") updateStats();
    if (typeof updateFloatingBadge === "function") updateFloatingBadge();
    console.log("[PRAXiS UI] Routine Tracker safely merged and synced with Cloud/Server.");
};

/**
 * Render saved Career Compass roadmap from Cloud Firestore across all user devices
 */
window.renderSavedRoadmap = function(roadmapData) {
    if (!roadmapData || !roadmapData.title) return;
    
    const detailTitle = document.getElementById("detail-title");
    const detailDesc = document.getElementById("detail-desc");
    const detailIcon = document.getElementById("detail-icon");
    const roadmapContainer = document.getElementById("detail-roadmap");

    if (detailTitle) detailTitle.innerText = roadmapData.title;
    if (detailDesc) detailDesc.innerText = roadmapData.desc || "";
    if (detailIcon) detailIcon.innerText = roadmapData.icon || "🧭";

    if (roadmapContainer && Array.isArray(roadmapData.phases)) {
        roadmapContainer.innerHTML = "";
        roadmapData.phases.forEach((phase, i) => {
            const phaseDiv = document.createElement("div");
            phaseDiv.className = "relative group fade-in";
            phaseDiv.style.animationDelay = `${i * 100}ms`;
            phaseDiv.innerHTML = `
                <div class="absolute -left-[25px] sm:-left-[33px] top-4 w-4 h-4 neu-circle-pressed flex items-center justify-center">
                    <div class="w-2 h-2 rounded-full bg-blue-600"></div>
                </div>
                <div class="neu-card-sm p-4 sm:p-6">
                    <h4 class="font-black text-blue-600 text-sm sm:text-base mb-1.5 sm:mb-2 font-outfit tracking-wide">${phase.title}</h4>
                    <p class="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">${phase.steps}</p>
                </div>
            `;
            roadmapContainer.appendChild(phaseDiv);
        });
        console.log("[PRAXiS UI] Career Compass Roadmap synced from cloud across devices.");
    }
};


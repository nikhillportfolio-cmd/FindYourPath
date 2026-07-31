// 1. STATE MANAGEMENT
let questions = [];
let currentIndex = 0;
let userInterest = ""; 
let userTraits = {}; 
let globalMatches = []; 

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
const STORAGE_KEY = "findyourpath_habits";
let habits = [];
let currentCategoryFilter = "all";

function loadHabitsFromStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        habits = saved ? JSON.parse(saved) : [];
        // Ensure backwards compatibility for timeOfDay
        habits.forEach(h => {
            if (!h.timeOfDay) {
                h.timeOfDay = "Morning Routine";
            }
        });
    } catch (e) {
        console.error("Failed to parse habits from localStorage:", e);
        habits = [];
    }
    updateFloatingBadge();
}

function saveHabitsToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
    } catch (e) {
        console.error("Failed to save habits to localStorage:", e);
    }
    updateFloatingBadge();
}

function updateFloatingBadge() {
    const badge = document.getElementById("tracker-badge-count");
    if (badge) {
        if (habits.length > 0) {
            badge.innerText = habits.length;
            badge.classList.remove("hidden");
        } else {
            badge.classList.add("hidden");
        }
    }
}

// STREAK CALCULATION ENGINE
// Detects consecutive checked days across the 30-day grid
function isDayDone(val) {
    return val === true || val === "done";
}

function isDayMissed(val) {
    return val === "missed";
}

function calculateHabitStreak(days) {
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

// GITHUB-STYLE 30-DAY CONTRIBUTION HEATMAP ENGINE
function renderHeatmap() {
    const grid = document.getElementById("heatmap-grid");
    if (!grid) return;

    grid.innerHTML = "";
    const totalHabits = habits.length;

    for (let day = 0; day < 30; day++) {
        let completedCount = 0;
        habits.forEach(h => {
            if (h.days && isDayDone(h.days[day])) completedCount++;
        });

        const pct = totalHabits > 0 ? Math.round((completedCount / totalHabits) * 100) : 0;

        // Tile styling based on completion level
        let styleClass = "";
        let levelName = "";

        if (totalHabits === 0 || completedCount === 0) {
            styleClass = "bg-[#e0e5ec] text-slate-400 shadow-[inset_2px_2px_4px_#b8bec7,inset_-2px_-2px_4px_#ffffff]";
            levelName = "No habits completed";
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

        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = `h-9 rounded-lg flex flex-col items-center justify-center text-[10px] transition-all duration-200 hover:scale-110 cursor-pointer ${styleClass}`;
        tile.title = `Day ${day + 1}: ${completedCount}/${totalHabits} completed (${pct}%) - ${levelName}`;
        tile.innerHTML = `
            <span class="leading-none font-bold">${day + 1}</span>
            <span class="text-[8px] opacity-80 mt-0.5 font-semibold">${completedCount}/${totalHabits}</span>
        `;

        const updateBanner = () => {
            const banner = document.getElementById("heatmap-detail-banner");
            if (banner) {
                if (totalHabits === 0) {
                    banner.innerHTML = `📅 <strong>Day ${day + 1}</strong>: No habits created yet. Define habits to light up your heatmap!`;
                } else {
                    banner.innerHTML = `📅 <strong>Day ${day + 1}</strong>: <span>${completedCount} of ${totalHabits} habits completed</span> (<strong class="text-emerald-700">${pct}%</strong>) • <em>${levelName}</em>`;
                }
            }
        };

        tile.addEventListener("mouseenter", updateBanner);
        tile.addEventListener("click", updateBanner);

        grid.appendChild(tile);
    }
}

// OVERALL & DAILY GROWTH ANALYTICS
function updateGrowthCharts() {
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
        const checkedCount = h.days.filter(isDayDone).length;
        totalCheckedHabitCells += checkedCount;
        const streak = calculateHabitStreak(h.days);
        if (streak > highestStreakAcrossAll) highestStreakAcrossAll = streak;
    });

    // Calculate unique calendar days (out of 30) where at least one habit was completed
    let uniqueDaysDoneCount = 0;
    if (totalHabitsCount > 0) {
        for (let day = 0; day < 30; day++) {
            const isDayCompleted = habits.some(h => h.days && isDayDone(h.days[day]));
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

// LOOSE HANDWRITTEN MARKS GENERATOR
function getHandwrittenMarkHTML(val, dayIndex) {
    if (isDayDone(val)) {
        const rot = ((dayIndex % 5) - 2) * 2; // -4deg to 4deg
        return `
            <div class="w-full h-full flex items-center justify-center pointer-events-none">
                <svg viewBox="0 0 32 32" class="w-5 h-5 sm:w-7 sm:h-7 text-emerald-600 drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]" style="transform: rotate(${rot}deg);" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 17.5 C 9 20, 11 23.5, 12.5 25.5 C 15 18, 20 10.5, 27 5.5" 
                        stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </div>
        `;
    }
    if (isDayMissed(val)) {
        const rot = ((dayIndex % 3) - 1) * 3; // -3deg to 3deg
        return `
            <div class="w-full h-full flex items-center justify-center pointer-events-none">
                <svg viewBox="0 0 32 32" class="w-5 h-5 sm:w-7 sm:h-7 text-rose-500 drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]" style="transform: rotate(${rot}deg);" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7.5 7.5 C 13 13, 19 19, 24.5 24.5 M24 7.8 C 18.5 13.5, 13 19, 7.8 24.2" 
                        stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </div>
        `;
    }
    return "";
}

// SERVICE WORKER & DUAL NOTIFICATION ENGINE (SYSTEM + IN-APP TOAST + WEB AUDIO CHIME)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('PRAXiS Service Worker registered:', reg.scope);
        }).catch(err => {
            console.log('PRAXiS Service Worker registration failed:', err);
        });
    });
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

function playNotificationSound(isMissed) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (isMissed) {
            osc.frequency.setValueAtTime(280, now);
            osc.frequency.exponentialRampToValueAtTime(170, now + 0.45);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
            osc.start(now);
            osc.stop(now + 0.45);
        } else {
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
            osc.start(now);
            osc.stop(now + 0.45);
        }
    } catch (e) {
        console.log("Audio play error:", e);
    }
}

function showInAppToast(title, body, isMissed) {
    let container = document.getElementById("praxis-toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "praxis-toast-container";
        container.className = "fixed top-4 right-4 sm:top-6 sm:right-6 z-[200] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `pointer-events-auto neu-card p-3.5 sm:p-4 shadow-2xl border flex items-start gap-3 transition-all duration-500 transform -translate-y-4 opacity-0 ${
        isMissed 
            ? 'border-rose-400/80 bg-rose-50/95 text-rose-950' 
            : 'border-blue-500/80 bg-slate-900/95 text-white'
    }`;

    toast.innerHTML = `
        <div class="text-xl sm:text-2xl shrink-0 mt-0.5">${isMissed ? '😔' : '⏰'}</div>
        <div class="flex-1 min-w-0">
            <h5 class="font-black text-xs sm:text-sm font-outfit leading-snug">${escapeHtml(title)}</h5>
            <p class="text-[11px] font-semibold opacity-90 mt-0.5 leading-relaxed">${escapeHtml(body)}</p>
        </div>
        <button onclick="this.parentElement.remove()" class="text-sm opacity-60 hover:opacity-100 font-black p-1 shrink-0">&times;</button>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove("-translate-y-4", "opacity-0");
        toast.classList.add("translate-y-0", "opacity-100");
    });

    setTimeout(() => {
        toast.classList.add("opacity-0", "-translate-y-2");
        setTimeout(() => toast.remove(), 500);
    }, 7000);
}

function sendNotification(title, options) {
    // 1. Play Web Audio chime
    playNotificationSound(options.isMissed);

    // 2. Display In-App Floating Toast
    showInAppToast(title, options.body, options.isMissed);

    // 3. Dispatch Native / Mobile Push Notification
    if ("Notification" in window && Notification.permission === "granted") {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(title, {
                    body: options.body,
                    icon: options.icon || '/favicon.ico',
                    badge: '/favicon.ico',
                    tag: options.tag || 'praxis-notif',
                    renotify: true
                });
            }).catch(() => {
                fallbackNativeNotification(title, options);
            });
        } else {
            fallbackNativeNotification(title, options);
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

function requestNotificationPermission() {
    if (!("Notification" in window)) {
        showInAppToast("🔕 Notifications Unsupported", "Web Notifications are not supported in this browser environment.", true);
        return;
    }
    Notification.requestPermission().then(permission => {
        updateNotificationBtnState();
        if (permission === "granted") {
            sendNotification("🔔 PRAXiS Reminders Activated", {
                body: "You'll receive 10-minute reminders before your scheduled habits & alerts if missed!",
                tag: 'praxis-welcome',
                isMissed: false
            });
        } else if (permission === "denied") {
            alert("Notification permission was denied. Please allow notifications in your browser/device settings to receive reminders.");
        }
    });
}

function updateNotificationBtnState() {
    const btn = document.getElementById("notif-permission-btn");
    if (!btn) return;
    if (!("Notification" in window)) {
        btn.innerHTML = `<span class="text-slate-400">🔕 Notifications Unsupported</span>`;
        return;
    }
    if (Notification.permission === "granted") {
        btn.innerHTML = `<span class="text-emerald-700 font-bold">🔔 Phone Reminders Active</span>`;
        btn.className = "neu-badge px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-500/15 flex items-center gap-1.5 shrink-0";
    } else if (Notification.permission === "denied") {
        btn.innerHTML = `<span class="text-rose-700 font-bold">🔕 Notifications Blocked</span>`;
        btn.className = "neu-badge px-2.5 py-1 text-[11px] font-extrabold text-rose-700 bg-rose-500/15 flex items-center gap-1.5 shrink-0";
    }
}

function testNotificationNow() {
    if (!("Notification" in window)) {
        showInAppToast("🧪 Test Notification Active", "In-app toast & audio chime work! Note: Your browser doesn't support system notifications.", false);
        playNotificationSound(false);
        return;
    }

    if (Notification.permission !== "granted") {
        Notification.requestPermission().then(permission => {
            updateNotificationBtnState();
            triggerTestAlerts();
        });
    } else {
        triggerTestAlerts();
    }
}

function triggerTestAlerts() {
    sendNotification("⏰ Test Habit Reminder (10 mins prior)", {
        body: "Success! Your habit notifications, phone alerts & audio chime are active and working perfectly! 🎉",
        tag: 'praxis-test-remind',
        isMissed: false
    });
}

function checkHabitNotifications() {
    if (habits.length === 0) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTotalMins = currentHour * 60 + currentMin;

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayIndex = (now.getDate() - 1) % 30; // 0-indexed day index 0..29

    habits.forEach(habit => {
        if (!habit.scheduledTime) return;

        const parts = habit.scheduledTime.split(":");
        if (parts.length < 2) return;
        const targetH = parseInt(parts[0], 10);
        const targetM = parseInt(parts[1], 10);
        if (isNaN(targetH) || isNaN(targetM)) return;

        const scheduledTotalMins = targetH * 60 + targetM;
        const isTodayDone = habit.days && isDayDone(habit.days[todayIndex]);

        if (!habit.remindedDates) habit.remindedDates = {};
        if (!habit.missedNotifiedDates) habit.missedNotifiedDates = {};

        // 1. 10-Minute Prior Pre-Habit Reminder Notification
        const reminderTimeMins = scheduledTotalMins - 10;
        if (currentTotalMins >= reminderTimeMins && currentTotalMins < scheduledTotalMins) {
            if (!isTodayDone && !habit.remindedDates[todayStr]) {
                habit.remindedDates[todayStr] = true;
                saveHabitsToStorage();
                
                sendNotification(`⏰ Habit in 10 mins: ${habit.name}`, {
                    body: `Your habit "${habit.name}" is scheduled for ${formatAMPM(habit.scheduledTime)}. Get ready to build discipline! 💪`,
                    tag: `praxis-remind-${habit.id}-${todayStr}`,
                    isMissed: false
                });
            }
        }

        // 2. Disappointed Missed Habit Alert Notification (10 mins past target time)
        if (currentTotalMins >= scheduledTotalMins + 10) {
            if (!isTodayDone && !habit.missedNotifiedDates[todayStr]) {
                habit.missedNotifiedDates[todayStr] = true;

                // Auto-mark day cell as missed if still empty
                if (!habit.days[todayIndex] || habit.days[todayIndex] === false) {
                    habit.days[todayIndex] = "missed";
                    renderHabitsList();
                    updateGrowthCharts();
                }

                saveHabitsToStorage();

                const quotes = [
                    `😔 You missed "${habit.name}" scheduled for ${formatAMPM(habit.scheduledTime)}. Discipline is built through daily action, not excuses!`,
                    `💔 Habit missed: "${habit.name}". Skipping habits today steals momentum from your future self. Get back on track!`,
                    `⚠️ Missed target: "${habit.name}" at ${formatAMPM(habit.scheduledTime)}. Reset your focus and don't miss twice!`
                ];
                const msg = quotes[Math.floor(Math.random() * quotes.length)];

                sendNotification(`😔 Habit Missed: ${habit.name}`, {
                    body: msg,
                    tag: `praxis-missed-${habit.id}-${todayStr}`,
                    isMissed: true
                });
            }
        }
    });
}

// Start notification checker loop every 15 seconds
setInterval(checkHabitNotifications, 15000);

function editHabitTime(habitIndex) {
    const habit = habits[habitIndex];
    if (!habit) return;
    const currentTime = habit.scheduledTime || "";
    const newTime = prompt(`Set/Update target time for "${habit.name}"\n(Enter 24-hour time e.g. 07:30 or 18:45, or leave blank to clear):`, currentTime);
    if (newTime !== null) {
        habit.scheduledTime = newTime.trim();
        saveHabitsToStorage();
        renderHabitsList();
        if (habit.scheduledTime && "Notification" in window && Notification.permission !== "granted") {
            requestNotificationPermission();
        }
    }
}

// RENDER TIME-OF-DAY CATEGORIZED SPREADSHEET TRACKER GRID (MOBILE COMPATIBLE)
function renderHabitsList() {
    const container = document.getElementById("habits-list-container");
    const blankSlate = document.getElementById("blank-slate");

    if (!container || !blankSlate) return;

    if (habits.length === 0) {
        blankSlate.classList.remove("hidden");
        container.innerHTML = "";
        return;
    }

    blankSlate.classList.add("hidden");
    updateNotificationBtnState();

    const categories = [
        { key: "Morning Routine", title: "Morning Routine", icon: "🌅", badgeBg: "bg-amber-500/15 text-amber-700" },
        { key: "Afternoon Focus", title: "Afternoon Focus", icon: "☀️", badgeBg: "bg-blue-500/15 text-blue-700" },
        { key: "Evening Wind-down", title: "Evening Wind-down", icon: "🌙", badgeBg: "bg-indigo-500/15 text-indigo-700" }
    ];

    const activeCategories = currentCategoryFilter === "all" 
        ? categories 
        : categories.filter(c => c.key === currentCategoryFilter);

    let tableHTML = `
        <div class="neu-card p-2 sm:p-5 bg-[#e0e5ec] shadow-xl border border-white/70 overflow-hidden">
            <!-- Header Legend Bar with Mobile Scroll Hint -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-300/70">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-base sm:text-lg">📊</span>
                    <div>
                        <div class="flex items-center gap-1.5">
                            <h4 class="text-xs sm:text-base font-black text-slate-800 font-outfit leading-tight">Spreadsheet Habit Tracker</h4>
                            <span class="inline-flex sm:hidden neu-badge text-[9px] font-extrabold text-blue-600 px-1.5 py-0.5 leading-none">Swipe &rarr;</span>
                        </div>
                        <p class="text-[10px] sm:text-[11px] text-slate-500 font-semibold leading-snug mt-0.5">Click cell: Blank &rarr; Done (✓) &rarr; Missed (✕)</p>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 sm:gap-3 text-[10px] sm:text-[11px] font-extrabold text-slate-600 bg-slate-200/60 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-slate-300/60 self-start sm:self-auto shrink-0">
                    <span class="flex items-center gap-1"><span class="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-xs border border-slate-400/50 bg-[#e0e5ec]"></span> Blank</span>
                    <span class="flex items-center gap-1"><span class="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-xs bg-emerald-500/20 border border-emerald-500/50 text-emerald-600 flex items-center justify-center text-[9px] sm:text-[10px] font-black">✓</span> Done</span>
                    <span class="flex items-center gap-1"><span class="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-xs bg-rose-500/20 border border-rose-500/50 text-rose-500 flex items-center justify-center text-[9px] sm:text-[10px] font-black">✕</span> Missed</span>
                </div>
            </div>

            <!-- Spreadsheet Grid Table Wrapper (Sticky Headers & Sticky Left Habit Column) -->
            <div class="overflow-x-auto max-h-[60vh] sm:max-h-[580px] overflow-y-auto custom-scrollbar rounded-xl border-2 border-slate-300/80 bg-[#e0e5ec] shadow-inner relative touch-pan-x touch-pan-y overscroll-x-contain">
                <table class="w-full border-separate border-spacing-0 select-none text-left min-w-max">
                    <thead>
                        <tr>
                            <!-- Top-Left Corner Header (Fixed on Top & Left) -->
                            <th class="sticky top-0 left-0 z-30 bg-[#cbd4e2] p-1.5 sm:p-3 text-[11px] sm:text-xs font-black font-outfit text-slate-800 border-r-2 border-b-2 border-slate-300 shadow-[3px_0_6px_-1px_rgba(0,0,0,0.12)] min-w-[125px] w-[125px] sm:min-w-[270px] sm:w-auto">
                                <div class="flex items-center justify-between">
                                    <span>Habit</span>
                                    <span class="text-[9px] sm:text-[10px] font-extrabold text-slate-500 uppercase">30 Days</span>
                                </div>
                            </th>
                            <!-- Days 1 to 30 Headers (Fixed on Top) -->
    `;

    for (let day = 1; day <= 30; day++) {
        tableHTML += `
            <th class="sticky top-0 z-20 bg-[#d5deeb] p-1.5 sm:p-2 text-center text-[10px] sm:text-xs font-bold font-outfit text-slate-700 border-r border-b-2 border-slate-300 min-w-[36px] sm:min-w-[46px] w-[36px] sm:w-[46px] select-none">
                ${day}
            </th>
        `;
    }

    tableHTML += `
                        </tr>
                    </thead>
                    <tbody>
    `;

    let totalHabitsRendered = 0;

    activeCategories.forEach(cat => {
        const catHabits = habits.filter(h => (h.timeOfDay || "Morning Routine") === cat.key);

        if (catHabits.length === 0 && currentCategoryFilter !== "all") {
            tableHTML += `
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
        tableHTML += `
            <tr class="bg-gradient-to-r from-slate-300/90 via-slate-200 to-slate-300/70 text-slate-800">
                <td colspan="31" class="sticky left-0 z-20 p-2 px-3 sm:p-2.5 sm:px-4 font-black font-outfit text-xs sm:text-sm tracking-wide border-t-2 border-b-2 border-r border-slate-300/90 bg-[#d1d9e6] shadow-xs">
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
            const habitIndex = habits.indexOf(habit);
            const checkedCount = habit.days.filter(isDayDone).length;
            const habitPercentage = Math.round((checkedCount / 30) * 100);
            const streak = calculateHabitStreak(habit.days);

            tableHTML += `
                <tr class="hover:bg-slate-200/40 transition-colors">
                    <!-- Sticky Habit Cell (Fixed on Left) -->
                    <td class="sticky left-0 z-20 bg-[#e0e5ec] p-1.5 px-2 sm:p-2.5 sm:px-3 border-r-2 border-b border-slate-300/80 shadow-[3px_0_6px_-1px_rgba(0,0,0,0.08)] min-w-[125px] max-w-[125px] sm:min-w-[270px] sm:max-w-none">
                        <div class="flex items-center justify-between gap-1 sm:gap-2 min-w-0">
                            <div class="flex flex-col min-w-0 pr-0.5">
                                <div class="flex items-center gap-1 flex-wrap">
                                    <span class="font-black text-[11px] sm:text-sm text-slate-800 font-outfit truncate max-w-[82px] sm:max-w-[195px]" title="${escapeHtml(habit.name)}">
                                        ${escapeHtml(habit.name)}
                                    </span>
                                    ${habit.scheduledTime ? `<span class="neu-badge px-1 py-0.5 text-[8px] sm:text-[9px] font-extrabold text-indigo-600 bg-indigo-500/10 flex items-center gap-0.5" title="Scheduled target time: ${formatAMPM(habit.scheduledTime)}">⏰ ${formatAMPM(habit.scheduledTime)}</span>` : ''}
                                </div>
                                <div class="flex items-center gap-1 sm:gap-2 mt-0.5 text-[9px] sm:text-[10px] font-semibold text-slate-500 flex-wrap">
                                    <span class="text-blue-600 font-bold">${checkedCount}/30</span>
                                    ${streak > 0 ? `<span class="text-amber-600 font-bold flex items-center gap-0.5">🔥${streak}d</span>` : ''}
                                </div>
                            </div>
                            <div class="flex items-center gap-0.5 shrink-0">
                                <button onclick="editHabitTime(${habitIndex})" title="Set or edit target time for reminders" class="neu-badge p-1 sm:p-1.5 text-slate-400 hover:text-indigo-600 transition-colors text-[10px] sm:text-xs hover:scale-110">
                                    ⏰
                                </button>
                                <button onclick="deleteHabit(${habitIndex})" title="Delete Habit" class="neu-badge p-1 sm:p-1.5 text-slate-400 hover:text-red-600 transition-colors text-[10px] sm:text-xs hover:scale-110">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    </td>
            `;

            // 30 Day Grid Cells
            for (let day = 0; day < 30; day++) {
                const val = habit.days[day];
                let cellBgClass = "bg-[#e0e5ec] hover:bg-slate-200/90";
                if (isDayDone(val)) cellBgClass = "bg-emerald-500/15 hover:bg-emerald-500/25";
                if (isDayMissed(val)) cellBgClass = "bg-rose-500/15 hover:bg-rose-500/25";

                const markHTML = getHandwrittenMarkHTML(val, day);
                const titleText = isDayDone(val) ? `Day ${day + 1}: Completed ✓` : isDayMissed(val) ? `Day ${day + 1}: Missed ✕` : `Day ${day + 1}: Empty`;

                tableHTML += `
                    <td onclick="toggleHabitDay(${habitIndex}, ${day})"
                        title="${titleText}"
                        class="border-r border-b border-slate-300/70 p-0 text-center align-middle cursor-pointer transition-colors duration-150 h-9 sm:h-11 w-[36px] sm:w-[46px] min-w-[36px] sm:min-w-[46px] touch-manipulation active:scale-95 ${cellBgClass}">
                        ${markHTML}
                    </td>
                `;
            }

            tableHTML += `</tr>`;
        });
    });

    tableHTML += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    if (totalHabitsRendered === 0 && currentCategoryFilter === "all") {
        blankSlate.classList.remove("hidden");
        container.innerHTML = "";
    } else {
        container.innerHTML = tableHTML;
    }
}

function escapeHtml(str) {
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
    event.preventDefault();
    const input = document.getElementById("habit-name-input");
    const timeSelect = document.getElementById("habit-time-select");
    const clockInput = document.getElementById("habit-clock-input");
    if (!input) return;

    const name = input.value.trim();
    if (!name) return;

    const timeOfDay = timeSelect ? timeSelect.value : "Morning Routine";
    const scheduledTime = clockInput ? clockInput.value : "";

    if (scheduledTime && "Notification" in window && Notification.permission !== "granted") {
        requestNotificationPermission();
    }

    const newHabit = {
        id: "habit_" + Date.now(),
        name: name,
        timeOfDay: timeOfDay,
        scheduledTime: scheduledTime,
        remindedDates: {},
        missedNotifiedDates: {},
        days: new Array(30).fill(false),
        createdAt: Date.now()
    };

    habits.unshift(newHabit);
    saveHabitsToStorage();
    input.value = "";
    if (clockInput) clockInput.value = "";
    
    renderHabitsList();
    updateGrowthCharts();
    trackEvent({ type: 'routine_interaction', clientId: getOrCreateClientId(), isCheckoff: false });
}

function toggleHabitDay(habitIndex, dayIndex) {
    if (habits[habitIndex] && habits[habitIndex].days) {
        const currentVal = habits[habitIndex].days[dayIndex];
        let newVal;
        if (!currentVal || currentVal === false) {
            newVal = "done";
        } else if (isDayDone(currentVal)) {
            newVal = "missed";
        } else {
            newVal = false;
        }
        habits[habitIndex].days[dayIndex] = newVal;
        const isNowChecked = isDayDone(newVal);
        saveHabitsToStorage();
        renderHabitsList();
        updateGrowthCharts();
        trackEvent({ type: 'routine_interaction', clientId: getOrCreateClientId(), isCheckoff: isNowChecked });
    }
}

function deleteHabit(habitIndex) {
    if (confirm("Are you sure you want to delete this habit?")) {
        habits.splice(habitIndex, 1);
        saveHabitsToStorage();
        renderHabitsList();
        updateGrowthCharts();
    }
}

function openTrackerModal() {
    const modal = document.getElementById("tracker-modal");
    if (!modal) return;

    modal.classList.remove("hidden");
    requestAnimationFrame(() => {
        modal.classList.remove("opacity-0");
        modal.classList.add("opacity-100");
    });
    
    renderHabitsList();
    updateGrowthCharts();
}

function closeTrackerModal() {
    const modal = document.getElementById("tracker-modal");
    if (!modal) return;

    modal.classList.remove("opacity-100");
    modal.classList.add("opacity-0");
    setTimeout(() => {
        modal.classList.add("hidden");
    }, 300);
}

// Close modal on Escape key press
window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeTrackerModal();
        closeLibraryModal();
        closeBookDetailModal();
    }
});

// INITIALIZE TRACKER ON LOAD & UPDATE URL PATH TO /praxis
document.addEventListener("DOMContentLoaded", () => {
    loadHabitsFromStorage();
    if (window.location.pathname === '/' || window.location.pathname.endsWith('/index.html')) {
        window.history.replaceState(null, '', '/praxis');
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

    modal.classList.remove("hidden");
    requestAnimationFrame(() => {
        modal.classList.remove("opacity-0");
        modal.classList.add("opacity-100");
    });

    renderLibraryGrid();
    trackEvent({ type: 'library_open' });
}

function closeLibraryModal() {
    const modal = document.getElementById("library-modal");
    if (!modal) return;

    modal.classList.remove("opacity-100");
    modal.classList.add("opacity-0");
    setTimeout(() => {
        modal.classList.add("hidden");
    }, 300);
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

    modal.classList.remove("hidden");
    requestAnimationFrame(() => {
        modal.classList.remove("opacity-0");
        modal.classList.add("opacity-100");
    });
}

function closeBookDetailModal() {
    const modal = document.getElementById("book-detail-modal");
    if (!modal) return;

    modal.classList.remove("opacity-100");
    modal.classList.add("opacity-0");
    setTimeout(() => {
        modal.classList.add("hidden");
    }, 300);
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
    if (loadingEl) loadingEl.classList.remove("hidden");

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

function closeEBookReader() {
    const modal = document.getElementById("ebook-reader-modal");
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    isEBookTTSPlaying = false;
    updateTTSButtonState();

    if (modal) {
        modal.classList.add("hidden");
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
// USER AUTHENTICATION & PROFILE SYSTEM (JWT, OTP, RESEND COOLDOWN)
// =====================================================================
let currentUser = null;
let authToken = localStorage.getItem('praxis_auth_token') || null;
let activeAuthEmail = '';
let otpCooldownInterval = null;
let otpExpiryInterval = null;

// Initialize Auth status on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    checkUserAuthSession();
});

async function checkUserAuthSession() {
    if (!authToken) {
        updateAuthUI(null);
        return;
    }
    try {
        const res = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) {
                currentUser = data.user;
                updateAuthUI(currentUser);
            } else {
                logoutUser();
            }
        } else {
            logoutUser();
        }
    } catch (err) {
        console.warn("Failed to verify user auth session:", err);
    }
}

function updateAuthUI(user) {
    const loginBtn = document.getElementById('nav-login-btn');
    const profileBtn = document.getElementById('nav-profile-btn');
    const avatarImg = document.getElementById('nav-avatar-img');
    const userNameEl = document.getElementById('nav-user-name');

    if (user) {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (profileBtn) profileBtn.classList.remove('hidden');
        if (avatarImg) avatarImg.src = user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.username)}`;
        if (userNameEl) userNameEl.innerText = user.name || user.username;
    } else {
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (profileBtn) profileBtn.classList.add('hidden');
    }
}

// Modal open & switch views
function openAuthModal(viewName = 'login') {
    const modal = document.getElementById('auth-user-modal');
    if (modal) modal.classList.remove('hidden');
    switchAuthView(viewName);
}

function closeAuthModal() {
    const modal = document.getElementById('auth-user-modal');
    if (modal) modal.classList.add('hidden');
    clearAuthAlerts();
}

function switchAuthView(viewName) {
    clearAuthAlerts();
    const views = ['login', 'signup', 'otp', 'forgot', 'reset'];
    views.forEach(v => {
        const el = document.getElementById(`auth-view-${v}`);
        if (el) el.classList.add('hidden');
    });

    const target = document.getElementById(`auth-view-${viewName}`);
    if (target) target.classList.remove('hidden');

    const titleEl = document.getElementById('auth-modal-title');
    const subTitleEl = document.getElementById('auth-modal-subtitle');

    if (viewName === 'login') {
        if (titleEl) titleEl.innerText = "Welcome Back";
        if (subTitleEl) subTitleEl.innerText = "Log in to your account to access your compass";
    } else if (viewName === 'signup') {
        if (titleEl) titleEl.innerText = "Create Your Account";
        if (subTitleEl) subTitleEl.innerText = "Fill in your details for OTP verification";
    } else if (viewName === 'otp') {
        if (titleEl) titleEl.innerText = "Verify Email OTP";
        if (subTitleEl) subTitleEl.innerText = "Enter the 6-digit code sent to your email";
    } else if (viewName === 'forgot') {
        if (titleEl) titleEl.innerText = "Forgot Password";
        if (subTitleEl) subTitleEl.innerText = "Enter your username/email to receive a reset OTP";
    } else if (viewName === 'reset') {
        if (titleEl) titleEl.innerText = "Set New Password";
        if (subTitleEl) subTitleEl.innerText = "Enter the OTP code and your new password";
    }
}

function clearAuthAlerts() {
    ['login', 'signup', 'otp', 'forgot', 'reset'].forEach(v => {
        const alertEl = document.getElementById(`${v}-alert`);
        if (alertEl) {
            alertEl.innerText = '';
            alertEl.classList.add('hidden');
        }
    });
}

function showAuthAlert(viewName, msg, isError = true) {
    const alertEl = document.getElementById(`${viewName}-alert`);
    if (!alertEl) return;
    alertEl.innerText = msg;
    alertEl.className = `text-xs font-medium p-2.5 rounded-xl border ${isError ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`;
    alertEl.classList.remove('hidden');
}

// 1. Submit Login
async function submitLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-submit-btn');

    if (!username || !password) return;

    btn.disabled = true;
    btn.innerText = "Authenticating...";

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            authToken = data.token;
            localStorage.setItem('praxis_auth_token', authToken);
            currentUser = data.user;
            updateAuthUI(currentUser);
            closeAuthModal();
        } else {
            showAuthAlert('login', data.error || "Login failed");
        }
    } catch (err) {
        showAuthAlert('login', "Server connection error. Please try again.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Log In";
    }
}

// 2. Submit Sign-Up Request
async function submitSignupRequest(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const mobile = document.getElementById('signup-mobile').value.trim();
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    const btn = document.getElementById('signup-submit-btn');

    btn.disabled = true;
    btn.innerText = "Sending Verification OTP...";

    try {
        const res = await fetch('/api/auth/signup-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, mobile, username, password })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            activeAuthEmail = email.toLowerCase();
            document.getElementById('otp-target-email').innerText = activeAuthEmail;

            // Handle Demo / Console OTP Banner
            const demoBanner = document.getElementById('demo-otp-banner');
            const demoCodeEl = document.getElementById('demo-otp-code');
            if (data.deliveredVia === 'console' || data.warning) {
                if (demoBanner) demoBanner.classList.remove('hidden');
                if (demoCodeEl) demoCodeEl.innerText = data.demoOtp || "(Check server console)";
            } else {
                if (demoBanner) demoBanner.classList.add('hidden');
            }

            switchAuthView('otp');
            startOTPTimers(data.expiresAt, data.cooldownSeconds || 60);
        } else {
            showAuthAlert('signup', data.error || "Sign-up failed");
        }
    } catch (err) {
        showAuthAlert('signup', "Server connection error. Please try again.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Send OTP via Email →";
    }
}

// 3. Submit OTP for Sign-Up Verification
async function submitSignupOTP(e) {
    e.preventDefault();
    const otp = document.getElementById('otp-input').value.trim();
    const btn = document.getElementById('otp-submit-btn');

    if (!otp || otp.length !== 6) {
        showAuthAlert('otp', "Please enter a valid 6-digit OTP code.");
        return;
    }

    btn.disabled = true;
    btn.innerText = "Verifying Code...";

    try {
        const res = await fetch('/api/auth/verify-signup-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: activeAuthEmail, otp })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            authToken = data.token;
            localStorage.setItem('praxis_auth_token', authToken);
            currentUser = data.user;
            updateAuthUI(currentUser);
            closeAuthModal();
            stopOTPTimers();
            alert("🎉 Account created and verified successfully! Welcome to PRAXiS.");
        } else {
            showAuthAlert('otp', data.error || "OTP verification failed");
        }
    } catch (err) {
        showAuthAlert('otp', "Server connection error.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Verify & Create Account";
    }
}

// 4. Resend OTP with 60s cooldown
async function resendOTP() {
    const resendBtn = document.getElementById('resend-otp-btn');
    if (resendBtn) resendBtn.disabled = true;

    try {
        const res = await fetch('/api/auth/resend-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: activeAuthEmail })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            showAuthAlert('otp', "New OTP delivered to your email!", false);
            
            const demoBanner = document.getElementById('demo-otp-banner');
            const demoCodeEl = document.getElementById('demo-otp-code');
            if (data.deliveredVia === 'console' || data.warning) {
                if (demoBanner) demoBanner.classList.remove('hidden');
                if (demoCodeEl) demoCodeEl.innerText = data.demoOtp || "(Check server console)";
            }

            startOTPTimers(data.expiresAt, data.cooldownSeconds || 60);
        } else {
            showAuthAlert('otp', data.error || "Failed to resend OTP.");
        }
    } catch (err) {
        showAuthAlert('otp', "Server connection error.");
    }
}

function startOTPTimers(expiresAt, cooldownSec = 60) {
    stopOTPTimers();

    // 1. Resend Cooldown Ticker (60 seconds)
    const resendBtn = document.getElementById('resend-otp-btn');
    let cooldownRemaining = cooldownSec;

    if (resendBtn) {
        resendBtn.disabled = true;
        resendBtn.innerText = `Resend OTP (${cooldownRemaining}s)`;
    }

    otpCooldownInterval = setInterval(() => {
        cooldownRemaining--;
        if (cooldownRemaining <= 0) {
            clearInterval(otpCooldownInterval);
            if (resendBtn) {
                resendBtn.disabled = false;
                resendBtn.innerText = "Resend OTP Code";
            }
        } else {
            if (resendBtn) resendBtn.innerText = `Resend OTP (${cooldownRemaining}s)`;
        }
    }, 1000);

    // 2. Expiry Timer (10 minutes)
    const timerEl = document.getElementById('otp-expiry-timer');
    otpExpiryInterval = setInterval(() => {
        const remainingMs = expiresAt - Date.now();
        if (remainingMs <= 0) {
            clearInterval(otpExpiryInterval);
            if (timerEl) timerEl.innerText = "OTP Expired";
            showAuthAlert('otp', "This OTP code has expired. Please click Resend OTP.");
        } else {
            const mins = Math.floor(remainingMs / 60000);
            const secs = Math.floor((remainingMs % 60000) / 1000);
            if (timerEl) timerEl.innerText = `Expires in ${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }
    }, 1000);
}

function stopOTPTimers() {
    if (otpCooldownInterval) clearInterval(otpCooldownInterval);
    if (otpExpiryInterval) clearInterval(otpExpiryInterval);
}

// 5. Submit Forgot Password Request
async function submitForgotPasswordRequest(e) {
    e.preventDefault();
    const identifier = document.getElementById('forgot-identifier').value.trim();
    const btn = document.getElementById('forgot-submit-btn');

    if (!identifier) return;

    btn.disabled = true;
    btn.innerText = "Sending Reset OTP...";

    try {
        const res = await fetch('/api/auth/forgot-password-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            activeAuthEmail = data.email;
            
            const demoBanner = document.getElementById('demo-reset-otp-banner');
            const demoCodeEl = document.getElementById('demo-reset-otp-code');
            if (data.deliveredVia === 'console' || data.warning) {
                if (demoBanner) demoBanner.classList.remove('hidden');
                if (demoCodeEl) demoCodeEl.innerText = data.demoOtp || "(Check server console)";
            } else {
                if (demoBanner) demoBanner.classList.add('hidden');
            }

            switchAuthView('reset');
        } else {
            showAuthAlert('forgot', data.error || "Failed to initiate reset.");
        }
    } catch (err) {
        showAuthAlert('forgot', "Server connection error.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Send Reset OTP →";
    }
}

// 6. Submit Reset Password (OTP + New Password)
async function submitResetPassword(e) {
    e.preventDefault();
    const otp = document.getElementById('reset-otp-input').value.trim();
    const newPassword = document.getElementById('reset-new-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;
    const btn = document.getElementById('reset-submit-btn');

    if (newPassword !== confirmPassword) {
        showAuthAlert('reset', "New passwords do not match!");
        return;
    }

    btn.disabled = true;
    btn.innerText = "Updating Password...";

    try {
        // Step A: Verify OTP first
        const vRes = await fetch('/api/auth/verify-reset-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: activeAuthEmail, otp })
        });
        const vData = await vRes.json();

        if (!vRes.ok || !vData.success) {
            showAuthAlert('reset', vData.error || "Invalid OTP code.");
            btn.disabled = false;
            btn.innerText = "Update Password & Log In";
            return;
        }

        // Step B: Set new password
        const rRes = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: activeAuthEmail,
                resetToken: vData.resetToken,
                newPassword
            })
        });
        const rData = await rRes.json();

        if (rRes.ok && rData.success) {
            alert("🔑 Password updated successfully! Please log in with your new password.");
            switchAuthView('login');
        } else {
            showAuthAlert('reset', rData.error || "Failed to update password.");
        }
    } catch (err) {
        showAuthAlert('reset', "Server connection error.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Update Password & Log In";
    }
}

// =====================================================================
// USER PROFILE MODAL & AVATAR PHOTO UPLOAD LOGIC
// =====================================================================
function openProfileModal() {
    if (!currentUser) {
        openAuthModal('login');
        return;
    }
    const modal = document.getElementById('profile-user-modal');
    if (modal) modal.classList.remove('hidden');

    document.getElementById('profile-avatar-display').src = currentUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.username)}`;
    document.getElementById('profile-display-name').innerText = currentUser.name || "User";
    document.getElementById('profile-display-username').innerText = `@${currentUser.username}`;
    document.getElementById('profile-input-name').value = currentUser.name || '';
    document.getElementById('profile-input-mobile').value = currentUser.mobile || '';
    document.getElementById('profile-input-email').value = currentUser.email || '';
    document.getElementById('profile-stat-logins').innerText = currentUser.loginCount || 1;
    document.getElementById('profile-stat-joined').innerText = currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : "Recently";
}

function closeProfileModal() {
    const modal = document.getElementById('profile-user-modal');
    if (modal) modal.classList.add('hidden');
}

async function saveProfileDetails(e) {
    e.preventDefault();
    const name = document.getElementById('profile-input-name').value.trim();
    const mobile = document.getElementById('profile-input-mobile').value.trim();
    const btn = document.getElementById('profile-save-btn');
    const alertEl = document.getElementById('profile-alert');

    btn.disabled = true;
    btn.innerText = "Saving Changes...";

    try {
        const res = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name, mobile })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            currentUser = data.user;
            updateAuthUI(currentUser);
            document.getElementById('profile-display-name').innerText = currentUser.name;
            
            if (alertEl) {
                alertEl.innerText = "✅ Profile updated successfully!";
                alertEl.classList.remove('hidden');
                setTimeout(() => alertEl.classList.add('hidden'), 3000);
            }
        } else {
            alert(data.error || "Failed to update profile.");
        }
    } catch (err) {
        alert("Server connection error.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Profile Changes";
    }
}

// Upload Profile Photo via File Picker (Converts to Base64 & Uploads to Server)
function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert("Please select a valid image file (PNG, JPG, WEBP).");
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert("Image size should be less than 5MB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        const base64Image = e.target.result;
        
        // Optimistically update preview
        document.getElementById('profile-avatar-display').src = base64Image;

        try {
            const res = await fetch('/api/user/upload-photo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ imageBase64: base64Image })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                currentUser = data.user;
                updateAuthUI(currentUser);
                document.getElementById('profile-avatar-display').src = currentUser.avatar;
            } else {
                alert(data.error || "Failed to upload photo.");
            }
        } catch (err) {
            console.error("Photo upload error:", err);
            alert("Error uploading profile photo.");
        }
    };
    reader.readAsDataURL(file);
}

function logoutUser() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('praxis_auth_token');
    updateAuthUI(null);
    closeProfileModal();
}
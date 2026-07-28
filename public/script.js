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
        btn.className = `neu-btn w-full text-left p-5 font-semibold text-slate-700 hover:text-blue-600 transition-all duration-300 fade-in flex items-center justify-between group`;
        btn.style.animationDelay = `${index * 80}ms`; 
        
        btn.innerHTML = `
            <span class="text-sm md:text-base pr-4">${option.text}</span>
            <div class="w-8 h-8 neu-circle flex items-center justify-center text-slate-400 group-hover:text-blue-600 shrink-0 group-hover:translate-x-1 transition-all">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        const cardClass = isTopMatch ? "neu-highlight p-6 text-left relative overflow-hidden group" : "neu-btn p-6 text-left relative overflow-hidden group";
        const badgeHTML = isTopMatch ? `<div class="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black px-4 py-1.5 rounded-bl-2xl shadow-md tracking-widest font-outfit uppercase">TOP MATCH</div>` : "";

        card.className = `${cardClass} fade-in w-full transition-all duration-300`;
        card.style.animationDelay = `${index * 120}ms`;
        
        card.innerHTML = `
            ${badgeHTML}
            <div class="w-14 h-14 neu-circle flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                ${match.icon}
            </div>
            <h3 class="text-xl font-black text-slate-800 mb-2 font-outfit group-hover:text-blue-600 transition-colors">${match.title}</h3>
            <p class="text-xs font-bold text-blue-600 uppercase tracking-widest mt-4 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
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
            <div class="absolute -left-[33px] top-4 w-4 h-4 neu-circle-pressed flex items-center justify-center">
                <div class="w-2 h-2 rounded-full bg-blue-600"></div>
            </div>
            <div class="neu-card-sm p-6">
                <h4 class="font-black text-blue-600 text-base mb-2 font-outfit tracking-wide">${phase.title}</h4>
                <p class="text-sm font-medium text-slate-600 leading-relaxed">${phase.steps}</p>
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
function calculateHabitStreak(days) {
    let maxStreak = 0;
    let currentStreak = 0;
    let temp = 0;

    for (let i = 0; i < days.length; i++) {
        if (days[i]) {
            temp++;
            if (temp > maxStreak) maxStreak = temp;
        } else {
            temp = 0;
        }
    }

    // Active streak up to last checked day
    let lastCheckedIndex = -1;
    for (let i = days.length - 1; i >= 0; i--) {
        if (days[i]) {
            lastCheckedIndex = i;
            break;
        }
    }
    if (lastCheckedIndex !== -1) {
        for (let i = lastCheckedIndex; i >= 0; i--) {
            if (days[i]) {
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
            if (h.days && h.days[day]) completedCount++;
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
    let totalCheckedDays = 0;
    let highestStreakAcrossAll = 0;

    habits.forEach(h => {
        const checkedCount = h.days.filter(Boolean).length;
        totalCheckedDays += checkedCount;
        const streak = calculateHabitStreak(h.days);
        if (streak > highestStreakAcrossAll) highestStreakAcrossAll = streak;
    });

    const totalPossibleChecks = totalHabitsCount * 30;
    const overallPercentage = totalPossibleChecks > 0 
        ? Math.round((totalCheckedDays / totalPossibleChecks) * 100) 
        : 0;

    // SVG Circle calculation (r = 40, circumference = ~251.327)
    if (overallCircle) {
        const circumference = 251.327;
        const offset = circumference - (overallPercentage / 100) * circumference;
        overallCircle.style.strokeDashoffset = offset;
    }

    if (overallPercentText) overallPercentText.innerText = `${overallPercentage}%`;
    if (statHabits) statHabits.innerText = totalHabitsCount;
    if (statChecks) statChecks.innerText = totalCheckedDays;
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

// RENDER TIME-OF-DAY CATEGORIZED HABITS LIST & 30-DAY GRID
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
    container.innerHTML = "";

    // Categories definition
    const categories = [
        { key: "Morning Routine", title: "Morning Routine", icon: "🌅", colorClass: "text-amber-600 bg-amber-500/10" },
        { key: "Afternoon Focus", title: "Afternoon Focus", icon: "☀️", colorClass: "text-blue-600 bg-blue-500/10" },
        { key: "Evening Wind-down", title: "Evening Wind-down", icon: "🌙", colorClass: "text-indigo-600 bg-indigo-500/10" }
    ];

    const activeCategories = currentCategoryFilter === "all" 
        ? categories 
        : categories.filter(c => c.key === currentCategoryFilter);

    let renderedAnyHabits = false;

    activeCategories.forEach(cat => {
        const catHabits = habits.filter(h => (h.timeOfDay || "Morning Routine") === cat.key);

        if (catHabits.length === 0 && currentCategoryFilter !== "all") {
            // Show category empty notice when specific tab selected
            const emptyCat = document.createElement("div");
            emptyCat.className = "neu-card p-6 text-center text-xs font-bold text-slate-500";
            emptyCat.innerHTML = `${cat.icon} No habits currently defined under <strong>${cat.title}</strong>. Add one above!`;
            container.appendChild(emptyCat);
            return;
        }

        if (catHabits.length === 0) return; // Skip empty category in "all" view

        renderedAnyHabits = true;

        // Category Header Section
        const section = document.createElement("div");
        section.className = "space-y-4";
        section.innerHTML = `
            <div class="flex items-center justify-between pb-2 border-b border-slate-300/40">
                <div class="flex items-center gap-2">
                    <span class="text-lg">${cat.icon}</span>
                    <h4 class="text-base font-black text-slate-800 font-outfit">${cat.title}</h4>
                    <span class="neu-badge px-2.5 py-0.5 text-[10px] font-extrabold ${cat.colorClass}">
                        ${catHabits.length} ${catHabits.length === 1 ? 'Habit' : 'Habits'}
                    </span>
                </div>
            </div>
            <div id="cat-group-${cat.key.replace(/\s+/g, '-').toLowerCase()}" class="space-y-4"></div>
        `;

        container.appendChild(section);
        const groupContainer = section.querySelector(`#cat-group-${cat.key.replace(/\s+/g, '-').toLowerCase()}`);

        catHabits.forEach(habit => {
            const habitIndex = habits.indexOf(habit);
            const checkedCount = habit.days.filter(Boolean).length;
            const habitPercentage = Math.round((checkedCount / 30) * 100);
            const streak = calculateHabitStreak(habit.days);

            const card = document.createElement("div");
            card.className = "neu-card p-6 relative group transition-all duration-300";

            // Streak Engine Badge HTML
            let streakBadgeHTML = "";
            if (streak >= 3) {
                streakBadgeHTML = `
                    <div class="neu-badge px-3 py-1 bg-amber-500/10 text-amber-600 font-extrabold text-xs flex items-center gap-1.5 flame-badge">
                        <span class="text-sm">🔥</span> ${streak} Day Streak!
                    </div>
                `;
            } else if (streak > 0) {
                streakBadgeHTML = `
                    <div class="neu-badge px-3 py-1 text-slate-500 font-bold text-xs flex items-center gap-1">
                        <span>⚡</span> ${streak} Day Streak
                    </div>
                `;
            }

            // Category Badge HTML for card
            const catBadgeHTML = `
                <span class="neu-badge px-2.5 py-1 text-[10px] font-bold text-slate-600 flex items-center gap-1">
                    ${cat.icon} ${cat.title}
                </span>
            `;

            // 30-Day Grid Buttons
            let gridHTML = `<div class="grid grid-cols-6 sm:grid-cols-10 gap-2 my-4">`;
            for (let day = 0; day < 30; day++) {
                const isChecked = habit.days[day];
                const checkedClass = isChecked ? "checked" : "";
                gridHTML += `
                    <button type="button" 
                        onclick="toggleHabitDay(${habitIndex}, ${day})"
                        title="Day ${day + 1}: ${isChecked ? 'Completed' : 'Pending'}"
                        class="neu-day-btn ${checkedClass}">
                        ${isChecked ? '✓' : day + 1}
                    </button>
                `;
            }
            gridHTML += `</div>`;

            card.innerHTML = `
                <!-- HEADER -->
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 neu-circle flex items-center justify-center text-blue-600 font-black text-sm shrink-0">
                            📌
                        </div>
                        <div>
                            <h4 class="text-lg font-black text-slate-800 font-outfit">${escapeHtml(habit.name)}</h4>
                        </div>
                        ${catBadgeHTML}
                        ${streakBadgeHTML}
                    </div>
                    <button onclick="deleteHabit(${habitIndex})" title="Delete Habit" 
                        class="text-xs font-bold text-slate-400 hover:text-red-600 transition-colors neu-badge px-3 py-1.5 flex items-center gap-1">
                        🗑️ Delete
                    </button>
                </div>

                <!-- 30-DAY GRID -->
                ${gridHTML}

                <!-- DAILY GROWTH PROGRESS BAR FOR THIS SPECIFIC HABIT -->
                <div class="pt-2 border-t border-slate-300/60 flex items-center justify-between gap-4">
                    <div class="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <span class="uppercase tracking-wider text-[10px] text-slate-400 font-extrabold">Habit Growth:</span>
                        <span>${checkedCount} / 30 Days</span>
                    </div>
                    <div class="flex-1 max-w-xs neu-trench h-3 overflow-hidden p-0.5">
                        <div class="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500 ease-out" 
                            style="width: ${habitPercentage}%"></div>
                    </div>
                    <span class="text-xs font-black text-blue-600 font-outfit min-w-[36px] text-right">${habitPercentage}%</span>
                </div>
            `;

            groupContainer.appendChild(card);
        });
    });

    if (!renderedAnyHabits && currentCategoryFilter === "all") {
        blankSlate.classList.remove("hidden");
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
    if (!input) return;

    const name = input.value.trim();
    if (!name) return;

    const timeOfDay = timeSelect ? timeSelect.value : "Morning Routine";

    const newHabit = {
        id: "habit_" + Date.now(),
        name: name,
        timeOfDay: timeOfDay,
        days: new Array(30).fill(false),
        createdAt: Date.now()
    };

    habits.unshift(newHabit);
    saveHabitsToStorage();
    input.value = "";
    
    renderHabitsList();
    updateGrowthCharts();
}

function toggleHabitDay(habitIndex, dayIndex) {
    if (habits[habitIndex] && habits[habitIndex].days) {
        habits[habitIndex].days[dayIndex] = !habits[habitIndex].days[dayIndex];
        saveHabitsToStorage();
        renderHabitsList();
        updateGrowthCharts();
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
    }
});

// INITIALIZE TRACKER ON LOAD
document.addEventListener("DOMContentLoaded", () => {
    loadHabitsFromStorage();
});
loadHabitsFromStorage();
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
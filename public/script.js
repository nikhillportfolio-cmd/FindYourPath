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

// DOM ELEMENTS - RESULTS VIEWS
const matchesOverview = document.getElementById("matches-overview");
const careerDetails = document.getElementById("career-details");

// SCROLL REVEAL ANIMATION LOGIC
function reveal() {
    var reveals = document.querySelectorAll(".reveal");
    for (var i = 0; i < reveals.length; i++) {
        var windowHeight = window.innerHeight;
        var elementTop = reveals[i].getBoundingClientRect().top;
        var elementVisible = 150; 
        if (elementTop < windowHeight - elementVisible) {
            reveals[i].classList.add("active");
        }
    }
}
window.addEventListener("scroll", reveal);
reveal();

// 2. TRANSITION LOGIC
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
    }, 500); 
}

// 3. FETCH QUESTIONS
async function loadQuestions() {
    try {
        const response = await fetch(`/api/questions?interest=${userInterest}`);
        questions = await response.json();
        renderQuestion();
    } catch (error) {
        questionText.innerText = "Error pulling custom question tree. Is the server active?";
    }
}

// 4. RENDER DYNAMIC CARD
function renderQuestion() {
    const progress = (currentIndex / questions.length) * 100;
    progressBar.style.width = `${progress}%`;
    optionsContainer.innerHTML = "";

    const q = questions[currentIndex];
    questionText.innerText = q.text;

    q.options.forEach((option, index) => {
        const btn = document.createElement("button");
        btn.innerText = option.text;
        btn.className = `w-full text-left p-5 glass-card border border-slate-700 rounded-2xl hover:border-sky-400 hover:bg-slate-800 hover:shadow-[0_0_15px_rgba(56,189,248,0.15)] hover:-translate-y-1 font-semibold text-slate-200 hover:text-sky-300 transition-all duration-300 fade-in`;
        btn.style.animationDelay = `${index * 100}ms`; 
        btn.onclick = () => handleAnswer(option.tags);
        optionsContainer.appendChild(btn);
    });
}

// 5. COMPILE TRAITS & INSTANTLY FETCH RESULTS
function handleAnswer(tags) {
    // Accumulate traits
    for (const [trait, points] of Object.entries(tags)) {
        userTraits[trait] = (userTraits[trait] || 0) + points;
    }
    currentIndex++;
    
    if (currentIndex < questions.length) {
        renderQuestion();
    } else {
        // Quiz complete - snap progress bar to 100% and fetch results instantly
        progressBar.style.width = "100%";
        quizSection.classList.add("hidden");
        fetchResults(); 
    }
}

// 6. FETCH RESULTS FROM API (No Input Box Needed)
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

// 7. RENDER OVERVIEW (GRID OF MATCHES)
function showResultsOverview() {
    resultSection.classList.remove("hidden");
    resultSection.classList.add("slide-up");

    const grid = document.getElementById("matches-grid");
    grid.innerHTML = ""; 

    globalMatches.forEach((match, index) => {
        const card = document.createElement("button");
        
        let borderClass = index === 0 ? "border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.2)]" : "border-slate-700 hover:border-indigo-400";
        let badgeHTML = index === 0 ? `<div class="absolute top-0 right-0 bg-gradient-to-r from-sky-400 to-indigo-500 text-white text-[10px] font-extrabold px-4 py-1 rounded-bl-xl shadow-md tracking-wider">TOP MATCH</div>` : "";

        card.className = `relative w-full text-left p-6 glass-card border rounded-2xl hover:bg-slate-800 hover:-translate-y-1 transition-all duration-300 fade-in overflow-hidden ${borderClass}`;
        card.style.animationDelay = `${index * 150}ms`;
        
        card.innerHTML = `
            ${badgeHTML}
            <div class="text-4xl mb-4">${match.icon}</div>
            <h3 class="text-xl font-bold text-slate-100 mb-2">${match.title}</h3>
            <p class="text-xs font-bold text-sky-400 uppercase tracking-widest mt-4">View Roadmap &rarr;</p>
        `;
        
        card.onclick = () => showCareerDetails(index);
        grid.appendChild(card);
    });
}

// 8. RENDER DETAILED VIEW
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
        phaseDiv.className = "glass-card p-5 rounded-2xl shadow-lg border border-slate-700 border-l-4 border-l-sky-400 fade-in hover:bg-slate-800 transition-colors";
        phaseDiv.style.animationDelay = `${i * 100}ms`;
        phaseDiv.innerHTML = `
            <h4 class="font-extrabold text-sky-400 text-base mb-2 tracking-wide">${phase.title}</h4>
            <p class="text-sm font-medium text-slate-300 leading-relaxed">${phase.steps}</p>
        `;
        roadmapContainer.appendChild(phaseDiv);
    });

    const booksContainer = document.getElementById("detail-books");
    booksContainer.innerHTML = "";
    if (match.books && match.books.length > 0) {
        match.books.forEach((book, i) => {
            const li = document.createElement("li");
            li.className = "flex items-center gap-4 glass-card p-4 rounded-xl border border-slate-700 shadow-sm fade-in hover:border-indigo-400 transition-colors";
            li.style.animationDelay = `${(match.phases.length * 100) + (i * 100)}ms`;
            li.innerHTML = `
                <div class="text-2xl opacity-80">📖</div>
                <span class="font-semibold text-slate-200">${book}</span>
            `;
            booksContainer.appendChild(li);
        });
    } else {
        booksContainer.innerHTML = "<p class='text-slate-500 text-sm'>Start with general industry research on this path!</p>";
    }
}

// 9. BACK BUTTON FUNCTION
function backToMatches() {
    careerDetails.classList.add("hidden");
    matchesOverview.classList.remove("hidden");
}
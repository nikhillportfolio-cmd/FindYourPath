// 1. STATE MANAGEMENT
let questions = [];
let currentIndex = 0;
let userInterest = ""; 
let userTraits = {}; 
let globalMatches = []; // Store matches globally so we can click them!

// DOM ELEMENTS - MAIN VIEWS
const landingIntro = document.getElementById("landing-intro");
const appWrapper = document.getElementById("app-wrapper");
const interestSection = document.getElementById("interest-section");
const quizSection = document.getElementById("quiz-section");
const resultSection = document.getElementById("result-section");
const questionText = document.getElementById("question-text");
const optionsContainer = document.getElementById("options-container");
const progressBar = document.getElementById("progress-bar");

// DOM ELEMENTS - AI SECTION (NEW)
const aiInputSection = document.getElementById("ai-input-section");
const studentTextInput = document.getElementById("student-text");
const generateBtn = document.getElementById("generate-btn");
const loadingSpinner = document.getElementById("loading-spinner");

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
        questionText.innerText = "Error pulling custom question tree. Is server active?";
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
        btn.className = `w-full text-left p-5 bg-white border-2 border-indigo-50 rounded-2xl hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-100/50 hover:-translate-y-1 font-semibold text-slate-700 hover:text-indigo-700 transition-all duration-300 fade-in`;
        btn.style.animationDelay = `${index * 100}ms`; 
        btn.onclick = () => handleAnswer(option.tags);
        optionsContainer.appendChild(btn);
    });
}

// 5. COMPILE TRAITS & SHOW AI INPUT (UPDATED)
function handleAnswer(tags) {
    for (const [trait, points] of Object.entries(tags)) {
        userTraits[trait] = (userTraits[trait] || 0) + points;
    }
    currentIndex++;
    
    if (currentIndex < questions.length) {
        renderQuestion();
    } else {
        progressBar.style.width = "100%";
        
        // Instead of fetching results directly, we slide up the AI Input box!
        setTimeout(() => {
            quizSection.classList.add("hidden");
            aiInputSection.classList.remove("hidden");
            aiInputSection.classList.add("slide-up");
        }, 400);
    }
}

// 6. TRIGGER AI GENERATION (NEW)
function triggerAI() {
    const studentInputText = studentTextInput.value.trim();
    if (studentInputText === "") {
        alert("Please write a few words so the AI can personalize your roadmap!");
        return;
    }

    // Show loading spinner while AI thinks
    generateBtn.classList.add("hidden");
    loadingSpinner.classList.remove("hidden");

    // Now we fetch the results, passing the student's text
    fetchResults(studentInputText);
}

// 7. FETCH RESULTS FROM GEMINI (UPDATED WITH ERROR HANDLING)
async function fetchResults(studentInputText) {
    try {
        const payload = { 
            userTraits: userTraits, 
            interest: userInterest,
            studentInput: studentInputText 
        };
        
        const response = await fetch('/api/calculate-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) 
        });
        
        // Parse the response body
        const data = await response.json(); 
        
        // NEW: Check if the server sent an error status (like 500 or 400)
        if (!response.ok) {
            throw new Error(data.error || "The server encountered an issue.");
        }

        // If successful, assign the array and move forward
        globalMatches = data; 
        
        // Hide AI section and show Results Grid
        aiInputSection.classList.add("hidden");
        showResultsOverview();

    } catch (error) {
        console.error("AI Generation failed:", error);
        
        // Show a more specific alert based on the caught error
        alert(`Oops! ${error.message} Please try again.`);
        
        // Reset the UI so they can try again
        generateBtn.classList.remove("hidden");
        loadingSpinner.classList.add("hidden");
    }
}

// 8. RENDER OVERVIEW (GRID OF 4 MATCHES)
function showResultsOverview() {
    resultSection.classList.remove("hidden");
    resultSection.classList.add("slide-up");

    const grid = document.getElementById("matches-grid");
    grid.innerHTML = ""; 

    globalMatches.forEach((match, index) => {
        const card = document.createElement("button");
        
        let borderClass = index === 0 ? "border-amber-400 shadow-amber-100" : "border-indigo-50 hover:border-indigo-400";
        let badgeHTML = index === 0 ? `<div class="absolute top-0 right-0 bg-amber-400 text-white text-[10px] font-extrabold px-3 py-1 rounded-bl-xl shadow-sm">TOP MATCH</div>` : "";

        card.className = `relative w-full text-left p-5 bg-white border-2 rounded-2xl hover:shadow-lg hover:-translate-y-1 transition-all duration-300 fade-in ${borderClass}`;
        card.style.animationDelay = `${index * 150}ms`;
        
        card.innerHTML = `
            ${badgeHTML}
            <div class="text-4xl mb-3">${match.icon}</div>
            <h3 class="text-xl font-bold text-slate-800 mb-1">${match.title}</h3>
            <p class="text-xs font-medium text-indigo-500 uppercase tracking-widest mb-2">View Roadmap &rarr;</p>
        `;
        
        card.onclick = () => showCareerDetails(index);
        grid.appendChild(card);
    });
}

// 9. RENDER DETAILED VIEW (ROADMAP + BOOKS)
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
        phaseDiv.className = "bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-indigo-400 fade-in";
        phaseDiv.style.animationDelay = `${i * 100}ms`;
        phaseDiv.innerHTML = `
            <h4 class="font-extrabold text-indigo-600 text-base mb-1">${phase.title}</h4>
            <p class="text-sm font-medium text-slate-600">${phase.steps}</p>
        `;
        roadmapContainer.appendChild(phaseDiv);
    });

    const booksContainer = document.getElementById("detail-books");
    booksContainer.innerHTML = "";
    if (match.books && match.books.length > 0) {
        match.books.forEach((book, i) => {
            const li = document.createElement("li");
            li.className = "flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm fade-in";
            li.style.animationDelay = `${(match.phases.length * 100) + (i * 100)}ms`;
            li.innerHTML = `
                <div class="text-2xl">📖</div>
                <span class="font-bold text-slate-700">${book}</span>
            `;
            booksContainer.appendChild(li);
        });
    } else {
        booksContainer.innerHTML = "<p class='text-slate-500 text-sm'>Start with general industry research on this path!</p>";
    }
}

// 10. BACK BUTTON FUNCTION
function backToMatches() {
    careerDetails.classList.add("hidden");
    matchesOverview.classList.remove("hidden");
}
// 1. STATE MANAGEMENT
let questions = [];
let currentIndex = 0;
let userInterest = ""; 
let userTraits = {}; 

// DOM ELEMENTS
const interestSection = document.getElementById("interest-section");
const quizSection = document.getElementById("quiz-section");
const resultSection = document.getElementById("result-section");
const questionText = document.getElementById("question-text");
const optionsContainer = document.getElementById("options-container");
const progressBar = document.getElementById("progress-bar");

// 2. TRANSITION LOGIC
function startQuiz(interest) {
    userInterest = interest; 
    interestSection.classList.remove("fade-in");
    interestSection.classList.add("fade-out");

    setTimeout(() => {
        interestSection.classList.add("hidden");
        quizSection.classList.remove("hidden");
        quizSection.classList.add("slide-up");
        loadQuestions(); 
    }, 400); 
}

// 3. FETCH QUESTIONS
async function loadQuestions() {
    try {
        const response = await fetch(`http://localhost:3000/api/questions?interest=${userInterest}`);
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
        btn.className = `w-full text-left p-4 bg-slate-800 border-2 border-slate-700 rounded-xl hover:border-teal-500 hover:bg-slate-700 font-semibold text-slate-200 transition-all duration-200 fade-in`;
        btn.style.animationDelay = `${index * 100}ms`; 
        
        btn.onclick = () => handleAnswer(option.tags);
        optionsContainer.appendChild(btn);
    });
}

// 5. COMPILE TRAITS
function handleAnswer(tags) {
    for (const [trait, points] of Object.entries(tags)) {
        userTraits[trait] = (userTraits[trait] || 0) + points;
    }
    
    currentIndex++;

    if (currentIndex < questions.length) {
        renderQuestion();
    } else {
        progressBar.style.width = "100%";
        setTimeout(fetchResults, 400);
    }
}

// 6. BUG FIX: SEND BOTH TRAITS AND INTEREST TO SERVER
async function fetchResults() {
    try {
        const payload = { 
            userTraits: userTraits,
            interest: userInterest // We are now sending this so the server can filter!
        };

        const response = await fetch('/api/calculate-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) 
        });
        
        const matchesArray = await response.json();
        showResults(matchesArray);
    } catch (error) {
        console.error("Failed mathematical matrix evaluation.", error);
    }
}

// 7. RENDER COMPREHENSIVE ROADMAP
function showResults(matches) {
    quizSection.classList.add("hidden");
    resultSection.classList.remove("hidden");
    resultSection.classList.add("slide-up");

    const primaryMatch = matches[0];
    const secondaryMatch = matches[1];

    // Populate Top Match
    document.getElementById("primary-title").innerText = primaryMatch.icon + " " + primaryMatch.title;
    document.getElementById("primary-desc").innerText = primaryMatch.desc;

    const phasesContainer = document.getElementById("roadmap-phases");
    phasesContainer.innerHTML = ""; 
    
    primaryMatch.phases.forEach((phase, index) => {
        const cardDiv = document.createElement("div");
        cardDiv.className = "bg-slate-800 p-4 rounded-xl shadow border border-slate-700 fade-in";
        cardDiv.style.animationDelay = `${index * 150}ms`;

        cardDiv.innerHTML = `
            <h4 class="font-bold text-teal-400 text-sm mb-1">${phase.title}</h4>
            <p class="text-sm text-slate-300">${phase.steps}</p>
        `;
        phasesContainer.appendChild(cardDiv);
    });

    // Populate "Also Consider" Match if it exists
    if (secondaryMatch) {
        document.getElementById("secondary-icon").innerText = secondaryMatch.icon;
        document.getElementById("secondary-title").innerText = secondaryMatch.title;
        document.getElementById("secondary-desc").innerText = secondaryMatch.desc;
    }
}
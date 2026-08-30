/**
 * PRAXiS Communication Coach UI Controller
 * Manages UI states, user interactions, speech diagnostics rendering,
 * session history, timer, and accessibility.
 */

(function (root) {
    'use strict';

    // State Variables
    let recognitionManager = null;
    let currentTrack = 'express';
    let allTopics = {};
    let currentTopic = null;
    let timerInterval = null;
    let timerDuration = 60;
    let timeRemaining = 60;
    let isTimerRunning = false;
    let currentState = 'READY'; // READY, LISTENING, PROCESSING, ANALYZING, COMPLETE, ERROR
    let activeEvaluation = null;

    const STORAGE_KEY_SESSIONS = 'praxis_speech_sessions_v2';

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', async () => {
        initUI();
        await fetchTopics();
        initSpeechEngine();
        loadSessionHistory();
    });

    function initUI() {
        updateWordCount();
        setTimerDuration(60);

        // Bind input textarea
        const transcriptArea = document.getElementById('speech-transcript-input');
        if (transcriptArea) {
            transcriptArea.addEventListener('input', () => {
                updateWordCount();
                if (recognitionManager) {
                    recognitionManager.setTranscript(transcriptArea.value);
                }
            });
        }
    }

    // =========================================================================
    // 1. SPEECH RECOGNITION SETUP
    // =========================================================================
    function initSpeechEngine() {
        const SpeechRecognitionManager = window.SpeechRecognitionManager;
        if (!SpeechRecognitionManager) {
            console.warn("SpeechRecognitionManager not loaded.");
            return;
        }

        recognitionManager = new SpeechRecognitionManager({
            lang: 'en-US',
            onTranscriptUpdate: (data) => {
                const transcriptArea = document.getElementById('speech-transcript-input');
                if (transcriptArea) {
                    transcriptArea.value = data.fullTranscript;
                    updateWordCount();
                }
            },
            onStateChange: (state, payload) => {
                setUIState(state, payload);
            },
            onError: (friendlyMsg, errorType) => {
                showToast(friendlyMsg, "⚠️");
                setUIState('ERROR', { message: friendlyMsg });
            }
        });
    }

    // =========================================================================
    // 2. UI STATE MANAGEMENT
    // =========================================================================
    function setUIState(state, payload = {}) {
        currentState = state;
        const micBtn = document.getElementById('btn-record-mic');
        const micStatus = document.getElementById('mic-status-label');
        const soundwave = document.getElementById('soundwave-container');
        const evalBtn = document.getElementById('btn-evaluate');

        switch (state) {
            case 'READY':
            case 'STOPPED':
                if (micBtn) {
                    micBtn.classList.remove('mic-recording-pulse', 'text-red-600', 'bg-red-50');
                    micBtn.classList.add('text-slate-700');
                    micBtn.setAttribute('aria-label', 'Start Microphone Recording');
                }
                if (micStatus) micStatus.innerText = "Click Mic to Record Voice";
                if (soundwave) soundwave.classList.add('hidden');
                if (evalBtn) evalBtn.disabled = false;
                break;

            case 'LISTENING':
                if (micBtn) {
                    micBtn.classList.add('mic-recording-pulse', 'text-red-600', 'bg-red-50');
                    micBtn.classList.remove('text-slate-700');
                    micBtn.setAttribute('aria-label', 'Stop Microphone Recording');
                }
                if (micStatus) micStatus.innerText = "Listening... Speak naturally!";
                if (soundwave) soundwave.classList.remove('hidden');
                if (!isTimerRunning) {
                    startTimer();
                }
                break;

            case 'PROCESSING':
            case 'ANALYZING':
                if (soundwave) soundwave.classList.add('hidden');
                if (micStatus) micStatus.innerText = "Analyzing speech patterns...";
                if (evalBtn) {
                    evalBtn.disabled = true;
                    evalBtn.innerHTML = `<span>⏳</span> Analyzing...`;
                }
                break;

            case 'COMPLETE':
                if (evalBtn) {
                    evalBtn.disabled = false;
                    evalBtn.innerHTML = `<span>⚡</span> Get Speech Diagnostics`;
                }
                if (micStatus) micStatus.innerText = "Analysis Complete! Review below.";
                break;

            case 'ERROR':
                if (micBtn) {
                    micBtn.classList.remove('mic-recording-pulse', 'text-red-600', 'bg-red-50');
                }
                if (soundwave) soundwave.classList.add('hidden');
                if (micStatus) micStatus.innerText = payload.message || "Microphone ready (Click to record)";
                if (evalBtn) {
                    evalBtn.disabled = false;
                    evalBtn.innerHTML = `<span>⚡</span> Get Speech Diagnostics`;
                }
                break;
        }
    }

    // =========================================================================
    // 3. TOPIC & PROMPT HANDLING
    // =========================================================================
    async function fetchTopics() {
        try {
            const res = await fetch('/api/coach/topics');
            const data = await res.json();
            if (data.success && data.topics) {
                allTopics = data.topics;
                shuffleTopic();
            }
        } catch (err) {
            console.warn("Using fallback local topics:", err);
            allTopics = getFallbackTopics();
            shuffleTopic();
        }
    }

    function selectTrack(track) {
        currentTrack = track;
        document.querySelectorAll('.track-tab-btn').forEach(btn => {
            btn.classList.remove('pressed', 'text-blue-600', 'border', 'border-blue-300');
            btn.classList.add('text-slate-700');
        });
        const activeBtn = document.getElementById(`tab-${track}`);
        if (activeBtn) {
            activeBtn.classList.add('pressed', 'text-blue-600', 'border', 'border-blue-300');
            activeBtn.classList.remove('text-slate-700');
        }
        shuffleTopic();
    }

    function shuffleTopic() {
        const trackList = allTopics[currentTrack] || allTopics['express'] || [];
        if (trackList.length === 0) return;
        const randomIndex = Math.floor(Math.random() * trackList.length);
        currentTopic = trackList[randomIndex];

        const titleEl = document.getElementById('topic-title');
        const promptEl = document.getElementById('topic-prompt');
        const badgeEl = document.getElementById('topic-category-badge');
        const frameworkEl = document.getElementById('framework-desc');

        if (titleEl) titleEl.innerText = currentTopic.title;
        if (promptEl) promptEl.innerText = `"${currentTopic.prompt}"`;
        if (badgeEl) badgeEl.innerText = currentTopic.category || currentTrack.toUpperCase();
        if (frameworkEl) frameworkEl.innerText = currentTopic.framework || currentTopic.focus || "PREP (Point ➔ Reason ➔ Example ➔ Point)";

        if (currentTopic.duration) {
            setTimerDuration(currentTopic.duration);
        }
    }

    // =========================================================================
    // 4. MICROPHONE TOGGLE & RECORDING
    // =========================================================================
    function toggleMicRecording() {
        if (!recognitionManager || !recognitionManager.isSupported) {
            showToast("Web Speech API is not supported in this browser. Please type or paste your transcript directly.", "ℹ️");
            return;
        }

        if (recognitionManager.isRecording) {
            recognitionManager.stop();
            pauseTimer();
        } else {
            const initialText = document.getElementById('speech-transcript-input').value;
            const started = recognitionManager.start(initialText);
            if (started) {
                if (!isTimerRunning) {
                    startTimer();
                }
            }
        }
    }

    function clearTranscript() {
        if (recognitionManager) {
            recognitionManager.reset();
        }
        const transcriptArea = document.getElementById('speech-transcript-input');
        if (transcriptArea) {
            transcriptArea.value = '';
        }
        updateWordCount();
        resetTimer();
        showToast("Transcript cleared.", "🗑️");
    }

    function updateWordCount() {
        const transcriptArea = document.getElementById('speech-transcript-input');
        const text = transcriptArea ? transcriptArea.value.trim() : '';
        const wordCount = text ? (window.TranscriptProcessor ? window.TranscriptProcessor.extractWordCount(text) : text.split(/\s+/).length) : 0;
        const badge = document.getElementById('word-count-badge');
        if (badge) {
            badge.innerText = `${wordCount} words`;
        }
    }

    // =========================================================================
    // 5. TIMER CONTROLS
    // =========================================================================
    function setTimerDuration(seconds) {
        timerDuration = seconds;
        timeRemaining = seconds;
        updateTimerDisplay();

        // Update active preset button styling
        document.querySelectorAll('.timer-preset-btn').forEach(btn => {
            btn.classList.remove('text-blue-600', 'border', 'border-blue-300');
            btn.classList.add('text-slate-600');
        });
    }

    function updateTimerDisplay() {
        const mins = Math.floor(timeRemaining / 60);
        const secs = timeRemaining % 60;
        const display = document.getElementById('timer-display');
        if (display) {
            display.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        const pct = (timeRemaining / timerDuration) * 100;
        const progress = document.getElementById('timer-progress-bar');
        if (progress) {
            progress.style.width = `${pct}%`;
        }
    }

    function startTimer() {
        if (isTimerRunning) return;
        isTimerRunning = true;
        const btn = document.getElementById('btn-toggle-timer');
        if (btn) btn.innerText = "⏸ Pause";

        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (timeRemaining > 0) {
                timeRemaining--;
                updateTimerDisplay();
            } else {
                pauseTimer();
                if (recognitionManager && recognitionManager.isRecording) {
                    recognitionManager.stop();
                }
                showToast("⏱️ Time's up! Ready to analyze your speech.", "🔔");
            }
        }, 1000);
    }

    function pauseTimer() {
        clearInterval(timerInterval);
        isTimerRunning = false;
        const btn = document.getElementById('btn-toggle-timer');
        if (btn) btn.innerText = "▶ Resume";
    }

    function toggleTimer() {
        if (isTimerRunning) {
            pauseTimer();
        } else {
            startTimer();
        }
    }

    function resetTimer() {
        pauseTimer();
        timeRemaining = timerDuration;
        const btn = document.getElementById('btn-toggle-timer');
        if (btn) btn.innerText = "▶ Start";
        updateTimerDisplay();
    }

    // =========================================================================
    // 6. SPEECH EVALUATION DISPATCH (DETERMINISTIC DIAGNOSTICS)
    // =========================================================================
    async function submitSpeechForEvaluation() {
        const transcriptArea = document.getElementById('speech-transcript-input');
        const transcript = transcriptArea ? transcriptArea.value.trim() : '';

        if (!transcript) {
            showToast("Please speak into the microphone or enter a speech transcript first.", "⚠️");
            return;
        }

        // Stop microphone if running
        if (recognitionManager && recognitionManager.isRecording) {
            recognitionManager.stop();
        }
        pauseTimer();

        setUIState('ANALYZING');

        const durationSpent = recognitionManager && recognitionManager.getDurationSeconds() > 0
            ? recognitionManager.getDurationSeconds()
            : Math.max(5, timerDuration - timeRemaining);

        // Execute local deterministic speech diagnostic engine
        const SpeechDiagnostics = window.SpeechDiagnostics;
        let evaluationResult = null;

        if (SpeechDiagnostics && typeof SpeechDiagnostics.analyzeSpeech === 'function') {
            evaluationResult = SpeechDiagnostics.analyzeSpeech({
                transcript,
                duration: durationSpent,
                topic: currentTopic ? currentTopic.prompt : '',
                targetStructure: currentTopic?.framework || 'PREP'
            });
        }

        // Also optionally notify backend to save to SQLite database
        try {
            const currentUser = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
            const userEmail = currentUser ? currentUser.email : 'guest@praxis.app';

            fetch('/api/coach/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript,
                    mode: currentTrack,
                    topic: currentTopic ? currentTopic.title : '',
                    timeSpentSeconds: durationSpent,
                    userEmail
                })
            }).catch(e => console.warn("Backend logging skipped:", e));
        } catch (e) {}

        if (evaluationResult) {
            activeEvaluation = evaluationResult;
            renderEvaluationDashboard(evaluationResult, transcript);
            saveSessionToHistory(evaluationResult, transcript);
            showToast("Speech evaluated successfully!", "✅");
            setUIState('COMPLETE');
        } else {
            showToast("Failed to analyze speech. Please try again.", "❌");
            setUIState('ERROR', { message: "Evaluation failed" });
        }
    }

    // =========================================================================
    // 7. RENDER RESULTS DASHBOARD (ACCORDING TO REQUIRED HIERARCHY)
    // =========================================================================
    function renderEvaluationDashboard(evalData, rawTranscript) {
        const section = document.getElementById('results-dashboard-section');
        if (!section) return;

        section.classList.remove('hidden');
        section.scrollIntoView({ behavior: 'smooth' });

        // ---------------------------------------------------------------------
        // HIERARCHY LEVEL 1 (TOP): 5 Core Scores (Overall, Fluency, Grammar, Vocab, Structure)
        // ---------------------------------------------------------------------
        const elOverall = document.getElementById('metric-overall-score');
        const elFluency = document.getElementById('metric-fluency-score');
        const elGrammar = document.getElementById('metric-grammar-score');
        const elVocab = document.getElementById('metric-vocab-score');
        const elStructure = document.getElementById('metric-structure-score');

        if (elOverall) elOverall.innerText = `${evalData.overallScore} / 100`;
        if (elFluency) elFluency.innerText = `${evalData.fluencyScore10} / 10`;
        if (elGrammar) elGrammar.innerText = `${evalData.grammarScore10} / 10`;
        if (elVocab) elVocab.innerText = `${evalData.vocabularyScore10} / 10`;
        if (elStructure) elStructure.innerText = `${evalData.structureScore10} / 10`;

        // ---------------------------------------------------------------------
        // HIERARCHY LEVEL 2: Deterministic Metrics (WPM, Word Count, Sentences, Fillers, Filler %)
        // ---------------------------------------------------------------------
        const elWpm = document.getElementById('metric-wpm');
        const elPace = document.getElementById('metric-pace-status');
        const elWordCount = document.getElementById('metric-word-count');
        const elSentenceCount = document.getElementById('metric-sentence-count');
        const elFillerCount = document.getElementById('metric-filler-count');
        const elFillerPct = document.getElementById('metric-filler-percentage');
        const elLexical = document.getElementById('metric-diversity');

        if (elWpm) elWpm.innerText = evalData.wpm;
        if (elPace) elPace.innerText = evalData.paceStatus;
        if (elWordCount) elWordCount.innerText = `${evalData.wordCount} words`;
        if (elSentenceCount) elSentenceCount.innerText = `${evalData.sentenceCount} sentences`;
        if (elFillerCount) elFillerCount.innerText = `${evalData.fillerCount} detected`;
        if (elFillerPct) elFillerPct.innerText = `${evalData.fillerPercentage}%`;
        if (elLexical) elLexical.innerText = `${evalData.lexicalVariety}% variety`;

        // ---------------------------------------------------------------------
        // HIERARCHY LEVEL 3: YOUR TOP 3 IMPROVEMENTS
        // ---------------------------------------------------------------------
        const top3Container = document.getElementById('top-improvements-list');
        if (top3Container) {
            top3Container.innerHTML = '';
            (evalData.top3Improvements || []).forEach((imp, idx) => {
                const item = document.createElement('div');
                item.className = "neu-card-sm p-3 text-xs sm:text-sm text-slate-800 bg-amber-50/40 border border-amber-200 flex items-start gap-2.5";
                item.innerHTML = `
                    <span class="neu-circle w-6 h-6 shrink-0 flex items-center justify-center font-bold text-amber-700 bg-amber-100 text-xs">${idx + 1}</span>
                    <span class="leading-relaxed">${imp}</span>
                `;
                top3Container.appendChild(item);
            });
        }

        // ---------------------------------------------------------------------
        // HIERARCHY LEVEL 4: STRENGTHS
        // ---------------------------------------------------------------------
        const strengthsContainer = document.getElementById('key-strengths-list');
        if (strengthsContainer) {
            strengthsContainer.innerHTML = '';
            (evalData.strengths || []).forEach(st => {
                const li = document.createElement('li');
                li.className = "neu-card-sm p-3 text-xs sm:text-sm text-slate-700 bg-emerald-50/40 border border-emerald-100 flex items-start gap-2";
                li.innerHTML = `<span class="text-emerald-500 font-bold">✓</span> <span>${st}</span>`;
                strengthsContainer.appendChild(li);
            });
        }

        // ---------------------------------------------------------------------
        // HIERARCHY LEVEL 5: YOUR TRANSCRIPT (Annotated Review)
        // ---------------------------------------------------------------------
        const transcriptBox = document.getElementById('annotated-transcript-box');
        if (transcriptBox) {
            if (window.TranscriptProcessor) {
                transcriptBox.innerHTML = window.TranscriptProcessor.generateAnnotatedTranscript(rawTranscript);
            } else {
                transcriptBox.innerText = rawTranscript;
            }
        }

        // ---------------------------------------------------------------------
        // HIERARCHY LEVEL 6: CORRECTIONS & BETTER PHRASING
        // ---------------------------------------------------------------------
        const correctionsList = document.getElementById('corrections-list-container');
        if (correctionsList) {
            correctionsList.innerHTML = '';
            if (evalData.grammarCorrections && evalData.grammarCorrections.length > 0) {
                evalData.grammarCorrections.slice(0, 3).forEach(c => {
                    const row = document.createElement('div');
                    row.className = "neu-card-sm p-3.5 flex flex-col gap-1.5 bg-white/60 border border-red-100";
                    row.innerHTML = `
                        <div class="flex items-center justify-between">
                            <span class="neu-badge px-2 py-0.5 text-[10px] font-bold text-red-600 bg-red-50">${c.rule}</span>
                        </div>
                        <div class="text-xs text-slate-500">Spoken: <span class="text-slate-800 line-through">"${c.original}"</span></div>
                        <div class="text-xs font-bold text-emerald-700">Correction: <span>"${c.correction}"</span></div>
                        <div class="text-[11px] text-slate-600 bg-slate-100 p-2 rounded-lg mt-0.5">${c.explanation}</div>
                    `;
                    correctionsList.appendChild(row);
                });
            } else {
                correctionsList.innerHTML = `
                    <div class="p-3 text-xs text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2">
                        <span>✅</span> <span>No rule-based grammatical errors detected! Clean syntax.</span>
                    </div>
                `;
            }
        }

        // Better Phrasing: Natural & Professional Rephrasings
        const naturalEl = document.getElementById('rephrase-natural-version');
        const profEl = document.getElementById('rephrase-professional-version');
        if (naturalEl) naturalEl.innerText = `"${evalData.rephrasings?.natural || rawTranscript}"`;
        if (profEl) profEl.innerText = `"${evalData.rephrasings?.professional || rawTranscript}"`;

        // ---------------------------------------------------------------------
        // HIERARCHY LEVEL 7: VOCABULARY UPGRADE
        // ---------------------------------------------------------------------
        const vocabContainer = document.getElementById('vocab-boost-container');
        if (vocabContainer) {
            vocabContainer.innerHTML = '';
            if (evalData.vocabularyImprovements && evalData.vocabularyImprovements.length > 0) {
                evalData.vocabularyImprovements.slice(0, 3).forEach(v => {
                    const card = document.createElement('div');
                    card.className = "neu-card-sm p-3.5 flex flex-col gap-1.5 bg-white/50 border border-amber-100";
                    const synBadges = v.suggestions.slice(0, 3).map(s => `<span class="neu-badge px-2 py-0.5 text-[10px] font-bold text-amber-800 bg-amber-50">✨ ${s}</span>`).join(' ');
                    card.innerHTML = `
                        <div class="text-xs text-slate-500">Instead of: <span class="font-bold text-red-600 line-through">"${v.original}"</span></div>
                        <div class="flex flex-wrap gap-1.5 my-1">${synBadges}</div>
                        <div class="text-[11px] text-slate-600">${v.explanation}</div>
                    `;
                    vocabContainer.appendChild(card);
                });
            } else {
                vocabContainer.innerHTML = `
                    <div class="p-3 text-xs text-slate-600 bg-slate-50 rounded-xl border border-slate-200">
                        <span>✨ Good vocabulary diversity. Keep utilizing precise verbs and adjectives in your drills.</span>
                    </div>
                `;
            }
        }

        // ---------------------------------------------------------------------
        // HIERARCHY LEVEL 8: NEXT STEP
        // ---------------------------------------------------------------------
        const nextStepEl = document.getElementById('practice-follow-up-box');
        if (nextStepEl) {
            nextStepEl.innerHTML = `<div class="font-semibold text-blue-900">${evalData.nextStep}</div>`;
        }
    }

    // =========================================================================
    // 8. TEXT-TO-SPEECH (TTS) AUDIO FEEDBACK
    // =========================================================================
    function speakCoachFeedback() {
        if (!('speechSynthesis' in window)) {
            showToast("Text-to-speech is not supported in this browser.", "⚠️");
            return;
        }
        window.speechSynthesis.cancel();

        const textToSpeak = activeEvaluation?.rephrasings?.professional ||
            activeEvaluation?.rephrasings?.natural ||
            "Great speaking practice! Continue focusing on clear pace and structured delivery.";

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.lang = 'en-US';

        window.speechSynthesis.speak(utterance);
        showToast("🔊 Playing Natural & Professional Phrasing...", "🎙️");
    }

    function acceptFollowUpChallenge() {
        const transcriptArea = document.getElementById('speech-transcript-input');
        if (transcriptArea) transcriptArea.value = '';
        updateWordCount();
        resetTimer();
        shuffleTopic();
        window.scrollTo({ top: 300, behavior: 'smooth' });
        showToast("Challenge accepted! Microphone and timer reset.", "🎯");
    }

    // =========================================================================
    // 9. SESSION HISTORY (STORE REAL METRICS ONLY)
    // =========================================================================
    function saveSessionToHistory(evalData, rawTranscript) {
        if (!evalData || !evalData.isAnalyzed) return;

        try {
            const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
            let sessions = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(sessions)) sessions = [];

            const newSession = {
                id: 'sess_' + Date.now(),
                date: new Date().toISOString(),
                topic: currentTopic ? currentTopic.title : 'Speech Practice',
                duration: evalData.durationSeconds,
                overallScore: evalData.overallScore,
                fluencyScore: evalData.fluencyScore10,
                grammarScore: evalData.grammarScore10,
                vocabScore: evalData.vocabularyScore10,
                structureScore: evalData.structureScore10,
                wpm: evalData.wpm,
                fillerCount: evalData.fillerCount,
                wordCount: evalData.wordCount
            };

            sessions.unshift(newSession);
            // Keep up to 20 past sessions
            sessions = sessions.slice(0, 20);
            localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));

            renderSessionHistory(sessions);
        } catch (e) {
            console.warn("Could not save to localStorage:", e);
        }
    }

    function loadSessionHistory() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
            const sessions = raw ? JSON.parse(raw) : [];
            renderSessionHistory(sessions);
        } catch (e) {
            console.warn("Could not load localStorage history:", e);
        }
    }

    function renderSessionHistory(sessions) {
        const container = document.getElementById('sessions-history-list');
        const statsSummary = document.getElementById('session-history-stats-summary');
        if (!container) return;

        if (!sessions || sessions.length === 0) {
            container.innerHTML = `<div class="text-xs text-slate-500 py-3 text-center">No past speech sessions recorded yet. Start speaking above!</div>`;
            if (statsSummary) statsSummary.classList.add('hidden');
            return;
        }

        // Calculate Current, Previous, Best
        const currentScore = sessions[0]?.overallScore || 0;
        const prevScore = sessions[1] ? sessions[1].overallScore : null;
        const bestScore = Math.max(...sessions.map(s => s.overallScore || 0));

        if (statsSummary) {
            statsSummary.classList.remove('hidden');
            const elCurrent = document.getElementById('hist-stat-current');
            const elPrev = document.getElementById('hist-stat-prev');
            const elBest = document.getElementById('hist-stat-best');
            if (elCurrent) elCurrent.innerText = currentScore;
            if (elPrev) elPrev.innerText = prevScore !== null ? prevScore : '--';
            if (elBest) elBest.innerText = bestScore;
        }

        container.innerHTML = '';
        sessions.slice(0, 10).forEach(s => {
            const dateStr = new Date(s.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const item = document.createElement('div');
            item.className = "neu-card-sm p-3.5 flex flex-wrap items-center justify-between gap-3 bg-white/40 border border-slate-200/60";
            item.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="neu-circle w-9 h-9 flex items-center justify-center font-bold text-xs text-blue-600 bg-blue-50">
                        ${s.overallScore}
                    </div>
                    <div>
                        <div class="text-xs font-bold text-slate-800">${s.topic}</div>
                        <div class="text-[10px] text-slate-500">${dateStr} • ${s.wpm} WPM • ${s.fillerCount} filler(s) • ${s.wordCount} words</div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="neu-badge px-2 py-0.5 text-[10px] font-bold text-slate-600">Fluency: ${s.fluencyScore}</span>
                    <span class="neu-badge px-2 py-0.5 text-[10px] font-bold text-indigo-600">Grammar: ${s.grammarScore}</span>
                </div>
            `;
            container.appendChild(item);
        });
    }

    // =========================================================================
    // 10. TOAST NOTIFICATIONS
    // =========================================================================
    function showToast(msg, icon = 'ℹ️') {
        const toast = document.getElementById('coach-toast');
        if (!toast) return;
        const msgEl = document.getElementById('coach-toast-msg');
        const iconEl = document.getElementById('coach-toast-icon');
        if (msgEl) msgEl.innerText = msg;
        if (iconEl) iconEl.innerText = icon;
        toast.classList.remove('translate-y-20', 'opacity-0');
        setTimeout(() => {
            toast.classList.add('translate-y-20', 'opacity-0');
        }, 3400);
    }

    function getFallbackTopics() {
        return {
            express: [
                {
                    title: "Remote Work vs. Hybrid Model",
                    prompt: "Should remote work completely replace traditional office work in the future, or is a hybrid model the only sustainable path?",
                    framework: "PREP: Point ➔ Reason ➔ Example ➔ Point",
                    duration: 60,
                    category: "Workplace & Technology"
                },
                {
                    title: "Artificial Intelligence in Daily Decisions",
                    prompt: "Will relying on AI for everyday micro-decisions diminish human critical thinking skills?",
                    framework: "PREP: Point ➔ Reason ➔ Example ➔ Point",
                    duration: 60,
                    category: "Technology & Ethics"
                },
                {
                    title: "Continuous Learning vs. Deep Specialization",
                    prompt: "In a rapidly evolving economy, is it more advantageous to be a broad generalist or a deep specialist?",
                    framework: "PREP: Point ➔ Reason ➔ Example ➔ Point",
                    duration: 60,
                    category: "Personal Growth"
                }
            ]
        };
    }

    // Expose global methods for HTML onclick bindings
    root.shuffleTopic = shuffleTopic;
    root.selectTrack = selectTrack;
    root.toggleMicRecording = toggleMicRecording;
    root.clearTranscript = clearTranscript;
    root.toggleTimer = toggleTimer;
    root.resetTimer = resetTimer;
    root.setTimerDuration = setTimerDuration;
    root.submitSpeechForEvaluation = submitSpeechForEvaluation;
    root.speakCoachFeedback = speakCoachFeedback;
    root.acceptFollowUpChallenge = acceptFollowUpChallenge;
    root.loadSessionHistory = loadSessionHistory;

})(typeof window !== 'undefined' ? window : this);

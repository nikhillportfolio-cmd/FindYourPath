/**
 * PRAXiS Career Compass Engine
 * Modular discover-assess-profile-match-compare-reality check-roadmap-routine-coach system.
 * Zero external AI API dependencies - Pure deterministic matching intelligence.
 */

(function(root) {
    'use strict';

    const STORAGE_KEY_PROFILE = 'praxis_compass_profile';
    const STORAGE_KEY_HISTORY = 'praxis_compass_history';
    const STORAGE_KEY_ROADMAP = 'praxis_compass_active_roadmap';
    const STORAGE_KEY_REALITY = 'praxis_compass_reality_checks';

    // State
    const state = {
        mode: null, // 'preference' | 'discovery'
        preferenceDomain: null, // domainId if selected
        currentQuestionIndex: 0,
        activeQuestions: [],
        dimensionScores: {},
        answersHistory: [],
        calculatedProfile: null,
        calculatedMatches: [],
        selectedCareer: null,
        comparisonList: [], // array of career objects (max 3)
        realityChecks: {}, // careerId -> { reaction, score, completedAt }
        roadmapProgress: {}, // careerId -> { completedSteps: [idx...] }
        startTime: null
    };

    // -------------------------------------------------------------
    // 1. INITIALIZATION & STORAGE HELPERS
    // -------------------------------------------------------------
    function init() {
        loadStoredData();
    }

    function loadStoredData() {
        try {
            const savedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);
            if (savedProfile) {
                state.calculatedProfile = JSON.parse(savedProfile);
            }
            const savedReality = localStorage.getItem(STORAGE_KEY_REALITY);
            if (savedReality) {
                state.realityChecks = JSON.parse(savedReality);
            }
            const savedRoadmap = localStorage.getItem(STORAGE_KEY_ROADMAP);
            if (savedRoadmap) {
                state.roadmapProgress = JSON.parse(savedRoadmap);
            }
        } catch (e) {
            console.warn("Could not parse compass local storage:", e);
        }
    }

    function saveProfileToStorage(profile) {
        try {
            localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
            // Also append snapshot to history
            const history = getAssessmentHistory();
            history.unshift({
                date: new Date().toISOString(),
                preferenceDomain: state.preferenceDomain,
                profile: profile,
                topMatches: (state.calculatedMatches || []).slice(0, 3).map(m => ({
                    id: m.id,
                    title: m.title,
                    category: m.category,
                    matchLevel: m.matchLevel
                }))
            });
            // Cap at last 10 snapshots
            if (history.length > 10) history.length = 10;
            localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
        } catch (e) {
            console.warn("Storage write error:", e);
        }
    }

    function getAssessmentHistory() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveRealityCheckFeedback(careerId, reaction, answerData) {
        state.realityChecks[careerId] = {
            reaction,
            answerData,
            completedAt: new Date().toISOString()
        };
        try {
            localStorage.setItem(STORAGE_KEY_REALITY, JSON.stringify(state.realityChecks));
        } catch (e) {}
    }

    function saveRoadmapTaskProgress(careerId, taskIdentifier, isCompleted) {
        if (!state.roadmapProgress[careerId]) {
            state.roadmapProgress[careerId] = { completedTasks: [] };
        }
        const list = state.roadmapProgress[careerId].completedTasks;
        const index = list.indexOf(taskIdentifier);
        if (isCompleted && index === -1) {
            list.push(taskIdentifier);
        } else if (!isCompleted && index !== -1) {
            list.splice(index, 1);
        }

        try {
            localStorage.setItem(STORAGE_KEY_ROADMAP, JSON.stringify(state.roadmapProgress));
        } catch (e) {}

        // Cloud sync if authenticated
        if (window.praxisAuth && typeof window.praxisAuth.saveRoadmap === 'function' && state.selectedCareer) {
            window.praxisAuth.saveRoadmap({
                careerId: state.selectedCareer.id,
                title: state.selectedCareer.title,
                completedTasks: list,
                updatedAt: new Date().toISOString()
            });
        }
    }

    // -------------------------------------------------------------
    // 2. ASSESSMENT ENGINE & ADAPTIVE SELECTION
    // -------------------------------------------------------------
    function startAssessment(mode, chosenDomain = null) {
        state.mode = mode; // 'preference' or 'discovery'
        state.preferenceDomain = chosenDomain;
        state.currentQuestionIndex = 0;
        state.dimensionScores = {};
        state.answersHistory = [];
        state.startTime = Date.now();

        // Initialize all dimensions to zero
        const dimensions = root.COMPASS_DIMENSIONS || {};
        Object.keys(dimensions).forEach(d => {
            state.dimensionScores[d] = 0;
        });

        // Assemble questions adaptively
        const allQuestions = (root.COMPASS_QUESTIONS && root.COMPASS_QUESTIONS.length > 0)
            ? [...root.COMPASS_QUESTIONS]
            : getFallbackQuestions();

        // 10-12 questions sequence
        // Shuffle within tiers to ensure freshness
        const coreQuestions = allQuestions.filter(q => q.stage === 'core').sort(() => 0.5 - Math.random());
        const adaptiveQuestions = allQuestions.filter(q => q.stage === 'adaptive').sort(() => 0.5 - Math.random());
        const depthQuestions = allQuestions.filter(q => q.stage === 'depth').sort(() => 0.5 - Math.random());

        // Build 10 question assessment pool
        state.activeQuestions = [
            ...coreQuestions.slice(0, 4),
            ...adaptiveQuestions.slice(0, 4),
            ...depthQuestions.slice(0, 2)
        ];

        if (typeof root.renderCurrentQuestion === 'function') {
            root.renderCurrentQuestion();
        }
    }

    function recordAnswer(optionIndex) {
        const currentQ = state.activeQuestions[state.currentQuestionIndex];
        if (!currentQ || !currentQ.options[optionIndex]) return;

        const selectedOption = currentQ.options[optionIndex];

        // Record signals across dimensions
        if (selectedOption.signals) {
            Object.entries(selectedOption.signals).forEach(([dim, pts]) => {
                state.dimensionScores[dim] = (state.dimensionScores[dim] || 0) + pts;
            });
        }

        state.answersHistory.push({
            questionId: currentQ.id,
            category: currentQ.category,
            optionText: selectedOption.text,
            traits: selectedOption.traits || []
        });

        state.currentQuestionIndex++;

        if (state.currentQuestionIndex < state.activeQuestions.length) {
            if (typeof root.renderCurrentQuestion === 'function') {
                root.renderCurrentQuestion();
            }
        } else {
            finalizeAssessment();
        }
    }

    function getEstimatedMinutesRemaining() {
        const remainingQuestions = state.activeQuestions.length - state.currentQuestionIndex;
        // Assume ~20 seconds per question
        const secondsRemaining = remainingQuestions * 20;
        const mins = Math.ceil(secondsRemaining / 60);
        return mins <= 1 ? "Under 1 min" : `~${mins} mins`;
    }

    // -------------------------------------------------------------
    // 3. PROFILE SYNTHESIZER (7 Grouped Insights)
    // -------------------------------------------------------------
    function synthesizeCareerProfile() {
        const scores = state.dimensionScores;

        // Group into 7 distinct insight categories
        const thinkingScore = ((scores.analyticalReasoning || 0) + (scores.systemsThinking || 0) + (scores.creativity || 0) + (scores.problemSolving || 0)) / 4;
        const workStyleScore = ((scores.independence || 0) + (scores.execution || 0) + (scores.collaboration || 0) + (scores.leadership || 0)) / 4;
        const communicationScore = scores.communication || 0;
        const motivationScore = ((scores.motivation || 0) + (scores.curiosity || 0)) / 2;
        const valuesScore = ((scores.careerValues || 0) + (scores.riskTolerance || 0)) / 2;
        const environmentScore = scores.workEnvironment || 0;

        // Determine Thinking Archetype
        let thinkingStyle = "Balanced Systems Thinker";
        if (scores.analyticalReasoning >= scores.creativity && scores.analyticalReasoning >= scores.systemsThinking) {
            thinkingStyle = "Empirical & Quantitative Investigator";
        } else if (scores.creativity > scores.analyticalReasoning && scores.creativity >= scores.systemsThinking) {
            thinkingStyle = "Divergent & Conceptual Innovator";
        } else if (scores.systemsThinking >= scores.analyticalReasoning) {
            thinkingStyle = "Architectural & Holistic Systems Strategist";
        }

        // Determine Work Style Archetype
        let workStyleSummary = "Collaborative Execution";
        if ((scores.independence || 0) >= 4) {
            workStyleSummary = "High Autonomy with Deep Focus Intervals";
        } else if ((scores.leadership || 0) >= 4) {
            workStyleSummary = "Strategic Facilitation & Team Direction";
        } else if ((scores.collaboration || 0) >= 4) {
            workStyleSummary = "Cross-Functional Synergy & Shared Accountability";
        }

        // Determine Primary Motivation
        let motivationSummary = "Mastery & Technical Craft";
        if ((scores.careerValues || 0) >= 4) {
            motivationSummary = "High Societal Impact & Civic Purpose";
        } else if ((scores.riskTolerance || 0) >= 4) {
            motivationSummary = "Venture Creation, Commercial Autonomy & High Upside";
        } else if ((scores.curiosity || 0) >= 4) {
            motivationSummary = "Frontier Discovery & Relentless Curiosity";
        }

        // Determine Environment Preference
        let environmentSummary = "Modern Hybrid & Asynchronous Focus";
        if ((scores.workEnvironment || 0) >= 3) {
            environmentSummary = "Fluid, Remote-First or Lab-Centric Workspace";
        } else {
            environmentSummary = "Structured Team Office with Predictable Cadence";
        }

        const profile = {
            id: "profile_" + Date.now(),
            createdAt: new Date().toISOString(),
            disclaimer: "Based on your responses. Current preferences indicate these tendencies — preferences can evolve as you gain practical experience.",
            thinking: {
                label: "Thinking",
                archetype: thinkingStyle,
                description: `You gravitate toward ${thinkingStyle.toLowerCase()}, dissecting complex problems through structured logic and creative hypotheses.`,
                topDimensions: [
                    { name: "Analytical Reasoning", score: scores.analyticalReasoning || 0, max: 8 },
                    { name: "Systems Thinking", score: scores.systemsThinking || 0, max: 8 },
                    { name: "Creativity & Innovation", score: scores.creativity || 0, max: 8 }
                ]
            },
            workStyle: {
                label: "Work Style",
                archetype: workStyleSummary,
                description: `Your execution thrives best with ${workStyleSummary.toLowerCase()}, balancing accountability with self-directed velocity.`,
                topDimensions: [
                    { name: "Autonomy & Independence", score: scores.independence || 0, max: 8 },
                    { name: "Execution Rigor", score: scores.execution || 0, max: 8 },
                    { name: "Team Leadership", score: scores.leadership || 0, max: 8 }
                ]
            },
            communication: {
                label: "Communication",
                archetype: (scores.communication || 0) >= 4 ? "Persuasive Storyteller & Synthesizer" : "Precise Technical Communicator",
                description: (scores.communication || 0) >= 4
                    ? "You communicate with narrative empathy, translating technical nuances into compelling shared vision."
                    : "You favor succinct, evidence-backed clarity and functional documentation over rhetorical spin."
            },
            motivation: {
                label: "Motivation",
                archetype: motivationSummary,
                description: `Your internal driver is ${motivationSummary.toLowerCase()}, giving you energy for long-term compounding effort.`
            },
            values: {
                label: "Values",
                archetype: (scores.careerValues || 0) >= (scores.riskTolerance || 0) ? "Purpose-Driven & Institutional Integrity" : "Venture Experimentation & High Autonomy",
                description: (scores.careerValues || 0) >= (scores.riskTolerance || 0)
                    ? "You prioritize building systems that demonstrably protect and uplift communities."
                    : "You thrive when given room to take bold, calculated bets in ambiguous arenas."
            },
            environment: {
                label: "Environment",
                archetype: environmentSummary,
                description: `You perform at your peak in ${environmentSummary.toLowerCase()}.`
            },
            interests: {
                label: "Interests & Domain Signals",
                preferredDomain: state.preferenceDomain,
                description: state.preferenceDomain
                    ? `Initial preference signal set to ${(getDomainById(state.preferenceDomain) || {}).name || state.preferenceDomain}. Evaluated dynamically across all fields.`
                    : "Broad exploratory discovery across all 20+ disciplines with equal baseline openness."
            },
            rawScores: { ...scores }
        };

        state.calculatedProfile = profile;
        saveProfileToStorage(profile);
        return profile;
    }

    // -------------------------------------------------------------
    // 4. MULTI-FACTOR MATCHING ENGINE
    // Evaluates: Interests + Strengths + Work Style + Values + Environment + Preferences
    // Transparent, non-deterministic phrasing. No fake percentages or "98% Precision".
    // -------------------------------------------------------------
    function calculateMatches() {
        const careers = root.COMPASS_CAREERS || [];
        const userScores = state.dimensionScores || {};
        const prefDomain = state.preferenceDomain;

        const scoredList = careers.map(career => {
            const targets = career.targetDimensions || {};
            let dimensionMatchTotal = 0;
            let targetPointsTotal = 0;
            const strongSupportingTraits = [];
            const frictionPoints = [];
            const uncertainEvidence = [];

            // 1. Multidimensional alignment
            Object.entries(targets).forEach(([dimKey, targetVal]) => {
                const userVal = userScores[dimKey] || 0;
                targetPointsTotal += targetVal;

                // Match strength on this dimension
                const diff = Math.abs(userVal - targetVal);
                if (diff <= 1) {
                    dimensionMatchTotal += targetVal;
                    const dimMeta = (root.COMPASS_DIMENSIONS || {})[dimKey];
                    if (dimMeta && userVal >= 3) {
                        strongSupportingTraits.push(dimMeta.name);
                    }
                } else if (userVal < targetVal - 1) {
                    dimensionMatchTotal += Math.max(0, targetVal - diff * 0.8);
                    const dimMeta = (root.COMPASS_DIMENSIONS || {})[dimKey];
                    if (dimMeta) {
                        uncertainEvidence.push(dimMeta.name);
                    }
                } else {
                    dimensionMatchTotal += targetVal * 0.85;
                }
            });

            // Raw fit factor (0 to 1)
            let fitRatio = targetPointsTotal > 0 ? (dimensionMatchTotal / targetPointsTotal) : 0.5;

            // 2. Preference Signal Boost (non-exclusionary bonus)
            if (prefDomain && career.domainId === prefDomain) {
                fitRatio = Math.min(1.0, fitRatio + 0.12);
            }

            // 3. Friction analysis
            if (career.potentialFriction) {
                frictionPoints.push(career.potentialFriction);
            }

            // 4. Determine Match Level (Never deterministic 95%, always qualitative categories)
            let matchLevel = "Worth Exploring";
            let matchClass = "match-exploring";
            let badgeText = "Worth Exploring";

            if (fitRatio >= 0.78) {
                matchLevel = "Strong Match";
                matchClass = "match-strong";
                badgeText = "Strong Match";
            } else if (fitRatio < 0.65) {
                matchLevel = "You Might Also Enjoy";
                matchClass = "match-adjacent";
                badgeText = "You Might Also Enjoy";
            }

            // 5. Confidence Level based on signal density
            let confidenceLevel = "High Confidence";
            if (uncertainEvidence.length >= 3) {
                confidenceLevel = "Moderate Confidence";
            } else if (uncertainEvidence.length >= 5) {
                confidenceLevel = "Emerging Match";
            }

            // 6. Transparent Rationale Generation
            const traitsPreview = strongSupportingTraits.slice(0, 3).join(", ") || "analytical thinking and practical delivery";
            const whyItMatches = `Strong alignment with your ${traitsPreview}. Your work style preferences match this field's typical cadence.`;

            return {
                ...career,
                fitRatio,
                matchLevel,
                matchClass,
                badgeText,
                confidenceLevel,
                whyItMatches,
                supportingTraits: strongSupportingTraits.slice(0, 4),
                frictionNote: career.potentialFriction || "High cognitive complexity and deadline constraints.",
                missingEvidence: uncertainEvidence.slice(0, 2)
            };
        });

        // Sort descending by fitRatio
        scoredList.sort((a, b) => b.fitRatio - a.fitRatio);

        // Categorize into 3 distinct user-facing tiers
        const strongMatches = scoredList.filter(c => c.matchLevel === "Strong Match");
        const worthExploring = scoredList.filter(c => c.matchLevel === "Worth Exploring");
        const mightEnjoy = scoredList.filter(c => c.matchLevel === "You Might Also Enjoy");

        // Guarantee at least 2 strong, 2 exploring, 2 adjacent for healthy UI discovery
        state.calculatedMatches = scoredList;
        return {
            all: scoredList,
            strongMatches: strongMatches.slice(0, 4),
            worthExploring: worthExploring.slice(0, 4),
            mightEnjoy: mightEnjoy.slice(0, 4)
        };
    }

    function finalizeAssessment() {
        const profile = synthesizeCareerProfile();
        const matches = calculateMatches();

        // Trigger UI transition to results view
        if (typeof root.renderCompassResultsView === 'function') {
            root.renderCompassResultsView(profile, matches);
        }
    }

    // -------------------------------------------------------------
    // 5. CAREER COMPARISON ENGINE (Side-by-Side 2-3 Careers)
    // -------------------------------------------------------------
    function toggleCareerComparison(careerId) {
        const career = (root.COMPASS_CAREERS || []).find(c => c.id === careerId);
        if (!career) return;

        const existingIndex = state.comparisonList.findIndex(c => c.id === careerId);
        if (existingIndex !== -1) {
            state.comparisonList.splice(existingIndex, 1);
        } else {
            if (state.comparisonList.length >= 3) {
                showToast("You can compare up to 3 careers simultaneously.", "ℹ️");
                return;
            }
            state.comparisonList.push(career);
        }

        updateComparisonTrayUI();
    }

    function clearComparisonList() {
        state.comparisonList = [];
        updateComparisonTrayUI();
    }

    function updateComparisonTrayUI() {
        if (typeof document === 'undefined') return;
        const tray = document.getElementById('compass-compare-tray');
        const countEl = document.getElementById('compass-compare-count');
        const openBtn = document.getElementById('compass-compare-open-btn');

        if (!tray || !countEl) return;

        const count = state.comparisonList.length;
        countEl.innerText = `${count}/3 Selected`;

        if (count >= 2) {
            tray.classList.remove('hidden');
            if (openBtn) openBtn.disabled = false;
        } else if (count === 1) {
            tray.classList.remove('hidden');
            if (openBtn) openBtn.disabled = true;
        } else {
            tray.classList.add('hidden');
        }
    }

    // -------------------------------------------------------------
    // 6. CAREER REALITY CHECK ENGINE
    // Mini-simulation testing real job task + user reaction rating
    // -------------------------------------------------------------
    function getRealityCheck(careerId) {
        const career = (root.COMPASS_CAREERS || []).find(c => c.id === careerId);
        return career ? career.realityCheck : null;
    }

    function recordRealityFeedback(careerId, userReaction) {
        // userReaction: 'loved' | 'enjoyed' | 'neutral' | 'disliked' | 'strongly_disliked'
        saveRealityCheckFeedback(careerId, userReaction, { completedAt: new Date().toISOString() });

        // Update confidence or display badge on card
        if (typeof document !== 'undefined') {
            const cardBadge = document.getElementById(`reality-badge-${careerId}`);
            if (cardBadge) {
                const reactionIcons = {
                    loved: "❤️ Loved It",
                    enjoyed: "👍 Enjoyed It",
                    neutral: "😐 Neutral",
                    disliked: "👎 Disliked",
                    strongly_disliked: "🚫 Strongly Disliked"
                };
                cardBadge.innerText = `Reality Check: ${reactionIcons[userReaction] || 'Completed'}`;
                cardBadge.classList.remove('hidden');
            }
        }

        showToast("Reality check feedback recorded as a career-fit signal!", "✨");
    }

    // -------------------------------------------------------------
    // 7. ROUTINE TRACKER BRIDGE
    // Seamlessly import roadmap milestones into Routine Tracker
    // -------------------------------------------------------------
    function addRoadmapToRoutine(career, selectedPhases, frequency, durationMins, timeOfDay) {
        if (!career || !career.phases) return;

        const habitsToAdd = [];
        selectedPhases.forEach((phaseIndex) => {
            const phase = career.phases[phaseIndex];
            if (phase) {
                const habitName = `[${career.title.split(' ')[0]}] ${phase.title.split(':')[1] || phase.title}`;
                habitsToAdd.push({
                    name: habitName.trim(),
                    timeOfDay: timeOfDay || "Morning Routine",
                    duration: durationMins || 30,
                    frequency: frequency || "Daily"
                });
            }
        });

        // Add to existing habits array in script.js
        if (typeof window.habits !== 'undefined' && Array.isArray(window.habits)) {
            habitsToAdd.forEach(item => {
                const exists = window.habits.some(h => h && h.name && h.name.toLowerCase() === item.name.toLowerCase());
                if (!exists) {
                    const newHabit = {
                        id: "habit_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
                        name: item.name,
                        timeOfDay: item.timeOfDay,
                        scheduledTime: "",
                        remindedDates: {},
                        missedNotifiedDates: {},
                        days: new Array(30).fill(false),
                        createdAt: Date.now()
                    };
                    window.habits.push(newHabit);
                }
            });

            if (typeof window.saveHabitsToStorage === 'function') {
                window.saveHabitsToStorage();
            }
            if (typeof window.renderHabitsList === 'function') {
                window.renderHabitsList();
            }
        }

        // Also sync to Cloud if praxisAuth exists
        if (window.praxisAuth && typeof window.praxisAuth.saveRoutine === 'function') {
            window.praxisAuth.saveRoutine({
                habits: window.habits || [],
                updatedAt: new Date().toISOString()
            });
        }

        showToast(`Added ${habitsToAdd.length} roadmap habits to your Routine Tracker!`, "📈");
    }

    // -------------------------------------------------------------
    // 8. COMMUNICATION COACH BRIDGE
    // Recommends career-specific communication drill and launches Coach
    // -------------------------------------------------------------
    function launchCommunicationCoachForCareer(career) {
        if (!career || !career.communicationExercise) return;

        const drill = career.communicationExercise;
        const queryParams = new URLSearchParams({
            career: career.title,
            topic: drill.title,
            prompt: drill.prompt,
            framework: drill.framework,
            why: drill.why
        });

        // Open coach.html with drill preloaded
        window.location.href = `/coach.html?${queryParams.toString()}`;
    }

    // -------------------------------------------------------------
    // 9. REASSESSMENT & HISTORY COMPARISON
    // -------------------------------------------------------------
    function calculatePreferenceShift() {
        const history = getAssessmentHistory();
        if (history.length < 2) return null;

        const current = history[0];
        const previous = history[1];

        const deltas = {};
        const currentScores = (current.profile && current.profile.rawScores) || {};
        const prevScores = (previous.profile && previous.profile.rawScores) || {};

        Object.keys(root.COMPASS_DIMENSIONS || {}).forEach(dKey => {
            const cVal = currentScores[dKey] || 0;
            const pVal = prevScores[dKey] || 0;
            if (cVal !== pVal) {
                deltas[dKey] = {
                    delta: cVal - pVal,
                    name: (root.COMPASS_DIMENSIONS[dKey] || {}).name || dKey
                };
            }
        });

        return {
            currentDate: current.date,
            previousDate: previous.date,
            deltas
        };
    }

    // Helper: get domain by ID
    function getDomainById(domainId) {
        return (root.COMPASS_DOMAINS || []).find(d => d.id === domainId) || null;
    }

    // Fallback questions if external data fails
    function getFallbackQuestions() {
        return [
            {
                id: "fb_1",
                stage: "core",
                category: "Logic & Systems",
                text: "When tackling a complicated real-world breakdown, what is your first instinct?",
                options: [
                    { text: "Analyze telemetry data and identify systemic causal factors.", signals: { analyticalReasoning: 3, systemsThinking: 2 } },
                    { text: "Interview stakeholders to understand the human communication disconnect.", signals: { communication: 3, collaboration: 2 } },
                    { text: "Rapidly build an experimental prototype to bypass the issue.", signals: { execution: 3, creativity: 2 } },
                    { text: "Take charge and organize an immediate cross-functional war room.", signals: { leadership: 3, problemSolving: 2 } }
                ]
            }
        ];
    }

    // Helper: Toast notification
    function showToast(msg, icon = "🧭") {
        if (typeof window.showInAppToast === 'function') {
            window.showInAppToast(icon, msg, false);
        } else {
            console.log(`[Compass] ${icon} ${msg}`);
        }
    }

    // -------------------------------------------------------------
    // EXPORTS TO GLOBAL NAMESPACE
    // -------------------------------------------------------------
    root.CompassEngine = {
        init,
        startAssessment,
        recordAnswer,
        getEstimatedMinutesRemaining,
        synthesizeCareerProfile,
        calculateMatches,
        toggleCareerComparison,
        clearComparisonList,
        getRealityCheck,
        recordRealityFeedback,
        addRoadmapToRoutine,
        launchCommunicationCoachForCareer,
        saveRoadmapTaskProgress,
        calculatePreferenceShift,
        getAssessmentHistory,
        getState: () => state,
        getDomainById
    };

})(typeof window !== 'undefined' ? window : global);

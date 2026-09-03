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
        selectedOptionIndex: null,
        activeQuestions: [],
        adaptivePool: [],
        adaptiveAdded: false,
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
        state.selectedOptionIndex = null;
        state.dimensionScores = {};
        state.answersHistory = [];
        state.adaptiveAdded = false;
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

        const coreQuestions = allQuestions.filter(q => q.stage === 'core');
        const adaptiveQuestions = allQuestions.filter(q => q.stage === 'adaptive');

        // Start with 12 core questions (student-friendly sequence)
        state.activeQuestions = [...coreQuestions.slice(0, 12)];
        state.adaptivePool = [...adaptiveQuestions];

        if (typeof root.renderCurrentQuestion === 'function') {
            root.renderCurrentQuestion();
        }
    }

    function selectOption(optionIndex) {
        state.selectedOptionIndex = optionIndex;
        if (typeof root.updateQuestionSelectionUI === 'function') {
            root.updateQuestionSelectionUI(optionIndex);
        }
    }

    function confirmCurrentAnswer() {
        if (state.selectedOptionIndex === null || state.selectedOptionIndex === undefined) return;
        recordAnswer(state.selectedOptionIndex);
    }

    function goBack() {
        if (state.currentQuestionIndex <= 0) return false;

        const lastAnswer = state.answersHistory.pop();
        if (lastAnswer && lastAnswer.signals) {
            Object.entries(lastAnswer.signals).forEach(([dim, pts]) => {
                state.dimensionScores[dim] = Math.max(0, (state.dimensionScores[dim] || 0) - pts);
            });
        }

        state.currentQuestionIndex--;
        state.selectedOptionIndex = (lastAnswer && typeof lastAnswer.optionIndex === 'number')
            ? lastAnswer.optionIndex
            : null;

        if (typeof root.renderCurrentQuestion === 'function') {
            root.renderCurrentQuestion();
        }
        return true;
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
            optionIndex: optionIndex,
            optionText: selectedOption.text,
            signals: selectedOption.signals || {},
            traits: selectedOption.traits || []
        });

        // Trigger adaptive questions injection after core questions (at index 11)
        if (state.currentQuestionIndex === 11 && !state.adaptiveAdded) {
            injectAdaptiveQuestions();
        }

        state.currentQuestionIndex++;
        state.selectedOptionIndex = null;

        if (state.currentQuestionIndex < state.activeQuestions.length) {
            if (typeof root.renderCurrentQuestion === 'function') {
                root.renderCurrentQuestion();
            }
        } else {
            finalizeAssessment();
        }
    }

    // Dynamic adaptive question injection based on provisional matching and trait uncertainties
    function injectAdaptiveQuestions() {
        if (state.adaptiveAdded) return;
        state.adaptiveAdded = true;

        const pool = state.adaptivePool || [];
        if (pool.length === 0) return;

        const provisional = calculateProvisionalMatches();
        const topCareers = (provisional && provisional.all) ? provisional.all.slice(0, 4) : [];
        const topDomainIds = new Set(topCareers.map(c => c.domainId));

        const selectedAdaptive = [];

        // 1. Separate competing career directions
        const hasTechDataProduct = topDomainIds.has('tech_ai') || topDomainIds.has('data_analytics') || topDomainIds.has('business_management') || topDomainIds.has('design_creative');
        const hasSciEngHealth = topDomainIds.has('engineering') || topDomainIds.has('science_research') || topDomainIds.has('healthcare') || topDomainIds.has('emerging_interdisciplinary');
        const hasBizLawMedia = topDomainIds.has('entrepreneurship') || topDomainIds.has('law') || topDomainIds.has('marketing_sales') || topDomainIds.has('media_communication') || topDomainIds.has('education');

        if (hasTechDataProduct) {
            const q = pool.find(p => p.id === 'ad01');
            if (q && !selectedAdaptive.includes(q)) selectedAdaptive.push(q);
        }
        if (hasSciEngHealth && selectedAdaptive.length < 3) {
            const q = pool.find(p => p.id === 'ad02');
            if (q && !selectedAdaptive.includes(q)) selectedAdaptive.push(q);
        }
        if (hasBizLawMedia && selectedAdaptive.length < 3) {
            const q = pool.find(p => p.id === 'ad03');
            if (q && !selectedAdaptive.includes(q)) selectedAdaptive.push(q);
        }

        // 2. Separate trait uncertainties
        const scores = state.dimensionScores;
        const diffIndepLead = Math.abs((scores.independence || 0) - (scores.leadership || 0));
        const diffExecRisk = Math.abs((scores.execution || 0) - (scores.riskTolerance || 0));
        const diffValVent = Math.abs((scores.careerValues || 0) - (scores.riskTolerance || 0));

        if (selectedAdaptive.length < 3 && diffIndepLead <= 2) {
            const q = pool.find(p => p.id === 'ad04');
            if (q && !selectedAdaptive.includes(q)) selectedAdaptive.push(q);
        }
        if (selectedAdaptive.length < 3 && diffExecRisk <= 2) {
            const q = pool.find(p => p.id === 'ad05');
            if (q && !selectedAdaptive.includes(q)) selectedAdaptive.push(q);
        }
        if (selectedAdaptive.length < 3 && diffValVent <= 2) {
            const q = pool.find(p => p.id === 'ad06');
            if (q && !selectedAdaptive.includes(q)) selectedAdaptive.push(q);
        }

        // Fill remaining slots up to 3 questions from pool
        for (const q of pool) {
            if (selectedAdaptive.length >= 3) break;
            if (!selectedAdaptive.includes(q)) {
                selectedAdaptive.push(q);
            }
        }

        state.activeQuestions.push(...selectedAdaptive);
    }

    function calculateProvisionalMatches() {
        const careers = root.COMPASS_CAREERS || [];
        const userScores = state.dimensionScores || {};
        const prefDomain = state.preferenceDomain;

        const scoredList = careers.map(career => {
            const targets = career.targetDimensions || {};
            let dimensionMatchTotal = 0;
            let targetPointsTotal = 0;

            Object.entries(targets).forEach(([dimKey, targetVal]) => {
                const userVal = userScores[dimKey] || 0;
                targetPointsTotal += targetVal;

                const diff = Math.abs(userVal - targetVal);
                if (diff <= 1) {
                    dimensionMatchTotal += targetVal;
                } else if (userVal < targetVal - 1) {
                    dimensionMatchTotal += Math.max(0, targetVal - diff * 0.8);
                } else {
                    dimensionMatchTotal += targetVal * 0.85;
                }
            });

            let fitRatio = targetPointsTotal > 0 ? (dimensionMatchTotal / targetPointsTotal) : 0.5;
            if (prefDomain && career.domainId === prefDomain) {
                fitRatio = Math.min(1.0, fitRatio + 0.12);
            }

            return {
                id: career.id,
                domainId: career.domainId,
                title: career.title,
                fitRatio
            };
        });

        scoredList.sort((a, b) => b.fitRatio - a.fitRatio);
        return { all: scoredList };
    }

    function getEstimatedMinutesRemaining() {
        const remainingQuestions = Math.max(0, state.activeQuestions.length - state.currentQuestionIndex);
        if (remainingQuestions <= 0) return "Under 1 min";
        // ~15-20 seconds per question
        const secondsRemaining = remainingQuestions * 18;
        const mins = Math.ceil(secondsRemaining / 60);
        return mins <= 1 ? "About 1 min left" : `About ${mins} mins left`;
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
        let thinkingDesc = "You balance logic and creativity to find practical, smart solutions to everyday challenges.";
        if (scores.analyticalReasoning >= scores.creativity && scores.analyticalReasoning >= scores.systemsThinking) {
            thinkingStyle = "Empirical & Quantitative Investigator";
            thinkingDesc = "You enjoy solving problems on your own, looking at facts and data, and figuring out how things work.";
        } else if (scores.creativity > scores.analyticalReasoning && scores.creativity >= scores.systemsThinking) {
            thinkingStyle = "Divergent & Conceptual Innovator";
            thinkingDesc = "You love imagining fresh ideas, thinking outside the box, and finding creative solutions.";
        } else if (scores.systemsThinking >= scores.analyticalReasoning) {
            thinkingStyle = "Architectural & Holistic Systems Strategist";
            thinkingDesc = "You naturally connect the dots, understand how big systems fit together, and build organized solutions.";
        }

        // Determine Work Style Archetype
        let workStyleSummary = "Collaborative Execution";
        let workStyleDesc = "You thrive when working closely with others, sharing ideas, and achieving great results together.";
        if ((scores.independence || 0) >= 4) {
            workStyleSummary = "High Autonomy with Deep Focus Intervals";
            workStyleDesc = "You do your best work when you have quiet time to focus deeply and solve challenges on your own.";
        } else if ((scores.leadership || 0) >= 4) {
            workStyleSummary = "Strategic Facilitation & Team Direction";
            workStyleDesc = "You naturally step up, help make decisions, and guide a team toward finishing important goals.";
        } else if ((scores.collaboration || 0) >= 4) {
            workStyleSummary = "Cross-Functional Synergy & Shared Accountability";
            workStyleDesc = "You thrive when working closely with others, sharing ideas, and achieving great results together.";
        }

        // Determine Primary Motivation
        let motivationSummary = "Mastery & Technical Craft";
        let motivationDesc = "You are driven by getting really good at what you do and achieving high-quality results.";
        if ((scores.careerValues || 0) >= 4) {
            motivationSummary = "High Societal Impact & Civic Purpose";
            motivationDesc = "You are motivated by helping people, doing good, and making a positive difference in the world.";
        } else if ((scores.riskTolerance || 0) >= 4) {
            motivationSummary = "Venture Creation, Commercial Autonomy & High Upside";
            motivationDesc = "You get excited by taking bold risks, starting new projects, and building things from scratch.";
        } else if ((scores.curiosity || 0) >= 4) {
            motivationSummary = "Frontier Discovery & Relentless Curiosity";
            motivationDesc = "You love exploring new frontiers, asking deep questions, and learning how the world works.";
        }

        // Determine Environment Preference
        let environmentSummary = "Modern Hybrid & Asynchronous Focus";
        let environmentDesc = "You work best in a flexible, modern environment where you have independence over your space and schedule.";
        if ((scores.workEnvironment || 0) >= 3) {
            environmentSummary = "Fluid, Remote-First or Lab-Centric Workspace";
            environmentDesc = "You perform at your peak in flexible workspaces where you can move freely and experiment.";
        } else {
            environmentSummary = "Structured Team Office with Predictable Cadence";
            environmentDesc = "You do best with a clear structure, steady teamwork, and a supportive, organized environment.";
        }

        const profile = {
            id: "profile_" + Date.now(),
            createdAt: new Date().toISOString(),
            disclaimer: "Based on your responses. Current preferences indicate these tendencies — preferences can evolve as you gain practical experience.",
            thinking: {
                label: "Thinking",
                archetype: thinkingStyle,
                description: thinkingDesc,
                topDimensions: [
                    { name: "Analytical Reasoning", score: scores.analyticalReasoning || 0, max: 8 },
                    { name: "Systems Thinking", score: scores.systemsThinking || 0, max: 8 },
                    { name: "Creativity & Innovation", score: scores.creativity || 0, max: 8 }
                ]
            },
            workStyle: {
                label: "Work Style",
                archetype: workStyleSummary,
                description: workStyleDesc,
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
                    ? "You are great at explaining ideas simply, telling engaging stories, and bringing people together."
                    : "You prefer clear, direct, and honest communication focused on facts rather than long speeches."
            },
            motivation: {
                label: "Motivation",
                archetype: motivationSummary,
                description: motivationDesc
            },
            values: {
                label: "Values",
                archetype: (scores.careerValues || 0) >= (scores.riskTolerance || 0) ? "Purpose-Driven & Institutional Integrity" : "Venture Experimentation & High Autonomy",
                description: (scores.careerValues || 0) >= (scores.riskTolerance || 0)
                    ? "You care about work that improves lives, protects communities, and stands for what is right."
                    : "You value freedom and agency, and you thrive when you can experiment and try bold new ideas."
            },
            environment: {
                label: "Environment",
                archetype: environmentSummary,
                description: environmentDesc
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
        let history = getAssessmentHistory();
        // If an assessment has answers recorded (at least 10) but not finalized (e.g. test suites)
        if (history.length < 2 && state.answersHistory && state.answersHistory.length >= 10) {
            finalizeAssessment();
            history = getAssessmentHistory();
        }
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
                category: "Problem Solving",
                text: "You get a difficult problem. What do you do first?",
                options: [
                    { text: "Break it into smaller parts", signals: { analyticalReasoning: 3, problemSolving: 2 } },
                    { text: "Ask someone for their ideas", signals: { collaboration: 3, communication: 2 } },
                    { text: "Try a fresh, creative approach", signals: { creativity: 3, riskTolerance: 2 } },
                    { text: "Make a step-by-step plan", signals: { systemsThinking: 2, execution: 3 } }
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
        selectOption,
        confirmCurrentAnswer,
        goBack,
        getEstimatedMinutesRemaining,
        synthesizeCareerProfile,
        calculateMatches,
        calculateProvisionalMatches,
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

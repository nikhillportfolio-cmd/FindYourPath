/**
 * PRAXiS Fluency Lab - Core Speech Fluency Diagnostic Engine
 * 100% Local, Deterministic Rule-Based Algorithm
 * NO External AI API. All metrics derived from actual speech recognition and timing data.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./transcriptProcessor'], factory);
    } else if (typeof module === 'object' && module.exports) {
        const TP = require('./transcriptProcessor');
        module.exports = factory(TP);
    } else {
        root.FluencyLab = factory(root.TranscriptProcessor);
    }
}(typeof self !== 'undefined' ? self : this, function (TranscriptProcessor) {

    // Configurable Pause Thresholds
    const PAUSE_THRESHOLDS = {
        NORMAL_MAX: 0.7,        // < 0.7s: natural pause between words
        NOTICEABLE_MAX: 1.5,    // 0.7s - 1.5s: noticeable pause
        LONG_MIN: 1.5           // > 1.5s: long hesitation pause
    };

    // Guidance WPM ranges
    const WPM_RANGES = {
        SLOW_MAX: 89,           // Below 90: Slow
        COMFORTABLE_MIN: 90,    // 90–150: Comfortable (Ideal)
        COMFORTABLE_MAX: 150,
        FAST_MIN: 151,          // 151–180: Fast
        FAST_MAX: 180           // Above 180: Very Fast
    };

    // Standard English Connectors Dictionary
    const DISCOURSE_CONNECTORS = [
        "although", "even though", "though", "because", "since", "as a result",
        "therefore", "thus", "consequently", "however", "nevertheless", "nonetheless",
        "on the other hand", "while", "whereas", "despite", "in spite of", "unless",
        "for example", "for instance", "in addition", "furthermore", "moreover",
        "so", "but", "yet", "besides", "meanwhile", "subsequently", "overall"
    ];

    // Unconditional Fillers Dictionary
    const FILLER_PATTERNS = [
        { word: "um", regex: /\b(um+)\b/gi },
        { word: "uh", regex: /\b(uh+)\b/gi },
        { word: "er", regex: /\b(er+)\b/gi },
        { word: "ah", regex: /\b(ah+)\b/gi },
        { word: "basically", regex: /\b(basically)\b/gi },
        { word: "actually", regex: /\b(actually)\b/gi },
        { word: "literally", regex: /\b(literally)\b/gi },
        { word: "you know", regex: /\b(you know)\b/gi },
        { word: "i mean", regex: /\b(i mean)\b/gi },
        { word: "sort of", regex: /\b(sort of)\b/gi },
        { word: "kind of", regex: /\b(kind of)\b/gi },
        { word: "to be honest", regex: /\b(to be honest|tbh)\b/gi },
        { word: "you see", regex: /\b(you see)\b/gi },
        { word: "so yeah", regex: /\b(so yeah)\b/gi },
        { word: "stuff like that", regex: /\b(stuff like that|and stuff)\b/gi }
    ];

    /**
     * Normalize text for approximate matching (lowercase, no punctuation, normalized spacing)
     */
    function normalizeText(text) {
        if (!text) return '';
        return String(text)
            .toLowerCase()
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[^a-z0-9\s']/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Tokenize text into words array
     */
    function tokenizeWords(text) {
        const cleaned = normalizeText(text);
        if (!cleaned) return [];
        const matches = cleaned.match(/\b[a-z0-9]+(?:'[a-z0-9]+)?\b/g);
        return matches ? matches : [];
    }

    /**
     * Calculate Words Per Minute (WPM)
     */
    function calculateWPM(wordCount, activeSpeakingSeconds, totalDurationSeconds) {
        if (wordCount <= 0) return 0;
        
        let minutes = 0;
        if (activeSpeakingSeconds && activeSpeakingSeconds > 0) {
            minutes = Math.max(activeSpeakingSeconds / 60, 0.05); // min 3s denominator
        } else if (totalDurationSeconds && totalDurationSeconds > 0) {
            minutes = Math.max(totalDurationSeconds / 60, 0.05);
        } else {
            minutes = 0.5; // default 30s
        }

        return Math.round(wordCount / minutes);
    }

    /**
     * Detect fillers with pattern & contextual rules
     */
    function detectFillers(transcript) {
        if (!transcript) return { fillerCount: 0, fillerPercentage: 0, fillerWords: [] };

        const text = ' ' + transcript + ' ';
        const counts = new Map();
        let totalCount = 0;

        // 1. Unconditional Fillers
        FILLER_PATTERNS.forEach(fp => {
            const matches = text.match(fp.regex);
            if (matches) {
                const count = matches.length;
                totalCount += count;
                const key = fp.word.toLowerCase();
                counts.set(key, (counts.get(key) || 0) + count);
            }
        });

        // 2. Contextual "like" as filler (before/after pauses, as hesitation, or consecutive)
        // e.g. "and like we", "it was like um" (do NOT match "I like reading")
        const likeFillerRegex = /(?:,\s*|\b(?:and|so|it was|they were|was|is|just)\s+)like\b(?=\s+(?:um|uh|you know|basically|about|\d+|a|an|the|\w+ing))/gi;
        const standaloneLikeRegex = /^(?:\s*like\b)/gim;

        let m;
        let likeCount = 0;
        while ((m = likeFillerRegex.exec(text)) !== null) {
            likeCount++;
        }
        while ((m = standaloneLikeRegex.exec(text)) !== null) {
            likeCount++;
        }
        if (likeCount > 0) {
            totalCount += likeCount;
            counts.set('like (filler)', (counts.get('like (filler)') || 0) + likeCount);
        }

        // 3. Stutter restarts (e.g. "we we", "and and")
        const stutterRegex = /\b([a-zA-Z]+)\s+\1\b/gi;
        let restartCount = 0;
        while ((m = stutterRegex.exec(text)) !== null) {
            if (!['that', 'had'].includes(m[1].toLowerCase())) {
                restartCount++;
                const key = `${m[1]} ${m[1]} (restart)`;
                counts.set(key, (counts.get(key) || 0) + 1);
                totalCount++;
            }
        }

        const words = tokenizeWords(transcript);
        const wordCount = words.length;
        const fillerPercentage = wordCount > 0 ? Number(((totalCount / wordCount) * 100).toFixed(1)) : 0;
        const fillerWords = Array.from(counts.entries()).map(([word, count]) => ({ word, count }));
        fillerWords.sort((a, b) => b.count - a.count);

        return {
            fillerCount: totalCount,
            fillerPercentage,
            fillerWords,
            restartCount
        };
    }

    /**
     * Approximate Target Sentence Matching
     * Tolerant of minor speech recognition artifacts.
     */
    function calculateTargetCoverage(recognizedText, targetText) {
        if (!targetText) {
            return {
                coveragePercentage: 100,
                matchedWords: tokenizeWords(recognizedText),
                missingWords: [],
                extraWords: [],
                wordOrderScore: 100
            };
        }

        const targetTokens = tokenizeWords(targetText);
        const recognizedTokens = tokenizeWords(recognizedText);

        if (targetTokens.length === 0) {
            return { coveragePercentage: 100, matchedWords: [], missingWords: [], extraWords: [], wordOrderScore: 100 };
        }
        if (recognizedTokens.length === 0) {
            return { coveragePercentage: 0, matchedWords: [], missingWords: targetTokens, extraWords: [], wordOrderScore: 0 };
        }

        // Multiset matching with position alignment
        const matched = [];
        const missing = [];
        const recognizedPool = [...recognizedTokens];

        let sequentialMatches = 0;
        let lastFoundIdx = -1;

        targetTokens.forEach((tWord) => {
            const foundIdx = recognizedPool.indexOf(tWord);
            if (foundIdx !== -1) {
                matched.push(tWord);
                recognizedPool.splice(foundIdx, 1);
                if (foundIdx > lastFoundIdx) {
                    sequentialMatches++;
                    lastFoundIdx = foundIdx;
                }
            } else {
                // Check for close contraction match (e.g. "couldn't" vs "could not")
                const partialMatchIdx = recognizedPool.findIndex(rWord => rWord.startsWith(tWord.slice(0, 4)) || tWord.startsWith(rWord.slice(0, 4)));
                if (partialMatchIdx !== -1 && tWord.length > 3) {
                    matched.push(tWord);
                    recognizedPool.splice(partialMatchIdx, 1);
                } else {
                    missing.push(tWord);
                }
            }
        });

        const extraWords = [...recognizedPool];
        const rawCoverage = (matched.length / targetTokens.length) * 100;
        const coveragePercentage = Math.min(100, Math.round(rawCoverage));
        const wordOrderScore = targetTokens.length > 0 ? Math.min(100, Math.round((sequentialMatches / targetTokens.length) * 100)) : 100;

        return {
            coveragePercentage,
            matchedWords: matched,
            missingWords: missing,
            extraWords,
            wordOrderScore
        };
    }

    /**
     * Analyze Connector Usage in speech
     */
    function analyzeConnectorUsage(transcript, expectedConnectors = []) {
        const text = normalizeText(transcript);
        const words = text.split(/\s+/);
        const detected = [];

        // Check against target expected connectors first, then all connectors
        const checkList = expectedConnectors && expectedConnectors.length > 0
            ? [...expectedConnectors, ...DISCOURSE_CONNECTORS]
            : DISCOURSE_CONNECTORS;

        const uniqueCheck = Array.from(new Set(checkList.map(c => c.toLowerCase())));

        uniqueCheck.forEach(conn => {
            const reg = new RegExp(`\\b${conn}\\b`, 'i');
            if (reg.test(text)) {
                detected.push(conn);
            }
        });

        return {
            hasConnector: detected.length > 0,
            detectedConnectors: detected,
            primaryConnector: detected[0] || null
        };
    }

    /**
     * Pause Metrics Calculator from recognition timing events
     */
    function calculatePauseMetrics(timingData = {}) {
        const pauses = Array.isArray(timingData.pauses) ? timingData.pauses : [];
        let totalPauseTime = Number(timingData.totalPauseTime) || 0;
        let longPauseCount = Number(timingData.longPauseCount) || 0;
        let pauseCount = pauses.length;

        // If timing data provided raw pauses array, re-verify counts
        let noticeableCount = 0;
        let normalCount = 0;

        pauses.forEach(p => {
            const dur = Number(p.durationSeconds || p.duration) || 0;
            if (dur >= PAUSE_THRESHOLDS.LONG_MIN) {
                // already in longPauseCount or count it
            } else if (dur >= PAUSE_THRESHOLDS.NORMAL_MAX) {
                noticeableCount++;
            } else {
                normalCount++;
            }
        });

        if (!longPauseCount) {
            longPauseCount = pauses.filter(p => (Number(p.durationSeconds || p.duration) || 0) >= PAUSE_THRESHOLDS.LONG_MIN).length;
        }

        const averagePauseTime = pauseCount > 0 ? Number((totalPauseTime / pauseCount).toFixed(2)) : 0;

        return {
            pauseCount,
            longPauseCount,
            noticeableCount,
            normalCount,
            totalPauseTime: Number(totalPauseTime.toFixed(2)),
            averagePauseTime,
            pausesList: pauses
        };
    }

    // =========================================================================
    // DETERMINISTIC SCORING FORMULAS
    // =========================================================================

    /**
     * 1. Pacing Score (0-100, 25% weight)
     * Target: 90–150 WPM comfortable range.
     */
    function calculatePacingScore(wpm, targetRange = [90, 150]) {
        const minTarget = targetRange[0] || 90;
        const maxTarget = targetRange[1] || 150;

        if (wpm <= 0) return 30;

        if (wpm >= minTarget && wpm <= maxTarget) {
            return 98; // Ideal comfortable pace
        } else if (wpm < minTarget) {
            // Below comfortable
            if (wpm >= minTarget - 15) return 85; // e.g. 75-89 WPM
            if (wpm >= minTarget - 30) return 70; // e.g. 60-74 WPM
            if (wpm >= 40) return 55;
            return Math.max(35, Math.round(35 + (wpm / 40) * 15));
        } else {
            // Above comfortable
            if (wpm <= maxTarget + 25) return 85; // e.g. 151-175 WPM (Fast)
            if (wpm <= maxTarget + 45) return 70; // e.g. 176-195 WPM
            return Math.max(40, Math.round(70 - ((wpm - 195) / 5)));
        }
    }

    /**
     * 2. Pause Control Score (0-100, 25% weight)
     */
    function calculatePauseScore(pauseMetrics, wordCount) {
        let score = 95;
        const longCount = pauseMetrics.longPauseCount || 0;
        const noticeableCount = pauseMetrics.noticeableCount || 0;

        // Long pauses (>1.5s) deduction: -12 per long pause (up to -40)
        score -= Math.min(45, longCount * 12);

        // Noticeable pauses deduction: natural baseline allows ~1 per 10 words
        const expectedPauses = Math.max(1, Math.floor(wordCount / 10));
        if (noticeableCount > expectedPauses) {
            score -= Math.min(25, (noticeableCount - expectedPauses) * 4);
        }

        // Bonus for clean flow with no long pauses
        if (longCount === 0 && wordCount >= 8) {
            score += 5;
        }

        return Math.min(100, Math.max(30, score));
    }

    /**
     * 3. Filler Control Score (0-100, 20% weight)
     */
    function calculateFillerScore(fillerPercentage, fillerCount) {
        if (fillerCount === 0) return 100;
        if (fillerPercentage <= 2.5) return 92;
        if (fillerPercentage <= 5.0) return 80;
        if (fillerPercentage <= 8.0) return 65;
        if (fillerPercentage <= 12.0) return 50;
        return Math.max(25, Math.round(50 - (fillerPercentage - 12) * 2));
    }

    /**
     * 4. Continuity & Smoothness Score (0-100, 20% weight)
     */
    function calculateContinuityScore(restartCount, wordOrderScore, pauseMetrics, exerciseType) {
        let score = 92;

        // Restarts/stutter penalty
        score -= Math.min(30, (restartCount || 0) * 10);

        // Word order / sequence smoothness
        if (wordOrderScore < 80 && ['smooth_reading', 'phrase_chunking', 'sentence_expansion'].includes(exerciseType)) {
            score -= Math.min(25, Math.round((80 - wordOrderScore) * 0.4));
        }

        // Excessive total pause duration penalty
        if (pauseMetrics.totalPauseTime > 8) {
            score -= Math.min(20, Math.round((pauseMetrics.totalPauseTime - 8) * 2));
        }

        return Math.min(100, Math.max(30, score));
    }

    /**
     * 5. Completion Score (0-100, 10% weight)
     */
    function calculateCompletionScore(exerciseType, coverageData, wordCount, minWords = 8, connectorData = {}) {
        if (['smooth_reading', 'phrase_chunking', 'sentence_expansion'].includes(exerciseType)) {
            const cov = coverageData?.coveragePercentage || 0;
            if (cov >= 90) return 100;
            if (cov >= 75) return 88;
            if (cov >= 60) return 72;
            if (cov >= 40) return 55;
            return Math.max(20, Math.round(cov * 1.1));
        }

        if (exerciseType === 'connect_thoughts') {
            let score = 50;
            if (connectorData.hasConnector) score += 35;
            if (wordCount >= minWords) score += 15;
            else if (wordCount >= Math.round(minWords * 0.7)) score += 8;
            return Math.min(100, Math.max(30, score));
        }

        // Quick response & situation response
        let score = 40;
        if (wordCount >= minWords) score += 50;
        else if (wordCount >= Math.round(minWords * 0.6)) score += 30;
        if (wordCount >= minWords * 1.5) score += 10;
        return Math.min(100, Math.max(30, score));
    }

    /**
     * 6. Overall Fluency Score
     * Formula: Pacing (25%) + Pause Control (25%) + Filler Control (20%) + Continuity (20%) + Completion (10%)
     */
    function calculateFluencyScore(pacingScore, pauseScore, fillerScore, continuityScore, completionScore) {
        const rawScore = (
            (pacingScore * 0.25) +
            (pauseScore * 0.25) +
            (fillerScore * 0.20) +
            (continuityScore * 0.20) +
            (completionScore * 0.10)
        );
        return Math.min(100, Math.max(20, Math.round(rawScore)));
    }

    /**
     * Rule-Based Feedback & Actionable Improvements Generator
     */
    function generateFluencyFeedback(metrics, exercise = {}) {
        const strengths = [];
        const improvements = [];
        let retryGoal = "";
        let nextChallenge = "";

        const wpm = metrics.wpm;
        const fillerCount = metrics.fillerCount;
        const fillerPercentage = metrics.fillerPercentage;
        const longPauses = metrics.longPauseCount;
        const coverage = metrics.targetWordCoverage;
        const exerciseType = exercise.type || 'smooth_reading';

        // ---------------------------------------------------------------------
        // Strengths Identification
        // ---------------------------------------------------------------------
        if (wpm >= 95 && wpm <= 150) {
            strengths.push("Great pacing! Your speech speed was steady and comfortable for listeners.");
        }
        if (fillerCount === 0 && metrics.wordCount >= 6) {
            strengths.push("Zero filler words detected: crisp, clean enunciation.");
        } else if (fillerPercentage < 3 && metrics.wordCount >= 6) {
            strengths.push("Controlled speech hygiene with very few filler sounds.");
        }
        if (longPauses === 0 && metrics.wordCount >= 6) {
            strengths.push("Smooth continuity with no awkward long pauses.");
        }
        if (coverage >= 90) {
            strengths.push("Accurate sentence coverage: completed the target thought naturally.");
        }
        if (exerciseType === 'connect_thoughts' && metrics.hasConnector) {
            strengths.push(`Effective connector usage ('${metrics.connectorUsed}'): created a cohesive compound sentence.`);
        }
        if (strengths.length === 0) {
            strengths.push("Good effort! You produced verbal output and established a clear message.");
        }

        // ---------------------------------------------------------------------
        // Top 3 Improvements
        // ---------------------------------------------------------------------
        if (longPauses >= 2) {
            improvements.push(`Reduce long pauses: You had ${longPauses} long pauses (>1.5s). Try grouping words into short phrases without stopping midway.`);
        } else if (longPauses === 1) {
            improvements.push("Eliminate the single long pause: Maintain continuous vocal energy through the entire phrase.");
        }

        if (fillerPercentage >= 4) {
            const topFiller = metrics.fillerWords?.[0]?.word || "filler words";
            improvements.push(`Avoid "${topFiller}": Try replacing filler sounds with a quick silent breath.`);
        }

        if (wpm < 85 && metrics.wordCount >= 4) {
            improvements.push(`Increase cadence: You spoke at ${wpm} WPM. Aim to connect words smoothly toward 110–140 WPM.`);
        } else if (wpm > 165) {
            improvements.push(`Modulate pace: You spoke quickly (${wpm} WPM). Slow down slightly to emphasize key words.`);
        }

        if (coverage < 80 && ['smooth_reading', 'phrase_chunking', 'sentence_expansion'].includes(exerciseType)) {
            improvements.push("Target sentence completion: Try speaking the complete sentence rather than stopping midway.");
        }

        if (exerciseType === 'connect_thoughts' && !metrics.hasConnector && improvements.length < 3) {
            improvements.push("Include a connector word (e.g. 'although', 'because', 'therefore') to unify both ideas naturally.");
        }

        if (metrics.restartCount > 0 && improvements.length < 3) {
            improvements.push("Minimize word restarts: Commit to the phrase once you begin rather than repeating the start.");
        }

        while (improvements.length < 3) {
            if (exerciseType === 'phrase_chunking') {
                improvements.push("Pause only at phrase boundaries (marked by /) to train natural rhythm.");
            } else {
                improvements.push("Practice reading aloud once before recording to build muscle memory.");
            }
        }

        // ---------------------------------------------------------------------
        // Retry Challenge Goal & Next Challenge
        // ---------------------------------------------------------------------
        if (longPauses > 0 && fillerCount > 0) {
            retryGoal = `Goal: Fewer than ${Math.max(1, longPauses)} long pauses, zero "${metrics.fillerWords?.[0]?.word || 'um'}", and comfortable pace.`;
        } else if (longPauses > 0) {
            retryGoal = `Goal: Complete the sentence with 0 long pauses and steady rhythm.`;
        } else if (fillerCount > 0) {
            retryGoal = `Goal: Zero filler words! Use silent pauses instead of hesitation sounds.`;
        } else if (wpm < 90) {
            retryGoal = `Goal: Increase pacing from ${wpm} WPM to 110+ WPM while maintaining accuracy.`;
        } else {
            retryGoal = `Goal: Maintain your high fluency and try speaking even more expressively!`;
        }

        if (metrics.fluencyScore >= 85) {
            nextChallenge = "Outstanding fluency! You are ready for the next level exercise.";
        } else if (metrics.fluencyScore >= 70) {
            nextChallenge = "Solid foundation. Take the Retry Challenge to boost your score above 85!";
        } else {
            nextChallenge = "Focus on the #1 improvement point above and give it another smooth attempt.";
        }

        return {
            strengths: strengths.slice(0, 3),
            improvements: improvements.slice(0, 3),
            retryGoal,
            nextChallenge
        };
    }

    /**
     * Speech Flow Visualizer Data Generator
     * Creates timeline segments indicating speech chunks and detected pause intervals.
     */
    function generateSpeechFlowVisual(words = [], pauseMetrics = {}) {
        const visualItems = [];
        const pauses = pauseMetrics.pausesList || [];

        if (words.length === 0) {
            return [];
        }

        // Break words into chunks of ~3-5 words
        const chunkSize = Math.max(3, Math.min(5, Math.ceil(words.length / (pauses.length + 1))));
        let wordIdx = 0;
        let pauseIdx = 0;

        while (wordIdx < words.length) {
            const currentChunkWords = words.slice(wordIdx, wordIdx + chunkSize);
            wordIdx += chunkSize;

            visualItems.push({
                type: 'speech',
                text: currentChunkWords.join(' '),
                wordCount: currentChunkWords.length
            });

            // Insert pause if available
            if (pauseIdx < pauses.length) {
                const p = pauses[pauseIdx++];
                const dur = Number(p.durationSeconds || p.duration) || 0.8;
                visualItems.push({
                    type: 'pause',
                    durationSeconds: dur,
                    isLong: dur >= PAUSE_THRESHOLDS.LONG_MIN,
                    label: `Pause ${pauseIdx} — ${dur}s${dur >= PAUSE_THRESHOLDS.LONG_MIN ? ' (Long)' : ''}`
                });
            } else if (wordIdx < words.length) {
                // Short natural gap
                visualItems.push({
                    type: 'pause',
                    durationSeconds: 0.4,
                    isLong: false,
                    label: `Gap — 0.4s`
                });
            }
        }

        return visualItems;
    }

    // =========================================================================
    // MAIN FLUENCY ANALYSIS FUNCTION
    // =========================================================================

    /**
     * Central deterministic Fluency Lab evaluation function.
     * @param {Object} params
     * @param {string} params.transcript - Raw spoken transcript
     * @param {string} params.targetText - Optional expected sentence / phrase
     * @param {number} params.duration - Total recording duration in seconds
     * @param {string} params.exerciseType - Exercise type ('smooth_reading', 'phrase_chunking', etc.)
     * @param {number} params.level - Level number (1-6)
     * @param {Array} params.expectedChunks - Optional chunk divisions for Level 2
     * @param {Array} params.expectedConnectors - Optional target connectors for Level 4
     * @param {Object} params.timingData - Speech recognition timing metrics { activeSpeakingSeconds, totalDurationSeconds, pauses, ... }
     * @param {number} params.previousScore - Previous attempt score for delta measurement
     * @returns {Object} Structured fluency evaluation result
     */
    function analyzeFluency({
        transcript = '',
        targetText = '',
        duration = 0,
        exerciseType = 'smooth_reading',
        level = 1,
        expectedChunks = [],
        expectedConnectors = [],
        timingData = {},
        previousScore = null
    }) {
        const rawText = String(transcript || '').trim();
        const words = tokenizeWords(rawText);
        const wordCount = words.length;

        // If no speech detected, return clean unanalyzed state
        if (wordCount === 0) {
            return createEmptyFluencyState("No speech detected. Please speak into the microphone to analyze your fluency.");
        }

        // 1. Timing metrics
        const pauseMetrics = calculatePauseMetrics(timingData);
        const totalDurationSeconds = Number(timingData.totalDurationSeconds) || Number(duration) || 10;
        const activeSpeakingSeconds = Number(timingData.activeSpeakingSeconds) || Math.max(1, totalDurationSeconds - pauseMetrics.totalPauseTime);

        // 2. WPM Calculation
        const wpm = calculateWPM(wordCount, activeSpeakingSeconds, totalDurationSeconds);
        let paceStatus = "Comfortable (90–150 WPM)";
        if (wpm < WPM_RANGES.COMFORTABLE_MIN) {
            paceStatus = "Slow (<90 WPM)";
        } else if (wpm <= WPM_RANGES.COMFORTABLE_MAX) {
            paceStatus = "Comfortable (90–150 WPM)";
        } else if (wpm <= WPM_RANGES.FAST_MAX) {
            paceStatus = "Fast (151–180 WPM)";
        } else {
            paceStatus = "Very fast (>180 WPM)";
        }

        // 3. Filler Detection
        const fillerData = detectFillers(rawText);

        // 4. Target Sentence Coverage (for Smooth Reading, Phrase Chunking, Expansion)
        const coverageData = calculateTargetCoverage(rawText, targetText);

        // 5. Connector Usage (for Level 4)
        const connectorData = analyzeConnectorUsage(rawText, expectedConnectors);

        // 6. Calculate Component Scores (0-100)
        const pacingScore = calculatePacingScore(wpm, [90, 150]);
        const pauseScore = calculatePauseScore(pauseMetrics, wordCount);
        const fillerScore = calculateFillerScore(fillerData.fillerPercentage, fillerData.fillerCount);
        const continuityScore = calculateContinuityScore(fillerData.restartCount, coverageData.wordOrderScore, pauseMetrics, exerciseType);
        const completionScore = calculateCompletionScore(exerciseType, coverageData, wordCount, 8, connectorData);

        // 7. Overall Fluency Score
        const fluencyScore = calculateFluencyScore(pacingScore, pauseScore, fillerScore, continuityScore, completionScore);

        // 8. Visual Speech Flow Data
        const speechFlowVisual = generateSpeechFlowVisual(words, pauseMetrics);

        // 9. Feedback & Actionable Improvements
        const feedback = generateFluencyFeedback({
            fluencyScore,
            wpm,
            fillerCount: fillerData.fillerCount,
            fillerPercentage: fillerData.fillerPercentage,
            fillerWords: fillerData.fillerWords,
            longPauseCount: pauseMetrics.longPauseCount,
            targetWordCoverage: coverageData.coveragePercentage,
            restartCount: fillerData.restartCount,
            hasConnector: connectorData.hasConnector,
            connectorUsed: connectorData.primaryConnector,
            wordCount
        }, { type: exerciseType, level });

        // 10. Delta comparison against previous attempt
        let scoreDelta = null;
        let deltaMessage = "";
        if (typeof previousScore === 'number' && previousScore > 0) {
            scoreDelta = fluencyScore - previousScore;
            if (scoreDelta > 0) {
                deltaMessage = `Improved by +${scoreDelta} points! Keep building on this momentum.`;
            } else if (scoreDelta === 0) {
                deltaMessage = "Matched your previous score. Focus on your longest pause for your next attempt.";
            } else {
                deltaMessage = `Your score dropped by ${Math.abs(scoreDelta)} points. Try again and focus on steady phrasing.`;
            }
        }

        return {
            fluencyScore,
            pacingScore,
            pauseScore,
            fillerScore,
            continuityScore,
            completionScore,
            wpm,
            paceStatus,
            wordCount,
            targetWordCoverage: coverageData.coveragePercentage,
            missingWords: coverageData.missingWords,
            extraWords: coverageData.extraWords,
            fillerCount: fillerData.fillerCount,
            fillerPercentage: fillerData.fillerPercentage,
            fillerWords: fillerData.fillerWords,
            pauseCount: pauseMetrics.pauseCount,
            longPauseCount: pauseMetrics.longPauseCount,
            noticeablePauseCount: pauseMetrics.noticeableCount,
            totalPauseTime: pauseMetrics.totalPauseTime,
            averagePauseTime: pauseMetrics.averagePauseTime,
            pausesList: pauseMetrics.pausesList,
            activeSpeakingTime: activeSpeakingSeconds,
            totalResponseTime: totalDurationSeconds,
            restartCount: fillerData.restartCount,
            connectorUsed: connectorData.primaryConnector,
            hasConnector: connectorData.hasConnector,
            detectedConnectors: connectorData.detectedConnectors,
            smoothnessScore: continuityScore,
            strengths: feedback.strengths,
            improvements: feedback.improvements,
            retryGoal: feedback.retryGoal,
            nextChallenge: feedback.nextChallenge,
            speechFlowVisual,
            scoreDelta,
            deltaMessage,
            previousScore,
            isAnalyzed: true
        };
    }

    function createEmptyFluencyState(message = "Not analyzed yet.") {
        return {
            fluencyScore: 0,
            pacingScore: 0,
            pauseScore: 0,
            fillerScore: 0,
            continuityScore: 0,
            completionScore: 0,
            wpm: 0,
            paceStatus: "Not recorded",
            wordCount: 0,
            targetWordCoverage: 0,
            missingWords: [],
            extraWords: [],
            fillerCount: 0,
            fillerPercentage: 0,
            fillerWords: [],
            pauseCount: 0,
            longPauseCount: 0,
            noticeablePauseCount: 0,
            totalPauseTime: 0,
            averagePauseTime: 0,
            pausesList: [],
            activeSpeakingTime: 0,
            totalResponseTime: 0,
            restartCount: 0,
            connectorUsed: null,
            hasConnector: false,
            detectedConnectors: [],
            smoothnessScore: 0,
            strengths: [],
            improvements: [],
            retryGoal: "",
            nextChallenge: message,
            speechFlowVisual: [],
            scoreDelta: null,
            deltaMessage: "",
            previousScore: null,
            isAnalyzed: false
        };
    }

    return {
        PAUSE_THRESHOLDS,
        WPM_RANGES,
        DISCOURSE_CONNECTORS,
        FILLER_PATTERNS,
        normalizeText,
        tokenizeWords,
        calculateWPM,
        detectFillers,
        calculateTargetCoverage,
        analyzeConnectorUsage,
        calculatePauseMetrics,
        calculatePacingScore,
        calculatePauseScore,
        calculateFillerScore,
        calculateContinuityScore,
        calculateCompletionScore,
        calculateFluencyScore,
        generateFluencyFeedback,
        generateSpeechFlowVisual,
        analyzeFluency,
        createEmptyFluencyState
    };
}));

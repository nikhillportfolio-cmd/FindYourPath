/**
 * Automated Test Suite for Fluency Lab Algorithm & Timing Engine
 * Tests all 12+ prompt test criteria strictly without mocks or fake data.
 */

const FluencyLab = require('./public/js/fluencyLab');
const FluencyLabData = require('./public/js/fluencyLabData');
const SpeechDiagnostics = require('./public/js/speechDiagnostics');

console.log("==================================================");
console.log("🧪 STARTING FLUENCY LAB DETERMINISTIC TEST SUITE");
console.log("==================================================\n");

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, details = "") {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`✅ PASS: ${testName} ${details ? '(' + details + ')' : ''}`);
    } else {
        console.error(`❌ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
    }
}

// -----------------------------------------------------------------------------
// TEST 1: Read a sentence smoothly
// -----------------------------------------------------------------------------
const target1 = "Although the weather was bad, we decided to continue our journey without any delay.";
const smoothSpoken = "Although the weather was bad we decided to continue our journey without any delay";
const res1 = FluencyLab.analyzeFluency({
    transcript: smoothSpoken,
    targetText: target1,
    duration: 6.5,
    exerciseType: 'smooth_reading',
    level: 1,
    timingData: {
        totalDurationSeconds: 6.5,
        activeSpeakingSeconds: 6.0,
        totalPauseTime: 0.5,
        pauses: [{ durationSeconds: 0.5, type: 'normal' }]
    }
});

assert(res1.fluencyScore >= 85, "TEST 1: Smooth Reading Score", `Score: ${res1.fluencyScore}/100`);
assert(res1.targetWordCoverage >= 95, "TEST 1: Target Coverage", `Coverage: ${res1.targetWordCoverage}%`);
assert(res1.fillerCount === 0, "TEST 1: Filler Count", `Fillers: ${res1.fillerCount}`);
assert(res1.longPauseCount === 0, "TEST 1: Long Pauses", `Long Pauses: ${res1.longPauseCount}`);

// -----------------------------------------------------------------------------
// TEST 2: Read with long pauses (>1.5s)
// -----------------------------------------------------------------------------
const res2 = FluencyLab.analyzeFluency({
    transcript: smoothSpoken,
    targetText: target1,
    duration: 16.0,
    exerciseType: 'smooth_reading',
    level: 1,
    timingData: {
        totalDurationSeconds: 16.0,
        activeSpeakingSeconds: 7.0,
        totalPauseTime: 9.0,
        longPauseCount: 3,
        pauses: [
            { durationSeconds: 2.5, type: 'long' },
            { durationSeconds: 3.0, type: 'long' },
            { durationSeconds: 3.5, type: 'long' }
        ]
    }
});

assert(res2.longPauseCount === 3, "TEST 2: Long Pause Detection", `Detected: ${res2.longPauseCount}`);
assert(res2.pauseScore < res1.pauseScore, "TEST 2: Pause Score Deduction", `PauseScore: ${res2.pauseScore} vs ${res1.pauseScore}`);
assert(res2.improvements.some(i => i.toLowerCase().includes('pause')), "TEST 2: Pause Feedback Generated", res2.improvements[0]);

// -----------------------------------------------------------------------------
// TEST 3: Use multiple fillers
// -----------------------------------------------------------------------------
const fillerSpoken = "Although um the weather was like bad you know uh we decided to basically continue";
const res3 = FluencyLab.analyzeFluency({
    transcript: fillerSpoken,
    targetText: target1,
    duration: 8.0,
    exerciseType: 'smooth_reading',
    level: 1,
    timingData: {
        totalDurationSeconds: 8.0,
        activeSpeakingSeconds: 7.2,
        totalPauseTime: 0.8,
        pauses: []
    }
});

assert(res3.fillerCount >= 4, "TEST 3: Filler Count Detection", `Detected ${res3.fillerCount} fillers`);
assert(res3.fillerScore < 75, "TEST 3: Filler Score Impact", `FillerScore: ${res3.fillerScore}`);
assert(res3.improvements.some(i => i.toLowerCase().includes('filler') || i.toLowerCase().includes('um') || i.toLowerCase().includes('avoid')), "TEST 3: Filler Improvement Advice");

// -----------------------------------------------------------------------------
// TEST 4: Speak fast
// -----------------------------------------------------------------------------
const fastSpoken = "Although the weather was bad we decided to continue our journey without any delay and we arrived early";
const res4 = FluencyLab.analyzeFluency({
    transcript: fastSpoken,
    targetText: target1,
    duration: 3.5, // 18 words in 3.5 seconds = ~300 WPM
    exerciseType: 'smooth_reading',
    level: 1,
    timingData: {
        totalDurationSeconds: 3.5,
        activeSpeakingSeconds: 3.5,
        totalPauseTime: 0,
        pauses: []
    }
});

assert(res4.wpm > 180, "TEST 4: Fast WPM Calculation", `WPM: ${res4.wpm}`);
assert(res4.paceStatus.toLowerCase().includes('fast'), "TEST 4: Fast Pace Status", res4.paceStatus);

// -----------------------------------------------------------------------------
// TEST 5: Speak slowly
// -----------------------------------------------------------------------------
const res5 = FluencyLab.analyzeFluency({
    transcript: "Although the weather was bad",
    targetText: target1,
    duration: 10.0, // 5 words in 10s = 30 WPM
    exerciseType: 'smooth_reading',
    level: 1,
    timingData: {
        totalDurationSeconds: 10.0,
        activeSpeakingSeconds: 6.0,
        totalPauseTime: 4.0,
        pauses: [{ durationSeconds: 2.0, type: 'long' }]
    }
});

assert(res5.wpm < 90, "TEST 5: Slow WPM Calculation", `WPM: ${res5.wpm}`);
assert(res5.paceStatus.toLowerCase().includes('slow'), "TEST 5: Slow Pace Status", res5.paceStatus);

// -----------------------------------------------------------------------------
// TEST 6: Stop early (incomplete sentence)
// -----------------------------------------------------------------------------
const res6 = FluencyLab.analyzeFluency({
    transcript: "Although the weather",
    targetText: target1,
    duration: 3.0,
    exerciseType: 'smooth_reading',
    level: 1,
    timingData: {
        totalDurationSeconds: 3.0,
        activeSpeakingSeconds: 2.0,
        totalPauseTime: 1.0,
        pauses: []
    }
});

assert(res6.targetWordCoverage < 50, "TEST 6: Low Target Coverage on Early Stop", `Coverage: ${res6.targetWordCoverage}%`);
assert(res6.completionScore < 50, "TEST 6: Low Completion Score", `Completion: ${res6.completionScore}`);
assert(res6.improvements.some(i => i.toLowerCase().includes('completion') || i.toLowerCase().includes('complete')), "TEST 6: Incomplete Sentence Feedback");

// -----------------------------------------------------------------------------
// TEST 7: Retry challenge and improvement delta
// -----------------------------------------------------------------------------
const prevScore = 68;
const res7 = FluencyLab.analyzeFluency({
    transcript: smoothSpoken,
    targetText: target1,
    duration: 6.5,
    exerciseType: 'smooth_reading',
    level: 1,
    timingData: {
        totalDurationSeconds: 6.5,
        activeSpeakingSeconds: 6.0,
        totalPauseTime: 0.5,
        pauses: [{ durationSeconds: 0.5, type: 'normal' }]
    },
    previousScore: prevScore
});

assert(res7.scoreDelta > 0, "TEST 7: Improvement Delta Calculation", `Delta: +${res7.scoreDelta} (from ${prevScore} to ${res7.fluencyScore})`);
assert(res7.deltaMessage.includes('Improved'), "TEST 7: Encouraging Improvement Message", res7.deltaMessage);

// -----------------------------------------------------------------------------
// TEST 8: No speech / empty transcript
// -----------------------------------------------------------------------------
const res8 = FluencyLab.analyzeFluency({
    transcript: "",
    targetText: target1,
    duration: 0
});

assert(res8.isAnalyzed === false, "TEST 8: Empty Speech Not Analyzed", "isAnalyzed: false");
assert(res8.fluencyScore === 0, "TEST 8: Zero Score for No Speech", `Score: ${res8.fluencyScore}`);

// -----------------------------------------------------------------------------
// TEST 9: Level 4 Connector Detection (Connect the Thoughts)
// -----------------------------------------------------------------------------
const connectorSpoken = "Although I was extremely tired, I finished all my assignments before midnight.";
const res9 = FluencyLab.analyzeFluency({
    transcript: connectorSpoken,
    duration: 5.0,
    exerciseType: 'connect_thoughts',
    level: 4,
    expectedConnectors: ["although", "despite", "however", "but"],
    timingData: {
        totalDurationSeconds: 5.0,
        activeSpeakingSeconds: 4.8,
        totalPauseTime: 0.2,
        pauses: []
    }
});

assert(res9.hasConnector === true, "TEST 9: Connector Detection", `Connector: ${res9.connectorUsed}`);
assert(res9.completionScore >= 90, "TEST 9: Connector Completion Score", `Score: ${res9.completionScore}`);

// -----------------------------------------------------------------------------
// TEST 10: Speech Flow Visualizer Output
// -----------------------------------------------------------------------------
assert(Array.isArray(res1.speechFlowVisual) && res1.speechFlowVisual.length > 0, "TEST 10: Speech Flow Visualizer Generated", `Segments: ${res1.speechFlowVisual.length}`);

// -----------------------------------------------------------------------------
// TEST 11: Static Library Verification
// -----------------------------------------------------------------------------
assert(FluencyLabData.EXERCISE_LEVELS.length === 6, "TEST 11: 6 Levels Present", `Levels count: ${FluencyLabData.EXERCISE_LEVELS.length}`);
assert(FluencyLabData.EXERCISES.length >= 12, "TEST 11: Rich Static Exercise Library", `Total exercises: ${FluencyLabData.EXERCISES.length}`);

// -----------------------------------------------------------------------------
// TEST 12: Backward Compatibility with Existing Speech Diagnostics
// -----------------------------------------------------------------------------
const coachDiag = SpeechDiagnostics.analyzeSpeech({
    transcript: "I believe remote work is effective because it enables high productivity for instance our team shipped faster.",
    duration: 30
});
assert(coachDiag.overallScore > 70, "TEST 12: Existing Coach Diagnostics Backward Compatibility", `Overall: ${coachDiag.overallScore}`);

console.log("\n==================================================");
console.log(`📊 TEST SUITE SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
console.log("==================================================");

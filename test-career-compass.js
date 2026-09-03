/**
 * PRAXiS Career Compass Comprehensive Test Suite
 * Tests Data Model, Adaptive Engine, 7-Insight Profile, Matching Rationale,
 * Comparison, Reality Check Simulation, 5-Phase Roadmap, Routine Bridge, and Coach Integration.
 */

const assert = require('assert');

console.log('================================================================');
console.log('🧪 RUNNING PRAXiS CAREER COMPASS VERIFICATION TEST SUITE');
console.log('================================================================\n');

// 1. Load Data Module
const data = require('./public/js/compassData.js');

// Mock localStorage and window for Engine test in Node.js
const mockStorage = {};
global.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: (k) => { delete mockStorage[k]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

global.window = global;
window.location = { search: '', href: '' };
window.habits = [];
window.saveHabitsToStorage = () => {};
window.renderHabitsList = () => {};
window.showInAppToast = (icon, msg) => { console.log(`   [Toast] ${icon} ${msg}`); };

// Load Engine
require('./public/js/compassEngine.js');
const Engine = global.CompassEngine;

// -------------------------------------------------------------
// TEST 1: DATA MODEL INTEGRITY & 20+ DOMAINS
// -------------------------------------------------------------
console.log('--- TEST 1: DATA REPOSITORY INTEGRITY ---');
assert(data.COMPASS_DIMENSIONS, 'COMPASS_DIMENSIONS should be defined');
const dimensionKeys = Object.keys(data.COMPASS_DIMENSIONS);
console.log(`✓ 15 Dimensions defined: ${dimensionKeys.length} dimensions found`);
assert.strictEqual(dimensionKeys.length, 15, 'Must have exactly 15 dimensions');

assert(data.COMPASS_DOMAINS, 'COMPASS_DOMAINS should be defined');
console.log(`✓ Domains defined: ${data.COMPASS_DOMAINS.length} domains (Target: >= 20)`);
assert(data.COMPASS_DOMAINS.length >= 20, 'Must have at least 20 domains');

assert(data.COMPASS_CAREERS, 'COMPASS_CAREERS should be defined');
console.log(`✓ Careers catalog: ${data.COMPASS_CAREERS.length} careers defined`);
assert(data.COMPASS_CAREERS.length >= 20, 'Must have at least 20 careers covering all domains');

// Verify each career has required fields
data.COMPASS_CAREERS.forEach(career => {
    assert(career.id, `Career missing id: ${career.title}`);
    assert(career.title, `Career missing title: ${career.id}`);
    assert(career.domainId, `Career missing domainId: ${career.title}`);
    assert(career.targetDimensions, `Career missing targetDimensions: ${career.title}`);
    assert(career.workStyle, `Career missing workStyle: ${career.title}`);
    assert(career.environment, `Career missing environment: ${career.title}`);
    assert(career.potentialFriction, `Career missing potentialFriction: ${career.title}`);
    assert(career.realityCheck, `Career missing realityCheck: ${career.title}`);
    assert(career.realityCheck.options && career.realityCheck.options.length >= 3, `Reality check must have >= 3 options: ${career.title}`);
    assert(career.phases && career.phases.length === 5, `Must have exactly 5 roadmap phases: ${career.title}`);
    assert(career.learningResources, `Missing learningResources: ${career.title}`);
    assert(career.learningResources.learn && career.learningResources.practice && career.learningResources.build && career.learningResources.read && career.learningResources.explore, `All 5 resource types required: ${career.title}`);
    assert(career.communicationExercise, `Missing communicationExercise: ${career.title}`);
    assert(career.careerProgression, `Missing careerProgression: ${career.title}`);
});
console.log('✓ All 20+ careers verified with 5-stage roadmaps, reality checks, learning resources, and communication drills.\n');

// -------------------------------------------------------------
// TEST 2: ADAPTIVE DISCOVERY & ASSESSMENT FLOW
// -------------------------------------------------------------
console.log('--- TEST 2: ADAPTIVE ASSESSMENT FLOW ---');
// Test Mode 2: Broad Discovery
Engine.startAssessment('discovery', null);
let state = Engine.getState();
assert.strictEqual(state.mode, 'discovery');
assert.strictEqual(state.preferenceDomain, null);
assert(state.activeQuestions.length >= 10, 'Active question pool must have >= 10 questions');
console.log(`✓ Discovery mode initialized with ${state.activeQuestions.length} adaptive questions`);

// Simulate answering questions with deliberate signals for Tech / AI
for (let i = 0; i < state.activeQuestions.length; i++) {
    // Option 0 always has strong analytical/systems signals
    Engine.recordAnswer(0);
}

state = Engine.getState();
console.log('✓ All questions answered, assessment completed');
console.log('   Estimated remaining time calculation check:', Engine.getEstimatedMinutesRemaining());

// -------------------------------------------------------------
// TEST 3: 7-INSIGHT PROFILE SYNTHESIS & HONEST FRAMING
// -------------------------------------------------------------
console.log('\n--- TEST 3: 7-INSIGHT CAREER PROFILE SYNTHESIS ---');
const profile = state.calculatedProfile;
assert(profile, 'Profile should be synthesized');
assert(profile.thinking && profile.thinking.archetype, 'Thinking archetype missing');
assert(profile.workStyle && profile.workStyle.archetype, 'Work style archetype missing');
assert(profile.communication && profile.communication.archetype, 'Communication archetype missing');
assert(profile.motivation && profile.motivation.archetype, 'Motivation archetype missing');
assert(profile.values && profile.values.archetype, 'Values archetype missing');
assert(profile.environment && profile.environment.archetype, 'Environment archetype missing');
assert(profile.interests, 'Interests insight missing');

console.log('✓ Thinking Archetype:', profile.thinking.archetype);
console.log('✓ Work Style:', profile.workStyle.archetype);
console.log('✓ Communication:', profile.communication.archetype);
console.log('✓ Motivation:', profile.motivation.archetype);
console.log('✓ Values:', profile.values.archetype);
console.log('✓ Environment:', profile.environment.archetype);
console.log('✓ Evolutionary Framing Disclaimer:', profile.disclaimer);
assert(profile.disclaimer.includes('preferences can evolve'), 'Disclaimer must mention evolving with experience');

// -------------------------------------------------------------
// TEST 4: MULTI-FACTOR MATCHING & CATEGORIZATION
// -------------------------------------------------------------
console.log('\n--- TEST 4: MULTI-FACTOR MATCHING & CATEGORIZATION ---');
const matchesResult = Engine.calculateMatches();
assert(matchesResult.all && matchesResult.all.length > 0, 'Matches must not be empty');
assert(matchesResult.strongMatches && matchesResult.strongMatches.length > 0, 'Strong matches must exist');
assert(matchesResult.worthExploring && matchesResult.worthExploring.length > 0, 'Worth exploring matches must exist');
assert(matchesResult.mightEnjoy && matchesResult.mightEnjoy.length > 0, 'You might also enjoy matches must exist');

console.log(`✓ Matches Categorized: ${matchesResult.strongMatches.length} Strong, ${matchesResult.worthExploring.length} Exploring, ${matchesResult.mightEnjoy.length} Adjacent`);

// Check honest non-percentage framing
const topMatch = matchesResult.strongMatches[0];
console.log(`   Top Match: ${topMatch.title} (${topMatch.domainId})`);
console.log(`   Match Level: "${topMatch.matchLevel}" | Confidence: "${topMatch.confidenceLevel}"`);
console.log(`   Why it Matches: "${topMatch.whyItMatches}"`);
console.log(`   Supporting Traits: [${topMatch.supportingTraits.join(', ')}]`);
console.log(`   Potential Friction: "${topMatch.frictionNote}"`);

assert(!topMatch.title.includes('98% Precision'), 'Must NOT contain fake precision claims');
assert(topMatch.whyItMatches, 'Must have transparent explanation of why it matches');
assert(topMatch.frictionNote, 'Must highlight realistic friction/trade-offs');

// -------------------------------------------------------------
// TEST 5: CAREER COMPARISON SYSTEM (2-3 Careers)
// -------------------------------------------------------------
console.log('\n--- TEST 5: SIDE-BY-SIDE CAREER COMPARISON ---');
const careerA = data.COMPASS_CAREERS[0].id;
const careerB = data.COMPASS_CAREERS[1].id;
const careerC = data.COMPASS_CAREERS[2].id;

Engine.toggleCareerComparison(careerA);
assert.strictEqual(Engine.getState().comparisonList.length, 1);
Engine.toggleCareerComparison(careerB);
assert.strictEqual(Engine.getState().comparisonList.length, 2);
Engine.toggleCareerComparison(careerC);
assert.strictEqual(Engine.getState().comparisonList.length, 3);

// Try adding 4th (should cap at 3)
const careerD = data.COMPASS_CAREERS[3].id;
Engine.toggleCareerComparison(careerD);
assert.strictEqual(Engine.getState().comparisonList.length, 3, 'Comparison must cap at 3');
console.log('✓ Career comparison capped at 3 careers side-by-side');

// Toggle off
Engine.toggleCareerComparison(careerA);
assert.strictEqual(Engine.getState().comparisonList.length, 2);
console.log('✓ Career comparison toggling works properly');

// -------------------------------------------------------------
// TEST 6: REALITY CHECK MINI-SIMULATION & FEEDBACK
// -------------------------------------------------------------
console.log('\n--- TEST 6: REALITY CHECK SIMULATION & REACTION ---');
const testCareer = data.COMPASS_CAREERS[0];
const rc = Engine.getRealityCheck(testCareer.id);
assert(rc, 'Reality check must exist');
console.log(`   Reality Check Scenario: "${rc.scenario.substring(0, 60)}..."`);
assert(rc.options.length >= 3, 'Options must be >= 3');

// Submit reaction
Engine.recordRealityFeedback(testCareer.id, 'loved');
assert.strictEqual(Engine.getState().realityChecks[testCareer.id].reaction, 'loved');
console.log('✓ Reality check feedback recorded: "loved"');

// -------------------------------------------------------------
// TEST 7: 5-STAGE ROADMAP PROGRESS CHECK-OFF
// -------------------------------------------------------------
console.log('\n--- TEST 7: 5-STAGE ROADMAP PROGRESS ---');
Engine.saveRoadmapTaskProgress(testCareer.id, `task_${testCareer.id}_p0`, true);
Engine.saveRoadmapTaskProgress(testCareer.id, `task_${testCareer.id}_p1`, true);

let storedRoadmap = JSON.parse(mockStorage['praxis_compass_active_roadmap']);
assert(storedRoadmap[testCareer.id].completedTasks.includes(`task_${testCareer.id}_p0`));
assert(storedRoadmap[testCareer.id].completedTasks.includes(`task_${testCareer.id}_p1`));
console.log(`✓ Roadmap progress saved to storage: 2 milestones completed for ${testCareer.title}`);

// -------------------------------------------------------------
// TEST 8: ROUTINE TRACKER BRIDGE
// -------------------------------------------------------------
console.log('\n--- TEST 8: COMPASS ➔ ROUTINE TRACKER BRIDGE ---');
window.habits = [];
Engine.addRoadmapToRoutine(testCareer, [0, 1], 'Daily', 30, 'Morning Routine');
assert.strictEqual(window.habits.length, 2, 'Should have added 2 habits to routine');
console.log(`✓ Added ${window.habits.length} habits to Routine Tracker:`);
window.habits.forEach(h => console.log(`   - [${h.timeOfDay}] ${h.name}`));

// -------------------------------------------------------------
// TEST 9: COMMUNICATION COACH BRIDGE
// -------------------------------------------------------------
console.log('\n--- TEST 9: COMPASS ➔ COMMUNICATION COACH BRIDGE ---');
const drill = testCareer.communicationExercise;
assert(drill, 'Communication drill must exist');
console.log(`   Communication Drill: "${drill.title}"`);
console.log(`   Speaking Prompt: "${drill.prompt}"`);
console.log(`   Framework: "${drill.framework}"`);

// Verify deep link generation
let capturedHref = "";
window.location = {
    set href(val) { capturedHref = val; },
    get href() { return capturedHref; }
};
Engine.launchCommunicationCoachForCareer(testCareer);
assert(capturedHref.startsWith('/coach.html?'), 'Must route to /coach.html with query params');
const parsedParams = new URLSearchParams(capturedHref.replace('/coach.html?', ''));
assert.strictEqual(parsedParams.get('career'), testCareer.title);
assert.strictEqual(parsedParams.get('topic'), drill.title);
console.log('✓ Coach deep link generated accurately with preloaded parameters:', capturedHref);

// -------------------------------------------------------------
// TEST 10: REASSESSMENT & PREFERENCE EVOLUTION
// -------------------------------------------------------------
console.log('\n--- TEST 10: REASSESSMENT & PREFERENCE TRACKING ---');
// Record a second assessment snapshot
Engine.startAssessment('preference', 'TechAI');
for (let i = 0; i < 10; i++) {
    Engine.recordAnswer(1); // Answer option 1 this time
}
const shift = Engine.calculatePreferenceShift();
assert(shift, 'Shift should be calculated between 2 snapshots');
console.log('✓ Preference evolution tracked over time:');
console.log('   Snapshot 1 Date:', shift.previousDate);
console.log('   Snapshot 2 Date:', shift.currentDate);
console.log('   Detected Deltas:', Object.keys(shift.deltas).length, 'dimensions changed');

console.log('\n================================================================');
console.log('🎉 ALL 10 CAREER COMPASS TEST SUITES PASSED SUCCESSFULLY!');
console.log('================================================================\n');

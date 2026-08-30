const fs = require('fs');
const path = require('path');

// =====================================================================
// COMMUNICATION COACH - REAL-TIME ENGLISH FLUENCY & SPEECH ENGINE
// =====================================================================

// Comprehensive Filler Words & Crutch Phrases Dictionary
const FILLER_PATTERNS = [
    { word: "um", regex: /\b(um+)\b/gi },
    { word: "uh", regex: /\b(uh+)\b/gi },
    { word: "er", regex: /\b(er+)\b/gi },
    { word: "ah", regex: /\b(ah+)\b/gi },
    { word: "like", regex: /\b(like)\b/gi, contextSensitive: true },
    { word: "basically", regex: /\b(basically)\b/gi },
    { word: "you know", regex: /\b(you know)\b/gi },
    { word: "actually", regex: /\b(actually)\b/gi },
    { word: "literally", regex: /\b(literally)\b/gi },
    { word: "sort of", regex: /\b(sort of)\b/gi },
    { word: "kind of", regex: /\b(kind of)\b/gi },
    { word: "i mean", regex: /\b(i mean)\b/gi },
    { word: "to be honest", regex: /\b(to be honest|tbh)\b/gi },
    { word: "you see", regex: /\b(you see)\b/gi },
    { word: "right", regex: /\b(right\?|right\,)\b/gi },
    { word: "so yeah", regex: /\b(so yeah)\b/gi },
    { word: "stuff like that", regex: /\b(stuff like that|and stuff)\b/gi }
];

// Hedging & Non-Assertive Phrases (Executive presence killer)
const HEDGING_PATTERNS = [
    { phrase: "i feel like", replacement: "I recommend / The data indicates" },
    { phrase: "i think maybe", replacement: "In my assessment" },
    { phrase: "probably", replacement: "We anticipate / Projections show" },
    { phrase: "just", replacement: "[Omit for authority]" },
    { phrase: "hopefully", replacement: "Our target is" },
    { phrase: "in my humble opinion", replacement: "From my perspective" },
    { phrase: "sorry if this is wrong", replacement: "[State observation directly]" },
    { phrase: "i guess", replacement: "I determine" },
    { phrase: "sort of like", replacement: "Comparable to" }
];

// Advanced Vocabulary & Corporate / Native Upgrade Dictionary
const VOCAB_UPGRADE_MAP = {
    "good": ["exceptional", "exemplary", "formidable", "advantageous", "compelling"],
    "bad": ["suboptimal", "detrimental", "counterproductive", "deficient", "flawed"],
    "big": ["substantial", "monumental", "extensive", "momentous", "paramount"],
    "small": ["marginal", "negligible", "compact", "incremental", "modest"],
    "help": ["facilitate", "empower", "bolster", "accelerate", "catalyze"],
    "solve": ["remediate", "mitigate", "troubleshoot", "resolve", "rectify"],
    "make": ["formulate", "fabricate", "spearhead", "orchestrate", "execute"],
    "hard": ["formidable", "onerous", "intricate", "demanding", "rigorous"],
    "change": ["transform", "pivot", "recalibrate", "overhaul", "diversify"],
    "show": ["demonstrate", "exemplify", "illustrate", "manifest", "substantiate"],
    "think": ["anticipate", "envision", "conceptualize", "postulate", "determine"],
    "very": ["exceedingly", "markedly", "profoundly", "substantially", "exceptionally"],
    "problem": ["impediment", "bottleneck", "discrepancy", "vulnerability", "hurdle"],
    "happy": ["gratified", "thrilled", "exhilarated", "delighted", "optimistic"],
    "stop": ["halt", "curtail", "terminate", "discontinue", "suppress"],
    "talk": ["articulate", "collaborate", "convey", "deliberate", "negotiate"]
};

// Common Grammar Rules & Detection Heuristics
const GRAMMAR_RULES = [
    {
        regex: /\b(he|she|it)\s+(don't)\b/gi,
        match: "he/she/it don't",
        corrected: "$1 doesn't",
        explanation: "Use third-person singular 'doesn't' with he/she/it, not 'don't'."
    },
    {
        regex: /\b(i|we|they|you)\s+(doesn't)\b/gi,
        match: "doesn't",
        corrected: "don't",
        explanation: "Use 'don't' with first/second person or plural pronouns."
    },
    {
        regex: /\b(could|should|would)\s+of\b/gi,
        match: "could/should/would of",
        corrected: "$1 have",
        explanation: "Use modal verb + 'have' (e.g., 'could have'), not 'of'."
    },
    {
        regex: /\b(in\s+the\s+other\s+hand)\b/gi,
        match: "in the other hand",
        corrected: "on the other hand",
        explanation: "The correct prepositional idiom is 'on the other hand'."
    },
    {
        regex: /\b(more\s+better|more\s+easier|more\s+faster)\b/gi,
        match: "double comparative",
        corrected: (m) => m.replace(/more\s+/i, ''),
        explanation: "Avoid double comparatives. Use 'better', 'easier', or 'faster' alone."
    },
    {
        regex: /\b(every\s+people|all\s+person)\b/gi,
        match: "every people",
        corrected: "everyone / all people",
        explanation: "'Every' modifies singular nouns (everyone/every person); 'people' is plural."
    },
    {
        regex: /\b(i\s+am\s+agree)\b/gi,
        match: "I am agree",
        corrected: "I agree / I am in agreement",
        explanation: "'Agree' is a verb. Say 'I agree', not 'I am agree'."
    },
    {
        regex: /\b(discuss\s+about)\b/gi,
        match: "discuss about",
        corrected: "discuss",
        explanation: "'Discuss' is transitive and directly takes an object without 'about'."
    }
];

// Curated Practice Topics Database across 4 Modes
const PRACTICE_TOPICS = {
    express: [
        {
            id: "exp-1",
            title: "Remote Work vs. Hybrid Model",
            prompt: "Should remote work completely replace traditional office work in the future, or is a hybrid model the only sustainable path?",
            framework: "PREP (Point, Reason, Example, Point)",
            duration: 60,
            category: "Workplace & Technology"
        },
        {
            id: "exp-2",
            title: "Artificial Intelligence in Daily Decisions",
            prompt: "Will relying on AI for everyday micro-decisions diminish human critical thinking skills?",
            framework: "PREP (Point, Reason, Example, Point)",
            duration: 60,
            category: "Technology & Ethics"
        },
        {
            id: "exp-3",
            title: "The Definition of True Career Success",
            prompt: "Is career success better measured by financial compensation, societal impact, or work-life harmony?",
            framework: "PREP (Point, Reason, Example, Point)",
            duration: 60,
            category: "Career & Philosophy"
        },
        {
            id: "exp-4",
            title: "Social Media and Public Discourse",
            prompt: "Has algorithmic social media connected humanity closer or fractured our ability to have meaningful debates?",
            framework: "PREP (Point, Reason, Example, Point)",
            duration: 60,
            category: "Society & Culture"
        },
        {
            id: "exp-5",
            title: "Continuous Learning vs. Deep Specialization",
            prompt: "In a rapidly evolving economy, is it more advantageous to be a broad generalist or a deep specialist?",
            framework: "PREP (Point, Reason, Example, Point)",
            duration: 60,
            category: "Personal Growth"
        }
    ],
    interview: [
        {
            id: "int-1",
            title: "Handling High-Stakes Project Failure",
            prompt: "Tell me about a time when a critical project missed its objective or failed. How did you handle the situation and what did you learn?",
            framework: "STAR (Situation, Task, Action, Result)",
            targetRole: "Executive / Management",
            category: "Behavioral"
        },
        {
            id: "int-2",
            title: "Navigating Conflict with a Senior Stakeholder",
            prompt: "Describe a scenario where you strongly disagreed with a team lead or client on a technical direction. How did you resolve it?",
            framework: "STAR (Situation, Task, Action, Result)",
            targetRole: "Technical Lead / Product",
            category: "Leadership"
        },
        {
            id: "int-3",
            title: "30-Second Elevator Pitch: 'Why Should We Hire You?'",
            prompt: "Synthesize your unique professional value proposition in under 60 seconds. Why are you the standout candidate for this role?",
            framework: "Value Hook + Proof Point + Future Impact",
            targetRole: "All Roles",
            category: "Pitching"
        },
        {
            id: "int-4",
            title: "Negotiating Deadlines and Scope Creep",
            prompt: "Your executive team requests three major new features two weeks before release. How do you push back assertively yet collaboratively?",
            framework: "Acknowledge + Trade-off Matrix + Proposed Alternative",
            targetRole: "Project & Product Management",
            category: "Executive Negotiation"
        }
    ],
    casual: [
        {
            id: "cas-1",
            title: "Spontaneous Weekend Adventure Story",
            prompt: "Share an unexpected travel memory or weekend trip where things didn't go according to plan, but ended up memorable.",
            focus: "Connected speech, phrasal verbs, descriptive imagery",
            category: "Storytelling & Social"
        },
        {
            id: "cas-2",
            title: "Recommending a Transformative Book or Movie",
            prompt: "Recommend a book, movie, or series that changed how you view the world. Convince a friend to check it out tonight!",
            focus: "Natural enthusiasm, conversational idioms, active rhythm",
            category: "Social Connection"
        },
        {
            id: "cas-3",
            title: "The Great Debate: City Living vs. Countryside Serenity",
            prompt: "If you had to pick one place to reside for the next decade without moving, would you choose a bustling metropolis or a quiet coastal town?",
            focus: "Casual conversational flow, tone inflection, expressing preferences",
            category: "Daily Debates"
        }
    ],
    ielts: [
        {
            id: "ielts-1",
            title: "IELTS Speaking Part 2: Memorable City or Journey",
            prompt: "Describe an interesting city or town you have visited. You should say: where it is, why you went there, what you did, and explain why you found it fascinating.",
            framework: "Cue Card Structure (Intro, Details, Narrative Arc, Reflection)",
            duration: 120,
            category: "IELTS Speaking Part 2"
        },
        {
            id: "ielts-2",
            title: "IELTS Speaking Part 3: Urbanization and Environment",
            prompt: "How does rapid urban development affect the lifestyle of residents, and what measures can governments take to maintain green spaces?",
            framework: "Analytical Thesis + Dual Perspectives + Long-Term Outlook",
            duration: 60,
            category: "IELTS Speaking Part 3"
        },
        {
            id: "ielts-3",
            title: "TOEFL Independent Speaking: Technology in Education",
            prompt: "Some universities require students to attend in-person lectures, while others offer fully digital classrooms. Which system do you prefer and why?",
            framework: "Clear Preference + 2 Well-Supported Reasons + Conclusion",
            duration: 45,
            category: "TOEFL Speaking"
        }
    ]
};

// =====================================================================
// LOCAL NLP EVALUATION & DIAGNOSTIC ENGINE
// =====================================================================

function analyzeSpeechDiagnostics(transcript, mode = 'express', timeSpentSeconds = 60, targetRole = '') {
    const rawText = String(transcript || '').trim();
    if (!rawText) {
        return createEmptyEvaluation();
    }

    const words = rawText.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const durationMin = Math.max((Number(timeSpentSeconds) || 60) / 60, 0.2);
    const wpm = Math.round(wordCount / durationMin);

    // 1. Pace Analysis
    let paceStatus = "Balanced";
    let paceScore = 9;
    if (wpm < 100) {
        paceStatus = "Slow (<100 WPM)";
        paceScore = Math.max(5, Math.round(6 + (wpm / 100) * 3));
    } else if (wpm > 165) {
        paceStatus = "Fast (>165 WPM)";
        paceScore = Math.max(6, Math.round(10 - ((wpm - 165) / 25)));
    } else {
        paceStatus = "Optimal (120–155 WPM)";
        paceScore = 10;
    }

    // 2. Filler Word Detection
    const fillerMatches = [];
    let totalFillerCount = 0;

    FILLER_PATTERNS.forEach(fp => {
        const matches = rawText.match(fp.regex);
        if (matches) {
            totalFillerCount += matches.length;
            fillerMatches.push({
                word: fp.word,
                count: matches.length
            });
        }
    });

    // 3. Hedging Language Detection
    const detectedHedging = [];
    HEDGING_PATTERNS.forEach(hp => {
        const regex = new RegExp(`\\b${hp.phrase}\\b`, 'gi');
        if (regex.test(rawText)) {
            detectedHedging.push(hp);
        }
    });

    // 4. Grammar and Syntax Detection
    const grammarIssues = [];
    let correctedText = rawText;

    GRAMMAR_RULES.forEach(rule => {
        if (rule.regex.test(rawText)) {
            const matchInstance = rawText.match(rule.regex)[0];
            let replacement = typeof rule.corrected === 'function' 
                ? rule.corrected(matchInstance) 
                : rule.corrected;
            
            grammarIssues.push({
                original: matchInstance,
                corrected: replacement,
                explanation: rule.explanation
            });
            correctedText = correctedText.replace(rule.regex, replacement);
        }
    });

    // 5. Lexical Diversity & Vocabulary Sophistication
    const lowerWords = words.map(w => w.toLowerCase().replace(/[^a-z]/g, '')).filter(Boolean);
    const uniqueWords = new Set(lowerWords);
    const typeTokenRatio = lowerWords.length > 0 ? (uniqueWords.size / lowerWords.length) : 0;

    // Detect overused simple words
    const overusedFound = [];
    const usedVocabBoosts = [];

    Object.keys(VOCAB_UPGRADE_MAP).forEach(simpleWord => {
        const count = lowerWords.filter(w => w === simpleWord).length;
        if (count >= 1) {
            overusedFound.push({ word: simpleWord, count });
            const synonyms = VOCAB_UPGRADE_MAP[simpleWord];
            usedVocabBoosts.push({
                overused: simpleWord,
                synonym1: synonyms[0],
                example1: generateSynonymExample(synonyms[0], simpleWord),
                synonym2: synonyms[1] || synonyms[0],
                example2: generateSynonymExample(synonyms[1] || synonyms[0], simpleWord)
            });
        }
    });

    // Calculate Scores (0-10 & 0-100)
    let fluencyScore = Math.min(10, Math.max(4, Math.round(paceScore - Math.min(totalFillerCount * 0.5, 4))));
    let grammarScore = Math.min(10, Math.max(5, 10 - (grammarIssues.length * 1.5)));
    let vocabScore = Math.min(10, Math.max(5, Math.round((typeTokenRatio * 10) + (usedVocabBoosts.length > 0 ? 1 : 2))));

    let overallScore = Math.min(99, Math.max(45, Math.round((fluencyScore * 3.3) + (grammarScore * 3.5) + (vocabScore * 3.2))));

    // 6. Generate Structural Outputs & Multi-Level Rephrasings
    const { standardCorrect, corporateUpgrade, nativeUpgrade } = generateMultiLevelRephrasings(rawText, mode, grammarIssues, detectedHedging);

    // Key Strengths
    const keyStrengths = [];
    if (wpm >= 115 && wpm <= 160) {
        keyStrengths.push("Steady, well-metered cadence with strong sentence pacing.");
    } else if (wordCount >= 80) {
        keyStrengths.push("Strong structural stamina and substantive conceptual coverage.");
    } else {
        keyStrengths.push("Direct, focused delivery without excessive wandering.");
    }

    if (totalFillerCount === 0) {
        keyStrengths.push("Impeccable speech hygiene: zero filler crutches detected!");
    } else if (uniqueWords.size > 25) {
        keyStrengths.push("Good lexical breadth with distinct vocabulary selection across sentences.");
    } else {
        keyStrengths.push("Clear, accessible sentence structures that maintain listener comprehension.");
    }

    // Refinement Matrix: 1. Correction, 2. Style Upgrade
    let primaryCorrection = grammarIssues.length > 0 ? grammarIssues[0] : {
        original: rawText.slice(0, 45) + (rawText.length > 45 ? "..." : ""),
        corrected: standardCorrect.slice(0, 45) + (standardCorrect.length > 45 ? "..." : ""),
        explanation: "Good grammatical base. Ensure clear subject-verb alignment and robust punctuation."
    };

    let primaryStyleUpgrade = {
        original: detectedHedging.length > 0 ? detectedHedging[0].phrase : (overusedFound.length > 0 ? `"...${overusedFound[0].word}..."` : "Standard phrasing"),
        upgrade: mode === 'corporate' || mode === 'interview' ? corporateUpgrade : nativeUpgrade,
        whyItWorks: mode === 'corporate' || mode === 'interview' 
            ? "Replaces hesitant, passive phrasing with high-impact executive verbs and direct ownership." 
            : "Employs natural connected cadence, active verbs, and idiomatic flow characteristic of native fluency."
    };

    // Vocabulary Boost Section
    let vocabBoostList = usedVocabBoosts.slice(0, 2);
    if (vocabBoostList.length === 0) {
        vocabBoostList.push({
            overused: "good",
            synonym1: "exceptional",
            example1: "The proposed strategy produced exceptional quarterly returns.",
            synonym2: "formidable",
            example2: "The team demonstrated formidable resilience under tight deadlines."
        });
    }

    // Practice Follow-up Challenge
    const nextStep = generateFollowUpChallenge(mode, rawText);

    // Markdown Output conforming to exact requested schema
    const formattedMarkdown = `
**COMMUNICATION DASHBOARD**
- **Overall Score:** ${overallScore} / 100
- **Fluency & Pace:** ${fluencyScore} / 10 | ${paceStatus} | ${totalFillerCount} filler crutches
- **Grammar & Structure:** ${grammarScore} / 10 | ${grammarIssues.length > 0 ? grammarIssues[0].match : 'Syntactically Sound'}
- **Vocabulary Sophistication:** ${vocabScore} / 10 | ${typeTokenRatio > 0.65 ? 'High Variety' : 'Balanced Lexical Range'}

---

**KEY STRENGTHS**
- ${keyStrengths[0]}
- ${keyStrengths[1]}

---

**REFINEMENT MATRIX (Corrections & Upgrades)**

1. **Correction:**
   - **Original:** "${escapeMarkdownQuotes(primaryCorrection.original)}"
   - **Corrected:** "${escapeMarkdownQuotes(primaryCorrection.corrected)}"
   - **Explanation:** ${primaryCorrection.explanation}

2. **Style Upgrade (Level Up):**
   - **Original:** "${escapeMarkdownQuotes(primaryStyleUpgrade.original)}"
   - **Professional / Native Upgrade:** "${escapeMarkdownQuotes(primaryStyleUpgrade.upgrade)}"
   - **Why it works:** ${primaryStyleUpgrade.whyItWorks}

---

**VOCABULARY BOOST**
- Instead of using **"${vocabBoostList[0].overused}"**, try:
  - **${vocabBoostList[0].synonym1}**: "${vocabBoostList[0].example1}"
  - **${vocabBoostList[0].synonym2}**: "${vocabBoostList[0].example2}"

---

**NEXT STEP / PRACTICE FOLLOW-UP**
${nextStep}
`.trim();

    return {
        overallScore,
        metrics: {
            fluencyScore,
            grammarScore,
            vocabScore,
            wpm,
            paceStatus,
            wordCount,
            durationSeconds: timeSpentSeconds,
            fillerCount: totalFillerCount,
            fillerBreakdown: fillerMatches,
            hedgingBreakdown: detectedHedging,
            lexicalDiversity: Math.round(typeTokenRatio * 100)
        },
        strengths: keyStrengths,
        corrections: grammarIssues,
        refinementMatrix: {
            correction: primaryCorrection,
            styleUpgrade: primaryStyleUpgrade
        },
        rephrasings: {
            standard: standardCorrect,
            corporate: corporateUpgrade,
            native: nativeUpgrade
        },
        vocabularyBoost: vocabBoostList,
        nextStep,
        markdownOutput: formattedMarkdown
    };
}

function escapeMarkdownQuotes(str) {
    return String(str || '').replace(/"/g, "'").trim();
}

function generateSynonymExample(synonym, baseWord) {
    const examples = {
        "exceptional": "The team achieved exceptional efficiency during the migration.",
        "exemplary": "She demonstrated exemplary leadership during critical outages.",
        "substantial": "We observed a substantial increase in daily active users.",
        "paramount": "Security and low latency are of paramount importance.",
        "facilitate": "This framework will facilitate seamless cross-functional collaboration.",
        "catalyze": "Our recent initiative will catalyze accelerated product adoption.",
        "remediate": "We formulated an action plan to remediate the performance bottlenecks.",
        "mitigate": "Implementing redundancy helped mitigate potential downtime risks.",
        "spearhead": "He was chosen to spearhead the enterprise modernization program.",
        "transform": "Adopting this workflow will transform our execution cycle.",
        "articulate": "He was able to articulate complex architecture with utmost clarity."
    };
    return examples[synonym.toLowerCase()] || `Using "${synonym}" elevates the sentence to sound more authoritative and precise.`;
}

function cleanSentenceFlow(str) {
    if (!str) return '';
    let cleaned = str.replace(/^[,\s;:\-\.]+/, '').trim();
    cleaned = cleaned.replace(/\s+([,\.;:!\?])/g, '$1');
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return cleaned;
}

function generateMultiLevelRephrasings(text, mode, grammarIssues, hedging) {
    let standard = text;
    // Apply grammar fixes
    grammarIssues.forEach(g => {
        standard = standard.replace(g.original, g.corrected);
    });

    // Remove filler crutches for standard
    FILLER_PATTERNS.forEach(fp => {
        standard = standard.replace(fp.regex, '');
    });
    standard = cleanSentenceFlow(standard);

    // Corporate Upgrade: Action verbs, remove hedging, STAR/PREP polish
    let corporate = standard;
    hedging.forEach(h => {
        corporate = corporate.replace(new RegExp(`\\b${h.phrase}\\b`, 'gi'), h.replacement);
    });
    corporate = corporate
        .replace(/\b(i think|i believe)\b/gi, 'in my analysis,')
        .replace(/\b(a lot of|lots of)\b/gi, 'substantial')
        .replace(/\b(try to|trying to)\b/gi, 'actively executing strategies to')
        .replace(/\b(we did|i did)\b/gi, 'we spearheaded and delivered')
        .replace(/\b(fix the problem|fix it)\b/gi, 'resolve the root cause and optimize performance');
    corporate = cleanSentenceFlow(corporate);

    // Native Upgrade: Idiomatic flow, natural rhythm, connected phrasing
    let native = standard
        .replace(/\b(very good)\b/gi, 'second to none')
        .replace(/\b(hard to do)\b/gi, 'a steep uphill climb')
        .replace(/\b(in my opinion)\b/gi, 'from where I stand,')
        .replace(/\b(i am sure that)\b/gi, 'without a shadow of a doubt,')
        .replace(/\b(start doing)\b/gi, 'hit the ground running with');
    native = cleanSentenceFlow(native);

    return {
        standardCorrect: standard || text,
        corporateUpgrade: corporate || standard,
        nativeUpgrade: native || standard
    };
}

function generateFollowUpChallenge(mode, transcript) {
    if (mode === 'interview') {
        return "🎯 **STAR Challenge:** Can you take the **Result** portion of your response and quantify it with a concrete metric (e.g., 'reducing latency by 35%' or 'saving 10 hours weekly')? Give me a 30-second follow-up!";
    } else if (mode === 'corporate') {
        return "🎯 **Executive Drill:** Reframe your conclusion in ONE powerful sentence using an active verb (e.g., *'By spearheading X, we ensure sustainable Y'*). Type or speak your punchline!";
    } else if (mode === 'ielts') {
        return "🎯 **IELTS Band 8+ Follow-Up:** Consider the counter-perspective: What is the single strongest argument *against* your point, and how would you rebut it fluently?";
    } else {
        return "🎯 **Express Micro-Challenge:** Now attempt the exact same argument in **half the words (under 40 words)** with zero filler crutches. Ready for Round 2?";
    }
}

function createEmptyEvaluation() {
    return {
        overallScore: 0,
        metrics: {
            fluencyScore: 0,
            grammarScore: 0,
            vocabScore: 0,
            wpm: 0,
            paceStatus: "No speech detected",
            wordCount: 0,
            durationSeconds: 0,
            fillerCount: 0,
            fillerBreakdown: [],
            hedgingBreakdown: [],
            lexicalDiversity: 0
        },
        strengths: ["Ready to begin your practice session."],
        corrections: [],
        refinementMatrix: {
            correction: { original: "", corrected: "", explanation: "" },
            styleUpgrade: { original: "", upgrade: "", whyItWorks: "" }
        },
        rephrasings: { standard: "", corporate: "", native: "" },
        vocabularyBoost: [],
        nextStep: "Please speak or type a response to receive comprehensive diagnostic feedback.",
        markdownOutput: "Please provide a speech transcript or spoken response to begin."
    };
}

// =====================================================================
// OPTIONAL OPENAI LLM CO-PROCESSOR
// =====================================================================

async function evaluateWithLLMIfAvailable(transcript, mode, topic, targetRole, timeSpentSeconds, conversationHistory) {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
        // Fall back seamlessly to local NLP engine
        return null;
    }

    try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: openaiApiKey });

        const systemPrompt = `
You are the Communication Coach, a real-time English fluency and communication engine integrated into the AntiGravity platform (praxis-axpz.onrender.com).
Your target is to elevate users' spoken and written English, workplace communication, public speaking skills, and test readiness (IELTS, TOEFL, PTE).
You offer precise metrics, real-time corrections, and interactive practice.

Selected Practice Mode: ${mode}
Topic / Scenario: ${topic || 'General Fluency Lab'}
Target Role / Level: ${targetRole || 'Professional'}
Spoken Duration: ${timeSpentSeconds} seconds

Analyze the user's transcript and produce strict JSON conforming to this schema:
{
  "overallScore": number (0-100),
  "fluencyScore": number (0-10),
  "grammarScore": number (0-10),
  "vocabScore": number (0-10),
  "paceStatus": string ("Slow" | "Optimal" | "Fast"),
  "fillerCount": number,
  "keyStrengths": [string, string],
  "correction": {
    "original": string,
    "corrected": string,
    "explanation": string
  },
  "styleUpgrade": {
    "original": string,
    "upgrade": string,
    "whyItWorks": string
  },
  "rephrasings": {
    "standard": string,
    "corporate": string,
    "native": string
  },
  "vocabularyBoost": [
    {
      "overused": string,
      "synonym1": string,
      "example1": string,
      "synonym2": string,
      "example2": string
    }
  ],
  "nextStep": string
}
`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt },
                ...(Array.isArray(conversationHistory) ? conversationHistory.slice(-4) : []),
                { role: "user", content: `User Spoken Transcript:\n"${transcript}"` }
            ],
            temperature: 0.3,
            max_tokens: 1200
        });

        const parsed = JSON.parse(response.choices[0].message.content);
        const wpm = Math.round((transcript.split(/\s+/).length / Math.max(timeSpentSeconds / 60, 0.2)));

        const formattedMarkdown = `
**COMMUNICATION DASHBOARD**
- **Overall Score:** ${parsed.overallScore} / 100
- **Fluency & Pace:** ${parsed.fluencyScore} / 10 | ${parsed.paceStatus} | ${parsed.fillerCount} filler crutches
- **Grammar & Structure:** ${parsed.grammarScore} / 10 | ${parsed.correction ? parsed.correction.explanation.slice(0, 40) : 'Accurate'}
- **Vocabulary Sophistication:** ${parsed.vocabScore} / 10 | Lexical variety rated

---

**KEY STRENGTHS**
- ${parsed.keyStrengths && parsed.keyStrengths[0] ? parsed.keyStrengths[0] : 'Solid structure'}
- ${parsed.keyStrengths && parsed.keyStrengths[1] ? parsed.keyStrengths[1] : 'Clear delivery'}

---

**REFINEMENT MATRIX (Corrections & Upgrades)**

1. **Correction:**
   - **Original:** "${escapeMarkdownQuotes(parsed.correction?.original)}"
   - **Corrected:** "${escapeMarkdownQuotes(parsed.correction?.corrected)}"
   - **Explanation:** ${parsed.correction?.explanation}

2. **Style Upgrade (Level Up):**
   - **Original:** "${escapeMarkdownQuotes(parsed.styleUpgrade?.original)}"
   - **Professional / Native Upgrade:** "${escapeMarkdownQuotes(parsed.styleUpgrade?.upgrade)}"
   - **Why it works:** ${parsed.styleUpgrade?.whyItWorks}

---

**VOCABULARY BOOST**
- Instead of using **"${parsed.vocabularyBoost?.[0]?.overused || 'good'}"**, try:
  - **${parsed.vocabularyBoost?.[0]?.synonym1 || 'exceptional'}**: "${parsed.vocabularyBoost?.[0]?.example1 || ''}"
  - **${parsed.vocabularyBoost?.[0]?.synonym2 || 'formidable'}**: "${parsed.vocabularyBoost?.[0]?.example2 || ''}"

---

**NEXT STEP / PRACTICE FOLLOW-UP**
${parsed.nextStep}
`.trim();

        return {
            overallScore: parsed.overallScore,
            metrics: {
                fluencyScore: parsed.fluencyScore,
                grammarScore: parsed.grammarScore,
                vocabScore: parsed.vocabScore,
                wpm: wpm,
                paceStatus: parsed.paceStatus,
                wordCount: transcript.split(/\s+/).length,
                durationSeconds: timeSpentSeconds,
                fillerCount: parsed.fillerCount,
                fillerBreakdown: [],
                hedgingBreakdown: [],
                lexicalDiversity: 85
            },
            strengths: parsed.keyStrengths || [],
            corrections: parsed.correction ? [parsed.correction] : [],
            refinementMatrix: {
                correction: parsed.correction,
                styleUpgrade: parsed.styleUpgrade
            },
            rephrasings: parsed.rephrasings || {},
            vocabularyBoost: parsed.vocabularyBoost || [],
            nextStep: parsed.nextStep,
            markdownOutput: formattedMarkdown,
            isAIPowered: true
        };
    } catch (err) {
        console.warn("⚠️ OpenAI LLM Call Error (falling back to local NLP engine):", err.message);
        return null;
    }
}

// =====================================================================
// INITIALIZE EXPRESS ROUTES & DATABASE TABLES
// =====================================================================

function initCoachEngine(app, db) {
    // 1. Initialize SQLite Table for speech history
    try {
        if (db && typeof db.exec === 'function') {
            db.exec(`
                CREATE TABLE IF NOT EXISTS speech_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_email TEXT,
                    mode TEXT,
                    topic TEXT,
                    transcript TEXT,
                    overall_score INTEGER,
                    fluency_score INTEGER,
                    grammar_score INTEGER,
                    vocab_score INTEGER,
                    wpm INTEGER,
                    filler_count INTEGER,
                    feedback_json TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log("💾 Communication Coach SQLite table verified.");
        }
    } catch (dbErr) {
        console.warn("⚠️ Could not init speech_sessions SQLite table:", dbErr.message);
    }

    // 2. Serve Dedicated Coach HTML Page
    app.get(['/coach', '/coach.html', '/speech', '/speech.html', '/fluency', '/fluency.html'], (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'coach.html'));
    });

    // 3. API: Get Curated Topics
    app.get('/api/coach/topics', (req, res) => {
        try {
            res.json({
                success: true,
                topics: PRACTICE_TOPICS
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // 4. API: Evaluate Speech & Text
    app.post('/api/coach/evaluate', async (req, res) => {
        try {
            const { transcript, mode = 'express', topic = '', targetRole = '', timeSpentSeconds = 60, conversationHistory = [] } = req.body;

            if (!transcript || !String(transcript).trim()) {
                return res.status(400).json({ success: false, error: "Please provide a spoken transcript or text to analyze." });
            }

            // Attempt AI LLM if configured, otherwise use high-speed local NLP Diagnostic Engine
            let evaluation = await evaluateWithLLMIfAvailable(transcript, mode, topic, targetRole, timeSpentSeconds, conversationHistory);
            
            if (!evaluation) {
                evaluation = analyzeSpeechDiagnostics(transcript, mode, timeSpentSeconds, targetRole);
            }

            // Save to SQLite if user logged in
            const userEmail = req.body.userEmail || req.headers['x-user-email'] || 'guest@praxis.app';
            try {
                if (db && typeof db.prepare === 'function') {
                    const stmt = db.prepare(`
                        INSERT INTO speech_sessions 
                        (user_email, mode, topic, transcript, overall_score, fluency_score, grammar_score, vocab_score, wpm, filler_count, feedback_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `);
                    stmt.run(
                        userEmail,
                        mode,
                        topic,
                        transcript,
                        evaluation.overallScore,
                        evaluation.metrics?.fluencyScore || 0,
                        evaluation.metrics?.grammarScore || 0,
                        evaluation.metrics?.vocabScore || 0,
                        evaluation.metrics?.wpm || 0,
                        evaluation.metrics?.fillerCount || 0,
                        JSON.stringify(evaluation)
                    );
                }
            } catch (saveErr) {
                console.warn("⚠️ Could not persist speech session:", saveErr.message);
            }

            res.json({
                success: true,
                evaluation
            });
        } catch (err) {
            console.error("Coach Evaluation Error:", err);
            res.status(500).json({ success: false, error: "Internal Evaluation Error: " + err.message });
        }
    });

    // 5. API: Get User Speech History & Stats
    app.get('/api/coach/history', (req, res) => {
        try {
            const userEmail = req.query.email || 'guest@praxis.app';
            let sessions = [];
            if (db && typeof db.prepare === 'function') {
                const stmt = db.prepare(`
                    SELECT * FROM speech_sessions 
                    WHERE user_email = ? 
                    ORDER BY created_at DESC 
                    LIMIT 20
                `);
                sessions = stmt.all(userEmail);
            }
            res.json({
                success: true,
                sessions
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    console.log("🎙️ Communication Coach & Speech Engine initialized successfully.");
}

module.exports = {
    initCoachEngine,
    analyzeSpeechDiagnostics,
    PRACTICE_TOPICS
};

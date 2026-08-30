const fs = require('fs');
const path = require('path');
const SpeechDiagnostics = require('./public/js/speechDiagnostics');
const TranscriptProcessor = require('./public/js/transcriptProcessor');

// =====================================================================
// Communication COACH - REAL-TIME ENGLISH FLUENCY & DETERMINISTIC ENGINE
// NO EXTERNAL AI APIS (OpenAI, Gemini, Claude, etc.)
// =====================================================================

// Curated Practice Topics Database across 4 Modes
const PRACTICE_TOPICS = {
    express: [
        {
            id: "exp-1",
            title: "Remote Work vs. Hybrid Model",
            prompt: "Should remote work completely replace traditional office work in the future, or is a hybrid model the only sustainable path?",
            framework: "PREP: Point ➔ Reason ➔ Example ➔ Point",
            duration: 60,
            category: "Workplace & Technology"
        },
        {
            id: "exp-2",
            title: "Artificial Intelligence in Daily Decisions",
            prompt: "Will relying on AI for everyday micro-decisions diminish human critical thinking skills?",
            framework: "PREP: Point ➔ Reason ➔ Example ➔ Point",
            duration: 60,
            category: "Technology & Ethics"
        },
        {
            id: "exp-3",
            title: "The Definition of True Career Success",
            prompt: "Is career success better measured by financial compensation, societal impact, or work-life harmony?",
            framework: "PREP: Point ➔ Reason ➔ Example ➔ Point",
            duration: 60,
            category: "Career & Philosophy"
        },
        {
            id: "exp-4",
            title: "Social Media and Public Discourse",
            prompt: "Has algorithmic social media connected humanity closer or fractured our ability to have meaningful debates?",
            framework: "PREP: Point ➔ Reason ➔ Example ➔ Point",
            duration: 60,
            category: "Society & Culture"
        },
        {
            id: "exp-5",
            title: "Continuous Learning vs. Deep Specialization",
            prompt: "In a rapidly evolving economy, is it more advantageous to be a broad generalist or a deep specialist?",
            framework: "PREP: Point ➔ Reason ➔ Example ➔ Point",
            duration: 60,
            category: "Personal Growth"
        }
    ],
    interview: [
        {
            id: "int-1",
            title: "Handling High-Stakes Project Failure",
            prompt: "Tell me about a time when a critical project missed its objective or failed. How did you handle the situation and what did you learn?",
            framework: "STAR: Situation ➔ Task ➔ Action ➔ Result",
            targetRole: "Executive / Management",
            category: "Behavioral"
        },
        {
            id: "int-2",
            title: "Navigating Conflict with a Senior Stakeholder",
            prompt: "Describe a scenario where you strongly disagreed with a team lead or client on a technical direction. How did you resolve it?",
            framework: "STAR: Situation ➔ Task ➔ Action ➔ Result",
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
                    structure_score INTEGER,
                    wpm INTEGER,
                    filler_count INTEGER,
                    word_count INTEGER,
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

    // 4. API: Evaluate Speech (100% Local Deterministic Diagnostics Engine)
    app.post('/api/coach/evaluate', (req, res) => {
        try {
            const { transcript, mode = 'express', topic = '', timeSpentSeconds = 60, targetStructure = 'PREP' } = req.body;

            const trimmed = String(transcript || '').trim();
            if (!trimmed) {
                return res.status(400).json({
                    success: false,
                    error: "Please provide a spoken transcript or text to analyze."
                });
            }

            // Run deterministic diagnostic analysis
            const evaluation = SpeechDiagnostics.analyzeSpeech({
                transcript: trimmed,
                duration: Number(timeSpentSeconds) || 60,
                topic,
                targetStructure
            });

            // Save to SQLite if database connection available
            const userEmail = req.body.userEmail || req.headers['x-user-email'] || 'guest@praxis.app';
            try {
                if (db && typeof db.prepare === 'function') {
                    const stmt = db.prepare(`
                        INSERT INTO speech_sessions 
                        (user_email, mode, topic, transcript, overall_score, fluency_score, grammar_score, vocab_score, structure_score, wpm, filler_count, word_count, feedback_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `);
                    stmt.run(
                        userEmail,
                        mode,
                        topic,
                        trimmed,
                        evaluation.overallScore,
                        Math.round(evaluation.fluencyScore10),
                        Math.round(evaluation.grammarScore10),
                        Math.round(evaluation.vocabularyScore10),
                        Math.round(evaluation.structureScore10),
                        evaluation.wpm,
                        evaluation.fillerCount,
                        evaluation.wordCount,
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

    console.log("🎙️ Communication Coach & Speech Engine initialized (Deterministic Local Engine).");
}

module.exports = {
    initCoachEngine,
    analyzeSpeechDiagnostics: SpeechDiagnostics.analyzeSpeech,
    PRACTICE_TOPICS
};

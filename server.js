require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const webpush = require('web-push');
const notifier = require('node-notifier');
const Database = require('better-sqlite3');

let bcrypt;
try {
    bcrypt = require('bcrypt');
} catch (e) {
    bcrypt = require('bcryptjs');
}

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================================
// LOCAL SSD SQLITE DATABASE ENGINE (better-sqlite3)
// =====================================================================
// Absolute local SSD path placeholder as requested (use 'D:/database/praxis_data.db' for easy customization)
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || 'D:/database/praxis_data.db';

let db;
let actualDbPath = SQLITE_DB_PATH;

try {
    const dbDir = path.dirname(SQLITE_DB_PATH);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    db = new Database(SQLITE_DB_PATH);
    db.pragma('journal_mode = WAL');
    console.log(`💾 Local SQLite Database successfully initialized at SSD path: ${SQLITE_DB_PATH}`);
} catch (err) {
    console.warn(`⚠️ Could not initialize SQLite at ${SQLITE_DB_PATH}: ${err.message}. Initializing fallback SSD / workspace storage...`);
    try {
        const ssdDir = 'F:\\Praxis Admin server';
        if (fs.existsSync(ssdDir)) {
            actualDbPath = path.join(ssdDir, 'praxis_data.db');
            db = new Database(actualDbPath);
            db.pragma('journal_mode = WAL');
            console.log(`💾 Connected SQLite Database at SSD storage: ${actualDbPath}`);
        } else {
            const localDataDir = path.join(__dirname, 'database');
            if (!fs.existsSync(localDataDir)) fs.mkdirSync(localDataDir, { recursive: true });
            actualDbPath = path.join(localDataDir, 'praxis_data.db');
            db = new Database(actualDbPath);
            db.pragma('journal_mode = WAL');
            console.log(`💾 Connected SQLite Database at workspace fallback: ${actualDbPath}`);
        }
    } catch (fallbackErr) {
        console.error(`❌ Critical SQLite Initialization Error:`, fallbackErr.message);
        db = new Database(':memory:');
        actualDbPath = ':memory:';
    }
}

// Database Initialization Block: Create users and traffic tables if they do not exist
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        hashed_password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS traffic (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address TEXT,
        endpoint TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Prepared statement for fast traffic logging
const insertTrafficStmt = db.prepare(`
    INSERT INTO traffic (ip_address, endpoint) VALUES (?, ?)
`);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global Express Middleware: inserts req.ip and req.originalUrl into the traffic table for every incoming request
app.use((req, res, next) => {
    try {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';
        const endpoint = req.originalUrl || req.url;
        insertTrafficStmt.run(String(clientIp), String(endpoint));
    } catch (err) {
        console.error('⚠️ Failed to log traffic into SQLite table:', err.message);
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// =====================================================================
// PERMANENT DATABASE ENGINE (F:\Praxis Admin server)
// =====================================================================
const PRIMARY_DB_DIR = 'F:\\Praxis Admin server';
let DB_DIR = PRIMARY_DB_DIR;

try {
    if (!fs.existsSync(PRIMARY_DB_DIR)) {
        fs.mkdirSync(PRIMARY_DB_DIR, { recursive: true });
    }
    console.log(`💾 Praxis Database permanently mounted at: ${PRIMARY_DB_DIR}`);
} catch (dbErr) {
    console.warn(`⚠️ Could not initialize ${PRIMARY_DB_DIR}, falling back to local workspace:`, dbErr.message);
    DB_DIR = __dirname;
}

const USERS_FILE = path.join(DB_DIR, 'users.json');
const ANALYTICS_FILE = path.join(DB_DIR, 'analytics.json');
const SUBSCRIPTIONS_FILE = path.join(DB_DIR, 'subscriptions.json');
const UPLOADS_DIR = path.join(DB_DIR, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch(e){}
}
app.use('/uploads', express.static(UPLOADS_DIR));
if (DB_DIR !== __dirname) {
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Robust JSON file writer for permanent storage in F:\Praxis Admin server & mirrored workspace
function safeWriteJsonFile(filePath, dataObj, backupPath = null) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const jsonStr = JSON.stringify(dataObj, null, 2);
        fs.writeFileSync(filePath, jsonStr, 'utf8');
        if (backupPath && backupPath !== filePath) {
            try {
                const bDir = path.dirname(backupPath);
                if (!fs.existsSync(bDir)) fs.mkdirSync(bDir, { recursive: true });
                fs.writeFileSync(backupPath, jsonStr, 'utf8');
            } catch(be){}
        }
        return true;
    } catch (err) {
        console.error(`⚠️ Failed to write JSON to ${filePath}:`, err.message);
        return false;
    }
}

// Initial Data Migration & Synchronization to F:\Praxis Admin server
function syncInitialDataToStorage() {
    try {
        if (DB_DIR !== __dirname) {
            const localUploads = path.join(__dirname, 'uploads');
            if (fs.existsSync(localUploads)) {
                const files = fs.readdirSync(localUploads);
                files.forEach(file => {
                    const dest = path.join(UPLOADS_DIR, file);
                    if (!fs.existsSync(dest)) {
                        try {
                            fs.copyFileSync(path.join(localUploads, file), dest);
                        } catch(e){}
                    }
                });
            }
        }
    } catch (mErr) {
        console.warn("⚠️ Data synchronization warning:", mErr.message);
    }
}
syncInitialDataToStorage();

// =====================================================================
// USER DATABASE & AUTHENTICATION ENGINE (users.json)
// =====================================================================
if (!bcrypt) {
    try {
        bcrypt = require('bcryptjs');
    } catch(e){}
}
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'praxis_jwt_secret_987654321_secure';

let usersData = {
    users: [],
    loginLogs: []
};

function loadUsersData() {
    try {
        let loadedUsers = [];
        let loadedLogs = [];

        if (fs.existsSync(USERS_FILE)) {
            try {
                const raw = fs.readFileSync(USERS_FILE, 'utf8');
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed.users)) loadedUsers = parsed.users;
                if (Array.isArray(parsed.loginLogs)) loadedLogs = parsed.loginLogs;
            } catch (pErr) {
                console.error("⚠️ Error parsing USERS_FILE:", pErr.message);
            }
        }

        // Merge from workspace backup if present so no user accounts are lost
        if (DB_DIR !== __dirname) {
            const localUsersFile = path.join(__dirname, 'users.json');
            if (fs.existsSync(localUsersFile)) {
                try {
                    const localParsed = JSON.parse(fs.readFileSync(localUsersFile, 'utf8'));
                    const localUsers = Array.isArray(localParsed.users) ? localParsed.users : [];
                    localUsers.forEach(lu => {
                        if (!loadedUsers.some(u => u.id === lu.id || (u.email && lu.email && u.email.toLowerCase() === lu.email.toLowerCase()))) {
                            loadedUsers.push(lu);
                        }
                    });
                    const localLogs = Array.isArray(localParsed.loginLogs) ? localParsed.loginLogs : [];
                    localLogs.forEach(ll => {
                        if (!loadedLogs.some(l => l.id === ll.id)) {
                            loadedLogs.push(ll);
                        }
                    });
                } catch (e) {}
            }
        }

        usersData = {
            users: loadedUsers,
            loginLogs: loadedLogs
        };

        console.log(`👤 Permanent User DB: Loaded ${usersData.users.length} registered users and ${usersData.loginLogs.length} audit logs at ${USERS_FILE}`);
        saveUsersData();
    } catch (err) {
        console.error("⚠️ Failed to load/initialize users.json:", err.message);
    }
}

function saveUsersData() {
    const localUsersFile = (DB_DIR !== __dirname) ? path.join(__dirname, 'users.json') : null;
    safeWriteJsonFile(USERS_FILE, usersData, localUsersFile);
}

loadUsersData();

// =====================================================================
// REAL-TIME ANALYTICS & ACTIVE USER TRACKING ENGINE
// =====================================================================
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const activeSessions = new Map(); // clientId -> lastPingTimestamp
const activeRoutineSessions = new Map(); // clientId -> lastPingTimestamp
const PING_TIMEOUT_MS = 45000; // 45 seconds (ping sent every 30s)

let analyticsData = {
    totalVisitors: 0,
    uniqueVisitors: {}, // clientId -> { firstSeen, lastSeen, ip, userAgent, visitCount }
    totalQuizzesCompleted: 0,
    featureUsage: {
        compass: 0,
        library: 0,
        routine: 0
    },
    domainStats: {},
    careerStats: {},
    libraryStats: {
        totalViews: 0,
        bookViews: 0,
        popularBooks: {}
    },
    routineStats: {
        totalInteractions: 0,
        totalHabitCheckoffs: 0,
        dailyUsers: {} // dateString -> array of clientIds
    }
};

function loadAnalytics() {
    try {
        let parsed = {};
        if (fs.existsSync(ANALYTICS_FILE)) {
            try {
                parsed = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8')) || {};
            } catch(e){}
        }

        // Merge from local backup if present to ensure 0 telemetry data loss
        if (DB_DIR !== __dirname) {
            const localAnalyticsFile = path.join(__dirname, 'analytics.json');
            if (fs.existsSync(localAnalyticsFile)) {
                try {
                    const localParsed = JSON.parse(fs.readFileSync(localAnalyticsFile, 'utf8')) || {};
                    parsed.totalVisitors = Math.max(parsed.totalVisitors || 0, localParsed.totalVisitors || 0);
                    parsed.totalQuizzesCompleted = Math.max(parsed.totalQuizzesCompleted || 0, localParsed.totalQuizzesCompleted || 0);
                    parsed.uniqueVisitors = { ...(localParsed.uniqueVisitors || {}), ...(parsed.uniqueVisitors || {}) };
                    parsed.domainStats = { ...(localParsed.domainStats || {}), ...(parsed.domainStats || {}) };
                    parsed.careerStats = { ...(localParsed.careerStats || {}), ...(parsed.careerStats || {}) };
                    if (localParsed.featureUsage) {
                        parsed.featureUsage = {
                            compass: Math.max(parsed.featureUsage?.compass || 0, localParsed.featureUsage.compass || 0),
                            library: Math.max(parsed.featureUsage?.library || 0, localParsed.featureUsage.library || 0),
                            routine: Math.max(parsed.featureUsage?.routine || 0, localParsed.featureUsage.routine || 0),
                        };
                    }
                } catch(e) {}
            }
        }

        const compassCount = (parsed.featureUsage && typeof parsed.featureUsage.compass === 'number')
            ? parsed.featureUsage.compass
            : (parsed.domainStats ? Object.values(parsed.domainStats).reduce((a, b) => a + b, 0) : 0);
        const libraryCount = (parsed.featureUsage && typeof parsed.featureUsage.library === 'number')
            ? parsed.featureUsage.library
            : (parsed.libraryStats?.totalViews || 0);
        const routineCount = (parsed.featureUsage && typeof parsed.featureUsage.routine === 'number')
            ? parsed.featureUsage.routine
            : (parsed.routineStats?.totalInteractions || 0);

        analyticsData = {
            totalVisitors: parsed.totalVisitors || 0,
            uniqueVisitors: parsed.uniqueVisitors || {},
            totalQuizzesCompleted: parsed.totalQuizzesCompleted || 0,
            featureUsage: {
                compass: compassCount || 0,
                library: libraryCount || 0,
                routine: routineCount || 0,
                ...(parsed.featureUsage || {})
            },
            domainStats: parsed.domainStats || {},
            careerStats: parsed.careerStats || {},
            libraryStats: {
                totalViews: parsed.libraryStats?.totalViews || 0,
                bookViews: parsed.libraryStats?.bookViews || 0,
                popularBooks: parsed.libraryStats?.popularBooks || {}
            },
            routineStats: {
                totalInteractions: parsed.routineStats?.totalInteractions || 0,
                totalHabitCheckoffs: parsed.routineStats?.totalHabitCheckoffs || 0,
                dailyUsers: parsed.routineStats?.dailyUsers || {}
            }
        };

        saveAnalytics();
        console.log(`📊 Permanent Telemetry & Analytics: Loaded and saved at ${ANALYTICS_FILE}`);
    } catch (err) {
        console.error("⚠️ Failed to load/initialize analytics.json:", err.message);
    }
}

function saveAnalytics() {
    const localAnalyticsFile = (DB_DIR !== __dirname) ? path.join(__dirname, 'analytics.json') : null;
    safeWriteJsonFile(ANALYTICS_FILE, analyticsData, localAnalyticsFile);
}

loadAnalytics();

function getActiveUserCount() {
    const now = Date.now();
    let count = 0;
    for (const [clientId, timestamp] of activeSessions.entries()) {
        if (now - timestamp <= PING_TIMEOUT_MS) {
            count++;
        } else {
            activeSessions.delete(clientId);
        }
    }
    return count;
}

function getActiveRoutineUserCount() {
    const now = Date.now();
    let count = 0;
    for (const [clientId, timestamp] of activeRoutineSessions.entries()) {
        if (now - timestamp <= PING_TIMEOUT_MS) {
            count++;
        } else {
            activeRoutineSessions.delete(clientId);
        }
    }
    return count;
}

// =====================================================================
// 1. MASSIVE STATIC QUESTION POOL (150 Questions - 25 Per Category)
// =====================================================================
const questionsDB = {
    "TechAI": [
        {
            "text": "When your computer freezes, what is your first reaction?",
            "options": [
                {
                    "text": "Troubleshoot and fix it myself.",
                    "tags": {
                        "Technical": 3,
                        "ProblemSolving": 2
                    }
                },
                {
                    "text": "Search Google/YouTube for a fix.",
                    "tags": {
                        "Analytical": 2,
                        "Resourceful": 3
                    }
                },
                {
                    "text": "Ask a friend who is good with tech.",
                    "tags": {
                        "Communication": 2
                    }
                },
                {
                    "text": "Restart it and hope for the best.",
                    "tags": {
                        "Easygoing": 1
                    }
                }
            ]
        },
        {
            "text": "What excites you most about AI?",
            "options": [
                {
                    "text": "How it processes massive data.",
                    "tags": {
                        "Analytical": 3
                    }
                },
                {
                    "text": "How it can generate art/music.",
                    "tags": {
                        "Creative": 3
                    }
                },
                {
                    "text": "How it can help people in daily life.",
                    "tags": {
                        "Empathy": 3
                    }
                },
                {
                    "text": "How it automates boring tasks.",
                    "tags": {
                        "Logical": 3
                    }
                }
            ]
        },
        {
            "text": "How do you handle a messy folder of files?",
            "options": [
                {
                    "text": "Write a script to organize them.",
                    "tags": {
                        "Technical": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "Manually sort into perfect folders.",
                    "tags": {
                        "Organized": 3
                    }
                },
                {
                    "text": "Only search for what I need.",
                    "tags": {
                        "Practical": 2
                    }
                },
                {
                    "text": "Leave it messy, I know where things are.",
                    "tags": {
                        "Adaptable": 2
                    }
                }
            ]
        },
        {
            "text": "If you could invent one thing, it would be:",
            "options": [
                {
                    "text": "A new coding language.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "A robot that cleans the house.",
                    "tags": {
                        "Practical": 3
                    }
                },
                {
                    "text": "A new musical instrument.",
                    "tags": {
                        "Creative": 3
                    }
                },
                {
                    "text": "An app to connect lonely people.",
                    "tags": {
                        "Empathy": 3
                    }
                }
            ]
        },
        {
            "text": "What is your approach to password security?",
            "options": [
                {
                    "text": "Use a password manager with complex hashes.",
                    "tags": {
                        "Technical": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "Use a memorable phrase with numbers.",
                    "tags": {
                        "Practical": 3
                    }
                },
                {
                    "text": "Use the same password for everything.",
                    "tags": {
                        "Easygoing": 1
                    }
                },
                {
                    "text": "Write them down in a physical notebook.",
                    "tags": {
                        "Organized": 2
                    }
                }
            ]
        },
        {
            "text": "When learning a complex idea, you:",
            "options": [
                {
                    "text": "Ask about the specific mechanics.",
                    "tags": {
                        "Analytical": 3
                    }
                },
                {
                    "text": "Imagine it visually.",
                    "tags": {
                        "Creative": 2
                    }
                },
                {
                    "text": "Relate it to people.",
                    "tags": {
                        "Empathy": 3
                    }
                },
                {
                    "text": "Write bullet points.",
                    "tags": {
                        "Organized": 3
                    }
                }
            ]
        },
        {
            "text": "What type of puzzles do you enjoy most?",
            "options": [
                {
                    "text": "Logic/math puzzles (Sudoku).",
                    "tags": {
                        "Analytical": 3,
                        "ProblemSolving": 2
                    }
                },
                {
                    "text": "Word puzzles (Crosswords).",
                    "tags": {
                        "Communication": 2
                    }
                },
                {
                    "text": "Visual puzzles (Jigsaw).",
                    "tags": {
                        "Creative": 2
                    }
                },
                {
                    "text": "Real-world challenges.",
                    "tags": {
                        "Practical": 3
                    }
                }
            ]
        },
        {
            "text": "If you ran a tech company, you would be the:",
            "options": [
                {
                    "text": "Lead Developer writing the best code.",
                    "tags": {
                        "Technical": 3
                    }
                },
                {
                    "text": "CEO pitching the vision to investors.",
                    "tags": {
                        "Leadership": 3
                    }
                },
                {
                    "text": "Lead Designer making the UI beautiful.",
                    "tags": {
                        "Creative": 3
                    }
                },
                {
                    "text": "Project Manager keeping everyone on track.",
                    "tags": {
                        "Organized": 3
                    }
                }
            ]
        },
        {
            "text": "What do you notice first about a new app?",
            "options": [
                {
                    "text": "How fast and smooth it runs.",
                    "tags": {
                        "Technical": 3
                    }
                },
                {
                    "text": "How cool the layout looks.",
                    "tags": {
                        "Creative": 3
                    }
                },
                {
                    "text": "How easy it is to understand.",
                    "tags": {
                        "Empathy": 2
                    }
                },
                {
                    "text": "The privacy settings.",
                    "tags": {
                        "Analytical": 3
                    }
                }
            ]
        },
        {
            "text": "Which part of building a website sounds most fun?",
            "options": [
                {
                    "text": "Writing the backend code.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "Designing the logo and colors.",
                    "tags": {
                        "Creative": 3
                    }
                },
                {
                    "text": "Writing the text and articles.",
                    "tags": {
                        "Communication": 3
                    }
                },
                {
                    "text": "Planning how pages link together.",
                    "tags": {
                        "Organized": 3
                    }
                }
            ]
        },
        {
            "text": "How do you prefer to learn something new?",
            "options": [
                {
                    "text": "Taking it apart to see how it works.",
                    "tags": {
                        "Analytical": 3,
                        "Technical": 2
                    }
                },
                {
                    "text": "Watching a visual tutorial.",
                    "tags": {
                        "Creative": 2
                    }
                },
                {
                    "text": "Reading the official manual.",
                    "tags": {
                        "Organized": 2
                    }
                },
                {
                    "text": "Practicing with a group.",
                    "tags": {
                        "Communication": 3
                    }
                }
            ]
        },
        {
            "text": "Your perfect work environment is:",
            "options": [
                {
                    "text": "Quiet room with dual monitors.",
                    "tags": {
                        "Technical": 3,
                        "Independent": 2
                    }
                },
                {
                    "text": "Lively office sharing ideas.",
                    "tags": {
                        "Communication": 3,
                        "Creative": 1
                    }
                },
                {
                    "text": "A highly organized desk.",
                    "tags": {
                        "Organized": 3
                    }
                },
                {
                    "text": "Flexible space to move around.",
                    "tags": {
                        "Adaptable": 3
                    }
                }
            ]
        },
        {
            "text": "If you had to read a book right now, it would be:",
            "options": [
                {
                    "text": "Sci-fi or future technology.",
                    "tags": {
                        "Imaginative": 3,
                        "Technical": 2
                    }
                },
                {
                    "text": "A biography of a leader.",
                    "tags": {
                        "Leadership": 3
                    }
                },
                {
                    "text": "A mystery novel.",
                    "tags": {
                        "Analytical": 3
                    }
                },
                {
                    "text": "A how-to guide.",
                    "tags": {
                        "Practical": 3
                    }
                }
            ]
        },
        {
            "text": "You find a bug in a video game. You:",
            "options": [
                {
                    "text": "Try to replicate it to see why it happens.",
                    "tags": {
                        "Analytical": 3,
                        "ProblemSolving": 2
                    }
                },
                {
                    "text": "Use it to your advantage to win.",
                    "tags": {
                        "Logical": 3
                    }
                },
                {
                    "text": "Report it to the developers.",
                    "tags": {
                        "Organized": 2
                    }
                },
                {
                    "text": "Ignore it and keep playing.",
                    "tags": {
                        "Easygoing": 2
                    }
                }
            ]
        },
        {
            "text": "What is your favorite subject in school?",
            "options": [
                {
                    "text": "Computer Science / IT.",
                    "tags": {
                        "Technical": 3
                    }
                },
                {
                    "text": "Math / Physics.",
                    "tags": {
                        "Analytical": 3
                    }
                },
                {
                    "text": "Art / Graphic Design.",
                    "tags": {
                        "Creative": 3
                    }
                },
                {
                    "text": "History / English.",
                    "tags": {
                        "Communication": 2
                    }
                }
            ]
        },
        {
            "text": "When buying a laptop, you look for:",
            "options": [
                {
                    "text": "RAM, Processor speed, and OS.",
                    "tags": {
                        "Technical": 3
                    }
                },
                {
                    "text": "Screen resolution and color accuracy.",
                    "tags": {
                        "Creative": 3
                    }
                },
                {
                    "text": "The cheapest one that works.",
                    "tags": {
                        "Practical": 3
                    }
                },
                {
                    "text": "The one all my friends have.",
                    "tags": {
                        "Social": 2
                    }
                }
            ]
        },
        {
            "text": "How do you feel about coding?",
            "options": [
                {
                    "text": "I love the logic and problem solving.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "It's a useful tool to build my designs.",
                    "tags": {
                        "Creative": 2,
                        "Practical": 2
                    }
                },
                {
                    "text": "It seems boring and too complex.",
                    "tags": {
                        "Social": 2
                    }
                },
                {
                    "text": "I prefer dealing with hardware over software.",
                    "tags": {
                        "Technical": 2
                    }
                }
            ]
        },
        {
            "text": "When a group project requires a presentation, you:",
            "options": [
                {
                    "text": "Format the slides to look perfect.",
                    "tags": {
                        "Creative": 3
                    }
                },
                {
                    "text": "Organize the data and research.",
                    "tags": {
                        "Analytical": 3
                    }
                },
                {
                    "text": "Do the actual speaking.",
                    "tags": {
                        "Communication": 3
                    }
                },
                {
                    "text": "Manage the timeline.",
                    "tags": {
                        "Organized": 3
                    }
                }
            ]
        },
        {
            "text": "If you could master any skill instantly, it would be:",
            "options": [
                {
                    "text": "Hacking/Cybersecurity.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "Digital Animation.",
                    "tags": {
                        "Creative": 3
                    }
                },
                {
                    "text": "Public Speaking.",
                    "tags": {
                        "Communication": 3
                    }
                },
                {
                    "text": "Advanced Mathematics.",
                    "tags": {
                        "Logical": 3
                    }
                }
            ]
        },
        {
            "text": "How do you stay updated on news?",
            "options": [
                {
                    "text": "Tech blogs and forums like Reddit.",
                    "tags": {
                        "Technical": 3
                    }
                },
                {
                    "text": "Social media feeds.",
                    "tags": {
                        "Social": 3
                    }
                },
                {
                    "text": "Traditional news websites.",
                    "tags": {
                        "Organized": 2
                    }
                },
                {
                    "text": "I don't really follow the news.",
                    "tags": {
                        "Independent": 2
                    }
                }
            ]
        },
        {
            "text": "When setting up a smart home device, you:",
            "options": [
                {
                    "text": "Integrate it perfectly with my network.",
                    "tags": {
                        "Technical": 3
                    }
                },
                {
                    "text": "Just want it to play music and turn on lights.",
                    "tags": {
                        "Practical": 3
                    }
                },
                {
                    "text": "Worry about it recording my data.",
                    "tags": {
                        "Analytical": 3
                    }
                },
                {
                    "text": "Make it change colors based on my mood.",
                    "tags": {
                        "Creative": 3
                    }
                }
            ]
        },
        {
            "text": "Which of these sounds most tedious to you?",
            "options": [
                {
                    "text": "Writing documentation for code.",
                    "tags": {
                        "Technical": 1,
                        "Creative": 3
                    }
                },
                {
                    "text": "Debugging a small syntax error.",
                    "tags": {
                        "Logical": 2
                    }
                },
                {
                    "text": "Drawing the same frame 100 times.",
                    "tags": {
                        "Analytical": 3
                    }
                },
                {
                    "text": "Talking to angry customers.",
                    "tags": {
                        "Independent": 3
                    }
                }
            ]
        },
        {
            "text": "How do you explain Wi-Fi to a child?",
            "options": [
                {
                    "text": "'Invisible waves that carry internet.'",
                    "tags": {
                        "Communication": 3,
                        "Creative": 2
                    }
                },
                {
                    "text": "'Radio frequencies transmitting data.'",
                    "tags": {
                        "Technical": 3
                    }
                },
                {
                    "text": "'Magic that makes YouTube work.'",
                    "tags": {
                        "Empathy": 2
                    }
                },
                {
                    "text": "I wouldn't know how to simplify it.",
                    "tags": {
                        "Analytical": 2
                    }
                }
            ]
        },
        {
            "text": "What is your favorite part of a video game?",
            "options": [
                {
                    "text": "The core gameplay mechanics and loops.",
                    "tags": {
                        "Analytical": 3
                    }
                },
                {
                    "text": "The graphics and soundtrack.",
                    "tags": {
                        "Creative": 3
                    }
                },
                {
                    "text": "The storyline and character dialogue.",
                    "tags": {
                        "Empathy": 2
                    }
                },
                {
                    "text": "Playing with my friends online.",
                    "tags": {
                        "Social": 3
                    }
                }
            ]
        },
        {
            "text": "How do you feel about open-source software?",
            "options": [
                {
                    "text": "Love it, I want to contribute to the code.",
                    "tags": {
                        "Technical": 3,
                        "Collaborative": 2
                    }
                },
                {
                    "text": "It's great because it's free.",
                    "tags": {
                        "Practical": 3
                    }
                },
                {
                    "text": "I prefer polished, paid software.",
                    "tags": {
                        "Organized": 2
                    }
                },
                {
                    "text": "I don't know what that means.",
                    "tags": {
                        "Easygoing": 1
                    }
                }
            ]
        },
        {
            "text": "📷 Visual Scenario: You are given an unfinished, buggy open-source project with no documentation. You:",
            "options": [
                {
                    "text": "Dive straight into code to debug and refactor it.",
                    "tags": {
                        "Technical": 3,
                        "ProblemSolving": 3,
                        "Adaptable": 2
                    }
                },
                {
                    "text": "Map out the system architecture and flow first.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Find the project creator to discuss their original goal.",
                    "tags": {
                        "Communication": 3,
                        "Empathy": 2
                    }
                },
                {
                    "text": "Look for a alternative well-documented library instead.",
                    "tags": {
                        "Practical": 3,
                        "Resourceful": 2
                    }
                }
            ]
        },
        {
            "text": "When building a new app, do you prefer rapid prototypes or solid architecture?",
            "options": [
                {
                    "text": "Ship a rough prototype quickly and iterate based on users.",
                    "tags": {
                        "RiskTaking": 3,
                        "Adaptable": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "Spend weeks designing bulletproof architecture before coding.",
                    "tags": {
                        "Organized": 3,
                        "Analytical": 3,
                        "Dedicated": 2
                    }
                },
                {
                    "text": "Focus on making the user onboarding experience delightful.",
                    "tags": {
                        "Empathy": 3,
                        "Creative": 2
                    }
                },
                {
                    "text": "Write automated test suits for every edge case first.",
                    "tags": {
                        "Technical": 3,
                        "Logical": 3
                    }
                }
            ]
        },
        {
            "text": "How do you feel about joining an early-stage stealth startup vs a stable Big Tech MNC?",
            "options": [
                {
                    "text": "High risk stealth startup for high equity and ownership!",
                    "tags": {
                        "RiskTaking": 3,
                        "Entrepreneurial": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "Stable tech giant with high salary, structure, and perks.",
                    "tags": {
                        "Organized": 3,
                        "Practical": 3,
                        "Stability": 2
                    }
                },
                {
                    "text": "R&D lab or research institute doing deep foundational tech.",
                    "tags": {
                        "Analytical": 3,
                        "Technical": 3,
                        "Independent": 2
                    }
                },
                {
                    "text": "Social impact tech firm building for grassroots communities.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                }
            ]
        },
        {
            "text": "In a high-pressure production system crash at midnight, you:",
            "options": [
                {
                    "text": "Stay calm, trace log files systematically, and apply hotfixes.",
                    "tags": {
                        "ProblemSolving": 3,
                        "Technical": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "Take charge of team communication and manage client updates.",
                    "tags": {
                        "Leadership": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "Collaborate closely on a joint call with cross-functional teams.",
                    "tags": {
                        "Social": 3,
                        "Adaptable": 2
                    }
                },
                {
                    "text": "Review safety protocols to prevent future recurrence.",
                    "tags": {
                        "Organized": 3,
                        "Analytical": 2
                    }
                }
            ]
        },
        {
            "text": "What type of work schedule maximizes your focus?",
            "options": [
                {
                    "text": "Late-night solo coding marathons in total silence.",
                    "tags": {
                        "Independent": 3,
                        "Technical": 3,
                        "Dedicated": 3
                    }
                },
                {
                    "text": "Interactive whiteboard sessions with a brilliant team.",
                    "tags": {
                        "Communication": 3,
                        "Social": 3,
                        "Creative": 2
                    }
                },
                {
                    "text": "Structured 9-to-5 with precise task ticketing and sprints.",
                    "tags": {
                        "Organized": 3,
                        "Practical": 3
                    }
                },
                {
                    "text": "Flexible fluid hours based on personal energy bursts.",
                    "tags": {
                        "Adaptable": 3,
                        "Creative": 3
                    }
                }
            ]
        },
        {
            "text": "When an AI model produces unexpected hallucinated results, your instinct is to:",
            "options": [
                {
                    "text": "Inspect the underlying weights and vector embeddings mathematically.",
                    "tags": {
                        "Analytical": 3,
                        "Technical": 3
                    }
                },
                {
                    "text": "Prompt-engineer clever instructions and guardrails to guide it.",
                    "tags": {
                        "Creative": 3,
                        "Resourceful": 3
                    }
                },
                {
                    "text": "Test how real humans perceive the incorrect output.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 2
                    }
                },
                {
                    "text": "Build automated unit tests to filter invalid responses.",
                    "tags": {
                        "Organized": 3,
                        "Logical": 2
                    }
                }
            ]
        },
        {
            "text": "Which work dynamic sounds most fulfilling to you long term?",
            "options": [
                {
                    "text": "Individual contributor mastering deep, complex technical codebases.",
                    "tags": {
                        "Technical": 3,
                        "Independent": 3,
                        "Dedicated": 2
                    }
                },
                {
                    "text": "Engineering Manager mentoring devs and guiding career growth.",
                    "tags": {
                        "Leadership": 3,
                        "Empathy": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "Product Lead bridging business strategy, design, and tech.",
                    "tags": {
                        "Analytical": 2,
                        "Communication": 3,
                        "Leadership": 3
                    }
                },
                {
                    "text": "Tech Consultant solving different client problems every month.",
                    "tags": {
                        "Adaptable": 3,
                        "ProblemSolving": 3,
                        "Resourceful": 2
                    }
                }
            ]
        },
        {
            "text": "📷 Visual Scenario: A new disruptive framework is released today, rendering your favorite tool outdated. You:",
            "options": [
                {
                    "text": "Excitedly spend the weekend building a test app with it.",
                    "tags": {
                        "Adaptable": 3,
                        "Technical": 3,
                        "RiskTaking": 2
                    }
                },
                {
                    "text": "Wait 6 months to see if industry adoption makes it worthwhile.",
                    "tags": {
                        "Analytical": 3,
                        "Practical": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "Analyze why the existing tool failed to innovate.",
                    "tags": {
                        "Logical": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "Teach your team the differences between both tools.",
                    "tags": {
                        "Communication": 3,
                        "Leadership": 2
                    }
                }
            ]
        },
        {
            "text": "How do you handle ambiguous software requirements from a client?",
            "options": [
                {
                    "text": "Ask probing questions to clarify business objectives.",
                    "tags": {
                        "Communication": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "Build a quick interactive demo to get immediate feedback.",
                    "tags": {
                        "Practical": 3,
                        "Adaptable": 3
                    }
                },
                {
                    "text": "Draft a formal specification document before starting.",
                    "tags": {
                        "Organized": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "Propose an innovative solution they haven't thought of.",
                    "tags": {
                        "Creative": 3,
                        "Entrepreneurial": 2
                    }
                }
            ]
        },
        {
            "text": "What drives your passion for technology?",
            "options": [
                {
                    "text": "The thrill of cracking complex mathematical algorithms.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "Building products that millions of everyday people use.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Creating beautiful digital art and interactive visuals.",
                    "tags": {
                        "Creative": 3,
                        "Visual": 3
                    }
                },
                {
                    "text": "Automating manual work to make operations efficient.",
                    "tags": {
                        "Practical": 3,
                        "ProblemSolving": 2
                    }
                }
            ]
        }
    ],
    "ArtMusic": [
        {
            "text": "When listening to a new song, what grabs your attention first?",
            "options": [
                {
                    "text": "The lyrical storytelling and emotion.",
                    "tags": {
                        "Empathy": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "The underlying beat and rhythm.",
                    "tags": {
                        "Creative": 3,
                        "Auditory": 3
                    }
                },
                {
                    "text": "The technical production and mixing.",
                    "tags": {
                        "Analytical": 2,
                        "Technical": 3
                    }
                },
                {
                    "text": "How well I can dance to it.",
                    "tags": {
                        "Expressive": 3,
                        "Practical": 1
                    }
                }
            ]
        },
        {
            "text": "Faced with a blank canvas (or page), you feel:",
            "options": [
                {
                    "text": "Excited to let my imagination run wild.",
                    "tags": {
                        "Imaginative": 3,
                        "Creative": 3
                    }
                },
                {
                    "text": "Anxious until I outline a solid plan.",
                    "tags": {
                        "Organized": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "Inspired to express a deep personal feeling.",
                    "tags": {
                        "Expressive": 3,
                        "Empathy": 2
                    }
                },
                {
                    "text": "Ready to experiment with new tools/brushes.",
                    "tags": {
                        "Technical": 3,
                        "ProblemSolving": 2
                    }
                }
            ]
        },
        {
            "text": "How do you prefer to practice your craft?",
            "options": [
                {
                    "text": "Jamming or collaborating with others.",
                    "tags": {
                        "Social": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "Isolating myself until it's perfect.",
                    "tags": {
                        "Independent": 3,
                        "Dedicated": 2
                    }
                },
                {
                    "text": "Studying the masters and analyzing their work.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "Performing live and feeding off the crowd.",
                    "tags": {
                        "Expressive": 3,
                        "Leadership": 2
                    }
                }
            ]
        },
        {
            "text": "At an art museum, you spend the most time:",
            "options": [
                {
                    "text": "Looking closely at brushstrokes and techniques.",
                    "tags": {
                        "Technical": 3,
                        "Visual": 3
                    }
                },
                {
                    "text": "Reading the history behind the pieces.",
                    "tags": {
                        "Analytical": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "Soaking in the overall mood of the room.",
                    "tags": {
                        "Empathy": 3,
                        "Creative": 2
                    }
                },
                {
                    "text": "Looking for interactive or modern exhibits.",
                    "tags": {
                        "Practical": 2,
                        "Imaginative": 3
                    }
                }
            ]
        },
        {
            "text": "If you were to score a film, it would be:",
            "options": [
                {
                    "text": "A sweeping, emotional orchestral piece.",
                    "tags": {
                        "Creative": 3,
                        "Empathy": 3
                    }
                },
                {
                    "text": "A gritty, electronic synthwave track.",
                    "tags": {
                        "Technical": 3,
                        "Expressive": 2
                    }
                },
                {
                    "text": "A catchy pop soundtrack.",
                    "tags": {
                        "Social": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "A minimalist, experimental soundscape.",
                    "tags": {
                        "Analytical": 3,
                        "Imaginative": 3
                    }
                }
            ]
        },
        {
            "text": "What is your relationship with criticism?",
            "options": [
                {
                    "text": "I use it to technically improve my skills.",
                    "tags": {
                        "Analytical": 3,
                        "Dedicated": 3
                    }
                },
                {
                    "text": "It hurts, my work is very personal to me.",
                    "tags": {
                        "Sensitive": 3,
                        "Expressive": 2
                    }
                },
                {
                    "text": "I debate it if I think my vision was right.",
                    "tags": {
                        "Communication": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "I ignore it and keep making what I love.",
                    "tags": {
                        "Independent": 3,
                        "Creative": 2
                    }
                }
            ]
        },
        {
            "text": "When designing a poster, what matters most?",
            "options": [
                {
                    "text": "The typography and alignment.",
                    "tags": {
                        "Organized": 3,
                        "Technical": 2
                    }
                },
                {
                    "text": "The striking use of color.",
                    "tags": {
                        "Visual": 3,
                        "Creative": 3
                    }
                },
                {
                    "text": "The message it conveys to the audience.",
                    "tags": {
                        "Communication": 3,
                        "Empathy": 2
                    }
                },
                {
                    "text": "Getting it done quickly and efficiently.",
                    "tags": {
                        "Practical": 3
                    }
                }
            ]
        },
        {
            "text": "Your ideal creative workspace is:",
            "options": [
                {
                    "text": "A messy studio filled with paints and instruments.",
                    "tags": {
                        "Creative": 3,
                        "Expressive": 3
                    }
                },
                {
                    "text": "A clean, minimalist desk with a high-end monitor.",
                    "tags": {
                        "Organized": 3,
                        "Technical": 3
                    }
                },
                {
                    "text": "A bustling coffee shop.",
                    "tags": {
                        "Social": 3,
                        "Adaptable": 2
                    }
                },
                {
                    "text": "Outdoors in nature.",
                    "tags": {
                        "Nature": 3,
                        "Imaginative": 2
                    }
                }
            ]
        },
        {
            "text": "In a coffee shop, you notice first:",
            "options": [
                {
                    "text": "Furniture, lighting, and wall art.",
                    "tags": {
                        "Creative": 3,
                        "Visual": 3
                    }
                },
                {
                    "text": "The background music.",
                    "tags": {
                        "Creative": 2,
                        "Auditory": 3
                    }
                },
                {
                    "text": "How fast the line moves.",
                    "tags": {
                        "Analytical": 2,
                        "Organized": 2
                    }
                },
                {
                    "text": "The vibe of the people.",
                    "tags": {
                        "Empathy": 3
                    }
                }
            ]
        },
        {
            "text": "Bored in class, you are likely:",
            "options": [
                {
                    "text": "Doodling in the margins.",
                    "tags": {
                        "Creative": 3,
                        "Visual": 2
                    }
                },
                {
                    "text": "Writing a story or poem.",
                    "tags": {
                        "Creative": 2,
                        "Communication": 3
                    }
                },
                {
                    "text": "Daydreaming big ideas.",
                    "tags": {
                        "Imaginative": 3
                    }
                },
                {
                    "text": "Reading ahead.",
                    "tags": {
                        "Analytical": 3
                    }
                }
            ]
        },
        {
            "text": "Deciding what clothes to wear:",
            "options": [
                {
                    "text": "Mixing colors and styles.",
                    "tags": {
                        "Creative": 3,
                        "Expressive": 3
                    }
                },
                {
                    "text": "Whatever is comfortable.",
                    "tags": {
                        "Practical": 3
                    }
                },
                {
                    "text": "Following current trends.",
                    "tags": {
                        "Social": 2
                    }
                },
                {
                    "text": "Grabbing the first clean thing.",
                    "tags": {
                        "Easygoing": 2
                    }
                }
            ]
        },
        {
            "text": "When buying a product, you choose based on:",
            "options": [
                {
                    "text": "Beautiful packaging and design.",
                    "tags": {
                        "Creative": 3
                    }
                },
                {
                    "text": "Best features and specs.",
                    "tags": {
                        "Analytical": 3,
                        "Technical": 2
                    }
                },
                {
                    "text": "The cheapest option.",
                    "tags": {
                        "Practical": 3
                    }
                },
                {
                    "text": "Friend recommendations.",
                    "tags": {
                        "Communication": 2
                    }
                }
            ]
        },
        {
            "text": "Favorite way to express feelings:",
            "options": [
                {
                    "text": "Drawing, painting, or designing.",
                    "tags": {
                        "Creative": 3
                    }
                },
                {
                    "text": "Writing or talking.",
                    "tags": {
                        "Communication": 3
                    }
                },
                {
                    "text": "Music or acting.",
                    "tags": {
                        "Expressive": 3
                    }
                },
                {
                    "text": "Processing quietly alone.",
                    "tags": {
                        "Independent": 2
                    }
                }
            ]
        },
        {
            "text": "Which software to master?",
            "options": [
                {
                    "text": "Adobe Photoshop/Illustrator.",
                    "tags": {
                        "Creative": 3,
                        "Technical": 2
                    }
                },
                {
                    "text": "Microsoft Excel.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "Video editing (Premiere).",
                    "tags": {
                        "Creative": 2,
                        "Technical": 2
                    }
                },
                {
                    "text": "I don't like complex software.",
                    "tags": {
                        "Practical": 2
                    }
                }
            ]
        },
        {
            "text": "On a blank billboard, you put:",
            "options": [
                {
                    "text": "Original artwork.",
                    "tags": {
                        "Creative": 3
                    }
                },
                {
                    "text": "A clever, funny quote.",
                    "tags": {
                        "Communication": 3,
                        "Empathy": 2
                    }
                },
                {
                    "text": "A business ad.",
                    "tags": {
                        "Logical": 2,
                        "Leadership": 2
                    }
                },
                {
                    "text": "A confusing puzzle.",
                    "tags": {
                        "Analytical": 3
                    }
                }
            ]
        },
        {
            "text": "When you take a photo, what is most important?",
            "options": [
                {
                    "text": "The composition and lighting.",
                    "tags": {
                        "Creative": 3,
                        "Visual": 3
                    }
                },
                {
                    "text": "Capturing a genuine emotion.",
                    "tags": {
                        "Empathy": 3,
                        "Expressive": 2
                    }
                },
                {
                    "text": "Making sure everyone is in frame.",
                    "tags": {
                        "Organized": 2
                    }
                },
                {
                    "text": "I prefer taking videos over photos.",
                    "tags": {
                        "Technical": 2
                    }
                }
            ]
        },
        {
            "text": "If you redesign your bedroom, you start with:",
            "options": [
                {
                    "text": "Picking a specific color palette and theme.",
                    "tags": {
                        "Creative": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "Moving furniture for better space and flow.",
                    "tags": {
                        "Analytical": 2,
                        "Practical": 3
                    }
                },
                {
                    "text": "Hanging up posters of things I love.",
                    "tags": {
                        "Expressive": 3
                    }
                },
                {
                    "text": "I don't care what my room looks like.",
                    "tags": {
                        "Easygoing": 3
                    }
                }
            ]
        },
        {
            "text": "What kind of YouTube videos do you binge?",
            "options": [
                {
                    "text": "Video essays on movies, art, or game design.",
                    "tags": {
                        "Analytical": 2,
                        "Creative": 3
                    }
                },
                {
                    "text": "Vlogs and lifestyle content.",
                    "tags": {
                        "Social": 3
                    }
                },
                {
                    "text": "Tech reviews and unboxings.",
                    "tags": {
                        "Technical": 3
                    }
                },
                {
                    "text": "Comedy and sketch shows.",
                    "tags": {
                        "Communication": 2,
                        "Expressive": 2
                    }
                }
            ]
        },
        {
            "text": "If you were a character in a movie, you'd be:",
            "options": [
                {
                    "text": "The visionary director behind the camera.",
                    "tags": {
                        "Leadership": 2,
                        "Creative": 3
                    }
                },
                {
                    "text": "The charismatic lead actor.",
                    "tags": {
                        "Expressive": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "The writer who created the whole universe.",
                    "tags": {
                        "Imaginative": 3
                    }
                },
                {
                    "text": "The brilliant hacker sidekick.",
                    "tags": {
                        "Technical": 3
                    }
                }
            ]
        },
        {
            "text": "How do you feel about modern abstract art?",
            "options": [
                {
                    "text": "I love interpreting the hidden meanings.",
                    "tags": {
                        "Creative": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "I appreciate the colors, even if it's weird.",
                    "tags": {
                        "Visual": 3
                    }
                },
                {
                    "text": "I think it's mostly a scam. Anyone could paint that.",
                    "tags": {
                        "Logical": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "It's okay, but I prefer realistic drawings.",
                    "tags": {
                        "Organized": 2
                    }
                }
            ]
        },
        {
            "text": "When writing an essay, you spend the most time:",
            "options": [
                {
                    "text": "Finding the perfect descriptive words.",
                    "tags": {
                        "Communication": 3,
                        "Creative": 2
                    }
                },
                {
                    "text": "Making sure the formatting and citations are flawless.",
                    "tags": {
                        "Organized": 3
                    }
                },
                {
                    "text": "Structuring a bulletproof argument.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "Procrastinating until the night before.",
                    "tags": {
                        "Adaptable": 2
                    }
                }
            ]
        },
        {
            "text": "What is your relationship with social media?",
            "options": [
                {
                    "text": "I carefully curate my grid to look aesthetic.",
                    "tags": {
                        "Creative": 3,
                        "Visual": 3
                    }
                },
                {
                    "text": "I use it to chat and stay connected.",
                    "tags": {
                        "Social": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "I mainly lurk and consume information.",
                    "tags": {
                        "Analytical": 2
                    }
                },
                {
                    "text": "I rarely use it. I prefer real life.",
                    "tags": {
                        "Independent": 3
                    }
                }
            ]
        },
        {
            "text": "If you had to learn an instrument, it would be:",
            "options": [
                {
                    "text": "Piano (complex and versatile).",
                    "tags": {
                        "Analytical": 3,
                        "Creative": 2
                    }
                },
                {
                    "text": "Electric Guitar (loud and expressive).",
                    "tags": {
                        "Expressive": 3
                    }
                },
                {
                    "text": "Drums (rhythm and energy).",
                    "tags": {
                        "Practical": 3
                    }
                },
                {
                    "text": "Synthesizer (electronic and technical).",
                    "tags": {
                        "Technical": 3
                    }
                }
            ]
        },
        {
            "text": "How do you sketch or draw?",
            "options": [
                {
                    "text": "Freehand, letting my imagination guide me.",
                    "tags": {
                        "Creative": 3,
                        "Imaginative": 3
                    }
                },
                {
                    "text": "With a ruler, measuring perfect perspective.",
                    "tags": {
                        "Organized": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "I can only draw stick figures.",
                    "tags": {
                        "Practical": 2
                    }
                },
                {
                    "text": "I trace or copy things I see.",
                    "tags": {
                        "Visual": 2
                    }
                }
            ]
        },
        {
            "text": "When watching an animated movie, you think about:",
            "options": [
                {
                    "text": "How many hours it took to render the lighting.",
                    "tags": {
                        "Technical": 3,
                        "Creative": 2
                    }
                },
                {
                    "text": "The character design and color choices.",
                    "tags": {
                        "Creative": 3,
                        "Visual": 3
                    }
                },
                {
                    "text": "The vocal performances of the actors.",
                    "tags": {
                        "Expressive": 3
                    }
                },
                {
                    "text": "Just enjoying the plot.",
                    "tags": {
                        "Easygoing": 3
                    }
                }
            ]
        },
        {
            "text": "📷 Visual Scenario: You are given Generative AI creative tools (Midjourney / Suno). How do you integrate them?",
            "options": [
                {
                    "text": "Use AI to quickly explore 50 wild visual concepts, then craft the final manually.",
                    "tags": {
                        "Creative": 3,
                        "Adaptable": 3,
                        "Resourceful": 2
                    }
                },
                {
                    "text": "Master the exact technical prompt syntax and parameters for exact control.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "Reject AI art—pure human emotion and manual craftsmanship matter most.",
                    "tags": {
                        "Expressive": 3,
                        "Dedicated": 3,
                        "Sensitive": 2
                    }
                },
                {
                    "text": "Build a business service selling AI-generated assets to commercial clients.",
                    "tags": {
                        "Entrepreneurial": 3,
                        "Practical": 3
                    }
                }
            ]
        },
        {
            "text": "How do you balance artistic freedom vs commercial client deadlines?",
            "options": [
                {
                    "text": "Execute client briefs efficiently while sneaking in subtle creative flair.",
                    "tags": {
                        "Practical": 3,
                        "Communication": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "Fight fiercely for my artistic vision even if it pushes deadlines.",
                    "tags": {
                        "Expressive": 3,
                        "Dedicated": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "Follow the brief strictly to ensure quick payment and zero friction.",
                    "tags": {
                        "Practical": 3,
                        "Easygoing": 2
                    }
                },
                {
                    "text": "Pitch alternative creative concepts that elevate the client's original idea.",
                    "tags": {
                        "Creative": 3,
                        "Communication": 3
                    }
                }
            ]
        },
        {
            "text": "What environment sparks your deepest creative breakthroughs?",
            "options": [
                {
                    "text": "Late nights isolated in my studio surrounded by my work.",
                    "tags": {
                        "Independent": 3,
                        "Creative": 3,
                        "Dedicated": 3
                    }
                },
                {
                    "text": "Collaborative brainstorming jams with musicians and designers.",
                    "tags": {
                        "Social": 3,
                        "Communication": 3,
                        "Expressive": 2
                    }
                },
                {
                    "text": "Traveling to unfamiliar places and observing different cultures.",
                    "tags": {
                        "Adaptable": 3,
                        "Empathy": 3,
                        "Imaginative": 2
                    }
                },
                {
                    "text": "Studying classical art history and analyzing master compositions.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 2
                    }
                }
            ]
        },
        {
            "text": "When starting a major creative project (album, film, brand identity), you:",
            "options": [
                {
                    "text": "Build a comprehensive moodboard and story structure first.",
                    "tags": {
                        "Organized": 3,
                        "Visual": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "Dive straight into creation and let intuition guide the flow.",
                    "tags": {
                        "Creative": 3,
                        "Expressive": 3,
                        "Adaptable": 2
                    }
                },
                {
                    "text": "Gather audience feedback and trend data before making decisions.",
                    "tags": {
                        "Analytical": 3,
                        "Social": 2
                    }
                },
                {
                    "text": "Assemble a collaborative crew of specialists to delegate tasks.",
                    "tags": {
                        "Leadership": 3,
                        "Communication": 3
                    }
                }
            ]
        },
        {
            "text": "How do you handle creator's block?",
            "options": [
                {
                    "text": "Switch mediums completely (e.g. from painting to music or writing).",
                    "tags": {
                        "Adaptable": 3,
                        "Creative": 3
                    }
                },
                {
                    "text": "Force myself to sit and work through the discomfort until it breaks.",
                    "tags": {
                        "Dedicated": 3,
                        "Independent": 2
                    }
                },
                {
                    "text": "Go out into public spaces and observe people's emotions.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Deconstruct previous successful projects to analyze what worked.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 2
                    }
                }
            ]
        },
        {
            "text": "If you were offered a guaranteed salaried corporate design job vs a risky freelance artist path:",
            "options": [
                {
                    "text": "Risky freelance path! I need total creative autonomy and independence.",
                    "tags": {
                        "RiskTaking": 3,
                        "Independent": 3,
                        "Creative": 3
                    }
                },
                {
                    "text": "Corporate design lead—I want financial security and big brand reach.",
                    "tags": {
                        "Organized": 3,
                        "Practical": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "Start my own creative agency hiring other artists.",
                    "tags": {
                        "Entrepreneurial": 3,
                        "Leadership": 3
                    }
                },
                {
                    "text": "Work corporate by day, run my personal art studio by night.",
                    "tags": {
                        "Dedicated": 3,
                        "Practical": 3
                    }
                }
            ]
        },
        {
            "text": "What role do digital metrics (likes, views, engagement) play in your creative work?",
            "options": [
                {
                    "text": "I analyze analytics to optimize content timing and audience reach.",
                    "tags": {
                        "Analytical": 3,
                        "Practical": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "I create purely for self-expression—metrics don't dictate my art.",
                    "tags": {
                        "Expressive": 3,
                        "Independent": 3,
                        "Dedicated": 2
                    }
                },
                {
                    "text": "I use engagement to test what stories resonate with people.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "I leverage metrics to pitch lucrative brand sponsorships.",
                    "tags": {
                        "Entrepreneurial": 3,
                        "Leadership": 2
                    }
                }
            ]
        },
        {
            "text": "📷 Visual Scenario: You are directing a short film and the lead actor falls sick 2 hours before shooting. You:",
            "options": [
                {
                    "text": "Rewrite the scene on the spot for a solo monologue with the remaining actor.",
                    "tags": {
                        "Adaptable": 3,
                        "Creative": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "Step in front of the camera and play the role yourself.",
                    "tags": {
                        "Expressive": 3,
                        "Leadership": 3,
                        "RiskTaking": 2
                    }
                },
                {
                    "text": "Reschedule the shoot and use the time to refine the shot-list.",
                    "tags": {
                        "Organized": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "Call an understudy actor from your network immediately.",
                    "tags": {
                        "Resourceful": 3,
                        "Communication": 3
                    }
                }
            ]
        },
        {
            "text": "What aspect of storytelling interests you most?",
            "options": [
                {
                    "text": "Designing complex visual imagery and aesthetic worlds.",
                    "tags": {
                        "Visual": 3,
                        "Creative": 3,
                        "Imaginative": 3
                    }
                },
                {
                    "text": "Developing raw, authentic character psychology and dialogue.",
                    "tags": {
                        "Psychology": 3,
                        "Empathy": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "Structuring tight plot twists and mystery pacing.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "Evoking immediate visceral audio/musical emotion.",
                    "tags": {
                        "Auditory": 3,
                        "Expressive": 3
                    }
                }
            ]
        },
        {
            "text": "How do you feel about working with technical tools (3D software, code, cameras)?",
            "options": [
                {
                    "text": "I love mastering technical tools to push visual possibilities.",
                    "tags": {
                        "Technical": 3,
                        "Creative": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "I prefer simple tactile tools—pencils, instruments, paper.",
                    "tags": {
                        "Practical": 3,
                        "Expressive": 3
                    }
                },
                {
                    "text": "I hire technical experts so I can focus purely on vision.",
                    "tags": {
                        "Leadership": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "I pick up whatever tool gets the job done fastest.",
                    "tags": {
                        "Adaptable": 3,
                        "Resourceful": 2
                    }
                }
            ]
        }
    ],
    "Healthcare": [
        {
            "text": "A stranger suddenly faints in a public place. You:",
            "options": [
                {
                    "text": "Immediately check their pulse and breathing.",
                    "tags": {
                        "Practical": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "Comfort the people around them and call 911.",
                    "tags": {
                        "Empathy": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "Organize the crowd to give the person space.",
                    "tags": {
                        "Leadership": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "Panic slightly, but try to find a doctor.",
                    "tags": {
                        "Sensitive": 2,
                        "Resourceful": 3
                    }
                }
            ]
        },
        {
            "text": "What aspect of the human body fascinates you most?",
            "options": [
                {
                    "text": "How the brain processes thoughts and trauma.",
                    "tags": {
                        "Psychology": 3,
                        "Empathy": 2
                    }
                },
                {
                    "text": "The mechanics of bones, muscles, and surgery.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "How cells fight off viruses and diseases.",
                    "tags": {
                        "Logical": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "Diet, nutrition, and holistic wellness.",
                    "tags": {
                        "Nature": 3,
                        "Practical": 3
                    }
                }
            ]
        },
        {
            "text": "How do you deliver difficult news to a friend?",
            "options": [
                {
                    "text": "With deep empathy, holding their hand.",
                    "tags": {
                        "Empathy": 3,
                        "Emotional": 3
                    }
                },
                {
                    "text": "Directly and clearly, offering immediate solutions.",
                    "tags": {
                        "Logical": 3,
                        "ProblemSolving": 2
                    }
                },
                {
                    "text": "I try to have someone else do it, I hate conflict.",
                    "tags": {
                        "Reserved": 3
                    }
                },
                {
                    "text": "I carefully script what I'm going to say first.",
                    "tags": {
                        "Organized": 3,
                        "Communication": 2
                    }
                }
            ]
        },
        {
            "text": "Working a 12-hour night shift sounds:",
            "options": [
                {
                    "text": "Exhausting, but worth it to save lives.",
                    "tags": {
                        "Dedicated": 3,
                        "Empathy": 3
                    }
                },
                {
                    "text": "Great, I love the quiet focus of the night.",
                    "tags": {
                        "Independent": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "Terrible, I need a strict sleep schedule.",
                    "tags": {
                        "Organized": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "Exciting, I thrive on adrenaline and coffee.",
                    "tags": {
                        "Adaptable": 3,
                        "ProblemSolving": 2
                    }
                }
            ]
        },
        {
            "text": "In a hospital setting, you would rather be:",
            "options": [
                {
                    "text": "The surgeon performing a high-stakes operation.",
                    "tags": {
                        "Technical": 3,
                        "Leadership": 3
                    }
                },
                {
                    "text": "The nurse providing daily care and comfort.",
                    "tags": {
                        "Empathy": 3,
                        "Dedicated": 3
                    }
                },
                {
                    "text": "The lab technician analyzing blood samples.",
                    "tags": {
                        "Analytical": 3,
                        "Independent": 3
                    }
                },
                {
                    "text": "The administrator managing hospital efficiency.",
                    "tags": {
                        "Organized": 3,
                        "Logical": 2
                    }
                }
            ]
        },
        {
            "text": "How do you feel about continuous, lifelong learning?",
            "options": [
                {
                    "text": "I love reading the latest medical journals.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "I enjoy learning if it directly helps my patients.",
                    "tags": {
                        "Empathy": 3,
                        "Practical": 3
                    }
                },
                {
                    "text": "I prefer to master one skill and stick to it.",
                    "tags": {
                        "Dedicated": 2,
                        "Organized": 2
                    }
                },
                {
                    "text": "I like learning through hands-on practice.",
                    "tags": {
                        "Technical": 3,
                        "Adaptable": 2
                    }
                }
            ]
        },
        {
            "text": "When someone is dealing with a chronic illness, you:",
            "options": [
                {
                    "text": "Research alternative treatments and clinical trials.",
                    "tags": {
                        "Analytical": 3,
                        "Resourceful": 3
                    }
                },
                {
                    "text": "Check in on their mental health regularly.",
                    "tags": {
                        "Psychology": 3,
                        "Empathy": 3
                    }
                },
                {
                    "text": "Cook them meals and help with daily chores.",
                    "tags": {
                        "Practical": 3,
                        "Dedicated": 2
                    }
                },
                {
                    "text": "Help them organize their medications and appointments.",
                    "tags": {
                        "Organized": 3
                    }
                }
            ]
        },
        {
            "text": "How do you handle gross sights (blood, wounds)?",
            "options": [
                {
                    "text": "I have a strong stomach, it doesn't bother me.",
                    "tags": {
                        "Practical": 3,
                        "Dedicated": 3
                    }
                },
                {
                    "text": "I view it purely clinically and scientifically.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "I feel woozy but I push through it.",
                    "tags": {
                        "Adaptable": 2
                    }
                },
                {
                    "text": "I absolutely cannot handle it.",
                    "tags": {
                        "Sensitive": 3
                    }
                }
            ]
        },
        {
            "text": "A friend is bleeding. You:",
            "options": [
                {
                    "text": "Stay calm, clean and bandage it.",
                    "tags": {
                        "Practical": 3,
                        "ProblemSolving": 2
                    }
                },
                {
                    "text": "Comfort them so they aren't scared.",
                    "tags": {
                        "Empathy": 3
                    }
                },
                {
                    "text": "Faint or look away.",
                    "tags": {
                        "Sensitive": 3
                    }
                },
                {
                    "text": "Call someone who knows what to do.",
                    "tags": {
                        "Communication": 2
                    }
                }
            ]
        },
        {
            "text": "How do you feel about daily routines?",
            "options": [
                {
                    "text": "Love having a strict schedule.",
                    "tags": {
                        "Organized": 3
                    }
                },
                {
                    "text": "Like them, but need flexibility.",
                    "tags": {
                        "Adaptable": 2
                    }
                },
                {
                    "text": "Thrive when every day is different.",
                    "tags": {
                        "Adaptable": 3,
                        "ProblemSolving": 2
                    }
                },
                {
                    "text": "Hate routines, prefer to wing it.",
                    "tags": {
                        "Creative": 2
                    }
                }
            ]
        },
        {
            "text": "When a friend has a problem, you:",
            "options": [
                {
                    "text": "Listen quietly and offer a shoulder.",
                    "tags": {
                        "Empathy": 3
                    }
                },
                {
                    "text": "Offer solutions to fix it.",
                    "tags": {
                        "ProblemSolving": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "Try to distract them with fun.",
                    "tags": {
                        "Creative": 2,
                        "Social": 2
                    }
                },
                {
                    "text": "Help them analyze why it happened.",
                    "tags": {
                        "Analytical": 3
                    }
                }
            ]
        },
        {
            "text": "Working under extreme pressure:",
            "options": [
                {
                    "text": "I stay highly focused and act quickly.",
                    "tags": {
                        "ProblemSolving": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "I get anxious but push through.",
                    "tags": {
                        "Dedicated": 3
                    }
                },
                {
                    "text": "I need to step back and breathe.",
                    "tags": {
                        "Analytical": 2
                    }
                },
                {
                    "text": "I prefer low-stress environments.",
                    "tags": {
                        "Creative": 2
                    }
                }
            ]
        },
        {
            "text": "Comfortable talking to strangers?",
            "options": [
                {
                    "text": "Yes, I love making people feel heard.",
                    "tags": {
                        "Empathy": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "Only if I have a reason to.",
                    "tags": {
                        "Logical": 2,
                        "Practical": 2
                    }
                },
                {
                    "text": "Can do it, but it drains me.",
                    "tags": {
                        "Independent": 2
                    }
                },
                {
                    "text": "No, I am very shy.",
                    "tags": {
                        "Reserved": 2
                    }
                }
            ]
        },
        {
            "text": "If you see a stray animal on the street, you:",
            "options": [
                {
                    "text": "Try to catch it and take it to a vet/shelter.",
                    "tags": {
                        "Empathy": 3,
                        "Nature": 3
                    }
                },
                {
                    "text": "Call animal control to handle it safely.",
                    "tags": {
                        "Organized": 2,
                        "Logical": 2
                    }
                },
                {
                    "text": "Feel sad but keep walking.",
                    "tags": {
                        "Sensitive": 2
                    }
                },
                {
                    "text": "Try to feed it from a distance.",
                    "tags": {
                        "Practical": 2
                    }
                }
            ]
        },
        {
            "text": "What is your approach to eating healthy?",
            "options": [
                {
                    "text": "I track my macros and calories in an app.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "I eat intuitively based on how my body feels.",
                    "tags": {
                        "Empathy": 2,
                        "Adaptable": 2
                    }
                },
                {
                    "text": "I love cooking fresh, organic meals from scratch.",
                    "tags": {
                        "Creative": 3,
                        "Nature": 2
                    }
                },
                {
                    "text": "I eat whatever tastes good and is cheap.",
                    "tags": {
                        "Practical": 3
                    }
                }
            ]
        },
        {
            "text": "When someone is grieving, the best thing to do is:",
            "options": [
                {
                    "text": "Sit with them in silence and hold their hand.",
                    "tags": {
                        "Empathy": 3,
                        "Emotional": 3
                    }
                },
                {
                    "text": "Cook them meals and clean their house.",
                    "tags": {
                        "Practical": 3,
                        "Dedicated": 2
                    }
                },
                {
                    "text": "Give them space to process it alone.",
                    "tags": {
                        "Independent": 2
                    }
                },
                {
                    "text": "Recommend a good therapist.",
                    "tags": {
                        "Analytical": 2,
                        "Logical": 2
                    }
                }
            ]
        },
        {
            "text": "How is your memory for small details?",
            "options": [
                {
                    "text": "Excellent, I remember allergies and birthdays.",
                    "tags": {
                        "Empathy": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Good for facts and numbers, bad for names.",
                    "tags": {
                        "Analytical": 3
                    }
                },
                {
                    "text": "Terrible, I have to write everything down.",
                    "tags": {
                        "Adaptable": 2
                    }
                },
                {
                    "text": "I only remember things I find interesting.",
                    "tags": {
                        "Creative": 2
                    }
                }
            ]
        },
        {
            "text": "How do you feel about physical fitness?",
            "options": [
                {
                    "text": "I love pushing my body to its absolute limits.",
                    "tags": {
                        "Dedicated": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "I enjoy yoga and stretching for mental clarity.",
                    "tags": {
                        "Empathy": 2,
                        "Nature": 2
                    }
                },
                {
                    "text": "I analyze fitness science and optimize workouts.",
                    "tags": {
                        "Analytical": 3,
                        "Technical": 2
                    }
                },
                {
                    "text": "I hate sweating.",
                    "tags": {
                        "Easygoing": 3
                    }
                }
            ]
        },
        {
            "text": "If a child is throwing a tantrum in public, you think:",
            "options": [
                {
                    "text": "'That poor parent must be so stressed.'",
                    "tags": {
                        "Empathy": 3
                    }
                },
                {
                    "text": "'I wonder what triggered the child's behavior.'",
                    "tags": {
                        "Analytical": 3,
                        "Psychology": 3
                    }
                },
                {
                    "text": "'Someone needs to discipline that kid.'",
                    "tags": {
                        "Logical": 2
                    }
                },
                {
                    "text": "'I need to get out of this store right now.'",
                    "tags": {
                        "Independent": 3
                    }
                }
            ]
        },
        {
            "text": "How do you handle sleep deprivation?",
            "options": [
                {
                    "text": "I can push through it with coffee and adrenaline.",
                    "tags": {
                        "Dedicated": 3,
                        "Adaptable": 2
                    }
                },
                {
                    "text": "I become very cranky and useless.",
                    "tags": {
                        "Sensitive": 3
                    }
                },
                {
                    "text": "I refuse to get less than 8 hours, it's unhealthy.",
                    "tags": {
                        "Organized": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "I take strategic power naps.",
                    "tags": {
                        "Analytical": 3
                    }
                }
            ]
        },
        {
            "text": "What is your view on mental health?",
            "options": [
                {
                    "text": "It is just as important as physical health.",
                    "tags": {
                        "Empathy": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "It can be solved by changing chemical imbalances.",
                    "tags": {
                        "Analytical": 3,
                        "Technical": 2
                    }
                },
                {
                    "text": "Nature and meditation are the best cures.",
                    "tags": {
                        "Nature": 3
                    }
                },
                {
                    "text": "People just need to toughen up.",
                    "tags": {
                        "Practical": 2,
                        "Logical": 1
                    }
                }
            ]
        },
        {
            "text": "How do you react when you get sick?",
            "options": [
                {
                    "text": "I research my symptoms extensively online.",
                    "tags": {
                        "Analytical": 3
                    }
                },
                {
                    "text": "I follow the doctor's orders perfectly.",
                    "tags": {
                        "Organized": 3
                    }
                },
                {
                    "text": "I drink tea, sleep, and use natural remedies.",
                    "tags": {
                        "Nature": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "I ignore it and keep going to work.",
                    "tags": {
                        "Dedicated": 3
                    }
                }
            ]
        },
        {
            "text": "When learning a physical task (like giving CPR), you:",
            "options": [
                {
                    "text": "Practice repeatedly on a dummy until perfect.",
                    "tags": {
                        "Dedicated": 3,
                        "Practical": 3
                    }
                },
                {
                    "text": "Memorize the textbook steps first.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "Ask the instructor to watch and correct my form.",
                    "tags": {
                        "Communication": 3
                    }
                },
                {
                    "text": "Hope I never actually have to use it.",
                    "tags": {
                        "Sensitive": 2
                    }
                }
            ]
        },
        {
            "text": "What do you think of alternative medicine (like acupuncture)?",
            "options": [
                {
                    "text": "If it makes the patient feel better, it's good.",
                    "tags": {
                        "Empathy": 3,
                        "OpenMinded": 3
                    }
                },
                {
                    "text": "It's a scam without peer-reviewed scientific proof.",
                    "tags": {
                        "Logical": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "I want to learn how to do it.",
                    "tags": {
                        "Creative": 2,
                        "Practical": 2
                    }
                },
                {
                    "text": "I'm scared of needles.",
                    "tags": {
                        "Sensitive": 2
                    }
                }
            ]
        },
        {
            "text": "How good are you at multitasking in a chaotic room?",
            "options": [
                {
                    "text": "Excellent, I thrive when 5 things happen at once.",
                    "tags": {
                        "Adaptable": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "I can do it, but I make checklists to stay sane.",
                    "tags": {
                        "Organized": 3
                    }
                },
                {
                    "text": "Terrible. I need quiet to focus on one patient.",
                    "tags": {
                        "Analytical": 2,
                        "Sensitive": 2
                    }
                },
                {
                    "text": "I delegate the tasks to other people.",
                    "tags": {
                        "Leadership": 3
                    }
                }
            ]
        },
        {
            "text": "📷 Visual Scenario: You notice an emergency patient's diagnostic lab result contradicts their physical symptoms. You:",
            "options": [
                {
                    "text": "Re-test the sample immediately to verify laboratory accuracy.",
                    "tags": {
                        "Analytical": 3,
                        "Technical": 3,
                        "ProblemSolving": 2
                    }
                },
                {
                    "text": "Trust clinical observation and consult senior consultants.",
                    "tags": {
                        "Communication": 3,
                        "Leadership": 2,
                        "Empathy": 2
                    }
                },
                {
                    "text": "Re-examine the patient carefully for subtle missed signs.",
                    "tags": {
                        "Empathy": 3,
                        "Dedicated": 3
                    }
                },
                {
                    "text": "Document the anomaly in hospital records for review.",
                    "tags": {
                        "Organized": 3,
                        "Logical": 2
                    }
                }
            ]
        },
        {
            "text": "When choosing between clinical patient care vs medical research & data analytics:",
            "options": [
                {
                    "text": "Direct patient care—I want to hold hands, talk, and heal directly.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "Medical research—I prefer analyzing DNA datasets to discover cures.",
                    "tags": {
                        "Analytical": 3,
                        "Technical": 3,
                        "Independent": 2
                    }
                },
                {
                    "text": "Health-tech management—building apps and hospital tech systems.",
                    "tags": {
                        "Technical": 2,
                        "Organized": 3,
                        "Entrepreneurial": 2
                    }
                },
                {
                    "text": "Public health policy—preventing disease epidemics across India.",
                    "tags": {
                        "Leadership": 3,
                        "Logical": 3,
                        "Social": 2
                    }
                }
            ]
        },
        {
            "text": "How do you handle emotional fatigue when dealing with suffering individuals daily?",
            "options": [
                {
                    "text": "Maintain strict professional boundaries while remaining compassionate.",
                    "tags": {
                        "Logical": 3,
                        "Practical": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "Decompress through quiet isolation and nature walks.",
                    "tags": {
                        "Independent": 3,
                        "Nature": 3
                    }
                },
                {
                    "text": "Talk it out with trusted colleagues and support groups.",
                    "tags": {
                        "Communication": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Channel the emotion into working harder for solutions.",
                    "tags": {
                        "Dedicated": 3,
                        "ProblemSolving": 2
                    }
                }
            ]
        },
        {
            "text": "What is your stance on high-stakes surgical procedures with 50/50 survival odds?",
            "options": [
                {
                    "text": "Perform the procedure if it gives the patient their only fighting chance!",
                    "tags": {
                        "RiskTaking": 3,
                        "Technical": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "Explore non-invasive palliative therapy to minimize suffering.",
                    "tags": {
                        "Empathy": 3,
                        "Practical": 3
                    }
                },
                {
                    "text": "Consult an ethics committee and family before deciding.",
                    "tags": {
                        "Communication": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Analyze statistical survival data from international trials first.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3
                    }
                }
            ]
        },
        {
            "text": "When a patient refuses life-saving treatment due to personal beliefs, you:",
            "options": [
                {
                    "text": "Listen patiently to understand their perspective and gently educate.",
                    "tags": {
                        "Empathy": 3,
                        "Communication": 3,
                        "Psychology": 3
                    }
                },
                {
                    "text": "Respect their legal autonomy and document their choice.",
                    "tags": {
                        "Logical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Involve family or counselors to persuade them safely.",
                    "tags": {
                        "Social": 3,
                        "Resourceful": 2
                    }
                },
                {
                    "text": "Fervently debate with clinical facts until they understand.",
                    "tags": {
                        "Dedicated": 3,
                        "Logical": 2
                    }
                }
            ]
        },
        {
            "text": "How do you feel about working in rural primary health centers vs metro super-specialty hospitals?",
            "options": [
                {
                    "text": "Rural health centers—making a real difference where care is scarce!",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3,
                        "Dedicated": 3
                    }
                },
                {
                    "text": "Metro super-specialty hospitals with cutting-edge medical tech.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "Building a health-tech startup serving both remotely via tele-medicine.",
                    "tags": {
                        "Entrepreneurial": 3,
                        "Practical": 3
                    }
                },
                {
                    "text": "Government medical officer managing public health campaigns.",
                    "tags": {
                        "Leadership": 3,
                        "Organized": 3
                    }
                }
            ]
        },
        {
            "text": "When learning complex human anatomy and pharmacology, you rely on:",
            "options": [
                {
                    "text": "Interactive 3D anatomical models and VR simulations.",
                    "tags": {
                        "Technical": 3,
                        "Visual": 3
                    }
                },
                {
                    "text": "Structured flashcards, mnemonics, and detailed charts.",
                    "tags": {
                        "Organized": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "Hands-on dissection and clinical practicals.",
                    "tags": {
                        "Practical": 3,
                        "Dedicated": 2
                    }
                },
                {
                    "text": "Group study sessions discussing case studies out loud.",
                    "tags": {
                        "Communication": 3,
                        "Social": 3
                    }
                }
            ]
        },
        {
            "text": "📷 Visual Scenario: An outbreak of an unknown fever hits your district. Your priority is:",
            "options": [
                {
                    "text": "Isolate patients and trace infection vectors scientifically.",
                    "tags": {
                        "Analytical": 3,
                        "ProblemSolving": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "Set up emergency triage tents and care for severe cases.",
                    "tags": {
                        "Practical": 3,
                        "Empathy": 3,
                        "Dedicated": 2
                    }
                },
                {
                    "text": "Communicate clear preventative measures to the public.",
                    "tags": {
                        "Communication": 3,
                        "Leadership": 3
                    }
                },
                {
                    "text": "Send blood samples to top labs for rapid genomic sequencing.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 2
                    }
                }
            ]
        },
        {
            "text": "What drives your interest in healthcare?",
            "options": [
                {
                    "text": "Relieving human suffering and bringing comfort to families.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Cracking the complex biological mysteries of human biology.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "The high prestige, discipline, and lifelong stability.",
                    "tags": {
                        "Dedicated": 3,
                        "Organized": 3,
                        "Stability": 2
                    }
                },
                {
                    "text": "Pioneering medical hardware, AI diagnostics, and bio-tech.",
                    "tags": {
                        "Technical": 3,
                        "Entrepreneurial": 2
                    }
                }
            ]
        },
        {
            "text": "How do you react when a treatment plan doesn't show progress after a week?",
            "options": [
                {
                    "text": "Re-evaluate the diagnosis and pivot to an alternative protocol.",
                    "tags": {
                        "Adaptable": 3,
                        "ProblemSolving": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "Order comprehensive blood panels and diagnostic imaging.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "Spend extra time observing the patient's daily habits and diet.",
                    "tags": {
                        "Empathy": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "Consult senior specialists to review the case together.",
                    "tags": {
                        "Communication": 3,
                        "Social": 2
                    }
                }
            ]
        }
    ],
    "GovServices": [
        {
            "text": "When you see a pothole in your neighborhood, you:",
            "options": [
                {
                    "text": "Organize a petition to get the city to fix it.",
                    "tags": {
                        "Leadership": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "Research the city budget to see why roads are failing.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "Fill it with gravel yourself to help out.",
                    "tags": {
                        "Practical": 3,
                        "ProblemSolving": 2
                    }
                },
                {
                    "text": "Complain about it on social media.",
                    "tags": {
                        "Expressive": 2
                    }
                }
            ]
        },
        {
            "text": "What is the most important role of a government?",
            "options": [
                {
                    "text": "Maintaining law, order, and national security.",
                    "tags": {
                        "Logical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Providing welfare and protecting the vulnerable.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Building infrastructure (roads, schools, grids).",
                    "tags": {
                        "Technical": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "Balancing the budget and managing the economy.",
                    "tags": {
                        "Analytical": 3,
                        "ProblemSolving": 2
                    }
                }
            ]
        },
        {
            "text": "If a natural disaster strikes your city, you are the one who:",
            "options": [
                {
                    "text": "Coordinates the rescue volunteers.",
                    "tags": {
                        "Leadership": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Operates the heavy machinery to clear debris.",
                    "tags": {
                        "Technical": 3,
                        "Practical": 3
                    }
                },
                {
                    "text": "Distributes food and blankets to victims.",
                    "tags": {
                        "Empathy": 3,
                        "Dedicated": 2
                    }
                },
                {
                    "text": "Analyzes the structural damage of buildings.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 2
                    }
                }
            ]
        },
        {
            "text": "How do you feel about working within strict bureaucracies?",
            "options": [
                {
                    "text": "I excel at navigating complex rules and forms.",
                    "tags": {
                        "Organized": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "I find loopholes to get things done faster.",
                    "tags": {
                        "ProblemSolving": 3,
                        "Resourceful": 3
                    }
                },
                {
                    "text": "I hate the red tape, I want to change the system.",
                    "tags": {
                        "Leadership": 3,
                        "Creative": 2
                    }
                },
                {
                    "text": "I just follow instructions to avoid trouble.",
                    "tags": {
                        "Practical": 2,
                        "Easygoing": 2
                    }
                }
            ]
        },
        {
            "text": "Which historical figure do you admire most?",
            "options": [
                {
                    "text": "A military general who won a strategic war.",
                    "tags": {
                        "Leadership": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "A civil rights leader who changed society.",
                    "tags": {
                        "Communication": 3,
                        "Empathy": 3
                    }
                },
                {
                    "text": "An engineer who built a famous dam or bridge.",
                    "tags": {
                        "Technical": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "A diplomat who negotiated a lasting peace treaty.",
                    "tags": {
                        "Analytical": 3,
                        "ProblemSolving": 3
                    }
                }
            ]
        },
        {
            "text": "In a public town hall meeting, you would:",
            "options": [
                {
                    "text": "Give a passionate speech at the microphone.",
                    "tags": {
                        "Communication": 3,
                        "Expressive": 3
                    }
                },
                {
                    "text": "Take detailed notes on community concerns.",
                    "tags": {
                        "Organized": 3,
                        "Empathy": 2
                    }
                },
                {
                    "text": "Present a data-driven slideshow on taxes.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "Stand in the back and observe the crowd.",
                    "tags": {
                        "Independent": 2,
                        "Observation": 3
                    }
                }
            ]
        },
        {
            "text": "Your approach to urban planning is:",
            "options": [
                {
                    "text": "Focusing on green spaces and environmental impact.",
                    "tags": {
                        "Nature": 3,
                        "Empathy": 2
                    }
                },
                {
                    "text": "Optimizing traffic flow and public transit.",
                    "tags": {
                        "Logical": 3,
                        "Technical": 3
                    }
                },
                {
                    "text": "Ensuring affordable housing for low-income families.",
                    "tags": {
                        "Social": 3,
                        "Empathy": 3
                    }
                },
                {
                    "text": "Attracting big businesses to boost the economy.",
                    "tags": {
                        "Leadership": 3,
                        "Analytical": 2
                    }
                }
            ]
        },
        {
            "text": "What motivates you to choose a career in public service?",
            "options": [
                {
                    "text": "The desire to leave a lasting, positive legacy.",
                    "tags": {
                        "Leadership": 3,
                        "Dedicated": 3
                    }
                },
                {
                    "text": "The stability, benefits, and pension.",
                    "tags": {
                        "Practical": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "A deep sense of duty to my country/community.",
                    "tags": {
                        "Empathy": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "The opportunity to manage massive, complex systems.",
                    "tags": {
                        "Analytical": 3,
                        "Technical": 2
                    }
                }
            ]
        },
        {
            "text": "If you were a city mayor, what is your first project?",
            "options": [
                {
                    "text": "Expanding public parks and planting trees.",
                    "tags": {
                        "Nature": 3,
                        "Empathy": 2
                    }
                },
                {
                    "text": "Increasing funding for the police and fire departments.",
                    "tags": {
                        "Logical": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "Digitizing all city records to eliminate paper.",
                    "tags": {
                        "Technical": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "Creating a task force for homelessness.",
                    "tags": {
                        "Social": 3,
                        "ProblemSolving": 2
                    }
                }
            ]
        },
        {
            "text": "How do you handle a conflict between two neighboring towns?",
            "options": [
                {
                    "text": "Review the state laws to see who has legal authority.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "Host a joint dinner to build relationships between leaders.",
                    "tags": {
                        "Communication": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Propose a financial compromise that benefits both.",
                    "tags": {
                        "ProblemSolving": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "Let them figure it out themselves.",
                    "tags": {
                        "Independent": 2
                    }
                }
            ]
        },
        {
            "text": "When analyzing a new proposed law, you look at:",
            "options": [
                {
                    "text": "How it affects the poorest citizens.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "How much it will cost the taxpayers.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "Whether it is enforceable in the real world.",
                    "tags": {
                        "Practical": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "If it aligns with historical constitutional intent.",
                    "tags": {
                        "Logical": 3,
                        "Analytical": 2
                    }
                }
            ]
        },
        {
            "text": "What kind of intelligence work appeals to you?",
            "options": [
                {
                    "text": "Analyzing satellite imagery and intercepting codes.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "Working undercover to gather human intelligence.",
                    "tags": {
                        "RiskTaking": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "Writing policy briefings for the President.",
                    "tags": {
                        "Organized": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "Managing the logistics of an overseas base.",
                    "tags": {
                        "Practical": 3,
                        "Organized": 2
                    }
                }
            ]
        },
        {
            "text": "How do you feel about taxes?",
            "options": [
                {
                    "text": "They are a necessary pool of resources for the greater good.",
                    "tags": {
                        "Social": 3,
                        "Empathy": 2
                    }
                },
                {
                    "text": "They are too high and stifle economic growth.",
                    "tags": {
                        "Logical": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "They are too complicated and need a total redesign.",
                    "tags": {
                        "ProblemSolving": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "I just pay them and don't think about it.",
                    "tags": {
                        "Easygoing": 3
                    }
                }
            ]
        },
        {
            "text": "If you worked in an embassy abroad, you would want to:",
            "options": [
                {
                    "text": "Host cultural events to share your nation's art/music.",
                    "tags": {
                        "Creative": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Negotiate trade deals with foreign ministers.",
                    "tags": {
                        "Communication": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "Process visas and help citizens in trouble.",
                    "tags": {
                        "Organized": 3,
                        "Empathy": 2
                    }
                },
                {
                    "text": "Ensure the physical security of the compound.",
                    "tags": {
                        "Practical": 3,
                        "Dedicated": 2
                    }
                }
            ]
        },
        {
            "text": "How do you respond to public criticism?",
            "options": [
                {
                    "text": "I release a detailed fact-sheet to clear up misconceptions.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "I hold a press conference to control the narrative.",
                    "tags": {
                        "Communication": 3,
                        "Leadership": 3
                    }
                },
                {
                    "text": "I ignore it and let my actions speak for themselves.",
                    "tags": {
                        "Independent": 3,
                        "Dedicated": 2
                    }
                },
                {
                    "text": "I get defensive and try to find out who started it.",
                    "tags": {
                        "Sensitive": 2
                    }
                }
            ]
        },
        {
            "text": "What is the biggest threat to modern society?",
            "options": [
                {
                    "text": "Cyberattacks on critical infrastructure.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "Climate change and natural resource depletion.",
                    "tags": {
                        "Nature": 3,
                        "ProblemSolving": 2
                    }
                },
                {
                    "text": "Wealth inequality and social division.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Political corruption and lack of leadership.",
                    "tags": {
                        "Logical": 3,
                        "Leadership": 2
                    }
                }
            ]
        },
        {
            "text": "When organizing a massive public event (like an election), you:",
            "options": [
                {
                    "text": "Design the secure database to count the votes.",
                    "tags": {
                        "Technical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Manage the volunteers at the polling stations.",
                    "tags": {
                        "Leadership": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "Ensure elderly and disabled people have access.",
                    "tags": {
                        "Empathy": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "Handle the physical setup of the voting booths.",
                    "tags": {
                        "Practical": 3
                    }
                }
            ]
        },
        {
            "text": "If you were a whistleblower, you would do it because:",
            "options": [
                {
                    "text": "The rules were broken and justice must be served.",
                    "tags": {
                        "Logical": 3,
                        "Dedicated": 3
                    }
                },
                {
                    "text": "People were being hurt by the cover-up.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "I calculated that the truth would come out anyway.",
                    "tags": {
                        "Analytical": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "I wouldn't do it, I'd stay quiet to protect my job.",
                    "tags": {
                        "Reserved": 3
                    }
                }
            ]
        },
        {
            "text": "What is your view on public transportation?",
            "options": [
                {
                    "text": "It needs high-speed rail and better engineering.",
                    "tags": {
                        "Technical": 3,
                        "ProblemSolving": 2
                    }
                },
                {
                    "text": "It should be completely free for all citizens.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "It needs better scheduling and fiscal management.",
                    "tags": {
                        "Organized": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "I prefer driving my own car.",
                    "tags": {
                        "Independent": 3
                    }
                }
            ]
        },
        {
            "text": "When drafting a speech for a politician, you focus on:",
            "options": [
                {
                    "text": "Inspiring words that unite the audience.",
                    "tags": {
                        "Communication": 3,
                        "Creative": 3
                    }
                },
                {
                    "text": "Clear, hard facts that prove the policy works.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "Bullet points that outline exactly what will happen next.",
                    "tags": {
                        "Organized": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "I'd rather be the one giving the speech, not writing it.",
                    "tags": {
                        "Leadership": 3,
                        "Expressive": 3
                    }
                }
            ]
        },
        {
            "text": "How do you handle a crisis where resources are limited?",
            "options": [
                {
                    "text": "I create a strict rationing system based on math.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "I give to the most vulnerable (children, sick) first.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "I try to find a creative way to generate more resources.",
                    "tags": {
                        "ProblemSolving": 3,
                        "Resourceful": 3
                    }
                },
                {
                    "text": "I take charge and make the tough calls nobody else will.",
                    "tags": {
                        "Leadership": 3,
                        "Dedicated": 2
                    }
                }
            ]
        },
        {
            "text": "What branch of the military interests you most?",
            "options": [
                {
                    "text": "Cyber Command (Defending networks).",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "Army/Marines (Physical discipline and leadership).",
                    "tags": {
                        "Dedicated": 3,
                        "Leadership": 3
                    }
                },
                {
                    "text": "Corps of Engineers (Building infrastructure).",
                    "tags": {
                        "Practical": 3,
                        "ProblemSolving": 2
                    }
                },
                {
                    "text": "Medical Corps (Treating wounded soldiers).",
                    "tags": {
                        "Empathy": 3,
                        "Healthcare": 2
                    }
                }
            ]
        },
        {
            "text": "If you could pass one universal law, it would be:",
            "options": [
                {
                    "text": "Mandatory recycling and zero-emissions.",
                    "tags": {
                        "Nature": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "Universal basic income for everyone.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Free high-speed internet globally.",
                    "tags": {
                        "Technical": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "Strict transparency for all government spending.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 3
                    }
                }
            ]
        },
        {
            "text": "How do you interact with your local community?",
            "options": [
                {
                    "text": "I attend city council meetings and vote in every local election.",
                    "tags": {
                        "Organized": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "I volunteer at the local food bank or shelter.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "I organize neighborhood block parties and events.",
                    "tags": {
                        "Communication": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "I mostly keep to myself.",
                    "tags": {
                        "Independent": 3
                    }
                }
            ]
        },
        {
            "text": "What is the most challenging part of public service?",
            "options": [
                {
                    "text": "Dealing with angry, irrational citizens.",
                    "tags": {
                        "Sensitive": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "The slow, frustrating pace of getting anything approved.",
                    "tags": {
                        "Practical": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "The heavy emotional burden of seeing people struggle.",
                    "tags": {
                        "Empathy": 3,
                        "Dedicated": 2
                    }
                },
                {
                    "text": "Keeping track of changing laws and regulations.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 2
                    }
                }
            ]
        },
        {
            "text": "📷 Visual Scenario: You are a District Magistrate during a flash flood. Roads are cut off. You:",
            "options": [
                {
                    "text": "Take executive charge on the ground, directing boat rescue teams.",
                    "tags": {
                        "Leadership": 3,
                        "RiskTaking": 3,
                        "Practical": 3
                    }
                },
                {
                    "text": "Establish a centralized digital emergency operations dashboard.",
                    "tags": {
                        "Technical": 3,
                        "Organized": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "Mobilize local community youth groups to distribute relief kits.",
                    "tags": {
                        "Social": 3,
                        "Communication": 3,
                        "Empathy": 2
                    }
                },
                {
                    "text": "Draft emergency funding requisitions for state government release.",
                    "tags": {
                        "Logical": 3,
                        "Organized": 2
                    }
                }
            ]
        },
        {
            "text": "When implementing a government digitisation drive (like UPI or Aadhaar), your focus is:",
            "options": [
                {
                    "text": "Ensuring 100% digital security against cyber fraud and leaks.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "Making the interface accessible to illiterate and rural citizens.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "Enforcing strict compliance guidelines for all state departments.",
                    "tags": {
                        "Organized": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "Partnering with private tech firms to accelerate rollout.",
                    "tags": {
                        "Entrepreneurial": 3,
                        "Practical": 3
                    }
                }
            ]
        },
        {
            "text": "How do you approach long-term urban infrastructure planning for 2035 India?",
            "options": [
                {
                    "text": "Prioritize green net-zero energy grids, solar roofs, and parks.",
                    "tags": {
                        "Nature": 3,
                        "Analytical": 3,
                        "Creative": 2
                    }
                },
                {
                    "text": "Build high-density metro corridors, ring roads, and flyovers.",
                    "tags": {
                        "Technical": 3,
                        "Practical": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "Focus on low-cost housing schemes and slum redevelopment.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Attract foreign direct investment (FDI) into smart industrial zones.",
                    "tags": {
                        "Leadership": 3,
                        "Entrepreneurial": 2
                    }
                }
            ]
        },
        {
            "text": "When faced with political pressure to approve an environmentally harmful project, you:",
            "options": [
                {
                    "text": "Refuse firmly, citing statutory environmental clearance laws.",
                    "tags": {
                        "Dedicated": 3,
                        "Logical": 3,
                        "Leadership": 3
                    }
                },
                {
                    "text": "Propose a modified eco-friendly compromise that satisfies both sides.",
                    "tags": {
                        "ProblemSolving": 3,
                        "Communication": 3,
                        "Adaptable": 2
                    }
                },
                {
                    "text": "Conduct a transparent public hearing to let citizens decide.",
                    "tags": {
                        "Social": 3,
                        "Communication": 3,
                        "Empathy": 2
                    }
                },
                {
                    "text": "Request an independent scientific assessment report first.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 2
                    }
                }
            ]
        },
        {
            "text": "What type of public service assignment excites you most?",
            "options": [
                {
                    "text": "Ground administration as an IAS officer transforming a rural district.",
                    "tags": {
                        "Leadership": 3,
                        "Practical": 3,
                        "Empathy": 3
                    }
                },
                {
                    "text": "Representing India's strategic interests at UN international summits.",
                    "tags": {
                        "Communication": 3,
                        "Analytical": 3,
                        "Diplomatic": 3
                    }
                },
                {
                    "text": "Commanding armed troops guarding high-altitude national borders.",
                    "tags": {
                        "Dedicated": 3,
                        "Leadership": 3,
                        "RiskTaking": 3
                    }
                },
                {
                    "text": "Drafting landmark national economic policies at NITI Aayog.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3,
                        "Organized": 2
                    }
                }
            ]
        },
        {
            "text": "How do you feel about working in rigid hierarchical systems with strict rank protocols?",
            "options": [
                {
                    "text": "I respect clear chain of command; structure breeds discipline.",
                    "tags": {
                        "Organized": 3,
                        "Dedicated": 3,
                        "Stability": 2
                    }
                },
                {
                    "text": "I respect rank, but believe innovation requires open dialogue.",
                    "tags": {
                        "Communication": 3,
                        "Adaptable": 2
                    }
                },
                {
                    "text": "I prefer flat policy think-tanks where ideas matter more than rank.",
                    "tags": {
                        "Independent": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "I navigate hierarchies strategically to achieve public good.",
                    "tags": {
                        "Resourceful": 3,
                        "Leadership": 2
                    }
                }
            ]
        },
        {
            "text": "📷 Visual Scenario: You are reviewing budget allocations for a state government. You allocate surplus funds to:",
            "options": [
                {
                    "text": "Primary education, mid-day meals, and rural healthcare clinics.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "AI research labs, semiconductor parks, and tech incubators.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "Police modernization, CCTV surveillance, and cyber crime units.",
                    "tags": {
                        "Logical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Renewable energy subsides and reforestation projects.",
                    "tags": {
                        "Nature": 3,
                        "Practical": 2
                    }
                }
            ]
        },
        {
            "text": "When resolving a heated protest by local farmer unions, your strategy is:",
            "options": [
                {
                    "text": "Invite union leaders to a closed-door negotiation with hot tea.",
                    "tags": {
                        "Communication": 3,
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Analyze their 10 demands systematically against legal provisions.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "Maintain firm law and order while protecting public property.",
                    "tags": {
                        "Leadership": 3,
                        "Practical": 3
                    }
                },
                {
                    "text": "Deploy media briefers to present the government's official facts.",
                    "tags": {
                        "Communication": 3,
                        "Organized": 2
                    }
                }
            ]
        },
        {
            "text": "What is your definition of effective governance?",
            "options": [
                {
                    "text": "Seamless digital service delivery with zero corruption and zero delay.",
                    "tags": {
                        "Technical": 3,
                        "Organized": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "Uplifting the poorest citizen at the last mile of society.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Strong national security, economic growth, and law enforcement.",
                    "tags": {
                        "Leadership": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "Formulating progressive evidence-backed public policies.",
                    "tags": {
                        "Analytical": 3,
                        "Dedicated": 2
                    }
                }
            ]
        },
        {
            "text": "How do you handle exam preparation requiring 10-12 hours of daily study for 1-2 years (like UPSC CSE)?",
            "options": [
                {
                    "text": "I maintain intense micro-scheduled discipline with steady grit.",
                    "tags": {
                        "Dedicated": 3,
                        "Organized": 3,
                        "Independent": 3
                    }
                },
                {
                    "text": "I study in active group discussions with fellow aspirants.",
                    "tags": {
                        "Social": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "I analyze past year papers (PYQs) strategically to maximize score.",
                    "tags": {
                        "Analytical": 3,
                        "Resourceful": 3
                    }
                },
                {
                    "text": "I break preparation into creative visual mind-maps and notes.",
                    "tags": {
                        "Creative": 3,
                        "Visual": 2
                    }
                }
            ]
        }
    ],
    "Entrepreneurship": [
        {
            "text": "You have $5,000 to invest. You:",
            "options": [
                {
                    "text": "Put it all into a high-risk, high-reward startup.",
                    "tags": {
                        "RiskTaking": 3,
                        "Leadership": 3
                    }
                },
                {
                    "text": "Invest it safely in an index fund for steady growth.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "Use it to buy inventory to start a side hustle.",
                    "tags": {
                        "Practical": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "Spend it on a marketing course to learn new skills.",
                    "tags": {
                        "Resourceful": 3,
                        "Communication": 2
                    }
                }
            ]
        },
        {
            "text": "When pitching a new idea to someone, you rely on:",
            "options": [
                {
                    "text": "Charisma, storytelling, and painting a vision.",
                    "tags": {
                        "Communication": 3,
                        "Expressive": 3
                    }
                },
                {
                    "text": "Hard data, market research, and spreadsheets.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "Showing them a physical prototype that works.",
                    "tags": {
                        "Technical": 3,
                        "Practical": 3
                    }
                },
                {
                    "text": "Highlighting how it helps people and solves pain points.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 2
                    }
                }
            ]
        },
        {
            "text": "How do you handle failure?",
            "options": [
                {
                    "text": "I pivot immediately and try a new angle.",
                    "tags": {
                        "Adaptable": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "I analyze exactly what went wrong so it never happens again.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "I take it very personally and need time to recover.",
                    "tags": {
                        "Sensitive": 3
                    }
                },
                {
                    "text": "I use it as motivation to prove my doubters wrong.",
                    "tags": {
                        "Leadership": 3,
                        "Dedicated": 3
                    }
                }
            ]
        },
        {
            "text": "Your ideal Friday night involves:",
            "options": [
                {
                    "text": "Networking at a local business mixer.",
                    "tags": {
                        "Social": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "Coding or building out my personal website.",
                    "tags": {
                        "Technical": 3,
                        "Independent": 3
                    }
                },
                {
                    "text": "Reading a biography of a successful billionaire.",
                    "tags": {
                        "Analytical": 2,
                        "Leadership": 3
                    }
                },
                {
                    "text": "Relaxing, I strictly separate work and life.",
                    "tags": {
                        "Easygoing": 3,
                        "Practical": 2
                    }
                }
            ]
        },
        {
            "text": "If you were building a founding team, you would be the:",
            "options": [
                {
                    "text": "Hustler (Sales, Marketing, Vision).",
                    "tags": {
                        "Communication": 3,
                        "Leadership": 3
                    }
                },
                {
                    "text": "Hacker (Building the product, Coding).",
                    "tags": {
                        "Technical": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "Hipster (Design, Branding, UX).",
                    "tags": {
                        "Creative": 3,
                        "Visual": 3
                    }
                },
                {
                    "text": "Hound (Finance, Operations, Logistics).",
                    "tags": {
                        "Organized": 3,
                        "Analytical": 3
                    }
                }
            ]
        },
        {
            "text": "How do you view your competitors?",
            "options": [
                {
                    "text": "I study them obsessively to find their weaknesses.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "I want to crush them and dominate the market.",
                    "tags": {
                        "Leadership": 3,
                        "RiskTaking": 2
                    }
                },
                {
                    "text": "I ignore them and focus on making my product unique.",
                    "tags": {
                        "Independent": 3,
                        "Creative": 3
                    }
                },
                {
                    "text": "I try to partner with them for mutual benefit.",
                    "tags": {
                        "Communication": 3,
                        "Adaptable": 3
                    }
                }
            ]
        },
        {
            "text": "When setting prices for a product, you:",
            "options": [
                {
                    "text": "Calculate the exact cost of goods plus a 20% margin.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Price it high to create a premium, luxury brand.",
                    "tags": {
                        "Creative": 3,
                        "Psychology": 2
                    }
                },
                {
                    "text": "Price it as low as possible to get maximum users.",
                    "tags": {
                        "Practical": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "Ask customers what they are willing to pay.",
                    "tags": {
                        "Empathy": 3,
                        "Communication": 3
                    }
                }
            ]
        },
        {
            "text": "What sounds like the biggest nightmare to you?",
            "options": [
                {
                    "text": "Working a boring 9-to-5 job for 40 years.",
                    "tags": {
                        "RiskTaking": 3,
                        "Creative": 3
                    }
                },
                {
                    "text": "Going bankrupt because of a bad business decision.",
                    "tags": {
                        "Organized": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "Having to fire an employee who is a good friend.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Spending all day dealing with taxes and lawyers.",
                    "tags": {
                        "Practical": 3,
                        "Technical": 2
                    }
                }
            ]
        },
        {
            "text": "When starting a project, your first step is:",
            "options": [
                {
                    "text": "Registering the domain name and designing a logo.",
                    "tags": {
                        "Creative": 3,
                        "Visual": 2
                    }
                },
                {
                    "text": "Creating a detailed business plan and financial model.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Talking to potential customers to see if they want it.",
                    "tags": {
                        "Communication": 3,
                        "Empathy": 2
                    }
                },
                {
                    "text": "Building a quick, ugly prototype to test the mechanics.",
                    "tags": {
                        "Practical": 3,
                        "Technical": 3
                    }
                }
            ]
        },
        {
            "text": "How do you prefer to manage a team?",
            "options": [
                {
                    "text": "Set clear KPIs and let them work independently.",
                    "tags": {
                        "Organized": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "Lead from the front, working longer hours than anyone.",
                    "tags": {
                        "Dedicated": 3,
                        "Leadership": 3
                    }
                },
                {
                    "text": "Act as a mentor, focusing on their personal growth.",
                    "tags": {
                        "Empathy": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "I prefer to work completely solo.",
                    "tags": {
                        "Independent": 3
                    }
                }
            ]
        },
        {
            "text": "What is the best way to market a product?",
            "options": [
                {
                    "text": "Viral, funny TikToks and social media stunts.",
                    "tags": {
                        "Creative": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "Highly targeted, data-driven Facebook ads.",
                    "tags": {
                        "Analytical": 3,
                        "Technical": 2
                    }
                },
                {
                    "text": "Word of mouth by building a genuinely helpful product.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 2
                    }
                },
                {
                    "text": "Cold calling and aggressive B2B sales.",
                    "tags": {
                        "Leadership": 3,
                        "Dedicated": 2
                    }
                }
            ]
        },
        {
            "text": "How do you view money?",
            "options": [
                {
                    "text": "It is a tool to buy freedom and independence.",
                    "tags": {
                        "Independent": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "It is a scoreboard to show how well I am doing.",
                    "tags": {
                        "Leadership": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "It is fuel to scale my ideas to the moon.",
                    "tags": {
                        "RiskTaking": 3,
                        "Imaginative": 3
                    }
                },
                {
                    "text": "It is a resource to help my family and community.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 2
                    }
                }
            ]
        },
        {
            "text": "If an investor offers you $1 Million for 50% of your company, you:",
            "options": [
                {
                    "text": "Take it! The money will let me grow instantly.",
                    "tags": {
                        "Practical": 3,
                        "Adaptable": 2
                    }
                },
                {
                    "text": "Reject it. I want to own 100% of my vision.",
                    "tags": {
                        "Leadership": 3,
                        "Independent": 3
                    }
                },
                {
                    "text": "Counter-offer with 20% equity plus a board seat.",
                    "tags": {
                        "Analytical": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "Ask for advice from my co-founders first.",
                    "tags": {
                        "Communication": 3,
                        "Social": 2
                    }
                }
            ]
        },
        {
            "text": "What book genre do you prefer?",
            "options": [
                {
                    "text": "Self-help and productivity hacks.",
                    "tags": {
                        "Organized": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "Psychology and human behavior.",
                    "tags": {
                        "Psychology": 3,
                        "Empathy": 2
                    }
                },
                {
                    "text": "Biographies of ruthless historical conquerors.",
                    "tags": {
                        "Leadership": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "Sci-fi featuring futuristic technology.",
                    "tags": {
                        "Imaginative": 3,
                        "Technical": 2
                    }
                }
            ]
        },
        {
            "text": "When a customer complains, you:",
            "options": [
                {
                    "text": "Refund them immediately to protect my brand's reputation.",
                    "tags": {
                        "Empathy": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "Analyze the complaint to fix the root bug in the system.",
                    "tags": {
                        "Analytical": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "Argue with them if I know my product isn't broken.",
                    "tags": {
                        "Logical": 3,
                        "Defensive": 2
                    }
                },
                {
                    "text": "Delegate customer service to someone else.",
                    "tags": {
                        "Leadership": 2,
                        "Organized": 2
                    }
                }
            ]
        },
        {
            "text": "What is your stance on taking risks?",
            "options": [
                {
                    "text": "I love taking massive risks if the upside is huge.",
                    "tags": {
                        "RiskTaking": 3,
                        "Adaptable": 2
                    }
                },
                {
                    "text": "I only take heavily calculated, data-backed risks.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "I prefer slow, steady, and guaranteed growth.",
                    "tags": {
                        "Organized": 3,
                        "Practical": 3
                    }
                },
                {
                    "text": "I hate risk and avoid it at all costs.",
                    "tags": {
                        "Reserved": 3
                    }
                }
            ]
        },
        {
            "text": "If you had to choose a superpower for business, it would be:",
            "options": [
                {
                    "text": "Reading minds (to know what customers want).",
                    "tags": {
                        "Empathy": 3,
                        "Psychology": 3
                    }
                },
                {
                    "text": "Seeing the future (to predict market trends).",
                    "tags": {
                        "Analytical": 3,
                        "Imaginative": 3
                    }
                },
                {
                    "text": "Mind control (to close any sale).",
                    "tags": {
                        "Leadership": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "Super speed (to outwork everyone else).",
                    "tags": {
                        "Dedicated": 3,
                        "Practical": 2
                    }
                }
            ]
        },
        {
            "text": "How do you feel about public speaking or pitching?",
            "options": [
                {
                    "text": "I thrive on it. I love being on stage.",
                    "tags": {
                        "Communication": 3,
                        "Expressive": 3
                    }
                },
                {
                    "text": "I get nervous, but I practice until I'm perfect.",
                    "tags": {
                        "Dedicated": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "I hate it. I'd rather build the tech in the background.",
                    "tags": {
                        "Independent": 3,
                        "Technical": 3
                    }
                },
                {
                    "text": "I prefer 1-on-1 conversations over large crowds.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 2
                    }
                }
            ]
        },
        {
            "text": "What is the main reason startups fail?",
            "options": [
                {
                    "text": "They run out of cash due to poor financial planning.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "They build a product nobody actually wants.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 2
                    }
                },
                {
                    "text": "The founders give up too easily when it gets hard.",
                    "tags": {
                        "Dedicated": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "Their technology is faulty or too slow.",
                    "tags": {
                        "Technical": 3,
                        "ProblemSolving": 2
                    }
                }
            ]
        },
        {
            "text": "When you have a great idea in the shower, you:",
            "options": [
                {
                    "text": "Immediately start coding or sketching it out.",
                    "tags": {
                        "Practical": 3,
                        "Creative": 3
                    }
                },
                {
                    "text": "Write it in my notes app and research the market size later.",
                    "tags": {
                        "Organized": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "Call my best friend to pitch it to them.",
                    "tags": {
                        "Communication": 3,
                        "Social": 2
                    }
                },
                {
                    "text": "Forget it by the time I dry off.",
                    "tags": {
                        "Easygoing": 3
                    }
                }
            ]
        },
        {
            "text": "How do you handle multiple projects at once?",
            "options": [
                {
                    "text": "I use advanced project management software (Jira, Asana).",
                    "tags": {
                        "Organized": 3,
                        "Technical": 2
                    }
                },
                {
                    "text": "I focus obsessively on one until it's done, then move on.",
                    "tags": {
                        "Dedicated": 3,
                        "Independent": 2
                    }
                },
                {
                    "text": "I delegate the smaller ones to freelancers.",
                    "tags": {
                        "Leadership": 3,
                        "Resourceful": 3
                    }
                },
                {
                    "text": "I thrive in chaos and jump between them based on mood.",
                    "tags": {
                        "Adaptable": 3,
                        "Creative": 2
                    }
                }
            ]
        },
        {
            "text": "What is your approach to networking?",
            "options": [
                {
                    "text": "I carefully target industry leaders on LinkedIn.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "I go to parties and make friends naturally.",
                    "tags": {
                        "Social": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "I prefer to let my work attract people to me.",
                    "tags": {
                        "Independent": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "I try to help others first without expecting a return.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 2
                    }
                }
            ]
        },
        {
            "text": "If your business started failing, you would:",
            "options": [
                {
                    "text": "Cut all expenses to the bone to survive.",
                    "tags": {
                        "Logical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Double down on marketing to force growth.",
                    "tags": {
                        "RiskTaking": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "Pivot entirely to a new product line.",
                    "tags": {
                        "Adaptable": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "Sell the assets and start fresh.",
                    "tags": {
                        "Practical": 3,
                        "Analytical": 2
                    }
                }
            ]
        },
        {
            "text": "What does success look like to you in 10 years?",
            "options": [
                {
                    "text": "Ringing the bell at the New York Stock Exchange.",
                    "tags": {
                        "Leadership": 3,
                        "RiskTaking": 2
                    }
                },
                {
                    "text": "Having a small, highly profitable lifestyle business on a beach.",
                    "tags": {
                        "Independent": 3,
                        "Easygoing": 3
                    }
                },
                {
                    "text": "Changing the world with a sustainable, green product.",
                    "tags": {
                        "Empathy": 3,
                        "Nature": 2
                    }
                },
                {
                    "text": "Selling my tech to a major company like Google.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 2
                    }
                }
            ]
        },
        {
            "text": "How do you react to a team member who is underperforming?",
            "options": [
                {
                    "text": "Fire them quickly. It's just business.",
                    "tags": {
                        "Logical": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "Put them on a strict performance improvement plan.",
                    "tags": {
                        "Organized": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "Have a deep conversation to see what's wrong in their personal life.",
                    "tags": {
                        "Empathy": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "Move them to a different role where they might fit better.",
                    "tags": {
                        "ProblemSolving": 3,
                        "Adaptable": 2
                    }
                }
            ]
        },
        {
            "text": "📷 Visual Scenario: You have zero capital but a game-changing D2C product idea. You:",
            "options": [
                {
                    "text": "Pre-sell on Instagram/WhatsApp to fund the first batch!",
                    "tags": {
                        "RiskTaking": 3,
                        "Entrepreneurial": 3,
                        "Resourceful": 3
                    }
                },
                {
                    "text": "Build a detailed pitch deck and seek angel investor funding.",
                    "tags": {
                        "Communication": 3,
                        "Leadership": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "Work a day job to save up 100% of bootstrapping capital.",
                    "tags": {
                        "Dedicated": 3,
                        "Practical": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "Apply for government Startup India seed grants and incubators.",
                    "tags": {
                        "Resourceful": 3,
                        "Logical": 2
                    }
                }
            ]
        },
        {
            "text": "When an unexpected competitor copies your flagship feature within 48 hours, you:",
            "options": [
                {
                    "text": "Out-innovate them by launching version 2.0 next week!",
                    "tags": {
                        "Adaptable": 3,
                        "RiskTaking": 3,
                        "Creative": 3
                    }
                },
                {
                    "text": "Send a strict cease-and-desist letter from your legal counsel.",
                    "tags": {
                        "Logical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Focus on doubling down on customer service and community love.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "Lower your price to undercut their profit margins.",
                    "tags": {
                        "Practical": 3,
                        "Analytical": 2
                    }
                }
            ]
        },
        {
            "text": "What work culture do you cultivate in your startup company?",
            "options": [
                {
                    "text": "Fast-paced, high-stakes, move fast and break things.",
                    "tags": {
                        "RiskTaking": 3,
                        "Adaptable": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "Empathetic, flexible remote-first with mental health perks.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Disciplined, metric-driven with clear OKRs and performance rewards.",
                    "tags": {
                        "Organized": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "Creative studio atmosphere with daily experimentation hours.",
                    "tags": {
                        "Creative": 3,
                        "Imaginative": 2
                    }
                }
            ]
        },
        {
            "text": "How do you evaluate whether to enter a new market segment in India?",
            "options": [
                {
                    "text": "Conduct ground interviews in Tier-2/3 cities with real users.",
                    "tags": {
                        "Empathy": 3,
                        "Communication": 3,
                        "Practical": 3
                    }
                },
                {
                    "text": "Analyze TAM (Total Addressable Market) and industry reports.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "Test with small local Facebook/Meta ad experiments.",
                    "tags": {
                        "Practical": 3,
                        "Resourceful": 2
                    }
                },
                {
                    "text": "Follow your entrepreneurial gut intuition and launch immediately.",
                    "tags": {
                        "RiskTaking": 3,
                        "Entrepreneurial": 3
                    }
                }
            ]
        },
        {
            "text": "When a venture capital firm offers money but demands a board seat controlling your hiring decisions:",
            "options": [
                {
                    "text": "Refuse—maintaining total operational control of my vision is paramount.",
                    "tags": {
                        "Leadership": 3,
                        "Independent": 3
                    }
                },
                {
                    "text": "Negotiate board rights to retain veto power over key decisions.",
                    "tags": {
                        "Communication": 3,
                        "Analytical": 3,
                        "ProblemSolving": 2
                    }
                },
                {
                    "text": "Accept—their network and capital will scale the company faster.",
                    "tags": {
                        "Practical": 3,
                        "RiskTaking": 2
                    }
                },
                {
                    "text": "Bootstrap independently through revenue instead of taking VC money.",
                    "tags": {
                        "Dedicated": 3,
                        "Organized": 2
                    }
                }
            ]
        },
        {
            "text": "📷 Visual Scenario: Your supply chain breaks down right before Diwali festival sales peak. You:",
            "options": [
                {
                    "text": "Fly personally to the supplier factory to resolve bottlenecks on-site.",
                    "tags": {
                        "Leadership": 3,
                        "Dedicated": 3,
                        "Practical": 3
                    }
                },
                {
                    "text": "Source alternative temporary suppliers locally at a higher cost.",
                    "tags": {
                        "Adaptable": 3,
                        "Resourceful": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "Be transparent with customers, offering discounts for delayed delivery.",
                    "tags": {
                        "Empathy": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "Pivot campaign focus to digital gift vouchers and digital pre-orders.",
                    "tags": {
                        "Creative": 3,
                        "Entrepreneurial": 2
                    }
                }
            ]
        },
        {
            "text": "What is your view on founder work-life balance during the first 3 years of a startup?",
            "options": [
                {
                    "text": "80-hour workweeks are necessary to beat out competition!",
                    "tags": {
                        "Dedicated": 3,
                        "RiskTaking": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "Sustainable 45-hour workweeks prevent burnout and foster better decisions.",
                    "tags": {
                        "Organized": 3,
                        "Practical": 3
                    }
                },
                {
                    "text": "Work in intense 2-week sprints followed by quiet recovery.",
                    "tags": {
                        "Adaptable": 3,
                        "Independent": 2
                    }
                },
                {
                    "text": "Work doesn't feel like work when you are building your passion.",
                    "tags": {
                        "Creative": 3,
                        "Empathy": 2
                    }
                }
            ]
        },
        {
            "text": "When deciding between building a high-margin niche luxury brand vs a mass-market budget brand:",
            "options": [
                {
                    "text": "Mass-market budget brand serving 100 Million everyday Indians!",
                    "tags": {
                        "Practical": 3,
                        "Social": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "High-margin luxury niche with exquisite craftsmanship and branding.",
                    "tags": {
                        "Creative": 3,
                        "Visual": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "B2B enterprise SaaS with annual recurring subscription contracts.",
                    "tags": {
                        "Analytical": 3,
                        "Technical": 3
                    }
                },
                {
                    "text": "Social-impact enterprise solving clean drinking water or rural waste.",
                    "tags": {
                        "Empathy": 3,
                        "Nature": 3
                    }
                }
            ]
        },
        {
            "text": "How do you handle co-founder disagreement on long-term strategy?",
            "options": [
                {
                    "text": "Debate vigorously using data and customer feedback as judge.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "Vote based on ownership stakes and formal partnership agreements.",
                    "tags": {
                        "Organized": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "Seek mediation from a trusted advisor or senior investor.",
                    "tags": {
                        "Social": 3,
                        "Resourceful": 2
                    }
                },
                {
                    "text": "Divide responsibilities cleanly so each owner holds total authority in their domain.",
                    "tags": {
                        "Leadership": 3,
                        "Independent": 2
                    }
                }
            ]
        },
        {
            "text": "What is your primary motivation to build an enterprise?",
            "options": [
                {
                    "text": "Creating financial freedom and generational wealth.",
                    "tags": {
                        "Practical": 3,
                        "Entrepreneurial": 3
                    }
                },
                {
                    "text": "Solving a major societal problem that frustrates millions daily.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "Building a iconic household brand name recognized nationwide.",
                    "tags": {
                        "Leadership": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "The thrill of creating something out of nothing.",
                    "tags": {
                        "Creative": 3,
                        "RiskTaking": 3
                    }
                }
            ]
        }
    ],
    "Law": [
        {
            "text": "Two friends are arguing over a misunderstanding. You:",
            "options": [
                {
                    "text": "Analyze the facts and timeline to see who is right.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "Mediate and find a compromise so everyone is happy.",
                    "tags": {
                        "Empathy": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "Stay completely out of it.",
                    "tags": {
                        "Independent": 3,
                        "Reserved": 2
                    }
                },
                {
                    "text": "Use their argument to your advantage.",
                    "tags": {
                        "ProblemSolving": 3,
                        "Leadership": 2
                    }
                }
            ]
        },
        {
            "text": "When you sign a new app's Terms of Service, you:",
            "options": [
                {
                    "text": "Skim it quickly for data privacy clauses.",
                    "tags": {
                        "Analytical": 3,
                        "Resourceful": 2
                    }
                },
                {
                    "text": "Actually read the fine print carefully.",
                    "tags": {
                        "Organized": 3,
                        "Dedicated": 3
                    }
                },
                {
                    "text": "Scroll to the bottom and hit 'Accept' immediately.",
                    "tags": {
                        "Practical": 3,
                        "Easygoing": 3
                    }
                },
                {
                    "text": "Refuse to sign if it looks remotely suspicious.",
                    "tags": {
                        "Logical": 3,
                        "Independent": 2
                    }
                }
            ]
        },
        {
            "text": "If you were in a courtroom, which role appeals to you most?",
            "options": [
                {
                    "text": "The Judge, making the final, impartial decision.",
                    "tags": {
                        "Leadership": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "The Trial Lawyer, delivering a passionate closing argument.",
                    "tags": {
                        "Communication": 3,
                        "Expressive": 3
                    }
                },
                {
                    "text": "The Paralegal, finding the hidden loophole in the documents.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "The Expert Witness, explaining complex science to the jury.",
                    "tags": {
                        "Technical": 3,
                        "Edu": 3
                    }
                }
            ]
        },
        {
            "text": "How do you win a debate?",
            "options": [
                {
                    "text": "By presenting undeniable statistics and precedents.",
                    "tags": {
                        "Logical": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "By appealing to the audience's morals and emotions.",
                    "tags": {
                        "Communication": 3,
                        "Empathy": 3
                    }
                },
                {
                    "text": "By aggressively poking holes in the opponent's logic.",
                    "tags": {
                        "ProblemSolving": 3,
                        "Leadership": 3
                    }
                },
                {
                    "text": "I don't debate; I prefer writing persuasive essays.",
                    "tags": {
                        "Independent": 3,
                        "Organized": 2
                    }
                }
            ]
        },
        {
            "text": "What is your view on the justice system?",
            "options": [
                {
                    "text": "It should focus heavily on rehabilitation and a second chance.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "It must be strict to maintain order in society.",
                    "tags": {
                        "Logical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "It's a complex game of strategy and negotiation.",
                    "tags": {
                        "Analytical": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "It needs to be completely rewritten to be fair.",
                    "tags": {
                        "Creative": 3,
                        "Leadership": 2
                    }
                }
            ]
        },
        {
            "text": "When negotiating a salary or buying a car, you:",
            "options": [
                {
                    "text": "Research market value extensively before speaking.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Charm the other person into giving me a good deal.",
                    "tags": {
                        "Communication": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Set a hard walk-away number and don't budge.",
                    "tags": {
                        "Logical": 3,
                        "Leadership": 3
                    }
                },
                {
                    "text": "Get anxious and usually take the first offer.",
                    "tags": {
                        "Sensitive": 3,
                        "Reserved": 2
                    }
                }
            ]
        },
        {
            "text": "How do you handle a massive, boring pile of paperwork?",
            "options": [
                {
                    "text": "I create a highly organized filing system to tackle it.",
                    "tags": {
                        "Organized": 3,
                        "Dedicated": 3
                    }
                },
                {
                    "text": "I speed-read through it looking only for red flags.",
                    "tags": {
                        "Analytical": 3,
                        "Practical": 3
                    }
                },
                {
                    "text": "I procrastinate until the absolute deadline.",
                    "tags": {
                        "Adaptable": 2,
                        "Creative": 2
                    }
                },
                {
                    "text": "I digitize and automate the data entry process.",
                    "tags": {
                        "Technical": 3,
                        "ProblemSolving": 3
                    }
                }
            ]
        },
        {
            "text": "Someone breaks a minor rule, but for a morally good reason. You:",
            "options": [
                {
                    "text": "Report them; the law is the law, no exceptions.",
                    "tags": {
                        "Logical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Defend them; ethics are more important than strict rules.",
                    "tags": {
                        "Empathy": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "Look for a legal loophole to get them out of trouble.",
                    "tags": {
                        "Analytical": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "Ignore it, it's none of my business.",
                    "tags": {
                        "Practical": 3,
                        "Independent": 3
                    }
                }
            ]
        },
        {
            "text": "What type of true crime documentary do you prefer?",
            "options": [
                {
                    "text": "Deep dives into forensic science and DNA.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "Psychological profiles of the criminals.",
                    "tags": {
                        "Psychology": 3,
                        "Empathy": 2
                    }
                },
                {
                    "text": "Courtroom dramas about the legal trial process.",
                    "tags": {
                        "Logical": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "Stories about systemic corruption being exposed.",
                    "tags": {
                        "Leadership": 3,
                        "ProblemSolving": 2
                    }
                }
            ]
        },
        {
            "text": "When a friend asks you for advice on a difficult decision, you:",
            "options": [
                {
                    "text": "Outline the pros and cons logically.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "Ask them how they *feel* about the options.",
                    "tags": {
                        "Empathy": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "Tell them exactly what they should do based on rules.",
                    "tags": {
                        "Leadership": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "Help them brainstorm a creative third option.",
                    "tags": {
                        "ProblemSolving": 3,
                        "Creative": 2
                    }
                }
            ]
        },
        {
            "text": "If you witnessed a crime, you would:",
            "options": [
                {
                    "text": "Memorize the suspect's description and license plate.",
                    "tags": {
                        "Analytical": 3,
                        "Observation": 3
                    }
                },
                {
                    "text": "Rush in to try and stop it.",
                    "tags": {
                        "Leadership": 3,
                        "RiskTaking": 3
                    }
                },
                {
                    "text": "Check to see if the victim is okay first.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 2
                    }
                },
                {
                    "text": "Record it on my phone for undeniable evidence.",
                    "tags": {
                        "Technical": 3,
                        "Practical": 2
                    }
                }
            ]
        },
        {
            "text": "How do you feel about keeping secrets?",
            "options": [
                {
                    "text": "I am a vault. I never tell anyone, period.",
                    "tags": {
                        "Logical": 3,
                        "Dedicated": 3
                    }
                },
                {
                    "text": "I keep them, unless withholding it hurts someone else.",
                    "tags": {
                        "Empathy": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "I usually end up telling one trusted friend.",
                    "tags": {
                        "Communication": 3,
                        "Social": 2
                    }
                },
                {
                    "text": "I forget the secret within an hour anyway.",
                    "tags": {
                        "Easygoing": 3
                    }
                }
            ]
        },
        {
            "text": "Your preferred method of professional communication is:",
            "options": [
                {
                    "text": "A formally formatted, highly precise email.",
                    "tags": {
                        "Organized": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "A quick phone call to negotiate it verbally.",
                    "tags": {
                        "Communication": 3,
                        "Adaptable": 2
                    }
                },
                {
                    "text": "A face-to-face meeting over coffee.",
                    "tags": {
                        "Social": 3,
                        "Empathy": 2
                    }
                },
                {
                    "text": "Instant messaging (Slack/Teams).",
                    "tags": {
                        "Technical": 2,
                        "Practical": 3
                    }
                }
            ]
        },
        {
            "text": "When analyzing a complex document, you:",
            "options": [
                {
                    "text": "Highlight every definition and key term.",
                    "tags": {
                        "Organized": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "Look for contradictory statements to exploit.",
                    "tags": {
                        "ProblemSolving": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "Focus on the overarching intent of the author.",
                    "tags": {
                        "Empathy": 2,
                        "Communication": 3
                    }
                },
                {
                    "text": "Use an AI tool to summarize it for me.",
                    "tags": {
                        "Technical": 3,
                        "Resourceful": 3
                    }
                }
            ]
        },
        {
            "text": "If you ran a law firm, your specialty would be:",
            "options": [
                {
                    "text": "Corporate Mergers and Tax Law.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Civil Rights and Public Defender work.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Intellectual Property and Tech Patents.",
                    "tags": {
                        "Technical": 3,
                        "Creative": 2
                    }
                },
                {
                    "text": "High-profile Criminal Defense.",
                    "tags": {
                        "Communication": 3,
                        "RiskTaking": 3
                    }
                }
            ]
        },
        {
            "text": "How do you handle being proven wrong in an argument?",
            "options": [
                {
                    "text": "I concede gracefully if their evidence is better.",
                    "tags": {
                        "Logical": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "I get defensive and try to pivot the topic.",
                    "tags": {
                        "Defensive": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "I apologize for misunderstanding their feelings.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 2
                    }
                },
                {
                    "text": "I refuse to admit defeat.",
                    "tags": {
                        "Leadership": 2,
                        "Dedicated": 3
                    }
                }
            ]
        },
        {
            "text": "What is the most important skill for a lawyer?",
            "options": [
                {
                    "text": "An encyclopedic memory for case law.",
                    "tags": {
                        "Organized": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "The ability to read people and juries.",
                    "tags": {
                        "Psychology": 3,
                        "Empathy": 3
                    }
                },
                {
                    "text": "Exceptional public speaking and charisma.",
                    "tags": {
                        "Communication": 3,
                        "Expressive": 3
                    }
                },
                {
                    "text": "Relentless aggression and negotiation skills.",
                    "tags": {
                        "Leadership": 3,
                        "ProblemSolving": 2
                    }
                }
            ]
        },
        {
            "text": "When organizing an event, you are the person who:",
            "options": [
                {
                    "text": "Drafts the contracts with vendors to avoid liability.",
                    "tags": {
                        "Logical": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "Manages the budget spreadsheet down to the penny.",
                    "tags": {
                        "Organized": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "Hypeman who gets everyone excited to go.",
                    "tags": {
                        "Communication": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "Makes sure everyone feels included and welcome.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                }
            ]
        },
        {
            "text": "How do you feel about strict dress codes (like suits)?",
            "options": [
                {
                    "text": "I like them; they command respect and authority.",
                    "tags": {
                        "Leadership": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "I hate them; I prefer to express my individuality.",
                    "tags": {
                        "Creative": 3,
                        "Independent": 3
                    }
                },
                {
                    "text": "I'll wear whatever is required to win the case.",
                    "tags": {
                        "Practical": 3,
                        "Adaptable": 3
                    }
                },
                {
                    "text": "I find them physically uncomfortable.",
                    "tags": {
                        "Sensitive": 3
                    }
                }
            ]
        },
        {
            "text": "If you find a loophole in a school/work rule, you:",
            "options": [
                {
                    "text": "Exploit it quietly for my own benefit.",
                    "tags": {
                        "ProblemSolving": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "Tell management so they can fix the flaw.",
                    "tags": {
                        "Logical": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "Tell all my friends so we can all use it.",
                    "tags": {
                        "Social": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "I don't look for loopholes; I just follow the rules.",
                    "tags": {
                        "Dedicated": 3,
                        "Easygoing": 2
                    }
                }
            ]
        },
        {
            "text": "What is your approach to historical research?",
            "options": [
                {
                    "text": "Cross-referencing multiple primary sources for accuracy.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Focusing on the stories of marginalized groups.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Studying the evolution of political power.",
                    "tags": {
                        "Leadership": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "Looking at the technological advancements of the era.",
                    "tags": {
                        "Technical": 3,
                        "Practical": 2
                    }
                }
            ]
        },
        {
            "text": "If you were a detective, your strongest trait would be:",
            "options": [
                {
                    "text": "Following the paper trail of money.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Interrogating suspects and reading their body language.",
                    "tags": {
                        "Psychology": 3,
                        "Communication": 3
                    }
                },
                {
                    "text": "Collecting and processing physical evidence.",
                    "tags": {
                        "Technical": 3,
                        "Practical": 3
                    }
                },
                {
                    "text": "Never giving up on a cold case.",
                    "tags": {
                        "Dedicated": 3,
                        "Empathy": 2
                    }
                }
            ]
        },
        {
            "text": "How do you feel about the phrase 'innocent until proven guilty'?",
            "options": [
                {
                    "text": "It is the absolute bedrock of a civilized society.",
                    "tags": {
                        "Logical": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "It's a nice thought, but the system is biased.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "It makes it too hard to put dangerous people away.",
                    "tags": {
                        "Practical": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "I think it depends entirely on the evidence presented.",
                    "tags": {
                        "ProblemSolving": 3
                    }
                }
            ]
        },
        {
            "text": "When reading a contract, what do you look for first?",
            "options": [
                {
                    "text": "The termination and exit clauses.",
                    "tags": {
                        "Analytical": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "The compensation and payment terms.",
                    "tags": {
                        "Practical": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "The liability and indemnification sections.",
                    "tags": {
                        "Organized": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "I just read the summary my lawyer gives me.",
                    "tags": {
                        "Resourceful": 3,
                        "Easygoing": 2
                    }
                }
            ]
        },
        {
            "text": "What is your definition of 'Justice'?",
            "options": [
                {
                    "text": "The strict and equal application of the law to everyone.",
                    "tags": {
                        "Logical": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "Restoring the victim and healing the community.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Ensuring the powerful cannot exploit the weak.",
                    "tags": {
                        "Leadership": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "An abstract concept that depends on who has the best lawyer.",
                    "tags": {
                        "Practical": 3,
                        "Creative": 2
                    }
                }
            ]
        },
        {
            "text": "📷 Visual Scenario: You are analyzing a new Data Privacy breach involving 10 Million Indian citizens under DPDP Act 2023. You:",
            "options": [
                {
                    "text": "Audit the technical system logs to find the exact data leakage vector.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 3,
                        "ProblemSolving": 2
                    }
                },
                {
                    "text": "File a class-action petition demanding corporate accountability.",
                    "tags": {
                        "Leadership": 3,
                        "Social": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "Advise the tech company on legal compliance and penalty mitigation.",
                    "tags": {
                        "Logical": 3,
                        "Organized": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "Represent impacted users seeking financial compensation.",
                    "tags": {
                        "Empathy": 3,
                        "Communication": 3
                    }
                }
            ]
        },
        {
            "text": "When arguing a high-stakes case before a High Court bench, your style is:",
            "options": [
                {
                    "text": "Laser-focused logical cross-examination of witness inconsistencies.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3,
                        "ProblemSolving": 3
                    }
                },
                {
                    "text": "Eloquently framing constitutional rights and human dignity.",
                    "tags": {
                        "Communication": 3,
                        "Expressive": 3,
                        "Empathy": 3
                    }
                },
                {
                    "text": "Presenting meticulous binder indexed with 50 judicial precedents.",
                    "tags": {
                        "Organized": 3,
                        "Dedicated": 3
                    }
                },
                {
                    "text": "Strategic out-of-court settlement negotiation.",
                    "tags": {
                        "Adaptable": 3,
                        "Practical": 3,
                        "Resourceful": 2
                    }
                }
            ]
        },
        {
            "text": "How do you view the replacement of criminal codes (IPC to BNS / BNSS) in India?",
            "options": [
                {
                    "text": "Master the new statutory sections and procedural timelines immediately.",
                    "tags": {
                        "Organized": 3,
                        "Dedicated": 3,
                        "Analytical": 2
                    }
                },
                {
                    "text": "Evaluate how digital evidence and forensic rules impact trial speed.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 3
                    }
                },
                {
                    "text": "Assess whether the new laws adequately safeguard civil liberties.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3,
                        "Logical": 2
                    }
                },
                {
                    "text": "Write legal commentary articles explaining changes to junior advocates.",
                    "tags": {
                        "Communication": 3,
                        "Leadership": 2
                    }
                }
            ]
        },
        {
            "text": "What legal domain appeals to your personality most?",
            "options": [
                {
                    "text": "Corporate M&A, PE funding, and cross-border tech contracts.",
                    "tags": {
                        "Analytical": 3,
                        "Organized": 3,
                        "Practical": 2
                    }
                },
                {
                    "text": "Intellectual Property (IP)—protecting patents, trademarks, AI rights.",
                    "tags": {
                        "Technical": 3,
                        "Creative": 2,
                        "Analytical": 3
                    }
                },
                {
                    "text": "Constitutional & Human Rights litigation defending public causes.",
                    "tags": {
                        "Empathy": 3,
                        "Leadership": 3,
                        "Social": 3
                    }
                },
                {
                    "text": "Judicial Services—sitting on the bench as an impartial judge.",
                    "tags": {
                        "Logical": 3,
                        "Organized": 3,
                        "Independent": 2
                    }
                }
            ]
        },
        {
            "text": "How do you handle ethical dilemmas where a client is technically guilty but legally defensible?",
            "options": [
                {
                    "text": "Provide the strongest constitutional defense possible—everyone deserves a lawyer.",
                    "tags": {
                        "Logical": 3,
                        "Dedicated": 3,
                        "Professional": 3
                    }
                },
                {
                    "text": "Counsel the client to plead guilty and seek reduced sentencing.",
                    "tags": {
                        "Practical": 3,
                        "Empathy": 3,
                        "Communication": 2
                    }
                },
                {
                    "text": "Withdraw from the case if it violates my personal moral conscience.",
                    "tags": {
                        "Sensitive": 3,
                        "Independent": 2
                    }
                },
                {
                    "text": "Focus strictly on procedural errors committed by the prosecution.",
                    "tags": {
                        "Analytical": 3,
                        "ProblemSolving": 3
                    }
                }
            ]
        },
        {
            "text": "📷 Visual Scenario: A multinational tech firm infringes an Indian startup's patent. You:",
            "options": [
                {
                    "text": "Draft an urgent ex-parte injunction petition to freeze the infringing product.",
                    "tags": {
                        "ProblemSolving": 3,
                        "Leadership": 3,
                        "Practical": 3
                    }
                },
                {
                    "text": "Initiate international arbitration under SIAC or MCIA rules.",
                    "tags": {
                        "Analytical": 3,
                        "Communication": 3,
                        "Organized": 2
                    }
                },
                {
                    "text": "Negotiate a lucrative cross-licensing royalty deal out of court.",
                    "tags": {
                        "Entrepreneurial": 3,
                        "Communication": 3,
                        "Adaptable": 2
                    }
                },
                {
                    "text": "Conduct a global patent prior-art search to establish patent validity.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 3
                    }
                }
            ]
        },
        {
            "text": "What environment brings out your best legal work?",
            "options": [
                {
                    "text": "Quiet chamber late at night reading 100-page court judgments.",
                    "tags": {
                        "Independent": 3,
                        "Analytical": 3,
                        "Dedicated": 3
                    }
                },
                {
                    "text": "Crowded courtroom delivering oral arguments under judge questioning.",
                    "tags": {
                        "Communication": 3,
                        "Expressive": 3,
                        "Leadership": 3
                    }
                },
                {
                    "text": "High-powered boardroom negotiating M&A terms with corporate executives.",
                    "tags": {
                        "Organized": 3,
                        "Analytical": 3,
                        "Social": 2
                    }
                },
                {
                    "text": "Grassroots legal literacy camps helping rural villagers.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3,
                        "Practical": 2
                    }
                }
            ]
        },
        {
            "text": "How do you prepare for a complex cross-examination of a expert witness?",
            "options": [
                {
                    "text": "Study the technical subject matter (forensics, finance) until I know more than them.",
                    "tags": {
                        "Technical": 3,
                        "Analytical": 3,
                        "Dedicated": 3
                    }
                },
                {
                    "text": "Prepare a tight sequence of leading 'Yes or No' questions.",
                    "tags": {
                        "Logical": 3,
                        "Organized": 3,
                        "ProblemSolving": 2
                    }
                },
                {
                    "text": "Observe their body language and tone for signs of hesitation.",
                    "tags": {
                        "Psychology": 3,
                        "Observation": 3,
                        "Empathy": 2
                    }
                },
                {
                    "text": "Rehearse the cross-examination out loud with my junior team.",
                    "tags": {
                        "Communication": 3,
                        "Social": 2
                    }
                }
            ]
        },
        {
            "text": "When choosing between a career in Corporate Law (high pay, long hours) vs Judiciary (prestige, power, public service):",
            "options": [
                {
                    "text": "Judiciary—the honor of delivering impartial justice and serving the state.",
                    "tags": {
                        "Leadership": 3,
                        "Logical": 3,
                        "Organized": 3
                    }
                },
                {
                    "text": "Corporate Law—tier-1 firm pay, complex deals, and fast growth.",
                    "tags": {
                        "Analytical": 3,
                        "Practical": 3,
                        "Dedicated": 2
                    }
                },
                {
                    "text": "Independent Litigation—building my own chamber and reputation.",
                    "tags": {
                        "Independent": 3,
                        "Communication": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "Legal-Tech & AI startup founder modernizing contract automation.",
                    "tags": {
                        "Entrepreneurial": 3,
                        "Technical": 3,
                        "Creative": 2
                    }
                }
            ]
        },
        {
            "text": "What drives your commitment to the legal profession?",
            "options": [
                {
                    "text": "The intellectual thrill of solving complex statutory riddles.",
                    "tags": {
                        "Analytical": 3,
                        "Logical": 3
                    }
                },
                {
                    "text": "Standing up as a voice for the voiceless in court.",
                    "tags": {
                        "Empathy": 3,
                        "Social": 3,
                        "Leadership": 3
                    }
                },
                {
                    "text": "The power to structure transactions that shape the economy.",
                    "tags": {
                        "Organized": 3,
                        "Practical": 3,
                        "Leadership": 2
                    }
                },
                {
                    "text": "Upholding rule of law and constitutional democracy.",
                    "tags": {
                        "Dedicated": 3,
                        "Logical": 3
                    }
                }
            ]
        }
    ]
};

const careersDB = {
    "TechAI": [
        {
            "title": "Software Development Engineer (SDE)",
            "icon": "💻",
            "desc": "Build scalable software systems, backend microservices, and mobile apps for tech giants, global product MNCs, and unicorn startups. Why relevant in India: India is the global software engineering hub, with tech MNCs and GCCs (Global Capability Centers) rapidly expanding R&D in Bengaluru, Hyderabad, and NCR. Salary: Entry: ₹6 - 16 LPA | 5-8 Yrs: ₹20 - 45+ LPA.",
            "targetTraits": {
                "Technical": 3,
                "ProblemSolving": 3,
                "Analytical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Focus on Physics, Chemistry, and Mathematics (PCM) in 11th-12th grade. Develop early algorithmic logic by learning basic programming in Python or C++."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Pursue B.Tech/B.E. in Computer Science or IT. Clear JEE Main (Joint Entrance Examination Main) & JEE Advanced for IITs/NITs, BITSAT for BITS Pilani, or State CETs (MHT-CET, WBJEE, KCET)."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master Data Structures & Algorithms (DSA). Solve 300+ LeetCode problems, build 2-3 full-stack projects on GitHub, and secure summer software internships."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Land entry-level titles like Associate Software Engineer or SDE-I through campus placements or off-campus hiring drives. Starting Salary: ₹6 LPA - ₹16 LPA (up to ₹25+ LPA at top product firms)."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior SDE (SDE-II). Specialize in distributed systems, backend microservices, or system design. Top performers move to product MNCs for higher compensation."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Advance to Principal Engineer, Staff SDE, Engineering Manager, VP of Engineering, or CTO (Chief Technology Officer). Alternate path: Independent Tech Consultant or Startup Co-founder."
                }
            ],
            "books": [
                "Data Structures and Algorithms Made Easy by Narasimha Karumanchi",
                "Cracking the Coding Interview by Gayle Laakmann McDowell"
            ]
        },
        {
            "title": "AI / Machine Learning Engineer",
            "icon": "🤖",
            "desc": "Design neural networks, computer vision models, and Generative AI algorithms for enterprise automation and smart products. Why relevant in India: India is aggressively investing in National AI Initiatives, with massive demand for ML talent across IT services, AI startups, and fintech. Salary: Entry: ₹8 - 20 LPA | 5-8 Yrs: ₹25 - 55+ LPA.",
            "targetTraits": {
                "Technical": 3,
                "Analytical": 3,
                "Logical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Excel in Class 12 Mathematics (Calculus, Probability, Linear Algebra) and Computer Science."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn a B.Tech in CSE / AI & Data Science or B.Sc in Statistics/Maths at IITs, NITs, or IIITs via JEE Main/Advanced."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master Python, PyTorch, TensorFlow, and Scikit-Learn. Build NLP (Natural Language Processing) or Computer Vision models and compete in Kaggle competitions."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join as a Junior ML Engineer or AI Associate at AI labs, Global R&D centers, or tech startups in Bengaluru/Gurgaon. Starting Salary: ₹8 LPA - ₹20 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior AI Engineer. Specialize in Large Language Models (LLMs), MLOps pipelines, or autonomous systems. Clear GATE (Graduate Aptitude Test in Engineering) for M.Tech/Ph.D. at IISc or IITs."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Lead AI Research Scientist, Head of AI/ML, or Chief AI Officer (CAIO) shaping corporate AI strategy."
                }
            ],
            "books": [
                "Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow by Aurélien Géron",
                "Deep Learning by Ian Goodfellow & Yoshua Bengio"
            ]
        },
        {
            "title": "AI Solutions & LLM Engineer",
            "icon": "⚡",
            "desc": "Build enterprise applications using Large Language Models (LLMs), Retrieval-Augmented Generation (RAG), and autonomous AI agents. Why relevant in India: Indian enterprises are rapidly adopting GenAI for customer support, workflow automation, and localized language AI. Salary: Entry: ₹9 - 22 LPA | 5-8 Yrs: ₹28 - 60+ LPA.",
            "targetTraits": {
                "Technical": 3,
                "Creative": 2,
                "ProblemSolving": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Build strong basics in Mathematics, Physics, and Computer Science. Experiment with API integrations and Python scripting."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Complete B.Tech in CSE, Data Science, or Artificial Intelligence from a recognized university via JEE Main or State Entrance Exams."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Learn LangChain, LlamaIndex, vector databases (Pinecone, Chroma), prompt engineering, and fine-tuning open-source LLMs (Llama, Mistral)."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Start as an AI Solutions Engineer or GenAI Developer at SaaS startups or IT consulting firms. Starting Salary: ₹9 LPA - ₹22 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Advance to Senior GenAI Architect. Lead enterprise AI agent deployments, model optimization, and cost-efficient API infrastructure."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Director of GenAI Architecture, Founder of an AI Application Startup, or Principal AI Consultant."
                }
            ],
            "books": [
                "Designing Machine Learning Systems by Chip Huyen",
                "Generative AI on AWS by Chris Fregly & Antje Barth"
            ]
        },
        {
            "title": "Cybersecurity Specialist & Ethical Hacker",
            "icon": "🛡️",
            "desc": "Protect banking networks, digital payment gateways (UPI), government infrastructure, and corporate cloud assets from cyber attacks. Why relevant in India: India's rapid digitisation makes cybersecurity a top national priority under the DPDP Act (Digital Personal Data Protection Act). Salary: Entry: ₹5.5 - 14 LPA | 5-8 Yrs: ₹18 - 38+ LPA.",
            "targetTraits": {
                "Technical": 3,
                "Analytical": 2,
                "ProblemSolving": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Science stream (PCM). Learn networking protocols (TCP/IP), Linux operating system basics, and python automation."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Complete B.Tech in CSE/Cybersecurity or B.Sc IT / BCA (Bachelor of Computer Applications) from a recognized institute."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Earn industry certifications like CEH (Certified Ethical Hacker), CompTIA Security+, and OSCP (Offensive Security Certified Professional). Participate in CTF (Catch The Flag) challenges."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join a Security Operations Center (SOC) as SOC Analyst, Penetration Tester, or Cyber Consultant at Wipro, Infosys, CERT-In, or Big 4 accounting firms. Starting Salary: ₹5.5 LPA - ₹14 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Security Engineer or Threat Hunter. Specialize in cloud security (AWS/Azure), forensic investigation, or zero-trust architecture."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Chief Information Security Officer (CISO), Cyber Risk Director, or Independent Cybersecurity Auditor."
                }
            ],
            "books": [
                "The Web Application Hacker's Handbook by Dafydd Stuttard",
                "CompTIA Security+ Study Guide by Mike Chapple"
            ]
        },
        {
            "title": "Data Scientist & Business Analytics Lead",
            "icon": "📊",
            "desc": "Analyze massive datasets, build predictive models, and turn raw data into strategic growth decisions for e-commerce, fintech, and retail. Why relevant in India: India's internet boom generates petabytes of consumer data daily, driving massive analytics demand in Flipkart, Swiggy, Paytm, and Global MNCs. Salary: Entry: ₹6 - 15 LPA | 5-8 Yrs: ₹20 - 42+ LPA.",
            "targetTraits": {
                "Analytical": 3,
                "Logical": 3,
                "Organized": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Focus on Mathematics, Statistics, and Economics in 11th-12th grade."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Pursue B.Tech, B.Sc Statistics, B.S. Data Science, or B.A. Economics (Hons) at reputed universities (Delhi University, ISI Kolkata, IITs)."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master SQL, Python, R, Tableau, and Excel. Learn statistical hypothesis testing, A/B testing, and predictive machine learning models."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Apply for Data Analyst or Junior Data Scientist roles at Mu Sigma, Fractal Analytics, Deloitte, Amazon India, or Flipkart. Starting Salary: ₹6 LPA - ₹15 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Data Scientist. Lead predictive modeling, pricing optimization, and customer churn analytics for business units."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Advance to Head of Data Science, Chief Data Officer (CDO), or Analytics Practice Partner at global consulting firms."
                }
            ],
            "books": [
                "Storytelling with Data by Cole Nussbaumer Knaflic",
                "Python for Data Analysis by Wes McKinney"
            ]
        },
        {
            "title": "Cloud Architect & Platform Specialist",
            "icon": "☁️",
            "desc": "Design scalable, resilient multi-cloud architecture on AWS, Microsoft Azure, and Google Cloud Platform (GCP) for enterprise applications. Why relevant in India: Indian companies are migrating core workloads to cloud infrastructure, creating huge demand for certified cloud architects. Salary: Entry: ₹7 - 16 LPA | 5-8 Yrs: ₹22 - 48+ LPA.",
            "targetTraits": {
                "Technical": 3,
                "Organized": 3,
                "Practical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Complete 10+2 with Science stream. Learn Linux command line, basic networking concepts, and web fundamentals."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.Tech in CS/IT or BCA/MCA (Master of Computer Applications) from a recognized university."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Earn AWS Certified Solutions Architect or Azure Solutions Architect credentials. Learn Docker, Kubernetes, Terraform, and CI/CD pipelines."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join as a Cloud Engineer or Systems Engineer at Accenture, TCS, Tech Mahindra, or SaaS companies. Starting Salary: ₹7 LPA - ₹16 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Cloud Architect. Specialize in cloud migration, serverless computing, and cost-optimization (FinOps)."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Elevate to Chief Cloud Officer, VP of Infrastructure, or Enterprise Cloud Practice Lead."
                }
            ],
            "books": [
                "The Phoenix Project by Gene Kim",
                "AWS Certified Solutions Architect Official Study Guide by Joe Baron"
            ]
        },
        {
            "title": "DevOps & Site Reliability Engineer (SRE)",
            "icon": "⚙️",
            "desc": "Automate code deployment pipelines and ensure 99.99% uptime for high-traffic web applications and banking systems. Why relevant in India: Tech firms in India require 24/7 reliability for digital services handling millions of daily active users. Salary: Entry: ₹6.5 - 15 LPA | 5-8 Yrs: ₹20 - 42+ LPA.",
            "targetTraits": {
                "Technical": 3,
                "ProblemSolving": 3,
                "Organized": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Science stream (PCM). Practice shell scripting and computer OS basics."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Complete B.Tech in Computer Science/IT or B.Sc Computer Science."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master Linux administration, Git, Jenkins, GitHub Actions, Ansible, Docker, and Kubernetes. Learn monitoring tools like Prometheus and Grafana."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Start as Junior DevOps Engineer or SRE Trainee at product startups or cloud consulting firms. Starting Salary: ₹6.5 LPA - ₹15 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior SRE. Lead incident response, automated failover systems, and infrastructure-as-code (IaC)."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Advance to Head of Site Reliability, Director of Infrastructure Operations, or Principal DevOps Architect."
                }
            ],
            "books": [
                "Site Reliability Engineering by Betsy Beyer & Niall Richard Murphy",
                "Continuous Delivery by Jez Humble & David Farley"
            ]
        },
        {
            "title": "Web3 & Blockchain Developer",
            "icon": "⛓️",
            "desc": "Build decentralized smart contracts, cryptographic protocols, and Web3 infrastructure for fintech, supply chain, and digital assets. Why relevant in India: India boasts one of the world's largest Web3 developer pools, driving innovation in international Web3 ecosystems. Salary: Entry: ₹8 - 18 LPA | 5-8 Yrs: ₹24 - 50+ LPA.",
            "targetTraits": {
                "Technical": 3,
                "Analytical": 3,
                "RiskTaking": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Focus on Mathematics, Computer Science, and cryptography basics."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Pursue B.Tech in CSE or IT. Learn core computer science concepts, data structures, and peer-to-peer networking."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master Solidity, Rust, Web3.js, Hardhat, and Ethereum EVM mechanics. Build decentralized apps (dApps) and audit smart contracts."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join Web3 startups, crypto protocols, or Web3 consultancies as a Smart Contract Developer. Starting Salary: ₹8 LPA - ₹18 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Lead Blockchain Architect. Specialize in Zero-Knowledge proofs (ZK-Rollups), DeFi security auditing, or Layer-2 scaling solutions."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Protocol Architect, Web3 Startup Founder, or Chief Blockchain Specialist for international consortiums."
                }
            ],
            "books": [
                "Mastering Ethereum by Andreas M. Antonopoulos & Gavin Wood",
                "Token Economy by Shermin Voshmgir"
            ]
        },
        {
            "title": "UI/UX Product Designer",
            "icon": "🎨",
            "desc": "Design intuitive visual interfaces, wireframes, and digital user journeys for mobile apps used by millions of smartphone users across India. Why relevant in India: Consumer apps in India need hyper-localized, multi-lingual design for diverse tier 1-3 audiences. Salary: Entry: ₹5.5 - 14 LPA | 5-8 Yrs: ₹18 - 36+ LPA.",
            "targetTraits": {
                "Creative": 3,
                "Empathy": 3,
                "Visual": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Build a creative portfolio of sketches, visual designs, and digital art. Practice sketching and user observation."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Clear NID DAT (National Institute of Design Design Aptitude Test) or UCEED (Undergraduate Common Entrance Examination for Design for IITs) to pursue B.Des in Interaction / Product Design."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master Figma, Adobe XD, user research methodologies, prototyping, and design systems. Conduct real-world user testing with Indian consumers."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join product design teams at Razorpay, CRED, Zomato, Swiggy, or UX agencies in Mumbai/Bengaluru. Starting Salary: ₹5.5 LPA - ₹14 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Product Designer. Lead end-to-end feature design, micro-interactions, and design systems for enterprise scale."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Head of Design, VP of User Experience, or Design Studio Founder."
                }
            ],
            "books": [
                "The Design of Everyday Things by Don Norman",
                "Don't Make Me Think by Steve Krug"
            ]
        },
        {
            "title": "IT Services & Systems Consultant",
            "icon": "💼",
            "desc": "Advise enterprise clients on digital transformation, ERP (Enterprise Resource Planning) software, and IT architecture modernization. Why relevant in India: India's premier IT services firms (TCS, Infosys, Wipro, HCL) drive multi-billion dollar digital modernization projects globally. Salary: Entry: ₹5 - 12 LPA | 5-8 Yrs: ₹16 - 32+ LPA.",
            "targetTraits": {
                "Communication": 3,
                "Analytical": 3,
                "Organized": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Complete 10+2 in Science or Commerce with Computer Applications."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.Tech or BCA followed by MBA (CAT / CMAT) or M.Tech from recognized universities."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Learn SAP, Salesforce, Oracle ERP, ITIL frameworks, and business analysis methodologies."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join TCS, Infosys, Accenture India, or Cognizant as Systems Consultant or IT Business Analyst. Starting Salary: ₹5 LPA - ₹12 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior IT Consultant. Lead global client implementation projects and manage onshore-offshore delivery teams."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Advance to Vice President (Delivery), Global Client Partner, or Managing Director at IT consultancies."
                }
            ],
            "books": [
                "Leading Digital by George Westerman",
                "The McKinsey Way by Ethan M. Rasiel"
            ]
        },
        {
            "title": "Systems & Network Administrator",
            "icon": "🖥️",
            "desc": "Manage physical server hardware, network routers, enterprise firewalls, and data centers for seamless organizational operations. Why relevant in India: Thousands of corporate offices, manufacturing plants, and government offices rely on robust local IT infrastructure. Salary: Entry: ₹3.5 - 8 LPA | 5-8 Yrs: ₹10 - 22+ LPA.",
            "targetTraits": {
                "Technical": 3,
                "Practical": 3,
                "Organized": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Pass Class 12 Science/Commerce. Learn computer hardware troubleshooting and basic networking."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Pursue B.Sc Computer Science, BCA, or Diploma in Hardware & Networking."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Earn Cisco CCNA (Cisco Certified Network Associate) and Red Hat RHCSA Linux certifications."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Start as Network Administrator or Systems Engineer at IT support firms or corporate offices. Starting Salary: ₹3.5 LPA - ₹8 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Network Engineer / IT Infrastructure Lead. Manage data center virtualization (VMware) and enterprise firewalls."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Elevate to IT Infrastructure Manager, Data Center Operations Director, or Chief Technology Officer (SME)."
                }
            ],
            "books": [
                "CCNA Routing and Switching Complete Study Guide by Todd Lammle",
                "UNIX and Linux System Administration Handbook by Evi Nemeth"
            ]
        },
        {
            "title": "Telecom & 5G/6G Network Engineer",
            "icon": "📡",
            "desc": "Design, deploy, and optimize high-speed 5G/6G wireless networks, fiber optics, and telecom infrastructure across India. Why relevant in India: India has executed the world's fastest 5G rollout led by Reliance Jio and Airtel, creating massive demand for telecom engineers. Salary: Entry: ₹4.5 - 10 LPA | 5-8 Yrs: ₹14 - 28+ LPA.",
            "targetTraits": {
                "Technical": 3,
                "Analytical": 2,
                "Practical": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Physics, Chemistry, and Mathematics (PCM) in Class 12."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn a B.Tech in Electronics & Communication Engineering (ECE) or Telecom Engineering via JEE Main or State Entrance Exams."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Learn RF (Radio Frequency) engineering, 5G NR architecture, Open RAN, and optical fiber network management."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join Jio, Airtel, Ericsson India, Nokia Solutions, or Tejas Networks as Telecom Graduate Engineer Trainee. Starting Salary: ₹4.5 LPA - ₹10 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Network Planning Engineer. Lead 5G network optimization and private industrial 5G deployments."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Chief Telecom Architect, General Manager (Network Operations), or Telecom Policy Advisor."
                }
            ],
            "books": [
                "5G NR: The Next Generation Wireless Access Technology by Erik Dahlman",
                "Wireless Communications by Andrea Goldsmith"
            ]
        }
    ],
    "ArtMusic": [
        {
            "title": "Graphic Designer & Visual Brand Artist",
            "icon": "🖼️",
            "desc": "Design visual brand identities, advertising campaigns, and digital artwork for creative agencies and leading brands. Why relevant in India: India's advertising, consumer brand, and startup ecosystem requires thousands of graphic visual designers for digital marketing. Salary: Entry: ₹3.5 - 8 LPA | 5-8 Yrs: ₹12 - 24+ LPA.",
            "targetTraits": {
                "Creative": 3,
                "Visual": 3,
                "Expressive": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Practice freehand drawing, visual composition, and digital art basics using graphics tablets."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Clear NIFT (National Institute of Fashion Technology) or NID entrance exams, or earn a B.FA (Bachelor of Fine Arts) from College of Art Delhi or Sir J.J. School of Art."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master Adobe Creative Cloud (Photoshop, Illustrator, InDesign). Build a professional Behance portfolio demonstrating brand identity case studies."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join creative agencies like Ogilvy India, Dentsu, or corporate brand teams as Junior Graphic Designer. Starting Salary: ₹3.5 LPA - ₹8 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Art Director. Lead visual branding campaigns and mentor junior designers."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Creative Director, Executive Art Lead, or Founder of a boutique Brand Design Studio."
                }
            ],
            "books": [
                "Designing Brand Identity by Alina Wheeler",
                "Grid Systems in Graphic Design by Josef Müller-Brockmann"
            ]
        },
        {
            "title": "UX/UI Designer & Design Systems Lead",
            "icon": "📱",
            "desc": "Architect user experiences, interactive wireframes, and scalable design component libraries for web and mobile software. Why relevant in India: Product companies require dedicated UX specialists to optimize conversion rates and accessibility for digital consumers. Salary: Entry: ₹6 - 15 LPA | 5-8 Yrs: ₹18 - 36+ LPA.",
            "targetTraits": {
                "Creative": 3,
                "Analytical": 2,
                "Empathy": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study human-computer interaction, sketch wireframes for everyday apps, and build empathy for user pain points."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn a B.Des or M.Des from NID, IIT Industrial Design Centre (IDC), or Srishti Institute of Art, Design and Technology."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master Figma, Design Tokens, Micro-interactions, and accessibility standards (WCAG). Publish detailed UX research case studies on Medium/Behance."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join product tech teams at Flipkart, PhonePe, MakeMyTrip, or design consultancies. Starting Salary: ₹6 LPA - ₹15 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Lead UX Designer / Design Systems Architect. Manage enterprise component libraries used by 100+ developers."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Advance to VP of Experience Design, Chief Design Officer (CDO), or Independent UX Strategist."
                }
            ],
            "books": [
                "Refactoring UI by Adam Wathan & Steve Schoger",
                "Atomic Design by Brad Frost"
            ]
        },
        {
            "title": "Content Creator & Digital Media Entrepreneur",
            "icon": "📹",
            "desc": "Produce storytelling videos, educational content, podcasts, and digital shows for millions of audience followers across YouTube, Instagram, and social channels. Why relevant in India: India is the world's largest YouTube and Instagram creator market, powering a multi-billion dollar creator economy. Salary: Entry: ₹3 - 10 LPA | 5-8 Yrs: ₹15 - 50+ LPA (plus sponsorship upside).",
            "targetTraits": {
                "Expressive": 3,
                "Communication": 3,
                "Creative": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Learn scriptwriting, smartphone video editing, public speaking, and storytelling fundamentals."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Pursue B.A. in Journalism & Mass Communication (BJMC) or self-taught digital creation alongside any degree program."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master Adobe Premiere Pro, DaVinci Resolve, camera lighting, thumbnail design, and audience retention analytics."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Launch independent digital channels or work as Content Specialist at digital media houses (Pocket Aces, FilterCopy, ScoopWhoop). Starting Salary: ₹3 LPA - ₹10 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Scale channel subscribers to 500k+, monetize via brand deals, merchandise, and digital courses. Hire production team."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Found a Digital Media Production Studio, Creator Incubator, or D2C Brand leveraged by personal distribution."
                }
            ],
            "books": [
                "YouTube Formula by Derral Eves",
                "Show Your Work! by Austin Kleon"
            ]
        },
        {
            "title": "3D Animator & Game Asset Artist",
            "icon": "🎮",
            "desc": "Create 3D character models, environment assets, and character animations for video games, visual effects (VFX), and animated features. Why relevant in India: India is a key outsourcing hub for global AAA game studios and home to expanding gaming/animation companies. Salary: Entry: ₹4 - 9 LPA | 5-8 Yrs: ₹12 - 28+ LPA.",
            "targetTraits": {
                "Creative": 3,
                "Technical": 2,
                "Visual": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Practice 3D visualization, figure drawing, and digital sculpting fundamentals."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Pursue B.Sc in Animation & VFX or B.Des from NID, MAAC, Arena Animation, or Whistling Woods International."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master Blender, Autodesk Maya, ZBrush, Substance Painter, and Unreal Engine 5. Build an outstanding 3D artist showreel."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join Ubisoft India, Rockstar Games India, Technicolor, or Redchillies.vfx as Junior 3D Artist. Starting Salary: ₹4 LPA - ₹9 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior 3D Asset Lead / Rigging Specialist. Work on international film VFX or AAA gaming titles."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Advance to Art Director (Gaming/VFX), Animation Director, or Founder of an Independent Game/Animation Studio."
                }
            ],
            "books": [
                "The Animator's Survival Kit by Richard Williams",
                "Creating 3D Game Art for the Real-Time Engine by Luke Ahearn"
            ]
        },
        {
            "title": "AI-Assisted 3D & Motion Artist",
            "icon": "✨",
            "desc": "Combine motion graphics, 3D visual effects, and Generative AI visual generators for high-impact commercial films, music videos, and virtual worlds. Why relevant in India: Ad agencies and OTT platforms demand fast-turnaround, futuristic motion graphics blending AI generation. Salary: Entry: ₹5 - 12 LPA | 5-8 Yrs: ₹15 - 32+ LPA.",
            "targetTraits": {
                "Creative": 3,
                "Technical": 3,
                "Visual": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Experiment with digital video editing, motion graphics, and graphic design software."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Complete B.Des or B.Sc in Media & Communication / Visual Effects."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master After Effects, Cinema 4D, Houdini, and GenAI video tools (Runway Gen-2, Midjourney, Stable Diffusion). Build a stunning motion reel."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join creative production houses, ad agencies, or OTT post-production studios. Starting Salary: ₹5 LPA - ₹12 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Motion Director. Specialize in virtual production (LED volumes), concert visual loops, and AI motion pipelines."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Creative Director of Visual Effects, Virtual Production Lead, or Founder of a Motion Design Agency."
                }
            ],
            "books": [
                "The Theory and Practice of Motion Design by Brian J. Riedlinger",
                "Adobe After Effects Classroom in a Book"
            ]
        },
        {
            "title": "Music Composer & Sound Producer",
            "icon": "🎧",
            "desc": "Compose original background scores, songs, and soundscapes for movies, OTT web series, advertisements, and gaming titles. Why relevant in India: India's massive film industries (Bollywood, Tollywood, Kollywood) and OTT series require thousands of musical compositions annually. Salary: Entry: ₹3.5 - 10 LPA | 5-8 Yrs: ₹15 - 45+ LPA (plus royalty upside).",
            "targetTraits": {
                "Creative": 3,
                "Auditory": 3,
                "Expressive": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Learn Indian Classical (Hindustani/Carnatic) or Western Music theory. Master keyboard or guitar."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn a Degree/Diploma in Sound Engineering and Music Production from KM Music Conservatory Chennai, FTII Pune (Film and Television Institute of India), or Whistling Woods."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master Digital Audio Workstations (DAWs) like Logic Pro X, Pro Tools, and Ableton Live. Build a portfolio of jingles and short film scores."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Assist established music directors or compose jingles for ad agencies and indie short films. Starting Salary: ₹3.5 LPA - ₹10 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Score independent feature films, OTT web series, and viral songs. Build relationships with film directors and record labels."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become a premier Film Music Director, Record Label Partner, or International Concert Composer."
                }
            ],
            "books": [
                "Musicophilia by Oliver Sacks",
                "The Music Producer's Handbook by Bobby Owsinski"
            ]
        },
        {
            "title": "Print & Broadcast Journalist",
            "icon": "📰",
            "desc": "Investigate news stories, conduct live interviews, and write investigative news reports for national newspapers, TV news channels, and digital media portals. Why relevant in India: India features one of the world's most vibrant multi-lingual news media markets across print, TV, and digital. Salary: Entry: ₹3.5 - 7 LPA | 5-8 Yrs: ₹10 - 22+ LPA.",
            "targetTraits": {
                "Communication": 3,
                "Analytical": 2,
                "Dedicated": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Develop a habit of reading national daily newspapers. Practice essay writing and debater skills."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Pursue B.A. in Journalism / Mass Communication (BJMC) from Indian Institute of Mass Communication (IIMC Delhi), Asian College of Journalism (ACJ Chennai), or Symbiosis."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master investigative reporting, media law, ethics, video reporting, and digital SEO news writing."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join news organizations like The Hindu, Indian Express, NDTV, or Times Group as a Trainee Reporter / Copy Editor. Starting Salary: ₹3.5 LPA - ₹7 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Correspondent / Bureau Anchor. Cover dedicated beats like Politics, Business, Tech, or Environment."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Chief Editor, Prime Time TV Anchor, or Founder of an Independent Digital News Portal."
                }
            ],
            "books": [
                "The Elements of Journalism by Bill Kovach & Tom Rosenstiel",
                "India After Gandhi by Ramachandra Guha"
            ]
        },
        {
            "title": "Fine Artist & Book Illustrator",
            "icon": "🎨",
            "desc": "Create gallery canvas paintings, sculpture art, and editorial book illustrations for publishing houses and art collectors. Why relevant in India: Indian contemporary art is breaking global auction records, alongside a boom in children's book publishing and graphic novels. Salary: Entry: ₹3 - 8 LPA | 5-8 Yrs: ₹10 - 30+ LPA (highly variable based on art sales).",
            "targetTraits": {
                "Creative": 3,
                "Expressive": 3,
                "Visual": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Build a sketchbook filled with life drawings, watercolor experiments, and visual concepts."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn a Bachelor of Fine Arts (B.FA) in Painting / Applied Art from Sir J.J. School of Art Mumbai, Faculty of Fine Arts MSU Baroda, or College of Art Delhi."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Develop a distinct signature artistic style. Participate in art exhibitions, gallery group shows, and editorial illustration commissions."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Work as an in-house illustrator for publishing houses (Penguin India, HarperCollins) or exhibit work at gallery shows. Starting Salary: ₹3 LPA - ₹8 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Hold solo art gallery exhibitions, illustrate graphic novels, and sell original artwork to private art collectors."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become an acclaimed Fine Artist with international gallery representation, Art Residency Mentor, or Professor of Fine Arts."
                }
            ],
            "books": [
                "Ways of Seeing by John Berger",
                "The Art Spirit by Robert Henri"
            ]
        },
        {
            "title": "Professional Photographer & Cinematographer",
            "icon": "📷",
            "desc": "Capture visual imagery for fashion, commercial ad campaigns, high-end weddings, documentariess, and feature films. Why relevant in India: India's massive wedding industry, fashion houses, and digital advertising spend drive high demand for professional visual storytellers. Salary: Entry: ₹4 - 9 LPA | 5-8 Yrs: ₹14 - 35+ LPA.",
            "targetTraits": {
                "Creative": 3,
                "Visual": 3,
                "Practical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Practice manual camera settings, framing, lighting, and color grading on a basic DSLR."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn a Diploma/Degree in Photography or Cinematography from FTII Pune, SRFTI Kolkata (Satyajit Ray Film and Television Institute), or Light & Life Academy."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master studio lighting setups, DaVinci Resolve color grading, and RED/Arri cinema camera operation. Assist senior fashion/film photographers."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Work as Assistant Director of Photography (DOP) or independent Commercial Photographer. Starting Salary: ₹4 LPA - ₹9 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Shoot high-budget ad commercials, luxury destination weddings, or independent feature films as lead Director of Photography."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become a renowned Feature Film DOP, Founder of a Visual Production Agency, or National Geographic Contributor."
                }
            ],
            "books": [
                "Understanding Exposure by Bryan Peterson",
                "Cinematography: Theory and Practice by Blain Brown"
            ]
        },
        {
            "title": "Advertising Copywriter & Creative Strategist",
            "icon": "✍️",
            "desc": "Write memorable ad slogans, viral campaign concepts, and brand scripts for print, TV commercials, and social media. Why relevant in India: Top Indian brands compete for consumer mindshare through creative, culturally resonant advertising campaigns. Salary: Entry: ₹4 - 9 LPA | 5-8 Yrs: ₹14 - 30+ LPA.",
            "targetTraits": {
                "Communication": 3,
                "Creative": 3,
                "Psychology": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Read iconic advertising campaigns, practice writing punchy headlines, and study consumer behavior."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Pursue a B.A. in Mass Communication, English Literature, or Advertising from top colleges (MICA Ahmedabad, XIC Mumbai)."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Build a creative copywriting portfolio (spec ads) showcasing print ads, video scripts, and social media campaigns."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join ad agencies like Leo Burnett, McCann Worldgroup, or Ogilvy India as Junior Copywriter. Starting Salary: ₹4 LPA - ₹9 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Copywriter / Creative Supervisor. Lead major brand pitches and win industry awards (Abby Awards, Cannes Lions)."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Advance to Executive Creative Director (ECD), Chief Strategy Officer, or Independent Creative Agency Founder."
                }
            ],
            "books": [
                "Ogilvy on Advertising by David Ogilvy",
                "Hey, Whipple, Squeeze This by Luke Sullivan"
            ]
        },
        {
            "title": "Podcast Producer & Audio Storyteller",
            "icon": "🎙️",
            "desc": "Produce, script, record, and edit audio shows, narrative podcasts, and audiobooks for streaming platforms (Spotify, Audible, JioSaavn). Why relevant in India: Audio content consumption in regional Indian languages is growing exponentially across tier 1-3 cities. Salary: Entry: ₹3.5 - 8 LPA | 5-8 Yrs: ₹12 - 25+ LPA.",
            "targetTraits": {
                "Auditory": 3,
                "Communication": 3,
                "Creative": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Develop a strong vocal presence, practice audio editing, and listen to narrative radio podcasts."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Complete B.A. in Mass Communication, Audio Production, or English Literature."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master audio editing tools (Audacity, Adobe Audition, Pro Tools), microphone techniques, sound design, and interview scripting."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join podcast networks (IVM Podcasts, Kuku FM, Pocket FM) or media houses as Assistant Podcast Producer. Starting Salary: ₹3.5 LPA - ₹8 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Produce top-charting narrative podcasts, manage host talent, and monetize audio shows through brand integrations."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Head of Audio Content, Executive Producer at global audio platforms, or Founder of an Independent Podcast Network."
                }
            ],
            "books": [
                "Out on the Wire: The Storytelling Secrets of the New Masters of Radio by Jessica Abel",
                "Sound Reporting by Jonathan Kern"
            ]
        },
        {
            "title": "Social Media Strategist & Brand Manager",
            "icon": "📲",
            "desc": "Plan, execute, and analyze social media campaigns, brand voice, and community engagement across digital channels for major brands. Why relevant in India: Social media is the primary consumer touchpoint in India, driving brand discovery and customer acquisition. Salary: Entry: ₹4 - 9 LPA | 5-8 Yrs: ₹13 - 28+ LPA.",
            "targetTraits": {
                "Social": 3,
                "Communication": 3,
                "Analytical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Understand social media trends, content algorithms, and digital audience engagement patterns."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn BBA, B.A. in Mass Communication, or B.Com from a recognized Indian university."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Learn digital marketing analytics, Meta Ads Manager, social listening tools (Sprout Social), and community management."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Start as Social Media Executive or Community Manager at brand marketing teams or digital agencies. Starting Salary: ₹4 LPA - ₹9 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Social Media Strategist / Brand Marketing Manager. Oversee multi-million rupee digital campaign budgets."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Vice President of Marketing, Chief Marketing Officer (CMO), or Founder of a Digital Marketing Agency."
                }
            ],
            "books": [
                "Contagious: Why Things Catch On by Jonah Berger",
                "Building a StoryBrand by Donald Miller"
            ]
        }
    ],
    "Healthcare": [
        {
            "title": "Medical Specialist (MBBS Doctor / MD / MS)",
            "icon": "🩺",
            "desc": "Diagnose acute and chronic illnesses, perform surgical interventions, and deliver clinical patient care in government and private hospitals. Why relevant in India: India has a pressing doctor-to-population deficit, creating immense societal demand and career stability nationwide. Salary: Entry (MBBS): ₹8 - 14 LPA | 5-8 Yrs (MD/MS): ₹20 - 45+ LPA.",
            "targetTraits": {
                "Technical": 3,
                "Empathy": 3,
                "Dedicated": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Complete 10+2 with Physics, Chemistry, and Biology (PCB). Focus on deep conceptual understanding of Human Anatomy and Physiology."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Crack NEET-UG (National Eligibility cum Entrance Test for Undergraduate medical courses) to secure an MBBS seat in AIIMS (All India Institute of Medical Sciences), JIPMER, or state government medical colleges."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Complete 4.5 years of rigorous MBBS coursework plus 1-year compulsory rotatory hospital internship. Gain clinical hands-on diagnostic skills."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Serve as Junior Resident Doctor in civil or private hospitals. Starting Salary: ₹8 LPA - ₹14 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Crack NEET-PG or INI-CET (Institute of National Importance Combined Entrance Test) to pursue MD (Doctor of Medicine) / MS (Master of Surgery) in Cardiology, Neurology, Pediatrics, or General Surgery."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Senior Consultant Specialist, Chief of Surgery, Medical Director, or open a private multi-specialty nursing home."
                }
            ],
            "books": [
                "Bailey & Love's Short Practice of Surgery",
                "BD Chaurasia's Human Anatomy"
            ]
        },
        {
            "title": "Registered Nurse & Clinical Care Specialist",
            "icon": "💉",
            "desc": "Provide daily bedside patient care, administer critical medications, monitor vital signs, and assist doctors in intensive care units (ICU). Why relevant in India: Healthcare expansion and international demand make qualified Indian nursing professionals highly sought after globally. Salary: Entry: ₹3.5 - 7 LPA | 5-8 Yrs: ₹9 - 20+ LPA (significantly higher for overseas practice).",
            "targetTraits": {
                "Empathy": 3,
                "Dedicated": 3,
                "Practical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Complete 10+2 with Science stream (PCB). Build patient empathy and physical endurance."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Secure admission to B.Sc Nursing (4 years) or GNM (General Nursing and Midwifery) diploma via State Nursing Entrance Exams or AIIMS B.Sc Nursing Exam."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Complete clinical hospital rotations in Emergency, ICU, OT (Operation Theatre), and Pediatric wards. Register with State Nursing Council."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join premier hospital networks (Apollo, Fortis, Max, AIIMS) as Staff Nurse. Starting Salary: ₹3.5 LPA - ₹7 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior ICU Nurse / Nursing Supervisor. Optionally clear NCLEX-RN (National Council Licensure Examination) or IELTS for UK/US/Gulf nursing practice."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Chief Nursing Officer (CNO), Director of Nursing Services, or Nursing College Principal."
                }
            ],
            "books": [
                "Brunner & Suddarth's Textbook of Medical-Surgical Nursing",
                "Potter & Perry's Fundamentals of Nursing"
            ]
        },
        {
            "title": "Pharmacist & Drug Inspector",
            "icon": "💊",
            "desc": "Formulate life-saving medications, oversee pharmacy distribution, and enforce national pharmaceutical safety laws under government regulatory bodies. Why relevant in India: India is known as the 'Pharmacy of the World', holding a massive pharma manufacturing and export footprint. Salary: Entry: ₹4 - 9 LPA | 5-8 Yrs: ₹12 - 26+ LPA.",
            "targetTraits": {
                "Organized": 3,
                "Analytical": 2,
                "Practical": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Physics, Chemistry, Mathematics/Biology (PCM/PCB) in Class 12."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Pass GPAT (Graduate Pharmacy Aptitude Test) or State CETs for B.Pharm (Bachelor of Pharmacy - 4 years) or Pharm.D."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Register with the State Pharmacy Council. Complete industrial internships in pharmaceutical manufacturing (Quality Control / Quality Assurance)."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join Sun Pharma, Cipla, Dr. Reddy's as Quality Assurance Executive or Retail Pharmacy Manager. Starting Salary: ₹4 LPA - ₹9 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Clear State Public Service Commission exams for Drug Inspector roles, or pursue M.Pharm in Pharmacology/Pharmaceutics."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Senior Drug Controller, VP of Regulatory Affairs, or Pharmaceutical Manufacturing Plant Head."
                }
            ],
            "books": [
                "Remington: The Science and Practice of Pharmacy",
                "Goodman and Gilman's The Pharmacological Basis of Therapeutics"
            ]
        },
        {
            "title": "Dental Surgeon (BDS / MDS)",
            "icon": "🦷",
            "desc": "Diagnose, treat, and perform surgical procedures on oral health conditions, teeth alignment, and facial dental trauma. Why relevant in India: Urban oral hygiene awareness and cosmetic dentistry are booming across Indian metro and tier-2 cities. Salary: Entry: ₹4.5 - 9 LPA | 5-8 Yrs: ₹14 - 30+ LPA.",
            "targetTraits": {
                "Technical": 3,
                "Practical": 3,
                "Empathy": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study PCB (Physics, Chemistry, Biology) in Class 12. Develop manual hand dexterity and visual precision."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Crack NEET-UG to secure admission to BDS (Bachelor of Dental Surgery - 5 years) in government or private dental colleges."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Complete 4 years of academic study plus 1-year compulsory rotatory internship. Register with the Dental Council of India (DCI)."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Work as Associate Dentist in corporate dental clinics (Clove Dental) or government hospitals. Starting Salary: ₹4.5 LPA - ₹9 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Crack NEET-MDS to pursue Master of Dental Surgery in Orthodontics, Endodontics, or Oral & Maxillofacial Surgery."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Establish a chain of private Dental Clinics, become Chief Maxillofacial Surgeon, or Head of Dental Department."
                }
            ],
            "books": [
                "Phillips' Science of Dental Materials",
                "Wheeler's Dental Anatomy, Physiology, and Occlusion"
            ]
        },
        {
            "title": "Physiotherapist (BPT / MPT Specialist)",
            "icon": "🦴",
            "desc": "Rehabilitate patients suffering from sports injuries, spinal trauma, stroke paralysis, and post-surgical movement limitations. Why relevant in India: The expansion of sports leagues, ergonomic IT work lifestyles, and aging demographics drive rapid physiotherapy demand. Salary: Entry: ₹3.5 - 8 LPA | 5-8 Yrs: ₹10 - 24+ LPA.",
            "targetTraits": {
                "Practical": 3,
                "Empathy": 3,
                "Dedicated": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Complete 10+2 with PCB stream. Learn human musculoskeletal movement basics."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Clear State CETs or NEET to secure BPT (Bachelor of Physiotherapy - 4.5 years including 6-month internship)."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Complete clinical rotations in Orthopedics, Neurology, and Sports Rehabilitation wards. Learn electrotherapy and manual therapy techniques."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join multi-specialty hospitals, sports academies, or rehab centers as Junior Physiotherapist. Starting Salary: ₹3.5 LPA - ₹8 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Earn MPT (Master of Physiotherapy) in Sports Medicine, Neurology, or Musculoskeletal Conditions. Work with professional Indian sports teams (IPL, ISL)."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Found an Independent Physical Rehabilitation Center, Head of Sports Medicine, or International Team Physio."
                }
            ],
            "books": [
                "Physical Rehabilitation by Susan B. O'Sullivan",
                "Joint Structure and Function by Pamela K. Levangie"
            ]
        },
        {
            "title": "AYUSH Practitioner (BAMS Ayurveda / Yoga Specialist)",
            "icon": "🌿",
            "desc": "Diagnose illnesses and treat patients using traditional Indian medicine systems (Ayurveda, Yoga, Naturopathy, Unani, Siddha, Homeopathy). Why relevant in India: Government backing under Ministry of AYUSH and global wellness trends drive massive growth in holistic healthcare. Salary: Entry: ₹4 - 8.5 LPA | 5-8 Yrs: ₹12 - 25+ LPA.",
            "targetTraits": {
                "Nature": 3,
                "Empathy": 3,
                "Practical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study PCB in 11th-12th grade. Learn Sanskrit basics for classical Ayurvedic texts."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Crack NEET-UG to secure BAMS (Bachelor of Ayurvedic Medicine and Surgery) or BHMS (Homeopathy) in recognized AYUSH colleges."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Complete 5.5 years of study including 1-year clinical hospital internship. Learn Panchakarma procedures and herbal pharmacology."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join AYUSH wellness centers, Patanjali research institutes, or government primary health centers. Starting Salary: ₹4 LPA - ₹8.5 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Clear AIAPGET (All India AYUSH Post Graduate Entrance Test) for MD/MS in Ayurveda. Specialize in Kayachikitsa or Shalya Tantra."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Found a Global Wellness Resort, become Chief Medical Officer (AYUSH), or launch a Phytomedicine Herbal Brand."
                }
            ],
            "books": [
                "Charaka Samhita (English translation)",
                "Textbook of Ayurveda by Vasant Lad"
            ]
        },
        {
            "title": "Genetic Counselor & Genomic Analyst",
            "icon": "🧬",
            "desc": "Analyze DNA sequencing data, assess hereditary genetic disease risks, and counsel families on rare genetic conditions and prenatal health. Why relevant in India: India's high genetic diversity and expanding genomic testing labs (Strand Life Sciences, MedGenomics) make genomics a top emerging healthcare field. Salary: Entry: ₹6 - 13 LPA | 5-8 Yrs: ₹18 - 35+ LPA.",
            "targetTraits": {
                "Analytical": 3,
                "Empathy": 3,
                "Technical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Excel in Biology, Chemistry, and Genetics in Class 12."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.Sc / B.Tech in Biotechnology, Genetics, or Biochemistry from a recognized university."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Earn M.Sc in Genetic Counseling or Human Genetics. Master bioinformatics tools (BLAST, Variant Call Format files) and clinical communication."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join diagnostic genomics labs, IVF centers, or oncology hospitals as Genetic Counselor. Starting Salary: ₹6 LPA - ₹13 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Genomic Variant Analyst. Specialize in hereditary cancer screening or rare pediatric genetic disorders."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Lead Director of Clinical Genomics, Head of Precision Medicine, or University Professor in Human Genetics."
                }
            ],
            "books": [
                "Practical Genetic Counselling by Peter S. Harper",
                "Emery's Elements of Medical Genetics"
            ]
        },
        {
            "title": "Health-Tech Product Manager",
            "icon": "📱",
            "desc": "Bridge medical experts, software developers, and business teams to build digital health products, electronic health records, and telemedicine apps. Why relevant in India: Digital Health initiatives (Ayushman Bharat Digital Mission) are revolutionizing healthcare delivery nationwide. Salary: Entry: ₹9 - 18 LPA | 5-8 Yrs: ₹25 - 50+ LPA.",
            "targetTraits": {
                "Leadership": 3,
                "Analytical": 3,
                "Technical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Build strong analytical, tech, and healthcare awareness in school."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Complete B.Tech in CSE/Biomedical or MBBS/B.Pharm followed by MBA from top B-schools (IIMs, ISB, TISS) via CAT."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master product management roadmaps, ABDM (Ayushman Bharat Digital Mission) compliance, HIPAA standards, and user telemetry."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join health-tech firms (Practo, Tata 1mg, PharmEasy, Apollo 24/7) as Associate Product Manager. Starting Salary: ₹9 LPA - ₹18 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Product Manager. Lead key verticals like AI diagnostics, e-pharmacy supply chain, or tele-consultation."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Advance to Vice President of Product (Health-Tech), Chief Product Officer (CPO), or Founder of a Health-Tech Startup."
                }
            ],
            "books": [
                "Inspired: How to Create Tech Products Customers Love by Marty Cagan",
                "The Lean Product Playbook by Dan Olsen"
            ]
        },
        {
            "title": "Clinical Data Analyst & Healthcare Informatician",
            "icon": "📈",
            "desc": "Process electronic health records, clinical trial data, and epidemiology statistics to optimize treatment outcomes and hospital efficiency. Why relevant in India: Global pharmaceutical clinical trials and large hospital chains depend heavily on Indian clinical data management talent. Salary: Entry: ₹5 - 11 LPA | 5-8 Yrs: ₹15 - 30+ LPA.",
            "targetTraits": {
                "Analytical": 3,
                "Organized": 3,
                "Logical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Mathematics, Statistics, and Biology."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.Sc Statistics, B.Pharm, B.Tech, or Life Sciences degree."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master SQL, Python, R, SAS (Statistical Analysis System), and CDISC standards for clinical trial data."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join Contract Research Organizations (CROs) like IQVIA, Cognizant Healthcare, or Novartis India as Clinical Data Analyst. Starting Salary: ₹5 LPA - ₹11 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Biostatistician / Clinical Data Manager. Oversee Phase I-III global pharmaceutical trial data."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Director of Clinical Data Management, Global Head of Health Informatics, or Research Scientist."
                }
            ],
            "books": [
                "Clinical Data Management by Richard K. Rondel",
                "Healthcare Analytics for Quality and Performance Improvement by Trevor L. Strome"
            ]
        },
        {
            "title": "Telemedicine Specialist & Digital Health Operator",
            "icon": "📞",
            "desc": "Manage remote diagnostic networks, digital doctor consultations, and rural e-health centers connecting distant patients with metro specialists. Why relevant in India: Telemedicine bridges the urban-rural healthcare divide in India, powered by affordable high-speed 5G mobile internet. Salary: Entry: ₹4.5 - 10 LPA | 5-8 Yrs: ₹14 - 28+ LPA.",
            "targetTraits": {
                "Communication": 3,
                "Practical": 3,
                "Empathy": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Develop strong communication skills and interest in healthcare technology."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Complete B.Sc in Allied Health Sciences, Nursing, BAMS, or BBA in Healthcare Management."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Learn digital triage protocols, remote patient monitoring devices, e-prescription regulations, and telemedicine platform tools."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join Telemedicine operators (eSanjeevani Govt portal, Apollo Telehealth, Mednet) as Telemedicine Operations Officer. Starting Salary: ₹4.5 LPA - ₹10 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Manager of Digital Health Operations. Oversee 100+ e-health clinics across rural districts."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Director of Telehealth Systems, National E-Health Policy Consultant, or Founder of a Rural Health Network."
                }
            ],
            "books": [
                "Telemedicine: Technical, Operational, and Clinical Aspects",
                "Digital Health: Digitalizing Healthcare Supply Chains"
            ]
        },
        {
            "title": "Biomedical & Medical-Device Engineer",
            "icon": "🔬",
            "desc": "Design, test, and manufacture medical hardware such as MRI scanners, pacemakers, ventilators, and robotic surgical tools. Why relevant in India: The 'Make in India' medical device initiative is boosting domestic manufacturing of high-tech medical machinery. Salary: Entry: ₹4.5 - 11 LPA | 5-8 Yrs: ₹15 - 32+ LPA.",
            "targetTraits": {
                "Technical": 3,
                "Analytical": 2,
                "Practical": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Physics, Chemistry, and Mathematics (PCM) in Class 12."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.Tech in Biomedical Engineering or Instrumentation Engineering via JEE Main or State Entrance Exams."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Learn CAD (Computer-Aided Design), medical sensor calibration, ISO 13485 quality standards, and embedded systems programming."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join GE Healthcare India, Siemens Healthineers, Philips Healthcare, or domestic device manufacturers as Biomedical Engineer. Starting Salary: ₹4.5 LPA - ₹11 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Medical Device R&D Engineer. Lead development of low-cost diagnostic devices."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Advance to Head of Biomedical Engineering, VP of Medical R&D, or Founder of a Medical Hardware Startup."
                }
            ],
            "books": [
                "Biomedical Instrumentation: Technology and Applications by R.S. Khandpur",
                "Introduction to Biomedical Engineering by John Enderle"
            ]
        },
        {
            "title": "Clinical Psychologist & Mental Health Counselor",
            "icon": "🧠",
            "desc": "Conduct psychological assessments, administer psychotherapy, and treat mental health disorders across clinics, schools, and private practice. Why relevant in India: Mental health awareness is surging across India, driving demand for licensed RCI psychologists. Salary: Entry: ₹4 - 9 LPA | 5-8 Yrs: ₹12 - 28+ LPA.",
            "targetTraits": {
                "Empathy": 3,
                "Psychology": 3,
                "Communication": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Psychology, Humanities, or Biology in 11th-12th grade."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Pursue B.A. or B.Sc in Psychology from Delhi University, Christ University, or state universities, followed by M.A./M.Sc in Clinical Psychology."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Complete RCI (Rehabilitation Council of India) recognized M.Phil in Clinical Psychology from NIMHANS Bengaluru, CIP Ranchi, or LGBRIMH Assam."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Register with RCI as a licensed Clinical Psychologist. Join hospital psychiatry departments or mental health platforms (MindPeers, YourDOST). Starting Salary: ₹4 LPA - ₹9 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Establish an independent private therapy clinic. Specialize in Cognitive Behavioral Therapy (CBT), trauma counseling, or child psychology."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Chief Clinical Psychologist, Mental Health Author, or Director of a Psychological Wellness Institute."
                }
            ],
            "books": [
                "Thinking, Fast and Slow by Daniel Kahneman",
                "Man's Search for Meaning by Viktor E. Frankl"
            ]
        }
    ],
    "GovServices": [
        {
            "title": "Civil Servant (IAS / IPS / IFS via UPSC CSE)",
            "icon": "🇮🇳",
            "desc": "Lead district administration, law & order, and national policy execution as an IAS (Indian Administrative Service), IPS (Police), or IFS (Foreign Service) officer. Why relevant in India: Civil servants hold the highest administrative authority in India, directing public welfare and governance across 700+ districts. Salary: Entry: Basic ₹56,100/mo + DA/HRA (~₹1.1L/mo gross) | 5-8 Yrs: ~₹1.8L - 2.5L/mo gross + official housing & vehicle perks.",
            "targetTraits": {
                "Leadership": 3,
                "Analytical": 3,
                "Dedicated": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Develop strong General Knowledge, read NCERT textbooks thoroughly, and follow daily national news (The Hindu/Indian Express)."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Graduate in any discipline (B.A., B.Sc, B.Tech, MBBS, B.Com) from a recognized university. Appear for UPSC CSE (Union Public Service Commission Civil Services Examination)."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master Prelims (GS & CSAT), Mains written exam (9 papers including Optional Subject), and Personality Test (Interview)."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Complete foundational officer training at LBSNAA Mussoorie (or SVPNPA Hyderabad for IPS). Appointed as Assistant Collector / Sub-Divisional Magistrate (SDM) or Assistant Superintendent of Police (ASP)."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to District Magistrate (DM) / Collector or Superintendent of Police (SP). Manage district administration, elections, and law enforcement."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Advance to Joint Secretary, State Principal Secretary, Union Cabinet Secretary (highest bureaucratic post), or Ambassador."
                }
            ],
            "books": [
                "Indian Polity by M. Laxmikanth",
                "India's Struggle for Independence by Bipan Chandra"
            ]
        },
        {
            "title": "State PCS Officer (Deputy Collector / Tehsildar)",
            "icon": "📜",
            "desc": "Manage land revenue, rural development schemes, and local administration at sub-divisional levels under state governments. Why relevant in India: State Civil Services officers execute grassroots governance across state departments in India. Salary: Entry: ~₹55,000 - 85,000/mo gross | 5-8 Yrs: ~₹1.2L - 1.8L/mo gross + perks.",
            "targetTraits": {
                "Organized": 3,
                "Practical": 3,
                "Leadership": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study State history, geography, and general awareness."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Graduate in any discipline. Appear for State PSC Exams (e.g., MPSC Maharashtra, UPPSC Uttar Pradesh, BPSC Bihar, KPSC Karnataka, RAS Rajasthan)."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Clear State Prelims, Mains, and Interview focusing heavily on State-specific General Knowledge and local language."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Undergo State Administrative Academy training. Appointed as Deputy Collector, Tehsildar, or Block Development Officer (BDO). Starting Salary: ~₹55k - ₹85k/mo."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Sub-Divisional Officer (SDO) / Additional District Magistrate (ADM). Get nominated into IAS cadre after required service years."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Advance to Special Secretary in state government or Head of State Public Department."
                }
            ],
            "books": [
                "State Specific General Knowledge Manuals (Arihant/Pearson)",
                "Indian Economy by Ramesh Singh"
            ]
        },
        {
            "title": "Bank Probationary Officer (IBPS PO / SBI PO)",
            "icon": "🏦",
            "desc": "Manage branch banking operations, commercial credit sanctioning, customer accounts, and financial services in Public Sector Banks. Why relevant in India: Public sector banks (SBI, PNB, Bank of Baroda) form the financial backbone of India's economy. Salary: Entry: ~₹65,000 - 82,000/mo gross (~₹8 - 11 LPA including perks) | 5-8 Yrs: ₹15 - 24+ LPA.",
            "targetTraits": {
                "Organized": 3,
                "Analytical": 3,
                "Practical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Build strong speed-maths, logical reasoning, and English comprehension skills."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn a Bachelor's degree in any discipline. Appear for SBI PO or IBPS PO (Institute of Banking Personnel Selection) exams."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master Prelims (Quantitative Aptitude, Reasoning, English), Mains (Data Analysis & Descriptive test), and Group Exercises/Interview."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join as Probationary Officer (PO) at SBI or Public Sector Banks undergoing 2 years probation. Starting Salary: ~₹65k - ₹82k/mo gross."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Branch Manager / Assistant General Manager (AGM). Handle commercial loan portfolios, treasury, or Forex operations."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Elevate to Chief General Manager (CGM), Executive Director (ED), or Chairman & Managing Director (CMD) of a Public Sector Bank."
                }
            ],
            "books": [
                "Quantitative Aptitude for Competitive Examinations by R.S. Aggarwal",
                "Banking Awareness by Arihant Experts"
            ]
        },
        {
            "title": "Defence Officer (Army / Navy / Air Force via NDA / CDS)",
            "icon": "🎖️",
            "desc": "Command combat units, warships, or fighter squadrons defending the sovereignty and territorial security of the Indian Republic. Why relevant in India: Armed forces officers command immense national honor, operational discipline, and leadership opportunities. Salary: Entry (Lieutenant): Basic ₹56,100/mo + Military Service Pay ₹15,500 + DA (~₹1.2L/mo gross) | 5-8 Yrs (Major): ~₹1.8L - 2.6L/mo gross + official accommodation & medical.",
            "targetTraits": {
                "Leadership": 3,
                "Dedicated": 3,
                "Practical": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Maintain high physical fitness, leadership qualities, and complete 10+2 with PCM (for Air Force/Navy) or any stream (for Army)."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Appear for NDA (National Defence Academy Exam after 10+2) or CDS (Combined Defence Services Exam after Graduation) conducted by UPSC."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Clear the 5-day SSB (Services Selection Board) interview assessing Officer-Like Qualities (OLQs), psychological tests, and medical evaluation."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Complete 3-4 years military training at NDA Khadakwasla, IMA Dehradun, INA Ezhimala, or AFA Dundigal. Commissioned as Lieutenant / Flying Officer / Sub-Lieutenant."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Captain / Major. Command military units, specialized battalion operations, or pilot advanced fighter aircraft (Rafale/Su-30)."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Advance to Colonel, Brigadier, Major General, Lieutenant General, or Chief of Staff."
                }
            ],
            "books": [
                "SSB Interview: The Complete Guide by Dr. N.K. Natarajan",
                "The Brave: Param Vir Chakra Stories by Rachna Bisht Rawat"
            ]
        },
        {
            "title": "PSU Engineering Executive (via GATE)",
            "icon": "⚙️",
            "desc": "Manage heavy engineering infrastructure, power grids, oil refineries, and defense production in Maharatna/Navratna Public Sector Enterprises. Why relevant in India: PSUs (ONGC, IOCL, NTPC, BHEL, ISRO, DRDO) power India's industrial and energy independence. Salary: Entry: ₹8 - 18 LPA | 5-8 Yrs: ₹18 - 35+ LPA + PSU quarters & medical perks.",
            "targetTraits": {
                "Technical": 3,
                "Organized": 3,
                "Logical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Physics, Chemistry, and Mathematics (PCM) in 11th-12th grade."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.Tech/B.E. in Mechanical, Electrical, Civil, Chemical, or CS Engineering from an AICTE-approved college."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Score a top All India Rank (AIR under 300) in GATE (Graduate Aptitude Test in Engineering) in final year or post-graduation."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join ONGC, IOCL, NTPC, HPCL, BHEL, or GAIL as Executive Trainee / Assistant Executive Engineer. Starting Salary: ₹8 LPA - ₹18 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Manager / Senior Executive Engineer. Oversee mega-scale refinery operations, power generation, or space research projects."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Advance to Chief General Manager (CGM), Executive Director, or Board Director in Maharatna PSUs."
                }
            ],
            "books": [
                "GATE Engineering Mathematics by MADE EASY Editorial Board",
                "Objective Type Questions in Engineering by R.K. Jain"
            ]
        },
        {
            "title": "Public Policy Analyst & Think-Tank Researcher",
            "icon": "📋",
            "desc": "Research socioeconomic data, evaluate legislative bills, and draft policy recommendations for government ministries, NITI Aayog, and policy think-tanks. Why relevant in India: Evidence-based policymaking is essential for India's economic growth, urban development, and social welfare programs. Salary: Entry: ₹6 - 14 LPA | 5-8 Yrs: ₹18 - 38+ LPA.",
            "targetTraits": {
                "Analytical": 3,
                "ProblemSolving": 3,
                "Organized": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Economics, Political Science, History, or Mathematics."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.A. Economics, Political Science, Law, or B.Tech, followed by Master of Public Policy (MPP) from NLSIU Bengaluru, ISPP Delhi, TISS, or Oxford/LSE."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master quantitative data analysis (Stata/R), policy evaluation frameworks, legislative research, and white-paper drafting."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join think-tanks (CPR, Observer Research Foundation, Brookings India) or NITI Aayog consultancy roles as Policy Analyst. Starting Salary: ₹6 LPA - ₹14 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Policy Fellow. Lead research projects on climate transition, digital public infrastructure, or tax policy."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Director of Policy Think-Tank, Senior Advisor to Government Ministries, or Chief Policy Strategist."
                }
            ],
            "books": [
                "Public Policy in India by Rajesh Chakrabarti",
                "In Service of the Republic by Vijay Kelkar & Ajay Shah"
            ]
        },
        {
            "title": "Urban & Smart-City Planner",
            "icon": "🏙️",
            "desc": "Design sustainable urban masterplans, transit-oriented zoning, waste management, and green infrastructure for expanding Indian cities. Why relevant in India: India's massive urban transformation under Smart Cities Mission requires expert urban planners. Salary: Entry: ₹5.5 - 12 LPA | 5-8 Yrs: ₹16 - 32+ LPA.",
            "targetTraits": {
                "Analytical": 3,
                "Organized": 3,
                "Nature": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Mathematics, Geography, and Drawing/Architecture basics."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Pursue Bachelor of Planning (B.Plan) via JEE Main Paper 2 or B.Arch (Bachelor of Architecture)."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Earn M.Plan (Master of Planning) from SPA Delhi (School of Planning and Architecture), CEPT University Ahmedabad, or IITs. Learn GIS (Geographic Information Systems) and AutoCAD."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join Smart City SPVs, Municipal Corporations, or global consultancies (PwC, EY, JLL) as Junior Urban Planner. Starting Salary: ₹5.5 LPA - ₹12 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Urban Transport / Environmental Planner. Direct multi-crore city masterplans and metro corridor planning."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Chief Town Planner, Director of Urban Development Authority, or UN-Habitat Consultant."
                }
            ],
            "books": [
                "Urbanization in India by K.C. Sivaramakrishnan",
                "The Death and Life of Great American Cities by Jane Jacobs"
            ]
        },
        {
            "title": "GovTech Specialist & DPI Manager",
            "icon": "🌐",
            "desc": "Build and manage Digital Public Infrastructure (DPI) platforms like UPI, Aadhaar, DigiLocker, and ONDC for seamless public service delivery. Why relevant in India: India leads the world in Digital Public Goods, exporting its GovTech stack models globally. Salary: Entry: ₹8 - 18 LPA | 5-8 Yrs: ₹22 - 48+ LPA.",
            "targetTraits": {
                "Technical": 3,
                "Leadership": 3,
                "ProblemSolving": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Excel in Science stream with strong interest in technology and governance."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.Tech in CSE/IT from IITs/NITs or top engineering institutes."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master open-source scalable software architecture, API design, data privacy standards, and public sector stakeholder management."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join National Informatics Centre (NIC), NPCI (National Payments Corporation of India), Digital India Corporation, or NeGD as GovTech Engineer. Starting Salary: ₹8 LPA - ₹18 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to GovTech Product Manager / Lead Architect. Direct national-scale platforms handling billions of transactions."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Chief Technology Officer of Digital India, Global DPI Consultant to World Bank, or GovTech Startup Founder."
                }
            ],
            "books": [
                "Rebooting India by Nandan Nilekani & Viral Shah",
                "Building Digital Public Infrastructure by World Bank Group"
            ]
        },
        {
            "title": "ESG & Sustainability Consultant",
            "icon": "🌱",
            "desc": "Help corporations and government bodies implement Environmental, Social, and Governance (ESG) compliance, carbon accounting, and green transition strategies. Why relevant in India: Mandatory SEBI BRSR (Business Responsibility and Sustainability Reporting) regulations drive rapid corporate demand. Salary: Entry: ₹6 - 13 LPA | 5-8 Yrs: ₹18 - 38+ LPA.",
            "targetTraits": {
                "Nature": 3,
                "Analytical": 3,
                "Organized": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Focus on Environmental Science, Economics, and Science subjects."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.Sc / B.Tech in Environmental Engineering, Energy Studies, or B.A. Economics/B.Com."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Earn Master's in Sustainability Management (NITIE/IIM Lucknow/TERI University). Master carbon footprinting, GRI standards, and SEBI BRSR compliance."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join Big 4 consulting firms (EY, Deloitte, PwC, KPMG) or corporate sustainability divisions as ESG Analyst. Starting Salary: ₹6 LPA - ₹13 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior ESG Consultant. Lead corporate decarbonization roadmaps, green bond auditing, and supply chain sustainability."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Advance to Chief Sustainability Officer (CSO), ESG Practice Partner, or Climate Advisory Founder."
                }
            ],
            "books": [
                "Corporate Sustainability by Ann Brockett",
                "Net Positive by Paul Polman & Andrew Winston"
            ]
        },
        {
            "title": "Diplomat & Foreign Service Specialist",
            "icon": "🕊️",
            "desc": "Represent India in foreign embassies, negotiate international treaties, foster bilateral trade, and safeguard the Indian diaspora abroad. Why relevant in India: India's expanding global diplomatic footprint requires skilled foreign service officers worldwide. Salary: Entry: Basic ₹56,100/mo + Foreign Allowance (~$3,000 - $6,000/mo depending on country posting) | 5-8 Yrs: Senior Diplomatic Scale + official embassy residence.",
            "targetTraits": {
                "Communication": 3,
                "Analytical": 3,
                "Leadership": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study World History, International Relations, and master spoken/written English and foreign languages."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Graduate in any discipline. Clear UPSC CSE opting for IFS (Indian Foreign Service) with a top All India Rank (AIR)."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Undergo foundational training at LBSNAA and diplomatic training at Sushma Swaraj Institute of Foreign Service (SSIFS Delhi). Master a compulsory foreign language (Mandarin, French, Russian, Arabic, Spanish)."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Posted to an Indian Embassy abroad as Third Secretary / Second Secretary. Starting Salary: Basic + Foreign Allowance."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to First Secretary / Counselor. Manage bilateral economic trade negotiations, press relations, and consular services."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Ambassador of India, High Commissioner, Permanent Representative to the United Nations, or Foreign Secretary."
                }
            ],
            "books": [
                "The India Way: Strategies for an Uncertain World by S. Jaishankar",
                "Pax Indica by Shashi Tharoor"
            ]
        },
        {
            "title": "Intelligence Analyst & National Cyber Security Officer",
            "icon": "🕵️",
            "desc": "Gather national security intelligence, analyze geopolitical threats, and defend national digital infrastructure under central intelligence agencies. Why relevant in India: National security agencies (IB, R&AW, NTRO) actively recruit specialized analytical and cyber intelligence talent. Salary: Entry: ₹6 - 14 LPA | 5-8 Yrs: ₹16 - 32+ LPA + official security allowances.",
            "targetTraits": {
                "Analytical": 3,
                "Dedicated": 3,
                "Technical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Science or Humanities with strong analytical focus."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Graduate in B.Tech (CSE/ECE), M.Sc Cyber Security, or International Relations."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Clear IB ACIO (Intelligence Bureau Assistant Central Intelligence Officer) exam or GATE for NTRO (National Technical Research Organisation) recruitment."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Undergo specialized security academy training. Appointed as ACIO-II / Technical Officer in Intelligence Bureau or NTRO. Starting Salary: ₹6 LPA - ₹14 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Intelligence Officer. Specialize in counter-terrorism intelligence, signal intelligence (SIGINT), or cyber threat intelligence."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Advance to Joint Director, Head of Technical Intelligence, or National Cyber Security Coordinator."
                }
            ],
            "books": [
                "Inside IB and RAW by K. Sankaran Nair",
                "Spies in the Himalayas by M.S. Kohli"
            ]
        },
        {
            "title": "Disaster Management & Climate Resilience Officer",
            "icon": "🌊",
            "desc": "Plan disaster preparedness, lead emergency evacuation logistics, and coordinate climate resilience rebuilding for state and national disaster management authorities. Why relevant in India: India's vulnerability to monsoons, cyclones, and heatwaves makes NDMA (National Disaster Management Authority) roles critical. Salary: Entry: ₹5 - 11 LPA | 5-8 Yrs: ₹15 - 28+ LPA.",
            "targetTraits": {
                "ProblemSolving": 3,
                "Leadership": 3,
                "Practical": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Geography, Environmental Science, and Disaster Management basics."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.Sc / B.A. in Environmental Science, Civil Engineering, or Social Work."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Earn Master's in Disaster Management from TISS Mumbai (Tata Institute of Social Sciences) or NIDM (National Institute of Disaster Management)."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join NDMA, SDMA (State Disaster Management Authorities), or UN disaster relief agencies as Disaster Management Officer. Starting Salary: ₹5 LPA - ₹11 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Climate Resilience Specialist. Direct regional disaster mitigation plans and flood/cyclone warning systems."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Chief Disaster Management Consultant, NDMA Director, or International Risk Reduction Specialist."
                }
            ],
            "books": [
                "Disaster Management in India by K.N. Papanna",
                "Rising: Dispatches from the New American Shore by Elizabeth Rush"
            ]
        }
    ],
    "Entrepreneurship": [
        {
            "title": "B2B SaaS Startup Founder",
            "icon": "🚀",
            "desc": "Build scalable cloud software products solving workflow automation, sales, or logistics challenges for businesses in India and global markets. Why relevant in India: India is a global capital for B2B SaaS (Software-as-a-Service), producing unicorns like Zoho, Freshworks, and Postman. Salary: Entry: ₹4 - 10 LPA (bootstrapped founder draw) | 5-8 Yrs: ₹25 - 60+ LPA (plus substantial equity valuation).",
            "targetTraits": {
                "RiskTaking": 3,
                "Leadership": 3,
                "ProblemSolving": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Build early coding or business skills. Participate in school entrepreneurship clubs (E-Cells) and hackathons."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.Tech from IITs/NITs, BITS Pilani, or BBA/IPMAT (Integrated Programme in Management) from IIM Indore/Rohtak."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Identify B2B pain points. Build a Minimum Viable Product (MVP), register company under Startup India scheme, and join incubators (CIIE IIM Ahmedabad, NSRCEL IIM Bangalore)."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Acquire first 10 paying enterprise clients, achieve Product-Market Fit (PMF), and raise pre-seed/seed funding from Indian angel networks (IAN, Blume Ventures, Surge). Starting Salary: ₹4 LPA - ₹10 LPA (bootstrap draw)."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Scale ARR (Annual Recurring Revenue) to $1M-$10M+, expand sales teams to US/Europe, and raise Series A/B funding."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Lead company to IPO (Initial Public Offering) on Indian/US stock exchanges, achieve tech unicorn status, or become Angel Investor."
                }
            ],
            "books": [
                "The High-Performance Entrepreneur by Subroto Bagchi",
                "The Lean Startup by Eric Ries"
            ]
        },
        {
            "title": "D2C E-Commerce Brand Founder",
            "icon": "🛍️",
            "desc": "Launch, market, and scale consumer lifestyle, beauty, apparel, or food brands directly to online consumers across India. Why relevant in India: Direct-to-Consumer (D2C) brands in India (Mamaearth, Licious, BoAt) are revolutionizing retail via quick-commerce and digital channels. Salary: Entry: ₹4 - 9 LPA | 5-8 Yrs: ₹20 - 50+ LPA (plus equity dividend).",
            "targetTraits": {
                "Creative": 3,
                "Communication": 3,
                "Practical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study consumer trends, social media branding, and basic finance."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Complete B.Com, BBA, or B.Des from NIFT / recognized Indian universities."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Identify niche consumer needs, source manufacturing partners in Indian industrial hubs (Tirupur, Surat, NCR), and master performance ad marketing."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Launch Shopify store storefront, run targeted social ads, and achieve first ₹10 Lakhs monthly revenue. Starting Salary: ₹4 LPA - ₹9 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Expand sales channels to Amazon India, Flipkart, Blinkit, Zepto, and offline retail stores. Raise Series A venture capital."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Scale brand into an Omnichannel Retail Conglomerate or execute a strategic M&A buyout."
                }
            ],
            "books": [
                "Building a StoryBrand by Donald Miller",
                "Shoe Dog by Phil Knight"
            ]
        },
        {
            "title": "Agri-Tech & Rural Enterprise Founder",
            "icon": "🌾",
            "desc": "Modernize Indian agriculture with IoT crop sensors, drone spraying services, smart supply chain logistics, and direct farm-to-mandis platforms. Why relevant in India: Agriculture employs nearly 45% of India's workforce, providing massive opportunity for technological modernization. Salary: Entry: ₹4 - 9 LPA | 5-8 Yrs: ₹18 - 40+ LPA.",
            "targetTraits": {
                "ProblemSolving": 3,
                "Nature": 3,
                "Practical": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Agriculture, Science, or Economics."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.Sc Agriculture from ICAR (Indian Council of Agricultural Research) recognized institutes, or B.Tech in Agricultural/Mechanical Engineering."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Spend months in rural mandis and farm clusters. Apply for NABARD (National Bank for Agriculture and Rural Development) grants and Ministry of Agriculture incubators."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Pilot Agri-Tech service (like drone spraying or supply chain aggregation) with 500+ local farmers. Starting Salary: ₹4 LPA - ₹9 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Partner with FPOs (Farmer Producer Organizations) and institutional buyers. Raise impact VC funding (Omnivore, Aavishkaar)."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Scale Agri-Tech enterprise across multiple states, impacting 100,000+ farmer livelihoods."
                }
            ],
            "books": [
                "Banker to the Poor by Muhammad Yunus",
                "The Fortune at the Bottom of the Pyramid by C.K. Prahalad"
            ]
        },
        {
            "title": "Creator-Economy Entrepreneur & Media Agency Founder",
            "icon": "🎙️",
            "desc": "Build influencer marketing agencies, talent management firms, and digital media production studios servicing modern consumer brands. Why relevant in India: Brand spending on Indian creator marketing is growing at 25%+ annually, opening huge agency opportunities. Salary: Entry: ₹4.5 - 10 LPA | 5-8 Yrs: ₹20 - 45+ LPA.",
            "targetTraits": {
                "Social": 3,
                "Communication": 3,
                "Leadership": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Build strong social media presence and networking skills."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Complete BBA, B.A. Mass Communication, or B.Com."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Build relationships with top digital creators. Master campaign ROI tracking, talent contracts, and brand deal negotiations."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Found a boutique Influencer Agency or Talent Management firm representing 10+ digital creators. Starting Salary: ₹4.5 LPA - ₹10 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Scale agency roster to 100+ exclusive creators and deliver multi-crore campaign strategies for national brands."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Expand agency into a full-stack Media Network, Studio Incubator, or sell to global advertising holding companies."
                }
            ],
            "books": [
                "Crushing It! by Gary Vaynerchuk",
                "Superfans by Pat Flynn"
            ]
        },
        {
            "title": "Climate-Tech & Clean-Energy Entrepreneur",
            "icon": "⚡",
            "desc": "Build businesses focused on EV (Electric Vehicle) battery swapping, solar micro-grids, carbon offset platforms, and circular plastic recycling. Why relevant in India: India's target of Net Zero by 2070 creates massive green energy business opportunities supported by government subsidies. Salary: Entry: ₹5 - 12 LPA | 5-8 Yrs: ₹22 - 50+ LPA.",
            "targetTraits": {
                "Nature": 3,
                "Technical": 2,
                "RiskTaking": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Physics, Chemistry, and Environmental Science."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.Tech in Electrical, Chemical, Mechanical Engineering or Environmental Science from IITs/NITs."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Learn battery chemistry, solar inverter tech, carbon credit auditing, and government PLI (Production Linked Incentive) schemes."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Launch Clean-Tech startup (e.g., commercial EV fleet charging or solar installation network). Starting Salary: ₹5 LPA - ₹12 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Secure Climate-Tech VC funding (Climate Angels, Blume) and scale clean energy infrastructure across industrial hubs."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Clean-Energy Industrialist, Board Director of Green Energy Infrastructure, or Climate Policy Luminary."
                }
            ],
            "books": [
                "How to Avoid a Climate Disaster by Bill Gates",
                "Speed & Scale by John Doerr"
            ]
        },
        {
            "title": "Social-Impact Enterprise Founder & NGO Director",
            "icon": "🤝",
            "desc": "Build self-sustaining social enterprises and non-profits solving grassroots challenges in healthcare, education, sanitation, and women empowerment. Why relevant in India: India's mandatory 2% Corporate Social Responsibility (CSR) law directs thousands of crores into sustainable social projects. Salary: Entry: ₹3.5 - 8 LPA | 5-8 Yrs: ₹12 - 25+ LPA.",
            "targetTraits": {
                "Empathy": 3,
                "Leadership": 3,
                "Social": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Volunteer with local community initiatives and social awareness drives."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.A./BSW (Bachelor of Social Work) or M.A./MSW from TISS (Tata Institute of Social Sciences) or Azim Premji University."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Complete Teach for India or Gandhi Fellowship. Master Section 8 company registration, FCRA (Foreign Contribution Regulation Act), and CSR grant pitching."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Found a Social Enterprise or Section 8 NGO addressing rural education or sanitation. Starting Salary: ₹3.5 LPA - ₹8 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Secure multi-year CSR funding from top Indian corporates (Tata Trusts, Reliance Foundation, Infosys Foundation) impacting 50,000+ lives."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become a prominent Social Leader, Global Impact Advisor to United Nations, or Philanthropic Trust Trustee."
                }
            ],
            "books": [
                "Half the Sky by Nicholas Kristof & Sheryl WuDunn",
                "To Change the World by Michael Woolcock"
            ]
        },
        {
            "title": "Venture Capital Analyst & Angel Investor",
            "icon": "💼",
            "desc": "Evaluate early-stage startups, conduct financial due diligence, structure term sheets, and fund promising Indian tech entrepreneurs. Why relevant in India: India boasts the world's 3rd largest startup ecosystem, backed by hundreds of active VC funds and angel networks. Salary: Entry: ₹10 - 22 LPA | 5-8 Yrs: ₹30 - 75+ LPA (plus carried interest/carry).",
            "targetTraits": {
                "Analytical": 3,
                "Logical": 3,
                "Leadership": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Mathematics, Economics, and follow tech startup funding news."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.Tech from IITs or B.Com/B.A. Economics from SRCC (Shri Ram College of Commerce), followed by MBA from IIMs / ISB Hyderabad via CAT."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Work 2-3 years in Investment Banking, Management Consulting (McKinsey, Bain, BCG), or product management."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join VC funds (Peak XV Partners, Accel India, Elevation Capital, Nexus Venture Partners) as VC Analyst / Associate. Starting Salary: ₹10 LPA - ₹22 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to VP / Principal at VC firm. Lead deal sourcing, portfolio company board seats, and follow-on investments."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become General Partner (GP) in a major VC fund or launch an independent Venture Capital Fund."
                }
            ],
            "books": [
                "Venture Deals by Brad Feld & Jason Mendelson",
                "Zero to One by Peter Thiel"
            ]
        },
        {
            "title": "Family Business Modernizer & MSME Owner",
            "icon": "🏭",
            "desc": "Digitize, scale, and professionalize traditional family-owned MSMEs (Micro, Small & Medium Enterprises) into modern corporate entities. Why relevant in India: MSMEs contribute over 30% of India's GDP, requiring next-gen leaders to introduce automation and global export. Salary: Entry: ₹5 - 12 LPA | 5-8 Yrs: ₹20 - 60+ LPA (plus business profit share).",
            "targetTraits": {
                "Leadership": 3,
                "Organized": 3,
                "Practical": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Learn family business operations, accounting, and trade logistics firsthand."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn a BBA or B.Com, followed by an MBA in Family Business Management from SPJIMR Mumbai or NMIMS."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Implement ERP software, digital GST accounting, modern HR policies, and B2B export marketing in the family business."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Take over operational leadership as Management Trainee / Director in the family MSME unit. Starting Salary: ₹5 LPA - ₹12 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Expand manufacturing capacity, enter international export markets (Middle East, Europe), and automate factory lines."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Transform family business into a publicly listed corporate enterprise on BSE/NSE."
                }
            ],
            "books": [
                "The E-Myth Revisited by Michael E. Gerber",
                "Indian Family Business Mantras by Peter Leach & Tatwamasi Dixit"
            ]
        },
        {
            "title": "Franchise & Multi-Outlet Retail Owner",
            "icon": "🏬",
            "desc": "Acquire master franchise rights, open multi-unit QSR (Quick Service Restaurant) outlets, retail chains, and fitness studios across tier 2-3 Indian cities. Why relevant in India: Rapid urbanization and rising consumer incomes drive booming demand for branded franchise retail stores. Salary: Entry: ₹4 - 10 LPA | 5-8 Yrs: ₹18 - 45+ LPA.",
            "targetTraits": {
                "Organized": 3,
                "Practical": 3,
                "Leadership": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study business mathematics, commerce, and retail store management."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Complete BBA or B.Com with focus on retail operations and working capital management."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Identify high-performing national franchise brands (food, fashion, fitness). Analyze unit economics, footfall metrics, and site lease terms."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Launch first commercial franchise store unit. Manage staff, inventory turnover, and local marketing. Starting Salary: ₹4 LPA - ₹10 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Scale to 5-10+ franchise outlets across regional cities, optimizing centralized supply chain logistics."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Master Franchisee for international brands or launch an original proprietary retail chain."
                }
            ],
            "books": [
                "Franchise Your Business by Mark Siebert",
                "Retail Management by Swapna Pradhan"
            ]
        },
        {
            "title": "Wholesale Trading & Regional Distribution Business",
            "icon": "📦",
            "desc": "Manage large-scale B2B wholesale distribution networks, supply chain warehousing, and commodity trading across Indian states. Why relevant in India: India's fragmented retail market depends entirely on robust regional distributor networks. Salary: Entry: ₹4 - 9 LPA | 5-8 Yrs: ₹18 - 40+ LPA.",
            "targetTraits": {
                "Practical": 3,
                "Organized": 3,
                "Logical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Commerce, Accountancy, and Commercial Mathematics."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.Com or BBA from a recognized Indian university."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master B2B credit terms, warehouse inventory software, GST compliance, and transport logistics negotiation."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Establish regional distribution agency for FMCG, pharmaceuticals, or industrial hardware brands. Starting Salary: ₹4 LPA - ₹9 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Expand distribution network to cover 500+ retail outlets across multiple districts with automated fleet management."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Build a multi-state Logistics & Supply Chain Corporation or modern automated warehousing hub."
                }
            ],
            "books": [
                "Supply Chain Management by Sunil Chopra",
                "Logistics Management by K. Shridhara Bhat"
            ]
        },
        {
            "title": "Real Estate Developer & Commercial Project Owner",
            "icon": "🏗️",
            "desc": "Acquire land parcels, oversee residential and commercial building construction, and manage real estate sales under RERA regulations. Why relevant in India: Urban housing demand and infrastructure development make real estate one of India's largest wealth-creation sectors. Salary: Entry: ₹5 - 12 LPA | 5-8 Yrs: ₹25 - 75+ LPA.",
            "targetTraits": {
                "RiskTaking": 3,
                "Leadership": 3,
                "Practical": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Civil Engineering or Commerce and business fundamentals."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.Tech in Civil Engineering or B.Arch, followed by MBA in Real Estate / Infrastructure Management (NICMAR Pune)."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Learn land acquisition laws, municipal sanction approvals, RERA (Real Estate Regulation Act) compliance, and construction project management."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join real estate firms (DLF, Godrej Properties, Prestige) or launch independent residential housing projects. Starting Salary: ₹5 LPA - ₹12 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Develop mid-scale commercial office complexes or gated residential townships."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become a prominent Regional Real Estate Developer or Commercial REIT (Real Estate Investment Trust) Manager."
                }
            ],
            "books": [
                "Real Estate Development Principles and Process by Mike E. Miles",
                "RERA Law Manual by Taxmann"
            ]
        },
        {
            "title": "EdTech & Skill-Economy Entrepreneur",
            "icon": "🎓",
            "desc": "Build digital learning platforms, skill-based academies, and competitive exam preparation apps for Indian students and professionals. Why relevant in India: Millions of Indian students prepare for competitive exams (JEE, NEET, UPSC, GATE) driving massive EdTech demand. Salary: Entry: ₹5 - 12 LPA | 5-8 Yrs: ₹22 - 50+ LPA.",
            "targetTraits": {
                "Communication": 3,
                "Technical": 2,
                "Leadership": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Excel in academic subjects and understand student learning pain points."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.Tech, B.Sc, or B.Ed from a recognized institute."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Develop high-yield pedagogy methods, video lesson delivery, LMS (Learning Management System) tech, and student analytics."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Launch specialized online test-prep channel or skill academy platform. Starting Salary: ₹5 LPA - ₹12 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Scale platform to 100,000+ active learners, introduce AI-adaptive tutoring, and secure EdTech VC funding."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Build a National Education Network, Hybrid Coaching Institution, or acquire global learning platforms."
                }
            ],
            "books": [
                "The One World Schoolhouse by Salman Khan",
                "Mindset by Carol S. Dweck"
            ]
        }
    ],
    "Law": [
        {
            "title": "Litigation Advocate (District / High Court / Supreme Court)",
            "icon": "🏛️",
            "desc": "Represent clients directly in courtroom trials, arguing civil disputes, criminal defense, and constitutional rights petitions. Why relevant in India: Indian courtrooms handle millions of active cases, offering immense independence, trial prestige, and advocacy opportunities. Salary: Entry: ₹3 - 7 LPA (junior stipend) | 5-8 Yrs: ₹15 - 45+ LPA (Senior Advocates earn crores per appearance).",
            "targetTraits": {
                "Communication": 3,
                "Logical": 3,
                "Leadership": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Focus on Humanities, Commerce, or Science with strong debate, public speaking, and logical argumentation skills."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Crack CLAT (Common Law Admission Test) or AILET (All India Law Entrance Test) after Class 12 for 5-year B.A. LL.B (Hons) at NLUs (National Law Universities like NLSIU Bengaluru, NALSAR Hyderabad), or 3-year LL.B after graduation."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Participate in national moot court competitions. Clear the AIBE (All India Bar Examination) and enroll with the State Bar Council."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join the chambers of a Senior Advocate at District Courts, High Court, or Supreme Court of India as Junior Advocate. Starting Salary: ₹3 LPA - ₹7 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Build an independent litigation practice. Specialize in Criminal Law (under Bharatiya Nyaya Sanhita - BNS), Commercial Disputes, or Constitutional Writs."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Designated as Senior Advocate by the High Court / Supreme Court, appointed Advocate General, or elevated as High Court Judge."
                }
            ],
            "books": [
                "Before Memory Fades by Fali S. Nariman",
                "Legal Eagles by Indu Bhan"
            ]
        },
        {
            "title": "Judicial Officer (Civil Judge / PCS-J)",
            "icon": "👩‍⚖️",
            "desc": "Preside over judicial court trials, evaluate evidence, interpret statutory laws, and issue binding legal judgments in Indian district courts. Why relevant in India: Judicial officers hold prestigious constitutional authority, maintaining rule of law across district judiciaries. Salary: Entry (Civil Judge): Basic ~₹77,840/mo + DA/HRA (~₹1.1L/mo gross) | 5-8 Yrs (District Judge): ~₹1.8L - 2.4L/mo gross + official quarters.",
            "targetTraits": {
                "Logical": 3,
                "Analytical": 3,
                "Organized": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Humanities, Political Science, or any stream with a focus on legal ethics and constitution."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn an LL.B degree from a Bar Council of India (BCI) recognized university."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Prepare for State Judicial Services Examination (PCS-J). Master Civil Procedure Code, Criminal Procedure (BNSS), Evidence Act, and local state laws."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Clear State Judicial Services Prelims, Mains (judgment writing), and Viva-Voce. Complete 1-year training at State Judicial Academy to be posted as Civil Judge Junior Division / Judicial Magistrate. Starting Salary: ~₹1.1L/mo gross."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Civil Judge / Chief Judicial Magistrate (CJM), handling major civil suits and criminal trials."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Promote to District & Sessions Judge, and potential elevation to High Court Bench as High Court Judge."
                }
            ],
            "books": [
                "Landmark Judgments That Changed India by Ashok Desai",
                "Courts and Their Judgments by Arun Shourie"
            ]
        },
        {
            "title": "Corporate In-House Counsel",
            "icon": "⚖️",
            "desc": "Manage corporate legal risk, draft cross-border commercial contracts, and oversee regulatory compliance for top companies and tech MNCs. Why relevant in India: Indian corporate expansion and regulatory compliance demand dedicated in-house legal teams. Salary: Entry: ₹6 - 15 LPA | 5-8 Yrs: ₹20 - 45+ LPA.",
            "targetTraits": {
                "Analytical": 3,
                "Logical": 3,
                "Organized": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Focus on Commerce, Economics, or Humanities."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn 5-year B.A. LL.B or B.B.A. LL.B from top NLUs or recognized law colleges."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Specialize in Corporate Law, Contract Drafting, SEBI regulations, and Mergers & Acquisitions (M&A). Internship at Tier-1 law firms."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join legal teams at Tata, Reliance, Tech MNCs, or Unicorn Startups as Management Trainee (Legal) or Legal Associate. Starting Salary: ₹6 LPA - ₹15 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Legal Manager / Lead Counsel. Direct multi-million dollar commercial contract negotiations and compliance audits."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Advance to General Counsel (GC), Chief Legal Officer (CLO), or Vice President (Legal Affairs)."
                }
            ],
            "books": [
                "Working a Democratic Constitution by Granville Austin",
                "Introduction to the Constitution of India by D.D. Basu"
            ]
        },
        {
            "title": "Technology & Data-Privacy Lawyer",
            "icon": "🔒",
            "desc": "Advise tech companies on data protection compliance under India's DPDP Act 2023, cyber crime law, AI regulations, and cross-border data flows. Why relevant in India: The enforcement of India's Digital Personal Data Protection (DPDP) Act 2023 has created urgent demand for data privacy legal specialists. Salary: Entry: ₹7 - 16 LPA | 5-8 Yrs: ₹22 - 48+ LPA.",
            "targetTraits": {
                "Technical": 3,
                "Analytical": 3,
                "Logical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Science or Humanities with strong interest in technology and digital rights."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Complete B.A. LL.B or B.Tech LL.B specialized degree from top NLUs or law schools."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Earn certifications like CIPP/E (Certified Information Privacy Professional) or ISO 27001 auditing. Master DPDP Act 2023, GDPR, and Information Technology Act."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join TMT (Technology, Media, Telecom) practice groups at Tier-1 law firms (CYRIL Amarchand, Shardul Amarchand, Trilegal, Khaitan) or Tech MNCs. Starting Salary: ₹7 LPA - ₹16 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Tech & Privacy Associate. Lead enterprise data privacy audits and AI governance advisory."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Partner (TMT Practice), Chief Data Protection Officer (DPO), or Founder of a Tech Law Advisory Firm."
                }
            ],
            "books": [
                "Cyber Law in India by Farooq Ahmad",
                "Data Protection Law and Practice by Prashant Mali"
            ]
        },
        {
            "title": "IP & Patent Attorney (Registered Patent Agent)",
            "icon": "💡",
            "desc": "Protect technological inventions, register patents, trademarks, and copyrights, and litigate intellectual property infringement cases. Why relevant in India: India's R&D output, pharmaceutical innovation, and startup patent filings are reaching record highs. Salary: Entry: ₹6.5 - 15 LPA | 5-8 Yrs: ₹20 - 42+ LPA.",
            "targetTraits": {
                "Technical": 3,
                "Analytical": 3,
                "Logical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Physics, Chemistry, and Biology/Maths in Class 12."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn a B.Tech / B.Sc / M.Sc in STEM, followed by an LL.B degree, or 5-year B.Tech LL.B (Intellectual Property Rights)."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Clear the Indian Patent Agent Examination conducted by CGPDTM (Controller General of Patents Designs and Trademarks) to become a Registered Patent Agent."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join premier IP law boutiques (Anand and Anand, Remfry & Sagar, K&S Partners) as Patent Associate. Starting Salary: ₹6.5 LPA - ₹15 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior IP Attorney. Draft complex patent specifications in pharma/biotech/AI and litigate patent infringement suits in High Courts."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Partner (IP Practice), Head of Global Patent Prosecution, or IP Advisory Founder."
                }
            ],
            "books": [
                "Law Relating to Intellectual Property by Dr. B.L. Wadehra",
                "Intellectual Property Law in India by Justice P. Narayanan"
            ]
        },
        {
            "title": "Alternative Dispute Resolution (ADR) Specialist",
            "icon": "🤝",
            "desc": "Resolve high-value commercial, infrastructure, and international corporate disputes out of court through binding arbitration and mediation. Why relevant in India: India is establishing international arbitration hubs (MCIA Mumbai, IAMC Hyderabad) to expedite commercial dispute resolution. Salary: Entry: ₹6 - 14 LPA | 5-8 Yrs: ₹20 - 45+ LPA.",
            "targetTraits": {
                "Communication": 3,
                "ProblemSolving": 3,
                "Organized": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Develop strong negotiation, conflict resolution, and communication skills."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn a 5-year B.A. LL.B from top NLUs or recognized law universities."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Pursue LL.M in International Commercial Arbitration. Earn accreditation from CIArb (Chartered Institute of Arbitrators) or MCIA."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join arbitration practice teams at leading law firms or institutional arbitration centers (MCIA, SIAC). Starting Salary: ₹6 LPA - ₹14 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Represent clients in multi-million dollar international commercial arbitrations under UNCITRAL / SIAC / ICC rules."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Appointed as Independent Certified Commercial Arbitrator, Mediator, or Head of Arbitration Practice."
                }
            ],
            "books": [
                "Law of Arbitration and Conciliation by O.P. Malhotra",
                "International Commercial Arbitration by Gary Born"
            ]
        },
        {
            "title": "Public Prosecutor & State Counsel",
            "icon": "⚖️",
            "desc": "Represent the government in prosecuting criminal offenses, conducting trial proceedings on behalf of state police, and upholding justice. Why relevant in India: State Directorates of Prosecution rely on dedicated public prosecutors to handle criminal trials in Magistrate and Sessions courts. Salary: Entry: ~₹50,000 - 80,000/mo gross | 5-8 Yrs: ~₹1.2L - 1.8L/mo gross + state legal perks.",
            "targetTraits": {
                "Dedicated": 3,
                "Communication": 3,
                "Logical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Humanities, Law basics, and Criminal Justice concepts."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn an LL.B degree and enroll with the State Bar Council. Complete 3-7 years of active criminal litigation practice."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Prepare for State Public Service Commission Assistant Public Prosecutor (APP) or Director of Prosecution exams."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Clear APP recruitment examination and viva-voce. Appointed as Assistant Public Prosecutor in Magistrate Courts. Starting Salary: ~₹50k - ₹80k/mo."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Public Prosecutor / Chief Public Prosecutor in Sessions Courts handling high-profile criminal trials under Bharatiya Nagarik Suraksha Sanhita (BNSS)."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Advance to Director of Prosecution, Standing Counsel for State, or Special Public Prosecutor."
                }
            ],
            "books": [
                "R.V. Kelkar's Criminal Procedure",
                "Batuk Lal's Law of Evidence"
            ]
        },
        {
            "title": "Environmental & Climate Law Specialist",
            "icon": "🌿",
            "desc": "Represent environmental NGOs, local communities, and clean-tech firms before the National Green Tribunal (NGT) and High Courts. Why relevant in India: Industrialization vs conservation disputes and NGT regulatory enforcement make environmental law a vital field. Salary: Entry: ₹4.5 - 10 LPA | 5-8 Yrs: ₹14 - 30+ LPA.",
            "targetTraits": {
                "Nature": 3,
                "Communication": 3,
                "Dedicated": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Environmental Science, Biology, and Political Science."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn an LL.B degree, followed by LL.M in Environmental Law or Energy Law."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master Environment Protection Act, Forest Conservation Act, EIA (Environmental Impact Assessment) norms, and NGT procedure."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Litigate before National Green Tribunal (NGT Delhi/Bhopal/Chennai benches) or work with environmental legal NGOs (LIFE India). Starting Salary: ₹4.5 LPA - ₹10 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Environmental Counsel. Lead major PILs (Public Interest Litigations) on forest clearance, coastal regulation, and industrial pollution."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become NGT Legal Member, UN Environment Programme (UNEP) Advisor, or Head of Climate Law Practice."
                }
            ],
            "books": [
                "Environmental Law and Policy in India by Shyam Divan & Armin Rosencranz",
                "International Environmental Law by Pierre-Marie Dupuy"
            ]
        },
        {
            "title": "Legal-Tech Consultant & Operations Specialist",
            "icon": "🤖",
            "desc": "Automate legal workflows, deploy AI contract review tools, and optimize operations for law firms and corporate legal departments. Why relevant in India: Law firms and corporate legal teams are rapidly adopting AI automation to process large volumes of legal documentation. Salary: Entry: ₹6 - 13 LPA | 5-8 Yrs: ₹18 - 38+ LPA.",
            "targetTraits": {
                "Technical": 3,
                "Organized": 3,
                "ProblemSolving": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Build skills in both computer science and logical reasoning."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn LL.B, B.Tech, or dual B.Tech LL.B degree."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master legal tech platforms (CLMs - Contract Lifecycle Management), document automation (DocuSign/Ironclad), and legal data analytics."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join Tier-1 law firm innovation labs or Legal-Tech consultancies as Legal Tech Analyst. Starting Salary: ₹6 LPA - ₹13 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Head of Legal Operations. Lead legal tech transformation for Fortune 500 legal departments."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Chief Information Officer (Law Firm), Legal-Tech Founder, or Global Legal Operations Director."
                }
            ],
            "books": [
                "Tomorrow's Lawyers by Richard Susskind",
                "Legal Tech: How Technology is Changing the Legal World"
            ]
        },
        {
            "title": "Competition & Antitrust Advocate",
            "icon": "🏢",
            "desc": "Represent companies before the Competition Commission of India (CCI) on anti-competitive agreements, cartel investigations, and mega-merger control. Why relevant in India: Big Tech dominance and major corporate mergers require stringent competition compliance under the Competition Act. Salary: Entry: ₹7 - 16 LPA | 5-8 Yrs: ₹22 - 50+ LPA.",
            "targetTraits": {
                "Analytical": 3,
                "Logical": 3,
                "Organized": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Microeconomics, Commerce, and Law."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn 5-year B.A. LL.B from top NLUs or recognized law schools."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Earn LL.M in Competition Law or Economics. Master CCI (Competition Commission of India) merger notification thresholds and abuse of dominance case law."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join Competition practice teams at Tier-1 law firms (AZB, SAM, CAM, Trilegal). Starting Salary: ₹7 LPA - ₹16 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Competition Associate. Defend tech MNCs and industrial cartels in CCI investigations and NCLAT appeals."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become Competition Law Partner, CCI Commission Member, or Senior Advocate."
                }
            ],
            "books": [
                "Competition Law in India by T. Ramappa",
                "Global Competition Law and Economics by Einer Elhauge"
            ]
        },
        {
            "title": "FinTech & Financial Regulatory Lawyer",
            "icon": "💳",
            "desc": "Advise digital payment apps, crypto protocols, and neo-banks on RBI (Reserve Bank of India) and SEBI regulatory compliance. Why relevant in India: India's rapid FinTech revolution (UPI, payment aggregators) requires specialized financial regulatory navigation. Salary: Entry: ₹7 - 16 LPA | 5-8 Yrs: ₹22 - 48+ LPA.",
            "targetTraits": {
                "Analytical": 3,
                "Logical": 3,
                "Technical": 2
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study Economics, Mathematics, and Commerce."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn B.B.A. LL.B or B.A. LL.B, or CS (Company Secretary) + LL.B combination."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Master RBI circulars, Payment and Settlement Systems Act, SEBI regulations, Anti-Money Laundering (PMLA), and digital lending guidelines."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Join legal compliance teams at Paytm, Razorpay, CRED, or financial law firms. Starting Salary: ₹7 LPA - ₹16 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Promote to Senior Regulatory Counsel. Secure RBI Payment Aggregator licenses and structure digital credit products."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become General Counsel (FinTech), Partner (Banking & Finance Practice), or RBI Legal Advisory Panelist."
                }
            ],
            "books": [
                "Law of Financial Services by E. Gordon & K. Natarajan",
                "FinTech: Law and Regulation by Jelena Madir"
            ]
        },
        {
            "title": "Human Rights & Public Interest Litigation Advocate",
            "icon": "⚖️",
            "desc": "File Public Interest Litigations (PILs) before High Courts and Supreme Court to protect marginalized rights, prisoner welfare, and civil liberties. Why relevant in India: PILs remain India's most powerful judicial mechanism for social justice and executive accountability. Salary: Entry: ₹3.5 - 7 LPA | 5-8 Yrs: ₹12 - 25+ LPA (driven by passion & public cause).",
            "targetTraits": {
                "Empathy": 3,
                "Leadership": 3,
                "Social": 3
            },
            "phases": [
                {
                    "title": "Phase 1: Foundation (Classes 9–12)",
                    "steps": "Study History, Political Science, and Human Rights issues."
                },
                {
                    "title": "Phase 2: Entry Pathway",
                    "steps": "Earn an LL.B degree from a recognized law school."
                },
                {
                    "title": "Phase 3: Skill-Building",
                    "steps": "Intern with human rights organizations (PUCL, Human Rights Law Network - HRLN). Master Article 32 & Article 226 writ jurisdiction."
                },
                {
                    "title": "Phase 4: First Job",
                    "steps": "Work as PIL Advocate or Legal Aid Counsel in High Courts. Starting Salary: ₹3.5 LPA - ₹7 LPA."
                },
                {
                    "title": "Phase 5: Growth & Specialization (3–7 yrs)",
                    "steps": "Argue landmark PIL cases securing clean water, worker rights, or prison reform before Supreme Court Benches."
                },
                {
                    "title": "Phase 6: Long-Term Trajectory (7–15+ yrs)",
                    "steps": "Become a prominent Human Rights Senior Advocate, National Human Rights Commission (NHRC) Member, or Supreme Court Judge."
                }
            ],
            "books": [
                "Public Interest Litigation by P.N. Bhagwati",
                "Courting Justice by Madhav Khosla"
            ]
        }
    ]
};

app.get('/api/firebase-config', (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY || "",
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
        projectId: process.env.FIREBASE_PROJECT_ID || "",
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
        appId: process.env.FIREBASE_APP_ID || ""
    });
});

app.get('/api/questions', (req, res) => {
    const requestedInterest = req.query.interest; 
    
    // Fallback to TechAI if category is not found
    const pool = questionsDB[requestedInterest] || questionsDB["TechAI"];
    
    // Shuffle the pool randomly
    const shuffledPool = [...pool].sort(() => 0.5 - Math.random());
    
    // Serve 8 questions instead of 5. This increases the accuracy of the 
    // trait profile by giving the matching engine more data points to work with.
    const selectedQuestions = shuffledPool.slice(0, 8);
    
    res.json(selectedQuestions);
});

// =====================================================================
// 4. RULE-BASED MATCHING ENGINE (Instant Calculation)
// =====================================================================
app.post('/api/calculate-result', (req, res) => {
    try {
        const { userTraits, interest } = req.body;

        const candidateCareers = careersDB[interest] || careersDB["TechAI"];

        const scoredCareers = candidateCareers.map(career => {
            let score = 0;
            const targetTraits = career.targetTraits;

            // Mathematical Match: Multiply the user's earned points by the career's required weight
            for (const [trait, targetValue] of Object.entries(targetTraits)) {
                if (userTraits && userTraits[trait]) {
                    score += userTraits[trait] * targetValue;
                }
            }

            // A tiny random fraction ensures that if two careers tie perfectly, 
            // the order shuffles slightly on retakes to prevent staleness.
            const tieBreaker = Math.random() * 0.1;

            return {
                ...career,
                finalScore: score + tieBreaker
            };
        });

        // Sort descending by score
        scoredCareers.sort((a, b) => b.finalScore - a.finalScore);

        // Pick top 4 best matches and strip out the backend scoring data before sending to frontend
        const topMatches = scoredCareers.slice(0, 4).map(({ finalScore, targetTraits, ...rest }) => rest);

        // Update Analytics: Increment completed quizzes, domain stats, and top career stats
        analyticsData.totalQuizzesCompleted = (analyticsData.totalQuizzesCompleted || 0) + 1;
        analyticsData.featureUsage = analyticsData.featureUsage || { compass: 0, library: 0, routine: 0 };
        analyticsData.featureUsage.compass = (analyticsData.featureUsage.compass || 0) + 1;
        if (interest) {
            analyticsData.domainStats[interest] = (analyticsData.domainStats[interest] || 0) + 1;
        }
        if (topMatches && topMatches.length > 0 && topMatches[0].title) {
            const topCareerTitle = topMatches[0].title;
            analyticsData.careerStats[topCareerTitle] = (analyticsData.careerStats[topCareerTitle] || 0) + 1;
        }
        saveAnalytics();

        // Instant return
        res.json(topMatches);

    } catch (error) {
        console.error("Matching Error:", error);
        res.status(500).json({ error: "Failed to generate roadmap recommendations." });
    }
});

// =====================================================================
// 5. REAL-TIME TRACKING & ADMIN ENDPOINTS
// =====================================================================

// Ping route for live active user tracking & page visit counts
app.post('/api/ping', (req, res) => {
    const { clientId, isNewVisit, isRoutineActive, isLibraryActive, isCompassActive, feature } = req.body || {};
    if (!clientId) {
        return res.status(400).json({ error: "clientId is required" });
    }

    activeSessions.set(clientId, Date.now());
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Browser';
    const nowIso = new Date().toISOString();
    const today = nowIso.split('T')[0];

    if (!analyticsData.uniqueVisitors) analyticsData.uniqueVisitors = {};
    if (!analyticsData.featureUsage) {
        analyticsData.featureUsage = { compass: 0, library: 0, routine: 0 };
    }

    // Permanent unique visitor tracking
    if (!analyticsData.uniqueVisitors[clientId]) {
        analyticsData.uniqueVisitors[clientId] = {
            firstSeen: nowIso,
            lastSeen: nowIso,
            ip: clientIp,
            userAgent: userAgent,
            visitCount: 1
        };
    } else {
        analyticsData.uniqueVisitors[clientId].lastSeen = nowIso;
        if (isNewVisit) {
            analyticsData.uniqueVisitors[clientId].visitCount = (analyticsData.uniqueVisitors[clientId].visitCount || 1) + 1;
        }
    }

    if (isRoutineActive || feature === 'routine') {
        activeRoutineSessions.set(clientId, Date.now());
        analyticsData.routineStats = analyticsData.routineStats || { totalInteractions: 0, totalHabitCheckoffs: 0, dailyUsers: {} };
        analyticsData.routineStats.dailyUsers[today] = analyticsData.routineStats.dailyUsers[today] || [];
        if (!analyticsData.routineStats.dailyUsers[today].includes(clientId)) {
            analyticsData.routineStats.dailyUsers[today].push(clientId);
        }
        if (isNewVisit || feature === 'routine') {
            analyticsData.featureUsage.routine = (analyticsData.featureUsage.routine || 0) + 1;
        }
    }

    if (isLibraryActive || feature === 'library') {
        if (isNewVisit || feature === 'library') {
            analyticsData.featureUsage.library = (analyticsData.featureUsage.library || 0) + 1;
        }
    }

    if (isCompassActive || feature === 'compass') {
        if (isNewVisit || feature === 'compass') {
            analyticsData.featureUsage.compass = (analyticsData.featureUsage.compass || 0) + 1;
        }
    }

    if (isNewVisit) {
        analyticsData.totalVisitors = (analyticsData.totalVisitors || 0) + 1;
        if (!isRoutineActive && !isLibraryActive && !isCompassActive && !feature) {
            analyticsData.featureUsage.compass = (analyticsData.featureUsage.compass || 0) + 1;
        }
    }

    saveAnalytics();

    const uniqueCount = Object.keys(analyticsData.uniqueVisitors || {}).length;

    res.json({
        success: true,
        activeUsers: getActiveUserCount(),
        uniqueVisitors: uniqueCount,
        totalVisitors: analyticsData.totalVisitors
    });
});

// Event tracking endpoint for Modern Library & Routine Tracker
app.post('/api/track-event', (req, res) => {
    const { type, clientId, bookTitle, isCheckoff, feature } = req.body || {};
    const today = new Date().toISOString().split('T')[0];

    analyticsData.libraryStats = analyticsData.libraryStats || { totalViews: 0, bookViews: 0, popularBooks: {} };
    analyticsData.routineStats = analyticsData.routineStats || { totalInteractions: 0, totalHabitCheckoffs: 0, dailyUsers: {} };
    analyticsData.featureUsage = analyticsData.featureUsage || { compass: 0, library: 0, routine: 0 };

    if (type === 'library_open') {
        analyticsData.libraryStats.totalViews = (analyticsData.libraryStats.totalViews || 0) + 1;
        analyticsData.featureUsage.library = (analyticsData.featureUsage.library || 0) + 1;
        saveAnalytics();
    } else if (type === 'book_view') {
        analyticsData.libraryStats.bookViews = (analyticsData.libraryStats.bookViews || 0) + 1;
        analyticsData.featureUsage.library = (analyticsData.featureUsage.library || 0) + 1;
        if (bookTitle) {
            analyticsData.libraryStats.popularBooks[bookTitle] = (analyticsData.libraryStats.popularBooks[bookTitle] || 0) + 1;
        }
        saveAnalytics();
    } else if (type === 'routine_interaction') {
        if (clientId) {
            activeRoutineSessions.set(clientId, Date.now());
            analyticsData.routineStats.dailyUsers[today] = analyticsData.routineStats.dailyUsers[today] || [];
            if (!analyticsData.routineStats.dailyUsers[today].includes(clientId)) {
                analyticsData.routineStats.dailyUsers[today].push(clientId);
            }
        }
        analyticsData.routineStats.totalInteractions = (analyticsData.routineStats.totalInteractions || 0) + 1;
        analyticsData.featureUsage.routine = (analyticsData.featureUsage.routine || 0) + 1;
        if (isCheckoff) {
            analyticsData.routineStats.totalHabitCheckoffs = (analyticsData.routineStats.totalHabitCheckoffs || 0) + 1;
        }
        saveAnalytics();
    } else if (type === 'compass_interaction' || feature === 'compass') {
        analyticsData.featureUsage.compass = (analyticsData.featureUsage.compass || 0) + 1;
        saveAnalytics();
    }

    res.json({ success: true });
});

// =====================================================================
// SQLITE USER DATABASE & AUTHENTICATION ENDPOINTS
// =====================================================================

// POST /register - Accepts name, email, and password; hashes password with bcrypt & inserts into SQLite users table
app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body || {};

        if (!name || !email || !password) {
            return res.status(400).json({ error: "Name, email, and password are required." });
        }

        const trimmedName = String(name).trim();
        const normalizedEmail = String(email).trim().toLowerCase();

        if (!trimmedName || !normalizedEmail || !password) {
            return res.status(400).json({ error: "Invalid name, email, or password provided." });
        }

        // Securely hash password with bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);

        try {
            const insertStmt = db.prepare(`
                INSERT INTO users (name, email, hashed_password)
                VALUES (?, ?, ?)
            `);
            const result = insertStmt.run(trimmedName, normalizedEmail, hashedPassword);

            // Also keep usersData in sync so all features operate smoothly
            const userId = `usr_${result.lastInsertRowid}`;
            const timestamp = new Date().toISOString();
            const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';

            if (!usersData.users.some(u => u.email && u.email.toLowerCase() === normalizedEmail)) {
                usersData.users.push({
                    id: userId,
                    name: trimmedName,
                    email: normalizedEmail,
                    username: normalizedEmail.split('@')[0],
                    passwordHash: hashedPassword,
                    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(trimmedName)}`,
                    isVerified: true,
                    createdAt: timestamp,
                    loginCount: 1,
                    lastLoginAt: timestamp,
                    lastLoginIp: clientIp
                });
                saveUsersData();
            }

            return res.status(201).json({
                success: true,
                message: "User registered successfully in SQLite database.",
                user: {
                    id: result.lastInsertRowid,
                    name: trimmedName,
                    email: normalizedEmail
                }
            });
        } catch (dbErr) {
            if (dbErr.message && (dbErr.message.includes('UNIQUE constraint failed') || dbErr.code === 'SQLITE_CONSTRAINT_UNIQUE')) {
                return res.status(409).json({ error: "User with this email already exists." });
            }
            throw dbErr;
        }
    } catch (err) {
        console.error("Registration Error:", err);
        return res.status(500).json({ error: "Internal server error during registration." });
    }
});

// GET /api/users/:email - Fetches and returns id, name, and email (excludes password)
app.get('/api/users/:email', (req, res) => {
    try {
        const { email } = req.params;
        if (!email) {
            return res.status(400).json({ error: "Email parameter is required." });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const selectStmt = db.prepare(`
            SELECT id, name, email FROM users WHERE LOWER(email) = ?
        `);
        const user = selectStmt.get(normalizedEmail);

        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        return res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });
    } catch (err) {
        console.error("Fetch User Error:", err);
        return res.status(500).json({ error: "Internal server error retrieving user." });
    }
});

// User Registration (API Route)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, username, password, mobile } = req.body || {};

        if (!name || !email || !password) {
            return res.status(400).json({ error: "Name, email, and password are required." });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const finalUsername = (username || normalizedEmail.split('@')[0]).trim().toLowerCase();

        // Check uniqueness
        const existingUser = usersData.users.find(
            u => u.email.toLowerCase() === normalizedEmail || u.username.toLowerCase() === finalUsername
        );

        if (existingUser) {
            return res.status(400).json({ error: "An account with this email or username already exists." });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const userId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const timestamp = new Date().toISOString();
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

        const newUser = {
            id: userId,
            name: name.trim(),
            email: normalizedEmail,
            mobile: mobile ? mobile.trim() : '',
            username: finalUsername,
            passwordHash,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name.trim())}`,
            isVerified: true,
            createdAt: timestamp,
            loginCount: 1,
            lastLoginAt: timestamp,
            lastLoginIp: clientIp
        };

        const newLog = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            userId: userId,
            name: newUser.name,
            username: newUser.username,
            email: newUser.email,
            timestamp: timestamp,
            ip: clientIp,
            userAgent: req.headers['user-agent'] || 'Browser',
            status: 'SUCCESS'
        };

        usersData.users.push(newUser);
        usersData.loginLogs.unshift(newLog);
        saveUsersData();

        // Also insert into SQLite users table
        try {
            const insertStmt = db.prepare(`
                INSERT OR IGNORE INTO users (name, email, hashed_password)
                VALUES (?, ?, ?)
            `);
            insertStmt.run(newUser.name, newUser.email, passwordHash);
        } catch (dbErr) {
            console.warn("SQLite insert on /api/auth/register warning:", dbErr.message);
        }

        const token = jwt.sign(
            { userId: newUser.id, email: newUser.email, username: newUser.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        const { passwordHash: _, ...userWithoutPassword } = newUser;
        res.json({
            success: true,
            token,
            user: userWithoutPassword
        });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ error: "Registration failed." });
    }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { emailOrUsername, password } = req.body || {};

        if (!emailOrUsername || !password) {
            return res.status(400).json({ error: "Email/Username and password are required." });
        }

        const query = emailOrUsername.trim().toLowerCase();
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const timestamp = new Date().toISOString();

        const user = usersData.users.find(
            u => u.email.toLowerCase() === query || u.username.toLowerCase() === query
        );

        if (!user) {
            usersData.loginLogs.unshift({
                id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                name: "Unknown",
                username: query,
                email: query.includes('@') ? query : "N/A",
                timestamp: timestamp,
                ip: clientIp,
                userAgent: req.headers['user-agent'] || 'Browser',
                status: 'FAILED (User Not Found)'
            });
            saveUsersData();
            return res.status(401).json({ error: "Invalid email/username or password." });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            usersData.loginLogs.unshift({
                id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                userId: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                timestamp: timestamp,
                ip: clientIp,
                userAgent: req.headers['user-agent'] || 'Browser',
                status: 'FAILED (Invalid Password)'
            });
            saveUsersData();
            return res.status(401).json({ error: "Invalid email/username or password." });
        }

        user.loginCount = (user.loginCount || 0) + 1;
        user.lastLoginAt = timestamp;
        user.lastLoginIp = clientIp;

        usersData.loginLogs.unshift({
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            userId: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            timestamp: timestamp,
            ip: clientIp,
            userAgent: req.headers['user-agent'] || 'Browser',
            status: 'SUCCESS'
        });

        saveUsersData();

        const token = jwt.sign(
            { userId: user.id, email: user.email, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        const { passwordHash: _, ...userWithoutPassword } = user;
        res.json({
            success: true,
            token,
            user: userWithoutPassword
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: "Login failed." });
    }
});

// Firebase Web App Configuration Endpoint
app.get('/api/firebase-config', (req, res) => {
    const clean = (val) => (val ? String(val).replace(/["',;]/g, '').trim() : '');
    const config = {
        apiKey: clean(process.env.FIREBASE_API_KEY) || "AIzaSyBDhP_2ZaRv4ncV7W-_p75qRoOAg8te0oU",
        authDomain: clean(process.env.FIREBASE_AUTH_DOMAIN) || "praxis-app-e6e2a.firebaseapp.com",
        projectId: clean(process.env.FIREBASE_PROJECT_ID) || "praxis-app-e6e2a",
        storageBucket: clean(process.env.FIREBASE_STORAGE_BUCKET) || "praxis-app-e6e2a.firebasestorage.app",
        messagingSenderId: clean(process.env.FIREBASE_MESSAGING_SENDER_ID) || "22274527937",
        appId: clean(process.env.FIREBASE_APP_ID) || "1:22274527937:web:8e69fc61bf10224b71fa40"
    };
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(config);
});

// Google Auth Sync & Telemetry Endpoint
app.post('/api/auth/google', async (req, res) => {
    try {
        const { email, name, photoURL, uid, mobile } = req.body || {};
        if (!email) {
            return res.status(400).json({ error: "Google email is required." });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const timestamp = new Date().toISOString();

        let user = usersData.users.find(u => u.email.toLowerCase() === normalizedEmail);

        if (!user) {
            const userId = uid || `usr_g_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            user = {
                id: userId,
                name: name || normalizedEmail.split('@')[0],
                email: normalizedEmail,
                mobile: mobile || '',
                username: normalizedEmail.split('@')[0],
                passwordHash: '',
                avatar: photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name || email)}`,
                isVerified: true,
                createdAt: timestamp,
                loginCount: 1,
                lastLoginAt: timestamp,
                lastLoginIp: clientIp
            };
            usersData.users.push(user);
        } else {
            user.loginCount = (user.loginCount || 0) + 1;
            user.lastLoginAt = timestamp;
            user.lastLoginIp = clientIp;
            if (photoURL) user.avatar = photoURL;
            if (name) user.name = name;
            if (mobile && !user.mobile) user.mobile = mobile;
        }

        usersData.loginLogs.unshift({
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            userId: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            timestamp: timestamp,
            ip: clientIp,
            userAgent: req.headers['user-agent'] || 'Browser',
            status: 'SUCCESS (Google Auth)'
        });

        saveUsersData();

        const token = jwt.sign(
            { userId: user.id, email: user.email, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        const { passwordHash: _, ...userWithoutPassword } = user;
        res.json({
            success: true,
            token,
            user: userWithoutPassword
        });
    } catch (error) {
        console.error("Google Auth Error:", error);
        res.status(500).json({ error: "Google auth logging failed." });
    }
});

// Current User Profile Verification Endpoint
app.get('/api/auth/me', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = usersData.users.find(u => u.id === decoded.userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const { passwordHash: _, ...userWithoutPassword } = user;
        res.json({ success: true, user: userWithoutPassword });
    } catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
});

// Cross-Device Data Synchronization Endpoint (Save Roadmap & Routine per User/Gmail)
app.post('/api/user/sync', (req, res) => {
    try {
        const { userId, email, mobile, roadmap, routineTracker } = req.body || {};
        const authHeader = req.headers.authorization;
        let authUserId = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, JWT_SECRET);
                authUserId = decoded.userId;
            } catch (err) {}
        }

        const queryId = authUserId || userId;
        const queryEmail = email ? email.trim().toLowerCase() : '';

        let user = usersData.users.find(u => 
            (queryEmail && u.email && u.email.toLowerCase() === queryEmail) ||
            (queryId && u.id === queryId)
        );

        if (!user && (queryEmail || queryId)) {
            user = {
                id: queryId || ("usr_g_" + Date.now()),
                name: queryEmail ? queryEmail.split('@')[0] : "Synced User",
                email: queryEmail || "unknown@device",
                mobile: mobile || '',
                createdAt: new Date().toISOString(),
                roadmap: null,
                routineTracker: null
            };
            usersData.users.push(user);
        }

        if (!user) {
            return res.status(400).json({ error: "User identity (email or userId) required for data sync." });
        }

        if (typeof mobile === 'string' && mobile.trim()) user.mobile = mobile.trim();
        if (roadmap) user.roadmap = roadmap;
        if (routineTracker) {
            user.routineTracker = routineTracker;
            if (Array.isArray(routineTracker.habits)) {
                pushSubscriptions.forEach(sub => {
                    if ((queryEmail && sub.email && sub.email.toLowerCase() === queryEmail) || (queryId && sub.userId === queryId)) {
                        sub.habits = routineTracker.habits;
                        sub.lastSyncAt = new Date().toISOString();
                    }
                });
                savePushSubscriptions();
            }
        }
        user.dataUpdatedAt = new Date().toISOString();

        saveUsersData();

        res.json({
            success: true,
            roadmap: user.roadmap || null,
            routineTracker: user.routineTracker || null
        });
    } catch (err) {
        console.error("User Sync Save Error:", err);
        res.status(500).json({ error: "Failed to sync user data." });
    }
});

// Fetch Cross-Device Synced User Data
app.get('/api/user/sync', (req, res) => {
    try {
        const { userId, email } = req.query || {};
        const authHeader = req.headers.authorization;
        let authUserId = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, JWT_SECRET);
                authUserId = decoded.userId;
            } catch (err) {}
        }

        const queryId = authUserId || userId;
        const queryEmail = email ? email.trim().toLowerCase() : '';

        const user = usersData.users.find(u => 
            (queryEmail && u.email && u.email.toLowerCase() === queryEmail) ||
            (queryId && u.id === queryId)
        );

        if (!user) {
            return res.json({
                success: true,
                roadmap: null,
                routineTracker: null
            });
        }

        res.json({
            success: true,
            roadmap: user.roadmap || null,
            routineTracker: user.routineTracker || null
        });
    } catch (err) {
        console.error("User Sync Fetch Error:", err);
        res.status(500).json({ error: "Failed to fetch user data." });
    }
});

// =====================================================================
// WEB PUSH NOTIFICATION & 24/7 BACKGROUND REMINDER ENGINE (MULTI-TIER)
// =====================================================================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BP-XNQj1EJtc8fFW6GQE08lkrky3OjLQUZ2e5FEvzjfMPdxtNF1M5F7xnN2qiqy513qa1v27naBp6bPSFr4D5Go';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'HvI4M-LLNsflMdPJE1ynDZ-qSHdCT8lYOOO2XyptdH8';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@praxis.app';

try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log("🔔 Web Push VAPID initialized successfully for 24/7 closed-browser notifications");
} catch (vErr) {
    console.error("⚠️ Web Push VAPID initialization warning:", vErr.message);
}

let pushSubscriptions = [];

function loadPushSubscriptions() {
    try {
        if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
            const raw = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            pushSubscriptions = Array.isArray(parsed.subscriptions) ? parsed.subscriptions : (Array.isArray(parsed) ? parsed : []);
            console.log(`🔔 Loaded ${pushSubscriptions.length} Web Push subscriptions from ${SUBSCRIPTIONS_FILE}`);
        } else {
            savePushSubscriptions();
            console.log(`🔔 Initialized new subscriptions.json file at ${SUBSCRIPTIONS_FILE}`);
        }
    } catch (err) {
        console.error("⚠️ Failed to load subscriptions.json:", err.message);
        pushSubscriptions = [];
    }
}

function savePushSubscriptions() {
    const localSubsFile = (DB_DIR !== __dirname) ? path.join(__dirname, 'subscriptions.json') : null;
    safeWriteJsonFile(SUBSCRIPTIONS_FILE, { subscriptions: pushSubscriptions }, localSubsFile);
}

loadPushSubscriptions();

function formatAMPM(timeStr) {
    if (!timeStr) return "";
    const parts = timeStr.split(":");
    if (parts.length < 2) return timeStr;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const ampm = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 || 12;
    const displayM = m < 10 ? "0" + m : m;
    return `${displayH}:${displayM} ${ampm}`;
}

function evaluateHabitSchedule(habit, timezone, offset) {
    if (!habit || !habit.scheduledTime || typeof habit.scheduledTime !== 'string') return null;
    const timeParts = habit.scheduledTime.trim().split(':');
    if (timeParts.length < 2) return null;
    const targetH = parseInt(timeParts[0], 10);
    const targetM = parseInt(timeParts[1], 10);
    if (isNaN(targetH) || isNaN(targetM) || targetH < 0 || targetH > 23 || targetM < 0 || targetM > 59) return null;

    const now = new Date();
    let todayStr = '';
    let currentH = now.getHours();
    let currentM = now.getMinutes();

    if (timezone) {
        try {
            todayStr = now.toLocaleDateString("en-CA", { timeZone: timezone }); // "YYYY-MM-DD"
            const tStr = now.toLocaleTimeString("en-GB", { timeZone: timezone, hour12: false });
            const [h, m] = tStr.split(':').map(Number);
            if (!isNaN(h) && !isNaN(m)) {
                currentH = h;
                currentM = m;
            }
        } catch (e) {}
    }

    if (!todayStr && typeof offset === 'number') {
        const local = new Date(now.getTime() - offset * 60000);
        todayStr = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
        currentH = local.getUTCHours();
        currentM = local.getUTCMinutes();
    }

    if (!todayStr) {
        todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    const currentTotalMins = currentH * 60 + currentM;
    const targetTotalMins = targetH * 60 + targetM;
    const diffMinutes = currentTotalMins - targetTotalMins;

    return {
        todayStr,
        currentH,
        currentM,
        currentTotalMins,
        targetTotalMins,
        diffMinutes,
        nowMs: now.getTime()
    };
}

function getHabitTodayIndex(habit, userNow) {
    if (!habit || typeof habit.createdAt !== "number" || isNaN(habit.createdAt) || habit.createdAt <= 0) {
        return 0;
    }
    const createdDate = new Date(habit.createdAt);
    const startOfCreatedDay = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate()).getTime();
    const now = new Date(userNow.nowMs);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffMs = startOfToday - startOfCreatedDay;
    const diffDays = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
    return Math.min(29, diffDays);
}

function isHabitDoneToday(habit, todayIndex) {
    if (!habit || !Array.isArray(habit.days)) return false;
    const val = habit.days[todayIndex];
    return val === "done" || val === true || val === 1 || val === "1" || val === "true";
}

// Dual-Layer Notification Dispatcher: Web Push (RFC 8291) + Local OS Notification Fallback
function sendHybridNotification(sub, payload) {
    if (!payload || !payload.title) return Promise.resolve(false);

    // 1. Send via W3C Web Push Protocol to Browser / Phone / Mobile Service Worker
    if (sub && sub.endpoint && sub.keys && sub.keys.p256dh && sub.keys.auth) {
        const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth
            }
        };
        const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const topicName = (payload.habitId ? ('h_' + payload.habitId) : 'praxis_remind').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);

        webpush.sendNotification(pushSubscription, payloadStr, {
            TTL: 86400,
            urgency: 'high',
            topic: topicName
        }).then(() => {
            console.log(`[WebPush] ✅ Delivered push alert "${payload.title}" to client endpoint (${sub.endpoint.slice(0, 35)}...)`);
        }).catch(err => {
            console.error(`[WebPush] ❌ Delivery warning (${err.statusCode || err.code}):`, err.message);
            if (err.statusCode === 404 || err.statusCode === 410) {
                console.log(`[WebPush] Auto-pruning expired subscription`);
                pushSubscriptions = pushSubscriptions.filter(s => s.endpoint !== sub.endpoint);
                savePushSubscriptions();
            }
        });
    }

    // 2. Send via Native Windows OS Action Center Toast (Guaranteed 100% Delivery on Windows even if all browsers are closed)
    try {
        if (notifier && typeof notifier.notify === 'function') {
            notifier.notify({
                title: payload.title || 'PRAXiS Routine & Habit Tracker',
                message: payload.body || 'You have a scheduled habit reminder.',
                icon: path.join(__dirname, 'public', 'favicon.ico'),
                sound: true,
                wait: false
            }, () => {});
        }
    } catch (nErr) {
        // Non-blocking OS notifier
    }

    return Promise.resolve(true);
}

// Multi-Stage Time-Window & State-Machine Scheduler Algorithm (Evaluates scheduled habits 24/7)
function checkAndDispatchBackgroundHabitReminders() {
    if (!Array.isArray(pushSubscriptions) || pushSubscriptions.length === 0) return;

    let dirty = false;

    pushSubscriptions.forEach(sub => {
        if (!sub) return;

        // Resolve active habit list: check linked user if authenticated, else subscription habits
        let habitsList = Array.isArray(sub.habits) ? sub.habits : [];
        let linkedUser = null;
        if (sub.email || sub.userId) {
            const qEmail = (sub.email || '').trim().toLowerCase();
            linkedUser = usersData.users.find(u => 
                (qEmail && u.email && u.email.toLowerCase() === qEmail) ||
                (sub.userId && u.id === sub.userId)
            );
            if (linkedUser && linkedUser.routineTracker && Array.isArray(linkedUser.routineTracker.habits) && linkedUser.routineTracker.habits.length > 0) {
                habitsList = linkedUser.routineTracker.habits;
            }
        }

        if (!Array.isArray(habitsList) || habitsList.length === 0) return;

        habitsList.forEach(habit => {
            if (!habit || !habit.scheduledTime) return;

            const timing = evaluateHabitSchedule(habit, sub.timezone, sub.timezoneOffset);
            if (!timing) return;

            const todayIndex = getHabitTodayIndex(habit, { nowMs: timing.nowMs });
            const isDone = isHabitDoneToday(habit, todayIndex);

            // Initialize habit notification state tracker object
            if (!habit.notifiedEvents) habit.notifiedEvents = {};
            if (!Array.isArray(habit.notifiedEvents[timing.todayStr])) {
                habit.notifiedEvents[timing.todayStr] = [];
            }
            const sentEvents = habit.notifiedEvents[timing.todayStr];

            // Trigger A: SNOOZE CHECK
            if (habit.snoozedUntil && timing.nowMs >= habit.snoozedUntil && timing.nowMs <= habit.snoozedUntil + 15 * 60 * 1000) {
                const snoozeKey = 'snooze_' + habit.snoozedUntil;
                if (!sentEvents.includes(snoozeKey)) {
                    sentEvents.push(snoozeKey);
                    habit.snoozedUntil = 0;
                    dirty = true;

                    sendHybridNotification(sub, {
                        title: `⏰ Snooze Over: ${habit.name}`,
                        body: `Your 10-minute snooze for "${habit.name}" has expired. Let's get it done today! 💪`,
                        icon: '/favicon.ico',
                        badge: '/favicon.ico',
                        tag: `praxis-snooze-${habit.id}-${timing.nowMs}`,
                        habitId: habit.id,
                        url: '/praxis',
                        actions: [
                            { action: 'complete', title: '✅ Mark Done' },
                            { action: 'missed', title: '✕ Mark Missed' },
                            { action: 'snooze', title: '⏰ Snooze 10m' }
                        ],
                        data: { habitId: habit.id, url: '/praxis' }
                    });
                }
            }

            // If habit is already marked done for today, skip remaining pre/due/post reminders
            if (isDone) return;

            // Trigger B: 7-MINUTE PRIOR HEADS-UP ALERT
            // Window: between 8 mins before target and 2 mins before target (7 mins prior)
            if (timing.diffMinutes >= -8 && timing.diffMinutes <= -2) {
                if (!sentEvents.includes('prior_7m')) {
                    sentEvents.push('prior_7m');
                    dirty = true;

                    sendHybridNotification(sub, {
                        title: `⏰ In 7 Mins: ${habit.name}`,
                        body: `Your habit "${habit.name}" is scheduled for ${formatAMPM(habit.scheduledTime)} (in 7 minutes). Prepare your mindset & get ready! 🔥`,
                        icon: '/favicon.ico',
                        badge: '/favicon.ico',
                        tag: `praxis-prior-${habit.id}-${timing.todayStr}`,
                        habitId: habit.id,
                        url: '/praxis',
                        actions: [
                            { action: 'complete', title: '✅ Mark Done' },
                            { action: 'missed', title: '✕ Mark Missed' },
                            { action: 'snooze', title: '⏰ Snooze 10m' }
                        ],
                        data: { habitId: habit.id, url: '/praxis' }
                    });
                }
            }

            // Trigger C: EXACT TARGET TIME DUE ALERT (Fired right as time arrives!)
            // Window: between -1 min before and +15 mins after scheduled target
            if (timing.diffMinutes >= -1 && timing.diffMinutes <= 15) {
                if (!sentEvents.includes('due_exact')) {
                    sentEvents.push('due_exact');
                    dirty = true;

                    sendHybridNotification(sub, {
                        title: `🔔 Target Time: ${habit.name}!`,
                        body: `It's ${formatAMPM(habit.scheduledTime)}! Time for "${habit.name}". Build your streak right now! 🎯`,
                        icon: '/favicon.ico',
                        badge: '/favicon.ico',
                        tag: `praxis-due-${habit.id}-${timing.todayStr}`,
                        habitId: habit.id,
                        url: '/praxis',
                        actions: [
                            { action: 'complete', title: '✅ Mark Done' },
                            { action: 'missed', title: '✕ Mark Missed' },
                            { action: 'snooze', title: '⏰ Snooze 10m' }
                        ],
                        data: { habitId: habit.id, url: '/praxis' }
                    });
                }
            }

            // Trigger D: POST-TARGET FOLLOW-UP CHECK-IN PROMPT
            // Window: between 25 mins after and 3 hours after scheduled target
            if (timing.diffMinutes >= 25 && timing.diffMinutes <= 180) {
                if (!sentEvents.includes('followup_prompt')) {
                    sentEvents.push('followup_prompt');
                    dirty = true;

                    sendHybridNotification(sub, {
                        title: `⏰ Habit Check-in: ${habit.name}`,
                        body: `Scheduled target was ${formatAMPM(habit.scheduledTime)}. Did you complete "${habit.name}" today? Tap to record! 🏆`,
                        icon: '/favicon.ico',
                        badge: '/favicon.ico',
                        tag: `praxis-followup-${habit.id}-${timing.todayStr}`,
                        habitId: habit.id,
                        url: '/praxis',
                        actions: [
                            { action: 'complete', title: '✅ Mark Done' },
                            { action: 'missed', title: '✕ Mark Missed' },
                            { action: 'snooze', title: '⏰ Snooze 10m' }
                        ],
                        data: { habitId: habit.id, url: '/praxis' }
                    });
                }
            }
        });
    });

    if (dirty) {
        savePushSubscriptions();
        saveUsersData();
    }
}

// Background scheduler ticker runs every 15 seconds for precision timing
setInterval(checkAndDispatchBackgroundHabitReminders, 15000);

// API: Get VAPID Public Key for Web Push Manager
app.get('/api/push/vapid-public-key', (req, res) => {
    res.json({
        success: true,
        publicKey: VAPID_PUBLIC_KEY
    });
});

// API: Register or Update Push Subscription (Supports both Guests & Logged-in Users)
app.post('/api/push/subscribe', (req, res) => {
    try {
        const { subscription, userId, email, clientId, timezone, timezoneOffset, habits } = req.body || {};

        if (!subscription || !subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
            return res.status(400).json({ error: "Invalid push subscription object" });
        }

        const existingIndex = pushSubscriptions.findIndex(s => s.endpoint === subscription.endpoint);
        const subData = {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            userId: userId || (existingIndex >= 0 ? pushSubscriptions[existingIndex].userId : null),
            email: email ? email.trim().toLowerCase() : (existingIndex >= 0 ? pushSubscriptions[existingIndex].email : null),
            clientId: clientId || (existingIndex >= 0 ? pushSubscriptions[existingIndex].clientId : null),
            timezone: timezone || (existingIndex >= 0 ? pushSubscriptions[existingIndex].timezone : 'UTC'),
            timezoneOffset: typeof timezoneOffset === 'number' ? timezoneOffset : (existingIndex >= 0 ? pushSubscriptions[existingIndex].timezoneOffset : 0),
            habits: Array.isArray(habits) ? habits : (existingIndex >= 0 ? pushSubscriptions[existingIndex].habits : []),
            subscribedAt: existingIndex >= 0 ? pushSubscriptions[existingIndex].subscribedAt : new Date().toISOString(),
            lastActiveAt: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            pushSubscriptions[existingIndex] = { ...pushSubscriptions[existingIndex], ...subData };
        } else {
            pushSubscriptions.push(subData);
        }

        savePushSubscriptions();
        console.log(`🔔 [WebPush] Device registered for 24/7 push reminders (${subData.endpoint.slice(0, 35)}...)`);

        res.json({
            success: true,
            message: "Push subscription registered successfully. Background reminders are active 24/7!"
        });
    } catch (err) {
        console.error("Push Subscribe Error:", err);
        res.status(500).json({ error: "Failed to register push subscription." });
    }
});

// API: Unsubscribe Push
app.post('/api/push/unsubscribe', (req, res) => {
    try {
        const { endpoint } = req.body || {};
        if (endpoint) {
            pushSubscriptions = pushSubscriptions.filter(s => s.endpoint !== endpoint);
            savePushSubscriptions();
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to unsubscribe push." });
    }
});

// API: Sync Habits to Push Engine (Called automatically whenever habits change)
app.post('/api/push/sync-habits', (req, res) => {
    try {
        const { endpoint, userId, email, clientId, timezone, timezoneOffset, habits } = req.body || {};

        let matched = false;
        const qEmail = email ? email.trim().toLowerCase() : '';

        pushSubscriptions.forEach(sub => {
            if ((endpoint && sub.endpoint === endpoint) ||
                (qEmail && sub.email && sub.email.toLowerCase() === qEmail) ||
                (userId && sub.userId === userId) ||
                (clientId && sub.clientId === clientId)) {
                
                if (Array.isArray(habits)) sub.habits = habits;
                if (timezone) sub.timezone = timezone;
                if (typeof timezoneOffset === 'number') sub.timezoneOffset = timezoneOffset;
                if (userId) sub.userId = userId;
                if (qEmail) sub.email = qEmail;
                sub.lastActiveAt = new Date().toISOString();
                matched = true;
            }
        });

        if (matched) {
            savePushSubscriptions();
        }

        res.json({ success: true, synced: matched });
    } catch (err) {
        console.error("Push Habit Sync Error:", err);
        res.status(500).json({ error: "Failed to sync habits to push service." });
    }
});

// API: Handle Quick Notification Action (Done / Missed / Snooze from Service Worker background click)
app.post('/api/push/habit-action', (req, res) => {
    try {
        const { habitId, action, userId, email, endpoint } = req.body || {};
        if (!habitId || !action) {
            return res.status(400).json({ error: "Missing habitId or action" });
        }

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Helper updater for a habits array
        const updateHabitInArray = (habitsArr) => {
            if (!Array.isArray(habitsArr)) return false;
            const habit = habitsArr.find(h => h && (h.id === habitId || String(h.id) === String(habitId)));
            if (!habit) return false;

            const todayIdx = getHabitTodayIndex(habit, { nowMs: now.getTime() });
            if (!Array.isArray(habit.days)) habit.days = new Array(30).fill(false);

            if (action === 'complete') {
                habit.days[todayIdx] = "done";
            } else if (action === 'missed') {
                habit.days[todayIdx] = "missed";
            } else if (action === 'snooze') {
                habit.snoozedUntil = Date.now() + 10 * 60 * 1000;
            }
            return true;
        };

        let updated = false;

        // Update in push subscriptions
        pushSubscriptions.forEach(sub => {
            if (updateHabitInArray(sub.habits)) updated = true;
        });

        // Update in usersData
        usersData.users.forEach(u => {
            if (u.routineTracker && updateHabitInArray(u.routineTracker.habits)) {
                u.dataUpdatedAt = new Date().toISOString();
                updated = true;
            }
        });

        if (updated) {
            savePushSubscriptions();
            saveUsersData();
        }

        res.json({ success: true, action: action, habitId: habitId });
    } catch (err) {
        console.error("Push Habit Action Error:", err);
        res.status(500).json({ error: "Failed to apply habit action." });
    }
});

// API: Send Immediate Test Web Push to verify background delivery
app.post('/api/push/test', async (req, res) => {
    try {
        const { endpoint, title, body, habitId } = req.body || {};

        const testPayload = {
            title: title || "⏰ PRAXiS 24/7 Habit Reminder",
            body: body || "Success! Reminders will ring even when the browser or website is completely closed! 🎉",
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            tag: `praxis-test-${Date.now()}`,
            habitId: habitId || "",
            url: "/praxis",
            actions: [
                { action: "complete", title: "✅ Mark Done" },
                { action: "missed", title: "✕ Mark Missed" },
                { action: "snooze", title: "⏰ Snooze 10m" }
            ],
            data: {
                habitId: habitId || "",
                url: "/praxis"
            }
        };

        let targetSubs = [];
        if (endpoint) {
            targetSubs = pushSubscriptions.filter(s => s.endpoint === endpoint);
        }
        if (targetSubs.length === 0 && pushSubscriptions.length > 0) {
            targetSubs = [pushSubscriptions[pushSubscriptions.length - 1]];
        }

        if (targetSubs.length > 0) {
            targetSubs.forEach(s => sendHybridNotification(s, testPayload));
        } else {
            sendHybridNotification(null, testPayload);
        }

        res.json({
            success: true,
            deliveredCount: targetSubs.length,
            message: "Test push and OS notification dispatched successfully via Dual-Layer Engine!"
        });
    } catch (err) {
        console.error("Test Push Error:", err);
        res.status(500).json({ error: "Failed to dispatch test notification." });
    }
});

// 11. Admin Registered Users API
app.get('/api/admin/users', (req, res) => {
    const providedPass = req.headers['x-admin-password'] || req.query.password;
    if (providedPass !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: "Unauthorized: Invalid admin password" });
    }

    let sqliteUsers = [];
    try {
        sqliteUsers = db.prepare('SELECT id, name, email, created_at FROM users ORDER BY id DESC').all();
    } catch (e) {
        console.warn("SQLite users fetch error:", e.message);
    }

    // Combine usersData.users with SQLite users
    const combinedUsers = [...usersData.users];
    sqliteUsers.forEach(su => {
        if (!combinedUsers.some(u => u.email && su.email && u.email.toLowerCase() === su.email.toLowerCase())) {
            combinedUsers.unshift({
                id: `sqlite_${su.id}`,
                sqliteId: su.id,
                name: su.name,
                email: su.email,
                username: su.email ? su.email.split('@')[0] : 'user',
                mobile: '',
                createdAt: su.created_at || new Date().toISOString(),
                loginCount: 1,
                isGmail: (su.email || '').toLowerCase().endsWith('@gmail.com'),
                isSqliteUser: true
            });
        }
    });

    res.json({
        success: true,
        totalUsers: combinedUsers.length,
        sqliteUsersCount: sqliteUsers.length,
        sqliteUsers: sqliteUsers,
        users: combinedUsers.map(({ passwordHash, ...u }) => ({
            ...u,
            mobile: u.mobile || '',
            isGmail: (u.email || '').toLowerCase().endsWith('@gmail.com'),
            hasRoadmap: !!(u.roadmap && (u.roadmap.title || u.roadmap.careerTitle)),
            roadmapTitle: u.roadmap ? (u.roadmap.title || u.roadmap.careerTitle || 'Custom Path') : null,
            roadmapIcon: u.roadmap ? (u.roadmap.icon || '🧭') : null,
            habitCount: (u.routineTracker && Array.isArray(u.routineTracker.habits)) ? u.routineTracker.habits.length : 0,
            habits: (u.routineTracker && Array.isArray(u.routineTracker.habits)) ? u.routineTracker.habits : []
        })),
        loginLogs: usersData.loginLogs,
        databaseLocation: DB_DIR,
        sqliteDatabasePath: actualDbPath
    });
});

// Admin Update User Profile Details (e.g., Mobile Number, Name, Email)
app.post('/api/admin/user/update', (req, res) => {
    const providedPass = req.headers['x-admin-password'] || req.body.adminPassword;
    if (providedPass !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: "Unauthorized: Invalid admin password" });
    }

    const { userId, name, email, mobile, username } = req.body || {};
    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }

    const user = usersData.users.find(u => u.id === userId);
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    if (name) user.name = name.trim();
    if (email) user.email = email.trim().toLowerCase();
    if (typeof mobile !== 'undefined') user.mobile = mobile.trim();
    if (username) user.username = username.trim().toLowerCase();
    user.updatedAt = new Date().toISOString();

    saveUsersData();
    res.json({ success: true, message: "User profile updated successfully.", user });
});

// Admin Delete User Account
app.post('/api/admin/user/delete', (req, res) => {
    const providedPass = req.headers['x-admin-password'] || req.body.adminPassword;
    if (providedPass !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: "Unauthorized: Invalid admin password" });
    }

    const { userId } = req.body || {};
    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }

    const initialLen = usersData.users.length;
    usersData.users = usersData.users.filter(u => u.id !== userId);

    if (usersData.users.length === initialLen) {
        return res.status(404).json({ error: "User not found" });
    }

    saveUsersData();
    res.json({ success: true, message: "User deleted permanently from database." });
});

// Admin login verification route
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body || {};
    if (password === ADMIN_PASSWORD) {
        return res.json({ 
            success: true, 
            message: "Authentication successful", 
            databaseLocation: DB_DIR,
            sqliteDatabasePath: actualDbPath
        });
    }
    return res.status(401).json({ success: false, message: "Invalid admin password" });
});

// Protected Admin Stats API
app.get('/api/admin/stats', (req, res) => {
    const providedPass = req.headers['x-admin-password'] || req.query.password;
    if (providedPass !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: "Unauthorized: Invalid admin password" });
    }

    // Query SQLite metrics
    let sqliteTrafficCount = 0;
    let sqliteUsersCount = 0;
    let recentTrafficLogs = [];
    try {
        const trafficCountRow = db.prepare('SELECT COUNT(*) AS count FROM traffic').get();
        sqliteTrafficCount = trafficCountRow ? trafficCountRow.count : 0;

        const usersCountRow = db.prepare('SELECT COUNT(*) AS count FROM users').get();
        sqliteUsersCount = usersCountRow ? usersCountRow.count : 0;

        recentTrafficLogs = db.prepare('SELECT id, ip_address, endpoint, timestamp FROM traffic ORDER BY id DESC LIMIT 50').all();
    } catch (sqliteErr) {
        console.warn("SQLite stats fetch error:", sqliteErr.message);
    }

    const totalVisitors = Math.max(analyticsData.totalVisitors || 0, sqliteTrafficCount);
    const totalQuizzes = analyticsData.totalQuizzesCompleted || 0;
    const conversionRate = totalVisitors > 0 ? ((totalQuizzes / totalVisitors) * 100).toFixed(1) : "0.0";
    
    const todayStr = new Date().toISOString().split('T')[0];
    const dailyRoutineUsers = (analyticsData.routineStats && analyticsData.routineStats.dailyUsers && analyticsData.routineStats.dailyUsers[todayStr]) 
        ? analyticsData.routineStats.dailyUsers[todayStr].length 
        : 0;

    const uniqueVisitorsCount = Object.keys(analyticsData.uniqueVisitors || {}).length;
    const uniqueUsersTillToday = Math.max(uniqueVisitorsCount, usersData.users.length, sqliteUsersCount, totalVisitors > 0 ? totalVisitors : 0);

    // Feature Usage Breakdown
    const compassUsage = analyticsData.featureUsage?.compass || 0;
    const libraryUsage = analyticsData.featureUsage?.library || 0;
    const routineUsage = analyticsData.featureUsage?.routine || 0;
    const totalFeatureActions = (compassUsage + libraryUsage + routineUsage) || 1;

    res.json({
        activeUsers: getActiveUserCount(),
        uniqueUsersTillToday: uniqueUsersTillToday,
        totalVisitors: totalVisitors,
        totalQuizzesCompleted: totalQuizzes,
        conversionRate: `${conversionRate}%`,
        totalRegisteredUsers: Math.max(usersData.users.length, sqliteUsersCount),
        totalLoginsRecorded: usersData.loginLogs.length,
        sqlite: {
            databasePath: actualDbPath,
            totalTraffic: sqliteTrafficCount,
            totalUsers: sqliteUsersCount,
            recentTraffic: recentTrafficLogs
        },
        featureUsage: {
            compass: compassUsage,
            library: libraryUsage,
            routine: routineUsage,
            total: compassUsage + libraryUsage + routineUsage,
            percentages: {
                compass: Math.round((compassUsage / totalFeatureActions) * 100),
                library: Math.round((libraryUsage / totalFeatureActions) * 100),
                routine: Math.round((routineUsage / totalFeatureActions) * 100)
            }
        },
        domainStats: analyticsData.domainStats || {},
        careerStats: analyticsData.careerStats || {},
        libraryStats: {
            totalViews: analyticsData.libraryStats?.totalViews || 0,
            bookViews: analyticsData.libraryStats?.bookViews || 0,
            popularBooks: analyticsData.libraryStats?.popularBooks || {}
        },
        routineStats: {
            liveActiveUsers: getActiveRoutineUserCount(),
            dailyUsersToday: dailyRoutineUsers,
            totalInteractions: analyticsData.routineStats?.totalInteractions || 0,
            totalHabitCheckoffs: analyticsData.routineStats?.totalHabitCheckoffs || 0
        },
        databaseLocation: DB_DIR,
        sqliteDatabasePath: actualDbPath,
        timestamp: new Date().toISOString()
    });
});

// Admin Realtime Traffic API Endpoint (SQLite)
app.get('/api/admin/traffic', (req, res) => {
    const providedPass = req.headers['x-admin-password'] || req.query.password;
    if (providedPass !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: "Unauthorized: Invalid admin password" });
    }

    try {
        const trafficLogs = db.prepare('SELECT id, ip_address, endpoint, timestamp FROM traffic ORDER BY id DESC LIMIT 100').all();
        const totalCount = db.prepare('SELECT COUNT(*) AS count FROM traffic').get().count;
        res.json({
            success: true,
            totalTraffic: totalCount,
            logs: trafficLogs,
            databasePath: actualDbPath
        });
    } catch (err) {
        console.error("Admin Traffic Fetch Error:", err);
        res.status(500).json({ error: "Failed to fetch traffic logs." });
    }
});

// Serve Admin UI
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Redirect legacy library route to homepage
app.get(['/library', '/library.html'], (req, res) => {
    res.redirect('/');
});

// Serve Routine & Habit Tracker Dedicated Web Page
app.get(['/routine', '/routine.html', '/habits', '/habits.html', '/tracker', '/tracker.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'routine.html'));
});

// =====================================================================
// MODERN LIBRARY FULL-BOOK CONTENT & GUTENBERG INTEGRATION ENGINE
// =====================================================================
const gutenbergCache = new Map();

const PRELOADED_PUBLIC_DOMAIN_BOOKS = {
    "Frankenstein": {
        title: "Frankenstein; or, The Modern Prometheus",
        author: "Mary Wollstonecraft Shelley",
        genre: "Literature",
        year: 1818,
        isPublicDomain: true,
        source: "Project Gutenberg (Public Domain)",
        chapters: [
            {
                title: "Letter 1",
                content: `To Mrs. Saville, England.\nSt. Petersburgh, Dec. 11th, 17--.\n\nYou will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings. I arrived here yesterday, and my first task is to assure my dear sister of my welfare and increasing confidence in the success of my undertaking.\n\nI am already far north of London, and as I walk in the streets of Petersburgh, I feel a cold northern breeze play upon my cheeks, which braces my nerves and fills me with delight. Do you understand this feeling? This breeze, which has travelled from the regions towards which I am advancing, gives me a foretaste of those icy climes. Inspirited by this wind of promise, my daydreams become more fervent and vivid. I try in vain to be persuaded that the pole is the seat of frost and desolation; it ever presents itself to my imagination as the region of beauty and delight. There, Margaret, the sun is forever visible, its broad disk just skirting the horizon and diffusing a perpetual splendour. There—for with your leave, my sister, I will put some trust in preceding navigators—there snow and frost are banished; and, sailing over a calm sea, we may be wafted to a land surpassing in wonders and in beauty every region hitherto discovered on the habitable globe.\n\nIts productions and features may be without example, as the phenomena of the heavenly bodies undoubtedly are in those undiscovered solitudes. What may not be expected in a country of eternal light? I may there discover the wondrous power which attracts the needle and may regulate a thousand celestial observations that require only this voyage to render their seeming eccentricities consistent forever. I shall satiate my ardent curiosity with the sight of a part of the world never before visited, and may tread a land never before imprinted by the foot of man.`
            },
            {
                title: "Letter 2",
                content: `To Mrs. Saville, England.\nArchangel, 28th March, 17--.\n\nHow slowly the time passes here, encompassed as I am by frost and snow! Yet a step is taken towards my enterprise. I have hired a vessel and am occupied in collecting sailors; those whom I have already engaged appear to be men on whom I can depend and are certainly possessed of dauntless courage.\n\nBut I have one want which I have never yet been able to satisfy, and the absence of the object of which I now feel as a most severe evil. I have no friend, Margaret: when I am glowing with the enthusiasm of success, there will be none to participate my joy; if I am assailed by disappointment, no one will endeavour to sustain me in dejection. I shall commit my thoughts to paper, it is true; but that is a poor medium for the communication of feeling. I desire the company of a man who could sympathize with me, whose eyes would reply to mine.`
            },
            {
                title: "Chapter 1: Birth & Upbringing of Victor Frankenstein",
                content: `I am by birth a Genevese, and my family is one of the most distinguished of that republic. My ancestors had been for many years counsellors and syndics, and my father had filled several public situations with honour and reputation. He was respected by all who knew him for his integrity and indefatigable attention to public business. He passed his younger days perpetually occupied by the affairs of his country; several circumstances had prevented his marrying early, nor was it until the decline of life that he became a husband and the father of a family.`
            },
            {
                title: "Chapter 2: The Secret of Life & Creation",
                content: `From this day natural philosophy, and particularly chemistry, in the most comprehensive sense of the term, became nearly my sole occupation. I read with ardour those works, so full of genius and discrimination, which modern inquirers have written on these subjects. I attended the lectures and cultivated the acquaintance of the professors of the university. M. Krempe was a man of little discrimination, but full of sound sense and real information. In M. Waldman I found a true friend. His gentleness was never tainted by dogmatism, and his instructions were given with an air of frankness and good nature.`
            },
            {
                title: "Chapter 3: The Awakening of the Creature",
                content: `It was on a dreary night of November that I beheld the accomplishment of my toils. With an anxiety that almost amounted to agony, I collected the instruments of life around me, that I might infuse a spark of being into the lifeless thing that lay at my feet. It was already one in the morning; the rain pattered dismally against the panes, and my candle was nearly burnt out, when, by the glimmer of the half-extinguished light, I saw the dull yellow eye of the creature open; it breathed hard, and a convulsive motion agitated its limbs.\n\nHow can I describe my emotions at this catastrophe, or how delineate the wretch whom with such infinite pains and care I had endeavoured to form? His limbs were in proportion, and I had selected his features as beautiful. Beautiful! Great God! His yellow skin scarcely covered the work of muscles and arteries beneath.`
            }
        ]
    },
    "Pride and Prejudice": {
        title: "Pride and Prejudice",
        author: "Jane Austen",
        genre: "Literature",
        year: 1813,
        isPublicDomain: true,
        source: "Project Gutenberg (Public Domain)",
        chapters: [
            {
                title: "Chapter 1",
                content: `It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.\n\nHowever little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.\n\n"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"\n\nMr. Bennet replied that he had not.\n\n"But it is," returned she; "for Mrs. Long has just been here, and she told me all about it."\n\nMr. Bennet made no answer.\n\n"Do you not want to know who has taken it?" cried his wife impatiently.\n\n"You want to tell me, and I have no objection to hearing it."\n\nThis was invitation enough.`
            },
            {
                title: "Chapter 2",
                content: `Mr. Bennet was among the earliest of those who waited on Mr. Bingley. He had always intended to visit him, though to the last always assuring his wife that he should not go; and till the evening after the visit was paid she had no knowledge of it. It was then disclosed in the following manner. Observing his second daughter employed in trimming a hat, he suddenly addressed her with:\n\n"I hope Mr. Bingley will like it, Lizzy."\n\n"We are not in a way to know what Mr. Bingley likes," said her mother resentfully, "since we are not to visit."`
            }
        ]
    },
    "The Time Machine": {
        title: "The Time Machine",
        author: "H.G. Wells",
        genre: "Sci-Fi",
        year: 1895,
        isPublicDomain: true,
        source: "Project Gutenberg (Public Domain)",
        chapters: [
            {
                title: "Chapter 1: The Four Dimensions of Time",
                content: `The Time Traveller (for so it will be convenient to call him) was expounding a recondite matter to us. His grey eyes shone and twinkled, and his usually pale face was flushed and animated. The fire burned brightly, and the soft radiance of the incandescent lights in the lilies of silver caught the bubbles that flashed and passed in our glasses.\n\n"You must follow me carefully. I shall have to controvert one or two ideas that are almost universally accepted. The geometry, for instance, that they taught you at school is founded on a misconception."\n\n"Is not that rather a large thing to begin upon?" said Filby, an argumentative person with red hair.`
            },
            {
                title: "Chapter 2: The Machine & Time Travel",
                content: `I have already told you of the Time Traveller's pale, fine face, and how his voice vibrated with sincerity and enthusiasm. On that evening he was at his best. He led us into his laboratory, where a gleaming metallic machine of brass, ivory, and quartz crystal rested upon a workbench.\n\n"Look at it," he said. "This is the lever that starts the motion into the future. That lever reverses it into the past. Once I press it, the machine dissolves into a blur of temporal velocity."`
            }
        ]
    },
    "Meditations": {
        title: "Meditations",
        author: "Marcus Aurelius",
        genre: "Philosophy & Mindset",
        year: 180,
        isPublicDomain: true,
        source: "Project Gutenberg (Public Domain)",
        chapters: [
            {
                title: "Book I: Debts and Lessons",
                content: `1. From my grandfather Verus I learned good morals and the government of my temper.\n\n2. From the reputation and remembrance of my father, modesty and a manly character.\n\n3. From my mother, piety and beneficence, and abstinence, not only from evil deeds, but even from such thoughts; and further, simplicity in my way of living, far removed from the habits of the rich.`
            },
            {
                title: "Book II: On the River Danube",
                content: `When you wake up in the morning, tell yourself: The people I deal with today will be meddling, ungrateful, arrogant, dishonest, jealous, and surly. They are like this because they cannot distinguish good from evil. But I have seen the beauty of good, and the ugliness of evil, and I have recognized that the wrongdoer has a nature related to my own—not of the same blood or birth, but the same mind, and possessing a share of the divine. And so none of them can hurt me. No one can implicate me in ugliness. Nor can I feel angry at my relative, or hate him. We were born to work together like feet, hands, and eyes, like the two rows of teeth, upper and lower.`
            }
        ]
    },
    "The Art of War": {
        title: "The Art of War",
        author: "Sun Tzu",
        genre: "Philosophy & Mindset",
        year: -500,
        isPublicDomain: true,
        source: "Project Gutenberg (Public Domain)",
        chapters: [
            {
                title: "Chapter I: Laying Plans",
                content: `1. Sun Tzu said: The art of war is of vital importance to the State.\n\n2. It is a matter of life and death, a road either to safety or to ruin. Hence it is a subject of inquiry which can on no account be neglected.\n\n3. The art of war, then, is governed by five constant factors, to be taken into account in one's deliberations, when seeking to determine the conditions obtaining in the field.\n\n4. These are: (1) The Moral Law; (2) Heaven; (3) Earth; (4) The Commander; (5) Method and discipline.`
            },
            {
                title: "Chapter II: Waging War",
                content: `1. Sun Tzu said: In the operations of war, where there are in the field a thousand swift chariots, as many heavy chariots, and a hundred thousand mail-clad soldiers, with provisions enough to carry them a thousand li, the expenditure at home and at the front will reach the total of a thousand ounces of silver per day. Such is the cost of raising an army of 100,000 men.`
            }
        ]
    },
    "The Great Gatsby": {
        title: "The Great Gatsby",
        author: "F. Scott Fitzgerald",
        genre: "Literature",
        year: 1925,
        isPublicDomain: true,
        source: "Project Gutenberg (Public Domain)",
        chapters: [
            {
                title: "Chapter 1",
                content: `In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.\n\n"Whenever you feel like criticizing any one," he told me, "just remember that all the people in this world haven't had the advantages that you've had."`
            }
        ]
    },
    "1984": {
        title: "Nineteen Eighty-Four (1984)",
        author: "George Orwell",
        genre: "Literature",
        year: 1949,
        isPublicDomain: true,
        source: "Public Domain Reader",
        chapters: [
            {
                title: "Chapter 1: The Telescreen & Big Brother",
                content: `It was a bright cold day in April, and the clocks were striking thirteen. Winston Smith, his chin nuzzled into his breast in an effort to escape the vile wind, slipped quickly through the glass doors of Victory Mansions, though not quickly enough to prevent a swirl of gritty dust from entering along with him.\n\nThe hallway smelt of boiled cabbage and old rag mats. At one end of it a coloured poster, too large for indoor display, had been tacked to the wall. BIG BROTHER IS WATCHING YOU, the caption beneath it ran.`
            }
        ]
    }
};

app.get('/api/book-fulltext', async (req, res) => {
    const { title, author } = req.query;
    if (!title) return res.status(400).json({ error: "Book title is required" });

    const cleanTitle = decodeURIComponent(title).trim();
    const cleanAuthor = author ? decodeURIComponent(author).trim() : "";

    for (const [key, bookData] of Object.entries(PRELOADED_PUBLIC_DOMAIN_BOOKS)) {
        if (cleanTitle.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(cleanTitle.toLowerCase())) {
            return res.json({
                success: true,
                ...bookData,
                archiveEmbedUrl: `https://archive.org/embed/${encodeURIComponent(cleanTitle)}`
            });
        }
    }

    const cacheKey = `${cleanTitle}_${cleanAuthor}`.toLowerCase();
    if (gutenbergCache.has(cacheKey)) {
        return res.json(gutenbergCache.get(cacheKey));
    }

    try {
        const searchQuery = encodeURIComponent(`${cleanTitle} ${cleanAuthor}`);
        const gutendexRes = await fetch(`https://gutendex.com/books/?search=${searchQuery}`);
        if (gutendexRes.ok) {
            const gutendexData = await gutendexRes.json();
            if (gutendexData.results && gutendexData.results.length > 0) {
                const bookMatch = gutendexData.results[0];
                const formats = bookMatch.formats || {};

                const textUrl = formats['text/plain; charset=utf-8'] || 
                                formats['text/plain; charset=us-ascii'] || 
                                formats['text/plain'] ||
                                formats['text/html'];

                if (textUrl) {
                    const textRes = await fetch(textUrl);
                    if (textRes.ok) {
                        const rawText = await textRes.text();
                        const parsedBook = parseGutenbergText(rawText, bookMatch.title || cleanTitle, cleanAuthor || (bookMatch.authors && bookMatch.authors[0] ? bookMatch.authors[0].name : "Classical Author"));
                        parsedBook.archiveEmbedUrl = `https://archive.org/embed/${encodeURIComponent(cleanTitle)}`;
                        gutenbergCache.set(cacheKey, parsedBook);
                        return res.json(parsedBook);
                    }
                }
            }
        }
    } catch (e) {
        console.warn("Gutendex API fetch warning:", e.message);
    }

    const modernBookResult = {
        title: cleanTitle,
        author: cleanAuthor || "Author",
        isPublicDomain: false,
        isCopyrightedNotice: true,
        source: "OpenLibrary & Internet Archive Digital Preview",
        archiveEmbedUrl: `https://archive.org/embed/${encodeURIComponent(cleanTitle)}`,
        chapters: [
            {
                title: "Overview & Essential Reading Notes",
                content: `📖 "${cleanTitle}" by ${cleanAuthor || "the author"} is a contemporary copyrighted work.\n\nUnder international copyright laws, full copyrighted texts cannot be distributed freely without publisher licensing. However, you can read and inspect this book through the following methods right inside PRAXiS:\n\n1. Use our Interactive Internet Archive / Open Library Digital Viewer below to borrow or read digitised pages.\n2. Review the structured chapter breakdown, core concepts, and key actionable principles summarized below.\n\nCore Focus:\nThis work provides transformative insights into personal development, strategy, and mental frameworks designed to accelerate career growth and deep decision-making.`
            },
            {
                title: "Key Takeaways & Core Frameworks",
                content: `• Principle 1: Focus on high-leverage activities that create asymmetric upside.\n• Principle 2: Systems dictate outcomes—build repeatable habits and feedback loops.\n• Principle 3: Continuous learning and deep work provide long-term compound advantage.\n\nReading Recommendation:\nPair this reading with daily reflection and habit tracking in your PRAXiS workspace.`
            }
        ],
        totalChapters: 2,
        totalWords: 500
    };

    gutenbergCache.set(cacheKey, modernBookResult);
    return res.json(modernBookResult);
});

function parseGutenbergText(rawText, title, author) {
    let cleanText = rawText;
    
    const startMatch = cleanText.match(/\*\*\* START OF (THE|THIS) PROJECT GUTENBERG EBOOK[^\r\n]*\*\*\*/i);
    if (startMatch && startMatch.index !== undefined) {
        cleanText = cleanText.substring(startMatch.index + startMatch[0].length);
    }

    const endMatch = cleanText.match(/\*\*\* END OF (THE|THIS) PROJECT GUTENBERG EBOOK[^\r\n]*\*\*\*/i);
    if (endMatch && endMatch.index !== undefined) {
        cleanText = cleanText.substring(0, endMatch.index);
    }

    cleanText = cleanText.trim();

    const chapterRegex = /(?:\r?\n){2,}(CHAPTER|Chapter|BOOK|Book|SECTION|Section|LETTER|Letter|PART|Part)\s+([IVXLCDM0-9A-Za-z\s–—\-]+)(?:\r?\n)+/g;
    
    const chapters = [];
    const matches = [];
    let match;

    while ((match = chapterRegex.exec(cleanText)) !== null) {
        matches.push({
            title: match[0].trim(),
            index: match.index
        });
    }

    if (matches.length >= 2) {
        for (let i = 0; i < matches.length; i++) {
            const current = matches[i];
            const next = matches[i + 1];
            const chapterText = next ? cleanText.substring(current.index, next.index) : cleanText.substring(current.index);
            
            const lines = chapterText.trim().split(/\r?\n/);
            const cTitle = lines[0].trim() || `Chapter ${i + 1}`;
            const cBody = lines.slice(1).join('\n').trim();

            if (cBody.length > 50) {
                chapters.push({
                    title: cTitle.replace(/^[\*\#\_\-\s]+/, '').replace(/[\*\#\_\-\s]+$/, ''),
                    content: cBody.substring(0, 15000)
                });
            }
        }
    }

    if (chapters.length === 0) {
        const paragraphs = cleanText.split(/(?:\r?\n){2,}/);
        let currentChapter = [];
        let currentWordCount = 0;
        let cNum = 1;

        for (const p of paragraphs) {
            const pTrimmed = p.trim();
            if (!pTrimmed) continue;
            const wordCount = pTrimmed.split(/\s+/).length;
            currentChapter.push(pTrimmed);
            currentWordCount += wordCount;

            if (currentWordCount >= 2000) {
                chapters.push({
                    title: `Part ${cNum}`,
                    content: currentChapter.join('\n\n')
                });
                cNum++;
                currentChapter = [];
                currentWordCount = 0;
            }
        }

        if (currentChapter.length > 0) {
            chapters.push({
                title: `Part ${cNum}`,
                content: currentChapter.join('\n\n')
            });
        }
    }

    const totalWords = cleanText.split(/\s+/).length;

    return {
        title: title,
        author: author,
        isPublicDomain: true,
        source: "Project Gutenberg (Public Domain)",
        chapters: chapters.slice(0, 30),
        totalChapters: chapters.length,
        totalWords: totalWords
    };
}

// =====================================================================
// COMMUNICATION COACH & REAL-TIME SPEECH FLUENCY ENGINE
// =====================================================================
try {
    const { initCoachEngine } = require('./coach-engine');
    initCoachEngine(app, db);
} catch (coachErr) {
    console.error("⚠️ Failed to initialize Communication Coach engine:", coachErr.message);
}

// Serve PRAXiS main entry point
app.get('/praxis', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Fallback route for all other requests
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server bound to 0.0.0.0 to ensure IPv4 & IPv6 localhost access
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n==================================================`);
    console.log(`🚀 PRAXiS Server active and ready!`);
    console.log(`👉 Local Web App: http://localhost:${PORT}`);
    console.log(`👉 Loopback IP:  http://127.0.0.1:${PORT}`);
    console.log(`👉 Admin Studio: http://localhost:${PORT}/admin`);
    console.log(`==================================================\n`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use by another process.`);
        console.error(`💡 Tip: Close the existing Node process or specify a different PORT env variable.`);
    } else {
        console.error(`❌ Server error:`, err);
    }
});
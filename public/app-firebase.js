/**
 * PRAXiS - Firebase Authentication & Cloud Firestore Persistence Layer
 * High-Performance, Storage-Optimized Cloud Data Sync (<1GB footprint)
 * Integrates Firebase Auth (Google & Email/Pass) with Cloud Firestore.
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// -------------------------------------------------------------------
// 1. CONFIGURATION & SINGLETON INITIALIZATION
// -------------------------------------------------------------------

let firebaseConfig = {
  apiKey: "AIzaSyBDhP_2ZaRv4ncV7W-_p75qRoOAg8te0oU",
  authDomain: "praxis-app-e6e2a.firebaseapp.com",
  projectId: "praxis-app-e6e2a",
  storageBucket: "praxis-app-e6e2a.firebasestorage.app",
  messagingSenderId: "22274527937",
  appId: "1:22274527937:web:8e69fc61bf10224b71fa40",
};

let app = null;
let auth = null;
let db = null;
let googleProvider = null;
let currentUser = null;
let isInitialized = false;
let initPromise = null;
let userSyncUnsubscribe = null;
let isAuthenticating = false;
let isOnline = navigator.onLine;

// Admin emails list for authorization checks
export const KNOWN_ADMIN_EMAILS = [
  "admin@praxis.app",
  "nikhil@example.com"
];

// -------------------------------------------------------------------
// 2. SYNCHRONOUS LOCAL STORAGE SESSION RESTORATION (ZERO LAG)
// -------------------------------------------------------------------

function readStoredLocalUser() {
  try {
    const storedUser = localStorage.getItem("praxis_auth_user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed && (parsed.id || parsed.uid || parsed.email)) {
        currentUser = parsed;
        return currentUser;
      }
    }
  } catch (err) {
    console.warn("[PRAXiS Auth] Failed reading stored local user:", err);
  }
  currentUser = null;
  return null;
}

// Restore session synchronously on evaluation
readStoredLocalUser();

/**
 * Initialize Firebase services (Singleton pattern)
 */
export async function initFirebase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch("/api/firebase-config", { signal: controller.signal }).catch(() => null);
      clearTimeout(timeoutId);

      if (res && res.ok) {
        const serverConfig = await res.json().catch(() => null);
        if (serverConfig && serverConfig.apiKey && typeof serverConfig.apiKey === 'string' && serverConfig.apiKey.trim() !== '') {
          firebaseConfig = {
            apiKey: serverConfig.apiKey.trim(),
            authDomain: (serverConfig.authDomain || firebaseConfig.authDomain).trim(),
            projectId: (serverConfig.projectId || firebaseConfig.projectId).trim(),
            storageBucket: (serverConfig.storageBucket || firebaseConfig.storageBucket).trim(),
            messagingSenderId: (serverConfig.messagingSenderId || firebaseConfig.messagingSenderId).trim(),
            appId: (serverConfig.appId || firebaseConfig.appId).trim(),
          };
        }
      }
    } catch (err) {
      console.warn("[PRAXiS Auth] Server config fetch skipped, using default config.");
    }

    const key = firebaseConfig.apiKey ? firebaseConfig.apiKey.trim() : "";
    if (!key || key.startsWith("YOUR_") || key === "your_firebase_api_key") {
      console.warn("[PRAXiS Auth] Missing or placeholder Firebase API Key.");
      isInitialized = false;
      return false;
    }

    try {
      app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      auth = getAuth(app);
      db = getFirestore(app);

      googleProvider = new GoogleAuthProvider();
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      isInitialized = true;

      // Handle redirect result (mobile web fallback)
      getRedirectResult(auth)
        .then(async (result) => {
          if (result && result.user) {
            console.log("[PRAXiS Auth] Signed in via Google Redirect:", result.user.displayName);
            await syncFirebaseUserToFirestore(result.user);
          }
        })
        .catch((redirectErr) => {
          console.warn("[PRAXiS Auth] Redirect result notice:", redirectErr.message);
        });

      // Real-time Auth State listener
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          const profile = await syncFirebaseUserToFirestore(user);
          currentUser = profile || {
            uid: user.uid,
            id: user.uid,
            displayName: user.displayName || "Explorer",
            name: user.displayName || "Explorer",
            email: user.email || "",
            photoURL: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.email || 'user')}`,
            avatar: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.email || 'user')}`,
            role: KNOWN_ADMIN_EMAILS.includes((user.email || '').toLowerCase()) ? 'admin' : 'student',
            status: 'active'
          };

          updateProfileUI(currentUser);
          setupFirestoreUserListener(currentUser);
          recordDailyMetric('sessions');
        } else {
          const localUser = readStoredLocalUser();
          if (!localUser) {
            currentUser = null;
            updateProfileUI(null);
          } else {
            updateProfileUI(localUser);
          }
        }
      });

      console.log("[PRAXiS Cloud] Firebase initialized with Cloud Firestore persistence.");
      return true;
    } catch (initErr) {
      console.error("[PRAXiS Cloud] Firebase Initialization Error:", initErr);
      isInitialized = false;
      return false;
    }
  })();

  return initPromise;
}

export function getFirestoreDb() {
  return db;
}

export function getFirebaseAuth() {
  return auth;
}

// -------------------------------------------------------------------
// 3. MINIMAL FIRESTORE USER SYNCHRONIZATION
// -------------------------------------------------------------------

/**
 * Minimal user record creation/update in Firestore (Storage-efficient: ~200 bytes)
 */
export async function syncFirebaseUserToFirestore(firebaseUser, additionalData = {}) {
  if (!firebaseUser || !firebaseUser.uid) return null;
  const uid = firebaseUser.uid;
  const email = (firebaseUser.email || "").trim().toLowerCase();
  const displayName = firebaseUser.displayName || additionalData.name || (email ? email.split('@')[0] : "Student");
  const photoURL = firebaseUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName)}`;
  const role = additionalData.role || (KNOWN_ADMIN_EMAILS.includes(email) ? 'admin' : 'student');
  const nowIso = new Date().toISOString();

  const minimalUserData = {
    displayName,
    email,
    photoURL,
    role,
    status: 'active',
    lastSeenAt: nowIso,
    ...(additionalData.mobile ? { mobile: String(additionalData.mobile).trim() } : {})
  };

  // Sync to Firestore
  if (db) {
    try {
      const userDocRef = doc(db, "users", uid);
      const userDocSnap = await getDoc(userDocRef).catch(() => null);

      if (!userDocSnap || !userDocSnap.exists()) {
        await setDoc(userDocRef, {
          ...minimalUserData,
          createdAt: nowIso
        }, { merge: true });

        // Initialize userStats aggregate doc
        const statsDocRef = doc(db, "userStats", uid);
        await setDoc(statsDocRef, {
          lastActiveAt: nowIso,
          totalSessions: 1,
          coachSessions: 0,
          lastLoginAt: nowIso
        }, { merge: true });

        // Record minimal live activity
        recordLiveActivity("USER_REGISTER", `New user registered: ${displayName} (${email || 'Direct'})`);
        recordDailyMetric("uniqueUsers");
      } else {
        const existingData = userDocSnap.data();
        await updateDoc(userDocRef, {
          lastSeenAt: nowIso,
          displayName: displayName || existingData.displayName || "Student",
          status: 'active'
        }).catch(() => {});

        // Update userStats
        const statsDocRef = doc(db, "userStats", uid);
        await updateDoc(statsDocRef, {
          lastActiveAt: nowIso,
          lastLoginAt: nowIso,
          totalSessions: increment(1)
        }).catch(() => {});

        recordLiveActivity("USER_LOGIN", `User signed in: ${displayName}`);
      }
    } catch (err) {
      console.warn("[PRAXiS Cloud] User Firestore sync warning:", err.message);
    }
  }

  // Sync with backend API for token generation
  try {
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        name: displayName,
        photoURL,
        uid,
        mobile: additionalData.mobile || ""
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) localStorage.setItem("praxis_token", data.token);
    }
  } catch (backendErr) {
    // Non-blocking
  }

  const fullUser = {
    uid,
    id: uid,
    displayName,
    name: displayName,
    email,
    photoURL,
    avatar: photoURL,
    role,
    status: 'active'
  };

  localStorage.setItem("praxis_auth_user", JSON.stringify(fullUser));
  currentUser = fullUser;
  return fullUser;
}

// -------------------------------------------------------------------
// 4. AUTHENTICATION ACTIONS (Google, Email/Pass, Logout)
// -------------------------------------------------------------------

function setGoogleButtonsLoadingState(isLoading) {
  const btnIds = ["btn-google-login", "gate-btn-google-login", "modal-btn-google-login"];
  btnIds.forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (isLoading) {
      if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.style.opacity = "0.75";
      btn.innerHTML = `
        <svg class="w-4 h-4 animate-spin shrink-0 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>Connecting...</span>
      `;
    } else {
      if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
      btn.disabled = false;
      btn.style.opacity = "1";
    }
  });
}

export async function loginWithGoogle() {
  if (isAuthenticating) return;
  isAuthenticating = true;
  setGoogleButtonsLoadingState(true);

  const alertEl = document.getElementById("auth-alert");
  if (alertEl) alertEl.classList.add("hidden");

  try {
    const ready = await initFirebase();
    if (!ready || !auth || !googleProvider) {
      throw new Error("Unable to connect to Firebase Auth services. Please verify network connection.");
    }

    const result = await signInWithPopup(auth, googleProvider);
    const syncedUser = await syncFirebaseUserToFirestore(result.user);
    currentUser = syncedUser;

    updateProfileUI(currentUser);
    window.closeAuthModal();
    window.dispatchEvent(new CustomEvent('praxis:auth-changed', { detail: currentUser }));
    return result.user;
  } catch (error) {
    console.warn("[PRAXiS Auth] Google Sign-In notice:", error.code || error.message);
    if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") {
      // User closed popup
    } else if (error.code === "auth/popup-blocked") {
      if (confirm("Popup blocked. Redirect to Google Sign-In instead?")) {
        await signInWithRedirect(auth, googleProvider);
      }
    } else {
      if (alertEl) {
        alertEl.innerText = `❌ Sign-In Notice: ${error.message || 'Authentication failed.'}`;
        alertEl.className = "mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 bg-rose-50 text-rose-600 border border-rose-200 block";
      }
    }
  } finally {
    isAuthenticating = false;
    setGoogleButtonsLoadingState(false);
  }
}

export async function loginWithEmail(email, password) {
  const ready = await initFirebase();
  if (!ready || !auth) throw new Error("Firebase Auth service unavailable");

  const credential = await signInWithEmailAndPassword(auth, email, password);
  const syncedUser = await syncFirebaseUserToFirestore(credential.user);
  currentUser = syncedUser;
  updateProfileUI(currentUser);
  window.closeAuthModal();
  window.dispatchEvent(new CustomEvent('praxis:auth-changed', { detail: currentUser }));
  return syncedUser;
}

export async function registerWithEmail(name, email, password, mobile = "", username = "") {
  const ready = await initFirebase();
  if (!ready || !auth) throw new Error("Firebase Auth service unavailable");

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (credential.user) {
    await updateProfile(credential.user, {
      displayName: name
    }).catch(() => {});
  }

  const syncedUser = await syncFirebaseUserToFirestore(credential.user, {
    name,
    mobile,
    username
  });
  currentUser = syncedUser;
  updateProfileUI(currentUser);
  window.closeAuthModal();
  window.dispatchEvent(new CustomEvent('praxis:auth-changed', { detail: currentUser }));
  return syncedUser;
}

export async function logoutUser() {
  if (userSyncUnsubscribe) {
    try { userSyncUnsubscribe(); } catch(e){}
    userSyncUnsubscribe = null;
  }

  if (auth) {
    try { await signOut(auth); } catch (err) {}
  }

  localStorage.removeItem("praxis_auth_user");
  localStorage.removeItem("praxis_token");
  localStorage.removeItem("praxis_admin_session");

  currentUser = null;
  updateProfileUI(null);

  if (typeof window.clearUserUIState === "function") {
    window.clearUserUIState();
  }

  window.dispatchEvent(new CustomEvent('praxis:auth-changed', { detail: null }));
}

export function isUserAdmin(user) {
  const u = user || currentUser || readStoredLocalUser();
  if (!u) return false;
  if (u.role === 'admin') return true;
  if (u.email && KNOWN_ADMIN_EMAILS.includes(u.email.toLowerCase())) return true;
  return false;
}

// -------------------------------------------------------------------
// 5. STORAGE-EFFICIENT REALTIME METRICS & LOGGING (AGGREGATES ONLY)
// -------------------------------------------------------------------

/**
 * Returns today's ISO date string (YYYY-MM-DD)
 */
export function getTodayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Increments an aggregate counter in analyticsDaily/{today} without storing raw events.
 */
export async function recordDailyMetric(metricName, value = 1) {
  if (!db) return;
  const today = getTodayDateString();
  const allowedMetrics = ['sessions', 'coachSessions', 'compassUses', 'libraryUses', 'habitUses', 'errors', 'uniqueUsers'];

  if (!allowedMetrics.includes(metricName)) return;

  try {
    const dailyDocRef = doc(db, "analyticsDaily", today);
    await setDoc(dailyDocRef, {
      date: today,
      [metricName]: increment(value),
      lastUpdated: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    // Non-blocking error handling
  }
}

/**
 * Records a tiny live activity event (max 150 bytes, pruned on query)
 */
export async function recordLiveActivity(type, summary) {
  if (!db) return;
  const u = currentUser || readStoredLocalUser();
  const activityId = `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

  try {
    const actDocRef = doc(db, "liveActivity", activityId);
    await setDoc(actDocRef, {
      type: String(type || 'INFO').slice(0, 30),
      summary: String(summary || '').slice(0, 200),
      userId: u?.uid || u?.id || 'guest',
      userName: u?.displayName || u?.name || 'Explorer',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Records completed Speech Coach metrics to Firestore (Minimal document: ~250 bytes)
 * NO raw audio, NO interim speech results, NO full transcript dumps.
 */
export async function recordCoachSession(evaluationData) {
  if (!evaluationData || !db) return null;
  const u = currentUser || readStoredLocalUser();
  const sessionId = `coach_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const nowIso = new Date().toISOString();

  const minimalSessionDoc = {
    userId: u?.uid || u?.id || 'guest',
    userEmail: u?.email || 'guest@praxis.app',
    userName: u?.displayName || u?.name || 'Explorer',
    topic: String(evaluationData.topic || 'Speech Practice').slice(0, 80),
    duration: Number(evaluationData.durationSeconds || evaluationData.duration || 60),
    overallScore: Number(evaluationData.overallScore || 0),
    fluencyScore: Number(evaluationData.fluencyScore10 || 0),
    grammarScore: Number(evaluationData.grammarScore10 || 0),
    vocabularyScore: Number(evaluationData.vocabularyScore10 || 0),
    structureScore: Number(evaluationData.structureScore10 || 0),
    wpm: Number(evaluationData.wpm || 0),
    wordCount: Number(evaluationData.wordCount || 0),
    fillerCount: Number(evaluationData.fillerCount || 0),
    createdAt: nowIso
  };

  try {
    // 1. Write minimal session document
    const sessionRef = doc(db, "coachSessions", sessionId);
    await setDoc(sessionRef, minimalSessionDoc);

    // 2. Increment daily aggregate metrics in analyticsDaily
    await recordDailyMetric('coachSessions', 1);

    // 3. Update userStats coach sessions count
    if (u && (u.uid || u.id)) {
      const statsRef = doc(db, "userStats", u.uid || u.id);
      await updateDoc(statsRef, {
        coachSessions: increment(1),
        lastActiveAt: nowIso
      }).catch(() => {});
    }

    // 4. Record live activity event
    const scoreBadge = minimalSessionDoc.overallScore >= 80 ? '🌟' : '🎯';
    recordLiveActivity(
      "COACH_SESSION",
      `${scoreBadge} ${minimalSessionDoc.userName} completed "${minimalSessionDoc.topic}" (Score: ${minimalSessionDoc.overallScore}/100, ${minimalSessionDoc.wpm} WPM)`
    );

    console.log("[PRAXiS Cloud] Speech session minimal metrics saved to Firestore.");
    return sessionId;
  } catch (err) {
    console.warn("[PRAXiS Cloud] Could not save coach session:", err.message);
    return null;
  }
}

/**
 * Records an admin audit event
 */
export async function recordAdminAudit(action, targetUserId = null, details = "") {
  if (!db) return;
  const u = currentUser || readStoredLocalUser();
  const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

  try {
    const auditDocRef = doc(db, "adminAudit", auditId);
    await setDoc(auditDocRef, {
      adminId: u?.uid || u?.id || 'admin',
      adminEmail: u?.email || 'admin@praxis.app',
      action: String(action || 'ADMIN_ACTION').slice(0, 50),
      targetUserId: targetUserId ? String(targetUserId) : null,
      details: String(details || '').slice(0, 200),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    // Non-blocking
  }
}

// -------------------------------------------------------------------
// 6. USER ROADMAP & ROUTINE CLOUD STORAGE
// -------------------------------------------------------------------

export async function saveUserRoadmap(userId, roadmapData) {
  const u = currentUser || readStoredLocalUser();
  const uid = userId || u?.uid || u?.id;
  if (!uid) return;

  const nowIso = new Date().toISOString();

  // Save to Firestore userRoadmaps collection
  if (db) {
    try {
      const roadmapRef = doc(db, "userRoadmaps", uid);
      await setDoc(roadmapRef, {
        title: roadmapData.title || roadmapData.careerTitle || 'Custom Path',
        icon: roadmapData.icon || '🧭',
        roadmap: roadmapData,
        updatedAt: nowIso
      }, { merge: true });
    } catch (e) {
      console.warn("[PRAXiS Storage] Roadmap Cloud save notice:", e.message);
    }
  }

  // Backup sync to server
  try {
    const token = localStorage.getItem("praxis_token");
    fetch("/api/user/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ userId: uid, email: u?.email, roadmap: roadmapData })
    }).catch(() => {});
  } catch (err) {}
}

export async function saveRoutineTracker(userId, routineData) {
  const u = currentUser || readStoredLocalUser();
  const uid = userId || u?.uid || u?.id;
  if (!uid) return;

  const nowIso = new Date().toISOString();

  // Save to Firestore userHabits collection
  if (db) {
    try {
      const habitsRef = doc(db, "userHabits", uid);
      await setDoc(habitsRef, {
        habits: Array.isArray(routineData.habits) ? routineData.habits : [],
        updatedAt: nowIso
      }, { merge: true });
      recordDailyMetric('habitUses', 1);
    } catch (e) {
      console.warn("[PRAXiS Storage] Habit Cloud save notice:", e.message);
    }
  }

  // Backup sync to server
  try {
    const token = localStorage.getItem("praxis_token");
    fetch("/api/user/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ userId: uid, email: u?.email, routineTracker: routineData })
    }).catch(() => {});
  } catch (err) {}
}

export async function fetchUserDataOnLogin(userId) {
  const u = currentUser || readStoredLocalUser();
  const uid = userId || u?.uid || u?.id;
  if (!uid) return;

  if (db) {
    try {
      const roadmapRef = doc(db, "userRoadmaps", uid);
      const habitsRef = doc(db, "userHabits", uid);

      const [roadmapSnap, habitsSnap] = await Promise.all([
        getDoc(roadmapRef).catch(() => null),
        getDoc(habitsRef).catch(() => null)
      ]);

      if (roadmapSnap && roadmapSnap.exists()) {
        const rData = roadmapSnap.data();
        if (rData.roadmap && typeof window.renderSavedRoadmap === "function") {
          window.renderSavedRoadmap(rData.roadmap);
        }
      }

      if (habitsSnap && habitsSnap.exists()) {
        const hData = habitsSnap.data();
        if (hData.habits && typeof window.renderSavedRoutineTracker === "function") {
          window.renderSavedRoutineTracker({ habits: hData.habits });
        }
      }
    } catch (err) {
      console.warn("[PRAXiS Storage] User cloud data retrieval notice:", err.message);
    }
  }

  // Backend fallback fetch
  try {
    const token = localStorage.getItem("praxis_token");
    const res = await fetch(`/api/user/sync?userId=${encodeURIComponent(uid)}&email=${encodeURIComponent(u?.email || '')}`, {
      headers: token ? { "Authorization": `Bearer ${token}` } : {}
    });
    if (res.ok) {
      const data = await res.json();
      if (data.roadmap && typeof window.renderSavedRoadmap === "function") {
        window.renderSavedRoadmap(data.roadmap);
      }
      if (data.routineTracker && typeof window.renderSavedRoutineTracker === "function") {
        window.renderSavedRoutineTracker(data.routineTracker);
      }
    }
  } catch (e) {}
}

function setupFirestoreUserListener(user) {
  if (!db || !user) return;
  if (userSyncUnsubscribe) {
    try { userSyncUnsubscribe(); } catch(e){}
    userSyncUnsubscribe = null;
  }

  try {
    const uid = user.uid || user.id;
    if (!uid) return;
    const roadmapRef = doc(db, "userRoadmaps", uid);

    userSyncUnsubscribe = onSnapshot(roadmapRef, (docSnap) => {
      if (docSnap && docSnap.exists()) {
        const data = docSnap.data();
        if (data.roadmap && typeof window.renderSavedRoadmap === "function") {
          window.renderSavedRoadmap(data.roadmap);
        }
      }
    }, (error) => {
      // Non-blocking listener error
    });
  } catch (err) {}
}

// -------------------------------------------------------------------
// 7. USER PROFILE UI TOGGLE & DOM HYDRATION
// -------------------------------------------------------------------

export function updateProfileUI(user) {
  const loginBtn = document.getElementById("btn-google-login");
  const profileSection = document.getElementById("profile-section");
  const userAvatar = document.getElementById("user-avatar");
  const userName = document.getElementById("user-name");
  const userEmail = document.getElementById("user-email");
  const authGate = document.getElementById("auth-gate-landing");
  const mainAppContent = document.getElementById("main-app-content");
  const adminStudioBtn = document.getElementById("admin-studio-btn");
  const showcaseUserName = document.getElementById("showcase-user-name");

  if (user && (user.id || user.uid || user.email)) {
    if (authGate) authGate.classList.add("hidden");
    if (mainAppContent) mainAppContent.classList.remove("hidden");
    const hasAdminSession = localStorage.getItem("praxis_admin_session") === "true";
    const userIsAdmin = isUserAdmin(user);
    if (adminStudioBtn) {
      if (userIsAdmin || hasAdminSession) {
        adminStudioBtn.classList.remove("hidden");
      } else {
        adminStudioBtn.classList.add("hidden");
      }
    }

    if (loginBtn) loginBtn.classList.add("hidden");
    if (profileSection) profileSection.classList.remove("hidden");

    const fallbackAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.name || user.displayName || user.email || "user")}`;
    if (userAvatar) userAvatar.src = user.photoURL || user.avatar || fallbackAvatar;
    if (userName) userName.textContent = user.displayName || user.name || (user.email ? user.email.split('@')[0] : "Student");
    if (userEmail) userEmail.textContent = user.email || "";
    if (showcaseUserName) showcaseUserName.textContent = user.displayName || user.name || (user.email ? user.email.split('@')[0] : "Explorer");

    if (typeof window.updateShowcaseGreeting === "function") {
      window.updateShowcaseGreeting();
    }

    window.closeAuthModal();

    if (typeof window.reveal === "function") {
      setTimeout(window.reveal, 50);
      setTimeout(window.reveal, 200);
    }

    fetchUserDataOnLogin(user.id || user.uid);
  } else {
    if (authGate) authGate.classList.remove("hidden");
    if (mainAppContent) mainAppContent.classList.add("hidden");
    
    const hasAdminSession = localStorage.getItem("praxis_admin_session") === "true";
    if (adminStudioBtn) {
      if (hasAdminSession) {
        adminStudioBtn.classList.remove("hidden");
      } else {
        adminStudioBtn.classList.add("hidden");
      }
    }

    if (loginBtn) loginBtn.classList.remove("hidden");
    if (profileSection) profileSection.classList.add("hidden");
  }
}

// -------------------------------------------------------------------
// 8. AUTH MODAL HELPERS & FORM BINDINGS
// -------------------------------------------------------------------

window.openAuthModal = function(tab = 'login') {
  const modal = document.getElementById("auth-modal");
  if (modal) {
    if (window.location.hash !== '#auth') {
      window.history.pushState({ praxisRoot: false, modalId: 'auth-modal' }, '', '#auth');
    }
    modal.classList.remove("hidden");
    window.switchAuthTab(tab);
  }
};

window.closeAuthModal = function(fromPopstate = false) {
  const modal = document.getElementById("auth-modal");
  const alertEl = document.getElementById("auth-alert");
  if (modal) modal.classList.add("hidden");
  if (alertEl) alertEl.classList.add("hidden");

  if (!fromPopstate && window.location.hash === '#auth') {
    window.history.replaceState({ praxisRoot: true, view: 'home' }, '', '/praxis');
  }
};

window.switchAuthTab = function(tab) {
  const loginForm = document.getElementById("form-login");
  const regForm = document.getElementById("form-register");
  const tabLogin = document.getElementById("tab-login");
  const tabReg = document.getElementById("tab-register");
  const alertEl = document.getElementById("auth-alert");

  if (alertEl) alertEl.classList.add("hidden");

  if (tab === 'register') {
    loginForm?.classList.add("hidden");
    regForm?.classList.remove("hidden");
    tabLogin?.classList.remove("bg-white", "text-indigo-600", "font-extrabold", "shadow-sm");
    tabLogin?.classList.add("text-slate-500", "font-bold");
    tabReg?.classList.add("bg-white", "text-indigo-600", "font-extrabold", "shadow-sm");
    tabReg?.classList.remove("text-slate-500");
  } else {
    regForm?.classList.add("hidden");
    loginForm?.classList.remove("hidden");
    tabReg?.classList.remove("bg-white", "text-indigo-600", "font-extrabold", "shadow-sm");
    tabReg?.classList.add("text-slate-500", "font-bold");
    tabLogin?.classList.add("bg-white", "text-indigo-600", "font-extrabold", "shadow-sm");
    tabLogin?.classList.remove("text-slate-500");
  }
};

async function handleUserLoginSubmit(event) {
  event.preventDefault();
  const alertEl = document.getElementById("auth-alert");
  const submitBtn = document.getElementById("btn-submit-login");

  const emailOrUsername = document.getElementById("login-email")?.value.trim();
  const password = document.getElementById("login-password")?.value;

  if (!emailOrUsername || !password) return;

  try {
    if (submitBtn) submitBtn.innerText = "Signing in...";
    
    // Try Firebase Email Auth if email provided
    if (emailOrUsername.includes('@')) {
      try {
        await loginWithEmail(emailOrUsername, password);
        return;
      } catch (fbAuthErr) {
        console.warn("[PRAXiS Auth] Firebase email auth fallback:", fbAuthErr.message);
      }
    }

    // Backend Auth Fallback
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailOrUsername, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      localStorage.setItem("praxis_token", data.token);
      localStorage.setItem("praxis_auth_user", JSON.stringify(data.user));
      currentUser = data.user;
      updateProfileUI(currentUser);
      if (alertEl) alertEl.classList.add("hidden");
      window.dispatchEvent(new CustomEvent('praxis:auth-changed', { detail: currentUser }));
    } else {
      if (alertEl) {
        alertEl.innerText = "❌ " + (data.error || "Invalid login credentials.");
        alertEl.className = "mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 bg-rose-50 text-rose-600 border border-rose-200 block";
      }
    }
  } catch (err) {
    if (alertEl) {
      alertEl.innerText = "❌ Connection error. Please check server connection.";
      alertEl.className = "mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 bg-rose-50 text-rose-600 border border-rose-200 block";
    }
  } finally {
    if (submitBtn) submitBtn.innerText = "Sign In to PRAXiS";
  }
}

async function handleUserRegisterSubmit(event) {
  event.preventDefault();
  const alertEl = document.getElementById("auth-alert");
  const submitBtn = document.getElementById("btn-submit-register");

  const name = document.getElementById("reg-name")?.value.trim();
  const email = document.getElementById("reg-email")?.value.trim();
  const mobile = document.getElementById("reg-mobile")?.value.trim() || "";
  const username = document.getElementById("reg-username")?.value.trim();
  const password = document.getElementById("reg-password")?.value;

  if (!name || !email || !password) return;

  try {
    if (submitBtn) submitBtn.innerText = "Creating Account...";

    try {
      await registerWithEmail(name, email, password, mobile, username);
      return;
    } catch (fbRegErr) {
      console.warn("[PRAXiS Auth] Firebase email register fallback:", fbRegErr.message);
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, mobile, username, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      localStorage.setItem("praxis_token", data.token);
      localStorage.setItem("praxis_auth_user", JSON.stringify(data.user));
      currentUser = data.user;
      updateProfileUI(currentUser);
      if (alertEl) alertEl.classList.add("hidden");
      window.dispatchEvent(new CustomEvent('praxis:auth-changed', { detail: currentUser }));
    } else {
      if (alertEl) {
        alertEl.innerText = "❌ " + (data.error || "Registration failed.");
        alertEl.className = "mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 bg-rose-50 text-rose-600 border border-rose-200 block";
      }
    }
  } catch (err) {
    if (alertEl) {
      alertEl.innerText = "❌ Connection error. Please check server connection.";
      alertEl.className = "mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 bg-rose-50 text-rose-600 border border-rose-200 block";
    }
  } finally {
    if (submitBtn) submitBtn.innerText = "Create Free Account";
  }
}

// -------------------------------------------------------------------
// 9. GLOBAL BINDINGS & EXPORTS
// -------------------------------------------------------------------

window.praxisAuth = {
  getUser: () => currentUser || readStoredLocalUser(),
  isAdmin: () => isUserAdmin(currentUser || readStoredLocalUser()),
  login: loginWithGoogle,
  loginEmail: loginWithEmail,
  registerEmail: registerWithEmail,
  logout: logoutUser,
  openModal: window.openAuthModal,
  closeModal: window.closeAuthModal,
  saveRoadmap: (roadmapData) => {
    const u = currentUser || readStoredLocalUser();
    return u && saveUserRoadmap(u.uid || u.id, roadmapData);
  },
  saveRoutine: (routineData) => {
    const u = currentUser || readStoredLocalUser();
    return u && saveRoutineTracker(u.uid || u.id, routineData);
  },
  fetchData: () => {
    const u = currentUser || readStoredLocalUser();
    return u && fetchUserDataOnLogin(u.uid || u.id);
  },
  recordDailyMetric,
  recordLiveActivity,
  recordCoachSession,
  recordAdminAudit,
  getDb: () => db,
  getAuth: () => auth
};

function setupAuthEventListeners() {
  updateProfileUI(readStoredLocalUser());
  initFirebase();

  document.getElementById("btn-google-login")?.addEventListener("click", loginWithGoogle);
  document.getElementById("gate-btn-google-login")?.addEventListener("click", loginWithGoogle);
  document.getElementById("modal-btn-google-login")?.addEventListener("click", loginWithGoogle);
  document.getElementById("btn-logout")?.addEventListener("click", logoutUser);

  document.getElementById("form-login")?.addEventListener("submit", handleUserLoginSubmit);
  document.getElementById("form-register")?.addEventListener("submit", handleUserRegisterSubmit);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupAuthEventListeners);
} else {
  setupAuthEventListeners();
}

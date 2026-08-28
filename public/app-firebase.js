/**
 * PRAXiS - Firebase Authentication & Cloud Storage Integration Module
 * High-Performance, Lag-Free Real-Time Synchronization & Google Authentication.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc,
  onSnapshot
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

// Immediately restore session synchronously on module evaluation
readStoredLocalUser();

/**
 * Fetch server-side environment variables or use client config to initialize Firebase (singleton)
 */
export function initFirebase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

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
          console.log("[PRAXiS Auth] Loaded Firebase configuration from server environment.");
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
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      
      try {
        db = getFirestore(app);
      } catch (dbErr) {
        console.warn("[PRAXiS Auth] Firestore init warning:", dbErr.message);
      }

      googleProvider = new GoogleAuthProvider();
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      isInitialized = true;

      // Check for incoming redirect sign-in result (mobile browser fallback)
      getRedirectResult(auth)
        .then(async (result) => {
          if (result && result.user) {
            console.log("[PRAXiS Auth] Signed in via Google Redirect:", result.user.displayName);
            await syncGoogleUserWithBackend(result.user);
          }
        })
        .catch((redirectErr) => {
          console.warn("[PRAXiS Auth] Redirect result error:", redirectErr);
        });

      // Attach real-time Auth State Changed listener
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          const syncedUser = await syncGoogleUserWithBackend(user);
          currentUser = syncedUser || {
            uid: user.uid,
            id: user.uid,
            displayName: user.displayName || "Google User",
            name: user.displayName || "Google User",
            email: user.email || "",
            photoURL: user.photoURL,
            avatar: user.photoURL
          };

          updateProfileUI(currentUser);
          setupFirestoreListener(currentUser);
          console.log(`[PRAXiS Auth] Firebase active session: ${user.email} (${user.uid})`);
        } else {
          // If Firebase confirms no active session, check if email/password local session exists
          const localUser = readStoredLocalUser();
          if (!localUser) {
            currentUser = null;
            updateProfileUI(null);
          } else {
            updateProfileUI(localUser);
          }
        }
      });

      console.log("[PRAXiS Auth] Firebase successfully initialized with Real-Time Cross-Device Sync.");
      return true;
    } catch (initErr) {
      console.error("[PRAXiS Auth] Firebase Initialization Error:", initErr);
      isInitialized = false;
      return false;
    }
  })();

  return initPromise;
}

// -------------------------------------------------------------------
// 3. BACKEND AUTH SYNC & JWT MANAGEMENT
// -------------------------------------------------------------------

async function syncGoogleUserWithBackend(firebaseUser) {
  if (!firebaseUser || !firebaseUser.email) return null;

  try {
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: firebaseUser.email,
        name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        photoURL: firebaseUser.photoURL || "",
        uid: firebaseUser.uid
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        localStorage.setItem("praxis_token", data.token);
      }
      if (data.user) {
        const fullUser = {
          ...data.user,
          uid: firebaseUser.uid,
          id: data.user.id || firebaseUser.uid,
          photoURL: firebaseUser.photoURL || data.user.avatar || "",
          avatar: firebaseUser.photoURL || data.user.avatar || ""
        };
        localStorage.setItem("praxis_auth_user", JSON.stringify(fullUser));
        currentUser = fullUser;
        return fullUser;
      }
    }
  } catch (syncErr) {
    console.warn("[PRAXiS Auth] Telemetry backend sync warning:", syncErr);
  }

  // Fallback if backend fetch failed
  const fallbackUser = {
    uid: firebaseUser.uid,
    id: firebaseUser.uid,
    displayName: firebaseUser.displayName || "Google User",
    name: firebaseUser.displayName || "Google User",
    email: firebaseUser.email || "",
    photoURL: firebaseUser.photoURL || "",
    avatar: firebaseUser.photoURL || ""
  };
  localStorage.setItem("praxis_auth_user", JSON.stringify(fallbackUser));
  currentUser = fallbackUser;
  return fallbackUser;
}

// -------------------------------------------------------------------
// 4. GOOGLE SIGN-IN HANDLER (LAG-FREE, RESILIENT & RESPONSIVE)
// -------------------------------------------------------------------

function setGoogleButtonsLoadingState(isLoading) {
  const btnIds = ["btn-google-login", "gate-btn-google-login", "modal-btn-google-login"];
  
  btnIds.forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;

    if (isLoading) {
      if (!btn.dataset.originalHtml) {
        btn.dataset.originalHtml = btn.innerHTML;
      }
      btn.disabled = true;
      btn.style.opacity = "0.75";
      btn.style.pointerEvents = "none";
      btn.innerHTML = `
        <svg class="w-4 h-4 animate-spin shrink-0 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>Connecting to Google...</span>
      `;
    } else {
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
      }
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
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
    // Ensure Firebase is initialized
    const ready = await initFirebase();
    if (!ready || !auth || !googleProvider) {
      throw new Error("Unable to connect to Google Auth services. Please try again.");
    }

    // Trigger Google Sign-In Popup
    const result = await signInWithPopup(auth, googleProvider);
    console.log("[PRAXiS Auth] Signed in successfully via Google:", result.user.displayName);

    // Sync with backend and store token/user
    const syncedUser = await syncGoogleUserWithBackend(result.user);
    currentUser = syncedUser;

    updateProfileUI(currentUser);
    window.closeAuthModal();

    // Trigger instant custom event
    window.dispatchEvent(new CustomEvent('praxis:auth-changed', { detail: currentUser }));

    return result.user;
  } catch (error) {
    console.warn("[PRAXiS Auth] Google Sign-In notice:", error.code || error.message);

    // 1. User intentionally closed popup or duplicate request -> No error alert needed
    if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") {
      // Clean reset
    } 
    // 2. Popup was blocked by browser -> Offer redirect or notification
    else if (error.code === "auth/popup-blocked") {
      if (confirm("Popup window was blocked by your browser. Would you like to redirect to Google Sign-In instead?")) {
        if (auth && googleProvider) {
          await signInWithRedirect(auth, googleProvider);
          return;
        }
      }
    } 
    // 3. Domain not authorized or API key issue -> Guide to email login
    else if (error.code === "auth/unauthorized-domain" || error.code === "auth/api-key-not-valid") {
      window.openAuthModal('login');
      if (alertEl) {
        alertEl.innerText = `⚠️ Google Sign-In is not enabled on this domain (${window.location.hostname}). You can use standard email login or register below.`;
        alertEl.className = "mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 block";
      }
    } 
    // 4. General unexpected failure
    else {
      if (alertEl) {
        alertEl.innerText = `❌ Google Sign-In failed: ${error.message || 'Unknown error'}`;
        alertEl.className = "mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 bg-rose-50 text-rose-600 border border-rose-200 block";
      } else {
        alert(`Google Sign-In failed: ${error.message}`);
      }
    }
  } finally {
    isAuthenticating = false;
    setGoogleButtonsLoadingState(false);
  }
}

export async function logoutUser() {
  if (userSyncUnsubscribe) {
    try {
      userSyncUnsubscribe();
    } catch (e) {}
    userSyncUnsubscribe = null;
  }

  if (auth) {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("[PRAXiS Auth] Firebase signout error:", err);
    }
  }

  // Purge auth session tokens & trigger UI state cleanup
  localStorage.removeItem("praxis_auth_user");
  localStorage.removeItem("praxis_token");

  currentUser = null;
  updateProfileUI(null);

  if (typeof window.clearUserUIState === "function") {
    window.clearUserUIState();
  }

  window.dispatchEvent(new CustomEvent('praxis:auth-changed', { detail: null }));
  console.log("[PRAXiS Auth] User logged out and active UI screen memory cleared.");
}

// -------------------------------------------------------------------
// 5. USER PROFILE UI TOGGLE & DOM HYDRATION
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
    // Logged In: Reveal full application, hide Auth Gate Landing
    if (authGate) authGate.classList.add("hidden");
    if (mainAppContent) mainAppContent.classList.remove("hidden");
    if (adminStudioBtn) adminStudioBtn.classList.remove("hidden");

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

    // Trigger reveal recalculation once content is visible
    if (typeof window.reveal === "function") {
      setTimeout(window.reveal, 50);
      setTimeout(window.reveal, 200);
    }

    // Fetch and sync user data across devices in background
    fetchUserDataOnLogin(user.id || user.uid);
  } else {
    // Logged Out: Lock application, show Auth Gate Landing
    if (authGate) authGate.classList.remove("hidden");
    if (mainAppContent) mainAppContent.classList.add("hidden");
    if (adminStudioBtn) adminStudioBtn.classList.add("hidden");

    if (loginBtn) loginBtn.classList.remove("hidden");
    if (profileSection) profileSection.classList.add("hidden");
  }
}

// -------------------------------------------------------------------
// 6. FIRESTORE REAL-TIME SYNCHRONIZATION
// -------------------------------------------------------------------

function getUserDocRef(user) {
  if (!db) return null;
  const u = user || currentUser;
  if (!u) return null;
  const emailKey = u.email ? u.email.toLowerCase().trim().replace(/[^a-z0-9]/g, "_") : (u.uid || u.id);
  if (!emailKey) return null;
  try {
    return doc(db, "users", `user_${emailKey}`);
  } catch (err) {
    return null;
  }
}

function setupFirestoreListener(user) {
  if (!db || !user) return;

  if (userSyncUnsubscribe) {
    try { userSyncUnsubscribe(); } catch(e){}
    userSyncUnsubscribe = null;
  }

  try {
    const userDocRef = getUserDocRef(user);
    if (userDocRef) {
      userSyncUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.roadmap && typeof window.renderSavedRoadmap === "function") {
            window.renderSavedRoadmap(data.roadmap);
          }
          if (data.routineTracker && typeof window.renderSavedRoutineTracker === "function") {
            window.renderSavedRoutineTracker(data.routineTracker);
          }
        }
      }, (error) => {
        console.warn("[PRAXiS Cloud Sync] Firestore real-time listener inactive:", error.message);
      });
    }
  } catch (err) {
    console.warn("[PRAXiS Cloud Sync] Listener setup warning:", err);
  }
}

// -------------------------------------------------------------------
// 7. AUTH MODAL & EMAIL/PASSWORD HANDLERS
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

async function handleUserLogin(event) {
  event.preventDefault();
  const alertEl = document.getElementById("auth-alert");
  const submitBtn = document.getElementById("btn-submit-login");

  const emailOrUsername = document.getElementById("login-email")?.value.trim();
  const password = document.getElementById("login-password")?.value;

  if (!emailOrUsername || !password) return;

  try {
    if (submitBtn) submitBtn.innerText = "Signing in...";
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
      alertEl.innerText = "❌ Server connection error. Ensure server is running.";
      alertEl.className = "mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 bg-rose-50 text-rose-600 border border-rose-200 block";
    }
  } finally {
    if (submitBtn) submitBtn.innerText = "Sign In to PRAXiS";
  }
}

async function handleUserRegister(event) {
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
      alertEl.innerText = "❌ Server connection error. Ensure server is running.";
      alertEl.className = "mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 bg-rose-50 text-rose-600 border border-rose-200 block";
    }
  } finally {
    if (submitBtn) submitBtn.innerText = "Create Free Account";
  }
}

// -------------------------------------------------------------------
// 8. SAVING DATA TO SERVER & CLOUD FIRESTORE
// -------------------------------------------------------------------

export async function saveUserRoadmap(userId, roadmapData) {
  const user = currentUser || readStoredLocalUser();
  if (!user && !userId) return;

  const token = localStorage.getItem("praxis_token");
  const email = user?.email || "";

  // 1. Save to server backend database (users.json)
  try {
    fetch("/api/user/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        userId: userId || user?.uid || user?.id,
        email: email,
        roadmap: roadmapData
      })
    }).then(res => res.json()).then(() => {
      console.log("[PRAXiS Sync] Roadmap synced to server database.");
    }).catch(err => console.warn("[PRAXiS Sync] Backend roadmap sync warning:", err));
  } catch (err) {
    console.warn("[PRAXiS Sync] Backend roadmap sync error:", err);
  }

  // 2. Save to Cloud Firestore (in parallel, non-blocking)
  if (db && user) {
    try {
      const userDocRef = getUserDocRef(user);
      if (userDocRef) {
        setDoc(userDocRef, {
          roadmap: roadmapData,
          userEmail: email,
          roadmapUpdatedAt: new Date().toISOString()
        }, { merge: true }).then(() => {
          console.log("[PRAXiS Storage] Roadmap synced to Cloud Firestore.");
        }).catch(error => {
          console.warn("[PRAXiS Storage] Firestore roadmap save warning:", error.message);
        });
      }
    } catch (error) {
      console.warn("[PRAXiS Storage] Firestore error saving roadmap:", error);
    }
  }
}

export async function saveRoutineTracker(userId, routineData) {
  const user = currentUser || readStoredLocalUser();
  if (!user && !userId) return;

  const token = localStorage.getItem("praxis_token");
  const email = user?.email || "";

  // 1. Save to server backend database (users.json)
  try {
    fetch("/api/user/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        userId: userId || user?.uid || user?.id,
        email: email,
        routineTracker: routineData
      })
    }).then(res => res.json()).then(() => {
      console.log("[PRAXiS Sync] Routine Tracker synced to server database.");
    }).catch(err => console.warn("[PRAXiS Sync] Backend routine sync warning:", err));
  } catch (err) {
    console.warn("[PRAXiS Sync] Backend routine sync error:", err);
  }

  // 2. Save to Cloud Firestore (in parallel, non-blocking)
  if (db && user) {
    try {
      const userDocRef = getUserDocRef(user);
      if (userDocRef) {
        setDoc(userDocRef, {
          routineTracker: routineData,
          userEmail: email,
          routineUpdatedAt: new Date().toISOString()
        }, { merge: true }).then(() => {
          console.log("[PRAXiS Storage] Routine Tracker synced to Cloud Firestore.");
        }).catch(error => {
          console.warn("[PRAXiS Storage] Firestore routine save warning:", error.message);
        });
      }
    } catch (error) {
      console.warn("[PRAXiS Storage] Firestore error saving routine tracker:", error);
    }
  }
}

// -------------------------------------------------------------------
// 9. RETRIEVING DATA FROM SERVER & CLOUD FIRESTORE
// -------------------------------------------------------------------

export async function fetchUserDataOnLogin(userId) {
  const user = currentUser || readStoredLocalUser();
  if (!user && !userId) return;
  const token = localStorage.getItem("praxis_token");
  const email = user?.email || "";

  // 1. Fetch from server backend database (users.json)
  try {
    const res = await fetch(`/api/user/sync?userId=${encodeURIComponent(userId || "")}&email=${encodeURIComponent(email)}`, {
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
      console.log("[PRAXiS Sync] Synced user data loaded from server database.");
    }
  } catch (err) {
    console.warn("[PRAXiS Sync] Backend data fetch error:", err);
  }

  // 2. Fetch from Cloud Firestore (if available)
  if (db && user) {
    try {
      const userDocRef = getUserDocRef(user);
      if (userDocRef) {
        getDoc(userDocRef).then((docSnap) => {
          if (docSnap && docSnap.exists()) {
            const data = docSnap.data();
            if (data.roadmap && typeof window.renderSavedRoadmap === "function") {
              window.renderSavedRoadmap(data.roadmap);
            }
            if (data.routineTracker && typeof window.renderSavedRoutineTracker === "function") {
              window.renderSavedRoutineTracker(data.routineTracker);
            }
            console.log("[PRAXiS Cloud Sync] Synced user data loaded from Cloud Firestore.");
          }
        }).catch(error => {
          console.warn("[PRAXiS Storage] Firestore fetch warning:", error.message);
        });
      }
    } catch (error) {
      console.warn("[PRAXiS Storage] Firestore fetch error:", error);
    }
  }
}

// -------------------------------------------------------------------
// 10. GLOBAL BINDINGS & DOM READY INITIALIZATION
// -------------------------------------------------------------------

// Synchronously expose window.praxisAuth immediately so other scripts can access it safely
window.praxisAuth = {
  getUser: () => currentUser || readStoredLocalUser(),
  login: loginWithGoogle,
  logout: logoutUser,
  openModal: window.openAuthModal,
  closeModal: window.closeAuthModal,
  saveRoadmap: (roadmapData) => (currentUser || readStoredLocalUser()) && saveUserRoadmap((currentUser || readStoredLocalUser()).id || (currentUser || readStoredLocalUser()).uid, roadmapData),
  saveRoutine: (routineData) => (currentUser || readStoredLocalUser()) && saveRoutineTracker((currentUser || readStoredLocalUser()).id || (currentUser || readStoredLocalUser()).uid, routineData),
  fetchData: () => (currentUser || readStoredLocalUser()) && fetchUserDataOnLogin((currentUser || readStoredLocalUser()).id || (currentUser || readStoredLocalUser()).uid)
};

function setupAuthEventListeners() {
  updateProfileUI(readStoredLocalUser());
  initFirebase();

  document.getElementById("btn-google-login")?.addEventListener("click", loginWithGoogle);
  document.getElementById("gate-btn-google-login")?.addEventListener("click", loginWithGoogle);
  document.getElementById("modal-btn-google-login")?.addEventListener("click", loginWithGoogle);
  document.getElementById("btn-logout")?.addEventListener("click", logoutUser);

  document.getElementById("form-login")?.addEventListener("submit", handleUserLogin);
  document.getElementById("form-register")?.addEventListener("submit", handleUserRegister);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupAuthEventListeners);
} else {
  setupAuthEventListeners();
}

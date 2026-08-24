/**
 * PRAXiS - Firebase Authentication & Cloud Storage Integration Module
 * Real-Time Cross-Device Synchronization & User Authentication.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
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
// 1. CONFIGURATION & INITIALIZATION
// -------------------------------------------------------------------

let firebaseConfig = {
  apiKey: "AIzaSyBDhP_2ZaRv4ncV7W-_p75qRoOAg8te0oU",
  authDomain: "praxis-app-e6e2a.firebaseapp.com",
  projectId: "praxis-app-e6e2a",
  storageBucket: "praxis-app-e6e2a.firebasestorage.app",
  messagingSenderId: "22274527937",
  appId: "1:22274527937:web:8e69fc61bf10224b71fa40",
};

let app, auth, db, googleProvider;
let currentUser = null;
let isInitialized = false;
let userSyncUnsubscribe = null;

/**
 * Fetch server-side environment variables or use client config to init Firebase
 */
async function initFirebase() {
  try {
    const res = await fetch("/api/firebase-config");
    if (res.ok) {
      const serverConfig = await res.json();
      if (serverConfig && serverConfig.apiKey && serverConfig.apiKey.trim() !== "") {
        firebaseConfig = serverConfig;
        console.log("[PRAXiS Auth] Loaded Firebase configuration from server environment.");
      }
    }
  } catch (err) {
    console.warn("[PRAXiS Auth] Using local client configuration.");
  }

  // Validate API key
  const key = firebaseConfig.apiKey ? firebaseConfig.apiKey.trim() : "";
  if (!key || key.startsWith("YOUR_") || key === "your_firebase_api_key") {
    console.warn("[PRAXiS Auth] Missing or placeholder Firebase API Key.");
    checkStoredLocalUser();
    return false;
  }

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    isInitialized = true;

    // Attach Auth state listener once initialized
    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUser = {
          uid: user.uid,
          id: user.uid,
          displayName: user.displayName || "Google User",
          name: user.displayName || "Google User",
          email: user.email || "",
          photoURL: user.photoURL,
          avatar: user.photoURL
        };

        // Sync Google Sign-In with backend database & login telemetry
        fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            name: user.displayName,
            photoURL: user.photoURL,
            uid: user.uid
          })
        }).catch(err => console.warn("[PRAXiS Auth] Telemetry sync warning:", err));

        updateProfileUI(currentUser);

        // Unsubscribe existing real-time listener if any
        if (userSyncUnsubscribe) {
          userSyncUnsubscribe();
          userSyncUnsubscribe = null;
        }

        console.log(`[PRAXiS Auth] Firebase logged in as: ${user.email} (${user.uid})`);
        
        // 🔄 Real-time Firestore document listener across all active devices
        const userDocRef = getUserDocRef(currentUser || user);
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
            console.error("[PRAXiS Cloud Sync] Real-time sync error:", error);
          });
        }

      } else {
        // Fallback to check stored local user (email/password session)
        checkStoredLocalUser();
      }
    });

    console.log("[PRAXiS Auth] Firebase successfully initialized with Real-Time Cross-Device Sync.");
    return true;
  } catch (initErr) {
    console.error("[PRAXiS Auth] Initialization Error:", initErr);
    checkStoredLocalUser();
    return false;
  }
}

// -------------------------------------------------------------------
// 2. USER AUTHENTICATION & PROFILE UI TOGGLE
// -------------------------------------------------------------------

function checkStoredLocalUser() {
  try {
    const storedUser = localStorage.getItem("praxis_auth_user");
    if (storedUser) {
      currentUser = JSON.parse(storedUser);
      updateProfileUI(currentUser);
      return true;
    }
  } catch (err) {
    console.warn("[PRAXiS Auth] Failed reading stored local user:", err);
  }
  updateProfileUI(null);
  return false;
}

export async function loginWithGoogle() {
  if (!isInitialized) {
    const success = await initFirebase();
    if (!success) {
      window.openAuthModal('login');
      return;
    }
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log("[PRAXiS Auth] Signed in successfully via Google:", result.user.displayName);
    const gUser = {
      uid: result.user.uid,
      id: result.user.uid,
      displayName: result.user.displayName,
      name: result.user.displayName,
      email: result.user.email,
      photoURL: result.user.photoURL,
      avatar: result.user.photoURL
    };
    currentUser = gUser;
    localStorage.setItem("praxis_auth_user", JSON.stringify(gUser));
    updateProfileUI(gUser);
    window.closeAuthModal();
    return result.user;
  } catch (error) {
    console.error("[PRAXiS Auth] Google Sign-In Error:", error.code, error.message);
    if (error.code === "auth/api-key-not-valid" || error.code === "auth/unauthorized-domain") {
      window.openAuthModal('login');
    } else if (error.code !== "auth/popup-closed-by-user") {
      alert(`Google Sign-In failed: ${error.message}`);
    }
  }
}

export async function logoutUser() {
  if (userSyncUnsubscribe) {
    userSyncUnsubscribe();
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
  console.log("[PRAXiS Auth] User logged out and active UI screen memory cleared.");
}

function updateProfileUI(user) {
  const loginBtn = document.getElementById("btn-google-login");
  const profileSection = document.getElementById("profile-section");
  const userAvatar = document.getElementById("user-avatar");
  const userName = document.getElementById("user-name");
  const userEmail = document.getElementById("user-email");
  const authGate = document.getElementById("auth-gate-landing");
  const mainAppContent = document.getElementById("main-app-content");
  const adminStudioBtn = document.getElementById("admin-studio-btn");

  if (user) {
    // Logged In: Reveal full application, hide Auth Gate Landing
    authGate?.classList.add("hidden");
    mainAppContent?.classList.remove("hidden");
    adminStudioBtn?.classList.remove("hidden");

    loginBtn?.classList.add("hidden");
    profileSection?.classList.remove("hidden");
    if (userAvatar) userAvatar.src = user.photoURL || user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.name || user.displayName || "user")}`;
    if (userName) userName.textContent = user.displayName || user.name || "Student";
    if (userEmail) userEmail.textContent = user.email || "";

    window.closeAuthModal();

    // Fetch and sync user data across devices on login
    fetchUserDataOnLogin(user.id || user.uid);
  } else {
    // Logged Out: Lock application, show Auth Gate Landing
    authGate?.classList.remove("hidden");
    mainAppContent?.classList.add("hidden");
    adminStudioBtn?.classList.add("hidden");

    loginBtn?.classList.remove("hidden");
    profileSection?.classList.add("hidden");
  }
}

// -------------------------------------------------------------------
// 3. AUTH MODAL & EMAIL/PASSWORD HANDLERS
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
// 4. SAVING DATA TO CLOUD & SERVER BACKEND
// -------------------------------------------------------------------

function getUserDocRef(user) {
  if (!db) return null;
  const u = user || currentUser;
  if (!u) return null;
  const emailKey = u.email ? u.email.toLowerCase().trim().replace(/[^a-z0-9]/g, "_") : (u.uid || u.id);
  if (!emailKey) return null;
  return doc(db, "users", `user_${emailKey}`);
}

export async function saveUserRoadmap(userId, roadmapData) {
  const user = currentUser;
  if (!user && !userId) return;

  const token = localStorage.getItem("praxis_token");
  const email = user?.email || "";

  // 1. Save to server backend database (users.json)
  try {
    await fetch("/api/user/sync", {
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
    });
    console.log("[PRAXiS Sync] Roadmap synced to server database.");
  } catch (err) {
    console.warn("[PRAXiS Sync] Backend roadmap sync warning:", err);
  }

  // 2. Save to Cloud Firestore (if available)
  if (db && user) {
    try {
      const userDocRef = getUserDocRef(user);
      if (userDocRef) {
        await setDoc(userDocRef, {
          roadmap: roadmapData,
          userEmail: email,
          roadmapUpdatedAt: new Date().toISOString()
        }, { merge: true });
        console.log("[PRAXiS Storage] Roadmap synced to Cloud Firestore.");
      }
    } catch (error) {
      console.error("[PRAXiS Storage] Firestore error saving roadmap:", error);
    }
  }
}

export async function saveRoutineTracker(userId, routineData) {
  const user = currentUser;
  if (!user && !userId) return;

  const token = localStorage.getItem("praxis_token");
  const email = user?.email || "";

  // 1. Save to server backend database (users.json)
  try {
    await fetch("/api/user/sync", {
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
    });
    console.log("[PRAXiS Sync] Routine Tracker synced to server database.");
  } catch (err) {
    console.warn("[PRAXiS Sync] Backend routine sync warning:", err);
  }

  // 2. Save to Cloud Firestore (if available)
  if (db && user) {
    try {
      const userDocRef = getUserDocRef(user);
      if (userDocRef) {
        await setDoc(userDocRef, {
          routineTracker: routineData,
          userEmail: email,
          routineUpdatedAt: new Date().toISOString()
        }, { merge: true });
        console.log("[PRAXiS Storage] Routine Tracker synced to Cloud Firestore.");
      }
    } catch (error) {
      console.error("[PRAXiS Storage] Firestore error saving routine tracker:", error);
    }
  }
}

// -------------------------------------------------------------------
// 5. RETRIEVING DATA FROM CLOUD & SERVER BACKEND
// -------------------------------------------------------------------

export async function fetchUserDataOnLogin(userId) {
  const user = currentUser;
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
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          const data = docSnap.data();

          if (data.roadmap && typeof window.renderSavedRoadmap === "function") {
            window.renderSavedRoadmap(data.roadmap);
          }

          if (data.routineTracker && typeof window.renderSavedRoutineTracker === "function") {
            window.renderSavedRoutineTracker(data.routineTracker);
          }
          console.log("[PRAXiS Cloud Sync] Synced user data loaded from Cloud Firestore.");
        }
      }
    } catch (error) {
      console.error("[PRAXiS Storage] Firestore fetch error:", error);
    }
  }
}

// Auto-initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  checkStoredLocalUser();
  initFirebase();

  document.getElementById("btn-google-login")?.addEventListener("click", loginWithGoogle);
  document.getElementById("gate-btn-google-login")?.addEventListener("click", loginWithGoogle);
  document.getElementById("modal-btn-google-login")?.addEventListener("click", loginWithGoogle);
  document.getElementById("btn-logout")?.addEventListener("click", logoutUser);

  document.getElementById("form-login")?.addEventListener("submit", handleUserLogin);
  document.getElementById("form-register")?.addEventListener("submit", handleUserRegister);
});

// Global bindings for legacy script.js access
window.praxisAuth = {
  getUser: () => currentUser,
  login: loginWithGoogle,
  logout: logoutUser,
  openModal: window.openAuthModal,
  closeModal: window.closeAuthModal,
  saveRoadmap: (roadmapData) => currentUser && saveUserRoadmap(currentUser.id || currentUser.uid, roadmapData),
  saveRoutine: (routineData) => currentUser && saveRoutineTracker(currentUser.id || currentUser.uid, routineData),
  fetchData: () => currentUser && fetchUserDataOnLogin(currentUser.id || currentUser.uid)
};

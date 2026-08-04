/**
 * PRAXiS - Firebase Authentication & Cloud Storage Integration Module
 * Handles Google Authentication & Firestore Cloud Data Persistence.
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
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// -------------------------------------------------------------------
// 1. CONFIGURATION & INITIALIZATION
// -------------------------------------------------------------------

// Default hardcoded fallback configuration
// (You can paste your Firebase Console keys directly here OR in your server's .env file)
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
    return false;
  }

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    isInitialized = true;

    // Attach Auth state listener once initialized
    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      updateProfileUI(user);

      if (user) {
        console.log(`[PRAXiS Auth] Logged in as: ${user.email} (${user.uid})`);
        await fetchUserDataOnLogin(user.uid);
      } else {
        console.log("[PRAXiS Auth] User signed out.");
      }
    });

    console.log("[PRAXiS Auth] Firebase successfully initialized.");
    return true;
  } catch (initErr) {
    console.error("[PRAXiS Auth] Initialization Error:", initErr);
    return false;
  }
}

// -------------------------------------------------------------------
// 2. GOOGLE LOGIN, LOGOUT & PROFILE UI TOGGLE
// -------------------------------------------------------------------

/**
 * Trigger Google Sign-In Popup
 */
export async function loginWithGoogle() {
  if (!isInitialized) {
    const success = await initFirebase();
    if (!success) {
      alert(
        "⚠️ Firebase API Key Missing!\n\n" +
        "To enable Google Sign-In, please add your actual Firebase Web App API key.\n\n" +
        "Option 1: Open 'public/app-firebase.js' and replace 'YOUR_FIREBASE_API_KEY' with your key from Firebase Console.\n\n" +
        "Option 2: Add FIREBASE_API_KEY, FIREBASE_PROJECT_ID, etc. in your .env file or Render Environment Variables."
      );
      return;
    }
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log("[PRAXiS Auth] Signed in successfully:", result.user.displayName);
    return result.user;
  } catch (error) {
    console.error("[PRAXiS Auth] Google Sign-In Error:", error.code, error.message);
    if (error.code === "auth/api-key-not-valid") {
      alert("❌ Invalid Firebase API Key! Please verify the API key copied from your Firebase Console.");
    } else if (error.code !== "auth/popup-closed-by-user") {
      alert(`Google Sign-In failed: ${error.message}`);
    }
  }
}

/**
 * Handle User Logout
 */
export async function logoutUser() {
  if (!auth) return;
  try {
    await signOut(auth);
    console.log("[PRAXiS Auth] User logged out.");
  } catch (error) {
    console.error("[PRAXiS Auth] Logout Error:", error.message);
  }
}

/**
 * Update UI for Auth State
 */
function updateProfileUI(user) {
  const loginBtn = document.getElementById("btn-google-login");
  const profileSection = document.getElementById("profile-section");
  const userAvatar = document.getElementById("user-avatar");
  const userName = document.getElementById("user-name");
  const userEmail = document.getElementById("user-email");

  if (user) {
    loginBtn?.classList.add("hidden");
    profileSection?.classList.remove("hidden");
    if (userAvatar) userAvatar.src = user.photoURL || "https://lh3.googleusercontent.com/a/default-user";
    if (userName) userName.textContent = user.displayName || "User";
    if (userEmail) userEmail.textContent = user.email || "";
  } else {
    loginBtn?.classList.remove("hidden");
    profileSection?.classList.add("hidden");
  }
}

// -------------------------------------------------------------------
// 3. SAVING DATA TO CLOUD (FIRESTORE)
// -------------------------------------------------------------------

/**
 * Save user's Career Compass generated roadmap into Firestore
 */
export async function saveUserRoadmap(userId, roadmapData) {
  if (!db || !userId) {
    console.warn("[PRAXiS Storage] Save cancelled: Database or User ID not active.");
    return;
  }

  try {
    const userDocRef = doc(db, "users", userId);
    await setDoc(userDocRef, {
      roadmap: roadmapData,
      roadmapUpdatedAt: new Date().toISOString()
    }, { merge: true });

    console.log("[PRAXiS Storage] Career Roadmap saved to Firestore successfully.");
  } catch (error) {
    console.error("[PRAXiS Storage] Error saving roadmap:", error);
  }
}

/**
 * Save and update user's 30-day Routine Tracker progress
 */
export async function saveRoutineTracker(userId, routineData) {
  if (!db || !userId) {
    console.warn("[PRAXiS Storage] Save cancelled: Database or User ID not active.");
    return;
  }

  try {
    const userDocRef = doc(db, "users", userId);
    await setDoc(userDocRef, {
      routineTracker: routineData,
      routineUpdatedAt: new Date().toISOString()
    }, { merge: true });

    console.log("[PRAXiS Storage] Routine Tracker progress saved to Firestore successfully.");
  } catch (error) {
    console.error("[PRAXiS Storage] Error saving routine tracker:", error);
  }
}

// -------------------------------------------------------------------
// 4. RETRIEVING DATA FROM CLOUD (FIRESTORE)
// -------------------------------------------------------------------

/**
 * Fetch user data from database immediately after login
 */
export async function fetchUserDataOnLogin(userId) {
  if (!db || !userId) return;

  try {
    const userDocRef = doc(db, "users", userId);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();

      if (data.roadmap && typeof window.renderSavedRoadmap === "function") {
        console.log("[PRAXiS Storage] Restoring saved Career Roadmap...");
        window.renderSavedRoadmap(data.roadmap);
      }

      if (data.routineTracker && typeof window.renderSavedRoutineTracker === "function") {
        console.log("[PRAXiS Storage] Restoring saved Routine Tracker progress...");
        window.renderSavedRoutineTracker(data.routineTracker);
      }
    } else {
      console.log("[PRAXiS Storage] No cloud storage record found for this user yet.");
    }
  } catch (error) {
    console.error("[PRAXiS Storage] Error fetching user data:", error);
  }
}

// Auto-initialize on load
document.addEventListener("DOMContentLoaded", () => {
  initFirebase();

  document.getElementById("btn-google-login")?.addEventListener("click", loginWithGoogle);
  document.getElementById("btn-logout")?.addEventListener("click", logoutUser);
});

// Global bindings for legacy script.js access
window.praxisAuth = {
  getUser: () => currentUser,
  login: loginWithGoogle,
  logout: logoutUser,
  saveRoadmap: (roadmapData) => currentUser && saveUserRoadmap(currentUser.uid, roadmapData),
  saveRoutine: (routineData) => currentUser && saveRoutineTracker(currentUser.uid, routineData),
  fetchData: () => currentUser && fetchUserDataOnLogin(currentUser.uid)
};

/**
 * PRAXiS - Firebase Authentication & Cloud Storage Integration Module
 * Built for Vanilla JavaScript using Firebase v10+ ES Modules via CDN.
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
// 1. INITIALIZATION & SETUP
// -------------------------------------------------------------------

// Replace these values with your actual config from Firebase Console -> Project Settings -> Web App
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase App & Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Active User Reference
let currentUser = null;

// -------------------------------------------------------------------
// 2. GOOGLE LOGIN, LOGOUT & PROFILE UI TOGGLE
// -------------------------------------------------------------------

/**
 * Trigger Google Sign-In Popup
 */
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log("[PRAXiS Auth] Signed in successfully:", result.user.displayName);
    return result.user;
  } catch (error) {
    console.error("[PRAXiS Auth] Google Sign-In Error:", error.code, error.message);
    if (error.code !== "auth/popup-closed-by-user") {
      alert(`Google Sign-In failed: ${error.message}`);
    }
  }
}

/**
 * Handle User Logout
 */
export async function logoutUser() {
  try {
    await signOut(auth);
    console.log("[PRAXiS Auth] User logged out.");
  } catch (error) {
    console.error("[PRAXiS Auth] Logout Error:", error.message);
  }
}

/**
 * Update UI for Auth State (Toggles Profile Card vs Sign-In Button)
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

/**
 * Auth State Observer - Maintains auth state across browser refreshes
 */
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  updateProfileUI(user);

  if (user) {
    console.log(`[PRAXiS Auth] Authenticated as: ${user.email} (${user.uid})`);
    // Immediately fetch saved user data from Firestore
    await fetchUserDataOnLogin(user.uid);
  } else {
    console.log("[PRAXiS Auth] No user is logged in.");
  }
});

// -------------------------------------------------------------------
// 3. SAVING DATA TO CLOUD (FIRESTORE)
// -------------------------------------------------------------------

/**
 * Save user's Career Compass generated roadmap into Firestore
 * @param {string} userId - User UID
 * @param {Object} roadmapData - Roadmap details object
 */
export async function saveUserRoadmap(userId, roadmapData) {
  if (!userId) {
    console.warn("[PRAXiS Storage] Save cancelled: User is not logged in.");
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
 * Save and update user's 30-day Routine Tracker heatmap progress
 * @param {string} userId - User UID
 * @param {Object} routineData - Routine Tracker habits & heatmap data
 */
export async function saveRoutineTracker(userId, routineData) {
  if (!userId) {
    console.warn("[PRAXiS Storage] Save cancelled: User is not logged in.");
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
 * Fetch Roadmap and Routine Tracker data from database immediately after login
 * @param {string} userId - User UID
 */
export async function fetchUserDataOnLogin(userId) {
  if (!userId) return;

  try {
    const userDocRef = doc(db, "users", userId);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();

      // 1. Update Roadmap UI if saved roadmap exists
      if (data.roadmap && typeof window.renderSavedRoadmap === "function") {
        console.log("[PRAXiS Storage] Restoring saved Career Roadmap...");
        window.renderSavedRoadmap(data.roadmap);
      }

      // 2. Update Routine Tracker UI if saved routine data exists
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

// Bind DOM event listeners
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-google-login")?.addEventListener("click", loginWithGoogle);
  document.getElementById("btn-logout")?.addEventListener("click", logoutUser);
});

// Expose helper functions globally for site interaction
window.praxisAuth = {
  getCurrentUser: () => currentUser,
  login: loginWithGoogle,
  logout: logoutUser,
  saveRoadmap: (roadmapData) => currentUser && saveUserRoadmap(currentUser.uid, roadmapData),
  saveRoutine: (routineData) => currentUser && saveRoutineTracker(currentUser.uid, routineData),
  fetchData: () => currentUser && fetchUserDataOnLogin(currentUser.uid)
};

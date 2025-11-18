// modules/auth.js
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { app, db } from "./firebase.js";
import { state } from "./state.js";
import { $ } from "./helpers/utils.js";

export const auth = getAuth(app);

// Auto Logout after 24 Hours of Inactivity
const INACTIVITY_LIMIT = 24 * 60 * 60 * 1000; // 24 hours
let inactivityTimeout;

export function resetInactivityTimer() {
    clearTimeout(inactivityTimeout);
    if (state.user) {
        inactivityTimeout = setTimeout(() => {
            console.log("Inactivity timeout. Logging out.");
            alert("Session expired due to inactivity. Please log in again.");
            logout();
        }, INACTIVITY_LIMIT);
    }
}
['mousemove', 'keydown', 'click', 'touchstart'].forEach(evt => window.addEventListener(evt, resetInactivityTimer));

export function login() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
        'hd': 'gemfireems.org',
        'oauth_web_client_id': '649560661195-m4c2sa1bncop9jnhajpvfum5dal3iqha.apps.googleusercontent.com'
    });
    signInWithPopup(auth, provider).catch((error) => console.error("Popup Sign-in Error:", error));
}

export function logout() {
    return signOut(auth);
}

export function onUserHandler(callback) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (!user.email.endsWith('@gemfireems.org')) {
                alert("Access denied. Please use a valid gemfireems.org email account.");
                return signOut(auth);
            }
            try {
                const userDocSnap = await getDoc(doc(db, "users", user.uid));
                state.userRole = userDocSnap.exists() ? userDocSnap.data().role : "Staff";
                if (!userDocSnap.exists()) {
                    await setDoc(doc(db, "users", user.uid), { email: user.email, role: "Staff" });
                }
                
                state.user = user;
                resetInactivityTimer(); // Start timer on login
                
                // UI updates for logged-in state
                $("#auth-status-main").textContent = `${user.email} (${state.userRole})`;
                $("#app-container").style.display = "block";
                $("#login-container").style.display = "none";
                $("#loading-container").style.display = "none";
                
                callback(true); // Tell app.js to boot
            } catch (error) {
                console.error("Error handling signed-in user:", error);
                alert("Permission Error: Could not read user data.");
                signOut(auth);
            }
        } else {
            // Handle Sign Out
            state.user = null;
            clearTimeout(inactivityTimeout); // Stop timer
            $("#app-container").style.display = "none";
            $("#login-container").style.display = "block";
            $("#loading-container").style.display = "none";
            
            callback(false); // Tell app.js to reset
        }
    });
}
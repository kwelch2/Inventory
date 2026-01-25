// modules/auth.js
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { app, db } from "./firebase.js";
import { state } from "./state.js";
import { $ } from "./helpers/utils.js";
import { CONFIG } from "./config.js";

export const auth = getAuth(app);

let inactivityTimeout;

/**
 * Resets the inactivity timeout timer.
 * Called on user activity to prevent automatic logout.
 */
export function resetInactivityTimer() {
    clearTimeout(inactivityTimeout);
    if (state.user) {
        inactivityTimeout = setTimeout(() => {
            console.log("Inactivity timeout. Logging out.");
            alert("Session expired due to inactivity. Please log in again.");
            logout();
        }, CONFIG.AUTH.INACTIVITY_TIMEOUT_MS);
    }
}
// Listen for user activity to reset inactivity timer
['mousemove', 'keydown', 'click', 'touchstart'].forEach(evt => window.addEventListener(evt, resetInactivityTimer));

/**
 * Initiates Google OAuth login flow.
 * Restricts login to configured domain.
 */
export function login() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
        'hd': CONFIG.AUTH.ALLOWED_DOMAIN,
        'oauth_web_client_id': CONFIG.AUTH.OAUTH_CLIENT_ID
    });
    signInWithPopup(auth, provider).catch((error) => console.error("Popup Sign-in Error:", error));
}

/**
 * Signs out the current user and cleans up active listeners.
 */
export function logout() {
    // Cleanup any active Firestore listeners before logout
    if (state.unsubscribers && state.unsubscribers.length > 0) {
        state.unsubscribers.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        state.unsubscribers = [];
    }
    return signOut(auth);
}

/**
 * Applies UI permissions based on user role.
 * @param {string} role - User role ('Admin' or 'Staff')
 */
export function applyPermissions(role) {
    const isAdmin = (role === 'Admin');
    document.querySelectorAll('.btn.danger').forEach(btn => {
        btn.style.display = isAdmin ? 'inline-block' : 'none';
    });
}

/**
 * Sets up authentication state listener.
 * @param {Function} callback - Called with true/false when auth state changes
 */
export function onUserHandler(callback) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (!user.email.endsWith(`@${CONFIG.AUTH.ALLOWED_DOMAIN}`)) {
                alert(`Access denied. Please use a valid ${CONFIG.AUTH.ALLOWED_DOMAIN} email account.`);
                return signOut(auth);
            }
            try {
                const userDocSnap = await getDoc(doc(db, CONFIG.COLLECTIONS.USERS, user.uid));
                state.userRole = userDocSnap.exists() ? userDocSnap.data().role : CONFIG.AUTH.DEFAULT_ROLE;
                if (!userDocSnap.exists()) {
                    await setDoc(doc(db, CONFIG.COLLECTIONS.USERS, user.uid), { 
                        email: user.email, 
                        role: CONFIG.AUTH.DEFAULT_ROLE 
                    });
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
// modules/app.js
import { state } from "./state.js";
import { onUserStateChanged, login, logout } from "./auth.js";

console.log("App starting…");

// TRACK LOGIN/LOGOUT
onUserStateChanged((user) => {
  if (user) {
    console.log("Logged in:", user.email);
    state.user = user;
  } else {
    console.log("Logged out.");
    state.user = null;
  }
});

// INJECT TEMPORARY LOGIN BUTTONS FOR TESTING
document.body.insertAdjacentHTML("beforeend", `
  <div style="margin-top:2rem; padding:1rem; border:1px solid #ccc;">
    <button id="loginBtn">Login with Google</button>
    <button id="logoutBtn">Logout</button>
  </div>
`);

document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("logoutBtn").addEventListener("click", logout);

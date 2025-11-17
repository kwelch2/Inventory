// modules/app.js
import { state } from "./state.js";
import { onUserStateChanged, login, logout } from "./auth.js";

console.log("App starting…");

// Track login/logout
onUserStateChanged((user) => {
  if (user) {
    console.log("Logged in:", user.email);
    state.user = user;
  } else {
    console.log("Logged out.");
    state.user = null;
  }
});

// Temporary test buttons so you can confirm login/logout works
document.body.insertAdjacentHTML("beforeend", `
  <div style="margin-top:2rem;">
    <button id="loginBtn">Login with Google</button>
    <button id="logoutBtn">Logout</button>
  </div>
`);

document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("logoutBtn").addEventListener("click", logout);

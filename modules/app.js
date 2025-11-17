// modules/app.js

import { app, db } from "./firebase.js";
import { state } from "./state.js";

console.log("Modules loaded:");
console.log("Firebase App:", app);
console.log("Firestore DB:", db);
console.log("Global State:", state);

<!-- firebase.js -->
<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
  import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

  const firebaseConfig = {
  apiKey: "AIzaSyD7pMc-AHXb1cApzSfImkWvIjM9iwCoym4",
  authDomain: "supplies-ems.firebaseapp.com",
  projectId: "supplies-ems",
  storageBucket: "supplies-ems.firebasestorage.app",
  messagingSenderId: "649560661195",
  appId: "1:649560661195:web:f389f3e620c0c36559cf4e",
  measurementId: "G-EN8MDYD571"
};

  const app = initializeApp(firebaseConfig);
  export const db = getFirestore(app);
</script>

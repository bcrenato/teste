// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAgz6AnxBBKs2E2S90gTKLgIgooMV6dpm8",
  authDomain: "arrecadacao-igreja.firebaseapp.com",
  projectId: "arrecadacao-igreja",
  storageBucket: "arrecadacao-igreja.firebasestorage.app",
  messagingSenderId: "656954653586",
  appId: "1:656954653586:web:ec754d8a505fe9ce089f4b",
  measurementId: "G-J6C4VTCWNP"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

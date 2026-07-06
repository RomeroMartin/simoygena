/* ============================================================
   SIMO & GENA · BABY STORE — Configuración de Firebase
   js/firebase-config.js · Martin Romero Studio

   Inicializa Firebase y exporta las instancias de Firestore (db)
   y Authentication (auth) para usarlas desde el resto de módulos.

   NOTA: estas claves son PÚBLICAS por diseño (van en el frontend).
   La seguridad real la dan las Reglas de Firestore (firestore.rules),
   NO el ocultamiento de estas claves.
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth }      from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDGMYqdVzx24ui_29nSiLYeyg5GGO7hf5k",
  authDomain:        "simoygena-b11c2.firebaseapp.com",
  projectId:         "simoygena-b11c2",
  storageBucket:     "simoygena-b11c2.firebasestorage.app",
  messagingSenderId: "774719023791",
  appId:             "1:774719023791:web:922509d45e2f503fe2025a",
  measurementId:     "G-42X5KQ829G"
};

export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

/* Versión del SDK usada en todo el proyecto (mantener consistente
   en los imports de los demás módulos). */
export const FB_VERSION = "10.14.1";

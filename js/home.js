/* ============================================================
   SIMO & GENA · BABY STORE — Stats del home
   js/home.js · Martin Romero Studio

   Reemplaza el conteo por CSV: cuenta los productos disponibles
   directamente en Firestore con una consulta de agregación
   (getCountFromServer), sin descargar los documentos.
   ============================================================ */

import { db } from './firebase-config.js';
import { collection, query, where, getCountFromServer }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

async function loadProductCount(){
  try{
    const q = query(collection(db, 'productos'), where('disponible', '==', true));
    const snap = await getCountFromServer(q);
    const count = snap.data().count;
    if (count > 0){
      const rounded = Math.floor(count / 5) * 5 || count; // redondea hacia abajo al múltiplo de 5
      const el = document.getElementById('statProductos');
      if (el) el.textContent = '+' + rounded;
    }
  }catch(e){ /* si falla, queda el "+60" hardcodeado como fallback */ }
}

loadProductCount();

/* ============================================================
   SIMO & GENA · BABY STORE — Carrito persistente
   js/cart-sync.js · Martin Romero Studio

   Sincroniza el carrito con la cuenta del cliente:
   - Sin sesión → sigue funcionando con localStorage (como siempre).
   - Con sesión → se guarda en Firestore (carritos/{uid}) y persiste
     entre dispositivos y sesiones.
   - Al iniciar sesión → fusiona el carrito de invitado (localStorage)
     con el de la cuenta.
   - Al cerrar sesión → limpia la vista local (el carrito queda a salvo
     en la cuenta).

   Depende de globals de app.js (script clásico previo): cart, setCart.
   ============================================================ */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let currentUser = null;
let saveTimer = null;

/* Une dos carritos por id (mismo producto/modelo → suma cantidades) */
function mergeCarts(a, b){
  const map = new Map();
  for (const it of [...(a||[]), ...(b||[])]){
    if (!it || !it.id) continue;
    if (map.has(it.id)) map.get(it.id).qty += (it.qty || 0);
    else map.set(it.id, { ...it });
  }
  return [...map.values()].filter(i => i.qty > 0);
}

async function loadRemote(uid){
  try{
    const s = await getDoc(doc(db, 'carritos', uid));
    return (s.exists() && Array.isArray(s.data().items)) ? s.data().items : [];
  }catch(e){ return []; }
}
async function saveRemote(uid){
  try{
    await setDoc(doc(db, 'carritos', uid), {
      clienteUid: uid,
      items: cart,                 // global de app.js
      actualizado: serverTimestamp(),
    });
  }catch(e){ /* silencioso: el carrito local sigue vivo igual */ }
}

onAuthStateChanged(auth, async user => {
  if (user){
    currentUser = user;
    const remote = await loadRemote(user.uid);
    const local  = Array.isArray(cart) ? cart : [];
    const merged = mergeCarts(remote, local);
    setCart(merged);                       // actualiza UI + localStorage
    document.dispatchEvent(new CustomEvent('cart:replaced'));
    await saveRemote(user.uid);            // persiste el carrito fusionado
  } else {
    const wasLogged = currentUser !== null;
    currentUser = null;
    if (wasLogged){                        // fue un cierre de sesión (no carga inicial)
      setCart([]);
      document.dispatchEvent(new CustomEvent('cart:replaced'));
    }
  }
});

/* Cada vez que cambia el carrito, si hay sesión, lo guardamos en la
   cuenta (con debounce para no escribir en cada +/-). */
document.addEventListener('cart:saved', () => {
  if (!currentUser) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveRemote(currentUser.uid), 600);
});

/* ============================================================
   SIMO & GENA · BABY STORE — Estado de sesión en la navbar
   js/auth-ui.js · Martin Romero Studio

   Módulo compartido (index, catálogo, cuenta): muestra en la barra
   "Ingresar" o el menú del usuario. Si el usuario logueado es admin
   (tiene doc en /admins), le agrega el acceso directo al panel, así
   no necesita escribir la URL de /admin a mano.

   La seguridad real la siguen dando las Reglas de Firestore y la
   verificación de rol dentro del panel: este menú es solo comodidad.
   ============================================================ */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function firstName(nombre, email){
  if (nombre && nombre.trim()) return nombre.trim().split(/\s+/)[0];
  return (email || 'Cuenta').split('@')[0];
}

async function esAdmin(uid){
  try{ return (await getDoc(doc(db,'admins',uid))).exists(); }
  catch(e){ return false; }
}
async function nombreCliente(uid){
  try{ const s=await getDoc(doc(db,'clientes',uid)); return s.exists() ? (s.data().nombre||'') : ''; }
  catch(e){ return ''; }
}

function renderLoggedOut(){
  const desktop = document.getElementById('navAccount');
  const mobile  = document.getElementById('mobileAccount');
  if (desktop) desktop.innerHTML = `<a href="cuenta.html" class="account-link">Ingresar</a>`;
  if (mobile)  mobile.innerHTML  = `<a href="cuenta.html">Ingresar / Registrarme</a>`;
}

function renderLoggedIn(user, nombre, isAdmin){
  const nom = firstName(nombre, user.email);
  const adminDesktop = isAdmin ? `<a href="admin/panel.html" class="admin-item">🛠️ Panel de administración</a>` : '';
  const adminMobile  = isAdmin ? `<a href="admin/panel.html" class="admin-item">🛠️ Panel de administración</a>` : '';

  const desktop = document.getElementById('navAccount');
  if (desktop){
    desktop.innerHTML = `
      <div class="account-wrap">
        <button class="account-btn" id="accountBtn" aria-haspopup="true" aria-expanded="false">
          <span class="account-avatar" aria-hidden="true">👤</span>
          <span class="account-name">${esc(nom)}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="account-menu" id="accountMenu">
          <div class="menu-head">Hola, ${esc(nom)}</div>
          <a href="cuenta.html">👤 Mi cuenta</a>
          <a href="cuenta.html#pedidos">🧾 Mis pedidos</a>
          ${adminDesktop}
          <hr>
          <button class="logout" data-logout>Cerrar sesión</button>
        </div>
      </div>`;
    const btn = document.getElementById('accountBtn');
    const menu = document.getElementById('accountMenu');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', e => {
      if (!menu.contains(e.target) && e.target !== btn) { menu.classList.remove('open'); btn.setAttribute('aria-expanded','false'); }
    });
  }

  const mobile = document.getElementById('mobileAccount');
  if (mobile){
    mobile.innerHTML = `
      <a href="cuenta.html">👤 Mi cuenta</a>
      <a href="cuenta.html#pedidos">🧾 Mis pedidos</a>
      ${adminMobile}
      <button class="logout" data-logout>Cerrar sesión</button>`;
  }

  document.querySelectorAll('[data-logout]').forEach(b => b.addEventListener('click', async () => {
    await signOut(auth);
    location.href = 'index.html';
  }));
}

onAuthStateChanged(auth, async user => {
  if (!user){ renderLoggedOut(); return; }
  const [nombre, isAdmin] = await Promise.all([ nombreCliente(user.uid), esAdmin(user.uid) ]);
  renderLoggedIn(user, nombre, isAdmin);
});

/* ============================================================
   SIMO & GENA · BABY STORE — Cuenta del cliente
   js/cuenta.js · Martin Romero Studio

   Registro / login / recuperación / perfil del cliente.
   El estado de sesión en la navbar lo maneja auth-ui.js.
   ============================================================ */

import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, sendPasswordResetEmail, updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, where }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function showMsg(el, text, ok){ el.textContent=text; el.className='msg '+(ok?'ok':'error')+' show'; }
function hideMsg(el){ el.className='msg'; }
function mapAuthError(code){
  switch(code){
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':      return 'Email o contraseña incorrectos.';
    case 'auth/email-already-in-use':return 'Ese email ya tiene una cuenta. Probá ingresando.';
    case 'auth/invalid-email':       return 'El email no parece válido.';
    case 'auth/weak-password':       return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/too-many-requests':   return 'Demasiados intentos. Esperá un momento y probá de nuevo.';
    default: return 'Ocurrió un error. Probá de nuevo.';
  }
}

/* ── Tabs login / registro ── */
function switchTab(which){
  const login = which==='login';
  $('tabLogin').classList.toggle('active', login);
  $('tabRegister').classList.toggle('active', !login);
  $('loginForm').classList.toggle('active', login);
  $('registerForm').classList.toggle('active', !login);
}
$('tabLogin').onclick = () => switchTab('login');
$('tabRegister').onclick = () => switchTab('register');

/* ── LOGIN ── */
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg=$('loginMsg'); hideMsg(msg); $('loginBtn').disabled=true;
  try{
    await signInWithEmailAndPassword(auth, $('lEmail').value.trim(), $('lPass').value);
    // onAuthStateChanged actualiza la vista
  }catch(err){
    $('loginBtn').disabled=false;
    showMsg(msg, mapAuthError(err.code), false);
  }
});

$('resetLink').addEventListener('click', async () => {
  const msg=$('loginMsg'); const email=$('lEmail').value.trim();
  if(!email){ showMsg(msg,'Escribí tu email arriba y volvé a tocar el enlace.',false); return; }
  try{ await sendPasswordResetEmail(auth,email); showMsg(msg,'Te enviamos un email para restablecer la contraseña.',true); }
  catch(err){ showMsg(msg, mapAuthError(err.code), false); }
});

/* ── REGISTRO ── */
$('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg=$('registerMsg'); hideMsg(msg);
  const nombre=$('rNombre').value.trim();
  const email=$('rEmail').value.trim();
  const telefono=$('rTel').value.trim();
  const pass=$('rPass').value;
  if(!nombre){ showMsg(msg,'Poné tu nombre y apellido.',false); return; }
  if(pass.length<6){ showMsg(msg,'La contraseña debe tener al menos 6 caracteres.',false); return; }
  $('registerBtn').disabled=true;
  try{
    const cred=await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName:nombre });
    await setDoc(doc(db,'clientes',cred.user.uid), {
      uid:cred.user.uid, nombre, email, telefono,
      direccion:{ calle:'', numero:'', ciudad:'', cp:'', provincia:'', notas:'' },
      creado:serverTimestamp(), ultimoAcceso:serverTimestamp(),
    });
    // onAuthStateChanged muestra la cuenta
  }catch(err){
    $('registerBtn').disabled=false;
    showMsg(msg, mapAuthError(err.code), false);
  }
});

/* ── PERFIL ── */
async function cargarPerfil(user){
  $('accEmail').textContent = user.email;
  try{
    const s=await getDoc(doc(db,'clientes',user.uid));
    const c = s.exists() ? s.data() : {};
    const nombreMostrar = (c.nombre || user.displayName || '').trim();
    $('greeting').textContent = 'Hola ' + (nombreMostrar ? nombreMostrar.split(/\s+/)[0] : '') + ' 👋';
    $('pNombre').value = c.nombre || user.displayName || '';
    $('pTel').value = c.telefono || '';
    const d = c.direccion || {};
    $('pCalle').value=d.calle||''; $('pNumero').value=d.numero||'';
    $('pCiudad').value=d.ciudad||''; $('pCp').value=d.cp||'';
    $('pProvincia').value=d.provincia||''; $('pNotas').value=d.notas||'';
    // Registrar último acceso (no bloqueante)
    setDoc(doc(db,'clientes',user.uid), { ultimoAcceso:serverTimestamp() }, { merge:true }).catch(()=>{});
  }catch(e){ /* si no hay doc aún, se completa al guardar */ }
}

$('profileForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg=$('profileMsg'); hideMsg(msg);
  const user=auth.currentUser; if(!user) return;
  const data={
    nombre:$('pNombre').value.trim(),
    telefono:$('pTel').value.trim(),
    direccion:{
      calle:$('pCalle').value.trim(), numero:$('pNumero').value.trim(),
      ciudad:$('pCiudad').value.trim(), cp:$('pCp').value.trim(),
      provincia:$('pProvincia').value.trim(), notas:$('pNotas').value.trim(),
    },
    actualizado:serverTimestamp(),
  };
  $('profileBtn').disabled=true;
  try{
    await setDoc(doc(db,'clientes',user.uid), data, { merge:true });
    if(data.nombre && data.nombre!==user.displayName){ try{ await updateProfile(user,{displayName:data.nombre}); }catch(_){} }
    showMsg(msg,'Datos guardados.',true);
  }catch(err){ showMsg(msg,'No se pudo guardar: '+err.message,false); }
  finally{ $('profileBtn').disabled=false; }
});

/* ── HISTORIAL DE PEDIDOS ── */
const ESTADOS = {
  pendiente:  { label:'Pendiente',  bg:'#fff3df', color:'#c77700' },
  contactado: { label:'Contactado', bg:'#eef1ff', color:'#4557b5' },
  pagado:     { label:'Pagado',     bg:'#e8f5ec', color:'#2e7d32' },
  enviado:    { label:'Enviado',    bg:'#e6f6f2', color:'#2c7a68' },
  entregado:  { label:'Entregado',  bg:'#e5f5ec', color:'#2e7d32' },
  cancelado:  { label:'Cancelado',  bg:'#fdecea', color:'#c0392b' },
};
function fechaLegible(ts){
  try{ const d = ts?.toDate ? ts.toDate() : null; return d ? d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'}) : ''; }
  catch(e){ return ''; }
}
async function cargarPedidos(uid){
  const box = $('pedidosBox');
  try{
    const snap = await getDocs(query(collection(db,'pedidos'), where('clienteUid','==',uid)));
    const list = [];
    snap.forEach(d => list.push({ id:d.id, ...d.data() }));
    list.sort((a,b) => (b.creado?.seconds||0) - (a.creado?.seconds||0));
    if(!list.length){
      box.innerHTML = '<div class="pedidos-empty">Todavía no tenés pedidos. Cuando hagas uno, va a aparecer acá.</div>';
      return;
    }
    box.innerHTML = list.map(p => {
      const est = ESTADOS[p.estado] || { label:p.estado||'—', bg:'#eee', color:'#666' };
      const items = (p.items||[]).map(i => `${esc(i.nombre)} ×${i.cantidad}`).join(' · ');
      return `<div class="pedido-item">
        <div class="pedido-top">
          <span class="pedido-id">#${esc(p.id.slice(0,8).toUpperCase())}</span>
          <span class="pedido-estado" style="background:${est.bg};color:${est.color};">${esc(est.label)}</span>
        </div>
        <div class="pedido-fecha">${fechaLegible(p.creado)} · ${p.metodoEntrega==='envio'?'Envío':'Retiro'}</div>
        <div class="pedido-items">${items}</div>
        <div class="pedido-total">Total: $${(Number(p.total)||0).toLocaleString('es-AR')}</div>
      </div>`;
    }).join('');
  }catch(e){
    box.innerHTML = '<div class="pedidos-empty">No pudimos cargar tus pedidos ahora. Probá recargar la página.</div>';
  }
}

$('logoutBtn2').onclick = () => signOut(auth).then(()=>location.href='index.html');

/* ── Estado de sesión ── */
onAuthStateChanged(auth, async user => {
  $('cuentaLoading').style.display='none';
  if(user){
    $('authSection').style.display='none';
    $('accountSection').style.display='block';
    await cargarPerfil(user);
    cargarPedidos(user.uid);
  }else{
    $('accountSection').style.display='none';
    $('authSection').style.display='block';
  }
});

/* ============================================================
   SIMO & GENA · BABY STORE — Panel de administración
   js/admin.js · Martin Romero Studio

   Un solo módulo para las dos páginas del panel:
     - admin/index.html  → login (detecta #loginForm)
     - admin/panel.html  → panel  (detecta #panelRoot)

   Seguridad: solo entra quien tenga su UID en la colección "admins"
   (se verifica leyendo ese doc). Las Reglas de Firestore son la
   barrera real; esta verificación es para la experiencia de usuario.
   ============================================================ */

import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const CATEGORIAS = ['Indumentaria','Blanqueria','Accesorios','Sensorial'];
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function driveUrl(url){
  url=(url||'').trim();
  if(url.includes('drive.google.com')){
    const m=url.match(/\/d\/(.+?)(?:\/|$)/)||url.match(/[?&]id=([^&]+)/);
    if(m&&m[1])return`https://lh3.googleusercontent.com/d/${m[1]}=w400`;
  }
  return url;
}
async function esAdmin(uid){
  try{ const s=await getDoc(doc(db,'admins',uid)); return s.exists(); }
  catch(e){ return false; }
}
function showMsg(el, text, ok){
  el.textContent=text; el.className='msg '+(ok?'ok':'error')+' show';
}
function hideMsg(el){ el.className='msg'; }

/* ── Diálogo de confirmación propio (no usa el confirm() nativo,
   que algunos navegadores suprimen). Devuelve una promesa. ── */
function confirmDialog(message, { okText='Borrar', danger=true } = {}){
  return new Promise(resolve=>{
    let ov=document.getElementById('confirmOverlay');
    if(!ov){
      ov=document.createElement('div');
      ov.id='confirmOverlay'; ov.className='overlay';
      ov.style.zIndex='60';
      ov.innerHTML=`<div class="modal" style="max-width:420px;margin:auto;">
        <h2 style="margin-bottom:10px;">Confirmar</h2>
        <p id="confirmMsg" style="color:var(--muted);font-size:.92rem;"></p>
        <div class="modal-actions">
          <button class="btn ghost" id="confirmNo">Cancelar</button>
          <button class="btn" id="confirmYes"></button>
        </div>
      </div>`;
      document.body.appendChild(ov);
    }
    const msgEl=ov.querySelector('#confirmMsg');
    const yes=ov.querySelector('#confirmYes');
    const no=ov.querySelector('#confirmNo');
    msgEl.textContent=message;
    yes.textContent=okText;
    yes.className='btn '+(danger?'danger':'');
    ov.classList.add('open');
    yes.focus();
    const cleanup=()=>{ ov.classList.remove('open'); yes.onclick=no.onclick=ov.onclick=document.onkeydown=null; };
    yes.onclick=()=>{ cleanup(); resolve(true); };
    no.onclick=()=>{ cleanup(); resolve(false); };
    ov.onclick=e=>{ if(e.target===ov){ cleanup(); resolve(false); } };
    document.onkeydown=e=>{ if(e.key==='Escape'){ cleanup(); resolve(false); } };
  });
}

/* ============================================================
   PÁGINA DE LOGIN
   ============================================================ */
function initLogin(){
  const form=$('loginForm'), msg=$('loginMsg'), btn=$('loginBtn');

  onAuthStateChanged(auth, async user=>{
    if(user && await esAdmin(user.uid)){
      location.href='panel.html';
    }else if(user){
      showMsg(msg,'Esa cuenta no tiene permisos de administradora.',false);
      await signOut(auth);
    }
  });

  form.addEventListener('submit', async e=>{
    e.preventDefault(); hideMsg(msg); btn.disabled=true;
    try{
      await signInWithEmailAndPassword(auth, $('email').value.trim(), $('pass').value);
      // el redirect lo maneja onAuthStateChanged
    }catch(err){
      btn.disabled=false;
      const m = err.code==='auth/invalid-credential' || err.code==='auth/wrong-password' || err.code==='auth/user-not-found'
        ? 'Email o contraseña incorrectos.' : 'No se pudo iniciar sesión. Probá de nuevo.';
      showMsg(msg,m,false);
    }
  });

  $('resetLink').addEventListener('click', async e=>{
    e.preventDefault();
    const email=$('email').value.trim();
    if(!email){ showMsg(msg,'Escribí tu email arriba y volvé a tocar el enlace.',false); return; }
    try{ await sendPasswordResetEmail(auth,email); showMsg(msg,'Te enviamos un email para restablecer la contraseña.',true); }
    catch(err){ showMsg(msg,'No se pudo enviar el email de recuperación.',false); }
  });
}

/* ============================================================
   PÁGINA DEL PANEL
   ============================================================ */
let productos=[];   // todos (incluye ocultos)
let currentTab='productos';

function initPanel(){
  onAuthStateChanged(auth, async user=>{
    if(!user){ location.href='index.html'; return; }
    if(!await esAdmin(user.uid)){ alert('Tu cuenta no tiene permisos de administradora.'); await signOut(auth); location.href='index.html'; return; }
    // Autorizada
    $('userEmail').textContent=user.email;
    $('panelRoot').style.display='block';
    wireTabs(); wireProductForm(); wireConfig();
    $('logoutBtn').onclick=()=>signOut(auth).then(()=>location.href='index.html');
    await cargarProductos();
    await cargarConfig();
  });
}

function wireTabs(){
  document.querySelectorAll('.tab-btn').forEach(b=>{
    b.onclick=()=>{
      currentTab=b.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(x=>x.classList.toggle('active',x===b));
      document.querySelectorAll('.panel-tab').forEach(s=>s.classList.toggle('active', s.id==='tab-'+currentTab));
      if(currentTab==='stock') renderStock();
    };
  });
  $('prodSearch').addEventListener('input', renderProductos);
  $('stockSearch').addEventListener('input', renderStock);
  $('btnNuevo').onclick=()=>openForm(null);
}

async function cargarProductos(){
  const snap=await getDocs(collection(db,'productos'));
  productos=[];
  snap.forEach(d=>productos.push({ id:d.id, ...d.data() }));
  productos.sort((a,b)=>((a.orden||0)-(b.orden||0))||String(a.nombre).localeCompare(String(b.nombre),'es'));
  renderProductos();
  if(currentTab==='stock') renderStock();
}

/* Resumen de stock de un producto */
function stockInfo(p){
  if(p.tiene_variantes && Array.isArray(p.modelos)){
    const total=p.modelos.reduce((s,m)=>s+(Number(m.stock)||0),0);
    const zero=p.modelos.filter(m=>(Number(m.stock)||0)<=0).length;
    return { total, zero, count:p.modelos.length, esVariante:true };
  }
  return { total:Number(p.stock)||0, zero:(Number(p.stock)||0)<=0?1:0, count:1, esVariante:false };
}
function stockClass(n){ return n<=0?'stock-zero':(n<=3?'stock-low':'stock-ok'); }

/* ── Tabla de productos ── */
function renderProductos(){
  const q=($('prodSearch').value||'').trim().toLowerCase();
  const list=productos.filter(p=>!q || String(p.nombre).toLowerCase().includes(q) || String(p.categoria).toLowerCase().includes(q));
  $('prodCount').textContent=`${list.length} de ${productos.length} productos`;
  const body=$('prodBody');
  if(!list.length){ body.innerHTML='<tr><td colspan="8" class="loading">Sin resultados.</td></tr>'; return; }
  body.innerHTML=list.map(p=>{
    const img=(Array.isArray(p.imagenes)&&p.imagenes[0])?`<img class="thumb" src="${esc(driveUrl(p.imagenes[0]))}" alt="" onerror="this.style.visibility='hidden'">`:`<div class="thumb"></div>`;
    const si=stockInfo(p);
    const stockTxt=si.esVariante
      ? `<span class="stock-badge ${stockClass(si.total)}">${si.total}</span> <span class="hint">(${si.count} mod.${si.zero?`, ${si.zero} sin stock`:''})</span>`
      : `<span class="stock-badge ${stockClass(si.total)}">${si.total}</span>`;
    return `<tr>
      <td>${img}</td>
      <td><strong>${esc(p.nombre)}</strong></td>
      <td class="hide-sm">${esc(p.categoria)}</td>
      <td>$${(Number(p.precio)||0).toLocaleString('es-AR')}</td>
      <td class="hide-sm">${stockTxt}</td>
      <td><label class="switch"><input type="checkbox" ${p.disponible?'checked':''} data-toggle="disponible" data-id="${esc(p.id)}"><span class="slider"></span></label></td>
      <td class="hide-sm"><label class="switch"><input type="checkbox" ${p.destacado?'checked':''} data-toggle="destacado" data-id="${esc(p.id)}"><span class="slider"></span></label></td>
      <td class="actions">
        <button class="btn ghost sm" data-edit="${esc(p.id)}">Editar</button>
        <button class="btn danger sm" data-del="${esc(p.id)}">Borrar</button>
      </td>
    </tr>`;
  }).join('');
  // wire acciones
  body.querySelectorAll('[data-toggle]').forEach(inp=>inp.onchange=()=>toggleCampo(inp.dataset.id, inp.dataset.toggle, inp.checked));
  body.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openForm(b.dataset.edit));
  body.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>borrarProducto(b.dataset.del));
}

async function toggleCampo(id, campo, val){
  try{
    await updateDoc(doc(db,'productos',id), { [campo]:val, actualizado:serverTimestamp() });
    const p=productos.find(x=>x.id===id); if(p) p[campo]=val;
  }catch(e){ alert('No se pudo guardar el cambio: '+e.message); renderProductos(); }
}

async function borrarProducto(id){
  const p=productos.find(x=>x.id===id);
  const ok=await confirmDialog(`¿Borrar "${p?.nombre||id}"? Esta acción no se puede deshacer.`, { okText:'Borrar', danger:true });
  if(!ok) return;
  try{
    await deleteDoc(doc(db,'productos',id));
    productos=productos.filter(x=>x.id!==id);
    renderProductos(); if(currentTab==='stock') renderStock();
  }catch(e){ alert('No se pudo borrar: '+e.message); }
}

/* ── FORM (alta / edición) ── */
function wireProductForm(){
  $('btnCancelar').onclick=closeForm;
  $('prodOverlay').addEventListener('click', e=>{ if(e.target===$('prodOverlay')) closeForm(); });
  $('pTieneVariantes').onchange=()=>toggleVariantesUI($('pTieneVariantes').checked);
  $('btnAddVariante').onclick=()=>addVarianteRow('',1);
  $('prodForm').addEventListener('submit', guardarProducto);
}
function toggleVariantesUI(on){
  $('variantesBox').style.display=on?'block':'none';
  $('stockSimpleBox').style.display=on?'none':'block';
  if(on && !$('variantesRows').children.length) addVarianteRow('',1);
}
function addVarianteRow(nombre,stock){
  const row=document.createElement('div');
  row.className='variante-row';
  row.innerHTML=`<input class="vn" placeholder="Nombre del modelo (ej. Rojo)" value="${esc(nombre)}">
    <input class="vs" type="number" min="0" step="1" value="${Number(stock)||0}" aria-label="Stock">
    <button type="button" class="btn ghost sm" aria-label="Quitar">✕</button>`;
  row.querySelector('button').onclick=()=>row.remove();
  $('variantesRows').appendChild(row);
}
function openForm(id){
  hideMsg($('formMsg'));
  $('prodForm').reset();
  $('variantesRows').innerHTML='';
  if(id){
    const p=productos.find(x=>x.id===id); if(!p) return;
    $('modalTitle').textContent='Editar producto';
    $('pId').value=p.id;
    $('pNombre').value=p.nombre||'';
    $('pCategoria').value=CATEGORIAS.includes(p.categoria)?p.categoria:'';
    $('pPrecio').value=Number(p.precio)||0;
    $('pDesc').value=p.descripcion||'';
    $('pDescLarga').value=p.descripcion_larga||'';
    $('pImagenes').value=(Array.isArray(p.imagenes)?p.imagenes:[]).join('\n');
    $('pDisponible').checked=p.disponible!==false;
    $('pDestacado').checked=p.destacado===true;
    $('pOrden').value=Number(p.orden)||0;
    const tv=p.tiene_variantes===true;
    $('pTieneVariantes').checked=tv;
    if(tv){ (p.modelos||[]).forEach(m=>addVarianteRow(m.nombre, m.stock)); }
    else { $('pStock').value=Number(p.stock)||0; }
    toggleVariantesUI(tv);
  }else{
    $('modalTitle').textContent='Nuevo producto';
    $('pId').value=''; $('pStock').value=1; $('pOrden').value=0;
    $('pDisponible').checked=true;
    toggleVariantesUI(false);
  }
  $('prodOverlay').classList.add('open');
}
function closeForm(){ $('prodOverlay').classList.remove('open'); }

async function guardarProducto(e){
  e.preventDefault();
  const msg=$('formMsg'); hideMsg(msg);
  const nombre=$('pNombre').value.trim();
  const categoria=$('pCategoria').value;
  const precio=Math.max(0, Math.floor(Number($('pPrecio').value)||0));
  const descripcion=$('pDesc').value.trim();
  // Validaciones
  if(!nombre){ showMsg(msg,'El nombre es obligatorio.',false); return; }
  if(!CATEGORIAS.includes(categoria)){ showMsg(msg,'Elegí una categoría válida.',false); return; }
  if(!descripcion){ showMsg(msg,'La descripción corta es obligatoria.',false); return; }

  const tiene_variantes=$('pTieneVariantes').checked;
  let modelos=[], stock=0;
  if(tiene_variantes){
    const rows=[...$('variantesRows').querySelectorAll('.variante-row')];
    modelos=rows.map(r=>({ nombre:r.querySelector('.vn').value.trim(), stock:Math.max(0,Math.floor(Number(r.querySelector('.vs').value)||0)) }))
                .filter(m=>m.nombre);
    if(modelos.length<2){ showMsg(msg,'Si tiene modelos, cargá al menos 2 (o desmarcá la opción).',false); return; }
  }else{
    stock=Math.max(0, Math.floor(Number($('pStock').value)||0));
  }

  const imagenes=$('pImagenes').value.split(/[\n,]/).map(u=>u.trim()).filter(u=>u);

  const data={
    nombre, categoria, precio, descripcion,
    descripcion_larga:$('pDescLarga').value.trim(),
    imagenes, emoji:'',
    tiene_variantes, modelos, stock,
    disponible:$('pDisponible').checked,
    destacado:$('pDestacado').checked,
    orden:Math.floor(Number($('pOrden').value)||0),
    actualizado:serverTimestamp(),
  };

  const id=$('pId').value;
  $('btnGuardar').disabled=true;
  try{
    if(id){
      await updateDoc(doc(db,'productos',id), data);
    }else{
      data.creado=serverTimestamp();
      await addDoc(collection(db,'productos'), data);
    }
    closeForm();
    await cargarProductos();
  }catch(err){
    showMsg(msg,'No se pudo guardar: '+err.message,false);
  }finally{
    $('btnGuardar').disabled=false;
  }
}

/* ── TAB STOCK: edición inline ── */
function renderStock(){
  const q=($('stockSearch').value||'').trim().toLowerCase();
  const list=productos.filter(p=>!q || String(p.nombre).toLowerCase().includes(q));
  const body=$('stockBody');
  if(!list.length){ body.innerHTML='<tr><td colspan="3" class="loading">Sin resultados.</td></tr>'; return; }
  const rows=[];
  for(const p of list){
    if(p.tiene_variantes && Array.isArray(p.modelos) && p.modelos.length){
      p.modelos.forEach((m,idx)=>{
        rows.push(`<tr>
          <td>${idx===0?`<strong>${esc(p.nombre)}</strong>`:''}</td>
          <td>${esc(m.nombre)}</td>
          <td>${stockInput(p.id, Number(m.stock)||0, idx)}</td>
        </tr>`);
      });
    }else{
      rows.push(`<tr>
        <td><strong>${esc(p.nombre)}</strong></td>
        <td class="hint">— unidad simple —</td>
        <td>${stockInput(p.id, Number(p.stock)||0, null)}</td>
      </tr>`);
    }
  }
  body.innerHTML=rows.join('');
  body.querySelectorAll('input[data-sid]').forEach(inp=>{
    inp.onchange=()=>guardarStock(inp.dataset.sid, inp.dataset.midx===''?null:Number(inp.dataset.midx), inp);
  });
}
function stockInput(id, val, midx){
  const cls=stockClass(val);
  const emoji=val<=0?'🔴':(val<=3?'🟠':'🟢');
  return `${emoji} <input type="number" min="0" step="1" value="${val}" class="${cls}" style="width:90px;" data-sid="${esc(id)}" data-midx="${midx===null?'':midx}" aria-label="Stock">`;
}
async function guardarStock(id, midx, inp){
  const val=Math.max(0, Math.floor(Number(inp.value)||0));
  inp.value=val;
  const p=productos.find(x=>x.id===id); if(!p) return;
  try{
    if(midx===null){
      await updateDoc(doc(db,'productos',id), { stock:val, actualizado:serverTimestamp() });
      p.stock=val;
    }else{
      const modelos=(p.modelos||[]).map((m,i)=> i===midx ? {...m, stock:val} : m);
      await updateDoc(doc(db,'productos',id), { modelos, actualizado:serverTimestamp() });
      p.modelos=modelos;
    }
    inp.className=stockClass(val);
    // refrescar emoji del renglón
    renderStock();
  }catch(e){ alert('No se pudo guardar el stock: '+e.message); }
}

/* ── TAB CONFIG ── */
function wireConfig(){ $('btnGuardarConfig').onclick=guardarConfig; }
async function cargarConfig(){
  try{
    const s=await getDoc(doc(db,'config','general'));
    if(s.exists()){
      const c=s.data();
      $('cfgWhatsapp').value=c.whatsapp||''; $('cfgInstagram').value=c.instagram||'';
      $('cfgEmail').value=c.email||''; $('cfgEnvio').value=c.envio_texto||'';
    }
  }catch(e){ /* ignore */ }
}
async function guardarConfig(){
  const msg=$('cfgMsg'); hideMsg(msg);
  const data={
    whatsapp:$('cfgWhatsapp').value.trim(),
    instagram:$('cfgInstagram').value.trim(),
    email:$('cfgEmail').value.trim(),
    envio_texto:$('cfgEnvio').value.trim(),
    actualizado:serverTimestamp(),
  };
  try{ await setDoc(doc(db,'config','general'), data, {merge:true}); showMsg(msg,'Datos guardados.',true); }
  catch(e){ showMsg(msg,'No se pudo guardar: '+e.message,false); }
}

/* ============================================================
   ARRANQUE — detecta qué página es
   ============================================================ */
if($('loginForm'))      initLogin();
else if($('panelRoot')) initPanel();

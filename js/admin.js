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
      if(currentTab==='pedidos' || currentTab==='clientes') cargarPedidosYClientes();
    };
  });
  $('prodSearch').addEventListener('input', renderProductos);
  $('stockSearch').addEventListener('input', renderStock);
  $('btnNuevo').onclick=()=>openForm(null);
  $('pedSearch').addEventListener('input', renderPedidos);
  $('pedEstadoFilter').addEventListener('change', renderPedidos);
  $('cliSearch').addEventListener('input', renderClientes);
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
   TAB PEDIDOS + CLIENTES
   ============================================================ */
let pedidos=[], clientes=[], ordersLoaded=false;

const EST_PED = {
  pendiente:  { l:'Pendiente',  bg:'#fff3df', c:'#c77700' },
  contactado: { l:'Contactado', bg:'#eef1ff', c:'#4557b5' },
  pagado:     { l:'Pagado',     bg:'#e8f5ec', c:'#2e7d32' },
  enviado:    { l:'Enviado',    bg:'#e6f6f2', c:'#2c7a68' },
  entregado:  { l:'Entregado',  bg:'#e5f5ec', c:'#2e7d32' },
  cancelado:  { l:'Cancelado',  bg:'#fdecea', c:'#c0392b' },
};
const EST_ORDER = ['pendiente','contactado','pagado','enviado','entregado','cancelado'];

function fechaPed(ts){
  try{ const d = ts?.toDate ? ts.toDate() : null;
    return d ? d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'}) + ' ' + d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}) : '';
  }catch(e){ return ''; }
}
/* Normaliza un teléfono argentino a formato wa.me */
function waLink(tel){
  let t = String(tel||'').replace(/\D/g,'');
  if(!t) return null;
  if(!t.startsWith('54')) t = '549' + t;
  return t;
}

/* Overlay genérico para modales de detalle (usa .overlay/.modal de admin.css) */
function openOverlay(innerHTML){
  let ov=document.getElementById('genOverlay');
  if(!ov){
    ov=document.createElement('div'); ov.id='genOverlay'; ov.className='overlay'; ov.style.zIndex='55';
    document.body.appendChild(ov);
    ov.addEventListener('click', e=>{ if(e.target===ov) closeOverlay(); });
  }
  ov.innerHTML=`<div class="modal" style="max-width:520px;margin:auto;">${innerHTML}</div>`;
  ov.classList.add('open');
  ov.querySelectorAll('[data-close-ov]').forEach(b=>b.onclick=closeOverlay);
}
function closeOverlay(){ const ov=document.getElementById('genOverlay'); if(ov){ ov.classList.remove('open'); ov.innerHTML=''; } }

async function cargarPedidosYClientes(){
  if(ordersLoaded){ renderPedidos(); renderClientes(); return; }
  try{
    const [ps, cs] = await Promise.all([ getDocs(collection(db,'pedidos')), getDocs(collection(db,'clientes')) ]);
    pedidos=[]; ps.forEach(d=>pedidos.push({ id:d.id, ...d.data() }));
    pedidos.sort((a,b)=>(b.creado?.seconds||0)-(a.creado?.seconds||0));
    clientes=[]; cs.forEach(d=>clientes.push({ id:d.id, ...d.data() }));
    ordersLoaded=true;
    renderPedidos(); renderClientes();
  }catch(e){
    $('pedBody').innerHTML=`<tr><td colspan="6" class="loading">No se pudieron cargar los pedidos: ${esc(e.message)}</td></tr>`;
    $('cliBody').innerHTML=`<tr><td colspan="6" class="loading">No se pudieron cargar los clientes.</td></tr>`;
  }
}

function renderPedidos(){
  const q=($('pedSearch').value||'').trim().toLowerCase();
  const est=$('pedEstadoFilter').value;
  const list=pedidos.filter(p=>{
    if(est && p.estado!==est) return false;
    if(!q) return true;
    const cod=p.id.slice(0,8).toLowerCase();
    return cod.includes(q) || String(p.clienteNombre||'').toLowerCase().includes(q) || String(p.clienteEmail||'').toLowerCase().includes(q);
  });
  $('pedCount').textContent=`${list.length} de ${pedidos.length} pedidos`;
  const body=$('pedBody');
  if(!list.length){ body.innerHTML='<tr><td colspan="6" class="loading">Sin pedidos.</td></tr>'; return; }
  body.innerHTML=list.map(p=>{
    const options=EST_ORDER.map(e=>`<option value="${e}"${p.estado===e?' selected':''}>${EST_PED[e].l}</option>`).join('');
    const wa=waLink(p.clienteTelefono);
    const est=EST_PED[p.estado]||{bg:'#eee',c:'#666'};
    return `<tr>
      <td><strong>#${esc(p.id.slice(0,8).toUpperCase())}</strong></td>
      <td>${esc(p.clienteNombre||'—')}<div class="hint">${esc(p.clienteEmail||'')}</div></td>
      <td class="hide-sm">${fechaPed(p.creado)}</td>
      <td>$${(Number(p.total)||0).toLocaleString('es-AR')}</td>
      <td><select data-estado="${esc(p.id)}" style="border-color:${est.c};color:${est.c};font-weight:800;">${options}</select></td>
      <td class="actions">
        <button class="btn ghost sm" data-ver="${esc(p.id)}">Ver</button>
        ${wa?`<a class="btn sm" style="background:#25D366;text-decoration:none;" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent('¡Hola '+(p.clienteNombre||'')+'! Sobre tu pedido #'+p.id.slice(0,8).toUpperCase()+' en Simo & Gena 🦕')}">WhatsApp</a>`:''}
      </td>
    </tr>`;
  }).join('');
  body.querySelectorAll('[data-estado]').forEach(sel=>sel.onchange=()=>cambiarEstado(sel.dataset.estado, sel.value));
  body.querySelectorAll('[data-ver]').forEach(b=>b.onclick=()=>detallePedido(b.dataset.ver));
}

async function cambiarEstado(id, nuevo){
  try{
    await updateDoc(doc(db,'pedidos',id), { estado:nuevo, actualizado:serverTimestamp() });
    const p=pedidos.find(x=>x.id===id); if(p) p.estado=nuevo;
    renderPedidos();
  }catch(e){ alert('No se pudo cambiar el estado: '+e.message); renderPedidos(); }
}

function detallePedido(id){
  const p=pedidos.find(x=>x.id===id); if(!p) return;
  const items=(p.items||[]).map(i=>`<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;"><span>${esc(i.nombre)} ×${i.cantidad}</span><span>$${(Number(i.subtotal)||0).toLocaleString('es-AR')}</span></div>`).join('');
  const d=p.direccionEnvio;
  const dirTxt = (p.metodoEntrega==='envio' && d)
    ? [ [d.calle,d.numero].filter(Boolean).join(' '), d.ciudad, d.cp&&('CP '+d.cp), d.provincia ].filter(Boolean).join(', ')
    : 'Retiro coordinado';
  const wa=waLink(p.clienteTelefono);
  openOverlay(`
    <h2>Pedido #${esc(p.id.slice(0,8).toUpperCase())}</h2>
    <p class="hint" style="margin-bottom:12px;">${fechaPed(p.creado)}</p>
    <div style="background:#faf9f6;border-radius:12px;padding:12px 14px;font-size:.86rem;">
      ${items}
      <div style="display:flex;justify-content:space-between;font-weight:900;color:var(--turquesa-ink);border-top:1px solid #eee;margin-top:6px;padding-top:6px;"><span>Total</span><span>$${(Number(p.total)||0).toLocaleString('es-AR')}</span></div>
    </div>
    <p style="margin-top:14px;font-size:.88rem;"><strong>Cliente:</strong> ${esc(p.clienteNombre||'—')}<br><strong>Email:</strong> ${esc(p.clienteEmail||'—')}<br><strong>Teléfono:</strong> ${esc(p.clienteTelefono||'—')}</p>
    <p style="margin-top:8px;font-size:.88rem;"><strong>Entrega:</strong> ${p.metodoEntrega==='envio'?'Envío a domicilio':'Retiro'}<br><strong>Dirección:</strong> ${esc(dirTxt)}</p>
    ${p.notas?`<p style="margin-top:8px;font-size:.88rem;"><strong>Notas:</strong> ${esc(p.notas)}</p>`:''}
    <div class="modal-actions">
      ${wa?`<a class="btn" style="background:#25D366;text-decoration:none;" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent('¡Hola '+(p.clienteNombre||'')+'! Sobre tu pedido #'+p.id.slice(0,8).toUpperCase())}">Escribir por WhatsApp</a>`:''}
      <button class="btn ghost" data-close-ov>Cerrar</button>
    </div>
  `);
}

function renderClientes(){
  const q=($('cliSearch').value||'').trim().toLowerCase();
  const list=clientes.filter(c=>!q || String(c.nombre||'').toLowerCase().includes(q) || String(c.email||'').toLowerCase().includes(q));
  $('cliCount').textContent=`${list.length} de ${clientes.length} clientes`;
  const body=$('cliBody');
  if(!list.length){ body.innerHTML='<tr><td colspan="6" class="loading">Sin clientes.</td></tr>'; return; }
  body.innerHTML=list.map(c=>{
    const uid=c.uid||c.id;
    const nPed=pedidos.filter(p=>p.clienteUid===uid).length;
    const d=c.direccion||{};
    return `<tr>
      <td><strong>${esc(c.nombre||'—')}</strong></td>
      <td class="hide-sm">${esc(c.email||'')}</td>
      <td>${esc(c.telefono||'—')}</td>
      <td class="hide-sm">${esc(d.ciudad||'—')}</td>
      <td>${nPed}</td>
      <td class="actions"><button class="btn ghost sm" data-cli="${esc(uid)}">Ver pedidos</button></td>
    </tr>`;
  }).join('');
  body.querySelectorAll('[data-cli]').forEach(b=>b.onclick=()=>verPedidosCliente(b.dataset.cli));
}

function verPedidosCliente(uid){
  const c=clientes.find(x=>(x.uid||x.id)===uid);
  const suyos=pedidos.filter(p=>p.clienteUid===uid);
  const rows=suyos.length ? suyos.map(p=>`<div style="border:1px solid #eee;border-radius:10px;padding:10px;margin-bottom:8px;font-size:.85rem;">
      <div style="display:flex;justify-content:space-between;"><strong>#${esc(p.id.slice(0,8).toUpperCase())}</strong><span>$${(Number(p.total)||0).toLocaleString('es-AR')}</span></div>
      <div class="hint">${fechaPed(p.creado)} · ${esc(EST_PED[p.estado]?.l||p.estado||'')}</div>
    </div>`).join('') : '<p class="hint">Este cliente todavía no hizo pedidos.</p>';
  const d=(c&&c.direccion)||{};
  const dirTxt=[[d.calle,d.numero].filter(Boolean).join(' '), d.ciudad, d.provincia].filter(Boolean).join(', ') || 'Sin dirección cargada';
  openOverlay(`
    <h2>${esc(c?.nombre||'Cliente')}</h2>
    <p style="font-size:.88rem;margin-bottom:4px;">${esc(c?.email||'')} · ${esc(c?.telefono||'')}</p>
    <p class="hint" style="margin-bottom:14px;">${esc(dirTxt)}</p>
    <p style="font-weight:800;margin-bottom:8px;">Pedidos (${suyos.length})</p>
    ${rows}
    <div class="modal-actions"><button class="btn ghost" data-close-ov>Cerrar</button></div>
  `);
}

/* ============================================================
   ARRANQUE — detecta qué página es
   ============================================================ */
if($('loginForm'))      initLogin();
else if($('panelRoot')) initPanel();

/* ============================================================
   SIMO & GENA · BABY STORE — Checkout / creación de pedidos
   js/checkout.js · Martin Romero Studio

   Al confirmar el carrito:
   - Cliente logueado → crea el pedido en Firestore (estado "pendiente"),
     abre WhatsApp con el código del pedido y vacía el carrito.
   - Invitado → ofrece iniciar sesión o seguir directo por WhatsApp
     (comportamiento de siempre, sin pedido guardado).

   Reemplaza el onclick del botón del carrito por checkout().
   Depende de globals de app.js: cart, setCart, WA, sendToWhatsApp.
   ============================================================ */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, addDoc, doc, getDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let currentUser = null;
let clienteData = null;

onAuthStateChanged(auth, async user => {
  currentUser = user || null;
  clienteData = null;
  if (user){
    try{ const s = await getDoc(doc(db,'clientes',user.uid)); if (s.exists()) clienteData = s.data(); }catch(e){}
  }
});

/* Código corto legible a partir del id del pedido */
function codigoPedido(id){ return id.slice(0,8).toUpperCase(); }

function totalCarrito(){ return cart.reduce((s,i) => s + i.precio * i.qty, 0); }

function mensajeWA(codigo, entrega, dir, notas){
  const items = cart.map(i => `• ${i.nombre} x${i.qty} — $${(i.precio*i.qty).toLocaleString('es-AR')}`).join('\n');
  let msg = `¡Hola Simo & Gena! 🦕 Te dejo mi pedido *#${codigo}*:\n\n${items}\n\n*Total estimado: $${totalCarrito().toLocaleString('es-AR')}*\n\n`;
  msg += entrega === 'envio' ? '📦 Entrega: Envío a domicilio' : '🏠 Entrega: Retiro coordinado';
  if (entrega === 'envio' && dir){
    const linea = [ [dir.calle, dir.numero].filter(Boolean).join(' '), dir.ciudad, dir.cp && `(${dir.cp})`, dir.provincia ].filter(Boolean).join(', ');
    if (linea) msg += `\n📍 ${linea}`;
  }
  if (notas) msg += `\n📝 ${notas}`;
  return msg;
}

/* ── Modal ── */
function ensureOverlay(){
  let ov = document.getElementById('coOverlay');
  if (!ov){
    ov = document.createElement('div');
    ov.id = 'coOverlay'; ov.className = 'co-overlay';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) closeCheckout(); });
  }
  return ov;
}
function closeCheckout(){
  const ov = document.getElementById('coOverlay');
  if (ov){ ov.classList.remove('open'); ov.innerHTML=''; }
  document.body.style.overflow = '';
}

function resumenHTML(){
  const lines = cart.map(i => `<div class="co-line"><span>${esc(i.nombre)} ×${i.qty}</span><span>$${(i.precio*i.qty).toLocaleString('es-AR')}</span></div>`).join('');
  return `<div class="co-summary">${lines}<div class="co-line co-total"><span>Total estimado</span><span>$${totalCarrito().toLocaleString('es-AR')}</span></div></div>`;
}

/* Invitado: ofrecer login o seguir por WhatsApp */
function renderGuest(ov){
  ov.innerHTML = `
    <div class="co-modal">
      <div class="co-head"><h3>Confirmar pedido</h3><button class="co-close" aria-label="Cerrar" data-close>✕</button></div>
      <div class="co-body">
        ${resumenHTML()}
        <p class="co-guest-note" style="margin-top:14px;">Iniciá sesión para <strong>guardar tu pedido</strong> y seguir su estado, o continuá directo por WhatsApp.</p>
        <div class="co-guest-actions">
          <a class="btn-primary" style="justify-content:center;" href="cuenta.html">Ingresar / Registrarme</a>
          <button class="btn-whatsapp" data-guest-wa><img src="assets/wtsp.png" alt="" width="128" height="128">Seguir sin cuenta por WhatsApp</button>
        </div>
      </div>
    </div>`;
  ov.querySelector('[data-close]').onclick = closeCheckout;
  ov.querySelector('[data-guest-wa]').onclick = () => { closeCheckout(); sendToWhatsApp(); };
}

/* Logueado: entrega + dirección + notas → crea pedido */
function renderLogged(ov){
  const dir = (clienteData && clienteData.direccion) || {};
  ov.innerHTML = `
    <div class="co-modal">
      <div class="co-head"><h3>Confirmar pedido</h3><button class="co-close" aria-label="Cerrar" data-close>✕</button></div>
      <div class="co-body">
        ${resumenHTML()}
        <label>¿Cómo lo querés recibir?</label>
        <div class="co-entrega">
          <label><input type="radio" name="coEntrega" value="envio" checked> 📦 Envío a domicilio</label>
          <label><input type="radio" name="coEntrega" value="retiro"> 🏠 Retiro</label>
        </div>
        <div id="coDir">
          <div class="co-grid2">
            <div><label>Calle</label><input id="coCalle" value="${esc(dir.calle||'')}"></div>
            <div><label>Número</label><input id="coNumero" value="${esc(dir.numero||'')}"></div>
          </div>
          <div class="co-grid2">
            <div><label>Ciudad</label><input id="coCiudad" value="${esc(dir.ciudad||'')}"></div>
            <div><label>Código postal</label><input id="coCp" value="${esc(dir.cp||'')}"></div>
          </div>
          <label>Provincia</label><input id="coProvincia" value="${esc(dir.provincia||'')}">
        </div>
        <label>Notas (opcional)</label>
        <textarea id="coNotas" placeholder="Horario de entrega, referencias…">${esc(dir.notas||'')}</textarea>
        <div class="co-msg error" id="coMsg"></div>
      </div>
      <div class="co-foot">
        <button class="btn-whatsapp" id="coConfirm"><img src="assets/wtsp.png" alt="" width="128" height="128">Confirmar y enviar por WhatsApp</button>
      </div>
    </div>`;
  ov.querySelector('[data-close]').onclick = closeCheckout;
  const dirBox = ov.querySelector('#coDir');
  ov.querySelectorAll('input[name="coEntrega"]').forEach(r => r.onchange = () => {
    dirBox.style.display = ov.querySelector('input[name="coEntrega"]:checked').value === 'envio' ? 'block' : 'none';
  });
  ov.querySelector('#coConfirm').onclick = () => confirmarPedido(ov);
}

async function confirmarPedido(ov){
  const btn = ov.querySelector('#coConfirm');
  const msg = ov.querySelector('#coMsg');
  const entrega = ov.querySelector('input[name="coEntrega"]:checked').value;
  const dir = {
    calle: ov.querySelector('#coCalle').value.trim(), numero: ov.querySelector('#coNumero').value.trim(),
    ciudad: ov.querySelector('#coCiudad').value.trim(), cp: ov.querySelector('#coCp').value.trim(),
    provincia: ov.querySelector('#coProvincia').value.trim(), notas: '',
  };
  const notas = ov.querySelector('#coNotas').value.trim();
  if (entrega === 'envio' && !dir.calle){
    msg.textContent = 'Completá al menos la calle para el envío (o elegí Retiro).';
    msg.classList.add('show'); return;
  }
  btn.disabled = true; msg.classList.remove('show');

  const pedido = {
    clienteUid: currentUser.uid,
    clienteNombre: (clienteData && clienteData.nombre) || currentUser.displayName || '',
    clienteEmail: currentUser.email || '',
    clienteTelefono: (clienteData && clienteData.telefono) || '',
    items: cart.map(i => ({
      productoId: i.id.split('__')[0],
      nombre: i.nombre,
      modelo: i.nombre.includes(' — ') ? i.nombre.split(' — ').slice(1).join(' — ') : null,
      precio: i.precio, cantidad: i.qty, subtotal: i.precio * i.qty,
    })),
    total: totalCarrito(),
    estado: 'pendiente',
    metodoEntrega: entrega,
    direccionEnvio: entrega === 'envio' ? dir : null,
    notas,
    creado: serverTimestamp(), actualizado: serverTimestamp(),
  };

  try{
    const ref = await addDoc(collection(db,'pedidos'), pedido);
    const codigo = codigoPedido(ref.id);
    const waMsg = mensajeWA(codigo, entrega, dir, notas);
    // Vaciar carrito (local + cuenta) y refrescar catálogo
    setCart([]);
    document.dispatchEvent(new CustomEvent('cart:replaced'));
    closeCheckout();
    // cerrar el drawer si está abierto
    if (typeof closeCart === 'function') closeCart();
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(waMsg)}`, '_blank', 'noopener');
  }catch(err){
    btn.disabled = false;
    msg.textContent = 'No se pudo registrar el pedido: ' + (err.message || 'error');
    msg.classList.add('show');
  }
}

/* ── Punto de entrada (reemplaza sendToWhatsApp en el botón del carrito) ── */
function checkout(){
  if (!cart.length) return;
  const ov = ensureOverlay();
  if (currentUser) renderLogged(ov); else renderGuest(ov);
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
}

window.checkout = checkout;

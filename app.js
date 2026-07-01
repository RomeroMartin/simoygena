/* ============================================================
   SIMO & GENA · BABY STORE — Lógica compartida
   app.js · Martin Romero Studio
   Carrito (localStorage) + navegación + utilidades comunes.
   Se usa tanto en index.html como en catalogo.html.
   ============================================================ */

/* ── Datos de contacto centralizados (editar acá si cambian) ── */
const WA = '5492213997535';                                   // WhatsApp sin + ni espacios
const IG_URL = 'https://instagram.com/simoygena';
const bgMap = { Indumentaria:'bg-I', Blanqueria:'bg-B', Accesorios:'bg-A', Sensorial:'bg-S' };

/* ── Escape de HTML: evita que datos de la planilla rompan el
   render o inyecten código. Usar SIEMPRE al pintar texto o
   atributos provenientes del Google Sheet. ── */
function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

/* ── CARRITO (compartido entre páginas vía localStorage) ── */
let cart = JSON.parse(localStorage.getItem('sg_cart') || '[]');
function saveCart(){ localStorage.setItem('sg_cart', JSON.stringify(cart)); }

function updateCartUI(){
  const total = cart.reduce((s,i) => s + i.precio * i.qty, 0);
  const count = cart.reduce((s,i) => s + i.qty, 0);
  const totalEl = document.getElementById('cartTotal');
  if (totalEl) totalEl.textContent = '$' + total.toLocaleString('es-AR');

  const badge = document.getElementById('cartBadge');
  if (badge){
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }

  const c = document.getElementById('cartItems');
  if (!c) return;
  if (!cart.length){
    c.innerHTML = '<div class="cart-empty"><div class="cart-empty-emoji" aria-hidden="true">🛒</div><p>Tu carrito está vacío</p><p style="font-size:.76rem;color:#8a8a8a;margin-top:5px;">Visitá el catálogo y agregá productos</p></div>';
    return;
  }
  c.innerHTML = cart.map(i => `
    <div class="cart-item">
      <div class="cart-item-emoji ${bgMap[i.categoria] || ''}">
        ${i.imagen_url
          ? `<img src="${escapeHtml(i.imagen_url)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" onerror="this.style.display='none'">`
          : escapeHtml(i.emoji || '📦')}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(i.nombre)}</div>
        <div class="cart-item-price">$${(i.precio * i.qty).toLocaleString('es-AR')}</div>
      </div>
      <div class="cart-qty">
        <button class="qty-btn" aria-label="Quitar una unidad de ${escapeHtml(i.nombre)}" onclick="changeQty('${escapeHtml(i.id)}',-1)">−</button>
        <span class="qty-num">${i.qty}</span>
        <button class="qty-btn" aria-label="Agregar una unidad de ${escapeHtml(i.nombre)}" onclick="changeQty('${escapeHtml(i.id)}',1)">+</button>
      </div>
    </div>`).join('');
}

function changeQty(id, d){
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += d;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  saveCart();
  updateCartUI();
  // Aviso para que cada página refresque sus botones (catálogo)
  document.dispatchEvent(new CustomEvent('cart:changed', { detail:{ id } }));
}

function sendToWhatsApp(){
  if (!cart.length) return;
  const items = cart.map(i => `• ${i.nombre} x${i.qty} — $${(i.precio * i.qty).toLocaleString('es-AR')}`).join('\n');
  const total = cart.reduce((s,i) => s + i.precio * i.qty, 0);
  const msg = `¡Hola Simo & Gena! 🦕 Quisiera hacer el siguiente pedido:\n\n${items}\n\n*Total estimado: $${total.toLocaleString('es-AR')}*\n\n¿Está disponible?`;
  window.open(`https://wa.me/${WA}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
}

/* ── DRAWER DEL CARRITO ── */
function isCartOpen(){ const d = document.getElementById('cartDrawer'); return d && d.classList.contains('open'); }
function toggleCart(){
  const o = document.getElementById('cartOverlay'), d = document.getElementById('cartDrawer');
  if (!o || !d) return;
  const open = d.classList.contains('open');
  o.classList.toggle('open', !open);
  d.classList.toggle('open', !open);
  d.setAttribute('aria-hidden', open ? 'true' : 'false');
  document.body.style.overflow = !open ? 'hidden' : '';
}
function closeCart(){ if (isCartOpen()) toggleCart(); }

/* ── MENÚ MÓVIL ── */
function toggleMobile(){
  const menu = document.getElementById('mobileMenu');
  const btn = document.querySelector('.hamburger');
  if (!menu) return;
  const open = menu.classList.toggle('open');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
function closeMobile(){
  const menu = document.getElementById('mobileMenu');
  const btn = document.querySelector('.hamburger');
  if (menu) menu.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

/* ── ANIMACIÓN DE APARICIÓN AL SCROLL ── */
function observeFadeUps(){
  if (!('IntersectionObserver' in window)){
    document.querySelectorAll('.fade-up').forEach(el => el.classList.add('visible'));
    return;
  }
  const obs = new IntersectionObserver(entries => {
    entries.forEach((e,i) => {
      if (e.isIntersecting){
        setTimeout(() => e.target.classList.add('visible'), i * 70);
        obs.unobserve(e.target);
      }
    });
  }, { threshold:.1 });
  document.querySelectorAll('.fade-up:not(.visible)').forEach(el => obs.observe(el));
}

/* ── TECLA ESCAPE: cierra menú / carrito (los modales del
   catálogo agregan su propio manejo específico) ── */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const menu = document.getElementById('mobileMenu');
  if (menu && menu.classList.contains('open')){ closeMobile(); return; }
  if (isCartOpen()) closeCart();
});

/* ── AÑO DINÁMICO EN EL FOOTER ── */
function setFooterYear(){
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
}

/* ── ARRANQUE ── */
document.addEventListener('DOMContentLoaded', () => {
  updateCartUI();
  setFooterYear();
  observeFadeUps();
});

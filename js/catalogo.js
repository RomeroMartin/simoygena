/* ============================================================
   SIMO & GENA · BABY STORE — Catálogo (desde Firestore)
   js/catalogo.js · Martin Romero Studio

   Módulo ES: lee la colección "productos" (disponible == true) de
   Firestore, la mapea a la forma que usa la UI y mantiene toda la
   experiencia actual (tarjetas, buscador, filtros, orden, modales
   de detalle y variantes con carrusel, animaciones fade-up).

   Reutiliza del entorno global (js/app.js, script clásico previo):
     cart, saveCart, updateCartUI, escapeHtml, bgMap, observeFadeUps, WA
   Expone al final las funciones usadas por los onclick del HTML.
   ============================================================ */

import { db } from './firebase-config.js';
import { collection, getDocs, query, where }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const badgeMap = { Indumentaria:'badge-I', Blanqueria:'badge-B', Accesorios:'badge-A', Sensorial:'badge-S' };

/* ── Convierte links de Google Drive a URL directa liviana ── */
function driveUrl(url){
  url = (url||'').trim();
  if (url.includes('drive.google.com')){
    const m = url.match(/\/d\/(.+?)(?:\/|$)/) || url.match(/[?&]id=([^&]+)/);
    if (m && m[1]) return `https://lh3.googleusercontent.com/d/${m[1]}=w1000`;
  }
  return url;
}

/* ── Firestore → forma que espera la UI ──
   Doc nuevo esquema: { nombre, categoria, precio, descripcion,
     descripcion_larga, imagenes[], emoji, tiene_variantes,
     modelos[{nombre,stock}], stock, disponible, destacado, orden } */
function mapDoc(id, d){
  const imagenes = Array.isArray(d.imagenes) ? d.imagenes : [];
  const todas_imagenes = imagenes.map(driveUrl).filter(u=>u);
  const modelosArr = Array.isArray(d.modelos) ? d.modelos : [];
  const variantes = modelosArr.map(m => m.nombre);
  const sin_stock = new Set(
    modelosArr.filter(m => Number(m.stock) <= 0).map(m => (m.nombre||'').toLowerCase())
  );
  const tiene_variantes = d.tiene_variantes === true && variantes.length > 1;
  return {
    id,
    nombre: d.nombre || '',
    categoria: d.categoria || '',
    precio: Number(d.precio) || 0,
    descripcion: d.descripcion || '',
    descripcion_larga: d.descripcion_larga || d.descripcion || '',
    imagen_url: todas_imagenes[0] || '',
    todas_imagenes,
    emoji: d.emoji || '',
    disponible: d.disponible === true,
    destacado: d.destacado === true,
    orden: Number(d.orden) || 0,
    tiene_variantes,
    variantes,
    sin_stock,
    stock: tiene_variantes ? null : (Number(d.stock) || 0), // null = no aplica (usa modelos)
  };
}

async function loadFromFirestore(){
  const q = query(collection(db, 'productos'), where('disponible', '==', true));
  const snap = await getDocs(q);
  const list = [];
  snap.forEach(docSnap => list.push(mapDoc(docSnap.id, docSnap.data())));
  // Orden por "orden" y luego nombre (evita índices compuestos en Firestore)
  list.sort((a,b) => (a.orden - b.orden) || a.nombre.localeCompare(b.nombre, 'es'));
  return list;
}

let productos = [];
let currentCat = 'todos';

/* ── Un producto simple sin variantes está agotado si stock <= 0 ── */
function simpleAgotado(p){ return !p.tiene_variantes && p.stock !== null && p.stock <= 0; }

/* ── Botón de card según estado del carrito / stock ── */
function cardBtnHTML(p){
  if (p.tiene_variantes){
    const totalEnCarrito = cart.filter(i => i.id.startsWith(p.id+'__')).reduce((s,i)=>s+i.qty,0);
    if (totalEnCarrito > 0){
      return `<button class="add-btn variants-btn added" id="btn-${escapeHtml(p.id)}" onclick="openVariantsModal('${escapeHtml(p.id)}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        En carrito (${totalEnCarrito}) — ver modelos
      </button>`;
    }
    return `<button class="add-btn variants-btn" id="btn-${escapeHtml(p.id)}" onclick="openVariantsModal('${escapeHtml(p.id)}')">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      Ver modelos
    </button>`;
  }
  if (simpleAgotado(p)){
    return `<button class="add-btn" id="btn-${escapeHtml(p.id)}" disabled style="background:#ccc;cursor:not-allowed;">Sin stock</button>`;
  }
  const inCart = cart.find(i => i.id === p.id);
  if (inCart){
    return `<button class="add-btn added" id="btn-${escapeHtml(p.id)}" onclick="addToCart('${escapeHtml(p.id)}')">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
      En carrito (${inCart.qty}) — agregar otro
    </button>`;
  }
  return `<button class="add-btn" id="btn-${escapeHtml(p.id)}" onclick="addToCart('${escapeHtml(p.id)}')">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    Agregar
  </button>`;
}

/* ── Filtro + orden + búsqueda combinados ── */
function getVisibleList(){
  const q = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  let list = productos.filter(p => p.disponible);
  if (currentCat !== 'todos') list = list.filter(p => p.categoria === currentCat);
  if (q){
    list = list.filter(p =>
      (p.nombre||'').toLowerCase().includes(q) ||
      (p.descripcion||'').toLowerCase().includes(q) ||
      (p.categoria||'').toLowerCase().includes(q)
    );
  }
  const sort = document.getElementById('sortSelect').value;
  if (sort === 'price-asc')  list = [...list].sort((a,b)=>a.precio-b.precio);
  else if (sort === 'price-desc') list = [...list].sort((a,b)=>b.precio-a.precio);
  else if (sort === 'name-asc')  list = [...list].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
  return list;
}

function renderList(list){
  const grid = document.getElementById('productsGrid');
  const countEl = document.getElementById('resultsCount');
  if (!list.length){
    grid.innerHTML = '<div class="catalog-empty">No encontramos productos con esos criterios.</div>';
    countEl.textContent = '';
    return;
  }
  countEl.textContent = `${list.length} producto${list.length!==1?'s':''}`;
  grid.innerHTML = list.map(p => {
    const nombre = escapeHtml(p.nombre);
    const imgTag = p.imagen_url
      ? `<img src="${escapeHtml(p.imagen_url)}" alt="${nombre}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;" onerror="this.style.display='none'">`
      : '';
    return `<div class="product-card fade-up">
      <button type="button" class="product-open" aria-label="Ver detalle de ${nombre}" onclick="openProductModal('${escapeHtml(p.id)}')">
        <div class="product-img-wrap ${bgMap[p.categoria]||''}">
          ${imgTag}
          <span class="cat-badge ${badgeMap[p.categoria]||''}">${escapeHtml(p.categoria)}</span>
          ${p.tiene_variantes?'<span class="variants-badge">+ modelos</span>':''}
          ${!p.imagen_url?`<span style="position:relative;z-index:1;">${escapeHtml(p.emoji||'📦')}</span>`:''}
        </div>
        <div class="product-info">
          <div class="product-name">${nombre}</div>
          <div class="product-desc">${escapeHtml(p.descripcion)}</div>
        </div>
      </button>
      <div class="product-footer">
        <div class="product-price">$${p.precio.toLocaleString('es-AR')}</div>
        ${cardBtnHTML(p)}
      </div>
    </div>`;
  }).join('');
  observeFadeUps();
}

function applyView(){ renderList(getVisibleList()); }

function onSearchInput(){
  const clr = document.getElementById('searchClear');
  clr.classList.toggle('show', !!document.getElementById('searchInput').value);
  applyView();
}
function clearSearch(){
  const inp = document.getElementById('searchInput');
  inp.value = ''; document.getElementById('searchClear').classList.remove('show');
  inp.focus(); applyView();
}
function filterCat(cat, btn){
  currentCat = cat;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  applyView();
}

/* ── ROUTER: click en card → modal correcto ── */
function openProductModal(id){
  const p = productos.find(x => x.id === id);
  if (!p) return;
  p.tiene_variantes ? openVariantsModal(id) : openInfoModal(id);
}

/* ── MODAL INFO (sin variantes) ── */
function openInfoModal(id){
  const p = productos.find(x => x.id === id);
  if (!p) return;
  vmCurrentProduct = p;
  const tieneImgs = p.todas_imagenes && p.todas_imagenes.length > 0;
  const imgPanelHTML = tieneImgs
    ? `<div class="vm-carousel"><img src="${escapeHtml(p.todas_imagenes[0])}" alt="${escapeHtml(p.nombre)}" class="active" onerror="this.style.display='none'"></div>`
    : `<div class="vm-emoji-fallback">${escapeHtml(p.emoji||'📦')}</div>`;

  const agotado = simpleAgotado(p);
  const inCart = cart.find(i => i.id === p.id);
  let footer;
  if (agotado){
    footer = `<button class="vm-confirm-btn" disabled style="background:#ccc;box-shadow:none;cursor:not-allowed;">Sin stock disponible por el momento</button>`;
  } else if (inCart){
    footer = `<button class="vm-confirm-btn" style="background:#5a9a3f;" onclick="addToCartFromModal('${escapeHtml(p.id)}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        En carrito (${inCart.qty}) — agregar otro</button>`;
  } else {
    footer = `<button class="vm-confirm-btn" onclick="addToCartFromModal('${escapeHtml(p.id)}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Agregar al carrito</button>`;
  }

  document.getElementById('vmModal').innerHTML = `
    <div class="vm-img-panel">${imgPanelHTML}</div>
    <div class="vm-info-panel">
      <div class="vm-info-scroll">
        <div class="vm-header">
          <div class="vm-header-left">
            <div class="vm-title">${escapeHtml(p.nombre)}</div>
            <div class="vm-price">$${p.precio.toLocaleString('es-AR')}</div>
          </div>
          <button class="vm-close" onclick="closeVariantsModal()" aria-label="Cerrar">✕</button>
        </div>
        ${(p.descripcion_larga||p.descripcion)?`<p class="vm-desc">${escapeHtml(p.descripcion_larga||p.descripcion)}</p>`:''}
        <div class="vm-divider"></div>
        <div class="vm-label" style="color:${agotado?'#c0392b':'var(--turquesa)'};">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          ${agotado?'Sin stock por el momento':'Unidad disponible'}
        </div>
      </div>
      <div class="vm-info-footer" id="vmInfoFooter">${footer}</div>
    </div>`;
  openVmOverlay();
}

function addToCartFromModal(id){
  const p = productos.find(p => p.id === id); if (!p) return;
  const ex = cart.find(i => i.id === id);
  ex ? ex.qty++ : cart.push({ id:p.id, nombre:p.nombre, categoria:p.categoria, precio:p.precio, emoji:p.emoji, imagen_url:p.imagen_url||'', qty:1 });
  saveCart(); updateCartUI();
  const footer = document.getElementById('vmInfoFooter');
  if (footer){
    const inCart = cart.find(i => i.id === id);
    footer.innerHTML = `<button class="vm-confirm-btn" style="background:#5a9a3f;" onclick="addToCartFromModal('${escapeHtml(id)}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
      En carrito (${inCart.qty}) — agregar otro</button>`;
  }
  refreshCardBtn(id);
}

/* ── MODAL DE VARIANTES ── */
let vmCurrentProduct = null;
let vmCurrentIndex = 0;

function openVariantsModal(id){
  const p = productos.find(x => x.id === id);
  if (!p) return;
  vmCurrentProduct = p;
  vmCurrentIndex = p.variantes.findIndex(v => !p.sin_stock.has(v.toLowerCase()));
  if (vmCurrentIndex === -1) vmCurrentIndex = 0;

  const tieneImgs = p.todas_imagenes && p.todas_imagenes.length > 0;
  const multiImg = tieneImgs && p.todas_imagenes.length > 1;

  let imgPanelHTML;
  if (tieneImgs){
    const imgs = p.todas_imagenes.map((url,i) =>
      `<img src="${escapeHtml(url)}" alt="${escapeHtml(p.variantes[i]||p.nombre)}" class="${i===0?'active':'hidden'}" data-vm-idx="${i}" onerror="this.style.display='none'">`
    ).join('');
    const dots = multiImg
      ? `<div class="vm-dots">${p.todas_imagenes.map((_,i)=>`<button class="vm-dot${i===0?' active':''}" data-dot="${i}" onclick="vmNavigateTo(${i})" aria-label="Imagen ${i+1}"></button>`).join('')}</div>`
      : '';
    imgPanelHTML = `<div class="vm-carousel" id="vmCarousel">
      ${imgs}
      ${multiImg?`<button class="vm-arrow prev hidden-arrow" id="vmPrev" onclick="vmNavigate(-1)" aria-label="Anterior">&#8249;</button>
                  <button class="vm-arrow next" id="vmNext" onclick="vmNavigate(1)" aria-label="Siguiente">&#8250;</button>`:''}
      ${dots}
    </div>`;
  } else {
    imgPanelHTML = `<div class="vm-emoji-fallback">${escapeHtml(p.emoji||'📦')}</div>`;
  }

  const chips = p.variantes.map((v,i) => {
    const agotado = p.sin_stock.has(v.toLowerCase());
    if (agotado){
      return `<button class="variant-chip sin-stock" disabled>${escapeHtml(v)}<span class="sin-stock-tag">Sin stock</span></button>`;
    }
    const isActive = i === vmCurrentIndex;
    return `<button class="variant-chip${isActive?' active':''}" data-idx="${i}" onclick="vmSelectVariant(${i},this)">${escapeHtml(v)}</button>`;
  }).join('');

  const todosSinStock = p.variantes.every(v => p.sin_stock.has(v.toLowerCase()));

  document.getElementById('vmModal').innerHTML = `
    <div class="vm-img-panel">${imgPanelHTML}</div>
    <div class="vm-info-panel">
      <div class="vm-info-scroll">
        <div class="vm-header">
          <div class="vm-header-left">
            <div class="vm-title">${escapeHtml(p.nombre)}</div>
            <div class="vm-price">$${p.precio.toLocaleString('es-AR')}</div>
          </div>
          <button class="vm-close" onclick="closeVariantsModal()" aria-label="Cerrar">✕</button>
        </div>
        ${(p.descripcion_larga||p.descripcion)?`<p class="vm-desc">${escapeHtml(p.descripcion_larga||p.descripcion)}</p>`:''}
        <div class="vm-divider"></div>
        <div class="vm-label">Modelo: <span class="vm-selected-name" id="vmSelectedName">${escapeHtml(p.variantes[vmCurrentIndex]||'')}</span></div>
        <div class="vm-variants">${chips}</div>
      </div>
      <div class="vm-info-footer">
        ${todosSinStock
          ? `<button class="vm-confirm-btn" disabled style="background:#ccc;box-shadow:none;cursor:not-allowed;">Sin stock disponible por el momento</button>`
          : `<button class="vm-confirm-btn" id="vmConfirmBtn" onclick="addVariantToCart()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Agregar al carrito</button>`}
      </div>
    </div>`;
  openVmOverlay();
  vmUpdateConfirmBtn();
}

function openVmOverlay(){
  document.getElementById('vmOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function isVmOpen(){ return document.getElementById('vmOverlay').classList.contains('open'); }

function closeVariantsModal(){
  if (vmCurrentProduct) refreshCardBtn(vmCurrentProduct.id);
  document.getElementById('vmOverlay').classList.remove('open');
  document.body.style.overflow = '';
  vmCurrentProduct = null;
  vmCurrentIndex = 0;
}
function handleVmOverlayClick(e){
  if (e.target === document.getElementById('vmOverlay')) closeVariantsModal();
}
function refreshCardBtn(id){
  const baseId = id.includes('__') ? id.split('__')[0] : id;
  const p = productos.find(x => x.id === baseId);
  const btn = document.getElementById('btn-'+baseId);
  if (btn && p) btn.outerHTML = cardBtnHTML(p);
}
function vmNavigate(dir){
  if (!vmCurrentProduct) return;
  const total = vmCurrentProduct.todas_imagenes.length;
  vmCurrentIndex = (vmCurrentIndex + dir + total) % total;
  vmSyncCarousel(); vmSyncChip();
}
function vmNavigateTo(idx){ vmCurrentIndex = idx; vmSyncCarousel(); vmSyncChip(); }
function vmSelectVariant(idx, chipEl){
  vmCurrentIndex = idx;
  document.querySelectorAll('.variant-chip').forEach(c => c.classList.remove('active'));
  chipEl.classList.add('active');
  document.getElementById('vmSelectedName').textContent = vmCurrentProduct.variantes[idx] || '';
  vmSyncCarousel();
  vmUpdateConfirmBtn();
}
function vmUpdateConfirmBtn(){
  const btn = document.getElementById('vmConfirmBtn');
  if (!btn || !vmCurrentProduct) return;
  const modelo = vmCurrentProduct.variantes[vmCurrentIndex] || '';
  const cartId = `${vmCurrentProduct.id}__${modelo.toLowerCase().replace(/\s+/g,'_')}`;
  const inCart = cart.find(i => i.id === cartId);
  if (inCart){
    btn.style.background = '#5a9a3f';
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> En carrito (${inCart.qty}) — agregar otro`;
  } else {
    btn.style.background = '';
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Agregar al carrito`;
  }
}
function vmSyncCarousel(){
  const carousel = document.getElementById('vmCarousel');
  if (!carousel) return;
  carousel.querySelectorAll('img[data-vm-idx]').forEach(img => {
    const i = parseInt(img.dataset.vmIdx);
    img.classList.toggle('active', i === vmCurrentIndex);
    img.classList.toggle('hidden', i !== vmCurrentIndex);
  });
  const total = vmCurrentProduct.todas_imagenes.length;
  const prev = document.getElementById('vmPrev');
  const next = document.getElementById('vmNext');
  if (prev) prev.classList.toggle('hidden-arrow', vmCurrentIndex === 0);
  if (next) next.classList.toggle('hidden-arrow', vmCurrentIndex === total-1);
  carousel.querySelectorAll('.vm-dot').forEach(d => {
    d.classList.toggle('active', parseInt(d.dataset.dot) === vmCurrentIndex);
  });
}
function vmSyncChip(){
  document.querySelectorAll('.variant-chip').forEach(c => {
    if (c.dataset.idx !== undefined) c.classList.toggle('active', parseInt(c.dataset.idx) === vmCurrentIndex);
  });
  const nameEl = document.getElementById('vmSelectedName');
  if (nameEl) nameEl.textContent = vmCurrentProduct.variantes[vmCurrentIndex] || '';
}
function addVariantToCart(){
  if (!vmCurrentProduct) return;
  const p = vmCurrentProduct;
  const modelo = p.variantes[vmCurrentIndex] || '';
  if (p.sin_stock.has(modelo.toLowerCase())) return;
  const cartId = `${p.id}__${modelo.toLowerCase().replace(/\s+/g,'_')}`;
  const nombreConModelo = modelo ? `${p.nombre} — ${modelo}` : p.nombre;
  const ex = cart.find(i => i.id === cartId);
  if (ex){ ex.qty++; }
  else { cart.push({
    id:cartId, nombre:nombreConModelo, categoria:p.categoria, precio:p.precio, emoji:p.emoji,
    imagen_url:p.todas_imagenes[vmCurrentIndex] || p.imagen_url || '', qty:1,
  }); }
  saveCart(); updateCartUI();
  vmUpdateConfirmBtn();
}

/* ── Agregar producto simple desde la card ── */
function addToCart(id){
  const p = productos.find(p => p.id === id); if (!p) return;
  if (simpleAgotado(p)) return;
  const ex = cart.find(i => i.id === id);
  ex ? ex.qty++ : cart.push({ id:p.id, nombre:p.nombre, categoria:p.categoria, precio:p.precio, emoji:p.emoji, imagen_url:p.imagen_url||'', qty:1 });
  saveCart(); updateCartUI();
  refreshCardBtn(id);
}

/* Cuando app.js cambia cantidades desde el carrito, refrescar cards/modal */
document.addEventListener('cart:changed', e => {
  refreshCardBtn(e.detail.id);
  if (vmCurrentProduct) vmUpdateConfirmBtn();
});
/* El carrito fue reemplazado por completo (login/logout con cuenta) → re-render */
document.addEventListener('cart:replaced', () => {
  if (productos.length) applyView();
  if (vmCurrentProduct) vmUpdateConfirmBtn();
});
/* ESC cierra el modal de producto */
document.addEventListener('keydown', e => { if (e.key === 'Escape' && isVmOpen()) closeVariantsModal(); });

/* ── ARRANQUE ── */
function showError(){
  document.getElementById('productsGrid').innerHTML =
    `<div class="catalog-error">
      <div class="emoji" aria-hidden="true">🦕</div>
      <h3>No pudimos cargar el catálogo</h3>
      <p>Revisá tu conexión y volvé a intentar, o escribinos y te pasamos todo por WhatsApp.</p>
      <button class="btn-primary" onclick="window.location.reload()">Reintentar</button>
      <div style="margin-top:14px;"><a class="btn-whatsapp" style="display:inline-flex;width:auto;padding:12px 22px;" href="https://wa.me/${WA}" target="_blank" rel="noopener noreferrer"><img src="assets/wtsp.png" alt="" width="128" height="128">Escribinos por WhatsApp</a></div>
    </div>`;
  document.getElementById('resultsCount').textContent = '';
}

async function initFromURL(){
  document.getElementById('productsGrid').innerHTML =
    '<div class="catalog-empty"><p style="font-size:1.5rem;margin-bottom:8px;">🦕</p><p>Cargando productos...</p></div>';
  try{
    productos = await loadFromFirestore();
  }catch(e){
    console.error('No se pudo cargar el catálogo desde Firestore:', e);
    showError();
    return;
  }
  document.getElementById('searchInput').addEventListener('input', onSearchInput);
  const cat = new URLSearchParams(window.location.search).get('cat');
  if (cat){
    const normalize = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
    const btn = [...document.querySelectorAll('.filter-tab')].find(b => normalize(b.textContent).includes(normalize(cat)));
    if (btn){ filterCat(cat, btn); return; }
  }
  applyView();
}

/* ── Exponer al scope global las funciones usadas por los onclick del HTML ── */
Object.assign(window, {
  openProductModal, openVariantsModal, openInfoModal,
  addToCart, addToCartFromModal, addVariantToCart,
  closeVariantsModal, handleVmOverlayClick,
  vmNavigate, vmNavigateTo, vmSelectVariant,
  filterCat, applyView, clearSearch,
});

initFromURL();

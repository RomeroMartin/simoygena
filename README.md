# Simo & Gena · Baby Store

Web de la tienda de artículos para bebés **Simo & Gena** (0 a 2 años),
en el dominio [simoygena.com.ar](https://simoygena.com.ar).

Frontend puro (HTML + CSS + JavaScript vanilla, **sin frameworks ni bundlers**) con
**Firebase** como backend as a service:

- **Cloud Firestore** → base de datos de productos (y, en Fase 2, clientes/pedidos/carritos).
- **Firebase Auth** → login del panel de administración (email + contraseña).

El catálogo lee los productos **en vivo** desde Firestore y los pedidos se cierran por
**WhatsApp**. El formulario de contacto usa **Formspree**.

> **Estado:** Fases 1 y 2 completas.
> - **Fase 1:** catálogo desde Firestore + panel de administración (productos, stock, config).
> - **Fase 2:** cuentas de cliente (login unificado; los admin ven el acceso al panel en la
>   propia barra), carrito persistente por cuenta, pedidos guardados en Firestore + cierre por
>   WhatsApp con código de pedido, historial del cliente, y gestión de pedidos/clientes en el admin.

---

## 📁 Estructura

```
index.html            Home (hero, categorías, contacto)
catalogo.html         Catálogo público (buscador, filtros, orden, carrito, modales)
cuenta.html           Cuenta del cliente (registro, login, perfil, historial de pedidos)
migrar.html           Herramienta interna de un solo uso: migra el CSV viejo → Firestore
/admin
  index.html          Login del panel
  panel.html          Panel: productos, stock, pedidos, clientes, datos de la tienda
/css
  styles.css          Estilos compartidos (navbar, carrito, sesión, checkout, footer, tokens)
  home.css            Estilos del index
  catalogo.css        Estilos del catálogo
  cuenta.css          Estilos de la cuenta del cliente
  admin.css           Estilos del panel
/js
  firebase-config.js  Init de Firebase + export de db (Firestore) y auth
  app.js              Lógica compartida (carrito localStorage, menú, utils, escapeHtml, setCart)
  catalogo.js         Catálogo desde Firestore + render + filtros + modales (módulo ES)
  home.js             Contador de productos del home desde Firestore (módulo ES)
  auth-ui.js          Estado de sesión en la navbar (Ingresar / Mi cuenta / acceso admin)
  cart-sync.js        Carrito persistente por cuenta (Firestore) + merge con localStorage
  checkout.js         Confirmación de pedido: crea el pedido en Firestore + WhatsApp
  cuenta.js           Registro / login / perfil / historial de pedidos del cliente
  admin.js            Login + CRUD productos + stock + config + pedidos + clientes (módulo ES)
/assets               Logos, favicon, og-image, personajes (Trixi/Rex), íconos
firestore.rules       Reglas de seguridad de Firestore
sitemap.xml / robots.txt   SEO
CNAME                 simoygena.com.ar
```

## 🛠️ Desarrollo local

Al ser estático, se sirve la carpeta (los módulos ES requieren http, no `file://`):

```bash
npx serve
```

Y abrir la URL que imprime (ej. `http://localhost:3000`).

## 🔧 Configuración

- **Firebase:** las claves están en `js/firebase-config.js` (son públicas por diseño;
  la seguridad real la dan `firestore.rules`). Ver **[SETUP-FIREBASE.md](SETUP-FIREBASE.md)**.
- **WhatsApp / Instagram:** en `js/app.js` (`WA`, `IG_URL`). El email está en el `mailto:`
  del footer. La dueña también puede editar estos datos desde el panel (colección `config`).
- **Formulario de contacto:** el ID de Formspree está en `index.html` (`FORMSPREE_ID`).

## ✏️ Cargar productos

Se hace desde el **panel de administración** (`/admin`).
Ver **[MANUAL-ADMIN.md](MANUAL-ADMIN.md)** — guía paso a paso para la dueña.

> `MANUAL-PLANILLA.md` quedó **deprecado** (la planilla de Google Sheets fue reemplazada
> por Firestore). Se conserva solo como referencia histórica.

## 🔒 Seguridad

Al no haber backend, las **[firestore.rules](firestore.rules)** son la única barrera:
productos y config con lectura pública y escritura solo admin; el resto restringido por
usuario. Probar siempre en el simulador de la consola antes de publicar.

## 🖼️ Imágenes

Las fotos de productos se manejan **por URL** (Google Drive con enlace público). La función
`driveUrl()` convierte los links de Drive a `lh3.googleusercontent.com` con tamaño acotado.
Los PNG de la marca (íconos, personajes) están optimizados (íconos ≤128 px, personajes ≤800 px);
`assets/og-image.png` (1200×630) es la preview al compartir el link.

---

Diseño y desarrollo: **Martin Romero Studio** — https://www.martinromerostudio.com.ar

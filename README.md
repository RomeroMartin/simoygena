# Simo & Gena · Baby Store

Sitio web de la tienda de artículos para bebés **Simo & Gena** (0 a 2 años).
Es un sitio **estático** (HTML + CSS + JavaScript, sin framework) que se publica en
GitHub Pages sobre el dominio [simoygena.com.ar](https://simoygena.com.ar).

El catálogo se alimenta **en vivo** desde una planilla de Google Sheets publicada como CSV,
y los pedidos se cierran por **WhatsApp**. El formulario de contacto usa **Formspree**.

---

## 📁 Estructura

```
index.html        Página de inicio (hero, categorías, contacto)
catalogo.html     Catálogo con buscador, filtros, orden y carrito
styles.css        Estilos compartidos (navbar, carrito, footer, tokens de color)
home.css          Estilos exclusivos del index
catalogo.css      Estilos exclusivos del catálogo
app.js            Lógica compartida: carrito (localStorage), menú, utilidades, escape HTML
logo.svg / logo_completo.svg   Logotipos
og-image.png      Imagen de previsualización para redes (1200×630)
sitemap.xml / robots.txt       SEO
*.png             Íconos, personajes (Trixi/Rex) y decoraciones
MANUAL-PLANILLA.md  Guía para la dueña: cómo cargar productos
```

## 🛠️ Desarrollo local

Al ser estático, alcanza con servir la carpeta:

```bash
python -m http.server 8080
# o
npx serve
```

Y abrir `http://localhost:8080`.

## 🔧 Configuración

- **WhatsApp / Instagram / email:** centralizados. El teléfono e Instagram están en
  `app.js` (`WA`, `IG_URL`); el email de contacto está en el `mailto:` del footer de cada HTML.
- **Planilla de productos:** la URL del CSV está en `catalogo.html` (`SHEET_URL`) y en
  `index.html` (`SHEET_STAT`).
- **Formulario de contacto:** el ID de Formspree está en `index.html` (`FORMSPREE_ID`).

## ✏️ Cargar productos

Ver **[MANUAL-PLANILLA.md](MANUAL-PLANILLA.md)** — guía paso a paso para la dueña del negocio.

## 🖼️ Imágenes

Los PNG de íconos, personajes y decoraciones están optimizados a tamaños razonables.
Si se reemplazan, conviene mantenerlos livianos (íconos ≤128 px, personajes ≤800 px).
La imagen `og-image.png` (1200×630) es la que se ve al compartir el link en redes.

---

Diseño y desarrollo: **Martin Romero Studio** — https://www.martinromerostudio.com.ar

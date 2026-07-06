> ⚠️ **DEPRECADO.** La planilla de Google Sheets fue reemplazada por Firebase (Firestore).
> Los productos ahora se cargan desde el panel de administración: ver **[MANUAL-ADMIN.md](MANUAL-ADMIN.md)**.
> Este documento se conserva solo como referencia histórica.

# 📋 Manual de la planilla — Simo & Gena Baby Store

Esta guía explica cómo cargar y editar productos desde la **planilla de Google Sheets**
que alimenta el catálogo de la web. **No hace falta saber programar**: todo se maneja
desde la planilla y las fotos desde Google Drive.

> La web lee la planilla **en vivo**: cada cambio que guardes aparece en el sitio a los
> pocos segundos (a veces hay que refrescar con `Ctrl + F5`).

---

## 1. Cómo funciona (en simple)

1. Vos cargás los productos en la planilla (una fila por producto).
2. Las fotos las subís a Google Drive y pegás el enlace en la planilla.
3. La web toma esos datos y arma el catálogo sola.
4. El cliente arma su pedido y lo envía por **WhatsApp**.

---

## 2. Las columnas (qué va en cada una)

El orden de las columnas **no se debe cambiar ni renombrar**. Son estas:

| Columna | ¿Obligatoria? | Qué poner |
|---|---|---|
| **id** | ✅ Sí | Un número o código único por producto (1, 2, 3… o A1, B2). No repetir. |
| **nombre** | ✅ Sí | El nombre del producto. Ej: `Body manga corta`. |
| **categoria** | ✅ Sí | **Exactamente** una de estas 4 (ver punto 3). |
| **precio** | ✅ Sí | Solo el número. Ej: `8000`. Sin `$`, sin puntos ni comas. |
| **descripcion** | ✅ Sí | Descripción corta que se ve en la tarjeta. Ej: `100% algodón, talle 0-3m`. |
| **descripcion_larga** | ⬜ Opcional | Texto más largo que aparece al abrir el producto. Si la dejás vacía, se usa la corta. |
| **modelos** | ⬜ Opcional | Lista de variantes separadas por coma (colores, estampas, talles). Ver punto 4. |
| **modelos_sin_stock** | ⬜ Opcional | Cuáles de esos modelos están agotados. Ver punto 5. |
| **imagen_url** | ⬜ Opcional (recomendada) | Enlaces de las fotos desde Google Drive, separados por coma. Ver punto 6. |
| **disponible** | ✅ Sí | `TRUE` = se muestra en la web · `FALSE` = queda oculto. Ver punto 7. |

---

## 3. Categorías (¡ojo con la ortografía!)

La categoría tiene que escribirse **igual que acá**, si no el filtro de la web no la reconoce:

- `Indumentaria`
- `Blanqueria`  ← **sin tilde** (así de simple, aunque en la web se muestre "Blanquería")
- `Accesorios`
- `Sensorial`

> Respetá mayúscula inicial y no agregues espacios de más. `blanquería` o `Blanquerìa`
> **no** van a funcionar.

---

## 4. Modelos / variantes (colores, estampas, talles)

Sirve cuando un mismo producto viene en varias opciones. Se escriben en la columna
**modelos**, separadas por coma:

```
Rojo, Verde, Azul, Amarillo
```

- Si escribís **2 o más** modelos → en la web aparece el botón **"Ver modelos"** y el
  cliente elige cuál quiere antes de agregarlo al carrito.
- Si dejás la columna vacía (o ponés uno solo) → el producto se agrega directo, sin selector.
- Podés usar cualquier tipo de variante: `Talle S, Talle M, Talle L` o
  `Estampa nubes, Estampa dinos`, etc.

---

## 5. Marcar un modelo como agotado

En la columna **modelos_sin_stock** escribí los modelos que NO tenés, separados por coma.
Tienen que llamarse **igual** que en la columna `modelos`:

```
modelos             → Rojo, Verde, Azul, Amarillo
modelos_sin_stock   → Azul
```

Resultado en la web: el modelo "Azul" aparece **tachado y con el cartel "Sin stock"**, y no
se puede agregar. Los demás sí.

- Si TODOS los modelos están sin stock, el botón queda deshabilitado con el aviso
  "Sin stock disponible por el momento".
- No importan mayúsculas/minúsculas (`azul` o `Azul` funcionan igual).

---

## 6. Fotos (Google Drive) — la parte más importante

1. Subí la foto a Google Drive.
2. Clic derecho → **Compartir** → en "Acceso general" elegí
   **"Cualquier persona con el enlace"**. (Si queda en "Restringido", la foto **no se ve**.)
3. Copiá el enlace y pegalo en la columna **imagen_url**.

**Varias fotos:** separá los enlaces con coma. Ejemplo:
```
https://drive.google.com/file/d/AAA.../view, https://drive.google.com/file/d/BBB.../view
```

### 🔑 Regla de oro cuando hay modelos
Si el producto tiene **modelos**, poné **una foto por modelo y en el mismo orden**. Así,
cuando el cliente elige un modelo, se muestra la foto que le corresponde:

```
modelos    → Rojo, Verde, Azul
imagen_url → (foto roja), (foto verde), (foto azul)
```

- Si un producto **no** tiene modelos, la web muestra solo la **primera** foto.
- Si dejás `imagen_url` vacío, se muestra un ícono 📦 en lugar de la foto.

---

## 7. Mostrar u ocultar un producto

- `TRUE` → el producto se ve en la web.
- `FALSE` → queda oculto (útil para productos en borrador o pausados).

> El número **"+X Productos"** de la página de inicio cuenta **solo** los productos con
> `disponible = TRUE`. Así que los borradores en `FALSE` no inflan ese número.

---

## 8. Novedades / cosas que ahora podés hacer

Con las últimas mejoras del sitio:

- ✅ **Podés usar comas, comillas y saltos de línea** dentro de las descripciones sin que se
  rompa nada. (Google Sheets los guarda entre comillas automáticamente.)
- ✅ **Símbolos especiales** (`<`, `>`, `&`, `"`) en nombres o descripciones ya no rompen la
  página: se muestran tal cual.
- ✅ Los clientes ahora pueden **buscar** productos por nombre, descripción o categoría, y
  **ordenar** por precio o nombre. → Cuanto mejor escribas los nombres y descripciones,
  más fácil los encuentran.

---

## 9. Errores comunes (y cómo evitarlos)

| Síntoma | Causa probable | Solución |
|---|---|---|
| Un producto no aparece | `disponible` está en `FALSE` o vacío | Poné `TRUE`. |
| El producto no sale al filtrar por categoría | La categoría está mal escrita | Usá exactamente `Indumentaria`, `Blanqueria`, `Accesorios` o `Sensorial`. |
| No se ve la foto | El archivo de Drive no está compartido | Compartir → "Cualquier persona con el enlace". |
| La foto del modelo no coincide | Fotos en distinto orden que los modelos | Ordená las fotos igual que los modelos. |
| El precio se ve raro (ej. 0) | Pusiste `$` o letras en `precio` | Dejá solo el número: `8000`. |
| "Sin stock" en un modelo que sí tenés | Está listado en `modelos_sin_stock` | Borralo de esa columna. |
| La web no actualiza | Cache del navegador | Refrescá con `Ctrl + F5`. |

---

## 10. ⚠️ Muy importante: la planilla debe seguir "publicada"

La web se conecta a la planilla porque está **publicada en la web como CSV**
(*Archivo → Compartir → Publicar en la Web*). **No despubliques** la planilla ni cambies
esa configuración: si lo hacés, el catálogo deja de cargar y los clientes ven un mensaje de
error con el botón de WhatsApp.

Si alguna vez hay que rehacerlo:
1. *Archivo → Compartir → Publicar en la Web*.
2. Elegí la hoja correcta y formato **CSV**.
3. Copiá el enlace y pasáselo a quien mantiene la web (Martin Romero Studio) para
   actualizarlo en el código.

---

### 📞 Soporte
Ante cualquier duda técnica, escribí a **Martin Romero Studio**
(<https://www.martinromerostudio.com.ar>).

# 🧸 Manual del Panel de Administración — Simo & Gena

Guía para cargar y gestionar los productos de la tienda desde el panel.
**No hace falta saber programar.** Reemplaza a la vieja planilla de Google Sheets.

> La web se actualiza al instante: apenas guardás un cambio, aparece en la tienda
> (a veces hay que refrescar con `Ctrl + F5`).

---

## 1. Cómo entrar al panel
1. Entrá a **simoygena.com.ar/admin** (o `/admin` en tu navegador).
2. Escribí tu **email** y **contraseña** de administradora.
3. Tocá **Ingresar**.

¿Olvidaste la contraseña? Escribí tu email y tocá **“¿Olvidaste tu contraseña?”**:
te llega un correo para cambiarla.

> Solo las cuentas autorizadas entran. Si ves “no tiene permisos”, avisá a Martín Romero Studio.

---

## 2. Cargar un producto nuevo
En la pestaña **📦 Productos**, tocá **“+ Nuevo producto”** y completá:

| Campo | Qué poner |
|---|---|
| **Nombre** | El nombre del producto. Ej: `Body manga corta`. |
| **Categoría** | Elegí una: Indumentaria, Blanquería, Accesorios o Sensorial. |
| **Precio** | Solo el número, sin `$` ni puntos. Ej: `8000`. |
| **Descripción corta** | La frase que se ve en la tarjeta. Ej: `100% algodón, talle 0-3m`. |
| **Descripción larga** | (Opcional) Texto más largo para el detalle del producto. |
| **Imágenes** | Una URL por línea (ver punto 4). |
| **Stock / Modelos** | Ver punto 3. |
| **Visible en la web** | Encendido = se muestra. Apagado = queda oculto. |
| **Destacado** | (Opcional) para resaltarlo. |
| **Orden** | Número: menor aparece primero. |

Tocá **Guardar producto**. Listo, ya está en la tienda.

---

## 3. Producto simple vs. con modelos

**Producto simple** (una sola versión): dejá **destildada** la casilla “tiene modelos” y
poné el número en **Stock**. Si el stock llega a **0**, en la web se muestra “Sin stock”
y no se puede agregar.

**Producto con modelos** (colores, estampas, talles): **tildá** “Este producto tiene
modelos / variantes”. Aparece una lista donde cargás **cada modelo con su stock**:
- Tocá **“+ Agregar modelo”** por cada variante.
- Escribí el nombre (ej. `Rojo`) y su stock.
- Un modelo con stock **0** se muestra tachado como “Sin stock”.
- Tienen que ser **al menos 2 modelos** (si es uno solo, usá producto simple).

---

## 4. Fotos (por URL de Google Drive)
1. Subí la foto a Google Drive.
2. Botón derecho → **Compartir** → “Acceso general” → **“Cualquier persona con el enlace”**.
   (Si queda “Restringido”, la foto **no se ve** en la web.)
3. Copiá el enlace y pegalo en el campo **Imágenes**, **una URL por línea**.

**Si el producto tiene modelos:** poné **una foto por modelo, en el mismo orden** que los
modelos. Así, cuando el cliente elige un modelo, ve la foto que corresponde.

> Si no ponés ninguna imagen, se muestra un ícono 📦.

---

## 5. Editar stock rápido (pestaña 📊 Stock)
Para cambiar solo cantidades sin abrir cada producto:
1. Andá a la pestaña **📊 Stock**.
2. Cambiá el número en la fila del producto/modelo.
3. Se guarda solo al salir del campo (hacer clic afuera).

Los colores te avisan de un vistazo:
🔴 = sin stock (0) · 🟠 = poco (3 o menos) · 🟢 = ok.

---

## 6. Editar, ocultar o borrar
- **Editar:** botón **Editar** en la fila del producto.
- **Ocultar/mostrar:** el interruptor **Visible** (sin borrar nada).
- **Destacar:** el interruptor **Destacado**.
- **Borrar:** botón **Borrar** (te pide confirmación; no se puede deshacer).

---

## 7. Datos de la tienda (pestaña ⚙️)
Podés editar el **WhatsApp**, **Instagram**, **email** y un **texto de envíos** sin tocar
código. Se guardan y quedan disponibles para la web.

---

## 8. ⚠️ Importante sobre el stock
Por ahora, cuando un cliente hace un pedido, **el stock NO se descuenta solo**. Es
informativo: vos lo ajustás a mano desde la pestaña **Stock** cuando vendés algo.
(El descuento automático queda para una etapa futura.)

---

### 📞 Soporte
Cualquier duda técnica, escribí a **Martin Romero Studio**
(<https://www.martinromerostudio.com.ar>).

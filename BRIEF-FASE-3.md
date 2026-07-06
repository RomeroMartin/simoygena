====================================================================
BRIEF DE DESARROLLO — SIMO & GENA BABY STORE
Fase 3 (futura): Pagos automáticos con Mercado Pago + descuento de stock
====================================================================
Estado      : NO iniciada. Documento de planificación para cuando se decida avanzar.
Requiere    : Firebase plan Blaze (Cloud Functions). El resto sigue igual.
Preparado por: Martin Romero Studio

--------------------------------------------------------------------
0. RESUMEN EN UNA FRASE
--------------------------------------------------------------------
Sumar cobro automático (Mercado Pago) al flujo actual, moviendo TODA la lógica
sensible (precio real, confirmación de pago, descuento de stock) a un BACKEND
(Cloud Functions), porque el navegador NUNCA es confiable para manejar plata.

--------------------------------------------------------------------
1. POR QUÉ ESTA FASE ES DISTINTA A LAS FASES 1 Y 2
--------------------------------------------------------------------
- Fases 1 y 2: frontend puro + Firestore. Seguro porque no se movía dinero;
  lo peor era un dato mal cargado, y las Reglas de Firestore alcanzaban.
- Fase 3: se cobra de verdad. Las Reglas de Firestore NO pueden:
    * calcular un precio confiable,
    * guardar un secreto (Access Token de MP),
    * recibir el aviso servidor-a-servidor (webhook) de Mercado Pago,
    * llamar a la API de MP para verificar un pago,
    * descontar stock de forma atómica.
  Todo eso necesita código de SERVIDOR → Cloud Functions → plan Blaze.

--------------------------------------------------------------------
2. LA REGLA DE ORO (repetir hasta el cansancio)
--------------------------------------------------------------------
   >>> NUNCA CONFIAR EN EL NAVEGADOR <<<

Todo lo que corre en el browser lo puede manipular el usuario con las
herramientas de desarrollador: el total del carrito, el precio de un producto,
y hasta simular que "volvió de un pago exitoso".

Dos cosas que JAMÁS decide el navegador:
  1. CUÁNTO SE COBRA → lo recalcula el backend leyendo el precio real de
     Firestore. Se ignora cualquier monto que mande el cliente.
  2. SI EL PAGO SE APROBÓ → NO se cree la redirección de "éxito". Solo se cree
     el WEBHOOK de Mercado Pago, y encima se RE-VERIFICA consultando la API de
     MP con el payment_id.

--------------------------------------------------------------------
3. AMENAZAS Y CÓMO SE BLINDAN
--------------------------------------------------------------------
| Amenaza                          | Defensa                                          |
|----------------------------------|--------------------------------------------------|
| Manipular el precio/total en el  | El backend recalcula el total desde los precios  |
| navegador para pagar menos       | reales de Firestore. El monto del cliente se     |
|                                  | descarta.                                        |
| Falsear "pago exitoso" (forzar   | El estado "pagado" SOLO lo setea el webhook      |
| la URL de retorno)               | server-a-server, nunca el frontend.              |
| Webhook falso/spoofeado          | Validar la firma (x-signature) del webhook Y     |
|                                  | re-consultar el pago a la API de MP con el       |
|                                  | payment_id y el Access Token secreto.            |
| Webhook repetido (llega 2+ veces)| Idempotencia: usar el payment_id como clave; si  |
|                                  | ya se procesó, no volver a marcar/descontar.     |
| Vender la última unidad 2 veces  | Descontar stock dentro de una TRANSACCIÓN de     |
| (oversell)                       | Firestore, verificando stock disponible.         |
| Filtrar el Access Token secreto  | El secreto vive SOLO en el backend (Firebase     |
|                                  | Functions Secrets). Nunca en el frontend ni en   |
|                                  | el repo. El front solo usa la Public Key.        |
| Robo de datos de tarjeta         | Las tarjetas se cargan en el entorno de Mercado  |
|                                  | Pago (PCI-DSS). El sitio nunca ve ni guarda      |
|                                  | números de tarjeta.                              |

--------------------------------------------------------------------
4. FLUJO DE PAGO SEGURO (paso a paso)
--------------------------------------------------------------------
1) El cliente confirma el pedido (como en Fase 2) → el pedido ya existe en
   Firestore con estado "pendiente".
2) El cliente toca "Pagar ahora". El navegador llama a una Cloud Function
   `crearPreferencia({ pedidoId })`.
3) La Cloud Function:
     - Lee el pedido y sus items desde Firestore.
     - RECALCULA el total leyendo el precio real de cada producto (no confía en
       el monto del cliente).
     - Verifica stock disponible.
     - Crea una PREFERENCIA de pago en Mercado Pago usando el Access Token
       SECRETO. Guarda el preference_id en el pedido.
     - Devuelve el init_point (URL de checkout) o el preference_id para Bricks.
4) El navegador redirige a Mercado Pago (Checkout Pro) o renderiza el Brick de
   pago. El cliente paga en el entorno de MP (la tarjeta no toca el sitio).
5) Mercado Pago llama al WEBHOOK (otra Cloud Function, `webhookMP`), server a
   server, con la notificación del pago.
6) El webhook:
     - Valida la firma (x-signature) del request.
     - Re-consulta el pago a la API de MP con el payment_id (fuente de verdad).
     - Si el estado es "approved" → en una TRANSACCIÓN de Firestore:
         * marca el pedido como "pagado" (si no lo estaba ya — idempotencia),
         * descuenta el stock de cada item,
         * registra el pago en la colección `pagos`.
7) El navegador NO decide nada: escucha el pedido en Firestore y actualiza la
   UI cuando el estado pasa a "pagado". Las back_urls (éxito/error) son solo
   experiencia de usuario, nunca cambian el estado real.

--------------------------------------------------------------------
5. MANEJO DE SECRETOS
--------------------------------------------------------------------
- Access Token (PRIVADO) de Mercado Pago → SOLO en el backend, como Secret de
  Firebase Functions (`firebase functions:secrets:set MP_ACCESS_TOKEN`).
  NUNCA en el repo, ni en el frontend, ni en firebase-config.js.
- Public Key de MP → puede ir en el frontend (es pública por diseño), solo se
  usa para inicializar el SDK de checkout/Bricks.
- Agregar los secretos al `.gitignore` correspondiente y a los "excludes" del
  deploy. Rotar el token si alguna vez se expone.

--------------------------------------------------------------------
6. MODELO DE DATOS ADICIONAL
--------------------------------------------------------------------
--- Cambios en `pedidos` (ya existe) ---
  Se agregan (los setea el BACKEND, no el cliente):
    preferenciaId   : string   (id de la preferencia de MP)
    pagoId          : string    (payment_id de MP una vez pagado)
    pagoEstado      : string    ("approved" | "pending" | "rejected" | ...)
    pagadoEn        : timestamp
  El estado del pedido suma: "pagado" lo controla el webhook, no el front.

--- Nueva colección: `pagos` (auditoría / reconciliación) ---
  docId: = payment_id de Mercado Pago (sirve de clave de idempotencia)
    pedidoId     : string
    clienteUid   : string
    monto        : number    (el que confirmó MP)
    estado       : string    ("approved" | ...)
    raw          : map        (payload verificado de MP, para auditoría)
    creado       : timestamp

--------------------------------------------------------------------
7. REGLAS DE SEGURIDAD (ajustes)
--------------------------------------------------------------------
- `pagos`      : escritura DENEGADA desde el frontend (solo backend con Admin
                 SDK, que se saltea las reglas). Lectura: solo admin (o nadie).
- `pedidos`    : el cliente NO puede pasar un pedido a "pagado" ni tocar
                 pagoId/pagoEstado/preferenciaId. Restringir esos campos a que
                 solo los escriba el backend (con Admin SDK) o el admin.
                 Regla práctica: el cliente solo crea el pedido "pendiente" y
                 lee los suyos; TODO el ciclo de pago lo maneja el backend.
- `productos`  : el descuento de stock lo hace el backend por transacción; el
                 cliente sigue sin poder escribir productos.
NOTA: el Admin SDK (dentro de Cloud Functions) NO pasa por las Reglas de
Firestore — por eso el backend puede escribir `pagos`, marcar "pagado" y
descontar stock aunque las reglas lo prohíban al frontend.

--------------------------------------------------------------------
8. IDEMPOTENCIA Y STOCK (lo más delicado)
--------------------------------------------------------------------
- IDEMPOTENCIA: un webhook puede llegar varias veces. Antes de marcar "pagado"
  o descontar stock, chequear si `pagos/{payment_id}` ya existe. Si existe, no
  hacer nada (ya se procesó). Usar el payment_id como docId garantiza esto.
- STOCK ATÓMICO: descontar dentro de `runTransaction`. Leer el stock actual,
  verificar que alcance, escribir el nuevo valor. Si dos pagos compiten por la
  última unidad, la transacción evita el oversell.
- ¿Qué pasa si no hay stock al momento del pago aprobado? Definir política con
  la dueña: reembolso automático, o marcar el pedido para gestión manual y
  avisar por WhatsApp. (Recomendado para una tienda chica: avisar y gestionar a
  mano, no automatizar reembolsos al principio.)

--------------------------------------------------------------------
9. PLAN Y COSTOS
--------------------------------------------------------------------
- Se pasa de Spark a BLAZE (pay as you go). Requiere tarjeta, pero el free tier
  cubre de sobra a una tienda chica (millones de invocaciones/mes gratis).
  En la práctica, el costo esperado es ~0; la tarjeta es solo requisito de
  habilitación.
- Conviene poner un presupuesto/alerta de gasto en Google Cloud Billing como
  red de seguridad.
- Mercado Pago cobra su comisión por transacción (ajena a Firebase).

--------------------------------------------------------------------
10. ALTERNATIVA SI NO SE QUIERE BLAZE
--------------------------------------------------------------------
El backend NO tiene que ser Cloud Functions obligatoriamente. Se puede usar
cualquier backend con HTTPS que:
  - guarde el Access Token en secreto,
  - recalcule el total,
  - reciba y verifique el webhook,
  - escriba en Firestore con el Admin SDK.
Opciones: funciones serverless de Vercel/Netlify, un pequeño servicio en Render/
Railway, etc. La integración más limpia con Firestore sigue siendo Cloud
Functions, pero la arquitectura de seguridad es la misma en todos los casos.

--------------------------------------------------------------------
11. ANTI-PATRONES — LO QUE NUNCA HAY QUE HACER
--------------------------------------------------------------------
  ✗ Poner el Access Token secreto en el frontend o en el repo.
  ✗ Crear la preferencia de pago desde el navegador con el monto del cliente.
  ✗ Marcar el pedido como "pagado" en la página de retorno (success URL).
  ✗ Descontar stock desde el frontend, o sin transacción.
  ✗ Confiar en el webhook sin validar firma y sin re-consultar a la API de MP.
  ✗ Procesar el mismo payment_id dos veces (sin idempotencia).
  ✗ Guardar datos de tarjeta en la base (no hace falta: los maneja MP).

--------------------------------------------------------------------
12. CHECKLIST DE ENTREGA (Fase 3)
--------------------------------------------------------------------
  [ ] Proyecto migrado a Blaze, con presupuesto/alerta de gasto configurado.
  [ ] Cloud Functions inicializadas; Access Token guardado como Secret.
  [ ] Function `crearPreferencia`: recalcula total real + verifica stock + crea
      preferencia en MP + guarda preferenciaId en el pedido.
  [ ] Checkout en el frontend (Checkout Pro o Bricks) con la Public Key.
  [ ] Function `webhookMP`: valida firma + re-consulta pago + transacción
      (marca "pagado" + descuenta stock + registra en `pagos`) + idempotente.
  [ ] Colección `pagos` para auditoría/reconciliación.
  [ ] Reglas de Firestore ajustadas (cliente no toca estado de pago ni pagos).
  [ ] UI del cliente escucha el pedido y refleja "pagado" al confirmarse.
  [ ] Panel admin: ver estado de pago, pagoId, y conciliación.
  [ ] Pruebas con las credenciales de PRUEBA de Mercado Pago (sandbox) antes de
      pasar a producción: pago aprobado, rechazado, pendiente, y webhook doble.
  [ ] Manual actualizado para la dueña (qué cambia en su día a día).

--------------------------------------------------------------------
13. QUÉ SE MANTIENE DE LAS FASES 1 Y 2
--------------------------------------------------------------------
- Todo el catálogo, cuentas, carrito e historial siguen igual.
- El cierre por WhatsApp puede convivir como opción (ej. "pagar ahora" vs
  "coordinar por WhatsApp"), o reemplazarse. A definir con la dueña.
- El modelo de datos actual ya deja lugar para todo esto sin rehacer nada.

====================================================================
FIN — Fase 3 (documento de planificación)
====================================================================

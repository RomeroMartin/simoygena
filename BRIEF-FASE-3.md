====================================================================
BRIEF DE DESARROLLO — SIMO & GENA BABY STORE
Fase 3 (futura): Pagos automáticos con Mercado Pago + descuento de stock
====================================================================
Estado      : NO iniciada. Documento de planificación para cuando se decida avanzar.
Requiere    : Firebase plan Blaze (Cloud Functions). El resto sigue igual.
Preparado por: Martin Romero Studio
Revisión    : v2 — incorpora auditoría de seguridad externa. Cambios clave:
              firma de MP por "manifest" (no raw body), idempotencia de negocio
              por pedidoId/external_reference, verificación de monto en el webhook,
              reglas con diff().hasOnly(), y reserva de stock como opción de escala.

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

Tres cosas que JAMÁS decide el navegador:
  1. CUÁNTO SE COBRA → lo recalcula el backend leyendo el precio real de
     Firestore. Se ignora cualquier monto que mande el cliente.
  2. SI EL PAGO SE APROBÓ → NO se cree la redirección de "éxito". Solo se cree
     el WEBHOOK de Mercado Pago, y encima se RE-VERIFICA consultando la API de
     MP con el payment_id.
  3. CUÁNTO SE PAGÓ REALMENTE → al confirmar, el backend compara el monto que
     aprobó MP contra el total recalculado del pedido. Si no coinciden, NO se
     confirma: se marca el pedido para revisión manual. (Última barrera anti
     fraude de monto.)

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
| Oversell CONCURRENTE (varios     | Verificar stock en el webhook (transacción); si  |
| pagan el mismo stock=1 a la vez  | no alcanza al confirmar → gestión manual. Opción  |
| durante el checkout de MP)       | avanzada: reservar stock al crear la preferencia |
|                                  | (ver sección 8). Decisión según escala.          |
| Pagar menos de lo que sale       | El webhook compara el monto aprobado por MP vs.  |
| (monto adulterado)               | el total recalculado del pedido; si difiere, no  |
|                                  | confirma.                                        |
| Cliente edita su propio pedido   | Reglas de Firestore con diff().hasOnly([...]) o   |
| (precio/estado) tras crearlo     | update denegado al cliente (ver sección 7).      |
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
       SECRETO, seteando `external_reference = pedidoId` (clave para cruzar el
       pago con el pedido después). Guarda el preference_id en el pedido.
     - Devuelve el init_point (URL de checkout) o el preference_id para Bricks.
4) El navegador redirige a Mercado Pago (Checkout Pro) o renderiza el Brick de
   pago. El cliente paga en el entorno de MP (la tarjeta no toca el sitio).
5) Mercado Pago llama al WEBHOOK (otra Cloud Function, `webhookMP`), server a
   server, con la notificación del pago.
6) El webhook:
     - Valida la firma `x-signature` de MP (OJO: ver punto clave abajo — NO es
       un hash del body crudo; MP arma un "manifest" con id + request-id + ts).
     - Re-consulta el pago a la API de MP con el payment_id (fuente de verdad).
     - Toma el `external_reference` del pago para ubicar el `pedidoId`.
     - VERIFICA EL MONTO: compara el importe aprobado por MP contra el total
       recalculado del pedido. Si no coincide → no confirma, marca para revisión.
     - Si el estado es "approved" → en una TRANSACCIÓN de Firestore:
         * chequea el estado ACTUAL del pedido: si ya está "pagado", no hace
           nada (idempotencia a nivel de negocio, ver sección 8),
         * marca el pedido como "pagado",
         * descuenta el stock de cada item (verificando que alcance),
         * registra el pago en `pagos/{payment_id}`.
     - Responde HTTP 200 rápido. Si tarda o falla, MP REINTENTA el webhook, así
       que el handler debe ser idempotente (por eso los chequeos de arriba).

   >>> PUNTO CLAVE — validación de la firma de Mercado Pago <<<
   MP NO firma el body crudo (eso es de Stripe). MP manda el header
   `x-signature: ts=<ts>,v1=<hash>`. Hay que:
     1. Leer `ts` y `v1` del header `x-signature`, el header `x-request-id`, y
        el `data.id` (query param `id`/`data.id` de la notificación).
     2. Armar el manifest EXACTO:  id:<data.id>;request-id:<x-request-id>;ts:<ts>;
     3. HMAC-SHA256 de ese manifest con tu Secret de webhook → comparar con `v1`.
   Si el dev intenta validar "hasheando req.rawBody", la firma va a fallar
   SIEMPRE. Confirmar el formato vigente en la doc de MP antes de codear.
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
    (external_reference que va a MP = el docId del pedido, no un campo nuevo)
    -- Solo si se usa reserva de stock (opción avanzada, ver sección 8):
    stockReservado    : boolean
    reservaExpiraEn   : timestamp   (ej. +15 min)
  El estado del pedido suma: "pagado" lo controla el webhook, no el front.

--- Nueva colección: `pagos` (auditoría / reconciliación) ---
  docId: = payment_id de Mercado Pago
    pedidoId     : string    (= external_reference)
    clienteUid   : string
    monto        : number    (el que confirmó MP)
    estado       : string    ("approved" | ...)
    raw          : map        (payload verificado de MP, para auditoría)
    creado       : timestamp
  NOTA: `pagos/{payment_id}` dedupe EVENTOS de pago (un mismo payment_id que
  llega 2 veces). Pero la idempotencia de NEGOCIO (marcar pagado, descontar
  stock, avisar) se controla sobre el PEDIDO (ver sección 8), porque un pedido
  puede generar varios payment_id (rechazado con una tarjeta → aprobado con otra).

--------------------------------------------------------------------
7. REGLAS DE SEGURIDAD (ajustes)
--------------------------------------------------------------------
- `pagos`      : escritura DENEGADA desde el frontend (solo backend con Admin
                 SDK, que se saltea las reglas). Lectura: solo admin (o nadie).
- `pedidos`    : el cliente solo CREA su pedido "pendiente" y LEE los suyos.
                 TODO el ciclo de pago lo maneja el backend (Admin SDK).

  >>> OJO — trampa de Firestore <<<
  Por defecto, si permitís `update` al cliente, puede tocar CUALQUIER campo
  (precio, total, estado, pagoEstado…) salvo que lo prohíbas EXPLÍCITAMENTE.
  NO alcanza con congelar 2 campos sueltos (ej. solo pagoEstado y monto): el
  cliente igual podría cambiar total/items/estado.

  Opción A (recomendada, más simple): el cliente NO actualiza pedidos.
      allow update: if esAdmin();      // el resto lo hace el backend
      // el cliente queda como "lector pasivo" de su estado de pago

  Opción B (si querés dejarle editar algo antes de pagar, ej. notas/dirección):
      allow update: if request.auth != null
        && request.auth.uid == resource.data.clienteUid
        && request.resource.data.diff(resource.data)
             .affectedKeys().hasOnly(['notas','direccionEnvio']);
  `hasOnly([...])` es lo que realmente blinda: prohíbe tocar cualquier campo
  fuera de la lista blanca.

- `productos`  : el descuento de stock lo hace el backend por transacción; el
                 cliente sigue sin poder escribir productos.
NOTA: el Admin SDK (dentro de Cloud Functions) NO pasa por las Reglas de
Firestore — por eso el backend puede escribir `pagos`, marcar "pagado" y
descontar stock aunque las reglas lo prohíban al frontend.

--------------------------------------------------------------------
8. IDEMPOTENCIA Y STOCK (lo más delicado)
--------------------------------------------------------------------
- IDEMPOTENCIA EN DOS NIVELES:
    * Nivel EVENTO: `pagos/{payment_id}` — si ese payment_id ya se registró, es
      un webhook repetido del mismo evento; no reprocesar.
    * Nivel NEGOCIO (el importante): chequear el ESTADO ACTUAL del PEDIDO
      (external_reference = pedidoId). Si el pedido ya está "pagado", no volver
      a descontar stock ni avisar, AUNQUE llegue con un payment_id distinto.
      Motivo: un mismo pedido puede tener varios payment_id (rechazado con una
      tarjeta → aprobado con otra). La clave de negocio es el pedido, no el pago.
- STOCK ATÓMICO: descontar dentro de `runTransaction`. Leer el stock actual,
  verificar que alcance, escribir el nuevo valor. Si dos pagos compiten por la
  última unidad, la transacción evita el oversell.
- REINTENTOS: MP reintenta el webhook si no recibe HTTP 200. El handler tiene
  que ser idempotente (por lo de arriba) y responder 200 aunque el evento ya
  estuviera procesado.
- ¿Qué pasa si no hay stock al momento del pago aprobado? Definir política con
  la dueña: reembolso, o marcar el pedido para gestión manual y avisar por
  WhatsApp. (Recomendado para una tienda chica: avisar y gestionar a mano.)

- OVERSELL CONCURRENTE — ¿reservar stock o no? (decisión de escala)
  El caso: entre que el cliente ve stock, va a MP y paga (puede tardar minutos),
  otro puede estar comprando la misma última unidad. Cuando lleguen los dos
  webhooks aprobados, uno se queda sin stock.
    * Tienda chica / baja concurrencia (caso Simo & Gena): ACEPTABLE resolverlo
      en el webhook (transacción) y gestionar a mano el oversell raro. Simple.
    * Alta demanda / stock muy limitado (drops, ediciones limitadas): conviene
      RESERVAR el stock al crear la preferencia (paso 3), con `stockReservado` y
      `reservaExpiraEn` (~15 min). Si el pago llega, se confirma; si expira sin
      pago, una tarea programada (Cloud Scheduler) devuelve el stock.
      OJO: la reserva TAMBIÉN debe ser transaccional (si no, la race condition
      solo se mueve al momento de reservar). Y suma complejidad + el efecto
      lateral de que carritos abandonados "congelan" stock.
  Recomendación para este proyecto: arrancar SIN reserva (webhook + gestión
  manual) y sumar la reserva solo si el volumen lo justifica.

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
  ✗ Validar la firma de MP hasheando el body crudo (req.rawBody) como si fuera
    Stripe. MP usa un manifest (id + request-id + ts) → así falla siempre.
  ✗ Confirmar el pago sin comparar el monto aprobado contra el total del pedido.
  ✗ Congelar solo 1 o 2 campos en las reglas y dejar el `update` abierto: usar
    diff().hasOnly([...]) o denegar el update al cliente.
  ✗ Atar la idempotencia de negocio SOLO al payment_id (un pedido puede tener
    varios). La clave de negocio es el pedidoId / external_reference.
  ✗ Procesar el mismo payment_id dos veces (sin idempotencia).
  ✗ Guardar datos de tarjeta en la base (no hace falta: los maneja MP).

--------------------------------------------------------------------
12. CHECKLIST DE ENTREGA (Fase 3)
--------------------------------------------------------------------
  [ ] Proyecto migrado a Blaze, con presupuesto/alerta de gasto configurado.
  [ ] Cloud Functions inicializadas; Access Token guardado como Secret.
  [ ] Function `crearPreferencia`: recalcula total real + verifica stock + crea
      preferencia en MP con `external_reference = pedidoId` + guarda preferenciaId.
  [ ] Checkout en el frontend (Checkout Pro o Bricks) con la Public Key.
  [ ] Function `webhookMP`: valida firma (manifest id+request-id+ts) + re-consulta
      pago + verifica MONTO vs total + transacción (marca "pagado" + descuenta
      stock + registra en `pagos`) + idempotente por pedidoId + responde 200.
  [ ] Colección `pagos` para auditoría/reconciliación.
  [ ] Reglas de Firestore ajustadas: cliente NO actualiza pedidos (o diff().hasOnly);
      pagos y estado de pago solo por backend.
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

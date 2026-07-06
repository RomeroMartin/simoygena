# 🔥 Setup de Firebase — Simo & Gena (Fase 1 y 2)

Guía para crear el proyecto de Firebase en el **plan gratuito (Spark, sin tarjeta)**.
Hacé estos pasos y al final pasame los **3 datos** que se listan abajo para que conecte el código.

> Tiempo estimado: 10 minutos. Todo desde el navegador, en la consola de Firebase.

---

## Paso 1 — Crear el proyecto
1. Entrá a <https://console.firebase.google.com> con la cuenta de Google del negocio.
2. **Agregar proyecto** → nombre: `simoygena` (o el que prefieras).
3. **Google Analytics: NO** (podés desactivarlo, no lo necesitamos).
4. Crear proyecto y esperar a que termine.

## Paso 2 — Registrar la app web y copiar la config
1. En la pantalla del proyecto, tocá el ícono **`</>`** (“Web”).
2. Apodo de la app: `simoygena-web`. **NO** marques “Firebase Hosting” todavía.
3. Registrar app. Te va a mostrar un bloque de código con un objeto `firebaseConfig`
   parecido a este:
   ```js
   const firebaseConfig = {
     apiKey: "AIza........",
     authDomain: "simoygena.firebaseapp.com",
     projectId: "simoygena",
     storageBucket: "simoygena.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef123456"
   };
   ```
   👉 **Copialo entero y pasámelo.** (Estas claves son públicas por diseño: van en el
   frontend. La seguridad real la dan las Reglas de Firestore, no ocultar estas claves.)

## Paso 3 — Crear la base de datos (Firestore)
1. Menú lateral → **Compilación → Firestore Database** → **Crear base de datos**.
2. Modo: **Producción** (después yo cargo las reglas de seguridad).
3. Ubicación: **`southamerica-east1` (São Paulo)** — es la más cercana a Argentina.
   ⚠️ La ubicación **no se puede cambiar** después. Confirmá esta.

## Paso 4 — Activar el login (Authentication)
1. Menú lateral → **Compilación → Authentication** → **Comenzar**.
2. Pestaña **Sign-in method** → habilitá **Correo electrónico/contraseña** → Guardar.
   (El primer proveedor alcanza; no hace falta Google ni otros.)

## Paso 5 — Crear el usuario administrador (la dueña)
1. En **Authentication → Users → Agregar usuario**.
2. Email: el correo de la dueña (ej. `simoygena@gmail.com`).
3. Contraseña: una segura (después se puede cambiar).
4. Cuando aparezca en la lista, **copiá el “UID de usuario”** (una cadena larga tipo
   `a1B2c3D4e5...`).
   👉 **Pasame ese UID.** Lo necesito para marcar esa cuenta como admin.

---

## ✅ Lo que necesito que me pases (3 cosas)
1. El objeto **`firebaseConfig`** completo (Paso 2).
2. El **UID del usuario admin** (Paso 5).
3. Confirmación de la **ubicación** elegida en el Paso 3 (idealmente `southamerica-east1`).

Con eso conecto `firebase-config.js`, cargo las reglas de seguridad, migro los productos
y dejo el catálogo leyendo de Firestore para probarlo juntos.

> Los pasos de **Firebase Hosting** y de **autorizar el dominio** los hacemos al final,
> cuando esté todo probado (te los dejo documentados en su momento).

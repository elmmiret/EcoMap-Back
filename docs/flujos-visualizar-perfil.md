# Flujo: Visualizar perfil del usuario (con JWT del backend)

Este documento alinea a Frontend y Backend sobre cómo mostrar el perfil del usuario aprovechando el JWT emitido por el backend, asegurando buena UX y consistencia de datos.

---

## Objetivo

- Renderizar rápido el perfil usando las claims del JWT ya guardado en el front.
- Revalidar con el backend para garantizar frescura y detectar cambios (rol, puntos, racha, foto, etc.).
- Gestionar expiración del JWT y su renovación de forma transparente.

---

## Endpoints implicados

- POST `/api/users/sync` (Auth: Firebase ID token)
  - Emite JWT del backend + `expiryDate` y crea/actualiza sesión.
- GET `/api/users/me` (Auth: Backend JWT)
  - Devuelve datos canónicos del perfil desde la BD. Ver doc: [GET /api/users/me](./api/endpoints/users-me.md)
- POST `/api/users/logout` (Auth: Backend JWT)
  - Cierra sesión del usuario (elimina el JWT de la BD).
- DELETE `/api/users/me` (Auth: Backend JWT, autenticación reciente)
  - Elimina la cuenta.

---

## Flujo recomendado (stale-while-revalidate)

1. Entrada a pantalla de perfil

- Leer JWT backend y `expiryDate` almacenados por el front.
- Si no hay JWT o está expirado → ir a Renovación (ver abajo) o a login.
- Si el JWT es válido:
  - Decodificar el JWT y renderizar inmediatamente los campos disponibles (claims):
    - `uid`, `email`, `name`, `surname`, `username`, `dni`, `profile_picture`, `app_language`, `address`, `phone`, `birth_date`, `description`, `role`, `points`, `streak`.
  - En paralelo, llamar a GET `/api/users/me` con `Authorization: Bearer <JWT>`.

2. Revalidación con backend

- Si `/api/users/me` responde 200 OK → actualizar UI con los datos canónicos.
- Si responde 401 (expirado/invalidado) → intentar Renovación una vez. Si la renovación falla → enviar a login.
- Si responde 404 → el usuario podría haber sido eliminado → logout y a login.

3. Renovación de JWT (sin refresh token propio)

- Obtener un Firebase ID token del usuario actual (cliente): `currentUser.getIdToken(true)`.
- Enviar `POST /api/users/sync` con `Authorization: Bearer <FIREBASE_ID_TOKEN>`.
- Guardar el nuevo `jwt` y `expiryDate` devueltos.
- Reintentar la acción previa (por ejemplo, GET `/api/users/me`).

4. Renovación proactiva (recomendada)

- Si faltan ≤ 2–5 minutos para el `expiryDate`, iniciar renovación en background.
- Minimiza interacciones fallidas y evita latencia extra cuando el token expira entre pantallas.

---

## Contrato de datos

### JWT del backend (claims esperadas)

- `uid`, `email`, `name`, `surname`, `username`, `dni`, `profile_picture?`, `app_language`, `address?`, `phone?`, `birth_date?`, `description?`, `role` (`client|admin|institution`), `points`, `streak`, además de `iat` y `exp`.
- El backend devuelve además `expiryDate` (ISO) junto con el JWT al sincronizar.

### GET `/api/users/me` (respuesta estándar)

```json
{
  "success": true,
  "message": "Perfil obtenido correctamente",
  "data": {
    "uid": "...",
    "email": "...",
    "name": "...",
    "surname": "...",
    "username": "...",
    "dni": "...",
    "profile_picture": "...",
    "app_language": "es",
    "address": "...",
    "phone": "...",
    "birth_date": "1990-01-01",
    "description": "...",
    "role": "client",
    "points": 0,
    "streak": 0
  }
}
```

---

## Estados de error y manejo

- 401 en `/api/users/me` → intentar una renovación (POST `/api/users/sync` usando Firebase ID token) y reintentar una vez. Si vuelve a fallar → logout y a login.
- 404 en `/api/users/me` → usuario no existe (borrado) → logout y a login.
- 500 → mostrar error genérico y permitir reintentar.

---

## Pseudocódigo Frontend (Token Manager + Perfil)

```ts
function isExpiringSoon(expUnix: number, marginSec = 300) {
  const now = Math.floor(Date.now() / 1000);
  return !expUnix || expUnix - now < marginSec;
}

async function renewBackendJWTIfNeeded() {
  const token = tokenStore.get();
  if (!token) return false;
  const { exp } = decodeJWT(token);
  if (!isExpiringSoon(exp)) return true;

  try {
    const idToken = await firebase.auth().currentUser.getIdToken(true);
    const res = await fetch('/api/users/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return false;
    const { jwt, expiryDate } = await res.json();
    tokenStore.set(jwt, expiryDate);
    return true;
  } catch {
    return false;
  }
}

async function loadProfileScreen() {
  const token = tokenStore.get();
  if (!token) return goToLogin();

  // Render inmediato con claims
  const claims = decodeJWT(token);
  renderProfileClaims(claims);

  // Renovación proactiva si expira pronto
  const ok = await renewBackendJWTIfNeeded();
  if (!ok) return goToLogin();

  // Revalidación con backend
  const res = await fetch('/api/users/me', {
    headers: { Authorization: `Bearer ${tokenStore.get()}` },
  });

  if (res.status === 200) {
    const { data } = await res.json();
    renderProfileCanonical(data);
  } else if (res.status === 401) {
    const renewed = await renewBackendJWTIfNeeded();
    if (!renewed) return goToLogin();
    return loadProfileScreen(); // un solo reintento
  } else if (res.status === 404) {
    return forceLogoutAndLogin();
  } else {
    showError('No se pudo cargar el perfil');
  }
}
```

---

## Requisitos/expectativas en Backend

- Middleware de autenticación para JWT del backend que:
  - Verifique la firma y caducidad (claim `exp`).
  - Verifique la sesión en BD (`session` con `expiry_date`).
- `POST /api/users/sync` debe:
  - Aceptar Firebase ID token en `Authorization`.
  - Emitir nuevo JWT + `expiryDate` y persistir en `session`.
- `GET /api/users/me` debe devolver datos canónicos del perfil desde BD.
- Códigos/errores consistentes:
  - `401` → `JWT_EXPIRED` o similar cuando aplique.
  - `404` cuando el usuario no exista.

---

## Seguridad y almacenamiento

- Web: evitar exponer el JWT en `localStorage` si es posible. Preferir almacenamiento en memoria y mecanismos más seguros (o session storage con mitigaciones). En móvil, usar secure storage.
- Aplicar margen de reloj (clock skew) en validaciones locales.
- Cerrar sesión de forma explícita al recibir `401` repetidos o `404`.

---

## Check-list de implementación

- [ ] Front: Token manager con renovación proactiva + reactiva.
- [ ] Front: Render inmediato (claims) + revalidación (`/api/users/me`).
- [ ] Back: `users/sync` emite JWT con `exp` y devuelve `expiryDate`.
- [ ] Back: `users/me` entrega datos canónicos y códigos de error consistentes.
- [ ] Back: Middleware valida firma, exp y sesión en BD.

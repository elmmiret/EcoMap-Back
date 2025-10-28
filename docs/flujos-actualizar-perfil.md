# Flujo: Actualizar perfil del usuario (PUT /api/users/me)

Este documento define el flujo funcional para que un usuario autenticado pueda editar su perfil desde un formulario del frontend. Cubre pasos de UX, contrato de datos y responsabilidades de front y back.

---

## Objetivo

Permitir que el usuario edite de forma segura y fluida los campos de su perfil:

- name, surname, username
- address, phone, birth_date, description

Con validaciones claras, manejo de errores consistente y actualización inmediata de la UI.

---

## Endpoints implicados

- PUT `/api/users/me` (Auth: Backend JWT)
  - Actualiza los campos del perfil. Parcial o total (ver Contrato).
  - Ver doc: [PUT /api/users/me](./api/endpoints/users-update.md)
- GET `/api/users/me` (Auth: Backend JWT)
  - Obtener el estado canónico del perfil tras guardar. Ver doc: [GET /api/users/me](./api/endpoints/users-me.md)

---

## Flujo recomendado (Formulario de edición)

1. Cargar pantalla de edición
   - Leer JWT del backend (si no existe → login).
   - Pre-rellenar el formulario con datos del perfil disponibles:
     - Usar claims del JWT para render inmediato.
     - En paralelo, revalidar con `GET /api/users/me` y sincronizar el formulario con datos canónicos.

2. Edición y validación en cliente
   - Validar en tiempo real (UX y experiencia del usuario):
     - `name`: requerido, mínimo 2 chars, máximo 80.
     - `surname`: opcional, máximo 80 chars.
     - `username`: requerido, 3–30 chars; letras, números, `_` y `.`; comprobar disponibilidad con el backend si es necesario.
     - `address`: opcional, hasta 200 chars.
     - `phone`: opcional, solo dígitos (el backend lo almacena como entero). Sin `+` ni separadores en esta versión del esquema.
     - `birth_date`: opcional, formato ISO `YYYY-MM-DD`.
     - `description`: opcional, hasta 1000 chars.
   - **Importante**: El backend solo valida restricciones críticas (longitudes máximas, formato de datos). Las validaciones de mínimos, formato visual y disponibilidad en tiempo real son responsabilidad del frontend.

3. Envío (guardar cambios)
   - Hacer `PUT /api/users/me` con `Authorization: Bearer <BACKEND_JWT>` y body JSON con los campos a actualizar (parcial OK).
   - Estrategia UX recomendada:
     - Deshabilitar botón Guardar mientras la petición está en curso.
     - Optimistic UI (opcional): aplicar cambios locales y revertir si falla.

4. Confirmación y refresco
   - Si 200 OK: mostrar toast "Perfil actualizado".
   - Reconsultar `GET /api/users/me` o usar la `data` de la respuesta del PUT para sincronizar el estado global/local del usuario.
   - Si 400/409: mostrar mensajes de error por campo (ej. username en uso) y mantener valores del usuario.
   - Si 401: intentar renovación del JWT del backend (POST `/api/users/sync`) y reintentar una vez.

---

## Contrato de datos (propuesto)

PUT `/api/users/me`

- Auth: Backend JWT
- Body (JSON): todos los campos son opcionales para permitir actualizaciones parciales. Solo envía los que el usuario modificó.

| Campo         | Tipo       | Reglas/resumen                                                                             |
| ------------- | ---------- | ------------------------------------------------------------------------------------------- |
| `name`        | string     | Máximo 80 chars; no puede estar vacío si se envía                                           |
| `surname`     | string     | Máximo 80 chars                                                                              |
| `username`    | string     | Máximo 30 chars; `[a-zA-Z0-9_.]`; unicidad si negocio lo exige                              |
| `address`     | string     | Máximo 200 chars                                                                             |
| `phone`       | number/int | Entero positivo                                                                              |
| `birth_date`  | string     | ISO `YYYY-MM-DD`                                                                             |
| `description` | string     | Máximo 1000 chars                                                                            |

> **Frontend**: Es responsable de las validaciones de UX (mínimos de chars, formato visual, disponibilidad de username en tiempo real, etc.).  
> **Backend**: Solo valida restricciones críticas de BD (longitudes máximas, tipos de datos, formato ISO de fechas).

Respuesta 200 OK:

```json
{
  "success": true,
  "message": "Perfil actualizado correctamente",
  "data": {
    "uid": "...",
    "email": "...",
    "name": "...",
    "surname": "...",
    "username": "...",
    "address": "...",
    "phone": 600123123,
    "birth_date": "1990-01-01",
    "description": "...",
    "role": "client",
    "points": 0,
    "streak": 0,
    "app_language": "es",
    "profile_picture": "..."
  }
}
```

Errores (ejemplos):

- 400 Bad Request
  - `INVALID_FIELD:name` | `INVALID_FIELD:username` | `INVALID_FIELD:phone` | `INVALID_DATE`
- 401 Unauthorized
  - `NO_TOKEN` | `TOKEN_EXPIRED` | `INVALID_TOKEN`
- 409 Conflict
  - `USERNAME_TAKEN` (si se valida unicidad)
- 500 Internal Server Error
  - `PROFILE_UPDATE_ERROR`

---

## Pseudocódigo frontend (React/TS)

```ts
async function updateProfile(fields: Partial<{
  name: string;
  surname: string;
  username: string;
  address: string;
  phone: number; // solo dígitos
  birth_date: string; // YYYY-MM-DD
  description: string;
}>) {
  const jwt = tokenStore.get();
  if (!jwt) throw new Error('No session');

  const res = await fetch('/api/users/me', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fields),
  });

  if (res.status === 401) {
    const renewed = await renewBackendJWTIfNeeded();
    if (!renewed) throw new Error('Unauthorized');
    return updateProfile(fields); // un reintento
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.code || json.message || 'No se pudo actualizar');
  }

  // Actualizar estado global con json.data
  userStore.set(json.data);
  return json.data;
}
```

---

## Requisitos/expectativas en Backend

- Auth: Middleware JWT (backend) ya existente.
- Actualización transaccional:
  - Campos de `registered_user`: `name`, `surname`, `username`.
  - Campos de `client`: `address`, `phone` (Int), `birth_date` (Date), `description`.
- Validaciones críticas (solo lo esencial que no puede validar el cliente):
  - `username` formato `[a-zA-Z0-9_.]` y longitud máxima; si negocio exige unicidad → comprobar en BD y devolver 409 `USERNAME_TAKEN`.
  - `phone` debe ser entero positivo (sin `+`, espacios ni separadores). Nota: el esquema actual lo define como `Int?`; si se requiere `+34...`, considerar migrar a `String` en el futuro.
  - `birth_date` parseable a fecha (sin tiempo) y válida.
  - Longitudes máximas de todos los campos de texto según restricciones de BD.
- Respuesta:
  - 200 con el perfil canónico (unificado) tras guardar.
  - Códigos y `code` consistentes con el resto de la API.
- **Separación de responsabilidades**: El backend NO valida mínimos de caracteres, formatos visuales ni disponibilidad en tiempo real. Eso es responsabilidad del frontend para mejor UX.

---

## Seguridad y permisos

- Solo el propietario puede editar su perfil (se extrae `uid` del JWT del backend).
- Registrado en auditoría mínima (uid, campos cambiados –sin valores sensibles–, timestamp).
- Rate limiting opcional para evitar abusos (p. ej., cambios masivos de username).

---

## Check-list de implementación

- [ ] Front: Formulario con validación de campos y estados de error por campo.
- [ ] Front: Gestión de 401 con renovación de JWT y reintento único.
- [ ] Back: Endpoint `PUT /api/users/me` con actualización transaccional en `registered_user` y `client`.
- [ ] Back: Validaciones y, si aplica, verificación de unicidad de `username`.
- [ ] Back: Respuesta 200 con el perfil unificado.
- [ ] Observabilidad: logs de inicio/fin, validaciones y resultado.

---

## Consideraciones futuras

- Cambiar `phone` a `String` en el esquema para permitir `+34...` y formatos internacionales.
- Endpoint de comprobación de disponibilidad de `username` (p. ej., `GET /api/users/availability?username=...`).
- Soportar subida/actualización de `profile_picture` en un endpoint propio.

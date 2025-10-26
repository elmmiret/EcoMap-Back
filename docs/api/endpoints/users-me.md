# GET /api/users/me - Obtener perfil del usuario

Devuelve los datos canónicos del perfil del usuario autenticado directamente desde la base de datos. Está pensado para usarse con el patrón "stale-while-revalidate": el frontend renderiza de inmediato con las claims del JWT del backend y, en paralelo, llama a este endpoint para refrescar la UI con datos frescos.

---

## 📋 Información General

|                   |                            |
| ----------------- | -------------------------- |
| **Método**        | `GET`                      |
| **URL**           | `/api/users/me`            |
| **Autenticación** | ✅ Requerida (Backend JWT) |
| **Rol requerido** | Ninguno                    |

---

## 📤 Request

### Headers

```
Authorization: Bearer <BACKEND_JWT>
Content-Type: application/json
```

### Body

No requiere body.

---

## 📥 Response

### 200 OK - Perfil obtenido correctamente

```json
{
  "success": true,
  "message": "Perfil obtenido correctamente",
  "data": {
    "uid": "...",
    "email": "usuario@ejemplo.com",
    "name": "Nombre",
    "surname": "Apellido",
    "username": "usuario",
    "dni": "12345678A",
    "profile_picture": "https://...",
    "app_language": "es",
    "address": "C/ Ejemplo 123",
    "phone": 600000000,
    "birth_date": "1990-01-01",
    "description": "Sobre mí...",
    "role": "client",
    "points": 0,
    "streak": 0
  }
}
```

Notas:

- El formato de `birth_date` es `YYYY-MM-DD` cuando existe; de lo contrario es `null`.
- `role` se infiere en backend según pertenencia a `admin` o `institution`; por defecto `client`.

### Errores

- 401 Unauthorized – Falta/expiración/invalidación del token
  - `NO_TOKEN`: No se envió el header `Authorization`.
  - `TOKEN_EXPIRED`: El JWT del backend ha expirado.
  - `INVALID_TOKEN`: Firma inválida o token malformado.
  - `INVALID_SESSION`: El JWT no corresponde a una sesión activa (p. ej., tras un logout).
- 404 Not Found – `USER_NOT_FOUND`: El usuario ya no existe en la BD.
- 500 Internal Server Error – `GET_PROFILE_ERROR` o `JWT_CONFIG_ERROR`.

Ejemplos de error:

```json
{
  "success": false,
  "message": "Session is not valid",
  "code": "INVALID_SESSION"
}
```

```json
{
  "success": false,
  "message": "Usuario no encontrado.",
  "code": "USER_NOT_FOUND"
}
```

---

## 💻 Ejemplos

### cURL

```bash
curl -X GET http://localhost:3001/api/users/me \
  -H "Authorization: Bearer YOUR_BACKEND_JWT" \
  -H "Content-Type: application/json"
```

### JavaScript (fetch)

```js
async function fetchProfile(jwt) {
  const res = await fetch('/api/users/me', {
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (res.status === 200) {
    const { data } = await res.json();
    return data; // objeto perfil
  }

  if (res.status === 401) {
    // Intentar renovar sesión con POST /api/users/sync usando Firebase ID token
    throw new Error('UNAUTHORIZED');
  }

  if (res.status === 404) {
    // Usuario eliminado
    throw new Error('USER_DELETED');
  }

  const error = await res.json().catch(() => ({}));
  throw new Error(error.code || 'UNKNOWN_ERROR');
}
```

### Uso recomendado en Frontend (stale-while-revalidate)

1. Decodifica el JWT del backend y renderiza inmediatamente los campos disponibles.
2. Llama en paralelo a `GET /api/users/me` para revalidar y actualizar la UI si cambió algo.
3. Si recibes 401, renueva con `POST /api/users/sync` (usando el Firebase ID token) y reintenta una vez.
4. Si recibes 404, fuerza logout.

---

## 🔐 Seguridad

- Usa exclusivamente HTTPS; los datos de perfil viajan cifrados en tránsito.
- El backend valida firma y expiración del JWT y, además, verifica que la sesión asociada exista en la tabla `session`.
- Tras `POST /api/users/logout`, cualquier `GET /api/users/me` con el mismo JWT devolverá `INVALID_SESSION`.

---

## 🔗 Relacionados

- [POST /api/users/sync](./users-sync.md) – Emite/renueva el JWT del backend
- [POST /api/users/logout](./logout.md) – Invalida la sesión actual
- [DELETE /api/users/me](./users-delete.md) – Elimina la cuenta
- [Flujo: Visualizar perfil (stale-while-revalidate)](../../flujos-visualizar-perfil.md)

# PUT /api/users/me - Actualizar Perfil

Actualiza de forma parcial o total los campos del perfil del usuario autenticado.

---

## 📋 Información General

|                   |                            |
| ----------------- | -------------------------- |
| **Método**        | `PUT`                      |
| **URL**           | `/api/users/me`            |
| **Autenticación** | ✅ Requerida (Backend JWT) |
| **Rol requerido** | Todos                      |

---

## 📤 Request

### Headers

```
Authorization: Bearer <BACKEND_JWT>
Content-Type: application/json
```

### Body (JSON)

Todos los campos son opcionales (actualización parcial). Envía solo los que quieras cambiar.

| Campo         | Tipo       | Reglas/resumen                                                                 |
| ------------- | ---------- | ------------------------------------------------------------------------------- |
| `name`        | string     | Máximo 80 chars; no puede estar vacío si se envía                               |
| `surname`     | string     | Máximo 80 chars                                                                  |
| `username`    | string     | Máximo 30 chars; `[a-zA-Z0-9_.]`; **debe ser único** (no puede repetirse)       |
| `address`     | string     | Máximo 200 chars                                                                 |
| `phone`       | number/int | Entero positivo                                                                  |
| `birth_date`  | string     | ISO `YYYY-MM-DD`                                                                 |
| `description` | string     | Máximo 1000 chars                                                                |

> **Nota**: El frontend debe realizar validaciones de UX en tiempo real (mínimos de caracteres, formatos específicos, etc.). El backend solo valida restricciones críticas de BD y formato básico.

**Ejemplo**:

```json
{
  "name": "Marta",
  "surname": "López",
  "username": "marta.lopez",
  "address": "C/ Mallorca 123, Barcelona",
  "phone": 612345678,
  "birth_date": "1992-05-20",
  "description": "Amante del reciclaje y el senderismo"
}
```

---

## 📥 Response

### 200 OK

```json
{
  "success": true,
  "message": "Perfil actualizado correctamente",
  "data": {
    "uid": "...",
    "email": "...",
    "name": "Marta",
    "surname": "López",
    "username": "marta.lopez",
    "address": "C/ Mallorca 123, Barcelona",
    "phone": 612345678,
    "birth_date": "1992-05-20",
    "description": "Amante del reciclaje y el senderismo",
    "role": "client",
    "points": 0,
    "streak": 0,
    "app_language": "es",
    "profile_picture": null
  }
}
```

### Errores comunes

#### 400 Bad Request

Errores de validación de campos (formato incorrecto, longitud excedida, etc.)

```json
{
  "success": false,
  "message": "Errores de validación en los campos enviados.",
  "code": "VALIDATION_ERROR",
  "errors": [
    { "field": "username", "message": "El campo 'username' solo puede contener letras, números, puntos y guiones bajos." },
    { "field": "birth_date", "message": "El campo 'birth_date' no puede ser una fecha futura." }
  ]
}
```

#### 401 Unauthorized

```json
{ "success": false, "message": "Token expirado.", "code": "TOKEN_EXPIRED" }
```

#### 404 Not Found

```json
{ "success": false, "message": "Usuario no encontrado.", "code": "USER_NOT_FOUND" }
```

#### 409 Conflict

El nombre de usuario ya está siendo utilizado por otro usuario.

```json
{ "success": false, "message": "El nombre de usuario ya está en uso.", "code": "USERNAME_TAKEN" }
```

#### 500 Internal Server Error

```json
{ "success": false, "message": "Error al actualizar el perfil.", "code": "PROFILE_UPDATE_ERROR" }
```

---

## 💻 Ejemplos de Código

### cURL

```bash
curl -X PUT http://localhost:3001/api/users/me \
  -H "Authorization: Bearer <BACKEND_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Marta",
    "username": "marta.lopez",
    "phone": 612345678
  }'
```

### JavaScript/TypeScript

```javascript
async function updateProfile(jwt, fields) {
  const res = await fetch('http://localhost:3001/api/users/me', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fields),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.code || json.message);
  return json.data;
}
```

### Dart/Flutter

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<Map<String, dynamic>> updateProfile(String jwt, Map<String, dynamic> fields) async {
  final res = await http.put(
    Uri.parse('http://localhost:3001/api/users/me'),
    headers: {
      'Authorization': 'Bearer ' + jwt,
      'Content-Type': 'application/json',
    },
    body: jsonEncode(fields),
  );

  final Map<String, dynamic> response = jsonDecode(res.body);
  if (res.statusCode != 200) {
    throw Exception(response['code'] ?? response['message'] ?? 'Error');
  }
  return response['data'];
}
```

---

## 🔐 Seguridad

- Requiere JWT del backend.
- Solo el propietario del token puede modificar su perfil (se usa `uid` del token).
- Se recomienda auditar cambios (quién/cuándo y qué campos) sin persistir valores sensibles.

---

## 📝 Notas

- Los campos `name`, `surname`, `username` residen en `registered_user`.
- Los campos `address`, `phone`, `birth_date` y `description` residen en `client`.
- `phone` es un entero en el esquema actual; si se requieren prefijos internacionales (+34, etc.), considerar migrarlo a `String`.

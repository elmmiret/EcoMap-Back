# PUT /api/users/language - Actualizar Idioma de la Aplicación

Actualiza el idioma de la aplicación (`app_language`) del usuario autenticado en la base de datos.

---

## 📋 Información General

|                   |                            |
| ----------------- | -------------------------- |
| **Método**        | `PUT`                      |
| **URL**           | `/api/users/language`      |
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

| Campo         | Tipo   | Requerido | Descripción                                         |
| ------------- | ------ | --------- | --------------------------------------------------- |
| `newLanguage` | string | Sí        | Nuevo idioma de la aplicación (mínimo 2 caracteres) |

**Ejemplo**:

```json
{
  "newLanguage": "English"
}
```

---

## 📥 Response

### Respuesta Exitosa (200 OK)

```json
{
  "success": true,
  "message": "Idioma de la aplicación cambiado a English.",
  "newLanguage": "English"
}
```

### Respuestas de Error

#### 400 Bad Request - Idioma No Válido

```json
{
  "success": false,
  "message": "Debe proporcionar un idioma válido en el campo \"newLanguage\" del cuerpo de la solicitud.",
  "code": "INVALID_LANGUAGE"
}
```

#### 401 Unauthorized - Token No Proporcionado

```json
{
  "success": false,
  "message": "Token no proporcionado.",
  "code": "NO_TOKEN"
}
```

#### 401 Unauthorized - Token Expirado

```json
{
  "success": false,
  "message": "Token expirado.",
  "code": "TOKEN_EXPIRED"
}
```

#### 401 Unauthorized - Token Inválido

```json
{
  "success": false,
  "message": "Token inválido.",
  "code": "INVALID_TOKEN"
}
```

#### 404 Not Found - Usuario No Encontrado

```json
{
  "success": false,
  "message": "Usuario no encontrado.",
  "code": "USER_NOT_FOUND"
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Error interno del servidor al cambiar el idioma.",
  "code": "DATABASE_ERROR"
}
```

---

## 💻 Ejemplos de Código

### Dart/Flutter

```dart
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

Future<bool> changeAppLanguage(String newLanguage) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final backendJWT = prefs.getString('backend_jwt');

    if (backendJWT == null) {
      print('❌ No hay sesión activa.');
      return false;
    }

    final response = await http.put(
      Uri.parse('http://localhost:3001/api/users/language'),
      headers: {
        'Authorization': 'Bearer $backendJWT',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'newLanguage': newLanguage,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      print('✅ Idioma cambiado a: ${data['newLanguage']}');
      
      // Actualizar estado local
      await prefs.setString('app_language', data['newLanguage']);
      
      return true;
    }

    if (response.statusCode == 400) {
      print('❌ Idioma no válido');
      return false;
    }

    if (response.statusCode == 401) {
      print('⚠️ Sesión expirada. Por favor, inicia sesión de nuevo.');
      return false;
    }

    print('❌ Error al cambiar idioma: ${response.statusCode}');
    return false;
  } catch (e) {
    print('❌ Error: $e');
    return false;
  }
}
```

### cURL

```bash
curl -X PUT http://localhost:3001/api/users/language \
  -H "Authorization: Bearer <BACKEND_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"newLanguage": "Catalan"}'
```

### JavaScript/TypeScript

```javascript
const changeAppLanguage = async (backendJWT, newLanguage) => {
  try {
    const response = await fetch('http://localhost:3001/api/users/language', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${backendJWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        newLanguage: newLanguage,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Idioma cambiado a:', data.newLanguage);
      
      // Actualizar estado local
      localStorage.setItem('app_language', data.newLanguage);
      
      return true;
    }

    if (response.status === 400) {
      console.error('❌ Idioma no válido');
      return false;
    }

    if (response.status === 401) {
      console.warn('⚠️ Sesión expirada. Por favor, inicia sesión de nuevo.');
      return false;
    }

    console.error('❌ Error al cambiar idioma:', response.status);
    return false;
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
};
```

---

## 🔐 Seguridad

- El endpoint está protegido con autenticación JWT del backend.
- Solo el usuario autenticado puede cambiar su propio idioma (se usa el `uid` del token decodificado).
- No se permite cambiar el idioma de otros usuarios.

---

## 📝 Notas Importantes

- **No se genera un nuevo JWT**: A diferencia de otros endpoints que modifican datos críticos del usuario, este endpoint **solo actualiza la base de datos**. El JWT actual del usuario sigue siendo válido y no es necesario renovarlo.

- **Persistencia**: El idioma se guarda en la base de datos, por lo que estará disponible en futuros inicios de sesión cuando el usuario llame a `GET /api/users/me`.

- **Validación mínima**: Se requiere que el idioma tenga al menos 2 caracteres. No hay validación estricta de idiomas específicos, permitiendo flexibilidad para soportar nuevos idiomas sin cambios en el backend.

---

## Flujo de Uso Recomendado

1. **Usuario cambia el idioma en la aplicación móvil/web**
   - El frontend detecta el cambio de idioma en la configuración del usuario.

2. **Frontend envía la petición PUT**
   - Incluye el JWT del backend en el header `Authorization`.
   - Envía el nuevo idioma en el body como `newLanguage`.

3. **Backend valida y actualiza**
   - Verifica que el token JWT sea válido.
   - Valida que `newLanguage` sea una cadena válida (mínimo 2 caracteres).
   - Actualiza el campo `app_language` en la tabla `registered_user` de la base de datos.

4. **Frontend recibe confirmación**
   - El idioma ha sido actualizado en la BD.
   - El frontend actualiza su estado local y refleja el cambio inmediatamente en la UI.

---

## Relación con Otros Endpoints

- **GET /api/users/me**: Devuelve el perfil del usuario, incluyendo el campo `app_language` actualizado.
- **POST /api/users/sync**: Al registrarse o iniciar sesión, se establece el idioma por defecto a `"Spanish"`.

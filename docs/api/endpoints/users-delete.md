# DELETE /api/users/me - Eliminar Cuenta de Usuario

Permite a un usuario autenticado eliminar permanentemente su propia cuenta. La operación es irreversible y elimina todos los datos del usuario tanto de la base de datos local como del sistema de autenticación de Firebase.

Por seguridad, este endpoint requiere que el usuario haya iniciado sesión recientemente (en los últimos 5 minutos).

---

## 📋 Información General

|                   |                            |
| ----------------- | -------------------------- |
| **Método**        | `DELETE`                   |
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

### Body

No requiere body.

---

## 📥 Response

### Respuesta Exitosa (200 OK)

```json
{
  "success": true,
  "message": "Tu cuenta ha sido eliminada permanentemente."
}
```

### Respuestas de Error

#### 401 Unauthorized - Autenticación Reciente Requerida

El token JWT fue emitido hace más de 5 minutos. El usuario debe iniciar sesión de nuevo.

```json
{
  "success": false,
  "message": "La sesión ha expirado. Por favor, inicie sesión de nuevo para continuar.",
  "code": "RECENT_LOGIN_REQUIRED"
}
```

#### 401 Unauthorized - Token Inválido

```json
{
  "success": false,
  "message": "Token de autenticación no proporcionado o inválido.",
  "code": "INVALID_TOKEN"
}
```

#### 404 Not Found - Usuario No Encontrado en BD

```json
{
  "success": false,
  "message": "El usuario no fue encontrado en nuestra base de datos.",
  "code": "USER_NOT_FOUND_IN_DB"
}
```

#### 500 Internal Server Error - Error de Firebase

```json
{
  "success": false,
  "message": "Ocurrió un error con el servicio de autenticación al intentar eliminar tu cuenta.",
  "code": "FIREBASE_ERROR"
}
```

#### 500 Internal Server Error - Error Genérico

```json
{
  "success": false,
  "message": "Ocurrió un error al intentar eliminar tu cuenta."
}
```

---

## 💻 Ejemplos de Código

### Dart/Flutter

```dart
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

Future<bool> deleteUserAccount() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final backendJWT = prefs.getString('backend_jwt');

    if (backendJWT == null) {
      print('❌ No hay sesión activa.');
      return false;
    }

    final response = await http.delete(
      Uri.parse('http://localhost:3001/api/users/me'),
      headers: {
        'Authorization': 'Bearer $backendJWT',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      print('✅ Cuenta eliminada correctamente.');
      
      // Limpiar datos locales
      await prefs.remove('backend_jwt');
      await prefs.remove('firebase_token');
      
      return true;
    }

    if (response.statusCode == 401) {
      final error = jsonDecode(response.body);
      if (error['code'] == 'RECENT_LOGIN_REQUIRED') {
        print('⚠️ Debes iniciar sesión de nuevo para eliminar tu cuenta.');
      }
      return false;
    }

    print('❌ Error al eliminar cuenta: ${response.statusCode}');
    return false;
  } catch (e) {
    print('❌ Error: $e');
    return false;
  }
}
```

### cURL

```bash
curl -X DELETE http://localhost:3001/api/users/me \
  -H "Authorization: Bearer <BACKEND_JWT>" \
  -H "Content-Type: application/json"
```

### JavaScript/TypeScript

```javascript
const deleteUserAccount = async (backendJWT) => {
  try {
    const response = await fetch('http://localhost:3001/api/users/me', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${backendJWT}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.log('✅ Cuenta eliminada correctamente.');
      
      // Limpiar datos locales
      localStorage.removeItem('backend_jwt');
      localStorage.removeItem('firebase_token');
      
      return true;
    }

    if (response.status === 401) {
      const error = await response.json();
      if (error.code === 'RECENT_LOGIN_REQUIRED') {
        console.warn('⚠️ Debes iniciar sesión de nuevo para eliminar tu cuenta.');
      }
      return false;
    }

    console.error('❌ Error al eliminar cuenta:', response.status);
    return false;
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
};
```

---

## 🔐 Seguridad

- **Autenticación reciente obligatoria**: El token JWT debe haber sido emitido en los últimos 5 minutos.
- **Eliminación en cascada**: Al eliminar el usuario de la tabla `user`, todas las referencias relacionadas (sesiones, publicaciones, etc.) se eliminan automáticamente gracias a `ON DELETE CASCADE`.
- **Orden de eliminación**: Primero se elimina en Firebase Authentication, luego en la base de datos local.
- **Irreversible**: Esta acción no se puede deshacer. Se recomienda mostrar un diálogo de confirmación claro al usuario antes de ejecutarla.

---

## Flujo de Uso Recomendado

1. **Confirmación del usuario**: Mostrar un diálogo advirtiendo que la eliminación es permanente e irreversible.
2. **Verificar autenticación reciente**: Si el usuario acepta, verificar que su sesión sea reciente (< 5 min). Si no, pedirle que inicie sesión de nuevo.
3. **Llamar al endpoint**: Realizar la petición DELETE con el JWT del backend.
4. **Manejar respuestas**:
   - **200 OK**: Limpiar datos locales y redirigir a la pantalla de inicio/despedida.
   - **401 RECENT_LOGIN_REQUIRED**: Redirigir al login y reintentar después.
   - **Otros errores**: Mostrar mensaje de error genérico.


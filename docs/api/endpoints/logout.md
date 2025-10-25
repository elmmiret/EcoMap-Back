# POST /api/users/logout - Cerrar Sesión

Invalida el JWT de la sesión actual del usuario, eliminándolo de la base de datos. Esto asegura que el token no pueda ser reutilizado.

---

## 📋 Información General

|                   |                            |
| ----------------- | -------------------------- |
| **Método**        | `POST`                     |
| **URL**           | `/api/users/logout`        |
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

### Respuesta Exitosa (200 OK)

```json
{
  "success": true,
  "message": "Sesión cerrada correctamente."
}
```

### Respuestas de Error

#### 400 Bad Request

```json
{
  "success": false,
  "message": "Token o UID de usuario no proporcionado.",
  "code": "BAD_REQUEST"
}
```

#### 401 Unauthorized

Si el token no es válido o ha expirado.

```json
{
  "success": false,
  "message": "Invalid authentication token",
  "code": "INVALID_TOKEN"
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Error interno del servidor al cerrar la sesión.",
  "code": "DATABASE_ERROR"
}
```

---

## 💻 Ejemplos de Código

### Dart/Flutter

```dart
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

Future<bool> logoutUser() async {
  try {
    // 1. Obtener JWT guardado
    final prefs = await SharedPreferences.getInstance();
    final backendJWT = prefs.getString('backend_jwt');

    if (backendJWT == null) {
      print('⚠️ No hay sesión activa para cerrar.');
      return true; // Ya está "deslogueado"
    }

    // 2. Llamar al endpoint de logout
    final response = await http.post(
      Uri.parse('http://localhost:3001/api/users/logout'),
      headers: {
        'Authorization': 'Bearer $backendJWT',
        'Content-Type': 'application/json',
      },
    );

    // 3. Eliminar JWT localmente sin importar la respuesta
    await prefs.remove('backend_jwt');
    print('🗑️ JWT local eliminado.');

    if (response.statusCode == 200) {
      print('✅ Sesión cerrada exitosamente en el backend.');
      return true;
    } else {
      // Aunque falle, el usuario está deslogueado en el cliente
      print('⚠️ Error en el backend al cerrar sesión, pero el cliente ya está deslogueado.');
      return true;
    }
  } catch (e) {
    print('❌ Excepción al cerrar sesión: $e');
    // Asegurarse de limpiar localmente
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('backend_jwt');
    return true;
  }
}
```

### cURL

```bash
# Reemplaza YOUR_BACKEND_JWT con tu token real
curl -X POST http://localhost:3001/api/users/logout \
  -H "Authorization: Bearer YOUR_BACKEND_JWT" \
  -H "Content-Type: application/json"
```

---

## 🎯 Casos de Uso

### Flujo de Logout Completo

```dart
class AuthService {
  Future<void> logout() async {
    // 1. Invalidar sesión en el backend
    await logoutUser();

    // 2. Cerrar sesión en Firebase (opcional, pero recomendado)
    await FirebaseAuth.instance.signOut();

    print('👋 Logout completo.');
    // 3. Redirigir al usuario a la pantalla de login
    // navigatorKey.currentState?.pushNamedAndRemoveUntil('/login', (route) => false);
  }
}
```

---

## 📝 Notas Importantes

- **Seguridad**: Este endpoint es crucial para la seguridad. Al eliminar el JWT de la base de datos, se previene el uso de tokens robados.
- **Limpieza Local**: Siempre se debe eliminar el JWT del almacenamiento local del cliente (`SharedPreferences`, `SecureStorage`, etc.) después de llamar a este endpoint, incluso si la llamada falla.
- **Diferencia con `DELETE /me`**: `/logout` solo cierra una sesión. `DELETE /me` elimina permanentemente la cuenta del usuario.

---

**Anterior**: [← POST /api/users/sync](users-sync.md)
**Volver a**: [Resumen de Endpoints](../02-endpoints-resumen.md)

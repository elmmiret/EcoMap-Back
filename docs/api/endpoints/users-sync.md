# POST /api/users/sync - Sincronizar Usuario

Sincroniza el usuario autenticado de Firebase con la base de datos PostgreSQL y devuelve un JWT propio del backend con toda la información del usuario.

---

## 📋 Información General

|                   |                               |
| ----------------- | ----------------------------- |
| **Método**        | `POST`                        |
| **URL**           | `/api/users/sync`             |
| **Autenticación** | ✅ Requerida (Firebase Token) |
| **Rol requerido** | Ninguno                       |

---

## 📤 Request

### Headers

```
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: application/json
```

### Body

No requiere body. Los datos del usuario se extraen del token de Firebase.

### Datos extraídos del Firebase Token

El backend extrae automáticamente:

- `uid` - ID único del usuario en Firebase (requerido)
- `email` - Correo electrónico (requerido)
- `name` - Nombre (requerido)
- `surname` - Apellido (opcional)
- `phone_number` - Teléfono (opcional)
- `picture` - URL de foto de perfil (opcional)

---

## 📥 Response

### Respuesta Exitosa

#### 200 OK - Usuario ya existía

```json
{
  "success": true,
  "message": "Usuario ya existía",
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 201 Created - Usuario creado exitosamente

```json
{
  "success": true,
  "message": "Usuario y cliente sincronizados correctamente",
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Contenido del JWT

El JWT devuelto contiene el siguiente payload:

```json
{
  "uid": "firebase_user_id",
  "email": "usuario@ejemplo.com",
  "name": "Nombre",
  "surname": "Apellido",
  "profile_picture": "https://...",
  "role": "client",
  "points": 0,
  "streak": 0,
  "iat": 1698086400,
  "exp": 1698090000
}
```

### Respuestas de Error

#### 400 Bad Request - Datos incompletos

```json
{
  "success": false,
  "message": "Datos de usuario incompletos (uid o email faltante).",
  "code": "INCOMPLETE_DATA"
}
```

#### 400 Bad Request - Nombre faltante

```json
{
  "success": false,
  "message": "El nombre del usuario es obligatorio.",
  "code": "NAME_REQUIRED"
}
```

#### 401 Unauthorized - Token no proporcionado

```json
{
  "success": false,
  "message": "No authentication token provided",
  "code": "NO_TOKEN"
}
```

#### 401 Unauthorized - Token inválido

```json
{
  "success": false,
  "message": "Invalid authentication token",
  "code": "INVALID_TOKEN"
}
```

#### 401 Unauthorized - Token expirado

```json
{
  "success": false,
  "message": "Token expired",
  "code": "TOKEN_EXPIRED"
}
```

#### 409 Conflict - Usuario duplicado

```json
{
  "success": false,
  "message": "El usuario ya existe en la base de datos.",
  "code": "USER_EXISTS"
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Error interno del servidor al sincronizar el usuario en la base de datos.",
  "code": "DATABASE_ERROR"
}
```

---

## 💻 Ejemplos de Código

### Dart/Flutter - Completo

```dart
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:jwt_decode/jwt_decode.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

/// Sincroniza el usuario con el backend y guarda el JWT
Future<Map<String, dynamic>?> syncUserToBackend() async {
  try {
    // 1. Obtener usuario actual de Firebase
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      print('❌ No hay usuario autenticado en Firebase');
      return null;
    }

    // 2. Obtener token de Firebase
    final firebaseToken = await user.getIdToken();
    if (firebaseToken == null) {
      print('❌ No se pudo obtener el token de Firebase');
      return null;
    }

    // 3. Hacer petición al backend
    final response = await http.post(
      Uri.parse('http://localhost:3001/api/users/sync'),
      headers: {
        'Authorization': 'Bearer $firebaseToken',
        'Content-Type': 'application/json',
      },
    );

    final data = jsonDecode(response.body);

    // 4. Manejar respuesta exitosa
    if (response.statusCode == 200 || response.statusCode == 201) {
      if (data['success'] == true) {
        final backendJWT = data['jwt'];

        // 5. Decodificar JWT para obtener datos
        final userPayload = Jwt.parseJwt(backendJWT);

        print('✅ Usuario sincronizado');
        print('   UID: ${userPayload['uid']}');
        print('   Email: ${userPayload['email']}');
        print('   Nombre: ${userPayload['name']}');
        print('   Rol: ${userPayload['role']}');
        print('   Puntos: ${userPayload['points']}');

        // 6. Guardar JWT en almacenamiento local
        await _saveBackendJWT(backendJWT);

        return userPayload;
      }
    }

    // 7. Manejar errores específicos
    if (response.statusCode == 401) {
      print('❌ Error de autenticación: ${data['code']}');

      if (data['code'] == 'TOKEN_EXPIRED') {
        // Refrescar token de Firebase y reintentar
        print('⟳ Token de Firebase expirado, refrescando...');
        final newToken = await user.getIdToken(forceRefresh: true);
        // Aquí podrías reintentar la petición recursivamente
      }
    } else if (response.statusCode == 400) {
      print('❌ Datos incompletos: ${data['message']}');
    } else {
      print('❌ Error ${response.statusCode}: ${data['message']} (${data['code']})');
    }

    return null;
  } catch (e) {
    print('❌ Excepción al sincronizar usuario: $e');
    return null;
  }
}

/// Guarda el JWT del backend en almacenamiento local
Future<void> _saveBackendJWT(String jwt) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString('backend_jwt', jwt);
  print('💾 JWT guardado localmente');
}

/// Obtiene el JWT guardado
Future<String?> getBackendJWT() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString('backend_jwt');
}

/// Elimina el JWT (logout)
Future<void> deleteBackendJWT() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove('backend_jwt');
  print('🗑️ JWT eliminado');
}

/// Obtiene los datos del usuario desde el JWT sin hacer peticiones
Future<Map<String, dynamic>?> getUserFromJWT() async {
  final jwt = await getBackendJWT();

  if (jwt == null) {
    print('⚠️ No hay JWT guardado');
    return null;
  }

  // Verificar si expiró
  if (Jwt.isExpired(jwt)) {
    print('⚠️ JWT expirado, necesitas re-sincronizar');
    await deleteBackendJWT();
    return null;
  }

  // Decodificar y devolver payload
  return Jwt.parseJwt(jwt);
}
```

### Dart/Flutter - Uso en el Login Flow

```dart
class AuthService {
  /// Login completo: Firebase + Backend sync
  Future<bool> loginUser(String email, String password) async {
    try {
      // 1. Autenticar con Firebase
      final credential = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: email,
        password: password,
      );

      if (credential.user == null) {
        print('❌ Error al autenticar con Firebase');
        return false;
      }

      // 2. Sincronizar con backend
      final userData = await syncUserToBackend();

      if (userData == null) {
        print('❌ Error al sincronizar con backend');
        return false;
      }

      print('✅ Login exitoso');
      return true;
    } catch (e) {
      print('❌ Error en login: $e');
      return false;
    }
  }

  /// Logout completo: Firebase + Backend
  Future<void> logoutUser() async {
    // Eliminar JWT del backend
    await deleteBackendJWT();

    // Cerrar sesión en Firebase
    await FirebaseAuth.instance.signOut();

    print('👋 Logout exitoso');
  }

  /// Verificar si el usuario está autenticado
  Future<bool> isUserAuthenticated() async {
    // Verificar Firebase
    final firebaseUser = FirebaseAuth.instance.currentUser;
    if (firebaseUser == null) return false;

    // Verificar JWT del backend
    final userData = await getUserFromJWT();
    if (userData == null) {
      // JWT expirado o no existe, re-sincronizar
      final newUserData = await syncUserToBackend();
      return newUserData != null;
    }

    return true;
  }
}
```

### cURL

```bash
# Reemplaza YOUR_FIREBASE_TOKEN con tu token real
curl -X POST http://localhost:3001/api/users/sync \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json"
```

### JavaScript/TypeScript

```javascript
const syncUser = async (firebaseToken) => {
  try {
    const response = await fetch('http://localhost:3001/api/users/sync', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.success) {
      // Guardar JWT
      localStorage.setItem('backend_jwt', data.jwt);

      // Decodificar JWT (usar librería jwt-decode)
      const payload = jwtDecode(data.jwt);
      console.log('Usuario:', payload);

      return payload;
    }

    console.error('Error:', data.message);
    return null;
  } catch (error) {
    console.error('Excepción:', error);
    return null;
  }
};
```

---

## 🎯 Casos de Uso

### 1. Después del registro (Sign Up)

```dart
Future<void> handleSignUp(String email, String password, String name) async {
  try {
    // 1. Crear usuario en Firebase
    final credential = await FirebaseAuth.instance.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );

    // 2. Actualizar perfil con el nombre
    await credential.user?.updateDisplayName(name);
    await credential.user?.reload();

    // 3. Sincronizar con backend
    final userData = await syncUserToBackend();

    if (userData != null) {
      // Navegar a home
      Navigator.pushReplacementNamed(context, '/home');
    }
  } catch (e) {
    print('Error en registro: $e');
  }
}
```

### 2. Después del login (Sign In)

```dart
Future<void> handleSignIn(String email, String password) async {
  try {
    // 1. Autenticar con Firebase
    await FirebaseAuth.instance.signInWithEmailAndPassword(
      email: email,
      password: password,
    );

    // 2. Sincronizar con backend
    final userData = await syncUserToBackend();

    if (userData != null) {
      // Navegar a home
      Navigator.pushReplacementNamed(context, '/home');
    }
  } catch (e) {
    print('Error en login: $e');
  }
}
```

### 3. Al iniciar la aplicación

```dart
class MyApp extends StatefulWidget {
  @override
  _MyAppState createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  bool _isLoading = true;
  bool _isAuthenticated = false;

  @override
  void initState() {
    super.initState();
    _checkAuthStatus();
  }

  Future<void> _checkAuthStatus() async {
    // Verificar si hay usuario en Firebase
    final firebaseUser = FirebaseAuth.instance.currentUser;

    if (firebaseUser != null) {
      // Verificar/refrescar JWT del backend
      final userData = await getUserFromJWT();

      if (userData == null) {
        // JWT expirado, re-sincronizar
        await syncUserToBackend();
      }

      setState(() {
        _isAuthenticated = true;
        _isLoading = false;
      });
    } else {
      setState(() {
        _isAuthenticated = false;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return MaterialApp(
        home: Scaffold(
          body: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    return MaterialApp(
      home: _isAuthenticated ? HomeScreen() : LoginScreen(),
    );
  }
}
```

---

## ⚠️ Manejo de Errores

### Tabla de Códigos de Error

| Código            | Causa                                      | Acción Recomendada                             |
| ----------------- | ------------------------------------------ | ---------------------------------------------- |
| `NO_TOKEN`        | No se envió el header Authorization        | Verificar que se incluye el token de Firebase  |
| `INVALID_TOKEN`   | Token de Firebase malformado o revocado    | Pedir al usuario que se autentique nuevamente  |
| `TOKEN_EXPIRED`   | Token de Firebase expiró (>1h)             | Refrescar con `getIdToken(forceRefresh: true)` |
| `INCOMPLETE_DATA` | uid o email faltantes en el token          | Verificar configuración de Firebase            |
| `NAME_REQUIRED`   | Firebase no devolvió el nombre del usuario | Asegurar que `displayName` está configurado    |
| `USER_EXISTS`     | Intento de crear usuario duplicado         | No es crítico, continuar normalmente           |
| `DATABASE_ERROR`  | Error en PostgreSQL                        | Mostrar mensaje genérico, contactar soporte    |

---

## 📝 Notas Importantes

1. **Llamar solo después de autenticación con Firebase**: Este endpoint requiere un token válido de Firebase.

2. **Guardar el JWT devuelto**: El JWT del backend debe guardarse y usarse en todas las peticiones futuras.

3. **El JWT contiene todos los datos del usuario**: No es necesario hacer peticiones adicionales para obtener el perfil.

4. **Roles automáticos**: Por defecto, todos los usuarios nuevos se crean como `client`.

5. **Idioma por defecto**: Se configura como `Spanish` automáticamente.

6. **Puntos y racha iniciales**: Los nuevos clientes comienzan con 0 puntos y 0 racha.

---

## 🔗 Endpoints Relacionados

- [GET / - Health Check](health-check.md)
- `GET /api/users/me` - Obtener perfil actual (próximamente)
- `PUT /api/users/me` - Actualizar perfil (próximamente)

---

## 📦 Dependencias Necesarias

```yaml
dependencies:
  firebase_auth: ^4.15.0
  http: ^1.1.0
  jwt_decode: ^0.3.1
  shared_preferences: ^2.2.2
  # O para mayor seguridad:
  flutter_secure_storage: ^9.0.0
```

---

**Anterior**: [← Health Check](health-check.md)  
**Volver a**: [Resumen de Endpoints](../02-endpoints-resumen.md)

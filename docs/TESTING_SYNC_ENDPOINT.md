# Testing del Endpoint /api/users/sync

## 📋 Resumen del Endpoint

**URL:** `POST http://localhost:3001/api/users/sync`  
**Autenticación:** Requiere token de Firebase (Bearer token)  
**Función:** Sincroniza un usuario autenticado de Firebase con PostgreSQL

---

## 🚨 Problemas Identificados y Solucionados

### ✅ 1. CORS configurado

- Se añadió middleware CORS para permitir peticiones desde diferentes orígenes
- Configurado para aceptar headers `Authorization` y `Content-Type`

### ✅ 2. Puerto corregido

- Puerto por defecto cambiado de `3000` a `3001`

### ✅ 3. Mock de base de datos mejorado

- Ahora muestra logs claros cuando se ejecutan queries
- Advertencia visible de que es un mock

### ⚠️ 4. Base de datos en MOCK

**IMPORTANTE:** La base de datos actual es un MOCK. Para usar PostgreSQL real:

```bash
# 1. Instala pg
npm install pg

# 2. Configura tu .env
DATABASE_URL=postgres://admin:password@localhost:5432/ecomapdb

# 3. Descomenta el código real en src/db.js
```

---

## 🧪 Cómo Probar el Endpoint

### Opción 1: Con cURL (desde terminal)

```bash
# Primero, obtén un token de Firebase desde tu frontend
# Luego ejecuta:

curl -X POST http://localhost:3001/api/users/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN_HERE"
```

### Opción 2: Con Postman o Thunder Client

1. **Método:** POST
2. **URL:** `http://localhost:3001/api/users/sync`
3. **Headers:**
   - `Content-Type`: `application/json`
   - `Authorization`: `Bearer YOUR_FIREBASE_ID_TOKEN_HERE`
4. **Body:** No necesita body (los datos vienen del token)

### Opción 3: Desde JavaScript (Frontend)

```javascript
// Obtén el token del usuario autenticado
const user = auth.currentUser;
const idToken = await user.getIdToken();

// Haz la petición
const response = await fetch('http://localhost:3001/api/users/sync', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  },
});

const data = await response.json();
console.log(data);
```

---

## 📊 Respuestas Esperadas

### ✅ Éxito (200)

```json
{
  "message": "Sincronización de usuario exitosa",
  "uid": "firebase-user-id-123"
}
```

### ❌ Sin token (401)

```json
{
  "error": "Acceso denegado. Formato de token inválido o no proporcionado (espera: \"Bearer <token>\")."
}
```

### ❌ Token inválido (403)

```json
{
  "error": "Token inválido o acceso no autorizado."
}
```

### ❌ Token expirado (403)

```json
{
  "error": "El token ha expirado. Por favor, inicia sesión nuevamente."
}
```

### ❌ Usuario ya existe (409)

```json
{
  "error": "El usuario ya existe en la base de datos."
}
```

---

## 🔍 Verificación de Logs

Al ejecutar el servidor, deberías ver:

```
Firebase Admin SDK inicializado correctamente usando la llave de: ./service-account-key.json
⚠️  ADVERTENCIA: Usando mock de base de datos. Para usar PostgreSQL real:
   1. Instala: npm install pg
   2. Configura DATABASE_URL en .env
   3. Descomenta el código real en src/db.js
🚀 Servidor Express corriendo en http://localhost:3001
```

Cuando hagas una petición:

```
🔍 Mock DB Query: SELECT uid FROM users WHERE uid = $1
📦 Params: [ 'firebase-user-id-123' ]
✅ Mock: Usuario NO encontrado
🔍 Mock DB Query: INSERT INTO users (uid, email) VALUES ($1, $2)
📦 Params: [ 'firebase-user-id-123', 'user@example.com' ]
✅ Mock: Usuario insertado (simulado)
Nuevo usuario registrado en PostgreSQL: firebase-user-id-123
```

---

## 🐛 Troubleshooting

### Problema: "CORS error"

**Solución:** El CORS ya está configurado. Si aún falla, verifica que el frontend esté haciendo la petición correctamente.

### Problema: "Token inválido"

**Solución:**

1. Verifica que el service account key de Firebase existe
2. Asegúrate de que el token es reciente (expiran en 1 hora)
3. Verifica que el formato es `Bearer TOKEN` (con espacio)

### Problema: "Cannot connect to database"

**Solución:** Estás usando el mock. Para usar PostgreSQL real, sigue las instrucciones arriba.

### Problema: "Firebase not initialized"

**Solución:**

1. Verifica que `FIREBASE_KEY_PATH` esté en `.env`
2. Verifica que el archivo JSON existe en esa ruta
3. El archivo debe ser el service account key descargado de Firebase Console

---

## 📝 Checklist de Verificación

Antes de probar, asegúrate de:

- [ ] Servidor corriendo (`npm run dev`)
- [ ] Firebase Admin SDK inicializado correctamente
- [ ] Service account key configurado
- [ ] Variables de entorno cargadas desde `.env`
- [ ] Token de Firebase obtenido desde el frontend
- [ ] Headers correctos en la petición (Authorization, Content-Type)

---

## 🔐 Seguridad

### En Desarrollo:

- CORS está abierto (`*`) para facilitar testing
- Logs detallados habilitados

### En Producción (TODO):

- Cambiar CORS para aceptar solo dominios específicos
- Deshabilitar logs sensibles
- Usar PostgreSQL real (no mock)
- Habilitar HTTPS
- Configurar rate limiting

---

## 🚀 Próximos Pasos

1. **Instalar PostgreSQL:**

   ```bash
   npm install pg
   ```

2. **Crear tabla en PostgreSQL:**

   ```sql
   CREATE TABLE users (
     uid TEXT PRIMARY KEY,
     email TEXT NOT NULL UNIQUE,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

3. **Activar conexión real:**
   - Descomenta código en `src/db.js`
   - Configura `DATABASE_URL` en `.env`

4. **Añadir más endpoints:**
   - GET `/api/users/:uid` - Obtener usuario
   - PUT `/api/users/:uid` - Actualizar usuario
   - DELETE `/api/users/:uid` - Eliminar usuario

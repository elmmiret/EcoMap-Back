# 📋 Resumen de Endpoints

Vista rápida de todos los endpoints disponibles en la API de PESkaos.

---

## 🟢 Públicos (Sin autenticación)

Estos endpoints son de libre acceso sin necesidad de autenticación.

| Método | Endpoint                        | Descripción                                                 | Respuesta                                 |
| ------ | ------------------------------- | ----------------------------------------------------------- | ----------------------------------------- |
| `GET`  | `/`                             | Verificar estado del servidor                               | `"API running."`                          |
| `GET`  | `/api/recycling-points/:region` | Puntos de reciclaje por región (optimizado con cache SWR)  | `Object` con `success`, `message`, `data` |
| `GET`  | `/api/routes`                   | Calcular ruta entre coordenadas (ORS API)                   | `Object` con `success`, `message`, `data` |

📖 Ver detalles:

- [GET / - Health Check](endpoints/health-check.md)
- [GET /api/recycling-points/:region](endpoints/recycling-points-region.md)
- [GET /api/routes - Calcular Ruta](endpoints/routes-calculate.md)

---

## 🔐 Autenticación (Firebase Token)

Estos endpoints requieren el **token de Firebase** en el header `Authorization`.

| Método | Endpoint          | Descripción                                          | Devuelve                   |
| ------ | ----------------- | ---------------------------------------------------- | -------------------------- |
| `POST` | `/api/users/sync` | Sincronizar usuario con BD y obtener JWT del backend | JWT propio + datos usuario |

📖 [Ver detalles →](endpoints/users-sync.md)

---

## 🔒 Protegidos (Backend JWT)

Estos endpoints requieren el **JWT del backend** en el header `Authorization`.

### 👤 Nivel de Acceso: Todos los Usuarios Autenticados

Cualquier usuario autenticado (client, admin, institution) puede acceder.

#### Gestión de Usuario

| Método   | Endpoint              | Descripción                         | Rol Requerido |
| -------- | --------------------- | ----------------------------------- | ------------- |
| `POST`   | `/api/users/logout`   | Cierra la sesión del usuario actual | Todos         |
| `GET`    | `/api/users/me`       | Obtener perfil del usuario actual   | Todos         |
| `PUT`    | `/api/users/me`       | Actualizar perfil                   | Todos         |
| `PUT`    | `/api/users/language` | Actualizar idioma de la app         | Todos         |
| `DELETE` | `/api/users/me`       | Eliminar cuenta                     | Todos         |

📖 Ver detalles:

- [POST /api/users/logout](endpoints/logout.md)
- [GET /api/users/me](endpoints/users-me.md)
- [PUT /api/users/language](endpoints/users-language.md)
- [PUT /api/users/me](endpoints/users-update.md)
- [DELETE /api/users/me](endpoints/users-delete.md)

---

### 🔒 Nivel de Acceso: Solo Administradores

Requieren `"role": "admin"` en el JWT del backend.

#### Cache de Puntos de Reciclaje (Admin)

| Método | Endpoint                               | Descripción                                       | Rol Requerido |
| ------ | -------------------------------------- | ------------------------------------------------- | ------------- |
| `GET`  | `/api/recycling-points/:region/status` | Obtener estado del cache y metadatos              | Admin         |
| `POST` | `/api/recycling-points/:region/refresh`| Forzar sincronización inmediata del cache         | Admin         |

📖 Ver detalles:

- [GET /api/recycling-points/:region/status](endpoints/recycling-points-status.md)
- [POST /api/recycling-points/:region/refresh](endpoints/recycling-points-refresh.md)

---

### 🏢 Nivel de Acceso: Solo Instituciones

Requieren `"role": "institution"` en el JWT del backend.

> ⚠️ **Próximamente**: Endpoints específicos para instituciones.

---

### 🔐 Nivel de Acceso: Admin o Institución

Requieren `"role": "admin"` o `"role": "institution"` en el JWT del backend.

> ⚠️ **Próximamente**: Endpoints compartidos entre admin e instituciones (ej: estadísticas, reportes).

---

## 🎯 Roles de Usuario

| Rol           | Descripción               | Permisos                                                   |
| ------------- | ------------------------- | ---------------------------------------------------------- |
| `client`      | Usuario normal de la app  | Ver y actualizar su propio perfil, ver puntos de reciclaje |
| `admin`       | Administrador del sistema | Todos los permisos + gestión de cache y sincronizaciones  |
| `institution` | Institución/Organización  | Permisos especiales (por definir)                          |

---

## � Matriz de Permisos

| Endpoint                                    | 🟢 Público | 👤 Client | 🔒 Admin | 🏢 Institution |
| ------------------------------------------- | ---------- | --------- | -------- | -------------- |
| `GET /`                                     | ✅          | ✅         | ✅        | ✅              |
| `GET /api/recycling-points/:region`         | ✅          | ✅         | ✅        | ✅              |
| `GET /api/routes`                           | ✅          | ✅         | ✅        | ✅              |
| `POST /api/users/sync`                      | ✅          | ✅         | ✅        | ✅              |
| `POST /api/users/logout`                    | ❌          | ✅         | ✅        | ✅              |
| `GET /api/users/me`                         | ❌          | ✅         | ✅        | ✅              |
| `PUT /api/users/me`                         | ❌          | ✅         | ✅        | ✅              |
| `PUT /api/users/language`                   | ❌          | ✅         | ✅        | ✅              |
| `DELETE /api/users/me`                      | ❌          | ✅         | ✅        | ✅              |
| `GET /api/recycling-points/:region/status`  | ❌          | ❌         | ✅        | ❌              |
| `POST /api/recycling-points/:region/refresh`| ❌          | ❌         | ✅        | ❌              |

---

## 📝 Formato de URLs

```
/api/users/:id
        ↑
    Parámetro obligatorio
```

**Ejemplo:**

```
GET /api/users/abc123
```

### Query Parameters

```
/api/recycling-points?lat=41.3851&lng=2.1734&radius=5
                      ↑
                  Query params opcionales
```

**Ejemplo:**

```
GET /api/recycling-points?lat=41.3851&lng=2.1734&radius=5
```

---

## 🔄 Respuestas Comunes

### Éxito (200/201)

```json
{
  "success": true,
  "message": "Operación exitosa",
  "data": { ... }
}
```

### Error (4xx/5xx)

```json
{
  "success": false,
  "message": "Descripción del error",
  "code": "ERROR_CODE"
}
```

---

## 🚀 Próximos Endpoints

Los siguientes endpoints están en desarrollo:

- 💬 **Mensajería**: Chat entre usuarios
- 🏆 **Recompensas**: Sistema de puntos y premios
- 📊 **Estadísticas**: Dashboard de reciclaje
- 🔔 **Notificaciones**: Gestión de notificaciones push

---

**Anterior**: [← Configuración General](01-configuracion-general.md)  
**Siguiente**: [Ver endpoint específico →](endpoints/)

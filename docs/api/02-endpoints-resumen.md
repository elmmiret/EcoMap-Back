# 📋 Resumen de Endpoints

Vista rápida de todos los endpoints disponibles en la API de PESkaos.

---

## 🟢 Públicos (Sin autenticación)

| Método | Endpoint                | Descripción                            | Respuesta        |
| ------ | ----------------------- | -------------------------------------- | ---------------- |
| `GET`  | `/`                     | Verificar estado del servidor          | `"API running."` |
| `GET`  | `/api/barcelona/points` | Puntos de reciclaje (Barcelona - CKAN) | `Array<object>`  |
| `GET`  | `/api/navarra/points`   | Puntos de reciclaje (Navarra - CKAN)   | `Array<object>`  |

📖 Ver detalles:

- [GET / - Health Check](endpoints/health-check.md)
- [GET /api/barcelona/points](endpoints/barcelona-points.md)
- [GET /api/navarra/points](endpoints/navarra-points.md)

---

## 🔐 Autenticación (Firebase Token)

Estos endpoints requieren el token de Firebase en el header `Authorization`.

| Método | Endpoint          | Descripción                                          | Devuelve                   |
| ------ | ----------------- | ---------------------------------------------------- | -------------------------- |
| `POST` | `/api/users/sync` | Sincronizar usuario con BD y obtener JWT del backend | JWT propio + datos usuario |

📖 [Ver detalles →](endpoints/users-sync.md)

---

## 🔒 Protegidos (Backend JWT)

Estos endpoints requieren el JWT del backend en el header `Authorization`.

> ⚠️ **Próximamente**: Más endpoints se añadirán aquí.

### 👥 Usuarios

| Método   | Endpoint            | Descripción                         | Rol Requerido |
| -------- | ------------------- | ----------------------------------- | ------------- |
| `POST`   | `/api/users/logout` | Cierra la sesión del usuario actual | Todos         |
| `GET`    | `/api/users/me`     | Obtener perfil del usuario actual   | Todos         |
| `PUT`    | `/api/users/me`     | Actualizar perfil                   | Todos         |
| `DELETE` | `/api/users/me`     | Eliminar cuenta                     | Todos         |

### ♻️ Puntos de Reciclaje

| Método   | Endpoint                    | Descripción                  | Rol Requerido |
| -------- | --------------------------- | ---------------------------- | ------------- |
| `GET`    | `/api/recycling-points`     | Listar puntos de reciclaje   | Todos         |
| `GET`    | `/api/recycling-points/:id` | Obtener detalles de un punto | Todos         |
| `POST`   | `/api/recycling-points`     | Crear punto de reciclaje     | Admin         |
| `PUT`    | `/api/recycling-points/:id` | Actualizar punto             | Admin         |
| `DELETE` | `/api/recycling-points/:id` | Eliminar punto               | Admin         |

### 🗑️ Contenedores

| Método | Endpoint              | Descripción                    | Rol Requerido |
| ------ | --------------------- | ------------------------------ | ------------- |
| `GET`  | `/api/containers`     | Listar contenedores            | Todos         |
| `GET`  | `/api/containers/:id` | Obtener detalles de contenedor | Todos         |
| `POST` | `/api/containers`     | Crear contenedor               | Admin         |
| `PUT`  | `/api/containers/:id` | Actualizar contenedor          | Admin         |

### 🕒 Horarios

| Método | Endpoint              | Descripción                | Rol Requerido |
| ------ | --------------------- | -------------------------- | ------------- |
| `GET`  | `/api/timetables`     | Listar horarios            | Todos         |
| `GET`  | `/api/timetables/:id` | Obtener horario específico | Todos         |
| `POST` | `/api/timetables`     | Crear horario              | Admin         |

---

## 🎯 Roles de Usuario

| Rol           | Descripción               | Permisos                                                   |
| ------------- | ------------------------- | ---------------------------------------------------------- |
| `client`      | Usuario normal de la app  | Ver y actualizar su propio perfil, ver puntos de reciclaje |
| `admin`       | Administrador del sistema | Gestionar puntos de reciclaje, contenedores, horarios      |
| `institution` | Institución/Organización  | Permisos especiales por definir                            |

---

## 📝 Formato de URLs

### Parámetros de Ruta

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

# GET /api/recycling-points/:region/status - Estado del Cache de Puntos

Obtiene el estado y metadatos del sistema de cache para una región específica. Este endpoint es útil para **monitoreo, debugging y paneles de administración**.

---

## 📋 Información General

|                   |                                            |
| ----------------- | ------------------------------------------ |
| **Método**        | `GET`                                      |
| **URL**           | `/api/recycling-points/:region/status`     |
| **Autenticación** | ✅ Requerida (Backend JWT)                 |
| **Rol requerido** | 🔒 **Admin**                               |
| **Cache**         | ❌ No aplica (lee metadata en tiempo real) |

---

## 🔐 Restricciones de Acceso

Este endpoint está **protegido y solo accesible para administradores**:

- ✅ **Admins**: Acceso completo
- ❌ **Clientes**: Acceso denegado (403 Forbidden)
- ❌ **Instituciones**: Acceso denegado (403 Forbidden)
- ❌ **No autenticados**: Acceso denegado (401 Unauthorized)

---

## 📤 Request

### URL Parameters

| Parámetro | Tipo   | Requerido | Descripción                                  |
| --------- | ------ | --------- | -------------------------------------------- |
| `region`  | string | ✅         | Región de la que consultar estado (`navarra`) |

### Headers

```
Authorization: Bearer <BACKEND_JWT>
Content-Type: application/json
```

**Importante**: El JWT debe contener `"role": "admin"` en su payload.

---

## 📥 Response

### ✅ Éxito (200 OK)

Información completa del estado del cache:

```json
{
  "success": true,
  "region": "navarra",
  "apiLocation": "Navarra",
  "source": "NAVARRA_POINTS",
  "status": "READY",
  "last_sync": "2025-10-28T10:00:00.000Z",
  "next_sync": "2025-10-28T11:00:00.000Z",
  "total_records": 1750,
  "is_stale": false,
  "minutes_since_sync": 15,
  "error_message": null
}
```

### Campos de Respuesta

| Campo                | Tipo     | Descripción                                                  |
| -------------------- | -------- | ------------------------------------------------------------ |
| `success`            | boolean  | Indica si la petición fue exitosa                            |
| `region`             | string   | Región consultada (como se pasó en la URL)                   |
| `apiLocation`        | string   | Nombre de la ubicación en la base de datos                   |
| `source`             | string   | Identificador del cache source                               |
| `status`             | string   | Estado actual: `READY`, `SYNCING`, `ERROR`                   |
| `last_sync`          | datetime | Última sincronización exitosa (null si nunca se sincronizó) |
| `next_sync`          | datetime | Próxima sincronización programada                            |
| `total_records`      | integer  | Cantidad de puntos activos en cache                          |
| `is_stale`           | boolean  | Si los datos están obsoletos (excedió TTL)                   |
| `minutes_since_sync` | integer  | Minutos desde última sincronización (null si nunca)          |
| `error_message`      | string   | Mensaje de error de última sincronización (null si OK)       |

### Estados del Cache

| Estado     | Descripción                                             |
| ---------- | ------------------------------------------------------- |
| `READY`    | Cache actualizado y listo para servir peticiones        |
| `SYNCING`  | Sincronización en progreso (puede tardar 20-30s)       |
| `ERROR`    | Última sincronización falló (ver `error_message`)      |

---

### ❌ Error - No autenticado (401 Unauthorized)

```json
{
  "success": false,
  "message": "No authentication token provided",
  "code": "NO_TOKEN"
}
```

### ❌ Error - No es admin (403 Forbidden)

```json
{
  "success": false,
  "message": "Admin privileges required",
  "code": "FORBIDDEN"
}
```

### ❌ Error - Región no encontrada (404 Not Found)

```json
{
  "success": false,
  "message": "Región no encontrada: madrid",
  "code": "REGION_NOT_FOUND"
}
```

### ❌ Error - Error del servidor (500 Internal Server Error)

```json
{
  "success": false,
  "message": "Error al consultar el estado del cache",
  "code": "CACHE_STATUS_ERROR"
}
```

---

## 💡 Ejemplos de Uso

### cURL

```bash
# Obtener estado del cache de Navarra
curl -X GET http://localhost:3001/api/recycling-points/navarra/status \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json"
```

### Dart/Flutter (Panel de Admin)

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<CacheStatus> getCacheStatus(String region, String adminJWT) async {
  final uri = Uri.parse('http://localhost:3001/api/recycling-points/$region/status');
  
  final response = await http.get(
    uri,
    headers: {
      'Authorization': 'Bearer $adminJWT',
      'Content-Type': 'application/json',
    },
  );

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return CacheStatus.fromJson(data);
  } else if (response.statusCode == 403) {
    throw Exception('Requiere privilegios de administrador');
  } else if (response.statusCode == 404) {
    throw Exception('Región no encontrada');
  }
  
  throw Exception('Error al consultar estado del cache');
}

// Modelo
class CacheStatus {
  final String region;
  final String status;
  final DateTime? lastSync;
  final DateTime? nextSync;
  final int totalRecords;
  final bool isStale;
  final int? minutesSinceSync;
  final String? errorMessage;

  CacheStatus.fromJson(Map<String, dynamic> json)
      : region = json['region'],
        status = json['status'],
        lastSync = json['last_sync'] != null 
            ? DateTime.parse(json['last_sync']) 
            : null,
        nextSync = json['next_sync'] != null 
            ? DateTime.parse(json['next_sync']) 
            : null,
        totalRecords = json['total_records'],
        isStale = json['is_stale'],
        minutesSinceSync = json['minutes_since_sync'],
        errorMessage = json['error_message'];
}
```

### JavaScript/TypeScript (Dashboard Admin)

```typescript
interface CacheStatus {
  success: boolean;
  region: string;
  apiLocation: string;
  source: string;
  status: 'READY' | 'SYNCING' | 'ERROR';
  last_sync: string | null;
  next_sync: string | null;
  total_records: number;
  is_stale: boolean;
  minutes_since_sync: number | null;
  error_message: string | null;
}

async function getCacheStatus(region: string, adminJWT: string): Promise<CacheStatus> {
  const response = await fetch(`http://localhost:3001/api/recycling-points/${region}/status`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminJWT}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Requiere privilegios de administrador');
    }
    throw new Error('Error al consultar estado del cache');
  }

  return await response.json();
}

// Uso en un dashboard
const status = await getCacheStatus('navarra', adminToken);
console.log(`Cache ${status.region}: ${status.status}`);
console.log(`Registros: ${status.total_records}`);
console.log(`Última sync: ${status.minutes_since_sync} minutos atrás`);
if (status.is_stale) {
  console.warn('⚠️ Cache obsoleto, se actualizará pronto');
}
```

---

## 🎯 Casos de Uso

### 1. Dashboard de Monitoreo

Crear un panel de administración que muestre:
- Estado de todas las regiones
- Tiempo desde última sincronización
- Alertas si hay errores
- Gráficos de cantidad de puntos por región

### 2. Health Checks Automatizados

Configurar monitoreo automático (ej: cada 5 minutos) para:
- Verificar que `status === 'READY'`
- Alertar si `error_message !== null`
- Notificar si `is_stale === true` por más de 2 horas

### 3. Debugging en Desarrollo

Durante desarrollo, verificar:
- Si el cron está funcionando (`next_sync` se actualiza)
- Si las sincronizaciones son exitosas
- Cuántos registros se obtienen de cada API

---

## 📊 Interpretación de Estados

### ✅ Estado Óptimo

```json
{
  "status": "READY",
  "is_stale": false,
  "error_message": null,
  "total_records": 1750,
  "minutes_since_sync": 15
}
```

**Interpretación**: Cache funcionando correctamente, datos frescos, última sincronización hace 15 minutos.

### ⚠️ Cache Obsoleto pero Funcionando

```json
{
  "status": "READY",
  "is_stale": true,
  "error_message": null,
  "total_records": 1750,
  "minutes_since_sync": 95
}
```

**Interpretación**: Datos obsoletos (>90min) pero el servicio funciona. Una actualización en segundo plano se disparará en la próxima petición.

### 🔄 Sincronización en Progreso

```json
{
  "status": "SYNCING",
  "is_stale": true,
  "error_message": null,
  "total_records": 1750,
  "minutes_since_sync": 62
}
```

**Interpretación**: El cron o un refresh manual está ejecutándose. Esperar 20-30s y revisar nuevamente.

### ❌ Error de Sincronización

```json
{
  "status": "ERROR",
  "is_stale": true,
  "error_message": "Failed to fetch Navarra points: ETIMEDOUT",
  "total_records": 1750,
  "minutes_since_sync": 125
}
```

**Interpretación**: La última sincronización falló. Los datos en cache siguen disponibles pero obsoletos. Verificar conectividad con la API externa.

---

## 🔔 Alertas Recomendadas

Configure alertas en su sistema de monitoreo si:

| Condición                     | Severidad | Acción                                              |
| ----------------------------- | --------- | --------------------------------------------------- |
| `status === 'ERROR'`          | 🔴 Alta   | Verificar logs, revisar conectividad a API externa  |
| `is_stale === true` >2 horas  | 🟡 Media  | Verificar que el cron esté ejecutándose             |
| `total_records === 0`         | 🔴 Alta   | Cache vacío, verificar si hubo migración/reset      |
| `status === 'SYNCING'` >5 min | 🟡 Media  | Posible timeout, revisar Worker de Cloudflare       |

---

## 📝 Notas Importantes

1. **Solo Admin**: Este endpoint expone metadatos internos del sistema que no deben ser públicos.

2. **No afecta al cache**: Consultar el status no dispara sincronizaciones ni modifica el estado.

3. **Tiempo Real**: Los datos devueltos son en tiempo real desde la tabla `cache_metadata`.

4. **Todas las regiones**: Puedes consultar el estado de cualquier región configurada en `recycling-sources.config.js`.

5. **Próxima sincronización**: El campo `next_sync` es estimado basado en el `syncInterval` configurado.

---

## 🐛 Troubleshooting

### 403 Forbidden aunque tengo JWT

- Verifica que el JWT contenga `"role": "admin"`
- Decodifica el JWT para confirmar el payload
- Asegúrate de estar usando el Backend JWT, no el Firebase token

### `null` en last_sync

- Normal en el primer arranque antes de la primera sincronización
- Ejecuta `POST /refresh` para forzar una sincronización inicial

### `is_stale` siempre `true`

- Verifica que el cron job esté ejecutándose (revisar logs del servidor)
- Comprueba que `CRON_TZ` esté configurado correctamente
- Revisa variables de entorno `NAVARRA_SYNC_CRON`

---

**Ver también**:
- [POST /api/recycling-points/:region/refresh →](recycling-points-refresh.md)
- [GET /api/recycling-points/:region →](recycling-points-region.md)

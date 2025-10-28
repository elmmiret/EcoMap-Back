# GET /api/recycling-points/:region - Obtener Puntos de Reciclaje por Región

Obtiene los puntos de reciclaje de una región específica desde el sistema de caché (Stale-While-Revalidate). Este endpoint está optimizado para ofrecer respuestas rápidas (<100ms) sirviendo datos en caché y actualizando en segundo plano cuando sea necesario.

---

## 📋 Información General

|                   |                                            |
| ----------------- | ------------------------------------------ |
| **Método**        | `GET`                                      |
| **URL**           | `/api/recycling-points/:region`            |
| **Autenticación** | ❌ No requerida (público)                  |
| **Rol requerido** | Ninguno                                    |
| **Cache**         | ✅ SWR (Stale-While-Revalidate)            |

---

## 📤 Request

### URL Parameters

| Parámetro | Tipo   | Requerido | Descripción                                      |
| --------- | ------ | --------- | ------------------------------------------------ |
| `region`  | string | ✅         | Región de la que obtener puntos (`navarra`, etc.) |

### Headers

```
Content-Type: application/json
```

**Nota**: No requiere autenticación. Es un endpoint público accesible para todos los usuarios.

---

## 📥 Response

### ✅ Éxito (200 OK)

Cuando los datos están disponibles en caché (caso normal):

```json
{
  "success": true,
  "message": "Puntos de reciclaje encontrados en Navarra",
  "data": [
    {
      "recycling_point_id": "550e8400-e29b-41d4-a716-446655440000",
      "api_id": "12345",
      "name": "Punto de Reciclaje Plaza Mayor",
      "latitude": 42.8169,
      "longitude": -1.6432,
      "equipment_type": "Vidrio",
      "schedule": "24/7",
      "last_updated": "2025-10-28T10:30:00.000Z"
    },
    {
      "recycling_point_id": "550e8400-e29b-41d4-a716-446655440001",
      "api_id": "12346",
      "name": "Contenedor Calle Mayor 15",
      "latitude": 42.8170,
      "longitude": -1.6430,
      "equipment_type": "Pilas",
      "schedule": "Lunes a Viernes: 9:00-20:00",
      "last_updated": "2025-10-28T10:30:00.000Z"
    }
  ]
}
```

### ❌ Error - Región no soportada (404 Not Found)

```json
{
  "success": false,
  "message": "Región no encontrada: madrid",
  "code": "REGION_NOT_FOUND"
}
```

### ❌ Error - Cache vacía y sincronización falló (503 Service Unavailable)

Ocurre en el primer arranque del sistema o si la sincronización inicial falla:

```json
{
  "success": false,
  "message": "Cache vacía y sincronización inicial falló. Intente más tarde.",
  "code": "SERVICE_UNAVAILABLE"
}
```

### ❌ Error - Error interno (500 Internal Server Error)

```json
{
  "success": false,
  "message": "Error al consultar los puntos de reciclaje",
  "code": "RECYCLING_POINTS_ERROR"
}
```

---

## 🔄 Comportamiento del Cache (SWR)

Este endpoint utiliza la estrategia **Stale-While-Revalidate**:

1. **Respuesta Inmediata**: Devuelve datos en caché inmediatamente (incluso si están obsoletos)
2. **Actualización en Segundo Plano**: Si los datos están obsoletos (stale), dispara una actualización en segundo plano sin bloquear la respuesta
3. **Cold Start**: Si no hay cache (primera vez), realiza una sincronización bloqueante antes de responder

### Política de Cache por Región

| Región   | TTL (Stale) | Sync Interval | Cron          |
| -------- | ----------- | ------------- | ------------- |
| Navarra  | 90 minutos  | 60 minutos    | `0 * * * *`   |
| Barcelona | 120 minutos | 90 minutos    | `5 * * * *`   |

**TTL (Time To Live)**: Tiempo después del cual los datos se consideran obsoletos (stale).  
**Sync Interval**: Frecuencia de sincronización automática en segundo plano.

---

## 📊 Estructura de Datos de Puntos

### Campos devueltos

| Campo                 | Tipo     | Descripción                                      |
| --------------------- | -------- | ------------------------------------------------ |
| `recycling_point_id`  | UUID     | ID interno del punto en nuestra base de datos    |
| `api_id`              | string   | ID del punto en la API externa                   |
| `name`                | string   | Nombre o ubicación del punto                     |
| `latitude`            | float    | Coordenada latitud (WGS84)                       |
| `longitude`           | float    | Coordenada longitud (WGS84)                      |
| `equipment_type`      | string   | Tipo de residuo (Vidrio, Pilas, Orgánico, etc.) |
| `schedule`            | string   | Horario de apertura/disponibilidad               |
| `last_updated`        | datetime | Última actualización del punto                   |

**Nota**: El campo `raw_payload` (JSON completo de la API) no se devuelve por defecto para reducir el tamaño de la respuesta.

---

## 💡 Ejemplos de Uso

### cURL

```bash
# Obtener puntos de Navarra
curl -X GET http://localhost:3001/api/recycling-points/navarra \
  -H "Content-Type: application/json"

# Obtener puntos de Barcelona (cuando esté disponible)
curl -X GET http://localhost:3001/api/recycling-points/barcelona \
  -H "Content-Type: application/json"
```

### Dart/Flutter

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<List<RecyclingPoint>> getRecyclingPoints(String region) async {
  final uri = Uri.parse('http://localhost:3001/api/recycling-points/$region');
  
  final response = await http.get(
    uri,
    headers: {'Content-Type': 'application/json'},
  );

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    if (data['success'] == true) {
      return (data['data'] as List)
          .map((json) => RecyclingPoint.fromJson(json))
          .toList();
    }
  } else if (response.statusCode == 404) {
    throw Exception('Región no soportada');
  } else if (response.statusCode == 503) {
    throw Exception('Servicio temporalmente no disponible');
  }
  
  throw Exception('Error al obtener puntos de reciclaje');
}
```

### JavaScript/TypeScript

```javascript
async function getRecyclingPoints(region) {
  try {
    const response = await fetch(`http://localhost:3001/api/recycling-points/${region}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Región no soportada: ${region}`);
      }
      throw new Error(data.message || 'Error al obtener puntos');
    }

    return data.data; // Array de puntos
  } catch (error) {
    console.error('Error fetching recycling points:', error);
    throw error;
  }
}

// Uso
const navarraPoints = await getRecyclingPoints('navarra');
console.log(`Encontrados ${navarraPoints.length} puntos en Navarra`);
```

---

## 🔍 Regiones Soportadas

| Región      | Estado      | Puntos Aprox. | Última Actualización API |
| ----------- | ----------- | ------------- | ------------------------ |
| `navarra`   | ✅ Activo   | ~1750         | Cada hora                |
| `barcelona` | 🚧 Próximo  | ~5000         | Pendiente                |

---

## 📝 Notas Importantes

1. **Público y sin límite de tasa**: Este endpoint no requiere autenticación y no tiene rate limiting. Es seguro para uso desde apps móviles.

2. **Datos siempre disponibles**: Gracias al cache, este endpoint garantiza respuestas rápidas incluso si la API externa está caída.

3. **Actualización automática**: El sistema actualiza los datos automáticamente mediante cron jobs sin intervención manual.

4. **Filtrado de puntos inactivos**: Solo se devuelven puntos marcados como `active = true` en la base de datos.

5. **Performance**: Respuestas típicas en <100ms gracias al cache en PostgreSQL.

6. **Cold Start**: En el primer arranque o tras limpiar cache, la primera petición puede tardar 20-30s mientras sincroniza.

---

## 🐛 Troubleshooting

### "Región no encontrada"
- Verifica que la región esté en minúsculas (`navarra`, no `Navarra`)
- Consulta la lista de regiones soportadas arriba

### "Service Unavailable" (503)
- Ocurre solo en cold start si la API externa no responde
- Reintenta en 1-2 minutos
- Contacta al administrador si persiste

### Datos obsoletos
- Los datos se actualizan automáticamente cada hora
- Si necesitas forzar una actualización, contacta al administrador para que ejecute `POST /api/recycling-points/:region/refresh` (requiere privilegios admin)

---

**Siguiente**: [GET /api/recycling-points/:region/status →](recycling-points-status.md)

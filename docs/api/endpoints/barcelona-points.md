# GET /api/barcelona/points - Puntos de Reciclaje (Barcelona)

Devuelve el listado completo de puntos de reciclaje publicados por el Ajuntament de Barcelona (fuente: CKAN Open Data). La respuesta es un array de objetos tal cual es devuelto por el dataset oficial.

---

## 📋 Información General

|                   |                         |
| ----------------- | ----------------------- |
| **Método**        | `GET`                   |
| **URL**           | `/api/barcelona/points` |
| **Autenticación** | ❌ No requerida         |
| **Rol requerido** | Ninguno                 |

---

## 📤 Request

### Headers

No se requieren headers especiales.

### Query Params

No hay filtros ni paginación en este endpoint (por ahora). El backend ya pagina internamente contra CKAN para devolver todos los registros.

---

## 📥 Response

### Respuesta Exitosa (200 OK)

- Tipo: `application/json`
- Cuerpo: `Array<object>` (registros crudos del dataset CKAN)

Ejemplo simplificado de un elemento (los campos exactos dependen del dataset):

```json
[
  {
    "id": "12345",
    "name": "Punto Verde de Barrio",
    "address": "C/ Exemple 123, Barcelona",
    "lat": 41.387,
    "lon": 2.17,
    "materials": ["vidrio", "papel", "plástico"],
    "...": "otros campos específicos del dataset"
  }
]
```

### Respuesta de Error (500)

```json
{ "error": "Mensaje de error" }
```

> Nota: Si ocurre un error al consultar CKAN, el backend devolverá 500 con el mensaje asociado.

---

## 💻 Ejemplos de Código

### cURL

```bash
curl -X GET http://localhost:3001/api/barcelona/points
```

### JavaScript/TypeScript (fetch)

```javascript
async function getBarcelonaPoints() {
  const res = await fetch('http://localhost:3001/api/barcelona/points');
  if (!res.ok) throw new Error('Error al obtener puntos');
  const records = await res.json(); // Array de objetos crudos CKAN

  // Ejemplo: mapear a un modelo propio con fallback de nombres de campos
  return records.map((r) => ({
    id: r.id || r._id || null,
    name: r.name || r.nom || r.titol || 'Sin nombre',
    address: r.address || r.adreca || r.direccio || null,
    lat: r.lat || r.latitude || r.latitud || null,
    lon: r.lon || r.lng || r.longitude || r.longitud || null,
    materials: r.materials || r.fracciones || r.fractions || [],
  }));
}
```

### Dart/Flutter (http)

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<List<Map<String, dynamic>>> getBarcelonaPoints() async {
  final uri = Uri.parse('http://localhost:3001/api/barcelona/points');
  final res = await http.get(uri);

  if (res.statusCode != 200) {
    final err = jsonDecode(res.body);
    throw Exception(err['error'] ?? 'Error al obtener puntos');
  }

  final List<dynamic> data = jsonDecode(res.body);
  return data.cast<Map<String, dynamic>>();
}
```

---

## 📝 Notas

- El backend usa la variable de entorno `BARCELONA_RESOURCE_ID` para apuntar al dataset CKAN; la forma de los campos puede cambiar si el dataset cambia.
- Este endpoint puede devolver muchos registros (se descargan en bloques de 1000); evita consultarlo muy frecuentemente desde el frontend.
- En futuras iteraciones se añadirán filtros (lat/lon/radio) y paginación a nivel de API propia.

---

**Anterior**: [← Resumen de Endpoints](../02-endpoints-resumen.md)

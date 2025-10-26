# GET /api/recycling-points/navarra - Puntos de Reciclaje (Navarra)

Devuelve el listado de puntos de reciclaje publicados por el Gobierno de Navarra (fuente: CKAN Open Data). La respuesta es un array de objetos tal cual es devuelto por el dataset oficial. Soporta búsqueda por texto y filtros por campos específicos.

---

## 📋 Información General

|                   |                                 |
| ----------------- | ------------------------------- |
| **Método**        | `GET`                           |
| **URL**           | `/api/recycling-points/navarra` |
| **Autenticación** | ❌ No requerida                 |
| **Rol requerido** | Ninguno                         |

---

## 📤 Request

### Headers

No se requieren headers especiales.

### Query Params

Todos los parámetros son opcionales. El backend pagina internamente contra CKAN para devolver los registros que coincidan con los filtros.

| Parámetro   | Tipo     | Descripción                                                                            | Ejemplo                       |
| ----------- | -------- | -------------------------------------------------------------------------------------- | ----------------------------- |
| `q`         | `string` | Búsqueda de texto completo (full-text search) en todos los campos del dataset          | `?q=vidrio`                   |
| `<campo>`   | `string` | Filtro por campo específico del dataset (ej: `MUNICIPIO`, `NOMBRE`, `DIRECCION`, etc.) | `?MUNICIPIO=Pamplona`         |
| (combinado) | -        | Puedes combinar `q` con múltiples filtros de campos                                    | `?q=punto&MUNICIPIO=Pamplona` |

**Ejemplos de campos comunes del dataset de Navarra** (pueden variar según la fuente CKAN):

- `TipoEquipamiento` - Tipo de punto de reciclaje (ej: "Pilas", "Aceite", "Punto Limpio")
- `Localidad` - Nombre de la localidad/municipio
- `Mancomunidad` - Mancomunidad a la que pertenece
- `Direccion` - Dirección del punto
- `Horario` - Horario de apertura
- `x` - Latitud (coordenada geográfica)
- `y` - Longitud (coordenada geográfica)
- `ID Equipamiento` - Identificador único del equipamiento
- `Comentarios` - Información adicional

Consulta la documentación del dataset CKAN de Navarra para conocer todos los campos disponibles.

---

## 📥 Response

### Respuesta Exitosa (200 OK)

- Tipo: `application/json`
- Estructura:

```json
{
  "success": true,
  "message": "Puntos de reciclaje encontrados en Navarra",
  "data": [
    {
      "_id": 1,
      "ID Tipo Equipamiento": "10",
      "ID Equipamiento": "55",
      "TipoEquipamiento": "Pilas",
      "x": "42.903482",
      "y": "-1.208888",
      "Mancomunidad": "Mancomunidad de Bidausi",
      "Localidad": "ABAURREGAINA / ABAURREA ALTA (Abaurregaina / Abaurrea Alta)",
      "Direccion": "Zaguán colegio publico",
      "Horario": "09:00 - 14:00",
      "Comentarios": "-",
      "Fecha ultima actualizacion": "26/10/2022 10:00:46",
      "¿Despues que?": "https://www.youtube.com/watch?v=6I3inG6NI30"
    }
  ]
}
```

> **Nota**: El array `data` puede estar vacío si no hay resultados que coincidan con los filtros. Algunos campos pueden tener valores por defecto como `"-"` cuando no hay información disponible.

### Respuesta de Error (404)

Si se especifica una región no válida:

```json
{
  "success": false,
  "message": "Región no encontrada: <region>",
  "code": "REGION_NOT_FOUND"
}
```

### Respuesta de Error (500)

```json
{
  "success": false,
  "message": "Error al consultar los puntos de reciclaje",
  "code": "RECYCLING_POINTS_ERROR"
}
```

---

## 💻 Ejemplos de Código

### cURL

```bash
# Sin filtros (todos los puntos)
curl -X GET http://localhost:3001/api/recycling-points/navarra

# Búsqueda por texto
curl -X GET "http://localhost:3001/api/recycling-points/navarra?q=pilas"

# Filtro por tipo de equipamiento
curl -X GET "http://localhost:3001/api/recycling-points/navarra?TipoEquipamiento=Pilas"

# Filtro por localidad
curl -X GET "http://localhost:3001/api/recycling-points/navarra?Localidad=PAMPLONA"

# Combinación de búsqueda y filtros
curl -X GET "http://localhost:3001/api/recycling-points/navarra?q=punto&Localidad=PAMPLONA"
```

### JavaScript/TypeScript (fetch)

```javascript
async function getNavarraPoints(searchText = null, filters = {}) {
  // Construir query params
  const params = new URLSearchParams();

  if (searchText) {
    params.append('q', searchText);
  }

  // Añadir filtros adicionales (ej: { Localidad: 'PAMPLONA', TipoEquipamiento: 'Pilas' })
  Object.entries(filters).forEach(([key, value]) => {
    params.append(key, value);
  });

  const queryString = params.toString();
  const url = `http://localhost:3001/api/recycling-points/navarra${queryString ? '?' + queryString : ''}`;

  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Error al obtener puntos');
  }

  const response = await res.json();
  return response.data; // Array de puntos
}

// Ejemplos de uso:
// const allPoints = await getNavarraPoints();
// const batteriesPoints = await getNavarraPoints('pilas');
// const pamplonaPoints = await getNavarraPoints(null, { Localidad: 'PAMPLONA' });
// const filtered = await getNavarraPoints('punto', { Localidad: 'PAMPLONA' });
```

### Dart/Flutter (http)

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<List<Map<String, dynamic>>> getNavarraPoints({
  String? searchText,
  Map<String, String>? filters,
}) async {
  final queryParams = <String, String>{};

  if (searchText != null && searchText.isNotEmpty) {
    queryParams['q'] = searchText;
  }

  if (filters != null) {
    queryParams.addAll(filters);
  }

  final uri = Uri.parse('http://localhost:3001/api/recycling-points/navarra')
      .replace(queryParameters: queryParams.isEmpty ? null : queryParams);

  final res = await http.get(uri);

  if (res.statusCode != 200) {
    final err = jsonDecode(res.body);
    throw Exception(err['message'] ?? 'Error al obtener puntos');
  }

  final Map<String, dynamic> response = jsonDecode(res.body);
  final List<dynamic> data = response['data'];
  return data.cast<Map<String, dynamic>>();
}

// Ejemplos de uso:
// final allPoints = await getNavarraPoints();
// final batteriesPoints = await getNavarraPoints(searchText: 'pilas');
// final pamplonaPoints = await getNavarraPoints(filters: {'Localidad': 'PAMPLONA'});
// final filtered = await getNavarraPoints(
//   searchText: 'punto',
//   filters: {'Localidad': 'PAMPLONA'},
// );
```

---

## 📝 Notas

- El backend usa la variable de entorno `NAVARRA_RESOURCE_ID` para apuntar al dataset CKAN; la forma de los campos puede cambiar si el dataset cambia.
- La paginación se hace automáticamente en el backend (descarga en bloques de 1000 registros de CKAN hasta obtener todos los que coincidan con los filtros).
- **Búsqueda por texto (`q`)**: Busca en todos los campos del dataset (full-text search de CKAN).
- **Filtros por campo**: Puedes filtrar por cualquier campo del dataset CKAN usando su nombre exacto como query param.
- Los filtros se combinan con lógica AND (deben cumplirse todos).

### Campos principales del dataset de Navarra

**Identificación:**

- `_id` - ID único del registro
- `ID Equipamiento` - Identificador del equipamiento
- `ID Tipo Equipamiento` - Identificador del tipo

**Tipo y Categoría:**

- `TipoEquipamiento` - Tipo de punto (ej: "Pilas", "Aceite", "Punto Limpio", "Vidrio")

**Ubicación:**

- `Localidad` - Nombre de la localidad/municipio
- `Mancomunidad` - Mancomunidad a la que pertenece
- `Direccion` - Dirección física del punto

**Geolocalización:**

- `x` - Latitud (coordenada geográfica)
- `y` - Longitud (coordenada geográfica)

**Información operativa:**

- `Horario` - Horario de apertura (cuando está disponible)
- `Comentarios` - Información adicional o notas

**Metadatos:**

- `Fecha ultima actualizacion` - Última fecha de actualización del registro
- `¿Despues que?` - Enlace a recursos adicionales (cuando está disponible)

---

**Anterior**: [← Resumen de Endpoints](../02-endpoints-resumen.md)

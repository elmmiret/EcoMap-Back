# GET /api/recycling-points/barcelona - Puntos de Reciclaje (Barcelona)

Devuelve el listado de puntos de reciclaje publicados por el Ajuntament de Barcelona (fuente: CKAN Open Data). La respuesta es un array de objetos tal cual es devuelto por el dataset oficial. Soporta búsqueda por texto y filtros por campos específicos.

---

## 📋 Información General

|                   |                                   |
| ----------------- | --------------------------------- |
| **Método**        | `GET`                             |
| **URL**           | `/api/recycling-points/barcelona` |
| **Autenticación** | ❌ No requerida                   |
| **Rol requerido** | Ninguno                           |

---

## 📤 Request

### Headers

No se requieren headers especiales.

### Query Params

Todos los parámetros son opcionales. El backend pagina internamente contra CKAN para devolver los registros que coincidan con los filtros.

| Parámetro   | Tipo     | Descripción                                                                            | Ejemplo                |
| ----------- | -------- | -------------------------------------------------------------------------------------- | ---------------------- |
| `q`         | `string` | Búsqueda de texto completo (full-text search) en todos los campos del dataset          | `?q=vidrio`            |
| `<campo>`   | `string` | Filtro por campo específico del dataset (ej: `BARRI`, `DISTRICTE`, `NOM_CARRER`, etc.) | `?BARRI=Gràcia`        |
| (combinado) | -        | Puedes combinar `q` con múltiples filtros de campos                                    | `?q=punt&BARRI=Gràcia` |

**Ejemplos de campos comunes del dataset de Barcelona** (pueden variar según la fuente CKAN):

- `name` - Nombre del punto de reciclaje
- `addresses_district_name` - Nombre del distrito (ej: "Sant Andreu", "Gràcia")
- `addresses_neighborhood_name` - Nombre del barrio (ej: "el Bon Pastor")
- `addresses_road_name` - Nombre de la calle (ej: "Carrer de Caracas")
- `addresses_town` - Municipio (normalmente "Barcelona")
- `addresses_zip_code` - Código postal
- `secondary_filters_name` - Tipo de punto (ej: "Punts verds de zona")
- `geo_epgs_4326_lat` - Latitud en formato WGS84
- `geo_epgs_4326_lon` - Longitud en formato WGS84

Consulta la documentación del dataset CKAN de Barcelona para conocer todos los campos disponibles.

---

## 📥 Response

### Respuesta Exitosa (200 OK)

- Tipo: `application/json`
- Estructura:

```json
{
  "success": true,
  "message": "Puntos de reciclaje encontrados en Barcelona",
  "data": [
    {
      "_id": 1,
      "name": "Punt Verd de Zona - Deixalleria Sant Andreu",
      "register_id": "﻿297122514",

      // Dirección
      "addresses_road_name": "Carrer de Caracas",
      "addresses_roadtype_name": "",
      "addresses_roadtype_id": "",
      "addresses_road_id": "63850",
      "addresses_start_street_number": "46",
      "addresses_end_street_number": "",
      "addresses_neighborhood_name": "el Bon Pastor",
      "addresses_neighborhood_id": "59",
      "addresses_district_name": "Sant Andreu",
      "addresses_district_id": "9",
      "addresses_town": "Barcelona",
      "addresses_zip_code": "8030",
      "addresses_type": "",
      "addresses_main_address": "True",

      // Geolocalización
      "geo_epgs_4326_lat": "41.445550455899266",
      "geo_epgs_4326_lon": "2.2023587351522655",
      "geo_epgs_25831_x": "433370.64732818236",
      "geo_epgs_25831_y": "4588526.304645845",

      // Categoría y filtros
      "secondary_filters_id": "65731070",
      "secondary_filters_name": "Punts verds de zona",
      "secondary_filters_tree": "651",
      "secondary_filters_asia_id": "65103012000002",
      "secondary_filters_fullpath": "Planol BCN >> Medi ambient >> Medi ambient >> Punts verds de zona",

      // Valores adicionales (ej: teléfono)
      "values_id": "130872",
      "values_category": "Telèfons",
      "values_attribute_id": "100050",
      "values_attribute_name": "No tenen telèfon",
      "values_value": "-",
      "values_description": "",
      "values_outstanding": "True",

      // Fechas
      "created": "2000-10-23T00:00:00",
      "modified": "2024-04-30T14:39:20.462484",
      "start_date": "",
      "end_date": "",
      "estimated_dates": "",

      // Otros
      "institution_id": "",
      "institution_name": "",
      "timetable": ""
    }
  ]
}
```

> **Nota**: El array `data` puede estar vacío si no hay resultados que coincidan con los filtros. Algunos campos pueden estar vacíos (`""`) dependiendo del punto de reciclaje específico.

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
curl -X GET http://localhost:3001/api/recycling-points/barcelona

# Búsqueda por texto
curl -X GET "http://localhost:3001/api/recycling-points/barcelona?q=vidrio"

# Filtro por barrio
curl -X GET "http://localhost:3001/api/recycling-points/barcelona?addresses_neighborhood_name=el%20Bon%20Pastor"

# Filtro por distrito
curl -X GET "http://localhost:3001/api/recycling-points/barcelona?addresses_district_name=Sant%20Andreu"

# Combinación de búsqueda y filtros
curl -X GET "http://localhost:3001/api/recycling-points/barcelona?q=punt&addresses_district_name=Sant%20Andreu"
```

### JavaScript/TypeScript (fetch)

```javascript
async function getBarcelonaPoints(searchText = null, filters = {}) {
  // Construir query params
  const params = new URLSearchParams();

  if (searchText) {
    params.append('q', searchText);
  }

  // Añadir filtros adicionales (ej: { addresses_district_name: 'Sant Andreu', addresses_neighborhood_name: 'el Bon Pastor' })
  Object.entries(filters).forEach(([key, value]) => {
    params.append(key, value);
  });

  const queryString = params.toString();
  const url = `http://localhost:3001/api/recycling-points/barcelona${queryString ? '?' + queryString : ''}`;

  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Error al obtener puntos');
  }

  const response = await res.json();
  return response.data; // Array de puntos
}

// Ejemplos de uso:
// const allPoints = await getBarcelonaPoints();
// const pointsWithGlass = await getBarcelonaPoints('vidrio');
// const pointsInSantAndreu = await getBarcelonaPoints(null, { addresses_district_name: 'Sant Andreu' });
// const filtered = await getBarcelonaPoints('punt', { addresses_district_name: 'Sant Andreu' });
```

### Dart/Flutter (http)

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<List<Map<String, dynamic>>> getBarcelonaPoints({
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

  final uri = Uri.parse('http://localhost:3001/api/recycling-points/barcelona')
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
// final allPoints = await getBarcelonaPoints();
// final glassPoints = await getBarcelonaPoints(searchText: 'vidrio');
// final santAndreuPoints = await getBarcelonaPoints(filters: {'addresses_district_name': 'Sant Andreu'});
// final filtered = await getBarcelonaPoints(
//   searchText: 'punt',
//   filters: {'addresses_district_name': 'Sant Andreu'},
// );
```

---

## 📝 Notas

- El backend usa la variable de entorno `BARCELONA_RESOURCE_ID` para apuntar al dataset CKAN; la forma de los campos puede cambiar si el dataset cambia.
- La paginación se hace automáticamente en el backend (descarga en bloques de 1000 registros de CKAN hasta obtener todos los que coincidan con los filtros).
- **Búsqueda por texto (`q`)**: Busca en todos los campos del dataset (full-text search de CKAN).
- **Filtros por campo**: Puedes filtrar por cualquier campo del dataset CKAN usando su nombre exacto como query param.
- Los filtros se combinan con lógica AND (deben cumplirse todos).

### Campos principales del dataset de Barcelona

**Identificación:**

- `_id` - ID único del registro
- `register_id` - ID de registro del sistema
- `name` - Nombre del punto de reciclaje

**Ubicación:**

- `addresses_road_name` - Nombre de la calle
- `addresses_start_street_number` / `addresses_end_street_number` - Número de calle
- `addresses_neighborhood_name` / `addresses_neighborhood_id` - Barrio
- `addresses_district_name` / `addresses_district_id` - Distrito
- `addresses_town` - Municipio (normalmente "Barcelona")
- `addresses_zip_code` - Código postal

**Geolocalización:**

- `geo_epgs_4326_lat` / `geo_epgs_4326_lon` - Coordenadas en formato WGS84 (para mapas web)
- `geo_epgs_25831_x` / `geo_epgs_25831_y` - Coordenadas en formato ETRS89 UTM31N

**Categorización:**

- `secondary_filters_name` - Tipo de punto (ej: "Punts verds de zona")
- `secondary_filters_fullpath` - Ruta completa de categoría
- `values_category` - Categoría del valor (ej: "Telèfons")
- `values_attribute_name` - Atributo (ej: "No tenen telèfon")

**Fechas:**

- `created` - Fecha de creación del registro
- `modified` - Última modificación

**Otros:**

- `timetable` - Horario (cuando está disponible)
- `institution_name` - Institución responsable (cuando aplica)

---

**Anterior**: [← Resumen de Endpoints](../02-endpoints-resumen.md)

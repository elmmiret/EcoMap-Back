# GET /api/routes - Calcular ruta entre coordenadas

Calcula la ruta óptima entre dos puntos geográficos usando OpenRouteService (ORS). Permite elegir distintos perfiles (a pie, coche, bicicleta, etc.).

---

## 📋 Información General

|                   |                       |
| ----------------- | --------------------- |
| **Método**        | `GET`                 |
| **URL**           | `/api/routes`         |
| **Autenticación** | ❌ No requerida       |
| **Rol requerido** | Ninguno               |

---

## 📤 Request

### Headers

No se requieren headers especiales.

### Query Params

| Parámetro  | Tipo     | Requerido | Descripción                                                                                 | Ejemplo                         |
| ---------- | -------- | --------- | ------------------------------------------------------------------------------------------- | ------------------------------- |
| `start`    | `string` | Sí        | Coordenadas de inicio en formato `lat,lng`                                                  | `41.3851,2.1734`                |
| `end`      | `string` | Sí        | Coordenadas de destino en formato `lat,lng`                                                 | `41.4036,2.1744`                |
| `profile`  | `string` | No        | Perfil de ruta de ORS. Por defecto: `driving-car`                                           | `foot-walking`                  |

### Perfiles disponibles (ORS)

- `driving-car` — Coche
- `cycling-regular` — Bicicleta
- `foot-walking` — Caminando
- `wheelchair` — Accesible
- `driving-hgv` — Vehículo pesado

> Si no se especifica `profile`, se usará `driving-car`.

---

## 📥 Response

### Respuesta Exitosa (200 OK)

- Tipo: `application/json`
- Estructura:

```json
{
  "success": true,
  "message": "Ruta calculada correctamente",
  "data": {
    "distance": <number>,
    "duration": <number>,
    "geometry": [[<lng>, <lat>], ...],
    "steps": [
      {
        "distance": <number>,
        "duration": <number>,
        "instruction": "<string>",
        "name": "<string>",
        "type": <number>
      }
    ]
  }
}
```

### Respuesta de Error (400 Bad Request)

Cuando faltan parámetros obligatorios:

```json
{
  "success": false,
  "message": "Debes especificar start y end (lat,lng)"
}
```

### Respuesta de Error (500 Internal Server Error)

```json
{
  "success": false,
  "message": "<Descripción del error>"
}
```

---

## 🧭 Ejemplo real (Plaza Catalunya → Sagrada Família caminando)

Request:

```
GET /api/routes?start=41.3851,2.1734&end=41.4036,2.1744&profile=foot-walking
```

Response:

```json
{
    "success": true,
    "message": "Ruta calculada correctamente",
    "data": {
        "distance": 2806.5,
        "duration": 2020.6,
        "geometry": [
            [
                2.17344,
                41.38505
            ],
            [
                2.17363,
                41.38513
            ],
            [
                2.17369,
                41.38515
            ],
            [
                2.17364,
                41.3852
            ],
            [
                2.17369,
                41.38523
            ],
            [
                2.17383,
                41.38533
            ],
            [
                2.17402,
                41.38545
            ],
            [
                2.17427,
                41.38552
            ],
            [
                2.17465,
                41.3856
            ],
            [
                2.17464,
                41.38565
            ],
            [
                2.17484,
                41.38568
            ],
            [
                2.17467,
                41.38601
            ],
            [
                2.17456,
                41.38641
            ],
            [
                2.17445,
                41.38682
            ],
            [
                2.17442,
                41.38689
            ],
            [
                2.17459,
                41.38695
            ],
            [
                2.17463,
                41.38697
            ],
            [
                2.17455,
                41.38703
            ],
            [
                2.17459,
                41.38706
            ],
            [
                2.17465,
                41.38711
            ],
            [
                2.17467,
                41.38712
            ],
            [
                2.17471,
                41.38714
            ],
            [
                2.17446,
                41.38736
            ],
            [
                2.17453,
                41.3874
            ],
            [
                2.17448,
                41.38748
            ],
            [
                2.17438,
                41.38774
            ],
            [
                2.17436,
                41.38779
            ],
            [
                2.17434,
                41.38783
            ],
            [
                2.17382,
                41.3889
            ],
            [
                2.1739,
                41.38891
            ],
            [
                2.1739,
                41.38896
            ],
            [
                2.17391,
                41.38901
            ],
            [
                2.17387,
                41.38903
            ],
            [
                2.17386,
                41.3891
            ],
            [
                2.17386,
                41.38921
            ],
            [
                2.17395,
                41.38927
            ],
            [
                2.17394,
                41.38932
            ],
            [
                2.17394,
                41.38935
            ],
            [
                2.17395,
                41.38942
            ],
            [
                2.17395,
                41.38949
            ],
            [
                2.17396,
                41.38952
            ],
            [
                2.17378,
                41.38949
            ],
            [
                2.17368,
                41.38955
            ],
            [
                2.17366,
                41.38981
            ],
            [
                2.17362,
                41.38984
            ],
            [
                2.1739,
                41.39006
            ],
            [
                2.17433,
                41.39038
            ],
            [
                2.17428,
                41.39042
            ],
            [
                2.17431,
                41.39061
            ],
            [
                2.17426,
                41.39066
            ],
            [
                2.17387,
                41.39101
            ],
            [
                2.1736,
                41.39122
            ],
            [
                2.17363,
                41.39125
            ],
            [
                2.17368,
                41.39126
            ],
            [
                2.17368,
                41.3913
            ],
            [
                2.17366,
                41.39153
            ],
            [
                2.17435,
                41.39202
            ],
            [
                2.17433,
                41.39205
            ],
            [
                2.17453,
                41.3922
            ],
            [
                2.17457,
                41.39224
            ],
            [
                2.17477,
                41.39239
            ],
            [
                2.1747,
                41.39245
            ],
            [
                2.17539,
                41.39296
            ],
            [
                2.17541,
                41.39298
            ],
            [
                2.17542,
                41.39322
            ],
            [
                2.17547,
                41.39326
            ],
            [
                2.17553,
                41.3933
            ],
            [
                2.17482,
                41.39385
            ],
            [
                2.17481,
                41.39405
            ],
            [
                2.17501,
                41.39417
            ],
            [
                2.1751,
                41.3942
            ],
            [
                2.17504,
                41.39427
            ],
            [
                2.17499,
                41.39434
            ],
            [
                2.17497,
                41.39437
            ],
            [
                2.17493,
                41.3944
            ],
            [
                2.17485,
                41.39446
            ],
            [
                2.17482,
                41.39447
            ],
            [
                2.17472,
                41.39451
            ],
            [
                2.17465,
                41.39454
            ],
            [
                2.17472,
                41.39473
            ],
            [
                2.17473,
                41.39483
            ],
            [
                2.17472,
                41.39501
            ],
            [
                2.1747,
                41.3951
            ],
            [
                2.17462,
                41.39524
            ],
            [
                2.17455,
                41.39535
            ],
            [
                2.17446,
                41.39543
            ],
            [
                2.17425,
                41.39558
            ],
            [
                2.17437,
                41.39566
            ],
            [
                2.1744,
                41.39568
            ],
            [
                2.17449,
                41.39574
            ],
            [
                2.17453,
                41.39576
            ],
            [
                2.17464,
                41.39584
            ],
            [
                2.17454,
                41.39593
            ],
            [
                2.17453,
                41.39595
            ],
            [
                2.17448,
                41.39598
            ],
            [
                2.17444,
                41.39602
            ],
            [
                2.17443,
                41.39603
            ],
            [
                2.17516,
                41.39657
            ],
            [
                2.1752,
                41.3966
            ],
            [
                2.1752,
                41.39663
            ],
            [
                2.1752,
                41.39669
            ],
            [
                2.1752,
                41.39679
            ],
            [
                2.17514,
                41.39682
            ],
            [
                2.17469,
                41.39715
            ],
            [
                2.17445,
                41.39735
            ],
            [
                2.1745,
                41.39739
            ],
            [
                2.17456,
                41.39743
            ],
            [
                2.17454,
                41.39745
            ],
            [
                2.17455,
                41.39763
            ],
            [
                2.17459,
                41.39766
            ],
            [
                2.17526,
                41.39818
            ],
            [
                2.17524,
                41.3982
            ],
            [
                2.1752,
                41.39824
            ],
            [
                2.17517,
                41.39827
            ],
            [
                2.1752,
                41.39831
            ],
            [
                2.17517,
                41.39851
            ],
            [
                2.17451,
                41.39902
            ],
            [
                2.17454,
                41.39905
            ],
            [
                2.17457,
                41.39908
            ],
            [
                2.17459,
                41.39909
            ],
            [
                2.17457,
                41.39912
            ],
            [
                2.17457,
                41.39932
            ],
            [
                2.1746,
                41.39935
            ],
            [
                2.17457,
                41.39937
            ],
            [
                2.17441,
                41.39948
            ],
            [
                2.17523,
                41.4001
            ],
            [
                2.17527,
                41.40014
            ],
            [
                2.17516,
                41.40022
            ],
            [
                2.17514,
                41.40024
            ],
            [
                2.17504,
                41.40022
            ],
            [
                2.17498,
                41.40026
            ],
            [
                2.17496,
                41.40028
            ],
            [
                2.17489,
                41.40034
            ],
            [
                2.17481,
                41.40041
            ],
            [
                2.17475,
                41.40047
            ],
            [
                2.17474,
                41.40047
            ],
            [
                2.17472,
                41.40049
            ],
            [
                2.17467,
                41.40054
            ],
            [
                2.17468,
                41.40056
            ],
            [
                2.17468,
                41.40058
            ],
            [
                2.17443,
                41.40077
            ],
            [
                2.1745,
                41.40082
            ],
            [
                2.17456,
                41.40087
            ],
            [
                2.17456,
                41.40105
            ],
            [
                2.17457,
                41.40107
            ],
            [
                2.17451,
                41.40111
            ],
            [
                2.17447,
                41.40114
            ],
            [
                2.17445,
                41.40116
            ],
            [
                2.17488,
                41.40149
            ],
            [
                2.1749,
                41.4015
            ],
            [
                2.17491,
                41.40151
            ],
            [
                2.17517,
                41.40171
            ],
            [
                2.17519,
                41.40172
            ],
            [
                2.17517,
                41.40192
            ],
            [
                2.17523,
                41.40197
            ],
            [
                2.17529,
                41.40201
            ],
            [
                2.17461,
                41.40252
            ],
            [
                2.17455,
                41.40258
            ],
            [
                2.17455,
                41.40273
            ],
            [
                2.17458,
                41.40276
            ],
            [
                2.17457,
                41.40277
            ],
            [
                2.17456,
                41.40278
            ],
            [
                2.1748,
                41.40296
            ],
            [
                2.17482,
                41.40298
            ],
            [
                2.17484,
                41.403
            ],
            [
                2.17543,
                41.40345
            ],
            [
                2.1754,
                41.40347
            ],
            [
                2.17535,
                41.40351
            ],
            [
                2.17534,
                41.40352
            ],
            [
                2.17536,
                41.40372
            ],
            [
                2.17533,
                41.40375
            ],
            [
                2.17504,
                41.40397
            ],
            [
                2.17499,
                41.40394
            ],
            [
                2.17491,
                41.40393
            ],
            [
                2.17481,
                41.40388
            ],
            [
                2.17477,
                41.40385
            ],
            [
                2.17465,
                41.40382
            ]
        ],
        "steps": [
            {
                "distance": 23.9,
                "duration": 17.2,
                "instruction": "Head northeast on Carrer de la Canuda",
                "name": "Carrer de la Canuda",
                "type": 11
            },
            {
                "distance": 7.1,
                "duration": 5.1,
                "instruction": "Turn sharp left onto Avinguda del Portal de l'Àngel",
                "name": "Avinguda del Portal de l'Àngel",
                "type": 2
            },
            {
                "distance": 98,
                "duration": 70.5,
                "instruction": "Turn right onto Carrer de Duran i Bas",
                "name": "Carrer de Duran i Bas",
                "type": 1
            },
            {
                "distance": 23,
                "duration": 16.6,
                "instruction": "Turn left onto Plaça dels Peixos",
                "name": "Plaça dels Peixos",
                "type": 0
            },
            {
                "distance": 138.9,
                "duration": 100,
                "instruction": "Turn left onto Carrer de les Magdalenes",
                "name": "Carrer de les Magdalenes",
                "type": 0
            }
        ]
    }
}
```

> Nota: En el bloque `geometry` se devuelven coordenadas `[lng, lat]` para dibujar la polilínea; aquí se ha recortado el listado para hacer el ejemplo más legible.

---

## 💻 Ejemplos de Código

### cURL

```bash
curl -X GET "http://localhost:3001/api/routes?start=41.3851,2.1734&end=41.4036,2.1744&profile=foot-walking"
```

### JavaScript/TypeScript (fetch)

```javascript
async function getRoute({ start, end, profile = 'driving-car' }) {
  const params = new URLSearchParams({ start, end, profile });
  const url = `http://localhost:3001/api/routes?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Error al calcular la ruta');
  }
  const json = await res.json();
  return json.data; // { distance, duration, geometry, steps }
}

// Ejemplo:
// await getRoute({ start: '41.3851,2.1734', end: '41.4036,2.1744', profile: 'foot-walking' });
```

### Dart/Flutter

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<Map<String, dynamic>> getRoute({
  required String start,
  required String end,
  String profile = 'driving-car',
}) async {
  final uri = Uri.parse('http://localhost:3001/api/routes').replace(
    queryParameters: {
      'start': start,
      'end': end,
      'profile': profile,
    },
  );

  final res = await http.get(uri);
  if (res.statusCode != 200) {
    final err = jsonDecode(res.body);
    throw Exception(err['message'] ?? 'Error al calcular ruta');
  }

  final Map<String, dynamic> response = jsonDecode(res.body);
  return response['data'];
}
```

---

## 📝 Notas

- El backend usa OpenRouteService (ORS). Debes configurar `ORS_API_KEY` en el entorno de ejecución del backend para que funcione.
- `geometry` usa pares `[lng, lat]` (longitud, latitud). Si deseas dibujar en mapas que esperan `[lat, lng]`, invierte el orden.
- `steps` incluye instrucciones paso a paso cuando están disponibles para el perfil elegido.

---

## 🔗 Relacionado

- Mapa y visualización de rutas en el frontend (polilíneas sobre mapa)

# Filtros de Puntos de Reciclaje

## Descripción

El endpoint `GET /api/recycling-points/:region` soporta filtros mediante query parameters para refinar los resultados.

---

## Filtros disponibles

### 0. Filtro por ID de punto (api_id)

Coincidencia **exacta** con el ID externo del punto (`api_id`). Útil para recuperar un punto específico conocido.

**Query parameter**: `api_id`

**Tipo**: Entero

**Ejemplo**:
```
GET /api/recycling-points/navarra?api_id=1234
```

**Uso**:
- Obtener punto con ID 1234 → `?api_id=1234`
- Comprobar existencia de punto conocido → `?api_id=5678`

**Notas**:
- Filtro de base de datos (rápido, con índice).
- Si el ID no existe o el punto está inactivo, devuelve array vacío.
- Normalmente devolverá 0 o 1 resultado.

---

### 1. Filtro por nombre

Búsqueda parcial **case-insensitive** e **insensible a acentos** en el nombre del punto. Normaliza ambos términos (búsqueda y nombre) eliminando acentos antes de comparar.

**Query parameter**: `name`

**Tipo**: String

**Ejemplo**:
```
GET /api/recycling-points/barcelona?name=sant
```

**Uso**:
- Buscar "Sant Andreu" → `?name=sant`
- Buscar "Deixalleria" → `?name=deixalleria` (encuentra "Deixallería")
- Buscar "Punt Verd" → `?name=punt verd`
- Buscar con acentos → `?name=vidrió` (encuentra "Vidrio", "vidrio", "VIDRIO")

**Notas**:
- La búsqueda es parcial: `?name=verd` encuentra "Punt Verd", "Deixalleria Verda", etc.
- Funciona en memoria tras la consulta SQL inicial.

---

### 2. Filtro por tipo de equipamiento

Coincidencia EXACTA (case-sensitive a nivel de valor, aunque normalmente enviarás tal cual) contra los valores del enum `equipment_type` definido en el schema de Prisma. No admite búsqueda parcial ni nombres en castellano/catalán; el mapeo desde texto crudo se hace internamente al sincronizar datos externos.

**Query parameter**: `equipment_type`

**Valores permitidos (enum)**:
```
Recycling_center
Batteries
Medicines_and_packaging
Garden_waste
Clothing_and_footwear
Bulky_waste
Glass_containers
Coffee_capsules
Used_cooking_oil
Household_construction_waste
Community_composting
```

Si envías cualquier otro valor (ej. `vidrio`, `punts verds`, `deixalleria`), la consulta devolverá 0 resultados porque esos términos se normalizan previamente al enum durante la importación.

**Ejemplos válidos**:
```
GET /api/recycling-points/barcelona?equipment_type=Recycling_center
GET /api/recycling-points/navarra?equipment_type=Batteries
GET /api/recycling-points/navarra?equipment_type=Glass_containers
```

**Notas**:
- Si necesitas traducir desde etiquetas de la interfaz ("Punts verds de zona", "Deixalleria") al enum, haz el mapping en el frontend antes de llamar al endpoint.
- El enum puede cambiar si se amplía el catálogo; mantén sincronizada la lista.
- Para búsquedas textuales flexibles usa el filtro `name`.

---

### 2.5. Filtro por tipo de residuo (wasteType)

Filtra puntos que tienen **al menos un contenedor** del tipo de residuo especificado. Coincidencia exacta contra el enum `product_type`.

**Query parameter**: `wasteType`

**Tipo**: Enum `product_type`

**Valores permitidos (enum)**:
```
Glass
Paper
Plastic
Organic
General_waste
Textile
Electronics
Batteries
Oil
Hazardous
```

**Ejemplo**:
```
GET /api/recycling-points/barcelona?wasteType=Glass
GET /api/recycling-points/navarra?wasteType=Batteries
```

**Uso**:
- Puntos que aceptan vidrio → `?wasteType=Glass`
- Puntos que aceptan pilas → `?wasteType=Batteries`
- Puntos que aceptan aceite usado → `?wasteType=Oil`

**Notas**:
- Filtro de base de datos con relación `container.some` (optimizado).
- Un punto puede tener múltiples tipos de contenedores; el filtro devuelve puntos que tengan **al menos uno** del tipo solicitado.
- Si envías un valor inválido (ej. `vidrio`, `glass` en minúsculas), la consulta devolverá 0 resultados.
- Diferencia clave: `equipment_type` es el tipo de instalación (ej. "Recycling_center"); `wasteType` es el tipo de residuo que acepta (ej. "Glass").

---

### 3. Filtro por proximidad (geolocalización)

Devuelve solo los puntos dentro de un radio determinado desde una ubicación. Los tres parámetros son obligatorios; si falta alguno, el filtro se ignora.

**Query parameters** (los 3 son obligatorios):
- `lat`: Latitud de la ubicación del usuario (WGS84, decimal)
- `lng`: Longitud de la ubicación del usuario (WGS84, decimal)
- `radius`: Radio de búsqueda en kilómetros (debe ser > 0)

**Ejemplo**:
```
GET /api/recycling-points/barcelona?lat=41.3851&lng=2.1734&radius=2
```

**Uso**:
- Puntos a menos de 2km de Plaza Catalunya → `?lat=41.3851&lng=2.1734&radius=2`
- Puntos a menos de 5km de mi ubicación → `?lat=41.445&lng=2.202&radius=5`
- Puntos a menos de 500m → `?lat=41.445&lng=2.202&radius=0.5`

**Cómo funciona**:
1. Se aplica un filtro de bounding box en la base de datos (rápido, pre-filtro aproximado).
2. Se calcula la distancia exacta con fórmula de Haversine (preciso, post-filtro en memoria).
3. Solo se devuelven puntos dentro del radio especificado.
4. Los puntos se ordenan automáticamente por distancia ascendente.
5. Cada punto incluye el campo `distance_km` con la distancia calculada (redondeada a 2 decimales).

**Notas**:
- Coordenadas inválidas o `radius <= 0` hacen que el filtro se ignore silenciosamente.
- Funciona para ambas regiones (Navarra y Barcelona).
- El campo `distance_km` solo aparece cuando se aplica este filtro.

---

### 4. Filtro por horario

Devuelve solo los puntos abiertos en un momento determinado, consultando las tablas normalizadas de horarios (`timetable`, `time_interval`).

**Query parameters**:
- `isOpenNow`: Boolean (`true` o `1`) - Filtra puntos abiertos **en el momento actual**
- `openAt`: ISO 8601 datetime string - Filtra puntos abiertos en una **fecha/hora específica**

**Tipo**:
- `isOpenNow`: String (`"true"` o `"1"`; cualquier otro valor se ignora)
- `openAt`: String (ISO 8601 o cualquier formato que `new Date()` pueda parsear)

**Ejemplos**:
```
GET /api/recycling-points/barcelona?isOpenNow=true
GET /api/recycling-points/navarra?openAt=2025-11-22T14:30:00Z
GET /api/recycling-points/barcelona?openAt=2025-11-22T09:15:00+01:00
```

**Uso**:
- Puntos abiertos ahora → `?isOpenNow=true` o `?isOpenNow=1`
- Puntos abiertos mañana a las 10:00 UTC → `?openAt=2025-11-23T10:00:00Z`
- Puntos abiertos el sábado a las 15:00 (hora local) → `?openAt=2025-11-23T15:00:00+01:00`

**Comportamiento**:
- Si se envían **ambos** `isOpenNow` y `openAt`, **`isOpenNow` tiene prioridad** y `openAt` se ignora.
- Si `openAt` es inválido (no parseable por `new Date()`), se ignora silenciosamente y se loguea un warning.
- Puntos **sin horarios** en la base de datos (sin registros en `timetable`) son **excluidos** automáticamente de los resultados.

**Formatos de horario parseados en origen (sincronización)**:
- "24 h" / "24h" / "24 horas" → Siempre abierto (todos los días, 00:00-23:59)
- "9:00-18:00" → Rango horario simple
- "L-V 9:00-14:00" → Lunes a Viernes de 9 a 14
- "Lunes a Viernes 9-14" → Formato verbose
- "De lunes a viernes de 9:00 a 18:00" → Formato completo
- Soporta español y catalán

**Notas**:
- Filtro aplicado **en memoria** tras la consulta SQL (utiliza `filterBySchedule` de `schedule-check.service`).
- La comparación de tiempos usa la zona horaria del sistema del servidor.
- Rendimiento: < 10ms para datasets típicos.

---

## Combinación de filtros

Todos los filtros se pueden combinar para búsquedas más específicas.

**Ejemplos**:

### Recycling centers abiertos ahora cerca de mí
```
GET /api/recycling-points/barcelona?equipment_type=Recycling_center&lat=41.445&lng=2.202&radius=3&isOpenNow=true
```

### Puntos con "Sant" en el nombre y que acepten vidrio
```
GET /api/recycling-points/barcelona?name=sant&wasteType=Glass
```

### Puntos de baterías abiertos ahora en Navarra cerca de Pamplona
```
GET /api/recycling-points/navarra?equipment_type=Batteries&lat=42.8125&lng=-1.6458&radius=5&isOpenNow=true
```

### Puntos que acepten plástico, abiertos el sábado por la tarde, cerca de mi ubicación
```
GET /api/recycling-points/barcelona?wasteType=Plastic&lat=41.445&lng=2.202&radius=2&openAt=2025-11-23T17:00:00Z
```

---

## Respuesta

La respuesta mantiene el mismo formato estándar, pero `totalRegisters` y `data[]` reflejan los resultados **después de aplicar los filtros**.

**Ejemplo de respuesta**:
```json
{
  "success": true,
  "message": "Puntos de reciclaje encontrados en Barcelona",
  "totalRegisters": 12,
  "data": [
    {
      "recycling_point_id": "uuid-1",
      "api_id": 42,
      "name": "Punt Verd de Zona - Sant Andreu",
      "latitude": 41.445550,
      "longitude": 2.202358,
      "equipment_type": "Punts verds de zona",
      "schedule": null,
      "last_updated": "2024-04-30T14:39:20.462Z",
      "api_location": "Barcelona",
      "active": true
    }
    // ... 11 more
  ]
}
```

---

## Notas de rendimiento

- **Filtros de texto** (`name`, `equipment_type`): Se aplican en base de datos con índices → muy rápido
- **Filtro geográfico**:
  - Bounding box inicial → filtrado en DB con índices en lat/lng → rápido
  - Cálculo de distancia exacta → post-procesamiento en memoria → moderado (< 100ms para 1000 puntos)
- **Filtro de horario** (`isOpenNow`, `openAt`): Se aplica en memoria tras la consulta DB → muy rápido (< 10ms para parsing)
- **Combinación de filtros**: El orden no afecta el rendimiento; la DB optimiza automáticamente los filtros estructurales

---

## Casos de uso típicos

1. **App móvil**: "Mostrar puntos abiertos ahora cerca de mi ubicación actual"
   ```
   ?lat={gps.lat}&lng={gps.lng}&radius=2&isOpenNow=true
   ```

2. **Búsqueda por tipo de instalación**: "Solo quiero ver recycling centers abiertos ahora"
   ```
   ?equipment_type=Recycling_center&isOpenNow=true
   ```

3. **Búsqueda por tipo de residuo**: "Dónde puedo tirar vidrio cerca de casa"
   ```
   ?wasteType=Glass&lat=41.445&lng=2.202&radius=1
   ```

4. **Búsqueda combinada**: "Puntos que acepten aceite usado, cerca de casa, abiertos el sábado"
   ```
   ?wasteType=Used_cooking_oil&lat=41.445&lng=2.202&radius=1&openAt=2025-11-23T10:00:00Z
   ```

5. **Autocompletado**: "Buscar por nombre mientras escribo"
   ```
   ?name={userInput}
   ```

6. **Planificación**: "¿Qué puntos estarán abiertos mañana por la tarde cerca de mí?"
   ```
   ?lat={gps.lat}&lng={gps.lng}&radius=5&openAt=2025-11-23T17:00:00Z
   ```

7. **Punto específico**: "Comprobar si el punto 1234 existe y está activo"
   ```
   ?api_id=1234
   ```

---

## Extensiones futuras

Filtros adicionales que se pueden añadir fácilmente:

- `?district`: Filtrar por distrito/barrio
- `?sort`: Ordenar por distancia, nombre, etc.
- `?limit` y `?offset`: Paginación para grandes datasets
- `?openDuring`: Filtrar por rango de horario (abierto durante todo un período)

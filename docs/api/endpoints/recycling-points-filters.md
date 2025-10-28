# Filtros de Puntos de Reciclaje

## Descripción

El endpoint `GET /api/recycling-points/:region` soporta filtros mediante query parameters para refinar los resultados.

---

## Filtros disponibles

### 1. Filtro por nombre

Búsqueda parcial case-insensitive en el nombre del punto.

**Query parameter**: `name`

**Ejemplo**:
```
GET /api/recycling-points/barcelona?name=sant
```

**Uso**:
- Buscar "Sant Andreu" → `?name=sant`
- Buscar "Deixalleria" → `?name=deixalleria`
- Buscar "Punt Verd" → `?name=punt verd`

---

### 2. Filtro por tipo de equipamiento

Búsqueda parcial case-insensitive en el tipo de equipamiento.

**Query parameter**: `equipment_type`

**Ejemplo**:
```
GET /api/recycling-points/barcelona?equipment_type=punts verds
```

**Uso para Barcelona**:
- "Punts verds de zona" → `?equipment_type=punts verds`
- "Contenedors" → `?equipment_type=contenedor`

**Uso para Navarra**:
- "Pilas" → `?equipment_type=pilas`
- "Vidrio" → `?equipment_type=vidrio`
- "Papel" → `?equipment_type=papel`

---

### 3. Filtro por proximidad (geolocalización)

Devuelve solo los puntos dentro de un radio determinado desde una ubicación.

**Query parameters** (los 3 son obligatorios):
- `lat`: Latitud de la ubicación del usuario (WGS84)
- `lng`: Longitud de la ubicación del usuario (WGS84)
- `radius`: Radio de búsqueda en kilómetros

**Ejemplo**:
```
GET /api/recycling-points/barcelona?lat=41.3851&lng=2.1734&radius=2
```

**Uso**:
- Puntos a menos de 2km de Plaza Catalunya → `?lat=41.3851&lng=2.1734&radius=2`
- Puntos a menos de 5km de mi ubicación → `?lat=41.445&lng=2.202&radius=5`
- Puntos a menos de 500m → `?lat=41.445&lng=2.202&radius=0.5`

**Cómo funciona**:
1. Se aplica un filtro de bounding box en la base de datos (rápido)
2. Se calcula la distancia exacta con fórmula de Haversine (preciso)
3. Solo se devuelven puntos dentro del radio especificado

---

## Combinación de filtros

Todos los filtros se pueden combinar para búsquedas más específicas.

**Ejemplos**:

### Punts verds cerca de mí
```
GET /api/recycling-points/barcelona?equipment_type=punts verds&lat=41.445&lng=2.202&radius=3
```

### Deixalleries con "Sant" en el nombre
```
GET /api/recycling-points/barcelona?name=sant&equipment_type=deixalleria
```

### Puntos de pilas en Navarra cerca de Pamplona
```
GET /api/recycling-points/navarra?equipment_type=pilas&lat=42.8125&lng=-1.6458&radius=5
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
- **Combinación de filtros**: El orden no afecta el rendimiento; la DB optimiza automáticamente

---

## Casos de uso típicos

1. **App móvil**: "Mostrar puntos cerca de mi ubicación actual"
   ```
   ?lat={gps.lat}&lng={gps.lng}&radius=2
   ```

2. **Búsqueda por tipo**: "Solo quiero ver deixalleries"
   ```
   ?equipment_type=deixalleria
   ```

3. **Búsqueda combinada**: "Punts verds cerca de casa"
   ```
   ?equipment_type=punts verds&lat=41.445&lng=2.202&radius=1
   ```

4. **Autocompletado**: "Buscar por nombre mientras escribo"
   ```
   ?name={userInput}
   ```

---

## Extensiones futuras

Filtros adicionales que se pueden añadir fácilmente:

- `?schedule`: Filtrar por horario (abierto ahora, 24h, etc.)
- `?district`: Filtrar por distrito/barrio
- `?sort`: Ordenar por distancia, nombre, etc.
- `?limit` y `?offset`: Paginación para grandes datasets

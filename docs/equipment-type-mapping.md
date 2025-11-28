# Mapeo de Tipos de Equipamiento

Este documento describe cómo se mapean los tipos de equipamiento desde las APIs externas (Navarra, Barcelona) al enum `equipment_type` de Prisma.

---

## Enum `equipment_type` (Prisma)

```prisma
enum equipment_type {
  Recycling_center              @map("Recycling Center")
  Batteries
  Medicines_and_packaging       @map("Medicines and Packaging")
  Garden_Waste                  @map("Garden Waste")
  Clothing_and_footwear         @map("Clothing and Footwear")
  Bulky_waste                   @map("Bulky Waste")
  Glass_containers              @map("Glass Containers")
  Coffee_capsules               @map("Coffee Capsules")
  Used_cooking_oil              @map("Used Cooking Oil")
  Household_construction_waste  @map("Household Construction Waste")
  Community_composting          @map("Community Composting")
}
```

---

## Mapeo automático

El sistema usa el archivo `src/lib/equipment-type-mapper.js` para mapear automáticamente los valores de las APIs al enum.

### 1. **Recycling_center** (Centros de reciclaje)

Incluye todos los puntos limpios, deixalleries, punts verds, etc.

**Patrones detectados** (case-insensitive):
- `punto limpio`
- `mini punto limpio`
- `punt limpi`
- `mini punt limpi`
- `punto limpio móvil`
- `punt limpi mòbil`
- `caseta de reciclaje`
- `caseta punto limpio`
- `caseta punt limpi`
- `ecopunto`
- `ecopunt`
- `punts verds`
- `punt verd`
- `punto verde`
- `deixalleria`
- `recycling center`
- `centre de reciclatge`

**Ejemplos de valores de API que se mapean**:
- `"Punto limpio fijo"` → `Recycling_center`
- `"Mini punto limpio fijo"` → `Recycling_center`
- `"Punto limpio móvil"` → `Recycling_center`
- `"Caseta de reciclaje"` → `Recycling_center`
- `"Caseta punto limpio"` → `Recycling_center`
- `"Ecopunto"` → `Recycling_center`
- `"Punts verds de zona"` → `Recycling_center`
- `"Deixalleria Sant Andreu"` → `Recycling_center`

---

### 2. **Batteries** (Pilas y baterías)

**Patrones detectados**:
- `pila`
- `batteri`
- `battery`

**Ejemplos**:
- `"Pilas"` → `Batteries`
- `"Contenedor de pilas"` → `Batteries`
- `"Bateries"` → `Batteries`

---

### 3. **Medicines_and_packaging** (Medicamentos y envases)

**Patrones detectados**:
- `medicament`
- `medicine`
- `farmaci`
- `envase`

**Ejemplos**:
- `"Medicamentos"` → `Medicines_and_packaging`
- `"Medicaments i envasos"` → `Medicines_and_packaging`

---

### 4. **Garden_Waste** (Residuos de jardín)

**Patrones detectados**:
- `jard`
- `garden`
- `poda`
- `vegetal`

**Ejemplos**:
- `"Jardín"` → `Garden_Waste`
- `"Residuos vegetales"` → `Garden_Waste`

---

### 5. **Clothing_and_footwear** (Ropa y calzado)

**Patrones detectados**:
- `ropa`
- `roba`
- `clothing`
- `textil`
- `calzado`
- `footwear`

**Ejemplos**:
- `"Ropa"` → `Clothing_and_footwear`
- `"Roba i calçat"` → `Clothing_and_footwear`

---

### 6. **Bulky_waste** (Residuos voluminosos)

**Patrones detectados**:
- `voluminoso`
- `voluminós`
- `bulky`
- `moble`
- `mueble`

**Ejemplos**:
- `"Voluminosos"` → `Bulky_waste`
- `"Mobles"` → `Bulky_waste`

---

### 7. **Glass_containers** (Contenedores de vidrio)

**Patrones detectados**:
- `vidri`
- `glass`
- `cristal`

**Ejemplos**:
- `"Vidrio"` → `Glass_containers`
- `"Contenidor de vidre"` → `Glass_containers`

---

### 8. **Coffee_capsules** (Cápsulas de café)

**Patrones detectados**:
- `càpsula`
- `cápsula`
- `capsule`
- `cafè`
- `café`

**Ejemplos**:
- `"Cápsulas de café"` → `Coffee_capsules`
- `"Càpsules"` → `Coffee_capsules`

---

### 9. **Used_cooking_oil** (Aceite de cocina usado)

**Patrones detectados**:
- `oli`
- `aceite`
- `oil`
- `cuina`
- `cocina`
- `cooking`

**Ejemplos**:
- `"Aceite de cocina"` → `Used_cooking_oil`
- `"Oli de cuina"` → `Used_cooking_oil`

---

### 10. **Household_construction_waste** (Residuos de construcción domésticos)

**Patrones detectados**:
- `construcció`
- `construcción`
- `construction`
- `obra`
- `runa`

**Ejemplos**:
- `"Residuos de construcción"` → `Household_construction_waste`
- `"Runes"` → `Household_construction_waste`

---

### 11. **Community_composting** (Compostaje comunitario)

**Patrones detectados**:
- `compost`
- `comunitari`
- `comunitario`
- `orgànic`
- `orgánico`

**Ejemplos**:
- `"Compostaje comunitario"` → `Community_composting`
- `"Compost orgànic"` → `Community_composting`

---

## Valores sin mapeo

Si un valor de la API **no coincide con ningún patrón**, se guarda como `null` en la base de datos.

**Importante**: El valor original siempre se conserva en el campo `raw_payload` para auditoría y debugging.

---

## Cómo añadir nuevos patrones

1. Editar `src/lib/equipment-type-mapper.js`
2. Añadir el patrón a la categoría correspondiente
3. Reiniciar el servidor
4. Ejecutar sync manual o esperar al próximo cron

**Ejemplo**:
```javascript
// Añadir nuevo patrón para Recycling_center
const recyclingCenterPatterns = [
  // ... patrones existentes
  'nuevo_patron',  // ← Añadir aquí
];
```

---

## Testing

Para verificar que el mapeo funciona correctamente:

```javascript
import { mapEquipmentType } from './lib/equipment-type-mapper.js';

// Test
console.log(mapEquipmentType('Punto limpio fijo'));  // → 'Recycling_center'
console.log(mapEquipmentType('Pilas'));              // → 'Batteries'
console.log(mapEquipmentType('Punts verds de zona'));// → 'Recycling_center'
console.log(mapEquipmentType('Valor desconocido'));  // → null
```

---

## Notas

- El mapeo es **case-insensitive** (no distingue mayúsculas/minúsculas)
- Los espacios al inicio y final se eliminan automáticamente
- Los patrones se comprueban con `includes()`, no con match exacto
- El primer patrón que coincida determina el tipo
- Si no coincide ningún patrón, se devuelve `null`

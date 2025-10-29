/**
 * Equipment Type Mapping
 *
 * Maps raw equipment type strings from APIs to Prisma enum values
 */

/**
 * Maps equipment type string to Prisma equipment_type enum
 * @param {string} rawType - Raw equipment type from API
 * @returns {string} Prisma enum value or null if no match
 */
export function mapEquipmentType(rawType) {
  if (!rawType || typeof rawType !== 'string') {
    return null;
  }

  const normalized = rawType.toLowerCase().trim();

  // Recycling centers (puntos limpios, deixalleries, etc.)
  const recyclingCenterPatterns = [
    'punto limpio',
    'mini punto limpio',
    'punt limpi',
    'mini punt limpi',
    'punto limpio móvil',
    'punt limpi mòbil',
    'caseta de reciclaje',
    'caseta punto limpio',
    'caseta punt limpi',
    'ecopunto',
    'ecopunt',
    'punts verds',
    'punt verd',
    'punto verde',
    'deixalleria',
    'recycling center',
    'centre de reciclatge',
  ];

  if (recyclingCenterPatterns.some((pattern) => normalized.includes(pattern))) {
    return 'Recycling_center';
  }

  // Batteries
  if (normalized.includes('pila') || normalized.includes('batteri') || normalized.includes('battery')) {
    return 'Batteries';
  }

  // Medicines and packaging
  if (normalized.includes('medicament') || normalized.includes('medicine') || normalized.includes('farmaci') || normalized.includes('envase')) {
    return 'Medicines_and_packaging';
  }

  // Garden waste
  if (normalized.includes('jard') || normalized.includes('garden') || normalized.includes('poda') || normalized.includes('vegetal')) {
    return 'Garden_Waste';
  }

  // Clothing and footwear
  if (
    normalized.includes('ropa') ||
    normalized.includes('roba') ||
    normalized.includes('clothing') ||
    normalized.includes('textil') ||
    normalized.includes('calzado') ||
    normalized.includes('footwear')
  ) {
    return 'Clothing_and_footwear';
  }

  // Bulky waste
  if (
    normalized.includes('voluminoso') ||
    normalized.includes('voluminós') ||
    normalized.includes('bulky') ||
    normalized.includes('moble') ||
    normalized.includes('mueble')
  ) {
    return 'Bulky_waste';
  }

  // Glass containers
  if (normalized.includes('vidri') || normalized.includes('glass') || normalized.includes('cristal')) {
    return 'Glass_containers';
  }

  // Coffee capsules
  if (
    normalized.includes('càpsula') ||
    normalized.includes('cápsula') ||
    normalized.includes('capsule') ||
    normalized.includes('cafè') ||
    normalized.includes('café')
  ) {
    return 'Coffee_capsules';
  }

  // Used cooking oil
  if (
    normalized.includes('oli') ||
    normalized.includes('aceite') ||
    normalized.includes('oil') ||
    normalized.includes('cuina') ||
    normalized.includes('cocina') ||
    normalized.includes('cooking')
  ) {
    return 'Used_cooking_oil';
  }

  // Household construction waste
  if (
    normalized.includes('construcció') ||
    normalized.includes('construcción') ||
    normalized.includes('construction') ||
    normalized.includes('obra') ||
    normalized.includes('runa')
  ) {
    return 'Household_construction_waste';
  }

  // Community composting
  if (
    normalized.includes('compost') ||
    normalized.includes('comunitari') ||
    normalized.includes('comunitario') ||
    normalized.includes('orgànic') ||
    normalized.includes('orgánico')
  ) {
    return 'Community_composting';
  }

  // If no match, return null (will be handled by caller)
  return null;
}

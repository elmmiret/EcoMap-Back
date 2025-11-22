/**
 * Equipment Type Mapper
 *
 * Maps raw equipment type strings from external APIs to the standardized
 * equipment_type enum values in the database.
 *
 * Supported sources:
 * - Navarra API (TipoEquipamiento)
 * - Barcelona API (secondary_filters_name)
 */

import { createLogger } from '#lib/logger.js';

const log = createLogger('equipment-mapper');

/**
 * Mapping patterns for equipment types
 * Keys are normalized (lowercase, no accents) patterns to match
 * Values are the enum values from Prisma schema
 */
const EQUIPMENT_TYPE_PATTERNS = {
  // Recycling Center / Punto Limpio / Deixalleria / Punt Verd
  'punto limpio fijo': 'Recycling_center',
  'punto limpio movil': 'Recycling_center',
  'punto limpio móvil': 'Recycling_center',
  'punt verd': 'Recycling_center',
  'punts verds': 'Recycling_center',
  'punts verds de zona': 'Recycling_center',
  deixalleria: 'Recycling_center',
  deixalleries: 'Recycling_center',
  'recycling center': 'Recycling_center',
  'caseta de reciclaje': 'Recycling_center',
  'caseta punto limpio': 'Recycling_center',
  ecopunto: 'Recycling_center',

  // Batteries / Pilas
  pilas: 'Batteries',
  piles: 'Batteries',
  batteries: 'Batteries',
  bateria: 'Batteries',

  // Medicines And Packaging / Medicamentos y Envases
  medicamentos: 'Medicines_and_packaging',
  medicines: 'Medicines_and_packaging',
  medicaments: 'Medicines_and_packaging',

  // Garden Waste / Restos de poda
  'restos de poda': 'Garden_waste',
  poda: 'Garden_waste',
  'garden waste': 'Garden_waste',
  jardineria: 'Garden_waste',

  // Clothing And Footwear / Ropa y calzado
  'ropa y calzado': 'Clothing_and_footwear',
  ropa: 'Clothing_and_footwear',
  calzado: 'Clothing_and_footwear',
  textil: 'Clothing_and_footwear',
  textile: 'Clothing_and_footwear',
  clothing: 'Clothing_and_footwear',

  // Bulky Waste / Muebles / Enseres
  muebles: 'Bulky_waste',
  enseres: 'Bulky_waste',
  bulky: 'Bulky_waste',
  voluminosos: 'Bulky_waste',

  // Glass Containers / Envases de vidrio
  'envases de vidrio': 'Glass_containers',
  vidrio: 'Glass_containers',
  vidre: 'Glass_containers',
  glass: 'Glass_containers',

  // Coffee Capsules / Cápsulas de café
  'capsulas de cafe': 'Coffee_capsules',
  'cápsulas de café': 'Coffee_capsules',
  capsulas: 'Coffee_capsules',
  'coffee capsules': 'Coffee_capsules',

  // Used Cooking Oil / Aceite de cocina usado
  'aceite de cocina usado': 'Used_cooking_oil',
  'aceite usado': 'Used_cooking_oil',
  aceite: 'Used_cooking_oil',
  'cooking oil': 'Used_cooking_oil',
  oli: 'Used_cooking_oil',

  // Household Construction Waste / Escombros
  escombros: 'Household_construction_waste',
  'construction waste': 'Household_construction_waste',
  obra: 'Household_construction_waste',

  // Community Composting / Compostaje comunitario
  'compostaje comunitario': 'Community_composting',
  compostaje: 'Community_composting',
  composting: 'Community_composting',
  compost: 'Community_composting',
};

/**
 * Normalizes a string for comparison (lowercase, remove accents)
 * @param {string} str - String to normalize
 * @returns {string} Normalized string
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .trim();
}

/**
 * Maps a raw equipment type string to the standardized enum value
 *
 * @param {string} rawType - Raw equipment type from external API
 * @returns {string|null} Enum value (e.g., 'Recycling_center') or null if no match
 */
export function mapEquipmentType(rawType) {
  if (!rawType) {
    log.debug('Empty equipment type received');
    return null;
  }

  const normalized = normalizeString(rawType);

  // Try exact match first
  if (EQUIPMENT_TYPE_PATTERNS[normalized]) {
    return EQUIPMENT_TYPE_PATTERNS[normalized];
  }

  // Try partial match (contains)
  for (const [pattern, enumValue] of Object.entries(EQUIPMENT_TYPE_PATTERNS)) {
    if (normalized.includes(pattern) || pattern.includes(normalized)) {
      log.debug(`Matched '${rawType}' to '${enumValue}' via pattern '${pattern}'`);
      return enumValue;
    }
  }

  // No match found
  log.warn(`No mapping found for equipment type: '${rawType}' (normalized: '${normalized}')`);
  return null;
}

/**
 * Validates if a value is a valid equipment_type enum
 * @param {string} value - Value to validate
 * @returns {boolean} True if valid enum value
 */
export function isValidEquipmentType(value) {
  const validValues = [
    'Recycling_center',
    'Batteries',
    'Medicines_and_packaging',
    'Garden_waste',
    'Clothing_and_footwear',
    'Bulky_waste',
    'Glass_containers',
    'Coffee_capsules',
    'Used_cooking_oil',
    'Household_construction_waste',
    'Community_composting',
  ];
  return validValues.includes(value);
}

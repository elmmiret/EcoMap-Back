import { prisma } from '#lib/prisma.js';

/**
 * Helper function to get field names based on language
 * @param {string} lang - Language code ('es', 'en', 'ca')
 * @returns {object} Field names for the specified language
 */
const getLanguageFields = (lang = 'es') => {
  // Validate and default to Spanish if invalid
  const validLangs = ['es', 'en', 'ca'];
  const language = validLangs.includes(lang) ? lang : 'es';

  return {
    name: `name_${language}`,
    keywords: `keywords_${language}`,
    description: `description_${language}`,
  };
};

/**
 * Transform database result to API response format
 * @param {object} item - Database item with language-specific fields
 * @param {string} lang - Language code
 * @returns {object} Transformed item with generic field names
 */
const transformItem = (item, lang = 'es') => {
  const fields = getLanguageFields(lang);

  return {
    item_id: item.item_id,
    name: item[fields.name],
    keywords: item[fields.keywords],
    container_type: item.container_type,
    description: item[fields.description],
    created_at: item.created_at,
  };
};

/**
 * Busca productos en la guía de reciclaje.
 * @param {string} query - Texto a buscar (ej: "botella")
 * @param {string} lang - Idioma ('es', 'en', 'ca')
 */
export const searchProducts = async (query, lang = 'es') => {
  if (!query) return [];

  const fields = getLanguageFields(lang);
  const searchTerms = query.trim();

  const results = await prisma.recycling_guide_item.findMany({
    where: {
      OR: [
        {
          [fields.name]: {
            contains: searchTerms,
            mode: 'insensitive',
          },
        },
        {
          [fields.keywords]: {
            has: searchTerms.toLowerCase(),
          },
        },
      ],
    },
    take: 20,
    orderBy: {
      [fields.name]: 'asc',
    },
  });

  return results.map((item) => transformItem(item, lang));
};

/**
 * Obtiene todos los productos (ordenados por fecha de creación, más recientes primero)
 * @param {string} lang - Idioma ('es', 'en', 'ca')
 */
export const getAllProducts = async (lang = 'es') => {
  const results = await prisma.recycling_guide_item.findMany({
    orderBy: { created_at: 'desc' },
  });

  return results.map((item) => transformItem(item, lang));
};

/**
 * Crea un nuevo producto (Para un futuro panel de Admin)
 * @param {object} data - Debe incluir name_es, name_en, name_ca, etc.
 */
export const createProduct = async (data) => {
  return prisma.recycling_guide_item.create({
    data: {
      name_es: data.name_es,
      name_en: data.name_en,
      name_ca: data.name_ca,
      keywords_es: data.keywords_es || [],
      keywords_en: data.keywords_en || [],
      keywords_ca: data.keywords_ca || [],
      container_type: data.container_type,
      description_es: data.description_es,
      description_en: data.description_en,
      description_ca: data.description_ca,
    },
  });
};

/**
 * Actualiza un producto existente
 * @param {string} itemId - ID del producto a actualizar
 * @param {object} data - Datos a actualizar (puede incluir campos específicos de idioma)
 */
export const updateProduct = async (itemId, data) => {
  const updateData = {};

  // Map language-specific fields
  if (data.name_es !== undefined) updateData.name_es = data.name_es;
  if (data.name_en !== undefined) updateData.name_en = data.name_en;
  if (data.name_ca !== undefined) updateData.name_ca = data.name_ca;
  if (data.keywords_es !== undefined) updateData.keywords_es = data.keywords_es;
  if (data.keywords_en !== undefined) updateData.keywords_en = data.keywords_en;
  if (data.keywords_ca !== undefined) updateData.keywords_ca = data.keywords_ca;
  if (data.container_type !== undefined) updateData.container_type = data.container_type;
  if (data.description_es !== undefined) updateData.description_es = data.description_es;
  if (data.description_en !== undefined) updateData.description_en = data.description_en;
  if (data.description_ca !== undefined) updateData.description_ca = data.description_ca;

  return prisma.recycling_guide_item.update({
    where: { item_id: itemId },
    data: updateData,
  });
};

/**
 * Elimina un producto
 * @param {string} itemId - ID del producto a eliminar
 */
export const deleteProduct = async (itemId) => {
  return prisma.recycling_guide_item.delete({
    where: { item_id: itemId },
  });
};

/**
 * Elimina todos los productos del catálogo
 */
export const deleteAllProducts = async () => {
  return prisma.recycling_guide_item.deleteMany();
};

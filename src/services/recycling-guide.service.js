import { prisma } from '#lib/prisma.js';

/**
 * Busca productos en la guía de reciclaje.
 * @param {string} query - Texto a buscar (ej: "botella")
 */
export const searchProducts = async (query) => {
  if (!query) return [];

  const searchTerms = query.trim();

  return prisma.recycling_guide_item.findMany({
    where: {
      OR: [
        {
          name: {
            contains: searchTerms,
            mode: 'insensitive',
          },
        },
        {
          keywords: {
            has: searchTerms.toLowerCase(),
          },
        },
      ],
    },
    take: 20,
    orderBy: {
      name: 'asc',
    },
  });
};

/**
 * Obtiene todos los productos (ordenados por fecha de creación, más recientes primero)
 */
export const getAllProducts = async () => {
  return prisma.recycling_guide_item.findMany({
    orderBy: { created_at: 'desc' },
  });
};

/**
 * Crea un nuevo producto (Para un futuro panel de Admin)
 */
export const createProduct = async (data) => {
  return prisma.recycling_guide_item.create({
    data,
  });
};

/**
 * Actualiza un producto existente
 * @param {string} itemId - ID del producto a actualizar
 * @param {object} data - Datos a actualizar
 */
export const updateProduct = async (itemId, data) => {
  return prisma.recycling_guide_item.update({
    where: { item_id: itemId },
    data,
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

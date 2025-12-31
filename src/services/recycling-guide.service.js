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
            mode: 'insensitive' 
          } 
        },
        { 
          keywords: { 
            has: searchTerms.toLowerCase() 
          } 
        }
      ]
    },
    take: 20,
    orderBy: {
      name: 'asc'
    }
  });
};

/**
 * Obtiene todos los productos (útil para un índice A-Z)
 */
export const getAllProducts = async () => {
  return prisma.recycling_guide_item.findMany({
    orderBy: { name: 'asc' }
  });
};

/**
 * Crea un nuevo producto (Para un futuro panel de Admin)
 */
export const createProduct = async (data) => {
  return prisma.recycling_guide_item.create({
    data
  });
};
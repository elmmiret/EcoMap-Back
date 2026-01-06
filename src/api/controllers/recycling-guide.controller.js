import * as guideService from '#services/recycling-guide.service.js';

export const search = async (req, res) => {
  try {
    const { q, lang } = req.query; // ?q=botella&lang=es

    // Default to Spanish if no language specified (backward compatibility)
    const language = lang || 'es';

    if (!q) {
      // Si no hay query, devolvemos todo o una lista vacía según prefieras
      const allItems = await guideService.getAllProducts(language);
      return res.status(200).json({ success: true, data: allItems });
    }

    const results = await guideService.searchProducts(q, language);

    res.status(200).json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error('Error searching recycling guide:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar en la guía de reciclaje.',
    });
  }
};

// Endpoint para obtener todos los productos del catálogo
export const getAllItems = async (req, res) => {
  try {
    const { lang } = req.query; // ?lang=es
    const language = lang || 'es'; // Default to Spanish

    const allItems = await guideService.getAllProducts(language);

    res.status(200).json({
      success: true,
      count: allItems.length,
      data: allItems,
    });
  } catch (error) {
    console.error('Error getting all recycling guide items:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el catálogo de reciclaje.',
    });
  }
};

// Endpoint para añadir ítems (Protegido para admins idealmente)
export const addItem = async (req, res) => {
  try {
    const { 
      name_es, name_en, name_ca,
      containerType, 
      keywords_es, keywords_en, keywords_ca,
      description_es, description_en, description_ca 
    } = req.body;

    // Validación básica - requerir al menos los nombres en los 3 idiomas
    if (!name_es || !name_en || !name_ca || !containerType) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nombres en los 3 idiomas (name_es, name_en, name_ca) y tipo de contenedor son obligatorios' 
      });
    }

    const newItem = await guideService.createProduct({
      name_es,
      name_en,
      name_ca,
      container_type: containerType,
      keywords_es: keywords_es || [],
      keywords_en: keywords_en || [],
      keywords_ca: keywords_ca || [],
      description_es,
      description_en,
      description_ca,
    });

    res.status(201).json({ success: true, data: newItem });
  } catch (error) {
    console.error('Error adding recycling guide item:', error);
    res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

// Endpoint para actualizar un producto existente
export const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name_es, name_en, name_ca,
      containerType, 
      keywords_es, keywords_en, keywords_ca,
      description_es, description_en, description_ca 
    } = req.body;

    // Construir objeto de datos solo con campos proporcionados
    const updateData = {};
    if (name_es !== undefined) updateData.name_es = name_es;
    if (name_en !== undefined) updateData.name_en = name_en;
    if (name_ca !== undefined) updateData.name_ca = name_ca;
    if (containerType !== undefined) updateData.container_type = containerType;
    if (keywords_es !== undefined) updateData.keywords_es = keywords_es;
    if (keywords_en !== undefined) updateData.keywords_en = keywords_en;
    if (keywords_ca !== undefined) updateData.keywords_ca = keywords_ca;
    if (description_es !== undefined) updateData.description_es = description_es;
    if (description_en !== undefined) updateData.description_en = description_en;
    if (description_ca !== undefined) updateData.description_ca = description_ca;

    // Validar que al menos un campo esté presente
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos un campo para actualizar',
      });
    }

    const updatedItem = await guideService.updateProduct(id, updateData);

    res.status(200).json({ success: true, data: updatedItem });
  } catch (error) {
    // Manejo de producto no encontrado (Prisma error P2025)
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado en la guía.',
      });
    }
    console.error('Error updating recycling guide item:', error);
    res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

// Endpoint para eliminar un producto específico
export const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    await guideService.deleteProduct(id);

    res.status(200).json({
      success: true,
      message: 'Producto eliminado correctamente.',
    });
  } catch (error) {
    // Manejo de producto no encontrado (Prisma error P2025)
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado en la guía.',
      });
    }
    console.error('Error deleting recycling guide item:', error);
    res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

// Endpoint para eliminar todos los productos del catálogo
export const deleteAllItems = async (req, res) => {
  try {
    const result = await guideService.deleteAllProducts();

    res.status(200).json({
      success: true,
      message: `${result.count} productos eliminados correctamente.`,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('Error deleting all recycling guide items:', error);
    res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

import * as guideService from '#services/recycling-guide.service.js';

export const search = async (req, res) => {
  try {
    const { q } = req.query; // ?q=botella

    if (!q) {
      // Si no hay query, devolvemos todo o una lista vacía según prefieras
      const allItems = await guideService.getAllProducts();
      return res.status(200).json({ success: true, data: allItems });
    }

    const results = await guideService.searchProducts(q);

    res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });

  } catch (error) {
    console.error('Error searching recycling guide:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar en la guía de reciclaje.'
    });
  }
};

// Endpoint para obtener todos los productos del catálogo
export const getAllItems = async (req, res) => {
  try {
    const allItems = await guideService.getAllProducts();
    
    res.status(200).json({
      success: true,
      count: allItems.length,
      data: allItems
    });
  } catch (error) {
    console.error('Error getting all recycling guide items:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el catálogo de reciclaje.'
    });
  }
};

// Endpoint para añadir ítems (Protegido para admins idealmente)
export const addItem = async (req, res) => {
  try {
    const { name, containerType, keywords, description } = req.body;
    
    // Validación básica
    if (!name || !containerType) {
      return res.status(400).json({ success: false, message: 'Nombre y tipo de contenedor son obligatorios' });
    }

    const newItem = await guideService.createProduct({
      name,
      container_type: containerType,
      keywords: keywords || [],
      description
    });

    res.status(201).json({ success: true, data: newItem });
  } catch (error) {
    // Manejo de duplicados (Prisma error P2002)
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Este producto ya existe en la guía.' });
    }
    res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

// Endpoint para actualizar un producto existente
export const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, containerType, keywords, description } = req.body;

    // Construir objeto de datos solo con campos proporcionados
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (containerType !== undefined) updateData.container_type = containerType;
    if (keywords !== undefined) updateData.keywords = keywords;
    if (description !== undefined) updateData.description = description;

    // Validar que al menos un campo esté presente
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Debe proporcionar al menos un campo para actualizar' 
      });
    }

    const updatedItem = await guideService.updateProduct(id, updateData);

    res.status(200).json({ success: true, data: updatedItem });
  } catch (error) {
    // Manejo de producto no encontrado (Prisma error P2025)
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        success: false, 
        message: 'Producto no encontrado en la guía.' 
      });
    }
    // Manejo de duplicados (Prisma error P2002)
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        success: false, 
        message: 'Ya existe otro producto con ese nombre.' 
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
      message: 'Producto eliminado correctamente.' 
    });
  } catch (error) {
    // Manejo de producto no encontrado (Prisma error P2025)
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        success: false, 
        message: 'Producto no encontrado en la guía.' 
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
      deletedCount: result.count
    });
  } catch (error) {
    console.error('Error deleting all recycling guide items:', error);
    res.status(500).json({ success: false, message: 'Error interno.' });
  }
};
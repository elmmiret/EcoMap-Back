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
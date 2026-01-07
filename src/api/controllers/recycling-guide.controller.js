import * as guideService from '#services/recycling-guide.service.js';
import { uploadToS3, deleteFromS3 } from '#services/storage.service.js';

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
    const { name_es, name_en, name_ca, containerType, keywords_es, keywords_en, keywords_ca, description_es, description_en, description_ca } =
      req.body;
    const imageFile = req.file; // Archivo subido (si existe)

    // Validación básica - requerir al menos los nombres en los 3 idiomas
    if (!name_es || !name_en || !name_ca || !containerType) {
      return res.status(400).json({
        success: false,
        message: 'Nombres en los 3 idiomas (name_es, name_en, name_ca) y tipo de contenedor son obligatorios',
      });
    }

    // Subir imagen a S3 si existe
    let imageUrl = null;
    if (imageFile) {
      try {
        imageUrl = await uploadToS3(imageFile);
      } catch (uploadError) {
        console.error('Error uploading image to S3:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error al subir la imagen.',
          code: 'IMAGE_UPLOAD_ERROR',
        });
      }
    }

    // Parsear arrays si vienen como strings (multipart/form-data)
    const parseArray = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      // Si es un string que parece JSON array, parsearlo
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [value];
        } catch {
          // Si no es JSON, dividir por comas o devolver como array de un elemento
          return value.includes(',') ? value.split(',').map((s) => s.trim()) : [value];
        }
      }
      return [];
    };

    const newItem = await guideService.createProduct({
      name_es,
      name_en,
      name_ca,
      container_type: containerType,
      keywords_es: parseArray(keywords_es),
      keywords_en: parseArray(keywords_en),
      keywords_ca: parseArray(keywords_ca),
      description_es,
      description_en,
      description_ca,
      image_url: imageUrl,
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
    const { name_es, name_en, name_ca, containerType, keywords_es, keywords_en, keywords_ca, description_es, description_en, description_ca } =
      req.body;
    const imageFile = req.file; // Nueva imagen (si existe)

    // Obtener el producto actual para verificar si tiene imagen antigua
    const currentProduct = await guideService.getProductById(id);
    if (!currentProduct) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado en la guía.',
      });
    }

    // Construir objeto de datos solo con campos proporcionados
    const updateData = {};
    if (name_es !== undefined) updateData.name_es = name_es;
    if (name_en !== undefined) updateData.name_en = name_en;
    if (name_ca !== undefined) updateData.name_ca = name_ca;
    if (containerType !== undefined) updateData.container_type = containerType;

    // Parsear arrays si vienen como strings (multipart/form-data)
    const parseArray = (value) => {
      if (!value) return undefined; // No actualizar si no se proporciona
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [value];
        } catch {
          return value.includes(',') ? value.split(',').map((s) => s.trim()) : [value];
        }
      }
      return undefined;
    };

    if (keywords_es !== undefined) updateData.keywords_es = parseArray(keywords_es);
    if (keywords_en !== undefined) updateData.keywords_en = parseArray(keywords_en);
    if (keywords_ca !== undefined) updateData.keywords_ca = parseArray(keywords_ca);
    if (description_es !== undefined) updateData.description_es = description_es;
    if (description_en !== undefined) updateData.description_en = description_en;
    if (description_ca !== undefined) updateData.description_ca = description_ca;

    // Subir nueva imagen a S3 si existe
    if (imageFile) {
      try {
        const newImageUrl = await uploadToS3(imageFile);
        updateData.image_url = newImageUrl;

        // Borrar imagen antigua de S3 si existía
        if (currentProduct.image_url) {
          try {
            await deleteFromS3(currentProduct.image_url);
          } catch (s3Error) {
            console.warn('Advertencia: No se pudo borrar la imagen antigua de S3:', s3Error);
          }
        }
      } catch (uploadError) {
        console.error('Error uploading image to S3:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error al subir la imagen.',
          code: 'IMAGE_UPLOAD_ERROR',
        });
      }
    }

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

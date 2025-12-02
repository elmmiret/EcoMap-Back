import multer from 'multer';

// Configurar multer para guardar el archivo en memoria temporalmente
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite de tamaño de archivo: 5MB (ejemplo)
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png'];

    if(allowedMimeTypes.includes(file.mimetype)) {
      // Aceptar archivo
      cb(null, true);
    }
    else {
      // Rechazar archivo
      cb(new Error('INVALID_FILE_TYPE'), false);

    }
  }
});

// Para devolver un JSON 'bonito', en lugar de un error HTML o crash del servidor
export const uploadImageMiddleware = (req, res, next) => {
  const uploadSingle = upload.single('file');

  uploadSingle(req, res, (err) => {
    if(err instanceof multer.MulterError) {
      // Errores de Multer
      if(err.code == 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'El archivo es demasiado grande. Máximo 5MB.',
          code: 'FILE_TOO_LARGE'
        });
      }
    }
    else if(err) {
      // Errores personalizados
      if(err.message == 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          success: false,
          message: 'Formato de archivo no válido. Solo se permiten JPEG y PNG.',
          code: 'INVALID_FILE_TYPE'   
        });
      }
      return res.status(500).json({
        success: true,
        message: 'Error al procesar el archivo.'
      });
    }
    // Si todo va bien, pasamos al controlador
    next();
  });
};
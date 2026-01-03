import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

// Inicializar cliente S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Sube un archivo a S3 y devuelve la URL pública.
 * @param {Object} file - Objeto file de Multer
 * @returns {Promise<string>} URL del archivo
 */
export const uploadToS3 = async (file) => {
  // Generar nombre único para evitar colisiones (uuid o random bytes)
  const fileExtension = file.originalname.split('.').pop();
  const randomName = crypto.randomBytes(16).toString('hex');
  const fileName = `${randomName}.${fileExtension}`;

  const uploadParams = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: fileName, // El nombre del archivo en S3
    Body: file.buffer, // El contenido del archivo
    ContentType: file.mimetype,
    // ACL: 'public-read', // Descomentar si tu bucket no bloquea ACLs públicas
  };

  await s3Client.send(new PutObjectCommand(uploadParams));

  // Construir y devolver la URL
  // Nota: Esto asume un bucket público. Si es privado, necesitarías generar URLs firmadas.
  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
};

/**
 * Elimina un archivo de S3 dado su URL público
 * @param {string} fileUrl - URL completa de la imagen S3
 */
export const deleteFromS3 = async (fileUrl) => {
  if (!fileUrl) return;

  try {
    // Extraer el nombre del arhivo (key) de la URL
    // Ejemplo URL: https://BUCKET.s3.REGION.amazonaws.com/nombre_archivo.jpg
    const fileKey = fileUrl.split('/').pop();

    const deleteParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey,
    };

    await s3Client.send(new DeleteObjectCommand(deleteParams));
    console.log(`[Storage] Imagen eliminada de S3: ${fileKey}`);
  } catch (error) {
    console.error([`[Storage] Error al eliminar imagen de S3 (${fileUrl}):`, error]);
  }
};

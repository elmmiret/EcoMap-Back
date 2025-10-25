import express from 'express';
import { getNavarraRecyclingPoints } from '../../services/navarra.service.js';
import { getBarcelonaRecyclingPoints } from '../../services/barcelona.service.js';

const router = express.Router();

router.get('/:region', async (req, res) => {
    try {

        const region = req.params;

        // Captura los parametros del query de la solicitud (ej: ?q=vidrio&MUNICIPIO=Pamplona)
        const queryParams = req.query;

        if (region.toLowerCase() === 'navarra') {
            const navarraPoints = await getNavarraRecyclingPoints(queryParams);
            return res.status(200).json({
                success: true,
                message: 'Puntos de reciclaje encontrados en Navarra',
                data: navarraPoints,
            });
        }
    
        if (region.toLowerCase() === 'barcelona') {
            const barcelonaPoints = await getBarcelonaRecyclingPoints(queryParams);
            return res.status(200).json({
                success: true,
                message: 'Puntos de reciclaje encontrados en Barcelona',
                data: barcelonaPoints,
            });
        }
    
        return res.status(404).json({
            success: false,
            message: `Región no encontrada: ${region}`,
            code: 'REGION_NOT_FOUND',
        });

        } catch (error) {
        console.error('❌ Error al obtener puntos por región:', error);
        res.status(500).json({
            success: false,
            message: 'Error al consultar los puntos de reciclaje',
            code: 'RECYCLING_POINTS_ERROR',
        });
        }
  });


export default router;

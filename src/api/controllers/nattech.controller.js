import { prisma } from '#lib/prisma.js';
import * as natTechService from '#services/nattech.service.js';

// funciones públicas

// listar los eventos de EcoMap
export const listEvents = async (req, res) => {
  try {
    const events = await natTechService.getExternalEvents(req.query);
    return res.status(200).json({ success: true, data: events });
  } catch (error) {
    console.error('Error listEvents:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener eventos externos.' });
  }
};

// obtener los eventos individualmente
export const getEvent = async (req, res) => {
  const { codi } = req.params;
  try {
    const event = await natTechService.getExternalEventByCodi(codi);
    if (!event) return res.status(404).json({ success: false, message: 'Evento no encontrado.' });
    return res.status(200).json({ success: true, data: event });
  } catch (error) {
    console.error('Error getEvent:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener el evento.' });
  }
};

// funciones para administradores

// crear un evento de EcoMap
export const createEvent = async (req, res) => {
  try {
    const newEvent = await natTechService.createExternalEvent(req.body);

    return res.status(201).json({
      success: true,
      message: 'Evento creado exitosamente en plataforma externa.',
      data: newEvent,
    });
  } catch (error) {
    console.error('Error createEvent:', error);
    return res.status(500).json({ success: false, message: 'Error interno al crear evento.' });
  }
};

// actualiza un evento de EcoMap
export const updateEvent = async (req, res) => {
  const { codi } = req.params;

  try {
    const updatedEvent = await natTechService.updateExternalEvent(codi, req.body);

    return res.status(200).json({
      success: true,
      message: 'Evento actualizado correctamente.',
      data: updatedEvent,
    });
  } catch (error) {
    console.error('Error updateEvent:', error);
    return res.status(500).json({ success: false, message: 'Error interno al actualizar.' });
  }
};

// borra un evento de EcoMap
export const deleteEvent = async (req, res) => {
  const { codi } = req.params;

  try {
    await natTechService.deleteExternalEvent(codi);

    return res.status(200).json({
      success: true,
      message: 'Evento eliminado correctamente.',
    });
  } catch (error) {
    console.error('Error deleteEvent:', error);
    return res.status(500).json({ success: false, message: 'Error interno al eliminar.' });
  }
};

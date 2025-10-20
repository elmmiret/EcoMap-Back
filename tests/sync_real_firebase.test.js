const request = require('supertest');
const app = require('../server'); // Tu aplicación Express con el Firebase Admin SDK inicializado

// ⚠️ Este token DEBE ser REAL, VÁLIDO y de un USUARIO de PRUEBA.
// Puedes obtenerlo desde el cliente (Flutter, Postman, etc.) después de un login.
const REAL_VALID_FIREBASE_TOKEN = 'o44xZVkDs3Q3e4wWzQEselvDumB3'; 
const INVALID_FIREBASE_TOKEN = 'Token.invalido.12345'; 

// Mocks: Solo mockeamos el controlador de base de datos
const { syncUserToPostgres } = require('../__mocks__/user.controller'); 
jest.mock('../src/api/controllers/user.controller', () => require('../__mocks__/user.controller'));

// No hacemos jest.mock('../src/middleware/auth'), ¡permitiendo que el real se ejecute!

describe('POST /api/users/sync - Integración con Firebase Real', () => {

    const ENDPOINT = '/api/users/sync';

    // ----------------------------------------------------
    // Caso 1: Autenticación Exitosa con Token Válido
    // ----------------------------------------------------
    test('Debería retornar 200 y llamar al controlador con un token Firebase válido', async () => {
        // Ejecutamos la solicitud con el token REAL y VÁLIDO
        const response = await request(app)
            .post(ENDPOINT)
            .set('Authorization', `Bearer ${REAL_VALID_FIREBASE_TOKEN}`) 
            .send({}); 

        // Aserciones
        expect(response.statusCode).toBe(200);
        
        // El controlador mockeado DEBE ser llamado porque la autenticación fue exitosa.
        expect(syncUserToPostgres).toHaveBeenCalled(); 
        
        // Verifica que la respuesta del controlador mockeado es correcta.
        expect(response.body.message).toBe('Usuario sincronizado/existente con éxito.');

        // ⚠️ Si quieres verificar los datos del usuario, tendrías que simular
        // una aserción contra el controlador mockeado.
        // Ejemplo: expect(syncUserToPostgres.mock.calls[0][0].user.uid).toBe('ElUIDDelTokenReal');
    });

    // ----------------------------------------------------
    // Caso 2: Autenticación Fallida con Token Inválido
    // ----------------------------------------------------
    test('Debería retornar 403 con un token Firebase inválido', async () => {
        // Ejecutamos la solicitud con un token obviamente inválido.
        const response = await request(app)
            .post(ENDPOINT)
            .set('Authorization', `Bearer ${INVALID_FIREBASE_TOKEN}`) 
            .send({}); 

        // Aserciones
        // El middleware real de Firebase debería devolver 403 (Prohibido/Inválido)
        expect(response.statusCode).toBe(403);
        
        // El controlador NUNCA DEBE EJECUTARSE
        expect(syncUserToPostgres).not.toHaveBeenCalled(); 
        
        // El mensaje de error debe provenir del middleware de auth (no del controlador).
        expect(response.body.error).toBeDefined();
        expect(response.body.error).toMatch(/Token inválido o expirado/);
    });

    // ----------------------------------------------------
    // Caso 3: Sin Token de Autorización
    // ----------------------------------------------------
    test('Debería retornar 401 si no se proporciona el header de autorización', async () => {
        const response = await request(app)
            .post(ENDPOINT)
            .send({}); 
            
        // Aserciones
        // El middleware de auth debe detectar la falta de header y devolver 401 (No Autorizado)
        expect(response.statusCode).toBe(401); 
        expect(syncUserToPostgres).not.toHaveBeenCalled(); 
        expect(response.body.error).toMatch(/Formato de token inválido o no proporcionado/);
    });
});
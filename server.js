const express = import('express');
const admin = import('firebase-admin');
const authRoutes = import('./src/api/routes/user.routes');

// cargar variables de entorno desde .env
import('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- INICIALIZACION de Firebase Admin SDK ---
const keyPath = process.env.FIREBASE_KEY_PATH;

if (!keyPath) {
    console.error("FATAL ERROR: FIREBASE_KEY_PATH no se encuentra definido en las variables de entorno");
    process.exit(1);
}

try {
    // importar archivo json de la clave de servicio usando la ruta de entorno
    const serviceAccount = import(keyPath);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log(`Firebase Admin SDK inicializado correctamente usando la llave de: ${keyPath}`);

} catch (e) {
    console.error(`FATAL ERROR: No se ha podido cargar la llave de Firebase Service Account de: ${keyPath}`);
    console.error("Detalles:", process.env.NODE_ENV === 'development' ? e.message : 'Error al cargar la clave.');
    process.exit(1);
}

// middleware global
app.use(express.json());
app.use(express.urlencoded({ extended: true}));

// montar las rutas de autentificación bajo el prefijo /api/users
app.use('/api/users', authRoutes);

// ruta base para verificar que la API está corriendo
app.get('/', (req, res) => {
    res.send('API running.');
})

// manejo de errores globales
app.use((err, req, res) => {
    console.error('Error no controlado:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
})

// iniciar el servidor
app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
})
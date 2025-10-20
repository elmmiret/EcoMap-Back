const express = require('express');
const admin = require('firebase-admin');
const authRoutes = require('./src/api/routes/user.routes');

// cargar variables de entorno desde .env
require('dotenv').config();

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
    const serviceAccount = require(keyPath);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log(`Firebase Admin SDK inicializado correctamente usando la llave de: ${keyPath}`);

} catch (e) {
    console.error(`FATAL ERROR: No se ha podido cargar la llave de Firebase Service Account de: ${keyPath}`);
    console.error("Details:", e.message);
    process.exit(1);
}

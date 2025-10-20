const express = require('express');
const admin = require('firebase-admin');
const app = express();

// uso de la variable de entorno para la ruta
const serviceAccountPath = process.env.FIREBASE_KEY_PATH; 

if (serviceAccountPath) {
    const serviceAccount = require(serviceAccountPath); 
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

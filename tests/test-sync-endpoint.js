import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';

dotenv.config();

const execAsync = promisify(exec);

// --- Configuración ---
const API_URL = 'http://localhost:3001/api/users/sync';
const DEFAULT_TEST_UID = 'gRRH4RO8D1W4Yv5bbxd0ib10oxJ2';

// Configuración del cliente de Firebase (debe coincidir con tu proyecto)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// --- Funciones Helper ---

/**
 * Obtiene un ID Token de Firebase para un UID dado.
 * 1. Llama a nuestro script para generar un custom token.
 * 2. Usa el SDK de cliente para intercambiarlo por un ID token.
 */
async function getFirebaseIdToken(uid) {
  console.log(`🔄 Obteniendo token para UID: ${uid}`);

  // 1. Generar Custom Token usando el script
  const { stdout: customTokenOutput } = await execAsync(`npm run token:firebase -- ${uid}`);
  const customToken = customTokenOutput.split('\n').find((line) => !line.startsWith('✅') && !line.startsWith('Custom Token') && line.trim());
  if (!customToken) {
    throw new Error('No se pudo extraer el custom token del script.');
  }
  console.log('  ✅ Custom Token generado.');

  // 2. Intercambiar por ID Token
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const userCredential = await signInWithCustomToken(auth, customToken);
  const idToken = await userCredential.user.getIdToken();
  console.log('  ✅ ID Token obtenido de Firebase.\n');

  return idToken;
}

/**
 * Función principal que ejecuta el test del endpoint.
 */
async function testSyncEndpoint() {
  console.log('🧪 Testeando POST /api/users/sync...\n');

  // --- Parsear argumentos de línea de comandos ---
  const args = process.argv.slice(2);
  const mode = args.find((arg) => arg.startsWith('--')) || '--login';
  const uidArg = args.findIndex((arg) => arg === '--uid');
  const testUID = uidArg !== -1 && args[uidArg + 1] ? args[uidArg + 1] : DEFAULT_TEST_UID;

  let requestBody = {};
  let testDescription = '';

  switch (mode) {
    case '--register-manual':
      testDescription = `REGISTRO MANUAL para UID: ${testUID}`;
      requestBody = {
        name: `Test User ${Date.now()}`,
        email: `test-${testUID}@example.com`,
        username: `testuser_${testUID}`,
      };
      break;
    case '--register-social':
      testDescription = `REGISTRO SOCIAL para UID: ${testUID}`;
      // Para registro social, el body es vacío.
      // Asegúrate de que el UID no exista en tu BD o elimínalo antes.
      break;
    case '--login':
    default:
      testDescription = `INICIO DE SESIÓN para UID: ${testUID}`;
      // Para login, el body es vacío.
      break;
  }

  console.log(`▶️  Ejecutando en modo: ${testDescription}\n`);

  try {
    const idToken = await getFirebaseIdToken(testUID);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined,
    });

    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    console.log(`📡 Status: ${response.status} ${response.statusText}`);
    console.log(`📦 Content-Type: ${contentType}\n`);

    if (isJson) {
      const data = await response.json();
      console.log('✅ Respuesta JSON:', JSON.stringify(data, null, 2));

      if (data.success && data.jwt) {
        console.log('\n🔐 JWT del Backend recibido.');
        const payload = JSON.parse(Buffer.from(data.jwt.split('.')[1], 'base64').toString());
        console.log('\n📋 Payload del JWT del Backend:');
        console.log(JSON.stringify(payload, null, 2));
      }
    } else {
      const text = await response.text();
      console.log('❌ Respuesta NO JSON:', text);
    }
  } catch (error) {
    console.error('💥 Error en el test:', error.message);
    if (!firebaseConfig.apiKey) {
      console.error('\n🚨 Error de configuración: Las variables de entorno de Firebase cliente no están definidas en tu .env');
      console.error('   Asegúrate de tener FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, etc.');
    }
  }
}

testSyncEndpoint();

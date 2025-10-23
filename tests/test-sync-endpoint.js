/**
 * Script para testear el endpoint POST /api/users/sync
 *
 * INSTRUCCIONES:
 * 1. Ejecuta tu app Flutter
 * 2. Obtén el Firebase ID token con:
 *    final token = await FirebaseAuth.instance.currentUser?.getIdToken();
 *    print('Token: $token');
 * 3. Reemplaza FIREBASE_TOKEN_AQUI con el token copiado
 * 4. Ejecuta: node tests/test-sync-endpoint.js
 */

const FIREBASE_TOKEN = 'FIREBASE_TOKEN_AQUI'; // ⬅️ Pega aquí tu token de Firebase
const API_URL = 'http://localhost:3001/api/users/sync';

async function testSyncEndpoint() {
  console.log('🧪 Testeando POST /api/users/sync...\n');

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${FIREBASE_TOKEN}`,
      },
    });

    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    console.log(`📡 Status: ${response.status} ${response.statusText}`);
    console.log(`📦 Content-Type: ${contentType}\n`);

    if (isJson) {
      const data = await response.json();
      console.log('✅ Respuesta JSON:', JSON.stringify(data, null, 2));

      if (data.success && data.jwt) {
        console.log('\n🔐 JWT recibido:');
        console.log(data.jwt);

        // Decodificar el JWT (sin verificar, solo para ver el payload)
        const parts = data.jwt.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          console.log('\n📋 Payload del JWT:');
          console.log(JSON.stringify(payload, null, 2));
        }
      }
    } else {
      const text = await response.text();
      console.log('❌ Respuesta NO JSON:', text);
    }
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testSyncEndpoint();

// src/db.js

// IMPORTANTE: Para usar PostgreSQL real, necesitas instalar: npm install pg
// Luego descomenta el código de abajo y comenta el mock

// ===== CONEXIÓN REAL A POSTGRESQL (DESCOMENTA ESTO) =====
// import pkg from 'pg';
// const { Pool } = pkg;
//
// export const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   // O alternativamente:
//   // host: process.env.PGHOST,
//   // port: process.env.PGPORT,
//   // database: process.env.PGDATABASE,
//   // user: process.env.PGUSER,
//   // password: process.env.PGPASSWORD,
// });
//
// // Test de conexión
// pool.on('connect', () => {
//   console.log('✅ Conectado a PostgreSQL');
// });
//
// pool.on('error', (err) => {
//   console.error('❌ Error en PostgreSQL:', err);
// });

// ===== MOCK PARA DESARROLLO (COMENTAR EN PRODUCCIÓN) =====
console.warn('⚠️  ADVERTENCIA: Usando mock de base de datos. Para usar PostgreSQL real:');
console.warn('   1. Instala: npm install pg');
console.warn('   2. Configura DATABASE_URL en .env');
console.warn('   3. Descomenta el código real en src/db.js');

export const pool = {
  query: async (text, params) => {
    console.log('🔍 Mock DB Query:', text);
    console.log('📦 Params:', params);

    try {
      // Validación básica de parámetros
      if (!Array.isArray(params)) {
        throw new Error('Los parámetros deben ser un arreglo.');
      }

      // Simulación: Si el UID es 'existing-uid', simula que el usuario ya existe
      if (text.includes('SELECT') && params[0] === 'existing-uid') {
        console.log('✅ Mock: Usuario encontrado');
        return { rows: [{ uid: params[0], email: 'test@example.com' }] };
      } else if (text.includes('SELECT')) {
        console.log('✅ Mock: Usuario NO encontrado');
        return { rows: [] }; // Usuario no existe
      } else if (text.includes('INSERT')) {
        console.log('✅ Mock: Usuario insertado (simulado)');
        return { rows: [], rowCount: 1 };
      }

      return { rows: [] };
    } catch (error) {
      // Manejo de errores
      console.error(`❌ Error ejecutando la consulta: ${error.message}`);
      throw error; // Re-lanzar el error para que el llamador lo maneje
    }
  },
};

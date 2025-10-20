// src/db.js

// En un proyecto real, usarías el paquete 'pg' así:
// const { Pool } = require('pg');
// const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const pool = {
    // Simulación de la función pool.query
    query: async (sql, params) => {
      // console.log(`Executing SQL: ${sql} with params: ${params}`);
      
      // Simulación: Si el UID es 'existing-uid', simula que el usuario ya existe
      if (params && params[0] === 'existing-uid') {
          return { rows: [{ uid: params[0] }] }; 
      } else {
          return { rows: [] }; // Usuario no existe
      }
      // Para INSERT, simplemente devuelve un objeto vacío
      return { rows: [] }; 
    }
  };
  
  module.exports = {
      pool
  };
  
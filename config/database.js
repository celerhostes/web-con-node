const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Crear tablas si no existen
const initDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS planes (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        descripcion TEXT,
        precio DECIMAL(10,2) NOT NULL,
        slots_jugadores INT NOT NULL,
        ram INT NOT NULL,
        almacenamiento INT NOT NULL,
        activo BOOLEAN DEFAULT true
      );

      INSERT INTO planes (nombre, descripcion, precio, slots_jugadores, ram, almacenamiento) VALUES
      ('Básico', 'Perfecto para servidores pequeños', 9.99, 10, 2048, 10240),
      ('Avanzado', 'Para comunidades medianas', 19.99, 25, 4096, 20480),
      ('Profesional', 'Servidores enterprise', 39.99, 50, 8192, 40960)
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Base de datos inicializada correctamente');
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
  }
};

module.exports = { pool, initDatabase };
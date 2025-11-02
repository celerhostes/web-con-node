require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const { initDatabase } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));

// API de planes
app.get('/api/planes', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const result = await pool.query('SELECT * FROM planes WHERE activo = true');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching planes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Servir archivos estáticos
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'CelerHost API funcionando' });
});

// Ruta temporal para crear admin - ELIMINAR DESPUÉS DE USAR
app.post('/api/create-admin', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    await pool.query("UPDATE usuarios SET role = 'admin' WHERE id = 1");
    res.json({ message: 'Usuario convertido a administrador' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Inicializar base de datos y servidor
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 CelerHost running on port ${PORT}`);
    console.log(`📊 Sistema de autenticación activo`);
    console.log(`🗄️ Base de datos conectada`);
    console.log(`👑 Panel de administración disponible en /admin`);
  });
});
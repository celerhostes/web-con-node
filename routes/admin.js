const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Obtener estadísticas del sistema
router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    const usersCount = await pool.query('SELECT COUNT(*) FROM usuarios');
    const plansCount = await pool.query('SELECT COUNT(*) FROM planes');
    const activeServers = await pool.query('SELECT COUNT(*) FROM usuarios WHERE role = $1', ['user']);
    
    res.json({
      totalUsers: parseInt(usersCount.rows[0].count),
      totalPlans: parseInt(plansCount.rows[0].count),
      activeServers: parseInt(activeServers.rows[0].count),
      systemUptime: '99.9%',
      revenue: '1,250.00'
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener todos los usuarios
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, email, role, created_at 
      FROM usuarios 
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear usuario administrador
router.post('/users/make-admin', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    
    await pool.query(
      'UPDATE usuarios SET role = $1 WHERE id = $2',
      ['admin', userId]
    );
    
    res.json({ message: 'Usuario actualizado a administrador' });
  } catch (error) {
    console.error('Error making user admin:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar usuario
router.delete('/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener todos los planes
router.get('/plans', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM planes ORDER BY precio');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nuevo plan
router.post('/plans', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { nombre, descripcion, precio, slots_jugadores, ram, almacenamiento } = req.body;
    
    const result = await pool.query(
      `INSERT INTO planes (nombre, descripcion, precio, slots_jugadores, ram, almacenamiento) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, descripcion, precio, slots_jugadores, ram, almacenamiento]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar plan
router.put('/plans/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, precio, slots_jugadores, ram, almacenamiento, activo } = req.body;
    
    const result = await pool.query(
      `UPDATE planes SET nombre=$1, descripcion=$2, precio=$3, slots_jugadores=$4, 
       ram=$5, almacenamiento=$6, activo=$7 WHERE id=$8 RETURNING *`,
      [nombre, descripcion, precio, slots_jugadores, ram, almacenamiento, activo, id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
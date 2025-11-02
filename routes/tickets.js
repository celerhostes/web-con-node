const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Crear nuevo ticket
router.post('/', async (req, res) => {
  try {
    const { asunto, mensaje, categoria = 'general', prioridad = 'media' } = req.body;
    const usuario_id = req.user.id;

    if (!asunto || !mensaje) {
      return res.status(400).json({ error: 'Asunto y mensaje son requeridos' });
    }

    const result = await pool.query(
      `INSERT INTO tickets (usuario_id, asunto, mensaje, categoria, prioridad) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [usuario_id, asunto, mensaje, categoria, prioridad]
    );

    res.status(201).json({
      message: 'Ticket creado exitosamente',
      ticket: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener tickets del usuario (o todos si es admin)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, estado = '', categoria = '' } = req.query;
    const offset = (page - 1) * limit;
    const usuario_id = req.user.id;

    let query, countQuery, queryParams;

    if (req.user.role === 'admin') {
      // Admin ve todos los tickets
      let whereClause = '';
      let paramCount = 0;
      const params = [];

      if (estado) {
        paramCount++;
        whereClause += `WHERE estado = $${paramCount}`;
        params.push(estado);
      }

      if (categoria) {
        paramCount++;
        whereClause += `${whereClause ? ' AND' : 'WHERE'} categoria = $${paramCount}`;
        params.push(categoria);
      }

      query = `
        SELECT t.*, u.username, u.email 
        FROM tickets t 
        JOIN usuarios u ON t.usuario_id = u.id 
        ${whereClause}
        ORDER BY t.created_at DESC 
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      
      countQuery = `SELECT COUNT(*) FROM tickets t ${whereClause}`;
      
      queryParams = [...params, limit, offset];
    } else {
      // Usuario normal solo ve sus tickets
      let whereClause = 'WHERE usuario_id = $1';
      let paramCount = 1;
      const params = [usuario_id];

      if (estado) {
        paramCount++;
        whereClause += ` AND estado = $${paramCount}`;
        params.push(estado);
      }

      if (categoria) {
        paramCount++;
        whereClause += ` AND categoria = $${paramCount}`;
        params.push(categoria);
      }

      query = `
        SELECT * FROM tickets 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      
      countQuery = `SELECT COUNT(*) FROM tickets ${whereClause}`;
      
      queryParams = [...params, limit, offset];
    }

    const [ticketsResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2)) // Remover limit y offset para count
    ]);

    res.json({
      tickets: ticketsResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Error getting tickets:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener un ticket específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.id;

    let ticketQuery;
    if (req.user.role === 'admin') {
      ticketQuery = `
        SELECT t.*, u.username, u.email 
        FROM tickets t 
        JOIN usuarios u ON t.usuario_id = u.id 
        WHERE t.id = $1
      `;
    } else {
      ticketQuery = 'SELECT * FROM tickets WHERE id = $1 AND usuario_id = $2';
    }

    const ticketResult = await pool.query(
      ticketQuery,
      req.user.role === 'admin' ? [id] : [id, usuario_id]
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    // Obtener respuestas del ticket
    const respuestasResult = await pool.query(
      `SELECT tr.*, u.username, u.role 
       FROM ticket_respuestas tr 
       JOIN usuarios u ON tr.usuario_id = u.id 
       WHERE ticket_id = $1 
       ORDER BY tr.created_at ASC`,
      [id]
    );

    res.json({
      ticket: ticketResult.rows[0],
      respuestas: respuestasResult.rows
    });
  } catch (error) {
    console.error('Error getting ticket:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Agregar respuesta a un ticket
router.post('/:id/respuestas', async (req, res) => {
  try {
    const { id } = req.params;
    const { mensaje } = req.body;
    const usuario_id = req.user.id;

    if (!mensaje) {
      return res.status(400).json({ error: 'El mensaje es requerido' });
    }

    // Verificar que el ticket existe y el usuario tiene acceso
    let ticketQuery;
    if (req.user.role === 'admin') {
      ticketQuery = 'SELECT * FROM tickets WHERE id = $1';
    } else {
      ticketQuery = 'SELECT * FROM tickets WHERE id = $1 AND usuario_id = $2';
    }

    const ticketResult = await pool.query(
      ticketQuery,
      req.user.role === 'admin' ? [id] : [id, usuario_id]
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    // Insertar respuesta
    const result = await pool.query(
      `INSERT INTO ticket_respuestas (ticket_id, usuario_id, mensaje, es_admin) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [id, usuario_id, mensaje, req.user.role === 'admin']
    );

    // Actualizar fecha de modificación del ticket
    await pool.query(
      'UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    // Si responde un admin, cambiar estado a "en_proceso" si estaba "abierto"
    if (req.user.role === 'admin' && ticketResult.rows[0].estado === 'abierto') {
      await pool.query(
        'UPDATE tickets SET estado = $1 WHERE id = $2',
        ['en_proceso', id]
      );
    }

    res.status(201).json({
      message: 'Respuesta agregada exitosamente',
      respuesta: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding response:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Cambiar estado de un ticket (solo admin)
router.put('/:id/estado', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!['abierto', 'en_proceso', 'cerrado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const result = await pool.query(
      'UPDATE tickets SET estado = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [estado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    res.json({
      message: 'Estado actualizado exitosamente',
      ticket: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener estadísticas de tickets (solo admin)
router.get('/admin/stats', isAdmin, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        estado,
        COUNT(*) as count
      FROM tickets 
      GROUP BY estado
    `);

    const totalTickets = await pool.query('SELECT COUNT(*) FROM tickets');
    const ticketsHoy = await pool.query(`
      SELECT COUNT(*) FROM tickets 
      WHERE DATE(created_at) = CURRENT_DATE
    `);

    res.json({
      porEstado: stats.rows,
      total: parseInt(totalTickets.rows[0].count),
      hoy: parseInt(ticketsHoy.rows[0].count)
    });
  } catch (error) {
    console.error('Error getting ticket stats:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
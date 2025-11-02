const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Juegos soportados
const supportedGames = {
    'minecraft': { name: 'Minecraft', defaultPort: 25565, icon: 'fas fa-cube' },
    'cs2': { name: 'Counter-Strike 2', defaultPort: 27015, icon: 'fas fa-crosshairs' },
    'gta5': { name: 'GTA V', defaultPort: 30120, icon: 'fas fa-car' },
    'rust': { name: 'Rust', defaultPort: 28015, icon: 'fas fa-hammer' },
    'ark': { name: 'ARK', defaultPort: 7777, icon: 'fas fa-dinosaur' },
    'tf2': { name: 'Team Fortress 2', defaultPort: 27015, icon: 'fas fa-hat-cowboy' }
};

// Obtener todos los servidores del usuario (o todos si es admin)
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 10, estado = '' } = req.query;
        const offset = (page - 1) * limit;
        const usuario_id = req.user.id;

        let query, countQuery, queryParams;

        if (req.user.role === 'admin') {
            // Admin ve todos los servidores
            let whereClause = '';
            let paramCount = 0;
            const params = [];

            if (estado) {
                paramCount++;
                whereClause += `WHERE s.estado = $${paramCount}`;
                params.push(estado);
            }

            query = `
                SELECT s.*, u.username, u.email, p.nombre as plan_nombre, p.ram as plan_ram
                FROM servidores s 
                JOIN usuarios u ON s.usuario_id = u.id 
                JOIN planes p ON s.plan_id = p.id
                ${whereClause}
                ORDER BY s.created_at DESC 
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;
            
            countQuery = `SELECT COUNT(*) FROM servidores s ${whereClause}`;
            
            queryParams = [...params, limit, offset];
        } else {
            // Usuario normal solo ve sus servidores
            let whereClause = 'WHERE usuario_id = $1';
            let paramCount = 1;
            const params = [usuario_id];

            if (estado) {
                paramCount++;
                whereClause += ` AND estado = $${paramCount}`;
                params.push(estado);
            }

            query = `
                SELECT s.*, p.nombre as plan_nombre, p.ram as plan_ram
                FROM servidores s 
                JOIN planes p ON s.plan_id = p.id
                ${whereClause}
                ORDER BY created_at DESC 
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;
            
            countQuery = `SELECT COUNT(*) FROM servidores ${whereClause}`;
            
            queryParams = [...params, limit, offset];
        }

        const [serversResult, countResult] = await Promise.all([
            pool.query(query, queryParams),
            pool.query(countQuery, queryParams.slice(0, -2))
        ]);

        // Enriquecer datos con información del juego
        const servers = serversResult.rows.map(server => ({
            ...server,
            juego_info: supportedGames[server.juego] || { name: server.juego, icon: 'fas fa-server' }
        }));

        res.json({
            servers,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            totalPages: Math.ceil(countResult.rows[0].count / limit),
            supportedGames: Object.entries(supportedGames).map(([key, value]) => ({
                id: key,
                ...value
            }))
        });
    } catch (error) {
        console.error('Error getting servers:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Crear nuevo servidor
router.post('/', async (req, res) => {
    try {
        const { nombre, juego, plan_id } = req.body;
        const usuario_id = req.user.id;

        if (!nombre || !juego || !plan_id) {
            return res.status(400).json({ error: 'Nombre, juego y plan son requeridos' });
        }

        if (!supportedGames[juego]) {
            return res.status(400).json({ error: 'Juego no soportado' });
        }

        // Verificar que el plan existe
        const planResult = await pool.query('SELECT * FROM planes WHERE id = $1', [plan_id]);
        if (planResult.rows.length === 0) {
            return res.status(400).json({ error: 'Plan no válido' });
        }

        const plan = planResult.rows[0];

        // Generar IP y puerto simulados (en producción esto sería real)
        const ip = `192.168.1.${Math.floor(Math.random() * 255)}`;
        const puerto = supportedGames[juego].defaultPort;

        const result = await pool.query(
            `INSERT INTO servidores (usuario_id, plan_id, nombre, juego, ip, puerto, estado, max_players) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             RETURNING *`,
            [usuario_id, plan_id, nombre, juego, ip, puerto, 'instalando', plan.slots_jugadores]
        );

        const server = result.rows[0];

        // Simular proceso de instalación
        setTimeout(async () => {
            await pool.query(
                'UPDATE servidores SET estado = $1 WHERE id = $2',
                ['activo', server.id]
            );
        }, 5000);

        res.status(201).json({
            message: 'Servidor creado exitosamente. Se está instalando...',
            server: {
                ...server,
                juego_info: supportedGames[juego]
            }
        });
    } catch (error) {
        console.error('Error creating server:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener un servidor específico
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const usuario_id = req.user.id;

        let serverQuery;
        if (req.user.role === 'admin') {
            serverQuery = `
                SELECT s.*, u.username, u.email, p.nombre as plan_nombre, p.ram as plan_ram
                FROM servidores s 
                JOIN usuarios u ON s.usuario_id = u.id 
                JOIN planes p ON s.plan_id = p.id
                WHERE s.id = $1
            `;
        } else {
            serverQuery = `
                SELECT s.*, p.nombre as plan_nombre, p.ram as plan_ram
                FROM servidores s 
                JOIN planes p ON s.plan_id = p.id
                WHERE s.id = $1 AND s.usuario_id = $2
            `;
        }

        const serverResult = await pool.query(
            serverQuery,
            req.user.role === 'admin' ? [id] : [id, usuario_id]
        );

        if (serverResult.rows.length === 0) {
            return res.status(404).json({ error: 'Servidor no encontrado' });
        }

        const server = serverResult.rows[0];
        const juego_info = supportedGames[server.juego] || { name: server.juego, icon: 'fas fa-server' };

        // Obtener estadísticas en tiempo real (simuladas)
        const stats = {
            ram_usage: Math.floor(Math.random() * server.plan_ram),
            cpu_usage: Math.floor(Math.random() * 100),
            players_online: Math.floor(Math.random() * server.max_players),
            uptime: Math.floor(Math.random() * 86400) // segundos
        };

        // Obtener acciones recientes
        const actionsResult = await pool.query(
            'SELECT * FROM server_actions WHERE servidor_id = $1 ORDER BY created_at DESC LIMIT 10',
            [id]
        );

        res.json({
            server: { ...server, juego_info },
            stats,
            recent_actions: actionsResult.rows
        });
    } catch (error) {
        console.error('Error getting server:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ejecutar acción en servidor
router.post('/:id/actions', async (req, res) => {
    try {
        const { id } = req.params;
        const { accion } = req.body;
        const usuario_id = req.user.id;

        const validActions = ['start', 'stop', 'restart', 'backup', 'update'];
        if (!validActions.includes(accion)) {
            return res.status(400).json({ error: 'Acción no válida' });
        }

        // Verificar que el servidor existe y el usuario tiene acceso
        let serverQuery;
        if (req.user.role === 'admin') {
            serverQuery = 'SELECT * FROM servidores WHERE id = $1';
        } else {
            serverQuery = 'SELECT * FROM servidores WHERE id = $1 AND usuario_id = $2';
        }

        const serverResult = await pool.query(
            serverQuery,
            req.user.role === 'admin' ? [id] : [id, usuario_id]
        );

        if (serverResult.rows.length === 0) {
            return res.status(404).json({ error: 'Servidor no encontrado' });
        }

        const server = serverResult.rows[0];

        // Registrar la acción
        const actionResult = await pool.query(
            'INSERT INTO server_actions (servidor_id, accion) VALUES ($1, $2) RETURNING *',
            [id, accion]
        );

        // Simular ejecución de la acción
        let nuevoEstado = server.estado;
        let mensaje = '';

        switch (accion) {
            case 'start':
                nuevoEstado = 'activo';
                mensaje = 'Servidor iniciado exitosamente';
                break;
            case 'stop':
                nuevoEstado = 'detenido';
                mensaje = 'Servidor detenido exitosamente';
                break;
            case 'restart':
                nuevoEstado = 'reiniciando';
                mensaje = 'Servidor reiniciándose...';
                // Simular que después de 5 segundos vuelve a activo
                setTimeout(async () => {
                    await pool.query(
                        'UPDATE servidores SET estado = $1 WHERE id = $2',
                        ['activo', id]
                    );
                }, 5000);
                break;
            case 'backup':
                mensaje = 'Backup iniciado...';
                break;
            case 'update':
                mensaje = 'Actualización iniciada...';
                break;
        }

        // Actualizar estado del servidor si corresponde
        if (nuevoEstado !== server.estado) {
            await pool.query(
                'UPDATE servidores SET estado = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [nuevoEstado, id]
            );
        }

        // Actualizar la acción como completada
        await pool.query(
            'UPDATE server_actions SET estado = $1, resultado = $2 WHERE id = $3',
            ['completado', mensaje, actionResult.rows[0].id]
        );

        res.json({
            message: mensaje,
            action: actionResult.rows[0],
            new_status: nuevoEstado
        });
    } catch (error) {
        console.error('Error executing server action:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Eliminar servidor
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const usuario_id = req.user.id;

        let serverQuery;
        if (req.user.role === 'admin') {
            serverQuery = 'SELECT * FROM servidores WHERE id = $1';
        } else {
            serverQuery = 'SELECT * FROM servidores WHERE id = $1 AND usuario_id = $2';
        }

        const serverResult = await pool.query(
            serverQuery,
            req.user.role === 'admin' ? [id] : [id, usuario_id]
        );

        if (serverResult.rows.length === 0) {
            return res.status(404).json({ error: 'Servidor no encontrado' });
        }

        // Eliminar servidor
        await pool.query('DELETE FROM servidores WHERE id = $1', [id]);

        res.json({ message: 'Servidor eliminado exitosamente' });
    } catch (error) {
        console.error('Error deleting server:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Estadísticas de servidores (solo admin)
router.get('/admin/stats', isAdmin, async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                estado,
                COUNT(*) as count
            FROM servidores 
            GROUP BY estado
        `);

        const totalServers = await pool.query('SELECT COUNT(*) FROM servidores');
        const totalRAM = await pool.query(`
            SELECT SUM(p.ram) as total_ram 
            FROM servidores s 
            JOIN planes p ON s.plan_id = p.id 
            WHERE s.estado = 'activo'
        `);

        res.json({
            porEstado: stats.rows,
            total: parseInt(totalServers.rows[0].count),
            totalRAM: parseInt(totalRAM.rows[0].total_ram) || 0
        });
    } catch (error) {
        console.error('Error getting server stats:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
// Estado global del sistema de servidores
let serversState = {
    servers: [],
    games: [],
    plans: [],
    selectedGame: null,
    selectedPlan: null
};

// Elementos del DOM
const elements = {
    loading: document.getElementById('loading'),
    content: document.getElementById('content'),
    notAuth: document.getElementById('notAuth'),
    userInfo: document.getElementById('userInfo'),
    alert: document.getElementById('alert'),
    statsGrid: document.getElementById('statsGrid'),
    serversGrid: document.getElementById('serversGrid'),
    gamesGrid: document.getElementById('gamesGrid'),
    plansGrid: document.getElementById('plansGrid')
};

// Mostrar alerta
function showAlert(message, type = 'success') {
    elements.alert.textContent = message;
    elements.alert.className = `alert ${type}`;
    elements.alert.style.display = 'block';
    
    setTimeout(() => {
        elements.alert.style.display = 'none';
    }, 5000);
}

// Ocultar alerta
function hideAlert() {
    elements.alert.style.display = 'none';
}

// Verificar autenticación
async function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token || !user.id) {
        elements.loading.style.display = 'none';
        elements.notAuth.style.display = 'block';
        return false;
    }

    try {
        const response = await fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.valid) {
            elements.userInfo.textContent = `Hola, ${data.user.username}`;
            
            // Mostrar estadísticas si es admin
            if (data.user.role === 'admin') {
                elements.statsGrid.style.display = 'grid';
                loadServerStats();
            }
            
            return true;
        } else {
            throw new Error('Token inválido');
        }
    } catch (error) {
        console.error('Error:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        elements.loading.style.display = 'none';
        elements.notAuth.style.display = 'block';
        return false;
    }
}

// Cargar estadísticas de servidores (solo admin)
async function loadServerStats() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/servers/admin/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error loading stats');

        const stats = await response.json();

        elements.statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-server"></i>
                </div>
                <div class="stat-number">${stats.total}</div>
                <div class="stat-label">Total Servidores</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-play-circle"></i>
                </div>
                <div class="stat-number">${stats.porEstado.find(s => s.estado === 'activo')?.count || 0}</div>
                <div class="stat-label">Activos</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-memory"></i>
                </div>
                <div class="stat-number">${stats.totalRAM}MB</div>
                <div class="stat-label">RAM Total</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-users"></i>
                </div>
                <div class="stat-number">${stats.porEstado.find(s => s.estado === 'detenido')?.count || 0}</div>
                <div class="stat-label">Detenidos</div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading server stats:', error);
    }
}

// Cargar servidores
async function loadServers() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/servers', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error loading servers');

        const data = await response.json();
        serversState.servers = data.servers;
        serversState.games = data.supportedGames;
        serversState.plans = data.plans || [];

        renderServersGrid();
        
        // Si no hay planes cargados, cargarlos por separado
        if (serversState.plans.length === 0) {
            await loadPlans();
        }
    } catch (error) {
        console.error('Error loading servers:', error);
        showAlert('Error cargando servidores', 'error');
    }
}

// Cargar planes
async function loadPlans() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/planes', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const plans = await response.json();
            serversState.plans = plans;
        }
    } catch (error) {
        console.error('Error loading plans:', error);
    }
}

// Renderizar grid de servidores
function renderServersGrid() {
    if (serversState.servers.length === 0) {
        elements.serversGrid.innerHTML = `
            <div class="no-servers">
                <i class="fas fa-server"></i>
                <h3>No tienes servidores</h3>
                <p>Crea tu primer servidor de juego y comienza a jugar con tus amigos.</p>
                <button class="btn" onclick="openCreateServerModal()">
                    <i class="fas fa-plus"></i> Crear Primer Servidor
                </button>
            </div>
        `;
        return;
    }

    elements.serversGrid.innerHTML = serversState.servers.map(server => `
        <div class="server-card">
            <div class="server-header">
                <div class="server-info">
                    <div class="server-icon">
                        <i class="${server.juego_info?.icon || 'fas fa-server'}"></i>
                    </div>
                    <div class="server-details">
                        <h3>${server.nombre}</h3>
                        <p>${server.juego_info?.name || server.juego} • ${server.plan_nombre}</p>
                    </div>
                </div>
                <div class="server-status ${getStatusClass(server.estado)}">
                    ${getStatusText(server.estado)}
                </div>
            </div>

            <div class="server-stats">
                <div class="stat-item">
                    <div class="stat-value">${server.players_online}/${server.max_players}</div>
                    <div class="stat-label-small">Jugadores</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${server.ram_usage}MB</div>
                    <div class="stat-label-small">RAM Usada</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${(server.ram_usage / server.plan_ram) * 100}%"></div>
                    </div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${server.cpu_usage}%</div>
                    <div class="stat-label-small">CPU</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${server.cpu_usage}%"></div>
                    </div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${formatUptime(server.uptime)}</div>
                    <div class="stat-label-small">Tiempo Activo</div>
                </div>
            </div>

            <div class="server-actions">
                <button class="btn btn-sm" onclick="viewServerDetails(${server.id})">
                    <i class="fas fa-cog"></i> Gestionar
                </button>
                ${server.estado === 'activo' ? `
                    <button class="btn btn-sm btn-outline" onclick="executeServerAction(${server.id}, 'restart')">
                        <i class="fas fa-redo"></i> Reiniciar
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="executeServerAction(${server.id}, 'stop')">
                        <i class="fas fa-stop"></i> Detener
                    </button>
                ` : ''}
                ${server.estado === 'detenido' ? `
                    <button class="btn btn-sm btn-outline" onclick="executeServerAction(${server.id}, 'start')">
                        <i class="fas fa-play"></i> Iniciar
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-outline" onclick="executeServerAction(${server.id}, 'backup')">
                    <i class="fas fa-save"></i> Backup
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteServer(${server.id}, '${server.nombre}')">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `).join('');
}

// Funciones auxiliares
function getStatusClass(estado) {
    const classes = {
        'activo': 'status-active',
        'detenido': 'status-stopped',
        'instalando': 'status-installing',
        'reiniciando': 'status-restarting'
    };
    return classes[estado] || 'status-stopped';
}

function getStatusText(estado) {
    const texts = {
        'activo': 'Activo',
        'detenido': 'Detenido',
        'instalando': 'Instalando',
        'reiniciando': 'Reiniciando'
    };
    return texts[estado] || estado;
}

function formatUptime(seconds) {
    if (!seconds) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Crear nuevo servidor
function openCreateServerModal() {
    serversState.selectedGame = null;
    serversState.selectedPlan = null;
    
    renderGamesGrid();
    renderPlansGrid();
    openModal('createServerModal');
}

// Renderizar grid de juegos
function renderGamesGrid() {
    elements.gamesGrid.innerHTML = serversState.games.map(game => `
        <div class="game-option ${serversState.selectedGame === game.id ? 'selected' : ''}" 
             onclick="selectGame('${game.id}')">
            <div class="game-icon">
                <i class="${game.icon}"></i>
            </div>
            <div class="game-name">${game.name}</div>
        </div>
    `).join('');
}

// Renderizar grid de planes
function renderPlansGrid() {
    elements.plansGrid.innerHTML = serversState.plans.map(plan => `
        <div class="plan-option ${serversState.selectedPlan === plan.id ? 'selected' : ''}" 
             onclick="selectPlan(${plan.id})">
            <div class="plan-name">${plan.nombre}</div>
            <div class="plan-details">
                $${plan.precio}/mes • ${plan.ram}MB RAM<br>
                ${plan.slots_jugadores} jugadores
            </div>
        </div>
    `).join('');
}

// Seleccionar juego
function selectGame(gameId) {
    serversState.selectedGame = gameId;
    renderGamesGrid();
}

// Seleccionar plan
function selectPlan(planId) {
    serversState.selectedPlan = planId;
    renderPlansGrid();
}

// Manejar creación de servidor
document.getElementById('createServerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nombre = document.getElementById('serverName').value;

    if (!serversState.selectedGame) {
        showAlert('Por favor selecciona un juego', 'error');
        return;
    }

    if (!serversState.selectedPlan) {
        showAlert('Por favor selecciona un plan', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/servers', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nombre,
                juego: serversState.selectedGame,
                plan_id: serversState.selectedPlan
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        const result = await response.json();
        showAlert(result.message);
        closeModal('createServerModal');
        document.getElementById('createServerForm').reset();
        loadServers(); // Recargar lista de servidores
    } catch (error) {
        console.error('Error creating server:', error);
        showAlert(error.message, 'error');
    }
});

// Ver detalles del servidor
async function viewServerDetails(serverId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/servers/${serverId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error loading server');

        const data = await response.json();
        renderServerDetails(data);
        openModal('serverDetailsModal');
    } catch (error) {
        console.error('Error viewing server:', error);
        showAlert('Error cargando servidor', 'error');
    }
}

// Renderizar detalles del servidor
function renderServerDetails(data) {
    const { server, stats, recent_actions } = data;
    
    document.getElementById('serverDetailsTitle').textContent = server.nombre;
    
    document.getElementById('serverDetailsContent').innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
            <div>
                <strong>Juego:</strong><br>
                <i class="${server.juego_info.icon}"></i> ${server.juego_info.name}
            </div>
            <div>
                <strong>Plan:</strong><br>
                ${server.plan_nombre}
            </div>
            <div>
                <strong>Estado:</strong><br>
                <span class="server-status ${getStatusClass(server.estado)}">
                    ${getStatusText(server.estado)}
                </span>
            </div>
            <div>
                <strong>IP:</strong><br>
                ${server.ip}:${server.puerto}
            </div>
        </div>

        <h4 style="color: var(--primary); margin-bottom: 1rem;">Estadísticas en Tiempo Real</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
            <div class="stat-item">
                <div class="stat-value">${stats.players_online}/${server.max_players}</div>
                <div class="stat-label-small">Jugadores</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.ram_usage}MB</div>
                <div class="stat-label-small">RAM</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(stats.ram_usage / server.plan_ram) * 100}%"></div>
                </div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.cpu_usage}%</div>
                <div class="stat-label-small">CPU</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${stats.cpu_usage}%"></div>
                </div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${formatUptime(stats.uptime)}</div>
                <div class="stat-label-small">Uptime</div>
            </div>
        </div>

        <h4 style="color: var(--primary); margin-bottom: 1rem;">Acciones Rápidas</h4>
        <div style="display: flex; gap: 0.5rem; margin-bottom: 2rem; flex-wrap: wrap;">
            ${server.estado === 'activo' ? `
                <button class="btn btn-sm" onclick="executeServerAction(${server.id}, 'restart')">
                    <i class="fas fa-redo"></i> Reiniciar
                </button>
                <button class="btn btn-sm btn-danger" onclick="executeServerAction(${server.id}, 'stop')">
                    <i class="fas fa-stop"></i> Detener
                </button>
            ` : ''}
            ${server.estado === 'detenido' ? `
                <button class="btn btn-sm" onclick="executeServerAction(${server.id}, 'start')">
                    <i class="fas fa-play"></i> Iniciar
                </button>
            ` : ''}
            <button class="btn btn-sm btn-outline" onclick="executeServerAction(${server.id}, 'backup')">
                <i class="fas fa-save"></i> Backup
            </button>
            <button class="btn btn-sm btn-outline" onclick="executeServerAction(${server.id}, 'update')">
                <i class="fas fa-sync"></i> Actualizar
            </button>
        </div>

        ${recent_actions.length > 0 ? `
            <h4 style="color: var(--primary); margin-bottom: 1rem;">Acciones Recientes</h4>
            <div style="max-height: 200px; overflow-y: auto;">
                ${recent_actions.map(action => `
                    <div style="padding: 0.5rem; border-bottom: 1px solid #333; font-size: 0.9rem;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--text);">${action.accion}</span>
                            <span style="color: var(--text-light);">${new Date(action.created_at).toLocaleString()}</span>
                        </div>
                        <div style="color: var(--text-light); font-size: 0.8rem;">
                            Estado: ${action.estado}${action.resultado ? ` • ${action.resultado}` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
}

// Ejecutar acción en servidor
async function executeServerAction(serverId, action) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/servers/${serverId}/actions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ accion: action })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        const result = await response.json();
        showAlert(result.message);
        
        // Recargar servidores después de un breve delay
        setTimeout(() => {
            loadServers();
            closeModal('serverDetailsModal');
        }, 2000);
    } catch (error) {
        console.error('Error executing server action:', error);
        showAlert(error.message, 'error');
    }
}

// Eliminar servidor
async function deleteServer(serverId, serverName) {
    if (!confirm(`¿Estás seguro de que quieres eliminar el servidor "${serverName}"? Esta acción no se puede deshacer.`)) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/servers/${serverId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        const result = await response.json();
        showAlert(result.message);
        loadServers(); // Recargar lista de servidores
    } catch (error) {
        console.error('Error deleting server:', error);
        showAlert(error.message, 'error');
    }
}

// Cerrar sesión
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Inicializar sistema de servidores
async function initServersSystem() {
    const hasAccess = await checkAuth();
    
    if (hasAccess) {
        await loadServers();
        elements.loading.style.display = 'none';
        elements.content.style.display = 'block';
    }
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initServersSystem);
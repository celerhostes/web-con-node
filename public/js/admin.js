// Estado global de la aplicación
let adminState = {
    currentTab: 'users',
    currentPage: 1,
    users: [],
    plans: [],
    stats: {},
    searchTerm: ''
};

// Elementos del DOM
const elements = {
    loading: document.getElementById('loading'),
    content: document.getElementById('content'),
    notAdmin: document.getElementById('notAdmin'),
    userInfo: document.getElementById('userInfo'),
    alert: document.getElementById('alert'),
    statsGrid: document.getElementById('statsGrid')
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

// Verificar autenticación y permisos de admin
async function checkAdminAccess() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token || !user.id) {
        window.location.href = '/login';
        return false;
    }

    try {
        const response = await fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.valid && data.user.role === 'admin') {
            elements.userInfo.textContent = `Admin: ${data.user.username}`;
            return true;
        } else {
            throw new Error('No admin privileges');
        }
    } catch (error) {
        elements.loading.style.display = 'none';
        elements.notAdmin.style.display = 'block';
        return false;
    }
}

// Cargar estadísticas del sistema
async function loadStats() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error loading stats');

        const stats = await response.json();
        adminState.stats = stats;

        // Actualizar UI de estadísticas
        elements.statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-users"></i>
                </div>
                <div class="stat-number">${stats.totalUsers}</div>
                <div class="stat-label">Usuarios Totales</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-cube"></i>
                </div>
                <div class="stat-number">${stats.totalPlans}</div>
                <div class="stat-label">Planes Activos</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-server"></i>
                </div>
                <div class="stat-number">${stats.activeServers}</div>
                <div class="stat-label">Servidores Activos</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-ticket-alt"></i>
                </div>
                <div class="stat-number">${stats.openTickets}</div>
                <div class="stat-label">Tickets Abiertos</div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading stats:', error);
        showAlert('Error cargando estadísticas', 'error');
    }
}

// Cargar usuarios
async function loadUsers(page = 1) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/users?page=${page}&limit=10&search=${adminState.searchTerm}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error loading users');

        const data = await response.json();
        adminState.users = data;
        adminState.currentPage = page;

        renderUsersTable();
    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('Error cargando usuarios', 'error');
    }
}

// Renderizar tabla de usuarios
function renderUsersTable() {
    const usersTab = document.getElementById('usersTab');
    
    usersTab.innerHTML = `
        <div class="search-box">
            <input type="text" 
                   class="search-input" 
                   placeholder="Buscar usuarios..." 
                   value="${adminState.searchTerm}"
                   onkeyup="handleUserSearch(event)">
            <button class="btn" onclick="loadUsers(1)">
                <i class="fas fa-search"></i> Buscar
            </button>
        </div>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Usuario</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Fecha Registro</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${adminState.users.users.map(user => `
                        <tr>
                            <td>${user.id}</td>
                            <td>${user.username}</td>
                            <td>${user.email}</td>
                            <td>
                                <span class="badge ${user.role === 'admin' ? 'badge-success' : 'badge-warning'}">
                                    ${user.role}
                                </span>
                            </td>
                            <td>${new Date(user.created_at).toLocaleDateString()}</td>
                            <td>
                                <button class="btn btn-sm" onclick="openEditUserModal(${user.id}, '${user.role}')">
                                    <i class="fas fa-edit"></i> Editar
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id}, '${user.username}')">
                                    <i class="fas fa-trash"></i> Eliminar
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        ${renderPagination('users')}
    `;
}

// Manejar búsqueda de usuarios
function handleUserSearch(event) {
    if (event.key === 'Enter') {
        adminState.searchTerm = event.target.value;
        loadUsers(1);
    }
}

// Renderizar paginación
function renderPagination(type) {
    const data = adminState[type];
    if (!data || data.totalPages <= 1) return '';

    return `
        <div class="pagination">
            <button class="pagination-btn" 
                    onclick="loadUsers(${data.page - 1})" 
                    ${data.page <= 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> Anterior
            </button>
            
            <span style="color: var(--text-light);">
                Página ${data.page} de ${data.totalPages}
            </span>
            
            <button class="pagination-btn" 
                    onclick="loadUsers(${data.page + 1})" 
                    ${data.page >= data.totalPages ? 'disabled' : ''}>
                Siguiente <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;
}

// Cargar planes
async function loadPlans() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/plans', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error loading plans');

        const plans = await response.json();
        adminState.plans = plans;

        renderPlansTable();
    } catch (error) {
        console.error('Error loading plans:', error);
        showAlert('Error cargando planes', 'error');
    }
}

// Renderizar tabla de planes
function renderPlansTable() {
    const plansTab = document.getElementById('plansTab');
    
    plansTab.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="color: var(--primary);">Gestión de Planes</h3>
            <button class="btn" onclick="openCreatePlanModal()">
                <i class="fas fa-plus"></i> Nuevo Plan
            </button>
        </div>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Precio</th>
                        <th>Slots</th>
                        <th>RAM</th>
                        <th>Almacenamiento</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${adminState.plans.map(plan => `
                        <tr>
                            <td>${plan.id}</td>
                            <td>${plan.nombre}</td>
                            <td>$${plan.precio}</td>
                            <td>${plan.slots_jugadores}</td>
                            <td>${plan.ram}MB</td>
                            <td>${plan.almacenamiento}MB</td>
                            <td>
                                <span class="badge ${plan.activo ? 'badge-success' : 'badge-error'}">
                                    ${plan.activo ? 'Activo' : 'Inactivo'}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-sm" onclick="openEditPlanModal(${plan.id})">
                                    <i class="fas fa-edit"></i> Editar
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Mostrar/ocultar tabs
function showTab(tabName) {
    // Actualizar tabs activos
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Activar tab seleccionado
    event.target.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    adminState.currentTab = tabName;

    // Cargar datos según el tab
    switch(tabName) {
        case 'users':
            loadUsers();
            break;
        case 'plans':
            loadPlans();
            break;
        case 'servers':
            // Por implementar
            break;
        case 'tickets':
            // Por implementar
            break;
    }
}

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Editar usuario
function openEditUserModal(userId, currentRole) {
    document.getElementById('editUserId').value = userId;
    document.getElementById('editUserRole').value = currentRole;
    openModal('editUserModal');
}

// Manejar edición de usuario
document.getElementById('editUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userId = document.getElementById('editUserId').value;
    const newRole = document.getElementById('editUserRole').value;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: newRole })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        const result = await response.json();
        showAlert(result.message);
        closeModal('editUserModal');
        loadUsers(adminState.currentPage); // Recargar usuarios
    } catch (error) {
        console.error('Error updating user:', error);
        showAlert(error.message, 'error');
    }
});

// Eliminar usuario
async function deleteUser(userId, username) {
    if (!confirm(`¿Estás seguro de que quieres eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/users/${userId}`, {
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
        loadUsers(adminState.currentPage); // Recargar usuarios
    } catch (error) {
        console.error('Error deleting user:', error);
        showAlert(error.message, 'error');
    }
}

// Crear nuevo plan (función básica - se expandirá)
function openCreatePlanModal() {
    alert('🚀 Función "Crear Plan" - En desarrollo');
}

// Editar plan (función básica - se expandirá)
function openEditPlanModal(planId) {
    alert(`⚙️ Función "Editar Plan" - En desarrollo (Plan ID: ${planId})`);
}

// Cerrar sesión
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Inicializar panel de administración
async function initAdminPanel() {
    const hasAccess = await checkAdminAccess();
    
    if (hasAccess) {
        // Cargar datos iniciales
        await Promise.all([
            loadStats(),
            loadUsers(),
            loadPlans()
        ]);

        // Mostrar contenido
        elements.loading.style.display = 'none';
        elements.content.style.display = 'block';
    }
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initAdminPanel);
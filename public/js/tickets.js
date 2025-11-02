// Estado global del sistema de tickets
let ticketsState = {
    currentTab: 'tickets',
    currentPage: 1,
    tickets: [],
    currentTicket: null,
    filters: {
        estado: '',
        categoria: ''
    }
};

// Elementos del DOM
const elements = {
    loading: document.getElementById('loading'),
    content: document.getElementById('content'),
    notAuth: document.getElementById('notAuth'),
    userInfo: document.getElementById('userInfo'),
    alert: document.getElementById('alert'),
    statsGrid: document.getElementById('statsGrid'),
    createTab: document.getElementById('createTab')
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
                loadTicketStats();
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

// Cargar estadísticas de tickets (solo admin)
async function loadTicketStats() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/tickets/admin/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error loading stats');

        const stats = await response.json();

        elements.statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-ticket-alt"></i>
                </div>
                <div class="stat-number">${stats.total}</div>
                <div class="stat-label">Total Tickets</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-plus-circle"></i>
                </div>
                <div class="stat-number">${stats.hoy}</div>
                <div class="stat-label">Tickets Hoy</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="stat-number">${stats.porEstado.find(s => s.estado === 'abierto')?.count || 0}</div>
                <div class="stat-label">Abiertos</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="stat-number">${stats.porEstado.find(s => s.estado === 'cerrado')?.count || 0}</div>
                <div class="stat-label">Cerrados</div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading ticket stats:', error);
    }
}

// Cargar tickets
async function loadTickets(page = 1) {
    try {
        const token = localStorage.getItem('token');
        const queryParams = new URLSearchParams({
            page: page,
            limit: 10,
            ...ticketsState.filters
        }).toString();

        const response = await fetch(`/api/tickets?${queryParams}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error loading tickets');

        const data = await response.json();
        ticketsState.tickets = data;
        ticketsState.currentPage = page;

        renderTicketsTable();
    } catch (error) {
        console.error('Error loading tickets:', error);
        showAlert('Error cargando tickets', 'error');
    }
}

// Renderizar tabla de tickets
function renderTicketsTable() {
    const ticketsTab = document.getElementById('ticketsTab');
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';

    ticketsTab.innerHTML = `
        <div class="search-filters">
            <select class="filter-select" onchange="updateFilter('estado', this.value)">
                <option value="">Todos los estados</option>
                <option value="abierto" ${ticketsState.filters.estado === 'abierto' ? 'selected' : ''}>Abierto</option>
                <option value="en_proceso" ${ticketsState.filters.estado === 'en_proceso' ? 'selected' : ''}>En Proceso</option>
                <option value="cerrado" ${ticketsState.filters.estado === 'cerrado' ? 'selected' : ''}>Cerrado</option>
            </select>
            
            <select class="filter-select" onchange="updateFilter('categoria', this.value)">
                <option value="">Todas las categorías</option>
                <option value="general" ${ticketsState.filters.categoria === 'general' ? 'selected' : ''}>General</option>
                <option value="tecnico" ${ticketsState.filters.categoria === 'tecnico' ? 'selected' : ''}>Técnico</option>
                <option value="facturacion" ${ticketsState.filters.categoria === 'facturacion' ? 'selected' : ''}>Facturación</option>
                <option value="servidor" ${ticketsState.filters.categoria === 'servidor' ? 'selected' : ''}>Servidor</option>
                <option value="cuenta" ${ticketsState.filters.categoria === 'cuenta' ? 'selected' : ''}>Cuenta</option>
            </select>
            
            <button class="btn" onclick="loadTickets(1)">
                <i class="fas fa-filter"></i> Filtrar
            </button>
        </div>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        ${isAdmin ? '<th>Usuario</th>' : ''}
                        <th>ID</th>
                        <th>Asunto</th>
                        <th>Categoría</th>
                        <th>Prioridad</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${ticketsState.tickets.tickets.map(ticket => `
                        <tr>
                            ${isAdmin ? `<td>${ticket.username || ticket.email}</td>` : ''}
                            <td>#${ticket.id}</td>
                            <td>${ticket.asunto}</td>
                            <td>
                                <span class="badge badge-info">
                                    ${getCategoriaLabel(ticket.categoria)}
                                </span>
                            </td>
                            <td>
                                <span class="badge ${getPrioridadBadge(ticket.prioridad)}">
                                    ${getPrioridadLabel(ticket.prioridad)}
                                </span>
                            </td>
                            <td>
                                <span class="badge ${getEstadoBadge(ticket.estado)}">
                                    ${getEstadoLabel(ticket.estado)}
                                </span>
                            </td>
                            <td>${new Date(ticket.created_at).toLocaleDateString()}</td>
                            <td>
                                <button class="btn btn-sm" onclick="viewTicket(${ticket.id})">
                                    <i class="fas fa-eye"></i> Ver
                                </button>
                                ${isAdmin ? `
                                    <button class="btn btn-sm btn-outline" onclick="changeTicketStatus(${ticket.id}, '${ticket.estado}')">
                                        <i class="fas fa-edit"></i> Estado
                                    </button>
                                ` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        ${renderPagination()}
    `;
}

// Funciones auxiliares para labels y badges
function getCategoriaLabel(categoria) {
    const categorias = {
        'general': 'General',
        'tecnico': 'Técnico',
        'facturacion': 'Facturación',
        'servidor': 'Servidor',
        'cuenta': 'Cuenta'
    };
    return categorias[categoria] || categoria;
}

function getPrioridadLabel(prioridad) {
    const prioridades = {
        'baja': 'Baja',
        'media': 'Media',
        'alta': 'Alta',
        'urgente': 'Urgente'
    };
    return prioridades[prioridad] || prioridad;
}

function getPrioridadBadge(prioridad) {
    const badges = {
        'baja': 'badge-info',
        'media': 'badge-warning',
        'alta': 'badge-error',
        'urgente': 'badge-error'
    };
    return badges[prioridad] || 'badge-info';
}

function getEstadoLabel(estado) {
    const estados = {
        'abierto': 'Abierto',
        'en_proceso': 'En Proceso',
        'cerrado': 'Cerrado'
    };
    return estados[estado] || estado;
}

function getEstadoBadge(estado) {
    const badges = {
        'abierto': 'badge-warning',
        'en_proceso': 'badge-info',
        'cerrado': 'badge-success'
    };
    return badges[estado] || 'badge-info';
}

// Actualizar filtros
function updateFilter(type, value) {
    ticketsState.filters[type] = value;
}

// Renderizar paginación
function renderPagination() {
    const data = ticketsState.tickets;
    if (!data || data.totalPages <= 1) return '';

    return `
        <div class="pagination">
            <button class="pagination-btn" 
                    onclick="loadTickets(${data.page - 1})" 
                    ${data.page <= 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> Anterior
            </button>
            
            <span style="color: var(--text-light);">
                Página ${data.page} de ${data.totalPages} (${data.total} tickets)
            </span>
            
            <button class="pagination-btn" 
                    onclick="loadTickets(${data.page + 1})" 
                    ${data.page >= data.totalPages ? 'disabled' : ''}>
                Siguiente <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;
}

// Mostrar/ocultar tabs
function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    event.target.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    ticketsState.currentTab = tabName;

    if (tabName === 'tickets') {
        loadTickets();
    }
}

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Crear nuevo ticket
function openCreateTicketModal() {
    openModal('createTicketModal');
}

// Manejar creación de ticket
document.getElementById('createTicketForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const asunto = document.getElementById('ticketAsunto').value;
    const categoria = document.getElementById('ticketCategoria').value;
    const prioridad = document.getElementById('ticketPrioridad').value;
    const mensaje = document.getElementById('ticketMensaje').value;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/tickets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ asunto, categoria, prioridad, mensaje })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        const result = await response.json();
        showAlert('Ticket creado exitosamente');
        closeModal('createTicketModal');
        document.getElementById('createTicketForm').reset();
        loadTickets(1); // Recargar lista de tickets
    } catch (error) {
        console.error('Error creating ticket:', error);
        showAlert(error.message, 'error');
    }
});

// Ver ticket
async function viewTicket(ticketId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/tickets/${ticketId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error loading ticket');

        const data = await response.json();
        ticketsState.currentTicket = data;

        renderTicketView();
        openModal('viewTicketModal');
    } catch (error) {
        console.error('Error viewing ticket:', error);
        showAlert('Error cargando ticket', 'error');
    }
}

// Renderizar vista de ticket
function renderTicketView() {
    const { ticket, respuestas } = ticketsState.currentTicket;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';

    document.getElementById('viewTicketTitle').textContent = `Ticket #${ticket.id}: ${ticket.asunto}`;
    
    document.getElementById('viewTicketContent').innerHTML = `
        <div class="ticket-info">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <div>
                    <strong>Categoría:</strong>
                    <span class="badge badge-info">${getCategoriaLabel(ticket.categoria)}</span>
                </div>
                <div>
                    <strong>Prioridad:</strong>
                    <span class="badge ${getPrioridadBadge(ticket.prioridad)}">${getPrioridadLabel(ticket.prioridad)}</span>
                </div>
                <div>
                    <strong>Estado:</strong>
                    <span class="badge ${getEstadoBadge(ticket.estado)}">${getEstadoLabel(ticket.estado)}</span>
                </div>
                <div>
                    <strong>Fecha:</strong>
                    ${new Date(ticket.created_at).toLocaleString()}
                </div>
            </div>
            
            ${isAdmin && ticket.username ? `
                <div style="margin-bottom: 1rem;">
                    <strong>Usuario:</strong> ${ticket.username} (${ticket.email})
                </div>
            ` : ''}
            
            <div class="message user">
                <div class="message-header">
                    <span class="message-user user">${ticket.username || 'Tú'}</span>
                    <span class="message-time">${new Date(ticket.created_at).toLocaleString()}</span>
                </div>
                <div class="message-content">${ticket.mensaje}</div>
            </div>
        </div>
        
        <div class="ticket-conversation">
            <h4 style="color: var(--primary); margin-bottom: 1rem;">Conversación</h4>
            
            ${respuestas.map(respuesta => `
                <div class="message ${respuesta.es_admin ? 'admin' : 'user'}">
                    <div class="message-header">
                        <span class="message-user ${respuesta.es_admin ? 'admin' : 'user'}">
                            ${respuesta.es_admin ? 'Soporte' : (respuesta.username || 'Tú')}
                            ${respuesta.es_admin ? ' <i class="fas fa-shield-alt"></i>' : ''}
                        </span>
                        <span class="message-time">${new Date(respuesta.created_at).toLocaleString()}</span>
                    </div>
                    <div class="message-content">${respuesta.mensaje}</div>
                </div>
            `).join('')}
            
            ${ticket.estado !== 'cerrado' ? `
                <div style="margin-top: 2rem;">
                    <form id="replyForm">
                        <div class="form-group">
                            <label class="form-label">Responder:</label>
                            <textarea class="form-textarea" id="replyMessage" required placeholder="Escribe tu respuesta..."></textarea>
                        </div>
                        <button type="submit" class="btn">
                            <i class="fas fa-reply"></i> Enviar Respuesta
                        </button>
                    </form>
                </div>
            ` : `
                <div class="alert info">
                    <i class="fas fa-info-circle"></i> Este ticket está cerrado y no acepta nuevas respuestas.
                </div>
            `}
        </div>
    `;

    // Manejar envío de respuesta
    const replyForm = document.getElementById('replyForm');
    if (replyForm) {
        replyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await sendReply(ticket.id);
        });
    }
}

// Enviar respuesta
async function sendReply(ticketId) {
    const mensaje = document.getElementById('replyMessage').value;

    if (!mensaje.trim()) {
        showAlert('El mensaje no puede estar vacío', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/tickets/${ticketId}/respuestas`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mensaje })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        document.getElementById('replyMessage').value = '';
        showAlert('Respuesta enviada exitosamente');
        
        // Recargar la vista del ticket
        await viewTicket(ticketId);
    } catch (error) {
        console.error('Error sending reply:', error);
        showAlert(error.message, 'error');
    }
}

// Cambiar estado del ticket (solo admin)
async function changeTicketStatus(ticketId, currentStatus) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'admin') return;

    const nuevosEstados = {
        'abierto': 'en_proceso',
        'en_proceso': 'cerrado',
        'cerrado': 'abierto'
    };

    const nuevoEstado = nuevosEstados[currentStatus] || 'abierto';

    if (!confirm(`¿Cambiar estado del ticket #${ticketId} de "${getEstadoLabel(currentStatus)}" a "${getEstadoLabel(nuevoEstado)}"?`)) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/tickets/${ticketId}/estado`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ estado: nuevoEstado })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        showAlert('Estado del ticket actualizado');
        loadTickets(ticketsState.currentPage); // Recargar lista
        
        // Si estamos viendo el ticket, recargarlo
        if (ticketsState.currentTicket && ticketsState.currentTicket.ticket.id === ticketId) {
            await viewTicket(ticketId);
        }
    } catch (error) {
        console.error('Error updating ticket status:', error);
        showAlert(error.message, 'error');
    }
}

// Cerrar sesión
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Inicializar sistema de tickets
async function initTicketsSystem() {
    const hasAccess = await checkAuth();
    
    if (hasAccess) {
        await loadTickets();
        elements.loading.style.display = 'none';
        elements.content.style.display = 'block';
    }
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initTicketsSystem);
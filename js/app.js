// url de la api, dependiendo de si estamos en local o en produccion
const API = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : window.location.origin + '/api';

// variables globales de la app
let usuario = {};
let registrosPeso = [];
let planActual = 'nutricion';
let chartInstance = null;

// muestra la pantalla que le pasamos y oculta las demas
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

// navegacion entre tabs, con logica extra para tienda y perfil
function showTab(tab) {
  showScreen(tab);
  if (tab === 'tienda') {
    renderProductos();
    document.getElementById('nav-nombre4').textContent = usuario.nombre || '—';
  }
  if (tab === 'perfil') abrirPerfil();
}

// registro de nuevo usuario, recoge los datos del formulario y los manda al servidor
async function registrar() {
  const nombre   = document.getElementById('reg-nombre').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  if (!nombre || !email || !password) {
    mostrarError('reg-error', 'Rellena todos los campos obligatorios.');
    return;
  }

  const datos = {
    nombre, email, password,
    edad:          document.getElementById('reg-edad').value,
    sexo:          document.getElementById('reg-sexo').value,
    peso:          document.getElementById('reg-peso').value,
    altura:        document.getElementById('reg-altura').value,
    actividad:     document.getElementById('reg-actividad').value,
    objetivo:      document.getElementById('reg-objetivo').value,
    restricciones: document.getElementById('reg-restricciones').value,
  };

  try {
    const res  = await fetch(`${API}/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    const data = await res.json();
    if (!res.ok) { mostrarError('reg-error', data.error); return; }
    usuario = data.usuario || data;
    // guardamos el token jwt para las siguientes peticiones
    if (data.token) localStorage.setItem('nutrigues-token', data.token);
    guardarSesion();
    await cargarPesos();
    await cargarPlanes();
    cargarDashboard();
    showScreen('dashboard');
  } catch (err) {
    mostrarError('reg-error', 'Error de conexión con el servidor.');
  }
}

// login: manda email y password, recibe el token y los datos del usuario
async function login() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) { mostrarError('login-error', 'Introduce email y contraseña.'); return; }

  try {
    const res  = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { mostrarError('login-error', data.error); return; }
    usuario = data.usuario;
    localStorage.setItem('nutrigues-token', data.token);
    guardarSesion();
    await cargarPesos();
    await cargarPlanes();
    cargarDashboard();
    showScreen('dashboard');
  } catch (err) {
    mostrarError('login-error', 'Error de conexión con el servidor.');
  }
}

// limpia todo y vuelve al inicio
function cerrarSesion() {
  usuario = {};
  registrosPeso = [];
  localStorage.removeItem('nutrigues-sesion');
  localStorage.removeItem('nutrigues-token');
  showScreen('landing');
}

// guarda solo el id y nombre en localStorage para recuperar la sesion al recargar
function guardarSesion() {
  localStorage.setItem('nutrigues-sesion', JSON.stringify({ id: usuario.id, nombre: usuario.nombre }));
}

// devuelve el token guardado o string vacio si no hay
function getToken() {
  return localStorage.getItem('nutrigues-token') || '';
}

// cabeceras con el token jwt para las peticiones protegidas
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + getToken()
  };
}

// rellena el dashboard con los datos del usuario logueado
function cargarDashboard() {
  document.getElementById('dash-nombre').textContent   = usuario.nombre;
  document.getElementById('nav-nombre').textContent    = usuario.nombre;
  document.getElementById('nav-nombre2').textContent   = usuario.nombre;
  document.getElementById('nav-nombre3').textContent   = usuario.nombre;
  document.getElementById('dash-peso').textContent     = usuario.peso   || '—';
  document.getElementById('dash-altura').textContent   = usuario.altura || '—';
  document.getElementById('dash-objetivo').textContent = usuario.objetivo || '—';

  // calculo del imc: peso / altura^2
  if (usuario.peso && usuario.altura) {
    const imc = (usuario.peso / Math.pow(usuario.altura / 100, 2)).toFixed(1);
    document.getElementById('dash-imc').textContent = imc;
  }

  document.getElementById('track-fecha').value = new Date().toISOString().split('T')[0];
  renderPesos();
  renderPlanes();
}

// configuracion de los tres tipos de plan con sus prompts para la ia
const planConfig = {
  nutricion: {
    titulo: 'Plan de Nutrición',
    desc: 'Genera un menú semanal personalizado basado en tu perfil y objetivos.',
    prompt: (u) => `Eres un nutricionista experto. Crea un plan de nutrición detallado para una semana para esta persona:
- Nombre: ${u.nombre}, Edad: ${u.edad} años, Sexo: ${u.sexo}
- Peso: ${u.peso} kg, Altura: ${u.altura} cm
- Actividad: ${u.actividad}, Objetivo: ${u.objetivo}, Restricciones: ${u.restricciones}
Incluye desayuno, almuerzo, merienda y cena para cada día con calorías aproximadas.`
  },
  entrenamiento: {
    titulo: 'Rutina de Entrenamiento',
    desc: 'Crea una rutina semanal adaptada a tu nivel y objetivo.',
    prompt: (u) => `Eres un entrenador personal experto. Crea una rutina de entrenamiento semanal para:
- Nombre: ${u.nombre}, Edad: ${u.edad} años, Peso: ${u.peso} kg
- Actividad: ${u.actividad}, Objetivo: ${u.objetivo}
Incluye días, ejercicios con series y repeticiones y días de descanso.`
  },
  consejos: {
    titulo: 'Consejos Personalizados',
    desc: 'Recomendaciones de hábitos, descanso e hidratación según tu perfil.',
    prompt: (u) => `Eres un coach de salud. Proporciona consejos personalizados para:
- Nombre: ${u.nombre}, Edad: ${u.edad}, Peso: ${u.peso} kg, Altura: ${u.altura} cm
- Actividad: ${u.actividad}, Objetivo: ${u.objetivo}
Consejos sobre hábitos, sueño, hidratación y motivación.`
  }
};

// cambia el tipo de plan activo y resetea el resultado anterior
function setPlanType(tipo) {
  planActual = tipo;
  document.querySelectorAll('.plan-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + tipo).classList.add('active');
  document.getElementById('plan-titulo').textContent = planConfig[tipo].titulo;
  document.getElementById('plan-desc').textContent   = planConfig[tipo].desc;
  document.getElementById('result-box').classList.remove('visible');
  document.getElementById('result-box').textContent  = '';
}

// llama al servidor que hace de proxy hacia la api de anthropic
// el resultado lo renderiza como markdown y lo guarda en bd
async function generarPlan() {
  if (!usuario.nombre) { alert('Inicia sesión primero.'); return; }

  const loading   = document.getElementById('loading-indicator');
  const resultBox = document.getElementById('result-box');
  loading.classList.add('visible');
  resultBox.classList.remove('visible');
  resultBox.textContent = '';

  try {
    const response = await fetch(`${API}/generar-plan`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ prompt: planConfig[planActual].prompt(usuario) })
    });
    const data = await response.json();
    if (data.error) {
      resultBox.textContent = '❌ Error: ' + data.error.message;
    } else {
      const texto = data.content[0].text;
      resultBox.innerHTML = marked.parse(texto);
      // guardamos el plan para poder consultarlo despues desde el dashboard
      if (usuario.id) {
        await fetch(`${API}/plan`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ usuario_id: usuario.id, tipo: planActual, contenido: texto })
        });
        await cargarPlanes();
        renderPlanes();
      }
    }
    resultBox.classList.add('visible');
  } catch (err) {
    resultBox.textContent = '❌ Error de conexión: ' + err.message;
    resultBox.classList.add('visible');
  } finally {
    loading.classList.remove('visible');
  }
}

// guarda un nuevo registro de peso en la bd
async function registrarPeso() {
  const peso  = parseFloat(document.getElementById('track-peso').value);
  const fecha = document.getElementById('track-fecha').value;
  if (!peso || !fecha) { alert('Introduce el peso y la fecha.'); return; }

  try {
    const res = await fetch(`${API}/peso`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ usuario_id: usuario.id, peso, fecha })
    });
    if (res.ok) {
      await cargarPesos();
      renderPesos();
      document.getElementById('track-peso').value = '';
    }
  } catch (err) {
    alert('Error al guardar el peso.');
  }
}

// borra un registro de peso por id
async function eliminarPeso(id) {
  if (!confirm('¿Eliminar este registro?')) return;
  try {
    const res = await fetch(`${API}/peso/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok) {
      await cargarPesos();
      renderPesos();
    }
  } catch (err) {
    alert('Error al eliminar el registro.');
  }
}

// pide al servidor el historial de pesos del usuario
async function cargarPesos() {
  if (!usuario.id) return;
  try {
    const res = await fetch(`${API}/peso/${usuario.id}`, { headers: authHeaders() });
    const data = await res.json();
    registrosPeso = data.map(r => ({ id: r.id, peso: r.peso, fecha: r.fecha.split('T')[0] }));
  } catch (err) {
    console.error('error cargando pesos:', err);
  }
}

// pinta el historial de pesos y la grafica con chart.js
function renderPesos() {
  const list = document.getElementById('progress-list');
  if (registrosPeso.length === 0) {
    list.innerHTML = '<p style="color:var(--texto);font-size:0.9rem;">Aún no hay registros. ¡Añade tu primer peso!</p>';
    document.getElementById('chart-area').style.display = 'none';
    return;
  }

  list.innerHTML = registrosPeso.map((r, i) => {
    let diff = '';
    // calculamos la diferencia respecto al registro anterior
    if (i < registrosPeso.length - 1) {
      const d = (r.peso - registrosPeso[i + 1].peso).toFixed(1);
      diff = `<span class="diff ${d > 0 ? 'positive' : 'negative'}">${d > 0 ? '+' : ''}${d} kg</span>`;
    }
    return `<div class="progress-item">
      <div class="date">${new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' })}</div>
      <div class="weight">${r.peso} kg</div>
      ${diff}
      <span class="peso-remove" onclick="eliminarPeso(${r.id})" title="Eliminar">🗑️</span>
    </div>`;
  }).join('');

  document.getElementById('chart-area').style.display = 'block';
  const sorted = [...registrosPeso].reverse(); // ordenamos de mas antiguo a mas nuevo para la grafica
  if (chartInstance) chartInstance.destroy(); // destruimos la instancia anterior si existe
  chartInstance = new Chart(document.getElementById('weightChart'), {
    type: 'line',
    data: {
      labels: sorted.map(r => new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'short' })),
      datasets: [{
        data: sorted.map(r => r.peso),
        borderColor: '#00c896', backgroundColor: '#00c89622',
        tension: 0.4, fill: true, pointBackgroundColor: '#00c896', pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#888' }, grid: { color: '#222' } },
        y: { ticks: { color: '#888' }, grid: { color: '#222' } }
      }
    }
  });
}

let planesGuardados = [];

// carga los planes guardados del usuario desde la bd
async function cargarPlanes() {
  if (!usuario.id) return;
  try {
    const res = await fetch(`${API}/plan/${usuario.id}`, { headers: authHeaders() });
    planesGuardados = await res.json();
  } catch (err) {
    console.error('error cargando planes:', err);
  }
}

// pinta las tarjetas de planes guardados en el dashboard
function renderPlanes() {
  const cont = document.getElementById('planes-guardados');
  if (!cont) return;

  if (planesGuardados.length === 0) {
    cont.innerHTML = '<p style="color:var(--texto);font-size:0.9rem;">Aún no has generado ningún plan.</p>';
    return;
  }

  const iconos  = { nutricion: '🥗', entrenamiento: '💪', consejos: '💡' };
  const nombres = { nutricion: 'Nutrición', entrenamiento: 'Entrenamiento', consejos: 'Consejos' };

  cont.innerHTML = planesGuardados.map(p => `
    <div class="plan-guardado-card" onclick="verPlanGuardado(${p.id})">
      <div class="pg-header">
        <span class="pg-icon">${iconos[p.tipo] || '📋'}</span>
        <div>
          <div class="pg-titulo">${nombres[p.tipo] || p.tipo}</div>
          <div class="pg-fecha">${new Date(p.creado_en).toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' })}</div>
        </div>
        <span class="pg-arrow">→</span>
      </div>
      <div class="pg-preview">${p.contenido.substring(0, 100)}...</div>
    </div>
  `).join('');
}

// abre el modal con el contenido completo del plan seleccionado
function verPlanGuardado(id) {
  const plan = planesGuardados.find(p => p.id === id);
  if (!plan) return;
  const iconos  = { nutricion: '🥗', entrenamiento: '💪', consejos: '💡' };
  const nombres = { nutricion: 'Nutrición', entrenamiento: 'Entrenamiento', consejos: 'Consejos' };
  document.getElementById('modal-plan-titulo').textContent  = `${iconos[plan.tipo]} ${nombres[plan.tipo]}`;
  document.getElementById('modal-plan-fecha').textContent   = new Date(plan.creado_en).toLocaleDateString('es-ES', { day:'numeric', month:'long', year:'numeric' });
  document.getElementById('modal-plan-contenido').innerHTML = marked.parse(plan.contenido);
  document.getElementById('modal-plan').classList.add('visible');
}

function cerrarModalPlan() {
  document.getElementById('modal-plan').classList.remove('visible');
}

// lista de productos de la tienda con sus datos
const productos = [
  { id: 1, icon: '💪', nombre: 'Proteína Whey', desc: 'Proteína de suero de alta calidad. 25g de proteína por dosis. Sabor chocolate.', precio: 34.99, img: 'assets/img/whey.png', badge: 'Más vendido' },
  { id: 2, icon: '⚡', nombre: 'Creatina Monohidrato', desc: 'Mejora el rendimiento y la fuerza muscular. 300g formato ahorro.', precio: 19.99, img: 'assets/img/creatina.png', badge: null },
  { id: 3, icon: '🔥', nombre: 'Quemador de grasa', desc: 'Termogénico natural con cafeína y L-carnitina. 90 cápsulas.', precio: 24.99, img: 'assets/img/quemador.png', badge: 'Nuevo' },
  { id: 4, icon: '🌿', nombre: 'BCAA Aminoácidos', desc: 'Aminoácidos esenciales para la recuperación muscular. Sabor sandía.', precio: 22.99, img: 'assets/img/bcaa.png', badge: null },
  { id: 5, icon: '🦴', nombre: 'Colágeno + Vitamina C', desc: 'Cuida tus articulaciones y mejora la recuperación. 180 cápsulas.', precio: 18.99, img: 'assets/img/colageno.png', badge: null },
  { id: 6, icon: '😴', nombre: 'ZMA Noche', desc: 'Zinc, magnesio y vitamina B6 para mejor descanso y recuperación nocturna.', precio: 15.99, img: 'assets/img/zma.png', badge: null },
  { id: 7, icon: '🍃', nombre: 'Omega 3', desc: 'Ácidos grasos esenciales para salud cardiovascular. 120 cápsulas blandas.', precio: 12.99, img: 'assets/img/omega3.png', badge: 'Oferta' },
  { id: 8, icon: '🧪', nombre: 'Vitaminas Multisport', desc: 'Complejo vitamínico especial para deportistas de alto rendimiento.', precio: 16.99, img: 'assets/img/vitaminas.png', badge: null },
];

let carrito = [];

// genera las tarjetas de producto en el grid de la tienda
function renderProductos() {
  const grid = document.getElementById('productos-grid');
  if (!grid) return;
  grid.innerHTML = productos.map(p => `
    <div class="producto-card">
      <div class="prod-img-wrap">
        <img src="${p.img}" alt="${p.nombre}" class="prod-img" onerror="this.style.display='none'" />
        ${p.badge ? `<span class="prod-badge">${p.badge}</span>` : ''}
      </div>
      <div class="prod-info">
        <div class="prod-nombre">${p.nombre}</div>
        <div class="prod-desc">${p.desc}</div>
        <div class="prod-footer">
          <div class="prod-precio">${p.precio.toFixed(2)}€</div>
          <button class="btn-add" onclick="addCarrito(${p.id})">+ Añadir</button>
        </div>
      </div>
    </div>
  `).join('');
}

// añade un producto al carrito, si ya esta incrementa la cantidad
function addCarrito(id) {
  const prod = productos.find(p => p.id === id);
  const existing = carrito.find(c => c.id === id);
  if (existing) existing.cantidad++;
  else carrito.push({ ...prod, cantidad: 1 });
  actualizarCarritoBar();
}

// actualiza el boton flotante del carrito con el total y numero de productos
function actualizarCarritoBar() {
  const bar   = document.getElementById('carrito-bar');
  const total = carrito.reduce((s, c) => s + c.precio * c.cantidad, 0);
  const count = carrito.reduce((s, c) => s + c.cantidad, 0);
  document.getElementById('carrito-count').textContent     = count;
  document.getElementById('carrito-total-bar').textContent = total.toFixed(2) + '€';
  bar.classList.toggle('visible', carrito.length > 0);
}

function abrirCarrito() {
  document.getElementById('modal-carrito').classList.add('visible');
  document.getElementById('pedido-form').classList.remove('visible');
  document.getElementById('pedido-confirmacion').classList.remove('visible');
  document.getElementById('vista-carrito').style.display = 'block';
  renderCarrito();
}

function cerrarCarrito() {
  document.getElementById('modal-carrito').classList.remove('visible');
}

// pinta los items del carrito en el modal
function renderCarrito() {
  const items = document.getElementById('carrito-items');
  const total = carrito.reduce((s, c) => s + c.precio * c.cantidad, 0);
  items.innerHTML = carrito.length === 0
    ? '<p style="color:var(--texto); font-size:0.9rem; padding:1rem 0;">El carrito está vacío.</p>'
    : carrito.map(c => `
        <div class="carrito-item">
          <span class="ci-nombre">${c.icon} ${c.nombre} x${c.cantidad}</span>
          <span class="ci-precio">${(c.precio * c.cantidad).toFixed(2)}€</span>
          <span class="ci-remove" onclick="removeCarrito(${c.id})">✕</span>
        </div>`).join('');
  document.getElementById('carrito-total-modal').textContent = total.toFixed(2) + '€';
}

function removeCarrito(id) {
  carrito = carrito.filter(c => c.id !== id);
  actualizarCarritoBar();
  renderCarrito();
}

// muestra el formulario de datos de envio
function mostrarFormPedido() {
  if (carrito.length === 0) { alert('El carrito está vacío.'); return; }
  document.getElementById('vista-carrito').style.display = 'none';
  document.getElementById('pedido-form').classList.add('visible');
  // rellenamos con los datos del usuario si estan disponibles
  if (usuario.email)  document.getElementById('ped-email').value  = usuario.email;
  if (usuario.nombre) document.getElementById('ped-nombre').value = usuario.nombre;
}

function volverCarrito() {
  document.getElementById('pedido-form').classList.remove('visible');
  document.getElementById('vista-carrito').style.display = 'block';
}

// ── MODIFICADO: envia el carrito a Stripe en lugar de simular el pago ──
async function confirmarPedido() {
  const nombre    = document.getElementById('ped-nombre').value.trim();
  const direccion = document.getElementById('ped-direccion').value.trim();
  const telefono  = document.getElementById('ped-telefono').value.trim();
  const email     = document.getElementById('ped-email').value.trim();

  if (!nombre || !direccion || !telefono || !email) {
    alert('Por favor, rellena todos los campos del pedido.');
    return;
  }

  const btn = document.querySelector('#pedido-form .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Redirigiendo al pago…'; }

  try {
    const res = await fetch(`${API}/pagos/checkout`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ items: carrito, nombre, email, direccion, telefono }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Error al procesar el pago.');
      if (btn) { btn.disabled = false; btn.textContent = 'Confirmar pedido ✓'; }
      return;
    }

    // redirigimos a la pagina de pago de Stripe
    window.location.href = data.url;

  } catch (err) {
    console.error('Error de red:', err);
    alert('Error de conexión. Inténtalo de nuevo.');
    if (btn) { btn.disabled = false; btn.textContent = 'Confirmar pedido ✓'; }
  }
}

function limpiarCarrito() {
  carrito = [];
  actualizarCarritoBar();
}

// ── AÑADIDO: detecta si el usuario vuelve de Stripe ──
function procesarRetornoPedido() {
  const params = new URLSearchParams(window.location.search);
  const estado = params.get('pedido');

  if (estado === 'ok') {
    window.history.replaceState({}, '', '/');
    limpiarCarrito();
    document.getElementById('modal-carrito').classList.add('visible');
    document.getElementById('vista-carrito').style.display       = 'none';
    document.getElementById('pedido-form').classList.remove('visible');
    document.getElementById('pedido-confirmacion').classList.add('visible');
  }

  if (estado === 'cancelado') {
    window.history.replaceState({}, '', '/');
    alert('Pago cancelado. Tu carrito sigue guardado.');
  }
}

// rellena el formulario de edicion con los datos actuales del usuario
function abrirPerfil() {
  const n5 = document.getElementById('nav-nombre5');
  if (n5) n5.textContent = usuario.nombre || '—';
  document.getElementById('edit-nombre').value        = usuario.nombre || '';
  document.getElementById('edit-edad').value          = usuario.edad || '';
  document.getElementById('edit-peso').value          = usuario.peso || '';
  document.getElementById('edit-altura').value        = usuario.altura || '';
  document.getElementById('edit-sexo').value          = usuario.sexo || 'hombre';
  document.getElementById('edit-actividad').value     = usuario.actividad || 'moderado';
  document.getElementById('edit-objetivo').value      = usuario.objetivo || 'mantenimiento';
  document.getElementById('edit-restricciones').value = usuario.restricciones || 'ninguna';
  document.getElementById('edit-error').style.display = 'none';
  document.getElementById('edit-ok').style.display    = 'none';
}

// guarda los cambios del perfil en la bd y actualiza el estado local
async function guardarPerfil() {
  const datos = {
    nombre:        document.getElementById('edit-nombre').value.trim(),
    edad:          document.getElementById('edit-edad').value,
    sexo:          document.getElementById('edit-sexo').value,
    peso:          document.getElementById('edit-peso').value,
    altura:        document.getElementById('edit-altura').value,
    actividad:     document.getElementById('edit-actividad').value,
    objetivo:      document.getElementById('edit-objetivo').value,
    restricciones: document.getElementById('edit-restricciones').value,
  };

  if (!datos.nombre) { mostrarError('edit-error', 'El nombre no puede estar vacío.'); return; }

  try {
    const res = await fetch(`${API}/usuario/${usuario.id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(datos)
    });
    if (!res.ok) { mostrarError('edit-error', 'Error al guardar.'); return; }
    Object.assign(usuario, datos); // actualizamos el objeto local
    guardarSesion();
    cargarDashboard();
    document.getElementById('edit-error').style.display = 'none';
    document.getElementById('edit-ok').style.display    = 'block';
  } catch (err) {
    mostrarError('edit-error', 'Error de conexión.');
  }
}

// muestra un mensaje de error en el elemento con el id dado
function mostrarError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

// al cargar la pagina intentamos recuperar la sesion guardada
window.onload = async () => {
  document.getElementById('track-fecha').value = new Date().toISOString().split('T')[0];

  // ── AÑADIDO: comprobamos si venimos de un pago de Stripe ──
  procesarRetornoPedido();

  const sesion = localStorage.getItem('nutrigues-sesion');
  if (sesion) {
    const { id } = JSON.parse(sesion);
    try {
      // pedimos el perfil completo al servidor con el token guardado
      const res = await fetch(`${API}/usuario/${id}`, { headers: authHeaders() });
      if (res.ok) {
        usuario = await res.json();
        await cargarPesos();
        await cargarPlanes();
        cargarDashboard();
        showScreen('dashboard');
      } else {
        // si el token ha expirado limpiamos la sesion
        localStorage.removeItem('nutrigues-sesion');
        localStorage.removeItem('nutrigues-token');
      }
    } catch (err) {
      localStorage.removeItem('nutrigues-sesion');
      localStorage.removeItem('nutrigues-token');
    }
  }
};
const express = require('express');
const mysql2  = require('mysql2');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const app  = express();
const PORT = process.env.PORT || 3000;

// claves desde variables de entorno, nunca hardcodeadas en produccion
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || '';
const JWT_SECRET    = process.env.JWT_SECRET || 'nutrigues_secret_2026';

app.use(cors());
app.use(express.json());
app.use(express.static('.')); // sirve los archivos estaticos del frontend

// conexion a mysql, los datos vienen de variables de entorno en produccion
const db = mysql2.createConnection({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || 'nutrigues123',
  database: process.env.DB_NAME     || 'nutrigues'
});

db.connect((err) => {
  if (err) { console.error('error mysql:', err.message); return; }
  console.log('mysql ok');
  crearTablas();
});

// crea las tablas si no existen, asi no hay que hacerlo manualmente
function crearTablas() {
  const sqlUsuarios = `
    CREATE TABLE IF NOT EXISTS usuarios (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      nombre        VARCHAR(100) NOT NULL,
      email         VARCHAR(100) NOT NULL UNIQUE,
      password      VARCHAR(255) NOT NULL,
      edad          INT,
      sexo          VARCHAR(20),
      peso          FLOAT,
      altura        FLOAT,
      actividad     VARCHAR(50),
      objetivo      VARCHAR(100),
      restricciones VARCHAR(100),
      creado_en     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
  const sqlPesos = `
    CREATE TABLE IF NOT EXISTS registros_peso (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      peso       FLOAT NOT NULL,
      fecha      DATE NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )`;
  const sqlPlanes = `
    CREATE TABLE IF NOT EXISTS planes (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      tipo       VARCHAR(50) NOT NULL,
      contenido  TEXT NOT NULL,
      creado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )`;

  db.query(sqlUsuarios, (err) => { if (err) console.error('error tabla usuarios:', err.message); });
  db.query(sqlPesos,    (err) => { if (err) console.error('error tabla pesos:', err.message); });
  db.query(sqlPlanes,   (err) => { if (err) console.error('error tabla planes:', err.message); });
}

// middleware que comprueba el token jwt en las rutas protegidas
// si el token no es valido devuelve 401
function verificarToken(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'Token requerido' });
  const token = auth.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuarioId = decoded.id; // guardamos el id para usarlo en las rutas
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// registro: hashea la contrasena con bcrypt antes de guardarla
app.post('/api/registro', async (req, res) => {
  const { nombre, email, password, edad, sexo, peso, altura, actividad, objetivo, restricciones } = req.body;
  if (!nombre || !email || !password) return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const sql  = `INSERT INTO usuarios (nombre, email, password, edad, sexo, peso, altura, actividad, objetivo, restricciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql, [nombre, email, hash, edad, sexo, peso, altura, actividad, objetivo, restricciones], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Ese email ya está registrado' });
        return res.status(500).json({ error: 'Error al registrar usuario' });
      }
      // devolvemos el token y todos los datos para no tener que hacer otra peticion
      const token = jwt.sign({ id: result.insertId }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ ok: true, token, usuario: { id: result.insertId, nombre, email, edad, sexo, peso, altura, actividad, objetivo, restricciones } });
    });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// login: compara la contrasena con el hash guardado usando bcrypt.compare
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  db.query('SELECT * FROM usuarios WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Error en el servidor' });
    if (results.length === 0) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    const usuario = results[0];
    const ok = await bcrypt.compare(password, usuario.password);
    if (!ok) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    delete usuario.password; // nunca mandamos la contrasena al cliente
    const token = jwt.sign({ id: usuario.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token, usuario });
  });
});

// devuelve el perfil del usuario, solo si el token corresponde al mismo id
app.get('/api/usuario/:id', verificarToken, (req, res) => {
  if (req.usuarioId !== parseInt(req.params.id)) return res.status(403).json({ error: 'Acceso denegado' });
  db.query('SELECT id, nombre, email, edad, sexo, peso, altura, actividad, objetivo, restricciones FROM usuarios WHERE id = ?', [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error en el servidor' });
    if (results.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(results[0]);
  });
});

// actualiza los datos del perfil, solo el propio usuario puede modificarlo
app.put('/api/usuario/:id', verificarToken, (req, res) => {
  if (req.usuarioId !== parseInt(req.params.id)) return res.status(403).json({ error: 'Acceso denegado' });
  const { nombre, edad, sexo, peso, altura, actividad, objetivo, restricciones } = req.body;
  db.query('UPDATE usuarios SET nombre=?, edad=?, sexo=?, peso=?, altura=?, actividad=?, objetivo=?, restricciones=? WHERE id=?',
    [nombre, edad, sexo, peso, altura, actividad, objetivo, restricciones, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar perfil' });
    res.json({ ok: true });
  });
});

// guarda un nuevo registro de peso
app.post('/api/peso', verificarToken, (req, res) => {
  const { usuario_id, peso, fecha } = req.body;
  if (req.usuarioId !== parseInt(usuario_id)) return res.status(403).json({ error: 'Acceso denegado' });
  db.query('INSERT INTO registros_peso (usuario_id, peso, fecha) VALUES (?, ?, ?)', [usuario_id, peso, fecha], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error al guardar peso' });
    res.json({ ok: true, id: result.insertId });
  });
});

// devuelve el historial de pesos ordenado por fecha descendente
app.get('/api/peso/:usuario_id', verificarToken, (req, res) => {
  if (req.usuarioId !== parseInt(req.params.usuario_id)) return res.status(403).json({ error: 'Acceso denegado' });
  db.query('SELECT * FROM registros_peso WHERE usuario_id = ? ORDER BY fecha DESC', [req.params.usuario_id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener pesos' });
    res.json(results);
  });
});

// borra un registro de peso, verificando primero que pertenece al usuario
app.delete('/api/peso/:id', verificarToken, (req, res) => {
  db.query('SELECT usuario_id FROM registros_peso WHERE id = ?', [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al eliminar peso' });
    if (results.length === 0) return res.status(404).json({ error: 'Registro no encontrado' });
    if (req.usuarioId !== results[0].usuario_id) return res.status(403).json({ error: 'Acceso denegado' });
    db.query('DELETE FROM registros_peso WHERE id = ?', [req.params.id], (err2) => {
      if (err2) return res.status(500).json({ error: 'Error al eliminar peso' });
      res.json({ ok: true });
    });
  });
});

// guarda un plan generado por ia, borrando el anterior del mismo tipo
// asi cada usuario solo tiene un plan de cada tipo guardado
app.post('/api/plan', verificarToken, (req, res) => {
  const { usuario_id, tipo, contenido } = req.body;
  if (req.usuarioId !== parseInt(usuario_id)) return res.status(403).json({ error: 'Acceso denegado' });
  db.query('DELETE FROM planes WHERE usuario_id = ? AND tipo = ?', [usuario_id, tipo], (err) => {
    if (err) return res.status(500).json({ error: 'Error al guardar plan' });
    db.query('INSERT INTO planes (usuario_id, tipo, contenido) VALUES (?, ?, ?)', [usuario_id, tipo, contenido], (err2, result) => {
      if (err2) return res.status(500).json({ error: 'Error al guardar plan' });
      res.json({ ok: true, id: result.insertId });
    });
  });
});

// devuelve todos los planes del usuario ordenados por fecha
app.get('/api/plan/:usuario_id', verificarToken, (req, res) => {
  if (req.usuarioId !== parseInt(req.params.usuario_id)) return res.status(403).json({ error: 'Acceso denegado' });
  db.query('SELECT * FROM planes WHERE usuario_id = ? ORDER BY creado_en DESC', [req.params.usuario_id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener planes' });
    res.json(results);
  });
});

// proxy hacia anthropic para que la api key nunca salga al cliente
app.post('/api/generar-plan', verificarToken, async (req, res) => {
  const { prompt } = req.body;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error al contactar con la IA' });
  }
});

app.listen(PORT, () => {
  console.log(`servidor corriendo en puerto ${PORT}`);
});
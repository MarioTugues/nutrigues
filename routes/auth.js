const express      = require('express');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const nodemailer   = require('nodemailer');
const db           = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'nutrigues_secret_2026';
const BASE_URL   = process.env.BASE_URL   || 'http://localhost:3000';

// configuracion del transporte de email con gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  }
});

// manda el email de verificacion al usuario recien registrado
async function enviarEmailVerificacion(email, nombre, token) {
  const enlace = `${BASE_URL}/api/verificar?token=${token}`;
  await transporter.sendMail({
    from:    `"NutriGues" <${process.env.GMAIL_USER}>`,
    to:      email,
    subject: 'Verifica tu cuenta de NutriGues',
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto">
        <h2 style="color:#00c896">¡Bienvenido a NutriGues, ${nombre}!</h2>
        <p>Para activar tu cuenta haz clic en el botón:</p>
        <a href="${enlace}" style="display:inline-block;background:#00c896;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
          Verificar cuenta
        </a>
        <p style="color:#888;font-size:0.85rem;margin-top:24px">Si no te has registrado en NutriGues ignora este email.</p>
      </div>
    `
  });
}

// registro de nuevo usuario
router.post('/registro', async (req, res) => {
  const { nombre, email, password, edad, sexo, peso, altura, actividad, objetivo, restricciones } = req.body;
  if (!nombre || !email || !password) return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  try {
    const hash  = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const sql   = `INSERT INTO usuarios (nombre, email, password, edad, sexo, peso, altura, actividad, objetivo, restricciones, token_verificacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql, [nombre, email, hash, edad, sexo, peso, altura, actividad, objetivo, restricciones, token], async (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Ese email ya está registrado' });
        return res.status(500).json({ error: 'Error al registrar usuario' });
      }
      enviarEmailVerificacion(email, nombre, token)
        .then(() => console.log('email enviado a:', email))
        .catch(e => console.error('error enviando email:', e.message));
      res.json({ ok: true, mensaje: 'Cuenta creada. Revisa tu email para verificarla.' });
    });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// enlace de verificacion que llega por email
router.get('/verificar', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Token no válido');

  db.query('SELECT id FROM usuarios WHERE token_verificacion = ?', [token], (err, results) => {
    if (err || results.length === 0) return res.status(400).send('Enlace no válido o ya usado');

    db.query('UPDATE usuarios SET verificado = 1, token_verificacion = NULL WHERE id = ?', [results[0].id], (err2) => {
      if (err2) return res.status(500).send('Error al verificar la cuenta');
      res.redirect(`${BASE_URL}/?verificado=ok`);
    });
  });
});

// login con verificacion bcrypt
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  db.query('SELECT * FROM usuarios WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Error en el servidor' });
    if (results.length === 0) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    const usuario = results[0];
    const ok = await bcrypt.compare(password, usuario.password);
    if (!ok) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    // bloqueamos el login si no ha verificado el email
    if (!usuario.verificado) return res.status(401).json({ error: 'Debes verificar tu email antes de entrar. Revisa tu bandeja de entrada.' });
    delete usuario.password;
    const jwtToken = jwt.sign({ id: usuario.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token: jwtToken, usuario });
  });
});

module.exports = router;
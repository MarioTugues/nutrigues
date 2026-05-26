const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'nutrigues_secret_2026';

// registro de nuevo usuario
router.post('/registro', async (req, res) => {
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
      const token = jwt.sign({ id: result.insertId }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ ok: true, token, usuario: { id: result.insertId, nombre, email, edad, sexo, peso, altura, actividad, objetivo, restricciones } });
    });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
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
    delete usuario.password;
    const token = jwt.sign({ id: usuario.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token, usuario });
  });
});

module.exports = router;
const express = require('express');
const db      = require('../db');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();

// devuelve el perfil del usuario
router.get('/:id', verificarToken, (req, res) => {
  if (req.usuarioId !== parseInt(req.params.id)) return res.status(403).json({ error: 'Acceso denegado' });
  db.query('SELECT id, nombre, email, edad, sexo, peso, altura, actividad, objetivo, restricciones FROM usuarios WHERE id = ?', [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error en el servidor' });
    if (results.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(results[0]);
  });
});

// actualiza los datos del perfil
router.put('/:id', verificarToken, (req, res) => {
  if (req.usuarioId !== parseInt(req.params.id)) return res.status(403).json({ error: 'Acceso denegado' });
  const { nombre, edad, sexo, peso, altura, actividad, objetivo, restricciones } = req.body;
  db.query('UPDATE usuarios SET nombre=?, edad=?, sexo=?, peso=?, altura=?, actividad=?, objetivo=?, restricciones=? WHERE id=?',
    [nombre, edad, sexo, peso, altura, actividad, objetivo, restricciones, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar perfil' });
    res.json({ ok: true });
  });
});

module.exports = router;
const express = require('express');
const db      = require('../db');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();

// guarda el plan generado, borra el anterior del mismo tipo
router.post('/', verificarToken, (req, res) => {
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

// devuelve todos los planes del usuario
router.get('/:usuario_id', verificarToken, (req, res) => {
  if (req.usuarioId !== parseInt(req.params.usuario_id)) return res.status(403).json({ error: 'Acceso denegado' });
  db.query('SELECT * FROM planes WHERE usuario_id = ? ORDER BY creado_en DESC', [req.params.usuario_id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener planes' });
    res.json(results);
  });
});

module.exports = router;
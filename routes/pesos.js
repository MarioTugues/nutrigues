const express = require('express');
const db      = require('../db');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();

// guarda un nuevo registro de peso
router.post('/', verificarToken, (req, res) => {
  const { usuario_id, peso, fecha } = req.body;
  if (req.usuarioId !== parseInt(usuario_id)) return res.status(403).json({ error: 'Acceso denegado' });
  db.query('INSERT INTO registros_peso (usuario_id, peso, fecha) VALUES (?, ?, ?)', [usuario_id, peso, fecha], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error al guardar peso' });
    res.json({ ok: true, id: result.insertId });
  });
});

// historial de pesos ordenado por fecha
router.get('/:usuario_id', verificarToken, (req, res) => {
  if (req.usuarioId !== parseInt(req.params.usuario_id)) return res.status(403).json({ error: 'Acceso denegado' });
  db.query('SELECT * FROM registros_peso WHERE usuario_id = ? ORDER BY fecha DESC', [req.params.usuario_id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener pesos' });
    res.json(results);
  });
});

// borra un registro verificando que pertenece al usuario
router.delete('/:id', verificarToken, (req, res) => {
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

module.exports = router;
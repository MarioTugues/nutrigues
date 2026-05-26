const express = require('express');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || '';

// proxy hacia anthropic para que la api key nunca salga al cliente
router.post('/generar-plan', verificarToken, async (req, res) => {
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

module.exports = router;
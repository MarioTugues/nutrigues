const express = require('express');
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { verificarToken } = require('../middleware/auth');

const router = express.Router();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// crea la sesion de pago en stripe y devuelve la url
router.post('/checkout', verificarToken, async (req, res) => {
  const { items, nombre, email, direccion, telefono } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'El carrito está vacío' });
  }

  // stripe necesita el precio en centimos
  const line_items = items.map(item => ({
    price_data: {
      currency: 'eur',
      product_data: {
        name: item.nombre,
        description: item.desc || '',
      },
      unit_amount: Math.round(item.precio * 100),
    },
    quantity: item.cantidad,
  }));

  try {
    const session = await stripe.checkout.sessions.create({
      mode:                 'payment',
      payment_method_types: ['card'],
      customer_email:       email,
      line_items,
      metadata: { usuario_id: String(req.usuarioId), nombre, direccion, telefono },
      success_url: `${BASE_URL}/?pedido=ok`,
      cancel_url:  `${BASE_URL}/?pedido=cancelado`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('error stripe:', err.message);
    res.status(500).json({ error: 'Error al crear la sesión de pago' });
  }
});

// stripe llama aqui cuando el pago se confirma
// necesita el body sin parsear, por eso en server.js va antes del express.json()
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let evento;
  try {
    evento = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (evento.type === 'checkout.session.completed') {
    const session = evento.data.object;
    // aqui se puede guardar el pedido en bd o mandar email de confirmacion
    console.log('pago completado -', session.customer_email, '-', (session.amount_total / 100).toFixed(2) + '€');
  }

  res.json({ recibido: true });
});

module.exports = router;
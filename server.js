if (process.env.NODE_ENV !== 'production') require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// el webhook de stripe necesita el body sin parsear, por eso va antes del express.json()
app.use('/api/pagos/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.static('.')); // sirve los archivos estaticos del frontend

// importamos la conexion a la bd (esto tambien crea las tablas si no existen)
require('./db');

// rutas de la api organizadas por modulo
app.use('/api', require('./routes/auth'));
app.use('/api/usuario', require('./routes/usuarios'));
app.use('/api/peso', require('./routes/pesos'));
app.use('/api/plan', require('./routes/planes'));
app.use('/api', require('./routes/ia'));

// ruta de pagos stripe
app.use('/api/pagos', require('./routes/pagos'));

app.listen(PORT, () => {
  console.log(`servidor corriendo en puerto ${PORT}`);
});
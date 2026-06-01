const mysql2 = require('mysql2');

// conexion a mysql, usa variables de entorno en produccion
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

// crea las tablas al arrancar si no existen
function crearTablas() {
  const sqlUsuarios = `
    CREATE TABLE IF NOT EXISTS usuarios (
      id                  INT AUTO_INCREMENT PRIMARY KEY,
      nombre              VARCHAR(100) NOT NULL,
      email               VARCHAR(100) NOT NULL UNIQUE,
      password            VARCHAR(255) NOT NULL,
      edad                INT,
      sexo                VARCHAR(20),
      peso                FLOAT,
      altura              FLOAT,
      actividad           VARCHAR(50),
      objetivo            VARCHAR(100),
      restricciones       VARCHAR(100),
      verificado          TINYINT DEFAULT 0,
      token_verificacion  VARCHAR(255) DEFAULT NULL,
      creado_en           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

  db.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS verificado TINYINT DEFAULT 0`, (err) => {
    if (err) console.error('error alter verificado:', err.message);
  });
  db.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_verificacion VARCHAR(255) DEFAULT NULL`, (err) => {
    if (err) console.error('error alter token:', err.message);
  });
}

module.exports = db;
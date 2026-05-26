# NutriGues 

Aplicación web de nutrición y entrenamiento personalizado con Inteligencia Artificial.

Demo: [nutrigues-production.up.railway.app](https://nutrigues-production.up.railway.app)

## ¿Qué es NutriGues?

NutriGues es mi proyecto de fin de grado para el ciclo de DAM. La idea surgió de querer combinar algo que me gusta, el deporte y la nutrición, con las tecnologías que he aprendido durante el ciclo, incluyendo la integración de IA mediante la API de Anthropic.

La app permite registrarse, configurar un perfil con datos y objetivos, y recibir planes de nutrición y rutinas de entrenamiento generados por IA de forma personalizada. También incluye seguimiento de peso con gráficas y una tienda de suplementos.

## Funcionalidades

- Registro y login con autenticación JWT
- Generación de planes de nutrición semanales con IA
- Generación de rutinas de entrenamiento con IA
- Consejos de hábitos saludables personalizados
- Seguimiento de peso con historial y gráfica de evolución
- Tienda de suplementos con carrito y formulario de pedido
- Edición de perfil y objetivos
- Sesión persistente al recargar la página

## Tecnologías

Backend: Node.js, Express.js, MySQL, JWT, bcryptjs

Frontend: HTML5, CSS3, JavaScript vanilla, Chart.js, marked.js

IA: API de Anthropic (Claude Sonnet 4.5)

Despliegue: Railway

## Estructura del proyecto

```
nutrigues/
├── server.js           # arranque y configuración
├── db.js               # conexión a MySQL
├── middleware/
│   └── auth.js         # verificación JWT
├── routes/
│   ├── auth.js         # registro y login
│   ├── usuarios.js     # perfil
│   ├── pesos.js        # seguimiento de peso
│   ├── planes.js       # planes guardados
│   └── ia.js           # proxy Anthropic
├── css/styles.css
├── js/app.js
├── assets/img/
└── index.html
```

## Instalación local

Requisitos: Node.js v18+, MySQL 8.0+

```bash
git clone https://github.com/MarioTugues/nutrigues.git
cd nutrigues
npm install
```

Crear la base de datos en MySQL:

```bash
mysql -u root -p
CREATE DATABASE nutrigues;
exit
```

Editar `db.js` con tu contraseña de MySQL y añadir tu API key de Anthropic en `routes/ia.js`. Luego arrancar el servidor:

```bash
npm start
```

Abrir el navegador en `http://localhost:3000`

## Variables de entorno en producción

`ANTHROPIC_KEY`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`

## Autor

Mario Tugues — TFG DAM 2025-2026

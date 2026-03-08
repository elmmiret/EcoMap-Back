# EcoMap-Back 🚀

**Backend del proyecto EcoMap utilizando Node.js, Express, TypeScript y Prisma con PostgreSQL**. Gestiona la lógica de negocio para fomentar el reciclaje en las regiones de **Navarra** y **Barcelona**, incluyendo geolocalización, gamificación y comunicación en tiempo real.

---

## 🛠️ Stack Tecnológico

El proyecto se basa en las siguientes tecnologías y librerías principales:

* **Runtime**: Node.js (>= 20.0.0).
* **Framework**: Express (^5.1.0).
* **ORM**: Prisma (^6.17.1) con PostgreSQL.
* **Autenticación**: Firebase Admin (^13.5.0) y JSON Web Tokens (jsonwebtoken ^9.0.2).
* **Comunicación en Tiempo Real**: Socket.io (^4.8.1).
* **Documentación**: Swagger UI Express (^5.0.1).
* **Infraestructura**: Docker y Docker Compose para la base de datos y herramientas de administración.

---

## 📋 Requisitos Previos

* **Node.js** >= 18.
* **Docker Desktop** (incluye Docker Compose).
* **Git**.

---

## ⚙️ Configuración e Instalación

### 1. Clona el repositorio e instala dependencias
```bash
git clone [https://github.com/elmmiret/EcoMap-Back.git](https://github.com/elmmiret/EcoMap-Back.git)
cd EcoMap-Back
npm install
```

### 2. Variables de Entorno (.env)
Obtén las credenciales reales y crea un archivo `.env` en la raíz basándote en `.env.example`. Debes definir los siguientes valores:
* **PORT**: Puerto del servidor (por defecto 3001).
* **DATABASE_URL**: URL de conexión a PostgreSQL (ej. `postgres://admin:YOUR_PASSWORD_HERE@localhost:5432/ecomapdb`).
* **FIREBASE_KEY_PATH**: Ruta al archivo `firebase-service-account-key.json`.
* **JWT_SECRET**: Clave secreta para la verificación de tokens JWT.
* **ORS_API_KEY**: API Key de OpenRouteService para el cálculo de rutas.
* **AI_SERVICE_API_KEY**: Clave para el servicio de inteligencia artificial.

**⚠️ IMPORTANT**: Nunca subas tu `.env` ni el `firebase-service-account-key.json` al repositorio. Asegúrate de que están en tu `.gitignore`.

### 3. Base de Datos con Docker
Asegúrate de tener Docker Desktop abierto y después ejecuta:
```bash
docker compose up -d
```
Esto arrancará el contenedor de PostgreSQL configurado para el proyecto. Para acceder a la interfaz de administración de la base de datos (Adminer), abre tu navegador en: [http://localhost:8080](http://localhost:8080).

### 4. Estructura de la Base de Datos (Prisma)
Aplica todas las migraciones existentes (estructura de tablas, enums, etc):
```bash
npm run migrate
```
Esto aplicará automáticamente cada migración necesaria sobre tu base de datos en Docker. Consulta la documentación oficial de Prisma si tienes dudas sobre migraciones, resets o sincronización de esquemas: [https://www.prisma.io/docs](https://www.prisma.io/docs).

---

## 🏃 Ejecución y Comandos útiles

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Ejecuta el servidor en modo desarrollo con recarga automática. |
| `npm run start` | Ejecuta el servidor compilado en producción. |
| `npm run migrate` | Aplica todas las migraciones de la base de datos pendientes. |
| `npm run lint` | Revisa el código con ESLint. |
| `npm run format` | Formatea el código con Prettier. |
| `npm test` | Ejecuta los tests con Vitest. |

---

## 📖 Documentación de la API (Swagger)

El proyecto incluye una interfaz interactiva (Swagger UI) para explorar y probar los endpoints de la API sin necesidad de escribir código.
1. Asegúrate de que el servidor está en marcha (`npm run dev`).
2. Abre tu navegador y visita: 👉 [http://localhost:3001/api-docs](http://localhost:3001/api-docs).

Allí encontrarás todos los endpoints disponibles, los esquemas de datos y un botón **"Try it out"** para hacer peticiones reales directamente contra tu backend local.

---

## 📋 Resumen de Endpoints Principales

### 🟢 Públicos (Sin autenticación)
* `GET /`: Verificar estado del servidor (Health Check).
* `GET /api/recycling-points/:region`: Puntos de reciclaje por región (Barcelona/Navarra) optimizado con caché SWR.
* `GET /api/routes`: Calcular ruta entre coordenadas con ORS API.

### 🔐 Autenticación (Firebase Token)
* `POST /api/users/sync`: Sincronizar usuario con BD y obtener JWT del backend.

### 🔒 Protegidos (Backend JWT)
* **Gestión de Usuario**: `GET /api/users/me` (perfil), `PUT /api/users/me` (actualizar perfil), `PUT /api/users/language` (idioma), `DELETE /api/users/me` (eliminar cuenta).
* **Administradores**: `GET /api/recycling-points/:region/status` y `POST /api/recycling-points/:region/refresh` para forzar sincronización inmediata de la caché.

---

## 📂 Estructura del Proyecto

```plaintext
├── /prisma/          # Esquema del modelo de datos y migraciones SQL
├── /src/             # Código fuente en TypeScript
│   ├── /api/         # Endpoints y controladores de la API
│   ├── /data/        # Modelos y acceso a datos
│   └── /services/    # Lógica de negocio y servicios
├── /tests/           # Tests del proyecto
├── docker-compose.yml # Configuración de Docker para PostgreSQL y Adminer
├── .env.example      # Plantilla de variables de entorno
└── package.json      # Dependencias y scripts del proyecto
```

---

## 📝 Logging y Schedulers

* **Logging Configurable**: El proyecto incorpora un logger con niveles y filtros por namespace controlados por variables de entorno.
  * `LOG_LEVEL`: `error` | `warn` | `info` | `debug` | `trace` (por defecto: `info`).
  * `LOG_NAMESPACES`: lista separada por comas para filtrar namespaces (ej. `navarra-sync`, `cache`, `auth`).
* **Warmup y Schedulers**: 
  * El servidor ejecuta un "warmup" (precarga de la caché de puntos) solo en producción (`NODE_ENV=production`).
  * Las tareas programadas (cron) también se inician solo en producción.
  * En desarrollo, ambos mecanismos se saltan automáticamente para evitar tráfico innecesario a APIs externas.

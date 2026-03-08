# EcoMap-Back 🚀

**Backend del projecte EcoMap utilitzant Node.js, Express, TypeScript i Prisma amb PostgreSQL**. Gestiona la lògica de negoci per fomentar el reciclatge a les regions de **Navarra** i **Barcelona**, incloent geolocalització, gamificació i comunicació en temps real.

---

## 🛠️ Stack Tecnològic

El projecte es basa en les següents tecnologies i llibreries principals:

* **Runtime**: Node.js (>= 20.0.0).
* **Framework**: Express (^5.1.0).
* **ORM**: Prisma (^6.17.1) amb PostgreSQL.
* **Autenticació**: Firebase Admin (^13.5.0) i JSON Web Tokens (jsonwebtoken ^9.0.2).
* **Comunicació en Temps Real**: Socket.io (^4.8.1).
* **Documentació**: Swagger UI Express (^5.0.1).
* **Infraestructura**: Docker i Docker Compose per a la base de dades i eines d'administració.

---

## 📋 Requisits Previs

* **Node.js** >= 18.
* **Docker Desktop** (inclou Docker Compose).
* **Git**.

---

## ⚙️ Configuració i Instal·lació

### 1. Clona el repositori i instal·la dependències
```bash
git clone [https://github.com/elmmiret/EcoMap-Back.git](https://github.com/elmmiret/EcoMap-Back.git)
cd EcoMap-Back
npm install
```

### 2. Variables d'Entorn (.env)
Obté les credencials reals i crea un arxiu `.env` a l'arrel basant-te en `.env.example`. Has de definir els següents valors:
* **PORT**: Port del servidor (per defecte 3001).
* **DATABASE_URL**: URL de connexió a PostgreSQL (ex. `postgres://admin:YOUR_PASSWORD_HERE@localhost:5432/ecomapdb`).
* **FIREBASE_KEY_PATH**: Ruta a l'arxiu `firebase-service-account-key.json`.
* **JWT_SECRET**: Clau secreta per a la verificació de tokens JWT.
* **ORS_API_KEY**: API Key d'OpenRouteService per al càlcul de rutes.
* **AI_SERVICE_API_KEY**: Clau per al servei d'intel·ligència artificial.

**⚠️ IMPORTANT**: Mai pugis el teu `.env` ni el `firebase-service-account-key.json` al repositori. Assegura't que estan al teu `.gitignore`.

### 3. Base de Dades amb Docker
Assegura't de tenir Docker Desktop obert i després executa:
```bash
docker compose up -d
```
Això arrencarà el contenidor de PostgreSQL configurat per al projecte. Per accedir a la interfície d'administració de la base de dades (Adminer), obre el teu navegador a: [http://localhost:8080](http://localhost:8080).

### 4. Estructura de la Base de Dades (Prisma)
Aplica totes les migracions existents (estructura de taules, enums, etc):
```bash
npm run migrate
```
Això aplicarà automàticament cada migració necessària sobre la teva base de dades a Docker. Consulta la documentació oficial de Prisma si tens dubtes sobre migracions, resets o sincronització d'esquemes: [https://www.prisma.io/docs](https://www.prisma.io/docs).

---

## 🏃 Execució i Comandes útils

| Comanda | Descripció |
| :--- | :--- |
| `npm run dev` | Executa el servidor en mode desenvolupament amb recàrrega automàtica. |
| `npm run start` | Executa el servidor compilat en producció. |
| `npm run migrate` | Aplica totes les migracions de la base de dades pendents. |
| `npm run lint` | Revisa el codi amb ESLint. |
| `npm run format` | Formata el codi amb Prettier. |
| `npm test` | Executa els tests amb Vitest. |

---

## 📖 Documentació de l'API (Swagger)

El projecte inclou una interfície interactiva (Swagger UI) per explorar i provar els endpoints de l'API sense necessitat d'escriure codi.
1. Assegura't que el servidor està en marxa (`npm run dev`).
2. Obre el teu navegador i visita: 👉 [http://localhost:3001/api-docs](http://localhost:3001/api-docs).

Allà trobaràs tots els endpoints disponibles, els esquemes de dades i un botó **"Try it out"** per fer peticions reals directament contra el teu backend local.

---

## 📋 Resum d'Endpoints Principals

### 🟢 Públics (Sense autenticació)
* `GET /`: Verificar estat del servidor (Health Check).
* `GET /api/recycling-points/:region`: Punts de reciclatge per regió (Barcelona/Navarra) optimitzat amb cache SWR.
* `GET /api/routes`: Calcular ruta entre coordenades amb ORS API.

### 🔐 Autenticació (Firebase Token)
* `POST /api/users/sync`: Sincronitzar usuari amb BD i obtenir JWT del backend.

### 🔒 Protegits (Backend JWT)
* **Gestió d'Usuari**: `GET /api/users/me` (perfil), `PUT /api/users/me` (actualitzar perfil), `PUT /api/users/language` (idioma), `DELETE /api/users/me` (eliminar compte).
* **Administradors**: `GET /api/recycling-points/:region/status` i `POST /api/recycling-points/:region/refresh` per forçar sincronització immediata de la cache.

---

## 📂 Estructura del Projecte

```plaintext
├── /prisma/          # Esquema del model de dades i migracions SQL
├── /src/             # Codi font en TypeScript
│   ├── /api/         # Endpoints i controladors de l'API
│   ├── /data/        # Models i accés a dades
│   └── /services/    # Lògica de negoci i serveis
├── /tests/           # Tests del projecte
├── docker-compose.yml # Configuració de Docker per PostgreSQL i Adminer
├── .env.example      # Plantilla de variables d'entorn
└── package.json      # Dependències i scripts del projecte
```

---

## 📝 Logging i Schedulers

* **Logging Configurable**: El projecte incorpora un logger amb nivells i filtres per namespace controlats per variables d'entorn.
  * `LOG_LEVEL`: `error` | `warn` | `info` | `debug` | `trace` (per defecte: `info`).
  * `LOG_NAMESPACES`: llista separada per comes per filtrar namespaces (ex. `navarra-sync`, `cache`, `auth`).
* **Warmup i Schedulers**: 
  * El servidor executa un "warmup" (precàrrega de la cache de punts) només en producció (`NODE_ENV=production`).
  * Les tasques programades (cron) també s’inicien només en producció.
  * En desenvolupament, ambdós mecanismes es salten automàticament per evitar trànsit innecessari a APIs externes.

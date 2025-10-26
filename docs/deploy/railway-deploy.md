# Despliegue en Railway con GitHub y GitFlow (release/x.y.z)

Esta guía documenta, paso a paso, cómo desplegar este backend en Railway, conectado a GitHub y siguiendo GitFlow. Incluye configuración de variables, base de datos Postgres gestionada por Railway, migraciones Prisma y publicación automática a producción al fusionar a `master`.

---

## 🧭 Visión general

- Repositorio GitHub conectado a Railway.
- Producción se despliega automáticamente al merge en `master`.
- Flujo GitFlow: preparar una rama `release/x.y.z`, desplegarla a un entorno de pruebas (staging/preview) en Railway, validar y, cuando esté OK, fusionar a `master` para publicar en producción.
- Prisma aplica migraciones en el arranque.

---

## ✅ Prerrequisitos

- Acceso a Railway (cuenta/organización del proyecto).
- Repositorio GitHub con permisos para conectar a Railway.
- Archivo `.env` local para desarrollo (no se sube). Ver `.env.example`.
- Firebase Service Account (JSON) para Admin SDK.

---

## 1) Preparar el repositorio (GitFlow)

1. Desde `develop`, crea la rama de release:

```bash
git checkout develop
git pull origin develop
# Sustituye x.y.z por la versión
git checkout -b release/x.y.z
```

2. Opcional: subir número de versión en `package.json` y/o etiquetar más tarde.

3. Sube la rama y abre PR hacia `master` (NO fusiones aún):

```bash
git push -u origin release/x.y.z
```

En GitHub, crea el Pull Request `release/x.y.z -> master` para seguimiento/QA.

---

## 2) Crear servicios en Railway

Recomendado crear dos servicios en Railway (o usar entornos distintos en un servicio):

- "PESkaos-back Prod" → Rastrear rama `master`. Auto deploy activado.
- "PESkaos-back Release" → Rastrear rama `release/x.y.z`. Usado para pruebas previas.

Pasos:

1. En Railway, "New Project" → "Deploy from GitHub Repo" → selecciona este repo.
2. Duplica el servicio para tener uno de producción (branch `master`) y otro de release (branch `release/x.y.z`).
3. En cada servicio, configura el branch en Deploy → Settings → "Branch".

Opcional: usa "Preview Deployments" para que Railway cree deploys efímeros por PR.

---

## 3) Base de datos Postgres en Railway

1. En el proyecto Railway, añade un plugin "PostgreSQL" (Add New → Database → PostgreSQL).
2. Conecta el servicio del backend a esta base de datos (tab "Variables" o "Link Service").
3. Variables típicas que expone Railway para Postgres:
   - `DATABASE_URL` (principal para Prisma)
   - `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` (dependiendo del provider)

En este proyecto, Prisma usa `DATABASE_URL`. No necesitas los `PG*` en producción (solo se usan en Docker local).

---

## 4) Variables de entorno (Railway)

Configura estas variables en ambos servicios (Release y Prod). Usa valores reales:

- `DATABASE_URL` → desde el plugin Postgres.
- `JWT_SECRET` → secreto robusto.
- `JWT_EXPIRES_IN` → por ejemplo `24h`.
- `FIREBASE_WEB_API_KEY` → la de tu proyecto Firebase (para clientes cuando aplique).
- `NAVARRA_RESOURCE_ID`, `BARCELONA_RESOURCE_ID` → como en `.env.example`.
- `PORT` → Railway la inyecta automáticamente; puedes omitirla. El servidor lee `process.env.PORT`.

### Firebase Admin (clave de servicio)

**Opción A) Desde variable de entorno (✅ Recomendado - Más seguro)**

El código soporta leer las credenciales directamente desde una variable de entorno sin escribir archivo en disco:

- Crea una variable `FIREBASE_KEY_JSON` con el contenido completo del JSON de la service account.
- El código lee automáticamente esta variable y parsea el JSON en memoria.
- Start Command simplificado:

```bash
npm run migrate && npm start
```

**Ventajas de seguridad:**
- ✅ No hay archivo en disco que pueda filtrarse.
- ✅ El secreto solo existe en memoria durante la ejecución.
- ✅ Menor superficie de ataque (sin filesystem exposure).

**Opción B) Desde archivo temporal (desarrollo local)**

Para desarrollo local con Docker, el código mantiene soporte para `FIREBASE_KEY_PATH`:

- Define `FIREBASE_KEY_PATH=./firebase-service-account-key.json` en tu `.env` local.
- El código detecta automáticamente que no hay `FIREBASE_KEY_JSON` y usa el archivo.

**No necesitas cambiar nada en Railway si usas la Opción A.**

---

## 5) Build & Start en Railway

- Railway detecta Node y usa Nixpacks. Con `type: module` y `main: src/index.js`, todo OK.
- Start Command recomendado (migraciones + servidor):

```bash
npm run migrate && npm start
```

`npm start` ejecuta `node src/index.js`.

---

## 6) Migraciones Prisma en producción

- El script `npm run migrate` ejecuta `prisma migrate deploy && prisma generate`.
- Al iniciar, se aplican migraciones pendientes. Asegúrate de que `DATABASE_URL` apunta a la BD deseada (staging o prod).

> Recomendación: usar una base de datos separada para el servicio Release y el servicio Prod. Así validas migraciones antes de tocar la productiva.

---

## 7) Flujo de despliegue (end-to-end)

1. Crea/actualiza `release/x.y.z` desde `develop`.
2. Railway (servicio Release) despliega automáticamente la rama `release/x.y.z`.
3. Verifica logs y salud del servicio Release.
4. Ejecuta pruebas manuales: endpoints claves (`/api/users/sync`, `/api/users/me`, `/api/users/logout`).
5. Si todo OK, fusiona el PR `release/x.y.z -> master` en GitHub.
6. Railway (servicio Prod) despliega automáticamente la rama `master` a producción.
7. Tag opcional: crea un tag `vx.y.z` en GitHub.

---

## 8) Checklist de validación

- [ ] Variables de entorno configuradas en Release y Prod.
- [ ] `FIREBASE_KEY_JSON` configurado con el JSON completo de la service account.
- [ ] Conectado a Postgres correcto (`DATABASE_URL`).
- [ ] `npm run migrate` aplicado sin errores.
- [ ] Logs sin errores al arrancar:
  - `Firebase credentials loaded from FIREBASE_KEY_JSON (secure mode)`
  - `Firebase Admin SDK initialized successfully`
  - `Servidor Express corriendo en ...`
- [ ] Endpoints críticos responden 200: `/` health, `/api/users/me` con JWT válido.
- [ ] Logout invalida sesión (401 `INVALID_SESSION` tras logout).

---

## 9) Rollback rápido

- Railway guarda deploys anteriores. Desde el panel del servicio, selecciona un despliegue previo y **Rollback**.
- Alternativa Git: `revert` del commit en `master` → Railway redeploy.

---

## 10) Problemas frecuentes y soluciones

- **"PrismaClientInitializationError / credenciales inválidas"**: verifica `DATABASE_URL` y que el servicio está vinculado al Postgres correcto. Comprueba que el password no tenga caracteres especiales sin URL-encode.
- **Errores de Firebase al iniciar**: 
  - Asegúrate de que `FIREBASE_KEY_JSON` contiene el JSON completo y válido (copia-pega directo desde el archivo descargado de Firebase Console).
  - Verifica que el JSON no tenga saltos de línea rotos o caracteres escapados incorrectamente en Railway.
  - Comprueba logs: debe aparecer `Firebase credentials loaded from FIREBASE_KEY_JSON (secure mode)`.
- **401/`INVALID_SESSION`**: recuerda que `/api/users/logout` elimina la sesión en BD; el mismo JWT no funcionará después (esperado).
- **Puerto**: Railway inyecta `PORT`; nuestro servidor lo usa automáticamente. No fuerces `3000` en producción.

---

## 11) Referencias

- Railway docs: https://docs.railway.app/
- Prisma deploy: https://www.prisma.io/docs/guides/deployment/deployment-guides
- Firebase Admin: https://firebase.google.com/docs/admin

---

## Apéndice A: Variables mínimas (producción)

**Variables obligatorias:**
- `DATABASE_URL` (desde el plugin Postgres de Railway)
- `JWT_SECRET` (secreto robusto, mínimo 32 caracteres)
- `JWT_EXPIRES_IN` (p. ej. `24h`)
- `FIREBASE_KEY_JSON` (contenido completo del JSON de la service account)
- `FIREBASE_WEB_API_KEY` (Web API Key de tu proyecto Firebase)
- `NAVARRA_RESOURCE_ID` (ID del recurso CKAN)
- `BARCELONA_RESOURCE_ID` (ID del recurso CKAN)

**Start Command:**

```bash
npm run migrate && npm start
```

**Notas de seguridad:**
- ✅ `FIREBASE_KEY_JSON` se lee en memoria, nunca se escribe en disco.
- ✅ Railway encripta las variables de entorno en reposo.
- ✅ No expongas estos valores en logs, código cliente o repos públicos.

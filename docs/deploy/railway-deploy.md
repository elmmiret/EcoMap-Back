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

El código actual espera `FIREBASE_KEY_PATH` apuntando a un fichero JSON. En Railway no hay sistema de archivos persistente pre-configurado, así que hay dos opciones:

A) Sin cambiar código (recomendado aquí)

- Crea una variable `FIREBASE_KEY_JSON` con el contenido completo del JSON de la service account.
- Crea otra variable `FIREBASE_KEY_PATH` con el valor `/tmp/firebase.json`.
- Establece el Start Command en Railway (Service → Settings → Start Command) a:

```
bash -lc 'echo "$FIREBASE_KEY_JSON" > /tmp/firebase.json && npm run migrate && npm start'
```

Esto:
1) Escribe el JSON en `/tmp/firebase.json` en tiempo de arranque.
2) Ejecuta migraciones de Prisma.
3) Levanta el servidor con `npm start`.

B) Cambiando código (alternativa)

- Modificar `src/config/firebase.js` para aceptar un `FIREBASE_KEY_JSON` y parsearlo directamente si existe. (No incluido aquí por mantener el alcance en documentación.)

---

## 5) Build & Start en Railway

- Railway detecta Node y usa Nixpacks. Con `type: module` y `main: src/index.js`, todo OK.
- Sugerido Start Command (con migraciones y firebase file):

```
bash -lc 'echo "$FIREBASE_KEY_JSON" > /tmp/firebase.json && npm run migrate && npm start'
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
- [ ] `FIREBASE_KEY_JSON` creado, Start Command escribe `/tmp/firebase.json`.
- [ ] Conectado a Postgres correcto (`DATABASE_URL`).
- [ ] `npm run migrate` aplicado sin errores.
- [ ] Logs sin errores al arrancar (`Firebase Admin SDK initialized successfully`, `Servidor Express corriendo en ...`).
- [ ] Endpoints críticos responden 200: `/` health, `/api/users/me` con JWT válido.
- [ ] Logout invalida sesión (401 `INVALID_SESSION` tras logout).

---

## 9) Rollback rápido

- Railway guarda deploys anteriores. Desde el panel del servicio, selecciona un despliegue previo y **Rollback**.
- Alternativa Git: `revert` del commit en `master` → Railway redeploy.

---

## 10) Problemas frecuentes y soluciones

- "PrismaClientInitializationError / credenciales inválidas": verifica `DATABASE_URL` y que el servicio está vinculado al Postgres correcto. Comprueba que el password no tenga caracteres especiales sin URL-encode.
- Errores de Firebase al iniciar: asegúrate de que `FIREBASE_KEY_JSON` es válido, `FIREBASE_KEY_PATH=/tmp/firebase.json` y el Start Command escribe el archivo antes de arrancar.
- 401/`INVALID_SESSION`: recuerda que `/api/users/logout` elimina la sesión en BD; el mismo JWT no funcionará después (esperado).
- Puerto: Railway inyecta `PORT`; nuestro servidor lo usa automáticamente. No fuerces `3000` en producción.

---

## 11) Referencias

- Railway docs: https://docs.railway.app/
- Prisma deploy: https://www.prisma.io/docs/guides/deployment/deployment-guides
- Firebase Admin: https://firebase.google.com/docs/admin

---

## Apéndice A: Variables mínimas (producción)

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (p. ej. `24h`)
- `FIREBASE_KEY_JSON` (contenido del JSON)
- `FIREBASE_KEY_PATH` = `/tmp/firebase.json`
- `FIREBASE_WEB_API_KEY`
- `NAVARRA_RESOURCE_ID`, `BARCELONA_RESOURCE_ID`

Start Command sugerido:

```
bash -lc 'echo "$FIREBASE_KEY_JSON" > /tmp/firebase.json && npm run migrate && npm start'
```

# EcoMap Backend

**Backend del projecte EcoMap utilitzant Node.js, Express, TypeScript i Prisma amb PostgreSQL**.

---

## Requisits Previs

- **Node.js** >= 18
- **Docker Desktop** (inclou Docker Compose)
- **Git**

---

## 1. Clona el repositori

```

git clone https://github.com/pes2526q1-1x-gei-upc/PESkaos-back.git
cd PESkaos-back

```

---

## 2. Instal·la les dependències

```

npm install

```

---

## 3. Configura l'entorn de variables

- Obté les credencials reals del canal **#archivos-back** del servidor de Discord de l'equip:
  - Descarrega l'arxiu `.env.txt` i renombra'l a `.env` a l'arrel del projecte
  - Descarrega l'arxiu `firebase-service-account-key.json` i col·loca'l a l'arrel del projecte

**⚠️ IMPORTANT: Mai pugis el teu `.env` ni el `firebase-service-account-key.json` al repositori. Assegura't que estan al teu `.gitignore`.**

---

## 4. Aixeca la base de dades amb Docker

Assegura't de tenir Docker Desktop obert i després executa:

```

docker compose up -d

```

Això arrencarà el contenidor de PostgreSQL configurat per al projecte.

**Si ja tenies un contenidor i has oblidat la contrasenya, pots crear de nou el contenidor amb les noves credencials de .env utilitzant:**

```
docker compose down --volumes
docker compose up -d
```

---

## 5. Estructura la base de dades amb Prisma

Aplica totes les migracions existents (estructura de taules, enums, etc):

```

npm run migrate

```

Això aplicarà automàticament cada migració necessària sobre la teva base de dades a Docker.

---

## 6. Desenvolupa localment

Arrenca el backend en mode desenvolupament:

```

npm run dev

```

---

## 7. Documentació de l'API (Swagger)

El projecte inclou una interfície interactiva (Swagger UI) per explorar i provar els endpoints de l'API sense necessitat d'escriure codi.

Per accedir-hi:

1. Assegura't que el servidor està en marxa (`npm run dev`).
2. Obre el teu navegador i visita:

   👉 **http://localhost:3001/api-docs**

Allà trobaràs:

- Tots els endpoints disponibles (Usuaris, Punts de Reciclatge, Rutes, etc.).
- Els esquemes de dades (JSON) que s'han d'enviar i rebre.
- Botó **"Try it out"** per fer peticions reals directament contra el teu backend local.

## **Nota:** Per als endpoints protegits (cadenat 🔒), recorda autenticar-te primer amb el botó "Authorize" utilitzant el token corresponent (Firebase o Backend JWT).

---

## Comandes útils

| Comanda           | Descripció                                                           |
| ----------------- | -------------------------------------------------------------------- |
| `npm run dev`     | Executa el servidor en mode desenvolupament amb recàrrega automàtica |
| `npm run build`   | Compila el projecte TypeScript a JavaScript                          |
| `npm run start`   | Executa el servidor compilat en producció                            |
| `npm run migrate` | Aplica totes les migracions de la base de dades pendents             |
| `npm run lint`    | Revisa el codi amb ESLint                                            |
| `npm run format`  | Formata el codi amb Prettier                                         |
| `npm test`        | Executa els tests amb Vitest                                         |

---

## Ús de Prisma al codi

Per realitzar queries a la base de dades, utilitza **Prisma Client**. Per evitar crear múltiples connexions a la base de dades (especialment en desenvolupament amb hot-reload), el projecte exposa una instància singleton a `src/lib/prisma.js`.

Importa-la i utilitza-la així:

````js
import { prisma } from '#lib/prisma.js';

// Exemple de query
const users = await prisma.user.findMany();

## Logging configurable (nivell i namespaces)

El projecte incorpora un logger amb nivells i filtres per namespace controlats per variables d'entorn. Per defecte, el nivell és `info` i mostra només els missatges rellevants.

- Variables d'entorn:
  - `LOG_LEVEL`: `error` | `warn` | `info` | `debug` | `trace` (per defecte: `info`)
  - `LOG_NAMESPACES`: llista separada per comes amb patrons amb `*` (comodí). Si es deixa buit, es mostren tots els namespaces per nivells ≤ `info`.

- Namespaces principals disponibles:
  - `startup` (arrencada del servidor)
  - `scheduler` (cron i warmup)
  - `navarra-sync` (descàrrega i sincronització de Navarra)
  - `cache` (SWR i actualitzacions de cache)
  - `sync-job` (job genèric de sincronització)
  - `recycling-points` (controlador d’endpoint)
  - `route-service` (càlcul de rutes ORS)
  - `auth` (verificació de tokens, claims, etc.)

- Exemples d’ús al `.env`:

```bash
# Veure només informació rellevant (per defecte)
LOG_LEVEL=info

# Depurar només la sincronització de Navarra
LOG_LEVEL=debug
LOG_NAMESPACES=navarra-sync

# Depurar cache i scheduler a la vegada
LOG_LEVEL=debug
LOG_NAMESPACES=cache,scheduler

# Veure TOT (només recomanat puntualment en local)
LOG_LEVEL=trace
LOG_NAMESPACES=*
````

Vegeu `.env.example` per a més exemples comentats.

---

## Warmup i Schedulers segons l'entorn

- El servidor executa un "warmup" (precàrrega de la cache de punts) només en producció (`NODE_ENV=production`).
- Les tasques programades (cron) també s’inicien només en producció.
- En desenvolupament, amb `NODE_ENV=development`, ambdós mecanismes es salten automàticament per evitar trànsit innecessari a APIs externes.

```

Prisma facilita les operacions amb la base de dades de forma segura i tipada, sense necessitat d'escriure SQL manualment en la majoria de casos.

---

## Notes importants / Bones pràctiques

- **NO pugis arxius `.env` amb credencials reals a cap repositori.**

- Si necessites fer canvis a les migracions, fes-ho editant l'arxiu `prisma/schema.prisma` i genera una nova migració amb el següent format de nom:

```

npx prisma migrate dev --name <numero*migracio>*<nom_canvi>

```

**Per obtenir el número de migració correcte:**

1. Entra a la carpeta `prisma/migrations/`
2. Veuràs carpetes amb el format `<data>_<numero_migracio>_<nom_canvi>`
3. L'últim número que vegis serà l'últim número de migració utilitzat. La teva nova migració ha d'utilitzar el número següent.

- Cada vegada que algú de l'equip afegeixi una migració nova i la integris al repo, només cal que tornis a executar `npm run migrate` per actualitzar la teva base de dades local.

- Per accedir a la interfície d'administració de la base de dades (Adminer), obre el teu navegador a:
  **http://localhost:8080**

- Consulta la documentació oficial de Prisma si tens dubtes sobre migracions, resets o sincronització d'esquemes: https://www.prisma.io/docs

---

## Estructura rellevant del projecte

```

├── /prisma/ # Esquema del model de dades i migracions SQL
├── /src/ # Codi font en TypeScript
│ ├── /api/ # Endpoints i controladors de l'API
│ ├── /data/ # Models i accés a dades
│ └── /services/ # Lògica de negoci i serveis
├── /tests/ # Tests del projecte
├── docker-compose.yml # Configuració de Docker per PostgreSQL i Adminer
├── .env.example # Plantilla de variables d'entorn
└── package.json # Dependències i scripts del projecte

```

---

```

```

```

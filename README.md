Aquí tienes el README traducido al catalán:

```markdown
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

- Copia l'arxiu d'exemple de variables:

```

cp .env.example .env

```

- Edita el nou `.env` amb les teves pròpies credencials/configuracions.

**⚠️ IMPORTANT: Mai pugis el teu `.env` al repositori. Assegura't que està al teu `.gitignore`.**

---

## 4. Aixeca la base de dades amb Docker

Assegura't de tenir Docker Desktop obert i després executa:

```

docker-compose up -d

```

Això arrencarà el contenidor de PostgreSQL configurat per al projecte.

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

## Comandes útils

| Comanda | Descripció |
|---------|-------------|
| `npm run dev` | Executa el servidor en mode desenvolupament amb recàrrega automàtica |
| `npm run build` | Compila el projecte TypeScript a JavaScript |
| `npm run start` | Executa el servidor compilat en producció |
| `npm run migrate` | Aplica totes les migracions de la base de dades pendents |
| `npm run lint` | Revisa el codi amb ESLint |
| `npm run format` | Formata el codi amb Prettier |
| `npm test` | Executa els tests amb Vitest |

---

## Ús de Prisma al codi

Per realitzar queries a la base de dades, utilitza **Prisma Client**. Importa i utilitza Prisma d'aquesta manera:

```

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Exemple de query
const users = await prisma.user.findMany();

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

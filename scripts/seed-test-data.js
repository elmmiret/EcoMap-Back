import { PrismaClient } from '@prisma/client';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.join(__dirname, '../firebase-service-account-key.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const prisma = new PrismaClient();

const testUsers = [
  {
    email: 'user1@test.com',
    password: 'User123456!',
    name: 'Juan',
    surname: 'García',
    username: 'juangarcia',
    role: 'client',
  },
  {
    email: 'user2@test.com',
    password: 'User123456!',
    name: 'María',
    surname: 'López',
    username: 'marialopez',
    role: 'client',
  },
  {
    email: 'user3@test.com',
    password: 'User123456!',
    name: 'Carlos',
    surname: 'Rodríguez',
    username: 'carlosrodriguez',
    role: 'client',
  },
  {
    email: 'institution1@test.com',
    password: 'Institution123456!',
    name: 'Fundación Sostenible',
    surname: 'España',
    username: 'fundacion_sostenible',
    role: 'institution',
  },
];

const reasons = ['inappropriate_content', 'harassment', 'fake_profile', 'spam', 'other'];
const descriptions = [
  'Este usuario publica contenido ofensivo constantemente',
  'He recibido mensajes acosadores de este usuario',
  'El perfil parece ser falso, usa información robada',
  'Este usuario envía spam repetidamente',
  'Comportamiento sospechoso en general',
];

async function seedTestData() {
  try {
    console.log('🌱 Iniciando seed de datos de prueba...\n');

    // 1. Create Firebase users and sync them with database
    const createdUsers = [];

    for (const user of testUsers) {
      console.log(`📝 Creando usuario: ${user.email}...`);
      try {
        // Create in Firebase
        const firebaseUser = await admin.auth().createUser({
          email: user.email,
          password: user.password,
          displayName: `${user.name} ${user.surname}`,
        });

        // Create in database
        await prisma.user.create({
          data: {
            user_id: firebaseUser.uid,
          },
        });

        await prisma.registered_user.create({
          data: {
            user_id: firebaseUser.uid,
            email: user.email,
            name: user.name,
            surname: user.surname,
            username: user.username,
            app_language: 'es',
          },
        });

        // Create role-specific records
        if (user.role === 'client') {
          await prisma.client.create({
            data: {
              user_id: firebaseUser.uid,
              points: Math.floor(Math.random() * 500),
              streak: Math.floor(Math.random() * 10),
            },
          });
        } else if (user.role === 'institution') {
          await prisma.institution.create({
            data: {
              user_id: firebaseUser.uid,
            },
          });
        }

        createdUsers.push({
          uid: firebaseUser.uid,
          email: user.email,
          username: user.username,
          role: user.role,
        });

        console.log(`✅ Usuario creado: ${user.email} (UID: ${firebaseUser.uid})\n`);
      } catch (error) {
        if (error.code === 'auth/email-already-exists') {
          console.log(`⏭️  Usuario ya existe: ${user.email}\n`);
          // Get existing user
          const existingUser = await admin.auth().getUserByEmail(user.email);
          createdUsers.push({
            uid: existingUser.uid,
            email: user.email,
            username: user.username,
            role: user.role,
          });
        } else {
          console.error(`❌ Error creando usuario ${user.email}:`, error.message);
        }
      }
    }

    // 2. Create test reports between users
    if (createdUsers.length >= 3) {
      console.log(`\n📊 Creando reportes de prueba...\n`);

      // Get client users (not institution)
      const clientUsers = createdUsers.filter((u) => u.role === 'client');

      for (let i = 0; i < clientUsers.length - 1; i++) {
        const reporter = clientUsers[i];
        const reportedUser = clientUsers[i + 1];
        const reason = reasons[Math.floor(Math.random() * reasons.length)];
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];
        const status = ['Pending', 'Resolved', 'Dismissed'][Math.floor(Math.random() * 3)];

        try {
          await prisma.user_report.create({
            data: {
              reporter_id: reporter.uid,
              reported_user_id: reportedUser.uid,
              reason: reason,
              description: description,
              status: status,
            },
          });

          console.log(`✅ Reporte creado: ${reporter.username} → ${reportedUser.username} (${reason}, ${status})`);
        } catch (error) {
          console.error(`❌ Error creando reporte:`, error.message);
        }
      }

      // Create some additional reports with different patterns
      for (let i = 0; i < 3; i++) {
        const reporter = clientUsers[Math.floor(Math.random() * clientUsers.length)];
        const reported = clientUsers[Math.floor(Math.random() * clientUsers.length)];

        if (reporter.uid !== reported.uid) {
          try {
            await prisma.user_report.create({
              data: {
                reporter_id: reporter.uid,
                reported_user_id: reported.uid,
                reason: reasons[Math.floor(Math.random() * reasons.length)],
                description: descriptions[Math.floor(Math.random() * descriptions.length)],
                status: ['Pending', 'Resolved', 'Dismissed'][Math.floor(Math.random() * 3)],
              },
            });

            console.log(`✅ Reporte adicional creado: ${reporter.username} → ${reported.username}`);
          } catch {
            // Silently ignore if report already exists
          }
        }
      }
    }

    console.log('\n✨ ¡Seed completado exitosamente!');
    console.log('\n📋 Usuarios de prueba creados:');
    createdUsers.forEach((user) => {
      console.log(`  • ${user.email} (${user.role})`);
    });

    console.log('\n🔐 Credenciales:');
    console.log('  Password: User123456! o Institution123456!');
  } catch (error) {
    console.error('❌ Error en seed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

seedTestData();

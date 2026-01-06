import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SAMPLE_IMAGES = [
    'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=400',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
    'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400',
];

async function seedPublications() {
    console.log('🌱 Iniciando seed de publicaciones...\n');

    try {
        // 1. Buscar usuarios para asignar publicaciones
        const clients = await prisma.client.findMany({
            take: 3,
            include: { registered_user: true },
        });

        const institutions = await prisma.institution.findMany({
            take: 2,
            include: { registered_user: true },
        });

        if (clients.length === 0) {
            console.log('❌ No se encontraron clientes. Ejecuta seed-test-data.js primero.');
            return;
        }

        if (institutions.length === 0) {
            console.log('⚠️  No se encontraron instituciones. Solo se crearán trades.');
        }

        console.log(`✅ Encontrados ${clients.length} clientes y ${institutions.length} instituciones\n`);

        // 2. Crear Trades
        console.log('📦 Creando Trades...');

        const tradeData = [
            {
                title: 'Bicicleta de montaña usada',
                description: 'Bicicleta en buen estado, ideal para rutas de montaña. Poco uso.',
                item_state: 'Little_used',
                points_price: 1500,
                has_image: true,
            },
            {
                title: 'Libros de programación',
                description: 'Colección de 5 libros sobre JavaScript, Python y desarrollo web.',
                item_state: 'Widely_used',
                points_price: 300,
                has_image: false,
            },
            {
                title: 'Portátil HP',
                description: 'Laptop HP de 15 pulgadas, funciona perfectamente. Batería nueva.',
                item_state: 'Little_used',
                points_price: 2000,
                has_image: true,
            },
            {
                title: 'Muebles de jardín',
                description: 'Mesa y 4 sillas para exterior. Necesitan algo de mantenimiento.',
                item_state: 'Bad_condition',
                points_price: 500,
                has_image: true,
            },
            {
                title: 'Consola PlayStation 4',
                description: 'PS4 en perfecto estado, incluye 3 juegos.',
                item_state: 'New',
                points_price: 1800,
                has_image: true,
            },
            {
                title: 'Ropa de invierno',
                description: 'Lote de abrigos y chaquetas en buen estado, varias tallas.',
                item_state: 'Widely_used',
                points_price: 200,
                has_image: false,
            },
        ];

        let tradesCreated = 0;
        for (let i = 0; i < tradeData.length; i++) {
            const data = tradeData[i];
            const client = clients[i % clients.length];

            const publication = await prisma.publication.create({
                data: {
                    title: data.title,
                    description: data.description,
                    date: new Date(),
                    publication_state: i % 3 === 0 ? 'Completed' : i % 4 === 0 ? 'Cancelled' : 'Pending',
                    client_id: client.user_id,
                },
            });

            await prisma.trade.create({
                data: {
                    publication_id: publication.publication_id,
                    item_state: data.item_state,
                    points_price: data.points_price,
                },
            });

            if (data.has_image) {
                await prisma.publication_media.create({
                    data: {
                        publication_id: publication.publication_id,
                        media_url: SAMPLE_IMAGES[i % SAMPLE_IMAGES.length],
                    },
                });
            }

            tradesCreated++;
            console.log(`  ✓ Trade: "${data.title}" (${data.item_state})${data.has_image ? ' + imagen' : ''}`);
        }

        console.log(`\n✅ ${tradesCreated} trades creados\n`);

        // 3. Crear Rewards (solo si hay instituciones)
        if (institutions.length > 0) {
            console.log('🎁 Creando Rewards...');

            const rewardData = [
                {
                    title: 'Descuento 20% en productos ecológicos',
                    description: 'Cupón de descuento aplicable en nuestra tienda física.',
                    content: 'Válido por 30 días. Presentar código al realizar la compra. No acumulable con otras ofertas.',
                    points_price: 500,
                    has_image: true,
                },
                {
                    title: 'Entrada gratis al museo de ciencias',
                    description: 'Una entrada individual para visitar el museo.',
                    content: 'Válido de lunes a viernes. Reserva previa llamando al 900-123-456.',
                    points_price: 1000,
                    has_image: true,
                },
                {
                    title: 'Kit de semillas orgánicas',
                    description: 'Pack de 10 tipos de semillas para cultivar en casa.',
                    content: 'Incluye guía de cultivo. Recogida en nuestras oficinas durante horario laboral.',
                    points_price: 500,
                    has_image: false,
                },
                {
                    title: 'Taller de compostaje gratuito',
                    description: 'Participa en nuestro taller de 2 horas sobre compostaje doméstico.',
                    content: 'Próximas fechas: 15 y 22 de enero. Plazas limitadas. Inscripción previa necesaria.',
                    points_price: 2000,
                    has_image: true,
                },
                {
                    title: 'Bolsa reutilizable premium',
                    description: 'Bolsa de tela de alta calidad con diseño exclusivo.',
                    content: 'Material 100% algodón orgánico. Recogida en tienda o envío a domicilio (5€).',
                    points_price: 1000,
                    has_image: false,
                },
                {
                    title: 'Consulta gratuita de reciclaje',
                    description: 'Sesión de 1 hora con experto en gestión de residuos.',
                    content: 'Presencial u online. Agenda tu cita enviando email a consultas@ecoinstituto.com',
                    points_price: 5000,
                    has_image: true,
                },
            ];

            let rewardsCreated = 0;
            for (let i = 0; i < rewardData.length; i++) {
                const data = rewardData[i];
                const institution = institutions[i % institutions.length];

                const publication = await prisma.publication.create({
                    data: {
                        title: data.title,
                        description: data.description,
                        date: new Date(),
                        publication_state: i % 5 === 0 ? 'Completed' : 'Pending',
                        institution_id: institution.user_id,
                    },
                });

                await prisma.reward.create({
                    data: {
                        publication_id: publication.publication_id,
                        content: data.content,
                        points_price: data.points_price,
                        available: i % 4 !== 0, // 75% disponibles
                    },
                });

                if (data.has_image) {
                    await prisma.publication_media.create({
                        data: {
                            publication_id: publication.publication_id,
                            media_url: SAMPLE_IMAGES[(i + 2) % SAMPLE_IMAGES.length],
                        },
                    });
                }

                rewardsCreated++;
                console.log(`  ✓ Reward: "${data.title}" (${data.points_price} pts)${data.has_image ? ' + imagen' : ''}`);
            }

            console.log(`\n✅ ${rewardsCreated} rewards creados\n`);
        }

        const totalRewards = institutions.length > 0 ? 6 : 0;

        console.log('🎉 Seed de publicaciones completado exitosamente!\n');
        console.log('📊 Resumen:');
        console.log(`   - Trades: ${tradesCreated}`);
        console.log(`   - Rewards: ${totalRewards}`);
        console.log(`   - Total: ${tradesCreated + totalRewards} publicaciones\n`);

    } catch (error) {
        console.error('❌ Error durante el seed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Ejecutar el seed
seedPublications()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });

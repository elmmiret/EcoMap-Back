import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const BACKEND_JWT = process.argv[2];

if (!BACKEND_JWT) {
  console.error('❌ Error: Debes proporcionar el JWT del backend como argumento');
  console.error('\nUso: npm run seed:recycling -- <backend_jwt>');
  console.error('\nPara obtener el JWT del backend:');
  console.error('1. Genera un Firebase token: npm run token:firebase -- <admin_uid>');
  console.error('2. Haz login en el dashboard o usa curl para /api/users/sync');
  console.error('3. Copia el JWT que recibes y úsalo aquí\n');
  process.exit(1);
}

async function createRecyclingItem(item) {
  try {
    const response = await fetch(`${API_URL}/api/recycling-guide`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BACKEND_JWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: item.name,
        keywords: item.keywords,
        containerType: item.container_type, // Backend espera camelCase
        description: item.description,
      }),
    });

    if (response.status === 201) {
      return { success: true, message: 'Created' };
    } else {
      const errorData = await response.json();
      return { success: false, message: errorData.message || 'Unknown error' };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
}

const recyclingItems = [
  // Plástico
  {
    name: 'Botella de plástico',
    keywords: ['botella', 'plástico', 'bebida', 'agua'],
    container_type: 'PlasticContainer',
    description: 'Botellas de agua, refrescos o jugos de plástico. Enjuaga antes de reciclar.',
  },
  {
    name: 'Bolsa de plástico',
    keywords: ['bolsa', 'plástico', 'compra'],
    container_type: 'PlasticContainer',
    description: 'Bolsas de compra y otras bolsas de plástico de un solo uso.',
  },
  {
    name: 'Envase de yogur',
    keywords: ['yogur', 'lácteo', 'envase', 'plástico'],
    container_type: 'PlasticContainer',
    description: 'Envases de yogur, pudín y otros productos lácteos.',
  },
  {
    name: 'Taper o contenedor de plástico',
    keywords: ['taper', 'contenedor', 'comida', 'plástico'],
    container_type: 'PlasticContainer',
    description: 'Recipientes de plástico para almacenar comida. Limpios y secos.',
  },
  {
    name: 'Cepillo de dientes',
    keywords: ['cepillo', 'dientes', 'higiene', 'plástico'],
    container_type: 'PlasticContainer',
    description: 'Cepillos de dientes de plástico usados. No reciclable si contiene metales.',
  },

  // Vidrio
  {
    name: 'Botella de vidrio',
    keywords: ['botella', 'vidrio', 'bebida', 'alcohol'],
    container_type: 'GlassContainer',
    description: 'Botellas de vino, cerveza, agua o refrescos de vidrio. Enjuaga bien.',
  },
  {
    name: 'Frasco de conservas',
    keywords: ['frasco', 'conserva', 'vidrio', 'alimento'],
    container_type: 'GlassContainer',
    description: 'Frascos de mermelada, encurtidos o conservas de vidrio.',
  },
  {
    name: 'Vaso de vidrio',
    keywords: ['vaso', 'vidrio', 'bebida'],
    container_type: 'GlassContainer',
    description: 'Vasos de vidrio rotos o dañados. Ten cuidado al transportar.',
  },
  {
    name: 'Espejo',
    keywords: ['espejo', 'vidrio', 'reflejo'],
    container_type: 'GlassContainer',
    description: 'Espejos rotos o antiguos. Envuelve en papel para evitar cortes.',
  },
  {
    name: 'Bombilla de vidrio',
    keywords: ['bombilla', 'vidrio', 'luz', 'iluminación'],
    container_type: 'GlassContainer',
    description: 'Bombillas incandescentes o halógenas de vidrio (no LED).',
  },

  // Papel/Cartón
  {
    name: 'Periódico',
    keywords: ['periódico', 'prensa', 'papel', 'noticia'],
    container_type: 'PaperContainer',
    description: 'Periódicos viejos y revistas de papel. Seco y limpio.',
  },
  {
    name: 'Caja de cartón',
    keywords: ['caja', 'cartón', 'embalaje'],
    container_type: 'PaperContainer',
    description: 'Cajas de cartón corrugado. Desmontadas y aplastadas.',
  },
  {
    name: 'Papel de periódico',
    keywords: ['papel', 'periódico', 'blanco', 'escritura'],
    container_type: 'PaperContainer',
    description: 'Papel blanco de escritura o impresión, cuadernos usados.',
  },
  {
    name: 'Envase de cartón para bebidas',
    keywords: ['tetra pak', 'zumo', 'leche', 'cartón'],
    container_type: 'PaperContainer',
    description: 'Envases de zumos, leche o bebidas en cartón. Enjuagados.',
  },
  {
    name: 'Bolsa de papel',
    keywords: ['bolsa', 'papel', 'compra', 'kraft'],
    container_type: 'PaperContainer',
    description: 'Bolsas de papel para compra o almacenaje.',
  },
  {
    name: 'Cartulina o cartón fino',
    keywords: ['cartulina', 'cartón', 'fino', 'papelería'],
    container_type: 'PaperContainer',
    description: 'Cartulina, cartón fino o papelería diversa.',
  },

  // Orgánico
  {
    name: 'Restos de comida',
    keywords: ['comida', 'residuo', 'basura', 'orgánico'],
    container_type: 'OrganicContainer',
    description: 'Restos de frutas, verduras, huesos y otros alimentos.',
  },
  {
    name: 'Hojas y ramas',
    keywords: ['hoja', 'rama', 'árbol', 'poda', 'jardín'],
    container_type: 'OrganicContainer',
    description: 'Hojas, ramas pequeñas y residuos de poda del jardín.',
  },
  {
    name: 'Cáscaras de huevo',
    keywords: ['huevo', 'cáscara', 'cocina'],
    container_type: 'OrganicContainer',
    description: 'Cáscaras de huevo y otros residuos de cocina.',
  },
  {
    name: 'Posos de café',
    keywords: ['café', 'poso', 'bebida'],
    container_type: 'OrganicContainer',
    description: 'Posos de café y filtros de papel compostables.',
  },
  {
    name: 'Corcho',
    keywords: ['corcho', 'botella', 'vino', 'natural'],
    container_type: 'OrganicContainer',
    description: 'Corchos naturales de botellas de vino.',
  },

  // Electrónico
  {
    name: 'Teléfono móvil',
    keywords: ['móvil', 'celular', 'smartphone', 'electrónico'],
    container_type: 'ElectricContainer',
    description: 'Teléfonos móviles o celulares viejos. Retirar batería si es posible.',
  },
  {
    name: 'Cable USB',
    keywords: ['cable', 'usb', 'carga', 'electrónico'],
    container_type: 'ElectricContainer',
    description: 'Cables USB, HDMI y otros cables electrónicos dañados.',
  },
  {
    name: 'Batería recargable',
    keywords: ['batería', 'recargable', 'litio', 'electrónico'],
    container_type: 'ElectricContainer',
    description: 'Baterías recargables de teléfonos, cámaras o herramientas.',
  },
  {
    name: 'Bombilla LED',
    keywords: ['bombilla', 'led', 'luz', 'ahorro'],
    container_type: 'ElectricContainer',
    description: 'Bombillas LED y de bajo consumo. No son vidrio común.',
  },
  {
    name: 'Teclado o ratón',
    keywords: ['teclado', 'ratón', 'mouse', 'ordenador'],
    container_type: 'ElectricContainer',
    description: 'Teclados, ratones y periféricos de ordenador dañados.',
  },
  {
    name: 'Auriculares',
    keywords: ['auriculares', 'headphones', 'audio', 'electrónico'],
    container_type: 'ElectricContainer',
    description: 'Auriculares, headphones o altavoces rotos.',
  },
  {
    name: 'Cargador',
    keywords: ['cargador', 'adaptador', 'electrónico'],
    container_type: 'ElectricContainer',
    description: 'Cargadores y adaptadores de corriente obsoletos o dañados.',
  },

  // Textil
  {
    name: 'Camiseta de algodón',
    keywords: ['camiseta', 'algodón', 'ropa', 'prenda'],
    container_type: 'TextileContainer',
    description: 'Camisetas de algodón sin daños significativos.',
  },
  {
    name: 'Pantalones vaqueros',
    keywords: ['pantalón', 'vaquero', 'denim', 'ropa'],
    container_type: 'TextileContainer',
    description: 'Pantalones de vaquero o algodón en desuso.',
  },
  {
    name: 'Sudadera',
    keywords: ['sudadera', 'jersey', 'punto', 'ropa'],
    container_type: 'TextileContainer',
    description: 'Sudaderas, jerseys y prendas de punto antigua.',
  },
  {
    name: 'Toalla de algodón',
    keywords: ['toalla', 'baño', 'algodón', 'tela'],
    container_type: 'TextileContainer',
    description: 'Toallas de baño o playa de algodón.',
  },
  {
    name: 'Calcetines',
    keywords: ['calcetín', 'media', 'prenda', 'tela'],
    container_type: 'TextileContainer',
    description: 'Calcetines y medias de algodón o mezcla de fibras.',
  },
  {
    name: 'Sabana de cama',
    keywords: ['sabana', 'cama', 'dormitorio', 'textil'],
    container_type: 'TextileContainer',
    description: 'Sábanas de cama viejas o dañadas.',
  },
  {
    name: 'Cortina',
    keywords: ['cortina', 'tela', 'ventana', 'textil'],
    container_type: 'TextileContainer',
    description: 'Cortinas de tela o visillos antiguos.',
  },

  // No reciclable
  {
    name: 'Pañal desechable',
    keywords: ['pañal', 'bebé', 'desechable', 'higiene'],
    container_type: 'Unrecyclable',
    description: 'Pañales usados y productos de higiene personal.',
  },
  {
    name: 'Papel de cocina sucio',
    keywords: ['papel', 'cocina', 'servilleta', 'sucio'],
    container_type: 'Unrecyclable',
    description: 'Papel de cocina o servilletas manchadas con grasa o suciedad.',
  },
  {
    name: 'Chicle',
    keywords: ['chicle', 'chiclete', 'goma', 'dulce'],
    container_type: 'Unrecyclable',
    description: 'Chicle masticado o goma de mascar.',
  },
  {
    name: 'Papel carbón',
    keywords: ['papel', 'carbón', 'copia', 'tinta'],
    container_type: 'Unrecyclable',
    description: 'Papel carbón o similar con revestimiento especial.',
  },
  {
    name: 'Esterilina o porcelana rota',
    keywords: ['porcelana', 'cerámica', 'roto', 'plato'],
    container_type: 'Unrecyclable',
    description: 'Platos, tazas o porcelana rota. No se reciclan como vidrio.',
  },
];

async function seedRecyclingGuide() {
  try {
    console.log('🌱 Iniciando seed de Guía de Reciclaje...\n');

    let createdCount = 0;
    let errorCount = 0;

    for (let i = 0; i < recyclingItems.length; i++) {
      const item = recyclingItems[i];
      const result = await createRecyclingItem(item);

      if (result.success) {
        createdCount++;
        console.log(`✅ [${i + 1}/${recyclingItems.length}] ${item.name} (${item.container_type})`);
      } else {
        errorCount++;
        console.log(`⚠️  [${i + 1}/${recyclingItems.length}] ${item.name} - Error: ${result.message}`);
      }

      // Mostrar progreso cada 10 items
      if ((i + 1) % 10 === 0) {
        console.log(`\n📊 Progreso: ${i + 1}/${recyclingItems.length} items procesados\n`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ Seed completado');
    console.log(`✅ Items creados: ${createdCount}`);
    console.log(`⚠️  Errores: ${errorCount}`);
    console.log(`📦 Total: ${recyclingItems.length}`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  }
}

seedRecyclingGuide();

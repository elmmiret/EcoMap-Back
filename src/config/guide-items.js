export const items = [
  // --- ORGANIC (Marrón) ---
  { 
    name: "Cáscara de fruta", 
    container_type: "OrganicContainer", 
    keywords: ["fruta", "comida", "piel", "banana", "plátano", "cascara", "cáscara", "cáscara de fruta", "naranja", "mandarina", "mango"], 
    description: "Cualquier resto de fruta o verdura va al orgánico." 
  },
  { 
    name: "Espina de pescado", 
    container_type: "OrganicContainer", 
    keywords: ["pescado", "comida", "resto", "hueso", "espina", "pez"], 
    description: "Los restos de carne y pescado son orgánicos." 
  },
  { 
    name: "Caja de pizza (sucia)", 
    container_type: "OrganicContainer", 
    keywords: ["carton", "pizza", "grasa", "aceite", "caja", "caja de pizza", "cartón"], 
    description: "Si el cartón está manchado de aceite o comida, no se puede reciclar como papel. Va al orgánico." 
  },
  { 
    name: "Tapón de corcho", 
    container_type: "OrganicContainer", 
    keywords: ["vino", "corcho", "botella", "tapon", "tapón", "cava", "champan", "champagne", "champán"], 
    description: "Si es corcho natural, al orgánico. Si es sintético/plástico, al amarillo." 
  },
  { 
    name: "Posos de café", 
    container_type: "OrganicContainer", 
    keywords: ["cafe", "filtro", "infusion", "posos", "poso"], 
    description: "Tanto el café como el filtro de papel (o la bolsita de té) son orgánicos." 
  },

  // --- PLASTIC (Amarillo - Envases) ---
  { 
    name: "Botella de agua", 
    container_type: "PlasticContainer", 
    keywords: ["plastico", "envase", "agua", "bebida", "botella"], 
    description: "Recuerda aplastarla para ahorrar espacio." 
  },
  { 
    name: "Lata de refresco", 
    container_type: "PlasticContainer", 
    keywords: ["lata", "aluminio", "refresco", "cerveza"], 
    description: "Las latas metálicas van al contenedor amarillo (envases)." 
  },
  { 
    name: "Tetra Brik", 
    container_type: "PlasticContainer", 
    keywords: ["leche", "zumo", "carton", "brik", "envase", "bote"], 
    description: "Aunque parezca cartón, contiene plástico y aluminio. Va al amarillo." 
  },
  { 
    name: "Vaso de yogur", 
    container_type: "PlasticContainer", 
    keywords: ["yogur", "plastico", "lacteo", "tapa"], 
    description: "El envase y la tapa metálica van al amarillo." 
  },
  { 
    name: "Bolsa de patatas fritas", 
    container_type: "PlasticContainer", 
    keywords: ["bolsa", "plastico", "snack", "envoltorio", "patatas", "fritas", "chips"], 
    description: "Los envoltorios plásticos y metalizados van al contenedor de envases." 
  },

  // --- PAPER (Azul) ---
  { 
    name: "Periódico", 
    container_type: "PaperContainer", 
    keywords: ["papel", "diario", "revista", "noticias", "periodico", "periódico"], 
    description: "Papel limpio y seco." 
  },
  { 
    name: "Caja de zapatos", 
    container_type: "PaperContainer", 
    keywords: ["carton", "caja", "embalaje", "zapatos", "calzado"], 
    description: "Pliega la caja antes de tirarla." 
  },
  { 
    name: "Folios usados", 
    container_type: "PaperContainer", 
    keywords: ["papel", "hoja", "documento", "carta", "folios", "folios usados"], 
    description: "Quita clips o grapas si es posible, aunque no es imprescindible." 
  },

  // --- GLASS (Verde) ---
  { 
    name: "Botella de vino", 
    container_type: "GlassContainer", 
    keywords: ["vidrio", "botella", "alcohol", "cristal"], 
    description: "Solo vidrio. Quita el tapón (el corcho al orgánico, la chapa al amarillo)." 
  },
  { 
    name: "Tarro de mermelada", 
    container_type: "GlassContainer", 
    keywords: ["bote", "vidrio", "conserva", "mermelada", "tarro"], 
    description: "El tarro al verde, la tapa metálica al amarillo." 
  },

  // --- TEXTILE (Ropa) ---
  { 
    name: "Camiseta vieja", 
    container_type: "TextileContainer", 
    keywords: ["ropa", "tela", "algodon", "trapo", "camiseta"], 
    description: "Si está en buen estado se reutiliza; si no, se recicla el tejido." 
  },

  // --- ELECTRIC (Punto Limpio / E-waste) ---
  { 
    name: "Secador de pelo", 
    container_type: "ElectricContainer", 
    keywords: ["electrodomestico", "aparato", "cable", "electronica", "secador", "secador de pelo"], 
    description: "Los aparatos eléctricos nunca van al contenedor normal. Llévalos al punto limpio." 
  },

  // --- UNRECYCLABLE (Gris / Resto) ---
  { 
    name: "Copa de cristal rota", 
    container_type: "Unrecyclable", 
    keywords: ["cristal", "roto", "vajilla", "vaso", "copa", "copa de cristal"], 
    description: "¡OJO! El cristal (copas, vasos) tiene óxido de plomo y NO es vidrio. No va al verde, va al gris." 
  },
  { 
    name: "Pañales", 
    container_type: "Unrecyclable", 
    keywords: ["bebe", "higiene", "sucio", "pañales", "pañal"], 
    description: "No son reciclables ni orgánicos. Van al contenedor de resto (gris)." 
  },
  { 
    name: "Espejo roto", 
    container_type: "Unrecyclable", 
    keywords: ["espejo", "cristal", "baño"], 
    description: "Como el cristal de las copas, no se funde igual que las botellas. Al gris o punto limpio." 
  }
];
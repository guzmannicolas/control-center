import type { PrismaClient } from '../generated/prisma/client.js';

/**
 * Ensures the initial pilot brand (Niki Peppers) and initial drafts and campaigns exist.
 */
export async function ensureMarketingSeed(prisma: PrismaClient) {
  let niki = await prisma.brand.findUnique({
    where: { slug: 'nikipeppers' },
  });

  if (!niki) {
    niki = await prisma.brand.create({
      data: {
        slug: 'nikipeppers',
        name: 'Niki Peppers',
        website: 'https://nikipeppers.com',
        toneOfVoice:
          'Picante, atrevido, apasionado por la gastronomía artesanal gourmet. Cercano, audaz y canchero, invitando a elevar cada comida cotidiana con picor noble y sin conservantes.',
        styleDirectives: {
          colors: ['#E53E3E', '#DD6B20', '#1A202C', '#F6AD55'],
          officialHashtags: [
            '#NikiPeppers',
            '#HotSauceLovers',
            '#SaborPicante',
            '#GourmetChili',
            '#FuegoEnTuMesa',
          ],
          guidelines:
            'Enfocar en ingredientes 100% naturales, proceso de fermentación cuidada y maridajes irresistibles (asado, empanadas, burgers, tacos). Evitar caer en picor destructivo; ponderar siempre el balance de sabor.',
          brandPillars: [
            'Recetas & Maridajes Gourmet',
            'Cultura del Picante & Escala Scoville',
            'Proceso Artesanal & Taller de Fermentación',
            'Comunidad Niki Lovers',
          ],
        },
        targetAudience: 'Foodies, parrilleros, amantes del picante y jóvenes adultos que cocinan rico en casa',
        whatsappNumber: '+5493512345678',
        telegramChatId: '@nikipeppers_bot',
      },
    });
  }

  // Seed default Ad Campaigns if none exist
  const existingCampaigns = await prisma.adCampaign.count({
    where: { brandId: niki.id },
  });

  if (existingCampaigns === 0) {
    await prisma.adCampaign.createMany({
      data: [
        {
          brandId: niki.id,
          platform: 'META',
          externalCampaignId: 'meta_camp_niki_001',
          campaignName: 'Niki Peppers - Pack Degustación 3 Frascos (Conversiones)',
          objective: 'PURCHASE_CONVERSIONS',
          dailyBudget: 25.0,
          spendToDate: 312.5,
          cpa: 4.8,
          ctr: 3.42,
          roas: 4.25,
          status: 'ACTIVE',
          safetyGuardrail: 40.0,
          insights: {
            creativeWinner: 'Reel Alitas Glaseadas',
            bestAgeGroup: '25-44',
            audience: 'Intereses: BBQ, Gourmet food, Craft beer, Hot sauce',
            recommendation: 'Mantener activo y considerar escalar +$5/día sin superar guardrail.',
          },
        },
        {
          brandId: niki.id,
          platform: 'GOOGLE',
          externalCampaignId: 'goog_camp_niki_002',
          campaignName: 'Google Search - Salsa Picante Gourmet Artesanal',
          objective: 'HIGH_INTENT_SALES',
          dailyBudget: 15.0,
          spendToDate: 189.2,
          cpa: 5.1,
          ctr: 4.85,
          roas: 3.8,
          status: 'ACTIVE',
          safetyGuardrail: 25.0,
          insights: {
            topKeywords: ['comprar salsa picante gourmet', 'habanero artesanal argentina', 'hot sauce online'],
            qualityScore: 8.5,
            recommendation: 'Agregar términos negativos de "salsa tabasco barata" para optimizar CPA.',
          },
        },
        {
          brandId: niki.id,
          platform: 'META',
          externalCampaignId: 'meta_camp_niki_003',
          campaignName: 'Meta Retargeting - Carritos Abandonados Spicy Bundle',
          objective: 'CATALOG_RETARGETING',
          dailyBudget: 10.0,
          spendToDate: 84.6,
          cpa: 3.2,
          ctr: 5.2,
          roas: 6.15,
          status: 'ACTIVE',
          safetyGuardrail: 15.0,
          insights: {
            frequency: 2.1,
            discountUsed: 'SPICY10 (10% OFF en carrito)',
            recommendation: 'Campaña con ROI óptimo. No tocar configuración.',
          },
        },
      ],
    });
  }

  // Seed default Social Drafts if none exist
  const existingDrafts = await prisma.socialDraft.count({
    where: { brandId: niki.id },
  });

  if (existingDrafts === 0) {
    await prisma.socialDraft.createMany({
      data: [
        {
          brandId: niki.id,
          platform: 'INSTAGRAM',
          postType: 'REEL',
          caption:
            '🔥 ¿Buscando subir de nivel el asado o la picada del finde? Mirá estas alitas glaseadas con nuestra Chipotle Dulce artesanal.\n\nEl secreto está en mezclar 3 cucharadas de Niki Peppers Chipotle con manteca derretida y miel pura. Caramelizalas 5 minutos al fuego directo y sentí ese toque ahumado que explota en boca.\n\n👉 Pedí tu pack con 15% OFF en nikipeppers.com antes del domingo.\n\n#NikiPeppers #HotSauceLovers #SaborPicante #GourmetChili #AlitasPicantes',
          mediaUrls: ['https://images.unsplash.com/photo-1527477378408-1bc097a904b3?w=800&q=80'],
          status: 'PENDING_APPROVAL',
          approvalToken: 'token-niki-wings-001',
          scheduledFor: new Date(Date.now() + 86400000), // Mañana
          feedback: null,
          metrics: {},
        },
        {
          brandId: niki.id,
          platform: 'INSTAGRAM',
          postType: 'CAROUSEL',
          caption:
            '🌶️ Del suave ahumado al infierno placentero. Deslizá para conocer la escala Scoville de nuestras salsas:\n\n1️⃣ Suave Jalapeño Lima (3.000 SHU) - Para ensaladas y tacos frescos.\n2️⃣ Medio Chipotle Ahumado (15.000 SHU) - El rey de las hamburguesas.\n3️⃣ Extremo Habanero Scorpion (75.000 SHU) - Solo para valientes.\n\n¿En cuál te plantás vos? Dejanos tu número en comentarios 👇\n\n#NikiPeppers #EscalaScoville #HotSauce #PicanteGourmet',
          mediaUrls: [
            'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800&q=80',
            'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=800&q=80',
          ],
          status: 'APPROVED',
          approvalToken: 'token-niki-scoville-002',
          scheduledFor: new Date(Date.now() + 86400000 * 2),
          feedback: 'Aprobado directamente por el cliente con ajuste de foto 2.',
          metrics: {},
        },
        {
          brandId: niki.id,
          platform: 'TIKTOK',
          postType: 'REEL',
          caption:
            'POV: Entrás a nuestro taller de fermentación en Córdoba. Meses de paciencia para lograr esa acidez perfecta y picor redondo sin conservantes químicos.\n\n¿Sabías que una buena salsa picante se añeja como un buen vino? 🍷🌶️\n\n#DetrasDeEscena #Artesanal #HechoEnArgentina #NikiPeppers',
          mediaUrls: ['https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=800&q=80'],
          status: 'DRAFT',
          approvalToken: 'token-niki-ferment-003',
          feedback: null,
          metrics: {},
        },
        {
          brandId: niki.id,
          platform: 'INSTAGRAM',
          postType: 'POST',
          caption:
            'La grieta se termina acá: empanada de carne a cuchillo se come con un par de gotas de Niki Pepper Original. Punto. 🥟🇦🇷\n\nConseguila en tiendas gourmet seleccionadas y en nikipeppers.com con envío a todo el país.\n\n#NikiPeppers #EmpanadasArgentinas #MaridajeGourmet',
          mediaUrls: ['https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=800&q=80'],
          status: 'PUBLISHED',
          approvalToken: 'token-niki-empanadas-004',
          publishedAt: new Date(Date.now() - 86400000 * 3),
          metrics: { reach: 4320, likes: 382, saves: 94 },
        },
      ],
    });
  }

  return niki;
}

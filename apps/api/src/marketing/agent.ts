import { GoogleGenAI } from '@google/genai';
import type { SocialPlatform, SocialPostType } from '@cc/shared';

export interface BrandPromptContext {
  name: string;
  website: string;
  toneOfVoice: string;
  styleDirectives?: Record<string, unknown> | null;
  targetAudience?: string | null;
}

export interface GenerateCreativeParams {
  brand: BrandPromptContext;
  platform: SocialPlatform;
  postType: SocialPostType;
  topic: string;
  objective?: string;
  mediaUrls?: string[];
}

export interface GeneratedCreativeResult {
  caption: string;
  hook: string;
  suggestedMedia: string[];
  hashtags: string[];
  callToAction: string;
  source: 'ai' | 'fallback_engine';
}

// Fallback high-impact templates for gourmet food/sauce brands like Niki Peppers
const NIKI_CREATIVE_TEMPLATES = [
  (topic: string, postType: string, cta: string) => ({
    hook: `🔥 El secreto que todo fanático del buen comer necesita saber: ${topic}.`,
    body: `En Niki Peppers creemos que ninguna comida merece ser aburrida. Cada gota está macerada artesanalmente para equilibrar picor real, notas ahumadas y sabor puro sin conservantes.\n\nIdeal para elevar tu próximo asado, una pizza de masa madre o esas hamburguesas caseras del viernes.`,
    cta: cta || `Descubrí el sabor auténtico en nikipeppers.com con envíos a todo el país 🚚✨`,
    hashtags: ['#NikiPeppers', '#HotSauceLovers', '#GourmetChili', '#SaborPicante', '#HechoEnArgentina'],
  }),
  (topic: string, postType: string, cta: string) => ({
    hook: `🌶️ ¿Te animás a desafiar tu paladar? Hoy exploramos: ${topic}.`,
    body: `Hay salsas que solo pican, y salsas que despiertan el alma del plato. Nuestro proceso de fermentación lenta permite que el ají libere todos sus aceites naturales y matices frutales antes del golpe de picor.\n\n¿Cuál es tu nivel de tolerancia? Comentá abajo con tu emoji de fuego favorito del 1 al 5 🔥👇`,
    cta: cta || `Pedí tu pack degustación hoy mismo en nikipeppers.com y sumate al club del picante.`,
    hashtags: ['#NikiPeppers', '#EscalaScoville', '#ArtisanalSauce', '#FuegoEnTuMesa', '#FoodieArg'],
  }),
  (topic: string, postType: string, cta: string) => ({
    hook: `✨ Upgrade gourmet en 10 segundos: ${topic}.`,
    body: `Guardate este post para tu próxima comida. Basta de condimentos artificiales llenos de sodio. Dos gotas de Niki Peppers transforman cualquier receta simple en una experiencia de restaurante.\n\nCombinación recomendada: queso derretido, carnes braseadas o vegetales asados con nuestro toque ahumado.`,
    cta: cta || `Conocé todas las variedades en la tienda oficial: nikipeppers.com`,
    hashtags: ['#NikiPeppers', '#RecetasGourmet', '#MaridajePicante', '#CocinaDeAutor', '#HotSauceAddict'],
  }),
];

/**
 * Generates an engaging social media post caption and assets using Gemini AI
 * tailored to the brand's unique tone of voice and guidelines.
 */
export async function generateSocialCreative(
  params: GenerateCreativeParams,
  apiKey?: string
): Promise<GeneratedCreativeResult> {
  const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;
  const { brand, platform, postType, topic, objective } = params;

  if (effectiveApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

      const prompt = `Actúa como Director Creativo y Copywriter Senior de Marketing Digital para redes sociales.
Estás creando contenido para la marca:
- Marca: ${brand.name}
- Web: ${brand.website}
- Tono de voz: ${brand.toneOfVoice}
- Directivas de estilo y valores: ${JSON.stringify(brand.styleDirectives ?? {})}
- Público objetivo: ${brand.targetAudience || 'Amantes de la gastronomía gourmet, picante y experiencias culinarias artesanales'}

Parámetros del post:
- Red Social: ${platform}
- Formato: ${postType} (POST, REEL, CAROUSEL, STORY)
- Tema principal: ${topic}
- Objetivo de la publicación: ${objective || 'Engagement y conversión a ventas'}

Instrucciones:
1. Escribí un copy magnético para ${platform} respetando estrictamente el tono de voz de la marca.
2. Formato:
   - Gancho inicial irresistible (Hook) en la primera línea.
   - Cuerpo de texto estructurado con saltos de línea y emojis sutiles pero vibrantes.
   - Llamado a la acción (CTA) claro apuntando a ${brand.website}.
   - Bloque de 4 a 6 hashtags estratégicos al final.
3. Devolvé la respuesta en formato JSON con la siguiente estructura exacta:
{
  "hook": "frase corta de gancho",
  "caption": "texto completo formateado listo para publicar con hook, cuerpo, CTA y hashtags",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "callToAction": "frase de CTA",
  "visualSuggestion": "descripción de imagen/video recomendada para este post"
}`;

      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.8,
          responseMimeType: 'application/json',
        },
      });

      const rawText = res.text?.trim();
      if (rawText) {
        const parsed = JSON.parse(rawText) as {
          hook?: string;
          caption?: string;
          hashtags?: string[];
          callToAction?: string;
          visualSuggestion?: string;
        };

        const fallbackImages = params.mediaUrls?.length
          ? params.mediaUrls
          : ['https://images.unsplash.com/photo-1527477378408-1bc097a904b3?w=800&q=80'];

        return {
          caption: parsed.caption || `${parsed.hook}\n\n${topic}\n\n${parsed.callToAction}\n\n${parsed.hashtags?.join(' ')}`,
          hook: parsed.hook || topic,
          suggestedMedia: fallbackImages,
          hashtags: parsed.hashtags || ['#NikiPeppers', '#HotSauceLovers'],
          callToAction: parsed.callToAction || `Visitanos en ${brand.website}`,
          source: 'ai',
        };
      }
    } catch {
      // Fallback seamlessly to template engine
    }
  }

  // Fallback generation engine when AI is offline or without API key
  const templateIdx = Math.abs(topic.length + platform.length) % NIKI_CREATIVE_TEMPLATES.length;
  const templateFn = NIKI_CREATIVE_TEMPLATES[templateIdx]!;
  const generated = templateFn(topic, postType, objective ? `Objetivo: ${objective}. Comprá en ${brand.website}` : '');

  const fullCaption = `${generated.hook}\n\n${generated.body}\n\n👉 ${generated.cta}\n\n${generated.hashtags.join(' ')}`;
  const defaultMedia = params.mediaUrls?.length
    ? params.mediaUrls
    : ['https://images.unsplash.com/photo-1527477378408-1bc097a904b3?w=800&q=80'];

  return {
    caption: fullCaption,
    hook: generated.hook,
    suggestedMedia: defaultMedia,
    hashtags: generated.hashtags,
    callToAction: generated.cta,
    source: 'fallback_engine',
  };
}

export interface AdAuditSummary {
  safetyAlerts: string[];
  recommendations: string[];
  isGuardrailBreached: boolean;
  totalDailyBudget: number;
  totalSafetyLimit: number;
}

/**
 * Traffic & Ads Engine: Audits campaigns against hardcoded budget safety guardrails
 * and generates automated optimization advice.
 */
export function auditAdCampaigns(campaigns: Array<{
  campaignName: string;
  dailyBudget: number;
  spendToDate: number;
  safetyGuardrail: number;
  cpa: number;
  ctr: number;
  roas: number;
  status: string;
}>): AdAuditSummary {
  const safetyAlerts: string[] = [];
  const recommendations: string[] = [];
  let isGuardrailBreached = false;
  let totalDailyBudget = 0;
  let totalSafetyLimit = 0;

  for (const c of campaigns) {
    totalDailyBudget += c.dailyBudget;
    totalSafetyLimit += c.safetyGuardrail;

    if (c.dailyBudget > c.safetyGuardrail) {
      isGuardrailBreached = true;
      safetyAlerts.push(
        `[GUARDRAIL BREACH] "${c.campaignName}" daily budget ($${c.dailyBudget.toFixed(2)}) exceeds hardcoded safety limit ($${c.safetyGuardrail.toFixed(2)}).`
      );
    } else if (c.dailyBudget >= c.safetyGuardrail * 0.95) {
      safetyAlerts.push(
        `[WARNING] "${c.campaignName}" is at ${( (c.dailyBudget / c.safetyGuardrail) * 100 ).toFixed(0)}% of the maximum safety limit.`
      );
    }

    // Performance recommendations
    if (c.status === 'ACTIVE') {
      if (c.roas >= 4.0) {
        recommendations.push(
          `[HIGH ROAS] (${c.roas.toFixed(1)}x) on "${c.campaignName}". Consider scaling budget +10% within guardrail limit of $${c.safetyGuardrail}.`
        );
      } else if (c.roas > 0 && c.roas < 2.0 && c.spendToDate > 50) {
        recommendations.push(
          `[LOW ROAS] (${c.roas.toFixed(1)}x) on "${c.campaignName}". Refresh creative assets or pause if CPA exceeds $${c.cpa.toFixed(2)}.`
        );
      }

      if (c.ctr < 1.0 && c.spendToDate > 30) {
        recommendations.push(
          `[LOW CTR] (${c.ctr.toFixed(2)}%) on "${c.campaignName}". Audience fatigue detected; activate fresh creative variants.`
        );
      }
    }
  }

  return {
    safetyAlerts,
    recommendations,
    isGuardrailBreached,
    totalDailyBudget,
    totalSafetyLimit,
  };
}

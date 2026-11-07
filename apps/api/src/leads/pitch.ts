import { GoogleGenAI } from '@google/genai';

export interface PitchVariableContext {
  name: string;
  category: string;
  city: string;
  rating?: number | null;
  reviewsCount?: number;
  suggestedDemo?: string | null;
  address?: string;
}

export interface GeneratedPitch {
  pitch: string;
  source: 'ai' | 'template';
  variant: number;
}

// 4 distinct human-like pitch templates with natural variability for cold outreach
export const COLD_PITCH_VARIANTS = [
  (ctx: PitchVariableContext) =>
    `Hola ${ctx.name}! 👋 Vi las excelentes opiniones que tienen en Google (${ctx.rating ? `${ctx.rating}★` : 'muy recomendados'}) en ${ctx.city}. ` +
    `Estuve viendo que no tienen sitio web oficial cargado y les armamos una propuesta interactiva de cómo quedaría su web para ${ctx.category}: ` +
    `${ctx.suggestedDemo ?? 'https://templates.nicoguzmandev.com/'} ` +
    `¿Les gustaría que les muestre cómo adaptarla con sus fotos y servicios? ¡Saludos!`,

  (ctx: PitchVariableContext) =>
    `Buenas ${ctx.name}! Estaba buscando referentes de ${ctx.category} en ${ctx.city} y me llamó la atención su reputación. ` +
    `Noté que todavía no tienen una página web moderna propia, así que les diseñé una maqueta de ejemplo en vivo para su rubro: ` +
    `${ctx.suggestedDemo ?? 'https://templates.nicoguzmandev.com/'} ` +
    `Si les interesa sumar reservas o consultas directas avísenme y lo charlamos sin compromiso.`,

  (ctx: PitchVariableContext) =>
    `Hola gente de ${ctx.name}, ¿cómo están? Les escribo porque vi sus calificaciones en ${ctx.city} y destacan un montón. ` +
    `Les preparé una demo web rápida para mostrarles cómo podrían profesionalizar su presencia digital y recibir más clientes: ` +
    `${ctx.suggestedDemo ?? 'https://templates.nicoguzmandev.com/'} ` +
    `¿Tienen unos minutos esta semana para que se las muestre?`,

  (ctx: PitchVariableContext) =>
    `Hola! Qué tal el equipo de ${ctx.name}? Les escribo desde Córdoba/Arg. ` +
    `Viendo su negocio en Google Maps noté que no cuentan con web oficial, lo cual hoy en día les quita consultas frente a la competencia en ${ctx.city}. ` +
    `Miren esta propuesta interactiva armada para ${ctx.category}: ` +
    `${ctx.suggestedDemo ?? 'https://templates.nicoguzmandev.com/'} ` +
    `¿Les gustaría que conversemos para implementarla?`,
];

// Follow-up pitch variants (for leads contacted 3+ days ago without reply)
export const FOLLOW_UP_VARIANTS = [
  (ctx: PitchVariableContext) =>
    `Hola ${ctx.name}! ¿Pudieron ver la demo que les pasé hace unos días? ` +
    `Se las dejo acá por las dudas: ${ctx.suggestedDemo ?? ''} ` +
    `Si no están interesados en este momento no hay problema, simplemente quería confirmar que les haya llegado. ¡Muchas gracias!`,

  (ctx: PitchVariableContext) =>
    `Buenas ${ctx.name}! Les hago una consulta rápida: ¿están evaluando sumar una web o reservas online para ${ctx.category}? ` +
    `Cualquier consulta sobre la maqueta que les compartí estoy a disposición. ¡Que tengan buena semana!`,
];

/**
 * Generates a hyper-personalized pitch for a single lead.
 * Uses Gemini when API key is available, with instant fallback to anti-spam template variants.
 */
export async function generatePersonalizedPitch(
  ctx: PitchVariableContext,
  isFollowUp = false,
  apiKey?: string
): Promise<GeneratedPitch> {
  const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;

  if (effectiveApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
      const prompt = isFollowUp
        ? `Redactá un mensaje de seguimiento súper breve y cortés (máximo 45 palabras) para WhatsApp.
Datos del negocio:
- Nombre: ${ctx.name}
- Rubro: ${ctx.category}
- Ciudad: ${ctx.city}
- Demo compartida: ${ctx.suggestedDemo ?? 'https://templates.nicoguzmandev.com/'}

Objetivo: Preguntar cordialmente si pudieron ver la propuesta anterior sin presionar. Soná como un profesional independiente de Argentina (usá voseo natural: vos, pudiste, avisame). NO uses emojis excesivos ni suenes a bot o spam.`
        : `Redactá un mensaje de prospección en frío personalizado y amigable para WhatsApp (máximo 60 palabras).
Datos del negocio:
- Nombre: ${ctx.name}
- Rubro: ${ctx.category}
- Ciudad: ${ctx.city}
- Calificación Google: ${ctx.rating ? `${ctx.rating} estrellas` : 'excelente'}
- Demo en vivo preparada: ${ctx.suggestedDemo ?? 'https://templates.nicoguzmandev.com/'}

Estructura:
1. Saludo personalizado con el nombre del negocio.
2. Mencionar sus buenas calificaciones en ${ctx.city}.
3. Señalar con respeto que no tienen web oficial y que les armaste una maqueta interactiva sin costo.
4. Incluir el link exacto de la demo: ${ctx.suggestedDemo ?? ''}
5. Pregunta final abierta y sin presión.
Tono: Profesional argentino (voseo natural: che, te armé, avisame, etc.). Evitá sonar a venta agresiva o plantilla genérica.`;

      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.7 },
      });

      const text = res.text?.trim();
      if (text) {
        return { pitch: text, source: 'ai', variant: 0 };
      }
    } catch {
      // Fallback silently to template variants
    }
  }

  // Pick deterministic but varying template based on lead name length to avoid spam clustering
  const variants = isFollowUp ? FOLLOW_UP_VARIANTS : COLD_PITCH_VARIANTS;
  const idx = Math.abs(ctx.name.length) % variants.length;
  const chosenVariant = variants[idx]!;

  return {
    pitch: chosenVariant(ctx),
    source: 'template',
    variant: idx + 1,
  };
}

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

// Sincere, human pitch templates tailored for direct Instagram DMs from a personal profile
export const COLD_PITCH_VARIANTS = [
  (ctx: PitchVariableContext) =>
    `Buenas! Che te escribo por acá porque vi su negocio y me gustó mucho lo que hacen. ` +
    `Te cuento: soy desarrollador y esto lo hago como un plus mientras tanto para darle una mano a negocios y que tengan más exposición en Google. ` +
    `Vi que todavía no tienen página web propia, así que les armé una demo de muestra para su rubro: ` +
    `${ctx.suggestedDemo ?? 'https://templates.nicoguzmandev.com/'} ` +
    `Como la idea es ayudarlos el costo es súper accesible, nada más para cubrir el hosting y mantenerla activa. ` +
    `Mírenla tranquilos y si les sirve o quieren adaptarla con sus fotos y servicios me avisan, cero compromiso!`,

  (ctx: PitchVariableContext) =>
    `Buenas! Qué tal? Vi lo que hacen en ${ctx.name} y me pareció muy bueno. ` +
    `Te cuento: trabajo como desarrollador y en mis tiempos libres aprovecho para darles una mano a comercios de acá para que tengan presencia en Google. ` +
    `Vi que no tienen web oficial y les armé una maqueta interactiva de muestra: ` +
    `${ctx.suggestedDemo ?? 'https://templates.nicoguzmandev.com/'} ` +
    `Hago esto como un plus y el costo es mínimo, nada más para mantenerla online. ` +
    `Mírenla sin compromiso y si les interesa me avisan!`,

  (ctx: PitchVariableContext) =>
    `Hola gente de ${ctx.name}! ¿Cómo andan? Les escribo desde mi cuenta personal. ` +
    `Soy desarrollador y me gusta ayudar a comercios y locales a ganar exposición online con una web propia. ` +
    `Les preparé esta demo de ejemplo rápida para su rubro: ` +
    `${ctx.suggestedDemo ?? 'https://templates.nicoguzmandev.com/'} ` +
    `Es un plus que hago para dar una mano, por eso solo cobro lo básico del hosting anual. ` +
    `Si les copa avísenme y la adaptamos con lo que necesiten!`,

  (ctx: PitchVariableContext) =>
    `Buenas! Todo bien? Les escribo porque vi su negocio y me pareció genial lo que hacen. ` +
    `Trabajo de programador y esto lo hago como un plus mientras tanto para ayudar a comercios a sumar clientes desde Google. ` +
    `Les armé una demo interactiva de cómo quedaría su página: ` +
    `${ctx.suggestedDemo ?? 'https://templates.nicoguzmandev.com/'} ` +
    `El costo es solo para mantenerla online. ` +
    `Chusméenla tranquilos y si les sirve me escriben, ninguna presión!`,
];

// Pitch templates for businesses that already have a website (e.g. real estate, clinics, dealerships)
export const AUTOMATION_PITCH_VARIANTS = [
  (ctx: PitchVariableContext) =>
    `Buenas! Che te escribo por acá porque vi lo que hacen en ${ctx.name} y la presencia que manejan. ` +
    `Te cuento: soy desarrollador y trabajo armando automatizaciones para negocios. ` +
    `Se que muchas veces se pierde tiempo respondiendo siempre las mismas consultas por DM o WhatsApp (precios, horarios, disponibilidad). ` +
    `Armé un sistema para responder y filtrar consultas 24/7 sin que tengan que estar encima. ` +
    `Si les interesa ver cómo funciona avísenme y se los muestro, cero compromiso!`,
];

// Follow-up pitch variants (for leads contacted 3+ days ago without reply)
export const FOLLOW_UP_VARIANTS = [
  (ctx: PitchVariableContext) =>
    `Hola gente de ${ctx.name}! ¿Cómo andan? ¿Pudieron chusmear la demo que les pasé el otro día (${ctx.suggestedDemo ?? ''})? ` +
    `Si no están con tiempo o no les interesa por ahora no hay problema, simplemente quería confirmar que les haya llegado. Saludos!`,

  (ctx: PitchVariableContext) =>
    `Buenas! Che les hago una consulta rápida: ¿pudieron ver la maquetita web que les armé? ` +
    `Cualquier duda o si quieren que le cambie alguna foto o dato avísenme y lo vemos cuando puedan. Buena semana!`,
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
        ? `Redactá un mensaje de seguimiento súper breve, sincero y cortés (máximo 40 palabras) para enviar por mensaje directo de Instagram.
Datos:
- Negocio: ${ctx.name}
- Rubro: ${ctx.category}
- Ciudad: ${ctx.city}
- Demo: ${ctx.suggestedDemo ?? 'https://templates.nicoguzmandev.com/'}

Objetivo: Preguntar cordialmente si pudieron chusmear la demo sin presionar. Tono de persona real (voseo argentino natural: pudiste, avisame, etc.). CERO emojis, cero tono bot, cero corporativo.`
        : `Redactá un mensaje de prospección sincero, conciso y cercano (máximo 60 palabras) para enviar por mensaje directo de Instagram desde un perfil personal.
Datos:
- Negocio: ${ctx.name}
- Rubro: ${ctx.category}
- Ciudad: ${ctx.city}
- Demo preparada: ${ctx.suggestedDemo ?? 'https://templates.nicoguzmandev.com/'}

Puntos clave:
1. Saludo natural de persona a negocio local.
2. Contar con total transparencia que sos desarrollador y que esto lo hacés como un plus mientras tanto para ayudar y darle una mano a negocios locales a tener más exposición en Google.
3. Mencionar que viste que no tienen web propia y les armaste una maqueta interactiva de muestra: ${ctx.suggestedDemo ?? ''}
4. Dejar claro que como la idea es ayudarlos, el costo es súper accesible, nada más para cubrir el hosting y mantenerla activa.
5. Cierre sin presión (que la miren tranquilos y si les sirve o quieren adaptarla con sus fotos te avisan).
Tono: 100% humano argentino, voseo natural (che, te armé, avísame). CERO emojis. Prohibido sonar a IA o a vendedor corporativo.`;

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

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
    `Buenas! Che te escribo por acá porque vi su negocio en ${ctx.city} y me gustó mucho lo que hacen. ` +
    `Yo me dedico a hacer páginas web y vi que todavía no tienen una propia. Les armé una maqueta de muestra para que vean cómo quedaría: ` +
    `${ctx.suggestedDemo ?? 'https://templates.nicoguzmandev.com/'} ` +
    `El costo es mínimo, alrededor de 45 o 50 mil pesos al año nada más de mantenimiento y hosting para tenerla activa. ` +
    `Mírenla tranquilos y si les sirve o quieren adaptarla con sus fotos y servicios me avisan, cero compromiso!`,

  (ctx: PitchVariableContext) =>
    `Hola gente de ${ctx.name}! ¿Cómo andan? Les escribo desde mi cuenta personal porque me dedico a armar páginas web y buscando en ${ctx.city} di con su local. ` +
    `Noté que no tienen sitio web propio y les armé una demo rápida para su rubro: ` +
    `${ctx.suggestedDemo ?? 'https://templates.nicoguzmandev.com/'} ` +
    `La idea es darles una mano para que tengan más exposición y clientes directos. Cobro algo súper accesible (unos 40/50k al año por el mantenimiento y hosting anual). ` +
    `Si les copa la idea avísenme y lo charlamos!`,

  (ctx: PitchVariableContext) =>
    `Buenas! Todo bien? Les mando un mensajito porque trabajo de diseñar sitios web y suelo armarle páginas a comercios locales. ` +
    `Vi que tienen muy buenas opiniones pero no tienen web oficial, así que les preparé esta propuesta de muestra: ` +
    `${ctx.suggestedDemo ?? 'https://templates.nicoguzmandev.com/'} ` +
    `No busco cobrar locuras, con algo de 45 o 50 mil pesos al año para cubrir el hosting y mantenerla activa alcanza. ` +
    `Si les interesa sumar visibilidad me avisan y la ajustamos con lo que necesiten!`,

  (ctx: PitchVariableContext) =>
    `Hola! Qué tal? Vi lo que hacen en ${ctx.name} y me pareció buenísimo. ` +
    `Como trabajo haciendo páginas web, me tomé el atrevimiento de armarles una demo interactiva de ejemplo para ver cómo se vería su sitio: ` +
    `${ctx.suggestedDemo ?? 'https://templates.nicoguzmandev.com/'} ` +
    `El costo de mantenimiento es ínfimo (alrededor de 40 a 50k al año nada más). ` +
    `Si tienen ganas de ver cómo quedaría con su información avísenme, ninguna presión!`,
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
        : `Redactá un mensaje de prospección sincero, conciso y cercano (máximo 55 palabras) para enviar por mensaje directo de Instagram desde un perfil personal (no una empresa o agencia).
Datos:
- Negocio: ${ctx.name}
- Rubro: ${ctx.category}
- Ciudad: ${ctx.city}
- Demo preparada: ${ctx.suggestedDemo ?? 'https://templates.nicoguzmandev.com/'}

Puntos clave:
1. Saludo natural y cercano.
2. Contar con total transparencia que te dedicás a hacer páginas web y viste que en Google Maps no tienen sitio oficial.
3. Decirles que les armaste una maqueta de muestra para su rubro y dejar el link: ${ctx.suggestedDemo ?? ''}
4. Mencionar que el costo es ínfimo (alrededor de 45 o 50 mil pesos al año nada más de mantenimiento y hosting anual).
5. Despedida abierta y sin compromiso (que la miren tranquilos y si les sirve te avisan).
Tono: 100% humano argentino, voseo natural. CERO emojis. Prohibido sonar a IA o a vendedor corporativo.`;

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

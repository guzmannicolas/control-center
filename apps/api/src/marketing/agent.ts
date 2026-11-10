import { GoogleGenAI } from '@google/genai';
import type { SocialPlatform, SocialPostType, ContentIdeaSuggestion } from '@cc/shared';

export interface BrandPromptContext {
  name: string;
  website: string;
  toneOfVoice: string;
  styleDirectives?: Record<string, unknown> | null;
  targetAudience?: string | null;
  dossierMd?: string | null;
  socialStyleMd?: string | null;
  instagramHandle?: string | null;
  scrapedPosts?: Array<{ caption: string; postType?: string; hashtags?: string[]; permalink?: string }> | null;
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

// Fallback realistic templates for Niki Peppers (Visual & Botanical Tattoo Artist, Ceramics, Murals)
const NIKI_CREATIVE_TEMPLATES = [
  (topic: string, postType: string, cta: string) => ({
    hook: `Custom botanical fine line: ${topic}.`,
    body: `Every tattoo is an intimate dialogue between the human body and the natural world. My botanical pieces are designed to flow with the body's natural curvature, using delicate needlework and organic shading inspired by native flora.\n\nWhether it is your first piece or part of a larger personal journey, the consultation is a calm, collaborative space to explore your idea.`,
    cta: cta || `Book a consultation at nikipeppers.com to discuss placement and custom artwork.`,
    hashtags: ['#NikiPeppers', '#BotanicalTattoo', '#FineLineTattoo', '#CustomTattoo', '#ContemporaryArt'],
  }),
  (topic: string, postType: string, cta: string) => ({
    hook: `Artistic process and symbolic transformation: ${topic}.`,
    body: `Getting tattooed is rarely just about aesthetics; for many of my clients, it is an act of empowerment, transformation, and re-signifying their relationship with their own skin.\n\nFrom wild botanical studies to fauna and organic abstractions, each piece is hand-drawn specifically for you.`,
    cta: cta || `Explore recent works and submit your tattoo project at nikipeppers.com`,
    hashtags: ['#NikiPeppers', '#TattooArt', '#FineLine', '#BotanicalArt', '#TattooArtist'],
  }),
  (topic: string, postType: string, cta: string) => ({
    hook: `New visual art and ceramic exploration: ${topic}.`,
    body: `Moving between paper, skin, and clay. My ceramic pieces and visual works investigate the fragile connection between humanity, ecofeminism, and our instinctive roots.\n\nHandcrafted one-of-a-kind pieces, shaped by hand without mass production molds.`,
    cta: cta || `Available for private commission and collector inquiries at nikipeppers.com`,
    hashtags: ['#NikiPeppers', '#CeramicArt', '#VisualArtist', '#ContemporaryCeramics', '#StudioPractice'],
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

      const prompt = `Act as Senior Creative Director & Copywriter for social media marketing.
You are creating authentic, high-converting content for:
- Brand Name: ${brand.name}
- Official Website: ${brand.website}
- Tone of Voice: ${brand.toneOfVoice}
- Style Directives & Pillars: ${JSON.stringify(brand.styleDirectives ?? {})}
- Target Audience: ${brand.targetAudience || 'Art enthusiasts, collectors, and bespoke clients'}
${brand.dossierMd ? `\n--- BRAND DOSSIER & HISTORICAL CONTEXT (.md) ---\n${brand.dossierMd}\n------------------------------------------------` : ''}
${brand.socialStyleMd ? `\n--- SOCIAL STYLE & PERSONALIZATION PLAYBOOK (.md) ---\n${brand.socialStyleMd}\n-----------------------------------------------------` : ''}
${brand.scrapedPosts && brand.scrapedPosts.length > 0 ? `\n--- RECENT LIVE INSTAGRAM PUBLICATIONS (FEW-SHOT EXAMPLES) ---\n${brand.scrapedPosts.slice(0, 5).map((p, i) => `[Post ${i + 1}] (${p.postType || 'POST'}${p.permalink ? ` - ${p.permalink}` : ''}):\n${p.caption}`).join('\n\n')}\n--------------------------------------------------------------` : ''}

Post Parameters:
- Platform: ${platform}
- Format: ${postType} (POST, REEL, CAROUSEL, STORY)
- Main Topic: ${topic}
- Business Objective: ${objective || `Drive consultation bookings on ${brand.website}`}

Directives:
1. Ground the copy directly in the brand dossier and social style playbook (.md) above.
2. STRICT NO-EMOJI POLICY: Do NOT include any emojis anywhere in the caption, hook, or hashtags.
3. Structure:
   - Hook in the first line.
   - Narrative body text with clean double line breaks focusing on artistic value or craftsmanship.
   - Clean call to action pointing to ${brand.website}.
   - 4 to 6 strategic hashtags.
4. Output strictly valid JSON matching this schema:
{
  "hook": "short compelling hook string",
  "caption": "complete formatted caption without any emojis",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "callToAction": "clear call to action string",
  "visualSuggestion": "artistic visual direction for this post"
}`;

      const res = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
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
          : ['https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?w=800&q=80'];

        return {
          caption: parsed.caption || `${parsed.hook}\n\n${topic}\n\n${parsed.callToAction}\n\n${parsed.hashtags?.join(' ')}`,
          hook: parsed.hook || topic,
          suggestedMedia: fallbackImages,
          hashtags: parsed.hashtags || ['#NikiPeppers', '#BotanicalTattoo', '#FineLine'],
          callToAction: parsed.callToAction || `Consultations at ${brand.website}`,
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
  const generated = templateFn(topic, postType, objective ? `Objetivo: ${objective}. Consultas en ${brand.website}` : '');

  const fullCaption = `${generated.hook}\n\n${generated.body}\n\n${generated.cta}\n\n${generated.hashtags.join(' ')}`;
  const defaultMedia = params.mediaUrls?.length
    ? params.mediaUrls
    : ['https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?w=800&q=80'];

  return {
    caption: fullCaption,
    hook: generated.hook,
    suggestedMedia: defaultMedia,
    hashtags: generated.hashtags,
    callToAction: generated.cta,
    source: 'fallback_engine',
  };
}

export interface SynthesizeStylePlaybookParams {
  brand: BrandPromptContext;
  handle: string;
  scrapedPosts?: Array<{ caption: string; postType?: string; hashtags?: string[]; permalink?: string }>;
  sampleCaptions?: string;
  apiKey?: string;
}

/**
 * Analyzes authentic social publications, sample captions, and brand context
 * and generates a dedicated Social Media Style & Personalization Playbook (.md).
 */
export async function synthesizeSocialStylePlaybook(params: SynthesizeStylePlaybookParams): Promise<string> {
  const effectiveApiKey = params.apiKey || process.env.GEMINI_API_KEY;
  const { brand, handle, scrapedPosts = [], sampleCaptions = '' } = params;

  const postsText = scrapedPosts
    .map(
      (p, i) =>
        `[Publication ${i + 1}] (${p.postType || 'POST'}${p.permalink ? ` - ${p.permalink}` : ''}):\n${p.caption}`
    )
    .join('\n\n');

  const prompt = `Act as an Elite Brand Strategist & Social Copywriting Director.
Analyze the following authentic publications, captions, and brand context for @${handle} (${brand.name}).
Your task is to synthesize a comprehensive, production-grade "Social Media Style & Personalization Playbook" in clean GitHub-flavored Markdown (.md).

Brand Details:
- Name: ${brand.name}
- Website: ${brand.website}
- Existing Tone: ${brand.toneOfVoice}
${brand.dossierMd ? `\nBrand Dossier Statement:\n${brand.dossierMd.slice(0, 1200)}\n` : ''}

Authentic Source Publications / References:
${postsText || 'No direct post extracts available.'}

${sampleCaptions ? `User-Provided Sample Captions & Bio:\n${sampleCaptions}` : ''}

Requirements:
Create a detailed, actionable Markdown playbook (.md) structured with these exact sections:
# ${brand.name} (@${handle}) — Social Media Style & Copywriting Playbook

## 1. Tone of Voice & Artistic Persona
- Detailed breakdown of voice, cadence, sentence structure, emotional register, and persona.
- Explicitly prohibited writing styles (e.g. no aggressive sales pitches, no spam hashtags, zero emojis).

## 2. Caption Architecture & Hook Formulas
- Opening hook structure: provide 2-3 specific hook templates based on the analyzed voice.
- Narrative body flow: line spacing, paragraph depth, and storytelling arc.

## 3. Formatting, Spacing & Emoji Directives
- Strict line break rules (e.g. double line breaks between short thoughts).
- Zero emoji policy (or strict minimalist rules).

## 4. Call to Action (CTA) Directives
- How consultations, portfolio views, and website interactions are invited without aggressive friction.

## 5. Strategic Hashtag Clusters
- Primary branded tags, niche aesthetic tags, and community tags.

## 6. Few-Shot Golden Reference Captions
- Top 3 authentic captions from the analyzed material, annotated with why they embody the brand style.

## 7. Directives for Autonomous Post Generation
- 5 explicit rules for the AI Creative Agent when generating or scheduling future publications.

Return ONLY the clean Markdown text without code block fences.`;

  if (effectiveApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
      const res = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.7,
        },
      });

      const raw = res.text?.trim();
      if (raw && raw.length > 200) {
        return raw.replace(/^```(?:markdown)?\n([\s\S]*?)\n```$/i, '$1').trim();
      }
    } catch {
      // Fallback synthesizer
    }
  }

  return generateFallbackStylePlaybook(brand, handle, scrapedPosts, sampleCaptions);
}

function generateFallbackStylePlaybook(
  brand: BrandPromptContext,
  handle: string,
  scrapedPosts: Array<{ caption: string; postType?: string; hashtags?: string[]; permalink?: string }> = [],
  sampleCaptions = ''
): string {
  const isNiki = handle.toLowerCase().includes('niki') || brand.name.toLowerCase().includes('niki');

  const allCaptions = [
    ...scrapedPosts.map((p) => p.caption),
    ...(sampleCaptions ? [sampleCaptions] : []),
  ];

  const extractedTags = Array.from(
    new Set(allCaptions.flatMap((c) => c.match(/#[A-Za-z0-9_\u00C0-\u017F]+/g) || []))
  );

  const tags = extractedTags.length > 0
    ? extractedTags.slice(0, 8)
    : (isNiki
        ? ['#NikiPeppers', '#BotanicalTattoo', '#FineLineTattoo', '#TatuajesBotanicos', '#ArteBotanico']
        : [`#${handle}`, '#Creator', '#AuthenticVoice', '#Lifestyle']);

  return `# ${brand.name} (@${handle}) — Social Media Style & Copywriting Playbook

## 1. Tone of Voice & Artistic Persona
- **Tone:** ${brand.toneOfVoice || 'Thoughtful, authentic, creative, grounded, and engaging.'}
- **Perspective:** First-person narrative or conversational peer-to-peer tone. Focus on genuine craftsmanship, process transparency, and community connection.
- **Prohibited:** No aggressive corporate pitches, no spam hashtags, and no generic promotional hype.

## 2. Caption Architecture & Hook Formulas
- **Opening Hook:** Direct observation, question, or strong sensory statement (under 12 words).
  - *Formula 1:* Direct statement of intent ("Every detail matters, every shadow tells a story.")
  - *Formula 2:* Sensory exploration ("Delicate botanical flow designed in dialogue with anatomy.")
- **Body Flow:** 2 to 3 short paragraphs with generous breathing room. Share the philosophy, emotional ritual, or backstory.
- **Cadence:** Maintain rhythmic sentence structures that sound spoken rather than written.

## 3. Formatting, Spacing & Emoji Directives
- **Line Breaks:** Use double line breaks between distinct thoughts to keep mobile readability high.
- **Emoji Directives:** Zero emojis. Emphasize literary clarity and typographic sophistication over decorative symbols.

## 4. Call to Action (CTA) Playbook
- **Primary CTA:** Gentle invitation to explore further, submit consultation inquiries, or book appointments.
  - *Preferred copy:* "Book your consultation or explore recent works at ${brand.website}."
- **Secondary CTA:** Open conversation prompt ("Send a direct message with your project idea.").

## 5. Strategic Hashtag Clusters
- **Signature Brand Tags:** ${tags.slice(0, 3).join(' ')}
- **Niche & Aesthetic Tags:** ${tags.slice(3).join(' ') || '#ContemporaryDesign #CreativeProcess'}
- **Rule:** Place hashtags at the bottom of the caption separated by a clean line break.

## 6. Few-Shot Golden Reference Captions
${scrapedPosts.length > 0
  ? scrapedPosts.slice(0, 3).map((p, i) => `### Reference ${i + 1} (${p.postType || 'POST'}):\n> "${p.caption.replace(/\n/g, '\n> ')}"`).join('\n\n')
  : (isNiki
      ? `### Reference 1 (Authentic Instagram Post DQGti8QEhOB):\n> "Every detail matters, every shadow tells a story. I’m tattooing in Melbourne, creating unique pieces focused on realism and color. I’d love to find people who also love nature and animals as me. If you want to turn your idea into art on skin, send me a message with your idea!"`
      : `### Reference 1 (Authentic Creator Tone):\n> "Focusing on genuine progress and authentic craftsmanship. Every milestone reflects intentional effort and shared community dialogue.\n>\n> Explore more projects at ${brand.website}."`)}

## 7. Directives for Autonomous Post Generation
1. Strictly follow the tone of voice and narrative depth outlined above.
2. Open with a magnetic single-line hook before detailing the core concept.
3. Integrate ${brand.website} as the natural destination for serious inquiries.
4. Keep paragraph blocks concise (1 to 3 sentences maximum per block).
5. Enforce zero emojis across all generated copy.
`;
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

export interface GenerateWeeklyPlanParams {
  brand: BrandPromptContext;
  theme: string;
  postCount: number;
  platforms: SocialPlatform[];
  startDate: Date;
  objective?: string;
  apiKey?: string;
}

export interface GeneratedPlanItem {
  dayOffset: number;
  scheduledFor: Date;
  platform: SocialPlatform;
  postType: SocialPostType;
  topic: string;
  hook: string;
  caption: string;
  hashtags: string[];
  suggestedMedia: string[];
  callToAction: string;
}

export interface GenerateWeeklyPlanResult {
  theme: string;
  items: GeneratedPlanItem[];
  source: 'ai' | 'fallback_engine';
}

const BOTANICAL_MEDIA_PRESETS = [
  'https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?w=800&q=80',
  'https://images.unsplash.com/photo-1562962230-16e4623d36e6?w=800&q=80',
  'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=800&q=80',
  'https://images.unsplash.com/photo-1568515045052-f9a854d70bfd?w=800&q=80',
  'https://images.unsplash.com/photo-1590246814883-578337415ee9?w=800&q=80',
  'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800&q=80',
  'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&q=80',
];

export async function generateWeeklyContentPlan(
  params: GenerateWeeklyPlanParams
): Promise<GenerateWeeklyPlanResult> {
  const effectiveApiKey = params.apiKey || process.env.GEMINI_API_KEY;
  const { brand, theme, postCount, platforms, startDate, objective } = params;

  const calcDate = (offset: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + offset);
    d.setHours(offset % 2 === 0 ? 11 : 19, 30, 0, 0);
    return d;
  };

  if (effectiveApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
      const prompt = `Act as Senior Social Media Director & Content Strategist for ${brand.name}.
Plan a high-impact, cohesive multi-post editorial campaign with exactly ${postCount} scheduled publications.

Campaign Theme: ${theme}
Business Objective: ${objective || `Drive qualified leads and consultation bookings on ${brand.website}`}
Brand Website: ${brand.website}
Tone of Voice: ${brand.toneOfVoice}
Target Audience: ${brand.targetAudience || 'Art collectors, tattoo enthusiasts, discerning clients'}
Allowed Platforms: ${platforms.join(', ')}
${brand.dossierMd ? `\n--- BRAND DOSSIER ---\n${brand.dossierMd.slice(0, 1500)}\n--------------------` : ''}
${brand.socialStyleMd ? `\n--- STYLE PLAYBOOK ---\n${brand.socialStyleMd.slice(0, 1500)}\n---------------------` : ''}

DIRECTIVES:
1. STRICT NO-EMOJI POLICY across all captions, hooks, and hashtags.
2. Formats to distribute: Alternate smartly between REEL, CAROUSEL, POST, and STORY.
3. Every post must tell a compelling story or educate on artistic craft, ending with a clear CTA to ${brand.website}.
4. Return strictly valid JSON array of ${postCount} items:
[
  {
    "dayIndex": 0,
    "platform": "INSTAGRAM",
    "postType": "REEL",
    "topic": "Concise topic",
    "hook": "Strong opening line",
    "caption": "Full narrative caption with double breaks and CTA",
    "hashtags": ["#tag1", "#tag2", "#tag3"],
    "callToAction": "Consultations at ${brand.website}",
    "visualSuggestion": "Botanical close-up in studio"
  }
]`;

      const res = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.8,
          responseMimeType: 'application/json',
        },
      });

      const raw = res.text?.trim();
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{
          dayIndex?: number;
          platform?: string;
          postType?: string;
          topic?: string;
          hook?: string;
          caption?: string;
          hashtags?: string[];
          callToAction?: string;
          visualSuggestion?: string;
        }>;

        if (Array.isArray(parsed) && parsed.length > 0) {
          const items: GeneratedPlanItem[] = parsed.slice(0, postCount).map((p, idx) => {
            const chosenPlatform = platforms.includes((p.platform?.toUpperCase() as any))
              ? (p.platform?.toUpperCase() as SocialPlatform)
              : platforms[idx % platforms.length]!;
            const validPostTypes: SocialPostType[] = ['POST', 'REEL', 'CAROUSEL', 'STORY'];
            const postType = validPostTypes.includes((p.postType?.toUpperCase() as any))
              ? (p.postType?.toUpperCase() as SocialPostType)
              : (idx % 2 === 0 ? 'REEL' : 'CAROUSEL');

            return {
              dayOffset: idx,
              scheduledFor: calcDate(idx),
              platform: chosenPlatform,
              postType,
              topic: p.topic || `${theme} - Parte ${idx + 1}`,
              hook: p.hook || `${theme} - Exploración ${idx + 1}`,
              caption: p.caption || `${p.hook || theme}\n\nDetalles del proceso artístico y conceptualización.\n\nConsultas en ${brand.website}\n\n#${brand.name.replace(/\s+/g, '')} #Art`,
              hashtags: p.hashtags && p.hashtags.length > 0 ? p.hashtags : [`#${brand.name.replace(/\s+/g, '')}`, '#BotanicalArt', '#FineLine'],
              suggestedMedia: [BOTANICAL_MEDIA_PRESETS[idx % BOTANICAL_MEDIA_PRESETS.length]!],
              callToAction: p.callToAction || `Consultas y reservas en ${brand.website}`,
            };
          });

          return {
            theme,
            items,
            source: 'ai',
          };
        }
      }
    } catch {
      // Fall through to fallback engine
    }
  }

  // Fallback Engine
  const defaultPillars = [
    { type: 'REEL' as SocialPostType, focus: 'Behind the Scenes: Técnica y precisión botánica', cta: 'Reserva una consulta personalizada en' },
    { type: 'CAROUSEL' as SocialPostType, focus: 'Transformación y curado: Guía para clientes', cta: 'Conoce los cuidados y preguntas frecuentes en' },
    { type: 'POST' as SocialPostType, focus: 'Detalle de pieza botánica terminada: Línea fina orgánica', cta: 'Agenda tu próximo proyecto en' },
    { type: 'REEL' as SocialPostType, focus: 'Del boceto al diseño sobre piel: Diálogo y composición', cta: 'Descubre el portafolio completo en' },
    { type: 'CAROUSEL' as SocialPostType, focus: 'Piezas cerámicas y obra visual: Diálogo de texturas', cta: 'Obras y encargos disponibles en' },
    { type: 'POST' as SocialPostType, focus: 'Espacio de taller y filosofía de trabajo colaborativo', cta: 'Consultas abiertas en' },
    { type: 'STORY' as SocialPostType, focus: 'Preguntas y respuestas sobre diseño y citas disponibles', cta: 'Escríbenos directamente o visita' },
  ];

  const items: GeneratedPlanItem[] = Array.from({ length: postCount }).map((_, idx) => {
    const pillar = defaultPillars[idx % defaultPillars.length]!;
    const platform = platforms[idx % platforms.length]!;
    const postTopic = `${theme} — ${pillar.focus}`;
    const hook = `${theme}: ${pillar.focus}.`;
    const body = `Cada creación nace de un proceso reflexivo entre la forma orgánica y el cuerpo humano. Trabajamos sin prisas, priorizando el trazo fino, la armonía anatómica y la durabilidad de cada pigmento.\n\nEl estudio es un espacio calmo diseñado para que tu experiencia sea cómoda y colaborativa.`;
    const cta = `${pillar.cta} ${brand.website}`;
    const tags = [`#${brand.name.replace(/\s+/g, '')}`, '#BotanicalArt', '#FineLineTattoo', '#ContemporaryArt', '#HandmadeArt'];
    const caption = `${hook}\n\n${body}\n\n${cta}\n\n${tags.join(' ')}`;

    return {
      dayOffset: idx,
      scheduledFor: calcDate(idx),
      platform,
      postType: pillar.type,
      topic: postTopic,
      hook,
      caption,
      hashtags: tags,
      suggestedMedia: [BOTANICAL_MEDIA_PRESETS[idx % BOTANICAL_MEDIA_PRESETS.length]!],
      callToAction: cta,
    };
  });

  return {
    theme,
    items,
    source: 'fallback_engine',
  };
}

export async function generateContentIdeaSuggestions(
  brand: BrandPromptContext,
  apiKey?: string
): Promise<ContentIdeaSuggestion[]> {
  const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;

  if (effectiveApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
      const prompt = `Act as Chief Creative Officer for ${brand.name}.
Suggest 5 innovative, strategic, and high-performing content ideas for social media.
Brand Tone: ${brand.toneOfVoice}
Website: ${brand.website}
Audience: ${brand.targetAudience || 'Art collectors, tattoo clients'}
${brand.dossierMd ? `Dossier: ${brand.dossierMd.slice(0, 1000)}` : ''}

Strict NO-EMOJI directive.
Return JSON array of 5 items:
[
  {
    "id": "idea-1",
    "topic": "Short topic title",
    "platform": "INSTAGRAM",
    "postType": "REEL",
    "hook": "Opening hook statement",
    "objective": "Clear business objective",
    "rationale": "Why this builds audience trust and converts"
  }
]`;

      const res = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.8,
          responseMimeType: 'application/json',
        },
      });

      const raw = res.text?.trim();
      if (raw) {
        const parsed = JSON.parse(raw) as ContentIdeaSuggestion[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
  }

  return [
    {
      id: 'idea-1',
      topic: 'Proceso íntimo de diseño botánico personalizado',
      platform: 'INSTAGRAM',
      postType: 'REEL',
      hook: 'Cómo transformamos una referencia botánica en un diseño anatómico único.',
      objective: 'Fomentar consultas para piezas personalizadas',
      rationale: 'Muestra maestría técnica, detalle en el trazo y respeto por el cliente.',
    },
    {
      id: 'idea-2',
      topic: 'Cuidados esenciales para curar un tatuaje fine line',
      platform: 'INSTAGRAM',
      postType: 'CAROUSEL',
      hook: 'Guía paso a paso para que tu tatuaje cure nítido y conserve el pigmento original.',
      objective: 'Aumentar engagement y guardados como material de referencia',
      rationale: 'El contenido educativo genera alta tasa de guardados en Instagram y posiciona como autoridad.',
    },
    {
      id: 'idea-3',
      topic: 'Flash Day exclusivo: Diseños botánicos disponibles',
      platform: 'INSTAGRAM',
      postType: 'POST',
      hook: 'Nuevos bocetos botánicos y orgánicos listos para ser tatuados esta temporada.',
      objective: 'Llenar espacios de agenda de la semana entrante',
      rationale: 'Urgencia sutil y exclusividad de diseños irrepetibles.',
    },
    {
      id: 'idea-4',
      topic: 'Cruce de disciplinas: Entre la arcilla, el lienzo y la piel',
      platform: 'TIKTOK',
      postType: 'REEL',
      hook: 'La relación entre modelar cerámica y trazar líneas sobre la piel humana.',
      objective: 'Fortalecer el posicionamiento artístico integral de la marca',
      rationale: 'Atrae coleccionistas de arte y clientes de mayor ticket promedio.',
    },
    {
      id: 'idea-5',
      topic: 'Visita guiada al estudio: Un espacio seguro y colaborativo',
      platform: 'FACEBOOK',
      postType: 'POST',
      hook: 'Diseñamos cada rincón de nuestro espacio para que te sientas en calma desde el primer minuto.',
      objective: 'Derribar objeciones y miedos en clientes primerizos',
      rationale: 'Reduce la ansiedad de personas que nunca se han tatuado y facilita la primera consulta.',
    },
  ];
}

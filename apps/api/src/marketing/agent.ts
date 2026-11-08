import { GoogleGenAI } from '@google/genai';
import type { SocialPlatform, SocialPostType } from '@cc/shared';

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

import { GoogleGenAI } from '@google/genai';
import type { SocialPlatform, SocialPostType } from '@cc/shared';

export interface BrandPromptContext {
  name: string;
  website: string;
  toneOfVoice: string;
  styleDirectives?: Record<string, unknown> | null;
  targetAudience?: string | null;
  dossierMd?: string | null;
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
    cta: cta || `Book a free consultation at nikipeppers.com to discuss placement and custom artwork.`,
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
- Target Audience: ${brand.targetAudience || 'Art enthusiasts, tattoo collectors, people seeking meaningful botanical fine line tattoos and ceramics'}
${brand.dossierMd ? `\n--- COMPLETE BRAND DOSSIER & HISTORICAL CONTEXT (.md) ---\n${brand.dossierMd}\n---------------------------------------------------------` : ''}

Post Parameters:
- Platform: ${platform}
- Format: ${postType} (POST, REEL, CAROUSEL, STORY)
- Main Topic: ${topic}
- Business Objective: ${objective || 'Drive consultation bookings on nikipeppers.com'}

Directives:
1. Ground the copy directly in the brand dossier, artist identity, philosophy, and genuine offerings.
2. STRICT NO-EMOJI POLICY: Do NOT include any emojis anywhere in the caption, hook, or hashtags.
3. Structure:
   - Hook in the first line.
   - Narrative body text with clean line breaks focusing on artistic value, client intimacy, or craft.
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

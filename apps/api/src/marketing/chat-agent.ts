import { GoogleGenAI } from '@google/genai';
import type { BrandPromptContext } from './agent.js';

export interface ChatReplyParams {
  brand: BrandPromptContext;
  incomingMessage: string;
  customerName?: string;
  customerHandle?: string;
  history?: Array<{ sender: 'customer' | 'assistant' | 'owner'; text: string }>;
  apiKey?: string;
}

export interface ChatReplyResult {
  replyText: string;
  intent: 'CONSULTATION_INQUIRY' | 'PRICING_QUESTION' | 'LOCATION_GUEST_SPOT' | 'CERAMICS_INQUIRY' | 'GENERAL_GREETING' | 'OTHER';
  confidence: number;
  suggestedAction?: string;
  source: 'ai' | 'fallback_engine';
}

/**
 * Autonomous Community Manager Chat Assistant.
 * Answers client inquiries across Instagram DM, WhatsApp, and Telegram
 * adhering strictly to the artist's brand dossier and social style playbook.
 */
export async function generateBrandChatReply(params: ChatReplyParams): Promise<ChatReplyResult> {
  const { brand, incomingMessage, customerName = 'there', history = [] } = params;
  const effectiveApiKey = params.apiKey || process.env.GEMINI_API_KEY;

  if (effectiveApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

      const historyFormatted = history
        .slice(-6)
        .map((m) => `${m.sender === 'customer' ? 'Client' : 'Assistant (Artist Studio)'}: ${m.text}`)
        .join('\n');

      const prompt = `Act as the Studio Assistant and Community Manager for ${brand.name}.
You are replying directly to a potential client via direct message or WhatsApp.

Brand Context:
- Brand Name: ${brand.name}
- Official Website: ${brand.website}
- Tone of Voice: ${brand.toneOfVoice}
${brand.dossierMd ? `\n--- BRAND STATEMENT & PRICING/SERVICES DOSSIER ---\n${brand.dossierMd.slice(0, 1500)}\n------------------------------------------------` : ''}
${brand.socialStyleMd ? `\n--- SOCIAL STYLE PLAYBOOK (VOICE & CADENCE RULES) ---\n${brand.socialStyleMd.slice(0, 1500)}\n-----------------------------------------------------` : ''}

Chat History:
${historyFormatted || 'First message in conversation.'}

Client Message: "${incomingMessage}"

Directives:
1. Ground your response completely in the artist's philosophy, consultation process, and warm, sensitive tone.
2. NEVER give arbitrary fixed prices for custom tattoos; explain warmly that custom pieces depend on anatomical placement, dimensions, and detail, and invite them gently to submit their idea at ${brand.website}.
3. STRICT NO-EMOJI POLICY: Do NOT include any emojis anywhere in the reply.
4. Keep the message concise (2-4 sentences maximum), breathable, polite, and personalized to ${customerName}.
5. Output strictly valid JSON with this schema:
{
  "replyText": "your crafted response without emojis",
  "intent": "CONSULTATION_INQUIRY | PRICING_QUESTION | LOCATION_GUEST_SPOT | CERAMICS_INQUIRY | GENERAL_GREETING | OTHER",
  "confidence": 0.95,
  "suggestedAction": "Invite client to fill out the consultation form at nikipeppers.com"
}`;

      const res = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.6,
          responseMimeType: 'application/json',
        },
      });

      const raw = res.text?.trim();
      if (raw) {
        const parsed = JSON.parse(raw) as {
          replyText?: string;
          intent?: ChatReplyResult['intent'];
          confidence?: number;
          suggestedAction?: string;
        };

        if (parsed.replyText) {
          return {
            replyText: parsed.replyText,
            intent: parsed.intent || 'GENERAL_GREETING',
            confidence: parsed.confidence || 0.9,
            suggestedAction: parsed.suggestedAction,
            source: 'ai',
          };
        }
      }
    } catch {
      // Fallback response engine
    }
  }

  // Deterministic fallback response engine
  const lower = incomingMessage.toLowerCase();
  let intent: ChatReplyResult['intent'] = 'GENERAL_GREETING';
  let replyText = `Hello! Thank you for reaching out to ${brand.name}. How can we assist you with your project today?`;
  let suggestedAction = `Direct to ${brand.website}`;

  if (lower.includes('precio') || lower.includes('cuanto') || lower.includes('cost') || lower.includes('price')) {
    intent = 'PRICING_QUESTION';
    replyText = `Hello! Each tattoo is custom designed in dialogue with your body and anatomy, so pricing depends on size, placement, and detail. The best way to receive an accurate estimate is to share your idea through the consultation form at ${brand.website}.`;
    suggestedAction = 'Direct to consultation booking form';
  } else if (lower.includes('turno') || lower.includes('cita') || lower.includes('appointment') || lower.includes('book')) {
    intent = 'CONSULTATION_INQUIRY';
    replyText = `Hello! Consultations for upcoming spots are currently open. You can explore available dates and tell us about your idea directly at ${brand.website}. We look forward to connecting with you.`;
    suggestedAction = 'Send booking calendar link';
  } else if (lower.includes('donde') || lower.includes('melbourne') || lower.includes('buenos aires') || lower.includes('cordoba') || lower.includes('location')) {
    intent = 'LOCATION_GUEST_SPOT';
    replyText = `Hello! Niki is currently tattooing between Melbourne and Argentina, with dedicated studio spots and guest appearances. You can check the current schedule and submit your request at ${brand.website}.`;
    suggestedAction = 'Provide guest spot schedule';
  } else if (lower.includes('ceramica') || lower.includes('ceramic') || lower.includes('sculpture') || lower.includes('escultura')) {
    intent = 'CERAMICS_INQUIRY';
    replyText = `Hello! Our ceramic sculptures and visual pieces are handmade in limited editions. You can view currently available pieces and private commissions directly on ${brand.website}.`;
    suggestedAction = 'Direct to ceramics gallery';
  }

  return {
    replyText,
    intent,
    confidence: 0.85,
    suggestedAction,
    source: 'fallback_engine',
  };
}

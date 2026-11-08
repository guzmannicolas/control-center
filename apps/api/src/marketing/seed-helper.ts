import type { PrismaClient } from '../generated/prisma/client.js';

export const NIKI_PEPPERS_DEFAULT_DOSSIER = `# Niki Peppers — Brand Identity, Artistic Statement & Advertising Dossier

## 1. Brand Overview & Story
- **Artist:** Nicole Peppers (Niki Peppers)
- **Role:** Visual Artist, Tattoo Artist, Ceramicist, and Muralist
- **Official Website:** https://nikipeppers.com
- **Locations & Workspaces:** Buenos Aires & Cordoba, Argentina. International guest spots.
- **Story & Philosophy:**
  My work is born from a desire to reconnect: exploring the deep relationship between the human body, nature, and emotional sensitivity. Heavily influenced by ecofeminism, I investigate how cultural systems shape our perception of the instinctive, the feminine, and the natural world.
  For many clients, getting a tattoo is a symbolic ritual: an act of personal transformation, healing, celebration, or re-signification. Each piece is an intimate dialogue between my visual universe and the person wearing it.

## 2. Tattoo Styles & Creative Specialties
- **Botanical Fine Line:** Delicate wild flora, native Argentine plants (ceibo, jacaranda, fern, eucalyptus), organic lines designed to flow naturally with body anatomy.
- **Fauna & Animals:** Symbolic animal portraits (birds, moths, snakes, felines) rendered with precise micro-lines and subtle shading.
- **Micro-Realism & Fine Line:** Highly detailed, elegant, timeless black-and-grey work.
- **Cover Ups & Transformation:** Respectfully transforming older or unwanted tattoos into harmonious new artwork.
- **Ceramics & Murals:** One-of-a-kind handmade ceramic sculptures and large-scale public and private murals.

## 3. Brand Voice, Tone & Values
- **Tone:** Sensitive, warm, authentic, empowering, thoughtful, professional.
- **Key Principles:**
  - Emphasize emotional safety, clean hygiene standards, and a calm studio environment.
  - Celebrate diverse, non-hegemonic bodies. Tattoos as freedom, self-expression, and identity.
  - Never use aggressive, transactional sales copy. Focus on storytelling, artistic intention, and consultation booking.
  - Highlight the collaborative design process: clients bring a feeling or story, Niki crafts the custom artwork.

## 4. Advertising & Marketing Directives
- **Primary Call to Action (CTA):** "Book a consultation at nikipeppers.com" / "Let us bring your idea to life."
- **Target Audience:** Women and creative individuals (20-45) interested in contemporary art, delicate tattoo aesthetics, nature, ceramics, and bespoke design.
- **Official Hashtags:** #NikiPeppers #BotanicalTattoo #FineLineTattoo #TatuajesBotanicos #ContemporaryTattoo #TattooArtistArgentina #ArteBotanico
`;

/**
 * Ensures the initial pilot brand (Niki Peppers) and its brand dossier exist.
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
          'Sensitive, warm, authentic, empowering, artistic, professional. Focus on botanical tattoos, ecofeminism, organic anatomy flow, and custom ceramics.',
        styleDirectives: {
          colors: ['#171717', '#404040', '#737373', '#a3a3a3'],
          officialHashtags: [
            '#NikiPeppers',
            '#BotanicalTattoo',
            '#FineLineTattoo',
            '#TatuajesBotanicos',
            '#ContemporaryTattoo',
          ],
          guidelines:
            'Focus on botanical studies, delicate placement on body curves, ecofeminist artistic statement, one-on-one consultation booking at nikipeppers.com.',
          brandPillars: [
            'Botanical & Fauna Fine Line Tattoos',
            'Ecofeminist Artistic Statement & Visual Art',
            'Handcrafted Ceramics & Studio Practice',
            'Client Stories & Transformation Rituals',
          ],
        },
        targetAudience: 'Women and art lovers (20-45) seeking custom fine-line tattoos, ceramics, and bespoke artistic pieces',
        whatsappNumber: '+5493512345678',
        telegramChatId: '@nikipeppers_bot',
        dossierMd: NIKI_PEPPERS_DEFAULT_DOSSIER,
        instagramHandle: 'nikipepperstattoo',
        activePlatforms: ['INSTAGRAM', 'FACEBOOK'],
      },
    });
  } else if (!niki.dossierMd || !(niki as any).instagramHandle) {
    niki = await prisma.brand.update({
      where: { id: niki.id },
      data: {
        dossierMd: niki.dossierMd || NIKI_PEPPERS_DEFAULT_DOSSIER,
        instagramHandle: (niki as any).instagramHandle || 'nikipepperstattoo',
        activePlatforms: (niki as any).activePlatforms?.length ? (niki as any).activePlatforms : ['INSTAGRAM', 'FACEBOOK'],
        toneOfVoice:
          'Sensitive, warm, authentic, empowering, artistic, professional. Focus on botanical tattoos, ecofeminism, organic anatomy flow, and custom ceramics.',
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
          campaignName: 'Meta Ads - Botanical Fine Line Consultation Bookings',
          objective: 'LEAD_GENERATION',
          dailyBudget: 20.0,
          spendToDate: 280.0,
          cpa: 6.2,
          ctr: 3.85,
          roas: 4.1,
          status: 'ACTIVE',
          safetyGuardrail: 35.0,
          insights: {
            creativeWinner: 'Reel Botanical Fern Placement',
            bestAudience: 'Women 22-42, Contemporary Art, Botany, Sustainable Design',
            recommendation: 'Maintain active pacing. Scale by 10% within guardrail.',
          },
        },
        {
          brandId: niki.id,
          platform: 'GOOGLE',
          externalCampaignId: 'goog_camp_niki_002',
          campaignName: 'Google Search - Custom Botanical Tattoo Artist Argentina',
          objective: 'HIGH_INTENT_SEARCH',
          dailyBudget: 15.0,
          spendToDate: 195.0,
          cpa: 5.4,
          ctr: 4.9,
          roas: 3.9,
          status: 'ACTIVE',
          safetyGuardrail: 25.0,
          insights: {
            topKeywords: ['tatuajes botanicos buenos aires', 'fine line tattoo artist cordoba', 'niki peppers tattoo'],
            recommendation: 'Strong intent and conversion rate on consultation page.',
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
            'Delicate botanical fern following the arm curvature.\n\nEvery piece is hand-drawn directly onto the skin during consultation to ensure the stems and leaves honor your body motion. Inspired by Argentine native flora.\n\nAppointments open for next month. Book your consultation at nikipeppers.com.\n\n#NikiPeppers #BotanicalTattoo #FineLineTattoo #TatuajesBotanicos #CustomTattoo',
          mediaUrls: ['https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?w=800&q=80'],
          status: 'PENDING_APPROVAL',
          approvalToken: 'token-niki-botanical-001',
          scheduledFor: new Date(Date.now() + 86400000),
          feedback: null,
          metrics: {},
        },
        {
          brandId: niki.id,
          platform: 'INSTAGRAM',
          postType: 'CAROUSEL',
          caption:
            'From preliminary sketch to final needlework on skin.\n\nTattooing as a ritual of personal transformation and self-reconnection. Swipe through to see the initial reference dialogue and the healed result after six weeks.\n\nLet us build your custom piece together at nikipeppers.com.\n\n#NikiPeppers #TattooProcess #BotanicalArt #FineLine #ContemporaryTattoo',
          mediaUrls: [
            'https://images.unsplash.com/photo-1590246814883-57c612c6c39a?w=800&q=80',
            'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=800&q=80',
          ],
          status: 'APPROVED',
          approvalToken: 'token-niki-process-002',
          scheduledFor: new Date(Date.now() + 86400000 * 2),
          feedback: 'Approved by artist for Thursday release.',
          metrics: {},
        },
      ],
    });
  }

  return niki;
}

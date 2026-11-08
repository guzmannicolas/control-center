import { describe, expect, it } from 'vitest';
import { auditAdCampaigns, generateSocialCreative, synthesizeSocialStylePlaybook } from './agent.js';
import { dispatchDraftApproval } from './dispatch.js';
import { scrapeInstagramProfile } from './instagram-scraper.js';
import type { SocialDraftView } from '@cc/shared';

describe('Growth & Marketing Engine - Ads & Traffic Guardrails', () => {
  it('detects guardrail breach when daily budget exceeds safetyGuardrail', () => {
    const campaigns = [
      {
        campaignName: 'Meta Retargeting Test',
        dailyBudget: 50,
        spendToDate: 120,
        safetyGuardrail: 30, // Exceeded!
        cpa: 5.5,
        ctr: 1.2,
        roas: 3.1,
        status: 'ACTIVE',
      },
    ];

    const audit = auditAdCampaigns(campaigns);
    expect(audit.isGuardrailBreached).toBe(true);
    expect(audit.safetyAlerts.length).toBeGreaterThan(0);
    expect(audit.safetyAlerts[0]).toContain('[GUARDRAIL BREACH]');
  });

  it('approves compliant campaigns within safetyGuardrail and detects high ROAS', () => {
    const campaigns = [
      {
        campaignName: 'Google Search High Intent',
        dailyBudget: 25,
        spendToDate: 80,
        safetyGuardrail: 35, // Safe!
        cpa: 4.2,
        ctr: 3.8,
        roas: 4.8, // High ROAS!
        status: 'ACTIVE',
      },
    ];

    const audit = auditAdCampaigns(campaigns);
    expect(audit.isGuardrailBreached).toBe(false);
    expect(audit.recommendations.length).toBeGreaterThan(0);
    expect(audit.recommendations[0]).toContain('[HIGH ROAS]');
  });

  it('detects low CTR and suggests creative refresh to prevent audience fatigue', () => {
    const campaigns = [
      {
        campaignName: 'TikTok Top of Funnel',
        dailyBudget: 15,
        spendToDate: 60,
        safetyGuardrail: 30,
        cpa: 9.1,
        ctr: 0.65, // Fatigued CTR < 1.0
        roas: 1.8,
        status: 'ACTIVE',
      },
    ];

    const audit = auditAdCampaigns(campaigns);
    expect(audit.recommendations.some((r) => r.includes('[LOW CTR]'))).toBe(true);
  });
});

describe('Growth & Marketing Engine - Creative Agent', () => {
  it('generates structured post copy and hashtags respecting brand context', async () => {
    const res = await generateSocialCreative({
      brand: {
        name: 'Niki Peppers',
        website: 'https://nikipeppers.com',
        toneOfVoice: 'Artistic, thoughtful, botanical fine line tattoos and ceramics',
      },
      platform: 'INSTAGRAM',
      postType: 'REEL',
      topic: 'Botanical placement along forearm motion',
    });

    expect(res.caption).toBeDefined();
    expect(res.caption.length).toBeGreaterThan(30);
    expect(res.hook).toBeDefined();
    expect(res.hashtags).toBeInstanceOf(Array);
    expect(res.hashtags.length).toBeGreaterThan(0);
    expect(res.callToAction).toContain('nikipeppers.com');
  });
});

describe('Growth & Marketing Engine - Human-in-the-Loop Dispatch', () => {
  it('formats approval preview with token URL for client review', async () => {
    const mockDraft: SocialDraftView = {
      id: 'draft_123',
      brandId: 'brand_niki',
      brandName: 'Niki Peppers',
      brandSlug: 'nikipeppers',
      platform: 'INSTAGRAM',
      postType: 'REEL',
      caption: 'Botanical fern test caption.\n\nAppointments at nikipeppers.com',
      mediaUrls: ['https://example.com/asset.jpg'],
      status: 'PENDING_APPROVAL',
      approvalToken: 'token_secret_123',
      scheduledFor: null,
      feedback: null,
      metrics: {},
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const dispatch = await dispatchDraftApproval(
      mockDraft,
      'whatsapp',
      '+5493512345678',
      'https://control.test'
    );

    expect(dispatch.ok).toBe(true);
    expect(dispatch.approvalUrl).toContain('token_secret_123');
    expect(dispatch.messagePreview).toContain('NEW CONTENT PROPOSAL');
    expect(dispatch.messagePreview).toContain('token_secret_123');
  });
});

describe('Growth & Marketing Engine - Instagram Style Scraper', () => {
  it('extracts public post references and synthesizes style analysis', async () => {
    const scraped = await scrapeInstagramProfile('nikipepperstattoo', 'nikipeppers');
    expect(scraped.handle).toBe('nikipepperstattoo');
    expect(scraped.posts.length).toBeGreaterThan(0);
    expect(scraped.posts[0]?.caption).toBeDefined();
    expect(scraped.styleAnalysis.dominantHashtags.length).toBeGreaterThan(0);
    expect(scraped.styleAnalysis.voiceSummary).toBeDefined();
  });
});

describe('Growth & Marketing Engine - Social Style Playbook Synthesizer', () => {
  it('generates a comprehensive Markdown style playbook from analyzed posts', async () => {
    const md = await synthesizeSocialStylePlaybook({
      brand: {
        name: 'Niki Peppers',
        website: 'https://nikipeppers.com',
        toneOfVoice: 'Sensitive, botanical, artistic',
      },
      handle: 'nikipepperstattoo',
      scrapedPosts: [
        {
          caption: 'Every detail matters, every shadow tells a story. Tattooing botanical pieces in Melbourne.',
          postType: 'POST',
        },
      ],
      sampleCaptions: 'Delicate fine line tattoos inspired by wild flora.',
    });

    expect(md).toContain('# Niki Peppers (@nikipepperstattoo) — Social Media Style & Copywriting Playbook');
    expect(md).toContain('## 1. Tone of Voice & Artistic Persona');
    expect(md).toContain('## 2. Caption Architecture & Hook Formulas');
    expect(md).toContain('## 6. Few-Shot Golden Reference Captions');
    expect(md).toContain('## 7. Directives for Autonomous Post Generation');
  });
});

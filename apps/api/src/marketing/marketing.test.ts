import { describe, expect, it } from 'vitest';
import { auditAdCampaigns, generateSocialCreative } from './agent.js';
import { dispatchDraftApproval } from './dispatch.js';
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
        ctr: 2.1,
        roas: 3.5,
        status: 'ACTIVE',
      },
    ];

    const audit = auditAdCampaigns(campaigns);
    expect(audit.isGuardrailBreached).toBe(true);
    expect(audit.safetyAlerts.some((a) => a.includes('GUARDRAIL EXCEDIDO'))).toBe(true);
  });

  it('approves compliant campaigns within safetyGuardrail and detects high ROAS', () => {
    const campaigns = [
      {
        campaignName: 'Niki Peppers - Hot Sauce Pack',
        dailyBudget: 25,
        spendToDate: 312,
        safetyGuardrail: 40, // Compliant
        cpa: 4.8,
        ctr: 3.4,
        roas: 4.5, // High ROAS
        status: 'ACTIVE',
      },
    ];

    const audit = auditAdCampaigns(campaigns);
    expect(audit.isGuardrailBreached).toBe(false);
    expect(audit.recommendations.some((r) => r.includes('EXCELENTE ROAS'))).toBe(true);
  });

  it('detects low CTR and suggests creative refresh to prevent audience fatigue', () => {
    const campaigns = [
      {
        campaignName: 'Fatigued Ad Set',
        dailyBudget: 15,
        spendToDate: 85,
        safetyGuardrail: 25,
        cpa: 9.2,
        ctr: 0.65, // Below 1%
        roas: 1.8,
        status: 'ACTIVE',
      },
    ];

    const audit = auditAdCampaigns(campaigns);
    expect(audit.recommendations.some((r) => r.includes('BAJO CTR'))).toBe(true);
  });
});

describe('Growth & Marketing Engine - Creative Agent', () => {
  it('generates structured post copy and hashtags respecting brand context', async () => {
    const result = await generateSocialCreative({
      brand: {
        name: 'Niki Peppers',
        website: 'https://nikipeppers.com',
        toneOfVoice: 'Picante, atrevido y gourmet',
        targetAudience: 'Amantes del picante artesanal',
      },
      platform: 'INSTAGRAM',
      postType: 'REEL',
      topic: 'Alitas Glaseadas Chipotle',
    });

    expect(result.caption).toBeDefined();
    expect(result.caption.length).toBeGreaterThan(20);
    expect(result.hashtags.length).toBeGreaterThan(0);
    expect(result.suggestedMedia.length).toBeGreaterThan(0);
  });
});

describe('Growth & Marketing Engine - Human-in-the-Loop Dispatch', () => {
  it('formats approval preview with token URL for client review', async () => {
    const sampleDraft: SocialDraftView = {
      id: 'draft-123',
      brandId: 'brand-niki',
      brandName: 'Niki Peppers',
      brandSlug: 'nikipeppers',
      platform: 'INSTAGRAM',
      postType: 'POST',
      caption: '🔥 Probá nuestra salsa habanero en tu próxima hamburguesa.',
      mediaUrls: ['https://nikipeppers.com/img/habanero.jpg'],
      status: 'PENDING_APPROVAL',
      scheduledFor: null,
      approvalToken: 'token_secret_123',
      feedback: null,
      metrics: {},
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const dispatch = await dispatchDraftApproval(
      sampleDraft,
      'Niki Peppers',
      '+5493512345678',
      'https://control.test'
    );

    expect(dispatch.ok).toBe(true);
    expect(dispatch.approvalUrl).toContain('token_secret_123');
    expect(dispatch.messagePreview).toContain('NUEVO BORRADOR DE CONTENIDO');
    expect(dispatch.messagePreview).toContain('token_secret_123');
  });
});

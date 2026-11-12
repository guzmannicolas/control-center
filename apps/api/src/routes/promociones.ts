import type { FastifyPluginAsync } from 'fastify';
import type { PromotionsOverview, PriceGlitchOverview } from '@cc/shared';
import {
  getPromotionsOverview,
  calculateBestSavings,
  getPriceGlitches,
  verifyPriceGlitch,
  verifyPromotionUrl,
} from '../promociones/engine.js';

export const promocionesRoutes: FastifyPluginAsync = async (app) => {
  // --- Promociones de Argentina (Scraping & Deals) --------------------------------------------------

  app.get('/promociones', async (req): Promise<PromotionsOverview> => {
    const query = req.query as { refresh?: string };
    const forceFresh = query.refresh === 'true' || query.refresh === '1';
    return getPromotionsOverview(forceFresh);
  });

  app.post('/promociones/scrape', async (): Promise<PromotionsOverview> => {
    // Triggers a live fresh scraping pass across Argentine sources
    return getPromotionsOverview(true);
  });

  app.post('/promociones/calculate', async (req) => {
    const body = (req.body ?? {}) as { amount: number; category?: any; dayIndex?: number };
    const results = calculateBestSavings(Number(body.amount) || 0, body.category, body.dayIndex);
    return { results };
  });

  app.get('/promociones/glitches', async (req): Promise<PriceGlitchOverview> => {
    const query = req.query as { refresh?: string };
    const forceFresh = query.refresh === 'true' || query.refresh === '1';
    return getPriceGlitches(forceFresh);
  });

  app.post('/promociones/glitches/refresh', async (): Promise<PriceGlitchOverview> => {
    return getPriceGlitches(true);
  });

  app.post('/promociones/:id/verify-url', async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = await verifyPromotionUrl(id);
    if (!item) return reply.code(404).send({ error: 'Promotion item not found' });
    return item;
  });

  app.post('/promociones/glitches/:id/verify', async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = await verifyPriceGlitch(id);
    if (!item) return reply.code(404).send({ error: 'Price glitch item not found' });
    return item;
  });
};

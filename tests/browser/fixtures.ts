import { test as base, expect, type BrowserContext, type BrowserContextOptions } from '@playwright/test';

type PartnerContexts = { partnerA: BrowserContext; partnerB: BrowserContext };
export const test = base.extend<PartnerContexts>({
  partnerA: async ({ browser }, use, testInfo) => {
    const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = testInfo.project.use;
    const context = await browser.newContext({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } as BrowserContextOptions);
    await use(context); await context.close();
  },
  partnerB: async ({ browser }, use, testInfo) => {
    const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = testInfo.project.use;
    const context = await browser.newContext({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } as BrowserContextOptions);
    await use(context); await context.close();
  },
});
export { expect };

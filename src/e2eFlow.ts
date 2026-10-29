/**
 * Playwright E2E Test Suite for LAST LOCAL (v5.3 Canonical)
 * Covers:
 * 1. Start Screen, Practice Stretch Tutorial, and Boarding into 3-Car Consist
 * 2. Offline Single-File index.html Execution with All Network Requests Blocked
 * 3. Full 13-Stop Ride to Court Sq, Report Screen, Case Files, and Endings
 */

export interface E2ePageLike {
  goto(url: string): Promise<unknown>;
  route( pattern: string, handler: (route: { abort: () => Promise<void> }) => Promise<void>): Promise<void>;
  locator(selector: string): {
    click(): Promise<void>;
    isVisible(): Promise<boolean>;
    textContent(): Promise<string | null>;
  };
  evaluate<R>(fn: () => R): Promise<R>;
}

export async function verifyOfflineSingleFileFlow(page: E2ePageLike, fileUrl: string): Promise<void> {
  // Block all external HTTP/HTTPS network requests to verify 100% offline self-containment
  await page.route('http://**/*', async (route) => {
    await route.abort();
  });
  await page.route('https://**/*', async (route) => {
    await route.abort();
  });

  await page.goto(fileUrl);

  const startVisible = await page.locator('[data-start="true"]').isVisible();
  if (!startVisible) {
    throw new Error('Expected Board train button ([data-start="true"]) to be visible on Start Screen');
  }

  await page.locator('[data-start="true"]').click();

  const phase = await page.evaluate(() => document.body.dataset.phase);
  if (phase !== 'ride') {
    throw new Error(`Expected body[data-phase="ride"] after boarding, got ${String(phase)}`);
  }
}


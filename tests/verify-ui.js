async (page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'public/test-desktop-motion.png', animations: 'disabled', timeout: 5000 });

  // Mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'public/test-mobile-home.png', animations: 'disabled', timeout: 5000 });

  // Open mobile drawer
  const menuBtn = await page.$('button[title="Open Navigation"]');
  if (menuBtn) {
    await menuBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'public/test-mobile-sidebar-open.png', animations: 'disabled', timeout: 5000 });
  }
}

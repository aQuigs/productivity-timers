// Renders icons/icon.svg to the PNG sizes the manifest and iOS need. Run it after editing
// the SVG: `node scripts/generate-icons.mjs`. Uses the Playwright Chromium the test suite
// already installs (playwright is a dependency of @web/test-runner-playwright)
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const ACCENT = '#c8f55a';

// Full-bleed variants sit on the accent colour so a launcher mask (Android maskable, iOS
// rounding) never exposes a transparent corner; the clock already sits inside the
// maskable safe zone
const OUTPUTS = [
  { file: 'icon-192.png', size: 192, bleed: false },
  { file: 'icon-512.png', size: 512, bleed: false },
  { file: 'icon-maskable-512.png', size: 512, bleed: true },
  { file: 'apple-touch-icon.png', size: 180, bleed: true }
];

const svg = await readFile(path.join(root, 'icons', 'icon.svg'), 'utf8');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const { file, size, bleed } of OUTPUTS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!doctype html><style>
      html, body { margin: 0; width: ${size}px; height: ${size}px; background: ${bleed ? ACCENT : 'transparent'}; }
      svg { display: block; width: ${size}px; height: ${size}px; }
    </style>${svg}`);
    await page.screenshot({ path: path.join(root, 'icons', file), omitBackground: !bleed });
    console.log(`icons/${file} ${size}x${size}`);
  }
} finally {
  await browser.close();
}

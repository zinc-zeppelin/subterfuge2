import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

async function main() {
  const svgPath = path.join(process.cwd(), "public", "icon.svg");
  const svgContent = fs.readFileSync(svgPath, "utf-8");
  const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;

  const browser = await chromium.launch();

  // Helper to render PNG
  async function renderPng(size: number, outPath: string) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { width: ${size}px; height: ${size}px; background: transparent; overflow: hidden; }
            img { width: 100%; height: 100%; display: block; }
          </style>
        </head>
        <body>
          <img src="${svgDataUrl}" />
        </body>
      </html>
    `);
    await page.screenshot({ path: outPath, omitBackground: true });
    await page.close();
    console.log(`Rendered: ${outPath} (${size}x${size})`);
  }

  // 1. Render PNGs
  const p16 = path.join(process.cwd(), "public", "favicon-16x16.png");
  const p32 = path.join(process.cwd(), "public", "favicon-32x32.png");
  const p180 = path.join(process.cwd(), "public", "apple-touch-icon.png");
  const p180App = path.join(process.cwd(), "src", "app", "apple-icon.png");

  await renderPng(16, p16);
  await renderPng(32, p32);
  await renderPng(180, p180);
  await renderPng(180, p180App);

  await browser.close();

  // 2. Generate ICO from 32x32 PNG
  const png32Buffer = fs.readFileSync(p32);
  const icoHeader = Buffer.alloc(22);
  // ICONDIR header
  icoHeader.writeUInt16LE(0, 0); // Reserved
  icoHeader.writeUInt16LE(1, 2); // Type 1 = ICO
  icoHeader.writeUInt16LE(1, 4); // 1 image

  // ICONDIRENTRY
  icoHeader.writeUInt8(32, 6); // Width 32
  icoHeader.writeUInt8(32, 7); // Height 32
  icoHeader.writeUInt8(0, 8); // Color count 0 (256+)
  icoHeader.writeUInt8(0, 9); // Reserved
  icoHeader.writeUInt16LE(1, 10); // Color planes
  icoHeader.writeUInt16LE(32, 12); // Bits per pixel
  icoHeader.writeUInt32LE(png32Buffer.length, 14); // Image size in bytes
  icoHeader.writeUInt32LE(22, 18); // Offset to image data (header size)

  const icoBuffer = Buffer.concat([icoHeader, png32Buffer]);

  fs.writeFileSync(path.join(process.cwd(), "public", "favicon.ico"), icoBuffer);
  fs.writeFileSync(path.join(process.cwd(), "src", "app", "favicon.ico"), icoBuffer);
  console.log("Generated favicon.ico in public/ and src/app/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

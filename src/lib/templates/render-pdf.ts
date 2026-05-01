import fs from "fs";
import type { Browser } from "puppeteer-core";

let _browser: Browser | null = null;

/** puppeteer-core has no bundled browser — resolve Chrome/Chromium for local/dev (macOS/Linux/Windows). */
function resolveLocalChromeExecutable(): string | null {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const candidates: string[] =
    process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ]
      : process.platform === "win32"
        ? [
            String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
            String.raw`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
          ]
        : [
            "/usr/bin/google-chrome-stable",
            "/usr/bin/google-chrome",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
          ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;
  const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  if (isProd) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = await import("puppeteer-core");
    _browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  } else {
    const puppeteer = await import("puppeteer-core");
    const execPath = resolveLocalChromeExecutable();
    if (!execPath) {
      throw new Error(
        "Chrome/Chromium not found for PDF generation. Install Google Chrome or set PUPPETEER_EXECUTABLE_PATH to your Chrome binary (e.g. /Applications/Google Chrome.app/Contents/MacOS/Google Chrome on macOS).",
      );
    }
    try {
      _browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: execPath,
        headless: true,
      });
    } catch (e) {
      _browser = null;
      throw e;
    }
  }
  return _browser as Browser;
}

export interface RenderPdfOptions {
  format?: "A4" | "Letter";
  landscape?: boolean;
  printBackground?: boolean;
}

export async function renderHtmlToPdf(html: string, opts: RenderPdfOptions = {}): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load", timeout: 45000 });
    const pdf = await page.pdf({
      format: opts.format ?? "A4",
      landscape: opts.landscape ?? false,
      printBackground: opts.printBackground ?? false,
      preferCSSPageSize: true,
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
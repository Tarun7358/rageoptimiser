import puppeteer, { Browser } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface ImageSettings {
  backgroundType: 'image' | 'gradient';
  backgroundValue: string; // URL or CSS gradient
  avatarStyle: 'circle' | 'square' | 'none';
  avatarBorderColor: string;
  avatarBorderSize: number;
  titleText: string;
  titleColor: string;
  titleSize: number;
  subtitleText: string;
  subtitleColor: string;
  subtitleSize: number;
  footerText: string;
  footerColor: string;
  footerSize: number;
  fontFamily: string;
  width: number;
  height: number;
  glassmorphism: boolean;
}

export class ImageGenerator {
  private static browser: Browser | null = null;
  private static cacheDir = path.resolve(process.cwd(), '.asset_cache');

  public static async init(): Promise<void> {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private static async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    
    // Launch headless chrome/chromium
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    return this.browser;
  }

  /**
   * Helper to fetch and cache external assets (avatars, backgrounds) to prevent rate limits
   */
  private static async getCachedAsset(url: string): Promise<string> {
    if (!url || !url.startsWith('http')) return url;
    
    try {
      const hash = crypto.createHash('md5').update(url).digest('hex');
      const ext = path.extname(new URL(url).pathname) || '.png';
      const cachePath = path.join(this.cacheDir, `${hash}${ext}`);
      
      // Check cache validity (1 hour)
      if (fs.existsSync(cachePath)) {
        const stats = fs.statSync(cachePath);
        const age = Date.now() - stats.mtimeMs;
        if (age < 3600 * 1000) {
          return `data:image/png;base64,${fs.readFileSync(cachePath).toString('base64')}`;
        }
      }
      
      // Fetch new
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(cachePath, buffer);
      
      return `data:image/png;base64,${buffer.toString('base64')}`;
    } catch (err) {
      console.error(`[ImageGenerator] Failed to cache asset: ${url}. Using direct URL.`, err);
      return url;
    }
  }

  public static async generateWelcomeImage(settings: Partial<ImageSettings>, userData: {
    avatarUrl?: string;
    username: string;
    serverName: string;
    memberCount: number;
  }): Promise<Buffer> {
    await this.init();
    
    const defaults: ImageSettings = {
      backgroundType: 'gradient',
      backgroundValue: 'linear-gradient(135deg, #0f0f13 0%, #1a1a24 100%)',
      avatarStyle: 'circle',
      avatarBorderColor: '#d4af37', // Gold
      avatarBorderSize: 4,
      titleText: 'Welcome {user}',
      titleColor: '#ffffff',
      titleSize: 32,
      subtitleText: 'to {server}',
      subtitleColor: '#a0a0ab',
      subtitleSize: 20,
      footerText: 'Member #{memberCount}',
      footerColor: '#d4af37',
      footerSize: 14,
      fontFamily: 'Outfit',
      width: 800,
      height: 350,
      glassmorphism: true
    };

    const s = { ...defaults, ...settings };
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport({ width: s.width, height: s.height });

      // Cache avatar & background if URLs
      let avatarDataUri = '';
      if (s.avatarStyle !== 'none' && userData.avatarUrl) {
        avatarDataUri = await this.getCachedAsset(userData.avatarUrl);
      }

      let bgStyle = '';
      if (s.backgroundType === 'image' && s.backgroundValue) {
        const bgDataUri = await this.getCachedAsset(s.backgroundValue);
        bgStyle = `background-image: url('${bgDataUri}'); background-size: cover; background-position: center;`;
      } else {
        bgStyle = `background: ${s.backgroundValue || 'linear-gradient(135deg, #0a0a0c 0%, #15151e 100%)'};`;
      }

      // Parse variable tokens
      const parse = (text: string) => text
        .replace(/{user}/g, userData.username)
        .replace(/{server}/g, userData.serverName)
        .replace(/{memberCount}/g, userData.memberCount.toString());

      const parsedTitle = parse(s.titleText);
      const parsedSubtitle = parse(s.subtitleText);
      const parsedFooter = parse(s.footerText);

      // Construct HTML Template
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=Inter:wght@400;600;800&family=Playfair+Display:wght@600&family=Outfit:wght@400;600;700&family=Share+Tech+Mono&display=swap" rel="stylesheet">
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: '${s.fontFamily}', 'Outfit', 'Inter', sans-serif;
              width: ${s.width}px;
              height: ${s.height}px;
              overflow: hidden;
              display: flex;
              align-items: center;
              justify-content: center;
              ${bgStyle}
            }
            .card {
              width: calc(100% - 40px);
              height: calc(100% - 40px);
              border-radius: 16px;
              display: flex;
              align-items: center;
              padding: 0 40px;
              position: relative;
              overflow: hidden;
              ${s.glassmorphism ? `
                background: rgba(10, 10, 10, 0.55);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(212, 175, 55, 0.15);
              ` : `
                border: 1px solid rgba(255, 255, 255, 0.05);
              `}
            }
            .avatar-container {
              margin-right: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .avatar {
              width: 140px;
              height: 140px;
              background-color: #232428;
              background-size: cover;
              background-position: center;
              border: ${s.avatarBorderSize}px solid ${s.avatarBorderColor};
              ${s.avatarStyle === 'circle' ? 'border-radius: 50%;' : 'border-radius: 16px;'}
              box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
            }
            .content-container {
              display: flex;
              flex-direction: column;
              justify-content: center;
              flex: 1;
            }
            .title {
              font-size: ${s.titleSize}px;
              font-weight: 800;
              color: ${s.titleColor};
              margin-bottom: 6px;
              letter-spacing: -0.5px;
              white-space: nowrap;
              text-overflow: ellipsis;
              overflow: hidden;
              text-shadow: 0 2px 4px rgba(0,0,0,0.5);
            }
            .subtitle {
              font-size: ${s.subtitleSize}px;
              font-weight: 500;
              color: ${s.subtitleColor};
              margin-bottom: 12px;
              text-shadow: 0 1px 2px rgba(0,0,0,0.5);
            }
            .footer {
              font-size: ${s.footerSize}px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 2px;
              color: ${s.footerColor};
            }
            .watermark {
              position: absolute;
              bottom: 16px;
              right: 20px;
              font-size: 9px;
              color: rgba(255, 255, 255, 0.15);
              font-family: 'Share Tech Mono', monospace;
              letter-spacing: 1px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            ${s.avatarStyle !== 'none' && avatarDataUri ? `
              <div class="avatar-container">
                <div class="avatar" style="background-image: url('${avatarDataUri}');"></div>
              </div>
            ` : ''}
            <div class="content-container">
              <div class="title">${parsedTitle}</div>
              <div class="subtitle">${parsedSubtitle}</div>
              <div class="footer">${parsedFooter}</div>
            </div>
            <div class="watermark">POWERED BY RAGE OPTIMISER</div>
          </div>
        </body>
        </html>
      `;

      await page.setContent(htmlContent, { waitUntil: 'networkidle0' as any });
      
      // Capture screenshot as buffer
      const buffer = await page.screenshot({ type: 'png' }) as Buffer;
      return buffer;
    } finally {
      await page.close();
    }
  }

  public static async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Clean shutdown hook
process.on('exit', () => {
  ImageGenerator.closeBrowser().catch(console.error);
});

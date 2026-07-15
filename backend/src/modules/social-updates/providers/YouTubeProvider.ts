/**
 * Social Updates Module — YouTubeProvider
 *
 * Uses YouTube's public Atom/RSS feed — no API key required.
 * Feed URL: https://www.youtube.com/feeds/videos.xml?channel_id=<CHANNEL_ID>
 *
 * Channel ID resolution:
 *   - Direct channel ID (UCxxxxxxx) → used as-is
 *   - @handle or vanity URL → resolved via YouTube page head tag
 *   - Full channel URL → strip to ID or handle then resolve
 */

import { BaseProvider, ContentItem, ProviderType, ProviderValidation } from './BaseProvider.js';

const RSS_BASE = 'https://www.youtube.com/feeds/videos.xml?channel_id=';
const YT_CHANNEL_PATTERN = /UC[\w-]{21}[AQgw]/;

export class YouTubeProvider extends BaseProvider {
  readonly type: ProviderType = 'youtube';
  readonly displayName = 'YouTube';

  // ── Channel ID Resolution ─────────────────────────────────────────────────

  private extractChannelIdFromInput(input: string): { type: 'id' | 'handle' | 'url'; value: string } {
    const trimmed = input.trim();

    // Direct channel ID (UCxxxxxxxx)
    if (YT_CHANNEL_PATTERN.test(trimmed)) {
      return { type: 'id', value: trimmed };
    }

    // @handle
    if (trimmed.startsWith('@')) {
      return { type: 'handle', value: trimmed };
    }

    // Full URL patterns
    if (trimmed.includes('youtube.com')) {
      // https://www.youtube.com/channel/UCxxxxxx
      const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]{21}[AQgw])/);
      if (channelMatch) return { type: 'id', value: channelMatch[1] };

      // https://www.youtube.com/@handle
      const atMatch = trimmed.match(/youtube\.com\/@([\w.-]+)/);
      if (atMatch) return { type: 'handle', value: `@${atMatch[1]}` };

      // https://www.youtube.com/c/name or /user/name
      const legacyMatch = trimmed.match(/youtube\.com\/(?:c|user)\/([\w.-]+)/);
      if (legacyMatch) return { type: 'handle', value: `@${legacyMatch[1]}` };
    }

    // Bare handle without @
    return { type: 'handle', value: `@${trimmed}` };
  }

  private async resolveHandleToChannelId(handle: string): Promise<{ channelId: string | null; name: string | null; avatar: string | null }> {
    const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
    const pageUrl = `https://www.youtube.com/@${cleanHandle}`;

    try {
      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) return { channelId: null, name: null, avatar: null };
      const html = await response.text();

      // Extract channel ID from page meta / canonical URL / browseId / og:url
      const idMatch = html.match(/"channelId":"(UC[\w-]{21}[AQgw])"/) ||
                      html.match(/"browseId":"(UC[\w-]{21}[AQgw])"/) ||
                      html.match(/youtube\.com\/channel\/(UC[\w-]{21}[AQgw])/) ||
                      html.match(/<meta property="og:url" content="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{21}[AQgw])/);
      
      const nameMatch = html.match(/<meta property="og:title" content="([^"]+)"/) ||
                        html.match(/<meta name="twitter:title" content="([^"]+)"/) ||
                        html.match(/<title>([^<]+)<\/title>/);
      
      const avatarMatch = html.match(/<meta property="og:image" content="([^"]+)"/) ||
                          html.match(/<meta name="twitter:image" content="([^"]+)"/) ||
                          html.match(/"thumbnails":\[{"url":"(https:\/\/yt3\.ggpht\.com[^"]+)"/);

      let avatarUrl = avatarMatch?.[1] || avatarMatch?.[2] || null;
      if (avatarUrl) {
        avatarUrl = avatarUrl.replace(/&amp;/g, '&');
        if (avatarUrl.includes('=s')) {
          avatarUrl = avatarUrl.replace(/=s\d+[^&]*/, '=s176');
        }
      }

      return {
        channelId: idMatch?.[1] || null,
        name: nameMatch?.[1]?.replace(' - YouTube', '') || cleanHandle,
        avatar: avatarUrl
      };
    } catch {
      return { channelId: null, name: null, avatar: null };
    }
  }

  private async fetchChannelInfo(channelId: string): Promise<{ name: string; avatar: string | null; subscriberCount?: number; isVerified?: boolean }> {
    try {
      const pageUrl = `https://www.youtube.com/channel/${channelId}`;
      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) return { name: channelId, avatar: null };
      const html = await response.text();

      const nameMatch = html.match(/<meta property="og:title" content="([^"]+)"/) ||
                        html.match(/<meta name="twitter:title" content="([^"]+)"/) ||
                        html.match(/<title>([^<]+)<\/title>/);

      const avatarMatch = html.match(/<meta property="og:image" content="([^"]+)"/) ||
                          html.match(/<meta name="twitter:image" content="([^"]+)"/) ||
                          html.match(/"thumbnails":\[{"url":"(https:\/\/yt3\.ggpht\.com[^"]+)"/);

      let avatarUrl = avatarMatch?.[1] || avatarMatch?.[2] || null;
      if (avatarUrl) {
        avatarUrl = avatarUrl.replace(/&amp;/g, '&');
        if (avatarUrl.includes('=s')) {
          avatarUrl = avatarUrl.replace(/=s\d+[^&]*/, '=s176');
        }
      }

      return {
        name: nameMatch?.[1]?.replace(' - YouTube', '') || channelId,
        avatar: avatarUrl,
        subscriberCount: undefined,
        isVerified: html.includes('"isVerified":true')
      };
    } catch {
      return { name: channelId, avatar: null };
    }
  }

  // ── RSS Feed Parsing ──────────────────────────────────────────────────────

  private parseAtomXml(xml: string): ContentItem[] {
    const items: ContentItem[] = [];

    // Extract all <entry> blocks
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let entryMatch: RegExpExecArray | null;

    while ((entryMatch = entryRegex.exec(xml)) !== null) {
      const entry = entryMatch[1];

      const videoId = this.extractTag(entry, 'yt:videoId') || '';
      const title = this.decodeEntities(this.extractTag(entry, 'title') || '');
      const published = this.extractTag(entry, 'published') || new Date().toISOString();
      const updated = this.extractTag(entry, 'updated') || published;
      const description = this.decodeEntities(
        this.extractTag(entry, 'media:description') || ''
      ).substring(0, 500);

      // Thumbnail from media:group
      const thumbnailMatch = entry.match(/media:thumbnail[^>]+url="([^"]+)"/);
      const thumbnailUrl = thumbnailMatch?.[1] || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      const viewCountMatch = entry.match(/media:statistics[^>]+views="(\d+)"/);
      const viewCount = viewCountMatch ? parseInt(viewCountMatch[1]) : 0;

      const url = `https://www.youtube.com/watch?v=${videoId}`;

      // Heuristic Shorts detection: duration not in RSS, but title/url patterns can hint
      const isShort = title.toLowerCase().includes('#shorts') || description.toLowerCase().includes('#shorts');

      if (videoId && title) {
        items.push({
          id: videoId,
          title,
          url,
          thumbnailUrl,
          description,
          publishedAt: published,
          viewCount,
          isShort,
          isLive: false,
          isPremiere: false,
          isCommunityPost: false,
          extra: { 'video.updated': updated }
        });
      }
    }

    return items;
  }

  private extractTag(xml: string, tag: string): string | null {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return match?.[1]?.trim() || null;
  }

  private decodeEntities(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async validate(input: string): Promise<ProviderValidation> {
    try {
      const parsed = this.extractChannelIdFromInput(input);
      let channelId: string | null = null;
      let name: string | null = null;
      let avatar: string | null = null;

      if (parsed.type === 'id') {
        channelId = parsed.value;
        const info = await this.fetchChannelInfo(channelId);
        name = info.name;
        avatar = info.avatar;
      } else {
        const resolved = await this.resolveHandleToChannelId(parsed.value);
        channelId = resolved.channelId;
        name = resolved.name;
        avatar = resolved.avatar;
      }

      if (!channelId) {
        return { valid: false, sourceId: '', sourceName: '', error: 'Could not resolve YouTube channel. Check the URL or handle.' };
      }

      // Verify RSS feed is accessible
      const rssUrl = `${RSS_BASE}${channelId}`;
      const rssResp = await fetch(rssUrl, { signal: AbortSignal.timeout(8000) });
      if (!rssResp.ok) {
        return { valid: false, sourceId: channelId, sourceName: name || channelId, error: 'Channel RSS feed is not accessible.' };
      }

      return {
        valid: true,
        sourceId: channelId,
        sourceName: name || channelId,
        sourceAvatar: avatar || undefined
      };
    } catch (err: any) {
      return { valid: false, sourceId: '', sourceName: '', error: `Validation failed: ${err.message}` };
    }
  }

  async fetchLatest(channelId: string, limit = 15): Promise<ContentItem[]> {
    const rssUrl = `${RSS_BASE}${channelId}`;
    const resp = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(12000)
    });

    if (!resp.ok) throw new Error(`RSS feed returned ${resp.status} for channel ${channelId}`);

    const xml = await resp.text();
    const items = this.parseAtomXml(xml);
    return items.slice(0, limit);
  }

  prepareTemplateData(item: ContentItem, source: { sourceId: string; sourceName: string; sourceAvatar?: string }): Record<string, string> {
    const base = super.prepareTemplateData(item, source);
    return {
      ...base,
      'channel.url': `https://www.youtube.com/channel/${source.sourceId}`,
      'post.caption': item.description || '',
      'post.image': item.thumbnailUrl || '',
      'post.url': item.url,
      'profile.name': source.sourceName,
      'profile.username': source.sourceId,
      'profile.avatar': source.sourceAvatar || ''
    };
  }
}

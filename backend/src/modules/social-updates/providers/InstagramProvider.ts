/**
 * Social Updates Module — InstagramProvider
 *
 * Instagram's official API requires a Facebook Developer App + user authentication.
 * This provider implements the full interface and serves mock/sample data so the
 * embed builder, template engine, and UI all work correctly.
 *
 * The provider is designed to be trivially swapped to a real implementation by
 * replacing the fetchLatest() and validate() methods with actual Meta Graph API calls.
 * All configuration, storage, and dispatch logic is already wired.
 */

import { BaseProvider, ContentItem, ProviderType, ProviderValidation } from './BaseProvider.js';

export class InstagramProvider extends BaseProvider {
  readonly type: ProviderType = 'instagram';
  readonly displayName = 'Instagram';

  async validate(input: string): Promise<ProviderValidation> {
    // Normalize: strip URLs and @ prefixes
    let username = input.trim()
      .replace(/^https?:\/\/(www\.)?instagram\.com\/?/, '')
      .replace(/^@/, '')
      .replace(/\/$/, '')
      .split('/')[0]
      .split('?')[0];

    if (!username || username.length < 1 || username.length > 30) {
      return {
        valid: false,
        sourceId: '',
        sourceName: '',
        error: 'Invalid Instagram username format.'
      };
    }

    // Validate username characters
    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      return {
        valid: false,
        sourceId: '',
        sourceName: '',
        error: 'Username contains invalid characters.'
      };
    }

    // Return success — backend live-fetch would happen here with Meta Graph API
    // For now, validates format and returns a configuration-ready entry
    return {
      valid: true,
      sourceId: username,
      sourceName: `@${username}`,
      sourceAvatar: undefined,
      subscriberCount: undefined,
      isVerified: false
    };
  }

  async fetchLatest(username: string, limit = 10): Promise<ContentItem[]> {
    // In a production environment with Meta Graph API access:
    // 1. Exchange stored access token for content listing
    // 2. GET https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp
    // 3. Map response to ContentItem[]
    //
    // For now: return sample data so test notifications work correctly
    return this.generateSamplePosts(username, limit);
  }

  private generateSamplePosts(username: string, limit: number): ContentItem[] {
    const types = [
      { isShort: false, title: 'New post shared' },
      { isShort: true, title: 'New Reel published' }
    ];

    // Use a fixed reference base time to ensure stable IDs and timestamps across polls
    const baseTime = 1780000000000; 
    const posts: ContentItem[] = Array.from({ length: Math.min(limit, 3) }, (_, i) => {
      const t = types[i % types.length];
      const date = new Date(baseTime - i * 3600000);
      return {
        id: `ig_sample_${username}_${i}`,
        title: `${t.title} by @${username}`,
        url: `https://www.instagram.com/${username}/`,
        thumbnailUrl: undefined,
        description: `Check out the latest content from @${username} on Instagram!`,
        publishedAt: date.toISOString(),
        isShort: t.isShort,
        isLive: false,
        isPremiere: false,
        isCommunityPost: false,
        extra: {
          'post.caption': `Check out the latest content from @${username}! 📸`,
          'post.image': '',
          'post.url': `https://www.instagram.com/${username}/`,
          'profile.name': username,
          'profile.username': username,
          'profile.avatar': ''
        }
      };
    });

    // Sandbox real-time simulator: generate a new post every 2 minutes
    const now = Date.now();
    const intervalKey = Math.floor(now / (120 * 1000)); // New ID every 2 minutes
    const dynamicPost: ContentItem = {
      id: `ig_live_${username}_${intervalKey}`,
      title: `New post shared by @${username}`,
      url: `https://www.instagram.com/${username}/`,
      thumbnailUrl: undefined,
      description: `Check out this brand new post from @${username} on Instagram! (Live Simulation)`,
      publishedAt: new Date(now).toISOString(),
      isShort: false,
      isLive: false,
      isPremiere: false,
      isCommunityPost: false,
      extra: {
        'post.caption': `Live update from @${username}! 📸 (Live Simulation)`,
        'post.image': '',
        'post.url': `https://www.instagram.com/${username}/`,
        'profile.name': username,
        'profile.username': username,
        'profile.avatar': ''
      }
    };

    return [dynamicPost, ...posts];
  }

  override filterByContentType(items: ContentItem[], filter: any): ContentItem[] {
    return items.filter(item => {
      // For Instagram, contentTypes is { posts: boolean, reels: boolean, stories: boolean }
      if (item.isShort) {
        // Reels
        return !!filter.reels;
      }
      // Posts
      return !!filter.posts;
    });
  }

  prepareTemplateData(item: ContentItem, source: { sourceId: string; sourceName: string; sourceAvatar?: string }): Record<string, string> {
    return {
      'post.caption': item.description || '',
      'post.image': item.thumbnailUrl || '',
      'post.url': item.url,
      'post.publish_date': item.publishedAt,
      'post.id': item.id,
      'profile.name': source.sourceName,
      'profile.username': source.sourceId,
      'profile.avatar': source.sourceAvatar || '',
      'profile.url': `https://www.instagram.com/${source.sourceId}/`,
      // Compatibility aliases
      'video.title': item.title,
      'video.url': item.url,
      'video.thumbnail': item.thumbnailUrl || '',
      'video.description': item.description || '',
      'video.publish_date': item.publishedAt,
      'video.live': '',
      'video.short': item.isShort ? 'true' : '',
      'channel.name': source.sourceName,
      'channel.id': source.sourceId,
      'channel.avatar': source.sourceAvatar || '',
      'channel.url': `https://www.instagram.com/${source.sourceId}/`,
      ...(item.extra || {})
    };
  }
}

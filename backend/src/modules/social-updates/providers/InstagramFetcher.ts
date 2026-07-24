/**
 * Social Updates Module — InstagramFetcher
 *
 * Direct interface for communicating with Instagram feeds in Sandbox mode.
 * Simulates a stateful feed database to test Posts, Reels, Carousels, and Stories.
 */

import { ContentItem } from './BaseProvider.js';

export class InstagramFetcher {
  private static mockFeed = new Map<string, ContentItem[]>();

  /**
   * Fetch latest feed items for a simulated username.
   */
  static fetchLatest(username: string, limit = 15): ContentItem[] {
    let feed = this.mockFeed.get(username);
    if (!feed) {
      feed = this.generateInitialFeed(username);
      this.mockFeed.set(username, feed);
    }
    return feed.slice(0, limit);
  }

  /**
   * Manually trigger a mock post upload in the sandbox.
   */
  static triggerUpload(
    username: string,
    type: 'post' | 'reel' | 'carousel' | 'story',
    title?: string
  ): ContentItem {
    const feed = this.mockFeed.get(username) || this.generateInitialFeed(username);
    const id = `ig_mock_${type}_${Date.now()}`;
    
    let expiresAt: string | undefined = undefined;
    if (type === 'story') {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }

    const item: ContentItem = {
      id,
      title: title || `New Instagram ${type} by @${username}`,
      url: `https://www.instagram.com/p/${id}/`,
      thumbnailUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500',
      description: `This is a stateful mock ${type} generated via the Sandbox Controller for @${username}! 📸`,
      publishedAt: new Date().toISOString(),
      isShort: type === 'reel',
      extra: {
        'post.caption': `Stateful mock ${type} caption from @${username}! #sandbox #rageoptimiser`,
        'post.image': 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500',
        'post.url': `https://www.instagram.com/p/${id}/`,
        'profile.name': username,
        'profile.username': username,
        'profile.avatar': '',
        'contentType': type,
        'expiresAt': expiresAt || '',
        'provider': 'instagram',
        'sourceId': username
      }
    };

    feed.unshift(item);
    this.mockFeed.set(username, feed);
    return item;
  }

  /**
   * Pre-populate mock items for verification checks.
   */
  private static generateInitialFeed(username: string): ContentItem[] {
    const baseTime = Date.now() - 3 * 3600 * 1000;
    return [
      {
        id: `ig_mock_post_${username}_1`,
        title: `Awesome Photo by @${username}`,
        url: `https://www.instagram.com/p/ig_mock_post_${username}_1/`,
        thumbnailUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500',
        description: `Enjoying the sunset! 🌅 #sunset #nature`,
        publishedAt: new Date(baseTime).toISOString(),
        extra: {
          'post.caption': `Enjoying the sunset! 🌅 #sunset #nature`,
          'post.image': 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500',
          'post.url': `https://www.instagram.com/p/ig_mock_post_${username}_1/`,
          'profile.name': username,
          'profile.username': username,
          'profile.avatar': '',
          'contentType': 'post',
          'provider': 'instagram',
          'sourceId': username
        }
      },
      {
        id: `ig_mock_reel_${username}_2`,
        title: `Epic Coding Reel by @${username}`,
        url: `https://www.instagram.com/p/ig_mock_reel_${username}_2/`,
        thumbnailUrl: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500',
        description: `Refactoring backend modules like a pro! 💻 #coding #refactor`,
        publishedAt: new Date(baseTime - 3600 * 1000).toISOString(),
        isShort: true,
        extra: {
          'post.caption': `Refactoring backend modules like a pro! 💻 #coding #refactor`,
          'post.image': 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500',
          'post.url': `https://www.instagram.com/p/ig_mock_reel_${username}_2/`,
          'profile.name': username,
          'profile.username': username,
          'profile.avatar': '',
          'contentType': 'reel',
          'provider': 'instagram',
          'sourceId': username
        }
      }
    ];
  }
}

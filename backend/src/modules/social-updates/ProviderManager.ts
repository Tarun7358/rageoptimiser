/**
 * Social Updates Module — ProviderManager
 *
 * Central registry for all social provider instances.
 * Adding a new provider = create a class implementing BaseProvider, register it here.
 * The rest of the system needs zero changes.
 */

import { BaseProvider, ProviderType } from './providers/BaseProvider.js';
import { YouTubeProvider } from './providers/YouTubeProvider.js';
import { InstagramProvider } from './providers/InstagramProvider.js';

export class ProviderManager {
  private static providers = new Map<ProviderType, BaseProvider>();

  static {
    // Register all built-in providers
    const youtube = new YouTubeProvider();
    const instagram = new InstagramProvider();

    ProviderManager.providers.set(youtube.type, youtube);
    ProviderManager.providers.set(instagram.type, instagram);
  }

  /**
   * Get a provider by type. Throws if not registered.
   */
  static getProvider(type: string): BaseProvider {
    const provider = this.providers.get(type as ProviderType);
    if (!provider) {
      throw new Error(`Social provider "${type}" is not registered. Available: ${[...this.providers.keys()].join(', ')}`);
    }
    return provider;
  }

  /**
   * Register a custom provider at runtime (for plugin extension).
   */
  static register(provider: BaseProvider): void {
    this.providers.set(provider.type, provider);
  }

  /**
   * List all registered provider types.
   */
  static getRegisteredTypes(): ProviderType[] {
    return [...this.providers.keys()];
  }

  /**
   * Check if a provider type is registered.
   */
  static has(type: string): boolean {
    return this.providers.has(type as ProviderType);
  }
}

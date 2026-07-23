import { jest } from '@jest/globals';
import { PrefixParser } from '../src/core/prefix/PrefixParser.js';
import { PrefixResolver } from '../src/core/prefix/PrefixResolver.js';
import { PrefixRegistry } from '../src/core/prefix/PrefixRegistry.js';
import { FuzzySuggestions } from '../src/core/prefix/FuzzySuggestions.js';
import { PrefixCooldownManager } from '../src/core/prefix/PrefixCooldownManager.js';
import { SyntheticInteraction } from '../src/core/prefix/SyntheticInteraction.js';

describe('Prefix System Suite', () => {
  describe('PrefixParser', () => {
    it('should tokenize basic command and positional arguments', () => {
      const parsed = PrefixParser.parse('ban 123456 Spamming chat');
      expect(parsed.commandName).toBe('ban');
      expect(parsed.args).toEqual(['123456', 'Spamming', 'chat']);
    });

    it('should parse double-quoted arguments', () => {
      const parsed = PrefixParser.parse('say "Hello World" --silent');
      expect(parsed.commandName).toBe('say');
      expect(parsed.args).toEqual(['Hello World']);
      expect(parsed.flags.silent).toBe(true);
    });

    it('should parse key-value flags', () => {
      const parsed = PrefixParser.parse('warn 987654 --reason="Rule 1 breach" -f');
      expect(parsed.commandName).toBe('warn');
      expect(parsed.flags.reason).toBe('Rule 1 breach');
      expect(parsed.flags.f).toBe(true);
    });
  });

  describe('PrefixResolver', () => {
    it('should resolve default prefix r!', () => {
      const mockMsg: any = { content: 'r!ping', guildId: 'guild1' };
      const res = PrefixResolver.resolvePrefix(mockMsg);
      expect(res.matched).toBe(true);
      expect(res.isMention).toBe(false);
      expect(res.commandString).toBe('ping');
    });

    it('should resolve mention prefix', () => {
      const botUserId = '112233445566778899';
      const mockMsg: any = { content: `<@${botUserId}> help moderation`, guildId: 'guild1' };
      const res = PrefixResolver.resolvePrefix(mockMsg, botUserId);
      expect(res.matched).toBe(true);
      expect(res.isMention).toBe(true);
      expect(res.commandString).toBe('help moderation');
    });

    it('should identify standalone mention without command string', () => {
      const botUserId = '112233445566778899';
      const mockMsg: any = { content: `<@!${botUserId}>`, guildId: 'guild1' };
      const res = PrefixResolver.resolvePrefix(mockMsg, botUserId);
      expect(res.matched).toBe(true);
      expect(res.isMentionOnly).toBe(true);
    });
  });

  describe('PrefixRegistry & Aliases', () => {
    beforeAll(() => {
      const mockManifest: any = {
        id: 'moderation',
        name: 'Moderation Console',
        commands: [
          { name: 'ban', description: 'Ban a user' },
          { name: 'purge', description: 'Purge messages' }
        ]
      };
      PrefixRegistry.initialize([mockManifest]);
    });

    it('should resolve aliases O(1)', () => {
      const banCmd = PrefixRegistry.getCommand('b');
      expect(banCmd).toBeDefined();
      expect(banCmd?.name).toBe('ban');

      const purgeCmd = PrefixRegistry.getCommand('clear');
      expect(purgeCmd).toBeDefined();
      expect(purgeCmd?.name).toBe('purge');
    });
  });

  describe('FuzzySuggestions', () => {
    it('should suggest close matching commands', () => {
      const candidates = ['ban', 'kick', 'mute', 'unban', 'warn', 'purge'];
      const suggestion = FuzzySuggestions.suggest('bn', candidates);
      expect(suggestion).toBe('ban');
    });
  });

  describe('PrefixCooldownManager', () => {
    it('should enforce user cooldown', () => {
      const userId = 'user_test_1';
      const res1 = PrefixCooldownManager.checkCooldown(userId, 'g1', 'ban', 5, false);
      expect(res1.onCooldown).toBe(false);

      const res2 = PrefixCooldownManager.checkCooldown(userId, 'g1', 'ban', 5, false);
      expect(res2.onCooldown).toBe(true);
      expect(res2.retryAfter).toBeGreaterThan(0);
    });

    it('should bypass cooldown for owner', () => {
      const userId = 'owner_test_1';
      const res = PrefixCooldownManager.checkCooldown(userId, 'g1', 'ban', 5, true);
      expect(res.onCooldown).toBe(false);
    });
  });

  describe('SyntheticInteraction Adapter', () => {
    it('should extract options correctly', () => {
      const mockMsg: any = {
        id: 'msg_101',
        content: 'r!purge 50',
        author: { id: 'u1', username: 'Tester' },
        guild: null,
        guildId: null,
        channel: { send: jest.fn() },
        mentions: { users: { first: () => null }, members: { first: () => null }, roles: { first: () => null }, channels: { first: () => null } },
        reply: jest.fn()
      };
      const parsed = PrefixParser.parse('purge 50');
      const cmdDef = { options: [{ name: 'amount', type: 4, required: true }] };

      const interaction = new SyntheticInteraction(mockMsg, parsed, cmdDef);

      expect(interaction.isChatInputCommand()).toBe(true);
      expect(interaction.options.getInteger('amount')).toBe(50);
    });
  });
});

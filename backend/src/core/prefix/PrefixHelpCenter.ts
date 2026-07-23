import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message
} from 'discord.js';
import { PrefixRegistry, PrefixCommandMeta } from './PrefixRegistry.js';
import { PrefixResolver } from './PrefixResolver.js';

export class PrefixHelpCenter {
  public static async handleHelp(message: Message, query?: string): Promise<any> {
    const guildId = message.guildId || undefined;
    const currentPrefix = PrefixResolver.getPrefix(guildId);
    const latency = message.client.ws.ping > 0 ? message.client.ws.ping : 14;

    if (!query) {
      return this.sendRootHelp(message, currentPrefix, latency);
    }

    const cleanQuery = query.trim().toLowerCase();

    // Check if query is a category / module
    const categories = PrefixRegistry.getCategories();
    const matchedCategory = categories.find(c => c.toLowerCase() === cleanQuery);

    if (matchedCategory) {
      return this.sendModuleHelp(message, matchedCategory, currentPrefix, 1);
    }

    // Check if query is a command name or alias
    const command = PrefixRegistry.getCommand(cleanQuery);
    if (command) {
      return this.sendCommandHelp(message, command, currentPrefix);
    }

    // Unknown module/command fallback
    const embed = new EmbedBuilder()
      .setTitle('🔍 Command Engine — No Match Found')
      .setDescription(`No module or command matching **\`${query}\`** was found.\n\nType **\`${currentPrefix}help\`** to open the Command Matrix or use the dropdown menu below.`)
      .setColor('#ff4444')
      .setFooter({ text: 'Rage Optimiser • Command Engine' });

    return message.reply({ embeds: [embed] });
  }

  public static async sendRootHelp(message: Message, prefix: string, latency: number): Promise<any> {
    const categories = PrefixRegistry.getCategories();
    const totalCommands = PrefixRegistry.getAllCommands().length;

    const categoryIcons: Record<string, string> = {
      'AntiNuke': '🛡️',
      'AutoMod': '⚙️',
      'Ticket': '🎫',
      'Welcome': '👋',
      'Utility': '🛠️',
      'Music': '🎵',
      'Moderation': '🔨',
      'Logging': '📜',
      'Giveaway': '🎉',
      'Leaderboard': '🏆',
      'Leveling': '🏆',
      'Voice Protection': '🎤',
      'VoiceMaster': '🎙️',
      'Reaction Roles': '🎭',
      'Custom Roles': '⭐',
      'Automations': '🤖',
      'Backup': '📦',
      'Security': '🔐',
      'Core': '👑',
      'Administration': '⚙️'
    };

    // Organized Matrix Grouping
    const securityGroup = ['AntiNuke', 'Security', 'AutoMod', 'Voice Protection'].filter(c => categories.includes(c as any));
    const modGroup = ['Administration', 'Moderation', 'Backup', 'Logging'].filter(c => categories.includes(c as any));
    const commGroup = ['Leveling', 'Welcome', 'Giveaway', 'Ticket', 'Reaction Roles'].filter(c => categories.includes(c as any));
    const autoGroup = ['Automations', 'VoiceMaster', 'Utility', 'Music', 'Core'].filter(c => categories.includes(c as any));

    // Fallback for remaining uncategorized modules
    const mapped = new Set([...securityGroup, ...modGroup, ...commGroup, ...autoGroup]);
    const extraGroup = categories.filter(c => !mapped.has(c));

    const formatGroupPills = (list: string[]) => list.map(c => `\`${c}\``).join('  •  ');

    const descLines = [
      `*Enterprise Guild Protection & Command Center*\n`,
      `> 💬 **Prefix:** \`${prefix}\`   •   🤖 **Slash:** \`/\``,
      `> 🏓 **Latency:** \`${latency}ms\`   •   🧩 **Modules:** \`${categories.length}\`   •   ⚡ **Commands:** \`${totalCommands > 0 ? totalCommands + '+' : '700+'}\`\n`,
      `🛡️ **Security & AntiNuke**`,
      `${formatGroupPills(securityGroup) || '`None`'}\n`,
      `🔨 **Moderation & Management**`,
      `${formatGroupPills(modGroup) || '`None`'}\n`,
      `🎁 **Community & Engagement**`,
      `${formatGroupPills(commGroup) || '`None`'}\n`,
      `🤖 **Automations & Utilities**`,
      `${formatGroupPills(autoGroup) || '`None`'}`
    ];

    if (extraGroup.length > 0) {
      descLines.push(`\n📁 **Other Modules**\n${formatGroupPills(extraGroup)}`);
    }

    descLines.push(`\n*Type \`${prefix}help <module>\` or select a module from the dropdown below.*`);

    const embed = new EmbedBuilder()
      .setTitle('⚡ Rage Optimiser Help Center')
      .setDescription(descLines.join('\n'))
      .setColor('#7c5cfc')
      .setThumbnail(message.client.user?.displayAvatarURL() || null)
      .setFooter({
        text: `Rage Optimiser Enterprise • Engine v2.5`,
        iconURL: message.client.user?.displayAvatarURL()
      })
      .setTimestamp();

    // Select Menu for categories
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_category_select')
      .setPlaceholder('Select a Command Module...')
      .addOptions(
        categories.slice(0, 25).map(cat => ({
          label: cat,
          value: `help_cat_${cat.toLowerCase()}`,
          description: `View all ${cat} commands and syntax`,
          emoji: categoryIcons[cat] || '📁'
        }))
      );

    const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const btnDashboard = new ButtonBuilder().setLabel('Dashboard').setStyle(ButtonStyle.Link).setURL('https://rageoptimiser.com/dashboard');
    const btnInvite = new ButtonBuilder().setLabel('Invite Bot').setStyle(ButtonStyle.Link).setURL(`https://discord.com/api/oauth2/authorize?client_id=${message.client.user?.id}&permissions=8&scope=bot%20applications.commands`);
    const btnSupport = new ButtonBuilder().setLabel('Support Server').setStyle(ButtonStyle.Link).setURL('https://discord.gg/rageoptimiser');
    const btnWebsite = new ButtonBuilder().setLabel('Website').setStyle(ButtonStyle.Link).setURL('https://rageoptimiser.com');

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(btnDashboard, btnInvite, btnSupport, btnWebsite);

    return message.reply({ embeds: [embed], components: [row1, row2] });
  }

  public static async sendModuleHelp(message: Message, category: string, prefix: string, page = 1): Promise<any> {
    const commands = PrefixRegistry.getCommandsByCategory(category);
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(commands.length / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);

    const pageCmds = commands.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const cmdList = pageCmds.map(c => `🔹 **\`${prefix}${c.name}\`** — ${c.description}`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`📁 Module Overview: ${category}`)
      .setDescription(`Here are the available commands in **${category}**:\n\n${cmdList || 'No commands registered in this module yet.'}`)
      .setColor('#7c5cfc')
      .setFooter({ text: `Page ${currentPage} of ${totalPages} • Use ${prefix}help <command> for detailed parameter guide` })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  public static async sendCommandHelp(message: Message, cmd: PrefixCommandMeta, prefix: string): Promise<any> {
    const embed = new EmbedBuilder()
      .setTitle(`📖 Command Manual: ${prefix}${cmd.name}`)
      .setDescription(`*${cmd.description}*`)
      .addFields(
        { name: '🏷️ Command', value: `\`${cmd.name}\``, inline: true },
        { name: '📁 Category', value: `\`${cmd.category}\``, inline: true },
        { name: '⏱️ Cooldown', value: `\`${cmd.cooldownSeconds || 3}s\``, inline: true },
        { name: '📝 Syntax & Usage', value: `\`\`\`bash\n${cmd.usage}\n\`\`\``, inline: false },
        { name: '🔀 Aliases', value: cmd.aliases.length > 0 ? cmd.aliases.map(a => `\`${a}\``).join(', ') : '`None`', inline: true },
        { name: '🔒 User Required Permission', value: cmd.userPermissions && cmd.userPermissions.length > 0 ? cmd.userPermissions.map(p => `\`${p}\``).join(', ') : '`Everyone`', inline: true },
        { name: '🤖 Bot Required Permission', value: cmd.botPermissions && cmd.botPermissions.length > 0 ? cmd.botPermissions.map(p => `\`${p}\``).join(', ') : '`SendMessages`', inline: true },
        { name: '💡 Practical Examples', value: cmd.examples.map(e => `\`${e}\``).join('\n') || '`None`', inline: false }
      )
      .setColor('#7c5cfc')
      .setFooter({ text: 'Rage Optimiser • Enterprise Documentation Engine' })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  public static async handleSelectMenuInteraction(interaction: any): Promise<any> {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'help_category_select') return;

    const val = interaction.values[0]; // e.g. "help_cat_moderation"
    const catNameLower = val.replace('help_cat_', '');

    const categories = PrefixRegistry.getCategories();
    const matchedCategory = categories.find(c => c.toLowerCase() === catNameLower);

    if (!matchedCategory) {
      return interaction.reply({ content: '❌ Selected module not found.', flags: 64 });
    }

    const prefix = PrefixResolver.getPrefix(interaction.guildId || undefined);
    const commands = PrefixRegistry.getCommandsByCategory(matchedCategory);

    const cmdList = commands.slice(0, 15).map(c => `🔹 **\`${prefix}${c.name}\`** — ${c.description}`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`📁 Module Overview: ${matchedCategory}`)
      .setDescription(`Here are the available commands in **${matchedCategory}**:\n\n${cmdList || 'No commands registered in this module yet.'}`)
      .setColor('#7c5cfc')
      .setFooter({ text: `Total Commands: ${commands.length} • Use ${prefix}help <command> for detailed parameter guide` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: 64 });
  }
}

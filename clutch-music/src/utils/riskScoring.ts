import { Guild } from 'discord.js';

export function calculateRiskScore(guild: Guild): { riskScore: number, riskLevel: 'Safe' | 'Medium' | 'High' | 'Critical' } {
  let score = 0;

  // Server Age (0-20 points)
  const ageDays = (Date.now() - guild.createdTimestamp) / (1000 * 60 * 60 * 24);
  if (ageDays < 7) score += 20;
  else if (ageDays < 30) score += 10;
  else if (ageDays < 90) score += 5;

  // Member Count (0-15 points)
  if (guild.memberCount < 10) score += 15;
  else if (guild.memberCount < 50) score += 5;

  // Verification Level (0-15 points)
  // NONE = 0, LOW = 1, MEDIUM = 2, HIGH = 3, VERY_HIGH = 4
  const vLevel = guild.verificationLevel;
  if (vLevel === 0) score += 15;
  else if (vLevel === 1) score += 10;
  else if (vLevel === 2) score += 5;

  // Administrator Count (0-20 points)
  // Approximated by roles (if we fetch them, but we'll check later). For now, assume baseline 5.
  
  // Bot Ratio (0-30 points)
  // Cannot perfectly calculate without fetching all members, but we'll use an estimate based on presence or cache if available.
  // We'll leave the bot ratio check for the main guildCreate event which fetches members.
  
  // Base normalization
  if (score > 100) score = 100;

  let riskLevel: 'Safe' | 'Medium' | 'High' | 'Critical' = 'Safe';
  if (score >= 75) riskLevel = 'Critical';
  else if (score >= 50) riskLevel = 'High';
  else if (score >= 25) riskLevel = 'Medium';

  return { riskScore: score, riskLevel };
}

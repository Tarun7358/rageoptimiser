// User Interface for Discord Users
export interface IUser {
  discordId: string;
  tag: string;
  xp: number;
  balance: number;
  lastDaily: Date | null;
  lastWork: Date | null;
  inventory: string[];
  warnings: Array<{ reason: string; date: Date; by: string }>;
  updatedAt?: Date;
}

// Enterprise Dashboard Admin User
export interface IAdminUser {
  id: string; // Document ID
  username: string;
  passwordHash: string;
  role: 'owner' | 'admin' | 'moderator' | 'viewer';
  lastLogin?: Date;
  failedAttempts: number;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
  totpSecret?: string;
  totpEnabled?: boolean;
  recoveryCodes?: string[];
}

// Guild Settings Interface
export interface IGuild {
  guildId: string;
  name: string;
  prefix: string;
  logChannelId: string | null;
  welcomeChannelId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Audit Logs Interface
export interface IAuditLog {
  guildId: string;
  action: string;
  actorId: string;
  targetId?: string;
  reason?: string;
  metadata?: any;
  createdAt?: Date;
}

// Guild Approval Interface (Owner System)
export interface IGuildApproval {
  guildId: string;
  guildName: string;
  ownerId: string;
  ownerUsername: string;
  ownerAvatar?: string;
  memberCount: number;
  botCount: number;
  humanCount: number;
  verificationLevel: number;
  premiumTier: number;
  premiumSubscriptionCount: number;
  joinedAt: number; // Stored as timestamp
  riskScore: number;
  riskLevel: 'Safe' | 'Medium' | 'High' | 'Critical';
  status: 'Pending' | 'Approved' | 'Rejected' | 'Suspended' | 'Blacklisted';
  approvedBy?: string;
  approvedAt?: number;
  rejectedBy?: string;
  rejectedAt?: number;
  rejectionReason?: string;
  blacklistedBy?: string;
  blacklistedAt?: number;
  notes?: string;
  lastUpdated: number;
}

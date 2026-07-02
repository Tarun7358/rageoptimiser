import bcrypt from 'bcryptjs';
import { Database } from './Database.js';
import { IAdminUser } from '../models/index.js';

export class AuthService {
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_MINUTES = 15;
  private static readonly DEFAULT_ADMIN_USER = 'admin';

  /**
   * Ensure that the default owner account exists.
   */
  public static async provisionDefaultOwner(): Promise<void> {
    const db = Database.getDb();
    if (!db) {
      console.warn('[AuthService] Cannot provision owner - no DB connected.');
      return;
    }

    try {
      const usersRef = db.collection('admin_users');
      const snapshot = await usersRef.where('username', '==', this.DEFAULT_ADMIN_USER).get();

      if (snapshot.empty) {
        console.log('[AuthService] No admin user found. Provisioning default owner account.');
        const rawPassword = process.env.DASHBOARD_PASSWORD || 'clutchnation123';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(rawPassword, salt);

        const newUser: Omit<IAdminUser, 'id'> = {
          username: this.DEFAULT_ADMIN_USER,
          passwordHash,
          role: 'owner',
          failedAttempts: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await usersRef.add(newUser);
        console.log('[AuthService] Default owner provisioned successfully.');
      }
    } catch (err) {
      console.error('[AuthService] Error provisioning default owner:', err);
    }
  }

  /**
   * Validate credentials and handle lockouts.
   */
  public static async authenticate(username: string, password: string): Promise<IAdminUser | null> {
    const db = Database.getDb();
    if (!db) throw new Error('Database disconnected');

    const usersRef = db.collection('admin_users');
    const snapshot = await usersRef.where('username', '==', username).limit(1).get();

    if (snapshot.empty) {
      return null; // User not found
    }

    const doc = snapshot.docs[0];
    const user = { id: doc.id, ...doc.data() } as IAdminUser;

    // 1. Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new Error('ACCOUNT_LOCKED');
    }

    // 2. Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      // Increment failed attempts
      let failed = (user.failedAttempts || 0) + 1;
      let updateData: any = { failedAttempts: failed, updatedAt: new Date() };

      if (failed >= this.MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + this.LOCKOUT_MINUTES);
        updateData.lockedUntil = lockUntil;
      }

      await doc.ref.update(updateData);
      return null;
    }

    // 3. Successful login - reset counters
    await doc.ref.update({
      failedAttempts: 0,
      lockedUntil: null,
      lastLogin: new Date(),
      updatedAt: new Date()
    });

    return user;
  }
}

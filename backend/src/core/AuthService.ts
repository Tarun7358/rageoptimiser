import bcrypt from 'bcryptjs';
import { Database } from './Database.js';
import { IAdminUser } from '../models/index.js';

export class AuthService {
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_MINUTES = 15;
  private static readonly DEFAULT_ADMIN_USER = 'admin';

  /**
   * Helper to run a promise with a timeout. Resolves to the fallback value if the timeout expires.
   */
  private static async withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutId = setTimeout(() => {
        console.warn(`[AuthService] Operation timed out after ${ms}ms. Proceeding with fallback.`);
        resolve(fallback);
      }, ms);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      return result;
    } finally {
      if (timeoutId!) clearTimeout(timeoutId);
    }
  }

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
      
      // Wrap the read query with a timeout just in case
      const snapshot = await this.withTimeout(
        usersRef.where('username', '==', this.DEFAULT_ADMIN_USER).get(),
        5000,
        { empty: true, docs: [] } as any
      );

      if (snapshot.empty) {
        console.log('[AuthService] No admin user found. Provisioning default owner account.');
        const rawPassword = process.env.DASHBOARD_PASSWORD || 'rageoptimiser123';
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

        // Wrap the write operation with a 4-second timeout
        console.log('[AuthService] Saving new default owner to database...');
        await this.withTimeout(
          usersRef.add(newUser),
          4000,
          null
        );
        console.log('[AuthService] Default owner provisioning sequence completed.');
      }
    } catch (err) {
      console.error('[AuthService] Error provisioning default owner:', err);
    }
  }

  /**
   * Validate credentials and handle lockouts.
   */
  public static async authenticate(username: string, password: string): Promise<IAdminUser | null> {
    console.log(`[AuthService] Authenticating user: ${username}`);
    const db = Database.getDb();
    if (!db) {
      console.error('[AuthService] Authentication failed: database disconnected');
      throw new Error('Database disconnected');
    }

    console.log('[AuthService] Fetching user doc from Firestore...');
    const usersRef = db.collection('admin_users');
    const snapshot = await this.withTimeout(
      usersRef.where('username', '==', username).limit(1).get(),
      5000,
      { empty: true, docs: [] } as any
    );
    console.log(`[AuthService] User doc query completed. Empty: ${snapshot.empty}`);

    if (snapshot.empty) {
      return null; // User not found
    }

    const doc = snapshot.docs[0];
    const user = { id: doc.id, ...doc.data() } as IAdminUser;
    console.log('[AuthService] User data loaded successfully');

    // 1. Check if account is locked
    if (user.lockedUntil) {
      const lockedUntilDate = user.lockedUntil instanceof Date 
        ? user.lockedUntil 
        : (user.lockedUntil as any).toDate ? (user.lockedUntil as any).toDate() : new Date(user.lockedUntil);
      console.log(`[AuthService] User lockedUntil: ${lockedUntilDate}`);
      if (lockedUntilDate > new Date()) {
        console.error('[AuthService] Account locked');
        throw new Error('ACCOUNT_LOCKED');
      }
    }

    // 2. Verify password
    console.log('[AuthService] Verifying password...');
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    console.log(`[AuthService] Password verification result: ${isMatch}`);

    if (!isMatch) {
      // Increment failed attempts
      let failed = (user.failedAttempts || 0) + 1;
      let updateData: any = { failedAttempts: failed, updatedAt: new Date() };

      if (failed >= this.MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + this.LOCKOUT_MINUTES);
        updateData.lockedUntil = lockUntil;
      }

      console.log('[AuthService] Updating failed attempts with timeout...');
      await this.withTimeout(
        doc.ref.update(updateData),
        3000,
        null
      );
      console.log('[AuthService] Failed attempts update completed.');
      return null;
    }

    // 3. Successful login - reset counters
    console.log('[AuthService] Login successful. Resetting failed attempts with timeout...');
    await this.withTimeout(
      doc.ref.update({
        failedAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date(),
        updatedAt: new Date()
      }),
      3000,
      null
    );
    console.log('[AuthService] User login records updated.');

    return user;
  }
}

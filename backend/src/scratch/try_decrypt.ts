import crypto from 'crypto';

const encryptedText = '368e954c6221718653fb1c41:7e94b01186509c9cc37b9761ebfa60d9d27fcadf8df57a39254a9fdddd39f7f9:b92e1142dfda2d4c826c78854ff4fa0e';

function tryDecrypt(keyStr: string) {
  try {
    const key = crypto.createHash('sha256').update(String(keyStr)).digest();
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    console.log(`Success with key "${keyStr}":`, decrypted);
    return true;
  } catch (err: any) {
    console.log(`Failed with key "${keyStr}":`, err.message);
    return false;
  }
}

tryDecrypt('clutchnation_super_secret_jwt_key_2025');
tryDecrypt('fallback_secret');
tryDecrypt('');

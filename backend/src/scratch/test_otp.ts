import { generateSecret, verify, generate } from 'otplib';

async function test() {
  const secret = generateSecret();
  const token = await generate({ secret });
  const numericToken = parseInt(token);
  console.log('Numeric token:', numericToken);

  try {
    const stringToken = String(numericToken).trim();
    const result = await verify({ token: stringToken, secret });
    console.log('Result for casted string token:', result);
  } catch (err: any) {
    console.error('Error for casted string token:', err.message);
  }
}

test().catch(console.error);

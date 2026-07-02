import * as otplib from 'otplib';

console.log('otplib keys:', Object.keys(otplib));
if ((otplib as any).default) {
  console.log('default keys:', Object.keys((otplib as any).default));
}

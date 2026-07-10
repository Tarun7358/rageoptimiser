import { calculateLoudness } from './utils.js';

describe('Voice Protection Utils - calculateLoudness', () => {
  it('should return 0 loudness for empty buffer', () => {
    const buffer = Buffer.alloc(0);
    const result = calculateLoudness(buffer);
    expect(result.rms).toBe(0);
    expect(result.peak).toBe(0);
  });

  it('should calculate correct loudness for silent buffer', () => {
    const buffer = Buffer.alloc(1000); // filled with 0s
    const result = calculateLoudness(buffer);
    expect(result.rms).toBe(0);
    expect(result.peak).toBe(0);
  });

  it('should calculate correct loudness for a simple square wave buffer', () => {
    // Generate a simple buffer alternating between max positive (32767) and max negative (-32768) values
    const buffer = Buffer.alloc(1000);
    for (let i = 0; i < buffer.length; i += 2) {
      // Alternate values
      const val = (i / 2) % 2 === 0 ? 32767 : -32768;
      buffer.writeInt16LE(val, i);
    }
    const result = calculateLoudness(buffer);
    expect(result.rms).toBeGreaterThan(95); // Should be very close to 100%
    expect(result.peak).toBe(100);
  });
});

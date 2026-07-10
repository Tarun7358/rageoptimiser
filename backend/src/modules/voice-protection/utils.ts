export function calculateLoudness(pcmBuffer: Buffer): { rms: number; peak: number } {
  if (!pcmBuffer || pcmBuffer.length < 2) {
    return { rms: 0, peak: 0 };
  }

  let sumSquares = 0;
  let maxPeak = 0;
  const sampleCount = Math.floor(pcmBuffer.length / 2);

  for (let i = 0; i < sampleCount * 2; i += 2) {
    const val = pcmBuffer.readInt16LE(i);
    const normalized = val / 32768; // Scale to -1.0 to 1.0
    sumSquares += normalized * normalized;
    const absVal = Math.abs(normalized);
    if (absVal > maxPeak) {
      maxPeak = absVal;
    }
  }

  const rms = Math.sqrt(sumSquares / sampleCount);

  // Map 0.0-1.0 to 0-100 scale
  const rmsScale = Math.min(Math.round(rms * 100), 100);
  const peakScale = Math.min(Math.round(maxPeak * 100), 100);

  return { rms: rmsScale, peak: peakScale };
}

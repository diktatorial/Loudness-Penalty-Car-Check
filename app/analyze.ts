// analyze.ts
import { LUFSCalculator } from './LUFSCalculator';

export async function analyzeAudio(
  audioBuffer: AudioBuffer
): Promise<{
  lufs: number;
  penalties: Record<string, number>;
}> {
  if (typeof window === 'undefined') {
    throw new Error('analyzeAudio can only be used in the browser.');
  }

  // Dynamically import the ebur128-wasm module
  const ebur128Wasm = await import('ebur128-wasm');

  try {
    const sampleRate = audioBuffer.sampleRate;
    const lufsCalculator = new LUFSCalculator(sampleRate, ebur128Wasm);
    const lufs = await lufsCalculator.calculateIntegratedLUFS(audioBuffer);
    const penalties = lufsCalculator.calculateLUFSPenalty(lufs);

    return { lufs, penalties };
  } catch (error) {
    throw error;
  }
}

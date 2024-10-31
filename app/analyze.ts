// analyze.ts
import { LUFSCalculator } from './LUFSCalculator';

export async function analyzeAudio(
  audioBuffer: AudioBuffer,
  wasmModule: any
): Promise<{
  lufs: number;
  penalties: Record<string, number>;
}> {
  if (typeof window === 'undefined') {
    throw new Error('analyzeAudio can only be used in the browser.');
  }

  try {
    const sampleRate = audioBuffer.sampleRate;
    const lufsCalculator = new LUFSCalculator(sampleRate, wasmModule);
    const lufs = await lufsCalculator.calculateIntegratedLUFS(audioBuffer);
    const penalties = lufsCalculator.calculateLUFSPenalty(lufs);

    return { lufs, penalties };
  } catch (error) {
    console.error('Error analyzing audio:', error);
    throw error;
  }
}

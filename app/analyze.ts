// LUFSCalculator.ts
// Import the functions and the initialization method
import initEbur128Wasm, {
  ebur128_integrated_mono,
  ebur128_integrated_stereo,
} from 'ebur128-wasm';


// LUFSCalculator.ts

class LUFSCalculator {
  private sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  async calculateIntegratedLUFS(audioBuffer: AudioBuffer): Promise<number> {
    const numChannels = audioBuffer.numberOfChannels;

    // Extract channel data
    const channelData: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      const data = audioBuffer.getChannelData(ch);
      channelData.push(data);
    }

    // Perform LUFS calculation using ebur128-wasm
    let lufs: number;

    if (numChannels === 1) {
      // Mono audio
      lufs = ebur128_integrated_mono(this.sampleRate, channelData[0]);
    } else if (numChannels === 2) {
      // Stereo audio
      lufs = ebur128_integrated_stereo(
        this.sampleRate,
        channelData[0],
        channelData[1]
      );
    } else {
      // For multi-channel audio beyond stereo, you might need to mix down to stereo or handle accordingly
      // Here, we'll mix down to mono for simplicity
      const length = channelData[0].length;
      const mixedData = new Float32Array(length);

      for (let i = 0; i < length; i++) {
        let sum = 0;
        for (let ch = 0; ch < numChannels; ch++) {
          sum += channelData[ch][i];
        }
        mixedData[i] = sum / numChannels;
      }

      lufs = ebur128_integrated_mono(this.sampleRate, mixedData);
    }

    return lufs;
  }

  calculateLUFSPenalty(integratedLUFS: number): Record<string, number> {
    const platformStandards = {
      Spotify: -14,
      YouTube: -14,
      AppleMusic: -16,
      Tidal: -14,
      AmazonMusic: -14,
      Deezer: -15,
    };

    return Object.entries(platformStandards).reduce(
      (penalties: Record<string, number>, [platform, standard]) => {
        penalties[platform] = standard - integratedLUFS;
        return penalties;
      },
      {}
    );
  }
}
// analyzeAudio.ts

export async function analyzeAudio(
  file: File
): Promise<{
  lufs: number;
  penalties: Record<string, number>;
  audioBuffer: AudioBuffer;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const sampleRate = audioBuffer.sampleRate;
        const lufsCalculator = new LUFSCalculator(sampleRate);
        const lufs = await lufsCalculator.calculateIntegratedLUFS(audioBuffer);
        const penalties = lufsCalculator.calculateLUFSPenalty(lufs);

        resolve({ lufs, penalties, audioBuffer });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error: ProgressEvent<FileReader>) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}
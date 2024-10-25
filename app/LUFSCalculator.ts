// LUFSCalculator.ts

import * as ebur128Wasm from 'ebur128-wasm';

export class LUFSCalculator {
    private sampleRate: number;
  
    constructor(sampleRate: number) {
      this.sampleRate = sampleRate;
    }
  
    async calculateIntegratedLUFS(audioBuffer: AudioBuffer): Promise<number> {
      if (typeof window === 'undefined') {
        throw new Error('LUFS calculation can only be performed in the browser.');
      }
  
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
        lufs = ebur128Wasm.ebur128_integrated_mono(this.sampleRate, channelData[0]);
      } else if (numChannels === 2) {
        // Stereo audio
        lufs = ebur128Wasm.ebur128_integrated_stereo(
          this.sampleRate,
          channelData[0],
          channelData[1]
        );
      } else {
        // For multi-channel audio, mix down to mono
        const length = channelData[0].length;
        const mixedData = new Float32Array(length);
  
        for (let i = 0; i < length; i++) {
          let sum = 0;
          for (let ch = 0; ch < numChannels; ch++) {
            sum += channelData[ch][i];
          }
          mixedData[i] = sum / numChannels;
        }
  
        lufs = ebur128Wasm.ebur128_integrated_mono(this.sampleRate, mixedData);
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

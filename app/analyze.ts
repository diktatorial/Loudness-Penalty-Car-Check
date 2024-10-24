import { useState, useEffect } from 'react';

class KWeightingFilter {
    private sampleRate: number;
    private highShelf: { b0: number; b1: number; b2: number; a1: number; a2: number };
    private highPass: { b0: number; b1: number; b2: number; a1: number; a2: number };

    constructor(sampleRate: number) {
      this.sampleRate = sampleRate;
      this.highShelf = this.createHighShelfFilter();
      this.highPass = this.createHighPassFilter();
    }
  
    private createHighShelfFilter() {
      const f0 = 1681.974450955533;
      const G = 3.999843853973347;
      const Q = 0.7071752369554196;
  
      const K = Math.tan((Math.PI * f0) / this.sampleRate);
      const Vh = Math.pow(10, G / 20);
      const Vb = Math.pow(Vh, 0.4996667741545416);
  
      const a0 = 1 + K / Q + K * K;
      const a1 = 2 * (K * K - 1) / a0;
      const a2 = (1 - K / Q + K * K) / a0;
      const b0 = (Vh + Vb * K / Q + K * K) / a0;
      const b1 = 2 * (K * K - Vh) / a0;
      const b2 = (Vh - Vb * K / Q + K * K) / a0;
  
      return { b0, b1, b2, a1, a2 };
    }
  
    private createHighPassFilter() {
      const f0 = 38.13547087602444;
      const Q = 0.5003270373238773;
  
      const K = Math.tan((Math.PI * f0) / this.sampleRate);
  
      const a0 = 1 + K / Q + K * K;
      const a1 = 2 * (K * K - 1) / a0;
      const a2 = (1 - K / Q + K * K) / a0;
      const b0 = 1 / a0;
      const b1 = -2 / a0;
      const b2 = 1 / a0;
  
      return { b0, b1, b2, a1, a2 };
    }

    process(input: Float32Array): Float32Array {
      let output = new Float32Array(input.length);
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      let x1hp = 0, x2hp = 0, y1hp = 0, y2hp = 0;

      for (let i = 0; i < input.length; i++) {
        // High Shelf
        let y = this.highShelf.b0 * input[i] + this.highShelf.b1 * x1 + this.highShelf.b2 * x2
                 - this.highShelf.a1 * y1 - this.highShelf.a2 * y2;
        x2 = x1;
        x1 = input[i];
        y2 = y1;
        y1 = y;

        // High Pass
        let yhp = this.highPass.b0 * y + this.highPass.b1 * x1hp + this.highPass.b2 * x2hp
                   - this.highPass.a1 * y1hp - this.highPass.a2 * y2hp;
        x2hp = x1hp;
        x1hp = y;
        y2hp = y1hp;
        y1hp = yhp;

        output[i] = yhp;
      }

      return output;
    }
}

class LUFSCalculator {
  private audioContext: AudioContext;
  private kWeightingFilter: KWeightingFilter;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.kWeightingFilter = new KWeightingFilter(this.audioContext.sampleRate);
  }

  async calculateIntegratedLUFS(audioBuffer: AudioBuffer): Promise<number> {
    const channelData = audioBuffer.getChannelData(0); // Assuming mono for simplicity
    const blockSize = Math.floor(this.audioContext.sampleRate * 0.4); // 400ms blocks
    const numBlocks = Math.floor(channelData.length / blockSize);

    let momentaryLoudness: number[] = [];
    let absoluteThreshold = -70; // LUFS
    let relativeThreshold: number;

    for (let i = 0; i < numBlocks; i++) {
      const start = i * blockSize;
      const end = start + blockSize;
      const block = channelData.slice(start, end);
      
      const kWeighted = this.kWeightingFilter.process(block);
      const meanSquare = kWeighted.reduce((acc, val) => acc + val * val, 0) / kWeighted.length;
      const blockLoudness = -0.691 + 10 * Math.log10(meanSquare);
      
      momentaryLoudness.push(blockLoudness);
    }

    const gatedLoudness = this.calculateGatedLoudness(momentaryLoudness, absoluteThreshold);
    relativeThreshold = gatedLoudness - 10;
    const integratedLUFS = this.calculateGatedLoudness(momentaryLoudness, relativeThreshold);

    return integratedLUFS;
  }

  private calculateGatedLoudness(loudnessValues: number[], threshold: number): number {
    const gatedValues = loudnessValues.filter(value => value > threshold);
    if (gatedValues.length === 0) return -Infinity;
    return 10 * Math.log10(gatedValues.reduce((acc, val) => Math.pow(10, val / 10) + acc, 0) / gatedValues.length);
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

    return Object.entries(platformStandards).reduce((penalties: Record<string, number>, [platform, standard]) => {
      penalties[platform] = standard - integratedLUFS;
      return penalties;
    }, {});
  }
}

export async function analyzeAudio(file: File): Promise<{ lufs: number; penalties: Record<string, number>; audioBuffer: AudioBuffer }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const lufsCalculator = new LUFSCalculator();
        const lufs = await lufsCalculator.calculateIntegratedLUFS(audioBuffer);
        const penalties = lufsCalculator.calculateLUFSPenalty(lufs);
        
        // Return the calculated LUFS, penalties, and the decoded audioBuffer
        resolve({ lufs, penalties, audioBuffer });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error: ProgressEvent<FileReader>) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}


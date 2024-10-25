// ebur128-wasm.d.ts

declare module 'ebur128-wasm' {
  export function ebur128_integrated_mono(sample_rate: number, samples: Float32Array): number;
  export function ebur128_integrated_stereo(sample_rate: number, left: Float32Array, right: Float32Array): number;
  export function ebur128_true_peak_mono(sample_rate: number, samples: Float32Array): number;
  export function ebur128_true_peak_stereo(sample_rate: number, left: Float32Array, right: Float32Array): number;
}

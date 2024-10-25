import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Enable WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Add rule for WebAssembly files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // Optionally, if you're using Next.js 13 with app directory:
    config.output = {
      ...config.output,
      webassemblyModuleFilename: 'static/wasm/[modulehash].wasm',
    };

    return config;
  },
};

export default nextConfig;

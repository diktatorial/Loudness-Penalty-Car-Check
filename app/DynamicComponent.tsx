'use client';

import React, { useState, useEffect } from 'react';
import { analyzeAudio } from './analyze';

// Move the code that uses WebAssembly here

export default function DynamicAnalyzer() {
  const [results, setResults] = useState<{
    lufs: number;
    penalties: Record<string, number>;
  } | null>(null);

  // This function should be called when a file is selected and ready for analysis
  const handleAnalysis = async (audioBuffer: AudioBuffer) => {
    try {
      const analysisResults = await analyzeAudio(audioBuffer);
      setResults(analysisResults);
    } catch (error) {
      console.error("Error during audio analysis:", error);
      // Handle the error appropriately (e.g., show an error message to the user)
    }
  };

  // Render the analysis results
  if (results) {
    return (
      <div>
        <h2>Analysis Results</h2>
        <p>LUFS: {results.lufs.toFixed(2)}</p>
        <h3>Penalties:</h3>
        <ul>
          {Object.entries(results.penalties).map(([platform, penalty]) => (
            <li key={platform}>{platform}: {penalty.toFixed(2)} dB</li>
          ))}
        </ul>
      </div>
    );
  }

  return null; // Or return a placeholder/loading state if needed
}

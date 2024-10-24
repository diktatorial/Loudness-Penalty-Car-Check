// Analyzer.tsx
"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";
import { analyzeAudio } from "./analyze";

interface AnalyzerProps {
  file: File;
  onAnalyze: (results: { lufs: number; penalties: Record<string, number> }) => void;
}

const Analyzer: React.FC<AnalyzerProps> = ({ file, onAnalyze }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const analysisResults = await analyzeAudio(file);
      onAnalyze(analysisResults);
    } catch (error) {
      console.error("Error analyzing audio:", error);
      alert("An error occurred while analyzing the audio.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex items-center justify-center gap-4">
      <Button onClick={handleAnalyze} disabled={isAnalyzing}>
        {isAnalyzing ? "Analyzing..." : "Analyze"}
      </Button>
    </div>
  );
};

export default Analyzer;

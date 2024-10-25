// PlaybackControls.tsx
"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";

interface PlaybackControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  disabled?: boolean;
}

const PlaybackControls: React.FC<PlaybackControlsProps> = ({ isPlaying, onPlayPause, disabled }) => {
  return (
    <Button onClick={onPlayPause} aria-label={isPlaying ? "Pause Audio" : "Play Audio"} disabled={disabled}>
      {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
    </Button>
  );
};

export default PlaybackControls;

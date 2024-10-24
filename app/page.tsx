// Component.tsx
"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Volume2, Play, Pause } from "lucide-react";
import FileUploader from "./FileUploader";
import Analyzer from "./Analyzer";
import PlaybackControls from "./PlaybackControls";
import DeviceSelector from "./DeviceSelector";

// Define a type for the device keys
type DeviceType = keyof typeof gainValues;

// Equalizer settings for specific devices
const gainValues = {
  car: { bass: 6, mid: 0, treble: -3 }, // Car sound system
  iphone: { bass: 2, mid: 1, treble: 3 }, // iPhone
  macbook: { bass: -1, mid: 2, treble: 4 }, // MacBook
  headphones: { bass: 3, mid: 2, treble: 3 }, // Standard headphones
  tv: { bass: 4, mid: -1, treble: 2 }, // TV speakers
  homeTheater: { bass: 5, mid: 0, treble: 4 }, // Home theater system
  bluetoothSpeaker: { bass: 4, mid: 1, treble: 2 }, // Bluetooth speaker
  studioMonitors: { bass: 0, mid: 0, treble: 0 }, // Flat response, studio monitors
  gamingHeadset: { bass: 5, mid: 1, treble: 2 }, // Gaming headset
  tablet: { bass: 1, mid: 2, treble: 3 }, // Tablet speakers
} as const;

// Extend AudioBufferSourceNode to include startTime
type AudioBufferSourceNodeWithStartTime = AudioBufferSourceNode & { startTime?: number };

export default function Component() {
  // State Variables
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<{
    lufs: number;
    penalties: Record<string, number>;
  } | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlatform, setCurrentPlatform] = useState<string | null>(null);
  const [currentDevice, setCurrentDevice] = useState<DeviceType | null>(null);
  const [volume, setVolume] = useState(1); // Volume state
  const [isLoading, setIsLoading] = useState(false); // Loading state

  // Refs for Audio Management
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNodeWithStartTime | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const platformGainNodeRef = useRef<GainNode | null>(null);
  const masterGainNodeRef = useRef<GainNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const midFilterRef = useRef<BiquadFilterNode | null>(null);
  const trebleFilterRef = useRef<BiquadFilterNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pauseTimeRef = useRef<number>(0); // Time when paused

  // State for current playback time and duration
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Handle File Selection
  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setAudioUrl(URL.createObjectURL(selectedFile));
    setResults(null);
    setCurrentPlatform(null);
    setCurrentDevice(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    pauseTimeRef.current = 0;
    // Reset audio buffers
    audioBufferRef.current = null;
  };

  // Handle Analysis Results
  const handleAnalyze = async (analysisResults: {
    lufs: number;
    penalties: Record<string, number>;
  }) => {
    setResults(analysisResults);
    // Load and decode the audio here to ensure it's ready before playback
    if (audioUrl) {
      setIsLoading(true);
      await setupAudio();
      setIsLoading(false);
    }
  };

  // Initialize Audio Context and Buffer
  const setupAudio = async () => {
    if (!window.AudioContext && !(window as any).webkitAudioContext) {
      alert("Web Audio API is not supported in this browser.");
      return false;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
    const audioContext = audioContextRef.current;

    if (!audioBufferRef.current && audioUrl) {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        audioBufferRef.current = await audioContext.decodeAudioData(arrayBuffer);
        setDuration(audioBufferRef.current.duration);
      } catch (error) {
        console.error("Error decoding audio data:", error);
        alert("Failed to decode audio data.");
      }
    }
    return true;
  };

  // Apply Equalizer Settings
  const applyEqualizer = (settings: { bass: number; mid: number; treble: number }) => {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    // Initialize filters if they don't exist
    if (!bassFilterRef.current) {
      bassFilterRef.current = audioContext.createBiquadFilter();
      bassFilterRef.current.type = "lowshelf";
      bassFilterRef.current.frequency.setValueAtTime(100, audioContext.currentTime);
      bassFilterRef.current.gain.setValueAtTime(settings.bass, audioContext.currentTime);
    } else {
      bassFilterRef.current.gain.setValueAtTime(settings.bass, audioContext.currentTime);
    }

    if (!midFilterRef.current) {
      midFilterRef.current = audioContext.createBiquadFilter();
      midFilterRef.current.type = "peaking";
      midFilterRef.current.frequency.setValueAtTime(1000, audioContext.currentTime);
      midFilterRef.current.gain.setValueAtTime(settings.mid, audioContext.currentTime);
    } else {
      midFilterRef.current.gain.setValueAtTime(settings.mid, audioContext.currentTime);
    }

    if (!trebleFilterRef.current) {
      trebleFilterRef.current = audioContext.createBiquadFilter();
      trebleFilterRef.current.type = "highshelf";
      trebleFilterRef.current.frequency.setValueAtTime(3000, audioContext.currentTime);
      trebleFilterRef.current.gain.setValueAtTime(settings.treble, audioContext.currentTime);
    } else {
      trebleFilterRef.current.gain.setValueAtTime(settings.treble, audioContext.currentTime);
    }

    // EQ nodes are connected in setupGainNodes; no need to reconnect here
  };

  // Setup Gain Nodes and Connect the Audio Graph
  const setupGainNodes = () => {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    // Platform Gain Node
    if (!platformGainNodeRef.current) {
      platformGainNodeRef.current = audioContext.createGain();
    }
    platformGainNodeRef.current.gain.setValueAtTime(1, audioContext.currentTime); // default

    // Master Gain Node
    if (!masterGainNodeRef.current) {
      masterGainNodeRef.current = audioContext.createGain();
    }
    masterGainNodeRef.current.gain.setValueAtTime(volume, audioContext.currentTime);

    // EQ Nodes
    if (!bassFilterRef.current) {
      bassFilterRef.current = audioContext.createBiquadFilter();
      bassFilterRef.current.type = "lowshelf";
      bassFilterRef.current.frequency.setValueAtTime(100, audioContext.currentTime);
    }

    if (!midFilterRef.current) {
      midFilterRef.current = audioContext.createBiquadFilter();
      midFilterRef.current.type = "peaking";
      midFilterRef.current.frequency.setValueAtTime(1000, audioContext.currentTime);
    }

    if (!trebleFilterRef.current) {
      trebleFilterRef.current = audioContext.createBiquadFilter();
      trebleFilterRef.current.type = "highshelf";
      trebleFilterRef.current.frequency.setValueAtTime(3000, audioContext.currentTime);
    }

    // Connect nodes: platformGain -> bassFilter -> midFilter -> trebleFilter -> masterGain -> destination
    platformGainNodeRef.current.disconnect();
    bassFilterRef.current.disconnect();
    midFilterRef.current.disconnect();
    trebleFilterRef.current.disconnect();
    masterGainNodeRef.current.disconnect();

    platformGainNodeRef.current.connect(bassFilterRef.current);
    bassFilterRef.current.connect(midFilterRef.current);
    midFilterRef.current.connect(trebleFilterRef.current);
    trebleFilterRef.current.connect(masterGainNodeRef.current);
    masterGainNodeRef.current.connect(audioContext.destination);
  };

  // Toggle play/pause for the current platform
  const togglePlayPause = (platform: string, device: DeviceType | null) => {
    if (isPlaying && currentPlatform === platform) {
      pauseAudio();
    } else {
      playAudio(platform, device);
    }
  };

  // Play Audio with Selected Platform and Device
  const playAudio = async (platform: string, device: DeviceType | null) => {
    // Ensure audio is loaded
    if (!audioBufferRef.current) {
      alert("Audio is not loaded yet. Please analyze first.");
      return;
    }

    const audioContext = audioContextRef.current;
    const audioBuffer = audioBufferRef.current;
    if (!audioContext || !audioBuffer) return;

    // Resume AudioContext if it's suspended (required for some browsers)
    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
      } catch (error) {
        console.error("Error resuming AudioContext:", error);
        return;
      }
    }

    // If already playing, stop current audio
    if (isPlaying) {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      }
      setIsPlaying(false);
    }

    // Create a new source node
    const sourceNode = audioContext.createBufferSource() as AudioBufferSourceNodeWithStartTime;
    sourceNode.buffer = audioBuffer;
    sourceNodeRef.current = sourceNode;

    // Setup gain nodes and connect audio graph
    setupGainNodes();

    // Apply platform gain
    const penalty = results?.penalties[platform] || 0;
    if (platformGainNodeRef.current) {
      platformGainNodeRef.current.gain.setValueAtTime(
        Math.pow(10, penalty / 20),
        audioContext.currentTime
      );
    }

    // Apply equalizer settings
    const deviceSettings = device
      ? gainValues[device]
      : { bass: 0, mid: 0, treble: 0 };
    applyEqualizer(deviceSettings);

    // Connect source -> platformGainNode
    sourceNode.connect(platformGainNodeRef.current!);

    // Start playback from currentTime
    sourceNode.start(0, currentTime);
    sourceNode.startTime = audioContext.currentTime - currentTime;
    setIsPlaying(true);
    setCurrentPlatform(platform);
    setCurrentDevice(device);
  };

  // Pause Audio
  const pauseAudio = () => {
    const audioContext = audioContextRef.current;
    const sourceNode = sourceNodeRef.current;
    if (audioContext && sourceNode) {
      sourceNode.stop();
      sourceNode.disconnect();
      sourceNodeRef.current = null;
      setIsPlaying(false);
      setCurrentPlatform(null);
      setCurrentDevice(null);

      // Update currentTime based on elapsed time
      const elapsed = audioContext.currentTime - (sourceNode.startTime || 0);
      pauseTimeRef.current = elapsed;
      setCurrentTime(elapsed);
    }
    cancelAnimationFrame(animationFrameRef.current!);
  };

  // Stop Audio
  const stopAudio = () => {
    const audioContext = audioContextRef.current;
    const sourceNode = sourceNodeRef.current;
    if (sourceNode) {
      sourceNode.stop();
      sourceNode.disconnect();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
    setCurrentPlatform(null);
    setCurrentDevice(null);
    setCurrentTime(0);
    pauseTimeRef.current = 0;
    cancelAnimationFrame(animationFrameRef.current!);
  };

  // Handle Device Selection
  const handleDeviceSelect = (device: DeviceType) => {
    setCurrentDevice(device);
    if (isPlaying && currentPlatform) {
      // Adjust equalizer settings without restarting playback
      const deviceSettings = gainValues[device];
      applyEqualizer(deviceSettings);
    }
  };

  // Handle Progress Bar Change (Seek)
  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(event.target.value);
    setCurrentTime(seekTime);
    if (isPlaying && currentPlatform) {
      // Restart playback from new position
      stopAudio();
      playAudio(currentPlatform, currentDevice);
    }
  };

  // Handle Volume Change
  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);
    setVolume(newVolume);
    if (masterGainNodeRef.current) {
      masterGainNodeRef.current.gain.setValueAtTime(
        newVolume,
        audioContextRef.current!.currentTime
      );
    }
  };

  // Cleanup on Component Unmount
  useEffect(() => {
    return () => {
      stopAudio();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Handle Update Playback Time via useEffect
  useEffect(() => {
    if (isPlaying && audioContextRef.current && sourceNodeRef.current?.startTime !== undefined) {
      const updateTime = () => {
        if (
          audioContextRef.current &&
          isPlaying &&
          sourceNodeRef.current?.startTime !== undefined
        ) {
          const elapsed =
            audioContextRef.current.currentTime - (sourceNodeRef.current.startTime || 0);
          setCurrentTime(elapsed);
          if (elapsed >= duration) {
            stopAudio();
            return;
          }
          animationFrameRef.current = requestAnimationFrame(updateTime);
        }
      };
      animationFrameRef.current = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, duration]);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">
            Loudness Penalty Analyzer
          </CardTitle>
          <CardDescription className="text-center text-lg">
            Upload an audio file to analyze its loudness penalty on various platforms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* File Uploader */}
            <FileUploader onFileSelect={handleFileSelect} />

            {/* Analyze Button */}
            {file && <Analyzer file={file} onAnalyze={handleAnalyze} />}

            {/* Display Selected File */}
            {file && (
              <div className="text-center text-muted-foreground">
                Selected file: {file.name}
              </div>
            )}

            {/* Display Analysis Results */}
            {results && (
              <div className="mt-6 space-y-6">
                {/* LUFS Value */}
                <div className="flex items-center justify-center space-x-2 text-xl">
                  <Volume2 className="h-6 w-6" />
                  <span className="font-semibold">
                    Integrated LUFS value: {results.lufs.toFixed(1)} dB
                  </span>
                </div>

                {/* Loudness Penalties */}
                <div className="space-y-4">
                  <h3 className="text-2xl font-semibold text-center">
                    Loudness Penalties
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.entries(results.penalties).map(([platform, penalty]) => (
                      <button
                        key={platform}
                        className={`h-auto py-4 flex flex-col items-center justify-center gap-2 transition-transform duration-200 ease-in-out hover:scale-105 ${
                          currentPlatform === platform
                            ? "bg-primary text-primary-foreground"
                            : "border border-gray-300 text-gray-700"
                        } rounded-md`}
                        onClick={() => togglePlayPause(platform, currentDevice)}
                        aria-pressed={currentPlatform === platform}
                        disabled={isLoading} // Disable button while loading
                      >
                        <span className="text-lg font-semibold">{platform}</span>
                        <span
                          className={`text-sm ${
                            penalty < 0 ? "text-red-500" : "text-green-500"
                          }`}
                        >
                          {penalty > 0 ? "+" : ""}
                          {penalty.toFixed(1)} dB
                        </span>
                        {isPlaying && currentPlatform === platform ? (
                          <Pause
                            className="h-6 w-6 mt-2"
                            aria-label="Pause"
                          />
                        ) : (
                          <Play
                            className="h-6 w-6 mt-2"
                            aria-label="Play"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Playback Controls and Progress */}
                {file && (
                  <div className="space-y-4">
                    {/* Playback Controls */}
                    <div className="flex items-center justify-center gap-4">
                      <PlaybackControls
                        isPlaying={isPlaying}
                        onPlayPause={() => {
                          if (isPlaying && currentPlatform) {
                            pauseAudio();
                          } else if (!isPlaying && currentPlatform) {
                            playAudio(currentPlatform, currentDevice);
                          }
                        }}
                        disabled={isLoading} // Disable controls while loading
                      />
                    </div>

                    {/* Progress Bar */}
                    <div className="flex items-center justify-center space-x-2">
                      <span>{formatTime(currentTime)}</span>
                      <input
                        type="range"
                        min="0"
                        max={duration}
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full"
                        aria-label="Seek"
                        step="0.01"
                      />
                      <span>{formatTime(duration)}</span>
                    </div>

                    {/* Volume Control */}
                    <div className="flex items-center justify-center space-x-2">
                      <span>Volume</span>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-32"
                        aria-label="Volume Control"
                      />
                    </div>
                  </div>
                )}

                {/* Device Selector */}
                {results && (
                  <div className="space-y-4">
                    <h3 className="text-2xl font-semibold text-center">
                      Simulate Devices
                    </h3>
                    <DeviceSelector
                      devices={Object.keys(gainValues)}
                      currentDevice={currentDevice}
                      onSelectDevice={(device) =>
                        handleDeviceSelect(device as DeviceType)
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center justify-center">
                <span>Loading audio...</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Utility function to format time in mm:ss
const formatTime = (time: number): string => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const paddedSeconds = seconds < 10 ? `0${seconds}` : seconds;
  return `${minutes}:${paddedSeconds}`;
};

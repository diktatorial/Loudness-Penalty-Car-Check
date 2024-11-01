"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, Play, Pause } from "lucide-react";
import FileUploader from "./FileUploader";
import PlaybackControls from "./PlaybackControls";
import DeviceSelector from "./DeviceSelector";
import { analyzeAudio } from "./analyze";

// Define a type for the device keys
type DeviceType = keyof typeof gainValues;

// Define the frequency bands for the equalizer
const frequencyBands = [
  { name: "31Hz", frequency: 31 },
  { name: "62Hz", frequency: 62 },
  { name: "125Hz", frequency: 125 },
  { name: "250Hz", frequency: 250 },
  { name: "500Hz", frequency: 500 },
  { name: "1kHz", frequency: 1000 },
  { name: "2kHz", frequency: 2000 },
  { name: "4kHz", frequency: 4000 },
  { name: "8kHz", frequency: 8000 },
  { name: "16kHz", frequency: 16000 },
];

// Equalizer settings for specific devices (10-band)
const gainValues = {
  car: {
    "31Hz": 5,
    "62Hz": 5,
    "125Hz": 4,
    "250Hz": 3,
    "500Hz": 2,
    "1kHz": 0,
    "2kHz": -1,
    "4kHz": -2,
    "8kHz": -3,
    "16kHz": -4,
  }, // Car sound system
  iphone: {
    "31Hz": 2,
    "62Hz": 2,
    "125Hz": 1,
    "250Hz": 1,
    "500Hz": 0,
    "1kHz": 0,
    "2kHz": 1,
    "4kHz": 2,
    "8kHz": 3,
    "16kHz": 4,
  }, // iPhone
  macbook: {
    "31Hz": -1,
    "62Hz": -1,
    "125Hz": 0,
    "250Hz": 1,
    "500Hz": 2,
    "1kHz": 2,
    "2kHz": 2,
    "4kHz": 3,
    "8kHz": 4,
    "16kHz": 4,
  }, // MacBook
  headphones: {
    "31Hz": 3,
    "62Hz": 3,
    "125Hz": 2,
    "250Hz": 2,
    "500Hz": 1,
    "1kHz": 1,
    "2kHz": 2,
    "4kHz": 2,
    "8kHz": 3,
    "16kHz": 3,
  }, // Standard headphones
  tv: {
    "31Hz": 4,
    "62Hz": 4,
    "125Hz": 3,
    "250Hz": 2,
    "500Hz": 1,
    "1kHz": 0,
    "2kHz": -1,
    "4kHz": -1,
    "8kHz": 0,
    "16kHz": 1,
  }, // TV speakers
  homeTheater: {
    "31Hz": 5,
    "62Hz": 5,
    "125Hz": 4,
    "250Hz": 3,
    "500Hz": 2,
    "1kHz": 2,
    "2kHz": 1,
    "4kHz": 1,
    "8kHz": 2,
    "16kHz": 3,
  }, // Home theater system
  bluetoothSpeaker: {
    "31Hz": 4,
    "62Hz": 4,
    "125Hz": 3,
    "250Hz": 3,
    "500Hz": 2,
    "1kHz": 1,
    "2kHz": 1,
    "4kHz": 2,
    "8kHz": 2,
    "16kHz": 2,
  }, // Bluetooth speaker
  studioMonitors: {
    "31Hz": 0,
    "62Hz": 0,
    "125Hz": 0,
    "250Hz": 0,
    "500Hz": 0,
    "1kHz": 0,
    "2kHz": 0,
    "4kHz": 0,
    "8kHz": 0,
    "16kHz": 0,
  }, // Flat response, studio monitors
  gamingHeadset: {
    "31Hz": 5,
    "62Hz": 5,
    "125Hz": 4,
    "250Hz": 3,
    "500Hz": 2,
    "1kHz": 1,
    "2kHz": 1,
    "4kHz": 2,
    "8kHz": 2,
    "16kHz": 2,
  }, // Gaming headset
  tablet: {
    "31Hz": 1,
    "62Hz": 1,
    "125Hz": 1,
    "250Hz": 2,
    "500Hz": 2,
    "1kHz": 2,
    "2kHz": 3,
    "4kHz": 3,
    "8kHz": 3,
    "16kHz": 3,
  }, // Tablet speakers
} as const;

// Extend AudioBufferSourceNode to include startTime
type AudioBufferSourceNodeWithStartTime = AudioBufferSourceNode & { startTime?: number };

// Define types for the equalizer
type EQSettings = Record<string, number>;

// Add DEFAULT_PLATFORM constant
const DEFAULT_PLATFORM = "original";

export default function DynamicPage() {
  // State Variables
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<{
    lufs: number;
    penalties: Record<string, number>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlatform, setCurrentPlatform] = useState<string | null>(null);
  const [currentDevice, setCurrentDevice] = useState<DeviceType | null>(null);
  const [volume, setVolume] = useState(1);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNodeWithStartTime | null>(null);
  const platformGainNodeRef = useRef<GainNode | null>(null);
  const masterGainNodeRef = useRef<GainNode | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]); // Array for multiple EQ filters
  const animationFrameRef = useRef<number | null>(null);
  const pauseTimeRef = useRef<number>(0); // Time when paused

  // State for current playback time and duration
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // State for manual EQ settings
  const [manualEQ, setManualEQ] = useState<EQSettings>(
    frequencyBands.reduce((acc, band) => {
      acc[band.name] = 0;
      return acc;
    }, {} as EQSettings)
  );

  // Add a new state for the WebAssembly module
  const [wasmModule, setWasmModule] = useState<WebAssembly.Module | null>(null);

  // Load the WebAssembly module when the component mounts
  useEffect(() => {
    const loadWasm = async () => {
      try {
        const wasm = await import('ebur128-wasm');
        setWasmModule(wasm);
      } catch (error) {
        console.error("Failed to load WebAssembly module:", error);
      }
    };
    loadWasm();
  }, []);

  // Handle File Selection
  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setAudioUrl(URL.createObjectURL(selectedFile));
    setResults(null);
    setCurrentPlatform(null);
    setCurrentDevice(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    pauseTimeRef.current = 0;
    audioBufferRef.current = null;

    setIsLoading(true);

    try {
      // Create AudioContext here to ensure it's in a browser context
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const arrayBuffer = await selectedFile.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      // Now, analyze the audioBuffer directly
      if (!wasmModule) {
        throw new Error("WebAssembly module not loaded");
      }
      const { lufs, penalties } = await analyzeAudio(audioBuffer, wasmModule);
      setResults({ 
        lufs, 
        penalties: {
          [DEFAULT_PLATFORM]: 0, // Add original version with no penalty
          ...penalties 
        }
      });

      audioBufferRef.current = audioBuffer;
      setAudioBuffer(audioBuffer);
      setDuration(audioBuffer.duration);

      console.log("Audio analysis and setup completed");
    } catch (error) {
      console.error("Error during file analysis or audio setup:", error);
      alert("An error occurred during analysis or audio setup. Please try a different file.");
    } finally {
      setIsLoading(false);
    }
  };

  // Apply Equalizer Settings
  const applyEqualizer = (settings: EQSettings) => {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    // Initialize or update each filter
    frequencyBands.forEach((band, index) => {
      let filter = eqFiltersRef.current[index];
      if (!filter) {
        filter = audioContext.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.setValueAtTime(band.frequency, audioContext.currentTime);
        filter.Q.setValueAtTime(1, audioContext.currentTime); // Quality factor
        filter.gain.setValueAtTime(settings[band.name], audioContext.currentTime);
        eqFiltersRef.current[index] = filter;
      } else {
        filter.gain.setValueAtTime(settings[band.name], audioContext.currentTime);
      }
    });

    // Remove any extra filters if frequencyBands array shrinks
    if (eqFiltersRef.current.length > frequencyBands.length) {
      eqFiltersRef.current.slice(frequencyBands.length).forEach((filter) => {
        filter.disconnect();
      });
      eqFiltersRef.current = eqFiltersRef.current.slice(0, frequencyBands.length);
    }

    // Connect filters in series if not already connected
    if (eqFiltersRef.current.length > 0) {
      // Disconnect existing connections
      eqFiltersRef.current.forEach((filter) => filter.disconnect());

      // Connect in series: platformGain -> EQ1 -> EQ2 -> ... -> masterGain
      platformGainNodeRef.current?.disconnect();
      platformGainNodeRef.current?.connect(eqFiltersRef.current[0]);

      for (let i = 0; i < eqFiltersRef.current.length - 1; i++) {
        eqFiltersRef.current[i].connect(eqFiltersRef.current[i + 1]);
      }

      eqFiltersRef.current[eqFiltersRef.current.length - 1].connect(masterGainNodeRef.current!);
    }
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

    // Initialize EQ Filters if they haven't been initialized yet
    if (eqFiltersRef.current.length === 0) {
      frequencyBands.forEach((band) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.setValueAtTime(band.frequency, audioContext.currentTime);
        filter.Q.setValueAtTime(1, audioContext.currentTime);
        filter.gain.setValueAtTime(manualEQ[band.name], audioContext.currentTime);
        eqFiltersRef.current.push(filter);
      });
    }

    // Connect nodes: platformGain -> EQ1 -> EQ2 -> ... -> masterGain -> destination
    platformGainNodeRef.current.disconnect();
    eqFiltersRef.current.forEach((filter) => filter.disconnect());
    masterGainNodeRef.current.disconnect();

    platformGainNodeRef.current.connect(eqFiltersRef.current[0]);
    for (let i = 0; i < eqFiltersRef.current.length - 1; i++) {
      eqFiltersRef.current[i].connect(eqFiltersRef.current[i + 1]);
    }
    eqFiltersRef.current[eqFiltersRef.current.length - 1].connect(masterGainNodeRef.current);
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
      console.error("Audio is not loaded yet.");
      alert("Please upload and analyze an audio file first.");
      return;
    }

    const audioContext = audioContextRef.current;
    const audioBuffer = audioBufferRef.current;

    if (!audioContext || !audioBuffer) {
      console.error("AudioContext or AudioBuffer is missing.");
      alert("Audio setup is incomplete. Please try uploading the file again.");
      return;
    }

    // Resume AudioContext if it's suspended (required for some browsers)
    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
      } catch (error) {
        console.error("Error resuming AudioContext:", error);
        alert("Failed to resume audio context.");
        return;
      }
    }

    // Stop current audio if already playing
    if (isPlaying) {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      }
      setIsPlaying(false);
    }

    // Create a new source node for playback
    const sourceNode = audioContext.createBufferSource() as AudioBufferSourceNodeWithStartTime;
    sourceNode.buffer = audioBuffer; // Use the loaded audio buffer
    sourceNodeRef.current = sourceNode;

    // Setup gain nodes and connect the audio graph
    setupGainNodes();

    // Apply platform gain based on loudness penalty
    const penalty = results?.penalties[platform] || 0;
    if (platformGainNodeRef.current) {
      platformGainNodeRef.current.gain.setValueAtTime(
        Math.pow(10, penalty / 20),
        audioContext.currentTime
      );
    }

    // Apply equalizer settings (either device-specific or manual)
    let deviceSettings: EQSettings = {};
    if (device) {
      deviceSettings = gainValues[device];
    } else {
      deviceSettings = manualEQ; // Use manual EQ settings if no device is selected
    }
    applyEqualizer(deviceSettings);

    // Connect source node to the gain node and start playback
    sourceNode.connect(platformGainNodeRef.current!);

    // Start playback from the current time
    sourceNode.start(0, currentTime); // Start from the paused or beginning position
    sourceNode.startTime = audioContext.currentTime - currentTime; // Track time since start

    // Update state for playback
    setIsPlaying(true);
    setCurrentPlatform(platform);
    setCurrentDevice(device);
  };

  const pauseAudio = () => {
    const audioContext = audioContextRef.current;
    const sourceNode = sourceNodeRef.current;

    if (audioContext && sourceNode) {
      sourceNode.stop();
      sourceNode.disconnect();
      sourceNodeRef.current = null;

      const elapsed = audioContext.currentTime - (sourceNode.startTime || 0);
      pauseTimeRef.current = elapsed;
      setCurrentTime(elapsed);
    }

    setIsPlaying(false);
    setCurrentPlatform(null);
    setCurrentDevice(null);
    cancelAnimationFrame(animationFrameRef.current!);
  };

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

  // **Updated Function: Synchronize Manual EQ with Selected Device**
  const handleDeviceSelect = (device: DeviceType | null) => {
    // Allow deselecting current device by clicking again
    setCurrentDevice(currentDevice === device ? null : device);
    
    if (device) {
      setManualEQ(gainValues[device]);
      if (isPlaying && currentPlatform) {
        applyEqualizer(gainValues[device]);
      }
    } else {
      // Reset to default EQ (all zeros)
      const defaultEQ = frequencyBands.reduce((acc, band) => {
        acc[band.name] = 0;
        return acc;
      }, {} as EQSettings);
      setManualEQ(defaultEQ);
      if (isPlaying && currentPlatform) {
        applyEqualizer(defaultEQ);
      }
    }
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(event.target.value);
    setCurrentTime(seekTime);
    if (isPlaying && currentPlatform) {
      stopAudio();
      playAudio(currentPlatform, currentDevice);
    }
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);
    setVolume(newVolume);
    if (masterGainNodeRef.current && audioContextRef.current) {
      masterGainNodeRef.current.gain.setValueAtTime(
        newVolume,
        audioContextRef.current.currentTime
      );
    }
  };

  const handleEQChange = (band: string, gain: number) => {
    setManualEQ((prev) => ({
      ...prev,
      [band]: gain,
    }));

    if (isPlaying && !currentDevice && currentPlatform) {
      applyEqualizer({
        ...manualEQ,
        [band]: gain,
      });
    }
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopAudio();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Handle playback time updates
  useEffect(() => {
    if (isPlaying && audioContextRef.current && sourceNodeRef.current?.startTime !== undefined) {
      const updateTime = () => {
        if (
          audioContextRef.current &&
          isPlaying &&
          sourceNodeRef.current?.startTime !== undefined
        ) {
          const elapsed = audioContextRef.current.currentTime - (sourceNodeRef.current.startTime || 0);
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

  // Utility function to format time in mm:ss
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const paddedSeconds = seconds < 10 ? `0${seconds}` : seconds;
    return `${minutes}:${paddedSeconds}`;
  };

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
            <FileUploader onFileSelect={handleFileSelect} />
          </div>

          {file && (
            <div className="text-center text-muted-foreground">
              Selected file: {file.name}
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center justify-center mt-4">
              <span>Loading audio...</span>
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
                  {Object.entries(results?.penalties || {}).map(([platform, penalty]) => (
                    <Button
                      key={platform}
                      variant={currentPlatform === platform ? "default" : "outline"}
                      className="h-auto py-4 flex flex-col items-center justify-center gap-2 
                        transition-transform duration-200 ease-in-out hover:scale-105"
                      onClick={() => togglePlayPause(platform, currentDevice)}
                      disabled={isLoading}
                    >
                      <span className="text-lg font-semibold">
                        {platform === DEFAULT_PLATFORM ? "Original" : platform}
                      </span>
                      <span className={`text-sm ${penalty < 0 ? "text-red-500" : "text-green-500"}`}>
                        {penalty > 0 ? "+" : ""}
                        {penalty.toFixed(1)} dB
                      </span>
                      {isPlaying && currentPlatform === platform ? (
                        <Pause className="h-6 w-6 mt-2" aria-label="Pause" />
                      ) : (
                        <Play className="h-6 w-6 mt-2" aria-label="Play" />
                      )}
                    </Button>
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
                      handleDeviceSelect(device as DeviceType | null)
                    }
                  />
                </div>
              )}

              {/* Manual Equalizer Controls */}
              {results && (
                <div className="space-y-4">
                  <h3 className="text-2xl font-semibold text-center">
                    Manual Equalizer
                  </h3>
                  <div className="equalizer-container overflow-x-auto">
                    {frequencyBands.map((band) => (
                      <div key={band.name} className="flex flex-col items-center">
                        <span className="mb-2">{band.name}</span>
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          step="0.1"
                          value={manualEQ[band.name]}
                          onChange={(e) => handleEQChange(band.name, parseFloat(e.target.value))}
                          className="equalizer-slider w-20"
                          aria-label={`${band.name} Frequency`}
                        />
                        <span className="text-sm">{manualEQ[band.name]} dB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex items-center justify-center">
                  <span>Loading audio...</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

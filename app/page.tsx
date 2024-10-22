"use client"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Volume2, Play, Pause, Upload } from "lucide-react"
import { analyzeAudio } from "./analyze"

export default function Component() {
  const [file, setFile] = useState<File | null>(null)
  const [results, setResults] = useState<{ lufs: number; penalties: Record<string, number> } | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentPlatform, setCurrentPlatform] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile && selectedFile.type.startsWith("audio/")) {
      setFile(selectedFile)
      setAudioUrl(URL.createObjectURL(selectedFile))
    } else {
      alert("Please select a valid audio file.")
    }
  }

  const handleAnalyze = async () => {
    if (!file) return

    setIsAnalyzing(true)
    try {
      const analysisResults = await analyzeAudio(file)
      setResults(analysisResults)
    } catch (error) {
      console.error("Error analyzing audio:", error)
      alert("An error occurred while analyzing the audio.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const applyLoudnessChange = (audioContext: AudioContext, sourceNode: AudioBufferSourceNode, change: number) => {
    const gainNode = audioContext.createGain()
    gainNode.gain.setValueAtTime(Math.pow(10, change / 20), audioContext.currentTime)
    sourceNode.connect(gainNode)
    gainNode.connect(audioContext.destination)
  }

  const playAudioWithLoudnessChange = async (platform: string) => {
    if (!audioUrl || !results) return

    if (isPlaying && currentPlatform === platform) {
      audioRef.current?.pause()
      setIsPlaying(false)
      setCurrentPlatform(null)
      return
    }

    const penalty = results.penalties[platform]

    if (isPlaying) {
      audioRef.current?.pause()
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const response = await fetch(audioUrl)
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    const sourceNode = audioContext.createBufferSource()
    sourceNode.buffer = audioBuffer

    applyLoudnessChange(audioContext, sourceNode, penalty)

    sourceNode.start()
    setIsPlaying(true)
    setCurrentPlatform(platform)

    sourceNode.onended = () => {
      setIsPlaying(false)
      setCurrentPlatform(null)
    }

    audioRef.current = {
      pause: () => {
        sourceNode.stop()
        setIsPlaying(false)
        setCurrentPlatform(null)
      },
    } as HTMLAudioElement
  }

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Loudness Penalty Analyzer</CardTitle>
          <CardDescription className="text-center text-lg">
            Upload an audio file to analyze its loudness penalty on various platforms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center justify-center gap-4">
              <Label htmlFor="audio-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                  <Upload className="h-5 w-5" />
                  <span>Upload Audio File</span>
                </div>
                <Input id="audio-upload" type="file" accept="audio/*" onChange={handleFileChange} className="hidden" />
              </Label>
              <Button onClick={handleAnalyze} disabled={!file || isAnalyzing}>
                {isAnalyzing ? "Analyzing..." : "Analyze"}
              </Button>
            </div>
            {file && <div className="text-center text-muted-foreground">Selected file: {file.name}</div>}
            {results && (
              <div className="mt-6 space-y-6">
                <div className="flex items-center justify-center space-x-2 text-xl">
                  <Volume2 className="h-6 w-6" />
                  <span className="font-semibold">Integrated LUFS value: {results.lufs} dB</span>
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl font-semibold text-center">Loudness Penalties</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.entries(results.penalties).map(([platform, penalty]) => (
                      <Button
                        key={platform}
                        variant={currentPlatform === platform ? "default" : "outline"}
                        className="h-auto py-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 ease-in-out transform hover:scale-105"
                        onClick={() => playAudioWithLoudnessChange(platform)}
                      >
                        <span className="text-lg font-semibold">{platform}</span>
                        <span className={`text-sm ${penalty < 0 ? "text-red-500" : "text-green-500"}`}>
                          {penalty > 0 ? "+" : ""}
                          {penalty.toFixed(1)} dB
                        </span>
                        {isPlaying && currentPlatform === platform ? (
                          <Pause className="h-6 w-6 mt-2" />
                        ) : (
                          <Play className="h-6 w-6 mt-2" />
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

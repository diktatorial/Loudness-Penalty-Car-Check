// FileUploader.tsx
"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type.startsWith("audio/")) {
      onFileSelect(selectedFile);
    } else {
      alert("Please select a valid audio file.");
    }
  };

  return (
    <Label htmlFor="audio-upload" className="cursor-pointer">
      <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
        <Upload className="h-5 w-5" />
        <span>Upload Audio File</span>
      </div>
      <Input
        id="audio-upload"
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </Label>
  );
};

export default FileUploader;

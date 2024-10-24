// DeviceSelector.tsx
"use client";
import React from "react";
import { Button } from "@/components/ui/button";

interface DeviceSelectorProps {
  devices: string[];
  currentDevice: string | null;
  onSelectDevice: (device: string) => void;
}

const DeviceSelector: React.FC<DeviceSelectorProps> = ({ devices, currentDevice, onSelectDevice }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {devices.map((device) => (
        <Button
          key={device}
          variant={currentDevice === device ? "default" : "outline"}
          className="h-auto py-4 flex flex-col items-center justify-center gap-2 transition-transform duration-200 ease-in-out hover:scale-105"
          onClick={() => onSelectDevice(device)}
        >
          <span className="text-lg font-semibold capitalize">{device}</span>
        </Button>
      ))}
    </div>
  );
};

export default DeviceSelector;

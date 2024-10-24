// MultiBandEqualizer.tsx
import React from "react";

type Band = {
  frequency: number;
  gain: number;
};

type Props = {
  bands: Band[];
  onChange: (bands: Band[]) => void;
};

const MultiBandEqualizer: React.FC<Props> = ({ bands, onChange }) => {
  const handleGainChange = (index: number, value: number) => {
    const updatedBands = [...bands];
    updatedBands[index].gain = value;
    onChange(updatedBands);
  };

  return (
    <div className="flex space-x-2 overflow-x-auto">
      {bands.map((band, index) => (
        <div key={band.frequency} className="flex flex-col items-center">
          <span>{band.frequency} Hz</span>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.1"
            value={band.gain}
            onChange={(e) => handleGainChange(index, parseFloat(e.target.value))}
            className="rotate-90"
          />
          <span>{band.gain} dB</span>
        </div>
      ))}
    </div>
  );
};

export default MultiBandEqualizer;

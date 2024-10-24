import React from "react";

interface Band {
  frequency: number;
  gain: number;
}

interface EQChartProps {
  bands: Band[];
}

const EQChart: React.FC<EQChartProps> = ({ bands }) => {
  return (
    <div style={{ display: "flex", justifyContent: "space-around" }}>
      {bands.map((band) => (
        <div key={band.frequency} style={{ textAlign: "center" }}>
          <div
            style={{
              height: `${band.gain * 10}px`,
              width: "20px",
              backgroundColor: "blue",
              margin: "0 auto",
            }}
          />
          <div>{band.frequency} Hz</div>
        </div>
      ))}
    </div>
  );
};

export default EQChart;
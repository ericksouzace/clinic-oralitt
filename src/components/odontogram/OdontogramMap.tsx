import React from "react";
import { ToothSvg } from "./ToothSvg";
import { OdontogramEntry } from "@/lib/store";

const upperRight = [18, 17, 16, 15, 14, 13, 12, 11];
const upperLeft = [21, 22, 23, 24, 25, 26, 27, 28];
const lowerRight = [48, 47, 46, 45, 44, 43, 42, 41];
const lowerLeft = [31, 32, 33, 34, 35, 36, 37, 38];

interface Props {
  entries: OdontogramEntry[];
  onRegionClick: (toothNumber: string, region: string) => void;
}

export function OdontogramMap({ entries, onRegionClick }: Props) {
  return (
    <div className="flex flex-col items-center gap-8 sm:gap-12 p-4 bg-white rounded-xl border border-border overflow-x-auto w-full">
      {/* Arcada Superior */}
      <div className="flex flex-col items-center">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Arcada Superior</h3>
        <div className="flex gap-2 sm:gap-4 items-center">
          <div className="flex gap-1 sm:gap-2">
            {upperRight.map(num => (
              <ToothSvg key={num} toothNumber={num.toString()} entries={entries} onRegionClick={onRegionClick} />
            ))}
          </div>
          <div className="w-px h-24 sm:h-32 bg-border mx-1 sm:mx-2" />
          <div className="flex gap-1 sm:gap-2">
            {upperLeft.map(num => (
              <ToothSvg key={num} toothNumber={num.toString()} entries={entries} onRegionClick={onRegionClick} />
            ))}
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-border/50 max-w-4xl" />

      {/* Arcada Inferior */}
      <div className="flex flex-col items-center">
        <div className="flex gap-2 sm:gap-4 items-center">
          <div className="flex gap-1 sm:gap-2">
            {lowerRight.map(num => (
              <ToothSvg key={num} toothNumber={num.toString()} entries={entries} onRegionClick={onRegionClick} />
            ))}
          </div>
          <div className="w-px h-24 sm:h-32 bg-border mx-1 sm:mx-2" />
          <div className="flex gap-1 sm:gap-2">
            {lowerLeft.map(num => (
              <ToothSvg key={num} toothNumber={num.toString()} entries={entries} onRegionClick={onRegionClick} />
            ))}
          </div>
        </div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-4">Arcada Inferior</h3>
      </div>
    </div>
  );
}

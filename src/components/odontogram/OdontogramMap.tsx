import React from "react";
import type { OdontogramEntry } from "@/lib/store";
import { ToothSvg } from "./ToothSvg";

const upperRight = [18, 17, 16, 15, 14, 13, 12, 11];
const upperLeft = [21, 22, 23, 24, 25, 26, 27, 28];
const lowerRight = [48, 47, 46, 45, 44, 43, 42, 41];
const lowerLeft = [31, 32, 33, 34, 35, 36, 37, 38];

interface Props {
  entries: OdontogramEntry[];
  onRegionClick: (toothNumber: string, region: string) => void;
}

function ToothRow({
  left,
  right,
  entries,
  onRegionClick,
}: {
  left: number[];
  right: number[];
  entries: OdontogramEntry[];
  onRegionClick: (toothNumber: string, region: string) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_1px_1fr] items-center gap-5 px-6">
      <div className="flex items-center justify-end gap-2.5">
        {left.map((number) => (
          <ToothSvg
            key={number}
            toothNumber={number.toString()}
            entries={entries}
            onRegionClick={onRegionClick}
          />
        ))}
      </div>

      <div className="h-[176px] w-px bg-slate-300" />

      <div className="flex items-center justify-start gap-2.5">
        {right.map((number) => (
          <ToothSvg
            key={number}
            toothNumber={number.toString()}
            entries={entries}
            onRegionClick={onRegionClick}
          />
        ))}
      </div>
    </div>
  );
}

export function OdontogramMap({ entries, onRegionClick }: Props) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-[#e6e1d8] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="min-w-[1180px] px-5 pb-7 pt-5">
        <h3 className="mb-6 text-center text-[15px] font-semibold uppercase tracking-[0.18em] text-slate-800">
          Arcada Superior
        </h3>

        <ToothRow
          left={upperRight}
          right={upperLeft}
          entries={entries}
          onRegionClick={onRegionClick}
        />

        <div className="my-6 h-px w-full bg-slate-300" />

        <ToothRow
          left={lowerRight}
          right={lowerLeft}
          entries={entries}
          onRegionClick={onRegionClick}
        />

        <h3 className="mt-6 text-center text-[15px] font-semibold uppercase tracking-[0.18em] text-slate-800">
          Arcada Inferior
        </h3>
      </div>
    </div>
  );
}

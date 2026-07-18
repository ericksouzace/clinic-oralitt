import React from "react";
import type { OdontogramEntry } from "@/lib/store";
import {
  getSpecialToothMarker,
  isRootOnlyStatus,
  isSpecialMarkerStatus,
  normalizeOdontogramStatus,
} from "./odontogramStatusConfig";

export function getToothType(num: number) {
  const position = num % 10;
  if (position === 1 || position === 2) return "incisor";
  if (position === 3) return "canine";
  if (position === 4 || position === 5) return "premolar";
  return "molar";
}

export function isUpper(num: number) {
  const quadrant = Math.floor(num / 10);
  return quadrant === 1 || quadrant === 2;
}

interface Props {
  toothNumber: string;
  entries: OdontogramEntry[];
  onRegionClick: (toothNumber: string, region: string) => void;
}

const ROOT_PATHS: Record<ReturnType<typeof getToothType>, string> = {
  molar:
    "M14 58 C14 69 15 77 17 87 L20 108 C20.7 113 25.8 113 27 108 L31 84 C31.5 81 33 80 34 84 L38 108 C39 113 44 113 45 108 L48 87 C50 77 50.8 69 50 58 Z",
  premolar:
    "M17 58 C17 70 18 79 20 90 L23 108 C24 113 28 113 29 108 L31 90 C31.5 86 32.5 86 33 90 L35 108 C36 113 40 113 41 108 L44 90 C46 79 47 70 47 58 Z",
  canine:
    "M19 58 C19 70 20 79 22 88 L27 109 C28 114 35 114 36 109 L42 88 C44 79 45 70 45 58 Z",
  incisor:
    "M20 58 C20 69 21 79 23 89 L27 108 C28 113 35 113 36 108 L41 89 C43 79 44 69 44 58 Z",
};

const STROKE = "#1f2937";
const EMPTY_FILL = "#ffffff";

function sortNewestFirst(entries: OdontogramEntry[]) {
  return [...entries].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function latestEntry(entries: OdontogramEntry[], region: string) {
  return sortNewestFirst(
    entries.filter((entry) => entry.toothRegion === region),
  )[0];
}

function latestEntryByStatus(entries: OdontogramEntry[], status: string) {
  const normalizedStatus = normalizeOdontogramStatus(status);

  return sortNewestFirst(
    entries.filter(
      (entry) => normalizeOdontogramStatus(entry.status) === normalizedStatus,
    ),
  )[0];
}

function latestSpecialMarkerEntries(entries: OdontogramEntry[]) {
  const newest = sortNewestFirst(
    entries.filter((entry) => isSpecialMarkerStatus(entry.status)),
  );

  const seen = new Set<string>();

  return newest.filter((entry) => {
    const normalized = normalizeOdontogramStatus(entry.status);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function ToothSvg({ toothNumber, entries, onRegionClick }: Props) {
  const num = Number.parseInt(toothNumber, 10);
  const upper = isUpper(num);
  const type = getToothType(num);

  const toothEntries = (entries || []).filter(
    (entry) => entry.toothNumber === toothNumber,
  );

  const wholeEntry =
    latestEntry(toothEntries, "inteiro") ||
    latestEntry(toothEntries, "dente inteiro");

  const normalizedWholeStatus = wholeEntry?.status
    ? normalizeOdontogramStatus(wholeEntry.status)
    : undefined;

  const isExtracted = normalizedWholeStatus === "extração realizada";
  const isExtractionIndicated = normalizedWholeStatus === "extração indicada";

  const wholeEntryIsVisualMarker = wholeEntry
    ? isSpecialMarkerStatus(wholeEntry.status)
    : false;

  const wholeEntryIsRootOnly = wholeEntry
    ? isRootOnlyStatus(wholeEntry.status)
    : false;

  const wholePaint =
    wholeEntry &&
    !isExtracted &&
    !isExtractionIndicated &&
    !wholeEntryIsVisualMarker &&
    !wholeEntryIsRootOnly
      ? wholeEntry.color
      : undefined;

  const canalEntry = latestEntryByStatus(toothEntries, "canal");

  const markerEntries = latestSpecialMarkerEntries(toothEntries);

  const regionColor = (region: string) => {
    if (wholePaint) return wholePaint;
    return latestEntry(toothEntries, region)?.color || EMPTY_FILL;
  };

  const rootColor =
    canalEntry?.color ||
    wholePaint ||
    latestEntry(toothEntries, "raiz/base")?.color ||
    EMPTY_FILL;

  const crownY = upper ? 78 : 40;
  const rootTransform = upper ? "translate(0 118) scale(1 -1)" : undefined;

  const top = crownY - 22;
  const bottom = crownY + 22;
  const left = 10;
  const right = 54;
  const innerTop = crownY - 8;
  const innerBottom = crownY + 8;
  const innerLeft = 24;
  const innerRight = 40;

  const sectorClass =
    "cursor-pointer transition-[filter,opacity] duration-150 hover:brightness-95 active:opacity-80";

  return (
    <div className="relative flex min-w-[52px] flex-col items-center gap-2 pt-6 select-none">
      {markerEntries.length > 0 && (
        <div
          className="absolute top-0 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap"
          aria-label={`Marcações especiais do dente ${toothNumber}`}
        >
          {markerEntries.map((entry) => {
            const marker = getSpecialToothMarker(entry.status);
            if (!marker) return null;

            return (
              <span
                key={`${entry.id}-${normalizeOdontogramStatus(entry.status)}`}
                className="text-[15px] font-black leading-none tracking-[-0.02em]"
                style={{ color: entry.color || STROKE }}
              >
                {marker}
              </span>
            );
          })}
        </div>
      )}

      {upper && (
        <span className="text-[12px] font-semibold leading-none text-slate-700">
          {toothNumber}
        </span>
      )}

      <svg
        viewBox="0 0 64 118"
        role="img"
        aria-label={`Dente ${toothNumber}`}
        className="h-[112px] w-[62px] overflow-visible"
      >
        <path
          d={ROOT_PATHS[type]}
          transform={rootTransform}
          fill={rootColor}
          stroke={STROKE}
          strokeWidth="1.8"
          strokeLinejoin="round"
          className={sectorClass}
          onClick={() => onRegionClick(toothNumber, "raiz/base")}
        />

        <path
          d={`M32 ${top} A22 22 0 0 0 ${left} ${crownY} L${innerLeft} ${crownY} A8 8 0 0 1 32 ${innerTop} Z`}
          fill={regionColor("superior esquerdo")}
          stroke={STROKE}
          strokeWidth="1.8"
          strokeLinejoin="round"
          className={sectorClass}
          onClick={() => onRegionClick(toothNumber, "superior esquerdo")}
        />

        <path
          d={`M32 ${top} A22 22 0 0 1 ${right} ${crownY} L${innerRight} ${crownY} A8 8 0 0 0 32 ${innerTop} Z`}
          fill={regionColor("superior direito")}
          stroke={STROKE}
          strokeWidth="1.8"
          strokeLinejoin="round"
          className={sectorClass}
          onClick={() => onRegionClick(toothNumber, "superior direito")}
        />

        <path
          d={`M${right} ${crownY} A22 22 0 0 1 32 ${bottom} L32 ${innerBottom} A8 8 0 0 0 ${innerRight} ${crownY} Z`}
          fill={regionColor("inferior direito")}
          stroke={STROKE}
          strokeWidth="1.8"
          strokeLinejoin="round"
          className={sectorClass}
          onClick={() => onRegionClick(toothNumber, "inferior direito")}
        />

        <path
          d={`M32 ${bottom} A22 22 0 0 1 ${left} ${crownY} L${innerLeft} ${crownY} A8 8 0 0 0 32 ${innerBottom} Z`}
          fill={regionColor("inferior esquerdo")}
          stroke={STROKE}
          strokeWidth="1.8"
          strokeLinejoin="round"
          className={sectorClass}
          onClick={() => onRegionClick(toothNumber, "inferior esquerdo")}
        />

        <circle
          cx="32"
          cy={crownY}
          r="8"
          fill={regionColor("centro")}
          stroke={STROKE}
          strokeWidth="1.8"
          className={sectorClass}
          onClick={() => onRegionClick(toothNumber, "centro")}
        />

        {isExtractionIndicated && (
          <line
            x1="8"
            y1="108"
            x2="56"
            y2="10"
            stroke="#991b1b"
            strokeWidth="4"
            strokeLinecap="round"
            className="pointer-events-none"
          />
        )}

        {isExtracted && (
          <g className="pointer-events-none">
            <line
              x1="8"
              y1="10"
              x2="56"
              y2="108"
              stroke="#111827"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <line
              x1="56"
              y1="10"
              x2="8"
              y2="108"
              stroke="#111827"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>

      {!upper && (
        <span className="text-[12px] font-semibold leading-none text-slate-700">
          {toothNumber}
        </span>
      )}
    </div>
  );
}

import React from "react";
import { OdontogramEntry } from "@/lib/store";

export function getToothType(num: number) {
  const n = num % 10;
  if (n === 1 || n === 2) return 'incisor';
  if (n === 3) return 'canine';
  if (n === 4 || n === 5) return 'premolar';
  return 'molar';
}

export function isUpper(num: number) {
  return Math.floor(num / 10) === 1 || Math.floor(num / 10) === 2;
}

interface Props {
  toothNumber: string;
  entries: OdontogramEntry[];
  onRegionClick: (toothNumber: string, region: string) => void;
}

// Larger coordinates for better clicking
const SHAPES = {
  molar: {
    center: "35,25 65,25 65,55 35,55",
    tl: "50,10 25,10 15,25 15,40 35,40 35,25 50,25",
    tr: "50,10 50,25 65,25 65,40 85,40 85,25 75,10",
    bl: "50,55 35,55 35,40 15,40 15,55 25,70 50,70",
    br: "65,40 65,55 50,55 50,70 75,70 85,55 85,40",
    roots: ["25,70 20,110 40,110 45,70", "55,70 60,110 80,110 75,70"]
  },
  premolar: {
    center: "40,25 60,25 60,55 40,55",
    tl: "50,10 30,10 25,25 25,40 40,40 40,25 50,25",
    tr: "50,10 50,25 60,25 60,40 75,40 75,25 70,10",
    bl: "50,55 40,55 40,40 25,40 25,55 30,70 50,70",
    br: "60,40 60,55 50,55 50,70 70,70 75,55 75,40",
    roots: ["30,70 40,110 50,100 60,110 70,70"]
  },
  canine: {
    center: "40,25 60,25 60,55 40,55",
    tl: "50,5 25,30 25,40 40,40 40,25 50,25",
    tr: "50,5 50,25 60,25 60,40 75,40 75,30",
    bl: "50,55 40,55 40,40 25,40 25,55 35,70 50,70",
    br: "60,40 60,55 50,55 50,70 65,70 75,55 75,40",
    roots: ["30,70 45,115 55,115 70,70"]
  },
  incisor: {
    center: "42,25 58,25 58,55 42,55",
    tl: "50,10 30,10 30,40 42,40 42,25 50,25",
    tr: "50,10 50,25 58,25 58,40 70,40 70,10",
    bl: "50,55 42,55 42,40 30,40 30,70 50,70",
    br: "58,40 58,55 50,55 50,70 70,70 70,40",
    roots: ["35,70 45,110 55,110 65,70"]
  }
};

const flipY = (poly: string) => {
  return poly.split(' ').map(point => {
    const [x, y] = point.split(',').map(Number);
    return `${x},${120 - y}`;
  }).join(' ');
};

export function ToothSvg({ toothNumber, entries, onRegionClick }: Props) {
  const num = parseInt(toothNumber, 10);
  const type = getToothType(num);
  const upper = isUpper(num);

  const toothEntries = (entries || []).filter(e => e.toothNumber === toothNumber);

  const getEntry = (region: string) => {
    return toothEntries
      .filter(e => e.toothRegion === region)
      .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  };

  const wholeEntry = getEntry("dente inteiro");
  const isExtracted = wholeEntry?.status === "extração realizada";
  const isExtractionIndicated = wholeEntry?.status === "extração indicada";
  const isMissing = wholeEntry?.status === "ausente";

  const wholeColor = wholeEntry?.color || "transparent";
  const shouldPaintWhole = wholeEntry && !isExtracted && !isExtractionIndicated; // Extractions don't paint the tooth regions

  const getColor = (region: string) => {
    if (shouldPaintWhole && region !== "raiz/base") {
      return wholeColor;
    }
    const e = getEntry(region);
    return e?.color || "white";
  };

  const base = SHAPES[type as keyof typeof SHAPES];
  
  const polys = {
    tl: upper ? flipY(base.bl) : base.tl,
    tr: upper ? flipY(base.br) : base.tr,
    bl: upper ? flipY(base.tl) : base.bl,
    br: upper ? flipY(base.tr) : base.br,
    center: upper ? flipY(base.center) : base.center,
  };

  const rootsPolys = base.roots.map(r => upper ? flipY(r) : r);

  const strokeColor = "#cbd5e1"; // cinza claro para o contorno
  const strokeWidth = "1.5";
  const strokeColorWhole = isMissing ? "#94a3b8" : (wholeColor !== "transparent" ? "#00000033" : strokeColor);

  return (
    <div className="flex flex-col items-center gap-1 group relative">
      {upper && <span className="text-[10px] sm:text-xs font-bold text-muted-foreground">{toothNumber}</span>}
      <svg 
        viewBox="0 0 100 120" 
        className="w-7 h-9 sm:w-8 sm:h-11 md:w-10 md:h-13 lg:w-9 lg:h-12 xl:w-12 xl:h-16 drop-shadow-sm transition-transform hover:scale-105 cursor-pointer overflow-visible"
      >
        {/* Raízes */}
        {rootsPolys.map((poly, i) => (
          <polygon
            key={i}
            points={poly}
            fill={getColor("raiz/base")}
            stroke={strokeColorWhole}
            strokeWidth={strokeWidth}
            className="hover:opacity-80 transition-opacity"
            onClick={() => onRegionClick(toothNumber, "raiz/base")}
          />
        ))}

        {/* Regiões da Coroa */}
        <polygon points={polys.tl} fill={getColor("superior esquerdo")} stroke={strokeColorWhole} strokeWidth={strokeWidth} className="hover:opacity-80" onClick={() => onRegionClick(toothNumber, "superior esquerdo")} />
        <polygon points={polys.tr} fill={getColor("superior direito")} stroke={strokeColorWhole} strokeWidth={strokeWidth} className="hover:opacity-80" onClick={() => onRegionClick(toothNumber, "superior direito")} />
        <polygon points={polys.bl} fill={getColor("inferior esquerdo")} stroke={strokeColorWhole} strokeWidth={strokeWidth} className="hover:opacity-80" onClick={() => onRegionClick(toothNumber, "inferior esquerdo")} />
        <polygon points={polys.br} fill={getColor("inferior direito")} stroke={strokeColorWhole} strokeWidth={strokeWidth} className="hover:opacity-80" onClick={() => onRegionClick(toothNumber, "inferior direito")} />
        <polygon points={polys.center} fill={getColor("centro")} stroke={strokeColorWhole} strokeWidth={strokeWidth} className="hover:opacity-80" onClick={() => onRegionClick(toothNumber, "centro")} />

        {/* Overlay de Dente Inteiro invisível para facilitar o clique quando precisa pintar inteiro? 
            Neste caso, a regra é que clicar em qualquer região com status selecionado "dente inteiro" pinta o dente. */}

        {/* Marcadores de Extração */}
        {isExtracted && (
          <g className="pointer-events-none">
            <line x1="10" y1="10" x2="90" y2="110" stroke="black" strokeWidth="6" strokeLinecap="round" />
            <line x1="90" y1="10" x2="10" y2="110" stroke="black" strokeWidth="6" strokeLinecap="round" />
          </g>
        )}
        {isExtractionIndicated && (
          <g className="pointer-events-none">
            <line x1="10" y1="110" x2="90" y2="10" stroke="#991b1b" strokeWidth="6" strokeLinecap="round" />
          </g>
        )}
      </svg>
      {!upper && <span className="text-[10px] sm:text-xs font-bold text-muted-foreground">{toothNumber}</span>}
    </div>
  );
}

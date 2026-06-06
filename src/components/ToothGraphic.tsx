import { OdontogramEntry } from "@/lib/store";

export function ToothGraphic({ 
  toothNumber, 
  entries, 
  onRegionClick 
}: { 
  toothNumber: string; 
  entries: OdontogramEntry[]; 
  onRegionClick: (region: string) => void;
}) {
  const getColor = (region: string) => {
    const entry = entries
      .filter(e => e.toothRegion === region)
      .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    return entry?.color || "white";
  };

  const getWholeColor = () => getColor("dente inteiro") !== "white" ? getColor("dente inteiro") : "transparent";

  // Triangles for classic 4-face odontogram
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] font-bold text-foreground/80">{toothNumber}</span>
      <svg width="40" height="50" viewBox="0 0 40 50" className="drop-shadow-sm cursor-pointer group">
        
        {/* Dente Inteiro (Background invisible layer for catching clicks if needed, or colored if whole tooth selected) */}
        <rect x="0" y="0" width="40" height="40" fill={getWholeColor()} stroke="#e2e8f0" strokeWidth="1" onClick={(e) => { e.stopPropagation(); onRegionClick("dente inteiro"); }} />
        
        {/* Superior */}
        <polygon points="0,0 40,0 20,20" fill={getColor("superior")} stroke="#cbd5e1" strokeWidth="1" 
          onClick={(e) => { e.stopPropagation(); onRegionClick("superior"); }} 
          className="hover:brightness-90 transition-all" />
          
        {/* Direito */}
        <polygon points="40,0 40,40 20,20" fill={getColor("direito")} stroke="#cbd5e1" strokeWidth="1" 
          onClick={(e) => { e.stopPropagation(); onRegionClick("direito"); }} 
          className="hover:brightness-90 transition-all" />
          
        {/* Inferior */}
        <polygon points="0,40 40,40 20,20" fill={getColor("inferior")} stroke="#cbd5e1" strokeWidth="1" 
          onClick={(e) => { e.stopPropagation(); onRegionClick("inferior"); }} 
          className="hover:brightness-90 transition-all" />
          
        {/* Esquerdo */}
        <polygon points="0,0 0,40 20,20" fill={getColor("esquerdo")} stroke="#cbd5e1" strokeWidth="1" 
          onClick={(e) => { e.stopPropagation(); onRegionClick("esquerdo"); }} 
          className="hover:brightness-90 transition-all" />
          
        {/* Centro */}
        <circle cx="20" cy="20" r="7" fill={getColor("centro")} stroke="#cbd5e1" strokeWidth="1.5" 
          onClick={(e) => { e.stopPropagation(); onRegionClick("centro"); }} 
          className="hover:brightness-90 transition-all" />
          
        {/* Raiz */}
        <path d="M 12 40 L 20 48 L 28 40 Z" fill={getColor("raiz/base")} stroke="#cbd5e1" strokeWidth="1" 
          onClick={(e) => { e.stopPropagation(); onRegionClick("raiz/base"); }} 
          className="hover:brightness-90 transition-all" />
          
        {/* Highlight Dente Inteiro Border if selected */}
        {getColor("dente inteiro") !== "white" && (
          <rect x="0" y="0" width="40" height="40" fill="none" stroke={getColor("dente inteiro")} strokeWidth="3" pointerEvents="none" />
        )}
      </svg>
    </div>
  );
}

import { STATUS_COLORS, TOOTH_STATUS } from "@/lib/store";

export const FIXED_ODONTOGRAM_STATUS = [
  ...TOOTH_STATUS,
  "sensibilidade",
  "pino de vidro",
  "núcleo metálico",
] as const;

export const EXTRA_FIXED_STATUS_COLORS: Record<string, string> = {
  sensibilidade: "#ef4444",
  "pino de vidro": "#eab308",
  "núcleo metálico": "#22c55e",
};

export const SPECIAL_TOOTH_MARKERS: Record<string, string> = {
  sensibilidade: "S",
  "pino de vidro": "P.V.",
  "núcleo metálico": "N.M.",
};

export const STATUS_DISPLAY_NAMES: Record<string, string> = {
  cárie: "Cárie",
  restauração: "Restauração",
  amálgama: "Amálgama",
  canal: "Canal",
  coroa: "Coroa",
  implante: "Implante",
  dor: "Dor",
  ausente: "Ausente",
  "extração indicada": "Extração Indicada",
  "extração realizada": "Extração Realizada",
  sensibilidade: "Sensibilidade",
  "pino de vidro": "Pino de Vidro",
  "núcleo metálico": "Núcleo Metálico",
};

export function normalizeOdontogramStatus(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function getFixedStatusColor(status: string) {
  const normalized = normalizeOdontogramStatus(status);

  const baseColor = Object.entries(STATUS_COLORS).find(
    ([key]) => normalizeOdontogramStatus(key) === normalized,
  )?.[1];

  if (baseColor) return baseColor;

  return EXTRA_FIXED_STATUS_COLORS[normalized];
}

export function getStatusDisplayName(status: string) {
  const normalized = normalizeOdontogramStatus(status);
  return STATUS_DISPLAY_NAMES[normalized] || status;
}

export function getSpecialToothMarker(status: string) {
  return SPECIAL_TOOTH_MARKERS[normalizeOdontogramStatus(status)];
}

export function isSpecialMarkerStatus(status: string) {
  return Boolean(getSpecialToothMarker(status));
}

export function isRootOnlyStatus(status: string) {
  return normalizeOdontogramStatus(status) === "canal";
}

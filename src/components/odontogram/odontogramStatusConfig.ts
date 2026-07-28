import { STATUS_COLORS, TOOTH_STATUS } from "@/lib/store";

export const FIXED_ODONTOGRAM_STATUS = [
  ...TOOTH_STATUS,
  "sensibilidade",
  "mobilidade",
] as const;

export const CANAL_COMPLEMENT_OPTIONS = [
  {
    value: "none",
    label: "Somente canal",
    status: null,
  },
  {
    value: "pfv",
    label: "Pino de Fibra de Vidro (PFV)",
    status: "pino de fibra de vidro",
  },
  {
    value: "nucleo-metalico",
    label: "Núcleo Metálico (N.M.)",
    status: "núcleo metálico",
  },
] as const;

export type CanalComplement =
  (typeof CANAL_COMPLEMENT_OPTIONS)[number]["value"];

export const RESERVED_ODONTOGRAM_STATUS = [
  ...FIXED_ODONTOGRAM_STATUS,
  "pino de vidro",
  "pino de fibra de vidro",
  "pfv",
  "núcleo metálico",
] as const;

export const EXTRA_FIXED_STATUS_COLORS: Record<string, string> = {
  sensibilidade: "#ef4444",
  mobilidade: "#2563eb",
  "pino de vidro": "#eab308",
  "pino de fibra de vidro": "#eab308",
  pfv: "#eab308",
  "núcleo metálico": "#22c55e",
};

export const SPECIAL_TOOTH_MARKERS: Record<string, string> = {
  sensibilidade: "S",
  mobilidade: "M",
  "pino de vidro": "PFV",
  "pino de fibra de vidro": "PFV",
  pfv: "PFV",
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
  mobilidade: "Mobilidade",
  "pino de vidro": "Pino de Fibra de Vidro",
  "pino de fibra de vidro": "Pino de Fibra de Vidro",
  pfv: "Pino de Fibra de Vidro",
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

export function isStandaloneMarkerStatus(status: string) {
  const normalized = normalizeOdontogramStatus(status);
  return normalized === "sensibilidade" || normalized === "mobilidade";
}

export function isCanalComplementStatus(status: string) {
  const normalized = normalizeOdontogramStatus(status);
  return (
    normalized === "pino de vidro" ||
    normalized === "pino de fibra de vidro" ||
    normalized === "pfv" ||
    normalized === "núcleo metálico"
  );
}

export function isRootOnlyStatus(status: string) {
  return normalizeOdontogramStatus(status) === "canal";
}

export function getCanonicalCanalComplementStatus(
  status: string,
): "pino de fibra de vidro" | "núcleo metálico" | null {
  const normalized = normalizeOdontogramStatus(status);

  if (
    normalized === "pino de vidro" ||
    normalized === "pino de fibra de vidro" ||
    normalized === "pfv"
  ) {
    return "pino de fibra de vidro";
  }

  if (normalized === "núcleo metálico") {
    return "núcleo metálico";
  }

  return null;
}

export function getCanalComplementStatus(
  complement: CanalComplement,
): "pino de fibra de vidro" | "núcleo metálico" | null {
  if (complement === "pfv") return "pino de fibra de vidro";
  if (complement === "nucleo-metalico") return "núcleo metálico";
  return null;
}

export function getCanalComplementValue(status?: string): CanalComplement {
  if (!status) return "none";

  const canonical = getCanonicalCanalComplementStatus(status);
  if (canonical === "pino de fibra de vidro") return "pfv";
  if (canonical === "núcleo metálico") return "nucleo-metalico";
  return "none";
}

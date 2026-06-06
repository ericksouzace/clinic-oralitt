import type { FixedCost, Settings, Supply, SupplyUsage, CustomCost } from "./store";

export const BRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(n) ? n : 0
  );

export const PCT = (n: number) =>
  `${(Number.isFinite(n) ? n : 0).toFixed(1)}%`;

export function unitCost(s: Supply) {
  if (!s.packYield || s.packYield <= 0) return 0;
  return s.packCost / s.packYield;
}

export function totalFixed(costs: FixedCost[]) {
  return costs.reduce((s, c) => s + (Number(c.value) || 0), 0);
}

export function fixedPerMinute(costs: FixedCost[], settings: Settings) {
  const minutes = (settings.daysPerMonth || 0) * (settings.hoursPerDay || 0) * 60;
  if (minutes <= 0) return 0;
  return totalFixed(costs) / minutes;
}

export function roundPrice(p: number, step: number) {
  if (!step || step <= 0) return Math.round(p * 100) / 100;
  return Math.ceil(p / step) * step;
}

export type CalcInput = {
  minutes: number;
  labCost: number;
  otherDirect: number;
  supplies: SupplyUsage[];
  customCosts: CustomCost[];
  suppliesIndex: Record<string, Supply>;
  fixedPerMin: number;
  settings: Settings;
  manualPricePix?: number;
  manualPriceCard?: number;
};

export function calculate(input: CalcInput) {
  const suppliesCost = input.supplies.reduce((sum, u) => {
    const s = input.suppliesIndex[u.supplyId];
    if (!s) return sum;
    return sum + unitCost(s) * (u.qty || 0);
  }, 0);
  const customTotal = input.customCosts.reduce((s, c) => s + (Number(c.value) || 0), 0);
  const fixedProportional = input.fixedPerMin * (input.minutes || 0);
  const realCost =
    suppliesCost +
    fixedProportional +
    (input.labCost || 0) +
    (input.otherDirect || 0) +
    customTotal;

  const { marginPct, reservePct, taxPct, cardFeePct, rounding } = input.settings;
  const targetPrice = realCost * (1 + marginPct / 100 + reservePct / 100);

  const taxFrac = Math.min(0.95, Math.max(0, taxPct / 100));
  const cardFrac = Math.min(0.95, Math.max(0, cardFeePct / 100));

  const denomPix = Math.max(0.05, 1 - taxFrac);
  const denomCard = Math.max(0.05, 1 - taxFrac - cardFrac);

  const pricePixRaw = targetPrice / denomPix;
  const priceCardRaw = targetPrice / denomCard;

  const pricePix = input.manualPricePix !== undefined ? input.manualPricePix : roundPrice(pricePixRaw, rounding);
  const priceCard = input.manualPriceCard !== undefined ? input.manualPriceCard : roundPrice(priceCardRaw, rounding);

  const taxesCard = priceCard * taxFrac;
  const feesCard = priceCard * cardFrac;
  const estimatedProfit = priceCard - taxesCard - feesCard - realCost;
  const netMargin = priceCard > 0 ? (estimatedProfit / priceCard) * 100 : 0;

  return {
    suppliesCost,
    customTotal,
    fixedProportional,
    realCost,
    targetPrice,
    pricePix,
    priceCard,
    taxesCard,
    feesCard,
    estimatedProfit,
    netMargin,
  };
}

export function priceStatus(netMargin: number, profit: number, targetMargin: number) {
  if (profit <= 0) return { label: "Preço não cobre o custo real", tone: "danger" as const };
  if (netMargin < targetMargin * 0.6) return { label: "Margem abaixo do ideal", tone: "warn" as const };
  return { label: "Preço tecnicamente saudável", tone: "ok" as const };
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Badge, Button, Card, PageHeader } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  HardDrive,
  Info,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

export const Route = createFileRoute("/armazenamento")({
  head: () => ({ meta: [{ title: "Armazenamento — Oralit" }] }),
  component: ArmazenamentoPage,
});

type Usage = {
  used_bytes?: number;
  used_mb: number;
  limit_mb: number;
  percentage: number;
  remaining_mb: number;
  files_count?: number;
};

type Tone = "ok" | "warn" | "danger";

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeUsage(input: unknown): Usage {
  const raw = Array.isArray(input) ? input[0] : input;
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const used_mb = asNumber(obj.used_mb);
  const limit_mb = asNumber(obj.limit_mb, 1);
  const percentage = asNumber(obj.percentage, limit_mb > 0 ? (used_mb / limit_mb) * 100 : 0);
  const remaining_mb = asNumber(obj.remaining_mb, Math.max(limit_mb - used_mb, 0));

  return {
    used_bytes: asNumber(obj.used_bytes),
    used_mb,
    limit_mb,
    percentage,
    remaining_mb,
    files_count: obj.files_count === undefined ? undefined : asNumber(obj.files_count),
  };
}

function getTone(percentage: number): Tone {
  if (percentage >= 90) return "danger";
  if (percentage >= 70) return "warn";
  return "ok";
}

function statusLabel(percentage: number) {
  if (percentage >= 90) return "Crítico";
  if (percentage >= 70) return "Atenção";
  return "Seguro";
}

function progressColor(tone: Tone) {
  if (tone === "danger") return "bg-rose-500";
  if (tone === "warn") return "bg-amber-500";
  return "bg-emerald-500";
}

function formatMb(mb: number) {
  if (mb >= 1024) {
    return `${(mb / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} GiB`;
  }

  return `${mb.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} MB`;
}

function UsageCard({
  title,
  subtitle,
  icon: Icon,
  usage,
}: {
  title: string;
  subtitle: string;
  icon: typeof Database;
  usage: Usage | null;
}) {
  const percentage = usage?.percentage ?? 0;
  const tone = getTone(percentage);
  const clamped = Math.min(Math.max(percentage, 0), 100);

  return (
    <Card className="overflow-hidden border-gold/20 bg-card/95">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-gold/10 p-3 text-gold">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font800 text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Badge tone={tone}>{statusLabel(percentage)}</Badge>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background/70 p-3">
          <p className="text-xs text-muted-foreground">Consumido</p>
          <p className="mt-1 text-lg font800 text-foreground">{usage ? formatMb(usage.used_mb) : "—"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background/70 p-3">
          <p className="text-xs text-muted-foreground">Limite</p>
          <p className="mt-1 text-lg font800 text-foreground">{usage ? formatMb(usage.limit_mb) : "—"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background/70 p-3">
          <p className="text-xs text-muted-foreground">Ainda disponível</p>
          <p className="mt-1 text-lg font800 text-foreground">{usage ? formatMb(usage.remaining_mb) : "—"}</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs font700 text-muted-foreground">
          <span>{usage ? `${percentage.toFixed(2)}% usado` : "Aguardando leitura"}</span>
          {usage?.files_count !== undefined && <span>{usage.files_count} arquivo(s)</span>}
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-all ${progressColor(tone)}`}
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>
    </Card>
  );
}

function ArmazenamentoPage() {
  const [databaseUsage, setDatabaseUsage] = useState<Usage | null>(null);
  const [storageUsage, setStorageUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  async function loadUsage() {
    try {
      setLoading(true);
      setError(null);

      const [databaseResult, storageResult] = await Promise.all([
        (supabase as any).rpc("get_database_usage"),
        (supabase as any).rpc("get_storage_usage"),
      ]);

      if (databaseResult.error) throw databaseResult.error;
      if (storageResult.error) throw storageResult.error;

      setDatabaseUsage(normalizeUsage(databaseResult.data));
      setStorageUsage(normalizeUsage(storageResult.data));
      setUpdatedAt(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível carregar o uso de armazenamento.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsage();
  }, []);

  const alerts = useMemo(() => {
    const list: { tone: Tone; title: string; description: string }[] = [];

    if (databaseUsage) {
      const tone = getTone(databaseUsage.percentage);
      if (tone !== "ok") {
        list.push({
          tone,
          title: tone === "danger" ? "Banco de dados em nível crítico" : "Banco de dados em atenção",
          description: `O banco já consumiu ${databaseUsage.percentage.toFixed(2)}% do limite de ${formatMb(databaseUsage.limit_mb)}.`,
        });
      }
    }

    if (storageUsage) {
      const tone = getTone(storageUsage.percentage);
      if (tone !== "ok") {
        list.push({
          tone,
          title: tone === "danger" ? "Storage em nível crítico" : "Storage em atenção",
          description: `Os arquivos já consumiram ${storageUsage.percentage.toFixed(2)}% do limite de ${formatMb(storageUsage.limit_mb)}.`,
        });
      }
    }

    return list;
  }, [databaseUsage, storageUsage]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Armazenamento"
          subtitle="Acompanhe quanto a Clínica Oralit já consumiu no banco de dados e nos arquivos, com limite, saldo restante e alertas automáticos."
          action={
            <Button onClick={loadUsage} disabled={loading} variant="gold">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar dados
            </Button>
          }
        />

        {error && (
          <Card className="border-rose-200 bg-rose-50 text-rose-800">
            <div className="flex gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5" />
              <div>
                <h2 className="font800">Não foi possível carregar o armazenamento</h2>
                <p className="mt-1 text-sm">{error}</p>
                <p className="mt-2 text-xs">
                  Verifique se as funções SQL get_database_usage e get_storage_usage foram executadas no Supabase.
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <UsageCard
            title="Banco de dados Supabase"
            subtitle="Limite de referência do plano Free: 500 MB. Aqui ficam pacientes, prontuários, financeiro, estoque, histórico e registros estruturados."
            icon={Database}
            usage={databaseUsage}
          />

          <UsageCard
            title="Arquivos no Supabase Storage"
            subtitle="Limite de referência do plano Free: 1 GB. Aqui ficam PDFs, fotos, radiografias e documentos enviados pelo sistema."
            icon={HardDrive}
            usage={storageUsage}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-1 border-gold/20">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-gold/10 p-3 text-gold">
                  <Cloud className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font800">DigitalOcean Spaces</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Preparado para integração futura.</p>
                </div>
              </div>
              <Badge tone="neutral">Não conectado</Badge>
            </div>

            <div className="mt-5 space-y-3 text-sm text-muted-foreground">
              <p>
                Quando a Oralit migrar arquivos pesados para DigitalOcean Spaces, esta aba pode acompanhar o limite base de 250 GiB.
              </p>
              <div className="rounded-2xl border border-border bg-background/70 p-3">
                <p className="text-xs">Limite de referência</p>
                <p className="mt-1 text-lg font800 text-foreground">250 GiB</p>
              </div>
            </div>
          </Card>

          <Card className="xl:col-span-2">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-gold" />
              <h2 className="text-base font800">Alertas</h2>
            </div>

            <div className="mt-4 space-y-3">
              {alerts.length === 0 ? (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-5 w-5" />
                  <div>
                    <p className="font800">Nenhum alerta crítico no momento</p>
                    <p className="mt-1 text-sm">Banco e arquivos estão abaixo da zona de atenção.</p>
                  </div>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.title}
                    className={`rounded-2xl border p-4 ${
                      alert.tone === "danger"
                        ? "border-rose-200 bg-rose-50 text-rose-800"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    <p className="font800">{alert.title}</p>
                    <p className="mt-1 text-sm">{alert.description}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <Card>
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 text-gold" />
            <div>
              <h2 className="text-base font800">Recomendações automáticas</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  "Não salve imagens, PDFs ou radiografias diretamente no banco de dados.",
                  "Use o banco apenas para textos, registros, IDs, datas, permissões e caminhos dos arquivos.",
                  "Use Storage ou DigitalOcean Spaces para fotos, radiografias, notas fiscais e documentos pesados.",
                  "Quando o banco passar de 70%, avalie limpeza, compactação, índices e migração de anexos para storage externo.",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-border bg-background/70 p-3 text-sm text-muted-foreground">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground">
          Última atualização: {updatedAt ? updatedAt.toLocaleString("pt-BR") : "ainda não carregado"}. Os limites exibidos são referências configuradas para o controle da Oralit.
        </p>
      </div>
    </AppLayout>
  );
}

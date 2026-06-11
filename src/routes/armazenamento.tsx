import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, PageHeader, Button, Badge } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Cloud, Database, HardDrive, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/armazenamento")({
  head: () => ({ meta: [{ title: "Armazenamento — Oralit" }] }),
  component: ArmazenamentoPage,
});

type Usage = {
  used_mb: number;
  limit_mb: number;
  remaining_mb: number;
  percentage: number;
  files_count?: number;
};

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeUsage(data: unknown): Usage {
  const raw = Array.isArray(data) ? data[0] : data;
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const usedMb = toNumber(obj.used_mb);
  const limitMb = toNumber(obj.limit_mb, 1);
  const percentage = toNumber(obj.percentage, limitMb > 0 ? (usedMb / limitMb) * 100 : 0);
  const remainingMb = toNumber(obj.remaining_mb, Math.max(limitMb - usedMb, 0));

  return {
    used_mb: usedMb,
    limit_mb: limitMb,
    remaining_mb: remainingMb,
    percentage,
    files_count: obj.files_count === undefined ? undefined : toNumber(obj.files_count),
  };
}

function formatMb(value: number) {
  if (value >= 1024) {
    return `${(value / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} GiB`;
  }

  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} MB`;
}

function getStatus(percentage: number) {
  if (percentage >= 90) return { label: "Crítico", tone: "danger" as const, bar: "bg-rose-500" };
  if (percentage >= 70) return { label: "Atenção", tone: "warn" as const, bar: "bg-amber-500" };
  return { label: "Seguro", tone: "ok" as const, bar: "bg-emerald-500" };
}

function StorageCard({
  title,
  description,
  icon,
  usage,
}: {
  title: string;
  description: string;
  icon: "database" | "storage";
  usage: Usage | null;
}) {
  const Icon = icon === "database" ? Database : HardDrive;
  const percentage = usage?.percentage ?? 0;
  const status = getStatus(percentage);
  const width = Math.min(Math.max(percentage, 0), 100);

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-gold/10 p-3 text-gold">
            <Icon className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font800 text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">Consumido</p>
          <p className="mt-1 text-xl font800">{usage ? formatMb(usage.used_mb) : "—"}</p>
        </div>

        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">Limite</p>
          <p className="mt-1 text-xl font800">{usage ? formatMb(usage.limit_mb) : "—"}</p>
        </div>

        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">Falta consumir</p>
          <p className="mt-1 text-xl font800">{usage ? formatMb(usage.remaining_mb) : "—"}</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex justify-between text-xs font700 text-muted-foreground">
          <span>{usage ? `${percentage.toFixed(2)}% usado` : "Carregando..."}</span>
          {usage?.files_count !== undefined && <span>{usage.files_count} arquivo(s)</span>}
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-secondary">
          <div className={`h-full rounded-full ${status.bar}`} style={{ width: `${width}%` }} />
        </div>
      </div>
    </Card>
  );
}

function ArmazenamentoPage() {
  const [databaseUsage, setDatabaseUsage] = useState<Usage | null>(null);
  const [storageUsage, setStorageUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadUsage() {
    setLoading(true);
    setErrorMessage("");

    try {
      const databaseResult = await (supabase as any).rpc("get_database_usage");
      const storageResult = await (supabase as any).rpc("get_storage_usage");

      if (databaseResult.error) {
        throw new Error(databaseResult.error.message);
      }

      if (storageResult.error) {
        throw new Error(storageResult.error.message);
      }

      setDatabaseUsage(normalizeUsage(databaseResult.data));
      setStorageUsage(normalizeUsage(storageResult.data));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao carregar dados.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsage();
  }, []);

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Armazenamento"
          subtitle="Acompanhe quanto a Clínica Oralit já consumiu e quanto ainda falta antes de atingir os limites."
          action={
            <Button onClick={loadUsage} disabled={loading} variant="gold">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar dados
            </Button>
          }
        />

        {errorMessage && (
          <Card className="border-amber-200 bg-amber-50 text-amber-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5" />
              <div>
                <h2 className="font800">A aba carregou, mas não conseguiu ler o Supabase</h2>
                <p className="mt-1 text-sm">{errorMessage}</p>
                <p className="mt-2 text-xs">
                  Confirme se você executou as funções get_database_usage e get_storage_usage no SQL Editor.
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <StorageCard
            title="Banco de dados"
            description="Limite de referência: 500 MB no plano Free do Supabase."
            icon="database"
            usage={databaseUsage}
          />

          <StorageCard
            title="Supabase Storage"
            description="Limite de referência: 1 GB para arquivos no plano Free."
            icon="storage"
            usage={storageUsage}
          />
        </div>

        <Card>
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-gold/10 p-3 text-gold">
              <Cloud className="h-5 w-5" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font800">DigitalOcean Spaces</h2>
                <Badge tone="neutral">Não conectado</Badge>
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                Preparado para integração futura. O plano base do DigitalOcean Spaces inclui 250 GiB para arquivos pesados,
                como fotos, PDFs, radiografias e documentos clínicos.
              </p>

              <div className="mt-4 rounded-xl border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">Limite de referência</p>
                <p className="mt-1 text-xl font800">250 GiB</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font800">Recomendações</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <p className="rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">
              Não salve fotos, PDFs ou radiografias diretamente no banco de dados.
            </p>

            <p className="rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">
              Use o banco apenas para textos, registros, IDs, datas, permissões e caminhos dos arquivos.
            </p>

            <p className="rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">
              Use Storage ou DigitalOcean Spaces para arquivos pesados.
            </p>

            <p className="rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">
              Se passar de 70%, já considere migração ou limpeza de arquivos antigos.
            </p>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

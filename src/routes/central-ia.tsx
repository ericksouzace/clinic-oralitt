import { createFileRoute } from "@tanstack/react-router";
import AppLayout from "@/components/AppLayout";

export const Route = createFileRoute("/central-ia")({
  component: ModelosDeArquivoPage,
});

function ModelosDeArquivoPage() {
  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Modelos de Arquivo
          </h1>
        </div>
        <section
          aria-label="Modelos de Arquivo"
          className="min-h-[320px] rounded-xl border border-border bg-card"
        />
      </div>
    </AppLayout>
  );
}

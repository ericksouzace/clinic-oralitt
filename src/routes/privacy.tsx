import { createFileRoute, Link } from "@tanstack/react-router";
import { Brand } from "@/components/AppLayout";
import { Card } from "@/components/ui-bits";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Política de Privacidade — Oralit" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <Brand size="sm" />
          <Link to="/login" className="text-sm font-semibold text-gold-deep hover:underline">
            Acessar Sistema
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto max-w-4xl px-4 py-10 w-full">
        <Card className="p-8 border border-border bg-card/60 backdrop-blur shadow-xl relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gold-gradient" />
          
          <h1 className="text-3xl font-display font-extrabold tracking-tight mb-2">
            Política de Privacidade
          </h1>
          <p className="text-xs text-muted-foreground mb-6">
            Última atualização: 7 de junho de 2026
          </p>

          <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                1. Apresentação do Sistema
              </h2>
              <p>
                O <strong>Oralit Clinic Pro</strong> é um sistema de gestão clínica odontológica projetado para auxiliar consultórios e profissionais na precificação de procedimentos, controle de insumos, fluxos financeiros e comunicação com pacientes. Esta Política de Privacidade descreve como tratamos as informações coletadas no uso da nossa plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                2. Informações e Dados Coletados
              </h2>
              <p className="mb-2">
                No desempenho das funções do sistema, as informações gerenciadas podem incluir:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Dados Cadastrais:</strong> Nome completo, endereço de e-mail e número de telefone (WhatsApp) dos profissionais da clínica e de seus respectivos pacientes.</li>
                <li><strong>Dados Operacionais:</strong> Histórico de agendamentos, status de consultas e comunicações enviadas.</li>
                <li><strong>Registros Clínicos Internos:</strong> Anotações de evolução clínica, tratamentos planejados e odontograma.</li>
                <li><strong>Informações Financeiras Internas:</strong> Valores cobrados por procedimentos, custos fixos declarados da clínica, tabelas de insumos e status de pagamento de parcelas.</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                * Nota importante: Todos os dados dos pacientes são inseridos e geridos sob responsabilidade direta da clínica utilizadora do sistema.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                3. Finalidade do Uso de Dados
              </h2>
              <p className="mb-2">
                Os dados coletados e armazenados no sistema servem estritamente para as seguintes finalidades legítimas:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Gestão administrativa e operacional das rotinas da clínica odontológica.</li>
                <li>Cálculo preciso e controle de custos de insumos e precificação de procedimentos.</li>
                <li>Comunicação automatizada ou manual com pacientes (tais como lembretes de consultas, confirmações de agenda, orientações pós-atendimento e mensagens de cobrança) via integração com WhatsApp Cloud API.</li>
                <li>Garantia da segurança e rastreabilidade dos acessos ao sistema.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                4. Armazenamento e Segurança dos Dados
              </h2>
              <p>
                Os dados são armazenados de forma estruturada e segura utilizando infraestrutura em nuvem fornecida pelo provedor Supabase (baseada em banco de dados PostgreSQL). Empregamos medidas técnicas e administrativas adequadas para proteger os dados contra acessos não autorizados, perdas ou divulgação indevida.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                5. Compartilhamento de Dados e Integração WhatsApp
              </h2>
              <p>
                Não vendemos ou compartilhamos os dados inseridos na plataforma com terceiros para fins publicitários. O compartilhamento ocorre exclusivamente com os provedores técnicos necessários para o funcionamento do app:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Supabase:</strong> Para hospedagem segura de dados e autenticação de usuários.</li>
                <li><strong>Meta (WhatsApp Cloud API):</strong> Para transmissão direta de mensagens de notificação e alertas aos pacientes em nome da clínica cadastrada.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                6. Seus Direitos
              </h2>
              <p>
                Os usuários e titulares de dados inseridos na plataforma possuem o direito de solicitar a confirmação da existência de tratamento, obter acesso, retificar informações incorretas ou solicitar a exclusão de seus dados pessoais. O canal oficial para requisições é o e-mail de contato informado abaixo.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                7. Contato
              </h2>
              <p>
                Caso tenha dúvidas sobre esta política, sobre como seus dados são tratados ou queira solicitar a exclusão de dados pessoais da plataforma, entre em contato diretamente pelo e-mail:
              </p>
              <div className="mt-3 p-4 bg-secondary/60 rounded-lg border border-border text-center font-semibold text-gold-deep">
                erickshowdegol@gmail.com
              </div>
            </section>
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/40 py-6 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-4xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            Oralit Clinic Pro &copy; 2026. Todos os direitos reservados.
          </div>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:underline">Termos de Serviço</Link>
            <Link to="/data-deletion" className="hover:underline">Exclusão de Dados</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

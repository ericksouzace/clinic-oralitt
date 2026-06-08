import { createFileRoute, Link } from "@tanstack/react-router";
import { Brand } from "@/components/AppLayout";
import { Card } from "@/components/ui-bits";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Termos de Serviço — Oralit" }] }),
  component: TermsPage,
});

function TermsPage() {
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
            Termos de Serviço
          </h1>
          <p className="text-xs text-muted-foreground mb-6">
            Última atualização: 7 de junho de 2026
          </p>

          <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                1. Aceitação dos Termos
              </h2>
              <p>
                Ao acessar e utilizar o sistema <strong>Oralit Clinic Pro</strong>, você concorda com estes Termos de Serviço. O Oralit é uma ferramenta de gestão clínica e financeira odontológica destinada a profissionais de saúde e suas equipes administrativas.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                2. Uso Permitido e Conduta do Usuário
              </h2>
              <p>
                A plataforma deve ser utilizada apenas para finalidades profissionais lícitas ligadas à gestão da clínica odontológica do assinante/usuário. O usuário é inteiramente responsável por manter o sigilo de suas credenciais de login e por todas as operações realizadas em sua conta.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                3. Responsabilidade pelos Dados e Pacientes
              </h2>
              <p>
                A clínica e seus profissionais são integralmente responsáveis por coletar o devido consentimento de seus pacientes antes de inserir seus dados no sistema, bem como por garantir que as mensagens de notificação e cobrança disparadas via WhatsApp estejam de acordo com as preferências dos destinatários.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                4. Integrações de Terceiros (WhatsApp & Supabase)
              </h2>
              <p>
                O funcionamento do Oralit Clinic Pro depende de integrações tecnológicas fornecidas por terceiros, em especial:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>O serviço de nuvem e banco de dados do <strong>Supabase</strong>.</li>
                <li>A API Oficial do WhatsApp (<strong>Meta Cloud API</strong>) para envio de mensagens.</li>
              </ul>
              <p className="mt-2">
                Embora façamos o possível para manter o sistema integrado e operacional, não garantimos o envio ininterrupto de mensagens se houver indisponibilidade ou alterações de termos e limites promovidos por estas plataformas integradas.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                5. Limitações de Responsabilidade
              </h2>
              <p>
                O Oralit Clinic Pro fornece cálculos e estimativas de precificação para auxiliar na tomada de decisão financeira de seu consultório. Os cálculos baseiam-se puramente nos insumos e dados inseridos pelo usuário. O sistema não garante lucros específicos e não substitui o planejamento administrativo individual do gestor clínico.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                6. Modificações e Disponibilidade do Serviço
              </h2>
              <p>
                Reservamo-nos o direito de modificar o sistema, adicionar novas funcionalidades ou suspender temporariamente o serviço para manutenções programadas de segurança ou de infraestrutura, com aviso prévio sempre que viável.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                7. Contato
              </h2>
              <p>
                Para mais informações sobre estes termos ou para esclarecer qualquer dúvida de utilização, entre em contato pelo e-mail:
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
            <Link to="/privacy" className="hover:underline">Política de Privacidade</Link>
            <Link to="/data-deletion" className="hover:underline">Exclusão de Dados</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

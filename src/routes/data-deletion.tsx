import { createFileRoute, Link } from "@tanstack/react-router";
import { Brand } from "@/components/AppLayout";
import { Card } from "@/components/ui-bits";

export const Route = createFileRoute("/data-deletion")({
  head: () => ({ meta: [{ title: "Exclusão de Dados — Oralit" }] }),
  component: DataDeletionPage,
});

function DataDeletionPage() {
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
            Instruções de Exclusão de Dados do Usuário
          </h1>
          <p className="text-xs text-muted-foreground mb-6">
            Instruções para requisição de remoção de informações pessoais
          </p>

          <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                Como Solicitar a Exclusão de Seus Dados
              </h2>
              <p>
                No Oralit Clinic Pro, nós valorizamos a privacidade dos dados de nossos usuários e pacientes cadastrados pelas clínicas. Caso deseje que seus dados cadastrais sejam completamente apagados de nossa infraestrutura de banco de dados, você poderá fazer essa solicitação a qualquer momento de forma simples.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                Passo a Passo da Solicitação
              </h2>
              <p className="mb-3">
                Para solicitar a remoção permanente de seus dados pessoais da nossa plataforma:
              </p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  Envie uma mensagem de e-mail detalhada para o e-mail do Encarregado de Proteção de Dados: <strong>erickshowdegol@gmail.com</strong>
                </li>
                <li>
                  No assunto do e-mail, escreva: <strong>"Solicitação de Exclusão de Dados - Oralit"</strong>.
                </li>
                <li>
                  No corpo da mensagem, informe:
                  <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs text-muted-foreground">
                    <li>Seu nome completo;</li>
                    <li>Seu e-mail cadastrado ou número de telefone associado;</li>
                    <li>Uma breve confirmação do seu pedido de exclusão.</li>
                  </ul>
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                Prazo e Processamento
              </h2>
              <p>
                Nossa equipe analisará sua solicitação e iniciará o procedimento de remoção definitiva no prazo máximo de <strong>15 (quinze) dias úteis</strong> a contar da confirmação do recebimento da solicitação. Após a conclusão, enviaremos um e-mail de confirmação garantindo que todas as suas informações pessoais e registros vinculados foram expurgados da plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                Limitações Legais de Exclusão
              </h2>
              <p>
                Por favor, note que a exclusão de dados pode não ser aplicável a registros que somos legalmente obrigados a reter para cumprir obrigações fiscais, regulatórias da saúde pública (histórico clínico obrigatório regulado pelo CFO) ou para fins de resolução de disputas financeiras legítimas em andamento.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold font-display text-gold-deep mb-2">
                Dúvidas e Contato Direto
              </h2>
              <p>
                Se você tiver qualquer pergunta sobre o procedimento de exclusão de dados ou se for um profissional querendo remover a conta inteira de sua clínica, entre em contato diretamente pelo e-mail:
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
            <Link to="/terms" className="hover:underline">Termos de Serviço</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

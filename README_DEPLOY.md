# Instruções de Deploy (Oralit Clinic Pro na Vercel)

Este guia detalha como realizar o deploy do **Oralit Clinic Pro** (construído sobre TanStack Start + Vinxi + React) na Vercel para obter uma URL HTTPS estável e fixa, garantindo a validação das páginas de privacidade e do webhook pela Meta.

---

## 🚀 Passo a Passo para Deploy na Vercel

### 1. Preparar o Repositório Git
1. Certifique-se de que todas as alterações locais estão commitadas em seu repositório Git (ex: GitHub, GitLab ou Bitbucket).
2. Garanta que o arquivo `.env` **não** foi enviado ao repositório (verifique se ele está ignorado no `.gitignore`).

### 2. Criar o Projeto na Vercel
1. Acesse o painel da [Vercel](https://vercel.com/) e faça login.
2. Clique em **"Add New..."** > **"Project"**.
3. Importe o repositório do projeto **Oralit Clinic Pro**.

### 3. Configurações de Build & Desenvolvimento (Evitando o Erro 404)
No painel da Vercel, certifique-se de configurar os seguintes parâmetros:
* **Framework Preset:** Selecione **`Other`** (isso é crítico para que a Vercel não tente forçar rotas estáticas padrão do Vite).
* **Build Command:** `npm run build`
* **Install Command:** Mantenha o padrão da Vercel (ex: `npm install` ou `npm ci`).
* **Output Directory:** Deixe **vazio / desmarcado** (ou seja, não marque a opção de override). O compilador Nitro agora gera a pasta `.vercel/output` na raiz do projeto. A Vercel detecta essa pasta automaticamente e configura o roteamento e as Serverless Functions sem necessidade de configuração manual.

> [!IMPORTANT]
> O erro 404 ocorria porque, sem o preset configurado explicitamente no arquivo de configuração, o projeto compilava apenas como um app estático client-side. Ao adicionarmos `nitro: { preset: "vercel" }` no `vite.config.ts`, a compilação agora gera a estrutura completa de Serverless Functions compatível com a Vercel.

### 4. Configurar as Variáveis de Ambiente (Environment Variables)
No painel de criação da Vercel, expanda a seção **Environment Variables** e adicione as seguintes chaves do seu arquivo `.env` local:

| Variável | Descrição | Exemplo |
|---|---|---|
| `VITE_SUPABASE_URL` | URL do seu projeto Supabase (acesso client/server) | `https://nstvfchogugzfbprbbya.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública do Supabase (acesso client/server) | `sb_publishable_...` |
| `SUPABASE_URL` | URL do projeto Supabase | `https://nstvfchogugzfbprbbya.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública do Supabase | `sb_publishable_...` |
| `WHATSAPP_PROVIDER` | Provedor de mensagens de WhatsApp ativo | `meta` |
| `WHATSAPP_META_PHONE_NUMBER_ID` | Phone Number ID da Meta Cloud API | `1146420468553242` |
| `WHATSAPP_META_ACCESS_TOKEN` | Token permanente de acesso à API da Meta | `EAAX...ZDZD` |
| `WHATSAPP_META_API_VERSION` | Versão da Graph API | `v20.0` |
| `WHATSAPP_META_BUSINESS_ACCOUNT_ID` | WhatsApp Business Account ID | `2013438189262186` |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Token para validação de Callback do webhook | `oralit_webhook_2026` |
| `NITRO_PRESET` | Preset do Nitro para build na Vercel | `vercel` |

### 5. Finalizar o Deploy
1. Clique em **"Deploy"**.
2. Aguarde a conclusão da esteira de compilação.
3. Assim que finalizar, a Vercel gerará um domínio gratuito como `https://clinic-oralit.vercel.app`.

---

## 📝 Configuração dos Links no Meta Developers

Com a URL gerada pelo deploy (ex: `https://seu-app.vercel.app`), configure os seguintes campos no seu aplicativo no painel do **Meta Developers**:

### URLs Legais (Configurações Básicas do Aplicativo):
* **URL da Política de Privacidade:** `https://seu-app.vercel.app/privacy`
* **URL dos Termos de Serviço:** `https://seu-app.vercel.app/terms`
* **Exclusão de Dados do Usuário:** `https://seu-app.vercel.app/data-deletion`

### Configuração do Webhook (Central WhatsApp da Meta):
* **Callback URL:** `https://seu-app.vercel.app/api/whatsapp/webhook`
* **Verify Token:** `oralit_webhook_2026`

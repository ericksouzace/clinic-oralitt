# Lembrete automático de inatividade do Oralit

O Oralit agora registra a última atividade do usuário e envia um aviso por e-mail após 5 dias sem acesso.

## Como funciona

- Ao abrir o Oralit autenticado, `last_activity_at` é atualizado.
- Se o usuário voltar, `inactivity_reminder_sent_at` é limpo.
- A Vercel executa `/api/cron/inactivity-reminder` diariamente às 13:00 UTC (10:00 em Fortaleza).
- Perfis com 5 dias ou mais sem atividade e sem aviso anterior recebem o e-mail.
- Após envio com sucesso, o perfil fica marcado para não receber mensagens repetidas.
- Quando o usuário volta a acessar o Oralit, um novo ciclo pode começar.

## 1. Aplicar a migration no Supabase

Depois que o projeto Supabase terminar de restaurar, abra o SQL Editor e execute o conteúdo de:

`supabase/migrations/20260908190000_inactivity_reminder.sql`

Isso cria os campos:

- `last_activity_at`
- `inactivity_reminder_sent_at`

E cria a função segura `touch_user_activity()` usada pelo aplicativo.

## 2. Configurar o Resend

Crie uma conta em https://resend.com e gere uma API Key.

Para enviar mensagens para usuários reais, configure e valide um domínio no Resend, por exemplo `oralit.com.br`, e use um remetente como:

`Oralit <no-reply@oralit.com.br>`

## 3. Variáveis de ambiente na Vercel

No projeto da Vercel, abra Settings > Environment Variables e adicione:

```env
SUPABASE_SERVICE_ROLE_KEY=cole_a_service_role_key_do_supabase
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=Oralit <no-reply@seudominio.com>
CRON_SECRET=uma_senha_grande_e_aleatoria
ORALIT_APP_URL=https://clinic-oralitt.vercel.app
INACTIVITY_REMINDER_DAYS=5
```

`SUPABASE_URL` também precisa continuar configurada no projeto.

### Onde pegar SUPABASE_SERVICE_ROLE_KEY

No Supabase, abra o projeto > Settings > API / API Keys e copie a chave de servidor/service role. Nunca coloque essa chave em uma variável `VITE_*` e nunca exponha no navegador.

## 4. Fazer novo deploy

Depois de salvar as variáveis na Vercel, faça um Redeploy da versão mais recente da branch `main`.

A Vercel lerá `vercel.json` e cadastrará o cron diário automaticamente.

## E-mail enviado

Assunto: `Acesse o Oralit para manter seu sistema ativo`

Mensagem principal:

> Notamos que o Oralit está há alguns dias sem atividade.
>
> Para evitar que alguns serviços vinculados ao sistema fiquem temporariamente indisponíveis, acesse sua conta novamente nos próximos dias.
>
> Basta entrar normalmente no Oralit para registrar uma nova atividade.

O e-mail inclui um botão `Acessar Oralit` apontando para `ORALIT_APP_URL`.

## Segurança

O endpoint do cron exige `Authorization: Bearer <CRON_SECRET>`. A chave de administrador do Supabase e a chave do Resend ficam somente no ambiente server-side da Vercel.

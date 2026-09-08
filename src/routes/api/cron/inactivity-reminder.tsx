import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DAY_MS = 24 * 60 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function sendReminderEmail(params: {
  to: string;
  name?: string | null;
  appUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY e RESEND_FROM_EMAIL precisam estar configurados.");
  }

  const recipientName = params.name?.trim() || "Olá";
  const subject = "Acesse o Oralit para manter seu sistema ativo";
  const text = `${recipientName},\n\nNotamos que o Oralit está há alguns dias sem atividade.\n\nPara evitar que alguns serviços vinculados ao sistema fiquem temporariamente indisponíveis, acesse sua conta novamente nos próximos dias.\n\nBasta entrar normalmente no Oralit para registrar uma nova atividade.\n\nAcessar Oralit: ${params.appUrl}\n\nEquipe Oralit`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:620px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 20px">Oralit</h2>
      <p>${recipientName},</p>
      <p>Notamos que o Oralit está há alguns dias sem atividade.</p>
      <p>Para evitar que alguns serviços vinculados ao sistema fiquem temporariamente indisponíveis, acesse sua conta novamente nos próximos dias.</p>
      <p>Basta entrar normalmente no Oralit para registrar uma nova atividade.</p>
      <p style="margin:28px 0">
        <a href="${params.appUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Acessar Oralit</a>
      </p>
      <p>Equipe Oralit</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Falha ao enviar e-mail pelo Resend (${response.status}): ${details}`);
  }
}

export const Route = createFileRoute("/api/cron/inactivity-reminder")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthorized(request)) {
          return json({ error: "Unauthorized" }, 401);
        }

        const appUrl = process.env.ORALIT_APP_URL || "https://clinic-oralitt.vercel.app";
        const inactivityDays = Math.max(1, Number(process.env.INACTIVITY_REMINDER_DAYS || "5"));
        const cutoff = new Date(Date.now() - inactivityDays * DAY_MS).toISOString();
        const db = supabaseAdmin as any;

        const { data: profiles, error } = await db
          .from("profiles")
          .select("id, full_name, email, last_activity_at, inactivity_reminder_sent_at")
          .not("email", "is", null)
          .lt("last_activity_at", cutoff)
          .is("inactivity_reminder_sent_at", null)
          .limit(100);

        if (error) {
          console.error("[Inactivity Reminder] query error:", error);
          return json({ error: "Falha ao consultar perfis inativos." }, 500);
        }

        let sent = 0;
        const failures: Array<{ id: string; error: string }> = [];

        for (const profile of profiles || []) {
          try {
            await sendReminderEmail({
              to: profile.email,
              name: profile.full_name,
              appUrl,
            });

            const { error: updateError } = await db
              .from("profiles")
              .update({ inactivity_reminder_sent_at: new Date().toISOString() })
              .eq("id", profile.id)
              .is("inactivity_reminder_sent_at", null);

            if (updateError) throw updateError;
            sent += 1;
          } catch (err: any) {
            console.error("[Inactivity Reminder] send error:", err);
            failures.push({
              id: profile.id,
              error: err?.message || "Erro desconhecido",
            });
          }
        }

        return json({
          ok: true,
          inactivityDays,
          checked: profiles?.length || 0,
          sent,
          failures,
        });
      },
    },
  },
});

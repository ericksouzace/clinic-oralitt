import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/api/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "oralit_webhook_verify_token";

        if (mode === "subscribe" && token === verifyToken) {
          console.log("[Meta Webhook]: Verified successfully!");
          return new Response(challenge, { 
            status: 200,
            headers: {
              "Content-Type": "text/plain"
            }
          });
        }

        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        try {
          const body: any = await request.json();
          console.log("[Meta Webhook Event Received]:", JSON.stringify(body, null, 2));

          const entry = body.entry?.[0];
          const changes = entry?.changes?.[0];
          const value = changes?.value;
          const messageStatus = value?.statuses?.[0];

          if (messageStatus) {
            const metaMessageId = messageStatus.id;
            const status = messageStatus.status; // sent, delivered, read, failed
            
            let dbStatus = "aceito_meta";
            if (status === "sent") dbStatus = "enviada";
            if (status === "delivered") dbStatus = "entregue";
            if (status === "read") dbStatus = "lida";
            if (status === "failed") dbStatus = "falhou";

            const errorMessage = messageStatus.errors?.[0]?.message || null;

            if (metaMessageId) {
              const { error: errorDirect } = await supabase
                .from("message_logs")
                .update({ 
                  status: dbStatus,
                  error_message: errorMessage 
                })
                .eq("error_message", `meta_id:${metaMessageId}`);

              if (errorDirect) {
                console.error("[Webhook DB Update Direct Error]:", errorDirect);
              } else {
                console.log(`[Webhook]: Updated message ${metaMessageId} to status ${dbStatus}`);
              }
            }
          }

          return new Response("OK", { status: 200 });
        } catch (e: any) {
          console.error("[Webhook Exception]:", e);
          return new Response("Internal Server Error", { status: 500 });
        }
      }
    }
  }
});

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import process from "node:process";

export const checkMetaCredentials = createServerFn({ method: "GET" })
  .handler(async () => {
    const phoneId = process.env.WHATSAPP_META_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_META_ACCESS_TOKEN;
    const version = process.env.WHATSAPP_META_API_VERSION || "v20.0";

    return {
      hasPhoneId: !!phoneId,
      hasToken: !!token,
      apiVersion: version,
    };
  });

export const checkMetaConnectionHealth = createServerFn({ method: "GET" })
  .handler(async () => {
    const phoneId = process.env.WHATSAPP_META_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_META_ACCESS_TOKEN;
    const apiVersion = process.env.WHATSAPP_META_API_VERSION || "v20.0";

    if (!phoneId || !token) {
      return { status: "env_incompleto", message: "Credenciais Meta não configuradas no servidor." };
    }

    const url = `https://graph.facebook.com/${apiVersion}/${phoneId}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      const resData = await response.json();

      if (!response.ok) {
        console.error("[Meta Health Check Failed]:", {
          status: response.status,
          error: resData.error
        });
        const code = resData.error?.code;
        const msg = resData.error?.message || "";

        if (response.status === 401 || code === 190) {
          return { status: "token_invalido" };
        }
        if (code === 33 || msg.includes("phone number ID") || msg.includes("Phone number ID")) {
          return { status: "phone_number_id_invalido" };
        }
        if (response.status === 403 || msg.includes("permission") || msg.includes("Permission")) {
          return { status: "erro_permissao" };
        }
        return { status: "erro_desconhecido", message: msg };
      }

      return { status: "conectado" };
    } catch (e: any) {
      console.error("[Meta Health Check Exception]:", e);
      return { status: "erro_desconhecido", message: e.message };
    }
  });

export const sendWhatsAppServerFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    patientId: z.string(),
    phone: z.string(),
    message: z.string(),
    templateId: z.string().optional(),
    appointmentId: z.string().optional()
  }))
  .handler(async ({ data }) => {
    const phoneId = process.env.WHATSAPP_META_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_META_ACCESS_TOKEN;
    const apiVersion = process.env.WHATSAPP_META_API_VERSION || "v20.0";

    if (!phoneId || !token) {
      throw new Error("Credenciais Meta não configuradas no servidor.");
    }

    // Normalizar telefone
    let cleanPhone = data.phone.replace(/\D/g, "");
    if (!cleanPhone.startsWith("55") && cleanPhone.length <= 11) {
      cleanPhone = "55" + cleanPhone;
    }

    const url = `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "text",
          text: {
            preview_url: false,
            body: data.message
          }
        })
      });

      const resData = await response.json();

      if (!response.ok) {
        console.error("[Meta API Error Details]:", {
          status: response.status,
          statusText: response.statusText,
          error: resData.error
        });

        const code = resData.error?.code;
        const msg = resData.error?.message || "";

        // Token da Meta inválido ou expirado
        if (response.status === 401 || code === 190) {
          return { 
            success: false, 
            error: "Token da Meta inválido ou expirado. Gere um novo token temporário no painel da Meta." 
          };
        }

        // Phone ID incorreto
        if (code === 33 || msg.includes("phone number ID") || msg.includes("Phone number ID")) {
          return { 
            success: false, 
            error: "Phone Number ID inválido. Use a Identificação do número de telefone, não o número de WhatsApp." 
          };
        }

        // Destinatário não autorizado de teste
        if (code === 2651 || msg.includes("recipient") || msg.includes("sandbox") || msg.includes("allowed")) {
          return { 
            success: false, 
            error: "Este número ainda não está autorizado como destinatário de teste na Meta." 
          };
        }

        const errMsg = resData.error?.message || response.statusText || "Erro na Meta Cloud API";
        return { success: false, error: errMsg };
      }

      return { success: true, messageId: resData.messages?.[0]?.id };
    } catch (e: any) {
      console.error("[Meta Request Network Error]:", e);
      return { success: false, error: e.message || "Erro de rede ao conectar com a Meta" };
    }
  });

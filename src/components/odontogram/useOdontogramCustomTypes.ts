import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/db";

export type CustomToothStatus = {
  id: string;
  name: string;
  color: string;
  description?: string;
};

export function useOdontogramCustomTypes() {
  const [types, setTypes] = useState<CustomToothStatus[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const user = await getCurrentUser();

      if (!user) {
        return;
      }

      const { data, error } = await supabase
        .from("odontogram_status_types")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        console.warn(
          "Tabela odontogram_status_types pode não existir ainda.",
          error
        );
        return;
      }

      if (data) {
        setTypes(data as CustomToothStatus[]);
      }
    } catch (error) {
      console.error(
        "Erro ao buscar tipos personalizados:",
        error
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addType = async (
    name: string,
    color: string,
    description?: string
  ) => {
    try {
      const user = await getCurrentUser();

      if (!user) {
        throw new Error("Usuário não autenticado.");
      }

      const { data, error } = await supabase
        .from("odontogram_status_types")
        .insert({
          user_id: user.id,
          name,
          color,
          description: description || null,
        })
        .select()
        .single();

      if (error) {
        console.error(
          "Erro ao adicionar situação personalizada:",
          error
        );

        throw error;
      }

      if (!data) {
        throw new Error(
          "Nenhum dado foi retornado ao salvar a situação."
        );
      }

      const newType = data as CustomToothStatus;

      setTypes((prev) => [...prev, newType]);

      return newType;
    } catch (error) {
      console.error(
        "Erro ao adicionar tipo:",
        error
      );

      throw error;
    }
  };

  return {
    types,
    addType,
    loading,
  };
}

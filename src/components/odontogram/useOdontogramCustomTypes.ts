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
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        console.warn(
          "Erro ao carregar situações personalizadas.",
          error
        );
        return;
      }

      if (data) {
        setTypes(
          data as CustomToothStatus[]
        );
      }
    } catch (error) {
      console.error(
        "Erro ao buscar situações personalizadas:",
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
      const user =
        await getCurrentUser();

      if (!user) {
        throw new Error(
          "Usuário não autenticado."
        );
      }

      const { data, error } =
        await supabase
          .from(
            "odontogram_status_types"
          )
          .insert({
            user_id: user.id,
            name: name.trim(),
            color,
            description:
              description || null,
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

      const newType =
        data as CustomToothStatus;

      setTypes((prev) => [
        ...prev,
        newType,
      ]);

      return newType;
    } catch (error) {
      console.error(
        "Erro ao adicionar tipo:",
        error
      );

      throw error;
    }
  };

  const deleteType = async (
    id: string
  ) => {
    try {
      const user =
        await getCurrentUser();

      if (!user) {
        throw new Error(
          "Usuário não autenticado."
        );
      }

      const typeToDelete =
        types.find(
          (type) =>
            type.id === id
        );

      if (!typeToDelete) {
        throw new Error(
          "Situação personalizada não encontrada."
        );
      }

      const { error } =
        await supabase
          .from(
            "odontogram_status_types"
          )
          .delete()
          .eq("id", id)
          .eq(
            "user_id",
            user.id
          );

      if (error) {
        console.error(
          "Erro ao remover situação personalizada:",
          error
        );

        throw error;
      }

      setTypes((prev) =>
        prev.filter(
          (type) =>
            type.id !== id
        )
      );

      return true;
    } catch (error) {
      console.error(
        "Erro ao excluir tipo:",
        error
      );

      throw error;
    }
  };

  return {
    types,
    addType,
    deleteType,
    loading,
    reload: load,
  };
}

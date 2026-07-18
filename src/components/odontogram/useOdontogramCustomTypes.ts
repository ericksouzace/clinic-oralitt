import { useCallback, useEffect, useState } from "react";
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
        setTypes([]);
        return;
      }

      const { data, error } = await supabase
        .from("odontogram_status_types")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Erro ao carregar situações personalizadas:", error);
        return;
      }

      setTypes((data || []) as CustomToothStatus[]);
    } catch (error) {
      console.error("Erro ao buscar situações personalizadas:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addType = async (
    name: string,
    color: string,
    description?: string,
  ): Promise<CustomToothStatus> => {
    const user = await getCurrentUser();

    if (!user) {
      throw new Error("Usuário não autenticado.");
    }

    const normalizedName = name.trim();

    if (!normalizedName) {
      throw new Error("Informe um nome para a situação clínica.");
    }

    const duplicate = types.some(
      (type) =>
        type.name.trim().toLocaleLowerCase("pt-BR") ===
        normalizedName.toLocaleLowerCase("pt-BR"),
    );

    if (duplicate) {
      throw new Error(`A situação "${normalizedName}" já existe.`);
    }

    const { data, error } = await supabase
      .from("odontogram_status_types")
      .insert({
        user_id: user.id,
        name: normalizedName,
        color,
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao adicionar situação personalizada:", error);
      throw error;
    }

    if (!data) {
      throw new Error("Nenhum dado foi retornado ao salvar a situação.");
    }

    const newType = data as CustomToothStatus;
    setTypes((previous) => [...previous, newType]);

    return newType;
  };

  const deleteType = async (id: string): Promise<void> => {
    const user = await getCurrentUser();

    if (!user) {
      throw new Error("Usuário não autenticado.");
    }

    const { error } = await supabase
      .from("odontogram_status_types")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Erro ao excluir situação personalizada:", error);
      throw error;
    }

    setTypes((previous) => previous.filter((type) => type.id !== id));
  };

  return {
    types,
    loading,
    addType,
    deleteType,
    reload: load,
  };
}

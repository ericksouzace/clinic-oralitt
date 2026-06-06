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
      if (!user) return;
      
      const { data, error } = await supabase
        .from("odontogram_status_types")
        .select("*")
        .eq("user_id", user.id);
        
      if (error) {
        // Ignorar se a tabela não existir, apenas loga
        console.warn("Tabela odontogram_status_types pode não existir ainda.", error);
        return;
      }
      
      if (data) {
        setTypes(data as CustomToothStatus[]);
      }
    } catch (e) {
      console.error("Erro ao buscar tipos personalizados:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addType = async (name: string, color: string, description?: string) => {
    try {
      const user = await getCurrentUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("odontogram_status_types")
        .insert({ user_id: user.id, name, color, description })
        .select()
        .single();
        
      if (error) {
        console.error("Erro ao adicionar tipo:", error);
        return null;
      }
      
      if (data) {
        setTypes(prev => [...prev, data as CustomToothStatus]);
        return data as CustomToothStatus;
      }
    } catch (e) {
      console.error("Erro ao adicionar tipo:", e);
    }
    return null;
  };

  return { types, addType, loading };
}

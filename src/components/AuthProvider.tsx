import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  clinic_name: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

async function fetchProfile(userId: string, userEmail?: string | null): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, clinic_name")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[AuthProvider] fetchProfile error:", error.message);
      return null;
    }

    return data ?? null;
  } catch (err) {
    console.warn("[AuthProvider] fetchProfile exception:", err);
    return null;
  }
}

async function touchUserActivity() {
  try {
    const { error } = await (supabase as any).rpc("touch_user_activity");
    if (error) {
      console.warn("[AuthProvider] touch_user_activity error:", error.message);
    }
  } catch (err) {
    console.warn("[AuthProvider] touch_user_activity exception:", err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user.id, user.email);
      setProfile(p);
    }
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (!currentSession?.user) {
          setProfile(null);
          setLoading(false);
          return;
        }

        void touchUserActivity();

        fetchProfile(currentSession.user.id, currentSession.user.email)
          .then((p) => {
            setProfile(p);
          })
          .catch(() => {
            setProfile(null);
          });
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session?.user) {
        setLoading(false);
        return;
      }

      void touchUserActivity();

      fetchProfile(session.user.id, session.user.email)
        .then((p) => {
          setProfile(p);
        })
        .catch(() => {
          setProfile(null);
        })
        .finally(() => {
          setLoading(false);
        });
    }).catch(() => {
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[AuthProvider] signOut error:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

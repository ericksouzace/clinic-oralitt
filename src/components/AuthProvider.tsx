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
      // Don't block auth for profile errors
      console.warn("[AuthProvider] fetchProfile error:", error.message);
      return null;
    }

    return data ?? null;
  } catch (err) {
    console.warn("[AuthProvider] fetchProfile exception:", err);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  // loading starts true and becomes false ONLY once — after the initial session check
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user.id, user.email);
      setProfile(p);
    }
  };

  useEffect(() => {
    // Prevent running twice in React StrictMode
    if (initialized.current) return;
    initialized.current = true;

    // 1. Subscribe FIRST, then check initial session.
    //    This order is important to avoid missing events.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        // Update session and user synchronously
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (!currentSession?.user) {
          setProfile(null);
          // Ensure loading is off if signed out
          setLoading(false);
          return;
        }

        // Fetch profile asynchronously without blocking the session update
        // and without setting loading=true (that causes the infinite spinner)
        fetchProfile(currentSession.user.id, currentSession.user.email)
          .then((p) => {
            setProfile(p);
          })
          .catch(() => {
            setProfile(null);
          });
      }
    );

    // 2. Manually get the current session once to initialize state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session?.user) {
        setLoading(false);
        return;
      }

      fetchProfile(session.user.id, session.user.email)
        .then((p) => {
          setProfile(p);
        })
        .catch(() => {
          setProfile(null);
        })
        .finally(() => {
          // Only set loading=false here, after the initial check
          setLoading(false);
        });
    }).catch(() => {
      // Even if getSession fails, unblock the UI
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []); // Empty deps — runs only once on mount

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[AuthProvider] signOut error:", err);
    }
    // State will be cleared by onAuthStateChange listener above
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

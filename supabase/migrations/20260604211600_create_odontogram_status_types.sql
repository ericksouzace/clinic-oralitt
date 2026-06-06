CREATE TABLE IF NOT EXISTS public.odontogram_status_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.odontogram_status_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own odontogram status types"
  ON public.odontogram_status_types
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

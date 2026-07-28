-- Oralit: status clínico ampliado e preferência de emissão de nota fiscal.
-- Esta migração é idempotente e pode ser executada mais de uma vez.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS invoice_preference boolean;

-- Normaliza dados antigos antes de aplicar a nova validação.
UPDATE public.patients
SET status = CASE
  WHEN status IS NULL OR btrim(status) = '' THEN 'em tratamento'
  WHEN lower(btrim(status)) = 'ativo' THEN 'em tratamento'
  WHEN lower(btrim(status)) = 'retorno' THEN 'em acompanhamento'
  WHEN lower(btrim(status)) IN (
    'inativo',
    'em tratamento',
    'em acompanhamento',
    'marcar c/ parceiros'
  ) THEN lower(btrim(status))
  ELSE 'inativo'
END;

-- Remove somente CHECK constraints da tabela patients que façam referência à coluna status.
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'patients'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS %I',
      constraint_name
    );
  END LOOP;
END $$;

ALTER TABLE public.patients
  ALTER COLUMN status SET DEFAULT 'em tratamento';

ALTER TABLE public.patients
  DROP CONSTRAINT IF EXISTS patients_status_check;

ALTER TABLE public.patients
  ADD CONSTRAINT patients_status_check
  CHECK (
    status IN (
      'inativo',
      'em tratamento',
      'em acompanhamento',
      'marcar c/ parceiros'
    )
  );

COMMENT ON COLUMN public.patients.invoice_preference IS
  'Preferência do paciente quanto à emissão de nota fiscal: true = sim, false = não, null = não informado.';

-- Migration Incremental: Permitir arquivos sem vínculo com paciente (ex: Notas de Estoque, Recibos Financeiros)
ALTER TABLE patient_files ALTER COLUMN patient_id DROP NOT NULL;

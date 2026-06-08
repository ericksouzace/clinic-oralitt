-- Create patient_files table
CREATE TABLE IF NOT EXISTS patient_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'foto_clinica' or 'documento'
  category TEXT NOT NULL, -- 'intraoral', 'exame', etc
  status TEXT DEFAULT 'ativo',
  notes TEXT,
  -- OCR Fields
  ocr_status TEXT DEFAULT 'pendente',
  extracted_text TEXT,
  ocr_destination_suggestion TEXT,
  is_ocr_processed BOOLEAN DEFAULT false,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indices
CREATE INDEX idx_patient_files_user_id ON patient_files(user_id);
CREATE INDEX idx_patient_files_patient_id ON patient_files(patient_id);
CREATE INDEX idx_patient_files_file_type ON patient_files(file_type);

-- RLS
ALTER TABLE patient_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own patient files" 
  ON patient_files FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own patient files" 
  ON patient_files FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patient files" 
  ON patient_files FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patient files" 
  ON patient_files FOR DELETE 
  USING (auth.uid() = user_id);

-- Storage bucket creation (if not exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('patient-files', 'patient-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for Storage Bucket
CREATE POLICY "Users can view their own files in bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'patient-files' AND (auth.uid())::text = (string_to_array(name, '/'))[1]);

CREATE POLICY "Users can upload their own files in bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'patient-files' AND (auth.uid())::text = (string_to_array(name, '/'))[1]);

CREATE POLICY "Users can update their own files in bucket"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'patient-files' AND (auth.uid())::text = (string_to_array(name, '/'))[1]);

CREATE POLICY "Users can delete their own files in bucket"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'patient-files' AND (auth.uid())::text = (string_to_array(name, '/'))[1]);

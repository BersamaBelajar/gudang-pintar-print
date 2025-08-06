-- Menambahkan kolom divisi ke tabel delivery_notes
ALTER TABLE public.delivery_notes ADD COLUMN division TEXT NOT NULL DEFAULT 'Umum';

-- Update data existing dengan divisi default
UPDATE public.delivery_notes SET division = 'Umum' WHERE division IS NULL;
-- Menambahkan kolom divisi ke tabel approval_levels
ALTER TABLE public.approval_levels ADD COLUMN division TEXT NOT NULL DEFAULT 'Umum';

-- Update data existing dengan divisi default
UPDATE public.approval_levels SET division = 'Umum' WHERE division IS NULL;
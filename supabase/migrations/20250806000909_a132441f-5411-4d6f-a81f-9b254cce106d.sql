-- Membuat tabel untuk management divisi
CREATE TABLE public.divisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS untuk tabel divisi
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;

-- Create policy untuk divisi
CREATE POLICY "Allow all operations on divisions" 
ON public.divisions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Insert default divisi
INSERT INTO public.divisions (name, description) VALUES 
  ('Umum', 'Divisi umum untuk keperluan general'),
  ('Produksi', 'Divisi produksi dan manufacturing'),
  ('Marketing', 'Divisi pemasaran dan penjualan'),
  ('Keuangan', 'Divisi keuangan dan akuntansi'),
  ('HR', 'Divisi sumber daya manusia'),
  ('IT', 'Divisi teknologi informasi');

-- Menambahkan 2 level approval baru (level 6 dan 7)
INSERT INTO public.approval_levels (name, email, division, level_order) VALUES 
  ('Vice President', 'vp@company.com', 'Umum', 6),
  ('President Director', 'president@company.com', 'Umum', 7);

-- Trigger untuk update timestamp divisi
CREATE TRIGGER update_divisions_updated_at
BEFORE UPDATE ON public.divisions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
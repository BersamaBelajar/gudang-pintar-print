-- Menambahkan level approval 4 dan 5 untuk melengkapi sistem approval berjenjang
INSERT INTO public.approval_levels (name, email, level_order) VALUES 
  ('General Manager', 'gm@company.com', 4),
  ('CEO', 'ceo@company.com', 5);
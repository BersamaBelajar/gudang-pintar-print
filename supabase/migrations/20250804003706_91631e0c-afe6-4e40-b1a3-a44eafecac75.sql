-- Create approval levels table
CREATE TABLE public.approval_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  level_order INTEGER NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create delivery note approvals table
CREATE TABLE public.delivery_note_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_note_id UUID NOT NULL,
  approval_level_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_delivery_note FOREIGN KEY (delivery_note_id) REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  CONSTRAINT fk_approval_level FOREIGN KEY (approval_level_id) REFERENCES public.approval_levels(id) ON DELETE CASCADE,
  CONSTRAINT check_approval_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Enable RLS
ALTER TABLE public.approval_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_note_approvals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations on approval_levels" 
ON public.approval_levels 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all operations on delivery_note_approvals" 
ON public.delivery_note_approvals 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add approval status to delivery_notes
ALTER TABLE public.delivery_notes 
ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending_approval';

ALTER TABLE public.delivery_notes 
ADD CONSTRAINT check_approval_status CHECK (approval_status IN ('pending_approval', 'approved', 'rejected', 'completed'));

-- Create trigger for updated_at columns
CREATE TRIGGER update_approval_levels_updated_at
BEFORE UPDATE ON public.approval_levels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_delivery_note_approvals_updated_at
BEFORE UPDATE ON public.delivery_note_approvals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default approval levels
INSERT INTO public.approval_levels (name, level_order, email) VALUES
('Supervisor', 1, 'supervisor@company.com'),
('Manager', 2, 'manager@company.com'),
('Director', 3, 'director@company.com');

-- Create function to initialize approvals for new delivery notes
CREATE OR REPLACE FUNCTION public.initialize_delivery_note_approvals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create approval records for all levels
  INSERT INTO public.delivery_note_approvals (delivery_note_id, approval_level_id)
  SELECT NEW.id, al.id
  FROM public.approval_levels al
  ORDER BY al.level_order;
  
  RETURN NEW;
END;
$$;

-- Create trigger to initialize approvals
CREATE TRIGGER create_delivery_note_approvals
  AFTER INSERT ON public.delivery_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_delivery_note_approvals();
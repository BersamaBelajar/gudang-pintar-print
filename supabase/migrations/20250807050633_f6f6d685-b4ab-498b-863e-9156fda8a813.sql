-- Fix the duplicate key issue by removing the unique constraint on level_order
-- and adding a composite unique constraint on division + level_order instead
ALTER TABLE public.approval_levels DROP CONSTRAINT IF EXISTS approval_levels_level_order_key;

-- Add composite unique constraint to allow same level_order across different divisions
ALTER TABLE public.approval_levels ADD CONSTRAINT approval_levels_division_level_order_key UNIQUE (division, level_order);

-- Ensure the trigger exists for initializing delivery note approvals
DROP TRIGGER IF EXISTS create_delivery_note_approvals ON public.delivery_notes;

CREATE TRIGGER create_delivery_note_approvals
  AFTER INSERT ON public.delivery_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_delivery_note_approvals();
-- Update function untuk create approval records berdasarkan divisi
CREATE OR REPLACE FUNCTION public.initialize_delivery_note_approvals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Create approval records only for the same division as delivery note
  INSERT INTO public.delivery_note_approvals (delivery_note_id, approval_level_id)
  SELECT NEW.id, al.id
  FROM public.approval_levels al
  WHERE al.division = NEW.division
  ORDER BY al.level_order;
  
  RETURN NEW;
END;
$function$;
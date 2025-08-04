-- Fix security issues by setting search_path for functions

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_product_stock function
CREATE OR REPLACE FUNCTION public.update_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Handle INSERT operations
  IF TG_OP = 'INSERT' THEN
    IF NEW.transaction_type = 'in' THEN
      UPDATE public.products 
      SET stock_quantity = stock_quantity + NEW.quantity 
      WHERE id = NEW.product_id;
    ELSIF NEW.transaction_type = 'out' THEN
      UPDATE public.products 
      SET stock_quantity = stock_quantity - NEW.quantity 
      WHERE id = NEW.product_id;
    ELSIF NEW.transaction_type = 'adjustment' THEN
      UPDATE public.products 
      SET stock_quantity = NEW.quantity 
      WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
  END IF;
  
  -- Handle DELETE operations (restore stock)
  IF TG_OP = 'DELETE' THEN
    IF OLD.transaction_type = 'in' THEN
      UPDATE public.products 
      SET stock_quantity = stock_quantity - OLD.quantity 
      WHERE id = OLD.product_id;
    ELSIF OLD.transaction_type = 'out' THEN
      UPDATE public.products 
      SET stock_quantity = stock_quantity + OLD.quantity 
      WHERE id = OLD.product_id;
    -- For adjustment, we don't reverse since it's absolute value
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Fix initialize_delivery_note_approvals function
CREATE OR REPLACE FUNCTION public.initialize_delivery_note_approvals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
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
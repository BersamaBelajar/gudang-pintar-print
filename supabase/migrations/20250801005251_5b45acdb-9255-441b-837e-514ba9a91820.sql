-- Add trigger for DELETE operations to restore stock when transactions are deleted
CREATE OR REPLACE FUNCTION public.update_product_stock()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$;

-- Create triggers for both INSERT and DELETE operations
DROP TRIGGER IF EXISTS update_stock_on_transaction ON public.stock_transactions;

CREATE TRIGGER update_stock_on_transaction
  AFTER INSERT OR DELETE ON public.stock_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_stock();
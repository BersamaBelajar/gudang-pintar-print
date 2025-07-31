-- Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create suppliers table  
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id),
  unit TEXT NOT NULL DEFAULT 'pcs',
  purchase_price DECIMAL(15,2) DEFAULT 0,
  selling_price DECIMAL(15,2) DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stock transactions table
CREATE TABLE public.stock_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('in', 'out', 'adjustment')),
  quantity INTEGER NOT NULL,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create delivery notes table
CREATE TABLE public.delivery_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_address TEXT,
  customer_phone TEXT,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'delivered')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create delivery note items table
CREATE TABLE public.delivery_note_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_note_id UUID REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantity INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_note_items ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust based on your auth requirements)
CREATE POLICY "Allow all operations on categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on stock_transactions" ON public.stock_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on delivery_notes" ON public.delivery_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on delivery_note_items" ON public.delivery_note_items FOR ALL USING (true) WITH CHECK (true);

-- Create update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_delivery_notes_updated_at BEFORE UPDATE ON public.delivery_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to update product stock
CREATE OR REPLACE FUNCTION public.update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
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
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update stock
CREATE TRIGGER update_stock_on_transaction 
  AFTER INSERT ON public.stock_transactions 
  FOR EACH ROW EXECUTE FUNCTION public.update_product_stock();

-- Insert sample data
INSERT INTO public.categories (name, description) VALUES 
  ('Elektronik', 'Peralatan elektronik'),
  ('Furniture', 'Perabotan rumah tangga'),
  ('Makanan', 'Produk makanan dan minuman');

INSERT INTO public.suppliers (name, contact_person, phone, email, address) VALUES 
  ('PT. Supplier Utama', 'John Doe', '081234567890', 'john@supplier.com', 'Jl. Raya No. 123, Jakarta'),
  ('CV. Mitra Jaya', 'Jane Smith', '081987654321', 'jane@mitra.com', 'Jl. Sudirman No. 456, Surabaya');
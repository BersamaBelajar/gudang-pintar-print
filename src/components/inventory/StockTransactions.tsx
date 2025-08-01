import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Plus, TrendingUp, TrendingDown, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StockTransaction {
  id: string;
  product_id: string;
  transaction_type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reference_number: string;
  notes: string;
  created_at: string;
  products?: {
    name: string;
    code: string;
  };
}

interface Product {
  id: string;
  name: string;
  code: string;
  stock_quantity: number;
}

const StockTransactions = () => {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    product_id: "",
    transaction_type: "in" as 'in' | 'out' | 'adjustment',
    quantity: 0,
    reference_number: "",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchTransactions();
    fetchProducts();
  }, []);

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_transactions')
        .select('*, products(name, code)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setTransactions(data as StockTransaction[] || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data transaksi",
        variant: "destructive",
      });
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, code, stock_quantity')
        .order('name');
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate stock for outgoing transactions
    if (formData.transaction_type === 'out') {
      const product = products.find(p => p.id === formData.product_id);
      if (product && product.stock_quantity < formData.quantity) {
        toast({
          title: "Error",
          description: `Stok ${product.name} tidak mencukupi. Stok tersedia: ${product.stock_quantity}`,
          variant: "destructive",
        });
        return;
      }
    }
    
    try {
      const { error } = await supabase
        .from('stock_transactions')
        .insert([formData]);
      
      if (error) throw error;
      
      toast({
        title: "Berhasil",
        description: "Transaksi stok berhasil ditambahkan",
      });
      
      fetchTransactions();
      fetchProducts(); // Refresh to see updated stock
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan transaksi",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      product_id: "",
      transaction_type: "in",
      quantity: 0,
      reference_number: "",
      notes: "",
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'in':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'out':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'adjustment':
        return <RotateCcw className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getTransactionTypeText = (type: string) => {
    switch (type) {
      case 'in':
        return 'Masuk';
      case 'out':
        return 'Keluar';
      case 'adjustment':
        return 'Penyesuaian';
      default:
        return type;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Transaksi Stok</CardTitle>
            <CardDescription>Kelola pergerakan stok produk</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Transaksi
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Transaksi Stok</DialogTitle>
                <DialogDescription>
                  Isi form di bawah untuk menambah transaksi stok
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="product">Produk</Label>
                  <Select value={formData.product_id} onValueChange={(value) => setFormData({ ...formData, product_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih produk" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.code} - {product.name} (Stok: {product.stock_quantity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="transaction_type">Jenis Transaksi</Label>
                  <Select value={formData.transaction_type} onValueChange={(value: 'in' | 'out' | 'adjustment') => setFormData({ ...formData, transaction_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">Stok Masuk</SelectItem>
                      <SelectItem value="out">Stok Keluar</SelectItem>
                      <SelectItem value="adjustment">Penyesuaian Stok</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="quantity">
                    {formData.transaction_type === 'adjustment' ? 'Stok Baru' : 'Jumlah'}
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                    required
                  />
                  {formData.transaction_type === 'adjustment' && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Masukkan jumlah stok yang diinginkan (bukan selisih)
                    </p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="reference_number">Nomor Referensi</Label>
                  <Input
                    id="reference_number"
                    value={formData.reference_number}
                    onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                    placeholder="Contoh: PO-001, DO-002, ADJ-003"
                  />
                </div>
                
                <div>
                  <Label htmlFor="notes">Catatan</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Catatan tambahan (opsional)"
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit">
                    Simpan
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Referensi</TableHead>
              <TableHead>Catatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>{new Date(transaction.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{transaction.products?.name}</div>
                    <div className="text-sm text-muted-foreground">{transaction.products?.code}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getTransactionIcon(transaction.transaction_type)}
                    {getTransactionTypeText(transaction.transaction_type)}
                  </div>
                </TableCell>
                <TableCell>
                  <span className={
                    transaction.transaction_type === 'in' ? 'text-green-600' :
                    transaction.transaction_type === 'out' ? 'text-red-600' :
                    'text-blue-600'
                  }>
                    {transaction.transaction_type === 'in' ? '+' : 
                     transaction.transaction_type === 'out' ? '-' : ''}
                    {transaction.quantity}
                  </span>
                </TableCell>
                <TableCell>{transaction.reference_number || '-'}</TableCell>
                <TableCell>{transaction.notes || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default StockTransactions;
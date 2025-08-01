import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit, Trash2, FileText, Printer, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DeliveryNote {
  id: string;
  delivery_number: string;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  delivery_date: string;
  notes: string;
  status: 'draft' | 'sent' | 'delivered';
  created_at: string;
}

interface DeliveryNoteItem {
  id: string;
  delivery_note_id: string;
  product_id: string;
  quantity: number;
  notes: string;
  products?: {
    name: string;
    code: string;
    unit: string;
  };
}

interface Product {
  id: string;
  name: string;
  code: string;
  unit: string;
  stock_quantity: number;
}

const DeliveryNoteManagement = () => {
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<DeliveryNoteItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<DeliveryNote | null>(null);
  const [viewingNote, setViewingNote] = useState<DeliveryNote | null>(null);
  const [formData, setFormData] = useState({
    delivery_number: "",
    customer_name: "",
    customer_address: "",
    customer_phone: "",
    delivery_date: new Date().toISOString().split('T')[0],
    notes: "",
    status: "draft" as 'draft' | 'sent' | 'delivered',
  });
  const [itemFormData, setItemFormData] = useState({
    product_id: "",
    quantity: 0,
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchDeliveryNotes();
    fetchProducts();
  }, []);

  const fetchDeliveryNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_notes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setDeliveryNotes(data as DeliveryNote[] || []);
    } catch (error) {
      console.error('Error fetching delivery notes:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data surat jalan",
        variant: "destructive",
      });
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, code, unit, stock_quantity')
        .order('name');
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchDeliveryNoteItems = async (deliveryNoteId: string) => {
    try {
      const { data, error } = await supabase
        .from('delivery_note_items')
        .select('*, products(name, code, unit)')
        .eq('delivery_note_id', deliveryNoteId);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching delivery note items:', error);
      return [];
    }
  };

  const generateDeliveryNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `SJ-${year}${month}${day}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedItems.length === 0) {
      toast({
        title: "Error",
        description: "Tambahkan minimal satu item produk",
        variant: "destructive",
      });
      return;
    }

    // Validate stock availability for new delivery notes or when updating draft notes
    if (!editingNote || editingNote.status === 'draft') {
      for (const item of selectedItems) {
        const product = products.find(p => p.id === item.product_id);
        if (product && product.stock_quantity < item.quantity) {
          toast({
            title: "Error",
            description: `Stok ${product.name} tidak mencukupi. Stok tersedia: ${product.stock_quantity}`,
            variant: "destructive",
          });
          return;
        }
      }
    }
    
    try {
      let deliveryNoteId = editingNote?.id;
      
      if (editingNote) {
        // Delete existing stock transactions if editing
        await supabase
          .from('stock_transactions')
          .delete()
          .eq('reference_number', editingNote.delivery_number);

        const { error } = await supabase
          .from('delivery_notes')
          .update(formData)
          .eq('id', editingNote.id);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('delivery_notes')
          .insert([{ ...formData, delivery_number: generateDeliveryNumber() }])
          .select()
          .single();
        
        if (error) throw error;
        deliveryNoteId = data.id;
      }
      
      // Delete existing items if editing
      if (editingNote) {
        await supabase
          .from('delivery_note_items')
          .delete()
          .eq('delivery_note_id', editingNote.id);
      }
      
      // Insert new items
      const itemsToInsert = selectedItems.map(item => ({
        delivery_note_id: deliveryNoteId,
        product_id: item.product_id,
        quantity: item.quantity,
        notes: item.notes,
      }));
      
      const { error: itemsError } = await supabase
        .from('delivery_note_items')
        .insert(itemsToInsert);
      
      if (itemsError) throw itemsError;
      
      // Create stock out transactions for each item
      if (!editingNote || editingNote.status === 'draft') {
        const stockTransactions = selectedItems.map(item => ({
          product_id: item.product_id,
          transaction_type: 'out',
          quantity: item.quantity,
          reference_number: formData.delivery_number || (editingNote ? editingNote.delivery_number : generateDeliveryNumber()),
          notes: `Surat Jalan: ${formData.customer_name}`,
        }));
        
        await supabase
          .from('stock_transactions')
          .insert(stockTransactions);
      }
      
      toast({
        title: "Berhasil",
        description: editingNote ? "Surat jalan berhasil diupdate" : "Surat jalan berhasil dibuat",
      });
      
      fetchDeliveryNotes();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving delivery note:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan surat jalan",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async (note: DeliveryNote) => {
    setEditingNote(note);
    setFormData({
      delivery_number: note.delivery_number,
      customer_name: note.customer_name,
      customer_address: note.customer_address || "",
      customer_phone: note.customer_phone || "",
      delivery_date: note.delivery_date,
      notes: note.notes || "",
      status: note.status,
    });
    
    const items = await fetchDeliveryNoteItems(note.id);
    setSelectedItems(items as DeliveryNoteItem[]);
    setIsDialogOpen(true);
  };

  const handleView = async (note: DeliveryNote) => {
    setViewingNote(note);
    const items = await fetchDeliveryNoteItems(note.id);
    setSelectedItems(items as DeliveryNoteItem[]);
    setIsViewDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus surat jalan ini?')) return;
    
    try {
      const { error } = await supabase
        .from('delivery_notes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      fetchDeliveryNotes();
      toast({
        title: "Berhasil",
        description: "Surat jalan berhasil dihapus",
      });
    } catch (error) {
      console.error('Error deleting delivery note:', error);
      toast({
        title: "Error",
        description: "Gagal menghapus surat jalan",
        variant: "destructive",
      });
    }
  };

  const addItem = () => {
    if (!itemFormData.product_id || itemFormData.quantity <= 0) {
      toast({
        title: "Error",
        description: "Pilih produk dan masukkan jumlah yang valid",
        variant: "destructive",
      });
      return;
    }
    
    const product = products.find(p => p.id === itemFormData.product_id);
    if (!product) return;
    
    const newItem: DeliveryNoteItem = {
      id: Date.now().toString(),
      delivery_note_id: "",
      product_id: itemFormData.product_id,
      quantity: itemFormData.quantity,
      notes: itemFormData.notes,
      products: {
        name: product.name,
        code: product.code,
        unit: product.unit,
      },
    };
    
    setSelectedItems([...selectedItems, newItem]);
    setItemFormData({ product_id: "", quantity: 0, notes: "" });
  };

  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setFormData({
      delivery_number: "",
      customer_name: "",
      customer_address: "",
      customer_phone: "",
      delivery_date: new Date().toISOString().split('T')[0],
      notes: "",
      status: "draft",
    });
    setSelectedItems([]);
    setEditingNote(null);
  };

  const printDeliveryNote = (note: DeliveryNote) => {
    // Create print content
    const printContent = `
      <html>
        <head>
          <title>Surat Jalan - ${note.delivery_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .info { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .signature { margin-top: 50px; display: flex; justify-content: space-between; }
            .signature div { width: 200px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>SURAT JALAN</h1>
            <h3>No: ${note.delivery_number}</h3>
          </div>
          
          <div class="info">
            <p><strong>Kepada:</strong></p>
            <p>${note.customer_name}</p>
            <p>${note.customer_address || ''}</p>
            <p>Telp: ${note.customer_phone || ''}</p>
            <br>
            <p><strong>Tanggal Kirim:</strong> ${new Date(note.delivery_date).toLocaleDateString()}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Kode Barang</th>
                <th>Nama Barang</th>
                <th>Jumlah</th>
                <th>Satuan</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody id="items">
            </tbody>
          </table>
          
          <div class="signature">
            <div>
              <p>Yang Mengirim</p>
              <br><br><br>
              <p>(_________________)</p>
            </div>
            <div>
              <p>Yang Menerima</p>
              <br><br><br>
              <p>(_________________)</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      
      // Add items to table
      fetchDeliveryNoteItems(note.id).then(items => {
        const tbody = printWindow.document.getElementById('items') as HTMLTableSectionElement;
        if (tbody) {
          items.forEach((item, index) => {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = (index + 1).toString();
            row.insertCell(1).textContent = item.products?.code || '';
            row.insertCell(2).textContent = item.products?.name || '';
            row.insertCell(3).textContent = item.quantity.toString();
            row.insertCell(4).textContent = item.products?.unit || '';
            row.insertCell(5).textContent = item.notes || '';
          });
        }
        
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'sent':
        return <Badge variant="default">Terkirim</Badge>;
      case 'delivered':
        return <Badge variant="secondary">Diterima</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Surat Jalan</CardTitle>
            <CardDescription>Kelola surat jalan pengiriman barang</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Buat Surat Jalan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingNote ? 'Edit Surat Jalan' : 'Buat Surat Jalan Baru'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customer_name">Nama Customer</Label>
                    <Input
                      id="customer_name"
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="delivery_date">Tanggal Kirim</Label>
                    <Input
                      id="delivery_date"
                      type="date"
                      value={formData.delivery_date}
                      onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="customer_address">Alamat Customer</Label>
                  <Textarea
                    id="customer_address"
                    value={formData.customer_address}
                    onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="customer_phone">Telepon Customer</Label>
                  <Input
                    id="customer_phone"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label>Items</Label>
                  <div className="border rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <Label>Produk</Label>
                        <Select value={itemFormData.product_id} onValueChange={(value) => setItemFormData({ ...itemFormData, product_id: value })}>
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
                      <div className="col-span-2">
                        <Label>Jumlah</Label>
                        <Input
                          type="number"
                          value={itemFormData.quantity}
                          onChange={(e) => setItemFormData({ ...itemFormData, quantity: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="col-span-3">
                        <Label>Keterangan</Label>
                        <Input
                          value={itemFormData.notes}
                          onChange={(e) => setItemFormData({ ...itemFormData, notes: e.target.value })}
                        />
                      </div>
                      <div className="col-span-2">
                        <Button type="button" onClick={addItem}>Tambah</Button>
                      </div>
                    </div>
                    
                    {selectedItems.length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produk</TableHead>
                            <TableHead>Jumlah</TableHead>
                            <TableHead>Keterangan</TableHead>
                            <TableHead>Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedItems.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.products?.code} - {item.products?.name}</TableCell>
                              <TableCell>{item.quantity} {item.products?.unit}</TableCell>
                              <TableCell>{item.notes || '-'}</TableCell>
                              <TableCell>
                                <Button size="sm" variant="outline" onClick={() => removeItem(index)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="notes">Catatan</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit">
                    {editingNote ? 'Update' : 'Simpan'}
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
              <TableHead>No. Surat Jalan</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Tanggal Kirim</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveryNotes.map((note) => (
              <TableRow key={note.id}>
                <TableCell className="font-medium">{note.delivery_number}</TableCell>
                <TableCell>{note.customer_name}</TableCell>
                <TableCell>{new Date(note.delivery_date).toLocaleDateString()}</TableCell>
                <TableCell>{getStatusBadge(note.status)}</TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" onClick={() => handleView(note)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleEdit(note)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => printDeliveryNote(note)}>
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(note.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Surat Jalan - {viewingNote?.delivery_number}</DialogTitle>
          </DialogHeader>
          {viewingNote && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer</Label>
                  <p className="font-medium">{viewingNote.customer_name}</p>
                </div>
                <div>
                  <Label>Tanggal Kirim</Label>
                  <p className="font-medium">{new Date(viewingNote.delivery_date).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div>
                <Label>Alamat</Label>
                <p>{viewingNote.customer_address || '-'}</p>
              </div>
              
              <div>
                <Label>Items</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk</TableHead>
                      <TableHead>Jumlah</TableHead>
                      <TableHead>Keterangan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.products?.code} - {item.products?.name}</TableCell>
                        <TableCell>{item.quantity} {item.products?.unit}</TableCell>
                        <TableCell>{item.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={() => printDeliveryNote(viewingNote)}>
                  <Printer className="h-4 w-4 mr-2" />
                  Cetak
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default DeliveryNoteManagement;
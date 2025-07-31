import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  created_at: string;
}

const SupplierManagement = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data supplier",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update(formData)
          .eq('id', editingSupplier.id);
        
        if (error) throw error;
        
        toast({
          title: "Berhasil",
          description: "Supplier berhasil diupdate",
        });
      } else {
        const { error } = await supabase
          .from('suppliers')
          .insert([formData]);
        
        if (error) throw error;
        
        toast({
          title: "Berhasil",
          description: "Supplier berhasil ditambahkan",
        });
      }
      
      fetchSuppliers();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan supplier",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus supplier ini?')) return;
    
    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      fetchSuppliers();
      toast({
        title: "Berhasil",
        description: "Supplier berhasil dihapus",
      });
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast({
        title: "Error",
        description: "Gagal menghapus supplier",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      contact_person: "",
      phone: "",
      email: "",
      address: "",
    });
    setEditingSupplier(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Manajemen Supplier</CardTitle>
            <CardDescription>Kelola data supplier Anda</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Supplier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSupplier ? 'Edit Supplier' : 'Tambah Supplier Baru'}
                </DialogTitle>
                <DialogDescription>
                  Isi form di bawah untuk {editingSupplier ? 'mengupdate' : 'menambah'} supplier
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nama Supplier</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="contact_person">Nama Kontak</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Nomor Telepon</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="address">Alamat</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit">
                    {editingSupplier ? 'Update' : 'Simpan'}
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
              <TableHead>Nama Supplier</TableHead>
              <TableHead>Kontak Person</TableHead>
              <TableHead>Telepon</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Alamat</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-medium">{supplier.name}</TableCell>
                <TableCell>{supplier.contact_person || '-'}</TableCell>
                <TableCell>{supplier.phone || '-'}</TableCell>
                <TableCell>{supplier.email || '-'}</TableCell>
                <TableCell>{supplier.address || '-'}</TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(supplier)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(supplier.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default SupplierManagement;
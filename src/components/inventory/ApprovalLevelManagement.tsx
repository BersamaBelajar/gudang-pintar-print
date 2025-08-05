import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ApprovalLevel {
  id: string;
  name: string;
  email: string;
  level_order: number;
  created_at: string;
  updated_at: string;
}

const ApprovalLevelManagement = () => {
  const [approvalLevels, setApprovalLevels] = useState<ApprovalLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<ApprovalLevel | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    level_order: 1
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchApprovalLevels();
  }, []);

  const fetchApprovalLevels = async () => {
    try {
      const { data, error } = await supabase
        .from('approval_levels')
        .select('*')
        .order('level_order', { ascending: true });

      if (error) throw error;
      setApprovalLevels(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Gagal memuat data approval levels",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingLevel) {
        // Update existing level
        const { error } = await supabase
          .from('approval_levels')
          .update({
            name: formData.name,
            email: formData.email,
            level_order: formData.level_order
          })
          .eq('id', editingLevel.id);

        if (error) throw error;

        toast({
          title: "Sukses",
          description: "Approval level berhasil diupdate",
        });
      } else {
        // Create new level
        const { error } = await supabase
          .from('approval_levels')
          .insert([{
            name: formData.name,
            email: formData.email,
            level_order: formData.level_order
          }]);

        if (error) throw error;

        toast({
          title: "Sukses",
          description: "Approval level berhasil ditambahkan",
        });
      }

      fetchApprovalLevels();
      resetForm();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (level: ApprovalLevel) => {
    setEditingLevel(level);
    setFormData({
      name: level.name,
      email: level.email,
      level_order: level.level_order
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus approval level ini?")) return;

    try {
      const { error } = await supabase
        .from('approval_levels')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sukses",
        description: "Approval level berhasil dihapus",
      });

      fetchApprovalLevels();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal menghapus approval level",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      level_order: approvalLevels.length + 1
    });
    setEditingLevel(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  if (loading && approvalLevels.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Management Approval Level
              </CardTitle>
              <CardDescription>
                Kelola tingkat persetujuan untuk surat jalan
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAddDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Level
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>
                      {editingLevel ? "Edit Approval Level" : "Tambah Approval Level"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingLevel ? "Update informasi approval level" : "Tambahkan level persetujuan baru"}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Nama Jabatan</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Contoh: Supervisor"
                        required
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="contoh@company.com"
                        required
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="level_order">Urutan Level</Label>
                      <Input
                        id="level_order"
                        type="number"
                        min="1"
                        value={formData.level_order}
                        onChange={(e) => setFormData({ ...formData, level_order: parseInt(e.target.value) })}
                        required
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {editingLevel ? "Update" : "Tambah"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead>Nama Jabatan</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvalLevels.map((level) => (
                <TableRow key={level.id}>
                  <TableCell>
                    <Badge variant="secondary">Level {level.level_order}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{level.name}</TableCell>
                  <TableCell>{level.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-green-600">
                      Aktif
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(level)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(level.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {approvalLevels.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Belum ada approval level. Tambahkan level pertama.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informasi Sistem Approval</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Setiap surat jalan akan melalui proses approval secara berurutan sesuai level yang telah ditentukan</p>
            <p>• Email notifikasi akan dikirim ke setiap level approval ketika ada surat jalan yang perlu disetujui</p>
            <p>• Level 1 akan mendapat notifikasi pertama, kemudian berlanjut ke level berikutnya setelah approval</p>
            <p>• Jika ada level yang menolak, proses approval akan dihentikan</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApprovalLevelManagement;
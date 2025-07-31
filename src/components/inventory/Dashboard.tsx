import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Package, FileText, Users, TrendingDown } from "lucide-react";

interface DashboardStats {
  totalProducts: number;
  lowStockProducts: number;
  totalSuppliers: number;
  totalDeliveryNotes: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    lowStockProducts: 0,
    totalSuppliers: 0,
    totalDeliveryNotes: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get total products
        const { count: productsCount } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true });

        // Get low stock products (stock <= min_stock)
        const { count: lowStockCount } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .lte('stock_quantity', 'min_stock');

        // Get total suppliers
        const { count: suppliersCount } = await supabase
          .from('suppliers')
          .select('*', { count: 'exact', head: true });

        // Get total delivery notes
        const { count: deliveryNotesCount } = await supabase
          .from('delivery_notes')
          .select('*', { count: 'exact', head: true });

        setStats({
          totalProducts: productsCount || 0,
          lowStockProducts: lowStockCount || 0,
          totalSuppliers: suppliersCount || 0,
          totalDeliveryNotes: deliveryNotesCount || 0,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Produk</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stok Menipis</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.lowStockProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Supplier</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSuppliers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Surat Jalan</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDeliveryNotes}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selamat Datang di Sistem Inventory</CardTitle>
          <CardDescription>
            Kelola produk, stok, supplier, dan surat jalan Anda dengan mudah.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Gunakan menu di atas untuk navigasi ke berbagai fitur yang tersedia.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
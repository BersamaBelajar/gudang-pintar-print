import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, FileText, Users, TrendingUp } from "lucide-react";
import ProductManagement from "@/components/inventory/ProductManagement";
import CategoryManagement from "@/components/inventory/CategoryManagement";
import SupplierManagement from "@/components/inventory/SupplierManagement";
import DeliveryNoteManagement from "@/components/inventory/DeliveryNoteManagement";
import StockTransactions from "@/components/inventory/StockTransactions";
import Dashboard from "@/components/inventory/Dashboard";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Sistem Inventory</h1>
          <p className="text-muted-foreground">Kelola inventory dan surat jalan Anda</p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produk
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Kategori
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Supplier
            </TabsTrigger>
            <TabsTrigger value="stock" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Transaksi Stok
            </TabsTrigger>
            <TabsTrigger value="delivery" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Surat Jalan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Dashboard />
          </TabsContent>

          <TabsContent value="products">
            <ProductManagement />
          </TabsContent>

          <TabsContent value="categories">
            <CategoryManagement />
          </TabsContent>

          <TabsContent value="suppliers">
            <SupplierManagement />
          </TabsContent>

          <TabsContent value="stock">
            <StockTransactions />
          </TabsContent>

          <TabsContent value="delivery">
            <DeliveryNoteManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;

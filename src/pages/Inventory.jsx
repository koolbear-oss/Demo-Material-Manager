import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Upload, Search, Edit, AlertCircle, Package } from 'lucide-react';
import ProductModal from "@/components/ProductModal";

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [demoCases, setDemoCases] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Import State
  const [importData, setImportData] = useState('');
  const [parsedImport, setParsedImport] = useState([]);

  useEffect(() => {
    fetchData();
    base44.auth.me().then(setCurrentUser).catch(console.error);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodsRes, casesRes, loansRes] = await Promise.all([
        base44.entities.Product.list('article_reference', 500),
        base44.entities.DemoCase.list('case_name', 100),
        base44.entities.Loan.list('-created_date', 500)
      ]);
      setProducts(prodsRes);
      setDemoCases(casesRes);
      setLoans(loansRes.filter(l => l.status !== 'returned'));
    } catch (e) {
      console.error("Failed to fetch data", e);
    } finally {
      setLoading(false);
    }
  };

  const getDemoCaseName = (caseId) => {
    const dc = demoCases.find(c => c.id === caseId);
    return dc ? dc.case_name : '-';
  };

  const getAvailability = (product) => {
    const activeLoans = loans.filter(l => l.product_id === product.id).length;
    const available = product.quantity - activeLoans;
    return { available, total: product.quantity };
  };

  const handleImport = async () => {
    try {
      // Basic Bulk Create
      const validItems = parsedImport.filter(i => i.article_reference && i.quantity);
      if (validItems.length === 0) return;

      await base44.entities.Product.bulkCreate(validItems);

      base44.entities.ActivityLog.create({
        action: 'Bulk Import',
        details: `Imported ${validItems.length} products`,
        user_email: currentUser?.email || 'system',
        entity_type: 'Product'
      }).catch(console.error);

      setIsImportOpen(false);
      setImportData('');
      setParsedImport([]);
      fetchData();
    } catch (e) {
      console.error(e);
      alert("Error importing products");
    }
  };

  const parsePaste = (text) => {
    setImportData(text);
    const lines = text.trim().split('\n');
    const parsed = lines.map(line => {
      // Try tab or comma split
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      if (parts.length < 3) return null;
      
      return {
        article_reference: parts[0]?.trim(),
        brand: parts[1]?.trim(),
        description: parts[2]?.trim(),
        kit_name: parts[3]?.trim() || '',
        quantity: parseInt(parts[4]?.trim()) || 1
      };
    }).filter(Boolean);
    setParsedImport(parsed);
  };

  const openAdd = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const filteredProducts = products.filter(p => 
    p.article_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-500">Manage your products and kits.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Bulk Import
          </Button>
          <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Add Product
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <Input 
            className="max-w-sm border-none bg-transparent focus-visible:ring-0 px-0" 
            placeholder="Search inventory..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Demo Case</TableHead>
              <TableHead className="text-right">Availability</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No products found.</TableCell></TableRow>
            ) : (
              filteredProducts.map((product) => {
                const avail = getAvailability(product);
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.article_reference}</TableCell>
                    <TableCell>{product.brand}</TableCell>
                    <TableCell>{product.description}</TableCell>
                    <TableCell>
                      {product.belongs_to_case && product.demo_case_id ? (
                        <Badge variant="outline" className="text-xs">
                          <Package className="w-3 h-3 mr-1" />
                          {getDemoCaseName(product.demo_case_id)}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={avail.available > 0 ? 'text-green-600' : 'text-red-500'}>
                        {avail.available}
                      </span>
                      <span className="text-gray-400">/{avail.total}</span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                        <Edit className="w-4 h-4 text-gray-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ProductModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        product={editingProduct}
        onSuccess={fetchData}
      />

      {/* Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Bulk Import from Excel/CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-500">
              Copy columns from Excel and paste below. <br/>
              Expected order: <strong>Reference, Brand, Description, Kit Name, Quantity</strong>
            </p>
            <Textarea 
              placeholder={`AP-H100-BK\tAperio\tHandle\tDemo Kit A\t2\nYAL-L1\tYale\tSmart Lock\t\t3`}
              className="h-40 font-mono text-xs"
              value={importData}
              onChange={(e) => parsePaste(e.target.value)}
            />
            {parsedImport.length > 0 && (
              <div className="bg-blue-50 p-3 rounded text-sm text-blue-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Found {parsedImport.length} items to import.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={parsedImport.length === 0}>
              Import {parsedImport.length} Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
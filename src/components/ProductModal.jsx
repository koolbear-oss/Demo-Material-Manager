import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, Trash2, Package, Plus, Split, Merge, Edit } from 'lucide-react';

export default function ProductModal({ isOpen, onClose, product, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [demoCases, setDemoCases] = useState([]);
  const [individualItems, setIndividualItems] = useState([]);
  const [formData, setFormData] = useState({
    article_reference: '',
    brand: '',
    description: '',
    demo_case_id: '',
    belongs_to_case: false,
    can_lend_separately: true,
    quantity: 1,
    serial_number: '',
    purchase_value: '',
    photo_url: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchDemoCases();
      if (product) {
        setFormData({
          article_reference: product.article_reference,
          brand: product.brand,
          description: product.description,
          demo_case_id: product.demo_case_id || '',
          belongs_to_case: product.belongs_to_case || false,
          can_lend_separately: product.can_lend_separately !== false,
          quantity: product.quantity,
          serial_number: product.serial_number || '',
          purchase_value: product.purchase_value || '',
          photo_url: product.photo_url || ''
        });
        
        // Fetch individual items if this is an article
        if (!product.is_individual_item) {
          fetchIndividualItems(product.id);
        }
      } else {
        setFormData({
          article_reference: '',
          brand: '',
          description: '',
          demo_case_id: '',
          belongs_to_case: false,
          can_lend_separately: true,
          quantity: 1,
          serial_number: '',
          purchase_value: '',
          photo_url: ''
        });
        setIndividualItems([]);
      }
    }
  }, [isOpen, product]);

  const fetchDemoCases = async () => {
    try {
      const cases = await base44.entities.DemoCase.list('case_name', 100);
      setDemoCases(cases);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchIndividualItems = async (productId) => {
    try {
      const allProducts = await base44.entities.Product.list('article_reference', 500);
      const items = allProducts.filter(p => 
        p.parent_article_id === productId && p.is_individual_item === true
      );
      setIndividualItems(items);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    console.log("Submitting Product Form", formData);

    try {
      const data = {
        ...formData,
        quantity: parseInt(formData.quantity || 0),
        purchase_value: formData.purchase_value !== '' ? parseFloat(formData.purchase_value) : undefined,
        demo_case_id: formData.belongs_to_case ? formData.demo_case_id : null,
        belongs_to_case: formData.belongs_to_case,
        can_lend_separately: formData.can_lend_separately,
        is_individual_item: false // Always false for articles created through this modal
      };

      // Check for duplicate if creating new product
      if (!product) {
        const existing = await base44.entities.Product.filter({ article_reference: data.article_reference });
        if (existing && existing.length > 0) {
          alert(`A product with reference "${data.article_reference}" already exists.`);
          setLoading(false);
          return;
        }
      }

      if (product) {
        console.log("Updating product", product.id);
        await base44.entities.Product.update(product.id, data);
        
        base44.entities.ActivityLog.create({
           action: 'Edit Product',
           details: `Updated ${data.article_reference}`,
           user_email: 'system',
           entity_type: 'Product'
        }).catch(console.error);
      } else {
        console.log("Creating new product");
        await base44.entities.Product.create(data);
        
        base44.entities.ActivityLog.create({
           action: 'Add Product',
           details: `Added ${data.article_reference}`,
           user_email: 'system',
           entity_type: 'Product'
        }).catch(console.error);
      }
      
      console.log("Product saved successfully");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error saving product:", err);
      alert(`Error saving product: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSplitToItems = async () => {
    if (!product || individualItems.length > 0) return;
    
    if (!confirm(`Split ${product.article_reference} into ${product.quantity} individual trackable items?`)) {
      return;
    }

    setLoading(true);
    try {
      // Create individual item records
      const itemPromises = [];
      for (let i = 1; i <= product.quantity; i++) {
        const itemData = {
          article_reference: product.article_reference,
          brand: product.brand,
          description: product.description,
          demo_case_id: product.demo_case_id,
          belongs_to_case: product.belongs_to_case,
          can_lend_separately: product.can_lend_separately,
          quantity: 1,
          purchase_value: product.purchase_value,
          photo_url: product.photo_url,
          is_individual_item: true,
          parent_article_id: product.id,
          item_identifier: `${product.article_reference}-${String(i).padStart(3, '0')}`,
          serial_number: null
        };
        itemPromises.push(base44.entities.Product.create(itemData));
      }

      await Promise.all(itemPromises);

      // Update parent article to quantity 0
      await base44.entities.Product.update(product.id, { quantity: 0 });

      // Log activity
      base44.entities.ActivityLog.create({
        action: 'Split to Items',
        details: `Split ${product.article_reference} into ${product.quantity} individual items`,
        user_email: 'system',
        entity_type: 'Product'
      }).catch(console.error);

      // Refresh individual items
      await fetchIndividualItems(product.id);
      
      // Update form data
      setFormData({...formData, quantity: 0});

    } catch (err) {
      console.error("Error splitting to items:", err);
      alert(`Error splitting to items: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMergeToArticle = async () => {
    if (!product || individualItems.length === 0) return;
    
    if (!confirm(`Merge ${individualItems.length} individual items back into article-level tracking?`)) {
      return;
    }

    setLoading(true);
    try {
      // Delete all individual item records
      const deletePromises = individualItems.map(item => 
        base44.entities.Product.delete(item.id)
      );
      await Promise.all(deletePromises);

      // Update parent article quantity
      await base44.entities.Product.update(product.id, { quantity: individualItems.length });

      // Log activity
      base44.entities.ActivityLog.create({
        action: 'Merge to Article',
        details: `Merged ${individualItems.length} individual items back to ${product.article_reference}`,
        user_email: 'system',
        entity_type: 'Product'
      }).catch(console.error);

      // Update state
      setIndividualItems([]);
      setFormData({...formData, quantity: individualItems.length});

    } catch (err) {
      console.error("Error merging to article:", err);
      alert(`Error merging to article: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateItemSerial = async (itemId, serialNumber) => {
    try {
      await base44.entities.Product.update(itemId, { serial_number: serialNumber });
      // Refresh items
      await fetchIndividualItems(product.id);
    } catch (err) {
      console.error("Error updating serial number:", err);
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    
    if (!confirm(`Are you sure you want to delete "${product.article_reference}"? This action cannot be undone.`)) {
      return;
    }
    
    setLoading(true);
    try {
      // Check if product has active loans
      const allLoans = await base44.entities.Loan.list('created_date', 500);
      const activeLoans = allLoans.filter(l => 
        l.product_id === product.id && 
        (l.status === 'out' || l.status === 'sample')
      );
      
      if (activeLoans.length > 0) {
        alert('Cannot delete product: it is currently on loan.');
        setLoading(false);
        return;
      }

      // Delete individual items first if they exist
      if (individualItems.length > 0) {
        const deletePromises = individualItems.map(item => 
          base44.entities.Product.delete(item.id)
        );
        await Promise.all(deletePromises);
      }
      
      await base44.entities.Product.delete(product.id);
      
      base44.entities.ActivityLog.create({
        action: 'Delete Product',
        details: `Deleted ${product.article_reference}`,
        user_email: (await base44.auth.me())?.email || 'system',
        entity_type: 'Product'
      }).catch(console.error);
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error deleting product:", err);
      alert(`Error deleting product: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const hasIndividualItems = individualItems.length > 0;
  const canSplit = product && !product.is_individual_item && formData.quantity > 1 && !hasIndividualItems;
  const canMerge = product && !product.is_individual_item && hasIndividualItems;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          <DialogDescription>
            {product ? 'Update the product details below.' : 'Fill in the details to add a new product to the inventory.'}
          </DialogDescription>
        </DialogHeader>
        
        {product && !product.is_individual_item ? (
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Article Details</TabsTrigger>
              <TabsTrigger value="items" className="flex items-center gap-1">
                <Package className="w-3 h-3" />
                Individual Items ({individualItems.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="details">
              <ArticleDetailsForm 
                formData={formData} 
                setFormData={setFormData} 
                demoCases={demoCases} 
                hasIndividualItems={hasIndividualItems}
              />
            </TabsContent>
            
            <TabsContent value="items">
              <IndividualItemsView 
                individualItems={individualItems}
                product={product}
                canSplit={canSplit}
                canMerge={canMerge}
                onSplit={handleSplitToItems}
                onMerge={handleMergeToArticle}
                onUpdateSerial={updateItemSerial}
                loading={loading}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <ArticleDetailsForm 
            formData={formData} 
            setFormData={setFormData} 
            demoCases={demoCases} 
            hasIndividualItems={false}
          />
        )}

        <DialogFooter>
          <div className="flex w-full justify-between">
            {product && (
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                disabled={loading}
                className="mr-auto"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Product
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button 
                onClick={handleSubmit} 
                disabled={loading || !formData.article_reference || !formData.brand}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="w-4 h-4 mr-2" /> 
                {product ? 'Update Product' : 'Add Product'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sub-component for article details form
function ArticleDetailsForm({ formData, setFormData, demoCases, hasIndividualItems }) {
  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Article Reference *</Label>
          <Input 
            value={formData.article_reference} 
            onChange={e => setFormData({...formData, article_reference: e.target.value})} 
            placeholder="e.g. AP-H100"
          />
        </div>
        <div className="space-y-2">
          <Label>Brand *</Label>
          <Input 
            value={formData.brand} 
            onChange={e => setFormData({...formData, brand: e.target.value})} 
            placeholder="e.g. ASSA ABLOY"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description *</Label>
        <Input 
          value={formData.description} 
          onChange={e => setFormData({...formData, description: e.target.value})} 
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Quantity *</Label>
          <div className="flex items-center gap-2">
            <Input 
              type="number" 
              min="0" 
              value={formData.quantity} 
              onChange={e => setFormData({...formData, quantity: e.target.value})} 
              disabled={hasIndividualItems}
            />
            {hasIndividualItems && (
              <Badge variant="outline" className="text-xs">
                Individual tracking active
              </Badge>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Serial Number (Optional)</Label>
          <Input 
            value={formData.serial_number} 
            onChange={e => setFormData({...formData, serial_number: e.target.value})} 
            disabled={hasIndividualItems}
            placeholder={hasIndividualItems ? "Managed at item level" : "Single serial number"}
          />
        </div>
      </div>

      {/* Demo Case Assignment */}
      <div className="border-t pt-4 mt-2">
        <p className="text-sm font-medium mb-3 text-gray-700">Demo Case Assignment</p>
        <div className="flex items-center space-x-2 mb-3">
          <Checkbox 
            id="belongs_to_case" 
            checked={formData.belongs_to_case}
            onCheckedChange={(checked) => setFormData({...formData, belongs_to_case: checked})}
          />
          <Label htmlFor="belongs_to_case" className="cursor-pointer font-normal">This product belongs to a demo case</Label>
        </div>
        
        {formData.belongs_to_case && (
          <div className="space-y-3 pl-6 border-l-2 border-blue-200">
            <div className="space-y-2">
              <Label>Demo Case</Label>
              <Select value={formData.demo_case_id} onValueChange={val => setFormData({...formData, demo_case_id: val})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select demo case" />
                </SelectTrigger>
                <SelectContent>
                  {demoCases.map(dc => (
                    <SelectItem key={dc.id} value={dc.id}>{dc.case_name} ({dc.case_type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="can_lend_separately" 
                checked={formData.can_lend_separately}
                onCheckedChange={(checked) => setFormData({...formData, can_lend_separately: checked})}
              />
              <Label htmlFor="can_lend_separately" className="cursor-pointer font-normal text-sm">Can be lent separately from case</Label>
            </div>
          </div>
        )}
      </div>
      
      <div className="border-t pt-4 mt-2">
        <p className="text-sm font-medium mb-3 text-gray-500">Optional Details</p>
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label>Purchase Value</Label>
            <Input 
              type="number" 
              value={formData.purchase_value} 
              onChange={e => setFormData({...formData, purchase_value: e.target.value})} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-component for individual items management
function IndividualItemsView({ individualItems, product, canSplit, canMerge, onSplit, onMerge, onUpdateSerial, loading }) {
  const [editingSerial, setEditingSerial] = useState(null);
  const [serialValue, setSerialValue] = useState('');

  const handleEditSerial = (item) => {
    setEditingSerial(item.id);
    setSerialValue(item.serial_number || '');
  };

  const handleSaveSerial = async (itemId) => {
    await onUpdateSerial(itemId, serialValue);
    setEditingSerial(null);
    setSerialValue('');
  };

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-600">
            {individualItems.length > 0 
              ? `Tracking ${individualItems.length} individual items` 
              : `Article-level tracking (quantity: ${product.quantity})`
            }
          </p>
        </div>
        <div className="flex gap-2">
          {canSplit && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onSplit}
              disabled={loading}
              className="text-blue-600 hover:text-blue-700"
            >
              <Split className="w-3 h-3 mr-1" />
              Split to Items
            </Button>
          )}
          {canMerge && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onMerge}
              disabled={loading}
              className="text-green-600 hover:text-green-700"
            >
              <Merge className="w-3 h-3 mr-1" />
              Merge to Article
            </Button>
          )}
        </div>
      </div>

      {/* Individual items table */}
      {individualItems.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Item ID</TableHead>
                <TableHead>Serial Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {individualItems.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.item_identifier}
                  </TableCell>
                  <TableCell>
                    {editingSerial === item.id ? (
                      <div className="flex gap-1">
                        <Input 
                          size="sm"
                          value={serialValue} 
                          onChange={e => setSerialValue(e.target.value)}
                          placeholder="Enter serial number"
                          className="h-7"
                        />
                        <Button size="sm" onClick={() => handleSaveSerial(item.id)} className="h-7 px-2">
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingSerial(null)} className="h-7 px-2">
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {item.serial_number || <span className="text-gray-400">No serial</span>}
                        </span>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleEditSerial(item)}
                          className="h-5 w-5 p-0"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-green-600">Available</Badge>
                  </TableCell>
                  <TableCell>
                    {/* Future: Individual item actions */}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {individualItems.length === 0 && !canSplit && (
        <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
          <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p>No individual item tracking enabled</p>
          <p className="text-xs">Use "Split to Items" to enable individual tracking</p>
        </div>
      )}
    </div>
  );
}
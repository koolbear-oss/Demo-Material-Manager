import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save } from 'lucide-react';

export default function ProductModal({ isOpen, onClose, product, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [demoCases, setDemoCases] = useState([]);
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
        can_lend_separately: formData.can_lend_separately
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          <DialogDescription>
            {product ? 'Update the product details below.' : 'Fill in the details to add a new product to the inventory.'}
          </DialogDescription>
        </DialogHeader>
        
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
              <Input 
                type="number" 
                min="0" 
                value={formData.quantity} 
                onChange={e => setFormData({...formData, quantity: e.target.value})} 
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input 
                  value={formData.serial_number} 
                  onChange={e => setFormData({...formData, serial_number: e.target.value})} 
                />
              </div>
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

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Save } from 'lucide-react';

export default function ProductForm() {
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState({
    article_reference: '',
    brand: '',
    description: '',
    kit_name: '',
    quantity: 1,
    serial_number: '',
    purchase_value: '',
    photo_url: ''
  });

  useEffect(() => {
    const loadData = async () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      
      if (id) {
        setIsEdit(true);
        try {
          const products = await base44.entities.Product.list({ filter: { id } });
          if (products.length > 0) {
            const p = products[0];
            setFormData({
              article_reference: p.article_reference,
              brand: p.brand,
              description: p.description,
              kit_name: p.kit_name || '',
              quantity: p.quantity,
              serial_number: p.serial_number || '',
              purchase_value: p.purchase_value || '',
              photo_url: p.photo_url || ''
            });
          }
        } catch (e) {
          console.error("Error loading product", e);
        }
      }
      setPageLoading(false);
    };
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const data = {
        ...formData,
        quantity: parseInt(formData.quantity || 0),
        purchase_value: formData.purchase_value !== '' ? parseFloat(formData.purchase_value) : undefined
      };

      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');

      if (id) {
        await base44.entities.Product.update(id, data);
        await base44.entities.ActivityLog.create({
           action: 'Edit Product',
           details: `Updated ${data.article_reference}`,
           user_email: (await base44.auth.me())?.email || 'unknown',
           entity_type: 'Product'
        });
      } else {
        await base44.entities.Product.create(data);
        await base44.entities.ActivityLog.create({
           action: 'Add Product',
           details: `Added ${data.article_reference}`,
           user_email: (await base44.auth.me())?.email || 'unknown',
           entity_type: 'Product'
        });
      }
      
      window.location.href = '/Inventory';
    } catch (err) {
      console.error(err);
      alert(`Error saving product: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => window.location.href = '/Inventory'}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold">{isEdit ? 'Edit Product' : 'Add Product'}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Article Reference *</Label>
                <Input 
                  required
                  value={formData.article_reference} 
                  onChange={e => setFormData({...formData, article_reference: e.target.value})} 
                  placeholder="e.g. AP-H100"
                />
              </div>
              <div className="space-y-2">
                <Label>Brand *</Label>
                <Input 
                  required
                  value={formData.brand} 
                  onChange={e => setFormData({...formData, brand: e.target.value})} 
                  placeholder="e.g. ASSA ABLOY"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description *</Label>
              <Input 
                required
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
                  required
                  value={formData.quantity} 
                  onChange={e => setFormData({...formData, quantity: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label>Kit Name (Optional)</Label>
                <Input 
                  value={formData.kit_name} 
                  onChange={e => setFormData({...formData, kit_name: e.target.value})} 
                  placeholder="e.g. Demo Kit A" 
                />
              </div>
            </div>
            
            <div className="border-t pt-4">
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

            <div className="flex justify-end pt-4">
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Update Product' : 'Create Product'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
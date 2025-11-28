import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from '@/api/base44Client';
import { addWeeks, format } from 'date-fns';
import { Loader2, AlertTriangle, Package } from 'lucide-react';

export default function LendModal({ isOpen, onClose, product, onSuccess, currentUser }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_address: '',
    responsible_email: '',
    return_date: format(addWeeks(new Date(), 2), 'yyyy-MM-dd'),
    is_sample: false,
    notes: ''
  });
  const [teamMembers, setTeamMembers] = useState([]);
  const [demoCase, setDemoCase] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        customer_name: '',
        customer_address: '',
        responsible_email: currentUser?.email || '',
        return_date: format(addWeeks(new Date(), 2), 'yyyy-MM-dd'),
        is_sample: false,
        notes: ''
      });
      fetchTeamMembers();
      if (product?.belongs_to_case && product?.demo_case_id) {
        fetchDemoCase(product.demo_case_id);
      } else {
        setDemoCase(null);
      }
    }
  }, [isOpen, currentUser, product]);

  const fetchTeamMembers = async () => {
    const allMembers = await base44.entities.TeamMember.list('first_name', 100);
    const activeMembers = allMembers.filter(m => m.status === 'active');
    setTeamMembers(activeMembers);
  };

  const fetchDemoCase = async (caseId) => {
    try {
      const cases = await base44.entities.DemoCase.list('case_name', 100);
      const foundCase = cases.find(c => c.id === caseId);
      setDemoCase(foundCase || null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async () => {
    if (!product) return;
    
    // Check if product can be lent separately
    if (product.belongs_to_case && product.can_lend_separately === false) {
      alert(`This item cannot be lent separately. It must be lent as part of ${demoCase?.case_name || 'its demo case'}.`);
      return;
    }
    
    setLoading(true);
    try {
      // Find responsible name
      const responsibleMember = teamMembers.find(m => m.email === formData.responsible_email);
      const responsibleName = responsibleMember 
        ? `${responsibleMember.first_name} ${responsibleMember.last_name}` 
        : formData.responsible_email;

      const loanData = {
        product_id: product.id,
        product_article: product.article_reference,
        product_description: product.description,
        customer_name: formData.customer_name,
        customer_address: formData.customer_address || null,
        responsible_email: formData.responsible_email,
        responsible_name: responsibleName,
        lent_by_email: currentUser?.email,
        lent_date: format(new Date(), 'yyyy-MM-dd'),
        expected_return_date: formData.is_sample ? null : formData.return_date,
        status: formData.is_sample ? 'sample' : 'out',
        notes: formData.notes,
        kit_name: product.kit_name || null
      };

      await base44.entities.Loan.create(loanData);
      
      // Log activity (non-blocking)
      base44.entities.ActivityLog.create({
        action: 'Lend',
        details: `Lent ${product.article_reference} to ${formData.customer_name} (Resp: ${responsibleName})`,
        user_email: currentUser?.email || 'unknown',
        entity_type: 'Loan',
        entity_id: product.id
      }).catch(console.error);

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Error lending item:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Lend Item: {product.article_reference}</DialogTitle>
          <p className="text-sm text-gray-500">{product.description}</p>
        </DialogHeader>

        {/* Demo Case Warning */}
        {product.belongs_to_case && demoCase && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <div className="font-medium flex items-center gap-1">
                <Package className="w-3 h-3" /> This item belongs to {demoCase.case_name}
              </div>
              <p className="text-xs mt-1">Ensure it returns to this case when done.</p>
              {product.can_lend_separately === false && (
                <p className="text-xs mt-1 text-red-600 font-medium">This item cannot be lent separately from the case.</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="customer">Customer / Company Name *</Label>
            <Input 
              id="customer" 
              value={formData.customer_name}
              onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
              placeholder="e.g. Acme Corp"
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address">Customer Address (Optional)</Label>
            <Input 
              id="address" 
              value={formData.customer_address || ''}
              onChange={(e) => setFormData({...formData, customer_address: e.target.value})}
              placeholder="e.g. Chaussée de Charleroi 123, 1060 Brussels"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="responsible">Responsible Team Member</Label>
            <Select 
              value={formData.responsible_email} 
              onValueChange={(val) => setFormData({...formData, responsible_email: val})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map(member => (
                  <SelectItem key={member.id} value={member.email}>
                    {member.first_name} {member.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2 py-2">
            <Checkbox 
              id="sample" 
              checked={formData.is_sample}
              onCheckedChange={(checked) => setFormData({...formData, is_sample: checked})}
            />
            <Label htmlFor="sample" className="cursor-pointer font-normal">Given as sample (No return expected)</Label>
          </div>

          {!formData.is_sample && (
            <div className="grid gap-2">
              <Label htmlFor="date">Expected Return Date</Label>
              <Input 
                id="date" 
                type="date" 
                value={formData.return_date}
                onChange={(e) => setFormData({...formData, return_date: e.target.value})}
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input 
              id="notes" 
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Any additional details..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !formData.customer_name}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm Loan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
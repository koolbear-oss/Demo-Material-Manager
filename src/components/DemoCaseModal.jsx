import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from 'lucide-react';

export default function DemoCaseModal({ isOpen, onClose, demoCase }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    case_name: '',
    case_type: 'Custom',
    software_version: '',
    serial_number: '',
    base_location: '',
    base_address: '',
    description: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      if (demoCase) {
        setFormData({
          case_name: demoCase.case_name || '',
          case_type: demoCase.case_type || 'Custom',
          software_version: demoCase.software_version || '',
          serial_number: demoCase.serial_number || '',
          base_location: demoCase.base_location || '',
          base_address: demoCase.base_address || '',
          description: demoCase.description || '',
          notes: demoCase.notes || ''
        });
      } else {
        setFormData({
          case_name: '',
          case_type: 'Custom',
          software_version: '',
          serial_number: '',
          base_location: '',
          base_address: '',
          description: '',
          notes: ''
        });
      }
    }
  }, [isOpen, demoCase]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (demoCase) {
        await base44.entities.DemoCase.update(demoCase.id, formData);
        base44.entities.ActivityLog.create({
          action: 'Edit Demo Case',
          details: `Updated ${formData.case_name}`,
          user_email: 'system',
          entity_type: 'DemoCase'
        }).catch(console.error);
      } else {
        await base44.entities.DemoCase.create(formData);
        base44.entities.ActivityLog.create({
          action: 'Add Demo Case',
          details: `Created ${formData.case_name}`,
          user_email: 'system',
          entity_type: 'DemoCase'
        }).catch(console.error);
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert(`Error saving demo case: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{demoCase ? 'Edit Demo Case' : 'Add Demo Case'}</DialogTitle>
          <DialogDescription>
            {demoCase ? 'Update demo case details.' : 'Create a new demo case to group products together.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Case Name *</Label>
              <Input 
                value={formData.case_name} 
                onChange={e => setFormData({...formData, case_name: e.target.value})} 
                placeholder="e.g. CLIQ Demo Case A"
              />
            </div>
            <div className="space-y-2">
              <Label>Case Type *</Label>
              <Select value={formData.case_type} onValueChange={val => setFormData({...formData, case_type: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLIQ System">CLIQ System</SelectItem>
                  <SelectItem value="Aperio Kit">Aperio Kit</SelectItem>
                  <SelectItem value="SMARTair Package">SMARTair Package</SelectItem>
                  <SelectItem value="Yale Kit">Yale Kit</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Software Version</Label>
              <Input 
                value={formData.software_version} 
                onChange={e => setFormData({...formData, software_version: e.target.value})} 
                placeholder="e.g. Web Manager 5.3"
              />
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input 
                value={formData.serial_number} 
                onChange={e => setFormData({...formData, serial_number: e.target.value})} 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Base Location (Storage)</Label>
            <Input 
              value={formData.base_location} 
              onChange={e => setFormData({...formData, base_location: e.target.value})} 
              placeholder="e.g. Office Shelf B3"
            />
          </div>

          <div className="space-y-2">
            <Label>Office Address</Label>
            <Input 
              value={formData.base_address} 
              onChange={e => setFormData({...formData, base_address: e.target.value})} 
              placeholder="e.g. Rue de la Loi 123, 1040 Brussels"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              placeholder="Description of this demo case..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !formData.case_name}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="w-4 h-4 mr-2" /> 
            {demoCase ? 'Update Case' : 'Create Case'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
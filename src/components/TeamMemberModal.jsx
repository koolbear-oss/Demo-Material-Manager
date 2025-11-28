import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from 'lucide-react';

export default function TeamMemberModal({ isOpen, onClose, member, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'member',
    status: 'active'
  });

  useEffect(() => {
    if (isOpen) {
      if (member) {
        setFormData({
          first_name: member.first_name,
          last_name: member.last_name,
          email: member.email,
          role: member.role,
          status: member.status
        });
      } else {
        setFormData({
          first_name: '',
          last_name: '',
          email: '',
          role: 'member',
          status: 'active'
        });
      }
    }
  }, [isOpen, member]);

  const handleSubmit = async () => {
    setLoading(true);
    console.log("Submitting Team Member", formData);
    
    try {
      // Check for duplicate email if creating new member
      if (!member) {
        const existing = await base44.entities.TeamMember.filter({ email: formData.email });
        if (existing && existing.length > 0) {
          alert(`A team member with email "${formData.email}" already exists.`);
          setLoading(false);
          return;
        }
      }

      if (member) {
        console.log("Updating member", member.id);
        await base44.entities.TeamMember.update(member.id, formData);
        
        base44.entities.ActivityLog.create({
           action: 'Edit Team Member',
           details: `Updated ${formData.first_name} ${formData.last_name}`,
           user_email: 'system',
           entity_type: 'TeamMember'
        }).catch(console.error);
      } else {
        console.log("Creating new member");
        await base44.entities.TeamMember.create(formData);
        
        base44.entities.ActivityLog.create({
           action: 'Add Team Member',
           details: `Added ${formData.first_name} ${formData.last_name}`,
           user_email: 'system',
           entity_type: 'TeamMember'
        }).catch(console.error);
      }
      
      console.log("Member saved successfully");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error saving member:", err);
      alert(`Error saving member: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{member ? 'Edit Team Member' : 'Add Team Member'}</DialogTitle>
          <DialogDescription>
            {member ? 'Update member details and permissions.' : 'Add a new member to the team.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input 
                value={formData.first_name} 
                onChange={e => setFormData({...formData, first_name: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name *</Label>
              <Input 
                value={formData.last_name} 
                onChange={e => setFormData({...formData, last_name: e.target.value})} 
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input 
              type="email" 
              value={formData.email} 
              onChange={e => setFormData({...formData, email: e.target.value})} 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={val => setFormData({...formData, role: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Team Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={val => setFormData({...formData, status: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !formData.first_name || !formData.email}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="w-4 h-4 mr-2" />
            Save Member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
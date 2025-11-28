import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Save } from 'lucide-react';

export default function TeamMemberForm() {
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'member',
    status: 'active'
  });

  useEffect(() => {
    const loadData = async () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      
      if (id) {
        setIsEdit(true);
        try {
          const members = await base44.entities.TeamMember.list({ filter: { id } });
          if (members.length > 0) {
            setFormData(members[0]);
          }
        } catch (e) {
          console.error("Error loading member", e);
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
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');

      if (id) {
        await base44.entities.TeamMember.update(id, formData);
        await base44.entities.ActivityLog.create({
           action: 'Edit Team Member',
           details: `Updated ${formData.first_name} ${formData.last_name}`,
           user_email: (await base44.auth.me())?.email || 'unknown',
           entity_type: 'TeamMember'
        });
      } else {
        await base44.entities.TeamMember.create(formData);
        await base44.entities.ActivityLog.create({
           action: 'Add Team Member',
           details: `Added ${formData.first_name} ${formData.last_name}`,
           user_email: (await base44.auth.me())?.email || 'unknown',
           entity_type: 'TeamMember'
        });
      }
      
      window.location.href = '/Team';
    } catch (err) {
      console.error(err);
      alert(`Error saving member: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => window.location.href = '/Team'}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold">{isEdit ? 'Edit Team Member' : 'Add Team Member'}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Member Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input 
                  required
                  value={formData.first_name} 
                  onChange={e => setFormData({...formData, first_name: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input 
                  required
                  value={formData.last_name} 
                  onChange={e => setFormData({...formData, last_name: e.target.value})} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input 
                type="email" 
                required
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

            <div className="flex justify-end pt-4">
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Update Member' : 'Create Member'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
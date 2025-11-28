import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, UserCog, Search, Edit, UserX, UserCheck } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import TeamMemberModal from "@/components/TeamMemberModal";

export default function Team() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetchMembers();
    base44.auth.me().then(setCurrentUser).catch(console.error);
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await base44.entities.TeamMember.list('first_name', 100);
      setMembers(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (member) => {
    const newStatus = member.status === 'active' ? 'inactive' : 'active';
    if (!confirm(`Change status of ${member.first_name} to ${newStatus}?`)) return;
    
    try {
      await base44.entities.TeamMember.update(member.id, { status: newStatus });
      
      base44.entities.ActivityLog.create({
        action: 'Update Status',
        details: `Changed ${member.first_name} to ${newStatus}`,
        user_email: currentUser?.email || 'system',
        entity_type: 'TeamMember'
      }).catch(console.error);
      
      fetchMembers();
    } catch (e) {
      console.error(e);
    }
  };

  const openAdd = () => {
    setEditingMember(null);
    setIsModalOpen(true);
  };

  const openEdit = (member) => {
    setEditingMember(member);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-500">Manage access and responsibilities.</p>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Add Team Member
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : (
              members.map((member) => (
                <TableRow key={member.id} className={member.status === 'inactive' ? 'bg-gray-50 opacity-60' : ''}>
                  <TableCell className="font-medium">{member.first_name} {member.last_name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={member.role === 'admin' ? 'border-blue-200 text-blue-700 bg-blue-50' : ''}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={member.status === 'active' ? 'bg-green-100 text-green-800 hover:bg-green-200 border-green-200' : 'bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-200'}>
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(member)}>
                      <Edit className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleStatus(member)}>
                      {member.status === 'active' ? (
                        <UserX className="w-4 h-4 text-red-400" />
                      ) : (
                        <UserCheck className="w-4 h-4 text-green-400" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TeamMemberModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        member={editingMember}
        onSuccess={fetchMembers}
      />
    </div>
  );
}
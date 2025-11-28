import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Eye, Package, CheckCircle, AlertTriangle, XCircle, MapPin, Building } from 'lucide-react';
import DemoCaseModal from "@/components/DemoCaseModal";
import DemoCaseDetailModal from "@/components/DemoCaseDetailModal";

export default function DemoCases() {
  const [demoCases, setDemoCases] = useState([]);
  const [products, setProducts] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [casesRes, prodsRes, loansRes] = await Promise.all([
        base44.entities.DemoCase.list('case_name', 100),
        base44.entities.Product.list('article_reference', 500),
        base44.entities.Loan.list('-created_date', 500)
      ]);
      setDemoCases(casesRes);
      setProducts(prodsRes);
      setLoans(loansRes.filter(l => l.status !== 'returned'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getCaseStatus = (caseId) => {
    const caseProducts = products.filter(p => p.demo_case_id === caseId);
    if (caseProducts.length === 0) return { status: 'empty', available: 0, total: 0, loans: [] };
    
    let available = 0;
    let total = caseProducts.length;
    const caseLoans = [];
    
    caseProducts.forEach(p => {
      const productLoans = loans.filter(l => l.product_id === p.id);
      if (productLoans.length === 0) {
        available++;
      } else {
        caseLoans.push(...productLoans);
      }
    });
    
    if (available === total) return { status: 'complete', available, total, loans: [] };
    if (available === 0) return { status: 'allout', available, total, loans: caseLoans };
    return { status: 'incomplete', available, total, loans: caseLoans };
  };

  const getCurrentLocation = (demoCase, status) => {
    if (status.status === 'complete' || status.status === 'empty') {
      return {
        type: 'office',
        label: demoCase.base_location || 'Office',
        address: demoCase.base_address
      };
    }
    
    // Get unique customers from active loans
    const customers = [...new Set(status.loans.map(l => l.customer_name))];
    
    if (status.status === 'allout' && customers.length === 1) {
      const loan = status.loans[0];
      return {
        type: 'customer',
        label: loan.customer_name,
        address: loan.customer_address
      };
    }
    
    // Split between locations
    return {
      type: 'split',
      label: `Split: Office (${status.available}), ${customers.join(', ')} (${status.total - status.available})`,
      customers
    };
  };

  const getStatusBadge = (status) => {
    switch (status.status) {
      case 'complete':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="w-3 h-3 mr-1" /> Complete</Badge>;
      case 'incomplete':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><AlertTriangle className="w-3 h-3 mr-1" /> Incomplete</Badge>;
      case 'allout':
        return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="w-3 h-3 mr-1" /> All Out</Badge>;
      default:
        return <Badge variant="outline">Empty</Badge>;
    }
  };

  const openAdd = () => {
    setEditingCase(null);
    setIsModalOpen(true);
  };

  const openEdit = (demoCase) => {
    setEditingCase(demoCase);
    setIsModalOpen(true);
  };

  const openDetail = (demoCase) => {
    setSelectedCase(demoCase);
    setIsDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demo Cases</h1>
          <p className="text-gray-500">Manage demo case kits and their components.</p>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Add Demo Case
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Components</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Current Location</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : demoCases.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No demo cases found. Add your first case!</TableCell></TableRow>
            ) : (
              demoCases.map((demoCase) => {
                const status = getCaseStatus(demoCase.id);
                const location = getCurrentLocation(demoCase, status);
                return (
                  <TableRow key={demoCase.id}>
                    <TableCell className="font-medium">{demoCase.case_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{demoCase.case_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {status.total} items ({status.available} available)
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(status)}</TableCell>
                    <TableCell>
                      <div className="flex items-start gap-1.5">
                        {location.type === 'office' && (
                          <>
                            <Building className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-green-700">{location.label}</div>
                              {location.address && <div className="text-xs text-gray-500">{location.address}</div>}
                            </div>
                          </>
                        )}
                        {location.type === 'customer' && (
                          <>
                            <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-blue-700">{location.label}</div>
                              {location.address && <div className="text-xs text-gray-500">{location.address}</div>}
                            </div>
                          </>
                        )}
                        {location.type === 'split' && (
                          <>
                            <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-orange-700">{location.label}</div>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openDetail(demoCase)}>
                        <Eye className="w-4 h-4 text-gray-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(demoCase)}>
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

      <DemoCaseModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        demoCase={editingCase}
        onSuccess={fetchData}
      />

      <DemoCaseDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        demoCase={selectedCase}
        products={products}
        loans={loans}
      />
    </div>
  );
}
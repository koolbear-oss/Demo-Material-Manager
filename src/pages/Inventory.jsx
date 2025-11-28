import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Upload, Search, Edit, AlertCircle, Package, ChevronDown, ChevronRight, Box, Loader2, CheckCircle2 } from 'lucide-react';
import ProductModal from "@/components/ProductModal";
import { addWeeks, format } from 'date-fns';

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
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' or 'flat'
  const [expandedCases, setExpandedCases] = useState(new Set());
  const [isBulkLendOpen, setIsBulkLendOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  
  // Import State
  const [importData, setImportData] = useState('');
  const [parsedImport, setParsedImport] = useState([]);
  const [willCreateCases, setWillCreateCases] = useState([]);

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
      const validItems = parsedImport.filter(i => i.article_reference && i.quantity);
      if (validItems.length === 0) return;

      // Step 1: Create new demo cases
      const createdCases = new Map(); // case_name -> case_id
      
      for (const caseName of willCreateCases) {
        const newCase = await base44.entities.DemoCase.create({
          case_name: caseName,
          case_type: 'Custom',
          description: `Auto-created from import`
        });
        createdCases.set(caseName, newCase.id);
      }

      // Step 2: Find existing case IDs
      const existingCases = new Map();
      for (const demoCase of demoCases) {
        existingCases.set(demoCase.case_name.toLowerCase(), demoCase.id);
      }

      // Step 3: Prepare products with demo case links
      const productsToCreate = validItems.map(item => {
        const productData = {
          article_reference: item.article_reference,
          brand: item.brand,
          description: item.description,
          quantity: item.quantity,
          belongs_to_case: !!item.case_name,
          can_lend_separately: true
        };

        if (item.case_name) {
          // Find case ID (either newly created or existing)
          const caseId = createdCases.get(item.case_name) || 
                        existingCases.get(item.case_name.toLowerCase());
          if (caseId) {
            productData.demo_case_id = caseId;
          }
        }

        return productData;
      });

      // Step 4: Create products
      await base44.entities.Product.bulkCreate(productsToCreate);

      // Step 5: Log activity
      base44.entities.ActivityLog.create({
        action: 'Bulk Import',
        details: `Imported ${validItems.length} products${willCreateCases.length > 0 ? ` and created ${willCreateCases.length} demo cases` : ''}`,
        user_email: currentUser?.email || 'system',
        entity_type: 'Product'
      }).catch(console.error);

      setIsImportOpen(false);
      setImportData('');
      setParsedImport([]);
      setWillCreateCases([]);
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
        case_name: parts[3]?.trim() || '',
        quantity: parseInt(parts[4]?.trim()) || 1
      };
    }).filter(Boolean);
    setParsedImport(parsed);
    // Extract unique case names that will need to be created
    const uniqueCaseNames = [...new Set(parsed
      .map(p => p.case_name)
      .filter(name => name && name.length > 0)
    )];

    // Check which cases already exist
    const existingCaseNames = demoCases.map(dc => dc.case_name.toLowerCase());
    const newCaseNames = uniqueCaseNames.filter(name => 
      !existingCaseNames.includes(name.toLowerCase())
    );

    setWillCreateCases(newCaseNames);
  };

  const openAdd = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleLendCase = (caseGroup) => {
    setSelectedCase(caseGroup);
    setIsBulkLendOpen(true);
  };

  const toggleCaseExpansion = (caseId) => {
    const newExpanded = new Set(expandedCases);
    if (newExpanded.has(caseId)) {
      newExpanded.delete(caseId);
    } else {
      newExpanded.add(caseId);
    }
    setExpandedCases(newExpanded);
  };

  
  const filteredProducts = products.filter(p =>
    p.article_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGroupedProducts = () => {
    const grouped = {};
    const ungrouped = [];
    
    filteredProducts.forEach(product => {
      if (product.belongs_to_case && product.demo_case_id) {
        const caseData = demoCases.find(dc => dc.id === product.demo_case_id);
        const caseKey = product.demo_case_id;
        
        if (!grouped[caseKey]) {
          grouped[caseKey] = {
            case: caseData || { case_name: 'Unknown Case', case_type: 'Unknown' },
            products: [],
            totalItems: 0,
            availableItems: 0
          };
        }
        
        grouped[caseKey].products.push(product);
        grouped[caseKey].totalItems += product.quantity;
        grouped[caseKey].availableItems += getAvailability(product).available;
      } else {
        ungrouped.push(product);
      }
    });
    
    return { grouped, ungrouped };
  };

  const BulkLendModal = ({ isOpen, onClose, caseGroup, onSuccess, currentUser, getAvailability }) => {
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
    const [selectedProducts, setSelectedProducts] = useState(new Set());

    useEffect(() => {
      if (isOpen && caseGroup) {
        setFormData({
          customer_name: '',
          customer_address: '',
          responsible_email: currentUser?.email || '',
          return_date: format(addWeeks(new Date(), 2), 'yyyy-MM-dd'),
          is_sample: false,
          notes: ''
        });
        
        // Select all available products by default
        const availableProducts = caseGroup.products.filter(p => getAvailability(p).available > 0);
        setSelectedProducts(new Set(availableProducts.map(p => p.id)));
        
        fetchTeamMembers();
      }
    }, [isOpen, caseGroup, currentUser, getAvailability]);

    const fetchTeamMembers = async () => {
      try {
        const allMembers = await base44.entities.TeamMember.list('first_name', 100);
        const activeMembers = allMembers.filter(m => m.status === 'active');
        setTeamMembers(activeMembers);
      } catch (e) {
        console.error(e);
      }
    };

    const toggleProductSelection = (productId) => {
      const newSelected = new Set(selectedProducts);
      if (newSelected.has(productId)) {
        newSelected.delete(productId);
      } else {
        newSelected.add(productId);
      }
      setSelectedProducts(newSelected);
    };

    const selectAll = () => {
      const availableProducts = caseGroup.products.filter(p => getAvailability(p).available > 0);
      setSelectedProducts(new Set(availableProducts.map(p => p.id)));
    };

    const selectNone = () => {
      setSelectedProducts(new Set());
    };

    const handleSubmit = async () => {
      if (selectedProducts.size === 0) {
        alert('Please select at least one product to lend.');
        return;
      }
      
      setLoading(true);
      try {
        const responsibleMember = teamMembers.find(m => m.email === formData.responsible_email);
        const responsibleName = responsibleMember 
          ? `${responsibleMember.first_name} ${responsibleMember.last_name}` 
          : formData.responsible_email;

        const selectedProductsList = caseGroup.products.filter(p => selectedProducts.has(p.id));
        
        // Create loans for all selected products
        const loanPromises = selectedProductsList.map(product => {
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
            kit_name: caseGroup.case.case_name
          };
          return base44.entities.Loan.create(loanData);
        });

        await Promise.all(loanPromises);

        // Log activity
        base44.entities.ActivityLog.create({
          action: 'Bulk Lend Case',
          details: `Lent ${selectedProducts.size} items from ${caseGroup.case.case_name} to ${formData.customer_name} (Resp: ${responsibleName})`,
          user_email: currentUser?.email || 'unknown',
          entity_type: 'Loan'
        }).catch(console.error);

        if (onSuccess) onSuccess();
        onClose();
      } catch (error) {
        console.error("Error lending case:", error);
        alert("Error lending case: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    if (!caseGroup) return null;

    const availableProducts = caseGroup.products.filter(p => getAvailability(p).available > 0);
    const selectedCount = selectedProducts.size;

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Lend Demo Case: {caseGroup.case.case_name}
            </DialogTitle>
            <p className="text-sm text-gray-500">Select components to lend and fill in customer details</p>
          </DialogHeader>

          <div className="space-y-6">
            {/* Product Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Select Components ({selectedCount} of {availableProducts.length})</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
                  <Button variant="outline" size="sm" onClick={selectNone}>Select None</Button>
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {caseGroup.products.map((product) => {
                      const avail = getAvailability(product);
                      const isAvailable = avail.available > 0;
                      const isSelected = selectedProducts.has(product.id);
                      
                      return (
                        <TableRow key={product.id} className={!isAvailable ? 'opacity-50 bg-gray-50' : ''}>
                          <TableCell>
                            <Checkbox 
                              checked={isSelected}
                              disabled={!isAvailable}
                              onCheckedChange={() => isAvailable && toggleProductSelection(product.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{product.article_reference}</TableCell>
                          <TableCell>{product.description}</TableCell>
                          <TableCell className="text-right">
                            {isAvailable ? (
                              <span className="text-green-600 flex items-center justify-end gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                {avail.available}
                              </span>
                            ) : (
                              <span className="text-red-500">On Loan</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Customer Details */}
            <div className="space-y-4 border-t pt-4">
              <Label className="text-sm font-medium">Customer Details</Label>
              
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="customer">Customer / Company Name *</Label>
                  <Input 
                    id="customer" 
                    value={formData.customer_name}
                    onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                    placeholder="e.g. Acme Corp"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="address">Customer Address (Optional)</Label>
                  <Input 
                    id="address" 
                    value={formData.customer_address || ''}
                    onChange={(e) => setFormData({...formData, customer_address: e.target.value})}
                    placeholder="e.g. Rue de la Loi 123, 1040 Brussels"
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

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="sample" 
                    checked={formData.is_sample}
                    onCheckedChange={(checked) => setFormData({...formData, is_sample: checked})}
                  />
                  <Label htmlFor="sample" className="cursor-pointer font-normal">Given as samples (No return expected)</Label>
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
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || selectedProducts.size === 0 || !formData.customer_name}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Lend {selectedCount} Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const GroupedInventoryView = () => {
    if (loading) {
      return <div className="text-center py-8">Loading...</div>;
    }

    const { grouped, ungrouped } = getGroupedProducts();
    const groupedCases = Object.values(grouped);

    return (
      <div className="divide-y divide-gray-100">
        {/* Demo Cases */}
        {groupedCases.map((group) => {
          const isExpanded = expandedCases.has(group.case.id);
          const allAvailable = group.availableItems === group.totalItems;
          const noneAvailable = group.availableItems === 0;
          
          return (
            <div key={group.case.id} className="bg-white">
              {/* Case Header */}
              <div 
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors flex items-center justify-between"
                onClick={() => toggleCaseExpansion(group.case.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? 
                    <ChevronDown className="w-4 h-4 text-gray-400" /> : 
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  }
                  <Box className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{group.case.case_name}</h3>
                      <Badge variant="outline" className="text-xs">{group.case.case_type}</Badge>
                    </div>
                    <p className="text-sm text-gray-500">{group.products.length} components</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={`font-semibold ${allAvailable ? 'text-green-600' : noneAvailable ? 'text-red-500' : 'text-yellow-600'}`}>
                      {group.availableItems}/{group.totalItems}
                    </div>
                    <div className="text-xs text-gray-400">Available</div>
                  </div>
                  <Badge className={
                    allAvailable ? 'bg-green-100 text-green-800 border-green-200' :
                    noneAvailable ? 'bg-red-100 text-red-800 border-red-200' :
                    'bg-yellow-100 text-yellow-800 border-yellow-200'
                  }>
                    {allAvailable ? 'Complete' : noneAvailable ? 'All Out' : 'Partial'}
                  </Badge>
                  {group.availableItems > 0 && (
                    <Button 
                      size="sm" 
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLendCase(group);
                      }}
                    >
                      Lend Case
                    </Button>
                  )}
                </div>
              </div>

              {/* Case Products */}
              {isExpanded && (
                <div className="bg-gray-50 border-t">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-100">
                        <TableHead className="pl-12">Reference</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Availability</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.products.map((product) => {
                        const avail = getAvailability(product);
                        return (
                          <TableRow key={product.id} className="bg-white">
                            <TableCell className="pl-12 font-medium">{product.article_reference}</TableCell>
                            <TableCell>{product.brand}</TableCell>
                            <TableCell>{product.description}</TableCell>
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
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped Products */}
        {ungrouped.length > 0 && (
          <div className="bg-white">
            <div className="p-4 bg-gray-50 border-t">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Individual Products ({ungrouped.length})
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Availability</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ungrouped.map((product) => {
                  const avail = getAvailability(product);
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.article_reference}</TableCell>
                      <TableCell>{product.brand}</TableCell>
                      <TableCell>{product.description}</TableCell>
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
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {filteredProducts.length === 0 && (
          <div className="text-center py-8 text-gray-500">No products found.</div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-500">Manage your products and kits.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            <Button 
              variant={viewMode === 'grouped' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('grouped')}
              className="text-xs"
            >
              <Package className="w-3 h-3 mr-1" /> Grouped
            </Button>
            <Button 
              variant={viewMode === 'flat' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('flat')}
              className="text-xs"
            >
              List View
            </Button>
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
        
        {viewMode === 'flat' ? (
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
        ) : (
          <GroupedInventoryView />
        )}
      </div>

      <ProductModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        product={editingProduct}
        onSuccess={fetchData}
      />

      <BulkLendModal
        isOpen={isBulkLendOpen}
        onClose={() => setIsBulkLendOpen(false)}
        caseGroup={selectedCase}
        onSuccess={fetchData}
        currentUser={currentUser}
        getAvailability={getAvailability}
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
              Expected order: <strong>Reference, Brand, Description, Case Name, Quantity</strong>
            </p>
            <Textarea 
              placeholder={`AP-H100-BK\tAperio\tHandle\tDemo Kit A\t2\nYAL-L1\tYale\tSmart Lock\t\t3`}
              className="h-40 font-mono text-xs"
              value={importData}
              onChange={(e) => parsePaste(e.target.value)}
            />
            {parsedImport.length > 0 && (
              <div className="space-y-2">
                <div className="bg-blue-50 p-3 rounded text-sm text-blue-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Found {parsedImport.length} items to import.
                </div>
                {willCreateCases.length > 0 && (
                  <div className="bg-green-50 p-3 rounded text-sm text-green-700 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Will create {willCreateCases.length} new demo cases: {willCreateCases.join(', ')}
                  </div>
                )}
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
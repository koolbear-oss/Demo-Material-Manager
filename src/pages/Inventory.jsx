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
import { Plus, Upload, Search, Edit, AlertCircle, Package, ChevronDown, ChevronRight, Box, Loader2, CheckCircle2, Eye, ArrowDownRight } from 'lucide-react';
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
  const [expandedItems, setExpandedItems] = useState(new Set()); // For item drill-down
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

  // Enhanced availability calculation that handles individual items
  const getEnhancedAvailability = (product) => {
    // For individual items, use normal calculation
    if (product.is_individual_item) {
      const activeLoansCount = loans.filter(l => l.product_id === product.id).length;
      const available = product.quantity - activeLoansCount;
      return { available, total: product.quantity };
    }
    
    // For parent articles, check if they have individual items
    const childItems = products.filter(p => p.parent_article_id === product.id && p.is_individual_item);
    
    if (childItems.length > 0) {
      // Calculate aggregate from child items
      let totalAvailable = 0;
      let totalQuantity = childItems.length;
      
      childItems.forEach(item => {
        const itemLoans = loans.filter(l => l.product_id === item.id).length;
        const itemAvailable = item.quantity - itemLoans;
        totalAvailable += itemAvailable;
      });
      
      return { 
        available: totalAvailable, 
        total: totalQuantity, 
        hasIndividualItems: true, 
        childItems: childItems.map(item => ({
          ...item,
          availability: {
            available: item.quantity - loans.filter(l => l.product_id === item.id).length,
            total: item.quantity
          }
        }))
      };
    }
    
    // Regular article-level calculation
    const activeLoansCount = loans.filter(l => l.product_id === product.id).length;
    const available = product.quantity - activeLoansCount;
    return { available, total: product.quantity };
  };

  // Legacy availability for backward compatibility
  const getAvailability = (product) => {
    const enhanced = getEnhancedAvailability(product);
    return { available: enhanced.available, total: enhanced.total };
  };

  // Filter out parent articles with quantity=0 and individual items that should be grouped
  const getDisplayProducts = (productList) => {
    return productList.filter(product => {
      // Hide parent articles with quantity=0 that have individual items
      if (!product.is_individual_item && product.quantity === 0) {
        const hasChildItems = products.some(p => p.parent_article_id === product.id && p.is_individual_item);
        if (hasChildItems) return false;
      }
      
      // Hide individual items from main list (they'll be shown in drill-down)
      if (product.is_individual_item) return false;
      
      return true;
    });
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

  const toggleItemExpansion = (productId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedItems(newExpanded);
  };

  const filteredProducts = products.filter(p =>
    p.article_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGroupedProducts = () => {
    const grouped = {};
    const ungrouped = [];
    const displayProducts = getDisplayProducts(filteredProducts);
    
    displayProducts.forEach(product => {
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
        
        const enhancedAvail = getEnhancedAvailability(product);
        grouped[caseKey].products.push({...product, enhancedAvailability: enhancedAvail});
        grouped[caseKey].totalItems += enhancedAvail.total;
        grouped[caseKey].availableItems += enhancedAvail.available;
      } else {
        const enhancedAvail = getEnhancedAvailability(product);
        ungrouped.push({...product, enhancedAvailability: enhancedAvail});
      }
    });
    
    return { grouped, ungrouped };
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

  // Import functionality (simplified for space)
  const handleImport = async () => {
    try {
      const validItems = parsedImport.filter(i => i.article_reference && i.quantity);
      if (validItems.length === 0) return;

      const productsToCreate = validItems.map(item => ({
        article_reference: item.article_reference,
        brand: item.brand,
        description: item.description,
        quantity: item.quantity,
        belongs_to_case: false,
        can_lend_separately: true,
        is_individual_item: false
      }));

      await base44.entities.Product.bulkCreate(productsToCreate);
      
      base44.entities.ActivityLog.create({
        action: 'Bulk Import',
        details: `Imported ${validItems.length} products`,
        user_email: currentUser?.email || 'system',
        entity_type: 'Product'
      }).catch(console.error);

      setIsImportOpen(false);
      setImportData('');
      setParsedImport([]);
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
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      if (parts.length < 3) return null;
      
      return {
        article_reference: parts[0]?.trim(),
        brand: parts[1]?.trim(),
        description: parts[2]?.trim(),
        quantity: parseInt(parts[3]?.trim()) || 1
      };
    }).filter(Boolean);
    setParsedImport(parsed);
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
                        const avail = product.enhancedAvailability || getEnhancedAvailability(product);
                        const isItemExpanded = expandedItems.has(product.id);
                        const hasItems = avail.hasIndividualItems;
                        
                        return (
                          <React.Fragment key={product.id}>
                            {/* Parent Article Row */}
                            <TableRow className="bg-white">
                              <TableCell className="pl-12 font-medium">
                                <div className="flex items-center gap-2">
                                  {hasItems && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-5 w-5 p-0"
                                      onClick={() => toggleItemExpansion(product.id)}
                                    >
                                      {isItemExpanded ? 
                                        <ChevronDown className="w-3 h-3" /> : 
                                        <ChevronRight className="w-3 h-3" />
                                      }
                                    </Button>
                                  )}
                                  {product.article_reference}
                                  {hasItems && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                                      {avail.childItems.length} items
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
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
                            
                            {/* Individual Items Rows */}
                            {hasItems && isItemExpanded && avail.childItems.map(item => (
                              <TableRow key={item.id} className="bg-blue-50">
                                <TableCell className="pl-20 text-sm">
                                  <div className="flex items-center gap-1">
                                    <ArrowDownRight className="w-3 h-3 text-gray-400" />
                                    {item.item_identifier || item.serial_number || `Item ${item.id.slice(-3)}`}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-gray-600">
                                  {item.serial_number && (
                                    <Badge variant="outline" className="text-[9px] px-1">
                                      {item.serial_number}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-gray-600">Individual Item</TableCell>
                                <TableCell className="text-right text-sm">
                                  <span className={item.availability.available > 0 ? 'text-green-600' : 'text-red-500'}>
                                    {item.availability.available}
                                  </span>
                                  <span className="text-gray-400">/{item.availability.total}</span>
                                </TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
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
                  const avail = product.enhancedAvailability || getEnhancedAvailability(product);
                  const isItemExpanded = expandedItems.has(product.id);
                  const hasItems = avail.hasIndividualItems;
                  
                  return (
                    <React.Fragment key={product.id}>
                      {/* Parent Article Row */}
                      <TableRow>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {hasItems && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-5 w-5 p-0"
                                onClick={() => toggleItemExpansion(product.id)}
                              >
                                {isItemExpanded ? 
                                  <ChevronDown className="w-3 h-3" /> : 
                                  <ChevronRight className="w-3 h-3" />
                                }
                              </Button>
                            )}
                            {product.article_reference}
                            {hasItems && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {avail.childItems.length} items
                              </Badge>
                            )}
                          </div>
                        </TableCell>
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
                      
                      {/* Individual Items Rows */}
                      {hasItems && isItemExpanded && avail.childItems.map(item => (
                        <TableRow key={item.id} className="bg-blue-50">
                          <TableCell className="pl-8 text-sm">
                            <div className="flex items-center gap-1">
                              <ArrowDownRight className="w-3 h-3 text-gray-400" />
                              {item.item_identifier || item.serial_number || `Item ${item.id.slice(-3)}`}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {item.serial_number && (
                              <Badge variant="outline" className="text-[9px] px-1">
                                {item.serial_number}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">Individual Item</TableCell>
                          <TableCell className="text-right text-sm">
                            <span className={item.availability.available > 0 ? 'text-green-600' : 'text-red-500'}>
                              {item.availability.available}
                            </span>
                            <span className="text-gray-400">/{item.availability.total}</span>
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {getDisplayProducts(filteredProducts).length === 0 && (
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
          <p className="text-gray-500">Manage your products and kits with item-level tracking.</p>
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
              ) : getDisplayProducts(filteredProducts).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No products found.</TableCell></TableRow>
              ) : (
                getDisplayProducts(filteredProducts).map((product) => {
                  const avail = getEnhancedAvailability(product);
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {product.article_reference}
                          {avail.hasIndividualItems && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {avail.childItems.length} items
                            </Badge>
                          )}
                        </div>
                      </TableCell>
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

      {/* Simplified Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Bulk Import from Excel/CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-500">
              Copy columns from Excel and paste below. <br/>
              Expected order: <strong>Reference, Brand, Description, Quantity</strong>
            </p>
            <Textarea 
              placeholder={`AP-H100-BK\tAperio\tHandle\t2\nYAL-L1\tYale\tSmart Lock\t3`}
              className="h-40 font-mono text-xs"
              value={importData}
              onChange={(e) => parsePaste(e.target.value)}
            />
            {parsedImport.length > 0 && (
              <div className="bg-blue-50 p-3 rounded text-sm text-blue-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Found {parsedImport.length} items to import.
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
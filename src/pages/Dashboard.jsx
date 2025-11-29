import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, parseISO, isBefore, addDays, differenceInDays } from 'date-fns';
import { 
  Search, 
  Filter, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Package, 
  ArrowUpRight, 
  ArrowDownLeft,
  ChevronDown,
  ChevronRight,
  Box,
  RotateCcw,
  Users,
  ArrowDownRight
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LendModal from "@/components/LendModal";

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [loans, setLoans] = useState([]);
  const [demoCases, setDemoCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  
  // Modal states
  const [lendModalOpen, setLendModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [expandedLoanCases, setExpandedLoanCases] = useState(new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prods, allLoans, cases, user] = await Promise.all([
        base44.entities.Product.list('-created_date', 500),
        base44.entities.Loan.list('-created_date', 500),
        base44.entities.DemoCase.list('case_name', 100),
        base44.auth.me()
      ]);
      
      // Filter to only active loans (not returned)
      const activeLoans = allLoans.filter(l => l.status !== 'returned');

      setProducts(prods);
      setLoans(activeLoans);
      setDemoCases(cases);
      setCurrentUser(user);
    } catch (e) {
      console.error("Error fetching dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  const groupLoansByCase = (loansArray) => {
    const grouped = {};
    const ungrouped = [];
    
    loansArray.forEach(loan => {
      // Find the product to get demo case info
      const product = products.find(p => p.id === loan.product_id);
      const hasKitName = loan.kit_name && loan.kit_name.trim() !== '';
      const belongsToCase = product && product.belongs_to_case && product.demo_case_id;
      
      if (hasKitName) {
        // Group by kit_name (preferred method)
        const caseKey = `${loan.kit_name}_${loan.customer_name}`;
        
        if (!grouped[caseKey]) {
          grouped[caseKey] = {
            caseName: loan.kit_name,
            loans: [],
            customer: loan.customer_name,
            address: loan.customer_address,
            caseId: product?.demo_case_id || null,
            isComplete: true
          };
        }
        
        grouped[caseKey].loans.push(loan);
        
      } else if (belongsToCase) {
        // Fallback: Group by demo case + customer for loans with missing kit_name
        const demoCase = demoCases.find(dc => dc.id === product.demo_case_id);
        if (demoCase) {
          const caseKey = `${demoCase.case_name}_${loan.customer_name}`;
          
          if (!grouped[caseKey]) {
            grouped[caseKey] = {
              caseName: demoCase.case_name,
              loans: [],
              customer: loan.customer_name,
              address: loan.customer_address,
              caseId: demoCase.id,
              isComplete: false, // Flag for incomplete grouping data
              needsDataFix: true
            };
          }
          
          grouped[caseKey].loans.push(loan);
        } else {
          ungrouped.push(loan);
        }
      } else {
        ungrouped.push(loan);
      }
    });
    
    return { grouped: Object.values(grouped), ungrouped };
  };

  const toggleLoanCaseExpansion = (caseName) => {
    const newExpanded = new Set(expandedLoanCases);
    const key = caseName.replace(/[^a-zA-Z0-9]/g, '_'); // Safe key
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedLoanCases(newExpanded);
  };

  // Fix missing kit_name data
  const fixDemoCaseData = async (group) => {
    if (!group.needsDataFix) return;
    
    try {
      // Update all loans in this group to have the correct kit_name
      const updatePromises = group.loans.map(loan => 
        base44.entities.Loan.update(loan.id, {
          kit_name: group.caseName
        })
      );
      
      await Promise.all(updatePromises);
      
      // Log the fix
      base44.entities.ActivityLog.create({
        action: 'Fix Demo Case Data',
        details: `Fixed missing kit_name for ${group.loans.length} loans in ${group.caseName}`,
        user_email: currentUser?.email || 'system',
        entity_type: 'Loan'
      }).catch(console.error);
      
      // Refresh data
      fetchData();
    } catch (e) {
      console.error("Error fixing demo case data:", e);
    }
  };

  // Bulk return entire demo case
  const handleBulkReturn = async (group) => {
    if (!confirm(`Return all ${group.loans.length} items from ${group.caseName} back from ${group.customer}?`)) return;

    try {
      const updatePromises = group.loans.map(loan => 
        base44.entities.Loan.update(loan.id, {
          status: 'returned',
          actual_return_date: format(new Date(), 'yyyy-MM-dd')
        })
      );

      await Promise.all(updatePromises);
      
      // Log the bulk return
      base44.entities.ActivityLog.create({
        action: 'Bulk Return',
        details: `Returned complete ${group.caseName} (${group.loans.length} items) from ${group.customer}`,
        user_email: currentUser?.email || 'unknown',
        entity_type: 'Loan'
      }).catch(console.error);

      fetchData();
    } catch (e) {
      console.error("Error bulk returning case:", e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLendClick = (product) => {
    setSelectedProduct(product);
    setLendModalOpen(true);
  };

  const handleReturnClick = async (loan) => {
    if (!confirm(`Mark ${loan.product_article} as returned from ${loan.customer_name}?`)) return;

    try {
      await base44.entities.Loan.update(loan.id, {
        status: 'returned',
        actual_return_date: format(new Date(), 'yyyy-MM-dd')
      });
      
      base44.entities.ActivityLog.create({
        action: 'Return',
        details: `Returned ${loan.product_article} from ${loan.customer_name}`,
        user_email: currentUser?.email || 'unknown',
        entity_type: 'Loan',
        entity_id: loan.id
      }).catch(console.error);

      fetchData();
    } catch (e) {
      console.error("Error returning item", e);
    }
  };

  // --- Enhanced Product Availability with Item Tracking ---
  
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

  // Filter display products (hide parent articles with quantity=0 and individual items)
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

  // --- Derived Data Calculations ---

  // Calculate availability per product using enhanced method
  const productAvailability = getDisplayProducts(products).map(p => {
    const enhanced = getEnhancedAvailability(p);
    return { 
      ...p, 
      available: enhanced.available, 
      total: enhanced.total,
      hasIndividualItems: enhanced.hasIndividualItems,
      childItems: enhanced.childItems
    };
  });

  // Stats
  const totalItems = productAvailability.reduce((acc, p) => acc + (p.total || 0), 0);
  const totalOut = loans.filter(l => l.status === 'out').length;
  const totalSamples = loans.filter(l => l.status === 'sample').length;
  const totalAvailable = productAvailability.reduce((acc, p) => acc + (p.available || 0), 0);
  
  const overdueLoans = loans.filter(l => 
    l.status === 'out' && 
    l.expected_return_date && 
    isBefore(parseISO(l.expected_return_date), new Date())
  );

  // Filtered Lists
  const filteredProducts = productAvailability.filter(p => 
    p.article_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const myLoans = loans.filter(l => l.responsible_email === currentUser?.email);

  // Internal Components
  function GroupedLoanView({ loans, onReturn, showResponsible = false }) {
    const { grouped, ungrouped } = groupLoansByCase(loans);
    
    return (
      <div className="space-y-3">
        {/* Grouped Demo Case Loans */}
        {grouped.map((group) => {
          const safeKey = `${group.caseName}_${group.customer}`.replace(/[^a-zA-Z0-9]/g, '_');
          const isExpanded = expandedLoanCases.has(safeKey);
          const hasOverdue = group.loans.some(loan => 
            loan.status === 'out' && 
            loan.expected_return_date && 
            isBefore(parseISO(loan.expected_return_date), new Date())
          );
          
          return (
            <div key={safeKey} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Case Header */}
              <div 
                className="p-3 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors border-b"
                onClick={() => toggleLoanCaseExpansion(safeKey)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isExpanded ? 
                      <ChevronDown className="w-4 h-4 text-gray-400" /> : 
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    }
                    <Box className="w-4 h-4 text-blue-600" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900">{group.caseName}</span>
                        {group.needsDataFix && (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                            Needs Fix
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {group.customer} • {group.loans.length} items
                        {group.address && ` • ${group.address}`}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {hasOverdue && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                        Overdue
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                      {group.loans.filter(l => l.status === 'sample').length > 0 ? 'Mixed' : 'Active'}
                    </Badge>
                  </div>
                </div>
                
                {/* Action buttons */}
                {isExpanded && (
                  <div className="flex gap-2 mt-3 pt-2 border-t border-gray-200">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBulkReturn(group);
                      }}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Return All Items
                    </Button>
                    
                    {group.needsDataFix && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          fixDemoCaseData(group);
                        }}
                      >
                        Fix Data
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              {/* Case Items */}
              {isExpanded && (
                <div className="bg-white">
                  {group.loans.map(loan => (
                    <div key={loan.id} className="px-3 py-2 border-b border-gray-100 last:border-b-0">
                      <LoanItem loan={loan} onReturn={onReturn} showResponsible={showResponsible} compact={true} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Individual Loans */}
        {ungrouped.length > 0 && (
          <div>
            {grouped.length > 0 && (
              <div className="text-xs text-gray-500 font-medium mb-2 mt-4 flex items-center gap-1">
                <Users className="w-3 h-3" />
                Individual Items
              </div>
            )}
            <div className="space-y-2">
              {ungrouped.map(loan => (
                <LoanItem key={loan.id} loan={loan} onReturn={onReturn} showResponsible={showResponsible} />
              ))}
            </div>
          </div>
        )}
        
        {loans.length === 0 && (
          <p className="text-center text-gray-500 py-8">No active loans.</p>
        )}
      </div>
    );
  }

  function LoanItem({ loan, onReturn, showResponsible, compact = false }) {
    const isOverdue = loan.status === 'out' && loan.expected_return_date && isBefore(parseISO(loan.expected_return_date), new Date());
    const isSample = loan.status === 'sample';
    
    if (compact) {
      // Compact version for inside demo case groups
      return (
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-gray-900">{loan.product_article}</span>
              {isSample && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200 text-[9px] px-1 py-0 h-4">
                  Sample
                </Badge>
              )}
              {isOverdue && (
                <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                  Overdue
                </Badge>
              )}
            </div>
            <div className="text-xs text-gray-500 space-y-0.5">
              {showResponsible && <div>Resp: <span className="font-medium">{loan.responsible_name}</span></div>}
              {!isSample && (
                <div className={isOverdue ? "text-red-600 font-medium" : ""}>
                  Due: {loan.expected_return_date ? format(parseISO(loan.expected_return_date), 'MMM d') : 'N/A'}
                </div>
              )}
            </div>
          </div>
          
          {loan.status !== 'returned' && (
            <Button size="xs" variant="ghost" className="h-6 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => onReturn(loan)}>
              Return
            </Button>
          )}
        </div>
      );
    }
    
    // Original version for individual loans
    return (
      <div className={`p-3 rounded-lg border ${isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'} hover:shadow-sm transition-all`}>
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm text-gray-900">{loan.product_article}</h4>
              {loan.kit_name && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{loan.kit_name}</Badge>}
            </div>
            <p className="text-xs text-gray-500">{loan.customer_name}</p>
          </div>
          {isSample ? (
             <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">Sample</Badge>
          ) : isOverdue ? (
             <Badge variant="destructive" className="text-[10px]">Overdue</Badge>
          ) : (
             <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">Active</Badge>
          )}
        </div>
        
        <div className="flex justify-between items-end mt-2">
          <div className="text-xs text-gray-500 space-y-1">
            {showResponsible && <p>Resp: <span className="font-medium">{loan.responsible_name}</span></p>}
            {!isSample && (
               <p className={isOverdue ? "text-red-600 font-medium" : ""}>
                 Due: {loan.expected_return_date ? format(parseISO(loan.expected_return_date), 'MMM d') : 'N/A'}
               </p>
            )}
          </div>
          
          {loan.status !== 'returned' && (
            <Button size="xs" variant="ghost" className="h-7 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => onReturn(loan)}>
              Return
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {overdueLoans.length > 0 && (
           <div className="md:col-span-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between text-red-800 mb-2">
             <div className="flex items-center gap-2">
               <AlertCircle className="h-5 w-5" />
               <span className="font-bold">Alert: {overdueLoans.length} items are OVERDUE</span>
             </div>
             <Button variant="outline" size="sm" className="bg-white text-red-700 border-red-200 hover:bg-red-50" onClick={() => document.getElementById('loans-tab').click()}>
               View Items
             </Button>
           </div>
        )}
        
        <StatsCard title="Total Assets" value={totalItems} icon={Package} color="bg-blue-500" />
        <StatsCard title="Available" value={totalAvailable} icon={CheckCircle2} color="bg-green-500" />
        <StatsCard title="On Loan" value={totalOut} icon={ArrowUpRight} color="bg-amber-500" />
        <StatsCard title="Samples" value={totalSamples} icon={ArrowDownLeft} color="bg-purple-500" />
      </div>

      {/* Main Action Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Quick Check & Lend */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-md">
            <CardHeader className="pb-2">
              <CardTitle>Check Availability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input 
                  className="pl-10 py-6 text-lg"
                  placeholder="Search by name, reference, or brand..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {loading ? (
                  <div className="text-center py-8 text-gray-500">Loading inventory...</div>
                ) : filteredProducts.length === 0 ? (
                   searchTerm && <div className="text-center py-8 text-gray-500">No products found matching "{searchTerm}"</div>
                ) : (
                  filteredProducts.map(product => {
                    const demoCase = product.belongs_to_case && product.demo_case_id ? 
                      demoCases.find(dc => dc.id === product.demo_case_id) : null;
                    
                    return (
                      <div key={product.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg hover:shadow-sm transition-all group">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{product.article_reference}</h3>
                            <Badge variant="outline" className="text-xs text-gray-500 font-normal">{product.brand}</Badge>
                            {demoCase && (
                              <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">
                                <Package className="w-3 h-3 mr-1" />
                                {demoCase.case_name}
                              </Badge>
                            )}
                            {product.hasIndividualItems && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {product.childItems.length} items
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{product.description}</p>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className={`text-lg font-bold ${product.available > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {product.available} <span className="text-xs font-normal text-gray-400">/ {product.total}</span>
                            </div>
                            <div className="text-xs text-gray-400">Available</div>
                          </div>
                          
                          <Button 
                            disabled={product.available <= 0}
                            onClick={() => handleLendClick(product)}
                            className={product.available > 0 ? "bg-blue-600 hover:bg-blue-700" : "opacity-50"}
                          >
                            Lend Item
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Active Loans Overview */}
        <div className="space-y-6">
           <Card className="border-none shadow-md h-full">
             <CardHeader>
               <CardTitle>Active Activity</CardTitle>
             </CardHeader>
             <CardContent className="p-0">
               <Tabs defaultValue="my_loans" className="w-full">
                  <TabsList className="w-full rounded-none border-b bg-transparent px-6">
                    <TabsTrigger value="my_loans" className="flex-1">My Responsibility</TabsTrigger>
                    <TabsTrigger value="all_loans" id="loans-tab" className="flex-1">All Loans</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="my_loans" className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                    <GroupedLoanView loans={myLoans} onReturn={handleReturnClick} showResponsible={false} />
                  </TabsContent>

                  <TabsContent value="all_loans" className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                    <GroupedLoanView loans={loans.sort((a,b) => new Date(a.expected_return_date) - new Date(b.expected_return_date))} onReturn={handleReturnClick} showResponsible={true} />
                  </TabsContent>
               </Tabs>
             </CardContent>
           </Card>
        </div>
      </div>

      <LendModal 
        isOpen={lendModalOpen} 
        onClose={() => setLendModalOpen(false)} 
        product={selectedProduct}
        currentUser={currentUser}
        onSuccess={() => {
          fetchData(); // Refresh everything
        }}
      />
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, color }) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <h3 className="text-2xl font-bold mt-1">{value}</h3>
        </div>
        <div className={`p-3 rounded-full ${color} bg-opacity-10`}>
          <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
        </div>
      </CardContent>
    </Card>
  );
}
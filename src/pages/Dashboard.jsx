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
  ArrowDownLeft 
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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  
  // Modal states
  const [lendModalOpen, setLendModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prods, allLoans, user] = await Promise.all([
        base44.entities.Product.list('-created_date', 500),
        base44.entities.Loan.list('-created_date', 500),
        base44.auth.me()
      ]);
      
      // Filter to only active loans (not returned)
      const activeLoans = allLoans.filter(l => l.status !== 'returned');

      setProducts(prods);
      setLoans(activeLoans);
      setCurrentUser(user);
    } catch (e) {
      console.error("Error fetching dashboard data", e);
    } finally {
      setLoading(false);
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

  // --- Derived Data Calculations ---

  // Calculate availability per product
  const productAvailability = products.map(p => {
    const activeLoansCount = loans.filter(l => l.product_id === p.id && l.status === 'out').length;
    const sampleCount = loans.filter(l => l.product_id === p.id && l.status === 'sample').length;
    const available = p.quantity - activeLoansCount - sampleCount;
    return { ...p, available, activeLoansCount, sampleCount };
  });

  // Stats
  const totalItems = products.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const totalOut = loans.filter(l => l.status === 'out').length;
  const totalSamples = loans.filter(l => l.status === 'sample').length;
  const totalAvailable = totalItems - totalOut - totalSamples;
  
  const overdueLoans = loans.filter(l => 
    l.status === 'out' && 
    l.expected_return_date && 
    isBefore(parseISO(l.expected_return_date), new Date())
  );

  // Filtered Lists
  const filteredProducts = productAvailability.filter(p => 
    p.article_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.kit_name && p.kit_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const myLoans = loans.filter(l => l.responsible_email === currentUser?.email);

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
                  filteredProducts.map(product => (
                    <div key={product.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg hover:shadow-sm transition-all group">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{product.article_reference}</h3>
                          <Badge variant="outline" className="text-xs text-gray-500 font-normal">{product.brand}</Badge>
                          {product.kit_name && <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100">Kit: {product.kit_name}</Badge>}
                        </div>
                        <p className="text-sm text-gray-500">{product.description}</p>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className={`text-lg font-bold ${product.available > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {product.available} <span className="text-xs font-normal text-gray-400">/ {product.quantity}</span>
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
                  ))
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
                    {myLoans.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">You have no active loans.</p>
                    ) : (
                      myLoans.map(loan => <LoanItem key={loan.id} loan={loan} onReturn={handleReturnClick} />)
                    )}
                  </TabsContent>
                  
                  <TabsContent value="all_loans" className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                    {loans.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No items currently on loan.</p>
                    ) : (
                      loans.sort((a,b) => new Date(a.expected_return_date) - new Date(b.expected_return_date)).map(loan => <LoanItem key={loan.id} loan={loan} onReturn={handleReturnClick} showResponsible />)
                    )}
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

function LoanItem({ loan, onReturn, showResponsible }) {
  const isOverdue = loan.status === 'out' && loan.expected_return_date && isBefore(parseISO(loan.expected_return_date), new Date());
  const isSample = loan.status === 'sample';
  
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
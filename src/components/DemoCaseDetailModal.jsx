import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Package, MapPin, Info, Building, ExternalLink } from 'lucide-react';

export default function DemoCaseDetailModal({ isOpen, onClose, demoCase, products, loans }) {
  if (!demoCase) return null;

  const caseProducts = products.filter(p => p.demo_case_id === demoCase.id);
  
  const getProductStatus = (product) => {
    const activeLoan = loans.find(l => l.product_id === product.id);
    if (activeLoan) {
      return { 
        status: 'out', 
        customer: activeLoan.customer_name,
        address: activeLoan.customer_address,
        returnDate: activeLoan.expected_return_date 
      };
    }
    return { status: 'available' };
  };

  const availableCount = caseProducts.filter(p => getProductStatus(p).status === 'available').length;
  
  const openGoogleMaps = (address) => {
    if (address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {demoCase.case_name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Location Section */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Building className="w-4 h-4" /> Base Location
            </div>
            <div className="pl-6">
              <div className="font-medium">{demoCase.base_location || 'Not specified'}</div>
              {demoCase.base_address && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-500">{demoCase.base_address}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => openGoogleMaps(demoCase.base_address)}>
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Type:</span>
              <Badge variant="outline" className="ml-2">{demoCase.case_type}</Badge>
            </div>
            {demoCase.software_version && (
              <div>
                <span className="text-gray-500">Software:</span>
                <span className="ml-2 font-medium">{demoCase.software_version}</span>
              </div>
            )}
            {demoCase.serial_number && (
              <div>
                <span className="text-gray-500">Serial:</span>
                <span className="ml-2 font-medium">{demoCase.serial_number}</span>
              </div>
            )}
          </div>

          {demoCase.description && (
            <div className="bg-gray-50 p-3 rounded text-sm text-gray-600 flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 text-gray-400" />
              {demoCase.description}
            </div>
          )}

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Components</h3>
              <Badge className={availableCount === caseProducts.length ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                {availableCount}/{caseProducts.length} Available
              </Badge>
            </div>

            {caseProducts.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No products linked to this demo case yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article Ref</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Lend Separately</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {caseProducts.map(product => {
                    const status = getProductStatus(product);
                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.article_reference}</TableCell>
                        <TableCell>{product.description}</TableCell>
                        <TableCell>
                          {product.can_lend_separately ? (
                            <Badge variant="outline" className="text-green-600">Yes</Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600">No</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {status.status === 'available' ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-4 h-4" /> Available
                            </div>
                          ) : (
                            <div className="text-red-600">
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" /> {status.customer}
                              </div>
                              {status.address && (
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                  {status.address}
                                  <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => openGoogleMaps(status.address)}>
                                    <ExternalLink className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
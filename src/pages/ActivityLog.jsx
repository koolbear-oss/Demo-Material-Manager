import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, History } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await base44.entities.ActivityLog.list('created_date', 100);
      setLogs(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const headers = ['Date', 'User', 'Action', 'Details'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log => [
        format(parseISO(log.created_date), 'yyyy-MM-dd HH:mm:ss'),
        `"${log.user_email || 'System'}"`,
        `"${log.action}"`,
        `"${log.details.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `activity_log_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-gray-500">Audit trail of all system actions.</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead className="w-[200px]">User</TableHead>
              <TableHead className="w-[150px]">Action</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-500">No activity recorded yet.</TableCell></TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-gray-500 font-mono text-xs">
                    {format(parseISO(log.created_date), 'MMM d, HH:mm')}
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {log.user_email}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-100">
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-600 text-sm">{log.details}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
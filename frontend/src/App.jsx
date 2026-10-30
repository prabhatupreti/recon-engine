import React, { useState, useMemo, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, CheckCircle2, AlertTriangle, Search, Download, 
  RefreshCw, Layers, ChevronRight, ChevronDown, Building2, FileText, 
  Trash2, X, Settings, UserCircle, Activity, ShieldCheck, PlayCircle,
  UploadCloud, Cpu, ArrowUpRight, ArrowDownRight, BarChart3
} from 'lucide-react';

export default function App() {
  const [ledgerFile, setLedgerFile] = useState(null);
  const [bankFile, setBankFile] = useState(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [viewMode, setViewMode] = useState('analytics');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  const [dragActiveLedger, setDragActiveLedger] = useState(false);
  const [dragActiveBank, setDragActiveBank] = useState(false);

  const ledgerInputRef = useRef(null);
  const bankInputRef = useRef(null);

  const handleDrag = (e, type, status) => {
    e.preventDefault(); e.stopPropagation();
    if (type === 'ledger') setDragActiveLedger(status);
    if (type === 'bank') setDragActiveBank(status);
  };

  const handleDrop = (e, type) => {
    e.preventDefault(); e.stopPropagation();
    setDragActiveLedger(false); setDragActiveBank(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      if (type === 'ledger') setLedgerFile(e.dataTransfer.files[0]);
      if (type === 'bank') setBankFile(e.dataTransfer.files[0]);
    }
  };

  const handleRunReconciliation = async () => {
    if (!ledgerFile || !bankFile) return;
    setIsReconciling(true); setError(null); setResult(null);
    setSearchTerm(''); setStatusFilter('all'); setExpandedRows(new Set());

    const formData = new FormData();
    formData.append('ledger', ledgerFile);
    formData.append('statement', bankFile);

    try {
      const res = await axios.post('http://localhost:5000/api/reconcile', formData);
      setResult(res.data);
      
      // DEFAULT TO ANALYTICS VIEW
      setViewMode('analytics');
      
      if (!res.data.passed) {
        setError('Reconciliation completed, but variances were found. Review the Variance Summary tab.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setIsReconciling(false);
    }
  };

  const resetReconciliation = () => {
    setResult(null); setLedgerFile(null); setBankFile(null); setError(null);
    setSearchTerm(''); setStatusFilter('all'); setExpandedRows(new Set()); 
    setViewMode('analytics');
  };

  const toggleRowExpand = (id) => {
    const next = new Set(expandedRows);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedRows(next);
  };

  const formatCompact = (val) => {
    if (val === undefined || val === null) return 'Rs. 0';
    const absVal = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    
    if (absVal >= 10000000) return `${sign}Rs. ${(absVal / 10000000).toFixed(2)} Cr`;
    if (absVal >= 100000) return `${sign}Rs. ${(absVal / 100000).toFixed(2)} L`;
    return `${sign}Rs. ${absVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const formatRawMoney = (val) => {
    if (val === undefined || val === null) return '-';
    return `Rs. ${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '-';
    const num = Number(val);
    const sign = num < 0 ? '-' : (num > 0 ? '+' : '');
    return `${sign}Rs. ${Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const exportToExcel = () => {
    if (!result) return;
    const wb = XLSX.utils.book_new();

    const cycleData = result.rangeReconciliation.map(c => ({
      "Cycle Start": c.cycleStart, "Cycle End": c.cycleEnd, "Ledger Movement": c.ledgerNet,
      "Bank Movement": c.bankNet, "Variance": c.variance, "Status": c.isMatch ? "Matched" : "Variance"
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cycleData), "Cycle Reconciliation");

    const dailyData = result.tieout.days.map(d => ({
      "Date": d.date, "Ledger Balance": d.ledgerBalance, "Bank Balance": d.bankBalance,
      "Difference": d.delta, "Status": d.passed ? "Matched" : "Mismatch"
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailyData), "Daily Balance Tie-Out");

    XLSX.writeFile(wb, `Recon_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const analytics = useMemo(() => {
    if (!result) return null;
    
    let ledgerInflow = 0, ledgerOutflow = 0;
    let bankInflow = 0, bankOutflow = 0;
    
    result.rangeReconciliation.forEach(cycle => {
      cycle.transactions.ledger.forEach(tx => {
        if (tx.amount > 0) ledgerInflow += tx.amount;
        else ledgerOutflow += Math.abs(tx.amount);
      });
      cycle.transactions.bank.forEach(tx => {
        if (tx.amount > 0) bankInflow += tx.amount;
        else bankOutflow += Math.abs(tx.amount);
      });
    });

    const totalVariance = result.rangeReconciliation.reduce((sum, c) => sum + Math.abs(c.variance), 0);
    const matchedCycles = result.rangeReconciliation.filter(c => c.isMatch).length;
    const totalCycles = result.rangeReconciliation.length;
    const cycleMatchRate = totalCycles > 0 ? Math.round((matchedCycles / totalCycles) * 100) : 0;
    
    const matchedDays = result.tieout.days.filter(d => d.passed).length;
    const totalDays = result.tieout.days.length;
    const dailyMatchRate = totalDays > 0 ? Math.round((matchedDays / totalDays) * 100) : 0;

    const maxVolume = Math.max(ledgerInflow + ledgerOutflow, bankInflow + bankOutflow);

    return { 
      ledgerRows: result.ledger.rowCount, bankRows: result.bank.rowCount,
      ledgerInflow, ledgerOutflow, ledgerVolume: ledgerInflow + ledgerOutflow,
      bankInflow, bankOutflow, bankVolume: bankInflow + bankOutflow,
      totalVariance, matchedCycles, totalCycles, cycleMatchRate,
      matchedDays, totalDays, dailyMatchRate, maxVolume
    };
  }, [result]);

  const filteredCycles = useMemo(() => {
    if (!result?.rangeReconciliation) return [];
    return result.rangeReconciliation.filter(c => {
      const matchesSearch = c.cycleEnd.includes(searchTerm) || c.ledgerNet.toString().includes(searchTerm) || c.bankNet.toString().includes(searchTerm);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'matched' && c.isMatch) || (statusFilter === 'mismatch' && !c.isMatch);
      return matchesSearch && matchesStatus;
    });
  }, [result, searchTerm, statusFilter]);

  const filteredDays = useMemo(() => {
    if (!result?.tieout?.days) return [];
    return result.tieout.days.filter(d => {
      const matchesSearch = d.date.includes(searchTerm) || d.bankBalance.toString().includes(searchTerm) || d.ledgerBalance.toString().includes(searchTerm);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'matched' && d.passed) || (statusFilter === 'mismatch' && !d.passed);
      return matchesSearch && matchesStatus;
    });
  }, [result, searchTerm, statusFilter]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#334155] font-sans overflow-x-hidden">
      
      <header className="sticky top-0 z-50 w-full bg-[#0F172A] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-[#2563EB] flex items-center justify-center shadow-sm">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Recon Engine</span>
          </div>
          <div className="flex items-center space-x-5">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full bg-[#1E293B] border border-slate-700 text-xs font-medium text-slate-300">
              <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
              <span>v3.7.0 - Online</span>
            </div>
            <button className="text-slate-400 hover:text-white transition-colors"><Settings className="h-5 w-5" /></button>
            <button className="text-slate-400 hover:text-white transition-colors"><UserCircle className="h-6 w-6" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4">
        
        {!result && (
          <div className="h-[calc(100vh-4rem)] flex flex-col justify-center items-center max-w-5xl mx-auto w-full py-4 animate-in fade-in duration-500">
            
            <div className="text-center space-y-4 mb-10 w-full relative">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100 via-transparent to-transparent -z-10" />
              <h1 className="text-4xl sm:text-5xl font-extrabold text-[#0F172A] tracking-tight">
                Automated Financial <span className="text-[#2563EB]">Reconciliation</span>
              </h1>
              <p className="text-base text-slate-500 max-w-2xl mx-auto">
                Upload your Ledger and Bank Statement. Our engine parses any format, matches balances across cycles, and builds the bridge for exceptions.
              </p>
              
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <span className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-full text-sm font-medium text-slate-600 shadow-sm">
                  <ShieldCheck className="h-4 w-4 text-[#10B981]" /> 100% Privacy
                </span>
                <span className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-full text-sm font-medium text-slate-600 shadow-sm">
                  <Cpu className="h-4 w-4 text-[#2563EB]" /> Multi-Format Parser
                </span>
                <span className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-full text-sm font-medium text-slate-600 shadow-sm">
                  <Activity className="h-4 w-4 text-purple-500" /> Cycle Tie-Out
                </span>
              </div>
            </div>

            <div className="w-full mb-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                <div className="hidden md:block absolute top-8 left-[15%] right-[15%] h-0.5 bg-slate-200 -z-10" />
                <div className="text-center space-y-2 bg-[#F8FAFC] px-4">
                  <div className="h-14 w-14 bg-white border border-[#E2E8F0] rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                    <UploadCloud className="h-6 w-6 text-[#2563EB]" />
                  </div>
                  <h4 className="font-bold text-[#0F172A]">1. Upload Files</h4>
                  <p className="text-xs text-slate-500 max-w-[200px] mx-auto">Drag and drop your Ledger and Bank Statement.</p>
                </div>
                <div className="text-center space-y-2 bg-[#F8FAFC] px-4">
                  <div className="h-14 w-14 bg-white border border-[#E2E8F0] rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                    <Cpu className="h-6 w-6 text-[#2563EB]" />
                  </div>
                  <h4 className="font-bold text-[#0F172A]">2. Run Engine</h4>
                  <p className="text-xs text-slate-500 max-w-[200px] mx-auto">We auto-detect columns and match balances across cycles.</p>
                </div>
                <div className="text-center space-y-2 bg-[#F8FAFC] px-4">
                  <div className="h-14 w-14 bg-white border border-[#E2E8F0] rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                    <ShieldCheck className="h-6 w-6 text-[#2563EB]" />
                  </div>
                  <h4 className="font-bold text-[#0F172A]">3. Export Audit</h4>
                  <p className="text-xs text-slate-500 max-w-[200px] mx-auto">Review exceptions and export a dual-sheet Excel report.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mb-8">
              <div 
                onDragOver={(e) => handleDrag(e, 'ledger', true)} 
                onDragLeave={(e) => handleDrag(e, 'ledger', false)} 
                onDrop={(e) => handleDrop(e, 'ledger')} 
                className={`rounded-2xl border-2 border-dashed bg-white p-6 text-center transition-all flex flex-col items-center justify-center min-h-[180px] ${
                  ledgerFile ? 'border-[#10B981] bg-emerald-50/20' : 
                  dragActiveLedger ? 'border-[#2563EB] bg-blue-50' : 'border-[#E2E8F0] hover:border-[#2563EB]'
                }`}
              >
                <input ref={ledgerInputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && setLedgerFile(e.target.files[0])} />
                <div className={`p-3 rounded-full mb-3 ${ledgerFile ? 'bg-emerald-100 text-[#10B981]' : 'bg-slate-100 text-[#2563EB]'}`}>
                  {ledgerFile ? <CheckCircle2 className="h-6 w-6" /> : <FileSpreadsheet className="h-6 w-6" />}
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-1">Office Ledger</h3>
                <p className="text-xs text-slate-500 mb-4">Supports .xlsx files</p>
                {ledgerFile ? (
                  <div className="text-center">
                    <p className="text-sm font-bold text-[#0F172A]">{ledgerFile.name}</p>
                    <p className="text-xs text-slate-500">{formatBytes(ledgerFile.size)}</p>
                    <button onClick={() => setLedgerFile(null)} className="mt-2 text-xs font-bold text-[#B41E43] hover:underline">Remove File</button>
                  </div>
                ) : (
                  <button onClick={() => ledgerInputRef.current?.click()} className="px-5 py-1.5 bg-[#2563EB] text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors">
                    Browse File
                  </button>
                )}
              </div>

              <div 
                onDragOver={(e) => handleDrag(e, 'bank', true)} 
                onDragLeave={(e) => handleDrag(e, 'bank', false)} 
                onDrop={(e) => handleDrop(e, 'bank')} 
                className={`rounded-2xl border-2 border-dashed bg-white p-6 text-center transition-all flex flex-col items-center justify-center min-h-[180px] ${
                  bankFile ? 'border-[#10B981] bg-emerald-50/20' : 
                  dragActiveBank ? 'border-[#2563EB] bg-blue-50' : 'border-[#E2E8F0] hover:border-[#2563EB]'
                }`}
              >
                <input ref={bankInputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && setBankFile(e.target.files[0])} />
                <div className={`p-3 rounded-full mb-3 ${bankFile ? 'bg-emerald-100 text-[#10B981]' : 'bg-slate-100 text-[#2563EB]'}`}>
                  {bankFile ? <CheckCircle2 className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-1">Bank Statement</h3>
                <p className="text-xs text-slate-500 mb-4">Supports .xlsx files</p>
                {bankFile ? (
                  <div className="text-center">
                    <p className="text-sm font-bold text-[#0F172A]">{bankFile.name}</p>
                    <p className="text-xs text-slate-500">{formatBytes(bankFile.size)}</p>
                    <button onClick={() => setBankFile(null)} className="mt-2 text-xs font-bold text-[#B41E43] hover:underline">Remove File</button>
                  </div>
                ) : (
                  <button onClick={() => bankInputRef.current?.click()} className="px-5 py-1.5 bg-[#2563EB] text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors">
                    Browse File
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center">
              <button
                onClick={handleRunReconciliation}
                disabled={!ledgerFile || !bankFile || isReconciling}
                className="flex items-center space-x-2 px-8 py-3 bg-[#0F172A] text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 disabled:opacity-50 transition-all"
              >
                {isReconciling ? <RefreshCw className="h-5 w-5 animate-spin" /> : <PlayCircle className="h-5 w-5" />}
                <span>{isReconciling ? 'Processing...' : 'Run Reconciliation Engine'}</span>
              </button>
            </div>
            
          </div>
        )}

        {result && (
          <div className="pt-8 pb-16 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2">
              <div>
                <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Financial Reconciliation</h1>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={exportToExcel} className="flex items-center space-x-2 px-4 py-2 bg-[#10B981] text-white rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-600 transition-colors">
                  <Download className="h-4 w-4" /><span>Export Excel</span>
                </button>
                <button onClick={resetReconciliation} className="flex items-center space-x-2 px-4 py-2 bg-white border border-[#E2E8F0] text-[#0F172A] rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors">
                  <RefreshCw className="h-4 w-4" /><span>New Run</span>
                </button>
              </div>
            </div>

            {error && !result.passed && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 shadow-sm">
                <AlertTriangle className="h-5 w-5 text-[#B41E43] shrink-0 mt-0.5" />
                <div className="flex-1"><p className="text-sm text-rose-700 font-medium">{error}</p></div>
                <button onClick={() => setError(null)} className="text-[#B41E43]"><X className="h-5 w-5" /></button>
              </div>
            )}

            {/* TAB BAR WITH INTEGRATED VARIANCE TOGGLE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => { setViewMode('analytics'); setExpandedRows(new Set()); }} className={`px-4 py-1.5 rounded-md text-sm font-bold ${viewMode === 'analytics' ? 'bg-white shadow-sm text-[#2563EB]' : 'text-slate-500 hover:text-slate-700'}`}>Analytics</button>
                <button onClick={() => { setViewMode('cycle'); setExpandedRows(new Set()); }} className={`px-4 py-1.5 rounded-md text-sm font-bold ${viewMode === 'cycle' ? 'bg-white shadow-sm text-[#2563EB]' : 'text-slate-500 hover:text-slate-700'}`}>Cycle View</button>
                <button onClick={() => { setViewMode('daily'); setExpandedRows(new Set()); }} className={`px-4 py-1.5 rounded-md text-sm font-bold ${viewMode === 'daily' ? 'bg-white shadow-sm text-[#2563EB]' : 'text-slate-500 hover:text-slate-700'}`}>Daily View</button>
                
                {/* VARIANCE TOGGLE */}
                {!result.passed && (
                  <button 
                    onClick={() => { setViewMode('variance'); setExpandedRows(new Set()); }} 
                    className={`px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-1.5 transition-colors ${viewMode === 'variance' ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}`}
                  >
                    <AlertTriangle className="h-4 w-4" /> Variance Summary
                  </button>
                )}
              </div>

              {viewMode !== 'analytics' && viewMode !== 'variance' && (
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto animate-in fade-in">
                  <div className="relative w-full sm:w-64">
                    <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                    <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]" />
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    {['all', 'matched', 'mismatch'].map(f => (
                      <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-1.5 rounded-md text-xs font-bold capitalize ${statusFilter === f ? 'bg-white shadow-sm text-[#0F172A]' : 'text-slate-500'}`}>{f}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ACTIONABLE VARIANCE VIEW */}
            {viewMode === 'variance' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 shadow-sm mb-4">
                   <h3 className="text-sm font-bold text-[#B41E43] flex items-center gap-2 mb-1">
                     <AlertTriangle className="h-4 w-4" /> Actionable Variance Summary
                   </h3>
                   <p className="text-xs text-rose-700">
                     The Bank Statement is treated as the <strong>source of truth</strong>. Expand a cycle below to compare your Ledger entries against the exact Bank entries, so you can identify missing or incorrect items.
                   </p>
                </div>
                
                {result.rangeReconciliation.filter(c => !c.isMatch).map((cycle) => {
                  const rowId = `var-${cycle.cycleEnd}`;
                  const isExpanded = expandedRows.has(rowId);
                  
                  // Determine required action text
                  const isBankHigher = cycle.variance > 0;
                  const actionText = isBankHigher 
                    ? `Bank is higher than Ledger. You need to add missing Receipts (Inflow) or remove incorrect Payments (Outflow) totaling ${formatCompact(Math.abs(cycle.variance))}.` 
                    : `Ledger is higher than Bank. You need to add missing Payments (Outflow) or remove incorrect Receipts (Inflow) totaling ${formatCompact(Math.abs(cycle.variance))}.`;

                  return (
                    <div key={cycle.cycleEnd} className="bg-white border border-rose-200 rounded-xl overflow-hidden shadow-sm">
                      <div 
                        onClick={() => toggleRowExpand(rowId)}
                        className="p-4 bg-rose-50/50 flex flex-wrap justify-between items-center cursor-pointer hover:bg-rose-50 transition-colors"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-[#B41E43]">{cycle.cycleStart} to {cycle.cycleEnd}</span>
                            <span className="text-sm text-slate-600 border-l border-rose-200 pl-4">Variance: <strong className="text-[#B41E43]">{formatCurrency(cycle.variance)}</strong></span>
                          </div>
                          <p className="text-xs text-rose-700 font-medium mt-1">{actionText}</p>
                        </div>
                        <div className="flex items-center gap-4 mt-2 sm:mt-0">
                          {isExpanded ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-4 border-t border-rose-100 bg-white">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Ledger Side */}
                            <div>
                              <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase">Your Ledger Entries ({cycle.ledgerCount})</h4>
                              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                {cycle.transactions.ledger.length === 0 && <p className="text-xs text-slate-400 italic">No entries</p>}
                                {cycle.transactions.ledger.map((tx, i) => (
                                  <div key={i} className="flex justify-between items-start bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-mono shadow-sm">
                                    <span className="flex-1 whitespace-normal break-words text-slate-700 pr-4">
                                      <span className="text-[#2563EB] font-bold mr-2">{tx.date}</span>
                                      {tx.desc}
                                    </span>
                                    <span className={`flex-shrink-0 font-bold ${tx.amount < 0 ? 'text-[#B41E43]' : 'text-[#10B981]'}`}>{formatCurrency(tx.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Bank Side (Truth) */}
                            <div>
                              <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase">Bank Statement Entries ({cycle.bankCount})</h4>
                              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                {cycle.transactions.bank.length === 0 && <p className="text-xs text-slate-400 italic">No entries</p>}
                                {cycle.transactions.bank.map((tx, i) => (
                                  <div key={i} className="flex justify-between items-start bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-xs font-mono shadow-sm">
                                    <span className="flex-1 whitespace-normal break-words text-slate-700 pr-4">
                                      <span className="text-[#2563EB] font-bold mr-2">{tx.date}</span>
                                      <span className="text-slate-400 mr-2">[{tx.category}]</span>
                                      {tx.desc}
                                    </span>
                                    <span className={`flex-shrink-0 font-bold ${tx.amount < 0 ? 'text-[#B41E43]' : 'text-[#10B981]'}`}>{formatCurrency(tx.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ANALYTICS VIEW */}
            {viewMode === 'analytics' && analytics && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Office Ledger</span>
                        <div className="text-3xl font-black text-[#0F172A] mt-1">{analytics.ledgerRows} <span className="text-sm font-medium text-slate-400">rows</span></div>
                      </div>
                      <div className="p-2 bg-blue-50 rounded-lg text-[#2563EB]"><FileSpreadsheet className="h-5 w-5" /></div>
                    </div>
                    <div className="flex flex-col gap-1 text-xs font-medium">
                      <div className="flex justify-between">
                        <span className="text-slate-500 flex items-center gap-1"><ArrowUpRight className="h-3 w-3 text-[#10B981]" /> Inflow</span>
                        <span className="text-[#0F172A] font-mono">{formatCompact(analytics.ledgerInflow)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 flex items-center gap-1"><ArrowDownRight className="h-3 w-3 text-[#B41E43]" /> Outflow</span>
                        <span className="text-[#0F172A] font-mono">{formatCompact(analytics.ledgerOutflow)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bank Statement</span>
                        <div className="text-3xl font-black text-[#0F172A] mt-1">{analytics.bankRows} <span className="text-sm font-medium text-slate-400">rows</span></div>
                      </div>
                      <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><Building2 className="h-5 w-5" /></div>
                    </div>
                    <div className="flex flex-col gap-1 text-xs font-medium">
                      <div className="flex justify-between">
                        <span className="text-slate-500 flex items-center gap-1"><ArrowUpRight className="h-3 w-3 text-[#10B981]" /> Inflow</span>
                        <span className="text-[#0F172A] font-mono">{formatCompact(analytics.bankInflow)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 flex items-center gap-1"><ArrowDownRight className="h-3 w-3 text-[#B41E43]" /> Outflow</span>
                        <span className="text-[#0F172A] font-mono">{formatCompact(analytics.bankOutflow)}</span>
                      </div>
                    </div>
                  </div>

                  {/* REDESIGNED MATCH RATES CARD */}
                  <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Match Rates</span>
                      <Activity className="h-4 w-4 text-slate-400" />
                    </div>
                    
                    <div className="space-y-4 mt-2">
                      {/* Cycles Progress */}
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span className="text-slate-600">Cycles</span>
                          <span className="text-[#0F172A]">{analytics.matchedCycles} / {analytics.totalCycles} ({analytics.cycleMatchRate}%)</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${analytics.cycleMatchRate === 100 ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`} style={{width: `${analytics.cycleMatchRate}%`}} />
                        </div>
                      </div>

                      {/* Days Progress */}
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span className="text-slate-600">Days</span>
                          <span className="text-[#0F172A]">{analytics.matchedDays} / {analytics.totalDays} ({analytics.dailyMatchRate}%)</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${analytics.dailyMatchRate === 100 ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`} style={{width: `${analytics.dailyMatchRate}%`}} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col justify-center relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1 h-full ${analytics.totalVariance > 0 ? 'bg-[#B41E43]' : 'bg-[#10B981]'}`} />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Variance</span>
                    <div className={`text-3xl font-black mt-1 ${analytics.totalVariance > 0 ? 'text-[#B41E43]' : 'text-[#10B981]'}`}>
                      {formatCompact(analytics.totalVariance)}
                    </div>
                    <p className="text-xs text-slate-500 mt-2 font-medium">
                      {analytics.totalVariance === 0 ? 'Fully reconciled' : 'Requires review'}
                    </p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm">
                  <h3 className="font-bold text-[#0F172A] mb-6 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-[#2563EB]" /> Cycle Volume Comparison
                  </h3>
                  
                  <div className="space-y-6">
                    {result.rangeReconciliation.map((cycle, idx) => {
                      const cycleLedgerVol = cycle.transactions.ledger.reduce((s, t) => s + Math.abs(t.amount), 0);
                      const cycleBankVol = cycle.transactions.bank.reduce((s, t) => s + Math.abs(t.amount), 0);
                      const maxCycleVol = Math.max(cycleLedgerVol, cycleBankVol, analytics.maxVolume);
                      
                      return (
                        <div key={idx} className="relative">
                          <div className="flex justify-between text-sm mb-3">
                            <span className="font-bold text-[#0F172A]">{cycle.cycleStart} to {cycle.cycleEnd}</span>
                            <span className={`font-bold flex items-center gap-1 ${cycle.isMatch ? 'text-[#10B981]' : 'text-[#B41E43]'}`}>
                              {cycle.isMatch ? <><CheckCircle2 className="h-4 w-4"/> Matched</> : <><AlertTriangle className="h-4 w-4"/> Variance</>}
                            </span>
                          </div>
                          
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-3">
                              <span className="w-14 text-[10px] font-bold text-slate-400 text-right uppercase tracking-wider">Ledger</span>
                              <div className="flex-1 flex items-center">
                                <div className="h-4 bg-[#0F172A] rounded-sm" style={{ width: `${Math.max(2, (cycleLedgerVol / maxCycleVol) * 100)}%` }} />
                              </div>
                              <span className="w-24 text-xs font-mono font-bold text-slate-600 text-right">{formatCompact(cycleLedgerVol)}</span>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <span className="w-14 text-[10px] font-bold text-slate-400 text-right uppercase tracking-wider">Bank</span>
                              <div className="flex-1 flex items-center">
                                <div className={`h-4 rounded-sm ${cycle.isMatch ? 'bg-[#10B981]' : 'bg-[#B41E43]'}`} style={{ width: `${Math.max(2, (cycleBankVol / maxCycleVol) * 100)}%` }} />
                              </div>
                              <span className="w-24 text-xs font-mono font-bold text-slate-600 text-right">{formatCompact(cycleBankVol)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* CYCLE VIEW */}
            {viewMode === 'cycle' && (
              <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F8FAFC] text-slate-500 uppercase text-xs font-bold border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-3 px-4 w-8"></th>
                      <th className="py-3 px-4">Cycle Period</th>
                      <th className="py-3 px-4 text-right">Ledger Movement</th>
                      <th className="py-3 px-4 text-right">Bank Movement</th>
                      <th className="py-3 px-4 text-right">Variance</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredCycles.map((cycle) => {
                      const rowId = `cycle-${cycle.cycleEnd}`;
                      const isExpanded = expandedRows.has(rowId);
                      return (
                        <React.Fragment key={cycle.cycleEnd}>
                          <tr onClick={() => toggleRowExpand(rowId)} className="cursor-pointer hover:bg-slate-50">
                            <td className="py-3 px-4 text-slate-400">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                            <td className="py-3 px-4 font-mono font-bold text-[#0F172A]">{cycle.cycleStart} to {cycle.cycleEnd}</td>
                            <td className="py-3 px-4 text-right font-mono">{formatRawMoney(cycle.ledgerNet)}</td>
                            <td className="py-3 px-4 text-right font-mono">{formatRawMoney(cycle.bankNet)}</td>
                            <td className={`py-3 px-4 text-right font-mono font-bold ${cycle.isMatch ? 'text-slate-400' : 'text-[#B41E43]'}`}>{cycle.isMatch ? '0.00' : formatCurrency(cycle.variance)}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${cycle.isMatch ? 'bg-emerald-50 text-[#10B981]' : 'bg-rose-50 text-[#B41E43]'}`}>{cycle.isMatch ? 'Matched' : 'Variance'}</span>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50 border-y border-[#E2E8F0]">
                              <td colSpan={6} className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div>
                                    <h4 className="text-xs font-bold text-[#2563EB] mb-3 uppercase">Ledger Items</h4>
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                      {cycle.transactions.ledger.map((tx, i) => (
                                        <div key={i} className="flex justify-between items-start bg-white p-3 rounded-lg border border-slate-200 text-xs font-mono shadow-sm">
                                          <span className="flex-1 whitespace-normal break-words text-slate-700 pr-4">
                                            <span className="text-[#2563EB] font-bold mr-2">{tx.date}</span>
                                            {tx.desc}
                                          </span>
                                          <span className={`flex-shrink-0 font-bold ${tx.amount < 0 ? 'text-[#B41E43]' : 'text-[#10B981]'}`}>{formatCurrency(tx.amount)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-[#2563EB] mb-3 uppercase">Bank Items</h4>
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                      {cycle.transactions.bank.map((tx, i) => (
                                        <div key={i} className="flex justify-between items-start bg-white p-3 rounded-lg border border-slate-200 text-xs font-mono shadow-sm">
                                          <span className="flex-1 whitespace-normal break-words text-slate-700 pr-4">
                                            <span className="text-[#2563EB] font-bold mr-2">{tx.date}</span>
                                            <span className="text-slate-400 mr-2">[{tx.category}]</span>
                                            {tx.desc}
                                          </span>
                                          <span className={`flex-shrink-0 font-bold ${tx.amount < 0 ? 'text-[#B41E43]' : 'text-[#10B981]'}`}>{formatCurrency(tx.amount)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {filteredCycles.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-slate-400">No cycles match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* DAILY VIEW */}
            {viewMode === 'daily' && (
              <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F8FAFC] text-slate-500 uppercase text-xs font-bold border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-3 px-4 w-8"></th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-right">Ledger Balance</th>
                      <th className="py-3 px-4 text-right">Bank Balance</th>
                      <th className="py-3 px-4 text-right">Difference</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredDays.map((row) => {
                      const rowId = `daily-${row.date}`;
                      const isExpanded = expandedRows.has(rowId);
                      return (
                        <React.Fragment key={row.date}>
                          <tr onClick={() => toggleRowExpand(rowId)} className="cursor-pointer hover:bg-slate-50">
                            <td className="py-3 px-4 text-slate-400">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                            <td className="py-3 px-4 font-mono font-bold text-[#0F172A]">{row.date}</td>
                            <td className="py-3 px-4 text-right font-mono text-[#0F172A]">{formatRawMoney(row.ledgerBalance)}</td>
                            <td className="py-3 px-4 text-right font-mono text-[#0F172A]">{formatRawMoney(row.bankBalance)}</td>
                            <td className={`py-3 px-4 text-right font-mono font-bold ${row.delta !== 0 ? 'text-[#B41E43]' : 'text-slate-400'}`}>{row.delta !== 0 ? formatCurrency(row.delta) : '0.00'}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${row.passed ? 'bg-emerald-50 text-[#10B981]' : 'bg-rose-50 text-[#B41E43]'}`}>{row.passed ? 'Matched' : 'Mismatch'}</span>
                            </td>
                          </tr>
                          {isExpanded && (
                             <tr className="bg-slate-50 border-y border-[#E2E8F0]">
                               <td colSpan={6} className="p-6">
                                 <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-sm flex flex-wrap gap-8 text-sm font-mono">
                                    <div><span className="text-xs text-slate-500 font-sans font-bold block mb-1">Ledger Movement</span>{formatCurrency(row.ledgerMovement)}</div>
                                    <div><span className="text-xs text-slate-500 font-sans font-bold block mb-1">Bank Movement</span>{formatCurrency(row.bankMovement)}</div>
                                    <div><span className="text-xs text-slate-500 font-sans font-bold block mb-1">Balance Difference</span><span className={row.delta !== 0 ? 'text-[#B41E43] font-bold' : 'text-[#10B981] font-bold'}>{formatRawMoney(row.delta)}</span></div>
                                 </div>
                               </td>
                             </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {filteredDays.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-slate-400">No daily records match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
    Briefcase, TrendingUp, Search, FolderOpen, Trash2, Plus, 
    ArrowLeft, UploadCloud, DownloadCloud, Coins, ClipboardList,
    DollarSign, Camera, PlusCircle, Pencil, X, Save, Printer,
    Users, Hammer, Send, Paperclip, ChevronRight
} from 'lucide-react';

// --- 1. GLOBAL STYLES (Print & Layout) ---
const GlobalPrintStyles = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        @media print {
            @page { size: A4; margin: 0 !important; }
            body { background: white !important; color: black !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; padding: 0 !important; margin: 0 !important; }
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            .a4-page { width: 210mm; height: 296mm; padding: 15mm; margin: 0 auto; background: white; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; page-break-after: always; position: relative; }
            .print-root > .a4-page:last-child { page-break-after: auto !important; }
            .content-wrapper { flex-grow: 1; display: flex; flex-direction: column; }
            .section-title { background-color: #e5e7eb !important; border: 1px solid black !important; border-bottom: none !important; padding: 4px; font-weight: bold; text-align: center; text-transform: uppercase; font-size: 12px; margin-top: 10px !important; }
            .photo-grid-fixed { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(3, 1fr); gap: 10px; height: 100%; align-content: start; }
            .photo-item { border: 1px solid #ccc; padding: 4px; display: flex; flex-direction: column; height: 100%; }
            .photo-img-container { flex-grow: 1; display: flex; align-items: center; justify-content: center; background-color: #f9fafb; overflow: hidden; height: 180px; }
            .signature-table { width: 100%; margin-top: 0; }
            .signature-td { width: 50%; padding: 0 1rem; vertical-align: top; }
            .signature-line { border-top: 1px solid black; padding-top: 0.5rem; text-align: center; }
            .fin-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 10px; }
            .fin-table th { background-color: #e5e7eb !important; font-weight: bold; text-transform: uppercase; border: 1px solid black; padding: 4px; }
            .fin-table td { border: 1px solid black; padding: 4px; }
            .fin-total-row { font-weight: bold; background-color: #f3f4f6 !important; }
            .receipt-grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 10px; margin-top: 10px; height: 100%; }
            .receipt-item { border: 1px solid #ccc; padding: 5px; display: flex; flex-direction: column; height: 100%; }
            .receipt-img { flex-grow: 1; object-fit: contain; max-height: 200px; width: 100%; background: #f9fafb; }
        }
        .print-only { display: none; }
    `}</style>
);

// --- 2. UTILS ---
const uuid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
const todayISO = () => new Date().toISOString().split('T')[0];
const isoDateToBr = (iso) => iso ? iso.split('-').reverse().join('/') : '';
const formatBRL = (v) => (Number(v)||0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
const compressImg = (file) => new Promise((resolve) => {
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = (e) => {
        const img = new Image(); img.src = e.target.result;
        img.onload = () => {
            const cvs = document.createElement('canvas'); const ctx = cvs.getContext('2d');
            const max = 720; const scale = max/Math.max(img.width,img.height,max);
            cvs.width = img.width*scale; cvs.height = img.height*scale;
            ctx.drawImage(img,0,0,cvs.width,cvs.height);
            resolve(cvs.toDataURL('image/jpeg', 0.45));
        };
    };
});
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => { const handler = setTimeout(() => setDebouncedValue(value), delay); return () => clearTimeout(handler); }, [value, delay]);
    return debouncedValue;
}

// --- 3. HYBRID DB (The Cloud Engine) ---
class HybridDB {
    constructor(userId) {
        this.dbName = 'HormungV16_ERP';
        this.version = 1;
        this.db = null;
        this.userId = userId;
        this.apiBase = '/api/sync';
    }
    async initLocal() {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, this.version);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
            };
            req.onsuccess = (e) => { this.db = e.target.result; resolve(this.db); };
            req.onerror = (e) => reject(e);
        });
    }
    async sync() {
        if (!this.userId) return this.getAllLocal();
        try {
            const res = await fetch(this.apiBase, { headers: { 'x-user-id': this.userId } });
            if (res.ok) {
                const data = await res.json();
                if (!data.projects || data.projects.length === 0) {
                    const localData = await this.getAllLocal();
                    if (localData.length > 0) {
                        await this.migrateToCloud(localData);
                        return localData;
                    }
                }
                if (data.projects && data.projects.length > 0) {
                    await this.updateLocalCache(data.projects);
                    return data.projects;
                }
            }
        } catch (e) { console.warn("Offline mode active."); }
        return await this.getAllLocal();
    }
    async migrateToCloud(projects) {
        for (const p of projects) await this.saveProject(p);
        alert('Dados migrados para a Nuvem com sucesso!');
    }
    async updateLocalCache(projects) {
        await this.initLocal();
        const tx = this.db.transaction('projects', 'readwrite');
        const store = tx.objectStore('projects');
        projects.forEach(p => store.put(p));
    }
    async getAllLocal() {
        await this.initLocal();
        return new Promise(r => {
            const tx = this.db.transaction('projects', 'readonly');
            tx.objectStore('projects').getAll().onsuccess = e => r(e.target.result || []);
        });
    }
    async saveProject(project) {
        await this.initLocal(); 
        await new Promise(r => {
            const tx = this.db.transaction('projects', 'readwrite');
            tx.objectStore('projects').put(project).onsuccess = r;
        });
        if (this.userId) {
            // Background Sync
            fetch(this.apiBase, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-user-id': this.userId },
                body: JSON.stringify({ project })
            }).catch(e => console.error("Cloud Error", e));
        }
    }
    async delete(id) {
        await this.initLocal();
        const tx = this.db.transaction('projects', 'readwrite');
        tx.objectStore('projects').delete(id);
        if (this.userId) fetch(`${this.apiBase}?id=${id}`, { method: 'DELETE', headers: { 'x-user-id': this.userId } });
    }
}

// --- 4. PRINT COMPONENTS (Fixed Image Loading) ---
const PrintRDO = ({ project, report }) => {
    if (!project || !report) return null;
    const list = Array.isArray(report) ? report : [report];
    const sortedList = [...list].sort((a,b) => new Date(a.date) - new Date(b.date));
    const chunkArray = (arr, size) => {
        if (!arr || arr.length === 0) return [];
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
        return chunks;
    };
    const pagesToRender = [];
    sortedList.forEach((r, idx) => {
        pagesToRender.push({ type: 'text', data: r, project: project });
        const photos = r.photos || [];
        const chunks = chunkArray(photos, 6);
        chunks.forEach((chunk, chunkIdx) => {
            pagesToRender.push({ type: 'photo', data: chunk, date: r.date, pageNum: chunkIdx + 1, project: project });
        });
    });
    return (
        <div className="print-only font-sans text-xs print-root">
            {pagesToRender.map((page, i) => {
                const isText = page.type === 'text';
                const p = page.project;
                if (isText) {
                    const r = page.data;
                    const team = r.team || [];
                    const activities = r.activities || [];
                    return (
                        <div key={i} className="a4-page">
                            <div className="content-wrapper">
                                <div className="border border-black mb-2">
                                    <div className="grid grid-cols-12 border-b border-black">
                                        <div className="col-span-3 border-r border-black p-2 flex flex-col items-center justify-center bg-gray-100 font-bold text-center"><span className="text-[10px] leading-tight block">A. HORMUNG</span><span className="text-[9px] leading-tight block">DE CASTILHO LTDA</span></div>
                                        <div className="col-span-6 flex items-center justify-center font-bold text-lg uppercase p-2">Relatório Diário de Obra</div>
                                        <div className="col-span-3 border-l border-black p-2 text-xs"><div><strong>Data:</strong> {isoDateToBr(r.date)}</div><div><strong>Clima:</strong> {r.weather}</div></div>
                                    </div>
                                    <div className="grid grid-cols-2 border-b border-black text-xs"><div className="p-1 px-2 border-r border-black"><strong>Cliente:</strong> {p.client}</div><div className="p-1 px-2"><strong>Obra:</strong> {p.name}</div></div>
                                    <div className="grid grid-cols-3 text-xs bg-gray-50"><div className="p-1 px-2 border-r border-black">Início: {r.startTime}</div><div className="p-1 px-2 border-r border-black">Fim: {r.endTime}</div><div className="p-1 px-2">Intervalo: {r.breakTime}</div></div>
                                </div>
                                <h3 className="section-title">1. Equipe Técnica</h3>
                                <div className="grid grid-cols-2 gap-x-4 border border-black p-2 mb-2">
                                    {team.length === 0 ? <span className="italic text-gray-500">Sem equipe</span> : team.map((m, idx) => <div key={idx} className="flex justify-between border-b border-gray-200 py-1 last:border-0"><span className="uppercase font-semibold w-2/3">{m.name}</span><span className="text-gray-600 w-1/3 text-right">{m.role}</span></div>)}
                                </div>
                                <h3 className="section-title">2. Atividades Executadas</h3>
                                <div className="border border-black p-2 mb-2">
                                    <ul className="list-disc pl-4 space-y-2">
                                        {activities.length === 0 ? <span className="italic text-gray-500">Sem atividades</span> : activities.map((act, idx) => <li key={idx} dangerouslySetInnerHTML={{__html: act}}></li>)}
                                    </ul>
                                </div>
                            </div>
                            <table className="signature-table mb-4"><tbody><tr><td className="signature-td"><div className="signature-line"><p className="font-bold text-[10px] uppercase">A. HORMUNG DE CASTILHO LTDA</p><p className="text-[9px]">Responsável Técnico</p></div></td><td className="signature-td"><div className="signature-line"><p className="font-bold text-xs uppercase">{p.client}</p><p className="text-[9px]">Fiscalização / Cliente</p></div></td></tr></tbody></table>
                        </div>
                    );
                } else {
                    const photos = page.data;
                    return (
                        <div key={i} className="a4-page">
                            <div className="content-wrapper">
                                <div className="border-b border-black mb-4 pb-2">
                                    <p className="font-bold text-center uppercase">Relatório Fotográfico - {isoDateToBr(page.date)} (Pág. {page.pageNum})</p>
                                    <p className="text-[10px] text-center text-gray-500">{p.name}</p>
                                </div>
                                <div className="photo-grid-fixed">
                                    {photos.map((ph, idx) => (
                                        <div key={idx} className="photo-item">
                                            <div className="photo-img-container">
                                                {/* CORREÇÃO CRÍTICA: loading="eager" para garantir impressão */}
                                                <img src={ph.url} loading="eager" className="max-h-full max-w-full object-contain" alt="Foto Obra" />
                                            </div>
                                            <p className="text-[10px] text-center mt-1 font-semibold uppercase border-t border-gray-100 pt-1">{ph.caption || `Foto ${idx+1}`}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <p className="text-[9px] text-center text-gray-400 border-t pt-1 mt-auto">HORMUNG SISTEMAS - Fotografia</p>
                        </div>
                    );
                }
            })}
        </div>
    );
};

const PrintFinancial = ({ project }) => {
    const expenses = project.expenses || [];
    const sortedExp = [...expenses].sort((a,b) => new Date(a.date) - new Date(b.date));
    const total = sortedExp.reduce((sum, e) => sum + (parseFloat(e.amount)||0), 0);
    const categories = {};
    sortedExp.forEach(e => { categories[e.category] = (categories[e.category] || 0) + (parseFloat(e.amount)||0); });
    const expensesWithReceipts = sortedExp.filter(e => e.receiptImg);
    const ITEMS_FIRST_PAGE = 12; const ITEMS_OTHER_PAGES = 22;
    const tableChunks = [];
    if (sortedExp.length === 0) { tableChunks.push([]); } else {
        let currentExp = [...sortedExp];
        tableChunks.push(currentExp.splice(0, ITEMS_FIRST_PAGE));
        while(currentExp.length > 0) tableChunks.push(currentExp.splice(0, ITEMS_OTHER_PAGES));
    }
    const chunkReceipts = (arr, size) => { const c = []; for (let i = 0; i < arr.length; i += size) c.push(arr.slice(i, i + size)); return c; };
    const receiptChunks = chunkReceipts(expensesWithReceipts, 4);

    return (
        <div className="print-only font-sans print-root">
            {tableChunks.map((chunk, pageIdx) => {
                const isFirst = pageIdx === 0; const isLast = pageIdx === tableChunks.length - 1;
                return (
                    <div key={`fin-${pageIdx}`} className="a4-page">
                        <div className="content-wrapper">
                            <div className="border border-black mb-4">
                                <div className="bg-gray-200 border-b border-black p-4 text-center"><h1 className="text-xl font-bold uppercase">Relatório Financeiro {tableChunks.length > 1 ? `(${pageIdx+1}/${tableChunks.length})` : ''}</h1><p className="text-xs">A. HORMUNG DE CASTILHO LTDA - Controle de Custos</p></div>
                                <div className="grid grid-cols-2 text-xs p-2"><div><strong>Obra:</strong> {project.name}</div><div><strong>Cliente:</strong> {project.client}</div></div>
                            </div>
                            {isFirst && (
                                <div className="mb-6"><h3 className="font-bold uppercase text-sm mb-2 border-b border-black">Resumo Financeiro</h3><div className="grid grid-cols-3 gap-2">{Object.entries(categories).map(([cat, val]) => (<div key={cat} className="border border-gray-300 p-2 text-xs flex justify-between"><span>{cat}:</span><span className="font-bold">{formatBRL(val)}</span></div>))}</div><div className="mt-2 border border-black bg-gray-100 p-2 flex justify-between items-center"><span className="font-bold text-xs uppercase">Total Geral Acumulado:</span><span className="font-bold text-sm">{formatBRL(total)}</span></div></div>
                            )}
                            <table className="fin-table mb-4">
                                <thead><tr><th style={{width: '15%'}}>Data</th><th style={{width: '10%'}}>Recibo</th><th style={{width: '20%'}}>Categoria</th><th style={{width: '40%'}}>Descrição</th><th style={{width: '15%', textAlign: 'right'}}>Valor</th></tr></thead>
                                <tbody>{chunk.map((e, i) => (<tr key={i}><td>{isoDateToBr(e.date)}</td><td className="text-center">{e.receipt || '-'}</td><td>{e.category}</td><td>{e.description}</td><td className="text-right">{formatBRL(e.amount)}</td></tr>))}</tbody>
                                {isLast && (<tfoot><tr className="fin-total-row"><td colSpan="4" className="text-right p-2">TOTAL GERAL (TABELA):</td><td className="text-right p-2 text-lg">{formatBRL(total)}</td></tr></tfoot>)}
                            </table>
                            {isLast && (<div className="mt-auto border-t-2 border-black pt-4"><div className="flex justify-between items-center bg-gray-100 p-4 border border-black rounded-lg shadow-sm"><div><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Fechamento de Custo</p><h2 className="text-xl font-black uppercase text-black">Valor Final da Obra</h2></div><div className="text-right"><p className="text-3xl font-black text-black leading-none">{formatBRL(total)}</p><p className="text-[10px] text-gray-500 mt-1">Auditado e Finalizado</p></div></div><div className="mt-4 text-[9px] text-gray-400 text-center uppercase tracking-widest">Documento gerado digitalmente em {isoDateToBr(todayISO())} • HORMUNG SYSTEMS</div></div>)}
                        </div>
                    </div>
                );
            })}
            {receiptChunks.map((chunk, pageIdx) => (
                <div key={`rec-${pageIdx}`} className="a4-page">
                    <div className="content-wrapper">
                        <h3 className="section-title mb-4">ANEXOS / COMPROVANTES (Pág. {pageIdx + 1})</h3>
                        <div className="receipt-grid">{chunk.map((e, i) => (<div key={i} className="receipt-item"><div className="text-[10px] font-bold border-b border-gray-300 pb-1 mb-2 flex justify-between"><span>DATA: {isoDateToBr(e.date)}</span><span>VALOR: {formatBRL(e.amount)}</span></div>
                        {/* CORREÇÃO CRÍTICA: loading="eager" para garantir impressão */}
                        <img src={e.receiptImg} loading="eager" className="receipt-img" alt="Comprovante" />
                        <p className="text-[9px] mt-1 text-center italic">{e.description} ({e.category})</p></div>))}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- 5. UI COMPONENTS ---
const Input = ({label, type="text", val, set, ph}) => (
    <div className="mb-4">
        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1 ml-1">{label}</label>
        <input type={type} value={val||''} onChange={e=>set(e.target.value)} placeholder={ph} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-500 outline-none transition-colors"/>
    </div>
);

// --- 6. CORE MODULES ---
const Dashboard = ({projects, onCreate, onSelect, onDelete}) => {
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState({name:'', client:''});
    const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase()));
    const totalCost = projects.reduce((acc, p) => acc + (p.expenses||[]).reduce((sum, e) => sum + (Number(e.amount)||0),0), 0);

    return (
        <div className="space-y-4 animate-fade-in max-w-4xl mx-auto p-4">
             <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl"><p className="text-[10px] text-gray-500 uppercase font-bold">Obras Ativas</p><p className="text-2xl font-black text-blue-400">{projects.length}</p></div>
                <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl"><p className="text-[10px] text-gray-500 uppercase font-bold">Custo Global</p><p className="text-2xl font-black text-emerald-400">{formatBRL(totalCost)}</p></div>
            </div>
            <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-gray-500"/><input type="text" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-orange-500 outline-none"/></div>
            {filtered.map(p => (
                <div key={p.id} onClick={()=>onSelect(p.id)} className="bg-slate-800 border border-slate-700 p-5 rounded-2xl relative active:bg-slate-700 cursor-pointer hover:border-orange-500/50 transition group">
                    <div className="flex justify-between items-start"><div><h3 className="text-lg font-bold text-white">{p.name}</h3><p className="text-sm text-gray-400 uppercase">{p.client}</p></div><div className="text-right"><p className="text-emerald-400 font-bold text-sm">{formatBRL((p.expenses||[]).reduce((a,b)=>a+(Number(b.amount)||0),0))}</p></div></div>
                    <div className="flex justify-between items-center border-t border-slate-700 pt-3 mt-2"><span className="text-xs bg-slate-900 px-2 py-1 rounded text-orange-500 font-bold">{(p.reports||[]).length} RDOs</span><button onClick={(e)=>{e.stopPropagation(); onDelete(p.id)}} className="text-gray-500 hover:text-red-500 p-2"><Trash2 size={16}/></button></div>
                </div>
            ))}
            <button onClick={()=>setModal(true)} className="fixed bottom-6 right-6 bg-orange-500 text-white w-14 h-14 rounded-full flex items-center justify-center z-50 hover:bg-orange-600 shadow-xl"><Plus size={28}/></button>
            {modal && <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"><div className="bg-slate-800 w-full max-w-md rounded-2xl p-6 border border-slate-700"><h3 className="text-xl font-bold mb-6 text-white">Nova Obra</h3><Input label="Obra" ph="Nome" val={form.name} set={v=>setForm({...form,name:v})}/><Input label="Cliente" ph="Cliente" val={form.client} set={v=>setForm({...form,client:v})}/><div className="flex gap-3 mt-4"><button className="flex-1 bg-slate-700 p-3 rounded-lg" onClick={()=>setModal(false)}>Cancelar</button><button className="flex-1 bg-orange-500 p-3 rounded-lg font-bold" onClick={()=>{if(form.name){onCreate(form.name,form.client);setModal(false);setForm({name:'',client:''})}}}>Criar</button></div></div></div>}
        </div>
    );
};

const FinancialModule = ({ project, onUpdate }) => {
    const [form, setForm] = useState({ id: null, date: todayISO(), receipt: '', category: 'Alimentação', description: '', amount: '', receiptImg: null });
    const [isEditing, setIsEditing] = useState(false);
    const fileInputRef = useRef(null);
    const expenses = useMemo(() => project.expenses || [], [project.expenses]);

    const handlePhoto = async (e) => { if(e.target.files[0]) { const val = await compressImg(e.target.files[0]); setForm(prev => ({...prev, receiptImg: val})); } };
    const handleSubmit = () => {
        if(!form.description || !form.amount) return alert("Preencha descrição e valor");
        let newExpenses;
        if (isEditing) { newExpenses = expenses.map(e => e.id === form.id ? { ...form, amount: parseFloat(form.amount) } : e); setIsEditing(false); } 
        else { newExpenses = [...expenses, { ...form, id: uuid(), amount: parseFloat(form.amount) }]; }
        setForm({ id: null, date: todayISO(), receipt: '', category: 'Alimentação', description: '', amount: '', receiptImg: null });
        if(fileInputRef.current) fileInputRef.current.value = '';
        onUpdate({ ...project, expenses: newExpenses });
    };

    return (
        <div className="space-y-6 pb-20 p-4 max-w-2xl mx-auto animate-slide-up">
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl flex items-center justify-between"><div><p className="text-gray-400 text-xs uppercase font-bold tracking-wider">Total Acumulado</p><h2 className="text-3xl font-black text-white mt-1">{formatBRL(expenses.reduce((acc, curr) => acc + (Number(curr.amount)||0), 0))}</h2></div><div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-500"><DollarSign /></div></div>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-3"><div className="grid grid-cols-2 gap-3"><Input label="Data" type="date" val={form.date} set={v=>setForm({...form, date:v})} /><Input label="Nº Recibo" ph="000" val={form.receipt} set={v=>setForm({...form, receipt:v})} /></div><div className="grid grid-cols-2 gap-3"><div><label className="block text-[10px] uppercase font-bold text-gray-500 mb-1 ml-1">Categoria</label><select value={form.category} onChange={e=>setForm({...form, category:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none text-sm">{['Alimentação','Hospedagem','Combustível','Material','Logística','Deslocamento','Outros'].map(c=><option key={c} value={c}>{c}</option>)}</select></div><Input label="Valor (R$)" type="number" ph="0.00" val={form.amount} set={v=>setForm({...form, amount:v})} /></div><Input label="Descrição" ph="Ex: Almoço Equipe" val={form.description} set={v=>setForm({...form, description:v})} /><div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-3"><button onClick={()=>fileInputRef.current.click()} className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-2"><Camera size={14}/> {form.receiptImg ? 'Alterar' : 'Foto'}</button><input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handlePhoto}/>{form.receiptImg && <span className="text-xs text-green-400 font-bold">Anexado!</span>}</div><button onClick={handleSubmit} className="w-full font-bold py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex justify-center gap-2"><PlusCircle size={18} /> {isEditing ? 'Salvar' : 'Lançar'}</button></div>
            <div className="space-y-2">{expenses.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(e => (<div key={e.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center"><div><div className="flex items-center gap-2 mb-1"><span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-gray-300">{isoDateToBr(e.date)}</span><span className="text-[10px] text-orange-500 font-bold uppercase">{e.category}</span></div><p className="font-bold text-sm text-white">{e.description}</p></div><div className="text-right flex items-center gap-3"><p className="font-bold text-emerald-400">{formatBRL(e.amount)}</p><button onClick={()=>{setForm({...e, amount:e.amount}); setIsEditing(true); window.scrollTo({top:0, behavior:'smooth'})}} className="text-gray-500 hover:text-white"><Pencil size={16}/></button><button onClick={()=>{if(confirm('Apagar?')) onUpdate({...project, expenses: expenses.filter(x=>x.id!==e.id)})}} className="text-gray-500 hover:text-red-500"><Trash2 size={16}/></button></div></div>))}</div>
        </div>
    );
};

const ReportEditor = ({project, reportId, onBack, onUpdate}) => {
    const originalReport = useMemo(() => (project.reports || []).find(r=>r.id===reportId), [project.reports, reportId]);
    const [localReport, setLocalReport] = useState(null);
    const [tab, setTab] = useState('info');
    const [saving, setSaving] = useState(false);

    useEffect(() => { if(originalReport && !localReport) { setLocalReport(JSON.parse(JSON.stringify(originalReport))); } }, [originalReport]);
    const saveToDB = async (newData) => { setSaving(true); const updatedReports = project.reports.map(r => r.id === reportId ? newData : r); await onUpdate({...project, reports: updatedReports}); setSaving(false); };
    const debouncedReport = useDebounce(localReport, 1500);
    useEffect(() => { if (debouncedReport && originalReport && JSON.stringify(debouncedReport) !== JSON.stringify(originalReport)) { saveToDB(debouncedReport); } }, [debouncedReport]);
    const updateLocal = (field, value) => { setLocalReport(prev => ({...prev, [field]: value})); };

    const handlePhoto = async (e) => { 
        if(e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            const compressedUrls = await Promise.all(files.map(file => compressImg(file)));
            const newPhotos = compressedUrls.map(url => ({ url: url, caption: 'Serviço realizado' }));
            const newRep = {...localReport, photos: [...(localReport.photos||[]), ...newPhotos]};
            setLocalReport(newRep);
            saveToDB(newRep);
        }
    };
    if(!localReport) return <div className="p-10 text-center text-gray-500">Carregando...</div>;
    const TABS = [{id:'info',icon:ClipboardList,l:'Info'},{id:'team',icon:Users,l:'Equipe'},{id:'act',icon:Hammer,l:'Ativ'},{id:'photo',icon:Camera,l:'Fotos'}];

    return (
        <div className="h-screen flex flex-col bg-slate-950 animate-fade-in no-print">
            <div className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3"><button onClick={() => { saveToDB(localReport); onBack(); }} className="text-gray-400 hover:text-white transition"><ArrowLeft/></button><div><h1 className="font-bold text-white">RDO {isoDateToBr(localReport.date)}</h1><p className="text-[10px] text-gray-500 flex items-center gap-1">{saving ? <span className="text-orange-500 animate-pulse">Salvando...</span> : <span className="text-emerald-500">Salvo</span>}</p></div></div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-24">
                {tab==='info' && <div className="space-y-4 animate-slide-up"><Input label="Data" type="date" val={localReport.date} set={v=>updateLocal('date', v)}/><Input label="Clima" val={localReport.weather} set={v=>updateLocal('weather', v)}/><div className="grid grid-cols-2 gap-4"><Input label="Início" type="time" val={localReport.startTime} set={v=>updateLocal('startTime', v)}/><Input label="Fim" type="time" val={localReport.endTime} set={v=>updateLocal('endTime', v)}/></div><Input label="Intervalo" val={localReport.breakTime} set={v=>updateLocal('breakTime', v)}/></div>}
                {tab==='team' && <div className="space-y-4 animate-slide-up"><div className="bg-slate-900 p-4 rounded-xl border border-dashed border-slate-700"><form onSubmit={e=>{e.preventDefault();const fd=new FormData(e.target);if(fd.get('n')){const newRep = {...localReport, team:[...(localReport.team||[]),{name:fd.get('n'),role:fd.get('r')}]};setLocalReport(newRep);saveToDB(newRep);e.target.reset();}}} className="flex gap-2"><input name="n" placeholder="Nome" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none"/><input name="r" placeholder="Função" className="w-1/3 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none"/><button className="bg-slate-700 p-2 rounded-lg text-white hover:bg-orange-500 transition"><Plus size={18}/></button></form></div>{(localReport.team||[]).map((m,i)=><div key={i} className="flex justify-between items-center bg-slate-800 p-3 rounded-xl border border-slate-700"><div><div className="font-bold text-sm">{m.name}</div><div className="text-xs text-gray-400">{m.role}</div></div><button onClick={()=>{const n=[...(localReport.team||[])];n.splice(i,1);const nr={...localReport, team:n};setLocalReport(nr);saveToDB(nr)}} className="text-red-500 p-2 hover:bg-red-500/10 rounded"><Trash2 size={16}/></button></div>)}</div>}
                {tab==='act' && <div className="space-y-4 animate-slide-up"><div className="flex gap-2"><input id="newAct" placeholder="Descreva a atividade..." className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white outline-none"/><button onClick={()=>{const el=document.getElementById('newAct');if(el.value){const nr={...localReport, activities:[...(localReport.activities||[]),el.value]};setLocalReport(nr);saveToDB(nr);el.value=''}}} className="bg-orange-500 px-4 rounded-lg text-white hover:bg-orange-600 transition"><Send size={18}/></button></div>{(localReport.activities||[]).map((act,i)=><div key={i} className="flex gap-3 items-start bg-slate-800 p-3 rounded-xl border border-slate-700"><div className="bg-slate-700 text-gray-400 text-[10px] w-6 h-6 flex items-center justify-center rounded-full mt-0.5">{i+1}</div><div className="flex-1 text-sm" dangerouslySetInnerHTML={{__html:act}}></div><button onClick={()=>{const n=[...(localReport.activities||[])];n.splice(i,1);const nr={...localReport, activities:n};setLocalReport(nr);saveToDB(nr)}} className="text-gray-600 hover:text-red-500"><X size={16}/></button></div>)}</div>}
                {tab==='photo' && <div className="animate-slide-up"><label className="block w-full bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl p-8 text-center mb-6 active:bg-slate-800 transition cursor-pointer hover:border-orange-500 hover:text-orange-500 group"><Camera size={32} className="mx-auto mb-2 text-gray-500 group-hover:text-orange-500"/><span className="text-sm font-bold text-gray-400 group-hover:text-orange-500">Selecionar Fotos (Lote)</span><input type="file" multiple accept="image/*" className="hidden" onChange={handlePhoto}/></label><div className="grid grid-cols-2 gap-3">{(localReport.photos||[]).map((p,i)=><div key={i} className="relative rounded-xl overflow-hidden aspect-square border border-slate-700 bg-black group"><img src={p.url} loading="lazy" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"/><button onClick={()=>{const n=[...(localReport.photos||[])];n.splice(i,1);const nr={...localReport, photos:n};setLocalReport(nr);saveToDB(nr)}} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-red-600"><X size={12}/></button><input value={p.caption} onChange={e=>{const n=[...(localReport.photos||[])];n[i].caption=e.target.value;setLocalReport({...localReport, photos:n});}} className="absolute bottom-0 w-full bg-black/80 text-white text-[10px] p-2 text-center border-none outline-none backdrop-blur-sm" placeholder="Legenda..."/></div>)}</div></div>}
            </div>
            <div className="fixed bottom-0 w-full bg-slate-900 border-t border-slate-800 pb-safe-bottom flex justify-around items-center h-16 z-50 shadow-2xl">{TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`flex flex-col items-center gap-1 w-full h-full justify-center transition active:scale-95 ${tab===t.id?'text-orange-500':'text-gray-500'}`}><t.icon size={20} className={tab===t.id?'fill-current opacity-20':''}/><span className="text-[10px] font-bold uppercase">{t.l}</span></button>)}</div>
        </div>
    );
};

const ProjectView = ({ project, onBack, onUpdate, onSelectReport }) => {
    const [mode, setMode] = useState('rdo'); 
    const sortedReports = useMemo(() => [...(project.reports || [])].sort((a,b) => new Date(b.date) - new Date(a.date)), [project.reports]);

    const createReport = (copy) => {
        const base = copy && sortedReports.length > 0 ? sortedReports[0] : null;
        const newRep = { id: uuid(), date: todayISO(), weather: base ? '' : 'Sol', startTime: base ? base.startTime : '07:00', endTime: base ? base.endTime : '17:00', breakTime: base ? base.breakTime : '12:00-13:00', team: base ? base.team : [], activities: base ? base.activities : [], photos: [] };
        onUpdate({...project, reports: [newRep, ...(project.reports||[])]});
        onSelectReport(newRep.id);
    };

    return (
        <div className="min-h-screen pb-24 bg-slate-950 animate-fade-in no-print">
            <div className="sticky top-0 bg-slate-950/95 backdrop-blur z-40 p-4 border-b border-slate-800 shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3"><button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-white"><ArrowLeft/></button><div><h1 className="font-bold text-white truncate w-40">{project.name}</h1><p className="text-[10px] uppercase text-gray-500">{project.client}</p></div></div>
                    <button onClick={()=>onSelectReport(mode === 'rdo' ? 'PRINT_RDO' : 'PRINT_FIN')} className={`p-2 text-white rounded flex items-center gap-1 shadow-lg hover:scale-105 transition ${mode==='rdo'?'bg-orange-500':'bg-emerald-600'}`}><Printer size={18}/></button>
                </div>
                <div className="flex bg-slate-900 p-1 rounded-xl">
                    <button onClick={()=>setMode('rdo')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${mode==='rdo'?'bg-slate-700 text-white shadow':'text-gray-500 hover:text-gray-300'}`}><ClipboardList size={14}/> Diário</button>
                    <button onClick={()=>setMode('finance')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${mode==='finance'?'bg-emerald-900/50 text-emerald-400 shadow border border-emerald-900':'text-gray-500 hover:text-gray-300'}`}><Coins size={14}/> Financeiro</button>
                </div>
            </div>

            {mode === 'rdo' ? (
                <div className="p-4 space-y-3 animate-fade-in">
                    <div onClick={() => createReport(sortedReports.length > 0)} className="border-2 border-dashed border-slate-700 hover:border-orange-500 rounded-xl p-4 flex items-center justify-center gap-2 text-gray-400 hover:text-orange-500 active:bg-slate-800 cursor-pointer transition"><PlusCircle/> <span>Novo Dia (Copiar Anterior)</span></div>
                    {sortedReports.map(r=>(
                        <div key={r.id} onClick={()=>onSelectReport(r.id)} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center active:bg-slate-700 cursor-pointer hover:border-gray-600 transition">
                            <div><div className="flex items-center gap-2"><h4 className="font-bold text-white text-lg">{isoDateToBr(r.date)}</h4></div><p className="text-xs text-gray-500 mt-1">{(r.activities||[]).length} Ativ • {(r.photos||[]).length} Fotos</p></div>
                            <button onClick={(e) => {e.stopPropagation(); if(confirm('Apagar dia?')) onUpdate({...project, reports: (project.reports||[]).filter(x=>x.id!==r.id)})}} className="text-gray-700 hover:text-red-500 p-2 z-10"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
            ) : (<FinancialModule project={project} onUpdate={onUpdate} />)}
        </div>
    );
};

// --- 7. MAIN APP CONTROLLER ---
export default function AppCloud({ userId }) {
    const [db] = useState(() => new HybridDB(userId));
    const [projects, setProjects] = useState([]);
    const [view, setView] = useState('home');
    const [activeProjId, setActiveProjId] = useState(null);
    const [activeRepId, setActiveRepId] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { setLoading(true); db.sync().then(data => { setProjects(data); setLoading(false); }); }, [db, userId]);

    const activeProject = useMemo(()=>projects.find(p=>p.id===activeProjId),[projects,activeProjId]);
    const printData = (activeRepId && activeRepId !== 'PRINT_RDO' && activeRepId !== 'PRINT_FIN') ? activeProject?.reports?.find(r=>r.id===activeRepId) : activeProject?.reports;

    const handleUpdate = async (updatedProject) => {
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        await db.saveProject(updatedProject);
    };

    const handleImport = (e) => {
        const f = e.target.files[0]; if(!f) return;
        const r = new FileReader();
        r.onload = async (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if(data.projects) {
                    const fixed = data.projects.map(p => ({...p, expenses: p.expenses||[], reports: p.reports||[]}));
                    for(const p of fixed) await db.saveProject(p);
                    const newData = await db.sync();
                    setProjects(newData);
                    alert("Backup Restaurado e Sincronizado!");
                }
            } catch(err) { alert("Erro no arquivo."); }
        };
        r.readAsText(f);
    };

    if(loading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-white"><div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"></div></div>;

    // PRINT MODE OVERRIDE
    if(activeRepId === 'PRINT_FIN' && activeProject) return <><GlobalPrintStyles /><PrintFinancial project={activeProject} /></>;
    if((activeRepId === 'PRINT_RDO' || (activeRepId && activeRepId.length > 10 && view !== 'report')) && activeProject) return <><GlobalPrintStyles /><PrintRDO project={activeProject} report={printData} /></>;

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-orange-500/30">
            <GlobalPrintStyles />
            {view === 'home' && (
                <>
                <div className="sticky top-0 bg-slate-950/90 backdrop-blur z-40 p-4 border-b border-slate-800 flex justify-between items-center no-print">
                    <div><h1 className="text-lg font-black tracking-tighter">HORMUNG <span className="text-emerald-500">CLOUD</span></h1><p className="text-[10px] text-gray-500 uppercase">{userId ? 'ONLINE' : 'OFFLINE'}</p></div>
                    <label className="bg-slate-800 p-2 rounded-lg text-gray-400 cursor-pointer hover:text-white transition"><UploadCloud size={20}/><input type="file" className="hidden" accept=".json" onChange={handleImport}/></label>
                </div>
                <Dashboard projects={projects} onCreate={async(n,c)=>{ const newP = {id:uuid(),name:n,client:c,reports:[],expenses:[]}; await db.saveProject(newP); setProjects(prev=>[...prev, newP]); }} onSelect={id=>{setActiveProjId(id);setView('project')}} onDelete={async(id)=>{if(confirm('Apagar?')) { await db.delete(id); setProjects(prev=>prev.filter(p=>p.id!==id)); }}} />
                </>
            )}

            {view === 'project' && activeProject && 
                <ProjectView 
                    project={activeProject} 
                    onBack={()=>setView('project') ? setView('home') : setView('home')} 
                    onUpdate={handleUpdate} 
                    onSelectReport={id=>{
                        if(id==='PRINT_RDO' || id==='PRINT_FIN'){ 
                            setActiveRepId(id); 
                            // CORREÇÃO CRÍTICA: Aumentar delay para 2.5s para garantir que imagens carreguem no mobile
                            setTimeout(()=>window.print(), 2500); 
                            setTimeout(()=>setActiveRepId(null), 4000); 
                        }
                        else { setActiveRepId(id); setView('report'); }
                    }}
                />}

            {view === 'report' && activeProject && 
                <ReportEditor 
                    project={activeProject} 
                    reportId={activeRepId} 
                    onBack={()=>setView('project')} 
                    onUpdate={handleUpdate}
                />}
        </div>
    );
}

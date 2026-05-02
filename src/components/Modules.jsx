import React, { useState } from 'react';
import { Card, Modal, Btn, Tag, FormGroup, FormRow, SectionTitle, Alert, ProgressBar, Icon } from './UI';
import { GRADES_CBC } from '../data/initialData';
import { printFeeReceipt } from '../utils/print';

/* ══════════════════════════════════════════════════════
   KITCHEN
══════════════════════════════════════════════════════ */
export function Kitchen({ data, setData }) {
  const [showAdd, setShowAdd] = useState(false);
  const [txForm, setTxForm]   = useState({ item: '', type: 'in', qty: '' });
  const [itemForm, setItemForm] = useState({ name: '', current: '', max: 100, min: 10, unit: 'kg' });
  const [txHistory, setTxHistory] = useState([]);

  const lowItems = data.inventory.filter(i => i.current <= i.min);

  function doTx() {
    const qty = Number(txForm.qty);
    const now = new Date().toLocaleString('en-KE');
    setTxHistory(h => [{ ...txForm, qty, date: now, id: Date.now() }, ...h]);
    setData(d => ({
      ...d,
      inventory: d.inventory.map(i => i.name === txForm.item ? {
        ...i,
        current: txForm.type === 'in' ? Math.min(i.max, i.current + qty) : Math.max(0, i.current - qty),
        lastIn:  txForm.type === 'in'  ? qty : i.lastIn,
        lastOut: txForm.type === 'out' ? qty : i.lastOut,
      } : i),
    }));
    setTxForm({ item: '', type: 'in', qty: '' });
  }

  function addItem() {
    setData(d => ({ ...d, inventory: [...d.inventory, { id: Date.now(), ...itemForm, current: Number(itemForm.current), max: Number(itemForm.max), min: Number(itemForm.min) }] }));
    setShowAdd(false);
    setItemForm({ name: '', current: '', max: 100, min: 10, unit: 'kg' });
  }

  return (
    <div>
      {lowItems.length > 0 && (
        <Alert type="warning">
          <Icon name="alert" size={16} />
          <div>
            <strong>AI Inventory Alert: </strong>
            {lowItems.map(i => `${i.name} (${i.current}${i.unit} remaining, min: ${i.min}${i.unit})`).join(' · ')} — Please restock soon.
          </div>
        </Alert>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Transaction Form */}
        <Card>
          <SectionTitle icon="kitchen">Record Stock Movement</SectionTitle>
          <FormGroup label="Select Item">
            <select value={txForm.item} onChange={e => setTxForm({ ...txForm, item: e.target.value })}>
              <option value="">Choose item...</option>
              {data.inventory.map(i => <option key={i.id} value={i.name}>{i.name} (current: {i.current}{i.unit})</option>)}
            </select>
          </FormGroup>
          <FormRow>
            <FormGroup label="Movement Type">
              <select value={txForm.type} onChange={e => setTxForm({ ...txForm, type: e.target.value })}>
                <option value="in">Stock In (+)</option>
                <option value="out">Stock Out (−)</option>
              </select>
            </FormGroup>
            <FormGroup label="Quantity">
              <input type="number" value={txForm.qty} onChange={e => setTxForm({ ...txForm, qty: e.target.value })} placeholder="0" />
            </FormGroup>
          </FormRow>
          <Btn onClick={doTx} disabled={!txForm.item || !txForm.qty} variant="success">
            <Icon name="check" size={14} /> Record Transaction
          </Btn>
        </Card>

        {/* Summary */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <SectionTitle style={{ margin: 0 }}>Inventory Summary</SectionTitle>
            <Btn size="sm" variant="ghost" onClick={() => setShowAdd(true)}><Icon name="add" size={12} /> Add Item</Btn>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            {[
              { l: 'Total Items', v: data.inventory.length,                             c: '#4f8ef7' },
              { l: 'Low Stock',   v: lowItems.length,                                   c: '#ef4444' },
              { l: 'OK Stock',    v: data.inventory.length - lowItems.length,           c: '#10b981' },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ flex: 1, textAlign: 'center', background: '#1e2435', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{l}</div>
              </div>
            ))}
          </div>
          {txHistory.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Recent Transactions</div>
              {txHistory.slice(0, 4).map(tx => (
                <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderBottom: '1px solid #2a3350' }}>
                  <span style={{ color: '#94a3b8' }}>{tx.item}</span>
                  <span style={{ color: tx.type === 'in' ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                    {tx.type === 'in' ? '+' : '−'}{tx.qty}
                  </span>
                  <span style={{ color: '#64748b' }}>{tx.date}</span>
                </div>
              ))}
            </>
          )}
        </Card>
      </div>

      {/* Inventory Table */}
      <Card noPad>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a3350' }}>
          <SectionTitle icon="chart">Kitchen Inventory</SectionTitle>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={TS.table}>
            <thead>
              <tr>{['Item', 'Current', 'Min Level', 'Max Capacity', 'Last In', 'Last Out', 'Status', 'Level'].map(h => <th key={h} style={TS.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.inventory.map(i => {
                const pct = Math.round(i.current / i.max * 100);
                const low = i.current <= i.min;
                return (
                  <tr key={i.id}>
                    <td style={{ ...TS.td, fontWeight: 500, color: low ? '#ef4444' : '#e2e8f0' }}>{low ? '⚠ ' : ''}{i.name}</td>
                    <td style={TS.td}>{i.current} {i.unit}</td>
                    <td style={TS.td}>{i.min} {i.unit}</td>
                    <td style={TS.td}>{i.max} {i.unit}</td>
                    <td style={{ ...TS.td, color: '#10b981' }}>{i.lastIn ? `+${i.lastIn} ${i.unit}` : '—'}</td>
                    <td style={{ ...TS.td, color: '#ef4444' }}>{i.lastOut ? `−${i.lastOut} ${i.unit}` : '—'}</td>
                    <td style={TS.td}><Tag color={low ? 'red' : pct > 60 ? 'green' : 'amber'}>{low ? 'Low Stock' : pct > 60 ? 'Good' : 'Medium'}</Tag></td>
                    <td style={{ ...TS.td, width: 120 }}>
                      <ProgressBar pct={pct} color={low ? '#ef4444' : pct > 60 ? '#10b981' : '#f59e0b'} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal show={showAdd} onClose={() => setShowAdd(false)} title="Add Inventory Item">
        <FormRow>
          <FormGroup label="Item Name"><input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} placeholder="e.g. Maize" /></FormGroup>
          <FormGroup label="Unit">
            <select value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })}>
              {['kg', 'L', 'bags', 'boxes', 'pieces', 'litres', 'tins'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Current Stock"><input type="number" value={itemForm.current} onChange={e => setItemForm({ ...itemForm, current: e.target.value })} /></FormGroup>
          <FormGroup label="Max Capacity"><input type="number" value={itemForm.max} onChange={e => setItemForm({ ...itemForm, max: e.target.value })} /></FormGroup>
        </FormRow>
        <FormGroup label="Alert Minimum (restock alert when below this)">
          <input type="number" value={itemForm.min} onChange={e => setItemForm({ ...itemForm, min: e.target.value })} />
        </FormGroup>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
          <Btn onClick={addItem} disabled={!itemForm.name}>Add Item</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   DEPARTMENTS
══════════════════════════════════════════════════════ */
export function Departments({ data, setData }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: '', head: '', description: '' });

  const DEPT_ICONS = { Academics: '📚', Management: '🏫', Kitchen: '🍳', Sports: '⚽', Library: '📖', Finance: '💰', Counselling: '🧡', Security: '🔒' };

  function save() {
    if (!form.name) return;
    setData(d => ({ ...d, departments: [...d.departments, form.name] }));
    setShow(false); setForm({ name: '', head: '', description: '' });
  }

  function remove(dept) {
    if (window.confirm(`Remove department "${dept}"?`)) setData(d => ({ ...d, departments: d.departments.filter(x => x !== dept) }));
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Btn onClick={() => setShow(true)}><Icon name="add" size={14} /> Add Department</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {data.departments.map(dept => {
          const staff = data.teachers.filter(t => t.dept === dept);
          return (
            <Card key={dept}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 26, marginBottom: 6 }}>{DEPT_ICONS[dept] || '🏢'}</div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{dept}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  <Tag color="blue">{staff.length} staff</Tag>
                  <Btn size="sm" variant="danger" onClick={() => remove(dept)}><Icon name="trash" size={12} /></Btn>
                </div>
              </div>
              {staff.length > 0
                ? <div style={{ fontSize: 12, color: '#64748b' }}>Staff: {staff.map(t => t.name.split(' ')[0]).join(', ')}</div>
                : <div style={{ fontSize: 12, color: '#64748b' }}>No staff assigned yet</div>}
              <div style={{ marginTop: 8 }}><Tag color="green">Active</Tag></div>
            </Card>
          );
        })}
      </div>

      <Modal show={show} onClose={() => setShow(false)} title="Add New Department">
        <FormGroup label="Department Name">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Transport, ICT, Science Lab" />
        </FormGroup>
        <FormGroup label="Department Head (Optional)">
          <select value={form.head} onChange={e => setForm({ ...form, head: e.target.value })}>
            <option value="">Select head...</option>
            {data.teachers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Description (Optional)">
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Brief description..." />
        </FormGroup>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShow(false)}>Cancel</Btn>
          <Btn onClick={save} disabled={!form.name}>Add Department</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   FEES
══════════════════════════════════════════════════════ */
export function Fees({ data, setData }) {
  const [tab, setTab]         = useState('overview');   // overview | payments | structure
  const [showPay, setShowPay] = useState(false);
  const [showInvoice, setShowInvoice] = useState(null); // student
  const [search, setSearch]   = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterTerm, setFilterTerm]   = useState('');

  const initPay = () => ({ studentId: '', feeTypeId: '', amount: '', term: new Date().getMonth() < 4 ? '1' : new Date().getMonth() < 8 ? '2' : '3', year: new Date().getFullYear().toString(), method: 'Mpesa', reference: '' });
  const [payForm, setPayForm] = useState(initPay());

  const feeTypes    = data.feeTypes    || [];
  const feeSchedule = data.feeSchedule || [];
  const feePayments = data.feePayments || [];

  /* ── Compute student totals from fee schedule ─── */
  function getStudentFeeTotal(student, term, year) {
    const termN = Number(term);
    const yearN = Number(year);
    let total = 0;
    feeSchedule.forEach(sch => {
      if (sch.term !== termN || sch.year !== yearN) return;
      const ft = feeTypes.find(f => f.id === sch.feeTypeId);
      if (!ft) return;
      const applies = ft.appliesToAll || (ft.applicableClasses || []).includes(student.class);
      if (applies) total += Number(sch.amount);
    });
    return total;
  }

  function getStudentPaid(studentId, term, year) {
    return feePayments
      .filter(p => p.studentId === studentId && p.term === Number(term) && p.year === Number(year))
      .reduce((s, p) => s + p.amount, 0);
  }

  function getStudentBalance(student, term, year) {
    const total = getStudentFeeTotal(student, term, year);
    const paid  = getStudentPaid(student.id, term, year);
    return { total, paid, balance: total - paid, overpaid: Math.max(0, paid - total) };
  }

  /* ── Record payment ────────────────────────────── */
  function recordPayment() {
    const student = data.students.find(s => s.id === Number(payForm.studentId));
    if (!student || !payForm.amount) return;
    const amt = Number(payForm.amount);
    const payment = {
      id: Date.now(),
      studentId:   student.id,
      studentName: student.name,
      studentClass:student.class,
      feeTypeId:   payForm.feeTypeId || null,
      feeTypeName: payForm.feeTypeId ? (feeTypes.find(f=>f.id===payForm.feeTypeId)?.name || 'General') : 'General',
      amount:      amt,
      date:        new Date().toISOString().split('T')[0],
      term:        Number(payForm.term),
      year:        Number(payForm.year),
      method:      payForm.method,
      reference:   payForm.reference || `CASH-${Date.now()}`,
    };
    setData(d => ({ ...d, feePayments: [...(d.feePayments || []), payment] }));
    setShowPay(false);
    setPayForm(initPay());
    alert(`✅ Payment of KES ${amt.toLocaleString()} recorded for ${student.name}`);
  }

  /* ── Print full invoice ───────────────────────── */
  function printStudentInvoice(student) {
    const curYear = new Date().getFullYear();
    const allPayments = feePayments.filter(p => p.studentId === student.id);

    // Build history per term
    const terms = [1, 2, 3];
    const years = [...new Set([student.joined, String(curYear), String(curYear - 1)])].filter(Boolean).sort();

    let termRows = '';
    let grandTotal = 0, grandPaid = 0;

    years.forEach(yr => {
      terms.forEach(term => {
        const total = getStudentFeeTotal(student, term, yr);
        const paid  = getStudentPaid(student.id, term, yr);
        if (total === 0 && paid === 0) return;
        const balance = total - paid;
        const overP   = Math.max(0, paid - total);
        grandTotal += total;
        grandPaid  += paid;

        // Payment breakdown for this term/year
        const termPayments = allPayments.filter(p => p.term === term && p.year === Number(yr));
        const payRows = termPayments.map(p => `
          <tr style="font-size:11px">
            <td style="padding:3px 8px;border:1px solid #eee">${p.date}</td>
            <td style="padding:3px 8px;border:1px solid #eee">${p.feeTypeName || 'General'}</td>
            <td style="padding:3px 8px;border:1px solid #eee">${p.method}</td>
            <td style="padding:3px 8px;border:1px solid #eee;font-family:monospace">${p.reference}</td>
            <td style="padding:3px 8px;border:1px solid #eee;text-align:right;color:#10b981;font-weight:700">KES ${p.amount.toLocaleString()}</td>
          </tr>`).join('');

        termRows += `
          <tr style="background:#f0f4ff">
            <td colspan="5" style="padding:6px 8px;border:1px solid #ddd;font-weight:700;color:#003399">
              Year ${yr} — Term ${term}
              <span style="float:right;font-size:11px;color:#555">
                Expected: KES ${total.toLocaleString()} | Paid: KES ${paid.toLocaleString()} |
                ${balance > 0 ? `<span style="color:#cc0000">Balance: KES ${balance.toLocaleString()}</span>` : overP > 0 ? `<span style="color:#f59e0b">Overpaid: KES ${overP.toLocaleString()}</span>` : '<span style="color:#10b981">✓ Cleared</span>'}
              </span>
            </td>
          </tr>
          ${payRows || `<tr><td colspan="5" style="padding:4px 8px;border:1px solid #eee;color:#aaa;font-size:11px">No payments recorded for this term.</td></tr>`}`;
      });
    });

    const grandBalance = grandTotal - grandPaid;

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Fee Statement — ${student.name}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;max-width:800px;margin:0 auto;font-size:12px}
    @media print{body{padding:0}.no-print{display:none!important}}
    </style></head><body>
    <div style="text-align:center;border-bottom:3px solid #003399;padding-bottom:12px;margin-bottom:16px">
      <div style="font-size:20px;font-weight:900;color:#003399;text-transform:uppercase">${data.schoolName || 'School Name'}</div>
      ${data.schoolMotto ? `<div style="font-size:13px;font-weight:700">${data.schoolMotto}</div>` : ''}
      ${data.schoolPOBox || data.schoolLocation ? `<div style="font-size:12px">${[data.schoolPOBox,data.schoolLocation].filter(Boolean).join(', ')}</div>` : ''}
    </div>
    <h3 style="text-align:center;color:#003399;text-transform:uppercase;margin-bottom:14px;font-size:14px">Student Fee Statement / Invoice</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px">
      <tr><td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700;width:140px">Student Name</td><td style="padding:5px 8px;border:1px solid #ddd;font-weight:900;font-size:14px">${student.name}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700;width:120px">Adm No</td><td style="padding:5px 8px;border:1px solid #ddd;font-weight:700">${student.admNo}</td></tr>
      <tr><td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700">Class</td><td style="padding:5px 8px;border:1px solid #ddd">${student.class}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700">Year Joined</td><td style="padding:5px 8px;border:1px solid #ddd">${student.joined}</td></tr>
      <tr><td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700">Parent/Guardian</td><td style="padding:5px 8px;border:1px solid #ddd">${student.parent}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700">Date Issued</td><td style="padding:5px 8px;border:1px solid #ddd">${new Date().toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'})}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
      <thead><tr style="background:#003399;color:#fff">
        <th style="padding:6px 8px;border:1px solid #003399">Date</th>
        <th style="padding:6px 8px;border:1px solid #003399;text-align:left">Fee Type</th>
        <th style="padding:6px 8px;border:1px solid #003399">Method</th>
        <th style="padding:6px 8px;border:1px solid #003399">Reference</th>
        <th style="padding:6px 8px;border:1px solid #003399;text-align:right">Amount</th>
      </tr></thead>
      <tbody>${termRows || '<tr><td colspan="5" style="padding:10px;text-align:center;color:#aaa">No fee records found.</td></tr>'}</tbody>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:8px 12px;border:1px solid #ddd;background:#f0f4ff;font-weight:700">Total Expected (all terms)</td><td style="padding:8px 12px;border:1px solid #ddd;text-align:right;font-weight:700">KES ${grandTotal.toLocaleString()}</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #ddd;background:#f0fff4;font-weight:700;color:#10b981">Total Paid</td><td style="padding:8px 12px;border:1px solid #ddd;text-align:right;font-weight:900;color:#10b981;font-size:15px">KES ${grandPaid.toLocaleString()}</td></tr>
      <tr style="background:${grandBalance > 0 ? '#fff0f0' : grandBalance < 0 ? '#fffbe6' : '#f0fff4'}">
        <td style="padding:8px 12px;border:1px solid #ddd;font-weight:700;color:${grandBalance > 0 ? '#cc0000' : grandBalance < 0 ? '#f59e0b' : '#10b981'}">
          ${grandBalance > 0 ? 'Outstanding Balance' : grandBalance < 0 ? 'Overpayment (Credit)' : 'Account Status'}
        </td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;font-weight:900;font-size:16px;color:${grandBalance > 0 ? '#cc0000' : grandBalance < 0 ? '#f59e0b' : '#10b981'}">
          ${grandBalance > 0 ? `KES ${grandBalance.toLocaleString()}` : grandBalance < 0 ? `KES ${Math.abs(grandBalance).toLocaleString()} Credit` : '✓ FULLY CLEARED'}
        </td>
      </tr>
    </table>
    ${grandBalance < 0 ? `<div style="margin-top:10px;padding:10px;background:#fffbe6;border:1px solid #f59e0b;border-radius:4px;font-size:12px;color:#b45309"><strong>Note:</strong> This student has an overpayment of KES ${Math.abs(grandBalance).toLocaleString()}. This credit may be applied to future terms.</div>` : ''}
    <div style="display:flex;justify-content:space-between;margin-top:30px;font-size:11px;color:#555;border-top:1px solid #ccc;padding-top:10px">
      <div style="text-align:center"><div style="border-top:1px solid #333;padding-top:6px;width:160px">Accounts / Bursar</div></div>
      <div style="text-align:center"><div style="border-top:1px solid #333;padding-top:6px;width:160px">Principal &amp; Stamp</div></div>
    </div>
    <div class="no-print" style="margin-top:16px;text-align:center">
      <button onclick="window.print()" style="padding:10px 28px;background:#003399;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">🖨 Print Invoice</button>
    </div>
    </body></html>`);
    w.document.close();
  }

  const allClasses = (data.classGroups || []).flatMap(g =>
    !g.streams || g.streams.length === 0 ? [g.name] : g.streams.map(s => `${g.name} ${s}`)
  );

  const filtered = data.students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.admNo.includes(search);
    const matchClass  = !filterClass || s.class === filterClass;
    return matchSearch && matchClass;
  });

  const curTerm = filterTerm || '1';
  const curYear = new Date().getFullYear();

  // Summary stats
  const totalExpected = filtered.reduce((sum, s) => sum + getStudentFeeTotal(s, curTerm, curYear), 0);
  const totalCollected = filtered.reduce((sum, s) => sum + getStudentPaid(s.id, curTerm, curYear), 0);
  const defaulters = filtered.filter(s => getStudentBalance(s, curTerm, curYear).balance > 0);

  const TAB_STYLE = (active) => ({
    padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    background: active ? '#171b26' : 'transparent', color: active ? '#e2e8f0' : '#64748b',
  });

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#1e2435', padding: 4, borderRadius: 10, marginBottom: 16, width: 'fit-content' }}>
        {[['overview','Fee Overview'],['payments','Payment History'],['structure','Fee Structure']].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)} style={TAB_STYLE(tab===v)}>{l}</button>
        ))}
      </div>

      {/* ── FEE OVERVIEW ───────────────────────────── */}
      {tab === 'overview' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
            <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={{ width: 160 }}>
              <option value="">All Classes</option>
              {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={curTerm} onChange={e => setFilterTerm(e.target.value)} style={{ width: 100 }}>
              {['1','2','3'].map(t => <option key={t} value={t}>Term {t}</option>)}
            </select>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Btn onClick={() => setShowPay(true)}><Icon name="add" size={14} /> Record Payment</Btn>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
            {[
              { l: `Term ${curTerm} Expected`, v: `KES ${totalExpected.toLocaleString()}`,   c: '#4f8ef7' },
              { l: `Term ${curTerm} Collected`,v: `KES ${totalCollected.toLocaleString()}`,  c: '#10b981' },
              { l: 'Outstanding',              v: `KES ${(totalExpected-totalCollected).toLocaleString()}`, c: '#ef4444' },
              { l: 'Defaulters',               v: defaulters.length,                          c: '#f59e0b' },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background: '#171b26', border: '1px solid #2a3350', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: c, marginBottom: 4 }}>{v}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{l}</div>
              </div>
            ))}
          </div>

          <Card noPad>
            <div style={{ overflowX: 'auto' }}>
              <table style={TS.table}>
                <thead>
                  <tr>{['Adm No','Name','Class','Term Expected','Term Paid','Balance','Overpaid','Status','Invoice'].map(h => <th key={h} style={TS.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} style={{ ...TS.td, textAlign: 'center', color: '#64748b', padding: 28 }}>No students found.</td></tr>
                  ) : filtered.map(s => {
                    const { total, paid, balance, overpaid } = getStudentBalance(s, curTerm, curYear);
                    const pct = total > 0 ? Math.round(paid / total * 100) : 100;
                    return (
                      <tr key={s.id}>
                        <td style={TS.td}><Tag color="blue">{s.admNo}</Tag></td>
                        <td style={{ ...TS.td, fontWeight: 500 }}>{s.name}</td>
                        <td style={TS.td}>{s.class}</td>
                        <td style={TS.td}>{total > 0 ? `KES ${total.toLocaleString()}` : '—'}</td>
                        <td style={{ ...TS.td, color: '#10b981', fontWeight: 600 }}>KES {paid.toLocaleString()}</td>
                        <td style={{ ...TS.td, color: balance > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                          {balance > 0 ? `KES ${balance.toLocaleString()}` : '—'}
                        </td>
                        <td style={{ ...TS.td, color: '#f59e0b', fontWeight: 600 }}>
                          {overpaid > 0 ? `KES ${overpaid.toLocaleString()}` : '—'}
                        </td>
                        <td style={TS.td}>
                          <Tag color={pct >= 100 ? 'green' : pct > 50 ? 'amber' : 'red'}>
                            {pct >= 100 ? 'Cleared' : pct > 50 ? 'Partial' : 'Arrears'}
                          </Tag>
                        </td>
                        <td style={TS.td}>
                          <Btn size="sm" variant="ghost" onClick={() => printStudentInvoice(s)}>
                            <Icon name="print" size={12} /> Invoice
                          </Btn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── PAYMENT HISTORY ────────────────────────── */}
      {tab === 'payments' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <input placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
            <Btn onClick={() => setShowPay(true)}><Icon name="add" size={14} /> Record Payment</Btn>
          </div>
          {feePayments.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>No payments recorded yet.</Card>
          ) : (
            <Card noPad>
              <div style={{ overflowX: 'auto' }}>
                <table style={TS.table}>
                  <thead><tr>{['Date','Student','Class','Term','Year','Fee Type','Method','Reference','Amount','Receipt'].map(h=><th key={h} style={TS.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {[...feePayments].reverse().filter(p =>
                      !search || p.studentName.toLowerCase().includes(search.toLowerCase())
                    ).map(p => {
                      const student = data.students.find(s => s.id === p.studentId);
                      return (
                        <tr key={p.id}>
                          <td style={TS.td}>{p.date}</td>
                          <td style={{ ...TS.td, fontWeight: 500 }}>{p.studentName}</td>
                          <td style={TS.td}>{p.studentClass || student?.class || '—'}</td>
                          <td style={TS.td}>Term {p.term}</td>
                          <td style={TS.td}>{p.year || curYear}</td>
                          <td style={TS.td}>{p.feeTypeName || 'General'}</td>
                          <td style={TS.td}><Tag color={p.method==='Mpesa'?'green':p.method==='Bank'?'blue':'gray'}>{p.method}</Tag></td>
                          <td style={{ ...TS.td, fontFamily: 'monospace', fontSize: 11 }}>{p.reference}</td>
                          <td style={{ ...TS.td, color: '#10b981', fontWeight: 700 }}>KES {p.amount.toLocaleString()}</td>
                          <td style={TS.td}>
                            {student && (
                              <Btn size="sm" variant="ghost" onClick={() => printFeeReceipt(p, student, data)}>
                                <Icon name="print" size={12} />
                              </Btn>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── FEE STRUCTURE (principal sets up fees here) */}
      {tab === 'structure' && <FeeStructure data={data} setData={setData} />}

      {/* ── Record Payment Modal ───────────────────── */}
      <Modal show={showPay} onClose={() => setShowPay(false)} title="Record Fee Payment">
        <FormGroup label="Select Student *">
          <select value={payForm.studentId} onChange={e => setPayForm({ ...payForm, studentId: e.target.value })}>
            <option value="">Choose student...</option>
            {data.students.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.admNo}) — {s.class}</option>
            ))}
          </select>
        </FormGroup>
        <FormGroup label="Fee Type (what is this payment for?)">
          <select value={payForm.feeTypeId} onChange={e => setPayForm({ ...payForm, feeTypeId: e.target.value })}>
            <option value="">General / Unspecified</option>
            {feeTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
          </select>
        </FormGroup>
        <FormRow>
          <FormGroup label="Amount Paid (KES) *">
            <input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} placeholder="e.g. 5000" />
          </FormGroup>
          <FormGroup label="Year">
            <input type="number" value={payForm.year} onChange={e => setPayForm({ ...payForm, year: e.target.value })} placeholder={curYear} />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Term">
            <select value={payForm.term} onChange={e => setPayForm({ ...payForm, term: e.target.value })}>
              {['1','2','3'].map(t => <option key={t} value={t}>Term {t}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Payment Method">
            <select value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })}>
              {['Mpesa','Bank Transfer','Cash','Cheque'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </FormGroup>
        </FormRow>
        <FormGroup label="Reference / Transaction Code">
          <input value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} placeholder="e.g. QKW1234567 (leave blank for cash)" />
        </FormGroup>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowPay(false)}>Cancel</Btn>
          <Btn variant="success" onClick={recordPayment} disabled={!payForm.studentId || !payForm.amount}>
            <Icon name="check" size={14} /> Record Payment
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ── Fee Structure sub-component ─────────────────────── */
function FeeStructure({ data, setData }) {
  const [showAddType, setShowAddType] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [typeForm, setTypeForm]     = useState({ name: '', description: '', appliesToAll: true, applicableClasses: [] });
  const [schedForm, setSchedForm]   = useState({ feeTypeId: '', class: '', term: '1', year: new Date().getFullYear().toString(), amount: '' });

  const feeTypes    = data.feeTypes    || [];
  const feeSchedule = data.feeSchedule || [];

  const allClasses = (data.classGroups || []).flatMap(g =>
    !g.streams || g.streams.length === 0 ? [g.name] : g.streams.map(s => `${g.name} ${s}`)
  );

  function addFeeType() {
    if (!typeForm.name.trim()) return;
    const ft = { id: Date.now(), ...typeForm, applicableClasses: typeForm.appliesToAll ? [] : typeForm.applicableClasses };
    setData(d => ({ ...d, feeTypes: [...(d.feeTypes || []), ft] }));
    setShowAddType(false);
    setTypeForm({ name: '', description: '', appliesToAll: true, applicableClasses: [] });
  }

  function addSchedule() {
    if (!schedForm.feeTypeId || !schedForm.amount) return;
    const sch = {
      id: Date.now(), feeTypeId: schedForm.feeTypeId,
      class: schedForm.class || 'ALL',
      term: Number(schedForm.term), year: Number(schedForm.year),
      amount: Number(schedForm.amount),
    };
    setData(d => ({ ...d, feeSchedule: [...(d.feeSchedule || []), sch] }));
    setShowAddSchedule(false);
    setSchedForm({ feeTypeId: '', class: '', term: '1', year: new Date().getFullYear().toString(), amount: '' });
  }

  function toggleClass(cls) {
    setTypeForm(f => ({
      ...f,
      applicableClasses: f.applicableClasses.includes(cls)
        ? f.applicableClasses.filter(c => c !== cls)
        : [...f.applicableClasses, cls],
    }));
  }

  return (
    <div>
      <div style={{ background: '#4f8ef715', border: '1px solid #4f8ef730', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#4f8ef7' }}>
        💡 Set up your school's fee types (e.g. Tuition, Remedials, Activity Fee) here. Then assign amounts per class and term. This drives the invoice and balance calculations.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Fee Types */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <SectionTitle style={{ margin: 0 }}>Fee Types</SectionTitle>
            <Btn size="sm" onClick={() => setShowAddType(true)}><Icon name="add" size={12} /> Add</Btn>
          </div>
          {feeTypes.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 13 }}>No fee types yet. Add Tuition Fee, Remedials, etc.</p>
          ) : feeTypes.map(ft => (
            <div key={ft.id} style={{ padding: '10px 0', borderBottom: '1px solid #2a3350' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{ft.name}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Tag color={ft.appliesToAll ? 'green' : 'blue'}>{ft.appliesToAll ? 'All Classes' : `${(ft.applicableClasses||[]).length} classes`}</Tag>
                  <button onClick={() => setData(d => ({ ...d, feeTypes: d.feeTypes.filter(x => x.id !== ft.id) }))}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              </div>
              {ft.description && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{ft.description}</div>}
              {!ft.appliesToAll && ft.applicableClasses?.length > 0 && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Applies to: {ft.applicableClasses.join(', ')}</div>
              )}
            </div>
          ))}
        </Card>

        {/* Fee Schedule (amounts per class/term) */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <SectionTitle style={{ margin: 0 }}>Fee Amounts per Class & Term</SectionTitle>
            <Btn size="sm" onClick={() => setShowAddSchedule(true)} disabled={feeTypes.length === 0}><Icon name="add" size={12} /> Add</Btn>
          </div>
          {feeSchedule.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 13 }}>No amounts set yet. First add fee types, then set amounts per class and term.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ ...TS.table, fontSize: 12 }}>
                <thead><tr>{['Fee Type','Class','Term','Year','Amount (KES)',''].map(h=><th key={h} style={TS.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {feeSchedule.map(sch => {
                    const ft = feeTypes.find(f => f.id === sch.feeTypeId);
                    return (
                      <tr key={sch.id}>
                        <td style={TS.td}>{ft?.name || '—'}</td>
                        <td style={TS.td}>{sch.class === 'ALL' ? 'All Classes' : sch.class}</td>
                        <td style={TS.td}>Term {sch.term}</td>
                        <td style={TS.td}>{sch.year}</td>
                        <td style={{ ...TS.td, fontWeight: 700, color: '#10b981' }}>KES {Number(sch.amount).toLocaleString()}</td>
                        <td style={TS.td}>
                          <button onClick={() => setData(d => ({ ...d, feeSchedule: d.feeSchedule.filter(x => x.id !== sch.id) }))}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Add Fee Type Modal */}
      <Modal show={showAddType} onClose={() => setShowAddType(false)} title="Add Fee Type">
        <FormGroup label="Fee Type Name *">
          <input value={typeForm.name} onChange={e => setTypeForm({...typeForm,name:e.target.value})} placeholder="e.g. Tuition Fee, Remedials, Activity Fee, Building Fund" autoFocus />
        </FormGroup>
        <FormGroup label="Description (optional)">
          <input value={typeForm.description} onChange={e => setTypeForm({...typeForm,description:e.target.value})} placeholder="Brief description" />
        </FormGroup>
        <FormGroup>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, marginBottom: 8 }}>
            <input type="checkbox" checked={typeForm.appliesToAll} onChange={e => setTypeForm({...typeForm,appliesToAll:e.target.checked})} />
            Applies to ALL classes
          </label>
          {!typeForm.appliesToAll && (
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Select which classes this fee applies to:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {allClasses.map(c => (
                  <div key={c} onClick={() => toggleClass(c)} style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 500,
                    background: typeForm.applicableClasses.includes(c) ? '#4f8ef7' : '#1e2435',
                    color: typeForm.applicableClasses.includes(c) ? '#fff' : '#94a3b8',
                    border: `1px solid ${typeForm.applicableClasses.includes(c) ? '#4f8ef7' : '#2a3350'}`,
                  }}>{c}</div>
                ))}
              </div>
            </div>
          )}
        </FormGroup>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowAddType(false)}>Cancel</Btn>
          <Btn onClick={addFeeType} disabled={!typeForm.name.trim()}>Add Fee Type</Btn>
        </div>
      </Modal>

      {/* Add Schedule Modal */}
      <Modal show={showAddSchedule} onClose={() => setShowAddSchedule(false)} title="Set Fee Amount">
        <FormGroup label="Fee Type *">
          <select value={schedForm.feeTypeId} onChange={e => setSchedForm({...schedForm,feeTypeId:e.target.value})}>
            <option value="">Select fee type...</option>
            {feeTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
          </select>
        </FormGroup>
        <FormRow>
          <FormGroup label="Class (leave blank for all)">
            <select value={schedForm.class} onChange={e => setSchedForm({...schedForm,class:e.target.value})}>
              <option value="">All Classes</option>
              {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Amount (KES) *">
            <input type="number" value={schedForm.amount} onChange={e => setSchedForm({...schedForm,amount:e.target.value})} placeholder="e.g. 15000" />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Term">
            <select value={schedForm.term} onChange={e => setSchedForm({...schedForm,term:e.target.value})}>
              {['1','2','3'].map(t=><option key={t} value={t}>Term {t}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Year">
            <input type="number" value={schedForm.year} onChange={e => setSchedForm({...schedForm,year:e.target.value})} />
          </FormGroup>
        </FormRow>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowAddSchedule(false)}>Cancel</Btn>
          <Btn onClick={addSchedule} disabled={!schedForm.feeTypeId || !schedForm.amount}>Set Amount</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════════════════ */
export function Settings({ data, setData }) {
  const [profile, setProfile] = useState({
    schoolName:     data.schoolName     || '',
    schoolMotto:    data.schoolMotto    || '',
    schoolPOBox:    data.schoolPOBox    || '',
    schoolLocation: data.schoolLocation || '',
    schoolCounty:   data.schoolCounty   || '',
    schoolType:     data.schoolType     || 'Primary',
    principalName:  data.principalName  || '',
    phone:          data.phone          || '',
    email:          data.principalEmail || '',
  });

  const [showBell, setShowBell]   = useState(false);
  const [bellForm, setBellForm]   = useState({ time: '', label: '', type: 'lesson', duration: 40 });
  const [subForm, setSubForm]     = useState('');

  // Class management
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newStreams, setNewStreams]      = useState('');   // comma-separated

  // Stream editing for existing class
  const [editingGroup, setEditingGroup]   = useState(null);
  const [editStreamsVal, setEditStreamsVal] = useState('');

  function saveProfile() {
    setData(d => ({
      ...d,
      schoolName:     profile.schoolName,
      schoolMotto:    profile.schoolMotto,
      schoolPOBox:    profile.schoolPOBox,
      schoolLocation: profile.schoolLocation,
      schoolCounty:   profile.schoolCounty,
      schoolType:     profile.schoolType,
      principalName:  profile.principalName,
      principalEmail: profile.email,
    }));
    alert('School profile saved!');
  }

  // ── Data Backup / Restore ──────────────────────────
  function downloadBackup() {
    const toSave = { ...data };
    delete toSave.classes; // getter
    const blob = new Blob([JSON.stringify(toSave, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${(data.schoolName || 'school').replace(/\s+/g, '_')}_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function restoreBackup(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm('⚠ This will REPLACE all current data with the backup. Are you sure?')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        setData(() => parsed);
        alert('✅ Backup restored successfully!');
      } catch (err) {
        alert('❌ Invalid backup file. Please use a valid EduManage backup JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function addBell() {
    setData(d => ({
      ...d,
      bells: [...d.bells, { id: Date.now(), ...bellForm, duration: Number(bellForm.duration) }]
        .sort((a, b) => a.time.localeCompare(b.time)),
    }));
    setShowBell(false); setBellForm({ time: '', label: '', type: 'lesson', duration: 40 });
  }

  function removeBell(id) { setData(d => ({ ...d, bells: d.bells.filter(b => b.id !== id) })); }

  function addSubject() {
    if (subForm.trim()) { setData(d => ({ ...d, subjects: [...d.subjects, subForm.trim()] })); setSubForm(''); }
  }

  function addClass() {
    const name    = newClassName.trim();
    const streams = newStreams.trim()
      ? newStreams.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    if (!name) return;
    const newGroup = { id: `g${Date.now()}`, name, streams };
    setData(d => ({ ...d, classGroups: [...(d.classGroups || []), newGroup] }));
    setNewClassName(''); setNewStreams(''); setShowAddClass(false);
  }

  function removeClassGroup(id) {
    setData(d => ({ ...d, classGroups: (d.classGroups || []).filter(g => g.id !== id) }));
  }

  function saveStreams(groupId) {
    const streams = editStreamsVal.trim()
      ? editStreamsVal.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    setData(d => ({
      ...d,
      classGroups: (d.classGroups || []).map(g => g.id === groupId ? { ...g, streams } : g),
    }));
    setEditingGroup(null);
  }

  const TYPE_COLORS = { lesson: '#4f8ef7', break: '#f59e0b', lunch: '#10b981', assembly: '#7c3aed', end: '#64748b' };
  const classGroups = data.classGroups || [];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* LEFT COLUMN */}
        <div>
          {/* School Profile */}
          <Card style={{ marginBottom: 16 }}>
            <SectionTitle icon="settings">School Identity</SectionTitle>
            <FormGroup label="School Name (appears on reports)">
              <input value={profile.schoolName} onChange={e => setProfile({ ...profile, schoolName: e.target.value })} placeholder="e.g. Kiriene Day Primary School" />
            </FormGroup>
            <FormGroup label="School Motto (appears under name)">
              <input value={profile.schoolMotto} onChange={e => setProfile({ ...profile, schoolMotto: e.target.value })} placeholder="e.g. Strive To Excel" />
            </FormGroup>
            <FormRow>
              <FormGroup label="P.O. Box">
                <input value={profile.schoolPOBox} onChange={e => setProfile({ ...profile, schoolPOBox: e.target.value })} placeholder="e.g. P.O. Box 159-60607" />
              </FormGroup>
              <FormGroup label="Town / Location">
                <input value={profile.schoolLocation} onChange={e => setProfile({ ...profile, schoolLocation: e.target.value })} placeholder="e.g. Mikinduri" />
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup label="County">
                <input value={profile.schoolCounty} onChange={e => setProfile({ ...profile, schoolCounty: e.target.value })} placeholder="e.g. Tharaka Nithi" />
              </FormGroup>
              <FormGroup label="School Type">
                <select value={profile.schoolType} onChange={e => setProfile({ ...profile, schoolType: e.target.value })}>
                  {['Primary', 'Junior Secondary', 'Secondary', 'Combined'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup label="Principal Name">
                <input value={profile.principalName} onChange={e => setProfile({ ...profile, principalName: e.target.value })} />
              </FormGroup>
              <FormGroup label="Principal Email">
                <input value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} />
              </FormGroup>
            </FormRow>
            {/* Live preview */}
            <div style={{ background: '#1e2435', borderRadius: 8, padding: '10px 14px', marginBottom: 12, textAlign: 'center', fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: '#4f8ef7', fontSize: 13, textTransform: 'uppercase' }}>{profile.schoolName || 'School Name'}</div>
              {profile.schoolMotto && <div style={{ color: '#94a3b8', fontSize: 11 }}>{profile.schoolMotto}</div>}
              {(profile.schoolPOBox || profile.schoolLocation) && (
                <div style={{ color: '#64748b', fontSize: 11 }}>{[profile.schoolPOBox, profile.schoolLocation].filter(Boolean).join(', ')}</div>
              )}
            </div>
            <Btn variant="success" size="sm" onClick={saveProfile}><Icon name="check" size={13} /> Save School Profile</Btn>
          </Card>

          {/* Subjects */}
          <Card>
            <SectionTitle icon="exams">Manage Subjects</SectionTitle>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {data.subjects.map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#1e2435', borderRadius: 6, padding: '4px 10px', fontSize: 12 }}>
                  {s}
                  <button onClick={() => setData(d => ({ ...d, subjects: d.subjects.filter(x => x !== s) }))}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={subForm} onChange={e => setSubForm(e.target.value)} placeholder="e.g. Computer Studies" onKeyDown={e => e.key === 'Enter' && addSubject()} />
              <Btn size="sm" onClick={addSubject} disabled={!subForm.trim()}><Icon name="add" size={13} /></Btn>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          {/* Classes & Streams */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <SectionTitle style={{ margin: 0 }}>Classes &amp; Streams</SectionTitle>
              <Btn size="sm" onClick={() => setShowAddClass(true)}><Icon name="add" size={12} /> Add Class</Btn>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
              Classes with multiple streams (e.g. East, West) are supported. Click streams to edit.
            </div>
            {classGroups.map(g => {
              const fullNames = g.streams.length === 0 ? [g.name] : g.streams.map(s => `${g.name} ${s}`);
              return (
                <div key={g.id} style={{ padding: '10px 0', borderBottom: '1px solid #2a3350' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{g.name}</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      {g.streams.length === 0 ? 'Single stream' : `${g.streams.length} streams`}
                    </span>
                    <button onClick={() => { setEditingGroup(g.id); setEditStreamsVal(g.streams.join(', ')); }}
                      style={{ background: 'none', border: 'none', color: '#4f8ef7', cursor: 'pointer', fontSize: 12 }}>✎ Edit streams</button>
                    <button onClick={() => removeClassGroup(g.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>×</button>
                  </div>
                  {editingGroup === g.id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input value={editStreamsVal} onChange={e => setEditStreamsVal(e.target.value)}
                        placeholder="East, West, North (comma separated, or empty for single stream)"
                        style={{ flex: 1, fontSize: 12 }} />
                      <Btn size="sm" variant="success" onClick={() => saveStreams(g.id)}>Save</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => setEditingGroup(null)}>Cancel</Btn>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {fullNames.map(n => (
                        <span key={n} style={{ background: '#4f8ef720', color: '#4f8ef7', padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{n}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>

          {/* Bell Schedule */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <SectionTitle icon="bell" style={{ margin: 0 }}>Bell Schedule</SectionTitle>
              <Btn size="sm" variant="ghost" onClick={() => setShowBell(true)}><Icon name="add" size={12} /> Add Bell</Btn>
            </div>
            {data.bells.map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #2a3350', fontSize: 13 }}>
                <span style={{ fontWeight: 700, minWidth: 48, color: TYPE_COLORS[b.type] || '#4f8ef7' }}>{b.time}</span>
                <span style={{ flex: 1 }}>{b.label}</span>
                <Tag color={b.type === 'lesson' ? 'blue' : b.type === 'break' ? 'amber' : b.type === 'lunch' ? 'green' : 'purple'}>{b.type}</Tag>
                {b.duration > 0 && <span style={{ fontSize: 11, color: '#64748b', minWidth: 40 }}>{b.duration}min</span>}
                <button onClick={() => removeBell(b.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
          </Card>

          {/* CBC Scale */}
          <Card>
            <SectionTitle icon="chart">CBC Grading Scale</SectionTitle>
            {GRADES_CBC.map(g => (
              <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #2a3350', fontSize: 12 }}>
                <span style={{ minWidth: 36, fontWeight: 700, color: g.color }}>{g.label}</span>
                <div style={{ flex: 1, height: 6, background: '#1e2435', borderRadius: 20, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${g.points * 12.5}%`, background: g.color, borderRadius: 20 }} />
                </div>
                <span style={{ color: '#94a3b8', minWidth: 100 }}>Score: {g.scoreMin}–{g.scoreMax}</span>
                <span style={{ color: '#64748b', minWidth: 60 }}>{g.points} pts</span>
              </div>
            ))}
          </Card>

          {/* Data Backup & Restore */}
          <Card style={{ marginTop: 16 }}>
            <SectionTitle icon="download">Data Backup &amp; Restore</SectionTitle>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14, lineHeight: 1.7 }}>
              Download a full backup of all school data (students, fees, exams, staff, settings).
              Restore from a backup file if you move to a new computer or browser.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn variant="primary" onClick={downloadBackup}>
                <Icon name="download" size={14} /> Download Backup (.json)
              </Btn>
              <div>
                <label style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid #2a3350',
                  background: 'transparent', color: '#94a3b8', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  <Icon name="add" size={14} /> Restore from Backup
                  <input type="file" accept=".json" onChange={restoreBackup} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 10, background: '#1e2435', borderRadius: 6, padding: '8px 12px' }}>
              ⚠ Restoring a backup will replace ALL current data. Always download a fresh backup before restoring.
            </div>
          </Card>
        </div>
      </div>

      {/* Add Bell Modal */}
      <Modal show={showBell} onClose={() => setShowBell(false)} title="Add Bell">
        <FormRow>
          <FormGroup label="Time"><input type="time" value={bellForm.time} onChange={e => setBellForm({ ...bellForm, time: e.target.value })} /></FormGroup>
          <FormGroup label="Duration (minutes)"><input type="number" value={bellForm.duration} onChange={e => setBellForm({ ...bellForm, duration: e.target.value })} /></FormGroup>
        </FormRow>
        <FormGroup label="Bell Label"><input value={bellForm.label} onChange={e => setBellForm({ ...bellForm, label: e.target.value })} placeholder="e.g. Lesson 9" /></FormGroup>
        <FormGroup label="Type">
          <select value={bellForm.type} onChange={e => setBellForm({ ...bellForm, type: e.target.value })}>
            {['lesson', 'break', 'lunch', 'assembly', 'end'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </FormGroup>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowBell(false)}>Cancel</Btn>
          <Btn onClick={addBell} disabled={!bellForm.time || !bellForm.label}>Add Bell</Btn>
        </div>
      </Modal>

      {/* Add Class Modal */}
      <Modal show={showAddClass} onClose={() => setShowAddClass(false)} title="Add Class / Grade">
        <FormGroup label="Class Name">
          <input value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="e.g. Grade 10, Form 1, JSS 1" autoFocus />
        </FormGroup>
        <FormGroup label="Streams (optional — comma separated)">
          <input value={newStreams} onChange={e => setNewStreams(e.target.value)} placeholder="East, West  (leave empty for single stream)" />
        </FormGroup>
        <div style={{ background: '#1e2435', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
          <strong>Preview:</strong>{' '}
          {newClassName ? (
            newStreams.trim()
              ? newStreams.split(',').map(s => `${newClassName} ${s.trim()}`).join(', ')
              : newClassName
          ) : '—'}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowAddClass(false)}>Cancel</Btn>
          <Btn onClick={addClass} disabled={!newClassName.trim()}>Add Class</Btn>
        </div>
      </Modal>
    </div>
  );
}

const TS = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:    { textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #2a3350', background: '#1e2435' },
  td:    { padding: '11px 14px', borderBottom: '1px solid #2a3350', color: '#e2e8f0' },
};

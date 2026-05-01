import React, { useState, useMemo } from 'react';
import { Card, Modal, Btn, Tag, FormGroup, FormRow, SectionTitle, Alert, ProgressBar, Icon } from './UI';
import { getAllClasses } from '../data/initialData';
import { printFeeReceipt } from '../utils/print';

/* ═══════════════════════════════════════════════════════
   FEE MANAGEMENT — Full module
   Tabs: Overview | Payments | By Fee Type | Structure | Parent View
═══════════════════════════════════════════════════════ */

const METHODS = ['Mpesa', 'Bank Transfer', 'Cash', 'Cheque'];
const TERMS   = ['1', '2', '3'];

function curYear() { return new Date().getFullYear(); }
function curTerm() {
  const m = new Date().getMonth();
  return m < 4 ? '1' : m < 8 ? '2' : '3';
}

/* ── Compute what a student owes for one fee type in one term/year ── */
function getExpected(student, feeTypeId, term, year, data) {
  const ft = (data.feeTypes || []).find(f => f.id === feeTypeId);
  if (!ft) return 0;
  const applies = ft.appliesToAll || (ft.applicableClasses || []).includes(student.class);
  if (!applies) return 0;
  const sch = (data.feeSchedule || []).find(s =>
    s.feeTypeId === feeTypeId &&
    (s.class === student.class || s.class === 'ALL') &&
    s.term === Number(term) && s.year === Number(year)
  );
  return sch ? Number(sch.amount) : 0;
}

/* ── Sum all expected fees for a student in a term/year ── */
function getTotalExpected(student, term, year, data, feeTypeId = null) {
  const types = feeTypeId
    ? [(data.feeTypes || []).find(f => f.id === feeTypeId)].filter(Boolean)
    : (data.feeTypes || []);
  return types.reduce((s, ft) => s + getExpected(student, ft.id, term, year, data), 0);
}

/* ── Sum what a student paid for a specific fee type / term / year ── */
function getPaid(studentId, term, year, data, feeTypeId = null) {
  return (data.feePayments || [])
    .filter(p =>
      p.studentId === studentId &&
      p.term === Number(term) &&
      p.year === Number(year) &&
      (feeTypeId ? p.feeTypeId === feeTypeId : true)
    )
    .reduce((s, p) => s + p.amount, 0);
}

/* ── Print fee clearance / balance list ── */
function printFeeList(students, feeTypeId, term, year, data, feeTypeName) {
  const rows = students.map((s, i) => {
    const expected = getTotalExpected(s, term, year, data, feeTypeId || null);
    const paid     = getPaid(s.id, term, year, data, feeTypeId || null);
    const balance  = expected - paid;
    const overpaid = Math.max(0, -balance);
    const status   = balance <= 0 ? 'CLEARED' : 'PENDING';
    return `<tr style="background:${i%2===0?'#fff':'#f8f9ff'}">
      <td style="padding:5px 8px;border:1px solid #ddd;font-weight:600">${s.admNo}</td>
      <td style="padding:5px 8px;border:1px solid #ddd;font-weight:600">${s.name.toUpperCase()}</td>
      <td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${s.class}</td>
      <td style="padding:5px 8px;border:1px solid #ddd;text-align:right">${expected>0?'KES '+expected.toLocaleString():'—'}</td>
      <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;color:#10b981;font-weight:700">${paid>0?'KES '+paid.toLocaleString():'—'}</td>
      <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;color:${balance>0?'#cc0000':'#10b981'};font-weight:700">${balance>0?'KES '+balance.toLocaleString():overpaid>0?'Credit KES '+overpaid.toLocaleString():'—'}</td>
      <td style="padding:5px 8px;border:1px solid #ddd;text-align:center;font-weight:700;color:${status==='CLEARED'?'#10b981':'#cc0000'}">${status}</td>
    </tr>`;
  }).join('');

  const cleared = students.filter(s => {
    const exp = getTotalExpected(s, term, year, data, feeTypeId||null);
    const paid = getPaid(s.id, term, year, data, feeTypeId||null);
    return paid >= exp && exp > 0;
  }).length;

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Fee List — ${feeTypeName} — Term ${term} ${year}</title>
  <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
  @page{size:A4 landscape;margin:10mm}@media print{body{padding:0}.no-print{display:none}}</style>
  </head><body>
  <div style="text-align:center;border-bottom:3px solid #003399;padding-bottom:10px;margin-bottom:14px">
    <div style="font-size:20px;font-weight:900;color:#003399;text-transform:uppercase">${data.schoolName||'School'}</div>
    ${data.schoolMotto?`<div style="font-size:13px;font-weight:700">${data.schoolMotto}</div>`:''}
    ${data.schoolPOBox||data.schoolLocation?`<div style="font-size:12px">${[data.schoolPOBox,data.schoolLocation].filter(Boolean).join(', ')}</div>`:''}
  </div>
  <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
    <div><strong>Fee Type:</strong> ${feeTypeName} &nbsp;&nbsp; <strong>Term:</strong> ${term} &nbsp;&nbsp; <strong>Year:</strong> ${year}</div>
    <div><strong>Cleared:</strong> <span style="color:#10b981;font-weight:700">${cleared}</span> / ${students.length}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:11px">
    <thead><tr style="background:#003399;color:#fff">
      <th style="padding:6px 8px;border:1px solid #003399">ADM NO</th>
      <th style="padding:6px 8px;border:1px solid #003399;text-align:left">STUDENT NAME</th>
      <th style="padding:6px 8px;border:1px solid #003399">CLASS</th>
      <th style="padding:6px 8px;border:1px solid #003399;text-align:right">EXPECTED</th>
      <th style="padding:6px 8px;border:1px solid #003399;text-align:right">PAID</th>
      <th style="padding:6px 8px;border:1px solid #003399;text-align:right">BALANCE</th>
      <th style="padding:6px 8px;border:1px solid #003399">STATUS</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="display:flex;justify-content:space-between;margin-top:16px;font-size:11px;color:#555;border-top:1px solid #ccc;padding-top:8px">
    <span>Finance Officer: _____________________________ Sign: _____________</span>
    <span>Principal: _____________________________ Sign: _____________</span>
    <span>Printed: ${new Date().toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'})}</span>
  </div>
  <div class="no-print" style="margin-top:14px;text-align:center">
    <button onclick="window.print()" style="padding:10px 28px;background:#003399;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">🖨 Print List</button>
  </div>
  </body></html>`);
  w.document.close();
}

/* ── Print full student fee statement ── */
function printStudentStatement(student, data) {
  const allPayments = (data.feePayments || []).filter(p => p.studentId === student.id);
  const years = [...new Set([student.joined, ...allPayments.map(p => String(p.year)), String(curYear())])].sort();
  const feeTypes = data.feeTypes || [];

  let bodyRows = '';
  let grandExpected = 0, grandPaid = 0;

  years.forEach(yr => {
    TERMS.forEach(term => {
      const termPayments = allPayments.filter(p => p.term === Number(term) && p.year === Number(yr));
      const totalExp = getTotalExpected(student, term, yr, data);
      const totalPaid = getPaid(student.id, term, yr, data);
      if (totalExp === 0 && totalPaid === 0) return;
      grandExpected += totalExp; grandPaid += totalPaid;
      const bal = totalExp - totalPaid;

      bodyRows += `<tr style="background:#e8eeff">
        <td colspan="6" style="padding:5px 8px;border:1px solid #ddd;font-weight:700;color:#003399">
          Year ${yr} — Term ${term} &nbsp;&nbsp;
          <span style="float:right;font-size:11px">
            Expected: KES ${totalExp.toLocaleString()} | Paid: KES ${totalPaid.toLocaleString()} |
            ${bal>0?`<span style="color:#cc0000">Owe: KES ${bal.toLocaleString()}</span>`:bal<0?`<span style="color:#f59e0b">Credit: KES ${Math.abs(bal).toLocaleString()}</span>`:'<span style="color:#10b981">✓ Cleared</span>'}
          </span>
        </td>
      </tr>`;

      // Per fee-type breakdown with expected, paid, balance
      feeTypes.forEach(ft => {
        const expected = getExpected(student, ft.id, term, yr, data);
        const ftPayments = termPayments.filter(p => p.feeTypeId === ft.id);
        const ftPaid = ftPayments.reduce((s, p) => s + p.amount, 0);
        const ftBal = expected - ftPaid;
        if (expected === 0 && ftPaid === 0) return;
        bodyRows += `<tr style="background:#f8faff">
          <td style="padding:4px 8px;border:1px solid #eee;font-weight:700;color:#003399" colspan="2">${ft.name}</td>
          <td style="padding:4px 8px;border:1px solid #eee;text-align:right;color:#555">Expected:<br><strong>KES ${expected.toLocaleString()}</strong></td>
          <td style="padding:4px 8px;border:1px solid #eee;text-align:right;color:#10b981">Paid:<br><strong>KES ${ftPaid.toLocaleString()}</strong></td>
          <td style="padding:4px 8px;border:1px solid #eee;text-align:right;color:${ftBal>0?'#cc0000':ftBal<0?'#f59e0b':'#10b981'};font-weight:700" colspan="2">
            ${ftBal>0?`Balance Owed: KES ${ftBal.toLocaleString()}`:ftBal<0?`Credit: KES ${Math.abs(ftBal).toLocaleString()}`:'✓ CLEARED'}
          </td>
        </tr>`;
        ftPayments.forEach(p => {
          bodyRows += `<tr>
            <td style="padding:3px 8px 3px 20px;border:1px solid #eee;color:#64748b;font-size:11px">↳ ${p.date}</td>
            <td style="padding:3px 8px;border:1px solid #eee;color:#64748b;font-size:11px">${ft.name}</td>
            <td style="padding:3px 8px;border:1px solid #eee;font-size:11px">${p.studentClass||student.class}</td>
            <td style="padding:3px 8px;border:1px solid #eee;font-size:11px">Term ${p.term}</td>
            <td style="padding:3px 8px;border:1px solid #eee;font-size:11px">${p.method} — ${p.reference}</td>
            <td style="padding:3px 8px;border:1px solid #eee;text-align:right;color:#10b981;font-weight:700;font-size:11px">KES ${p.amount.toLocaleString()}</td>
          </tr>`;
        });
        if (ftPayments.length === 0) {
          bodyRows += `<tr><td colspan="6" style="padding:3px 8px 3px 20px;border:1px solid #eee;color:#aaa;font-size:11px">↳ No payments yet for this fee type</td></tr>`;
        }
      });
      if (feeTypes.length === 0 && termPayments.length > 0) {
        termPayments.forEach(p => {
          const ft = feeTypes.find(f => f.id === p.feeTypeId);
          bodyRows += `<tr>
            <td style="padding:4px 8px;border:1px solid #eee">${p.date}</td>
            <td style="padding:4px 8px;border:1px solid #eee">${ft?.name||'General'}</td>
            <td style="padding:4px 8px;border:1px solid #eee">${p.studentClass||student.class}</td>
            <td style="padding:4px 8px;border:1px solid #eee">Term ${p.term}</td>
            <td style="padding:4px 8px;border:1px solid #eee">${p.method} — ${p.reference}</td>
            <td style="padding:4px 8px;border:1px solid #eee;text-align:right;color:#10b981;font-weight:700">KES ${p.amount.toLocaleString()}</td>
          </tr>`;
        });
      }
    });
  });

  const grandBal = grandExpected - grandPaid;
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Fee Statement — ${student.name}</title>
  <style>body{font-family:Arial,sans-serif;padding:24px;max-width:800px;margin:0 auto;font-size:12px}
  @page{size:A4;margin:12mm}@media print{body{padding:0}.no-print{display:none}}</style>
  </head><body>
  <div style="text-align:center;border-bottom:3px solid #003399;padding-bottom:12px;margin-bottom:16px">
    <div style="font-size:20px;font-weight:900;color:#003399;text-transform:uppercase">${data.schoolName||'School'}</div>
    ${data.schoolMotto?`<div style="font-size:13px;font-weight:700">${data.schoolMotto}</div>`:''}
    ${data.schoolPOBox||data.schoolLocation?`<div style="font-size:12px">${[data.schoolPOBox,data.schoolLocation].filter(Boolean).join(', ')}</div>`:''}
  </div>
  <h3 style="text-align:center;color:#003399;text-transform:uppercase;font-size:14px;margin-bottom:14px">Complete Fee Statement</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px">
    <tr><td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700;width:140px">Student Name</td><td style="padding:5px 8px;border:1px solid #ddd;font-weight:900;font-size:14px">${student.name}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700;width:120px">Adm No</td><td style="padding:5px 8px;border:1px solid #ddd;font-weight:700">${student.admNo}</td></tr>
    <tr><td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700">Class (Current)</td><td style="padding:5px 8px;border:1px solid #ddd">${student.class}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700">Year Joined</td><td style="padding:5px 8px;border:1px solid #ddd">${student.joined}</td></tr>
    <tr><td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700">Parent/Guardian</td><td style="padding:5px 8px;border:1px solid #ddd">${student.parent}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700">Date Issued</td><td style="padding:5px 8px;border:1px solid #ddd">${new Date().toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'})}</td></tr>
  </table>
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
    <thead><tr style="background:#003399;color:#fff">
      <th style="padding:6px 8px;border:1px solid #003399">Date</th>
      <th style="padding:6px 8px;border:1px solid #003399;text-align:left">Fee Type</th>
      <th style="padding:6px 8px;border:1px solid #003399">Class</th>
      <th style="padding:6px 8px;border:1px solid #003399">Term</th>
      <th style="padding:6px 8px;border:1px solid #003399;text-align:left">Method / Ref</th>
      <th style="padding:6px 8px;border:1px solid #003399;text-align:right">Amount</th>
    </tr></thead>
    <tbody>${bodyRows||'<tr><td colspan="6" style="padding:10px;text-align:center;color:#aaa">No records found.</td></tr>'}</tbody>
  </table>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:14px">
    <tr><td style="padding:8px 12px;border:1px solid #ddd;background:#f0f4ff;font-weight:700">Total Expected</td><td style="padding:8px 12px;border:1px solid #ddd;text-align:right;font-weight:700">KES ${grandExpected.toLocaleString()}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #ddd;background:#f0fff4;font-weight:700;color:#10b981">Total Paid</td><td style="padding:8px 12px;border:1px solid #ddd;text-align:right;font-weight:900;color:#10b981;font-size:15px">KES ${grandPaid.toLocaleString()}</td></tr>
    <tr style="background:${grandBal>0?'#fff0f0':grandBal<0?'#fffbe6':'#f0fff4'}">
      <td style="padding:8px 12px;border:1px solid #ddd;font-weight:700;color:${grandBal>0?'#cc0000':grandBal<0?'#f59e0b':'#10b981'}">
        ${grandBal>0?'Outstanding Balance':grandBal<0?'Overpayment (Credit)':'Account Status'}
      </td>
      <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;font-weight:900;font-size:16px;color:${grandBal>0?'#cc0000':grandBal<0?'#f59e0b':'#10b981'}">
        ${grandBal>0?`KES ${grandBal.toLocaleString()}`:grandBal<0?`KES ${Math.abs(grandBal).toLocaleString()} Credit`:'✓ FULLY CLEARED'}
      </td>
    </tr>
  </table>
  ${grandBal<0?`<div style="margin-bottom:14px;padding:10px;background:#fffbe6;border:1px solid #f59e0b;border-radius:4px;font-size:12px;color:#b45309"><strong>Note:</strong> This student has an overpayment of KES ${Math.abs(grandBal).toLocaleString()}. This credit will be applied to future fees.</div>`:''}
  <div style="display:flex;justify-content:space-between;margin-top:24px;font-size:11px;color:#555;border-top:1px solid #ccc;padding-top:10px">
    <div style="text-align:center"><div style="border-top:1px solid #333;padding-top:6px;width:160px">Finance Officer</div></div>
    <div style="text-align:center"><div style="border-top:1px solid #333;padding-top:6px;width:160px">Principal &amp; Stamp</div></div>
  </div>
  <div class="no-print" style="margin-top:16px;text-align:center">
    <button onclick="window.print()" style="padding:10px 28px;background:#003399;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">🖨 Print Statement</button>
  </div>
  </body></html>`);
  w.document.close();
}

/* ── Print Fee Structure for a class ── */
function printFeeStructure(classes, data, selClass) {
  const feeTypes = data.feeTypes || [];
  const schedule = data.feeSchedule || [];
  const targetClasses = selClass === 'ALL' ? classes : [selClass];
  
  const tableRows = targetClasses.map(cls => {
    const classTypes = feeTypes.filter(ft => ft.appliesToAll || (ft.applicableClasses||[]).includes(cls));
    if (!classTypes.length) return '';
    let rows = '';
    let classTotal = 0;
    classTypes.forEach(ft => {
      [1,2,3].forEach(term => {
        const yr = new Date().getFullYear();
        const sch = schedule.find(s => s.feeTypeId === ft.id && (s.class === cls || s.class === 'ALL') && s.term === term && s.year === yr);
        const amt = sch ? Number(sch.amount) : 0;
        classTotal += amt;
        rows += `<tr>
          <td style="padding:5px 8px;border:1px solid #ddd">${ft.name}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;color:#64748b;font-size:11px">${ft.description||''}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:center">Term ${term}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-weight:700;color:${amt?'#003399':'#aaa'}">${amt?'KES '+amt.toLocaleString():'—'}</td>
        </tr>`;
      });
    });
    return `
      <tr style="background:#003399;color:#fff">
        <td colspan="4" style="padding:8px;font-weight:900;font-size:14px;border:1px solid #003399">CLASS: ${cls.toUpperCase()}</td>
      </tr>
      ${rows}
      <tr style="background:#e8f0ff">
        <td colspan="3" style="padding:6px 8px;border:1px solid #ddd;font-weight:700;text-align:right">Total Annual Fees:</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;font-weight:900;font-size:14px;color:#003399">KES ${classTotal.toLocaleString()}</td>
      </tr>
      <tr><td colspan="4" style="padding:4px;border:none"></td></tr>`;
  }).join('');

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Fee Structure ${new Date().getFullYear()} — ${data.schoolName}</title>
  <style>body{font-family:Arial,sans-serif;padding:24px;max-width:800px;margin:0 auto;font-size:12px}
  @page{size:A4;margin:12mm}@media print{body{padding:0}.np{display:none}}</style>
  </head><body>
  <div style="text-align:center;border-bottom:3px solid #003399;padding-bottom:12px;margin-bottom:16px">
    <div style="font-size:22px;font-weight:900;color:#003399;text-transform:uppercase">${data.schoolName||'School'}</div>
    ${data.schoolMotto?`<div style="font-size:14px;font-weight:700">${data.schoolMotto}</div>`:''}
    ${data.schoolPOBox||data.schoolLocation?`<div style="font-size:12px">${[data.schoolPOBox,data.schoolLocation].filter(Boolean).join(', ')}</div>`:''}
  </div>
  <h3 style="text-align:center;color:#003399;text-transform:uppercase;font-size:15px;margin-bottom:16px">
    FEE STRUCTURE — Academic Year ${new Date().getFullYear()}
  </h3>
  <table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:#1e3a8a;color:#fff">
      <th style="padding:7px 8px;border:1px solid #1e3a8a;text-align:left">Fee Type</th>
      <th style="padding:7px 8px;border:1px solid #1e3a8a;text-align:left">Description</th>
      <th style="padding:7px 8px;border:1px solid #1e3a8a;text-align:center">Term</th>
      <th style="padding:7px 8px;border:1px solid #1e3a8a;text-align:right">Amount (KES)</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div style="margin-top:20px;font-size:11px;color:#555">
    Generated on ${new Date().toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'})} by ${data.schoolName}
  </div>
  <div class="np" style="margin-top:16px;text-align:center">
    <button onclick="window.print()" style="padding:10px 28px;background:#003399;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">🖨 Print Fee Structure</button>
  </div>
  </body></html>`);
  w.document.close();
}

/* ═══════════════════════════════════════════════════════
   MAIN FEES COMPONENT
═══════════════════════════════════════════════════════ */
export default function FeesModule({ data, setData, user, isUnlocked = true }) {
  const isPrincipal = user.role === 'principal';
  const isFinance   = user.role === 'non_teaching' && user.dept === 'Finance';
  const canManage   = isPrincipal || isFinance;
  const isParent    = user.role === 'parent';

  const [tab, setTab] = useState(isParent ? 'parent' : 'overview');

  const tabs = [
    !isParent && { id: 'overview',   label: '📊 Overview' },
    !isParent && { id: 'payments',   label: '💳 Payments' },
    !isParent && { id: 'bytype',     label: '🗂 By Fee Type' },
    canManage  && { id: 'structure', label: '⚙ Fee Structure' },
    isParent   && { id: 'parent',    label: '👨‍👩‍👧 My Children' },
  ].filter(Boolean);

  const TAB_S = (active) => ({
    padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 500,
    background: active ? '#171b26' : 'transparent',
    color: active ? '#e2e8f0' : '#64748b',
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, background: '#1e2435', padding: 4, borderRadius: 10, marginBottom: 18, width: 'fit-content', flexWrap: 'wrap' }}>
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={TAB_S(tab === t.id)}>{t.label}</button>)}
      </div>

      {tab === 'overview'   && <FeeOverview   data={data} setData={setData} user={user} canManage={canManage} />}
      {tab === 'payments'   && <PaymentHistory data={data} setData={setData} user={user} canManage={canManage} />}
      {tab === 'bytype'     && <ByFeeType      data={data} setData={setData} user={user} canManage={canManage} />}
      {tab === 'structure'  && <FeeStructure   data={data} setData={setData} />}
      {tab === 'parent'     && <ParentView     data={data} user={user} />}
    </div>
  );
}

/* ── OVERVIEW ─────────────────────────────────────────── */
function FeeOverview({ data, setData, user, canManage }) {
  const [filterClass, setFilterClass] = useState('');
  const [filterTerm,  setFilterTerm]  = useState(curTerm());
  const [filterYear,  setFilterYear]  = useState(String(curYear()));
  const [search,      setSearch]      = useState('');
  const [showPay,     setShowPay]     = useState(false);
  const [payStudent,  setPayStudent]  = useState(null);

  const allClasses   = getAllClasses(data);
  const activeStudents = (data.students || []).filter(s => !s.status || s.status === 'active');

  const filtered = activeStudents.filter(s =>
    (!filterClass || s.class === filterClass) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.admNo.includes(search))
  );

  const totalExpected  = filtered.reduce((s, st) => s + getTotalExpected(st, filterTerm, filterYear, data), 0);
  const totalCollected = filtered.reduce((s, st) => s + getPaid(st.id, filterTerm, filterYear, data), 0);
  const defaulters     = filtered.filter(s => {
    const exp = getTotalExpected(s, filterTerm, filterYear, data);
    return exp > 0 && getPaid(s.id, filterTerm, filterYear, data) < exp;
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={{ width: 160 }}>
          <option value="">All Classes</option>
          {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterTerm} onChange={e => setFilterTerm(e.target.value)} style={{ width: 100 }}>
          {TERMS.map(t => <option key={t} value={t}>Term {t}</option>)}
        </select>
        <input type="number" value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ width: 80 }} />
        {canManage && <Btn onClick={() => setShowPay(true)}><Icon name="add" size={14} /> Record Payment</Btn>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { l: `Expected (Term ${filterTerm})`, v: `KES ${totalExpected.toLocaleString()}`,            c: '#4f8ef7' },
          { l: 'Collected',                     v: `KES ${totalCollected.toLocaleString()}`,           c: '#10b981' },
          { l: 'Outstanding',                   v: `KES ${(totalExpected-totalCollected).toLocaleString()}`, c: '#ef4444' },
          { l: 'Defaulters',                    v: defaulters.length,                                  c: '#f59e0b' },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background: '#171b26', border: '1px solid #2a3350', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: c, marginBottom: 4 }}>{v}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{l}</div>
          </div>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={TS.table}>
            <thead><tr>
              {['Adm No','Name','Class','Expected','Paid','Balance','Status','Actions'].map(h =>
                <th key={h} style={TS.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={8} style={{ ...TS.td, textAlign: 'center', color: '#64748b', padding: 28 }}>No students found.</td></tr>
                : filtered.map(s => {
                  const exp  = getTotalExpected(s, filterTerm, filterYear, data);
                  const paid = getPaid(s.id, filterTerm, filterYear, data);
                  const bal  = exp - paid;
                  const ovp  = Math.max(0, -bal);
                  const pct  = exp > 0 ? Math.min(100, Math.round(paid / exp * 100)) : 100;
                  return (
                    <tr key={s.id}>
                      <td style={TS.td}><Tag color="blue">{s.admNo}</Tag></td>
                      <td style={{ ...TS.td, fontWeight: 500 }}>{s.name}</td>
                      <td style={TS.td}>{s.class}</td>
                      <td style={TS.td}>{exp > 0 ? `KES ${exp.toLocaleString()}` : '—'}</td>
                      <td style={{ ...TS.td, color: '#10b981', fontWeight: 600 }}>KES {paid.toLocaleString()}</td>
                      <td style={{ ...TS.td, color: bal > 0 ? '#ef4444' : ovp > 0 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                        {bal > 0 ? `KES ${bal.toLocaleString()}` : ovp > 0 ? `+KES ${ovp.toLocaleString()} credit` : '✓ Cleared'}
                      </td>
                      <td style={TS.td}>
                        <Tag color={pct >= 100 ? 'green' : pct > 50 ? 'amber' : 'red'}>
                          {pct >= 100 ? 'Cleared' : `${pct}%`}
                        </Tag>
                      </td>
                      <td style={{ ...TS.td, display: 'flex', gap: 6 }}>
                        <Btn size="sm" variant="ghost" onClick={() => printStudentStatement(s, data)} title="Print full statement">
                          <Icon name="print" size={12} />
                        </Btn>
                        {canManage && (
                          <Btn size="sm" variant="primary" onClick={() => { setPayStudent(s); setShowPay(true); }} title="Record payment">
                            + Pay
                          </Btn>
                        )}
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      </Card>

      {canManage && <RecordPaymentModal show={showPay} onClose={() => { setShowPay(false); setPayStudent(null); }} data={data} setData={setData} defaultStudent={payStudent} />}
    </div>
  );
}

/* ── BY FEE TYPE ──────────────────────────────────────── */
function ByFeeType({ data, setData, user, canManage }) {
  const [selFeeType, setSelFeeType] = useState('');
  const [selClass,   setSelClass]   = useState('');
  const [selTerm,    setSelTerm]    = useState(curTerm());
  const [selYear,    setSelYear]    = useState(String(curYear()));

  const feeTypes   = data.feeTypes || [];
  const allClasses = getAllClasses(data);

  const ft = feeTypes.find(f => f.id === selFeeType);

  // Get students this fee applies to
  const eligibleStudents = useMemo(() => {
    const active = (data.students || []).filter(s => !s.status || s.status === 'active');
    if (!ft) return active;
    const students = ft.appliesToAll
      ? active
      : active.filter(s => (ft.applicableClasses || []).includes(s.class));
    return selClass ? students.filter(s => s.class === selClass) : students;
  }, [ft, selClass, data.students]);

  const cleared   = eligibleStudents.filter(s => {
    const exp  = getExpected(s, selFeeType, selTerm, selYear, data);
    const paid = getPaid(s.id, selTerm, selYear, data, selFeeType);
    return exp > 0 && paid >= exp;
  });
  const pending = eligibleStudents.filter(s => {
    const exp  = getExpected(s, selFeeType, selTerm, selYear, data);
    const paid = getPaid(s.id, selTerm, selYear, data, selFeeType);
    return exp > 0 && paid < exp;
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={selFeeType} onChange={e => setSelFeeType(e.target.value)} style={{ width: 220 }}>
          <option value="">Select fee type...</option>
          {feeTypes.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select value={selClass} onChange={e => setSelClass(e.target.value)} style={{ width: 160 }}>
          <option value="">All Classes</option>
          {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={selTerm} onChange={e => setSelTerm(e.target.value)} style={{ width: 100 }}>
          {TERMS.map(t => <option key={t} value={t}>Term {t}</option>)}
        </select>
        <input type="number" value={selYear} onChange={e => setSelYear(e.target.value)} style={{ width: 80 }} />
        {ft && (
          <Btn variant="ghost" size="sm" onClick={() =>
            printFeeList(eligibleStudents, selFeeType, selTerm, selYear, data, ft.name)
          }>
            <Icon name="print" size={13} /> Print List
          </Btn>
        )}
      </div>

      {!selFeeType ? (
        <Card style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
          Select a fee type above to view the payment status list.
          {feeTypes.length === 0 && <div style={{ marginTop: 12 }}>No fee types added yet. Go to <strong>Fee Structure</strong> tab first.</div>}
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}>
            {[
              { l: 'Eligible Students', v: eligibleStudents.length, c: '#4f8ef7' },
              { l: 'Cleared',           v: cleared.length,          c: '#10b981' },
              { l: 'Pending',           v: pending.length,           c: '#ef4444' },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background: '#171b26', border: '1px solid #2a3350', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: c }}>{v}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{l}</div>
              </div>
            ))}
          </div>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={TS.table}>
                <thead><tr>
                  {['Adm No','Name','Class','Expected','Paid','Balance','Status'].map(h =>
                    <th key={h} style={TS.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {eligibleStudents.map(s => {
                    const exp  = getExpected(s, selFeeType, selTerm, selYear, data);
                    const paid = getPaid(s.id, selTerm, selYear, data, selFeeType);
                    const bal  = exp - paid;
                    return (
                      <tr key={s.id}>
                        <td style={TS.td}>{s.admNo}</td>
                        <td style={{ ...TS.td, fontWeight: 500 }}>{s.name}</td>
                        <td style={TS.td}>{s.class}</td>
                        <td style={TS.td}>{exp > 0 ? `KES ${exp.toLocaleString()}` : '—'}</td>
                        <td style={{ ...TS.td, color: '#10b981', fontWeight: 600 }}>
                          {paid > 0 ? `KES ${paid.toLocaleString()}` : '—'}
                        </td>
                        <td style={{ ...TS.td, color: bal > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                          {bal > 0 ? `KES ${bal.toLocaleString()}` : bal < 0 ? `Credit KES ${Math.abs(bal).toLocaleString()}` : '—'}
                        </td>
                        <td style={TS.td}>
                          <Tag color={bal <= 0 ? 'green' : paid > 0 ? 'amber' : 'red'}>
                            {bal <= 0 ? '✓ Cleared' : paid > 0 ? 'Partial' : 'Not Paid'}
                          </Tag>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* ── PAYMENT HISTORY ──────────────────────────────────── */
function PaymentHistory({ data, setData, user, canManage }) {
  const [search,    setSearch]   = useState('');
  const [showPay,   setShowPay]  = useState(false);
  const [filterFT,  setFilterFT] = useState('');
  const [filterTerm,setFilterT]  = useState('');

  const payments = (data.feePayments || [])
    .filter(p =>
      (!search || p.studentName?.toLowerCase().includes(search.toLowerCase())) &&
      (!filterFT || p.feeTypeId === filterFT) &&
      (!filterTerm || p.term === Number(filterTerm))
    );

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
        <select value={filterFT} onChange={e => setFilterFT(e.target.value)} style={{ width: 180 }}>
          <option value="">All Fee Types</option>
          {(data.feeTypes || []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select value={filterTerm} onChange={e => setFilterT(e.target.value)} style={{ width: 100 }}>
          <option value="">All Terms</option>
          {TERMS.map(t => <option key={t} value={t}>Term {t}</option>)}
        </select>
        {canManage && <Btn onClick={() => setShowPay(true)}><Icon name="add" size={14} /> Record Payment</Btn>}
      </div>

      {payments.length === 0
        ? <Card style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>No payments found.</Card>
        : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={TS.table}>
                <thead><tr>
                  {['Date','Student','Class','Term','Year','Fee Type','Method','Reference','Amount','Receipt'].map(h =>
                    <th key={h} style={TS.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {[...payments].reverse().map(p => {
                    const student = (data.students || []).find(s => s.id === p.studentId);
                    const ft      = (data.feeTypes || []).find(f => f.id === p.feeTypeId);
                    return (
                      <tr key={p.id}>
                        <td style={TS.td}>{p.date}</td>
                        <td style={{ ...TS.td, fontWeight: 500 }}>{p.studentName}</td>
                        <td style={TS.td}>{p.studentClass || student?.class || '—'}</td>
                        <td style={TS.td}>Term {p.term}</td>
                        <td style={TS.td}>{p.year}</td>
                        <td style={TS.td}>{ft?.name || 'General'}</td>
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
        )
      }
      {canManage && <RecordPaymentModal show={showPay} onClose={() => setShowPay(false)} data={data} setData={setData} />}
    </div>
  );
}

/* ── RECORD PAYMENT MODAL ─────────────────────────────── */
function RecordPaymentModal({ show, onClose, data, setData, defaultStudent }) {
  const init = () => ({
    studentId: defaultStudent?.id?.toString() || '',
    feeTypeId: '',
    amount:    '',
    term:      curTerm(),
    year:      String(curYear()),
    method:    'Mpesa',
    reference: '',
  });
  const [form, setForm] = useState(init);

  React.useEffect(() => { if (show) setForm(init()); }, [show, defaultStudent]);

  function save() {
    const student = (data.students || []).find(s => s.id === Number(form.studentId));
    if (!student || !form.amount) return;
    const ft = (data.feeTypes || []).find(f => f.id === form.feeTypeId);
    const payment = {
      id:           Date.now(),
      studentId:    student.id,
      studentName:  student.name,
      studentClass: student.class,
      feeTypeId:    form.feeTypeId || null,
      feeTypeName:  ft?.name || 'General',
      amount:       Number(form.amount),
      date:         new Date().toISOString().split('T')[0],
      term:         Number(form.term),
      year:         Number(form.year),
      method:       form.method,
      reference:    form.reference || `CASH-${Date.now()}`,
    };
    setData(d => ({ ...d, feePayments: [...(d.feePayments || []), payment] }));
    onClose();
    alert(`✅ KES ${Number(form.amount).toLocaleString()} recorded for ${student.name} — ${ft?.name || 'General'} — Term ${form.term} ${form.year}`);
  }

  if (!show) return null;

  return (
    <Modal show={show} onClose={onClose} title="Record Fee Payment">
      <FormGroup label="Student *">
        <select value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}>
          <option value="">Choose student...</option>
          {(data.students || []).filter(s => !s.status || s.status === 'active').map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.admNo}) — {s.class}</option>
          ))}
        </select>
      </FormGroup>
      <FormGroup label="Fee Type *">
        <select value={form.feeTypeId} onChange={e => setForm({ ...form, feeTypeId: e.target.value })}>
          <option value="">Select what this is for...</option>
          {(data.feeTypes || []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </FormGroup>
      <FormRow>
        <FormGroup label="Amount (KES) *">
          <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 5000" />
        </FormGroup>
        <FormGroup label="Year">
          <input type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} />
        </FormGroup>
      </FormRow>
      <FormRow>
        <FormGroup label="Term">
          <select value={form.term} onChange={e => setForm({ ...form, term: e.target.value })}>
            {TERMS.map(t => <option key={t} value={t}>Term {t}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Payment Method">
          <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>
            {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </FormGroup>
      </FormRow>
      <FormGroup label="Reference / Transaction Code">
        <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="e.g. QKW1234567 (blank = auto cash ref)" />
      </FormGroup>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="success" onClick={save} disabled={!form.studentId || !form.amount || !form.feeTypeId}>
          <Icon name="check" size={14} /> Record Payment
        </Btn>
      </div>
    </Modal>
  );
}

/* ── FEE STRUCTURE (Finance/Principal only) ───────────── */
function FeeStructure({ data, setData }) {
  const [showAddType,  setShowAddType]  = useState(false);
  const [showAddSched, setShowAddSched] = useState(false);
  const [typeForm, setTypeForm]   = useState({ name: '', description: '', appliesToAll: true, applicableClasses: [] });
  const [schedForm, setSchedForm] = useState({ feeTypeId: '', class: 'ALL', term: '1', year: String(curYear()), amount: '' });

  const feeTypes    = data.feeTypes    || [];
  const feeSchedule = data.feeSchedule || [];
  const allClasses  = getAllClasses(data);

  function addType() {
    if (!typeForm.name.trim()) return;
    setData(d => ({ ...d, feeTypes: [...(d.feeTypes || []), { id: String(Date.now()), ...typeForm }] }));
    setShowAddType(false);
    setTypeForm({ name: '', description: '', appliesToAll: true, applicableClasses: [] });
  }

  function addSched() {
    if (!schedForm.feeTypeId || !schedForm.amount) return;
    const sch = { id: String(Date.now()), ...schedForm, term: Number(schedForm.term), year: Number(schedForm.year), amount: Number(schedForm.amount) };
    setData(d => ({ ...d, feeSchedule: [...(d.feeSchedule || []), sch] }));
    setShowAddSched(false);
    setSchedForm({ feeTypeId: '', class: 'ALL', term: '1', year: String(curYear()), amount: '' });
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
      <Alert type="info">
        <Icon name="alert" size={14} />
        Finance staff define all fee types here. Amounts are set per class, per term, per year. This drives all balance calculations automatically.
      </Alert>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, marginBottom: 4, flexWrap: 'wrap' }}>
        <Btn size="sm" variant="ghost" onClick={() => printFeeStructure(allClasses, data, 'ALL')}>🖨 Print All Classes Fee Structure</Btn>
        {allClasses.map(cls => (
          <Btn key={cls} size="sm" variant="ghost" onClick={() => printFeeStructure(allClasses, data, cls)}>🖨 {cls}</Btn>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14 }}>
        {/* Fee Types */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <SectionTitle style={{ margin: 0 }}>Fee Types</SectionTitle>
            <Btn size="sm" onClick={() => setShowAddType(true)}><Icon name="add" size={12} /> Add Type</Btn>
          </div>
          {feeTypes.length === 0
            ? <p style={{ color: '#64748b', fontSize: 13 }}>No fee types yet. Add Tuition, Remedials, Sports Fee, etc.</p>
            : feeTypes.map(ft => (
              <div key={ft.id} style={{ padding: '10px 0', borderBottom: '1px solid #2a3350' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{ft.name}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Tag color={ft.appliesToAll ? 'green' : 'blue'}>{ft.appliesToAll ? 'All Classes' : `${(ft.applicableClasses || []).length} classes`}</Tag>
                    <button onClick={() => setData(d => ({ ...d, feeTypes: d.feeTypes.filter(x => x.id !== ft.id) }))}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                </div>
                {ft.description && <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{ft.description}</div>}
                {!ft.appliesToAll && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Applies to: {(ft.applicableClasses || []).join(', ')}</div>}
              </div>
            ))
          }
        </Card>

        {/* Fee Schedule */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <SectionTitle style={{ margin: 0 }}>Amounts Per Class / Term</SectionTitle>
            <Btn size="sm" onClick={() => setShowAddSched(true)} disabled={feeTypes.length === 0}><Icon name="add" size={12} /> Set Amount</Btn>
          </div>
          {feeSchedule.length === 0
            ? <p style={{ color: '#64748b', fontSize: 13 }}>No amounts set. First add fee types, then set amounts per class and term.</p>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={TS.table}>
                  <thead><tr>{['Fee Type','Class','Tm','Year','Amount',''].map(h => <th key={h} style={TS.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {feeSchedule.map(sch => {
                      const ft = feeTypes.find(f => f.id === sch.feeTypeId);
                      return (
                        <tr key={sch.id}>
                          <td style={TS.td}>{ft?.name || '—'}</td>
                          <td style={TS.td}>{sch.class === 'ALL' ? 'All' : sch.class}</td>
                          <td style={TS.td}>T{sch.term}</td>
                          <td style={TS.td}>{sch.year}</td>
                          <td style={{ ...TS.td, fontWeight: 700, color: '#10b981' }}>KES {Number(sch.amount).toLocaleString()}</td>
                          <td style={TS.td}>
                            <button onClick={() => setData(d => ({ ...d, feeSchedule: d.feeSchedule.filter(x => x.id !== sch.id) }))}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </Card>
      </div>

      {/* Add Fee Type Modal */}
      <Modal show={showAddType} onClose={() => setShowAddType(false)} title="Add Fee Type">
        <FormGroup label="Fee Type Name *"><input value={typeForm.name} onChange={e => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="e.g. Tuition Fee, Remedials, Sports Fee, System Fee, Building Fund" autoFocus /></FormGroup>
        <FormGroup label="Description"><input value={typeForm.description} onChange={e => setTypeForm({ ...typeForm, description: e.target.value })} placeholder="Brief description" /></FormGroup>
        <FormGroup>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>
            <input type="checkbox" checked={typeForm.appliesToAll} onChange={e => setTypeForm({ ...typeForm, appliesToAll: e.target.checked })} />
            Applies to ALL classes in the school
          </label>
          {!typeForm.appliesToAll && (
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Select specific classes this fee applies to:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {getAllClasses(data).map(c => (
                  <div key={c} onClick={() => toggleClass(c)} style={{
                    padding: '3px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 500,
                    background: typeForm.applicableClasses.includes(c) ? '#4f8ef7' : '#252d42',
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
          <Btn onClick={addType} disabled={!typeForm.name.trim()}>Add Fee Type</Btn>
        </div>
      </Modal>

      {/* Add Schedule Modal */}
      <Modal show={showAddSched} onClose={() => setShowAddSched(false)} title="Set Fee Amount">
        <FormGroup label="Fee Type *">
          <select value={schedForm.feeTypeId} onChange={e => setSchedForm({ ...schedForm, feeTypeId: e.target.value })}>
            <option value="">Select fee type...</option>
            {feeTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
          </select>
        </FormGroup>
        <FormRow>
          <FormGroup label="Class (ALL = applies to all)">
            <select value={schedForm.class} onChange={e => setSchedForm({ ...schedForm, class: e.target.value })}>
              <option value="ALL">All Classes</option>
              {getAllClasses(data).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Amount (KES) *"><input type="number" value={schedForm.amount} onChange={e => setSchedForm({ ...schedForm, amount: e.target.value })} placeholder="e.g. 15000" /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Term"><select value={schedForm.term} onChange={e => setSchedForm({ ...schedForm, term: e.target.value })}>{TERMS.map(t => <option key={t} value={t}>Term {t}</option>)}</select></FormGroup>
          <FormGroup label="Year"><input type="number" value={schedForm.year} onChange={e => setSchedForm({ ...schedForm, year: e.target.value })} /></FormGroup>
        </FormRow>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowAddSched(false)}>Cancel</Btn>
          <Btn onClick={addSched} disabled={!schedForm.feeTypeId || !schedForm.amount}>Set Amount</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ── PARENT VIEW ──────────────────────────────────────── */
function ParentView({ data, user }) {
  const myChildren = (data.students || []).filter(s => s.parentId === user.parentId || s.parentPhone === user.phone);
  const [selChild, setSelChild] = useState(myChildren[0]?.id || null);
  const [selFT, setSelFT] = useState('');
  const [selTerm, setSelTerm] = useState('');
  const [selClass, setSelClass] = useState('');

  const child = myChildren.find(s => s.id === selChild);

  if (myChildren.length === 0) {
    return <Card style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>No students linked to your account. Contact the school office.</Card>;
  }

  const feeTypes = data.feeTypes || [];
  const payments = (data.feePayments || []).filter(p =>
    p.studentId === selChild &&
    (!selFT || p.feeTypeId === selFT) &&
    (!selTerm || p.term === Number(selTerm)) &&
    (!selClass || p.studentClass === selClass)
  );

  // All classes this child has been in (based on payments)
  const childClasses = [...new Set((data.feePayments || []).filter(p => p.studentId === selChild).map(p => p.studentClass).filter(Boolean))];

  return (
    <div>
      {myChildren.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {myChildren.map(c => (
            <div key={c.id} onClick={() => { setSelChild(c.id); setSelClass(''); setSelFT(''); setSelTerm(''); }}
              style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13,
                background: selChild === c.id ? '#4f8ef7' : '#1e2435',
                color: selChild === c.id ? '#fff' : '#94a3b8',
                border: `1px solid ${selChild === c.id ? '#4f8ef7' : '#2a3350'}` }}>
              {c.name} — {c.class}
            </div>
          ))}
        </div>
      )}

      {child && (
        <>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#4f8ef730', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: '#4f8ef7' }}>
                {child.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{child.name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{child.admNo} · {child.class}</div>
              </div>
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <select value={selFT} onChange={e => setSelFT(e.target.value)} style={{ width: 180 }}>
              <option value="">All Fee Types</option>
              {feeTypes.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select value={selTerm} onChange={e => setSelTerm(e.target.value)} style={{ width: 100 }}>
              <option value="">All Terms</option>
              {TERMS.map(t => <option key={t} value={t}>Term {t}</option>)}
            </select>
            {childClasses.length > 0 && (
              <select value={selClass} onChange={e => setSelClass(e.target.value)} style={{ width: 160 }}>
                <option value="">All Classes (ever)</option>
                {childClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <Btn variant="ghost" size="sm" onClick={() => printStudentStatement(child, data)}>
              <Icon name="print" size={13} /> Print Full Statement
            </Btn>
          </div>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={TS.table}>
                <thead><tr>{['Date','Fee Type','Class','Term','Year','Method','Reference','Amount'].map(h => <th key={h} style={TS.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {payments.length === 0
                    ? <tr><td colSpan={8} style={{ ...TS.td, textAlign: 'center', color: '#64748b', padding: 24 }}>No payment records found for selected filters.</td></tr>
                    : [...payments].reverse().map(p => {
                      const ft = feeTypes.find(f => f.id === p.feeTypeId);
                      return (
                        <tr key={p.id}>
                          <td style={TS.td}>{p.date}</td>
                          <td style={{ ...TS.td, fontWeight: 500 }}>{ft?.name || 'General'}</td>
                          <td style={TS.td}>{p.studentClass || child.class}</td>
                          <td style={TS.td}>Term {p.term}</td>
                          <td style={TS.td}>{p.year}</td>
                          <td style={TS.td}>{p.method}</td>
                          <td style={{ ...TS.td, fontFamily: 'monospace', fontSize: 11 }}>{p.reference}</td>
                          <td style={{ ...TS.td, color: '#10b981', fontWeight: 700 }}>KES {p.amount.toLocaleString()}</td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

const TS = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:    { textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #2a3350', background: '#1e2435', whiteSpace: 'nowrap' },
  td:    { padding: '10px 12px', borderBottom: '1px solid #2a3350', color: '#e2e8f0' },
};

import React, { useState } from 'react';
import { Card, Btn, FormGroup, SectionTitle, Alert, Tag, Icon } from './UI';
import { getAllClasses, getGrade, getScore, getClassSortIndex, getExamTypeRank, getSubjectsForClass } from '../data/initialData';
import { computeRankings } from '../utils/print';

/* ═══════════════════════════════════════════════════════
   PARENT MESSAGING SYSTEM
   • Send SMS to all parents (one click)
   • Send exam results to all parents (one click)
   • Uses SMS gateway — configure provider in Settings
   • Logs all sent messages
   • Supports WhatsApp format (printable copy for manual sending)
═══════════════════════════════════════════════════════ */

function getSMSGatewayConfig(data) {
  return data.smsConfig || {
    provider: 'africastalking', // 'africastalking' | 'twilio' | 'vonage' | 'manual'
    apiKey: '',
    senderId: data.schoolName?.slice(0, 11) || 'School',
    username: '',
  };
}

// Normalizes a raw, free-typed parent phone number into the +254XXXXXXXXX
// format Africa's Talking requires — or returns null if it genuinely
// doesn't look like a valid Kenyan mobile number. Blindly doing
// `+254${phone.replace(/^0/, '')}` (the old approach) mangles anything
// that wasn't typed as exactly "07XXXXXXXX"/"01XXXXXXXX" — a number
// already containing "+254", stray spaces/dashes, or a wrong digit count
// all produce garbage that Africa's Talking rejects. Because
// broadcastMessage sends every recipient in ONE comma-joined request,
// a single bad number used to get the ENTIRE batch rejected — nobody
// got the message, not just the parent with the bad number.
function normalizeKenyanPhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d]/g, '');
  if (digits.length === 12 && digits.startsWith('254')) return '+' + digits;
  if (digits.length === 10 && digits.startsWith('0'))   return '+254' + digits.slice(1);
  if (digits.length === 9 && /^[17]/.test(digits))      return '+254' + digits;
  return null;
}

async function sendSMSViaSenderId(phones, message, config) {
  // Africa's Talking's API cannot be called directly from a browser — it
  // has no CORS headers, so the request gets silently blocked by the
  // browser before it ever reaches Africa's Talking's servers. This is
  // exactly why sends could report "success" in the app while Africa's
  // Talking's own dashboard showed zero messages and an untouched wallet.
  // We route through the Netlify function (netlify/functions/send-sms.js)
  // instead, which was already built for this and does the same request
  // server-side where CORS doesn't apply.
  if (config.provider === 'africastalking') {
    try {
      const res = await fetch('/.netlify/functions/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phones.join(','),
          message,
          username: config.username || 'sandbox',
          senderId: config.senderId,
          apiKey: config.apiKey,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        return { ok: false, error: json.error || `HTTP ${res.status}`, json };
      }
      // Africa's Talking returns HTTP 200 even when it rejects individual
      // numbers — the real per-recipient result is inside
      // SMSMessageData.Recipients[].status ("Success" or a rejection
      // reason). Checking only res.ok (as before) would still call a
      // fully-rejected batch a "success". We check every recipient here.
      //
      // IMPORTANT: a whole-batch rejection (e.g. an invalid or
      // unregistered Sender ID) comes back as Recipients: [] — an EMPTY
      // array — with the real reason in SMSMessageData.Message instead of
      // per-recipient. An empty array used to fall through every check
      // below and return ok:true, which is exactly how a batch could be
      // fully rejected by Africa's Talking (0 recipients, nothing in
      // their Outbox, wallet untouched) while the app still reported
      // "Message sent!". We now treat an empty Recipients array as a
      // failure and surface the top-level Message as the reason.
      const recipients = json?.SMSMessageData?.Recipients || [];
      if (recipients.length === 0) {
        return { ok: false, error: json?.SMSMessageData?.Message || 'Africa\'s Talking rejected the request (no recipients were processed — check your Sender ID and phone number format).', json };
      }
      const failed = recipients.filter(r => r.status !== 'Success');
      if (failed.length === recipients.length) {
        return { ok: false, error: failed[0]?.status || 'All recipients rejected', json };
      }
      return { ok: true, json, failedNumbers: failed.map(r => r.number) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  return { ok: false, error: 'SMS provider not configured' };
}

function QuickPhoneInput({ student, onSave }) {
  const [val, setVal] = useState('');
  return (
    <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
      <input autoFocus value={val} onChange={e => setVal(e.target.value)} placeholder="07XXXXXXXX"
        style={{ flex: 1, padding: '6px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)' }} />
      <button onClick={() => onSave(student.id, val)} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
        Save Number
      </button>
    </div>
  );
}

export default function ParentMessaging({ data, setData, user }) {
  const isPrincipal = user.role === 'principal';
  const classes     = getAllClasses(data);

  const [tab, setTab]       = useState('broadcast'); // 'broadcast' | 'results' | 'logs' | 'config'
  const [message, setMsg]   = useState('');
  const [selClass, setSel]  = useState('ALL');
  const [selExam, setExam]  = useState('');
  const [sending, setSend]  = useState(false);
  const [preview, setPrev]  = useState(false);
  const [smsConf, setSmsConf] = useState(() => getSMSGatewayConfig(data));
  const [testPhone, setTestPhone]   = useState('');
  const [testSending, setTestSend]  = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok, detail }

  // Recipient targeting — either the whole class(es) as before, or one
  // specific student (so a secretary/teacher can message just one parent
  // without broadcasting to the whole class).
  const [recipientMode, setRecipientMode] = useState('class'); // 'class' | 'student'
  const [studentSearch, setStudentSearch] = useState('');
  const [selStudentId, setSelStudentId]   = useState('');

  // Fast phone-number tools — see students missing a parent phone number
  // and add/fix one inline, right from the messaging page, instead of
  // navigating away to Students first.
  const [showNoPhonePanel, setShowNoPhonePanel] = useState(false);
  const [phoneNoDraft, setPhoneNoDraft]         = useState({}); // { [studentId]: draftValue }
  const [editingPhoneId, setEditingPhoneId]     = useState(null);
  const [showAddStudent, setShowAddStudent]     = useState(false);
  const [newStudentForm, setNewStudentForm]     = useState({ name: '', admNo: '', class: '', parentName: '', parentPhone: '' });

  const SMS_LIMIT = 160;

  const logs = data.parentMessages || [];

  // Gather phones for selected class — or, in single-student mode, just
  // that one student's parent.
  function getTargetStudents() {
    const students = data.students || [];
    if (recipientMode === 'student') {
      const one = students.find(s => String(s.id) === String(selStudentId));
      return one && one.parentPhone ? [one] : [];
    }
    if (selClass === 'ALL') return students.filter(s => s.parentPhone);
    return students.filter(s => s.class === selClass && s.parentPhone);
  }

  // Students matching the search box, for the individual-recipient picker
  // — searches name and admission number so it's fast to find one kid in
  // a big school.
  const searchResults = studentSearch.trim()
    ? (data.students || []).filter(s => {
        const q = studentSearch.trim().toLowerCase();
        return s.name?.toLowerCase().includes(q) || String(s.admNo || '').toLowerCase().includes(q);
      }).slice(0, 20)
    : [];
  const selectedStudent = (data.students || []).find(s => String(s.id) === String(selStudentId));

  // Students missing a parent phone number — scoped to the class filter
  // when one's picked, otherwise the whole school — so it's fast to spot
  // and fix exactly the gaps that would otherwise silently exclude a
  // parent from a broadcast.
  const studentsWithoutPhone = (data.students || []).filter(s =>
    !s.parentPhone && (selClass === 'ALL' || s.class === selClass)
  );

  function savePhoneNumber(studentId, value) {
    if (!value || !value.trim()) return;
    setData(d => ({
      ...d,
      students: d.students.map(s => s.id === studentId ? { ...s, parentPhone: value.trim() } : s),
    }));
    setEditingPhoneId(null);
    setPhoneNoDraft(f => { const n = { ...f }; delete n[studentId]; return n; });
  }

  function addStudentQuick() {
    if (!newStudentForm.name.trim() || !newStudentForm.class) { alert('Name and class are required.'); return; }
    setData(d => ({
      ...d,
      students: [...(d.students || []), {
        id: Date.now(), ...newStudentForm, name: newStudentForm.name.trim(),
      }],
    }));
    setShowAddStudent(false);
    setNewStudentForm({ name: '', admNo: '', class: '', parentName: '', parentPhone: '' });
  }

  const targets = getTargetStudents();
  const uniquePhones = [...new Set(targets.map(s => s.parentPhone).filter(Boolean))];

  function buildResultMessage(student, exam, posMap, hasStreams) {
    if (!exam) return '';
    const res     = exam.results[student.name] || {};
    const entered = Object.keys(res); // which subjects to actually list in the SMS
    if (!entered.length) return '';
    const scores  = entered.map(sub => {
      const sc = getScore(res[sub]);
      const gr = sc !== null ? getGrade(sc) : null;
      return `${sub}: ${sc ?? '-'}${gr ? ' (' + gr.label + ')' : ''}`;
    });
    // Total/mean/points must be divided by the FULL subject list for the
    // class, not just the subjects this student happens to have entered —
    // same fix as everywhere else this was wrong (Exams.jsx, print.js).
    const expected = getSubjectsForClass(student.class, data);
    const total    = expected.reduce((a, k) => a + (getScore(res[k]) ?? 0), 0);
    const mean     = expected.length ? Math.round(total / expected.length) : 0;
    const grade    = getGrade(mean);
    const points   = expected.reduce((a, k) => a + getGrade(getScore(res[k]) ?? 0).points, 0);

    const pos = posMap?.[student.name];
    let posLine = '';
    if (pos) {
      // A class with streams gets BOTH: this student's position within
      // their own stream, and their position across the whole grade
      // (all streams combined) — a single "Position" figure would hide
      // whichever one wasn't shown, and parents in a streamed school
      // usually want to see both.
      posLine = hasStreams && pos.streamPos
        ? `Position: ${pos.streamPos}/${pos.streamOf} in stream, ${pos.overallPos}/${pos.overallOf} in grade\n`
        : `Position: ${pos.overallPos}/${pos.overallOf}\n`;
    }

    return `${data.schoolName || 'School'}\n${exam.name} Results\nStudent: ${student.name}\nAdm: ${student.admNo}\n${scores.join(', ')}\nMean: ${mean} (${grade.label}) · Points: ${points}\n${posLine}Regards, School Administration`;
  }

  // Gives every broadcast the same school-name heading that result messages
  // already get from buildResultMessage — so a parent seeing an SMS from a
  // generic short code/sender still immediately knows which school it's
  // from, without every admin having to remember to type it themselves.
  function buildBroadcastMessage(body) {
    return `${data.schoolName || 'School'}\n\n${body.trim()}`;
  }

  async function broadcastMessage() {
    if (!message.trim()) { alert('Please type a message first'); return; }
    if (uniquePhones.length === 0) {
      alert(recipientMode === 'student' ? 'This student has no parent phone number on file. Add one below first.' : 'No parent phone numbers found for the selected class. Add phone numbers in Student records.');
      return;
    }
    const fullMessageCheck = buildBroadcastMessage(message);
    if (fullMessageCheck.length > SMS_LIMIT) { alert(`Message is over the ${SMS_LIMIT}-character SMS limit. Shorten it before sending.`); return; }
    const recipientLabel = recipientMode === 'student' ? (selectedStudent?.name || 'this student') + "'s parent" : `${uniquePhones.length} parent(s)`;
    if (!window.confirm(`Send message to ${recipientLabel}?`)) return;
    setSend(true);
    const conf = getSMSGatewayConfig(data);

    const fullMessage = buildBroadcastMessage(message);

    if (conf.provider === 'manual') {
      const log = {
        id: Date.now(), date: new Date().toISOString(), type: 'broadcast',
        message: fullMessage, class: recipientMode === 'student' ? `${selectedStudent?.name} (individual)` : selClass, recipientCount: uniquePhones.length,
        sentBy: user.name, delivered: false,
      };
      setData(d => ({ ...d, parentMessages: [log, ...(d.parentMessages || [])] }));
      setSend(false); setMsg('');
      printManualSMS(targets, fullMessage, data);
      return;
    }

    // IMPORTANT: if the provider is set to a real gateway (africastalking)
    // but there's no API key configured, that's a configuration problem —
    // NOT a reason to silently pretend the send succeeded. The previous
    // version defaulted `ok = true` and skipped straight to the success
    // alert in this exact case, meaning a missing/not-yet-saved API key
    // produced "✅ Message sent!" without ever calling the API at all.
    if (!conf.apiKey) {
      setSend(false);
      alert('⚠ No API key configured yet. Go to SMS Setup and save your Africa\'s Talking API key before sending — nothing was sent.');
      return;
    }

    // Validate/normalize every number BEFORE sending. Previously all
    // numbers were joined into one request with a blind +254 prefix — one
    // malformed number (stray spaces, already had +254, wrong digit
    // count, etc.) got the ENTIRE batch rejected by Africa's Talking, so
    // nobody received the message, not just the parent with the bad
    // number. Now we separate good numbers from bad ones up front and
    // still send to everyone whose number is actually valid.
    const validPhones = [];
    const badNumbers = []; // [{ name, phone }]
    targets.forEach(s => {
      const norm = normalizeKenyanPhone(s.parentPhone);
      if (norm) validPhones.push(norm);
      else badNumbers.push({ name: s.name, phone: s.parentPhone });
    });
    const uniqueValidPhones = [...new Set(validPhones)];

    if (uniqueValidPhones.length === 0) {
      setSend(false);
      alert(`⚠ None of the ${badNumbers.length} phone number(s) for this class look valid — nothing was sent. Fix them in Student records first (expected format: 07XXXXXXXX or 01XXXXXXXX).`);
      return;
    }

    const result = await sendSMSViaSenderId(uniqueValidPhones, fullMessage, conf);
    const log = {
      id: Date.now(), date: new Date().toISOString(), type: 'broadcast',
      message: fullMessage, class: recipientMode === 'student' ? `${selectedStudent?.name} (individual)` : selClass, recipientCount: uniqueValidPhones.length,
      skippedCount: badNumbers.length, skippedDetails: badNumbers,
      sentBy: user.name, delivered: result.ok,
    };
    setData(d => ({ ...d, parentMessages: [log, ...(d.parentMessages || [])] }));
    setSend(false); setMsg('');
    if (!result.ok) {
      alert(`⚠ SMS failed to send: ${result.error}\n\nNo messages were delivered. Check your Africa's Talking dashboard (wallet balance, API key, Sender ID status) and try again.`);
    } else {
      let msg = `✅ Message sent to ${uniqueValidPhones.length} parent(s)! (Confirmed by Africa's Talking's response — check their Outbox to verify final delivery.)`;
      if (badNumbers.length > 0) {
        msg += `\n\n⚠ Skipped ${badNumbers.length} invalid number(s) — fix these in Student records:\n` +
          badNumbers.slice(0, 10).map(b => `• ${b.name}: "${b.phone}"`).join('\n');
      }
      alert(msg);
    }
  }

  async function sendResults() {
    const exam = (data.exams || []).find(e => e.id === Number(selExam));
    if (!exam) { alert('Select an exam first.'); return; }
    const students = data.students.filter(s =>
      exam.results[s.name] && s.parentPhone &&
      (selClass === 'ALL' || s.class === selClass)
    );
    if (!students.length) { alert('No students with results and phone numbers found.'); return; }
    if (!window.confirm(`Send results to ${students.length} parent(s)?`)) return;
    setSend(true);
    const conf = getSMSGatewayConfig(data);

    if (conf.provider !== 'manual' && !conf.apiKey) {
      // Same guard as broadcastMessage: a real gateway with no API key is
      // a configuration problem, not a silent success. This used to fall
      // into the same "sentCount++, no delivery to verify" branch as
      // genuine manual mode, meaning it reported success without ever
      // calling the API.
      setSend(false);
      alert('⚠ No API key configured yet. Go to SMS Setup and save your Africa\'s Talking API key before sending — nothing was sent.');
      return;
    }

    let sentCount = 0;
    const failures = []; // [{ name, phone, error }] — real failures, not guesses
    // Computed once for the whole exam — computeRankings sorts every
    // student in the sibling streams, so doing this per-student inside the
    // loop below would be needlessly expensive for a big class.
    const { posMap, hasStreams } = computeRankings(exam, data.students, data);
    for (const student of students) {
      const msg = buildResultMessage(student, exam, posMap, hasStreams);
      if (!msg) continue;
      if (conf.provider === 'manual') {
        sentCount++; // manual/print mode — no delivery to verify
      } else {
        const phone = normalizeKenyanPhone(student.parentPhone);
        if (!phone) {
          failures.push({ name: student.name, phone: student.parentPhone, error: 'Invalid phone number format' });
          continue;
        }
        const result = await sendSMSViaSenderId([phone], msg, conf);
        if (result.ok) {
          sentCount++;
        } else {
          failures.push({ name: student.name, phone: student.parentPhone, error: result.error || 'Unknown error' });
        }
      }
    }
    const log = {
      id: Date.now(), date: new Date().toISOString(), type: 'results',
      examName: exam.name, class: selClass, recipientCount: sentCount,
      failedCount: failures.length, failedDetails: failures,
      sentBy: user.name, delivered: conf.provider !== 'manual',
    };
    setData(d => ({ ...d, parentMessages: [log, ...(d.parentMessages || [])] }));
    setSend(false);
    if (conf.provider === 'manual') {
      printAllResultSMS(students, exam, data);
    } else if (failures.length > 0) {
      alert(`⚠ Sent to ${sentCount} parent(s), but ${failures.length} FAILED:\n\n` +
        failures.slice(0, 10).map(f => `• ${f.name} (${f.phone}): ${f.error}`).join('\n') +
        (failures.length > 10 ? `\n...and ${failures.length - 10} more (see Message Logs).` : '') +
        `\n\nCheck the phone numbers and your Africa's Talking dashboard for details.`);
    } else {
      alert(`✅ Results sent to ${sentCount} parent(s)! (Verified via Africa's Talking response — check their dashboard to confirm final delivery.)`);
    }
  }

  function printManualSMS(students, msg, data) {
    const rows = students.map(s =>
      `<tr><td style="padding:5px 8px;border:1px solid #ddd">${s.admNo}</td>
       <td style="padding:5px 8px;border:1px solid #ddd">${s.name}</td>
       <td style="padding:5px 8px;border:1px solid #ddd">${s.parentPhone}</td>
       <td style="padding:5px 8px;border:1px solid #ddd">${s.parentName || '-'}</td></tr>`
    ).join('');
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Broadcast SMS</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}@media print{.np{display:none}}</style></head><body>
    <h2>📱 SMS to Send — ${data.schoolName}</h2>
    <div style="background:#f5f5f5;padding:12px;border-radius:8px;margin-bottom:16px;white-space:pre-line;font-size:13px">${msg}</div>
    <table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:#003399;color:#fff"><th style="padding:6px 8px;border:1px solid #003399">Adm</th>
    <th style="padding:6px 8px;border:1px solid #003399;text-align:left">Student</th>
    <th style="padding:6px 8px;border:1px solid #003399">Phone</th>
    <th style="padding:6px 8px;border:1px solid #003399;text-align:left">Parent</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <button class="np" onclick="window.print()" style="margin-top:12px;padding:8px 16px;background:#003399;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Print</button>
    </body></html>`);
  }

  function printAllResultSMS(students, exam, data) {
    const { posMap, hasStreams } = computeRankings(exam, data.students, data);
    const rows = students.map(s => {
      const msg = buildResultMessage(s, exam, posMap, hasStreams);
      return `<tr><td style="padding:5px 8px;border:1px solid #ddd;vertical-align:top">${s.name}</td>
        <td style="padding:5px 8px;border:1px solid #ddd">${s.parentPhone}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;white-space:pre-line;font-size:11px">${msg}</td></tr>`;
    }).join('');
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Results SMS</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}@media print{.np{display:none}}</style></head><body>
    <h2>📱 Results SMS — ${exam.name} — ${data.schoolName}</h2>
    <table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:#003399;color:#fff"><th style="padding:6px 8px;border:1px solid #003399;text-align:left">Student</th>
    <th style="padding:6px 8px;border:1px solid #003399">Phone</th>
    <th style="padding:6px 8px;border:1px solid #003399;text-align:left">Message</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <button class="np" onclick="window.print()" style="margin-top:12px;padding:8px 16px;background:#003399;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Print</button>
    </body></html>`);
  }

  function saveSmsConfig() {
    setData(d => ({ ...d, smsConfig: smsConf }));
    alert('SMS configuration saved!');
  }

  // Sends a single real SMS to whatever number is typed in the test field,
  // using whatever is currently in the form (saves it first so the test
  // matches exactly what "Save" would store). Surfaces Africa's Talking's
  // own per-recipient status/cost/messageId, or its exact rejection
  // reason, instead of a generic pass/fail — this is what actually
  // confirms a Sender ID like ELIMU_PRO is live and usable, since AT can
  // return HTTP 200 "success" for a batch it fully rejected.
  async function sendTestSMS() {
    if (!smsConf.apiKey) { alert('Enter your API key first.'); return; }
    const phone = normalizeKenyanPhone(testPhone);
    if (!phone) { alert('Enter a valid Kenyan number, e.g. 07XXXXXXXX or +2547XXXXXXXX.'); return; }

    setData(d => ({ ...d, smsConfig: smsConf })); // keep config in sync with what we're testing
    setTestSend(true);
    setTestResult(null);
    const result = await sendSMSViaSenderId(
      [phone],
      `Test message from ${data.schoolName || 'EduManage'} — Sender ID "${smsConf.senderId || '(default)'}" is working.`,
      smsConf
    );
    setTestSend(false);

    if (result.ok) {
      const r = result.json?.SMSMessageData?.Recipients?.[0];
      setTestResult({
        ok: true,
        detail: r
          ? `Delivered to ${r.number} · status: ${r.status} · cost: ${r.cost} · messageId: ${r.messageId}`
          : 'Sent successfully.',
      });
    } else {
      setTestResult({ ok: false, detail: result.error || 'Unknown error.' });
    }
  }

  const exams = data.exams || [];

  return (
    <div>
      <SectionTitle>📱 Parent Messaging</SectionTitle>

      <Alert type="info" style={{ marginBottom: 16 }}>
        <Icon name="alert" size={14} />
        This sends real <strong>SMS text messages</strong> to parents' phones — it is not an in-app chat.
        Parents do not see these in the Parent Portal. If no SMS gateway is configured below (SMS Setup tab),
        clicking "Send" will instead open a printable list of messages + phone numbers for you to send manually
        (e.g. via your own phone or WhatsApp).
      </Alert>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['broadcast','📢 Broadcast Message'],['results','📊 Send Results'],['logs','📋 Message Logs'],...(isPrincipal ? [['config','⚙ SMS Setup']] : [])].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === t ? '#4f8ef7' : 'var(--surface2)', color: tab === t ? '#fff' : 'var(--text-sub)', fontWeight: 600, fontSize: 13,
          }}>{l}</button>
        ))}
      </div>

      {tab === 'broadcast' && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
            Send Message to Parents
          </div>

          {/* Recipient mode toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[['class','👨‍👩‍👧 By Class'],['student','🔍 One Parent']].map(([m,l]) => (
              <button key={m} onClick={() => { setRecipientMode(m); setStudentSearch(''); setSelStudentId(''); }} style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer',
                background: recipientMode === m ? '#4f8ef715' : 'var(--bg)',
                borderColor: recipientMode === m ? '#4f8ef7' : 'var(--border)',
                color: recipientMode === m ? '#4f8ef7' : 'var(--text-sub)', fontWeight: 600, fontSize: 13,
              }}>{l}</button>
            ))}
          </div>

          {recipientMode === 'class' ? (
            <FormGroup label="Target Class">
              <select value={selClass} onChange={e => setSel(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}>
                <option value="ALL">All Classes ({(data.students||[]).filter(s=>s.parentPhone).length} parents with phones)</option>
                {classes.map(c => {
                  const count = (data.students||[]).filter(s=>s.class===c&&s.parentPhone).length;
                  return <option key={c} value={c}>{c} ({count} parents)</option>;
                })}
              </select>
            </FormGroup>
          ) : (
            <FormGroup label="Search for a student">
              <input value={studentSearch} onChange={e => { setStudentSearch(e.target.value); setSelStudentId(''); }}
                placeholder="Type a name or admission number..."
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
              {studentSearch.trim() && !selStudentId && (
                <div style={{ marginTop: 6, maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  {searchResults.length === 0
                    ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)' }}>No students match "{studentSearch}".</div>
                    : searchResults.map(s => (
                      <div key={s.id} onClick={() => { setSelStudentId(s.id); setStudentSearch(''); }}
                        style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span>{s.name} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>· {s.class}{s.admNo ? ` · Adm ${s.admNo}` : ''}</span></span>
                        {!s.parentPhone && <span style={{ color: '#f59e0b', fontSize: 11, fontWeight: 700 }}>NO PHONE</span>}
                      </div>
                    ))}
                </div>
              )}
              {selectedStudent && (
                <div style={{ marginTop: 8, padding: 10, background: 'var(--surface2)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{selectedStudent.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {selectedStudent.class} · Parent: {selectedStudent.parentName || '—'} ·{' '}
                      {selectedStudent.parentPhone
                        ? <span style={{ color: '#10b981' }}>{selectedStudent.parentPhone}</span>
                        : <span style={{ color: '#ef4444', fontWeight: 700 }}>No phone number on file</span>}
                    </div>
                  </div>
                  <button onClick={() => setSelStudentId('')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
              )}
              {selectedStudent && !selectedStudent.parentPhone && (
                <QuickPhoneInput student={selectedStudent} onSave={savePhoneNumber} />
              )}
            </FormGroup>
          )}

          {/* Missing phone numbers — fast to see and fix without leaving this page */}
          <div style={{ marginTop: 4, marginBottom: 14 }}>
            <button onClick={() => setShowNoPhonePanel(v => !v)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              color: studentsWithoutPhone.length ? '#f59e0b' : 'var(--text-muted)', padding: 0,
            }}>
              {showNoPhonePanel ? '▾' : '▸'} {studentsWithoutPhone.length} student(s) {selClass !== 'ALL' && recipientMode==='class' ? `in ${selClass} ` : ''}missing a parent phone number
            </button>
            {showNoPhonePanel && (
              <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, maxHeight: 260, overflowY: 'auto' }}>
                {studentsWithoutPhone.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>Everyone has a phone number on file. 🎉</div>
                ) : studentsWithoutPhone.map(s => (
                  <div key={s.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 13 }}>{s.name} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>· {s.class}</span></div>
                    {editingPhoneId === s.id ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input autoFocus value={phoneNoDraft[s.id] ?? ''} onChange={e => setPhoneNoDraft(f => ({ ...f, [s.id]: e.target.value }))}
                          placeholder="07XXXXXXXX" style={{ width: 130, padding: '4px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)' }} />
                        <button onClick={() => savePhoneNumber(s.id, phoneNoDraft[s.id])} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Save</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingPhoneId(s.id)} style={{ background: 'none', border: '1px solid #4f8ef7', color: '#4f8ef7', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>+ Add number</button>
                    )}
                  </div>
                ))}
                <div style={{ padding: 8 }}>
                  <button onClick={() => setShowAddStudent(true)} style={{ background: 'none', border: 'none', color: '#4f8ef7', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>+ Add a new student</button>
                </div>
              </div>
            )}
          </div>

          <FormGroup label="Message">
            <textarea value={message} onChange={e => setMsg(e.target.value)} rows={5}
              placeholder={`Dear Parent/Guardian,\n\n[Your message here]\n\nRegards,\n${data.schoolName || 'School'} Administration`}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
          </FormGroup>

          {/* Live preview — every broadcast is automatically prefixed with the
              school name heading (same as exam results already get from
              buildResultMessage), so parents always know which school an SMS
              is from, without the admin having to type it every time.
              Showing the actual wrapped text — not just what's in the
              textarea — means the character count and preview here always
              match exactly what gets sent/billed. */}
          {message.trim() && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
                Preview — what parents will receive
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #10b98112, #10b98108)',
                border: '1px solid #10b98135',
                borderRadius: '14px 14px 14px 4px',
                padding: '12px 14px',
                maxWidth: 420,
                whiteSpace: 'pre-wrap',
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--text)',
              }}>
                <div style={{ fontWeight: 700, color: '#10b981', marginBottom: 4 }}>
                  {data.schoolName || 'School'}
                </div>
                <div>{message.trim()}</div>
              </div>
            </div>
          )}

          {(() => {
            const fullLen = buildBroadcastMessage(message).length;
            const over = fullLen > SMS_LIMIT;
            const targetCount = recipientMode === 'student' ? (selectedStudent && selectedStudent.parentPhone ? 1 : 0) : uniquePhones.length;
            return (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Btn onClick={broadcastMessage} disabled={sending || !message.trim() || over || targetCount === 0} style={{ background: over ? 'var(--text-muted)' : '#10b981' }}>
                    {sending ? '⏳ Sending...' : `📤 Send to ${targetCount} Parent(s)`}
                  </Btn>
                  <span style={{ fontSize: 12, fontWeight: over ? 700 : 400, color: over ? '#ef4444' : 'var(--text-muted)' }}>
                    {fullLen} / {SMS_LIMIT} characters{over ? ' — too long, shorten your message' : ''}
                  </span>
                </div>
                {/* Only Send Results messages are allowed past the standard
                    single-SMS length — a results message legitimately needs
                    room for every subject's score and grade, but a general
                    broadcast staying under 160 chars keeps it as one SMS
                    (cheaper, and avoids messages arriving out of order across
                    multiple parts on older phones). */}
                {over && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Broadcast messages are capped at {SMS_LIMIT} characters (one SMS). Only exam results messages are allowed to be longer.
                  </div>
                )}
              </>
            );
          })()}
          {!getSMSGatewayConfig(data).apiKey && (
            <Alert type="warning" style={{ marginTop: 12 }}>
              ⚠ SMS gateway not configured. Click "SMS Setup" to add your API key. Until then, a printable list will open instead.
            </Alert>
          )}

          {/* ── Quick Add Student Modal ── */}
          {showAddStudent && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
              onClick={() => setShowAddStudent(false)}>
              <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, width: 340, maxWidth: '90vw' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>+ Add New Student</div>
                <FormGroup label="Full Name *">
                  <input value={newStudentForm.name} onChange={e => setNewStudentForm(f => ({ ...f, name: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                </FormGroup>
                <FormGroup label="Class *">
                  <select value={newStudentForm.class} onChange={e => setNewStudentForm(f => ({ ...f, class: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}>
                    <option value="">Select class...</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FormGroup>
                <FormGroup label="Admission No.">
                  <input value={newStudentForm.admNo} onChange={e => setNewStudentForm(f => ({ ...f, admNo: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                </FormGroup>
                <FormGroup label="Parent Name">
                  <input value={newStudentForm.parentName} onChange={e => setNewStudentForm(f => ({ ...f, parentName: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                </FormGroup>
                <FormGroup label="Parent Phone">
                  <input value={newStudentForm.parentPhone} onChange={e => setNewStudentForm(f => ({ ...f, parentPhone: e.target.value }))}
                    placeholder="07XXXXXXXX"
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                </FormGroup>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                  This adds the student with the essentials needed for messaging. Add fees, streams, and other details later from Students.
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Btn variant="ghost" onClick={() => setShowAddStudent(false)}>Cancel</Btn>
                  <Btn onClick={addStudentQuick}>Add Student</Btn>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {tab === 'results' && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
            Send Exam Results to Parents — One Click
          </div>
          <Alert type="info">
            📊 Each parent receives their child's individual results by SMS. Results include all subjects, scores, grades, and mean.
          </Alert>
          <FormGroup label="Filter by Class" style={{ marginTop: 12 }}>
            <select value={selClass} onChange={e => { setSel(e.target.value); setExam(''); }}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}>
              <option value="ALL">All Classes</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Select Exam">
            <select value={selExam} onChange={e => setExam(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}>
              <option value="">-- Select Exam --</option>
              {/* IMPORTANT: only show exams for the class picked above (or all,
                  sorted by class, when "All Classes" is selected). Previously
                  this listed every exam from every grade in one flat, unsorted
                  list — easy to pick a Grade 1 exam while "Filter by Class"
                  said Grade 2, which silently produced "0 students" below
                  with no clue why. Sorting by class also groups duplicate-
                  looking entries (e.g. multiple "oppener"/"Mid-Term" exams
                  per grade) together so they're easier to spot and clean up
                  from Exams & Reports if they're not wanted. */}
              {exams
                .filter(e => selClass === 'ALL' || e.class === selClass)
                .slice()
                .sort((a, b) =>
                  getClassSortIndex(a.class, data) - getClassSortIndex(b.class, data) ||
                  Number(a.year) - Number(b.year) ||
                  Number(a.term) - Number(b.term) ||
                  getExamTypeRank(a.name) - getExamTypeRank(b.name) ||
                  (a.name || '').localeCompare(b.name || '')
                )
                .map(e => (
                  <option key={e.id} value={e.id}>{e.class} · {e.name} · Term {e.term} {e.year}</option>
                ))}
            </select>
          </FormGroup>
          {selExam && (() => {
            const exam = exams.find(e => e.id === Number(selExam));
            if (!exam) return null;
            const count = (data.students||[]).filter(s =>
              exam.results[s.name] && s.parentPhone && (selClass === 'ALL' || s.class === selClass)
            ).length;
            return (
              <div style={{ padding: 12, background: '#10b98115', borderRadius: 8, border: '1px solid #10b98130', fontSize: 13, color: '#10b981', marginBottom: 12 }}>
                ✅ {count} students have results + parent phone numbers
              </div>
            );
          })()}
          <Btn onClick={sendResults} disabled={sending || !selExam} style={{ background: '#7c3aed' }}>
            {sending ? '⏳ Sending...' : '📤 Send Results to All Parents'}
          </Btn>
        </Card>
      )}

      {tab === 'logs' && (
        <Card noPad>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>No messages sent yet.</div>
          ) : logs.map(log => (
            <div key={log.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                  {log.type === 'results' ? `📊 Results: ${log.examName}` : '📢 Broadcast'}
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Tag color={log.delivered ? 'green' : 'yellow'}>{log.delivered ? 'Delivered' : 'Manual'}</Tag>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(log.date).toLocaleString()}</span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {log.recipientCount} parents · {log.class} · By: {log.sentBy}
                {log.failedCount > 0 && (
                  <span style={{ color: '#ef4444', fontWeight: 700 }}> · {log.failedCount} FAILED</span>
                )}
              </div>
              {log.message && (
                <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4, fontStyle: 'italic' }}>
                  {log.message.substring(0, 100)}...
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {tab === 'config' && isPrincipal && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>SMS Gateway Configuration</div>
          <Alert type="info">
            Recommended: <strong>Africa's Talking</strong> — works best in Kenya. Sign up at africastalking.com.
            For testing, use "sandbox" as username.
          </Alert>
          <FormGroup label="SMS Provider" style={{ marginTop: 12 }}>
            <select value={smsConf.provider} onChange={e => setSmsConf({ ...smsConf, provider: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}>
              <option value="africastalking">Africa's Talking (Recommended)</option>
              <option value="manual">Manual / Print List (No API)</option>
            </select>
          </FormGroup>
          {smsConf.provider === 'africastalking' && (
            <>
              <FormGroup label="Username">
                <input value={smsConf.username || ''} onChange={e => setSmsConf({ ...smsConf, username: e.target.value })}
                  placeholder="your_username or sandbox"
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
              </FormGroup>
              <FormGroup label="API Key">
                <input value={smsConf.apiKey || ''} onChange={e => setSmsConf({ ...smsConf, apiKey: e.target.value })}
                  placeholder="Your Africa's Talking API Key"
                  type="password"
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
              </FormGroup>
              <FormGroup label="Sender ID (max 11 chars)">
                <input value={smsConf.senderId || ''} onChange={e => setSmsConf({ ...smsConf, senderId: e.target.value.slice(0,11) })}
                  placeholder="SchoolName"
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
              </FormGroup>
            </>
          )}
          <Btn onClick={saveSmsConfig}>Save SMS Config</Btn>

          {smsConf.provider === 'africastalking' && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                🧪 Send Test SMS
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Sends one real SMS using the settings above, so you can confirm Sender ID "{smsConf.senderId || '(default)'}"
                is approved and actually delivering before messaging real parents.
              </div>
              <FormGroup label="Your phone number (to receive the test)">
                <input value={testPhone} onChange={e => setTestPhone(e.target.value)}
                  placeholder="07XXXXXXXX or +2547XXXXXXXX"
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
              </FormGroup>
              <Btn onClick={sendTestSMS} disabled={testSending} style={{ background: '#0891b2' }}>
                {testSending ? '⏳ Sending test...' : '📤 Send Test SMS'}
              </Btn>
              {testResult && (
                <Alert type={testResult.ok ? 'success' : 'warning'} style={{ marginTop: 12 }}>
                  {testResult.ok ? '✅ ' : '⚠ '}{testResult.detail}
                </Alert>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

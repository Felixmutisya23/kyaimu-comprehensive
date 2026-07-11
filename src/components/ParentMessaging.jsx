import React, { useState } from 'react';
import { Card, Btn, FormGroup, SectionTitle, Alert, Tag, Icon } from './UI';
import { getAllClasses, getGrade, getScore } from '../data/initialData';

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
      const recipients = json?.SMSMessageData?.Recipients || [];
      const failed = recipients.filter(r => r.status !== 'Success');
      if (recipients.length > 0 && failed.length === recipients.length) {
        return { ok: false, error: failed[0]?.status || 'All recipients rejected', json };
      }
      return { ok: true, json, failedNumbers: failed.map(r => r.number) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  return { ok: false, error: 'SMS provider not configured' };
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

  const logs = data.parentMessages || [];

  // Gather phones for selected class
  function getTargetStudents() {
    const students = data.students || [];
    if (selClass === 'ALL') return students.filter(s => s.parentPhone);
    return students.filter(s => s.class === selClass && s.parentPhone);
  }

  const targets = getTargetStudents();
  const uniquePhones = [...new Set(targets.map(s => s.parentPhone).filter(Boolean))];

  function buildResultMessage(student, exam) {
    if (!exam) return '';
    const res     = exam.results[student.name] || {};
    const subjects = Object.keys(res);
    if (!subjects.length) return '';
    const scores  = subjects.map(sub => {
      const sc = getScore(res[sub]);
      const gr = sc !== null ? getGrade(sc) : null;
      return `${sub}: ${sc ?? '-'}${gr ? ' (' + gr.label + ')' : ''}`;
    });
    const total   = subjects.reduce((a, k) => a + (getScore(res[k]) ?? 0), 0);
    const mean    = subjects.length ? Math.round(total / subjects.length) : 0;
    const grade   = getGrade(mean);
    return `${data.schoolName || 'School'}\n${exam.name} Results\nStudent: ${student.name}\nAdm: ${student.admNo}\n${scores.join(', ')}\nMean: ${mean} (${grade.label})\nRegards, School Administration`;
  }

  async function broadcastMessage() {
    if (!message.trim()) { alert('Please type a message first'); return; }
    if (uniquePhones.length === 0) { alert('No parent phone numbers found for the selected class. Add phone numbers in Student records.'); return; }
    if (!window.confirm(`Send message to ${uniquePhones.length} parent(s)?`)) return;
    setSend(true);
    const conf = getSMSGatewayConfig(data);

    if (conf.provider === 'manual') {
      const log = {
        id: Date.now(), date: new Date().toISOString(), type: 'broadcast',
        message, class: selClass, recipientCount: uniquePhones.length,
        sentBy: user.name, delivered: false,
      };
      setData(d => ({ ...d, parentMessages: [log, ...(d.parentMessages || [])] }));
      setSend(false); setMsg('');
      printManualSMS(targets, message, data);
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

    const result = await sendSMSViaSenderId(uniquePhones.map(p => `+254${p.replace(/^0/, '')}`), message, conf);
    const log = {
      id: Date.now(), date: new Date().toISOString(), type: 'broadcast',
      message, class: selClass, recipientCount: uniquePhones.length,
      sentBy: user.name, delivered: result.ok,
    };
    setData(d => ({ ...d, parentMessages: [log, ...(d.parentMessages || [])] }));
    setSend(false); setMsg('');
    if (!result.ok) {
      alert(`⚠ SMS failed to send: ${result.error}\n\nNo messages were delivered. Check your Africa's Talking dashboard (wallet balance, API key, Sender ID status) and try again.`);
    } else {
      alert(`✅ Message sent to ${uniquePhones.length} parent(s)! (Confirmed by Africa's Talking's response — check their Outbox to verify final delivery.)`);
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
    for (const student of students) {
      const msg = buildResultMessage(student, exam);
      if (!msg) continue;
      if (conf.provider === 'manual') {
        sentCount++; // manual/print mode — no delivery to verify
      } else {
        const phone = `+254${student.parentPhone.replace(/^0/, '')}`;
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
    const rows = students.map(s => {
      const msg = buildResultMessage(s, exam);
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
        {[['broadcast','📢 Broadcast Message'],['results','📊 Send Results'],['logs','📋 Message Logs'],['config','⚙ SMS Setup']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === t ? '#4f8ef7' : 'var(--surface2)', color: tab === t ? '#fff' : 'var(--text-sub)', fontWeight: 600, fontSize: 13,
          }}>{l}</button>
        ))}
      </div>

      {tab === 'broadcast' && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
            Send Message to All Parents
          </div>
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
          <FormGroup label="Message">
            <textarea value={message} onChange={e => setMsg(e.target.value)} rows={5}
              placeholder={`Dear Parent/Guardian,\n\n[Your message here]\n\nRegards,\n${data.schoolName || 'School'} Administration`}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
          </FormGroup>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn onClick={broadcastMessage} disabled={sending || !message.trim()} style={{ background: '#10b981' }}>
              {sending ? '⏳ Sending...' : `📤 Send to ${uniquePhones.length} Parent(s)`}
            </Btn>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{message.length} characters</span>
          </div>
          {!getSMSGatewayConfig(data).apiKey && (
            <Alert type="warning" style={{ marginTop: 12 }}>
              ⚠ SMS gateway not configured. Click "SMS Setup" to add your API key. Until then, a printable list will open instead.
            </Alert>
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
          <FormGroup label="Select Exam" style={{ marginTop: 12 }}>
            <select value={selExam} onChange={e => setExam(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}>
              <option value="">-- Select Exam --</option>
              {exams.map(e => (
                <option key={e.id} value={e.id}>{e.name} · {e.class} · Term {e.term} {e.year}</option>
              ))}
            </select>
          </FormGroup>
          <FormGroup label="Filter by Class">
            <select value={selClass} onChange={e => setSel(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}>
              <option value="ALL">All Classes</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
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

      {tab === 'config' && (
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
        </Card>
      )}
    </div>
  );
}

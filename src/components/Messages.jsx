import React, { useState } from 'react';
import { Card, Modal, Btn, Tag, FormGroup, SectionTitle, Alert, Avatar, Icon } from './UI';

export default function Messages({ data, setData, role }) {
  const [show, setShow]       = useState(false);
  const [selected, setSelected] = useState(null);
  const [reply, setReply]     = useState('');
  const [form, setForm]       = useState({ to: 'Academics', subject: '', body: '' });

  const isPrincipal = role === 'principal';
  const myDept      = data.teachers.find(t => !t.admin && role !== 'principal')?.dept || 'Academics';
  const visible     = isPrincipal ? data.messages : data.messages.filter(m => m.dept === myDept);

  function send() {
    const nm = {
      id: Date.now(), from: data.principalName || 'Principal',
      to: form.to, dept: form.to, subject: form.subject, body: form.body,
      date: new Date().toISOString().split('T')[0], read: false, replies: [],
    };
    setData(d => ({ ...d, messages: [nm, ...d.messages] }));
    setShow(false); setForm({ to: 'Academics', subject: '', body: '' });
  }

  function sendReply() {
    if (!reply.trim() || !selected) return;
    setData(d => ({ ...d, messages: d.messages.map(m => m.id === selected.id ? { ...m, replies: [...m.replies, reply], read: true } : m) }));
    setSelected(prev => ({ ...prev, replies: [...prev.replies, reply] }));
    setReply('');
  }

  function open(m) {
    setData(d => ({ ...d, messages: d.messages.map(x => x.id === m.id ? { ...x, read: true } : x) }));
    setSelected(m);
  }

  function deleteMsg(id) {
    if (window.confirm('Delete this message?')) {
      setData(d => ({ ...d, messages: d.messages.filter(m => m.id !== id) }));
      if (selected?.id === id) setSelected(null);
    }
  }

  /* ── Detail View ─────────────────────────────────── */
  if (selected) {
    const msg = data.messages.find(m => m.id === selected.id) || selected;
    return (
      <div>
        <Btn variant="ghost" size="sm" onClick={() => setSelected(null)} style={{ marginBottom: 16 }}>
          <Icon name="back" size={14} /> Back to Messages
        </Btn>
        <Card>
          <div style={{ borderBottom: '1px solid #2a3350', paddingBottom: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{msg.subject}</div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b', flexWrap: 'wrap' }}>
              <span>From: <strong style={{ color: '#94a3b8' }}>{msg.from}</strong></span>
              <span>To: <Tag color="blue">{msg.to} Dept</Tag></span>
              <span>{msg.date}</span>
            </div>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: '#e2e8f0', whiteSpace: 'pre-wrap', marginBottom: 20 }}>
            {msg.body}
          </div>
          {msg.replies.length > 0 && (
            <div style={{ borderTop: '1px solid #2a3350', paddingTop: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 10 }}>
                Replies ({msg.replies.length})
              </div>
              {msg.replies.map((r, i) => (
                <div key={i} style={{ background: '#1e2435', borderRadius: 8, padding: '10px 14px', marginBottom: 8, fontSize: 13, borderLeft: '3px solid #4f8ef7' }}>
                  {r}
                </div>
              ))}
            </div>
          )}
          {!isPrincipal && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a reply..." style={{ flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && sendReply()} />
              <Btn onClick={sendReply} disabled={!reply.trim()}>Send Reply</Btn>
            </div>
          )}
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <Btn size="sm" variant="danger" onClick={() => deleteMsg(msg.id)}><Icon name="trash" size={13} /> Delete</Btn>
          </div>
        </Card>
      </div>
    );
  }

  /* ── Inbox ────────────────────────────────────────── */
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: '#64748b' }}>
          {isPrincipal
            ? 'Send messages to any department. Each department only sees their own messages.'
            : `Showing messages for your department: ${myDept}`}
        </div>
        {isPrincipal && (
          <Btn onClick={() => setShow(true)}><Icon name="add" size={14} /> Compose Message</Btn>
        )}
      </div>

      {/* Unread count */}
      {visible.filter(m => !m.read).length > 0 && (
        <Alert type="info">
          <Icon name="messages" size={14} />
          You have <strong>{visible.filter(m => !m.read).length} unread message(s)</strong>.
        </Alert>
      )}

      <Card noPad>
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>No messages yet.</div>
        ) : visible.map(m => (
          <div key={m.id} onClick={() => open(m)} style={{
            padding: '14px 18px', borderBottom: '1px solid #2a3350', cursor: 'pointer',
            transition: 'background 0.1s', borderLeft: m.read ? '3px solid transparent' : '3px solid #4f8ef7',
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#1e2435'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
              <span style={{ fontWeight: m.read ? 400 : 700, fontSize: 14 }}>{m.subject}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {!m.read && <Tag color="blue">New</Tag>}
                <span style={{ fontSize: 11, color: '#64748b' }}>{m.date}</span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
              <span>From: {m.from}</span>
              <span>To: {m.to} Department</span>
              {m.replies.length > 0 && <Tag color="green">{m.replies.length} repl{m.replies.length > 1 ? 'ies' : 'y'}</Tag>}
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.body.substring(0, 120)}...
            </p>
          </div>
        ))}
      </Card>

      {/* Compose Modal */}
      <Modal show={show} onClose={() => setShow(false)} title="Compose Message">
        <FormGroup label="Send To Department">
          <select value={form.to} onChange={e => setForm({ ...form, to: e.target.value })}>
            {data.departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </FormGroup>
        <Alert type="info" style={{ fontSize: 12 }}>
          <Icon name="alert" size={13} />
          Only the selected department will see this message.
        </Alert>
        <FormGroup label="Subject">
          <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Message subject" />
        </FormGroup>
        <FormGroup label="Message">
          <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={6} placeholder="Type your message here..." />
        </FormGroup>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShow(false)}>Cancel</Btn>
          <Btn onClick={send} disabled={!form.subject || !form.body}>Send Message</Btn>
        </div>
      </Modal>
    </div>
  );
}

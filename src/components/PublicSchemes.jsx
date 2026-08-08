import React from 'react';
import SchemesMarketplace from './SchemesMarketplace';

/* ═══════════════════════════════════════════════════════════════════
   PUBLIC SCHEMES OF WORK MARKETPLACE — reachable at ?action=schemes
   ─────────────────────────────────────────────────────────────────
   No login required — any teacher, whether or not their school uses
   EduManage Pro, can browse, preview (2 pages), and buy a scheme of
   work for KES 70 via M-Pesa.
═══════════════════════════════════════════════════════════════════ */
export default function PublicSchemes({ onBack }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '24px 16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto 20px' }}>
        {onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#4f8ef7', cursor: 'pointer', fontSize: 14, marginBottom: 12 }}>
            ← Back
          </button>
        )}
        <h1 style={{ margin: '0 0 4px' }}>📘 Schemes of Work Marketplace</h1>
        <p style={{ color: '#64748b', margin: 0 }}>
          Ready-made CBC schemes of work — preview 2 pages free, unlock the full document for KES 70 per subject via M-Pesa.
        </p>
      </div>
      <SchemesMarketplace mode="public" />
    </div>
  );
}

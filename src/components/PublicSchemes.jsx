import React, { useEffect, useState } from 'react';
import SchemesMarketplace from './SchemesMarketplace';
import { listActiveSchemes } from '../supabase';

/* ═══════════════════════════════════════════════════════════════════
   PUBLIC SCHEMES OF WORK MARKETPLACE — reachable at ?action=schemes
   ─────────────────────────────────────────────────────────────────
   No login required — any teacher, whether or not their school uses
   EduManage Pro, can browse, preview a few pages, and buy a scheme of
   work via M-Pesa.
═══════════════════════════════════════════════════════════════════ */
export default function PublicSchemes({ onBack }) {
  // Price shown here used to be a hardcoded "KES 70" that silently went
  // stale the moment prices changed (as they did — down to KES 20). Now
  // it reads the real current minimum public price from the catalog.
  const [fromPrice, setFromPrice] = useState(null);
  useEffect(() => {
    listActiveSchemes()
      .then(schemes => {
        const prices = schemes.map(s => Number(s.price_public)).filter(p => !isNaN(p) && p > 0);
        if (prices.length) setFromPrice(Math.min(...prices));
      })
      .catch(() => {}); // if this fails, just fall back to the generic wording below
  }, []);

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
          Ready-made CBC schemes of work — preview a few pages free, unlock the full document
          {fromPrice != null ? ` from KES ${fromPrice} per subject via M-Pesa.` : ' via M-Pesa.'}
        </p>
      </div>
      <SchemesMarketplace mode="public" />
    </div>
  );
}

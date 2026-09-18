// utils.js
export const $ = selector => {
  const el = document.querySelector(selector);
  if (el) return el;
  return document.getElementById(selector.replace('#', ''));
};

export const escapeHTML = value => 
  String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

export const clean = s => String(s || '').trim().replace(/\s+/g, ' ');

export const validId = s => /^S\d{6}$/.test(String(s || '').trim().toUpperCase());

export const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

export const formatDate = v => { 
  try { return v?.toDate().toLocaleString() || '—'; } 
  catch { return '—'; } 
};

export const clone = value => JSON.parse(JSON.stringify(value));
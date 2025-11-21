// Lightweight deep-analysis sharing utility.
// - Persists deep-analysis JSON per reportId to localStorage
// - Emits a CustomEvent 'aita:deepAnalysisUpdated' on updates
// - Provides load/save/subscribe helpers for other pages

const STORAGE_PREFIX = 'aita_deep_analysis:';

export function saveDeepAnalysis(reportId, data) {
  if (!reportId || !data) return;
  try {
    const payload = { savedAt: Date.now(), data };
    localStorage.setItem(STORAGE_PREFIX + reportId, JSON.stringify(payload));
    try {
      window.dispatchEvent(new CustomEvent('aita:deepAnalysisUpdated', { detail: { reportId, data } }));
    } catch (e) {
      // Some environments may restrict CustomEvent construction, but localStorage still works
      console.warn('dispatch event failed', e);
    }
  } catch (e) {
    console.warn('saveDeepAnalysis failed', e);
  }
}

export function loadDeepAnalysis(reportId) {
  if (!reportId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + reportId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data ?? null;
  } catch (e) {
    console.warn('loadDeepAnalysis failed', e);
    return null;
  }
}

// Subscribe to updates for a specific reportId. Returns an unsubscribe function.
export function subscribeDeepAnalysis(reportId, callback) {
  if (typeof callback !== 'function') return () => {};
  const handler = (e) => {
    try {
      if (!reportId || e?.detail?.reportId === reportId) {
        callback(e.detail.data);
      }
    } catch (err) { /* ignore */ }
  };
  window.addEventListener('aita:deepAnalysisUpdated', handler);
  return () => window.removeEventListener('aita:deepAnalysisUpdated', handler);
}

export function clearDeepAnalysis(reportId) {
  if (!reportId) return;
  try { localStorage.removeItem(STORAGE_PREFIX + reportId); } catch (e) { console.warn(e); }
}

export default {
  saveDeepAnalysis,
  loadDeepAnalysis,
  subscribeDeepAnalysis,
  clearDeepAnalysis
};

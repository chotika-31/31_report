const demoCode = '';
const reportStore = (() => {
  let pending;

  async function call(method, ...args) {
    const url = new URL(window.BBU_APPS_SCRIPT_URL);
    if (url.origin !== 'https://script.google.com' || !/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname)) {
      throw new Error('Invalid Apps Script URL');
    }
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ method, args }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('Apps Script request failed');
    const result = await response.json();
    if (!result.ok) throw new Error('Apps Script request failed');
    return result.value;
  }

  return {
    async submit(report) {
      const key = JSON.stringify(report);
      if (pending?.key !== key) {
        const bytes = crypto.getRandomValues(new Uint8Array(12));
        const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
        pending = { key, code: `BBU-${hex.slice(0, 8)}-${hex.slice(8, 16)}-${hex.slice(16)}` };
      }
      const code = await call('submitReport', report, pending.code);
      pending = undefined;
      return code;
    },
    lookup: (code) => call('lookupStatus', code),
    signIn: (pin) => call('staffLogin', pin),
    update: (token, code, change) => call('staffUpdate', token, code, change),
  };
})();

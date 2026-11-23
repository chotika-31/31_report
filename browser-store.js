const demoCode = '';
const reportStore = (() => {
  const channel = 'bbu-sheets-v1';
  const calls = new Map();
  let pending;
  let frame;
  let endpoint;
  let connected;

  if (!window.BBU_APPS_SCRIPT_URL) {
    document.getElementById('storage-note').textContent = 'เว็บทดลองยังไม่ได้เชื่อมฐานข้อมูลกลาง';
  }

  function connect() {
    if (connected) return connected;
    connected = new Promise((resolve, reject) => {
      const url = new URL(window.BBU_APPS_SCRIPT_URL);
      if (url.origin !== 'https://script.google.com' || !/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname)) {
        throw new Error('Invalid Apps Script URL');
      }
      frame = document.createElement('iframe');
      frame.hidden = true;
      frame.title = 'การเชื่อมต่อฐานข้อมูล BBU';
      const timer = setTimeout(() => {
        window.removeEventListener('message', hello);
        frame.remove();
        reject(new Error('Apps Script did not respond'));
      }, 12000);

      function hello(event) {
        if (!/^https:\/\/(?:[a-z0-9-]+\.)?script\.googleusercontent\.com$/.test(event.origin) &&
            !/^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(event.origin) &&
            event.origin !== 'https://script.google.com') return;
        if (!event.source || (event.source !== frame.contentWindow && event.source.parent !== frame.contentWindow)) return;
        if (event.data?.channel !== channel || event.data.type !== 'ready') return;
        endpoint = { window: event.source, origin: event.origin };
        clearTimeout(timer);
        window.removeEventListener('message', hello);
        resolve();
      }

      window.addEventListener('message', hello);
      frame.src = url.href;
      document.body.append(frame);
    }).catch((error) => {
      connected = undefined;
      throw error;
    });
    return connected;
  }

  window.addEventListener('message', (event) => {
    if (!endpoint || event.source !== endpoint.window || event.origin !== endpoint.origin) return;
    const result = event.data;
    if (result?.channel !== channel || result.type !== 'response') return;
    const request = calls.get(result.id);
    if (!request) return;
    calls.delete(result.id);
    clearTimeout(request.timer);
    if (result.ok) request.resolve(result.value);
    else request.reject(new Error('Apps Script request failed'));
  });

  async function call(method, ...args) {
    await connect();
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        calls.delete(id);
        if (!calls.size) {
          frame.remove();
          endpoint = undefined;
          connected = undefined;
        }
        reject(new Error('Apps Script request timed out'));
      }, 20000);
      calls.set(id, { resolve, reject, timer });
      endpoint.window.postMessage({ channel, type: 'request', id, method, args }, endpoint.origin);
    });
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

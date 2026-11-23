const byId = (id) => document.getElementById(id);

const views = [...document.querySelectorAll('.view')];
const navLinks = [...document.querySelectorAll('nav a')];
const staffAccessForm = byId('staff-access-form');
const staffPassword = byId('staff-password');
let receiptCode = '';
let selectedReport = '';
let staffSession;
let trackRequest = 0;

function lockInbox() {
  staffSession = undefined;
  selectedReport = '';
  byId('staff-gate').hidden = false;
  byId('inbox').hidden = true;
  byId('staff').setAttribute('aria-labelledby', 'staff-title');
  byId('report-list').replaceChildren();
  for (const id of ['staff-code', 'staff-category', 'staff-description', 'staff-place', 'staff-when', 'staff-feedback']) {
    byId(id).textContent = '';
  }
  staffAccessForm.reset();
  clearStaffAccessError();
}

function showView(focus = false) {
  const hash = location.hash.slice(1);
  // Leave the active view in place when using the skip link.
  if (hash === 'content') return;
  const match = views.find((view) => view.id === hash);
  const active = match && (hash !== 'received' || receiptCode) ? match : byId('report');
  for (const view of views) view.hidden = view !== active;
  for (const link of navLinks) {
    const current = link.hash === `#${active.id}` || (active.id === 'received' && link.hash === '#report');
    if (current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (active.id !== 'staff') lockInbox();
  if (focus) {
    byId(active.getAttribute('aria-labelledby')).focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function showError(id, message) {
  const element = byId(id);
  element.textContent = message;
  element.hidden = !message;
}

const details = byId('details');
details.addEventListener('input', () => {
  byId('count').textContent = `${details.value.length.toLocaleString('en')} / 1,000`;
  details.removeAttribute('aria-invalid');
  byId('details-error').hidden = true;
});

byId('report-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type=submit]');
  if (button.disabled) return;
  showError('report-error', '');
  const fields = new FormData(form);
  const text = details.value.trim();
  if (!text) {
    details.setAttribute('aria-invalid', 'true');
    byId('details-error').hidden = false;
    details.focus();
    return;
  }
  button.disabled = true;
  button.textContent = 'กำลังส่งเรื่อง…';
  try {
    receiptCode = await reportStore.submit({
      category: fields.get('category'),
      details: text,
      place: fields.get('place').trim(),
      when: fields.get('when').trim(),
    });
  } catch {
    showError('report-error', 'บันทึกไม่ได้ กรุณาลองส่งอีกครั้ง');
    return;
  } finally {
    button.disabled = false;
    button.textContent = 'ส่งเรื่องนิรนาม';
  }
  byId('receipt-code').value = receiptCode;
  byId('copy-status').textContent = '';
  form.reset();
  details.dispatchEvent(new Event('input'));
  location.hash = 'received';
});

byId('copy-code').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(receiptCode);
    byId('copy-status').textContent = 'คัดลอกรหัสแล้ว';
  } catch {
    byId('receipt-code').focus();
    byId('receipt-code').select();
    byId('copy-status').textContent = 'เลือกรหัสให้แล้ว ใช้คำสั่งคัดลอกของอุปกรณ์ได้เลย';
  }
});

const trackingCode = byId('tracking-code');
const trackResult = byId('track-result');
async function trackReport() {
  const code = trackingCode.value.trim().toUpperCase();
  const request = ++trackRequest;
  trackResult.removeAttribute('data-missing');
  trackResult.textContent = 'กำลังตรวจสอบสถานะ…';
  trackResult.hidden = false;
  try {
    const status = await reportStore.lookup(code);
    if (request !== trackRequest) return;
    trackResult.toggleAttribute('data-missing', !status);
    trackResult.textContent = status
      ? `สถานะล่าสุด · ${status}`
      : 'ไม่พบรหัสนี้ กรุณาตรวจสอบรหัสและลองอีกครั้ง';
  } catch {
    if (request !== trackRequest) return;
    trackResult.setAttribute('data-missing', '');
    trackResult.textContent = 'ตรวจสอบสถานะไม่ได้ กรุณาลองอีกครั้ง';
  }
}

byId('track-form').addEventListener('submit', (event) => {
  event.preventDefault();
  trackReport();
});
byId('try-code').addEventListener('click', () => {
  trackingCode.value = demoCode;
  trackReport();
});
byId('track-receipt').addEventListener('click', () => {
  trackingCode.value = receiptCode;
  trackReport();
});
trackingCode.addEventListener('input', () => {
  trackRequest++;
  trackResult.hidden = true;
});

function renderInbox() {
  const list = byId('report-list');
  list.replaceChildren();
  const reports = staffSession.reports;
  const filter = byId('status-filter').value;
  const visible = reports.filter((report) => !filter || report.status === filter);
  const selected = visible.find((report) => report.code === selectedReport);
  if (!visible.length) list.textContent = 'ไม่มีเรื่องในสถานะนี้';
  for (const report of visible) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'report-item';
    button.setAttribute('aria-pressed', String(report === selected));
    const title = document.createElement('strong');
    title.textContent = report.category;
    const status = document.createElement('span');
    status.textContent = `${report.code} · ${report.status}`;
    button.append(title, status);
    button.addEventListener('click', () => {
      selectedReport = report.code;
      byId('staff-feedback').textContent = '';
      renderInbox();
      byId('staff-category').focus();
    });
    list.append(button);
  }
  byId('staff-placeholder').hidden = Boolean(selected);
  byId('staff-report').hidden = !selected;
  if (!selected) return;
  byId('staff-code').textContent = selected.code;
  byId('staff-category').textContent = selected.category;
  byId('staff-description').textContent = selected.details;
  byId('staff-place').textContent = selected.place || 'ไม่ได้ระบุ';
  byId('staff-when').textContent = selected.when || 'ไม่ได้ระบุ';
  byId('assignee').value = selected.assignee;
  byId('staff-status').value = selected.status;
}

function clearStaffAccessError() {
  staffPassword.removeAttribute('aria-invalid');
  showError('staff-access-error', '');
}

staffPassword.addEventListener('input', clearStaffAccessError);
staffAccessForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = staffAccessForm.querySelector('button[type=submit]');
  if (button.disabled) return;
  const pin = staffPassword.value;
  button.disabled = true;
  let session;
  try {
    session = await reportStore.signIn(pin);
  } catch {
    session = { error: 'unavailable' };
  } finally {
    button.disabled = false;
  }
  if (byId('staff').hidden || staffPassword.value !== pin) return;
  if (session.error) {
    const messages = {
      invalid: 'รหัสเจ้าหน้าที่ไม่ถูกต้อง กรุณาลองอีกครั้ง',
      limited: 'ใส่รหัสผิดหลายครั้ง กรุณารอหนึ่งนาทีแล้วลองใหม่',
      unavailable: 'เปิดกล่องรับเรื่องไม่ได้ กรุณาลองอีกครั้ง',
    };
    if (session.error === 'invalid') staffPassword.setAttribute('aria-invalid', 'true');
    showError('staff-access-error', messages[session.error]);
    staffPassword.focus();
    staffPassword.select();
    return;
  }
  staffSession = session;
  staffAccessForm.reset();
  clearStaffAccessError();
  byId('staff-gate').hidden = true;
  byId('inbox').hidden = false;
  byId('staff').setAttribute('aria-labelledby', 'inbox-title');
  renderInbox();
  byId('inbox-title').focus();
});
byId('status-filter').addEventListener('change', () => {
  byId('staff-feedback').textContent = '';
  renderInbox();
});

byId('staff-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!staffSession) return;
  const button = event.currentTarget.querySelector('button[type=submit]');
  if (button.disabled) return;
  const session = staffSession;
  const code = selectedReport;
  const change = { status: byId('staff-status').value, assignee: byId('assignee').value };
  const feedback = byId('staff-feedback');
  button.disabled = true;
  try {
    const result = await reportStore.update(session.token, code, change);
    if (session !== staffSession) return;
    if (result.error === 'expired') {
      lockInbox();
      showError('staff-access-error', 'หมดเวลาเข้าใช้งาน กรุณาใส่รหัสอีกครั้ง');
      staffPassword.focus();
      return;
    }
    if (result.error === 'missing') {
      session.reports = session.reports.filter((item) => item.code !== code);
      renderInbox();
      feedback.textContent = 'ไม่พบเรื่องนี้แล้ว';
      return;
    }
    if (!result.ok) throw new Error('Update failed');
    Object.assign(session.reports.find((item) => item.code === code), change);
    feedback.textContent = 'บันทึกการเปลี่ยนแปลงแล้ว';
    renderInbox();
    if (byId('staff-report').hidden) byId('status-filter').focus();
    trackResult.hidden = true;
  } catch {
    if (session === staffSession) feedback.textContent = 'บันทึกไม่ได้ กรุณาลองอีกครั้ง';
  } finally {
    button.disabled = false;
  }
});

window.addEventListener('hashchange', () => showView(true));
showView();

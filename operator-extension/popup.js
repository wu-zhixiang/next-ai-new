const DEFAULT_SETTINGS = {
  apiBaseUrl: '',
  operatorToken: '',
  chatgptUrl: 'https://chatgpt.com/'
};

const els = {
  setupNotice: document.querySelector('#setupNotice'),
  openOptionsBtn: document.querySelector('#openOptionsBtn'),
  refreshBtn: document.querySelector('#refreshBtn'),
  loadBtn: document.querySelector('#loadBtn'),
  openChatgptBtn: document.querySelector('#openChatgptBtn'),
  taskList: document.querySelector('#taskList'),
  taskTemplate: document.querySelector('#taskTemplate'),
  emptyState: document.querySelector('#emptyState'),
  summary: document.querySelector('#summary'),
  taskCount: document.querySelector('#taskCount'),
  confirmDialog: document.querySelector('#confirmDialog'),
  confirmOrderNo: document.querySelector('#confirmOrderNo'),
  cancelFulfillBtn: document.querySelector('#cancelFulfillBtn'),
  confirmFulfillBtn: document.querySelector('#confirmFulfillBtn'),
  toast: document.querySelector('#toast')
};

let settings = { ...DEFAULT_SETTINGS };
let pendingFulfill = null;
let toastTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  settings = await getSettings();
  updateSetupNotice();
  bindActions();
  if (isConfigured()) {
    await loadTasks();
  }
});

function bindActions() {
  els.openOptionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  els.refreshBtn.addEventListener('click', loadTasks);
  els.loadBtn.addEventListener('click', loadTasks);
  els.openChatgptBtn.addEventListener('click', () => openTab(settings.chatgptUrl || DEFAULT_SETTINGS.chatgptUrl));
  els.cancelFulfillBtn.addEventListener('click', closeFulfillConfirm);
  els.confirmDialog.addEventListener('click', (event) => {
    if (event.target === els.confirmDialog) {
      closeFulfillConfirm();
    }
  });
  els.confirmFulfillBtn.addEventListener('click', confirmFulfillTask);
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['operatorSettings'], (result) => {
      resolve({ ...DEFAULT_SETTINGS, ...(result.operatorSettings || {}) });
    });
  });
}

function isConfigured() {
  return Boolean(settings.apiBaseUrl && settings.operatorToken);
}

function updateSetupNotice() {
  els.setupNotice.classList.toggle('hidden', isConfigured());
}

async function loadTasks() {
  settings = await getSettings();
  updateSetupNotice();
  if (!isConfigured()) return;

  setLoading(true);
  try {
    const data = await apiRequest('/operator/tasks?status=opening', { method: 'GET' });
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    renderTasks(tasks);
  } catch (error) {
    showError(error);
  } finally {
    setLoading(false);
  }
}

function renderTasks(tasks) {
  els.taskList.innerHTML = '';
  els.taskCount.textContent = String(tasks.length);
  els.summary.classList.toggle('hidden', tasks.length === 0);
  els.emptyState.classList.toggle('hidden', tasks.length > 0);

  tasks.forEach((task) => {
    const node = els.taskTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.orderNo = task.orderNo || '';
    node.querySelector('.task-card__product').textContent = task.productName || 'Open AI 资讯会员';
    node.querySelector('.task-card__plan').textContent = task.planName || '会员套餐';
    node.querySelector('.task-card__amount').textContent = formatMoney(task.amount);
    node.querySelector('.task-card__order').textContent = task.orderNo || '-';
    node.querySelector('.task-card__paid-at').textContent = formatTime(task.paidAt);
    node.querySelector('.task-card__email').value = task.email || '';
    node.querySelector('.task-card__password').value = task.password || '';

    node.querySelector('.copy-email').addEventListener('click', () => copyText(task.email || '', '账号已复制'));
    node.querySelector('.copy-password').addEventListener('click', () => copyText(task.password || '', '密码已复制'));
    node.querySelector('.fetch-code').addEventListener('click', (event) => fetchVerificationCode(task.orderNo, node, event.currentTarget));
    node.querySelector('.open-site').addEventListener('click', () => openTab(settings.chatgptUrl || DEFAULT_SETTINGS.chatgptUrl));
    node.querySelector('.mark-processing').addEventListener('click', () => updateTask(task.orderNo, 'processing', node));
    node.querySelector('.mark-done').addEventListener('click', () => openFulfillConfirm(task.orderNo, node));

    els.taskList.appendChild(node);
  });
}

async function fetchVerificationCode(orderNo, node, button) {
  if (!orderNo) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = '获取中';
  try {
    const result = await apiRequest(`/operator/tasks/${encodeURIComponent(orderNo)}/verification-code`, { method: 'GET' });
    const code = result.code || '';
    node.querySelector('.task-card__code').value = code;
    await copyText(code, '验证码已复制');
  } catch (error) {
    showError(error);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function openFulfillConfirm(orderNo, node) {
  if (!orderNo) return;
  pendingFulfill = { orderNo, node };
  els.confirmOrderNo.textContent = orderNo;
  els.confirmDialog.classList.remove('hidden');
}

function closeFulfillConfirm() {
  pendingFulfill = null;
  els.confirmDialog.classList.add('hidden');
  els.confirmFulfillBtn.disabled = false;
  els.confirmFulfillBtn.textContent = '确认已开通';
}

async function confirmFulfillTask() {
  if (!pendingFulfill) return;
  const { orderNo, node } = pendingFulfill;
  els.confirmFulfillBtn.disabled = true;
  els.confirmFulfillBtn.textContent = '提交中';
  await updateTask(orderNo, 'fulfilled', node);
  closeFulfillConfirm();
}

async function updateTask(orderNo, status, node) {
  if (!orderNo) return;
  const note = node.querySelector('.task-card__note').value.trim();
  try {
    await apiRequest(`/operator/tasks/${encodeURIComponent(orderNo)}`, {
      method: 'POST',
      body: JSON.stringify({ status, note })
    });
    if (status === 'fulfilled') {
      node.remove();
      const count = Math.max(0, Number(els.taskCount.textContent || '0') - 1);
      els.taskCount.textContent = String(count);
      els.summary.classList.toggle('hidden', count === 0);
      els.emptyState.classList.toggle('hidden', count > 0);
      return;
    }
    node.classList.add('is-processing');
  } catch (error) {
    showError(error);
    throw error;
  }
}

async function apiRequest(path, options = {}) {
  const base = settings.apiBaseUrl.replace(/\/$/, '');
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${settings.operatorToken}`,
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.code && payload.code !== 0) {
    throw new Error(payload.message || `请求失败：${response.status}`);
  }
  return payload.data || payload;
}

async function copyText(text, message = '复制成功') {
  if (!text) return;
  await navigator.clipboard.writeText(text);
  showToast(message);
}

function openTab(url) {
  chrome.tabs.create({ url });
}

function setLoading(loading) {
  els.loadBtn.disabled = loading;
  els.refreshBtn.disabled = loading;
  els.loadBtn.textContent = loading ? '加载中' : '加载任务';
}

function showError(error) {
  const message = error instanceof Error ? error.message : '操作失败';
  els.emptyState.classList.remove('hidden');
  els.emptyState.querySelector('p').textContent = message;
  els.emptyState.querySelector('span').textContent = '请检查配置或稍后重试。';
  showToast(message);
}

function showToast(message) {
  if (!message) return;
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  toastTimer = setTimeout(() => {
    els.toast.classList.add('hidden');
  }, 1600);
}

function formatMoney(value) {
  return typeof value === 'number' ? `¥${value.toFixed(2)}` : '¥--';
}

function formatTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

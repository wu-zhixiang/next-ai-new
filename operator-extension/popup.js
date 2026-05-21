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
  taskCount: document.querySelector('#taskCount')
};

let settings = { ...DEFAULT_SETTINGS };

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

    node.querySelector('.copy-email').addEventListener('click', () => copyText(task.email || ''));
    node.querySelector('.copy-password').addEventListener('click', () => copyText(task.password || ''));
    node.querySelector('.open-site').addEventListener('click', () => openTab(settings.chatgptUrl || DEFAULT_SETTINGS.chatgptUrl));
    node.querySelector('.mark-processing').addEventListener('click', () => updateTask(task.orderNo, 'processing', node));
    node.querySelector('.mark-done').addEventListener('click', () => updateTask(task.orderNo, 'fulfilled', node));

    els.taskList.appendChild(node);
  });
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

async function copyText(text) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
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
}

function formatMoney(value) {
  return typeof value === 'number' ? `¥${value.toFixed(2)}` : '¥--';
}

function formatTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

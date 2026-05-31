const DEFAULT_SETTINGS = {
  apiBaseUrl: '',
  operatorToken: '',
  chatgptUrl: 'https://chatgpt.com/'
};
const MAX_COVER_DATA_URL_LENGTH = 2 * 1024 * 1024;
const NEWS_TAG_OPTIONS = ['OpenAI', 'Google AI', 'Claude AI', 'AI工具', '提示词', '模型更新', '产品发布', '开发实践'];

const els = {
  setupNotice: document.querySelector('#setupNotice'),
  openOptionsBtn: document.querySelector('#openOptionsBtn'),
  refreshBtn: document.querySelector('#refreshBtn'),
  loadBtn: document.querySelector('#loadBtn'),
  openChatgptBtn: document.querySelector('#openChatgptBtn'),
  ordersTabBtn: document.querySelector('#ordersTabBtn'),
  newsTabBtn: document.querySelector('#newsTabBtn'),
  ordersPanel: document.querySelector('#ordersPanel'),
  newsPanel: document.querySelector('#newsPanel'),
  fillCurrentTabBtn: document.querySelector('#fillCurrentTabBtn'),
  clearNewsFormBtn: document.querySelector('#clearNewsFormBtn'),
  submitNewsBtn: document.querySelector('#submitNewsBtn'),
  newsCoverDropzone: document.querySelector('#newsCoverDropzone'),
  newsCoverPreview: document.querySelector('#newsCoverPreview'),
  newsCoverStatus: document.querySelector('#newsCoverStatus'),
  newsCover: document.querySelector('#newsCover'),
  newsContentMarkdown: document.querySelector('#newsContentMarkdown'),
  newsSourceName: document.querySelector('#newsSourceName'),
  newsAuthorName: document.querySelector('#newsAuthorName'),
  newsTagsDropdown: document.querySelector('#newsTagsDropdown'),
  newsTagsTrigger: document.querySelector('#newsTagsTrigger'),
  newsTagsMenu: document.querySelector('#newsTagsMenu'),
  newsViewCount: document.querySelector('#newsViewCount'),
  newsLikeCount: document.querySelector('#newsLikeCount'),
  newsRepostCount: document.querySelector('#newsRepostCount'),
  newsCommentCount: document.querySelector('#newsCommentCount'),
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
let pastedCoverDataUrl = '';
let coverPreviewObjectUrl = '';
let selectedNewsTags = new Set();

document.addEventListener('DOMContentLoaded', async () => {
  settings = await getSettings();
  updateSetupNotice();
  bindActions();
  renderNewsTagsOptions();
  updateNewsTagsTrigger();
  if (isConfigured()) {
    await loadTasks();
  }
});

function bindActions() {
  els.openOptionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  els.refreshBtn.addEventListener('click', loadTasks);
  els.loadBtn.addEventListener('click', loadTasks);
  els.openChatgptBtn.addEventListener('click', () => openTab(settings.chatgptUrl || DEFAULT_SETTINGS.chatgptUrl));
  els.ordersTabBtn.addEventListener('click', () => switchPanel('orders'));
  els.newsTabBtn.addEventListener('click', () => switchPanel('news'));
  els.fillCurrentTabBtn.addEventListener('click', fillNewsFromCurrentTab);
  els.clearNewsFormBtn.addEventListener('click', clearNewsForm);
  els.submitNewsBtn.addEventListener('click', submitNews);
  els.newsTagsTrigger.addEventListener('click', toggleNewsTagsDropdown);
  document.addEventListener('click', handleOutsideClick);
  els.newsCoverDropzone.addEventListener('click', () => els.newsCover.click());
  els.newsCoverDropzone.addEventListener('paste', handleCoverPaste);
  els.newsCover.addEventListener('change', handleCoverFileChange);
  els.cancelFulfillBtn.addEventListener('click', closeFulfillConfirm);
  els.confirmDialog.addEventListener('click', (event) => {
    if (event.target === els.confirmDialog) {
      closeFulfillConfirm();
    }
  });
  els.confirmFulfillBtn.addEventListener('click', confirmFulfillTask);
}

function renderNewsTagsOptions() {
  els.newsTagsMenu.innerHTML = '';
  NEWS_TAG_OPTIONS.forEach((tag) => {
    const option = document.createElement('label');
    option.className = 'tags-dropdown__option';
    option.innerHTML = `
      <input type="checkbox" value="${tag}" />
      <span>${tag}</span>
    `;
    const checkbox = option.querySelector('input');
    checkbox.addEventListener('change', () => handleNewsTagToggle(tag, checkbox.checked));
    els.newsTagsMenu.appendChild(option);
  });
}

function handleNewsTagToggle(tag, checked) {
  if (checked) {
    selectedNewsTags.add(tag);
  } else {
    selectedNewsTags.delete(tag);
  }
  updateNewsTagsTrigger();
}

function updateNewsTagsTrigger() {
  if (!selectedNewsTags.size) {
    els.newsTagsTrigger.textContent = '请选择标签（可多选）';
    return;
  }
  els.newsTagsTrigger.textContent = Array.from(selectedNewsTags).join('、');
}

function toggleNewsTagsDropdown(event) {
  event.stopPropagation();
  const isOpen = !els.newsTagsMenu.classList.contains('hidden');
  if (isOpen) {
    closeNewsTagsDropdown();
    return;
  }
  els.newsTagsMenu.classList.remove('hidden');
  els.newsTagsTrigger.setAttribute('aria-expanded', 'true');
}

function closeNewsTagsDropdown() {
  els.newsTagsMenu.classList.add('hidden');
  els.newsTagsTrigger.setAttribute('aria-expanded', 'false');
}

function handleOutsideClick(event) {
  if (!els.newsTagsDropdown.contains(event.target)) {
    closeNewsTagsDropdown();
  }
}

function switchPanel(panel) {
  const isNews = panel === 'news';
  els.ordersPanel.classList.toggle('hidden', isNews);
  els.newsPanel.classList.toggle('hidden', !isNews);
  els.ordersTabBtn.classList.toggle('tab-button--active', !isNews);
  els.newsTabBtn.classList.toggle('tab-button--active', isNews);
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

async function fillNewsFromCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const host = safeHost(tab.url);
  const isXPage = host.includes('x.com') || host.includes('twitter.com');
  if (!els.newsSourceName.value.trim()) {
    els.newsSourceName.value = 'AIO';
  }

  if (!isXPage || !tab.id) {
    showToast('已读取当前页');
    return;
  }

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractXPostMeta
    });
    applyXPostMeta(result || {});
    showToast('已读取帖子数据');
  } catch (error) {
    showToast('页面数据读取失败，请确认当前页是 X 帖子页');
  }
}

function applyXPostMeta(meta) {
  if (meta.authorName) {
    els.newsAuthorName.value = meta.authorName;
  }
  if (Number.isFinite(meta.viewCount) && meta.viewCount > 0) {
    els.newsViewCount.value = String(meta.viewCount);
  }
  if (Number.isFinite(meta.likeCount) && meta.likeCount > 0) {
    els.newsLikeCount.value = String(meta.likeCount);
  }
  if (Number.isFinite(meta.repostCount) && meta.repostCount > 0) {
    els.newsRepostCount.value = String(meta.repostCount);
  }
  if (Number.isFinite(meta.commentCount) && meta.commentCount > 0) {
    els.newsCommentCount.value = String(meta.commentCount);
  }
}

function extractXPostMeta() {
  function parseHumanNumber(value) {
    const raw = String(value || '')
      .replace(/,/g, '')
      .replace(/\s+/g, '')
      .replace(/＋/g, '+')
      .trim();
    if (!raw) return 0;
    const match = raw.match(/(\d+(?:\.\d+)?)(万|千|亿|[kKmMbB])?/);
    if (!match) return 0;
    const number = Number(match[1]);
    if (!Number.isFinite(number)) return 0;
    const unit = match[2] || '';
    if (unit === '亿' || unit.toLowerCase() === 'b') return Math.floor(number * 100000000);
    if (unit === '万') return Math.floor(number * 10000);
    if (unit === '千' || unit.toLowerCase() === 'k') return Math.floor(number * 1000);
    if (unit.toLowerCase() === 'm') return Math.floor(number * 1000000);
    return Math.floor(number);
  }

  function pickMainArticle() {
    const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
    if (articles.length <= 1) return articles[0] || null;
    const viewportCenter = window.innerHeight / 2;
    return articles
      .map((article) => {
        const rect = article.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        return { article, distance: Math.abs(center - viewportCenter), top: rect.top };
      })
      .filter((item) => item.top > -120)
      .sort((a, b) => a.distance - b.distance)[0]?.article || articles[0];
  }

  function getAuthorFromArticle(article) {
    const urlHandle = location.pathname.split('/').filter(Boolean)[0];
    const userNameNode = article.querySelector('[data-testid="User-Name"]');
    const userLinks = Array.from((userNameNode || article).querySelectorAll('a[href^="/"]'));
    const handleLink = userLinks.find((link) => {
      const path = link.getAttribute('href') || '';
      const parts = path.split('/').filter(Boolean);
      return parts.length === 1 && !['home', 'explore', 'notifications', 'messages', 'i'].includes(parts[0]);
    });
    const handle = (handleLink?.getAttribute('href') || urlHandle || '').split('/').filter(Boolean)[0] || '';
    return handle ? `@${handle}` : '';
  }

  function getMetricFromSelector(article, selectors) {
    for (const selector of selectors) {
      const element = article.querySelector(selector);
      const value = parseHumanNumber(element?.textContent || element?.getAttribute('aria-label') || '');
      if (value > 0) return value;
    }
    return 0;
  }

  function getMetricFromGroupLabel(article, names) {
    const labels = Array.from(article.querySelectorAll('[role="group"][aria-label], [aria-label]'))
      .map((node) => node.getAttribute('aria-label') || '')
      .filter(Boolean);
    for (const label of labels) {
      const parts = label.split(/[,，、]/).map((part) => part.trim()).filter(Boolean);
      for (const part of parts) {
        if (names.some((name) => part.toLowerCase().includes(name.toLowerCase()))) {
          const value = parseHumanNumber(part);
          if (value > 0) return value;
        }
      }
    }
    return 0;
  }

  const article = pickMainArticle();
  if (!article) {
    return {};
  }

  const commentCount =
    getMetricFromSelector(article, ['[data-testid="reply"]']) ||
    getMetricFromGroupLabel(article, ['reply', 'replies', 'comment', 'comments', '回复', '评论']);
  const repostCount =
    getMetricFromSelector(article, ['[data-testid="retweet"]']) ||
    getMetricFromGroupLabel(article, ['repost', 'reposts', 'retweet', 'retweets', '转发', '转帖']);
  const likeCount =
    getMetricFromSelector(article, ['[data-testid="like"]', '[data-testid="unlike"]']) ||
    getMetricFromGroupLabel(article, ['like', 'likes', '喜欢', '赞']);
  const viewCount =
    getMetricFromSelector(article, ['a[href$="/analytics"]', 'a[aria-label*="views"]', 'a[aria-label*="查看"]']) ||
    getMetricFromGroupLabel(article, ['view', 'views', '查看', '浏览']);

  return {
    authorName: getAuthorFromArticle(article),
    viewCount,
    likeCount,
    repostCount,
    commentCount
  };
}

function clearNewsForm() {
  [
    els.newsContentMarkdown,
    els.newsSourceName,
    els.newsAuthorName,
    els.newsViewCount,
    els.newsLikeCount,
    els.newsRepostCount,
    els.newsCommentCount
  ].forEach((input) => {
    input.value = '';
  });
  selectedNewsTags = new Set();
  const checkboxes = els.newsTagsMenu.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((checkbox) => {
    checkbox.checked = false;
  });
  updateNewsTagsTrigger();
  closeNewsTagsDropdown();
  els.newsCover.value = '';
  resetCoverPreview();
}

async function submitNews() {
  settings = await getSettings();
  updateSetupNotice();
  if (!isConfigured()) return;

  const contentMarkdown = els.newsContentMarkdown.value.trim();
  if (!contentMarkdown) {
    showToast('请填写文章正文');
    return;
  }

  els.submitNewsBtn.disabled = true;
  els.submitNewsBtn.textContent = '上传头图';

  let coverFileId = '';
  try {
    coverFileId = await uploadCoverToCloudStorage();
  } catch (error) {
    showToast(error instanceof Error ? error.message : '头图上传失败');
    els.submitNewsBtn.disabled = false;
    els.submitNewsBtn.textContent = '上传发布';
    return;
  }

  const payload = {
    coverFileId,
    contentMarkdown,
    sourceName: els.newsSourceName.value.trim() || 'AIO',
    authorName: els.newsAuthorName.value.trim(),
    sourcePlatform: inferPlatform(els.newsSourceName.value),
    tags: Array.from(selectedNewsTags).join(','),
    viewCount: toNumber(els.newsViewCount.value),
    likeCount: toNumber(els.newsLikeCount.value),
    repostCount: toNumber(els.newsRepostCount.value),
    commentCount: toNumber(els.newsCommentCount.value),
    status: 'published',
    publishedAt: Date.now()
  };

  if (JSON.stringify(payload).length > 900 * 1024) {
    showToast('内容过大，请缩短正文');
    els.submitNewsBtn.disabled = false;
    els.submitNewsBtn.textContent = '上传发布';
    return;
  }

  els.submitNewsBtn.textContent = '发布中';
  try {
    const result = await apiRequest('/operator/news', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    showToast(`已发布，热度 ${result.score || 0}`);
    clearNewsForm();
  } catch (error) {
    showError(error);
  } finally {
    els.submitNewsBtn.disabled = false;
    els.submitNewsBtn.textContent = '上传发布';
  }
}

async function uploadCoverToCloudStorage() {
  const coverDataUrl = await readCoverDataUrl();
  if (!coverDataUrl) {
    return '';
  }
  const blob = dataUrlToBlob(coverDataUrl);
  const result = await apiRequest('/operator/news/cover', {
    method: 'POST',
    headers: {
      'content-type': blob.type || 'image/jpeg'
    },
    body: blob
  });
  return result.coverFileId || '';
}

function readCoverDataUrl() {
  if (pastedCoverDataUrl) {
    return Promise.resolve(pastedCoverDataUrl);
  }

  return new Promise((resolve, reject) => {
    const file = els.newsCover.files && els.newsCover.files[0];
    if (!file) {
      resolve('');
      return;
    }
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      reject(new Error('头图仅支持 PNG/JPG/WebP'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('头图不能超过 5MB'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      compressImageDataUrl(String(reader.result || ''))
        .then(resolve)
        .catch(reject);
    };
    reader.onerror = () => reject(new Error('头图读取失败'));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl) {
  const matched = String(dataUrl || '').match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!matched) {
    throw new Error('头图格式不正确');
  }
  const mimeType = matched[1];
  const binary = atob(matched[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

async function handleCoverPaste(event) {
  const clipboardData = event.clipboardData;
  if (!clipboardData) return;

  const imageFile = findImageFileFromClipboard(clipboardData);
  if (imageFile) {
    event.preventDefault();
    await setCoverFromFile(imageFile, '已粘贴头图');
    return;
  }

  const imageUrl = findImageUrlFromClipboard(clipboardData);
  if (imageUrl) {
    event.preventDefault();
    await setCoverFromUrl(imageUrl);
    return;
  }

  showToast('剪贴板里没有图片');
}

async function handleCoverFileChange() {
  const file = els.newsCover.files && els.newsCover.files[0];
  if (!file) return;
  pastedCoverDataUrl = '';
  setCoverPreview(URL.createObjectURL(file), file.name || '已选择头图', true);
}

function findImageFileFromClipboard(clipboardData) {
  const items = Array.from(clipboardData.items || []);
  const imageItem = items.find((item) => item.kind === 'file' && /^image\//.test(item.type));
  return imageItem?.getAsFile() || null;
}

function findImageUrlFromClipboard(clipboardData) {
  const html = clipboardData.getData('text/html');
  if (html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const src = doc.querySelector('img')?.getAttribute('src') || '';
    if (/^https?:\/\//.test(src) || /^data:image\//.test(src)) {
      return src;
    }
  }

  const text = clipboardData.getData('text/plain').trim();
  return /^https?:\/\/.+\.(png|jpe?g|webp)(\?.*)?$/i.test(text) ? text : '';
}

async function setCoverFromFile(file, message) {
  try {
    const dataUrl = await readImageFileDataUrl(file);
    pastedCoverDataUrl = await compressImageDataUrl(dataUrl);
    els.newsCover.value = '';
    setCoverPreview(pastedCoverDataUrl, message);
    showToast(message);
  } catch (error) {
    showToast(error instanceof Error ? error.message : '头图读取失败');
  }
}

async function setCoverFromUrl(url) {
  try {
    const dataUrl = url.startsWith('data:image/')
      ? url
      : await fetchImageAsDataUrl(url);
    pastedCoverDataUrl = await compressImageDataUrl(dataUrl);
    els.newsCover.value = '';
    setCoverPreview(pastedCoverDataUrl, '已粘贴图片链接');
    showToast('已粘贴头图');
  } catch {
    showToast('图片链接读取失败，请改用复制图片或本地选择');
  }
}

function readImageFileDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      reject(new Error('头图仅支持 PNG/JPG/WebP'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('头图不能超过 5MB'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('头图读取失败'));
    reader.readAsDataURL(file);
  });
}

async function fetchImageAsDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('图片链接读取失败');
  }
  const blob = await response.blob();
  if (!/^image\/(png|jpe?g|webp)$/.test(blob.type)) {
    throw new Error('头图仅支持 PNG/JPG/WebP');
  }
  if (blob.size > 5 * 1024 * 1024) {
    throw new Error('头图不能超过 5MB');
  }
  return readImageFileDataUrl(blob);
}

function setCoverPreview(src, status, revokeOnReset = false) {
  if (coverPreviewObjectUrl) {
    URL.revokeObjectURL(coverPreviewObjectUrl);
    coverPreviewObjectUrl = '';
  }
  if (revokeOnReset) {
    coverPreviewObjectUrl = src;
  }
  els.newsCoverPreview.src = src;
  els.newsCoverPreview.classList.remove('hidden');
  els.newsCoverDropzone.classList.add('cover-dropzone--filled');
  els.newsCoverStatus.textContent = status;
}

function resetCoverPreview() {
  pastedCoverDataUrl = '';
  if (coverPreviewObjectUrl) {
    URL.revokeObjectURL(coverPreviewObjectUrl);
    coverPreviewObjectUrl = '';
  }
  els.newsCoverPreview.removeAttribute('src');
  els.newsCoverPreview.classList.add('hidden');
  els.newsCoverDropzone.classList.remove('cover-dropzone--filled');
  els.newsCoverStatus.textContent = '复制网页图片后，点击这里按 Cmd/Ctrl + V';
}

function compressImageDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('头图压缩失败'));
        return;
      }

      const baseWidth = Math.min(1280, image.width);
      const scale = baseWidth / image.width;
      const candidates = [
        { width: baseWidth, quality: 0.9 },
        { width: Math.round(baseWidth * 0.92), quality: 0.84 },
        { width: Math.round(baseWidth * 0.82), quality: 0.78 },
        { width: Math.round(baseWidth * 0.72), quality: 0.7 },
        { width: Math.round(baseWidth * 0.62), quality: 0.62 }
      ];

      let bestDataUrl = '';
      for (const candidate of candidates) {
        const width = Math.max(640, candidate.width);
        const height = Math.max(1, Math.round(image.height * scale * (width / baseWidth)));
        canvas.width = width;
        canvas.height = height;
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        bestDataUrl = canvas.toDataURL('image/jpeg', candidate.quality);
        if (bestDataUrl.length <= MAX_COVER_DATA_URL_LENGTH) {
          resolve(bestDataUrl);
          return;
        }
      }

      if (bestDataUrl && bestDataUrl.length <= 3 * 1024 * 1024) {
        resolve(bestDataUrl);
        return;
      }
      reject(new Error('头图压缩后仍过大，请换一张更小的图片'));
    };
    image.onerror = () => reject(new Error('头图压缩失败'));
    image.src = dataUrl;
  });
}

function safeHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function inferPlatform(url) {
  const normalized = String(url || '').toLowerCase();
  if (normalized === 'x' || normalized.includes('twitter')) return 'x';
  if (normalized.includes('openai') || normalized.includes('anthropic') || normalized.includes('google')) return 'official';
  const host = safeHost(url);
  if (host.includes('x.com') || host.includes('twitter.com')) return 'x';
  if (host.includes('openai.com') || host.includes('anthropic.com') || host.includes('google')) return 'official';
  return 'blog';
}

function toNumber(value) {
  const numeric = Number(String(value || '').replace(/,/g, ''));
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
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

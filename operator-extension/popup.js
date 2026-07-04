const DEFAULT_SETTINGS = {
  apiBaseUrl: '',
  operatorToken: '',
  chatgptUrl: 'https://chatgpt.com/',
  appstoreMobile: '15810901111'
};
const FALLBACK_APPSTORE_COUNTRIES = [
  { countryCode: 'PH', countryName: '菲律宾', dialingCode: '+63', available: true },
  { countryCode: 'NG', countryName: '尼日利亚', dialingCode: '+234', available: true },
  { countryCode: 'US', countryName: '美国', dialingCode: '+1', available: true }
];
const FALLBACK_PRODUCT_TYPES = [
  { productCode: 'all', productName: '全部商品', label: '全部商品（不区分）', available: true },
  { productCode: 'ai_news', productName: 'ChatGPT', label: 'ChatGPT', available: true },
  { productCode: 'claude_pro', productName: 'Claude', label: 'Claude', available: true }
];
const MAX_COVER_DATA_URL_LENGTH = 2 * 1024 * 1024;
const INVOICE_TAX_ITEM_NAME = '服务费';
const INVOICE_TAX_CODE = '3040203000000000000';
const INVOICE_TAX_RATE = '0.03';
const NEWS_TAG_TREE = [
  {
    group: 'AI巨头',
    tags: ['OpenAI', 'Google AI', 'Claude AI', 'DeepMind', 'Anthropic', 'Meta AI', 'Microsoft AI', 'xAI', 'Grok']
  },
  {
    group: '开源与社区',
    tags: ['GitHub', '开源项目', '模型开源', '开发者工具', 'Hugging Face']
  },
  {
    group: '工具与应用',
    tags: ['AI工具', '提示词', 'Agent', '图片生成', '视频生成', '办公提效', '编程助手']
  },
  {
    group: '教程',
    tags: ['教程', '使用教程', '实战教程', '入门指南', '案例拆解']
  },
  {
    group: '行业动态',
    tags: ['模型更新', '产品发布', '开发实践', '商业化', '融资并购', '安全合规']
  }
];

const els = {
  setupNotice: document.querySelector('#setupNotice'),
  openOptionsBtn: document.querySelector('#openOptionsBtn'),
  refreshBtn: document.querySelector('#refreshBtn'),
  loadBtn: document.querySelector('#loadBtn'),
  openChatgptBtn: document.querySelector('#openChatgptBtn'),
  ordersTabBtn: document.querySelector('#ordersTabBtn'),
  newsTabBtn: document.querySelector('#newsTabBtn'),
  registerTabBtn: document.querySelector('#registerTabBtn'),
  invoicesTabBtn: document.querySelector('#invoicesTabBtn'),
  ordersPanel: document.querySelector('#ordersPanel'),
  newsPanel: document.querySelector('#newsPanel'),
  registerPanel: document.querySelector('#registerPanel'),
  invoicesPanel: document.querySelector('#invoicesPanel'),
  fillCurrentTabBtn: document.querySelector('#fillCurrentTabBtn'),
  clearNewsFormBtn: document.querySelector('#clearNewsFormBtn'),
  submitNewsBtn: document.querySelector('#submitNewsBtn'),
  newsCoverDropzone: document.querySelector('#newsCoverDropzone'),
  newsCoverPreview: document.querySelector('#newsCoverPreview'),
  newsCoverStatus: document.querySelector('#newsCoverStatus'),
  newsCover: document.querySelector('#newsCover'),
  newsVideoUrl: document.querySelector('#newsVideoUrl'),
  importNewsVideoBtn: document.querySelector('#importNewsVideoBtn'),
  newsVideoStatus: document.querySelector('#newsVideoStatus'),
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
  generateAppleAccountBtn: document.querySelector('#generateAppleAccountBtn'),
  saveAppleAccountBtn: document.querySelector('#saveAppleAccountBtn'),
  clearAppleAccountBtn: document.querySelector('#clearAppleAccountBtn'),
  appleAccountCountry: document.querySelector('#appleAccountCountry'),
  appleAccountProduct: document.querySelector('#appleAccountProduct'),
  appleAccountEmail: document.querySelector('#appleAccountEmail'),
  appleAccountMobile: document.querySelector('#appleAccountMobile'),
  appleAccountPassword: document.querySelector('#appleAccountPassword'),
  appleAccountVerificationCode: document.querySelector('#appleAccountVerificationCode'),
  appleAccountVerificationStatus: document.querySelector('#appleAccountVerificationStatus'),
  copyAppleAccountEmailBtn: document.querySelector('#copyAppleAccountEmailBtn'),
  copyAppleAccountMobileBtn: document.querySelector('#copyAppleAccountMobileBtn'),
  copyAppleAccountPasswordBtn: document.querySelector('#copyAppleAccountPasswordBtn'),
  fetchAppleVerificationCodeBtn: document.querySelector('#fetchAppleVerificationCodeBtn'),
  copyAppleVerificationCodeBtn: document.querySelector('#copyAppleVerificationCodeBtn'),
  taskList: document.querySelector('#taskList'),
  taskTemplate: document.querySelector('#taskTemplate'),
  invoiceList: document.querySelector('#invoiceList'),
  invoiceTemplate: document.querySelector('#invoiceTemplate'),
  emptyState: document.querySelector('#emptyState'),
  invoiceEmptyState: document.querySelector('#invoiceEmptyState'),
  summary: document.querySelector('#summary'),
  taskCount: document.querySelector('#taskCount'),
  invoiceSummary: document.querySelector('#invoiceSummary'),
  invoiceCount: document.querySelector('#invoiceCount'),
  exportInvoicesBtn: document.querySelector('#exportInvoicesBtn'),
  markInvoicesProcessingBtn: document.querySelector('#markInvoicesProcessingBtn'),
  issueInvoicesBtn: document.querySelector('#issueInvoicesBtn'),
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
let importedNewsVideo = null;
let selectedNewsTags = new Set();
let lastAppleVerificationCodeId = '';
let lastAppleVerificationEmail = '';
let lastAppleVerificationExpired = false;
let appStoreCountries = [...FALLBACK_APPSTORE_COUNTRIES];
let productTypes = [...FALLBACK_PRODUCT_TYPES];
let currentPanel = 'orders';
let currentInvoices = [];

document.addEventListener('DOMContentLoaded', async () => {
  settings = await getSettings();
  updateSetupNotice();
  syncAppleAccountMobile(settings.appstoreMobile);
  renderAppleAccountOptions();
  resetAppleVerificationState();
  bindActions();
  renderNewsTagsOptions();
  updateNewsTagsTrigger();
  if (isConfigured()) {
    await loadAppleAccountOptions();
    await loadTasks();
  }
});

function bindActions() {
  els.openOptionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  els.refreshBtn.addEventListener('click', loadCurrentPanel);
  els.loadBtn.addEventListener('click', loadCurrentPanel);
  els.openChatgptBtn.addEventListener('click', () => openTab(settings.chatgptUrl || DEFAULT_SETTINGS.chatgptUrl));
  els.ordersTabBtn.addEventListener('click', () => switchPanel('orders'));
  els.newsTabBtn.addEventListener('click', () => switchPanel('news'));
  els.registerTabBtn.addEventListener('click', async () => {
    settings = await getSettings();
    updateSetupNotice();
    syncAppleAccountMobile(settings.appstoreMobile);
    if (isConfigured()) {
      await loadAppleAccountOptions();
    }
    switchPanel('register');
  });
  els.invoicesTabBtn.addEventListener('click', async () => {
    switchPanel('invoices');
    await loadInvoices();
  });
  els.fillCurrentTabBtn.addEventListener('click', fillNewsFromCurrentTab);
  els.clearNewsFormBtn.addEventListener('click', clearNewsForm);
  els.submitNewsBtn.addEventListener('click', submitNews);
  els.newsTagsTrigger.addEventListener('click', toggleNewsTagsDropdown);
  document.addEventListener('click', handleOutsideClick);
  els.newsCoverDropzone.addEventListener('click', () => els.newsCover.click());
  els.newsCoverDropzone.addEventListener('paste', handleCoverPaste);
  els.newsCover.addEventListener('change', handleCoverFileChange);
  els.importNewsVideoBtn.addEventListener('click', () => importNewsVideoFromUrl());
  els.newsVideoUrl.addEventListener('input', () => {
    importedNewsVideo = null;
    els.newsVideoStatus.textContent = '视频链接已修改，发布前需要重新上传视频。';
  });
  els.generateAppleAccountBtn.addEventListener('click', generateAppleAccount);
  els.saveAppleAccountBtn.addEventListener('click', saveAppleAccount);
  els.clearAppleAccountBtn.addEventListener('click', clearAppleAccountForm);
  els.copyAppleAccountEmailBtn.addEventListener('click', () => copyText(els.appleAccountEmail.value, 'Apple 邮箱已复制'));
  els.copyAppleAccountMobileBtn.addEventListener('click', () => copyText(els.appleAccountMobile.value, '手机号已复制'));
  els.copyAppleAccountPasswordBtn.addEventListener('click', () => copyText(els.appleAccountPassword.value, 'Apple 密码已复制'));
  els.fetchAppleVerificationCodeBtn.addEventListener('click', () => void fetchAppleVerificationCode());
  els.copyAppleVerificationCodeBtn.addEventListener('click', () => copyText(els.appleAccountVerificationCode.value, '验证码已复制'));
  els.exportInvoicesBtn.addEventListener('click', exportCurrentInvoices);
  els.markInvoicesProcessingBtn.addEventListener('click', () => updateInvoicesBatch('processing'));
  els.issueInvoicesBtn.addEventListener('click', () => updateInvoicesBatch('issued'));
  els.appleAccountEmail.addEventListener('input', () => resetAppleVerificationState());
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
  NEWS_TAG_TREE.forEach((group) => {
    const groupNode = document.createElement('div');
    groupNode.className = 'tags-dropdown__group';
    groupNode.textContent = group.group;
    els.newsTagsMenu.appendChild(groupNode);

    group.tags.forEach((tag) => {
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
  const isRegister = panel === 'register';
  const isInvoices = panel === 'invoices';
  currentPanel = panel;
  els.ordersPanel.classList.toggle('hidden', isNews || isRegister || isInvoices);
  els.newsPanel.classList.toggle('hidden', !isNews);
  els.registerPanel.classList.toggle('hidden', !isRegister);
  els.invoicesPanel.classList.toggle('hidden', !isInvoices);
  els.ordersTabBtn.classList.toggle('tab-button--active', !isNews && !isRegister && !isInvoices);
  els.newsTabBtn.classList.toggle('tab-button--active', isNews);
  els.registerTabBtn.classList.toggle('tab-button--active', isRegister);
  els.invoicesTabBtn.classList.toggle('tab-button--active', isInvoices);
}

async function loadCurrentPanel() {
  if (currentPanel === 'invoices') {
    await loadInvoices();
    return;
  }
  await loadTasks();
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

function syncAppleAccountMobile(mobile) {
  els.appleAccountMobile.value = mobile || DEFAULT_SETTINGS.appstoreMobile;
}

function resetAppleVerificationState() {
  lastAppleVerificationCodeId = '';
  lastAppleVerificationEmail = '';
  lastAppleVerificationExpired = false;
  els.appleAccountVerificationCode.value = '';
  els.copyAppleVerificationCodeBtn.disabled = true;
  els.appleAccountVerificationStatus.textContent = '用于 Apple 账户注册邮箱验证，点击获取可手动刷新最近验证码；过期验证码会在下次刷新前自动清理。';
}

async function loadTasks() {
  settings = await getSettings();
  updateSetupNotice();
  if (!isConfigured()) return;

  setLoading(true);
  try {
    const mobile = (settings.appstoreMobile || DEFAULT_SETTINGS.appstoreMobile).trim();
    const query = mobile ? `?status=opening&mobile=${encodeURIComponent(mobile)}` : '?status=opening';
    const data = await apiRequest(`/operator/tasks${query}`, { method: 'GET' });
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    renderTasks(tasks);
  } catch (error) {
    showError(error);
  } finally {
    setLoading(false);
  }
}

async function loadInvoices() {
  settings = await getSettings();
  updateSetupNotice();
  if (!isConfigured()) return;

  setLoading(true);
  try {
    const [submittedData, processingData] = await Promise.all([
      apiRequest('/operator/invoices?status=submitted', { method: 'GET' }),
      apiRequest('/operator/invoices?status=processing', { method: 'GET' })
    ]);
    const invoices = [
      ...(Array.isArray(submittedData.invoices) ? submittedData.invoices : []),
      ...(Array.isArray(processingData.invoices) ? processingData.invoices : [])
    ].sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
    renderInvoices(invoices);
  } catch (error) {
    showError(error);
  } finally {
    setLoading(false);
  }
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index) {
  let name = '';
  let current = index;
  while (current > 0) {
    current -= 1;
    name = String.fromCharCode(65 + (current % 26)) + name;
    current = Math.floor(current / 26);
  }
  return name;
}

function buildXlsxCell(rowIndex, columnIndex, value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  const ref = `${columnName(columnIndex)}${rowIndex}`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function buildXlsxRow(rowIndex, cells) {
  const content = Object.entries(cells)
    .map(([columnIndex, value]) => buildXlsxCell(rowIndex, Number(columnIndex), value))
    .join('');
  return `<row r="${rowIndex}">${content}</row>`;
}

function createInvoiceSerial(index) {
  const date = new Date();
  return `FP${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(index + 1).padStart(4, '0')}`;
}

function createInvoiceExportRows(invoices) {
  return invoices.map((invoice, index) => ({
    serial: createInvoiceSerial(index),
    invoice,
  }));
}

function buildWorksheetXml(rows, lastColumnName) {
  const rowCount = Math.max(4, rows.length);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumnName}${rowCount}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <sheetData>${rows.join('')}</sheetData>
</worksheet>`;
}

function buildInvoiceBasicInfoSheet(exportRows) {
  const rows = [
    buildXlsxRow(1, {
      1: '填表说明：每个发票流水号对应一张发票；购买方邮箱用于税局系统开票后分别发送给对应用户。',
    }),
    buildXlsxRow(2, {
      1: '必填\n(限20字符)',
      2: '必填\n(限10字符)',
      4: '必填(是/否)\n(限2字符)',
      5: '非必填(是/否)\n(限2字符)',
      6: '必填\n(限100字符)',
      7: '专票必填\n(限20字符)',
      23: '非必填\n(限230字符)',
      31: '非必填\n(限72字符)',
    }),
    buildXlsxRow(3, {
      1: '发票流水号',
      2: '发票类型',
      3: '特定业务类型',
      4: '是否含税',
      5: '受票方自然人标识',
      6: '购买方名称',
      7: '购买方纳税人识别号',
      8: '购买方证件类型',
      9: '购买方证件号码',
      10: '购买方国籍（或地区）',
      11: '购买方地址',
      12: '购买方所在地区（报废产品收购必填）',
      13: '购买方所在地区（报废产品收购必填）',
      14: '购买方所在地区（报废产品收购必填）',
      15: '购买方所在地区（报废产品收购必填）',
      16: '购买方详细地址（报废产品收购必填）',
      17: '购买方电话',
      18: '购买方开户银行',
      19: '购买方银行账号',
      20: '是否展示购买方地址电话银行账号',
      21: '是否开具涉税专业服务发票品目',
      22: '涉税专业服务协议编号',
      23: '备注',
      24: '报废产品销售类型',
      25: '每千克煤炭发热量',
      26: '干基全硫',
      27: '干燥无灰基挥发分',
      28: '销售方开户行',
      29: '销售方银行账号',
      30: '是否展示销售方地址电话银行账号',
      31: '购买方邮箱',
      32: '购买方经办人姓名',
      33: '购买方经办人证件类型',
      34: '购买方经办人证件号码',
      35: '经办人国籍(地区)',
      36: '经办人自然人纳税人识别号',
      37: '放弃享受减按1%征收率原因',
      38: '收款人',
      39: '复核人',
    }),
  ];

  exportRows.forEach(({ serial, invoice }, index) => {
    rows.push(buildXlsxRow(index + 4, {
      1: serial,
      2: '普通发票',
      4: '是',
      5: invoice.titleType === 'personal' ? '是' : '否',
      6: invoice.title || '个人',
      7: invoice.titleType === 'company' ? invoice.taxNo || '' : '',
      23: Array.isArray(invoice.orderNos) ? `订单号：${invoice.orderNos.join('、')}` : '',
      31: invoice.email || '',
    }));
  });

  return buildWorksheetXml(rows, 'AM');
}

function buildInvoiceDetailInfoSheet(exportRows, options) {
  const rows = [
    buildXlsxRow(1, {
      1: '填表说明：系统根据发票流水号将明细和发票基本信息关联；当前每张发票生成一条服务费明细。',
    }),
    buildXlsxRow(2, {
      1: '必填\n（限20字符)',
      2: '必填\n（限100字符)',
      3: '必填\n（限20字符)',
      8: '必填\n（限16字符)\n保留两位小数',
      9: '必填\n（限8字符)',
    }),
    buildXlsxRow(3, {
      1: '发票流水号',
      2: '项目名称',
      3: '商品和服务税收编码',
      4: '规格型号',
      5: '单位',
      6: '数量',
      7: '单价',
      8: '金额',
      9: '税率',
      10: '折扣金额',
      11: '是否使用优惠政策',
      12: '优惠政策类型',
      13: '即征即退类型',
      14: '煤炭种类',
    }),
  ];

  exportRows.forEach(({ serial, invoice }, index) => {
    rows.push(buildXlsxRow(index + 4, {
      1: serial,
      2: options.itemName,
      3: options.taxCode,
      8: Number(invoice.amount || 0).toFixed(2),
      9: options.taxRate,
    }));
  });

  return buildWorksheetXml(rows, 'N');
}

function buildEmptyInvoiceBusinessSheet() {
  return buildWorksheetXml([
    buildXlsxRow(1, { 1: '特定业务信息，本业务无需填写。' }),
    buildXlsxRow(3, { 1: '发票流水号' }),
  ], 'AS');
}

function buildEmptyInvoiceExtraSheet() {
  return buildWorksheetXml([
    buildXlsxRow(1, { 1: '附加要素信息，本业务无需填写。' }),
    buildXlsxRow(3, { 1: '发票流水号', 2: '附加要素名称', 3: '附加要素内容' }),
  ], 'C');
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

let crcTable = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c >>> 0;
  }
  return crcTable;
}

function crc32(bytes) {
  const table = getCrcTable();
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pushUint16(target, value) {
  target.push(value & 0xFF, (value >>> 8) & 0xFF);
}

function pushUint32(target, value) {
  target.push(value & 0xFF, (value >>> 8) & 0xFF, (value >>> 16) & 0xFF, (value >>> 24) & 0xFF);
}

function concatUint8(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, day } = dosDateTime();

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
    const crc = crc32(dataBytes);
    const localHeader = [];
    pushUint32(localHeader, 0x04034B50);
    pushUint16(localHeader, 20);
    pushUint16(localHeader, 0);
    pushUint16(localHeader, 0);
    pushUint16(localHeader, time);
    pushUint16(localHeader, day);
    pushUint32(localHeader, crc);
    pushUint32(localHeader, dataBytes.length);
    pushUint32(localHeader, dataBytes.length);
    pushUint16(localHeader, nameBytes.length);
    pushUint16(localHeader, 0);
    localParts.push(new Uint8Array(localHeader), nameBytes, dataBytes);

    const centralHeader = [];
    pushUint32(centralHeader, 0x02014B50);
    pushUint16(centralHeader, 20);
    pushUint16(centralHeader, 20);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, time);
    pushUint16(centralHeader, day);
    pushUint32(centralHeader, crc);
    pushUint32(centralHeader, dataBytes.length);
    pushUint32(centralHeader, dataBytes.length);
    pushUint16(centralHeader, nameBytes.length);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint32(centralHeader, 0);
    pushUint32(centralHeader, offset);
    centralParts.push(new Uint8Array(centralHeader), nameBytes);

    offset += localHeader.length + nameBytes.length + dataBytes.length;
  });

  const centralDirectory = concatUint8(centralParts);
  const end = [];
  pushUint32(end, 0x06054B50);
  pushUint16(end, 0);
  pushUint16(end, 0);
  pushUint16(end, files.length);
  pushUint16(end, files.length);
  pushUint32(end, centralDirectory.length);
  pushUint32(end, offset);
  pushUint16(end, 0);

  return concatUint8([...localParts, centralDirectory, new Uint8Array(end)]);
}

function createInvoiceTaxImportWorkbook(invoices, options) {
  const exportRows = createInvoiceExportRows(invoices);
  const basicSheetXml = buildInvoiceBasicInfoSheet(exportRows);
  const detailSheetXml = buildInvoiceDetailInfoSheet(exportRows, options);
  const businessSheetXml = buildEmptyInvoiceBusinessSheet();
  const extraSheetXml = buildEmptyInvoiceExtraSheet();
  const versionXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:A4"/>
  <sheetData>
    <row r="4">${buildXlsxCell(4, 1, 'pt:20260401')}</row>
  </sheetData>
</worksheet>`;
  const files = [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet5.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="1-发票基本信息" sheetId="1" r:id="rId1"/>
    <sheet name="2-发票明细信息" sheetId="2" r:id="rId2"/>
    <sheet name="3-特定业务信息" sheetId="3" r:id="rId3"/>
    <sheet name="4-附加要素信息" sheetId="4" r:id="rId4"/>
    <sheet name="excelVersion" sheetId="5" r:id="rId5"/>
  </sheets>
</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet5.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/styles.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf/></cellStyleXfs>
  <cellXfs count="1"><xf xfId="0"/></cellXfs>
</styleSheet>`,
    },
    { name: 'xl/worksheets/sheet1.xml', content: basicSheetXml },
    { name: 'xl/worksheets/sheet2.xml', content: detailSheetXml },
    { name: 'xl/worksheets/sheet3.xml', content: businessSheetXml },
    { name: 'xl/worksheets/sheet4.xml', content: extraSheetXml },
    { name: 'xl/worksheets/sheet5.xml', content: versionXml },
  ];
  return createZip(files);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCurrentInvoices() {
  if (!currentInvoices.length) {
    showToast('暂无可导出的发票申请');
    return;
  }
  exportInvoices(currentInvoices, '批量开票模板已导出');
}

function exportInvoices(invoices, successMessage) {
  const workbook = createInvoiceTaxImportWorkbook(invoices, {
    itemName: INVOICE_TAX_ITEM_NAME,
    taxRate: INVOICE_TAX_RATE,
    taxCode: INVOICE_TAX_CODE,
  });
  const blob = new Blob([workbook], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const date = new Date();
  const filename = `批量开票导入模板-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}.xlsx`;
  downloadBlob(blob, filename);
  showToast(successMessage);
}

function renderInvoices(invoices) {
  currentInvoices = invoices;
  els.invoiceList.innerHTML = '';
  els.invoiceCount.textContent = String(invoices.length);
  els.invoiceSummary.classList.toggle('hidden', invoices.length === 0);
  els.invoiceEmptyState.classList.toggle('hidden', invoices.length > 0);
  updateInvoiceToolbar();

  invoices.forEach((invoice) => {
    const node = els.invoiceTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.invoiceNo = invoice.invoiceNo || '';
    const isProcessing = invoice.status === 'processing';
    const statusLabel = isProcessing ? '正在处理' : '待开票';
    node.querySelector('.invoice-card__status').textContent = `${invoice.titleType === 'company' ? '企业普票' : '个人普票'} · ${statusLabel}`;
    node.querySelector('.invoice-card__title').textContent = invoice.title || '发票申请';
    node.querySelector('.invoice-card__amount').textContent = formatMoney(invoice.amount);
    node.querySelector('.invoice-card__no').textContent = invoice.invoiceNo || '-';
    node.querySelector('.invoice-card__created-at').textContent = formatTime(invoice.createdAt);
    node.querySelector('.invoice-card__user').textContent = invoice.mobile || invoice.nickname || invoice.userId || '-';
    node.querySelector('.invoice-card__order-count').textContent = `${Array.isArray(invoice.orderNos) ? invoice.orderNos.length : 0} 个`;
    node.querySelector('.invoice-card__email').value = invoice.email || '';
    node.querySelector('.invoice-card__tax-no').value = invoice.taxNo || '';
    node.querySelector('.invoice-card__orders').value = Array.isArray(invoice.orderNos) ? invoice.orderNos.join('\n') : '';
    node.querySelector('.invoice-card__note').value = invoice.operatorNote || '';

    if (isProcessing) node.classList.add('is-processing');

    node.querySelector('.copy-invoice-email').addEventListener('click', () => copyText(invoice.email || '', '邮箱已复制'));
    node.querySelector('.copy-invoice-tax').addEventListener('click', () => copyText(invoice.taxNo || '', '税号已复制'));
    node.querySelector('.reject-invoice').addEventListener('click', () => rejectInvoice(invoice.invoiceNo, node));
    els.invoiceList.appendChild(node);
  });
}

function updateInvoiceToolbar() {
  const hasInvoices = currentInvoices.length > 0;
  const hasSubmittedInvoices = currentInvoices.some((invoice) => invoice.status === 'submitted');
  els.exportInvoicesBtn.disabled = !hasInvoices;
  els.markInvoicesProcessingBtn.disabled = !hasSubmittedInvoices;
  els.issueInvoicesBtn.disabled = !hasInvoices;
}

async function updateInvoicesBatch(status) {
  const targets = status === 'processing'
    ? currentInvoices.filter((invoice) => invoice.status === 'submitted')
    : currentInvoices;
  if (!targets.length) {
    showToast(status === 'processing' ? '暂无待标记的发票申请' : '暂无可处理的发票申请');
    return;
  }
  const confirmed = window.confirm(status === 'issued'
    ? `确认将 ${targets.length} 个发票申请标记为已开票？`
    : `确认将 ${targets.length} 个发票申请标记为正在处理？`);
  if (!confirmed) return;

  try {
    await Promise.all(targets.map((invoice) => apiRequest(`/operator/invoices/${encodeURIComponent(invoice.invoiceNo)}`, {
      method: 'POST',
      body: JSON.stringify({ status, operatorNote: '' }),
    })));
    showToast(status === 'issued' ? '已批量标记开票完成' : '已批量标记正在处理');
    await loadInvoices();
  } catch (error) {
    showError(error);
  }
}

async function rejectInvoice(invoiceNo, node) {
  if (!invoiceNo) return;
  const rejectReason = node.querySelector('.invoice-card__note').value.trim();
  if (!rejectReason) {
    showToast('请先填写驳回原因');
    return;
  }
  const confirmed = window.confirm('确认驳回该开票申请？驳回后订单会回到用户可开票列表。');
  if (!confirmed) return;

  try {
    await apiRequest(`/operator/invoices/${encodeURIComponent(invoiceNo)}`, {
      method: 'POST',
      body: JSON.stringify({
        status: 'rejected',
        operatorNote: rejectReason,
        rejectReason,
      }),
    });
    node.remove();
    currentInvoices = currentInvoices.filter((invoice) => invoice.invoiceNo !== invoiceNo);
    els.invoiceCount.textContent = String(currentInvoices.length);
    els.invoiceSummary.classList.toggle('hidden', currentInvoices.length === 0);
    els.invoiceEmptyState.classList.toggle('hidden', currentInvoices.length > 0);
    updateInvoiceToolbar();
    showToast('已驳回，订单可重新申请开票');
  } catch (error) {
    showError(error);
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
    node.dataset.productCode = task.productCode || '';
    node.dataset.productName = task.productName || '';
    node.querySelector('.task-card__product').textContent = task.productName || 'Open AI 资讯会员';
    node.querySelector('.task-card__plan').textContent = task.planName || '会员套餐';
    node.querySelector('.task-card__amount').textContent = formatMoney(task.amount);
    node.querySelector('.task-card__order').textContent = task.orderNo || '-';
    node.querySelector('.task-card__paid-at').textContent = formatTime(task.paidAt);
    node.querySelector('.task-card__email').value = task.email || '';
    node.querySelector('.copy-email').addEventListener('click', () => copyText(task.email || '', '账号已复制'));
    node.querySelector('.open-site').addEventListener('click', () => openTab(settings.chatgptUrl || DEFAULT_SETTINGS.chatgptUrl));
    node.querySelector('.mark-processing').addEventListener('click', () => updateTask(task.orderNo, 'processing', node));
    node.querySelector('.delete-order').addEventListener('click', () => deleteOrder(task.orderNo, node));
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

function applyAppleStoreAccountToTask(node, account, reused = false) {
  const emailInput = node.querySelector('.task-card__apple-email');
  const passwordInput = node.querySelector('.task-card__apple-password');
  const fetchButton = node.querySelector('.fetch-apple-account');
  const normalized = account || null;
  node.dataset.appleStoreAccountId = normalized?.id || '';
  node.dataset.appleStoreAccountSource = normalized?.id ? 'pool' : '';
  node.dataset.appleStoreCountryCode = normalized?.countryCode || '';
  node.dataset.appleStoreCountryName = normalized?.countryName || '';
  node.dataset.appleStoreAccountReused = reused ? 'true' : '';
  emailInput.value = normalized?.email || '';
  passwordInput.value = normalized?.password || '';
  fetchButton.textContent = normalized?.email ? (reused ? '已复用' : '已取') : '获取';
}

function markManualAppleStoreAccount(node) {
  node.dataset.appleStoreAccountId = '';
  node.dataset.appleStoreAccountSource = 'manual';
  node.dataset.appleStoreCountryCode = '';
  node.dataset.appleStoreCountryName = '';
  node.dataset.appleStoreAccountReused = '';
  const fetchButton = node.querySelector('.fetch-apple-account');
  if (fetchButton) {
    fetchButton.textContent = '获取';
  }
}

async function fetchAppleStoreAccount(orderNo, node, button) {
  if (!orderNo) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = '获取中';
  try {
    const mobile = (settings.appstoreMobile || DEFAULT_SETTINGS.appstoreMobile).trim();
    const query = mobile ? `?mobile=${encodeURIComponent(mobile)}` : '';
    const result = await apiRequest(`/operator/tasks/${encodeURIComponent(orderNo)}/appstore-account${query}`, { method: 'GET' });
    applyAppleStoreAccountToTask(node, result.account, result.reused);
    await copyText(result.account?.email || '', result.reused ? '已复用并复制 Apple 邮箱' : '已获取并复制 Apple 邮箱');
  } catch (error) {
    showError(error);
  } finally {
    button.disabled = false;
    button.textContent = node.dataset.appleStoreAccountId
      ? (node.dataset.appleStoreAccountReused ? '已复用' : '已取')
      : originalText;
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
      body: JSON.stringify({
        status,
        note,
        mobile: (settings.appstoreMobile || DEFAULT_SETTINGS.appstoreMobile).trim()
      })
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

async function deleteOrder(orderNo, node) {
  if (!orderNo) return;
  const confirmed = window.confirm(`确认删除订单 ${orderNo}？此操作只删除订单记录，不会删除用户信息。`);
  if (!confirmed) return;
  try {
    await apiRequest(`/operator/tasks/${encodeURIComponent(orderNo)}`, { method: 'DELETE' });
    node.remove();
    const count = Math.max(0, Number(els.taskCount.textContent || '0') - 1);
    els.taskCount.textContent = String(count);
    els.summary.classList.toggle('hidden', count === 0);
    els.emptyState.classList.toggle('hidden', count > 0);
    showToast('订单已删除');
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

function escapeOptionText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderAppleAccountOptions() {
  const selectedCountry = els.appleAccountCountry.value;
  const selectedProduct = els.appleAccountProduct.value;
  els.appleAccountCountry.innerHTML = appStoreCountries
    .map((country) => {
      const label = `${country.countryName} ${country.dialingCode || ''}`.trim();
      return `<option value="${escapeOptionText(country.countryCode)}" ${country.available ? '' : 'disabled'}>${escapeOptionText(label)}</option>`;
    })
    .join('');
  els.appleAccountProduct.innerHTML = productTypes
    .map((product) => {
      const label = product.label || product.productName || product.productCode;
      return `<option value="${escapeOptionText(product.productCode)}" ${product.available ? '' : 'disabled'}>${escapeOptionText(label)}</option>`;
    })
    .join('');
  if (selectedCountry && appStoreCountries.some((country) => country.countryCode === selectedCountry)) {
    els.appleAccountCountry.value = selectedCountry;
  }
  if (selectedProduct && productTypes.some((product) => product.productCode === selectedProduct)) {
    els.appleAccountProduct.value = selectedProduct;
  }
}

async function loadAppleAccountOptions() {
  try {
    const [countryResult, productResult] = await Promise.all([
      apiRequest('/operator/appstore-countries', { method: 'GET' }),
      apiRequest('/operator/product-types', { method: 'GET' })
    ]);
    appStoreCountries = Array.isArray(countryResult.countries) && countryResult.countries.length > 0
      ? countryResult.countries
      : [...FALLBACK_APPSTORE_COUNTRIES];
    productTypes = Array.isArray(productResult.productTypes) && productResult.productTypes.length > 0
      ? productResult.productTypes
      : [...FALLBACK_PRODUCT_TYPES];
  } catch (error) {
    appStoreCountries = [...FALLBACK_APPSTORE_COUNTRIES];
    productTypes = [...FALLBACK_PRODUCT_TYPES];
  }
  renderAppleAccountOptions();
}

function getSelectedAppleCountry() {
  const countryCode = els.appleAccountCountry.value || FALLBACK_APPSTORE_COUNTRIES[0].countryCode;
  return appStoreCountries.find((country) => country.countryCode === countryCode) || FALLBACK_APPSTORE_COUNTRIES[0];
}

function getSelectedAppleProduct() {
  const productCode = els.appleAccountProduct.value || FALLBACK_PRODUCT_TYPES[0].productCode;
  return productTypes.find((product) => product.productCode === productCode) || FALLBACK_PRODUCT_TYPES[0];
}

async function generateAppleAccount() {
  settings = await getSettings();
  updateSetupNotice();
  if (!isConfigured()) return;

  const mobile = (settings.appstoreMobile || DEFAULT_SETTINGS.appstoreMobile).trim();
  const country = getSelectedAppleCountry();
  const product = getSelectedAppleProduct();
  syncAppleAccountMobile(mobile);
  const originalText = els.generateAppleAccountBtn.textContent;
  els.generateAppleAccountBtn.disabled = true;
  els.generateAppleAccountBtn.textContent = '生成中';
  try {
    const account = await apiRequest('/operator/appstore-accounts/generate', {
      method: 'POST',
      body: JSON.stringify({
        mobile,
        countryCode: country.countryCode,
        countryName: country.countryName,
        productCode: product.productCode,
        productName: product.productName
      }),
    });
    els.appleAccountEmail.value = account.email || '';
    els.appleAccountMobile.value = account.mobile || mobile;
    els.appleAccountPassword.value = account.password || '';
    resetAppleVerificationState();
    showToast('账号已生成');
  } catch (error) {
    showError(error);
  } finally {
    els.generateAppleAccountBtn.disabled = false;
    els.generateAppleAccountBtn.textContent = originalText;
  }
}

async function saveAppleAccount() {
  settings = await getSettings();
  updateSetupNotice();
  if (!isConfigured()) return;

  const email = els.appleAccountEmail.value.trim();
  const mobile = (settings.appstoreMobile || DEFAULT_SETTINGS.appstoreMobile).trim();
  const country = getSelectedAppleCountry();
  const product = getSelectedAppleProduct();
  syncAppleAccountMobile(mobile);
  const password = els.appleAccountPassword.value.trim();
  if (!email || !password) {
    showToast('请先生成账号和密码');
    return;
  }

  const originalText = els.saveAppleAccountBtn.textContent;
  els.saveAppleAccountBtn.disabled = true;
  els.saveAppleAccountBtn.textContent = '保存中';
  try {
    await apiRequest('/operator/appstore-accounts', {
      method: 'POST',
      body: JSON.stringify({
        email,
        mobile,
        password,
        countryCode: country.countryCode,
        countryName: country.countryName,
        productCode: product.productCode,
        productName: product.productName
      })
    });
    showToast('Apple Store 账号已保存');
    clearAppleAccountForm();
  } catch (error) {
    showError(error);
  } finally {
    els.saveAppleAccountBtn.disabled = false;
    els.saveAppleAccountBtn.textContent = originalText;
  }
}

function clearAppleAccountForm() {
  els.appleAccountEmail.value = '';
  els.appleAccountMobile.value = (settings.appstoreMobile || DEFAULT_SETTINGS.appstoreMobile).trim();
  els.appleAccountPassword.value = '';
  resetAppleVerificationState();
}

function updateAppleVerificationStatus(result) {
  if (!result?.hasCode) {
    els.appleAccountVerificationCode.value = '';
    els.copyAppleVerificationCodeBtn.disabled = true;
    els.appleAccountVerificationStatus.textContent = '暂无验证码，请先在 Apple 验证页面发送邮件。';
    return;
  }
  if (result.expired) {
    els.appleAccountVerificationStatus.textContent = '验证码已过期，下一次刷新前会先清理旧记录。';
    return;
  }
  els.appleAccountVerificationStatus.textContent = '已获取最近验证码，可直接复制使用。';
}

async function clearExpiredAppleVerificationCodeIfNeeded(email) {
  if (!lastAppleVerificationExpired || !lastAppleVerificationCodeId || !lastAppleVerificationEmail || lastAppleVerificationEmail !== email) {
    return;
  }
  try {
    await apiRequest('/operator/appstore-accounts/email-code/clear', {
      method: 'POST',
      body: JSON.stringify({
        codeId: lastAppleVerificationCodeId,
        email,
      }),
    });
  } catch (error) {
    console.warn('清理过期 Apple 验证码失败', error);
  } finally {
    lastAppleVerificationCodeId = '';
    lastAppleVerificationEmail = '';
    lastAppleVerificationExpired = false;
  }
}

async function fetchAppleVerificationCode() {
  settings = await getSettings();
  updateSetupNotice();
  if (!isConfigured()) return;

  const email = els.appleAccountEmail.value.trim().toLowerCase();
  if (!email) {
    showToast('请先生成或填写 Apple 邮箱');
    return;
  }

  const originalText = els.fetchAppleVerificationCodeBtn.textContent;
  els.fetchAppleVerificationCodeBtn.disabled = true;
  els.fetchAppleVerificationCodeBtn.textContent = '刷新中';
  try {
    await clearExpiredAppleVerificationCodeIfNeeded(email);
    const result = await apiRequest(`/operator/appstore-accounts/email-code?email=${encodeURIComponent(email)}`, {
      method: 'GET',
    });
    const code = result.code || '';
    els.appleAccountVerificationCode.value = code;
    els.copyAppleVerificationCodeBtn.disabled = !code;
    lastAppleVerificationCodeId = result.codeId || '';
    lastAppleVerificationEmail = result.email || email;
    lastAppleVerificationExpired = Boolean(result.expired);
    updateAppleVerificationStatus(result);
    if (code) {
      await copyText(code, result.expired ? '验证码已复制（已过期）' : '验证码已复制');
    } else {
      els.appleAccountVerificationCode.value = '';
      els.copyAppleVerificationCodeBtn.disabled = true;
      showToast('暂无验证码');
    }
  } catch (error) {
    showError(error);
  } finally {
    els.fetchAppleVerificationCodeBtn.disabled = false;
    els.fetchAppleVerificationCodeBtn.textContent = originalText;
  }
}

async function fillNewsFromCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const host = safeHost(tab.url);
  const isXPage = host.includes('x.com') || host.includes('twitter.com');
  if (!els.newsSourceName.value.trim()) {
    els.newsSourceName.value = 'AIO';
  }
  if (isXPage && tab.url && /\/status(?:es)?\/\d+/.test(new URL(tab.url).pathname) && !els.newsVideoUrl.value.trim()) {
    els.newsVideoUrl.value = tab.url;
    importedNewsVideo = null;
    els.newsVideoStatus.textContent = '已填入当前 X 帖子链接，发布前会上传视频。';
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
    els.newsVideoUrl,
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
  importedNewsVideo = null;
  els.newsVideoStatus.textContent = '可选。填写后会下载 X 视频并上传到小程序云存储；详情页优先展示视频。';
  els.newsCover.value = '';
  resetCoverPreview();
}

async function importNewsVideoFromUrl() {
  settings = await getSettings();
  updateSetupNotice();
  if (!isConfigured()) return null;

  const url = els.newsVideoUrl.value.trim();
  if (!url) {
    showToast('请填写 X 视频链接');
    return null;
  }

  els.importNewsVideoBtn.disabled = true;
  els.importNewsVideoBtn.textContent = '上传中';
  els.newsVideoStatus.textContent = '正在下载 X 视频并上传到云存储...';
  try {
    const result = await apiRequest('/operator/news/video/import', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
    importedNewsVideo = {
      videoFileId: result.videoFileId || '',
      videoPosterFileId: result.posterFileId || '',
      sourceUrl: result.sourceUrl || url,
      size: result.size || 0
    };
    const sizeMb = importedNewsVideo.size ? `，${(importedNewsVideo.size / 1024 / 1024).toFixed(1)}MB` : '';
    els.newsVideoStatus.textContent = `视频已上传${sizeMb}`;
    showToast('视频上传成功');
    return importedNewsVideo;
  } catch (error) {
    importedNewsVideo = null;
    els.newsVideoStatus.textContent = error instanceof Error ? error.message : '视频上传失败';
    showError(error);
    return null;
  } finally {
    els.importNewsVideoBtn.disabled = false;
    els.importNewsVideoBtn.textContent = '上传视频';
  }
}

async function ensureImportedNewsVideo() {
  const url = els.newsVideoUrl.value.trim();
  if (!url) return null;
  if (importedNewsVideo && importedNewsVideo.sourceUrl === url) {
    return importedNewsVideo;
  }
  return importNewsVideoFromUrl();
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
  if (!coverFileId) {
    showToast('请上传资讯图片');
    els.submitNewsBtn.disabled = false;
    els.submitNewsBtn.textContent = '上传发布';
    return;
  }

  els.submitNewsBtn.textContent = '上传视频';
  const video = await ensureImportedNewsVideo();
  if (els.newsVideoUrl.value.trim() && !video) {
    els.submitNewsBtn.disabled = false;
    els.submitNewsBtn.textContent = '上传发布';
    return;
  }

  const payload = {
    coverFileId,
    videoFileId: video?.videoFileId || '',
    videoPosterFileId: video?.videoPosterFileId || '',
    videoSourceUrl: video?.sourceUrl || '',
    videoSize: video?.size || 0,
    contentMarkdown,
    sourceName: els.newsSourceName.value.trim() || 'AIO',
    sourceUrl: video?.sourceUrl || els.newsVideoUrl.value.trim(),
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
    showToast(formatNewsPublishResult(result));
    clearNewsForm();
  } catch (error) {
    showError(error);
  } finally {
    els.submitNewsBtn.disabled = false;
    els.submitNewsBtn.textContent = '上传发布';
  }
}

function formatNewsPublishResult(result) {
  const score = result.score || 0;
  const sent = result.reminderSent || 0;
  const failed = result.reminderFailed || 0;
  const eligible = result.reminderEligible || 0;
  const skippedReason = result.reminderSkippedReason || '';
  const lastError = result.reminderLastError || '';

  if (skippedReason) {
    return truncateToastText(`已发布，热度 ${score}，通知未发送：${skippedReason}`);
  }
  if (failed > 0) {
    return truncateToastText(`已发布，热度 ${score}，通知 ${sent}/${eligible}，失败 ${failed}${lastError ? `：${lastError}` : ''}`);
  }
  return truncateToastText(`已发布，热度 ${score}，通知 ${sent}/${eligible}`);
}

function truncateToastText(value) {
  return value.length > 80 ? `${value.slice(0, 77)}...` : value;
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

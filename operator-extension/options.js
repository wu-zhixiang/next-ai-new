const DEFAULT_SETTINGS = {
  apiBaseUrl: '',
  operatorToken: '',
  chatgptUrl: 'https://chatgpt.com/',
  appstoreMobile: '15810901111'
};

const fields = {
  apiBaseUrl: document.querySelector('#apiBaseUrl'),
  operatorToken: document.querySelector('#operatorToken'),
  chatgptUrl: document.querySelector('#chatgptUrl'),
  appstoreMobile: document.querySelector('#appstoreMobile'),
  saveBtn: document.querySelector('#saveBtn'),
  status: document.querySelector('#status')
};

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['operatorSettings'], (result) => {
    const settings = { ...DEFAULT_SETTINGS, ...(result.operatorSettings || {}) };
    fields.apiBaseUrl.value = settings.apiBaseUrl;
    fields.operatorToken.value = settings.operatorToken;
    fields.chatgptUrl.value = settings.chatgptUrl;
    fields.appstoreMobile.value = settings.appstoreMobile;
  });
});

fields.saveBtn.addEventListener('click', () => {
  const operatorSettings = {
    apiBaseUrl: fields.apiBaseUrl.value.trim(),
    operatorToken: fields.operatorToken.value.trim(),
    chatgptUrl: fields.chatgptUrl.value.trim() || DEFAULT_SETTINGS.chatgptUrl,
    appstoreMobile: fields.appstoreMobile.value.trim() || DEFAULT_SETTINGS.appstoreMobile
  };
  chrome.storage.local.set({ operatorSettings }, () => {
    fields.status.textContent = '已保存';
    setTimeout(() => {
      fields.status.textContent = '';
    }, 1800);
  });
});

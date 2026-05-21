chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['operatorSettings'], (result) => {
    if (result.operatorSettings) return;
    chrome.storage.local.set({
      operatorSettings: {
        apiBaseUrl: '',
        operatorToken: '',
        chatgptUrl: 'https://chatgpt.com/'
      }
    });
  });
});

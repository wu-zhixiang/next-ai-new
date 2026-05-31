chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }

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

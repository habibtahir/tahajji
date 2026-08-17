'use strict';

async function injectFiles(tabId) {
  // script to be inserted at document-end, css at default
  // allFrames will handle iframe too
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['inject.js']
    });
  } catch {
    return; // restricted page (chrome://, Web Store, etc.) or tab already gone
  }
  if (!results || !results.length) return;

  if (results[0].result === true) {
    // script is loaded already, just check & change font in case
    try {
      await chrome.tabs.sendMessage(tabId, { message: "urtextApply" });
    } catch {
      // no listener in this frame/tab; nothing to do
    }
  } else {
    chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, files: ['css/inject.css'] });
    chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, files: ['css/fonts.css'] });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ active: true, font: 'jameel-noori-nastaleeq', fontScale: 100, lineScale: 100 });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') injectFiles(tabId);
});

chrome.tabs.onActivated.addListener(activeInfo => {
  injectFiles(activeInfo.tabId);
});

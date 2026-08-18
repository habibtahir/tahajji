// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

function injectFiles(tabId){
   // script to be inserted at document-end, css at default
   // allFrames will handle iframe too
  chrome.scripting.executeScript({
    target: {tabId: tabId, allFrames: true},
    files: ['inject.js']}, (results) => {
      if(chrome.runtime.lastError || !results || !results.length) return;
      // chrome.scripting.executeScript's results are InjectionResult objects,
      // not the raw return value, so this must check .result -- comparing
      // results[0] itself to true was always false, meaning this branch was
      // dead code and the page's CSS was silently re-inserted on every tab
      // update/activation instead of just re-checking the font.
      if(results[0].result === true) // script is loaded already, just check & change font in case
        chrome.tabs.sendMessage(tabId, {message: "urtextApply"}, (response) => {});
      else{
        chrome.scripting.insertCSS({target: {tabId: tabId, allFrames: true}, files: ['css/inject.css']});
        chrome.scripting.insertCSS({target: {tabId: tabId, allFrames: true}, files: ['css/fonts.css']});
      }
    }
  );
}

chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.sync.set({active: true, font: 'mehr_nastaliq_web', fontScale: 100, lineScale: 100 });
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if(changeInfo.status === 'complete') injectFiles(tabId);
});

chrome.tabs.onActivated.addListener(function(activeInfo) {
  injectFiles(activeInfo.tabId);
});

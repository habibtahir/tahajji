'use strict';

async function notifyActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, message).catch(() => {});
}

async function changeFont() {
  const font = document.querySelector('input[name="fontSelect"]:checked').value;
  await chrome.storage.sync.set({ font });
  notifyActiveTab({ message: "urtextApply" });
}

async function changeFontSize(step) {
  let value = parseInt(document.getElementById('fs-number').value.replace('%', ''), 10);
  value = isNaN(value) ? 100 : value;
  value += step;
  if (step > 0 && value > 150) value = 150;
  if (step < 0 && value < 50) value = 50;
  document.getElementById('fs-number').value = value + '%';

  await chrome.storage.sync.set({ fontScale: value });
  notifyActiveTab({ message: "urtextApply" });
}

async function changeLineHeight(step) {
  let value = parseInt(document.getElementById('lh-number').value.replace('%', ''), 10);
  value = isNaN(value) ? 100 : value;
  value += step;
  if (step > 0 && value > 150) value = 150;
  if (step < 0 && value < 50) value = 50;
  document.getElementById('lh-number').value = value + '%';

  await chrome.storage.sync.set({ lineScale: value });
  notifyActiveTab({ message: "urtextApply" });
}

document.querySelectorAll('input[name="fontSelect"]').forEach(radio => {
  radio.addEventListener('change', changeFont);
});

document.getElementById('switchActive').addEventListener('change', async event => {
  document.getElementById('switchActiveLabel').textContent = event.target.checked ? 'Enabled' : 'Disabled';
  await chrome.storage.sync.set({ active: event.target.checked });
  notifyActiveTab({ message: "urtextApply" });
});

window.addEventListener('load', async () => {
  const data = await chrome.storage.sync.get(['active', 'font', 'fontScale', 'lineScale']);
  document.getElementById('switchActive').checked = data.active;
  document.getElementById('switchActiveLabel').textContent = data.active ? 'Enabled' : 'Disabled';
  document.getElementsByName('fontSelect').forEach(radio => {
    if (radio.value == data.font) radio.setAttribute('checked', '');
  });
  document.getElementById('fs-number').value = data.fontScale + '%';
  document.getElementById('lh-number').value = data.lineScale + '%';
});

document.getElementById('fs-increase').addEventListener('click', () => changeFontSize(5));
document.getElementById('fs-decrease').addEventListener('click', () => changeFontSize(-5));
document.getElementById('lh-increase').addEventListener('click', () => changeLineHeight(5));
document.getElementById('lh-decrease').addEventListener('click', () => changeLineHeight(-5));

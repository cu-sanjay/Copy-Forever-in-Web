const STORAGE_KEY = 'clip_eternity_items';
const MAX_ITEMS = 5000;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    if (!result[STORAGE_KEY]) {
      chrome.storage.local.set({ [STORAGE_KEY]: [] });
    }
  });

  chrome.contextMenus.create({
    id: 'save_selection',
    title: 'Save to Clipboard Eternity',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'save_link',
    title: 'Save Link to Clipboard Eternity',
    contexts: ['link']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save_selection' && info.selectionText) {
    saveItem({
      text: info.selectionText.trim(),
      source: tab?.url || '',
      title: tab?.title || ''
    });
  } else if (info.menuItemId === 'save_link' && info.linkUrl) {
    saveItem({
      text: info.linkUrl,
      source: tab?.url || '',
      title: tab?.title || ''
    });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SAVE_COPY') {
    saveItem(msg.payload).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'GET_ITEMS') {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      sendResponse({ items: result[STORAGE_KEY] || [] });
    });
    return true;
  }
  if (msg.type === 'DELETE_ITEM') {
    deleteItem(msg.id).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'CLEAR_ALL') {
    chrome.storage.local.set({ [STORAGE_KEY]: [] }, () => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'TOGGLE_FAVORITE') {
    toggleFavorite(msg.id).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'ADD_NOTE') {
    addNote(msg.id, msg.note).then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function saveItem({ text, source, title }) {
  if (!text || text.trim().length === 0) return;
  const trimmed = text.trim();

  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const items = result[STORAGE_KEY] || [];

  const isDuplicate = items.length > 0 && items[0].text === trimmed;
  if (isDuplicate) return;

  const isUrl = isValidUrl(trimmed);
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    text: trimmed,
    type: isUrl ? 'link' : detectType(trimmed),
    source: source || '',
    pageTitle: title || '',
    time: Date.now(),
    favorite: false,
    note: ''
  };

  items.unshift(item);

  if (items.length > MAX_ITEMS) {
    const favs = items.filter(i => i.favorite);
    const nonFavs = items.filter(i => !i.favorite);
    const trimmed2 = [...favs, ...nonFavs.slice(0, MAX_ITEMS - favs.length)];
    await chrome.storage.local.set({ [STORAGE_KEY]: trimmed2 });
  } else {
    await chrome.storage.local.set({ [STORAGE_KEY]: items });
  }
}

async function deleteItem(id) {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const items = (result[STORAGE_KEY] || []).filter(i => i.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: items });
}

async function toggleFavorite(id) {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const items = (result[STORAGE_KEY] || []).map(i =>
    i.id === id ? { ...i, favorite: !i.favorite } : i
  );
  await chrome.storage.local.set({ [STORAGE_KEY]: items });
}

async function addNote(id, note) {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const items = (result[STORAGE_KEY] || []).map(i =>
    i.id === id ? { ...i, note } : i
  );
  await chrome.storage.local.set({ [STORAGE_KEY]: items });
}

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function detectType(text) {
  if (/^(function|const|let|var|def |class |import |from |#include|<\?php|package )/.test(text)) return 'code';
  if (/^\d+$/.test(text) || /^[\d.,\s]+$/.test(text)) return 'number';
  if (/\S+@\S+\.\S+/.test(text)) return 'email';
  if (text.length > 200) return 'long';
  return 'text';
}

'use strict';

const STORAGE_KEY = 'clip_eternity_items';
let allItems = [];
let activeFilter = 'all';
let searchQuery = '';

const listEl = document.getElementById('clipList');
const emptyEl = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const itemCountEl = document.getElementById('itemCount');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const exportModal = document.getElementById('exportModal');
const closeModalBtn = document.getElementById('closeModal');
const toastEl = document.getElementById('toast');
const template = document.getElementById('clipTemplate');

function load() {
  chrome.runtime.sendMessage({ type: 'GET_ITEMS' }, (res) => {
    allItems = (res?.items || []);
    render();
  });
}

function render() {
  const q = searchQuery.toLowerCase().trim();
  let filtered = allItems;

  if (activeFilter === 'favorite') {
    filtered = filtered.filter(i => i.favorite);
  } else if (activeFilter !== 'all') {
    filtered = filtered.filter(i => i.type === activeFilter);
  }

  if (q) {
    filtered = filtered.filter(i =>
      i.text.toLowerCase().includes(q) ||
      (i.pageTitle || '').toLowerCase().includes(q) ||
      (i.note || '').toLowerCase().includes(q)
    );
  }

  const count = allItems.length;
  itemCountEl.textContent = `${count} item${count !== 1 ? 's' : ''}`;

  listEl.innerHTML = '';

  if (filtered.length === 0) {
    emptyEl.classList.remove('hidden');
    emptyEl.querySelector('.empty-title').textContent = q || activeFilter !== 'all'
      ? 'No matches found'
      : 'Nothing saved yet';
    emptyEl.querySelector('.empty-sub').textContent = q || activeFilter !== 'all'
      ? 'Try a different search or filter'
      : 'Press Ctrl+C anywhere to start saving';
  } else {
    emptyEl.classList.add('hidden');
    filtered.forEach(item => listEl.appendChild(createClipEl(item)));
  }
}

function createClipEl(item) {
  const clone = template.content.cloneNode(true);
  const li = clone.querySelector('.clip-item');
  li.dataset.id = item.id;
  if (item.type) li.classList.add('type-' + item.type);
  if (item.favorite) li.classList.add('is-fav');

  const badge = li.querySelector('.clip-type-badge');
  badge.textContent = badgeLabel(item.type);
  badge.className = 'clip-type-badge badge-' + item.type;

  li.querySelector('.clip-time').textContent = timeAgo(item.time);

  const textEl = li.querySelector('.clip-text');
  const linkEl = li.querySelector('.clip-link');

  if (item.type === 'link') {
    textEl.style.display = 'none';
    linkEl.style.display = 'block';
    linkEl.href = item.text;
    try {
      const u = new URL(item.text);
      linkEl.textContent = item.pageTitle || u.hostname + u.pathname;
    } catch {
      linkEl.textContent = item.text;
    }
  } else {
    linkEl.style.display = 'none';
    textEl.textContent = item.text;
  }

  const sourceEl = li.querySelector('.clip-source');
  if (item.source && item.type !== 'link') {
    try {
      const u = new URL(item.source);
      sourceEl.textContent = u.hostname;
      sourceEl.classList.add('has-source');
    } catch {}
  }

  const favBtn = li.querySelector('.fav-btn');
  if (item.favorite) {
    favBtn.classList.add('active');
    favBtn.querySelector('svg path').setAttribute('fill', 'currentColor');
  }

  favBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'TOGGLE_FAVORITE', id: item.id }, () => {
      item.favorite = !item.favorite;
      if (item.favorite) {
        li.classList.add('is-fav');
        favBtn.classList.add('active');
        favBtn.querySelector('svg path').setAttribute('fill', 'currentColor');
      } else {
        li.classList.remove('is-fav');
        favBtn.classList.remove('active');
        favBtn.querySelector('svg path').setAttribute('fill', 'none');
      }
      allItems = allItems.map(i => i.id === item.id ? { ...i, favorite: item.favorite } : i);
      if (activeFilter === 'favorite') render();
    });
  });

  li.querySelector('.copy-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.text).then(() => {
      showToast('Copied!');
    }).catch(() => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'WRITE_CLIPBOARD', text: item.text });
        }
      });
      showToast('Copied!');
    });
  });

  li.querySelector('.del-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    li.style.opacity = '0.4';
    li.style.transform = 'translateX(6px)';
    li.style.transition = 'all 0.2s';
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'DELETE_ITEM', id: item.id }, () => {
        allItems = allItems.filter(i => i.id !== item.id);
        render();
      });
    }, 180);
  });

  li.addEventListener('dblclick', () => {
    navigator.clipboard.writeText(item.text).then(() => showToast('Copied!'));
  });

  return clone;
}

function badgeLabel(type) {
  const map = { text: 'txt', link: 'url', code: 'code', number: 'num', email: 'mail', long: 'long' };
  return map[type] || 'txt';
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString();
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 1800);
}

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  clearSearchBtn.style.display = searchQuery ? 'flex' : 'none';
  render();
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  clearSearchBtn.style.display = 'none';
  searchInput.focus();
  render();
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelector('.filter-btn.active')?.classList.remove('active');
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    render();
  });
});

let clearHold = null;
clearBtn.addEventListener('mousedown', () => {
  clearHold = setTimeout(() => {
    if (confirm('Delete all clipboard history? This cannot be undone.')) {
      chrome.runtime.sendMessage({ type: 'CLEAR_ALL' }, () => {
        allItems = [];
        render();
        showToast('History cleared');
      });
    }
  }, 600);
});
clearBtn.addEventListener('mouseup', () => clearTimeout(clearHold));
clearBtn.addEventListener('mouseleave', () => clearTimeout(clearHold));

exportBtn.addEventListener('click', () => {
  exportModal.style.display = 'flex';
});

closeModalBtn.addEventListener('click', () => {
  exportModal.style.display = 'none';
});

exportModal.addEventListener('click', (e) => {
  if (e.target === exportModal) exportModal.style.display = 'none';
});

document.getElementById('exportJson').addEventListener('click', () => {
  const data = JSON.stringify(allItems, null, 2);
  downloadFile(data, 'clipboard-eternity.json', 'application/json');
  exportModal.style.display = 'none';
  showToast('Exported as JSON');
});

document.getElementById('exportCsv').addEventListener('click', () => {
  const header = 'id,type,text,source,pageTitle,time,favorite,note\n';
  const rows = allItems.map(i => [
    i.id,
    i.type,
    `"${(i.text || '').replace(/"/g, '""')}"`,
    `"${(i.source || '').replace(/"/g, '""')}"`,
    `"${(i.pageTitle || '').replace(/"/g, '""')}"`,
    new Date(i.time).toISOString(),
    i.favorite,
    `"${(i.note || '').replace(/"/g, '""')}"`
  ].join(','));
  downloadFile(header + rows.join('\n'), 'clipboard-eternity.csv', 'text/csv');
  exportModal.style.display = 'none';
  showToast('Exported as CSV');
});

document.getElementById('exportTxt').addEventListener('click', () => {
  const lines = allItems.map((i, idx) =>
    `[${idx + 1}] ${new Date(i.time).toLocaleString()}\n${i.text}\n`
  );
  downloadFile(lines.join('\n---\n\n'), 'clipboard-eternity.txt', 'text/plain');
  exportModal.style.display = 'none';
  showToast('Exported as TXT');
});

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

load();

setInterval(load, 3000);

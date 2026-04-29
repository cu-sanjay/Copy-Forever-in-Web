let lastCopied = '';
let debounceTimer = null;

document.addEventListener('copy', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim() && text !== lastCopied) {
        lastCopied = text;
        chrome.runtime.sendMessage({
          type: 'SAVE_COPY',
          payload: {
            text: text.trim(),
            source: window.location.href,
            title: document.title
          }
        }).catch(() => {});
      }
    } catch (_) {
      const sel = window.getSelection()?.toString();
      if (sel && sel.trim() && sel !== lastCopied) {
        lastCopied = sel;
        chrome.runtime.sendMessage({
          type: 'SAVE_COPY',
          payload: {
            text: sel.trim(),
            source: window.location.href,
            title: document.title
          }
        }).catch(() => {});
      }
    }
  }, 50);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'WRITE_CLIPBOARD') {
    navigator.clipboard.writeText(msg.text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = msg.text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  }
});

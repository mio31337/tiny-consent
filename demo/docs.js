// Docs page: copy buttons, head-code configurator, and the Webflow paste buttons.
(function () {
  const paste = window.TinyConsentPaste;

  // ---------- Generic copy buttons ----------

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
  }

  function flash(button, label) {
    const original = button.dataset.label || button.textContent;
    button.dataset.label = original;
    button.textContent = label;
    button.classList.add('is-done');
    clearTimeout(button._t);
    button._t = setTimeout(() => {
      button.textContent = original;
      button.classList.remove('is-done');
    }, 1600);
  }

  document.querySelectorAll('.doc-copy[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const target = document.querySelector(button.dataset.copy);
      if (!target) return;
      await copyText(target.textContent);
      flash(button, 'Copied');
    });
  });

  // ---------- Head code configurator ----------

  const config = document.getElementById('config');
  const headSnippet = document.getElementById('head-snippet');

  function renderHead() {
    const data = new FormData(config);
    const url = String(data.get('url') || '').trim() || 'https://cdn.example.com/tiny-consent.min.js';
    const mode = data.get('mode') === 'opt-out' ? 'opt-out' : 'opt-in';
    const days = Number(data.get('days')) || 180;
    const block = String(data.get('block') || '').trim();
    const lines = [`<script src="${url}"`, `        data-tc-mode="${mode}"`, `        data-tc-cookie-days="${days}"`];
    if (block) lines.push(`        data-tc-block="${block.replace(/"/g, '')}"`);
    headSnippet.textContent = lines.join('\n') + '></script>';
  }

  config.addEventListener('input', renderHead);
  config.addEventListener('submit', (e) => e.preventDefault());
  renderHead();

  // ---------- Webflow paste ----------

  const copyWebflow = document.getElementById('copy-webflow');
  const copyEmbed = document.getElementById('copy-embed');
  const status = document.getElementById('paste-status');
  let sources = null;

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = 'doc-paste_status' + (kind ? ' is-' + kind : '');
  }

  paste
    .loadSources('./')
    .then((loaded) => {
      sources = loaded;
      copyWebflow.disabled = false;
      copyEmbed.disabled = false;
      const payload = paste.build(sources);
      setStatus(`Ready: ${payload.payload.nodes.length} elements, ${payload.payload.styles.length} classes.`);
    })
    .catch((error) => {
      setStatus('Could not load preview.html: ' + error.message, 'error');
    });

  copyWebflow.addEventListener('click', () => {
    if (!sources) return;
    try {
      const payload = paste.build(sources);
      const bytes = paste.writeWebflowClipboard(payload);
      setStatus(`Copied for Webflow (${Math.round(bytes / 1024)} KB). Select the footer in the Designer and paste.`, 'ok');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });

  copyEmbed.addEventListener('click', async () => {
    if (!sources) return;
    await copyText(paste.buildEmbed(sources));
    setStatus('Copied as HTML. Paste it into a Code Embed element.', 'ok');
  });
})();

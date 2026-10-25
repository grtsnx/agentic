// Browser-only presentation helpers. Model content is always text, never HTML.
// Keep this small Markdown subset dependency-free for the static playground.
export const ANSWER_RENDERER = String.raw`
  function sourceUrl(value) {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : undefined;
    } catch { return undefined; }
  }

  function sourceKey(url) {
    const key = new URL(url.href);
    // Tracking parameters must not create duplicate citations for the same page.
    for (const name of [...key.searchParams.keys()]) {
      if (name.startsWith('utm_')) key.searchParams.delete(name);
    }
    return key.href;
  }

  function sourceLink(label, url) {
    const link = document.createElement('a');
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label;
    return link;
  }

  function renderAnswer(content, text, sources = [], streaming = false) {
    const references = new Map();
    const metadata = new Map();
    for (const source of sources) {
      const url = sourceUrl(source?.url);
      if (url && !metadata.has(sourceKey(url))) metadata.set(sourceKey(url), source);
    }
    function reference(url, label) {
      const key = sourceKey(url);
      if (!references.has(key)) {
        references.set(key, {
          url: url.href,
          title: metadata.get(key)?.title || label || url.hostname,
          domain: url.hostname.replace(/^www\./, ''),
          number: references.size + 1,
        });
      }
      return references.get(key);
    }

    function inline(parent, value) {
      // Match only supported inline syntax. Code wins before links or emphasis.
      const tokens = /\x60([^\x60\n]+)\x60|\[([^\]\n]+)\]\(\s*((?:[^\s()]|\([^\s()]*\))+)\s*\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|(\[[^\]\n]+,\s*chunk\s+\d+\]|【[^】\n]+,\s*chunk\s+\d+】)/gi;
      let offset = 0;
      for (const match of value.matchAll(tokens)) {
        let start = match.index;
        let end = start + match[0].length;
        let node;
        if (match[1] !== undefined) {
          node = document.createElement('code');
          node.textContent = match[1];
        } else if (match[2] !== undefined) {
          const url = sourceUrl(match[3]);
          if (!url) continue;
          const label = match[2];
          const domain = url.hostname.replace(/^www\./, '');
          const isCitation = metadata.has(sourceKey(url)) || label.replace(/^www\./, '') === domain || /^\d+$/.test(label);
          if (isCitation) {
            const source = reference(url, label);
            node = sourceLink(source.number + ' ' + source.domain, url);
            node.className = 'citation-badge';
            node.title = source.title + '\n' + source.domain;
            node.setAttribute('aria-label', 'Source ' + source.number + ': ' + source.title + ' (' + source.domain + '), opens in a new tab');
            // Remove only a wrapper belonging entirely to this citation.
            if (value[start - 1] === '(' && value[end] === ')') { start--; end++; }
          } else {
            node = sourceLink(label, url);
          }
        } else if (match[6] !== undefined) {
          const citation = /^(.*),\s*chunk\s+(\d+)$/i.exec(match[6].slice(1, -1));
          node = workspacePanel.fileCitation(citation[1].trim(), citation[2]);
          if (!node) continue;
        } else {
          node = document.createElement(match[4] !== undefined ? 'strong' : 'em');
          node.textContent = match[4] ?? match[5];
        }
        parent.append(document.createTextNode(value.slice(offset, start)), node);
        offset = end;
      }
      let tail = value.slice(offset);
      // Hold an unfinished link destination until its closing chunk arrives.
      // Never apply this to code blocks or the final/interrupted answer.
      if (streaming) tail = tail.replace(/\(?\[[^\]\n]*\]\([^\n]*$/, '');
      parent.append(document.createTextNode(tail));
    }

    const blocks = [];
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    let paragraph = [];
    let list;
    let code;
    function flushParagraph() {
      if (!paragraph.length) return;
      const node = document.createElement('p');
      inline(node, paragraph.join('\n'));
      blocks.push(node);
      paragraph = [];
    }
    for (const line of lines) {
      if (/^\s*\x60{3}/.test(line)) {
        flushParagraph(); list = undefined;
        if (code) code = undefined;
        else {
          const pre = document.createElement('pre');
          code = document.createElement('code');
          pre.append(code); blocks.push(pre);
        }
      } else if (code) {
        code.textContent += (code.textContent ? '\n' : '') + line;
      } else if (!line.trim()) {
        flushParagraph(); list = undefined;
      } else {
        const heading = /^(#{1,6})\s+(.+)$/.exec(line);
        const item = /^\s*(?:[-*+]\s+|(\d+)[.)]\s+)(.+)$/.exec(line);
        if (heading) {
          flushParagraph(); list = undefined;
          const node = document.createElement('h' + Math.min(heading[1].length + 1, 6));
          inline(node, heading[2]); blocks.push(node);
        } else if (item) {
          flushParagraph();
          const kind = item[1] ? 'ol' : 'ul';
          if (!list || list.tagName.toLowerCase() !== kind) {
            list = document.createElement(kind);
            if (item[1]) list.setAttribute('start', item[1]);
            blocks.push(list);
          }
          const node = document.createElement('li'); inline(node, item[2]); list.append(node);
        } else {
          list = undefined; paragraph.push(line);
        }
      }
    }
    flushParagraph();
    content.replaceChildren(...blocks);
    for (const [key, source] of metadata) reference(new URL(key), source.title);
    return [...references.values()];
  }
`;

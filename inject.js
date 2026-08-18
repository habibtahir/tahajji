(function() {
  if (window.hasRun) return true;
  window.hasRun = true;

  const containerTags = ['DIV','SPAN','P','B','I','U','STRONG','LI','EM','TD','A','H1','H2','H3','H4','H5','H6'];

  const RTL_CHAR = /[\u0600-\u06FF\u0750-\u077F\u0870-\u089F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const LTR_CHAR = /[A-Za-z]/;

  function hasRTL(str) {
    return RTL_CHAR.test(str);
  }

  // A "single line" of Arabic/Urdu: contains RTL script and no Latin letters
  // at all. Lines that mix English with Arabic/Urdu (even a single English
  // word, or a lone Arabic ligature sitting inside an English sentence) are
  // left completely untouched -- no attempt is made to surgically extract
  // just the RTL portion; if a text node isn't entirely Arabic/Urdu, the font
  // is never applied to any part of it.
  function isPureRTLLine(str) {
    return RTL_CHAR.test(str) && !LTR_CHAR.test(str);
  }

  function applyScaling(node, data) {
    if (!data.fontScale) return;
    node.setAttribute('data-urtext-fontscale', data.fontScale);
    node.setAttribute('data-urtext-linescale', data.lineScale);
    const xStyle = (node.getAttribute('style') || '').replace(/;urt;.+;urt;/, '');

    // Percentages must always be computed from the element's true, unscaled
    // size. Caching it the first time (rather than re-reading
    // getComputedStyle() on every adjustment) avoids a redundant
    // layout-forcing call on repeat +/- clicks, and a compounding risk if
    // anything else ever touches this element's inline style concurrently.
    let baseSize = node.getAttribute('data-urtext-basefontsize');
    let baseHeight = node.getAttribute('data-urtext-baselineheight');
    if (baseSize === null) {
      baseSize = parseFloat(window.getComputedStyle(node).fontSize);
      baseHeight = parseFloat(window.getComputedStyle(node).lineHeight);
      node.setAttribute('data-urtext-basefontsize', baseSize);
      node.setAttribute('data-urtext-baselineheight', baseHeight);
    } else {
      baseSize = parseFloat(baseSize);
      baseHeight = parseFloat(baseHeight);
    }

    const nSize = Math.round(data.fontScale / 100 * baseSize);
    const nHeight = Math.round(data.lineScale / 100 * baseHeight);
    node.setAttribute('style', xStyle + ';urt;font-size:' + nSize + 'px;line-height:' + nHeight + 'px;urt;');
  }

  function getParent(node) {
    let divParent = node.parentElement;
    if (divParent == undefined || !containerTags.includes(node.parentElement.tagName))
      divParent = node; //self
    return divParent;
  }

  // Aligns/styles exactly the node passed in -- never an ancestor further up.
  // A previous version walked one level up from the node being styled to find
  // "the nearest container" for text-align, on the assumption the immediate
  // parent was just a plain inline wrapper. In practice that ancestor often
  // turns out to be shared with unrelated content (an English caption sitting
  // in an adjacent sibling <p>, for example), so marking it bled the
  // alignment change onto text that has nothing to do with the Urdu/Arabic
  // line. Only ever touching the exact node here means the only way anything
  // shared gets marked is if the caller (applyToTextNode) explicitly decided
  // it was safe to style that shared node directly.
  function setStyle(node, data) {
    node.classList.add("urtext-parent");
    node.classList.add("urtext-self");
    node.classList.add("urtext-font-" + data.font);
    applyScaling(node, data);
  }

  // True if parent has other direct children (text or elements, ignoring
  // already-styled urtext-self ones) with non-empty, non-RTL content -- e.g.
  // <br>-separated lines that mix an English line and an Urdu/Arabic line
  // under one shared element, or plain sibling text alongside this text node.
  // Styling that shared parent directly would bleed onto that unrelated
  // content too.
  function hasForeignSibling(parent, exceptNode) {
    return Array.prototype.some.call(parent.childNodes, sibling => {
      if (sibling === exceptNode) return false;
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.classList.contains('urtext-self')) return false;
      if (sibling.nodeType !== Node.TEXT_NODE && sibling.nodeType !== Node.ELEMENT_NODE) return false;
      const text = sibling.textContent;
      return text.trim() !== '' && !hasRTL(text);
    });
  }

  // Called only for text nodes that are already confirmed pure Arabic/Urdu
  // (isPureRTLLine). If the text node's parent isn't also shared with
  // unrelated non-RTL content, styling the parent directly is enough (and
  // gives proper block-level right-alignment for the common case of a
  // standalone Urdu paragraph). Otherwise the text node is wrapped in its own
  // dedicated span, so the styling never reaches a container that also holds
  // unrelated sibling lines.
  function applyToTextNode(textNode, data) {
    const parent = textNode.parentNode;
    if (!hasForeignSibling(parent, textNode)) {
      setStyle(parent, data);
      return;
    }

    const span = document.createElement('span');
    span.textContent = textNode.textContent;
    span.setAttribute('data-urtext-wrap', '');
    parent.replaceChild(span, textNode);
    setStyle(span, data);
  }

  function recursiveApply(node, data) {
    if (node.nodeName == '#text' && isPureRTLLine(node.textContent)) {
      applyToTextNode(node, data);
    } else if ((node.nodeName == 'INPUT' || node.nodeName == 'TEXTAREA') && node.type !== 'hidden') {
      isPureRTLLine(node.value) ? setStyle(node, data) : fontClear(node);
    } else if (node == document || (typeof node.className == 'string' && node.className.search('urtext-self') == -1)) {
      // some nodes like svg have object className instead of string
      // preventing to run on newly created span
      // snapshot childNodes first: applyToTextNode() can replace a text node with
      // a new span mid-loop, which would corrupt a live NodeList iteration
      Array.prototype.slice.call(node.childNodes).forEach(n => recursiveApply(n, data));
    }
  }

  function switchFontAll(node, font) {
    node.querySelectorAll("[class*='urtext-font-']").forEach(element => {
      // snapshot first: removing classes while iterating a live classList can
      // skip entries
      Array.from(element.classList).forEach(c => {
        if (c.indexOf('urtext-font-') === 0) element.classList.remove(c);
      });
      element.classList.add('urtext-font-' + font);
    });
  }

  function switchScalingAll(node, data) {
    node.querySelectorAll("[class*='urtext-font-']").forEach(element => {
      applyScaling(element, data);
    });
  }

  function sameFont(aNode, font) {
    let same = false;
    aNode.classList.forEach(c => { if (c == 'urtext-font-' + font) same = true; });
    return same;
  }

  function sameScaling(aNode, data) {
    const fontScale = parseInt(aNode.getAttribute('data-urtext-fontscale') || 0);
    const lineScale = parseInt(aNode.getAttribute('data-urtext-linescale') || 0);
    return fontScale === data.fontScale && lineScale === data.lineScale;
  }

  function fontApply(node, data) {
    // Always walk first to style any not-yet-styled RTL text. recursiveApply
    // skips elements already marked urtext-self, so repeating this on an
    // already-processed page is cheap: it stops descending as soon as it hits a
    // styled node, it does not re-split or re-process it. Doing ONLY the
    // "already styled somewhere in here" quick-check below (as before) meant
    // that any call whose subtree already contained a single styled element
    // would skip the walk entirely -- silently leaving newly-added sibling or
    // cousin text unstyled whenever a site's JS framework re-parented a
    // container holding both old (already-styled) and new (unstyled) content
    // together, e.g. a social feed loading more of a post asynchronously.
    recursiveApply(node, data);

    const exsNode = node.querySelector("[class*='urtext-font-']");
    if (exsNode) {
      if (!sameFont(exsNode, data.font)) switchFontAll(node, data.font);
      if (!sameScaling(exsNode, data)) switchScalingAll(node, data);
    }
  }

  function fontClear(node) {
    // in case of input & textarea change to LTR or empty, we need parent of 'urtext-parent'
    if (node.childNodes.length == 0) node = getParent(node).parentNode;
    if (node == undefined) return;
    node.querySelectorAll("[class*='urtext-']").forEach(el => {
      el.className.split(' ').forEach(c => { if (c.search("urtext-") > -1) el.classList.remove(c); });
      const xStyle = el.getAttribute('style') || '';
      el.setAttribute('style', xStyle.replace(/;urt;.+;urt;/, ''));
      el.removeAttribute('data-urtext-fontscale');
      el.removeAttribute('data-urtext-linescale');
      el.removeAttribute('data-urtext-basefontsize');
      el.removeAttribute('data-urtext-baselineheight');

      // Undo the synthetic wrapper spans applyToTextNode() creates for RTL
      // lines -- restores the original single text node instead of leaving
      // empty, class-less <span> elements permanently splitting up the
      // page's text after the extension is disabled.
      if (el.hasAttribute('data-urtext-wrap')) {
        const parent = el.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent), el);
          parent.normalize();
        }
      }
    });
  }

  async function actionApply(node) {
    // 1. On re-installation, this script may get orphaned and will throw an error
    //    on the storage request; checking runtime avoids a fatal error.
    // 2. Check if node isn't an html element (e.g. ajax loaded text, SVG)
    if (chrome.runtime?.id == undefined ||
      ['IMG', 'IFRAME', 'SCRIPT', 'LINK', 'STYLE'].indexOf(node.nodeName) > -1 ||
      typeof node.querySelector == 'undefined') return;
    if (node.nodeName == '#document') node = document.body;
    const data = await chrome.storage.sync.get(['active', 'font', 'fontScale', 'lineScale']);
    data.active ? fontApply(node, data) : fontClear(node);
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message == 'urtextApply') {
      actionApply(document).then(() => sendResponse({ success: true }));
      return true; // keep the message channel open for the async response
    }
  });

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => actionApply(node));
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.querySelectorAll("input,textarea").forEach(input => {
    input.addEventListener('input', event => {
      actionApply(event.target);
    });
  });

  // final call
  actionApply(document.body);

})();

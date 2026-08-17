(function() {
  if (window.hasRun) return true;
  window.hasRun = true;

  const containerTags = ['DIV','SPAN','P','B','I','U','STRONG','LI','EM','TD','A','H1','H2','H3','H4','H5','H6'];

  const RTL_CHAR = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const LTR_CHAR = /[A-Za-z]/;

  function hasRTL(str) {
    return RTL_CHAR.test(str);
  }

  // Splits text into runs of consecutive RTL vs LTR letters, so the font/direction
  // change can be applied only to the Urdu portion of mixed-language text instead
  // of the whole containing element. Characters belonging to neither script
  // (spaces, digits, punctuation) stick to whichever run they're adjacent to.
  function splitRuns(text) {
    const runs = [];
    let buf = '', bufIsRTL = null;
    for (const ch of text) {
      const isRtlChar = RTL_CHAR.test(ch);
      const isLtrChar = !isRtlChar && LTR_CHAR.test(ch);
      if (!isRtlChar && !isLtrChar) { buf += ch; continue; }
      if (bufIsRTL === null || isRtlChar === bufIsRTL) {
        bufIsRTL = isRtlChar;
        buf += ch;
      } else {
        runs.push({ text: buf, rtl: bufIsRTL });
        buf = ch;
        bufIsRTL = isRtlChar;
      }
    }
    if (buf) runs.push({ text: buf, rtl: bufIsRTL === true });
    return runs;
  }

  function applyScaling(node, data) {
    if (!data.fontScale) return;
    node.setAttribute('data-urtext-fontscale', data.fontScale);
    node.setAttribute('data-urtext-linescale', data.lineScale);
    let xStyle = node.getAttribute('style') || '';
    node.setAttribute('style', xStyle.replace(/;urt;.+;urt;/, ''));

    const xSize = parseFloat(window.getComputedStyle(node).fontSize);
    const xHeight = parseFloat(window.getComputedStyle(node).lineHeight);

    const nSize = Math.round(data.fontScale / 100 * xSize);
    const nHeight = Math.round(data.lineScale / 100 * xHeight);
    const urtStyle = ';urt;font-size:' + nSize + 'px;line-height:' + nHeight + 'px;urt;';

    xStyle = node.getAttribute('style');
    node.setAttribute('style', xStyle + urtStyle);
  }

  function getParent(node) {
    let divParent = node.parentElement;
    if (divParent == undefined || !containerTags.includes(node.parentElement.tagName))
      divParent = node; //self
    return divParent;
  }

  function setStyle(node, data) {
    // setting text-align in nearest parent
    const divParent = getParent(node);
    divParent.classList.add("urtext-parent");
    node.classList.add("urtext-self");
    node.classList.add("urtext-font-" + data.font);
    applyScaling(node, data);
  }

  // Applies the font/direction only to the RTL run(s) of a text node. If the whole
  // node is RTL, styling its parent (the previous behaviour) is enough and avoids
  // extra DOM nodes. If it's mixed (e.g. Urdu text with English words inline),
  // the node is split into per-run spans/text so the English portion keeps the
  // page's own font and direction instead of being forced into the Urdu font.
  function applyToTextNode(textNode, data) {
    const runs = splitRuns(textNode.textContent);
    if (runs.length <= 1) {
      setStyle(textNode.parentNode, data);
      return;
    }

    const frag = document.createDocumentFragment();
    runs.forEach(run => {
      if (run.rtl) {
        const span = document.createElement('span');
        span.textContent = run.text;
        frag.appendChild(span);
        setStyle(span, data);
      } else {
        frag.appendChild(document.createTextNode(run.text));
      }
    });
    textNode.parentNode.replaceChild(frag, textNode);
  }

  function recursiveApply(node, data) {
    if (node.nodeName == '#text' && hasRTL(node.textContent)) {
      applyToTextNode(node, data);
    } else if ((node.nodeName == 'INPUT' || node.nodeName == 'TEXTAREA') && node.type !== 'hidden') {
      hasRTL(node.value) ? setStyle(node, data) : fontClear(node);
    } else if (node == document || (typeof node.className == 'string' && node.className.search('urtext-self') == -1)) {
      // some nodes like svg have object className instead of string
      // preventing to run on newly created span
      // snapshot childNodes first: applyToTextNode() can replace a text node with
      // several nodes mid-loop, which would corrupt a live NodeList iteration
      Array.prototype.slice.call(node.childNodes).forEach(n => recursiveApply(n, data));
    }
  }

  function switchFontAll(node, font) {
    node.querySelectorAll("[class*='urtext-font-']").forEach(element => {
      element.classList.forEach(c => {
        if (c.search("urtext-font") > -1) {
          element.classList.remove(c);
          element.classList.add("urtext-font-" + font);
        }
      });
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
    const exsNode = node.querySelector("[class*='urtext-font-']");
    // If an element found with style, check its font before switching, otherwise apply first time
    if (exsNode) {
      if (!sameFont(exsNode, data.font)) switchFontAll(node, data.font);
      if (!sameScaling(exsNode, data)) switchScalingAll(node, data);
    } else { recursiveApply(node, data); }
  }

  function fontClear(node) {
    // in case of input & textarea change to LTR or empty, we need parent of 'urtext-parent'
    if (node.childNodes.length == 0) node = getParent(node).parentNode;
    if (node == undefined) return;
    node.querySelectorAll("[class*='urtext-']").forEach(node => {
      node.className.split(' ').forEach(c => { if (c.search("urtext-") > -1) node.classList.remove(c); });
      const xStyle = node.getAttribute('style') || '';
      node.setAttribute('style', xStyle.replace(/;urt;.+;urt;/, ''));
      node.removeAttribute('data-urtext-fontscale');
      node.removeAttribute('data-urtext-linescale');
    });
  }

  async function actionApply(node) {
    // 1. On re-installation, this script may get orphaned and will throw an error
    //    on the storage request; checking runtime avoids a fatal error.
    // 2. Check if node isn't an html element (e.g. ajax loaded text, SVG)
    if (chrome.runtime?.id == undefined ||
      ['IMG', 'IFRAME', 'SCRIPT', 'LINK'].indexOf(node.nodeName) > -1 ||
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

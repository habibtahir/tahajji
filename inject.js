(function() {
  if (window.hasRun) return true;
  window.hasRun = true;

  const containerTags = ['DIV','SPAN','P','B','I','U','STRONG','LI','EM','TD','A','H1','H2','H3','H4','H5','H6'];

  const RTL_CHAR = /[\u0600-\u06FF\u0750-\u077F\u0870-\u089F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const LTR_CHAR = /[A-Za-z]/;

  // Letters that exist in Urdu (and Persian) but not in standard Arabic
  // orthography: retroflex/aspirated consonants (Tteh, Ddal, Rreh, Heh
  // Doachashmee), letters absent from Arabic entirely (Peh, Tcheh, Jeh, Gaf),
  // the nasalization mark (Noon Ghunna), Yeh Barree, and Farsi Yeh (vs.
  // Arabic's Yeh). Presence of any of these is a strong, reliable Urdu signal.
  const URDU_ONLY_CHAR = /[\u067E\u0686\u0698\u06A9\u06AF\u0679\u0688\u0691\u06BA\u06BE\u06D2\u06D3\u06CC]/;

  // Common Arabic grammar words (relative pronouns, demonstratives, prepositions,
  // particles) that Urdu doesn't use -- Urdu's equivalents come from Persian/Hindi
  // roots (yeh/woh/jo/kab/jahan/ab), not Arabic grammar particles. Matched as
  // whole words only (lookaround boundaries against any Arabic-script letter),
  // so e.g. Urdu's "لیکن" (has an extra Yeh) never matches Arabic's "لكن".
  const ARABIC_WORD = /(?<![\u0600-\u06FF])(?:\u0627\u0644\u0630\u064A|\u0627\u0644\u062A\u064A|\u0627\u0644\u0630\u064A\u0646|\u0647\u0630\u0627|\u0647\u0630\u0647|\u0630\u0644\u0643|\u0639\u0644\u0649|\u0639\u0646\u062F\u0645\u0627|\u0628\u064A\u0646\u0645\u0627|\u0643\u0630\u0644\u0643|\u0647\u0646\u0627\u0643|\u0627\u0644\u0622\u0646|\u0641\u064A|\u0645\u0646|\u0625\u0644\u0649|\u0627\u0644\u0649|\u0639\u0646|\u0645\u0639|\u0639\u0646\u062F|\u0642\u0627\u0644|\u0642\u0627\u0644\u062A|\u0643\u0627\u0646|\u0644\u064A\u0633|\u0633\u0648\u0641|\u0642\u062F|\u0644\u0645|\u0644\u0646|\u0645\u0627|\u0644\u0627|\u0643\u064A\u0641|\u0645\u062A\u0649|\u0644\u0645\u0627\u0630\u0627|\u0623\u064A\u0646|\u062D\u064A\u062B|\u0628\u0639\u062F|\u0642\u0628\u0644|\u062C\u0645\u064A\u0639|\u0623\u064A\u0636\u0627|\u0647\u0624\u0644\u0627\u0621|\u0625\u0646|\u0623\u0646|\u0644\u0643\u0646)(?![\u0600-\u06FF])/;

  // Both fonts are fixed and not user-selectable: Urdu is the default for any
  // Arabic-script text, and only overridden to the Arabic font when Arabic is
  // positively detected.
  const URDU_FONT = 'jameel-noori-nastaleeq';
  const ARABIC_FONT = 'al-majeed-quranic';

  // Script-based, not language-based: RTL_CHAR covers the Unicode Arabic-script
  // blocks, so it matches Arabic and Urdu (and Persian/other Arabic-script text)
  // alike without needing to tell those languages apart.
  function hasRTL(str) {
    return RTL_CHAR.test(str);
  }

  // Urdu is the default. It's only classified as Arabic when there's a positive
  // Arabic signal (a common Arabic-only grammar word) and no Urdu-only letter.
  // This is a heuristic, not true language detection: a short Arabic phrase with
  // no grammar word in it (e.g. a name, or a short Quranic phrase quoted as-is,
  // which is extremely common inside otherwise-Urdu religious text anyway) falls
  // back to Urdu rather than Arabic.
  function classifyScript(str) {
    if (URDU_ONLY_CHAR.test(str)) return 'ur';
    if (ARABIC_WORD.test(str)) return 'ar';
    return 'ur';
  }

  function fontForScript(script) {
    return script === 'ar' ? ARABIC_FONT : URDU_FONT;
  }

  // Splits text into runs of consecutive RTL (Arabic/Urdu) vs LTR (Latin/English)
  // letters, so the font/direction change can be applied only to the Arabic-script
  // portion of mixed-language text instead of the whole containing element.
  // Characters belonging to neither script (spaces, digits, punctuation) stick to
  // whichever run they're adjacent to.
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

  function setStyle(node, data, script) {
    // setting text-align in nearest parent
    const divParent = getParent(node);
    divParent.classList.add("urtext-parent");
    node.classList.add("urtext-self");
    node.setAttribute('data-urtext-script', script);
    node.classList.add("urtext-font-" + fontForScript(script));
    applyScaling(node, data);
  }

  // Applies the font/direction only to the RTL run(s) of a text node, and picks
  // the Urdu or Arabic font per run via classifyScript(). If the whole node is a
  // single run, styling its parent (the previous behaviour) is enough and avoids
  // extra DOM nodes. If it's mixed (e.g. Arabic or Urdu text with English words
  // inline), the node is split into per-run spans/text so the English portion
  // keeps the page's own font and direction instead of being forced into the
  // Arabic/Urdu font.
  function applyToTextNode(textNode, data) {
    const runs = splitRuns(textNode.textContent);
    if (runs.length <= 1) {
      setStyle(textNode.parentNode, data, classifyScript(textNode.textContent));
      return;
    }

    const frag = document.createDocumentFragment();
    runs.forEach(run => {
      if (run.rtl) {
        const span = document.createElement('span');
        span.textContent = run.text;
        frag.appendChild(span);
        setStyle(span, data, classifyScript(run.text));
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
      hasRTL(node.value) ? setStyle(node, data, classifyScript(node.value)) : fontClear(node);
    } else if (node == document || (typeof node.className == 'string' && node.className.search('urtext-self') == -1)) {
      // some nodes like svg have object className instead of string
      // preventing to run on newly created span
      // snapshot childNodes first: applyToTextNode() can replace a text node with
      // several nodes mid-loop, which would corrupt a live NodeList iteration
      Array.prototype.slice.call(node.childNodes).forEach(n => recursiveApply(n, data));
    }
  }

  // Re-applies the correct font to every already-styled element under node, per
  // each element's own recorded script (data-urtext-script). Since font choice is
  // now fully deterministic from script, this is mostly defensive/idempotent, but
  // cheap enough to run unconditionally.
  function switchFontAll(node) {
    node.querySelectorAll("[class*='urtext-font-']").forEach(element => {
      const script = element.getAttribute('data-urtext-script') || 'ur';
      const font = fontForScript(script);
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

  function sameScaling(aNode, data) {
    const fontScale = parseInt(aNode.getAttribute('data-urtext-fontscale') || 0);
    const lineScale = parseInt(aNode.getAttribute('data-urtext-linescale') || 0);
    return fontScale === data.fontScale && lineScale === data.lineScale;
  }

  function fontApply(node, data) {
    const exsNode = node.querySelector("[class*='urtext-font-']");
    // If styled elements already exist, just re-verify/correct their fonts and
    // scaling (cheap) instead of re-walking and re-splitting the whole subtree.
    if (exsNode) {
      switchFontAll(node);
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
      node.removeAttribute('data-urtext-script');
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
    const data = await chrome.storage.sync.get(['active', 'fontScale', 'lineScale']);
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

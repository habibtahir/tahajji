(function() {
	if(window.hasRun) return true;
  window.hasRun = true;

  var containerTags = ['DIV','SPAN','P','B','I','U','STRONG','LI','EM','TD','A','H1','H2','H3','H4','H5','H6'];

  // Arabic-script Unicode blocks, covering Urdu as well as Arabic/Persian text.
  // The previous check only tested for 6 hardcoded Urdu letters (out of ~40),
  // so it missed most Urdu words entirely.
  var RTL_CHAR = /[\u0600-\u06FF\u0750-\u077F\u0870-\u089F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  var LTR_CHAR = /[A-Za-z]/;

	function isRTL(str){
	  return RTL_CHAR.test(str);
	};

	// A "single line" of Urdu/Arabic: contains RTL script and no Latin letters
	// at all. A line that mixes English with Urdu/Arabic is left completely
	// untouched, rather than forcing the Urdu font/direction onto the whole
	// line (which previously affected the English words too -- see setStyle()).
	function isPureRTLLine(str){
	  return RTL_CHAR.test(str) && !LTR_CHAR.test(str);
	}

	function applyScaling(node,data){
		if(!data.fontScale) return;
		node.setAttribute('data-urtext-fontscale', data.fontScale);
		node.setAttribute('data-urtext-linescale', data.lineScale);
		var xStyle = (node.getAttribute('style') || '').replace(/;urt;.+;urt;/, '');

		// Percentages must always be computed from the element's true, unscaled
		// size, so cache it the first time rather than re-reading
		// getComputedStyle() (a layout-forcing call) on every adjustment.
		var baseSize = node.getAttribute('data-urtext-basefontsize');
		var baseHeight = node.getAttribute('data-urtext-baselineheight');
		if(baseSize === null){
			baseSize = parseFloat(window.getComputedStyle(node).fontSize);
			baseHeight = parseFloat(window.getComputedStyle(node).lineHeight);
			node.setAttribute('data-urtext-basefontsize', baseSize);
			node.setAttribute('data-urtext-baselineheight', baseHeight);
		}else{
			baseSize = parseFloat(baseSize);
			baseHeight = parseFloat(baseHeight);
		}

  	var nSize = Math.round(data.fontScale/100 * baseSize);
  	var nHeight = Math.round(data.lineScale/100 * baseHeight);
  	node.setAttribute('style', xStyle+';urt;font-size:'+nSize+'px;line-height:'+nHeight+'px;urt;');
	}

	function getParent(node){
		var divParent = node.parentElement;
		if(divParent == undefined || !containerTags.includes(node.parentElement.tagName))
			divParent = node; //self
		return divParent;
	}

	// Styles exactly the node passed in -- never an ancestor further up.
	// Previously this walked one level up from the node being styled (via
	// getParent()) to set text-align, on the assumption the immediate parent
	// was just a plain wrapper. In practice that ancestor is often shared with
	// unrelated content -- e.g. an English caption in an adjacent <p>, or an
	// English line separated by <br> under the same container as an Urdu line
	// -- so marking it bled direction/font/alignment onto text that has
	// nothing to do with the Urdu/Arabic line being styled.
	function setStyle(node,data){
	  node.classList.add("urtext-self");
	  node.classList.add("urtext-font-"+data.font);
	  node.classList.add("urtext-parent");
	  applyScaling(node,data);
	}

	// True if parent has other direct children (text or elements, ignoring
	// already-styled urtext-self ones) with non-empty, non-RTL content -- e.g.
	// a sibling English text node or element sharing this parent. Styling the
	// parent directly in that case would bleed onto that unrelated content.
	function hasForeignSibling(parent, exceptNode){
		return Array.prototype.some.call(parent.childNodes, function(sibling){
			if(sibling === exceptNode) return false;
			if(sibling.nodeType === Node.ELEMENT_NODE && sibling.classList.contains('urtext-self')) return false;
			if(sibling.nodeType !== Node.TEXT_NODE && sibling.nodeType !== Node.ELEMENT_NODE) return false;
			var text = sibling.textContent;
			return text.trim() !== '' && !isRTL(text);
		});
	}

	// Called only for text nodes already confirmed pure Urdu/Arabic
	// (isPureRTLLine). If the parent isn't also shared with unrelated non-RTL
	// content, styling it directly is enough (and gives proper block-level
	// right-alignment for a standalone Urdu paragraph). Otherwise the text
	// node is wrapped in its own dedicated span, so the styling never reaches
	// a container that also holds unrelated sibling content.
	function applyToTextNode(textNode, data){
		var parent = textNode.parentNode;
		if(!hasForeignSibling(parent, textNode)){
			setStyle(parent, data);
			return;
		}
		var span = document.createElement('span');
		span.textContent = textNode.textContent;
		span.setAttribute('data-urtext-wrap', '');
		parent.replaceChild(span, textNode);
		setStyle(span, data);
	}

	function recursiveApply(node,data){
		if(node.nodeName == '#text' && isPureRTLLine(node.textContent)){
			applyToTextNode(node,data);
		}else if((node.nodeName == 'INPUT' || node.nodeName == 'TEXTAREA') && node.type !== 'hidden'){
			isPureRTLLine(node.value) ? setStyle(node,data) : fontClear(node);
		}else if(node == document || (typeof node.className == 'string' && node.className.search('urtext-self') == -1)){
			// some nodes like svg have object className instead of string
			// preventing to run on newly created span
			// snapshot childNodes first: applyToTextNode() can replace a text node
			// with a new span mid-loop, which would corrupt a live NodeList
			// iteration ([].forEach.call() on a live childNodes list)
			Array.prototype.slice.call(node.childNodes).forEach(function(n){ recursiveApply(n,data); });
		}
	}

	function switchFontAll(node,font){
		node.querySelectorAll("[class*='urtext-font-']").forEach(element => {
			// snapshot first: removing classes while iterating a live classList
			// can skip entries
			Array.prototype.slice.call(element.classList).forEach(c => {
				if(c.indexOf('urtext-font-') === 0) element.classList.remove(c);
			});
			element.classList.add("urtext-font-"+font);
		});
	}

	function switchScalingAll(node,data){
		node.querySelectorAll("[class*='urtext-font-']").forEach(element => {
	  	applyScaling(element, data);
		});
	}

	function sameFont(aNode,font){
		var same = false;
		aNode.classList.forEach(c => { if(c == 'urtext-font-'+font) same = true; });
		return same;
	}

	function sameScaling(aNode,data){
		let fontScale = parseInt(aNode.getAttribute('data-urtext-fontscale') || 0);
		let lineScale = parseInt(aNode.getAttribute('data-urtext-linescale') || 0);
		return fontScale === data.fontScale && lineScale === data.lineScale;
	}

	function fontApply(node,data){
		// Always walk first to style any not-yet-styled RTL text. recursiveApply
		// skips elements already marked urtext-self, so repeating this on an
		// already-processed page is cheap: it stops descending as soon as it
		// hits a styled node, it does not re-process it. Previously this only
		// ran the walk when NO styled element existed anywhere in node -- if a
		// subtree already contained a single styled element, the whole walk was
		// skipped in favor of the "quick check" below, which only touches
		// elements that already have a urtext-font- class. Any newly-added text
		// sitting alongside already-styled content (e.g. a site's JS framework
		// re-parenting a container that mixes old, already-processed content
		// with new, unstyled content -- common on sites that load/expand posts
		// progressively) was silently left with no font applied, forever, since
		// every later reapply hit the same shortcut and never walked it.
		recursiveApply(node, data);

		let exsNode = node.querySelector("[class*='urtext-font-']");
		if(exsNode){
			if(!sameFont(exsNode,data.font)) switchFontAll(node,data.font);
			if(!sameScaling(exsNode,data)) switchScalingAll(node,data);
		}
	}

	function fontClear(node){
		// in case of input & textarea change to LTR or empty, we need parent of 'urtext-parent'
		if(node.childNodes.length == 0) node = getParent(node).parentNode;
		if(node == undefined) return;
		node.querySelectorAll("[class*='urtext-']").forEach(el => {
	  	el.className.split(' ').forEach(c => { if(c.search("urtext-") > -1) el.classList.remove(c); });
	  	let xStyle = el.getAttribute('style') || '';
	  	el.setAttribute('style', xStyle.replace(/;urt;.+;urt;/, ''));
	  	el.removeAttribute('data-urtext-fontscale');
	  	el.removeAttribute('data-urtext-linescale');
	  	el.removeAttribute('data-urtext-basefontsize');
	  	el.removeAttribute('data-urtext-baselineheight');

	  	// Undo the synthetic wrapper spans applyToTextNode() creates for RTL
	  	// lines -- restores the original single text node instead of leaving
	  	// empty, class-less <span> elements permanently splitting up the
	  	// page's text after the extension is disabled.
	  	if(el.hasAttribute('data-urtext-wrap')){
	  		var parent = el.parentNode;
	  		if(parent){
	  			parent.replaceChild(document.createTextNode(el.textContent), el);
	  			parent.normalize();
	  		}
	  	}
		});
	}

	function actionApply(node, callback){
		// 1. On re-installation, this script may go orphan and will throw error
		// 		on storage request, checking runtime will save fatal error.
		// 2.	Check if node isn't an html element (e.g. ajax loaded text, SVG)
		// 3.	<style> content is raw CSS text, not page text -- if it ever
		//		contained an Arabic-script character, splitting it into <span>s
		//		would corrupt the stylesheet.
		if(chrome.runtime == undefined || chrome.runtime.id == undefined ||
			['IMG','IFRAME','SCRIPT','LINK','STYLE'].indexOf(node.nodeName) > -1 ||
			typeof node.querySelector == 'undefined') { if(callback) callback(); return; }
		if(node.nodeName == '#document') node = document.body;
		chrome.storage.sync.get(['active','font','fontScale','lineScale'], function(data){
			data.active ? fontApply(node, data) : fontClear(node);
			if(callback) callback();
		});
	}

	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
		if(request.message == 'urtextApply'){
			// Wait for actionApply's async storage read before responding --
			// previously sendResponse() fired immediately, before the font was
			// actually (re-)applied.
			actionApply(document, function(){ sendResponse({success: true}); });
			return true; // keep the message channel open for the async response
		}
	});

	var observer = new MutationObserver(function(mutations) {
		mutations.forEach(function(mutation) {
			for (var i = 0; i < mutation.addedNodes.length; i++)
				actionApply(mutation.addedNodes[i]);
		})
	});
	observer.observe(document.documentElement, { childList: true, subtree: true });

  document.querySelectorAll("input,textarea").forEach(input => {
		input.addEventListener('input', function(event){
	    actionApply(event.target);
	  });
	});

  // final call
  actionApply(document.body);

})();

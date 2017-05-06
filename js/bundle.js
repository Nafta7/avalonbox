(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){

/* **********************************************
     Begin prism-core.js
********************************************** */

var _self = (typeof window !== 'undefined')
	? window   // if in browser
	: (
		(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)
		? self // if in worker
		: {}   // if in node js
	);

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 * MIT license http://www.opensource.org/licenses/mit-license.php/
 * @author Lea Verou http://lea.verou.me
 */

var Prism = (function(){

// Private helper vars
var lang = /\blang(?:uage)?-(\w+)\b/i;
var uniqueId = 0;

var _ = _self.Prism = {
	util: {
		encode: function (tokens) {
			if (tokens instanceof Token) {
				return new Token(tokens.type, _.util.encode(tokens.content), tokens.alias);
			} else if (_.util.type(tokens) === 'Array') {
				return tokens.map(_.util.encode);
			} else {
				return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
			}
		},

		type: function (o) {
			return Object.prototype.toString.call(o).match(/\[object (\w+)\]/)[1];
		},

		objId: function (obj) {
			if (!obj['__id']) {
				Object.defineProperty(obj, '__id', { value: ++uniqueId });
			}
			return obj['__id'];
		},

		// Deep clone a language definition (e.g. to extend it)
		clone: function (o) {
			var type = _.util.type(o);

			switch (type) {
				case 'Object':
					var clone = {};

					for (var key in o) {
						if (o.hasOwnProperty(key)) {
							clone[key] = _.util.clone(o[key]);
						}
					}

					return clone;

				case 'Array':
					// Check for existence for IE8
					return o.map && o.map(function(v) { return _.util.clone(v); });
			}

			return o;
		}
	},

	languages: {
		extend: function (id, redef) {
			var lang = _.util.clone(_.languages[id]);

			for (var key in redef) {
				lang[key] = redef[key];
			}

			return lang;
		},

		/**
		 * Insert a token before another token in a language literal
		 * As this needs to recreate the object (we cannot actually insert before keys in object literals),
		 * we cannot just provide an object, we need anobject and a key.
		 * @param inside The key (or language id) of the parent
		 * @param before The key to insert before. If not provided, the function appends instead.
		 * @param insert Object with the key/value pairs to insert
		 * @param root The object that contains `inside`. If equal to Prism.languages, it can be omitted.
		 */
		insertBefore: function (inside, before, insert, root) {
			root = root || _.languages;
			var grammar = root[inside];

			if (arguments.length == 2) {
				insert = arguments[1];

				for (var newToken in insert) {
					if (insert.hasOwnProperty(newToken)) {
						grammar[newToken] = insert[newToken];
					}
				}

				return grammar;
			}

			var ret = {};

			for (var token in grammar) {

				if (grammar.hasOwnProperty(token)) {

					if (token == before) {

						for (var newToken in insert) {

							if (insert.hasOwnProperty(newToken)) {
								ret[newToken] = insert[newToken];
							}
						}
					}

					ret[token] = grammar[token];
				}
			}

			// Update references in other language definitions
			_.languages.DFS(_.languages, function(key, value) {
				if (value === root[inside] && key != inside) {
					this[key] = ret;
				}
			});

			return root[inside] = ret;
		},

		// Traverse a language definition with Depth First Search
		DFS: function(o, callback, type, visited) {
			visited = visited || {};
			for (var i in o) {
				if (o.hasOwnProperty(i)) {
					callback.call(o, i, o[i], type || i);

					if (_.util.type(o[i]) === 'Object' && !visited[_.util.objId(o[i])]) {
						visited[_.util.objId(o[i])] = true;
						_.languages.DFS(o[i], callback, null, visited);
					}
					else if (_.util.type(o[i]) === 'Array' && !visited[_.util.objId(o[i])]) {
						visited[_.util.objId(o[i])] = true;
						_.languages.DFS(o[i], callback, i, visited);
					}
				}
			}
		}
	},
	plugins: {},

	highlightAll: function(async, callback) {
		var env = {
			callback: callback,
			selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
		};

		_.hooks.run("before-highlightall", env);

		var elements = env.elements || document.querySelectorAll(env.selector);

		for (var i=0, element; element = elements[i++];) {
			_.highlightElement(element, async === true, env.callback);
		}
	},

	highlightElement: function(element, async, callback) {
		// Find language
		var language, grammar, parent = element;

		while (parent && !lang.test(parent.className)) {
			parent = parent.parentNode;
		}

		if (parent) {
			language = (parent.className.match(lang) || [,''])[1].toLowerCase();
			grammar = _.languages[language];
		}

		// Set language on the element, if not present
		element.className = element.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;

		// Set language on the parent, for styling
		parent = element.parentNode;

		if (/pre/i.test(parent.nodeName)) {
			parent.className = parent.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;
		}

		var code = element.textContent;

		var env = {
			element: element,
			language: language,
			grammar: grammar,
			code: code
		};

		_.hooks.run('before-sanity-check', env);

		if (!env.code || !env.grammar) {
			if (env.code) {
				env.element.textContent = env.code;
			}
			_.hooks.run('complete', env);
			return;
		}

		_.hooks.run('before-highlight', env);

		if (async && _self.Worker) {
			var worker = new Worker(_.filename);

			worker.onmessage = function(evt) {
				env.highlightedCode = evt.data;

				_.hooks.run('before-insert', env);

				env.element.innerHTML = env.highlightedCode;

				callback && callback.call(env.element);
				_.hooks.run('after-highlight', env);
				_.hooks.run('complete', env);
			};

			worker.postMessage(JSON.stringify({
				language: env.language,
				code: env.code,
				immediateClose: true
			}));
		}
		else {
			env.highlightedCode = _.highlight(env.code, env.grammar, env.language);

			_.hooks.run('before-insert', env);

			env.element.innerHTML = env.highlightedCode;

			callback && callback.call(element);

			_.hooks.run('after-highlight', env);
			_.hooks.run('complete', env);
		}
	},

	highlight: function (text, grammar, language) {
		var tokens = _.tokenize(text, grammar);
		return Token.stringify(_.util.encode(tokens), language);
	},

	tokenize: function(text, grammar, language) {
		var Token = _.Token;

		var strarr = [text];

		var rest = grammar.rest;

		if (rest) {
			for (var token in rest) {
				grammar[token] = rest[token];
			}

			delete grammar.rest;
		}

		tokenloop: for (var token in grammar) {
			if(!grammar.hasOwnProperty(token) || !grammar[token]) {
				continue;
			}

			var patterns = grammar[token];
			patterns = (_.util.type(patterns) === "Array") ? patterns : [patterns];

			for (var j = 0; j < patterns.length; ++j) {
				var pattern = patterns[j],
					inside = pattern.inside,
					lookbehind = !!pattern.lookbehind,
					greedy = !!pattern.greedy,
					lookbehindLength = 0,
					alias = pattern.alias;

				if (greedy && !pattern.pattern.global) {
					// Without the global flag, lastIndex won't work
					var flags = pattern.pattern.toString().match(/[imuy]*$/)[0];
					pattern.pattern = RegExp(pattern.pattern.source, flags + "g");
				}

				pattern = pattern.pattern || pattern;

				// Don’t cache length as it changes during the loop
				for (var i=0, pos = 0; i<strarr.length; pos += strarr[i].length, ++i) {

					var str = strarr[i];

					if (strarr.length > text.length) {
						// Something went terribly wrong, ABORT, ABORT!
						break tokenloop;
					}

					if (str instanceof Token) {
						continue;
					}

					pattern.lastIndex = 0;

					var match = pattern.exec(str),
					    delNum = 1;

					// Greedy patterns can override/remove up to two previously matched tokens
					if (!match && greedy && i != strarr.length - 1) {
						pattern.lastIndex = pos;
						match = pattern.exec(text);
						if (!match) {
							break;
						}

						var from = match.index + (lookbehind ? match[1].length : 0),
						    to = match.index + match[0].length,
						    k = i,
						    p = pos;

						for (var len = strarr.length; k < len && p < to; ++k) {
							p += strarr[k].length;
							// Move the index i to the element in strarr that is closest to from
							if (from >= p) {
								++i;
								pos = p;
							}
						}

						/*
						 * If strarr[i] is a Token, then the match starts inside another Token, which is invalid
						 * If strarr[k - 1] is greedy we are in conflict with another greedy pattern
						 */
						if (strarr[i] instanceof Token || strarr[k - 1].greedy) {
							continue;
						}

						// Number of tokens to delete and replace with the new match
						delNum = k - i;
						str = text.slice(pos, p);
						match.index -= pos;
					}

					if (!match) {
						continue;
					}

					if(lookbehind) {
						lookbehindLength = match[1].length;
					}

					var from = match.index + lookbehindLength,
					    match = match[0].slice(lookbehindLength),
					    to = from + match.length,
					    before = str.slice(0, from),
					    after = str.slice(to);

					var args = [i, delNum];

					if (before) {
						args.push(before);
					}

					var wrapped = new Token(token, inside? _.tokenize(match, inside) : match, alias, match, greedy);

					args.push(wrapped);

					if (after) {
						args.push(after);
					}

					Array.prototype.splice.apply(strarr, args);
				}
			}
		}

		return strarr;
	},

	hooks: {
		all: {},

		add: function (name, callback) {
			var hooks = _.hooks.all;

			hooks[name] = hooks[name] || [];

			hooks[name].push(callback);
		},

		run: function (name, env) {
			var callbacks = _.hooks.all[name];

			if (!callbacks || !callbacks.length) {
				return;
			}

			for (var i=0, callback; callback = callbacks[i++];) {
				callback(env);
			}
		}
	}
};

var Token = _.Token = function(type, content, alias, matchedStr, greedy) {
	this.type = type;
	this.content = content;
	this.alias = alias;
	// Copy of the full string this token was created from
	this.length = (matchedStr || "").length|0;
	this.greedy = !!greedy;
};

Token.stringify = function(o, language, parent) {
	if (typeof o == 'string') {
		return o;
	}

	if (_.util.type(o) === 'Array') {
		return o.map(function(element) {
			return Token.stringify(element, language, o);
		}).join('');
	}

	var env = {
		type: o.type,
		content: Token.stringify(o.content, language, parent),
		tag: 'span',
		classes: ['token', o.type],
		attributes: {},
		language: language,
		parent: parent
	};

	if (env.type == 'comment') {
		env.attributes['spellcheck'] = 'true';
	}

	if (o.alias) {
		var aliases = _.util.type(o.alias) === 'Array' ? o.alias : [o.alias];
		Array.prototype.push.apply(env.classes, aliases);
	}

	_.hooks.run('wrap', env);

	var attributes = Object.keys(env.attributes).map(function(name) {
		return name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
	}).join(' ');

	return '<' + env.tag + ' class="' + env.classes.join(' ') + '"' + (attributes ? ' ' + attributes : '') + '>' + env.content + '</' + env.tag + '>';

};

if (!_self.document) {
	if (!_self.addEventListener) {
		// in Node.js
		return _self.Prism;
	}
 	// In worker
	_self.addEventListener('message', function(evt) {
		var message = JSON.parse(evt.data),
		    lang = message.language,
		    code = message.code,
		    immediateClose = message.immediateClose;

		_self.postMessage(_.highlight(code, _.languages[lang], lang));
		if (immediateClose) {
			_self.close();
		}
	}, false);

	return _self.Prism;
}

//Get current script and highlight
var script = document.currentScript || [].slice.call(document.getElementsByTagName("script")).pop();

if (script) {
	_.filename = script.src;

	if (document.addEventListener && !script.hasAttribute('data-manual')) {
		if(document.readyState !== "loading") {
			if (window.requestAnimationFrame) {
				window.requestAnimationFrame(_.highlightAll);
			} else {
				window.setTimeout(_.highlightAll, 16);
			}
		}
		else {
			document.addEventListener('DOMContentLoaded', _.highlightAll);
		}
	}
}

return _self.Prism;

})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Prism;
}

// hack for components to work correctly in node.js
if (typeof global !== 'undefined') {
	global.Prism = Prism;
}


/* **********************************************
     Begin prism-markup.js
********************************************** */

Prism.languages.markup = {
	'comment': /<!--[\w\W]*?-->/,
	'prolog': /<\?[\w\W]+?\?>/,
	'doctype': /<!DOCTYPE[\w\W]+?>/i,
	'cdata': /<!\[CDATA\[[\w\W]*?]]>/i,
	'tag': {
		pattern: /<\/?(?!\d)[^\s>\/=$<]+(?:\s+[^\s>\/=]+(?:=(?:("|')(?:\\\1|\\?(?!\1)[\w\W])*\1|[^\s'">=]+))?)*\s*\/?>/i,
		inside: {
			'tag': {
				pattern: /^<\/?[^\s>\/]+/i,
				inside: {
					'punctuation': /^<\/?/,
					'namespace': /^[^\s>\/:]+:/
				}
			},
			'attr-value': {
				pattern: /=(?:('|")[\w\W]*?(\1)|[^\s>]+)/i,
				inside: {
					'punctuation': /[=>"']/
				}
			},
			'punctuation': /\/?>/,
			'attr-name': {
				pattern: /[^\s>\/]+/,
				inside: {
					'namespace': /^[^\s>\/:]+:/
				}
			}

		}
	},
	'entity': /&#?[\da-z]{1,8};/i
};

// Plugin to make entity title show the real entity, idea by Roman Komarov
Prism.hooks.add('wrap', function(env) {

	if (env.type === 'entity') {
		env.attributes['title'] = env.content.replace(/&amp;/, '&');
	}
});

Prism.languages.xml = Prism.languages.markup;
Prism.languages.html = Prism.languages.markup;
Prism.languages.mathml = Prism.languages.markup;
Prism.languages.svg = Prism.languages.markup;


/* **********************************************
     Begin prism-css.js
********************************************** */

Prism.languages.css = {
	'comment': /\/\*[\w\W]*?\*\//,
	'atrule': {
		pattern: /@[\w-]+?.*?(;|(?=\s*\{))/i,
		inside: {
			'rule': /@[\w-]+/
			// See rest below
		}
	},
	'url': /url\((?:(["'])(\\(?:\r\n|[\w\W])|(?!\1)[^\\\r\n])*\1|.*?)\)/i,
	'selector': /[^\{\}\s][^\{\};]*?(?=\s*\{)/,
	'string': {
		pattern: /("|')(\\(?:\r\n|[\w\W])|(?!\1)[^\\\r\n])*\1/,
		greedy: true
	},
	'property': /(\b|\B)[\w-]+(?=\s*:)/i,
	'important': /\B!important\b/i,
	'function': /[-a-z0-9]+(?=\()/i,
	'punctuation': /[(){};:]/
};

Prism.languages.css['atrule'].inside.rest = Prism.util.clone(Prism.languages.css);

if (Prism.languages.markup) {
	Prism.languages.insertBefore('markup', 'tag', {
		'style': {
			pattern: /(<style[\w\W]*?>)[\w\W]*?(?=<\/style>)/i,
			lookbehind: true,
			inside: Prism.languages.css,
			alias: 'language-css'
		}
	});
	
	Prism.languages.insertBefore('inside', 'attr-value', {
		'style-attr': {
			pattern: /\s*style=("|').*?\1/i,
			inside: {
				'attr-name': {
					pattern: /^\s*style/i,
					inside: Prism.languages.markup.tag.inside
				},
				'punctuation': /^\s*=\s*['"]|['"]\s*$/,
				'attr-value': {
					pattern: /.+/i,
					inside: Prism.languages.css
				}
			},
			alias: 'language-css'
		}
	}, Prism.languages.markup.tag);
}

/* **********************************************
     Begin prism-clike.js
********************************************** */

Prism.languages.clike = {
	'comment': [
		{
			pattern: /(^|[^\\])\/\*[\w\W]*?\*\//,
			lookbehind: true
		},
		{
			pattern: /(^|[^\\:])\/\/.*/,
			lookbehind: true
		}
	],
	'string': {
		pattern: /(["'])(\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
		greedy: true
	},
	'class-name': {
		pattern: /((?:\b(?:class|interface|extends|implements|trait|instanceof|new)\s+)|(?:catch\s+\())[a-z0-9_\.\\]+/i,
		lookbehind: true,
		inside: {
			punctuation: /(\.|\\)/
		}
	},
	'keyword': /\b(if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/,
	'boolean': /\b(true|false)\b/,
	'function': /[a-z0-9_]+(?=\()/i,
	'number': /\b-?(?:0x[\da-f]+|\d*\.?\d+(?:e[+-]?\d+)?)\b/i,
	'operator': /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/,
	'punctuation': /[{}[\];(),.:]/
};


/* **********************************************
     Begin prism-javascript.js
********************************************** */

Prism.languages.javascript = Prism.languages.extend('clike', {
	'keyword': /\b(as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield)\b/,
	'number': /\b-?(0x[\dA-Fa-f]+|0b[01]+|0o[0-7]+|\d*\.?\d+([Ee][+-]?\d+)?|NaN|Infinity)\b/,
	// Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
	'function': /[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*(?=\()/i,
	'operator': /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*\*?|\/|~|\^|%|\.{3}/
});

Prism.languages.insertBefore('javascript', 'keyword', {
	'regex': {
		pattern: /(^|[^/])\/(?!\/)(\[.+?]|\\.|[^/\\\r\n])+\/[gimyu]{0,5}(?=\s*($|[\r\n,.;})]))/,
		lookbehind: true,
		greedy: true
	}
});

Prism.languages.insertBefore('javascript', 'string', {
	'template-string': {
		pattern: /`(?:\\\\|\\?[^\\])*?`/,
		greedy: true,
		inside: {
			'interpolation': {
				pattern: /\$\{[^}]+\}/,
				inside: {
					'interpolation-punctuation': {
						pattern: /^\$\{|\}$/,
						alias: 'punctuation'
					},
					rest: Prism.languages.javascript
				}
			},
			'string': /[\s\S]+/
		}
	}
});

if (Prism.languages.markup) {
	Prism.languages.insertBefore('markup', 'tag', {
		'script': {
			pattern: /(<script[\w\W]*?>)[\w\W]*?(?=<\/script>)/i,
			lookbehind: true,
			inside: Prism.languages.javascript,
			alias: 'language-javascript'
		}
	});
}

Prism.languages.js = Prism.languages.javascript;

/* **********************************************
     Begin prism-file-highlight.js
********************************************** */

(function () {
	if (typeof self === 'undefined' || !self.Prism || !self.document || !document.querySelector) {
		return;
	}

	self.Prism.fileHighlight = function() {

		var Extensions = {
			'js': 'javascript',
			'py': 'python',
			'rb': 'ruby',
			'ps1': 'powershell',
			'psm1': 'powershell',
			'sh': 'bash',
			'bat': 'batch',
			'h': 'c',
			'tex': 'latex'
		};

		if(Array.prototype.forEach) { // Check to prevent error in IE8
			Array.prototype.slice.call(document.querySelectorAll('pre[data-src]')).forEach(function (pre) {
				var src = pre.getAttribute('data-src');

				var language, parent = pre;
				var lang = /\blang(?:uage)?-(?!\*)(\w+)\b/i;
				while (parent && !lang.test(parent.className)) {
					parent = parent.parentNode;
				}

				if (parent) {
					language = (pre.className.match(lang) || [, ''])[1];
				}

				if (!language) {
					var extension = (src.match(/\.(\w+)$/) || [, ''])[1];
					language = Extensions[extension] || extension;
				}

				var code = document.createElement('code');
				code.className = 'language-' + language;

				pre.textContent = '';

				code.textContent = 'Loading…';

				pre.appendChild(code);

				var xhr = new XMLHttpRequest();

				xhr.open('GET', src, true);

				xhr.onreadystatechange = function () {
					if (xhr.readyState == 4) {

						if (xhr.status < 400 && xhr.responseText) {
							code.textContent = xhr.responseText;

							Prism.highlightElement(code);
						}
						else if (xhr.status >= 400) {
							code.textContent = '✖ Error ' + xhr.status + ' while fetching file: ' + xhr.statusText;
						}
						else {
							code.textContent = '✖ Error: File does not exist or is empty';
						}
					}
				};

				xhr.send(null);
			});
		}

	};

	document.addEventListener('DOMContentLoaded', self.Prism.fileHighlight);

})();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],2:[function(require,module,exports){
'use strict';

var _avalonbox = require('../../src/scripts/avalonbox');

var _avalonbox2 = _interopRequireDefault(_avalonbox);

var _prismjs = require('prismjs');

var _prismjs2 = _interopRequireDefault(_prismjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

document.onreadystatechange = function () {
  if (document.readyState === 'complete') {

    _avalonbox2.default.run('image-gallery-single');
    _avalonbox2.default.run('image-gallery-multiple');
    _avalonbox2.default.run('image-gallery-many');
  }
};

},{"../../src/scripts/avalonbox":4,"prismjs":1}],3:[function(require,module,exports){
module.exports={
  "mode": "prod"
}

},{}],4:[function(require,module,exports){
'use strict';

var _html = require('./core/html');

var html = _interopRequireWildcard(_html);

var _bind = require('./core/bind');

var _bind2 = _interopRequireDefault(_bind);

var _delegate = require('./core/delegate');

var _delegate2 = _interopRequireDefault(_delegate);

var _Direction = require('./constants/Direction');

var _Direction2 = _interopRequireDefault(_Direction);

var _AppConstants = require('./constants/AppConstants');

var _AppConstants2 = _interopRequireDefault(_AppConstants);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

var config = require('./appconfig');

var box = 'avalonbox';
var isDev = config.mode === _AppConstants2.default.DEV;

var Avalonbox = function () {
  var doc = document;
  var buttons = {};
  var overlay = html.createOverlayBox(doc);
  var frame = html.createFrame(doc);
  frame.image.addEventListener('animationend', onImageAnimationEnd, false);
  var spinner = html.createSpinner(doc);
  var spinnerWrapper = html.createSpinnerWrapper(doc);
  var downloadImage = new Image();

  var active = void 0;
  var currentLink = void 0;

  initialize();

  function initialize() {
    active = false;
    html.appendChild(doc, overlay);
    buttons.prev = html.createPreviousButton(doc);
    buttons.next = html.createNextButton(doc);
    spinnerWrapper.appendChild(spinner);
    overlay.appendChild(frame.container);
    overlay.appendChild(spinnerWrapper);
    overlay.appendChild(buttons.prev);
    overlay.appendChild(buttons.next);

    (0, _bind2.default)(overlay, 'click', hideOverlay);
    (0, _bind2.default)(buttons.prev, 'click', previous);
    (0, _bind2.default)(buttons.next, 'click', next);
    (0, _bind2.default)(doc, 'keydown', keyPressHandler);
  }

  function hideOverlay(e) {
    var f = frame.container;
    if (f === e.target || !f.contains(e.target)) cleanFrame();
  }

  function cleanFrame() {
    html.hide(overlay);
    frame.image.classList.remove('showRight', 'showLeft', 'show');
    frame.image.src = '';
    active = false;
  }

  function showOverlay(e) {
    e.preventDefault();
    active = true;
    html.show(overlay);
    currentLink = e.delegateTarget;
    fetchImage();

    if (single(e.currentTarget.id)) {
      html.hide(buttons.prev);
      html.hide(buttons.next);
    } else {
      if (currentLink.previousElementSibling) html.show(buttons.prev);else html.hide(buttons.prev);

      if (currentLink.nextElementSibling) html.show(buttons.next);else html.hide(buttons.next);
    }
  }

  function next(e) {
    frame.image.classList.remove('showLeft', 'show');
    html.show(buttons.prev);
    if (currentLink.nextElementSibling) {
      currentLink = currentLink.nextElementSibling;
      fetchImage(_Direction2.default.RIGHT);
      if (!currentLink.nextElementSibling) html.hide(buttons.next);
    }

    e.stopPropagation();
  }

  function previous(e) {
    frame.image.classList.remove('showRight', 'show');
    html.show(buttons.next);
    if (currentLink.previousElementSibling) {
      currentLink = currentLink.previousElementSibling;
      fetchImage(_Direction2.default.LEFT);
      if (!currentLink.previousElementSibling) html.hide(buttons.prev);
    }

    e.stopPropagation();
  }

  function onImageAnimationEnd(e) {
    downloadImage.src = currentLink.getAttribute('href');
    frame.link.href = currentLink.getAttribute('href');
  }

  function fetchImage(DIRECTION) {
    downloadImage.onload = function () {
      onLoadImage.bind(this, DIRECTION)();
    };
    if (DIRECTION) {
      html.slideOut(frame.image, DIRECTION);
    } else {
      downloadImage.src = currentLink.getAttribute('href');
      frame.link.href = currentLink.getAttribute('href');
    }

    html.show(spinner);
  }

  function onLoadImage(DIRECTION) {
    if (isDev) {
      setTimeout(loadImage.bind(this, DIRECTION), 1000);
    } else {
      loadImage.bind(this, DIRECTION)();
    }
  }

  function loadImage(DIRECTION) {
    if (DIRECTION) html.slideIn(frame.image, DIRECTION);else html.show(frame.image);
    frame.image.src = this.src;
    html.hide(spinner);
  }

  // TODO: Swap [].slice for Array.from (ES6)
  // Need to test in IE9
  function single(query) {
    var links = doc.getElementById(query).getElementsByTagName('a');
    return [].slice.call(links).length == 1;
  }

  function run(query) {
    eventHandlers(query);
  }

  function eventHandlers(query) {
    var el = document.getElementById(query);
    var filterLinks = function filterLinks(x) {
      return x.tagName.toLowerCase() == 'a';
    };
    el.addEventListener('click', (0, _delegate2.default)(filterLinks, showOverlay));
  }

  function keyPressHandler(event) {
    var e = event || window.event;

    if (!active) return;

    if (e.keyCode == '37') previous(e);else if (e.keyCode == '39') next(e);
  }

  return {
    run: run
  };
}();

module.exports = Avalonbox;

},{"./appconfig":3,"./constants/AppConstants":5,"./constants/Direction":6,"./core/bind":7,"./core/delegate":8,"./core/html":9}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var AppConstants = {
  DEV: 'dev',
  PROD: 'prod'
};

exports.default = AppConstants;

},{}],6:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var Direction = {
  LEFT: 'left',
  RIGHT: 'right'
};

exports.default = Direction;

},{}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
function bind(element, event, callback, useCapture) {
  element.addEventListener(event, callback, useCapture);
}

exports.default = bind;

},{}],8:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var delegate = function delegate(criteria, listener) {
  return function (e) {
    var el = e.target;
    do {
      if (!criteria(el)) continue;
      e.delegateTarget = el;
      listener.apply(this, arguments);
      return;
    } while (el = el.parentNode);
  };
};

exports.default = delegate;

},{}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.appendChild = exports.slideOut = exports.slideIn = exports.show = exports.hide = exports.getOverlayBox = exports.createSpinnerWrapper = exports.createSpinner = exports.createOverlayBox = exports.createFrame = exports.createNextButton = exports.createPreviousButton = undefined;

var _bind = require('./bind');

var _bind2 = _interopRequireDefault(_bind);

var _Direction = require('../constants/Direction');

var _Direction2 = _interopRequireDefault(_Direction);

var _capitalize = require('../utils/capitalize');

var _capitalize2 = _interopRequireDefault(_capitalize);

var _oppositeDirection = require('../utils/opposite-direction');

var _oppositeDirection2 = _interopRequireDefault(_oppositeDirection);

var _icons = require('../icons');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var box = 'avalonbox';

function createPreviousButton(doc) {
  var prev = doc.createElement('button');
  prev.id = box + '-prev';
  prev.className = box + '-move-button ' + box + '-prev-button';
  prev.innerHTML = _icons.LeftIcon;
  prev.type = 'button';
  return prev;
}

function createNextButton(doc) {
  var next = doc.createElement('button');
  next.id = box + '-next';
  next.className = box + '-move-button ' + box + '-next-button';
  next.innerHTML = _icons.RightIcon;
  next.type = 'button';
  return next;
}

function createSpinner(doc) {
  var spinner = doc.createElement('div');
  spinner.id = box + '-spinner';
  spinner.className = box + '-spinner';

  return spinner;
}

function createSpinnerWrapper(doc) {
  var wrapper = doc.createElement('div');
  wrapper.id = box + '-spinner-wrapper';
  wrapper.className = box + '-spinner-wrapper';

  return wrapper;
}

function createFrame(doc) {
  var frame = doc.createElement('div');
  frame.id = box + '-frame';
  frame.className = box + '-frame';

  var image = doc.createElement('img');
  image.src = '';
  image.className = box + '-frame-image';
  image.id = box + '-frame-image';

  var link = doc.createElement('a');
  link.appendChild(image);

  (0, _bind2.default)(link, 'click', function (e) {
    e.preventDefault();
  });

  frame.appendChild(link);
  return { container: frame, image: image, link: link };
}

function createOverlayBox(doc) {
  var overlay = doc.createElement('div');
  overlay.className = box + '-overlay';
  overlay.id = box + '-overlay';
  return overlay;
}

function getOverlayBox(doc) {
  var overlay = doc.getElementById(box + '-overlay');
  return overlay;
}

function hide(el) {
  el.classList.remove('show');
  el.classList.add('hide');
}

function show(el) {
  el.classList.remove('hide');
  el.classList.add('show');
}

function appendChild(doc, el) {
  doc.getElementsByTagName('body')[0].appendChild(el);
}

function slideIn(el, DIRECTION) {
  el.classList.remove('hide' + (0, _capitalize2.default)((0, _oppositeDirection2.default)(DIRECTION)));
  el.classList.add('show' + (0, _capitalize2.default)(DIRECTION));
}

function slideOut(el, DIRECTION) {
  el.classList.remove('show' + (0, _capitalize2.default)(DIRECTION));
  el.classList.add('hide' + (0, _capitalize2.default)((0, _oppositeDirection2.default)(DIRECTION)));
}

exports.createPreviousButton = createPreviousButton;
exports.createNextButton = createNextButton;
exports.createFrame = createFrame;
exports.createOverlayBox = createOverlayBox;
exports.createSpinner = createSpinner;
exports.createSpinnerWrapper = createSpinnerWrapper;
exports.getOverlayBox = getOverlayBox;
exports.hide = hide;
exports.show = show;
exports.slideIn = slideIn;
exports.slideOut = slideOut;
exports.appendChild = appendChild;

},{"../constants/Direction":6,"../icons":10,"../utils/capitalize":11,"../utils/opposite-direction":12,"./bind":7}],10:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var svgHeader = "xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 100 125\" x=\"0px\" y=\"0px\"";

var LeftIcon = "\n  <div class='svgOuter'>\n  <svg " + svgHeader + " class='icon svgInner' preserveAspectRatio=\"xMinYMin meet\">\n  <g>\n    <path d=\"M70.59,95.41a2,2,0,0,0,2.83-2.83L30.83,50,73.41,7.41a2,2,0,0,0-2.83-2.83l-44,44a2,2,0,0,0,0,2.83Z\"/></g>\n  </svg>\n  </div>\n  ";

var RightIcon = "\n  <div class='svgOuter'>\n    <svg " + svgHeader + " class='icon svgInner'>\n      <g>\n        <path           d=\"M26.59,95.41a2,2,0,0,0,2.83,0l44-44a2,2,0,0,0,0-2.83l-44-44a2,2,0,0,0-2.83,2.83L69.17,50,26.59,92.59A2,2,0,0,0,26.59,95.41Z\"/>\n      </g>\n    </svg>\n  </div>\n  ";

exports.LeftIcon = LeftIcon;
exports.RightIcon = RightIcon;

},{}],11:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.substring(1);
}

exports.default = capitalize;

},{}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _Direction = require('../constants/Direction');

var _Direction2 = _interopRequireDefault(_Direction);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function oppositeDirection(DIRECTION) {
  return DIRECTION === _Direction2.default.LEFT ? _Direction2.default.RIGHT : _Direction2.default.LEFT;
}

exports.default = oppositeDirection;

},{"../constants/Direction":6}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvcHJpc21qcy9wcmlzbS5qcyIsInBhZ2VzL2pzL2FwcC5qcyIsInNyYy9zY3JpcHRzL2FwcGNvbmZpZy5qc29uIiwic3JjL3NjcmlwdHMvYXZhbG9uYm94LmpzIiwic3JjL3NjcmlwdHMvY29uc3RhbnRzL0FwcENvbnN0YW50cy5qcyIsInNyYy9zY3JpcHRzL2NvbnN0YW50cy9EaXJlY3Rpb24uanMiLCJzcmMvc2NyaXB0cy9jb3JlL2JpbmQuanMiLCJzcmMvc2NyaXB0cy9jb3JlL2RlbGVnYXRlLmpzIiwic3JjL3NjcmlwdHMvY29yZS9odG1sLmpzIiwic3JjL3NjcmlwdHMvaWNvbnMvaW5kZXguanMiLCJzcmMvc2NyaXB0cy91dGlscy9jYXBpdGFsaXplLmpzIiwic3JjL3NjcmlwdHMvdXRpbHMvb3Bwb3NpdGUtZGlyZWN0aW9uLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7QUMzeEJBOzs7O0FBQ0E7Ozs7OztBQUdBLFNBQVMsa0JBQVQsR0FBOEIsWUFBVTtBQUN0QyxNQUFHLFNBQVMsVUFBVCxLQUF3QixVQUEzQixFQUFzQzs7QUFFcEMsd0JBQVUsR0FBVixDQUFjLHNCQUFkO0FBQ0Esd0JBQVUsR0FBVixDQUFjLHdCQUFkO0FBQ0Esd0JBQVUsR0FBVixDQUFjLG9CQUFkO0FBQ0Q7QUFDRixDQVBEOzs7QUNKQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ0hBOztJQUFZLEk7O0FBQ1o7Ozs7QUFDQTs7OztBQUVBOzs7O0FBQ0E7Ozs7Ozs7O0FBQ0EsSUFBTSxTQUFTLFFBQVEsYUFBUixDQUFmOztBQUVBLElBQU0sTUFBTSxXQUFaO0FBQ0EsSUFBTSxRQUFRLE9BQU8sSUFBUCxLQUFnQix1QkFBYSxHQUEzQzs7QUFFQSxJQUFNLFlBQWEsWUFBVztBQUM1QixNQUFNLE1BQU0sUUFBWjtBQUNBLE1BQU0sVUFBVSxFQUFoQjtBQUNBLE1BQU0sVUFBVSxLQUFLLGdCQUFMLENBQXNCLEdBQXRCLENBQWhCO0FBQ0EsTUFBTSxRQUFRLEtBQUssV0FBTCxDQUFpQixHQUFqQixDQUFkO0FBQ0EsUUFBTSxLQUFOLENBQVksZ0JBQVosQ0FBNkIsY0FBN0IsRUFBNkMsbUJBQTdDLEVBQWtFLEtBQWxFO0FBQ0EsTUFBTSxVQUFVLEtBQUssYUFBTCxDQUFtQixHQUFuQixDQUFoQjtBQUNBLE1BQU0saUJBQWlCLEtBQUssb0JBQUwsQ0FBMEIsR0FBMUIsQ0FBdkI7QUFDQSxNQUFNLGdCQUFnQixJQUFJLEtBQUosRUFBdEI7O0FBRUEsTUFBSSxlQUFKO0FBQ0EsTUFBSSxvQkFBSjs7QUFFQTs7QUFFQSxXQUFTLFVBQVQsR0FBc0I7QUFDcEIsYUFBUyxLQUFUO0FBQ0EsU0FBSyxXQUFMLENBQWlCLEdBQWpCLEVBQXNCLE9BQXRCO0FBQ0EsWUFBUSxJQUFSLEdBQWUsS0FBSyxvQkFBTCxDQUEwQixHQUExQixDQUFmO0FBQ0EsWUFBUSxJQUFSLEdBQWUsS0FBSyxnQkFBTCxDQUFzQixHQUF0QixDQUFmO0FBQ0EsbUJBQWUsV0FBZixDQUEyQixPQUEzQjtBQUNBLFlBQVEsV0FBUixDQUFvQixNQUFNLFNBQTFCO0FBQ0EsWUFBUSxXQUFSLENBQW9CLGNBQXBCO0FBQ0EsWUFBUSxXQUFSLENBQW9CLFFBQVEsSUFBNUI7QUFDQSxZQUFRLFdBQVIsQ0FBb0IsUUFBUSxJQUE1Qjs7QUFFQSx3QkFBSyxPQUFMLEVBQWMsT0FBZCxFQUF1QixXQUF2QjtBQUNBLHdCQUFLLFFBQVEsSUFBYixFQUFtQixPQUFuQixFQUE0QixRQUE1QjtBQUNBLHdCQUFLLFFBQVEsSUFBYixFQUFtQixPQUFuQixFQUE0QixJQUE1QjtBQUNBLHdCQUFLLEdBQUwsRUFBVSxTQUFWLEVBQXFCLGVBQXJCO0FBQ0Q7O0FBRUQsV0FBUyxXQUFULENBQXFCLENBQXJCLEVBQXdCO0FBQ3RCLFFBQUksSUFBSSxNQUFNLFNBQWQ7QUFDQSxRQUFJLE1BQU0sRUFBRSxNQUFSLElBQWtCLENBQUMsRUFBRSxRQUFGLENBQVcsRUFBRSxNQUFiLENBQXZCLEVBQTZDO0FBQzlDOztBQUVELFdBQVMsVUFBVCxHQUFzQjtBQUNwQixTQUFLLElBQUwsQ0FBVSxPQUFWO0FBQ0EsVUFBTSxLQUFOLENBQVksU0FBWixDQUFzQixNQUF0QixDQUE2QixXQUE3QixFQUEwQyxVQUExQyxFQUFzRCxNQUF0RDtBQUNBLFVBQU0sS0FBTixDQUFZLEdBQVosR0FBa0IsRUFBbEI7QUFDQSxhQUFTLEtBQVQ7QUFDRDs7QUFFRCxXQUFTLFdBQVQsQ0FBcUIsQ0FBckIsRUFBd0I7QUFDdEIsTUFBRSxjQUFGO0FBQ0EsYUFBUyxJQUFUO0FBQ0EsU0FBSyxJQUFMLENBQVUsT0FBVjtBQUNBLGtCQUFjLEVBQUUsY0FBaEI7QUFDQTs7QUFFQSxRQUFJLE9BQU8sRUFBRSxhQUFGLENBQWdCLEVBQXZCLENBQUosRUFBZ0M7QUFDOUIsV0FBSyxJQUFMLENBQVUsUUFBUSxJQUFsQjtBQUNBLFdBQUssSUFBTCxDQUFVLFFBQVEsSUFBbEI7QUFDRCxLQUhELE1BR087QUFDTCxVQUFJLFlBQVksc0JBQWhCLEVBQXdDLEtBQUssSUFBTCxDQUFVLFFBQVEsSUFBbEIsRUFBeEMsS0FDSyxLQUFLLElBQUwsQ0FBVSxRQUFRLElBQWxCOztBQUVMLFVBQUksWUFBWSxrQkFBaEIsRUFBb0MsS0FBSyxJQUFMLENBQVUsUUFBUSxJQUFsQixFQUFwQyxLQUNLLEtBQUssSUFBTCxDQUFVLFFBQVEsSUFBbEI7QUFDTjtBQUNGOztBQUVELFdBQVMsSUFBVCxDQUFjLENBQWQsRUFBaUI7QUFDZixVQUFNLEtBQU4sQ0FBWSxTQUFaLENBQXNCLE1BQXRCLENBQTZCLFVBQTdCLEVBQXlDLE1BQXpDO0FBQ0EsU0FBSyxJQUFMLENBQVUsUUFBUSxJQUFsQjtBQUNBLFFBQUksWUFBWSxrQkFBaEIsRUFBb0M7QUFDbEMsb0JBQWMsWUFBWSxrQkFBMUI7QUFDQSxpQkFBVyxvQkFBVSxLQUFyQjtBQUNBLFVBQUksQ0FBQyxZQUFZLGtCQUFqQixFQUFxQyxLQUFLLElBQUwsQ0FBVSxRQUFRLElBQWxCO0FBQ3RDOztBQUVELE1BQUUsZUFBRjtBQUNEOztBQUVELFdBQVMsUUFBVCxDQUFrQixDQUFsQixFQUFxQjtBQUNuQixVQUFNLEtBQU4sQ0FBWSxTQUFaLENBQXNCLE1BQXRCLENBQTZCLFdBQTdCLEVBQTBDLE1BQTFDO0FBQ0EsU0FBSyxJQUFMLENBQVUsUUFBUSxJQUFsQjtBQUNBLFFBQUksWUFBWSxzQkFBaEIsRUFBd0M7QUFDdEMsb0JBQWMsWUFBWSxzQkFBMUI7QUFDQSxpQkFBVyxvQkFBVSxJQUFyQjtBQUNBLFVBQUksQ0FBQyxZQUFZLHNCQUFqQixFQUF5QyxLQUFLLElBQUwsQ0FBVSxRQUFRLElBQWxCO0FBQzFDOztBQUVELE1BQUUsZUFBRjtBQUNEOztBQUVELFdBQVMsbUJBQVQsQ0FBNkIsQ0FBN0IsRUFBZ0M7QUFDOUIsa0JBQWMsR0FBZCxHQUFvQixZQUFZLFlBQVosQ0FBeUIsTUFBekIsQ0FBcEI7QUFDQSxVQUFNLElBQU4sQ0FBVyxJQUFYLEdBQWtCLFlBQVksWUFBWixDQUF5QixNQUF6QixDQUFsQjtBQUNEOztBQUVELFdBQVMsVUFBVCxDQUFvQixTQUFwQixFQUErQjtBQUM3QixrQkFBYyxNQUFkLEdBQXVCLFlBQVc7QUFDaEMsa0JBQVksSUFBWixDQUFpQixJQUFqQixFQUF1QixTQUF2QjtBQUNELEtBRkQ7QUFHQSxRQUFJLFNBQUosRUFBZTtBQUNiLFdBQUssUUFBTCxDQUFjLE1BQU0sS0FBcEIsRUFBMkIsU0FBM0I7QUFDRCxLQUZELE1BRU87QUFDTCxvQkFBYyxHQUFkLEdBQW9CLFlBQVksWUFBWixDQUF5QixNQUF6QixDQUFwQjtBQUNBLFlBQU0sSUFBTixDQUFXLElBQVgsR0FBa0IsWUFBWSxZQUFaLENBQXlCLE1BQXpCLENBQWxCO0FBQ0Q7O0FBRUQsU0FBSyxJQUFMLENBQVUsT0FBVjtBQUNEOztBQUVELFdBQVMsV0FBVCxDQUFxQixTQUFyQixFQUFnQztBQUM5QixRQUFJLEtBQUosRUFBVztBQUNULGlCQUFXLFVBQVUsSUFBVixDQUFlLElBQWYsRUFBcUIsU0FBckIsQ0FBWCxFQUE0QyxJQUE1QztBQUNELEtBRkQsTUFFTztBQUNMLGdCQUFVLElBQVYsQ0FBZSxJQUFmLEVBQXFCLFNBQXJCO0FBQ0Q7QUFDRjs7QUFFRCxXQUFTLFNBQVQsQ0FBbUIsU0FBbkIsRUFBOEI7QUFDNUIsUUFBSSxTQUFKLEVBQWUsS0FBSyxPQUFMLENBQWEsTUFBTSxLQUFuQixFQUEwQixTQUExQixFQUFmLEtBQ0ssS0FBSyxJQUFMLENBQVUsTUFBTSxLQUFoQjtBQUNMLFVBQU0sS0FBTixDQUFZLEdBQVosR0FBa0IsS0FBSyxHQUF2QjtBQUNBLFNBQUssSUFBTCxDQUFVLE9BQVY7QUFDRDs7QUFFRDtBQUNBO0FBQ0EsV0FBUyxNQUFULENBQWdCLEtBQWhCLEVBQXVCO0FBQ3JCLFFBQU0sUUFBUSxJQUFJLGNBQUosQ0FBbUIsS0FBbkIsRUFBMEIsb0JBQTFCLENBQStDLEdBQS9DLENBQWQ7QUFDQSxXQUFPLEdBQUcsS0FBSCxDQUFTLElBQVQsQ0FBYyxLQUFkLEVBQXFCLE1BQXJCLElBQStCLENBQXRDO0FBQ0Q7O0FBRUQsV0FBUyxHQUFULENBQWEsS0FBYixFQUFvQjtBQUNsQixrQkFBYyxLQUFkO0FBQ0Q7O0FBRUQsV0FBUyxhQUFULENBQXVCLEtBQXZCLEVBQThCO0FBQzVCLFFBQU0sS0FBSyxTQUFTLGNBQVQsQ0FBd0IsS0FBeEIsQ0FBWDtBQUNBLFFBQU0sY0FBYyxTQUFkLFdBQWM7QUFBQSxhQUFLLEVBQUUsT0FBRixDQUFVLFdBQVYsTUFBMkIsR0FBaEM7QUFBQSxLQUFwQjtBQUNBLE9BQUcsZ0JBQUgsQ0FBb0IsT0FBcEIsRUFBNkIsd0JBQVMsV0FBVCxFQUFzQixXQUF0QixDQUE3QjtBQUNEOztBQUVELFdBQVMsZUFBVCxDQUF5QixLQUF6QixFQUFnQztBQUM5QixRQUFNLElBQUksU0FBUyxPQUFPLEtBQTFCOztBQUVBLFFBQUksQ0FBQyxNQUFMLEVBQWE7O0FBRWIsUUFBSSxFQUFFLE9BQUYsSUFBYSxJQUFqQixFQUF1QixTQUFTLENBQVQsRUFBdkIsS0FDSyxJQUFJLEVBQUUsT0FBRixJQUFhLElBQWpCLEVBQXVCLEtBQUssQ0FBTDtBQUM3Qjs7QUFFRCxTQUFPO0FBQ0w7QUFESyxHQUFQO0FBR0QsQ0F0SmlCLEVBQWxCOztBQXdKQSxPQUFPLE9BQVAsR0FBaUIsU0FBakI7Ozs7Ozs7O0FDbktBLElBQU0sZUFBZTtBQUNuQixPQUFLLEtBRGM7QUFFbkIsUUFBTTtBQUZhLENBQXJCOztrQkFLZSxZOzs7Ozs7OztBQ0xmLElBQU0sWUFBWTtBQUNoQixRQUFNLE1BRFU7QUFFaEIsU0FBTztBQUZTLENBQWxCOztrQkFLZSxTOzs7Ozs7OztBQ0xmLFNBQVMsSUFBVCxDQUFjLE9BQWQsRUFBdUIsS0FBdkIsRUFBOEIsUUFBOUIsRUFBd0MsVUFBeEMsRUFBb0Q7QUFDbEQsVUFBUSxnQkFBUixDQUF5QixLQUF6QixFQUFnQyxRQUFoQyxFQUEwQyxVQUExQztBQUNEOztrQkFFYyxJOzs7Ozs7OztBQ0pmLElBQU0sV0FBVyxTQUFYLFFBQVcsQ0FBUyxRQUFULEVBQW1CLFFBQW5CLEVBQTZCO0FBQzVDLFNBQU8sVUFBUyxDQUFULEVBQVk7QUFDakIsUUFBSSxLQUFLLEVBQUUsTUFBWDtBQUNBLE9BQUc7QUFDRCxVQUFJLENBQUMsU0FBUyxFQUFULENBQUwsRUFDRTtBQUNGLFFBQUUsY0FBRixHQUFtQixFQUFuQjtBQUNBLGVBQVMsS0FBVCxDQUFlLElBQWYsRUFBcUIsU0FBckI7QUFDQTtBQUNELEtBTkQsUUFNUyxLQUFLLEdBQUcsVUFOakI7QUFPRCxHQVREO0FBVUQsQ0FYRDs7a0JBYWUsUTs7Ozs7Ozs7OztBQ2JmOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQSxJQUFNLE1BQU0sV0FBWjs7QUFFQSxTQUFTLG9CQUFULENBQThCLEdBQTlCLEVBQW1DO0FBQ2pDLE1BQU0sT0FBTyxJQUFJLGFBQUosQ0FBa0IsUUFBbEIsQ0FBYjtBQUNBLE9BQUssRUFBTCxHQUFhLEdBQWI7QUFDQSxPQUFLLFNBQUwsR0FBb0IsR0FBcEIscUJBQXVDLEdBQXZDO0FBQ0EsT0FBSyxTQUFMO0FBQ0EsT0FBSyxJQUFMLEdBQVksUUFBWjtBQUNBLFNBQU8sSUFBUDtBQUNEOztBQUVELFNBQVMsZ0JBQVQsQ0FBMEIsR0FBMUIsRUFBK0I7QUFDN0IsTUFBTSxPQUFPLElBQUksYUFBSixDQUFrQixRQUFsQixDQUFiO0FBQ0EsT0FBSyxFQUFMLEdBQWEsR0FBYjtBQUNBLE9BQUssU0FBTCxHQUFvQixHQUFwQixxQkFBdUMsR0FBdkM7QUFDQSxPQUFLLFNBQUw7QUFDQSxPQUFLLElBQUwsR0FBWSxRQUFaO0FBQ0EsU0FBTyxJQUFQO0FBQ0Q7O0FBRUQsU0FBUyxhQUFULENBQXVCLEdBQXZCLEVBQTRCO0FBQzFCLE1BQU0sVUFBVSxJQUFJLGFBQUosQ0FBa0IsS0FBbEIsQ0FBaEI7QUFDQSxVQUFRLEVBQVIsR0FBZ0IsR0FBaEI7QUFDQSxVQUFRLFNBQVIsR0FBdUIsR0FBdkI7O0FBRUEsU0FBTyxPQUFQO0FBQ0Q7O0FBRUQsU0FBUyxvQkFBVCxDQUE4QixHQUE5QixFQUFtQztBQUNqQyxNQUFNLFVBQVUsSUFBSSxhQUFKLENBQWtCLEtBQWxCLENBQWhCO0FBQ0EsVUFBUSxFQUFSLEdBQWdCLEdBQWhCO0FBQ0EsVUFBUSxTQUFSLEdBQXVCLEdBQXZCOztBQUVBLFNBQU8sT0FBUDtBQUNEOztBQUVELFNBQVMsV0FBVCxDQUFxQixHQUFyQixFQUEwQjtBQUN4QixNQUFNLFFBQVEsSUFBSSxhQUFKLENBQWtCLEtBQWxCLENBQWQ7QUFDQSxRQUFNLEVBQU4sR0FBYyxHQUFkO0FBQ0EsUUFBTSxTQUFOLEdBQXFCLEdBQXJCOztBQUVBLE1BQU0sUUFBUSxJQUFJLGFBQUosQ0FBa0IsS0FBbEIsQ0FBZDtBQUNBLFFBQU0sR0FBTixHQUFZLEVBQVo7QUFDQSxRQUFNLFNBQU4sR0FBcUIsR0FBckI7QUFDQSxRQUFNLEVBQU4sR0FBYyxHQUFkOztBQUVBLE1BQU0sT0FBTyxJQUFJLGFBQUosQ0FBa0IsR0FBbEIsQ0FBYjtBQUNBLE9BQUssV0FBTCxDQUFpQixLQUFqQjs7QUFFQSxzQkFBSyxJQUFMLEVBQVcsT0FBWCxFQUFvQixhQUFLO0FBQ3ZCLE1BQUUsY0FBRjtBQUNELEdBRkQ7O0FBSUEsUUFBTSxXQUFOLENBQWtCLElBQWxCO0FBQ0EsU0FBTyxFQUFFLFdBQVcsS0FBYixFQUFvQixPQUFPLEtBQTNCLEVBQWtDLE1BQU0sSUFBeEMsRUFBUDtBQUNEOztBQUVELFNBQVMsZ0JBQVQsQ0FBMEIsR0FBMUIsRUFBK0I7QUFDN0IsTUFBTSxVQUFVLElBQUksYUFBSixDQUFrQixLQUFsQixDQUFoQjtBQUNBLFVBQVEsU0FBUixHQUF1QixHQUF2QjtBQUNBLFVBQVEsRUFBUixHQUFnQixHQUFoQjtBQUNBLFNBQU8sT0FBUDtBQUNEOztBQUVELFNBQVMsYUFBVCxDQUF1QixHQUF2QixFQUE0QjtBQUMxQixNQUFNLFVBQVUsSUFBSSxjQUFKLENBQXNCLEdBQXRCLGNBQWhCO0FBQ0EsU0FBTyxPQUFQO0FBQ0Q7O0FBRUQsU0FBUyxJQUFULENBQWMsRUFBZCxFQUFrQjtBQUNoQixLQUFHLFNBQUgsQ0FBYSxNQUFiLENBQW9CLE1BQXBCO0FBQ0EsS0FBRyxTQUFILENBQWEsR0FBYixDQUFpQixNQUFqQjtBQUNEOztBQUVELFNBQVMsSUFBVCxDQUFjLEVBQWQsRUFBa0I7QUFDaEIsS0FBRyxTQUFILENBQWEsTUFBYixDQUFvQixNQUFwQjtBQUNBLEtBQUcsU0FBSCxDQUFhLEdBQWIsQ0FBaUIsTUFBakI7QUFDRDs7QUFFRCxTQUFTLFdBQVQsQ0FBcUIsR0FBckIsRUFBMEIsRUFBMUIsRUFBOEI7QUFDNUIsTUFBSSxvQkFBSixDQUF5QixNQUF6QixFQUFpQyxDQUFqQyxFQUFvQyxXQUFwQyxDQUFnRCxFQUFoRDtBQUNEOztBQUVELFNBQVMsT0FBVCxDQUFpQixFQUFqQixFQUFxQixTQUFyQixFQUFnQztBQUM5QixLQUFHLFNBQUgsQ0FBYSxNQUFiLFVBQTJCLDBCQUFXLGlDQUFrQixTQUFsQixDQUFYLENBQTNCO0FBQ0EsS0FBRyxTQUFILENBQWEsR0FBYixVQUF3QiwwQkFBVyxTQUFYLENBQXhCO0FBQ0Q7O0FBRUQsU0FBUyxRQUFULENBQWtCLEVBQWxCLEVBQXNCLFNBQXRCLEVBQWlDO0FBQy9CLEtBQUcsU0FBSCxDQUFhLE1BQWIsVUFBMkIsMEJBQVcsU0FBWCxDQUEzQjtBQUNBLEtBQUcsU0FBSCxDQUFhLEdBQWIsVUFBd0IsMEJBQVcsaUNBQWtCLFNBQWxCLENBQVgsQ0FBeEI7QUFDRDs7UUFHQyxvQixHQUFBLG9CO1FBQ0EsZ0IsR0FBQSxnQjtRQUNBLFcsR0FBQSxXO1FBQ0EsZ0IsR0FBQSxnQjtRQUNBLGEsR0FBQSxhO1FBQ0Esb0IsR0FBQSxvQjtRQUNBLGEsR0FBQSxhO1FBQ0EsSSxHQUFBLEk7UUFDQSxJLEdBQUEsSTtRQUNBLE8sR0FBQSxPO1FBQ0EsUSxHQUFBLFE7UUFDQSxXLEdBQUEsVzs7Ozs7Ozs7QUM5R0YsSUFBTSxpR0FBTjs7QUFHQSxJQUFNLG1EQUVHLFNBRkgsME5BQU47O0FBU0EsSUFBTSxzREFFSyxTQUZMLDBPQUFOOztRQVVTLFEsR0FBQSxRO1FBQVUsUyxHQUFBLFM7Ozs7Ozs7O0FDdEJuQixTQUFTLFVBQVQsQ0FBb0IsTUFBcEIsRUFBNEI7QUFDMUIsU0FBTyxPQUFPLE1BQVAsQ0FBYyxDQUFkLEVBQWlCLFdBQWpCLEtBQWlDLE9BQU8sU0FBUCxDQUFpQixDQUFqQixDQUF4QztBQUNEOztrQkFFYyxVOzs7Ozs7Ozs7QUNKZjs7Ozs7O0FBRUEsU0FBUyxpQkFBVCxDQUEyQixTQUEzQixFQUFzQztBQUNwQyxTQUFPLGNBQWMsb0JBQVUsSUFBeEIsR0FBK0Isb0JBQVUsS0FBekMsR0FBaUQsb0JBQVUsSUFBbEU7QUFDRDs7a0JBRWMsaUIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLWNvcmUuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxudmFyIF9zZWxmID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKVxuXHQ/IHdpbmRvdyAgIC8vIGlmIGluIGJyb3dzZXJcblx0OiAoXG5cdFx0KHR5cGVvZiBXb3JrZXJHbG9iYWxTY29wZSAhPT0gJ3VuZGVmaW5lZCcgJiYgc2VsZiBpbnN0YW5jZW9mIFdvcmtlckdsb2JhbFNjb3BlKVxuXHRcdD8gc2VsZiAvLyBpZiBpbiB3b3JrZXJcblx0XHQ6IHt9ICAgLy8gaWYgaW4gbm9kZSBqc1xuXHQpO1xuXG4vKipcbiAqIFByaXNtOiBMaWdodHdlaWdodCwgcm9idXN0LCBlbGVnYW50IHN5bnRheCBoaWdobGlnaHRpbmdcbiAqIE1JVCBsaWNlbnNlIGh0dHA6Ly93d3cub3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvbWl0LWxpY2Vuc2UucGhwL1xuICogQGF1dGhvciBMZWEgVmVyb3UgaHR0cDovL2xlYS52ZXJvdS5tZVxuICovXG5cbnZhciBQcmlzbSA9IChmdW5jdGlvbigpe1xuXG4vLyBQcml2YXRlIGhlbHBlciB2YXJzXG52YXIgbGFuZyA9IC9cXGJsYW5nKD86dWFnZSk/LShcXHcrKVxcYi9pO1xudmFyIHVuaXF1ZUlkID0gMDtcblxudmFyIF8gPSBfc2VsZi5QcmlzbSA9IHtcblx0dXRpbDoge1xuXHRcdGVuY29kZTogZnVuY3Rpb24gKHRva2Vucykge1xuXHRcdFx0aWYgKHRva2VucyBpbnN0YW5jZW9mIFRva2VuKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgVG9rZW4odG9rZW5zLnR5cGUsIF8udXRpbC5lbmNvZGUodG9rZW5zLmNvbnRlbnQpLCB0b2tlbnMuYWxpYXMpO1xuXHRcdFx0fSBlbHNlIGlmIChfLnV0aWwudHlwZSh0b2tlbnMpID09PSAnQXJyYXknKSB7XG5cdFx0XHRcdHJldHVybiB0b2tlbnMubWFwKF8udXRpbC5lbmNvZGUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHRva2Vucy5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoLzwvZywgJyZsdDsnKS5yZXBsYWNlKC9cXHUwMGEwL2csICcgJyk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdHR5cGU6IGZ1bmN0aW9uIChvKSB7XG5cdFx0XHRyZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pLm1hdGNoKC9cXFtvYmplY3QgKFxcdyspXFxdLylbMV07XG5cdFx0fSxcblxuXHRcdG9iaklkOiBmdW5jdGlvbiAob2JqKSB7XG5cdFx0XHRpZiAoIW9ialsnX19pZCddKSB7XG5cdFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosICdfX2lkJywgeyB2YWx1ZTogKyt1bmlxdWVJZCB9KTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBvYmpbJ19faWQnXTtcblx0XHR9LFxuXG5cdFx0Ly8gRGVlcCBjbG9uZSBhIGxhbmd1YWdlIGRlZmluaXRpb24gKGUuZy4gdG8gZXh0ZW5kIGl0KVxuXHRcdGNsb25lOiBmdW5jdGlvbiAobykge1xuXHRcdFx0dmFyIHR5cGUgPSBfLnV0aWwudHlwZShvKTtcblxuXHRcdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRcdGNhc2UgJ09iamVjdCc6XG5cdFx0XHRcdFx0dmFyIGNsb25lID0ge307XG5cblx0XHRcdFx0XHRmb3IgKHZhciBrZXkgaW4gbykge1xuXHRcdFx0XHRcdFx0aWYgKG8uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuXHRcdFx0XHRcdFx0XHRjbG9uZVtrZXldID0gXy51dGlsLmNsb25lKG9ba2V5XSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIGNsb25lO1xuXG5cdFx0XHRcdGNhc2UgJ0FycmF5Jzpcblx0XHRcdFx0XHQvLyBDaGVjayBmb3IgZXhpc3RlbmNlIGZvciBJRThcblx0XHRcdFx0XHRyZXR1cm4gby5tYXAgJiYgby5tYXAoZnVuY3Rpb24odikgeyByZXR1cm4gXy51dGlsLmNsb25lKHYpOyB9KTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG87XG5cdFx0fVxuXHR9LFxuXG5cdGxhbmd1YWdlczoge1xuXHRcdGV4dGVuZDogZnVuY3Rpb24gKGlkLCByZWRlZikge1xuXHRcdFx0dmFyIGxhbmcgPSBfLnV0aWwuY2xvbmUoXy5sYW5ndWFnZXNbaWRdKTtcblxuXHRcdFx0Zm9yICh2YXIga2V5IGluIHJlZGVmKSB7XG5cdFx0XHRcdGxhbmdba2V5XSA9IHJlZGVmW2tleV07XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBsYW5nO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQgKiBJbnNlcnQgYSB0b2tlbiBiZWZvcmUgYW5vdGhlciB0b2tlbiBpbiBhIGxhbmd1YWdlIGxpdGVyYWxcblx0XHQgKiBBcyB0aGlzIG5lZWRzIHRvIHJlY3JlYXRlIHRoZSBvYmplY3QgKHdlIGNhbm5vdCBhY3R1YWxseSBpbnNlcnQgYmVmb3JlIGtleXMgaW4gb2JqZWN0IGxpdGVyYWxzKSxcblx0XHQgKiB3ZSBjYW5ub3QganVzdCBwcm92aWRlIGFuIG9iamVjdCwgd2UgbmVlZCBhbm9iamVjdCBhbmQgYSBrZXkuXG5cdFx0ICogQHBhcmFtIGluc2lkZSBUaGUga2V5IChvciBsYW5ndWFnZSBpZCkgb2YgdGhlIHBhcmVudFxuXHRcdCAqIEBwYXJhbSBiZWZvcmUgVGhlIGtleSB0byBpbnNlcnQgYmVmb3JlLiBJZiBub3QgcHJvdmlkZWQsIHRoZSBmdW5jdGlvbiBhcHBlbmRzIGluc3RlYWQuXG5cdFx0ICogQHBhcmFtIGluc2VydCBPYmplY3Qgd2l0aCB0aGUga2V5L3ZhbHVlIHBhaXJzIHRvIGluc2VydFxuXHRcdCAqIEBwYXJhbSByb290IFRoZSBvYmplY3QgdGhhdCBjb250YWlucyBgaW5zaWRlYC4gSWYgZXF1YWwgdG8gUHJpc20ubGFuZ3VhZ2VzLCBpdCBjYW4gYmUgb21pdHRlZC5cblx0XHQgKi9cblx0XHRpbnNlcnRCZWZvcmU6IGZ1bmN0aW9uIChpbnNpZGUsIGJlZm9yZSwgaW5zZXJ0LCByb290KSB7XG5cdFx0XHRyb290ID0gcm9vdCB8fCBfLmxhbmd1YWdlcztcblx0XHRcdHZhciBncmFtbWFyID0gcm9vdFtpbnNpZGVdO1xuXG5cdFx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSAyKSB7XG5cdFx0XHRcdGluc2VydCA9IGFyZ3VtZW50c1sxXTtcblxuXHRcdFx0XHRmb3IgKHZhciBuZXdUb2tlbiBpbiBpbnNlcnQpIHtcblx0XHRcdFx0XHRpZiAoaW5zZXJ0Lmhhc093blByb3BlcnR5KG5ld1Rva2VuKSkge1xuXHRcdFx0XHRcdFx0Z3JhbW1hcltuZXdUb2tlbl0gPSBpbnNlcnRbbmV3VG9rZW5dO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBncmFtbWFyO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgcmV0ID0ge307XG5cblx0XHRcdGZvciAodmFyIHRva2VuIGluIGdyYW1tYXIpIHtcblxuXHRcdFx0XHRpZiAoZ3JhbW1hci5oYXNPd25Qcm9wZXJ0eSh0b2tlbikpIHtcblxuXHRcdFx0XHRcdGlmICh0b2tlbiA9PSBiZWZvcmUpIHtcblxuXHRcdFx0XHRcdFx0Zm9yICh2YXIgbmV3VG9rZW4gaW4gaW5zZXJ0KSB7XG5cblx0XHRcdFx0XHRcdFx0aWYgKGluc2VydC5oYXNPd25Qcm9wZXJ0eShuZXdUb2tlbikpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXRbbmV3VG9rZW5dID0gaW5zZXJ0W25ld1Rva2VuXTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldFt0b2tlbl0gPSBncmFtbWFyW3Rva2VuXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBVcGRhdGUgcmVmZXJlbmNlcyBpbiBvdGhlciBsYW5ndWFnZSBkZWZpbml0aW9uc1xuXHRcdFx0Xy5sYW5ndWFnZXMuREZTKF8ubGFuZ3VhZ2VzLCBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG5cdFx0XHRcdGlmICh2YWx1ZSA9PT0gcm9vdFtpbnNpZGVdICYmIGtleSAhPSBpbnNpZGUpIHtcblx0XHRcdFx0XHR0aGlzW2tleV0gPSByZXQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gcm9vdFtpbnNpZGVdID0gcmV0O1xuXHRcdH0sXG5cblx0XHQvLyBUcmF2ZXJzZSBhIGxhbmd1YWdlIGRlZmluaXRpb24gd2l0aCBEZXB0aCBGaXJzdCBTZWFyY2hcblx0XHRERlM6IGZ1bmN0aW9uKG8sIGNhbGxiYWNrLCB0eXBlLCB2aXNpdGVkKSB7XG5cdFx0XHR2aXNpdGVkID0gdmlzaXRlZCB8fCB7fTtcblx0XHRcdGZvciAodmFyIGkgaW4gbykge1xuXHRcdFx0XHRpZiAoby5oYXNPd25Qcm9wZXJ0eShpKSkge1xuXHRcdFx0XHRcdGNhbGxiYWNrLmNhbGwobywgaSwgb1tpXSwgdHlwZSB8fCBpKTtcblxuXHRcdFx0XHRcdGlmIChfLnV0aWwudHlwZShvW2ldKSA9PT0gJ09iamVjdCcgJiYgIXZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSkge1xuXHRcdFx0XHRcdFx0dmlzaXRlZFtfLnV0aWwub2JqSWQob1tpXSldID0gdHJ1ZTtcblx0XHRcdFx0XHRcdF8ubGFuZ3VhZ2VzLkRGUyhvW2ldLCBjYWxsYmFjaywgbnVsbCwgdmlzaXRlZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2UgaWYgKF8udXRpbC50eXBlKG9baV0pID09PSAnQXJyYXknICYmICF2aXNpdGVkW18udXRpbC5vYmpJZChvW2ldKV0pIHtcblx0XHRcdFx0XHRcdHZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSA9IHRydWU7XG5cdFx0XHRcdFx0XHRfLmxhbmd1YWdlcy5ERlMob1tpXSwgY2FsbGJhY2ssIGksIHZpc2l0ZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSxcblx0cGx1Z2luczoge30sXG5cblx0aGlnaGxpZ2h0QWxsOiBmdW5jdGlvbihhc3luYywgY2FsbGJhY2spIHtcblx0XHR2YXIgZW52ID0ge1xuXHRcdFx0Y2FsbGJhY2s6IGNhbGxiYWNrLFxuXHRcdFx0c2VsZWN0b3I6ICdjb2RlW2NsYXNzKj1cImxhbmd1YWdlLVwiXSwgW2NsYXNzKj1cImxhbmd1YWdlLVwiXSBjb2RlLCBjb2RlW2NsYXNzKj1cImxhbmctXCJdLCBbY2xhc3MqPVwibGFuZy1cIl0gY29kZSdcblx0XHR9O1xuXG5cdFx0Xy5ob29rcy5ydW4oXCJiZWZvcmUtaGlnaGxpZ2h0YWxsXCIsIGVudik7XG5cblx0XHR2YXIgZWxlbWVudHMgPSBlbnYuZWxlbWVudHMgfHwgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChlbnYuc2VsZWN0b3IpO1xuXG5cdFx0Zm9yICh2YXIgaT0wLCBlbGVtZW50OyBlbGVtZW50ID0gZWxlbWVudHNbaSsrXTspIHtcblx0XHRcdF8uaGlnaGxpZ2h0RWxlbWVudChlbGVtZW50LCBhc3luYyA9PT0gdHJ1ZSwgZW52LmNhbGxiYWNrKTtcblx0XHR9XG5cdH0sXG5cblx0aGlnaGxpZ2h0RWxlbWVudDogZnVuY3Rpb24oZWxlbWVudCwgYXN5bmMsIGNhbGxiYWNrKSB7XG5cdFx0Ly8gRmluZCBsYW5ndWFnZVxuXHRcdHZhciBsYW5ndWFnZSwgZ3JhbW1hciwgcGFyZW50ID0gZWxlbWVudDtcblxuXHRcdHdoaWxlIChwYXJlbnQgJiYgIWxhbmcudGVzdChwYXJlbnQuY2xhc3NOYW1lKSkge1xuXHRcdFx0cGFyZW50ID0gcGFyZW50LnBhcmVudE5vZGU7XG5cdFx0fVxuXG5cdFx0aWYgKHBhcmVudCkge1xuXHRcdFx0bGFuZ3VhZ2UgPSAocGFyZW50LmNsYXNzTmFtZS5tYXRjaChsYW5nKSB8fCBbLCcnXSlbMV0udG9Mb3dlckNhc2UoKTtcblx0XHRcdGdyYW1tYXIgPSBfLmxhbmd1YWdlc1tsYW5ndWFnZV07XG5cdFx0fVxuXG5cdFx0Ly8gU2V0IGxhbmd1YWdlIG9uIHRoZSBlbGVtZW50LCBpZiBub3QgcHJlc2VudFxuXHRcdGVsZW1lbnQuY2xhc3NOYW1lID0gZWxlbWVudC5jbGFzc05hbWUucmVwbGFjZShsYW5nLCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpICsgJyBsYW5ndWFnZS0nICsgbGFuZ3VhZ2U7XG5cblx0XHQvLyBTZXQgbGFuZ3VhZ2Ugb24gdGhlIHBhcmVudCwgZm9yIHN0eWxpbmdcblx0XHRwYXJlbnQgPSBlbGVtZW50LnBhcmVudE5vZGU7XG5cblx0XHRpZiAoL3ByZS9pLnRlc3QocGFyZW50Lm5vZGVOYW1lKSkge1xuXHRcdFx0cGFyZW50LmNsYXNzTmFtZSA9IHBhcmVudC5jbGFzc05hbWUucmVwbGFjZShsYW5nLCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpICsgJyBsYW5ndWFnZS0nICsgbGFuZ3VhZ2U7XG5cdFx0fVxuXG5cdFx0dmFyIGNvZGUgPSBlbGVtZW50LnRleHRDb250ZW50O1xuXG5cdFx0dmFyIGVudiA9IHtcblx0XHRcdGVsZW1lbnQ6IGVsZW1lbnQsXG5cdFx0XHRsYW5ndWFnZTogbGFuZ3VhZ2UsXG5cdFx0XHRncmFtbWFyOiBncmFtbWFyLFxuXHRcdFx0Y29kZTogY29kZVxuXHRcdH07XG5cblx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLXNhbml0eS1jaGVjaycsIGVudik7XG5cblx0XHRpZiAoIWVudi5jb2RlIHx8ICFlbnYuZ3JhbW1hcikge1xuXHRcdFx0aWYgKGVudi5jb2RlKSB7XG5cdFx0XHRcdGVudi5lbGVtZW50LnRleHRDb250ZW50ID0gZW52LmNvZGU7XG5cdFx0XHR9XG5cdFx0XHRfLmhvb2tzLnJ1bignY29tcGxldGUnLCBlbnYpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaGlnaGxpZ2h0JywgZW52KTtcblxuXHRcdGlmIChhc3luYyAmJiBfc2VsZi5Xb3JrZXIpIHtcblx0XHRcdHZhciB3b3JrZXIgPSBuZXcgV29ya2VyKF8uZmlsZW5hbWUpO1xuXG5cdFx0XHR3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZXZ0KSB7XG5cdFx0XHRcdGVudi5oaWdobGlnaHRlZENvZGUgPSBldnQuZGF0YTtcblxuXHRcdFx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWluc2VydCcsIGVudik7XG5cblx0XHRcdFx0ZW52LmVsZW1lbnQuaW5uZXJIVE1MID0gZW52LmhpZ2hsaWdodGVkQ29kZTtcblxuXHRcdFx0XHRjYWxsYmFjayAmJiBjYWxsYmFjay5jYWxsKGVudi5lbGVtZW50KTtcblx0XHRcdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLWhpZ2hsaWdodCcsIGVudik7XG5cdFx0XHRcdF8uaG9va3MucnVuKCdjb21wbGV0ZScsIGVudik7XG5cdFx0XHR9O1xuXG5cdFx0XHR3b3JrZXIucG9zdE1lc3NhZ2UoSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHRsYW5ndWFnZTogZW52Lmxhbmd1YWdlLFxuXHRcdFx0XHRjb2RlOiBlbnYuY29kZSxcblx0XHRcdFx0aW1tZWRpYXRlQ2xvc2U6IHRydWVcblx0XHRcdH0pKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRlbnYuaGlnaGxpZ2h0ZWRDb2RlID0gXy5oaWdobGlnaHQoZW52LmNvZGUsIGVudi5ncmFtbWFyLCBlbnYubGFuZ3VhZ2UpO1xuXG5cdFx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWluc2VydCcsIGVudik7XG5cblx0XHRcdGVudi5lbGVtZW50LmlubmVySFRNTCA9IGVudi5oaWdobGlnaHRlZENvZGU7XG5cblx0XHRcdGNhbGxiYWNrICYmIGNhbGxiYWNrLmNhbGwoZWxlbWVudCk7XG5cblx0XHRcdF8uaG9va3MucnVuKCdhZnRlci1oaWdobGlnaHQnLCBlbnYpO1xuXHRcdFx0Xy5ob29rcy5ydW4oJ2NvbXBsZXRlJywgZW52KTtcblx0XHR9XG5cdH0sXG5cblx0aGlnaGxpZ2h0OiBmdW5jdGlvbiAodGV4dCwgZ3JhbW1hciwgbGFuZ3VhZ2UpIHtcblx0XHR2YXIgdG9rZW5zID0gXy50b2tlbml6ZSh0ZXh0LCBncmFtbWFyKTtcblx0XHRyZXR1cm4gVG9rZW4uc3RyaW5naWZ5KF8udXRpbC5lbmNvZGUodG9rZW5zKSwgbGFuZ3VhZ2UpO1xuXHR9LFxuXG5cdHRva2VuaXplOiBmdW5jdGlvbih0ZXh0LCBncmFtbWFyLCBsYW5ndWFnZSkge1xuXHRcdHZhciBUb2tlbiA9IF8uVG9rZW47XG5cblx0XHR2YXIgc3RyYXJyID0gW3RleHRdO1xuXG5cdFx0dmFyIHJlc3QgPSBncmFtbWFyLnJlc3Q7XG5cblx0XHRpZiAocmVzdCkge1xuXHRcdFx0Zm9yICh2YXIgdG9rZW4gaW4gcmVzdCkge1xuXHRcdFx0XHRncmFtbWFyW3Rva2VuXSA9IHJlc3RbdG9rZW5dO1xuXHRcdFx0fVxuXG5cdFx0XHRkZWxldGUgZ3JhbW1hci5yZXN0O1xuXHRcdH1cblxuXHRcdHRva2VubG9vcDogZm9yICh2YXIgdG9rZW4gaW4gZ3JhbW1hcikge1xuXHRcdFx0aWYoIWdyYW1tYXIuaGFzT3duUHJvcGVydHkodG9rZW4pIHx8ICFncmFtbWFyW3Rva2VuXSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0dmFyIHBhdHRlcm5zID0gZ3JhbW1hclt0b2tlbl07XG5cdFx0XHRwYXR0ZXJucyA9IChfLnV0aWwudHlwZShwYXR0ZXJucykgPT09IFwiQXJyYXlcIikgPyBwYXR0ZXJucyA6IFtwYXR0ZXJuc107XG5cblx0XHRcdGZvciAodmFyIGogPSAwOyBqIDwgcGF0dGVybnMubGVuZ3RoOyArK2opIHtcblx0XHRcdFx0dmFyIHBhdHRlcm4gPSBwYXR0ZXJuc1tqXSxcblx0XHRcdFx0XHRpbnNpZGUgPSBwYXR0ZXJuLmluc2lkZSxcblx0XHRcdFx0XHRsb29rYmVoaW5kID0gISFwYXR0ZXJuLmxvb2tiZWhpbmQsXG5cdFx0XHRcdFx0Z3JlZWR5ID0gISFwYXR0ZXJuLmdyZWVkeSxcblx0XHRcdFx0XHRsb29rYmVoaW5kTGVuZ3RoID0gMCxcblx0XHRcdFx0XHRhbGlhcyA9IHBhdHRlcm4uYWxpYXM7XG5cblx0XHRcdFx0aWYgKGdyZWVkeSAmJiAhcGF0dGVybi5wYXR0ZXJuLmdsb2JhbCkge1xuXHRcdFx0XHRcdC8vIFdpdGhvdXQgdGhlIGdsb2JhbCBmbGFnLCBsYXN0SW5kZXggd29uJ3Qgd29ya1xuXHRcdFx0XHRcdHZhciBmbGFncyA9IHBhdHRlcm4ucGF0dGVybi50b1N0cmluZygpLm1hdGNoKC9baW11eV0qJC8pWzBdO1xuXHRcdFx0XHRcdHBhdHRlcm4ucGF0dGVybiA9IFJlZ0V4cChwYXR0ZXJuLnBhdHRlcm4uc291cmNlLCBmbGFncyArIFwiZ1wiKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHBhdHRlcm4gPSBwYXR0ZXJuLnBhdHRlcm4gfHwgcGF0dGVybjtcblxuXHRcdFx0XHQvLyBEb27igJl0IGNhY2hlIGxlbmd0aCBhcyBpdCBjaGFuZ2VzIGR1cmluZyB0aGUgbG9vcFxuXHRcdFx0XHRmb3IgKHZhciBpPTAsIHBvcyA9IDA7IGk8c3RyYXJyLmxlbmd0aDsgcG9zICs9IHN0cmFycltpXS5sZW5ndGgsICsraSkge1xuXG5cdFx0XHRcdFx0dmFyIHN0ciA9IHN0cmFycltpXTtcblxuXHRcdFx0XHRcdGlmIChzdHJhcnIubGVuZ3RoID4gdGV4dC5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdC8vIFNvbWV0aGluZyB3ZW50IHRlcnJpYmx5IHdyb25nLCBBQk9SVCwgQUJPUlQhXG5cdFx0XHRcdFx0XHRicmVhayB0b2tlbmxvb3A7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHN0ciBpbnN0YW5jZW9mIFRva2VuKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRwYXR0ZXJuLmxhc3RJbmRleCA9IDA7XG5cblx0XHRcdFx0XHR2YXIgbWF0Y2ggPSBwYXR0ZXJuLmV4ZWMoc3RyKSxcblx0XHRcdFx0XHQgICAgZGVsTnVtID0gMTtcblxuXHRcdFx0XHRcdC8vIEdyZWVkeSBwYXR0ZXJucyBjYW4gb3ZlcnJpZGUvcmVtb3ZlIHVwIHRvIHR3byBwcmV2aW91c2x5IG1hdGNoZWQgdG9rZW5zXG5cdFx0XHRcdFx0aWYgKCFtYXRjaCAmJiBncmVlZHkgJiYgaSAhPSBzdHJhcnIubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRcdFx0cGF0dGVybi5sYXN0SW5kZXggPSBwb3M7XG5cdFx0XHRcdFx0XHRtYXRjaCA9IHBhdHRlcm4uZXhlYyh0ZXh0KTtcblx0XHRcdFx0XHRcdGlmICghbWF0Y2gpIHtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHZhciBmcm9tID0gbWF0Y2guaW5kZXggKyAobG9va2JlaGluZCA/IG1hdGNoWzFdLmxlbmd0aCA6IDApLFxuXHRcdFx0XHRcdFx0ICAgIHRvID0gbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGgsXG5cdFx0XHRcdFx0XHQgICAgayA9IGksXG5cdFx0XHRcdFx0XHQgICAgcCA9IHBvcztcblxuXHRcdFx0XHRcdFx0Zm9yICh2YXIgbGVuID0gc3RyYXJyLmxlbmd0aDsgayA8IGxlbiAmJiBwIDwgdG87ICsraykge1xuXHRcdFx0XHRcdFx0XHRwICs9IHN0cmFycltrXS5sZW5ndGg7XG5cdFx0XHRcdFx0XHRcdC8vIE1vdmUgdGhlIGluZGV4IGkgdG8gdGhlIGVsZW1lbnQgaW4gc3RyYXJyIHRoYXQgaXMgY2xvc2VzdCB0byBmcm9tXG5cdFx0XHRcdFx0XHRcdGlmIChmcm9tID49IHApIHtcblx0XHRcdFx0XHRcdFx0XHQrK2k7XG5cdFx0XHRcdFx0XHRcdFx0cG9zID0gcDtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvKlxuXHRcdFx0XHRcdFx0ICogSWYgc3RyYXJyW2ldIGlzIGEgVG9rZW4sIHRoZW4gdGhlIG1hdGNoIHN0YXJ0cyBpbnNpZGUgYW5vdGhlciBUb2tlbiwgd2hpY2ggaXMgaW52YWxpZFxuXHRcdFx0XHRcdFx0ICogSWYgc3RyYXJyW2sgLSAxXSBpcyBncmVlZHkgd2UgYXJlIGluIGNvbmZsaWN0IHdpdGggYW5vdGhlciBncmVlZHkgcGF0dGVyblxuXHRcdFx0XHRcdFx0ICovXG5cdFx0XHRcdFx0XHRpZiAoc3RyYXJyW2ldIGluc3RhbmNlb2YgVG9rZW4gfHwgc3RyYXJyW2sgLSAxXS5ncmVlZHkpIHtcblx0XHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8vIE51bWJlciBvZiB0b2tlbnMgdG8gZGVsZXRlIGFuZCByZXBsYWNlIHdpdGggdGhlIG5ldyBtYXRjaFxuXHRcdFx0XHRcdFx0ZGVsTnVtID0gayAtIGk7XG5cdFx0XHRcdFx0XHRzdHIgPSB0ZXh0LnNsaWNlKHBvcywgcCk7XG5cdFx0XHRcdFx0XHRtYXRjaC5pbmRleCAtPSBwb3M7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKCFtYXRjaCkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYobG9va2JlaGluZCkge1xuXHRcdFx0XHRcdFx0bG9va2JlaGluZExlbmd0aCA9IG1hdGNoWzFdLmxlbmd0aDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR2YXIgZnJvbSA9IG1hdGNoLmluZGV4ICsgbG9va2JlaGluZExlbmd0aCxcblx0XHRcdFx0XHQgICAgbWF0Y2ggPSBtYXRjaFswXS5zbGljZShsb29rYmVoaW5kTGVuZ3RoKSxcblx0XHRcdFx0XHQgICAgdG8gPSBmcm9tICsgbWF0Y2gubGVuZ3RoLFxuXHRcdFx0XHRcdCAgICBiZWZvcmUgPSBzdHIuc2xpY2UoMCwgZnJvbSksXG5cdFx0XHRcdFx0ICAgIGFmdGVyID0gc3RyLnNsaWNlKHRvKTtcblxuXHRcdFx0XHRcdHZhciBhcmdzID0gW2ksIGRlbE51bV07XG5cblx0XHRcdFx0XHRpZiAoYmVmb3JlKSB7XG5cdFx0XHRcdFx0XHRhcmdzLnB1c2goYmVmb3JlKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR2YXIgd3JhcHBlZCA9IG5ldyBUb2tlbih0b2tlbiwgaW5zaWRlPyBfLnRva2VuaXplKG1hdGNoLCBpbnNpZGUpIDogbWF0Y2gsIGFsaWFzLCBtYXRjaCwgZ3JlZWR5KTtcblxuXHRcdFx0XHRcdGFyZ3MucHVzaCh3cmFwcGVkKTtcblxuXHRcdFx0XHRcdGlmIChhZnRlcikge1xuXHRcdFx0XHRcdFx0YXJncy5wdXNoKGFmdGVyKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KHN0cmFyciwgYXJncyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gc3RyYXJyO1xuXHR9LFxuXG5cdGhvb2tzOiB7XG5cdFx0YWxsOiB7fSxcblxuXHRcdGFkZDogZnVuY3Rpb24gKG5hbWUsIGNhbGxiYWNrKSB7XG5cdFx0XHR2YXIgaG9va3MgPSBfLmhvb2tzLmFsbDtcblxuXHRcdFx0aG9va3NbbmFtZV0gPSBob29rc1tuYW1lXSB8fCBbXTtcblxuXHRcdFx0aG9va3NbbmFtZV0ucHVzaChjYWxsYmFjayk7XG5cdFx0fSxcblxuXHRcdHJ1bjogZnVuY3Rpb24gKG5hbWUsIGVudikge1xuXHRcdFx0dmFyIGNhbGxiYWNrcyA9IF8uaG9va3MuYWxsW25hbWVdO1xuXG5cdFx0XHRpZiAoIWNhbGxiYWNrcyB8fCAhY2FsbGJhY2tzLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGZvciAodmFyIGk9MCwgY2FsbGJhY2s7IGNhbGxiYWNrID0gY2FsbGJhY2tzW2krK107KSB7XG5cdFx0XHRcdGNhbGxiYWNrKGVudik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59O1xuXG52YXIgVG9rZW4gPSBfLlRva2VuID0gZnVuY3Rpb24odHlwZSwgY29udGVudCwgYWxpYXMsIG1hdGNoZWRTdHIsIGdyZWVkeSkge1xuXHR0aGlzLnR5cGUgPSB0eXBlO1xuXHR0aGlzLmNvbnRlbnQgPSBjb250ZW50O1xuXHR0aGlzLmFsaWFzID0gYWxpYXM7XG5cdC8vIENvcHkgb2YgdGhlIGZ1bGwgc3RyaW5nIHRoaXMgdG9rZW4gd2FzIGNyZWF0ZWQgZnJvbVxuXHR0aGlzLmxlbmd0aCA9IChtYXRjaGVkU3RyIHx8IFwiXCIpLmxlbmd0aHwwO1xuXHR0aGlzLmdyZWVkeSA9ICEhZ3JlZWR5O1xufTtcblxuVG9rZW4uc3RyaW5naWZ5ID0gZnVuY3Rpb24obywgbGFuZ3VhZ2UsIHBhcmVudCkge1xuXHRpZiAodHlwZW9mIG8gPT0gJ3N0cmluZycpIHtcblx0XHRyZXR1cm4gbztcblx0fVxuXG5cdGlmIChfLnV0aWwudHlwZShvKSA9PT0gJ0FycmF5Jykge1xuXHRcdHJldHVybiBvLm1hcChmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gVG9rZW4uc3RyaW5naWZ5KGVsZW1lbnQsIGxhbmd1YWdlLCBvKTtcblx0XHR9KS5qb2luKCcnKTtcblx0fVxuXG5cdHZhciBlbnYgPSB7XG5cdFx0dHlwZTogby50eXBlLFxuXHRcdGNvbnRlbnQ6IFRva2VuLnN0cmluZ2lmeShvLmNvbnRlbnQsIGxhbmd1YWdlLCBwYXJlbnQpLFxuXHRcdHRhZzogJ3NwYW4nLFxuXHRcdGNsYXNzZXM6IFsndG9rZW4nLCBvLnR5cGVdLFxuXHRcdGF0dHJpYnV0ZXM6IHt9LFxuXHRcdGxhbmd1YWdlOiBsYW5ndWFnZSxcblx0XHRwYXJlbnQ6IHBhcmVudFxuXHR9O1xuXG5cdGlmIChlbnYudHlwZSA9PSAnY29tbWVudCcpIHtcblx0XHRlbnYuYXR0cmlidXRlc1snc3BlbGxjaGVjayddID0gJ3RydWUnO1xuXHR9XG5cblx0aWYgKG8uYWxpYXMpIHtcblx0XHR2YXIgYWxpYXNlcyA9IF8udXRpbC50eXBlKG8uYWxpYXMpID09PSAnQXJyYXknID8gby5hbGlhcyA6IFtvLmFsaWFzXTtcblx0XHRBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShlbnYuY2xhc3NlcywgYWxpYXNlcyk7XG5cdH1cblxuXHRfLmhvb2tzLnJ1bignd3JhcCcsIGVudik7XG5cblx0dmFyIGF0dHJpYnV0ZXMgPSBPYmplY3Qua2V5cyhlbnYuYXR0cmlidXRlcykubWFwKGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRyZXR1cm4gbmFtZSArICc9XCInICsgKGVudi5hdHRyaWJ1dGVzW25hbWVdIHx8ICcnKS5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7JykgKyAnXCInO1xuXHR9KS5qb2luKCcgJyk7XG5cblx0cmV0dXJuICc8JyArIGVudi50YWcgKyAnIGNsYXNzPVwiJyArIGVudi5jbGFzc2VzLmpvaW4oJyAnKSArICdcIicgKyAoYXR0cmlidXRlcyA/ICcgJyArIGF0dHJpYnV0ZXMgOiAnJykgKyAnPicgKyBlbnYuY29udGVudCArICc8LycgKyBlbnYudGFnICsgJz4nO1xuXG59O1xuXG5pZiAoIV9zZWxmLmRvY3VtZW50KSB7XG5cdGlmICghX3NlbGYuYWRkRXZlbnRMaXN0ZW5lcikge1xuXHRcdC8vIGluIE5vZGUuanNcblx0XHRyZXR1cm4gX3NlbGYuUHJpc207XG5cdH1cbiBcdC8vIEluIHdvcmtlclxuXHRfc2VsZi5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24oZXZ0KSB7XG5cdFx0dmFyIG1lc3NhZ2UgPSBKU09OLnBhcnNlKGV2dC5kYXRhKSxcblx0XHQgICAgbGFuZyA9IG1lc3NhZ2UubGFuZ3VhZ2UsXG5cdFx0ICAgIGNvZGUgPSBtZXNzYWdlLmNvZGUsXG5cdFx0ICAgIGltbWVkaWF0ZUNsb3NlID0gbWVzc2FnZS5pbW1lZGlhdGVDbG9zZTtcblxuXHRcdF9zZWxmLnBvc3RNZXNzYWdlKF8uaGlnaGxpZ2h0KGNvZGUsIF8ubGFuZ3VhZ2VzW2xhbmddLCBsYW5nKSk7XG5cdFx0aWYgKGltbWVkaWF0ZUNsb3NlKSB7XG5cdFx0XHRfc2VsZi5jbG9zZSgpO1xuXHRcdH1cblx0fSwgZmFsc2UpO1xuXG5cdHJldHVybiBfc2VsZi5QcmlzbTtcbn1cblxuLy9HZXQgY3VycmVudCBzY3JpcHQgYW5kIGhpZ2hsaWdodFxudmFyIHNjcmlwdCA9IGRvY3VtZW50LmN1cnJlbnRTY3JpcHQgfHwgW10uc2xpY2UuY2FsbChkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShcInNjcmlwdFwiKSkucG9wKCk7XG5cbmlmIChzY3JpcHQpIHtcblx0Xy5maWxlbmFtZSA9IHNjcmlwdC5zcmM7XG5cblx0aWYgKGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIgJiYgIXNjcmlwdC5oYXNBdHRyaWJ1dGUoJ2RhdGEtbWFudWFsJykpIHtcblx0XHRpZihkb2N1bWVudC5yZWFkeVN0YXRlICE9PSBcImxvYWRpbmdcIikge1xuXHRcdFx0aWYgKHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUpIHtcblx0XHRcdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShfLmhpZ2hsaWdodEFsbCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dChfLmhpZ2hsaWdodEFsbCwgMTYpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBfLmhpZ2hsaWdodEFsbCk7XG5cdFx0fVxuXHR9XG59XG5cbnJldHVybiBfc2VsZi5QcmlzbTtcblxufSkoKTtcblxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG5cdG1vZHVsZS5leHBvcnRzID0gUHJpc207XG59XG5cbi8vIGhhY2sgZm9yIGNvbXBvbmVudHMgdG8gd29yayBjb3JyZWN0bHkgaW4gbm9kZS5qc1xuaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XG5cdGdsb2JhbC5QcmlzbSA9IFByaXNtO1xufVxuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tbWFya3VwLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cblByaXNtLmxhbmd1YWdlcy5tYXJrdXAgPSB7XG5cdCdjb21tZW50JzogLzwhLS1bXFx3XFxXXSo/LS0+Lyxcblx0J3Byb2xvZyc6IC88XFw/W1xcd1xcV10rP1xcPz4vLFxuXHQnZG9jdHlwZSc6IC88IURPQ1RZUEVbXFx3XFxXXSs/Pi9pLFxuXHQnY2RhdGEnOiAvPCFcXFtDREFUQVxcW1tcXHdcXFddKj9dXT4vaSxcblx0J3RhZyc6IHtcblx0XHRwYXR0ZXJuOiAvPFxcLz8oPyFcXGQpW15cXHM+XFwvPSQ8XSsoPzpcXHMrW15cXHM+XFwvPV0rKD86PSg/OihcInwnKSg/OlxcXFxcXDF8XFxcXD8oPyFcXDEpW1xcd1xcV10pKlxcMXxbXlxccydcIj49XSspKT8pKlxccypcXC8/Pi9pLFxuXHRcdGluc2lkZToge1xuXHRcdFx0J3RhZyc6IHtcblx0XHRcdFx0cGF0dGVybjogL148XFwvP1teXFxzPlxcL10rL2ksXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9ePFxcLz8vLFxuXHRcdFx0XHRcdCduYW1lc3BhY2UnOiAvXlteXFxzPlxcLzpdKzovXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHQnYXR0ci12YWx1ZSc6IHtcblx0XHRcdFx0cGF0dGVybjogLz0oPzooJ3xcIilbXFx3XFxXXSo/KFxcMSl8W15cXHM+XSspL2ksXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9bPT5cIiddL1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0J3B1bmN0dWF0aW9uJzogL1xcLz8+Lyxcblx0XHRcdCdhdHRyLW5hbWUnOiB7XG5cdFx0XHRcdHBhdHRlcm46IC9bXlxccz5cXC9dKy8sXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCduYW1lc3BhY2UnOiAvXlteXFxzPlxcLzpdKzovXG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH1cblx0fSxcblx0J2VudGl0eSc6IC8mIz9bXFxkYS16XXsxLDh9Oy9pXG59O1xuXG4vLyBQbHVnaW4gdG8gbWFrZSBlbnRpdHkgdGl0bGUgc2hvdyB0aGUgcmVhbCBlbnRpdHksIGlkZWEgYnkgUm9tYW4gS29tYXJvdlxuUHJpc20uaG9va3MuYWRkKCd3cmFwJywgZnVuY3Rpb24oZW52KSB7XG5cblx0aWYgKGVudi50eXBlID09PSAnZW50aXR5Jykge1xuXHRcdGVudi5hdHRyaWJ1dGVzWyd0aXRsZSddID0gZW52LmNvbnRlbnQucmVwbGFjZSgvJmFtcDsvLCAnJicpO1xuXHR9XG59KTtcblxuUHJpc20ubGFuZ3VhZ2VzLnhtbCA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XG5QcmlzbS5sYW5ndWFnZXMuaHRtbCA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XG5QcmlzbS5sYW5ndWFnZXMubWF0aG1sID0gUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cDtcblByaXNtLmxhbmd1YWdlcy5zdmcgPSBQcmlzbS5sYW5ndWFnZXMubWFya3VwO1xuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY3NzLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cblByaXNtLmxhbmd1YWdlcy5jc3MgPSB7XG5cdCdjb21tZW50JzogL1xcL1xcKltcXHdcXFddKj9cXCpcXC8vLFxuXHQnYXRydWxlJzoge1xuXHRcdHBhdHRlcm46IC9AW1xcdy1dKz8uKj8oO3woPz1cXHMqXFx7KSkvaSxcblx0XHRpbnNpZGU6IHtcblx0XHRcdCdydWxlJzogL0BbXFx3LV0rL1xuXHRcdFx0Ly8gU2VlIHJlc3QgYmVsb3dcblx0XHR9XG5cdH0sXG5cdCd1cmwnOiAvdXJsXFwoKD86KFtcIiddKShcXFxcKD86XFxyXFxufFtcXHdcXFddKXwoPyFcXDEpW15cXFxcXFxyXFxuXSkqXFwxfC4qPylcXCkvaSxcblx0J3NlbGVjdG9yJzogL1teXFx7XFx9XFxzXVteXFx7XFx9O10qPyg/PVxccypcXHspLyxcblx0J3N0cmluZyc6IHtcblx0XHRwYXR0ZXJuOiAvKFwifCcpKFxcXFwoPzpcXHJcXG58W1xcd1xcV10pfCg/IVxcMSlbXlxcXFxcXHJcXG5dKSpcXDEvLFxuXHRcdGdyZWVkeTogdHJ1ZVxuXHR9LFxuXHQncHJvcGVydHknOiAvKFxcYnxcXEIpW1xcdy1dKyg/PVxccyo6KS9pLFxuXHQnaW1wb3J0YW50JzogL1xcQiFpbXBvcnRhbnRcXGIvaSxcblx0J2Z1bmN0aW9uJzogL1stYS16MC05XSsoPz1cXCgpL2ksXG5cdCdwdW5jdHVhdGlvbic6IC9bKCl7fTs6XS9cbn07XG5cblByaXNtLmxhbmd1YWdlcy5jc3NbJ2F0cnVsZSddLmluc2lkZS5yZXN0ID0gUHJpc20udXRpbC5jbG9uZShQcmlzbS5sYW5ndWFnZXMuY3NzKTtcblxuaWYgKFByaXNtLmxhbmd1YWdlcy5tYXJrdXApIHtcblx0UHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnbWFya3VwJywgJ3RhZycsIHtcblx0XHQnc3R5bGUnOiB7XG5cdFx0XHRwYXR0ZXJuOiAvKDxzdHlsZVtcXHdcXFddKj8+KVtcXHdcXFddKj8oPz08XFwvc3R5bGU+KS9pLFxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZSxcblx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLmNzcyxcblx0XHRcdGFsaWFzOiAnbGFuZ3VhZ2UtY3NzJ1xuXHRcdH1cblx0fSk7XG5cdFxuXHRQcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdpbnNpZGUnLCAnYXR0ci12YWx1ZScsIHtcblx0XHQnc3R5bGUtYXR0cic6IHtcblx0XHRcdHBhdHRlcm46IC9cXHMqc3R5bGU9KFwifCcpLio/XFwxL2ksXG5cdFx0XHRpbnNpZGU6IHtcblx0XHRcdFx0J2F0dHItbmFtZSc6IHtcblx0XHRcdFx0XHRwYXR0ZXJuOiAvXlxccypzdHlsZS9pLFxuXHRcdFx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cC50YWcuaW5zaWRlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9eXFxzKj1cXHMqWydcIl18WydcIl1cXHMqJC8sXG5cdFx0XHRcdCdhdHRyLXZhbHVlJzoge1xuXHRcdFx0XHRcdHBhdHRlcm46IC8uKy9pLFxuXHRcdFx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLmNzc1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YWxpYXM6ICdsYW5ndWFnZS1jc3MnXG5cdFx0fVxuXHR9LCBQcmlzbS5sYW5ndWFnZXMubWFya3VwLnRhZyk7XG59XG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY2xpa2UuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuUHJpc20ubGFuZ3VhZ2VzLmNsaWtlID0ge1xuXHQnY29tbWVudCc6IFtcblx0XHR7XG5cdFx0XHRwYXR0ZXJuOiAvKF58W15cXFxcXSlcXC9cXCpbXFx3XFxXXSo/XFwqXFwvLyxcblx0XHRcdGxvb2tiZWhpbmQ6IHRydWVcblx0XHR9LFxuXHRcdHtcblx0XHRcdHBhdHRlcm46IC8oXnxbXlxcXFw6XSlcXC9cXC8uKi8sXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlXG5cdFx0fVxuXHRdLFxuXHQnc3RyaW5nJzoge1xuXHRcdHBhdHRlcm46IC8oW1wiJ10pKFxcXFwoPzpcXHJcXG58W1xcc1xcU10pfCg/IVxcMSlbXlxcXFxcXHJcXG5dKSpcXDEvLFxuXHRcdGdyZWVkeTogdHJ1ZVxuXHR9LFxuXHQnY2xhc3MtbmFtZSc6IHtcblx0XHRwYXR0ZXJuOiAvKCg/OlxcYig/OmNsYXNzfGludGVyZmFjZXxleHRlbmRzfGltcGxlbWVudHN8dHJhaXR8aW5zdGFuY2VvZnxuZXcpXFxzKyl8KD86Y2F0Y2hcXHMrXFwoKSlbYS16MC05X1xcLlxcXFxdKy9pLFxuXHRcdGxvb2tiZWhpbmQ6IHRydWUsXG5cdFx0aW5zaWRlOiB7XG5cdFx0XHRwdW5jdHVhdGlvbjogLyhcXC58XFxcXCkvXG5cdFx0fVxuXHR9LFxuXHQna2V5d29yZCc6IC9cXGIoaWZ8ZWxzZXx3aGlsZXxkb3xmb3J8cmV0dXJufGlufGluc3RhbmNlb2Z8ZnVuY3Rpb258bmV3fHRyeXx0aHJvd3xjYXRjaHxmaW5hbGx5fG51bGx8YnJlYWt8Y29udGludWUpXFxiLyxcblx0J2Jvb2xlYW4nOiAvXFxiKHRydWV8ZmFsc2UpXFxiLyxcblx0J2Z1bmN0aW9uJzogL1thLXowLTlfXSsoPz1cXCgpL2ksXG5cdCdudW1iZXInOiAvXFxiLT8oPzoweFtcXGRhLWZdK3xcXGQqXFwuP1xcZCsoPzplWystXT9cXGQrKT8pXFxiL2ksXG5cdCdvcGVyYXRvcic6IC8tLT98XFwrXFwrP3whPT89P3w8PT98Pj0/fD09Pz0/fCYmP3xcXHxcXHw/fFxcP3xcXCp8XFwvfH58XFxefCUvLFxuXHQncHVuY3R1YXRpb24nOiAvW3t9W1xcXTsoKSwuOl0vXG59O1xuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tamF2YXNjcmlwdC5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG5QcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdCA9IFByaXNtLmxhbmd1YWdlcy5leHRlbmQoJ2NsaWtlJywge1xuXHQna2V5d29yZCc6IC9cXGIoYXN8YXN5bmN8YXdhaXR8YnJlYWt8Y2FzZXxjYXRjaHxjbGFzc3xjb25zdHxjb250aW51ZXxkZWJ1Z2dlcnxkZWZhdWx0fGRlbGV0ZXxkb3xlbHNlfGVudW18ZXhwb3J0fGV4dGVuZHN8ZmluYWxseXxmb3J8ZnJvbXxmdW5jdGlvbnxnZXR8aWZ8aW1wbGVtZW50c3xpbXBvcnR8aW58aW5zdGFuY2VvZnxpbnRlcmZhY2V8bGV0fG5ld3xudWxsfG9mfHBhY2thZ2V8cHJpdmF0ZXxwcm90ZWN0ZWR8cHVibGljfHJldHVybnxzZXR8c3RhdGljfHN1cGVyfHN3aXRjaHx0aGlzfHRocm93fHRyeXx0eXBlb2Z8dmFyfHZvaWR8d2hpbGV8d2l0aHx5aWVsZClcXGIvLFxuXHQnbnVtYmVyJzogL1xcYi0/KDB4W1xcZEEtRmEtZl0rfDBiWzAxXSt8MG9bMC03XSt8XFxkKlxcLj9cXGQrKFtFZV1bKy1dP1xcZCspP3xOYU58SW5maW5pdHkpXFxiLyxcblx0Ly8gQWxsb3cgZm9yIGFsbCBub24tQVNDSUkgY2hhcmFjdGVycyAoU2VlIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzIwMDg0NDQpXG5cdCdmdW5jdGlvbic6IC9bXyRhLXpBLVpcXHhBMC1cXHVGRkZGXVtfJGEtekEtWjAtOVxceEEwLVxcdUZGRkZdKig/PVxcKCkvaSxcblx0J29wZXJhdG9yJzogLy0tP3xcXCtcXCs/fCE9Pz0/fDw9P3w+PT98PT0/PT98JiY/fFxcfFxcfD98XFw/fFxcKlxcKj98XFwvfH58XFxefCV8XFwuezN9L1xufSk7XG5cblByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ2phdmFzY3JpcHQnLCAna2V5d29yZCcsIHtcblx0J3JlZ2V4Jzoge1xuXHRcdHBhdHRlcm46IC8oXnxbXi9dKVxcLyg/IVxcLykoXFxbLis/XXxcXFxcLnxbXi9cXFxcXFxyXFxuXSkrXFwvW2dpbXl1XXswLDV9KD89XFxzKigkfFtcXHJcXG4sLjt9KV0pKS8sXG5cdFx0bG9va2JlaGluZDogdHJ1ZSxcblx0XHRncmVlZHk6IHRydWVcblx0fVxufSk7XG5cblByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ2phdmFzY3JpcHQnLCAnc3RyaW5nJywge1xuXHQndGVtcGxhdGUtc3RyaW5nJzoge1xuXHRcdHBhdHRlcm46IC9gKD86XFxcXFxcXFx8XFxcXD9bXlxcXFxdKSo/YC8sXG5cdFx0Z3JlZWR5OiB0cnVlLFxuXHRcdGluc2lkZToge1xuXHRcdFx0J2ludGVycG9sYXRpb24nOiB7XG5cdFx0XHRcdHBhdHRlcm46IC9cXCRcXHtbXn1dK1xcfS8sXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCdpbnRlcnBvbGF0aW9uLXB1bmN0dWF0aW9uJzoge1xuXHRcdFx0XHRcdFx0cGF0dGVybjogL15cXCRcXHt8XFx9JC8sXG5cdFx0XHRcdFx0XHRhbGlhczogJ3B1bmN0dWF0aW9uJ1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0cmVzdDogUHJpc20ubGFuZ3VhZ2VzLmphdmFzY3JpcHRcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdCdzdHJpbmcnOiAvW1xcc1xcU10rL1xuXHRcdH1cblx0fVxufSk7XG5cbmlmIChQcmlzbS5sYW5ndWFnZXMubWFya3VwKSB7XG5cdFByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ21hcmt1cCcsICd0YWcnLCB7XG5cdFx0J3NjcmlwdCc6IHtcblx0XHRcdHBhdHRlcm46IC8oPHNjcmlwdFtcXHdcXFddKj8+KVtcXHdcXFddKj8oPz08XFwvc2NyaXB0PikvaSxcblx0XHRcdGxvb2tiZWhpbmQ6IHRydWUsXG5cdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0LFxuXHRcdFx0YWxpYXM6ICdsYW5ndWFnZS1qYXZhc2NyaXB0J1xuXHRcdH1cblx0fSk7XG59XG5cblByaXNtLmxhbmd1YWdlcy5qcyA9IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0O1xuXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLWZpbGUtaGlnaGxpZ2h0LmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cbihmdW5jdGlvbiAoKSB7XG5cdGlmICh0eXBlb2Ygc2VsZiA9PT0gJ3VuZGVmaW5lZCcgfHwgIXNlbGYuUHJpc20gfHwgIXNlbGYuZG9jdW1lbnQgfHwgIWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRzZWxmLlByaXNtLmZpbGVIaWdobGlnaHQgPSBmdW5jdGlvbigpIHtcblxuXHRcdHZhciBFeHRlbnNpb25zID0ge1xuXHRcdFx0J2pzJzogJ2phdmFzY3JpcHQnLFxuXHRcdFx0J3B5JzogJ3B5dGhvbicsXG5cdFx0XHQncmInOiAncnVieScsXG5cdFx0XHQncHMxJzogJ3Bvd2Vyc2hlbGwnLFxuXHRcdFx0J3BzbTEnOiAncG93ZXJzaGVsbCcsXG5cdFx0XHQnc2gnOiAnYmFzaCcsXG5cdFx0XHQnYmF0JzogJ2JhdGNoJyxcblx0XHRcdCdoJzogJ2MnLFxuXHRcdFx0J3RleCc6ICdsYXRleCdcblx0XHR9O1xuXG5cdFx0aWYoQXJyYXkucHJvdG90eXBlLmZvckVhY2gpIHsgLy8gQ2hlY2sgdG8gcHJldmVudCBlcnJvciBpbiBJRThcblx0XHRcdEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3ByZVtkYXRhLXNyY10nKSkuZm9yRWFjaChmdW5jdGlvbiAocHJlKSB7XG5cdFx0XHRcdHZhciBzcmMgPSBwcmUuZ2V0QXR0cmlidXRlKCdkYXRhLXNyYycpO1xuXG5cdFx0XHRcdHZhciBsYW5ndWFnZSwgcGFyZW50ID0gcHJlO1xuXHRcdFx0XHR2YXIgbGFuZyA9IC9cXGJsYW5nKD86dWFnZSk/LSg/IVxcKikoXFx3KylcXGIvaTtcblx0XHRcdFx0d2hpbGUgKHBhcmVudCAmJiAhbGFuZy50ZXN0KHBhcmVudC5jbGFzc05hbWUpKSB7XG5cdFx0XHRcdFx0cGFyZW50ID0gcGFyZW50LnBhcmVudE5vZGU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAocGFyZW50KSB7XG5cdFx0XHRcdFx0bGFuZ3VhZ2UgPSAocHJlLmNsYXNzTmFtZS5tYXRjaChsYW5nKSB8fCBbLCAnJ10pWzFdO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCFsYW5ndWFnZSkge1xuXHRcdFx0XHRcdHZhciBleHRlbnNpb24gPSAoc3JjLm1hdGNoKC9cXC4oXFx3KykkLykgfHwgWywgJyddKVsxXTtcblx0XHRcdFx0XHRsYW5ndWFnZSA9IEV4dGVuc2lvbnNbZXh0ZW5zaW9uXSB8fCBleHRlbnNpb247XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR2YXIgY29kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NvZGUnKTtcblx0XHRcdFx0Y29kZS5jbGFzc05hbWUgPSAnbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xuXG5cdFx0XHRcdHByZS50ZXh0Q29udGVudCA9ICcnO1xuXG5cdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSAnTG9hZGluZ+KApic7XG5cblx0XHRcdFx0cHJlLmFwcGVuZENoaWxkKGNvZGUpO1xuXG5cdFx0XHRcdHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuXHRcdFx0XHR4aHIub3BlbignR0VUJywgc3JjLCB0cnVlKTtcblxuXHRcdFx0XHR4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdGlmICh4aHIucmVhZHlTdGF0ZSA9PSA0KSB7XG5cblx0XHRcdFx0XHRcdGlmICh4aHIuc3RhdHVzIDwgNDAwICYmIHhoci5yZXNwb25zZVRleHQpIHtcblx0XHRcdFx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9IHhoci5yZXNwb25zZVRleHQ7XG5cblx0XHRcdFx0XHRcdFx0UHJpc20uaGlnaGxpZ2h0RWxlbWVudChjb2RlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGVsc2UgaWYgKHhoci5zdGF0dXMgPj0gNDAwKSB7XG5cdFx0XHRcdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSAn4pyWIEVycm9yICcgKyB4aHIuc3RhdHVzICsgJyB3aGlsZSBmZXRjaGluZyBmaWxlOiAnICsgeGhyLnN0YXR1c1RleHQ7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9ICfinJYgRXJyb3I6IEZpbGUgZG9lcyBub3QgZXhpc3Qgb3IgaXMgZW1wdHknO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblxuXHRcdFx0XHR4aHIuc2VuZChudWxsKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHR9O1xuXG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBzZWxmLlByaXNtLmZpbGVIaWdobGlnaHQpO1xuXG59KSgpO1xuIiwiaW1wb3J0IGF2YWxvbmJveCBmcm9tICcuLi8uLi9zcmMvc2NyaXB0cy9hdmFsb25ib3gnO1xuaW1wb3J0IHByaXNtIGZyb20gJ3ByaXNtanMnXG5cblxuZG9jdW1lbnQub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKXtcbiAgaWYoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gJ2NvbXBsZXRlJyl7XG5cbiAgICBhdmFsb25ib3gucnVuKCdpbWFnZS1nYWxsZXJ5LXNpbmdsZScpO1xuICAgIGF2YWxvbmJveC5ydW4oJ2ltYWdlLWdhbGxlcnktbXVsdGlwbGUnKTtcbiAgICBhdmFsb25ib3gucnVuKCdpbWFnZS1nYWxsZXJ5LW1hbnknKTtcbiAgfVxufVxuIiwibW9kdWxlLmV4cG9ydHM9e1xuICBcIm1vZGVcIjogXCJwcm9kXCJcbn1cbiIsImltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi9jb3JlL2h0bWwnXG5pbXBvcnQgYmluZCBmcm9tICcuL2NvcmUvYmluZCdcbmltcG9ydCBkZWxlZ2F0ZSBmcm9tICcuL2NvcmUvZGVsZWdhdGUnXG5cbmltcG9ydCBEaXJlY3Rpb24gZnJvbSAnLi9jb25zdGFudHMvRGlyZWN0aW9uJ1xuaW1wb3J0IEFwcENvbnN0YW50cyBmcm9tICcuL2NvbnN0YW50cy9BcHBDb25zdGFudHMnXG5jb25zdCBjb25maWcgPSByZXF1aXJlKCcuL2FwcGNvbmZpZycpXG5cbmNvbnN0IGJveCA9ICdhdmFsb25ib3gnXG5jb25zdCBpc0RldiA9IGNvbmZpZy5tb2RlID09PSBBcHBDb25zdGFudHMuREVWXG5cbmNvbnN0IEF2YWxvbmJveCA9IChmdW5jdGlvbigpIHtcbiAgY29uc3QgZG9jID0gZG9jdW1lbnRcbiAgY29uc3QgYnV0dG9ucyA9IHt9XG4gIGNvbnN0IG92ZXJsYXkgPSBodG1sLmNyZWF0ZU92ZXJsYXlCb3goZG9jKVxuICBjb25zdCBmcmFtZSA9IGh0bWwuY3JlYXRlRnJhbWUoZG9jKVxuICBmcmFtZS5pbWFnZS5hZGRFdmVudExpc3RlbmVyKCdhbmltYXRpb25lbmQnLCBvbkltYWdlQW5pbWF0aW9uRW5kLCBmYWxzZSlcbiAgY29uc3Qgc3Bpbm5lciA9IGh0bWwuY3JlYXRlU3Bpbm5lcihkb2MpXG4gIGNvbnN0IHNwaW5uZXJXcmFwcGVyID0gaHRtbC5jcmVhdGVTcGlubmVyV3JhcHBlcihkb2MpXG4gIGNvbnN0IGRvd25sb2FkSW1hZ2UgPSBuZXcgSW1hZ2UoKVxuXG4gIGxldCBhY3RpdmVcbiAgbGV0IGN1cnJlbnRMaW5rXG5cbiAgaW5pdGlhbGl6ZSgpXG5cbiAgZnVuY3Rpb24gaW5pdGlhbGl6ZSgpIHtcbiAgICBhY3RpdmUgPSBmYWxzZVxuICAgIGh0bWwuYXBwZW5kQ2hpbGQoZG9jLCBvdmVybGF5KVxuICAgIGJ1dHRvbnMucHJldiA9IGh0bWwuY3JlYXRlUHJldmlvdXNCdXR0b24oZG9jKVxuICAgIGJ1dHRvbnMubmV4dCA9IGh0bWwuY3JlYXRlTmV4dEJ1dHRvbihkb2MpXG4gICAgc3Bpbm5lcldyYXBwZXIuYXBwZW5kQ2hpbGQoc3Bpbm5lcilcbiAgICBvdmVybGF5LmFwcGVuZENoaWxkKGZyYW1lLmNvbnRhaW5lcilcbiAgICBvdmVybGF5LmFwcGVuZENoaWxkKHNwaW5uZXJXcmFwcGVyKVxuICAgIG92ZXJsYXkuYXBwZW5kQ2hpbGQoYnV0dG9ucy5wcmV2KVxuICAgIG92ZXJsYXkuYXBwZW5kQ2hpbGQoYnV0dG9ucy5uZXh0KVxuXG4gICAgYmluZChvdmVybGF5LCAnY2xpY2snLCBoaWRlT3ZlcmxheSlcbiAgICBiaW5kKGJ1dHRvbnMucHJldiwgJ2NsaWNrJywgcHJldmlvdXMpXG4gICAgYmluZChidXR0b25zLm5leHQsICdjbGljaycsIG5leHQpXG4gICAgYmluZChkb2MsICdrZXlkb3duJywga2V5UHJlc3NIYW5kbGVyKVxuICB9XG5cbiAgZnVuY3Rpb24gaGlkZU92ZXJsYXkoZSkge1xuICAgIGxldCBmID0gZnJhbWUuY29udGFpbmVyXG4gICAgaWYgKGYgPT09IGUudGFyZ2V0IHx8ICFmLmNvbnRhaW5zKGUudGFyZ2V0KSkgY2xlYW5GcmFtZSgpXG4gIH1cblxuICBmdW5jdGlvbiBjbGVhbkZyYW1lKCkge1xuICAgIGh0bWwuaGlkZShvdmVybGF5KVxuICAgIGZyYW1lLmltYWdlLmNsYXNzTGlzdC5yZW1vdmUoJ3Nob3dSaWdodCcsICdzaG93TGVmdCcsICdzaG93JylcbiAgICBmcmFtZS5pbWFnZS5zcmMgPSAnJ1xuICAgIGFjdGl2ZSA9IGZhbHNlXG4gIH1cblxuICBmdW5jdGlvbiBzaG93T3ZlcmxheShlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgYWN0aXZlID0gdHJ1ZVxuICAgIGh0bWwuc2hvdyhvdmVybGF5KVxuICAgIGN1cnJlbnRMaW5rID0gZS5kZWxlZ2F0ZVRhcmdldFxuICAgIGZldGNoSW1hZ2UoKVxuXG4gICAgaWYgKHNpbmdsZShlLmN1cnJlbnRUYXJnZXQuaWQpKSB7XG4gICAgICBodG1sLmhpZGUoYnV0dG9ucy5wcmV2KVxuICAgICAgaHRtbC5oaWRlKGJ1dHRvbnMubmV4dClcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGN1cnJlbnRMaW5rLnByZXZpb3VzRWxlbWVudFNpYmxpbmcpIGh0bWwuc2hvdyhidXR0b25zLnByZXYpXG4gICAgICBlbHNlIGh0bWwuaGlkZShidXR0b25zLnByZXYpXG5cbiAgICAgIGlmIChjdXJyZW50TGluay5uZXh0RWxlbWVudFNpYmxpbmcpIGh0bWwuc2hvdyhidXR0b25zLm5leHQpXG4gICAgICBlbHNlIGh0bWwuaGlkZShidXR0b25zLm5leHQpXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbmV4dChlKSB7XG4gICAgZnJhbWUuaW1hZ2UuY2xhc3NMaXN0LnJlbW92ZSgnc2hvd0xlZnQnLCAnc2hvdycpXG4gICAgaHRtbC5zaG93KGJ1dHRvbnMucHJldilcbiAgICBpZiAoY3VycmVudExpbmsubmV4dEVsZW1lbnRTaWJsaW5nKSB7XG4gICAgICBjdXJyZW50TGluayA9IGN1cnJlbnRMaW5rLm5leHRFbGVtZW50U2libGluZ1xuICAgICAgZmV0Y2hJbWFnZShEaXJlY3Rpb24uUklHSFQpXG4gICAgICBpZiAoIWN1cnJlbnRMaW5rLm5leHRFbGVtZW50U2libGluZykgaHRtbC5oaWRlKGJ1dHRvbnMubmV4dClcbiAgICB9XG5cbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpXG4gIH1cblxuICBmdW5jdGlvbiBwcmV2aW91cyhlKSB7XG4gICAgZnJhbWUuaW1hZ2UuY2xhc3NMaXN0LnJlbW92ZSgnc2hvd1JpZ2h0JywgJ3Nob3cnKVxuICAgIGh0bWwuc2hvdyhidXR0b25zLm5leHQpXG4gICAgaWYgKGN1cnJlbnRMaW5rLnByZXZpb3VzRWxlbWVudFNpYmxpbmcpIHtcbiAgICAgIGN1cnJlbnRMaW5rID0gY3VycmVudExpbmsucHJldmlvdXNFbGVtZW50U2libGluZ1xuICAgICAgZmV0Y2hJbWFnZShEaXJlY3Rpb24uTEVGVClcbiAgICAgIGlmICghY3VycmVudExpbmsucHJldmlvdXNFbGVtZW50U2libGluZykgaHRtbC5oaWRlKGJ1dHRvbnMucHJldilcbiAgICB9XG5cbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpXG4gIH1cblxuICBmdW5jdGlvbiBvbkltYWdlQW5pbWF0aW9uRW5kKGUpIHtcbiAgICBkb3dubG9hZEltYWdlLnNyYyA9IGN1cnJlbnRMaW5rLmdldEF0dHJpYnV0ZSgnaHJlZicpXG4gICAgZnJhbWUubGluay5ocmVmID0gY3VycmVudExpbmsuZ2V0QXR0cmlidXRlKCdocmVmJylcbiAgfVxuXG4gIGZ1bmN0aW9uIGZldGNoSW1hZ2UoRElSRUNUSU9OKSB7XG4gICAgZG93bmxvYWRJbWFnZS5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgIG9uTG9hZEltYWdlLmJpbmQodGhpcywgRElSRUNUSU9OKSgpXG4gICAgfVxuICAgIGlmIChESVJFQ1RJT04pIHtcbiAgICAgIGh0bWwuc2xpZGVPdXQoZnJhbWUuaW1hZ2UsIERJUkVDVElPTilcbiAgICB9IGVsc2Uge1xuICAgICAgZG93bmxvYWRJbWFnZS5zcmMgPSBjdXJyZW50TGluay5nZXRBdHRyaWJ1dGUoJ2hyZWYnKVxuICAgICAgZnJhbWUubGluay5ocmVmID0gY3VycmVudExpbmsuZ2V0QXR0cmlidXRlKCdocmVmJylcbiAgICB9XG5cbiAgICBodG1sLnNob3coc3Bpbm5lcilcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uTG9hZEltYWdlKERJUkVDVElPTikge1xuICAgIGlmIChpc0Rldikge1xuICAgICAgc2V0VGltZW91dChsb2FkSW1hZ2UuYmluZCh0aGlzLCBESVJFQ1RJT04pLCAxMDAwKVxuICAgIH0gZWxzZSB7XG4gICAgICBsb2FkSW1hZ2UuYmluZCh0aGlzLCBESVJFQ1RJT04pKClcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBsb2FkSW1hZ2UoRElSRUNUSU9OKSB7XG4gICAgaWYgKERJUkVDVElPTikgaHRtbC5zbGlkZUluKGZyYW1lLmltYWdlLCBESVJFQ1RJT04pXG4gICAgZWxzZSBodG1sLnNob3coZnJhbWUuaW1hZ2UpXG4gICAgZnJhbWUuaW1hZ2Uuc3JjID0gdGhpcy5zcmNcbiAgICBodG1sLmhpZGUoc3Bpbm5lcilcbiAgfVxuXG4gIC8vIFRPRE86IFN3YXAgW10uc2xpY2UgZm9yIEFycmF5LmZyb20gKEVTNilcbiAgLy8gTmVlZCB0byB0ZXN0IGluIElFOVxuICBmdW5jdGlvbiBzaW5nbGUocXVlcnkpIHtcbiAgICBjb25zdCBsaW5rcyA9IGRvYy5nZXRFbGVtZW50QnlJZChxdWVyeSkuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2EnKVxuICAgIHJldHVybiBbXS5zbGljZS5jYWxsKGxpbmtzKS5sZW5ndGggPT0gMVxuICB9XG5cbiAgZnVuY3Rpb24gcnVuKHF1ZXJ5KSB7XG4gICAgZXZlbnRIYW5kbGVycyhxdWVyeSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGV2ZW50SGFuZGxlcnMocXVlcnkpIHtcbiAgICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHF1ZXJ5KVxuICAgIGNvbnN0IGZpbHRlckxpbmtzID0geCA9PiB4LnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PSAnYSdcbiAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGRlbGVnYXRlKGZpbHRlckxpbmtzLCBzaG93T3ZlcmxheSkpXG4gIH1cblxuICBmdW5jdGlvbiBrZXlQcmVzc0hhbmRsZXIoZXZlbnQpIHtcbiAgICBjb25zdCBlID0gZXZlbnQgfHwgd2luZG93LmV2ZW50XG5cbiAgICBpZiAoIWFjdGl2ZSkgcmV0dXJuXG5cbiAgICBpZiAoZS5rZXlDb2RlID09ICczNycpIHByZXZpb3VzKGUpXG4gICAgZWxzZSBpZiAoZS5rZXlDb2RlID09ICczOScpIG5leHQoZSlcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgcnVuXG4gIH1cbn0pKClcblxubW9kdWxlLmV4cG9ydHMgPSBBdmFsb25ib3hcbiIsImNvbnN0IEFwcENvbnN0YW50cyA9IHtcbiAgREVWOiAnZGV2JyxcbiAgUFJPRDogJ3Byb2QnXG59XG5cbmV4cG9ydCBkZWZhdWx0IEFwcENvbnN0YW50c1xuIiwiY29uc3QgRGlyZWN0aW9uID0ge1xuICBMRUZUOiAnbGVmdCcsXG4gIFJJR0hUOiAncmlnaHQnXG59XG5cbmV4cG9ydCBkZWZhdWx0IERpcmVjdGlvblxuIiwiZnVuY3Rpb24gYmluZChlbGVtZW50LCBldmVudCwgY2FsbGJhY2ssIHVzZUNhcHR1cmUpIHtcbiAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBjYWxsYmFjaywgdXNlQ2FwdHVyZSlcbn1cblxuZXhwb3J0IGRlZmF1bHQgYmluZFxuIiwiY29uc3QgZGVsZWdhdGUgPSBmdW5jdGlvbihjcml0ZXJpYSwgbGlzdGVuZXIpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGUpIHtcbiAgICBsZXQgZWwgPSBlLnRhcmdldFxuICAgIGRvIHtcbiAgICAgIGlmICghY3JpdGVyaWEoZWwpKVxuICAgICAgICBjb250aW51ZVxuICAgICAgZS5kZWxlZ2F0ZVRhcmdldCA9IGVsXG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gICAgICByZXR1cm5cbiAgICB9IHdoaWxlKChlbCA9IGVsLnBhcmVudE5vZGUpKVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGRlbGVnYXRlXG4iLCJpbXBvcnQgYmluZCBmcm9tICcuL2JpbmQnXG5pbXBvcnQgRGlyZWN0aW9uIGZyb20gJy4uL2NvbnN0YW50cy9EaXJlY3Rpb24nXG5pbXBvcnQgY2FwaXRhbGl6ZSBmcm9tICcuLi91dGlscy9jYXBpdGFsaXplJ1xuaW1wb3J0IG9wcG9zaXRlRGlyZWN0aW9uIGZyb20gJy4uL3V0aWxzL29wcG9zaXRlLWRpcmVjdGlvbidcbmltcG9ydCB7IExlZnRJY29uLCBSaWdodEljb24gfSBmcm9tICcuLi9pY29ucydcbmNvbnN0IGJveCA9ICdhdmFsb25ib3gnXG5cbmZ1bmN0aW9uIGNyZWF0ZVByZXZpb3VzQnV0dG9uKGRvYykge1xuICBjb25zdCBwcmV2ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpXG4gIHByZXYuaWQgPSBgJHtib3h9LXByZXZgXG4gIHByZXYuY2xhc3NOYW1lID0gYCR7Ym94fS1tb3ZlLWJ1dHRvbiAke2JveH0tcHJldi1idXR0b25gXG4gIHByZXYuaW5uZXJIVE1MID0gTGVmdEljb25cbiAgcHJldi50eXBlID0gJ2J1dHRvbidcbiAgcmV0dXJuIHByZXZcbn1cblxuZnVuY3Rpb24gY3JlYXRlTmV4dEJ1dHRvbihkb2MpIHtcbiAgY29uc3QgbmV4dCA9IGRvYy5jcmVhdGVFbGVtZW50KCdidXR0b24nKVxuICBuZXh0LmlkID0gYCR7Ym94fS1uZXh0YFxuICBuZXh0LmNsYXNzTmFtZSA9IGAke2JveH0tbW92ZS1idXR0b24gJHtib3h9LW5leHQtYnV0dG9uYFxuICBuZXh0LmlubmVySFRNTCA9IFJpZ2h0SWNvblxuICBuZXh0LnR5cGUgPSAnYnV0dG9uJ1xuICByZXR1cm4gbmV4dFxufVxuXG5mdW5jdGlvbiBjcmVhdGVTcGlubmVyKGRvYykge1xuICBjb25zdCBzcGlubmVyID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpXG4gIHNwaW5uZXIuaWQgPSBgJHtib3h9LXNwaW5uZXJgXG4gIHNwaW5uZXIuY2xhc3NOYW1lID0gYCR7Ym94fS1zcGlubmVyYFxuXG4gIHJldHVybiBzcGlubmVyXG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVNwaW5uZXJXcmFwcGVyKGRvYykge1xuICBjb25zdCB3cmFwcGVyID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpXG4gIHdyYXBwZXIuaWQgPSBgJHtib3h9LXNwaW5uZXItd3JhcHBlcmBcbiAgd3JhcHBlci5jbGFzc05hbWUgPSBgJHtib3h9LXNwaW5uZXItd3JhcHBlcmBcblxuICByZXR1cm4gd3JhcHBlclxufVxuXG5mdW5jdGlvbiBjcmVhdGVGcmFtZShkb2MpIHtcbiAgY29uc3QgZnJhbWUgPSBkb2MuY3JlYXRlRWxlbWVudCgnZGl2JylcbiAgZnJhbWUuaWQgPSBgJHtib3h9LWZyYW1lYFxuICBmcmFtZS5jbGFzc05hbWUgPSBgJHtib3h9LWZyYW1lYFxuXG4gIGNvbnN0IGltYWdlID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2ltZycpXG4gIGltYWdlLnNyYyA9ICcnXG4gIGltYWdlLmNsYXNzTmFtZSA9IGAke2JveH0tZnJhbWUtaW1hZ2VgXG4gIGltYWdlLmlkID0gYCR7Ym94fS1mcmFtZS1pbWFnZWBcblxuICBjb25zdCBsaW5rID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2EnKVxuICBsaW5rLmFwcGVuZENoaWxkKGltYWdlKVxuXG4gIGJpbmQobGluaywgJ2NsaWNrJywgZSA9PiB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gIH0pXG5cbiAgZnJhbWUuYXBwZW5kQ2hpbGQobGluaylcbiAgcmV0dXJuIHsgY29udGFpbmVyOiBmcmFtZSwgaW1hZ2U6IGltYWdlLCBsaW5rOiBsaW5rIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlT3ZlcmxheUJveChkb2MpIHtcbiAgY29uc3Qgb3ZlcmxheSA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKVxuICBvdmVybGF5LmNsYXNzTmFtZSA9IGAke2JveH0tb3ZlcmxheWBcbiAgb3ZlcmxheS5pZCA9IGAke2JveH0tb3ZlcmxheWBcbiAgcmV0dXJuIG92ZXJsYXlcbn1cblxuZnVuY3Rpb24gZ2V0T3ZlcmxheUJveChkb2MpIHtcbiAgY29uc3Qgb3ZlcmxheSA9IGRvYy5nZXRFbGVtZW50QnlJZChgJHtib3h9LW92ZXJsYXlgKVxuICByZXR1cm4gb3ZlcmxheVxufVxuXG5mdW5jdGlvbiBoaWRlKGVsKSB7XG4gIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ3Nob3cnKVxuICBlbC5jbGFzc0xpc3QuYWRkKCdoaWRlJylcbn1cblxuZnVuY3Rpb24gc2hvdyhlbCkge1xuICBlbC5jbGFzc0xpc3QucmVtb3ZlKCdoaWRlJylcbiAgZWwuY2xhc3NMaXN0LmFkZCgnc2hvdycpXG59XG5cbmZ1bmN0aW9uIGFwcGVuZENoaWxkKGRvYywgZWwpIHtcbiAgZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdib2R5JylbMF0uYXBwZW5kQ2hpbGQoZWwpXG59XG5cbmZ1bmN0aW9uIHNsaWRlSW4oZWwsIERJUkVDVElPTikge1xuICBlbC5jbGFzc0xpc3QucmVtb3ZlKGBoaWRlJHtjYXBpdGFsaXplKG9wcG9zaXRlRGlyZWN0aW9uKERJUkVDVElPTikpfWApXG4gIGVsLmNsYXNzTGlzdC5hZGQoYHNob3cke2NhcGl0YWxpemUoRElSRUNUSU9OKX1gKVxufVxuXG5mdW5jdGlvbiBzbGlkZU91dChlbCwgRElSRUNUSU9OKSB7XG4gIGVsLmNsYXNzTGlzdC5yZW1vdmUoYHNob3cke2NhcGl0YWxpemUoRElSRUNUSU9OKX1gKVxuICBlbC5jbGFzc0xpc3QuYWRkKGBoaWRlJHtjYXBpdGFsaXplKG9wcG9zaXRlRGlyZWN0aW9uKERJUkVDVElPTikpfWApXG59XG5cbmV4cG9ydCB7XG4gIGNyZWF0ZVByZXZpb3VzQnV0dG9uLFxuICBjcmVhdGVOZXh0QnV0dG9uLFxuICBjcmVhdGVGcmFtZSxcbiAgY3JlYXRlT3ZlcmxheUJveCxcbiAgY3JlYXRlU3Bpbm5lcixcbiAgY3JlYXRlU3Bpbm5lcldyYXBwZXIsXG4gIGdldE92ZXJsYXlCb3gsXG4gIGhpZGUsXG4gIHNob3csXG4gIHNsaWRlSW4sXG4gIHNsaWRlT3V0LFxuICBhcHBlbmRDaGlsZFxufVxuIiwiY29uc3Qgc3ZnSGVhZGVyID0gYHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIlxuICB2aWV3Qm94PVwiMCAwIDEwMCAxMjVcIiB4PVwiMHB4XCIgeT1cIjBweFwiYFxuXG5jb25zdCBMZWZ0SWNvbiA9IGBcbiAgPGRpdiBjbGFzcz0nc3ZnT3V0ZXInPlxuICA8c3ZnICR7c3ZnSGVhZGVyfSBjbGFzcz0naWNvbiBzdmdJbm5lcicgcHJlc2VydmVBc3BlY3RSYXRpbz1cInhNaW5ZTWluIG1lZXRcIj5cbiAgPGc+XG4gICAgPHBhdGggZD1cIk03MC41OSw5NS40MWEyLDIsMCwwLDAsMi44My0yLjgzTDMwLjgzLDUwLDczLjQxLDcuNDFhMiwyLDAsMCwwLTIuODMtMi44M2wtNDQsNDRhMiwyLDAsMCwwLDAsMi44M1pcIi8+PC9nPlxuICA8L3N2Zz5cbiAgPC9kaXY+XG4gIGBcblxuY29uc3QgUmlnaHRJY29uID0gYFxuICA8ZGl2IGNsYXNzPSdzdmdPdXRlcic+XG4gICAgPHN2ZyAke3N2Z0hlYWRlcn0gY2xhc3M9J2ljb24gc3ZnSW5uZXInPlxuICAgICAgPGc+XG4gICAgICAgIDxwYXRoICAgICAgICAgICBkPVwiTTI2LjU5LDk1LjQxYTIsMiwwLDAsMCwyLjgzLDBsNDQtNDRhMiwyLDAsMCwwLDAtMi44M2wtNDQtNDRhMiwyLDAsMCwwLTIuODMsMi44M0w2OS4xNyw1MCwyNi41OSw5Mi41OUEyLDIsMCwwLDAsMjYuNTksOTUuNDFaXCIvPlxuICAgICAgPC9nPlxuICAgIDwvc3ZnPlxuICA8L2Rpdj5cbiAgYFxuXG5leHBvcnQgeyBMZWZ0SWNvbiwgUmlnaHRJY29uIH1cbiIsImZ1bmN0aW9uIGNhcGl0YWxpemUoc3RyaW5nKSB7XG4gIHJldHVybiBzdHJpbmcuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzdHJpbmcuc3Vic3RyaW5nKDEpXG59XG5cbmV4cG9ydCBkZWZhdWx0IGNhcGl0YWxpemVcbiIsImltcG9ydCBEaXJlY3Rpb24gZnJvbSAnLi4vY29uc3RhbnRzL0RpcmVjdGlvbidcblxuZnVuY3Rpb24gb3Bwb3NpdGVEaXJlY3Rpb24oRElSRUNUSU9OKSB7XG4gIHJldHVybiBESVJFQ1RJT04gPT09IERpcmVjdGlvbi5MRUZUID8gRGlyZWN0aW9uLlJJR0hUIDogRGlyZWN0aW9uLkxFRlRcbn1cblxuZXhwb3J0IGRlZmF1bHQgb3Bwb3NpdGVEaXJlY3Rpb25cbiJdfQ==

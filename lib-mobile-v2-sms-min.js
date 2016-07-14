(function (global, undefined) {
    var _seajs = global.seajs;
    if (_seajs && _seajs.version)return;
    var seajs = global.seajs = {version: "2.0.0"};

    function isType(type) {
        return function (obj) {
            return Object.prototype.toString.call(obj) === "[object " + type + "]"
        }
    }

    var isObject = isType("Object"), isString = isType("String"), isArray = Array.isArray || isType("Array"), isFunction = isType("Function"), log = seajs.log = function (msg, type) {
        global.console && (type || configData.debug) && console[type || (type = "log")] && console[type](msg)
    }, eventsCache = seajs.events = {};
    seajs.on = function (event, callback) {
        if (!callback)return seajs;
        var list = eventsCache[event] || (eventsCache[event] = []);
        return list.push(callback), seajs
    }, seajs.off = function (event, callback) {
        if (!event && !callback)return seajs.events = eventsCache = {}, seajs;
        var list = eventsCache[event];
        if (list)if (callback)for (var i = list.length - 1; i >= 0; i--)list[i] === callback && list.splice(i, 1); else delete eventsCache[event];
        return seajs
    };
    var emit = seajs.emit = function (event, data) {
        var list = eventsCache[event], fn;
        if (list) {
            list = list.slice();
            while (fn = list.shift())fn(data)
        }
        return seajs
    }, DIRNAME_RE = /[^?#]*\//, DOT_RE = /\/\.\//g, MULTIPLE_SLASH_RE = /([^:\/])\/\/+/g, DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//g, URI_END_RE = /\?|\.(?:css|js)$|\/$/, HASH_END_RE = /#$/;

    function dirname(path) {
        return path.match(DIRNAME_RE)[0]
    }

    function realpath(path) {
        path = path.replace(DOT_RE, "/"), path = path.replace(MULTIPLE_SLASH_RE, "$1/");
        while (path.match(DOUBLE_DOT_RE))path = path.replace(DOUBLE_DOT_RE, "/");
        return path
    }

    function normalize(uri) {
        return uri = realpath(uri), HASH_END_RE.test(uri) ? uri = uri.slice(0, -1) : URI_END_RE.test(uri) || (uri += ".js"), uri.replace(":80/", "/")
    }

    var PATHS_RE = /^([^/:]+)(\/.+)$/, VARS_RE = /{([^{]+)}/g;

    function parseAlias(id) {
        var alias = configData.alias;
        return alias && isString(alias[id]) ? alias[id] : id
    }

    function parsePaths(id) {
        var paths = configData.paths, m;
        return paths && (m = id.match(PATHS_RE)) && isString(paths[m[1]]) && (id = paths[m[1]] + m[2]), id
    }

    function parseVars(id) {
        var vars = configData.vars;
        return vars && id.indexOf("{") > -1 && (id = id.replace(VARS_RE, function (m, key) {
            return isString(vars[key]) ? vars[key] : m
        })), id
    }

    function parseMap(uri) {
        var map = configData.map, ret = uri;
        if (map)for (var i = 0; i < map.length; i++) {
            var rule = map[i];
            ret = isFunction(rule) ? rule(uri) || uri : uri.replace(rule[0], rule[1]);
            if (ret !== uri)break
        }
        return ret
    }

    var ABSOLUTE_RE = /:\//, RELATIVE_RE = /^\./, ROOT_RE = /^\//;

    function isAbsolute(id) {
        return ABSOLUTE_RE.test(id)
    }

    function isRelative(id) {
        return RELATIVE_RE.test(id)
    }

    function isRoot(id) {
        return ROOT_RE.test(id)
    }

    var ROOT_DIR_RE = /^.*?\/\/.*?\//;

    function addBase(id, refUri) {
        var ret;
        return isAbsolute(id) ? ret = id : isRelative(id) ? ret = dirname(refUri || cwd) + id : isRoot(id) ? ret = (cwd.match(ROOT_DIR_RE) || ["/"])[0] + id.substring(1) : ret = configData.base + id, ret
    }

    function id2Uri(id, refUri) {
        return id ? (id = parseAlias(id), id = parsePaths(id), id = parseVars(id), id = addBase(id, refUri), id = normalize(id), id = parseMap(id), id) : ""
    }

    var doc = document, loc = location, cwd = dirname(loc.href), scripts = doc.getElementsByTagName("script"), loaderScript = doc.getElementById("seajsnode") || scripts[scripts.length - 1], loaderDir = dirname(getScriptAbsoluteSrc(loaderScript)) || cwd;

    function getScriptAbsoluteSrc(node) {
        return node.hasAttribute ? node.src : node.getAttribute("src", 4)
    }

    seajs.cwd = function (val) {
        return val ? cwd = realpath(val + "/") : cwd
    };
    var head = doc.getElementsByTagName("head")[0] || doc.documentElement, baseElement = head.getElementsByTagName("base")[0], IS_CSS_RE = /\.css(?:\?|$)/i, READY_STATE_RE = /^(?:loaded|complete|undefined)$/, currentlyAddingScript, interactiveScript, isOldWebKit = navigator.userAgent.replace(/.*AppleWebKit\/(\d+)\..*/, "$1") * 1 < 536;

    function request(url, callback, charset) {
        var isCSS = IS_CSS_RE.test(url), node = doc.createElement(isCSS ? "link" : "script");
        if (charset) {
            var cs = isFunction(charset) ? charset(url) : charset;
            cs && (node.charset = cs)
        }
        addOnload(node, callback, isCSS), isCSS ? (node.rel = "stylesheet", node.href = url) : (node.async = !0, node.src = url), currentlyAddingScript = node, baseElement ? head.insertBefore(node, baseElement) : head.appendChild(node), currentlyAddingScript = undefined
    }

    function addOnload(node, callback, isCSS) {
        var missingOnload = isCSS && (isOldWebKit || !("onload" in node));
        if (missingOnload) {
            setTimeout(function () {
                pollCss(node, callback)
            }, 1);
            return
        }
        node.onload = node.onerror = node.onreadystatechange = function () {
            READY_STATE_RE.test(node.readyState) && (node.onload = node.onerror = node.onreadystatechange = null, !isCSS && !configData.debug && head.removeChild(node), node = undefined, callback())
        }
    }

    function pollCss(node, callback) {
        var sheet = node.sheet, isLoaded;
        if (isOldWebKit)sheet && (isLoaded = !0); else if (sheet)try {
            sheet.cssRules && (isLoaded = !0)
        } catch (ex) {
            ex.name === "NS_ERROR_DOM_SECURITY_ERR" && (isLoaded = !0)
        }
        setTimeout(function () {
            isLoaded ? callback() : pollCss(node, callback)
        }, 20)
    }

    function getCurrentScript() {
        if (currentlyAddingScript)return currentlyAddingScript;
        if (interactiveScript && interactiveScript.readyState === "interactive")return interactiveScript;
        var scripts = head.getElementsByTagName("script");
        for (var i = scripts.length - 1; i >= 0; i--) {
            var script = scripts[i];
            if (script.readyState === "interactive")return interactiveScript = script, interactiveScript
        }
    }

    var REQUIRE_RE = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^\/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g, SLASH_RE = /\\\\/g;

    function parseDependencies(code) {
        var ret = [];
        return code.replace(SLASH_RE, "").replace(REQUIRE_RE, function (m, m1, m2) {
            m2 && ret.push(m2)
        }), ret
    }

    var cachedModules = seajs.cache = {}, anonymousModuleData, fetchingList = {}, fetchedList = {}, callbackList = {}, waitingsList = {}, STATUS_FETCHING = 1, STATUS_SAVED = 2, STATUS_LOADED = 3, STATUS_EXECUTING = 4, STATUS_EXECUTED = 5;

    function Module(uri) {
        this.uri = uri, this.dependencies = [], this.exports = null, this.status = 0
    }

    function resolve(ids, refUri) {
        if (isArray(ids)) {
            var ret = [];
            for (var i = 0; i < ids.length; i++)ret[i] = resolve(ids[i], refUri);
            return ret
        }
        var data = {id: ids, refUri: refUri};
        return emit("resolve", data), data.uri || id2Uri(data.id, refUri)
    }

    function use(uris, callback) {
        isArray(uris) || (uris = [uris]), load(uris, function () {
            var exports = [];
            for (var i = 0; i < uris.length; i++)exports[i] = getExports(cachedModules[uris[i]]);
            callback && callback.apply(global, exports)
        })
    }

    function load(uris, callback) {
        var unloadedUris = getUnloadedUris(uris);
        if (unloadedUris.length === 0) {
            callback();
            return
        }
        emit("load", unloadedUris);
        var len = unloadedUris.length, remain = len;
        for (var i = 0; i < len; i++)(function (uri) {
            var mod = cachedModules[uri];
            mod.dependencies.length ? loadWaitings(function (circular) {
                mod.status < STATUS_SAVED ? fetch(uri, cb) : cb();
                function cb() {
                    done(circular)
                }
            }) : mod.status < STATUS_SAVED ? fetch(uri, loadWaitings) : done();
            function loadWaitings(cb) {
                cb || (cb = done);
                var waitings = getUnloadedUris(mod.dependencies);
                waitings.length === 0 ? cb() : isCircularWaiting(mod) ? (printCircularLog(circularStack), circularStack.length = 0, cb(!0)) : (waitingsList[uri] = waitings, load(waitings, cb))
            }

            function done(circular) {
                !circular && mod.status < STATUS_LOADED && (mod.status = STATUS_LOADED), --remain === 0 && callback()
            }
        })(unloadedUris[i])
    }

    function fetch(uri, callback) {
        cachedModules[uri].status = STATUS_FETCHING;
        var data = {uri: uri};
        emit("fetch", data);
        var requestUri = data.requestUri || uri;
        if (fetchedList[requestUri]) {
            callback();
            return
        }
        if (fetchingList[requestUri]) {
            callbackList[requestUri].push(callback);
            return
        }
        fetchingList[requestUri] = !0, callbackList[requestUri] = [callback];
        var charset = configData.charset;
        emit("request", data = {
            uri: uri,
            requestUri: requestUri,
            callback: onRequested,
            charset: charset
        }), data.requested || request(data.requestUri, onRequested, charset);
        function onRequested() {
            delete fetchingList[requestUri], fetchedList[requestUri] = !0, anonymousModuleData && (save(uri, anonymousModuleData), anonymousModuleData = undefined);
            var fn, fns = callbackList[requestUri];
            delete callbackList[requestUri];
            while (fn = fns.shift())fn()
        }
    }

    function define(id, deps, factory) {
        arguments.length === 1 && (factory = id, id = undefined), !isArray(deps) && isFunction(factory) && (deps = parseDependencies(factory.toString()));
        var data = {id: id, uri: resolve(id), deps: deps, factory: factory};
        if (!data.uri && doc.attachEvent) {
            var script = getCurrentScript();
            script ? data.uri = script.src : log("Failed to derive: " + factory)
        }
        emit("define", data), data.uri ? save(data.uri, data) : anonymousModuleData = data
    }

    function save(uri, meta) {
        var mod = getModule(uri);
        mod.status < STATUS_SAVED && (mod.id = meta.id || uri, mod.dependencies = resolve(meta.deps || [], uri), mod.factory = meta.factory, mod.factory !== undefined && (mod.status = STATUS_SAVED))
    }

    function exec(mod) {
        if (!mod)return null;
        if (mod.status >= STATUS_EXECUTING)return mod.exports;
        mod.status = STATUS_EXECUTING;
        function resolveInThisContext(id) {
            return resolve(id, mod.uri)
        }

        function require(id) {
            return getExports(cachedModules[resolveInThisContext(id)])
        }

        require.resolve = resolveInThisContext, require.async = function (ids, callback) {
            return use(resolveInThisContext(ids), callback), require
        };
        var factory = mod.factory, exports = isFunction(factory) ? factory(require, mod.exports = {}, mod) : factory;
        return mod.exports = exports === undefined ? mod.exports : exports, mod.status = STATUS_EXECUTED, mod.exports
    }

    Module.prototype.destroy = function () {
        delete cachedModules[this.uri], delete fetchedList[this.uri]
    };
    function getModule(uri) {
        return cachedModules[uri] || (cachedModules[uri] = new Module(uri))
    }

    function getUnloadedUris(uris) {
        var ret = [];
        for (var i = 0; i < uris.length; i++) {
            var uri = uris[i];
            uri && getModule(uri).status < STATUS_LOADED && ret.push(uri)
        }
        return ret
    }

    function getExports(mod) {
        var exports = exec(mod);
        return exports === null && (!mod || !IS_CSS_RE.test(mod.uri)) && emit("error", mod), exports
    }

    var circularStack = [];

    function isCircularWaiting(mod) {
        var waitings = waitingsList[mod.uri] || [];
        if (waitings.length === 0)return !1;
        circularStack.push(mod.uri);
        if (isOverlap(waitings, circularStack))return cutWaitings(waitings), !0;
        for (var i = 0; i < waitings.length; i++)if (isCircularWaiting(cachedModules[waitings[i]]))return !0;
        return circularStack.pop(), !1
    }

    function isOverlap(arrA, arrB) {
        for (var i = 0; i < arrA.length; i++)for (var j = 0; j < arrB.length; j++)if (arrB[j] === arrA[i])return !0;
        return !1
    }

    function cutWaitings(waitings) {
        var uri = circularStack[0];
        for (var i = waitings.length - 1; i >= 0; i--)if (waitings[i] === uri) {
            waitings.splice(i, 1);
            break
        }
    }

    function printCircularLog(stack) {
        stack.push(stack[0]), log("Circular dependencies: " + stack.join(" -> "))
    }

    function preload(callback) {
        var preloadMods = configData.preload, len = preloadMods.length;
        len ? use(resolve(preloadMods), function () {
            preloadMods.splice(0, len), preload(callback)
        }) : callback()
    }

    seajs.use = function (ids, callback) {
        return preload(function () {
            use(resolve(ids), callback)
        }), seajs
    }, Module.load = use, seajs.resolve = id2Uri, global.define = define, seajs.require = function (id) {
        return (cachedModules[id2Uri(id)] || {}).exports
    };
    var configData = config.data = {
        base: function () {
            var ret = loaderDir, m = ret.match(/^(.+?\/)(?:seajs\/)+(?:\d[^/]+\/)?$/);
            return m && (ret = m[1]), ret
        }(), charset: "utf-8", preload: []
    };

    function config(data) {
        for (var key in data) {
            var curr = data[key];
            curr && key === "plugins" && (key = "preload", curr = plugin2preload(curr));
            var prev = configData[key];
            if (prev && isObject(prev))for (var k in curr)prev[k] = curr[k]; else isArray(prev) ? curr = prev.concat(curr) : key === "base" && (curr = normalize(addBase(curr + "/"))), configData[key] = curr
        }
        return emit("config", data), seajs
    }

    seajs.config = config;
    function plugin2preload(arr) {
        var ret = [], name;
        while (name = arr.shift())ret.push(loaderDir + "plugin-" + name);
        return ret
    }

    config({
        plugins: function () {
            var ret, str = loc.search.replace(/(seajs-\w+)(&|$)/g, "$1=1$2");
            return str += " " + doc.cookie, str.replace(/seajs-(\w+)=1/g, function (m, name) {
                (ret || (ret = [])).push(name)
            }), ret
        }()
    });
    var dataConfig = loaderScript.getAttribute("data-config"), dataMain = loaderScript.getAttribute("data-main");
    dataConfig && configData.preload.push(dataConfig), dataMain && seajs.use(dataMain);
    if (_seajs && _seajs.args) {
        var methods = ["define", "config", "use"], args = _seajs.args;
        for (var g = 0; g < args.length; g += 2)seajs[methods[args[g]]].apply(seajs, args[g + 1])
    }
})(this), seajs.config({
    alias: {
        "WEIXIN-SHARE": "http://res.wx.qq.com/open/js/jweixin-1.0.0.js",
        KEYFRAME: "h5/js/lib/keyframe.js",
        DIALOG: "h5/js/common/dialog.js",
        DEVICE: "h5/js/common/device.js",
        PICKER: "h5/js/common/picker.js",
        CITYDATA: "h5/js/common/city-data.js",
        CITYPICKER: "h5/js/common/city-picker.js",
        DTPICKER: "h5/js/common/datetime-picker.js",
        CALENDAR: "h5/js/common/calendar.js",
        CLASS: "h5/js/lib/class.js",
        XM: "h5/js/lib/xm.js"
    }
});
try {
    document.domain = "laifeng.com"
} catch (e) {
}
define("JQ", [], function (require, exports, module) {
    var Zepto = function () {
        var undefined, key, $, classList, emptyArray = [], slice = emptyArray.slice, filter = emptyArray.filter, document = window.document, elementDisplay = {}, classCache = {}, cssNumber = {
            "column-count": 1,
            columns: 1,
            "font-weight": 1,
            "line-height": 1,
            opacity: 1,
            "z-index": 1,
            zoom: 1
        }, fragmentRE = /^\s*<(\w+|!)[^>]*>/, singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/, tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig, rootNodeRE = /^(?:body|html)$/i, capitalRE = /([A-Z])/g, methodAttributes = ["val", "css", "html", "text", "data", "width", "height", "offset"], adjacencyOperators = ["after", "prepend", "before", "append"], table = document.createElement("table"), tableRow = document.createElement("tr"), containers = {
            tr: document.createElement("tbody"),
            tbody: table,
            thead: table,
            tfoot: table,
            td: tableRow,
            th: tableRow,
            "*": document.createElement("div")
        }, readyRE = /complete|loaded|interactive/, simpleSelectorRE = /^[\w-]*$/, class2type = {}, toString = class2type.toString, zepto = {}, camelize, uniq, tempParent = document.createElement("div"), propMap = {
            tabindex: "tabIndex",
            readonly: "readOnly",
            "for": "htmlFor",
            "class": "className",
            maxlength: "maxLength",
            cellspacing: "cellSpacing",
            cellpadding: "cellPadding",
            rowspan: "rowSpan",
            colspan: "colSpan",
            usemap: "useMap",
            frameborder: "frameBorder",
            contenteditable: "contentEditable"
        }, isArray = Array.isArray || function (object) {
                return object instanceof Array
            };
        zepto.matches = function (element, selector) {
            if (!selector || !element || element.nodeType !== 1)return !1;
            var matchesSelector = element.webkitMatchesSelector || element.mozMatchesSelector || element.oMatchesSelector || element.matchesSelector;
            if (matchesSelector)return matchesSelector.call(element, selector);
            var match, parent = element.parentNode, temp = !parent;
            return temp && (parent = tempParent).appendChild(element), match = ~zepto.qsa(parent, selector).indexOf(element), temp && tempParent.removeChild(element), match
        };
        function type(obj) {
            return obj == null ? String(obj) : class2type[toString.call(obj)] || "object"
        }

        function isFunction(value) {
            return type(value) == "function"
        }

        function isWindow(obj) {
            return obj != null && obj == obj.window
        }

        function isDocument(obj) {
            return obj != null && obj.nodeType == obj.DOCUMENT_NODE
        }

        function isObject(obj) {
            return type(obj) == "object"
        }

        function isPlainObject(obj) {
            return isObject(obj) && !isWindow(obj) && Object.getPrototypeOf(obj) == Object.prototype
        }

        function likeArray(obj) {
            return typeof obj.length == "number"
        }

        function compact(array) {
            return filter.call(array, function (item) {
                return item != null
            })
        }

        function flatten(array) {
            return array.length > 0 ? $.fn.concat.apply([], array) : array
        }

        camelize = function (str) {
            return str.replace(/-+(.)?/g, function (match, chr) {
                return chr ? chr.toUpperCase() : ""
            })
        };
        function dasherize(str) {
            return str.replace(/::/g, "/").replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").replace(/([a-z\d])([A-Z])/g, "$1_$2").replace(/_/g, "-").toLowerCase()
        }

        uniq = function (array) {
            return filter.call(array, function (item, idx) {
                return array.indexOf(item) == idx
            })
        };
        function classRE(name) {
            return name in classCache ? classCache[name] : classCache[name] = new RegExp("(^|\\s)" + name + "(\\s|$)")
        }

        function maybeAddPx(name, value) {
            return typeof value == "number" && !cssNumber[dasherize(name)] ? value + "px" : value
        }

        function defaultDisplay(nodeName) {
            var element, display;
            return elementDisplay[nodeName] || (element = document.createElement(nodeName), document.body.appendChild(element), display = getComputedStyle(element, "").getPropertyValue("display"), element.parentNode.removeChild(element), display == "none" && (display = "block"), elementDisplay[nodeName] = display), elementDisplay[nodeName]
        }

        function children(element) {
            return "children" in element ? slice.call(element.children) : $.map(element.childNodes, function (node) {
                if (node.nodeType == 1)return node
            })
        }

        zepto.fragment = function (html, name, properties) {
            var dom, nodes, container;
            return singleTagRE.test(html) && (dom = $(document.createElement(RegExp.$1))), dom || (html.replace && (html = html.replace(tagExpanderRE, "<$1></$2>")), name === undefined && (name = fragmentRE.test(html) && RegExp.$1), name in containers || (name = "*"), container = containers[name], container.innerHTML = "" + html, dom = $.each(slice.call(container.childNodes), function () {
                container.removeChild(this)
            })), isPlainObject(properties) && (nodes = $(dom), $.each(properties, function (key, value) {
                methodAttributes.indexOf(key) > -1 ? nodes[key](value) : nodes.attr(key, value)
            })), dom
        }, zepto.Z = function (dom, selector) {
            return dom = dom || [], dom.__proto__ = $.fn, dom.selector = selector || "", dom
        }, zepto.isZ = function (object) {
            return object instanceof zepto.Z
        }, zepto.init = function (selector, context) {
            var dom;
            if (!selector)return zepto.Z();
            if (typeof selector == "string") {
                selector = selector.trim();
                if (selector[0] == "<" && fragmentRE.test(selector))dom = zepto.fragment(selector, RegExp.$1, context), selector = null; else {
                    if (context !== undefined)return $(context).find(selector);
                    dom = zepto.qsa(document, selector)
                }
            } else {
                if (isFunction(selector))return $(document).ready(selector);
                if (zepto.isZ(selector))return selector;
                if (isArray(selector))dom = compact(selector); else if (isObject(selector))dom = [selector], selector = null; else if (fragmentRE.test(selector))dom = zepto.fragment(selector.trim(), RegExp.$1, context), selector = null; else {
                    if (context !== undefined)return $(context).find(selector);
                    dom = zepto.qsa(document, selector)
                }
            }
            return zepto.Z(dom, selector)
        }, $ = function (selector, context) {
            return zepto.init(selector, context)
        };
        function extend(target, source, deep) {
            for (key in source)deep && (isPlainObject(source[key]) || isArray(source[key])) ? (isPlainObject(source[key]) && !isPlainObject(target[key]) && (target[key] = {}), isArray(source[key]) && !isArray(target[key]) && (target[key] = []), extend(target[key], source[key], deep)) : source[key] !== undefined && (target[key] = source[key])
        }

        $.extend = function (target) {
            var deep, args = slice.call(arguments, 1);
            return typeof target == "boolean" && (deep = target, target = args.shift()), args.forEach(function (arg) {
                extend(target, arg, deep)
            }), target
        }, zepto.qsa = function (element, selector) {
            var found, maybeID = selector[0] == "#", maybeClass = !maybeID && selector[0] == ".", nameOnly = maybeID || maybeClass ? selector.slice(1) : selector, isSimple = simpleSelectorRE.test(nameOnly);
            return isDocument(element) && isSimple && maybeID ? (found = element.getElementById(nameOnly)) ? [found] : [] : element.nodeType !== 1 && element.nodeType !== 9 ? [] : slice.call(isSimple && !maybeID ? maybeClass ? element.getElementsByClassName(nameOnly) : element.getElementsByTagName(selector) : element.querySelectorAll(selector))
        };
        function filtered(nodes, selector) {
            return selector == null ? $(nodes) : $(nodes).filter(selector)
        }

        $.contains = document.documentElement.contains ? function (parent, node) {
            return parent !== node && parent.contains(node)
        } : function (parent, node) {
            while (node && (node = node.parentNode))if (node === parent)return !0;
            return !1
        };
        function funcArg(context, arg, idx, payload) {
            return isFunction(arg) ? arg.call(context, idx, payload) : arg
        }

        function setAttribute(node, name, value) {
            value == null ? node.removeAttribute(name) : node.setAttribute(name, value)
        }

        function className(node, value) {
            var klass = node.className || "", svg = klass && klass.baseVal !== undefined;
            if (value === undefined)return svg ? klass.baseVal : klass;
            svg ? klass.baseVal = value : node.className = value
        }

        function deserializeValue(value) {
            try {
                return value ? value == "true" || (value == "false" ? !1 : value == "null" ? null : +value + "" == value ? +value : /^[\[\{]/.test(value) ? $.parseJSON(value) : value) : value
            } catch (e) {
                return value
            }
        }

        $.type = type, $.isFunction = isFunction, $.isWindow = isWindow, $.isArray = isArray, $.isPlainObject = isPlainObject, $.isEmptyObject = function (obj) {
            var name;
            for (name in obj)return !1;
            return !0
        }, $.inArray = function (elem, array, i) {
            return emptyArray.indexOf.call(array, elem, i)
        }, $.camelCase = camelize, $.trim = function (str) {
            return str == null ? "" : String.prototype.trim.call(str)
        }, $.uuid = 0, $.support = {}, $.expr = {}, $.map = function (elements, callback) {
            var value, values = [], i, key;
            if (likeArray(elements))for (i = 0; i < elements.length; i++)value = callback(elements[i], i), value != null && values.push(value); else for (key in elements)value = callback(elements[key], key), value != null && values.push(value);
            return flatten(values)
        }, $.each = function (elements, callback) {
            var i, key;
            if (likeArray(elements)) {
                for (i = 0; i < elements.length; i++)if (callback.call(elements[i], i, elements[i]) === !1)return elements
            } else for (key in elements)if (callback.call(elements[key], key, elements[key]) === !1)return elements;
            return elements
        }, $.grep = function (elements, callback) {
            return filter.call(elements, callback)
        }, window.JSON && ($.parseJSON = JSON.parse), $.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function (i, name) {
            class2type["[object " + name + "]"] = name.toLowerCase()
        }), $.fn = {
            forEach: emptyArray.forEach,
            reduce: emptyArray.reduce,
            push: emptyArray.push,
            sort: emptyArray.sort,
            indexOf: emptyArray.indexOf,
            concat: emptyArray.concat,
            map: function (fn) {
                return $($.map(this, function (el, i) {
                    return fn.call(el, i, el)
                }))
            },
            slice: function () {
                return $(slice.apply(this, arguments))
            },
            ready: function (callback) {
                return readyRE.test(document.readyState) && document.body ? callback($) : document.addEventListener("DOMContentLoaded", function () {
                    callback($)
                }, !1), this
            },
            get: function (idx) {
                return idx === undefined ? slice.call(this) : this[idx >= 0 ? idx : idx + this.length]
            },
            toArray: function () {
                return this.get()
            },
            size: function () {
                return this.length
            },
            remove: function () {
                return this.each(function () {
                    this.parentNode != null && this.parentNode.removeChild(this)
                })
            },
            each: function (callback) {
                return emptyArray.every.call(this, function (el, idx) {
                    return callback.call(el, idx, el) !== !1
                }), this
            },
            filter: function (selector) {
                return isFunction(selector) ? this.not(this.not(selector)) : $(filter.call(this, function (element) {
                    return zepto.matches(element, selector)
                }))
            },
            add: function (selector, context) {
                return $(uniq(this.concat($(selector, context))))
            },
            is: function (selector) {
                return this.length > 0 && zepto.matches(this[0], selector)
            },
            not: function (selector) {
                var nodes = [];
                if (isFunction(selector) && selector.call !== undefined)this.each(function (idx) {
                    selector.call(this, idx) || nodes.push(this)
                }); else {
                    var excludes = typeof selector == "string" ? this.filter(selector) : likeArray(selector) && isFunction(selector.item) ? slice.call(selector) : $(selector);
                    this.forEach(function (el) {
                        excludes.indexOf(el) < 0 && nodes.push(el)
                    })
                }
                return $(nodes)
            },
            has: function (selector) {
                return this.filter(function () {
                    return isObject(selector) ? $.contains(this, selector) : $(this).find(selector).size()
                })
            },
            eq: function (idx) {
                return idx === -1 ? this.slice(idx) : this.slice(idx, +idx + 1)
            },
            first: function () {
                var el = this[0];
                return el && !isObject(el) ? el : $(el)
            },
            last: function () {
                var el = this[this.length - 1];
                return el && !isObject(el) ? el : $(el)
            },
            find: function (selector) {
                var result, $this = this;
                return selector ? typeof selector == "object" ? result = $(selector).filter(function () {
                    var node = this;
                    return emptyArray.some.call($this, function (parent) {
                        return $.contains(parent, node)
                    })
                }) : this.length == 1 ? result = $(zepto.qsa(this[0], selector)) : result = this.map(function () {
                    return zepto.qsa(this, selector)
                }) : result = $(), result
            },
            closest: function (selector, context) {
                var node = this[0], collection = !1;
                typeof selector == "object" && (collection = $(selector));
                while (node && !(collection ? collection.indexOf(node) >= 0 : zepto.matches(node, selector)))node = node !== context && !isDocument(node) && node.parentNode;
                return $(node)
            },
            parents: function (selector) {
                var ancestors = [], nodes = this;
                while (nodes.length > 0)nodes = $.map(nodes, function (node) {
                    if ((node = node.parentNode) && !isDocument(node) && ancestors.indexOf(node) < 0)return ancestors.push(node), node
                });
                return filtered(ancestors, selector)
            },
            parent: function (selector) {
                return filtered(uniq(this.pluck("parentNode")), selector)
            },
            children: function (selector) {
                return filtered(this.map(function () {
                    return children(this)
                }), selector)
            },
            contents: function () {
                return this.map(function () {
                    return slice.call(this.childNodes)
                })
            },
            siblings: function (selector) {
                return filtered(this.map(function (i, el) {
                    return filter.call(children(el.parentNode), function (child) {
                        return child !== el
                    })
                }), selector)
            },
            empty: function () {
                return this.each(function () {
                    this.innerHTML = ""
                })
            },
            pluck: function (property) {
                return $.map(this, function (el) {
                    return el[property]
                })
            },
            show: function () {
                return this.each(function () {
                    this.style.display == "none" && (this.style.display = ""), getComputedStyle(this, "").getPropertyValue("display") == "none" && (this.style.display = defaultDisplay(this.nodeName))
                })
            },
            replaceWith: function (newContent) {
                return this.before(newContent).remove()
            },
            wrap: function (structure) {
                var func = isFunction(structure);
                if (this[0] && !func)var dom = $(structure).get(0), clone = dom.parentNode || this.length > 1;
                return this.each(function (index) {
                    $(this).wrapAll(func ? structure.call(this, index) : clone ? dom.cloneNode(!0) : dom)
                })
            },
            wrapAll: function (structure) {
                if (this[0]) {
                    $(this[0]).before(structure = $(structure));
                    var children;
                    while ((children = structure.children()).length)structure = children.first();
                    $(structure).append(this)
                }
                return this
            },
            wrapInner: function (structure) {
                var func = isFunction(structure);
                return this.each(function (index) {
                    var self = $(this), contents = self.contents(), dom = func ? structure.call(this, index) : structure;
                    contents.length ? contents.wrapAll(dom) : self.append(dom)
                })
            },
            unwrap: function () {
                return this.parent().each(function () {
                    $(this).replaceWith($(this).children())
                }), this
            },
            clone: function () {
                return this.map(function () {
                    return this.cloneNode(!0)
                })
            },
            hide: function () {
                return this.css("display", "none")
            },
            toggle: function (setting) {
                return this.each(function () {
                    var el = $(this);
                    (setting === undefined ? el.css("display") == "none" : setting) ? el.show() : el.hide()
                })
            },
            prev: function (selector) {
                return $(this.pluck("previousElementSibling")).filter(selector || "*")
            },
            next: function (selector) {
                return $(this.pluck("nextElementSibling")).filter(selector || "*")
            },
            html: function (html) {
                return 0 in arguments ? this.each(function (idx) {
                    var originHtml = this.innerHTML;
                    $(this).empty().append(funcArg(this, html, idx, originHtml))
                }) : 0 in this ? this[0].innerHTML : null
            },
            text: function (text) {
                return 0 in arguments ? this.each(function (idx) {
                    var newText = funcArg(this, text, idx, this.textContent);
                    this.textContent = newText == null ? "" : "" + newText
                }) : 0 in this ? this[0].textContent : null
            },
            attr: function (name, value) {
                var result;
                return typeof name != "string" || 1 in arguments ? this.each(function (idx) {
                    if (this.nodeType !== 1)return;
                    if (isObject(name))for (key in name)setAttribute(this, key, name[key]); else setAttribute(this, name, funcArg(this, value, idx, this.getAttribute(name)))
                }) : !this.length || this[0].nodeType !== 1 ? undefined : !(result = this[0].getAttribute(name)) && name in this[0] ? this[0][name] : result
            },
            removeAttr: function (name) {
                return this.each(function () {
                    this.nodeType === 1 && name.split(" ").forEach(function (attribute) {
                        setAttribute(this, attribute)
                    }, this)
                })
            },
            prop: function (name, value) {
                return name = propMap[name] || name, 1 in arguments ? this.each(function (idx) {
                    this[name] = funcArg(this, value, idx, this[name])
                }) : this[0] && this[0][name]
            },
            data: function (name, value) {
                var attrName = "data-" + name.replace(capitalRE, "-$1").toLowerCase(), data = 1 in arguments ? this.attr(attrName, value) : this.attr(attrName);
                return data !== null ? deserializeValue(data) : undefined
            },
            val: function (value) {
                return 0 in arguments ? this.each(function (idx) {
                    this.value = funcArg(this, value, idx, this.value)
                }) : this[0] && (this[0].multiple ? $(this[0]).find("option").filter(function () {
                    return this.selected
                }).pluck("value") : this[0].value)
            },
            offset: function (coordinates) {
                if (coordinates)return this.each(function (index) {
                    var $this = $(this), coords = funcArg(this, coordinates, index, $this.offset()), parentOffset = $this.offsetParent().offset(), props = {
                        top: coords.top - parentOffset.top,
                        left: coords.left - parentOffset.left
                    };
                    $this.css("position") == "static" && (props.position = "relative"), $this.css(props)
                });
                if (!this.length)return null;
                var obj = this[0].getBoundingClientRect();
                return {
                    left: obj.left + window.pageXOffset,
                    top: obj.top + window.pageYOffset,
                    width: Math.round(obj.width),
                    height: Math.round(obj.height)
                }
            },
            css: function (property, value) {
                if (arguments.length < 2) {
                    var computedStyle, element = this[0];
                    if (!element)return;
                    computedStyle = getComputedStyle(element, "");
                    if (typeof property == "string")return element.style[camelize(property)] || computedStyle.getPropertyValue(property);
                    if (isArray(property)) {
                        var props = {};
                        return $.each(property, function (_, prop) {
                            props[prop] = element.style[camelize(prop)] || computedStyle.getPropertyValue(prop)
                        }), props
                    }
                }
                var css = "";
                if (type(property) == "string")!value && value !== 0 ? this.each(function () {
                    this.style.removeProperty(dasherize(property))
                }) : css = dasherize(property) + ":" + maybeAddPx(property, value); else for (key in property)!property[key] && property[key] !== 0 ? this.each(function () {
                    this.style.removeProperty(dasherize(key))
                }) : css += dasherize(key) + ":" + maybeAddPx(key, property[key]) + ";";
                return this.each(function () {
                    this.style.cssText += ";" + css
                })
            },
            index: function (element) {
                return element ? this.indexOf($(element)[0]) : this.parent().children().indexOf(this[0])
            },
            hasClass: function (name) {
                return name ? emptyArray.some.call(this, function (el) {
                    return this.test(className(el))
                }, classRE(name)) : !1
            },
            addClass: function (name) {
                return name ? this.each(function (idx) {
                    if (!("className" in this))return;
                    classList = [];
                    var cls = className(this), newName = funcArg(this, name, idx, cls);
                    newName.split(/\s+/g).forEach(function (klass) {
                        $(this).hasClass(klass) || classList.push(klass)
                    }, this), classList.length && className(this, cls + (cls ? " " : "") + classList.join(" "))
                }) : this
            },
            removeClass: function (name) {
                return this.each(function (idx) {
                    if (!("className" in this))return;
                    if (name === undefined)return className(this, "");
                    classList = className(this), funcArg(this, name, idx, classList).split(/\s+/g).forEach(function (klass) {
                        classList = classList.replace(classRE(klass), " ")
                    }), className(this, classList.trim())
                })
            },
            toggleClass: function (name, when) {
                return name ? this.each(function (idx) {
                    var $this = $(this), names = funcArg(this, name, idx, className(this));
                    names.split(/\s+/g).forEach(function (klass) {
                        (when === undefined ? !$this.hasClass(klass) : when) ? $this.addClass(klass) : $this.removeClass(klass)
                    })
                }) : this
            },
            scrollTop: function (value) {
                if (!this.length)return;
                var hasScrollTop = "scrollTop" in this[0];
                return value === undefined ? hasScrollTop ? this[0].scrollTop : this[0].pageYOffset : this.each(hasScrollTop ? function () {
                    this.scrollTop = value
                } : function () {
                    this.scrollTo(this.scrollX, value)
                })
            },
            scrollLeft: function (value) {
                if (!this.length)return;
                var hasScrollLeft = "scrollLeft" in this[0];
                return value === undefined ? hasScrollLeft ? this[0].scrollLeft : this[0].pageXOffset : this.each(hasScrollLeft ? function () {
                    this.scrollLeft = value
                } : function () {
                    this.scrollTo(value, this.scrollY)
                })
            },
            position: function () {
                if (!this.length)return;
                var elem = this[0], offsetParent = this.offsetParent(), offset = this.offset(), parentOffset = rootNodeRE.test(offsetParent[0].nodeName) ? {
                    top: 0,
                    left: 0
                } : offsetParent.offset();
                return offset.top -= parseFloat($(elem).css("margin-top")) || 0, offset.left -= parseFloat($(elem).css("margin-left")) || 0, parentOffset.top += parseFloat($(offsetParent[0]).css("border-top-width")) || 0, parentOffset.left += parseFloat($(offsetParent[0]).css("border-left-width")) || 0, {
                    top: offset.top - parentOffset.top,
                    left: offset.left - parentOffset.left
                }
            },
            offsetParent: function () {
                return this.map(function () {
                    var parent = this.offsetParent || document.body;
                    while (parent && !rootNodeRE.test(parent.nodeName) && $(parent).css("position") == "static")parent = parent.offsetParent;
                    return parent
                })
            }
        }, $.fn.detach = $.fn.remove, ["width", "height"].forEach(function (dimension) {
            var dimensionProperty = dimension.replace(/./, function (m) {
                return m[0].toUpperCase()
            });
            $.fn[dimension] = function (value) {
                var offset, el = this[0];
                return value === undefined ? isWindow(el) ? el["inner" + dimensionProperty] : isDocument(el) ? el.documentElement["scroll" + dimensionProperty] : (offset = this.offset()) && offset[dimension] : this.each(function (idx) {
                    el = $(this), el.css(dimension, funcArg(this, value, idx, el[dimension]()))
                })
            }
        });
        function traverseNode(node, fun) {
            fun(node);
            for (var i = 0, len = node.childNodes.length; i < len; i++)traverseNode(node.childNodes[i], fun)
        }

        return adjacencyOperators.forEach(function (operator, operatorIndex) {
            var inside = operatorIndex % 2;
            $.fn[operator] = function () {
                var argType, nodes = $.map(arguments, function (arg) {
                    return argType = type(arg), argType == "object" || argType == "array" || arg == null ? arg : zepto.fragment(arg)
                }), parent, copyByClone = this.length > 1;
                return nodes.length < 1 ? this : this.each(function (_, target) {
                    parent = inside ? target : target.parentNode, target = operatorIndex == 0 ? target.nextSibling : operatorIndex == 1 ? target.firstChild : operatorIndex == 2 ? target : null;
                    var parentInDocument = $.contains(document.documentElement, parent);
                    nodes.forEach(function (node) {
                        if (copyByClone)node = node.cloneNode(!0); else if (!parent)return $(node).remove();
                        parent.insertBefore(node, target), parentInDocument && traverseNode(node, function (el) {
                            el.nodeName != null && el.nodeName.toUpperCase() === "SCRIPT" && (!el.type || el.type === "text/javascript") && !el.src && window.eval.call(window, el.innerHTML)
                        })
                    })
                })
            }, $.fn[inside ? operator + "To" : "insert" + (operatorIndex ? "Before" : "After")] = function (html) {
                return $(html)[operator](this), this
            }
        }), zepto.Z.prototype = $.fn, zepto.uniq = uniq, zepto.deserializeValue = deserializeValue, $.zepto = zepto, $
    }();
    window.Zepto = Zepto, window.$ === undefined && (window.$ = Zepto), function ($) {
        var _zid = 1, undefined, slice = Array.prototype.slice, isFunction = $.isFunction, isString = function (obj) {
            return typeof obj == "string"
        }, handlers = {}, specialEvents = {}, focusinSupported = "onfocusin" in window, focus = {
            focus: "focusin",
            blur: "focusout"
        }, hover = {mouseenter: "mouseover", mouseleave: "mouseout"};
        specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = "MouseEvents";
        function zid(element) {
            return element._zid || (element._zid = _zid++)
        }

        function findHandlers(element, event, fn, selector) {
            event = parse(event);
            if (event.ns)var matcher = matcherFor(event.ns);
            return (handlers[zid(element)] || []).filter(function (handler) {
                return handler && (!event.e || handler.e == event.e) && (!event.ns || matcher.test(handler.ns)) && (!fn || zid(handler.fn) === zid(fn)) && (!selector || handler.sel == selector)
            })
        }

        function parse(event) {
            var parts = ("" + event).split(".");
            return {e: parts[0], ns: parts.slice(1).sort().join(" ")}
        }

        function matcherFor(ns) {
            return new RegExp("(?:^| )" + ns.replace(" ", " .* ?") + "(?: |$)")
        }

        function eventCapture(handler, captureSetting) {
            return handler.del && !focusinSupported && handler.e in focus || !!captureSetting
        }

        function realEvent(type) {
            return hover[type] || focusinSupported && focus[type] || type
        }

        function add(element, events, fn, data, selector, delegator, capture) {
            var id = zid(element), set = handlers[id] || (handlers[id] = []);
            events.split(/\s/).forEach(function (event) {
                if (event == "ready")return $(document).ready(fn);
                var handler = parse(event);
                handler.fn = fn, handler.sel = selector, handler.e in hover && (fn = function (e) {
                    var related = e.relatedTarget;
                    if (!related || related !== this && !$.contains(this, related))return handler.fn.apply(this, arguments)
                }), handler.del = delegator;
                var callback = delegator || fn;
                handler.proxy = function (e) {
                    e = compatible(e);
                    if (e.isImmediatePropagationStopped())return;
                    e.data = data;
                    var result = callback.apply(element, e._args == undefined ? [e] : [e].concat(e._args));
                    return result === !1 && (e.preventDefault(), e.stopPropagation()), result
                }, handler.i = set.length, set.push(handler), "addEventListener" in element && element.addEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
            })
        }

        function remove(element, events, fn, selector, capture) {
            var id = zid(element);
            (events || "").split(/\s/).forEach(function (event) {
                findHandlers(element, event, fn, selector).forEach(function (handler) {
                    delete handlers[id][handler.i], "removeEventListener" in element && element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
                })
            })
        }

        $.event = {add: add, remove: remove}, $.proxy = function (fn, context) {
            var args = 2 in arguments && slice.call(arguments, 2);
            if (isFunction(fn)) {
                var proxyFn = function () {
                    return fn.apply(context, args ? args.concat(slice.call(arguments)) : arguments)
                };
                return proxyFn._zid = zid(fn), proxyFn
            }
            if (isString(context))return args ? (args.unshift(fn[context], fn), $.proxy.apply(null, args)) : $.proxy(fn[context], fn);
            throw new TypeError("expected function")
        }, $.fn.bind = function (event, data, callback) {
            return this.on(event, data, callback)
        }, $.fn.unbind = function (event, callback) {
            return this.off(event, callback)
        }, $.fn.one = function (event, selector, data, callback) {
            return this.on(event, selector, data, callback, 1)
        };
        var returnTrue = function () {
            return !0
        }, returnFalse = function () {
            return !1
        }, ignoreProperties = /^([A-Z]|returnValue$|layer[XY]$)/, eventMethods = {
            preventDefault: "isDefaultPrevented",
            stopImmediatePropagation: "isImmediatePropagationStopped",
            stopPropagation: "isPropagationStopped"
        };

        function compatible(event, source) {
            if (source || !event.isDefaultPrevented) {
                source || (source = event), $.each(eventMethods, function (name, predicate) {
                    var sourceMethod = source[name];
                    event[name] = function () {
                        return this[predicate] = returnTrue, sourceMethod && sourceMethod.apply(source, arguments)
                    }, event[predicate] = returnFalse
                });
                if (source.defaultPrevented !== undefined ? source.defaultPrevented : "returnValue" in source ? source.returnValue === !1 : source.getPreventDefault && source.getPreventDefault())event.isDefaultPrevented = returnTrue
            }
            return event
        }

        function createProxy(event) {
            var key, proxy = {originalEvent: event};
            for (key in event)!ignoreProperties.test(key) && event[key] !== undefined && (proxy[key] = event[key]);
            return compatible(proxy, event)
        }

        $.fn.delegate = function (selector, event, callback) {
            return this.on(event, selector, callback)
        }, $.fn.undelegate = function (selector, event, callback) {
            return this.off(event, selector, callback)
        }, $.fn.live = function (event, callback) {
            return $(document.body).delegate(this.selector, event, callback), this
        }, $.fn.die = function (event, callback) {
            return $(document.body).undelegate(this.selector, event, callback), this
        }, $.fn.on = function (event, selector, data, callback, one) {
            var autoRemove, delegator, $this = this;
            if (event && !isString(event))return $.each(event, function (type, fn) {
                $this.on(type, selector, data, fn, one)
            }), $this;
            !isString(selector) && !isFunction(callback) && callback !== !1 && (callback = data, data = selector, selector = undefined);
            if (isFunction(data) || data === !1)callback = data, data = undefined;
            return callback === !1 && (callback = returnFalse), $this.each(function (_, element) {
                one && (autoRemove = function (e) {
                    return remove(element, e.type, callback), callback.apply(this, arguments)
                }), selector && (delegator = function (e) {
                    var evt, match = $(e.target).closest(selector, element).get(0);
                    if (match && match !== element)return evt = $.extend(createProxy(e), {
                        currentTarget: match,
                        liveFired: element
                    }), (autoRemove || callback).apply(match, [evt].concat(slice.call(arguments, 1)))
                }), add(element, event, callback, data, selector, delegator || autoRemove)
            })
        }, $.fn.off = function (event, selector, callback) {
            var $this = this;
            return event && !isString(event) ? ($.each(event, function (type, fn) {
                $this.off(type, selector, fn)
            }), $this) : (!isString(selector) && !isFunction(callback) && callback !== !1 && (callback = selector, selector = undefined), callback === !1 && (callback = returnFalse), $this.each(function () {
                remove(this, event, callback, selector)
            }))
        }, $.fn.trigger = function (event, args) {
            return event = isString(event) || $.isPlainObject(event) ? $.Event(event) : compatible(event), event._args = args, this.each(function () {
                event.type in focus && typeof this[event.type] == "function" ? this[event.type]() : "dispatchEvent" in this ? this.dispatchEvent(event) : $(this).triggerHandler(event, args)
            })
        }, $.fn.triggerHandler = function (event, args) {
            var e, result;
            return this.each(function (i, element) {
                e = createProxy(isString(event) ? $.Event(event) : event), e._args = args, e.target = element, $.each(findHandlers(element, event.type || event), function (i, handler) {
                    result = handler.proxy(e);
                    if (e.isImmediatePropagationStopped())return !1
                })
            }), result
        }, "focusin focusout focus blur load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select keydown keypress keyup error".split(" ").forEach(function (event) {
            $.fn[event] = function (callback) {
                return 0 in arguments ? this.bind(event, callback) : this.trigger(event)
            }
        }), $.Event = function (type, props) {
            isString(type) || (props = type, type = props.type);
            var event = document.createEvent(specialEvents[type] || "Events"), bubbles = !0;
            if (props)for (var name in props)name == "bubbles" ? bubbles = !!props[name] : event[name] = props[name];
            return event.initEvent(type, bubbles, !0), compatible(event)
        }
    }(Zepto), function ($) {
        var jsonpID = 0, document = window.document, key, name, rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, scriptTypeRE = /^(?:text|application)\/javascript/i, xmlTypeRE = /^(?:text|application)\/xml/i, jsonType = "application/json", htmlType = "text/html", blankRE = /^\s*$/, originAnchor = document.createElement("a");
        originAnchor.href = window.location.href;
        function triggerAndReturn(context, eventName, data) {
            var event = $.Event(eventName);
            return $(context).trigger(event, data), !event.isDefaultPrevented()
        }

        function triggerGlobal(settings, context, eventName, data) {
            if (settings.global)return triggerAndReturn(context || document, eventName, data)
        }

        $.active = 0;
        function ajaxStart(settings) {
            settings.global && $.active++ === 0 && triggerGlobal(settings, null, "ajaxStart")
        }

        function ajaxStop(settings) {
            settings.global && !--$.active && triggerGlobal(settings, null, "ajaxStop")
        }

        function ajaxBeforeSend(xhr, settings) {
            var context = settings.context;
            if (settings.beforeSend.call(context, xhr, settings) === !1 || triggerGlobal(settings, context, "ajaxBeforeSend", [xhr, settings]) === !1)return !1;
            triggerGlobal(settings, context, "ajaxSend", [xhr, settings])
        }

        function ajaxSuccess(data, xhr, settings, deferred) {
            var context = settings.context, status = "success";
            settings.success.call(context, data, status, xhr), deferred && deferred.resolveWith(context, [data, status, xhr]), triggerGlobal(settings, context, "ajaxSuccess", [xhr, settings, data]), ajaxComplete(status, xhr, settings)
        }

        function ajaxError(error, type, xhr, settings, deferred) {
            var context = settings.context;
            settings.error.call(context, xhr, type, error), deferred && deferred.rejectWith(context, [xhr, type, error]), triggerGlobal(settings, context, "ajaxError", [xhr, settings, error || type]), ajaxComplete(type, xhr, settings)
        }

        function ajaxComplete(status, xhr, settings) {
            var context = settings.context;
            settings.complete.call(context, xhr, status), triggerGlobal(settings, context, "ajaxComplete", [xhr, settings]), ajaxStop(settings)
        }

        function empty() {
        }

        $.ajaxJSONP = function (options, deferred) {
            if ("type" in options) {
                var _callbackName = options.jsonpCallback, callbackName = ($.isFunction(_callbackName) ? _callbackName() : _callbackName) || "jsonp" + ++jsonpID, script = document.createElement("script"), originalCallback = window[callbackName], responseData, abort = function (errorType) {
                    $(script).triggerHandler("error", errorType || "abort")
                }, xhr = {abort: abort}, abortTimeout;
                return deferred && deferred.promise(xhr), $(script).on("load error", function (e, errorType) {
                    clearTimeout(abortTimeout), $(script).off().remove(), e.type == "error" || !responseData ? ajaxError(null, errorType || "error", xhr, options, deferred) : ajaxSuccess(responseData[0], xhr, options, deferred), window[callbackName] = originalCallback, responseData && $.isFunction(originalCallback) && originalCallback(responseData[0]), originalCallback = responseData = undefined
                }), ajaxBeforeSend(xhr, options) === !1 ? (abort("abort"), xhr) : (window[callbackName] = function () {
                    responseData = arguments
                }, script.src = options.url.replace(/\?(.+)=\?/, "?$1=" + callbackName), document.head.appendChild(script), options.timeout > 0 && (abortTimeout = setTimeout(function () {
                    abort("timeout")
                }, options.timeout)), xhr)
            }
            return $.ajax(options)
        }, $.ajaxSettings = {
            type: "GET",
            beforeSend: empty,
            success: empty,
            error: empty,
            complete: empty,
            context: null,
            global: !0,
            xhr: function () {
                return new window.XMLHttpRequest
            },
            accepts: {
                script: "text/javascript, application/javascript, application/x-javascript",
                json: jsonType,
                xml: "application/xml, text/xml",
                html: htmlType,
                text: "text/plain"
            },
            crossDomain: !1,
            timeout: 0,
            processData: !0,
            cache: !0
        };
        function mimeToDataType(mime) {
            return mime && (mime = mime.split(";", 2)[0]), mime && (mime == htmlType ? "html" : mime == jsonType ? "json" : scriptTypeRE.test(mime) ? "script" : xmlTypeRE.test(mime) && "xml") || "text"
        }

        function appendQuery(url, query) {
            return query == "" ? url : (url + "&" + query).replace(/[&?]{1,2}/, "?")
        }

        function serializeData(options) {
            options.processData && options.data && $.type(options.data) != "string" && (options.data = $.param(options.data, options.traditional)), options.data && (!options.type || options.type.toUpperCase() == "GET") && (options.url = appendQuery(options.url, options.data), options.data = undefined)
        }

        $.ajax = function (options) {
            var settings = $.extend({}, options || {}), deferred = $.Deferred && $.Deferred(), urlAnchor;
            for (key in $.ajaxSettings)settings[key] === undefined && (settings[key] = $.ajaxSettings[key]);
            ajaxStart(settings), settings.crossDomain || (urlAnchor = document.createElement("a"), urlAnchor.href = settings.url, urlAnchor.href = urlAnchor.href, settings.crossDomain = originAnchor.protocol + "//" + originAnchor.host != urlAnchor.protocol + "//" + urlAnchor.host), settings.url || (settings.url = window.location.toString()), serializeData(settings);
            var dataType = settings.dataType, hasPlaceholder = /\?.+=\?/.test(settings.url);
            hasPlaceholder && (dataType = "jsonp");
            if (settings.cache === !1 || (!options || options.cache !== !0) && ("script" == dataType || "jsonp" == dataType))settings.url = appendQuery(settings.url, "_=" + Date.now());
            if ("jsonp" == dataType)return hasPlaceholder || (settings.url = appendQuery(settings.url, settings.jsonp ? settings.jsonp + "=?" : settings.jsonp === !1 ? "" : "callback=?")), $.ajaxJSONP(settings, deferred);
            var mime = settings.accepts[dataType], headers = {}, setHeader = function (name, value) {
                headers[name.toLowerCase()] = [name, value]
            }, protocol = /^([\w-]+:)\/\//.test(settings.url) ? RegExp.$1 : window.location.protocol, xhr = settings.xhr(), nativeSetHeader = xhr.setRequestHeader, abortTimeout;
            deferred && deferred.promise(xhr), settings.crossDomain || setHeader("X-Requested-With", "XMLHttpRequest"), setHeader("Accept", mime || "*/*");
            if (mime = settings.mimeType || mime)mime.indexOf(",") > -1 && (mime = mime.split(",", 2)[0]), xhr.overrideMimeType && xhr.overrideMimeType(mime);
            (settings.contentType || settings.contentType !== !1 && settings.data && settings.type.toUpperCase() != "GET") && setHeader("Content-Type", settings.contentType || "application/x-www-form-urlencoded");
            if (settings.headers)for (name in settings.headers)setHeader(name, settings.headers[name]);
            xhr.setRequestHeader = setHeader, xhr.onreadystatechange = function () {
                if (xhr.readyState == 4) {
                    xhr.onreadystatechange = empty, clearTimeout(abortTimeout);
                    var result, error = !1;
                    if (xhr.status >= 200 && xhr.status < 300 || xhr.status == 304 || xhr.status == 0 && protocol == "file:") {
                        dataType = dataType || mimeToDataType(settings.mimeType || xhr.getResponseHeader("content-type")), result = xhr.responseText;
                        try {
                            dataType == "script" ? (1, eval)(result) : dataType == "xml" ? result = xhr.responseXML : dataType == "json" && (result = blankRE.test(result) ? null : $.parseJSON(result))
                        } catch (e) {
                            error = e
                        }
                        error ? ajaxError(error, "parsererror", xhr, settings, deferred) : ajaxSuccess(result, xhr, settings, deferred)
                    } else ajaxError(xhr.statusText || null, xhr.status ? "error" : "abort", xhr, settings, deferred)
                }
            };
            if (ajaxBeforeSend(xhr, settings) === !1)return xhr.abort(), ajaxError(null, "abort", xhr, settings, deferred), xhr;
            if (settings.xhrFields)for (name in settings.xhrFields)xhr[name] = settings.xhrFields[name];
            var async = "async" in settings ? settings.async : !0;
            xhr.open(settings.type, settings.url, async, settings.username, settings.password);
            for (name in headers)nativeSetHeader.apply(xhr, headers[name]);
            return settings.timeout > 0 && (abortTimeout = setTimeout(function () {
                xhr.onreadystatechange = empty, xhr.abort(), ajaxError(null, "timeout", xhr, settings, deferred)
            }, settings.timeout)), xhr.send(settings.data ? settings.data : null), xhr
        };
        function parseArguments(url, data, success, dataType) {
            return $.isFunction(data) && (dataType = success, success = data, data = undefined), $.isFunction(success) || (dataType = success, success = undefined), {
                url: url,
                data: data,
                success: success,
                dataType: dataType
            }
        }

        $.get = function () {
            return $.ajax(parseArguments.apply(null, arguments))
        }, $.post = function () {
            var options = parseArguments.apply(null, arguments);
            return options.type = "POST", $.ajax(options)
        }, $.getJSON = function () {
            var options = parseArguments.apply(null, arguments);
            return options.dataType = "json", $.ajax(options)
        }, $.fn.load = function (url, data, success) {
            if (!this.length)return this;
            var self = this, parts = url.split(/\s/), selector, options = parseArguments(url, data, success), callback = options.success;
            return parts.length > 1 && (options.url = parts[0], selector = parts[1]), options.success = function (response) {
                self.html(selector ? $("<div>").html(response.replace(rscript, "")).find(selector) : response), callback && callback.apply(self, arguments)
            }, $.ajax(options), this
        };
        var escape = encodeURIComponent;

        function serialize(params, obj, traditional, scope) {
            var type, array = $.isArray(obj), hash = $.isPlainObject(obj);
            $.each(obj, function (key, value) {
                type = $.type(value), scope && (key = traditional ? scope : scope + "[" + (hash || type == "object" || type == "array" ? key : "") + "]"), !scope && array ? params.add(value.name, value.value) : type == "array" || !traditional && type == "object" ? serialize(params, value, traditional, key) : params.add(key, value)
            })
        }

        $.param = function (obj, traditional) {
            var params = [];
            return params.add = function (key, value) {
                $.isFunction(value) && (value = value()), value == null && (value = ""), this.push(escape(key) + "=" + escape(value))
            }, serialize(params, obj, traditional), params.join("&").replace(/%20/g, "+")
        }
    }(Zepto), function ($) {
        $.fn.serializeArray = function () {
            var name, type, result = [], add = function (value) {
                if (value.forEach)return value.forEach(add);
                result.push({name: name, value: value})
            };
            return this[0] && $.each(this[0].elements, function (_, field) {
                type = field.type, name = field.name, name && field.nodeName.toLowerCase() != "fieldset" && !field.disabled && type != "submit" && type != "reset" && type != "button" && type != "file" && (type != "radio" && type != "checkbox" || field.checked) && add($(field).val())
            }), result
        }, $.fn.serialize = function () {
            var result = [];
            return this.serializeArray().forEach(function (elm) {
                result.push(encodeURIComponent(elm.name) + "=" + encodeURIComponent(elm.value))
            }), result.join("&")
        }, $.fn.submit = function (callback) {
            if (0 in arguments)this.bind("submit", callback); else if (this.length) {
                var event = $.Event("submit");
                this.eq(0).trigger(event), event.isDefaultPrevented() || this.get(0).submit()
            }
            return this
        }
    }(Zepto), function ($) {
        "__proto__" in {} || $.extend($.zepto, {
            Z: function (dom, selector) {
                return dom = dom || [], $.extend(dom, $.fn), dom.selector = selector || "", dom.__Z = !0, dom
            }, isZ: function (object) {
                return $.type(object) === "array" && "__Z" in object
            }
        });
        try {
            getComputedStyle(undefined)
        } catch (e) {
            var nativeGetComputedStyle = getComputedStyle;
            window.getComputedStyle = function (element) {
                try {
                    return nativeGetComputedStyle(element)
                } catch (e) {
                    return null
                }
            }
        }
    }(Zepto), function ($, undefined) {
        var prefix = "", eventPrefix, endEventName, endAnimationName, vendors = {
            Webkit: "webkit",
            Moz: "",
            O: "o"
        }, document = window.document, testEl = document.createElement("div"), supportedTransforms = /^((translate|rotate|scale)(X|Y|Z|3d)?|matrix(3d)?|perspective|skew(X|Y)?)$/i, transform, transitionProperty, transitionDuration, transitionTiming, transitionDelay, animationName, animationDuration, animationTiming, animationDelay, cssReset = {};

        function dasherize(str) {
            return str.replace(/([a-z])([A-Z])/, "$1-$2").toLowerCase()
        }

        function normalizeEvent(name) {
            return eventPrefix ? eventPrefix + name : name.toLowerCase()
        }

        $.each(vendors, function (vendor, event) {
            if (testEl.style[vendor + "TransitionProperty"] !== undefined)return prefix = "-" + vendor.toLowerCase() + "-", eventPrefix = event, !1
        }), transform = prefix + "transform", cssReset[transitionProperty = prefix + "transition-property"] = cssReset[transitionDuration = prefix + "transition-duration"] = cssReset[transitionDelay = prefix + "transition-delay"] = cssReset[transitionTiming = prefix + "transition-timing-function"] = cssReset[animationName = prefix + "animation-name"] = cssReset[animationDuration = prefix + "animation-duration"] = cssReset[animationDelay = prefix + "animation-delay"] = cssReset[animationTiming = prefix + "animation-timing-function"] = "", $.fx = {
            off: eventPrefix === undefined && testEl.style.transitionProperty === undefined,
            speeds: {_default: 400, fast: 200, slow: 600},
            cssPrefix: prefix,
            transitionEnd: normalizeEvent("TransitionEnd"),
            animationEnd: normalizeEvent("AnimationEnd")
        }, $.fn.animate = function (properties, duration, ease, callback, delay) {
            return $.isFunction(duration) && (callback = duration, ease = undefined, duration = undefined), $.isFunction(ease) && (callback = ease, ease = undefined), $.isPlainObject(duration) && (ease = duration.easing, callback = duration.complete, delay = duration.delay, duration = duration.duration), duration && (duration = (typeof duration == "number" ? duration : $.fx.speeds[duration] || $.fx.speeds._default) / 1e3), delay && (delay = parseFloat(delay) / 1e3), this.anim(properties, duration, ease, callback, delay)
        }, $.fn.anim = function (properties, duration, ease, callback, delay) {
            var key, cssValues = {}, cssProperties, transforms = "", that = this, wrappedCallback, endEvent = $.fx.transitionEnd, fired = !1;
            duration === undefined && (duration = $.fx.speeds._default / 1e3), delay === undefined && (delay = 0), $.fx.off && (duration = 0);
            if (typeof properties == "string")cssValues[animationName] = properties, cssValues[animationDuration] = duration + "s", cssValues[animationDelay] = delay + "s", cssValues[animationTiming] = ease || "linear", endEvent = $.fx.animationEnd; else {
                cssProperties = [];
                for (key in properties)supportedTransforms.test(key) ? transforms += key + "(" + properties[key] + ") " : (cssValues[key] = properties[key], cssProperties.push(dasherize(key)));
                transforms && (cssValues[transform] = transforms, cssProperties.push(transform)), duration > 0 && typeof properties == "object" && (cssValues[transitionProperty] = cssProperties.join(", "), cssValues[transitionDuration] = duration + "s", cssValues[transitionDelay] = delay + "s", cssValues[transitionTiming] = ease || "linear")
            }
            return wrappedCallback = function (event) {
                if (typeof event != "undefined") {
                    if (event.rget !== event.currentTarget)return;
                    $(event.target).unbind(endEvent, wrappedCallback)
                } else $(this).unbind(endEvent, wrappedCallback);
                fired = !0, $(this).css(cssReset), callback && callback.call(this)
            }, duration > 0 && (this.bind(endEvent, wrappedCallback), setTimeout(function () {
                if (fired)return;
                wrappedCallback.call(that)
            }, (duration + delay) * 1e3 + 25)), this.size() && this.get(0).clientLeft, this.css(cssValues), duration <= 0 && setTimeout(function () {
                that.each(function () {
                    wrappedCallback.call(this)
                })
            }, 0), this
        }, testEl = null
    }(Zepto), function ($, undefined) {
        var document = window.document, docElem = document.documentElement, origShow = $.fn.show, origHide = $.fn.hide, origToggle = $.fn.toggle;

        function anim(el, speed, opacity, scale, callback) {
            typeof speed == "function" && !callback && (callback = speed, speed = undefined);
            var props = {opacity: opacity};
            return scale && (props.scale = scale, el.css($.fx.cssPrefix + "transform-origin", "0 0")), el.animate(props, speed, null, callback)
        }

        function hide(el, speed, scale, callback) {
            return anim(el, speed, 0, scale, function () {
                origHide.call($(this)), callback && callback.call(this)
            })
        }

        $.fn.show = function (speed, callback) {
            return origShow.call(this), speed === undefined ? speed = 0 : this.css("opacity", 0), anim(this, speed, 1, "1,1", callback)
        }, $.fn.hide = function (speed, callback) {
            return speed === undefined ? origHide.call(this) : hide(this, speed, "0,0", callback)
        }, $.fn.toggle = function (speed, callback) {
            return speed === undefined || typeof speed == "boolean" ? origToggle.call(this, speed) : this.each(function () {
                var el = $(this);
                el[el.css("display") == "none" ? "show" : "hide"](speed, callback)
            })
        }, $.fn.fadeTo = function (speed, opacity, callback) {
            return anim(this, speed, opacity, null, callback)
        }, $.fn.fadeIn = function (speed, callback) {
            var target = this.css("opacity");
            return target > 0 ? this.css("opacity", 0) : target = 1, origShow.call(this).fadeTo(speed, target, callback)
        }, $.fn.fadeOut = function (speed, callback) {
            return hide(this, speed, null, callback)
        }, $.fn.fadeToggle = function (speed, callback) {
            return this.each(function () {
                var el = $(this);
                el[el.css("opacity") == 0 || el.css("display") == "none" ? "fadeIn" : "fadeOut"](speed, callback)
            })
        }
    }(Zepto), function ($) {
        var zepto = $.zepto, oldQsa = zepto.qsa, oldMatches = zepto.matches;

        function visible(elem) {
            return elem = $(elem), (!!elem.width() || !!elem.height()) && elem.css("display") !== "none"
        }

        var filters = $.expr[":"] = {
            visible: function () {
                if (visible(this))return this
            }, hidden: function () {
                if (!visible(this))return this
            }, selected: function () {
                if (this.selected)return this
            }, checked: function () {
                if (this.checked)return this
            }, parent: function () {
                return this.parentNode
            }, first: function (idx) {
                if (idx === 0)return this
            }, last: function (idx, nodes) {
                if (idx === nodes.length - 1)return this
            }, eq: function (idx, _, value) {
                if (idx === value)return this
            }, contains: function (idx, _, text) {
                if ($(this).text().indexOf(text) > -1)return this
            }, has: function (idx, _, sel) {
                if (zepto.qsa(this, sel).length)return this
            }
        }, filterRe = new RegExp("(.*):(\\w+)(?:\\(([^)]+)\\))?$\\s*"), childRe = /^\s*>/, classTag = "Zepto" + +(new Date);

        function process(sel, fn) {
            sel = sel.replace(/=#\]/g, '="#"]');
            var filter, arg, match = filterRe.exec(sel);
            if (match && match[2] in filters) {
                filter = filters[match[2]], arg = match[3], sel = match[1];
                if (arg) {
                    var num = Number(arg);
                    isNaN(num) ? arg = arg.replace(/^["']|["']$/g, "") : arg = num
                }
            }
            return fn(sel, filter, arg)
        }

        zepto.qsa = function (node, selector) {
            return process(selector, function (sel, filter, arg) {
                try {
                    var taggedParent;
                    !sel && filter ? sel = "*" : childRe.test(sel) && (taggedParent = $(node).addClass(classTag), sel = "." + classTag + " " + sel);
                    var nodes = oldQsa(node, sel)
                } catch (e) {
                    throw console.error("error performing selector: %o", selector), e
                } finally {
                    taggedParent && taggedParent.removeClass(classTag)
                }
                return filter ? zepto.uniq($.map(nodes, function (n, i) {
                    return filter.call(n, i, nodes, arg)
                })) : nodes
            })
        }, zepto.matches = function (node, selector) {
            return process(selector, function (sel, filter, arg) {
                return (!sel || oldMatches(node, sel)) && (!filter || filter.call(node, null, arg) === node)
            })
        }
    }(Zepto), function ($) {
        var touch = {}, touchTimeout, tapTimeout, swipeTimeout, longTapTimeout, longTapDelay = 750, gesture;

        function swipeDirection(x1, x2, y1, y2) {
            return Math.abs(x1 - x2) >= Math.abs(y1 - y2) ? x1 - x2 > 0 ? "Left" : "Right" : y1 - y2 > 0 ? "Up" : "Down"
        }

        function longTap() {
            longTapTimeout = null, touch.last && (touch.el.trigger("longTap"), touch = {})
        }

        function cancelLongTap() {
            longTapTimeout && clearTimeout(longTapTimeout), longTapTimeout = null
        }

        function cancelAll() {
            touchTimeout && clearTimeout(touchTimeout), tapTimeout && clearTimeout(tapTimeout), swipeTimeout && clearTimeout(swipeTimeout), longTapTimeout && clearTimeout(longTapTimeout), touchTimeout = tapTimeout = swipeTimeout = longTapTimeout = null, touch = {}
        }

        function isPrimaryTouch(event) {
            return (event.pointerType == "touch" || event.pointerType == event.MSPOINTER_TYPE_TOUCH) && event.isPrimary
        }

        function isPointerEventType(e, type) {
            return e.type == "pointer" + type || e.type.toLowerCase() == "mspointer" + type
        }

        $(document).ready(function () {
            var now, delta, deltaX = 0, deltaY = 0, firstTouch, _isPointerType;
            "MSGesture" in window && (gesture = new MSGesture, gesture.target = document.body), $(document).bind("MSGestureEnd", function (e) {
                var swipeDirectionFromVelocity = e.velocityX > 1 ? "Right" : e.velocityX < -1 ? "Left" : e.velocityY > 1 ? "Down" : e.velocityY < -1 ? "Up" : null;
                swipeDirectionFromVelocity && (touch.el.trigger("swipe"), touch.el.trigger("swipe" + swipeDirectionFromVelocity))
            }).on("touchstart MSPointerDown pointerdown", function (e) {
                if ((_isPointerType = isPointerEventType(e, "down")) && !isPrimaryTouch(e))return;
                firstTouch = _isPointerType ? e : e.touches[0], e.touches && e.touches.length === 1 && touch.x2 && (touch.x2 = undefined, touch.y2 = undefined), now = Date.now(), delta = now - (touch.last || now), touch.el = $("tagName" in firstTouch.target ? firstTouch.target : firstTouch.target.parentNode), touchTimeout && clearTimeout(touchTimeout), touch.x1 = firstTouch.pageX, touch.y1 = firstTouch.pageY, delta > 0 && delta <= 250 && (touch.isDoubleTap = !0), touch.last = now, longTapTimeout = setTimeout(longTap, longTapDelay), gesture && _isPointerType && gesture.addPointer(e.pointerId)
            }).on("touchmove MSPointerMove pointermove", function (e) {
                if ((_isPointerType = isPointerEventType(e, "move")) && !isPrimaryTouch(e))return;
                firstTouch = _isPointerType ? e : e.touches[0], cancelLongTap(), touch.x2 = firstTouch.pageX, touch.y2 = firstTouch.pageY, deltaX += Math.abs(touch.x1 - touch.x2), deltaY += Math.abs(touch.y1 - touch.y2)
            }).on("touchend MSPointerUp pointerup", function (e) {
                if ((_isPointerType = isPointerEventType(e, "up")) && !isPrimaryTouch(e))return;
                cancelLongTap(), touch.x2 && Math.abs(touch.x1 - touch.x2) > 30 || touch.y2 && Math.abs(touch.y1 - touch.y2) > 30 ? swipeTimeout = setTimeout(function () {
                    touch.el.trigger("swipe"), touch.el.trigger("swipe" + swipeDirection(touch.x1, touch.x2, touch.y1, touch.y2)), touch = {}
                }, 0) : "last" in touch && (deltaX < 30 && deltaY < 30 ? tapTimeout = setTimeout(function () {
                    var event = $.Event("tap");
                    event.cancelTouch = cancelAll, touch.el.trigger(event), touch.isDoubleTap ? (touch.el && touch.el.trigger("doubleTap"), touch = {}) : touchTimeout = setTimeout(function () {
                        touchTimeout = null, touch.el && touch.el.trigger("singleTap"), touch = {}
                    }, 250)
                }, 0) : touch = {}), deltaX = deltaY = 0
            }).on("touchcancel MSPointerCancel pointercancel", cancelAll), $(window).on("scroll", cancelAll)
        }), ["swipe", "swipeLeft", "swipeRight", "swipeUp", "swipeDown", "doubleTap", "tap", "singleTap", "longTap"].forEach(function (eventName) {
            $.fn[eventName] = function (callback) {
                return this.on(eventName, callback)
            }
        })
    }(Zepto), function ($) {
        $.Callbacks = function (options) {
            options = $.extend({}, options);
            var memory, fired, firing, firingStart, firingLength, firingIndex, list = [], stack = !options.once && [], fire = function (data) {
                memory = options.memory && data, fired = !0, firingIndex = firingStart || 0, firingStart = 0, firingLength = list.length, firing = !0;
                for (; list && firingIndex < firingLength; ++firingIndex)if (list[firingIndex].apply(data[0], data[1]) === !1 && options.stopOnFalse) {
                    memory = !1;
                    break
                }
                firing = !1, list && (stack ? stack.length && fire(stack.shift()) : memory ? list.length = 0 : Callbacks.disable())
            }, Callbacks = {
                add: function () {
                    if (list) {
                        var start = list.length, add = function (args) {
                            $.each(args, function (_, arg) {
                                typeof arg == "function" ? (!options.unique || !Callbacks.has(arg)) && list.push(arg) : arg && arg.length && typeof arg != "string" && add(arg)
                            })
                        };
                        add(arguments), firing ? firingLength = list.length : memory && (firingStart = start, fire(memory))
                    }
                    return this
                }, remove: function () {
                    return list && $.each(arguments, function (_, arg) {
                        var index;
                        while ((index = $.inArray(arg, list, index)) > -1)list.splice(index, 1), firing && (index <= firingLength && --firingLength, index <= firingIndex && --firingIndex)
                    }), this
                }, has: function (fn) {
                    return !!list && !!(fn ? $.inArray(fn, list) > -1 : list.length)
                }, empty: function () {
                    return firingLength = list.length = 0, this
                }, disable: function () {
                    return list = stack = memory = undefined, this
                }, disabled: function () {
                    return !list
                }, lock: function () {
                    return stack = undefined, memory || Callbacks.disable(), this
                }, locked: function () {
                    return !stack
                }, fireWith: function (context, args) {
                    return list && (!fired || stack) && (args = args || [], args = [context, args.slice ? args.slice() : args], firing ? stack.push(args) : fire(args)), this
                }, fire: function () {
                    return Callbacks.fireWith(this, arguments)
                }, fired: function () {
                    return !!fired
                }
            };
            return Callbacks
        }
    }(Zepto), function ($) {
        var slice = Array.prototype.slice;

        function Deferred(func) {
            var tuples = [["resolve", "done", $.Callbacks({
                once: 1,
                memory: 1
            }), "resolved"], ["reject", "fail", $.Callbacks({
                once: 1,
                memory: 1
            }), "rejected"], ["notify", "progress", $.Callbacks({memory: 1})]], state = "pending", promise = {
                state: function () {
                    return state
                }, always: function () {
                    return deferred.done(arguments).fail(arguments), this
                }, then: function () {
                    var fns = arguments;
                    return Deferred(function (defer) {
                        $.each(tuples, function (i, tuple) {
                            var fn = $.isFunction(fns[i]) && fns[i];
                            deferred[tuple[1]](function () {
                                var returned = fn && fn.apply(this, arguments);
                                if (returned && $.isFunction(returned.promise))returned.promise().done(defer.resolve).fail(defer.reject).progress(defer.notify); else {
                                    var context = this === promise ? defer.promise() : this, values = fn ? [returned] : arguments;
                                    defer[tuple[0] + "With"](context, values)
                                }
                            })
                        }), fns = null
                    }).promise()
                }, promise: function (obj) {
                    return obj != null ? $.extend(obj, promise) : promise
                }
            }, deferred = {};
            return $.each(tuples, function (i, tuple) {
                var list = tuple[2], stateString = tuple[3];
                promise[tuple[1]] = list.add, stateString && list.add(function () {
                    state = stateString
                }, tuples[i ^ 1][2].disable, tuples[2][2].lock), deferred[tuple[0]] = function () {
                    return deferred[tuple[0] + "With"](this === deferred ? promise : this, arguments), this
                }, deferred[tuple[0] + "With"] = list.fireWith
            }), promise.promise(deferred), func && func.call(deferred, deferred), deferred
        }

        $.when = function (sub) {
            var resolveValues = slice.call(arguments), len = resolveValues.length, i = 0, remain = len !== 1 || sub && $.isFunction(sub.promise) ? len : 0, deferred = remain === 1 ? sub : Deferred(), progressValues, progressContexts, resolveContexts, updateFn = function (i, ctx, val) {
                return function (value) {
                    ctx[i] = this, val[i] = arguments.length > 1 ? slice.call(arguments) : value, val === progressValues ? deferred.notifyWith(ctx, val) : --remain || deferred.resolveWith(ctx, val)
                }
            };
            if (len > 1) {
                progressValues = new Array(len), progressContexts = new Array(len), resolveContexts = new Array(len);
                for (; i < len; ++i)resolveValues[i] && $.isFunction(resolveValues[i].promise) ? resolveValues[i].promise().done(updateFn(i, resolveContexts, resolveValues)).fail(deferred.reject).progress(updateFn(i, progressContexts, progressValues)) : --remain
            }
            return remain || deferred.resolveWith(resolveContexts, resolveValues), deferred.promise()
        }, $.Deferred = Deferred
    }(Zepto), module.exports = Zepto
}), seajs.use("JQ", function ($) {
    "use strict";
    ["width", "height"].forEach(function (dimension) {
        var Dimension = dimension.replace(/./, function (m) {
            return m[0].toUpperCase()
        });
        $.fn["outer" + Dimension] = function (margin) {
            var elem = this;
            if (elem) {
                var size = elem[dimension](), sides = {width: ["left", "right"], height: ["top", "bottom"]};
                return sides[dimension].forEach(function (side) {
                    margin && (size += parseInt(elem.css("margin-" + side), 10))
                }), size
            }
            return null
        }
    }), $.support = function () {
        var support = {touch: !!("ontouchstart" in window || window.DocumentTouch && document instanceof window.DocumentTouch)};
        return support
    }(), $.touchEvents = {
        start: $.support.touch ? "touchstart" : "mousedown",
        move: $.support.touch ? "touchmove" : "mousemove",
        end: $.support.touch ? "touchend" : "mouseup"
    }, $.getTranslate = function (el, axis) {
        var matrix, curTransform, curStyle, transformMatrix;
        return typeof axis == "undefined" && (axis = "x"), curStyle = window.getComputedStyle(el, null), window.WebKitCSSMatrix ? transformMatrix = new WebKitCSSMatrix(curStyle.webkitTransform === "none" ? "" : curStyle.webkitTransform) : (transformMatrix = curStyle.MozTransform || curStyle.transform || curStyle.getPropertyValue("transform").replace("translate(", "matrix(1, 0, 0, 1,"), matrix = transformMatrix.toString().split(",")), axis === "x" && (window.WebKitCSSMatrix ? curTransform = transformMatrix.m41 : matrix.length === 16 ? curTransform = parseFloat(matrix[12]) : curTransform = parseFloat(matrix[4])), axis === "y" && (window.WebKitCSSMatrix ? curTransform = transformMatrix.m42 : matrix.length === 16 ? curTransform = parseFloat(matrix[13]) : curTransform = parseFloat(matrix[5])), curTransform || 0
    }, $.requestAnimationFrame = function (callback) {
        return window.requestAnimationFrame ? window.requestAnimationFrame(callback) : window.webkitRequestAnimationFrame ? window.webkitRequestAnimationFrame(callback) : window.mozRequestAnimationFrame ? window.mozRequestAnimationFrame(callback) : window.setTimeout(callback, 1e3 / 60)
    }, $.cancelAnimationFrame = function (id) {
        return window.cancelAnimationFrame ? window.cancelAnimationFrame(id) : window.webkitCancelAnimationFrame ? window.webkitCancelAnimationFrame(id) : window.mozCancelAnimationFrame ? window.mozCancelAnimationFrame(id) : window.clearTimeout(id)
    }, $.fn.dataset = function () {
        var dataset = {}, ds = this[0].dataset;
        for (var key in ds) {
            var item = dataset[key] = ds[key];
            item === "false" ? dataset[key] = !1 : item === "true" ? dataset[key] = !0 : parseFloat(item) === item * 1 && (dataset[key] = item * 1)
        }
        return $.extend({}, dataset, this[0].__eleData)
    }, $.fn.data = function (key, value) {
        var tmpData = $(this).dataset();
        if (!key)return tmpData;
        if (typeof value == "undefined") {
            var dataVal = tmpData[key], __eD = this[0].__eleData;
            return __eD && key in __eD ? __eD[key] : dataVal
        }
        for (var i = 0; i < this.length; i++) {
            var el = this[i];
            key in tmpData && delete el.dataset[key], el.__eleData || (el.__eleData = {}), el.__eleData[key] = value
        }
        return this
    };
    function __dealCssEvent(eventNameArr, callback) {
        var events = eventNameArr, i, dom = this;

        function fireCallBack(e) {
            if (e.target !== this)return;
            callback.call(this, e);
            for (i = 0; i < events.length; i++)dom.off(events[i], fireCallBack)
        }

        if (callback)for (i = 0; i < events.length; i++)dom.on(events[i], fireCallBack)
    }

    $.fn.animationEnd = function (callback) {
        return __dealCssEvent.call(this, ["webkitAnimationEnd", "animationend"], callback), this
    }, $.fn.transitionEnd = function (callback) {
        return __dealCssEvent.call(this, ["webkitTransitionEnd", "transitionend"], callback), this
    }, $.fn.transition = function (duration) {
        typeof duration != "string" && (duration += "ms");
        for (var i = 0; i < this.length; i++) {
            var elStyle = this[i].style;
            elStyle.webkitTransitionDuration = elStyle.MozTransitionDuration = elStyle.transitionDuration = duration
        }
        return this
    }, $.fn.transform = function (transform) {
        for (var i = 0; i < this.length; i++) {
            var elStyle = this[i].style;
            elStyle.webkitTransform = elStyle.MozTransform = elStyle.transform = transform
        }
        return this
    }, $.fn.prevAll = function (selector) {
        var prevEls = [], el = this[0];
        if (!el)return $([]);
        while (el.previousElementSibling) {
            var prev = el.previousElementSibling;
            selector ? $(prev).is(selector) && prevEls.push(prev) : prevEls.push(prev), el = prev
        }
        return $(prevEls)
    }, $.fn.nextAll = function (selector) {
        var nextEls = [], el = this[0];
        if (!el)return $([]);
        while (el.nextElementSibling) {
            var next = el.nextElementSibling;
            selector ? $(next).is(selector) && nextEls.push(next) : nextEls.push(next), el = next
        }
        return $(nextEls)
    }, $.fn.show = function () {
        var elementDisplay = {};

        function defaultDisplay(nodeName) {
            var element, display;
            return elementDisplay[nodeName] || (element = document.createElement(nodeName), document.body.appendChild(element), display = getComputedStyle(element, "").getPropertyValue("display"), element.parentNode.removeChild(element), display === "none" && (display = "block"), elementDisplay[nodeName] = display), elementDisplay[nodeName]
        }

        return this.each(function () {
            this.style.display === "none" && (this.style.display = ""), getComputedStyle(this, "").getPropertyValue("display") === "none", this.style.display = defaultDisplay(this.nodeName)
        })
    }
}), define("JSON", [], function (require, exports, module) {
    var JSON = typeof JSON != "undefined" ? JSON : {};

    function f(n) {
        return n < 10 ? "0" + n : n
    }

    function date(d, key) {
        return isFinite(d.valueOf()) ? d.getUTCFullYear() + "-" + f(d.getUTCMonth() + 1) + "-" + f(d.getUTCDate()) + "T" + f(d.getUTCHours()) + ":" + f(d.getUTCMinutes()) + ":" + f(d.getUTCSeconds()) + "Z" : null
    }

    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g, escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g, gap, indent, meta = {
        "\b": "\\b",
        "	": "\\t",
        "\n": "\\n",
        "\f": "\\f",
        "\r": "\\r",
        '"': '\\"',
        "\\": "\\\\"
    }, rep;

    function quote(string) {
        return escapable.lastIndex = 0, escapable.test(string) ? '"' + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c == "string" ? c : "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4)
        }) + '"' : '"' + string + '"'
    }

    function str(key, holder) {
        var i, k, v, length, mind = gap, partial, value = holder[key];
        value instanceof Date && (value = date(key)), typeof rep == "function" && (value = rep.call(holder, key, value));
        switch (typeof value) {
            case"string":
                return quote(value);
            case"number":
                return isFinite(value) ? String(value) : "null";
            case"boolean":
            case"null":
                return String(value);
            case"object":
                if (!value)return "null";
                gap += indent, partial = [];
                if (Object.prototype.toString.apply(value) === "[object Array]") {
                    length = value.length;
                    for (i = 0; i < length; i += 1)partial[i] = str(i, value) || "null";
                    return v = partial.length === 0 ? "[]" : gap ? "[\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "]" : "[" + partial.join(",") + "]", gap = mind, v
                }
                if (rep && typeof rep == "object") {
                    length = rep.length;
                    for (i = 0; i < length; i += 1)typeof rep[i] == "string" && (k = rep[i], v = str(k, value), v && partial.push(quote(k) + (gap ? ": " : ":") + v))
                } else for (k in value)Object.prototype.hasOwnProperty.call(value, k) && (v = str(k, value), v && partial.push(quote(k) + (gap ? ": " : ":") + v));
                return v = partial.length === 0 ? "{}" : gap ? "{\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "}" : "{" + partial.join(",") + "}", gap = mind, v
        }
    }

    JSON.stringify = function (value, replacer, space) {
        var i;
        gap = "", indent = "";
        if (typeof space == "number")for (i = 0; i < space; i += 1)indent += " "; else typeof space == "string" && (indent = space);
        rep = replacer;
        if (!replacer || typeof replacer == "function" || typeof replacer == "object" && typeof replacer.length == "number")return str("", {"": value});
        throw new Error("JSON.stringify")
    }, JSON.parse = function (text, reviver) {
        var j;

        function walk(holder, key) {
            var k, v, value = holder[key];
            if (value && typeof value == "object")for (k in value)Object.prototype.hasOwnProperty.call(value, k) && (v = walk(value, k), v !== undefined ? value[k] = v : delete value[k]);
            return reviver.call(holder, key, value)
        }

        text = String(text), cx.lastIndex = 0, cx.test(text) && (text = text.replace(cx, function (a) {
            return "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4)
        }));
        if (/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, "@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]").replace(/(?:^|:|,)(?:\s*\[)+/g, "")))return j = eval("(" + text + ")"), typeof reviver == "function" ? walk({"": j}, "") : j;
        throw new SyntaxError("JSON.parse")
    }, module.exports = JSON
}), define("IO", ["JSON"], function (require, exports, module) {
    var xm_json = require("JSON");
    (function (exports, global) {
        var io = exports;
        io.version = "0.9.6", io.protocol = 1, io.transports = [], io.j = [], io.sockets = {}, io.connect = function (host, details) {
            var uri = io.util.parseUri(host), uuri, socket;
            global && global.location && (uri.protocol = uri.protocol || global.location.protocol.slice(0, -1), uri.host = uri.host || (global.document ? global.document.domain : global.location.hostname), uri.port = uri.port || global.location.port), uuri = io.util.uniqueUri(uri);
            var options = {
                host: uri.host,
                secure: "https" == uri.protocol,
                port: uri.port || ("https" == uri.protocol ? 443 : 80),
                query: uri.query || ""
            };
            io.util.merge(options, details);
            if (options["force new connection"] || !io.sockets[uuri])socket = new io.Socket(options);
            return !options["force new connection"] && socket && (io.sockets[uuri] = socket), socket = socket || io.sockets[uuri], socket.of(uri.path.length > 1 ? uri.path : "")
        }
    })("object" == typeof _module ? _module.exports : this.io = {}, this), function (exports, global) {
        var util = exports.util = {}, re = /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/, parts = ["source", "protocol", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "anchor"];
        util.parseUri = function (str) {
            var m = re.exec(str || ""), uri = {}, i = 14;
            while (i--)uri[parts[i]] = m[i] || "";
            return uri
        }, util.uniqueUri = function (uri) {
            var protocol = uri.protocol, host = uri.host, port = uri.port;
            return "document" in global ? (host = host || document.domain, port = port || (protocol == "https" && document.location.protocol !== "https:" ? 443 : document.location.port)) : (host = host || "localhost", !port && protocol == "https" && (port = 443)), (protocol || "http") + "://" + host + ":" + (port || 80)
        }, util.query = function (base, addition) {
            var query = util.chunkQuery(base || ""), components = [];
            util.merge(query, util.chunkQuery(addition || ""));
            for (var part in query)query.hasOwnProperty(part) && components.push(part + "=" + query[part]);
            return components.length ? "?" + components.join("&") : ""
        }, util.chunkQuery = function (qs) {
            var query = {}, params = qs.split("&"), i = 0, l = params.length, kv;
            for (; i < l; ++i)kv = params[i].split("="), kv[0] && (query[kv[0]] = kv[1]);
            return query
        };
        var pageLoaded = !1;
        util.load = function (fn) {
            if ("document" in global && document.readyState === "complete" || pageLoaded)return fn();
            util.on(global, "load", fn, !1)
        }, util.on = function (element, event, fn, capture) {
            element.attachEvent ? element.attachEvent("on" + event, fn) : element.addEventListener && element.addEventListener(event, fn, capture)
        }, util.request = function (xdomain) {
            if (xdomain && "undefined" != typeof XDomainRequest)return new XDomainRequest;
            if ("undefined" != typeof XMLHttpRequest && (!xdomain || util.ua.hasCORS))return new XMLHttpRequest;
            if (!xdomain)try {
                return new (window[["Active"].concat("Object").join("X")])("Microsoft.XMLHTTP")
            } catch (e) {
            }
            return null
        }, util.errorPost = function (msg, is_tips) {
            var _data = "", clientInfo = {clientInfo: {appId: 1012}}, dataInfo = {
                category: "js.error",
                error: msg,
                userAgent: window.navigator.userAgent,
                target: "socketio",
                logtime: (new Date).getTime()
            };
            typeof console != "undefined" && console.log(msg);
            if (window.DDS) {
                var _dds = window.DDS;
                dataInfo.room = _dds.baseInfo.roomId, dataInfo.imUrl = window.GOLBALPARAMS && window.GOLBALPARAMS.ROOMPORT ? window.GOLBALPARAMS.ROOMPORT : "", dataInfo.userId = _dds.userInfo.userId, dataInfo.userType = _dds.userInfo.identity, _data = "clientInfo=" + encodeURIComponent(xm_json.stringify(clientInfo)) + "&dataInfo=" + encodeURIComponent(xm_json.stringify({dataInfo: dataInfo}));
                var _tj = new Image;
                _tj.src = "http://log.laifeng.com/log/client?" + _data + "&_d=" + (new Date).getTime()
            }
        }, util.serverCloseTip = function (delay) {
            var idname = "XINGMENG_SOCKET_IO_TIPS";
            if (document.getElementById(idname))return !1;
            var div = document.createElement("div");
            div.className = "M-io-tips", div.id = idname, document.body.appendChild(div);
            if (typeof delay != "undefined") {
                div.innerHTML = "网络异常，正在重新连接...<span>" + delay + "</span>秒" + '<a href="' + window.location.href + '">立即重试</a>';
                var span = div.getElementsByTagName("span")[0];
                this.keepTime(span, delay)
            } else div.innerHTML = '对不起，你已断开连接。<a href="' + window.location.href + '">请重试</a>'
        }, util.keepTime = function (element, count) {
            var _this = this;
            setTimeout(function () {
                count -= 1, count > 0 ? (element.innerHTML = count, _this.keepTime(element, count)) : document.body.removeChild(element.parentNode)
            }, 1e3)
        }, "undefined" != typeof window && util.load(function () {
            pageLoaded = !0
        }), util.defer = function (fn) {
            if (!util.ua.webkit || "undefined" != typeof importScripts)return fn();
            util.load(function () {
                setTimeout(fn, 100)
            })
        }, util.merge = function merge(target, additional, deep, lastseen) {
            var seen = lastseen || [], depth = typeof deep == "undefined" ? 2 : deep, prop;
            for (prop in additional)additional.hasOwnProperty(prop) && util.indexOf(seen, prop) < 0 && (typeof target[prop] != "object" || !depth ? (target[prop] = additional[prop], seen.push(additional[prop])) : util.merge(target[prop], additional[prop], depth - 1, seen));
            return target
        }, util.mixin = function (ctor, ctor2) {
            util.merge(ctor.prototype, ctor2.prototype)
        }, util.inherit = function (ctor, ctor2) {
            function f() {
            }

            f.prototype = ctor2.prototype, ctor.prototype = new f
        }, util.isArray = Array.isArray || function (obj) {
                return Object.prototype.toString.call(obj) === "[object Array]"
            }, util.intersect = function (arr, arr2) {
            var ret = [], longest = arr.length > arr2.length ? arr : arr2, shortest = arr.length > arr2.length ? arr2 : arr;
            for (var i = 0, l = shortest.length; i < l; i++)~util.indexOf(longest, shortest[i]) && ret.push(shortest[i]);
            return ret
        }, util.indexOf = function (arr, o, i) {
            for (var j = arr.length, i = i < 0 ? i + j < 0 ? 0 : i + j : i || 0; i < j && arr[i] !== o; i++);
            return j <= i ? -1 : i
        }, util.toArray = function (enu) {
            var arr = [];
            for (var i = 0, l = enu.length; i < l; i++)arr.push(enu[i]);
            return arr
        }, util.ua = {}, util.ua.hasCORS = "undefined" != typeof XMLHttpRequest && function () {
                try {
                    var a = new XMLHttpRequest
                } catch (e) {
                    return !1
                }
                return a.withCredentials != undefined
            }(), util.ua.webkit = "undefined" != typeof navigator && /webkit/i.test(navigator.userAgent)
    }("undefined" != typeof io ? io : _module.exports, this), function (exports, io) {
        exports.EventEmitter = EventEmitter;
        function EventEmitter() {
        }

        EventEmitter.prototype.on = function (name, fn) {
            return this.$events || (this.$events = {}), this.$events[name] ? io.util.isArray(this.$events[name]) ? this.$events[name].push(fn) : this.$events[name] = [this.$events[name], fn] : this.$events[name] = fn, this
        }, EventEmitter.prototype.addListener = EventEmitter.prototype.on, EventEmitter.prototype.once = function (name, fn) {
            var self = this;

            function on() {
                self.removeListener(name, on), fn.apply(this, arguments)
            }

            return on.listener = fn, this.on(name, on), this
        }, EventEmitter.prototype.removeListener = function (name, fn) {
            if (this.$events && this.$events[name]) {
                var list = this.$events[name];
                if (io.util.isArray(list)) {
                    var pos = -1;
                    for (var i = 0, l = list.length; i < l; i++)if (list[i] === fn || list[i].listener && list[i].listener === fn) {
                        pos = i;
                        break
                    }
                    if (pos < 0)return this;
                    list.splice(pos, 1), list.length || delete this.$events[name]
                } else(list === fn || list.listener && list.listener === fn) && delete this.$events[name]
            }
            return this
        }, EventEmitter.prototype.removeAllListeners = function (name) {
            return this.$events && this.$events[name] && (this.$events[name] = null), this
        }, EventEmitter.prototype.listeners = function (name) {
            return this.$events || (this.$events = {}), this.$events[name] || (this.$events[name] = []), io.util.isArray(this.$events[name]) || (this.$events[name] = [this.$events[name]]), this.$events[name]
        }, EventEmitter.prototype.emit = function (name) {
            if (!this.$events)return !1;
            var handler = this.$events[name];
            if (!handler)return !1;
            var args = Array.prototype.slice.call(arguments, 1);
            if ("function" == typeof handler)handler.apply(this, args); else {
                if (!io.util.isArray(handler))return !1;
                var listeners = handler.slice();
                for (var i = 0, l = listeners.length; i < l; i++)listeners[i].apply(this, args)
            }
            return !0
        }
    }("undefined" != typeof io ? io : _module.exports, "undefined" != typeof io ? io : _module.parent.exports), function (exports, nativeJSON) {
        "use strict";
        if (nativeJSON && nativeJSON.parse)return exports.JSON = {
            parse: nativeJSON.parse,
            stringify: nativeJSON.stringify
        };
        exports.JSON = xm_json
    }("undefined" != typeof io ? io : _module.exports, typeof JSON != "undefined" ? JSON : undefined), function (exports, io) {
        var parser = exports.parser = {}, packets = parser.packets = ["disconnect", "connect", "heartbeat", "message", "json", "event", "ack", "error", "noop"], reasons = parser.reasons = ["transport not supported", "client not handshaken", "unauthorized"], advice = parser.advice = ["reconnect"], JSON = io.JSON, indexOf = io.util.indexOf;
        parser.encodePacket = function (packet) {
            var type = indexOf(packets, packet.type), id = packet.id || "", endpoint = packet.endpoint || "", ack = packet.ack, data = null;
            switch (packet.type) {
                case"error":
                    var reason = packet.reason ? indexOf(reasons, packet.reason) : "", adv = packet.advice ? indexOf(advice, packet.advice) : "";
                    if (reason !== "" || adv !== "")data = reason + (adv !== "" ? "+" + adv : "");
                    break;
                case"message":
                    packet.data !== "" && (data = packet.data);
                    break;
                case"event":
                    var ev = {name: packet.name};
                    packet.args && packet.args.length && (ev.args = packet.args), data = JSON.stringify(ev);
                    break;
                case"json":
                    data = JSON.stringify(packet.data);
                    break;
                case"connect":
                    packet.qs && (data = packet.qs);
                    break;
                case"ack":
                    data = packet.ackId + (packet.args && packet.args.length ? "+" + JSON.stringify(packet.args) : "")
            }
            var encoded = [type, id + (ack == "data" ? "+" : ""), endpoint];
            return data !== null && data !== undefined && encoded.push(data), encoded.join(":")
        }, parser.encodePayload = function (packets) {
            var decoded = "";
            if (packets.length == 1)return packets[0];
            for (var i = 0, l = packets.length; i < l; i++) {
                var packet = packets[i];
                decoded += "�" + packet.length + "�" + packets[i]
            }
            return decoded
        };
        var regexp = /([^:]+):([0-9]+)?(\+)?:([^:]+)?:?([\s\S]*)?/;
        parser.decodePacket = function (data) {
            var pieces = data.match(regexp);
            if (!pieces)return {};
            var id = pieces[2] || "", data = pieces[5] || "", packet = {
                type: packets[pieces[1]],
                endpoint: pieces[4] || ""
            };
            id && (packet.id = id, pieces[3] ? packet.ack = "data" : packet.ack = !0);
            switch (packet.type) {
                case"error":
                    var pieces = data.split("+");
                    packet.reason = reasons[pieces[0]] || "", packet.advice = advice[pieces[1]] || "";
                    break;
                case"message":
                    packet.data = data || "";
                    break;
                case"event":
                    try {
                        var opts = JSON.parse(data);
                        packet.name = opts.name, packet.args = opts.args
                    } catch (e) {
                    }
                    packet.args = packet.args || [];
                    break;
                case"json":
                    try {
                        packet.data = JSON.parse(data)
                    } catch (e) {
                    }
                    break;
                case"connect":
                    packet.qs = data || "";
                    break;
                case"ack":
                    var pieces = data.match(/^([0-9]+)(\+)?(.*)/);
                    if (pieces) {
                        packet.ackId = pieces[1], packet.args = [];
                        if (pieces[3])try {
                            packet.args = pieces[3] ? JSON.parse(pieces[3]) : []
                        } catch (e) {
                        }
                    }
                    break;
                case"disconnect":
                case"heartbeat":
            }
            return packet
        }, parser.decodePayload = function (data) {
            if (data.charAt(0) == "�") {
                var ret = [];
                for (var i = 1, length = ""; i < data.length; i++)data.charAt(i) == "�" ? (ret.push(parser.decodePacket(data.substr(i + 1).substr(0, length))), i += Number(length) + 1, length = "") : length += data.charAt(i);
                return ret
            }
            return [parser.decodePacket(data)]
        }
    }("undefined" != typeof io ? io : _module.exports, "undefined" != typeof io ? io : _module.parent.exports), function (exports, io) {
        exports.Transport = Transport;
        function Transport(socket, sessid) {
            this.socket = socket, this.sessid = sessid
        }

        io.util.mixin(Transport, io.EventEmitter), Transport.prototype.onData = function (data) {
            this.clearCloseTimeout(), (this.socket.connected || this.socket.connecting || this.socket.reconnecting) && this.setCloseTimeout();
            if (data !== "") {
                var msgs = io.parser.decodePayload(data);
                if (msgs && msgs.length)for (var i = 0, l = msgs.length; i < l; i++)this.onPacket(msgs[i])
            }
            return this
        }, Transport.prototype.onPacket = function (packet) {
            return this.socket.setHeartbeatTimeout(), packet.type == "heartbeat" ? this.onHeartbeat() : (packet.type == "connect" && packet.endpoint == "" && this.onConnect(), packet.type == "error" && packet.advice == "reconnect" && (this.open = !1), this.socket.onPacket(packet), this)
        }, Transport.prototype.setCloseTimeout = function () {
            if (!this.closeTimeout) {
                var self = this;
                this.closeTimeout = setTimeout(function () {
                    self.onDisconnect()
                }, this.socket.closeTimeout)
            }
        }, Transport.prototype.onDisconnect = function () {
            return this.close && this.open && this.close(), this.clearTimeouts(), this.socket.onDisconnect(), this
        }, Transport.prototype.onConnect = function () {
            return this.socket.onConnect(), this
        }, Transport.prototype.clearCloseTimeout = function () {
            this.closeTimeout && (clearTimeout(this.closeTimeout), this.closeTimeout = null)
        }, Transport.prototype.clearTimeouts = function () {
            this.clearCloseTimeout(), this.reopenTimeout && clearTimeout(this.reopenTimeout)
        }, Transport.prototype.packet = function (packet) {
            this.send(io.parser.encodePacket(packet))
        }, Transport.prototype.onHeartbeat = function (heartbeat) {
            this.packet({type: "heartbeat"})
        }, Transport.prototype.onOpen = function () {
            this.open = !0, this.clearCloseTimeout(), this.socket.onOpen()
        }, Transport.prototype.onClose = function () {
            var self = this;
            this.open = !1, this.socket.onClose(), this.onDisconnect()
        }, Transport.prototype.prepareUrl = function () {
            var options = this.socket.options;
            return this.scheme() + "://" + options.host + ":" + options.port + "/" + options.resource + "/" + io.protocol + "/" + this.name + "/"
        }, Transport.prototype.ready = function (socket, fn) {
            fn.call(this)
        }
    }("undefined" != typeof io ? io : _module.exports, "undefined" != typeof io ? io : _module.parent.exports), function (exports, io, global) {
        exports.Socket = Socket;
        function Socket(options) {
            this.options = {
                port: 80,
                secure: !1,
                document: "document" in global ? document : !1,
                resource: "socket.io",
                transports: io.transports,
                "connect timeout": 1e4,
                "try multiple transports": !0,
                reconnect: !0,
                "reconnection delay": 500,
                "reconnection limit": Infinity,
                "reopen delay": 3e3,
                "max reconnection attempts": 10,
                "sync disconnect on unload": !0,
                "auto connect": !0,
                "allow show tips": !1,
                "flash policy port": 10050
            }, io.util.merge(this.options, options), this.connected = !1, this.open = !1, this.connecting = !1, this.reconnecting = !1, this.namespaces = {}, this.buffer = [], this.doBuffer = !1;
            if (this.options["sync disconnect on unload"] && (!this.isXDomain() || io.util.ua.hasCORS)) {
                var self = this;
                io.util.on(global, "unload", function () {
                    self.disconnectSync()
                }, !1)
            }
            this.options["auto connect"] && this.connect()
        }

        io.util.mixin(Socket, io.EventEmitter), Socket.prototype.of = function (name) {
            return this.namespaces[name] || (this.namespaces[name] = new io.SocketNamespace(this, name), name !== "" && this.namespaces[name].packet({type: "connect"})), this.namespaces[name]
        }, Socket.prototype.publish = function () {
            this.emit.apply(this, arguments);
            var nsp;
            for (var i in this.namespaces)this.namespaces.hasOwnProperty(i) && (nsp = this.of(i), nsp.$emit.apply(nsp, arguments))
        };
        function empty() {
        }

        Socket.prototype.handshake = function (fn) {
            var self = this, options = this.options;

            function complete(data) {
                data instanceof Error ? (io.util.errorPost("接受服务器错误数据格式：" + data.message, self.options["allow show tips"]), self.onError(data.message)) : fn.apply(null, data.split(":"))
            }

            var url = ["http" + (options.secure ? "s" : "") + ":/", options.host + ":" + options.port, options.resource, io.protocol, io.util.query(this.options.query, "t=" + +(new Date))].join("/");
            if (this.isXDomain() && !io.util.ua.hasCORS) {
                var insertAt = document.getElementsByTagName("script")[0], script = document.createElement("script");
                script.src = url + "&jsonp=" + io.j.length, insertAt.parentNode.insertBefore(script, insertAt), io.j.push(function (data) {
                    complete(data), script.parentNode.removeChild(script)
                })
            } else {
                var xhr = io.util.request();
                xhr.open("GET", url, !0), xhr.withCredentials = !0, xhr.onreadystatechange = function () {
                    if (xhr.readyState == 4) {
                        xhr.onreadystatechange = empty;
                        if (xhr.status == 200)complete(xhr.responseText); else {
                            !self.reconnecting && self.onError(xhr.responseText);
                            var _status = xhr.status, _msg = xhr.responseText ? xhr.responseText : "超时，得不到服务器响应";
                            io.util.errorPost("请求传输协议时服务器出错，错误状态：" + _status + "，错误信息：" + _msg, self.options["allow show tips"])
                        }
                    }
                }, xhr.send(null)
            }
        }, Socket.prototype.getTransport = function (override) {
            var transports = override || this.transports, match;
            for (var i = 0, transport; transport = transports[i]; i++)if (io.Transport[transport] && io.Transport[transport].check(this) && (!this.isXDomain() || io.Transport[transport].xdomainCheck()))return new io.Transport[transport](this, this.sessionid);
            return null
        }, Socket.prototype.connect = function (fn) {
            if (this.connecting)return this;
            var self = this;
            return self.connecting = !0, this.handshake(function (sid, heartbeat, close, transports) {
                self.sessionid = sid, self.closeTimeout = close * 1e3, self.heartbeatTimeout = heartbeat * 1e3, self.transports = transports ? io.util.intersect(transports.split(","), self.options.transports) : self.options.transports, self.setHeartbeatTimeout();
                function connect(transports) {
                    self.transport && self.transport.clearTimeouts(), self.transport = self.getTransport(transports);
                    if (!self.transport)return self.publish("connect_failed");
                    self.transport.ready(self, function () {
                        self.connecting = !0, self.publish("connecting", self.transport.name), self.transport.open(), self.options["connect timeout"] && (self.connectTimeoutTimer = setTimeout(function () {
                            if (!self.connected) {
                                self.connecting = !1;
                                if (self.options["try multiple transports"]) {
                                    self.remainingTransports || (self.remainingTransports = self.transports.slice(0));
                                    var remaining = self.remainingTransports;
                                    while (remaining.length > 0 && remaining.splice(0, 1)[0] != self.transport.name);
                                    remaining.length ? connect(remaining) : (io.util.errorPost("浏览器不支持websocket协议或flashwebsocket未加载", self.options["allow show tips"]), self.publish("connect_failed"))
                                }
                            }
                        }, self.options["connect timeout"]))
                    })
                }

                connect(self.transports), self.once("connect", function () {
                    clearTimeout(self.connectTimeoutTimer), fn && typeof fn == "function" && fn()
                })
            }), this
        }, Socket.prototype.setHeartbeatTimeout = function () {
            clearTimeout(this.heartbeatTimeoutTimer);
            var self = this;
            this.heartbeatTimeoutTimer = setTimeout(function () {
                self.transport.onClose()
            }, this.heartbeatTimeout)
        }, Socket.prototype.packet = function (data) {
            return this.connected && !this.doBuffer ? this.transport.packet(data) : this.buffer.push(data), this
        }, Socket.prototype.setBuffer = function (v) {
            this.doBuffer = v, !v && this.connected && this.buffer.length && (this.transport.payload(this.buffer), this.buffer = [])
        }, Socket.prototype.disconnect = function () {
            if (this.connected || this.connecting)this.open && this.of("").packet({type: "disconnect"}), this.onDisconnect("booted");
            return this
        }, Socket.prototype.disconnectSync = function () {
            var xhr = io.util.request(), uri = this.resource + "/" + io.protocol + "/" + this.sessionid;
            xhr.open("GET", uri, !0), this.onDisconnect("booted")
        }, Socket.prototype.isXDomain = function () {
            var port = global.location.port || ("https:" == global.location.protocol ? 443 : 80);
            return this.options.host !== global.location.hostname || this.options.port != port
        }, Socket.prototype.onConnect = function () {
            this.connected || (this.connected = !0, this.connecting = !1, this.doBuffer || this.setBuffer(!1), this.emit("connect"))
        }, Socket.prototype.onOpen = function () {
            this.open = !0
        }, Socket.prototype.onClose = function () {
            this.open = !1, clearTimeout(this.heartbeatTimeoutTimer);
            if (this.options["allow show tips"]) {
                var _this = this;
                setTimeout(function () {
                    _this.reconnectMark = 1, _this.serverClose()
                }, 5e3)
            }
        }, Socket.prototype.serverClose = function () {
            this.serverCloseTimer && clearTimeout(this.serverCloseTimer);
            var _this = this, _delay = Math.ceil(Math.max(5e3, Math.random() * 2e4));
            io.util.serverCloseTip(Math.ceil(_delay / 1e3) + 9), this.serverCloseTimer = setTimeout(function () {
                _this.connecting = !1, _this.connected = !1;
                if (_this.severClosed)return;
                _this.connect(), setTimeout(function () {
                    _this.reconnectMark += 1;
                    if (_this.connected)return !1;
                    _this.reconnectMark <= 6 ? _this.serverClose() : io.util.serverCloseTip()
                }, 1e4)
            }, _delay)
        }, Socket.prototype.onPacket = function (packet) {
            this.of(packet.endpoint).onPacket(packet)
        }, Socket.prototype.onError = function (err) {
            err && err.advice && err.advice === "reconnect" && (this.connected || this.connecting) && (this.disconnect(), this.options.reconnect && this.reconnect())
        }, Socket.prototype.onDisconnect = function (reason) {
            var wasConnected = this.connected, wasConnecting = this.connecting;
            this.connected = !1, this.connecting = !1, this.open = !1;
            if (wasConnected || wasConnecting)this.transport.close(), this.transport.clearTimeouts(), wasConnected && (this.publish("disconnect", reason), "booted" != reason && this.options.reconnect && !this.reconnecting && this.reconnect())
        }, Socket.prototype.reconnect = function () {
            this.options["allow show tips"] && (this.severClosed = !0), this.reconnecting = !0, this.reconnectionAttempts = 0, this.reconnectionDelay = this.options["reconnection delay"];
            var self = this, maxAttempts = this.options["max reconnection attempts"], tryMultiple = this.options["try multiple transports"], limit = this.options["reconnection limit"];

            function reset() {
                if (self.connected) {
                    for (var i in self.namespaces)self.namespaces.hasOwnProperty(i) && "" !== i && self.namespaces[i].packet({type: "connect"});
                    self.publish("reconnect", self.transport.name, self.reconnectionAttempts)
                }
                clearTimeout(self.reconnectionTimer), self.removeListener("connect_failed", maybeReconnect), self.removeListener("connect", maybeReconnect), self.reconnecting = !1, delete self.reconnectionAttempts, delete self.reconnectionDelay, delete self.reconnectionTimer, delete self.redoTransports, self.options["try multiple transports"] = tryMultiple
            }

            function maybeReconnect() {
                if (!self.reconnecting)return;
                if (self.connected)return reset();
                if (self.connecting && self.reconnecting)return self.reconnectionTimer = setTimeout(maybeReconnect, 1e3);
                self.reconnectionAttempts++ >= maxAttempts ? self.redoTransports ? (self.publish("reconnect_failed"), io.util.errorPost("重连连接失败", self.options["allow show tips"]), reset()) : (self.on("connect_failed", maybeReconnect), self.options["try multiple transports"] = !0, self.transport = self.getTransport(), self.redoTransports = !0, self.connect()) : (self.reconnectionDelay < limit && (self.reconnectionDelay *= 2), self.connect(), self.publish("reconnecting", self.reconnectionDelay, self.reconnectionAttempts), self.reconnectionTimer = setTimeout(maybeReconnect, self.reconnectionDelay))
            }

            this.options["try multiple transports"] = !1, this.reconnectionTimer = setTimeout(maybeReconnect, this.reconnectionDelay), this.on("connect", maybeReconnect)
        }
    }("undefined" != typeof io ? io : _module.exports, "undefined" != typeof io ? io : _module.parent.exports, this), function (exports, io) {
        exports.SocketNamespace = SocketNamespace;
        function SocketNamespace(socket, name) {
            this.socket = socket, this.name = name || "", this.flags = {}, this.json = new Flag(this, "json"), this.ackPackets = 0, this.acks = {}
        }

        io.util.mixin(SocketNamespace, io.EventEmitter), SocketNamespace.prototype.$emit = io.EventEmitter.prototype.emit, SocketNamespace.prototype.of = function () {
            return this.socket.of.apply(this.socket, arguments)
        }, SocketNamespace.prototype.packet = function (packet) {
            return packet.endpoint = this.name, this.socket.packet(packet), this.flags = {}, this
        }, SocketNamespace.prototype.send = function (data, fn) {
            var packet = {type: this.flags.json ? "json" : "message", data: data};
            return "function" == typeof fn && (packet.id = ++this.ackPackets, packet.ack = !0, this.acks[packet.id] = fn), this.packet(packet)
        }, SocketNamespace.prototype.emit = function (name) {
            var args = Array.prototype.slice.call(arguments, 1), lastArg = args[args.length - 1], packet = {
                type: "event",
                name: name
            };
            return "function" == typeof lastArg && (packet.id = ++this.ackPackets, packet.ack = "data", this.acks[packet.id] = lastArg, args = args.slice(0, args.length - 1)), packet.args = args, this.packet(packet)
        }, SocketNamespace.prototype.disconnect = function () {
            return this.name === "" ? this.socket.disconnect() : (this.packet({type: "disconnect"}), this.$emit("disconnect")), this
        }, SocketNamespace.prototype.onPacket = function (packet) {
            var self = this;

            function ack() {
                self.packet({type: "ack", args: io.util.toArray(arguments), ackId: packet.id})
            }

            switch (packet.type) {
                case"connect":
                    this.$emit("connect", packet.qs);
                    break;
                case"disconnect":
                    this.name === "" ? this.socket.onDisconnect(packet.reason || "booted") : this.$emit("disconnect", packet.reason);
                    break;
                case"message":
                case"json":
                    var params = ["message", packet.data];
                    packet.ack == "data" ? params.push(ack) : packet.ack && this.packet({
                        type: "ack",
                        ackId: packet.id
                    }), this.$emit.apply(this, params);
                    break;
                case"event":
                    var params = [packet.name].concat(packet.args);
                    packet.ack == "data" && params.push(ack), this.$emit.apply(this, params);
                    break;
                case"ack":
                    this.acks[packet.ackId] && (this.acks[packet.ackId].apply(this, packet.args), delete this.acks[packet.ackId]);
                    break;
                case"error":
                    packet.advice ? (io.util.errorPost("服务器未识别错误数据格式" + packet), this.socket.onError(packet)) : packet.reason == "unauthorized" ? this.$emit("connect_failed", packet.reason) : this.$emit("error", packet.reason)
            }
        };
        function Flag(nsp, name) {
            this.namespace = nsp, this.name = name
        }

        Flag.prototype.send = function () {
            this.namespace.flags[this.name] = !0, this.namespace.send.apply(this.namespace, arguments)
        }, Flag.prototype.emit = function () {
            this.namespace.flags[this.name] = !0, this.namespace.emit.apply(this.namespace, arguments)
        }
    }("undefined" != typeof io ? io : _module.exports, "undefined" != typeof io ? io : _module.parent.exports), function (exports, io, global) {
        exports.websocket = WS;
        function WS(socket) {
            io.Transport.apply(this, arguments)
        }

        io.util.inherit(WS, io.Transport), WS.prototype.name = "websocket", WS.prototype.open = function () {
            var query = io.util.query(this.socket.options.query), self = this, Socket;
            return Socket || (Socket = global.MozWebSocket || global.WebSocket), typeof console != "undefined" && console.log(this.prepareUrl()), this.websocket = new Socket(this.prepareUrl() + query), this.websocket.onopen = function () {
                self.onOpen(), self.socket.setBuffer(!1)
            }, this.websocket.onmessage = function (ev) {
                self.onData(ev.data)
            }, this.websocket.onclose = function () {
                self.onClose(), self.socket.setBuffer(!0)
            }, this.websocket.onerror = function (e) {
                io.util.errorPost("浏览器websocket协议出现异常：" + e), self.onError(e)
            }, this
        }, WS.prototype.send = function (data) {
            return this.websocket.send(data), this
        }, WS.prototype.payload = function (arr) {
            for (var i = 0, l = arr.length; i < l; i++)this.packet(arr[i]);
            return this
        }, WS.prototype.close = function () {
            return this.websocket.close(), this
        }, WS.prototype.onError = function (e) {
            this.socket.onError(e)
        }, WS.prototype.scheme = function () {
            return this.socket.options.secure ? "wss" : "ws"
        }, WS.check = function () {
            return "WebSocket" in global && !("__addTask" in WebSocket) || "MozWebSocket" in global
        }, WS.xdomainCheck = function () {
            return !0
        }, io.transports.push("websocket")
    }("undefined" != typeof io ? io.Transport : _module.exports, "undefined" != typeof io ? io : _module.parent.exports, this), function (exports, io) {
        exports.flashsocket = Flashsocket;
        function Flashsocket() {
            io.Transport.websocket.apply(this, arguments)
        }

        io.util.inherit(Flashsocket, io.Transport.websocket), Flashsocket.prototype.name = "flashsocket", Flashsocket.prototype.open = function () {
            var self = this, args = arguments;
            return WebSocket.__addTask(function () {
                io.Transport.websocket.prototype.open.apply(self, args)
            }), this
        }, Flashsocket.prototype.send = function () {
            var self = this, args = arguments;
            return WebSocket.__addTask(function () {
                io.Transport.websocket.prototype.send.apply(self, args)
            }), this
        }, Flashsocket.prototype.close = function () {
            return WebSocket.__tasks.length = 0, io.Transport.websocket.prototype.close.call(this), this
        }, Flashsocket.prototype.ready = function (socket, fn) {
            function init() {
                var options = socket.options, port = options["flash policy port"], path = ["http" + (options.secure ? "s" : "") + ":/", options.host + ":" + options.port, options.resource, "static/flashsocket", "WebSocketMain" + (socket.isXDomain() ? "Insecure" : "") + ".swf"];
                typeof WEB_SOCKET_SWF_LOCATION == "undefined" && (WEB_SOCKET_SWF_LOCATION = path.join("/")), port !== 843 && WebSocket.loadFlashPolicyFile("xmlsocket://" + options.host + ":" + port), WebSocket.__initialize(), fn.call(self)
            }

            var self = this;
            if (document.body)return init();
            io.util.load(init)
        }, Flashsocket.check = function () {
            return !1
        }, Flashsocket.xdomainCheck = function () {
            return !0
        }, typeof window != "undefined" && (WEB_SOCKET_DISABLE_AUTO_INITIALIZATION = !0), io.transports.push("flashsocket")
    }("undefined" != typeof io ? io.Transport : _module.exports, "undefined" != typeof io ? io : _module.parent.exports), function () {
        if ("undefined" == typeof window || window.WebSocket)return;
        var console = window.console;
        if (!console || !console.log || !console.error)console = {
            log: function () {
            }, error: function () {
            }
        };
        location.protocol == "file:" && (io.util.errorPost("WARNING: web-socket-js doesn't work in file:///... URL unless you set Flash Security Settings properly. Open the page via Web server i.e. http://..."), console.error("WARNING: web-socket-js doesn't work in file:///... URL unless you set Flash Security Settings properly. Open the page via Web server i.e. http://...")), WebSocket = function (url, protocols, proxyHost, proxyPort, headers) {
            var self = this;
            self.__id = WebSocket.__nextId++, WebSocket.__instances[self.__id] = self, self.readyState = WebSocket.CONNECTING, self.bufferedAmount = 0, self.__events = {}, protocols ? typeof protocols == "string" && (protocols = [protocols]) : protocols = [], setTimeout(function () {
                WebSocket.__addTask(function () {
                    WebSocket.__flash.create(self.__id, url, protocols, proxyHost || null, proxyPort || 0, headers || null)
                })
            }, 0)
        }, WebSocket.prototype.send = function (data) {
            if (this.readyState == WebSocket.CONNECTING)throw"INVALID_STATE_ERR: Web Socket connection has not been established";
            var result = WebSocket.__flash.send(this.__id, encodeURIComponent(data));
            return result < 0 ? !0 : (this.bufferedAmount += result, !1)
        }, WebSocket.prototype.close = function () {
            if (this.readyState == WebSocket.CLOSED || this.readyState == WebSocket.CLOSING)return;
            this.readyState = WebSocket.CLOSING, WebSocket.__flash.close(this.__id)
        }, WebSocket.prototype.addEventListener = function (type, listener, useCapture) {
            type in this.__events || (this.__events[type] = []), this.__events[type].push(listener)
        }, WebSocket.prototype.removeEventListener = function (type, listener, useCapture) {
            if (!(type in this.__events))return;
            var events = this.__events[type];
            for (var i = events.length - 1; i >= 0; --i)if (events[i] === listener) {
                events.splice(i, 1);
                break
            }
        }, WebSocket.prototype.dispatchEvent = function (event) {
            var events = this.__events[event.type] || [];
            for (var i = 0; i < events.length; ++i)events[i](event);
            var handler = this["on" + event.type];
            handler && handler(event)
        }, WebSocket.prototype.__handleEvent = function (flashEvent) {
            "readyState" in flashEvent && (this.readyState = flashEvent.readyState), "protocol" in flashEvent && (this.protocol = flashEvent.protocol);
            var jsEvent;
            if (flashEvent.type == "open" || flashEvent.type == "error")jsEvent = this.__createSimpleEvent(flashEvent.type); else if (flashEvent.type == "close")jsEvent = this.__createSimpleEvent("close"); else {
                if (flashEvent.type != "message")throw"unknown event type: " + flashEvent.type;
                var data = decodeURIComponent(flashEvent.message);
                jsEvent = this.__createMessageEvent("message", data)
            }
            this.dispatchEvent(jsEvent)
        }, WebSocket.prototype.__createSimpleEvent = function (type) {
            if (document.createEvent && window.Event) {
                var event = document.createEvent("Event");
                return event.initEvent(type, !1, !1), event
            }
            return {type: type, bubbles: !1, cancelable: !1}
        }, WebSocket.prototype.__createMessageEvent = function (type, data) {
            if (document.createEvent && window.MessageEvent && !window.opera) {
                var event = document.createEvent("MessageEvent");
                return event.initMessageEvent("message", !1, !1, data, null, null, window, null), event
            }
            return {type: type, data: data, bubbles: !1, cancelable: !1}
        }, WebSocket.CONNECTING = 0, WebSocket.OPEN = 1, WebSocket.CLOSING = 2, WebSocket.CLOSED = 3, WebSocket.__flash = null, WebSocket.__instances = {}, WebSocket.__tasks = [], WebSocket.__nextId = 0, WebSocket.loadFlashPolicyFile = function (url) {
            WebSocket.__addTask(function () {
                WebSocket.__flash.loadManualPolicyFile(url)
            })
        }, WebSocket.__initialize = function () {
            if (WebSocket.__flash)return;
            WebSocket.__swfLocation && (window.WEB_SOCKET_SWF_LOCATION = WebSocket.__swfLocation);
            if (!window.WEB_SOCKET_SWF_LOCATION) {
                io.util.errorPost("[WebSocket] set WEB_SOCKET_SWF_LOCATION to location of WebSocketMain.swf"), console.error("[WebSocket] set WEB_SOCKET_SWF_LOCATION to location of WebSocketMain.swf");
                return
            }
            var container = document.createElement("div");
            container.id = "webSocketContainer", container.style.position = "absolute", WebSocket.__isFlashLite() ? (container.style.left = "0px", container.style.top = "0px") : (container.style.left = "-100px", container.style.top = "-100px");
            var holder = document.createElement("div");
            holder.id = "webSocketFlash", container.appendChild(holder), document.body.appendChild(container)
        }, WebSocket.__onFlashInitialized = function () {
            setTimeout(function () {
                WebSocket.__flash = document.getElementById("webSocketFlash"), WebSocket.__flash.setCallerUrl(location.href), WebSocket.__flash.setDebug(!!window.WEB_SOCKET_DEBUG);
                for (var i = 0; i < WebSocket.__tasks.length; ++i)WebSocket.__tasks[i]();
                WebSocket.__tasks = []
            }, 0)
        }, WebSocket.__onFlashEvent = function () {
            return setTimeout(function () {
                try {
                    var events = WebSocket.__flash.receiveEvents();
                    for (var i = 0; i < events.length; ++i)WebSocket.__instances[events[i].webSocketId].__handleEvent(events[i])
                } catch (e) {
                    io.util.errorPost("flash调用异常：" + e + ""), console.error(e)
                }
            }, 0), !0
        }, WebSocket.__log = function (message) {
            console.log(decodeURIComponent(message))
        }, WebSocket.__error = function (message) {
            io.util.errorPost(decodeURIComponent(message)), console.error(decodeURIComponent(message))
        }, WebSocket.__addTask = function (task) {
            WebSocket.__flash ? task() : WebSocket.__tasks.push(task)
        }, WebSocket.__isFlashLite = function () {
            if (!window.navigator || !window.navigator.mimeTypes)return !1;
            var mimeType = window.navigator.mimeTypes["application/x-shockwave-flash"];
            return !mimeType || !mimeType.enabledPlugin || !mimeType.enabledPlugin.filename ? !1 : mimeType.enabledPlugin.filename.match(/flashlite/i) ? !0 : !1
        }, window.WEB_SOCKET_DISABLE_AUTO_INITIALIZATION || (window.addEventListener ? window.addEventListener("load", function () {
            WebSocket.__initialize()
        }, !1) : window.attachEvent("onload", function () {
            WebSocket.__initialize()
        }))
    }(), module.exports = io
}), define("UTIL", ["JQ", "JSON"], function (require, exports, module) {
    var $ = require("JQ"), JSON = require("JSON");
    exports.inherit = function (ctor, ctor2) {
        function f() {
        }

        f.prototype = ctor2.prototype, ctor.prototype = new f
    };
    var merge = function merge(target, additional, deep, lastseen) {
        var seen = lastseen || [], depth = typeof deep == "undefined" ? 2 : deep, prop;
        for (prop in additional)additional.hasOwnProperty(prop) && exports.indexOf(seen, prop) < 0 && (typeof target[prop] != "object" || !depth ? (target[prop] = additional[prop], seen.push(additional[prop])) : merge(target[prop], additional[prop], depth - 1, seen));
        return target
    };
    exports.mixin = function (ctor, ctor2) {
        merge(ctor.prototype, ctor2.prototype)
    }, exports.setCookie = function (name, value, expires, path, domain) {
        var str = name + "=" + escape(value);
        if (expires != null && expires != "") {
            expires == 0 && (expires = 5256e4);
            var exp = new Date;
            exp.setTime(exp.getTime() + expires * 60 * 1e3), str += "; expires=" + exp.toGMTString()
        }
        path && (str += "; path=" + path), domain && (str += "; domain=" + domain), document.cookie = str
    }, exports.getCookie = function (name) {
        var tmp, reg = new RegExp("(^| )" + name + "=([^;]*)(;|$)", "gi");
        return (tmp = reg.exec(unescape(document.cookie))) ? tmp[2] : null
    }, exports.delCookie = function (name, path, domain) {
        document.cookie = name + "=" + (path ? "; path=" + path : "") + (domain ? "; domain=" + domain : "") + "; expires=Thu, 01-Jan-70 00:00:01 GMT"
    }, exports.loading = function (type, url, callback, id) {
        if (type !== "img" && type !== "script" && type !== "css")return;
        var road = null;
        type === "img" ? (road = new Image, road.src = url) : (type === "script" ? (road = document.createElement("script"), road.type = "text/javascript", road.src = url, typeof id != "undefined" && (road.id = id)) : (road = document.createElement("link"), road.type = "text/css", road.rel = "stylesheet", road.href = url), document.getElementsByTagName("head")[0].appendChild(road)), road.readyState ? road.onreadystatechange = function () {
            if (road.readyState == "loaded" || road.readyState == "complete")road.onreadystatechange = null, callback && Object.prototype.toString.call(callback) === "[object Function]" && callback(road)
        } : road.onload = function () {
            callback(road)
        }
    }, function (EX) {
        var _re = /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/, _parts = ["source", "protocol", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "anchor"];

        function _parseUri(str) {
            var m = _re.exec(str || ""), uri = {}, i = 14;
            while (i--)uri[_parts[i]] = m[i] || "";
            return uri
        }

        function _ajax(type, url, data, success, complete, error, dataType) {
            return $.ajax({
                url: url,
                data: data,
                dataType: dataType || "json",
                cache: !1,
                timeout: 6e4,
                complete: function () {
                    complete && complete.call(this)
                },
                type: type,
                error: function () {
                    error && error.call(this, {code: 99, msg: "网络错误"})
                },
                success: function (data) {
                    data.response ? (data = data.response, data.code != undefined && data.code == 0 ? success.call(this, data) : error && error.call(this, data)) : error && error.call(this, {
                        code: 99,
                        msg: "网络错误"
                    })
                }
            })
        }

        var _proxyPage = null, _onLoad = !1, _PROXY_URL = "/ajaxproxy.html";

        function _proxy(path, type, url, data, success, complete, error) {
            if (!_onLoad)_proxyPage || (_proxyPage = document.createElement("iframe"), _proxyPage.setAttribute("src", path + _PROXY_URL), _proxyPage.style.display = "none", $(_proxyPage).on("load", function () {
                _onLoad = !0
            }), $("body").append(_proxyPage)), $(_proxyPage).on("load", function () {
                _proxy(path, type, url, data, success, complete, error)
            }); else {
                var XMLHTTPRequest = _proxyPage.contentWindow.getTransport();
                data = $.param(data), type == "GET" && (url += url.indexOf("?") != -1 ? "&_=" : "?_=", url += (new Date).getTime(), data && (url += "&" + data)), XMLHTTPRequest.onreadystatechange = function () {
                    if (XMLHTTPRequest.readyState == 4) {
                        complete && complete.call(XMLHTTPRequest);
                        if (XMLHTTPRequest.status == 200) {
                            var data = JSON.parse(XMLHTTPRequest.responseText);
                            data.response ? (data = data.response, data.code != undefined && data.code == 0 ? success.call(XMLHTTPRequest, data) : error && error.call(XMLHTTPRequest, data)) : error && error.call(XMLHTTPRequest, {
                                code: 99,
                                msg: "网络错误"
                            })
                        } else error && error.call(XMLHTTPRequest, {code: 99, msg: "网络错误"})
                    }
                }, XMLHTTPRequest.open(type, url, !0), type == "GET" && XMLHTTPRequest.send(), type == "POST" && (XMLHTTPRequest.setRequestHeader("Content-type", "application/x-www-form-urlencoded"), XMLHTTPRequest.send(data)), setTimeout(function () {
                    XMLHTTPRequest.abort()
                }, 6e4)
            }
        }

        function _request(type, url, data, success, complete, error) {
            _proxyPage = null, _onLoad = !1, type = type ? type.toUpperCase() : "GET", success = typeof success == "function" ? success : function () {
            };
            var _path = window.location, _url = _parseUri(url);
            if (_url.host == "" || _url.host == _path.host)return _ajax(type, url, data, success, complete, error);
            if (_url.host.indexOf("laifeng.com") == -1 || _path.host.indexOf("laifeng.com") == -1)return _ajax("GET", url, data, success, complete, error, "jsonp");
            var path = _url.protocol + "://" + _url.host;
            return _proxy(path, type, url, data, success, complete, error), null
        }

        EX.get = function (url, data, success, complete, error) {
            return _request("get", url, data, success, complete, error)
        }, EX.post = function (url, data, success, complete, error) {
            return _request("post", url, data, success, complete, error)
        }
    }(exports), exports.arrayToJq = function (arr) {
        var collection = $([]);
        return $.each(arr, function () {
            collection = collection.add(this)
        }), collection
    }, exports.strLen = function (str) {
        return str.replace(/[^\x00-\xFF]/g, "**").length
    }, exports.subDataStr = function (str) {
        return str.replace(/\%/g, "%25").replace(/\+/g, "%2B").replace(/\&/g, "%26")
    }, exports.indexOf = function (arr, value, mark) {
        for (var i = 0, len = arr.length; i < len; i++) {
            var name = arr[i];
            typeof mark != "undefined" && (name = name[mark]);
            if (name == value)return i
        }
        return -1
    }, exports.formatHTML = function (html) {
        return html.replace(/</g, "&lt;").replace(/>/g, "&gt;")
    }, exports.cutFont = function (_str, n) {
        var str = $.trim(_str), len = str.replace(/[^\x00-\xFF]|@/g, "**").length;
        return n * 2 < len ? str.substr(0, n) + "..." : str
    }, exports.cutZhFont = function (_str, n) {
        var str = $.trim(_str), len = str.replace(/[^\x00-\xFF]|[\x00-\x2F]|[\x3A-\x40]|~/g, "**").length;
        if (n < len) {
            var _temp = str.split(""), _n = n, _pos = -1;
            return $.each(_temp, function (e) {
                /^[^\x00-\xFF]|[\x00-\x2F]|[\x3A-\x40]|~$/.test(this) ? _n -= 2 : _n -= 1;
                if (_n === 0)return _pos = e + 1, !1;
                if (_n < 0)return _pos = e, !1
            }), str.substr(0, _pos) + "..."
        }
        return str
    }, exports.placeholder = function (input, classes) {
        var input = $(input), classes = typeof classes != "undefined" ? classes : "";
        if (!("placeholder" in document.createElement("input"))) {
            var tips = input.attr("placeholder");
            input.val(tips), input.addClass(classes), input.bind("focus", function () {
                $.trim(this.value) === tips && (this.value = "", input.removeClass(classes))
            }).bind("blur", function () {
                $.trim(this.value) === "" && ($(this).addClass(classes), this.value = tips)
            })
        }
    }, exports.adjustPos = function (container) {
        var _h = $(window).height();
        _h > 740 ? container.css({bottom: _h - 740}) : container.css({bottom: 0})
    }, exports.toUnits = function (num, maxLen) {
        var str = num + "", len = str.length;
        return maxLen && len <= maxLen ? str : len >= 9 ? str.substr(0, len - 8) + "亿" : len >= 5 ? str.substr(0, len - 4) + "万" : str
    }, exports.roundOff = function (num) {
        if (num < 1e4)return num;
        if (num >= 1e8) {
            var _n = (num / 1e8 + "").split("."), _end = "00";
            return _n[1] && (_end = _n[1].substr(0, 2)), _n[0] + "." + _end + "亿"
        }
        var _n = (num / 1e4 + "").split("."), _end = "00";
        return _n[1] && (_end = _n[1].substr(0, 2)), _end.length == 1 && (_end += "0"), _n[0] + "." + _end + "万"
    }, exports.checkFlash = function () {
        var hasFlash = 0, flashVersion = 0;
        if (document.all)try {
            var swf = new ActiveXObject("ShockwaveFlash.ShockwaveFlash");
            if (swf) {
                hasFlash = 1;
                var VSwf = swf.GetVariable("$version");
                flashVersion = parseInt(VSwf.split(" ")[1].split(",")[0])
            }
        } catch (e) {
        } else if (navigator.plugins && navigator.plugins.length > 0) {
            var swf = navigator.plugins["Shockwave Flash"];
            if (swf) {
                hasFlash = 1;
                var words = swf.description.split(" ");
                for (var i = 0; i < words.length; ++i) {
                    if (isNaN(parseInt(words[i])))continue;
                    flashVersion = parseInt(words[i])
                }
            }
        }
        return {f: hasFlash, v: flashVersion}
    }, exports.getUrlParams = function () {
        var arr = arguments, value = {}, url = location.search;
        if (url.indexOf("?") != -1) {
            var str = url.substr(1);
            if (str.indexOf("&") != -1) {
                var v = str.split("&");
                for (var i = 0; i < arr.length; i++)for (var j = 0; j < v.length; j++)arr[i] == v[j].split("=")[0] && (value[arr[i]] = v[j].split("=")[1])
            } else value[str.split("=")[0]] = str.split("=")[1]
        }
        return value
    }, exports.setUrlParams = function (url, args) {
        if (typeof args == "undefined")return url;
        var u = url.indexOf("?") != -1 ? url + "&" : url + "?", arr = [];
        for (var name in args)arr.push(name + "=" + args[name]);
        return u += arr.join("&"), u
    };
    var Browser = {
        nav: navigator.userAgent.toLowerCase(),
        IE: window.ActiveXObject ? !0 : !1,
        FF: navigator.userAgent.indexOf("Firefox") >= 0 ? !0 : !1,
        Chrome: navigator.userAgent.indexOf("Chrome") >= 0 ? !0 : !1,
        Ipad: navigator.userAgent.indexOf("iPhone") > -1 || navigator.userAgent.indexOf("iPad") > -1 ? !0 : !1,
        version: function (v) {
            var nav = Browser.nav;
            if (!v)return;
            switch (v) {
                case"IE":
                    return nav.match(/msie ([\d.]+)/)[1];
                case"FF":
                    return nav.match(/firefox\/([\d.]+)/)[1];
                case"Chrome":
                    return nav.match(/chrome\/([\d.]+)/)[1];
                case"Opera":
                    return nav.match(/opera\/([\d.]+)/)[1];
                case"Safari":
                    return nav.match(/version\/([\d.]+)/)[1]
            }
        }
    };
    Browser.IE6 = function () {
        return !!(Browser.IE && Browser.nav.indexOf("msie") != -1 && parseInt(Browser.version("IE")) < 7)
    }(), Browser.lte7 = function () {
        return !!(Browser.IE && Browser.nav.indexOf("msie") != -1 && parseInt(Browser.version("IE")) < 8)
    }(), Browser.lte8 = function () {
        return !!(Browser.IE && Browser.nav.indexOf("msie") != -1 && parseInt(Browser.version("IE")) < 9)
    }(), Browser.lte9 = function () {
        return !!(Browser.IE && Browser.nav.indexOf("msie") != -1 && parseInt(Browser.version("IE")) < 10)
    }(), Browser.canvas = function () {
        return !!document.createElement("canvas").getContext
    }(), exports.browser = Browser;
    var urlRegex = /^((https|http|ftp|rtsp|mms)?:\/\/)?(([0-9a-zA-Z_!~*'().&=+$%-]+: )?[0-9a-zA-Z_!~*'().&=+$%-]+@)?(([0-9]{1,3}\.){3}[0-9]{1,3}|([0-9a-zA-Z_!~*'()-]+\.)*([0-9a-zA-Z][0-9a-zA-Z-]{0,61})?[0-9a-zA-Z]\.[a-zA-Z]{2,6})(:[0-9]{1,4})?/;
    exports.REGS = {
        url: urlRegex,
        time: /^([0-1]\d|2[0-3]):[0-5]\d:[0-5]\d$/,
        numeric: /^\d*$/,
        nickname: /^([^\/&<>%='"\\])+$/,
        mobile: /^((\+86)|(86))?\d{11}$/
    }, exports.hosts = {host: "www.laifeng.com", shortHost: "laifeng.com"}, exports.getIpadHeight = function () {
        return navigator.userAgent.match(/iPad;.*CPU.*OS 7_\d/i) ? window.innerHeight : $(window).height()
    }, exports.formatDate = function (date, format) {
        var o = {
            "M+": date.getMonth() + 1,
            "d+": date.getDate(),
            "h+": date.getHours(),
            "m+": date.getMinutes(),
            "s+": date.getSeconds(),
            "q+": Math.floor((date.getMonth() + 3) / 3),
            S: date.getMilliseconds()
        };
        /(y+)/.test(format) && (format = format.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length)));
        for (var k in o)(new RegExp("(" + k + ")")).test(format) && (format = format.replace(RegExp.$1, RegExp.$1.length == 1 ? o[k] : ("00" + o[k]).substr(("" + o[k]).length)));
        return format
    };
    var otherApi = {
        sina: {key: 3785927493, secret: "7dd68c280b947bdbaa0b1b46a53ead51"},
        qq: {key: 100525909, secret: "cd1f9bb8ba1f157b2df5b51e3bdece01"},
        weixin: {key: "wx7f69133a7a08b566", secret: "f8abb4fa8c00096f6120330c1fc96d94"}
    };
    exports.otherApi = otherApi;
    var CITY = {};
    (function (EX) {
        var data = [{cities: [{id: "0", name: "市"}], province: {id: "0", name: "省"}}, {
            cities: [{
                id: "1102",
                name: "北京"
            }], province: {id: "11", name: "北京"}
        }, {cities: [{id: "3102", name: "上海"}], province: {id: "31", name: "上海"}}, {
            cities: [{id: "1202", name: "天津"}],
            province: {id: "12", name: "天津"}
        }, {cities: [{id: "5002", name: "重庆"}], province: {id: "50", name: "重庆"}}, {
            cities: [{
                id: "2301",
                name: "哈尔滨市"
            }, {id: "2302", name: "齐齐哈尔市"}, {id: "2303", name: "鸡西市"}, {id: "2304", name: "鹤岗市"}, {
                id: "2305",
                name: "双鸭山市"
            }, {id: "2306", name: "大庆市"}, {id: "2307", name: "伊春市"}, {id: "2308", name: "佳木斯市"}, {
                id: "2309",
                name: "七台河市"
            }, {id: "2310", name: "牡丹江市"}, {id: "2311", name: "黑河市"}, {id: "2312", name: "绥化市"}, {
                id: "2327",
                name: "大兴安岭地区"
            }], province: {id: "23", name: "黑龙江"}
        }, {
            cities: [{id: "2201", name: "长春市"}, {id: "2202", name: "吉林市"}, {id: "2203", name: "四平市"}, {
                id: "2204",
                name: "辽源市"
            }, {id: "2205", name: "通化市"}, {id: "2206", name: "白山市"}, {id: "2207", name: "松原市"}, {
                id: "2208",
                name: "白城市"
            }, {id: "2224", name: "延边朝鲜族自治州"}], province: {id: "22", name: "吉林"}
        }, {
            cities: [{id: "2101", name: "沈阳市"}, {id: "2102", name: "大连市"}, {id: "2103", name: "鞍山市"}, {
                id: "2104",
                name: "抚顺市"
            }, {id: "2105", name: "本溪市"}, {id: "2106", name: "丹东市"}, {id: "2107", name: "锦州市"}, {
                id: "2108",
                name: "营口市"
            }, {id: "2109", name: "阜新市"}, {id: "2110", name: "辽阳市"}, {id: "2111", name: "盘锦市"}, {
                id: "2112",
                name: "铁岭市"
            }, {id: "2113", name: "朝阳市"}, {id: "2114", name: "葫芦岛市"}], province: {id: "21", name: "辽宁"}
        }, {
            cities: [{id: "3701", name: "济南市"}, {id: "3702", name: "青岛市"}, {id: "3703", name: "淄博市"}, {
                id: "3704",
                name: "枣庄市"
            }, {id: "3705", name: "东营市"}, {id: "3706", name: "烟台市"}, {id: "3707", name: "潍坊市"}, {
                id: "3708",
                name: "济宁市"
            }, {id: "3709", name: "泰安市"}, {id: "3710", name: "威海市"}, {id: "3711", name: "日照市"}, {
                id: "3712",
                name: "莱芜市"
            }, {id: "3713", name: "临沂市"}, {id: "3714", name: "德州市"}, {id: "3715", name: "聊城市"}, {
                id: "3716",
                name: "滨州市"
            }, {id: "3717", name: "菏泽市"}], province: {id: "37", name: "山东"}
        }, {
            cities: [{id: "1401", name: "太原市"}, {id: "1402", name: "大同市"}, {id: "1403", name: "阳泉市"}, {
                id: "1404",
                name: "长治市"
            }, {id: "1405", name: "晋城市"}, {id: "1406", name: "朔州市"}, {id: "1407", name: "晋中市"}, {
                id: "1408",
                name: "运城市"
            }, {id: "1409", name: "忻州市"}, {id: "1410", name: "临汾市"}, {id: "1411", name: "吕梁市"}],
            province: {id: "14", name: "山西"}
        }, {
            cities: [{id: "6101", name: "西安市"}, {id: "6102", name: "铜川市"}, {id: "6103", name: "宝鸡市"}, {
                id: "6104",
                name: "咸阳市"
            }, {id: "6105", name: "渭南市"}, {id: "6106", name: "延安市"}, {id: "6107", name: "汉中市"}, {
                id: "6108",
                name: "榆林市"
            }, {id: "6109", name: "安康市"}, {id: "6110", name: "商洛市"}], province: {id: "61", name: "陕西"}
        }, {
            cities: [{id: "1301", name: "石家庄市"}, {id: "1302", name: "唐山市"}, {id: "1303", name: "秦皇岛市"}, {
                id: "1304",
                name: "邯郸市"
            }, {id: "1305", name: "邢台市"}, {id: "1306", name: "保定市"}, {id: "1307", name: "张家口市"}, {
                id: "1308",
                name: "承德市"
            }, {id: "1309", name: "沧州市"}, {id: "1310", name: "廊坊市"}, {id: "1311", name: "衡水市"}],
            province: {id: "13", name: "河北"}
        }, {
            cities: [{id: "4101", name: "郑州市"}, {id: "4102", name: "开封市"}, {id: "4103", name: "洛阳市"}, {
                id: "4104",
                name: "平顶山市"
            }, {id: "4105", name: "安阳市"}, {id: "4106", name: "鹤壁市"}, {id: "4107", name: "新乡市"}, {
                id: "4108",
                name: "焦作市"
            }, {id: "4109", name: "濮阳市"}, {id: "4110", name: "许昌市"}, {id: "4111", name: "漯河市"}, {
                id: "4112",
                name: "三门峡市"
            }, {id: "4113", name: "南阳市"}, {id: "4114", name: "商丘市"}, {id: "4115", name: "信阳市"}, {
                id: "4116",
                name: "周口市"
            }, {id: "4117", name: "驻马店市"}, {id: "4118", name: "济源市"}], province: {id: "41", name: "河南"}
        }, {
            cities: [{id: "4201", name: "武汉市"}, {id: "4202", name: "黄石市"}, {id: "4203", name: "十堰市"}, {
                id: "4205",
                name: "宜昌市"
            }, {id: "4206", name: "襄樊市"}, {id: "4207", name: "鄂州市"}, {id: "4208", name: "荆门市"}, {
                id: "4209",
                name: "孝感市"
            }, {id: "4210", name: "荆州市"}, {id: "4211", name: "黄冈市"}, {id: "4212", name: "咸宁市"}, {
                id: "4213",
                name: "随州市"
            }, {id: "4228", name: "恩施土家族苗族自治州"}, {id: "429004", name: "仙桃市"}, {id: "429005", name: "潜江市"}, {
                id: "429006",
                name: "天门市"
            }, {id: "429021", name: "神农架林区"}], province: {id: "42", name: "湖北"}
        }, {
            cities: [{id: "4301", name: "长沙市"}, {id: "4302", name: "株洲市"}, {id: "4303", name: "湘潭市"}, {
                id: "4304",
                name: "衡阳市"
            }, {id: "4305", name: "邵阳市"}, {id: "4306", name: "岳阳市"}, {id: "4307", name: "常德市"}, {
                id: "4308",
                name: "张家界市"
            }, {id: "4309", name: "益阳市"}, {id: "4310", name: "郴州市"}, {id: "4311", name: "永州市"}, {
                id: "4312",
                name: "怀化市"
            }, {id: "4313", name: "娄底市"}, {id: "4331", name: "湘西土家族苗族自治州"}], province: {id: "43", name: "湖南"}
        }, {
            cities: [{id: "4601", name: "海口市"}, {id: "4602", name: "三亚市"}, {id: "469001", name: "五指山市"}, {
                id: "469002",
                name: "琼海市"
            }, {id: "469003", name: "儋州市"}, {id: "469005", name: "文昌市"}, {id: "469006", name: "万宁市"}, {
                id: "469007",
                name: "东方市"
            }, {id: "469025", name: "定安县"}, {id: "469026", name: "屯昌县"}, {id: "469027", name: "澄迈县"}, {
                id: "469028",
                name: "临高县"
            }, {id: "469030", name: "白沙黎族自治县"}, {id: "469031", name: "昌江黎族自治县"}, {
                id: "469033",
                name: "乐东黎族自治县"
            }, {id: "469034", name: "陵水黎族自治县"}, {id: "469035", name: "保亭黎族苗族自治县"}, {id: "469036", name: "琼中黎族苗族自治县"}],
            province: {id: "46", name: "海南"}
        }, {
            cities: [{id: "3201", name: "南京市"}, {id: "3202", name: "无锡市"}, {id: "3203", name: "徐州市"}, {
                id: "3204",
                name: "常州市"
            }, {id: "3205", name: "苏州市"}, {id: "3206", name: "南通市"}, {id: "3207", name: "连云港市"}, {
                id: "3208",
                name: "淮安市"
            }, {id: "3209", name: "盐城市"}, {id: "3210", name: "扬州市"}, {id: "3211", name: "镇江市"}, {
                id: "3212",
                name: "泰州市"
            }, {id: "3213", name: "宿迁市"}], province: {id: "32", name: "江苏"}
        }, {
            cities: [{id: "3601", name: "南昌市"}, {id: "3602", name: "景德镇市"}, {id: "3603", name: "萍乡市"}, {
                id: "3604",
                name: "九江市"
            }, {id: "3605", name: "新余市"}, {id: "3606", name: "鹰潭市"}, {id: "3607", name: "赣州市"}, {
                id: "3608",
                name: "吉安市"
            }, {id: "3609", name: "宜春市"}, {id: "3610", name: "抚州市"}, {id: "3611", name: "上饶市"}],
            province: {id: "36", name: "江西"}
        }, {
            cities: [{id: "4401", name: "广州市"}, {id: "4402", name: "韶关市"}, {id: "4403", name: "深圳市"}, {
                id: "4404",
                name: "珠海市"
            }, {id: "4405", name: "汕头市"}, {id: "4406", name: "佛山市"}, {id: "4407", name: "江门市"}, {
                id: "4408",
                name: "湛江市"
            }, {id: "4409", name: "茂名市"}, {id: "4412", name: "肇庆市"}, {id: "4413", name: "惠州市"}, {
                id: "4414",
                name: "梅州市"
            }, {id: "4415", name: "汕尾市"}, {id: "4416", name: "河源市"}, {id: "4417", name: "阳江市"}, {
                id: "4418",
                name: "清远市"
            }, {id: "4419", name: "东莞市"}, {id: "4420", name: "中山市"}, {id: "4451", name: "潮州市"}, {
                id: "4452",
                name: "揭阳市"
            }, {id: "4453", name: "云浮市"}], province: {id: "44", name: "广东"}
        }, {
            cities: [{id: "4501", name: "南宁市"}, {id: "4502", name: "柳州市"}, {id: "4503", name: "桂林市"}, {
                id: "4504",
                name: "梧州市"
            }, {id: "4505", name: "北海市"}, {id: "4506", name: "防城港市"}, {id: "4507", name: "钦州市"}, {
                id: "4508",
                name: "贵港市"
            }, {id: "4509", name: "玉林市"}, {id: "4510", name: "百色市"}, {id: "4511", name: "贺州市"}, {
                id: "4512",
                name: "河池市"
            }, {id: "4513", name: "来宾市"}, {id: "4514", name: "崇左市"}], province: {id: "45", name: "广西"}
        }, {
            cities: [{id: "5301", name: "昆明市"}, {id: "5303", name: "曲靖市"}, {id: "5304", name: "玉溪市"}, {
                id: "5305",
                name: "保山市"
            }, {id: "5306", name: "昭通市"}, {id: "5307", name: "丽江市"}, {id: "5308", name: "普洱市"}, {
                id: "5309",
                name: "临沧市"
            }, {id: "5323", name: "楚雄彝族自治州"}, {id: "5325", name: "红河哈尼族彝族自治州"}, {
                id: "5326",
                name: "文山壮族苗族自治州"
            }, {id: "5328", name: "西双版纳傣族自治州"}, {id: "5329", name: "大理白族自治州"}, {
                id: "5331",
                name: "德宏傣族景颇族自治州"
            }, {id: "5333", name: "怒江傈僳族自治州"}, {id: "5334", name: "迪庆藏族自治州"}], province: {id: "53", name: "云南"}
        }, {
            cities: [{id: "5201", name: "贵阳市"}, {id: "5202", name: "六盘水市"}, {id: "5203", name: "遵义市"}, {
                id: "5204",
                name: "安顺市"
            }, {id: "5222", name: "铜仁地区"}, {id: "5223", name: "黔西南布依族苗族自治州"}, {id: "5224", name: "毕节地区"}, {
                id: "5226",
                name: "黔东南苗族侗族自治州"
            }, {id: "5227", name: "黔南布依族苗族自治州"}], province: {id: "52", name: "贵州"}
        }, {
            cities: [{id: "5101", name: "成都市"}, {id: "5103", name: "自贡市"}, {id: "5104", name: "攀枝花市"}, {
                id: "5105",
                name: "泸州市"
            }, {id: "5106", name: "德阳市"}, {id: "5107", name: "绵阳市"}, {id: "5108", name: "广元市"}, {
                id: "5109",
                name: "遂宁市"
            }, {id: "5110", name: "内江市"}, {id: "5111", name: "乐山市"}, {id: "5113", name: "南充市"}, {
                id: "5114",
                name: "眉山市"
            }, {id: "5115", name: "宜宾市"}, {id: "5116", name: "广安市"}, {id: "5117", name: "达州市"}, {
                id: "5118",
                name: "雅安市"
            }, {id: "5119", name: "巴中市"}, {id: "5120", name: "资阳市"}, {id: "5132", name: "阿坝藏族羌族自治州"}, {
                id: "5133",
                name: "甘孜藏族自治州"
            }, {id: "5134", name: "凉山彝族自治州"}], province: {id: "51", name: "四川"}
        }, {
            cities: [{id: "1501", name: "呼和浩特市"}, {id: "1502", name: "包头市"}, {id: "1503", name: "乌海市"}, {
                id: "1504",
                name: "赤峰市"
            }, {id: "1505", name: "通辽市"}, {id: "1506", name: "鄂尔多斯市"}, {id: "1507", name: "呼伦贝尔市"}, {
                id: "1508",
                name: "巴彦淖尔市"
            }, {id: "1509", name: "乌兰察布市"}, {id: "1522", name: "兴安盟"}, {id: "1525", name: "锡林郭勒盟"}, {
                id: "1529",
                name: "阿拉善盟"
            }], province: {id: "15", name: "内蒙古"}
        }, {
            cities: [{id: "6401", name: "银川市"}, {id: "6402", name: "石嘴山市"}, {id: "6403", name: "吴忠市"}, {
                id: "6404",
                name: "固原市"
            }, {id: "6405", name: "中卫市"}], province: {id: "64", name: "宁夏"}
        }, {
            cities: [{id: "6201", name: "兰州市"}, {id: "6202", name: "嘉峪关市"}, {id: "6203", name: "金昌市"}, {
                id: "6204",
                name: "白银市"
            }, {id: "6205", name: "天水市"}, {id: "6206", name: "武威市"}, {id: "6207", name: "张掖市"}, {
                id: "6208",
                name: "平凉市"
            }, {id: "6209", name: "酒泉市"}, {id: "6210", name: "庆阳市"}, {id: "6211", name: "定西市"}, {
                id: "6212",
                name: "陇南市"
            }, {id: "6229", name: "临夏回族自治州"}, {id: "6230", name: "甘南藏族自治州"}], province: {id: "62", name: "甘肃"}
        }, {
            cities: [{id: "6301", name: "西宁市"}, {id: "6321", name: "海东地区"}, {id: "6322", name: "海北藏族自治州"}, {
                id: "6323",
                name: "黄南藏族自治州"
            }, {id: "6325", name: "海南藏族自治州"}, {id: "6326", name: "果洛藏族自治州"}, {id: "6327", name: "玉树藏族自治州"}, {
                id: "6328",
                name: "海西蒙古族藏族自治州"
            }], province: {id: "63", name: "青海"}
        }, {
            cities: [{id: "5401", name: "拉萨市"}, {id: "5421", name: "昌都地区"}, {id: "5422", name: "山南地区"}, {
                id: "5423",
                name: "日喀则地区"
            }, {id: "5424", name: "那曲地区"}, {id: "5425", name: "阿里地区"}, {id: "5426", name: "林芝地区"}],
            province: {id: "54", name: "西藏"}
        }, {
            cities: [{id: "6501", name: "乌鲁木齐市"}, {id: "6502", name: "克拉玛依市"}, {id: "6521", name: "吐鲁番地区"}, {
                id: "6522",
                name: "哈密地区"
            }, {id: "6523", name: "昌吉回族自治州"}, {id: "6527", name: "博尔塔拉蒙古自治州"}, {id: "6528", name: "巴音郭楞蒙古自治州"}, {
                id: "6529",
                name: "阿克苏地区"
            }, {id: "6530", name: "克孜勒苏柯尔克孜自治州"}, {id: "6531", name: "喀什地区"}, {id: "6532", name: "和田地区"}, {
                id: "6540",
                name: "伊犁哈萨克自治州"
            }, {id: "6542", name: "塔城地区"}, {id: "6543", name: "阿勒泰地区"}, {id: "659001", name: "石河子市"}, {
                id: "659002",
                name: "阿拉尔市"
            }, {id: "659003", name: "图木舒克市"}, {id: "659004", name: "五家渠市"}], province: {id: "65", name: "新疆"}
        }, {
            cities: [{id: "3401", name: "合肥市"}, {id: "3402", name: "芜湖市"}, {id: "3403", name: "蚌埠市"}, {
                id: "3404",
                name: "淮南市"
            }, {id: "3405", name: "马鞍山市"}, {id: "3406", name: "淮北市"}, {id: "3407", name: "铜陵市"}, {
                id: "3408",
                name: "安庆市"
            }, {id: "3410", name: "黄山市"}, {id: "3411", name: "滁州市"}, {id: "3412", name: "阜阳市"}, {
                id: "3413",
                name: "宿州市"
            }, {id: "3414", name: "巢湖市"}, {id: "3415", name: "六安市"}, {id: "3416", name: "亳州市"}, {
                id: "3417",
                name: "池州市"
            }, {id: "3418", name: "宣城市"}], province: {id: "34", name: "安徽"}
        }, {
            cities: [{id: "3301", name: "杭州市"}, {id: "3302", name: "宁波市"}, {id: "3303", name: "温州市"}, {
                id: "3304",
                name: "嘉兴市"
            }, {id: "3305", name: "湖州市"}, {id: "3306", name: "绍兴市"}, {id: "3307", name: "金华市"}, {
                id: "3308",
                name: "衢州市"
            }, {id: "3309", name: "舟山市"}, {id: "3310", name: "台州市"}, {id: "3311", name: "丽水市"}],
            province: {id: "33", name: "浙江"}
        }, {
            cities: [{id: "3501", name: "福州市"}, {id: "3502", name: "厦门市"}, {id: "3503", name: "莆田市"}, {
                id: "3504",
                name: "三明市"
            }, {id: "3505", name: "泉州市"}, {id: "3506", name: "漳州市"}, {id: "3507", name: "南平市"}, {
                id: "3508",
                name: "龙岩市"
            }, {id: "3509", name: "宁德市"}], province: {id: "35", name: "福建"}
        }, {
            cities: [{id: "7101", name: "台北市"}, {id: "7102", name: "高雄市"}, {id: "7103", name: "基隆市"}, {
                id: "7104",
                name: "台中市"
            }, {id: "7105", name: "台南市"}, {id: "7106", name: "新竹市"}, {id: "7107", name: "嘉义市"}],
            province: {id: "71", name: "台湾"}
        }, {cities: [{id: "8101", name: "香港"}], province: {id: "81", name: "香港"}}, {
            cities: [{id: "8201", name: "澳门"}],
            province: {id: "82", name: "澳门"}
        }];
        $.extend(EX, {
            getData: function () {
                return data
            }, getProvinceList: function () {
                var res = [];
                return $.each(data, function () {
                    res.push(this.province)
                }), res
            }, getCityListByProvinceId: function (id) {
                var res = [];
                return $.each(data, function () {
                    if (this.province.id == id)return res = this.cities, !1
                }), res
            }, getProvinceByCityId: function (id) {
                var res = null;
                return $.each(data, function () {
                    var _this = this;
                    $.each(this.cities, function () {
                        if (this.id == id)return res = _this.province, !1
                    });
                    if (res)return !1
                }), res
            }, getProvinceIdByName: function (name) {
                var res = -1;
                return $.each(data, function () {
                    if (this.province.name == name)return res = this.province.id, !1
                }), res
            }, getCityIdByName: function (name) {
                var res = -1;
                return $.each(data, function () {
                    $.each(this.cities, function () {
                        if (this.name == name)return res = this.id, !1
                    });
                    if (res != -1)return !1
                }), res
            }
        })
    })(CITY), exports.city = CITY;
    function getMedalHTML(oms, isBg) {
        var html = "", dir = window.DDS.medal;
        return dir && $.each(oms, function () {
            var data = dir[this];
            if (data) {
                var _title = data.description != "" ? 'title="' + data.description + '"' : "";
                if (!isBg || data.medalType != 7 && data.medalType != 8 && data.medalType != 9)html += '<i class="ICON-medal" ' + _title + ">", html += '<img class="medal-img" src="' + data.medalUrl + '" />', html += "</i>"; else {
                    var name = "";
                    window.DDS.stageMap && window.DDS.stageMap[data.medalType] && (name = exports.cutZhFont(window.DDS.stageMap[data.medalType], 4)), html += '<i class="ICON-active-level-bg" ' + _title + '><img src="' + data.medalUrl + '"/>' + name + "</i>"
                }
            }
        }), html
    }

    exports.getMedalHTML = getMedalHTML, exports.getUserNameHtml = function (name, id, l, al, args, other, oms) {
        var _html = "";
        args.gf != 1 && (al > 0 && (_html += '<span class="ICON-anchor-level ICON-al-' + al + '"></span>'), l > 0 ? _html += '<span class="ICON-noble-level ICON-nl-' + l + '"></span>' : window.DDS && window.DDS.userInfo && window.DDS.userInfo.userId == id && (_html += exports.noNoble()));
        if (window.DDS.config.roomType != "livehouse" && args.oms) {
            oms = oms || args.oms;
            var _bg = args.activeBg ? !0 : !1;
            _html += getMedalHTML(oms, _bg)
        }
        return typeof other == "string" && (_html += other), window.DDS.config.roomType != "livehouse" && args.mm && (args.mm == "1001" || args.mm == "1002") && (_html += '<i class="ICON-medal medal-icon-phone" title="来疯手机客户端"><a href="http://www.laifeng.com/app/download" target="_blank"><img class="medal-img" src="http://static.youku.com/ddshow/img/channelv2/phone_icon.png" /></a></i>'), _html += '<span class="user-name" data-name="' + name + '" data-id="' + id + '">' + exports.formatHTML(name) + "</span>", _html
    }, exports.filterUnicode = function (str) {
        var reg = new RegExp(decodeURIComponent("%E2%80%AE"), "g");
        return str.replace(reg, "")
    }, exports.noNoble = function () {
        var coins = "", isShow = !1;
        if (window.DDS && window.DDS.userInfo) {
            var _u = window.DDS.userInfo;
            _u.isRecharge && _u.differCoin && (coins = _u.differCoin, isShow = _u.isRecharge == "1" ? !0 : !1)
        }
        return isShow ? '<span class="ICON-noble-level" title="还差' + coins + '星币升级到富一品"></span>' : ""
    }, exports.getFansSum = function (num) {
        return num < 100 ? {sum: 100, mark: 1} : num >= 100 && num < 1e3 ? {
            sum: 1e3,
            mark: 2
        } : num >= 1e3 && num < 1e4 ? {sum: 1e4, mark: 3} : num >= 1e4 && num < 1e5 ? {
            sum: 1e5,
            mark: 4
        } : num >= 1e5 && num < 2e5 ? {sum: 2e5, mark: 5} : num >= 2e5 && num < 3e5 ? {
            sum: 3e5,
            mark: 6
        } : num >= 3e5 && num < 5e5 ? {sum: 5e5, mark: 7} : num >= 5e5 && num < 7e5 ? {
            sum: 7e5,
            mark: 8
        } : num >= 7e5 && num < 1e6 ? {sum: 1e6, mark: 9} : num >= 1e6 && num < 1e7 ? {sum: 1e7, mark: 10} : {
            sum: 1e7,
            mark: 11
        }
    };
    var MD = {};
    (function (EX) {
        var rotateLeft = function (lValue, iShiftBits) {
            return lValue << iShiftBits | lValue >>> 32 - iShiftBits
        }, addUnsigned = function (lX, lY) {
            var lX4, lY4, lX8, lY8, lResult;
            return lX8 = lX & 2147483648, lY8 = lY & 2147483648, lX4 = lX & 1073741824, lY4 = lY & 1073741824, lResult = (lX & 1073741823) + (lY & 1073741823), lX4 & lY4 ? lResult ^ 2147483648 ^ lX8 ^ lY8 : lX4 | lY4 ? lResult & 1073741824 ? lResult ^ 3221225472 ^ lX8 ^ lY8 : lResult ^ 1073741824 ^ lX8 ^ lY8 : lResult ^ lX8 ^ lY8
        }, F = function (x, y, z) {
            return x & y | ~x & z
        }, G = function (x, y, z) {
            return x & z | y & ~z
        }, H = function (x, y, z) {
            return x ^ y ^ z
        }, I = function (x, y, z) {
            return y ^ (x | ~z)
        }, FF = function (a, b, c, d, x, s, ac) {
            return a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac)), addUnsigned(rotateLeft(a, s), b)
        }, GG = function (a, b, c, d, x, s, ac) {
            return a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac)), addUnsigned(rotateLeft(a, s), b)
        }, HH = function (a, b, c, d, x, s, ac) {
            return a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac)), addUnsigned(rotateLeft(a, s), b)
        }, II = function (a, b, c, d, x, s, ac) {
            return a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac)), addUnsigned(rotateLeft(a, s), b)
        }, convertToWordArray = function (string) {
            var lWordCount, lMessageLength = string.length, lNumberOfWordsTempOne = lMessageLength + 8, lNumberOfWordsTempTwo = (lNumberOfWordsTempOne - lNumberOfWordsTempOne % 64) / 64, lNumberOfWords = (lNumberOfWordsTempTwo + 1) * 16, lWordArray = Array(lNumberOfWords - 1), lBytePosition = 0, lByteCount = 0;
            while (lByteCount < lMessageLength)lWordCount = (lByteCount - lByteCount % 4) / 4, lBytePosition = lByteCount % 4 * 8, lWordArray[lWordCount] = lWordArray[lWordCount] | string.charCodeAt(lByteCount) << lBytePosition, lByteCount++;
            return lWordCount = (lByteCount - lByteCount % 4) / 4, lBytePosition = lByteCount % 4 * 8, lWordArray[lWordCount] = lWordArray[lWordCount] | 128 << lBytePosition, lWordArray[lNumberOfWords - 2] = lMessageLength << 3, lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29, lWordArray
        }, wordToHex = function (lValue) {
            var WordToHexValue = "", WordToHexValueTemp = "", lByte, lCount;
            for (lCount = 0; lCount <= 3; lCount++)lByte = lValue >>> lCount * 8 & 255, WordToHexValueTemp = "0" + lByte.toString(16), WordToHexValue += WordToHexValueTemp.substr(WordToHexValueTemp.length - 2, 2);
            return WordToHexValue
        }, uTF8Encode = function (string) {
            string = string.replace(/\x0d\x0a/g, "\n");
            var output = "";
            for (var n = 0; n < string.length; n++) {
                var c = string.charCodeAt(n);
                c < 128 ? output += String.fromCharCode(c) : c > 127 && c < 2048 ? (output += String.fromCharCode(c >> 6 | 192), output += String.fromCharCode(c & 63 | 128)) : (output += String.fromCharCode(c >> 12 | 224), output += String.fromCharCode(c >> 6 & 63 | 128), output += String.fromCharCode(c & 63 | 128))
            }
            return output
        };
        EX.md5 = function (string) {
            var x = Array(), k, AA, BB, CC, DD, a, b, c, d, S11 = 7, S12 = 12, S13 = 17, S14 = 22, S21 = 5, S22 = 9, S23 = 14, S24 = 20, S31 = 4, S32 = 11, S33 = 16, S34 = 23, S41 = 6, S42 = 10, S43 = 15, S44 = 21;
            string = uTF8Encode(string), x = convertToWordArray(string), a = 1732584193, b = 4023233417, c = 2562383102, d = 271733878;
            for (k = 0; k < x.length; k += 16)AA = a, BB = b, CC = c, DD = d, a = FF(a, b, c, d, x[k + 0], S11, 3614090360), d = FF(d, a, b, c, x[k + 1], S12, 3905402710), c = FF(c, d, a, b, x[k + 2], S13, 606105819), b = FF(b, c, d, a, x[k + 3], S14, 3250441966), a = FF(a, b, c, d, x[k + 4], S11, 4118548399), d = FF(d, a, b, c, x[k + 5], S12, 1200080426), c = FF(c, d, a, b, x[k + 6], S13, 2821735955), b = FF(b, c, d, a, x[k + 7], S14, 4249261313), a = FF(a, b, c, d, x[k + 8], S11, 1770035416), d = FF(d, a, b, c, x[k + 9], S12, 2336552879), c = FF(c, d, a, b, x[k + 10], S13, 4294925233), b = FF(b, c, d, a, x[k + 11], S14, 2304563134), a = FF(a, b, c, d, x[k + 12], S11, 1804603682), d = FF(d, a, b, c, x[k + 13], S12, 4254626195), c = FF(c, d, a, b, x[k + 14], S13, 2792965006), b = FF(b, c, d, a, x[k + 15], S14, 1236535329), a = GG(a, b, c, d, x[k + 1], S21, 4129170786), d = GG(d, a, b, c, x[k + 6], S22, 3225465664), c = GG(c, d, a, b, x[k + 11], S23, 643717713), b = GG(b, c, d, a, x[k + 0], S24, 3921069994), a = GG(a, b, c, d, x[k + 5], S21, 3593408605), d = GG(d, a, b, c, x[k + 10], S22, 38016083), c = GG(c, d, a, b, x[k + 15], S23, 3634488961), b = GG(b, c, d, a, x[k + 4], S24, 3889429448), a = GG(a, b, c, d, x[k + 9], S21, 568446438), d = GG(d, a, b, c, x[k + 14], S22, 3275163606), c = GG(c, d, a, b, x[k + 3], S23, 4107603335), b = GG(b, c, d, a, x[k + 8], S24, 1163531501), a = GG(a, b, c, d, x[k + 13], S21, 2850285829), d = GG(d, a, b, c, x[k + 2], S22, 4243563512), c = GG(c, d, a, b, x[k + 7], S23, 1735328473), b = GG(b, c, d, a, x[k + 12], S24, 2368359562), a = HH(a, b, c, d, x[k + 5], S31, 4294588738), d = HH(d, a, b, c, x[k + 8], S32, 2272392833), c = HH(c, d, a, b, x[k + 11], S33, 1839030562), b = HH(b, c, d, a, x[k + 14], S34, 4259657740), a = HH(a, b, c, d, x[k + 1], S31, 2763975236), d = HH(d, a, b, c, x[k + 4], S32, 1272893353), c = HH(c, d, a, b, x[k + 7], S33, 4139469664), b = HH(b, c, d, a, x[k + 10], S34, 3200236656), a = HH(a, b, c, d, x[k + 13], S31, 681279174), d = HH(d, a, b, c, x[k + 0], S32, 3936430074), c = HH(c, d, a, b, x[k + 3], S33, 3572445317), b = HH(b, c, d, a, x[k + 6], S34, 76029189), a = HH(a, b, c, d, x[k + 9], S31, 3654602809), d = HH(d, a, b, c, x[k + 12], S32, 3873151461), c = HH(c, d, a, b, x[k + 15], S33, 530742520), b = HH(b, c, d, a, x[k + 2], S34, 3299628645), a = II(a, b, c, d, x[k + 0], S41, 4096336452), d = II(d, a, b, c, x[k + 7], S42, 1126891415), c = II(c, d, a, b, x[k + 14], S43, 2878612391), b = II(b, c, d, a, x[k + 5], S44, 4237533241), a = II(a, b, c, d, x[k + 12], S41, 1700485571), d = II(d, a, b, c, x[k + 3], S42, 2399980690), c = II(c, d, a, b, x[k + 10], S43, 4293915773), b = II(b, c, d, a, x[k + 1], S44, 2240044497), a = II(a, b, c, d, x[k + 8], S41, 1873313359), d = II(d, a, b, c, x[k + 15], S42, 4264355552), c = II(c, d, a, b, x[k + 6], S43, 2734768916), b = II(b, c, d, a, x[k + 13], S44, 1309151649), a = II(a, b, c, d, x[k + 4], S41, 4149444226), d = II(d, a, b, c, x[k + 11], S42, 3174756917), c = II(c, d, a, b, x[k + 2], S43, 718787259), b = II(b, c, d, a, x[k + 9], S44, 3951481745), a = addUnsigned(a, AA), b = addUnsigned(b, BB), c = addUnsigned(c, CC), d = addUnsigned(d, DD);
            var tempValue = wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
            return tempValue.toLowerCase()
        }
    })(MD), exports.MD = MD;
    var PubSub = function (namespace) {
        var n = namespace || "__subscribers", o = {
            addSubscriber: function (obj, type, callback) {
                if (callback) {
                    obj[n] || (obj[n] = {}), obj[n][type] || (obj[n][type] = []);
                    var subscribers = obj[n][type], len = subscribers.length, i = 0, flag = !1;
                    for (; i < len; i++)if (subscribers[i] == callback) {
                        flag = !0;
                        break
                    }
                    flag || obj[n][type].unshift(callback)
                }
            }, addOnceSubscriber: function (obj, type, callback) {
                if (callback) {
                    var _this = this;
                    _this.addSubscriber(obj, type, function () {
                        var me = arguments.callee;
                        callback.apply(obj, arguments), _this.removeSubscriber(obj, type, me)
                    })
                }
            }, removeSubscriber: function (obj, type, arg) {
                var len = arguments.length;
                switch (len) {
                    case 3:
                        if (obj[n] && obj[n][type]) {
                            var sub = obj[n][type], l = sub.length, i = 0;
                            for (; i < l; i++)if (sub[i] == arg) {
                                obj[n][type].splice(i, 1);
                                break
                            }
                        }
                        break;
                    case 2:
                        obj[n] && obj[n][type] && (obj[n][type].length = 0);
                        break;
                    case 1:
                        obj[n] && (delete obj[n], obj[n] = null)
                }
            }, publish: function (obj, type) {
                if (obj[n] && obj[n][type]) {
                    var subscribers = obj[n][type], len = subscribers.length, i = len - 1;
                    for (; i >= 0; i--)subscribers[i].apply(obj, Array.prototype.slice.call(arguments, 2))
                }
            }
        };
        return o
    }("__subscribers");
    for (var i in PubSub)exports[i] = PubSub[i];
    exports.queryToJson = function (query) {
        var r = {}, t = query.split("&");
        for (var i = 0; i < t.length; i++)if (t[i]) {
            var _t = t[i].split("=");
            _t.length >= 1 && (r[_t[0]] = _t[1] || null)
        }
        return r
    }, exports.removeArrayValue = function (arr, value) {
        for (var i = 0; i < arr.length; i++)arr[i] == value && arr.splice(i, 1)
    }, exports.inArray = function (arr, value) {
        for (var i = 0; i < arr.length; i++)if (arr[i] == value)return i;
        return -1
    }, exports.socketRequest = function (options) {
        var _setting = $.extend({}, {
            socket: null,
            idMark: "_sid",
            methodName: "",
            upData: {},
            upCache: {},
            downCallBack: function () {
            },
            overTime: 2e4,
            overTimeCallBack: function () {
            }
        }, options);
        typeof window._socketRequestCache == "undefined" && (window._socketRequestCache = {});
        var dataQueue = window._socketRequestCache;
        if (!_setting.socket)return;
        var _id = _setting.methodName + (new Date).getTime(), _timeOverTime = null;
        dataQueue[_id] = _setting.upCache, _setting.upData[_setting.idMark] = _id, _setting.socket.emit(_setting.methodName, _setting.upData), _timeOverTime = setTimeout(function () {
            _setting.overTimeCallBack()
        }, _setting.overTime), _setting.socket.once(_setting.methodName + "_response", function (args) {
            var _args = args.body, _cache = {};
            if (_args[_setting.idMark]) {
                var _i = _args[_setting.idMark];
                dataQueue[_i] && (clearTimeout(_timeOverTime), delete _timeOverTime, _cache = dataQueue[_i], delete dataQueue[_i])
            }
            _setting.downCallBack(_args, _cache)
        })
    }
}), define("STATUS", ["JQ"], function (require, exports, module) {
    var $ = require("JQ"), dds = window.DDS || {}, Status = {};
    Status.host = "http://" + window.location.host.split(":")[0], Status.isDisconnect = function () {
        return dds.disconnect && alert("与服务器断开连接，请刷新页面重新连接"), !!dds.disconnect
    }, Status.outTips = function (words, timer) {
        alert(words)
    }, Status.errorBubble = function (msg, objs, options) {
        alert(msg)
    };
    var AJAX_CODE_CALLBACK = {
        99: function () {
            alert("网络错误")
        }, "-2": function (codeData) {
        }, "-3": function (codeData, ele) {
        }, "-5": function (codeData) {
        }, "-10": function (codeData, ele) {
        }, "-17": function (codeData, ele) {
        }, "-20": function () {
        }, "-23": function () {
        }
    };
    Status.ajaxError = function (codeData, data, callback) {
        var code = codeData.code;
        AJAX_CODE_CALLBACK[code] ? AJAX_CODE_CALLBACK[code](codeData, data) : typeof callback == "function" && callback()
    }, module.exports = Status
})
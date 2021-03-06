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
        JQ: "lib/jquery.js",
        XM: "lib/xm.js",
        NOTIFY: "lib/notify.js",
        CRYPT: "lib/rsa.js",
        IMCONNECT: "modules/js/imConnect.js",
        IMNOTICE: "modules/js/imNotice.js",
        DRAWPROGRESS: "modules/js/drawProgress.js",
        DIALOG: "ui/dialog/dialog.js",
        DRAG: "ui/drag/drag.js",
        SCROLL: "ui/scroll/scroll.js",
        CARD: "modules/js/card.js",
        WIDGETS: "modules/js/widgets.js",
        STATUS: "modules/js/status.js",
        SLIDESHOW: "ui/slideshow/slideshow.js",
        TAB: "modules/js/tab.js",
        LOGIN: "modules/js/dialogLogin.js",
        PH: "modules/js/placeholder.js",
        MCOMPLETE: "modules/js/mailcomplete.js",
        PCHECK: "modules/js/passwordCheck.js",
        SAFECODE: "modules/js/safeCode.js",
        EMOTICON: "ui/emoticon/emoticon.js",
        SHARE: "modules/js/share.js",
        CALENDAR: "ui/calendar/calendar.js",
        TIME: "ui/timePicker/timePicker.js",
        USER_CENTER_NAV: "user/js/nav.js",
        PAGER: "ui/pager/pager.js",
        RENDER: "/modules/js/render.js",
        POPTIP: "ui/popTip/popTip.js",
        FRIEND: "user/js/controls/friend_login.js",
        UPLOAD: "modules/js/uploader.js",
        JSON: "lib/json.js",
        VA: "modules/js/validation.js",
        TCARD: "modules/js/topCard.js"
    }
});
try {
    document.domain = "laifeng.com"
} catch (e) {
}
define("SWF", [], function (require, exports, module) {
    var swfobject = function () {
        var UNDEF = "undefined", OBJECT = "object", SHOCKWAVE_FLASH = "Shockwave Flash", SHOCKWAVE_FLASH_AX = "ShockwaveFlash.ShockwaveFlash", FLASH_MIME_TYPE = "application/x-shockwave-flash", EXPRESS_INSTALL_ID = "SWFObjectExprInst", ON_READY_STATE_CHANGE = "onreadystatechange", win = window, doc = document, nav = navigator, plugin = !1, domLoadFnArr = [main], regObjArr = [], objIdArr = [], listenersArr = [], storedAltContent, storedAltContentId, storedCallbackFn, storedCallbackObj, isDomLoaded = !1, isExpressInstallActive = !1, dynamicStylesheet, dynamicStylesheetMedia, autoHideShow = !0, ua = function () {
            var w3cdom = typeof doc.getElementById != UNDEF && typeof doc.getElementsByTagName != UNDEF && typeof doc.createElement != UNDEF, u = nav.userAgent.toLowerCase(), p = nav.platform.toLowerCase(), windows = p ? /win/.test(p) : /win/.test(u), mac = p ? /mac/.test(p) : /mac/.test(u), webkit = /webkit/.test(u) ? parseFloat(u.replace(/^.*webkit\/(\d+(\.\d+)?).*$/, "$1")) : !1, ie = !1, playerVersion = [0, 0, 0], d = null;
            if (typeof nav.plugins != UNDEF && typeof nav.plugins[SHOCKWAVE_FLASH] == OBJECT)d = nav.plugins[SHOCKWAVE_FLASH].description, d && (typeof nav.mimeTypes == UNDEF || !nav.mimeTypes[FLASH_MIME_TYPE] || !!nav.mimeTypes[FLASH_MIME_TYPE].enabledPlugin) && (plugin = !0, ie = !1, d = d.replace(/^.*\s+(\S+\s+\S+$)/, "$1"), playerVersion[0] = parseInt(d.replace(/^(.*)\..*$/, "$1"), 10), playerVersion[1] = parseInt(d.replace(/^.*\.(.*)\s.*$/, "$1"), 10), playerVersion[2] = /[a-zA-Z]/.test(d) ? parseInt(d.replace(/^.*[a-zA-Z]+(.*)$/, "$1"), 10) : 0); else if (typeof win.ActiveXObject != UNDEF)try {
                var a = new ActiveXObject(SHOCKWAVE_FLASH_AX);
                a && (d = a.GetVariable("$version"), d && (ie = !0, d = d.split(" ")[1].split(","), playerVersion = [parseInt(d[0], 10), parseInt(d[1], 10), parseInt(d[2], 10)]))
            } catch (e) {
            }
            return {w3: w3cdom, pv: playerVersion, wk: webkit, ie: ie, win: windows, mac: mac}
        }(), onDomLoad = function () {
            if (!ua.w3)return;
            (typeof doc.readyState != UNDEF && doc.readyState == "complete" || typeof doc.readyState == UNDEF && (doc.getElementsByTagName("body")[0] || doc.body)) && callDomLoadFunctions(), isDomLoaded || (typeof doc.addEventListener != UNDEF && doc.addEventListener("DOMContentLoaded", callDomLoadFunctions, !1), ua.ie && ua.win && (doc.attachEvent(ON_READY_STATE_CHANGE, function () {
                doc.readyState == "complete" && (doc.detachEvent(ON_READY_STATE_CHANGE, arguments.callee), callDomLoadFunctions())
            }), win == top && function () {
                if (isDomLoaded)return;
                try {
                    doc.documentElement.doScroll("left")
                } catch (e) {
                    setTimeout(arguments.callee, 0);
                    return
                }
                callDomLoadFunctions()
            }()), ua.wk && function () {
                if (isDomLoaded)return;
                if (!/loaded|complete/.test(doc.readyState)) {
                    setTimeout(arguments.callee, 0);
                    return
                }
                callDomLoadFunctions()
            }(), addLoadEvent(callDomLoadFunctions))
        }();

        function callDomLoadFunctions() {
            if (isDomLoaded)return;
            try {
                var t = doc.getElementsByTagName("body")[0].appendChild(createElement("span"));
                t.parentNode.removeChild(t)
            } catch (e) {
                return
            }
            isDomLoaded = !0;
            var dl = domLoadFnArr.length;
            for (var i = 0; i < dl; i++)domLoadFnArr[i]()
        }

        function addDomLoadEvent(fn) {
            isDomLoaded ? fn() : domLoadFnArr[domLoadFnArr.length] = fn
        }

        function addLoadEvent(fn) {
            if (typeof win.addEventListener != UNDEF)win.addEventListener("load", fn, !1); else if (typeof doc.addEventListener != UNDEF)doc.addEventListener("load", fn, !1); else if (typeof win.attachEvent != UNDEF)addListener(win, "onload", fn); else if (typeof win.onload == "function") {
                var fnOld = win.onload;
                win.onload = function () {
                    fnOld(), fn()
                }
            } else win.onload = fn
        }

        function main() {
            plugin ? testPlayerVersion() : matchVersions()
        }

        function testPlayerVersion() {
            var b = doc.getElementsByTagName("body")[0], o = createElement(OBJECT);
            o.setAttribute("type", FLASH_MIME_TYPE);
            var t = b.appendChild(o);
            if (t) {
                var counter = 0;
                (function () {
                    if (typeof t.GetVariable != UNDEF) {
                        var d = t.GetVariable("$version");
                        d && (d = d.split(" ")[1].split(","), ua.pv = [parseInt(d[0], 10), parseInt(d[1], 10), parseInt(d[2], 10)])
                    } else if (counter < 10) {
                        counter++, setTimeout(arguments.callee, 10);
                        return
                    }
                    b.removeChild(o), t = null, matchVersions()
                })()
            } else matchVersions()
        }

        function matchVersions() {
            var rl = regObjArr.length;
            if (rl > 0)for (var i = 0; i < rl; i++) {
                var id = regObjArr[i].id, cb = regObjArr[i].callbackFn, cbObj = {success: !1, id: id};
                if (ua.pv[0] > 0) {
                    var obj = getElementById(id);
                    if (obj)if (hasPlayerVersion(regObjArr[i].swfVersion) && !(ua.wk && ua.wk < 312))setVisibility(id, !0), cb && (cbObj.success = !0, cbObj.ref = getObjectById(id), cb(cbObj)); else if (regObjArr[i].expressInstall && canExpressInstall()) {
                        var att = {};
                        att.data = regObjArr[i].expressInstall, att.width = obj.getAttribute("width") || "0", att.height = obj.getAttribute("height") || "0", obj.getAttribute("class") && (att.styleclass = obj.getAttribute("class")), obj.getAttribute("align") && (att.align = obj.getAttribute("align"));
                        var par = {}, p = obj.getElementsByTagName("param"), pl = p.length;
                        for (var j = 0; j < pl; j++)p[j].getAttribute("name").toLowerCase() != "movie" && (par[p[j].getAttribute("name")] = p[j].getAttribute("value"));
                        showExpressInstall(att, par, id, cb)
                    } else displayAltContent(obj), cb && cb(cbObj)
                } else {
                    setVisibility(id, !0);
                    if (cb) {
                        var o = getObjectById(id);
                        o && typeof o.SetVariable != UNDEF && (cbObj.success = !0, cbObj.ref = o), cb(cbObj)
                    }
                }
            }
        }

        function getObjectById(objectIdStr) {
            var r = null, o = getElementById(objectIdStr);
            if (o && o.nodeName == "OBJECT")if (typeof o.SetVariable != UNDEF)r = o; else {
                var n = o.getElementsByTagName(OBJECT)[0];
                n && (r = n)
            }
            return r
        }

        function canExpressInstall() {
            return !isExpressInstallActive && hasPlayerVersion("6.0.65") && (ua.win || ua.mac) && !(ua.wk && ua.wk < 312)
        }

        function showExpressInstall(att, par, replaceElemIdStr, callbackFn) {
            isExpressInstallActive = !0, storedCallbackFn = callbackFn || null, storedCallbackObj = {
                success: !1,
                id: replaceElemIdStr
            };
            var obj = getElementById(replaceElemIdStr);
            if (obj) {
                obj.nodeName == "OBJECT" ? (storedAltContent = abstractAltContent(obj), storedAltContentId = null) : (storedAltContent = obj, storedAltContentId = replaceElemIdStr), att.id = EXPRESS_INSTALL_ID;
                if (typeof att.width == UNDEF || !/%$/.test(att.width) && parseInt(att.width, 10) < 310)att.width = "310";
                if (typeof att.height == UNDEF || !/%$/.test(att.height) && parseInt(att.height, 10) < 137)att.height = "137";
                doc.title = doc.title.slice(0, 47) + " - Flash Player Installation";
                var pt = ua.ie && ua.win ? "ActiveX" : "PlugIn", fv = "MMredirectURL=" + encodeURI(window.location).toString().replace(/&/g, "%26") + "&MMplayerType=" + pt + "&MMdoctitle=" + doc.title;
                typeof par.flashvars != UNDEF ? par.flashvars += "&" + fv : par.flashvars = fv;
                if (ua.ie && ua.win && obj.readyState != 4) {
                    var newObj = createElement("div");
                    replaceElemIdStr += "SWFObjectNew", newObj.setAttribute("id", replaceElemIdStr), obj.parentNode.insertBefore(newObj, obj), obj.style.display = "none", function () {
                        obj.readyState == 4 ? obj.parentNode.removeChild(obj) : setTimeout(arguments.callee, 10)
                    }()
                }
                createSWF(att, par, replaceElemIdStr)
            }
        }

        function displayAltContent(obj) {
            if (ua.ie && ua.win && obj.readyState != 4) {
                var el = createElement("div");
                obj.parentNode.insertBefore(el, obj), el.parentNode.replaceChild(abstractAltContent(obj), el), obj.style.display = "none", function () {
                    obj.readyState == 4 ? obj.parentNode.removeChild(obj) : setTimeout(arguments.callee, 10)
                }()
            } else obj.parentNode.replaceChild(abstractAltContent(obj), obj)
        }

        function abstractAltContent(obj) {
            var ac = createElement("div");
            if (ua.win && ua.ie)ac.innerHTML = obj.innerHTML; else {
                var nestedObj = obj.getElementsByTagName(OBJECT)[0];
                if (nestedObj) {
                    var c = nestedObj.childNodes;
                    if (c) {
                        var cl = c.length;
                        for (var i = 0; i < cl; i++)(c[i].nodeType != 1 || c[i].nodeName != "PARAM") && c[i].nodeType != 8 && ac.appendChild(c[i].cloneNode(!0))
                    }
                }
            }
            return ac
        }

        function createSWF(attObj, parObj, id) {
            var r, el = getElementById(id);
            if (ua.wk && ua.wk < 312)return r;
            if (el) {
                typeof attObj.id == UNDEF && (attObj.id = id);
                if (ua.ie && ua.win) {
                    var att = "";
                    for (var i in attObj)attObj[i] != Object.prototype[i] && (i.toLowerCase() == "data" ? parObj.movie = attObj[i] : i.toLowerCase() == "styleclass" ? att += ' class="' + attObj[i] + '"' : i.toLowerCase() != "classid" && (att += " " + i + '="' + attObj[i] + '"'));
                    var par = "";
                    for (var j in parObj)parObj[j] != Object.prototype[j] && (par += '<param name="' + j + '" value="' + parObj[j] + '" />');
                    el.outerHTML = '<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"' + att + ">" + par + "</object>", objIdArr[objIdArr.length] = attObj.id, r = getElementById(attObj.id)
                } else {
                    var o = createElement(OBJECT);
                    o.setAttribute("type", FLASH_MIME_TYPE);
                    for (var m in attObj)attObj[m] != Object.prototype[m] && (m.toLowerCase() == "styleclass" ? o.setAttribute("class", attObj[m]) : m.toLowerCase() != "classid" && o.setAttribute(m, attObj[m]));
                    for (var n in parObj)parObj[n] != Object.prototype[n] && n.toLowerCase() != "movie" && createObjParam(o, n, parObj[n]);
                    el.parentNode.replaceChild(o, el), r = o
                }
            }
            return r
        }

        function createObjParam(el, pName, pValue) {
            var p = createElement("param");
            p.setAttribute("name", pName), p.setAttribute("value", pValue), el.appendChild(p)
        }

        function removeSWF(id) {
            var obj = getElementById(id);
            obj && obj.nodeName == "OBJECT" && (ua.ie && ua.win ? (obj.style.display = "none", function () {
                obj.readyState == 4 ? removeObjectInIE(id) : setTimeout(arguments.callee, 10)
            }()) : obj.parentNode.removeChild(obj))
        }

        function removeObjectInIE(id) {
            var obj = getElementById(id);
            if (obj) {
                for (var i in obj)typeof obj[i] == "function" && (obj[i] = null);
                obj.parentNode.removeChild(obj)
            }
        }

        function getElementById(id) {
            var el = null;
            try {
                el = doc.getElementById(id)
            } catch (e) {
            }
            return el
        }

        function createElement(el) {
            return doc.createElement(el)
        }

        function addListener(target, eventType, fn) {
            target.attachEvent(eventType, fn), listenersArr[listenersArr.length] = [target, eventType, fn]
        }

        function hasPlayerVersion(rv) {
            var pv = ua.pv, v = rv.split(".");
            return v[0] = parseInt(v[0], 10), v[1] = parseInt(v[1], 10) || 0, v[2] = parseInt(v[2], 10) || 0, pv[0] > v[0] || pv[0] == v[0] && pv[1] > v[1] || pv[0] == v[0] && pv[1] == v[1] && pv[2] >= v[2] ? !0 : !1
        }

        function createCSS(sel, decl, media, newStyle) {
            if (ua.ie && ua.mac)return;
            var h = doc.getElementsByTagName("head")[0];
            if (!h)return;
            var m = media && typeof media == "string" ? media : "screen";
            newStyle && (dynamicStylesheet = null, dynamicStylesheetMedia = null);
            if (!dynamicStylesheet || dynamicStylesheetMedia != m) {
                var s = createElement("style");
                s.setAttribute("type", "text/css"), s.setAttribute("media", m), dynamicStylesheet = h.appendChild(s), ua.ie && ua.win && typeof doc.styleSheets != UNDEF && doc.styleSheets.length > 0 && (dynamicStylesheet = doc.styleSheets[doc.styleSheets.length - 1]), dynamicStylesheetMedia = m
            }
            ua.ie && ua.win ? dynamicStylesheet && typeof dynamicStylesheet.addRule == OBJECT && dynamicStylesheet.addRule(sel, decl) : dynamicStylesheet && typeof doc.createTextNode != UNDEF && dynamicStylesheet.appendChild(doc.createTextNode(sel + " {" + decl + "}"))
        }

        function setVisibility(id, isVisible) {
            if (!autoHideShow)return;
            var v = isVisible ? "visible" : "hidden";
            isDomLoaded && getElementById(id) ? getElementById(id).style.visibility = v : createCSS("#" + id, "visibility:" + v)
        }

        function urlEncodeIfNecessary(s) {
            var regex = /[\\\"<>\.;]/, hasBadChars = regex.exec(s) != null;
            return hasBadChars && typeof encodeURIComponent != UNDEF ? encodeURIComponent(s) : s
        }

        var cleanup = function () {
            ua.ie && ua.win && window.attachEvent("onunload", function () {
                var ll = listenersArr.length;
                for (var i = 0; i < ll; i++)listenersArr[i][0].detachEvent(listenersArr[i][1], listenersArr[i][2]);
                var il = objIdArr.length;
                for (var j = 0; j < il; j++)removeSWF(objIdArr[j]);
                for (var k in ua)ua[k] = null;
                ua = null;
                for (var l in swfobject)swfobject[l] = null;
                swfobject = null
            })
        }();
        return {
            registerObject: function (objectIdStr, swfVersionStr, xiSwfUrlStr, callbackFn) {
                if (ua.w3 && objectIdStr && swfVersionStr) {
                    var regObj = {};
                    regObj.id = objectIdStr, regObj.swfVersion = swfVersionStr, regObj.expressInstall = xiSwfUrlStr, regObj.callbackFn = callbackFn, regObjArr[regObjArr.length] = regObj, setVisibility(objectIdStr, !1)
                } else callbackFn && callbackFn({success: !1, id: objectIdStr})
            },
            getObjectById: function (objectIdStr) {
                if (ua.w3)return getObjectById(objectIdStr)
            },
            embedSWF: function (swfUrlStr, replaceElemIdStr, widthStr, heightStr, swfVersionStr, xiSwfUrlStr, flashvarsObj, parObj, attObj, callbackFn) {
                var callbackObj = {success: !1, id: replaceElemIdStr};
                ua.w3 && !(ua.wk && ua.wk < 312) && swfUrlStr && replaceElemIdStr && widthStr && heightStr && swfVersionStr ? (setVisibility(replaceElemIdStr, !1), addDomLoadEvent(function () {
                    widthStr += "", heightStr += "";
                    var att = {};
                    if (attObj && typeof attObj === OBJECT)for (var i in attObj)att[i] = attObj[i];
                    att.data = swfUrlStr, att.width = widthStr, att.height = heightStr;
                    var par = {};
                    if (parObj && typeof parObj === OBJECT)for (var j in parObj)par[j] = parObj[j];
                    if (flashvarsObj && typeof flashvarsObj === OBJECT)for (var k in flashvarsObj)typeof par.flashvars != UNDEF ? par.flashvars += "&" + k + "=" + flashvarsObj[k] : par.flashvars = k + "=" + flashvarsObj[k];
                    if (hasPlayerVersion(swfVersionStr)) {
                        var obj = createSWF(att, par, replaceElemIdStr);
                        att.id == replaceElemIdStr && setVisibility(replaceElemIdStr, !0), callbackObj.success = !0, callbackObj.ref = obj
                    } else {
                        if (xiSwfUrlStr && canExpressInstall()) {
                            att.data = xiSwfUrlStr, showExpressInstall(att, par, replaceElemIdStr, callbackFn);
                            return
                        }
                        setVisibility(replaceElemIdStr, !0)
                    }
                    callbackFn && callbackFn(callbackObj)
                })) : callbackFn && callbackFn(callbackObj)
            },
            switchOffAutoHideShow: function () {
                autoHideShow = !1
            },
            ua: ua,
            getFlashPlayerVersion: function () {
                return {major: ua.pv[0], minor: ua.pv[1], release: ua.pv[2]}
            },
            hasFlashPlayerVersion: hasPlayerVersion,
            createSWF: function (attObj, parObj, replaceElemIdStr) {
                return ua.w3 ? createSWF(attObj, parObj, replaceElemIdStr) : undefined
            },
            showExpressInstall: function (att, par, replaceElemIdStr, callbackFn) {
                ua.w3 && canExpressInstall() && showExpressInstall(att, par, replaceElemIdStr, callbackFn)
            },
            removeSWF: function (objElemIdStr) {
                ua.w3 && removeSWF(objElemIdStr)
            },
            createCSS: function (selStr, declStr, mediaStr, newStyleBoolean) {
                ua.w3 && createCSS(selStr, declStr, mediaStr, newStyleBoolean)
            },
            addDomLoadEvent: addDomLoadEvent,
            addLoadEvent: addLoadEvent,
            getQueryParamValue: function (param) {
                var q = doc.location.search || doc.location.hash;
                if (q) {
                    /\?/.test(q) && (q = q.split("?")[1]);
                    if (param == null)return urlEncodeIfNecessary(q);
                    var pairs = q.split("&");
                    for (var i = 0; i < pairs.length; i++)if (pairs[i].substring(0, pairs[i].indexOf("=")) == param)return urlEncodeIfNecessary(pairs[i].substring(pairs[i].indexOf("=") + 1))
                }
                return ""
            },
            expressInstallCallback: function () {
                if (isExpressInstallActive) {
                    var obj = getElementById(EXPRESS_INSTALL_ID);
                    obj && storedAltContent && (obj.parentNode.replaceChild(storedAltContent, obj), storedAltContentId && (setVisibility(storedAltContentId, !0), ua.ie && ua.win && (storedAltContent.style.display = "block")), storedCallbackFn && storedCallbackFn(storedCallbackObj)), isExpressInstallActive = !1
                }
            }
        }
    }();
    module.exports = swfobject
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
}), define("IO", ["JSON", "SWF", "JQ"], function (require, exports, module) {
    var xm_json = require("JSON"), xm_swf = require("SWF"), JQ = require("JQ");
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
        }, util.getCookie = function (name) {
            var tmp, reg = new RegExp("(^| )" + name + "=([^;]*)(;|$)", "gi");
            return (tmp = reg.exec(unescape(document.cookie))) ? tmp[2] : null
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
                "allow get gate": !0,
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
            err && err.advice && err.advice === "reconnect" && (this.connected || this.connecting) && (this.disconnect(), this.options.reconnect && this.reGetGate())
        }, Socket.prototype.onDisconnect = function (reason) {
            var wasConnected = this.connected, wasConnecting = this.connecting;
            this.connected = !1, this.connecting = !1, this.open = !1;
            if (wasConnected || wasConnecting)this.transport.close(), this.transport.clearTimeouts(), wasConnected && (this.publish("disconnect", reason), "booted" != reason && this.options.reconnect && !this.reconnecting && this.reGetGate())
        }, Socket.prototype.GATE = {
            _getGate_time: 0,
            _getGate_sum: 6e4,
            _getGate_gap: 5e3,
            _getGate_toggle: !1,
            _gate_retimer: null,
            _getGate_timeout: null
        }, Socket.prototype.gateTimeOut = function () {
            var self = this;
            clearTimeout(this.GATE._gate_timeout), this.GATE._gate_timeout = setTimeout(function () {
                self.GATE._getGate_toggle ? clearTimeout(self.GATE._gate_timeout) : self.GATE._getGate_time >= self.GATE._getGate_sum ? alert("已断开连接，请刷新页面重试。") : self.reGetGate()
            }, this.GATE._getGate_gap)
        }, Socket.prototype.reGetGate = function () {
            if (typeof window.DDS != "undefined" && this.options["allow get gate"]) {
                var self = this;
                this.GATE._gate_retimer = setTimeout(function () {
                    clearTimeout(self.GATE._gate_retimer), clearTimeout(self.GATE._gate_timeout), self.GATE._getGate_time += 1, self.GATE._getGate_toggle = !1, self.gateTimeOut(), typeof console != "undefined" && console.log("别急，我在重连:" + self.GATE._getGate_time), JQ.ajax({
                        url: window.DDS.baseInfo.host + "/" + window.DDS.baseInfo.roomId,
                        type: "GET",
                        dataType: "jsonp",
                        cache: !1,
                        success: function (data) {
                            if (data && data.host) {
                                self.GATE._getGate_time = 0, self.GATE._getGate_toggle = !0, clearTimeout(self.GATE._gate_timeout), clearTimeout(self.GATE._gate_retimer);
                                var host = data.host;
                                typeof window.GOLBALPARAMS == "undefined" && (window.GOLBALPARAMS = {}), window.GOLBALPARAMS.ROOMPORT = host;
                                var uri = io.util.parseUri(host);
                                self.options.host = uri.host, self.options.port = uri.port;
                                var _cps = io.util.getCookie("premium_cps") ? "ct_" + io.util.getCookie("premium_cps") : "ct_", _yktk = io.util.getCookie("yktk") ? io.util.getCookie("yktk") : "", socketOption = {
                                    token: window.DDS.baseInfo.token,
                                    uid: window.DDS.userInfo.userId,
                                    roomid: window.DDS.baseInfo.roomId,
                                    isPushHis: 1,
                                    yktk: _yktk,
                                    endpointtype: _cps + ",dt_1__" + (new Date).getTime()
                                };
                                self.reconnect(function () {
                                    self.emit("enter", socketOption)
                                })
                            }
                        }
                    })
                }, self.GATE._getGate_gap)
            } else self.reconnect(function () {
            })
        }, Socket.prototype.reconnect = function (fn) {
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
                self.reconnectionAttempts++ >= maxAttempts ? self.redoTransports ? (self.publish("reconnect_failed"), io.util.errorPost("重连连接失败", self.options["allow show tips"]), reset()) : (self.on("connect_failed", maybeReconnect), self.options["try multiple transports"] = !0, self.transport = self.getTransport(), self.redoTransports = !0, self.connect(fn)) : (self.reconnectionDelay < limit && (self.reconnectionDelay *= 2), self.connect(fn), self.publish("reconnecting", self.reconnectionDelay, self.reconnectionAttempts), self.reconnectionTimer = setTimeout(maybeReconnect, self.reconnectionDelay))
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
            return typeof WebSocket != "undefined" && "__initialize" in WebSocket && !!swfobject ? swfobject.getFlashPlayerVersion().major >= 10 : !1
        }, Flashsocket.xdomainCheck = function () {
            return !0
        }, typeof window != "undefined" && (WEB_SOCKET_DISABLE_AUTO_INITIALIZATION = !0), io.transports.push("flashsocket")
    }("undefined" != typeof io ? io.Transport : _module.exports, "undefined" != typeof io ? io : _module.parent.exports);
    if ("undefined" != typeof window)var swfobject = xm_swf;
    (function () {
        if ("undefined" == typeof window || window.WebSocket)return;
        var console = window.console;
        if (!console || !console.log || !console.error)console = {
            log: function () {
            }, error: function () {
            }
        };
        if (!swfobject.hasFlashPlayerVersion("10.0.0")) {
            io.util.errorPost("Flash Player >= 10.0.0 is required."), console.error("Flash Player >= 10.0.0 is required.");
            return
        }
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
            holder.id = "webSocketFlash", container.appendChild(holder), document.body.appendChild(container), swfobject.embedSWF(WEB_SOCKET_SWF_LOCATION, "webSocketFlash", "1", "1", "10.0.0", null, null, {
                hasPriority: !0,
                swliveconnect: !0,
                allowScriptAccess: "always"
            }, null, function (e) {
                e.success || (io.util.errorPost("[WebSocket] swfobject.embedSWF failed"), console.error("[WebSocket] swfobject.embedSWF failed"))
            })
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
    })(), module.exports = io
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
}), define("TJ", ["UTIL", "JSON"], function (require, exports, module) {
    var Util = require("UTIL"), Json = require("JSON"), tj = {};

    function getChannelInfo() {
        var cps = Util.getCookie("premium_cps") || "0";
        return cps && cps.indexOf("|") != -1 && (cps = cps.split("|")[2]), cps
    }

    function getDeviceInfo() {
        var mid = Util.getCookie("mk") || "";
        return mid && mid.indexOf("#") != -1 && (mid = mid.split("#")[1]), mid
    }

    function getUserId() {
        return Util.getCookie("uk") || ""
    }

    function Request(eventName, isRoom, duration) {
        var url = "http://log.laifeng.com/log/client", _data = "", _clientInfo = {
            channel: getChannelInfo(),
            appId: 1e3,
            appVersion: "",
            deviceToken: getDeviceInfo()
        }, _dataInfo = {category: "event", event: eventName, duration: duration || 0, logtime: (new Date).getTime()};
        typeof window.INFO != "undefined" && (window.INFO.isLogin ? _dataInfo.userId = getUserId() : _dataInfo.touristId = getUserId()), isRoom && typeof window.DDS != "undefined" && window.DDS.baseInfo && (_dataInfo.room = window.DDS.baseInfo.roomId), _data = "clientInfo=" + encodeURIComponent(Json.stringify({clientInfo: _clientInfo})) + "&dataInfo=" + encodeURIComponent(Json.stringify({dataInfo: _dataInfo}));
        var _img = new Image;
        _img.src = url + "?" + _data + "&_t=" + (new Date).getTime()
    }

    tj.set = function (eventName, isRoom, duration) {
        Request(eventName, isRoom, duration)
    }, typeof window.LAIFENG_GLOBAL_TONGJI == "undefined" && (window.LAIFENG_GLOBAL_TONGJI = {}), window.LAIFENG_GLOBAL_TONGJI = tj, module.exports = tj
})
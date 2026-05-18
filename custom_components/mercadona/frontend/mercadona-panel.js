/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const R = globalThis, W = R.ShadowRoot && (R.ShadyCSS === void 0 || R.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, K = Symbol(), X = /* @__PURE__ */ new WeakMap();
let ut = class {
  constructor(t, e, i) {
    if (this._$cssResult$ = !0, i !== K) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (W && t === void 0) {
      const i = e !== void 0 && e.length === 1;
      i && (t = X.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), i && X.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const gt = (n) => new ut(typeof n == "string" ? n : n + "", void 0, K), yt = (n, ...t) => {
  const e = n.length === 1 ? n[0] : t.reduce((i, s, r) => i + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s) + n[r + 1], n[0]);
  return new ut(e, n, K);
}, vt = (n, t) => {
  if (W) n.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const i = document.createElement("style"), s = R.litNonce;
    s !== void 0 && i.setAttribute("nonce", s), i.textContent = e.cssText, n.appendChild(i);
  }
}, Y = W ? (n) => n : (n) => n instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const i of t.cssRules) e += i.cssText;
  return gt(e);
})(n) : n;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: $t, defineProperty: bt, getOwnPropertyDescriptor: xt, getOwnPropertyNames: At, getOwnPropertySymbols: wt, getPrototypeOf: Et } = Object, v = globalThis, tt = v.trustedTypes, St = tt ? tt.emptyScript : "", D = v.reactiveElementPolyfillSupport, C = (n, t) => n, H = { toAttribute(n, t) {
  switch (t) {
    case Boolean:
      n = n ? St : null;
      break;
    case Object:
    case Array:
      n = n == null ? n : JSON.stringify(n);
  }
  return n;
}, fromAttribute(n, t) {
  let e = n;
  switch (t) {
    case Boolean:
      e = n !== null;
      break;
    case Number:
      e = n === null ? null : Number(n);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(n);
      } catch {
        e = null;
      }
  }
  return e;
} }, Z = (n, t) => !$t(n, t), et = { attribute: !0, type: String, converter: H, reflect: !1, useDefault: !1, hasChanged: Z };
Symbol.metadata ?? (Symbol.metadata = Symbol("metadata")), v.litPropertyMetadata ?? (v.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
let E = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ?? (this.l = [])).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = et) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const i = Symbol(), s = this.getPropertyDescriptor(t, i, e);
      s !== void 0 && bt(this.prototype, t, s);
    }
  }
  static getPropertyDescriptor(t, e, i) {
    const { get: s, set: r } = xt(this.prototype, t) ?? { get() {
      return this[e];
    }, set(o) {
      this[e] = o;
    } };
    return { get: s, set(o) {
      const l = s == null ? void 0 : s.call(this);
      r == null || r.call(this, o), this.requestUpdate(t, l, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? et;
  }
  static _$Ei() {
    if (this.hasOwnProperty(C("elementProperties"))) return;
    const t = Et(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(C("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(C("properties"))) {
      const e = this.properties, i = [...At(e), ...wt(e)];
      for (const s of i) this.createProperty(s, e[s]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const e = litPropertyMetadata.get(t);
      if (e !== void 0) for (const [i, s] of e) this.elementProperties.set(i, s);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [e, i] of this.elementProperties) {
      const s = this._$Eu(e, i);
      s !== void 0 && this._$Eh.set(s, e);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const e = [];
    if (Array.isArray(t)) {
      const i = new Set(t.flat(1 / 0).reverse());
      for (const s of i) e.unshift(Y(s));
    } else t !== void 0 && e.push(Y(t));
    return e;
  }
  static _$Eu(t, e) {
    const i = e.attribute;
    return i === !1 ? void 0 : typeof i == "string" ? i : typeof t == "string" ? t.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    var t;
    this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), (t = this.constructor.l) == null || t.forEach((e) => e(this));
  }
  addController(t) {
    var e;
    (this._$EO ?? (this._$EO = /* @__PURE__ */ new Set())).add(t), this.renderRoot !== void 0 && this.isConnected && ((e = t.hostConnected) == null || e.call(t));
  }
  removeController(t) {
    var e;
    (e = this._$EO) == null || e.delete(t);
  }
  _$E_() {
    const t = /* @__PURE__ */ new Map(), e = this.constructor.elementProperties;
    for (const i of e.keys()) this.hasOwnProperty(i) && (t.set(i, this[i]), delete this[i]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return vt(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    var t;
    this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this.enableUpdating(!0), (t = this._$EO) == null || t.forEach((e) => {
      var i;
      return (i = e.hostConnected) == null ? void 0 : i.call(e);
    });
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    var t;
    (t = this._$EO) == null || t.forEach((e) => {
      var i;
      return (i = e.hostDisconnected) == null ? void 0 : i.call(e);
    });
  }
  attributeChangedCallback(t, e, i) {
    this._$AK(t, i);
  }
  _$ET(t, e) {
    var r;
    const i = this.constructor.elementProperties.get(t), s = this.constructor._$Eu(t, i);
    if (s !== void 0 && i.reflect === !0) {
      const o = (((r = i.converter) == null ? void 0 : r.toAttribute) !== void 0 ? i.converter : H).toAttribute(e, i.type);
      this._$Em = t, o == null ? this.removeAttribute(s) : this.setAttribute(s, o), this._$Em = null;
    }
  }
  _$AK(t, e) {
    var r, o;
    const i = this.constructor, s = i._$Eh.get(t);
    if (s !== void 0 && this._$Em !== s) {
      const l = i.getPropertyOptions(s), a = typeof l.converter == "function" ? { fromAttribute: l.converter } : ((r = l.converter) == null ? void 0 : r.fromAttribute) !== void 0 ? l.converter : H;
      this._$Em = s;
      const d = a.fromAttribute(e, l.type);
      this[s] = d ?? ((o = this._$Ej) == null ? void 0 : o.get(s)) ?? d, this._$Em = null;
    }
  }
  requestUpdate(t, e, i, s = !1, r) {
    var o;
    if (t !== void 0) {
      const l = this.constructor;
      if (s === !1 && (r = this[t]), i ?? (i = l.getPropertyOptions(t)), !((i.hasChanged ?? Z)(r, e) || i.useDefault && i.reflect && r === ((o = this._$Ej) == null ? void 0 : o.get(t)) && !this.hasAttribute(l._$Eu(t, i)))) return;
      this.C(t, e, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: i, reflect: s, wrapped: r }, o) {
    i && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(t) && (this._$Ej.set(t, o ?? e ?? this[t]), r !== !0 || o !== void 0) || (this._$AL.has(t) || (this.hasUpdated || i || (e = void 0), this._$AL.set(t, e)), s === !0 && this._$Em !== t && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(t));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (e) {
      Promise.reject(e);
    }
    const t = this.scheduleUpdate();
    return t != null && await t, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    var i;
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this._$Ep) {
        for (const [r, o] of this._$Ep) this[r] = o;
        this._$Ep = void 0;
      }
      const s = this.constructor.elementProperties;
      if (s.size > 0) for (const [r, o] of s) {
        const { wrapped: l } = o, a = this[r];
        l !== !0 || this._$AL.has(r) || a === void 0 || this.C(r, void 0, o, a);
      }
    }
    let t = !1;
    const e = this._$AL;
    try {
      t = this.shouldUpdate(e), t ? (this.willUpdate(e), (i = this._$EO) == null || i.forEach((s) => {
        var r;
        return (r = s.hostUpdate) == null ? void 0 : r.call(s);
      }), this.update(e)) : this._$EM();
    } catch (s) {
      throw t = !1, this._$EM(), s;
    }
    t && this._$AE(e);
  }
  willUpdate(t) {
  }
  _$AE(t) {
    var e;
    (e = this._$EO) == null || e.forEach((i) => {
      var s;
      return (s = i.hostUpdated) == null ? void 0 : s.call(i);
    }), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t) {
    return !0;
  }
  update(t) {
    this._$Eq && (this._$Eq = this._$Eq.forEach((e) => this._$ET(e, this[e]))), this._$EM();
  }
  updated(t) {
  }
  firstUpdated(t) {
  }
};
E.elementStyles = [], E.shadowRootOptions = { mode: "open" }, E[C("elementProperties")] = /* @__PURE__ */ new Map(), E[C("finalized")] = /* @__PURE__ */ new Map(), D == null || D({ ReactiveElement: E }), (v.reactiveElementVersions ?? (v.reactiveElementVersions = [])).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const O = globalThis, it = (n) => n, z = O.trustedTypes, st = z ? z.createPolicy("lit-html", { createHTML: (n) => n }) : void 0, pt = "$lit$", y = `lit$${Math.random().toFixed(9).slice(2)}$`, _t = "?" + y, Pt = `<${_t}>`, w = document, N = () => w.createComment(""), L = (n) => n === null || typeof n != "object" && typeof n != "function", G = Array.isArray, kt = (n) => G(n) || typeof (n == null ? void 0 : n[Symbol.iterator]) == "function", B = `[ 	
\f\r]`, k = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, rt = /-->/g, ot = />/g, b = RegExp(`>|${B}(?:([^\\s"'>=/]+)(${B}*=${B}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), nt = /'/g, at = /"/g, mt = /^(?:script|style|textarea|title)$/i, Ct = (n) => (t, ...e) => ({ _$litType$: n, strings: t, values: e }), c = Ct(1), S = Symbol.for("lit-noChange"), u = Symbol.for("lit-nothing"), lt = /* @__PURE__ */ new WeakMap(), x = w.createTreeWalker(w, 129);
function ft(n, t) {
  if (!G(n) || !n.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return st !== void 0 ? st.createHTML(t) : t;
}
const Ot = (n, t) => {
  const e = n.length - 1, i = [];
  let s, r = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = k;
  for (let l = 0; l < e; l++) {
    const a = n[l];
    let d, p, h = -1, f = 0;
    for (; f < a.length && (o.lastIndex = f, p = o.exec(a), p !== null); ) f = o.lastIndex, o === k ? p[1] === "!--" ? o = rt : p[1] !== void 0 ? o = ot : p[2] !== void 0 ? (mt.test(p[2]) && (s = RegExp("</" + p[2], "g")), o = b) : p[3] !== void 0 && (o = b) : o === b ? p[0] === ">" ? (o = s ?? k, h = -1) : p[1] === void 0 ? h = -2 : (h = o.lastIndex - p[2].length, d = p[1], o = p[3] === void 0 ? b : p[3] === '"' ? at : nt) : o === at || o === nt ? o = b : o === rt || o === ot ? o = k : (o = b, s = void 0);
    const g = o === b && n[l + 1].startsWith("/>") ? " " : "";
    r += o === k ? a + Pt : h >= 0 ? (i.push(d), a.slice(0, h) + pt + a.slice(h) + y + g) : a + y + (h === -2 ? l : g);
  }
  return [ft(n, r + (n[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), i];
};
class q {
  constructor({ strings: t, _$litType$: e }, i) {
    let s;
    this.parts = [];
    let r = 0, o = 0;
    const l = t.length - 1, a = this.parts, [d, p] = Ot(t, e);
    if (this.el = q.createElement(d, i), x.currentNode = this.el.content, e === 2 || e === 3) {
      const h = this.el.content.firstChild;
      h.replaceWith(...h.childNodes);
    }
    for (; (s = x.nextNode()) !== null && a.length < l; ) {
      if (s.nodeType === 1) {
        if (s.hasAttributes()) for (const h of s.getAttributeNames()) if (h.endsWith(pt)) {
          const f = p[o++], g = s.getAttribute(h).split(y), U = /([.?@])?(.*)/.exec(f);
          a.push({ type: 1, index: r, name: U[2], strings: g, ctor: U[1] === "." ? Nt : U[1] === "?" ? Lt : U[1] === "@" ? qt : j }), s.removeAttribute(h);
        } else h.startsWith(y) && (a.push({ type: 6, index: r }), s.removeAttribute(h));
        if (mt.test(s.tagName)) {
          const h = s.textContent.split(y), f = h.length - 1;
          if (f > 0) {
            s.textContent = z ? z.emptyScript : "";
            for (let g = 0; g < f; g++) s.append(h[g], N()), x.nextNode(), a.push({ type: 2, index: ++r });
            s.append(h[f], N());
          }
        }
      } else if (s.nodeType === 8) if (s.data === _t) a.push({ type: 2, index: r });
      else {
        let h = -1;
        for (; (h = s.data.indexOf(y, h + 1)) !== -1; ) a.push({ type: 7, index: r }), h += y.length - 1;
      }
      r++;
    }
  }
  static createElement(t, e) {
    const i = w.createElement("template");
    return i.innerHTML = t, i;
  }
}
function P(n, t, e = n, i) {
  var o, l;
  if (t === S) return t;
  let s = i !== void 0 ? (o = e._$Co) == null ? void 0 : o[i] : e._$Cl;
  const r = L(t) ? void 0 : t._$litDirective$;
  return (s == null ? void 0 : s.constructor) !== r && ((l = s == null ? void 0 : s._$AO) == null || l.call(s, !1), r === void 0 ? s = void 0 : (s = new r(n), s._$AT(n, e, i)), i !== void 0 ? (e._$Co ?? (e._$Co = []))[i] = s : e._$Cl = s), s !== void 0 && (t = P(n, s._$AS(n, t.values), s, i)), t;
}
class It {
  constructor(t, e) {
    this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = e;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t) {
    const { el: { content: e }, parts: i } = this._$AD, s = ((t == null ? void 0 : t.creationScope) ?? w).importNode(e, !0);
    x.currentNode = s;
    let r = x.nextNode(), o = 0, l = 0, a = i[0];
    for (; a !== void 0; ) {
      if (o === a.index) {
        let d;
        a.type === 2 ? d = new M(r, r.nextSibling, this, t) : a.type === 1 ? d = new a.ctor(r, a.name, a.strings, this, t) : a.type === 6 && (d = new Mt(r, this, t)), this._$AV.push(d), a = i[++l];
      }
      o !== (a == null ? void 0 : a.index) && (r = x.nextNode(), o++);
    }
    return x.currentNode = w, s;
  }
  p(t) {
    let e = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(t, i, e), e += i.strings.length - 2) : i._$AI(t[e])), e++;
  }
}
class M {
  get _$AU() {
    var t;
    return ((t = this._$AM) == null ? void 0 : t._$AU) ?? this._$Cv;
  }
  constructor(t, e, i, s) {
    this.type = 2, this._$AH = u, this._$AN = void 0, this._$AA = t, this._$AB = e, this._$AM = i, this.options = s, this._$Cv = (s == null ? void 0 : s.isConnected) ?? !0;
  }
  get parentNode() {
    let t = this._$AA.parentNode;
    const e = this._$AM;
    return e !== void 0 && (t == null ? void 0 : t.nodeType) === 11 && (t = e.parentNode), t;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t, e = this) {
    t = P(this, t, e), L(t) ? t === u || t == null || t === "" ? (this._$AH !== u && this._$AR(), this._$AH = u) : t !== this._$AH && t !== S && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : kt(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== u && L(this._$AH) ? this._$AA.nextSibling.data = t : this.T(w.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    var r;
    const { values: e, _$litType$: i } = t, s = typeof i == "number" ? this._$AC(t) : (i.el === void 0 && (i.el = q.createElement(ft(i.h, i.h[0]), this.options)), i);
    if (((r = this._$AH) == null ? void 0 : r._$AD) === s) this._$AH.p(e);
    else {
      const o = new It(s, this), l = o.u(this.options);
      o.p(e), this.T(l), this._$AH = o;
    }
  }
  _$AC(t) {
    let e = lt.get(t.strings);
    return e === void 0 && lt.set(t.strings, e = new q(t)), e;
  }
  k(t) {
    G(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let i, s = 0;
    for (const r of t) s === e.length ? e.push(i = new M(this.O(N()), this.O(N()), this, this.options)) : i = e[s], i._$AI(r), s++;
    s < e.length && (this._$AR(i && i._$AB.nextSibling, s), e.length = s);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    var i;
    for ((i = this._$AP) == null ? void 0 : i.call(this, !1, !0, e); t !== this._$AB; ) {
      const s = it(t).nextSibling;
      it(t).remove(), t = s;
    }
  }
  setConnected(t) {
    var e;
    this._$AM === void 0 && (this._$Cv = t, (e = this._$AP) == null || e.call(this, t));
  }
}
class j {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, i, s, r) {
    this.type = 1, this._$AH = u, this._$AN = void 0, this.element = t, this.name = e, this._$AM = s, this.options = r, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = u;
  }
  _$AI(t, e = this, i, s) {
    const r = this.strings;
    let o = !1;
    if (r === void 0) t = P(this, t, e, 0), o = !L(t) || t !== this._$AH && t !== S, o && (this._$AH = t);
    else {
      const l = t;
      let a, d;
      for (t = r[0], a = 0; a < r.length - 1; a++) d = P(this, l[i + a], e, a), d === S && (d = this._$AH[a]), o || (o = !L(d) || d !== this._$AH[a]), d === u ? t = u : t !== u && (t += (d ?? "") + r[a + 1]), this._$AH[a] = d;
    }
    o && !s && this.j(t);
  }
  j(t) {
    t === u ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class Nt extends j {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === u ? void 0 : t;
  }
}
class Lt extends j {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== u);
  }
}
class qt extends j {
  constructor(t, e, i, s, r) {
    super(t, e, i, s, r), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = P(this, t, e, 0) ?? u) === S) return;
    const i = this._$AH, s = t === u && i !== u || t.capture !== i.capture || t.once !== i.once || t.passive !== i.passive, r = t !== u && (i === u || s);
    s && this.element.removeEventListener(this.name, this, i), r && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    var e;
    typeof this._$AH == "function" ? this._$AH.call(((e = this.options) == null ? void 0 : e.host) ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class Mt {
  constructor(t, e, i) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = e, this.options = i;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    P(this, t);
  }
}
const F = O.litHtmlPolyfillSupport;
F == null || F(q, M), (O.litHtmlVersions ?? (O.litHtmlVersions = [])).push("3.3.3");
const Tt = (n, t, e) => {
  const i = (e == null ? void 0 : e.renderBefore) ?? t;
  let s = i._$litPart$;
  if (s === void 0) {
    const r = (e == null ? void 0 : e.renderBefore) ?? null;
    i._$litPart$ = s = new M(t.insertBefore(N(), r), r, void 0, e ?? {});
  }
  return s._$AI(n), s;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const A = globalThis;
class I extends E {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    var e;
    const t = super.createRenderRoot();
    return (e = this.renderOptions).renderBefore ?? (e.renderBefore = t.firstChild), t;
  }
  update(t) {
    const e = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = Tt(e, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    var t;
    super.connectedCallback(), (t = this._$Do) == null || t.setConnected(!0);
  }
  disconnectedCallback() {
    var t;
    super.disconnectedCallback(), (t = this._$Do) == null || t.setConnected(!1);
  }
  render() {
    return S;
  }
}
var ht;
I._$litElement$ = !0, I.finalized = !0, (ht = A.litElementHydrateSupport) == null || ht.call(A, { LitElement: I });
const Q = A.litElementPolyfillSupport;
Q == null || Q({ LitElement: I });
(A.litElementVersions ?? (A.litElementVersions = [])).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ut = { attribute: !0, type: String, converter: H, reflect: !1, hasChanged: Z }, Rt = (n = Ut, t, e) => {
  const { kind: i, metadata: s } = e;
  let r = globalThis.litPropertyMetadata.get(s);
  if (r === void 0 && globalThis.litPropertyMetadata.set(s, r = /* @__PURE__ */ new Map()), i === "setter" && ((n = Object.create(n)).wrapped = !0), r.set(e.name, n), i === "accessor") {
    const { name: o } = e;
    return { set(l) {
      const a = t.get.call(this);
      t.set.call(this, l), this.requestUpdate(o, a, n, !0, l);
    }, init(l) {
      return l !== void 0 && this.C(o, void 0, n, l), l;
    } };
  }
  if (i === "setter") {
    const { name: o } = e;
    return function(l) {
      const a = this[o];
      t.call(this, l), this.requestUpdate(o, a, n, !0, l);
    };
  }
  throw Error("Unsupported decorator location: " + i);
};
function T(n) {
  return (t, e) => typeof e == "object" ? Rt(n, t, e) : ((i, s, r) => {
    const o = s.hasOwnProperty(r);
    return s.constructor.createProperty(r, i), o ? Object.getOwnPropertyDescriptor(s, r) : void 0;
  })(n, t, e);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function $(n) {
  return T({ ...n, state: !0, attribute: !1 });
}
var Ht = Object.defineProperty, m = (n, t, e, i) => {
  for (var s = void 0, r = n.length - 1, o; r >= 0; r--)
    (o = n[r]) && (s = o(t, e, s) || s);
  return s && Ht(t, e, s), s;
};
const dt = 60, zt = "0.1.0", ct = "mercadona-panel", V = "mercadona-panel.alexa_entity", J = class J extends I {
  constructor() {
    super(...arguments), this.narrow = !1, this._busy = !1, this._alexaItems = [], this._alexaLoaded = !1, this._pending = [], this._alexaOverride = typeof localStorage < "u" && localStorage.getItem(V) || void 0;
  }
  connectedCallback() {
    super.connectedCallback(), queueMicrotask(() => this._loadAlexaListIfNeeded());
  }
  updated() {
    this._loadAlexaListIfNeeded();
  }
  // ---------- Deteccion de entidades --------------------------------------
  get _cartEntityId() {
    var e;
    const t = ((e = this.panel) == null ? void 0 : e.config) ?? {};
    if (t.cart_entity) return t.cart_entity;
    if (this.hass)
      for (const [i, s] of Object.entries(this.hass.states)) {
        if (!i.startsWith("sensor.")) continue;
        const r = s.attributes;
        if ("lines" in r && "cart_id" in r && "products_count" in r)
          return i;
      }
  }
  get _allTodoEntities() {
    return this.hass ? Object.keys(this.hass.states).filter((t) => t.startsWith("todo.")).sort() : [];
  }
  get _alexaEntityId() {
    var s, r;
    if (this._alexaOverride && ((s = this.hass) != null && s.states[this._alexaOverride]))
      return this._alexaOverride;
    const t = ((r = this.panel) == null ? void 0 : r.config) ?? {};
    if (t.alexa_entity) return t.alexa_entity;
    const e = this._allTodoEntities;
    if (e.length === 0) return;
    const i = (o) => e.find((l) => o.test(l));
    return i(/shop(p?ing)?|compra/i) ?? i(/alexa/i) ?? e[0];
  }
  _setAlexaOverride(t) {
    this._alexaOverride = t || void 0;
    try {
      t ? localStorage.setItem(V, t) : localStorage.removeItem(V);
    } catch {
    }
    this._alexaItems = [], this._alexaLoaded = !1, this._alexaLoadedFor = void 0, this._loadAlexaListIfNeeded();
  }
  // ---------- Datos del carrito -------------------------------------------
  _getLines() {
    const t = this._cartEntityId;
    if (!t || !this.hass) return [];
    const e = this.hass.states[t], i = e == null ? void 0 : e.attributes.lines;
    return Array.isArray(i) ? i : [];
  }
  _getTotal() {
    const t = this._cartEntityId;
    if (!t || !this.hass) return 0;
    const e = this.hass.states[t], i = parseFloat((e == null ? void 0 : e.state) ?? "0");
    return Number.isFinite(i) ? i : 0;
  }
  // ---------- Llamadas a HA -----------------------------------------------
  async _callService(t, e, i, s = !1) {
    if (this.hass) {
      this._busy = !0, this._error = void 0;
      try {
        const r = await this.hass.callService(
          t,
          e,
          i,
          void 0,
          !0,
          s
        );
        return s ? r.response ?? null : null;
      } catch (r) {
        throw this._error = r instanceof Error ? r.message : String(r), r;
      } finally {
        this._busy = !1;
      }
    }
  }
  async _loadAlexaListIfNeeded() {
    var i, s;
    if (!this.hass) return;
    const t = this._alexaEntityId;
    if (!t) return;
    const e = (i = this.hass.states[t]) == null ? void 0 : i.state;
    if (!(e === void 0 || e === "unavailable" || e === "unknown") && !(this._alexaLoaded && this._alexaLoadedFor === t)) {
      this._alexaLoaded = !0, this._alexaLoadedFor = t, this._alexaLoadError = void 0;
      try {
        const o = (await this.hass.callService(
          "todo",
          "get_items",
          { entity_id: t, status: ["needs_action"] },
          void 0,
          !1,
          !0
        )).response;
        this._alexaItems = ((s = o == null ? void 0 : o[t]) == null ? void 0 : s.items) ?? [];
      } catch (r) {
        this._alexaLoadError = r instanceof Error ? r.message : String(r), this._alexaItems = [];
      }
    }
  }
  async _refreshAlexa() {
    this._alexaLoaded = !1, this._alexaLoadedFor = void 0, this._alexaLoadError = void 0, await this._loadAlexaListIfNeeded();
  }
  // ---------- Acciones del carrito ----------------------------------------
  _incQty(t) {
    this._callService("mercadona", "set_quantity", {
      product_id: t.product_id,
      quantity: Math.round(t.quantity) + 1
    });
  }
  _decQty(t) {
    const e = Math.round(t.quantity) - 1;
    this._callService("mercadona", "set_quantity", {
      product_id: t.product_id,
      quantity: Math.max(e, 0)
    });
  }
  _removeLine(t) {
    this._callService("mercadona", "remove_product", { product_id: t.product_id });
  }
  // ---------- Acciones del area de pendientes -----------------------------
  async _moveToPending(t) {
    if (this._pending.some((i) => i.uid === t.uid)) return;
    const e = {
      uid: t.uid,
      summary: t.summary,
      quantity: null,
      // se rellena tras dry_run con recommended del producto
      resolution: null
    };
    this._pending = [...this._pending, e], await this._resolvePending(e);
  }
  async _moveAllToPending() {
    const t = this._alexaItems.filter(
      (i) => !this._pending.some((s) => s.uid === i.uid)
    );
    if (t.length === 0) return;
    const e = t.map((i) => ({
      uid: i.uid,
      summary: i.summary,
      quantity: null,
      resolution: null
    }));
    this._pending = [...this._pending, ...e], await this._resolveBulk(e);
  }
  async _resolvePending(t) {
    await this._resolveBulk([t]);
  }
  async _resolveBulk(t) {
    if (t.length !== 0)
      try {
        const e = await this._callService(
          "mercadona",
          "bulk_add",
          {
            // Si quantity es null, NO la mandamos: el backend usara
            // recommended_quantity del producto resuelto.
            items: t.map(
              (r) => r.quantity != null ? { name: r.summary, quantity: r.quantity } : { name: r.summary }
            ),
            dry_run: !0
          },
          !0
        );
        if (!e) return;
        const i = this._pending.map((r) => {
          if (!t.some((a) => a.uid === r.uid)) return r;
          const o = e.added.find((a) => a.query === r.summary);
          if (o) {
            const a = o.recommended_quantity ?? o.quantity ?? 1;
            return {
              ...r,
              resolution: {
                kind: "matched",
                productId: o.product_id,
                displayName: o.matched,
                recommendedQty: a
              },
              chosenProductId: o.product_id,
              // El backend ya aplico recommended si quantity era null.
              quantity: o.quantity
            };
          }
          const l = e.ambiguous.find((a) => a.query === r.summary);
          if (l) {
            const a = l.candidates[0];
            return {
              ...r,
              resolution: {
                kind: "ambiguous",
                candidates: l.candidates
              },
              chosenProductId: a == null ? void 0 : a.product_id,
              // Pre-rellena con el recommended del primer candidato.
              quantity: (a == null ? void 0 : a.recommended_quantity) ?? r.quantity ?? 1
            };
          }
          return e.not_found.includes(r.summary) ? { ...r, resolution: { kind: "not_found" } } : r;
        });
        this._pending = i;
        const s = i.filter(
          (r) => {
            var o;
            return t.some((l) => l.uid === r.uid) && ((o = r.resolution) == null ? void 0 : o.kind) === "matched";
          }
        );
        s.length > 0 && await this._commitItems(s);
      } catch {
      }
  }
  _setPendingQty(t, e) {
    this._pending = this._pending.map(
      (i) => i.uid === t ? { ...i, quantity: Math.max(1, e) } : i
    );
  }
  _setPendingChoice(t, e) {
    this._pending = this._pending.map((i) => {
      var s;
      if (i.uid !== t) return i;
      if (((s = i.resolution) == null ? void 0 : s.kind) === "ambiguous") {
        const r = i.resolution.candidates.find((o) => o.product_id === e);
        return {
          ...i,
          chosenProductId: e,
          quantity: (r == null ? void 0 : r.recommended_quantity) ?? i.quantity ?? 1
        };
      }
      return { ...i, chosenProductId: e };
    });
  }
  _removePending(t) {
    this._pending = this._pending.filter((e) => e.uid !== t);
  }
  async _commitItems(t) {
    const e = t.filter(
      (i) => i.chosenProductId && i.resolution && i.resolution.kind !== "not_found"
    );
    if (e.length !== 0)
      try {
        await this._callService("mercadona", "bulk_add", {
          items: e.map(
            (r) => (
              // Si p.quantity es null aun (improbable: solo se llega aqui
              // con resolucion ya hecha), dejamos que el backend resuelva
              // con recommended omitiendo la clave.
              r.quantity != null ? { product_id: r.chosenProductId, quantity: r.quantity } : { product_id: r.chosenProductId }
            )
          ),
          dry_run: !1
        });
        const i = this._alexaEntityId;
        i && this.hass && (await Promise.all(
          e.map(
            (r) => this.hass.callService(
              "todo",
              "update_item",
              { item: r.uid, status: "completed" },
              { entity_id: i },
              !1
            ).catch((o) => {
              console.warn(`No pude marcar '${r.summary}' como completado:`, o);
            })
          )
        ), await this._refreshAlexa());
        const s = new Set(e.map((r) => r.uid));
        this._pending = this._pending.filter((r) => !s.has(r.uid));
      } catch {
      }
  }
  // ---------- Render ------------------------------------------------------
  render() {
    if (!this.hass) return u;
    const t = this._getTotal(), e = Math.max(dt - t, 0), i = this._cartEntityId, s = i ? this.hass.states[i] : void 0;
    return c`
			<div class="panel">
				<header>
					<h1>Mercadona</h1>
					<div class="totals">
						<span class="total-amount">${t.toFixed(2)} €</span>
						<span class="total-status">
							${e > 0 ? c`Faltan <strong>${e.toFixed(2)} €</strong> para el minimo de ${dt} €` : c`Pedido minimo alcanzado`}
						</span>
					</div>
				</header>

				${this._error ? c`<div class="error">${this._error}</div>` : u}

				${s ? c`
							<div class="grid ${this.narrow ? "narrow" : ""}">
								${this._renderAlexaCol()}
								${this._renderCartCol()}
							</div>
						` : c`<div class="empty">
							No encuentro el sensor del carrito de Mercadona. Verifica que la integracion esta configurada.
						</div>`}
			</div>
		`;
  }
  _renderAlexaCol() {
    var l, a;
    const t = this._alexaEntityId, e = this._allTodoEntities, i = this._alexaItems, s = new Map(this._pending.map((d) => [d.uid, d])), r = this._pending.filter(
      (d) => d.chosenProductId && d.resolution && d.resolution.kind !== "not_found"
    ).length, o = i.filter((d) => !s.has(d.uid)).length;
    return c`
			<section class="col col-source">
				<div class="col-header">
					<h2>Lista pendiente</h2>
					<div class="col-actions">
						<button class="ghost" @click=${() => this._refreshAlexa()} ?disabled=${this._busy} title="Refrescar">↻</button>
						${o > 0 ? c`<button @click=${() => this._moveAllToPending()} ?disabled=${this._busy}>→ Resolver todos</button>` : u}
						${r > 0 ? c`<button class="primary" @click=${() => this._commitItems(this._pending)} ?disabled=${this._busy}>
									✓ Anadir ${r} al carrito
								</button>` : u}
					</div>
				</div>
				${e.length > 1 ? c`
							<div class="selector-row">
								<label>Lista:</label>
								<select
									@change=${(d) => this._setAlexaOverride(d.target.value)}
									?disabled=${this._busy}
								>
									${e.map(
      (d) => c`<option value="${d}" ?selected=${d === t}>${d}</option>`
    )}
								</select>
							</div>
						` : u}
				${t ? this._alexaLoadError ? c`<div class="placeholder">
								No se pudo cargar la lista <code>${t}</code>. Posiblemente este no disponible. Pulsa ↻ para reintentar.
								<div class="error-detail">${this._alexaLoadError}</div>
							</div>` : ((a = (l = this.hass) == null ? void 0 : l.states[t]) == null ? void 0 : a.state) === "unavailable" ? c`<div class="placeholder">La lista <code>${t}</code> esta no disponible.</div>` : i.length === 0 ? c`<div class="placeholder">Lista vacia.</div>` : c`
										<div class="alexa-rows">
											${i.map((d) => this._renderAlexaRow(d, s.get(d.uid)))}
										</div>
									` : c`<div class="placeholder">No encuentro ninguna entidad <code>todo.*</code>. Necesitas la integracion de listas de Alexa o equivalente.</div>`}
			</section>
		`;
  }
  _renderAlexaRow(t, e) {
    var s;
    const i = ((s = e == null ? void 0 : e.resolution) == null ? void 0 : s.kind) ?? (e ? "loading" : "idle");
    return c`
			<div class="alexa-row ${i}">
				<div class="alexa-name">${t.summary}</div>
				<div class="alexa-resolution">${this._renderResolutionInline(e)}</div>
				<div class="alexa-actions">${this._renderRowActions(t, e)}</div>
			</div>
		`;
  }
  _renderResolutionInline(t) {
    if (!t) return u;
    if (!t.resolution) return c`<span class="muted">resolviendo…</span>`;
    if (t.resolution.kind === "matched")
      return c`<span class="matched">${t.resolution.displayName}</span>`;
    if (t.resolution.kind === "not_found")
      return c`<span class="not-found">no encontrado en habituales</span>`;
    const e = t.resolution.candidates;
    return c`
			<select
				@change=${(i) => this._setPendingChoice(t.uid, i.target.value)}
				.value=${t.chosenProductId ?? ""}
				?disabled=${this._busy}
			>
				${e.map(
      (i) => c`<option value="${i.product_id}" ?selected=${i.product_id === t.chosenProductId}>${i.display_name}</option>`
    )}
			</select>
		`;
  }
  _renderRowActions(t, e) {
    if (!e)
      return c`
				<button class="row-btn" @click=${() => this._moveToPending(t)} ?disabled=${this._busy} title="Resolver">→</button>
			`;
    if (!e.resolution)
      return c`<button class="row-btn" disabled>⋯</button>`;
    if (e.resolution.kind === "not_found")
      return c`<button class="row-btn remove" @click=${() => this._removePending(e.uid)} title="Descartar">×</button>`;
    const i = e.quantity ?? 1, s = e.quantity != null;
    return c`
			<div class="qty-mini">
				<button @click=${() => this._setPendingQty(e.uid, i - 1)} ?disabled=${this._busy || !s || i <= 1}>−</button>
				<span>${s ? i : "—"}</span>
				<button @click=${() => this._setPendingQty(e.uid, i + 1)} ?disabled=${this._busy || !s}>+</button>
			</div>
			<button class="row-btn primary" @click=${() => this._commitItems([e])} ?disabled=${this._busy || !e.chosenProductId} title="Anadir al carrito">✓</button>
			<button class="row-btn remove" @click=${() => this._removePending(e.uid)} title="Descartar">×</button>
		`;
  }
  _renderCartCol() {
    const t = this._getLines();
    return c`
			<section class="col col-cart">
				<div class="col-header">
					<h2>Carrito (${t.length})</h2>
				</div>
				${t.length === 0 ? c`<div class="placeholder">Carrito vacio</div>` : c`<div class="lines">${t.map((e) => this._renderLine(e))}</div>`}
			</section>
		`;
  }
  _renderLine(t) {
    return c`
			<div class="line">
				${t.thumbnail ? c`<img class="thumb" src="${t.thumbnail}" alt="" />` : c`<div class="thumb placeholder-thumb"></div>`}
				<div class="info">
					<div class="name">${t.display_name}</div>
					<div class="price">${t.unit_price.toFixed(2)} € / ud</div>
				</div>
				<div class="qty">
					<button @click=${() => this._decQty(t)} ?disabled=${this._busy} aria-label="Restar">−</button>
					<span class="qty-value">${this._formatQty(t.quantity)}</span>
					<button @click=${() => this._incQty(t)} ?disabled=${this._busy} aria-label="Sumar">+</button>
				</div>
				<div class="line-total">${t.line_total.toFixed(2)} €</div>
				<button class="remove" @click=${() => this._removeLine(t)} ?disabled=${this._busy} aria-label="Eliminar">×</button>
			</div>
		`;
  }
  _formatQty(t) {
    return Number.isInteger(t) ? String(t) : t.toFixed(2).replace(/\.?0+$/, "");
  }
};
J.styles = yt`
		:host {
			display: block;
			min-height: 100vh;
			background: var(--primary-background-color);
			color: var(--primary-text-color);
		}
		.panel {
			max-width: 1400px;
			margin: 0 auto;
			padding: 24px;
		}
		header {
			display: flex;
			justify-content: space-between;
			align-items: flex-end;
			margin-bottom: 24px;
			padding-bottom: 12px;
			border-bottom: 1px solid var(--divider-color);
		}
		h1 {
			margin: 0;
			font-size: 1.8em;
			font-weight: 500;
		}
		.totals {
			text-align: right;
		}
		.total-amount {
			font-size: 1.8em;
			font-weight: 600;
			color: var(--primary-color);
			display: block;
		}
		.total-status {
			font-size: 0.9em;
			color: var(--secondary-text-color);
		}
		.error {
			background: var(--error-color, #b00020);
			color: white;
			padding: 12px;
			border-radius: 6px;
			margin-bottom: 16px;
		}
		.grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 24px;
		}
		.grid.narrow {
			grid-template-columns: 1fr;
		}
		.col {
			background: var(--card-background-color);
			border-radius: 8px;
			padding: 16px;
			box-shadow: var(--ha-card-box-shadow, 0 1px 3px rgba(0, 0, 0, 0.12));
		}
		.col-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 12px;
		}
		.col-header h2 {
			margin: 0;
			font-size: 1.1em;
			font-weight: 500;
			color: var(--secondary-text-color);
		}
		.col-actions {
			display: flex;
			gap: 6px;
		}
		button {
			border: 1px solid var(--divider-color);
			background: transparent;
			color: var(--primary-text-color);
			padding: 4px 10px;
			border-radius: 4px;
			cursor: pointer;
			font-size: 0.9em;
		}
		button:hover:not(:disabled) {
			background: var(--secondary-background-color);
		}
		button:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}
		button.ghost {
			border: none;
		}
		button.primary {
			background: var(--primary-color);
			color: white;
			border: none;
			padding: 8px 16px;
			font-weight: 500;
		}
		button.primary:hover:not(:disabled) {
			filter: brightness(1.1);
			background: var(--primary-color);
		}
		.placeholder {
			text-align: center;
			padding: 32px;
			color: var(--secondary-text-color);
			font-style: italic;
		}
		.error-detail {
			font-size: 0.8em;
			margin-top: 8px;
			color: var(--error-color, #b00020);
			font-family: monospace;
			word-break: break-word;
		}
		.empty {
			text-align: center;
			padding: 64px 16px;
			color: var(--secondary-text-color);
		}
		code {
			background: var(--secondary-background-color);
			padding: 2px 6px;
			border-radius: 3px;
			font-family: monospace;
		}

		/* Selector de lista */
		.selector-row {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 12px;
			font-size: 0.85em;
			color: var(--secondary-text-color);
		}
		.selector-row select {
			flex: 1;
		}

		/* Filas Alexa con resolucion inline */
		.alexa-rows {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		.alexa-row {
			display: grid;
			grid-template-columns: minmax(100px, max-content) 1fr auto;
			align-items: center;
			gap: 12px;
			padding: 8px 6px;
			border-bottom: 1px solid var(--divider-color);
			border-left: 3px solid transparent;
		}
		.alexa-row:last-child {
			border-bottom: none;
		}
		.alexa-row.matched {
			border-left-color: var(--success-color, #43a047);
		}
		.alexa-row.ambiguous {
			border-left-color: var(--warning-color, #ff9800);
		}
		.alexa-row.not_found {
			border-left-color: var(--error-color, #b00020);
			opacity: 0.7;
		}
		.alexa-row.loading {
			border-left-color: var(--secondary-text-color);
		}
		.alexa-name {
			font-weight: 500;
		}
		.alexa-resolution {
			min-width: 0;
			color: var(--secondary-text-color);
		}
		.alexa-resolution select {
			width: 100%;
		}
		.alexa-actions {
			display: flex;
			align-items: center;
			gap: 4px;
		}
		.row-btn {
			width: 32px;
			height: 32px;
			padding: 0;
			border-radius: 50%;
			border: 1px solid var(--divider-color);
			background: transparent;
			color: var(--primary-text-color);
			cursor: pointer;
			font-size: 1.1em;
			line-height: 1;
		}
		.row-btn:hover:not(:disabled) {
			background: var(--secondary-background-color);
		}
		.row-btn.primary {
			border-color: var(--primary-color);
			color: var(--primary-color);
		}
		.row-btn.primary:hover:not(:disabled) {
			background: var(--primary-color);
			color: white;
		}
		.row-btn.remove {
			border-color: transparent;
			color: var(--secondary-text-color);
		}
		.row-btn.remove:hover:not(:disabled) {
			background: var(--error-color, #b00020);
			color: white;
		}
		.qty-mini {
			display: flex;
			align-items: center;
			gap: 2px;
			margin-right: 4px;
		}
		.qty-mini button {
			width: 24px;
			height: 24px;
			padding: 0;
			border-radius: 50%;
			border: 1px solid var(--divider-color);
			background: transparent;
			color: var(--primary-text-color);
			cursor: pointer;
			line-height: 1;
		}
		.qty-mini button:hover:not(:disabled) {
			background: var(--secondary-background-color);
		}
		.qty-mini button:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}
		.qty-mini span {
			min-width: 20px;
			text-align: center;
			font-weight: 500;
		}
		.matched {
			color: var(--success-color, #43a047);
		}
		.not-found {
			color: var(--error-color, #b00020);
			font-style: italic;
		}
		.muted {
			color: var(--secondary-text-color);
			font-style: italic;
		}

		/* Lineas del carrito */
		.lines {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		.line {
			display: grid;
			grid-template-columns: 48px 1fr auto auto auto;
			align-items: center;
			gap: 12px;
			padding: 8px 0;
			border-bottom: 1px solid var(--divider-color);
		}
		.line:last-child {
			border-bottom: none;
		}
		.thumb {
			width: 48px;
			height: 48px;
			border-radius: 4px;
			object-fit: cover;
			background: var(--secondary-background-color);
		}
		.thumb.placeholder-thumb {
			border: 1px dashed var(--divider-color);
		}
		.info {
			min-width: 0;
		}
		.name {
			font-weight: 500;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.price {
			font-size: 0.85em;
			color: var(--secondary-text-color);
		}
		.qty {
			display: flex;
			align-items: center;
			gap: 4px;
		}
		.qty button {
			width: 28px;
			height: 28px;
			padding: 0;
			border-radius: 50%;
			font-size: 1.1em;
			line-height: 1;
		}
		.qty-value {
			min-width: 24px;
			text-align: center;
			font-weight: 500;
		}
		.line-total {
			font-weight: 500;
			min-width: 70px;
			text-align: right;
		}
		.remove {
			width: 28px;
			height: 28px;
			padding: 0;
			border: none;
			background: transparent;
			color: var(--secondary-text-color);
			font-size: 1.2em;
			border-radius: 50%;
		}
		.remove:hover:not(:disabled) {
			background: var(--error-color, #b00020);
			color: white;
		}

		select {
			padding: 4px 8px;
			border: 1px solid var(--divider-color);
			border-radius: 4px;
			background: var(--card-background-color);
			color: var(--primary-text-color);
			font-size: 0.95em;
			max-width: 100%;
		}
	`;
let _ = J;
m([
  T({ attribute: !1 })
], _.prototype, "hass");
m([
  T({ type: Boolean })
], _.prototype, "narrow");
m([
  T({ attribute: !1 })
], _.prototype, "route");
m([
  T({ attribute: !1 })
], _.prototype, "panel");
m([
  $()
], _.prototype, "_busy");
m([
  $()
], _.prototype, "_error");
m([
  $()
], _.prototype, "_alexaItems");
m([
  $()
], _.prototype, "_alexaLoaded");
m([
  $()
], _.prototype, "_alexaLoadedFor");
m([
  $()
], _.prototype, "_alexaLoadError");
m([
  $()
], _.prototype, "_pending");
m([
  $()
], _.prototype, "_alexaOverride");
customElements.get(ct) || customElements.define(ct, _);
console.info(
  `%c MERCADONA-PANEL %c v${zt} `,
  "color: white; background: #169B62; font-weight: 700;",
  "color: #169B62; background: white; font-weight: 700;"
);
export {
  _ as MercadonaPanel
};

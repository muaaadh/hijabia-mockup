/* ============================================================
   Hijabia storefront logic
   ============================================================ */
(function () {
  "use strict";

  const PRODUCTS = window.HIJABIA_PRODUCTS || [];
  const MEDIA = window.HIJABIA_MEDIA || {};
  const FREE_SHIP = 99;
  const STD_SHIP = 7;
  const TAX_RATE = 0.05;
  const MAX_QTY = 10;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const money = (n) => "$" + (Math.round(n * 100) / 100).toFixed(2);
  function isLight(hex) {
    const c = (hex || "").replace("#", "");
    const h = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
    const r = parseInt(h.slice(0, 2), 16) || 0, g = parseInt(h.slice(2, 4), 16) || 0, b = parseInt(h.slice(4, 6), 16) || 0;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
  }

  /* ---------- image helpers + graceful fallback ---------- */
  function withParams(base, w) {
    if (!base) return "";
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}auto=format&fit=crop&w=${w}&q=80`;
  }
  function setMedia(img, base, w, container, label, color) {
    img.src = withParams(base, w);
    img.addEventListener("error", function onErr() {
      img.removeEventListener("error", onErr);
      if (container) {
        container.classList.add("is-fallback");
        if (label) container.setAttribute("data-label", label);
        if (color) container.style.setProperty("--fallback", color);
      } else {
        img.style.display = "none";
        if (img.parentElement) img.parentElement.style.background = color || "var(--panel)";
      }
    }, { once: true });
  }

  /* ---------- colour + fabric bucketing for filters ---------- */
  function hexToHsl(hex) {
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map((x) => x + x).join("");
    const r = parseInt(c.slice(0, 2), 16) / 255;
    const g = parseInt(c.slice(2, 4), 16) / 255;
    const b = parseInt(c.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h *= 60;
    }
    return { h, s, l };
  }
  function colorFamily(hex) {
    const { h, s, l } = hexToHsl(hex);
    if (l > 0.86 && s < 0.3) return "Ivory";
    if (l < 0.16) return "Black";
    if (s < 0.16) return "Grey";
    if (h < 15 || h >= 345) return l < 0.4 ? "Burgundy" : "Rose";
    if (h < 45) return s < 0.5 ? "Camel" : "Rust";
    if (h < 70) return "Gold";
    if (h < 160) return "Green";
    if (h < 200) return "Teal";
    if (h < 255) return "Blue";
    if (h < 300) return "Purple";
    return l < 0.4 ? "Purple" : "Rose";
  }
  const COLOR_ORDER = ["Ivory", "Rose", "Burgundy", "Rust", "Camel", "Gold", "Green", "Teal", "Blue", "Purple", "Grey", "Black"];
  const COLOR_SWATCH = {
    Ivory: "#ECE5D8", Rose: "#C48B8B", Burgundy: "#6E2C3A", Rust: "#A9542E", Camel: "#B58B5A",
    Gold: "#D9A865", Green: "#5E6B3B", Teal: "#2E6B6B", Blue: "#27496D", Purple: "#5A4374",
    Grey: "#8C8881", Black: "#1A1A1C"
  };

  function fabricFamily(fabric) {
    const f = (fabric || "").toLowerCase();
    if (/lace|embroider|bead|sequin|embellish/.test(f)) return "Lace & Embellished";
    if (/satin|silk|charmeuse/.test(f)) return "Satin & Silk";
    if (/chiffon|georgette|organza/.test(f)) return "Chiffon & Georgette";
    if (/linen|cotton/.test(f)) return "Linen & Cotton";
    if (/nidha|crepe|crêpe/.test(f)) return "Nidha & Crepe";
    if (/jersey|knit|modal|viscose/.test(f)) return "Jersey & Knit";
    return "Other";
  }
  const FABRIC_ORDER = ["Nidha & Crepe", "Satin & Silk", "Chiffon & Georgette", "Linen & Cotton", "Lace & Embellished", "Jersey & Knit", "Other"];
  const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "52\"", "54\"", "56\"", "58\"", "60\""];

  // precompute facets on products
  PRODUCTS.forEach((p) => {
    p._families = [...new Set(p.colors.map((c) => colorFamily(c.hex)))];
    p._fabricFamily = fabricFamily(p.fabric);
  });

  /* ---------- state ---------- */
  const state = {
    f: { categories: new Set(), colors: new Set(), sizes: new Set(), fabrics: new Set(), min: null, max: null, q: "" },
    sort: "featured",
    cart: load()
  };
  function load() {
    try {
      const v = JSON.parse(localStorage.getItem("hijabia_cart"));
      if (!Array.isArray(v)) return [];
      return v
        .filter((l) => l && Number.isFinite(+l.id) && findProduct(+l.id) && Number.isFinite(+l.qty) && +l.qty > 0)
        .map((l) => ({ id: +l.id, color: String(l.color || ""), size: String(l.size || ""), qty: Math.min(MAX_QTY, Math.max(1, Math.floor(+l.qty))) }));
    } catch (e) { return []; }
  }
  function save() {
    try { localStorage.setItem("hijabia_cart", JSON.stringify(state.cart)); } catch (e) {}
  }

  /* ---------- scroll lock ---------- */
  let lockCount = 0;
  function lock() { lockCount++; document.body.style.overflow = "hidden"; }
  function unlock() { lockCount = Math.max(0, lockCount - 1); if (!lockCount) document.body.style.overflow = ""; }

  /* ---------- focus management ---------- */
  let lastFocused = null;
  const FOCUSABLE = 'button, [href], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])';
  function rememberFocus() { lastFocused = document.activeElement; }
  function focusFirst(container, preferred) {
    const target = (preferred && $(preferred, container)) ||
      $$(FOCUSABLE, container).find((el) => el.offsetParent !== null && !el.disabled);
    if (target) setTimeout(() => { try { target.focus(); } catch (e) {} }, 60);
  }
  function restoreFocus() {
    if (lastFocused && lastFocused.focus) { try { lastFocused.focus(); } catch (e) {} }
    lastFocused = null;
  }

  /* ============================================================
     Filters UI
     ============================================================ */
  function activeCount() {
    const f = state.f;
    return f.categories.size + f.colors.size + f.sizes.size + f.fabrics.size + (f.min != null ? 1 : 0) + (f.max != null ? 1 : 0);
  }

  function buildFilters() {
    // category
    const cats = ["Abaya", "Kaftan", "Kimono"];
    $("#filterCategory").innerHTML = cats.map((c) => {
      const n = PRODUCTS.filter((p) => p.category === c).length;
      return checkRow("cat", c, c + "s", n);
    }).join("");

    // colours present
    const present = new Set();
    PRODUCTS.forEach((p) => p._families.forEach((fam) => present.add(fam)));
    const colorHtml = COLOR_ORDER.filter((c) => present.has(c)).map((c) => {
      const lt = isLight(COLOR_SWATCH[c]);
      return `<button type="button" class="swatch" data-color="${c}" title="${c}" aria-label="${c}" style="background:${COLOR_SWATCH[c]}"${lt ? ' data-light="1"' : ""}>
        <span class="swatch__check"><svg viewBox="0 0 24 24" style="stroke:${lt ? "#2a2320" : "#fff"}"><path d="M5 13l4 4L19 7"/></svg></span></button>`;
    }).join("");
    $("#filterColor").innerHTML = colorHtml;

    // sizes present
    const sizes = new Set();
    PRODUCTS.forEach((p) => p.sizes.forEach((s) => sizes.add(s)));
    $("#filterSize").innerHTML = SIZE_ORDER.filter((s) => sizes.has(s))
      .map((s) => `<button type="button" class="chip" data-size="${s}">${s}</button>`).join("");

    // fabrics present
    const fabs = new Set();
    PRODUCTS.forEach((p) => fabs.add(p._fabricFamily));
    $("#filterFabric").innerHTML = FABRIC_ORDER.filter((f) => fabs.has(f)).map((f) => {
      const n = PRODUCTS.filter((p) => p._fabricFamily === f).length;
      return checkRow("fab", f, f, n);
    }).join("");
  }
  function checkRow(group, val, label, count) {
    return `<label class="check"><input type="checkbox" data-group="${group}" value="${val}">
      <span class="check__box"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg></span>
      <span>${label}</span><span class="check__count">${count}</span></label>`;
  }

  function wireFilters() {
    $("#filterCategory").addEventListener("change", onCheck);
    $("#filterFabric").addEventListener("change", onCheck);
    $("#filterColor").addEventListener("click", (e) => {
      const b = e.target.closest(".swatch"); if (!b) return;
      const c = b.dataset.color; toggle(state.f.colors, c); b.classList.toggle("is-active");
      render();
    });
    $("#filterSize").addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      const s = b.dataset.size; toggle(state.f.sizes, s); b.classList.toggle("is-active");
      render();
    });
    $("#priceMin").addEventListener("input", (e) => { state.f.min = e.target.value === "" ? null : Math.max(0, +e.target.value); render(); });
    $("#priceMax").addEventListener("input", (e) => { state.f.max = e.target.value === "" ? null : Math.max(0, +e.target.value); render(); });
    $("#sortSelect").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
    $("#clearFilters").addEventListener("click", clearAll);
    $("#emptyClear").addEventListener("click", clearAll);
  }
  function onCheck(e) {
    const cb = e.target; if (cb.type !== "checkbox") return;
    const set = cb.dataset.group === "cat" ? state.f.categories : state.f.fabrics;
    if (cb.checked) set.add(cb.value); else set.delete(cb.value);
    render();
  }
  function toggle(set, v) { set.has(v) ? set.delete(v) : set.add(v); }

  function clearAll() {
    state.f.categories.clear(); state.f.colors.clear(); state.f.sizes.clear(); state.f.fabrics.clear();
    state.f.min = null; state.f.max = null; state.f.q = "";
    $("#priceMin").value = ""; $("#priceMax").value = "";
    syncFilterUI();
    render();
  }
  function syncFilterUI() {
    $$("#filterCategory input, #filterFabric input").forEach((cb) => {
      cb.checked = (cb.dataset.group === "cat" ? state.f.categories : state.f.fabrics).has(cb.value);
    });
    $$("#filterColor .swatch").forEach((b) => b.classList.toggle("is-active", state.f.colors.has(b.dataset.color)));
    $$("#filterSize .chip").forEach((b) => b.classList.toggle("is-active", state.f.sizes.has(b.dataset.size)));
  }

  /* ============================================================
     Filtering + render
     ============================================================ */
  function filtered() {
    const f = state.f;
    const q = f.q.trim().toLowerCase();
    let list = PRODUCTS.filter((p) => {
      if (f.categories.size && !f.categories.has(p.category)) return false;
      if (f.colors.size && !p._families.some((x) => f.colors.has(x))) return false;
      if (f.sizes.size && !p.sizes.some((x) => f.sizes.has(x))) return false;
      if (f.fabrics.size && !f.fabrics.has(p._fabricFamily)) return false;
      if (f.min != null && p.price < f.min) return false;
      if (f.max != null && p.price > f.max) return false;
      if (q) {
        const hay = (p.name + " " + p.category + " " + p.fabric + " " + p.description + " " + p.colors.map((c) => c.name).join(" ")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    switch (state.sort) {
      case "price-asc": list.sort((a, b) => a.price - b.price); break;
      case "price-desc": list.sort((a, b) => b.price - a.price); break;
      case "name-asc": list.sort((a, b) => a.name.localeCompare(b.name)); break;
    }
    return list;
  }

  const tpl = $("#cardTpl");
  function render() {
    const list = filtered();
    const grid = $("#productGrid");
    grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    list.forEach((p) => frag.appendChild(card(p)));
    grid.appendChild(frag);

    $("#emptyState").hidden = list.length !== 0;
    $("#resultCount").textContent = list.length === PRODUCTS.length
      ? `${list.length} pieces`
      : `${list.length} of ${PRODUCTS.length} pieces`;

    const n = activeCount();
    const pill = $("#filterPill");
    pill.hidden = n === 0; pill.textContent = n;
    renderChips();
    syncFilterUI();
  }

  function card(p) {
    const el = tpl.content.firstElementChild.cloneNode(true);
    const media = $(".card__media", el);
    const img = $(".card__img", el);
    img.alt = p.alt;
    setMedia(img, p.image, 600, media, p.name, p.colors[0].hex);
    $(".card__badge", el).textContent = p.badge || "";
    $(".card__cat", el).textContent = p.category;
    $(".card__name", el).textContent = p.name;
    $(".card__price", el).textContent = "$" + p.price;
    // swatches
    const sw = $(".card__swatches", el);
    p.colors.slice(0, 4).forEach((c) => {
      const s = document.createElement("span"); s.className = "card__swatch";
      s.style.background = c.hex; s.title = c.name; sw.appendChild(s);
    });
    if (p.colors.length > 4) {
      const more = document.createElement("span"); more.className = "card__swatch--more";
      more.textContent = "+" + (p.colors.length - 4); sw.appendChild(more);
    }
    $(".card__quick", el).addEventListener("click", () => openQuickView(p));
    media.addEventListener("click", (e) => { if (e.target.closest(".card__quick")) return; openQuickView(p); });
    $(".card__add", el).addEventListener("click", (e) => {
      e.stopPropagation();
      addToCart(p, p.colors[0].name, p.sizes[0], 1, false);
      bump($(".card__add", el));
    });
    return el;
  }

  function renderChips() {
    const wrap = $("#activeChips");
    const chips = [];
    const f = state.f;
    f.categories.forEach((c) => chips.push(chip(c + "s", () => { f.categories.delete(c); render(); })));
    f.colors.forEach((c) => chips.push(chip(c, () => { f.colors.delete(c); render(); })));
    f.sizes.forEach((s) => chips.push(chip(s, () => { f.sizes.delete(s); render(); })));
    f.fabrics.forEach((x) => chips.push(chip(x, () => { f.fabrics.delete(x); render(); })));
    if (f.min != null) chips.push(chip("Min $" + f.min, () => { f.min = null; $("#priceMin").value = ""; render(); }));
    if (f.max != null) chips.push(chip("Max $" + f.max, () => { f.max = null; $("#priceMax").value = ""; render(); }));
    wrap.innerHTML = "";
    if (!chips.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    chips.forEach((c) => wrap.appendChild(c));
    const clr = document.createElement("button");
    clr.className = "active-chip active-chip--clear"; clr.textContent = "Clear all";
    clr.addEventListener("click", clearAll); wrap.appendChild(clr);
  }
  function chip(label, onRemove) {
    const b = document.createElement("span"); b.className = "active-chip";
    b.innerHTML = `<span>${label}</span><button aria-label="Remove ${label}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
    $("button", b).addEventListener("click", onRemove);
    return b;
  }

  /* ============================================================
     Cart
     ============================================================ */
  function findProduct(id) { return PRODUCTS.find((p) => p.id === id); }
  function lineKey(id, color, size) { return id + "|" + color + "|" + size; }

  function addToCart(p, color, size, qty, openDrawer) {
    const key = lineKey(p.id, color, size);
    const line = state.cart.find((l) => lineKey(l.id, l.color, l.size) === key);
    if (line) line.qty = Math.min(MAX_QTY, line.qty + qty);
    else state.cart.push({ id: p.id, color, size, qty: Math.min(MAX_QTY, Math.max(1, qty)) });
    save(); renderCart();
    toast(`Added to bag · ${p.name}`);
    if (openDrawer) openCart();
  }
  function setQty(idx, delta) {
    const l = state.cart[idx]; if (!l) return;
    l.qty = Math.min(MAX_QTY, l.qty + delta);
    if (l.qty <= 0) state.cart.splice(idx, 1);
    save(); renderCart();
  }
  function removeLine(idx) { state.cart.splice(idx, 1); save(); renderCart(); }
  function cartCount() { return state.cart.reduce((n, l) => n + l.qty, 0); }
  function subtotal() { return state.cart.reduce((s, l) => { const p = findProduct(l.id); return s + (p ? p.price * l.qty : 0); }, 0); }

  function renderCart() {
    const count = cartCount();
    const badge = $("#cartCount"); badge.textContent = count; badge.dataset.count = count;
    const cartEl = $("#cart"); cartEl.classList.toggle("is-empty", count === 0);
    $("#cartItemsLabel").textContent = count ? `· ${count} item${count > 1 ? "s" : ""}` : "";

    const body = $("#cartBody"); body.innerHTML = "";
    state.cart.forEach((l, i) => {
      const p = findProduct(l.id); if (!p) return;
      const row = document.createElement("div"); row.className = "cart-line";
      row.innerHTML = `
        <img class="cart-line__img" alt="${p.alt}">
        <div class="cart-line__main">
          <span class="cart-line__name">${p.name}</span>
          <span class="cart-line__meta">${l.color} · ${l.size}</span>
          <div class="cart-line__qty">
            <button data-act="dec" aria-label="Decrease">−</button>
            <span>${l.qty}</span>
            <button data-act="inc" aria-label="Increase">+</button>
          </div>
        </div>
        <div class="cart-line__right">
          <span class="cart-line__price">${money(p.price * l.qty)}</span>
          <button class="cart-line__remove" data-act="rm">Remove</button>
        </div>`;
      const img = $(".cart-line__img", row);
      img.src = withParams(p.image, 160);
      img.addEventListener("error", () => { img.style.background = p.colors[0].hex; img.removeAttribute("src"); }, { once: true });
      $('[data-act="dec"]', row).addEventListener("click", () => setQty(i, -1));
      $('[data-act="inc"]', row).addEventListener("click", () => setQty(i, 1));
      $('[data-act="rm"]', row).addEventListener("click", () => removeLine(i));
      body.appendChild(row);
    });

    const sub = subtotal();
    $("#cartSubtotal").textContent = money(sub);
    // free shipping progress
    const free = $("#cartFree");
    if (count === 0) { free.hidden = true; }
    else {
      free.hidden = false;
      if (sub >= FREE_SHIP) {
        free.innerHTML = `<strong>You've unlocked free shipping 🎉</strong>`;
      } else {
        const pct = Math.min(100, (sub / FREE_SHIP) * 100);
        free.innerHTML = `Add <strong>${money(FREE_SHIP - sub)}</strong> for free shipping<div class="bar"><i style="width:${pct}%"></i></div>`;
      }
    }
  }

  /* ============================================================
     Quick view
     ============================================================ */
  let qv = { p: null, color: null, size: null, qty: 1 };
  function openQuickView(p) {
    rememberFocus();
    qv = { p, color: p.colors[0].name, size: p.sizes[0], qty: 1 };
    const media = $(".quickview__media");
    media.classList.remove("is-fallback");
    const img = $("#qvImg"); img.alt = p.alt;
    setMedia(img, p.image, 800, media, p.name, p.colors[0].hex);
    $("#qvCat").textContent = p.category;
    $("#qvName").textContent = p.name;
    $("#qvPrice").textContent = "$" + p.price;
    $("#qvDesc").textContent = p.description;
    $("#qvColorName").textContent = qv.color;
    // colours
    $("#qvColors").innerHTML = p.colors.map((c, i) => {
      const lt = isLight(c.hex);
      return `<button type="button" class="swatch${i === 0 ? " is-active" : ""}" data-color="${c.name}" title="${c.name}" aria-label="${c.name}" style="background:${c.hex}"${lt ? ' data-light="1"' : ""}>
        <span class="swatch__check"><svg viewBox="0 0 24 24" style="stroke:${lt ? "#2a2320" : "#fff"}"><path d="M5 13l4 4L19 7"/></svg></span></button>`;
    }).join("");
    $$("#qvColors .swatch").forEach((b) => b.addEventListener("click", () => {
      qv.color = b.dataset.color; $("#qvColorName").textContent = qv.color;
      $$("#qvColors .swatch").forEach((x) => x.classList.toggle("is-active", x === b));
    }));
    // sizes
    $("#qvSizes").innerHTML = p.sizes.map((s, i) => `<button type="button" class="chip${i === 0 ? " is-active" : ""}" data-size="${s}">${s}</button>`).join("");
    $$("#qvSizes .chip").forEach((b) => b.addEventListener("click", () => {
      qv.size = b.dataset.size; $$("#qvSizes .chip").forEach((x) => x.classList.toggle("is-active", x === b));
    }));
    $("#qvQty").textContent = "1";
    // meta
    $("#qvMeta").innerHTML = [`${p.fabric}`, "Fully lined finish", "Free shipping over $99", "30-day returns"].map((m) => `<li>${m}</li>`).join("");

    $("#quickView").classList.add("is-open");
    $("#quickView").setAttribute("aria-hidden", "false");
    lock();
    focusFirst($("#quickView"), "#qvClose");
  }
  function closeQuickView() {
    if (!$("#quickView").classList.contains("is-open")) return;
    $("#quickView").classList.remove("is-open");
    $("#quickView").setAttribute("aria-hidden", "true");
    unlock();
    restoreFocus();
  }
  function wireQuickView() {
    $("#qvClose").addEventListener("click", closeQuickView);
    $("#quickView").addEventListener("click", (e) => { if (e.target === $("#quickView")) closeQuickView(); });
    $("#qvMinus").addEventListener("click", () => { qv.qty = Math.max(1, qv.qty - 1); $("#qvQty").textContent = qv.qty; });
    $("#qvPlus").addEventListener("click", () => { qv.qty = Math.min(10, qv.qty + 1); $("#qvQty").textContent = qv.qty; });
    $("#qvAdd").addEventListener("click", () => {
      addToCart(qv.p, qv.color, qv.size, qv.qty, true);
      closeQuickView();
    });
  }

  /* ============================================================
     Drawers / overlays
     ============================================================ */
  const overlay = $("#overlay");
  function syncOverlay() {
    const anyLeft = $("#mobileNav").classList.contains("is-open") || $("#filters").classList.contains("is-open") || $("#cart").classList.contains("is-open");
    overlay.hidden = !anyLeft;
  }
  function openCart() {
    if ($("#cart").classList.contains("is-open")) return;
    rememberFocus();
    $("#cart").classList.add("is-open"); $("#cart").setAttribute("aria-hidden", "false");
    syncOverlay(); lock(); focusFirst($("#cart"), "#cartClose");
  }
  function closeCart() {
    if (!$("#cart").classList.contains("is-open")) return;
    $("#cart").classList.remove("is-open"); $("#cart").setAttribute("aria-hidden", "true");
    syncOverlay(); unlock(); restoreFocus();
  }
  function openMobileNav() {
    if ($("#mobileNav").classList.contains("is-open")) return;
    rememberFocus();
    $("#mobileNav").classList.add("is-open"); $("#mobileNav").setAttribute("aria-hidden", "false");
    $("#menuBtn").setAttribute("aria-expanded", "true"); syncOverlay(); lock(); focusFirst($("#mobileNav"), "#menuClose");
  }
  function closeMobileNav() {
    if (!$("#mobileNav").classList.contains("is-open")) return;
    $("#mobileNav").classList.remove("is-open"); $("#mobileNav").setAttribute("aria-hidden", "true");
    $("#menuBtn").setAttribute("aria-expanded", "false"); syncOverlay(); unlock(); restoreFocus();
  }
  function openFilters() {
    if ($("#filters").classList.contains("is-open")) return;
    rememberFocus();
    $("#filters").classList.add("is-open"); $("#filters").setAttribute("aria-hidden", "false");
    syncOverlay(); lock(); focusFirst($("#filters"), "#closeFilters");
  }
  function closeFilters() {
    if (!$("#filters").classList.contains("is-open")) return;
    $("#filters").classList.remove("is-open"); $("#filters").setAttribute("aria-hidden", "true");
    syncOverlay(); unlock(); restoreFocus();
  }
  function openSearch() {
    if ($("#searchOverlay").classList.contains("is-open")) return;
    rememberFocus();
    const o = $("#searchOverlay"); o.classList.add("is-open"); o.setAttribute("aria-hidden", "false");
    lock(); setTimeout(() => $("#searchInput").focus(), 60);
  }
  function closeSearch() {
    if (!$("#searchOverlay").classList.contains("is-open")) return;
    const o = $("#searchOverlay"); o.classList.remove("is-open"); o.setAttribute("aria-hidden", "true");
    unlock(); restoreFocus();
  }

  /* ============================================================
     Checkout
     ============================================================ */
  let checkout = { step: 1, ship: 0, shipLabel: "Free" };
  function openCheckout() {
    if (!cartCount()) { toast("Your bag is empty"); return; }
    checkout = { step: 1, ship: 0, shipLabel: "Free" };
    ["#formInfo", "#formShip", "#formPay"].forEach((s) => { const f = $(s); if (f && f.reset) f.reset(); });
    $$("#checkout .field.invalid").forEach((f) => f.classList.remove("invalid"));
    $$("#checkout .err").forEach((e) => (e.textContent = ""));
    const std = $('#shipOptions input[value="standard"]'); if (std) std.checked = true;
    refreshShipping();
    closeCart();
    rememberFocus();
    buildSummary();
    gotoStep(1);
    $("#checkout").classList.add("is-open");
    $("#checkout").setAttribute("aria-hidden", "false");
    lock();
    $("#checkout").scrollTop = 0;
    focusFirst($("#checkout"), "#ckEmail");
  }
  function closeCheckout() {
    if (!$("#checkout").classList.contains("is-open")) return;
    $("#checkout").classList.remove("is-open");
    $("#checkout").setAttribute("aria-hidden", "true");
    unlock();
    restoreFocus();
  }
  function refreshShipping() {
    const sub = subtotal();
    const base = sub >= FREE_SHIP ? 0 : STD_SHIP;
    const std = $('#shipOptions input[value="standard"]');
    if (std) {
      std.dataset.price = base;
      const opt = std.closest(".ship-opt");
      const priceEl = opt && opt.querySelector(".ship-opt__price");
      if (priceEl) priceEl.textContent = base === 0 ? "Free" : money(base);
    }
    const checked = $('#shipOptions input:checked');
    checkout.ship = checked ? +checked.dataset.price : base;
  }
  function gotoStep(n) {
    checkout.step = n;
    $$(".cstep").forEach((s) => s.classList.toggle("is-active", +s.dataset.step === n));
    $$("#steps li").forEach((li) => {
      const s = +li.dataset.step;
      li.classList.toggle("is-active", s === n);
      li.classList.toggle("is-done", s < n);
    });
    $("#checkout").scrollTop = 0;
  }
  function buildSummary() {
    const box = $("#osumItems"); box.innerHTML = "";
    state.cart.forEach((l) => {
      const p = findProduct(l.id); if (!p) return;
      const row = document.createElement("div"); row.className = "osum-line";
      row.innerHTML = `
        <div style="position:relative"><img class="osum-line__img" alt="${p.alt}"><span class="osum-line__qty">${l.qty}</span></div>
        <div style="min-width:0"><div class="osum-line__name">${p.name}</div><div class="osum-line__meta">${l.color} · ${l.size}</div></div>
        <div class="osum-line__price">${money(p.price * l.qty)}</div>`;
      const img = $(".osum-line__img", row);
      img.src = withParams(p.image, 120);
      img.addEventListener("error", () => { img.style.background = p.colors[0].hex; img.removeAttribute("src"); }, { once: true });
      box.appendChild(row);
    });
    updateTotals();
  }
  function updateTotals() {
    const sub = subtotal();
    const ship = checkout.ship || 0;
    const tax = Math.round(sub * TAX_RATE * 100) / 100;
    const total = sub + ship + tax;
    $("#osumSubtotal").textContent = money(sub);
    $("#osumShip").textContent = ship === 0 ? "Free" : money(ship);
    $("#osumTax").textContent = money(tax);
    $("#osumTotal").textContent = money(total);
    return { sub, ship, tax, total };
  }

  // validation
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function setErr(field, msg) {
    field.classList.toggle("invalid", !!msg);
    const e = $(".err", field); if (e) e.textContent = msg || "";
  }
  function validateInput(input) {
    const field = input.closest(".field");
    if (!field) return true; // radios / controls outside a .field wrapper
    const v = input.value.trim();
    if (input.required && !v) { setErr(field, "Required"); return false; }
    if (input.type === "email" && v && !EMAIL_RE.test(v)) { setErr(field, "Enter a valid email"); return false; }
    if (input.id === "ckCard" && v && v.replace(/\s/g, "").length < 15) { setErr(field, "Enter a valid card number"); return false; }
    if (input.id === "ckExp" && v) {
      if (!/^\d{2}\/\d{2}$/.test(v)) { setErr(field, "Use MM/YY"); return false; }
      const mm = +v.slice(0, 2), yy = +v.slice(3, 5);
      if (mm < 1 || mm > 12) { setErr(field, "Invalid month"); return false; }
      const now = new Date(), curYY = now.getFullYear() % 100, curMM = now.getMonth() + 1;
      if (yy < curYY || (yy === curYY && mm < curMM)) { setErr(field, "Card has expired"); return false; }
    }
    if (input.id === "ckCvc" && v && !/^\d{3,4}$/.test(v)) { setErr(field, "3–4 digits"); return false; }
    setErr(field, ""); return true;
  }
  function validateForm(form) {
    let ok = true; let firstBad = null;
    $$("input, select", form).forEach((inp) => {
      if (!validateInput(inp)) { ok = false; if (!firstBad) firstBad = inp; }
    });
    if (firstBad) firstBad.focus();
    return ok;
  }

  function wireCheckout() {
    $("#checkoutClose").addEventListener("click", closeCheckout);
    $("#backToCart").addEventListener("click", () => { closeCheckout(); openCart(); });
    $$('[data-goto]').forEach((b) => b.addEventListener("click", () => gotoStep(+b.dataset.goto)));

    $("#formInfo").addEventListener("submit", (e) => { e.preventDefault(); if (validateForm(e.target)) gotoStep(2); });
    $("#formShip").addEventListener("submit", (e) => { e.preventDefault(); gotoStep(3); });
    $("#shipOptions").addEventListener("change", (e) => {
      const r = e.target; if (r.name !== "ship") return;
      checkout.ship = +r.dataset.price; updateTotals();
    });
    $("#formPay").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validateForm(e.target)) return;
      const btn = $("#payBtn"); btn.disabled = true; btn.textContent = "Processing…";
      setTimeout(() => {
        btn.disabled = false; btn.textContent = "Pay now";
        completeOrder();
      }, 1100);
    });

    // live validation on blur (skip the shipping radios, which live outside a .field)
    $$('#checkout input:not([type=radio]), #checkout select').forEach((inp) => {
      inp.addEventListener("blur", () => validateInput(inp));
      inp.addEventListener("input", () => { const fld = inp.closest(".field"); if (fld && fld.classList.contains("invalid")) validateInput(inp); });
    });
    // formatting
    $("#ckCard").addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 16);
      e.target.value = v.replace(/(.{4})/g, "$1 ").trim();
    });
    $("#ckExp").addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 4);
      if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
      e.target.value = v;
    });
    $("#ckCvc").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); });
    $("#confDone").addEventListener("click", () => { closeCheckout(); });
  }

  function completeOrder() {
    const t = updateTotals();
    const order = "#HJB-" + Math.floor(1000 + Math.random() * 9000);
    const first = $("#ckFirst").value.trim() || "friend";
    const email = $("#ckEmail").value.trim() || "your inbox";
    $("#confName").textContent = first;
    $("#confOrder").textContent = order;
    $("#confEmail").textContent = email;
    $("#confSummary").innerHTML = `
      <div class="cart__row"><span>Items</span><span>${cartCount()}</span></div>
      <div class="cart__row"><span>Subtotal</span><span>${money(t.sub)}</span></div>
      <div class="cart__row"><span>Shipping</span><span>${t.ship === 0 ? "Free" : money(t.ship)}</span></div>
      <div class="cart__row"><span>Tax</span><span>${money(t.tax)}</span></div>
      <div class="cart__row cart__row--total"><span>Total paid</span><span>${money(t.total)}</span></div>`;
    // clear cart
    state.cart = []; save(); renderCart();
    gotoStep(4);
    // mark all steps done
    $$("#steps li").forEach((li) => { li.classList.remove("is-active"); li.classList.add("is-done"); });
    toast("Order placed — thank you!");
  }

  /* ============================================================
     Toasts
     ============================================================ */
  function toast(msg) {
    const wrap = $("#toastWrap");
    const t = document.createElement("div"); t.className = "toast";
    t.innerHTML = `<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg><span>${msg}</span>`;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 320); }, 2400);
  }
  function bump(el) { el.animate([{ transform: "scale(1)" }, { transform: "scale(.85)" }, { transform: "scale(1)" }], { duration: 240, easing: "ease" }); }

  /* ============================================================
     Category nav / scroll
     ============================================================ */
  function applyCategory(cat) {
    state.f.categories.clear();
    if (cat && cat !== "all") state.f.categories.add(cat);
    syncFilterUI();
    render();
    const shop = $("#shop");
    if (shop) shop.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function wireCategoryLinks() {
    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-filter-cat]");
      if (!t) return;
      e.preventDefault();
      applyCategory(t.dataset.filterCat);
      closeMobileNav();
    });
  }

  /* ============================================================
     Init
     ============================================================ */
  function setHeroAndBanners() {
    if (MEDIA.hero) { const i = $("#heroImg"); i.alt = MEDIA.hero.alt; setMedia(i, MEDIA.hero.image, 1100, i.parentElement, "Hijabia", "#6d4459"); }
    if (MEDIA.about) { const i = $("#aboutImg"); i.alt = MEDIA.about.alt; setMedia(i, MEDIA.about.image, 900, i.parentElement, "", "#6d4459"); }
    $$("[data-cat-img]").forEach((img) => {
      const m = MEDIA[img.dataset.catImg];
      if (m) { img.alt = m.alt; setMedia(img, m.image, 600, img.parentElement, "", "#6d4459"); }
    });
  }

  function wireChrome() {
    $("#menuBtn").addEventListener("click", openMobileNav);
    $("#menuClose").addEventListener("click", closeMobileNav);
    $("#cartBtn").addEventListener("click", openCart);
    $("#cartClose").addEventListener("click", closeCart);
    $("#cartShop").addEventListener("click", () => { closeCart(); $("#shop").scrollIntoView({ behavior: "smooth" }); });
    $("#checkoutBtn").addEventListener("click", openCheckout);
    $("#openFilters").addEventListener("click", openFilters);
    $("#closeFilters").addEventListener("click", closeFilters);
    $("#applyFilters").addEventListener("click", closeFilters);
    $("#searchBtn").addEventListener("click", openSearch);
    $("#searchClose").addEventListener("click", closeSearch);
    overlay.addEventListener("click", () => {
      if ($("#mobileNav").classList.contains("is-open")) closeMobileNav();
      else if ($("#filters").classList.contains("is-open")) closeFilters();
      else if ($("#cart").classList.contains("is-open")) closeCart();
    });

    // focus trap for the aria-modal dialogs (quick view + checkout)
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const modal = $("#quickView").classList.contains("is-open") ? $("#quickView")
        : $("#checkout").classList.contains("is-open") ? $("#checkout") : null;
      if (!modal) return;
      const f = $$(FOCUSABLE, modal).filter((el) => el.offsetParent !== null && !el.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    const si = $("#searchInput");
    si.addEventListener("input", (e) => { state.f.q = e.target.value; render(); });
    si.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); closeSearch(); $("#shop").scrollIntoView({ behavior: "smooth" }); }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if ($("#quickView").classList.contains("is-open")) return closeQuickView();
      if ($("#searchOverlay").classList.contains("is-open")) return closeSearch();
      if ($("#checkout").classList.contains("is-open")) return; // keep checkout open; use close btn
      if ($("#cart").classList.contains("is-open")) return closeCart();
      if ($("#filters").classList.contains("is-open")) return closeFilters();
      if ($("#mobileNav").classList.contains("is-open")) return closeMobileNav();
    });

    $("#newsletterForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const email = $("#newsletterEmail");
      if (!EMAIL_RE.test(email.value.trim())) { email.focus(); toast("Please enter a valid email"); return; }
      email.value = ""; toast("You're on the list — welcome!");
    });
  }

  function init() {
    $("#year").textContent = new Date().getFullYear();
    buildFilters();
    wireFilters();
    wireQuickView();
    wireCheckout();
    wireCategoryLinks();
    wireChrome();
    setHeroAndBanners();
    render();
    renderCart();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

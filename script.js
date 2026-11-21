if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

function resetPageScroll() {
  window.scrollTo(0, 0);
  if (document.documentElement) document.documentElement.scrollTop = 0;
  if (document.body) document.body.scrollTop = 0;
  var scrollers = document.querySelectorAll(".app-main, #main, .nav-panel, .modal__overlay, .app-tab-panel");
  for (var i = 0; i < scrollers.length; i += 1) {
    scrollers[i].scrollTop = 0;
  }
  if (window.lenis && typeof window.lenis.scrollTo === "function") {
    window.lenis.scrollTo(0, { immediate: true });
  }
}

window.resetPageScroll = resetPageScroll;
resetPageScroll();
window.addEventListener("beforeunload", resetPageScroll);
document.addEventListener("DOMContentLoaded", resetPageScroll);
window.addEventListener("load", resetPageScroll);

(function () {
  "use strict";

  var cfg = window.SITE_CONFIG;
  if (!cfg) return;

  var ui = cfg.ui;
  var calc = cfg.calculator;
  var lenis = null;
  var motionObserver = null;
  var navObserver = null;
  var adminQueued = false;
  var demoDismissed = false;
  var preloaderDismissed = false;
  var touchStartY = 0;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var state = {
    product: calc.products[0].id,
    size: calc.size.default,
    material: calc.materials[0].id,
    timing: calc.timing[1].id,
    filter: "all"
  };

  var LEGACY_TAB_HASH = {
    hero: "home",
    home: "home",
    categories: "catalog",
    calculator: "catalog",
    catalog: "catalog",
    portfolio: "portfolio",
    steps: "about",
    reviews: "about",
    final: "about",
    about: "about",
    contacts: "contacts"
  };

  var appTabState = {
    active: "home",
    visited: { home: true },
    bound: false,
    inited: false
  };

  setupPreloader();
  applyOverrides();
  applyTheme();
  render();
  bind();
  updateQuote();
  syncRange();
  watchSections();
  setupDemoCover();
  mountMotion();
  animateProjectCards();
  startLenis();
  resetScroll();
  startIntro();
  bindDemoDismiss();
  initAppTabs();
  requestAnimationFrame(frame);

  function applyTheme() {
    var accent = /^#[0-9A-Fa-f]{6}$/.test(cfg.theme.accent) ? cfg.theme.accent : "#C26D3A";
    document.documentElement.style.setProperty("--accent", accent);
    document.title = cfg.brand.legalName + " — мебель на заказ";
    var desc = document.getElementById("meta-desc");
    if (desc) desc.setAttribute("content", cfg.brand.slogan);
    setOg("og:title", cfg.brand.legalName + " — мебель на заказ");
    setOg("og:description", cfg.brand.slogan);
    setOg("og:image", cfg.hero.image);
    var theme = document.getElementById("theme-color");
    if (theme) theme.setAttribute("content", accent);
    var year = new Date().getFullYear();
    document.documentElement.style.setProperty("--year", year);
    var icon = document.getElementById("favicon");
    if (icon) {
      var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='" + accent + "'/></svg>";
      icon.setAttribute("href", "data:image/svg+xml," + encodeURIComponent(svg));
    }
    var skip = document.getElementById("skip-link");
    if (skip) skip.textContent = ui.skip;
  }

  function render() {
    document.getElementById("header").innerHTML = headerHTML();
    document.getElementById("nav-panel").innerHTML = panelHTML();
    document.getElementById("hero").innerHTML = heroHTML();
    document.getElementById("categories").innerHTML = categoriesHTML();
    document.getElementById("calculator").innerHTML = calculatorHTML();
    document.getElementById("portfolio").innerHTML = portfolioHTML();
    document.getElementById("steps").innerHTML = stepsHTML();
    document.getElementById("reviews").innerHTML = reviewsHTML();
    document.getElementById("final").innerHTML = finalHTML();
    document.getElementById("contacts").innerHTML = footerHTML();
    var dock = document.getElementById("dock");
    if (dock) dock.innerHTML = dockHTML();
    mountAppTabbar();
    paintDemoCover();
    markContentImages();
  }

  function setupPreloader() {
    var preloader = document.getElementById("site-preloader");
    if (!preloader) return;

    function dismissPreloader() {
      if (preloaderDismissed) return;
      preloaderDismissed = true;
      preloader.classList.add("is-hidden");
      preloader.setAttribute("aria-busy", "false");
      if (preloader.parentNode) preloader.remove();
    }

    window.setTimeout(dismissPreloader, 200);
  }

  function markContentImages() {
    document.querySelectorAll(".media img").forEach(function (img) {
      if (img.getAttribute("data-img-bound") === "1") return;
      img.setAttribute("data-img-bound", "1");
      if (!img.getAttribute("loading")) img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      img.addEventListener(
        "error",
        function onImgError() {
          img.classList.add("is-img-error");
          img.removeAttribute("src");
          img.removeEventListener("error", onImgError);
        },
        { once: true }
      );
    });
  }

  function setupDemoCover() {
    var cover = document.getElementById("demo-cover");
    if (!cfg.demoIntro || reduceMotion) {
      if (cover) cover.remove();
      document.documentElement.classList.remove("has-intro");
      document.documentElement.classList.add("is-revealed", "is-settled-hero");
      return;
    }
    document.documentElement.classList.add("has-intro");
    if (cover) {
      cover.hidden = false;
      document.body.classList.add("lock");
    }
  }

  function paintDemoCover() {
    if (!cfg.demoIntro || reduceMotion) return;
    var demo = cfg.demo || {};
    var badge = document.getElementById("demo-badge");
    var title = document.getElementById("demo-title");
    var tags = document.getElementById("demo-tags");
    var cta = document.getElementById("demo-cta");
    if (badge) badge.textContent = demo.badge || "";
    if (title) title.textContent = demo.title || "";
    if (cta) cta.textContent = demo.cta || "";
    if (tags && demo.tags) {
      tags.innerHTML = demo.tags.map(function (tag) {
        return "<li>" + esc(tag) + "</li>";
      }).join("");
    }
    var agency = document.getElementById("demo-agency");
    if (agency) {
      if (cfg.demoIntro && cfg.agencyBrand) {
        agency.hidden = false;
        var brand = String(cfg.agencyBrand).toUpperCase();
        agency.innerHTML =
          '<span class="demo-agency__rule" aria-hidden="true"></span>' +
          '<span class="demo-agency__text">✦ ' + esc(ui.demoAgency) + " " + esc(brand) + "</span>" +
          '<span class="demo-agency__rule" aria-hidden="true"></span>';
      } else {
        agency.remove();
      }
    }
  }

  function dockHTML() {
    return (
      '<a class="btn btn-primary magnetic" href="#catalog">' + esc(ui.dockCalc) + '</a>' +
      messengerAnchor("telegram", "btn btn-line", esc(cfg.contacts.telegramLabel || ui.dockTelegram))
    );
  }

  function headerHTML() {
    return (
      '<div class="header-inner">' +
        '<a class="logo" href="#home"><b>' + esc(cfg.brand.name) + '</b><small>' + esc(cfg.brand.logoNote) + '</small></a>' +
        '<nav class="desk-nav" aria-label="' + esc(ui.footerNav) + '">' + navLinks() + '</nav>' +
        '<div class="tools">' +
          phoneBlock() +
          messengerAnchor("telegram", "icon-btn desk-only", icon("tg"), ' aria-label="' + esc(ui.telegramAria) + '"') +
          messengerAnchor("whatsapp", "icon-btn desk-only", icon("wa"), ' aria-label="' + esc(ui.whatsappAria) + '"') +
          '<button class="btn btn-primary magnetic desk-only" type="button" data-action="measure">' + esc(ui.measureCta) + '</button>' +
          '<button class="burger" type="button" data-action="menu" aria-expanded="false" aria-label="' + esc(ui.menuOpen) + '"><span></span><span></span></button>' +
        '</div>' +
      '</div>'
    );
  }

  function panelHTML() {
    var c = cfg.contacts;
    var tabs = appTabs().map(function (tab) {
      return (
        '<button class="nav-panel__tab" type="button" data-action="app-tab" data-tab="' + esc(tab.id) + '"' +
          ' data-app-tab="' + esc(tab.id) + '">' + esc(tab.label) + "</button>"
      );
    }).join("");
    return (
      '<nav class="nav-panel__nav" aria-label="' + esc(ui.footerNav) + '">' + tabs + "</nav>" +
      '<div class="nav-panel__divider" role="presentation"></div>' +
      '<div class="nav-panel__actions">' +
        (c.phoneTel
          ? '<a class="nav-panel__link" href="tel:' + esc(c.phoneTel) + '">' + esc(c.phone) + "</a>"
          : '<span class="nav-panel__link">' + esc(c.phone) + "</span>") +
        messengerAnchor("telegram", "nav-panel__link", esc(c.telegramLabel || ui.dockTelegram)) +
        messengerAnchor("whatsapp", "nav-panel__link", esc(c.whatsappLabel || ui.whatsappAria)) +
        '<button class="btn btn-primary btn-block nav-panel__cta" type="button" data-action="measure">' + esc(ui.measureCta) + "</button>" +
      "</div>"
    );
  }

  function navLinks() {
    return appTabs().map(function (tab) {
      return (
        '<a href="#' + esc(tab.hash) + '" data-nav-tab="' + esc(tab.id) + '">' + esc(tab.label) + "</a>"
      );
    }).join("");
  }

  function heroHTML() {
    var h = cfg.hero;
    var bullets = h.bullets.map(function (b) {
      return (
        '<article class="bullet"><i>' + esc(b.mark) + '</i><strong>' + esc(b.figure) + '</strong><p>' + esc(b.text) + '</p></article>'
      );
    }).join("");
    return (
      '<div class="wrap hero-grid">' +
        '<div class="hero-copy">' +
          '<div class="hero-reveal d1"><p class="eyebrow">' + esc(h.eyebrow) + '</p><h1>' + esc(h.title) + '</h1></div>' +
          '<div class="hero-reveal d2"><p class="lead">' + esc(h.subtitle) + '</p></div>' +
          '<div class="hero-reveal d3"><div class="actions">' +
            '<a class="btn btn-primary magnetic" href="' + esc(h.primaryHref) + '">' + esc(h.primaryCta) + '</a>' +
            '<a class="btn btn-line" href="' + esc(h.secondaryHref) + '">' + esc(h.secondaryCta) + '</a>' +
          '</div></div>' +
          '<div class="hero-reveal d5"><div class="bullets">' + bullets + '</div></div>' +
        '</div>' +
        '<figure class="hero-reveal d4 hero-media">' +
          '<div class="media"><img data-parallax src="' + esc(h.image) + '" alt="' + esc(h.imageAlt) + '" width="1200" height="1500" decoding="async" fetchpriority="high"></div>' +
          '<figcaption>' + esc(h.imageCaption) + '</figcaption>' +
        '</figure>' +
      '</div>'
    );
  }

  function categoriesHTML() {
    var block = cfg.categories;
    var cards = block.items.map(function (item) {
      return (
        '<article class="cat tilt" data-action="open-category" data-id="' + esc(item.id) + '" tabindex="0" role="button" aria-label="' + esc(ui.openCategory + ': ' + item.title) + '">' +
          '<div class="media"><img data-parallax src="' + esc(item.image) + '" alt="' + esc(item.imageAlt) + '" width="1200" height="900" loading="lazy"></div>' +
          '<div class="cat-body"><h3>' + esc(item.title) + '</h3><p>' + esc(item.text) + '</p><p class="cat-price">' + esc(item.price) + '</p><p class="cat-more">' + esc(ui.catVariants) + '</p></div>' +
        '</article>'
      );
    }).join("");
    return (
      '<div class="wrap">' +
        head(block.eyebrow, block.title, block.lead) +
        '<div class="cat-list">' + cards + '</div>' +
      '</div>'
    );
  }

  function calculatorHTML() {
    return (
      '<div class="wrap">' +
        head(calc.eyebrow, calc.title, calc.lead) +
        '<div class="calc">' +
          '<div class="calc-main">' +
            '<div class="step-block"><h3>' + esc(calc.groups.product) + '</h3><div class="options">' + optionsHTML(calc.products, "product", state.product, false) + '</div></div>' +
            '<div class="step-block"><h3 id="size-label">' + esc(currentProduct().sizeLabel) + '</h3>' +
              '<p class="size-now"><b data-size-now></b> <span data-size-unit></span></p>' +
              '<input id="size-range" data-size type="range" min="' + calc.size.min + '" max="' + calc.size.max + '" step="' + calc.size.step + '" value="' + state.size + '" aria-labelledby="size-label">' +
            '</div>' +
            '<div class="step-block"><h3>' + esc(calc.groups.material) + '</h3><div class="options">' + optionsHTML(calc.materials, "material", state.material, true) + '</div></div>' +
            '<div class="step-block"><h3>' + esc(calc.groups.timing) + '</h3><div class="options">' + optionsHTML(calc.timing, "timing", state.timing, true) + '</div></div>' +
            leadFormHTML(ui.formCalculator, "") +
            '<p class="fine">' + esc(calc.disclaimer) + '</p>' +
          '</div>' +
          '<aside class="calc-aside calculator__result calc-summary tilt">' + quoteBox() + '</aside>' +
        '</div>' +
      '</div>'
    );
  }

  function optionsHTML(list, group, selected, withDesc) {
    return list.map(function (item) {
      var on = item.id === selected;
      return (
        '<button type="button" class="option' + (on ? ' is-selected' : '') + '" data-action="option" data-group="' + group + '" data-id="' + esc(item.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
          '<b>' + esc(item.title) + '</b>' +
          (withDesc ? '<span>' + esc(item.description) + '</span>' : '') +
        '</button>'
      );
    }).join("");
  }

  function quoteBox() {
    return (
      '<p class="quote-label">' + esc(ui.quoteLabel) + '</p>' +
      '<p class="quote-value" data-quote="value" aria-live="polite"></p>' +
      '<p class="quote-meta" data-quote="meta"></p>' +
      '<p class="gift">' + esc(calc.gift) + '</p>'
    );
  }

  function portfolioHTML() {
    var block = cfg.portfolio;
    var filters = block.filters.map(function (f) {
      var on = f.id === state.filter;
      return '<button type="button" class="filter filter-btn projects__tab' + (on ? ' is-active active' : '') + '" data-action="filter" data-filter="' + esc(f.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(f.label) + '</button>';
    }).join("");
    var cards = block.items.map(function (item) {
      return (
        '<article class="project project-card tilt" data-project data-category="' + esc(item.category) + '" data-action="open-project" data-id="' + esc(item.id) + '" tabindex="0" role="button" aria-label="' + esc(ui.openProject + ': ' + item.title) + '">' +
          '<div class="media"><img data-parallax src="' + esc(item.image) + '" alt="' + esc(item.imageAlt) + '" width="1200" height="800" loading="lazy"></div>' +
          '<div class="body"><h3>' + esc(item.title) + '</h3>' + specHTML(item) + '</div>' +
        '</article>'
      );
    }).join("");
    return (
      '<div class="wrap">' +
        head(block.eyebrow, block.title, block.lead) +
        '<div class="filters" role="group" aria-label="' + esc(block.eyebrow) + '">' + filters + '</div>' +
        '<div class="project-list">' + cards + '</div>' +
        '<p class="empty" data-empty hidden>' + esc(block.empty) + '</p>' +
      '</div>'
    );
  }

  function specHTML(item) {
    return (
      '<dl class="spec">' +
        row(ui.specSize, item.size) +
        row(ui.specMaterials, item.materials) +
        row(ui.specDays, daysLabel(item.days)) +
        row(ui.specPrice, item.price) +
      '</dl>'
    );
  }

  function row(label, value) {
    return '<div><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>';
  }

  function stepsHTML() {
    var block = cfg.steps;
    var items = block.items.map(function (step) {
      return '<article class="step"><span class="num">' + esc(step.num) + '</span><h3>' + esc(step.title) + '</h3><p>' + esc(step.text) + '</p></article>';
    }).join("");
    return '<div class="wrap">' + head(block.eyebrow, block.title, block.lead) + '<div class="steps">' + items + '</div></div>';
  }

  function reviewsHTML() {
    var block = cfg.reviews;
    var items = block.items.map(function (r) {
      return (
        '<figure class="review"><span class="mark" aria-hidden="true">«</span><blockquote><p>' + esc(r.text) + '</p></blockquote>' +
        '<footer><strong>' + esc(r.name) + '</strong><em>' + esc(r.city) + ' · ' + esc(r.product) + '</em></footer></figure>'
      );
    }).join("");
    return '<div class="wrap">' + head(block.eyebrow, block.title, "") + '<div class="review-list">' + items + '</div></div>';
  }

  function finalHTML() {
    var block = cfg.finalCta;
    return (
      '<div class="wrap"><div class="final">' +
        '<div><p class="eyebrow">' + esc(block.eyebrow) + '</p><h2>' + esc(block.title) + '</h2><p class="lead" style="margin-top:12px">' + esc(block.text) + '</p></div>' +
        leadFormHTML(ui.formFinal, "", block.button) +
      '</div></div>'
    );
  }

  function footerHTML() {
    var b = cfg.brand;
    var c = cfg.contacts;
    var year = new Date().getFullYear();
    var links = appTabs().map(function (tab) {
      return '<li><a class="footer__nav-link" href="#' + esc(tab.hash) + '">' + esc(tab.label) + "</a></li>";
    }).join("");
    return (
      '<div class="wrap footer-grid">' +
        '<div><p class="eyebrow">' + esc(b.name) + '</p><h2>' + esc(b.legalName) + '</h2><p class="fine">' + esc(b.slogan) + '</p></div>' +
        '<div><p class="eyebrow">' + esc(ui.footerNav) + '</p><ul class="contact-list">' + links +
          '<li><button class="footer__nav-link" type="button" data-action="privacy">' + esc(ui.privacyDoc) + '</button></li></ul></div>' +
        '<div><p class="eyebrow">' + esc(cfg.nav[cfg.nav.length - 1].label) + '</p>' +
          '<ul class="contact-list">' +
            '<li>' + contactItem(c.phoneTel ? "tel:" + c.phoneTel : "", c.phone) + '</li>' +
            '<li>' + messengerAnchor("telegram", "footer__link", esc(c.telegramLabel || ui.telegramAria)) + '</li>' +
            '<li>' + messengerAnchor("whatsapp", "footer__link", esc(c.whatsappLabel || ui.whatsappAria)) + '</li>' +
            '<li>' + messengerAnchor("vk", "footer__link", esc(c.vkLabel || ui.vkLabel)) + '</li>' +
            '<li>' + esc(b.hours) + '<br><span class="fine">' + esc(b.hoursNote) + '</span></li>' +
            '<li>' + externalAnchor(b.mapsUrl, esc(b.address), "footer__link") + '<br><span class="fine">' + esc(b.addressNote) + '</span></li>' +
          '</ul>' +
          mapBlockHTML() +
        '</div>' +
      '</div>' +
      '<div class="wrap legal"><p>' + esc(cfg.legal.line) + '</p>' +
      '<p class="fine">© ' + b.founded + '–' + year + ' ' + esc(b.legalName) + '. ' + esc(ui.rights) + '</p></div>'
    );
  }

  function head(eyebrow, title, lead) {
    return '<div class="section-head"><p class="eyebrow">' + esc(eyebrow) + '</p><h2>' + esc(title) + '</h2>' + (lead ? '<p class="lead">' + esc(lead) + '</p>' : '') + '</div>';
  }

  function leadFormHTML(formName, project, buttonLabel) {
    return (
      '<form class="form" data-lead="' + esc(formName) + '" novalidate>' +
        '<input type="hidden" name="project" value="' + esc(project) + '">' +
        '<div class="fields">' +
          '<label class="field"><span>' + esc(ui.nameLabel) + '</span>' +
            '<input type="text" name="name" autocomplete="name" placeholder="' + esc(ui.namePlaceholder) + '" maxlength="60">' +
            '<small class="field-error" data-error-for="name"></small></label>' +
          '<label class="field"><span>' + esc(ui.phoneLabel) + '</span>' +
            '<input type="tel" name="phone" data-phone inputmode="tel" autocomplete="tel" placeholder="' + esc(ui.phonePlaceholder) + '">' +
            '<small class="field-error" data-error-for="phone"></small></label>' +
        '</div>' +
        '<div class="check"><label><input type="checkbox" name="privacy"><span>' + esc(ui.privacyPrefix) + '</span></label> <button class="linkish" type="button" data-action="privacy">' + esc(ui.privacyLink) + '</button> <span>' + esc(ui.consentJoin) + '</span> <button class="linkish" type="button" data-action="consent">' + esc(ui.consentLink) + '</button></div>' +
        '<small class="field-error" data-error-for="privacy"></small>' +
        '<button class="btn btn-primary magnetic btn-block" type="submit">' + esc(buttonLabel || calc.submit) + '</button>' +
        '<p class="form-error" data-form-error></p>' +
      '</form>'
    );
  }

  function bind() {
    document.addEventListener("click", onClick);
    document.addEventListener("input", onInput);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("submit", onSubmit);
    document.addEventListener("keydown", onKey);
    document.addEventListener("change", onChange);
    document.addEventListener("animationend", onAnimationEnd);
    var modal = document.getElementById("modal-root");
    var privacy = document.getElementById("privacy-root");
    var admin = document.getElementById("admin-root");
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    privacy.addEventListener("click", function (e) { if (e.target === privacy) closePrivacy(); });
    admin.addEventListener("click", function (e) {
      if (e.target === admin && admin.querySelector("[data-pin]")) closeAdmin();
    });
    bindMenuDismiss();
  }

  function bindMenuDismiss() {
    if (bindMenuDismiss.done) return;
    bindMenuDismiss.done = true;
    var closeOnScroll = function () {
      if (document.body.classList.contains("menu-open")) closeMenu();
    };
    window.addEventListener("scroll", closeOnScroll, { passive: true });
    window.addEventListener("wheel", closeOnScroll, { passive: true });
    document.addEventListener(
      "touchmove",
      function (e) {
        if (!document.body.classList.contains("menu-open")) return;
        if (e.target.closest("#nav-panel")) return;
        closeMenu();
      },
      { passive: true }
    );
    document.addEventListener("click", function (e) {
      if (!document.body.classList.contains("menu-open")) return;
      if (e.target.closest("#nav-panel")) return;
      if (e.target.closest("[data-action='menu']")) return;
      closeMenu();
    });
  }

  function bindLenisMenuClose() {
    if (!lenis || bindLenisMenuClose.done || typeof lenis.on !== "function") return;
    bindLenisMenuClose.done = true;
    lenis.on("scroll", function () {
      if (document.body.classList.contains("menu-open")) closeMenu();
    });
  }

  function onClick(e) {
    var messenger = e.target.closest("[data-messenger]");
    if (messenger) {
      var kind = messenger.getAttribute("data-messenger");
      if (isPlaceholder(cfg.contacts[kind])) {
        e.preventDefault();
        showToast(ui.messengerSoon);
        return;
      }
      var url = resolveMessenger(kind, cfg.contacts[kind]);
      if (messenger.getAttribute("target") !== "_blank" || messenger.getAttribute("href") !== url) {
        e.preventDefault();
        window.open(url, "_blank", "noopener,noreferrer");
      }
      if (messenger.closest(".nav-panel")) closeMenu();
      return;
    }
    if (e.target.closest("[data-dead-contact]")) {
      e.preventDefault();
      showToast(ui.messengerSoon);
      return;
    }
    var dead = e.target.closest("a");
    if (dead && isDeadResource(dead.getAttribute("href"), dead.textContent)) {
      e.preventDefault();
      showToast(ui.messengerSoon);
      return;
    }
    var anchor = e.target.closest("a[href^='#']");
    if (anchor) {
      var hash = anchor.getAttribute("href");
      var tabId = tabIdFromHash(hash);
      if (tabId) {
        e.preventDefault();
        if (anchor.closest(".nav-panel")) closeMenu();
        switchAppTab(tabId);
        return;
      }
    }
    if (e.target.closest(".nav-panel a")) closeMenu();
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var action = el.getAttribute("data-action");
    if (action === "app-tab") {
      e.preventDefault();
      if (el.closest(".nav-panel")) closeMenu();
      switchAppTab(el.getAttribute("data-tab") || "home");
      return;
    }
    if (action === "menu") toggleMenu();
    if (action === "measure") {
      closeMenu();
      openModal(modalForm(ui.formMeasure, ""));
    }
    if (action === "privacy") openLegal("privacy");
    if (action === "consent") openLegal("consent");
    if (action === "close-modal") closeModal();
    if (action === "close-privacy") closePrivacy();
    if (action === "option") selectOption(el.getAttribute("data-group"), el.getAttribute("data-id"));
    if (action === "filter") applyFilter(el.getAttribute("data-filter"));
    if (action === "open-project") openProject(el.getAttribute("data-id"));
    if (action === "open-category") openCategory(el.getAttribute("data-id"));
    if (action === "calc-variant") applyCalcProduct(el.getAttribute("data-product"));
    if (action === "same") openModal(modalForm(ui.formSame, el.getAttribute("data-project") || ""));
    if (action === "demo-open") dismissDemoCover();
    if (action === "open-map") openMap();
    if (action === "close-admin") closeAdmin();
    if (action === "admin-tab") switchAdminTab(el.getAttribute("data-tab"));
    if (action === "lead-delete") deleteLead(el.getAttribute("data-id"));
    if (action === "export-csv") exportCsv();
    if (action === "download-config") downloadConfig();
  }

  function onInput(e) {
    if (e.target.matches("[data-size]")) {
      state.size = roundStep(parseFloat(e.target.value), calc.size.step);
      syncRange();
      updateQuote();
    }
    if (e.target.matches("[data-phone]")) {
      var next = formatPhone(e.target.value);
      if (e.target.value !== next) e.target.value = next;
    }
    if (e.target.name) clearField(e.target.form, e.target.name);
  }

  function onFocus(e) {
    if (e.target.matches("[data-phone]") && !e.target.value) e.target.value = "+7";
  }

  function onKey(e) {
    if (e.ctrlKey && e.shiftKey && (e.key === "L" || e.key === "l")) {
      e.preventDefault();
      requestAdmin();
      return;
    }
    if (e.key === "Escape") {
      if (!document.getElementById("privacy-root").hidden) { closePrivacy(); return; }
      var admin = document.getElementById("admin-root");
      if (admin && !admin.hidden) { closeAdmin(); return; }
      if (!document.getElementById("modal-root").hidden) { closeModal(); return; }
      closeMenu();
    }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-action='open-project']")) {
      e.preventDefault();
      openProject(e.target.getAttribute("data-id"));
    }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-action='open-category']")) {
      e.preventDefault();
      openCategory(e.target.getAttribute("data-id"));
    }
    if (e.key === "Tab") trapFocus(e);
  }

  function onSubmit(e) {
    var form = e.target;
    if (form.matches && form.matches("form[data-pin]")) {
      e.preventDefault();
      checkPin(form);
      return;
    }
    if (form.matches && form.matches("form[data-settings]")) {
      e.preventDefault();
      return;
    }
    if (!form.matches || !form.matches("form[data-lead]")) return;
    e.preventDefault();
    submitForm(form);
  }

  function onChange(e) {
    if (!e.target.matches("[data-lead-status]")) return;
    var id = e.target.getAttribute("data-lead-status");
    var leads = readLeads();
    leads.forEach(function (lead) {
      if (lead.id === id) lead.status = e.target.value;
    });
    writeLeads(leads);
  }

  function onAnimationEnd(e) {
    if (!e.target.classList || !e.target.classList.contains("reveal")) return;
    if (e.animationName !== "rise") return;
    e.target.classList.add("is-settled");
  }

  function toggleMenu() {
    var open = !document.body.classList.contains("menu-open");
    document.body.classList.toggle("menu-open", open);
    var btn = document.querySelector("[data-action='menu']");
    if (btn) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? ui.menuClose : ui.menuOpen);
    }
    if (open) {
      if (lenis) lenis.stop();
    } else {
      resumeLenisAfterOverlay();
    }
  }

  function closeMenu() {
    var wasOpen = document.body.classList.contains("menu-open");
    document.body.classList.remove("menu-open");
    var btn = document.querySelector("[data-action='menu']");
    if (btn) {
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", ui.menuOpen);
    }
    if (wasOpen) resumeLenisAfterOverlay();
  }

  function resumeLenisAfterOverlay() {
    if (!lenis) return;
    if (document.body.classList.contains("lock")) return;
    if (document.body.classList.contains("menu-open")) return;
    if (!document.getElementById("modal-root").hidden) return;
    if (document.getElementById("privacy-root") && !document.getElementById("privacy-root").hidden) return;
    var admin = document.getElementById("admin-root");
    if (admin && !admin.hidden) return;
    if (!document.documentElement.classList.contains("is-settled-hero")) return;
    lenis.start();
  }

  function selectOption(group, id) {
    if (!state.hasOwnProperty(group)) return;
    state[group] = id;
    document.querySelectorAll('[data-group="' + group + '"]').forEach(function (btn) {
      var on = btn.getAttribute("data-id") === id;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    updateQuote();
  }

  function applyFilter(id) {
    state.filter = id;
    var visible = 0;
    document.querySelectorAll("[data-filter]").forEach(function (btn) {
      var on = btn.getAttribute("data-filter") === id;
      btn.classList.toggle("is-active", on);
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.querySelectorAll("[data-project]").forEach(function (card) {
      var show = id === "all" || card.getAttribute("data-category") === id;
      card.hidden = !show;
      if (show) visible += 1;
    });
    var empty = document.querySelector("[data-empty]");
    if (empty) empty.hidden = visible !== 0;
    animateProjectCards();
  }

  function animateProjectCards() {
    if (reduceMotion) return;
    var index = 0;
    document.querySelectorAll("[data-project]").forEach(function (card) {
      if (card.hidden) return;
      card.classList.remove("project-card--animate", "reveal", "is-in", "is-settled");
      card.style.opacity = "";
      card.style.transform = "";
      card.style.animationDelay = "";
      void card.offsetWidth;
      card.style.animationDelay = index * 55 + "ms";
      card.classList.add("project-card--animate");
      index += 1;
    });
  }

  function phoneBlock() {
    var tel = (cfg.contacts.phoneTel || "").trim();
    var inner = icon("phone") + '<span class="phone-text">' + esc(cfg.contacts.phone) + "</span>";
    if (tel) {
      return '<a class="phone" href="tel:' + esc(tel) + '" aria-label="' + esc(ui.phoneAria) + '">' + inner + "</a>";
    }
    return '<span class="phone" aria-label="' + esc(ui.phoneAria) + '">' + inner + "</span>";
  }

  function contactItem(href, label) {
    href = (href || "").trim();
    if (href && href !== "#" && !isPlaceholder(href)) {
      var ext = href.indexOf("http") === 0 || href.indexOf("tel:") === 0;
      return '<a class="footer__link footer__contact-link" href="' + esc(href) + '"' + (ext && href.indexOf("tel:") !== 0 ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + esc(label) + "</a>";
    }
    if (!href || href === "#" || isPlaceholder(href)) {
      return '<button class="footer__link footer__contact-link" type="button" data-dead-contact>' + esc(label) + "</button>";
    }
    return "<span>" + esc(label) + "</span>";
  }

  function isPlaceholder(value) {
    var text = String(value || "").trim();
    if (!text || text === "#") return true;
    if (text.indexOf("*") !== -1) return true;
    if (text.indexOf("@****") !== -1) return true;
    if (text.indexOf("+7 (***)") !== -1) return true;
    return false;
  }

  function isDeadResource(href, label) {
    var link = String(href || "").trim();
    var text = String(label || "");
    if (!link || link === "#") return true;
    if (link.indexOf("*") !== -1 || text.indexOf("***") !== -1 || text.indexOf("@****") !== -1) return true;
    return false;
  }

  function resolveMessenger(kind, raw) {
    var value = String(raw || "").trim();
    if (/^https?:\/\//i.test(value)) return value;
    if (kind === "telegram") {
      var user = value.replace(/^@/, "").split(/[/?#]/)[0];
      return "https://t.me/" + user;
    }
    if (kind === "whatsapp") {
      var digits = value.replace(/\D/g, "");
      if (digits.length === 11 && digits.charAt(0) === "8") digits = "7" + digits.slice(1);
      return "https://wa.me/" + digits;
    }
    if (kind === "vk") {
      var slug = value.replace(/^@/, "").replace(/^(https?:\/\/)?(www\.)?vk\.com\//i, "").split(/[/?#]/)[0];
      return "https://vk.com/" + slug;
    }
    return value;
  }

  function messengerAnchor(kind, className, inner, extra) {
    var raw = cfg.contacts[kind] || "";
    var ready = !isPlaceholder(raw);
    var href = ready ? resolveMessenger(kind, raw) : "#";
    var cls = ((className || "") + (kind === "telegram" ? " tg-link" : kind === "whatsapp" ? " wa-link" : "")).trim();
    return '<a' + (cls ? ' class="' + cls + '"' : "") + ' href="' + esc(href) + '" data-messenger="' + kind + '"' +
      (ready ? ' target="_blank" rel="noopener noreferrer"' : "") +
      (extra || "") + ">" + inner + "</a>";
  }

  function externalAnchor(href, inner, className) {
    if (isPlaceholder(href) || !String(href || "").trim()) {
      return '<button class="' + className + '" type="button" data-dead-contact>' + inner + "</button>";
    }
    return '<a class="' + className + '" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + inner + "</a>";
  }

  var toastTimer = 0;
  var toastHide = 0;

  function showToast(text) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    el.classList.remove("is-on");
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { el.classList.add("is-on"); });
    });
    window.clearTimeout(toastTimer);
    window.clearTimeout(toastHide);
    toastTimer = window.setTimeout(function () {
      el.classList.remove("is-on");
      toastHide = window.setTimeout(function () {
        if (!el.classList.contains("is-on")) el.hidden = true;
      }, 360);
    }, 5200);
  }

  function mapBlockHTML() {
    var src = (cfg.brand && cfg.brand.mapWidgetSrc) || "";
    return (
      '<div class="map-stub">' +
        '<iframe class="map-embed" src="' + esc(src) + '" title="' + esc(ui.mapTitle) + '" width="100%" height="100%" frameborder="0" style="display: block; border: 0; filter: sepia(0.12) contrast(0.96);"></iframe>' +
        '<a class="map-hint" href="' + esc((cfg.brand && cfg.brand.mapOpenUrl) || cfg.brand.mapsUrl || "#") + '" target="_blank" rel="noopener noreferrer">' + esc(ui.mapOpen) + "</a>" +
      "</div>"
    );
  }

  function mapArt() {
    return (
      '<svg class="map-art" viewBox="0 0 640 360" aria-hidden="true">' +
        '<rect width="640" height="360" fill="#E7DFD2"/>' +
        '<rect x="24" y="28" width="168" height="96" rx="8" fill="#F6F1E8"/>' +
        '<rect x="210" y="28" width="132" height="118" rx="8" fill="#F3EBE1"/>' +
        '<rect x="360" y="36" width="248" height="78" rx="8" fill="#F7F3EC"/>' +
        '<rect x="36" y="214" width="188" height="112" rx="8" fill="#F4EEE6"/>' +
        '<rect x="248" y="228" width="150" height="96" rx="8" fill="#F7F3EC"/>' +
        '<rect x="422" y="196" width="184" height="128" rx="8" fill="#EFE4D6"/>' +
        '<path d="M0 168h640M188 0v360M430 0v360M0 92h188M248 188h392" fill="none" stroke="#C4B5A2" stroke-width="10"/>' +
        '<path d="M0 176h640M196 0v360" fill="none" stroke="#EFE6DA" stroke-width="2"/>' +
        '<path d="M92 300c48-36 78-28 112-70 28-34 46-78 88-96 36-16 70 8 108 6 40-2 62-28 110-22" fill="none" stroke="var(--accent)" stroke-opacity="0.35" stroke-width="8" stroke-linecap="round"/>' +
        '<circle cx="392" cy="154" r="26" fill="var(--accent)" fill-opacity="0.18"/>' +
        '<path d="M392 118c-14.4 0-26 11.4-26 25.4 0 19.2 26 46.6 26 46.6s26-27.4 26-46.6c0-14-11.6-25.4-26-25.4z" fill="var(--accent)"/>' +
        '<circle cx="392" cy="143" r="8" fill="#F8F7F4"/>' +
      "</svg>"
    );
  }

  function openMap() {
    openModal(
      '<div class="modal modal-wide modal-map modal__dialog" role="dialog" aria-modal="true" aria-labelledby="map-title">' +
        '<div class="modal__content">' +
        '<header><div><p class="eyebrow">' + esc(cfg.brand.name) + '</p><h3 id="map-title">' + esc(ui.mapTitle) + '</h3></div>' +
        '<button class="x" type="button" data-action="close-modal" aria-label="' + esc(ui.close) + '">×</button></header>' +
        '<div class="map-stage" data-map-pan>' + mapArt() + '</div>' +
        '<p class="map-note">' + esc(cfg.brand.address) + '. ' + esc(ui.mapPan) + '</p>' +
        '</div></div>'
    );
    bindMapPan(document.getElementById("modal-root"));
  }

  function bindMapPan(root) {
    var stage = root.querySelector("[data-map-pan]");
    if (!stage) return;
    var art = stage.querySelector(".map-art");
    if (!art) return;
    var x = -48;
    var y = -36;
    var drag = false;
    var sx = 0;
    var sy = 0;
    var ox = x;
    var oy = y;
    function apply() {
      art.style.transform = "translate(" + x + "px," + y + "px)";
    }
    apply();
    stage.addEventListener("pointerdown", function (event) {
      drag = true;
      sx = event.clientX;
      sy = event.clientY;
      ox = x;
      oy = y;
      stage.setPointerCapture(event.pointerId);
    });
    stage.addEventListener("pointermove", function (event) {
      if (!drag) return;
      x = ox + event.clientX - sx;
      y = oy + event.clientY - sy;
      apply();
    });
    function endDrag() { drag = false; }
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);
  }

  function openCategory(id) {
    var item = cfg.categories.items.filter(function (c) { return c.id === id; })[0];
    if (!item || !item.variants || !item.variants.length) return;
    var cards = item.variants.map(function (v) {
      return (
        '<article class="variant-card">' +
          '<div class="media"><img src="' + esc(v.image) + '" alt="' + esc(v.imageAlt) + '" width="1200" height="675"></div>' +
          '<h3>' + esc(v.title) + '</h3>' +
          variantSpecHTML(v) +
          '<button class="btn btn-primary magnetic" type="button" data-action="calc-variant" data-product="' + esc(item.calcProduct) + '">' + esc(ui.calcVariant) + '</button>' +
        '</article>'
      );
    }).join("");
    openModal(
      '<div class="modal modal-wide modal__dialog" role="dialog" aria-modal="true" aria-labelledby="cat-title">' +
        '<div class="modal__content">' +
        '<header><div><p class="eyebrow">' + esc(cfg.categories.eyebrow) + '</p><h3 id="cat-title">' + esc(item.title) + '</h3></div>' +
        '<button class="x" type="button" data-action="close-modal" aria-label="' + esc(ui.close) + '">×</button></header>' +
        '<div class="variant-list">' + cards + '</div>' +
        '</div></div>'
    );
    bindMagnetic(document.getElementById("modal-root"));
  }

  function variantSpecHTML(item) {
    return (
      '<dl class="spec">' +
        row(ui.specSize, item.size) +
        row(ui.specMaterials, item.materials) +
        row(ui.specPrice, item.price) +
      '</dl>'
    );
  }

  function applyCalcProduct(productId) {
    if (!productId) return;
    closeModal();
    selectOption("product", productId);
    switchAppTab("catalog");
    window.setTimeout(function () {
      var target = document.getElementById("calculator");
      if (!target) return;
      if (lenis) lenis.scrollTo(target, { offset: -80 });
      else target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  function openProject(id) {
    var item = cfg.portfolio.items.filter(function (p) { return p.id === id; })[0];
    if (!item) return;
    openModal(
      '<div class="modal modal-wide modal__dialog" role="dialog" aria-modal="true" aria-labelledby="project-title">' +
        '<div class="modal__content">' +
        '<header><div><p class="eyebrow">' + esc(filterLabel(item.category)) + '</p><h3 id="project-title">' + esc(item.title) + '</h3></div>' +
        '<button class="x" type="button" data-action="close-modal" aria-label="' + esc(ui.close) + '">×</button></header>' +
        '<div class="media"><img src="' + esc(item.image) + '" alt="' + esc(item.imageAlt) + '" width="1200" height="750"></div>' +
        specHTML(item) +
        '<p style="margin:14px 0">' + esc(item.details) + '</p>' +
        '<button class="btn btn-primary" type="button" data-action="same" data-project="' + esc(item.title) + '">' + esc(ui.wantSame) + '</button>' +
        '</div></div>'
    );
  }

  function modalForm(formName, project) {
    var title = formName;
    return (
      '<div class="modal modal__dialog" role="dialog" aria-modal="true" aria-labelledby="lead-title">' +
        '<div class="modal__content">' +
        '<header><div><p class="eyebrow">' + esc(cfg.brand.name) + '</p><h3 id="lead-title">' + esc(title) + '</h3></div>' +
        '<button class="x" type="button" data-action="close-modal" autofocus aria-label="' + esc(ui.close) + '">×</button></header>' +
        (project ? '<p class="fine" style="margin-bottom:12px">' + esc(ui.fieldProject) + ': ' + esc(project) + '</p>' : '') +
        leadFormHTML(formName, project) +
        '</div></div>'
    );
  }

  function openLegal(kind) {
    var doc = kind === "consent" ? cfg.consent : cfg.privacy;
    var root = document.getElementById("privacy-root");
    var paragraphs = doc.paragraphs.map(function (p) { return '<p style="margin-bottom:12px">' + esc(p) + '</p>'; }).join("");
    root.innerHTML =
      '<div class="privacy-card modal__dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-title">' +
        '<div class="modal__content">' +
        '<header><div><p class="eyebrow">' + esc(ui.privacyUpdated) + ' ' + esc(doc.updated) + '</p><h3 id="privacy-title">' + esc(doc.title) + '</h3></div>' +
        '<button class="x" type="button" data-action="close-privacy" aria-label="' + esc(ui.close) + '">×</button></header>' +
        paragraphs +
        '<button class="btn btn-line" type="button" data-action="close-privacy">' + esc(ui.close) + '</button>' +
        '</div></div>';
    markLenisPrevent(root);
    root.hidden = false;
    lockPage();
    var btn = root.querySelector("[data-action='close-privacy']");
    if (btn) btn.focus();
  }

  function closePrivacy() {
    var root = document.getElementById("privacy-root");
    root.hidden = true;
    root.innerHTML = "";
    unlockPage();
  }

  var lastFocus = null;

  function markLenisPrevent(root) {
    if (!root) return;
    root.setAttribute("data-lenis-prevent", "");
    root.querySelectorAll(".modal, .modal__dialog, .modal__content, .privacy-card").forEach(function (el) {
      el.setAttribute("data-lenis-prevent", "");
    });
  }

  function openModal(html) {
    lastFocus = document.activeElement;
    var root = document.getElementById("modal-root");
    root.innerHTML = html;
    markLenisPrevent(root);
    root.hidden = false;
    lockPage();
    var focus = root.querySelector("[name='name'], button");
    if (focus) focus.focus();
  }

  function closeModal() {
    var root = document.getElementById("modal-root");
    root.hidden = true;
    root.innerHTML = "";
    unlockPage();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function submitForm(form) {
    clearForm(form);
    var nameInput = form.querySelector("[name='name']");
    var phoneInput = form.querySelector("[name='phone']");
    var privacyInput = form.querySelector("[name='privacy']");
    var projectInput = form.querySelector("[name='project']");
    var name = nameInput.value.trim();
    var phone = phoneInput.value.trim();
    var ok = true;
    if (!/^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё\-\s]{1,59}$/.test(name)) {
      setField(form, "name", ui.errorName);
      ok = false;
    }
    if (digits(phone).length !== 11) {
      setField(form, "phone", ui.errorPhone);
      ok = false;
    }
    if (!privacyInput.checked) {
      setField(form, "privacy", ui.errorPrivacy);
      ok = false;
    }
    if (!ok) return;

    var button = form.querySelector("[type='submit']");
    var label = button.textContent;
    button.disabled = true;
    button.textContent = ui.sending;

    var payload = {
      form: form.getAttribute("data-lead"),
      name: name,
      phone: phone,
      project: projectInput.value
    };
    var text = messageText(payload);
    var lead = saveLead(payload);
    duplicateLead(text);
    form.reset();
    button.disabled = false;
    button.textContent = label;
    openModal(successHTML(channelsOn(), text, lead));
  }

  function successHTML(sent, text) {
    return (
      '<div class="modal modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ok-title">' +
        '<div class="modal__content">' +
        '<header><div><p class="eyebrow">' + esc(cfg.brand.legalName) + '</p><h3 id="ok-title">' + esc(ui.successTitle) + '</h3></div>' +
        '<button class="x" type="button" data-action="close-modal" aria-label="' + esc(ui.close) + '">×</button></header>' +
        '<p>' + esc(ui.successText) + '</p>' +
        '<p class="fine" style="margin-top:14px">' + esc(ui.messageLabel) + '</p>' +
        '<pre class="ticket">' + esc(text) + '</pre>' +
        '<p class="fine">' + esc(sent ? ui.sentNote : ui.localNote) + '</p>' +
        '<button class="btn btn-primary" type="button" data-action="close-modal" style="margin-top:16px">' + esc(ui.close) + '</button>' +
        '</div></div>'
    );
  }

  function channelsOn() {
    var token = (cfg.telegram.botToken || "").trim();
    var chat = (cfg.telegram.chatId || "").trim();
    var gas = (cfg.telegram.googleScriptUrl || "").trim();
    return Boolean((token && chat) || gas);
  }

  function duplicateLead(text) {
    var token = (cfg.telegram.botToken || "").trim();
    var chat = (cfg.telegram.chatId || "").trim();
    var gas = (cfg.telegram.googleScriptUrl || "").trim();
    if (token && chat) {
      fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text: text })
      }).catch(function () {});
    }
    if (gas) {
      fetch(gas, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: text
      }).catch(function () {});
    }
  }

  function messageText(payload) {
    var q = quote();
    var lines = [
      cfg.brand.legalName,
      "Форма: " + payload.form,
      ui.nameLabel + ": " + payload.name,
      ui.phoneLabel + ": " + payload.phone
    ];
    if (payload.project) lines.push(ui.fieldProject + ": " + payload.project);
    lines.push(ui.fieldProduct + ": " + q.product.title);
    lines.push(ui.fieldSize + ": " + formatSize(q.size) + " " + q.product.unit);
    lines.push(ui.fieldMaterial + ": " + q.material.title + " — " + q.material.description);
    lines.push(ui.fieldTiming + ": " + q.timing.title);
    lines.push(ui.fieldQuote + ": от " + money(q.low) + " до " + money(q.high));
    lines.push(calc.gift);
    return lines.join("\n");
  }

  function updateQuote() {
    var q = quote();
    var value = "от " + money(q.low) + " до " + money(q.high);
    var meta = q.product.title + " · " + formatSize(q.size) + " " + q.product.unit + " · " + q.material.title + " · " + q.timing.title;
    document.querySelectorAll("[data-quote='value']").forEach(function (el) { el.textContent = value; });
    document.querySelectorAll("[data-quote='meta']").forEach(function (el) { el.textContent = meta; });
    var now = document.querySelector("[data-size-now]");
    var unit = document.querySelector("[data-size-unit]");
    var label = document.getElementById("size-label");
    if (now) now.textContent = formatSize(q.size);
    if (unit) unit.textContent = q.product.unit;
    if (label) label.textContent = q.product.sizeLabel;
    var range = document.getElementById("size-range");
    if (range) range.setAttribute("aria-valuetext", formatSize(q.size) + " " + q.product.unit);
  }

  function quote() {
    var product = currentProduct();
    var material = find(calc.materials, state.material);
    var timing = find(calc.timing, state.timing);
    var mid = product.base * (state.size / calc.size.reference) * material.multiplier * timing.multiplier;
    return {
      product: product,
      material: material,
      timing: timing,
      size: state.size,
      low: roundTo(mid * calc.spread.low, 1000),
      high: roundTo(mid * calc.spread.high, 1000)
    };
  }

  function currentProduct() { return find(calc.products, state.product); }

  function find(list, id) {
    for (var i = 0; i < list.length; i += 1) if (list[i].id === id) return list[i];
    return list[0];
  }

  function syncRange() {
    var el = document.getElementById("size-range");
    if (!el) return;
    var min = parseFloat(el.min);
    var max = parseFloat(el.max);
    var val = parseFloat(el.value);
    var p = ((val - min) / (max - min)) * 100;
    el.style.setProperty("--p", p + "%");
  }

  function watchSections() {
    syncTabNav(appTabState.active);
  }

  function defaultAppTabs() {
    return [
      { id: "home", hash: "home", label: "Главная", short: "Главная" },
      { id: "catalog", hash: "catalog", label: "Услуги", short: "Услуги" },
      { id: "portfolio", hash: "portfolio", label: "Проекты", short: "Проекты" },
      { id: "about", hash: "about", label: "О студии", short: "О нас" },
      { id: "contacts", hash: "contacts", label: "Контакты", short: "Контакты" }
    ];
  }

  function appTabs() {
    var fallback = defaultAppTabs();
    var list = cfg.appTabs && cfg.appTabs.length ? cfg.appTabs.slice() : fallback.slice();
    if (list.length < fallback.length) {
      list = fallback.slice();
    }
    return list;
  }

  function findAppTab(id) {
    var list = appTabs();
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) return list[i];
    }
    return list[0];
  }

  function tabIdFromHash(raw) {
    var hash = String(raw || "").trim();
    if (!hash || hash === "#") return "home";
    if (hash.charAt(0) === "#") hash = hash.slice(1);
    if (LEGACY_TAB_HASH[hash]) return LEGACY_TAB_HASH[hash];
    var list = appTabs();
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].hash === hash || list[i].id === hash) return list[i].id;
    }
    return null;
  }

  function mountAppTabbar() {
    var root = document.getElementById("app-tabbar");
    if (!root) return;
    var items = appTabs().map(function (tab) {
      return (
        '<button class="app-tabbar__btn" type="button" role="tab" data-action="app-tab" data-app-tab="' + esc(tab.id) + '" data-tab="' + esc(tab.id) + '"' +
          ' aria-controls="app-panel-' + esc(tab.id) + '" aria-selected="false">' +
          tabBarIcon(tab.id) +
          '<span>' + esc(tab.short || tab.label) + "</span>" +
        "</button>"
      );
    }).join("");
    root.setAttribute("role", "tablist");
    root.innerHTML = items;
    root.removeAttribute("hidden");
    document.documentElement.classList.add("app-tabs-mode");
  }

  function initAppTabs() {
    if (!appTabState.bound) {
      window.addEventListener("popstate", function () {
        var next = tabIdFromHash(location.hash) || appTabState.active;
        switchAppTab(next, { history: false, animate: true });
      });
      window.addEventListener("hashchange", function () {
        var next = tabIdFromHash(location.hash);
        if (!next) return;
        switchAppTab(next, { history: false, animate: true });
      });
      appTabState.bound = true;
    }
    if (!appTabState.inited) {
      appTabState.inited = true;
      var startTab = tabIdFromHash(location.hash) || "home";
      switchAppTab(startTab, { history: false, animate: false });
      resetPageScroll();
      return;
    }
    switchAppTab(appTabState.active || "home", { history: false, animate: false });
  }

  function switchAppTab(tabId, opts) {
    opts = opts || {};
    closeMenu();
    var tab = findAppTab(tabId || "home");
    var panels = document.querySelectorAll(".app-tab-panel[data-app-tab]");
    var animate = opts.animate !== false && !reduceMotion;
    panels.forEach(function (panel) {
      var on = panel.getAttribute("data-app-tab") === tab.id;
      panel.hidden = !on;
      panel.classList.toggle("is-active", on);
      panel.classList.remove("is-animating");
      if (on && animate) {
        void panel.offsetWidth;
        panel.classList.add("is-animating");
      }
    });
    appTabState.active = tab.id;
    syncTabNav(tab.id);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (lenis) lenis.scrollTo(0, { immediate: true });
    if (opts.history !== false) {
      var targetHash = "#" + tab.hash;
      if (location.hash !== targetHash) {
        history.replaceState({ appTab: tab.id }, "", targetHash);
      }
    }
    onAppTabOpen(tab.id);
  }

  function syncTabNav(activeId) {
    var tab = findAppTab(activeId);
    var hash = "#" + tab.hash;
    document.querySelectorAll(".desk-nav a[href^='#'], #nav-panel a[href^='#'], .footer__nav-link[href^='#']").forEach(function (a) {
      var match = a.getAttribute("href") === hash || tabIdFromHash(a.getAttribute("href")) === activeId;
      a.classList.toggle("is-current", match);
      if (match) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.querySelectorAll(".app-tabbar__btn[data-app-tab]").forEach(function (btn) {
      var on = btn.getAttribute("data-app-tab") === activeId;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll(".nav-panel__tab[data-app-tab]").forEach(function (btn) {
      var on = btn.getAttribute("data-app-tab") === activeId;
      btn.classList.toggle("is-active", on);
      if (on) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
  }

  function onAppTabOpen(tabId) {
    if (appTabState.visited[tabId]) return;
    appTabState.visited[tabId] = true;
    window.dispatchEvent(new Event("resize"));
    var panel = document.querySelector('[data-app-tab="' + tabId + '"]');
    markContentImages();
    if (!panel) return;
    if (tabId === "portfolio") animateProjectCards();
    refreshPanelMotion(panel);
    if (tabId === "contacts" && panel.querySelector(".map-embed")) {
      window.dispatchEvent(new Event("resize"));
    }
  }

  function refreshPanelMotion(root) {
    if (!root || reduceMotion || !("IntersectionObserver" in window)) return;
    var nodes = root.querySelectorAll(".reveal:not(.is-in)");
    nodes.forEach(function (el) {
      if (!motionObserver) return;
      motionObserver.observe(el);
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        el.classList.add("is-in");
        motionObserver.unobserve(el);
      }
    });
  }

  function tabBarIcon(id) {
    if (id === "home") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/></svg>';
    }
    if (id === "catalog") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="7" height="7" rx="1.2"/><rect x="13" y="4" width="7" height="7" rx="1.2"/><rect x="4" y="13" width="7" height="7" rx="1.2"/><rect x="13" y="13" width="7" height="7" rx="1.2"/></svg>';
    }
    if (id === "portfolio") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M8 10.5h8M8 14h5"/></svg>';
    }
    if (id === "about") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 19c.8-3.2 3.3-5 6.5-5s5.7 1.8 6.5 5"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5.5 7.5 12 4l6.5 3.5v9L12 20l-6.5-3.5z"/><circle cx="12" cy="11.5" r="2.2"/></svg>';
  }

  function trapFocus(e) {
    var admin = document.getElementById("admin-root");
    var root = !document.getElementById("privacy-root").hidden
      ? document.getElementById("privacy-root")
      : (admin && !admin.hidden ? admin
      : (!document.getElementById("modal-root").hidden ? document.getElementById("modal-root") : null));
    if (!root) return;
    var nodes = Array.prototype.slice.call(root.querySelectorAll("a, button, input, textarea, select")).filter(function (el) {
      return !el.disabled && el.offsetParent !== null;
    });
    if (!nodes.length) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function clearForm(form) {
    form.querySelectorAll("[data-error-for]").forEach(function (el) { el.textContent = ""; });
    form.querySelectorAll(".is-invalid").forEach(function (el) { el.classList.remove("is-invalid"); });
    var slot = form.querySelector("[data-form-error]");
    if (slot) slot.textContent = "";
  }

  function clearField(form, name) {
    if (!form) return;
    setField(form, name, "");
  }

  function setField(form, name, message) {
    var slot = form.querySelector('[data-error-for="' + name + '"]');
    if (slot) slot.textContent = message || "";
    var input = form.querySelector("[name='" + name + "']");
    if (input && input.classList) {
      input.classList.toggle("is-invalid", Boolean(message));
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  function filterLabel(id) {
    var list = cfg.portfolio.filters;
    for (var i = 0; i < list.length; i += 1) if (list[i].id === id) return list[i].label;
    return "";
  }

  function daysLabel(n) {
    var forms = ui.dayForms;
    var n10 = n % 10;
    var n100 = n % 100;
    var word = forms[2];
    if (n100 < 11 || n100 > 14) {
      if (n10 === 1) word = forms[0];
      else if (n10 >= 2 && n10 <= 4) word = forms[1];
    }
    return n + " " + word;
  }

  function formatSize(n) { return n.toFixed(1).replace(".", ","); }

  function roundStep(n, step) {
    var places = Math.round(1 / step);
    return Math.round(n * places) / places;
  }

  function roundTo(n, step) { return Math.round(n / step) * step; }

  function money(n) {
    return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + "\u00A0₽";
  }

  function formatPhone(value) {
    var d = digits(value);
    if (!d) return "";
    if (d.charAt(0) === "8") d = "7" + d.slice(1);
    if (d.charAt(0) === "9") d = "7" + d;
    if (d.charAt(0) !== "7") d = "7" + d;
    d = d.slice(0, 11);
    var p = d.slice(1);
    var out = "+7";
    if (!p.length) return out;
    out += " (" + p.slice(0, 3);
    if (p.length >= 3) out += ")";
    if (p.length > 3) out += " " + p.slice(3, 6);
    if (p.length > 6) out += "-" + p.slice(6, 8);
    if (p.length > 8) out += "-" + p.slice(8, 10);
    return out;
  }

  function digits(value) { return String(value || "").replace(/\D/g, ""); }

  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setOg(property, content) {
    var node = document.querySelector('meta[property="' + property + '"]');
    if (node) node.setAttribute("content", content);
  }

  function lockPage() {
    document.body.style.overflow = "hidden";
    document.body.classList.add("modal-open");
    if (window.lenis) window.lenis.stop();
    else if (lenis) lenis.stop();
  }

  function unlockPage() {
    var privacy = document.getElementById("privacy-root");
    var modal = document.getElementById("modal-root");
    var admin = document.getElementById("admin-root");
    if ((privacy && !privacy.hidden) || (modal && !modal.hidden) || (admin && !admin.hidden)) return;
    document.body.style.overflow = "";
    document.body.classList.remove("modal-open");
    if (document.body.classList.contains("lock")) return;
    if (document.body.classList.contains("menu-open")) return;
    resumeLenisAfterOverlay();
  }

  function resetScroll() {
    if (typeof window.resetPageScroll === "function") window.resetPageScroll();
    if (lenis) lenis.scrollTo(0, { immediate: true });
  }

  function startLenis() {
    if (!window.Lenis || reduceMotion) return;
    lenis = new window.Lenis({
      duration: 1.05,
      smoothWheel: true,
      smoothTouch: false,
      syncTouch: false,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.1
    });
    window.lenis = lenis;
    document.documentElement.classList.add("lenis");
    if (cfg.demoIntro && !demoDismissed) lenis.stop();
    bindLenisMenuClose();
  }

  function frame(time) {
    if (lenis) lenis.raf(time);
    paintParallax();
    updateReadProgress();
    requestAnimationFrame(frame);
  }

  function updateReadProgress() {
    var bar = document.querySelector(".read-progress span");
    if (!bar) return;
    var scroll = lenis && typeof lenis.scroll === "number" ? lenis.scroll : (window.scrollY || document.documentElement.scrollTop);
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.max(0, Math.min(1, scroll / max)) : 0;
    bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
  }

  function startIntro() {
    if (!cfg.demoIntro || reduceMotion || demoDismissed) {
      if (!document.documentElement.classList.contains("is-revealed")) {
        document.documentElement.classList.add("is-revealed");
      }
      if (!document.documentElement.classList.contains("is-settled-hero")) {
        document.documentElement.classList.add("is-settled-hero");
      }
      if (lenis && !document.getElementById("demo-cover")) lenis.start();
      maybeOpenAdmin();
    }
  }

  function bindDemoDismiss() {
    if (!cfg.demoIntro || reduceMotion) return;
    var cover = document.getElementById("demo-cover");
    if (!cover) return;
    cover.addEventListener("wheel", function (e) {
      if (demoDismissed) return;
      if (e.deltaY > 12) {
        e.preventDefault();
        dismissDemoCover();
      }
    }, { passive: false });
    cover.addEventListener("touchstart", function (e) {
      if (demoDismissed || !e.touches.length) return;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    cover.addEventListener("touchend", function (e) {
      if (demoDismissed || !e.changedTouches.length) return;
      if (touchStartY - e.changedTouches[0].clientY > 48) dismissDemoCover();
    }, { passive: true });
  }

  function dismissDemoCover() {
    if (demoDismissed) return;
    var cover = document.getElementById("demo-cover");
    if (!cover) return;
    demoDismissed = true;
    switchAppTab("home", { history: false, animate: false });
    resetPageScroll();
    cover.classList.add("is-leave");
    document.documentElement.classList.add("is-revealed");
    document.body.classList.remove("lock");
    if (lenis) lenis.start();
    window.setTimeout(function () {
      if (cover.parentNode) cover.remove();
      maybeOpenAdmin();
    }, 750);
    window.setTimeout(function () {
      document.documentElement.classList.add("is-settled-hero");
    }, 1550);
  }

  function paintParallax() {
    if (reduceMotion) return;
    var nodes = document.querySelectorAll("[data-parallax]");
    var view = window.innerHeight || 1;
    for (var i = 0; i < nodes.length; i += 1) {
      var parent = nodes[i].parentElement;
      if (!parent) continue;
      var rect = parent.getBoundingClientRect();
      if (rect.bottom < -120 || rect.top > view + 120) continue;
      var progress = (rect.top + rect.height * 0.5 - view * 0.5) / view;
      var shift = Math.max(-35, Math.min(35, progress * -35));
      var scale = 1.08 - Math.min(0.08, Math.abs(progress) * 0.14);
      nodes[i].style.transform = "translate3d(0," + shift.toFixed(2) + "px,0) scale(" + scale.toFixed(4) + ")";
    }
  }

  function mountMotion() {
    if (motionObserver) motionObserver.disconnect();
    var singles = document.querySelectorAll(".section-head, #final .final, .calc-main, .calc-aside");
    var lists = document.querySelectorAll(".cat-list, .steps, .review-list");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      singles.forEach(function (el) { el.classList.add("is-settled"); });
      lists.forEach(function (list) {
        Array.prototype.forEach.call(list.children, function (el) { el.classList.add("is-settled"); });
      });
      document.querySelectorAll("[data-project]").forEach(function (el) { el.classList.add("is-settled"); });
      bindTilt(document);
      return;
    }
    singles.forEach(function (el) {
      el.classList.add("reveal");
      el.style.setProperty("--d", "0ms");
    });
    lists.forEach(function (list) {
      Array.prototype.forEach.call(list.children, function (el, index) {
        el.classList.add("reveal");
        el.style.setProperty("--d", index * 90 + "ms");
      });
    });
    motionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        motionObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    singles.forEach(function (el) { motionObserver.observe(el); });
    lists.forEach(function (list) {
      Array.prototype.forEach.call(list.children, function (el) { motionObserver.observe(el); });
    });
    bindTilt(document);
    bindMagnetic(document);
  }

  function bindMagnetic(root) {
    if (reduceMotion || window.matchMedia("(pointer: coarse)").matches) return;
    root.querySelectorAll(".magnetic").forEach(function (btn) {
      if (btn.getAttribute("data-magnetic-bound")) return;
      btn.setAttribute("data-magnetic-bound", "1");
      btn.addEventListener("pointermove", function (e) {
        var rect = btn.getBoundingClientRect();
        var dx = ((e.clientX - rect.left) / rect.width - 0.5) * 7;
        var dy = ((e.clientY - rect.top) / rect.height - 0.5) * 4;
        btn.style.transform = "translate(" + dx.toFixed(2) + "px," + dy.toFixed(2) + "px)";
      });
      btn.addEventListener("pointerleave", function () {
        btn.style.transform = "";
      });
    });
  }

  function bindTilt(root) {
    if (reduceMotion || window.matchMedia("(pointer: coarse)").matches) return;
    root.querySelectorAll(".tilt").forEach(function (card) {
      if (card.getAttribute("data-tilt-bound")) return;
      card.setAttribute("data-tilt-bound", "1");
      var glare = document.createElement("span");
      glare.className = "glare";
      glare.setAttribute("aria-hidden", "true");
      card.appendChild(glare);
      card.addEventListener("pointermove", function (e) {
        var rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width;
        var py = (e.clientY - rect.top) / rect.height;
        var rx = (0.5 - py) * 8;
        var ry = (px - 0.5) * 8;
        card.style.transform = "perspective(1000px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)";
        glare.style.opacity = "1";
        glare.style.background = "radial-gradient(circle at " + (px * 100).toFixed(1) + "% " + (py * 100).toFixed(1) + "%, rgba(255,255,255,.42), transparent 55%)";
      });
      card.addEventListener("pointerleave", function () {
        card.style.transform = "";
        glare.style.opacity = "0";
      });
    });
  }

  function readLeads() {
    try {
      var parsed = JSON.parse(localStorage.getItem(cfg.admin.leadsKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function writeLeads(leads) {
    localStorage.setItem(cfg.admin.leadsKey, JSON.stringify(leads));
  }

  function saveLead(payload) {
    var q = quote();
    var lead = {
      id: Date.now().toString(36),
      at: new Date().toISOString(),
      name: payload.name,
      phone: payload.phone,
      source: payload.form,
      project: payload.project || "",
      product: q.product.title,
      size: formatSize(q.size) + " " + q.product.unit,
      material: q.material.title + " — " + q.material.description,
      timing: q.timing.title,
      quote: "от " + money(q.low) + " до " + money(q.high),
      status: cfg.admin.statuses[0]
    };
    var leads = readLeads();
    leads.unshift(lead);
    writeLeads(leads);
    return lead;
  }

  function requestAdmin() {
    var cover = document.getElementById("demo-cover");
    if ((cover && !demoDismissed) || (document.documentElement.classList.contains("has-intro") && !document.documentElement.classList.contains("is-settled-hero"))) {
      adminQueued = true;
      return;
    }
    openPin();
  }

  function maybeOpenAdmin() {
    var params = new URLSearchParams(window.location.search);
    if (adminQueued || params.get("admin") === "1") openPin();
    adminQueued = false;
  }

  function openPin() {
    var root = document.getElementById("admin-root");
    root.hidden = false;
    root.innerHTML =
      '<div class="modal admin modal__dialog" role="dialog" aria-modal="true" aria-labelledby="pin-title">' +
        '<div class="modal__content">' +
        '<header><div><p class="eyebrow">' + esc(cfg.brand.name) + '</p><h3 id="pin-title">' + esc(ui.adminPinTitle) + '</h3></div>' +
        '<button class="x" type="button" data-action="close-admin" aria-label="' + esc(ui.close) + '">×</button></header>' +
        '<p>' + esc(ui.adminPinText) + '</p>' +
        '<form data-pin class="form" style="margin-top:16px">' +
          '<label class="field"><span>' + esc(ui.adminPinLabel) + '</span>' +
            '<input type="password" name="pin" inputmode="numeric" autocomplete="off" maxlength="12"></label>' +
          '<p class="field-error" data-pin-error></p>' +
          '<button class="btn btn-primary" type="submit">' + esc(ui.adminEnter) + '</button>' +
        '</form>' +
        '</div></div>';
    markLenisPrevent(root);
    lockPage();
    var input = root.querySelector("input");
    if (input) input.focus();
  }

  function checkPin(form) {
    var value = form.pin.value.trim();
    if (value !== String(cfg.admin.pin)) {
      var slot = form.querySelector("[data-pin-error]");
      if (slot) slot.textContent = ui.adminPinError;
      return;
    }
    renderCabinet();
  }

  function renderCabinet() {
    var root = document.getElementById("admin-root");
    var prices = calc.products.map(function (item) {
      return '<label class="field"><span>' + esc(item.title) + '</span><input type="number" min="1" step="1000" name="price-' + esc(item.id) + '" value="' + esc(item.base) + '"></label>';
    }).join("");
    root.innerHTML =
      '<div class="modal modal-wide admin modal__dialog" role="dialog" aria-modal="true" aria-labelledby="admin-title">' +
        '<div class="modal__content">' +
        '<header><div><p class="eyebrow">' + esc(cfg.brand.name) + '</p><h3 id="admin-title">' + esc(ui.adminTitle) + '</h3></div>' +
        '<button class="x" type="button" data-action="close-admin" aria-label="' + esc(ui.close) + '">×</button></header>' +
        '<div class="filters" role="tablist">' +
          '<button class="filter is-active" type="button" data-action="admin-tab" data-tab="leads">' + esc(ui.adminLeads) + '</button>' +
          '<button class="filter" type="button" data-action="admin-tab" data-tab="settings">' + esc(ui.adminSettings) + '</button>' +
        '</div>' +
        '<div data-panel="leads"><div id="lead-list"></div>' +
          '<button class="btn btn-line" type="button" data-action="export-csv" style="margin-top:14px">' + esc(ui.adminExport) + '</button></div>' +
        '<form data-settings data-panel="settings" class="form" hidden>' +
          '<div class="fields">' +
            fieldInput(ui.adminCompany, "legalName", cfg.brand.legalName, "text") +
            fieldInput(ui.adminShort, "shortName", cfg.brand.name, "text") +
            fieldInput(ui.adminCity, "city", cfg.brand.city, "text") +
            fieldInput(ui.adminPhone, "phone", cfg.contacts.phone, "tel") +
            fieldInput(ui.adminTelegram, "telegram", cfg.contacts.telegram, "url") +
            fieldInput(ui.adminWhatsapp, "whatsapp", cfg.contacts.whatsapp, "url") +
            fieldInput(ui.adminVk, "vk", cfg.contacts.vk, "url") +
            fieldInput(ui.adminPinField, "pin", cfg.admin.pin, "text") +
          '</div>' +
          '<p class="fine" style="margin-top:8px">' + esc(ui.adminPrices) + '</p>' +
          '<div class="fields">' + prices + '</div>' +
          '<p class="fine">' + esc(ui.adminOptional) + '</p>' +
          '<div class="fields">' +
            fieldInput(ui.adminBot, "botToken", cfg.telegram.botToken, "text") +
            fieldInput(ui.adminChat, "chatId", cfg.telegram.chatId, "text") +
            fieldInput(ui.adminGas, "googleScriptUrl", cfg.telegram.googleScriptUrl, "url") +
          '</div>' +
          '<button class="btn btn-primary" type="button" data-action="download-config">' + esc(ui.adminDownload) + '</button>' +
        '</form>' +
        '</div></div>';
    markLenisPrevent(root);
    root.hidden = false;
    lockPage();
    paintLeads();
  }

  function fieldInput(label, name, value, type) {
    return '<label class="field"><span>' + esc(label) + '</span><input type="' + type + '" name="' + name + '" value="' + esc(value) + '"></label>';
  }

  function switchAdminTab(tab) {
    var root = document.getElementById("admin-root");
    root.querySelectorAll("[data-action='admin-tab']").forEach(function (btn) {
      var on = btn.getAttribute("data-tab") === tab;
      btn.classList.toggle("is-active", on);
    });
    root.querySelectorAll("[data-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-panel") !== tab;
    });
  }

  function paintLeads() {
    var list = document.getElementById("lead-list");
    if (!list) return;
    var leads = readLeads();
    if (!leads.length) {
      list.innerHTML = '<p class="fine">' + esc(ui.adminEmpty) + '</p>';
      return;
    }
    list.innerHTML = leads.map(function (lead) {
      var options = cfg.admin.statuses.map(function (status) {
        return '<option' + (status === lead.status ? ' selected' : '') + '>' + esc(status) + '</option>';
      }).join("");
      return (
        '<article class="lead-card">' +
          '<header><strong>' + esc(lead.name) + '</strong><time>' + esc(formatWhen(lead.at)) + '</time></header>' +
          '<p>' + esc(lead.phone) + ' · ' + esc(lead.source) + (lead.project ? ' · ' + esc(lead.project) : '') + '</p>' +
          '<p class="fine">' + esc(lead.product) + ' · ' + esc(lead.size) + '<br>' + esc(lead.material) + '<br>' + esc(lead.timing) + ' · ' + esc(lead.quote) + '</p>' +
          '<div class="lead-tools"><label><span class="fine">' + esc(ui.adminStatus) + '</span> ' +
            '<select data-lead-status="' + esc(lead.id) + '">' + options + '</select></label>' +
            '<button class="btn btn-line" type="button" data-action="lead-delete" data-id="' + esc(lead.id) + '">' + esc(ui.adminDelete) + '</button></div>' +
        '</article>'
      );
    }).join("");
  }

  function deleteLead(id) {
    writeLeads(readLeads().filter(function (lead) { return lead.id !== id; }));
    paintLeads();
  }

  function exportCsv() {
    var headers = ["Дата", "Имя", "Телефон", "Форма", "Проект", "Изделие", "Размер", "Материалы", "Срок", "Оценка", "Статус"];
    var rows = [headers].concat(readLeads().map(function (lead) {
      return [formatWhen(lead.at), lead.name, lead.phone, lead.source, lead.project, lead.product, lead.size, lead.material, lead.timing, lead.quote, lead.status];
    }));
    var csv = "\uFEFF" + rows.map(function (row) {
      return row.map(function (cell) {
        return '"' + String(cell == null ? "" : cell).replace(/"/g, '""') + '"';
      }).join(";");
    }).join("\n");
    downloadBlob(csv, "zayavki.csv", "text/csv;charset=utf-8");
  }

  function downloadConfig() {
    var form = document.querySelector("[data-settings]");
    if (!form) return;
    cfg.brand.legalName = form.legalName.value.trim() || cfg.brand.legalName;
    cfg.brand.name = form.shortName.value.trim() || cfg.brand.name;
    cfg.brand.city = form.city.value.trim() || cfg.brand.city;
    cfg.contacts.phone = form.phone.value.trim() || cfg.contacts.phone;
    cfg.contacts.phoneTel = telFrom(cfg.contacts.phone);
    cfg.contacts.telegram = form.telegram.value.trim();
    cfg.contacts.whatsapp = form.whatsapp.value.trim();
    cfg.contacts.vk = form.vk.value.trim();
    cfg.admin.pin = form.pin.value.trim() || cfg.admin.pin;
    cfg.telegram.botToken = form.botToken.value.trim();
    cfg.telegram.chatId = form.chatId.value.trim();
    cfg.telegram.googleScriptUrl = form.googleScriptUrl.value.trim();
    calc.products.forEach(function (item) {
      var input = form.querySelector("[name='price-" + item.id + "']");
      var next = Number(input && input.value);
      if (next > 0) item.base = next;
    });
    var overrides = {
      legalName: cfg.brand.legalName,
      name: cfg.brand.name,
      city: cfg.brand.city,
      phone: cfg.contacts.phone,
      phoneTel: cfg.contacts.phoneTel,
      telegram: cfg.contacts.telegram,
      whatsapp: cfg.contacts.whatsapp,
      vk: cfg.contacts.vk,
      pin: cfg.admin.pin,
      botToken: cfg.telegram.botToken,
      chatId: cfg.telegram.chatId,
      googleScriptUrl: cfg.telegram.googleScriptUrl,
      prices: {}
    };
    calc.products.forEach(function (item) { overrides.prices[item.id] = item.base; });
    localStorage.setItem(cfg.admin.overridesKey, JSON.stringify(overrides));
    applyTheme();
    render();
    updateQuote();
    syncRange();
    watchSections();
    mountMotion();
    initAppTabs();
    var source = "/**\n * Файл собран в кабинете владельца. Замените им config.js.\n */\nwindow.SITE_CONFIG = " + JSON.stringify(cfg, null, 2) + ";\n";
    downloadBlob(source, "config.js", "application/javascript");
    renderCabinet();
    switchAdminTab("settings");
  }

  function applyOverrides() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(cfg.admin.overridesKey) || "null"); } catch (err) { raw = null; }
    if (!raw) return;
    if (raw.legalName) cfg.brand.legalName = raw.legalName;
    if (raw.name) cfg.brand.name = raw.name;
    if (raw.city) cfg.brand.city = raw.city;
    if (raw.phone) cfg.contacts.phone = raw.phone;
    if (raw.phoneTel) cfg.contacts.phoneTel = raw.phoneTel;
    if (typeof raw.telegram === "string") cfg.contacts.telegram = raw.telegram;
    if (typeof raw.whatsapp === "string") cfg.contacts.whatsapp = raw.whatsapp;
    if (typeof raw.vk === "string") cfg.contacts.vk = raw.vk;
    if (raw.pin) cfg.admin.pin = String(raw.pin);
    if (typeof raw.botToken === "string") cfg.telegram.botToken = raw.botToken;
    if (typeof raw.chatId === "string") cfg.telegram.chatId = raw.chatId;
    if (typeof raw.googleScriptUrl === "string") cfg.telegram.googleScriptUrl = raw.googleScriptUrl;
    if (raw.prices) {
      calc.products.forEach(function (item) {
        var next = Number(raw.prices[item.id]);
        if (next > 0) item.base = next;
      });
    }
  }

  function telFrom(phone) {
    var d = digits(phone);
    if (d.charAt(0) === "8") d = "7" + d.slice(1);
    if (d && d.charAt(0) !== "7") d = "7" + d;
    return d ? "+" + d : cfg.contacts.phoneTel;
  }

  function formatWhen(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleString("ru-RU", { hour12: false });
  }

  function downloadBlob(text, name, type) {
    var blob = new Blob([text], { type: type });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function closeAdmin() {
    var root = document.getElementById("admin-root");
    root.hidden = true;
    root.innerHTML = "";
    unlockPage();
  }

  function icon(name) {
    if (name === "phone") {
      return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 4h3l1 3-2 1.2a12 12 0 0 0 5.8 5.8L17 12l3 1v3a2 2 0 0 1-2 2A14 14 0 0 1 6 6a2 2 0 0 1 2-2z"/></svg>';
    }
    if (name === "tg") {
      return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 12 20 5l-3 14-5-4-3 3v-4l9-8"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 18 7.2 15A7 7 0 1 1 9.5 18.2L6 18z"/></svg>';
  }
})();

(function removeNetlifyBadge() {
  var LABEL = /powered by netlify|build your own site with netlify/i;

  function isNetlifyBadge(el) {
    if (!el || el.nodeType !== 1) return false;
    var idClass = (el.id || "") + " " + (typeof el.className === "string" ? el.className : "");
    if (/netlify/i.test(idClass)) return true;
    if (el.matches && el.matches('a[href*="netlify"]')) {
      return window.getComputedStyle(el).position === "fixed";
    }
    var text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!LABEL.test(text)) return false;
  }

  function purge(root) {
    var list = (root || document).querySelectorAll("a, div, span, p");
    for (var i = 0; i < list.length; i += 1) {
      var el = list[i];
      if (!isNetlifyBadge(el)) continue;
      if (window.getComputedStyle(el).position === "fixed" || el.matches('a[href*="netlify"]')) {
        el.remove();
      }
    }
  }

  purge();
  if (!document.body || !("MutationObserver" in window)) return;
  new MutationObserver(function () { purge(); }).observe(document.body, { childList: true, subtree: true });
})();

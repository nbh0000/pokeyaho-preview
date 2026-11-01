/* 포케야호 공통 스크립트: 장바구니(브라우저 저장), 바텀시트, 방송 상태 폴링, 주소 찾기, 복사 */
(function () {
  'use strict';
  var GM = window.GM || {};
  var OPT = GM.opt || { opened: '라이브 개봉', unopened: '미개봉 발송' };
  var KEY = 'py_cart_v1';
  var footerVisible = false;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var won = function (n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var csrf = ($('meta[name="csrf"]') || {}).content || '';

  // ===== API =====
  function api(method, url, body) {
    return fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf, Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, message: '서버 응답을 읽을 수 없습니다' }; }).then(function (j) {
        if (r.status === 401 && j.login) {
          location.href = '/pokeyaho-preview/login?next=' + encodeURIComponent(location.pathname);
          throw new Error(j.message);
        }
        if (r.status === 400 && j.profile) {
          location.href = '/pokeyaho-preview/signup/profile';
          throw new Error(j.message);
        }
        if (!r.ok || j.ok === false) throw new Error(j.message || '요청을 처리하지 못했습니다');
        return j;
      });
    });
  }

  // ===== 토스트 =====
  var toastEl = null, toastTimer = null;
  function toast(msg, type) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.className = 'toast' + (type === 'error' ? ' error' : '');
    requestAnimationFrame(function () { toastEl.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }
  var flashEl = $('[data-flash]');
  if (flashEl) setTimeout(function () { flashEl.classList.remove('show'); }, 3200);

  // ===== 장바구니 저장소 =====
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function save(cart) {
    try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) { /* 사파리 사생활 보호 모드 등 */ }
    renderBadge();
  }
  function lineQty(l) { return l.option ? (l.opened || 0) + (l.unopened || 0) : (l.qty || 0); }
  function cartCount(cart) { return (cart || load()).reduce(function (s, l) { return s + lineQty(l); }, 0); }
  function cartTotal(cart) { return (cart || load()).reduce(function (s, l) { return s + (l.price || 0) * lineQty(l); }, 0); }
  function toLines(cart) {
    return (cart || load()).map(function (l) {
      return { productId: l.productId, packageType: l.packageType || 'standard', opened: l.opened || 0, unopened: l.unopened || 0, qty: l.option ? 0 : (l.qty || 0) };
    });
  }

  function renderBadge() {
    var n = cartCount();
    $$('[data-cart-count]').forEach(function (el) { el.textContent = n; el.hidden = n === 0; });
    var bar = $('[data-cartbar]');
    if (bar) {
      bar.classList.toggle('show', n > 0 && !footerVisible);
      var t = $('[data-cartbar-text]', bar);
      if (t) t.textContent = n + '개' + (GM.showPrice ? ' · ' + won(cartTotal()) : '');
    }
  }

  // ===== 바텀시트 =====
  function watchFooter() {
    var footer = $('.foot');
    if (!footer) return;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        footerVisible = !!(entries[0] && entries[0].isIntersecting);
        renderBadge();
      }, { rootMargin: '0px 0px 80px 0px', threshold: 0 }).observe(footer);
      return;
    }
    var check = function () {
      var rect = footer.getBoundingClientRect();
      footerVisible = rect.top < window.innerHeight + 80 && rect.bottom > 0;
      renderBadge();
    };
    window.addEventListener('scroll', check, { passive: true });
    check();
  }

  document.addEventListener('gm:cart-updated', renderBadge);
  watchFooter();
  var backdrop = $('[data-backdrop]');
  var openSheetEl = null;
  function openSheet(el) {
    if (openSheetEl && openSheetEl !== el) closeSheet();
    el.removeAttribute('hidden');
    el.hidden = false;
    openSheetEl = el;
    requestAnimationFrame(function () {
      el.classList.add('open');
      if (backdrop) backdrop.classList.add('open');
    });
    document.documentElement.style.overflow = 'hidden';
  }
  function closeSheet() {
    if (!openSheetEl) return;
    var el = openSheetEl;
    openSheetEl = null;
    el.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    document.documentElement.style.overflow = '';
    setTimeout(function () { if (!el.classList.contains('open')) { el.hidden = true; el.setAttribute('hidden', ''); } }, 320);
  }
  if (backdrop) backdrop.addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
  $$('[data-close-sheet]').forEach(function (b) { b.addEventListener('click', closeSheet); });
  $$('[data-open-review-sheet]').forEach(function (button) {
    button.addEventListener('click', function () {
      var id = button.getAttribute('data-open-review-sheet');
      var sheet = id ? document.getElementById(id) : null;
      if (!sheet) return;
      openSheet(sheet);
      var rating = $('[name="rating"]', sheet);
      if (rating) setTimeout(function () { rating.focus(); }, 260);
    });
  });

  // 아래로 끌어서 닫기 (손잡이/헤더 영역)
  $$('.sheet').forEach(function (sheet) {
    var startY = null, dy = 0;
    var handle = function (e) { return e.target.closest('.sheet-grab, .sheet-head'); };
    sheet.addEventListener('pointerdown', function (e) {
      if (!handle(e) || e.target.closest('button')) return;
      startY = e.clientY; dy = 0;
      sheet.style.transition = 'none';
      sheet.setPointerCapture(e.pointerId);
    });
    sheet.addEventListener('pointermove', function (e) {
      if (startY === null) return;
      dy = Math.max(0, e.clientY - startY);
      sheet.style.transform = 'translateY(' + dy + 'px)';
    });
    var end = function () {
      if (startY === null) return;
      startY = null;
      sheet.style.transition = '';
      sheet.style.transform = '';
      if (dy > 90) closeSheet();
    };
    sheet.addEventListener('pointerup', end);
    sheet.addEventListener('pointercancel', end);
  });

  // ===== 스테퍼 =====
  function stepper(value, min, max, onChange, small) {
    var wrap = document.createElement('div');
    wrap.className = 'stepper' + (small ? ' sm' : '');
    wrap.innerHTML = '<button type="button" class="minus" aria-label="빼기">−</button><output>' + value + '</output><button type="button" class="plus" aria-label="더하기">+</button>';
    var out = $('output', wrap), minus = $('.minus', wrap), plus = $('.plus', wrap);
    function sync() {
      out.textContent = value;
      minus.disabled = value <= min;
      plus.disabled = value >= max();
    }
    minus.addEventListener('click', function () { if (value > min) { value--; sync(); onChange(value); } });
    plus.addEventListener('click', function () {
      if (value < max()) { value++; sync(); onChange(value); }
      else toast('더 담을 수 없는 상품이에요', 'error');
    });
    wrap.sync = sync;
    sync();
    return wrap;
  }

  // ===== 상품 시트 =====
  var ps = $('#productSheet');
  var psState = null;

  function openProduct(id) {
    if (!ps) return;
    api('GET', '/api/products/' + id).then(function (j) {
      var p = j.product;
      GM.live = j.live;
      var inCart = load().filter(function (l) { return l.productId === p.id; })[0];
      var already = inCart ? lineQty(inCart) : 0;
      psState = { p: p, packageType: 'full', opened: 0, unopened: 0, qty: p.useOpenOption ? 0 : 1, already: already };
      var body = $('[data-ps-body]', ps);
      var packagePrice = function () {
        if (!p.usePackageOption) return p.price;
        return psState.packageType === 'full' ? (p.fullBoxPrice || p.price) : (p.loosePrice || p.price);
      };
      var imgs = p.images.length
        ? p.images.map(function (i) { return '<div class="thumb"><img src="/img/' + i + '" alt=""></div>'; }).join('')
        : '<div class="thumb"><span class="ph">?</span></div>';
      var packageHtml = p.usePackageOption
        ? '<div class="detail-package-box"><div class="detail-option-label"><strong>상품 구성을 골라 주세요</strong><span>풀박 또는 낱박</span></div><div class="detail-package-options"><label class="detail-package-option"><input type="radio" name="sheetPackage" value="full" checked><span class="package-option-content"><span class="package-option-image">' + (p.fullBoxImageId ? '<img src="/img/' + p.fullBoxImageId + '" alt="풀박">' : '풀박') + '</span><span><strong>풀박</strong><small>풀박스 구성</small><b>' + won(p.fullBoxPrice || p.price) + '</b></span></span></label><label class="detail-package-option"><input type="radio" name="sheetPackage" value="loose"><span class="package-option-content"><span class="package-option-image">' + (p.looseImageId ? '<img src="/img/' + p.looseImageId + '" alt="낱박">' : '낱박') + '</span><span><strong>낱박</strong><small>패키지 내 개별 상품</small><b>' + won(p.loosePrice || p.price) + '</b></span></span></label></div></div>'
        : '';
      body.innerHTML =
        '<div class="p-gallery">' + imgs + '</div>' +
        '<div class="p-name" id="ps-name">' + esc(p.name) + '</div>' +
        (p.price != null ? '<div class="p-price" data-sheet-price>' + won(packagePrice()) + '</div>' : '<div class="price hidden">가격은 방송 중에 공개돼요</div>') +
        '<div class="p-meta">' +
          (p.soldout ? '<span class="chip gray">품절</span>' : (p.showStock ? '<span class="chip">재고 ' + p.stock + '개</span>' : '')) +
          (already ? '<span class="chip gray">장바구니에 ' + already + '개</span>' : '') +
        '</div>' +
        packageHtml +
        (p.expectedShippingText ? '<p class="expected-shipping">예상 배송일 <strong>' + esc(p.expectedShippingText) + '</strong></p>' : '') +
        (p.shortDescription ? '<div class="p-desc">' + esc(p.shortDescription) + '</div>' : '') +
        '<div class="opt-box" data-ps-opts></div>';
      var opts = $('[data-ps-opts]', body);
      $$('input[name="sheetPackage"]', body).forEach(function (radio) {
        radio.addEventListener('change', function () {
          if (!this.checked) return;
          psState.packageType = this.value;
          var priceEl = $('[data-sheet-price]', body);
          if (priceEl) priceEl.textContent = won(packagePrice());
          syncAdd();
        });
      });
      var left = function () { return Math.max(0, p.stock - already); };
      var total = function () { return p.useOpenOption ? psState.opened + psState.unopened : psState.qty; };
      if (!p.soldout && j.live) {
        if (p.useOpenOption) {
          opts.innerHTML = '<div class="opt-label">개봉 방법을 골라 주세요 <small>수량별로 나눠 담을 수 있어요</small></div>';
          [['opened', OPT.opened, '방송에서 바로 개봉해 드려요'], ['unopened', OPT.unopened, '포장 그대로 보내 드려요']].forEach(function (o) {
            var row = document.createElement('div');
            row.className = 'opt-row';
            row.innerHTML = '<div class="lbl">' + o[1] + '<small>' + o[2] + '</small></div>';
            var st = stepper(0, 0, function () { return psState[o[0]] + (left() - total()); }, function (v) { psState[o[0]] = v; syncAdd(); syncSteppers(); });
            row.appendChild(st);
            opts.appendChild(row);
          });
        } else {
          var row = document.createElement('div');
          row.className = 'opt-row';
          row.innerHTML = '<div class="lbl">수량</div>';
          row.appendChild(stepper(Math.min(1, left()), Math.min(1, left()), function () { return left(); }, function (v) { psState.qty = v; syncAdd(); }));
          psState.qty = Math.min(1, left());
          opts.appendChild(row);
        }
      }
      function syncSteppers() { $$('.stepper', opts).forEach(function (s) { s.sync(); }); }
      syncAdd();
      openSheet(ps);
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  function syncAdd() {
    var btn = $('[data-ps-add]', ps);
    if (!psState) return;
    var p = psState.p;
    var n = p.useOpenOption ? psState.opened + psState.unopened : psState.qty;
    btn.disabled = false;
    if (!GM.live) { btn.textContent = '방송 중에만 주문할 수 있어요'; btn.disabled = true; return; }
    if (p.soldout) { btn.textContent = '품절된 상품이에요'; btn.disabled = true; return; }
    if (psState.already >= p.stock) { btn.textContent = '더 담을 수 없는 상품이에요'; btn.disabled = true; return; }
    if (n < 1) { btn.textContent = p.useOpenOption ? '개봉 방법과 수량을 골라 주세요' : '수량을 골라 주세요'; btn.disabled = true; return; }
    var unitPrice = p.usePackageOption ? (psState.packageType === 'full' ? (p.fullBoxPrice || p.price) : (p.loosePrice || p.price)) : p.price;
    btn.innerHTML = n + '개 담기' + (unitPrice != null ? ' <span class="sub">' + won(unitPrice * n) + '</span>' : '');
  }

  if (ps) {
    $('[data-ps-add]', ps).addEventListener('click', function () {
      if (!psState) return;
      var p = psState.p;
      var cart = load();
       var packageType = p.usePackageOption ? psState.packageType : 'standard';
       var unitPrice = p.usePackageOption ? (packageType === 'full' ? (p.fullBoxPrice || p.price) : (p.loosePrice || p.price)) : p.price;
       var line = cart.filter(function (l) { return l.productId === p.id && (l.packageType || 'standard') === packageType; })[0];
       if (!line) {
         line = { productId: p.id, name: p.name, price: unitPrice, packageType: packageType, imageId: p.images[0] || null, option: p.useOpenOption, opened: 0, unopened: 0, qty: 0 };
         cart.push(line);
       }
       line.price = unitPrice;
      line.name = p.name;
      line.price = p.price;
      if (p.useOpenOption) {
        line.opened = (line.opened || 0) + psState.opened;
        line.unopened = (line.unopened || 0) + psState.unopened;
      } else {
        line.qty = (line.qty || 0) + psState.qty;
      }
      save(cart);
      closeSheet();
      toast('장바구니에 담았습니다');
    });
  }

  $$('[data-product]').forEach(function (card) {
    // 상품은 항상 독립 상세 페이지로 이동합니다. 상품 모달을 열지 않습니다.
    var id = Number(card.getAttribute('data-product'));
    if (!id) return;
    // 홈 상품 카드(.pcard)는 안에 링크와 수량 버튼이 따로 있으므로 카드 전체 클릭으로 이동하지 않는다.
    if (card.classList.contains('pcard')) return;
    card.addEventListener('click', function (e) {
      if (card.tagName.toLowerCase() === 'a') return;
      e.preventDefault();
      location.href = '/pokeyaho-preview/p/' + id;
    });
  });

  // ===== 장바구니 시트 =====
  var cs = $('#cartSheet');
  function renderCart(quote) {
    if (!cs) return;
    var cart = load();
    var body = $('[data-cart-body]', cs);
    var foot = $('[data-cart-foot]', cs);
    if (!cart.length) {
      body.innerHTML = '<div class="empty"><div class="big">?</div><p>장바구니가 비어 있어요</p></div>';
      foot.hidden = true;
      return;
    }
    foot.hidden = false;
    var problems = {};
    if (quote) quote.lines.forEach(function (l) { problems[l.productId + ':' + (l.packageType || 'standard')] = l; });
    body.innerHTML = '';
    cart.forEach(function (l, idx) {
      var q = problems[l.productId + ':' + (l.packageType || 'standard')];
      var row = document.createElement('div');
      row.className = 'cart-line';
      row.innerHTML =
        '<div class="thumb">' + (l.imageId ? '<img src="/img/' + l.imageId + '" alt="">' : '<span class="ph">?</span>') + '</div>' +
          '<div class="info">' +
          '<div class="nm">' + esc(l.name) + '</div>' +
          (l.packageType && l.packageType !== 'standard' ? '<div class="opt">' + (l.packageType === 'full' ? '풀박 · 풀박스 구성' : '낱박 · 패키지 내 개별 상품') + '</div>' : '') +
          (q && q.problem ? '<div class="problem">' + esc(q.problem) + '</div>' : '') +
          '<div class="ctrl" data-ctrl></div>' +
          '<div class="ctrl"><span class="amt num">' + (l.price != null ? won(l.price * lineQty(l)) : '가격 방송 중 공개') + '</span><button type="button" class="rm">삭제</button></div>' +
        '</div>';
      var ctrl = $('[data-ctrl]', row);
      var stock = q && q.stock != null ? q.stock : 99;
      var update = function () { save(cart); renderCart(quote); };
      if (l.option) {
        var split = document.createElement('div');
        split.className = 'split';
        [['opened', OPT.opened], ['unopened', OPT.unopened]].forEach(function (o) {
          var s = document.createElement('div');
          s.className = 's';
          s.innerHTML = '<span>' + o[1] + '</span>';
          s.appendChild(stepper(l[o[0]] || 0, 0, function () { return (l[o[0]] || 0) + Math.max(0, stock - lineQty(l)); }, function (v) {
            l[o[0]] = v;
            if (lineQty(l) === 0) cart.splice(idx, 1);
            update();
          }, true));
          split.appendChild(s);
        });
        ctrl.appendChild(split);
      } else {
        ctrl.appendChild(stepper(l.qty || 1, 1, function () { return stock; }, function (v) { l.qty = v; update(); }, true));
      }
      $('.rm', row).addEventListener('click', function () { cart.splice(idx, 1); update(); });
      body.appendChild(row);
    });
    $('[data-cart-total]', cs).textContent = GM.showPrice ? won(cartTotal(cart)) : '방송 중 공개';
    var hint = $('[data-cart-hint]', cs);
    if (hint) hint.textContent = won(GM.freeShip) + ' 이상 바로배송 무료 · 킵은 배송비를 지금 결제하지 않아요';
    var go = $('[data-go-checkout]', cs);
    var bad = quote && quote.hasProblem;
    go.classList.toggle('disabled', !GM.live || bad);
    go.textContent = !GM.live ? '방송 중에만 주문할 수 있어요' : bad ? '품절·재고 부족 상품을 정리해 주세요' : '장바구니 상품 바로 구매';
    go.href = GM.loggedIn ? '/pokeyaho-preview/checkout' : '/pokeyaho-preview/login?next=/checkout';
    var direct = $('[data-cart-direct]');
    if (direct) {
      direct.href = GM.loggedIn ? '/pokeyaho-preview/checkout' : '/pokeyaho-preview/login?next=/checkout';
      direct.classList.toggle('disabled', !GM.live || bad);
      direct.setAttribute('aria-disabled', (!GM.live || bad) ? 'true' : 'false');
    }
  }

  function refreshQuote() {
    var cart = load();
    if (!cart.length) return Promise.resolve(null);
    return api('POST', '/api/cart/quote', { lines: toLines(cart) }).then(function (q) {
      // 최신 가격 반영
      var byId = {};
      q.lines.forEach(function (l) { byId[l.productId + ':' + (l.packageType || 'standard')] = l; });
      // 삭제·비공개 처리된 상품은 서버 견적에 포함되지 않으므로 브라우저 장바구니에서도 제거한다.
      cart = cart.filter(function (l) { return !!byId[l.productId + ':' + (l.packageType || 'standard')]; });
      cart.forEach(function (l) {
        var x = byId[l.productId + ':' + (l.packageType || 'standard')];
        if (x) { l.price = x.unitPrice; if (x.name) l.name = x.name; if (x.imageId) l.imageId = x.imageId; }
      });
      save(cart);
      return q;
    }).catch(function () { return null; });
  }

  $$('[data-open-cart]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      if (!cs) return;
      renderCart(null);
      openSheet(cs);
      refreshQuote().then(function (q) { renderCart(q); });
    });
  });

  document.addEventListener('click', function (e) {
    var direct = e.target.closest('[data-cart-direct]');
    if (!direct || !direct.classList.contains('disabled')) return;
    e.preventDefault();
    toast(!GM.live ? '방송 중에만 바로 구매할 수 있어요' : '품절·재고 부족 상품을 먼저 정리해 주세요', 'error');
  });

  // ===== 방송 상태 / 재고 폴링 (5초) =====
  function applyLive(j) {
    var changed = GM.live !== j.live;
    GM.live = j.live;
    GM.showPrice = j.showPrice;
    $$('[data-live-pill]').forEach(function (el) { el.classList.toggle('on', j.live); el.textContent = j.live ? 'LIVE' : 'OFF'; });
    var banner = $('[data-live-banner]');
    if (banner) {
      banner.classList.toggle('on', j.live);
      $('[data-live-text]', banner).textContent = j.live ? '지금 방송 중 · 주문 가능' : '방송 시간에만 주문할 수 있습니다';
    }
    var map = {};
    j.products.forEach(function (p) { map[p.id] = p; });
    $$('[data-product]').forEach(function (card) {
      var p = map[card.getAttribute('data-product')];
      if (!p) { card.hidden = true; return; }
      card.hidden = false;
      card.classList.toggle('soldout', p.soldout);
      var cardStepper = $('[data-card-stepper]', card);
      if (cardStepper) { cardStepper.setAttribute('data-stock', p.stock); cardStepper.setAttribute('data-price', p.price); }
      var pl = $('[data-price-label]', card);
      if (pl) {
        pl.classList.toggle('hidden', p.price == null);
        pl.textContent = p.price != null ? won(p.price) : '방송 중 공개';
      }
      var sl = $('[data-stock-label]', card);
      if (sl) {
        sl.textContent = p.soldout ? '' : (j.showStock && p.stock <= 3 ? '남은 수량 ' + p.stock + '개' : '');
        sl.classList.toggle('low', j.showStock && !p.soldout && p.stock <= 3);
      }
    });
    syncCardSteppers();
    if (changed) {
      if (psState) syncAdd();
      document.dispatchEvent(new CustomEvent('gm:live', { detail: j }));
      toast(j.live ? '방송이 시작되었습니다. 지금 주문할 수 있습니다' : '방송이 끝나 주문이 마감되었습니다', j.live ? '' : 'error');
    }
    renderBadge();
  }
  // 상품이 새로 추가되면 목록을 다시 받아야 하므로 새로고침
  var isHome = document.body.classList.contains('has-cartbar');
  var knownIds = $$('[data-product]').map(function (c) { return c.getAttribute('data-product'); }).sort().join(',');
  function poll() {
    if (document.hidden) return;
    fetch('/api/live', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) return;
      if (isHome && !openSheetEl) {
        var ids = j.products.map(function (p) { return String(p.id); }).sort().join(',');
        if (ids !== knownIds) { location.reload(); return; }
      }
      applyLive(j);
    }).catch(function () { /* 네트워크 일시 오류 무시 */ });
  }
  setInterval(poll, 5000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });

  // ===== 주소 찾기 (다음 우편번호, 바텀시트 임베드) =====
  var pcSheet = $('#postcodeSheet');
  var pcBackdrop = $('[data-pc-backdrop]');
  var pcTarget = null;
  function closePostcode() {
    if (!pcSheet) return;
    pcSheet.classList.remove('open');
    if (pcBackdrop) pcBackdrop.classList.remove('open');
    setTimeout(function () { pcSheet.hidden = true; }, 300);
  }
  $$('[data-postcode]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!window.daum || !window.daum.Postcode) { toast('주소 검색을 불러오는 중이에요. 잠시 후 다시 눌러 주세요', 'error'); return; }
      pcTarget = btn.closest('form, [data-addr-form], [data-release], .panel') || document;
      var wrap = $('[data-pc-wrap]', pcSheet);
      wrap.innerHTML = '';
      new window.daum.Postcode({
        width: '100%',
        height: '100%',
        oncomplete: function (d) {
          var addr = d.roadAddress || d.jibunAddress;
          if (d.buildingName && d.apartment === 'Y') addr += ' (' + d.buildingName + ')';
          var z = $('[data-zip]', pcTarget), a1 = $('[data-addr1]', pcTarget), a2 = $('[data-addr2]', pcTarget);
          if (z) z.value = d.zonecode;
          if (a1) a1.value = addr;
          closePostcode();
          if (a2) setTimeout(function () { a2.value = ''; a2.focus(); }, 320);
        },
      }).embed(wrap);
      pcSheet.hidden = false;
      requestAnimationFrame(function () { pcSheet.classList.add('open'); if (pcBackdrop) pcBackdrop.classList.add('open'); });
    });
  });
  $$('[data-close-postcode]').forEach(function (b) { b.addEventListener('click', closePostcode); });
  if (pcBackdrop) pcBackdrop.addEventListener('click', closePostcode);

  // ===== 복사 버튼 =====
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy');
      var done = function () { toast('복사했어요'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      } else { fallbackCopy(text); done(); }
    });
  });
  function fallbackCopy(text) {
    var t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(t);
  }

  // ===== 리뷰 사진 선택 미리보기 =====
  $$('[data-review-photo-input]').forEach(function (input) {
    var field = input.closest('[data-review-photo-field]') || input.parentNode;
    var preview = field ? $('[data-review-photo-preview]', field) : null;
    var fileName = field ? $('[data-review-file-name]', field) : null;
    if (!preview) return;
    input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || []);
      var allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (files.length > 3) {
        input.value = '';
        if (fileName) fileName.textContent = '선택된 사진 없음';
        preview.innerHTML = '';
        preview.hidden = true;
        toast('사진은 최대 3장까지 선택할 수 있어요', 'error');
        return;
      }
      if (files.some(function (file) { return !allowed.includes(file.type) || file.size > 5 * 1024 * 1024; })) {
        input.value = '';
        if (fileName) fileName.textContent = '선택된 사진 없음';
        preview.innerHTML = '';
        preview.hidden = true;
        toast('JPG, PNG, WEBP, GIF 사진을 장당 5MB 이하로 올려 주세요', 'error');
        return;
      }
      if (fileName) fileName.textContent = files.length ? files.map(function (file) { return file.name; }).join(', ') : '선택된 사진 없음';
      preview.innerHTML = '';
      preview.hidden = files.length === 0;
      files.forEach(function (file) {
        var url = URL.createObjectURL(file);
        var frame = document.createElement('span');
        var image = document.createElement('img');
        frame.className = 'review-photo-preview-item';
        image.src = url;
        image.alt = '선택한 후기 사진';
        image.width = 240;
        image.height = 180;
        image.onload = function () { URL.revokeObjectURL(url); };
        frame.appendChild(image);
        preview.appendChild(frame);
      });
    });
  });

  // ===== 상품 카드에서 바로 담기 (− 0 +) =====
  // 개봉 옵션 상품은 카드에서 담으면 '라이브 개봉'으로 들어가고, 상세·장바구니에서 미개봉으로 나눌 수 있다.
  function cardLine(cart, id) {
    return cart.filter(function (l) { return Number(l.productId) === id && (l.packageType || 'standard') === 'standard'; })[0];
  }
  function syncCardSteppers() {
    var cart = load();
    $$('[data-card-stepper]').forEach(function (box) {
      var id = Number(box.getAttribute('data-id'));
      var line = cardLine(cart, id);
      var qty = line ? lineQty(line) : 0;
      var stock = Number(box.getAttribute('data-stock')) || 0;
      var card = box.closest('.pcard');
      var soldout = card && card.classList.contains('soldout');
      $('output', box).textContent = qty;
      box.classList.toggle('has-qty', qty > 0);
      $('[data-step="-1"]', box).disabled = qty <= 0;
      $('[data-step="1"]', box).disabled = soldout || qty >= stock;
    });
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-card-stepper] [data-step]');
    if (!btn) return;
    var box = btn.closest('[data-card-stepper]');
    var step = Number(btn.getAttribute('data-step'));
    if (step > 0 && !GM.live) { toast('방송 중에만 담을 수 있습니다', 'error'); return; }
    var id = Number(box.getAttribute('data-id'));
    var option = box.getAttribute('data-option') === '1';
    var stock = Number(box.getAttribute('data-stock')) || 0;
    var cart = load();
    var line = cardLine(cart, id);
    if (!line) {
      if (step < 0) return;
      line = { productId: id, name: box.getAttribute('data-name'), price: Number(box.getAttribute('data-price')), packageType: 'standard', imageId: Number(box.getAttribute('data-image')) || null, option: option, opened: 0, unopened: 0, qty: 0 };
      cart.push(line);
    }
    var current = lineQty(line);
    if (step > 0 && current >= stock) { toast('남은 수량을 모두 담았습니다', 'error'); return; }
    if (line.option) {
      if (step > 0) line.opened = (line.opened || 0) + 1;
      else if ((line.opened || 0) > 0) line.opened--;
      else line.unopened = Math.max(0, (line.unopened || 0) - 1);
    } else {
      line.qty = Math.max(0, (line.qty || 0) + step);
    }
    if (lineQty(line) === 0) cart.splice(cart.indexOf(line), 1);
    save(cart);
    syncCardSteppers();
    if (step > 0 && current === 0) toast(line.option ? '라이브 개봉으로 담았습니다' : '장바구니에 담았습니다');
  });
  document.addEventListener('gm:cart-updated', syncCardSteppers);
  syncCardSteppers();

  // ===== 카테고리 · 구성 필터 (주소의 #cat=…&type=… 로 기억) =====
  (function () {
    var grid = $('[data-grid]');
    var filters = $('[data-filters]');
    if (!grid || !filters) return;
    var empty = $('[data-grid-empty]');
    var pick = function (sel, attr) { var on = $(sel + '.on', filters); return on ? on.getAttribute(attr) : ''; };
    var state = { cat: pick('.cat-tab', 'data-cat'), type: '' };
    var firstCat = state.cat;
    var hasAll = !!$('.cat-tab[data-cat=""]', filters);
    var okCat = function (c) { return c || hasAll ? c : firstCat; }; // '전체' 탭이 없으면 빈 값은 첫 카테고리
    var hash = new URLSearchParams(location.hash.slice(1));
    if (hash.has('cat')) state.cat = okCat(hash.get('cat'));
    function apply(write) {
      $$('.cat-tab', filters).forEach(function (b) { var on = b.getAttribute('data-cat') === state.cat; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      $$('.type-tab', filters).forEach(function (b) { var on = b.getAttribute('data-type') === state.type; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      var shown = 0;
      $$('[data-product]', grid).forEach(function (card) {
        var ok = (!state.cat || card.getAttribute('data-cat') === state.cat) && (!state.type || card.getAttribute('data-type') === state.type);
        card.classList.toggle('is-filtered', !ok);
        if (ok && !card.hidden) shown++;
      });
      if (empty) empty.hidden = shown > 0;
      // 박스 · 낱팩 섹션: 보이는 상품 수를 적고, 비면 섹션째 숨긴다
      $$('[data-type-sec]', grid).forEach(function (sec) {
        var n = $$('[data-product]', sec).filter(function (c) { return !c.classList.contains('is-filtered') && !c.hidden; }).length;
        sec.hidden = n === 0;
        var sc = $('[data-sec-count]', sec); if (sc) sc.textContent = n + '개';
      });
      var title = $('[data-grid-title]');
      var count = $('[data-grid-count]');
      if (title && !location.search) title.textContent = state.cat || '전체 상품';
      if (title && state.type) title.textContent = (state.cat || '전체') + ' · ' + state.type;
      if (count) count.textContent = shown + '개';
      $$('[data-cat-link]').forEach(function (a) { a.classList.toggle('is-cur', a.getAttribute('data-cat-link') === state.cat); });
      if (write && history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#cat=' + encodeURIComponent(state.cat) + '&type=' + encodeURIComponent(state.type));
    }
    filters.addEventListener('click', function (e) {
      var cat = e.target.closest('.cat-tab');
      var type = e.target.closest('.type-tab');
      if (cat) state.cat = cat.getAttribute('data-cat');
      else if (type) state.type = type.getAttribute('data-type');
      else return;
      apply(true);
    });
    apply(false);
    // 헤더·카테고리 바로가기(#cat=…)를 누르면 필터를 바꾸고 상품 목록으로 내려간다
    window.addEventListener('hashchange', function () {
      var h = new URLSearchParams(location.hash.slice(1));
      if (!h.has('cat') && !h.has('type')) return;
      state.cat = okCat(h.get('cat') || '');
      state.type = h.get('type') || '';
      apply(false);
      var head = document.getElementById('shopGrid');
      if (head) head.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
  })();

  // ===== 모바일 전체 메뉴(드로어) =====
  (function () {
    var drawer = document.getElementById('siteDrawer');
    var opener = $('[data-drawer-open]');
    if (!drawer || !opener) return;
    var timer;
    function open() {
      clearTimeout(timer);
      drawer.hidden = false;
      document.body.classList.add('drawer-lock');
      opener.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(function () { requestAnimationFrame(function () { drawer.classList.add('open'); var x = $('.drawer-x', drawer); if (x) x.focus(); }); });
    }
    function close() {
      drawer.classList.remove('open');
      document.body.classList.remove('drawer-lock');
      opener.setAttribute('aria-expanded', 'false');
      timer = setTimeout(function () { drawer.hidden = true; }, 330);
      opener.focus();
    }
    opener.addEventListener('click', open);
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('[data-drawer-close]') || e.target.closest('.drawer-nav a')) close();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) close(); });
  })();

  // ===== 상단 검색 열기 =====
  $$('[data-toggle-search]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var form = document.getElementById(btn.getAttribute('aria-controls'));
      if (!form) return;
      form.hidden = !form.hidden;
      btn.setAttribute('aria-expanded', String(!form.hidden));
      if (!form.hidden) $('input', form).focus();
    });
  });

  window.addEventListener('storage', function (e) { if (e.key === KEY) { renderBadge(); syncCardSteppers(); } });

  renderBadge();

  window.GMShop = { api: api, toast: toast, load: load, save: save, toLines: toLines, won: won, esc: esc, lineQty: lineQty, openSheet: openSheet, closeSheet: closeSheet, refreshQuote: refreshQuote, OPT: OPT };

  // ===== 배송 안내 공지 모달 =====
  (function () {
    var modal = $('[data-notice-modal]');
    if (!modal) return;
    var today = new Date();
    var todayKey = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    var store = function (area, key, value) {
      try { if (value === undefined) return window[area].getItem(key); window[area].setItem(key, value); } catch (e) { return null; }
    };
    var noticeKey = 'hr_notice_' + (modal.getAttribute('data-notice-id') || '0');
    if (store('localStorage', noticeKey + '_hide') === todayKey || store('sessionStorage', noticeKey + '_seen') === '1') return;
    var lastFocus = null;
    function close(hideToday) {
      store('sessionStorage', noticeKey + '_seen', '1');
      if (hideToday) store('localStorage', noticeKey + '_hide', todayKey);
      modal.classList.remove('open');
      document.documentElement.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      setTimeout(function () { modal.hidden = true; }, 240);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function onKey(e) { if (e.key === 'Escape') close(false); }
    $$('[data-src]', modal).forEach(function (img) { img.src = img.getAttribute('data-src'); });
    $$('[data-srcset]', modal).forEach(function (src) { src.srcset = src.getAttribute('data-srcset'); });
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(function () { modal.classList.add('open'); });
    var closeBtn = $('[data-notice-close]', modal);
    closeBtn.addEventListener('click', function () { close(false); });
    $('[data-notice-today]', modal).addEventListener('click', function () { close(true); });
    modal.addEventListener('click', function (e) { if (e.target === modal) close(false); });
    document.addEventListener('keydown', onKey);
    closeBtn.focus({ preventScroll: true });
  })();
})();

// ===== 왼쪽 바로가기: 좁은 화면에서 열고 닫기, 다른 페이지에서 카테고리를 누르면 홈 상품 목록으로 =====
(function () {
  var rail = document.querySelector('[data-rail]');
  if (!rail) return;
  var toggle = rail.querySelector('[data-rail-toggle]');
  var home = rail.querySelector('[data-rail-home]');
  var setOpen = function (on) { rail.classList.toggle('open', on); if (toggle) toggle.setAttribute('aria-expanded', String(on)); };
  if (toggle) toggle.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!rail.classList.contains('open')); });
  document.addEventListener('click', function (e) { if (rail.classList.contains('open') && !rail.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && rail.classList.contains('open')) { setOpen(false); if (toggle) toggle.focus(); } });
  var markHome = function () {
    var cat = new URLSearchParams(location.hash.slice(1)).get('cat') || '';
    if (home) home.classList.toggle('no-cat', home.classList.contains('is-home') && !cat);
  };
  markHome();
  window.addEventListener('hashchange', markHome);
  Array.prototype.slice.call(rail.querySelectorAll('[data-rail-cat]')).forEach(function (a) {
    a.addEventListener('click', function () {
      setOpen(false);
      if (!(home && home.classList.contains('is-home'))) {
        try { sessionStorage.setItem('railJump', '1'); } catch (err) { /* 저장 못 해도 이동은 된다 */ }
      }
    });
  });
  if (home) home.addEventListener('click', function (e) {
    if (home.classList.contains('is-home')) { // 홈에서 홈을 누르면 맨 위로, 카테고리 필터는 전체로
      e.preventDefault(); setOpen(false);
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  });
  // 다른 페이지에서 카테고리를 눌러 홈으로 왔으면 상품 목록까지 내려 준다
  var jumped = false;
  try { jumped = sessionStorage.getItem('railJump') === '1'; sessionStorage.removeItem('railJump'); } catch (err) { jumped = false; }
  if (jumped) {
    var grid = document.getElementById('shopGrid');
    if (grid) setTimeout(function () { grid.scrollIntoView({ block: 'start' }); }, 60);
  }
})();

/* 포케야호 화면 효과: 카드 포인터, 누르면 빛줄기가 퍼짐, 프리미엄 상품 홀로그램, 반응형 보조(필터 줄 끝 흐림, 하단 바 숨김, 버튼 처리 중 표시) */
(function () {
  'use strict';
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; };
  var reduce = mq('(prefers-reduced-motion: reduce)').matches;
  var finePointer = mq('(hover: hover) and (pointer: fine)').matches;

  // ===== 포케야호 포인터: 마우스 포인터 자체가 작은 카드 =====
  // 카드 왼쪽 위 모서리가 실제 클릭 위치(화살표 끝과 같은 역할). 움직이는 방향으로 살짝 기울고,
  // 누를 수 있는 곳에서는 카드가 뒤집혀 노랑 앞면이 보이며, 누르는 순간 탁 눌린다. 글자 입력칸에서는 기본 커서.
  var HOT = 'a, button, [role="button"], label, select, summary, .cat-tab, .type-tab, .pcard-thumb, [data-open-cart], .choice .tile';
  var TEXT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="submit"]):not([type="button"]), textarea, [contenteditable]';
  var cursor = null;
  if (finePointer && !reduce) {
    cursor = document.createElement('div');
    cursor.className = 'pcur';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<span class="pcur-card"><span class="pcur-tilt"><span class="pcur-face pc-back"></span><span class="pcur-face pc-front"></span></span></span>';
    document.body.appendChild(cursor);
    document.documentElement.classList.add('has-pcur');
    var cardEl = cursor.querySelector('.pcur-card');
    var tiltEl = cursor.querySelector('.pcur-tilt');
    var lastX = null, tilt = 0, target = 0, ticking = false;
    var settle = function () {
      tilt += (target - tilt) * 0.2;
      target *= 0.82;
      tiltEl.style.transform = 'rotate(' + tilt.toFixed(2) + 'deg)';
      if (Math.abs(tilt) > 0.15 || Math.abs(target) > 0.15) requestAnimationFrame(settle);
      else { ticking = false; tiltEl.style.transform = ''; }
    };
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      cursor.classList.add('on');
      cardEl.style.transform = 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)';
      if (lastX !== null) target = Math.max(-16, Math.min(16, target + (e.clientX - lastX) * 0.5));
      lastX = e.clientX;
      if (!ticking) { ticking = true; requestAnimationFrame(settle); }
      var t = e.target;
      cursor.classList.toggle('is-hot', !!(t.closest && t.closest(HOT)) && !(t.closest && t.closest(':disabled, [aria-disabled="true"]')));
      cursor.classList.toggle('is-text', !!(t.closest && t.closest(TEXT)));
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () { cursor.classList.remove('on'); lastX = null; });
    document.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse') cursor.classList.add('is-down'); }, { passive: true });
    document.addEventListener('pointerup', function () { cursor.classList.remove('is-down'); }, { passive: true });
  }

  // ===== 누르면: 그 자리에서 빛줄기 8개가 사방으로 짧게 퍼지고, 가운데 링이 번진다 (튕기거나 떨어지지 않음) =====
  var layer = null;
  var COLORS = ['#ffc61a', '#45bdd6', '#e0520f', '#ffc61a', '#45bdd6', '#e0520f', '#ffc61a', '#45bdd6'];
  function burst(x, y) {
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'fx-layer';
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
    }
    var wrap = document.createElement('span');
    wrap.className = 'fx-burst';
    wrap.style.left = x + 'px';
    wrap.style.top = y + 'px';
    var spin = Math.random() * 45;
    var html = '<i class="fx-burst-ring"></i>';
    for (var i = 0; i < 8; i++) {
      html += '<i class="fx-ray" style="--a:' + (spin + i * 45) + 'deg;--c:' + COLORS[i] + ';--d:' + (i % 2 ? 26 : 36) + 'px"></i>';
    }
    wrap.innerHTML = html;
    layer.appendChild(wrap);
    setTimeout(function () { wrap.remove(); }, 560);
  }
  var skip = function (target) { return target.closest('input, textarea, select, [contenteditable], .sheet, .notice-modal, .drawer'); };
  var lastPointer = 'mouse';
  if (!reduce) {
    document.addEventListener('pointerdown', function (e) {
      lastPointer = e.pointerType || 'mouse';
      if (lastPointer === 'touch' || e.button !== 0 || skip(e.target)) return;
      burst(e.clientX, e.clientY);
    }, { passive: true });
    // 터치는 스크롤과 구분하려고 실제 탭(click)에서만
    document.addEventListener('click', function (e) {
      if (lastPointer !== 'touch' || skip(e.target) || (!e.clientX && !e.clientY)) return;
      burst(e.clientX, e.clientY);
    }, true);
  }

  // ===== 프리미엄 상품: 마우스 위치를 따라 빛·기울기 =====
  var premiumCards = Array.prototype.slice.call(document.querySelectorAll('.pcard.premium'));
  premiumCards.forEach(function (card) {
    var thumb = card.querySelector('.pcard-thumb');
    var frame = 0;
    function move(e) {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      var cx = e.clientX, cy = e.clientY;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function () {
        var r = card.getBoundingClientRect();
        var tr = thumb.getBoundingClientRect();
        var px = Math.min(1, Math.max(0, (cx - tr.left) / tr.width));
        var py = Math.min(1, Math.max(0, (cy - tr.top) / tr.height));
        card.style.setProperty('--mx', (cx - r.left) + 'px');
        card.style.setProperty('--my', (cy - r.top) + 'px');
        card.style.setProperty('--px', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--py', (py * 100).toFixed(1) + '%');
        if (!reduce) {
          card.style.setProperty('--rx', ((0.5 - py) * 12).toFixed(2) + 'deg');
          card.style.setProperty('--ry', ((px - 0.5) * 14).toFixed(2) + 'deg');
        }
      });
    }
    card.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse' || e.pointerType === 'pen') card.classList.add('is-hot'); });
    card.addEventListener('pointermove', move);
    card.addEventListener('pointerleave', function () {
      cancelAnimationFrame(frame);
      card.classList.remove('is-hot');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
  if (!finePointer && premiumCards.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('is-lit', en.isIntersecting); });
    }, { rootMargin: '-32% 0px -32% 0px', threshold: 0 });
    premiumCards.forEach(function (card) { io.observe(card); });
  }

  // ===== 가로로 넘기는 줄(카테고리 탭, 헤더 아래 메뉴): 넘길 게 남은 쪽 끝만 흐리게, 선택한 탭이 보이게 =====
  Array.prototype.slice.call(document.querySelectorAll('.cat-tabs, .type-tabs, .cat-scroll-in')).forEach(function (row) {
    var frame = 0;
    function edges() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function () {
        var max = row.scrollWidth - row.clientWidth;
        row.classList.toggle('can-left', row.scrollLeft > 4);
        row.classList.toggle('can-right', max > 4 && row.scrollLeft < max - 4);
      });
    }
    row.addEventListener('scroll', edges, { passive: true });
    window.addEventListener('resize', edges);
    edges();
    row.addEventListener('click', function (e) {
      var tab = e.target.closest('button, a');
      if (tab && row.scrollWidth > row.clientWidth) tab.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
    });
    var cur = row.querySelector('.on, .is-cur');
    if (cur && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, cur.offsetLeft - row.clientWidth / 2 + cur.offsetWidth / 2);
  });

  // ===== 하단 장바구니 바: 푸터가 보이면 내려서 사업자 정보를 가리지 않게 =====
  var foot = document.querySelector('.foot');
  if (foot && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      document.body.classList.toggle('foot-in-view', entries[0].isIntersecting);
    }, { threshold: 0 }).observe(foot);
  }

  // 상품 상세: 상세의 '장바구니 담기·바로 구매'가 보이는 동안은 하단 바를 내린다(같은 버튼 두 벌 방지)
  var actions = document.querySelector('.detail-actions');
  if (actions && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      document.body.classList.toggle('actions-in-view', entries[0].isIntersecting);
    }, { threshold: 0 }).observe(actions);
  }

  // ===== 폼 버튼: 보내는 동안 처리 중 표시 + 두 번 눌림 방지 (스크립트가 직접 처리하는 폼은 건드리지 않음) =====
  document.addEventListener('submit', function (e) {
    var form = e.target;
    var btn = e.submitter || form.querySelector('button[type="submit"], button:not([type])');
    setTimeout(function () {
      if (e.defaultPrevented || !btn || !btn.classList.contains('btn')) return;
      btn.setAttribute('aria-busy', 'true');
      // 다른 화면으로 넘어가지 않으면(검증 실패 등) 몇 초 뒤 되돌린다
      setTimeout(function () { btn.removeAttribute('aria-busy'); }, 8000);
    }, 0);
  });
  window.addEventListener('pageshow', function () {
    Array.prototype.slice.call(document.querySelectorAll('.btn[aria-busy="true"]')).forEach(function (b) { b.removeAttribute('aria-busy'); });
  });

  // ===== 카테고리별 상품 줄: 옆으로 넘기기(손가락 스와이프·버튼), 아래 진행 막대 =====
  Array.prototype.slice.call(document.querySelectorAll('[data-row-track]')).forEach(function (track) {
    var nav = track.parentNode.querySelector('[data-row-nav]');
    if (!nav) return;
    var bar = nav.querySelector('.cat-row-progress i');
    var prev = nav.querySelector('[data-row-prev]');
    var next = nav.querySelector('[data-row-next]');
    var frame = 0;
    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function () {
        var max = track.scrollWidth - track.clientWidth;
        nav.hidden = max <= 4;
        if (max <= 4) return;
        var ratio = track.clientWidth / track.scrollWidth;
        var pos = track.scrollLeft / max;
        bar.style.width = (ratio * 100).toFixed(1) + '%';
        bar.style.transform = 'translateX(' + ((1 / ratio - 1) * pos * 100).toFixed(1) + '%)';
        prev.disabled = track.scrollLeft <= 4;
        next.disabled = track.scrollLeft >= max - 4;
      });
    }
    function page(dir) {
      var card = track.querySelector('.pcard');
      var step = card ? card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0) : track.clientWidth;
      var per = Math.max(1, Math.floor((track.clientWidth + 1) / step));
      track.scrollBy({ left: dir * step * per, behavior: reduce ? 'auto' : 'smooth' });
    }
    prev.addEventListener('click', function () { page(-1); });
    next.addEventListener('click', function () { page(1); });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  // ===== 카드 도감: 카테고리·판본·이름으로 거르기 =====
  var dexGrid = document.querySelector('[data-dex-grid]');
  if (dexGrid) {
    var dex = { cat: '', region: '', q: '' };
    var dexEmpty = document.querySelector('[data-dex-empty]');
    var dexItems = Array.prototype.slice.call(dexGrid.querySelectorAll('[data-dex-item]'));
    var applyDex = function () {
      var shown = 0;
      dexItems.forEach(function (el) {
        var ok = (!dex.cat || el.getAttribute('data-cat') === dex.cat) && (!dex.region || el.getAttribute('data-region') === dex.region) && (!dex.q || el.getAttribute('data-name').indexOf(dex.q) !== -1);
        el.hidden = !ok;
        if (ok) shown++;
      });
      if (dexEmpty) dexEmpty.hidden = shown > 0;
    };
    document.addEventListener('click', function (e) {
      var c = e.target.closest('[data-dex-cat]');
      var r = e.target.closest('[data-dex-region]');
      if (!c && !r) return;
      var attr = c ? 'data-dex-cat' : 'data-dex-region';
      var btn = c || r;
      Array.prototype.slice.call(document.querySelectorAll('[' + attr + ']')).forEach(function (b) { var on = b === btn; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      if (c) dex.cat = btn.getAttribute(attr); else dex.region = btn.getAttribute(attr);
      applyDex();
    });
    var dexSearch = document.querySelector('[data-dex-search]');
    if (dexSearch) dexSearch.addEventListener('input', function () { dex.q = dexSearch.value.trim().toLowerCase(); applyDex(); });
  }

  // ===== 카드 도감 v3: 박스 검색·카드 검색·언어판·세트·종류 =====
  var dxGrid = document.querySelector('[data-dx-grid]');
  var dxCardQuery = '';
  if (dxGrid) {
    var dxPanel = document.querySelector('[data-dx-panel]');
    var dx = { q: '', region: dxPanel ? dxPanel.getAttribute('data-default-region') || '' : '', kind: '', set: '', card: '' };
    var dxItems = Array.prototype.slice.call(dxGrid.querySelectorAll('[data-dx-item]'));
    var dxCount = document.querySelector('[data-dx-count]');
    var dxCardTotal = document.querySelector('[data-dx-card-total]');
    var dxCardHits = document.querySelector('[data-dx-card-hits]');
    var dxEmpty = document.querySelector('[data-dx-empty]');
    var setSelect = document.querySelector('[data-dx-set]');
    var cardInput = document.querySelector('[data-dx-card-q]');
    var cardIndex = null, cardIndexLoading = null, cardHits = null;
    var setPressed = function (sel, attr, val) {
      Array.prototype.slice.call(document.querySelectorAll(sel)).forEach(function (b) { var on = b.getAttribute(attr) === val; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    };
    var applyDx = function () {
      var shown = 0, cardsShown = 0, kindCount = {};
      dxItems.forEach(function (el) {
        var id = el.getAttribute('data-id');
        var inRegion = !dx.region || el.getAttribute('data-region') === dx.region;
        var hit = cardHits ? cardHits[id] || 0 : 0;
        var base = inRegion && (!dx.set || id === dx.set) && (!dx.q || el.getAttribute('data-q').indexOf(dx.q) !== -1) && (!cardHits || hit > 0);
        if (base) { var kk = el.getAttribute('data-kind'); kindCount[kk] = (kindCount[kk] || 0) + 1; }
        var ok = base && (!dx.kind || el.getAttribute('data-kind') === dx.kind);
        el.hidden = !ok;
        var hitEl = el.querySelector('[data-dx-hit]');
        if (hitEl) { hitEl.hidden = !(ok && cardHits); hitEl.textContent = cardHits ? '검색 카드 ' + hit + '장' : ''; }
        if (ok) { shown++; cardsShown += parseInt(el.getAttribute('data-cards'), 10) || 0; }
      });
      if (dxCount) dxCount.textContent = shown.toLocaleString('ko-KR');
      if (dxCardTotal) dxCardTotal.textContent = cardsShown.toLocaleString('ko-KR');
      if (dxCardHits) {
        var total = 0;
        if (cardHits) dxItems.forEach(function (el) { if (!el.hidden) total += cardHits[el.getAttribute('data-id')] || 0; });
        dxCardHits.textContent = cardHits ? ' · 검색 카드 ' + total.toLocaleString('ko-KR') + '장' : '';
      }
      Array.prototype.slice.call(document.querySelectorAll('[data-dx-kind-count]')).forEach(function (s) { s.textContent = (kindCount[s.getAttribute('data-dx-kind-count')] || 0) + '개 상품'; });
      if (dxEmpty) dxEmpty.hidden = shown > 0;
      setPressed('[data-dx-kind]', 'data-dx-kind', dx.kind);
      setPressed('[data-dx-region]', 'data-dx-region', dx.region);
      if (setSelect) {
        Array.prototype.slice.call(setSelect.options).forEach(function (o) { if (o.value) o.hidden = !!dx.region && o.getAttribute('data-region') !== dx.region; });
        setSelect.value = dx.set;
      }
    };
    // 카드 이름·번호 검색: 처음 입력할 때 색인(/dex/index/<게임>.json)을 한 번 받아 세트별 일치 수를 센다
    var runCardSearch = function () {
      var q = dx.card;
      if (!q) { cardHits = null; applyDx(); return; }
      if (!cardIndex) {
        if (!cardIndexLoading) {
          if (dxCardHits) dxCardHits.textContent = ' · 카드 색인 불러오는 중…';
          cardIndexLoading = fetch(dxPanel.getAttribute('data-index')).then(function (r) { return r.json(); }).then(function (d) { cardIndex = d || {}; runCardSearch(); })
            .catch(function () { cardIndexLoading = null; if (dxCardHits) dxCardHits.textContent = ' · 카드 검색을 불러오지 못했습니다'; });
        }
        return;
      }
      cardHits = {};
      Object.keys(cardIndex).forEach(function (id) {
        var n = 0, lines = cardIndex[id].split('\n');
        for (var i = 0; i < lines.length; i++) if (lines[i].indexOf(q) !== -1) n++;
        if (n) cardHits[id] = n;
      });
      applyDx();
    };
    var cardTimer;
    if (cardInput) cardInput.addEventListener('input', function () {
      clearTimeout(cardTimer);
      cardTimer = setTimeout(function () { dx.card = cardInput.value.trim().toLowerCase(); dxCardQuery = dx.card; runCardSearch(); }, 180);
    });
    document.addEventListener('click', function (e) {
      var k = e.target.closest('[data-dx-kind]');
      var r = e.target.closest('[data-dx-region]');
      if (k) { var kv = k.getAttribute('data-dx-kind'); dx.kind = dx.kind === kv ? '' : kv; applyDx(); }
      else if (r) { dx.region = r.getAttribute('data-dx-region'); dx.set = ''; applyDx(); }
      else if (e.target.closest('[data-dx-reset]')) {
        dx.q = ''; dx.kind = ''; dx.set = ''; dx.card = ''; dxCardQuery = ''; cardHits = null;
        var bs = document.querySelector('[data-dx-search]'); if (bs) bs.value = '';
        if (cardInput) cardInput.value = '';
        applyDx();
      }
    });
    var dxSearch = document.querySelector('[data-dx-search]');
    if (dxSearch) dxSearch.addEventListener('input', function () { dx.q = dxSearch.value.trim().toLowerCase(); applyDx(); });
    if (setSelect) setSelect.addEventListener('change', function () { dx.set = setSelect.value; applyDx(); });
    applyDx();
  }

  // ===== 카드 도감: 세트를 누르면 수록 카드 목록 창 =====
  var dxModal = document.querySelector('[data-dx-modal]');
  if (dxModal) {
    var cGrid = dxModal.querySelector('[data-dx-card-grid]');
    var cSearch = dxModal.querySelector('[data-dx-card-search]');
    var cRarity = dxModal.querySelector('[data-dx-rarity]');
    var cCount = dxModal.querySelector('[data-dx-card-count]');
    var lastOpener = null, cards = [], closeTimer;
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    // 희귀도 순서(좋은 것부터)와 이름. 목록에 없는 희귀도는 일반 등급 앞에 둔다.
    var RARITY = [
      ['MUR', '메가 울트라 레어'], ['UR', '울트라 레어'], ['SP', '스페셜 카드'], ['TR', '트레저 레어'], ['SEC', '시크릿 레어'], ['HR', '하이퍼 레어'],
      ['SAR', '스페셜 아트 레어'], ['MA', ''], ['SSR', '샤이니 슈퍼 레어'], ['CSR', '캐릭터 슈퍼 레어'], ['SR', '슈퍼 레어'], ['CHR', '캐릭터 레어'],
      ['AR', '아트 레어'], ['S', '샤이니'], ['K', ''], ['ACE', '에이스 스펙'], ['L', '리더'], ['RRR', '트리플 레어'], ['RR', '더블 레어'], ['PR', '프로모'],
      ['R', '레어'], ['UC', '언커먼'], ['U', '언커먼'], ['C', '커먼'], ['P', '프로모']
    ];
    var rarityKey = function (c) { var r = String(c.rarity || '').trim(); return /^SP/.test(r) ? 'SP' : r; };
    var rarityRank = function (k) {
      if (!k) return 999;
      for (var i = 0; i < RARITY.length; i++) if (RARITY[i][0] === k) return i;
      return RARITY.length - 4.5;
    };
    var rarityName = function (k) { for (var i = 0; i < RARITY.length; i++) if (RARITY[i][0] === k) return RARITY[i][1]; return ''; };
    // 원피스: 공식 카드 목록의 희귀도 + 패러렐 번호(p1·p2…, r1=재록)로 등급을 나눈다. 좋은 등급부터.
    var OP_GRADES = [
      ['MANGA', '망가', '슈퍼 패러렐'], ['SPP', '스페셜 패러렐', 'WANTED·특수 일러스트'], ['SP', 'SP', '스페셜 카드'], ['TR', 'TR', '트레저 레어'],
      ['SECP', '시크릿 패러렐', ''], ['SEC', 'SEC', '시크릿 레어'], ['LSP', '리더 슈퍼 패러렐', ''], ['LP', '리더 패러렐', ''],
      ['SRP', 'SR 패러렐', ''], ['SR', 'SR', '슈퍼 레어'], ['RP', 'R 패러렐', ''], ['L', 'L', '리더'], ['R', 'R', '레어'],
      ['UCP', 'UC 패러렐', ''], ['UC', 'UC', '언커먼'], ['CP', 'C 패러렐', ''], ['C', 'C', '커먼'], ['PP', '프로모 패러렐', ''], ['P', 'P', '프로모'],
      ['RE', '재록', '다른 세트 카드 재수록']
    ];
    var opSet = '';
    var opGrade = function (c) {
      var r = rarityKey(c), v = String(c.variant || ''), n = parseInt(v.slice(1), 10) || 0;
      var own = opSet !== '' && String(c.no || '').split('-')[0].toUpperCase() === opSet;
      if (r === 'SP' || r === 'TR') return r;
      if (!v) return r;
      if (v.charAt(0) === 'r') return 'RE';
      if (r === 'L') return n >= 2 && own ? 'LSP' : 'LP';
      if (r === 'SEC' || r === 'SR' || r === 'R') {
        if (own && n === 2) return 'MANGA';
        if (own && n >= 3) return 'SPP';
        return r + 'P';
      }
      return (r === 'UC' || r === 'C' || r === 'P' ? r : 'C') + 'P';
    };
    var isOp = false;
    var gradeKey = function (c) { return isOp ? opGrade(c) : rarityKey(c); };
    var gradeRank = function (k) {
      if (!isOp) return rarityRank(k);
      if (!k) return 999;
      for (var i = 0; i < OP_GRADES.length; i++) if (OP_GRADES[i][0] === k) return i;
      return OP_GRADES.length;
    };
    var gradeTitle = function (k) { if (!isOp) return k; for (var i = 0; i < OP_GRADES.length; i++) if (OP_GRADES[i][0] === k) return OP_GRADES[i][1]; return k; };
    var gradeSub = function (k) { if (!isOp) return rarityName(k); for (var i = 0; i < OP_GRADES.length; i++) if (OP_GRADES[i][0] === k) return OP_GRADES[i][2]; return ''; };
    // 로컬 썸네일이 없고 외부 표시를 막지 않는 이미지 서버(pokemontcg.io, 드래곤볼 공식)면 원본 주소를 쓴다
    var cardSrc = function (c) {
      if (c.image) return cGrid.getAttribute('data-static-base') + c.image;
      if (c.image_url && /^https:\/\/(images\.pokemontcg\.io|www\.dbs-cardgame\.com)\//.test(c.image_url)) return c.image_url;
      return '';
    };
    var cardHtml = function (c) {
      return '<figure class="dx-c' + (c.variant ? ' is-alt' : '') + '"><span class="dx-c-img">' + (cardSrc(c) ? '<img src="' + esc(cardSrc(c)) + '" alt="' + esc(c.name_ko || c.name) + '" loading="lazy" decoding="async">' : '<span class="dx-c-ph">' + esc(c.no || '') + '</span>') + (c.variant ? '<span class="dx-c-alt">' + esc(isOp ? gradeTitle(opGrade(c)) : '패러렐') + '</span>' : '') + '</span>'
        + '<figcaption><span class="dx-c-no">' + esc(c.no) + (c.rarity ? ' <b>' + esc(rarityKey(c)) + '</b>' : '') + '</span><strong>' + esc(c.name_ko || c.name) + '</strong>' + (c.name_ko && c.name && c.name_ko !== c.name ? '<span class="dx-c-sub">' + esc(c.name) + '</span>' : '') + '</figcaption></figure>';
    };
    var renderCards = function () {
      var q = (cSearch.value || '').trim().toLowerCase();
      var r = cRarity.value;
      var groups = {}, keys = [], shown = 0;
      cards.forEach(function (c, idx) {
        var k = gradeKey(c);
        var hay = ((c.no || '') + ' ' + (c.name || '') + ' ' + (c.name_ko || '')).toLowerCase();
        if ((r && k !== r) || (q && hay.indexOf(q) === -1)) return;
        shown++;
        if (!groups[k]) { groups[k] = []; keys.push(k); }
        groups[k].push({ c: c, i: idx });
      });
      keys.sort(function (a, b) { return gradeRank(a) - gradeRank(b); });
      var html = keys.map(function (k) {
        // 같은 희귀도 안에서는 패러렐을 먼저, 그다음 카드 번호 순
        var list = groups[k].sort(function (a, b) { return (b.c.variant ? 1 : 0) - (a.c.variant ? 1 : 0) || a.i - b.i; });
        var title = k ? gradeTitle(k) : '일반 카드';
        var sub = k ? gradeSub(k) : '희귀도 표시 없음';
        return '<section class="dx-sec' + (gradeRank(k) <= gradeRank(isOp ? 'SRP' : 'SR') ? ' is-top' : '') + '"><h3 class="dx-sec-head"><b>' + esc(title) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '<em>' + list.length + '장</em></h3><div class="dx-sec-grid">'
          + list.map(function (x) { return cardHtml(x.c); }).join('') + '</div></section>';
      }).join('');
      cGrid.innerHTML = html || '<p class="dx-c-empty">조건에 맞는 카드가 없습니다.</p>';
      cGrid.scrollTop = 0;
      cCount.textContent = shown + ' / ' + cards.length + '장';
    };
    var openSet = function (el) {
      lastOpener = el;
      clearTimeout(closeTimer);
      dxModal.querySelector('[data-dx-modal-title]').textContent = el.getAttribute('data-dx-title');
      dxModal.querySelector('[data-dx-modal-meta]').textContent = el.getAttribute('data-dx-meta');
      var img = dxModal.querySelector('[data-dx-modal-img]');
      var src = el.getAttribute('data-dx-img');
      img.hidden = !src; if (src) img.src = src;
      var setId = el.getAttribute('data-dx-open') || '';
      isOp = setId.indexOf('op-') === 0;
      opSet = isOp ? setId.split('-').slice(2).join('').toUpperCase() : '';
      cSearch.value = dxCardQuery || ''; cRarity.innerHTML = '<option value="">' + (isOp ? '모든 등급' : '모든 희귀도') + '</option>';
      cGrid.innerHTML = '<p class="dx-c-empty">카드 목록을 불러오는 중…</p>'; cCount.textContent = '';
      dxModal.hidden = false;
      document.body.classList.add('drawer-lock');
      requestAnimationFrame(function () { dxModal.classList.add('open'); dxModal.querySelector('.drawer-x').focus(); });
      fetch(cGrid.getAttribute('data-cards-base') + el.getAttribute('data-dx-open') + '.json').then(function (r) { return r.json(); }).then(function (data) {
        cards = Array.isArray(data.cards) ? data.cards : [];
        var rarities = [];
        cards.forEach(function (c) { var k = gradeKey(c); if (k && rarities.indexOf(k) === -1) rarities.push(k); });
        rarities.sort(function (a, b) { return gradeRank(a) - gradeRank(b); });
        rarities.forEach(function (x) { var o = document.createElement('option'); var t = gradeTitle(x), n = gradeSub(x); o.value = x; o.textContent = t + (n && n !== t ? ' · ' + n : ''); cRarity.appendChild(o); });
        renderCards();
      }).catch(function () { cGrid.innerHTML = '<p class="dx-c-empty">카드 목록을 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.</p>'; });
    };
    var closeSet = function () {
      dxModal.classList.remove('open');
      document.body.classList.remove('drawer-lock');
      closeTimer = setTimeout(function () { dxModal.hidden = true; cGrid.innerHTML = ''; }, 260);
      if (lastOpener) lastOpener.focus();
    };
    document.addEventListener('click', function (e) {
      var opener = e.target.closest('[data-dx-open]');
      if (opener) { openSet(opener); return; }
      if (e.target.closest('[data-dx-close]')) closeSet();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !dxModal.hidden) closeSet();
      var opener = e.target.closest && e.target.closest('[data-dx-open]');
      if (opener && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openSet(opener); }
    });
    cSearch.addEventListener('input', renderCards);
    cRarity.addEventListener('change', renderCards);
  }

  // ===== 배너: 마우스를 움직이면 떠다니는 카드·별이 깊이에 따라 다르게 움직인다 =====
  var hero = document.querySelector('[data-hero]');
  if (hero && finePointer && !reduce) {
    var hf = 0;
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      var x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      var y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      cancelAnimationFrame(hf);
      hf = requestAnimationFrame(function () {
        hero.style.setProperty('--mx', (-x).toFixed(3));
        hero.style.setProperty('--my', (-y).toFixed(3));
      });
    }, { passive: true });
    hero.addEventListener('pointerleave', function () {
      hero.style.setProperty('--mx', '0');
      hero.style.setProperty('--my', '0');
    });
  }
})();

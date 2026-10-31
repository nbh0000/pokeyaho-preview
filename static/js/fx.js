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

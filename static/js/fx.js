/* 포케야호 화면 효과: 점+미니 카드 포인터, 누르면 빛줄기가 퍼짐, 프리미엄 상품 홀로그램, 반응형 보조(필터 줄 끝 흐림, 하단 바 숨김, 버튼 처리 중 표시) */
(function () {
  'use strict';
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; };
  var reduce = mq('(prefers-reduced-motion: reduce)').matches;
  var finePointer = mq('(hover: hover) and (pointer: fine)').matches;

  // ===== 포케야호 포인터: 정확히 따라오는 점 + 한 박자 늦게 따라오며 기우는 미니 카드 =====
  // 점이 실제 클릭 위치(기준점). 카드는 오른쪽 아래에 떠서 누를 곳을 가리지 않는다.
  // 누를 수 있는 곳 위에서는 점이 링으로 커지고 카드가 앞면(노랑)으로 뒤집힌다. 글자 입력칸에서는 기본 커서로 돌아간다.
  var HOT = 'a, button, [role="button"], label, select, summary, .cat-tab, .type-tab, .pcard-thumb, [data-open-cart], .choice .tile';
  var TEXT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="submit"]):not([type="button"]), textarea, [contenteditable]';
  var cursor = null;
  if (finePointer && !reduce) {
    cursor = document.createElement('div');
    cursor.className = 'pcur';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<span class="pcur-card"><span class="pcur-face pc-back"></span><span class="pcur-face pc-front"></span></span><span class="pcur-dot"></span>';
    document.body.appendChild(cursor);
    document.documentElement.classList.add('has-pcur');
    var dot = cursor.querySelector('.pcur-dot');
    var card = cursor.querySelector('.pcur-card');
    var mx = -100, my = -100, cx = -100, cy = -100, tilt = 0, moving = false, seen = false;
    var tick = function () {
      // 카드: 스프링처럼 따라오고, 가로로 움직인 만큼 기운다
      var dx = mx - cx, dy = my - cy;
      cx += dx * 0.2;
      cy += dy * 0.2;
      tilt += (Math.max(-28, Math.min(28, dx * 0.9)) - tilt) * 0.18;
      card.style.transform = 'translate3d(' + (cx + 14) + 'px,' + (cy + 16) + 'px,0) rotate(' + tilt.toFixed(2) + 'deg)';
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(tilt) > 0.3) requestAnimationFrame(tick);
      else moving = false;
    };
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      mx = e.clientX; my = e.clientY;
      if (!seen) { seen = true; cx = mx; cy = my; cursor.classList.add('on'); }
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      var t = e.target;
      cursor.classList.toggle('is-hot', !!(t.closest && t.closest(HOT)) && !(t.closest && t.closest(':disabled, [aria-disabled="true"]')));
      cursor.classList.toggle('is-text', !!(t.closest && t.closest(TEXT)));
      if (!moving) { moving = true; requestAnimationFrame(tick); }
    }, { passive: true });
    document.addEventListener('pointerleave', function () { cursor.classList.remove('on'); seen = false; });
    document.documentElement.addEventListener('mouseleave', function () { cursor.classList.remove('on'); seen = false; });
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
})();

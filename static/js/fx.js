/* 포케야호 화면 효과: 클릭하면 로고색 별이 톡 튀어 오름, 프리미엄 상품 홀로그램, 반응형 보조(필터 줄 끝 흐림, 하단 바 숨김, 버튼 처리 중 표시) */
(function () {
  'use strict';
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; };
  var reduce = mq('(prefers-reduced-motion: reduce)').matches;
  var finePointer = mq('(hover: hover) and (pointer: fine)').matches;

  // ===== 클릭하면 별 1~3개가 튀어 올랐다가 가상의 바닥에서 두세 번 튕기고 사라진다 =====
  var KINDS = ['fx-star-y', 'fx-star-s', 'fx-spark'];
  var items = [];
  var running = false;
  var MAX_ITEMS = 18;
  var layer = null;
  function ensureLayer() {
    if (layer) return layer;
    layer = document.createElement('div');
    layer.className = 'fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    return layer;
  }
  function spawn(x, y) {
    ensureLayer();
    var count = 1 + Math.floor(Math.random() * 3);
    var ring = document.createElement('span');
    ring.className = 'fx-ring';
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    layer.appendChild(ring);
    setTimeout(function () { ring.remove(); }, 520);
    var first = Math.floor(Math.random() * KINDS.length);
    for (var i = 0; i < count; i++) {
      if (items.length >= MAX_ITEMS) { var oldest = items.shift(); oldest.el.remove(); oldest.shadow.remove(); }
      var size = (finePointer ? 17 : 16) + Math.random() * 7;
      var el = document.createElement('span');
      el.className = 'fx-item ' + KINDS[(first + i) % KINDS.length];
      el.style.width = el.style.height = size + 'px';
      layer.appendChild(el);
      var shadow = document.createElement('span');
      shadow.className = 'fx-shadow';
      shadow.style.width = size * 0.8 + 'px';
      layer.appendChild(shadow);
      var dir = count === 1 ? (Math.random() - 0.5) : ((i / (count - 1)) - 0.5) * 2 + (Math.random() - 0.5) * 0.4;
      items.push({
        el: el, shadow: shadow, size: size,
        x: x - size / 2, y: y - size / 2,
        vx: dir * (1.4 + Math.random() * 1.6),
        vy: -(4.6 + Math.random() * 3),
        rot: (Math.random() - 0.5) * 40,
        spin: (Math.random() - 0.5) * 9,
        floor: Math.min(y + 40 + Math.random() * 36, window.innerHeight - size - 4) - size / 2,
        bounces: 0, life: 0,
      });
    }
    if (!running) { running = true; requestAnimationFrame(step); }
  }
  var last = 0;
  function step(t) {
    var dt = last ? Math.min(2.2, (t - last) / 16.67) : 1;
    last = t;
    for (var i = items.length - 1; i >= 0; i--) {
      var b = items[i];
      b.life += dt;
      b.vy += 0.55 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.spin * dt;
      if (b.y >= b.floor) {
        b.y = b.floor;
        if (Math.abs(b.vy) > 1.6 && b.bounces < 3) {
          b.vy = -b.vy * 0.56;
          b.vx *= 0.82;
          b.spin *= 0.6;
          b.bounces++;
        } else {
          b.vy = 0;
          b.vx *= 0.9;
          b.spin *= 0.8;
        }
      }
      var height = Math.max(0, b.floor - b.y);
      var fade = b.life > 70 ? Math.max(0, 1 - (b.life - 70) / 22) : 1;
      // 바닥에 닿는 순간 살짝 눌려 말랑하게
      var squash = b.y >= b.floor - 0.5 && b.bounces > 0 && b.life < 70 ? ' scale(1.14, 0.84)' : '';
      b.el.style.transform = 'translate3d(' + b.x + 'px,' + b.y + 'px,0) rotate(' + b.rot + 'deg)' + squash;
      b.el.style.opacity = fade;
      b.shadow.style.transform = 'translate3d(' + (b.x + b.size * 0.1) + 'px,' + (b.floor + b.size * 0.86) + 'px,0) scale(' + Math.max(0.35, 1 - height / 90) + ')';
      b.shadow.style.opacity = fade * Math.max(0.12, 0.45 - height / 300);
      if (fade <= 0) {
        b.el.remove();
        b.shadow.remove();
        items.splice(i, 1);
      }
    }
    if (items.length) requestAnimationFrame(step);
    else { running = false; last = 0; }
  }
  // 마우스는 누르는 순간, 터치는 스크롤 중에 뜨지 않도록 실제로 탭했을 때(click)만
  var skip = function (target) { return target.closest('input, textarea, select, [contenteditable], .sheet, .notice-modal, .drawer'); };
  var lastPointer = 'mouse';
  if (!reduce) {
    document.addEventListener('pointerdown', function (e) {
      lastPointer = e.pointerType || 'mouse';
      if (lastPointer === 'touch' || e.button !== 0 || skip(e.target)) return;
      spawn(e.clientX, e.clientY);
    }, { passive: true });
    document.addEventListener('click', function (e) {
      if (lastPointer !== 'touch' || skip(e.target) || (!e.clientX && !e.clientY)) return;
      spawn(e.clientX, e.clientY);
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

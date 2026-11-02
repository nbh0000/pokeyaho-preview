/* 포케야호 관리자 스크립트 */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var csrf = ($('meta[name="csrf"]') || {}).content || '';
  var won = function (n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var newOrderMarker = $('.admin-new-order-marker');
  if (newOrderMarker) {
    var orderNavLink = $('.nav a[href="/admin/orders"]');
    if (orderNavLink) {
      orderNavLink.classList.add('has-new');
      orderNavLink.setAttribute('aria-label', '주문 관리, 확인하지 않은 신규 주문 있음');
    }
  }

  function fileKey(file) {
    return [file.name, file.size, file.lastModified].join(':');
  }

  function syncFileInput(input, files) {
    if (typeof DataTransfer === 'undefined') return;
    var transfer = new DataTransfer();
    files.forEach(function (file) { transfer.items.add(file); });
    input.files = transfer.files;
  }

  function previewImageFiles(input) {
    var role = input.getAttribute('data-image-upload');
    var box = $('[data-upload-preview="' + role + '"]');
    if (!box) return;
    var incoming = Array.prototype.slice.call(input.files || []);
    var single = (role === 'main' && !input.multiple) || role === 'full-box' || role === 'loose';
    var files = single ? incoming.slice(0, 1) : (input._selectedFiles || []).concat(incoming);
    var seen = {};
    files = files.filter(function (file) {
      var key = fileKey(file);
      if (seen[key]) return false;
      seen[key] = true;
      return /^image\//.test(file.type);
    });
    input._selectedFiles = files;
    syncFileInput(input, files);

    if (single) {
      box.innerHTML = '';
    } else {
      $$('[data-new-upload]', box).forEach(function (figure) { figure.remove(); });
    }
    if (!files.length && single) {
      box.innerHTML = '<p class="upload-empty">선택된 이미지가 없습니다.</p>';
      return;
    }
    files.forEach(function (file) {
      var figure = document.createElement('figure');
      figure.className = 'upload-preview-card' + (role === 'main' ? ' main' : '');
      figure.setAttribute('data-new-upload', '1');
      var image = document.createElement('img');
      image.alt = file.name;
      image.src = URL.createObjectURL(file);
      image.onload = function () { URL.revokeObjectURL(image.src); };
      var caption = document.createElement('figcaption');
      caption.textContent = role === 'main' ? '새 메인 이미지' : (role === 'full-box' ? '새 풀박 이미지' : (role === 'loose' ? '새 낱박 이미지' : file.name));
      figure.appendChild(image);
      figure.appendChild(caption);
      box.appendChild(figure);
    });
  }

  $$('[data-image-upload]').forEach(function (input) {
    input.addEventListener('change', function () { previewImageFiles(input); });
  });

  $$('input[data-package-toggle]').forEach(function (toggle) {
    var fields = $$('input[data-package-price]').map(function (input) { return input.closest('.field'); }).filter(Boolean);
    var syncPackageFields = function () {
      fields.forEach(function (field) { field.hidden = !toggle.checked; });
    };
    toggle.addEventListener('change', syncPackageFields);
    syncPackageFields();
  });

  $$('[data-close-admin-modal]').forEach(function (button) {
    button.addEventListener('click', function () {
      var modal = button.closest('[data-admin-modal]');
      if (modal) modal.remove();
    });
  });
  $$('[data-admin-modal]').forEach(function (modal) {
    modal.addEventListener('click', function (event) {
      if (event.target === modal) modal.remove();
    });
  });

  function post(url, data) {
    var body = new URLSearchParams(data);
    return fetch(url, { method: 'POST', headers: { 'x-csrf-token': csrf, Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: body, credentials: 'same-origin' })
      .then(function (r) { return r.json(); });
  }

  // 되돌릴 수 없는 삭제는 브라우저 확인창으로 한 번 더 확인
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-confirm-dialog]');
    if (!btn) return;
    if (!window.confirm(btn.getAttribute('data-confirm-dialog'))) e.preventDefault();
  }, true);

  // 위험한 버튼은 두 번 눌러야 실행 (브라우저 확인창 대신 버튼 문구로 확인)
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-confirm]');
    if (!btn) return;
    if (btn.dataset.armed === '1') { delete btn.dataset.armed; return; }
    e.preventDefault();
    btn.dataset.armed = '1';
    var orig = btn.innerHTML;
    btn.innerHTML = '한 번 더 눌러 확인';
    btn.title = btn.getAttribute('data-confirm');
    var tip = document.createElement('div');
    tip.className = 'flash';
    tip.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99;max-width:92vw;background:#0f1e45;color:#fff';
    tip.textContent = btn.getAttribute('data-confirm');
    document.body.appendChild(tip);
    setTimeout(function () { delete btn.dataset.armed; btn.innerHTML = orig; tip.remove(); }, 3500);
  }, true);

  // 일괄 선택
  var all = $('[data-check-all]');
  function syncSel() {
    var checks = $$('[data-check]');
    var n = checks.filter(function (check) { return check.checked; }).length;
    var c = $('[data-sel-count]');
    if (c) c.textContent = n;
    $$('[data-need-sel]').forEach(function (b) { b.disabled = n === 0; });
    if (all) {
      all.checked = checks.length > 0 && n === checks.length;
      all.indeterminate = n > 0 && n < checks.length;
    }
  }
  if (all) all.addEventListener('change', function () { $$('[data-check]').forEach(function (c) { c.checked = all.checked; }); syncSel(); });
  $$('[data-check]').forEach(function (c) { c.addEventListener('change', syncSel); });
  var labelPrintForm = $('[data-label-print-form]');
  if (labelPrintForm) labelPrintForm.addEventListener('submit', function (event) {
    if (!$$('[data-check]:checked').length) event.preventDefault();
  });
  syncSel();

  // 상품 빠른 수정 (재고, 노출, 품절)
  $$('[data-quick]').forEach(function (el) {
    el.addEventListener('change', function () {
      var data = {};
      data[el.dataset.field] = el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value;
      el.disabled = true;
      post('/admin/products/' + el.dataset.quick + '/quick', data).then(function (r) {
        el.disabled = false;
        if (!r.ok) throw new Error(r.message);
        el.style.boxShadow = '0 0 0 3px #bfe6cf';
        setTimeout(function () { el.style.boxShadow = ''; }, 800);
      }).catch(function () { el.disabled = false; alertBar('저장하지 못했어요. 새로고침 후 다시 시도해 주세요'); });
    });
  });

  function alertBar(msg) {
    var d = document.createElement('div');
    d.className = 'flash error';
    d.textContent = msg;
    var main = $('.main');
    main.insertBefore(d, main.firstChild);
    setTimeout(function () { d.remove(); }, 4000);
  }

  // 상품 순서 드래그 (마우스·터치 공통 pointer 이벤트)
  var tbody = $('[data-sortable]');
  if (tbody) {
    var dragRow = null;
    tbody.addEventListener('pointerdown', function (e) {
      var h = e.target.closest('.drag');
      if (!h) return;
      dragRow = h.closest('tr');
      dragRow.classList.add('dragging');
      h.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    tbody.addEventListener('pointermove', function (e) {
      if (!dragRow) return;
      var rows = $$('tr[data-id]', tbody);
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r === dragRow) continue;
        var rect = r.getBoundingClientRect();
        if (e.clientY > rect.top && e.clientY < rect.bottom) {
          if (e.clientY < rect.top + rect.height / 2) tbody.insertBefore(dragRow, r);
          else tbody.insertBefore(dragRow, r.nextSibling);
          break;
        }
      }
    });
    var end = function () {
      if (!dragRow) return;
      dragRow.classList.remove('dragging');
      dragRow = null;
      var ids = $$('tr[data-id]', tbody).map(function (r) { return r.dataset.id; }).join(',');
      post('/admin/products/reorder', { ids: ids }).catch(function () { alertBar('순서를 저장하지 못했어요'); });
    };
    tbody.addEventListener('pointerup', end);
    tbody.addEventListener('pointercancel', end);
  }

  // 이미지 업로드 전 브라우저에서 축소 (긴 변 1200px, JPEG 85%) → 저사양 서버/DB 부담 최소화
  $$('input[data-resize]').forEach(function (input) {
    input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || []);
      if (!files.length || typeof DataTransfer === 'undefined') return;
      var preview = $('[data-preview]');
      if (preview) preview.innerHTML = '<span class="muted">이미지 줄이는 중…</span>';
      Promise.all(files.map(shrink)).then(function (out) {
        var dt = new DataTransfer();
        out.forEach(function (f) { dt.items.add(f); });
        input.files = dt.files;
        if (preview) {
          preview.innerHTML = '';
          out.forEach(function (f) {
            var d = document.createElement('div');
            d.className = 'img';
            var image = document.createElement('img');
            image.alt = f.name;
            image.src = URL.createObjectURL(f);
            d.appendChild(image);
            d.insertAdjacentHTML('beforeend', '<div class="muted" style="font-size:11px">' + Math.round(f.size / 1024) + 'KB · 저장 시 업로드</div>');
            preview.appendChild(d);
          });
        }
      });
    });
  });
  function shrink(file) {
    return new Promise(function (resolve) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return resolve(file); // GIF 등은 원본
      var img = new Image();
      img.onload = function () {
        var max = 1200, w = img.naturalWidth, h = img.naturalHeight;
        var k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          if (!b || b.size >= file.size) return resolve(file);
          resolve(new File([b], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.85);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = function () { resolve(file); };
      img.src = URL.createObjectURL(file);
    });
  }

  // 대시보드 10초 갱신
  if (window.ADMIN_DASH) {
    var clock = $('[data-clock]');
    var tick = function () {
      fetch('/admin/api/stats', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) return;
        Object.keys(j.st).forEach(function (k) {
          var el = $('[data-st="' + k + '"]');
          if (!el) return;
          el.textContent = /Revenue|Amount/.test(k) ? won(j.st[k]) : Number(j.st[k]).toLocaleString('ko-KR');
        });
        var tb = $('[data-recent]');
        if (tb && j.recent) {
          tb.innerHTML = j.recent.length ? j.recent.map(function (o) {
            return '<tr><td><a class="row-link" href="/admin/orders/' + o.id + '">' + esc(o.nick || '-') + '</a><span class="table-sub">' + esc(o.items) + '</span></td>' +
              '<td class="right num amount">' + won(o.total_amount) + '</td><td><span class="chip ' + esc(o.status) + '">' + esc(o.statusLabel) + '</span></td><td class="num muted nowrap">' + esc(o.time) + '</td></tr>';
          }).join('') : '<tr><td colspan="4" class="empty-cell">들어온 주문이 없습니다.</td></tr>';
        }
        if (clock) clock.textContent = new Date().toLocaleTimeString('ko-KR') + ' 갱신';
      }).catch(function () {});
    };
    setInterval(function () { if (!document.hidden) tick(); }, 10000);
    if (clock) clock.textContent = new Date().toLocaleTimeString('ko-KR') + ' 기준';
  }

  // 주소 복사 (OBS 오버레이 주소 등)
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy-text]');
    if (!btn) return;
    var text = btn.getAttribute('data-copy-text');
    var done = function () { var t = btn.textContent; btn.textContent = '복사됨'; setTimeout(function () { btn.textContent = t; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.prompt('주소를 복사하세요', text); });
    else window.prompt('주소를 복사하세요', text);
  });

  // 주문 목록 자동 새로고침 (선택 중이면 건너뜀)
  if (window.ADMIN_AUTO_REFRESH) {
    setInterval(function () {
      if (document.hidden || $$('[data-check]:checked').length || document.activeElement && document.activeElement.tagName === 'INPUT') return;
      location.reload();
    }, window.ADMIN_AUTO_REFRESH);
  }

  // 라이브 카드(판매 순서·채팅 추첨): 결제·참여가 들어오거나 다른 창에서 조작하면 3초 안에 반영
  if (document.querySelector('[data-live-card]')) {
    var liveBusy = false;
    document.addEventListener('submit', function (e) { if (e.target.closest('[data-live-card]')) liveBusy = true; }, true);
    var typing = function (card) {
      if (card.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return true;
      return Array.prototype.some.call(card.querySelectorAll('input[type=text], input:not([type]), input[type=number], textarea'), function (i) { return i.value !== i.defaultValue; });
    };
    var refreshCards = function () {
      if (liveBusy || document.hidden) return;
      Array.prototype.forEach.call(document.querySelectorAll('[data-live-card]'), function (card) {
        if (typing(card)) return;
        fetch(card.getAttribute('data-src'), { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
          if (!j.ok || liveBusy || !card.isConnected || typing(card)) return;
          var box = document.createElement('div');
          box.innerHTML = j.html;
          var next = box.firstElementChild;
          if (!next || card.innerHTML === next.innerHTML) return;
          var list = card.querySelector('.turn-list, .draw-list');
          var scroll = list ? list.scrollTop : 0;
          card.replaceWith(next);
          var nextList = next.querySelector('.turn-list, .draw-list');
          if (nextList) nextList.scrollTop = scroll;
          next.classList.add('turn-updated');
          setTimeout(function () { next.classList.remove('turn-updated'); }, 900);
        }).catch(function () {});
      });
    };
    setInterval(refreshCards, 3000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshCards(); });
  }
})();

// 상품 등록·수정: 적립 방식이 '이 상품만 따로 정하기'일 때만 비율 칸을 보인다
(function () {
  var mode = document.querySelector('[data-point-mode]');
  var custom = document.querySelector('[data-point-custom]');
  if (!mode || !custom) return;
  var sync = function () { custom.hidden = mode.value !== 'custom'; };
  mode.addEventListener('change', sync);
  sync();
})();

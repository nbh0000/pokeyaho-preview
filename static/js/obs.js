/* 포케야호 OBS 오버레이: /obs/feed 를 주기적으로 조회해 새 결제 알림을 차례로 띄운다 */
(function () {
  'use strict';
  var C = window.OBS || {};
  var after = -1;
  var config = { duration: 7, sound: true };
  var queue = [];
  var showing = false;
  var failCount = 0;
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var won = function (n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; };
  var preview = document.body.classList.contains('is-preview');

  // ===== 알림음: 파일 없이 WebAudio로 짧은 차임 두 음 =====
  var audio = null;
  function chime() {
    if (!config.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      var now = audio.currentTime;
      [[987.77, 0], [1318.51, 0.12], [1975.53, 0.24]].forEach(function (n) {
        var osc = audio.createOscillator();
        var gain = audio.createGain();
        osc.type = 'triangle';
        osc.frequency.value = n[0];
        gain.gain.setValueAtTime(0.0001, now + n[1]);
        gain.gain.exponentialRampToValueAtTime(0.32, now + n[1] + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n[1] + 0.6);
        osc.connect(gain).connect(audio.destination);
        osc.start(now + n[1]);
        osc.stop(now + n[1] + 0.65);
      });
    } catch (e) { /* 오디오를 못 쓰는 환경 */ }
  }

  // ===== 결제 알림 팝업 =====
  function titleHtml(ev) {
    var t = esc(ev.title);
    var nick = esc(ev.nickname);
    return nick ? t.split(nick).join('<b>' + nick + '</b>') : t;
  }
  function showNext() {
    if (showing || !queue.length) return;
    showing = true;
    var ev = queue.shift();
    if (ev.type === 'hit') { showHit(ev); return; }
    var stage = document.querySelector('[data-stage]');
    // 몰릴 때는 한 건을 짧게 보여 줘서 밀리지 않게 한다
    var seconds = queue.length >= 2 ? Math.min(config.duration, 4) : config.duration;
    var el = document.createElement('div');
    el.className = 'alert';
    el.innerHTML =
      '<img class="alert-logo" src="' + esc(C.logo) + '" alt="">' +
      '<div class="alert-body">' +
        '<span class="alert-kicker' + (ev.type === 'ordered' ? ' ordered' : '') + '">' + (ev.type === 'ordered' ? '주문 접수' : 'LIVE 결제 완료') + '</span>' +
        '<div class="alert-title">' + titleHtml(ev) + '</div>' +
        (ev.summary ? '<div class="alert-item">' + esc(ev.summary) + '</div>' : '') +
        (ev.amount != null ? '<div class="alert-amount">' + won(ev.amount) + '</div>' : '') +
      '</div>' +
      '<span class="alert-ball" aria-hidden="true"></span>' +
      '<div class="alert-progress"><i style="animation-duration:' + seconds + 's"></i></div>';
    for (var i = 0; i < 7; i++) {
      var star = document.createElement('span');
      var angle = (Math.PI * 2 * i) / 7 + Math.random() * 0.5;
      var dist = 160 + Math.random() * 120;
      star.className = 'alert-star';
      star.style.left = (18 + Math.random() * 20) + '%';
      star.style.top = '40%';
      star.style.setProperty('--dx', Math.round(Math.cos(angle) * dist) + 'px');
      star.style.setProperty('--dy', Math.round(Math.sin(angle) * dist * 0.6) + 'px');
      star.style.animationDelay = (120 + i * 40) + 'ms';
      el.appendChild(star);
    }
    stage.appendChild(el);
    chime();
    setTimeout(function () {
      el.classList.add('leave');
      setTimeout(function () {
        el.remove();
        showing = false;
        setTimeout(showNext, 250);
      }, 430);
    }, seconds * 1000);
  }

  // ===== 최근 결제 목록 =====
  var known = {};
  function renderTicker(j) {
    var list = document.querySelector('[data-ticker-list]');
    var stat = document.querySelector('[data-ticker-stat]');
    if (stat && j.session) {
      stat.textContent = (j.session.live ? '이번 방송 ' : '오늘 ') + j.session.orders.toLocaleString('ko-KR') + '건 · ' + j.session.items.toLocaleString('ko-KR') + '개';
    }
    var recent = j.recent || [];
    if (!recent.length) {
      list.dataset.rows = '';
      list.innerHTML = '<li class="ticker-empty">개봉을 기다리는 순서가 없어요</li>';
      return;
    }
    var first = Object.keys(known).length === 0;
    var rows = recent.map(function (ev) {
      var fresh = !first && !known[ev.id];
      known[ev.id] = true;
      return '<li' + (fresh ? ' class="fresh"' : '') + '><span class="nick">' + esc(ev.nickname) + '</span><span class="time">' + esc(ev.time) + '</span><span class="item">' + esc(ev.summary || '결제 완료') + (ev.amount != null ? '<em>' + won(ev.amount) + '</em>' : '') + '</span></li>';
    }).join('');
    if (C.layout === 'bar') {
      // 전광판처럼 오른쪽 끝에서 들어와 왼쪽으로 흘러가 사라진다. 목록이 같으면 흐르던 위치를 그대로 이어 간다.
      if (list.dataset.rows === rows && list.firstChild) return;
      list.dataset.rows = rows;
      list.innerHTML = '<div class="ticker-track">' + rows + '</div>';
      var track = list.firstChild;
      var from = list.clientWidth;
      var to = -track.scrollWidth;
      var speed = 140; // px/초
      if (track.animate) {
        track.animate([{ transform: 'translateX(' + from + 'px)' }, { transform: 'translateX(' + to + 'px)' }], { duration: (from - to) / speed * 1000, iterations: Infinity, easing: 'linear' });
      }
    } else {
      list.innerHTML = rows;
    }
  }

  // ===== 방송 화면: 가격표 · 현재 순서 · 시각 · 채팅 =====
  var nowSeen = { tag: '', turn: '', chat: '' };
  var clockOffset = 0;
  var sample = {
    product: { id: 0, name: '어센디드 히어로즈 1PACK', label: '특가판매', price: 13000, listPrice: 0 },
    turn: { id: 0, nickname: '홈런왕', summary: '[북미판] 어센디드 히어로즈 1PACK ×3', index: 3, total: 12 },
    chat: { id: 0, message: '오늘 꼭 홈런 나와라!! 🔥' }
  };
  function replay(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // 같은 애니메이션을 다시 걸기 위해 리플로우
    el.classList.add(cls);
  }
  function setText(sel, text) { var el = document.querySelector(sel); if (el) el.textContent = text; }
  function at(nick) { nick = String(nick || ''); return nick.charAt(0) === '@' ? nick : '@' + nick; }
  function renderNow(st) {
    st = st || {};
    if (preview) {
      st = { product: st.product || sample.product, turn: st.turn || sample.turn, chat: st.turn ? st.chat : sample.chat, serverTime: st.serverTime };
    }
    if (st.serverTime) clockOffset = st.serverTime * 1000 - Date.now();
    var tag = document.querySelector('[data-now-tag]');
    if (tag) {
      var p = st.product;
      tag.hidden = !p;
      if (p) {
        setText('[data-tag-name]', p.name);
        setText('[data-tag-label]', p.label || '');
        setText('[data-tag-list]', p.listPrice ? Number(p.listPrice).toLocaleString('ko-KR') : '');
        setText('[data-tag-price]', Number(p.price || 0).toLocaleString('ko-KR'));
        var tagKey = p.id + '|' + p.price + '|' + p.label;
        if (tagKey !== nowSeen.tag) { nowSeen.tag = tagKey; replay(tag, 'swing'); }
      } else nowSeen.tag = '';
    }
    var turnEl = document.querySelector('[data-now-turn]');
    var t = st.turn;
    if (turnEl) {
      turnEl.hidden = !t;
      if (t) {
        setText('[data-turn-nick]', at(t.nickname));
        setText('[data-turn-order]', t.total > 1 ? t.index + ' / ' + t.total : '');
        setText('[data-turn-item]', t.summary || '');
        var turnKey = t.id + '|' + t.nickname;
        if (turnKey !== nowSeen.turn) { nowSeen.turn = turnKey; replay(turnEl, 'pop'); }
      } else nowSeen.turn = '';
    }
    var chatEl = document.querySelector('[data-now-chat]');
    if (chatEl) {
      var c = t && st.chat;
      chatEl.hidden = !c;
      if (c) {
        var head = chatEl.querySelector('[data-chat-head]');
        head.innerHTML = '<b>' + esc(at(t.nickname)) + '</b> 님의 채팅';
        setText('[data-chat-msg]', c.message);
        var chatKey = t.id + '|' + c.id + '|' + c.message;
        if (chatKey !== nowSeen.chat) { nowSeen.chat = chatKey; replay(chatEl, 'pop'); }
      } else nowSeen.chat = '';
    }
  }
  // 시각은 서버 시계에 맞춰 한국 시간으로 1초마다
  var clockEl = document.querySelector('[data-now-clock]');
  if (clockEl) {
    var days = ['일', '월', '화', '수', '목', '금', '토'];
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var tickClock = function () {
      // UTC 기준에 9시간을 더해 OBS PC의 시간대 설정과 관계없이 한국 시간으로
      var d = new Date(Date.now() + clockOffset + 9 * 3600 * 1000);
      clockEl.textContent = d.getUTCFullYear() + '.' + pad(d.getUTCMonth() + 1) + '.' + pad(d.getUTCDate()) + ' (' + days[d.getUTCDay()] + ') ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
      setTimeout(tickClock, 1000 - ((Date.now() + clockOffset) % 1000) + 5);
    };
    tickClock();
  }

  // ===== 축하음: 펑 + 밝은 상승 아르페지오 + 마지막 화음 (파일 없이 WebAudio) =====
  function fanfare() {
    if (!config.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      var t0 = audio.currentTime + 0.02;
      var note = function (freq, at, len, type, vol) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t0 + at);
        g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
        o.connect(g).connect(audio.destination);
        o.start(t0 + at); o.stop(t0 + at + len + 0.05);
      };
      var buf = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.25), audio.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      var src = audio.createBufferSource(), ng = audio.createGain(), bp = audio.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 900; ng.gain.value = 0.5;
      src.buffer = buf; src.connect(bp).connect(ng).connect(audio.destination); src.start(t0);
      [[523.25, 0.08], [659.25, 0.18], [783.99, 0.28], [1046.5, 0.38]].forEach(function (n) { note(n[0], n[1], 0.22, 'square', 0.09); note(n[0], n[1], 0.3, 'triangle', 0.22); });
      [1046.5, 1318.51, 1567.98].forEach(function (f) { note(f, 0.52, 0.9, 'triangle', 0.18); note(f / 2, 0.52, 0.9, 'sawtooth', 0.035); });
      [2093, 2637, 3136, 2637, 3136].forEach(function (f, k) { note(f, 0.62 + k * 0.09, 0.12, 'sine', 0.07); });
    } catch (e) { /* 오디오를 못 쓰는 환경 */ }
  }

  // ===== 힛카드 축하: 가운데서 야구공이 사방으로 터진다 =====
  function burstBalls(stage, count) {
    var W = window.innerWidth, H = window.innerHeight;
    for (var i = 0; i < count; i++) {
      var b = document.createElement('span');
      b.className = 'hit-ball';
      var ang = Math.random() * Math.PI * 2, dist = 260 + Math.random() * Math.max(W, H) * 0.45;
      var size = 34 + Math.random() * 46;
      b.style.width = b.style.height = size + 'px';
      b.style.left = (W / 2 - size / 2) + 'px';
      b.style.top = (H * 0.42 - size / 2) + 'px';
      b.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
      b.style.setProperty('--dy', Math.round(Math.sin(ang) * dist * 0.75) + 'px');
      b.style.setProperty('--fall', Math.round(220 + Math.random() * 260) + 'px');
      b.style.setProperty('--rot', Math.round((Math.random() - 0.5) * 1440) + 'deg');
      b.style.animationDelay = Math.round(Math.random() * 160) + 'ms';
      b.style.animationDuration = (1500 + Math.random() * 900) + 'ms';
      stage.appendChild(b);
      setTimeout(function (el) { el.remove(); }.bind(null, b), 3000);
    }
    for (var k = 0; k < 26; k++) {
      var c = document.createElement('i');
      c.className = 'hit-confetti';
      var a2 = Math.random() * Math.PI * 2, r2 = 180 + Math.random() * 420;
      c.style.left = (W / 2) + 'px'; c.style.top = (H * 0.42) + 'px';
      c.style.setProperty('--dx', Math.round(Math.cos(a2) * r2) + 'px');
      c.style.setProperty('--dy', Math.round(Math.sin(a2) * r2 * 0.7) + 'px');
      c.style.background = ['#ffd23f', '#e0520f', '#ffffff', '#5fb7ff', '#ff8ad1'][k % 5];
      c.style.animationDelay = Math.round(Math.random() * 200) + 'ms';
      stage.appendChild(c);
      setTimeout(function (el) { el.remove(); }.bind(null, c), 2600);
    }
  }
  function showHit(ev) {
    var stage = document.createElement('div');
    stage.className = 'hit-stage';
    var nick = ev.nickname && ev.nickname !== '구매 고객' ? ev.nickname : '';
    stage.innerHTML = '<span class="hit-flash"></span><span class="hit-ring"></span>' +
      '<div class="hit-card"><p class="hit-word">HIT!</p>' +
      (ev.summary ? '<p class="hit-name">' + esc(ev.summary) + '</p>' : '') +
      (nick ? '<p class="hit-who"><b>' + esc(nick.charAt(0) === '@' ? nick : '@' + nick) + '</b> 님 축하합니다!</p>' : '<p class="hit-who">힛카드 등장! 축하합니다!</p>') + '</div>';
    document.body.appendChild(stage);
    burstBalls(stage, 34);
    setTimeout(function () { burstBalls(stage, 18); }, 900);
    fanfare();
    setTimeout(function () {
      stage.classList.add('leave');
      setTimeout(function () { stage.remove(); showing = false; applyHitbar(); setTimeout(showNext, 250); }, 500);
    }, Math.max(5, config.duration) * 1000);
  }

  // ===== 채팅 추첨 · 목표 게이지 =====
  var drawSeen = null, drawRolling = false, drawFirst = true, drawState = null;
  function fmtLeft(sec) { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60); }
  function tickDraw() {
    var d = drawState && drawState.draw;
    var t = document.querySelector('[data-draw-time]');
    if (d && t && d.phase !== 'drawn') {
      var left = d.endsAt - (Date.now() + clockOffset) / 1000;
      t.textContent = left > 0 ? fmtLeft(left) : '마감!';
      t.classList.toggle('urgent', left > 0 && left <= 10);
      document.querySelector('[data-draw]').classList.toggle('closed', left <= 0);
    }
  }
  if (C.mode === 'draw') setInterval(tickDraw, 250);
  function rollTo(reel, pool, winner, done) {
    var names = pool.length ? pool : [winner];
    var start = Date.now(), total = 2600, last = 0;
    (function spin() {
      var p = Math.min(1, (Date.now() - start) / total);
      var gap = 40 + 360 * p * p; // 점점 느려진다
      if (Date.now() - last >= gap) {
        last = Date.now();
        reel.textContent = names[Math.floor(Math.random() * names.length)];
        replay(reel, 'tick');
      }
      if (p < 1) requestAnimationFrame(spin);
      else { reel.textContent = winner; replay(reel, 'land'); done(); }
    })();
  }
  function renderDraw(st) {
    st = st || {};
    if (preview && !st.draw) st = { serverTime: st.serverTime, goal: st.goal || { title: '프리즈마틱 1박스', percent: 30.6 }, draw: { id: 0, prize: '랜덤 팩', keyword: 'tcg라이브참여!', phase: 'open', endsAt: (st.serverTime || Date.now() / 1000) + 278, count: 9, members: 8, winners: [], drawSeq: '', pool: [] } };
    drawState = st;
    if (st.serverTime) clockOffset = st.serverTime * 1000 - Date.now();
    var g = st.goal, goalEl = document.querySelector('[data-goal]');
    goalEl.hidden = !g;
    if (g) {
      document.querySelector('[data-goal-fill]').style.width = Math.max(2, g.percent) + '%';
      setText('[data-goal-title]', '🎁 상품: ' + (g.title || '목표'));
      setText('[data-goal-pct]', g.percent + '%');
    }
    var box = document.querySelector('[data-draw]'), d = st.draw;
    box.hidden = !d;
    if (!d) { drawSeen = null; drawFirst = false; return; }
    var openEl = document.querySelector('[data-draw-open]'), rollEl = document.querySelector('[data-draw-roll]');
    setText('[data-draw-prize]', d.prize);
    setText('[data-draw-prize2]', d.prize);
    setText('[data-draw-keyword]', d.keyword);
    setText('[data-draw-count]', '참여 ' + d.count + '명' + (d.members ? ' · 멤버 ' + d.members + '명' : ''));
    if (d.phase !== 'drawn') {
      openEl.hidden = false; rollEl.hidden = true; drawSeen = null; drawFirst = false;
      tickDraw();
      return;
    }
    var key = d.id + '|' + d.drawSeq;
    if (drawRolling || drawSeen === key) return;
    var list = document.querySelector('[data-draw-winners]'), reel = document.querySelector('[data-draw-reel]');
    openEl.hidden = true; rollEl.hidden = false;
    var sameDraw = drawSeen && drawSeen.split('|')[0] === String(d.id);
    var already = sameDraw ? list.children.length : 0;
    drawSeen = key;
    if (drawFirst) {
      // 오버레이를 추첨이 끝난 뒤에 켰으면 결과만 보여 준다
      drawFirst = false;
      list.innerHTML = d.winners.map(function (w, i) { return '<li><b>' + (i + 1) + '등</b>' + esc(w) + '</li>'; }).join('');
      reel.textContent = d.winners[d.winners.length - 1] || '';
      return;
    }
    if (!already) list.innerHTML = '';
    drawRolling = true;
    var i = already;
    (function next() {
      if (i >= d.winners.length) { drawRolling = false; return; }
      rollTo(reel, d.pool, d.winners[i], function () {
        var li = document.createElement('li');
        li.innerHTML = '<b>' + (i + 1) + '등</b>' + esc(d.winners[i]);
        list.appendChild(li);
        fanfare();
        burstBalls(document.body, 16);
        i++;
        setTimeout(next, 1400);
      });
    })();
  }

  // ===== 결제 알림 화면 상단 힛카드 띠: 이번 방송에 힛카드가 나오면 생기고, 나온 카드·사람이 오른쪽에서 왼쪽으로 흐른다 =====
  // 축하 연출이 끝난 뒤에 띠를 갱신해서, 축하 화면이 먼저 보이고 그다음 띠에 한 줄이 붙는다.
  var hitbarHits = null, hitbarRows = '';
  function applyHitbar() {
    var bar = document.querySelector('[data-hitbar]');
    if (!bar || hitbarHits === null || showing) return;
    var hits = hitbarHits;
    if (!hits.length) { bar.hidden = true; hitbarRows = ''; return; }
    var rows = hits.map(function (h) {
      return '<span class="hitbar-item"><b>' + esc(h.card || '힛카드') + '</b>' + (h.nickname ? '<em>' + esc(at(h.nickname)) + '</em>' : '') + '</span>';
    }).join('');
    bar.hidden = false;
    if (rows === hitbarRows) return;
    hitbarRows = rows;
    var view = bar.querySelector('.hitbar-view');
    var track = bar.querySelector('[data-hitbar-track]');
    track.innerHTML = rows;
    if (track.getAnimations) track.getAnimations().forEach(function (a) { a.cancel(); });
    var from = view.clientWidth, to = -track.scrollWidth;
    if (track.animate) track.animate([{ transform: 'translateX(' + from + 'px)' }, { transform: 'translateX(' + to + 'px)' }], { duration: (from - to) / 120 * 1000, iterations: Infinity, easing: 'linear' });
  }

  // ===== 힛카드 목록 =====
  var hitSeen = null;
  function renderHits(hits) {
    var list = document.querySelector('[data-hits-list]');
    hits = hits || [];
    if (preview && !hits.length) hits = [{ id: -2, card: '메가레쿠쟈 ex SAR', nickname: '홈런왕', time: '21:40' }, { id: -1, card: '피카츄 AR', nickname: '포켓몬덕후', time: '20:12' }];
    var count = document.querySelector('[data-hits-count]');
    if (count) count.textContent = hits.length ? hits.length + '장' : '';
    if (!hits.length) { hitSeen = {}; list.innerHTML = '<li class="hits-empty">아직 나온 힛카드가 없어요</li>'; return; }
    var first = hitSeen === null;
    var seen = {};
    list.innerHTML = hits.slice(0, C.count || 10).map(function (h) {
      seen[h.id] = true;
      var fresh = !first && !hitSeen[h.id];
      return '<li' + (fresh ? ' class="fresh"' : '') + '><span class="hits-card">' + esc(h.card || '힛카드') + '</span>' +
        '<span class="hits-who">' + (h.nickname ? esc(at(h.nickname)) + ' · ' : '') + esc(h.time) + '</span></li>';
    }).join('');
    hitSeen = seen;
  }

  // ===== 조회 =====
  function poll() {
    var url = '/obs/feed?key=' + encodeURIComponent(C.key) + '&after=' + after + (C.mode === 'ticker' ? '&recent=1' : '') + (C.mode === 'now' ? '&now=1' : '') + (C.mode === 'draw' ? '&draw=1' : '') + (C.mode === 'hits' || C.mode === 'alert' ? '&hits=1' : '');
    fetch(url, { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) throw new Error(j.message || 'feed');
      failCount = 0;
      config = j.config || config;
      if (C.mode === 'draw') {
        renderDraw(j.draw);
      } else if (C.mode === 'now') {
        renderNow(j.now);
      } else if (C.mode === 'hits') {
        renderHits(j.hits);
      } else if (C.mode === 'alert') {
        if (after >= 0) (j.events || []).forEach(function (ev) { queue.push(ev); });
        hitbarHits = (j.hits || []).slice().reverse();
        if (preview && !hitbarHits.length) hitbarHits = [{ card: '피카츄 AR', nickname: '포켓몬덕후' }, { card: '메가레쿠쟈 ex SAR', nickname: '홈런왕' }];
        showNext();
        applyHitbar();
      } else {
        renderTicker(j);
      }
      after = j.last;
    }).catch(function () {
      failCount++;
    }).then(function () {
      // 서버가 응답하지 않으면 조회 간격을 늘렸다가 복구되면 원래대로
      setTimeout(poll, failCount ? Math.min(15000, C.poll * (1 + failCount)) : C.poll);
    });
  }

  if (preview) {
    var bar = document.createElement('div');
    bar.className = 'preview-bar';
    if (C.mode === 'alert') {
      bar.innerHTML = '<button type="button">샘플 알림 보기</button><span>미리보기 화면입니다. 체크무늬는 OBS에서 투명하게 보입니다.</span>';
      bar.querySelector('button').addEventListener('click', function () {
        queue.push({ type: 'paid', nickname: '홈런왕', title: '홈런왕님 결제 완료!', summary: '[북미판] 어센디드 히어로즈 1PACK ×3', amount: config.amount === false ? null : 81000 });
        showNext();
      });
      var hitBtn = document.createElement('button');
      hitBtn.type = 'button'; hitBtn.textContent = '힛카드 축하 보기';
      hitBtn.addEventListener('click', function () { queue.push({ type: 'hit', nickname: '홈런왕', summary: '메가레쿠쟈 ex SAR' }); showNext(); });
      bar.insertBefore(hitBtn, bar.querySelector('span'));
    } else {
      bar.innerHTML = '<span>미리보기 화면입니다. 체크무늬는 OBS에서 투명하게 보입니다.</span>';
    }
    document.body.appendChild(bar);
  }
  poll();
})();

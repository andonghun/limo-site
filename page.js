// 출퇴근 조건 화면. judge.js가 전역에 둔 commute·rideHome·fmt로 페이지에 박힌 JSON(route-data, home-data)을 판정해
// 칩과 시각을 채운다. 고른 조건은 localStorage에 남기며 저장소가 막힌 브라우저에서는 기본값으로 돈다.
// judge.js의 전역 이름(commute, rideHome, arrived, fmt, DAY, NIGHT_TO, pad2)을 다시 선언하지 않도록 전부 이 함수 안에 둔다.
(function () {
  var KEY = 'limo-cond'
  var FIELDS = { day: 'c-day', inT: 'c-in-t', inM: 'c-in', outT: 'c-out-t', outM: 'c-out' }
  var DAY_LABEL = { weekday: '평일', weekend: '주말' }
  var EST = ' <span class="est">추정</span>'
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

  function byId(id) {
    return document.getElementById(id)
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return ESC[c] })
  }

  function t(m) {
    return '<span class="t">' + fmt(m) + '</span>'
  }

  function readJson(id) {
    var el = byId(id)
    if (!el) return null
    try { return JSON.parse(el.textContent) } catch (e) { return null }
  }

  function readCond() {
    var c = {}
    for (var k in FIELDS) c[k] = byId(FIELDS[k]).value
    c.inM = Number(c.inM)
    c.outM = Number(c.outM)
    return c
  }

  // 저장된 값이 선택지에 없으면(범위가 바뀐 경우 등) 그 칸은 기본값을 둔다.
  function restore() {
    var saved = null
    try { saved = JSON.parse(localStorage.getItem(KEY)) } catch (e) { saved = null }
    if (!saved || typeof saved !== 'object') return
    for (var k in FIELDS) {
      if (saved[k] === undefined || saved[k] === null) continue
      var sel = byId(FIELDS[k])
      var before = sel.value
      sel.value = String(saved[k])
      if (sel.value !== String(saved[k])) sel.value = before
    }
  }

  function save(c) {
    try { localStorage.setItem(KEY, JSON.stringify(c)) } catch (e) { /* 저장 못 해도 화면은 돈다 */ }
  }

  // 터미널 첫차·막차 도착이 추정이면 붙이는 글자. src/pages/parts.ts airEst와 같다.
  function airEst(r, which, c) {
    return r.airKind[which][c.day][c.inT] === 'estimated' ? EST : ''
  }

  function judge(r, c) {
    return {
      go: commute(r, c.inT, c.inM, c.day), back: rideHome(r, c.outT, c.outM, c.day), est: airEst(r, 'first', c), lastEst: airEst(r, 'last', c),
      noLast: r.airLast[c.day][c.inT] === null,
    }
  }

  // 출근 칩은 첫차 도착이 추정이면 "추정"을 붙인다(가능·불가 모두 그 시각으로 가렸다).
  function chip(label, res, est) {
    var text = res.ok ? '가능' : res.reason === 'no-data' ? '정보 없음' : '불가'
    return '<span class="chip ' + (res.ok ? 'yes' : 'no') + '">' + label + ' ' + text + (res.reason === 'no-data' ? '' : est || '') + '</span>'
  }

  // 첫차만으로 판정하므로 막차 뒤 쇼업이면 대기 시간을, 그 사이면 배차 간격을 덧붙인다. 막차를 모르면 간격 대신 그렇다고 적는다.
  function goLine(j, c) {
    var go = j.go
    if (go.ok) {
      var extra = go.waitAfterLast !== null ? ' · 막차 ' + t(c.inM - go.waitAfterLast) + ' 도착' + j.lastEst + ', ' + go.waitAfterLast + '분 대기'
        : j.noLast ? ' · 막차 시각 모름'
        : go.headwayMin !== null ? ' · 약 ' + go.headwayMin + '분 간격' : ''
      return c.inT + ' 첫차 ' + t(go.firstArr) + ' 도착' + j.est + extra
    }
    if (go.reason === 'too-early') return c.inT + ' ' + t(c.inM) + '까지 닿는 버스 없음 · 첫차 ' + t(go.firstArr) + ' 도착' + j.est
    return DAY_LABEL[c.day] + ' ' + c.inT + ' 도착 시각 정보 없음'
  }

  function backLine(back, c) {
    if (back.ok) return c.outT + ' ' + t(back.dep) + ' 출발'
    if (back.reason === 'too-late') return c.outT + ' ' + t(c.outM) + ' 이후 버스 없음 · 막차 ' + t(back.lastDep) + ' 출발'
    return DAY_LABEL[c.day] + ' ' + c.outT + ' 출발 시간표 없음'
  }

  // src/pages/parts.ts boardText와 같은 글자.
  function boardText(s, day) {
    var x = s.toAir[day]
    return x ? '첫차 ' + t(x.min) + (x.kind === 'estimated' ? EST : '') : '첫차 시각 없음'
  }

  // 귀가 = 고른 터미널 출발 시각 + 그 터미널에서 정류장까지 걸리는 분(추정).
  function homeText(s, back, c) {
    if (!back.ok) return '퇴근 버스 없음'
    var off = s.fromAir[c.outT]
    return off === null ? '귀가 시각 없음' : '귀가 ' + t(back.dep + off) + EST
  }

  function statusHtml(j, c) {
    return '<p>' + chip('출근', j.go, j.est) + ' <span>' + goLine(j, c) + '</span></p>' +
      '<p>' + chip('퇴근', j.back) + ' <span>' + backLine(j.back, c) + '</span></p>'
  }

  function renderRoute(r, c) {
    var j = judge(r, c)
    byId('status').innerHTML = statusHtml(j, c)
    for (var i = 0; i < r.stops.length; i++) {
      var s = r.stops[i]
      var node = byId('s-' + s.id)
      if (!node) continue
      node.querySelector('.board').innerHTML = boardText(s, c.day)
      node.querySelector('.home-at').innerHTML = homeText(s, j.back, c)
    }
    var terms = document.querySelectorAll('.term')
    for (var k = 0; k < terms.length; k++) {
      var term = terms[k].getAttribute('data-term')
      var first = r.airFirst[c.day][term]
      var est = r.airKind.first[c.day][term] === 'estimated' ? EST : ''
      terms[k].querySelector('.arr').innerHTML = first === null ? '첫차 시각 없음' : '첫차 ' + t(first) + ' 도착' + est
    }
  }

  function stopRow(x, s, c) {
    return '<li class="srow"><a href="' + esc(x.r.path + '#s-' + s.id) + '">' +
      '<span class="sname">' + esc(s.name) + '</span><span class="right">' + boardText(s, c.day) + '</span>' +
      '<span class="sub">' + esc(x.r.number + '번 ' + x.r.dest) + '</span><span class="right">' + homeText(s, x.j.back, c) + '</span></a></li>'
  }

  function fillCard(x, c) {
    var card = byId('r-' + x.r.slug)
    if (!card) return
    card.querySelector('.chips').innerHTML = chip('출근', x.j.go, x.j.est) + chip('퇴근', x.j.back, '')
    card.querySelector('.go').innerHTML = '출근: ' + goLine(x.j, c)
    card.querySelector('.back').innerHTML = '퇴근: ' + backLine(x.j.back, c)
  }

  // 출근 대기: 막차 뒤 쇼업이면 기다리는 분, 아니면 0. 출근은 되는데 막차를 모르면 대기를 아는 노선 뒤로 보낸다.
  function goWait(j) {
    if (!j.go.ok) return 0
    if (j.go.waitAfterLast !== null) return j.go.waitAfterLast
    return j.noLast ? Infinity : 0
  }

  // 둘 다 되는 노선부터, 점수가 같으면 출근 대기(goWait)가 짧은 노선, 그다음 원래 순서. 둘 다 Infinity면 NaN이라 원래 순서로 넘어간다.
  function rank(a, b) {
    return b.score - a.score || a.wait - b.wait || a.i - b.i
  }

  function reorder(ranked) {
    var box = byId('routes')
    ranked.forEach(function (x) {
      var card = byId('r-' + x.r.slug)
      if (card) box.appendChild(card)
    })
  }

  function renderHome(routes, c) {
    var scored = routes.map(function (r, i) {
      var j = judge(r, c)
      return { r: r, j: j, i: i, score: (j.go.ok ? 1 : 0) + (j.back.ok ? 1 : 0), wait: goWait(j) }
    }).sort(rank)
    scored.forEach(function (x) { fillCard(x, c) })
    reorder(scored)
    var both = scored.filter(function (x) { return x.score === 2 })
    var rows = []
    both.forEach(function (x) { x.r.stops.forEach(function (s) { rows.push(stopRow(x, s, c)) }) })
    byId('routes-lead').textContent = both.length ? '출근·퇴근 둘 다 되는 노선은 ' + both.length + '개입니다.'
      : '지금 조건으로는 출근·퇴근 둘 다 되는 노선이 없습니다. 출근 시각을 늦추거나 퇴근 시각을 당겨 보세요.'
    byId('both-list').innerHTML = rows.join('')
    byId('both').hidden = both.length === 0
  }

  // 홈의 정류장 줄에서 넘어오면(#s-정류장) 그 정류장의 집 목록을 펼친다.
  function openFromHash() {
    var id = ''
    try { id = decodeURIComponent(location.hash.slice(1)) } catch (e) { return }
    var node = id ? byId(id) : null
    var details = node ? node.querySelector('details') : null
    if (details) details.open = true
  }

  var form = byId('cond')
  if (!form || typeof commute !== 'function') return
  var routeData = readJson('route-data')
  var homeData = readJson('home-data')

  function render() {
    var c = readCond()
    if (routeData) renderRoute(routeData, c)
    if (homeData) renderHome(homeData, c)
  }

  restore()
  form.addEventListener('change', function () {
    save(readCond())
    render()
  })
  render()
  if (routeData) openFromHash()
})()

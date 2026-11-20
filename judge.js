// 출퇴근 판정과 시각 글자. src/judge.ts·src/time.ts와 같은 식이며 test/judge-parity.test.ts가 두 결과를 비교한다.
var DAY = 1440
var NIGHT_TO = 420

function pad2(n) {
  return n < 10 ? '0' + n : String(n)
}

function fmt(m) {
  var nextDay = m >= DAY
  var inDay = nextDay ? m - DAY : m
  return (nextDay ? '익일 ' : '') + pad2(Math.floor(inDay / 60)) + ':' + pad2(inDay % 60)
}

function arrived(firstArr, lastArr, deadline, headwayMin) {
  var waitAfterLast = lastArr !== null && deadline > lastArr ? deadline - lastArr : null
  return { ok: true, firstArr: firstArr, waitAfterLast: waitAfterLast, headwayMin: headwayMin }
}

// 막차가 자정을 넘는 심야 노선은 쇼업이 07:00 전일 때만 전날 운행분이 이 날 쇼업 전에 닿는지도 본다.
function commute(r, term, deadline, day) {
  var firstArr = r.airFirst[day][term]
  if (firstArr === null) return { ok: false, reason: 'no-data', firstArr: null }
  var lastArr = r.airLast[day][term]
  if (deadline >= firstArr) return arrived(firstArr, lastArr, deadline, r.headwayMin)
  if (deadline < NIGHT_TO && lastArr !== null && lastArr >= DAY && deadline + DAY >= firstArr) {
    return arrived(firstArr >= DAY ? firstArr - DAY : firstArr, lastArr - DAY, deadline, r.headwayMin)
  }
  return { ok: false, reason: 'too-early', firstArr: firstArr }
}

// 자정을 넘긴 출발은 1440을 뺀 값(전날 운행분의 이 날 새벽 출발)도 후보다.
function rideHome(r, term, exit, day) {
  var deps = r.deps[day][term]
  if (deps.length === 0) return { ok: false, reason: 'no-data', lastDep: null }
  var candidates = []
  for (var i = 0; i < deps.length; i++) if (deps[i] >= DAY) candidates.push(deps[i] - DAY)
  candidates = candidates.concat(deps).sort(function (a, b) { return a - b })
  for (var k = 0; k < candidates.length; k++) {
    if (candidates[k] >= exit) return { ok: true, dep: candidates[k] }
  }
  return { ok: false, reason: 'too-late', lastDep: deps[deps.length - 1] }
}

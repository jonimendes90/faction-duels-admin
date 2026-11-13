/* Faction Duels · site de administração.
   Tudo passa pelo Supabase com a chave pública. O que só o administrador pode ver ou mudar é protegido
   no próprio banco (tabela admins + regras de acesso), não aqui: sem login de administrador, nada funciona. */
const SUPA_URL = 'https://jnvqcjfdnedxtfxjlyaq.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpudnFjamZkbmVkeHRmeGpseWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNDMzNzQsImV4cCI6MjEwNzkxOTM3NH0.2PMWb5PyR1qkXw-zhyo_CeX78hQKvAi0pmgvmv7I9xE';
const STORE = SUPA_URL + '/storage/v1/object/public/game/';
const sb = supabase.createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'implicit' } });

const FAC = { HUMANOS: 'Humanos', ORCS: 'Orcs', ELFOS: 'Elfos', ANOES: 'Anões', ANJOS: 'Anjos', DEMONIOS: 'Demônios', GOBLINS: 'Goblins', AUTOMATOS: 'Autômatos', VAMPIROS: 'Vampiros', LICANTROPOS: 'Licantropos' };
const HS = ['H1', 'H2', 'H3', 'H4', 'H5'];
const H_NAME = { H1: 'Iniciante', H2: 'Casual', H3: 'Intermediário', H4: 'Avançado', H5: 'Especialista' };
const BOT_TARGETS = { H1: 30, H2: 40, H3: 50, H4: 58, H5: 65 };   // % de vitória do bot contra jogadores (meta inicial)
const S = { user: null, admin: false, tab: 'overview', days: 30, cat: null, cfg: {}, stats: null, bots: null, sim: null,
  botSrc: 'real', botH: '', botSt: '', botSort: 'pct', cardQ: '', cardFac: '', bal: {}, releases: null, news: null, events: null,
  mail: null, claims: {}, edit: null, mailTo: 'all', mailUser: null, picks: { cards: [], cmds: [], eqs: [] }, statSort: {} };

/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (n) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('pt-BR'));
const pct = (a, b) => (b ? Math.round(1000 * a / b) / 10 : null);
const pctTxt = (v) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%');
const dt = (s) => (s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const toInput = (s) => { if (!s) return ''; const d = new Date(s); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fromInput = (v) => (v ? new Date(v).toISOString() : null);
const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
const checked = (id) => { const el = document.getElementById(id); return !!(el && el.checked); };
let toastT = null;
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4200); }
function fail(e) { console.error(e); toast('Erro: ' + (e && (e.message || e.error_description) || e), true); }
const cardBy = (id) => (S.cat && S.cat.cards.find((c) => c.id === id)) || null;
const cmdBy = (id) => (S.cat && S.cat.cmds.find((c) => c.id === id)) || null;
const eqBy = (id) => (S.cat && S.cat.eqs.find((c) => c.id === id)) || null;
const botBy = (id) => (S.cat && S.cat.bots.find((b) => b.id === +id)) || null;
// the standard error of a win rate: below 2 of these, a difference may just be luck
const se = (p, n) => Math.sqrt(Math.max(p * (1 - p), 0.0001) / Math.max(n, 1));

/* ---------- auth ---------- */
async function boot() {
  const qp = new URLSearchParams(location.search + '&' + location.hash.slice(1));
  if (qp.get('error_description')) { history.replaceState(null, '', here()); S.loginMsg = 'O login voltou com erro: ' + qp.get('error_description') + '. Confira se o endereço deste site está em Supabase → Authentication → URL Configuration → Redirect URLs.'; }
  const { data } = await sb.auth.getSession();
  await setUser(data.session ? data.session.user : null);
  sb.auth.onAuthStateChange((ev, session) => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') setUser(session ? session.user : null); });
}
async function setUser(u) {
  if (u && S.user && u.id === S.user.id && S.admin) return;
  S.user = u; S.admin = false;
  if (!u) { $('#tabs').hidden = true; $('#me').innerHTML = ''; renderLogin(); return; }
  $('#me').innerHTML = esc(u.email || '') + ' <button class="btn sm" data-act="logout">Sair</button>';
  const { data, error } = await sb.rpc('is_admin');
  if (error) { $('#main').innerHTML = '<div class="login card"><h2>Banco ainda não configurado</h2><p class="muted">Rode o arquivo <b>supabase-liveops.sql</b> no SQL Editor do Supabase (veja o guia) e recarregue esta página.</p><p class="muted">' + esc(error.message) + '</p></div>'; return; }
  if (!data) { $('#main').innerHTML = '<div class="login card"><h2>Sem acesso</h2><p class="muted">A conta <b>' + esc(u.email) + '</b> não é administradora. Entre com a conta de administrador.</p></div>'; return; }
  S.admin = true;
  $('#tabs').hidden = false;
  await loadBase();
  go(location.hash.slice(1) || 'overview');
}
function renderLogin(msg) {
  msg = msg || S.loginMsg; S.loginMsg = null;
  $('#main').innerHTML = '<div class="login card"><h1>Administração</h1>'
    + (msg ? '<div class="note">' + esc(msg) + '</div>' : '')
    + '<label class="f">E-mail<input type="email" id="lg-email" autocomplete="email"></label>'
    + '<label class="f">Senha<input type="password" id="lg-pass" autocomplete="current-password"></label>'
    + '<button class="btn go" data-act="login">Entrar</button>'
    + '<div class="or">ou</div>'
    + '<button class="btn" data-act="login-google">Entrar com Google</button>'
    + '<button class="btn" data-act="login-link">Receber link de acesso por e-mail</button>'
    + '<p class="muted" style="font-size:12px">Use a mesma conta do jogo. Só contas marcadas como administradoras no banco conseguem ver alguma coisa aqui.</p></div>';
}
// always the folder address (…/faction-duels-admin/), the one allowed in Supabase → Redirect URLs
const here = () => location.origin + location.pathname.replace(/index\.html$/, '');

/* ---------- data ---------- */
async function loadBase() {
  S.cat = await fetch(STORE + 'catalog.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    || await fetch('data/catalog.json').then((r) => r.json()).catch(() => ({ cards: [], cmds: [], eqs: [], bots: [], fields: [] }));
  await loadCfg();
}
async function loadCfg() {
  const { data, error } = await sb.from('app_config').select('key,value');
  if (error) return fail(error);
  S.cfg = {}; (data || []).forEach((r) => { S.cfg[r.key] = r.value || {}; });
  S.bal = JSON.parse(JSON.stringify((S.cfg.balance && S.cfg.balance.cards) || {}));
}
async function saveCfg(key, value) {
  const { error } = await sb.from('app_config').upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) { fail(error); return false; }
  S.cfg[key] = value; return true;
}

/* ---------- navigation ---------- */
function go(tab) {
  S.tab = tab; location.hash = tab;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  render();
}
// typed values survive a re-render (adding a card to a prize, switching who gets it…); S.fresh skips this after a save
function snapForm() { const o = {}; document.querySelectorAll('#main input[id], #main textarea[id], #main select[id]').forEach((el) => { if (el.dataset.act) return; o[el.id] = el.type === 'checkbox' ? el.checked : el.value; }); return o; }
function restoreForm(o) { Object.keys(o).forEach((id) => { const el = document.getElementById(id); if (!el || el.dataset.act) return; if (el.type === 'checkbox') el.checked = o[id]; else el.value = o[id]; }); }
async function render() {
  if (!S.admin) return;
  const m = $('#main');
  const keep = !S.fresh && S.lastTab === S.tab ? snapForm() : null;
  S.fresh = false; S.lastTab = S.tab;
  try {
    if (S.tab === 'overview') { if (!S.stats) { m.innerHTML = '<p class="muted pad">Calculando…</p>'; await loadStats(); } m.innerHTML = overviewHTML(); }
    else if (S.tab === 'bots') { if (S.botSrc === 'real' && !S.bots) { m.innerHTML = '<p class="muted pad">Carregando…</p>'; await loadBots(); } if (S.botSrc === 'sim' && !S.sim) { await loadSim(); } m.innerHTML = botsHTML(); }
    else if (S.tab === 'cards') m.innerHTML = cardsHTML();
    else if (S.tab === 'match') m.innerHTML = matchHTML();
    else if (S.tab === 'events') { if (!S.events) await loadEvents(); m.innerHTML = eventsHTML(); }
    else if (S.tab === 'news') { if (!S.news) await loadNews(); m.innerHTML = newsHTML(); }
    else if (S.tab === 'mail') { if (!S.mail) await loadMail(); m.innerHTML = mailHTML(); }
    else if (S.tab === 'versions') { if (!S.releases) await loadReleases(); m.innerHTML = versionsHTML(); }
    else if (S.tab === 'player') m.innerHTML = playerHTML();
    else if (S.tab === 'feedback') { if (!S.fb) { m.innerHTML = '<p class="muted pad">Carregando…</p>'; await loadFeedback(); } m.innerHTML = feedbackHTML(); }
    else if (S.tab === 'econ') { if (!S.econ) { m.innerHTML = '<p class="muted pad">Carregando…</p>'; await loadEcon(); } m.innerHTML = econHTML(); }
    if (keep) restoreForm(keep);
  } catch (e) { fail(e); }
}
async function loadStats() { const { data, error } = await sb.rpc('admin_stats', { p_days: S.days }); if (error) throw error; S.stats = data; }
async function loadBots() { const { data, error } = await sb.rpc('admin_bots', { p_days: S.days }); if (error) throw error; S.bots = data || []; }
async function loadSim() {
  S.sim = await fetch(STORE + 'sim-bots.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    || await fetch('data/sim-bots.json').then((r) => r.json()).catch(() => ({ bots: [] }));
}

/* ---------- charts (plain SVG) ---------- */
function lineChart(days, series) {
  const W = 760, H = 220, L = 38, R = 10, T = 12, B = 26;
  const max = Math.max(1, ...series.flatMap((s) => s.v));
  const step = days.length > 1 ? (W - L - R) / (days.length - 1) : 0;
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, max / 2, max].map((v) => '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#2b2e3a"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" fill="#9a958a" font-size="11" text-anchor="end">' + Math.round(v) + '</text>').join('');
  const every = Math.ceil(days.length / 8);
  const xl = days.map((d, i) => ((i % every === 0 && days.length - 1 - i >= every / 2) || i === days.length - 1 ? '<text x="' + (L + i * step) + '" y="' + (H - 6) + '" fill="#9a958a" font-size="11" text-anchor="middle">' + d.slice(8, 10) + '/' + d.slice(5, 7) + '</text>' : '')).join('');
  const lines = series.map((s) => '<polyline fill="none" stroke="' + s.c + '" stroke-width="2.2" stroke-linejoin="round" points="' + s.v.map((v, i) => (L + i * step).toFixed(1) + ',' + y(v).toFixed(1)).join(' ') + '"/>'
    + s.v.map((v, i) => '<circle cx="' + (L + i * step).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="2.6" fill="' + s.c + '"><title>' + days[i] + ' · ' + s.n + ': ' + v + '</title></circle>').join('')).join('');
  return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img">' + ticks + xl + lines + '</svg><div class="legend">' + series.map((s) => '<span><i style="background:' + s.c + '"></i>' + s.n + '</span>').join('') + '</div></div>';
}
function winBar(p, mark) { return '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, p || 0)) + '%"></i>' + (mark != null ? '<u style="left:' + mark + '%"></u>' : '') + '</div>'; }

/* ---------- MÉTRICAS ---------- */
function overviewHTML() {
  const s = S.stats || {}, daily = s.daily || [];
  const total = daily.reduce((n, d) => n + d.matches, 0);
  const r = s.retention || {};
  const seg = '<div class="seg">' + [7, 30, 90].map((d) => '<button data-act="days" data-v="' + d + '" class="' + (S.days === d ? 'on' : '') + '">' + d + ' dias</button>').join('') + '</div>';
  const kpi = (t, v, sub) => '<div class="card kpi"><small>' + t + '</small><b>' + v + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>';
  const winRow = (name, games, wins, extra) => '<tr><td>' + name + '</td><td class="num">' + nf(games) + '</td><td class="num">' + pctTxt(pct(wins, games)) + '</td><td>' + winBar(pct(wins, games), 50) + '</td>' + (extra || '') + '</tr>';
  const tbl = (head, rows, empty) => '<div class="tbl-wrap"><table><thead><tr>' + head + '</tr></thead><tbody>' + (rows || '<tr><td colspan="9" class="muted">' + (empty || 'Sem dados ainda.') + '</td></tr>') + '</tbody></table></div>';
  const cards = (s.cards || []).map((c) => Object.assign({}, c, { p: pct(c.wins, c.plays - c.ties) }));
  const flag = (p, n) => (n < 30 ? '<span class="pill p-muted">poucos dados</span>' : p > 60 ? '<span class="pill p-bad">forte</span>' : p < 40 ? '<span class="pill p-blue">fraca</span>' : '<span class="pill p-good">ok</span>');
  const sortBy = S.statSort.cards || 'plays';
  cards.sort((a, b) => (sortBy === 'p' ? (b.p || 0) - (a.p || 0) : b.plays - a.plays));
  const lv = s.levels || {}, lvKeys = Object.keys(lv).sort((a, b) => +a - +b);
  const w = s.wallet || {};
  return '<h1>Métricas</h1><p class="sub">Dados das contas do app Android (a beta web não envia nada). Partidas de tutorial ficam de fora das porcentagens.</p>'
    + '<div class="row" style="margin-bottom:14px">' + seg + '<button class="btn sm" data-act="reload-stats">Atualizar</button></div>'
    + '<div class="grid g4">'
    + kpi('Jogadores (contas)', nf(s.players_total)) + kpi('Ativos hoje', nf(s.active_today)) + kpi('Ativos em 7 dias', nf(s.active_7d))
    + kpi('Partidas no período', nf(total), Object.entries(s.modes || {}).map(([k, v]) => ({ online: 'online', train: 'treino', tut: 'tutorial' }[k] || k) + ' ' + nf(v)).join(' · '))
    + kpi('Voltam no dia seguinte', pctTxt(pct(r.d1, r.d1_base)), nf(r.d1) + ' de ' + nf(r.d1_base) + ' novos')
    + kpi('Voltam depois de 7 dias', pctTxt(pct(r.d7, r.d7_base)), nf(r.d7) + ' de ' + nf(r.d7_base) + ' novos')
    + kpi('Desistências', pctTxt(s.quit_rate)) + kpi('Duração média', s.secs_avg ? Math.round(s.secs_avg / 60) + ' min ' + (s.secs_avg % 60) + ' s' : '—', s.rounds_avg ? s.rounds_avg + ' rodadas' : '')
    + '</div>'
    + '<div class="grid g2 sec"><div class="card"><h2>Por dia</h2>' + lineChart(daily.map((d) => d.d), [{ n: 'Jogadores ativos', c: '#f2c45a', v: daily.map((d) => d.dau) }, { n: 'Partidas', c: '#7fb2ff', v: daily.map((d) => d.matches) }, { n: 'Contas novas', c: '#63d68a', v: daily.map((d) => d.new_users) }]) + '</div>'
    + '<div class="card"><h2>Economia</h2><div class="grid g4" style="grid-template-columns:repeat(2,1fr)">'
    + kpi('Ouro ganho em partidas', nf(s.gold_from_matches)) + kpi('Ouro médio guardado', nf(w.gold_avg), 'mediana ' + nf(w.gold_med))
    + kpi('Pacotes abertos', nf(Object.values(s.packs || {}).reduce((a, n) => a + n, 0)), Object.entries(s.packs || {}).map(([k, v]) => ({ card: 'cartas', cmd: 'Comandante', eq: 'equipamento' }[k] || k) + ' ' + v).join(' · '))
    + kpi('Fragmentos médios', nf(w.dust_avg), 'pacotes grátis guardados ' + nf(w.packs_avg)) + '</div>'
    + '<h2 class="sec">Níveis dos jogadores</h2>' + (lvKeys.length ? '<div class="row">' + lvKeys.map((k) => '<span class="pill p-gold">Nv ' + k + ': ' + lv[k] + '</span>').join('') + '</div>' : '<p class="muted">Sem dados ainda.</p>') + '</div></div>'
    + '<div class="grid g2 sec"><div class="card"><h2>Facções (decks dos jogadores)</h2>' + tbl('<th>Facção</th><th class="num">Partidas</th><th class="num">Vitórias</th><th></th>', (s.factions || []).map((f) => winRow(FAC[f.fac] || f.fac, f.games, f.wins)).join('')) + '</div>'
    + '<div class="card"><h2>Comandantes dos jogadores</h2>' + tbl('<th>Comandante</th><th class="num">Partidas</th><th class="num">Vitórias</th><th></th>', (s.commanders || []).map((c) => winRow(esc((cmdBy(c.cmd) || {}).nome || c.cmd), c.games, c.wins)).join('')) + '</div></div>'
    + '<div class="grid g2 sec"><div class="card"><h2>Cartas: duelos vencidos pelo jogador</h2><p class="muted" style="margin-top:-4px">Cada duelo em que a carta entrou. Acima de 60% (com 30+ duelos) pode estar forte demais; abaixo de 40%, fraca. Empates não contam.</p>'
    + tbl('<th>Carta</th><th class="num sort" data-act="sort-stat" data-k="cards" data-v="plays">Duelos</th><th class="num sort" data-act="sort-stat" data-k="cards" data-v="p">Vitórias</th><th></th><th></th>', cards.slice(0, 120).map((c) => '<tr><td>' + esc((cardBy(c.card) || {}).nome || c.card) + '</td><td class="num">' + nf(c.plays) + '</td><td class="num">' + pctTxt(c.p) + '</td><td>' + winBar(c.p, 50) + '</td><td>' + flag(c.p, c.plays - c.ties) + '</td></tr>').join('')) + '</div>'
    + '<div class="card"><h2>Cartas mais colocadas nos decks</h2>' + tbl('<th>Carta</th><th class="num">Partidas com ela no deck</th>', (s.decks || []).slice(0, 40).map((c) => '<tr><td>' + esc((cardBy(c.card) || {}).nome || c.card) + '</td><td class="num">' + nf(c.decks) + '</td></tr>').join(''))
    + '<h2 class="sec">Equipamentos usados</h2>' + tbl('<th>Equipamento</th><th class="num">Usos</th>', (s.equipment || []).map((e) => '<tr><td>' + esc((eqBy(e.eq) || {}).nome || e.eq) + '</td><td class="num">' + nf(e.uses) + '</td></tr>').join('')) + '</div></div>';
}

/* ---------- BOTS ---------- */
function botRows() {
  const cfgB = S.cfg.bots || {}, targets = Object.assign({}, BOT_TARGETS, cfgB.targets || {}), tol = +(cfgB.tol || 12);
  const off = new Set((cfgB.disabled || []).map(Number));
  let rows;
  if (S.botSrc === 'sim') {
    rows = (S.sim.bots || []).map((b) => ({ id: b.id, n: b.n, w: b.w, rounds: b.rounds, cs: b.s, cdq: b.dq, cgl: b.gl }));
  } else {
    rows = (S.bots || []).map((b) => ({ id: b.id, n: b.games, w: b.bot_wins, rounds: b.rounds, quits: b.quits }));
    const seen = new Set(rows.map((r) => r.id));
    (S.cat.bots || []).forEach((b) => { if (!seen.has(b.id)) rows.push({ id: b.id, n: 0, w: 0 }); });
  }
  rows.forEach((r) => { Object.assign(r, botBy(r.id) || { nick: '#' + r.id }); r.p = r.n ? r.w / r.n : null; r.off = off.has(r.id); });
  // reference per level: the target (real matches) or the level's own average (simulation)
  const ref = {};
  HS.forEach((h) => {
    const list = rows.filter((r) => r.h === h && r.n);
    const avg = list.length ? list.reduce((a, r) => a + r.w, 0) / Math.max(1, list.reduce((a, r) => a + r.n, 0)) : null;
    const simT = S.sim && S.sim.targets && S.sim.targets[h];
    ref[h] = { avg, n: list.reduce((a, r) => a + r.n, 0), bots: rows.filter((r) => r.h === h).length, ref: S.botSrc === 'sim' ? (simT != null ? simT : avg) : targets[h] / 100 };
  });
  const tl = S.botSrc === 'sim' && S.sim && S.sim.tol ? S.sim.tol * 100 : tol;
  rows.forEach((r) => {
    const R = ref[r.h] && ref[r.h].ref;
    r.dev = r.p != null && R != null ? r.p - R : null;
    const min = S.botSrc === 'sim' ? 50 : 30;
    if (!r.n || r.n < min) r.st = 'few';
    else if (r.dev > tl / 100 && r.dev > 2 * se(r.p, r.n)) r.st = 'strong';
    else if (r.dev < -tl / 100 && -r.dev > 2 * se(r.p, r.n)) r.st = 'weak';
    else r.st = 'ok';
  });
  return { rows, ref, targets, tol: S.botSrc === 'sim' ? tl : tol };
}
function botsHTML() {
  const { rows, ref, targets, tol } = botRows();
  const ST = { few: '<span class="pill p-muted">poucos dados</span>', strong: '<span class="pill p-bad">forte demais</span>', weak: '<span class="pill p-blue">fraco demais</span>', ok: '<span class="pill p-good">ok</span>' };
  let list = rows.filter((r) => (!S.botH || r.h === S.botH) && (!S.botSt || r.st === S.botSt));
  const so = S.botSort;
  list.sort((a, b) => (so === 'id' ? a.id - b.id : so === 'n' ? b.n - a.n : so === 'dev' ? Math.abs(b.dev || 0) - Math.abs(a.dev || 0) : (b.p == null ? -1 : b.p) - (a.p == null ? -1 : a.p)));
  const sim = S.botSrc === 'sim';
  const count = (st) => rows.filter((r) => r.st === st).length;
  const head = '<h1>Bots</h1><p class="sub">Os 200 perfis. <b>Partidas reais</b> = bots contra jogadores no modo online, comparados com a meta do nível. <b>Simulação</b> = teste de calibração: cada bot jogou ' + (sim && S.sim.n ? S.sim.n : 'centenas de') + ' partidas contra uma IA de referência (Normal, deck aleatório de 2 facções, Comandante e equipamentos comuns) e foi ajustado até a força total (habilidade + deck + equipamentos) bater o alvo do nível. Um bot só é marcado quando a diferença passa de ' + tol + ' pontos <i>e</i> não pode ser explicada por sorte. A calibração é feita fora do jogo e entra numa versão nova; “Desligar” é só um freio de emergência.</p>'
    + '<div class="row" style="margin-bottom:14px"><div class="seg"><button data-act="bot-src" data-v="real" class="' + (!sim ? 'on' : '') + '">Partidas reais</button><button data-act="bot-src" data-v="sim" class="' + (sim ? 'on' : '') + '">Simulação</button></div>'
    + '<select id="bot-h" data-act="bot-h"><option value="">Todos os níveis</option>' + HS.map((h) => '<option value="' + h + '"' + (S.botH === h ? ' selected' : '') + '>' + h + ' · ' + H_NAME[h] + '</option>').join('') + '</select>'
    + '<select id="bot-st" data-act="bot-st"><option value="">Todas as situações</option><option value="strong"' + (S.botSt === 'strong' ? ' selected' : '') + '>Forte demais (' + count('strong') + ')</option><option value="weak"' + (S.botSt === 'weak' ? ' selected' : '') + '>Fraco demais (' + count('weak') + ')</option><option value="ok"' + (S.botSt === 'ok' ? ' selected' : '') + '>Ok (' + count('ok') + ')</option><option value="few"' + (S.botSt === 'few' ? ' selected' : '') + '>Poucos dados (' + count('few') + ')</option></select>'
    + (sim && S.sim.at ? '<span class="muted">Simulação de ' + dt(S.sim.at) + '</span>' : '') + '</div>';
  const tiers = '<div class="card"><h2>Por nível</h2><div class="tbl-wrap"><table><thead><tr><th>Nível</th><th class="num">Bots</th><th class="num">Partidas</th><th class="num">Vitória dos bots</th>' + (sim ? '<th class="num">Alvo</th>' : '<th class="num">Meta</th>') + '<th></th></tr></thead><tbody>'
    + HS.map((h) => { const t = ref[h]; const p = t.avg != null ? Math.round(1000 * t.avg) / 10 : null; return '<tr><td>' + h + ' · ' + H_NAME[h] + '</td><td class="num">' + t.bots + '</td><td class="num">' + nf(t.n) + '</td><td class="num">' + pctTxt(p) + '</td>' + (sim ? '<td class="num">' + (t.ref != null ? pctTxt(Math.round(1000 * t.ref) / 10) : '—') + '</td>' : '<td class="num"><input type="number" class="stat-in" style="width:60px" id="tg-' + h + '" value="' + targets[h] + '" min="5" max="95">%</td>') + '<td>' + winBar(p, sim ? (t.ref != null ? Math.round(100 * t.ref) : null) : targets[h]) + '</td></tr>'; }).join('')
    + '</tbody></table></div>' + (sim ? '' : '<div class="row" style="margin-top:10px"><label class="f" style="flex-direction:row;align-items:center;gap:8px">Tolerância <input type="number" id="tg-tol" class="stat-in" style="width:60px" value="' + tol + '" min="3" max="40"> pontos</label><button class="btn sm" data-act="save-targets">Salvar metas</button></div>')
    + '<p class="muted" style="margin-bottom:0">' + (sim ? 'Alvo = força que cada nível precisa ter contra a IA de referência. A calibração ajusta habilidade, deck e equipamentos de cada bot até chegar nele.' : 'Meta = quanto um bot desse nível deveria ganhar dos jogadores que enfrenta. Jogadores fracos pegam bots H1, então H1 deve perder bastante.') + '</p></div>';
  const table = '<div class="card sec"><div class="tbl-wrap"><table><thead><tr>'
    + '<th class="sort" data-act="bot-sort" data-v="id">#</th><th>Nick</th><th>Nível</th><th>Coleção</th><th>Deck</th><th>Estilo</th>' + (sim ? '<th>Calibração</th>' : '')
    + '<th class="num sort" data-act="bot-sort" data-v="n">Partidas</th><th class="num sort" data-act="bot-sort" data-v="pct">Vitória do bot</th><th></th><th class="num sort" data-act="bot-sort" data-v="dev">Diferença</th><th>Situação</th><th>No jogo</th></tr></thead><tbody>'
    + list.map((r) => { const p = r.p != null ? Math.round(1000 * r.p) / 10 : null, d = r.dev != null ? Math.round(1000 * r.dev) / 10 : null, R = ref[r.h] && ref[r.h].ref;
      return '<tr' + (r.off ? ' style="opacity:.55"' : '') + '><td class="muted">' + r.id + '</td><td>' + esc(r.nick) + '</td><td>' + r.h + (r.h0 && r.h0 !== r.h ? ' <span class="pill p-gold" title="Nível original do perfil; a calibração mudou para o nível onde a força dele se encaixa">era ' + r.h0 + '</span>' : '') + '</td><td>' + r.e + '</td><td>' + r.d + '</td><td>' + esc(r.style) + '</td>'
        + (sim ? '<td class="muted" title="Habilidade (1 = H1 … 5 = H5), qualidade do deck e nível de equipamentos usados após a calibração">' + (r.cs != null ? 'hab. ' + Number(r.cs).toLocaleString('pt-BR') + (r.cdq && 'D' + r.cdq !== r.d ? ' · deck D' + r.cdq : '') + (r.cgl ? ' · equip. ' + r.cgl : '') : '—') + '</td>' : '')
        + '<td class="num">' + nf(r.n) + '</td><td class="num">' + pctTxt(p) + '</td><td>' + winBar(p, R != null ? Math.round(100 * R) : null) + '</td><td class="num">' + (d == null ? '—' : (d > 0 ? '+' : '') + d.toLocaleString('pt-BR') + ' pts') + '</td><td>' + ST[r.st] + '</td>'
        + '<td><button class="btn sm' + (r.off ? '' : ' danger') + '" data-act="bot-toggle" data-v="' + r.id + '">' + (r.off ? 'Religar' : 'Desligar') + '</button></td></tr>'; }).join('')
    + '</tbody></table></div><p class="muted">“Desligar” tira o perfil do sorteio do matchmaking (vale na próxima vez que o jogador abrir o jogo). Ele continua no ranking.</p></div>';
  return head + tiers + table;
}

/* ---------- EDITOR VISUAL (notícias, prêmios e avisos de buff/nerf) ----------
   O texto vai para o jogo como '<!--rich-->' + HTML. O jogo só aceita negrito, itálico, sublinhado, cor, tamanho,
   alinhamento, títulos, listas e imagens (https ou imagem embutida); o resto vira texto. A prévia usa a mesma limpeza. */
const RICH = '<!--rich-->', BALN = '<!--bal-->';
const R_TAGS = { P: 'p', DIV: 'div', BR: 'br', B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', SPAN: 'span', FONT: 'span', H3: 'h3', UL: 'ul', OL: 'ol', LI: 'li', IMG: 'img' };
const R_FSZ = { 1: 11, 2: 13, 3: 15, 4: 18, 5: 22, 6: 26, 7: 30 };
const R_COL = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i;
function richClean(html) {
  const doc = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html');
  const walk = (n) => {
    if (n.nodeType === 3) return esc(n.nodeValue);
    if (n.nodeType !== 1) return '';
    if (/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|IFRAME|OBJECT)$/.test(n.tagName)) return '';
    const t = R_TAGS[n.tagName], kids = Array.from(n.childNodes).map(walk).join('');
    if (!t) return kids;
    if (t === 'br') return '<br>';
    const st = [], sty = n.style || {};
    const col = (sty.color || n.getAttribute('color') || '').trim();
    if (col && R_COL.test(col)) st.push('color:' + col);
    let fs = sty.fontSize; const fz = n.getAttribute('size');
    if (n.tagName === 'FONT' && R_FSZ[fz]) fs = R_FSZ[fz] + 'px';
    if (fs && /^\d+(\.\d+)?px$/.test(fs)) st.push('font-size:' + Math.max(10, Math.min(34, parseFloat(fs))) + 'px');
    const al = sty.textAlign || n.getAttribute('align');
    if (al && /^(left|center|right|justify)$/.test(al) && /^(p|div|h3|li)$/.test(t)) st.push('text-align:' + al);
    if (t === 'img') {
      const src = n.getAttribute('src') || '';
      if (!/^https:\/\/[^\s"'<>]+$/i.test(src) && !/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(src)) return '';
      const w = parseFloat(sty.width), ww = sty.width && /%$/.test(sty.width) && w > 0 ? Math.min(100, w) : 100;
      return '<img src="' + esc(src) + '" alt="" style="width:' + ww + '%">';
    }
    return '<' + t + (st.length ? ' style="' + st.join(';') + '"' : '') + '>' + kids + '</' + t + '>';
  };
  return Array.from(doc.body.childNodes).map(walk).join('').trim();
}
const richText = (html) => { const d = document.createElement('div'); d.innerHTML = richClean(html); return d.textContent.trim(); };
const richHasContent = (html) => !!richText(html) || /<img /.test(richClean(html));
// a body from the database -> HTML for the editor (old plain bodies become paragraphs)
const richFrom = (body) => { body = String(body || ''); if (body.startsWith(RICH)) return body.slice(RICH.length); return esc(body).split(/\n{2,}/).filter(Boolean).map((p) => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join(''); };
const richTo = (html) => { const c = richClean(html); return c ? RICH + c : ''; };
S.rich = {};
/* ---------- textos em inglês e espanhol (opcionais) ----------
   Vão no fim do texto como <!--i18n:{...}-->; o jogo mostra a versão do idioma do jogador e, sem ela, o português. */
const TRL = [['en', 'Inglês'], ['es', 'Espanhol']];
const trMark = (o) => (o && Object.keys(o).length ? '<!--i18n:' + encodeURIComponent(JSON.stringify(o)) + '-->' : '');
function trParse(body) {
  body = String(body || ''); const m = /<!--i18n:([^>]*?)-->/.exec(body);
  let o = {}; if (m) { try { o = JSON.parse(decodeURIComponent(m[1])) || {}; } catch (err) { o = {}; } }
  return { base: body.replace(/<!--i18n:[^>]*?-->/g, ''), o };
}
function trBlock(pre, rich, o, opts) {
  o = o || {}; opts = opts || {};
  const has = TRL.some(([k]) => o[k] && (o[k].title || o[k].body));
  return '<details class="trx wide"' + (has ? ' open' : '') + '><summary>Inglês e espanhol (opcional): quem joga nesses idiomas vê esta versão; sem ela, vê o português</summary>'
    + TRL.map(([k, n]) => '<div class="trx-l"><b>' + n + '</b><label class="f wide">Título<input type="text" id="' + pre + '-t-' + k + '" maxlength="' + (opts.tmax || 120) + '" value="' + esc((o[k] && o[k].title) || '') + '"></label>'
      + (rich ? '<div class="f wide">Texto' + richBox(pre + '-b-' + k, (o[k] && o[k].body ? richFrom(o[k].body) : ''), { preview: false, small: true }) + '</div>'
        : '<label class="f wide">Descrição<input type="text" id="' + pre + '-b-' + k + '" maxlength="' + (opts.bmax || 200) + '" value="' + esc((o[k] && o[k].body) || '') + '"></label>') + '</div>').join('')
    + '</details>';
}
function trCollect(pre, rich) {
  const o = {};
  TRL.forEach(([k]) => { const t = val(pre + '-t-' + k), b = rich ? richTo(S.rich[pre + '-b-' + k] || '') : val(pre + '-b-' + k); if (t || b) o[k] = Object.assign(t ? { title: t } : {}, b ? { body: b } : {}); });
  return o;
}
const trForget = (pre) => TRL.forEach(([k]) => { delete S.rich[pre + '-b-' + k]; });
const richGet = (k, def) => (k in S.rich ? S.rich[k] : (S.rich[k] = def || ''));
function richBox(k, def, o) {
  o = o || {};
  const html = richGet(k, def);
  const b = (cmd, label, title) => '<button type="button" class="rt-b" data-rt="' + cmd + '" data-rk="' + k + '" title="' + title + '">' + label + '</button>';
  return '<div class="rich' + (o.small ? ' sm' : '') + '"><div class="rt-bar">'
    + b('bold', '<b>N</b>', 'Negrito') + b('italic', '<i>I</i>', 'Itálico') + b('underline', '<u>S</u>', 'Sublinhado')
    + '<label class="rt-col" title="Cor do texto">A<input type="color" data-rtcol="' + k + '" value="#f2c45a"></label>'
    + '<select data-rtsize="' + k + '" title="Tamanho"><option value="">Tamanho</option><option value="2">Pequeno</option><option value="3">Normal</option><option value="4">Médio</option><option value="5">Grande</option><option value="6">Enorme</option></select>'
    + b('justifyLeft', '⇤', 'Alinhar à esquerda') + b('justifyCenter', '↔', 'Centralizar') + b('justifyRight', '⇥', 'Alinhar à direita')
    + b('h3', 'T', 'Título') + b('ul', '•', 'Lista') + b('img', '🖼', 'Imagem (link ou arquivo)') + b('clear', '⌫', 'Limpar formatação')
    + '</div><div class="rt-ed" contenteditable="true" data-rk="' + k + '" data-ph="' + esc(o.ph || 'Escreva aqui…') + '">' + richClean(html) + '</div>'
    + (o.preview === false ? '' : '<div class="rt-pv"><small>Prévia no jogo</small><div class="pv-sheet" data-rpv="' + k + '">' + richPreview(k) + '</div></div>')
    + '</div>';
}
function richPreview(k) { const h = richClean(S.rich[k] || ''); return h ? '<div class="pv-rich">' + h + '</div>' : '<p class="muted">Nada escrito ainda.</p>'; }
function richSync(k) { const ed = document.querySelector('.rt-ed[data-rk="' + k + '"]'); if (ed) S.rich[k] = ed.innerHTML; const pv = document.querySelector('[data-rpv="' + k + '"]'); if (pv) pv.innerHTML = richPreview(k); if (S.balPv) balPreviewSync(); }
// pictures: uploaded to the game's storage when the account may write there; otherwise embedded (shrunk to 720 px)
async function richImgFile(file) {
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg'), path = 'news/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.' + ext;
  try { const { error } = await sb.storage.from('game').upload(path, file, { contentType: file.type, upsert: false }); if (!error) return STORE + path; } catch (err) {}
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); });
  const sc = Math.min(1, 480 / img.width), c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  toast('Imagem embutida no texto (o envio ao servidor falhou).');
  return c.toDataURL('image/webp', 0.7);
}
// the last selection inside each editor, so the colour picker and the size list (which take the focus) still apply to it
const R_SEL = {};
document.addEventListener('selectionchange', () => { const sel = window.getSelection(); if (!sel.rangeCount) return; const n = sel.anchorNode, ed = n && (n.nodeType === 1 ? n : n.parentElement).closest('.rt-ed'); if (ed) R_SEL[ed.dataset.rk] = sel.getRangeAt(0).cloneRange(); });
function richFocus(k) {
  const ed = document.querySelector('.rt-ed[data-rk="' + k + '"]'); if (!ed) return null;
  ed.focus(); const r = R_SEL[k];
  if (r && ed.contains(r.startContainer)) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
  return ed;
}
async function richCmd(k, cmd) {
  const ed = richFocus(k); if (!ed) return;
  if (cmd === 'h3') document.execCommand('formatBlock', false, 'h3');
  else if (cmd === 'ul') document.execCommand('insertUnorderedList');
  else if (cmd === 'clear') { document.execCommand('removeFormat'); document.execCommand('formatBlock', false, 'p'); }
  else if (cmd === 'img') {
    const sel = window.getSelection(), rng = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    const url = prompt('Link da imagem (https://…). Deixe em branco para escolher um arquivo do computador.');
    if (url === null) return;
    let src = url.trim();
    if (!src) {
      const f = await new Promise((ok) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => ok(i.files[0] || null); i.click(); });
      if (!f) return; src = await richImgFile(f);
    } else if (!/^https:\/\//i.test(src)) { toast('O link precisa começar com https://', true); return; }
    ed.focus(); if (rng) { sel.removeAllRanges(); sel.addRange(rng); }
    document.execCommand('insertHTML', false, '<img src="' + esc(src) + '" style="width:100%">');
  } else document.execCommand(cmd);
  richSync(k);
}

/* ---------- CARTAS (buffs e nerfs) ---------- */
function cardsHTML() {
  const A = S.cat.attrs || ['FOR', 'DEF', 'VEL', 'ENE', 'TEC', 'INT'];
  const q = S.cardQ.toLowerCase();
  const list = S.cat.cards.filter((c) => (!S.cardFac || c.fac === S.cardFac) && (!q || c.nome.toLowerCase().includes(q)));
  const changed = Object.keys(S.bal).length;
  const saved = JSON.stringify((S.cfg.balance && S.cfg.balance.cards) || {}) === JSON.stringify(S.bal);
  return '<h1>Cartas · buffs e nerfs</h1><p class="sub">Mude os atributos ou o custo da habilidade de qualquer carta, sem atualizar o app. Vale quando o jogador abrir o jogo (ou em até 15 minutos se ele já estiver com o jogo aberto), nunca no meio de uma partida. Mudanças de <i>efeito</i> (o texto da habilidade) precisam de uma versão nova do jogo.</p>'
    + '<div class="row" style="margin-bottom:14px"><input type="text" id="card-q" placeholder="Buscar carta…" value="' + esc(S.cardQ) + '" data-act="card-q"><select id="card-fac" data-act="card-fac"><option value="">Todas as facções</option>' + Object.keys(FAC).map((f) => '<option value="' + f + '"' + (S.cardFac === f ? ' selected' : '') + '>' + FAC[f] + '</option>').join('') + '</select>'
    + '<span class="pill ' + (changed ? 'p-gold' : 'p-muted') + '">' + changed + ' carta' + (changed === 1 ? '' : 's') + ' ajustada' + (changed === 1 ? '' : 's') + '</span>'
    + '<button class="btn go" data-act="save-bal"' + (saved ? ' disabled' : '') + '>' + (saved ? 'Tudo salvo' : 'Salvar e publicar ajustes') + '</button></div>'
    + (saved ? '' : balNoteHTML())
    + '<div class="card"><div class="tbl-wrap"><table><thead><tr><th>Carta</th><th>Facção</th><th>Raridade</th>' + A.map((a) => '<th class="num">' + a + '</th>').join('') + '<th class="num">Total</th><th>Habilidade · custo</th><th></th></tr></thead><tbody>'
    + list.map((c) => {
      const o = S.bal[c.id] || {}, s = o.s || c.s;
      const tot = s.reduce((a, n) => a + +n, 0), base = c.s.reduce((a, n) => a + n, 0);
      return '<tr><td title="' + esc(c.pas) + '">' + esc(c.nome) + '</td><td>' + (FAC[c.fac] || c.fac) + '</td><td>' + c.rar + '</td>'
        + s.map((v, i) => '<td class="num"><input type="number" min="0" max="30" class="stat-in' + (+v !== c.s[i] ? ' chg' : '') + '" data-act="stat" data-id="' + c.id + '" data-i="' + i + '" value="' + v + '" title="Original: ' + c.s[i] + '"></td>').join('')
        + '<td class="num">' + tot + (tot !== base ? ' <span class="pill ' + (tot > base ? 'p-bad' : 'p-blue') + '">' + (tot > base ? '+' : '') + (tot - base) + '</span>' : '') + '</td>'
        + '<td>' + (c.act ? esc(c.act.nome) + ' · <input type="number" min="0" max="5" class="stat-in' + (o.cost != null && o.cost !== c.act.cost ? ' chg' : '') + '" data-act="cost" data-id="' + c.id + '" value="' + (o.cost != null ? o.cost : c.act.cost) + '" title="Original: ' + c.act.cost + '"> Ess.' : '<span class="muted">—</span>') + '</td>'
        + '<td>' + (S.bal[c.id] ? '<button class="btn sm" data-act="bal-reset" data-v="' + c.id + '">Voltar ao original</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
}
/* what changed against what is published now: one line per card, with the explanation the players will read */
function balDiff() {
  const pub = (S.cfg.balance && S.cfg.balance.cards) || {}, ids = Array.from(new Set(Object.keys(pub).concat(Object.keys(S.bal))));
  return ids.map((id) => {
    const c = cardBy(id); if (!c) return null;
    const P = pub[id] || {}, N = S.bal[id] || {};
    const before = { s: (P.s || c.s).map(Number), cost: c.act ? (P.cost != null ? +P.cost : c.act.cost) : null };
    const after = { s: (N.s || c.s).map(Number), cost: c.act ? (N.cost != null ? +N.cost : c.act.cost) : null };
    if (JSON.stringify(before) === JSON.stringify(after)) return null;
    const dS = after.s.reduce((a, n) => a + n, 0) - before.s.reduce((a, n) => a + n, 0), dC = (after.cost || 0) - (before.cost || 0);
    const auto = dS > 0 || (dS === 0 && dC < 0) ? 'buff' : dS < 0 || (dS === 0 && dC > 0) ? 'nerf' : 'ajuste';
    return { id, c, before, after, kind: (S.balKind || {})[id] || auto };
  }).filter(Boolean);
}
function balChanges(it) {
  const A = S.cat.attrs || ['FOR', 'DEF', 'VEL', 'ENE', 'TEC', 'INT'], out = [];
  it.after.s.forEach((v, i) => { if (v !== it.before.s[i]) out.push('<span class="' + (v > it.before.s[i] ? 'up' : 'dn') + '">' + A[i] + ' ' + it.before.s[i] + ' → ' + v + '</span>'); });
  if (it.before.cost !== it.after.cost) out.push('<span class="' + (it.after.cost < it.before.cost ? 'up' : 'dn') + '">Custo ' + it.before.cost + ' → ' + it.after.cost + '</span>');
  return out.join(' ');
}
function balNoteHTML() {
  const L = balDiff(); if (!L.length) return '';
  S.balPv = true;
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return '<div class="card sec"><h2>Aviso aos jogadores</h2><p class="muted">Cada carta mudada precisa de uma explicação para salvar. O aviso aparece nas Notícias do jogo; tocando nele, o jogador vê as cartas e o motivo de cada mudança.</p>'
    + '<div class="form"><label class="f wide">Título do aviso<input type="text" id="bal-title" maxlength="80" value="Buffs e nerfs · ' + today + '"></label></div>'
    + '<div class="f wide" style="margin-top:10px">Texto de abertura (opcional)' + richBox('bal-intro', '', { ph: 'Ex.: Ajustes da semana para equilibrar os Anjos…', preview: false }) + '</div>'
    + L.map((it) => '<div class="bal-it"><div class="bal-h"><b>' + esc(it.c.nome) + '</b> <span class="muted">' + (FAC[it.c.fac] || it.c.fac) + ' · ' + it.c.rar + '</span> <span class="bal-ch">' + balChanges(it) + '</span>'
      + '<select data-act="bal-kind" data-id="' + it.id + '"><option value="buff"' + (it.kind === 'buff' ? ' selected' : '') + '>Buff</option><option value="nerf"' + (it.kind === 'nerf' ? ' selected' : '') + '>Nerf</option><option value="ajuste"' + (it.kind === 'ajuste' ? ' selected' : '') + '>Ajuste</option></select></div>'
      + richBox('bal-' + it.id, '', { small: true, preview: false, ph: 'Por que esta carta mudou? (obrigatório)' }) + '</div>').join('')
    + '<details class="trx"><summary>Inglês e espanhol (opcional): quem joga nesses idiomas vê esta versão; sem ela, vê o português</summary>'
    + TRL.map(([k, n]) => '<div class="trx-l"><b>' + n + '</b><label class="f wide">Título<input type="text" id="bal-t-' + k + '" maxlength="80"></label>'
      + '<div class="f wide">Texto de abertura' + richBox('bal-i-' + k, '', { preview: false, small: true }) + '</div>'
      + L.map((it) => '<div class="f wide">' + esc(it.c.nome) + richBox('bal-' + k + '-' + it.id, '', { preview: false, small: true }) + '</div>').join('') + '</div>').join('')
    + '</details>'
    + '<div class="rt-pv"><small>Prévia no jogo (tela que abre ao tocar no aviso)</small><div class="pv-sheet" id="bal-pv">' + balPreview(L) + '</div></div></div>';
}
/* the card as it looks in the game: a picture of it (data/cards, taken from the game without the numbers) with the
   numbers written on top, so the preview shows the new values; the changed ones in green (up) or red (down) */
let CARD_META = null;
fetch('data/cards/meta.json').then((r) => r.json()).then((m) => { CARD_META = m; if (S.balPv) balPreviewSync(); }).catch(() => {});
function cardPic(it) {
  const M = CARD_META, W = 132; if (!M) return '';
  const fs = M.font * W / 100 * .9, nums = it.after.s.map((v, i) => { const p = M.pos[i], o = it.before.s[i]; return '<b class="' + (v > o ? 'up' : v < o ? 'dn' : '') + '" style="left:' + p[0] + '%;top:' + p[1] + '%;font-size:' + fs + 'px">' + v + '</b>'; }).join('');
  const cp = M.cost[it.id], cost = cp && it.after.cost != null ? '<b class="cost ' + (it.after.cost < it.before.cost ? 'up' : it.after.cost > it.before.cost ? 'dn' : '') + '" style="left:' + cp[0] + '%;top:' + cp[1] + '%">' + it.after.cost + '</b>' : '';
  return '<div class="pv-card" style="width:' + W + 'px"><img src="data/cards/' + esc(it.id) + '.webp" alt="">' + nums + cost + '</div>';
}
function balPreview(L) {
  L = L || balDiff();
  const K = { buff: 'BUFF', nerf: 'NERF', ajuste: 'AJUSTE' };
  return '<h3 class="pv-t">' + esc(val('bal-title') || 'Buffs e nerfs') + '</h3>' + (richHasContent(S.rich['bal-intro']) ? '<div class="pv-rich">' + richClean(S.rich['bal-intro']) + '</div>' : '')
    + L.map((it) => '<div class="pv-bal">' + cardPic(it) + '<div class="pv-bt"><b>' + esc(it.c.nome) + '</b><em class="pv-k ' + it.kind + '">' + K[it.kind] + '</em><div class="bal-ch">' + balChanges(it) + '</div>'
      + (richHasContent(S.rich['bal-' + it.id]) ? '<div class="pv-rich">' + richClean(S.rich['bal-' + it.id]) + '</div>' : '<p class="bad-t">Falta a explicação.</p>') + '</div></div>').join('');
}
function balPreviewSync() { const pv = document.getElementById('bal-pv'); if (pv) pv.innerHTML = balPreview(); }
async function balSave() {
  const L = balDiff();
  const miss = L.filter((it) => !richHasContent(S.rich['bal-' + it.id]));
  if (miss.length) { toast('Escreva a explicação de: ' + miss.map((it) => it.c.nome).join(', ') + '.', true); return; }
  if (!confirm('Publicar ' + L.length + (L.length === 1 ? ' mudança' : ' mudanças') + ' e o aviso nas Notícias?')) return;
  const items = L.map((it) => ({ id: it.id, kind: it.kind === 'ajuste' ? 'adj' : it.kind, before: it.before, after: it.after, note: richClean(S.rich['bal-' + it.id]) }));
  const notes = Object.assign({}, (S.cfg.balance && S.cfg.balance.notes) || {}); items.forEach((it) => { notes[it.id] = { at: new Date().toISOString(), kind: it.kind, note: it.note }; });
  if (!(await saveCfg('balance', Object.assign({}, S.cfg.balance || {}, { cards: S.bal, notes })))) return;
  const intro = richClean(S.rich['bal-intro'] || '');
  const tr = {};
  TRL.forEach(([k]) => { const o = {}, t = val('bal-t-' + k), i = richClean(S.rich['bal-i-' + k] || ''), notes = {};
    L.forEach((it) => { const h = richClean(S.rich['bal-' + k + '-' + it.id] || ''); if (h) notes[it.id] = h; });
    if (t) o.title = t; if (i) o.intro = i; if (Object.keys(notes).length) o.notes = notes; if (Object.keys(o).length) tr[k] = o; });
  const { error } = await sb.from('news').insert({ title: val('bal-title') || 'Buffs e nerfs', tag: 'Balanceamento', body: BALN + JSON.stringify(Object.assign({ intro, items }, Object.keys(tr).length ? { tr } : {})), pinned: false, starts_at: new Date().toISOString() });
  if (error) { fail(error); toast('Os ajustes foram publicados, mas o aviso não entrou nas Notícias: ' + error.message, true); }
  else toast('Ajustes e aviso publicados. Os jogadores recebem ao abrir o jogo.');
  S.bal = JSON.parse(JSON.stringify(S.bal)); S.balKind = {}; Object.keys(S.rich).forEach((k) => { if (k.indexOf('bal-') === 0) delete S.rich[k]; }); S.news = null; S.balPv = false; render();
}
function setBal(id, fn) {
  const c = cardBy(id); if (!c) return;
  const o = Object.assign({ s: c.s.slice(), cost: c.act ? c.act.cost : null }, S.bal[id] || {});
  if (!o.s) o.s = c.s.slice();
  fn(o);
  const sameS = o.s.every((v, i) => +v === c.s[i]), sameC = !c.act || o.cost == null || +o.cost === c.act.cost;
  if (sameS && sameC) delete S.bal[id];
  else { const out = {}; if (!sameS) out.s = o.s.map(Number); if (!sameC) out.cost = +o.cost; S.bal[id] = out; }
}

/* ---------- PARTIDA (tempo das jogadas no Online) ---------- */
function matchHTML() {
  const c = Object.assign({ turn: 25, eq: 10, vote: 10 }, S.cfg.match || {});
  return '<h1>Partida</h1><p class="sub">Tempo das jogadas no modo Online (o Treino contra a IA não tem tempo). Vale para todos a partir da próxima vez que o jogador abrir o jogo.</p>'
    + '<div class="card"><div class="form">'
    + '<label class="f">Jogada principal (segundos)<input type="number" id="mt-turn" min="10" max="120" value="' + c.turn + '"></label>'
    + '<label class="f">Escolha de equipamento (segundos)<input type="number" id="mt-eq" min="5" max="60" value="' + c.eq + '"></label>'
    + '<label class="f">Voto do campo (segundos)<input type="number" id="mt-vote" min="5" max="60" value="' + c.vote + '"></label>'
    + '</div><ul class="muted" style="margin:12px 0;padding-left:18px;line-height:1.6">'
    + '<li>Quando o tempo da jogada acaba: joga a carta escolhida (ou uma aleatória) com o atributo mais forte, sem habilidade e sem equipamento.</li>'
    + '<li>Duas rodadas seguidas estourando o tempo = derrota por inatividade (vitória normal para o rival).</li>'
    + '<li>Equipamento: um dos dois é escolhido ao acaso. Voto do campo: conta como aceitar o campo.</li>'
    + '<li>A tela de resultado do duelo não tem tempo.</li></ul>'
    + '<button class="btn go" data-act="match-save">Salvar</button></div>';
}

/* ---------- ECONOMIA (progresso no servidor, partidas conferidas) ---------- */
async function loadEcon() {
  const [a, b] = await Promise.all([sb.rpc('admin_game_summary', { p_days: S.days || 7 }), sb.rpc('admin_game_matches', { p_days: S.days || 7 })]);
  // server not published yet: the tables and functions of docs/supabase-economy.sql do not exist
  if (a.error && /could not find the function|does not exist/i.test(a.error.message || '')) { S.econ = { missing: true, sum: {}, list: [] }; return; }
  if (a.error) throw a.error;
  S.econ = { sum: a.data || {}, list: b.data || [] };
}
function econHTML() {
  const kpi = (t, v) => '<div class="card kpi"><small>' + t + '</small><b>' + v + '</b></div>';
  const on = !!(S.cfg.econ && S.cfg.econ.on), s = S.econ.sum || {}, L = S.econ.list || [];
  const why = (m) => m.status === 'abandoned' ? 'Não terminou (o app fechou ou perdeu a conexão)' : esc(m.why || '—');
  if (S.econ.missing) return '<h1>Economia</h1><div class="card"><h2>Servidor ainda não publicado</h2>'
    + '<p>As tabelas e a função <code>game</code> ainda não existem no Supabase, por isso esta aba não tem o que mostrar.</p>'
    + '<ol style="line-height:1.7;padding-left:20px"><li>No GitHub, repositório <b>faction-duels</b>: Settings → Secrets and variables → Actions. Confira se existe o segredo <code>SUPABASE_ACCESS_TOKEN</code>.</li>'
    + '<li>Abra Actions → <b>Servidor do jogo</b> → Run workflow → Run workflow.</li>'
    + '<li>Espere ficar verde (cerca de 2 minutos) e recarregue esta página.</li></ol>'
    + '<p class="muted">Enquanto isso o jogo continua guardando o progresso no celular, como antes.</p></div>';
  return '<h1>Economia</h1><p class="sub">Com a economia no servidor, ouro, fragmentos, cartas, pacotes, níveis e missões só mudam pela função <code>game</code>. Cada partida online é repetida no servidor antes de pagar.</p>'
    + '<div class="card"><h2>Economia no servidor</h2><p>' + (on ? '<span class="pill p-good">Ligada</span> O app usa o servidor para tudo (contas com login).' : '<span class="pill p-gold">Desligada</span> O app ainda guarda o progresso no celular.') + '</p>'
    + '<p class="muted">Ligue só depois que a função <code>game</code> estiver publicada (GitHub → Actions → “Servidor do jogo” com sucesso). Ao ligar, o progresso de cada conta é copiado uma vez para o servidor (com limites: 20 mil de ouro e de fragmentos, 50 pacotes).</p>'
    + '<button class="btn ' + (on ? 'danger' : 'go') + '" data-act="econ-toggle">' + (on ? 'Desligar' : 'Ligar') + '</button></div>'
    + '<div class="grid g4 sec">' + kpi('Partidas conferidas', nf(s.done || 0)) + kpi('Recusadas', nf(s.refused || 0)) + kpi('Abandonadas', nf(s.abandoned || 0)) + kpi('Contas no servidor', nf(s.accounts || 0)) + '</div>'
    + '<div class="card sec"><h2>Contas de teste</h2><p class="muted">Podem usar “todas as cartas” e, no passe, a compra simulada.</p>'
    + '<div class="row"><input type="email" id="ec-email" placeholder="e-mail da conta" style="flex:1"><button class="btn sm go" data-act="econ-tester" data-v="1">Marcar</button><button class="btn sm" data-act="econ-tester" data-v="0">Desmarcar</button></div>'
    + '<p>' + ((s.testers || []).length ? (s.testers || []).map((e) => '<span class="pill">' + esc(e) + '</span>').join(' ') : '<span class="muted">Nenhuma conta de teste.</span>') + '</p></div>'
    + '<div class="card sec"><h2>Replay de partidas</h2><p class="muted">Partidas online guardadas no servidor. Deixe o e-mail em branco para ver as de todas as contas.</p>'
    + '<div class="row"><input type="email" id="rp-email" placeholder="e-mail da conta (opcional)" style="flex:1"><button class="btn sm go" data-act="rp-find">Buscar</button></div>'
    + (S.rpList ? (S.rpList.length ? '<table class="sec"><thead><tr><th>Quando</th><th>Conta</th><th>Resultado</th><th>Jogadas</th><th></th></tr></thead><tbody>'
      + S.rpList.map((m) => '<tr><td>' + dt(m.created_at) + '</td><td>' + esc(m.email) + '</td><td>' + rpRes(m) + '</td><td>' + nf(m.moves) + '</td><td><button class="btn sm" data-act="rp-open" data-v="' + m.id + '">Ver replay</button></td></tr>').join('') + '</tbody></table>'
      : '<p class="muted sec">Nenhuma partida encontrada.</p>') : '') + '</div>'
    + '<div class="card sec"><h2>Partidas recusadas e abandonadas (' + (S.days || 7) + ' dias)</h2>'
    + (L.length ? '<table><thead><tr><th>Quando</th><th>Conta</th><th>Situação</th><th>Motivo</th><th>Bot</th><th>Jogadas</th></tr></thead><tbody>'
      + L.map((m) => '<tr><td>' + dt(m.created_at) + '</td><td>' + esc(m.email) + '</td><td>' + (m.status === 'refused' ? '<span class="pill p-bad">Recusada</span>' : '<span class="pill">Abandonada</span>') + '</td><td>' + why(m) + '</td><td>' + m.bot + '</td><td>' + nf(m.moves) + ' <button class="btn sm" data-act="rp-open" data-v="' + m.id + '">Replay</button></td></tr>').join('') + '</tbody></table>'
      : '<p class="muted">Nenhuma.</p>')
    + '<p class="muted">Recusada: o diário de jogadas tinha algo que o jogo não permite (por exemplo, usar uma habilidade sem Essência). Desde a Beta 0.86 ela é anulada: sem recompensa, sem derrota e sem mudar o ranking. Muitas recusadas da mesma conta indicam tentativa de trapaça.</p></div>';
}

/* ---------- REPLAY (o servidor refaz a partida e devolve um quadro por duelo) ---------- */
const ATTR = ['FORÇA', 'DEFESA', 'VELOCIDADE', 'ENERGIA', 'TÉCNICA', 'INTELIGÊNCIA'];
const ATTR_S = ['FOR', 'DEF', 'VEL', 'ENE', 'TEC', 'INT'];
const RCOL = { 'Comum': '#c3cad5', 'Rara': '#5aa2ff', 'Épica': '#b77cff', 'Lendária': '#ffcf4d' };
const RP_MS = { round: 1300, eq: 1500, mull: 1000, play: 1400, duel: 2800, end: 0 };
function rpRes(m) {
  if (m.status === 'refused') return '<span class="pill p-bad">Recusada</span>';
  if (m.status === 'abandoned') return '<span class="pill">Abandonada</span>';
  const sg = m.result ? m.result.sign : 0;
  return sg > 0 ? '<span class="pill p-good">Vitória</span>' : sg < 0 ? '<span class="pill p-bad">Derrota</span>' : '<span class="pill">Empate</span>';
}
async function rpOpen(id) {
  S.rp = { id, loading: true, k: 0, playing: false, speed: 1, zoom: null }; rpDraw();
  const { data, error } = await sb.functions.invoke('game', { body: { op: 'replay', a: { id } } });
  if (!S.rp || S.rp.id !== id) return;
  S.rp.loading = false;
  if (error || !data || data.err || !data.out || !data.out.steps) { S.rp.err = (data && data.err) || (error && error.message) || 'erro'; rpDraw(); return; }
  S.rp.data = data.out; S.rp.playing = true; rpDraw(); rpTick();
}
function rpClose() { if (S.rp && S.rp.t) clearTimeout(S.rp.t); S.rp = null; const o = document.getElementById('rp'); if (o) o.remove(); }
function rpTick() {
  const R = S.rp; if (!R) return; if (R.t) clearTimeout(R.t);
  if (!R.data || !R.playing || R.zoom) return;
  const St = R.data.steps;
  if (R.k >= St.length - 1) { R.playing = false; rpDraw(); return; }
  R.t = setTimeout(() => { if (!S.rp || !S.rp.playing) return; R.k++; rpDraw(); rpTick(); }, (RP_MS[St[R.k].t] || 1200) / R.speed);
}
function rpSeek(k) { const R = S.rp; if (!R || !R.data) return; R.k = Math.max(0, Math.min(R.data.steps.length - 1, k)); rpDraw(); if (R.playing) rpTick(); }
const rpCat = (id) => (S.cat && S.cat.cards || []).find((k) => k.id === id);
const eqN = (id) => { const e = (S.cat && S.cat.eqs || []).find((x) => x.id === id); return e ? e.nome : id; };
function rpMini(id, cls) {
  const c = rpCat(id);
  return '<button class="rpm' + (cls || '') + '" data-act="rp-zoom" data-v="' + esc(id) + '" style="--rc:' + (c ? RCOL[c.rar] : '#888') + '"><b>' + esc(c ? c.nome : id) + '</b>'
    + (c && c.s ? '<span>' + c.s.map((v, k) => ATTR_S[k] + ' ' + v).join(' · ') + '</span>' : '') + '</button>';
}
function rpCard(x, cls) {
  if (!x) return '<div class="rpc empty"></div>';
  if (x.back) return '<div class="rpc back">' + (x.badge ? esc(x.badge) : '?') + '</div>';
  const c = rpCat(x.id);
  const st = c && c.s ? '<div class="rpc-s">' + c.s.map((v, k) => '<span class="' + ((x.attrs || []).includes(k) ? 'on' : '') + '"><small>' + ATTR_S[k] + '</small>' + v + '</span>').join('') + '</div>' : '';
  return '<button class="rpc' + (cls || '') + '" data-act="rp-zoom" data-v="' + esc(x.id) + '" style="--rc:' + (c ? RCOL[c.rar] : '#999') + '"><b>' + esc(c ? c.nome : x.n || x.id) + '</b><small>' + esc(c ? c.rar : '') + ' · ' + esc(c ? (FAC[c.fac] || c.fac) : '') + (c && c.el ? ' · ' + esc(c.el) : '') + '</small>' + st + '</button>';
}
function rpUsed(x) {
  return [x.eqn ? '<span class="pill">🗡 ' + esc(x.eqn) + '</span>' : '', x.act ? '<span class="pill' + (x.act.used ? ' p-gold' : '') + '">' + esc(x.act.n) + (x.act.used ? '' : ' (anulada)') + '</span>' : '',
    x.cmd ? '<span class="pill p-gold">★ ' + esc(typeof x.cmd === 'string' ? x.cmd : 'Comandante') + '</span>' : '', x.boost ? '<span class="pill">+' + x.boost + ' reforço</span>' : ''].join(' ');
}
function rpBar(sn, who, cmd, max) {
  if (!sn) return '';
  const hp = sn.hp != null ? '<span class="rp-hp' + (who === 'a' ? ' foe' : '') + '"><i style="width:' + Math.max(0, Math.round(100 * sn.hp / max)) + '%"></i><b>' + sn.hp + '</b></span>' : '<b>' + sn.sc + '</b>';
  return '<div class="rp-pbar"><div><b>' + esc(who === 'a' ? S.rp.data.nick + ' (bot)' : 'Jogador') + '</b>' + (cmd ? '<small>' + esc(cmd.n) + '</small>' : '') + hp + '</div><div class="r"><small>Essência</small><b>' + sn.ki + '/5</b>'
    + (sn.eq && sn.eq.length ? '<small>Mochila: ' + sn.eq.map((id) => esc(eqN(id))).join(', ') + '</small>' : '') + '</div></div>';
}
function rpDraw() {
  let o = document.getElementById('rp');
  if (!S.rp) { if (o) o.remove(); return; }
  if (!o) { o = document.createElement('div'); o.id = 'rp'; o.className = 'rp-ov'; document.body.appendChild(o); }
  const R = S.rp, D = R.data;
  const top = '<div class="rp-top"><b>Replay</b>' + (D ? '<span class="muted">' + esc(D.nick) + ' · ' + dt(D.at) + '</span>' : '') + (D && D.raw ? '<button class="btn sm" data-act="rp-raw">Copiar dados</button>' : '') + '<button class="btn sm" data-act="rp-exit">Sair</button></div>';
  if (R.loading || R.err || !D) { o.innerHTML = '<div class="rp-box">' + top + '<p class="muted pad">' + (R.loading ? 'Preparando o replay…' : R.err === 'versao' ? 'Partida de uma versão antiga: o servidor não guarda mais essas regras.' : 'Não deu para abrir o replay: ' + esc(R.err)) + '</p></div>'; return; }
  const St = D.steps, k = Math.max(0, Math.min(St.length - 1, R.k)), st = St[k], max = (D.head.hp && D.head.hp[0]) || 30;
  let ph = st.p ? st.p.hand.slice() : [], ah = st.a ? st.a.hand.slice() : [], L = null, Rr = null, cap = '', aiIdx = -1, extra = '';
  const atkA = st.ai && st.att === 'a' && !st.sudden ? st.ai : null;
  if (st.t === 'round') { cap = st.sudden ? 'Morte súbita' : st.att === 'p' ? 'Rodada ' + st.r + ' · jogador ataca' : 'Rodada ' + st.r + ' · ' + esc(D.nick) + ' ataca com ' + (atkA ? ATTR[atkA.attr] : '?'); if (atkA) { aiIdx = atkA.i; Rr = { back: true, badge: ATTR_S[atkA.attr] }; } }
  else if (st.t === 'eq') { cap = 'Equipamento: escolheu ' + esc(eqN(st.pick)) + (st.offer.length > 1 ? ' (oferta: ' + st.offer.map((x) => esc(eqN(x))).join(' / ') + ')' : ''); if (atkA) { aiIdx = atkA.i; Rr = { back: true, badge: ATTR_S[atkA.attr] }; } }
  else if (st.t === 'mull') cap = 'Jogador trocou a mão';
  else if (st.t === 'play') {
    const s = st.sel, id = ph[s.i], c = rpCat(id); L = { id, attrs: s.attr != null ? [s.attr] : [] }; ph.splice(s.i, 1);
    Rr = atkA ? { back: true, badge: ATTR_S[atkA.attr] } : { back: true }; if (atkA) aiIdx = atkA.i;
    cap = 'Jogador joga ' + esc(c ? c.nome : id) + (s.attr != null ? ' com ' + ATTR[s.attr] : '') + [s.act ? ' · habilidade' : '', s.eq != null && st.p.eq[s.eq] ? ' · equipamento ' + esc(eqN(st.p.eq[s.eq])) : '', s.cmd ? ' · Comandante' : '', s.boost ? ' · +' + s.boost + ' reforço' : ''].join('');
  } else if (st.t === 'duel') {
    const f = st.duel; L = f.p; Rr = f.a;
    cap = (f.w === 'p' ? 'Jogador venceu o duelo' : f.w === 'a' ? esc(D.nick) + ' venceu o duelo' : 'Empate') + ' · ' + f.p.total + ' × ' + f.a.total;
    const calc = (x) => '<ul class="rp-calc">' + (x.L || []).map((l) => '<li><span>' + esc(l[0]) + '</span><b>' + (l[1] > 0 && l[2] !== 'base' ? '+' : '') + l[1] + '</b></li>').join('') + '</ul>';
    extra = '<div class="rp-duel2c"><div><div class="rp-tot' + (f.w === 'p' ? ' win' : ' lost') + '">' + f.p.total + '</div><div class="rp-used">' + rpUsed(f.p) + '</div>' + calc(f.p) + '</div><div></div><div><div class="rp-tot' + (f.w === 'a' ? ' win' : ' lost') + '">' + f.a.total + '</div><div class="rp-used">' + rpUsed(f.a) + '</div>' + calc(f.a) + '</div></div>';
  } else if (st.t === 'end') { const e = st.end || D.end; cap = (e.sign > 0 ? 'Vitória do jogador' : e.sign < 0 ? 'Derrota do jogador' : 'Empate') + (D.status === 'refused' ? ' · RECUSADA: ' + esc(D.why || '') + (e.stop ? ' (parou em: ' + esc(e.stop) + ')' : '') : e.surrender ? (e.complete ? ' · desistência' : ' · não terminou') : ''); }
  const win = st.t === 'duel' ? st.duel.w : null;
  const table = rpBar(st.a, 'a', D.head.a.cmd, max)
    + '<div class="rp-hand">' + ah.map((id, i) => rpMini(id, i === aiIdx ? ' atk' : '')).join('') + '</div>'
    + '<div class="rp-chips"><span class="pill">' + esc(st.fieldN || D.head.field || '') + '</span><span class="pill">' + (st.sudden ? 'MORTE SÚBITA' : 'RODADA ' + (st.r || 1)) + '</span>' + (st.sealed != null ? '<span class="pill p-bad">PROIBIDO: ' + ATTR_S[st.sealed] + '</span>' : '') + '</div>'
    + '<div class="rp-duel"><div>' + rpCard(L, win === 'p' ? ' win' : win === 'a' ? ' lost' : '') + '</div><div class="rp-vs">VS</div><div>' + rpCard(Rr, win === 'a' ? ' win' : win === 'p' ? ' lost' : '') + '</div></div>'
    + extra + '<p class="rp-w">' + cap + '</p>'
    + '<div class="rp-hand">' + ph.map((id) => rpMini(id)).join('') + '</div>'
    + rpBar(st.p, 'p', D.head.p.cmd, max);
  const ctr = '<div class="rp-ctr"><div class="rp-tl"><button class="btn" data-act="rp-step" data-v="-1">◀</button><input type="range" id="rp-seek" min="0" max="' + (St.length - 1) + '" value="' + k + '"><button class="btn" data-act="rp-step" data-v="1">▶</button><span class="muted">' + (k + 1) + '/' + St.length + '</span></div>'
    + '<div class="rp-btns"><button class="btn ' + (R.playing ? '' : 'go') + '" data-act="rp-play">' + (R.playing ? '❚❚ Pausa' : '▶ Play') + '</button>'
    + [2, 3, 4, 6].map((s) => '<button class="btn' + (R.speed === s ? ' on' : '') + '" data-act="rp-speed" data-v="' + s + '">' + s + 'x</button>').join('')
    + '<button class="btn danger" data-act="rp-exit">Sair</button></div></div>';
  let zoom = '';
  if (R.zoom) {
    const c = rpCat(R.zoom);
    zoom = '<div class="rp-zoom" data-act="rp-unzoom"><div class="rp-zbox">' + (c ? '<b style="color:' + RCOL[c.rar] + '">' + esc(c.nome) + '</b><small class="muted">' + esc(c.rar) + ' · ' + esc(FAC[c.fac] || c.fac) + ' · ' + esc(c.el || '') + '</small>'
      + '<div class="rpc-s">' + c.s.map((v, k) => '<span><small>' + ATTR_S[k] + '</small>' + v + '</span>').join('') + '</div><p>' + esc(c.pas || '') + '</p>' + (c.act ? '<p><b>' + esc(c.act.nome) + '</b> (' + c.act.cost + ' Essência): ' + esc(c.act.txt) + '</p>' : '') : esc(R.zoom))
      + '<button class="btn go" data-act="rp-unzoom">Fechar</button></div></div>';
  }
  o.innerHTML = '<div class="rp-box">' + top + '<div class="rp-stage">' + table + '</div>' + ctr + '</div>' + zoom;
}
document.addEventListener('input', (e) => { if (e.target && e.target.id === 'rp-seek' && S.rp) { if (S.rp.t) clearTimeout(S.rp.t); S.rp.k = +e.target.value; rpDraw(); const el = document.getElementById('rp-seek'); if (el) el.focus(); } });
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'rp-seek' && S.rp && S.rp.playing) rpTick(); });

/* ---------- EVENTOS ---------- */
async function loadEvents() { const { data, error } = await sb.from('live_events').select('*').order('starts_at', { ascending: false }).limit(100); if (error) throw error; S.events = data; }
function eventsHTML() {
  const now = Date.now();
  const status = (e) => (Date.parse(e.ends_at) <= now ? '<span class="pill p-muted">encerrado</span>' : Date.parse(e.starts_at) > now ? '<span class="pill p-blue">agendado</span>' : '<span class="pill p-good">no ar</span>');
  const d = new Date(); d.setMinutes(0, 0, 0);
  const end = new Date(d.getTime() + 3 * 86400000);
  return '<h1>Eventos</h1><p class="sub">Multiplicadores por tempo limitado. Aparecem como faixa no menu do jogo e somam na tela de recompensa da partida. Se dois eventos do mesmo tipo coincidirem, vale o maior.</p>'
    + '<div class="card"><h2>Novo evento</h2><div class="form">'
    + '<label class="f">Tipo<select id="ev-kind"><option value="gold_mult">Ouro das partidas ×</option><option value="xp_mult">XP das partidas ×</option></select></label>'
    + '<label class="f">Multiplicador<input type="number" id="ev-val" value="2" min="1.1" max="5" step="0.1"></label>'
    + '<label class="f">Começa<input type="datetime-local" id="ev-start" value="' + toInput(d.toISOString()) + '"></label>'
    + '<label class="f">Termina<input type="datetime-local" id="ev-end" value="' + toInput(end.toISOString()) + '"></label>'
    + '<label class="f wide">Título (aparece no jogo)<input type="text" id="ev-title" maxlength="80" placeholder="Fim de semana de ouro em dobro"></label>'
    + '<label class="f wide">Descrição curta (opcional)<input type="text" id="ev-body" maxlength="200" placeholder="Todas as partidas dão o dobro de ouro"></label>'
    + trBlock('ev', false, null, { tmax: 80, bmax: 200 })
    + '</div><div class="row" style="margin-top:12px"><button class="btn go" data-act="ev-save">Criar evento</button></div></div>'
    + '<div class="card sec"><h2>Eventos</h2>' + ((S.events || []).length ? S.events.map((e) => '<div class="list-item"><div class="t"><b>' + esc(e.title) + ' ' + status(e) + '</b><p>' + ({ gold_mult: 'Ouro', xp_mult: 'XP' }[e.kind] || e.kind) + ' ×' + e.value + ' · ' + dt(e.starts_at) + ' até ' + dt(e.ends_at) + (e.body ? '\n' + esc(e.body) : '') + '</p></div>'
      + (Date.parse(e.ends_at) > now ? '<button class="btn sm" data-act="ev-end" data-v="' + e.id + '">Encerrar agora</button>' : '') + '<button class="btn sm danger" data-act="ev-del" data-v="' + e.id + '">Apagar</button></div>').join('') : '<p class="muted">Nenhum evento ainda.</p>') + '</div>';
}

/* ---------- NOTÍCIAS ---------- */
const newsPlain = (b) => { b = String(b || ''); if (b.startsWith(BALN)) { try { const d = JSON.parse(b.slice(BALN.length)); return 'Aviso de balanceamento · ' + (d.items || []).length + ' carta(s)'; } catch (err) { return ''; } } b = trParse(b).base; return b.startsWith(RICH) ? richText(b.slice(RICH.length)) : b; };
async function loadNews() { const { data, error } = await sb.from('news').select('*').order('starts_at', { ascending: false }).limit(100); if (error) throw error; S.news = data; }
function newsHTML() {
  const e = S.edit && S.edit.t === 'news' ? S.edit.row : null;
  const now = Date.now();
  const status = (n) => (n.ends_at && Date.parse(n.ends_at) <= now ? '<span class="pill p-muted">saiu do ar</span>' : Date.parse(n.starts_at) > now ? '<span class="pill p-blue">agendada</span>' : '<span class="pill p-good">no ar</span>');
  return '<h1>Notícias</h1><p class="sub">Aparecem no botão de notícias do menu, com um contador das que o jogador ainda não leu. Fixadas ficam no topo.</p>'
    + '<div class="card"><h2>' + (e ? 'Editar notícia' : 'Nova notícia') + '</h2><div class="form">'
    + '<label class="f wide">Título<input type="text" id="nw-title" maxlength="120" value="' + esc(e ? e.title : '') + '"></label>'
    + '<label class="f">Etiqueta (opcional)<input type="text" id="nw-tag" maxlength="24" placeholder="Novidade, Manutenção, Evento…" value="' + esc(e ? e.tag || '' : '') + '"></label>'
    + '<label class="f">Aparece a partir de<input type="datetime-local" id="nw-start" value="' + toInput(e ? e.starts_at : new Date().toISOString()) + '"></label>'
    + '<label class="f">Sai do ar em (opcional)<input type="datetime-local" id="nw-end" value="' + toInput(e ? e.ends_at : null) + '"></label>'
    + '<label class="chk"><input type="checkbox" id="nw-pin"' + (e && e.pinned ? ' checked' : '') + '> Fixar no topo</label>'
    + '<div class="f wide">Texto' + richBox('nw-body', e ? richFrom(trParse(e.body).base) : '', { ph: 'Escreva a notícia…' }) + '</div>'
    + trBlock('nw', true, e ? trParse(e.body).o : null)
    + '</div><div class="row" style="margin-top:12px"><button class="btn go" data-act="nw-save">' + (e ? 'Salvar' : 'Publicar') + '</button>' + (e ? '<button class="btn" data-act="edit-cancel">Cancelar</button>' : '') + '</div></div>'
    + '<div class="card sec"><h2>Publicadas</h2>' + ((S.news || []).length ? S.news.map((n) => '<div class="list-item"><div class="t"><b>' + (n.pinned ? '📌 ' : '') + esc(n.title) + ' ' + status(n) + '</b><p>' + (n.tag ? esc(n.tag) + ' · ' : '') + dt(n.starts_at) + (n.ends_at ? ' até ' + dt(n.ends_at) : '') + '\n' + esc(newsPlain(n.body)).slice(0, 300) + '</p></div><button class="btn sm" data-act="nw-edit" data-v="' + n.id + '">Editar</button><button class="btn sm danger" data-act="nw-del" data-v="' + n.id + '">Apagar</button></div>').join('') : '<p class="muted">Nenhuma notícia ainda.</p>') + '</div>';
}

/* ---------- PRÊMIOS ---------- */
async function loadMail() {
  const { data, error } = await sb.from('mail').select('*').order('created_at', { ascending: false }).limit(100); if (error) throw error; S.mail = data;
  const ids = data.map((m) => m.id); S.claims = {};
  if (ids.length) { const c = await sb.from('mail_claims').select('mail_id').in('mail_id', ids); (c.data || []).forEach((r) => { S.claims[r.mail_id] = (S.claims[r.mail_id] || 0) + 1; }); }
}
function rewardTxt(r) {
  const out = [];
  if (r.gold) out.push(nf(r.gold) + ' ouro'); if (r.dust) out.push(nf(r.dust) + ' fragmentos'); if (r.packs) out.push(r.packs + ' pacote(s)');
  if (r.gems) out.push(nf(r.gems) + ' gemas'); if (r.fpacks) out.push(r.fpacks + ' pacote(s) de facção'); if (r.cmdPacks) out.push(r.cmdPacks + ' pacote(s) de Comandante'); if (r.eqPacks) out.push(r.eqPacks + ' pacote(s) de equipamentos');
  (r.cos || []).forEach((id) => out.push(id));
  (r.cards || []).forEach((id) => out.push((cardBy(id) || {}).nome || id)); (r.cmds || []).forEach((id) => out.push('Cmd. ' + ((cmdBy(id) || {}).nome || id))); (r.eqs || []).forEach((id) => out.push((eqBy(id) || {}).nome || id));
  return out.join(' · ') || '—';
}
function pickerHTML(kind, label, items) {
  return '<label class="f wide">' + label + '<div class="row"><input type="text" list="dl-' + kind + '" id="pk-' + kind + '" placeholder="Digite e escolha…" style="flex:1"><button class="btn sm" data-act="pick-add" data-v="' + kind + '">Adicionar</button></div>'
    + '<datalist id="dl-' + kind + '">' + items.map((x) => '<option value="' + esc(x.nome) + '">' + esc(x.rar + (x.fac ? ' · ' + (FAC[x.fac] || x.fac) : '')) + '</option>').join('') + '</datalist>'
    + '<div class="chips">' + S.picks[kind].map((id, i) => { const x = items.find((y) => y.id === id); return '<span class="chip">' + esc(x ? x.nome : id) + '<button data-act="pick-del" data-v="' + kind + ':' + i + '" aria-label="Remover">×</button></span>'; }).join('') + '</div></label>';
}
function mailHTML() {
  const to = S.mailTo, u = S.mailUser;
  return '<h1>Prêmios e compensações</h1><p class="sub">Vão para a Caixa de prêmios do jogo. O jogador resgata uma vez só (o servidor confere). “Todos” vale para quem já tinha conta quando o prêmio foi criado; marque “incluir contas novas” para valer também para quem entrar depois.</p>'
    + '<div class="card"><h2>Novo prêmio</h2><div class="form">'
    + '<div class="f wide">Para quem<div class="seg"><button data-act="mail-to" data-v="all" class="' + (to === 'all' ? 'on' : '') + '">Todos os jogadores</button><button data-act="mail-to" data-v="one" class="' + (to === 'one' ? 'on' : '') + '">Um jogador</button></div></div>'
    + (to === 'all' ? '<label class="chk wide"><input type="checkbox" id="ml-new"> Incluir contas novas (criadas depois deste prêmio)</label>'
      : '<div class="f wide">E-mail ou código do jogador<div class="row"><input type="text" id="ml-email" style="flex:1" value="' + esc(u ? u.email : '') + '"><button class="btn sm" data-act="mail-find">Procurar</button></div>' + (u ? '<span class="pill p-good">' + esc(u.email) + ' · nível ' + (u.level == null ? '—' : u.level) + ' · ' + nf(u.matches) + ' partidas</span>' : '') + '</div>')
    + '<label class="f wide">Título<input type="text" id="ml-title" maxlength="80" placeholder="Compensação da manutenção"></label>'
    + '<div class="f wide">Mensagem (opcional)' + richBox('ml-body', '', { ph: 'Mensagem que acompanha o prêmio…' }) + '</div>'
    + trBlock('ml', true, null, { tmax: 80 })
    + '<label class="f">Ouro<input type="number" id="ml-gold" min="0" max="100000" value="0"></label>'
    + '<label class="f">Fragmentos<input type="number" id="ml-dust" min="0" max="100000" value="0"></label>'
    + '<label class="f">Pacotes de cartas<input type="number" id="ml-packs" min="0" max="50" value="0"></label>'
    + '<label class="f">Gemas<input type="number" id="ml-gems" min="0" max="100000" value="0"></label>'
    + '<label class="f">Pacotes de facção<input type="number" id="ml-fpacks" min="0" max="50" value="0"></label>'
    + '<label class="f">Pacotes de Comandante<input type="number" id="ml-cpacks" min="0" max="50" value="0"></label>'
    + '<label class="f">Pacotes de equipamentos<input type="number" id="ml-epacks" min="0" max="50" value="0"></label>'
    + '<label class="f">Expira em (opcional)<input type="datetime-local" id="ml-exp"></label>'
    + pickerHTML('cards', 'Cartas', S.cat.cards) + pickerHTML('cmds', 'Comandantes', S.cat.cmds.filter((c) => c.rar !== 'Comum')) + pickerHTML('eqs', 'Equipamentos', S.cat.eqs.filter((c) => c.rar !== 'Comum'))
    + '</div><p class="muted">Carta, Comandante ou equipamento que o jogador já tem vira fragmentos.</p><div class="row"><button class="btn go" data-act="mail-send">Enviar prêmio</button></div></div>'
    + '<div class="card sec"><h2>Enviados</h2>' + ((S.mail || []).length ? S.mail.map((m) => '<div class="list-item"><div class="t"><b>' + esc(m.title) + '</b><p>' + (m.target ? 'Um jogador' : 'Todos' + (m.new_players ? ' + contas novas' : '')) + ' · ' + dt(m.created_at) + (m.expires_at ? ' · expira ' + dt(m.expires_at) : '') + '\n' + esc(rewardTxt(m.reward || {})) + '</p></div><span class="pill p-gold">' + nf(S.claims[m.id] || 0) + ' resgate' + ((S.claims[m.id] || 0) === 1 ? '' : 's') + '</span><button class="btn sm danger" data-act="mail-del" data-v="' + m.id + '">Apagar</button></div>').join('') : '<p class="muted">Nenhum prêmio enviado ainda.</p>') + '</div>';
}

/* ---------- VERSÕES ---------- */
/* ---------- Beta 1.68: feedback e sugestões enviados pelo jogo (Configurações › Suporte) ---------- */
async function loadFeedback() {
  let q = sb.from('feedback').select('*').order('created_at', { ascending: false }).limit(200);
  if (S.fbSt && S.fbSt !== 'todos') q = q.eq('status', S.fbSt);
  const { data, error } = await q; if (error) throw error; S.fb = data || [];
  // the players' names (username), for the list
  const ids = Array.from(new Set(S.fb.map((f) => f.user_id).filter(Boolean)));
  S.fbNames = S.fbNames || {};
  if (ids.length) { const r = await sb.rpc('admin_names', { p_ids: ids }); if (!r.error && r.data) Object.assign(S.fbNames, r.data); }
}
function feedbackHTML() {
  const K = { sugestao: 'Sugestão', problema: 'Problema', outro: 'Outro' }, ST = { novo: 'Novo', visto: 'Visto', resolvido: 'Resolvido' };
  const cur = S.fbSt || 'novo';
  return '<h1>Feedback</h1><p class="sub">Mensagens que os jogadores mandam pelo jogo (Configurações › Suporte › Enviar feedback ou sugestão). O código de 8 caracteres é o mesmo que o jogador vê nas Configurações; procure a conta por ele em Jogador.</p>'
    + '<div class="row" style="gap:6px;margin-bottom:12px">' + ['novo', 'visto', 'resolvido', 'todos'].map((k) => '<button class="btn sm' + (cur === k ? ' go' : '') + '" data-act="fb-st" data-v="' + k + '">' + (ST[k] || 'Todos') + '</button>').join('') + '<button class="btn sm" data-act="fb-reload">Atualizar</button></div>'
    + ((S.fb || []).length ? S.fb.map((f) => '<div class="card fb-it"><div class="fb-h"><span class="pill ' + (f.kind === 'problema' ? 'p-bad' : f.kind === 'sugestao' ? 'p-good' : '') + '">' + (K[f.kind] || f.kind) + '</span>'
        + '<b>' + esc((S.fbNames || {})[f.user_id] || 'sem nome') + '</b><b class="mono" title="' + esc(f.user_id) + '">' + esc(String(f.user_id).slice(0, 8).toUpperCase()) + '</b><span class="muted">' + dt(f.created_at) + ' · Beta ' + esc(f.ver || '?') + (f.build ? ' · ' + f.build : '') + (f.apk ? ' · APK ' + f.apk : '') + ' · ' + esc(f.lang || 'pt') + (f.lvl ? ' · nível ' + f.lvl : '') + '</span>'
        + '<span class="pill">' + (ST[f.status] || f.status) + '</span></div>'
        + '<p class="fb-b">' + esc(f.body) + '</p>'
        + '<div class="row" style="gap:6px"><button class="btn sm" data-act="fb-uid" data-v="' + esc(String(f.user_id).slice(0, 8).toUpperCase()) + '">Copiar código</button>'
        + (f.status !== 'visto' ? '<button class="btn sm" data-act="fb-set" data-v="' + f.id + ':visto">Marcar visto</button>' : '')
        + (f.status !== 'resolvido' ? '<button class="btn sm go" data-act="fb-set" data-v="' + f.id + ':resolvido">Resolvido</button>' : '') + '</div></div>').join('')
      : '<p class="muted">Nenhuma mensagem aqui.</p>');
}
async function loadReleases() { const { data, error } = await sb.from('releases').select('build,label,commit_sha,native,size_kb,created_at').order('build', { ascending: false }).limit(60); if (error) throw error; S.releases = data; }
function versionsHTML() {
  const r = S.cfg.release || {};
  return '<h1>Versões</h1><p class="sub">Cada vez que o GitHub monta um APK novo, ele também manda aquela versão do jogo para cá. Nada vai para os jogadores sozinho: você escolhe abaixo qual versão está “no ar”. Na próxima vez que abrirem o app, os jogadores baixam essa versão (cerca de 1 MB) na tela de carregamento, sem instalar APK.</p>'
    + '<div class="note" style="margin-bottom:14px">Um APK que já é mais novo que a versão no ar continua usando a própria versão (ninguém volta para trás sem querer). Para forçar uma volta (um erro na versão nova), escolha a versão antiga e marque “Voltar versão”.</div>'
    + '<div class="card"><h2>No ar agora: ' + (r.bundle ? 'versão ' + r.bundle : 'a que vem dentro de cada APK') + (r.rollback ? ' <span class="pill p-bad">voltando versão</span>' : '') + '</h2>'
    + '<div class="tbl-wrap"><table><thead><tr><th>Versão</th><th>Nome</th><th>Data</th><th class="num">Tamanho</th><th>App mínimo</th><th></th></tr></thead><tbody>'
    + ((S.releases || []).length ? S.releases.map((x) => '<tr><td><b>' + x.build + '</b>' + (+r.bundle === x.build ? ' <span class="pill p-good">no ar</span>' : '') + '</td><td>' + esc(x.label || '') + '</td><td>' + dt(x.created_at) + '</td><td class="num">' + nf(x.size_kb) + ' KB</td><td>' + x.native + '</td><td>'
        + (+r.bundle === x.build ? '' : '<button class="btn sm go" data-act="rel-use" data-v="' + x.build + '">Colocar no ar</button>') + '</td></tr>').join('')
      : '<tr><td colspan="6" class="muted">Nenhuma versão recebida ainda. Elas chegam depois que a chave secreta estiver no GitHub (veja o guia) e um APK novo for montado.</td></tr>')
    + '</tbody></table></div>'
    + '<div class="row" style="margin-top:12px"><label class="chk"><input type="checkbox" id="rl-back"' + (r.rollback ? ' checked' : '') + '> Voltar versão (também para quem tem APK mais novo)</label>' + (r.bundle ? '<button class="btn sm" data-act="rel-use" data-v="0">Tirar do ar (cada APK usa a sua)</button>' : '') + '</div></div>'
    + '<div class="card sec"><h2>Atualização automática</h2><p class="muted" style="margin-top:-4px">A cada montagem no GitHub, a versão nova do jogo entra no ar sozinha e chega a todos os apps ao abrir, sem instalar APK. Um APK novo só é exigido quando a parte nativa do app muda (NATIVE_VERSION) ou quando a versão do jogo não chegou ao servidor. O APK fica nas Releases deste site, sempre no mesmo link.</p>'
    + '<p>APK mais novo: <b>' + (r.latest_build || '—') + '</b> · mínimo exigido agora: <b>' + (r.min_build || '—') + '</b></p>'
    + '<div class="row"><label class="chk"><input type="checkbox" id="rl-auto"' + (r.auto_force === false ? '' : ' checked') + '> Exigir APK novo quando ele for necessário</label><label class="chk"><input type="checkbox" id="rl-ota"' + (r.auto_ota === false ? '' : ' checked') + '> Colocar cada versão nova do jogo no ar sozinha</label>'
    + (r.min_build ? '<button class="btn sm" data-act="rel-unforce">Liberar quem está no APK antigo</button>' : '') + '</div></div>'
    + '<div class="card sec"><h2>App (APK / Play Store)</h2><p class="muted" style="margin-top:-4px">Para obrigar todos a instalar um APK, coloque aqui o número dele (o mesmo de “APK mais novo” acima e de “Faction Duels (versão N)” nas Releases). Quem tem um APK com número menor vê a tela “Atualize o jogo”. 0 = ninguém é obrigado.</p><div class="form">'
    + '<label class="f">APK mínimo obrigatório (número)<input type="number" id="rl-min" min="0" max="' + (r.latest_build || 0) + '" value="' + (r.min_build || 0) + '"></label>'
    + '<label class="f wide">Link da Play Store<input type="url" id="rl-store" placeholder="https://play.google.com/store/apps/details?id=br.factionduels.app" value="' + esc(r.store_url || '') + '"></label>'
    + '<label class="f wide">Mensagem para quem precisa atualizar (opcional)<input type="text" id="rl-msg" maxlength="200" value="' + esc(r.message || '') + '"></label>'
    + '</div><button class="btn go" data-act="rel-save">Salvar</button></div>';
}

/* ---------- JOGADOR ---------- */
function playerHTML() {
  const u = S.player;
  return '<h1>Jogador</h1><p class="sub">Procure uma conta pelo e-mail ou pelo código de 8 caracteres que o jogador vê nas Configurações, para ver nível, saldos, partidas e o registro de tudo que ela ganhou e gastou.</p>'
    + '<div class="card"><div class="row"><input type="text" id="pl-email" placeholder="e-mail ou código (ex.: 3FA85F64)" style="flex:1;max-width:420px" value="' + esc(u && (u.email || u.code) || '') + '"><button class="btn go" data-act="pl-find">Procurar</button></div>'
    + (u === null ? '<p class="muted">Nenhuma conta com esse e-mail ou código.</p>' : u ? '<div class="grid g4 sec">'
      + [['Nome', esc(u.name || '—')], ['Código', '<span class="mono">' + esc(u.code || String(u.id || '').slice(0, 8).toUpperCase()) + '</span>' + (u.same_code ? ' <small class="muted">(+' + u.same_code + ' com o mesmo código)</small>' : '')], ['E-mail', esc(u.email || '')], ['Conta criada', dt(u.created_at)], ['Último login', dt(u.last_sign_in_at)], ['Nível', u.level == null ? '—' : u.level], ['Ouro', nf(u.gold)], ['Gemas', nf(u.gems)], ['Fragmentos', nf(u.dust)], ['Pacotes grátis', nf(u.packs)], ['Partidas', nf(u.matches)], ['Vitórias', nf(u.wins) + ' (' + pctTxt(pct(u.wins, u.matches)) + ')'], ['Última partida', dt(u.last_match)]]
        .map(([k, v]) => '<div class="card kpi"><small>' + k + '</small><b style="font-size:18px">' + v + '</b></div>').join('') + '</div>'
      + (u.src === 'celular' ? '<p class="muted">Saldos do salvo antigo do celular (esta conta ainda não tem progresso no servidor).</p>' : '')
      + '<div class="row sec"><button class="btn" data-act="pl-mail">Mandar prêmio para este jogador</button></div>' : '') + '</div>'
    + (u ? plogHTML() : '');
}

/* ---------- registro de economia (Beta 1.46): o que a conta ganhou e gastou, com o saldo antes e depois ---------- */
const PLOG_OPS = {
  buy: 'Comprou pacote', open: 'Abriu pacote guardado', buyOpen: 'Comprou e abriu pacote', buyOpen10: 'Comprou 10 pacotes',
  craft: 'Criou carta', craftEq: 'Criou equipamento', soulBuy: 'Comprou fragmentos de alma', cardUp: 'Evoluiu carta', cardReset: 'Desfez evolução',
  storeBuy: 'Comprou na loja (ofertas)', cosBuy: 'Comprou cosmético', goldBag: 'Comprou ouro com gemas', iapVerify: 'Compra com dinheiro real',
  mail: 'Resgatou prêmio da caixa', inbox: 'Resgatou prêmio do jogo', evClaim: 'Prêmio de evento/desafio', claimMission: 'Prêmio de missão',
  claimLevel: 'Prêmio de nível', claimLevels: 'Prêmios de nível', trPick: 'Prêmio da Trilha', ftFree: 'Prêmio grátis', start: 'Começou o jogo',
  mAct: 'Partida (pagamento)', matchEnd: 'Partida (pagamento)', mFind: 'Partida', mPoll: 'Partida', state: 'Virada do dia/semana'
};
const PLOG_CUR = [['gold', 'Ouro'], ['gems', 'Gemas'], ['dust', 'Fragmentos'], ['soul', 'Alma']];
const PLOG_PK = { packs: 'pacote', bpacks: 'pacote do banner', fpacks: 'pacote de facção', cmdPacks: 'pacote de Comandante', eqPacks: 'pacote de equipamentos' };
const plogKeep = (r) => {
  const f = S.plogF || 'all', d = r.delta || {};
  if (f === 'all') return true;
  if (f === 'real') return !!(r.what && r.what.real);
  if (f === 'spend') return Object.keys(d).some((k) => d[k][1] < d[k][0]);
  return !!d[f];
};
function plogDetail(r) {
  const w = r.what || {}, it = r.items || {}, a = w.a || {}, out = [];
  if (w.real) out.push('<b>Play Store</b> · ' + esc(w.real.product || '') + (w.real.order ? ' · pedido ' + esc(w.real.order) : '') + ' · +' + nf(w.real.gems) + ' gemas');
  if (a.kind) out.push(esc({ pack: 'normal', fac: 'de facção', banner: 'do banner', cmd: 'de Comandante', eq: 'de equipamentos' }[a.kind] || a.kind) + (a.fac ? ' · ' + esc(FAC[a.fac] || a.fac) : ''));
  if (r.op === 'storeBuy') out.push('pago com ' + (a.cur === 'gems' ? 'gemas' : 'ouro'));
  if (r.op === 'craft' && a.id) out.push(esc((cardBy(a.id) || { nome: a.id }).nome));
  if (r.op === 'craftEq' && a.id) out.push(esc((eqBy(a.id) || { nome: a.id }).nome));
  if (w.match) w.match.forEach((m) => { const x = m.result || {}; out.push((m.status === 'done' ? (x.sign === 1 ? 'Vitória' : x.sign === -1 ? 'Derrota' : 'Empate') : esc(m.status)) + (x.gold ? ' · +' + nf(x.gold) + ' ouro' : '') + (x.xp ? ' · +' + nf(x.xp) + ' XP' : '')); });
  if (w.mail != null) out.push('prêmio #' + esc(w.mail));
  const names = (ids, by) => ids.map((id) => esc((by(id) || { nome: id }).nome)).join(', ');
  if (it.cards) out.push('<b>Cartas novas:</b> ' + names(it.cards, cardBy));
  if (it.cmds) out.push('<b>Comandantes:</b> ' + names(it.cmds, cmdBy));
  if (it.eqs) out.push('<b>Equipamentos:</b> ' + names(it.eqs, eqBy));
  if (it.cos) out.push('<b>Cosméticos:</b> ' + it.cos.map(esc).join(', '));
  if (Array.isArray(w.out) && w.out.length && w.out[0] && w.out[0].id) {
    const dup = w.out.filter((c) => c && c.isNew === false).length;
    if (dup) out.push(dup + ' repetida' + (dup > 1 ? 's' : '') + ' (viraram fragmentos/alma)');
  }
  if (w.nova) out.push('conta nova no servidor');
  return out.join('<br>') || '<span class="muted">—</span>';
}
function plogCell(d) {
  if (!d) return '<td></td>';
  const x = d[1] - d[0];
  return '<td class="num"><b style="color:' + (x < 0 ? 'var(--bad)' : 'var(--good, #63d68a)') + '">' + (x > 0 ? '+' : '−') + nf(Math.abs(x)) + '</b><br><small class="muted">' + nf(d[0]) + ' → ' + nf(d[1]) + '</small></td>';
}
function plogHTML() {
  const L = S.plog;
  if (!L) return '<div class="card sec"><h2>Registro de economia</h2><p class="muted">Carregando…</p></div>';
  const rows = L.filter(plogKeep);
  const tot = {}; rows.forEach((r) => Object.keys(r.delta || {}).forEach((k) => { const x = r.delta[k][1] - r.delta[k][0]; tot[k] = tot[k] || { in: 0, out: 0 }; if (x > 0) tot[k].in += x; else tot[k].out -= x; }));
  const real = rows.filter((r) => r.what && r.what.real).length;
  const F = [['all', 'Tudo'], ['spend', 'Só gastos'], ['gold', 'Ouro'], ['gems', 'Gemas'], ['dust', 'Fragmentos'], ['soul', 'Alma'], ['real', 'Dinheiro real']];
  return '<div class="card sec"><h2>Registro de economia</h2>'
    + '<p class="muted" style="margin-top:0">Cada linha é uma operação que mudou o que a conta tem, com o saldo antes → depois. O registro começa na Beta 1.46 (antes dela não há histórico guardado).</p>'
    + '<div class="row">' + F.map(([k, t]) => '<button class="btn' + ((S.plogF || 'all') === k ? ' go' : '') + '" data-act="plog-f" data-v="' + k + '">' + t + '</button>').join('') + '</div>'
    + '<div class="grid g4 sec">' + PLOG_CUR.map(([k, t]) => '<div class="card kpi"><small>' + t + ' nesta lista</small><b style="font-size:16px">+' + nf((tot[k] || {}).in || 0) + ' / −' + nf((tot[k] || {}).out || 0) + '</b></div>').join('')
    + '<div class="card kpi"><small>Compras com dinheiro real</small><b style="font-size:16px">' + nf(real) + '</b></div></div>'
    + '<div class="tbl-wrap sec"><table><thead><tr><th>Quando</th><th>O que</th><th>Detalhe</th>' + PLOG_CUR.map(([, t]) => '<th class="num">' + t + '</th>').join('') + '<th>Pacotes</th></tr></thead><tbody>'
    + (rows.length ? rows.map((r) => {
      const d = r.delta || {};
      const pk = Object.keys(PLOG_PK).filter((k) => d[k]).map((k) => { const x = d[k][1] - d[k][0]; return (x > 0 ? '+' : '−') + Math.abs(x) + ' ' + PLOG_PK[k] + ' <small class="muted">(' + d[k][0] + ' → ' + d[k][1] + ')</small>'; }).join('<br>');
      return '<tr><td style="white-space:nowrap">' + dt(r.at) + '</td><td>' + esc(PLOG_OPS[r.op] || r.op) + '</td><td style="max-width:420px">' + plogDetail(r) + '</td>' + PLOG_CUR.map(([k]) => plogCell(d[k])).join('') + '<td>' + pk + '</td></tr>';
    }).join('') : '<tr><td colspan="9" class="muted">Nada registrado' + ((S.plogF || 'all') !== 'all' ? ' com este filtro' : '') + '.</td></tr>')
    + '</tbody></table></div>'
    + (S.plogMore ? '<div class="row sec"><button class="btn" data-act="plog-more">Carregar mais antigos</button></div>' : '')
    + '</div>';
}
async function loadPlog(more) {
  const u = S.player; if (!u) return;
  const before = more && S.plog && S.plog.length ? S.plog[S.plog.length - 1].at : null;
  const { data, error } = await sb.rpc('admin_econ_log', { p_email: u.email, p_limit: 300, p_before: before });
  if (error) throw error;
  const list = data || [];
  S.plog = more ? (S.plog || []).concat(list) : list; S.plogMore = list.length === 300;
}

/* ---------- actions ---------- */
document.addEventListener('click', async (e) => {
  const tb = e.target.closest('#tabs button'); if (tb) { go(tb.dataset.tab); return; }
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, v = el.dataset.v;
  try {
    if (act === 'fb-st') { S.fbSt = v; S.fb = null; render(); return; }
    if (act === 'fb-reload') { S.fb = null; render(); return; }
    if (act === 'fb-uid') { try { await navigator.clipboard.writeText(v); toast('Código copiado.'); } catch (err) { toast(v); } return; }
    if (act === 'fb-set') {
      const [id, st] = String(v).split(':');
      const { error } = await sb.from('feedback').update({ status: st }).eq('id', +id); if (error) throw error;
      S.fb = null; toast('Marcado como ' + st + '.'); render(); return;
    }
    if (act === 'login') {
      const { error } = await sb.auth.signInWithPassword({ email: val('lg-email'), password: (document.getElementById('lg-pass') || {}).value || '' });
      if (error) renderLogin(/invalid/i.test(error.message) ? 'E-mail ou senha incorretos. Se você entra no jogo pelo Google, use “Entrar com Google”.' : error.message);
    } else if (act === 'login-google') {
      await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: here() } });
    } else if (act === 'login-link') {
      const email = val('lg-email'); if (!email) return renderLogin('Digite o e-mail primeiro.');
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: here(), shouldCreateUser: false } });
      renderLogin(error ? error.message : 'Enviamos um link para ' + email + '. Abra neste computador.');
    } else if (act === 'logout') { await sb.auth.signOut(); location.hash = ''; }
    else if (act === 'days') { S.days = +v; S.stats = null; S.bots = null; render(); }
    else if (act === 'reload-stats') { S.stats = null; render(); }
    else if (act === 'sort-stat') { S.statSort[el.dataset.k] = v; render(); }
    else if (act === 'bot-src') { S.botSrc = v; render(); }
    else if (act === 'bot-sort') { S.botSort = v; render(); }
    else if (act === 'bot-toggle') {
      const b = Object.assign({}, S.cfg.bots || {}), off = new Set((b.disabled || []).map(Number));
      if (off.has(+v)) off.delete(+v); else off.add(+v);
      b.disabled = Array.from(off).sort((x, y) => x - y);
      if (await saveCfg('bots', b)) { toast(off.has(+v) ? 'Bot desligado do matchmaking.' : 'Bot religado.'); render(); }
    } else if (act === 'save-targets') {
      const b = Object.assign({}, S.cfg.bots || {}); b.targets = {}; HS.forEach((h) => { b.targets[h] = Math.max(5, Math.min(95, +val('tg-' + h) || BOT_TARGETS[h])); }); b.tol = Math.max(3, Math.min(40, +val('tg-tol') || 12));
      if (await saveCfg('bots', b)) { toast('Metas salvas.'); render(); }
    } else if (act === 'save-bal') {
      await balSave();
    } else if (act === 'bal-reset') { delete S.bal[v]; render(); }
    else if (act === 'rp-find') {
      const { data, error } = await sb.rpc('admin_recent_matches', { p_email: val('rp-email') || null, p_days: S.days || 30 }); if (error) return fail(error);
      S.rpList = data || []; render();
    }
    else if (act === 'rp-open') rpOpen(v);
    else if (act === 'rp-play') { if (S.rp && S.rp.data) { if (S.rp.k >= S.rp.data.steps.length - 1) S.rp.k = 0; S.rp.playing = !S.rp.playing; rpDraw(); rpTick(); } }
    else if (act === 'rp-step') { if (S.rp) { if (S.rp.t) clearTimeout(S.rp.t); S.rp.playing = false; rpSeek(S.rp.k + (+v)); } }
    else if (act === 'rp-zoom') { if (S.rp) { if (S.rp.t) clearTimeout(S.rp.t); S.rp.zoom = v; rpDraw(); } }
    else if (act === 'rp-unzoom') { if (S.rp && (!e.target.closest('.rp-zbox') || e.target.closest('.btn'))) { S.rp.zoom = null; rpDraw(); rpTick(); } }
    else if (act === 'rp-speed') { if (S.rp) { S.rp.speed = S.rp.speed === +v ? 1 : +v; if (S.rp.data) S.rp.playing = true; rpDraw(); rpTick(); } }
    else if (act === 'rp-exit') { rpClose(); }
    else if (act === 'rp-raw') {
      const txt = JSON.stringify(S.rp && S.rp.data && S.rp.data.raw);
      try { await navigator.clipboard.writeText(txt); toast('Dados da partida copiados. Cole na conversa com o Claude.'); }
      catch (err) { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Dados da partida copiados.'); }
    }
    else if (act === 'econ-toggle') {
      const on = !(S.cfg.econ && S.cfg.econ.on);
      if (on && !confirm('Ligar a economia no servidor? Confirme que a função game já foi publicada.')) return;
      if (await saveCfg('econ', { on })) { toast(on ? 'Economia no servidor ligada. Vale quando o jogador abrir o app.' : 'Economia no servidor desligada.'); render(); }
    } else if (act === 'econ-tester') {
      const email = val('ec-email'); if (!email) return toast('Digite o e-mail.', true);
      const { data, error } = await sb.rpc('admin_set_tester', { p_email: email, p_on: v === '1' }); if (error) return fail(error);
      if (!data) return toast('Nenhuma conta com esse e-mail no jogo.', true);
      toast(v === '1' ? 'Conta marcada como teste.' : 'Conta desmarcada.'); S.econ = null; render();
    }
    else if (act === 'match-save') {
      const n = (id, d, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+val(id) || d)));
      if (await saveCfg('match', { turn: n('mt-turn', 25, 10, 120), eq: n('mt-eq', 10, 5, 60), vote: n('mt-vote', 10, 5, 60) })) { toast('Tempos salvos.'); S.fresh = true; render(); }
    } else if (act === 'ev-save') {
      const row = { kind: val('ev-kind'), value: +val('ev-val'), title: val('ev-title'), body: val('ev-body') + trMark(trCollect('ev', false)), starts_at: fromInput(val('ev-start')), ends_at: fromInput(val('ev-end')) };
      if (!row.title) return toast('Dê um título ao evento.', true);
      if (!row.ends_at || Date.parse(row.ends_at) <= Date.parse(row.starts_at)) return toast('O fim precisa ser depois do começo.', true);
      if (!(row.value >= 1.1 && row.value <= 5)) return toast('Multiplicador entre 1,1 e 5.', true);
      const { error } = await sb.from('live_events').insert(row); if (error) return fail(error);
      toast('Evento criado.'); S.events = null; S.fresh = true; render();
    } else if (act === 'ev-end') { const { error } = await sb.from('live_events').update({ ends_at: new Date().toISOString() }).eq('id', v); if (error) return fail(error); S.events = null; render(); }
    else if (act === 'ev-del') { if (!confirm('Apagar este evento?')) return; const { error } = await sb.from('live_events').delete().eq('id', v); if (error) return fail(error); S.events = null; render(); }
    else if (act === 'nw-save') {
      const row = { title: val('nw-title'), tag: val('nw-tag') || null, body: richTo(richGet('nw-body')) + trMark(trCollect('nw', true)), pinned: checked('nw-pin'), starts_at: fromInput(val('nw-start')) || new Date().toISOString(), ends_at: fromInput(val('nw-end')) };
      if (!row.title) return toast('Dê um título à notícia.', true);
      const q = S.edit && S.edit.t === 'news' ? sb.from('news').update(row).eq('id', S.edit.row.id) : sb.from('news').insert(row);
      const { error } = await q; if (error) return fail(error);
      toast(S.edit ? 'Notícia salva.' : 'Notícia publicada.'); S.edit = null; S.news = null; S.fresh = true; delete S.rich['nw-body']; trForget('nw'); render();
    } else if (act === 'nw-edit') { S.fresh = true; S.edit = { t: 'news', row: S.news.find((n) => String(n.id) === v) }; delete S.rich['nw-body']; trForget('nw'); render(); window.scrollTo(0, 0); }
    else if (act === 'edit-cancel') { S.fresh = true; S.edit = null; delete S.rich['nw-body']; trForget('nw'); render(); }
    else if (act === 'nw-del') { if (!confirm('Apagar esta notícia?')) return; const { error } = await sb.from('news').delete().eq('id', v); if (error) return fail(error); S.news = null; render(); }
    else if (act === 'mail-to') { S.mailTo = v; render(); }
    else if (act === 'mail-find' || act === 'pl-find') {
      const email = val(act === 'mail-find' ? 'ml-email' : 'pl-email'); if (!email) return;
      const { data, error } = await sb.rpc('admin_find_user', { p_email: email }); if (error) return fail(error);
      if (act === 'mail-find') { S.mailUser = data; if (!data) toast('Nenhuma conta com esse e-mail ou código.', true); } else { S.player = data; S.plog = null; S.plogF = 'all'; }
      render();
      if (act === 'pl-find' && data) { await loadPlog(false); render(); }
    } else if (act === 'plog-f') { S.plogF = v; render(); }
    else if (act === 'plog-more') { await loadPlog(true); render(); }
    else if (act === 'pl-mail') { S.mailTo = 'one'; S.mailUser = S.player; go('mail'); }
    else if (act === 'pick-add') {
      const items = v === 'cards' ? S.cat.cards : v === 'cmds' ? S.cat.cmds : S.cat.eqs, name = val('pk-' + v).toLowerCase();
      const x = items.find((y) => y.nome.toLowerCase() === name) || items.find((y) => y.nome.toLowerCase().includes(name));
      if (!x || !name) return toast('Não encontrei esse nome.', true);
      S.picks[v].push(x.id); render();
    } else if (act === 'pick-del') { const [k, i] = v.split(':'); S.picks[k].splice(+i, 1); render(); }
    else if (act === 'mail-send') {
      const n = (id, max) => Math.max(0, Math.min(max, Math.round(+val(id) || 0)));
      const reward = {}; const g = n('ml-gold', 100000), d = n('ml-dust', 100000), p = n('ml-packs', 50);
      if (g) reward.gold = g; if (d) reward.dust = d; if (p) reward.packs = p;
      const gm = n('ml-gems', 100000), fp = n('ml-fpacks', 50), cp = n('ml-cpacks', 50), ep = n('ml-epacks', 50);
      if (gm) reward.gems = gm; if (fp) reward.fpacks = fp; if (cp) reward.cmdPacks = cp; if (ep) reward.eqPacks = ep;
      ['cards', 'cmds', 'eqs'].forEach((k) => { if (S.picks[k].length) reward[k] = S.picks[k].slice(); });
      const row = { title: val('ml-title'), body: richTo(richGet('ml-body')) + trMark(trCollect('ml', true)), reward, expires_at: fromInput(val('ml-exp')) };
      if (!row.title) return toast('Dê um título ao prêmio.', true);
      if (!Object.keys(reward).length) return toast('Escolha pelo menos um item do prêmio.', true);
      if (S.mailTo === 'one') { if (!S.mailUser) return toast('Procure o jogador pelo e-mail primeiro.', true); row.target = S.mailUser.id; }
      else row.new_players = checked('ml-new');
      if (!confirm('Enviar “' + row.title + '” (' + rewardTxt(reward) + ') para ' + (row.target ? S.mailUser.email : 'todos os jogadores') + '?')) return;
      const { error } = await sb.from('mail').insert(row); if (error) return fail(error);
      toast('Prêmio enviado.'); delete S.rich['ml-body']; trForget('ml'); S.picks = { cards: [], cmds: [], eqs: [] }; S.mail = null; S.fresh = true; render();
    } else if (act === 'mail-del') { if (!confirm('Apagar este prêmio? Quem ainda não resgatou não vai mais vê-lo.')) return; const { error } = await sb.from('mail').delete().eq('id', v); if (error) return fail(error); S.mail = null; render(); }
    else if (act === 'rel-use') {
      const r = Object.assign({}, S.cfg.release || {}, { bundle: +v, rollback: checked('rl-back') });
      if (+v && !confirm('Colocar a versão ' + v + ' no ar? Os jogadores recebem ao abrir o app.')) return;
      if (await saveCfg('release', r)) { toast(+v ? 'Versão ' + v + ' no ar.' : 'Cada APK volta a usar a própria versão.'); render(); }
    } else if (act === 'rel-unforce') {
      if (!confirm('Liberar quem está com um APK antigo? Eles voltam a jogar sem instalar o APK novo.')) return;
      const r = Object.assign({}, S.cfg.release || {}, { min_build: 0 });
      if (await saveCfg('release', r)) { toast('Liberado.'); render(); }
    } else if (act === 'rel-save') {
      // the number is the APK's build (min_build); the app's native version (min_native) stays with the APK workflow
      const cur = S.cfg.release || {}, minb = Math.max(0, Math.floor(+val('rl-min') || 0));
      if (minb > (+cur.latest_build || 0)) { toast('Não existe APK ' + minb + ': o mais novo é o ' + (cur.latest_build || '—') + '. Com esse número ninguém conseguiria jogar.', true); return; }
      const r = Object.assign({}, cur, { min_build: minb, store_url: val('rl-store'), message: val('rl-msg'), rollback: checked('rl-back'), auto_force: checked('rl-auto'), auto_ota: checked('rl-ota') });
      delete r.apk_url;   // the app only updates through the Play Store (never an APK link)
      if (minb && !r.store_url && !confirm('Sem o link da Play Store, quem estiver com a versão antiga fica travado sem saber onde atualizar. Salvar assim mesmo?')) return;
      if (await saveCfg('release', r)) { toast('Salvo.'); render(); }
    }
  } catch (err) { fail(err); }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset && el.dataset.rtcol) { const k = el.dataset.rtcol, ed = richFocus(k); if (ed) { document.execCommand('foreColor', false, el.value); richSync(k); } return; }
  if (el.dataset && el.dataset.rtsize) { const k = el.dataset.rtsize, ed = richFocus(k); if (ed && el.value) { document.execCommand('fontSize', false, el.value); richSync(k); } el.value = ''; return; }
  const act = el.dataset && el.dataset.act; if (!act) return;
  if (act === 'bot-h') { S.botH = el.value; render(); }
  else if (act === 'bal-kind') { S.balKind = S.balKind || {}; S.balKind[el.dataset.id] = el.value; balPreviewSync(); }
  else if (act === 'bot-st') { S.botSt = el.value; render(); }
  else if (act === 'card-fac') { S.cardFac = el.value; render(); }
  else if (act === 'stat') { const i = +el.dataset.i; setBal(el.dataset.id, (o) => { o.s[i] = Math.max(0, Math.min(30, Math.round(+el.value || 0))); }); render(); }
  else if (act === 'cost') { setBal(el.dataset.id, (o) => { o.cost = Math.max(0, Math.min(5, Math.round(+el.value || 0))); }); render(); }
});
// the editor's buttons keep the text selection (mousedown would take the focus away)
document.addEventListener('mousedown', (e) => { const b = e.target.closest('.rt-b'); if (b) { e.preventDefault(); richCmd(b.dataset.rk, b.dataset.rt); } });
document.addEventListener('click', (e) => {
  const im = e.target.closest('.rt-ed img'); if (!im) return;
  const w = parseFloat(im.style.width) || 100, nx = { 100: 66, 66: 50, 50: 33, 33: 100 }[Math.round(w)] || 100;
  im.style.width = nx + '%'; toast('Largura da imagem: ' + nx + '%'); richSync(im.closest('.rt-ed').dataset.rk);
});
let qT = null;
document.addEventListener('input', (e) => {
  const ed = e.target.closest && e.target.closest('.rt-ed'); if (ed) { richSync(ed.dataset.rk); return; }
  if (e.target.id === 'bal-title') { balPreviewSync(); return; }
  if (e.target.id === 'card-q') { clearTimeout(qT); const v = e.target.value; qT = setTimeout(() => { S.cardQ = v; render().then(() => { const i = document.getElementById('card-q'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }); }, 250); }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'lg-pass' || e.target.id === 'lg-email') document.querySelector('[data-act=login]').click();
  if (e.target.id === 'pl-email') document.querySelector('[data-act=pl-find]').click();
  if (e.target.id === 'ml-email') document.querySelector('[data-act=mail-find]').click();
  if (e.target.id && e.target.id.indexOf('pk-') === 0) { e.preventDefault(); document.querySelector('[data-act=pick-add][data-v=' + e.target.id.slice(3) + ']').click(); }
});
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (S.admin && t && t !== S.tab) go(t); });
boot();

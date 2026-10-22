/* Faction Duels · site de administração.
   Tudo passa pelo Supabase com a chave pública. O que só o administrador pode ver ou mudar é protegido
   no próprio banco (tabela admins + regras de acesso), não aqui: sem login de administrador, nada funciona. */
const SUPA_URL = 'https://jnvqcjfdnedxtfxjlyaq.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpudnFjamZkbmVkeHRmeGpseWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNDMzNzQsImV4cCI6MjEwNzkxOTM3NH0.2PMWb5PyR1qkXw-zhyo_CeX78hQKvAi0pmgvmv7I9xE';
const STORE = SUPA_URL + '/storage/v1/object/public/game/';
const sb = supabase.createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } });

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
const here = () => location.origin + location.pathname;

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
    else if (S.tab === 'events') { if (!S.events) await loadEvents(); m.innerHTML = eventsHTML(); }
    else if (S.tab === 'news') { if (!S.news) await loadNews(); m.innerHTML = newsHTML(); }
    else if (S.tab === 'mail') { if (!S.mail) await loadMail(); m.innerHTML = mailHTML(); }
    else if (S.tab === 'versions') { if (!S.releases) await loadReleases(); m.innerHTML = versionsHTML(); }
    else if (S.tab === 'player') m.innerHTML = playerHTML();
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
    rows = (S.sim.bots || []).map((b) => ({ id: b.id, n: b.n, w: b.w, rounds: b.rounds }));
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
    ref[h] = { avg, n: list.reduce((a, r) => a + r.n, 0), bots: rows.filter((r) => r.h === h).length, ref: S.botSrc === 'sim' ? avg : targets[h] / 100 };
  });
  rows.forEach((r) => {
    const R = ref[r.h] && ref[r.h].ref;
    r.dev = r.p != null && R != null ? r.p - R : null;
    const min = S.botSrc === 'sim' ? 50 : 30;
    if (!r.n || r.n < min) r.st = 'few';
    else if (r.dev > tol / 100 && r.dev > 2 * se(r.p, r.n)) r.st = 'strong';
    else if (r.dev < -tol / 100 && -r.dev > 2 * se(r.p, r.n)) r.st = 'weak';
    else r.st = 'ok';
  });
  return { rows, ref, targets, tol };
}
function botsHTML() {
  const { rows, ref, targets, tol } = botRows();
  const ST = { few: '<span class="pill p-muted">poucos dados</span>', strong: '<span class="pill p-bad">forte demais</span>', weak: '<span class="pill p-blue">fraco demais</span>', ok: '<span class="pill p-good">ok</span>' };
  let list = rows.filter((r) => (!S.botH || r.h === S.botH) && (!S.botSt || r.st === S.botSt));
  const so = S.botSort;
  list.sort((a, b) => (so === 'id' ? a.id - b.id : so === 'n' ? b.n - a.n : so === 'dev' ? Math.abs(b.dev || 0) - Math.abs(a.dev || 0) : (b.p == null ? -1 : b.p) - (a.p == null ? -1 : a.p)));
  const sim = S.botSrc === 'sim';
  const count = (st) => rows.filter((r) => r.st === st).length;
  const head = '<h1>Bots</h1><p class="sub">Os 200 perfis. <b>Partidas reais</b> = bots contra jogadores no modo online, comparados com a meta do nível. <b>Simulação</b> = cada bot jogou ' + (sim && S.sim.n ? S.sim.n : 'centenas de') + ' partidas contra uma IA de referência (Normal, deck aleatório de 2 facções, Comandante e equipamentos comuns), comparado com a média do próprio nível. Um bot só é marcado quando a diferença passa de ' + tol + ' pontos <i>e</i> não pode ser explicada por sorte.</p>'
    + '<div class="row" style="margin-bottom:14px"><div class="seg"><button data-act="bot-src" data-v="real" class="' + (!sim ? 'on' : '') + '">Partidas reais</button><button data-act="bot-src" data-v="sim" class="' + (sim ? 'on' : '') + '">Simulação</button></div>'
    + '<select id="bot-h" data-act="bot-h"><option value="">Todos os níveis</option>' + HS.map((h) => '<option value="' + h + '"' + (S.botH === h ? ' selected' : '') + '>' + h + ' · ' + H_NAME[h] + '</option>').join('') + '</select>'
    + '<select id="bot-st" data-act="bot-st"><option value="">Todas as situações</option><option value="strong"' + (S.botSt === 'strong' ? ' selected' : '') + '>Forte demais (' + count('strong') + ')</option><option value="weak"' + (S.botSt === 'weak' ? ' selected' : '') + '>Fraco demais (' + count('weak') + ')</option><option value="ok"' + (S.botSt === 'ok' ? ' selected' : '') + '>Ok (' + count('ok') + ')</option><option value="few"' + (S.botSt === 'few' ? ' selected' : '') + '>Poucos dados (' + count('few') + ')</option></select>'
    + (sim && S.sim.at ? '<span class="muted">Simulação de ' + dt(S.sim.at) + '</span>' : '') + '</div>';
  const tiers = '<div class="card"><h2>Por nível</h2><div class="tbl-wrap"><table><thead><tr><th>Nível</th><th class="num">Bots</th><th class="num">Partidas</th><th class="num">Vitória dos bots</th>' + (sim ? '' : '<th class="num">Meta</th>') + '<th></th></tr></thead><tbody>'
    + HS.map((h) => { const t = ref[h]; const p = t.avg != null ? Math.round(1000 * t.avg) / 10 : null; return '<tr><td>' + h + ' · ' + H_NAME[h] + '</td><td class="num">' + t.bots + '</td><td class="num">' + nf(t.n) + '</td><td class="num">' + pctTxt(p) + '</td>' + (sim ? '' : '<td class="num"><input type="number" class="stat-in" style="width:60px" id="tg-' + h + '" value="' + targets[h] + '" min="5" max="95">%</td>') + '<td>' + winBar(p, sim ? null : targets[h]) + '</td></tr>'; }).join('')
    + '</tbody></table></div>' + (sim ? '' : '<div class="row" style="margin-top:10px"><label class="f" style="flex-direction:row;align-items:center;gap:8px">Tolerância <input type="number" id="tg-tol" class="stat-in" style="width:60px" value="' + tol + '" min="3" max="40"> pontos</label><button class="btn sm" data-act="save-targets">Salvar metas</button></div>')
    + '<p class="muted" style="margin-bottom:0">Meta = quanto um bot desse nível deveria ganhar dos jogadores que enfrenta. Jogadores fracos pegam bots H1, então H1 deve perder bastante.</p></div>';
  const table = '<div class="card sec"><div class="tbl-wrap"><table><thead><tr>'
    + '<th class="sort" data-act="bot-sort" data-v="id">#</th><th>Nick</th><th>Nível</th><th>Coleção</th><th>Deck</th><th>Estilo</th>'
    + '<th class="num sort" data-act="bot-sort" data-v="n">Partidas</th><th class="num sort" data-act="bot-sort" data-v="pct">Vitória do bot</th><th></th><th class="num sort" data-act="bot-sort" data-v="dev">Diferença</th><th>Situação</th><th>No jogo</th></tr></thead><tbody>'
    + list.map((r) => { const p = r.p != null ? Math.round(1000 * r.p) / 10 : null, d = r.dev != null ? Math.round(1000 * r.dev) / 10 : null, R = ref[r.h] && ref[r.h].ref;
      return '<tr' + (r.off ? ' style="opacity:.55"' : '') + '><td class="muted">' + r.id + '</td><td>' + esc(r.nick) + '</td><td>' + r.h + '</td><td>' + r.e + '</td><td>' + r.d + '</td><td>' + esc(r.style) + '</td>'
        + '<td class="num">' + nf(r.n) + '</td><td class="num">' + pctTxt(p) + '</td><td>' + winBar(p, R != null ? Math.round(100 * R) : null) + '</td><td class="num">' + (d == null ? '—' : (d > 0 ? '+' : '') + d.toLocaleString('pt-BR') + ' pts') + '</td><td>' + ST[r.st] + '</td>'
        + '<td><button class="btn sm' + (r.off ? '' : ' danger') + '" data-act="bot-toggle" data-v="' + r.id + '">' + (r.off ? 'Religar' : 'Desligar') + '</button></td></tr>'; }).join('')
    + '</tbody></table></div><p class="muted">“Desligar” tira o perfil do sorteio do matchmaking (vale na próxima vez que o jogador abrir o jogo). Ele continua no ranking.</p></div>';
  return head + tiers + table;
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
function setBal(id, fn) {
  const c = cardBy(id); if (!c) return;
  const o = Object.assign({ s: c.s.slice(), cost: c.act ? c.act.cost : null }, S.bal[id] || {});
  if (!o.s) o.s = c.s.slice();
  fn(o);
  const sameS = o.s.every((v, i) => +v === c.s[i]), sameC = !c.act || o.cost == null || +o.cost === c.act.cost;
  if (sameS && sameC) delete S.bal[id];
  else { const out = {}; if (!sameS) out.s = o.s.map(Number); if (!sameC) out.cost = +o.cost; S.bal[id] = out; }
}

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
    + '</div><div class="row" style="margin-top:12px"><button class="btn go" data-act="ev-save">Criar evento</button></div></div>'
    + '<div class="card sec"><h2>Eventos</h2>' + ((S.events || []).length ? S.events.map((e) => '<div class="list-item"><div class="t"><b>' + esc(e.title) + ' ' + status(e) + '</b><p>' + ({ gold_mult: 'Ouro', xp_mult: 'XP' }[e.kind] || e.kind) + ' ×' + e.value + ' · ' + dt(e.starts_at) + ' até ' + dt(e.ends_at) + (e.body ? '\n' + esc(e.body) : '') + '</p></div>'
      + (Date.parse(e.ends_at) > now ? '<button class="btn sm" data-act="ev-end" data-v="' + e.id + '">Encerrar agora</button>' : '') + '<button class="btn sm danger" data-act="ev-del" data-v="' + e.id + '">Apagar</button></div>').join('') : '<p class="muted">Nenhum evento ainda.</p>') + '</div>';
}

/* ---------- NOTÍCIAS ---------- */
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
    + '<label class="f wide">Texto (linha em branco separa parágrafos)<textarea id="nw-body" maxlength="4000">' + esc(e ? e.body : '') + '</textarea></label>'
    + '</div><div class="row" style="margin-top:12px"><button class="btn go" data-act="nw-save">' + (e ? 'Salvar' : 'Publicar') + '</button>' + (e ? '<button class="btn" data-act="edit-cancel">Cancelar</button>' : '') + '</div></div>'
    + '<div class="card sec"><h2>Publicadas</h2>' + ((S.news || []).length ? S.news.map((n) => '<div class="list-item"><div class="t"><b>' + (n.pinned ? '📌 ' : '') + esc(n.title) + ' ' + status(n) + '</b><p>' + (n.tag ? esc(n.tag) + ' · ' : '') + dt(n.starts_at) + (n.ends_at ? ' até ' + dt(n.ends_at) : '') + '\n' + esc(n.body).slice(0, 300) + '</p></div><button class="btn sm" data-act="nw-edit" data-v="' + n.id + '">Editar</button><button class="btn sm danger" data-act="nw-del" data-v="' + n.id + '">Apagar</button></div>').join('') : '<p class="muted">Nenhuma notícia ainda.</p>') + '</div>';
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
      : '<div class="f wide">E-mail do jogador<div class="row"><input type="email" id="ml-email" style="flex:1" value="' + esc(u ? u.email : '') + '"><button class="btn sm" data-act="mail-find">Procurar</button></div>' + (u ? '<span class="pill p-good">' + esc(u.email) + ' · nível ' + (u.level == null ? '—' : u.level) + ' · ' + nf(u.matches) + ' partidas</span>' : '') + '</div>')
    + '<label class="f wide">Título<input type="text" id="ml-title" maxlength="80" placeholder="Compensação da manutenção"></label>'
    + '<label class="f wide">Mensagem (opcional)<textarea id="ml-body" maxlength="1000" style="min-height:70px"></textarea></label>'
    + '<label class="f">Ouro<input type="number" id="ml-gold" min="0" max="100000" value="0"></label>'
    + '<label class="f">Fragmentos<input type="number" id="ml-dust" min="0" max="100000" value="0"></label>'
    + '<label class="f">Pacotes de cartas grátis<input type="number" id="ml-packs" min="0" max="50" value="0"></label>'
    + '<label class="f">Expira em (opcional)<input type="datetime-local" id="ml-exp"></label>'
    + pickerHTML('cards', 'Cartas', S.cat.cards) + pickerHTML('cmds', 'Comandantes', S.cat.cmds.filter((c) => c.rar !== 'Comum')) + pickerHTML('eqs', 'Equipamentos', S.cat.eqs.filter((c) => c.rar !== 'Comum'))
    + '</div><p class="muted">Carta, Comandante ou equipamento que o jogador já tem vira fragmentos.</p><div class="row"><button class="btn go" data-act="mail-send">Enviar prêmio</button></div></div>'
    + '<div class="card sec"><h2>Enviados</h2>' + ((S.mail || []).length ? S.mail.map((m) => '<div class="list-item"><div class="t"><b>' + esc(m.title) + '</b><p>' + (m.target ? 'Um jogador' : 'Todos' + (m.new_players ? ' + contas novas' : '')) + ' · ' + dt(m.created_at) + (m.expires_at ? ' · expira ' + dt(m.expires_at) : '') + '\n' + esc(rewardTxt(m.reward || {})) + '</p></div><span class="pill p-gold">' + nf(S.claims[m.id] || 0) + ' resgate' + ((S.claims[m.id] || 0) === 1 ? '' : 's') + '</span><button class="btn sm danger" data-act="mail-del" data-v="' + m.id + '">Apagar</button></div>').join('') : '<p class="muted">Nenhum prêmio enviado ainda.</p>') + '</div>';
}

/* ---------- VERSÕES ---------- */
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
    + '<div class="card sec"><h2>App (APK / Play Store)</h2><p class="muted" style="margin-top:-4px">Use quando sair um APK com mudança “nativa” (ícone, permissões, plugins). O número do app é o <b>NATIVE_VERSION</b>; hoje é 1.</p><div class="form">'
    + '<label class="f">Versão mínima obrigatória<input type="number" id="rl-min" min="0" value="' + (r.min_native || 0) + '"></label>'
    + '<label class="f">Versão mais nova disponível<input type="number" id="rl-latest" min="0" value="' + (r.latest_native || 0) + '"></label>'
    + '<label class="f wide">Link da Play Store<input type="url" id="rl-store" placeholder="https://play.google.com/store/apps/details?id=br.factionduels.app" value="' + esc(r.store_url || '') + '"></label>'
    + '<label class="f wide">Link do APK (enquanto não estiver na Play Store)<input type="url" id="rl-apk" value="' + esc(r.apk_url || '') + '"></label>'
    + '<label class="f wide">Mensagem para quem precisa atualizar (opcional)<input type="text" id="rl-msg" maxlength="200" value="' + esc(r.message || '') + '"></label>'
    + '</div><p class="muted">Abaixo da mínima: o jogo trava numa tela “Atualize o jogo”. Abaixo da mais nova: só aparece um aviso no menu.</p><button class="btn go" data-act="rel-save">Salvar</button></div>';
}

/* ---------- JOGADOR ---------- */
function playerHTML() {
  const u = S.player;
  return '<h1>Jogador</h1><p class="sub">Procure uma conta pelo e-mail para ver nível, ouro e partidas (útil para suporte e compensações individuais).</p>'
    + '<div class="card"><div class="row"><input type="email" id="pl-email" placeholder="email@exemplo.com" style="flex:1;max-width:420px" value="' + esc(u && u.email || '') + '"><button class="btn go" data-act="pl-find">Procurar</button></div>'
    + (u === null ? '<p class="muted">Nenhuma conta com esse e-mail.</p>' : u ? '<div class="grid g4 sec">'
      + [['Conta criada', dt(u.created_at)], ['Último login', dt(u.last_sign_in_at)], ['Nível', u.level == null ? '—' : u.level], ['Ouro', nf(u.gold)], ['Fragmentos', nf(u.dust)], ['Pacotes grátis', nf(u.packs)], ['Partidas', nf(u.matches)], ['Vitórias', nf(u.wins) + ' (' + pctTxt(pct(u.wins, u.matches)) + ')'], ['Última partida', dt(u.last_match)]]
        .map(([k, v]) => '<div class="card kpi"><small>' + k + '</small><b style="font-size:18px">' + v + '</b></div>').join('') + '</div><div class="row sec"><button class="btn" data-act="pl-mail">Mandar prêmio para este jogador</button></div>' : '') + '</div>';
}

/* ---------- actions ---------- */
document.addEventListener('click', async (e) => {
  const tb = e.target.closest('#tabs button'); if (tb) { go(tb.dataset.tab); return; }
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, v = el.dataset.v;
  try {
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
      if (await saveCfg('balance', Object.assign({}, S.cfg.balance || {}, { cards: S.bal }))) { S.bal = JSON.parse(JSON.stringify(S.bal)); toast('Ajustes publicados. Os jogadores recebem ao abrir o jogo.'); render(); }
    } else if (act === 'bal-reset') { delete S.bal[v]; render(); }
    else if (act === 'ev-save') {
      const row = { kind: val('ev-kind'), value: +val('ev-val'), title: val('ev-title'), body: val('ev-body'), starts_at: fromInput(val('ev-start')), ends_at: fromInput(val('ev-end')) };
      if (!row.title) return toast('Dê um título ao evento.', true);
      if (!row.ends_at || Date.parse(row.ends_at) <= Date.parse(row.starts_at)) return toast('O fim precisa ser depois do começo.', true);
      if (!(row.value >= 1.1 && row.value <= 5)) return toast('Multiplicador entre 1,1 e 5.', true);
      const { error } = await sb.from('live_events').insert(row); if (error) return fail(error);
      toast('Evento criado.'); S.events = null; S.fresh = true; render();
    } else if (act === 'ev-end') { const { error } = await sb.from('live_events').update({ ends_at: new Date().toISOString() }).eq('id', v); if (error) return fail(error); S.events = null; render(); }
    else if (act === 'ev-del') { if (!confirm('Apagar este evento?')) return; const { error } = await sb.from('live_events').delete().eq('id', v); if (error) return fail(error); S.events = null; render(); }
    else if (act === 'nw-save') {
      const row = { title: val('nw-title'), tag: val('nw-tag') || null, body: (document.getElementById('nw-body') || {}).value || '', pinned: checked('nw-pin'), starts_at: fromInput(val('nw-start')) || new Date().toISOString(), ends_at: fromInput(val('nw-end')) };
      if (!row.title) return toast('Dê um título à notícia.', true);
      const q = S.edit && S.edit.t === 'news' ? sb.from('news').update(row).eq('id', S.edit.row.id) : sb.from('news').insert(row);
      const { error } = await q; if (error) return fail(error);
      toast(S.edit ? 'Notícia salva.' : 'Notícia publicada.'); S.edit = null; S.news = null; S.fresh = true; render();
    } else if (act === 'nw-edit') { S.fresh = true; S.edit = { t: 'news', row: S.news.find((n) => String(n.id) === v) }; render(); window.scrollTo(0, 0); }
    else if (act === 'edit-cancel') { S.fresh = true; S.edit = null; render(); }
    else if (act === 'nw-del') { if (!confirm('Apagar esta notícia?')) return; const { error } = await sb.from('news').delete().eq('id', v); if (error) return fail(error); S.news = null; render(); }
    else if (act === 'mail-to') { S.mailTo = v; render(); }
    else if (act === 'mail-find' || act === 'pl-find') {
      const email = val(act === 'mail-find' ? 'ml-email' : 'pl-email'); if (!email) return;
      const { data, error } = await sb.rpc('admin_find_user', { p_email: email }); if (error) return fail(error);
      if (act === 'mail-find') { S.mailUser = data; if (!data) toast('Nenhuma conta com esse e-mail.', true); } else S.player = data;
      render();
    } else if (act === 'pl-mail') { S.mailTo = 'one'; S.mailUser = S.player; go('mail'); }
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
      ['cards', 'cmds', 'eqs'].forEach((k) => { if (S.picks[k].length) reward[k] = S.picks[k].slice(); });
      const row = { title: val('ml-title'), body: (document.getElementById('ml-body') || {}).value || '', reward, expires_at: fromInput(val('ml-exp')) };
      if (!row.title) return toast('Dê um título ao prêmio.', true);
      if (!Object.keys(reward).length) return toast('Escolha pelo menos um item do prêmio.', true);
      if (S.mailTo === 'one') { if (!S.mailUser) return toast('Procure o jogador pelo e-mail primeiro.', true); row.target = S.mailUser.id; }
      else row.new_players = checked('ml-new');
      if (!confirm('Enviar “' + row.title + '” (' + rewardTxt(reward) + ') para ' + (row.target ? S.mailUser.email : 'todos os jogadores') + '?')) return;
      const { error } = await sb.from('mail').insert(row); if (error) return fail(error);
      toast('Prêmio enviado.'); S.picks = { cards: [], cmds: [], eqs: [] }; S.mail = null; S.fresh = true; render();
    } else if (act === 'mail-del') { if (!confirm('Apagar este prêmio? Quem ainda não resgatou não vai mais vê-lo.')) return; const { error } = await sb.from('mail').delete().eq('id', v); if (error) return fail(error); S.mail = null; render(); }
    else if (act === 'rel-use') {
      const r = Object.assign({}, S.cfg.release || {}, { bundle: +v, rollback: checked('rl-back') });
      if (+v && !confirm('Colocar a versão ' + v + ' no ar? Os jogadores recebem ao abrir o app.')) return;
      if (await saveCfg('release', r)) { toast(+v ? 'Versão ' + v + ' no ar.' : 'Cada APK volta a usar a própria versão.'); render(); }
    } else if (act === 'rel-save') {
      const r = Object.assign({}, S.cfg.release || {}, { min_native: Math.max(0, +val('rl-min') || 0), latest_native: Math.max(0, +val('rl-latest') || 0), store_url: val('rl-store'), apk_url: val('rl-apk'), message: val('rl-msg'), rollback: checked('rl-back') });
      if (r.min_native > 1 && !r.store_url && !r.apk_url && !confirm('Sem link, quem estiver abaixo da versão mínima fica travado sem saber onde atualizar. Salvar assim mesmo?')) return;
      if (await saveCfg('release', r)) { toast('Salvo.'); render(); }
    }
  } catch (err) { fail(err); }
});
document.addEventListener('change', (e) => {
  const el = e.target, act = el.dataset && el.dataset.act; if (!act) return;
  if (act === 'bot-h') { S.botH = el.value; render(); }
  else if (act === 'bot-st') { S.botSt = el.value; render(); }
  else if (act === 'card-fac') { S.cardFac = el.value; render(); }
  else if (act === 'stat') { const i = +el.dataset.i; setBal(el.dataset.id, (o) => { o.s[i] = Math.max(0, Math.min(30, Math.round(+el.value || 0))); }); render(); }
  else if (act === 'cost') { setBal(el.dataset.id, (o) => { o.cost = Math.max(0, Math.min(5, Math.round(+el.value || 0))); }); render(); }
});
let qT = null;
document.addEventListener('input', (e) => {
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

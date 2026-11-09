import { useCallback, useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { sb } from './supabase'

const BLN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const RL = { admin: 'Wali Kelas', bendahara: 'Bendahara', siswa: 'Siswa' }
const SL = { Lunas: 'Lunas', Sebagian: 'Bayar Sebagian', Belum: 'Belum Bayar', Libur: 'Tidak Dipungut' }
const rp = n => (n < 0 ? '-' : '') + 'Rp' + Math.abs(+n || 0).toLocaleString('id-ID')
const p2 = n => String(n).padStart(2, '0')
const fd = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
const tgl = s => { const [y, m, d] = s.split('-'); return `${+d} ${BLN[m - 1]} ${y}` }
const sum = (a, f = x => x) => a.reduce((s, x) => s + f(x), 0)

function makePeriods(freq, sy) {
  const now = new Date(), o = []
  let y = parseInt(sy) || now.getFullYear()
  if (new Date(y, 6, 1) > now) y--
  if (freq === 'Bulanan') {
    for (let s = new Date(y, 6, 1); s <= now; s = new Date(s.getFullYear(), s.getMonth() + 1, 1)) {
      const e = new Date(s.getFullYear(), s.getMonth() + 1, 0)
      o.push({ k: fd(s), end: fd(e), l: `${BLN[s.getMonth()]} ${s.getFullYear()}` })
    }
  } else {
    const d = new Date(y, 6, 1); d.setDate(d.getDate() + (8 - d.getDay()) % 7)
    for (; d <= now; d.setDate(d.getDate() + 7)) {
      const e = new Date(d); e.setDate(e.getDate() + 6)
      o.push({ k: fd(d), end: fd(e), l: 'Minggu ' + tgl(fd(d)) })
    }
  }
  return o.reverse()
}

const T = ({ h, r }) => (
  <div className="tw"><table>
    <thead><tr>{h.map((x, i) => <th key={i}>{x}</th>)}</tr></thead>
    <tbody>{r.length ? r.map((c, i) => <tr key={i}>{c.map((x, j) => <td key={j}>{x}</td>)}</tr>)
      : <tr><td colSpan={h.length} className="empty">Belum ada data.</td></tr>}</tbody>
  </table></div>
)
const Tag = ({ s }) => <span className={'tag ' + s} style={s === 'Libur' ? { background: 'var(--bd)', color: 'var(--mu)' } : undefined}>{SL[s] || s}</span>

function Modal({ title, fields, onSave, onClose }) {
  const [v, setV] = useState(() => Object.fromEntries(fields.map(f => [f.k, f.def ?? ''])))
  const [e, setE] = useState(''), [busy, setBusy] = useState(false)
  const go = async () => { setBusy(true); const m = await onSave(v); setBusy(false); m ? setE(m) : onClose() }
  return (
    <div className="ov"><div className="dlg"><h2>{title}</h2>
      {fields.map(f => (
        <div key={f.k}><label>{f.label}</label>
          {f.options
            ? <select value={v[f.k]} onChange={x => setV({ ...v, [f.k]: x.target.value })}>{f.options.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
            : <input type={f.type || 'text'} value={v[f.k]} onChange={x => setV({ ...v, [f.k]: x.target.value })} />}
        </div>))}
      <p className="out">{e}</p>
      <div className="row"><button className="b" disabled={busy} onClick={go}>Simpan</button><button className="b g" onClick={onClose}>Batal</button></div>
    </div></div>
  )
}

function Login() {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [reg, setReg] = useState(false), [msg, setMsg] = useState('')
  const go = async () => {
    setMsg('')
    const { error, data } = reg ? await sb.auth.signUp({ email, password: pw }) : await sb.auth.signInWithPassword({ email, password: pw })
    if (error) setMsg(error.message === 'Invalid login credentials' ? 'Email atau kata sandi salah.' : error.message)
    else if (reg && !data.session) setMsg('Akun dibuat. Cek email Anda untuk konfirmasi, lalu masuk.')
  }
  return (
    <div className="login"><div className="card">
      <img src="/logo.png" alt="Kasku - Kas Kelasku" />
      <h2 style={{ textAlign: 'center' }}>{reg ? 'Daftar akun' : 'Masuk'}</h2>
      <label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <label>Kata sandi (min. 6 karakter)</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} />
      <p className="out">{msg}</p>
      <button className="b" style={{ width: '100%' }} onClick={go}>{reg ? 'Daftar' : 'Masuk'}</button>
      <p className="sub" style={{ marginTop: 12, fontSize: 13 }}>{reg ? 'Wali Kelas baru: daftar lalu buat kelas Anda. Bendahara dan siswa: gunakan email yang diundang. ' : 'Belum punya akun? '}
        <a href="#" onClick={e => { e.preventDefault(); setReg(!reg); setMsg('') }}>{reg ? 'Kembali ke masuk' : 'Daftar'}</a></p>
    </div></div>
  )
}

function NewClass({ ses, onDone }) {
  const t = new Date(), y = t.getMonth() >= 6 ? t.getFullYear() : t.getFullYear() - 1
  const [v, setV] = useState({ code: '', full_name: '', class_name: '', school_year: `${y}/${y + 1}`, amount: 5000, frequency: 'Mingguan' })
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const set = k => e => setV({ ...v, [k]: e.target.value })
  const go = async () => {
    setBusy(true); setMsg('')
    const { error } = await sb.rpc('create_class', { p_code: v.code, p_full_name: v.full_name, p_class_name: v.class_name, p_school_year: v.school_year, p_amount: +v.amount || 0, p_frequency: v.frequency })
    setBusy(false); error ? setMsg(error.message) : onDone()
  }
  return (
    <div className="login"><div className="card">
      <img src="/logo.png" alt="Kasku - Kas Kelasku" />
      <h2>Buat kelas baru</h2>
      <p className="sub" style={{ fontSize: 13 }}>Email <b>{ses.user.email}</b> belum terhubung ke kelas. Wali Kelas dapat membuat kelas di sini. Bendahara atau siswa: minta Wali Kelas mengundang email ini, lalu muat ulang halaman.</p>
      <label>Kode pendaftaran Wali Kelas (dari admin sekolah)</label><input value={v.code} onChange={set('code')} />
      <label>Nama Anda</label><input value={v.full_name} onChange={set('full_name')} />
      <label>Nama kelas (mis. XI-2)</label><input value={v.class_name} onChange={set('class_name')} />
      <label>Tahun ajaran</label><input value={v.school_year} onChange={set('school_year')} />
      <label>Nominal kas (Rp)</label><input type="number" value={v.amount} onChange={set('amount')} />
      <label>Frekuensi</label><select value={v.frequency} onChange={set('frequency')}><option>Mingguan</option><option>Bulanan</option></select>
      <p className="out">{msg}</p>
      <div className="row"><button className="b" disabled={busy} onClick={go}>Buat kelas</button><button className="b g" onClick={() => sb.auth.signOut()}>Keluar</button></div>
    </div></div>
  )
}

export default function App() {
  const [ses, setSes] = useState(undefined), [me, setMe] = useState(null)
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSes(data.session))
    const { data: l } = sb.auth.onAuthStateChange((_, s) => setSes(s))
    return () => l.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!ses) { setMe(null); return }
    sb.from('profiles').select('*').eq('id', ses.user.id).maybeSingle().then(({ data }) => setMe(data || false))
  }, [ses])
  if (ses === undefined || (ses && me === null)) return <div className="empty">Memuat…</div>
  if (!ses) return <Login />
  if (me === false) return <NewClass ses={ses} onDone={() => { setMe(null); sb.from('profiles').select('*').eq('id', ses.user.id).maybeSingle().then(({ data }) => setMe(data || false)) }} />
  return <Main me={me} />
}

function Main({ me }) {
  const [tab, setTab] = useState('dash'), [D, setD] = useState(null), [per, setPer] = useState(''), [err, setErr] = useState('')
  const staff = me.role !== 'siswa', admin = me.role === 'admin'
  const load = useCallback(async () => {
    const q = t => sb.from(t).select('*')
    const r = await Promise.all([q('cash_settings').maybeSingle(), q('students').order('seq_no'), q('payments').order('paid_on', { ascending: false }),
      q('transactions').order('tx_date', { ascending: false }), q('periods'), sb.rpc('class_ledger'), q('classes').maybeSingle()])
    const bad = r.find(x => x.error); if (bad) return setErr(bad.error.message)
    setD({ set: r[0].data, students: r[1].data, pay: r[2].data, tx: r[3].data, periods: r[4].data, ledger: r[5].data, cls: r[6].data })
  }, [])
  useEffect(() => { load() }, [load])
  if (err) return <div className="empty">Gagal memuat data: {err}</div>
  if (!D) return <div className="empty">Memuat…</div>
  if (!D.set) return <div className="empty">Pengaturan kas kelas belum dibuat.</div>
  const pl = makePeriods(D.set.frequency, D.set.school_year), cur = per || pl[0].k
  const pstart = Object.fromEntries(D.periods.map(p => [p.id, p.starts_on]))
  const paid = (sid, k) => sum(D.pay.filter(p => p.student_id === sid && !p.voided_at && pstart[p.period_id] === k), p => p.amount)
  const nc = k => D.periods.some(p => p.starts_on === k && p.no_collection)
  const stat = (sid, k) => { if (nc(k)) return 'Libur'; const v = paid(sid, k); return v >= D.set.amount ? 'Lunas' : v > 0 ? 'Sebagian' : 'Belum' }
  const P = { me, D, load, pl, per: cur, setPer, paid, stat, nc, staff, admin }
  const tabs = [['dash', 'Dashboard', 1], ['siswa', 'Data Siswa', admin], ['bayar', 'Pembayaran Kas', staff], ['buku', 'Buku Kas', 1],
    ['lap', 'Laporan', staff], ['saya', 'Status Saya', !staff], ['set', 'Pengaturan', admin]].filter(t => t[2])
  const View = { dash: Dash, siswa: Siswa, bayar: Bayar, buku: Buku, lap: Lap, saya: Saya, set: Pengaturan }[tab]
  return (
    <div className="app">
      <aside><img src="/logo.png" alt="Kasku" />
        {tabs.map(t => <button key={t[0]} className={'nb ' + (tab === t[0] ? 'on' : '')} onClick={() => setTab(t[0])}>{t[1]}</button>)}
        <div className="who">{me.full_name}<br />{RL[me.role]}</div>
        <button className="nb" onClick={() => sb.auth.signOut()}>Keluar</button></aside>
      <main><View {...P} /></main>
    </div>
  )
}

function Dash({ D, staff, stat, per }) {
  const L = D.ledger, i = sum(L.filter(x => x.entry_type === 'masuk'), x => x.amount), o = sum(L.filter(x => x.entry_type === 'keluar'), x => x.amount)
  const act = D.students.filter(s => s.active), lunas = act.filter(s => stat(s.id, per) === 'Lunas').length
  const m = [...Array(6)].map((_, j) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - j)); const k = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`
    const x = L.filter(e => e.entry_date.startsWith(k)); return { l: BLN[d.getMonth()], i: sum(x.filter(e => e.entry_type === 'masuk'), e => e.amount), o: sum(x.filter(e => e.entry_type === 'keluar'), e => e.amount) }
  })
  const mx = Math.max(1, ...m.flatMap(x => [x.i, x.o]))
  return (<>
    <h1>Dashboard</h1><p className="sub">Kelas {D.cls?.name} · TA {D.set.school_year} · Kas {D.set.frequency.toLowerCase()} {rp(D.set.amount)}</p>
    <div className="grid">
      <div className="card st"><span>Saldo kas</span><b>{rp(i - o)}</b></div>
      <div className="card st"><span>Total pemasukan</span><b className="in">{rp(i)}</b></div>
      <div className="card st"><span>Total pengeluaran</span><b className="out">{rp(o)}</b></div>
      {staff && <><div className="card st"><span>Jumlah siswa</span><b>{act.length}</b></div>
        <div className="card st"><span>Sudah membayar</span><b>{lunas}</b></div>
        <div className="card st"><span>Belum membayar</span><b>{act.filter(s => !['Lunas', 'Libur'].includes(stat(s.id, per))).length}</b></div></>}
    </div>
    <div className="card"><h2>Pemasukan &amp; pengeluaran 6 bulan</h2>
      <div className="bars">{m.map(x => <div key={x.l}><i style={{ height: x.i / mx * 110, background: 'var(--ok)' }} /><i style={{ height: x.o / mx * 110, background: 'var(--no)', marginLeft: 2 }} /><br />{x.l}</div>)}</div></div>
    <div className="card"><h2>Transaksi terbaru</h2><Ledger rows={L.slice(0, 6)} /></div>
  </>)
}

const Ledger = ({ rows }) => <T h={['Tanggal', 'Keterangan', 'Kategori', 'Jenis', 'Nominal']}
  r={rows.map(x => [tgl(x.entry_date), x.description, x.category, <span className={'tag ' + x.entry_type}>{x.entry_type}</span>,
    <b className={x.entry_type === 'masuk' ? 'in' : 'out'}>{x.entry_type === 'masuk' ? '+' : '-'}{rp(x.amount)}</b>])} />

function Siswa({ me, D, load }) {
  const [q, setQ] = useState(''), [m, setM] = useState(null)
  const L = D.students.filter(s => (s.full_name + (s.nis || '')).toLowerCase().includes(q.toLowerCase()))
  const form = st => setM({
    title: st ? 'Edit Siswa' : 'Tambah Siswa',
    fields: [{ k: 'seq_no', label: 'No', type: 'number', def: st?.seq_no ?? D.students.length + 1 }, { k: 'nis', label: 'NIS', def: st?.nis ?? '' },
      { k: 'full_name', label: 'Nama lengkap', def: st?.full_name ?? '' }, { k: 'gender', label: 'Jenis kelamin', def: st?.gender ?? 'L', options: [['L', 'Laki-laki'], ['P', 'Perempuan']] },
      { k: 'active', label: 'Status', def: String(st?.active ?? true), options: [['true', 'Aktif'], ['false', 'Nonaktif']] }],
    save: async v => {
      if (!v.full_name.trim()) return 'Nama wajib diisi.'
      const o = { seq_no: +v.seq_no || null, nis: v.nis || null, full_name: v.full_name.trim(), gender: v.gender, active: v.active === 'true' }
      const r = st ? await sb.from('students').update(o).eq('id', st.id) : await sb.from('students').insert({ ...o, class_id: me.class_id })
      if (r.error) return r.error.code === '23505' ? 'NIS sudah dipakai.' : r.error.message
      await load()
    }
  })
  const del = async s => {
    if (!confirm('Hapus siswa ' + s.full_name + '?')) return
    let { error } = await sb.from('students').delete().eq('id', s.id)
    if (error && error.code === '23503') {
      if (!confirm(s.full_name + ' punya riwayat pembayaran. Hapus siswa BESERTA seluruh riwayat pembayarannya? Saldo kas akan berubah dan tindakan ini tidak dapat dibatalkan.')) return
      ;({ error } = await sb.rpc('delete_students', { p_ids: [s.id] }))
    }
    error ? alert(error.message) : load()
  }
  const delAll = async () => {
    if (!D.students.length) return alert('Belum ada siswa.')
    if (prompt(`Ini akan menghapus SEMUA ${D.students.length} siswa beserta seluruh riwayat pembayaran kas mereka, dan tidak dapat dibatalkan. Pemasukan dan pengeluaran lain di Buku Kas tidak ikut terhapus. Ketik HAPUS untuk melanjutkan.`) !== 'HAPUS') return
    const { error } = await sb.rpc('delete_students')
    error ? alert(error.message) : load()
  }
  const imp = async e => {
    const f = e.target.files[0]; if (!f) return
    const wb = XLSX.read(await f.arrayBuffer()), rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    const g = (o, ks) => { for (const k in o) if (ks.includes(k.toLowerCase().trim())) return String(o[k]).trim(); return '' }
    const list = rows.map((o, i) => ({ class_id: me.class_id, seq_no: +g(o, ['no', 'nomor']) || D.students.length + i + 1, nis: g(o, ['nis', 'nomor induk']) || null,
      full_name: g(o, ['nama', 'nama lengkap']), gender: /^(p|perempuan)/i.test(g(o, ['jk', 'jenis kelamin'])) ? 'P' : 'L', active: !/^(non|tidak)/i.test(g(o, ['status'])) })).filter(x => x.full_name)
    e.target.value = ''
    if (!list.length) return alert('Tidak ada data. Pastikan ada kolom "Nama" pada baris judul.')
    const { error } = await sb.from('students').upsert(list, { onConflict: 'class_id,nis', ignoreDuplicates: true })
    if (error) return alert(error.message)
    await load(); alert('Import selesai. Siswa dengan NIS yang sudah ada dilewati.')
  }
  return (<>
    <h1>Data Siswa</h1><p className="sub">Import Excel (.xlsx/.csv) dengan kolom: No, NIS, Nama, Jenis Kelamin (L/P), Status (Aktif/Nonaktif).</p>
    <div className="row"><input placeholder="Cari nama atau NIS…" value={q} onChange={e => setQ(e.target.value)} /><span className="sp" />
      <label className="b g" style={{ margin: 0, cursor: 'pointer' }}>Import Excel<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={imp} /></label>
      <button className="b d" onClick={delAll}>Hapus Semua</button><button className="b" onClick={() => form()}>+ Tambah Siswa</button></div>
    <div className="card"><T h={['No', 'NIS', 'Nama lengkap', 'JK', 'Status', '']} r={L.map(s => [s.seq_no, s.nis, s.full_name, s.gender, s.active ? 'Aktif' : 'Nonaktif',
      <><button className="b g s" onClick={() => form(s)}>Edit</button> <button className="b d s" onClick={() => del(s)}>Hapus</button></>])} /></div>
    {m && <Modal title={m.title} fields={m.fields} onSave={m.save} onClose={() => setM(null)} />}
  </>)
}

function Bayar({ me, D, load, pl, per, setPer, paid, stat, nc }) {
  const [m, setM] = useState(false)
  const name = id => D.students.find(s => s.id === id)?.full_name || '(dihapus)'
  const pdate = id => D.periods.find(p => p.id === id)?.starts_on
  const libur = nc(per)
  const periodId = async (pr, flag) => {
    const row = { class_id: me.class_id, label: pr.l, starts_on: pr.k, ends_on: pr.end }
    if (flag !== undefined) row.no_collection = flag
    const { error } = await sb.from('periods').upsert(row, { onConflict: 'class_id,starts_on', ignoreDuplicates: flag === undefined })
    if (error) return { error }
    return sb.from('periods').select('id').eq('class_id', me.class_id).eq('starts_on', pr.k).single()
  }
  const save = async v => {
    const pr = pl.find(p => p.k === v.period)
    if (nc(v.period)) return 'Periode ini ditandai tidak dipungut iuran. Batalkan tandanya jika ingin mencatat pembayaran.'
    if (!v.student_id || !(+v.amount > 0)) return 'Lengkapi siswa dan nominal.'
    const { data: p, error: e1 } = await periodId(pr)
    if (e1) return e1.message
    const { error } = await sb.from('payments').insert({ class_id: me.class_id, student_id: v.student_id, period_id: p.id, paid_on: v.paid_on, amount: +v.amount })
    if (error) return error.code === '23505' ? 'Pembayaran identik sudah tercatat.' : error.message
    setPer(pr.k); await load()
  }
  const vp = async p => {
    const why = prompt('Alasan pembatalan pembayaran ' + name(p.student_id) + ' ' + rp(p.amount) + '?'); if (why === null) return
    const { error } = await sb.from('payments').update({ voided_at: new Date().toISOString(), void_reason: why || 'Dibatalkan' }).eq('id', p.id)
    error ? alert(error.message) : load()
  }
  const markAll = async () => {
    const pr = pl.find(p => p.k === per)
    const todo = D.students.filter(s => s.active && D.set.amount - paid(s.id, per) > 0)
    if (!todo.length) return alert('Semua siswa aktif sudah lunas pada periode ini.')
    if (!confirm(`Tandai ${todo.length} siswa LUNAS untuk ${pr.l}?\nNominal sesuai kekurangan masing-masing dan tanggal bayar dicatat ${tgl(pr.k)}.`)) return
    const { data: p, error } = await periodId(pr)
    if (error) return alert(error.message)
    const rows = todo.map(s => ({ class_id: me.class_id, student_id: s.id, period_id: p.id, paid_on: pr.k, amount: D.set.amount - paid(s.id, per) }))
    const r = await sb.from('payments').insert(rows)
    r.error ? alert(r.error.code === '23505' ? 'Sebagian pembayaran identik sudah tercatat.' : r.error.message) : load()
  }
  const toggleLibur = async () => {
    const pr = pl.find(p => p.k === per), cp = D.periods.find(p => p.starts_on === per)
    if (!libur) {
      if (cp && D.pay.some(x => x.period_id === cp.id && !x.voided_at)) return alert('Periode ini sudah memiliki pembayaran. Batalkan pembayaran tersebut terlebih dahulu.')
      if (!confirm(`Tandai ${pr.l} sebagai periode TIDAK DIPUNGUT iuran kas? Periode ini tidak dihitung dalam sisa tunggakan.`)) return
    }
    const { error } = await periodId(pr, !libur)
    error ? alert(error.message) : load()
  }
  return (<>
    <h1>Pembayaran Kas</h1><p className="sub">Nominal kas: {rp(D.set.amount)} per {D.set.frequency === 'Bulanan' ? 'bulan' : 'minggu'}.</p>
    <div className="row"><select value={per} onChange={e => setPer(e.target.value)}>{pl.map(p => <option key={p.k} value={p.k}>{p.l}{nc(p.k) ? ' (tidak dipungut)' : ''}</option>)}</select><span className="sp" />
      <button className="b g" onClick={toggleLibur}>{libur ? 'Batalkan Tanda Tidak Dipungut' : 'Tandai Tidak Dipungut'}</button>
      <button className="b g" disabled={libur} onClick={markAll}>Tandai Semua Lunas</button>
      <button className="b" disabled={libur} onClick={() => setM(true)}>+ Catat Pembayaran</button></div>
    {libur && <div className="card" style={{ background: 'var(--wab)' }}>Periode ini ditandai <b>tidak dipungut iuran kas</b> dan tidak dihitung dalam sisa tunggakan.</div>}
    <div className="card"><h2>Status per siswa</h2><T h={['Siswa', 'Dibayar', 'Kurang', 'Status']}
      r={D.students.filter(s => s.active).map(s => [s.full_name, rp(paid(s.id, per)), libur ? '-' : rp(Math.max(0, D.set.amount - paid(s.id, per))), <Tag s={stat(s.id, per)} />])} /></div>
    <div className="card"><h2>Riwayat pembayaran</h2><T h={['Tanggal', 'Siswa', 'Periode', 'Nominal', '']}
      r={D.pay.slice(0, 50).map(p => [<span className={p.voided_at ? 'void' : ''}>{tgl(p.paid_on)}</span>, name(p.student_id), pdate(p.period_id) ? tgl(pdate(p.period_id)) : '-', rp(p.amount),
        p.voided_at ? 'Dibatalkan' : <button className="b d s" onClick={() => vp(p)}>Batalkan</button>])} /></div>
    {m && <Modal title="Catat Pembayaran" onClose={() => setM(false)} onSave={save} fields={[
      { k: 'student_id', label: 'Siswa', def: D.students.find(s => s.active)?.id ?? '', options: D.students.filter(s => s.active).map(s => [s.id, s.full_name]) },
      { k: 'paid_on', label: 'Tanggal', type: 'date', def: fd(new Date()) }, { k: 'period', label: 'Periode', def: per, options: pl.map(p => [p.k, p.l]) },
      { k: 'amount', label: 'Nominal (Rp)', type: 'number', def: D.set.amount }]} />}
  </>)
}

function Buku({ me, D, load, staff }) {
  const [f, setF] = useState('semua'), [m, setM] = useState(null)
  const add = t => setM({
    t, save: async v => {
      if (!v.description.trim() || !(+v.amount > 0)) return 'Lengkapi keterangan dan nominal.'
      const { error } = await sb.from('transactions').insert({ class_id: me.class_id, tx_date: v.tx_date, description: v.description.trim(), category: v.category, tx_type: t, amount: +v.amount })
      if (error) return error.message; await load()
    }
  })
  const cats = m?.t === 'masuk' ? ['Sumbangan', 'Dana kegiatan', 'Lainnya'] : ['Alat kebersihan', 'Fotokopi', 'Konsumsi', 'Perlengkapan kelas', 'Lainnya']
  const vt = async x => {
    const why = prompt('Alasan membatalkan "' + x.description + '"?'); if (why === null) return
    const { error } = await sb.from('transactions').update({ voided_at: new Date().toISOString(), void_reason: why || 'Dibatalkan' }).eq('id', x.id)
    error ? alert(error.message) : load()
  }
  const saldo = sum(D.ledger.filter(x => x.entry_type === 'masuk'), x => x.amount) - sum(D.ledger.filter(x => x.entry_type === 'keluar'), x => x.amount)
  return (<>
    <h1>Buku Kas</h1><p className="sub">Saldo: <b>{rp(saldo)}</b></p>
    <div className="row"><select value={f} onChange={e => setF(e.target.value)}><option>semua</option><option>masuk</option><option>keluar</option></select><span className="sp" />
      {staff && <><button className="b" onClick={() => add('masuk')}>+ Pemasukan</button><button className="b d" onClick={() => add('keluar')}>+ Pengeluaran</button></>}</div>
    <div className="card"><Ledger rows={D.ledger.filter(x => f === 'semua' || x.entry_type === f)} /></div>
    {staff && <div className="card"><h2>Transaksi non-kas</h2><T h={['Tanggal', 'Keterangan', 'Nominal', '']}
      r={D.tx.map(x => [<span className={x.voided_at ? 'void' : ''}>{tgl(x.tx_date)}</span>, x.description, rp(x.amount), x.voided_at ? 'Dibatalkan' : <button className="b d s" onClick={() => vt(x)}>Batalkan</button>])} /></div>}
    {m && <Modal title={m.t === 'masuk' ? 'Tambah Pemasukan' : 'Tambah Pengeluaran'} onSave={m.save} onClose={() => setM(null)} fields={[
      { k: 'tx_date', label: 'Tanggal', type: 'date', def: fd(new Date()) }, { k: 'description', label: 'Keterangan' },
      { k: 'category', label: 'Kategori', def: cats[0], options: cats.map(c => [c, c]) }, { k: 'amount', label: 'Nominal (Rp)', type: 'number' }]} />}
  </>)
}

function Lap({ D, pl, paid, stat, nc }) {
  const [t, setT] = useState('1'), [from, setFrom] = useState(''), [to, setTo] = useState(''), [k, setK] = useState(pl[0].k)
  const L = D.ledger.filter(x => (!from || x.entry_date >= from) && (!to || x.entry_date <= to))
  const inn = a => sum(a.filter(x => x.entry_type === 'masuk'), x => x.amount), out = a => sum(a.filter(x => x.entry_type === 'keluar'), x => x.amount)
  const titles = { 1: 'Pembayaran kas per siswa', 2: 'Siswa belum membayar', 3: 'Laporan pemasukan', 4: 'Laporan pengeluaran', 5: 'Saldo akhir', 6: 'Rekapitulasi bulanan' }
  const due = pl.filter(p => !nc(p.k)), dueKeys = new Set(due.map(p => p.k)), skipped = pl.length - due.length
  const pstart = Object.fromEntries(D.periods.map(p => [p.id, p.starts_on]))
  const arrears = s => Math.max(0, due.length * D.set.amount - sum(D.pay.filter(x => x.student_id === s.id && !x.voided_at && dueKeys.has(pstart[x.period_id])), x => x.amount))
  let d
  if (t === '1') {
    const rows = D.students.map(s => { const p = D.pay.filter(x => x.student_id === s.id && !x.voided_at && (!from || x.paid_on >= from) && (!to || x.paid_on <= to)); return { s, n: p.length, v: sum(p, x => x.amount), a: s.active ? arrears(s) : null } })
    d = { h: ['Siswa', 'Jumlah bayar', 'Total dibayar', 'Sisa tunggakan'], r: [...rows.map(x => [x.s.full_name, x.n, rp(x.v), x.a === null ? '-' : rp(x.a)]), ['TOTAL', '', rp(sum(rows, x => x.v)), rp(sum(rows, x => x.a || 0))]] }
  }
  else if (t === '2') d = { h: ['Siswa', 'Dibayar', 'Kekurangan', 'Status'], r: D.students.filter(s => s.active && !['Lunas', 'Libur'].includes(stat(s.id, k))).map(s => [s.full_name, rp(paid(s.id, k)), rp(D.set.amount - paid(s.id, k)), SL[stat(s.id, k)]]) }
  else if (t === '3' || t === '4') { const y = t === '3' ? 'masuk' : 'keluar', x = L.filter(e => e.entry_type === y); d = { h: ['Tanggal', 'Keterangan', 'Kategori', 'Nominal'], r: [...x.map(e => [tgl(e.entry_date), e.description, e.category, rp(e.amount)]), ['', '', 'TOTAL', rp(sum(x, e => e.amount))]] } }
  else if (t === '5') { const a = D.ledger.filter(x => !to || x.entry_date <= to); d = { h: ['Keterangan', 'Nominal'], r: [['Total pemasukan', rp(inn(a))], ['Total pengeluaran', rp(out(a))], ['Saldo akhir', rp(inn(a) - out(a))]] } }
  else { const ms = [...new Set(L.map(e => e.entry_date.slice(0, 7)))].sort(); d = { h: ['Bulan', 'Pemasukan', 'Pengeluaran', 'Selisih'], r: ms.map(m => { const x = L.filter(e => e.entry_date.startsWith(m)); return [BLN[+m.slice(5) - 1] + ' ' + m.slice(0, 4), rp(inn(x)), rp(out(x)), rp(inn(x) - out(x))] }) } }
  const exp = fmt => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([d.h, ...d.r]), 'Laporan'); XLSX.writeFile(wb, `laporan-kasku.${fmt}`, { bookType: fmt }) }
  return (<>
    <h1>Laporan</h1><p className="sub">Filter berdasarkan periode, lalu cetak atau ekspor.</p>
    <div className="row"><select value={t} onChange={e => setT(e.target.value)}>{Object.entries(titles).map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
      {t === '2' ? <select value={k} onChange={e => setK(e.target.value)}>{pl.map(p => <option key={p.k} value={p.k}>{p.l}</option>)}</select>
        : <><input type="date" value={from} onChange={e => setFrom(e.target.value)} /><input type="date" value={to} onChange={e => setTo(e.target.value)} /></>}
      <span className="sp" /><button className="b g" onClick={() => window.print()}>Cetak / PDF</button><button className="b g" onClick={() => exp('csv')}>CSV</button><button className="b" onClick={() => exp('xlsx')}>Excel</button></div>
    <div className="card"><h2>{titles[t]} — Kelas {D.cls?.name}, TA {D.set.school_year}</h2><T h={d.h} r={d.r} />{t === '1' && <p className="sub" style={{ fontSize: 13, marginTop: 10 }}>Sisa tunggakan dihitung dari {due.length} periode berjalan ({rp(D.set.amount)} per periode){skipped ? `, tidak termasuk ${skipped} periode yang ditandai tidak dipungut` : ''}. Siswa nonaktif tidak dihitung.</p>}</div>
  </>)
}

function Saya({ D, pl, paid, stat }) {
  const s = D.students[0]
  if (!s) return <><h1>Status Saya</h1><p className="sub">Akun ini belum terhubung ke data siswa.</p></>
  return (<>
    <h1>Status Saya</h1><p className="sub">{s.full_name} · NIS {s.nis} · Kelas {D.cls?.name}</p>
    <div className="card"><h2>Status per periode</h2><T h={['Periode', 'Dibayar', 'Status']} r={pl.map(p => [p.l, rp(paid(s.id, p.k)), <Tag s={stat(s.id, p.k)} />])} /></div>
    <div className="card"><h2>Riwayat pembayaran saya</h2><T h={['Tanggal', 'Nominal']} r={D.pay.filter(x => !x.voided_at).map(x => [tgl(x.paid_on), rp(x.amount)])} /></div>
  </>)
}

function Pengaturan({ me, D, load }) {
  const [inv, setInv] = useState([]), [pf, setPf] = useState([]), [au, setAu] = useState([]), [m, setM] = useState(null)
  const ref = useCallback(async () => {
    const [a, b, c] = await Promise.all([sb.from('invitations').select('*'), sb.from('profiles').select('*'), sb.from('audit_logs').select('*').order('id', { ascending: false }).limit(15)])
    setInv(a.data || []); setPf(b.data || []); setAu(c.data || [])
  }, [])
  useEffect(() => { ref() }, [ref])
  const s = D.set
  const editSet = () => setM({
    title: 'Pengaturan Kas', fields: [{ k: 'name', label: 'Nama kelas', def: D.cls.name }, { k: 'school_year', label: 'Tahun ajaran', def: s.school_year },
      { k: 'amount', label: 'Nominal kas (Rp)', type: 'number', def: s.amount }, { k: 'frequency', label: 'Frekuensi', def: s.frequency, options: [['Mingguan', 'Mingguan'], ['Bulanan', 'Bulanan']] },
      { k: 'pay_day', label: 'Hari pembayaran', def: s.pay_day }],
    save: async v => {
      const a = await sb.from('cash_settings').update({ amount: +v.amount || 0, frequency: v.frequency, pay_day: v.pay_day, school_year: v.school_year, updated_at: new Date().toISOString() }).eq('class_id', me.class_id)
      const b = await sb.from('classes').update({ name: v.name, school_year: v.school_year }).eq('id', me.class_id)
      if (a.error || b.error) return (a.error || b.error).message; await load()
    }
  })
  const invite = () => setM({
    title: 'Undang Pengguna', fields: [{ k: 'email', label: 'Email', type: 'email' }, { k: 'full_name', label: 'Nama' },
      { k: 'role', label: 'Peran', def: 'bendahara', options: [['bendahara', 'Bendahara'], ['admin', 'Wali Kelas'], ['siswa', 'Siswa']] },
      { k: 'student_id', label: 'Siswa (khusus peran Siswa)', def: '', options: [['', '—'], ...D.students.map(x => [x.id, x.full_name])] }],
    save: async v => {
      if (!v.email.trim() || !v.full_name.trim()) return 'Email dan nama wajib diisi.'
      if (v.role === 'siswa' && !v.student_id) return 'Pilih siswa untuk peran Siswa.'
      const { error } = await sb.from('invitations').insert({ email: v.email.trim().toLowerCase(), full_name: v.full_name.trim(), role: v.role, class_id: me.class_id, student_id: v.role === 'siswa' ? v.student_id : null })
      if (error) return error.code === '23505' ? 'Email ini sudah diundang.' : error.message; await ref()
    }
  })
  const rm = async (tbl, id, msg) => { if (confirm(msg)) { const { error } = await sb.from(tbl).delete().eq('id', id); error ? alert(error.message) : ref() } }
  return (<>
    <h1>Pengaturan</h1><p className="sub">Aturan kas, akun pengguna, dan riwayat perubahan.</p>
    <div className="card"><div className="row"><h2 className="sp">Kas kelas {D.cls.name}</h2><button className="b" onClick={editSet}>Ubah</button></div>
      <p>Tahun ajaran {s.school_year} · {rp(s.amount)} {s.frequency.toLowerCase()} · hari {s.pay_day}</p></div>
    <div className="card"><div className="row"><h2 className="sp">Pengguna</h2><button className="b" onClick={invite}>+ Undang</button></div>
      <T h={['Nama', 'Peran', 'Status', '']} r={[...pf.map(p => [p.full_name, RL[p.role], 'Aktif', p.id === me.id ? '' : <button className="b d s" onClick={() => rm('profiles', p.id, 'Cabut akses ' + p.full_name + '?')}>Cabut</button>]),
        ...inv.map(i => [i.full_name + ' (' + i.email + ')', RL[i.role], 'Diundang', <button className="b d s" onClick={() => rm('invitations', i.id, 'Batalkan undangan?')}>Batalkan</button>])]} />
      <p className="sub" style={{ fontSize: 13, marginTop: 10 }}>Pengguna yang diundang mendaftar sendiri di halaman Masuk memakai email yang sama.</p></div>
    <div className="card"><h2>Riwayat perubahan</h2><T h={['Waktu', 'Aksi', 'Tabel']} r={au.map(a => [new Date(a.created_at).toLocaleString('id-ID'), a.action, a.table_name])} /></div>
    {m && <Modal title={m.title} fields={m.fields} onSave={m.save} onClose={() => setM(null)} />}
  </>)
}

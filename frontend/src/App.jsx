import { useEffect, useState } from 'react'
import { api, session } from './api.js'
import { StudentEditor, StudentInfo, StudentDelete } from './Students.jsx'

const money = (value) => `Bs ${Number(value || 0).toFixed(2)}`

function Access({ onAccess }) {
  const [setup, setSetup] = useState(false)
  const [form, setForm] = useState({ nombre: '', email: '', password: '' })
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault(); setError('')
    try {
      if (setup) { await api('/auth/setup', { method: 'POST', body: JSON.stringify(form) }); setSetup(false); setError('Administrador creado. Ahora inicia sesión.') }
      else { const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(form) }); session.set(result.token); onAccess(result.user) }
    } catch (err) { setError(err.message) }
  }
  return <main className="access-page"><section className="brand-panel"><img className="brand-mark" src="/logo-club.png" alt="Logo del Club Squash Roldan"/><div><p className="kicker">CLUB SQUASH ROLDAN</p><h1>Cobros claros.<br/>Club ordenado.</h1><p>Mensualidades, alumnos y recibos en un solo lugar.</p></div></section><section className="access-card"><div className="form-wrap"><p className="kicker">{setup ? 'CONFIGURACIÓN INICIAL' : 'BIENVENIDO'}</p><h2>{setup ? 'Crear administrador' : 'Iniciar sesión'}</h2><form onSubmit={submit}>{setup && <label>Nombre<input required value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></label>}<label>Correo electrónico<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Contraseña<input type="password" minLength="8" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>{error && <p className="message">{error}</p>}<button className="primary">{setup ? 'Crear cuenta' : 'Ingresar'}</button></form><button className="link-button" onClick={()=>{setSetup(!setup);setError('')}}>{setup ? 'Ya tengo una cuenta' : 'Primera vez: crear administrador'}</button></div></section></main>
}

function PaymentForm({ student, onClose, onSaved }) {
  const [form,setForm]=useState({monto:'',metodo:'efectivo',referencia:''});const[done,setDone]=useState(null);const[error,setError]=useState('')
  const save=async(e)=>{e.preventDefault();try{setDone(await api('/pagos',{method:'POST',body:JSON.stringify({...form,alumno_id:student.id})}))}catch(err){setError(err.message)}}
  return <div className="modal-bg"><section className="modal compact"><div className="modal-head"><div><p className="kicker">REGISTRAR COBRO</p><h2>{student.nombres} {student.apellidos}</h2></div><button className="close" onClick={onClose}>×</button></div>{done?<div className="success"><span>✓</span><h3>Pago registrado</h3><p>Recibo <strong>{done.numero_recibo}</strong></p><p>Saldo a favor: {money(done.saldo_favor)}</p><button className="primary" onClick={onSaved}>Finalizar</button></div>:<form onSubmit={save}><div className="amount-due"><span>Deuda registrada</span><strong>{money(student.deuda)}</strong></div><label>Monto recibido<input autoFocus type="number" min="0.01" step="0.01" required value={form.monto} onChange={e=>setForm({...form,monto:e.target.value})}/></label><label>Método<select value={form.metodo} onChange={e=>setForm({...form,metodo:e.target.value})}><option value="efectivo">Efectivo</option><option value="qr">QR</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option></select></label><label>Referencia<input value={form.referencia} onChange={e=>setForm({...form,referencia:e.target.value})}/></label>{error&&<p className="message">{error}</p>}<button className="primary">Confirmar pago</button></form>}</section></div>
}

function App() {
  const [user,setUser]=useState(null),[view,setView]=useState('panel'),[stats,setStats]=useState({}),[students,setStudents]=useState([]),[programs,setPrograms]=useState([]),[debtors,setDebtors]=useState([]),[modal,setModal]=useState(null),[search,setSearch]=useState(''),[notice,setNotice]=useState('')
  const load=async()=>{try{const [d,a,p,de]=await Promise.all([api('/dashboard'),api(`/alumnos?buscar=${encodeURIComponent(search)}`),api('/programas'),api('/mensualidades/deudores')]);setStats(d.data);setStudents(a.data);setPrograms(p.data);setDebtors(de.data)}catch(err){if(/sesión/i.test(err.message)){session.clear();setUser(null)}else setNotice(err.message)}}
  useEffect(()=>{if(session.get())api('/auth/me').then(r=>setUser(r.user)).catch(()=>session.clear())},[])
  useEffect(()=>{if(user)load()},[user,search])
  const generate=async()=>{const month=new Date().toISOString().slice(0,7);try{const r=await api('/mensualidades/generar',{method:'POST',body:JSON.stringify({desde:month,hasta:month})});setNotice(`${r.creadas} mensualidades nuevas generadas`);load()}catch(err){setNotice(err.message)}}
  if(!user)return <Access onAccess={setUser}/>
  return <div className="shell"><aside><div className="logo"><img className="club-logo" src="/logo-club.png" alt="Logo del Club Squash Roldan"/><div>Club Squash Roldan<small>Sistema de cobros</small></div></div><nav>{[['panel','Resumen'],['alumnos','Alumnos'],['deudores','Deudores']].map(([id,label])=><button className={view===id?'active':''} onClick={()=>setView(id)} key={id}>{label}</button>)}</nav><div className="profile"><div className="avatar">{user.nombre[0]}</div><div><strong>{user.nombre}</strong><small>{user.rol}</small></div><button onClick={()=>{session.clear();setUser(null)}}>Salir</button></div></aside><main className="content"><header><div><p className="kicker">CLUB DE SQUASH</p><h1>{view==='panel'?'Resumen general':view==='alumnos'?'Alumnos':'Mensualidades vencidas'}</h1></div><div className="header-actions">{user.rol==='administrador'&&<button className="secondary" onClick={generate}>Generar mes actual</button>}<button className="primary" onClick={()=>setModal('student')}>+ Nuevo alumno</button></div></header>{notice&&<button className="notice" onClick={()=>setNotice('')}>{notice} ×</button>}{view==='panel'&&<><section className="stats"><article><span>Alumnos activos</span><strong>{stats.alumnos_activos||0}</strong></article><article><span>Cobrado hoy</span><strong>{money(stats.cobrado_hoy)}</strong></article><article><span>Cobrado este mes</span><strong>{money(stats.cobrado_mes)}</strong></article><article className="danger"><span>Deuda vencida</span><strong>{money(stats.deuda_vencida)}</strong></article></section><section className="panel"><div className="section-title"><div><h2>Actividad del club</h2><p>Vista rápida de los alumnos registrados</p></div><button className="link-button" onClick={()=>setView('alumnos')}>Ver todos →</button></div><StudentTable data={students.slice(0,6)} onPay={s=>setModal(s)}/></section></>}{view==='alumnos'&&<section className="panel"><div className="toolbar"><input placeholder="Buscar por nombre o código..." value={search} onChange={e=>setSearch(e.target.value)}/><span>{students.length} alumnos activos</span></div><StudentTable data={students} onPay={s=>setModal(s)} onInfo={s=>setModal({type:"info",student:s})} onEdit={s=>setModal({type:"edit",student:s})} onDelete={s=>setModal({type:"delete",student:s})}/></section>}{view==='deudores'&&<section className="panel"><StudentTable data={debtors} onPay={s=>setModal(s)} debtors/></section>}</main>{modal==='student'&&<StudentEditor programs={programs} onClose={()=>setModal(null)} onSaved={()=>{setModal(null);load()}}/>}{modal?.type==="edit"&&<StudentEditor studentId={modal.student.id} programs={programs} onClose={()=>setModal(null)} onSaved={()=>{setModal(null);setNotice("Alumno actualizado");load()}}/>}{modal?.type==="info"&&<StudentInfo studentId={modal.student.id} onClose={()=>setModal(null)}/>}{modal?.type==="delete"&&<StudentDelete student={modal.student} onClose={()=>setModal(null)} onSaved={()=>{setModal(null);setNotice("Alumno eliminado de la lista de activos");load()}}/>}{modal?.id&&<PaymentForm student={modal} onClose={()=>setModal(null)} onSaved={()=>{setModal(null);load()}}/>}</div>
}

function StudentTable({data,onPay,onInfo,onEdit,onDelete,debtors=false}) {
  const [selectedId,setSelectedId]=useState(null)
  const selectable=Boolean(onInfo || onEdit || onDelete)
  const selected=data.find(student=>student.id===selectedId)
  useEffect(()=>{if(!data.some(student=>student.id===selectedId))setSelectedId(null)},[data,selectedId])
  return <>
    {selectable&&<div className="student-action-bar"><div className="student-actions" role="group" aria-label="Acciones del alumno seleccionado">
      <button className="pay" disabled={!selected} onClick={()=>onEdit(selected)}>Editar</button>
      <button className="delete-button" disabled={!selected} onClick={()=>onDelete(selected)}>Eliminar</button>
      <button className="pay" disabled={!selected} onClick={()=>onInfo(selected)}>Info</button>
      <button className="pay" disabled={!selected} onClick={()=>onPay(selected)}>Cobrar</button>
    </div><p aria-live="polite">{selected?`Seleccionado: ${selected.nombres} ${selected.apellidos}`:'Selecciona un alumno de la tabla para usar las acciones.'}</p></div>}
    <div className="table-wrap"><table><thead><tr>{selectable&&<th aria-label="Selección"></th>}<th>Alumno</th><th>{debtors?'Contacto':'Programa'}</th><th>Estado</th><th>Saldo</th>{!selectable&&<th>Acciones</th>}</tr></thead><tbody>
      {data.map(s=><tr key={s.id} className={selectable?`selectable-row ${selectedId===s.id?'selected-row':''}`:undefined} onClick={selectable?()=>setSelectedId(s.id):undefined}>
        {selectable&&<td className="selection-cell"><input type="radio" name="selected-student" aria-label={`Seleccionar a ${s.nombres} ${s.apellidos}`} checked={selectedId===s.id} onChange={()=>setSelectedId(s.id)}/></td>}
        <td><strong>{s.nombres} {s.apellidos}</strong><small>{s.codigo}</small></td><td>{debtors?(s.tutor_telefono||s.telefono||'—'):(s.programa||'Sin programa')}</td>
        <td><span className={`pill ${Number(s.deuda)>0?'pending':'ok'}`}>{Number(s.deuda)>0?'Pendiente':s.estado||'Al día'}</span></td><td className="money">{money(s.deuda)}</td>
        {!selectable&&<td><button className="pay" onClick={()=>onPay(s)}>Cobrar</button></td>}
      </tr>)}
      {!data.length&&<tr><td colSpan="5" className="empty">No hay registros para mostrar</td></tr>}
    </tbody></table></div>
  </>
}
export default App
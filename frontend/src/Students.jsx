import { useEffect, useState } from 'react'
import { api } from './api.js'
const money = value => `Bs ${Number(value || 0).toFixed(2)}`
const dateInput = value => value ? String(value).slice(0, 10) : ''
const date = value => value ? new Date(value).toLocaleDateString('es-BO', { timeZone: 'UTC' }) : '—'
const fields = [
  ['nombres','Nombres', 'text', true], ['apellidos','Apellidos','text',true],
  ['documento','Documento'], ['fecha_nacimiento','Fecha de nacimiento','date'],
  ['fecha_ingreso','Fecha de ingreso','date',true], ['telefono','Teléfono','tel'],
  ['tutor_nombre','Nombre del tutor'], ['tutor_telefono','Teléfono del tutor','tel'],
]
const blank = { nombres:'', apellidos:'', documento:'', fecha_nacimiento:'', fecha_ingreso:new Date().toISOString().slice(0,10), telefono:'', tutor_nombre:'', tutor_telefono:'', programa_id:'', monto_primer_mes:'', motivo_primer_mes:'', observaciones:'' }
function Frame({ title, onClose, children, compact=false }) {
  return <div className="modal-bg"><section className={`modal ${compact?'compact':''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2>{title}</h2><button className="close" aria-label="Cerrar" onClick={onClose}>×</button></div>{children}</section></div>
}
export function StudentEditor({ studentId, programs, onClose, onSaved }) {
  const [form,setForm]=useState(blank), [loading,setLoading]=useState(Boolean(studentId)), [error,setError]=useState(''), [saving,setSaving]=useState(false)
  useEffect(()=>{
    if (!studentId) return
    let cancelled=false
    api(`/alumnos/${studentId}`).then(({data})=>{
      if(cancelled)return
      const values={...blank}
      for(const key of Object.keys(values)) values[key]=data.alumno[key]??''
      values.fecha_ingreso=dateInput(values.fecha_ingreso);values.fecha_nacimiento=dateInput(values.fecha_nacimiento)
      setForm(values);setLoading(false)
    }).catch(err=>{if(!cancelled){setError(err.message);setLoading(false)}})
    return ()=>{cancelled=true}
  },[studentId])
  const change = (key,value)=>setForm(current=>({...current,[key]:value}))
  const save=async event=>{
    event.preventDefault();setSaving(true);setError('')
    try {
      const body={...form,nombres:form.nombres.trim(),apellidos:form.apellidos.trim(),fecha_nacimiento:form.fecha_nacimiento||null,monto_primer_mes:form.monto_primer_mes===''?null:Number(form.monto_primer_mes)}
      await api(studentId?`/alumnos/${studentId}`:'/alumnos',{method:studentId?'PUT':'POST',body:JSON.stringify(body)})
      onSaved()
    } catch(err){setError(err.message)} finally {setSaving(false)}
  }
  return <Frame title={studentId?'Editar alumno':'Crear alumno'} onClose={onClose}>{loading?<p>Cargando alumno...</p>:<form className="form-grid" onSubmit={save}>
    {fields.map(([key,label,type='text',required=false])=><label key={key}>{label}<input type={type} required={required} maxLength={type==='text'?(key==='documento'?30:key==='tutor_nombre'?150:100):type==='tel'?30:undefined} value={form[key]} onChange={e=>change(key,e.target.value)}/></label>)}
    <label>Programa<select required value={form.programa_id} onChange={e=>change('programa_id',e.target.value)}><option value="">Seleccionar</option>{programs.filter(p=>p.activo).map(p=><option key={p.id} value={p.id}>{p.nombre} — {money(p.precio_mensual)}</option>)}</select></label>
    <label>Monto especial primer mes<input type="number" min="0" step="0.01" placeholder="Opcional" value={form.monto_primer_mes} onChange={e=>change('monto_primer_mes',e.target.value)}/></label>
    <label className="full">Motivo del monto especial<input maxLength={255} value={form.motivo_primer_mes} onChange={e=>change('motivo_primer_mes',e.target.value)}/></label>
    <label className="full">Observaciones<textarea rows={3} value={form.observaciones} onChange={e=>change('observaciones',e.target.value)}/></label>
    {studentId&&<p className="form-help full">Los cambios no modifican mensualidades ni pagos ya registrados. Si cambias de programa, la nueva inscripción comienza hoy.</p>}
    {error&&<p role="alert" className="message full">{error}</p>}
    <div className="actions full"><button type="button" className="secondary" disabled={saving} onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving?'Guardando...':'Guardar alumno'}</button></div>
  </form>}</Frame>
}
export function StudentInfo({studentId,onClose}) {
  const [data,setData]=useState(null),[error,setError]=useState('')
  useEffect(()=>{let cancelled=false;api(`/alumnos/${studentId}`).then(result=>{if(!cancelled)setData(result.data)}).catch(err=>{if(!cancelled)setError(err.message)});return()=>{cancelled=true}},[studentId])
  const student=data?.alumno
  return <Frame title="Información del alumno" onClose={onClose}>{error?<p role="alert" className="message">{error}</p>:!data?<p>Cargando información...</p>:<>
    <h3>{student.nombres} {student.apellidos}</h3>
    <dl className="student-details">{[
      ['Código',student.codigo],['Estado',student.estado],['Documento',student.documento],['Fecha de nacimiento',date(student.fecha_nacimiento)],
      ['Fecha de ingreso',date(student.fecha_ingreso)],['Teléfono',student.telefono],['Tutor',student.tutor_nombre],['Teléfono del tutor',student.tutor_telefono],
      ['Programa',student.programa],['Precio mensual',money(student.precio_mensual)],['Inicio de inscripción',date(student.inscripcion_inicio)],
      ['Monto especial primer mes',student.monto_primer_mes===null?'—':money(student.monto_primer_mes)],['Motivo del monto especial',student.motivo_primer_mes],
      ['Observaciones',student.observaciones],['Registrado el',date(student.creado_en)],['Actualizado el',date(student.actualizado_en)],
    ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'—'}</dd></div>)}</dl>
    <h3>Mensualidades</h3><div className="table-wrap"><table><thead><tr><th>Periodo</th><th>Vencimiento</th><th>Original</th><th>Descuento</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Estado</th></tr></thead><tbody>{data.mensualidades.map(f=><tr key={f.id}><td>{date(f.periodo)}</td><td>{date(f.fecha_vencimiento)}</td><td>{money(f.monto_original)}</td><td>{money(f.descuento)}</td><td>{money(f.monto_final)}</td><td>{money(f.monto_pagado)}</td><td>{money(f.saldo)}</td><td>{f.estado}{Boolean(f.vencida)&&' · Vencida'}</td></tr>)}{!data.mensualidades.length&&<tr><td colSpan={8} className="empty">Sin mensualidades registradas</td></tr>}</tbody></table></div>
    <h3 className="detail-heading">Pagos</h3><div className="table-wrap"><table><thead><tr><th>Recibo</th><th>Fecha</th><th>Monto</th><th>Método</th><th>Referencia</th><th>Estado</th></tr></thead><tbody>{data.pagos.map(p=><tr key={p.id}><td>{p.numero_recibo}</td><td>{date(p.fecha_pago)}</td><td>{money(p.monto)}</td><td>{p.metodo}</td><td>{p.referencia||'—'}</td><td>{p.estado}</td></tr>)}{!data.pagos.length&&<tr><td colSpan={6} className="empty">Sin pagos registrados</td></tr>}</tbody></table></div>
  </>}</Frame>
}
export function StudentDelete({student,onClose,onSaved}) {
  const [saving,setSaving]=useState(false),[error,setError]=useState('')
  const remove=async()=>{setSaving(true);setError('');try{await api(`/alumnos/${student.id}`,{method:'DELETE'});onSaved()}catch(err){setError(err.message)}finally{setSaving(false)}}
  return <Frame title="Eliminar alumno" compact onClose={onClose}><p>¿Eliminar a <strong>{student.nombres} {student.apellidos}</strong> de la lista de alumnos activos?</p><p>Se conservarán sus datos, mensualidades y pagos. Dejará de generar nuevas mensualidades.</p>{error&&<p role="alert" className="message">{error}</p>}<div className="actions"><button className="secondary" disabled={saving} onClick={onClose}>Cancelar</button><button className="delete-button" disabled={saving} onClick={remove}>{saving?'Eliminando...':'Eliminar alumno'}</button></div></Frame>
}

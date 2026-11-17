import { Router } from 'express'
import { pool } from '../config/db.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()
const monthStart = (value) => `${value.slice(0, 7)}-01`
const nextMonth = (date) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10) }

router.get('/deudores', async (_req, res, next) => {
  try {
    const [data] = await pool.query(`SELECT a.id,a.codigo,a.nombres,a.apellidos,a.telefono,a.tutor_telefono,
      COUNT(m.id) mensualidades_pendientes,SUM(m.monto_final-m.monto_pagado) deuda
      FROM mensualidades m JOIN alumnos a ON a.id=m.alumno_id
      WHERE m.estado NOT IN ('pagada','exonerada') AND m.fecha_vencimiento<CURDATE()
      GROUP BY a.id ORDER BY deuda DESC,a.apellidos`)
    res.json({ ok: true, data })
  } catch (error) { next(error) }
})

router.post('/generar', requireAdmin, async (req, res, next) => {
  const desde = monthStart(req.body.desde || '')
  const hasta = monthStart(req.body.hasta || req.body.desde || '')
  if (!/^\d{4}-\d{2}-01$/.test(desde) || !/^\d{4}-\d{2}-01$/.test(hasta) || desde > hasta) {
    return res.status(400).json({ ok: false, message: 'El periodo desde/hasta no es válido' })
  }
  try {
    const [enrollments] = await pool.query(`SELECT i.*,p.precio_mensual,p.dia_vencimiento
      FROM inscripciones i JOIN alumnos a ON a.id=i.alumno_id JOIN programas p ON p.id=i.programa_id
      WHERE i.activa=1 AND a.estado='activo' AND p.activo=1`)
    let created = 0
    for (let period = desde; period <= hasta; period = nextMonth(period)) {
      for (const item of enrollments) {
        const lastDay = nextMonth(period)
        if (item.fecha_inicio >= lastDay || (item.fecha_fin && item.fecha_fin < period)) continue
        const paused = await pool.execute(`SELECT 1 FROM pausas WHERE alumno_id=? AND fecha_inicio<=LAST_DAY(?)
          AND (fecha_fin IS NULL OR fecha_fin>=?) LIMIT 1`, [item.alumno_id, period, period])
        if (paused[0].length) continue
        const isFirst = item.fecha_inicio.slice(0, 7) === period.slice(0, 7)
        const amount = isFirst && item.monto_primer_mes !== null ? item.monto_primer_mes : item.precio_mensual
        const due = `${period.slice(0, 8)}${String(item.dia_vencimiento).padStart(2, '0')}`
        const [result] = await pool.execute(`INSERT IGNORE INTO mensualidades
          (alumno_id,inscripcion_id,periodo,fecha_vencimiento,monto_original,monto_final,es_adelantada)
          VALUES (?,?,?,?,?,?,?)`, [item.alumno_id, item.id, period, due, amount, amount, period > new Date().toISOString().slice(0, 7) + '-01'])
        created += result.affectedRows
      }
    }
    res.status(201).json({ ok: true, creadas: created })
  } catch (error) { next(error) }
})

router.patch('/:id/ajustar', requireAdmin, async (req, res, next) => {
  try {
    const { monto_final, motivo, exonerar = false } = req.body
    if (!motivo || (!exonerar && Number(monto_final) < 0)) return res.status(400).json({ ok: false, message: 'Monto y motivo son obligatorios' })
    const [result] = await pool.execute(`UPDATE mensualidades SET monto_final=?, descuento=GREATEST(monto_original-?,0),
      estado=?,motivo_ajuste=?,ajustado_por=? WHERE id=? AND monto_pagado=0`,
      [exonerar ? 0 : monto_final, exonerar ? 0 : monto_final, exonerar ? 'exonerada' : 'pendiente', motivo, req.user.id, req.params.id])
    if (!result.affectedRows) return res.status(409).json({ ok: false, message: 'No se puede ajustar una mensualidad con pagos' })
    res.json({ ok: true })
  } catch (error) { next(error) }
})
export default router

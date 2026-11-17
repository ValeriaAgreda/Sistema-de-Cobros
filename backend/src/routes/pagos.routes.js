import { Router } from 'express'
import { pool } from '../config/db.js'

const router = Router()
router.post('/', async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { alumno_id, monto, metodo, referencia = null, observaciones = null } = req.body
    let remaining = Number(monto)
    if (!alumno_id || remaining <= 0 || !['efectivo','qr','transferencia','otro'].includes(metodo)) {
      return res.status(400).json({ ok: false, message: 'Alumno, monto y método de pago válidos son obligatorios' })
    }
    await connection.beginTransaction()
    const [fees] = await connection.execute(`SELECT * FROM mensualidades WHERE alumno_id=?
      AND estado NOT IN ('pagada','exonerada') AND monto_pagado<monto_final ORDER BY periodo ASC FOR UPDATE`, [alumno_id])
    const [payment] = await connection.execute(`INSERT INTO pagos (alumno_id,monto,metodo,referencia,observaciones,recibido_por)
      VALUES (?,?,?,?,?,?)`, [alumno_id, remaining, metodo, referencia, observaciones, req.user.id])
    const receipt = `REC-${String(payment.insertId).padStart(8, '0')}`
    await connection.execute('UPDATE pagos SET numero_recibo=? WHERE id=?', [receipt, payment.insertId])
    const applications = []
    for (const fee of fees) {
      if (remaining <= 0) break
      const balance = Number(fee.monto_final) - Number(fee.monto_pagado)
      const applied = Math.min(remaining, balance)
      const newPaid = Number(fee.monto_pagado) + applied
      await connection.execute(`UPDATE mensualidades SET monto_pagado=?,estado=? WHERE id=?`,
        [newPaid, newPaid >= Number(fee.monto_final) ? 'pagada' : 'parcial', fee.id])
      await connection.execute('INSERT INTO pago_aplicaciones (pago_id,mensualidad_id,monto_aplicado) VALUES (?,?,?)', [payment.insertId, fee.id, applied])
      applications.push({ mensualidad_id: fee.id, periodo: fee.periodo, monto: applied })
      remaining = Math.round((remaining - applied) * 100) / 100
    }
    if (remaining > 0) await connection.execute(`INSERT INTO saldos_favor (alumno_id,pago_id,monto,tipo,descripcion)
      VALUES (?,?,?,'credito','Sobrante de pago')`, [alumno_id, payment.insertId, remaining])
    await connection.commit()
    res.status(201).json({ ok: true, id: payment.insertId, numero_recibo: receipt, aplicaciones: applications, saldo_favor: remaining })
  } catch (error) { await connection.rollback(); next(error) } finally { connection.release() }
})

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT p.*,a.codigo,CONCAT(a.nombres,' ',a.apellidos) alumno,u.nombre cajero
      FROM pagos p JOIN alumnos a ON a.id=p.alumno_id JOIN usuarios u ON u.id=p.recibido_por WHERE p.id=?`, [req.params.id])
    if (!rows[0]) return res.status(404).json({ ok: false, message: 'Pago no encontrado' })
    const [applications] = await pool.execute(`SELECT pa.monto_aplicado,m.periodo FROM pago_aplicaciones pa
      JOIN mensualidades m ON m.id=pa.mensualidad_id WHERE pa.pago_id=?`, [req.params.id])
    res.json({ ok: true, data: { ...rows[0], aplicaciones: applications } })
  } catch (error) { next(error) }
})
export default router

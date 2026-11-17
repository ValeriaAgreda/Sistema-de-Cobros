import { Router } from 'express'
import { pool } from '../config/db.js'
const router = Router()
router.get('/', async (_req, res, next) => {
  try {
    const [[data]] = await pool.query(`SELECT
      (SELECT COUNT(*) FROM alumnos WHERE estado='activo') alumnos_activos,
      (SELECT COALESCE(SUM(monto),0) FROM pagos WHERE estado='confirmado' AND DATE(fecha_pago)=CURDATE()) cobrado_hoy,
      (SELECT COALESCE(SUM(monto),0) FROM pagos WHERE estado='confirmado' AND YEAR(fecha_pago)=YEAR(CURDATE()) AND MONTH(fecha_pago)=MONTH(CURDATE())) cobrado_mes,
      (SELECT COALESCE(SUM(monto_final-monto_pagado),0) FROM mensualidades WHERE estado NOT IN ('pagada','exonerada') AND fecha_vencimiento<CURDATE()) deuda_vencida`)
    res.json({ ok: true, data })
  } catch (error) { next(error) }
})
export default router

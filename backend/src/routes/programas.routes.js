import { Router } from 'express'
import { pool } from '../config/db.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()
router.get('/', async (_req, res, next) => {
  try { const [data] = await pool.query('SELECT * FROM programas ORDER BY activo DESC, nombre'); res.json({ ok: true, data }) }
  catch (error) { next(error) }
})
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { nombre, descripcion = null, precio_mensual, dia_vencimiento = 10, fecha_inicio = null, fecha_fin = null } = req.body
    if (!nombre || Number(precio_mensual) < 0) return res.status(400).json({ ok: false, message: 'Nombre y precio válido son obligatorios' })
    const [result] = await pool.execute('INSERT INTO programas (nombre,descripcion,precio_mensual,dia_vencimiento,fecha_inicio,fecha_fin) VALUES (?,?,?,?,?,?)', [nombre, descripcion, precio_mensual, dia_vencimiento, fecha_inicio, fecha_fin])
    res.status(201).json({ ok: true, id: result.insertId })
  } catch (error) { next(error) }
})
export default router

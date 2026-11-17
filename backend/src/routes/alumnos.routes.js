import { Router } from 'express'
import { pool } from '../config/db.js'

const router = Router()
router.get('/', async (req, res, next) => {
  try {
    const search = `%${req.query.buscar || ''}%`
    const [data] = await pool.execute(`SELECT a.*, p.nombre programa, i.programa_id,
      COALESCE(SUM(CASE WHEN m.estado NOT IN ('pagada','exonerada') THEN m.monto_final-m.monto_pagado ELSE 0 END),0) deuda
      FROM alumnos a LEFT JOIN inscripciones i ON i.alumno_id=a.id AND i.activa=1
      LEFT JOIN programas p ON p.id=i.programa_id LEFT JOIN mensualidades m ON m.alumno_id=a.id
      WHERE a.estado='activo' AND (CONCAT(a.nombres,' ',a.apellidos) LIKE ? OR COALESCE(a.codigo,'') LIKE ?)
      GROUP BY a.id,p.nombre,i.programa_id ORDER BY a.apellidos,a.nombres`, [search, search])
    res.json({ ok: true, data })
  } catch (error) { next(error) }
})
router.get('/:id', async (req, res, next) => {
  try {
    const [students] = await pool.execute(`SELECT a.*,i.id inscripcion_id,i.programa_id,i.fecha_inicio inscripcion_inicio,
      i.monto_primer_mes,i.motivo_primer_mes,p.nombre programa,p.precio_mensual FROM alumnos a
      LEFT JOIN inscripciones i ON i.alumno_id=a.id AND i.activa=1 LEFT JOIN programas p ON p.id=i.programa_id WHERE a.id=?`, [req.params.id])
    if (!students[0]) return res.status(404).json({ ok: false, message: 'Alumno no encontrado' })
    const [fees] = await pool.execute(`SELECT *, GREATEST(monto_final-monto_pagado,0) saldo,
      IF(estado NOT IN ('pagada','exonerada') AND fecha_vencimiento<CURDATE(),1,0) vencida
      FROM mensualidades WHERE alumno_id=? ORDER BY periodo DESC`, [req.params.id])
    const [payments] = await pool.execute('SELECT * FROM pagos WHERE alumno_id=? ORDER BY fecha_pago DESC', [req.params.id])
    res.json({ ok: true, data: { alumno: students[0], mensualidades: fees, pagos: payments } })
  } catch (error) { next(error) }
})
router.post('/', async (req, res, next) => {
  let connection
  try {
    const { nombres, apellidos, fecha_ingreso, programa_id, monto_primer_mes = null, motivo_primer_mes = null,
      documento = null, fecha_nacimiento = null, telefono = null, tutor_nombre = null, tutor_telefono = null, observaciones = null } = req.body
    if (!nombres?.trim() || !apellidos?.trim() || !fecha_ingreso || !programa_id ||
      (monto_primer_mes !== null && (!Number.isFinite(Number(monto_primer_mes)) || Number(monto_primer_mes) < 0))) return res.status(400).json({ ok: false, message: 'Revisa los campos obligatorios y el monto del primer mes' })
    connection = await pool.getConnection()
    await connection.beginTransaction()
    const [programs] = await connection.execute('SELECT id FROM programas WHERE id=? AND activo=1', [programa_id])
    if (!programs.length) { await connection.rollback(); return res.status(400).json({ ok: false, message: 'Selecciona un programa activo' }) }
    const [result] = await connection.execute(`INSERT INTO alumnos
      (nombres,apellidos,documento,fecha_nacimiento,telefono,tutor_nombre,tutor_telefono,fecha_ingreso,observaciones)
      VALUES (?,?,?,?,?,?,?,?,?)`, [nombres.trim(), apellidos.trim(), documento, fecha_nacimiento, telefono, tutor_nombre, tutor_telefono, fecha_ingreso, observaciones])
    const code = `ALU-${String(result.insertId).padStart(5, '0')}`
    await connection.execute('UPDATE alumnos SET codigo=? WHERE id=?', [code, result.insertId])
    await connection.execute(`INSERT INTO inscripciones (alumno_id,programa_id,fecha_inicio,monto_primer_mes,motivo_primer_mes)
      VALUES (?,?,?,?,?)`, [result.insertId, programa_id, fecha_ingreso, monto_primer_mes, motivo_primer_mes])
    await connection.commit()
    res.status(201).json({ ok: true, id: result.insertId, codigo: code })
  } catch (error) { if (connection) await connection.rollback(); next(error) } finally { connection?.release() }
})
router.put('/:id', async (req, res, next) => {
  let connection
  try {
    const { nombres, apellidos, fecha_ingreso, programa_id, monto_primer_mes = null, motivo_primer_mes = null,
      documento = null, fecha_nacimiento = null, telefono = null, tutor_nombre = null, tutor_telefono = null, observaciones = null } = req.body
    if (!nombres?.trim() || !apellidos?.trim() || !fecha_ingreso || !programa_id ||
      (monto_primer_mes !== null && (!Number.isFinite(Number(monto_primer_mes)) || Number(monto_primer_mes) < 0))) {
      return res.status(400).json({ ok: false, message: 'Revisa los campos obligatorios y el monto del primer mes' })
    }
    connection = await pool.getConnection()
    await connection.beginTransaction()
    const [students] = await connection.execute("SELECT id FROM alumnos WHERE id=? AND estado='activo' FOR UPDATE", [req.params.id])
    if (!students.length) { await connection.rollback(); return res.status(404).json({ ok: false, message: 'Alumno activo no encontrado' }) }
    const [programs] = await connection.execute('SELECT id FROM programas WHERE id=? AND activo=1', [programa_id])
    if (!programs.length) { await connection.rollback(); return res.status(400).json({ ok: false, message: 'Selecciona un programa activo' }) }
    await connection.execute(`UPDATE alumnos SET nombres=?,apellidos=?,documento=?,fecha_nacimiento=?,telefono=?,
      tutor_nombre=?,tutor_telefono=?,fecha_ingreso=?,observaciones=? WHERE id=?`,
    [nombres.trim(), apellidos.trim(), documento, fecha_nacimiento, telefono, tutor_nombre, tutor_telefono, fecha_ingreso, observaciones, req.params.id])
    const [enrollments] = await connection.execute('SELECT id,programa_id FROM inscripciones WHERE alumno_id=? AND activa=1 FOR UPDATE', [req.params.id])
    if (enrollments.length === 1 && Number(enrollments[0].programa_id) === Number(programa_id)) {
      await connection.execute('UPDATE inscripciones SET monto_primer_mes=?,motivo_primer_mes=? WHERE id=?', [monto_primer_mes, motivo_primer_mes, enrollments[0].id])
    } else {
      await connection.execute('UPDATE inscripciones SET activa=0,fecha_fin=CURDATE() WHERE alumno_id=? AND activa=1', [req.params.id])
      await connection.execute(`INSERT INTO inscripciones (alumno_id,programa_id,fecha_inicio,monto_primer_mes,motivo_primer_mes)
        VALUES (?,?,CURDATE(),?,?)`, [req.params.id, programa_id, monto_primer_mes, motivo_primer_mes])
    }
    await connection.commit()
    res.json({ ok: true })
  } catch (error) { if (connection) await connection.rollback(); next(error) } finally { connection?.release() }
})
router.delete('/:id', async (req, res, next) => {
  let connection
  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()
    const [result] = await connection.execute("UPDATE alumnos SET estado='retirado' WHERE id=? AND estado='activo'", [req.params.id])
    if (!result.affectedRows) { await connection.rollback(); return res.status(404).json({ ok: false, message: 'Alumno activo no encontrado' }) }
    await connection.execute('UPDATE inscripciones SET activa=0,fecha_fin=CURDATE() WHERE alumno_id=? AND activa=1', [req.params.id])
    await connection.commit()
    res.json({ ok: true })
  } catch (error) { if (connection) await connection.rollback(); next(error) } finally { connection?.release() }
})
export default router

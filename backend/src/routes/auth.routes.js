import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../config/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.post('/setup', async (req, res, next) => {
  try {
    const [[{ total }]] = await pool.query('SELECT COUNT(*) total FROM usuarios')
    if (total) return res.status(409).json({ ok: false, message: 'El administrador inicial ya fue creado' })
    const { nombre, email, password } = req.body
    if (!nombre || !email || !password || password.length < 8) {
      return res.status(400).json({ ok: false, message: 'Nombre, email y contraseña de al menos 8 caracteres son obligatorios' })
    }
    const hash = await bcrypt.hash(password, 12)
    const [result] = await pool.execute(
      "INSERT INTO usuarios (nombre,email,password_hash,rol) VALUES (?,?,?,'administrador')",
      [nombre.trim(), email.trim().toLowerCase(), hash],
    )
    res.status(201).json({ ok: true, id: result.insertId })
  } catch (error) { next(error) }
})

router.post('/login', async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM usuarios WHERE email=? AND activo=1 LIMIT 1', [req.body.email?.trim().toLowerCase()])
    const user = rows[0]
    if (!user || !(await bcrypt.compare(req.body.password || '', user.password_hash))) {
      return res.status(401).json({ ok: false, message: 'Correo o contraseña incorrectos' })
    }
    const profile = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
    const token = jwt.sign(profile, process.env.JWT_SECRET, { expiresIn: '8h' })
    res.json({ ok: true, token, user: profile })
  } catch (error) { next(error) }
})

router.get('/me', requireAuth, (req, res) => res.json({ ok: true, user: req.user }))
export default router

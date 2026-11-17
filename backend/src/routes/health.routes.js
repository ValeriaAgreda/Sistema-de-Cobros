import { Router } from 'express'
import { pool } from '../config/db.js'

const router = Router()

router.get('/', (_request, response) => {
  response.json({ ok: true, message: 'API funcionando' })
})

router.get('/database', async (_request, response, next) => {
  try {
    await pool.query('SELECT 1')
    response.json({ ok: true, message: 'MySQL conectado' })
  } catch (error) {
    next(error)
  }
})

export default router


import cors from 'cors'
import express from 'express'
import healthRoutes from './routes/health.routes.js'
import authRoutes from './routes/auth.routes.js'
import alumnosRoutes from './routes/alumnos.routes.js'
import programasRoutes from './routes/programas.routes.js'
import mensualidadesRoutes from './routes/mensualidades.routes.js'
import pagosRoutes from './routes/pagos.routes.js'
import dashboardRoutes from './routes/dashboard.routes.js'
import { requireAuth } from './middleware/auth.js'

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/alumnos', requireAuth, alumnosRoutes)
app.use('/api/programas', requireAuth, programasRoutes)
app.use('/api/mensualidades', requireAuth, mensualidadesRoutes)
app.use('/api/pagos', requireAuth, pagosRoutes)
app.use('/api/dashboard', requireAuth, dashboardRoutes)

app.use((_request, response) => {
  response.status(404).json({ ok: false, message: 'Ruta no encontrada' })
})

app.use((error, _request, response, _next) => {
  console.error(error)
  const databaseUnavailable = ['ECONNREFUSED', 'ER_BAD_DB_ERROR', 'ER_ACCESS_DENIED_ERROR'].includes(error.code)
  response.status(databaseUnavailable ? 503 : 500).json({
    ok: false,
    message: databaseUnavailable ? 'No se pudo conectar con MySQL. Revisa backend/.env y ejecuta database/init.sql' : 'Error interno del servidor',
  })
})

export default app

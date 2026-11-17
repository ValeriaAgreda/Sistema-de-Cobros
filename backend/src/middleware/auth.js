import jwt from 'jsonwebtoken'

export function requireAuth(request, response, next) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return response.status(401).json({ ok: false, message: 'Debes iniciar sesión' })
  try {
    request.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    response.status(401).json({ ok: false, message: 'Sesión inválida o vencida' })
  }
}

export function requireAdmin(request, response, next) {
  if (request.user?.rol !== 'administrador') {
    return response.status(403).json({ ok: false, message: 'Se requiere autorización de administrador' })
  }
  next()
}

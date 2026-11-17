CREATE DATABASE IF NOT EXISTS sistema_cobros CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sistema_cobros;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
  rol ENUM('administrador','cajero') NOT NULL DEFAULT 'cajero', activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP, actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS programas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(100) NOT NULL, descripcion VARCHAR(255),
  precio_mensual DECIMAL(10,2) NOT NULL, dia_vencimiento TINYINT UNSIGNED NOT NULL DEFAULT 10,
  fecha_inicio DATE NULL, fecha_fin DATE NULL, activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_programa_precio CHECK (precio_mensual >= 0),
  CONSTRAINT chk_programa_vencimiento CHECK (dia_vencimiento BETWEEN 1 AND 28)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS alumnos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, codigo VARCHAR(20) UNIQUE,
  nombres VARCHAR(100) NOT NULL, apellidos VARCHAR(100) NOT NULL, documento VARCHAR(30),
  fecha_nacimiento DATE NULL, telefono VARCHAR(30), tutor_nombre VARCHAR(150), tutor_telefono VARCHAR(30),
  fecha_ingreso DATE NOT NULL, estado ENUM('activo','pausado','retirado','pendiente') NOT NULL DEFAULT 'activo',
  observaciones TEXT, creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_alumnos_nombre (apellidos, nombres), INDEX idx_alumnos_estado (estado)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inscripciones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, alumno_id INT UNSIGNED NOT NULL, programa_id INT UNSIGNED NOT NULL,
  fecha_inicio DATE NOT NULL, fecha_fin DATE NULL, monto_primer_mes DECIMAL(10,2) NULL,
  motivo_primer_mes VARCHAR(255), activa BOOLEAN NOT NULL DEFAULT TRUE, creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alumno_id) REFERENCES alumnos(id), FOREIGN KEY (programa_id) REFERENCES programas(id),
  INDEX idx_inscripcion_alumno (alumno_id, activa)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pausas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, alumno_id INT UNSIGNED NOT NULL,
  fecha_inicio DATE NOT NULL, fecha_fin DATE NULL, motivo VARCHAR(255) NOT NULL,
  creado_por INT UNSIGNED NOT NULL, creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alumno_id) REFERENCES alumnos(id), FOREIGN KEY (creado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS descuentos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(120) NOT NULL,
  tipo ENUM('porcentaje','monto_fijo','meses_gratis') NOT NULL, valor DECIMAL(10,2) NOT NULL,
  meses_minimos TINYINT UNSIGNED NOT NULL DEFAULT 1, fecha_inicio DATE NULL, fecha_fin DATE NULL,
  acumulable BOOLEAN NOT NULL DEFAULT FALSE, activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por INT UNSIGNED NOT NULL, creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creado_por) REFERENCES usuarios(id), CONSTRAINT chk_descuento_valor CHECK (valor >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS alumno_descuentos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, alumno_id INT UNSIGNED NOT NULL, descuento_id INT UNSIGNED NOT NULL,
  fecha_inicio DATE NOT NULL, fecha_fin DATE NULL, motivo VARCHAR(255) NOT NULL, autorizado_por INT UNSIGNED NOT NULL,
  FOREIGN KEY (alumno_id) REFERENCES alumnos(id), FOREIGN KEY (descuento_id) REFERENCES descuentos(id),
  FOREIGN KEY (autorizado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mensualidades (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, alumno_id INT UNSIGNED NOT NULL, inscripcion_id INT UNSIGNED NOT NULL,
  periodo DATE NOT NULL COMMENT 'Primer día del mes cobrado', fecha_vencimiento DATE NOT NULL,
  monto_original DECIMAL(10,2) NOT NULL, descuento DECIMAL(10,2) NOT NULL DEFAULT 0,
  monto_final DECIMAL(10,2) NOT NULL, monto_pagado DECIMAL(10,2) NOT NULL DEFAULT 0,
  estado ENUM('pendiente','parcial','pagada','exonerada') NOT NULL DEFAULT 'pendiente',
  es_adelantada BOOLEAN NOT NULL DEFAULT FALSE, motivo_ajuste VARCHAR(255), ajustado_por INT UNSIGNED NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP, actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mensualidad (inscripcion_id, periodo), FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  FOREIGN KEY (inscripcion_id) REFERENCES inscripciones(id), FOREIGN KEY (ajustado_por) REFERENCES usuarios(id),
  INDEX idx_mensualidad_deuda (estado, fecha_vencimiento),
  CONSTRAINT chk_mensualidad_montos CHECK (monto_original >= 0 AND descuento >= 0 AND monto_final >= 0 AND monto_pagado >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pagos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, numero_recibo VARCHAR(20) UNIQUE,
  alumno_id INT UNSIGNED NOT NULL, monto DECIMAL(10,2) NOT NULL,
  metodo ENUM('efectivo','qr','transferencia','otro') NOT NULL, referencia VARCHAR(100), observaciones VARCHAR(255),
  estado ENUM('confirmado','anulado') NOT NULL DEFAULT 'confirmado', recibido_por INT UNSIGNED NOT NULL,
  fecha_pago DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, anulado_por INT UNSIGNED NULL,
  motivo_anulacion VARCHAR(255), anulado_en DATETIME NULL,
  FOREIGN KEY (alumno_id) REFERENCES alumnos(id), FOREIGN KEY (recibido_por) REFERENCES usuarios(id),
  FOREIGN KEY (anulado_por) REFERENCES usuarios(id), INDEX idx_pago_fecha (fecha_pago),
  CONSTRAINT chk_pago_monto CHECK (monto > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pago_aplicaciones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, pago_id BIGINT UNSIGNED NOT NULL,
  mensualidad_id INT UNSIGNED NOT NULL, monto_aplicado DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (pago_id) REFERENCES pagos(id), FOREIGN KEY (mensualidad_id) REFERENCES mensualidades(id),
  UNIQUE KEY uq_pago_mensualidad (pago_id, mensualidad_id), CONSTRAINT chk_aplicacion_monto CHECK (monto_aplicado > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS saldos_favor (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, alumno_id INT UNSIGNED NOT NULL, pago_id BIGINT UNSIGNED NULL,
  monto DECIMAL(10,2) NOT NULL, tipo ENUM('credito','aplicacion','devolucion') NOT NULL,
  descripcion VARCHAR(255), creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alumno_id) REFERENCES alumnos(id), FOREIGN KEY (pago_id) REFERENCES pagos(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auditoria (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, usuario_id INT UNSIGNED NULL,
  accion VARCHAR(80) NOT NULL, entidad VARCHAR(80) NOT NULL, entidad_id VARCHAR(40), detalle JSON NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  INDEX idx_auditoria_entidad (entidad, entidad_id)
) ENGINE=InnoDB;

INSERT INTO programas (nombre, descripcion, precio_mensual, dia_vencimiento)
SELECT 'Regular', 'Programa mensual regular del club', 140.00, 10
WHERE NOT EXISTS (SELECT 1 FROM programas WHERE nombre = 'Regular');

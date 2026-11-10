import session from 'express-session';
import { config } from '../config.js';
import { NOMBRE_COOKIE_SESION } from '../utils/sesion.js';

const DURACION_SESION_MS = 7 * 24 * 60 * 60 * 1000;

export function createSessionMiddleware({
  secret = config.sessionSecret,
  secure = config.esProduccion,
} = {}) {
  return session({
    name: NOMBRE_COOKIE_SESION,
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: DURACION_SESION_MS,
    },
  });
}

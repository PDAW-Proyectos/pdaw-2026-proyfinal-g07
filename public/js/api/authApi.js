import { solicitar } from './apiCliente.js';

/**
 * Consulta si hay una sesión activa: { autenticado, usuario }.
 */
export function obtenerSesion() {
  return solicitar('/auth/sesion');
}

/**
 * Inicia sesión con { identificador, contrasena }. Devuelve { usuario }.
 */
export function iniciarSesion(credenciales) {
  return solicitar('/auth/login', { metodo: 'POST', cuerpo: credenciales });
}

/**
 * Crea la cuenta e inicia sesión. Recibe { nombre, nombreUsuario, email, contrasena }.
 */
export function registrarUsuario(datos) {
  return solicitar('/auth/registro', { metodo: 'POST', cuerpo: datos });
}

/**
 * Cierra la sesión actual.
 */
export function cerrarSesion() {
  return solicitar('/auth/logout', { metodo: 'POST' });
}

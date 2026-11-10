/**
 * Error de dominio para invariantes y validaciones.
 * No conoce HTTP: la capa de presentación lo traduce al código de estado correspondiente.
 */
export class ErrorDominio extends Error {
  /**
   * Crea el error con un código estable y detalles opcionales para el cliente.
   */
  constructor(codigo, mensaje, detalles = {}) {
    super(mensaje);
    this.name = 'ErrorDominio';
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

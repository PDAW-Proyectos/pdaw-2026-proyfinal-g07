const PAGINA_RESULTADOS = 'index.html';
const LONGITUD_MAXIMA = 100;

/**
 * Buscador de películas del encabezado. Está en todas las páginas: valida el
 * texto y lleva a index.html?q=..., donde se muestran los resultados.
 */
class BuscadorNav {
  #formulario;
  #campo;

  /**
   * Recibe el formulario del buscador (el que contiene el campo `q`).
   */
  constructor(formulario) {
    this.#formulario = formulario;
    this.#campo = formulario.elements.namedItem('q');
  }

  /**
   * Conecta los eventos y, si la URL trae una búsqueda, la deja escrita en el campo.
   */
  iniciar() {
    const consulta = new URLSearchParams(window.location.search).get('q');

    if (consulta) {
      this.#campo.value = consulta;
    }

    this.#campo.addEventListener('input', () => this.#campo.setCustomValidity(''));
    this.#formulario.addEventListener('submit', (evento) => this.#buscar(evento));
  }

  /**
   * Normaliza el texto: recorta los bordes y reduce los espacios repetidos.
   */
  #leerTexto() {
    return this.#campo.value.trim().replace(/\s+/g, ' ');
  }

  /**
   * Devuelve el motivo por el que el texto no es válido, o una cadena vacía si lo es.
   */
  #validar(texto) {
    if (texto === '') {
      return 'Escribí el título de una película para buscar.';
    }

    if (texto.length > LONGITUD_MAXIMA) {
      return `La búsqueda admite hasta ${LONGITUD_MAXIMA} caracteres.`;
    }

    return '';
  }

  #buscar(evento) {
    evento.preventDefault();

    const texto = this.#leerTexto();
    const motivo = this.#validar(texto);

    if (motivo) {
      this.#campo.setCustomValidity(motivo);
      this.#campo.reportValidity();
      return;
    }

    const destino = new URL(PAGINA_RESULTADOS, window.location.href);

    destino.searchParams.set('q', texto);
    window.location.assign(destino);
  }
}

// Comportamiento común a todas las páginas: el buscador del encabezado.
const formularioBusqueda = document.getElementById('form-busqueda');

if (formularioBusqueda) {
  new BuscadorNav(formularioBusqueda).iniciar();
}

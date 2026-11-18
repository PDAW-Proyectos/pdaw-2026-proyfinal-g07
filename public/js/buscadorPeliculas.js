import { buscarPeliculas } from './peliculasApi.js';
import { mensajeDeError, mostrarPoster } from './utilidades.js';

const LIMITE_RESULTADOS = 20;
const LONGITUD_MINIMA = 2;
const RETARDO_BUSQUEDA = 300;

let contadorInstancias = 0;

export class BuscadorPeliculas {
  #elementos;
  #modal;
  #opciones;
  #seleccionadas;
  #resultados = [];
  #solicitudActual = 0;
  #pagina = 1;
  #temporizador = null;

  constructor(opciones = {}) {
    this.#opciones = {
      titulo: 'Buscar películas',
      descripcion: 'Escribí un título para buscar.',
      maxSeleccion: Number.POSITIVE_INFINITY,
      seleccionadas: [],
      cerrarAlSeleccionar: false,
      textoSeleccionar: 'Elegir',
      textoQuitar: 'Quitar',
      etiquetaContador: 'elegidas',
      onSeleccionar: () => {},
      onQuitar: null,
      ...opciones,
    };
    this.#seleccionadas = new Set(this.#opciones.seleccionadas);
    this.#elementos = this.#crearElementos();
    this.#modal = window.bootstrap?.Modal?.getOrCreateInstance(this.#elementos.modal) ?? null;
    this.#conectarEventos();
    this.#actualizarContador();
  }

  abrir() {
    this.#limpiar();
    this.#elementos.input.value = '';
    this.#mostrarEstado(this.#opciones.descripcion);
    this.#actualizarContador();
    this.#modal?.show();
  }

  cerrar() {
    this.#modal?.hide();
  }

  establecerSeleccionadas(ids) {
    this.#seleccionadas = new Set(ids);
    this.#actualizarContador();

    for (const boton of this.#elementos.resultados.querySelectorAll('[data-pelicula-id]')) {
      this.#actualizarBotonResultado(boton, boton.dataset.peliculaId);
    }
  }

  #crearElementos() {
    const id = `buscador-peliculas-${++contadorInstancias}`;
    const modal = document.createElement('div');

    modal.className = 'modal fade';
    modal.id = id;
    modal.tabIndex = -1;
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content bg-dark-custom text-white border border-dark-subtle rounded-4">
          <div class="modal-header border-bottom border-dark-subtle">
            <div>
              <h2 class="modal-title h5 fw-bold mb-1" data-titulo></h2>
              <p class="text-secondary fs-7 mb-0" data-descripcion></p>
            </div>
            <button
              type="button"
              class="btn-close btn-close-white"
              data-bs-dismiss="modal"
              aria-label="Cerrar"
            ></button>
          </div>
          <div class="modal-body p-4">
            <form class="mb-3" role="search" data-form>
              <div class="input-group">
                <span class="input-group-text bg-dark text-secondary border-secondary">
                  <i class="bi bi-search"></i>
                </span>
                <input
                  type="search"
                  class="form-control bg-dark text-white border-secondary"
                  placeholder="Buscar por título..."
                  aria-label="Buscar película"
                  maxlength="100"
                  autocomplete="off"
                  data-busqueda
                />
              </div>
            </form>
            <div class="alert alert-danger py-2 fs-7 d-none" role="alert" data-error></div>
            <div class="d-flex justify-content-between align-items-center mb-2">
              <p class="text-secondary fs-7 mb-0" data-estado></p>
              <span class="badge bg-success bg-opacity-25 text-success" data-contador></span>
            </div>
            <div class="list-group list-group-flush" data-resultados></div>
            <div class="text-center mt-3">
              <button
                type="button"
                class="btn btn-sm btn-outline-light rounded-pill px-3 d-none"
                data-mas
              >
                Ver más resultados
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.append(modal);

    const elementos = {
      modal,
      titulo: modal.querySelector('[data-titulo]'),
      descripcion: modal.querySelector('[data-descripcion]'),
      form: modal.querySelector('[data-form]'),
      input: modal.querySelector('[data-busqueda]'),
      error: modal.querySelector('[data-error]'),
      estado: modal.querySelector('[data-estado]'),
      contador: modal.querySelector('[data-contador]'),
      resultados: modal.querySelector('[data-resultados]'),
      mas: modal.querySelector('[data-mas]'),
    };

    elementos.titulo.textContent = this.#opciones.titulo;
    elementos.descripcion.textContent = this.#opciones.descripcion;

    return elementos;
  }

  #conectarEventos() {
    this.#elementos.form.addEventListener('submit', (evento) => {
      evento.preventDefault();
      this.#buscar({ reiniciar: true });
    });

    this.#elementos.input.addEventListener('input', () => {
      const consulta = this.#elementos.input.value.trim();

      clearTimeout(this.#temporizador);

      if (consulta.length < LONGITUD_MINIMA) {
        this.#limpiar();
        this.#mostrarEstado(`Escribí al menos ${LONGITUD_MINIMA} caracteres para buscar.`);
        return;
      }

      this.#temporizador = setTimeout(() => this.#buscar({ reiniciar: true }), RETARDO_BUSQUEDA);
    });

    this.#elementos.mas.addEventListener('click', () => this.#buscar({ reiniciar: false }));

    this.#elementos.modal.addEventListener('shown.bs.modal', () => {
      this.#elementos.input.focus();
    });

    this.#elementos.modal.addEventListener('hidden.bs.modal', () => {
      clearTimeout(this.#temporizador);
      this.#solicitudActual += 1;
    });
  }

  async #buscar({ reiniciar }) {
    const consulta = this.#elementos.input.value.trim();

    if (consulta.length < LONGITUD_MINIMA) {
      return;
    }

    const solicitud = ++this.#solicitudActual;
    const pagina = reiniciar ? 1 : this.#pagina + 1;

    this.#prepararBusqueda(reiniciar);

    try {
      const resultado = await buscarPeliculas({ q: consulta, page: pagina });

      if (solicitud === this.#solicitudActual) {
        this.#aplicarResultados(resultado, reiniciar);
      }
    } catch (error) {
      if (solicitud === this.#solicitudActual) {
        this.#mostrarEstado('');
        this.#mostrarError(mensajeDeError(error));
      }
    } finally {
      this.#elementos.mas.disabled = false;
    }
  }

  #prepararBusqueda(reiniciar) {
    this.#ocultarError();
    this.#elementos.mas.disabled = true;

    if (reiniciar) {
      this.#resultados = [];
      this.#pagina = 1;
      this.#elementos.resultados.replaceChildren();
      this.#mostrarEstado('Buscando películas...');
    }
  }

  #aplicarResultados({ data, page, total }, reiniciar) {
    this.#pagina = page;
    this.#resultados = reiniciar ? data : [...this.#resultados, ...data];

    if (reiniciar) {
      this.#elementos.resultados.replaceChildren();
    }

    this.#elementos.resultados.append(...data.map((pelicula) => this.#crearResultado(pelicula)));
    this.#elementos.mas.classList.toggle(
      'd-none',
      this.#resultados.length === 0 || page * LIMITE_RESULTADOS >= total,
    );

    if (this.#resultados.length === 0) {
      this.#mostrarEstado('No encontramos películas con ese título.');
    } else {
      this.#ocultarEstado();
    }
  }

  #crearResultado(pelicula) {
    const resultado = document.createElement('div');
    const meta = [pelicula.anioEstreno, ...pelicula.generos.slice(0, 2)].join(' · ');

    resultado.className = 'list-group-item bg-transparent text-white border-secondary px-0 py-2';
    resultado.innerHTML = `
      <div class="d-flex align-items-center gap-3">
        <div class="buscador-poster flex-shrink-0 rounded overflow-hidden">
          <img src="" alt="" class="d-none" loading="lazy" />
          <span class="buscador-poster-marcador d-flex align-items-center justify-content-center h-100 text-secondary">
            <i class="bi bi-film"></i>
          </span>
        </div>
        <div class="buscador-info flex-grow-1">
          <p class="mb-0 fw-semibold text-truncate" data-titulo-pelicula></p>
          <p class="mb-0 text-secondary fs-7 text-truncate" data-meta-pelicula></p>
        </div>
        <button type="button" class="btn btn-sm rounded-pill px-3 flex-shrink-0"></button>
      </div>
    `;

    resultado.querySelector('[data-titulo-pelicula]').textContent = pelicula.titulo;
    resultado.querySelector('[data-meta-pelicula]').textContent = meta;

    mostrarPoster(
      {
        imagen: resultado.querySelector('img'),
        marcador: resultado.querySelector('.buscador-poster-marcador'),
      },
      pelicula.rutaPoster,
      pelicula.titulo,
      'w92',
    );

    const boton = resultado.querySelector('button');

    boton.dataset.peliculaId = pelicula.id;
    boton.addEventListener('click', () => this.#accion(pelicula, boton));
    this.#actualizarBotonResultado(boton, pelicula.id);

    return resultado;
  }

  async #accion(pelicula, boton) {
    const seleccionada = this.#seleccionadas.has(pelicula.id);

    boton.disabled = true;
    this.#ocultarError();

    try {
      if (seleccionada) {
        await this.#opciones.onQuitar?.(pelicula);
        this.#seleccionadas.delete(pelicula.id);
      } else {
        await this.#opciones.onSeleccionar(pelicula);
        this.#seleccionadas.add(pelicula.id);

        if (this.#opciones.cerrarAlSeleccionar) {
          this.cerrar();
          return;
        }
      }
    } catch (error) {
      boton.disabled = false;
      this.#mostrarError(mensajeDeError(error));
      return;
    }

    this.#actualizarContador();
    this.#actualizarBotonResultado(boton, pelicula.id);
  }

  #actualizarBotonResultado(boton, peliculaId) {
    const seleccionada = this.#seleccionadas.has(peliculaId);
    const maximoAlcanzado =
      !seleccionada && this.#seleccionadas.size >= this.#opciones.maxSeleccion;

    boton.classList.remove(
      'btn-outline-success',
      'btn-outline-danger',
      'btn-outline-secondary',
      'btn-success',
    );
    boton.disabled = maximoAlcanzado;

    if (seleccionada && this.#opciones.onQuitar) {
      boton.classList.add('btn-outline-danger');
      boton.textContent = this.#opciones.textoQuitar;
      return;
    }

    if (seleccionada) {
      boton.classList.add('btn-success');
      boton.textContent = 'Agregada';
      boton.disabled = true;
      return;
    }

    if (maximoAlcanzado) {
      boton.classList.add('btn-outline-secondary');
      boton.textContent = `Máximo ${this.#opciones.maxSeleccion}`;
      return;
    }

    boton.classList.add('btn-outline-success');
    boton.textContent = this.#opciones.textoSeleccionar;
  }

  #actualizarContador() {
    const maximo = this.#opciones.maxSeleccion;
    const cantidad = this.#seleccionadas.size;

    this.#elementos.contador.textContent = Number.isFinite(maximo)
      ? `${cantidad} de ${maximo} ${this.#opciones.etiquetaContador}`
      : `${cantidad} ${this.#opciones.etiquetaContador}`;
  }

  #limpiar() {
    this.#solicitudActual += 1;
    this.#resultados = [];
    this.#pagina = 1;
    this.#elementos.resultados.replaceChildren();
    this.#elementos.mas.classList.add('d-none');
    this.#ocultarError();
  }

  #mostrarEstado(texto) {
    this.#elementos.estado.textContent = texto;
    this.#elementos.estado.classList.remove('d-none');
  }

  #ocultarEstado() {
    this.#elementos.estado.textContent = '';
    this.#elementos.estado.classList.add('d-none');
  }

  #mostrarError(texto) {
    this.#elementos.error.textContent = texto;
    this.#elementos.error.classList.remove('d-none');
  }

  #ocultarError() {
    this.#elementos.error.textContent = '';
    this.#elementos.error.classList.add('d-none');
  }
}

import {
  actualizarOpciones,
  compararPuntuacion,
  compararTitulo,
  cumpleFiltroPuntuacion,
  filtrarPorAnio,
  filtrarPorGenero,
} from './filtrosPeliculas.js';
import { BuscadorPeliculas } from './buscadorPeliculas.js';
import { PUNTUACION_MAXIMA } from './constantes.js';
import { fechaDeHoy, mensajeDeError, mostrarPoster } from './utilidades.js';
import { crearVisualizacion, listarVisualizaciones } from './api/visualizacionesApi.js';

const TAMANO_PAGINA = 50;

class PaginaVistas {
  #elementos;
  #buscador = null;
  #vistas = [];
  #generos = new Set();
  #anios = new Set();

  constructor({ elementos }) {
    this.#elementos = elementos;
  }

  async iniciar() {
    this.#elementos.btnAgregar.addEventListener('click', () => this.#abrirBuscador());
    this.#conectarFiltros();
    await this.#cargar();
  }

  #abrirBuscador() {
    if (!this.#buscador) {
      this.#buscador = new BuscadorPeliculas({
        titulo: 'Agregar película vista',
        descripcion: 'Buscá una película y marcala como vista.',
        maxSeleccion: 1,
        textoSeleccionar: 'Agregar',
        etiquetaContador: 'agregadas',
        cerrarAlSeleccionar: true,
        onSeleccionar: (pelicula) => this.#agregar(pelicula),
      });
    }

    this.#buscador.establecerSeleccionadas([]);
    this.#buscador.abrir();
  }

  async #agregar(pelicula) {
    this.#ocultarAviso();

    await crearVisualizacion({ peliculaId: pelicula.id, fecha: fechaDeHoy() });
    await this.#cargar();
    this.#mostrarAviso(`Agregaste "${pelicula.titulo}" a películas vistas.`);
  }

  #conectarFiltros() {
    const { filtroGenero, filtroPuntuacion, filtroAnio, orden, btnLimpiarFiltros } =
      this.#elementos;

    for (const select of [filtroGenero, filtroPuntuacion, filtroAnio, orden]) {
      select.addEventListener('change', () => this.#renderizar());
    }

    btnLimpiarFiltros.addEventListener('click', () => {
      filtroGenero.value = '';
      filtroPuntuacion.value = '';
      filtroAnio.value = '';
      orden.value = 'fecha_desc';
      this.#renderizar();
    });
  }

  async #cargar() {
    const { contenedor } = this.#elementos;

    contenedor.replaceChildren(this.#crearMensaje('Cargando películas vistas...'));

    try {
      const datos = await this.#cargarTodas();
      const unicas = new Map();

      for (const vista of datos) {
        if (!unicas.has(vista.pelicula.id)) {
          unicas.set(vista.pelicula.id, vista);
        }
      }

      this.#vistas = [...unicas.values()];
      this.#recolectarOpciones();
      this.#elementos.filtros.classList.toggle('d-none', this.#vistas.length === 0);
      this.#renderizar();
    } catch (error) {
      contenedor.replaceChildren(this.#crearMensaje(mensajeDeError(error)));
    }
  }

  async #cargarTodas() {
    const datos = [];
    let pagina = 1;
    let total = 0;

    do {
      const respuesta = await listarVisualizaciones({ page: pagina, limit: TAMANO_PAGINA });

      datos.push(...respuesta.data);
      total = respuesta.total;

      if (respuesta.data.length === 0) {
        break;
      }

      pagina += 1;
    } while (datos.length < total);

    return datos;
  }

  #recolectarOpciones() {
    this.#generos.clear();
    this.#anios.clear();

    for (const { pelicula } of this.#vistas) {
      for (const genero of pelicula.generos ?? []) {
        this.#generos.add(genero);
      }

      if (Number.isInteger(pelicula.anioEstreno)) {
        this.#anios.add(pelicula.anioEstreno);
      }
    }

    actualizarOpciones(
      this.#elementos.filtroGenero,
      [...this.#generos].sort(compararTitulo),
      'Todos los géneros',
    );
    actualizarOpciones(
      this.#elementos.filtroAnio,
      [...this.#anios].sort((a, b) => b - a),
      'Todos los años',
    );
  }

  #filtrar() {
    const { filtroGenero, filtroPuntuacion, filtroAnio } = this.#elementos;
    const genero = filtroGenero.value;
    const puntuacion = filtroPuntuacion.value;
    const anio = filtroAnio.value;
    const filtradas = this.#vistas.filter(
      ({ pelicula, puntuacion: nota }) =>
        filtrarPorGenero(pelicula, genero) &&
        filtrarPorAnio(pelicula, anio) &&
        cumpleFiltroPuntuacion(nota, puntuacion),
    );

    return this.#ordenar(filtradas);
  }

  #ordenar(vistas) {
    const orden = this.#elementos.orden.value;
    const porTitulo = (a, b) => compararTitulo(a.pelicula.titulo, b.pelicula.titulo);

    if (orden === 'puntuacion_desc' || orden === 'puntuacion_asc') {
      return vistas.sort(
        (a, b) =>
          compararPuntuacion(a.puntuacion, b.puntuacion, orden === 'puntuacion_desc') ||
          porTitulo(a, b),
      );
    }

    if (orden === 'anio_desc') {
      return vistas.sort(
        (a, b) => b.pelicula.anioEstreno - a.pelicula.anioEstreno || porTitulo(a, b),
      );
    }

    if (orden === 'anio_asc') {
      return vistas.sort(
        (a, b) => a.pelicula.anioEstreno - b.pelicula.anioEstreno || porTitulo(a, b),
      );
    }

    if (orden === 'titulo_asc') {
      return vistas.sort(porTitulo);
    }

    if (orden === 'fecha_asc') {
      return vistas.sort((a, b) => a.fecha.localeCompare(b.fecha) || porTitulo(a, b));
    }

    return vistas.sort((a, b) => b.fecha.localeCompare(a.fecha) || porTitulo(a, b));
  }

  #renderizar() {
    const { contenedor, estado } = this.#elementos;

    if (this.#vistas.length === 0) {
      estado.textContent = '';
      contenedor.replaceChildren(
        this.#crearMensaje(
          'Todavía no marcaste películas como vistas. Buscá una película y registrala.',
        ),
      );
      return;
    }

    const visibles = this.#filtrar();

    estado.textContent = `${visibles.length} de ${this.#vistas.length} ${
      this.#vistas.length === 1 ? 'película' : 'películas'
    }`;

    if (visibles.length === 0) {
      contenedor.replaceChildren(
        this.#crearMensaje('No hay películas que coincidan con los filtros.'),
      );
      return;
    }

    contenedor.replaceChildren(...visibles.map((vista) => this.#crearTarjeta(vista)));
  }

  #crearTarjeta({ pelicula, fecha, puntuacion }) {
    const tarjeta = this.#elementos.plantilla.content.cloneNode(true);
    const destino = new URL('pelicula.html', window.location.href);
    const enlace = tarjeta.querySelector('a');
    const generos = pelicula.generos ?? [];
    const resumenGeneros = generos.slice(0, 2).join(', ');
    const extra = generos.length > 2 ? ` +${generos.length - 2}` : '';
    const tienePuntuacion = Number.isInteger(puntuacion) && puntuacion > 0;
    const rating = tarjeta.querySelector('.vista-rating');

    destino.searchParams.set('id', pelicula.id);
    enlace.href = destino;
    enlace.title = `Vista el ${fecha}`;

    tarjeta.querySelector('.vista-title').textContent = pelicula.titulo;
    tarjeta.querySelector('.vista-meta').textContent = resumenGeneros
      ? `${pelicula.anioEstreno} · ${resumenGeneros}${extra}`
      : String(pelicula.anioEstreno);
    rating.textContent = tienePuntuacion
      ? `Tu puntuación: ${'★'.repeat(puntuacion)}${'☆'.repeat(PUNTUACION_MAXIMA - puntuacion)}`
      : 'Sin puntuación';
    rating.classList.add(tienePuntuacion ? 'text-warning' : 'text-secondary');

    mostrarPoster(
      {
        imagen: tarjeta.querySelector('.vista-poster'),
        marcador: tarjeta.querySelector('.poster-placeholder'),
      },
      pelicula.rutaPoster,
      pelicula.titulo,
    );

    return tarjeta;
  }

  #crearMensaje(texto) {
    const mensaje = document.createElement('div');

    mensaje.className = 'text-secondary py-4 text-center w-100';
    mensaje.setAttribute('role', 'status');
    mensaje.textContent = texto;

    return mensaje;
  }

  #mostrarAviso(texto) {
    this.#elementos.aviso.textContent = texto;
    this.#elementos.aviso.classList.remove('d-none');
  }

  #ocultarAviso() {
    this.#elementos.aviso.classList.add('d-none');
  }
}

const pagina = new PaginaVistas({
  elementos: {
    contenedor: document.getElementById('vistas-container'),
    plantilla: document.getElementById('tpl-vista-card'),
    btnAgregar: document.getElementById('btn-add-vista'),
    aviso: document.getElementById('vistas-aviso'),
    filtros: document.getElementById('vistas-filtros'),
    filtroGenero: document.getElementById('filtro-genero'),
    filtroPuntuacion: document.getElementById('filtro-puntuacion'),
    filtroAnio: document.getElementById('filtro-anio'),
    orden: document.getElementById('orden-vistas'),
    btnLimpiarFiltros: document.getElementById('btn-limpiar-filtros'),
    estado: document.getElementById('vistas-estado'),
  },
});

await pagina.iniciar();

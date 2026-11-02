import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { ErrorDominio } from "../utils/ErrorDominio.js";

const COLECCIONES = ["usuarios", "peliculas", "visualizaciones", "resenas"];

/**
 * Crea un snapshot válido con todas las colecciones.
 */
function crearSnapshot(datos = {}) {
  const snapshot = {};

  for (const coleccion of COLECCIONES) {
    const valor = datos[coleccion];

    if (valor === undefined) {
      snapshot[coleccion] = [];
      continue;
    }

    if (!Array.isArray(valor)) {
      throw new ErrorDominio(
        "PERSISTENCIA_INVALIDA",
        `La colección ${coleccion} debe ser un arreglo.`,
        { coleccion }
      );
    }

    snapshot[coleccion] = structuredClone(valor);
  }

  return snapshot;
}

/**
 * Almacén de datos en memoria con persistencia opcional en un archivo JSON.
 * Serializa las mutaciones para evitar lecturas y escrituras concurrentes inconsistentes.
 */
export class JsonStore {
  #archivo;
  #datos;
  #cola = Promise.resolve();

  /**
   * Inicializa el store con un archivo opcional y datos iniciales.
   */
  constructor({ archivo = null, datosIniciales = {} } = {}) {
    this.#archivo = archivo;
    this.#datos = crearSnapshot(datosIniciales);
  }

  /**
   * Carga el snapshot desde el archivo; si no existe, conserva los datos actuales.
   */
  async cargar() {
    if (!this.#archivo) {
      return this;
    }

    try {
      const contenido = await readFile(this.#archivo, "utf8");
      this.#datos = crearSnapshot(JSON.parse(contenido));
    } catch (error) {
      if (error.code === "ENOENT") {
        return this;
      }

      if (error instanceof ErrorDominio) {
        throw error;
      }

      throw new ErrorDominio(
        "PERSISTENCIA_INVALIDA",
        `No se pudo leer el archivo de datos: ${error.message}`,
        { archivo: this.#archivo }
      );
    }

    return this;
  }

  /**
   * Devuelve una copia de una colección para que el llamador no mute el estado interno.
   */
  leer(nombre) {
    this.#validarColeccion(nombre);
    return structuredClone(this.#datos[nombre]);
  }

  /**
   * Ejecuta una mutación sobre una colección de forma serializada y persiste el resultado.
   */
  async actualizar(nombre, mutador) {
    this.#validarColeccion(nombre);

    const tarea = this.#cola.then(async () => {
      const anteriores = this.#datos[nombre];
      const registros = structuredClone(anteriores);
      const resultado = await mutador(registros);

      this.#datos[nombre] = registros;

      try {
        await this.#persistir();
      } catch (error) {
        this.#datos[nombre] = anteriores;
        throw error;
      }

      return resultado;
    });

    this.#cola = tarea.catch(() => {});
    return tarea;
  }

  /**
   * Reemplaza una colección completa y persiste el resultado.
   */
  async guardar(nombre, registros) {
    if (!Array.isArray(registros)) {
      throw new ErrorDominio(
        "PERSISTENCIA_INVALIDA",
        "La colección a guardar debe ser un arreglo.",
        { coleccion: nombre }
      );
    }

    return this.actualizar(nombre, (actuales) => {
      const copia = structuredClone(registros);
      actuales.splice(0, actuales.length, ...copia);
      return actuales;
    });
  }

  /**
   * Valida que el nombre de la colección exista en el snapshot.
   */
  #validarColeccion(nombre) {
    if (!COLECCIONES.includes(nombre)) {
      throw new ErrorDominio(
        "COLECCION_INVALIDA",
        `La colección ${nombre} no existe.`,
        { coleccion: nombre }
      );
    }
  }

  /**
   * Escribe el snapshot completo en disco usando un archivo temporal y un rename atómico.
   */
  async #persistir() {
    if (!this.#archivo) {
      return;
    }

    await mkdir(dirname(this.#archivo), { recursive: true });

    const temporal = `${this.#archivo}.${randomUUID()}.tmp`;
    const contenido = JSON.stringify(this.#datos, null, 2);

    await writeFile(temporal, contenido, "utf8");

    try {
      await rename(temporal, this.#archivo);
    } catch (error) {
      await rm(temporal, { force: true });
      throw error;
    }
  }
}

/**
 * Store en memoria pensado para pruebas y para inyectar dependencias sin tocar disco.
 */
export class MemoryStore extends JsonStore {
  /**
   * Crea un store sin archivo de persistencia.
   */
  constructor({ datosIniciales = {} } = {}) {
    super({ datosIniciales });
  }
}

import { describe, expect, test } from "@jest/globals";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonStore } from "../../src/repositories/JsonStore.js";
import { ErrorDominio } from "../../src/utils/ErrorDominio.js";

async function crearArchivoTemporal() {
  const directorio = await mkdtemp(join(tmpdir(), "fotograma-store-"));

  return {
    archivo: join(directorio, "datos.json"),
    limpiar: () => rm(directorio, { recursive: true, force: true }),
  };
}

describe("JsonStore", () => {
  test("persiste los cambios y los recarga desde el archivo", async () => {
    const recurso = await crearArchivoTemporal();

    try {
      const store = new JsonStore({ archivo: recurso.archivo });
      await store.cargar();

      await store.actualizar("usuarios", (registros) => {
        registros.push({ id: "u1" });
      });
      await store.actualizar("usuarios", (registros) => {
        registros.push({ id: "u2" });
      });

      const recargado = new JsonStore({ archivo: recurso.archivo });
      await recargado.cargar();

      expect(recargado.leer("usuarios")).toEqual([
        { id: "u1" },
        { id: "u2" },
      ]);
    } finally {
      await recurso.limpiar();
    }
  });

  test("serializa mutaciones concurrentes sin perder cambios", async () => {
    const recurso = await crearArchivoTemporal();

    try {
      const store = new JsonStore({ archivo: recurso.archivo });
      await store.cargar();

      await Promise.all([
        store.actualizar("usuarios", (registros) => {
          registros.push({ id: "u1" });
        }),
        store.actualizar("usuarios", (registros) => {
          registros.push({ id: "u2" });
        }),
      ]);

      const recargado = new JsonStore({ archivo: recurso.archivo });
      await recargado.cargar();

      expect(recargado.leer("usuarios").map((usuario) => usuario.id)).toEqual([
        "u1",
        "u2",
      ]);
    } finally {
      await recurso.limpiar();
    }
  });

  test("rechaza colecciones que no existen", async () => {
    const store = new JsonStore();

    expect(() => store.leer("desconocida")).toThrow(ErrorDominio);
    await expect(
      store.actualizar("desconocida", () => {})
    ).rejects.toMatchObject({ codigo: "COLECCION_INVALIDA" });
  });

  test("rechaza un archivo con JSON inválido", async () => {
    const recurso = await crearArchivoTemporal();

    try {
      await writeFile(recurso.archivo, "{ esto no es json", "utf8");

      const store = new JsonStore({ archivo: recurso.archivo });

      await expect(store.cargar()).rejects.toMatchObject({
        codigo: "PERSISTENCIA_INVALIDA",
      });
    } finally {
      await recurso.limpiar();
    }
  });
});

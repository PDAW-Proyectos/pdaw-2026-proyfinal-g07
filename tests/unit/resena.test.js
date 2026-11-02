import { describe, expect, test } from "@jest/globals";
import { Resena } from "../../src/models/Resena.js";
import { ErrorDominio } from "../../src/utils/ErrorDominio.js";

const fechaPublicacion = new Date("2026-10-30T12:00:00.000Z");
const datosBase = {
  id: "r1",
  usuarioId: "u1",
  peliculaId: "p1",
  comentario: "  Una película que invita a pensar.  ",
  fechaPublicacion,
};

describe("Resena", () => {
  test("recorta el comentario", () => {
    const resena = new Resena(datosBase);

    expect(resena.comentario).toBe("Una película que invita a pensar.");
  });

  test("rechaza comentarios vacíos o con solo espacios", () => {
    expect(
      () => new Resena({ ...datosBase, comentario: "   " })
    ).toThrow(ErrorDominio);
  });

  test("editar cambia el comentario y conserva la fecha de publicación", () => {
    const resena = new Resena(datosBase);

    resena.editar("  Cambio de opinión.  ");

    expect(resena.comentario).toBe("Cambio de opinión.");
    expect(resena.fechaPublicacion.toISOString()).toBe(
      fechaPublicacion.toISOString()
    );
  });

  test("toJSON y fromJSON conservan los datos y la fecha", () => {
    const resena = new Resena(datosBase);
    const reconstruida = Resena.fromJSON(resena.toJSON());

    expect(reconstruida.toJSON()).toEqual(resena.toJSON());
    expect(reconstruida.fechaPublicacion.toISOString()).toBe(
      fechaPublicacion.toISOString()
    );
  });
});

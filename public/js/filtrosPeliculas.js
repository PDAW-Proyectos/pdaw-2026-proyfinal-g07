export function actualizarOpciones(select, valores, etiquetaPredeterminada) {
  if (!select) {
    return;
  }

  const seleccionado = select.value;
  const unicos = [...new Set(valores.map(String))];
  const opciones = [new Option(etiquetaPredeterminada, '')];

  for (const valor of unicos) {
    opciones.push(new Option(valor, valor));
  }

  select.replaceChildren(...opciones);
  select.value = unicos.includes(seleccionado) ? seleccionado : '';
}

export function filtrarPorGenero(pelicula, genero) {
  return !genero || (Array.isArray(pelicula.generos) && pelicula.generos.includes(genero));
}

export function filtrarPorAnio(pelicula, anio) {
  return !anio || String(pelicula.anioEstreno) === String(anio);
}

export function cumpleFiltroPuntuacion(puntuacion, filtro) {
  if (!filtro) {
    return true;
  }

  if (filtro === 'sin') {
    return puntuacion === null || puntuacion === undefined;
  }

  return (
    typeof puntuacion === 'number' && Number.isFinite(puntuacion) && puntuacion >= Number(filtro)
  );
}

export function compararPuntuacion(a, b, descendente = true) {
  const aValida = typeof a === 'number' && Number.isFinite(a);
  const bValida = typeof b === 'number' && Number.isFinite(b);

  if (!aValida && !bValida) {
    return 0;
  }

  if (!aValida) {
    return 1;
  }

  if (!bValida) {
    return -1;
  }

  return descendente ? b - a : a - b;
}

export function compararTitulo(a, b) {
  return a.localeCompare(b, 'es', { sensitivity: 'base' });
}

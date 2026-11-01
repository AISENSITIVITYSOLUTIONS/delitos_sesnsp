import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TODOS, aniosCompletos, alturas, anualNacional, cambioPct, delitosEstatales, matrizMensual, posiciones, serieEntidad, valoresEstatales,
} from '../src/iso/datos.ts';

const leer = n => JSON.parse(readFileSync(new URL('../public/datos/' + n, import.meta.url)));
const estatal = leer('estatal_anual.json'), pob = leer('poblacion.json'), sn = leer('nacional_mensual_nm.json');

test('isométrico: solo años completos (el corte parcial no se compara)', () => {
  const a = aniosCompletos(estatal);
  assert.ok(a.length > 0);
  for (const anio of a) assert.equal(estatal.meses_publicados[String(anio)], 12);
  assert.ok(!a.includes(2026));
});

test('isométrico: la tasa estatal es cantidad / población del mismo año × 100 mil', () => {
  const anio = aniosCompletos(estatal).at(-1);
  const conteo = valoresEstatales(estatal, pob, TODOS, anio, 'conteo');
  const tasas = valoresEstatales(estatal, pob, TODOS, anio, 'tasa');
  assert.equal(Object.keys(conteo).length, 32);
  for (const cve of Object.keys(conteo)) {
    const p = pob.estatal[cve][String(anio)];
    assert.ok(Math.abs(tasas[cve] - conteo[cve] / p * 100000) < 1e-9, cve);
  }
});

test('isométrico: posiciones 1..n sin empates ni huecos', () => {
  const v = valoresEstatales(estatal, pob, 'violencia-familiar', 2025, 'tasa');
  const r = posiciones(v);
  const n = Object.values(v).filter(x => x != null).length;
  assert.deepEqual(Object.values(r).sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i + 1));
  const mayor = Object.entries(r).find(([, k]) => k === 1)[0];
  assert.equal(v[mayor], Math.max(...Object.values(v).filter(x => x != null)));
});

test('isométrico: la matriz mensual suma lo mismo que la serie anual nacional', () => {
  for (const id of [TODOS, 'violencia-familiar', 'homicidio-doloso']) {
    const { anios, filas } = matrizMensual(sn, id);
    assert.equal(filas.length, anios.length);
    filas.forEach(f => assert.equal(f.length, 12));
    const anual = anualNacional(sn, id);
    anual.forEach((a, i) => {
      if (a.v == null) return;
      assert.equal(a.v, filas[i].reduce((s, x) => s + x, 0));
    });
  }
});

test('isométrico: alturas proporcionales; sin dato y cero quedan al mínimo', () => {
  const h = alturas({ a: 100, b: 50, c: 0, d: null }, 20);
  assert.equal(h.a, 20);
  assert.equal(h.b, 10);
  assert.equal(h.c, 0.12);
  assert.equal(h.d, 0.12);
});

test('isométrico: serie de entidad y cambio porcentual coherentes', () => {
  const ids = delitosEstatales(estatal);
  assert.ok(ids.includes('violencia-familiar'));
  const s = serieEntidad(estatal, pob, '09', TODOS, 'conteo');
  assert.equal(s.length, aniosCompletos(estatal).length);
  const c = cambioPct(s);
  assert.ok(Math.abs(c - (s.at(-1).v - s[0].v) / s[0].v * 100) < 1e-9);
});

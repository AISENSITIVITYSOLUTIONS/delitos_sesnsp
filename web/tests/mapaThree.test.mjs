import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { marcoDe, mercX, mercY } from '../src/lib/geo.ts';
const leer = nombre => JSON.parse(readFileSync(new URL('../public/datos/geo/' + nombre, import.meta.url))).territorios;
for (const archivo of ['estados.json', 'municipios_09.json', 'municipios_20.json']) {
  test(`Three.js: cartografía ${archivo} triangula sin coordenadas inválidas`, () => {
    const ts = leer(archivo), m = marcoDe(ts);
    const escala = 120 / Math.max(m.maxX - m.minX, m.maxY - m.minY);
    const cx = (m.minX + m.maxX) / 2, cy = (m.minY + m.maxY) / 2;
    assert.ok(ts.length > 0);
    for (const t of ts) for (const ring of t.pols) {
      if (ring.length < 3) continue;
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(ring.map(([lon, lat]) => new THREE.Vector2((mercX(lon) - cx) * escala, (mercY(lat) - cy) * escala))), { depth: 1, bevelEnabled: false, steps: 1 });
      g.rotateX(-Math.PI / 2); g.computeBoundingBox();
      assert.ok(g.attributes.position.count > 0, t.cve);
      assert.ok(g.attributes.position.array.every(Number.isFinite), t.cve);
      assert.ok(Math.abs(g.boundingBox.min.y) < 1e-6, t.cve);
      assert.ok(Math.abs(g.boundingBox.max.y - 1) < 1e-6, t.cve);
      g.dispose();
    }
  });
}

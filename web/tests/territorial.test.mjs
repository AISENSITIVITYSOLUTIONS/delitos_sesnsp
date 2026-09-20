import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { descomponer } from '../src/lib/territorial.ts';
const leer=p=>JSON.parse(readFileSync(new URL('../public/datos/'+p,import.meta.url)));
const e=leer('estatal_anual.json'),sn=leer('nacional_mensual_nm.json');
for(const id of ['robo-de-vehiculo-automotor','robo-a-negocio','robo-a-casa-habitacion','robo-a-transeunte-en-via-publica']){
 test(`${id}: 32 contribuciones concilian con ambos totales nacionales`,()=>{
  const r=descomponer(e,sn,id,2024,2025);assert.ok(r);
  assert.equal(r.filas.reduce((s,x)=>s+x.diferencia,0),r.diferencia);
 });
}
test('rechaza periodo parcial, categoría ausente o entidad incompleta',()=>{
 assert.equal(descomponer(e,sn,'robo-a-negocio',2025,2026),null);
 assert.equal(descomponer(e,sn,'homicidio-doloso',2024,2025),null);
 const corrupto=structuredClone(e);corrupto.datos['01']['robo-a-negocio'][10]=null;
 assert.equal(descomponer(corrupto,sn,'robo-a-negocio',2024,2025),null);
});

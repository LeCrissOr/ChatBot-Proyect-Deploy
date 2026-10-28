const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Load the real service with transport/config doubles: no network, database or patient data.
function service(response, enabled = true) {
  const calls = [];
  const config = {
    HOSVITAL_ENABLED: enabled,
    HOSVITAL_SOAP_ENABLED: true, // A stale deployment flag must never restore SOAP.
    HUN_ENDPOINT_ASIGNAR_CITA: '/webServiceCita/api/asignar_cita',
    HUN_ENDPOINT_CANCELAR_CITA: '/webServiceCancelarCitaH/cancelar_cita',
    HOSVITAL_MAEDIR_USER: 'test', HOSVITAL_MAEDIR_PASSWORD: 'test',
  };
  const deps = {
    axios: { create: () => ({ post: async (url, payload) => {
      calls.push({ url, payload });
      if (response instanceof Error) throw response;
      return { status: 200, data: response };
    } }) },
    '../config': { CONFIG: config },
    './hunIntegracion.service': {},
    './hosvitalSoap.service': {
      HosvitalSoapService: {
        cancelarCita: async (p) => {
          calls.push({ soap: true, payload: p });
          return { success: true, codigo: 0, respuesta: 'Cancelación exitosa' };
        },
      },
    },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/hunApi.service.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports, require: name => {
      assert.ok(Object.hasOwn(deps, name), `Unexpected dependency: ${name}`);
      return deps[name];
    }, console: { log() {}, warn() {}, error() {}, dir() {} }, Date, Map, Math,
  });
  return { api: exports.HunApiService, calls };
}
const payload = { paciente: { tipo: 'CC', documento: '000' }, medico: { codigo_medico: 'TEST', especialidad: 21 } };

test('assignment uses REST even with obsolete SOAP flag enabled', async () => {
  const { api, calls } = service({ success: true, numero_cita: 12345 });
  const result = await api.asignarCita(payload);
  assert.equal(result.success, true);
  assert.equal(result.numeroCitaHosvital, 12345);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/webServiceCita/api/asignar_cita');
  assert.equal(typeof calls[0].payload, 'object');
});
test('REST may include upstream SOAP metadata without a direct SOAP call', async () => {
  const { api } = service({ soap: { ok: true, codigo: '0', descripcion: 'Se ha asignado la cita 12345' } });
  assert.equal((await api.asignarCita(payload)).numeroCitaHosvital, 12345);
});
for (const [name, response] of [
  ['success without appointment number', { success: true }],
  ['rejection containing a number', { success: false, numero_cita: 12345 }],
  ['upstream rejection', { success: true, numero_cita: 12345, soap: { ok: false, codigo: '100' } }],
  ['contradictory upstream status', { success: true, numero_cita: 12345, soap: { ok: false, codigo: '0' } }],
  ['generic record ID', { success: true, data: { id: 12345 } }],
  ['invalid number', { success: true, numero_cita: 12.5 }],
  ['empty response', null],
  ['transport failure', new Error('timeout')],
]) test(`does not confirm ${name}`, async () => {
  const { api } = service(response);
  const result = await api.asignarCita(payload);
  assert.equal(result.success, false);
  assert.equal(result.numeroCitaHosvital, undefined);
});
test('disabled integration fails without inventing a number or making a request', async () => {
  const { api, calls } = service({}, false);
  const result = await api.asignarCita(payload);
  assert.equal(result.success, false);
  assert.equal(result.numeroCitaHosvital, undefined);
  assert.equal(calls.length, 0);
});
test('cancellation uses WSCancita SOAP service according to DigitalWare specification', async () => {
  const { api, calls } = service({ success: true });
  const result = await api.cancelarCita({ cita: 12345, tipo_documento: 'CC', documento: '000' });
  assert.equal(result.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].soap, true);
  assert.equal(calls[0].payload.cita, 12345);
});

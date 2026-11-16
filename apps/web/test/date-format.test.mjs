import test from 'node:test';
import assert from 'node:assert/strict';
import { luandaDateTimeInput, luandaDateTimeToIso, luandaDateInput } from '../app/lib/time.ts';
import { formatAOA } from '../app/lib/format.ts';

test('datas do programa mantêm a hora de Luanda ao serializar e voltar', () => {
  const instant = luandaDateTimeToIso('2026-11-16T18:45');
  assert.equal(instant, '2026-11-16T17:45:00.000Z');
  assert.equal(luandaDateTimeInput(instant), '2026-11-16T18:45');
  assert.equal(luandaDateInput(instant), '2026-11-16');
});

test('formatação financeira aceita valores válidos e não mascara valores inválidos', () => {
  assert.match(formatAOA('125000'), /125/);
  assert.equal(formatAOA(null), '—');
  assert.equal(formatAOA('valor inválido'), '—');
});

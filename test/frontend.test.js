import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFrontendSettings } from '../src/config/frontend.js';
import { withTourContent } from '../src/data/tourContent.js';
import { escapeHtml, formatDeparture, formatPrice, hasDeparted, remainingTickets } from '../src/ui/format.js';

test('frontend chooses explicit demo or blockchain mode without masking missing config', () => {
  assert.equal(readFrontendSettings({}).mode, 'demo');
  assert.equal(readFrontendSettings({ VITE_DATA_MODE: 'demo' }).error, null);
  const chain = readFrontendSettings({ VITE_DATA_MODE: 'blockchain' });
  assert.equal(chain.mode, 'blockchain');
  assert.equal(chain.error.code, 'CONFIG_ERROR');
  assert.equal(readFrontendSettings({ VITE_DATA_MODE: 'automatic' }).error.code, 'CONFIG_ERROR');
});

test('presentation data never replaces core on-chain fields; new tour IDs have defaults', () => {
  const chainTour = { id: 42n, name: 'Tour mới', departureTime: 1893456000n, price: 1n, totalTickets: 10n, soldTickets: 2n };
  const enriched = withTourContent(chainTour);
  for (const key of Object.keys(chainTour)) assert.equal(enriched[key], chainTour[key]);
  assert.match(enriched.image, /tour-placeholder\.svg$/);
  assert.ok(enriched.description.length);
});

test('prices, large counts and departure boundaries preserve exact integer values', () => {
  assert.equal(formatPrice(1n), '0.000000000000000001 ETH');
  assert.equal(remainingTickets({ totalTickets: 9007199254740995n, soldTickets: 1n }), 9007199254740994n);
  assert.equal(hasDeparted({ departureTime: 1000n }, 999999), false);
  assert.equal(hasDeparted({ departureTime: 1000n }, 1000000), true);
  assert.match(formatDeparture(8640000000001n), /ngoài phạm vi/);
});

test('contract strings are escaped before inserting into HTML templates', () => {
  const encoded = escapeHtml('<img src=x onerror="alert(1)">&\'');
  assert.ok(!encoded.includes('<'));
  assert.ok(!encoded.includes('"'));
  assert.ok(encoded.includes('&amp;'));
});

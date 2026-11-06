import assert from "node:assert/strict";
import test from "node:test";
import { getBusinessStatus, type OpeningHour } from "../lib/business-hours.ts";
import { normalizeBrazilianPhone } from "../lib/brazilian-phone.ts";
import { databaseTimestampToIso } from "../lib/utc-date.ts";

const hours: OpeningHour[] = [
  { day: "Sexta-feira", open: true, from: "18:00", to: "23:00" },
  { day: "Sábado", open: true, from: "18:00", to: "02:00" },
];

test("uses America/Fortaleza and opens exactly at the scheduled time", () => {
  const status = getBusinessStatus(hours, "auto", new Date("2026-11-07T21:00:00Z"));
  assert.equal(status.timeZone, "America/Fortaleza");
  assert.equal(status.isOpen, true);
});

test("keeps overnight opening through the next day closing time", () => {
  const status = getBusinessStatus(hours, "auto", new Date("2026-11-08T04:30:00Z"));
  assert.equal(status.isOpen, true);
});

test("honors manual opening and closing overrides", () => {
  const now = new Date("2026-11-07T15:00:00Z");
  assert.equal(getBusinessStatus(hours, "open", now).isOpen, true);
  assert.equal(getBusinessStatus(hours, "closed", now).isOpen, false);
});

test("reports the next configured opening while closed", () => {
  const status = getBusinessStatus(hours, "auto", new Date("2026-11-07T15:00:00Z"));
  assert.equal(status.isOpen, false);
  assert.equal(status.nextOpening?.day, "sábado");
  assert.match(status.message, /Abriremos sábado às 18:00/);
});

test("normalizes valid Brazilian mobile and landline numbers", () => {
  assert.equal(normalizeBrazilianPhone("+55 (85) 99999-1234"), "85999991234");
  assert.equal(normalizeBrazilianPhone("11 3333-1234"), "1133331234");
});

test("rejects invalid DDDs and incomplete numbers", () => {
  assert.equal(normalizeBrazilianPhone("00 99999-1234"), null);
  assert.equal(normalizeBrazilianPhone("85 9999-123"), null);
});

test("treats database timestamps as UTC", () => {
  assert.equal(
    databaseTimestampToIso("2026-11-06 20:22:00"),
    "2026-11-06T20:22:00.000Z",
  );
});

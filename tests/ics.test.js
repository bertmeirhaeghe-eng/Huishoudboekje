import test from 'node:test';
import assert from 'node:assert/strict';
import { eventsBetween } from '../src/lib/ics.js';

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:a1
DTSTART;TZID=Europe/Brussels:20261121T100000
DTEND;TZID=Europe/Brussels:20261121T110000
SUMMARY:Zwemles
END:VEVENT
BEGIN:VEVENT
UID:b2
DTSTART:20261118T080000Z
DTEND:20261118T090000Z
SUMMARY:Tandarts\\, controle
END:VEVENT
BEGIN:VEVENT
UID:c3
DTSTART;VALUE=DATE:20261120
DTEND;VALUE=DATE:20261121
SUMMARY:Verjaardag o
 ma
END:VEVENT
BEGIN:VEVENT
UID:w4
DTSTART;TZID=Europe/Brussels:20261005T190000
DTEND;TZID=Europe/Brussels:20261005T200000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE
EXDATE;TZID=Europe/Brussels:20261118T190000
SUMMARY:Voetbal
END:VEVENT
BEGIN:VEVENT
UID:w4
RECURRENCE-ID;TZID=Europe/Brussels:20261123T190000
DTSTART;TZID=Europe/Brussels:20261123T183000
DTEND;TZID=Europe/Brussels:20261123T193000
SUMMARY:Voetbal (vroeger)
END:VEVENT
BEGIN:VEVENT
UID:old
DTSTART;TZID=Europe/Brussels:20250101T090000
SUMMARY:Oud
END:VEVENT
BEGIN:VEVENT
UID:y5
DTSTART;VALUE=DATE:20101125
RRULE:FREQ=YEARLY
SUMMARY:Trouwdag
END:VEVENT
BEGIN:VEVENT
UID:x
DTSTART;TZID=Europe/Brussels:20261119T120000
STATUS:CANCELLED
SUMMARY:Afgelast
END:VEVENT
END:VCALENDAR`;

test('afspraken uit een iCal-bestand', () => {
  const r = eventsBetween(ICS, '2026-11-16', '2026-11-29').map((e) => [e.date, e.time, e.title]);
  assert.deepEqual(r, [
    ['2026-11-16', '19:00', 'Voetbal'],
    ['2026-11-18', '09:00', 'Tandarts, controle'],
    ['2026-11-20', null, 'Verjaardag oma'],
    ['2026-11-21', '10:00', 'Zwemles'],
    ['2026-11-23', '18:30', 'Voetbal (vroeger)'],
    ['2026-11-25', null, 'Trouwdag'],
    ['2026-11-25', '19:00', 'Voetbal'],
  ]);
  assert.equal(eventsBetween(ICS, '2026-11-21', '2026-11-21')[0].endTime, '11:00');
});

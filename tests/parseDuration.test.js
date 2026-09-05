import { expect } from '@esm-bundle/chai';
import { parseDuration } from '../js/parseDuration.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

describe('parseDuration', () => {
  describe('unit suffixes', () => {
    it('parses minutes', () => {
      expect(parseDuration('25m')).to.equal(25 * MINUTE);
    });

    it('parses hours', () => {
      expect(parseDuration('2h')).to.equal(2 * HOUR);
    });

    it('parses seconds', () => {
      expect(parseDuration('90s')).to.equal(90 * 1000);
    });

    it('parses combined hours and minutes with or without spaces', () => {
      expect(parseDuration('1h30m')).to.equal(HOUR + 30 * MINUTE);
      expect(parseDuration('1h 30m')).to.equal(HOUR + 30 * MINUTE);
    });

    it('parses hours, minutes and seconds together', () => {
      expect(parseDuration('2h 30m 15s')).to.equal(2 * HOUR + 30 * MINUTE + 15 * 1000);
    });

    it('accepts long unit names', () => {
      expect(parseDuration('90 sec')).to.equal(90 * 1000);
      expect(parseDuration('2 hrs')).to.equal(2 * HOUR);
      expect(parseDuration('1 hour 30 minutes')).to.equal(HOUR + 30 * MINUTE);
    });

    it('accepts decimal amounts', () => {
      expect(parseDuration('1.5h')).to.equal(90 * MINUTE);
    });

    it('rejects units out of order or repeated', () => {
      expect(parseDuration('30m 1h')).to.be.null;
      expect(parseDuration('1h1h')).to.be.null;
    });
  });

  describe('clock notation', () => {
    it('parses h:mm', () => {
      expect(parseDuration('1:30')).to.equal(HOUR + 30 * MINUTE);
    });

    it('parses h:mm:ss', () => {
      expect(parseDuration('1:30:00')).to.equal(HOUR + 30 * MINUTE);
      expect(parseDuration('0:00:45')).to.equal(45 * 1000);
    });

    it('lets hours exceed two digits', () => {
      expect(parseDuration('125:00')).to.equal(125 * HOUR);
    });

    it('rejects minutes or seconds above 59', () => {
      expect(parseDuration('1:75')).to.be.null;
      expect(parseDuration('1:30:60')).to.be.null;
    });
  });

  describe('bare numbers', () => {
    it('treats a bare number as minutes', () => {
      expect(parseDuration('45')).to.equal(45 * MINUTE);
    });

    it('accepts a decimal bare number', () => {
      expect(parseDuration('1.5')).to.equal(90 * 1000);
    });
  });

  describe('normalisation', () => {
    it('trims whitespace and ignores case', () => {
      expect(parseDuration('  25M  ')).to.equal(25 * MINUTE);
      expect(parseDuration('1H 30M')).to.equal(HOUR + 30 * MINUTE);
    });

    it('returns an integer number of milliseconds', () => {
      expect(Number.isInteger(parseDuration('0.0005h'))).to.be.true;
    });
  });

  describe('invalid input', () => {
    it('returns null for empty or whitespace-only input', () => {
      expect(parseDuration('')).to.be.null;
      expect(parseDuration('   ')).to.be.null;
    });

    it('returns null for non-string input', () => {
      expect(parseDuration(null)).to.be.null;
      expect(parseDuration(undefined)).to.be.null;
      expect(parseDuration(25)).to.be.null;
    });

    it('returns null for zero or negative durations', () => {
      expect(parseDuration('0')).to.be.null;
      expect(parseDuration('0m')).to.be.null;
      expect(parseDuration('0:00')).to.be.null;
      expect(parseDuration('-5m')).to.be.null;
    });

    it('returns null for durations that round down to zero milliseconds', () => {
      expect(parseDuration('0.0001s')).to.be.null;
    });

    it('returns null for unrecognised text', () => {
      expect(parseDuration('abc')).to.be.null;
      expect(parseDuration('h')).to.be.null;
      expect(parseDuration('25 m x')).to.be.null;
      expect(parseDuration('10m 5')).to.be.null;
    });
  });
});

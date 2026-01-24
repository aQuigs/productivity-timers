import { expect } from '@esm-bundle/chai';
import { allocateToSingle, allocateFixed, allocatePercentage, allocateDiscard } from '../js/timeDistributor.js';

describe('TimeDistributor', () => {
  describe('allocateToSingle()', () => {
    it('should allocate all time to a single timer', () => {
      const result = allocateToSingle(60000, 'timer-1');
      expect(result).to.be.instanceOf(Map);
      expect(result.size).to.equal(1);
      expect(result.get('timer-1')).to.equal(60000);
    });

    it('should handle zero milliseconds', () => {
      const result = allocateToSingle(0, 'timer-1');
      expect(result).to.be.instanceOf(Map);
      expect(result.size).to.equal(1);
      expect(result.get('timer-1')).to.equal(0);
    });

    it('should work with different timer IDs', () => {
      const result = allocateToSingle(123456, 'custom-timer-id');
      expect(result.get('custom-timer-id')).to.equal(123456);
    });
  });

  describe('allocateFixed()', () => {
    it('should allocate fixed amounts and remainder to specified timer', () => {
      const fixedMap = new Map([
        ['t1', 20000],
        ['t2', 20000]
      ]);
      const result = allocateFixed(60000, fixedMap, 't3');

      expect(result).to.be.instanceOf(Map);
      expect(result.size).to.equal(3);
      expect(result.get('t1')).to.equal(20000);
      expect(result.get('t2')).to.equal(20000);
      expect(result.get('t3')).to.equal(20000);
    });

    it('should handle exact allocation with no remainder', () => {
      const fixedMap = new Map([
        ['t1', 30000],
        ['t2', 30000]
      ]);
      const result = allocateFixed(60000, fixedMap, 't3');

      expect(result.get('t1')).to.equal(30000);
      expect(result.get('t2')).to.equal(30000);
      expect(result.get('t3')).to.equal(0);
    });

    it('should handle zero remainder', () => {
      const fixedMap = new Map([['t1', 10000]]);
      const result = allocateFixed(10000, fixedMap, 't2');

      expect(result.get('t1')).to.equal(10000);
      expect(result.get('t2')).to.equal(0);
    });

    it('should allocate all to remainder timer if fixed map is empty', () => {
      const fixedMap = new Map();
      const result = allocateFixed(60000, fixedMap, 't1');

      expect(result.size).to.equal(1);
      expect(result.get('t1')).to.equal(60000);
    });

    it('should throw error if fixed allocation exceeds total', () => {
      const fixedMap = new Map([['t1', 70000]]);
      expect(() => allocateFixed(60000, fixedMap, 't2'))
        .to.throw(RangeError, 'Fixed allocations exceed total time');
    });
  });

  describe('allocatePercentage()', () => {
    it('should allocate time based on percentages', () => {
      const percentages = new Map([
        ['t1', 50],
        ['t2', 30]
      ]);
      const result = allocatePercentage(60000, percentages, 't3');

      expect(result).to.be.instanceOf(Map);
      expect(result.size).to.equal(3);
      expect(result.get('t1')).to.equal(30000);
      expect(result.get('t2')).to.equal(18000);
      expect(result.get('t3')).to.equal(12000);
    });

    it('should handle 100% allocation with no remainder', () => {
      const percentages = new Map([
        ['t1', 60],
        ['t2', 40]
      ]);
      const result = allocatePercentage(60000, percentages, 't3');

      expect(result.get('t1')).to.equal(36000);
      expect(result.get('t2')).to.equal(24000);
      expect(result.get('t3')).to.equal(0);
    });

    it('should handle rounding without losing milliseconds', () => {
      const percentages = new Map([
        ['t1', 33],
        ['t2', 33]
      ]);
      const result = allocatePercentage(100, percentages, 't3');

      const total = result.get('t1') + result.get('t2') + result.get('t3');
      expect(total).to.equal(100);
    });

    it('should ensure proper rounding with BigInt precision', () => {
      const percentages = new Map([
        ['t1', 33.333],
        ['t2', 33.333],
        ['t3', 33.334]
      ]);
      const result = allocatePercentage(90000, percentages, 't4');

      const total = result.get('t1') + result.get('t2') + result.get('t3') + result.get('t4');
      expect(total).to.equal(90000);
      expect(result.get('t1')).to.be.at.least(29999);
      expect(result.get('t2')).to.be.at.least(29999);
      expect(result.get('t3')).to.be.at.least(30000);
    });

    it('should throw error if percentages exceed 100', () => {
      const percentages = new Map([
        ['t1', 60],
        ['t2', 50]
      ]);
      expect(() => allocatePercentage(60000, percentages, 't3'))
        .to.throw(RangeError, 'Percentages exceed 100%');
    });

    it('should handle empty percentage map', () => {
      const percentages = new Map();
      const result = allocatePercentage(60000, percentages, 't1');

      expect(result.size).to.equal(1);
      expect(result.get('t1')).to.equal(60000);
    });
  });

  describe('allocateDiscard()', () => {
    it('should return empty Map', () => {
      const result = allocateDiscard(60000);
      expect(result).to.be.instanceOf(Map);
      expect(result.size).to.equal(0);
    });

    it('should return empty Map regardless of input', () => {
      const result1 = allocateDiscard(0);
      const result2 = allocateDiscard(999999);

      expect(result1.size).to.equal(0);
      expect(result2.size).to.equal(0);
    });
  });
});

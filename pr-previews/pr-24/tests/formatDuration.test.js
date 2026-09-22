import { expect } from '@esm-bundle/chai';
import { formatDuration } from '../js/formatDuration.js';

describe('formatDuration', () => {
  it('formats zero as 00:00:00', () => {
    expect(formatDuration(0)).to.equal('00:00:00');
  });

  it('pads minutes and seconds to two digits', () => {
    expect(formatDuration(61000)).to.equal('00:01:01');
  });

  it('formats hours, minutes and seconds', () => {
    expect(formatDuration(3665000)).to.equal('01:01:05');
  });

  it('lets hours grow past two digits', () => {
    expect(formatDuration(451865000)).to.equal('125:31:05');
  });

  it('floors sub-second remainders', () => {
    expect(formatDuration(999)).to.equal('00:00:00');
    expect(formatDuration(1999)).to.equal('00:00:01');
  });

  it('clamps negative and non-finite input to zero', () => {
    expect(formatDuration(-5000)).to.equal('00:00:00');
    expect(formatDuration(NaN)).to.equal('00:00:00');
    expect(formatDuration(undefined)).to.equal('00:00:00');
  });
});

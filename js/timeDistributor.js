/**
 * TimeDistributor - Pure allocation strategies for distributing idle time
 * All functions return Map<timerId, milliseconds> with no side effects
 */

/**
 * Adds leftover time to the remainder timer, or to the largest existing share when
 * no remainder timer is given, so rounding dust is never silently dropped
 * @param {Map<string, number>} result - Allocations built so far (mutated)
 * @param {Map<string, number>} shares - Caller-requested shares, used to pick the largest
 * @param {number} remainder - Milliseconds left to allocate
 * @param {string} [remainderTimerId] - Preferred recipient
 * @throws {RangeError} If time remains and there is no timer to receive it
 */
function assignRemainder(result, shares, remainder, remainderTimerId) {
  if (remainder === 0) {
    if (remainderTimerId && !result.has(remainderTimerId)) {
      result.set(remainderTimerId, 0);
    }
    return;
  }

  let target = remainderTimerId;
  if (!target) {
    let largest = -1;
    for (const [timerId, share] of shares) {
      if (share > largest) {
        largest = share;
        target = timerId;
      }
    }
  }

  if (!target) {
    throw new RangeError('No timer to receive remaining time');
  }

  result.set(target, (result.get(target) || 0) + remainder);
}

/**
 * Allocates all time to a single timer
 * @param {number} totalMs - Total milliseconds to allocate
 * @param {string} timerId - Timer to receive all time
 * @returns {Map<string, number>}
 */
export function allocateToSingle(totalMs, timerId) {
  const result = new Map();
  result.set(timerId, totalMs);
  return result;
}

/**
 * Allocates fixed amounts to specified timers, remainder goes to remainderTimerId
 * @param {number} totalMs - Total milliseconds to allocate
 * @param {Map<string, number>} fixedMap - Map of timerId to fixed milliseconds
 * @param {string} [remainderTimerId] - Timer to receive remaining time
 * @returns {Map<string, number>}
 * @throws {RangeError} If fixed allocations exceed total
 */
export function allocateFixed(totalMs, fixedMap, remainderTimerId) {
  const result = new Map();
  let allocated = 0;

  for (const [timerId, amount] of fixedMap.entries()) {
    result.set(timerId, amount);
    allocated += amount;
  }

  if (allocated > totalMs) {
    throw new RangeError('Fixed allocations exceed total time');
  }

  assignRemainder(result, fixedMap, totalMs - allocated, remainderTimerId);

  return result;
}

/**
 * Allocates time based on percentages, remainder goes to remainderTimerId
 * Uses BigInt for precise rounding to ensure no milliseconds are lost
 * @param {number} totalMs - Total milliseconds to allocate
 * @param {Map<string, number>} percentages - Map of timerId to percentage (0-100)
 * @param {string} [remainderTimerId] - Timer to receive remaining time
 * @returns {Map<string, number>}
 * @throws {RangeError} If percentages exceed 100%
 */
export function allocatePercentage(totalMs, percentages, remainderTimerId) {
  const result = new Map();
  let totalPercentage = 0;

  for (const percentage of percentages.values()) {
    totalPercentage += percentage;
  }

  if (totalPercentage > 100) {
    throw new RangeError('Percentages exceed 100%');
  }

  let allocated = 0;

  for (const [timerId, percentage] of percentages.entries()) {
    // Round the per-mille conversion: 0.57 * 1000 is 569.999... in floating point
    const perMille = BigInt(Math.round(percentage * 1000));
    const amount = Number((BigInt(totalMs) * perMille) / BigInt(100000));
    result.set(timerId, amount);
    allocated += amount;
  }

  assignRemainder(result, percentages, totalMs - allocated, remainderTimerId);

  return result;
}

/**
 * Discards all time (returns empty map)
 * @param {number} totalMs - Total milliseconds (ignored)
 * @returns {Map<string, number>}
 */
export function allocateDiscard(totalMs) {
  return new Map();
}

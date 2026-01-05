/**
 * TimeDistributor - Pure allocation strategies for distributing idle time
 * All functions return Map<timerId, milliseconds> with no side effects
 */

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
 * @param {string} remainderTimerId - Timer to receive remaining time
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

  const remainder = totalMs - allocated;
  result.set(remainderTimerId, remainder);

  return result;
}

/**
 * Allocates time based on percentages, remainder goes to remainderTimerId
 * Uses BigInt for precise rounding to ensure no milliseconds are lost
 * @param {number} totalMs - Total milliseconds to allocate
 * @param {Map<string, number>} percentages - Map of timerId to percentage (0-100)
 * @param {string} remainderTimerId - Timer to receive remaining time
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
    const amount = (BigInt(totalMs) * BigInt(Math.floor(percentage * 1000))) / BigInt(100000);
    const amountNum = Number(amount);
    result.set(timerId, amountNum);
    allocated += amountNum;
  }

  const remainder = totalMs - allocated;
  result.set(remainderTimerId, remainder);

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

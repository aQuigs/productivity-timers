/**
 * Formats a millisecond duration as HH:MM:SS.
 * Hours grow past two digits instead of wrapping so long sessions stay readable.
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  const totalSeconds = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map(part => String(part).padStart(2, '0'))
    .join(':');
}

export default formatDuration;

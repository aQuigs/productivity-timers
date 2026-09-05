const NUMBER = '(\\d+(?:\\.\\d+)?)';

const UNITS_PATTERN = new RegExp(
  `^(?:${NUMBER}\\s*h(?:ours?|rs?)?)?` +
  `\\s*(?:${NUMBER}\\s*m(?:in(?:ute)?s?)?)?` +
  `\\s*(?:${NUMBER}\\s*s(?:ec(?:ond)?s?)?)?$`
);
const CLOCK_PATTERN = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/;
const BARE_NUMBER_PATTERN = /^\d+(?:\.\d+)?$/;

function parseClockSeconds(input) {
  const match = CLOCK_PATTERN.exec(input);
  if (!match) {
    return null;
  }

  const [, hours, minutes, seconds = '0'] = match;
  if (Number(minutes) > 59 || Number(seconds) > 59) {
    return null;
  }
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function parseUnitSeconds(input) {
  const match = UNITS_PATTERN.exec(input);
  if (!match) {
    return null;
  }

  const [, hours = '0', minutes = '0', seconds = '0'] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/**
 * Parses a human-entered duration such as "25m", "1h 30m", "1:30" or "1:30:00".
 * A bare number means minutes.
 * @param {string} text
 * @returns {number|null} Milliseconds, or null for empty, invalid or non-positive input
 */
export function parseDuration(text) {
  if (typeof text !== 'string') {
    return null;
  }

  const input = text.trim().toLowerCase();
  if (input.length === 0) {
    return null;
  }

  let seconds;
  if (BARE_NUMBER_PATTERN.test(input)) {
    seconds = Number(input) * 60;
  } else {
    seconds = parseClockSeconds(input) ?? parseUnitSeconds(input);
  }

  if (seconds === null) {
    return null;
  }

  const ms = Math.round(seconds * 1000);
  return ms > 0 ? ms : null;
}

export default parseDuration;

export interface TeslaFiUtcConversion {
  valid: boolean;
  ambiguous: boolean;
  utcMs: number | null;
  iso: string | null;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function isValidIanaTimeZone(
  timeZone: string,
): boolean {
  try {
    new Intl.DateTimeFormat(
      "en-US",
      { timeZone },
    ).format();

    return true;
  } catch {
    return false;
  }
}

function parseLocalDateTime(
  value: string,
): LocalParts | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(
      value.trim(),
    );

  if (!match) return null;

  const result: LocalParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
  };

  const check = new Date(
    Date.UTC(
      result.year,
      result.month - 1,
      result.day,
      result.hour,
      result.minute,
      result.second,
    ),
  );

  if (
    check.getUTCFullYear() !== result.year ||
    check.getUTCMonth() !== result.month - 1 ||
    check.getUTCDate() !== result.day ||
    check.getUTCHours() !== result.hour ||
    check.getUTCMinutes() !== result.minute ||
    check.getUTCSeconds() !== result.second
  ) {
    return null;
  }

  return result;
}

function localPartsAt(
  utcMs: number,
  timeZone: string,
): LocalParts {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      },
    );

  const parts =
    formatter.formatToParts(
      new Date(utcMs),
    );

  function part(
    name: Intl.DateTimeFormatPartTypes,
  ): number {
    const found = parts.find(
      function findPart(value) {
        return value.type === name;
      },
    );

    if (!found) {
      throw new Error(
        "Intl date part missing",
      );
    }

    return Number(found.value);
  }

  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

function comparable(
  value: LocalParts,
): number {
  return Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
    value.second,
  );
}

function sameLocalTime(
  utcMs: number,
  expected: LocalParts,
  timeZone: string,
): boolean {
  const actual =
    localPartsAt(
      utcMs,
      timeZone,
    );

  return (
    actual.year === expected.year &&
    actual.month === expected.month &&
    actual.day === expected.day &&
    actual.hour === expected.hour &&
    actual.minute === expected.minute &&
    actual.second === expected.second
  );
}

function correctGuess(
  guess: number,
  expectedValue: number,
  timeZone: string,
): number {
  const displayed =
    comparable(
      localPartsAt(
        guess,
        timeZone,
      ),
    );

  return (
    guess +
    expectedValue -
    displayed
  );
}

export function teslaFiLocalTimeToUtc(
  localDateTime: string,
  timeZone: string,
): TeslaFiUtcConversion {
  if (!isValidIanaTimeZone(timeZone)) {
    return {
      valid: false,
      ambiguous: false,
      utcMs: null,
      iso: null,
    };
  }

  const expected =
    parseLocalDateTime(
      localDateTime,
    );

  if (!expected) {
    return {
      valid: false,
      ambiguous: false,
      utcMs: null,
      iso: null,
    };
  }

  const expectedValue =
    comparable(expected);

  let guess = expectedValue;

  guess = correctGuess(
    guess,
    expectedValue,
    timeZone,
  );

  guess = correctGuess(
    guess,
    expectedValue,
    timeZone,
  );

  guess = correctGuess(
    guess,
    expectedValue,
    timeZone,
  );

  guess = correctGuess(
    guess,
    expectedValue,
    timeZone,
  );

  if (
    !sameLocalTime(
      guess,
      expected,
      timeZone,
    )
  ) {
    return {
      valid: false,
      ambiguous: false,
      utcMs: null,
      iso: null,
    };
  }

  const oneHour = 3600000;

  const ambiguous =
    sameLocalTime(
      guess - oneHour,
      expected,
      timeZone,
    ) ||
    sameLocalTime(
      guess + oneHour,
      expected,
      timeZone,
    );

  return {
    valid: true,
    ambiguous,
    utcMs: guess,
    iso: new Date(
      guess,
    ).toISOString(),
  };
}

export const BUSINESS_TIME_ZONE = "America/Fortaleza";

export type OpeningHour = {
  day?: string;
  open?: boolean;
  from?: string;
  to?: string;
};

export type BusinessOverride = "auto" | "open" | "closed";

const DAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const ENGLISH_DAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function toMinutes(value: unknown): number | null {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return null;
  }
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function fortalezaTime(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    dayIndex: ENGLISH_DAY_INDEX[values.weekday] ?? 0,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function nextScheduledOpening(
  hours: readonly OpeningHour[],
  dayIndex: number,
  minutes: number,
) {
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidateDay = (dayIndex + offset) % 7;
    const entry = hours.find((item) => item.day === DAY_NAMES[candidateDay]);
    if (!entry?.open) continue;
    const opening = toMinutes(entry.from);
    if (opening === null) continue;
    if (offset === 0 && opening <= minutes) continue;
    const weekday = DAY_NAMES[candidateDay].replace("-feira", "").toLowerCase();
    return {
      day: weekday,
      time: String(entry.from),
      message: `Abriremos ${weekday} às ${entry.from}.`,
    };
  }
  return null;
}

export function getBusinessStatus(
  hours: readonly OpeningHour[],
  override: BusinessOverride = "auto",
  now = new Date(),
) {
  const current = fortalezaTime(now);
  const todayName = DAY_NAMES[current.dayIndex];
  const previousName = DAY_NAMES[(current.dayIndex + 6) % 7];
  const today = hours.find((item) => item.day === todayName);
  const previous = hours.find((item) => item.day === previousName);
  const todayFrom = today?.open ? toMinutes(today.from) : null;
  const todayTo = today?.open ? toMinutes(today.to) : null;
  const previousFrom = previous?.open ? toMinutes(previous.from) : null;
  const previousTo = previous?.open ? toMinutes(previous.to) : null;

  const withinToday = todayFrom !== null && todayTo !== null &&
    (todayTo > todayFrom
      ? current.minutes >= todayFrom && current.minutes < todayTo
      : current.minutes >= todayFrom);
  const continuingFromPrevious = previousFrom !== null && previousTo !== null &&
    previousTo <= previousFrom && current.minutes < previousTo;
  const scheduledOpen = withinToday || continuingFromPrevious;
  const manualOverride = override === "open" || override === "closed"
    ? override
    : "auto";
  const isOpen = manualOverride === "open" ||
    (manualOverride === "auto" && scheduledOpen);
  const nextOpening = isOpen
    ? null
    : nextScheduledOpening(hours, current.dayIndex, current.minutes);

  return {
    isOpen,
    manualOverride,
    timeZone: BUSINESS_TIME_ZONE,
    nextOpening,
    label: isOpen ? "ABERTO AGORA" : "FECHADO AGORA",
    message: isOpen
      ? "Estamos atendendo agora."
      : manualOverride === "closed"
        ? `Estamos fechados temporariamente.${nextOpening ? ` ${nextOpening.message}` : ""}`
        : nextOpening?.message ?? "Os horários de funcionamento ainda não foram configurados.",
  };
}

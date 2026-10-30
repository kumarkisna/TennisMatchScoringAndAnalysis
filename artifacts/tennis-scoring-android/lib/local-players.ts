import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocalPlayer {
  id: string;
  name: string;
  dateOfBirth: string | null;
  atpPlayerId: string | null;
  itfPlayerId: string | null;
  atpRanking: number | null;
  itfRanking: number | null;
  nationality: string | null;
  playingHand: PlayerHand | null;
  heightCm: number | null;
  weightKg: number | null;
  phoneNumbers: string[];
  profileUrls: string[];
  profileUrlLabels: string[];
  createdAt: string;
}

export type PlayerHand = 'right' | 'left' | 'ambidextrous';

export interface LocalPlayerDetailsInput {
  dateOfBirth?: string | null;
  atpPlayerId?: string | null;
  itfPlayerId?: string | null;
  atpRanking?: string | number | null;
  itfRanking?: string | number | null;
  nationality?: string | null;
  playingHand?: PlayerHand | null;
  heightCm?: string | number | null;
  weightKg?: string | number | null;
  phoneNumbers?: string[] | null;
  profileUrls?: string[] | null;
  profileUrlLabels?: string[] | null;
}

export interface LocalPlayerProfileLink {
  url: string;
  label: string;
}

export interface LocalPlayerProfileLinkPresentation {
  url: string;
  host: string;
  displayLabel: string;
  displayText: string;
}

export function pairLocalPlayerProfileLinks(
  urls: readonly string[] | null | undefined,
  labels: readonly string[] | null | undefined,
): LocalPlayerProfileLink[] {
  return (urls ?? []).map((url, index) => ({
    url,
    label: labels?.[index] ?? '',
  }));
}

export function getLocalPlayerProfileLinkPresentation(
  link: LocalPlayerProfileLink,
  index: number,
): LocalPlayerProfileLinkPresentation {
  const host = new URL(link.url).hostname;
  const label = link.label.trim();
  const displayLabel = label || `Profile ${index + 1}`;
  return {
    url: link.url,
    host,
    displayLabel,
    displayText: `${displayLabel} · ${host}`,
  };
}

export function addLocalPlayerProfileLink(
  links: readonly LocalPlayerProfileLink[],
): LocalPlayerProfileLink[] {
  return [...links, { url: '', label: '' }];
}

export function updateLocalPlayerProfileLink(
  links: readonly LocalPlayerProfileLink[],
  index: number,
  update: Partial<LocalPlayerProfileLink>,
): LocalPlayerProfileLink[] {
  return links.map((link, linkIndex) =>
    linkIndex === index ? { ...link, ...update } : { ...link },
  );
}

export function removeLocalPlayerProfileLink(
  links: readonly LocalPlayerProfileLink[],
  index: number,
): LocalPlayerProfileLink[] {
  return links.filter((_, linkIndex) => linkIndex !== index);
}

export function moveLocalPlayerProfileLink(
  links: readonly LocalPlayerProfileLink[],
  index: number,
  direction: 'up' | 'down',
): LocalPlayerProfileLink[] {
  const targetIndex = index + (direction === 'up' ? -1 : 1);
  if (
    index < 0 ||
    index >= links.length ||
    targetIndex < 0 ||
    targetIndex >= links.length
  ) {
    return [...links];
  }

  const reordered = [...links];
  [reordered[index], reordered[targetIndex]] = [
    reordered[targetIndex]!,
    reordered[index]!,
  ];
  return reordered;
}

export function serializeLocalPlayerProfileLinks(
  links: readonly LocalPlayerProfileLink[],
): Pick<LocalPlayerDetailsInput, 'profileUrls' | 'profileUrlLabels'> {
  return {
    profileUrls: links.map((link) => link.url),
    profileUrlLabels: links.map((link) => link.label),
  };
}

export const LOCAL_PLAYERS_KEY = ['device-players'] as const;
export const ACTIVE_LOCAL_PLAYER_KEY = ['device-active-player'] as const;

const STORAGE_KEY = '@tennis-scoring/players/record-v1';
const ACTIVE_PLAYER_STORAGE_KEY = '@tennis-scoring/players/active-id-v1';
let writeQueue = Promise.resolve();

function withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function newPlayerId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function readPlayers(): Promise<LocalPlayer[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];

  const value: unknown = JSON.parse(raw);
  if (
    !Array.isArray(value) ||
    value.some(
      (player) =>
        !player ||
        typeof player !== 'object' ||
        typeof player.id !== 'string' ||
        typeof player.name !== 'string' ||
        (player.dateOfBirth !== undefined &&
          player.dateOfBirth !== null &&
          typeof player.dateOfBirth !== 'string') ||
        ['atpPlayerId', 'itfPlayerId', 'nationality'].some(
          (field) =>
            player[field] !== undefined &&
            player[field] !== null &&
            typeof player[field] !== 'string',
        ) ||
        ['atpRanking', 'itfRanking', 'heightCm', 'weightKg'].some(
          (field) =>
            player[field] !== undefined &&
            player[field] !== null &&
            (typeof player[field] !== 'number' || !Number.isFinite(player[field])),
        ) ||
        (player.playingHand !== undefined &&
          player.playingHand !== null &&
          !['right', 'left', 'ambidextrous'].includes(player.playingHand)) ||
        (player.profileUrls !== undefined &&
          (!Array.isArray(player.profileUrls) ||
            player.profileUrls.some((url: unknown) => typeof url !== 'string'))) ||
        (player.profileUrlLabels !== undefined &&
          (!Array.isArray(player.profileUrlLabels) ||
            player.profileUrlLabels.some((label: unknown) => typeof label !== 'string'))) ||
        (player.phoneNumbers !== undefined &&
          (!Array.isArray(player.phoneNumbers) ||
            player.phoneNumbers.some((phone: unknown) => typeof phone !== 'string'))) ||
        typeof player.createdAt !== 'string',
    )
  ) {
    throw new Error('Saved player list is damaged. No player data was changed.');
  }

  return value.map((player) => {
    const profileLinks = normalizeProfileLinks(
      player.profileUrls ?? [],
      player.profileUrlLabels ?? [],
    );
    return {
      ...player,
      dateOfBirth:
        typeof player.dateOfBirth === 'string' ? player.dateOfBirth : null,
      atpPlayerId: typeof player.atpPlayerId === 'string' ? player.atpPlayerId : null,
      itfPlayerId: typeof player.itfPlayerId === 'string' ? player.itfPlayerId : null,
      atpRanking: typeof player.atpRanking === 'number' ? player.atpRanking : null,
      itfRanking: typeof player.itfRanking === 'number' ? player.itfRanking : null,
      nationality: typeof player.nationality === 'string' ? player.nationality : null,
      playingHand:
        player.playingHand === 'right' ||
        player.playingHand === 'left' ||
        player.playingHand === 'ambidextrous'
          ? player.playingHand
          : null,
      heightCm: typeof player.heightCm === 'number' ? player.heightCm : null,
      weightKg: typeof player.weightKg === 'number' ? player.weightKg : null,
      phoneNumbers: normalizePhoneNumbers(player.phoneNumbers ?? []),
      ...profileLinks,
    };
  }) as LocalPlayer[];
}

async function writePlayers(players: LocalPlayer[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(players));
}

export async function listLocalPlayers(): Promise<LocalPlayer[]> {
  const players = await readPlayers();
  return [...players].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
  );
}

export async function getActiveLocalPlayerId(): Promise<string | null> {
  const activeId = await AsyncStorage.getItem(ACTIVE_PLAYER_STORAGE_KEY);
  if (!activeId) return null;

  const players = await readPlayers();
  if (players.some((player) => player.id === activeId)) return activeId;

  await AsyncStorage.removeItem(ACTIVE_PLAYER_STORAGE_KEY);
  return null;
}

export async function setActiveLocalPlayerId(id: string): Promise<void> {
  return withWriteLock(async () => {
    const players = await readPlayers();
    if (!players.some((player) => player.id === id)) {
      throw new Error('Choose a saved player to make the main tracked player.');
    }
    await AsyncStorage.setItem(ACTIVE_PLAYER_STORAGE_KEY, id);
  });
}

export async function addLocalPlayer(
  name: string,
  details: LocalPlayerDetailsInput = {},
): Promise<LocalPlayer> {
  const normalizedName = name.trim().replace(/\s+/g, ' ');
  if (!normalizedName) throw new Error('Enter a player name.');
  if (normalizedName.length > 80) {
    throw new Error('Player names must be 80 characters or fewer.');
  }
  const profileDetails = normalizeProfileDetails(details);

  return withWriteLock(async () => {
    const players = await readPlayers();
    const existing = players.find(
      (player) => player.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
    );
    if (existing) {
      throw new Error(
        'A player with that name is already saved. Edit the existing player to add or change profile links.',
      );
    }

    const player: LocalPlayer = {
      id: newPlayerId(),
      name: normalizedName,
      ...profileDetails,
      createdAt: new Date().toISOString(),
    };
    await writePlayers([...players, player]);
    if (!(await AsyncStorage.getItem(ACTIVE_PLAYER_STORAGE_KEY))) {
      await AsyncStorage.setItem(ACTIVE_PLAYER_STORAGE_KEY, player.id);
    }
    return player;
  });
}

export async function updateLocalPlayer(
  id: string,
  name: string,
  details: LocalPlayerDetailsInput,
): Promise<LocalPlayer> {
  const normalizedName = name.trim().replace(/\s+/g, ' ');
  if (!normalizedName) throw new Error('Enter a player name.');
  if (normalizedName.length > 80) {
    throw new Error('Player names must be 80 characters or fewer.');
  }
  const profileDetails = normalizeProfileDetails(details);

  return withWriteLock(async () => {
    const players = await readPlayers();
    const player = players.find((item) => item.id === id);
    if (!player) throw new Error('This player is no longer in your saved list.');
    const duplicate = players.find(
      (item) =>
        item.id !== id &&
        item.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
    );
    if (duplicate) throw new Error('A player with that name is already saved.');

    const updated = { ...player, name: normalizedName, ...profileDetails };
    await writePlayers(players.map((item) => (item.id === id ? updated : item)));
    return updated;
  });
}

export async function deleteLocalPlayer(id: string): Promise<boolean> {
  return withWriteLock(async () => {
    const players = await readPlayers();
    const remaining = players.filter((player) => player.id !== id);
    if (remaining.length === players.length) return false;
    await writePlayers(remaining);
    if ((await AsyncStorage.getItem(ACTIVE_PLAYER_STORAGE_KEY)) === id) {
      const nextActivePlayer = remaining[0];
      if (nextActivePlayer) {
        await AsyncStorage.setItem(ACTIVE_PLAYER_STORAGE_KEY, nextActivePlayer.id);
      } else {
        await AsyncStorage.removeItem(ACTIVE_PLAYER_STORAGE_KEY);
      }
    }
    return true;
  });
}

export function formatDateOfBirthInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const year = digits.slice(0, 4);
  if (digits.length <= 4) return year;

  const month = digits.slice(4, 6);
  if (digits.length <= 6) return `${year}-${month}`;

  return `${year}-${month}-${digits.slice(6, 8)}`;
}

export function getDateOfBirthValidationError(value: string): string | null {
  const dateText = value.trim();
  if (!dateText) return null;

  const digits = dateText.replace(/\D/g, '');
  if (digits.length > 8) return 'Enter date of birth as YYYY-MM-DD.';
  if (!/^[\d-]*$/.test(dateText)) return 'Use digits only for the date of birth.';

  if (digits.length >= 4) {
    const year = Number(digits.slice(0, 4));
    if (year === 0) return 'Enter a valid year.';
    if (year > new Date().getFullYear()) {
      return 'Date of birth cannot be in the future.';
    }
  }

  if (digits.length >= 5 && !['0', '1'].includes(digits[4] ?? '')) {
    return 'Month must be between 01 and 12.';
  }

  if (digits.length >= 6) {
    const month = Number(digits.slice(4, 6));
    if (month < 1 || month > 12) return 'Month must be between 01 and 12.';
  }

  if (digits.length >= 7 && Number(digits[6]) > 3) {
    return 'Day must be between 01 and 31.';
  }

  if (digits.length < 8) {
    return 'Enter all 8 digits, or clear this optional field.';
  }

  const [yearText, monthText, dayText] = [
    digits.slice(0, 4),
    digits.slice(4, 6),
    digits.slice(6, 8),
  ];
  const formattedDate = `${yearText}-${monthText}-${dayText}`;
  if (dateText !== formattedDate) return 'Enter date of birth as YYYY-MM-DD.';

  const date = new Date(`${formattedDate}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== formattedDate
  ) {
    return 'Enter a valid calendar date.';
  }

  const today = new Date();
  const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (formattedDate > todayText) return 'Date of birth cannot be in the future.';

  return null;
}

function normalizeDateOfBirth(value: string | null): string | null {
  const dateText = value?.trim() ?? '';
  if (!dateText) return null;
  const validationError = getDateOfBirthValidationError(dateText);
  if (validationError) throw new Error(validationError);
  return dateText;
}

interface NormalizedProfileLink extends LocalPlayerProfileLink {
  dedupeKey: string;
}

function normalizeSingleProfileLink(
  link: LocalPlayerProfileLink,
): NormalizedProfileLink | null {
  const text = link.url.trim();
  const label = link.label.trim();
  if (label.length > 40) {
    throw new Error('Profile link labels must be 40 characters or fewer.');
  }
  if (!text && label) {
    throw new Error('Add a profile link before adding its label.');
  }
  if (!text) return null;
  if (text.length > 2048) {
    throw new Error('Profile links must be 2,048 characters or fewer.');
  }
  if (/\s/.test(text) || text.startsWith('//')) {
    throw new Error('Enter a valid http:// or https:// profile link.');
  }

  const hasScheme = text.includes('://') && /^[a-z][a-z\d+.-]*:\/\//i.test(text);
  const candidate = hasScheme ? text : `https://${text}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('Enter a valid http:// or https:// profile link.');
  }

  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error('Profile links must use http:// or https:// and include a web address.');
  }

  return {
    url: parsed.toString(),
    label,
    dedupeKey: `${parsed.origin.toLowerCase()}${parsed.pathname}${parsed.search}${parsed.hash}`,
  };
}

export function getLocalPlayerProfileLinkValidationErrors(
  links: readonly LocalPlayerProfileLink[],
): Array<string | null> {
  const seen = new Set<string>();
  return links.map((link) => {
    try {
      const normalized = normalizeSingleProfileLink(link);
      if (!normalized) return null;
      if (seen.has(normalized.dedupeKey)) {
        throw new Error('Each profile link must be unique.');
      }
      seen.add(normalized.dedupeKey);
      return null;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : 'Enter a valid http:// or https:// profile link.';
    }
  });
}

function normalizeProfileLinks(
  values: string[] | null | undefined,
  labels: string[] | null | undefined,
): Pick<LocalPlayer, 'profileUrls' | 'profileUrlLabels'> {
  const sourceUrls = values ?? [];
  const sourceLabels = labels ?? [];
  const links = sourceUrls.map((url, index) => ({
    url,
    label: sourceLabels[index] ?? '',
  }));
  const firstError = getLocalPlayerProfileLinkValidationErrors(links).find(
    (error): error is string => Boolean(error),
  );
  if (firstError) throw new Error(firstError);

  if (sourceLabels.slice(sourceUrls.length).some((label) => label.trim())) {
    throw new Error('Add a profile link before adding its label.');
  }

  const normalizedLinks = links
    .map(normalizeSingleProfileLink)
    .filter((link): link is NormalizedProfileLink => link !== null);
  return {
    profileUrls: normalizedLinks.map((link) => link.url),
    profileUrlLabels: normalizedLinks.map((link) => link.label),
  };
}

function normalizePhoneNumbers(values: string[] | null | undefined): string[] {
  const phoneNumbers: string[] = [];
  const seen = new Set<string>();

  for (const value of values ?? []) {
    const text = value.trim();
    if (!text) continue;
    const digits = text.replace(/\D/g, '');
    const plusCount = (text.match(/\+/g) ?? []).length;
    if (
      text.length > 40 ||
      !/^[+\d().\s-]+$/.test(text) ||
      (plusCount > 0 && (!text.trimStart().startsWith('+') || plusCount > 1)) ||
      digits.length < 7 ||
      digits.length > 15
    ) {
      throw new Error(
        'Enter a valid phone number using 7–15 digits and standard phone punctuation.',
      );
    }

    if (seen.has(digits)) {
      throw new Error('Each phone number must be unique.');
    }
    seen.add(digits);
    phoneNumbers.push(text);
  }

  return phoneNumbers;
}

function normalizeProfileDetails(details: LocalPlayerDetailsInput): Omit<LocalPlayer, 'id' | 'name' | 'createdAt'> {
  const normalizeText = (value: string | null | undefined, label: string, maxLength = 80) => {
    const text = value?.trim() ?? '';
    if (text.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
    return text || null;
  };
  const normalizeInteger = (
    value: string | number | null | undefined,
    label: string,
    min: number,
    max: number,
  ) => {
    const text = value === null || value === undefined ? '' : String(value).trim();
    if (!text) return null;
    if (!/^\d+$/.test(text)) throw new Error(`${label} must be a whole number.`);
    const number = Number(text);
    if (!Number.isSafeInteger(number) || number < min || number > max) {
      throw new Error(`${label} must be between ${min} and ${max}.`);
    }
    return number;
  };

  const playingHand = details.playingHand ?? null;
  if (
    playingHand !== null &&
    playingHand !== 'right' &&
    playingHand !== 'left' &&
    playingHand !== 'ambidextrous'
  ) {
    throw new Error('Choose a valid playing hand.');
  }

  const profileLinks = normalizeProfileLinks(
    details.profileUrls,
    details.profileUrlLabels,
  );

  return {
    dateOfBirth: normalizeDateOfBirth(details.dateOfBirth ?? null),
    atpPlayerId: normalizeText(details.atpPlayerId, 'ATP player ID', 64),
    itfPlayerId: normalizeText(details.itfPlayerId, 'ITF player ID', 64),
    atpRanking: normalizeInteger(details.atpRanking, 'ATP ranking', 1, 100000),
    itfRanking: normalizeInteger(details.itfRanking, 'ITF ranking', 1, 100000),
    nationality: normalizeText(details.nationality, 'Nationality', 80),
    playingHand,
    heightCm: normalizeInteger(details.heightCm, 'Height in centimeters', 50, 250),
    weightKg: normalizeInteger(details.weightKg, 'Weight in kilograms', 10, 300),
    phoneNumbers: normalizePhoneNumbers(details.phoneNumbers),
    ...profileLinks,
  };
}

export function validateLocalPlayerDetails(
  details: LocalPlayerDetailsInput,
): string | null {
  try {
    normalizeProfileDetails(details);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Enter valid player details.';
  }
}

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
}

export const LOCAL_PLAYERS_KEY = ['device-players'] as const;

const STORAGE_KEY = '@tennis-scoring/players/record-v1';
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
        typeof player.createdAt !== 'string',
    )
  ) {
    throw new Error('Saved player list is damaged. No player data was changed.');
  }

  return value.map((player) => ({
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
  })) as LocalPlayer[];
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
    if (existing) return existing;

    const player: LocalPlayer = {
      id: newPlayerId(),
      name: normalizedName,
      ...profileDetails,
      createdAt: new Date().toISOString(),
    };
    await writePlayers([...players, player]);
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
    return true;
  });
}

function normalizeDateOfBirth(value: string | null): string | null {
  const dateText = value?.trim() ?? '';
  if (!dateText) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new Error('Enter date of birth as YYYY-MM-DD.');
  }
  const date = new Date(`${dateText}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dateText
  ) {
    throw new Error('Enter a valid date of birth.');
  }
  if (date.getTime() > Date.now()) {
    throw new Error('Date of birth cannot be in the future.');
  }
  return dateText;
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
  };
}

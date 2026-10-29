import { createInsertSchema } from "drizzle-zod";
import {
  date,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const tennisMatchesTable = pgTable(
  "tennis_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchDate: date("match_date", { mode: "string" }).notNull(),
    event: text("event"),
    round: text("round"),
    setNumber: integer("set_number").notNull().default(1),
    trackedPlayer: text("tracked_player").notNull(),
    opponent: text("opponent").notNull(),
    chairCoach: text("chair_coach"),
    surface: text("surface").notNull(),
    firstServer: text("first_server").notNull(),
    status: text("status").notNull().default("in_progress"),
    clientMatchId: text("client_match_id"),
    syncTokenHash: text("sync_token_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("tennis_matches_updated_at_idx").on(table.updatedAt),
    index("tennis_matches_date_idx").on(table.matchDate),
    uniqueIndex("tennis_matches_client_match_id_idx").on(table.clientMatchId),
  ],
);

export const tennisPointsTable = pgTable(
  "tennis_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => tennisMatchesTable.id, { onDelete: "cascade" }),
    sequenceNumber: integer("sequence_number").notNull(),
    setNumber: integer("set_number").notNull(),
    gameNumber: integer("game_number").notNull(),
    server: text("server").notNull(),
    isTiebreak: boolean("is_tiebreak").notNull().default(false),
    winner: text("winner").notNull(),
    endingCode: text("ending_code"),
    firstServeFault: boolean("first_serve_fault").notNull().default(false),
    clientPointId: text("client_point_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("tennis_points_match_sequence_idx").on(
      table.matchId,
      table.sequenceNumber,
    ),
    uniqueIndex("tennis_points_match_client_point_idx").on(
      table.matchId,
      table.clientPointId,
    ),
    index("tennis_points_match_game_idx").on(
      table.matchId,
      table.setNumber,
      table.gameNumber,
    ),
  ],
);

export const insertTennisMatchSchema = createInsertSchema(
  tennisMatchesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTennisPointSchema = createInsertSchema(
  tennisPointsTable,
).omit({ id: true, createdAt: true });

export type InsertTennisMatch = z.infer<typeof insertTennisMatchSchema>;
export type InsertTennisPoint = z.infer<typeof insertTennisPointSchema>;
export type TennisMatch = typeof tennisMatchesTable.$inferSelect;
export type TennisPoint = typeof tennisPointsTable.$inferSelect;

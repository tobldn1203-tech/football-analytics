-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "competitionId" TEXT NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "crestCode" INTEGER,
    "competitionId" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "photoCode" TEXT,
    "teamId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "gameweek" INTEGER,
    "kickoff" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMatchPerformance" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "isHome" BOOLEAN NOT NULL,
    "goalsFor" INTEGER NOT NULL,
    "goalsAgainst" INTEGER NOT NULL,
    "result" TEXT NOT NULL,

    CONSTRAINT "TeamMatchPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerMatchPerformance" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "started" BOOLEAN NOT NULL DEFAULT false,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "cleanSheets" INTEGER NOT NULL DEFAULT 0,
    "goalsConceded" INTEGER NOT NULL DEFAULT 0,
    "yellowCards" INTEGER NOT NULL DEFAULT 0,
    "redCards" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "bps" INTEGER NOT NULL DEFAULT 0,
    "expectedGoals" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedAssists" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedGoalsConceded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defensiveActions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ictIndex" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerMatchPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawIngestionPayload" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" TEXT NOT NULL,

    CONSTRAINT "RawIngestionPayload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "recordsWritten" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,

    CONSTRAINT "IngestionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Competition_provider_code_key" ON "Competition"("provider", "code");

-- CreateIndex
CREATE INDEX "Season_competitionId_idx" ON "Season"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_provider_externalId_key" ON "Season"("provider", "externalId");

-- CreateIndex
CREATE INDEX "Team_competitionId_idx" ON "Team"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_provider_externalId_key" ON "Team"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_slug_key" ON "Player"("slug");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_provider_externalId_key" ON "Player"("provider", "externalId");

-- CreateIndex
CREATE INDEX "Match_seasonId_idx" ON "Match"("seasonId");

-- CreateIndex
CREATE INDEX "Match_kickoff_idx" ON "Match"("kickoff");

-- CreateIndex
CREATE UNIQUE INDEX "Match_provider_externalId_key" ON "Match"("provider", "externalId");

-- CreateIndex
CREATE INDEX "TeamMatchPerformance_teamId_idx" ON "TeamMatchPerformance"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMatchPerformance_matchId_teamId_key" ON "TeamMatchPerformance"("matchId", "teamId");

-- CreateIndex
CREATE INDEX "PlayerMatchPerformance_matchId_idx" ON "PlayerMatchPerformance"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerMatchPerformance_playerId_matchId_key" ON "PlayerMatchPerformance"("playerId", "matchId");

-- CreateIndex
CREATE INDEX "RawIngestionPayload_provider_endpoint_fetchedAt_idx" ON "RawIngestionPayload"("provider", "endpoint", "fetchedAt");

-- CreateIndex
CREATE INDEX "IngestionLog_provider_task_startedAt_idx" ON "IngestionLog"("provider", "task", "startedAt");

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchPerformance" ADD CONSTRAINT "TeamMatchPerformance_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchPerformance" ADD CONSTRAINT "TeamMatchPerformance_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchPerformance" ADD CONSTRAINT "PlayerMatchPerformance_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchPerformance" ADD CONSTRAINT "PlayerMatchPerformance_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Guild" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discordId" TEXT NOT NULL,
    "masterSeed" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Guild_discordId_key" ON "Guild"("discordId");

-- CreateTable
CREATE TABLE "UserWallet" (
    "userId" TEXT NOT NULL,
    "guildId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "encryptedPrivateKey" TEXT NOT NULL,

    CONSTRAINT "UserWallet_pkey" PRIMARY KEY ("userId","guildId")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_address_key" ON "UserWallet"("address");

-- AddForeignKey
ALTER TABLE "UserWallet" ADD CONSTRAINT "UserWallet_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

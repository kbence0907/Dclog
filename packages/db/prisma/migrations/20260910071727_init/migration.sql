-- CreateTable
CREATE TABLE `Guild` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LogChannel` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `lastBackfilledMessageId` VARCHAR(191) NULL,
    `backfillComplete` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LogChannel_guildId_idx`(`guildId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LogEntry` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `messageId` VARCHAR(191) NOT NULL,
    `embedIndex` INTEGER NOT NULL DEFAULT 0,
    `channelId` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(191) NOT NULL,
    `webhookName` VARCHAR(191) NULL,
    `title` VARCHAR(512) NULL,
    `description` TEXT NULL,
    `color` INTEGER NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `rawJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LogEntry_channelId_timestamp_idx`(`channelId`, `timestamp`),
    INDEX `LogEntry_guildId_timestamp_idx`(`guildId`, `timestamp`),
    UNIQUE INDEX `LogEntry_messageId_embedIndex_key`(`messageId`, `embedIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LogField` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `logEntryId` BIGINT NOT NULL,
    `name` VARCHAR(256) NOT NULL,
    `value` TEXT NOT NULL,
    `inline` BOOLEAN NOT NULL DEFAULT false,

    INDEX `LogField_logEntryId_idx`(`logEntryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LogIdentifier` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `logEntryId` BIGINT NOT NULL,
    `guildId` VARCHAR(191) NOT NULL,
    `type` ENUM('DISCORD', 'STEAM', 'LICENSE', 'LICENSE2', 'XBL', 'LIVE', 'FIVEM', 'IP', 'CITIZENID', 'SERVER_ID', 'CHARACTER_NAME') NOT NULL,
    `value` VARCHAR(191) NOT NULL,

    INDEX `LogIdentifier_guildId_value_idx`(`guildId`, `value`),
    INDEX `LogIdentifier_guildId_type_value_idx`(`guildId`, `type`, `value`),
    INDEX `LogIdentifier_logEntryId_idx`(`logEntryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LogChannel` ADD CONSTRAINT `LogChannel_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogEntry` ADD CONSTRAINT `LogEntry_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `LogChannel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogField` ADD CONSTRAINT `LogField_logEntryId_fkey` FOREIGN KEY (`logEntryId`) REFERENCES `LogEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogIdentifier` ADD CONSTRAINT `LogIdentifier_logEntryId_fkey` FOREIGN KEY (`logEntryId`) REFERENCES `LogEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

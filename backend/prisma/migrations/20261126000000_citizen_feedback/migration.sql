-- CreateTable
CREATE TABLE `CitizenFeedback` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(24) NOT NULL,
    `fullName` VARCHAR(120) NOT NULL,
    `phoneNormalized` VARCHAR(20) NOT NULL,
    `phoneVerificationStatus` ENUM('UNVERIFIED') NOT NULL DEFAULT 'UNVERIFIED',
    `target` ENUM('CENTER', 'MINI_APP', 'OTHER') NOT NULL DEFAULT 'CENTER',
    `content` TEXT NOT NULL,
    `status` ENUM('NEW', 'IN_PROGRESS', 'RESOLVED') NOT NULL DEFAULT 'NEW',
    `assignedToId` VARCHAR(191) NULL,
    `resolutionSummary` TEXT NULL,
    `resolvedAt` DATETIME(3) NULL,
    `idempotencyKey` VARCHAR(128) NULL,
    `payloadHash` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CitizenFeedback_code_key`(`code`),
    UNIQUE INDEX `CitizenFeedback_idempotencyKey_key`(`idempotencyKey`),
    INDEX `CitizenFeedback_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `CitizenFeedback_target_createdAt_idx`(`target`, `createdAt`),
    INDEX `CitizenFeedback_assignedToId_status_idx`(`assignedToId`, `status`),
    INDEX `CitizenFeedback_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CitizenFeedbackHistory` (
    `id` VARCHAR(191) NOT NULL,
    `feedbackId` VARCHAR(191) NOT NULL,
    `actorAdminId` VARCHAR(191) NULL,
    `action` ENUM('CREATED', 'ASSIGNED', 'UNASSIGNED', 'STATUS_CHANGED', 'REOPENED', 'NOTE_ADDED') NOT NULL,
    `fromStatus` ENUM('NEW', 'IN_PROGRESS', 'RESOLVED') NULL,
    `toStatus` ENUM('NEW', 'IN_PROGRESS', 'RESOLVED') NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CitizenFeedbackHistory_feedbackId_createdAt_idx`(`feedbackId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CitizenFeedback` ADD CONSTRAINT `CitizenFeedback_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `Admin`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CitizenFeedbackHistory` ADD CONSTRAINT `CitizenFeedbackHistory_feedbackId_fkey` FOREIGN KEY (`feedbackId`) REFERENCES `CitizenFeedback`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CitizenFeedbackHistory` ADD CONSTRAINT `CitizenFeedbackHistory_actorAdminId_fkey` FOREIGN KEY (`actorAdminId`) REFERENCES `Admin`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

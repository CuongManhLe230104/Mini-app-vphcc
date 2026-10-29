-- AlterTable
ALTER TABLE `Admin` MODIFY `role` ENUM('SUPER_ADMIN', 'EDITOR', 'REVIEWER', 'HANDLER', 'COUNTER_STAFF') NOT NULL;

-- CreateTable
CREATE TABLE `ServiceCounter` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(8) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `ticketEnabled` BOOLEAN NOT NULL DEFAULT false,
    `appointmentEnabled` BOOLEAN NOT NULL DEFAULT false,
    `dailyCapacity` INTEGER NULL,
    `ticketQuota` INTEGER NULL,
    `appointmentQuota` INTEGER NULL,
    `walkInQuota` INTEGER NULL,
    `slotMinutes` INTEGER NULL,
    `slotCapacity` INTEGER NULL,
    `bookingMinLeadMinutes` INTEGER NULL,
    `bookingMaxDaysAhead` INTEGER NULL,
    `maxActiveTicketsPerCitizen` INTEGER NULL,
    `maxActiveAppointmentsPerCitizen` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ServiceCounter_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CounterField` (
    `id` VARCHAR(191) NOT NULL,
    `counterId` VARCHAR(191) NOT NULL,
    `fieldId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CounterField_fieldId_key`(`fieldId`),
    INDEX `CounterField_counterId_idx`(`counterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CounterSchedule` (
    `id` VARCHAR(191) NOT NULL,
    `counterId` VARCHAR(191) NOT NULL,
    `weekday` INTEGER NOT NULL,
    `startTime` VARCHAR(5) NOT NULL,
    `endTime` VARCHAR(5) NOT NULL,

    UNIQUE INDEX `CounterSchedule_counterId_weekday_startTime_key`(`counterId`, `weekday`, `startTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CounterClosure` (
    `id` VARCHAR(191) NOT NULL,
    `counterId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `note` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CounterClosure_counterId_date_key`(`counterId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CounterStaff` (
    `id` VARCHAR(191) NOT NULL,
    `counterId` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CounterStaff_counterId_adminId_key`(`counterId`, `adminId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CounterDay` (
    `id` VARCHAR(191) NOT NULL,
    `counterId` VARCHAR(191) NOT NULL,
    `serviceDate` DATE NOT NULL,
    `lastSequence` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CounterDay_counterId_serviceDate_key`(`counterId`, `serviceDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QueueTicket` (
    `id` VARCHAR(191) NOT NULL,
    `counterId` VARCHAR(191) NOT NULL,
    `serviceDate` DATE NOT NULL,
    `sequence` INTEGER NOT NULL,
    `displayNumber` VARCHAR(16) NOT NULL,
    `source` ENUM('ONLINE', 'WALK_IN', 'APPOINTMENT', 'TRANSFER') NOT NULL,
    `status` ENUM('WAITING', 'CALLING', 'SERVING', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'TRANSFERRED') NOT NULL DEFAULT 'WAITING',
    `lookupCode` VARCHAR(16) NOT NULL,
    `idempotencyKey` VARCHAR(160) NULL,
    `citizenId` VARCHAR(191) NULL,
    `fieldId` VARCHAR(191) NULL,
    `procedureId` VARCHAR(191) NULL,
    `appointmentId` VARCHAR(191) NULL,
    `transferredFromId` VARCHAR(191) NULL,
    `callCount` INTEGER NOT NULL DEFAULT 0,
    `calledAt` DATETIME(3) NULL,
    `servingAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `handledByAdminId` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `QueueTicket_lookupCode_key`(`lookupCode`),
    UNIQUE INDEX `QueueTicket_idempotencyKey_key`(`idempotencyKey`),
    INDEX `QueueTicket_counterId_serviceDate_status_sequence_idx`(`counterId`, `serviceDate`, `status`, `sequence`),
    INDEX `QueueTicket_citizenId_serviceDate_idx`(`citizenId`, `serviceDate`),
    INDEX `QueueTicket_appointmentId_idx`(`appointmentId`),
    UNIQUE INDEX `QueueTicket_counterId_serviceDate_sequence_key`(`counterId`, `serviceDate`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Appointment` (
    `id` VARCHAR(191) NOT NULL,
    `counterId` VARCHAR(191) NOT NULL,
    `serviceDate` DATE NOT NULL,
    `slotStart` VARCHAR(5) NOT NULL,
    `slotSeat` INTEGER NULL,
    `status` ENUM('CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW') NOT NULL DEFAULT 'CONFIRMED',
    `lookupCode` VARCHAR(16) NOT NULL,
    `idempotencyKey` VARCHAR(160) NULL,
    `citizenId` VARCHAR(191) NOT NULL,
    `fieldId` VARCHAR(191) NOT NULL,
    `procedureId` VARCHAR(191) NULL,
    `contactName` VARCHAR(100) NOT NULL,
    `contactPhone` VARCHAR(20) NULL,
    `rescheduledFromId` VARCHAR(191) NULL,
    `cancelReason` VARCHAR(200) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Appointment_lookupCode_key`(`lookupCode`),
    UNIQUE INDEX `Appointment_idempotencyKey_key`(`idempotencyKey`),
    INDEX `Appointment_counterId_serviceDate_status_idx`(`counterId`, `serviceDate`, `status`),
    INDEX `Appointment_citizenId_status_idx`(`citizenId`, `status`),
    UNIQUE INDEX `Appointment_counterId_serviceDate_slotStart_slotSeat_key`(`counterId`, `serviceDate`, `slotStart`, `slotSeat`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QueueEvent` (
    `id` VARCHAR(191) NOT NULL,
    `counterId` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NULL,
    `appointmentId` VARCHAR(191) NULL,
    `type` VARCHAR(32) NOT NULL,
    `actorType` VARCHAR(16) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `detail` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QueueEvent_counterId_createdAt_idx`(`counterId`, `createdAt`),
    INDEX `QueueEvent_ticketId_idx`(`ticketId`),
    INDEX `QueueEvent_appointmentId_idx`(`appointmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CounterField` ADD CONSTRAINT `CounterField_counterId_fkey` FOREIGN KEY (`counterId`) REFERENCES `ServiceCounter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CounterField` ADD CONSTRAINT `CounterField_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `ProcedureField`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CounterSchedule` ADD CONSTRAINT `CounterSchedule_counterId_fkey` FOREIGN KEY (`counterId`) REFERENCES `ServiceCounter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CounterClosure` ADD CONSTRAINT `CounterClosure_counterId_fkey` FOREIGN KEY (`counterId`) REFERENCES `ServiceCounter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CounterStaff` ADD CONSTRAINT `CounterStaff_counterId_fkey` FOREIGN KEY (`counterId`) REFERENCES `ServiceCounter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CounterStaff` ADD CONSTRAINT `CounterStaff_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `Admin`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CounterDay` ADD CONSTRAINT `CounterDay_counterId_fkey` FOREIGN KEY (`counterId`) REFERENCES `ServiceCounter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QueueTicket` ADD CONSTRAINT `QueueTicket_counterId_fkey` FOREIGN KEY (`counterId`) REFERENCES `ServiceCounter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QueueTicket` ADD CONSTRAINT `QueueTicket_citizenId_fkey` FOREIGN KEY (`citizenId`) REFERENCES `Citizen`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QueueTicket` ADD CONSTRAINT `QueueTicket_procedureId_fkey` FOREIGN KEY (`procedureId`) REFERENCES `Procedure`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QueueTicket` ADD CONSTRAINT `QueueTicket_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_counterId_fkey` FOREIGN KEY (`counterId`) REFERENCES `ServiceCounter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_citizenId_fkey` FOREIGN KEY (`citizenId`) REFERENCES `Citizen`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_procedureId_fkey` FOREIGN KEY (`procedureId`) REFERENCES `Procedure`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QueueEvent` ADD CONSTRAINT `QueueEvent_counterId_fkey` FOREIGN KEY (`counterId`) REFERENCES `ServiceCounter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


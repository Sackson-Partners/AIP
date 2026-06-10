-- Add new notification types for contact request workflow
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONTACT_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONTACT_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONTACT_REJECTED';

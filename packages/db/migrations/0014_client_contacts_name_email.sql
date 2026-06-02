ALTER TABLE "client_contacts" ADD COLUMN "name" TEXT;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD COLUMN "email" TEXT;--> statement-breakpoint
UPDATE client_contacts cc
  SET name  = COALESCE(u.name, ''),
      email = u.email
  FROM users u
  WHERE cc.user_id = u.id
    AND (cc.name IS NULL OR cc.email IS NULL);--> statement-breakpoint
UPDATE client_contacts SET name = '', email = '' WHERE name IS NULL OR email IS NULL;--> statement-breakpoint
ALTER TABLE "client_contacts" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "client_contacts" ALTER COLUMN "email" SET NOT NULL;

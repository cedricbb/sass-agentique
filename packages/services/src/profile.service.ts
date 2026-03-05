import { eq } from "drizzle-orm";
import { db, users } from "@saas/db";

export async function updateUserProfile(
  userId: string,
  data: { name: string; bio?: string; location?: string; website?: string },
): Promise<void> {
  const name = data.name.trim() || null;
  const bio = data.bio?.trim() || null;
  const location = data.location?.trim() || null;
  const website = data.website?.trim() || null;

  await db
    .update(users)
    .set({ name, bio, location, website, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function updateUserSocialLinks(
  userId: string,
  data: { github?: string; linkedin?: string; twitter?: string; instagram?: string },
): Promise<void> {
  const socialLinks = {
    github: data.github?.trim() || undefined,
    linkedin: data.linkedin?.trim() || undefined,
    twitter: data.twitter?.trim() || undefined,
    instagram: data.instagram?.trim() || undefined,
  };

  await db
    .update(users)
    .set({ socialLinks, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

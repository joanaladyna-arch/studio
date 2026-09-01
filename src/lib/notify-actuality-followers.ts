import type { User } from "firebase/auth";

/**
 * Petit client pour /api/admin/notify-actuality-followers, appelé depuis
 * les trois écrans qui publient une actualité (admin-actualites-queue,
 * pending-actualites-manager, actualites-manager). Toujours best-effort :
 * un échec de notification ne doit jamais faire échouer la publication
 * elle-même, donc on avale toute erreur ici.
 */
export async function notifyActualityFollowers(
  user: User | null | undefined,
  params: { authorSlug?: string; publisherName?: string; title?: string; link?: string }
) {
  if (!user) return;
  if (!params.authorSlug && !params.publisherName) return;
  try {
    const idToken = await user.getIdToken();
    await fetch("/api/admin/notify-actuality-followers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.error("Notify Actuality Followers Error:", err);
  }
}

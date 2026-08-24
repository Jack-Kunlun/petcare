const DEFAULT_AVATARS = ["/static/main/profile-cat.png", "/static/main/profile-dog.png"] as const;

export function getDefaultAvatar(userId: string): string {
  const hash = Array.from(userId).reduce((value, character) => value + character.charCodeAt(0), 0);

  return DEFAULT_AVATARS[hash % DEFAULT_AVATARS.length];
}

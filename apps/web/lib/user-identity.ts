import { nanoid } from 'nanoid';

// CLIENT ONLY — never import this in server code
const USER_ID_KEY = 'agentic_crawler_user_id';

export function getUserId(): string {
  if (typeof window === 'undefined') {
    throw new Error('getUserId() must only be called on the client');
  }
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = `user_${nanoid(12)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

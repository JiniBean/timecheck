export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export function validateUsername(username: string): string | null {
  if (/\s/.test(username)) {
    return "아이디에는 공백을 사용할 수 없습니다.";
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return `아이디는 ${USERNAME_MAX_LENGTH}자 이하여야 합니다.`;
  }
  if (!USERNAME_PATTERN.test(username)) {
    return "아이디는 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.";
  }
  if (username.length < USERNAME_MIN_LENGTH) {
    return `아이디는 ${USERNAME_MIN_LENGTH}자 이상이어야 합니다.`;
  }
  return null;
}

import axios from "axios";
import { ElMessage } from "element-plus";

export const DEFAULT_API_ERROR_MESSAGE =
  "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

export function getApiErrorMessage(error: unknown, fallback = DEFAULT_API_ERROR_MESSAGE): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
    if (error.code === "ECONNABORTED") {
      return "서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.";
    }
    if (!error.response) {
      return "네트워크 연결을 확인해 주세요.";
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
}

export function showApiError(error: unknown, fallback?: string): void {
  ElMessage.error(getApiErrorMessage(error, fallback));
}

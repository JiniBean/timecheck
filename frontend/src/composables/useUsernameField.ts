import { computed, onUnmounted, ref, watch, type Ref } from "vue";
import { fetchUsernameOk } from "../api/auth";
import { validateUsername } from "../utils/usernameValidation";

export interface UsernameFieldOpts {
  except?: Ref<string | undefined>;
  debounceMs?: number;
}

export function useUsernameField(username: Ref<string>, opts: UsernameFieldOpts = {}) {
  const touched = ref(false);
  const taken = ref<string | null>(null);
  const busy = ref(false);
  const debounceMs = opts.debounceMs ?? 300;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;

  function cancelCheck() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    seq += 1;
    taken.value = null;
    busy.value = false;
  }

  watch(username, (value) => {
    cancelCheck();

    const name = value.trim();
    if (!name || validateUsername(name)) {
      return;
    }

    const except = opts.except?.value?.trim();
    if (except && name === except) {
      return;
    }

    timer = setTimeout(async () => {
      const req = ++seq;
      busy.value = true;
      try {
        const ok = await fetchUsernameOk(name);
        if (req !== seq) {
          return;
        }
        taken.value = ok ? null : "이미 사용 중인 아이디입니다.";
      } catch {
        if (req === seq) {
          taken.value = "아이디 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.";
        }
      } finally {
        if (req === seq) {
          busy.value = false;
        }
      }
    }, debounceMs);
  });

  const usernameError = computed(() => {
    const value = username.value;
    if (!value.trim()) {
      return touched.value ? "아이디를 입력해 주세요." : null;
    }
    const formatError = validateUsername(value);
    if (formatError) {
      return formatError;
    }
    return taken.value;
  });

  function touch() {
    touched.value = true;
  }

  function reset() {
    touched.value = false;
    cancelCheck();
  }

  onUnmounted(cancelCheck);

  return {
    usernameError,
    busy,
    touch,
    reset
  };
}

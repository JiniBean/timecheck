import { onBeforeUnmount, onMounted, type Ref } from "vue";

type DialogKeyboardOptions = {
  open: Ref<boolean>;
  onClose: () => void;
  onSubmit?: () => void;
  disabled?: Ref<boolean>;
  focusRef?: Ref<HTMLElement | null>;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  return target.isContentEditable;
}

export function useDialogKeyboard(options: DialogKeyboardOptions) {
  function handleKeydown(event: KeyboardEvent) {
    if (!options.open.value) {
      return;
    }
    if (options.disabled?.value) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      options.onClose();
      return;
    }

    if (event.key === "Enter" && options.onSubmit && !isEditableTarget(event.target)) {
      event.preventDefault();
      options.onSubmit();
    }
  }

  onMounted(() => {
    window.addEventListener("keydown", handleKeydown);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", handleKeydown);
  });

  return {
    handleKeydown
  };
}

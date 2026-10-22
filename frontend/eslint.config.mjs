import pluginVue from "eslint-plugin-vue";
import { withVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import prettier from "eslint-config-prettier";

export default withVueTs(
  {
    ignores: ["dist", "dev-dist", "node_modules", "public", "scripts", "eslint-report.json"],
  },
  pluginVue.configs["flat/recommended"],
  vueTsConfigs.recommended,
  {
    rules: {
      "vue/multi-word-component-names": "off",

      // 템플릿 레이아웃은 Prettier가 담당. ESLint 포맷 규칙은 off.
      "vue/singleline-html-element-content-newline": "off",
      "vue/max-attributes-per-line": "off",
      "vue/html-indent": "off",
      "vue/html-self-closing": "off",

      // tsconfig의 noUnusedLocals/noUnusedParameters와 중복
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/consistent-type-imports": "error",

      // null·undefined를 함께 판정하는 `== null` 관용구는 의도된 사용이므로 예외
      eqeqeq: ["error", "always", { null: "ignore" }],

      // console.info는 DEV 전용 로깅 파사드(src/utils/bootLog.ts)에서 사용
      "no-console": ["warn", { allow: ["info", "warn", "error"] }],
    },
  },
  prettier,
);

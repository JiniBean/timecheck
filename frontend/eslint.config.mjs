import pluginVue from "eslint-plugin-vue";
import { withVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";

export default withVueTs(
  { ignores: ["dist", "dev-dist", "node_modules", "public", "scripts", "eslint-report.json"] },
  pluginVue.configs["flat/recommended"],
  vueTsConfigs.recommended,
  {
    rules: {
      "vue/multi-word-component-names": "off",

      // 템플릿 레이아웃 규칙: 포매터를 쓰지 않는 프로젝트이며 기존 템플릿 스타일과
      // 충돌해 622건이 발생하므로 off. 도입하려면 별도 포매터 작업으로 진행할 것
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
      "no-console": ["warn", { allow: ["info", "warn", "error"] }]
    }
  }
);

import { extendConfig } from "pkgroll";
import { string } from "rollup-plugin-string";

export default extendConfig({
  plugins: [
    string({ include: "**/*.avsc" }), // This will import .avsc files as raw text
  ],
});

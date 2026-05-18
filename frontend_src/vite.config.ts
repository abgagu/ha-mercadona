import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
	build: {
		lib: {
			entry: "src/mercadona-panel.ts",
			formats: ["es"],
			fileName: () => "mercadona-panel.js",
		},
		outDir: resolve(__dirname, "../custom_components/mercadona/frontend"),
		emptyOutDir: true,
		minify: true,
		sourcemap: false,
		rollupOptions: {
			output: {
				inlineDynamicImports: true,
			},
		},
	},
});

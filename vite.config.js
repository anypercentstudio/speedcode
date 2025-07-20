import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
	build: {
		outDir: "dist",
		emptyOutDir: true,
		rollupOptions: {
			input: {
				popup: resolve(__dirname, "src/popup.html"),
			},
			output: {
				entryFileNames: "[name].js",
				assetFileNames: (assetInfo) => {
					if (assetInfo.name.endsWith(".css")) {
						return "[name].css";
					}
					return "[name].[ext]";
				},
				chunkFileNames: "[name].js",
			},
		},
		//handle ES modules
		target: "esnext",
		minify: "esbuild",
	},
	plugins: [
		{
			name: "move-html",
			writeBundle() {
				console.log(
					"Build complete - HTML will be moved by post-build script"
				);
			},
		},
	],
	server: {
		port: 3000,
		strictPort: true,
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "src"),
		},
	},
	// define env whenever needed
	define: {
		__VERSION__: JSON.stringify(process.env.npm_package_version),
	},
});

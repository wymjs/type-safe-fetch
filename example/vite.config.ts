import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [],
	publicDir: false,
	server: {
		port: 9487,
		proxy: {
			'/v1': 'https://api.thecatapi.com',
		},
	},
})

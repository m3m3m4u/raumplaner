/** @type {import('next').NextConfig} */
const nextConfig = {
	async headers() {
		return [
			{
				source: '/:path*',
				headers: [
					// Erlaubt Einbettung in iframes überall. Für Produktion ggf. Domains einschränken.
					{ key: 'X-Frame-Options', value: 'ALLOWALL' },
					// Lockerer CSP frame-ancestors; bei Bedarf auf bestimmte Domains setzen: frame-ancestors https://example.com https://andere.de;
					{ key: 'Content-Security-Policy', value: "frame-ancestors *;" }
				]
			}
		];
	}
};

export default nextConfig;

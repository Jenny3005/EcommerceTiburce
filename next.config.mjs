/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'example.com',
        port: '',
        pathname: '/chemin/vers/vos/images/**',
      },
      { // Ajoutez ce nouveau pattern pour placehold.co
        protocol: 'https', // placehold.co utilise HTTPS
        hostname: 'placehold.co',
        port: '',
        pathname: '/**', // Autorise n'importe quel chemin sur ce hostname
      },
      { // Ajoutez ce nouveau pattern pour googleusercontent.com si nécessaire (l'erreur précédente était résolue par placehold.co)
        protocol: 'https', // Assurez-vous que c'est HTTPS si c'est le cas pour vos images Google
        hostname: 'googleusercontent.com',
        port: '',
        pathname: '/**', // Autorise n'importe quel chemin sur ce hostname
      },
    ],
  },
};

export default nextConfig;

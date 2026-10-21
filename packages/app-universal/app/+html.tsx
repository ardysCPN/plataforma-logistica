import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>DOMY - Envíos y Movilidad</title>
        <meta name="description" content="Tu plataforma de logística, domicilios y transporte al precio justo acordado en tiempo real." />

        {/* OpenGraph & Redes Sociales (WhatsApp, Facebook, Messenger) */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="DOMY" />
        <meta property="og:title" content="DOMY - Envíos y Movilidad Urbana" />
        <meta property="og:description" content="Tu plataforma de logística, domicilios y transporte al precio justo acordado en tiempo real. Rastrea tu viaje en vivo." />
        <meta property="og:image" content="/icon-512.png" />
        <meta property="og:image:secure_url" content="/icon-512.png" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="DOMY - Envíos y Movilidad Urbana" />
        <meta name="twitter:description" content="Tu plataforma de logística, domicilios y transporte al precio justo acordado en tiempo real." />
        <meta name="twitter:image" content="/icon-512.png" />

        {/* PWA & iOS Safari Home Screen Meta Tags */}
        <meta name="theme-color" content="#FF6B00" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DOMY" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.png" />

        <ScrollViewStyleReset />

        {/* Script de Registro de Service Worker PWA y captura de instalación */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('DOMY ServiceWorker activo');
                  }).catch(function(err) {
                    console.warn('DOMY ServiceWorker no registrado:', err);
                  });
                });
              }

              window.__domyInstallPrompt = null;
              window.addEventListener('beforeinstallprompt', function(e) {
                e.preventDefault();
                window.__domyInstallPrompt = e;
                window.dispatchEvent(new CustomEvent('domy:can-install'));
              });
              window.addEventListener('appinstalled', function() {
                window.__domyInstallPrompt = null;
                window.dispatchEvent(new CustomEvent('domy:installed'));
              });
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

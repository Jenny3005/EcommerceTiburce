'use client';

import React from 'react';
import Sidebar from '@/components/seller/Sidebar';

const Layout = ({ children }) => {
  return (
    // Le conteneur principal prend toute la hauteur de l'écran et utilise flexbox
    // pour organiser la sidebar et le contenu.
    // 'h-screen' assure que le conteneur ne dépasse pas la hauteur de la fenêtre,
    // ce qui permet au 'main' de défiler indépendamment.
    <div className="h-screen w-full flex">
      {/*
        Sidebar :
        - La classe "h-full" assure qu'elle prend 100% de la hauteur de son parent (le div flex).
        - Elle ne défilera pas car son parent (le div flex) ne défile pas.
      */}
      <Sidebar />

      {/*
        Contenu principal :
        - "flex-1" lui permet de prendre tout l'espace restant horizontalement.
        - "overflow-y-auto" rend cette zone défilable verticalement si son contenu dépasse.
        - Le padding et la couleur de fond sont conservés.
      */}
      <main className="flex-1 p-6 bg-zinc-50 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export default Layout;

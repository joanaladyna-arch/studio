
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useUser } from "@/firebase";
import { ADMIN_EMAILS } from "@/lib/utils";

/**
 * Contexte global du "mode administrateur".
 *
 * - `isAdmin` : vrai uniquement pour les emails autorisés. C'est la
 *   permission réelle, immuable côté client.
 * - `adminMode` : l'interrupteur ON/OFF. Quand il est ON, chaque page
 *   affiche ses contrôles d'édition intégrés (façon back-office) ; quand
 *   il est OFF, l'admin voit l'app exactement comme une lectrice normale,
 *   ce qui permet de vérifier le rendu réel sans se déconnecter.
 *
 * L'état de l'interrupteur est conservé pour la session (sessionStorage),
 * pour ne pas avoir à le réactiver à chaque navigation. Il se réinitialise
 * à OFF à la prochaine ouverture de l'app — choix volontaire : on entre
 * toujours en "vue lectrice" par défaut.
 *
 * IMPORTANT : ce mode ne fait qu'AFFICHER ou MASQUER des contrôles. Il ne
 * donne aucun pouvoir supplémentaire en lui-même — la vraie sécurité reste
 * portée par les règles Firestore (écriture réservée à l'admin). Activer
 * l'interrupteur ne permet donc jamais d'écraser ou de perdre des données.
 */

type AdminModeContextValue = {
  isAdmin: boolean;
  adminMode: boolean;
  setAdminMode: (on: boolean) => void;
};

const AdminModeContext = createContext<AdminModeContextValue>({
  isAdmin: false,
  adminMode: false,
  setAdminMode: () => {},
});

export function AdminModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const isAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email));
  const [adminMode, setAdminModeState] = useState(false);

  // Restaure l'état de l'interrupteur pour la session en cours.
  useEffect(() => {
    if (!isAdmin) {
      setAdminModeState(false);
      return;
    }
    try {
      setAdminModeState(sessionStorage.getItem("plume-admin-mode") === "on");
    } catch {
      // sessionStorage indisponible (mode privé strict) : on reste à OFF.
    }
  }, [isAdmin]);

  const setAdminMode = (on: boolean) => {
    setAdminModeState(on);
    try {
      sessionStorage.setItem("plume-admin-mode", on ? "on" : "off");
    } catch {
      // Ignoré : l'état reste au moins valable en mémoire pour la session.
    }
  };

  return (
    <AdminModeContext.Provider value={{ isAdmin, adminMode: isAdmin && adminMode, setAdminMode }}>
      {children}
    </AdminModeContext.Provider>
  );
}

export function useAdminMode() {
  return useContext(AdminModeContext);
}

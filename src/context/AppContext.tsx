import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Configuration Supabase (Vérifie tes variables d'environnement Vercel)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Member {
  id: string;
  name: string;
  pin?: string;
  isRegistered: boolean;
  role?: string;
}

interface AppContextType {
  members: Member[];
  currentMember: Member | null;
  registerMember: (name: string, pin: string) => Promise<{ success: boolean; message: string }>;
  loginMember: (name: string, pin: string) => Promise<{ success: boolean; message: string }>;
  loginAdmin: (role: string, pin: string) => { success: boolean; message: string };
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [currentMember, setCurrentMember] = useState<Member | null>(null);

  // Charger la liste des membres depuis Supabase
  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase.from('members').select('*');
      if (error) throw error;
      if (data) {
        const formatted = data.map((m: any) => ({
          id: m.id,
          name: m.name,
          pin: m.pin,
          isRegistered: m.is_registered ?? m.isRegistered ?? false,
          role: m.role
        }));
        setMembers(formatted);
      }
    } catch (err) {
      console.error("Erreur de chargement des membres:", err);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // ACTIVATION ET CRÉATION DE PIN (INSCRIPTION)
  const registerMember = async (name: string, pin: string) => {
    try {
      const cleanName = name.trim().toLowerCase();

      if (!members || members.length === 0) {
        return {
          success: false,
          message: "La liste des membres n'est pas encore chargée. Réessayez dans un instant."
        };
      }

      // Recherche du membre insensible à la casse et aux espaces
      const targetMember = members.find(
        m => m.name.trim().toLowerCase() === cleanName
      );

      if (!targetMember) {
        return {
          success: false,
          message: `Le prénom "${name}" ne figure pas dans la liste des membres.`
        };
      }

      if (targetMember.isRegistered) {
        return {
          success: false,
          message: "Ce compte est déjà activé. Rendez-vous dans l'onglet CONNEXION."
        };
      }

      // Mise à jour Supabase
      const { error } = await supabase
        .from('members')
        .update({ 
          pin: pin, 
          is_registered: true 
        })
        .eq('id', targetMember.id);

      if (error) {
        console.error("Erreur Supabase Update:", error);
        return {
          success: false,
          message: `Erreur BDD: ${error.message}`
        };
      }

      // Mettre à jour le state local et recharger
      await fetchMembers();

      return {
        success: true,
        message: `Compte activé avec succès ! Tu peux maintenant te connecter.`
      };

    } catch (err: any) {
      console.error("Erreur inattendue:", err);
      return {
        success: false,
        message: err?.message || "Erreur réseau lors de l'enregistrement."
      };
    }
  };

  // CONNEXION MEMBRE
  const loginMember = async (name: string, pin: string) => {
    try {
      const cleanName = name.trim().toLowerCase();
      const targetMember = members.find(
        m => m.name.trim().toLowerCase() === cleanName
      );

      if (!targetMember) {
        return { success: false, message: "Prénom non trouvé." };
      }

      if (!targetMember.isRegistered) {
        return { success: false, message: "Compte non activé. Passez par l'onglet Inscription." };
      }

      if (targetMember.pin !== pin) {
        return { success: false, message: "Code PIN incorrect." };
      }

      setCurrentMember(targetMember);
      return { success: true, message: "Connexion réussie !" };
    } catch (err) {
      return { success: false, message: "Erreur de connexion." };
    }
  };

  // CONNEXION ADMIN
  const loginAdmin = (role: string, pin: string) => {
    if (pin === "1234") { // Remplace par ton code Admin
      setCurrentMember({
        id: 'admin-id',
        name: role || 'Administrateur',
        isRegistered: true,
        role: 'ADMIN'
      });
      return { success: true, message: "Accès Admin accordé !" };
    }
    return { success: false, message: "Identifiant ou code Admin incorrect." };
  };

  const logout = () => {
    setCurrentMember(null);
  };

  return (
    <AppContext.Provider
      value={{
        members,
        currentMember,
        registerMember,
        loginMember,
        loginAdmin,
        logout
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp doit être utilisé dans un AppProvider");
  }
  return context;
};

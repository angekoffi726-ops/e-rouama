import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Member {
  id: string;
  name: string;
  nickname?: string;
  pin?: string;
  isRegistered: boolean;
  role?: string;
}

// LISTE OFFICIELLE DES 13 MEMBRES
const DEFAULT_MEMBERS: Member[] = [
  { id: '1', name: 'Wilfried', nickname: 'Capelo', isRegistered: false },
  { id: '2', name: 'Ortiniel', nickname: 'Esprit', isRegistered: false },
  { id: '3', name: 'Josiane', nickname: 'La Madre', isRegistered: false },
  { id: '4', name: 'Marie', nickname: 'Souka', isRegistered: false },
  { id: '5', name: 'Sylas', nickname: 'Sylas', isRegistered: false },
  { id: '6', name: 'Désiré', nickname: 'Typo', isRegistered: false },
  { id: '7', name: 'Ulrich', nickname: 'Le Surl', isRegistered: false },
  { id: '8', name: 'Émile', nickname: 'Dojon', isRegistered: false },
  { id: '9', name: 'Cyprien', nickname: 'Nade', isRegistered: false },
  { id: '10', name: 'Gilbert', nickname: 'Doyen', isRegistered: false },
  { id: '11', name: 'Habib', nickname: 'Nayou', isRegistered: false },
  { id: '12', name: 'Léger', nickname: 'Clemso', isRegistered: false },
  { id: '13', name: 'Esther', nickname: 'Nounours', isRegistered: false },
];

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
  const [members, setMembers] = useState<Member[]>(DEFAULT_MEMBERS);
  const [currentMember, setCurrentMember] = useState<Member | null>(null);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase.from('members').select('*');
      if (!error && data && data.length > 0) {
        const formatted = data.map((m: any) => ({
          id: m.id,
          name: m.name,
          nickname: m.nickname,
          pin: m.pin,
          isRegistered: m.is_registered ?? m.isRegistered ?? false,
          role: m.role
        }));
        setMembers(formatted);
      }
    } catch (err) {
      console.error("Erreur BDD, fallback local:", err);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // Fonction utilitaire pour chercher par Prénom OU Surnom
  const findMemberMatch = (input: string, list: Member[]) => {
    const clean = input.trim().toLowerCase();
    return list.find(m => 
      m.name.trim().toLowerCase() === clean || 
      (m.nickname && m.nickname.trim().toLowerCase() === clean)
    );
  };

  const registerMember = async (name: string, pin: string) => {
    try {
      const activeList = (members && members.length > 0) ? members : DEFAULT_MEMBERS;
      const targetMember = findMemberMatch(name, activeList);

      if (!targetMember) {
        return {
          success: false,
          message: `"${name}" ne figure pas dans la liste des 13 membres.`
        };
      }

      if (targetMember.isRegistered) {
        return {
          success: false,
          message: "Ce compte est déjà activé. Rendez-vous dans l'onglet CONNEXION."
        };
      }

      // Supabase Update
      await supabase
        .from('members')
        .update({ pin: pin, is_registered: true })
        .eq('id', targetMember.id);

      // Mettre à jour l'état local immédiatement
      setMembers(prev =>
        prev.map(m =>
          m.id === targetMember.id ? { ...m, pin, isRegistered: true } : m
        )
      );

      return {
        success: true,
        message: `Compte activé avec succès pour ${targetMember.name} !`
      };

    } catch (err: any) {
      return {
        success: false,
        message: "Erreur lors de l'activation du compte."
      };
    }
  };

  const loginMember = async (name: string, pin: string) => {
    const activeList = (members && members.length > 0) ? members : DEFAULT_MEMBERS;
    const targetMember = findMemberMatch(name, activeList);

    if (!targetMember) {
      return { success: false, message: "Prénom ou surnom non trouvé." };
    }

    if (!targetMember.isRegistered) {
      return { success: false, message: "Compte non activé. Passez par l'onglet Inscription." };
    }

    if (targetMember.pin !== pin) {
      return { success: false, message: "Code PIN incorrect." };
    }

    setCurrentMember(targetMember);
    return { success: true, message: "Connexion réussie !" };
  };

  const loginAdmin = (role: string, pin: string) => {
    if (pin === "1234") {
      setCurrentMember({
        id: 'admin-id',
        name: role || 'Administrateur',
        isRegistered: true,
        role: 'ADMIN'
      });
      return { success: true, message: "Accès Admin accordé !" };
    }
    return { success: false, message: "Code Admin incorrect." };
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

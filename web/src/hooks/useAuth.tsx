import React, { useState, useEffect, createContext, useContext } from 'react';
import { User, DEMO_USERS } from '../types/auth';
import { ApiService } from '../services/api';

interface AuthContextType {
  currentUser: User;
  allUsers: User[];
  switchUser: (userId: string) => void;
  canReviewChallenges: boolean;
  canManageQuorum: boolean;
  isRevokedFromCase: (caseId: string) => boolean;
  resetDemoState: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(() => {
    return DEMO_USERS[0]; // Sarah Jenkins (HR Reviewer)
  });

  useEffect(() => {
    ApiService.setUser(currentUser);
  }, [currentUser]);

  const switchUser = (userId: string) => {
    const selected = DEMO_USERS.find(u => u.id === userId);
    if (selected) {
      setCurrentUser(selected);
      ApiService.setUser(selected);
    }
  };

  const resetDemoState = () => {
    ApiService.resetDemoState();
    // Default back to Sarah Jenkins
    setCurrentUser(DEMO_USERS[0]);
    ApiService.setUser(DEMO_USERS[0]);
  };

  const canReviewChallenges = currentUser.role === 'independent_reviewer' || currentUser.role === 'administrator';
  const canManageQuorum = currentUser.role === 'assigned_investigator' || currentUser.role === 'administrator';

  const isRevokedFromCase = (_caseId: string) => {
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers: DEMO_USERS,
        switchUser,
        canReviewChallenges,
        canManageQuorum,
        isRevokedFromCase,
        resetDemoState
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { UserDto, UserRole, LoginRequestDto } from '../types';
import { authApi } from '../api/authApi';
import { mockUsers } from '../api/mockData';
import { USE_MOCK_API } from '../api/client';

interface AuthState {
  user: UserDto | null;
  token: string | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  initializeAuth: () => Promise<void>;
  login: (req: LoginRequestDto) => Promise<boolean>;
  changePassword: (newPassword: string) => Promise<boolean>;
  logout: () => Promise<void>;
  switchDemoRole: (role: 'Employee' | 'Manager') => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  role: 'Employee',
  isAuthenticated: false,
  isLoading: false,
  error: null,

  initializeAuth: async () => {
    try {
      set({ isLoading: true });
      const token = await SecureStore.getItemAsync('access_token');
      const savedUserStr = await SecureStore.getItemAsync('user_profile');

      if (token && savedUserStr) {
        let user = JSON.parse(savedUserStr) as UserDto;

        // In mock mode, keep the user profile synced with latest mockData.ts changes
        if (USE_MOCK_API) {
          const roleKey = user.role === 'Manager' ? 'manager' : 'employee';
          user = { ...mockUsers[roleKey], role: user.role };
          await SecureStore.setItemAsync('user_profile', JSON.stringify(user));
        }

        set({
          token,
          user,
          role: user.role,
          isAuthenticated: true,
          isLoading: false,
        });
      } else if (USE_MOCK_API) {
        // In mock mode, default to employee with latest mock user
        const defaultUser = mockUsers.employee;
        const mockToken = 'mock_jwt_token_for_dotnet_auth';
        await SecureStore.setItemAsync('access_token', mockToken);
        await SecureStore.setItemAsync('user_profile', JSON.stringify(defaultUser));
        set({
          user: defaultUser,
          token: mockToken,
          role: defaultUser.role,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        // Unauthenticated initial state (must log in first)
        set({
          user: null,
          token: null,
          role: 'Employee',
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch {
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  login: async (req: LoginRequestDto) => {
    try {
      set({ isLoading: true, error: null });
      const res = await authApi.login(req);

      await SecureStore.setItemAsync('access_token', res.accessToken);
      await SecureStore.setItemAsync('refresh_token', res.refreshToken);
      await SecureStore.setItemAsync('user_profile', JSON.stringify(res.user));

      set({
        user: res.user,
        role: res.user.role,
        token: res.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.response?.data?.message || err?.message || 'Login failed. Please check credentials.',
      });
      return false;
    }
  },

  changePassword: async (newPassword: string) => {
    try {
      set({ isLoading: true, error: null });
      await authApi.changePassword(newPassword);
      const currentUser = get().user;
      if (currentUser) {
        const updated: UserDto = {
          ...currentUser,
          mustChangePassword: false,
        };
        delete updated.tempPassword;
        await SecureStore.setItemAsync('user_profile', JSON.stringify(updated));
        set({ user: updated, isLoading: false });
      } else {
        set({ isLoading: false });
      }
      return true;
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.response?.data?.message || err?.message || 'Failed to change password.',
      });
      return false;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      await SecureStore.deleteItemAsync('user_profile');
    } catch {
      // Ignore secure store cleanup errors
    }
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      role: 'Employee',
    });
  },

  switchDemoRole: (role: 'Employee' | 'Manager') => {
    const user = role === 'Manager' ? mockUsers.manager : mockUsers.employee;
    SecureStore.setItemAsync('user_profile', JSON.stringify(user)).catch(() => {});
    set({
      user,
      role: user.role,
      isAuthenticated: true,
    });
  },

  clearError: () => set({ error: null }),
}));

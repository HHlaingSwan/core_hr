import { apiClient, USE_MOCK_API } from './client';
import { AuthResponseDto, LoginRequestDto, UserDto } from '../types';
import { mockUsers } from './mockData';

export const authApi = {
  login: async (req: LoginRequestDto): Promise<AuthResponseDto> => {
    if (USE_MOCK_API) {
      // Simulate network latency
      await new Promise((r) => setTimeout(r, 600));
      // Pick manager if requested or default to employee
      const selectedRole = req.email.includes('manager') || req.email.includes('david') ? 'manager' : 'employee';
      let user = { ...mockUsers[selectedRole] };

      // Support first-time provisioned user testing (with temporary password or email)
      if (req.password?.startsWith('Omni#') || req.email.includes('temp') || req.email.includes('new')) {
        user = {
          ...user,
          email: req.email,
          fullName: req.email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          mustChangePassword: true,
          tempPassword: req.password,
        };
      }

      return {
        accessToken: 'mock_jwt_token_for_dotnet_auth',
        refreshToken: 'mock_refresh_token',
        expiresIn: 3600,
        user,
      };
    }
    const response = await apiClient.post<AuthResponseDto>('/auth/login', req);
    return response.data;
  },

  getCurrentUser: async (): Promise<UserDto> => {
    if (USE_MOCK_API) {
      await new Promise((r) => setTimeout(r, 300));
      return mockUsers.employee;
    }
    const response = await apiClient.get<UserDto>('/auth/me');
    return response.data;
  },

  changePassword: async (newPassword: string): Promise<void> => {
    if (USE_MOCK_API) {
      await new Promise((r) => setTimeout(r, 450));
      return;
    }
    await apiClient.post('/auth/change-password', { newPassword });
  },

  logout: async (): Promise<void> => {
    if (!USE_MOCK_API) {
      await apiClient.post('/auth/logout');
    }
  },
};

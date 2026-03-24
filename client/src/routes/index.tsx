import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Eye, EyeOff, BookOpen, GraduationCap, Users, Award } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { _axios } from '@/lib/axios';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/store/userAuthStore';

interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    _id: string;
    email: string;
    name: string;
    mobileNumber: string;
    role: string;
    institutionId?: string;
    profileImage?: string;
    isActive: boolean;
    lastLogin: Date;
    token: string;
  };
}

interface LoginRequest {
  email: string;
  password: string;
}

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }

    loginMutation.mutate({ email, password });
  };

  const loginMutation = useMutation<LoginResponse, any, LoginRequest>({
    mutationFn: async (credentials: LoginRequest) => {
      const response = await _axios.post<LoginResponse>('/admin/auth/login', credentials);
      return response.data;
    },

    onSuccess: (data) => {
      if (data.success && data.data?.token) {
        toast.success(data.message || 'Login successful');
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data));
        setUser({
          ...data.data,
          role: data.data.role as 'admin' | 'super_admin' | 'staff' | 'teacher',
          lastLogin: new Date(data.data.lastLogin),
        });
        navigate({ to: '/dashboard' });
      } else {
        toast.error('Login failed. Please try again.');
      }
    },
    onError: (error: any) => {
      console.error('Login error:', error);
      const errorMessage = error.message || 'Login failed. Please check your credentials.';
      toast.error(errorMessage);
    },
  });

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Hero Section */}
      <div className="hidden lg:flex flex-1 bg-brand-color relative overflow-hidden">
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white">
          <div className="mb-12">
            <h1 className="text-5xl font-bold mb-4 leading-tight">
              Empower Your Learning Experience
            </h1>
            <p className="text-xl text-indigo-100 leading-relaxed">
              Access world-class courses, connect with instructors, and achieve your educational goals.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="space-y-6">
            <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-2xl p-6 border border-white border-opacity-20 hover:bg-opacity-20 transition duration-300">
              <div className="flex items-start space-x-4">
                <div className="bg-gray-200 bg-opacity-20 p-3 rounded-xl">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg mb-1">10,000+ Courses</h3>
                  <p className="text-indigo-100 text-sm">Expert-led content across all subjects</p>
                </div>
              </div>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-2xl p-6 border border-white border-opacity-20 hover:bg-opacity-20 transition duration-300">
              <div className="flex items-start space-x-4">
                <div className="bg-gray-200 bg-opacity-20 p-3 rounded-xl">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg mb-1">Active Community</h3>
                  <p className="text-indigo-100 text-sm">Connect with learners worldwide</p>
                </div>
              </div>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-2xl p-6 border border-white border-opacity-20 hover:bg-opacity-20 transition duration-300">
              <div className="flex items-start space-x-4">
                <div className="bg-gray-200 bg-opacity-20 p-3 rounded-xl">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg mb-1">Certified Learning</h3>
                  <p className="text-indigo-100 text-sm">Earn recognized certificates</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-12 grid grid-cols-3 gap-8">
            <div>
              <div className="text-4xl font-bold mb-1">50K+</div>
              <div className="text-indigo-100 text-sm">Active Students</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-1">500+</div>
              <div className="text-indigo-100 text-sm">Expert Instructors</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-1">95%</div>
              <div className="text-indigo-100 text-sm">Satisfaction Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-20 xl:px-24 bg-white">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-[#1A0C52] p-3 rounded-2xl shadow-lg">
                <GraduationCap className="h-10 w-10 text-white" />
              </div>
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-2">Welcome Back</h2>
            <p className="text-gray-600">Sign in to continue your learning journey</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="space-y-5">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A0C52] focus:border-transparent transition duration-150"
                  placeholder="Enter your email"
                  disabled={loginMutation.isPending}
                />
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A0C52] focus:border-transparent transition duration-150"
                    placeholder="Enter your password"
                    disabled={loginMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    disabled={loginMutation.isPending}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-[#1A0C52] focus:ring-[#1A0C52] border-gray-300 rounded"
                  disabled={loginMutation.isPending}
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>
              <div className="text-sm">
                <a href="#" className="font-medium text-[#1A0C52] hover:text-[#12083A] transition duration-150">
                  Forgot password?
                </a>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-[#1A0C52] hover:bg-[#12083A] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1A0C52] shadow-lg transition duration-150 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loginMutation.isPending ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign in to Dashboard'
                )}
              </button>
            </div>

            {/* Sign Up Link */}
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <a href="#" className="font-medium text-[#1A0C52] hover:text-[#12083A] transition duration-150">
                  Contact administrator
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/')({
  component: LoginPage,
});
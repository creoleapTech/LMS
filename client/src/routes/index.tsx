import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Eye, EyeOff, Zap, ChevronRight, Fingerprint } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { _axios } from '@/lib/axios';
import { toast } from 'sonner';
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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const handleMouseMove = (e: React.MouseEvent) => {
    // Parallax effect for the background
    const x = (e.clientX / window.innerWidth - 0.5) * 20;
    const y = (e.clientY / window.innerHeight - 0.5) * 20;
    setMousePos({ x, y });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please enter both email and password.');
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
        toast.success(data.message || 'Login successful. Redirecting...');
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data));
        setUser({
          ...data.data,
          role: data.data.role as 'admin' | 'super_admin' | 'staff' | 'teacher',
          lastLogin: new Date(data.data.lastLogin),
        });
        navigate({ to: '/dashboard' });
      } else {
        toast.error('Login failed. Please verify your credentials.');
      }
    },
    onError: (error: any) => {
      console.error('Login error:', error);
      const errorMessage = error.message || 'Login failed. Please try again later.';
      toast.error(errorMessage);
    },
  });

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative bg-[#03010A] text-white selection:bg-purple-500/50 overflow-hidden font-sans"
      onMouseMove={handleMouseMove}
    >
      {/* Dynamic 3D Background */}
      <div 
        className="absolute inset-[-5%] z-0 transition-transform duration-100 ease-out will-change-transform"
        style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)` }}
      >
        <img 
          src="/futuristic_lms.png" 
          alt="3D Futuristic Background" 
          className="w-full h-full object-cover opacity-50 mix-blend-screen"
        />
        {/* Atmospheric gradients */}
        <div className="absolute inset-0 bg-linear-to-t from-[#03010A] via-transparent to-[#03010A]/80"></div>
        <div className="absolute inset-0 bg-linear-to-r from-[#03010A] via-[#03010A]/10 to-[#03010A]"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
      </div>

      {/* Futuristic Floating Orbs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[100px] animate-blob pointer-events-none z-0"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] animate-blob animation-delay-4000 pointer-events-none z-0"></div>

      {/* Main Glass Terminal */}
      <div className="z-10 w-full max-w-[1040px] p-4 sm:p-6 lg:p-8">
        <div className="relative min-h-[560px] overflow-hidden rounded-[28px] border border-white/10 bg-[#0B0720]/45 backdrop-blur-2xl ring-1 ring-white/10 shadow-[0_0_60px_rgba(80,49,165,0.18)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(104,65,196,0.22),transparent_36%,rgba(29,16,74,0.36)_70%,rgba(104,65,196,0.18))]" />

          <div className="relative flex h-full flex-col lg:flex-row">
            {/* Left Panel - Stitch Inspired Hero */}
            <div className="hidden flex-1 flex-col lg:flex p-8 xl:p-10">
              <div className="inline-flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 w-fit">
                <img
                  src="/creo_white.png"
                  alt="Creoleap"
                  className="h-7 w-auto object-contain"
                />
                <span className="text-[9px] font-semibold tracking-[0.18em] text-white/65 uppercase">
                  Tech Portal Login
                </span>
              </div>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <img
                  src="/futuristic_lms.png"
                  alt="Creoleap technology workspace"
                  className="h-[240px] w-full rounded-xl object-cover object-center"
                />
              </div>

              <div className="mt-8 max-w-[470px]">
                <h1 className="text-5xl font-black tracking-tight leading-[1.06] text-white">
                  Bridge the Gap to
                  <span className="block bg-clip-text text-transparent bg-linear-to-r from-white via-purple-100 to-indigo-200">
                    Tech Excellence
                  </span>
                </h1>
                <p className="mt-4 text-base text-white/70 leading-relaxed">
                  Develop practical, industry-relevant skills through focused learning.
                </p>
              </div>
            </div>

            {/* Right Panel - Authentication Gateway */}
            <div className="w-full lg:w-[430px] p-5 sm:p-8 lg:p-10 flex items-center justify-center">
              <div className="w-full max-w-[360px] rounded-[24px] border border-white/20 bg-white/[0.07] px-6 sm:px-7 py-7 backdrop-blur-xl shadow-[0_20px_60px_rgba(10,6,34,0.45)]">
                <div className="lg:hidden mb-6 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <img
                    src="/creo_white.png"
                    alt="Creoleap"
                    className="h-7 w-auto object-contain"
                  />
                  <span className="text-[9px] font-semibold tracking-[0.18em] text-white/65 uppercase">
                    Tech Portal Login
                  </span>
                </div>

                <div className="mb-7 text-center">
                  <div className="mx-auto mb-2 inline-flex rounded-full border border-violet-400/25 bg-violet-400/10 p-2">
                    <Fingerprint className="h-5 w-5 text-violet-300" />
                  </div>
                  <h2 className="text-3xl font-black tracking-tight text-white">Welcome Back</h2>
                  <p className="mt-1 text-sm text-white/70">Please sign in to continue your learning journey.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="block text-[11px] font-semibold text-white/65 uppercase tracking-widest">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                        <Zap className="h-4 w-4 text-violet-300/70" />
                      </div>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full rounded-xl border border-violet-300/30 bg-[#130D34]/75 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-violet-300/70 focus:outline-none"
                        placeholder="your.email@creoleap.com"
                        disabled={loginMutation.isPending}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="password" className="block text-[11px] font-semibold text-white/65 uppercase tracking-widest">
                        Password
                      </label>
                      <a href="#" className="text-[11px] font-semibold text-violet-300 hover:text-violet-200 transition-colors">
                        Forgot Password?
                      </a>
                    </div>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full rounded-xl border border-violet-300/30 bg-[#130D34]/75 px-4 py-3 text-sm tracking-wide text-white placeholder:text-white/30 focus:border-violet-300/70 focus:outline-none"
                        placeholder="••••••••••••"
                        disabled={loginMutation.isPending}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center px-4 text-white/45 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loginMutation.isPending}
                    className="mt-2 w-full rounded-xl border border-white/20 bg-linear-to-r from-[#7D38FF] to-[#C24DFF] py-3 text-sm font-bold tracking-wider text-white shadow-[0_8px_20px_rgba(131,56,236,0.4)] transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span className="inline-flex items-center gap-2">
                      {loginMutation.isPending ? 'Authenticating...' : 'SIGN IN'}
                      {!loginMutation.isPending && <ChevronRight className="h-4 w-4" />}
                    </span>
                  </button>

                  <p className="pt-2 text-center text-[11px] text-white/45">
                    Not registered?
                    <a href="#" className="ml-1 text-violet-300 hover:text-violet-200 transition-colors">
                      Contact Admin
                    </a>
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    try {
      const stored = localStorage.getItem('auth-storage');
      const token = stored ? JSON.parse(stored)?.state?.user?.token : null;
      if (token) {
        throw redirect({ to: '/dashboard' });
      }
    } catch (e) {
      if (e instanceof Error) return; // JSON parse error, continue to login
      throw e; // re-throw redirect
    }
  },
  component: LoginPage,
});
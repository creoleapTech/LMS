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
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

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
      className="min-h-screen flex items-center justify-center relative bg-gradient-to-tr from-[#0a015a] to-[#080a25] text-white selection:bg-purple-500/50 overflow-hidden font-sans"
      onMouseMove={() => { }}
    >
      {/* Dynamic 3D Background */}
      {/* <div 
        className="absolute inset-[-5%] z-0 transition-transform duration-100 ease-out will-change-transform"
        style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)` }}
      >
        <img 
          src="/futuristic_lms.png" 
          alt="3D Futuristic Background" 
          className="w-full h-full object-cover opacity-50 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-linear-to-t from-[#03010A] via-transparent to-[#03010A]/80"></div>
        <div className="absolute inset-0 bg-linear-to-r from-[#03010A] via-[#03010A]/10 to-[#03010A]"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
      </div> */}


      {/* <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[100px] animate-blob pointer-events-none z-0"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] animate-blob animation-delay-4000 pointer-events-none z-0"></div> */}

      <div className='flex w-full  overflow-y-hidden '>
        {/* Left Panel - Stitch Inspired Hero */}
        <div className="hidden flex-1 w-1/2 flex-col lg:flex  justify-center items-center ">
          <div className='w-3/4 flex flex-col justify-center items-center' >
            <div className="absolute top-6 left-6">
              <a href="https://creoleap.com" target="_blank" rel="noopener noreferrer">
                <img
                  src="/creo_white.png"
                  alt="Creoleap"
                  className="h-22 w-auto object-contain"
                />
              </a>
            </div>

            <div className=" rounded-2xl  ">
              <img
                src="/login.png"
                alt="Creoleap technology workspace"
                className="max-h-[350px]  rounded-xl object-fill object-center"
              />
            </div>

            <div className=" max-w-[470px]">
              <h1 className="text-5xl font-black tracking-wider leading-tight text-white">
                Master the Future
                <span className="block bg-clip-text text-transparent bg-linear-to-r from-white via-purple-100 to-indigo-200">
                  Of Innovation
                </span>
              </h1>
              <p className="mt-4 text-base text-white/70 leading-relaxed">
                Empowering the next generation of tech leaders with cutting edge industry knowledge
              </p>
            </div>
          </div>
        </div>

        {/* Right Panel - Authentication Gateway */}

        <div className="w-full lg:w-1/2  flex items-center justify-center">

          <div className='absolute'>
            <img
              src="/thumbnail2.jpg"
              alt="3D Futuristic Background"
              className="!h-screen  object-cover opacity-20 -scale-x-100 -scale-y-100 "
            />
          </div>

          <div className=' w-full p-5 py-12 flex items-center justify-center '>
            <div className="w-full max-w-[460px] rounded-[24px] border border-white/20 bg-white/[0.07] px-6 sm:px-7 py-10 backdrop-blur-xl shadow-[0_20px_60px_rgba(10,6,34,0.45)]">
              <div className="lg:hidden mb-6 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <a href="https://creoleap.com" target="_blank" rel="noopener noreferrer">
                  <img
                    src="/creo_white.png"
                    alt="Creoleap"
                    className="h-7 w-auto object-contain"
                  />
                </a>
                {/* <span className="text-[9px] font-semibold tracking-[0.18em] text-white/65 uppercase">
                Tech Portal Login
              </span> */}
              </div>

              <div className="mb-7 text-center">
                <div className="mx-auto mb-2 inline-flex rounded-full border border-violet-400/25 bg-violet-50/1 p-2">
                  <Fingerprint className="h-5 w-5 text-violet-300" />
                </div>
                <h2 className="text-3xl font-black tracking-tight text-white">Welcome Back</h2>
                <p className="mt-1 text-sm text-white/70">Please sign in to continue your learning journey.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
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
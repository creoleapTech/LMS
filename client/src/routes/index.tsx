import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Eye, EyeOff, Cpu, Globe, GraduationCap, Zap, ChevronRight, Fingerprint, Activity } from 'lucide-react';
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
        <div className="absolute inset-0 bg-gradient-to-t from-[#03010A] via-transparent to-[#03010A]/80"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#03010A] via-[#03010A]/10 to-[#03010A]"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
      </div>

      {/* Futuristic Floating Orbs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[100px] animate-blob pointer-events-none z-0"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] animate-blob animation-delay-4000 pointer-events-none z-0"></div>

      {/* Main Glass Terminal */}
      <div className="z-10 w-full max-w-[1000px] p-4 sm:p-6 lg:p-8">
        <div className="relative backdrop-blur-3xl bg-[#0C0620]/50 border border-white/5 shadow-[0_0_50px_rgba(111,66,193,0.1),_inset_0_1px_0_rgba(255,255,255,0.1)] rounded-[2rem] overflow-hidden flex flex-col lg:flex-row group transition-all duration-700 hover:shadow-[0_0_80px_rgba(111,66,193,0.15)] ring-1 ring-white/10 min-h-[550px]">
          
          {/* Edge Glow Effect */}
          <div className="absolute -top-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-50"></div>
          <div className="absolute -bottom-px left-1/3 right-1/3 h-px bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-50"></div>

          {/* Left Panel - Information */}
          <div className="hidden lg:flex flex-1 flex-col justify-between p-8 xl:p-12 relative">
            {/* Header */}
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-40 animate-pulse"></div>
                  <div className="bg-gradient-to-br from-indigo-500/40 to-purple-500/40 p-2.5 rounded-xl border border-white/10 relative z-10 backdrop-blur-sm">
                    <GraduationCap className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="flex flex-col">
                  {/* <img src="" alt="" /> */}
                  <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">
                    Creoleap LMS
                  </span>
                  <span className="text-[10px] font-mono text-purple-300/80 tracking-widest uppercase mt-0.5">Advanced E-Learning Portal</span>
                </div>
              </div>
              <div className="inline-flex items-center space-x-2 bg-purple-500/10 border border-purple-500/30 rounded-full px-3 py-1 mt-4 backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                {/* <span className="text-[10px] font-bold text-purple-200 tracking-wider font-mono">PLATFORM_ONLINE_v2.0</span> */}
              </div>
            </div>

            {/* Typography Hero */}
            <div className="mt-6">
              <h1 className="text-4xl xl:text-5xl font-black leading-[1.1] tracking-tighter mb-4 relative">
                Empower Your <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300">
                  Learning Experience
                </span>
              </h1>
              <p className="text-base text-purple-100/70 font-medium max-w-[380px] leading-relaxed relative z-10">
                Access world-class courses, connect with expert instructors, and achieve your educational goals in one unified platform.
              </p>
            </div>

            {/* Metric Displays (Futuristic Bento) */}
            <div className="grid grid-cols-2 gap-3 mt-10 relative z-10">
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-4 backdrop-blur-md group/card hover:bg-white/[0.05] transition-all">
                <Cpu className="h-5 w-5 text-indigo-400 mb-2 opacity-70 group-hover/card:opacity-100 group-hover/card:text-indigo-300 transition-all" />
                <div className="text-2xl font-black text-white font-mono tracking-tighter">10K+</div>
                <div className="text-[10px] text-white/50 font-mono mt-0.5">ACTIVE COURSES</div>
              </div>
              
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-4 backdrop-blur-md group/card hover:bg-white/[0.05] transition-all relative overflow-hidden">
                <Globe className="h-5 w-5 text-pink-400 mb-2 opacity-70 group-hover/card:opacity-100 group-hover/card:text-pink-300 transition-all" />
                <div className="text-2xl font-black text-white font-mono tracking-tighter">50K+</div>
                <div className="text-[10px] text-white/50 font-mono mt-0.5">STUDENTS</div>
                
                {/* Embedded subtle grid */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none opacity-20"></div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-10 flex items-center justify-between text-white/30 text-[10px] font-mono uppercase tracking-widest border-t border-white/5 pt-4">
              <span>SECURE_CONNECTION</span>
              <Activity className="h-3 w-3 animate-pulse text-indigo-500" />
            </div>
          </div>

          {/* Right Panel - Authentication Gateway */}
          <div className="w-full lg:w-[420px] lg:border-l border-white/5 bg-[#03010A]/60 relative z-10 flex flex-col justify-center p-6 sm:p-10 backdrop-blur-2xl">
             {/* Radial gradient background specific to right panel for depth */}
             <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(111,66,193,0.1),transparent_70%)] pointer-events-none"></div>

             {/* Mobile logo variant */}
             <div className="lg:hidden flex items-center space-x-3 mb-8">
               <div className="bg-gradient-to-br from-purple-500/40 to-indigo-500/40 p-2 rounded-xl border border-white/10 backdrop-blur-sm">
                 <GraduationCap className="h-6 w-6 text-white" />
               </div>
               <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                 Creoleap LMS
               </span>
             </div>

             <div className="mb-8 text-center lg:text-left relative z-10">
               <div className="inline-block p-2 bg-indigo-500/10 rounded-full mb-3 border border-indigo-500/20">
                 <Fingerprint className="h-5 w-5 text-indigo-400" />
               </div>
               <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Welcome Back</h2>
               <p className="text-indigo-200/60 text-sm font-medium">Please sign in to continue your learning journey.</p>
             </div>

             <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
               <div className="space-y-4">
                 {/* Email Input */}
                 <div className="space-y-1.5 relative group">
                   <label htmlFor="email" className="block text-[11px] font-semibold text-purple-200/70 uppercase tracking-widest pl-1">
                     Email Address
                   </label>
                   <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                       <Zap className="h-4 w-4 text-purple-400/50 group-focus-within:text-purple-400 transition-colors" />
                     </div>
                     <input
                       id="email"
                       name="email"
                       type="email"
                       required
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       className="block w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/20 focus:bg-black/60 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all duration-300 backdrop-blur-md shadow-inner text-sm"
                       placeholder="student@example.com"
                       disabled={loginMutation.isPending}
                     />
                   </div>
                 </div>

                 {/* Password Input */}
                 <div className="space-y-1.5 relative group">
                   <div className="flex items-center justify-between pl-1">
                     <label htmlFor="password" className="block text-[11px] font-semibold text-purple-200/70 uppercase tracking-widest">
                       Password
                     </label>
                     <a href="#" className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition-colors">
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
                       className="block w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/20 focus:bg-black/60 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all duration-300 backdrop-blur-md shadow-inner text-sm tracking-wide"
                       placeholder="••••••••••••"
                       disabled={loginMutation.isPending}
                     />
                     <button
                       type="button"
                       onClick={() => setShowPassword(!showPassword)}
                       className="absolute inset-y-0 right-0 px-4 flex items-center text-white/40 hover:text-white focus:outline-none transition-colors"
                     >
                       {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                     </button>
                   </div>
                 </div>
               </div>

               {/* Submission Node */}
               <div className="pt-4 relative">
                 {/* Glowing backdrop for button */}
                 <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20 blur-xl rounded-2xl transition-opacity group-hover:opacity-40"></div>
                 
                 <button
                   type="submit"
                   disabled={loginMutation.isPending}
                   className="relative w-full flex justify-center items-center space-x-2 py-3 px-4 border border-white/10 text-sm font-bold rounded-xl text-white bg-gradient-to-r from-indigo-600/80 via-purple-600/80 to-indigo-600/80 bg-[length:200%_auto] hover:border-purple-400/50 hover:bg-[position:right_center] focus:outline-none shadow-[0_0_20px_rgba(111,66,193,0.3)] transition-all duration-500 hover:shadow-[0_0_30px_rgba(111,66,193,0.5)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden"
                 >
                   {/* Cyber scanner line animation */}
                   <div className="absolute top-0 left-0 w-full h-[2px] bg-white/60 -translate-y-[20px] group-hover:translate-y-[60px] transition-transform duration-1000 ease-in-out"></div>
                   
                   <div className="relative z-10 flex items-center justify-center space-x-2 font-mono uppercase tracking-widest">
                     {loginMutation.isPending ? (
                       <>
                         <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
                         <span>Authenticating...</span>
                       </>
                     ) : (
                       <>
                         <span>Sign In</span>
                         <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                       </>
                     )}
                   </div>
                 </button>
               </div>

               {/* Alternative Path */}
               <div className="text-center mt-5 pt-5 border-t border-white/5">
                 <p className="text-[11px] text-white/40 font-mono tracking-widest uppercase">
                   NOT REGISTERED?{' '}
                   <a href="#" className="font-bold text-indigo-400 hover:text-indigo-300 transition-colors ml-1">
                     CONTACT ADMIN
                   </a>
                 </p>
               </div>
             </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/')({
  component: LoginPage,
});
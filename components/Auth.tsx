import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export const Auth: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            } else {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;

                // If signup successful, create initial profile record
                if (data.user) {
                    const { error: profileError } = await supabase
                        .from('Profile')
                        .insert({
                            id: data.user.id,
                            email: data.user.email,
                            updatedAt: new Date().toISOString()
                        });

                    if (profileError) {
                        console.error('Error creating initial profile:', profileError);
                    }
                }

                setMessage({ text: 'Check your email for the confirmation link!', type: 'success' });
            }
        } catch (error: any) {
            setMessage({ text: error.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-highlight transition-colors duration-500 overflow-hidden relative">
            {/* Background decorative elements */}
            <div className="absolute top-10 left-10 w-20 h-20 bg-primary border-4 border-secondary -rotate-12 hidden md:block"></div>
            <div className="absolute bottom-20 right-10 w-32 h-32 bg-accent border-4 border-secondary rotate-6 hidden md:block"></div>
            <div className="absolute top-1/4 right-1/4 w-8 h-8 bg-black rotate-45 hidden md:block"></div>

            <div className="w-full max-w-md bg-white border-4 border-secondary shadow-[12px_12px_0px_#18181B] p-8 relative z-10 transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[14px_14px_0px_#18181B]">
                <div className="flex justify-center mb-8">
                    <div className="bg-primary px-4 py-2 border-3 border-secondary transform -rotate-2">
                        <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase whitespace-nowrap drop-shadow-[2px_2px_0px_rgba(0,0,0,0.5)]">
                            MACRO TRACK
                        </h1>
                    </div>
                </div>

                <h2 className="text-2xl font-black text-secondary text-center mb-8 uppercase tracking-widest border-b-4 border-secondary pb-2">
                    {isLogin ? 'Log In' : 'Sign Up'}
                </h2>

                {message && (
                    <div className={`p-4 mb-6 border-3 border-secondary font-bold uppercase text-xs tracking-wider animate-in fade-in slide-in-from-top-2 ${message.type === 'error' ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-6">
                    <div>
                        <label className="block text-xs font-black uppercase text-secondary mb-2 tracking-widest">Email Address</label>
                        <input
                            type="email"
                            required
                            placeholder="NAME@EXAMPLE.COM"
                            className="w-full px-4 py-3 border-3 border-secondary bg-surface font-mono font-bold text-secondary focus:outline-none focus:bg-white focus:ring-4 focus:ring-primary/20 transition-all placeholder:text-gray-400"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase text-secondary mb-2 tracking-widest">Password</label>
                        <input
                            type="password"
                            required
                            placeholder="********"
                            className="w-full px-4 py-3 border-3 border-secondary bg-surface font-mono font-bold text-secondary focus:outline-none focus:bg-white focus:ring-4 focus:ring-primary/20 transition-all placeholder:text-gray-400"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-white py-4 border-3 border-secondary shadow-[6px_6px_0px_#18181B] font-black uppercase tracking-[0.2em] text-lg hover:translate-y-[-2px] hover:translate-x-[-2px] hover:shadow-[8px_8px_0px_#18181B] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="animate-spin h-6 w-6" /> : (isLogin ? 'Enter' : 'Join Now')}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t-3 border-secondary border-dashed text-center">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-xs font-black text-secondary uppercase tracking-widest hover:text-primary transition-colors hover:underline decoration-4"
                    >
                        {isLogin ? "New here? Create Account" : "Back to login"}
                    </button>
                </div>
            </div>

            <div className="mt-8 text-[10px] font-black uppercase text-secondary opacity-30 tracking-[1em] select-none">
                BETA ACCESS v1.0
            </div>
        </div>
    );
};

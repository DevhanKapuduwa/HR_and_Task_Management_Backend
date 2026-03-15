import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState('');
    const [loading, setLoading]   = useState(false);
    const { login, user }         = useAuth();
    const navigate                = useNavigate();

    if (user) {
        navigate(user.role === 'management' ? '/management' : '/worker', { replace: true });
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Login failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="text-5xl mb-4">🏭</div>
                    <h1 className="text-3xl font-bold text-white">Warehouse HRM</h1>
                    <p className="text-gray-400 mt-2">Sign in to continue</p>
                </div>

                <div className="bg-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-800">
                    <div className="flex gap-3 mb-6">
                        <div className="flex-1 bg-blue-900/30 border border-blue-800 rounded-lg p-3 text-center">
                            <div className="text-blue-400 font-semibold text-sm">🏢 Management</div>
                            <div className="text-gray-500 text-xs mt-1">Full control panel</div>
                        </div>
                        <div className="flex-1 bg-green-900/30 border border-green-800 rounded-lg p-3 text-center">
                            <div className="text-green-400 font-semibold text-sm">👷 Worker</div>
                            <div className="text-gray-500 text-xs mt-1">Tasks & time tracking</div>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="you@warehouse.com"
                                required
                                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <p className="text-gray-600 text-xs text-center mt-4">
                        Role is automatically detected from your credentials
                    </p>
                </div>
            </div>
        </div>
    );
}
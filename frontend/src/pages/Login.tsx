import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Lock, User, Loader2 } from 'lucide-react';
import { login } from '../api';

interface LoginProps {
  onSuccess: (username: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await login(username, password);
      onSuccess(res.username);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-surface px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-surface-raised p-8 shadow-card"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white shadow-pill">
            <Flame size={28} />
          </span>
          <h1 className="text-xl font-bold text-text-primary">Hệ Chiên</h1>
          <p className="text-sm text-text-secondary">Đăng nhập để tiếp tục</p>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
            <User size={18} className="text-text-muted" />
            <input
              type="text"
              autoComplete="username"
              placeholder="Tài khoản"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
              required
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
            <Lock size={18} className="text-text-muted" />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
              required
            />
          </label>
        </div>

        {error && (
          <p className="rounded-lg bg-val-red/10 px-3 py-2 text-sm text-val-red" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-pill transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-60"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
};

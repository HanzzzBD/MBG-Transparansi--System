import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react'
import { requestPasswordReset, resetPassword } from '../services/api.js'
import newLogo from '../assets/NewLogo.png'
import './Login.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getResetToken(search) {
  return new URLSearchParams(search).get('token') || ''
}

function ForgotPassword({ mode = 'request' }) {
  const location = useLocation()
  const initialToken = useMemo(() => getResetToken(location.search), [location.search])
  const isResetMode = mode === 'reset'
  const [email, setEmail] = useState('')
  const [token, setToken] = useState(initialToken)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [state, setState] = useState({
    loading: false,
    error: '',
    success: '',
    resetUrl: '',
  })

  const submitResetRequest = async (event) => {
    event.preventDefault()
    setState({ loading: false, error: '', success: '', resetUrl: '' })

    if (!EMAIL_PATTERN.test(email.trim())) {
      setState((current) => ({ ...current, error: 'Masukkan email yang valid.' }))
      return
    }

    setState((current) => ({ ...current, loading: true }))

    try {
      const payload = await requestPasswordReset({ email: email.trim().toLowerCase() })
      const data = payload?.data || payload || {}
      setState({
        loading: false,
        error: '',
        success: data.message || 'Jika email terdaftar, instruksi reset password akan dikirim.',
        resetUrl: data.resetUrl || '',
      })
    } catch (error) {
      setState({
        loading: false,
        error: error.message || 'Permintaan reset password gagal.',
        success: '',
        resetUrl: '',
      })
    }
  }

  const submitNewPassword = async (event) => {
    event.preventDefault()
    setState({ loading: false, error: '', success: '', resetUrl: '' })

    if (!token.trim()) {
      setState((current) => ({ ...current, error: 'Token reset password wajib diisi.' }))
      return
    }

    if (password.length < 8) {
      setState((current) => ({ ...current, error: 'Password minimal 8 karakter.' }))
      return
    }

    setState((current) => ({ ...current, loading: true }))

    try {
      const payload = await resetPassword({ token: token.trim(), password })
      const data = payload?.data || payload || {}
      setState({
        loading: false,
        error: '',
        success: data.message || 'Password berhasil direset. Silakan login dengan password baru.',
        resetUrl: '',
      })
      setPassword('')
    } catch (error) {
      setState({
        loading: false,
        error: error.message || 'Reset password gagal.',
        success: '',
        resetUrl: '',
      })
    }
  }

  return (
    <main className="login-page login-page-simple">
      <section className="login-form-panel login-form-panel-centered">
        <div className="login-form-card login-fade-up">
          <Link to="/login" className="login-back-link" aria-label="Kembali ke login">
            <ArrowLeft aria-hidden="true" />
            Kembali ke login
          </Link>

          <Link to="/" className="login-mobile-logo" aria-label="Kembali ke beranda MBG">
            <img className="login-mobile-logo-image" src={newLogo} alt="Logo MBG" />
            <span>
              <span>MBG</span>
              <small>Transparency System</small>
            </span>
          </Link>

          <div>
            <h1 className="login-heading">{isResetMode ? 'Reset Password' : 'Lupa Password'}</h1>
            <p className="login-subheading">
              {isResetMode
                ? 'Masukkan token reset dan password baru.'
                : 'Masukkan email akun. Jika terdaftar, instruksi reset akan dikirim.'}
            </p>
          </div>

          {state.error ? (
            <div className="login-error" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{state.error}</span>
            </div>
          ) : null}

          {state.success ? (
            <div className="login-success" role="status">
              <CheckCircle2 aria-hidden="true" />
              <span>{state.success}</span>
            </div>
          ) : null}

          {!isResetMode ? (
            <form className="login-form" onSubmit={submitResetRequest} noValidate>
              <div className="login-field">
                <label className="login-label" htmlFor="forgot-email">
                  Email
                </label>
                <div className="login-input-wrap">
                  <Mail className="login-input-icon" aria-hidden="true" />
                  <input
                    id="forgot-email"
                    className="login-input"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nama@mbg.go.id"
                    required
                  />
                </div>
              </div>

              <button className="login-submit" type="submit" disabled={state.loading}>
                {state.loading ? <Loader2 className="login-submit-spinner" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
                {state.loading ? 'Mengirim...' : 'Kirim Instruksi Reset'}
              </button>
            </form>
          ) : (
            <form className="login-form" onSubmit={submitNewPassword} noValidate>
              <div className="login-field">
                <label className="login-label" htmlFor="reset-token">
                  Token reset
                </label>
                <div className="login-input-wrap">
                  <ShieldCheck className="login-input-icon" aria-hidden="true" />
                  <input
                    id="reset-token"
                    className="login-input"
                    name="token"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder="Token reset password"
                    required
                  />
                </div>
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="reset-password">
                  Password baru
                </label>
                <div className="login-input-wrap">
                  <Lock className="login-input-icon" aria-hidden="true" />
                  <input
                    id="reset-password"
                    className="login-input"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minimal 8 karakter"
                    required
                  />
                  <button
                    className="login-password-toggle"
                    type="button"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <button className="login-submit" type="submit" disabled={state.loading}>
                {state.loading ? <Loader2 className="login-submit-spinner" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
                {state.loading ? 'Menyimpan...' : 'Reset Password'}
              </button>
            </form>
          )}

          {state.resetUrl ? (
            <div className="login-reset-dev-note">
              <span>Link reset QA lokal:</span>
              <Link to={state.resetUrl.replace(window.location.origin, '')}>{state.resetUrl}</Link>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default ForgotPassword

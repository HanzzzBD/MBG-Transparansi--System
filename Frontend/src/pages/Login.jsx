import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Soup,
} from 'lucide-react'
import { loginRequest } from '../services/api'
import batik2Bg from '../assets/Batik2.png'
import newLogo from '../assets/NewLogo.png'
import './Login.css'

const VALID_ROLES = new Set(['admin', 'pemerintah', 'sppg', 'sekolah', 'umum'])
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SHOW_DEMO_LOGIN =
  import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true' ||
  (import.meta.env.DEV && import.meta.env.VITE_SHOW_DEMO_LOGIN !== 'false')

const DEMO_ACCOUNTS = [
  {
    label: 'Demo Admin',
    email: 'admin@mbg.go.id',
    password: 'password',
  },
  {
    label: 'Demo SPPG',
    email: 'sppg@mbg.go.id',
    password: 'password',
  },
  {
    label: 'Demo Pemerintah',
    email: 'gov@mbg.go.id',
    password: 'password',
  },
  {
    label: 'Demo Sekolah',
    email: 'sekolah@mbg.go.id',
    password: 'password',
  },
]

function normalizeLoginResponse(payload) {
  const data = payload?.data || payload || {}
  const accessToken = data.accessToken || data.token || payload?.accessToken || payload?.token || ''
  const user = data.user || payload?.user || null

  return {
    accessToken,
    user,
  }
}

async function postLogin({ email, password }) {
  const payload = await loginRequest({ email, password })
  return normalizeLoginResponse(payload)
}

function Login({ onLoginSuccess }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const validateForm = () => {
    const nextErrors = {}

    if (!email.trim()) {
      nextErrors.email = 'Email wajib diisi'
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = 'Format email tidak valid'
    }

    if (!password) {
      nextErrors.password = 'Password wajib diisi'
    }

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!validateForm()) return

    setIsLoading(true)

    try {
      const result = await postLogin({
        email: email.trim().toLowerCase(),
        password,
      })

      if (!result.user) {
        throw new Error('Response login tidak memuat data user.')
      }

      if (!result.accessToken) {
        throw new Error('Response login tidak memuat access token.')
      }

      if (!VALID_ROLES.has(result.user.role)) {
        throw new Error('Role user tidak dikenali oleh frontend.')
      }

      if (result.user.isActive === false || result.user.deletedAt) {
        throw new Error('Akun ini tidak aktif. Hubungi administrator.')
      }

      await onLoginSuccess?.(result.user, result.accessToken)

      if (!onLoginSuccess) {
        navigate('/dashboard', { replace: true })
      }
    } catch (loginError) {
      setError(loginError.message || 'Email atau password salah')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoFill = (account) => {
    setEmail(account.email)
    setPassword(account.password)
    setError('')
    setFieldErrors({})
  }

  const handleEmailChange = (event) => {
    setEmail(event.target.value)
    if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: '' }))
  }

  const handlePasswordChange = (event) => {
    setPassword(event.target.value)
    if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: '' }))
  }

  return (
    <main className="login-page">
      <section
        className="login-brand-panel"
        style={{ backgroundImage: `linear-gradient(135deg, rgba(7, 30, 73, 0.9), rgba(7, 30, 73, 0.74)), url(${batik2Bg})` }}
        aria-label="Informasi MBG Transparency System"
      >
        <div className="login-brand-content">
          <Link to="/" className="login-logo" aria-label="Kembali ke beranda MBG">
            <img className="login-logo-image" src={newLogo} alt="Logo MBG" />
            <span>
              <span className="login-brand-title">MBG Transparency System</span>
              <span className="login-brand-desc">
                Platform monitoring distribusi Makan Bergizi Gratis yang transparan, akuntabel, dan real-time.
              </span>
            </span>
          </Link>

          <div className="login-illustration" aria-hidden="true">
            <svg viewBox="0 0 520 300" role="img">
              <defs>
                <linearGradient id="login-card-gradient" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#b5e0ea" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.72" />
                </linearGradient>
              </defs>
              <rect className="login-illustration-card" x="24" y="46" width="142" height="118" rx="18" />
              <rect className="login-illustration-card" x="190" y="88" width="142" height="118" rx="18" />
              <rect className="login-illustration-card" x="356" y="42" width="142" height="118" rx="18" />
              <path className="login-illustration-line" d="M166 106 C182 98 178 144 190 148" />
              <path className="login-illustration-line" d="M332 146 C348 138 340 94 356 100" />
              <foreignObject x="66" y="80" width="58" height="58">
                <Soup className="login-illustration-icon" />
              </foreignObject>
              <foreignObject x="232" y="122" width="58" height="58">
                <GraduationCap className="login-illustration-icon" />
              </foreignObject>
              <foreignObject x="398" y="76" width="58" height="58">
                <BarChart3 className="login-illustration-icon" />
              </foreignObject>
              <rect className="login-illustration-bar" x="82" y="182" width="356" height="16" rx="8" />
              <rect className="login-illustration-bar is-short" x="132" y="218" width="256" height="14" rx="7" />
            </svg>
          </div>

          <div className="login-benefits">
            <div className="login-benefit-item">
              <CheckCircle2 aria-hidden="true" />
              <span>Monitoring distribusi makanan secara real-time</span>
            </div>
            <div className="login-benefit-item">
              <CheckCircle2 aria-hidden="true" />
              <span>Validasi penerimaan dari sekolah</span>
            </div>
            <div className="login-benefit-item">
              <CheckCircle2 aria-hidden="true" />
              <span>Transparansi data untuk pemerintah dan publik</span>
            </div>
          </div>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-form-card login-fade-up">
          <Link to="/" className="login-back-link" aria-label="Kembali ke landing">
            <ArrowLeft aria-hidden="true" />
            Kembali
          </Link>

          <Link to="/" className="login-mobile-logo" aria-label="Kembali ke beranda MBG">
            <img className="login-mobile-logo-image" src={newLogo} alt="Logo MBG" />
            <span>
              <span>MBG</span>
              <small>Transparency System</small>
            </span>
          </Link>

          <div>
            <h1 className="login-heading">Masuk ke Sistem</h1>
            <p className="login-subheading">Gunakan akun yang diberikan oleh administrator</p>
          </div>

          {error ? (
            <div className="login-error" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label className="login-label" htmlFor="login-email">
                Email
              </label>
              <div className="login-input-wrap">
                <Mail className="login-input-icon" aria-hidden="true" />
                <input
                  id="login-email"
                  className="login-input"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="nama@mbg.go.id"
                  required
                />
              </div>
              {fieldErrors.email ? <p className="login-field-error">{fieldErrors.email}</p> : null}
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="login-password">
                Password
              </label>
              <div className="login-input-wrap">
                <Lock className="login-input-icon" aria-hidden="true" />
                <input
                  id="login-password"
                  className="login-input"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Masukkan password"
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
              {fieldErrors.password ? <p className="login-field-error">{fieldErrors.password}</p> : null}
            </div>

            <div className="login-options">
              <Link className="login-forgot" to="/forgot-password">
                Lupa password?
              </Link>
            </div>

            <button className="login-submit" type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="login-submit-spinner" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
              {isLoading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          {SHOW_DEMO_LOGIN ? (
            <>
              <div className="login-divider">
                <span>atau masuk sebagai</span>
              </div>
              <div className="login-demo-grid">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.label}
                    className="login-demo-btn"
                    type="button"
                    onClick={() => handleDemoFill(account)}
                  >
                    {account.label}
                  </button>
                ))}
              </div>
              <p className="login-demo-note">
                Akun demo hanya untuk QA lokal dan tidak ditampilkan pada build production kecuali flag demo diaktifkan.
              </p>
            </>
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default Login

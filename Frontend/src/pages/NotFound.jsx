import { Link } from 'react-router-dom'
import { ArrowLeft, Home } from 'lucide-react'
import useAuthStore from '../store/authStore.js'

function NotFound() {
  const { isAuthenticated, user, token } = useAuthStore()
  const homePath = isAuthenticated && user && token ? '/dashboard' : '/'

  return (
    <main className="app-not-found" aria-labelledby="not-found-title">
      <p className="app-not-found-code">404</p>
      <h1 id="not-found-title">Halaman Tidak Ditemukan</h1>
      <p>Route yang dibuka tidak terdaftar di sistem.</p>
      <div className="app-not-found-actions">
        <Link className="app-not-found-primary" to={homePath}>
          <Home aria-hidden="true" />
          Ke halaman utama
        </Link>
        <button className="app-not-found-secondary" type="button" onClick={() => window.history.back()}>
          <ArrowLeft aria-hidden="true" />
          Kembali
        </button>
      </div>
    </main>
  )
}

export default NotFound

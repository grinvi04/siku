import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthCallbackPage } from './features/auth/AuthCallbackPage'
import { LoginPage } from './features/auth/LoginPage'
import { ProfilePage } from './features/auth/ProfilePage'
import { useSession } from './features/auth/useSession'
import { HomePage } from './features/groups/HomePage'

function RequireAuth() {
  const { session, loading } = useSession()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

function App() {
  return (
    <div className="mx-auto max-w-lg">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App

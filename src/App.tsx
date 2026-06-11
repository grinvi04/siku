import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthCallbackPage } from './features/auth/AuthCallbackPage'
import { LoginPage } from './features/auth/LoginPage'
import { ProfilePage } from './features/auth/ProfilePage'
import { useSession } from './features/auth/useSession'
import { EventNewPage } from './features/events/EventNewPage'
import { EventPage } from './features/events/EventPage'
import { ExpenseFormPage } from './features/expenses/ExpenseFormPage'
import { GroupNewPage } from './features/groups/GroupNewPage'
import { GroupPage } from './features/groups/GroupPage'
import { HomePage } from './features/groups/HomePage'
import { InvitePage } from './features/groups/InvitePage'

function RequireAuth() {
  const { session, loading } = useSession()
  const location = useLocation()
  if (loading) return null
  if (!session) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  return <Outlet />
}

function App() {
  return (
    <div className="mx-auto max-w-lg">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/groups/new" element={<GroupNewPage />} />
          <Route path="/groups/:groupId" element={<GroupPage />} />
          <Route path="/groups/:groupId/events/new" element={<EventNewPage />} />
          <Route path="/events/:eventId" element={<EventPage />} />
          <Route path="/events/:eventId/expenses/new" element={<ExpenseFormPage />} />
          <Route path="/events/:eventId/expenses/:expenseId/edit" element={<ExpenseFormPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App

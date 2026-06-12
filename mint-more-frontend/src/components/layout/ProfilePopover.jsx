import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import Icon from '../ui/Icon'

export default function ProfilePopover({ onClose }) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const ref = useRef(null)

  useEffect(() => {
    const close = event => {
      if (!ref.current?.contains(event.target)) onClose()
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [onClose])

  const go = route => {
    navigate(route)
    onClose()
  }

  return (
    <div className="profile-popover" ref={ref}>
      <div className="profile-popover-summary">
        <div className="avatar">
          {(user?.full_name || 'U').split(' ').map(part => part[0]).slice(0, 2).join('')}
        </div>
        <div>
          <strong>{user?.full_name}</strong>
          <span>{user?.email}</span>
        </div>
        <span className="profile-role">{user?.role}</span>
      </div>
      <div className="profile-popover-menu">
        <button onClick={() => go('/settings?section=profile')}><Icon name="user" /><span>Edit profile</span><Icon name="chevronRight" /></button>
        <button onClick={() => go('/settings?section=account')}><Icon name="settings" /><span>Account settings</span><Icon name="chevronRight" /></button>
        {user?.role !== 'admin' && <button onClick={() => go('/settings?section=verification')}><Icon name="shield" /><span>Verification</span><Icon name="chevronRight" /></button>}
      </div>
      <button className="profile-signout" onClick={() => { logout(); onClose() }}><Icon name="arrowRight" /> Sign out</button>
    </div>
  )
}

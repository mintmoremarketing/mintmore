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
      <div className="profile-popover-cover" />
      <div className="profile-popover-body">
        <div className="profile-popover-avatar">
          {(user?.full_name || 'U').split(' ').map(part => part[0]).slice(0, 2).join('')}
          <span />
        </div>
        <h3>{user?.full_name}</h3>
        <p>{user?.email}</p>
        <span className="badge neutral" style={{ textTransform: 'capitalize' }}>{user?.role}</span>
        <div className="profile-popover-menu">
          <button onClick={() => go('/settings?section=profile')}><Icon name="user" /> Edit profile <Icon name="chevronRight" /></button>
          <button onClick={() => go('/settings?section=account')}><Icon name="settings" /> Account settings <Icon name="chevronRight" /></button>
          {user?.role !== 'admin' && <button onClick={() => go('/settings?section=verification')}><Icon name="shield" /> Verification <Icon name="chevronRight" /></button>}
          <button onClick={() => { logout(); onClose() }}><Icon name="arrowRight" /> Sign out</button>
        </div>
      </div>
    </div>
  )
}

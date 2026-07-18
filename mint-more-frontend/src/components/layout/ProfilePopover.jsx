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
    <div className="profile-popover" ref={ref} style={{ width: 'auto', minWidth: '150px' }}>
      <button className="profile-signout" onClick={() => { logout(); onClose() }} style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', fontWeight: '500' }}>
        <Icon name="arrowRight" /> Sign out
      </button>
    </div>
  )
}

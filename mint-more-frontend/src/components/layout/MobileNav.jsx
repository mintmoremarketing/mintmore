import { useNavigate, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon'

const CLIENT_ITEMS = [
  { route: '/dashboard', icon: 'home',      label: 'Home' },
  { route: '/jobs',      icon: 'briefcase', label: 'Jobs' },
  { route: '/ai',        icon: 'sparkles',  label: 'AI' },
  { route: '/chat',      icon: 'chat',      label: 'Chat' },
  { route: '/wallet',    icon: 'wallet',    label: 'Wallet' },
]

const FREELANCER_ITEMS = [
  { route: '/dashboard', icon: 'home',      label: 'Home' },
  { route: '/jobs',      icon: 'briefcase', label: 'Briefs' },
  { route: '/chat',      icon: 'chat',      label: 'Chat' },
  { route: '/portfolio', icon: 'image',     label: 'Portfolio' },
  { route: '/wallet',    icon: 'wallet',    label: 'Earnings' },
]

export default function MobileNav({ role }) {
  const navigate = useNavigate()
  const location = useLocation()
  const items = role === 'freelancer' ? FREELANCER_ITEMS : CLIENT_ITEMS

  return (
    <nav className="mobile-bottom-nav">
      {items.map(item => (
        <button
          key={item.route}
          className={`mobile-nav-item ${location.pathname === item.route ? 'active' : ''}`}
          onClick={() => navigate(item.route)}
        >
          <Icon name={item.icon} size={18} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
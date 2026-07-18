import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../api/supabase'
import { authApi } from '../../api/auth'
import Icon from '../../components/ui/Icon'

export default function ForgotPassword() {
	const navigate = useNavigate()
	const [step, setStep] = useState(1) // 1: Email, 2: OTP, 3: New Password
	const [email, setEmail] = useState('')
	const [otp, setOtp] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [error, setError] = useState(null)
	
	const [cooldown, setCooldown] = useState(0)

	useEffect(() => {
		if (cooldown > 0) {
			const t = setTimeout(() => setCooldown(c => c - 1), 1000)
			return () => clearTimeout(t)
		}
	}, [cooldown])

	// Step 1: Send OTP
	const sendOtpMutation = useMutation({
		mutationFn: async () => {
			const { error } = await supabase.auth.signInWithOtp({ email })
			if (error) throw error
		},
		onSuccess: () => {
			setStep(2)
			setError(null)
			setCooldown(60)
		},
		onError: (err) => {
			setError(err.message || 'Failed to send reset code')
		}
	})

	// Step 2: Verify OTP
	const verifyOtpMutation = useMutation({
		mutationFn: async () => {
			const { data, error } = await supabase.auth.verifyOtp({
				email,
				token: otp,
				type: 'email'
			})
			if (error) throw error
			return data
		},
		onSuccess: () => {
			setStep(3)
			setError(null)
		},
		onError: (err) => {
			setError(err.message || 'Invalid verification code')
		}
	})

	// Step 3: Reset Password
	const resetPasswordMutation = useMutation({
		mutationFn: async () => {
			// This calls your custom Node.js backend to update the password!
			await authApi.resetPassword(email, newPassword)
		},
		onSuccess: () => {
			navigate('/login', { state: { message: 'Password reset successfully! Please log in.' } })
		},
		onError: (err) => {
			setError(err.response?.data?.message || err.message || 'Failed to reset password')
		}
	})

	const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
	useEffect(() => {
		const handleResize = () => setIsMobile(window.innerWidth <= 768)
		window.addEventListener('resize', handleResize)
		return () => window.removeEventListener('resize', handleResize)
	}, [])

	return (
		<div className={`auth-shell${isMobile ? ' mobile' : ''}`}>
			<aside className="auth-aside">
				<div>
					<Link to="/" className="auth-brand-link" aria-label="Back to CREATYV landing page" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
						<img src="/logo-dark.png" alt="CREATYV Logo" className="w-8 h-8 object-contain rounded" />
						<span>CREAT<span className="text-mint-500 font-bold">YV</span></span>
					</Link>
				</div>
				<div className="flex-1 w-full flex flex-col justify-center h-full">
					<div className="grid grid-cols-4 grid-rows-5 gap-2 md:gap-3 w-full h-full animate-in fade-in slide-in-from-bottom-8 duration-1000 opacity-90 hover:opacity-100 transition-opacity">
						{/* Row 1 & 2 */}
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-2 row-span-2 group">
							<img src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=800&q=80" alt="Creative Freelancer" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-2 group">
							<img src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80" alt="Photography" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-1 group">
							<img src="https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=400&q=80" alt="UI/UX Design" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-1 group">
							<img src="https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=400&q=80" alt="Graphic Design" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>

						{/* Row 3 & 4 */}
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-1 group">
							<img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=400&q=80" alt="Web Development" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-1 group">
							<img src="https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=400&q=80" alt="Filmmaking" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-2 row-span-2 group">
							<img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80" alt="Creative Agency" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-2 group">
							<img src="https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=400&q=80" alt="Brand Identity" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-1 group">
							<img src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=400&q=80" alt="Fashion & Styling" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>

						{/* Row 5 */}
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-1 group">
							<img src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&q=80" alt="Creative Studio" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-1 group">
							<img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80" alt="Digital Art" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-1 group">
							<img src="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=400&q=80" alt="Podcasting" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
					</div>
				</div>
			</aside>

			<div className="auth-form-wrap overflow-y-auto h-full max-h-screen">
				<div className="auth-form">
					{isMobile && (
						<div style={{ textAlign: 'center', marginBottom: 32 }}>
							<Link to="/" className="auth-brand-link light" aria-label="Back to CREATYV landing page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
								<img src="/logo-light.png" alt="CREATYV Logo" className="w-8 h-8 object-contain rounded" />
								<span>CREAT<span className="text-mint-500 font-bold">YV</span></span>
							</Link>
						</div>
					)}

					<div className="text-[11px] 2xl:text-[14px] font-bold tracking-wider uppercase text-mint-500 mb-2 2xl:mb-4">Account Recovery</div>
					<h1 className="text-3xl md:text-4xl 2xl:text-5xl font-display font-bold text-ink-900 tracking-tight m-0 pb-2 2xl:pb-4">
						{step === 1 ? 'Reset Password' : step === 2 ? 'Verify Email' : 'New Password'}
					</h1>
					<p className="text-ink-500 text-sm md:text-base 2xl:text-lg mt-0 mb-8 2xl:mb-12">
						{step === 1 
							? 'Enter your email to receive a password reset code.' 
							: step === 2 
							? `We sent an 8-digit code to ${email}`
							: 'Enter your new password below.'}
					</p>

				{error && (
					<div className="alert error" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: 'var(--rose-light)', color: 'var(--rose-strong)', borderRadius: 8, marginBottom: 20 }}>
						<Icon name="alertCircle" size={16} />
						<div style={{ fontSize: 13, fontWeight: 500 }}>{error}</div>
					</div>
				)}

				{step === 1 && (
					<div className="stack" style={{ gap: 20 }}>
						<div className="field">
							<label className="field-label 2xl:text-base">Email address</label>
							<input
								className="input 2xl:text-lg 2xl:p-4"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="you@company.com"
								autoFocus
							/>
						</div>
						<button 
							className="btn primary 2xl:text-lg 2xl:p-4" 
							onClick={() => sendOtpMutation.mutate()} 
							disabled={!email || sendOtpMutation.isPending || cooldown > 0}
						>
							{sendOtpMutation.isPending ? 'Sending code...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send Reset Code'}
						</button>
					</div>
				)}

				{step === 2 && (
					<div className="stack" style={{ gap: 20 }}>
						<div className="field">
							<label className="field-label 2xl:text-base">8-Digit Code</label>
							<input
								className="input 2xl:text-lg 2xl:p-4"
								type="text"
								value={otp}
								onChange={(e) => setOtp(e.target.value)}
								placeholder="Enter code"
								autoFocus
							/>
						</div>
						<button 
							className="btn primary 2xl:text-lg 2xl:p-4" 
							onClick={() => verifyOtpMutation.mutate()} 
							disabled={!otp || verifyOtpMutation.isPending}
						>
							{verifyOtpMutation.isPending ? 'Verifying...' : 'Verify Code'}
						</button>
						<div style={{ textAlign: 'center' }}>
							<button 
								className="btn link" 
								style={{ fontSize: 13, color: 'var(--ink-400)' }} 
								onClick={() => setStep(1)}
							>
								Back to Email
							</button>
						</div>
					</div>
				)}

				{step === 3 && (
					<div className="stack" style={{ gap: 20 }}>
						<div className="field">
							<label className="field-label 2xl:text-base">New Password</label>
							<div style={{ position: 'relative' }}>
								<input
									className="input 2xl:text-lg 2xl:p-4 w-full pr-10"
									type={showPassword ? 'text' : 'password'}
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									placeholder="At least 8 characters"
									autoFocus
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									style={{
										position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
										background: 'transparent', border: 0, padding: 4, color: 'var(--ink-400)', cursor: 'pointer'
									}}
								>
									<Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
								</button>
							</div>
						</div>
						<button 
							className="btn primary 2xl:text-lg 2xl:p-4" 
							onClick={() => resetPasswordMutation.mutate()} 
							disabled={newPassword.length < 8 || resetPasswordMutation.isPending}
						>
							{resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
						</button>
					</div>
				)}

				{step === 1 && (
					<div className="2xl:text-base" style={{ marginTop: 22, fontSize: 13, color: 'var(--ink-500)', textAlign: 'center' }}>
						Remembered your password? <Link to="/login" style={{ color: 'var(--mint-500)', fontWeight: 500, textDecoration: 'none' }}>Log in</Link>
					</div>
				)}
				</div>
			</div>
		</div>
	)
}

import { api } from './client'

export const walletApi = {
	get: () => api.get('/wallet'),
	transactions: (params) => api.get('/wallet/transactions', { params }),
	createOrder: (amount) => api.post('/payments/topup/order', { amount }),
	verifyPayment: (data) => api.post('/payments/topup/verify', data),
}

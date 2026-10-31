import test from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { submitKyc } from '../../src/components/freelancer/submitKyc.js'

const payload = {
	docType: 'pan',
	form: { document_number: 'ABCDE1234F', date_of_birth: '2000-01-01', gender: 'prefer_not_to_say', address_line1: 'Test street', city: 'Test', state: 'Test', pincode: '123456' },
	files: { document_front: new Blob(['front']), document_back: null, selfie: new Blob(['selfie']), address_proof: new Blob(['address']) },
}

test('KYC retry skips stages already saved and keeps file payloads multipart', async () => {
	const saved = []
	const calls = []
	let failIdentity = true
	let failAddress = true
	const api = {
		get: async () => ({ data: { data: { submissions: [...saved] } } }),
		post: async (url, body, config) => {
			calls.push(url)
			if (url !== '/kyc/basic') {
				const headers = new axios.AxiosHeaders({ 'Content-Type': config.headers['Content-Type'] })
				const transformed = axios.defaults.transformRequest[0](body, headers)
				assert.ok(transformed instanceof FormData)
				assert.ok(transformed.get(url.endsWith('identity') ? 'document_front' : 'address_proof') instanceof Blob)
			}
			if (url === '/kyc/basic') saved.unshift({ level: 'basic', status: 'pending' })
			if (url === '/kyc/identity') {
				if (failIdentity) { failIdentity = false; throw new Error('simulated identity failure') }
				saved.unshift({ level: 'identity', status: 'pending' })
			}
			if (url === '/kyc/address' && failAddress) { failAddress = false; throw new Error('simulated address failure') }
		},
	}
	await assert.rejects(submitKyc(api, payload), /identity failure/)
	await assert.rejects(submitKyc(api, payload), /address failure/)
	await submitKyc(api, payload)
	assert.deepEqual(calls, ['/kyc/basic', '/kyc/identity', '/kyc/identity', '/kyc/address', '/kyc/address'])
})

test('a retry after the address was already saved does not submit it twice', async () => {
	const api = {
		get: async () => ({ data: { data: { submissions: [{ level: 'address', status: 'pending' }] } } }),
		post: async () => { throw new Error('Unexpected repeated submission') },
	}
	await submitKyc(api, payload)
})

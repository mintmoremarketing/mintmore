export const latestByLevel = (submissions = [], level) => submissions.find(item => item.level === level)
export const usable = submission => submission && ['pending', 'approved'].includes(submission.status)

const multipart = values => {
	const data = new FormData()
	Object.entries(values).forEach(([key, value]) => value !== null && value !== '' && data.append(key, value))
	return data
}

// Fetch the latest completed stages each time, so a failed upload can be retried safely.
export async function submitKyc(api, { docType, form, files }) {
	const status = (await api.get('/kyc/status')).data.data
	const submissions = status?.submissions || []
	if (usable(latestByLevel(submissions, 'address'))) return
	if (!usable(latestByLevel(submissions, 'basic'))) {
		await api.post('/kyc/basic', { date_of_birth: form.date_of_birth, gender: form.gender, nationality: 'Indian' })
	}
	const config = { headers: { 'Content-Type': 'multipart/form-data' } }
	if (!usable(latestByLevel(submissions, 'identity'))) {
		await api.post('/kyc/identity', multipart({
			document_type: docType,
			document_number: form.document_number,
			document_front: files.document_front,
			document_back: files.document_back,
			selfie: files.selfie,
		}), config)
	}
	await api.post('/kyc/address', multipart({
		address_line1: form.address_line1,
		city: form.city,
		state: form.state,
		pincode: form.pincode,
		country: 'India',
		address_proof: files.address_proof || files.document_front,
	}), config)
}

import client from '@/api/client'

const inviteAccount = (body) => client.post(`/account-management/invite`, body)
const registerAccount = (body) => client.post(`/account-management/register`, body)
const verifyAccountEmail = (body) => client.post('/account-management/verify', body)
const resendVerificationEmail = (body) => client.post('/account-management/resend-verification', body)
const forgotPassword = (body) => client.post('/account-management/forgot-password', body)
const resetPassword = (body) => client.post('/account-management/reset-password', body)
const getBillingData = () => client.post('/account-management/billing')
const logout = () => client.post('/account-management/logout')
const getBasicAuth = () => client.get('/account-management/basic-auth')
const checkBasicAuth = (body) => client.post('/account-management/basic-auth', body)

export default {
    getBillingData,
    inviteAccount,
    registerAccount,
    verifyAccountEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
    logout,
    getBasicAuth,
    checkBasicAuth
}

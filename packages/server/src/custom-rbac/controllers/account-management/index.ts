/**
 * Custom RBAC - Account Management Controller
 *
 * Copyright (c) 2024-2026
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * NOTE: This controller uses the custom-rbac module for account operations.
 */

import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { AccountService } from '../../services/account-management'
import { getRunningExpressApp } from '../../../utils/getRunningExpressApp'

const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const accountService = new AccountService()
        const data = await accountService.register(req.body)
        return res.status(StatusCodes.CREATED).json(data)
    } catch (error) {
        next(error)
    }
}

const invite = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const accountService = new AccountService()
        const data = await accountService.invite(req.body, req.user)
        return res.status(StatusCodes.CREATED).json(data)
    } catch (error) {
        next(error)
    }
}

const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const accountService = new AccountService()
        const data = await accountService.login(req.body)
        return res.status(StatusCodes.CREATED).json(data)
    } catch (error) {
        next(error)
    }
}

const verify = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const accountService = new AccountService()
        const data = await accountService.verify(req.body)
        return res.status(StatusCodes.CREATED).json(data)
    } catch (error) {
        next(error)
    }
}

const resendVerificationEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const accountService = new AccountService()
        const data = await accountService.resendVerificationEmail(req.body)
        return res.status(StatusCodes.CREATED).json(data)
    } catch (error) {
        next(error)
    }
}

const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const accountService = new AccountService()
        const data = await accountService.forgotPassword(req.body)
        return res.status(StatusCodes.CREATED).json(data)
    } catch (error) {
        next(error)
    }
}

const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const accountService = new AccountService()
        const data = await accountService.resetPassword(req.body)
        return res.status(StatusCodes.CREATED).json(data)
    } catch (error) {
        next(error)
    }
}

const createStripeCustomerPortalSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { url: portalSessionUrl } = await getRunningExpressApp().identityManager.createStripeCustomerPortalSession(req)
        return res.status(StatusCodes.OK).json({ url: portalSessionUrl })
    } catch (error) {
        next(error)
    }
}

const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (req.user) {
            const accountService = new AccountService()
            await accountService.logout(req.user)
            if (req.isAuthenticated()) {
                req.logout((err) => {
                    if (err) {
                        return res.status(500).json({ message: 'Logout failed' })
                    }
                    req.session.destroy((err) => {
                        if (err) {
                            return res.status(500).json({ message: 'Failed to destroy session' })
                        }
                    })
                })
            } else {
                // For JWT-based users (owner, org_admin)
                res.clearCookie('connect.sid') // Clear the session cookie
                res.clearCookie('token') // Clear the JWT cookie
                res.clearCookie('refreshToken') // Clear the JWT cookie
                return res.redirect('/login') // Redirect to the login page
            }
        }
        return res.status(200).json({ message: 'logged_out', redirectTo: `/login` })
    } catch (error) {
        next(error)
    }
}

const getBasicAuth = async (req: Request, res: Response) => {
    if (process.env.FLOWISE_USERNAME && process.env.FLOWISE_PASSWORD) {
        return res.status(StatusCodes.OK).json({
            isUsernamePasswordSet: true
        })
    } else {
        return res.status(StatusCodes.OK).json({
            isUsernamePasswordSet: false
        })
    }
}

const checkBasicAuth = async (req: Request, res: Response) => {
    const { username, password } = req.body
    if (username === process.env.FLOWISE_USERNAME && password === process.env.FLOWISE_PASSWORD) {
        return res.json({ message: 'Authentication successful' })
    } else {
        return res.json({ message: 'Authentication failed' })
    }
}

export default {
    register,
    invite,
    login,
    logout,
    verify,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
    createStripeCustomerPortalSession,
    getBasicAuth,
    checkBasicAuth
}

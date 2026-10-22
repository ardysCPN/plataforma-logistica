import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middlewares/validate';
import { authenticateJWT } from '../../middlewares/auth';
import { loginSchema, registerClientSchema, registerCourierSchema } from '@plataforma/shared';

export const authRouter = Router();

authRouter.post('/register/client', validate(registerClientSchema), authController.registerClient);
authRouter.post('/register/courier', validate(registerCourierSchema), authController.registerCourier);
authRouter.post('/login', validate(loginSchema), authController.login);
authRouter.get('/me', authenticateJWT, authController.me);
authRouter.patch('/profile/avatar', authenticateJWT, authController.updateAvatar);
authRouter.put('/profile', authenticateJWT, authController.updateProfile);
authRouter.get('/courier/:id', authController.getPublicCourier);

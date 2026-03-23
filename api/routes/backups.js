import express from 'express';
import { verifyAdmin } from '../middleware/webAuthMiddleware.js';
import { listBackups, createBackup, downloadBackup, restoreBackup } from '../controllers/backupController.js';
import { validateRestoreBackup } from '../validators/backupValidator.js';

const router = express.Router();
router.get('/backups',                     verifyAdmin, listBackups);
router.post('/backups',                    verifyAdmin, createBackup);
router.get('/backups/:filename/download',  verifyAdmin, downloadBackup);
router.post('/backups/restore',            verifyAdmin, validateRestoreBackup, restoreBackup);
router.get('/admin/backups',               verifyAdmin, listBackups);
router.post('/admin/backup',               verifyAdmin, createBackup);
router.post('/admin/restore',              verifyAdmin, validateRestoreBackup, restoreBackup);

export default router;

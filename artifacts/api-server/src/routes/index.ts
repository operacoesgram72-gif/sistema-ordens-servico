import { Router, type IRouter } from "express";
import { shareTokenMiddleware } from "../lib/share-tokens";
import healthRouter from "./health";
import eventsRouter from "./events";
import serviceOrdersRouter from "./service-orders";
import techniciansRouter from "./technicians";
import dashboardRouter from "./dashboard";
import contactsRouter from "./contacts";
import settingsRouter from "./settings";
import materialWithdrawalsRouter from "./material-withdrawals";
import fileEntriesRouter from "./file-entries";
import suppliersRouter from "./suppliers";
import linksRouter from "./links";
import storageRouter from "./storage";
import purchaseSheetsRouter from "./purchase-sheets";

const router: IRouter = Router();

// Validate share tokens on all requests (sets req.shareUnit when valid)
router.use(shareTokenMiddleware);

router.use(healthRouter);
router.use(eventsRouter);
router.use(serviceOrdersRouter);
router.use(techniciansRouter);
router.use(dashboardRouter);
router.use(contactsRouter);
router.use(settingsRouter);
router.use(materialWithdrawalsRouter);
router.use(fileEntriesRouter);
router.use(suppliersRouter);
router.use(linksRouter);
router.use(storageRouter);
router.use(purchaseSheetsRouter);

export default router;

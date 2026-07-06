import { Router, type IRouter } from "express";
import healthRouter from "./health";
import serviceOrdersRouter from "./service-orders";
import techniciansRouter from "./technicians";
import dashboardRouter from "./dashboard";
import contactsRouter from "./contacts";
import settingsRouter from "./settings";
import materialWithdrawalsRouter from "./material-withdrawals";
import fileEntriesRouter from "./file-entries";
import suppliersRouter from "./suppliers";
import linksRouter from "./links";

const router: IRouter = Router();

router.use(healthRouter);
router.use(serviceOrdersRouter);
router.use(techniciansRouter);
router.use(dashboardRouter);
router.use(contactsRouter);
router.use(settingsRouter);
router.use(materialWithdrawalsRouter);
router.use(fileEntriesRouter);
router.use(suppliersRouter);
router.use(linksRouter);

export default router;

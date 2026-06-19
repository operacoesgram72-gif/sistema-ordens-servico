import { Router, type IRouter } from "express";
import healthRouter from "./health";
import serviceOrdersRouter from "./service-orders";
import techniciansRouter from "./technicians";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(serviceOrdersRouter);
router.use(techniciansRouter);
router.use(dashboardRouter);

export default router;

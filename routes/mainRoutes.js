const express = require("express");
const router = express.Router();

// ==== CONTROLLERS ====
const adminController = require("../controllers/adminController");
const productController = require("../controllers/productController");
const saleController = require("../controllers/saleController");
const debtorController = require("../controllers/debtorController");
const storeController = require("../controllers/storeController");
const budgetController = require("../controllers/budgetController");
const masterController = require("../controllers/masterController");
const expenseController = require("../controllers/expenseController");
const usdRateController = require("../controllers/UsdRateController");
const nasiyaController = require("../controllers/nasiyaController");
const clientController = require("../controllers/clientController"); // *** NEW ***

// ==== MIDDLEWARE ====
const auth = require("../middleware/authMiddleware");

// ============================================================
// ====================== AUTH ROUTES =========================
// ============================================================

router.post("/register", adminController.registerAdmin);
router.post("/login", adminController.loginAdmin);

router.post(
  "/create-admin",
  auth.verifyToken,
  auth.verifyRole(["admin"]),
  adminController.createAdmin
);

router.get(
  "/admins",
  auth.verifyToken,
  auth.verifyRole(["admin"]),
  adminController.getAllAdmins
);

router.delete(
  "/admin/:id",
  auth.verifyToken,
  auth.verifyRole(["admin"]),
  adminController.deleteAdmin
);

router.put(
  "/admin/:id",
  auth.verifyToken,
  auth.verifyRole(["admin"]),
  adminController.updateAdmin
);

// ============================================================
// ===================== CLIENT ROUTES ========================
// ============================================================
// *** NEW: mijozlar moduli ***

router.post("/clients", auth.verifyToken, clientController.createClient);

router.get("/clients", auth.verifyToken, clientController.getAllClients);

router.get("/clients/:id", auth.verifyToken, clientController.getClientById);

router.put("/clients/:id", auth.verifyToken, clientController.updateClient);

router.delete("/clients/:id", auth.verifyToken, clientController.deleteClient);

// ============================================================
// ===================== PRODUCT ROUTES =======================
// ============================================================

router.post("/products", auth.verifyToken, productController.createProduct);

router.get("/products", auth.verifyToken, productController.getAllProducts);

router.put("/products/:id", auth.verifyToken, productController.updateProduct);

router.delete(
  "/products/:id",
  auth.verifyToken,
  productController.deleteProduct
);

router.get("/products/barcode/:barcode", productController.getProductByBarcode);

// ============================================================
// ======================= SALES ROUTES =======================
// ============================================================

router.post("/sales", saleController.recordSale);

router.delete("/sales/:id", auth.verifyToken, saleController.deleteSale);

router.get("/sales", saleController.getSalesHistory);
router.get("/sales/daily", saleController.getDailySales);
router.get("/sales/weekly", saleController.getWeeklySales);
router.get("/sales/monthly", saleController.getMonthlySales);
router.get("/sales/yearly", saleController.getYearlySales);

router.get("/stock/compare", saleController.compareStockLevels);

router.get("/stat/year", auth.verifyToken, saleController.getLast12MonthsSales);

// ============================================================
// ===================== DEBTOR ROUTES ========================
// ============================================================

router.post("/debtors", auth.verifyToken, debtorController.createDebtor);

router.put("/debtor/:id", auth.verifyToken, debtorController.editDebtor);

router.post("/pay/debtor", auth.verifyToken, debtorController.createPayment);

router.get("/debtors", auth.verifyToken, debtorController.getAllDebtors);

router.put("/debtors/:id", auth.verifyToken, debtorController.updateDebtor);

router.delete("/debtors/:id", auth.verifyToken, debtorController.deleteDebtor);

router.post("/debtors/return", auth.verifyToken, debtorController.vazvratDebt);

// ============================================================
// ===================== NASIYA ROUTES ========================
// ============================================================

router.post("/nasiya/create", auth.verifyToken, nasiyaController.createNasiya);

router.get("/nasiya/get", auth.verifyToken, nasiyaController.getNasiya);

router.post(
  "/nasiya/complete/:id",
  auth.verifyToken,
  nasiyaController.completeNasiya
);


router.post("/store/add", storeController.addProductToStore);
router.get("/store", storeController.getStoreProducts);
router.delete("/store/:id", storeController.removeProductFromStore);
router.post("/store/sell", storeController.sellProductFromStore);
router.post("/store/return", storeController.vazvratTovar);
router.post("/store/product/create", storeController.createProductToStore);
router.post("/store/quantity/:id", storeController.updateStoreProduct);

// ============================================================
// ====================== BUDGET ROUTES =======================
// ============================================================

router.get("/budget", budgetController.getBudget);
router.put("/budget", budgetController.updateBudget);

// ============================================================
// ===================== EXPENSE ROUTES =======================
// ============================================================

router.post("/harajat/expenses", expenseController.addExpense);
router.get("/harajat/expenses", expenseController.getExpenses);

// ============================================================
// ===================== USD RATE ROUTES ======================
// ============================================================

router.get("/usd", usdRateController.getUsdRate);
router.post("/usd", usdRateController.updateUsdRate);

// ============================================================
// =================== MASTER (USTA) ROUTES ===================
// ============================================================

router.post("/master", auth.verifyToken, masterController.createMaster);

router.get("/masters", auth.verifyToken, masterController.getMasters);

router.post(
  "/master/:master_id/car",
  auth.verifyToken,
  masterController.createCarToMaster
);

router.post(
  "/master/:master_id/car/:car_id/sale",
  auth.verifyToken,
  masterController.createSaleToCar
);

router.post(
  "/master/:master_id/payment",
  auth.verifyToken,
  masterController.createPaymentToMaster
);

router.delete(
  "/master/:master_id/delete",
  auth.verifyToken,
  masterController.deleteMasterById
);

router.delete(
  "/master/:master_id/cars/:car_id",
  auth.verifyToken,
  masterController.deleteCarFromMaster
);

// ============================================================
// ========================== TEST ============================
// ============================================================

router.get("/protected-route", auth.verifyToken, (req, res) => {
  res.status(200).send("This is a protected route");
});

module.exports = router;

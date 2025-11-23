// models/Client.js
const mongoose = require("mongoose");

/**
 * Qarz tarixi uchun umumiy schema (supplier va customer uchun ham ishlaydi)
 */
const debtHistorySchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    product_name: { type: String, required: true, trim: true },

    quantity: { type: Number, required: true, min: 1 },
    price_per_item: { type: Number, required: true, min: 0 },

    total_price: { type: Number, required: true, min: 0 },
    paid_amount: { type: Number, default: 0, min: 0 },
    remaining_debt: { type: Number, required: true, min: 0 },

    currency: { type: String, enum: ["usd", "sum"], default: "usd" },
    note: { type: String, default: "" },

    created_at: { type: Date, default: Date.now },
  },
  { _id: true }
);

// Auto hisob
debtHistorySchema.pre("validate", function (next) {
  const qty = Number(this.quantity || 0);
  const price = Number(this.price_per_item || 0);
  const paid = Number(this.paid_amount || 0);

  this.total_price = qty * price;
  this.remaining_debt = Math.max(0, this.total_price - paid);

  next();
});

const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    address: { type: String, default: "", trim: true },

    // ✅ TYPE FIELD QO'SHILDI
    type: {
      type: String,
      enum: ["supplier", "customer"],
      default: "supplier",
    },

    // === Supplier qarzi (biz supplierga qarzdormiz) ===
    supplier_total_debt: { type: Number, default: 0 },
    supplier_debt_history: { type: [debtHistorySchema], default: [] },

    // === Customer qarzi (customer bizga qarzdor) ===
    customer_total_debt: { type: Number, default: 0 },
    customer_debt_history: { type: [debtHistorySchema], default: [] },
  },
  {
    versionKey: false,
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

/* ================================================================
    SUPPLIER DEBT METHODS
================================================================ */

/** Supplier qarz qo‘shish */
clientSchema.methods.addSupplierDebt = function ({
  product_id,
  product_name,
  quantity,
  price_per_item,
  paid_amount = 0,
  currency = "usd",
  note = "",
}) {
  const qty = Number(quantity || 0);
  const price = Number(price_per_item || 0);
  const paid = Number(paid_amount || 0);

  const total_price = qty * price;
  const remaining_debt = Math.max(0, total_price - paid);

  const entry = {
    product_id,
    product_name,
    quantity: qty,
    price_per_item: price,
    paid_amount: paid,
    total_price,
    remaining_debt,
    currency,
    note,
  };

  this.supplier_debt_history.push(entry);
  this.supplier_total_debt += remaining_debt;

  return entry;
};

/** Supplierga to‘lov qilish */
clientSchema.methods.paySupplierDebt = function (amount) {
  let pay = Number(amount || 0);
  if (pay <= 0) return;

  this.supplier_total_debt = Math.max(0, this.supplier_total_debt - pay);

  for (let i = this.supplier_debt_history.length - 1; i >= 0; i--) {
    if (pay <= 0) break;

    const h = this.supplier_debt_history[i];
    const rem = Number(h.remaining_debt || 0);
    if (rem <= 0) continue;

    const used = Math.min(rem, pay);
    h.paid_amount += used;
    h.remaining_debt = Math.max(0, rem - used);
    pay -= used;
  }
};

/* ================================================================
    CUSTOMER DEBT METHODS
================================================================ */

/** Customer qarz qo‘shish (customer bizga qarzdor) */
clientSchema.methods.addCustomerDebt = function ({
  product_id,
  product_name,
  quantity,
  price_per_item,
  paid_amount = 0,
  currency = "usd",
  note = "",
}) {
  const qty = Number(quantity || 0);
  const price = Number(price_per_item || 0);
  const paid = Number(paid_amount || 0);

  const total_price = qty * price;
  const remaining_debt = Math.max(0, total_price - paid);

  const entry = {
    product_id,
    product_name,
    quantity: qty,
    price_per_item: price,
    paid_amount: paid,
    total_price,
    remaining_debt,
    currency,
    note,
  };

  this.customer_debt_history.push(entry);
  this.customer_total_debt += remaining_debt;

  return entry;
};

/** Customer qarzini to‘lash (customer bizga to‘laydi) */
clientSchema.methods.payCustomerDebt = function (amount) {
  let pay = Number(amount || 0);
  if (pay <= 0) return;

  this.customer_total_debt = Math.max(0, this.customer_total_debt - pay);

  // Oxirgi qarzdan boshlab yopiiladi
  for (let i = this.customer_debt_history.length - 1; i >= 0; i--) {
    if (pay <= 0) break;

    const h = this.customer_debt_history[i];
    const rem = Number(h.remaining_debt || 0);
    if (rem <= 0) continue;

    const used = Math.min(rem, pay);
    h.paid_amount += used;
    h.remaining_debt = Math.max(0, rem - used);
    pay -= used;
  }
};

module.exports = mongoose.model("Client", clientSchema);

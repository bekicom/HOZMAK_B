// models/Client.js
const mongoose = require("mongoose");

/**
 * Supplier qarz tarixi uchun schema
 * total_price va remaining_debt avtomatik hisoblanadi
 */
const debtHistorySchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    product_name: { type: String, required: true, trim: true },

    quantity: { type: Number, required: true, min: 1 },
    price_per_item: { type: Number, required: true, min: 0 },

    // auto hisoblanadi
    total_price: { type: Number, required: true, min: 0 },
    paid_amount: { type: Number, default: 0, min: 0 },
    remaining_debt: { type: Number, required: true, min: 0 },

    currency: {
      type: String,
      enum: ["usd", "sum"],
      default: "usd",
    },

    note: { type: String, default: "" },
    created_at: { type: Date, default: Date.now },
  },
  { _id: true }
);

// Safety: total_price va remaining_debt ni avtomatik qayta hisoblash
debtHistorySchema.pre("validate", function (next) {
  const qty = Number(this.quantity || 0);
  const price = Number(this.price_per_item || 0);
  const paid = Number(this.paid_amount || 0);

  this.total_price = qty * price;
  const rem = this.total_price - paid;
  this.remaining_debt = rem > 0 ? rem : 0;

  next();
});

const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    address: { type: String, default: "", trim: true },

    // === Supplier qarzi (biz ularga qarzdormiz) ===
    supplier_total_debt: { type: Number, default: 0, min: 0 },
    supplier_debt_history: { type: [debtHistorySchema], default: [] },
  },
  {
    versionKey: false,
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

/**
 * Supplier uchun yangi qarz qo'shish:
 *  - product_name, quantity, price_per_item, paid_amount, currency, note
 */
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

/**
 * Supplier qarzidan to'lov qilish (biz supplierga pul to'laymiz):
 *  - total debt kamayadi
 *  - history ichida oxirgisidan boshlab yopadi (LIFO)
 */
clientSchema.methods.paySupplierDebt = function (amount) {
  let pay = Number(amount || 0);
  if (pay <= 0) return;

  // totaldan kamaytirish
  this.supplier_total_debt = Math.max(0, this.supplier_total_debt - pay);

  // history bo'yicha yopish
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

module.exports = mongoose.model("Client", clientSchema);
